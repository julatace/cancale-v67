// ⚠️⚠️ BANC — LES TAMPONS DES BORDEREAUX, TOUS TYPES × TOUS FORMATS (16 nov., lot tampons-parametres)
//
// Julien : « dans un onglet des paramètres, tous les types/formats de bordereaux et où les tamponnages sont
// placés » ; « le Créé par vrm.center, c'est mal placé » ⇒ DÉCISION FINALE : « au-dessus du QR code, comme ça
// même si on met du scotch on le voit » ; puis l'aperçu avant impression (« quand je touche Imprimer, les
// réglages sont appliqués aux bordereaux »).
//
// Ce banc EXÉCUTE le vrai code d'App.jsx (`poserBordereau`, `tamponnerBordereau` et tout ce qu'ils appellent,
// extraits par `_code-impression.cjs`) et src/impression/tampons.js, dans Chromium avec pdf.js, sur les
// bordereaux d'EXEMPLE (formes reconstruites, aucune donnée réelle) de CHAQUE type (Mondial Relay, Relais Colis,
// Chronopost, Colissimo, Vinted Go, UPS, DPD, international, Leboncoin, Vestiaire, retour) sur CHAQUE support (A4,
// 10×15, 10×10, 100×150 avec marge, Dymo 4XL, Brother 62 mm ; « 4 par page » = la page thermique 10×15 rangée par
// quatre), et juge SUR L'IMAGE RENDUE à 203 dpi :
//   A. le QR et le code-barres se DÉCODENT après les tampons (jsQR, ITF lu ligne à ligne) ;
//   B. aucun pixel n'a changé dans le QR + sa zone de silence (4 modules) ni sur le code-barres (+ 10 modules) —
//      comparaison avec le même bordereau imprimé SANS tampon ;
//   C. « Créé par vrm.center » est écrite (texte du PDF), CENTRÉE sur l'axe du QR (écart ≤ 2 % de la largeur), juste
//      AU-DESSUS du QR (ou juste dessous si le dessus est pris : le récit le compte), jamais dans sa zone de silence ;
//   D. le N° est écrit, hors des codes ;
// puis les RÉGLAGES (`vrm_tampons`) : contenu (cases), taille L, place rapide, place posée à la main (et REPOUSSÉE
// hors du QR si elle le touche), exception « seulement Mondial Relay », migration des choix d'avant, place posée
// dans l'aperçu pour UN bordereau, le RETOUR toujours marqué « RETOUR ».
// `BANC_MUTATION=mentionSurQr|ignoreReglage|retourSansRetour|sansRepousse` : la règle réaffaiblie ⇒ rouge (§6.1).
// `CAPTURES=dossier` : chaque page en PNG + la planche `planche-<support>.png` (toutes les vignettes).
require('../_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), http = require('http');
const CI = require('./_code-impression.cjs');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const APP = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
const MUT = process.env.BANC_MUTATION || '';
const CAPT = process.env.CAPTURES || '';
const SEUL = process.env.BANC_SEUL || '';
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const CHROME = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

let regles = CI.regles(), imp = CI.impression(APP);
const DEBUT = '// ── LE TAMPON DU BORDEREAU', FIN = '// ── IMPRIMANTE NORMALE OU THERMIQUE';
let tampon = APP.slice(APP.indexOf(DEBUT), APP.indexOf(FIN));
if (!imp || !/const CLE_TAMPONS/.test(regles)) { console.log('❌ code d’impression ou réglage des tampons introuvable (arbre d’avant ?)'); if (!imp) process.exit(1); }
const muter = (s, a, b) => { if (!s.includes(a)) { dit(false, `mutation « ${MUT} » applicable`, 'motif absent'); return s; } return s.split(a).join(b); };
if (MUT === 'mentionSurQr') tampon = muter(tampon, "  if (q) {\n    const garde = gardeQr(rendu, q), x = q.x + q.w / 2 - bw / 2;", "  if (q) { return { x: q.x + q.w / 2 - bw / 2, y: q.y + q.h / 2 - bh / 2, via: 'qr-dessus', qr: q }; }\n  if (q) {\n    const garde = gardeQr(rendu, q), x = q.x + q.w / 2 - bw / 2;");
if (MUT === 'ignoreReglage') imp = muter(imp, "imp.tampons = (impression && impression.tampons) || reglageTamponsChoisi();", "imp.tampons = reglageTampons(null);");
if (MUT === 'retourSansRetour') imp = muter(imp, "if (imp.retour) imp.ts = { ...imp.ts, contenu: { ...imp.ts.contenu, num: true, titre: true } };", "");
if (MUT === 'sansRepousse') regles = muter(regles, "  if (libre(b0.x, b0.y)) return { x: b0.x, y: b0.y, repousse: false };", "  return { x: b0.x, y: b0.y, repousse: false };");
const SCRIPT = `const chargerPdfjs=async()=>window.pdfjsLib;
let __store={}; const load=(k,d)=>(k in __store?JSON.parse(JSON.stringify(__store[k])):d); const save=(k,v)=>{__store[k]=JSON.parse(JSON.stringify(v));}; const libererOngletPdf=()=>{};
${regles}\n${tampon}\n${imp}
window.__vrm = { poserBordereau, fabriquerBordereau, lireITF, FAMILLES, reglageTampons, avecChoix, avecPlace, aEcrire, store: (v) => { __store = v; }, lireStore: () => __store };`;

const srv = http.createServer((q, r) => {
  const f = q.url.split('?')[0]; let p = '';
  if (f.startsWith('/pdfjs/')) p = path.join(NM, 'pdfjs-dist', 'build', path.basename(f));
  else if (f === '/pdf-lib.js') p = path.join(NM, 'pdf-lib', 'dist', 'pdf-lib.min.js');
  else if (f === '/qrcode.js') p = path.join(NM, 'qrcode-generator', 'dist', 'qrcode.js');
  else if (f === '/jsqr.js') p = path.join(NM, 'jsqr', 'dist', 'jsQR.js');
  if (!p) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><html><body></body></html>'); }
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }); fs.createReadStream(p).pipe(r);
});

