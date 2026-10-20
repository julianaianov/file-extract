import { NextResponse } from 'next/server';
import { getExtractedFile, getExtractedFilesByUpload, getUpload, deleteUpload, deleteExtractedFile } from '@/lib/db';
import { readStoredFile, deleteStoredFile } from '@/lib/storage';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){
 try{
 const id=Number((await context.params).id),action=new URL(request.url).searchParams.get('action');
 if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'ID inválido'},{status:400});
 if(action==='upload-files')return NextResponse.json(await getExtractedFilesByUpload(id));
 const file=await getExtractedFile(id);
 if(file){
 if(action==='download'){
 const buffer=await readStoredFile(file.file_path);
 return new Response(new Uint8Array(buffer),{headers:{'Content-Type':file.mime_type||'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.filename),'Content-Length':String(buffer.length)}});
 }
 if(action==='content'){
 if(file.file_type==='text')return NextResponse.json({type:'text',content:file.content_text||''});
 if(file.file_type==='image'||file.file_type==='audio'){
 const buffer=await readStoredFile(file.file_path),mimeType=file.mime_type||'application/octet-stream';
 return NextResponse.json({type:file.file_type,mimeType,data:'data:'+mimeType+';base64,'+buffer.toString('base64'),ocrText:file.content_text||'',transcription:file.transcription,transcriptionStatus:file.transcription_status});
 }
 return NextResponse.json({type:'other',message:'Tipo de arquivo não suportado para visualização'});
 }
 return NextResponse.json(file);
 }
 if(action==='download'||action==='content')return NextResponse.json({error:'Arquivo não encontrado'},{status:404});
 const upload=await getUpload(id);
 if(upload)return NextResponse.json({upload,files:await getExtractedFilesByUpload(id)});
 return NextResponse.json({error:'Não encontrado'},{status:404});
 }catch(error){console.error('Falha ao buscar arquivo',error instanceof Error?error.name:'Error');return NextResponse.json({error:'Não foi possível consultar o arquivo no Supabase'},{status:500})}
}
export async function DELETE(request:Request,context:Context){
 try{
 const id=Number((await context.params).id);
 if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'ID inválido'},{status:400});
 const file=await getExtractedFile(id);
 if(file){await deleteStoredFile(file.file_path);await deleteExtractedFile(id);return NextResponse.json({success:true})}
 const upload=await getUpload(id);
 if(!upload)return NextResponse.json({error:'Não encontrado'},{status:404});
 await deleteUpload(id);
 return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:'Não foi possível excluir no Supabase'},{status:500})}
}
