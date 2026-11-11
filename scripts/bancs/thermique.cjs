// ⚠️⚠️ BANC — LES BORDEREAUX POUR IMPRIMANTE THERMIQUE, PERSONNALISABLES (11 nov.)
//
// Julien : « bordereaux pour imprimante thermique, PERSONNALISABLES en fonction de
// l'imprimante ; tu dois prendre en compte le tamponnage ; peut-être qu'il ne veut
// pas le titre du produit dessus car visible ».
//
// Ce banc EXÉCUTE le vrai code d'App.jsx (`poserBordereau` et tout ce qu'il appelle,
// extraits par `_code-impression.cjs`) et les règles de src/impression/, dans
// Chromium avec pdf.js, sur des bordereaux INVENTÉS (src/impression/bordereauExemple.js :
// un vrai code-barres 2/5 entrelacé, un vrai QR, une adresse inventée — aucun vrai
// bordereau dans le dépôt PUBLIC), de six formes : A4 notice + étiquette (Mondial
// Relay / Vinted), A4 couchée en colonnes (Chronopost), A4 à DEUX et à QUATRE
// étiquettes, 10×15 (Colissimo, InPost), 150×100 couchée (Relais Colis).
// Sur chaque papier (10×15, 10×10, 100×150 avec marge, Dymo 4XL, Brother QL 62 mm
// continu, « Autre » 80 × 120 mm), il imprime puis REND chaque page à 203 dpi (la
// résolution d'une tête thermique) et juge :
//   A. une page par étiquette (2 et 4 étiquettes par A4 découpées), au format du papier ;
//   B. chaque code-barres et chaque QR se DÉCODENT (ITF lu ligne à ligne, QR par jsQR)
//      et désignent la BONNE étiquette — ou l'app a dit « code trop fin » (jamais en silence) ;
//   C. rien n'est rogné : les quatre coins du contenu (« Point Relais · 24R », l'adresse,
//      le pays) sont sur la page, dans la marge ; le QR reste carré (aucune déformation) ;
//   D. la notice et la fiche destinataire ne sont PAS sur l'étiquette ;
//   E. le tampon : « N° B125 » présent, le titre ABSENT par défaut ; « N° + titre »,
//      « + taille » et « Rien » font ce qu'ils disent ; jamais à moins de 4 mm d'un
//      code décodé ni sur l'adresse ;
//   F. « noir pur » : aucun gris sur la page (rendue à 300 dpi) ;
//   G. sans place sûre (10×15 pleine) : la fiche de préparation suit (N°, titre, taille,
//      du même papier) ; fiche coupée : rien de tamponné et l'issue le dit (« aucun ») ;
//   H. l'étiquette occupe le papier (recadrée sur sa zone utile).
// `BANC_MUTATION=sansDecoupe|deforme|rogne|gris|titre|sansBloques|sansRecadrage` : la
// règle réaffaiblie, le banc doit virer au rouge (§6.1). `CAPTURES=dossier` : PNG.
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
const PORT = Number(process.env.BANC_PORT) || 8793;
const CHROME = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// ── Le vrai code ────────────────────────────────────────────────────────────
let regles = CI.regles(), imp = CI.impression(APP);
const DEBUT = '// ── LE TAMPON DU BORDEREAU', FIN = '// ── IMPRIMANTE NORMALE OU THERMIQUE';
let tampon = APP.slice(APP.indexOf(DEBUT), APP.indexOf(FIN));
if (!imp) {
  // Arbre d'AVANT : les blocs d'origine (la découpe 100×150 seule) — le banc doit y être rouge.
  const m = (re) => { const x = re.exec(APP); return x ? x[0] : ''; };
  const bloc = (n) => m(new RegExp(`const ${n} = (?:async )?\\([\\s\\S]*?\\n\\};`));
  const ligne = (n) => m(new RegExp(`const ${n} = [^\\n]*\\n`));
  imp = [m(/const PAS_L_ETIQUETTE = \/[^\n]*\n/), m(/const _mulM = \([^\n]*\n/), m(/const _apM = \([^\n]*\n/), ligne('MM_PT'), ligne('ETIQ_TH'), ligne('TAILLES_ETIQUETTE'), ligne('TH_MARGE'),
    bloc('relevePage'), bloc('_couperSelon'), bloc('estTailleEtiquette'), bloc('avecSens'), bloc('zoneEtiquette'), bloc('placementThermique'), bloc('poserEtiquettesThermiques'), bloc('poserBordereau')].join('\n');
  // Le générateur des bordereaux inventés vient du code ACTUEL (il n'existait pas).
  regles = CI.sansExport(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'impression', 'bordereauExemple.js'), 'utf8'));
  if (!/const fabriquerBordereau/.test(regles)) throw Error('bordereauExemple.js introuvable');
}
const muter = (s, a, b) => { if (!s.includes(a)) { dit(false, `mutation « ${MUT} » applicable`, 'motif absent'); return s; } return s.split(a).join(b); };
if (MUT === 'sansDecoupe') regles = muter(regles, 'if (parts.length < 2 || etiquettes.length < 2) return null;', 'return null;');
if (MUT === 'deforme') imp = muter(imp, 'xScale: pl.s, yScale: pl.s, rotate: PL.degrees(pl.angle)', 'xScale: pl.s, yScale: pl.s * 0.8, rotate: PL.degrees(pl.angle)');
if (MUT === 'rogne') regles = muter(regles, 'return { tourne, lw, lh, s: Math.min(dispoW / lw, dispoH / lh, agrandi) };', 'return { tourne, lw, lh, s: Math.min(dispoW / lw, agrandi) };');
if (MUT === 'gris') regles = muter(regles, "const v = lum(pixels, i) < seuil ? 0 : 255;", "const v = lum(pixels, i);");
if (MUT === 'titre') regles = muter(regles, "if (m === 'num') return { numero: n, titre: '' };", "if (m === 'num') return { numero: n, titre: t };");
if (MUT === 'sansBloques') imp = muter(imp, 'const bloques = [...codes.map((c) => elargir(c.boite, MENTION.codes)), ...adresses];', 'const bloques = [];');
if (MUT === 'sansRecadrage') imp = muter(imp, 'const b = boiteEncre(carte, z, Math.round(3 * MM_PT * S)) || z;', 'const b = z;');
const SCRIPT = `const chargerPdfjs=async()=>window.pdfjsLib;
let __store={}; const load=(k,d)=>(k in __store?JSON.parse(JSON.stringify(__store[k])):d); const save=(k,v)=>{__store[k]=JSON.parse(JSON.stringify(v));}; const libererOngletPdf=()=>{};
${regles}\n${tampon}\n${imp}
window.__vrm = { poserBordereau, fabriquerBordereau, lireITF, store: (v) => { __store = v; } };
try { window.__vrm.analyserZone = analyserZone; window.__vrm.zoneEtiquette = zoneEtiquette; } catch (_) {}`;

