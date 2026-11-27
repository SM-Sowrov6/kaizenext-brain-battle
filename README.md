# Kaizenext Brain Battle

**Think Fast. Play Smart. Win Big.** — the live quiz competition for Kaizenext's booth at **DIU Job Utsob 2026** (Nov 28–29, 2026).

Students scan a QR code, register in ~30 seconds, take a timed MCQ quiz on their phone, see their score and rank instantly, and appear on a live leaderboard on the booth monitor.

| Interface | Route | Who |
|---|---|---|
| Participant portal | `/`, `/register`, `/instructions`, `/quiz`, `/result` | Students (phones) |
| Live leaderboard | `/leaderboard` (`?rotate=1`, `?day=1\|2\|all`) | Booth monitor |
| Admin dashboard | `/admin` | Kaizenext team |

Design: the Kaizenext brand theme (deep forest + signal orange, Schibsted Grotesk + Instrument Serif), taken from kaizenext.com.

---

## Tech stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · Framer Motion · Lucide · Supabase (Postgres, Auth, Edge Functions) · Vercel.

## Architecture & security model

```
Browser ──(publishable key)──► Edge Function `quiz-api` ──(service role, server-only)──► Postgres
Admin browser ──(Supabase Auth session)──► Postgres (RLS: is_admin())
```

- **Participants never touch tables.** Every participant action (register, start, save answer, submit, result, leaderboard) goes through the `quiz-api` Edge Function. The `anon` role has **no RLS policies at all**, so answer keys (`question_options.is_correct`), emails and phones are unreachable from browsers.
- **Scores are computed only in the database** (`finalize_attempt()`), from answers saved server-side. The browser never sends a score.
- **Time is enforced on the server:** each attempt stores `deadline_at`; late saves are rejected (15 s network grace) and completion time is capped at the deadline. Abandoned attempts are auto-finalised.
- **One attempt per participant:** `attempts.participant_id` is `UNIQUE`; duplicate registration is blocked by normalised email (`+tags`/Gmail dots stripped) and normalised phone.
- **Idempotent submit:** repeated submits return the same result; double-taps on "Start" return the same attempt.
- **Participant auth:** registration returns a random 256-bit token; only its SHA-256 hash is stored.
- **Admins** sign in with Supabase Auth and must be listed in `admin_users`. Every admin query is protected by RLS / `is_admin()` checks — the UI route guard is only cosmetic.
- **Integrity heuristics** flag suspiciously fast, high-accuracy attempts for admin review (never auto-disqualify).
- Rate limiting per IP (generous, since campus Wi-Fi shares IPs), body-size limits, input sanitisation, CSV formula-injection protection.
- The service-role / secret key is **never** in frontend code or `VITE_*` variables. `src/lib/env.ts` refuses to start if a secret key is put there.

## Project structure

```
src/
  components/ui/       design-system primitives (Button, Card, Form, Dialog, Toast…)
  components/landing/  hero visual
  components/quiz/     quiz-specific parts (timer, options, navigator, steps)
  hooks/               config, session, admin auth, utilities
  layouts/             public + admin layouts
  pages/               participant pages, leaderboard, admin/*
  services/            API layer: participantApi (Edge Function), adminApi (Supabase), demoBackend (dev only)
  lib/                 env, supabase client, formatting, CSV, storage
  styles/index.css     Kaizenext design tokens
  types/               shared types
supabase/
  migrations/          schema, RLS, SQL functions
  seed.sql             optional starter question bank (20 questions)
  functions/quiz-api/  Edge Function
  functions/_shared/   HTTP + utility helpers
```

---

## 1. Local development

Requirements: Node 20+ (tested on Node 26 / npm 11).

```bash
npm install
cp .env.example .env      # then fill in your Supabase URL + publishable key
npm run dev               # http://localhost:5173
```

**Demo mode (no backend needed):** in development, if Supabase keys are missing — or you run with `VITE_FORCE_DEMO=true` — the app uses an in-browser demo backend (localStorage) that mirrors the server rules. A yellow "Demo mode" badge appears bottom-left. Admin login in demo mode: any email + password `demo1234`. Demo mode is **impossible in production builds** (it is compiled out).

```bash
# PowerShell
$env:VITE_FORCE_DEMO="true"; npm run dev
# bash
VITE_FORCE_DEMO=true npm run dev
```

