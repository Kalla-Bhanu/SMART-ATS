import { Router } from "express";
import yaml from "js-yaml";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callResumeModel } from "../aiClient.mjs";
import { requireText, sendError } from "../lib/http.mjs";

export const resumeRoutes = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..", "..");

resumeRoutes.get("/master", async (req, res) => {
  try {
    const masterYamlPath = path.join(backendRoot, "v01", "master.yaml");
    const content = await fs.readFile(masterYamlPath, "utf8");
    res.type("text/yaml").send(content);
  } catch (error) {
    console.error("[get-master] failed to read master.yaml:", error.message);
    res.status(500).json({ error: "Could not load master.yaml: " + error.message });
  }
});

resumeRoutes.post("/llm-passthrough", async (req, res) => {
  try {
    const instructions = typeof req.body.instructions === "string" ? req.body.instructions : "";
    const input = typeof req.body.input === "string" ? req.body.input : "";
    const schemaHint = typeof req.body.schemaHint === "string" ? req.body.schemaHint : undefined;

    if (!instructions || !input) {
      return res.status(400).json({ error: "Both 'instructions' and 'input' are required string fields." });
    }

    if (instructions.length > 50000 || input.length > 50000) {
      return res.status(400).json({ error: "Prompt exceeds 50000 characters per field. Reduce input size." });
    }

    console.log("[llm-passthrough] forwarding request, instructions length:", instructions.length, "input length:", input.length);

    const startTime = Date.now();
    const result = await callResumeModel({
      instructions,
      input,
      schemaHint,
    });
    const duration = Date.now() - startTime;

    console.log("[llm-passthrough] LLM call completed in", duration, "ms");

    res.json({
      result,
      duration_ms: duration,
    });
  } catch (error) {
    console.error("[llm-passthrough] failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

async function callResumeModelWithRetry({ instructions, input, schemaHint, maxRetries = 2 }) {
  let lastError = null;
  let lastResult = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = attempt === 1 ? 5000 : 15000;
      console.log(`[scan-retry] attempt ${attempt + 1}/${maxRetries + 1}, waiting ${delayMs}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    try {
      const result = await callResumeModel({ instructions, input, schemaHint });

      // Validate response has substantive content
      if (!result || typeof result !== "object") {
        lastResult = result;
        lastError = new Error("LLM returned non-object response");
        console.log(`[scan-retry] attempt ${attempt + 1} returned non-object; retrying`);
        continue;
      }

      const fitAnalysis = Array.isArray(result.fit_analysis) ? result.fit_analysis : [];
      if (fitAnalysis.length === 0) {
        lastResult = result;
        lastError = new Error("LLM returned empty fit_analysis array");
        console.log(`[scan-retry] attempt ${attempt + 1} returned empty fit_analysis; retrying`);
        continue;
      }

      // Detect "collapsed response" â€” single entry with generic text indicating LLM didn't analyze properly
      if (fitAnalysis.length === 1) {
        const onlyEntry = fitAnalysis[0];
        const reqText = String(onlyEntry?.jd_requirement || onlyEntry?.requirement || "").toLowerCase();
        const isGenericPlaceholder =
          reqText.includes("readable job description") ||
          reqText.includes("placeholder") ||
          reqText.length < 10 ||
          reqText.length > 300;
        if (isGenericPlaceholder) {
          lastResult = result;
          lastError = new Error("LLM returned single placeholder fit_analysis entry");
          console.log(`[scan-retry] attempt ${attempt + 1} returned collapsed/placeholder response; retrying`);
          continue;
        }
      }

      // Detect missing required top-level fields
      if (!result.overall || !result.jd_summary || !result.ats_assessment || !result.human_readability) {
        lastResult = result;
        lastError = new Error("LLM response missing required top-level fields");
        console.log(`[scan-retry] attempt ${attempt + 1} missing top-level fields; retrying`);
        continue;
      }

      // Response looks valid
      if (attempt > 0) {
        console.log(`[scan-retry] attempt ${attempt + 1} succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;
      console.log(`[scan-retry] attempt ${attempt + 1} threw error: ${error.message}`);

      // If it's an auth error or invalid request, don't retry
      const msg = String(error?.message || "");
      if (msg.includes("401") || msg.includes("403") || msg.includes("Missing AI_API_KEY")) {
        throw error;
      }
    }
  }

  // All retries exhausted
  if (lastResult && Array.isArray(lastResult.fit_analysis) && lastResult.fit_analysis.length > 0) {
    // Return whatever we got â€” the validator was overly strict but we have something
    console.log(`[scan-retry] all attempts had validation issues, returning best-effort response`);
    return lastResult;
  }
  throw lastError || new Error("Scan failed after retries");
}

async function loadMasterAsResumeText() {
  try {
    const masterPath = path.resolve(process.cwd(), "v01", "master.yaml");
    const raw = await fs.readFile(masterPath, "utf8");
    const master = yaml.load(raw);
    if (!master || typeof master !== "object") return "";

    const lines = [];

    // Header
    if (master.name) lines.push(master.name);
    if (master.title) lines.push(master.title);
    if (master.contact) {
      const contactBits = [];
      if (master.contact.phone) contactBits.push(master.contact.phone);
      if (master.contact.email) contactBits.push(master.contact.email);
      if (master.contact.github) contactBits.push(master.contact.github);
      if (master.contact.linkedin) contactBits.push(master.contact.linkedin);
      if (contactBits.length > 0) lines.push(contactBits.join(" | "));
    }
    lines.push("");

    // Summary
    if (master.summary) {
      lines.push("SUMMARY");
      lines.push(String(master.summary).trim());
      lines.push("");
    }

    // Experience
    if (Array.isArray(master.experience) && master.experience.length > 0) {
      lines.push("PROFESSIONAL EXPERIENCE");
      lines.push("");
      master.experience.forEach((role) => {
        const headerParts = [];
        if (role.title) headerParts.push(role.title);
        if (role.company) headerParts.push(role.company);
        if (role.location) headerParts.push(role.location);
        const header = headerParts.join(" | ");
        const dates = `${role.start || ""}${role.end ? ` - ${role.end}` : ""}`;
        if (header) lines.push(header + (dates ? `   ${dates}` : ""));
        if (Array.isArray(role.bullets)) {
          role.bullets.forEach((b) => {
            if (b && b.text) lines.push(`- ${b.text}`);
          });
        }
        lines.push("");
      });
    }

    // Skills
    if (master.skills && typeof master.skills === "object") {
      lines.push("SKILLS");
      Object.entries(master.skills).forEach(([category, items]) => {
        if (Array.isArray(items) && items.length > 0) {
          lines.push(`${category}: ${items.join(", ")}`);
        } else if (typeof items === "string") {
          lines.push(`${category}: ${items}`);
        }
      });
      lines.push("");
    }

    // Education
    if (Array.isArray(master.education) && master.education.length > 0) {
      lines.push("EDUCATION");
      master.education.forEach((edu) => {
        const eduParts = [];
        if (edu.school) eduParts.push(edu.school);
        if (edu.degree) eduParts.push(edu.degree);
        if (edu.dates) eduParts.push(edu.dates);
        if (eduParts.length > 0) lines.push(eduParts.join(" - "));
        if (edu.notes) lines.push(edu.notes);
      });
      lines.push("");
    }

    // Projects
    if (Array.isArray(master.projects) && master.projects.length > 0) {
      lines.push("PROJECTS");
      lines.push("");
      master.projects.forEach((proj) => {
        if (proj.name) lines.push(proj.name);
        if (Array.isArray(proj.bullets)) {
          proj.bullets.forEach((b) => {
            if (b && b.text) lines.push(`- ${b.text}`);
          });
        }
        lines.push("");
      });
    }

    return lines.join("\n").trim();
  } catch (error) {
    console.error("[loadMasterAsResumeText] failed:", error.message);
    return "";
  }
}

async function rewriteBulletWithIntegrity({ originalBullet, jdRequirement, rewriteSuggestion, anchorTermsToSurface, sectionContext, maxRetries = 2 }) {
  const baseInstructions = [
    "You are rewriting a single resume bullet to better align with a job description requirement.",
    "",
    "CRITICAL INTEGRITY RULES â€” VIOLATING THESE INVALIDATES THE REWRITE:",
    "1. Use ONLY tools, technologies, frameworks, products, and certifications that appear in the original bullet. Do NOT add new ones.",
    "2. Use ONLY metrics (numbers, percentages, time spans, counts) that appear in the original bullet. Do NOT add new ones.",
    "3. Use ONLY actions and outcomes that the original bullet describes. Do NOT add new accomplishments.",
    "4. Preserve all date references, employer references, role-scope claims that appear in the original.",
    "5. The rewrite must be roughly the same length as the original (within 20%).",
    "6. The rewrite must start with a strong action verb.",
    "",
    "WHAT YOU CAN DO:",
    "- Reword for clarity and JD alignment",
    "- Use vocabulary from the JD (anchor terms) where it accurately describes existing work",
    "- Reorder phrases for better flow",
    "- Lead with the most JD-relevant evidence",
    "",
    "Return JSON only with this shape: {\"rewrite\": \"<the rewritten bullet>\", \"reasoning\": \"<1-2 sentence explanation of what changed>\"}",
    "Do NOT include markdown code fences. Do NOT include any prose outside the JSON.",
  ].join("\n");

  const inputText = [
    `JD REQUIREMENT (the bullet should better align with this):`,
    jdRequirement,
    "",
    `REWRITE GUIDANCE (from prior analysis):`,
    rewriteSuggestion || "(no specific guidance; reword for clarity and JD alignment)",
    "",
    `ANCHOR TERMS TO SURFACE (use these where they accurately describe existing work):`,
    Array.isArray(anchorTermsToSurface) && anchorTermsToSurface.length > 0 ? anchorTermsToSurface.join(", ") : "(none specified)",
    "",
    `SECTION CONTEXT:`,
    sectionContext || "(unknown)",
    "",
    `ORIGINAL BULLET:`,
    originalBullet,
    "",
    "Now produce the rewrite as JSON.",
  ].join("\n");

  let lastError = null;
  let lastRewriteAttempt = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = attempt === 1 ? 5000 : 15000;
      console.log(`[rewrite-bullet] attempt ${attempt + 1}/${maxRetries + 1} for bullet, waiting ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    let stricterInstructions = baseInstructions;
    if (attempt > 0 && lastError && String(lastError.message).includes("validation")) {
      stricterInstructions += "\n\nCRITICAL: Your previous attempt failed validation. The rewrite MUST NOT add any tool, technology, or metric not in the original. Try again with more conservative phrasing.";
    }

    try {
      const result = await callResumeModel({
        instructions: stricterInstructions,
        input: inputText,
        schemaHint: '{"rewrite":"...","reasoning":"..."}',
      });

      if (!result || typeof result !== "object" || typeof result.rewrite !== "string") {
        lastError = new Error("Rewrite response missing 'rewrite' string field");
        console.log(`[rewrite-bullet] attempt ${attempt + 1} returned malformed response`);
        lastRewriteAttempt = result;
        continue;
      }

      const rewrite = result.rewrite.trim();

      // Validation: length sanity
      if (rewrite.length < 20 || rewrite.length > Math.max(originalBullet.length * 1.5, 500)) {
        lastError = new Error(`Rewrite failed validation: length ${rewrite.length} out of bounds (original ${originalBullet.length})`);
        console.log(`[rewrite-bullet] attempt ${attempt + 1} length validation failed`);
        lastRewriteAttempt = rewrite;
        continue;
      }

      // Validation: extract tools/metrics from original and check rewrite doesn't add new ones
      const COMMON_ACTION_VERBS = new Set([
        "engineered","built","authored","developed","designed","configured","deployed","architected",
        "automated","streamlined","optimized","enhanced","refined","tuned","validated","surfaced",
        "reframed","implemented","established","scoped","contributed","led","operated","triaged",
        "scripted","analyzed","investigated","reduced","improved","increased","accelerated",
        "drove","supported","monitored","detected","correlated","mapped","integrated","aggregated",
        "modeled","reviewed","strengthened","secured","containerized","orchestrated","scaled",
        "applied","executed","performed","tracked","reported","documented","resolved","contained",
        "remediated","escalated","triaged","prioritized","reduced","minimized","maximized",
        "produced","managed","oversaw","coordinated","aligned","centralized","standardized",
      ]);

      const COMMON_ADJECTIVES_DESCRIPTORS = new Set([
        "ci-verified","ci-driven","ci-enabled","ci-integrated","cloud-native","cloud-aware","cloud-scale",
        "policy-as-code","monitor-as-code","detection-as-code","security-as-code",
        "att&ck-mapped","att&ck-aligned","nist-aligned","mitre-aligned",
        "shift-left","fail-safe","high-volume","high-fidelity","high-risk","low-noise",
        "data-driven","metric-driven","evidence-rich","threat-informed",
      ]);

      const isLikelyTool = (token) => {
        const lower = token.toLowerCase();
        // Already an action verb? Not a tool.
        if (COMMON_ACTION_VERBS.has(lower)) return false;
        // Already a known descriptor? Not a tool.
        if (COMMON_ADJECTIVES_DESCRIPTORS.has(lower)) return false;
        // Has internal capitals (CamelCase) â€” likely a brand: CrowdStrike, MongoDB, GuardDuty
        if (/[a-z][A-Z]/.test(token)) return true;
        // Contains digits â€” likely a technique or version: T1110, T1078, S3, EC2, K8s
        if (/\d/.test(token)) return true;
        // Contains special chars common in tool names: /, &, +, .
        if (/[/&+.]/.test(token)) return true;
        // All caps and 2-6 chars â€” likely an acronym: AWS, NIST, CISSP, EDR, SIEM, MFA, IAM
        if (/^[A-Z]{2,6}$/.test(token)) return true;
        // Otherwise, capitalized at start of sentence is likely just a normal word.
        // Examples that should NOT count as tools: Engineered, Authored, Built, Modeled, Improved
        return false;
      };

      const extractCapitalizedTokens = (text) => {
        // First split slash-chains so "CloudTrail/IAM/STS/S3/EKS/KMS" becomes individual tokens
        const slashSplit = text.replace(/([A-Za-z0-9])\/([A-Za-z0-9])/g, "$1 $2");
        const matches = slashSplit.match(/\b[A-Za-z][A-Za-z0-9+&.-]{1,}\b/g) || [];
        const stopWords = new Set(["the","and","with","via","for","from","into","using","across","to","of","in","on","by","or","an","a","is","was","were","are","be","been","being","that","this","which","while","when","then","than","but","also","such","as"]);
        return new Set(
          matches
            .filter(t => isLikelyTool(t))
            .map(t => t.toLowerCase())
            .filter(t => t.length > 1 && !stopWords.has(t))
        );
      };
      const extractMetrics = (text) => {
        // Extract just the leading number as the fingerprint, not the unit
        // This way "7 detections" and "7 monitor-as-code detections" produce the same fingerprint "7"
        const matches = text.match(/\b\d+(\.\d+)?(%|\+)?/g) || [];
        return new Set(matches.map(m => m.toLowerCase().trim()).filter(m => m.length > 0));
      };

      const originalTokens = extractCapitalizedTokens(originalBullet);
      const rewriteTokens = extractCapitalizedTokens(rewrite);
      const newTokens = [...rewriteTokens].filter(t => !originalTokens.has(t));

      const originalMetrics = extractMetrics(originalBullet);
      const rewriteMetrics = extractMetrics(rewrite);
      const newMetrics = [...rewriteMetrics].filter(m => !originalMetrics.has(m));

      // Allow common JD vocabulary that's not really a "tool" â€” these aren't fabrication
      const allowedVocab = new Set(["att&ck","mitre","nist","iso","sigma","saas","aws","azure","gcp","ci","cd","cspm","cnapp","edr","siem","mfa","sso","vpn","dlp","rbac","iam","sla"]);
      const trulyNewTokens = newTokens.filter(t => !allowedVocab.has(t));

      // Allow up to 1 ambiguous new token (could be tokenizer edge case) but block if more.
      // Strong fabrication = 2+ new proper-noun tokens or 1+ new numerical metric.
      if (trulyNewTokens.length >= 2) {
        lastError = new Error(`Rewrite failed validation: introduced ${trulyNewTokens.length} new tools/proper-nouns not in original: ${trulyNewTokens.join(", ")}`);
        console.log(`[rewrite-bullet] attempt ${attempt + 1} introduced new tokens: ${trulyNewTokens.join(", ")}`);
        lastRewriteAttempt = rewrite;
        continue;
      }

      if (trulyNewTokens.length === 1) {
        // Single ambiguous token â€” log but allow. Could be tokenizer edge case.
        console.log(`[rewrite-bullet] attempt ${attempt + 1} introduced 1 ambiguous token (allowing): ${trulyNewTokens[0]}`);
      }

      if (newMetrics.length > 0) {
        lastError = new Error(`Rewrite failed validation: introduced new metrics not in original: ${newMetrics.join(", ")}`);
        console.log(`[rewrite-bullet] attempt ${attempt + 1} introduced new metrics: ${newMetrics.join(", ")}`);
        lastRewriteAttempt = rewrite;
        continue;
      }

      // Passed validation
      if (attempt > 0) {
        console.log(`[rewrite-bullet] attempt ${attempt + 1} succeeded after retries`);
      }
      return {
        success: true,
        rewrite,
        reasoning: typeof result.reasoning === "string" ? result.reasoning : null,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || "");
      console.log(`[rewrite-bullet] attempt ${attempt + 1} threw: ${msg}`);
      if (msg.includes("401") || msg.includes("403") || msg.includes("Missing AI_API_KEY")) {
        throw error;
      }
    }
  }

  return {
    success: false,
    rewrite: originalBullet,
    reasoning: `Rewrite failed after ${maxRetries + 1} attempts; falling back to original. Last error: ${lastError?.message || "unknown"}`,
    attempts: maxRetries + 1,
    last_failed_rewrite: lastRewriteAttempt,
  };
}

resumeRoutes.post("/scan", async (req, res) => {
  try {
    const jdText = typeof req.body.jdText === "string" ? req.body.jdText : "";
    const resumeText = typeof req.body.resumeText === "string" ? req.body.resumeText : "";

    if (!jdText) {
      return res.status(400).json({ error: "jdText is required" });
    }

    const masterYamlPath = path.join(backendRoot, "v01", "master.yaml");
    let masterYamlContent;
    try {
      masterYamlContent = await fs.readFile(masterYamlPath, "utf8");
    } catch (err) {
      throw new Error("Could not read master.yaml: " + err.message);
    }

    const instructions = [
      "You are an expert career analyst and resume reviewer. You will analyze a candidate's master resume against a specific job description and produce a comprehensive report.",
      "",
      "YOU MUST RETURN A SINGLE JSON OBJECT with these top-level fields:",
      "  ats_assessment: object â€” overall ATS-readiness check",
      "  human_readability: object â€” would a human reviewer find this resume clear, concise, evidence-rich",
      "  jd_summary: object â€” what this job actually wants",
      "  fit_analysis: array â€” per-requirement diff between candidate evidence and JD",
      "  overall: object â€” summary recommendation",
      "",
      "FIELD SPECIFICATIONS:",
      "",
      "ats_assessment:",
      "  passed: boolean â€” overall pass/fail for ATS readiness",
      "  score: number 0-100",
      "  checks: array of {name, passed, note} for: standard section headers, contact info parseable, date format consistency, format compliance, anchor coverage, role title compatibility",
      "  rationale: 1-2 sentence summary",
      "",
      "human_readability:",
      "  score: number 0-100",
      "  band: 'risk' | 'acceptable' | 'strong'",
      "  subscores: object with these number 0-100 fields: orphans, coherence, metrics, specificity, anti_stuffing, evidence",
      "  diagnostics: array of strings, max 5 specific notes",
      "",
      "jd_summary:",
      "  role_title: string",
      "  company: string",
      "  seniority: string",
      "  primary_stack: string",
      "  deal_breakers: array of strings",
      "  critical_requirements: array of strings",
      "  nice_to_haves: array of strings",
      "",
      "fit_analysis: array of {",
      "  jd_requirement: string â€” the requirement quoted or paraphrased",
      "  evidence_status: 'STRONG_MATCH' | 'PARTIAL_MATCH' | 'WEAK_MATCH' | 'MISSING'",
      "  best_matching_bullet_id: string from master.yaml or null",
      "  current_bullet_text: string or null",
      "  match_quality: string explaining the match",
      "  rewrite_needed: boolean",
      "  rewrite_suggestion: string with specific guidance, or null",
      "  anchor_terms_to_surface: array of strings",
      "  honest_note: string or null",
      "}",
      "",
      "overall:",
      "  fit_score: string like '6/9' (covered + 0.5*partial / total, rounded)",
      "  recommendation: 'STRONG_FIT' | 'MODERATE_FIT' | 'STRETCH' | 'POOR_FIT'",
      "  recommendation_reasoning: 2-3 sentences",
      "  deal_breaker_check: string with specific blockers or 'none identified'",
      "  rewrites_recommended: number",
      "  rewrites_unnecessary: number",
      "  honest_gaps: array of strings",
      "",
      "REQUIRED VS PREFERRED CLASSIFICATION (very important):",
      "Before classifying anything, scan the JD for sections labeled 'Required', 'Must Have', 'Minimum Qualifications', 'Your Background', 'You Need', 'Eligibility' â€” these are REQUIRED.",
      "Sections labeled 'Preferred', 'Nice to Have', 'Bonus', 'Plus', 'Desirable', 'Highly Recommended', 'A Plus' â€” these are PREFERRED.",
      "If the JD ONLY has preferred-style qualifications and no required section, treat all qualifications as PREFERRED (not required).",
      "Mark each fit_analysis entry's requirement_priority field as 'required' | 'preferred' | 'implied'.",
      "",
      "RECOMMENDATION RULES:",
      "Use this calibration when computing overall.recommendation:",
      "  STRONG_FIT â€” all required qualifications met (STRONG_MATCH or PARTIAL_MATCH); most preferred qualifications met; no deal-breakers",
      "  MODERATE_FIT â€” all required qualifications met; some preferred qualifications missing; no deal-breakers. Default for JDs with only preferred qualifications when most preferred are met.",
      "  STRETCH â€” 1-2 required qualifications missing OR seniority gap of 1-3 years OR significant preferred gaps in critical areas",
      "  POOR_FIT â€” 3+ required qualifications missing OR seniority gap of 4+ years OR hard deal-breakers (on-site mismatch with candidate's stated remote, citizenship/clearance the candidate explicitly cannot meet)",
      "",
      "Required gaps weight 5x more than preferred gaps in this calibration. Missing 5 preferred items is roughly equivalent to missing 1 required item.",
      "If a JD has NO required qualifications listed (only preferred), default to MODERATE_FIT or STRONG_FIT based on preferred coverage; do not use STRETCH or POOR_FIT unless there is an explicit deal-breaker like an on-site mismatch.",
      "",
      "DEAL-BREAKER RULES:",
      "Only flag as a deal-breaker if the JD states it explicitly AND the candidate's master.yaml or PDF text clearly cannot meet it.",
      "Do NOT speculate about logistical blockers. 'Hybrid in Middletown CT' is informational, not a deal-breaker, unless the candidate's master.yaml says they live somewhere far away.",
      "Do NOT flag background check requirements as deal-breakers â€” they're standard hiring procedure.",
      "Do NOT flag 'will require commute or relocation' speculatively. Only flag if the candidate's location is in master.yaml AND it's incompatible.",
      "",
      "FIT_SCORE COMPUTATION:",
      "Compute overall.fit_score as 'X/Y' where Y is the total number of fit_analysis entries and X is computed as: STRONG_MATCH = 1.0 point, PARTIAL_MATCH = 0.75 point, WEAK_MATCH = 0.5 point, MISSING = 0 points. Round X to nearest integer.",
      "This means an entry classified PARTIAL_MATCH should be counted as 'covered' for display purposes; the X/Y format reflects qualified coverage, not strict pass/fail.",
      "",
      "GENERAL RULES:",
      "- NEVER invent tools, metrics, or experience the candidate does not have in master.yaml.",
      "- All rewrite suggestions must use only evidence already in the matched bullet.",
      "- Be specific. 'Reframe to match X' is useless. 'Surface AWS GuardDuty work and rephrase detection authoring as cloud security monitoring' is useful.",
      "- The candidate has 2+ years experience. Flag 5+ year requirements as a seniority gap, but only as STRETCH or POOR_FIT if seniority is in the REQUIRED section.",
      "- For ats_assessment.checks, evaluate the resume PDF text â€” parseable headers, dates, contact info.",
      "- For human_readability, evaluate clarity, metric specificity, evidence depth, no keyword stuffing.",
      "- Return JSON only. No prose outside the JSON. No markdown code fences.",
    ].join("\n");

    const input = [
      "CANDIDATE MASTER RESUME (YAML, ground truth):",
      masterYamlContent.slice(0, 14000),
      "",
      "RESUME PDF TEXT (what an ATS would see):",
      resumeText.slice(0, 8000) || "(no resume text supplied; use master.yaml for evidence)",
      "",
      "JOB DESCRIPTION:",
      jdText.slice(0, 10000),
      "",
      "Now produce the structured analysis as a single JSON object.",
    ].join("\n");

    const schemaHint = '{"ats_assessment":{"passed":true,"score":85,"checks":[{"name":"...","passed":true,"note":"..."}],"rationale":"..."},"human_readability":{"score":80,"band":"strong","subscores":{"orphans":100,"coherence":90,"metrics":85,"specificity":100,"anti_stuffing":100,"evidence":100},"diagnostics":["..."]},"jd_summary":{"role_title":"...","company":"...","seniority":"...","primary_stack":"...","deal_breakers":["..."],"critical_requirements":["..."],"nice_to_haves":["..."]},"fit_analysis":[{"jd_requirement":"...","requirement_priority":"required","evidence_status":"STRONG_MATCH","best_matching_bullet_id":"...","current_bullet_text":"...","match_quality":"...","rewrite_needed":true,"rewrite_suggestion":"...","anchor_terms_to_surface":["..."],"honest_note":null}],"overall":{"fit_score":"6/9","recommendation":"MODERATE_FIT","recommendation_reasoning":"...","deal_breaker_check":"...","rewrites_recommended":2,"rewrites_unnecessary":4,"honest_gaps":["..."]}}';

    console.log("[scan] starting analysis, jd length:", jdText.length, "resume length:", resumeText.length);

    const startTime = Date.now();
    const result = await callResumeModelWithRetry({
      instructions,
      input,
      schemaHint,
      maxRetries: 2,
    });
    const duration = Date.now() - startTime;

    console.log("[scan] analysis completed in", duration, "ms, fit_analysis entries:", (result?.fit_analysis || []).length);

    // Validate and reconcile fit_score for consistent display
    if (result && Array.isArray(result.fit_analysis) && result.overall) {
      const total = result.fit_analysis.length;
      let weightedScore = 0;
      let coveredCount = 0;
      for (const entry of result.fit_analysis) {
        const status = entry.evidence_status;
        if (status === "STRONG_MATCH") { weightedScore += 1.0; coveredCount += 1; }
        else if (status === "PARTIAL_MATCH") { weightedScore += 0.75; coveredCount += 1; }
        else if (status === "WEAK_MATCH") { weightedScore += 0.5; }
      }
      const computedFitScore = `${Math.round(weightedScore)}/${total || 1}`;
      const computedCoveredDisplay = `${coveredCount} of ${total} requirements covered.`;

      // If LLM's fit_score disagrees by more than 1, override with computed
      const llmScoreMatch = String(result.overall.fit_score || "").match(/^(\d+)\/(\d+)$/);
      if (llmScoreMatch) {
        const llmNum = parseInt(llmScoreMatch[1], 10);
        const llmDen = parseInt(llmScoreMatch[2], 10);
        if (llmDen !== total || Math.abs(llmNum - Math.round(weightedScore)) > 1) {
          console.log("[scan] reconciling fit_score: LLM said", result.overall.fit_score, "computed", computedFitScore);
          result.overall.fit_score = computedFitScore;
        }
      } else {
        result.overall.fit_score = computedFitScore;
      }
      result.overall.coverage_display = computedCoveredDisplay;
    }

    res.json({
      result,
      duration_ms: duration,
    });
  } catch (error) {
    console.error("[scan] failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

resumeRoutes.post("/rewrite-resume", async (req, res) => {
  try {
    const scanResult = req.body && req.body.scanResult;
    if (!scanResult || typeof scanResult !== "object" || !Array.isArray(scanResult.fit_analysis)) {
      return res.status(400).json({ error: "scanResult with fit_analysis array is required" });
    }

    const jdSummary = scanResult.jd_summary || {};
    const fitAnalysis = scanResult.fit_analysis;

    // First filter to entries that need rewriting and have a usable bullet
    const candidateEntries = fitAnalysis.filter(entry =>
      entry &&
      entry.rewrite_needed === true &&
      typeof entry.current_bullet_text === "string" &&
      entry.current_bullet_text.length > 10
    );

    // Deduplicate by bullet text â€” if two JD requirements target the same bullet,
    // combine their requirements into a single rewrite call.
    const dedupedMap = new Map();
    for (const entry of candidateEntries) {
      const bulletKey = entry.current_bullet_text.trim().toLowerCase().slice(0, 200);
      if (!dedupedMap.has(bulletKey)) {
        dedupedMap.set(bulletKey, {
          original_bullet: entry.current_bullet_text,
          best_matching_bullet_id: entry.best_matching_bullet_id || "unknown section",
          jd_requirements: [entry.jd_requirement],
          rewrite_suggestions: [entry.rewrite_suggestion].filter(Boolean),
          anchor_terms: new Set(entry.anchor_terms_to_surface || []),
        });
      } else {
        const existing = dedupedMap.get(bulletKey);
        existing.jd_requirements.push(entry.jd_requirement);
        if (entry.rewrite_suggestion) existing.rewrite_suggestions.push(entry.rewrite_suggestion);
        (entry.anchor_terms_to_surface || []).forEach(t => existing.anchor_terms.add(t));
      }
    }

    const bulletsToRewrite = Array.from(dedupedMap.values()).map(d => ({
      current_bullet_text: d.original_bullet,
      best_matching_bullet_id: d.best_matching_bullet_id,
      jd_requirement: d.jd_requirements.join(" AND ALSO: "),
      rewrite_suggestion: d.rewrite_suggestions.length > 0 ? d.rewrite_suggestions.join(" Plus: ") : null,
      anchor_terms_to_surface: Array.from(d.anchor_terms),
    }));

    console.log(`[rewrite-resume] starting; ${bulletsToRewrite.length} bullets need rewriting out of ${fitAnalysis.length} requirements`);

    if (bulletsToRewrite.length === 0) {
      return res.json({
        success: true,
        no_changes_needed: true,
        message: "No rewrites needed. Your base resume is already well-positioned for this JD.",
        prompt: null,
        stats: { total: fitAnalysis.length, rewritten: 0, failed: 0, no_change: fitAnalysis.length },
      });
    }

    const startTime = Date.now();
    const rewriteResults = [];
    let succeededCount = 0;
    let failedCount = 0;

    for (let i = 0; i < bulletsToRewrite.length; i++) {
      const entry = bulletsToRewrite[i];
      const sectionContext = entry.best_matching_bullet_id || "unknown section";
      console.log(`[rewrite-resume] rewriting bullet ${i + 1}/${bulletsToRewrite.length}: ${sectionContext}`);

      const result = await rewriteBulletWithIntegrity({
        originalBullet: entry.current_bullet_text,
        jdRequirement: entry.jd_requirement,
        rewriteSuggestion: entry.rewrite_suggestion,
        anchorTermsToSurface: entry.anchor_terms_to_surface,
        sectionContext,
        maxRetries: 2,
      });

      if (result.success) {
        succeededCount += 1;
      } else {
        failedCount += 1;
      }

      rewriteResults.push({
        section: sectionContext,
        jd_requirement: entry.jd_requirement,
        original: entry.current_bullet_text,
        rewrite: result.rewrite,
        success: result.success,
        reasoning: result.reasoning,
        attempts: result.attempts,
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[rewrite-resume] complete in ${totalDuration}ms. Success: ${succeededCount}, Failed: ${failedCount}`);

    // Load the master.yaml as text reference
    const masterResumeText = await loadMasterAsResumeText();

    // Build the Claude.ai-ready prompt
    const promptLines = [
      "I'm uploading my base resume PDF. I need a tailored version for a specific job application. Please make ONLY the following bullet replacements and return the result as a PDF with the same formatting.",
      "",
      "CURRENT RESUME (text reference â€” use this to identify which bullets to replace; the PDF will have the same content with visual styling):",
      "",
      masterResumeText || "(master resume text unavailable â€” refer to uploaded PDF only)",
      "",
      "===========================================================",
      "",
      "CRITICAL FORMATTING REQUIREMENTS â€” DO NOT VIOLATE:",
      "- Keep the exact same fonts, font sizes, and font weights as the original",
      "- Keep the exact same margins, line spacing, and paragraph spacing",
      "- Keep the exact same section headers, dividers, and visual hierarchy",
      "- Keep the exact same bullet style, indentation, and alignment",
      "- Keep all dates, employer names, locations, education, and skills sections unchanged",
      "- Do NOT add, remove, or reorder any sections",
      "- Do NOT change the resume's title or contact info",
      "- Output a PDF that is visually indistinguishable from the original except for the specific bullet text changes listed below",
      "",
      "CRITICAL CONTENT REQUIREMENTS â€” DO NOT VIOLATE:",
      "- Use ONLY the rewrites I provide below; do not invent new ones",
      "- Do NOT add tools, technologies, certifications, or metrics that are not in the rewrites",
      "- Each rewrite preserves the original bullet's evidence (tools mentioned, metrics, scope)",
      "- If a rewrite looks unsafe to apply, keep the original bullet instead",
      "",
      "JD CONTEXT:",
      `Role: ${jdSummary.role_title || "(not specified)"}`,
      `Company: ${jdSummary.company || "(not specified)"}`,
      `Reason for tailoring: Surface JD-relevant vocabulary and evidence using only existing resume content.`,
      "",
      "BULLET REPLACEMENTS:",
      "",
    ];

    rewriteResults.forEach((r, idx) => {
      if (!r.success) return;
      promptLines.push(`[${idx + 1}] In the section identified as "${r.section}":`);
      promptLines.push(`REPLACE this bullet:`);
      promptLines.push(`"${r.original}"`);
      promptLines.push(``);
      promptLines.push(`WITH this bullet:`);
      promptLines.push(`"${r.rewrite}"`);
      promptLines.push(``);
    });

    promptLines.push("");
    promptLines.push("Please apply these specific replacements to my uploaded PDF and return the tailored version as a PDF download with the exact same formatting as the original.");

    const finalPrompt = promptLines.join("\n");

    res.json({
      success: true,
      no_changes_needed: false,
      prompt: finalPrompt,
      rewrites: rewriteResults,
      stats: {
        total: fitAnalysis.length,
        rewritten: succeededCount,
        failed: failedCount,
        no_change: fitAnalysis.length - bulletsToRewrite.length,
      },
      duration_ms: totalDuration,
    });
  } catch (error) {
    console.error("[rewrite-resume] failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const pdfParseScript = path.join(backendRoot, "scripts", "parse-resume-pdf.py");
const sessionRoot = path.join(os.tmpdir(), "local-ats-scanner-sessions");

function routeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeSessionId(sessionId) {
  const clean = String(sessionId || "").trim();
  if (!/^[a-f0-9-]{36}$/i.test(clean)) throw routeError(400, "Invalid resume session ID.");
  return clean.toLowerCase();
}

async function ensureSessionRoot() {
  await fs.mkdir(sessionRoot, { recursive: true });
}

function sessionPaths(sessionId) {
  const id = normalizeSessionId(sessionId);
  const dir = path.join(sessionRoot, id);
  return {
    id,
    dir,
    pdf: path.join(dir, "source.pdf"),
    meta: path.join(dir, "metadata.json"),
  };
}

async function cleanupOldSessions() {
  try {
    await ensureSessionRoot();
    const entries = await fs.readdir(sessionRoot, { withFileTypes: true });
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await Promise.allSettled(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const dir = path.join(sessionRoot, entry.name);
          const stat = await fs.stat(dir);
          if (stat.mtimeMs < cutoff) await fs.rm(dir, { recursive: true, force: true });
        }),
    );
  } catch {
    // Session cleanup is opportunistic; never block the active workflow.
  }
}

async function writeResumeSession(sessionId, metadata, sourcePdfBuffer) {
  const paths = sessionPaths(sessionId);
  await fs.mkdir(paths.dir, { recursive: true });
  await fs.writeFile(paths.pdf, sourcePdfBuffer);
  await fs.writeFile(paths.meta, JSON.stringify(metadata, null, 2), "utf-8");
}

async function readResumeSession(sessionId) {
  const paths = sessionPaths(sessionId);
  try {
    const raw = await fs.readFile(paths.meta, "utf-8");
    return JSON.parse(raw);
  } catch {
    throw routeError(404, "Resume session was not found. Re-upload the source PDF.");
  }
}

async function readResumeSessionPdf(sessionId) {
  const paths = sessionPaths(sessionId);
  try {
    return await fs.readFile(paths.pdf);
  } catch {
    throw routeError(404, "Resume session PDF was not found. Re-upload the source PDF.");
  }
}

function decodePdfBase64(value) {
  const rawBase64 = String(value || "")
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s+/g, "");
  if (!rawBase64) throw routeError(400, "sourcePdfBase64 is required.");
  const sourcePdfBuffer = Buffer.from(rawBase64, "base64");
  if (sourcePdfBuffer.length < 5 || sourcePdfBuffer.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw routeError(400, "Original file is not a valid PDF.");
  }
  if (sourcePdfBuffer.length > 15 * 1024 * 1024) {
    throw routeError(413, "Original PDF is too large for local format-preserving export.");
  }
  return sourcePdfBuffer;
}

async function parsePdfFile(pdfPath) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn("python", [pdfParseScript, "--pdf", pdfPath], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(routeError(504, "PDF logical-bullet parsing timed out."));
    }, 90000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(routeError(422, (stderr || stdout || "PDF logical-bullet parsing failed.").trim()));
        return;
      }
      resolve(stdout);
    });
  });
  try {
    return JSON.parse(String(result || "{}"));
  } catch {
    throw routeError(422, "PDF logical-bullet parser returned invalid JSON.");
  }
}

