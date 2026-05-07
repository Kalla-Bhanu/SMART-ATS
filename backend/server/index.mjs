import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { attachRequestError, requestLogger } from "./lib/requestLog.mjs";
import { resumeRoutes } from "./routes/resume.mjs";
import { systemRoutes } from "./routes/system.mjs";

const app = express();
const port = Number(process.env.OUR_BACKEND_PORT || process.env.RESUME_BUILDER_API_PORT || 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

function localCors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

app.use(localCors);
app.use(requestLogger);
app.use(express.json({ limit: "20mb" }));
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.json({
    name: "SMART ATS backend",
    status: "ok",
    apiBase: "/api",
  });
});

app.get("/dashboard", (_req, res) => {
  res.redirect("/");
});

app.use("/api", systemRoutes({ port }));
app.use("/api", resumeRoutes);

app.use((req, res) => {
  attachRequestError(req, new Error("Route not found."));
  res.status(404).json({
    error: "Route not found.",
    path: req.originalUrl,
  });
});

app.use((error, req, res, _next) => {
  const status = error.status || (error.type === "entity.parse.failed" ? 400 : 500);
  attachRequestError(req, error);
  res.status(status).json({
    error: error.message || "Backend error.",
    path: req.originalUrl,
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Our Own Backend listening on http://127.0.0.1:${port}`);
  console.log(`Dashboard: http://127.0.0.1:${port}/dashboard`);
});
