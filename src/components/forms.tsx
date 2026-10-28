"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Notice, type ButtonVariant } from "./ui";

export type ActionResult = { error?: string; ok?: string; notes?: string[] } | void | undefined;
export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/** A form bound to a server action that shows the action's error or success message. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && (
        <div className="mb-3">
          <Notice tone="red">{state.error}</Notice>
        </div>
      )}
      {state?.ok && (
        <div className="mb-3">
          <Notice tone="green">{state.ok}</Notice>
        </div>
      )}
      {state?.notes && state.notes.length > 0 && (
        <div className="mb-3">
          <Notice tone="amber">
            <ul className="list-disc space-y-1 pl-4">
              {state.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}
      {children}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  confirm,
}: {
  children: ReactNode;
  pendingText?: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
      name={name}
      value={value}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      )}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}

const MAX_EDGE = 1600;
// Hosting platforms cap request bodies (Vercel: ~4.5 MB), so photos are shrunk on the device first.
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/** Downscales a photo to a ~200-500 KB JPEG. Returns the original if the browser can't decode it. */
async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** File input for answer photos. On phones it offers the camera or the gallery. */
export function PhotoInput({ name = "photos", required = false }: { name?: string; required?: boolean }) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<{ busy: boolean; error?: string }>({ busy: false });
  return (
    <div className="space-y-2">
      <input
        type="file"
        name={name}
        accept="image/*"
        multiple
        required={required}
        onChange={async (e) => {
          const input = e.currentTarget;
          const original = Array.from(input.files ?? []);
          previews.forEach((url) => URL.revokeObjectURL(url));
          setPreviews([]);
          if (!original.length) return setStatus({ busy: false });
          setStatus({ busy: true });
          const compressed = await Promise.all(original.map(compressPhoto));
          const transfer = new DataTransfer();
          compressed.forEach((f) => transfer.items.add(f));
          input.files = transfer.files;
          setPreviews(compressed.map((f) => URL.createObjectURL(f)));
          const total = compressed.reduce((sum, f) => sum + f.size, 0);
          if (total > MAX_TOTAL_BYTES) {
            input.value = "";
            setPreviews([]);
            setStatus({ busy: false, error: "These photos are too large to upload together. Try fewer pages at a time." });
          } else {
            setStatus({ busy: false });
          }
        }}
      />
      {status.busy && <p className="text-xs text-slate-500">Preparing photos…</p>}
      {status.error && <p className="text-xs text-red-600">{status.error}</p>}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="Selected answer photo" className="h-24 rounded-md border border-slate-200 object-cover" />
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">Take a clear, well-lit photo of the full answer. You can add several pages.</p>
    </div>
  );
}
