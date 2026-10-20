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
  downloads=localDownloads; db=makeDb(session.user.id); sample=crearSample(); mfaCargar();
  render();
  const onErr=e=>{ if(e&&e.code==="revoked"){ offline=true; render(); } else toast("No se pudo leer la base de datos. Revisá tu conexión."); };
  db.collection("meses").onSnapshot(snap=>{ const m={}; snap.docs.forEach(d=>{ m[d.id]=d.data(); }); S.meses=m; S.loaded.meses=true;
    if(!S._init){ S._init=true; const ks=Object.keys(m).sort(); const cy=String(today.getFullYear()); if(!ks.some(k=>k.startsWith(cy))&&ks.length){ S.year=ks[ks.length-1].slice(0,4); } }
    render(); if(!APP_LISTA){ APP_LISTA=true; setTimeout(ejecutarLink,50); } }, onErr);
  db.doc("config/main").onSnapshot(d=>{ S.cfg=d.exists?d.data():null; S.loaded.cfg=true; if(S.cfg&&S.cfg.tema) aplicarTema(S.cfg.tema); render(); }, onErr);
  db.doc("config/reglas").onSnapshot(d=>{ S.reglas=d.exists?(d.data().map||{}):{}; render(); }, onErr);
  db.doc("config/mercado").onSnapshot(d=>{ S.mercado=d.exists?d.data():null; render(); }, onErr);
  db.collection("resumenes").onSnapshot(snap=>{ const m={}; snap.docs.forEach(d=>{ const v=d.data(); if(v&&Array.isArray(v.lineas)) m[d.id]=v; }); S.resumenes=m; render(); }, onErr);
  db.doc("config/drive").onSnapshot(d=>{ S.driveCfg=d.exists?d.data():{procesados:{}}; render(); }, onErr);
  db.doc("config/cartera").onSnapshot(d=>{ S.cartera=d.exists?d.data():{items:[],snaps:{}}; render(); }, onErr);
}


