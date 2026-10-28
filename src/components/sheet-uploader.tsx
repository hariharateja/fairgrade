"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Plus, ScanLine, Upload, X } from "lucide-react";
import { finishSheetUpload, startSheetUpload } from "@/app/actions/sheets";
import { isNativeApp, pagesToPdf, photoToPage, scanWithDocumentScanner } from "@/lib/scan";
import { Badge, Button, IconTile, cx } from "./ui";

type Sheet = { id: string; sizeBytes: number; uploadedBy: string; updatedAt: string } | null;
type Page = { blob: Blob; url: string };

function mb(bytes: number) {
  if (bytes < 1024) return "<1 KB";
  return bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

/** PUT with progress events (fetch has no upload progress). */
function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(file);
  });
}

export function SheetUploader({
  examId,
  studentId,
  sheet,
  editable,
}: {
  examId: string;
  studentId: string;
  sheet: Sheet;
  editable: boolean;
}) {
  const router = useRouter();
  const pdfInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  // Browser scanning: pages captured so far (null = scanner closed).
  const [pages, setPages] = useState<Page[] | null>(null);
  const pageUrls = useRef<string[]>([]);

  // Free the page previews when the component goes away.
  useEffect(() => () => pageUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function upload(file: File) {
    setMessage(null);
    setProgress(0);
    try {
      const start = await startSheetUpload(examId, studentId, file.size, file.type);
      if ("error" in start) throw new Error(start.error);
      await putWithProgress(start.target.url, file, start.target.headers, setProgress);
      const done = await finishSheetUpload(examId, studentId, start.name);
      if (done.error) throw new Error(done.error);
      setMessage({ tone: "ok", text: done.ok ?? "Uploaded." });
      setPages(null);
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setProgress(null);
      if (pdfInput.current) pdfInput.current.value = "";
    }
  }

  async function startScan() {
    setMessage(null);
    if (!isNativeApp()) {
      setPages([]);
      cameraInput.current?.click();
      return;
    }
    try {
      setBusy("Opening scanner…");
      const pdf = await scanWithDocumentScanner();
      setBusy(null);
      if (pdf) await upload(pdf);
    } catch (error) {
      setBusy(null);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Scanning failed." });
    }
  }

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    setBusy("Cleaning up the page…");
    try {
      const added = await Promise.all(
        files.map(async (f) => {
          const blob = await photoToPage(f);
          const url = URL.createObjectURL(blob);
          pageUrls.current.push(url);
          return { blob, url };
        }),
      );
      setPages((prev) => [...(prev ?? []), ...added]);
    } catch {
      setMessage({ tone: "error", text: "Couldn't read that photo. Try again." });
    } finally {
      setBusy(null);
      if (cameraInput.current) cameraInput.current.value = "";
    }
  }

  async function finishScan() {
    if (!pages?.length) return;
    setBusy("Building the PDF…");
    try {
      const pdf = await pagesToPdf(pages.map((p) => p.blob));
      setBusy(null);
      await upload(pdf);
    } catch {
      setBusy(null);
      setMessage({ tone: "error", text: "Couldn't build the PDF. Try again." });
    }
  }

  const working = progress !== null || busy !== null;

  return (
    <div
      className={cx(
        "rounded-2xl border px-4 py-3.5 sm:px-5",
        sheet ? "border-slate-200/80 bg-white" : "border-dashed border-amber-300 bg-amber-50/60",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconTile tone={sheet ? "green" : "amber"}>
            <FileText />
          </IconTile>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">Scanned answer sheet</span>
              {sheet ? <Badge tone="green">Uploaded</Badge> : <Badge tone="amber">Missing</Badge>}
            </div>
            <p className="text-sm text-slate-600">
              {sheet
                ? `${mb(sheet.sizeBytes)} · by ${sheet.uploadedBy} · ${new Date(sheet.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                : "Scan every page into one PDF. The student sees it with their marks, and crib reviewers use it instead of the paper copy."}
            </p>
            {message && (
              <p className={cx("mt-1 text-sm", message.tone === "error" ? "text-red-600" : "text-emerald-700")}>{message.text}</p>
            )}
            {busy && <p className="mt-1 text-sm text-indigo-700">{busy}</p>}
            {progress !== null && (
              <div className="mt-2 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          {sheet && (
            <a
              href={`/api/sheets/${sheet.id}`}
              target="_blank"
              rel="noreferrer"
              className="px-1 text-sm font-medium text-indigo-700 hover:underline"
            >
              Open PDF
            </a>
          )}
          {editable && pages === null && (
            <>
              <input
                ref={pdfInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                }}
              />
              <Button type="button" size="sm" variant="secondary" disabled={working} onClick={() => pdfInput.current?.click()}>
                <Upload className="size-3.5" /> {progress !== null ? `Uploading ${progress}%` : "Upload PDF"}
              </Button>
              <Button type="button" size="sm" variant={sheet ? "secondary" : "primary"} disabled={working} onClick={startScan}>
                <ScanLine className="size-3.5" /> {sheet ? "Rescan" : "Scan"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hidden camera input for browser scanning: one photo per page. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => addPhotos(Array.from(e.target.files ?? []))}
      />

      {pages !== null && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-indigo-900">
              {pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"} scanned` : "Photograph the first page"}
            </span>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-500 hover:bg-white hover:text-slate-800"
              onClick={() => setPages(null)}
            >
              <X className="size-4" /> Cancel
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pages.map((p, i) => (
              <div key={p.url} className="relative shrink-0 pt-1.5 pr-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Page ${i + 1}`} className="h-28 rounded-lg border border-slate-200 bg-white object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 text-[10px] font-medium text-white">{i + 1}</span>
                <button
                  type="button"
                  aria-label={`Remove page ${i + 1}`}
                  onClick={() => setPages((prev) => (prev ?? []).filter((x) => x !== p))}
                  className="absolute top-0 right-0 grid size-5 place-items-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 hover:text-red-600"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={working}
              onClick={() => cameraInput.current?.click()}
              className="mt-1.5 grid h-28 w-20 shrink-0 place-items-center rounded-lg border-2 border-dashed border-indigo-200 bg-white text-indigo-600 transition hover:border-indigo-400 disabled:opacity-50"
            >
              <span className="flex flex-col items-center gap-1 text-xs font-medium">
                {pages.length ? <Plus className="size-5" /> : <Camera className="size-5" />}
                {pages.length ? "Next page" : "Camera"}
              </span>
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" size="sm" disabled={!pages.length || working} onClick={finishScan}>
              <Upload className="size-3.5" />
              {progress !== null ? `Uploading ${progress}%` : `Upload ${pages.length || ""} page${pages.length === 1 ? "" : "s"} as PDF`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
