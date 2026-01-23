import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const SUPPORTED_EXTS = new Set([
  'flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm',
]);

export function isSupportedAudioExt(filename: string): boolean {
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

export async function convertToWav(inputPath: string): Promise<string> {
  const require = createRequire(import.meta.url);
  let ffmpegBin: string | null = null;
  try {
    // Prefer installer (paths por plataforma)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ffmpegBin = require('@ffmpeg-installer/ffmpeg').path as string;
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ffmpegBin = require('ffmpeg-static') as string;
    } catch {
      ffmpegBin = null;
    }
  }
  const bin = ffmpegBin ?? 'ffmpeg';

  const outPath = path.join(os.tmpdir(), `conv-${Date.now()}.wav`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(bin, [
      '-y',
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      outPath,
    ]);
    proc.on('error', (err) => {
      if ((err as any)?.code === 'ENOENT') {
        reject(
          new Error(
            'ffmpeg não encontrado. Instale o pacote @ffmpeg-installer/ffmpeg, ou tenha o binário "ffmpeg" disponível no PATH do sistema.'
          )
        );
      } else {
        reject(err);
      }
    });
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) resolve();
      else reject(new Error(`ffmpeg retornou código ${code}`));
    });
  });
  return outPath;
}


