// Download through short authenticated range requests, without buffering the whole file.
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("fetch",event=>{
 const url=new URL(event.request.url),match=/^\/downloads\/file-(\d+)$/.exec(url.pathname);
 if(!match||event.request.method!=="GET")return;
 event.respondWith((async()=>{
  let start=0,total=null,finished=false,first;
  const abort=new AbortController();event.request.signal.addEventListener("abort",()=>abort.abort());
  const next=async()=>{
   let response;
   for(let attempt=0;attempt<3;attempt++){
    response=await fetch("/api/files/"+match[1]+"?action=download",{credentials:"same-origin",cache:"no-store",signal:abort.signal,headers:{Range:"bytes="+start+"-"+(start+3145727)}});
    if(response.ok)break;if(response.status<500)throw Error("Arquivo indisponível");
   }
   if(!response||response.status!==206)throw Error("Falha no download");
   const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range")||"");
   const data=new Uint8Array(await response.arrayBuffer());
   if(!range||Number(range[1])!==start||Number(range[2])-start+1!==data.length||!data.length||(total!==null&&Number(range[3])!==total))throw Error("Download incompleto");
   total=Number(range[3]);if(!Number.isSafeInteger(total)||total<start+data.length)throw Error("Tamanho inválido");
   start+=data.length;return data;
  };
  try{first=await next();}catch{return new Response("Não foi possível acessar o arquivo. Entre na plataforma e tente novamente.",{status:502,headers:{"Content-Type":"text/plain; charset=utf-8"}});}
  const stream=new ReadableStream({async pull(controller){try{const data=first||await next();first=null;controller.enqueue(data);if(start===total){finished=true;controller.close();}}catch(error){controller.error(error);}},cancel(){if(!finished)abort.abort();}});
  return new Response(stream,{headers:{"Content-Type":"application/octet-stream","Content-Length":String(total),"Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(url.searchParams.get("name")||"arquivo"),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 })());
});
