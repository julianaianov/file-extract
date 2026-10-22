"use client";
type DiskWriter = {write:(data:Blob)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>};
type SaveWindow = Window & {showSaveFilePicker?:(options:{suggestedName:string})=>Promise<{createWritable:()=>Promise<DiskWriter>}>};
const PART = 3 * 1024 * 1024;
export async function downloadFile(id: number, filename: string) {
 const picker = (window as SaveWindow).showSaveFilePicker;
 if (!picker && "serviceWorker" in navigator) {
  const registration = await navigator.serviceWorker.register("/downloads/worker.js", {scope:"/downloads/"});
  if (!registration.active) await new Promise<void>((resolve,reject)=>{
   const worker=registration.installing||registration.waiting;
   if (!worker) return reject(Error("Não foi possível preparar o download."));
   const timer=setTimeout(()=>reject(Error("O download demorou a iniciar.")),30000);
   const changed=()=>{if(worker.state==="activated"){clearTimeout(timer);resolve();}else if(worker.state==="redundant"){clearTimeout(timer);reject(Error("Atualize a página e tente novamente."));}};
   worker.addEventListener("statechange",changed);changed();
  });
  const link=document.createElement("a");link.href="/downloads/file-"+id+"?name="+encodeURIComponent(filename);link.download=filename;document.body.appendChild(link);link.click();link.remove();return;
 }
 let writer:DiskWriter|undefined;
 const chunks:Blob[]=[];
 try {
  if(picker)writer=await(await picker.call(window,{suggestedName:filename})).createWritable();
  let start=0,total=Infinity;
  do {
   let response:Response|undefined;
   for(let attempt=0;attempt<3;attempt++){
    try { response=await fetch("/api/files/"+id+"?action=download",{headers:{Range:"bytes="+start+"-"+(start+PART-1)}});
     if(response.ok)break;if(response.status<500)throw Error("Não foi possível acessar o arquivo.");
    }catch(error){if(attempt===2)throw error;}
   }
   if(!response?.ok)throw Error("Não foi possível baixar o arquivo.");
   const blob=await response.blob();
   if(response.status===200){if(start!==0)throw Error("Download incompleto.");if(writer)await writer.write(blob);else chunks.push(blob);break;}
   const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range")||"");
   if(!match||Number(match[1])!==start||Number(match[2])-start+1!==blob.size||blob.size===0||(!Number.isFinite(total)?false:Number(match[3])!==total))throw Error("Download incompleto. Tente novamente.");
   total=Number(match[3]);if(!Number.isSafeInteger(total)||total<start+blob.size)throw Error("Tamanho de download inválido.");
   if(writer)await writer.write(blob);else chunks.push(blob);
   start+=blob.size;
  }while(start<total);
  if(writer)await writer.close();
  else{const url=URL.createObjectURL(new Blob(chunks)),link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 }catch(error){await writer?.abort().catch(()=>{});if(error instanceof DOMException&&error.name==="AbortError")return;throw error;}
}