// ── Le serveur ──────────────────────────────────────────────────────────────
const srv = http.createServer((q, r) => {
  const f = q.url.split('?')[0]; let p = '';
  if (f.startsWith('/pdfjs/')) p = path.join(NM, 'pdfjs-dist', 'build', path.basename(f));
  else if (f === '/pdf-lib.js') p = path.join(NM, 'pdf-lib', 'dist', 'pdf-lib.min.js');
  else if (f === '/qrcode.js') p = path.join(NM, 'qrcode-generator', 'dist', 'qrcode.js');
  else if (f === '/jsqr.js') p = path.join(NM, 'jsqr', 'dist', 'jsQR.js');
  if (!p) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><html><body></body></html>'); }
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/javascript' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });

const DANS_PAGE = `
const __b64 = (o) => { let s = ''; for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000)); return btoa(s); };
const __oct = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
// Le NOIR PUR jugé sur les OCTETS : chaque image de la page, décompressée — un échantillon
// qui n'est ni 0 ni 255 est du gris. (Un rendu à l'écran lisse les bords : il mentirait.)
window.__grisImages = async (b64) => {
  const PL = window.PDFLib, d = await PL.PDFDocument.load(__oct(b64)); let n = 0, gris = 0, images = 0;
  for (const [, o] of d.context.enumerateIndirectObjects()) {
    if (!(o instanceof PL.PDFRawStream)) continue;
    const st = o.dict.get(PL.PDFName.of('Subtype')); if (!st || st.asString() !== '/Image') continue;
    const sm = o.dict.get(PL.PDFName.of('SMask')); images++;
    let px; try { px = PL.decodePDFRawStream(o).decode(); } catch (_) { continue; }
    for (let i = 0; i < px.length; i++) { n++; if (px[i] !== 0 && px[i] !== 255) gris++; }
  }
  return { images, n, gris };
};
window.__fabriquer = async (mise, o = {}) => __b64(await __vrm.fabriquerBordereau(window.PDFLib, window.qrcode, mise, o || {}));
window.__imprimer = async (b64, reg, numero, titre, taille) => {
  const PL = window.PDFLib, src = await PL.PDFDocument.load(__oct(b64)), out = await PL.PDFDocument.create();
  __vrm.store({ vrm_impression: reg });
  const r0 = await __vrm.poserBordereau(PL, out, src, { numero, title: titre, pos: null, thermique: true, impression: { reg: null, taille } });
  return { r0, b64: __b64(await out.save()) };
};
const __lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
// Une page rendue à 'dpmm' px/mm : textes, QR, ITF, gris, encre.
window.__lire = async (b64, dpmm, png) => {
  const doc = await pdfjsLib.getDocument({ data: __oct(b64), isEvalSupported: false }).promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pg = await doc.getPage(n), v1 = pg.getViewport({ scale: 1 });
      const items = (await pg.getTextContent()).items.map((it) => { const m = pdfjsLib.Util.transform(v1.transform, it.transform); return { s: it.str, x: m[4], y: m[5], l: it.width, t: Math.hypot(m[2], m[3]) }; });
      const s = dpmm * 25.4 / 72, v = pg.getViewport({ scale: s });
      const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
      const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: v }).promise;
      const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
      // Le noir et blanc d'une tête thermique : chaque point est noir ou blanc.
      const bw = new Uint8ClampedArray(d.length); for (let i = 0; i < d.length; i += 4) { const k = __lum(d, i) < 128 ? 0 : 255; bw[i] = bw[i + 1] = bw[i + 2] = k; bw[i + 3] = 255; }
      const qr = jsQR(bw, W, H);
      // ITF : chaque ligne ET chaque colonne (étiquette tournée), dans les deux sens, chaque départ possible.
      const itf = new Map();
      const scan = (n, len, at, boite) => {
        for (const sens of [1, -1]) {
          const runs = [], starts = []; let cur = 255, l = 0;
          for (let j = 0; j < len; j++) { const jj = sens > 0 ? j : len - 1 - j; const k = at(jj); if (k === cur) l++; else { runs.push(l); starts.push(j - l); cur = k; l = 1; } }
          runs.push(l); starts.push(len - l);
          for (let i = 1; i < runs.length; i += 2) {
            if (runs[i - 1] < 6) continue;
            const L = 4 + 70 + 3, sl = runs.slice(i, i + L); if (sl.length < L) continue;
            const t = __vrm.lireITF(sl); if (!t) continue;
            const a0 = starts[i], a1 = starts[i + L - 1] + runs[i + L - 1], p0 = sens > 0 ? a0 : len - a1, p1 = sens > 0 ? a1 : len - a0;
            const e = itf.get(t) || { t, b: null }; e.b = boite(n, p0, p1, e.b); itf.set(t, e);
          }
        }
      };
      const unir = (b, x0, y0, x1, y1) => (b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
      for (let y = 0; y < H; y += 2) scan(y, W, (xx) => bw[(y * W + xx) * 4], (n, a0, a1, b) => unir(b, a0, n, a1, n));
      for (let xx = 0; xx < W; xx += 2) scan(xx, H, (y) => bw[(y * W + xx) * 4], (n, a0, a1, b) => unir(b, n, a0, n, a1));
      // Le gris (à 300 dpi seulement : demandé par l'appelant).
      let gris = 0; for (let i = 0; i < d.length; i += 4) { const l = __lum(d, i); if (l > 60 && l < 195) gris++; }
      // L'encre (boîte), en points.
      let ex0 = 1e9, ey0 = 1e9, ex1 = -1, ey1 = -1; for (let yy = 0; yy < H; yy += 2) for (let xx = 0; xx < W; xx += 2) if (bw[(yy * W + xx) * 4] === 0) { if (xx < ex0) ex0 = xx; if (xx > ex1) ex1 = xx; if (yy < ey0) ey0 = yy; if (yy > ey1) ey1 = yy; }
      const k = 1 / s;
      pages.push({ w: v1.width, h: v1.height, items, texte: items.map((i) => i.s).join(' '),
        qr: qr ? { data: qr.data, box: { x: Math.min(qr.location.topLeftCorner.x, qr.location.bottomLeftCorner.x) * k, y: Math.min(qr.location.topLeftCorner.y, qr.location.topRightCorner.y) * k, X: Math.max(qr.location.topRightCorner.x, qr.location.bottomRightCorner.x) * k, Y: Math.max(qr.location.bottomLeftCorner.y, qr.location.bottomRightCorner.y) * k } } : null,
        itf: [...itf.values()].map((e) => ({ t: e.t, box: { x: e.b.x0 * k, y: e.b.y0 * k, X: e.b.x1 * k, Y: e.b.y1 * k } })),
        gris: gris / (d.length / 4), encre: ex1 < 0 ? null : { x: ex0 * k, y: ey0 * k, X: ex1 * k, Y: ey1 * k }, png: png ? c.toDataURL('image/png') : null });
    }
  } finally { await doc.destroy(); }
  return pages;
};`;

const MM = 72 / 25.4;
const NUMERO = 'B125', TITRE = 'Nike Air Max 1 Travis Scott Cactus Jack', TAILLE = '42,5';
const MISES = { 'a4-notice': 1, 'a4-colonnes': 1, 'a4-2': 2, 'a4-4': 4, '10x15': 1, '10x15-couchee': 1 };
const PAPIERS = { '10x15': { w: 100, h: 150, m: 2.5 }, '10x10': { w: 100, h: 100, m: 2.5 }, '10x15m': { w: 100, h: 150, m: 5 }, dymo4xl: { w: 104, h: 159, m: 3 }, ql62: { w: 62, h: null, m: 1.5 }, autre: { w: 80, h: 120, m: 2.5 } };
const suiviDe = (i) => '123456789012' + String(10 + i).slice(-2);
const dist = (a, b) => { const dx = Math.max(0, a.x - b.X, b.x - a.X), dy = Math.max(0, a.y - b.Y, b.y - a.Y); return Math.hypot(dx, dy); };
const boiteTexte = (it) => ({ x: it.x, y: it.y - it.t, X: it.x + it.l, Y: it.y + it.t * 0.25 });
let nCapt = 0;
const capture = async (nom, pages) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); for (const [i, p] of pages.entries()) if (p.png) { fs.writeFileSync(path.join(CAPT, `${String(++nCapt).padStart(3, '0')}-${nom}-p${i + 1}.png`), Buffer.from(p.png.split(',')[1], 'base64')); } };

