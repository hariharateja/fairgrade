import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field } from "@/components/ui";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto mt-8 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Log in</h1>
      <p className="mb-6 text-sm text-slate-600">Fair, consistent grading for large courses.</p>
      <Card className="p-6">
        <ActionForm action={login} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton className="w-full" pendingText="Logging in…">
            Log in
          </SubmitButton>
        </ActionForm>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/register" className="font-medium text-indigo-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