const DANS_PAGE = `
const __b64 = (o) => { let s = ''; for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000)); return btoa(s); };
const __oct = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
// Imprime le bordereau d'exemple d'un type sur un support, avec le réglage 'tampons' (null = jamais réglé) et
// le stockage 'store' (migration). Rend { r, b64, pose }.
window.__imprimer = async ({ id, support, tampons = null, store = {}, places = null, numero = '124', titre = 'Veste en jean bleue', taille = '42' }) => {
  const PL = window.PDFLib, fam = __vrm.FAMILLES.find((f) => f.id === id);
  const src = await PL.PDFDocument.load(await __vrm.fabriquerBordereau(PL, window.qrcode, fam.mise, { transporteur: fam.transporteur, service: fam.service, rotation: fam.rotation || 0 }));
  const out = await PL.PDFDocument.create();
  const th = support !== 'a4';
  const imp0 = { format: th && support !== 'planche4' ? support : '10x15', ...(store.vrm_impression || {}) };
  __vrm.store({ ...store, vrm_impression: imp0, ...(tampons ? { vrm_tampons: tampons } : {}) });
  const r = await __vrm.poserBordereau(PL, out, src, { numero, title: fam.retour ? 'RETOUR · ' + titre : titre, pos: null, thermique: th,
    impression: { reg: null, famille: fam.id, site: fam.site || '', retour: !!fam.retour, taille, photo: null, emplacement: '', ...(places ? { places } : {}) } });
  const pose = (r.poses || [])[0] || null;
  return { r: { isole: r.isole, tampons: r.tampons, famille: r.famille }, pose, b64: __b64(await out.save()) };
};
const __lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
// Une page rendue à 'dpmm' px/mm : textes (avec boîte et taille), QR (jsQR), ITF, pixels N&B (pour comparer).
window.__lire = async (b64, n, dpmm, png) => {
  const doc = await pdfjsLib.getDocument({ data: __oct(b64), isEvalSupported: false }).promise;
  try {
    const pg = await doc.getPage(n + 1), v1 = pg.getViewport({ scale: 1 });
    const items = (await pg.getTextContent()).items.map((it) => { const m = pdfjsLib.Util.transform(v1.transform, it.transform); return { s: it.str, x: m[4], y: m[5], l: it.width, t: Math.hypot(m[2], m[3]) }; });
    const s = dpmm * 25.4 / 72, v = pg.getViewport({ scale: s });
    const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: v }).promise;
    const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const bw = new Uint8ClampedArray(d.length); for (let i = 0; i < d.length; i += 4) { const k = __lum(d, i) < 160 ? 0 : 255; bw[i] = bw[i + 1] = bw[i + 2] = k; bw[i + 3] = 255; }
    const qr = jsQR(bw, W, H);
    // ITF : lignes et colonnes, deux sens.
    const itf = new Map();
    const scan = (n2, len, at, boite) => { for (const sens of [1, -1]) { const runs = [], starts = []; let cur = 255, l = 0;
      for (let j = 0; j < len; j++) { const jj = sens > 0 ? j : len - 1 - j; const k = at(jj); if (k === cur) l++; else { runs.push(l); starts.push(j - l); cur = k; l = 1; } }
      runs.push(l); starts.push(len - l);
      for (let i = 1; i < runs.length; i += 2) { if (runs[i - 1] < 6) continue; const L = 4 + 70 + 3, sl = runs.slice(i, i + L); if (sl.length < L) continue;
        const t = __vrm.lireITF(sl); if (!t) continue; const a0 = starts[i], a1 = starts[i + L - 1] + runs[i + L - 1], p0 = sens > 0 ? a0 : len - a1, p1 = sens > 0 ? a1 : len - a0;
        const e = itf.get(t) || { t, b: null }; e.b = boite(n2, p0, p1, e.b); itf.set(t, e); } } };
    const unir = (b, x0, y0, x1, y1) => (b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
    for (let y = 0; y < H; y += 2) scan(y, W, (xx) => bw[(y * W + xx) * 4], (n2, a0, a1, b) => unir(b, a0, n2, a1, n2));
    for (let xx = 0; xx < W; xx += 2) scan(xx, H, (y) => bw[(y * W + xx) * 4], (n2, a0, a1, b) => unir(b, n2, a0, n2, a1));
    const k = 1 / s;
    const q = qr ? { data: qr.data, box: { x: Math.min(qr.location.topLeftCorner.x, qr.location.bottomLeftCorner.x) * k, y: Math.min(qr.location.topLeftCorner.y, qr.location.topRightCorner.y) * k, X: Math.max(qr.location.topRightCorner.x, qr.location.bottomRightCorner.x) * k, Y: Math.max(qr.location.bottomLeftCorner.y, qr.location.bottomRightCorner.y) * k } } : null;
    window.__px = window.__px || {}; const cle = Math.random().toString(36).slice(2); window.__px[cle] = { bw, W, H, s };
    return { w: v1.width, h: v1.height, items, qr: q, itf: [...itf.values()].map((e) => ({ t: e.t, box: { x: e.b.x0 * k, y: e.b.y0 * k, X: e.b.x1 * k, Y: e.b.y1 * k } })), px: cle, png: png ? c.toDataURL('image/png') : null };
  } finally { await doc.destroy(); }
};
// Combien de pixels N&B diffèrent entre deux rendus, dans une boîte (points).
window.__diff = (a, b, box) => { const A = window.__px[a], B = window.__px[b]; if (!A || !B || A.W !== B.W || A.H !== B.H) return -1;
  const s = A.s, x0 = Math.max(0, Math.floor(box.x * s)), y0 = Math.max(0, Math.floor(box.y * s)), x1 = Math.min(A.W, Math.ceil(box.X * s)), y1 = Math.min(A.H, Math.ceil(box.Y * s)); let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * A.W + x) * 4; if (A.bw[i] !== B.bw[i]) n++; } return n; };
// La planche : toutes les vignettes d'un support sur une image (regardée, mise dans le récit).
window.__planche = async (pngs, titre) => { const imgs = await Promise.all(pngs.map((p) => new Promise((ok) => { const im = new Image(); im.onload = () => ok({ im, nom: p.nom }); im.src = p.png; })));
  const L = 260, col = 4, h = Math.max(...imgs.map((x) => x.im.height * L / x.im.width)), rows = Math.ceil(imgs.length / col);
  const c = document.createElement('canvas'); c.width = col * (L + 16) + 16; c.height = rows * (h + 40) + 50; const x = c.getContext('2d'); x.fillStyle = '#eee'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000'; x.font = 'bold 18px sans-serif'; x.fillText(titre, 16, 30);
  imgs.forEach((o, i) => { const X = 16 + (i % col) * (L + 16), Y = 50 + Math.floor(i / col) * (h + 40); const hh = o.im.height * L / o.im.width; x.drawImage(o.im, X, Y, L, hh); x.strokeStyle = '#999'; x.strokeRect(X, Y, L, hh); x.fillStyle = '#000'; x.font = '14px sans-serif'; x.fillText(o.nom, X, Y + hh + 18); });
  return c.toDataURL('image/png'); };
`;

