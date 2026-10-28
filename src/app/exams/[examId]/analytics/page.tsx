import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam } from "@/lib/access";
import { histogram, mean, summarize, type GraderQuestionStat } from "@/lib/stats";
import { ClipboardCheck, Gavel, Info, MessageSquareText, PencilLine, TriangleAlert, Users } from "lucide-react";
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, Notice, Stat, Table, cx } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default async function AnalyticsPage({ params }: PageProps<"/exams/[examId]/analytics">) {
  const { examId } = await params;
  const { exam } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA"]);

  const [questions, grades, graders, doubts, cribs] = await Promise.all([
    db.question.findMany({ where: { examId }, orderBy: { order: "asc" } }),
    db.grade.findMany({ where: { examId }, select: { questionId: true, graderId: true, marks: true, manualOverride: true, studentId: true } }),
    db.membership.findMany({
      where: { courseId: exam.courseId, role: { not: "STUDENT" } },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.doubt.groupBy({ by: ["raisedById"], where: { examId }, _count: true }),
    db.crib.findMany({ where: { examId }, select: { status: true, grade: { select: { graderId: true } } } }),
  ]);

  if (grades.length === 0) {
    return <EmptyState title="No marks yet">Consistency stats appear once TAs start grading.</EmptyState>;
  }

  const nameOf = new Map(graders.map((g) => [g.userId, g.user.name]));
  const maxOf = new Map(questions.map((q) => [q.id, q.maxMarks]));
  const summaries = summarize(grades, questions.map((q) => q.id));
  const flags = summaries.flatMap((s) => s.graders.filter((g) => g.flag));

  // Per-grader overview across all questions, as a percentage of each question's max.
  const allPct = mean(grades.map((g) => g.marks / (maxOf.get(g.questionId) || 1)));
  const graderRows = [...new Set(grades.map((g) => g.graderId))]
    .map((id) => {
      const mine = grades.filter((g) => g.graderId === id);
      const myCribs = cribs.filter((c) => c.grade.graderId === id);
      const decided = myCribs.filter((c) => c.status !== "OPEN");
      const accepted = myCribs.filter((c) => c.status === "ACCEPTED").length;
      return {
        id,
        name: nameOf.get(id) ?? "Former staff",
        scripts: new Set(mine.map((g) => g.studentId)).size,
        avgPct: mean(mine.map((g) => g.marks / (maxOf.get(g.questionId) || 1))),
        overrideRate: mine.filter((g) => g.manualOverride).length / mine.length,
        doubts: doubts.find((d) => d.raisedById === id)?._count ?? 0,
        cribs: myCribs.length,
        acceptRate: decided.length ? accepted / decided.length : null,
        flags: flags.filter((f) => f.graderId === id).length,
      };
    })
    .sort((a, b) => b.avgPct - a.avgPct);

  const totalCribs = cribs.length;
  const acceptedCribs = cribs.filter((c) => c.status === "ACCEPTED").length;

  const questionLabel = (id: string) => questions.find((q) => q.id === id)?.label ?? "?";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<ClipboardCheck />} label="Marks entered" value={grades.length} hint={`${new Set(grades.map((g) => g.studentId)).size} students`} />
        <Stat icon={<TriangleAlert />} label="Possible biases" value={flags.length} hint="grader × question pairs" />
        <Stat
          icon={<PencilLine />}
          label="Manual overrides"
          value={`${Math.round((grades.filter((g) => g.manualOverride).length / grades.length) * 100)}%`}
          hint="of marks bypass the rubric"
        />
        <Stat
          icon={<MessageSquareText />}
          label="Crib acceptance"
          value={totalCribs ? `${Math.round((acceptedCribs / totalCribs) * 100)}%` : "–"}
          hint={`${acceptedCribs} of ${totalCribs} cribs`}
        />
      </div>

      {flags.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            <TriangleAlert className="size-4 text-amber-500" /> Needs a closer look
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {flags.map((f) => {
              const lenient = f.flag === "lenient";
              return (
                <div
                  key={`${f.graderId}-${f.questionId}`}
                  className={cx(
                    "flex items-start gap-3 rounded-2xl border bg-white p-4",
                    lenient ? "border-emerald-200" : "border-rose-200",
                  )}
                >
                  <Avatar name={nameOf.get(f.graderId) ?? "?"} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{nameOf.get(f.graderId)}</span>
                      <Badge tone={lenient ? "green" : "red"}>{lenient ? "More lenient" : "Harsher"}</Badge>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
                        {questionLabel(f.questionId)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      <span className={cx("font-mono font-semibold", lenient ? "text-emerald-700" : "text-rose-700")}>
                        {lenient ? "+" : "−"}
                        {fmt(Math.abs(f.diff ?? 0))} marks
                      </span>{" "}
                      vs. other graders on average · {fmt(Math.abs(f.effect ?? 0))} SD · {f.n} answer sheets
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Spot-check a few of their answer sheets, or add a ruling for this question.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <Notice tone="green">No grader stands out on any question so far. Keep an eye on this as more answer sheets are graded.</Notice>
      )}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Users className="size-4 text-indigo-500" /> Graders at a glance
            </span>
          }
          description="Average marks as a share of each question's maximum, across everything they graded."
        />
        <Table>
          <thead>
            <tr>
              <th>Grader</th>
              <th>Answer sheets</th>
              <th className="w-1/3">Avg. score given</th>
              <th>Overrides</th>
              <th>Doubts</th>
              <th>Cribs (accepted)</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {graderRows.map((g) => {
              const delta = g.avgPct - allPct;
              return (
                <tr key={g.id}>
                  <td>
                    <span className="flex items-center gap-2.5 font-medium">
                      <Avatar name={g.name} size="sm" /> {g.name}
                    </span>
                  </td>
                  <td className="tabular-nums">{g.scripts}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="relative h-2.5 flex-1 rounded-full bg-slate-100">
                        <div
                          className={cx(
                            "absolute inset-y-0 left-0 rounded-full",
                            Math.abs(delta) < 0.05 ? "bg-indigo-400" : delta > 0 ? "bg-emerald-400" : "bg-rose-400",
                          )}
                          style={{ width: `${g.avgPct * 100}%` }}
                        />
                        <div className="absolute -inset-y-1 w-0.5 rounded bg-slate-900" style={{ left: `${allPct * 100}%` }} title="Average across all graders" />
                      </div>
                      <span className="w-10 text-right font-mono text-xs tabular-nums">{Math.round(g.avgPct * 100)}%</span>
                    </div>
                  </td>
                  <td className="tabular-nums">{Math.round(g.overrideRate * 100)}%</td>
                  <td className="tabular-nums">{g.doubts}</td>
                  <td className="tabular-nums">
                    {g.cribs}
                    {g.acceptRate !== null && <span className="text-slate-500"> ({Math.round(g.acceptRate * 100)}%)</span>}
                  </td>
                  <td>{g.flags > 0 ? <Badge tone="amber">{g.flags}</Badge> : <span className="text-slate-300">–</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <CardBody className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded bg-slate-900" /> Average across all graders ({Math.round(allPct * 100)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-400" /> above
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-400" /> below
          </span>
          <span>A high crib-acceptance rate is another sign a grader was too strict.</span>
        </CardBody>
      </Card>

      {summaries.map((s) => {
        const q = questions.find((x) => x.id === s.questionId)!;
        if (s.n === 0) return null;
        const hist = histogram(
          grades.filter((g) => g.questionId === q.id).map((g) => g.marks),
          q.maxMarks + 1,
        );
        const peak = Math.max(...hist, 1);
        const questionFlags = s.graders.filter((g) => g.flag).length;
        return (
          <Card key={q.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 font-display font-semibold text-indigo-700">{q.label}</span>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    {s.n} answer sheets
                    {questionFlags > 0 && <Badge tone="amber">{questionFlags} flagged</Badge>}
                  </div>
                  <div className="text-sm text-slate-500">
                    Mean <span className="font-mono font-medium text-slate-700">{fmt(s.mean)}</span> / {fmt(q.maxMarks)} · SD{" "}
                    <span className="font-mono font-medium text-slate-700">{fmt(s.sd)}</span>
                  </div>
                </div>
              </div>
              <Link href={`/exams/${examId}/rulings`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
                <Gavel className="size-4" /> Rulings
              </Link>
            </div>
            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[15rem_1fr]">
              <div>
                <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Distribution of marks</div>
                <div className="relative flex h-28 items-end gap-1 border-b border-slate-200 pb-px">
                  {hist.map((count, i) => (
                    <div
                      key={i}
                      className="group relative flex-1 rounded-t-md bg-gradient-to-t from-indigo-400 to-indigo-300 transition hover:from-indigo-600 hover:to-indigo-400"
                      style={{ height: `${Math.max((count / peak) * 100, count ? 6 : 2)}%` }}
                      title={`${i} marks: ${count} student${count === 1 ? "" : "s"}`}
                    />
                  ))}
                  <div
                    className="absolute -top-1 bottom-0 w-0.5 bg-amber-500"
                    style={{ left: `${((s.mean + 0.5) / Math.max(hist.length, 1)) * 100}%` }}
                    title={`Mean ${fmt(s.mean)}`}
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
                  <span>0</span>
                  <span className="text-amber-600">mean {fmt(s.mean)}</span>
                  <span>{fmt(q.maxMarks)}</span>
                </div>
              </div>
              <div className="min-w-0 overflow-x-auto">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <span>Grader vs. everyone else</span>
                  <span className="hidden font-normal tracking-normal normal-case sm:inline">
                    <span className="text-rose-500">← harsher</span> · <span className="text-emerald-600">more lenient →</span>
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {s.graders.map((g) => (
                      <GraderRow key={g.graderId} stat={g} name={nameOf.get(g.graderId) ?? "Former staff"} max={q.maxMarks} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Info className="size-4 text-indigo-500" /> How this works
            </span>
          }
        />
        <CardBody className="grid gap-4 text-sm leading-relaxed text-slate-600 md:grid-cols-2">
          <p>
            Answer sheets are allocated randomly, so each grader&rsquo;s students are a fair sample of the class and their average on a question
            should match everyone else&rsquo;s. For every grader and question we compare the grader&rsquo;s marks with all other graders&rsquo;
            marks on that question (Welch&rsquo;s test).
          </p>
          <p>
            A pair is flagged when the grader has at least 5 answer sheets, the gap is at least half a standard deviation, and it&rsquo;s
            statistically significant (p &lt; 0.05). A flag is a prompt to look closer, not proof of bias.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function GraderRow({ stat, name, max }: { stat: GraderQuestionStat; name: string; max: number }) {
  const diff = stat.diff ?? 0;
  // Diverging bar centred on zero; full width = 25% of the question's max marks.
  const width = Math.min(50, (Math.abs(diff) / (max * 0.25)) * 50);
  return (
    <tr className="border-t border-slate-100 first:border-t-0">
      <td className="py-2.5 pr-3">
        <span className="flex items-center gap-2 font-medium whitespace-nowrap">
          <Avatar name={name} size="sm" /> {name}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-xs whitespace-nowrap text-slate-500">
        n={stat.n} · <span className="font-mono text-slate-700">{fmt(stat.mean)}</span>
      </td>
      <td className="w-1/2 py-2.5">
        {stat.diff === null ? (
          <span className="text-xs text-slate-400">only grader</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative h-3.5 flex-1 rounded-full bg-slate-50">
              <div className="absolute -inset-y-0.5 left-1/2 w-px bg-slate-300" />
              <div
                className={cx(
                  "absolute inset-y-0.5 rounded-full",
                  diff >= 0 ? "bg-gradient-to-r from-emerald-300 to-emerald-500" : "bg-gradient-to-l from-rose-300 to-rose-500",
                  stat.flag && "ring-2 ring-amber-400 ring-offset-1",
                )}
                style={diff >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
              />
            </div>
            <span className={cx("w-12 text-right font-mono text-xs font-semibold tabular-nums", diff > 0 ? "text-emerald-700" : diff < 0 ? "text-rose-700" : "text-slate-500")}>
              {diff > 0 ? "+" : ""}
              {fmt(diff)}
            </span>
          </div>
        )}
      </td>
      <td className="py-2.5 pl-3 text-right">
        {stat.flag ? (
          <Badge tone={stat.flag === "lenient" ? "green" : "red"}>{stat.flag}</Badge>
        ) : stat.pValue !== null ? (
          <span className="text-xs text-slate-400">p={stat.pValue < 0.001 ? "<0.001" : stat.pValue.toFixed(2)}</span>
        ) : null}
      </td>
    </tr>
  );
}
