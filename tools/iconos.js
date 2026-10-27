// Genera el ícono "dona" (paleta pino y salvia) para Android y la web: node tools/iconos.js
// Necesita Playwright para pasar los SVG a PNG.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), RES = path.join(ROOT, 'android/app/src/main/res'), WEB = path.join(ROOT, 'web');
const C = { bg: '#13312A', a: '#F3EEDF', b: '#A8C3A0', c: '#24493E' };
// Segmentos (en grados, desde arriba, sentido horario)
const S1 = [0, 167.48], S2 = [172.77, 274.13];

const pt = (cx, cy, r, g) => { const t = g * Math.PI / 180; return [+(cx + r * Math.sin(t)).toFixed(3), +(cy - r * Math.cos(t)).toFixed(3)]; };
const arco = (cx, cy, r, [g0, g1]) => { const [x0, y0] = pt(cx, cy, r, g0), [x1, y1] = pt(cx, cy, r, g1); return `M${x0},${y0} A${r},${r} 0 ${g1 - g0 > 180 ? 1 : 0} 1 ${x1},${y1}`; };
const circ = (cx, cy, r) => `M${cx - r},${cy} A${r},${r} 0 1 1 ${cx + r},${cy} A${r},${r} 0 1 1 ${cx - r},${cy}`;

function dona(cx, cy, r, w, colores = C) {
  return `<path d="${circ(cx, cy, r)}" fill="none" stroke="${colores.c}" stroke-width="${w}"/>` +
    `<path d="${arco(cx, cy, r, S1)}" fill="none" stroke="${colores.a}" stroke-width="${w}"/>` +
    `<path d="${arco(cx, cy, r, S2)}" fill="none" stroke="${colores.b}" stroke-width="${w}"/>`;
}
const svgIcono = (forma) => { // forma: cuadrado redondeado, círculo o lleno (maskable)
  const fondo = forma === 'circulo' ? `<circle cx="256" cy="256" r="256" fill="${C.bg}"/>` : forma === 'lleno' ? `<rect width="512" height="512" fill="${C.bg}"/>` : `<rect width="512" height="512" rx="116" fill="${C.bg}"/>`;
  const k = forma === 'lleno' ? 0.8 : 1; // el maskable necesita el dibujo más chico
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${fondo}${dona(256, 256, 130 * k, 64 * k)}</svg>`;
};
const vec = (w, inner) => `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${w}dp" android:height="${w}dp" android:viewportWidth="${w}" android:viewportHeight="${w}">\n${inner}\n</vector>\n`;
const vp = (d, col, w, alpha) => `    <path android:pathData="${d}" android:strokeColor="${col}" android:strokeWidth="${w}" android:fillColor="#00000000"${alpha ? ` android:strokeAlpha="${alpha}"` : ''}/>`;
const vdona = (cx, r, w, col = C, mono) => [vp(circ(cx, cx, r), mono ? '#FFFFFFFF' : col.c, w, mono ? '0.35' : null), vp(arco(cx, cx, r, S1), mono ? '#FFFFFFFF' : col.a, w), vp(arco(cx, cx, r, S2), mono ? '#FFFFFFFF' : col.b, w, mono ? '0.7' : null)].join('\n');

// Android: capa del ícono adaptable, versión de un color (íconos temáticos) y la versión redonda chiquita del widget
fs.writeFileSync(path.join(RES, 'drawable/ic_dona_fg.xml'), vec(108, vdona(54, 20, 10)));
fs.writeFileSync(path.join(RES, 'drawable/ic_dona_mono.xml'), vec(108, vdona(54, 20, 10, C, true)));
fs.writeFileSync(path.join(RES, 'drawable/ic_dona_circulo.xml'), vec(24, `    <path android:pathData="${circ(12, 12, 12)}" android:fillColor="${C.bg}"/>\n` + vdona(12, 6.1, 3)));
const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@drawable/ic_dona_fg"/>\n    <monochrome android:drawable="@drawable/ic_dona_mono"/>\n</adaptive-icon>\n`;
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${C.bg}</color>\n</resources>\n`);
fs.writeFileSync(path.join(WEB, 'icon.svg'), svgIcono('cuadrado'));

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  async function png(svg, w, h, file) {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
    await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  // Íconos para Android 7 y anteriores
  for (const [d, n] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
    const dir = path.join(RES, 'mipmap-' + d);
    await png(svgIcono('cuadrado'), n, n, path.join(dir, 'ic_launcher.png'));
    await png(svgIcono('circulo'), n, n, path.join(dir, 'ic_launcher_round.png'));
    try { fs.unlinkSync(path.join(dir, 'ic_launcher_foreground.png')); } catch (e) {}
  }
  // Web
  await png(svgIcono('cuadrado'), 192, 192, path.join(WEB, 'icon-192.png'));
  await png(svgIcono('cuadrado'), 512, 512, path.join(WEB, 'icon-512.png'));
  await png(svgIcono('lleno'), 192, 192, path.join(WEB, 'icon-maskable-192.png'));
  await png(svgIcono('lleno'), 512, 512, path.join(WEB, 'icon-maskable-512.png'));
  // Pantallas de carga: fondo pino con la dona al medio
  const dirs = fs.readdirSync(RES).filter(d => d.startsWith('drawable') && fs.existsSync(path.join(RES, d, 'splash.png')));
  for (const d of dirs) {
    const f = path.join(RES, d, 'splash.png');
    const { w, h } = await p.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); return { w: i.naturalWidth, h: i.naturalHeight }; }, 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
    const s = Math.min(w, h) * 0.32;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${C.bg}"/>${dona(w / 2, h / 2, s * 130 / 512 * 2, s * 64 / 512 * 2)}</svg>`;
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
    await p.screenshot({ path: f, clip: { x: 0, y: 0, width: w, height: h } });
  }
  await b.close(); console.log('íconos listos');
})();
