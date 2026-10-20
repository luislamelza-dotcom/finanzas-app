/* ---------- Arranque (Supabase) ---------- */
let USER_MAIL="", SB=null, RT=null;

// Misma interfaz de documentos que usaba la web en claude.ai, guardada en la tabla public.docs
function makeDb(uid){
  const cache={}, loading={}, listeners=[];
  const fire=l=>{ const c=cache[l.col]||{}; try{
      if(l.id==null) l.cb({docs:Object.entries(c).map(([id,d])=>({id,exists:true,data:()=>d}))});
      else { const d=c[l.id]; l.cb({id:l.id,exists:d!==undefined,data:()=>d}); }
    }catch(e){ console.error(e); } };
  const emit=col=>listeners.filter(l=>l.col===col).forEach(fire);
  const load=col=>loading[col]||(loading[col]=(async()=>{
    const {data,error}=await SB.from("docs").select("id,data").eq("col",col);
    if(error){ loading[col]=null; throw error; }
    cache[col]={}; (data||[]).forEach(r=>{ cache[col][r.id]=r.data; }); emit(col);
  })());
  const split=p=>{ const i=p.indexOf("/"); return [p.slice(0,i),p.slice(i+1)]; };
  RT=SB.channel("docs-"+uid)
    .on("postgres_changes",{event:"*",schema:"public",table:"docs",filter:"user_id=eq."+uid},p=>{
      const r=(p.new&&p.new.col)?p.new:p.old; if(!r||!r.col) return;
      cache[r.col]=cache[r.col]||{};
      if(p.eventType==="DELETE") delete cache[r.col][r.id]; else cache[r.col][r.id]=p.new.data;
      emit(r.col);
    }).subscribe();
  const err=e=>({code:(e&&e.code==="42501")?"revoked":"unavailable",message:e&&e.message});
  const sub=(col,id,cb,onErr)=>{ const l={col,id,cb}; listeners.push(l); load(col).then(()=>fire(l)).catch(e=>onErr&&onErr(err(e))); return ()=>{ const i=listeners.indexOf(l); if(i>=0) listeners.splice(i,1); }; };
  return {
    collection(col){ return { onSnapshot(cb,onErr){ return sub(col,null,cb,onErr); } }; },
    doc(path){ const [col,id]=split(path); return {
      onSnapshot(cb,onErr){ return sub(col,id,cb,onErr); },
      async set(data){
        cache[col]=cache[col]||{}; cache[col][id]=JSON.parse(JSON.stringify(data)); emit(col);
        const {error}=await SB.from("docs").upsert({user_id:uid,col,id,data},{onConflict:"user_id,col,id"});
        if(error) throw err(error);
      },
      async delete(){
        if(cache[col]) delete cache[col][id]; emit(col);
        const {error}=await SB.from("docs").delete().eq("col",col).eq("id",id);
        if(error) throw err(error);
      }
    }; }
  };
}

// Descargas: en el celu usa "Compartir" (guardar en Drive, mandar por mail…); en la compu, descarga normal
const localDownloads={ async save({filename,data}){
  const blob=data instanceof Blob?data:new Blob([data],{type:filename.endsWith(".csv")?"text/csv":"application/json"});
  try{ const file=new File([blob],filename,{type:blob.type});
    if(navigator.canShare&&navigator.canShare({files:[file]})&&/Android|iPhone|iPad/i.test(navigator.userAgent)){ await navigator.share({files:[file],title:filename}); return; }
  }catch(e){ if(e&&e.name==="AbortError") return; }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
} };

