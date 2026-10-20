// Función "cotizaciones": actualiza el dólar MEP, la UVA y los precios de la cartera.
// La corre un reloj (pg_cron) los días hábiles a las 18:07 y también se puede llamar desde la app.
// Fuentes: dolarapi.com (MEP), API del BCRA (UVA, variable 31) y data912.com (precios de BYMA).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DUENO = "f24ecac1-fd3d-4bba-b26a-fca462bae59a";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const hoyAR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // Argentina, UTC-3
const ahoraAR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 19) + "-03:00";
async function getJSON(url: string) {
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "finanzas-app" }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const errores: string[] = [];

  // Estado anterior (para conservar lo que hoy falle y para no repetir si se llamó hace menos de 10 minutos)
  const { data: prevRow } = await db.from("docs").select("data").eq("user_id", DUENO).eq("col", "config").eq("id", "mercado").maybeSingle();
  const prev: any = prevRow?.data ?? {};
  if (prev.actualizado && Date.now() - Date.parse(prev.actualizado) < 10 * 60_000) return json({ ok: true, repetido: true, mercado: prev });

  // 1. Dólar MEP
  let mep = prev.mep ?? null;
  try {
    const d = await getJSON("https://dolarapi.com/v1/dolares/bolsa");
    if (d?.venta) mep = { v: Number(d.venta), f: String(d.fechaActualizacion ?? "").slice(0, 10) || hoyAR() };
  } catch (e) { errores.push("MEP: " + String(e)); }

  // 2. UVA del día (el BCRA publica valores hacia adelante: tomo el de hoy o el último anterior)
  let uva = prev.uva ?? null;
  try {
    const d = await getJSON("https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/31");
    const det: any[] = d?.results?.[0]?.detalle ?? [];
    const hoy = hoyAR();
    const ok = det.filter((x) => x.fecha <= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    if (ok) uva = { v: Number(ok.valor), f: ok.fecha };
  } catch (e) { errores.push("UVA: " + String(e)); }

  // 3. Precios de la cartera
  const precios: Record<string, any> = { ...(prev.precios ?? {}) };
  const { data: cartRow } = await db.from("docs").select("data").eq("user_id", DUENO).eq("col", "config").eq("id", "cartera").maybeSingle();
  const items: any[] = (cartRow?.data as any)?.items ?? [];
  if (items.length) {
    const px: Record<string, number> = {};
    for (const lista of ["arg_cedears", "arg_bonds", "arg_notes", "arg_stocks", "arg_corp"]) {
      try {
        const arr = await getJSON(`https://data912.com/live/${lista}`);
        for (const q of arr ?? []) { const c = Number(q.c) || Number(q.px_bid) || 0; if (q.symbol && c > 0) px[String(q.symbol).toUpperCase()] = c; }
      } catch (e) { if (lista !== "arg_corp" && lista !== "arg_stocks") errores.push(`${lista}: ${String(e)}`); }
    }
    const hoy = hoyAR();
    for (const t of [...new Set(items.map((p) => String(p.ticker).toUpperCase()))]) {
      const tipo = items.find((p) => String(p.ticker).toUpperCase() === t)?.tipo ?? "";
      const div = ["Bono", "Letra", "ON"].includes(tipo) ? 100 : 1; // BYMA cotiza bonos y letras cada 100 nominales
      const pesos = px[t], dolares = px[t + "D"];
      let ars: number | null = null, usd: number | null = null;
      if (dolares) { usd = dolares / div; ars = pesos ? pesos / div : (mep ? usd * mep.v : null); }
      else if (pesos && mep) { ars = pesos / div; usd = ars / mep.v; }
      if (usd && ars) precios[t] = { ars: Math.round(ars * 100) / 100, usd: Math.round(usd * 10000) / 10000, f: hoy };
      else errores.push(`${t}: sin cotización`);
    }
  }

  // 4. Valor de la cartera al día: se guarda en snaps[mes]; la última corrida del mes queda como cierre
  if (items.length) {
    const valor = items.reduce((a, p) => a + (Number(p.cant) || 0) * (precios[String(p.ticker).toUpperCase()]?.usd ?? (Number(p.precio) || 0)), 0);
    const mes = hoyAR().slice(0, 7);
    const cart: any = { ...(cartRow!.data as any) };
    cart.snaps = { ...(cart.snaps ?? {}), [mes]: Math.round(valor * 100) / 100 };
    await db.from("docs").update({ data: cart }).eq("user_id", DUENO).eq("col", "config").eq("id", "cartera");
  }

  const mercado = { mep, uva, precios, actualizado: ahoraAR(), fuente: "MEP: dolarapi.com · UVA: BCRA · Precios: data912.com (BYMA)", errores };
  const { error } = await db.from("docs").upsert({ user_id: DUENO, col: "config", id: "mercado", data: mercado }, { onConflict: "user_id,col,id" });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, mercado });
});