const MM = 72 / 25.4;
const FAMS = ['mondialrelay', 'relaiscolis', 'chronopost', 'colissimo', 'vintedgo', 'ups', 'dpd', 'international', 'leboncoin', 'vestiaire', 'retour'];
const SUPPORTS = ['a4', 'planche4', '10x15', '10x10', '10x15m', 'dymo4xl', 'ql62'];
const SANS = { v: 1, a4: { num: false, titre: false, taille: false, mention: false }, th: { num: false, titre: false, taille: false, mention: false }, types: {}, formes: {} };
const texteBoite = (it) => ({ x: it.x, y: it.y - it.t * 0.8, X: it.x + it.l, Y: it.y + it.t * 0.2 });
const touche = (a, b) => a.x < b.X && a.X > b.x && a.y < b.Y && a.Y > b.y;
const elargi = (b, m) => ({ x: b.x - m, y: b.y - m, X: b.X + m, Y: b.Y + m });
const stats = { dessus: 0, dessous: 0, autre: 0, sans: 0 };

async function un(pg, id, support, o = {}) {
  const t = `${id} · ${support}${o.nom ? ' · ' + o.nom : ''}`;
  let a, z;
  try {
    a = await pg.evaluate((x) => __imprimer(x), { id, support, tampons: o.tampons || null, store: o.store || {}, places: o.places || null, titre: o.titre });
    z = o.sansTemoin ? null : await pg.evaluate((x) => __imprimer(x), { id, support, tampons: SANS, store: {} });
  } catch (e) { dit(false, `${t} : le bordereau sort`, String(e.message || e).split('\n')[0].slice(0, 200)); return null; }
  const n = a.pose ? a.pose.page : 0;
  const L = await pg.evaluate(([b, k, png]) => __lire(b, k, 8, png), [a.b64, n, !!CAPT || !!o.png]);
  const L0 = z ? await pg.evaluate(([b, k]) => __lire(b, k, 8, false), [z.b64, z.pose ? z.pose.page : 0]) : null;
  return { t, a, L, L0 };
}

