/* ---------- Intérprete de movimientos dictados (sin IA) ---------- */
// Entiende frases como "15 lucas en el súper con Ualá", "ayer cargué nafta 50 mil con la visa",
// "me pagaron 80 mil por una impresión", "pagué 30 dólares en efectivo de Spotify".
function parseLocal(txt, c){
  const raw = String(txt||"").trim();
  const t = " " + norm(raw).replace(/[¿?¡!]/g," ").replace(/\s+/g," ") + " ";
  const has = re => re.test(t);

  // tipo
  let tipo = "g";
  if (has(/ (me pagaron|cobre|cobré|me depositaron|ingreso|ingresaron|sueldo|aguinaldo|vendi|vendí|dividendo|renta|reintegro|me devolvieron|me transfirieron) /)) tipo = "i";
  if (has(/ (cuota( \d+)? del (depto|departamento|credito|prestamo|hipotecario)|hipotecario|hipoteca) /)) tipo = "h";
  if (has(/ (invert[ií]|aporte a bull|pase a bull|pasé a bull|mande a bull|mandé a bull) /)) tipo = "v";
  if (has(/ (retire de bull|retiré de bull|rescate|rescat[eé]) /)) tipo = "r";
  if (has(/ (transferi a|transferí a|pase de|pasé de|movi de|moví de) /) && tipo === "g") tipo = "x";

  // moneda y monto
  const usd = has(/ (dolares|dolar|usd|u\$s|verdes|dolarcitos) /);
  let monto = null, mTxt = "";
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)*)\s*(mil|lucas?|luquitas?|k|palos?|millon(?:es)?)?(?=\s)/g)) {
    let n = m[1];
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(n)) n = n.replace(/\./g,"").replace(",",".");
    else if (/^\d+,\d+$/.test(n)) n = n.replace(",",".");
    n = parseFloat(n); if (isNaN(n)) continue;
    const mult = m[2] ? (/^(mil|lucas?|luquitas?|k)$/.test(m[2]) ? 1e3 : 1e6) : 1;
    const v = Math.round(n * mult * 100) / 100;
    if (monto === null || v > monto) { monto = v; mTxt = m[0].trim(); }
  }
  if (monto === null && has(/ (un palo|un millon) /)) monto = 1e6;
  if (monto === null && has(/ (una luca) /)) monto = 1000;

  // fecha
  const d = new Date();
  if (has(/ anteayer /)) d.setDate(d.getDate()-2); else if (has(/ ayer /)) d.setDate(d.getDate()-1);
  const fecha = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

  // cuenta
  const ctas = [
    [/ (la visa|visa) /, "visa_nacion"], [/ (la master|master|mastercard) /, "master_nacion"],
    [/ (uala) /, "uala"], [/ (mercado ?pago|mp) /, "mp"], [/ (cuenta dni|dni) /, "cuentadni"],
    [/ (bull ?market|bull) /, usd ? "bullmarket_usd" : "bullmarket"],
    [/ (efectivo|cash|en mano) /, usd ? "efectivo_usd" : "efectivo"],
    [/ (nacion|banco) /, usd ? "nacion_usd" : "nacion"],
  ];
  let cta = usd ? "nacion_usd" : "nacion";
  for (const [re,id] of ctas) if (re.test(t) && !(tipo==="v" && /bull/.test(String(re)))) { cta = id; break; }
  let cta2 = null;
  if (tipo === "v") { cta2 = "bullmarket"; if (cta === "bullmarket") cta = "nacion"; }
  if (tipo === "r") { cta = usd ? "bullmarket_usd" : "bullmarket"; cta2 = "nacion_usd"; }

  // categoría: primero lo aprendido de los resúmenes, después palabras clave
  let cat = null, sub = "";
  if (tipo === "g") {
    for (const [k,v] of Object.entries((typeof S!=="undefined"&&S.reglas)||{})) { if (k.length>3 && t.includes(" "+k.split(" ")[0]+" ")) { cat=v.cat; sub=v.sub; break; } }
    const kw = [
      [/ (super|supermercado|chino|coto|dia|carrefour|disco|jumbo|vea|almacen|coope) /, "Supermercado","Súper y almacén"],
      [/ (verduleria|verdura|carniceria|carne|pollo) /, "Supermercado","Carnicería y verdulería"],
      [/ (fiambre|fiambreria|picada) /, "Supermercado","Fiambrería"],
      [/ (panaderia|facturas|pan) /, "Supermercado","Panadería"],
      [/ (kiosco|golosinas|alfajor) /, "Supermercado","Kiosco"],
      [/ (pedidos ya|pedidosya|rappi|delivery) /, "Comida afuera","Delivery"],
      [/ (restaurante|resto|cena|almuerzo|bar|cerveza|sushi|pizza|parrilla|hamburguesa) /, "Comida afuera","Restaurantes y bares"],
      [/ (cafe|sanguche|empanadas|wrap|mostaza|burger king|mc ?donalds) /, "Comida afuera","Al paso"],
      [/ (nafta|combustible|ypf|shell|axion|cargue nafta|cargué nafta) /, "Auto","Nafta"],
      [/ (peaje|aubasa|telepase) /, "Auto","Peajes"],
      [/ (cochera|estacionamiento) /, "Auto","Cochera"],
      [/ (mecanico|service|gomeria|lavado) /, "Auto","Mantenimiento"],
      [/ (farmacia|remedio|remedios|medicamento) /, "Salud","Farmacia"],
      [/ (obra social|prepaga|osde) /, "Salud","Obra social"],
      [/ (dentista|odontologo) /, "Salud","Odontología"],
      [/ (gimnasio|gym) /, "Salud","Gimnasio"],
      [/ (luz|edelap|edenor|edesur) /, "Hogar","Luz"], [/ (gas|camuzzi|metrogas) /, "Hogar","Gas"], [/ (agua|absa|aysa) /, "Hogar","Agua"],
      [/ (internet|wifi|cablevision|fibertel|telecentro) /, "Hogar","Internet y cable"],
      [/ (expensas) /, "Hogar","Expensas"], [/ (alquiler) /, "Hogar","Alquiler"],
      [/ (ferreteria|pintura|arreglo|plomero|electricista) /, "Hogar","Mantenimiento y arreglos"],
      [/ (netflix|spotify|disney|max|hbo) /, "Suscripciones","Streaming"], [/ (youtube) /, "Suscripciones","YouTube"], [/ (google|drive) /, "Suscripciones","Google"],
      [/ (celular|personal|claro|movistar) /, "Suscripciones","Celular"],
      [/ (futbol|fulbo) /, "Salidas y ocio","Fútbol"], [/ (helado|heladeria) /, "Salidas y ocio","Helados"], [/ (cine|teatro|recital|entrada) /, "Salidas y ocio","Cine y eventos"],
      [/ (viaje|vacaciones|pasaje|hotel) /, "Salidas y ocio","Viajes"],
      [/ (regalo) /, "Regalos y eventos","Regalos"], [/ (cumple|cumpleanos) /, "Regalos y eventos","Cumpleaños"],
      [/ (ropa|zapatillas|remera|pantalon) /, "Personal","Ropa"], [/ (peluqueria|corte de pelo|barberia) /, "Personal","Peluquería"], [/ (libro) /, "Personal","Libros"],
      [/ (filamento|filamentos) /, "Hobby 3D","Filamentos"], [/ (impresora|repuesto) /, "Hobby 3D","Repuestos"],
      [/ (comision|mantenimiento de cuenta) /, "Bancos y trámites","Comisiones bancarias"],
    ];
    if (!cat) for (const [re,c1,s1] of kw) if (re.test(t)) { cat=c1; sub=s1; break; }
    const tree = c.cats.gasto;
    if (!cat || !tree[cat]) { cat = "Otros"; sub = "Sin clasificar"; }
    if (!(tree[cat]||[]).includes(sub)) sub = (tree[cat]||[])[0] || "";
  } else if (tipo === "i") {
    const ki = [[/ (sueldo) /,"Sueldo"],[/ (aguinaldo) /,"Aguinaldo"],[/ (impresion|impresiones|llavero|3d) /,"Impresiones 3D"],[/ (freelance|trabajo|proyecto) /,"Freelance"],[/ (dividendo) /,"Dividendos"],[/ (renta) /,"Rentas de bonos"],[/ (reintegro|devolvieron) /,"Reintegros"],[/ (interes|intereses|rendimiento) /,"Intereses"],[/ (premio|bono) /,"Premio laboral"]];
    cat = "Otros ingresos"; for (const [re,k] of ki) if (re.test(t) && c.cats.ingreso[k]) { cat=k; break; }
  } else if (tipo === "h") { cat = "Cuota"; }

  // descripción: lo que se dijo, sin el monto
  let d2 = raw.replace(new RegExp(mTxt.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"), "").replace(/\s+/g," ").trim();
  d2 = d2.replace(/^(gaste|gasté|pague|pagué|compre|compré)\s+/i,"");
  d2 = d2.charAt(0).toUpperCase() + d2.slice(1);

  return { t: tipo, f: fecha, m: monto, mon: usd ? "USD" : "ARS", cta, cta2, cat, sub, d: d2.slice(0,80) };
}
