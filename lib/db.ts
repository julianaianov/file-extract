import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Garantir que o diretório de dados existe
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'files.db');

// Criar instância singleton do banco
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  const database = db!;

  // Criar tabela de uploads
  database.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
      total_files INTEGER DEFAULT 0,
      error_message TEXT
    )
  `);

  // Criar tabela de arquivos extraídos
  database.exec(`
    CREATE TABLE IF NOT EXISTS extracted_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('text', 'audio', 'image', 'other')),
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      extracted_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      content_text TEXT,
      transcription TEXT,
      transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'error', 'not_applicable')),
      metadata TEXT,
      FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE
    )
  `);

  // Criar índices
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_extracted_files_upload_id ON extracted_files(upload_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_files_file_type ON extracted_files(file_type);
    CREATE INDEX IF NOT EXISTS idx_extracted_files_extracted_date ON extracted_files(extracted_date);
    CREATE INDEX IF NOT EXISTS idx_uploads_upload_date ON uploads(upload_date);
    CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
  `);

  // Criar tabela FTS para busca de texto completo
  try {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
        content_text,
        transcription,
        filename,
        content='extracted_files',
        content_rowid='id'
      )
    `);
  } catch {
    // FTS table might already exist
  }

  // Criar triggers para FTS
  try {
    database.exec(`
      CREATE TRIGGER IF NOT EXISTS files_fts_insert AFTER INSERT ON extracted_files BEGIN
        INSERT INTO files_fts(rowid, content_text, transcription, filename)
        VALUES (NEW.id, NEW.content_text, NEW.transcription, NEW.filename);
      END
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS files_fts_update AFTER UPDATE ON extracted_files BEGIN
        INSERT INTO files_fts(files_fts, rowid, content_text, transcription, filename)
        VALUES ('delete', OLD.id, OLD.content_text, OLD.transcription, OLD.filename);
        INSERT INTO files_fts(rowid, content_text, transcription, filename)
        VALUES (NEW.id, NEW.content_text, NEW.transcription, NEW.filename);
      END
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS files_fts_delete AFTER DELETE ON extracted_files BEGIN
        INSERT INTO files_fts(files_fts, rowid, content_text, transcription, filename)
        VALUES ('delete', OLD.id, OLD.content_text, OLD.transcription, OLD.filename);
      END
    `);
  } catch {
    // Triggers might already exist
  }
}

// Types
export interface Upload {
  id: number;
  filename: string;
  original_name: string;
  file_size: number;
  upload_date: string;
  status: 'processing' | 'completed' | 'error';
  total_files: number;
  error_message: string | null;
}

export interface ExtractedFile {
  id: number;
  upload_id: number;
  filename: string;
  file_path: string;
  file_type: 'text' | 'audio' | 'image' | 'other';
  file_size: number;
  mime_type: string | null;
  extracted_date: string;
  content_text: string | null;
  transcription: string | null;
  transcription_status: 'pending' | 'processing' | 'completed' | 'error' | 'not_applicable';
  metadata: string | null;
}

// Upload operations
export function createUpload(filename: string, originalName: string, fileSize: number): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO uploads (filename, original_name, file_size)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(filename, originalName, fileSize);
  return result.lastInsertRowid as number;
}

export function updateUploadStatus(
  id: number,
  status: Upload['status'],
  totalFiles?: number,
  errorMessage?: string
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE uploads
    SET status = ?, total_files = COALESCE(?, total_files), error_message = ?
    WHERE id = ?
  `);
  stmt.run(status, totalFiles ?? null, errorMessage ?? null, id);
}

export function getUpload(id: number): Upload | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM uploads WHERE id = ?');
  return stmt.get(id) as Upload | undefined;
}

export function getAllUploads(): Upload[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM uploads ORDER BY upload_date DESC');
  return stmt.all() as Upload[];
}

export function deleteUpload(id: number): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM uploads WHERE id = ?');
  stmt.run(id);
}

