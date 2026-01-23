import { Client } from '@elastic/elasticsearch';
import type { ExtractedFile } from './db';

let client: Client | null = null;
let indexName: string = process.env.ELASTICSEARCH_INDEX || 'file-extractor-files';

function getClient(): Client | null {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) return null;
  if (!client) {
    client = new Client({
      node: url,
      auth:
        process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
          ? {
              username: process.env.ELASTICSEARCH_USERNAME!,
              password: process.env.ELASTICSEARCH_PASSWORD!,
            }
          : undefined,
      tls:
        process.env.ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED === 'false'
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }
  return client;
}

export function isSearchEnabled(): boolean {
  return !!getClient();
}

export async function ensureIndex(): Promise<void> {
  const es = getClient();
  if (!es) return;
  const exists = await es.indices.exists({ index: indexName });
  if (!exists) {
    await es.indices.create({
      index: indexName,
      mappings: {
        properties: {
          id: { type: 'integer' },
          upload_id: { type: 'integer' },
          filename: { type: 'text' },
          file_type: { type: 'keyword' },
          content_text: { type: 'text' },
          transcription: { type: 'text' },
          extracted_date: { type: 'date', format: 'strict_date_optional_time||epoch_millis' },
        },
      },
    });
  }
}

export async function indexExtractedFile(file: ExtractedFile): Promise<void> {
  const es = getClient();
  if (!es) return;
  await ensureIndex();
  await es.index({
    index: indexName,
    id: String(file.id),
    document: {
      id: file.id,
      upload_id: file.upload_id,
      filename: file.filename,
      file_type: file.file_type,
      content_text: file.content_text,
      transcription: file.transcription,
      extracted_date: file.extracted_date,
    },
    refresh: 'false',
  });
}

export async function updateExtractedFileInIndex(file: ExtractedFile): Promise<void> {
  const es = getClient();
  if (!es) return;
  await ensureIndex();
  await es.update({
    index: indexName,
    id: String(file.id),
    doc: {
      content_text: file.content_text,
      transcription: file.transcription,
    },
    doc_as_upsert: true,
    refresh: 'false',
  });
}

export async function removeExtractedFile(id: number): Promise<void> {
  const es = getClient();
  if (!es) return;
  await ensureIndex();
  try {
    await es.delete({ index: indexName, id: String(id), refresh: 'false' });
  } catch {
    // ignore not found
  }
}

export async function removeByUpload(uploadId: number): Promise<void> {
  const es = getClient();
  if (!es) return;
  await ensureIndex();
  await es.deleteByQuery({
    index: indexName,
    query: { term: { upload_id: uploadId } },
    refresh: false,
  });
}

export async function searchIdsByKeyword(keyword: string, fileType?: string): Promise<number[]> {
  const es = getClient();
  if (!es) return [];
  await ensureIndex();
  const clauses: any[] = [];
  if (keyword) {
    clauses.push({
      multi_match: {
        query: keyword,
        fields: ['content_text^2', 'transcription^2', 'filename'],
        type: 'best_fields',
        operator: 'and',
      },
    });
  }
  if (fileType) {
    clauses.push({ term: { file_type: fileType } });
  }
  const { hits } = await es.search({
    index: indexName,
    size: 500,
    query: clauses.length ? { bool: { must: clauses } } : { match_all: {} },
    _source: false,
    fields: ['id'],
  });
  return (hits.hits || []).map((h: any) => Number(h._id));
}

export async function searchIdsByFuzzyKeyword(
  keyword: string,
  fileType?: string,
  limit: number = 50
): Promise<number[]> {
  const es = getClient();
  if (!es) return [];
  await ensureIndex();
  const must: any[] = [];
  if (keyword) {
    must.push({
      multi_match: {
        query: keyword,
        fields: ['content_text^2', 'transcription^2', 'filename'],
        type: 'best_fields',
        fuzziness: 'AUTO',
        operator: 'or',
      },
    });
  }
  if (fileType) {
    must.push({ term: { file_type: fileType } });
  }
  const { hits } = await es.search({
    index: indexName,
    size: limit,
    query: must.length ? { bool: { must } } : { match_all: {} },
    _source: false,
    fields: ['id'],
  });
  return (hits.hits || []).map((h: any) => Number(h._id));
}








