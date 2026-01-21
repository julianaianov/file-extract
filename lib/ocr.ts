import { createWorker } from 'tesseract.js';

export async function extractTextFromImage(
  imagePath: string,
  lang: string = process.env.OCR_LANG || 'por+eng'
): Promise<string> {
  const worker = await createWorker({
    logger: () => {},
    cachePath: process.env.TESSERACT_CACHE_PATH || undefined,
  });
  try {
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    const { data } = await worker.recognize(imagePath);
    return (data?.text || '').trim();
  } finally {
    await worker.terminate();
  }
}


