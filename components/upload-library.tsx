"use client";
import { useState } from "react";
import { FolderOpen, ChevronRight, Search } from "lucide-react";
export interface LibraryUpload { id: number; original_name: string; file_size: number; total_files: number; status: string; upload_date: string }
export function UploadLibrary({uploads, loading, onSelect}: {uploads: LibraryUpload[]; loading: boolean; onSelect: (id:number)=>void}) {
 const [query,setQuery]=useState(""), [page,setPage]=useState(1);
 const matches=uploads.filter(u=>u.original_name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const pages=Math.max(1,Math.ceil(matches.length/12)), current=Math.min(page,pages);
 return <div className="library-body">
  <p className="mb-4 text-sm text-muted-foreground">Selecione um envio para ver somente seus arquivos e pesquisar o conteúdo.</p>
  <label className="search-field mb-5"><Search size={18}/><input className="w-full bg-transparent py-3 outline-none" aria-label="Buscar envios" placeholder="Buscar um envio pelo nome..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label>
  {loading ? <div role="status" className="skeleton h-40 rounded-xl">Carregando envios...</div> : matches.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   {matches.slice((current-1)*12,current*12).map(u=><button key={u.id} onClick={()=>onSelect(u.id)} className="group flex min-w-0 items-center gap-3 rounded-xl border border-cyan-300/15 bg-slate-900 p-4 text-left transition hover:border-cyan-300/60 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-300">
    <FolderOpen className="shrink-0 text-cyan-300" size={27}/>
    <span className="min-w-0 flex-1"><strong className="block truncate">{u.original_name}</strong><span className="mt-1 block text-xs text-muted-foreground">{u.total_files} arquivo(s) · {(Number(u.file_size)/1024/1024).toFixed(2)} MB</span><span className="text-xs text-muted-foreground">{new Date(u.upload_date).toLocaleDateString("pt-BR")} · {u.status==="completed"?"Pronto":u.status==="error"?"Com erro":"Processando"}</span></span><ChevronRight size={16} className="shrink-0 text-cyan-300"/>
   </button>)}
  </div> : <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{query?"Nenhum envio com esse nome.":"Seus envios aparecerão aqui, cada um com seus próprios arquivos."}</p>}
  {pages>1&&<div className="mt-5 flex items-center justify-center gap-4"><button disabled={current===1} onClick={()=>setPage(current-1)} className="disabled:opacity-40">Anterior</button><span className="text-sm">{current} / {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)} className="disabled:opacity-40">Próxima</button></div>}
 </div>;
}