async function iniciarApp(session){
  USER_MAIL=session.user.email||""; $("#login").hidden=true; $("#app").hidden=false;
  downloads=localDownloads; db=makeDb(session.user.id);
  render();
  const onErr=e=>{ if(e&&e.code==="revoked"){ offline=true; render(); } else toast("No se pudo leer la base de datos. Revisá tu conexión."); };
  db.collection("meses").onSnapshot(snap=>{ const m={}; snap.docs.forEach(d=>{ m[d.id]=d.data(); }); S.meses=m; S.loaded.meses=true;
    if(!S._init){ S._init=true; const ks=Object.keys(m).sort(); const cy=String(today.getFullYear()); if(!ks.some(k=>k.startsWith(cy))&&ks.length){ S.year=ks[ks.length-1].slice(0,4); } }
    render(); }, onErr);
  db.doc("config/main").onSnapshot(d=>{ S.cfg=d.exists?d.data():null; S.loaded.cfg=true; if(S.cfg&&S.cfg.tema) aplicarTema(S.cfg.tema); render(); }, onErr);
  db.doc("config/reglas").onSnapshot(d=>{ S.reglas=d.exists?(d.data().map||{}):{}; render(); }, onErr);
  db.doc("config/mercado").onSnapshot(d=>{ S.mercado=d.exists?d.data():null; render(); }, onErr);
  db.collection("resumenes").onSnapshot(snap=>{ const m={}; snap.docs.forEach(d=>{ const v=d.data(); if(v&&Array.isArray(v.lineas)) m[d.id]=v; }); S.resumenes=m; render(); }, onErr);
  db.doc("config/drive").onSnapshot(d=>{ S.driveCfg=d.exists?d.data():{procesados:{}}; render(); }, onErr);
  db.doc("config/cartera").onSnapshot(d=>{ S.cartera=d.exists?d.data():{items:[],snaps:{}}; render(); }, onErr);
}

async function importarRespaldo(){
  const docs=S.impB&&S.impB.docs; if(!docs) return; S.impB=null; render(); toast("Importando…");
  const rows=Object.entries(docs).map(([p,data])=>{ const i=p.indexOf("/"); return {col:p.slice(0,i),id:p.slice(i+1),data}; })
    .filter(r=>r.col&&r.id&&r.data&&typeof r.data==="object");
  let ok=0; for(const r of rows){ try{ await db.doc(r.col+"/"+r.id).set(r.data); ok++; }catch(e){} }
  toast(`Importados ${ok} de ${rows.length} documentos`);
}
document.addEventListener("change",async ev=>{ const t=ev.target; if(t.id!=="impBackup"||!t.files||!t.files[0]) return;
  try{ const j=JSON.parse(await t.files[0].text()); let docs=j&&j.docs;
    if(!docs&&j&&j.meses){ docs={}; for(const [k,v] of Object.entries(j.meses)) docs["meses/"+k]=v; if(j.config) docs["config/main"]=j.config; if(j.reglas) docs["config/reglas"]={map:j.reglas}; if(j.cartera) docs["config/cartera"]=j.cartera; }
    if(!docs||!Object.keys(docs).length) throw 0;
    const cols={}; Object.keys(docs).forEach(p=>{ const c=p.split("/")[0]; cols[c]=(cols[c]||0)+1; });
    S.impB={docs,n:Object.keys(docs).length,resumen:Object.entries(cols).map(([c,n])=>`${n} ${c}`).join(", ")}; render();
  }catch(e){ toast("Ese archivo no parece un respaldo de Finanzas."); }
  t.value=""; });
document.addEventListener("click",async ev=>{ const el=ev.target.closest&&ev.target.closest("[data-act]"); if(!el) return; const a=el.dataset.act;
  if(a==="impbsi") importarRespaldo();
  else if(a==="impbno"){ S.impB=null; render(); }
  else if(a==="logout"){ try{ RT&&SB.removeChannel(RT); }catch(e){} await SB.auth.signOut(); location.reload(); } });

(async()=>{
  const C=window.FINANZAS_CONFIG||{};
  if(!window.supabase||!C.url||!C.anonKey){ $("#login").hidden=false; $("#lgErr").textContent="Falta configurar la conexión con Supabase (config.js)."; return; }
  SB=window.supabase.createClient(C.url,C.anonKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"finanzas-auth"}});
  const {data:{session}}=await SB.auth.getSession();
  if(session) iniciarApp(session); else $("#login").hidden=false;
  $("#loginForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const b=$("#lgBtn"); b.disabled=true; $("#lgErr").textContent="";
    const {data,error}=await SB.auth.signInWithPassword({email:$("#lgMail").value.trim(),password:$("#lgPass").value});
    b.disabled=false;
    if(error){ $("#lgErr").textContent=/invalid/i.test(error.message)?"Mail o contraseña incorrectos.":"No se pudo entrar: "+error.message; return; }
    iniciarApp(data.session); });
  if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
