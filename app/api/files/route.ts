import { NextResponse } from 'next/server';
import { searchFiles, getAllUploads, getStatistics, type SearchFilters } from '@/lib/db';
import { isSearchEnabled, searchIdsByKeyword } from '@/lib/search';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const action = searchParams.get('action');

    // Retornar estatísticas
    if (action === 'stats') {
      const stats = getStatistics();
      return NextResponse.json(stats);
    }

    // Retornar lista de uploads
    if (action === 'uploads') {
      const uploads = getAllUploads();
      return NextResponse.json(uploads);
    }

    // Buscar arquivos com filtros
    const filters: SearchFilters = {};

    const keyword = searchParams.get('keyword');
    if (keyword) filters.keyword = keyword;

    const fileType = searchParams.get('fileType');
    if (fileType && ['text', 'audio', 'image', 'other'].includes(fileType)) {
      filters.fileType = fileType as SearchFilters['fileType'];
    }

    const dateFrom = searchParams.get('dateFrom');
    if (dateFrom) filters.dateFrom = dateFrom;

    const dateTo = searchParams.get('dateTo');
    if (dateTo) filters.dateTo = dateTo;

    const timeFrom = searchParams.get('timeFrom');
    if (timeFrom) filters.timeFrom = timeFrom;

    const timeTo = searchParams.get('timeTo');
    if (timeTo) filters.timeTo = timeTo;

    const uploadId = searchParams.get('uploadId');
    if (uploadId) filters.uploadId = parseInt(uploadId, 10);

    // Se ES estiver habilitado e houver keyword, usar ES para obter IDs e filtrar no SQL
    let files;
    if (isSearchEnabled() && filters.keyword) {
      const ids = await searchIdsByKeyword(filters.keyword, filters.fileType);
      if (ids.length === 0) {
        files = [];
      } else {
        // Buscar no banco os registros desses IDs respeitando os demais filtros simples
        const db = getDb();
        const placeholders = ids.map(() => '?').join(',');
        const baseQuery = `
          SELECT ef.*, u.original_name as upload_name
          FROM extracted_files ef
          LEFT JOIN uploads u ON ef.upload_id = u.id
          WHERE ef.id IN (${placeholders})
        `;
        const extraConds: string[] = [];
        const params: any[] = [...ids];
        if (filters.uploadId) {
          extraConds.push('ef.upload_id = ?');
          params.push(filters.uploadId);
        }
        if (filters.dateFrom) {
          extraConds.push('date(ef.extracted_date) >= date(?)');
          params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
          extraConds.push('date(ef.extracted_date) <= date(?)');
          params.push(filters.dateTo);
        }
        const query = `${baseQuery}${extraConds.length ? ' AND ' + extraConds.join(' AND ') : ''} ORDER BY ef.extracted_date DESC`;
        files = db.prepare(query).all(...params);
      }
    } else {
      files = searchFiles(filters);
    }

    return NextResponse.json({
      files,
      total: files.length,
      filters,
    });
  } catch (error) {
    console.error('Erro ao buscar arquivos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
