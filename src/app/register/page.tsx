import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { register } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field } from "@/components/ui";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto mt-8 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 text-sm text-slate-600">
        One account for every course. You join a course as a student or TA with the code your instructor shares.
      </p>
      <Card className="p-6">
        <ActionForm action={register} className="space-y-4">
          <Field label="Full name" htmlFor="name">
            <input id="name" name="name" autoComplete="name" required />
          </Field>
          <Field label="Institute email" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Roll number" htmlFor="rollNo" hint="Students: required so your marks match your answer script.">
            <input id="rollNo" name="rollNo" placeholder="e.g. 22B0123" />
          </Field>
          <Field label="Password" htmlFor="password" hint="At least 8 characters.">
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <SubmitButton className="w-full" pendingText="Creating account…">
            Create account
          </SubmitButton>
        </ActionForm>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-indigo-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
