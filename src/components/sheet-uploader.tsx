"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishSheetUpload, startSheetUpload } from "@/app/actions/sheets";
import { FileText, Upload } from "lucide-react";
import { Badge, Button, IconTile, cx } from "./ui";

type Sheet = { id: string; sizeBytes: number; uploadedBy: string; updatedAt: string } | null;

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
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

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
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 sm:px-5",
        sheet ? "border-slate-200/80 bg-white" : "border-dashed border-amber-300 bg-amber-50/60",
      )}
    >
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
              : "Scan the whole answer sheet as one PDF. The student sees it with their marks, and crib reviewers use it instead of the paper copy."}
          </p>
          {message && <p className={cx("mt-1 text-sm", message.tone === "error" ? "text-red-600" : "text-emerald-700")}>{message.text}</p>}
          {progress !== null && (
            <div className="mt-2 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {sheet && (
          <a
            href={`/api/sheets/${sheet.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-indigo-700 hover:underline"
          >
            Open PDF
          </a>
        )}
        {editable && (
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant={sheet ? "secondary" : "primary"}
              disabled={progress !== null}
              onClick={() => input.current?.click()}
            >
              {progress === null && <Upload className="size-3.5" />}
              {progress !== null ? `Uploading ${progress}%` : sheet ? "Replace" : "Upload PDF"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
