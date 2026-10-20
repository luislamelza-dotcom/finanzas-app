// Función "claude": la app le pasa un texto (y opcionalmente imágenes) y devuelve la respuesta de Claude.
// La clave de la API vive solo acá, como secreto (ANTHROPIC_API_KEY). Solo responde al dueño de la app
// y, si tiene la verificación en dos pasos activada, solo a sesiones que pasaron el código.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODELOS: Record<string, string> = {
  quick: "claude-haiku-5-5",     // dictado: rápido y casi gratis
  default: "claude-sonnet-5-5",  // resúmenes de tarjeta: más preciso
  complex: "claude-sonnet-5-5",
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "invalid_request", message: "Usá POST" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const [{ data: dueno }, { data: aalOk }] = await Promise.all([sb.rpc("es_dueno"), sb.rpc("aal_ok")]);
    if (dueno !== true || aalOk !== true) return json({ code: "not_granted", message: "Sin permiso" }, 403);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ code: "sampling_disabled", message: "Falta cargar ANTHROPIC_API_KEY en Supabase" }, 500);

    const body = await req.json();
    const tier = MODELOS[body.tier] ? body.tier : "default";
    const input = body.input;
    if (!input || (typeof input !== "string" && !Array.isArray(input))) return json({ code: "invalid_request", message: "Falta el texto" }, 400);
    if (JSON.stringify(input).length > 300_000) return json({ code: "prompt_too_large", message: "Texto demasiado largo" }, 413);

    const messages: any[] = typeof input === "string" ? [{ role: "user", content: input }] : input.map((m: any) => ({ role: m.role, content: String(m.content) }));
    const images = Array.isArray(body.images) ? body.images.slice(0, 5) : [];
    if (images.length) {
      const last = messages[messages.length - 1];
      last.content = [
        ...images.map((im: any) => ({ type: "image", source: { type: "base64", media_type: im.type || "image/jpeg", data: im.data } })),
        { type: "text", text: String(last.content) },
      ];
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELOS[tier],
        max_tokens: tier === "quick" ? 1024 : 8192,
        ...(body.json ? { system: "Tu respuesta va a ser leída por un programa: respondé solo con JSON válido, sin texto antes ni después." } : {}),
        messages,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      const code = r.status === 429 ? "rate_limited" : r.status === 401 ? "sampling_disabled" : "upstream_error";
      return json({ code, message: d?.error?.message ?? "Error de la API de Claude" }, 502);
    }
    const text = (d.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    return json({ text, truncated: d.stop_reason === "max_tokens", modelo: d.model, usage: d.usage });
  } catch (e) {
    return json({ code: "upstream_error", message: String(e) }, 500);
  }
});
