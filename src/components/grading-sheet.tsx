"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { Badge, Button, Card, Notice, cx } from "./ui";
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
      className="space-y-4"
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
        return (
          <Card key={q.id} className={cx(ungraded && editable && "border-l-4 border-l-amber-300")}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{q.label}</h3>
                  {q.grade && !e.touched && <Badge tone="green">Graded by {q.grade.graderName}</Badge>}
                  {e.touched && <Badge tone="amber">Unsaved</Badge>}
                  {q.openDoubts > 0 && <Badge tone="blue">Doubt open</Badge>}
                </div>
                {q.prompt && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{q.prompt}</p>}
              </div>
              <div className="text-right">
                <div className="font-mono text-xl font-semibold tabular-nums">
                  {fmt(totals[q.id])}
                  <span className="text-sm font-normal text-slate-400"> / {fmt(q.maxMarks)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_15rem]">
              <div className="space-y-1">
                {q.rubric.length === 0 && <p className="text-sm text-slate-500">No itemised rubric. Enter marks directly.</p>}
                {q.rubric.map((item) => {
                  const checked = e.applied.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={cx(
                        "flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 font-normal transition",
                        checked ? (item.marks < 0 ? "bg-red-50" : "bg-emerald-50") : "hover:bg-slate-50",
                        !editable && "cursor-default",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        disabled={!editable}
                        onChange={() =>
                          update(q.id, {
                            applied: checked ? e.applied.filter((x) => x !== item.id) : [...e.applied, item.id],
                          })
                        }
                      />
                      <span className="flex-1 text-sm text-slate-800">{item.description}</span>
                      <span className={cx("font-mono text-sm tabular-nums", item.marks < 0 ? "text-red-600" : "text-slate-600")}>
                        {item.marks > 0 ? "+" : ""}
                        {fmt(item.marks)}
                      </span>
                    </label>
                  );
                })}

                {q.rulings.length > 0 && (
                  <details className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2" open={q.rulings.length <= 2}>
                    <summary className="cursor-pointer text-sm font-medium text-indigo-900">
                      {q.rulings.length} staff ruling{q.rulings.length === 1 ? "" : "s"} for {q.label}
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-indigo-950">
                      {q.rulings.map((r) => (
                        <li key={r.id}>{r.text}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs">Override total</label>
                  <input
                    type="number"
                    step="0.25"
                    min={0}
                    max={q.maxMarks}
                    placeholder={`Rubric: ${fmt(rubricTotal(q, e.applied))}`}
                    value={e.override}
                    disabled={!editable}
                    onChange={(ev) => update(q.id, { override: ev.target.value })}
                  />
                  <p className="mt-1 text-xs text-slate-500">Leave empty to use the rubric. Overrides are flagged in reports.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs">Comment for student</label>
                  <textarea
                    rows={2}
                    value={e.comment}
                    disabled={!editable}
                    onChange={(ev) => update(q.id, { comment: ev.target.value })}
                  />
                </div>
                {editable && (
                  <Link href={q.doubtHref} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
                    Unsure? Ask the AI / team →
                  </Link>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {editable && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          {state?.error && (
            <div className="mb-2">
              <Notice tone="red">{state.error}</Notice>
            </div>
          )}
          {state?.ok && !dirty && (
            <div className="mb-2">
              <Notice tone="green">{state.ok}</Notice>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              Total{" "}
              <span className="font-mono text-lg font-semibold tabular-nums">
                {fmt(grandTotal)} / {fmt(grandMax)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {needsReason && <input name="reason" placeholder="Reason for change (required)" className="!w-64" required />}
              <SaveButtons nextHref={nextHref} pending={pending} />
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
        Save
      </Button>
      {nextHref && (
        <Button type="submit" name="next" value={nextHref} disabled={pending}>
          {pending ? "Saving…" : "Save & next →"}
        </Button>
      )}
    </>
  );
}
