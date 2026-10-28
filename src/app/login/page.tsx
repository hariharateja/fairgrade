import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { DemoAccounts } from "@/components/demo-accounts";
import { Field } from "@/components/ui";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to grade, review or check your results."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-indigo-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <ActionForm action={login} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@iitb.ac.in" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full !py-2.5" pendingText="Logging in…">
          Log in
        </SubmitButton>
      </ActionForm>
      <DemoAccounts />
    </AuthShell>
  );
}
