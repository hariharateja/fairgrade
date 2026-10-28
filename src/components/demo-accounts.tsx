"use client";

import { ClipboardCheck, GraduationCap, Users } from "lucide-react";

const ACCOUNTS = [
  { role: "Instructor", email: "instructor@demo.edu", icon: GraduationCap },
  { role: "TA", email: "rahul@demo.edu", icon: ClipboardCheck },
  { role: "Student", email: "student@demo.edu", icon: Users },
];

/** Fills the login form with a public demo account so evaluators can explore each role. */
export function DemoAccounts() {
  function fill(email: string) {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const passwordInput = document.getElementById("password") as HTMLInputElement | null;
    if (!emailInput || !passwordInput) return;
    emailInput.value = email;
    passwordInput.value = "password123";
    passwordInput.form?.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
  }
  return (
    <div id="demo" className="mt-7 scroll-mt-24 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="text-sm font-semibold text-amber-900">Exploring the demo?</div>
      <p className="mt-0.5 text-xs text-amber-800">Pick a role to fill in a demo account, then press Log in.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ACCOUNTS.map(({ role, email, icon: Icon }) => (
          <button
            key={role}
            type="button"
            onClick={() => fill(email)}
            className="flex flex-col items-center gap-1 rounded-xl border border-amber-200 bg-white px-2 py-2.5 text-xs font-medium text-slate-700 transition hover:border-amber-400 hover:bg-amber-50"
          >
            <Icon className="size-4 text-amber-600" />
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}