async function typeSupport(pg, id, support, vignettes) {
  const x = await un(pg, id, support, { png: true }); if (!x) return;
  const { t, a, L, L0 } = x;
  if (L.png) vignettes.push({ nom: `${id}`, png: L.png });
  // A. codes décodés après les tampons
  const qrOk = !!(L.qr && /^VRM-EXEMPLE-/.test(L.qr.data));
  dit(qrOk, `${t} : A. le QR se décode après les tampons`, L.qr ? L.qr.data : 'aucun QR lu');
  dit(L.itf.length > 0 || (L0 && L0.itf.length === 0), `${t} : A. le code-barres se lit (s'il se lisait sans tampon)`, L.itf.map((i) => i.t).join(',') || '—');
  // B. aucun pixel changé sur le QR + 4 modules, ni sur le code-barres + 10 modules (comparé au même SANS tampon)
  if (L0 && L0.qr) {
    const mod = (L0.qr.box.X - L0.qr.box.x) / 29, zone = elargi(L0.qr.box, 4 * mod);
    const d = await pg.evaluate(([p, q, b]) => __diff(p, q, b), [L.px, L0.px, zone]);
    dit(d === 0, `${t} : B. QR + zone de silence intacts (pixels changés : ${d})`);
  }
  for (const c of (L0 ? L0.itf : [])) {
    const d = await pg.evaluate(([p, q, b]) => __diff(p, q, b), [L.px, L0.px, elargi(c.box, 4 * MM)]);
    dit(d === 0, `${t} : B. code-barres ${c.t} + zone de silence intacts (pixels changés : ${d})`);
  }
  // C. la mention : écrite, centrée sur l'axe du QR, juste au-dessus (sinon juste dessous), hors zone de silence
  const m = L.items.find((i) => /Créé par vrm\.center/.test(i.s));
  const qrb = L0 && L0.qr ? L0.qr.box : (L.qr ? L.qr.box : null);
  if (!m) { stats.sans++; dit(false, `${t} : C. « Créé par vrm.center » écrite`, `via=${a.pose && a.pose.mentionBoite ? a.pose.mentionBoite.via : 'rien'}`); }
  else if (qrb) {
    const mb = texteBoite(m), cx = (mb.x + mb.X) / 2, qcx = (qrb.x + qrb.X) / 2, ecart = Math.abs(cx - qcx) / L.w;
    const dessus = mb.Y <= qrb.y, dessous = mb.y >= qrb.Y, gap = dessus ? qrb.y - mb.Y : dessous ? mb.y - qrb.Y : -1;
    const via = a.pose && a.pose.mentionBoite && a.pose.mentionBoite.via;
    if (via === 'qr-dessus') stats.dessus++; else if (via === 'qr-dessous') stats.dessous++; else stats.autre++;
    dit(ecart <= 0.02, `${t} : C. mention centrée sur l'axe du QR (écart ${(ecart * 100).toFixed(2)} % ≤ 2 %)`);
    dit((dessus || dessous) && gap >= 2.5 * MM && gap <= 16 * MM, `${t} : C. mention juste ${dessus ? 'AU-DESSUS' : 'EN DESSOUS'} du QR, hors de sa zone de silence (${(gap / MM).toFixed(1)} mm)`, `via=${via}`);
    dit(m.t <= 7.5 && m.t >= 4.5, `${t} : C. mention petite (${m.t.toFixed(1)} pt)`);
  }
  // D. le N°
  const num = L.items.find((i) => /^N° 124/.test(i.s));
  dit(!!num, `${t} : D. le N° est écrit`);
  if (num && qrb) dit(!touche(texteBoite(num), elargi(qrb, 3 * MM)), `${t} : D. le N° hors du QR`);
  if (id === 'retour') dit(L.items.some((i) => /RETOUR/.test(i.s)), `${t} : le retour est marqué « RETOUR »`);
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const ctx = await nav.newContext({ locale: 'fr-FR' }); const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('   (page) ' + String(e.message).slice(0, 200)));
  await pg.goto(`http://localhost:${PORT}/`);
  for (const s of ['/pdf-lib.js', '/qrcode.js', '/jsqr.js']) await pg.addScriptTag({ url: s });
    await pg.addScriptTag({ type: 'module', content: `import * as m from '/pdfjs/pdf.min.mjs'; m.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'; window.pdfjsLib = { ...m, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } };` });
  await pg.waitForFunction(() => window.pdfjsLib && window.qrcode && window.jsQR, null, { timeout: 15000 });
  await pg.addScriptTag({ content: SCRIPT }); await pg.addScriptTag({ content: DANS_PAGE });
  if (CAPT) fs.mkdirSync(CAPT, { recursive: true });

  // ── 1. CHAQUE TYPE × CHAQUE SUPPORT, avec le réglage d'origine ─────────────
  for (const sup of SUPPORTS) {
    if (SEUL && !SEUL.split(',').includes(sup)) continue;
    console.log(`\n── ${sup}`);
    const vig = [];
    for (const id of FAMS) await typeSupport(pg, id, sup, vig);
    if (CAPT && vig.length) { const p = await pg.evaluate(([v, ti]) => __planche(v, ti), [vig, `Tampons · ${sup} (réglage d'origine)`]); fs.writeFileSync(path.join(CAPT, `planche-${sup}.png`), Buffer.from(p.split(',')[1], 'base64')); }
  }
  console.log(`\n   mention : ${stats.dessus} au-dessus du QR · ${stats.dessous} en dessous · ${stats.autre} ailleurs · ${stats.sans} absente`);

  // ── 2. LES RÉGLAGES ───────────────────────────────────────────────────────
  if (!SEUL || SEUL.includes('reglages')) {
    console.log('\n── réglages');
    const R = (o) => ({ v: 1, a4: { num: true, titre: true, taille: false, mention: true }, th: { num: true, titre: false, taille: false, mention: true }, texte: 'M', texteMention: 'M', place: 'auto', placeMention: 'qr', types: {}, formes: {}, ...o });
    const titreDe = (L) => L.items.some((i) => /Veste en jean/.test(i.s));
    // contenu : N° seul, sans mention
    let x = await un(pg, 'mondialrelay', 'a4', { tampons: R({ a4: { num: true, titre: false, taille: false, mention: false } }), sansTemoin: true });
    dit(x && !titreDe(x.L) && x.L.items.some((i) => /^N° 124/.test(i.s)) && !x.L.items.some((i) => /vrm\.center/.test(i.s)), 'contenu : N° seul, ni titre ni mention (cases du réglage)');
    // taille L
    const xm = await un(pg, 'colissimo', 'a4', { sansTemoin: true }), xl = await un(pg, 'colissimo', 'a4', { tampons: R({ texte: 'L' }), sansTemoin: true });
    const tn = (y) => { const i = y && y.L.items.find((k) => /^N° 124/.test(k.s)); return i ? i.t : 0; };
    dit(tn(xl) > tn(xm) * 1.15, `taille L : le N° plus grand (${tn(xm).toFixed(1)} → ${tn(xl).toFixed(1)} pt)`);
    // place rapide « en bas à droite »
    x = await un(pg, 'mondialrelay', 'a4', { tampons: R({ place: 'bd' }), sansTemoin: true });
    { const i = x && x.L.items.find((k) => /^N° 124/.test(k.s)); dit(i && i.x > x.L.w / 2 && i.y > x.L.h / 2, 'place « en bas à droite » : le N° dans le quart bas-droit', i ? `${i.x.toFixed(0)},${i.y.toFixed(0)}` : '—'); }
    // place posée à la main pour la forme ⇒ le N° y est
    const cleMr = 'mondialrelay·A4·portrait';
    x = await un(pg, 'mondialrelay', 'a4', { tampons: R({ formes: { [cleMr]: { n: { vx: 0.1, vy: 0.1, vw: 0.25, v: 0 } } } }), sansTemoin: true });
    { const i = x && x.L.items.find((k) => /^N° 124/.test(k.s)); dit(i && Math.abs(i.x - (0.1 * 595.28 + 3 * (0.25 * 595.28 / 190))) < 6 && Math.abs((i.y - i.t * 0.8) - 0.1 * 841.89) < 12, 'place à la main (forme Mondial Relay A4) : le N° posé à cet endroit', i ? `${i.x.toFixed(1)},${i.y.toFixed(1)}` : '—'); }
    // place à la main SUR le QR ⇒ repoussée, QR lisible
    const z0 = await un(pg, 'mondialrelay', 'a4', { sansTemoin: true });
    const q = z0.L.qr.box;
    x = await un(pg, 'mondialrelay', 'a4', { tampons: R({ formes: { [cleMr]: { n: { vx: q.x / 595.28, vy: q.y / 841.89, vw: 0.2, v: 0 } } } }) });
    { const i = x && x.L.items.find((k) => /^N° 124/.test(k.s)); dit(x && x.L.qr && i && !touche(texteBoite(i), q) && x.a.pose && x.a.pose.repousse, 'place à la main SUR le QR : repoussée à côté, le QR se lit', `repousse=${x && x.a.pose && x.a.pose.repousse} · QR=${!!(x && x.L.qr)}`); }
    // la mention posée à la main sur le QR ⇒ repoussée
    x = await un(pg, 'mondialrelay', 'a4', { tampons: R({ formes: { [cleMr]: { m: { vx: (q.x + 5) / 595.28, vy: (q.y + 5) / 841.89, vw: 0.1 } } } }) });
    { const i = x && x.L.items.find((k) => /vrm\.center/.test(k.s)); dit(x && x.L.qr && i && !touche(texteBoite(i), q), 'mention posée SUR le QR : repoussée, le QR se lit'); }
    // exception « seulement Mondial Relay »
    const ex = R({ types: { mondialrelay: { contenu: { num: true, titre: false, taille: false, mention: true } } } });
    const a1 = await un(pg, 'mondialrelay', 'a4', { tampons: ex, sansTemoin: true }), a2 = await un(pg, 'colissimo', 'a4', { tampons: ex, sansTemoin: true });
    dit(a1 && a2 && !titreDe(a1.L) && titreDe(a2.L), 'exception « seulement Mondial Relay » : sans titre sur Mondial Relay, titre gardé sur Colissimo');
    // migration : vrm_tampons jamais écrit, vrm_impression.tamponA4 = « num » ⇒ N° seul
    x = await un(pg, 'chronopost', 'a4', { store: { vrm_impression: { tamponA4: 'num' } }, sansTemoin: true });
    dit(x && !titreDe(x.L) && x.L.items.some((i) => /^N° 124/.test(i.s)), 'migration : le choix d’avant (« N° seul » en A4) repris tel quel');
    x = await un(pg, 'chronopost', 'a4', { store: { vrm_tampon_positions: { 'chronopost·A4·paysage': { vx: 0.6, vy: 0.05, vw: 0.2, v: 0 } } }, sansTemoin: true });
    { const i = x && x.L.items.find((k) => /^N° 124/.test(k.s)); dit(i && Math.abs(i.x - 0.6 * 841.89) < 8, 'migration : la place gardée d’avant (vrm_tampon_positions) reprise', i ? i.x.toFixed(1) : '—'); }
    // l'aperçu avant impression : une place pour CE bordereau prime
    x = await un(pg, 'mondialrelay', 'a4', { places: { n: { vx: 0.55, vy: 0.08, vw: 0.25, v: 0 } }, sansTemoin: true });
    { const i = x && x.L.items.find((k) => /^N° 124/.test(k.s)); dit(i && Math.abs(i.x - (0.55 * 595.28 + 3 * (0.25 * 595.28 / 190))) < 6, 'aperçu avant impression : la place posée pour CE bordereau est imprimée', i ? i.x.toFixed(1) : '—'); }
    // le RETOUR reste « RETOUR » même quand le titre est décoché
    x = await un(pg, 'retour', 'a4', { tampons: R({ a4: { num: true, titre: false, taille: false, mention: true } }), sansTemoin: true });
    dit(x && x.L.items.some((i) => /RETOUR/.test(i.s)), 'retour : « RETOUR » écrit même titre décoché');
    x = await un(pg, 'retour', '10x15', { tampons: R({ th: { num: false, titre: false, taille: false, mention: false } }), sansTemoin: true });
    dit(x && x.L.items.some((i) => /RETOUR/.test(i.s)), 'retour thermique : « RETOUR » écrit même tout décoché');
  }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} tampons-reglages : ${ok} verts, ${ko} rouges${MUT ? ` (mutation ${MUT})` : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e.stack || e)); process.exit(1); });
