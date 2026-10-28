"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, CircleCheck, Gavel, Minus, Save, Sparkles } from "lucide-react";
import { Badge, Button, Card, Notice, ScoreRing, cx } from "./ui";
import type { ActionResult, FormAction } from "./forms";

export type SheetQuestion = {
  id: string;
  label: string;
  maxMarks: number;
  prompt: string;
  rubric: { id: string; description: string; marks: number }[];
  rulings: { id: string; text: string }[];
  grade: { marks: number; applied: string[]; manualOverride: boolean; comment: string; graderName: string } | null;
  doubtHref: string;
  openDoubts: number;
};

type Entry = { applied: string[]; override: string; comment: string; touched: boolean };

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

function rubricTotal(q: SheetQuestion, applied: string[]) {
  const sum = q.rubric.filter((r) => applied.includes(r.id)).reduce((s, r) => s + r.marks, 0);
  return Math.min(q.maxMarks, Math.max(0, Math.round(sum * 100) / 100));
}

export function GradingSheet({
  action,
  questions,
  editable,
  needsReason,
  nextHref,
}: {
  action: FormAction;
  questions: SheetQuestion[];
  editable: boolean;
  needsReason: boolean;
  nextHref: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, undefined);
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        {
          applied: q.grade?.applied ?? [],
          override: q.grade?.manualOverride ? String(q.grade.marks) : "",
          comment: q.grade?.comment ?? "",
          touched: false,
        },
      ]),
    ),
  );

  // After a successful save the server re-renders with fresh grades; clear the unsaved flags.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      setEntries((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, touched: false }])));
    }
  }

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, touched: true } }));

  const totals = useMemo(
    () =>
      Object.fromEntries(
        questions.map((q) => {
          const e = entries[q.id];
          const override = e.override.trim();
          const value = override !== "" && Number.isFinite(Number(override)) ? Number(override) : rubricTotal(q, e.applied);
          return [q.id, Math.min(q.maxMarks, Math.max(0, value))];
        }),
      ),
    [entries, questions],
  );
  const grandTotal = questions.reduce((s, q) => s + totals[q.id], 0);
  const grandMax = questions.reduce((s, q) => s + q.maxMarks, 0);
  const dirty = Object.values(entries).some((e) => e.touched);
  const payload = JSON.stringify(questions.map((q) => ({ questionId: q.id, ...entries[q.id] })));

  return (
    <form
      className="space-y-5 pb-4"
      onSubmit={(e) => {
        // Submit manually: a plain form action would reset the DOM checkboxes after saving.
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="payload" value={payload} />

      {questions.map((q) => {
        const e = entries[q.id];
        const ungraded = !q.grade && !e.touched;
        const overridden = e.override.trim() !== "";
        const pct = q.maxMarks ? (totals[q.id] / q.maxMarks) * 100 : 0;
        return (
          <Card key={q.id} className={cx("overflow-hidden", ungraded && editable && "ring-2 ring-amber-200")}>
            <div className="flex items-start gap-4 px-5 pt-5 pb-4 sm:px-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 font-display text-base font-semibold text-white shadow-sm shadow-indigo-600/30">
                {q.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {q.grade && !e.touched && (
                    <Badge tone="green">
                      <CircleCheck className="mr-1 size-3" /> Graded by {q.grade.graderName}
                    </Badge>
                  )}
                  {ungraded && <Badge tone="amber">Not graded yet</Badge>}
                  {e.touched && <Badge tone="amber">Unsaved changes</Badge>}
                  {q.openDoubts > 0 && (
                    <Badge tone="blue">
                      <Sparkles className="mr-1 size-3" /> Doubt open
                    </Badge>
                  )}
                  {overridden && <Badge tone="slate">Total overridden</Badge>}
                </div>
                {q.prompt && <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-slate-700">{q.prompt}</p>}
              </div>
              <ScoreRing value={totals[q.id]} max={q.maxMarks} size={58} tone={overridden ? "amber" : pct >= 100 ? "green" : "indigo"} />
            </div>
            <div className="h-1 bg-slate-100">
              <div
                className={cx("h-full transition-all duration-500", overridden ? "bg-amber-400" : "bg-gradient-to-r from-indigo-500 to-emerald-400")}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="grid gap-5 px-5 py-5 sm:px-6 md:grid-cols-[1fr_16rem]">
              <div className="space-y-2">
                {q.rubric.length === 0 && <p className="text-sm text-slate-500">No itemised rubric. Enter marks in the override box.</p>}
                {q.rubric.map((item) => {
                  const checked = e.applied.includes(item.id);
                  const deduction = item.marks < 0;
                  return (
                    <label
                      key={item.id}
                      className={cx(
                        "group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 font-normal transition select-none",
                        editable ? "cursor-pointer" : "cursor-default",
                        checked
                          ? deduction
                            ? "border-rose-200 bg-rose-50/70"
                            : "border-emerald-200 bg-emerald-50/70"
                          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={checked}
                        disabled={!editable}
                        onChange={() =>
                          update(q.id, {
                            applied: checked ? e.applied.filter((x) => x !== item.id) : [...e.applied, item.id],
                          })
                        }
                      />
                      <span
                        className={cx(
                          "grid size-5 shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 peer-focus-visible:ring-offset-1",
                          checked
                            ? deduction
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white group-hover:border-indigo-300",
                        )}
                      >
                        {checked && (deduction ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />)}
                      </span>
                      <span className={cx("flex-1 text-sm", checked ? "text-slate-900" : "text-slate-700")}>{item.description}</span>
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
                          checked
                            ? deduction
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                            : deduction
                              ? "bg-rose-50 text-rose-500"
                              : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {item.marks > 0 ? "+" : ""}
                        {fmt(item.marks)}
                      </span>
                    </label>
                  );
                })}

                {q.rulings.length > 0 && (
                  <details className="group/r mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50" open={q.rulings.length <= 2}>
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-indigo-900">
                      <Gavel className="size-4 text-indigo-500" />
                      {q.rulings.length} staff ruling{q.rulings.length === 1 ? "" : "s"} for {q.label}
                      <ChevronDown className="ml-auto size-4 text-indigo-400 transition group-open/r:rotate-180" />
                    </summary>
                    <ul className="space-y-2 px-3.5 pb-3">
                      {q.rulings.map((r) => (
                        <li key={r.id} className="rounded-lg bg-white/80 px-3 py-2 text-sm leading-relaxed text-indigo-950 ring-1 ring-indigo-100">
                          {r.text}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <div className="space-y-4 rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Override total
                    <span className="font-mono font-normal normal-case">rubric {fmt(rubricTotal(q, e.applied))}</span>
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min={0}
                    max={q.maxMarks}
                    placeholder="Use rubric total"
                    value={e.override}
                    disabled={!editable}
                    onChange={(ev) => update(q.id, { override: ev.target.value })}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">Overrides are flagged in the consistency report.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase">Comment for student</label>
                  <textarea
                    rows={2}
                    value={e.comment}
                    placeholder="Optional"
                    disabled={!editable}
                    onChange={(ev) => update(q.id, { comment: ev.target.value })}
                  />
                </div>
                {editable && (
                  <Link
                    href={q.doubtHref}
                    className="flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    <Sparkles className="size-4" /> Unsure? Ask the AI
                  </Link>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {editable && (
        <div className="sticky bottom-3 z-20 [[data-app]_&]:bottom-[calc(4.75rem+env(safe-area-inset-bottom))]">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-xl shadow-indigo-950/10 backdrop-blur-xl sm:px-4">
            {state?.error && (
              <div className="mb-3">
                <Notice tone="red">{state.error}</Notice>
              </div>
            )}
            {state?.ok && !dirty && (
              <div className="mb-3">
                <Notice tone="green">{state.ok}</Notice>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ScoreRing value={grandTotal} max={grandMax} size={46} />
                <div className="leading-tight">
                  <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Total</div>
                  <div className="text-sm text-slate-600">
                    {dirty ? <span className="font-medium text-amber-700">Unsaved changes</span> : "All changes saved"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {needsReason && <input name="reason" placeholder="Reason for change (required)" className="!w-64" required />}
                <SaveButtons nextHref={nextHref} pending={pending} />
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function SaveButtons({ nextHref, pending }: { nextHref: string | null; pending: boolean }) {
  return (
    <>
      <Button type="submit" variant="secondary" disabled={pending}>
        <Save className="size-4" /> Save
      </Button>
      {nextHref && (
        <Button type="submit" name="next" value={nextHref} disabled={pending}>
          {pending ? "Saving…" : "Save & next"} <ArrowRight className="size-4" />
        </Button>
      )}
    </>
  );
}
