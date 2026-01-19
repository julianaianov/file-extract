import { NextResponse } from 'next/server';
import { searchFiles, getAllUploads, getStatistics, type SearchFilters } from '@/lib/db';

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

    const files = searchFiles(filters);

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
