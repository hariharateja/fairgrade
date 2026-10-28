import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { register } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for every course. Join as a student or TA with the code your instructor shares."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-indigo-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <ActionForm action={register} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name">
            <input id="name" name="name" autoComplete="name" required />
          </Field>
          <Field label="Roll number" htmlFor="rollNo" hint="Students: must match your answer sheet.">
            <input id="rollNo" name="rollNo" placeholder="e.g. 22B0123" />
          </Field>
        </div>
        <Field label="Institute email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@iitb.ac.in" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full !py-2.5" pendingText="Creating account…">
          Create account
        </SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