/* ---------- Verificación en dos pasos (TOTP) ---------- */
S.mfa={factors:null,enroll:null,msg:"",busy:false};
async function mfaCargar(){ const {data,error}=await SB.auth.mfa.listFactors(); if(error) return; S.mfa.factors=(data.totp||[]).filter(f=>f.status==="verified"); render(); }
function mfaBlock(){
  const m=S.mfa; const fs=m.factors;
  let h=`<section class="card"><div class="sec-h"><h2>Verificación en dos pasos</h2><p>Además de la contraseña, un código de 6 números de una app en tu celu</p></div>`;
  if(fs===null) return h+`<p class="muted" style="margin:0">Cargando…</p></section>`;
  if(m.enroll){
    h+=`<ol style="margin:0;padding-left:20px;display:grid;gap:10px">
      <li>Instalá en el celu <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> o <b>Authy</b> (cualquiera sirve).</li>
      <li>En esa app, tocá “Agregar” y escaneá este código:<div style="background:#fff;padding:10px;border-radius:10px;width:max-content;max-width:100%;margin-top:8px"><img src="${m.enroll.qr}" alt="Código QR para la app de autenticación" width="180" height="180"></div>
        <span class="muted" style="font-size:.84rem">Si estás en el mismo celu y no podés escanear, cargá esta clave a mano: <code style="user-select:all;word-break:break-all">${esc(m.enroll.secret)}</code></span></li>
      <li>Escribí el código de 6 números que te muestra la app:<form id="mfaEnrollForm" class="row" style="margin-top:6px"><input id="mfaEnrollCode" class="num" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="width:120px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"><button class="btn pri" type="submit" ${m.busy?"disabled":""}>Activar</button><button class="btn" type="button" data-act="mfacancel">Cancelar</button></form></li></ol>`;
  } else if(fs.length){
    h+=`<p style="margin:0 0 10px"><span class="in">● Activada</span> en ${fs.length} ${fs.length===1?"dispositivo":"dispositivos"}: ${fs.map(f=>esc(f.friendly_name||"app")).join(", ")}.</p>
      ${fs.length===1?`<p class="muted" style="margin:0 0 10px;font-size:.86rem">Te recomiendo agregar un segundo dispositivo de respaldo (otro celu, o la misma clave en otra app). Supabase no da códigos de recuperación: si perdés el único, hay que sacarlo desde el panel de Supabase.</p>`:""}
      <div class="row"><button class="btn" data-act="mfaadd">Agregar otro dispositivo</button>${fs.map(f=>`<button class="btn danger sm" data-act="mfadel" data-id="${f.id}">${S.mfaConfirm===f.id?"Tocá de nuevo para quitar":"Quitar "+esc(f.friendly_name||"app")}</button>`).join("")}</div>`;
  } else {
    h+=`<p class="muted" style="margin:0 0 10px">Está desactivada. Si alguien consiguiera tu contraseña, igual no podría entrar sin el código de tu celu.</p><button class="btn pri" data-act="mfaadd">Activar verificación en dos pasos</button>`;
  }
  if(m.msg) h+=`<p class="out" style="margin:10px 0 0">${esc(m.msg)}</p>`;
  return h+`</section>`;
}
async function mfaEmpezar(){
  S.mfa.msg="";
  const {data:lst}=await SB.auth.mfa.listFactors();
  for(const f of ((lst&&lst.all)||[]).filter(f=>f.status!=="verified")){ await SB.auth.mfa.unenroll({factorId:f.id}).catch(()=>{}); }
  const n=((lst&&lst.totp)||[]).filter(f=>f.status==="verified").length;
  const {data,error}=await SB.auth.mfa.enroll({factorType:"totp",friendlyName:n?"Respaldo "+(n+1):"Celular",issuer:"Finanzas"});
  if(error){ S.mfa.msg="No se pudo empezar: "+error.message; render(); return; }
  const q=data.totp.qr_code||""; S.mfa.enroll={id:data.id,qr:q.startsWith("data:")?q:"data:image/svg+xml;utf-8,"+encodeURIComponent(q),secret:data.totp.secret}; render();
}
async function mfaConfirmar(code){
  S.mfa.busy=true; S.mfa.msg=""; render();
  const {error}=await SB.auth.mfa.challengeAndVerify({factorId:S.mfa.enroll.id,code});
  S.mfa.busy=false;
  if(error){ S.mfa.msg="El código no coincide. Revisá que sea el de Finanzas y que la hora del celu esté bien."; render(); return; }
  S.mfa.enroll=null; toast("Verificación en dos pasos activada"); await mfaCargar();
}
document.addEventListener("submit",ev=>{ if(ev.target.id!=="mfaEnrollForm") return; ev.preventDefault(); const c=(document.getElementById("mfaEnrollCode").value||"").replace(/\D/g,""); if(c.length===6) mfaConfirmar(c); });
document.addEventListener("click",async ev=>{ const el=ev.target.closest&&ev.target.closest("[data-act]"); if(!el) return; const a=el.dataset.act;
  if(a==="mfaadd") mfaEmpezar();
  else if(a==="mfacancel"){ const id=S.mfa.enroll&&S.mfa.enroll.id; S.mfa.enroll=null; render(); if(id) SB.auth.mfa.unenroll({factorId:id}).catch(()=>{}); }
  else if(a==="mfadel"){ if(S.mfaConfirm!==el.dataset.id){ S.mfaConfirm=el.dataset.id; render(); return; } S.mfaConfirm=null; const {error}=await SB.auth.mfa.unenroll({factorId:el.dataset.id}); if(error) toast("No se pudo quitar: "+error.message); else { await SB.auth.refreshSession().catch(()=>{}); toast("Dispositivo quitado"); } mfaCargar(); }
});
// Después de la contraseña: si tiene 2FA, pedir el código antes de abrir la app
async function pasoMfa(session){
  const {data}=await SB.auth.mfa.getAuthenticatorAssuranceLevel();
  if(data&&data.nextLevel==="aal2"&&data.currentLevel!=="aal2"){
    $("#login").hidden=false; $("#loginForm").hidden=true; $("#mfaForm").hidden=false; $("#mfaCode").value=""; $("#mfaCode").focus(); return;
  }
  iniciarApp(session);
}


/* ---------- Widget del celu y dictado ---------- */
let APP_LISTA=false, LINK_PEND=null;
function manejarLink(url){ LINK_PEND=url; if(APP_LISTA) ejecutarLink(); }
function ejecutarLink(){ const u=LINK_PEND; LINK_PEND=null; if(!u) return;
  if(/\/\/(voz|nuevo)/.test(u)){ S.tab="movs"; try{localStorage.setItem("fin_tab","movs")}catch(e){} S.year=String(today.getFullYear()); S.month=today.getMonth()+1; render(); closeForm(); openForm(null);
    const m=u.match(/[?&]t=([^&]*)/); const dicho=m?decodeURIComponent(m[1].replace(/\+/g," ")):"";
    if(dicho){ F._q=dicho; drawForm(); quickParse(); }   // ya se grabó desde el widget: completar y confirmar
    else if(/\/\/voz/.test(u)) dictar(); } }
