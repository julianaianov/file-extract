import { NextResponse } from 'next/server';
import { createUpload, updateUploadStatus, createExtractedFile, type ExtractedFile } from '@/lib/db';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Diretórios para armazenamento
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
const EXTRACTED_DIR = path.join(process.cwd(), 'data', 'extracted');

// Garantir que os diretórios existem
function ensureDirectories() {
  [UPLOADS_DIR, EXTRACTED_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Determinar o tipo de arquivo baseado na extensão e MIME type
function getFileType(filename: string, mimeType?: string): ExtractedFile['file_type'] {
  const ext = path.extname(filename).toLowerCase();

  // Tipos de texto
  const textExtensions = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.htm', '.log', '.js', '.ts', '.jsx', '.tsx', '.css', '.py', '.java', '.c', '.cpp', '.h', '.php', '.rb', '.go', '.rs', '.sql', '.yaml', '.yml', '.ini', '.cfg', '.conf'];
  if (textExtensions.includes(ext)) return 'text';

  // Tipos de áudio
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma', '.opus', '.webm'];
  if (audioExtensions.includes(ext)) return 'audio';
  if (mimeType?.startsWith('audio/')) return 'audio';

  // Tipos de imagem
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
  if (imageExtensions.includes(ext)) return 'image';
  if (mimeType?.startsWith('image/')) return 'image';

  return 'other';
}

// Obter MIME type baseado na extensão
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Texto
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    // Áudio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.webm': 'audio/webm',
    // Imagem
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Ler conteúdo de texto de um arquivo
function readTextContent(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Limitar a 100KB de texto para evitar problemas de memória
    return content.slice(0, 100000);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    ensureDirectories();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const customName = (formData.get('customName') as string | null)?.trim();

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Verificar se é um arquivo ZIP
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Apenas arquivos ZIP são permitidos' }, { status: 400 });
    }

    // Gerar nome único para o arquivo
    const uniqueId = uuidv4();
    const savedFilename = `${uniqueId}.zip`;
    const savedFilePath = path.join(UPLOADS_DIR, savedFilename);

    // Salvar arquivo
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(savedFilePath, buffer);

    // Criar registro no banco (usa customName se fornecido)
    const displayName = customName && customName.length > 0 ? customName : file.name;
    const uploadId = createUpload(savedFilename, displayName, file.size);

    try {
      // Extrair ZIP
      const zip = new AdmZip(savedFilePath);
      const zipEntries = zip.getEntries();

      // Criar diretório para arquivos extraídos
      const extractDir = path.join(EXTRACTED_DIR, uniqueId);
      fs.mkdirSync(extractDir, { recursive: true });

      let extractedCount = 0;

      for (const entry of zipEntries) {
        // Ignorar diretórios e arquivos ocultos
        if (entry.isDirectory || entry.entryName.startsWith('__MACOSX') || entry.entryName.includes('.DS_Store')) {
          continue;
        }

        const filename = path.basename(entry.entryName);
        const extractedPath = path.join(extractDir, filename);

        // Extrair arquivo
        zip.extractEntryTo(entry, extractDir, false, true);

        // Determinar tipo e MIME
        const mimeType = getMimeType(filename);
        const fileType = getFileType(filename, mimeType);

        // Ler conteúdo de texto se aplicável
        let contentText: string | null = null;
        if (fileType === 'text') {
          contentText = readTextContent(extractedPath);
        }

        // Criar registro do arquivo extraído
        createExtractedFile(
          uploadId,
          filename,
          extractedPath,
          fileType,
          entry.header.size,
          mimeType,
          contentText,
          fileType === 'audio' ? 'pending' : 'not_applicable'
        );

        extractedCount++;
      }

      // Atualizar status do upload
      updateUploadStatus(uploadId, 'completed', extractedCount);

      return NextResponse.json({
        success: true,
        uploadId,
        message: `Arquivo processado com sucesso. ${extractedCount} arquivos extraídos.`,
        totalFiles: extractedCount,
      });
    } catch (extractError) {
      const errorMessage = extractError instanceof Error ? extractError.message : 'Erro ao extrair arquivo';
      updateUploadStatus(uploadId, 'error', 0, errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro no upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST para enviar arquivos' });
}
