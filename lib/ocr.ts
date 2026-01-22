'use server';

import * as Tesseract from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

export async function extractTextFromImage(
  imagePath: string,
  lang: string = process.env.OCR_LANG || 'por+eng'
): Promise<string> {
  const require = createRequire(import.meta.url);
  const projectRoot = process.cwd();
  const cachePath =
    process.env.TESSERACT_CACHE_PATH ||
    path.join(projectRoot, 'data', 'tesseract-cache');

  // Garantir diretório de cache
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }

  // Resolver caminhos do worker e core para ambiente Node
  const workerPath =
    process.env.TESSERACT_WORKER_PATH ||
    path.join(projectRoot, 'lib', 'tesseract-worker.js');
  const corePath =
    process.env.TESSERACT_CORE_PATH ||
    path.join(projectRoot, 'node_modules', 'tesseract.js-core', 'tesseract-core.wasm.js');
  const langPath =
    process.env.TESSERACT_LANG_PATH || 'https://tessdata.projectnaptha.com/4.0.0';

  // Log de diagnóstico (apenas no servidor)
  // eslint-disable-next-line no-console
  console.log('OCR paths', { workerPath, corePath, langPath, cachePath });
  const workerFileUrl = pathToFileURL(workerPath);

  const worker = await Tesseract.createWorker(
    undefined,
    undefined,
    {
      logger: () => {},
      cachePath,
      workerPath: workerFileUrl,
      corePath,
      langPath,
    }
  );
  try {
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    const { data } = await worker.recognize(imagePath);
    return (data?.text || '').trim();
  } finally {
    await worker.terminate();
  }
}
