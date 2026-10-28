import Link from "next/link";
import { ChevronRight, LogOut, Mail, Sparkles, Hash } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL, type Role } from "@/lib/access";
import { aiMode, PROVIDER_LABEL } from "@/lib/ai-providers";
import { isAppMode } from "@/lib/app-mode";
import { logout } from "@/app/actions/auth";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";

export default async function AccountPage() {
  const user = await requireUser();
  const [memberships, app] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id }, include: { course: true }, orderBy: { createdAt: "desc" } }),
    isAppMode(),
  ]);
  const mode = aiMode();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {!app && <PageHeader title="Account" />}

      <Card className="flex flex-col items-center px-6 py-8 text-center">
        <Avatar name={user.name} className="!size-20 !text-2xl" />
        <h2 className="mt-3 font-display text-2xl font-semibold text-slate-900">{user.name}</h2>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" /> {user.email}
          </span>
          {user.rollNo && (
            <span className="inline-flex items-center gap-1.5">
              <Hash className="size-3.5" /> {user.rollNo}
            </span>
          )}
        </div>
      </Card>

      <section className="space-y-2.5">
        <h3 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">Your courses</h3>
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {memberships.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">You haven&rsquo;t joined a course yet.</p>}
          {memberships.map((m) => (
            <Link key={m.id} href={`/courses/${m.courseId}`} className="flex items-center gap-3 px-4 py-3.5 transition active:bg-slate-100 sm:px-5 sm:hover:bg-slate-50">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">{m.course.code}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{m.course.name}</span>
              <Badge tone={m.role === "STUDENT" ? "amber" : "indigo"}>{ROLE_LABEL[m.role as Role]}</Badge>
              <ChevronRight className="size-4 text-slate-300" />
            </Link>
          ))}
        </Card>
      </section>

      <section className="space-y-2.5">
        <h3 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">About</h3>
        <Card className="divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="flex items-center gap-2 text-slate-600">
              <Sparkles className="size-4 text-indigo-500" /> AI assistant
            </span>
            <span className="font-medium text-slate-900">{mode === "demo" ? "Demo mode" : PROVIDER_LABEL[mode]}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-slate-600">Version</span>
            <span className="font-medium text-slate-900">{app ? "Android app 1.0" : "Web"}</span>
          </div>
        </Card>
      </section>

      <form action={logout}>
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3.5 font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100">
          <LogOut className="size-4" /> Log out
        </button>
      </form>
    </div>
  );
}