async function parsePdfBuffer(sourcePdfBuffer) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const inputPath = path.join(os.tmpdir(), `resume-parse-source-${stamp}.pdf`);
  await fs.writeFile(inputPath, sourcePdfBuffer);
  try {
    return await parsePdfFile(inputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => undefined);
  }
}

function readDomainProfile(body) {
  const profile = body?.domainProfile && typeof body.domainProfile === "object" ? body.domainProfile : {};
  return {
    id: String(profile.id || "general").slice(0, 40),
    name: String(profile.name || "General Professional").slice(0, 90),
    coreTerms: Array.isArray(profile.coreTerms) ? profile.coreTerms.map(String).slice(0, 30) : [],
    roles: Array.isArray(profile.roles) ? profile.roles.map(String).slice(0, 8) : [],
    categories: Array.isArray(profile.categories) ? profile.categories.map(String).slice(0, 8) : [],
    systems: Array.isArray(profile.systems) ? profile.systems.map(String).slice(0, 5) : [],
    outcomes: Array.isArray(profile.outcomes) ? profile.outcomes.map(String).slice(0, 5) : [],
  };
}

function readTargetingSignals(body) {
  if (!Array.isArray(body?.targetingSignals)) return [];
  return body.targetingSignals.slice(0, 14).map((signal) => ({
    label: String(signal?.label || "").slice(0, 90),
    category: String(signal?.category || "Responsibilities").slice(0, 32),
    status: String(signal?.status || "missing").slice(0, 16),
    terms: Array.isArray(signal?.terms) ? signal.terms.map(String).slice(0, 6) : [],
  }));
}

