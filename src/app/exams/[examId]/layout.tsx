import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam, isModerator, isStaff } from "@/lib/access";
import { ExamTabs, type Tab } from "@/components/exam-tabs";
import { ExamStatusBadge } from "@/components/exam-status";
import { fmt } from "@/lib/utils";

export default async function ExamLayout({ children, params }: LayoutProps<"/exams/[examId]">) {
  const { examId } = await params;
  const { user, exam, role } = await requireExam(examId);
  const base = `/exams/${examId}`;

  let tabs: Tab[] = [{ href: base, label: role === "STUDENT" ? "My results" : "Overview", exact: true }];
  if (isStaff(role)) {
    const [escalated, myCribs] = await Promise.all([
      isModerator(role) ? db.doubt.count({ where: { examId, status: "ESCALATED" } }) : Promise.resolve(0),
      db.crib.count({ where: { examId, status: "OPEN", reviewerId: user.id } }),
    ]);
    tabs = [
      ...tabs,
      { href: `${base}/rubric`, label: "Rubric" },
      { href: `${base}/grade`, label: "Grade" },
      { href: `${base}/doubts`, label: "Doubts", count: escalated },
      { href: `${base}/rulings`, label: "Rulings" },
      { href: `${base}/cribs`, label: "Cribs", count: myCribs },
      ...(isModerator(role) ? [{ href: `${base}/analytics`, label: "Consistency" }] : []),
    ];
  }

  return (
    <>
      <div className="mb-6">
        <div className="mb-1 text-sm text-slate-500">
          <Link href={`/courses/${exam.courseId}`} className="hover:underline">
            <span className="font-mono">{exam.course.code}</span> {exam.course.name}
          </Link>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{exam.title}</h1>
          <ExamStatusBadge status={exam.status} />
          <span className="text-sm text-slate-500">{fmt(exam.totalMarks)} marks</span>
          {exam.blindGrading && isStaff(role) && (
            <span className="text-xs text-slate-500">· Blind grading on</span>
          )}
        </div>
        {tabs.length > 1 && <ExamTabs tabs={tabs} />}
      </div>
      {children}
    </>
  );
}
