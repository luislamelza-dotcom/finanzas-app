# Genera web/index.html a partir de la web de claude.ai (finanzas.html), adaptada a Supabase.
import sys
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-claude/38a51800-6000-5601-b734-4fcd1b22d20c/scratchpad/finanzas.html'
s = open(SRC).read()

def R(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (old[:80], s.count(old))
    s = s.replace(old, new)

# ---- cabecera de documento completo
R('''<title>Finanzas de Luis</title>
<meta name="claude:viewport-fit-sides" content="cover">''', '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Finanzas</title>
<meta name="theme-color" content="#1D5866">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">''')
R('''<header class="top">''', '''</head>
<body>
<div id="login" hidden>
  <form id="loginForm" class="login-card">
    <h1>Finanzas</h1>
    <p class="muted" style="margin:0">Entrá con tu cuenta.</p>
    <label class="field">Mail<input id="lgMail" type="email" autocomplete="username" required></label>
    <label class="field">Contraseña<input id="lgPass" type="password" autocomplete="current-password" required></label>
    <button class="btn pri" type="submit" id="lgBtn">Entrar</button>
    <p class="out" id="lgErr" style="margin:0;min-height:1.2em"></p>
  </form>
  <form id="mfaForm" class="login-card" hidden>
    <h1>Código de verificación</h1>
    <p class="muted" style="margin:0">Abrí tu app de autenticación (Google Authenticator, Authy…) y poné el código de 6 números de Finanzas.</p>
    <label class="field">Código<input id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label>
    <button class="btn pri" type="submit" id="mfaBtn">Verificar</button>
    <button class="btn" type="button" id="mfaSalir">Salir</button>
    <p class="out" id="mfaErr" style="margin:0;min-height:1.2em"></p>
  </form>
</div>
<div id="app" hidden>
<header class="top">''')
R('''<div id="toastRoot"></div>''', '''<div id="toastRoot"></div>
</div>
<script src="supabase.js"></script>
<script src="config.js"></script>''')
i = s.rindex('</script>')
s = s[:i] + '</script>\n</body>\n</html>\n'

# ---- estilos base que antes ponía el visor de claude.ai
R('''*{box-sizing:border-box}''', '''*{box-sizing:border-box}
html{color-scheme:light}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font-size:14px;font-family:var(--f-body)}
img{max-width:100%}
[hidden]{display:none!important}
#login{min-height:100vh;display:grid;place-items:center;padding:16px}
.login-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:24px;display:grid;gap:12px;width:min(380px,100%)}
.login-card input{padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}''')

# ---- funciones que llegan en la etapa de IA
R('''  if(!sample) h+=`<div class="banner">Esta función usa Claude desde la página. No está disponible en esta vista; abrí la página desde claude.ai con tu cuenta.</div>`;''',
  '''  if(!sample) h+=`<div class="banner">La lectura automática de resúmenes llega cuando sumemos la IA. Mientras tanto, cargá los consumos como gastos eligiendo la cuenta de la tarjeta.</div>`;''')
R('''  if(!mcp) return `<div class="banner" style="margin-bottom:14px">La lectura desde Google Drive no está disponible en esta vista.</div>`;''',
  '''  if(!mcp) return "";''')

# ---- Ajustes: cuenta e importación
R('''  <section class="card"><div class="sec-h"><h2>Respaldo</h2></div>''', '''  <section class="card"><div class="sec-h"><h2>Cuenta</h2><p>${esc(USER_MAIL||"")}</p></div><button class="btn" data-act="logout">Cerrar sesión</button></section>
  ${mfaBlock()}
  <section class="card"><div class="sec-h"><h2>Importar respaldo</h2><p>El archivo JSON que descargás desde la web de claude.ai o desde acá</p></div>
    <label class="btn" for="impBackup" style="display:inline-block">Elegir archivo de respaldo</label><input id="impBackup" type="file" accept="application/json,.json" hidden>
    ${S.impB?`<div style="margin-top:12px;display:grid;gap:8px"><p style="margin:0">El archivo trae ${S.impB.n} documentos (${esc(S.impB.resumen)}). Si ya tenés datos con el mismo nombre, se reemplazan.</p><div class="row"><button class="btn" data-act="impbno">Cancelar</button><button class="btn pri" data-act="impbsi">Importar</button></div></div>`:""}
  </section>
  <section class="card"><div class="sec-h"><h2>Respaldo</h2></div>''')

# ---- arranque con Supabase en lugar de window.claude
a = s.index('/* ---------- Arranque ---------- */\nrender();')
b = s.rindex('</script>\n</body>')
s = s[:a] + open(__file__.replace('build_app.py', 'boot.js')).read() + s[b:]
open(__file__.replace('tools/build_app.py', 'web/index.html'), 'w').write(s)
print('ok', len(s))
