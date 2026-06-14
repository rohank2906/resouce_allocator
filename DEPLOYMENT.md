# Deployment Guide — Resource Allocator on Vercel

This guide takes you from the GitHub repository to a fully working production
deployment on Vercel with:

- Postgres database (Neon — free tier, recommended)
- Google Sheets sync (employees + Resource Segregation)
- Ethara Assistant on a hosted LLM (Groq — free tier, recommended)
- NextAuth credentials login with admin password reset
- Health check, error boundaries, security headers

Estimated time: **20 minutes** end-to-end.

---

## 0. Prerequisites

- A GitHub repository pushed with the latest code.
- A Vercel account linked to that repository.
- A Google Service Account JSON file with both Sheets shared to its `client_email`.
- (Optional) A Groq account for the AI assistant — sign up free at
  [console.groq.com](https://console.groq.com).

---

## 1. Provision a Postgres database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign in.
2. **Create Project** → name it `resource-allocator` → region close to Vercel
   (default `aws-us-east-2` works well with Vercel `iad1`).
3. After provisioning, open **Dashboard → Connection Details**. Copy these two
   strings:
   - **Pooled connection** (uses `-pooler` host) → this becomes `DATABASE_URL`
   - **Direct connection** (no `-pooler`) → this becomes `DIRECT_URL`

   Both URLs must end with `?sslmode=require`.

Neon's free tier comfortably handles the app's workload (760 employees,
audit logs, sync history).

> **Alternative:** Vercel Postgres (Storage → Create → Postgres) auto-injects
> `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`. In that case map
> them: `DATABASE_URL=$POSTGRES_PRISMA_URL`, `DIRECT_URL=$POSTGRES_URL_NON_POOLING`.

---

## 2. Provision an LLM for the Ethara Assistant (Groq)

1. Sign up at [console.groq.com](https://console.groq.com).
2. **API Keys → Create API Key** → copy the `gsk_...` string. You will paste
   this into Vercel as `LLM_API_KEY`.
3. Choose a model:
   - `llama-3.3-70b-versatile` — best general reasoning, fast, free tier.
   - `qwen/qwen3-32b` — closest to your local Ollama setup.

   Set `LLM_MODEL` to one of those.

> **Why Groq:** the original assistant ran against local Ollama. Vercel's
> serverless functions cannot reach your laptop, so the LLM must be hosted.
> Groq is free, fast, and the assistant code uses an OpenAI-compatible
> endpoint — switching providers later is a one-env-var change.
>
> If you self-host Ollama (e.g. on a VPS), set
> `LLM_API_BASE_URL=https://your-ollama-host/v1` and `LLM_API_KEY=ollama`.

---

## 3. Configure environment variables in Vercel

Open **Vercel → your project → Settings → Environment Variables**. Add each
of the following for **Production**, **Preview**, and **Development**:

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL | Step 1 |
| `DIRECT_URL` | Neon direct URL | Step 1 — used by `prisma migrate` |
| `NEXTAUTH_URL` | `https://<your-project>.vercel.app` | Update after first deploy if URL changes |
| `NEXTAUTH_SECRET` | `openssl rand -base64 48` output | Fresh value, NEVER reuse dev secret |
| `ALLOW_PASSWORD_LOGIN` | `true` | |
| `GOOGLE_SHEET_ID` | `1Xingh0scld54zEbwNYRoI0Cv6NPF2tmy53Cns4J9dio` | Employees roster |
| `GOOGLE_SHEET_RANGE` | `Sheet1!A:D` | |
| `GOOGLE_RS_SHEET_ID` | `1W76v3knMY7iJrTZT1TWk3nLMKWTTJ4MSdA6l-tcIoUM` | RS sheet |
| `GOOGLE_RS_SHEET_RANGE` | `Resource Segregation!A:N` | |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `rohan-khatri-2906@rohan-2906.iam.gserviceaccount.com` | From service account JSON |
| `GOOGLE_PRIVATE_KEY` | Full PEM, wrapped in `"..."`, newlines as literal `\n` | Vercel handles `\n` correctly when pasted |
| `LLM_API_BASE_URL` | `https://api.groq.com/openai/v1` | Or any OpenAI-compatible URL |
| `LLM_API_KEY` | `gsk_xxx` from Groq | Or `ollama` if self-hosting |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Any model your provider exposes |
| `LLM_TIMEOUT_MS` | `120000` | Optional |

**Email & SYNC_CRON_SECRET** are optional. Leave them blank unless you wire
notifications or Vercel Cron.

> **Important on `GOOGLE_PRIVATE_KEY`:** copy the value exactly as it
> appears in your service-account JSON. Wrap it in double-quotes. The string
> contains literal `\n` characters — Vercel does NOT need any extra escaping.

---

## 4. First deployment

1. Push your code to GitHub (the repo already contains `.npmrc`,
   `vercel.json`, `prisma/migrations/`, etc.).
2. In Vercel: **Add New Project → Import** the repo.
3. Framework should auto-detect as Next.js. Leave build / install commands at
   their defaults — the `vercel.json` already pins everything.
4. Click **Deploy**.

The build runs:

```
npm install            (.npmrc → legacy-peer-deps=true)
prisma generate        (Prisma Client)
prisma migrate deploy  (creates tables in Neon from prisma/migrations/)
next build             (compiles app)
```

The first deploy takes ~3 minutes. After it's done:

1. Copy the assigned domain (e.g. `https://resource-allocator-xyz.vercel.app`).
2. Go back to **Settings → Environment Variables**, edit `NEXTAUTH_URL` to
   match the real domain, and **redeploy** (Deployments → ⋯ → Redeploy).

---

## 5. Bootstrap data in production

Your fresh Postgres database is empty. Sign in once to bootstrap the primary
admin, then run the sheet syncs.

### 5a. First admin login

1. Visit `https://<your-domain>/login`.
2. Select **Admin** role.
3. Email: `rohan.khatri@ethara.ai`
4. Password: `rohan@123`
5. On first login the user is auto-created with admin role; you'll be forced
   to `/auth/change-password`. Set a real password.

### 5b. Sync employees + attendance

1. Navigate to `/sync` (admin only).
2. Click **Sync now** on the Employees source — pulls ~760 rows from the
   employees sheet, creates Project + User + Employee records, hashes default
   passwords for PL/TPM users.
3. Click **Sync now** on the Resource Segregation source — updates attendance
   status, moves employees between projects.
4. Verify on `/dashboard`: workforce tiles populate, attendance chart renders.

### 5c. Verify the Ethara Assistant

1. Click the floating sparkle button (bottom-right) on any authed page.
2. Status dot should be green ("Online"); model name visible in header.
3. Try: *"How many TPMs do we have? Just give me the number."*
4. The streaming response should appear within ~2 seconds (Groq is fast).

If the status dot is amber or you get an OFFLINE error:
- Check `LLM_API_KEY` was saved correctly in Vercel
- Check `LLM_MODEL` is a valid Groq model (see https://console.groq.com/docs/models)
- Hit `/api/assistant` directly in your browser (while signed in) to see the
  reachability JSON

---

## 6. Optional: scheduled sync via Vercel Cron

Add to `vercel.json` to auto-sync every hour:

```json
"crons": [
  { "path": "/api/sync", "schedule": "0 * * * *" },
  { "path": "/api/sync/rs", "schedule": "*/30 * * * *" }
]
```

These will hit the routes as POST with the Vercel cron user-agent. Protect
them with `SYNC_CRON_SECRET` if you prefer manual triggers only.

---

## 7. Verifying deployment

| Check | How |
|---|---|
| Health | `curl https://<domain>/api/health` → `{ "status": "ok" }` |
| Login | Sign in as the admin you bootstrapped |
| Sync | `/sync` shows both source cards Configured, last-success timestamps update on "Sync now" |
| Assistant | Streaming response, no console errors |
| Dashboard | 6 tiles + 4 charts populate, no skeletons stuck |
| Employees | Search by name, multi-email paste, attendance column visible |
| Requests | Create a request, source-project roster fully loads (no cap) |
| Force password change | New TPM/PL users redirected to `/auth/change-password` |
| Error boundary | Visit a deliberately bad page or throw in dev → friendly error UI |

---

## 8. Schema updates after launch

The migration history lives in `prisma/migrations/`. To change schema in the
future:

```bash
# locally, against a dev Postgres or a Neon dev branch:
npx prisma migrate dev --name describe_change
```

Commit the new migration folder. On the next Vercel build,
`prisma migrate deploy` applies it to production.

**Never** use `prisma db push` against production — it bypasses the migration
history and can drift the schema.

---

## 9. Local development workflow

Local dev still works. Two options:

### Option A — Local Postgres (recommended for parity)

```bash
docker run -d --name resource-pg \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=resource_allocator \
  -p 5432:5432 postgres:16

# in .env (local only):
DATABASE_URL="postgresql://postgres:dev@localhost:5432/resource_allocator"
DIRECT_URL="postgresql://postgres:dev@localhost:5432/resource_allocator"

npx prisma migrate deploy
npm run db:seed
npm run dev
```

### Option B — Run against the Neon dev branch

```bash
npx vercel link
npx vercel env pull .env.development.local
npm run dev
```

For the assistant, dev can still use local Ollama: just leave `LLM_*` blank
locally and set `OLLAMA_HOST=http://127.0.0.1:11434` + `OLLAMA_MODEL=qwen2.5-coder:14b`.
The client tries `LLM_*` first then falls back to `OLLAMA_*`.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails with `ERESOLVE` | Confirm `.npmrc` is committed (`legacy-peer-deps=true`). |
| `prisma migrate deploy` fails on build | Verify `DIRECT_URL` is set and points to the **non-pooled** Neon host. |
| `NEXTAUTH_URL mismatch` on login | Match the env var to the exact deployed URL incl. `https://`. Redeploy after editing. |
| Assistant shows "OFFLINE" | Wrong `LLM_API_KEY` or `LLM_API_BASE_URL`. Hit `/api/assistant` (GET) while signed in to see the reachability JSON. |
| Assistant shows "MODEL_MISSING" | `LLM_MODEL` is not exposed by your provider. Pick another from their /v1/models list. |
| Sheets sync returns 400 | `GOOGLE_PRIVATE_KEY` got mangled. Re-paste with literal `\n` newlines, no extra escaping. |
| 401 on every page | Stale browser cookies after `NEXTAUTH_SECRET` change. Open an incognito window. |
| Health check 503 | Database unreachable. Confirm `DATABASE_URL` and that Neon is not paused (free tier auto-pauses after 5 min idle). |

---

## Architecture summary

```
[ Browser ] ── HTTPS ──▶ [ Vercel Edge / Next.js App ]
                              │
                              ├── Server Components / API routes (Node runtime)
                              │       │
                              │       ├──▶ Neon Postgres  (DATABASE_URL pooled)
                              │       ├──▶ Google Sheets  (service account)
                              │       └──▶ Groq /v1/chat/completions  (LLM_API_*)
                              │
                              └── Static assets (CDN cached)
```

- **Sessions**: JWT, signed with `NEXTAUTH_SECRET`. No DB writes per request.
- **Sheets sync**: write-heavy, audited; durations ~500-800 ms for the full
  RS sheet.
- **Assistant**: read-only by construction — only `findMany / groupBy / count
  / findFirst` against Postgres, then streams via OpenAI-compatible SSE.
- **Health**: `/api/health` does a `SELECT 1` and returns latency.

---

You're ready to ship. After step 5 the app is fully production-grade.
