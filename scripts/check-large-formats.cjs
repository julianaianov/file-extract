const fs = require("fs"), path = require("path"), assert = require("node:assert/strict"), ts = require("typescript"), Module = require("module"), { randomUUID } = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name,parent,...rest) { return resolve.call(this,name.startsWith("@/")?path.join(process.cwd(),name.slice(2)):name,parent,...rest); };
require.extensions[".ts"] = (mod,filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const { query, getPool } = require("../lib/postgres.ts"), sessions = require("../app/api/upload/sessions/route.ts"), parts = require("../app/api/upload/sessions/[id]/route.ts"), db = require("../lib/db.ts"), { withWorkspace } = require("../lib/workspace.ts"), billing = require("../lib/billing.ts"), { POST: webhook } = require("../app/api/billing/webhook/route.ts");

const {processBuffer}=require("../lib/process-upload.ts"), storage=require("../lib/storage.ts"), {GET:download}=require("../app/api/files/[id]/route.ts");
const guest=randomUUID(), cookie="fe_guest="+guest, ids=[], sessionIds=[];
const req=(url,options={})=>new Request("http://localhost"+url,{...options,headers:{cookie,...options.headers}});
(async()=>{process.env.BILLING_ENABLED="false";
 try {
  for(const [name,type] of [["notes.txt","text"],["sound.wav","audio"],["photo.png","image"],["document.docx","other"],["unknown.custom","other"],["LICENSE","other"]]) {
   const bytes=Buffer.from("Original: "+name);
   const response=await processBuffer(bytes,name,null), result=await response.json();
   assert.equal(response.status,200,JSON.stringify(result));ids.push(result.uploadId);
   const files=await db.getExtractedFilesByUpload(result.uploadId);assert.equal(files.length,1);assert.equal(files[0].file_type,type);
   assert.deepEqual(await storage.readStoredFile(files[0].file_path),bytes);
  }
  console.log("PASS: texto, audio, imagem, docx, extensao desconhecida e sem extensao");
  const data=Buffer.alloc((process.argv.includes("--quick")?5:51)*1024*1024+37);for(let i=0;i<data.length;i++)data[i]=i%251;
  const created=await sessions.POST(req("/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({filename:"large.custom",size:data.length})}));
  assert.equal(created.status,200);const session=await created.json();sessionIds.push(session.id);const context={params:Promise.resolve({id:session.id})};
  for(let part=0;part<session.count;part++) {
   const r=await parts.PUT(req("/part?part="+part,{method:"PUT",body:data.subarray(part*session.chunkSize,(part+1)*session.chunkSize)}),context);
   assert.equal(r.status,200);console.log("Parte",part+1,"/",session.count);
  }
  const response=await parts.POST(req("/finalize",{method:"POST"}),context), result=await response.json();
  assert.equal(response.status,200,JSON.stringify(result));ids.push(result.uploadId);
  const [file]=await db.getExtractedFilesByUpload(result.uploadId);
  assert.equal(Number(file.file_size),data.length);
  assert.equal(await storage.storedFileSize(file.file_path),data.length);
  for(const start of [0,session.chunkSize-7,data.length-31]){
   const end=Math.min(start+30,data.length-1);
   const r=await download(req("/files/"+file.id+"?action=download",{headers:{range:"bytes="+start+"-"+end}}),{params:Promise.resolve({id:String(file.id)})});
   assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),data.subarray(start,end+1));
  }
  const original=await storage.readStoredFile(file.file_path);assert.deepEqual(original,data);
  assert.equal((await query("SELECT count(*)::int AS n FROM public.upload_chunks WHERE session_id=$1",[session.id])).rows[0].n,0);
  console.log("PASS:",(data.length/1024/1024).toFixed(2),"MB em",session.count,"partes, original integral identico, ranges atravessando partes e limpeza temporaria");
 } finally {
  for(const id of ids)await db.deleteUpload(id);
  for(const id of sessionIds)await query("DELETE FROM public.upload_sessions WHERE id=$1",[id]);
  await getPool().end();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
