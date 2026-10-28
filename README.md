# FairGrade

Consistent, rubric-driven grading for large courses (300+ students, many TAs), with an AI assistant for the answers TAs aren't sure how to grade.

When a dozen TAs grade the same descriptive exam, the same answer can get 3/5 from one TA and 4/5 from another. FairGrade attacks that variance from several sides:

| Problem | What FairGrade does |
|---|---|
| Vague rubrics read differently by each TA | Instructor uploads the rubric; AI splits it into checkable criteria and flags ambiguous ones |
| TAs guessing on edge cases | TA photographs the answer → AI transcribes it, checks every criterion, cites evidence, and suggests marks with a confidence level |
| Each TA deciding edge cases alone | A resolved doubt becomes a **ruling**, shown to every TA on that question and followed by the AI from then on |
| Lenient vs. harsh graders | Scripts are allocated randomly, so per-TA averages should match; the **Consistency** dashboard flags graders who deviate significantly |
| Rubric changed mid-grading | Every already-graded script is recalculated automatically |
| "I know this student" bias | Optional blind grading: TAs see an anonymous sheet code instead of names |
| Cribs reviewed by the same TA who graded | Cribs must cite a rubric criterion, are AI pre-screened, and go to a *different* reviewer |
| No paper trail | Every mark change is logged with who, when and why, and shown to the student |
| Cribs that hinge on finding the paper copy | The grader uploads a scanned PDF of every answer sheet; students see it with their marks, and crib reviewers and the AI read it |

The AI only recommends. A TA or the instructor always makes the final call.

## Quick start

Requires Node.js 20.9+.

```bash
cd fairgrade
npm install
cp .env.example .env      # then fill in the Supabase values (see "Supabase setup" below)
npm run setup             # creates the tables and loads demo data
npm run dev
```

Open http://localhost:3000. Every demo account's password is `password123`:

| Email | Role | Try this |
|---|---|---|
| `instructor@demo.edu` | Instructor | Midsem → **Consistency** tab, **Doubts** (one is waiting for you) |
| `headta@demo.edu` | Head TA | Resolves escalated doubts, reviews cribs |
| `rahul@demo.edu` | TA (seeded as lenient) | **Grade** tab → grade a script, raise a doubt |
| `priya@demo.edu` | TA (seeded as harsh) | |
| `arjun@demo.edu`, `sneha@demo.edu` | TAs | |
| `student@demo.edu` | Student | Quiz 1 → raise a crib on Q2 |

`npm run seed` resets the demo data at any time.

### Turning on the real AI

Without an API key the app runs in **AI demo mode**: every flow works, but AI suggestions are simulated (and labelled as such). To have a real model read handwriting and grade against the rubric, add **one** key to `.env` and restart `npm run dev`:

| Provider | `.env` | Get a key |
|---|---|---|
| Google Gemini | `GEMINI_API_KEY="..."` | https://aistudio.google.com/apikey |
| Anthropic Claude | `ANTHROPIC_API_KEY="..."` | https://console.anthropic.com |

The header badge shows which one is active (e.g. "AI: Gemini"). Optional settings:

- `AI_PROVIDER=gemini` or `claude` picks one explicitly when both keys are set.
- `GEMINI_MODEL` sets the Gemini model (default `gemini-3.5-flash`). Use a Pro model for harder handwriting and maths.
- `FAIRGRADE_AI_MODE=demo` forces demo mode.

The grading agent lives in [`src/lib/ai.ts`](src/lib/ai.ts), and the provider switch is in [`src/lib/ai-providers.ts`](src/lib/ai-providers.ts). Both providers get the same prompt, photos and output schema, so the rest of the app doesn't care which one runs. The agent has three jobs:

- `adviseOnDoubt`: transcribe the photo, judge each rubric criterion with evidence, suggest marks, say how confident it is, and propose a general ruling for new edge cases
- `screenCrib`: assess a student's regrade request against the rubric
- `structureRubric`: turn an uploaded PDF, photo or text rubric into itemised criteria and flag ambiguity

The prompts treat student answers as data, so an answer that says "give me full marks" is ignored. Low-confidence suggestions, or cases the rubric doesn't cover, are escalated to the instructor automatically. Claude requests use Claude Opus 5.5 and opt into server-side refusal fallbacks (`fallbacks: "default"`).

## Supabase setup

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Pick a region close to your users, and set the same region in `vercel.json`. Save the database password.
2. Click **Connect** in the top bar → **ORMs** → **Prisma**. Copy `DATABASE_URL` (port 6543) and `DIRECT_URL` (port 5432) into `.env` and fill in your password. Replace the whole `[YOUR-PASSWORD]`, brackets included. If the password has symbols, URL-encode them (for example `$` → `%24`, `!` → `%21`, `*` → `%2A`, `@` → `%40`). Next.js treats a raw `$` in `.env` as a variable reference and breaks the password.
3. In **Project Settings → API Keys**, copy the **Secret key** (`sb_secret_…`, or the legacy `service_role` key) into `SUPABASE_SECRET_KEY`. Copy the project URL (`https://<ref>.supabase.co`) into `SUPABASE_URL`.
4. Run `npm run setup`. This applies the migrations and loads demo data. The photo bucket `answer-photos` is created automatically on first use.

