# SMART ATS

A locally-run resume tailoring tool that produces grounded, integrity-validated bullet rewrites for job descriptions, then generates a Claude.ai-ready prompt to produce a tailored PDF in the user's existing resume format.

## What It Does

- Scans a job description against a structured master resume
- Returns calibrated fit analysis with required vs preferred classification
- Identifies which bullets need rewriting based on JD-specific gaps
- Generates per-bullet rewrites with strict integrity validation
- Assembles a prompt that can be used with a base resume PDF to produce a tailored version while preserving formatting

## Why

Many resume tools either overfit to keywords or fabricate experience. SMART ATS is designed around interview defensibility: every rewrite must stay grounded in evidence already present in the master resume.

## Architecture

This repository contains two local services:

- `backend/`: Node.js Express API for LLM orchestration, validation, scan analysis, and prompt assembly
- `frontend/`: Vite/React dashboard for uploading/pasting resume context, scanning a JD, and generating rewrite prompts

The backend reads `backend/v01/master.yaml` as the source of truth. The included master resume is a fictional sample persona.

## Public Repository Scope

This is a sanitized portfolio version. It intentionally does not include:

- real candidate resume data
- private API keys
- private load balancer URLs
- deployment secrets
- a production runbook

To run it, configure your own LLM API settings in the backend environment using `backend/.env.example` as a reference.

## Setup

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at `http://127.0.0.1:5173`.

## Main Endpoints

- `GET /api/master`
- `POST /api/scan`
- `POST /api/rewrite-resume`
- `POST /api/upload-resume-pdf`
- `POST /api/llm-passthrough`

## Status

Portfolio project. Local-first. Not configured for public hosted deployment.

## License

Apache 2.0. See `LICENSE`.
