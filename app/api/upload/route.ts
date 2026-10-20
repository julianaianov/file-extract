import { NextResponse } from 'next/server';
import { createUpload, updateUploadStatus, createExtractedFile, deleteUpload, type ExtractedFile } from '@/lib/db';
import { saveStoredFile } from '@/lib/storage';
import AdmZip from 'adm-zip';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;
function fileInfo(name: string): {type:ExtractedFile['file_type'];mime:string} {
 const ext=path.extname(name).toLowerCase();
 if(ext==='.pdf')return {type:'text',mime:'application/pdf'};
 if(['.txt','.md','.json','.csv','.xml','.html','.log','.js','.ts','.css','.py','.sql','.yaml','.yml'].includes(ext))return {type:'text',mime:'text/plain'};
 const audio:Record<string,string>={'.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.opus':'audio/ogg','.m4a':'audio/mp4','.flac':'audio/flac','.aac':'audio/aac','.webm':'audio/webm'};
 const image:Record<string,string>={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.bmp':'image/bmp','.svg':'image/svg+xml'};
 if(audio[ext])return {type:'audio',mime:audio[ext]};
 if(image[ext])return {type:'image',mime:image[ext]};
 return {type:'other',mime:'application/octet-stream'};
}
export async function POST(request:Request) {
 let uploadId:number|undefined;
 try {
 const form=await request.formData(),file=form.get('file');
 if(!(file instanceof File))return NextResponse.json({error:'Nenhum arquivo enviado'},{status:400});
 const extension=path.extname(file.name).toLowerCase();
 if(!['.zip','.pdf'].includes(extension))return NextResponse.json({error:'Selecione um arquivo ZIP ou PDF'},{status:400});
 if(!file.size||file.size>MAX_BYTES)return NextResponse.json({error:'O arquivo deve ter entre 1 byte e 4 MB'},{status:413});
 const buffer=Buffer.from(await file.arrayBuffer());
 const customName=form.get('customName'),uniqueId=randomUUID();
 // Validate archives before creating any records.
 const entries=extension==='.zip'?new AdmZip(buffer).getEntries().filter(e=>!e.isDirectory&&!e.entryName.startsWith('__MACOSX')&&!e.entryName.includes('.DS_Store')):null;
 if(entries&&(entries.length>1000||entries.reduce((n,e)=>n+e.header.size,0)>MAX_EXTRACTED_BYTES))return NextResponse.json({error:'ZIP excede o limite de 1000 arquivos ou 100 MB extraídos'},{status:413});
 const savedFilename=uniqueId+extension;
 uploadId=await createUpload(savedFilename,typeof customName==='string'&&customName.trim()?customName.trim():file.name,file.size);
 await saveStoredFile('uploads/'+savedFilename,uploadId,buffer);
 const extracted=entries?entries.map((entry,index)=>({name:path.posix.basename(entry.entryName.replaceAll('\\','/')),key:uniqueId+'/'+index,data:()=>entry.getData()})):[{name:file.name,key:uniqueId+'/0',data:()=>buffer}];
 for(const entry of extracted) {
 const data=entry.data(),info=fileInfo(entry.name);
 if(data.length>MAX_EXTRACTED_BYTES)throw new Error('Arquivo extraído excede o limite');
 let text:string|null=null;
 if(info.type==='text')text=(info.mime==='application/pdf'?(await pdf(data)).text:data.toString('utf8')).slice(0,1000000);
 const key='extracted/'+entry.key;
 await saveStoredFile(key,uploadId,data);
 await createExtractedFile(uploadId,entry.name,key,info.type,data.length,info.mime,text,info.type==='audio'?'pending':'not_applicable');
 }
 await updateUploadStatus(uploadId,'completed',extracted.length);
 return NextResponse.json({success:true,uploadId,totalFiles:extracted.length,message:'Arquivo processado com sucesso'});
 } catch(error) {
 if(uploadId)await deleteUpload(uploadId).catch(()=>{});
 console.error('Falha ao processar upload:', {name: error instanceof Error ? error.name : 'Error', code: (error as {code?:string})?.code, message: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[REDACTED]') : 'Unknown'});
 return NextResponse.json({error:'Não foi possível processar o arquivo. Verifique a conexão com o Supabase e se o ZIP/PDF é válido.'},{status:500});
 }
}