function readRoleBlueprint(body) {
  const blueprint = body?.roleBlueprint && typeof body.roleBlueprint === "object" ? body.roleBlueprint : {};
  return {
    targetRole: String(blueprint.targetRole || "Target role").slice(0, 120),
    roleThesis: String(blueprint.roleThesis || "").slice(0, 360),
    atsFocus: Array.isArray(blueprint.atsFocus) ? blueprint.atsFocus.map(String).slice(0, 18) : [],
    rewriteStrategy: Array.isArray(blueprint.rewriteStrategy) ? blueprint.rewriteStrategy.map(String).slice(0, 6) : [],
    humanWarnings: Array.isArray(blueprint.humanWarnings) ? blueprint.humanWarnings.map(String).slice(0, 6) : [],
    proofPillars: Array.isArray(blueprint.proofPillars)
      ? blueprint.proofPillars.slice(0, 8).map((pillar) => ({
          label: String(pillar?.label || "Proof pillar").slice(0, 80),
          score: Number(pillar?.score) || 0,
          status: String(pillar?.status || "missing").slice(0, 16),
          jdNeed: String(pillar?.jdNeed || "").slice(0, 220),
          resumeProof: String(pillar?.resumeProof || "").slice(0, 220),
          terms: Array.isArray(pillar?.terms) ? pillar.terms.map(String).slice(0, 6) : [],
        }))
      : [],
  };
}

