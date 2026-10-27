// Guarda la app para que abra rápido y sin conexión. Los datos siempre vienen de Supabase.
const CACHE = "finanzas-v3";
const APP = ["./", "index.html", "supabase.js", "config.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "native.js", "fonts/limelight-latin-400-normal.woff2", "fonts/josefin-sans-latin-400-normal.woff2", "fonts/josefin-sans-latin-600-normal.woff2", "fonts/josefin-sans-latin-700-normal.woff2", "fonts/oswald-latin-400-normal.woff2", "fonts/oswald-latin-500-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Supabase y fuentes van directo a la red
  // primero la red (para tener siempre la última versión), y si no hay conexión, lo guardado
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