async function cas(pg, mise, format, reg = {}, o = {}) {
  const t = `${mise} → ${format}${o.nom ? ' · ' + o.nom : ''}`;
  const R = { format, ...reg };
  const src = await pg.evaluate(([m, f]) => __fabriquer(m, f), [mise, o.fab || {}]);
  let a;
  try { a = await pg.evaluate(([b, r, n, ti, ta]) => __imprimer(b, r, n, ti, ta), [src, R, NUMERO, TITRE, TAILLE]); }
  catch (e) { dit(false, `${t} : le bordereau sort`, String(e.message || e).split('\n')[0].slice(0, 160)); return null; }
  const r0 = a.r0 || {}, det = r0.details || [];
  const n = o.etiquettes != null ? o.etiquettes : MISES[mise];
  const pages = await pg.evaluate(([b]) => __lire(b, 8, true), [a.b64]);
  await capture(`${mise}-${format}${o.nom ? '-' + o.nom.replace(/\W+/g, '_') : ''}`, pages);
  const P = PAPIERS[format], marge = (R.marge != null ? R.marge : P.m) * MM;
  // A. une page par étiquette, au format
  dit(r0.isole && r0.etiquettes === n, `${t} : ${n} étiquette${n > 1 ? 's' : ''} découpée${n > 1 ? 's' : ''}`, `isole=${r0.isole} etiquettes=${r0.etiquettes} raison=${r0.raison || ''}`);
  const fiches = (r0.tampons || []).filter((x) => x === 'fiche').length;
  dit(pages.length === n + fiches, `${t} : ${n + fiches} page(s) (étiquettes${fiches ? ' + fiches' : ''})`, `${pages.length} pages`);
  const etiq = []; { let i = 0; for (const m of (r0.tampons || [])) { etiq.push(pages[i]); i += m === 'fiche' ? 2 : 1; } }
  for (const [i, p] of etiq.entries()) {
    if (!p) continue;
    const bonneTaille = Math.abs(p.w - P.w * MM) < 1 && (P.h == null ? p.h > 20 * MM && p.h < 200 * MM : Math.abs(p.h - P.h * MM) < 1);
    dit(bonneTaille, `${t} · p${i + 1} : page au format du papier (${P.w} × ${P.h || 'continu'} mm)`, `${(p.w / MM).toFixed(1)} × ${(p.h / MM).toFixed(1)} mm`);
    // B. codes décodés, la bonne étiquette
    const d = det[i] || {};
    const lu = p.itf.map((x) => x.t), q = p.qr && p.qr.data;
    const attendu = p.itf.length ? p.itf[0].t : null;
    const bon = attendu && /^123456789012\d\d$/.test(attendu) && q === `VRM-EXEMPLE-${attendu}`;
    if (bon) dit(true, `${t} · p${i + 1} : code-barres ET QR décodés à 203 dpi, la même étiquette`, `${attendu} · module ${d.moduleMm != null ? d.moduleMm.toFixed(2) : '?'} mm`);
    else dit(d.fins > 0, `${t} · p${i + 1} : code illisible à 203 dpi ⇒ l'app l'a DIT (code trop fin)`, `ITF ${lu.join(',') || '—'} · QR ${q || '—'} · fins=${d.fins} module=${d.moduleMm}`);
    if (o.lisible) dit(bon, `${t} · p${i + 1} : sur ce papier, les codes DOIVENT se lire`);
    // C. rien de rogné, pas de déformation
    const coins = ['Point Relais', 'Jeanne Exemple', 'FRANCE', '24R'].map((s) => p.items.find((it) => it.s.includes(s)));
    const dedans = (it) => it && it.x >= marge - 1 && it.x + it.l <= p.w - marge + 1 && it.y - it.t >= marge - 1 && it.y <= p.h - marge + 1;
    // En noir pur l'étiquette est une IMAGE (aucun texte) : l'encre et les codes décodés en
    // répondent ; en « telle quelle », les quatre coins du texte aussi.
    const texteGarde = (R.encre || 'noir') !== 'noir';
    dit((!texteGarde || coins.every((it) => it && it.x >= 0 && it.y >= 0 && it.x <= p.w && it.y <= p.h)) && p.encre && p.encre.x >= marge - 1.5 && p.encre.y >= marge - 1.5 && p.encre.X <= p.w - marge + 1.5 && p.encre.Y <= p.h - marge + 1.5,
      `${t} · p${i + 1} : rien de rogné — l'encre dans la marge${(R.encre || 'noir') !== 'noir' ? ', en-tête, adresse, pays présents' : ''}`, p.encre ? `encre ${(p.encre.x / MM).toFixed(1)}–${(p.encre.X / MM).toFixed(1)} × ${(p.encre.y / MM).toFixed(1)}–${(p.encre.Y / MM).toFixed(1)} mm, marge ${(marge / MM).toFixed(1)}` : 'pas d\'encre');
    if (p.qr) { const b = p.qr.box, r = (b.X - b.x) / Math.max(1, b.Y - b.y); dit(r > 0.92 && r < 1.08, `${t} · p${i + 1} : le QR reste carré (aucune déformation)`, r.toFixed(3)); }
    // D. pas de notice
    dit(!/Comment utiliser|Fiche destinataire|glisser/i.test(p.texte), `${t} · p${i + 1} : ni notice ni fiche destinataire sur l'étiquette`);
    // E. tampon
    const N = p.items.filter((it) => /N°\s*B125/.test(it.s));
    const mode = (R.tamponTh || 'num');
    if (d.mode === 'blanc' || d.mode === 'libre') {
      dit(N.length === 1, `${t} · p${i + 1} : « N° B125 » tamponné sur l'étiquette`, d.mode);
      const zones = [p.qr && p.qr.box, ...p.itf.map((x) => x.box)].filter(Boolean);
      const adr = p.items.filter((it) => /Jeanne Exemple|rue Imaginaire|PARIS|FRANCE|Bâtiment/.test(it.s)).map(boiteTexte);
      const tb = p.items.filter((it) => /N°\s*B125|Nike Air|T 42/.test(it.s)).map(boiteTexte);
      const dmin = Math.min(...tb.flatMap((b) => zones.map((z) => dist(b, z))));
      dit(!zones.length || dmin >= 4 * MM, `${t} · p${i + 1} : le tampon est à ≥ 4 mm de chaque code décodé`, `${(dmin / MM).toFixed(1)} mm`);
      const dadr = Math.min(...tb.flatMap((b) => adr.map((z) => dist(b, z))));
      dit(!adr.length || dadr >= 1.5 * MM, `${t} · p${i + 1} : le tampon n'est pas sur l'adresse`, `${(dadr / MM).toFixed(1)} mm`);
    } else if (d.mode === 'fiche' || d.mode === 'aucun') dit(N.length === 0, `${t} · p${i + 1} : sans place sûre, rien sur l'étiquette`, d.mode);
    if (mode === 'num') dit(!/Nike Air/.test(p.texte), `${t} · p${i + 1} : le titre n'est PAS sur l'étiquette (N° seul)`);
    if (mode === 'num_titre' && d.mode === 'blanc') dit(/Nike Air/.test(p.texte) && !/T 42/.test(p.texte), `${t} · p${i + 1} : « N° + titre » : le titre, sans la taille`);
    if (mode === 'num_titre_taille' && d.mode === 'blanc') dit(/Nike Air/.test(p.texte) && /T 42,5/.test(p.texte), `${t} · p${i + 1} : « N° + titre + taille » : « T 42,5 » écrit`);
    if (mode === 'rien') dit(N.length === 0 && (r0.tampons || []).every((x) => x === 'rien'), `${t} · p${i + 1} : « Rien » : aucun tampon`);
    // H. l'étiquette occupe le papier
    if (p.encre && o.remplit !== false) {
      const dw = p.w - 2 * marge, dh = p.h - 2 * marge, cw = (p.encre.X - p.encre.x) / dw, chh = (p.encre.Y - p.encre.y) / dh;
      dit(Math.max(cw, chh) >= 0.9, `${t} · p${i + 1} : l'étiquette occupe le papier (recadrée)`, `largeur ${(cw * 100).toFixed(0)} % · hauteur ${(chh * 100).toFixed(0)} %`);
    }
  }
  // F. noir pur
  if ((R.encre || 'noir') === 'noir') {
    const g = await pg.evaluate(([b]) => __grisImages(b), [a.b64]);
    dit(g.images >= n && g.n > 0 && g.gris === 0, `${t} : noir pur — l'étiquette est une image noir et blanc, AUCUN échantillon gris`, `${g.images} image(s), ${g.gris} gris sur ${g.n}`);
  }
  return { r0, pages, det };
}