function readEvidenceGraph(body) {
  const graph = body?.evidenceGraph && typeof body.evidenceGraph === "object" ? body.evidenceGraph : {};
  const sectionTools = graph.sectionTools && typeof graph.sectionTools === "object" ? graph.sectionTools : {};
  const roles = Array.isArray(graph.roles)
    ? graph.roles.slice(0, 20).map((role) => ({
        id: String(role?.id || "").slice(0, 90),
        employer: String(role?.employer || "Employer").slice(0, 120),
        title: String(role?.title || "Role").slice(0, 120),
        dates: String(role?.dates || "").slice(0, 80),
        section: String(role?.section || "").slice(0, 80),
        startLine: Number(role?.startLine) || 0,
        endLine: Number(role?.endLine) || 0,
        allowedTools: Array.isArray(role?.allowedTools) ? role.allowedTools.map(String).slice(0, 40) : [],
        allowedMetrics: Array.isArray(role?.allowedMetrics) ? role.allowedMetrics.map(String).slice(0, 40) : [],
        allowedActions: Array.isArray(role?.allowedActions) ? role.allowedActions.map(String).slice(0, 40) : [],
        allowedObjects: Array.isArray(role?.allowedObjects) ? role.allowedObjects.map(String).slice(0, 30) : [],
        allowedOutcomes: Array.isArray(role?.allowedOutcomes) ? role.allowedOutcomes.map(String).slice(0, 20) : [],
        scopeEvidence: Array.isArray(role?.scopeEvidence) ? role.scopeEvidence.map(String).slice(0, 16) : [],
      }))
    : [];
  return {
    employers: Array.isArray(graph.employers) ? graph.employers.map(String).slice(0, 18) : [],
    dates: Array.isArray(graph.dates) ? graph.dates.map(String).slice(0, 18) : [],
    degrees: Array.isArray(graph.degrees) ? graph.degrees.map(String).slice(0, 12) : [],
    certifications: Array.isArray(graph.certifications) ? graph.certifications.map(String).slice(0, 12) : [],
    toolsMentioned: Array.isArray(graph.toolsMentioned) ? graph.toolsMentioned.map(String).slice(0, 80) : [],
    frameworks: Array.isArray(graph.frameworks) ? graph.frameworks.map(String).slice(0, 40) : [],
    metrics: Array.isArray(graph.metrics) ? graph.metrics.map(String).slice(0, 80) : [],
    actionsTaken: Array.isArray(graph.actionsTaken) ? graph.actionsTaken.map(String).slice(0, 80) : [],
    scope: Array.isArray(graph.scope) ? graph.scope.map(String).slice(0, 40) : [],
    roles,
    sectionTools: Object.fromEntries(
      Object.entries(sectionTools)
        .slice(0, 16)
        .map(([section, tools]) => [String(section).slice(0, 80), Array.isArray(tools) ? tools.map(String).slice(0, 30) : []]),
    ),
  };
}

function targetingSignalText(signals) {
  if (!signals.length) return "none provided";
  return signals
    .map((signal) => `${signal.category} / ${signal.status}: ${signal.label} (${signal.terms.join(", ") || "no terms"})`)
    .join("\n");
}

