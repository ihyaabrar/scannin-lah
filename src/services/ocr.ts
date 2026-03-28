/**
 * OCR service using Tesseract.js
 * Creates a fresh worker per call to avoid memory/state issues.
 */
export async function recognizeText(
  imageDataUrl: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('ind+eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  try {
    const { data } = await worker.recognize(imageDataUrl);
    return data.text.trim();
  } finally {
    // Always terminate to free memory
    await worker.terminate();
  }
}