Test on your phone: use the "Network" URL Vite prints (same Wi-Fi).

## 2. Supabase setup (one time)

Project: `https://mjbdrkfpmxcgizasuyqj.supabase.co`

### 2a. Database schema
Supabase Dashboard → **SQL Editor** → New query → paste the whole of
`supabase/migrations/20261126000000_init.sql` → **Run**.

Optional starter questions: paste `supabase/seed.sql` → **Run** (you can edit/replace them all from the admin panel).

> CLI alternative: `npx supabase login` → `npx supabase link --project-ref mjbdrkfpmxcgizasuyqj` → `npx supabase db push`.

### 2b. Deploy the Edge Function
```bash
npx supabase login
npx supabase functions deploy quiz-api --no-verify-jwt --project-ref mjbdrkfpmxcgizasuyqj
```
`--no-verify-jwt` is required: participants are anonymous, and the function performs its own token authentication. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase automatically — do not set them yourself.

Optional: restrict CORS to your domains:
```bash
npx supabase secrets set ALLOWED_ORIGINS="https://your-domain.com,http://localhost:5173" --project-ref mjbdrkfpmxcgizasuyqj
```

Verify:
```bash
curl -X POST https://mjbdrkfpmxcgizasuyqj.supabase.co/functions/v1/quiz-api \
  -H "apikey: <publishable key>" -H "content-type: application/json" -d '{"action":"config"}'
```
You should get JSON with `event` and `quiz`.

### 2c. Create an admin
1. Dashboard → **Authentication → Users → Add user** → enter email + strong password → tick *Auto confirm*.
2. SQL Editor:
   ```sql
   insert into public.admin_users (user_id, email)
   select id, email from auth.users where email = 'admin@kaizenext.com';
   ```
3. Recommended: Authentication → Providers → Email → **disable "Allow new users to sign up"** (admins are created manually; even if someone signs up, they get no access without an `admin_users` row).
4. Sign in at `/admin`.

## 3. Deploy the frontend (Vercel)

1. Push this repo to GitHub → Vercel → **Add New Project** → import it (framework auto-detected as Vite; `vercel.json` handles SPA routing + security headers).
2. Environment variables (Production + Preview):
   - `VITE_SUPABASE_URL` = `https://mjbdrkfpmxcgizasuyqj.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your `sb_publishable_…` key
   - `VITE_SITE_URL` = your public URL (used by QR codes), e.g. `https://brainbattle.kaizenext.com`
3. Deploy. If the variables are missing, the deployed site shows a friendly configuration screen instead of breaking.
4. Optional custom domain: Vercel → Domains → add `brainbattle.kaizenext.com` and the CNAME it shows.

## 4. QR code

Admin → **QR code**: enter the public URL → download **PNG** (2048 px, high error correction, print ≥12 cm) or **SVG**. The booth leaderboard also shows a live "Scan to play" QR automatically.

## 5. Event-day operation

- **Booth monitor:** open `/leaderboard?rotate=1` → full-screen button (or F11). It polls every 5 s, survives network blips ("Reconnecting…"), auto-scales on large/4K screens, and alternates *Today* ↔ *Overall* every 20 s.
- **Day switch:** Admin → Dashboard → *Active event day* → Day 2 on the morning of Nov 29.
- **Open/close:** "Quiz live" and "Registration open" toggles on the dashboard take effect within seconds.
- **Interrupted participant:** Admin → Participants → open them → *Delete participant* lets them register again.
- **Suspicious attempt:** Admin → Leaderboard → *Suspicious only* → open → *Disqualify attempt* (removes it from public boards, reversible).
- **After rehearsal:** Admin → Leaderboard → *Reset data* (type `RESET`). Export CSV first if needed.
- **Exports:** Participants → *Export CSV* (filters apply); Leaderboard → *Export results* per day/overall.

## 6. Configuration reference

Admin → Settings: event name/venue/dates, active day, quiz live, registration open, duration, questions per attempt, default marks, negative marking (+ value), shuffle questions/options, competition description, rules, prizes.

Defaults: 10 questions · 5 minutes · 1 mark each · no negative marking · one attempt.

See [docs/TESTING_CHECKLIST.md](docs/TESTING_CHECKLIST.md) before the event.
