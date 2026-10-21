import { withWorkspace } from "@/lib/workspace";
import { NextResponse } from 'next/server';
import { getExtractedFile, updateTranscription, getPendingAudioFiles } from '@/lib/db';
import { isSearchEnabled, updateExtractedFileInIndex } from '@/lib/search';
import { readStoredFile } from '@/lib/storage';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function handlePOST(request: Request) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'ID do arquivo é obrigatório' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não configurada no servidor' }, { status: 500 });
    }

    const file = await getExtractedFile(fileId);

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    if (file.file_type !== 'audio') {
      return NextResponse.json({ error: 'Arquivo não é um áudio' }, { status: 400 });
    }



    // Marcar como processando
    await updateTranscription(fileId, '', 'processing');

    try {
      // Ler o arquivo de áudio
      const originalBuffer = await readStoredFile(file.file_path);
      const ext = path.extname(file.filename).replace('.', '').toLowerCase();
      // Workaround: Whisper aceita 'ogg' (Opus dentro do contêiner). Apenas renomeamos .opus -> .ogg.
      const filenameForApi =
        ext === 'opus'
          ? path.basename(file.filename, path.extname(file.filename)) + '.ogg'
          : file.filename;
      const mimeForApi =
        ext === 'opus' ? 'audio/ogg' : (file.mime_type || 'audio/mpeg');

      // Usar File (Node 18+) com mimetype adequado
      const audioFile = new File([new Uint8Array(originalBuffer)], filenameForApi, { type: mimeForApi });

      // Criar FormData para enviar ao Whisper API
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt'); // Português

      // Chamar API do OpenAI Whisper
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro na API Whisper: ${error}`);
      }

      const result = await response.json();
      const transcription = result.text;

      // Salvar transcrição no banco
      await updateTranscription(fileId, transcription, 'completed');
      // Atualizar no Elasticsearch
      if (isSearchEnabled()) {
        const updated = await getExtractedFile(fileId);
        if (updated) {
          updateExtractedFileInIndex(updated).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        fileId,
        transcription,
      });
    } catch (transcribeError) {
      const errorMessage = transcribeError instanceof Error ? transcribeError.message : 'Erro na transcrição';
      await updateTranscription(fileId, errorMessage, 'error');
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro na transcrição:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Endpoint para buscar arquivos pendentes de transcrição
async function handleGET(request: Request) {
  try {
    const pendingFiles = await getPendingAudioFiles();
    return NextResponse.json({
      files: pendingFiles,
      total: pendingFiles.length,
    });
  } catch (error) {
    console.error('Erro ao buscar arquivos pendentes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export const POST = withWorkspace(handlePOST);

export const GET = withWorkspace(handleGET);
