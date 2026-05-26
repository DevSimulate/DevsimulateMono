# DevSimulate

> Real tickets. AI scoring. Level up.

DevSimulate is a developer training platform where engineers work on ambiguous business tickets from realistic fake company codebases, use any AI tool freely, and get scored on their **thinking** — not just whether the code compiles.

---

## Architecture

| Component | Stack | Port |
|---|---|---|
| `apps/api` | Node.js + Express + Prisma + BullMQ | 3001 |
| `apps/web` | Next.js 15 + React + Tailwind | 3000 |
| `apps/extension` | VS Code Extension (TypeScript) | — |
| `packages/shared` | Shared TypeScript types | — |

**Core loop:** Ticket → Clone → Code (with any AI) → PR → Claude review → Score

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- PostgreSQL (local or hosted)
- Redis (local or hosted, for BullMQ job queue)
- A GitHub OAuth App
- An Anthropic API key

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-org/devsimulate.git
cd devsimulate
```

### 2. Install dependencies

Turborepo installs all workspace packages from the root:

```bash
npm install
```

### 3. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in every value in `apps/api/.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random string ≥ 32 characters |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `GITHUB_WEBHOOK_SECRET` | Secret configured on the GitHub webhook |
| `GITHUB_TOKEN` | Personal access token for reading PR diffs |
| `PORT` | API port (default: `3001`) |
| `FRONTEND_URL` | Web app URL for CORS (default: `http://localhost:3000`) |

Fill in `apps/web/.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL (default: `http://localhost:3001`) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth App client ID |

### 4. Set up the database

```bash
# Run from apps/api/
cd apps/api
npx prisma migrate dev --name init
```

### 5. Seed the database

Inserts the NovaTech CRM codebase with 3 realistic .NET tickets:

```bash
# Still from apps/api/
npx prisma db seed
```

This creates:
- **NOVA-47** — Intermittent Order Fulfillment Failure (MID, 90 min)
- **NOVA-52** — Dashboard Performance Degradation (MID, 75 min)
- **NOVA-58** — Discount Calculation Conflict (SENIOR, 120 min)

### 6. Configure Redis

Make sure Redis is running locally on port 6379, or set `REDIS_URL` in `apps/api/.env`:

```bash
# macOS
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### 7. Start the development servers

```bash
# From the repo root — starts both API and web concurrently
npm run dev
```

- API: [http://localhost:3001](http://localhost:3001)
- Web: [http://localhost:3000](http://localhost:3000)
- API health check: [http://localhost:3001/health](http://localhost:3001/health)

---

## VS Code Extension

### Development

1. Open `apps/extension` in VS Code
2. Press **F5** to launch the Extension Development Host
3. The DevSimulate icon will appear in the activity bar

### Commands available

| Command | Description |
|---|---|
| `DevSimulate: Login with GitHub` | Authenticate via GitHub OAuth |
| `DevSimulate: Clone Codebase` | Clone assigned ticket's repo and create branch |
| `DevSimulate: Submit PR for Review` | Submit your PR URL + description for Claude scoring |
| `DevSimulate: View Score` | Show latest score in a notification |

### Configuration

In VS Code settings, set `devsimulate.apiUrl` to point at your API instance (defaults to `https://api.devsimulate.io`).

---

## GitHub Webhook Setup

To receive PR events for automatic review triggering:

1. Go to your GitHub repo Settings → Webhooks → Add webhook
2. Payload URL: `https://your-api-domain.com/webhooks/github`
3. Content type: `application/json`
4. Secret: match `GITHUB_WEBHOOK_SECRET` in your `.env`
5. Events: select **Pull requests**

The webhook handler verifies the HMAC-SHA256 signature before processing. PRs on branches matching `ds/ticket-*` pattern trigger automatic Claude review.

---

## Scoring Rubric

Claude evaluates every PR submission on four dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| **Diagnosis** | 40 pts | Did you find the root cause, not just the symptom? |
| **Design** | 30 pts | Did you consider trade-offs, edge cases, production realities? |
| **Communication** | 20 pts | Can you explain *why* clearly in your PR description? |
| **Execution** | 10 pts | Does the solution actually work? |

The PR description is what Claude primarily scores. Write it like you're explaining your reasoning to a senior engineer — not just describing what you changed.

---

## Project Structure

```
devsimulate/
├── apps/
│   ├── api/                    # Express API + Prisma + BullMQ
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── routes/         # auth, tickets, submissions, webhooks, users
│   │   │   ├── services/       # auth, ticket, review (Claude), score
│   │   │   ├── middleware/     # JWT auth, webhook signature verification
│   │   │   └── lib/            # prisma, anthropic, github, queue, slugify
│   │   └── prisma/
│   │       ├── schema.prisma   # Full database schema
│   │       └── seed.ts         # NovaTech CRM + 3 tickets
│   │
│   ├── extension/              # VS Code Extension
│   │   └── src/
│   │       ├── extension.ts    # Activation entry point
│   │       ├── commands/       # login, clone, submit
│   │       ├── services/       # auth, ticket, git, review
│   │       └── views/          # SidebarProvider + sidebar.html
│   │
│   └── web/                    # Next.js 15 dashboard
│       └── src/app/
│           ├── page.tsx        # Landing page
│           ├── dashboard/      # Developer dashboard
│           ├── profile/        # Public shareable profile
│           └── auth/callback/  # GitHub OAuth callback
│
└── packages/
    └── shared/                 # Shared TypeScript types
```

---

## Tech Decisions

**Why BullMQ for Claude review?**
The GitHub webhook must return 200 within a few seconds or GitHub retries. Claude review takes 5–15 seconds. BullMQ queues the job and returns 200 immediately, then processes asynchronously with retry logic.

**Why prompt caching on the codebase context?**
The company lore and ticket rubric are stable across all reviews for a given ticket. Caching them with `cache_control: ephemeral` means Claude doesn't re-tokenize them on every invocation — reducing latency and cost by 40–60% on cache hits.

**Why 40% weight on Diagnosis?**
Execution is table stakes. Any LLM can write code that compiles. The hard part — and the part that distinguishes senior engineers — is correctly diagnosing *why* something is broken. That's the signal we want to capture.

**Why VS Code SecretStorage for the JWT?**
`context.secrets` is backed by the OS keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux). Storing tokens in `globalState` or workspace settings would expose them in plain text.
