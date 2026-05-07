import { Router } from "express";
import { spawnSync } from "node:child_process";
import { aiRuntimeConfig, hasAiConfig } from "../aiClient.mjs";
import { clearRequestLogs, getRequestLogs, requestLogMeta, requestLogPatterns } from "../lib/requestLog.mjs";

const BACKEND_VERSION = "0.1.0";

export function systemRoutes({ port }) {
  const router = Router();
  const startedAt = new Date();
  let readinessCache = null;

  function processStats() {
    const memory = process.memoryUsage();
    return {
      pid: process.pid,
      node: process.version,
      platform: process.platform,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: startedAt.toISOString(),
      memoryMb: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      },
    };
  }

  function dependencyReadiness() {
    if (readinessCache && Date.now() - readinessCache.checkedAt < 30000) return readinessCache.value;
    const pyMuPdf = spawnSync("python", ["-c", "import fitz; print('ok')"], {
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    const pymupdfAvailable = pyMuPdf.status === 0;
    const value = {
      aiProxyConfigured: hasAiConfig(),
      pymupdfAvailable,
      pymupdfError: pymupdfAvailable
        ? null
        : String(pyMuPdf.stderr || pyMuPdf.stdout || pyMuPdf.error?.message || "PyMuPDF check failed.")
            .trim()
            .slice(0, 240),
    };
    readinessCache = { checkedAt: Date.now(), value };
    return value;
  }

  router.get("/health", (_req, res) => {
    const runtime = aiRuntimeConfig();
    const logMeta = requestLogMeta();
    const readiness = dependencyReadiness();
    res.json({
      ok: true,
      ai_proxy_reachable: hasAiConfig(),
      pymupdf_available: readiness.pymupdfAvailable,
      version: BACKEND_VERSION,
      aiConfigured: hasAiConfig(),
      model: runtime.model,
      reasoningEffort: runtime.reasoningEffort,
      provider: runtime.baseUrl,
      timeoutMs: runtime.timeoutMs,
      readiness,
      process: processStats(),
      routes: [
        "GET /dashboard",
        "GET /api/health",
        "GET /api/routes",
        "GET /api/logs",
        "DELETE /api/logs",
        "GET /api/master",
        "POST /api/llm-passthrough",
        "POST /api/scan",
        "POST /api/rewrite-resume",
        "POST /api/upload-resume-pdf",
      ],
      logs: logMeta,
    });
  });

  router.get("/routes", (_req, res) => {
    const runtime = aiRuntimeConfig();
    res.json({
      frontend: "./frontend",
      backend: "./backend",
      dashboard: `http://127.0.0.1:${port}/dashboard`,
      apiBase: `http://127.0.0.1:${port}/api`,
      modelProxy: runtime.baseUrl,
      modelDefaults: {
        model: runtime.model,
        reasoningEffort: runtime.reasoningEffort,
        timeoutMs: runtime.timeoutMs,
      },
      apps: [
        {
          name: "Resume Builder",
          path: "./frontend",
          routes: ["GET /api/master", "POST /api/scan", "POST /api/rewrite-resume", "POST /api/upload-resume-pdf"],
        },
        {
          name: "Backend",
          path: "./backend",
          routes: ["POST /api/llm-passthrough"],
        },
      ],
    });
  });

  router.get("/logs", (req, res) => {
    res.json({
      meta: requestLogMeta(),
      patterns: requestLogPatterns(),
      logs: getRequestLogs(req.query.limit),
    });
  });

  router.delete("/logs", (_req, res) => {
    clearRequestLogs();
    res.json({
      ok: true,
      meta: requestLogMeta(),
    });
  });

  return router;
}
