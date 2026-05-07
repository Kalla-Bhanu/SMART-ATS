const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4";
const DEFAULT_REASONING_EFFORT = "medium";
const DEFAULT_TIMEOUT_MS = 180000;

function responsesUrl() {
  const rawBase = process.env.AI_BASE_URL || DEFAULT_BASE_URL;
  const trimmed = rawBase.replace(/\/+$/, "");
  return trimmed.endsWith("/responses") ? trimmed : `${trimmed}/responses`;
}

function apiKey() {
  return process.env.AI_API_KEY;
}

function extractOutputText(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  if (typeof response?.text === "string") return response.text;
  if (typeof response?.message?.content === "string") return response.message.content;

  const choice = response?.choices?.[0];
  if (typeof choice?.text === "string") return choice.text;
  if (typeof choice?.message?.content === "string") return choice.message.content;

  const chunks = [];
  for (const item of response?.output ?? []) {
    if (typeof item?.text === "string") chunks.push(item.text);
    if (typeof item?.content === "string") chunks.push(item.content);
    for (const content of item?.content ?? []) {
      if (typeof content === "string") chunks.push(content);
      if (typeof content?.text === "string") chunks.push(content.text);
      if (typeof content?.value === "string") chunks.push(content.value);
    }
  }

  return chunks.join("\n").trim();
}

function extractOutputTextFromSse(streamText) {
  let doneText = "";
  let deltaText = "";
  const errors = [];

  for (const block of streamText.split(/\n\n+/)) {
    const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const dataLines = [...block.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1]);
    if (!dataLines.length) continue;

    let data;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      continue;
    }

    if (event === "response.output_text.delta" && typeof data.delta === "string") {
      deltaText += data.delta;
    }
    if (event === "response.output_text.done" && typeof data.text === "string") {
      doneText = data.text;
    }
    if (data?.error?.message) {
      errors.push(data.error.message);
    }
  }

  if (doneText) return doneText.trim();
  if (deltaText) return deltaText.trim();
  if (errors.length) throw new Error(errors.join("; "));
  return "";
}

function parseJsonBlock(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!match) throw new Error("Model did not return JSON.");
    return JSON.parse(match[1]);
  }
}

export function hasAiConfig() {
  return Boolean(apiKey());
}

export function aiRuntimeConfig() {
  return {
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    reasoningEffort: process.env.AI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT,
    baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URL,
    timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

export async function callResumeModel({ instructions, input, schemaHint }) {
  const key = apiKey();
  if (!key) {
    throw new Error("Missing AI_API_KEY in the backend environment.");
  }

  const config = aiRuntimeConfig();
  const payload = {
    model: config.model,
    reasoning: {
      effort: config.reasoningEffort,
    },
    instructions,
    input,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response;

  try {
    response = await fetch(responsesUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`AI proxy request timed out after ${config.timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI proxy returned ${response.status}: ${detail.slice(0, 700)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  const text = contentType.includes("text/event-stream")
    ? extractOutputTextFromSse(rawText)
    : extractOutputText(JSON.parse(rawText));
  if (!text) throw new Error("AI proxy returned an empty model response.");

  try {
    return parseJsonBlock(text);
  } catch (error) {
    if (!schemaHint) throw error;
    throw new Error(`${error.message} Expected: ${schemaHint}`);
  }
}
