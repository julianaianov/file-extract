import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';

const SUPPORTED_EXTS = new Set([
  'flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm',
]);

export function isSupportedAudioExt(filename: string): boolean {
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

export async function convertToWav(inputPath: string): Promise<string> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static não encontrado para conversão de áudio');
  }
  const outPath = path.join(os.tmpdir(), `conv-${Date.now()}.wav`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      outPath,
    ]);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) resolve();
      else reject(new Error(`ffmpeg retornou código ${code}`));
    });
  });
  return outPath;
}


