-- Script para criar as tabelas do sistema de processamento de arquivos ZIP
-- SQLite Database Schema

-- Tabela principal de uploads
CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
    total_files INTEGER DEFAULT 0,
    error_message TEXT
);

-- Tabela de arquivos extraídos
CREATE TABLE IF NOT EXISTS extracted_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('text', 'audio', 'image', 'other')),
    file_size INTEGER NOT NULL,
    mime_type TEXT,
    extracted_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    content_text TEXT, -- Conteúdo de texto extraído (para arquivos de texto ou transcrições)
    transcription TEXT, -- Transcrição de áudio (se aplicável)
    transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'error', 'not_applicable')),
    metadata TEXT, -- JSON com metadados adicionais
    FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE
);

-- Índices para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_extracted_files_upload_id ON extracted_files(upload_id);
CREATE INDEX IF NOT EXISTS idx_extracted_files_file_type ON extracted_files(file_type);
CREATE INDEX IF NOT EXISTS idx_extracted_files_extracted_date ON extracted_files(extracted_date);
CREATE INDEX IF NOT EXISTS idx_uploads_upload_date ON uploads(upload_date);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);

-- Índice de texto completo para buscas por palavras-chave
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    content_text,
    transcription,
    filename,
    content='extracted_files',
    content_rowid='id'
);

-- Triggers para manter o FTS sincronizado
CREATE TRIGGER IF NOT EXISTS files_fts_insert AFTER INSERT ON extracted_files BEGIN
    INSERT INTO files_fts(rowid, content_text, transcription, filename)
    VALUES (NEW.id, NEW.content_text, NEW.transcription, NEW.filename);
END;

CREATE TRIGGER IF NOT EXISTS files_fts_update AFTER UPDATE ON extracted_files BEGIN
    INSERT INTO files_fts(files_fts, rowid, content_text, transcription, filename)
    VALUES ('delete', OLD.id, OLD.content_text, OLD.transcription, OLD.filename);
    INSERT INTO files_fts(rowid, content_text, transcription, filename)
    VALUES (NEW.id, NEW.content_text, NEW.transcription, NEW.filename);
END;

CREATE TRIGGER IF NOT EXISTS files_fts_delete AFTER DELETE ON extracted_files BEGIN
    INSERT INTO files_fts(files_fts, rowid, content_text, transcription, filename)
    VALUES ('delete', OLD.id, OLD.content_text, OLD.transcription, OLD.filename);
END;
