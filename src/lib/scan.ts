import { Capacitor } from "@capacitor/core";

/**
 * Answer-sheet scanning, used by the "Scan" button on the grading screen.
 *  - In the Android app: Google's ML Kit Document Scanner (edge detection, crop, cleanup) returns a PDF.
 *  - In a browser: pages are photographed one by one, cleaned up here, and stitched into a PDF.
 * Browser-only module; import it from client components.
 */

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export class ScanError extends Error {}

/** Opens the ML Kit scanner. Resolves to the scanned PDF, or null if the TA cancels. */
export async function scanWithDocumentScanner(): Promise<File | null> {
  const { DocumentScanner } = await import("@capacitor-mlkit/document-scanner");
  const { available } = await DocumentScanner.isGoogleDocumentScannerModuleAvailable();
  if (!available) {
    await DocumentScanner.installGoogleDocumentScannerModule();
    throw new ScanError("Downloading Google's document scanner. Try again in a few seconds.");
  }
  let result;
  try {
    result = await DocumentScanner.scanDocument({
      galleryImportAllowed: true,
      pageLimit: 40,
      resultFormats: "PDF",
      scannerMode: "FULL",
    });
  } catch (error) {
    // Closing the scanner rejects with a "canceled" error; treat it as no-op.
    if (error instanceof Error && /cancel/i.test(error.message)) return null;
    throw error;
  }
  if (!result.pdf) return null;
  const response = await fetch(Capacitor.convertFileSrc(result.pdf.uri));
  if (!response.ok) throw new ScanError("Couldn't read the scanned PDF.");
  return new File([await response.blob()], "answer-sheet.pdf", { type: "application/pdf" });
}

const MAX_EDGE = 1700;

/**
 * Turns a camera photo into a clean, document-like page: downscaled, grayscale, and with the
 * levels stretched so paper looks white and ink looks dark.
 */
export async function photoToPage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const y = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = y;
    histogram[y]++;
  }
  // Paper is the bright majority: take the 95th-percentile brightness as "white", and a fixed
  // fraction of it as "black". Ink goes dark, paper goes white, and a desk or table around the
  // page stays a light grey instead of being crushed to black.
  const total = px.length / 4;
  let acc = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += histogram[v];
    if (acc >= total * 0.95) {
      hi = v;
      break;
    }
  }
  hi = Math.max(hi, 96);
  const lo = Math.round(hi * 0.4);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(255, Math.max(0, ((px[i] - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ScanError("Couldn't process the photo."))), "image/jpeg", 0.8),
  );
}

/** Stitches page images (JPEG) into a single PDF, one image per page. */
export async function pagesToPdf(pages: Blob[]): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const page of pages) {
    const jpg = await pdf.embedJpg(await page.arrayBuffer());
    const p = pdf.addPage([jpg.width, jpg.height]);
    p.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
  }
  const bytes = await pdf.save();
  return new File([bytes as BlobPart], "answer-sheet.pdf", { type: "application/pdf" });
}
