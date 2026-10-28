import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  Gavel,
  GraduationCap,
  ScrollText,
  ListChecks,
  MessageSquareText,
  ScanLine,
  ShieldCheck,
  Smartphone,
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
      <Pillars />
      <Accountability />
      <HowItWorks />
      <Features />
      <MobileBand />
      <ClosingBand />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative grid items-center gap-12 pt-4 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-10">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs">
          <ShieldCheck className="size-3.5" /> The grading platform for university courses
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-slate-900 sm:text-6xl">
          Clear rubrics.
          <br />
          Accountable grading.
          <br />
          <span className="relative whitespace-nowrap text-indigo-600">
            Calmer cribs.
            <svg viewBox="0 0 300 12" className="absolute -bottom-2 left-0 h-3 w-full text-amber-400" preserveAspectRatio="none" aria-hidden>
              <path d="M2 9c60-6 140-8 296-4" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-pretty text-slate-600">
          FairGrade brings instructors, TAs and students onto one platform. Rubrics become checklists, an AI assistant helps with the
          tricky answers, every mark is explained and traceable, and regrade requests are settled with evidence instead of arguments.
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
          {["AI grading assistant", "Scanned answer sheets", "Complete audit trail"].map((t) => (
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

/** A static, illustrative mock: a student's marked answer, an AI suggestion and a grader report. */
function ProductPreview() {
  const rubric = [
    { text: "Handles the leaf case", marks: 2, on: true },
    { text: "Handles the one-child case by splicing", marks: 2, on: true },
    { text: "Two children via inorder successor or predecessor", marks: 3, on: true },
    { text: "States the complexity as O(h)", marks: 1, on: false },
  ];
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-200/60 via-white to-amber-100/70 blur-2xl" />
      <div className="bg-dots absolute -top-6 -right-4 -z-10 size-40 rounded-3xl" />

      {/* What the student sees */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-indigo-900/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Midsem · your result</div>
            <div className="font-semibold text-slate-900">Q1 · Binary search trees</div>
          </div>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            7<span className="text-sm font-normal text-slate-400"> / 8</span>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5">
          {rubric.map((r) => (
            <li
              key={r.text}
              className={cx("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm", r.on ? "bg-emerald-50 text-slate-800" : "text-slate-500")}
            >
              <span className={cx("grid size-4 place-items-center rounded border", r.on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>
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
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <MessageSquareText className="size-3.5 text-slate-400" />
          <span>
            <span className="font-semibold text-slate-700">Grader:</span> complexity missing, see your last line.
          </span>
        </div>
      </div>

      {/* AI suggestion */}
      <div className="relative z-10 -mt-6 ml-auto w-[78%] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-indigo-900/10 sm:-mr-4">
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
          <Sparkles className="size-3.5" /> AI grading assistant
        </div>
        <div className="mt-1 flex items-end justify-between">
          <div className="font-mono text-xl font-semibold">
            9<span className="text-sm font-normal text-slate-400"> / 10</span>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">high confidence</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">Each rubric criterion checked against the answer, with the evidence quoted.</p>
      </div>

      {/* Grader report */}
      <div className="-mt-4 w-[72%] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-indigo-900/10 sm:-ml-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <ChartColumn className="size-3.5" /> Grader report · this exam
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["98%", "marked by rubric"],
            ["2", "cribs upheld"],
            ["On par", "with team"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg bg-slate-50 px-2 py-2">
              <div className="text-sm font-semibold text-slate-900">{v}</div>
              <div className="text-[10px] leading-tight text-slate-500">{l}</div>
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

function Pillars() {
  const pillars = [
    {
      icon: <Users />,
      tone: "bg-amber-50 text-amber-700",
      who: "For students",
      title: "Know exactly where every mark went",
      points: [
        "A criterion-by-criterion breakdown of every answer",
        "Your scanned answer sheet and the grader’s comments",
        "Raise a crib in a minute, backed by the rubric",
      ],
    },
    {
      icon: <ClipboardCheck />,
      tone: "bg-indigo-50 text-indigo-700",
      who: "For TAs",
      title: "Support while grading, and ownership of the result",
      points: [
        "Tick rubric criteria; totals add themselves",
        "An AI assistant and shared rulings for tricky answers",
        "Your grading record speaks for itself",
      ],
    },
    {
      icon: <GraduationCap />,
      tone: "bg-emerald-50 text-emerald-700",
      who: "For instructors",
      title: "Oversight without the overhead",
      points: [
        "Decide escalated cases once, for every TA",
        "See consistency and crib outcomes per grader",
        "Publish, review and export from one place",
      ],
    },
  ];
  return (
    <section>
      <SectionHeading eyebrow="One platform, three roles" title="Everyone in the grading loop, on the same page">
        Grading involves more than the instructor and the student. FairGrade gives each person the tools and the visibility their part
        of the process needs.
      </SectionHeading>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {pillars.map((p) => (
          <div key={p.who} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
            <div className="flex items-center gap-3">
              <div className={cx("grid size-10 place-items-center rounded-xl [&_svg]:size-5", p.tone)}>{p.icon}</div>
              <span className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{p.who}</span>
            </div>
            <h3 className="mt-4 font-display text-xl leading-snug font-semibold text-slate-900">{p.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {p.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2 text-sm text-slate-700">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-indigo-500" /> {pt}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Accountability() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
      <div className="bg-dots absolute inset-y-0 right-0 w-1/3 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <div>
          <div className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">Accountability, both ways</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
            Most tools watch students. FairGrade looks at the grading too.
          </h2>
          <p className="mt-4 text-pretty text-slate-600">
            Every mark is tied to the rubric and every change is on record, so TAs grade carefully. And because students can see the
            reasoning behind their marks, cribs focus on real issues rather than half-marks.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-indigo-50/70 p-5 ring-1 ring-indigo-100">
            <div className="flex items-center gap-2 font-semibold text-indigo-900">
              <ClipboardCheck className="size-5 text-indigo-600" /> TAs grade with care
            </div>
            <ul className="mt-3 space-y-2 text-sm text-indigo-950/80">
              {[
                "Marks come from rubric criteria, not gut feel",
                "Overrides and edits are logged with a reason",
                "Consistency with other graders is measured",
                "Upheld cribs show up on the grader's record",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-indigo-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-amber-50/70 p-5 ring-1 ring-amber-100">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <MessageSquareText className="size-5 text-amber-600" /> Students crib with evidence
            </div>
            <ul className="mt-3 space-y-2 text-sm text-amber-950/80">
              {[
                "They see their answer sheet and the rubric first",
                "A crib must point to a specific criterion",
                "The AI pre-screens it against the scan",
                "A different TA reviews it, with a written reply",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-amber-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <BookOpenCheck />, title: "Set up the rubric", text: "Paste it or upload a PDF. The AI turns it into checkable criteria and points out anything open to interpretation." },
    { icon: <ListChecks />, title: "Grade by criteria", text: "TAs tick what each answer earns, upload the scanned sheet, and ask the AI or the team when an answer is unusual." },
    { icon: <Camera />, title: "Publish with reasons", text: "Students see marks, the criteria behind them, comments and their scanned answer sheet." },
    { icon: <MessageSquareText />, title: "Resolve cribs quickly", text: "Evidence-backed requests go to a fresh reviewer with an AI pre-screen, and the decision is explained." },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-24">
      <SectionHeading eyebrow="How it works" title="From rubric to resolved cribs, in four steps" />
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
      title: "AI grading assistant",
      text: "Photograph an answer you're unsure about. The AI reads the handwriting, checks every criterion with quoted evidence and suggests marks. It's honest about uncertainty, and hard cases go to the instructor.",
      wide: true,
    },
    {
      icon: <MessageSquareText />,
      title: "Effortless cribs",
      text: "Students raise a crib in a minute; reviewers get the scan, the cited criterion and an AI pre-screen in one view.",
    },
    {
      icon: <ScanLine />,
      title: "Scanned answer sheets",
      text: "One PDF per student, uploaded from the grading screen and visible to the student with their marks.",
    },
    {
      icon: <Gavel />,
      title: "Shared rulings",
      text: "Once an edge case is decided, every TA sees the ruling next to that question, and the AI follows it too.",
    },
    {
      icon: <ChartColumn />,
      title: "Grader insights",
      text: "See how each TA's marks compare with the team, how often they override the rubric and how their cribs turn out.",
    },
    {
      icon: <ScrollText />,
      title: "Audit trail & blind grading",
      text: "Every change is recorded with who, when and why. Optionally hide student names behind anonymous sheet codes.",
      wide: true,
    },
  ];
  return (
    <section>
      <SectionHeading eyebrow="What's inside" title="Everything a grading team needs">
        Built around how exams are really graded: on paper, by a team, under time pressure.
      </SectionHeading>
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

function MobileBand() {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-2">
      <div>
        <div className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">On the go</div>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
          Grade and scan from your phone
        </h2>
        <p className="mt-4 text-pretty text-slate-600">
          Grading happens wherever the answer sheets are. Use FairGrade in any mobile browser, or install the Android app to scan answer
          sheets with the camera and mark them on the spot.
        </p>
        <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
          {["Scan multi-page answer sheets into one clean PDF", "Large, touch-friendly rubric checklists", "Ask the AI from the photo you just took"].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto" aria-hidden>
        <div className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-br from-indigo-200/50 to-amber-100/60 blur-2xl" />
        <div className="w-64 rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
          <div className="overflow-hidden rounded-[1.5rem] bg-[#f7f7fb]">
            <div className="flex items-center justify-between bg-white px-4 py-3">
              <span className="font-display text-sm font-semibold">
                Fair<span className="text-indigo-600">Grade</span>
              </span>
              <Smartphone className="size-4 text-slate-400" />
            </div>
            <div className="space-y-2 p-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-[11px] font-semibold text-white">Q2</span>
                  <span className="font-mono text-sm font-semibold">
                    6<span className="text-[10px] text-slate-400">/10</span>
                  </span>
                </div>
                {["Writes the recurrence", "Solves with steps shown", "Final answer Θ(n log n)"].map((t, i) => (
                  <div key={t} className={cx("mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px]", i < 2 ? "bg-emerald-50" : "bg-slate-50 text-slate-500")}>
                    <span className={cx("size-3 rounded-sm", i < 2 ? "bg-emerald-500" : "border border-slate-300")} />
                    {t}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-[11px] font-medium text-white">
                <ScanLine className="size-3.5" /> Scan answer sheet
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[11px] font-medium text-indigo-700 shadow-sm">
                <Sparkles className="size-3.5" /> Ask the AI
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingBand() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 px-6 py-12 text-white sm:px-12">
      <div className="bg-dots-light absolute inset-0" aria-hidden />
      <div className="absolute -top-24 -right-16 size-72 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Bring clarity to your next exam</h2>
          <p className="mt-3 max-w-lg text-indigo-100">
            Explore a sample course with exams in progress, open grading questions and a crib waiting for review, from the instructor&rsquo;s,
            TA&rsquo;s or student&rsquo;s point of view.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login#demo"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-medium text-indigo-800 shadow-lg transition hover:bg-amber-50"
            >
              Open the demo <ArrowRight className="size-4" />
            </Link>
            <Link href="/register" className="inline-flex items-center rounded-lg px-5 py-2.5 font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
              Create your course
            </Link>
          </div>
        </div>
        <ul className="grid gap-2 text-sm">
          {[
            [<GraduationCap key="i" className="size-4" />, "Instructor", "Oversight, escalations, grader insights"],
            [<ClipboardCheck key="t" className="size-4" />, "TA", "Grade, scan, ask the AI"],
            [<Users key="s" className="size-4" />, "Student", "Results, answer sheet, cribs"],
          ].map(([icon, role, what]) => (
            <li key={role as string} className="flex items-center justify-between gap-4 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
              <span className="flex items-center gap-2 font-semibold">
                {icon} {role}
              </span>
              <span className="text-right text-indigo-100">{what}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
