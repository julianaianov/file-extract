import { query } from "./postgres";
import { searchContext, type SearchContext } from "./search-context";
export interface Upload {
  id: number;
  filename: string;
  original_name: string;
  file_size: number;
  upload_date: string;
  status: "processing" | "completed" | "error";
  total_files: number;
  error_message: string | null;
}
export interface ExtractedFile {
  search_context?: SearchContext[];
  search_keyword?: string;
  id: number;
  upload_id: number;
  filename: string;
  file_path: string;
  file_type: "text" | "audio" | "image" | "other";
  file_size: number;
  mime_type: string | null;
  extracted_date: string;
  content_text: string | null;
  transcription: string | null;
  transcription_status:
    "pending" | "processing" | "completed" | "error" | "not_applicable";
  metadata: string | null;
}
export async function createUpload(
  filename: string,
  originalName: string,
  fileSize: number,
): Promise<number> {
  return (
    await query(
      "INSERT INTO public.uploads(filename,original_name,file_size) VALUES($1,$2,$3) RETURNING id",
      [filename, originalName, fileSize],
    )
  ).rows[0].id;
}
export async function updateUploadStatus(
  id: number,
  status: Upload["status"],
  totalFiles?: number,
  errorMessage?: string,
) {
  await query(
    "UPDATE public.uploads SET status=$2,total_files=COALESCE($3,total_files),error_message=$4 WHERE id=$1",
    [id, status, totalFiles ?? null, errorMessage ?? null],
  );
}
export async function getUpload(id: number): Promise<Upload | undefined> {
  return (await query("SELECT * FROM public.uploads WHERE id=$1", [id]))
    .rows[0];
}
export async function getAllUploads(): Promise<Upload[]> {
  return (await query("SELECT * FROM public.uploads ORDER BY upload_date DESC"))
    .rows;
}
export async function deleteUpload(id: number) {
  await query("DELETE FROM public.uploads WHERE id=$1", [id]);
}
export async function createExtractedFile(
  uploadId: number,
  filename: string,
  filePath: string,
  fileType: ExtractedFile["file_type"],
  fileSize: number,
  mimeType: string | null,
  contentText?: string | null,
  transcriptionStatus?: ExtractedFile["transcription_status"],
): Promise<number> {
  return (
    await query(
      "INSERT INTO public.extracted_files(upload_id,filename,file_path,file_type,file_size,mime_type,content_text,transcription_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [
        uploadId,
        filename,
        filePath,
        fileType,
        fileSize,
        mimeType,
        contentText ?? null,
        transcriptionStatus ??
          (fileType === "audio" ? "pending" : "not_applicable"),
      ],
    )
  ).rows[0].id;
}
export async function getExtractedFile(
  id: number,
): Promise<ExtractedFile | undefined> {
  return (await query("SELECT * FROM public.extracted_files WHERE id=$1", [id]))
    .rows[0];
}
export async function getExtractedFilesByUpload(
  id: number,
): Promise<ExtractedFile[]> {
  return (
    await query(
      "SELECT * FROM public.extracted_files WHERE upload_id=$1 ORDER BY filename",
      [id],
    )
  ).rows;
}
export async function deleteExtractedFile(id: number) {
  await query("DELETE FROM public.extracted_files WHERE id=$1", [id]);
}
export async function updateContentText(id: number, text: string) {
  await query("UPDATE public.extracted_files SET content_text=$2 WHERE id=$1", [
    id,
    text,
  ]);
}
export async function updateTranscription(
  id: number,
  text: string,
  status: ExtractedFile["transcription_status"],
) {
  await query(
    "UPDATE public.extracted_files SET transcription=$2,transcription_status=$3 WHERE id=$1",
    [id, text, status],
  );
}
export async function getPendingAudioFiles(): Promise<ExtractedFile[]> {
  return (
    await query(
      "SELECT * FROM public.extracted_files WHERE file_type='audio' AND transcription_status='pending'",
    )
  ).rows;
}
export interface SearchFilters {
  keyword?: string;
  fileType?: ExtractedFile["file_type"];
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string;
  timeTo?: string;
  uploadId?: number;
  transcriptionStatus?: ExtractedFile["transcription_status"];
}
export async function searchFiles(
  f: SearchFilters,
  summary = false,
): Promise<ExtractedFile[]> {
  const values: unknown[] = [],
    where: string[] = [];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    where.push(sql.replaceAll("?", "$" + values.length));
  };
  if (f.keyword)
    add(
      "(ef.content_text ILIKE ? OR ef.transcription ILIKE ? OR ef.filename ILIKE ?)",
      "%" + f.keyword.replace(/[\\%_]/g, "\\$&") + "%",
    );
  if (f.fileType) add("ef.file_type=?", f.fileType);
  if (f.uploadId) add("ef.upload_id=?", f.uploadId);
  if (f.transcriptionStatus)
    add("ef.transcription_status=?", f.transcriptionStatus);
  if (f.dateFrom) add("ef.extracted_date::date >= ?::date", f.dateFrom);
  if (f.dateTo) add("ef.extracted_date::date <= ?::date", f.dateTo);
  if (f.timeFrom) add("ef.extracted_date::time >= ?::time", f.timeFrom);
  if (f.timeTo) add("ef.extracted_date::time <= ?::time", f.timeTo);
  const selection = summary && !f.keyword
    ? "ef.id,ef.upload_id,ef.filename,ef.file_path,ef.file_type,ef.file_size,ef.mime_type,ef.extracted_date,NULL::text AS content_text,LEFT(ef.transcription,240) AS transcription,ef.transcription_status,ef.metadata"
    : "ef.*";
  const rows: ExtractedFile[] = (
    await query(
      "SELECT " +
        selection +
        ",u.original_name AS upload_name FROM public.extracted_files ef JOIN public.uploads u ON u.id=ef.upload_id " +
        (where.length ? "WHERE " + where.join(" AND ") : "") +
        " ORDER BY ef.extracted_date DESC",
      values,
    )
  ).rows;
  if (!summary || !f.keyword) return rows;
  return rows.map(file => ({ ...file, search_keyword: f.keyword, search_context: [...searchContext(file.content_text, f.keyword!, "content"), ...searchContext(file.transcription, f.keyword!, "transcription")], content_text: null, transcription: file.transcription?.slice(0, 240) ?? null }));
}
export async function getStatistics() {
  const row = (
    await query(
      `SELECT (SELECT COUNT(*)::int FROM public.uploads) AS "totalUploads",COUNT(*)::int AS "totalFiles",COUNT(*) FILTER(WHERE file_type='text')::int AS "textFiles",COUNT(*) FILTER(WHERE file_type='audio')::int AS "audioFiles",COUNT(*) FILTER(WHERE file_type='image')::int AS "imageFiles",COUNT(*) FILTER(WHERE transcription_status='pending')::int AS "pendingTranscriptions" FROM public.extracted_files`,
    )
  ).rows[0];
  return row as {
    totalUploads: number;
    totalFiles: number;
    textFiles: number;
    audioFiles: number;
    imageFiles: number;
    pendingTranscriptions: number;
  };
}

export async function updateFileMetadata(
  id: number,
  metadata: Record<string, unknown>,
) {
  await query("UPDATE public.extracted_files SET metadata=$2 WHERE id=$1", [
    id,
    JSON.stringify(metadata),
  ]);
}
