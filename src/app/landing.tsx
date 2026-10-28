import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  EyeOff,
  FileText,
  Gavel,
  GraduationCap,
  ListChecks,
  Scale,
  ScanLine,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton, cx } from "@/components/ui";

/** Public marketing page for logged-out visitors. */
export function Landing() {
  return (
    <div className="space-y-24 pb-8 sm:space-y-32">
      <Hero />
      <Problems />
      <HowItWorks />
      <Features />
      <Roles />
      <DemoBand />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative grid items-center gap-12 pt-4 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-10">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs">
          <Scale className="size-3.5" /> For courses with 300 students and a dozen TAs
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-slate-900 sm:text-6xl">
          Same answer.
          <br />
          Same marks.
          <br />
          <span className="relative whitespace-nowrap text-indigo-600">
            Whoever grades it.
            <svg viewBox="0 0 300 12" className="absolute -bottom-2 left-0 h-3 w-full text-amber-400" preserveAspectRatio="none" aria-hidden>
              <path d="M2 9c60-6 140-8 296-4" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-pretty text-slate-600">
          FairGrade turns your rubric into one shared standard. TAs tick criteria instead of guessing, an AI assistant settles
          doubtful answers with the rubric in hand, and a consistency dashboard catches lenient and harsh graders before
          results go out.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <LinkButton href="/register" className="!px-5 !py-2.5 !text-base">
            Get started <ArrowRight className="size-4" />
          </LinkButton>
          <LinkButton href="/login#demo" variant="secondary" className="!px-5 !py-2.5 !text-base">
            Try the live demo
          </LinkButton>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
          {["Works on a TA's phone", "Gemini or Claude", "Every mark change logged"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <CircleCheck className="size-4 text-emerald-500" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <ProductPreview />
    </section>
  );
}

/** A static, illustrative mock of the grading screen, an AI suggestion and the bias chart. */
function ProductPreview() {
  const rubric = [
    { text: "Handles the leaf case", marks: 2, on: true },
    { text: "Handles the one-child case by splicing", marks: 2, on: true },
    { text: "Two children via inorder successor or predecessor", marks: 3, on: true },
    { text: "States the complexity as O(h)", marks: 1, on: false },
  ];
  const bars = [
    { name: "Rahul", diff: 2.2 },
    { name: "Arjun", diff: 0.4 },
    { name: "Sneha", diff: -0.3 },
    { name: "Priya", diff: -2.6 },
  ];
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-200/60 via-white to-amber-100/70 blur-2xl" />
      <div className="bg-dots absolute -top-6 -right-4 -z-10 size-40 rounded-3xl" />

      {/* Grading card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-indigo-900/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Midsem · 24B1012</div>
            <div className="font-semibold text-slate-900">Q1 · BST deletion</div>
          </div>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            7<span className="text-sm font-normal text-slate-400"> / 8</span>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5">
          {rubric.map((r) => (
            <li
              key={r.text}
              className={cx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm",
                r.on ? "bg-emerald-50 text-slate-800" : "text-slate-500",
              )}
            >
              <span
                className={cx(
                  "grid size-4 place-items-center rounded border",
                  r.on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300",
                )}
              >
                {r.on && (
                  <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m2.5 6.5 2.2 2L9.5 3.5" />
                  </svg>
                )}
              </span>
              <span className="flex-1">{r.text}</span>
              <span className="font-mono text-xs text-slate-500">+{r.marks}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
          <span className="font-semibold">Ruling:</span> predecessor instead of successor is equally correct; full marks.
        </div>
      </div>

      {/* AI suggestion */}
      <div className="relative z-10 -mt-6 ml-auto w-[78%] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-indigo-900/10 sm:-mr-4">
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
          <Sparkles className="size-3.5" /> AI suggestion · by Gemini
        </div>
        <div className="mt-1 flex items-end justify-between">
          <div className="font-mono text-xl font-semibold">
            9<span className="text-sm font-normal text-slate-400"> / 10</span>
          </div>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">sent to instructor</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Substitution method is valid but not named in the rubric, so the instructor decides once, for every TA.
        </p>
      </div>

      {/* Consistency chart */}
      <div className="-mt-4 w-[70%] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-indigo-900/10 sm:-ml-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <ChartColumn className="size-3.5" /> Q3 · TA average vs. everyone else
        </div>
        <div className="mt-3 space-y-2">
          {bars.map((b) => (
            <div key={b.name} className="flex items-center gap-2 text-xs">
              <span className="w-10 text-slate-600">{b.name}</span>
              <div className="relative h-2.5 flex-1">
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                <div
                  className={cx("absolute inset-y-0 rounded-sm", b.diff >= 0 ? "bg-emerald-400" : "bg-rose-400")}
                  style={b.diff >= 0 ? { left: "50%", width: `${b.diff * 16}%` } : { right: "50%", width: `${-b.diff * 16}%` }}
                />
              </div>
              <span className={cx("w-14 text-right font-medium", Math.abs(b.diff) > 2 ? "text-amber-700" : "text-slate-400")}>
                {Math.abs(b.diff) > 2 ? (b.diff > 0 ? "lenient" : "harsh") : "ok"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-lg text-pretty text-slate-600">{children}</p>}
    </div>
  );
}

function Problems() {
  const items = [
    {
      icon: <Users />,
      title: "Twelve TAs, twelve standards",
      text: "One rubric line like “explains well” gets read twelve ways. The same answer earns 3/5 from one grader and 5/5 from another.",
    },
    {
      icon: <Gavel />,
      title: "Edge cases decided alone",
      text: "Every TA meets the same unusual answer and makes their own call, at midnight, with no one to ask.",
    },
    {
      icon: <FileText />,
      title: "Cribs that hinge on paper",
      text: "Regrade requests stall while someone hunts for the physical answer sheet, and the original grader reviews their own mark.",
    },
  ];
  return (
    <section>
      <SectionHeading eyebrow="The problem" title="Large courses make grading a lottery">
        With descriptive answers and hundreds of students, who grades your paper can matter as much as what you wrote.
      </SectionHeading>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <div key={i.title} className="rounded-2xl border border-slate-200/80 bg-white/70 p-6">
            <div className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600 [&_svg]:size-5">{i.icon}</div>
            <h3 className="mt-4 font-semibold text-slate-900">{i.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{i.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <ClipboardCheck />, title: "Upload the rubric", text: "Paste it or upload a PDF. The AI splits it into checkable criteria and flags anything two TAs could read differently." },
    { icon: <ListChecks />, title: "Grade by ticking criteria", text: "TAs tick what the answer earns; the total adds itself. Scripts are allocated randomly so averages stay comparable." },
    { icon: <Camera />, title: "Unsure? Snap a photo", text: "The AI reads the answer, checks every criterion against the rubric and past rulings, and suggests marks with reasons." },
    { icon: <BookOpenCheck />, title: "Publish and settle cribs", text: "Students see marks, the rubric breakdown and their scanned sheet. Cribs go to a different TA with an AI pre-screen." },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-24">
      <SectionHeading eyebrow="How it works" title="From rubric to results, in four steps" />
      <ol className="relative mt-14 grid gap-8 md:grid-cols-4 md:gap-6">
        <div className="absolute top-6 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-indigo-200 via-indigo-300 to-amber-200 md:block" aria-hidden />
        {steps.map((s, i) => (
          <li key={s.title} className="relative text-center">
            <div className="relative mx-auto grid size-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-md ring-1 shadow-indigo-900/10 ring-slate-200 [&_svg]:size-5">
              {s.icon}
              <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-950">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: <Sparkles />,
      title: "AI doubt assistant",
      text: "Reads handwriting, judges each criterion with quoted evidence, and admits uncertainty. Low-confidence cases go to the instructor, never guessed.",
      wide: true,
    },
    {
      icon: <Gavel />,
      title: "Shared rulings",
      text: "Every decided edge case becomes a ruling shown to all TAs on that question, and followed by the AI from then on.",
    },
    {
      icon: <ChartColumn />,
      title: "Consistency dashboard",
      text: "Compares each TA's marks with everyone else's on the same question and flags significant gaps.",
    },
    {
      icon: <ScanLine />,
      title: "Scanned answer sheets",
      text: "One PDF per student, uploaded straight from the grading screen. Students and crib reviewers see exactly what was graded.",
    },
    {
      icon: <EyeOff />,
      title: "Blind grading & audit trail",
      text: "Hide names behind sheet codes. Every mark change is logged with who, when and why.",
      wide: true,
    },
  ];
  return (
    <section>
      <SectionHeading eyebrow="What's inside" title="Built to remove grader bias, not just record marks" />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className={cx(
              "group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/5",
              f.wide && "md:col-span-2",
            )}
          >
            <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white [&_svg]:size-5">
              {f.icon}
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Roles() {
  const roles = [
    {
      icon: <GraduationCap />,
      who: "Instructors",
      points: ["Upload the rubric once", "Decide escalated doubts", "Spot lenient or harsh TAs", "Publish, export, close"],
    },
    {
      icon: <ClipboardCheck />,
      who: "TAs",
      points: ["Your allocated answer sheets", "Tick criteria, totals add up", "Ask the AI when unsure", "See every ruling in place"],
    },
    {
      icon: <Users />,
      who: "Students",
      points: ["Marks with rubric breakdown", "Your scanned answer sheet", "Crib by citing a criterion", "A fresh reviewer every time"],
    },
  ];
  return (
    <section>
      <SectionHeading eyebrow="For everyone involved" title="One place for the whole grading team" />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {roles.map((r) => (
          <div key={r.who} className="rounded-2xl border border-slate-200/80 bg-white/70 p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700 [&_svg]:size-5">{r.icon}</div>
              <h3 className="font-display text-xl font-semibold text-slate-900">{r.who}</h3>
            </div>
            <ul className="mt-4 space-y-2">
              {r.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-indigo-500" /> {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function DemoBand() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 px-6 py-12 text-white sm:px-12">
      <div className="bg-dots-light absolute inset-0" aria-hidden />
      <div className="absolute -top-24 -right-16 size-72 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">See it with a real course</h2>
          <p className="mt-3 max-w-lg text-indigo-100">
            The demo has a 48-student DSA course with two exams, a lenient TA, a harsh TA, open doubts and a crib waiting for review.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login#demo"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-medium text-indigo-800 shadow-lg transition hover:bg-amber-50"
            >
              Open the demo <ArrowRight className="size-4" />
            </Link>
            <Link href="/register" className="inline-flex items-center rounded-lg px-5 py-2.5 font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
              Create your own course
            </Link>
          </div>
        </div>
        <ul className="grid gap-2 text-sm">
          {[
            ["Instructor", "Consistency dashboard, escalated doubts"],
            ["TA", "Grade, upload scans, ask the AI"],
            ["Student", "Results, scan, raise a crib"],
          ].map(([role, what]) => (
            <li key={role} className="flex items-center justify-between gap-4 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
              <span className="font-semibold">{role}</span>
              <span className="text-right text-indigo-100">{what}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