function roleBlueprintText(blueprint) {
  if (!blueprint.proofPillars.length && !blueprint.atsFocus.length) return "none provided";
  return [
    `Target role: ${blueprint.targetRole}`,
    blueprint.roleThesis ? `Role thesis: ${blueprint.roleThesis}` : "",
    blueprint.proofPillars.length
      ? [
          "Proof pillars:",
          ...blueprint.proofPillars.map(
            (pillar) =>
              `- ${pillar.label} (${pillar.status}, ${pillar.score}): JD needs ${pillar.jdNeed || "not specified"} | Resume proof: ${
                pillar.resumeProof || "none"
              } | Terms: ${pillar.terms.join(", ") || "none"}`,
          ),
        ].join("\n")
      : "",
    blueprint.atsFocus.length ? `ATS focus terms: ${blueprint.atsFocus.join(", ")}` : "",
    blueprint.rewriteStrategy.length ? `Rewrite strategy: ${blueprint.rewriteStrategy.join(" | ")}` : "",
    blueprint.humanWarnings.length ? `Human warnings: ${blueprint.humanWarnings.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function evidenceGraphText(graph) {
  if (!graph.toolsMentioned.length && !graph.frameworks.length && !graph.metrics.length && !graph.actionsTaken.length && !graph.scope.length) return "none provided";
  const roleEvidence = graph.roles.length
    ? [
        "Per-role evidence boundaries:",
        ...graph.roles.map((role) =>
          [
            `- Lines ${role.startLine}-${role.endLine}: ${role.title} at ${role.employer}${role.dates ? ` (${role.dates})` : ""}`,
            role.allowedTools.length ? `  tools: ${role.allowedTools.join(", ")}` : "",
            role.allowedMetrics.length ? `  metrics: ${role.allowedMetrics.join(", ")}` : "",
            role.allowedActions.length ? `  actions: ${role.allowedActions.slice(0, 8).join(" | ")}` : "",
            role.allowedObjects.length ? `  objects/systems: ${role.allowedObjects.join(", ")}` : "",
            role.scopeEvidence.length ? `  scope evidence: ${role.scopeEvidence.slice(0, 4).join(" | ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ].join("\n")
    : "";
  return [
    graph.employers.length ? `Locked employers/role lines: ${graph.employers.join(" | ")}` : "",
    graph.dates.length ? `Locked date ranges: ${graph.dates.join(", ")}` : "",
    graph.degrees.length ? `Locked education facts: ${graph.degrees.join(" | ")}` : "",
    graph.certifications.length ? `Locked certifications: ${graph.certifications.join(", ")}` : "",
    graph.toolsMentioned.length ? `Allowed tools, standards, and systems already present: ${graph.toolsMentioned.join(", ")}` : "",
    graph.frameworks.length ? `Allowed frameworks already present: ${graph.frameworks.join(", ")}` : "",
    graph.metrics.length ? `Allowed numeric claims already present: ${graph.metrics.join(", ")}` : "",
    graph.actionsTaken.length ? `Supported action evidence: ${graph.actionsTaken.join(" | ")}` : "",
    graph.scope.length ? `Supported ownership/scope evidence: ${graph.scope.join(" | ")}` : "",
    roleEvidence,
  ]
    .filter(Boolean)
    .join("\n");
}

function readJdAnchors(body) {
  return Array.isArray(body?.jdAnchors) ? body.jdAnchors.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8) : [];
}

function readGapAnalysis(body) {
  const raw = body?.gapAnalysis && typeof body.gapAnalysis === "object" ? body.gapAnalysis : {};
  return Object.fromEntries(
    Object.entries(raw)
      .slice(0, 12)
      .map(([anchor, value]) => [
        String(anchor).slice(0, 80),
        {
          status: String(value?.status || "missing").slice(0, 16),
          evidence: String(value?.evidence || "").slice(0, 160),
        },
      ]),
  );
}

function gapAnalysisText(jdAnchors, gapAnalysis) {
  if (!jdAnchors.length) return "none provided";
  return jdAnchors
    .map((anchor) => {
      const item = gapAnalysis[anchor] || { status: "missing", evidence: "" };
      return `- ${anchor}: ${item.status}${item.evidence ? ` (${item.evidence})` : ""}`;
    })
    .join("\n");
}

function normalizeLines(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd().split("\n");
}

function normalizeLine(line) {
  return String(line).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeClaim(text) {
  return normalizeLine(text).replace(/[^\w+#./&-]+/g, " ").trim();
}

function safePdfFileName(fileName) {
  const base = path.basename(String(fileName || "rewritten-resume.pdf"))
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${base || "rewritten-resume"}.pdf`;
}

function isProtectedHeading(line) {
  const trimmed = String(line).trim();
  return /^[A-Z][A-Z0-9 /&().,-]{2,}$/.test(trimmed) && trimmed.length <= 42;
}

const actionVerbs = new Set([
  "administered",
  "analyzed",
  "architected",
  "assembled",
  "assessed",
  "audited",
  "automated",
  "built",
  "calibrated",
  "coached",
  "conducted",
  "configured",
  "coordinated",
  "created",
  "delivered",
  "designed",
  "developed",
  "diagnosed",
  "documented",
  "engineered",
  "executed",
  "improved",
  "implemented",
  "inspected",
  "installed",
  "launched",
  "maintained",
  "managed",
  "mapped",
  "modeled",
  "monitored",
  "optimized",
  "planned",
  "prepared",
  "processed",
  "produced",
  "reconciled",
  "reduced",
  "repaired",
  "reported",
  "researched",
  "resolved",
  "reviewed",
  "shipped",
  "standardized",
  "strengthened",
  "supported",
  "taught",
  "tested",
  "trained",
  "validated",
]);

const guardedClaimTerms = [
  "aws",
  "azure",
  "gcp",
  "active directory",
  "cloudtrail",
  "crowdstrike",
  "datadog",
  "defender",
  "docker",
  "eks",
  "github actions",
  "google cloud",
  "iam",
  "iso 27001",
  "jupyter",
  "kibana",
  "kubernetes",
  "lambda",
  "mongo",
  "mongodb",
  "nessus",
  "nmap",
  "okta",
  "pci-dss",
  "playwright",
  "pytest",
  "python",
  "rbac",
  "sigma",
  "soc 2",
  "splunk",
  "sql",
  "stellar",
  "stellar cyber",
  "tableau",
  "terraform",
  "wireshark",
];

const fragmentLeadWords = new Set([
  "and",
  "as",
  "by",
  "for",
  "from",
  "including",
  "into",
  "remediation",
  "telemetry",
  "through",
  "to",
  "using",
  "via",
  "vulnerability",
  "vulnerabilities",
  "with",
  "workflow",
  "workflows",
  "privilege",
  "investigation",
  "indirect",
]);

function cleanResumeLine(line) {
  return String(line).replace(/^(?:\u2022|[-*])\s*/, "").trim();
}

function isLikelyOrphanFragmentLine(line, index) {
  const clean = cleanResumeLine(line);
  if (clean.length < 24) return false;
  const firstWord = clean.split(/\s+/)[0]?.toLowerCase() || "";
  if (!firstWord || actionVerbs.has(firstWord)) return false;
  if (/^(?:\u2022|[-*])\s*/.test(String(line).trim())) return false;
  if (isProtectedHeading(line) || isFixedFactLine(line, index)) return false;
  if (clean.includes("|")) return false;
  if (/^[A-Z][A-Za-z0-9 .,&'()/-]{2,90}$/.test(clean) && !/[.;:]$/.test(clean)) return false;
  const startsLower = /^[a-z]/.test(clean);
  const startsDangling = fragmentLeadWords.has(firstWord);
  const hasDanglingPunctuation = /;\s*[a-z]/.test(clean) || /,\s*(and|or|with|for|into|using)\b/i.test(clean);
  const lacksSentenceSubject = !/\b(engineered|built|developed|implemented|automated|designed|validated|investigated|managed|created|reduced|improved|delivered|documented|trained)\b/i.test(clean);
  return startsDangling || (startsLower && (hasDanglingPunctuation || lacksSentenceSubject));
}

function isLikelyContinuationLine(lines, index) {
  const line = cleanResumeLine(lines[index] || "");
  if (!line || index <= 0 || /^(?:\u2022|[-*])\s*/.test(String(lines[index] || "").trim())) return false;
  let previous = "";
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    previous = cleanResumeLine(lines[cursor] || "");
    if (previous) break;
  }
  if (!previous) return false;
  const firstWord = line.split(/\s+/)[0]?.toLowerCase() || "";
  const previousOpen = !/[.!?]$/.test(previous.trim());
  const previousOpenList = /[:;,]\s*[^.!?]*$/.test(previous) || /\b(?:and|or|with|using|via|through|across|into|for|by|to)$/i.test(previous.trim());
  const startsLower = /^[a-z]/.test(line);
  const startsDangling = fragmentLeadWords.has(firstWord);
  const shortTail = line.length < 70 && /[.!?]$/.test(line) && !actionVerbs.has(firstWord);
  return startsLower || startsDangling || shortTail || (previousOpen && previousOpenList);
}

function isFixedFactLine(line, index) {
  const trimmed = String(line).trim();
  return (
    index === 0 ||
    /@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(trimmed) ||
    /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/.test(trimmed) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:present|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b/i.test(trimmed) ||
    /\b(?:bachelor|master|ph\.?d|university|college|school|degree|gpa|cgpa|certification|certified)\b/i.test(trimmed) ||
    /^[A-Z][A-Za-z0-9 .,&'()/-]{2,80}\s*\|\s*[A-Za-z .,-]{2,80}$/.test(trimmed)
  );
}

function isSummarySection(section) {
  return /^SUMMARY$/i.test(section);
}

function isExperienceSection(section) {
  return /^(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE)$/i.test(section);
}

function isProjectSection(section) {
  return /^(PROJECTS|PROJECT EXPERIENCE)$/i.test(section);
}

function isEditableBulletSection(section) {
  return isExperienceSection(section) || isProjectSection(section);
}

function isKnownSectionHeading(line) {
  return /^(SUMMARY|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|PROJECTS|PROJECT EXPERIENCE|SKILLS|TECHNICAL SKILLS|EDUCATION|CERTIFICATIONS|CONTACT|AWARDS|ACTIVITIES)$/i.test(
    String(line).trim(),
  );
}

function startsNewImpactLine(line) {
  const clean = cleanResumeLine(line);
  const first = clean.split(/\s+/)[0]?.toLowerCase() || "";
  return /^(?:\u2022|[-*])\s*/.test(String(line).trim()) || actionVerbs.has(first);
}

function isProjectTitleLine(line) {
  const clean = cleanResumeLine(line);
  const first = clean.split(/\s+/)[0]?.toLowerCase() || "";
  if (!clean || startsNewImpactLine(line)) return false;
  if (clean.length > 130) return false;
  if (/[.!?]$/.test(clean)) return false;
  if (actionVerbs.has(first)) return false;
  return /^[A-Z0-9][A-Za-z0-9 .,&'()/:+#-]{4,}$/.test(clean);
}

function logicalSegmentTextFromLines(lines) {
  return lines
    .map((line) => cleanResumeLine(line))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeLogicalSegment(kind, section, lineIndexes, lines) {
  const oldLines = lineIndexes.map((index) => String(lines[index] || "").trim());
  const text = logicalSegmentTextFromLines(oldLines);
  const prefix = oldLines[0]?.match(/^(\s*(?:\u2022|[-*])\s*)/)?.[1] || "";
  const lineBudgets = oldLines.map((line, index) => {
    const trimmed = line.trimEnd();
    const prefixLength = index === 0 ? prefix.length : 0;
    return Math.max(18, trimmed.length - prefixLength + 2);
  });
  return {
    kind,
    section,
    startLine: lineIndexes[0] + 1,
    endLine: lineIndexes[lineIndexes.length - 1] + 1,
    lineIndexes,
    lineCount: lineIndexes.length,
    visualLineCount: lineIndexes.length,
    oldLines,
    text,
    prefix,
    lineBudgets,
    charBudget: Math.max(18, Math.floor(text.length * 1.05)),
  };
}

function parseLogicalEditableSegments(lines) {
  const segments = [];
  let currentSection = "";
  let current = null;
  let summary = null;

  const closeCurrent = () => {
    if (current?.lineIndexes?.length) {
      segments.push(makeLogicalSegment("bullet", current.section, current.lineIndexes, lines));
    }
    current = null;
  };
  const closeSummary = () => {
    if (summary?.lineIndexes?.length) {
      segments.push(makeLogicalSegment("summary", "SUMMARY", summary.lineIndexes, lines));
    }
    summary = null;
  };

  lines.forEach((rawLine, index) => {
    const trimmed = String(rawLine || "").trim();
    const upper = trimmed.toUpperCase();

    if (!trimmed) {
      closeCurrent();
      closeSummary();
      return;
    }

    if (isKnownSectionHeading(trimmed)) {
      closeCurrent();
      closeSummary();
      currentSection = upper;
      return;
    }
    if (isProtectedHeading(trimmed)) {
      closeCurrent();
      closeSummary();
      return;
    }

    if (isSummarySection(currentSection)) {
      closeCurrent();
      if (trimmed.length > 35 && !isFixedFactLine(trimmed, index)) {
        if (!summary) summary = { lineIndexes: [] };
        summary.lineIndexes.push(index);
      }
      return;
    }

    closeSummary();
    if (!isEditableBulletSection(currentSection)) {
      closeCurrent();
      return;
    }

    if (isProjectSection(currentSection) && isProjectTitleLine(trimmed)) {
      closeCurrent();
      return;
    }

    const startsNew = startsNewImpactLine(trimmed);
    const continuesCurrent = current && isLikelyContinuationLine(lines, index);

    if (continuesCurrent) {
      current.lineIndexes.push(index);
      return;
    }

    if (startsNew) {
      closeCurrent();
      current = { section: currentSection, lineIndexes: [index] };
      return;
    }

    if (current && isLikelyOrphanFragmentLine(trimmed, index)) {
      current.lineIndexes.push(index);
      return;
    }

    closeCurrent();
  });

  closeCurrent();
  closeSummary();

  return segments.filter((segment) => segment.text.length > 20);
}

const workflowStopWords = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "but",
  "for",
  "from",
  "has",
  "have",
  "into",
  "our",
  "that",
  "the",
  "their",
  "this",
  "through",
  "using",
  "with",
  "your",
]);

const workflowToolDictionary = [
  ...guardedClaimTerms,
  "antivirus",
  "azure ad",
  "burp suite",
  "cloudtrail",
  "crowdstrike falcon",
  "cyberark",
  "database activity monitoring",
  "dlp",
  "edr",
  "endpoint protection",
  "eventbridge",
  "github",
  "guardduty",
  "hashicorp vault",
  "ids/ips",
  "kms",
  "microsoft defender",
  "nmap",
  "owasp",
  "s3",
  "secrets manager",
  "servicenow",
  "sts",
  "waf",
];

const workflowFrameworkPatterns = [
  [/\bSOC\s*2\b/i, "SOC 2"],
  [/\bISO\s*27001\b/i, "ISO 27001"],
  [/\bNIST\b/i, "NIST"],
  [/\bPCI[-\s]?DSS\b/i, "PCI-DSS"],
  [/\bGDPR\b/i, "GDPR"],
  [/\bHIPAA\b/i, "HIPAA"],
  [/\bFedRAMP\b/i, "FedRAMP"],
  [/\bNYDFS\b/i, "NYDFS"],
  [/\bOWASP\b/i, "OWASP"],
  [/\bMITRE\s+ATT&CK\b/i, "MITRE ATT&CK"],
];

const atsSectionAlternatives = [
  ["experience", "professional experience", "work experience", "employment", "work history"],
  ["education", "academic background", "academic"],
  ["skills", "technical skills", "core competencies", "competencies"],
];

const acronymExclusions = new Set(["AND", "OR", "FOR", "THE", "WITH", "USA", "CEO", "CTO", "VP"]);
const roleKeywords = [
  "engineer",
  "analyst",
  "manager",
  "designer",
  "developer",
  "architect",
  "specialist",
  "coordinator",
  "director",
  "lead",
  "officer",
  "consultant",
  "associate",
  "scientist",
  "researcher",
  "technician",
  "administrator",
];

function textContainsTerm(text, term) {
  const normalizedText = normalizeClaim(text);
  const normalizedTerm = normalizeClaim(term);
  if (!normalizedText || !normalizedTerm) return false;
  return new RegExp(`(^| )${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($| )`, "i").test(normalizedText);
}

function countTermHits(text, term) {
  const normalizedText = normalizeClaim(text);
  const normalizedTerm = normalizeClaim(term);
  if (!normalizedText || !normalizedTerm) return 0;
  return normalizedText.match(new RegExp(`(^| )${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($| )`, "gi"))?.length ?? 0;
}

function logicalBulletsFromText(resumeText) {
  return parseLogicalEditableSegments(normalizeLines(resumeText)).map((segment) => ({
    page_num: 0,
    section: segment.section,
    text: segment.text,
    bbox: null,
    visual_line_count: segment.lineCount,
    visual_lines: segment.oldLines.map((text, index) => ({ text, page_num: 0, line: segment.startLine + index })),
    font_info: null,
    startLine: segment.startLine,
    endLine: segment.endLine,
  }));
}

function extractLockedWorkflowFacts(resumeText) {
  const lines = normalizeLines(resumeText).map((line) => line.trim()).filter(Boolean);
  return {
    employers: lines
      .filter((line) => /\b(?:engineer|analyst|manager|developer|specialist|intern|consultant|coordinator)\b/i.test(line) && /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})\b/i.test(line))
      .slice(0, 18),
    dates: Array.from(
      resumeText.matchAll(
        /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{2}\/\d{4}|\d{4})\s*[-â€“]\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{2}\/\d{4}|\d{4})\b/gi,
      ),
    )
      .map((match) => match[0])
      .slice(0, 18),
    degrees: lines.filter((line) => /\b(?:bachelor|master|ph\.?d|degree|university|college)\b/i.test(line)).slice(0, 12),
    certifications: lines.filter((line) => /\b(?:certified|certification|security\+|network\+|cysa\+|ccna)\b/i.test(line)).slice(0, 12),
  };
}

function buildWorkflowEvidenceGraph(logicalBullets, resumeText) {
  const tools = new Set();
  const frameworks = new Set();
  const metrics = [];
  const actions = [];
  const scope = [];
  const scopeKeywords = {
    owned: "owned",
    led: "led",
    drove: "led",
    managed: "managed",
    contributed: "contributed",
    supported: "supported",
    assisted: "supported",
    helped: "supported",
  };

  for (const bullet of logicalBullets) {
    const text = String(bullet.text || "");
    for (const tool of workflowToolDictionary) {
      if (textContainsTerm(text, tool)) tools.add(tool);
    }
    for (const [pattern, canonical] of workflowFrameworkPatterns) {
      if (pattern.test(text)) frameworks.add(canonical);
    }
    for (const match of text.matchAll(/\b\d+(?:\.\d+)?[%xK+]?\b/gi)) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      metrics.push(text.slice(start, end).trim());
    }
    const words = cleanResumeLine(text).split(/\s+/).filter(Boolean);
    if (words.length) {
      const verb = words[0].toLowerCase().replace(/[^a-z]/g, "");
      if (actionVerbs.has(verb)) actions.push(`${verb} ${words.slice(1, 8).join(" ")}`.trim());
    }
    const lower = text.toLowerCase();
    for (const [keyword, level] of Object.entries(scopeKeywords)) {
      if (lower.includes(keyword)) scope.push(`${level}: ${text.slice(0, 80)}`);
    }
  }

  const locked = extractLockedWorkflowFacts(resumeText);
  return {
    employers: locked.employers,
    dates: locked.dates,
    degrees: locked.degrees,
    certifications: locked.certifications,
    toolsMentioned: Array.from(tools).slice(0, 80),
    frameworks: Array.from(frameworks).slice(0, 40),
    metrics: Array.from(new Set(metrics)).slice(0, 80),
    actionsTaken: Array.from(new Set(actions)).slice(0, 80),
    scope: Array.from(new Set(scope)).slice(0, 40),
    roles: [],
    sectionTools: {},
  };
}

function checkWorkflowSectionHeaders(resumeText) {
  const lower = resumeText.toLowerCase();
  const missing = [];
  for (const alternatives of atsSectionAlternatives) {
    if (!alternatives.some((alt) => lower.includes(alt))) missing.push(alternatives[0]);
  }
  return {
    key: "sections",
    label: "Standard Section Headers",
    passed: missing.length === 0,
    detail: missing.length ? `Missing standard sections: ${missing.join(", ")}.` : "Experience, Education, and Skills headers are parseable.",
    missing,
  };
}

function checkWorkflowContactInfo(resumeText) {
  const emailOk = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(resumeText);
  const phoneOk = /\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(resumeText);
  return {
    key: "contact",
    label: "Contact Info Parseable",
    passed: emailOk && phoneOk,
    detail: emailOk && phoneOk ? "Email and phone match standard ATS regex patterns." : `${emailOk ? "" : "Email missing. "}${phoneOk ? "" : "Phone missing."}`.trim(),
    missing: [emailOk ? "" : "email", phoneOk ? "" : "phone"].filter(Boolean),
  };
}

function detectWorkflowDateFormats(resumeText) {
  const formats = new Set();
  const monthRange = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-â€“â€”]\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi;
  const slashRange = /\b\d{2}\/\d{4}\s*[-â€“â€”]\s*(?:Present|Current|\d{2}\/\d{4})\b/gi;
  if (monthRange.test(resumeText)) {
    formats.add("Mon YYYY - Mon YYYY");
  }
  if (slashRange.test(resumeText)) formats.add("MM/YYYY - MM/YYYY");
  const scrubbed = resumeText.replace(monthRange, " ").replace(slashRange, " ");
  if (/(?<![A-Za-z]\s)\b(?:19|20)\d{2}\s*[-â€“â€”]\s*(?:Present|Current|(?:19|20)\d{2})\b/i.test(scrubbed)) formats.add("YYYY - YYYY");
  return Array.from(formats);
}

function checkWorkflowDateConsistency(resumeText) {
  const formats = detectWorkflowDateFormats(resumeText);
  return {
    key: "dates",
    label: "Date Format Consistency",
    passed: formats.length === 1,
    detail:
      formats.length === 1
        ? `One ATS date format detected: ${formats[0]}.`
        : formats.length
          ? `Mixed date formats detected: ${formats.join(", ")}. Pick one format and use it everywhere.`
          : "No standard ATS date ranges detected.",
    missing: formats.length === 1 ? [] : ["consistent date ranges"],
  };
}

function workflowOrphanFragments(resumeText) {
  return normalizeLines(resumeText)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^[,;]/.test(line)) return true;
      if (/^[.,;:!?-]+$/.test(line)) return true;
      return line.length < 80 && /^[a-z]/.test(line) && /[.!?]$/.test(line);
    });
}

function checkWorkflowFormatCompliance(resumeText) {
  const specialChars = (resumeText.match(/[^\w\s.,;:!?@%+\-/&()|]/g) || []).length;
  const density = specialChars / Math.max(1, resumeText.length);
  const orphans = workflowOrphanFragments(resumeText);
  const barePunctuation = normalizeLines(resumeText).filter((line) => /^[,;]/.test(line.trim()));
  const failures = [
    resumeText.length >= 500 ? "" : "resume text under 500 characters",
    density < 0.2 ? "" : `special character density ${Math.round(density * 100)}%`,
    orphans.length <= 2 ? "" : `${orphans.length} orphan fragments`,
    barePunctuation.length === 0 ? "" : `${barePunctuation.length} bare punctuation starts`,
  ].filter(Boolean);
  return {
    key: "format",
    label: "Format Compliance",
    passed: failures.length === 0,
    detail: failures.length ? failures.join("; ") : "Text length, character density, orphan fragments, and punctuation starts are ATS-safe.",
    missing: failures,
  };
}

function requiredQualificationText(jdText) {
  const lines = normalizeLines(jdText);
  const start = lines.findIndex((line) => /\b(requirements?|qualifications?|what we're looking for|preferred qualifications?)\b/i.test(line));
  if (start < 0) return jdText;
  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /\b(responsibilities|benefits|about|why|compensation|equal opportunity|nice to have|bonus)\b/i.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start, end).join("\n");
}

function extractWorkflowAnchors(jdText, max = 8) {
  const scores = new Map();
  const requiredText = requiredQualificationText(jdText);
  const bump = (term, score) => {
    const clean = normalizeClaim(term);
    if (!clean || clean.length < 2 || workflowStopWords.has(clean)) return;
    scores.set(clean, (scores.get(clean) || 0) + score);
  };

  for (const tool of workflowToolDictionary) {
    const count = countTermHits(jdText, tool);
    if (count) bump(tool, count * 3 + (requiredText.toLowerCase().includes(tool.toLowerCase()) ? 5 : 0));
  }
  const acronymCounts = new Map();
  for (const match of jdText.match(/\b[A-Z][A-Z0-9&/+.-]{1,}\b/g) || []) {
    const clean = match.replace(/[./-]+$/g, "");
    if (clean.length >= 2 && !acronymExclusions.has(clean)) acronymCounts.set(clean, (acronymCounts.get(clean) || 0) + 1);
  }
  for (const [acronym, count] of acronymCounts.entries()) {
    if (count >= 2) bump(acronym, count * 2 + (requiredText.includes(acronym) ? 3 : 0));
  }
  for (const [pattern, canonical] of workflowFrameworkPatterns) {
    if (pattern.test(jdText)) bump(canonical, 5);
  }
  for (const match of requiredText.match(/\b[a-zA-Z][a-zA-Z/+.-]+(?:\s+[a-zA-Z][a-zA-Z/+.-]+){1,3}\b/g) || []) {
    const phrase = match.trim();
    const words = normalizeClaim(phrase).split(" ").filter((word) => word.length > 2 && !workflowStopWords.has(word));
    if (phrase.length >= 8 && phrase.length <= 40 && words.length >= 2) bump(phrase, 1 + 0.3 * words.length);
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).map(([term]) => term);
  const deduped = [];
  for (const term of ranked) {
    if (deduped.some((existing) => existing.includes(term) || term.includes(existing))) continue;
    deduped.push(term);
    if (deduped.length >= max) break;
  }
  return deduped;
}

function checkWorkflowAnchorCoverage(resumeText, anchors) {
  const matched = anchors.filter((anchor) => textContainsTerm(resumeText, anchor));
  const coverage = anchors.length ? matched.length / anchors.length : 1;
  return {
    key: "anchors",
    label: "Anchor Coverage",
    passed: coverage >= 0.7,
    detail: `${matched.length}/${anchors.length || 1} distinctive JD anchors matched.`,
    missing: anchors.filter((anchor) => !matched.includes(anchor)),
    matched,
    score: Math.round(coverage * 100),
  };
}

function firstLikelyRoleLine(text) {
  return normalizeLines(text).find((line) => roleKeywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(line))) || "";
}

function checkWorkflowRoleCompatibility(resumeText, jdText) {
  const resumeRole = firstLikelyRoleLine(resumeText);
  const jdRole = firstLikelyRoleLine(jdText);
  const resumeKeywords = roleKeywords.filter((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(resumeRole));
  const jdKeywords = roleKeywords.filter((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(jdRole));
  const passed = !jdKeywords.length || !resumeKeywords.length || jdKeywords.some((keyword) => resumeKeywords.includes(keyword));
  return {
    key: "role",
    label: "Role Title Compatibility",
    passed,
    detail: passed ? `Header role "${resumeRole || "not found"}" is compatible with JD title "${jdRole || "not found"}".` : `Resume role "${resumeRole}" does not match JD title "${jdRole}".`,
    missing: passed ? [] : jdKeywords,
    resumeRole,
    jdRole,
  };
}

function runWorkflowAtsChecklist(resumeText, jdText, anchors) {
  const anchorCheck = checkWorkflowAnchorCoverage(resumeText, anchors);
  const roleCheck = checkWorkflowRoleCompatibility(resumeText, jdText);
  const checks = [
    checkWorkflowSectionHeaders(resumeText),
    checkWorkflowContactInfo(resumeText),
    checkWorkflowDateConsistency(resumeText),
    checkWorkflowFormatCompliance(resumeText),
    anchorCheck,
    roleCheck,
  ];
  return {
    passed: checks.every((check) => check.passed),
    checks,
    anchors,
    matchedAnchors: anchorCheck.matched,
    missingAnchors: anchorCheck.missing,
    anchorCoverageScore: anchorCheck.score,
    dateFormats: detectWorkflowDateFormats(resumeText),
    resumeHeaderRole: roleCheck.resumeRole,
    jdRoleTitle: roleCheck.jdRole,
  };
}

function scoreRatio(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function workflowHumanReadability(logicalBullets, resumeText, anchors) {
  const bullets = logicalBullets.map((bullet) => String(bullet.text || "")).filter(Boolean);
  const diagnostics = [];
  const hasEvidence = (bullet) => workflowToolDictionary.some((tool) => textContainsTerm(bullet, tool)) || /\b\d+(?:\.\d+)?%?\+?\b/.test(bullet);
  const hasVerb = (bullet) => {
    const first = cleanResumeLine(bullet).split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
    return actionVerbs.has(first) || /\b(?:built|led|owned|created|improved|reduced|managed|supported|documented|validated)\b/i.test(bullet);
  };
  const coherenceIssues = bullets.filter((bullet) => !hasVerb(bullet) || !/[.!?]$/.test(bullet.trim())).length;
  if (coherenceIssues) diagnostics.push(`${coherenceIssues} bullets lack a clear action verb or terminal punctuation.`);

  const metrics = bullets.flatMap((bullet) => bullet.match(/\b\d+(?:\.\d+)?%?\+?\b/g) || []).filter((value) => !/^(?:19|20)\d{2}$/.test(value));
  const roundMetrics = metrics.filter((metric) => Number(metric.replace(/[%+]/g, "")) % 5 === 0);
  const metricScore = metrics.length >= 3 && roundMetrics.length / metrics.length > 0.8 ? 75 : 100;
  if (metricScore < 100) diagnostics.push(`${roundMetrics.length}/${metrics.length} metrics are round multiples of 5.`);

  const specificity = scoreRatio(bullets.filter((bullet) => hasEvidence(bullet) || /\b(?:coverage|mttr|sla|false positives?|triage|handoff|downtime|latency)\b/i.test(bullet)).length, bullets.length);
  if (specificity < 100) diagnostics.push(`${bullets.length - Math.round((specificity / 100) * bullets.length)}/${bullets.length} bullets lack a named tool, number, or outcome.`);

  const wordCount = resumeText.split(/\s+/).filter(Boolean).length || 1;
  const anchorHits = anchors.reduce((sum, anchor) => sum + countTermHits(resumeText, anchor), 0);
  const stuffingPatterns = [
    anchors.length && anchorHits / wordCount > 1 / 12,
    (resumeText.match(/\bacross \d+ (?:workstreams|deliverables|items|review paths|signal sources|control areas|data sources|workflows)\b/gi) || []).length >= 3,
    /AWS IAM, Kubernetes, identity telemetry, CI checks, and risk dashboards/i.test(resumeText),
  ].filter(Boolean).length;
  const antiStuffing = Math.max(0, 100 - stuffingPatterns * 15);
  if (stuffingPatterns) diagnostics.push(`${stuffingPatterns} keyword-stuffing patterns detected.`);

  const evidence = scoreRatio(bullets.filter(hasEvidence).length, bullets.length);
  const orphans = workflowOrphanFragments(resumeText);
  const orphanScore = Math.max(0, 100 - orphans.length * 25);
  if (orphans.length) diagnostics.push(`${orphans.length} orphan or fragmentary visual lines detected.`);

  const coherence = Math.max(0, 100 - coherenceIssues * 10);
  const total = Math.round(coherence * 0.3 + specificity * 0.2 + antiStuffing * 0.2 + evidence * 0.15 + metricScore * 0.1 + orphanScore * 0.05);
  return {
    total,
    band: total < 75 ? "risk" : total < 85 ? "acceptable" : "strong",
    subscores: {
      coherence,
      specificity,
      anti_stuffing: antiStuffing,
      evidence,
      metrics: metricScore,
      orphans: orphanScore,
    },
    diagnostics: total >= 85 ? [] : diagnostics.slice(0, total < 75 ? 8 : 2),
  };
}

function classifyWorkflowAnchor(anchor, evidenceGraph, resumeText) {
  if (textContainsTerm(resumeText, anchor)) return { status: "covered", evidence: anchor };
  const words = normalizeClaim(anchor).split(" ").filter((word) => word.length > 2 && !workflowStopWords.has(word));
  const evidenceText = [
    ...(evidenceGraph.toolsMentioned || []),
    ...(evidenceGraph.frameworks || []),
    ...(evidenceGraph.actionsTaken || []),
    ...(evidenceGraph.metrics || []),
  ].join(" ");
  const overlap = words.filter((word) => textContainsTerm(evidenceText, word));
  if (overlap.length) return { status: "partial", evidence: overlap.join(", ") };
  return { status: "missing", evidence: "" };
}

function editableResumeLines(lines) {
  const editable = new Set();
  for (const segment of parseLogicalEditableSegments(lines)) {
    for (const index of segment.lineIndexes) editable.add(index);
  }

  return editable;
}

function numberedResumeLines(text) {
  return normalizeLines(text)
    .map((line, index) => `${index + 1}: ${line.trim() ? line : "[BLANK]"}`)
    .join("\n");
}

function containsClaimTerm(text, term) {
  const normalizedText = normalizeClaim(text);
  const normalizedTerm = normalizeClaim(term);
  if (!normalizedText || !normalizedTerm) return false;
  return new RegExp(`(^| )${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($| )`, "i").test(normalizedText);
}

function extractGuardedTerms(text) {
  return guardedClaimTerms.filter((term) => containsClaimTerm(text, term));
}

function extractNumericClaims(text) {
  const matches =
    String(text).match(
      /\b\d+(?:\.\d+)?%?\+?(?:\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|years?|alerts?|cases?|tickets?|findings?|checks?|workflows?|pipelines?|rules?|detections?|sources?|dashboards?|queries?|users?|requests?|incidents?|events?|controls?|reviews?))?/gi,
    ) || [];
  return matches.map((match) => normalizeClaim(match)).filter(Boolean);
}

function metricMatchesAllowed(metric, allowedMetrics) {
  const normalizedMetric = normalizeClaim(metric);
  if (!normalizedMetric) return false;
  if (allowedMetrics.has(normalizedMetric)) return true;
  const number = normalizedMetric.match(/\d+(?:\.\d+)?%?\+?/)?.[0];
  if (!number) return false;
  const metricWords = normalizedMetric
    .replace(number, "")
    .split(" ")
    .filter((word) => word.length > 2);
  for (const allowed of allowedMetrics) {
    if (!allowed.includes(number)) continue;
    const allowedWords = allowed
      .replace(number, "")
      .split(" ")
      .filter((word) => word.length > 2);
    if (!metricWords.length || metricWords.some((word) => allowedWords.includes(word)) || allowedWords.some((word) => metricWords.includes(word))) {
      return true;
    }
  }
  return false;
}

function roleEvidenceForLine(evidenceGraph, lineNumber) {
  const role = (evidenceGraph.roles || []).find((item) => {
    const start = Number(item.startLine) || 0;
    const end = Number(item.endLine) || 0;
    return start && end && lineNumber >= start && lineNumber <= end;
  });
  if (role) return role;
  return {
    allowedTools: evidenceGraph.toolsMentioned || [],
    allowedMetrics: evidenceGraph.metrics || [],
    allowedActions: evidenceGraph.actionsTaken || [],
    allowedObjects: [],
    allowedOutcomes: [],
    scopeEvidence: evidenceGraph.scope || [],
  };
}

function unsupportedScopeClaims(originalLine, nextLine, roleEvidence) {
  const highScopeTerms = ["owned", "ownership", "led", "managed", "directed", "architected", "strategy", "strategic", "first security"];
  const originalScope = normalizeClaim([originalLine, ...(roleEvidence.scopeEvidence || [])].join(" "));
  const nextScope = normalizeClaim(nextLine);
  const added = highScopeTerms.filter((term) => containsClaimTerm(nextScope, term) && !containsClaimTerm(originalLine, term));
  return added.filter((term) => {
    if (containsClaimTerm(originalScope, term)) return false;
    if (term === "architected" && /\b(?:built|designed|engineered|implemented|end to end|end-to-end|from scratch)\b/i.test(originalScope)) return false;
    if ((term === "owned" || term === "ownership") && /\b(?:owned|primary|end to end|end-to-end|from scratch|delivered|shipped)\b/i.test(originalScope)) return false;
    if ((term === "led" || term === "managed" || term === "directed") && /\b(?:led|managed|directed|coordinated|trained|mentored)\b/i.test(originalScope)) return false;
    if ((term === "strategy" || term === "strategic") && /\b(?:strategy|best practices|policy|roadmap|program|designed)\b/i.test(originalScope)) return false;
    return true;
  });
}

function unsupportedClaimReasons(originalLine, nextLine, evidenceGraph, lineNumber) {
  const reasons = [];
  const roleEvidence = roleEvidenceForLine(evidenceGraph, lineNumber);
  const graphTools = new Set(
    [
      ...(roleEvidence.allowedTools || []),
      ...(lineNumber ? [] : evidenceGraph.toolsMentioned || []),
      ...(lineNumber ? [] : evidenceGraph.frameworks || []),
    ]
      .map(normalizeClaim)
      .filter(Boolean),
  );
  const originalTools = new Set(extractGuardedTerms(originalLine).map(normalizeClaim));
  const addedTools = extractGuardedTerms(nextLine).filter((term) => {
    const normalizedTerm = normalizeClaim(term);
    return !originalTools.has(normalizedTerm) && !graphTools.has(normalizedTerm);
  });
  if (addedTools.length) {
    reasons.push(`unsupported tools: ${addedTools.join(", ")}`);
  }

  const graphMetrics = new Set([...(roleEvidence.allowedMetrics || []), ...(lineNumber ? [] : evidenceGraph.metrics || [])].map(normalizeClaim).filter(Boolean));
  const originalMetrics = new Set(extractNumericClaims(originalLine));
  const addedMetrics = extractNumericClaims(nextLine).filter((metric) => !originalMetrics.has(metric) && !metricMatchesAllowed(metric, graphMetrics));
  if (addedMetrics.length) {
    reasons.push(`unsupported metrics: ${addedMetrics.slice(0, 4).join(", ")}`);
  }

  const scopeOverclaims = unsupportedScopeClaims(originalLine, nextLine, roleEvidence);
  if (scopeOverclaims.length) {
    reasons.push(`unsupported seniority/scope claims: ${scopeOverclaims.join(", ")}`);
  }

  const guardedDensity = extractGuardedTerms(nextLine).length;
  const wordCount = String(nextLine).split(/\s+/).filter(Boolean).length || 1;
  if (guardedDensity >= 5 || guardedDensity / wordCount > 0.22) {
    reasons.push("tool density looks like keyword stuffing");
  }

  return reasons;
}

function rewriteQualityReasons(text) {
  const reasons = [];
  const normalized = normalizeClaim(text);
  const words = String(text).split(/\s+/).filter(Boolean);
  const guardedDensity = extractGuardedTerms(text).length;
  const badPatterns = [
    /security strategy designed/i,
    /collaboration operating rhythm/i,
    /connect(?:ing)? a specific system/i,
    /AWS IAM, Kubernetes, identity telemetry, CI checks, and risk dashboards/i,
    /across \d+ (?:workstreams|deliverables|items|review paths|signal sources)\b/i,
    /(?:applying|using)\s+mercor\b/i,
  ];
  if (badPatterns.some((pattern) => pattern.test(text))) reasons.push("AI-style template or copied JD fragment");
  if (guardedDensity >= 4 && guardedDensity / Math.max(1, words.length) > 0.16) reasons.push("keyword density is too high");
  if (/\b(?:accelerate|replaces|replacing)\s+\w+/i.test(normalized)) reasons.push("copied outcome phrase is not natural resume language");
  return reasons;
}

function wrapReplacementToSegment(segment, replacementText) {
  const cleanReplacement = cleanResumeLine(replacementText).replace(/\s+/g, " ").trim();
  if (!cleanReplacement || cleanReplacement.length > segment.charBudget) return null;
  if (segment.lineCount === 1) {
    const oneLine = `${segment.prefix}${cleanReplacement}`;
    return oneLine.length <= segment.oldLines[0].length + 3 ? [oneLine] : null;
  }

  const words = cleanReplacement.split(/\s+/).filter(Boolean);
  if (words.length < segment.lineCount) return null;

  const lines = [];
  let cursor = 0;
  for (let lineIndex = 0; lineIndex < segment.lineCount; lineIndex += 1) {
    const prefix = lineIndex === 0 ? segment.prefix : "";
    const budget = Math.max(12, segment.lineBudgets[lineIndex] - prefix.length);
    const remainingLines = segment.lineCount - lineIndex - 1;
    const chunk = [];
    while (cursor < words.length) {
      const candidate = [...chunk, words[cursor]].join(" ");
      const remainingWordsAfterThis = words.length - cursor - 1;
      if (candidate.length > budget && chunk.length) break;
      if (remainingWordsAfterThis < remainingLines && chunk.length) break;
      if (candidate.length > budget) return null;
      chunk.push(words[cursor]);
      cursor += 1;
      if (remainingWordsAfterThis === remainingLines) break;
    }
    if (!chunk.length) return null;
    lines.push(`${prefix}${chunk.join(" ")}`);
  }

  if (cursor < words.length) return null;
  return lines.every((line, index) => line.trim().length && line.length <= segment.oldLines[index].length + 4) ? lines : null;
}

function scaledSegmentBudget(segment, budgetScale = 1) {
  return Math.max(18, Math.floor((Number(segment.charBudget) || 18) * budgetScale));
}

function logicalSegmentListText(segments, budgetScale = 1) {
  if (!segments.length) return "none";
  return segments
    .map((segment) => {
      const range = segment.startLine === segment.endLine ? `${segment.startLine}` : `${segment.startLine}-${segment.endLine}`;
      return `- startLine ${segment.startLine}, lines ${range}, section ${segment.section}, kind ${segment.kind}, maxChars ${scaledSegmentBudget(segment, budgetScale)}, visualLineCount ${segment.visualLineCount}: ${segment.text}`;
    })
    .join("\n");
}

function applyModelReplacements(resumeText, modelReplacements, evidenceGraph = readEvidenceGraph({}), options = {}) {
  const lines = normalizeLines(resumeText);
  const segments = parseLogicalEditableSegments(lines);
  const segmentsByStartLine = new Map(segments.map((segment) => [segment.startLine, segment]));
  const allowedStartLines = options.allowedStartLines instanceof Set ? options.allowedStartLines : null;
  const budgetScale = Number(options.budgetScale) || 1;
  const changes = [];
  const acceptedLines = [];
  const failedLines = [];
  const seen = new Set();

  for (const item of Array.isArray(modelReplacements) ? modelReplacements.slice(0, 30) : []) {
    const lineNumber = Number(item.line);
    const nextLine = String(item.text || "")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!Number.isInteger(lineNumber) || seen.has(lineNumber)) continue;
    if (allowedStartLines && !allowedStartLines.has(lineNumber)) continue;
    const segment = segmentsByStartLine.get(lineNumber);
    if (!segment || !nextLine) continue;
    if (nextLine === segment.text) continue;
    const charBudget = scaledSegmentBudget(segment, budgetScale);
    if (nextLine.length > charBudget) {
      const reason = `exceeded the ${charBudget}-character PDF budget`;
      changes.push(`Skipped logical bullet starting line ${lineNumber} because it ${reason}.`);
      failedLines.push({ line: lineNumber, reason });
      continue;
    }
    const unsupportedReasons = unsupportedClaimReasons(segment.text, nextLine, evidenceGraph, lineNumber);
    if (unsupportedReasons.length) {
      const reason = `introduced ${unsupportedReasons.join("; ")}`;
      changes.push(`Skipped logical bullet starting line ${lineNumber} because it ${reason}.`);
      failedLines.push({ line: lineNumber, reason });
      continue;
    }
    const qualityReasons = rewriteQualityReasons(nextLine);
    if (qualityReasons.length) {
      const reason = qualityReasons.join("; ");
      changes.push(`Skipped logical bullet starting line ${lineNumber} because ${reason}.`);
      failedLines.push({ line: lineNumber, reason });
      continue;
    }
    const wrapped = wrapReplacementToSegment({ ...segment, charBudget }, nextLine);
    if (!wrapped) {
      const reason = `could not fit across the original ${segment.lineCount} visual line(s)`;
      changes.push(`Skipped logical bullet starting line ${lineNumber} because it ${reason}.`);
      failedLines.push({ line: lineNumber, reason });
      continue;
    }

    segment.lineIndexes.forEach((lineIndex, offset) => {
      lines[lineIndex] = wrapped[offset];
    });
    seen.add(lineNumber);
    acceptedLines.push(lineNumber);
    changes.push(
      segment.startLine === segment.endLine
        ? `Rewrote ${segment.kind} line ${segment.startLine} within the original PDF width.`
        : `Rewrote ${segment.kind} logical bullet lines ${segment.startLine}-${segment.endLine} atomically within the original PDF width.`,
    );
  }

  return {
    resumeText: lines.join("\n"),
    changes,
    acceptedLines,
    failedLines,
  };
}

function buildLineReplacements(originalText, nextText, evidenceGraph = readEvidenceGraph({})) {
  const before = normalizeLines(originalText);
  const after = normalizeLines(nextText);
  if (before.length !== after.length) {
    throw routeError(422, `Format-preserving export blocked: line count changed from ${before.length} to ${after.length}.`);
  }

  const occurrences = new Map();
  const beforeSegments = parseLogicalEditableSegments(before);
  const editableLineToSegment = new Map();
  for (const segment of beforeSegments) {
    for (const index of segment.lineIndexes) editableLineToSegment.set(index, segment);
  }
  const changedSegmentStarts = new Set();
  const replacements = [];

  for (const segment of beforeSegments) {
    if (!isSummarySection(segment.section) && !isEditableBulletSection(segment.section)) continue;
    const newText = logicalSegmentTextFromLines(segment.lineIndexes.map((lineIndex) => after[lineIndex] || ""));
    const normalized = normalizeLine(segment.text);
    const occurrence = occurrences.get(normalized) || 0;
    occurrences.set(normalized, occurrence + 1);
    if (segment.text === newText) continue;
    if (!newText) {
      throw routeError(422, `Format-preserving export blocked: logical bullet starting line ${segment.startLine} was emptied.`);
    }
    if (newText.length > segment.charBudget) {
      throw routeError(422, `Format-preserving export blocked: logical bullet starting line ${segment.startLine} exceeds its ${segment.charBudget}-character budget.`);
    }
    const unsupportedReasons = unsupportedClaimReasons(segment.text, newText, evidenceGraph, segment.startLine);
    if (unsupportedReasons.length) {
      throw routeError(422, `Format-preserving export blocked: logical bullet starting line ${segment.startLine} introduced ${unsupportedReasons.join("; ")}.`);
    }
    const qualityReasons = rewriteQualityReasons(newText);
    if (qualityReasons.length) {
      throw routeError(422, `Format-preserving export blocked: logical bullet starting line ${segment.startLine} failed readability validation: ${qualityReasons.join("; ")}.`);
    }
    changedSegmentStarts.add(segment.startLine);
    replacements.push({
      line: segment.startLine,
      endLine: segment.endLine,
      old: segment.text,
      oldLines: segment.oldLines,
      new: newText,
      occurrence,
      section: segment.section,
      kind: segment.kind,
      lineCount: segment.lineCount,
      visualLineCount: segment.visualLineCount,
      charBudget: segment.charBudget,
      maxChars: segment.charBudget,
    });
  }

  for (let index = 0; index < before.length; index += 1) {
    const oldLine = before[index] ?? "";
    const newLine = after[index] ?? "";
    const oldTrimmed = oldLine.trim();
    const newTrimmed = newLine.trim();
    if (!oldTrimmed && newTrimmed) {
      throw routeError(422, `Format-preserving export blocked: blank line ${index + 1} was filled.`);
    }
    if (oldTrimmed && !newTrimmed) {
      throw routeError(422, `Format-preserving export blocked: content line ${index + 1} was removed.`);
    }
    if (isProtectedHeading(oldLine) && oldTrimmed !== newTrimmed) {
      throw routeError(422, `Format-preserving export blocked: section/header line ${index + 1} changed.`);
    }
    const segment = editableLineToSegment.get(index);
    if (oldTrimmed !== newTrimmed && (!segment || !changedSegmentStarts.has(segment.startLine))) {
      throw routeError(422, `Format-preserving export blocked: non-summary/experience/project line ${index + 1} changed.`);
    }
  }
  return replacements;
}

resumeRoutes.post("/upload-resume-pdf", async (req, res) => {
  try {
    void cleanupOldSessions();
    const fileName = safePdfFileName(req.body.fileName || "uploaded-resume.pdf");
    const sourcePdfBuffer = decodePdfBase64(req.body.sourcePdfBase64 || req.body.pdfBase64);
    const sessionId = randomUUID();
    const paths = sessionPaths(sessionId);
    await fs.mkdir(paths.dir, { recursive: true });
    await fs.writeFile(paths.pdf, sourcePdfBuffer);

    const parsed = await parsePdfFile(paths.pdf);
    const resumeText = String(parsed.text || "").trim();
    const logicalBullets = Array.isArray(parsed.logical_bullets) ? parsed.logical_bullets : [];
    const evidenceGraph = buildWorkflowEvidenceGraph(logicalBullets, resumeText);
    const metadata = {
      version: 1,
      sessionId,
      fileName,
      createdAt: new Date().toISOString(),
      storage: "server_temp",
      text: resumeText,
      logicalBullets,
      evidenceGraph,
    };
    await writeResumeSession(sessionId, metadata, sourcePdfBuffer);

    res.json({
      status: "stored",
      storage: "server_temp",
      sessionId,
      fileName,
      text: resumeText,
      logicalBullets,
      evidenceGraph,
      warnings: logicalBullets.length ? [] : ["No editable logical bullets were detected in the PDF."],
    });
  } catch (error) {
    sendError(res, error);
  }
});


