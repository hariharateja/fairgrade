import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam } from "@/lib/access";
import { histogram, mean, summarize, type GraderQuestionStat } from "@/lib/stats";
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, Stat, Table, cx } from "@/components/ui";
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Marks entered" value={grades.length} hint={`${new Set(grades.map((g) => g.studentId)).size} students`} />
        <Stat label="Possible biases" value={flags.length} hint="grader × question pairs flagged" />
        <Stat label="Manual overrides" value={`${Math.round((grades.filter((g) => g.manualOverride).length / grades.length) * 100)}%`} hint="of marks bypass the rubric" />
        <Stat label="Crib acceptance" value={totalCribs ? `${Math.round((acceptedCribs / totalCribs) * 100)}%` : "–"} hint={`${acceptedCribs} of ${totalCribs} cribs`} />
      </div>

      {flags.length > 0 ? (
        <Notice tone="amber">
          <div className="mb-1 font-medium">Graders whose marks differ significantly from everyone else&rsquo;s on the same question:</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {flags.map((f) => (
              <li key={`${f.graderId}-${f.questionId}`}>
                <strong>{nameOf.get(f.graderId)}</strong> on {questions.find((q) => q.id === f.questionId)?.label}:{" "}
                {f.flag === "lenient" ? "more lenient" : "harsher"} by {fmt(Math.abs(f.diff ?? 0))} marks on average (
                {fmt(Math.abs(f.effect ?? 0))} SD, n={f.n}). Consider spot-checking their scripts or adding a ruling.
              </li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice tone="green">No grader stands out on any question so far. Keep an eye on this as more scripts are graded.</Notice>
      )}

      <Card>
        <CardHeader title="Graders at a glance" description="Average marks as a share of each question's maximum, across everything they graded." />
        <Table>
          <thead>
            <tr>
              <th>Grader</th>
              <th>Scripts</th>
              <th className="w-1/4">Avg. score given</th>
              <th>Overrides</th>
              <th>Doubts raised</th>
              <th>Cribs (accepted)</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {graderRows.map((g) => (
              <tr key={g.id}>
                <td className="font-medium">{g.name}</td>
                <td className="tabular-nums">{g.scripts}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 flex-1 rounded-full bg-slate-100">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-500" style={{ width: `${g.avgPct * 100}%` }} />
                      <div className="absolute -inset-y-1 w-0.5 bg-slate-900" style={{ left: `${allPct * 100}%` }} title="Course average" />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums">{Math.round(g.avgPct * 100)}%</span>
                  </div>
                </td>
                <td className="tabular-nums">{Math.round(g.overrideRate * 100)}%</td>
                <td className="tabular-nums">{g.doubts}</td>
                <td className="tabular-nums">
                  {g.cribs}
                  {g.acceptRate !== null && <span className="text-slate-500"> ({Math.round(g.acceptRate * 100)}%)</span>}
                </td>
                <td>{g.flags > 0 ? <Badge tone="amber">{g.flags}</Badge> : <span className="text-slate-400">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <CardBody className="text-xs text-slate-500">
          The black tick is the average across all graders ({Math.round(allPct * 100)}%). A high crib-acceptance rate is another sign a grader
          was too strict.
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
        return (
          <Card key={q.id}>
            <CardHeader
              title={q.label}
              description={`${s.n} scripts · mean ${fmt(s.mean)} / ${fmt(q.maxMarks)} · SD ${fmt(s.sd)}`}
              action={
                <Link href={`/exams/${examId}/rulings`} className="text-sm text-indigo-700 hover:underline">
                  Rulings →
                </Link>
              }
            />
            <div className="grid gap-6 p-5 md:grid-cols-[14rem_1fr]">
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Distribution</div>
                <div className="flex h-24 items-end gap-0.5">
                  {hist.map((count, i) => (
                    <div key={i} className="flex-1 rounded-t bg-indigo-200" style={{ height: `${(count / peak) * 100}%` }} title={`${i} marks: ${count}`} />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>0</span>
                  <span>{fmt(q.maxMarks)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 font-medium">Grader</th>
                      <th className="pb-2 font-medium">n</th>
                      <th className="pb-2 font-medium">Mean</th>
                      <th className="w-2/5 pb-2 font-medium">vs. other graders</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
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
        <CardHeader title="How this works" />
        <CardBody className="space-y-2 text-sm text-slate-600">
          <p>
            Scripts are allocated randomly, so each grader&rsquo;s students are a fair sample of the class and their average on a question
            should match everyone else&rsquo;s. For every grader and question we compare the grader&rsquo;s marks with all other graders&rsquo;
            marks on that question (Welch&rsquo;s test).
          </p>
          <p>
            A pair is flagged when the grader has at least 5 scripts, the gap is at least half a standard deviation, and it&rsquo;s
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
    <tr className="border-t border-slate-100">
      <td className="py-2 font-medium">{name}</td>
      <td className="py-2 tabular-nums">{stat.n}</td>
      <td className="py-2 font-mono tabular-nums">{fmt(stat.mean)}</td>
      <td className="py-2">
        {stat.diff === null ? (
          <span className="text-xs text-slate-400">only grader</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative h-3 flex-1">
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
              <div
                className={cx("absolute inset-y-0.5 rounded-sm", diff >= 0 ? "bg-emerald-400" : "bg-rose-400", stat.flag && "ring-2 ring-amber-400")}
                style={diff >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
              />
            </div>
            <span className="w-14 text-right font-mono text-xs tabular-nums">
              {diff > 0 ? "+" : ""}
              {fmt(diff)}
            </span>
          </div>
        )}
      </td>
      <td className="py-2 text-right">
        {stat.flag ? (
          <Badge tone={stat.flag === "lenient" ? "green" : "red"}>{stat.flag}</Badge>
        ) : stat.pValue !== null ? (
          <span className="text-xs text-slate-400">p={stat.pValue < 0.001 ? "<0.001" : stat.pValue.toFixed(2)}</span>
        ) : null}
      </td>
    </tr>
  );
}
