import Link from "next/link";
import { ChevronRight, EyeOff } from "lucide-react";
import { db } from "@/lib/db";
import { requireExam, isModerator, isStaff, ROLE_LABEL } from "@/lib/access";
import { ExamTabs, type Tab } from "@/components/exam-tabs";
import { ExamStatusBadge } from "@/components/exam-status";
import { fmt } from "@/lib/utils";
import { isAppMode } from "@/lib/app-mode";

export default async function ExamLayout({ children, params }: LayoutProps<"/exams/[examId]">) {
  const { examId } = await params;
  const { user, exam, role } = await requireExam(examId);
  const base = `/exams/${examId}`;

  let tabs: Tab[] = [{ href: base, label: role === "STUDENT" ? "My results" : "Overview", icon: role === "STUDENT" ? "results" : "overview", exact: true }];
  if (isStaff(role)) {
    const [escalated, myCribs] = await Promise.all([
      isModerator(role) ? db.doubt.count({ where: { examId, status: "ESCALATED" } }) : Promise.resolve(0),
      db.crib.count({ where: { examId, status: "OPEN", reviewerId: user.id } }),
    ]);
    tabs = [
      ...tabs,
      { href: `${base}/rubric`, label: "Rubric", icon: "rubric" },
      { href: `${base}/grade`, label: "Grade", icon: "grade" },
      { href: `${base}/doubts`, label: "Doubts", icon: "doubts", count: escalated },
      { href: `${base}/rulings`, label: "Rulings", icon: "rulings" },
      { href: `${base}/cribs`, label: "Cribs", icon: "cribs", count: myCribs },
      ...(isModerator(role) ? [{ href: `${base}/analytics`, label: "Consistency", icon: "consistency" } as Tab] : []),
    ];
  }

  if (await isAppMode()) {
    // The app's top bar already handles navigation, so keep the exam header compact.
    return (
      <>
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-3 -mt-4 mb-4 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <span className="truncate font-display text-lg font-semibold text-slate-900">{exam.title}</span>
            <ExamStatusBadge status={exam.status} student={role === "STUDENT"} />
            <span className="ml-auto shrink-0 text-xs text-slate-500">{exam.course.code}</span>
          </div>
          {tabs.length > 1 && <ExamTabs tabs={tabs} />}
        </div>
        {children}
      </>
    );
  }

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <div className="relative px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-400 to-amber-400" aria-hidden />
          <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900">
              Courses
            </Link>
            <ChevronRight className="size-3.5 text-slate-300" />
            <Link href={`/courses/${exam.courseId}`} className="hover:text-slate-900">
              <span className="font-mono text-xs font-semibold">{exam.course.code}</span> {exam.course.name}
            </Link>
          </nav>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">{exam.title}</h1>
            <ExamStatusBadge status={exam.status} student={role === "STUDENT"} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>{fmt(exam.totalMarks)} marks</span>
            <span className="text-slate-300">•</span>
            <span>You&rsquo;re {role === "INSTRUCTOR" ? "the instructor" : role === "STUDENT" ? "a student" : `a ${ROLE_LABEL[role]}`}</span>
            {exam.blindGrading && isStaff(role) && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <EyeOff className="size-3.5" /> Blind grading
                </span>
              </>
            )}
          </div>
        </div>
        {tabs.length > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50">
            <ExamTabs tabs={tabs} />
          </div>
        )}
      </div>
      {children}
    </>
  );
}
