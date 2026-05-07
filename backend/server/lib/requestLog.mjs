import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const MAX_MEMORY_LOGS = 250;
const SLOW_REQUEST_MS = 10000;
const logs = [];
const requestErrors = new WeakMap();
const logDir = path.join(process.cwd(), "logs");
const sqliteFile = path.join(logDir, "request-log.sqlite");
let db = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(logDir, { recursive: true });
  db = new DatabaseSync(sqliteFile);
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      session_id TEXT,
      operation TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      http_status INTEGER NOT NULL,
      body_json TEXT,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_status ON operation_logs(status, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_operation ON operation_logs(operation, timestamp DESC);
  `);
  return db;
}

function safeBodySummary(body = {}) {
  if (!body || typeof body !== "object") return null;

  return {
    resumeChars: typeof body.resumeText === "string" ? body.resumeText.length : undefined,
    jdChars: typeof body.jdText === "string" ? body.jdText.length : undefined,
    missingKeywords: Array.isArray(body.missingKeywords) ? body.missingKeywords.length : undefined,
    fields: Object.keys(body).filter((key) => !["resumeText", "jdText", "sourcePdfBase64", "pdfBase64"].includes(key)).slice(0, 12),
  };
}

function requestSessionId(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  return String(body.sessionId || body.sourceSessionId || req.headers["x-session-id"] || "").slice(0, 80) || null;
}

function operationName(req) {
  return `${req.method} ${(req.originalUrl || req.url || "").split("?")[0]}`;
}

function errorCodeFor(req, res, error) {
  if (error?.code) return String(error.code).slice(0, 80);
  if (error?.error_code) return String(error.error_code).slice(0, 80);
  if (error?.name && error.name !== "Error") return String(error.name).slice(0, 80);
  if (res.statusCode >= 400) return `HTTP_${res.statusCode}`;
  return null;
}

function rowToEntry(row) {
  let body = null;
  try {
    body = row.body_json ? JSON.parse(row.body_json) : null;
  } catch {
    body = null;
  }
  return {
    id: row.id,
    at: row.timestamp,
    sessionId: row.session_id,
    operation: row.operation,
    method: row.method,
    path: row.path,
    status: row.http_status,
    ok: row.status === "ok",
    durationMs: row.duration_ms,
    slow: row.duration_ms >= SLOW_REQUEST_MS,
    body,
    error: row.error_message
      ? {
          message: row.error_message,
          code: row.error_code,
        }
      : null,
  };
}

function writeLog(entry) {
  logs.unshift(entry);
  if (logs.length > MAX_MEMORY_LOGS) logs.length = MAX_MEMORY_LOGS;

  getDb()
    .prepare(
      `INSERT INTO operation_logs
        (id, timestamp, session_id, operation, duration_ms, status, error_code, method, path, http_status, body_json, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.id,
      entry.at,
      entry.sessionId,
      entry.operation,
      entry.durationMs,
      entry.ok ? "ok" : "error",
      entry.error?.code || null,
      entry.method,
      entry.path,
      entry.status,
      entry.body ? JSON.stringify(entry.body) : null,
      entry.error?.message || null,
    );
}

function loadRecentLogs() {
  try {
    const rows = getDb()
      .prepare("SELECT * FROM operation_logs ORDER BY timestamp DESC LIMIT ?")
      .all(MAX_MEMORY_LOGS);
    logs.splice(0, logs.length, ...rows.map(rowToEntry));
  } catch {
    logs.length = 0;
  }
}

export function attachRequestError(req, error) {
  requestErrors.set(req, {
    message: error?.message || "Request failed.",
    name: error?.name || "Error",
    code: error?.code || error?.error_code || null,
  });
}

export function requestLogger(req, res, next) {
  if (req.path === "/api/logs") {
    next();
    return;
  }

  const startedAt = Date.now();
  const id = randomUUID();
  const operation = operationName(req);
  const pathValue = req.originalUrl || req.url;
  const method = req.method;
  const sessionId = requestSessionId(req);
  const body = safeBodySummary(req.body);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const error = requestErrors.get(req);
    const ok = res.statusCode < 400;
    const entry = {
      id,
      at: new Date(startedAt).toISOString(),
      sessionId,
      operation,
      method,
      path: pathValue,
      status: res.statusCode,
      ok,
      durationMs,
      slow: durationMs >= SLOW_REQUEST_MS,
      body,
      error: ok
        ? null
        : {
            message: error?.message || `HTTP ${res.statusCode}`,
            code: errorCodeFor(req, res, error),
          },
    };
    writeLog(entry);
  });

  next();
}

export function getRequestLogs(limit = 100) {
  const bounded = Math.max(1, Math.min(Number(limit) || 100, MAX_MEMORY_LOGS));
  try {
    return getDb()
      .prepare("SELECT * FROM operation_logs ORDER BY timestamp DESC LIMIT ?")
      .all(bounded)
      .map(rowToEntry);
  } catch {
    return logs.slice(0, bounded);
  }
}

export function clearRequestLogs() {
  logs.length = 0;
  getDb().exec("DELETE FROM operation_logs");
}

export function requestLogPatterns(limit = 8) {
  try {
    return getDb()
      .prepare(
        `SELECT operation, error_code, COUNT(*) AS count, MAX(timestamp) AS latest
         FROM operation_logs
         WHERE status != 'ok'
         GROUP BY operation, error_code
         ORDER BY count DESC, latest DESC
         LIMIT ?`,
      )
      .all(Math.max(1, Math.min(Number(limit) || 8, 20)));
  } catch {
    return [];
  }
}

export function requestLogMeta() {
  return {
    inMemory: logs.length,
    maxMemory: MAX_MEMORY_LOGS,
    file: sqliteFile,
    sqlite: true,
    slowThresholdMs: SLOW_REQUEST_MS,
    stats: requestLogStats(),
    patterns: requestLogPatterns(),
  };
}

export function requestLogStats() {
  const recent = getRequestLogs(MAX_MEMORY_LOGS);
  const total = recent.length;
  const successful = recent.filter((entry) => entry.ok).length;
  const failed = total - successful;
  const slow = recent.filter((entry) => entry.slow).length;
  const avgDurationMs = total ? Math.round(recent.reduce((sum, entry) => sum + (Number(entry.durationMs) || 0), 0) / total) : 0;
  const lastFailure = recent.find((entry) => !entry.ok) || null;
  const latest = recent[0] || null;

  return {
    total,
    successful,
    failed,
    slow,
    avgDurationMs,
    lastFailure,
    latest,
  };
}

loadRecentLogs();
