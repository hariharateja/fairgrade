import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { aiMode, PROVIDER_LABEL } from "@/lib/ai-providers";
import { logout } from "@/app/actions/auth";
import { Badge } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FairGrade",
  description: "Consistent, rubric-driven grading for large courses, with an AI assistant for grading doubts.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const mode = aiMode();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="grid size-7 place-items-center rounded-md bg-indigo-600 text-sm text-white">F</span>
              FairGrade
            </Link>
            <div className="flex items-center gap-3 text-sm">
              {user && (
                <Badge tone={mode === "demo" ? "amber" : "slate"} className="hidden sm:inline-flex">
                  {mode === "demo" ? "AI demo mode" : `AI: ${PROVIDER_LABEL[mode]}`}
                </Badge>
              )}
              {user && (
                <>
                  <span className="hidden text-slate-600 sm:inline">{user.name}</span>
                  <form action={logout}>
                    <button className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">Log out</button>
                  </form>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
