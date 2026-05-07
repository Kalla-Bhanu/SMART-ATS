import { hasAiConfig } from "../aiClient.mjs";
import { attachRequestError } from "./requestLog.mjs";

export function compactText(text = "", limit = 12000) {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
    .slice(0, limit);
}

export function requireText(value, name) {
  const text = compactText(value);
  if (!text) {
    const error = new Error(`${name} is required.`);
    error.status = 400;
    throw error;
  }
  return text;
}

export function sendError(res, error) {
  const status = error.status || 502;
  attachRequestError(res.req, error);
  res.status(status).json({
    error: error.message || "Request failed.",
    aiConfigured: hasAiConfig(),
  });
}
