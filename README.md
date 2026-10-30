# StratScope (Next.js)

A strategic planning workbench. Upload a client's plan (Word, PDF, Excel, CSV or text) and it extracts services, risks and signals, runs PESTEL, SWOT, scenarios and trend analysis, drafts a better plan, checks its own quotes against your documents, and exports Excel and Word. It also covers interviews, figures and projections, an organisation diagnostic, predictions and a watchlist, reports to your templates, and a leadership presentation.

Built with Next.js 16 (App Router), React 19, TypeScript, PostgreSQL and Prisma 7.

## Run it on your computer

You need Node.js 22 and Docker (for the database).

```bash
cp .env.example .env            # then edit it
docker compose up -d db         # starts PostgreSQL
npm install
npx prisma migrate dev --name init   # creates the tables; commit the prisma/migrations folder it makes
npm run db:seed                 # creates the first admin from SEED_ADMIN_* in .env
npm run dev                     # http://localhost:3000
```

To use AI, set `AI_PROVIDER` in `.env`:

| Value | What it does | Also set |
|---|---|---|
| `anthropic` | Claude through Anthropic's API | `ANTHROPIC_API_KEY`, `AI_MODEL` |
| `bedrock` | Claude inside your own AWS account (text does not leave it) | `AWS_REGION`, `AI_MODEL` (model or inference profile ID). Credentials come from the AWS role |
| `openai_compat` | A model server you run, such as Ollama or vLLM | `AI_BASE_URL`, `AI_MODEL` |
| `none` | No AI. You can still upload, edit registers and view results | |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, run |
| `npm test` | Unit tests (no database or Next.js needed) |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm run e2e` | Playwright smoke tests (needs the app and a seeded database) |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations and the first admin |

## Deploy

`docker build -t stratscope .` makes an image that runs `node server.js` on port 3000. Run it where it can reach PostgreSQL (for example ECS with RDS), set the same environment variables, run `npx prisma migrate deploy` once per release, and put it behind HTTPS. Keep it on one container, or move `runJob` to a worker first (see docs/ARCHITECTURE.md).

## What is tested, and what is not

Tested here with real runs (`npm test`, 40 tests):
- Statistics, projections, evidence checking, quality rules, plan comparison, metric import (checked against independent calculations)
- Prompts, reply repair, JSON extraction, provider requests and error handling, cancellation
- The whole analysis job runner against an in-memory store and a fake AI, including failures and re-runs
- Excel export (opened with openpyxl), Word export (rendered in LibreOffice), reading .docx, .xlsx and .pdf uploads
- Passwords, session tokens, origin checks, login lockout
- Every result view and chart, rendered to HTML

Written but not run, because they need Next.js, Prisma and PostgreSQL installed: the API route handlers, the Prisma store, pages, layouts and client interaction code, and the Playwright tests. Expect to fix small things on first run (typing, a Prisma 7 detail, a Next.js 16 API). `npm run typecheck` is the first thing to run.

## From the earlier prototype

Same analysis prompts, evidence checks and exports. New: a real database with per-workspace access, server-side file reading, background jobs that survive closing the page, per-person limits, and an audit log. Registers use tables with a form for add and edit (the prototype's signal board is a table for now). Data in the Claude-hosted prototype does not carry over.