(async () => {
  await new Promise((o) => srv.listen(PORT, o));
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    const pg = await nav.newPage();
    pg.on('pageerror', (e) => console.log('   [pageerror] ' + e.message));
    await pg.goto(`http://localhost:${PORT}/`);
    await pg.addScriptTag({ url: '/pdf-lib.js' });
    await pg.addScriptTag({ url: '/qrcode.js' });
    await pg.addScriptTag({ url: '/jsqr.js' });
    await pg.addScriptTag({ type: 'module', content: `import * as m from '/pdfjs/pdf.min.mjs'; m.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'; window.pdfjsLib = { ...m, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } };` });
    await pg.waitForFunction(() => window.pdfjsLib && window.qrcode && window.jsQR, null, { timeout: 15000 });
    await pg.addScriptTag({ content: SCRIPT });
    await pg.addScriptTag({ content: DANS_PAGE });
    if (process.env.BANC_DEBUG) { console.log(await pg.evaluate(async (m) => { const PL = window.PDFLib; const b = await __vrm.fabriquerBordereau(PL, window.qrcode, m, {}); const d = await PL.PDFDocument.load(b); const pg0 = d.getPages()[0]; const z = __vrm.zoneEtiquette(PL, pg0); try { const a = await __vrm.analyserZone(PL, pg0, false ? z : { x: 0, y: 0, ...pg0.getSize(), w: pg0.getSize().width, h: pg0.getSize().height }, { decouper: true }); return JSON.stringify({ z, a }).slice(0, 1500); } catch (e) { return 'ERREUR ' + e.message + ' ' + e.stack; } }, process.env.BANC_DEBUG)); }
    console.log(`Bordereaux thermiques${MUT ? ' — MUTATION ' + MUT : ''} (${CI.impression(APP) ? 'code actuel' : 'code d\'avant'})`);
    // 1. Toutes les formes sur le 10×15 (les codes DOIVENT s'y lire).
    console.log('\n── Six formes de bordereau → 10 × 15 cm ──');
    for (const mise of Object.keys(MISES)) { if (SEUL && !SEUL.includes(mise)) continue; await cas(pg, mise, '10x15', {}, { lisible: true }); }
    // 2. Tous les papiers, sur la forme la plus courante (A4 Mondial Relay) et la 4 par page.
    console.log('\n── Les papiers (orientation automatique, marges, rouleau continu) ──');
    for (const f of ['10x10', '10x15m', 'dymo4xl', 'ql62', 'autre']) {
      const reg = f === 'autre' ? { l: 80, h: 120 } : {};
      await cas(pg, 'a4-notice', f, reg, { lisible: f !== 'ql62' && f !== '10x10' });
      await cas(pg, '10x15-couchee', f, reg, {});
    }
    await cas(pg, 'a4-4', '10x10', {}, { nom: '4 par page' });
    await cas(pg, 'a4-notice', '10x15', { marge: 8 }, { nom: 'marge 8 mm', lisible: true });
    // 3. Ce que dit le tampon.
    console.log('\n── Le tampon : N° seul (défaut), N° + titre, + taille, rien ──');
    await cas(pg, 'a4-notice', '10x15', { tamponTh: 'num_titre' }, { nom: 'N° + titre' });
    await cas(pg, 'a4-notice', '10x15', { tamponTh: 'num_titre_taille' }, { nom: 'N° + titre + taille' });
    await cas(pg, 'a4-notice', '10x15', { tamponTh: 'rien' }, { nom: 'rien' });
    await cas(pg, 'a4-notice', '10x15', { encre: 'tel' }, { nom: 'encre telle quelle', lisible: true });
    // 4. Aucune place sûre : la fiche de préparation, ou rien.
    console.log('\n── 10×15 pleine : aucune place sûre hors codes et adresse ──');
    const avec = await cas(pg, '10x15-plein', '10x15', {}, { nom: 'fiche', etiquettes: 1, lisible: true, remplit: false });
    if (avec) {
      dit((avec.r0.tampons || [])[0] === 'fiche', '10×15 pleine : issue « fiche » (fiche de préparation)', JSON.stringify(avec.r0.tampons));
      const f = avec.pages[1];
      dit(f && Math.abs(f.w - 100 * MM) < 1 && Math.abs(f.h - 150 * MM) < 1, 'fiche : même papier que l\'étiquette (10 × 15)', f ? `${(f.w / MM).toFixed(0)} × ${(f.h / MM).toFixed(0)} mm` : 'absente');
      dit(f && /Fiche de préparation/.test(f.texte) && /DANS le colis/.test(f.texte) && /N°\s*B125/.test(f.texte) && /Nike Air/.test(f.texte) && /Taille 42,5/.test(f.texte), 'fiche : « à mettre DANS le colis », N°, titre, taille', f ? f.texte.slice(0, 140) : '');
    }
    // Un blanc collé au QR, assez grand pour le tampon seulement SANS la garde de 5 mm autour
    // des codes : la garde le refuse (issue « fiche »), `sansBloques` y poserait le N°.
    if (!SEUL || SEUL.includes('blanc-qr')) {
      const pres = await cas(pg, '10x15-plein', '10x15', {}, { nom: 'blanc collé au QR', etiquettes: 1, remplit: false, fab: { blancQr: Number(process.env.BLANC_QR) || 30 } });
      if (pres) dit((pres.r0.tampons || [])[0] === 'fiche', '10×15 pleine, blanc collé au QR : la garde des codes refuse ce blanc (issue « fiche »)', JSON.stringify(pres.r0.tampons));
    }
    const sans = await cas(pg, '10x15-plein', '10x15', { fiche: false }, { nom: 'fiche coupée', etiquettes: 1, remplit: false });
    if (sans) dit((sans.r0.tampons || [])[0] === 'aucun' && sans.pages.length === 1, 'fiche coupée : rien de tamponné, l\'issue le dit (« aucun »), aucune page en plus', JSON.stringify(sans.r0.tampons) + ` ${sans.pages.length} p.`);
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