// Extracted file operations
export function createExtractedFile(
  uploadId: number,
  filename: string,
  filePath: string,
  fileType: ExtractedFile['file_type'],
  fileSize: number,
  mimeType: string | null,
  contentText?: string | null,
  transcriptionStatus?: ExtractedFile['transcription_status']
): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO extracted_files (upload_id, filename, file_path, file_type, file_size, mime_type, content_text, transcription_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    uploadId,
    filename,
    filePath,
    fileType,
    fileSize,
    mimeType,
    contentText ?? null,
    transcriptionStatus ?? (fileType === 'audio' ? 'pending' : 'not_applicable')
  );
  return result.lastInsertRowid as number;
}

export function updateTranscription(
  id: number,
  transcription: string,
  status: ExtractedFile['transcription_status']
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE extracted_files
    SET transcription = ?, transcription_status = ?
    WHERE id = ?
  `);
  stmt.run(transcription, status, id);
}

export function getExtractedFilesByUpload(uploadId: number): ExtractedFile[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM extracted_files WHERE upload_id = ? ORDER BY filename');
  return stmt.all(uploadId) as ExtractedFile[];
}

export function getExtractedFile(id: number): ExtractedFile | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM extracted_files WHERE id = ?');
  return stmt.get(id) as ExtractedFile | undefined;
}

export function deleteExtractedFile(id: number): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM extracted_files WHERE id = ?');
  stmt.run(id);
}

export function updateContentText(id: number, contentText: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE extracted_files
    SET content_text = ?
    WHERE id = ?
  `);
  stmt.run(contentText, id);
}

export function getPendingAudioFiles(): ExtractedFile[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM extracted_files
    WHERE file_type = 'audio' AND transcription_status = 'pending'
  `);
  return stmt.all() as ExtractedFile[];
}

// Search and filter operations
export interface SearchFilters {
  keyword?: string;
  fileType?: ExtractedFile['file_type'];
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string;
  timeTo?: string;
  uploadId?: number;
}

export function searchFiles(filters: SearchFilters): ExtractedFile[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.keyword) {
    // Usar FTS para busca por palavras-chave
    conditions.push(`ef.id IN (
      SELECT rowid FROM files_fts WHERE files_fts MATCH ?
    )`);
    params.push(filters.keyword + '*');
  }

  if (filters.fileType) {
    conditions.push('ef.file_type = ?');
    params.push(filters.fileType);
  }

  if (filters.dateFrom) {
    conditions.push("date(ef.extracted_date) >= date(?)");
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push("date(ef.extracted_date) <= date(?)");
    params.push(filters.dateTo);
  }

  if (filters.timeFrom) {
    conditions.push("time(ef.extracted_date) >= time(?)");
    params.push(filters.timeFrom);
  }

  if (filters.timeTo) {
    conditions.push("time(ef.extracted_date) <= time(?)");
    params.push(filters.timeTo);
  }

  if (filters.uploadId) {
    conditions.push('ef.upload_id = ?');
    params.push(filters.uploadId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT ef.*, u.original_name as upload_name
    FROM extracted_files ef
    LEFT JOIN uploads u ON ef.upload_id = u.id
    ${whereClause}
    ORDER BY ef.extracted_date DESC
  `;

  const stmt = db.prepare(query);
  return stmt.all(...params) as ExtractedFile[];
}

// Statistics
export function getStatistics(): {
  totalUploads: number;
  totalFiles: number;
  textFiles: number;
  audioFiles: number;
  imageFiles: number;
  pendingTranscriptions: number;
} {
  const db = getDb();

  const totalUploads = (db.prepare('SELECT COUNT(*) as count FROM uploads').get() as { count: number }).count;
  const totalFiles = (db.prepare('SELECT COUNT(*) as count FROM extracted_files').get() as { count: number }).count;
  const textFiles = (db.prepare("SELECT COUNT(*) as count FROM extracted_files WHERE file_type = 'text'").get() as { count: number }).count;
  const audioFiles = (db.prepare("SELECT COUNT(*) as count FROM extracted_files WHERE file_type = 'audio'").get() as { count: number }).count;
  const imageFiles = (db.prepare("SELECT COUNT(*) as count FROM extracted_files WHERE file_type = 'image'").get() as { count: number }).count;
  const pendingTranscriptions = (db.prepare("SELECT COUNT(*) as count FROM extracted_files WHERE transcription_status = 'pending'").get() as { count: number }).count;

  return {
    totalUploads,
    totalFiles,
    textFiles,
    audioFiles,
    imageFiles,
    pendingTranscriptions,
  };
}