async function dictar(){
  if(!document.getElementById("movForm")) openForm(null);
  readForm(); F._qmsg="Escuchando… hablá cuando aparezca el micrófono"; drawForm();
  try{ const txt=await NATIVO.voz();
    if(!txt){ F._qmsg="No te escuché. Tocá Dictar y probá de nuevo."; drawForm(); return; }
    F._q=txt; F._qmsg=""; drawForm(); await quickParse();
  }catch(e){ F._qmsg = e&&e.message==="permiso" ? "Necesito permiso para usar el micrófono (Ajustes del celu → Apps → Finanzas → Permisos)." : "No se pudo usar el micrófono en este dispositivo."; drawForm(); }
}
document.addEventListener("click",ev=>{ const el=ev.target.closest&&ev.target.closest("[data-act=qvoz]"); if(el&&F&&!F._qbusy) dictar(); });
if(window.NATIVO) NATIVO.onLink(manejarLink);


/* ---------- IA: Claude vía la función de Supabase (la clave nunca está en la app) ---------- */
function blobB64(b){ return new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]||""); r.onerror=ko; r.readAsDataURL(b); }); }
function crearSample(){
  const call=async(input,opts={},asJson=false)=>{
    if(opts.signal&&opts.signal.aborted) throw {code:"cancelled"};
    const images=[]; if(opts.images){ for(const b of Array.from(opts.images.length!=null?opts.images:[opts.images]).slice(0,5)) images.push({type:b.type||"image/jpeg",data:await blobB64(b)}); }
    const {data,error}=await SB.functions.invoke("claude",{body:{input,tier:opts.modelTier||"default",json:asJson,images}});
    if(opts.signal&&opts.signal.aborted) throw {code:"cancelled"};
    if(error){ let code="upstream_error", message=error.message; try{ const b=await error.context.json(); code=b.code||code; message=b.message||message; }catch(e){} throw {code,message}; }
    if(opts.onText) try{ opts.onText({text:data.text,delta:data.text}); }catch(e){}
    return {text:data.text,truncated:!!data.truncated,modelTierApplied:opts.modelTier||"default"};
  };
  const f=(input,opts)=>call(input,opts,false);
  f.json=async(input,opts)=>{ const d=await call(input,opts,true); const t=(d.text||"").trim();
    try{ return JSON.parse(t); }catch(e){}
    const m=t.match(/```(?:json)?\s*([\s\S]*?)```/); if(m) try{ return JSON.parse(m[1]); }catch(e){}
    const ii=[t.indexOf("{"),t.indexOf("[")].filter(x=>x>=0); const i=ii.length?Math.min(...ii):-1, k=Math.max(t.lastIndexOf("}"),t.lastIndexOf("]"));
    if(i>=0&&k>i) try{ return JSON.parse(t.slice(i,k+1)); }catch(e){}
    throw {code:"invalid_json",message:"La respuesta no era JSON",text:t}; };
  f.limits=async()=>({maxPromptBytes:262144,images:{maxCount:5,maxInputBytes:5e6,mediaTypes:["image/jpeg","image/png","image/webp"]}});
  return f;
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
  if(session) pasoMfa(session); else $("#login").hidden=false;
  $("#loginForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const b=$("#lgBtn"); b.disabled=true; $("#lgErr").textContent="";
    const {data,error}=await SB.auth.signInWithPassword({email:$("#lgMail").value.trim(),password:$("#lgPass").value});
    b.disabled=false;
    if(error){ $("#lgErr").textContent=/invalid/i.test(error.message)?"Mail o contraseña incorrectos.":"No se pudo entrar: "+error.message; return; }
    pasoMfa(data.session); });
  $("#mfaForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const b=$("#mfaBtn"); const code=($("#mfaCode").value||"").replace(/\D/g,""); if(code.length!==6){ $("#mfaErr").textContent="Son 6 números."; return; } b.disabled=true; $("#mfaErr").textContent="";
    const {data:lf}=await SB.auth.mfa.listFactors(); const f=((lf&&lf.totp)||[]).find(x=>x.status==="verified");
    const {error}=f?await SB.auth.mfa.challengeAndVerify({factorId:f.id,code}):{error:{message:"sin factor"}};
    b.disabled=false; if(error){ $("#mfaErr").textContent="Código incorrecto. Probá con el siguiente que muestre la app."; return; }
    const {data:{session}}=await SB.auth.getSession(); $("#mfaForm").hidden=true; $("#loginForm").hidden=false; iniciarApp(session); });
  $("#mfaSalir").addEventListener("click",async()=>{ await SB.auth.signOut(); location.reload(); });
  if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
