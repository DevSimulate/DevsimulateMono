# Deployment Guide — DevSimulate

Stack: **Vercel** (frontend) · **Railway** (backend) · **Supabase** (database) · **Upstash** (Redis)

---

## 1. Supabase (Database)

1. Create a new Supabase project
2. Go to **Settings → Database → Connection string → URI**
3. Copy the URI — it looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
   ```
4. **Append** `?sslmode=require` to the end
5. This becomes your `DATABASE_URL`

**After backend is deployed, run once:**
```bash
# From apps/api directory (with DATABASE_URL set)
npx prisma db push
npx ts-node prisma/seed.ts
npx ts-node prisma/seed-demo.ts
```

Or via Railway CLI:
```bash
railway run npx prisma db push
railway run npx ts-node prisma/seed.ts
railway run npx ts-node prisma/seed-demo.ts
```

---

## 2. Upstash (Redis)

1. Create a new Redis database at [upstash.com](https://upstash.com)
2. Go to **Details → Connect → ioredis** — copy the URL
3. It will start with `rediss://` (TLS) — use this exactly as `REDIS_URL`

---

## 3. Railway (Backend API)

### Setup
1. Connect your GitHub repo to Railway
2. Set root directory to `/` (the monorepo root — Railway reads `apps/api/Dockerfile`)
3. Or use Railway CLI: `railway up` from repo root

### Environment Variables (set in Railway dashboard)
```
DATABASE_URL=postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres?sslmode=require
JWT_SECRET=<random 64-char string>
JWT_EXPIRES_IN=7d
GITHUB_CLIENT_ID=<your OAuth app client ID>
GITHUB_CLIENT_SECRET=<your OAuth app secret>
GITHUB_WEBHOOK_SECRET=<random string>
GITHUB_TOKEN=<personal access token with repo scope>
ANTHROPIC_API_KEY=<your key>
REDIS_URL=rediss://default:[PW]@[HOST].upstash.io:6379
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

> Railway sets `PORT` automatically — do NOT override it.

### Health check
After deploy: `GET https://your-api.railway.app/health` → `{"status":"ok"}`

---

## 4. GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps**
2. Update (or create) your OAuth App:
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-api.railway.app/auth/github/callback`
3. Copy Client ID → `GITHUB_CLIENT_ID` (both Railway and Vercel)
4. Copy Client Secret → `GITHUB_CLIENT_SECRET` (Railway only)

---

## 5. GitHub Webhook

1. Go to your **NovaTech CRM repo → Settings → Webhooks**
2. Update the Payload URL to: `https://your-api.railway.app/webhooks/github`
3. Content type: `application/json`
4. Secret: must match `GITHUB_WEBHOOK_SECRET` in Railway

---

## 6. Vercel (Frontend)

### Setup
1. Import repo from GitHub in Vercel dashboard
2. Set **Root Directory** to `apps/web`
3. Framework preset: **Next.js** (auto-detected)

### Environment Variables (set in Vercel dashboard)
```
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_GITHUB_CLIENT_ID=<same as Railway GITHUB_CLIENT_ID>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 7. Post-Deploy Smoke Test

- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] GitHub OAuth login works (redirects back to frontend)
- [ ] `GET /employer/dashboard/stats` returns candidate data (no auth required)
- [ ] `GET /employer/candidates/demo-user-ahmed-khan-001` returns Ahmed's profile
- [ ] `POST /employer/candidates/compare` returns all 3 with recommendations
- [ ] `/employer/demo` → Reset Demo Data → success message
- [ ] Dashboard loads real candidates (no mock data)
- [ ] Candidate detail page loads for each demo candidate

---

## 8. Demo Quick Reset

Before any investor meeting, visit:
```
https://your-app.vercel.app/employer/demo
```
Click **Reset Demo Data** → green checkmark → **Go to Dashboard**