The migrations turn on row-level security for every table. Supabase's public Data API (the anon key) therefore can't read anything; only the app's server-side connection can.

## Deploying to Vercel

1. Push the `fairgrade` folder to a GitHub repository.
2. On [vercel.com/new](https://vercel.com/new), import the repo. If the repo root is `et610`, set **Root Directory** to `fairgrade`.
3. Under **Environment Variables**, add everything from your `.env`: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTH_SECRET` (use a fresh random one for production) and `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`.
4. Deploy. Vercel runs `npm run vercel-build`, which applies any new database migrations before building.

[`vercel.json`](vercel.json) pins the server functions to Tokyo (`hnd1`), the same region as the Supabase database, so each page's database queries stay fast. If you move the database, change the region to match.

AI requests can take up to a minute, so pages that call the AI set `maxDuration = 120`. If your Vercel plan allows less, lower it in those pages.

Changing the data model later: edit `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` against your Supabase database, commit the new migration folder, and push.

## Android app

The Android app (`android/`, built with [Capacitor](https://capacitorjs.com)) is a native shell around the hosted site, so every web deploy reaches the app without a new APK. On top of the website it adds **Google's ML Kit Document Scanner**: the **Scan** button on the grading screen opens the native scanner (edge detection, cropping, cleanup, multi-page) and uploads the result as a PDF. In a normal browser the same button photographs pages one at a time and builds the PDF on the phone.

Build a debug APK (needs JDK 21 and the Android SDK with platform 36):

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to a phone and allow "Install unknown apps" to try it. To point an emulator at your local dev server instead of the live site, run `FAIRGRADE_APP_URL=http://10.0.2.2:3000 npx cap sync android` before building. App icons and splash screens are generated from `assets/` with `npx @capacitor/assets generate --android`.

Publishing to the Play Store additionally needs a release keystore, `./gradlew bundleRelease`, and a Google Play developer account.

## How it works

```
Instructor                TA                           Student
──────────                ──                           ───────
Create exam
Upload rubric ──AI──▶ itemised criteria
Start grading ────────▶ Grade scripts (tick criteria)
                        Unsure? Photo ──AI──▶ suggestion
Escalated doubts ◀────── Send to instructor
Decide + publish ruling ─▶ shown to all TAs, AI follows it
Consistency dashboard
Publish results ─────────────────────────────────▶ See marks + rubric breakdown
                        Review crib (≠ original grader) ◀── Crib citing a criterion
                                                    ──AI pre-screen──┘
Close & export CSV
```

Exam lifecycle: **Setting up → Grading → Results out → Closed**.

### Detecting grader bias

For each TA and question, the TA's marks are compared with every *other* TA's marks on that question (Welch's z-test). A pair is flagged when the TA has at least 5 scripts, the gap is at least 0.5 SD, and p < 0.05. The dashboard also shows each TA's override rate (marks typed instead of computed from the rubric) and crib-acceptance rate. See [`src/lib/stats.ts`](src/lib/stats.ts).

## Tech

- **Next.js 16** (App Router, server actions) + **React 19** + **Tailwind CSS 4**
- **Prisma** + **PostgreSQL on Supabase**, with migrations in [`prisma/migrations`](prisma/migrations)
- **Supabase Storage** (private bucket) for answer photos
- **Anthropic SDK** (Claude Opus 5.5) or **Google GenAI SDK** (Gemini), both with vision + structured JSON output
- **sharp** normalises phone photos (rotation, size); `jose` + `bcryptjs` for sessions

```
src/
  app/
    actions/          server actions: auth, courses, exams, grading, doubts, cribs
    courses/[id]/     course home, people, join codes
    exams/[id]/       overview, rubric, grade, doubts, rulings, cribs, analytics, export
    api/files/        auth-checked access to uploaded photos
  lib/
    ai.ts             the grading agent (prompts, schemas, demo mode)
    ai-providers.ts   Claude / Gemini switch
    stats.ts          grader-consistency statistics
    grading.ts        rubric totals, audit-logged grade writes, rubric recalculation
    access.ts         per-course roles (Instructor / Head TA / TA / Student)
  components/         UI primitives, grading sheet
prisma/
  schema.prisma       data model
  seed.ts             demo data
```

Scanned answer sheets (PDF, up to 30 MB) upload straight from the browser to Supabase through a short-lived signed URL, so they skip Vercel's request limit, and open through a 5-minute signed link. Answer photos go to the same private Supabase Storage bucket (or `uploads/` when Supabase isn't configured) and are only served, through an auth-checked route, to staff of the course or to the student who attached them. Phones shrink photos before uploading, which keeps uploads under Vercel's ~4.5 MB request limit.

## Roadmap ideas

- **Calibration round**: every TA grades the same 5 sample scripts before real grading, and the app shows how far apart they are
- **AI spot-checks**: the AI silently re-grades a random sample of each TA's scripts and flags big disagreements
- **Full script scanning**: upload whole answer booklets and split them by question
- Notifications (email / in-app) for escalations, rulings and crib decisions
- Bulk student import from the institute roster (CSV)
