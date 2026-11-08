// ⚠️⚠️ BANC — LE TAMPON DU BORDEREAU (N° + TITRE), TOUJOURS POSÉ (3 novembre).
//
// Julien, 3 nov. 09 h 59 : « le tamponnage du bordereau ne marche pas car il
// veut absolument trouver un espace blanc ; il me dit qu'il n'en trouve pas ».
// Mesuré sur ses vrais PDF (copies hors dépôt) : en thermique, l'étiquette
// Mondial Relay « Bordereau-Vinted » (Hermes, 150×100 couchée) remplit la page
// 100×150 ⇒ « aucun espace blanc suffisant », rien de tamponné, impression
// refusée. La page Vestiaire (Chronopost) est tournée (/Rotate 270).
//
// Ce banc EXÉCUTE le vrai code d'`App.jsx` (`poserBordereau` et tout ce qu'il
// appelle) dans Chromium, avec pdf.js, sur des PDF FABRIQUÉS ici qui
// reproduisent chaque forme mesurée — aucun vrai bordereau dans le dépôt
// (PUBLIC) :
//   pleine-10x15        étiquette 10×15 pleine, sans marge
//   a4-quart            A4, étiquette dans un quart, le reste blanc
//   tournee-270         page couchée tournée à l'affichage (Vestiaire)
//   tournee-90-pleine   10×15 couchée, tournée, pleine
//   scan                A4 = une image scannée (fond gris bruité, points noirs)
//   gris-clair          A4 sur fond gris clair
//   a4-pleine           A4 couverte de texte d'un bord à l'autre
// Chaque zone PROTÉGÉE (code-barres, adresse, n° de suivi, QR) est posée sur
// un fond vert très pâle ; un point noir ISOLÉ (bruit de scan) n'est pas gardé,
// la règle le traite comme du papier ; (luminance ≈ 246 : le tampon le voit comme du papier,
// il ne doit donc l'éviter QUE par ses marges autour de l'encre).
//
// Pour chaque PDF, en imprimante normale ET thermique, il imprime deux fois :
// (a) avec N° + titre, (b) sans rien — même chemin, même mise en page. Il juge :
//   1. rien ne lève : le bordereau sort toujours ;
//   2. « N° B125 » et le titre sont dans le PDF (pdf.js, texte) et se lisent À
//      L'ENDROIT sur la page affichée ;
//   3. ZONE LIBRE : même nombre de pages, même taille ; les pixels qui
//      changent (a − b) ne touchent ni une zone protégée ni l'encre d'origine ;
//      BANDE : la page d'origine est intacte en haut, à l'échelle 1:1, la page
//      grandit de 40 pt, tient sur un A4, le tampon est dans la bande ;
//      FICHE : la page 1 est identique, une page 100×150 de plus la suit ;
//   4. en thermique, aucune page ne change de taille (100×150 reste 100×150) ;
//   5. l'issue attendue pour chaque forme (zone libre / bande / fiche).
// `BANC_MUTATION=marges0|bandeThermique|sansRotation|seuilStrict` réaffaiblit
// une règle : le banc doit virer au rouge (§6.1). Sur le code d'avant
// (28 oct.) : « aucun espace blanc suffisant » sur 6 formes sur 7.
// `BANC_REELS=dossier` : en plus, tous les *.pdf de ce dossier (hors dépôt).
// `CAPTURES=dossier` : les rendus PNG des PDF tamponnés.
// `BANC_PDFJS_DIR` : pdf.js 3.11.174 (celui de l'app) ; sinon la pdfjs-dist du
// dépôt (ESM), comme `vestiaire-parite.cjs`.
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const PL = require(path.join(NM, 'pdf-lib'));
const APP = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
const MUT = process.env.BANC_MUTATION || '';
const CAPT = process.env.CAPTURES || '';
const PDFJS_DIR = process.env.BANC_PDFJS_DIR && fs.existsSync(path.join(process.env.BANC_PDFJS_DIR, 'pdf.min.js')) ? process.env.BANC_PDFJS_DIR : '';
const PORT = Number(process.env.BANC_PORT) || 8792;
const CHROME = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// ── Le VRAI code, extrait d'App.jsx (rien n'est recopié) ────────────────────
const m = (re, quoi) => { const x = re.exec(APP); if (!x) throw Error(quoi + ' introuvable dans App.jsx'); return x[0]; };
const bloc = (n) => m(new RegExp(`const ${n} = (?:async )?\\([\\s\\S]*?\\n\\};`), n);
const ligne = (n) => m(new RegExp(`const ${n} = [^\\n]*\\n`), n);
const DEBUT = '// ── LE TAMPON DU BORDEREAU', FIN = '// ── IMPRIMANTE NORMALE OU THERMIQUE';
let tampon = APP.includes(DEBUT) ? APP.slice(APP.indexOf(DEBUT), APP.indexOf(FIN))
  : [bloc('trouverZoneBlanche'), bloc('espaceBlancBordereau'), bloc('drawBordereauStamp')].join('\n');   // le code d'avant
let code = [m(/const PAS_L_ETIQUETTE = \/[^\n]*\n/, 'PAS_L_ETIQUETTE'), m(/const _mulM = \([^\n]*\n/, '_mulM'), m(/const _apM = \([^\n]*\n/, '_apM'),
  ligne('MM_PT'), ligne('ETIQ_TH'), ligne('TAILLES_ETIQUETTE'), ligne('TH_MARGE'),
  bloc('relevePage'), bloc('_couperSelon'), bloc('estTailleEtiquette'), bloc('avecSens'), bloc('zoneEtiquette'),
  bloc('placementThermique'), bloc('poserEtiquettesThermiques'), bloc('poserBordereau')].join('\n');
// Réaffaiblissements (chacun doit faire virer au rouge au moins un contrôle).
const muter = (s, a, b, quoi) => { if (!s.includes(a)) { dit(false, `mutation « ${quoi} » applicable`, 'motif absent'); return s; } return s.split(a).join(b); };
if (MUT === 'marges0') tampon = muter(tampon, 'mx: 14, my: 10', 'mx: 0, my: 0', MUT);
if (MUT === 'bandeThermique') tampon = muter(tampon, 'if (!thermique && tientA4(', 'if (tientA4(', MUT);
if (MUT === 'sansRotation') tampon = muter(tampon, 'rotate: PL.degrees(r) });', 'rotate: PL.degrees(0) });', MUT);
if (MUT === 'seuilStrict') tampon = muter(tampon, 'encre: 200, cellule: 3,', 'encre: 248, cellule: 1,', MUT);
// (3 nov., soir) LE TAMPON LIBRE : la place choisie à la main, la forme, la
// mémoire par forme (`choisirTampon`). Absent du code d'avant ⇒ rouge, pas un plantage.
const opt = (re) => { const x = re.exec(APP); return x ? x[0] : ''; };
const LIBRE = [opt(/const TYPES_BORDEREAU = \[[\s\S]*?\n\];/), opt(/const typeBordereau = \([\s\S]*?\n\};/),
  opt(/const TAMPON_ANNULE = [\s\S]*?\nconst choisirTampon = \([\s\S]*?\n\};/)].join('\n');
if (MUT === 'rotationIgnoree') tampon = muter(tampon, 'const b = page.getCropBox(), r = rotationPage(page);\n  page.resetPosition();\n  const a = versPdfAffiche', 'const b = page.getCropBox(), r = 0;\n  page.resetPosition();\n  const a = versPdfAffiche', MUT);
if (MUT === 'sansFond') tampon = muter(tampon, 'if (fond) page.drawRectangle(', 'if (false) page.drawRectangle(', MUT);
if (MUT === 'memoireIgnoree') tampon = muter(tampon, 'const positionTampon = (forme) => {', 'const positionTampon = (forme) => null; const _x_ = (forme) => {', MUT);
const SCRIPT = `const chargerPdfjs=async()=>window.pdfjsLib;
let __store={}; const load=(k,d)=>(k in __store?JSON.parse(JSON.stringify(__store[k])):d); const save=(k,v)=>{__store[k]=JSON.parse(JSON.stringify(v));}; const libererOngletPdf=()=>{};
${code}\n${tampon}\n${LIBRE}
window.__vrm={poserBordereau};
try { window.__libre={ choisirTampon, zonesCodesTampon, rendrePremierePage, recouvreTampon, cartoucheLibre, formeTampon, store:()=>__store, vider:()=>{__store={};}, placeur:(f)=>{_placeurTampon=f;} }; } catch (e) { window.__libre=null; }`;

// ── Les PDF fabriqués ───────────────────────────────────────────────────────
const VERT = PL.rgb(0.92, 1, 0.92), NOIR = PL.rgb(0, 0, 0);
const NUMERO = 'B125', TITRE = 'Nike Air Max 1 Travis Scott Cactus Jack Baroque Brown taille 42,5';
let graine = 7; const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
const codeBarres = (p, x, y, w, h) => { p.drawRectangle({ x: x - 3, y: y - 3, width: w + 6, height: h + 6, color: VERT }); for (let cx = x; cx < x + w - 3;) { const b = 0.8 + alea() * 2.2; p.drawRectangle({ x: cx, y, width: b, height: h, color: NOIR }); cx += b + 0.8 + alea() * 2; } };
const qr = (p, x, y, n, mod) => { p.drawRectangle({ x: x - 3, y: y - 3, width: n * mod + 6, height: n * mod + 6, color: VERT }); for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (alea() < 0.5 || r < 3 && c < 3) p.drawRectangle({ x: x + c * mod, y: y + r * mod, width: mod, height: mod, color: NOIR }); };
const texte = (p, f, lignes, x, y, taille, protege) => {
  const w = Math.max(...lignes.map((l) => f.widthOfTextAtSize(l, taille))), h = lignes.length * taille * 1.2;
  if (protege) p.drawRectangle({ x: x - 3, y: y - h - 3 + taille * 0.9, width: w + 6, height: h + 4, color: VERT });
  lignes.forEach((l, i) => p.drawText(l, { x, y: y - i * taille * 1.2, size: taille, font: f, color: NOIR }));
};
const remplir = (p, f, x0, y0, x1, y1, pas = 9) => { const t = 'Poids 0,5 kg · Agence 24R · Tournée 12 · Réf 000123 · Colis 1/1 · '; for (let y = y1 - 8; y >= y0; y -= pas) { let s = t; while (f.widthOfTextAtSize(s + t, 7) < x1 - x0) s += t; p.drawText(s, { x: x0, y, size: 7, font: f, color: NOIR }); p.drawText(t, { x: x1 - f.widthOfTextAtSize(t, 7), y, size: 7, font: f, color: NOIR }); } };
// L'étiquette elle-même, dans un repère (ox, oy) de largeur w et hauteur h.
const etiquette = (p, f, fb, ox, oy, w, h, plein) => {
  codeBarres(p, ox + 10, oy + h - 62, w - 20, 50);
  texte(p, fb, ['XW 1234 5678 9FR'], ox + 10, oy + h - 80, 12, true);
  texte(p, f, ['Destinataire', 'Jeanne Exemple', '12 rue Imaginaire', 'Bâtiment B', '75000 PARIS', 'FRANCE'], ox + 10, oy + h - 104, 10, true);
  qr(p, ox + w - 92, oy + h - 190, 25, 3.2);
  if (plein) { remplir(p, f, ox + 4, oy + 4, ox + w - 4, oy + h - 196); p.drawText('24R', { x: ox + w - 80, y: oy + h - 102, size: 22, font: fb, color: NOIR }); }
};
async function fabriquer(pngScan) {
  const out = {};
  const nouveau = async (taille) => { const d = await PL.PDFDocument.create(); return { d, p: d.addPage(taille), f: await d.embedFont(PL.StandardFonts.Helvetica), fb: await d.embedFont(PL.StandardFonts.HelveticaBold) }; };
  { const { d, p, f, fb } = await nouveau([283.46, 425.2]); etiquette(p, f, fb, 0, 0, 283.46, 425.2, true); out['pleine-10x15'] = await d.save(); }
  { const { d, p, f, fb } = await nouveau([595.28, 841.89]); p.drawRectangle({ x: 20, y: 440, width: 283, height: 380, borderColor: NOIR, borderWidth: 1 }); etiquette(p, f, fb, 20, 440, 283, 380, true); out['a4-quart'] = await d.save(); }
  { const { d, p, f, fb } = await nouveau([841.89, 595.28]); p.setRotation(PL.degrees(270)); etiquette(p, f, fb, 400, 150, 425, 283, true); out['tournee-270'] = await d.save(); }
  { const { d, p, f, fb } = await nouveau([425.2, 283.46]); p.setRotation(PL.degrees(90)); etiquette(p, f, fb, 0, 0, 425.2, 283.46, true); remplir(p, f, 4, 4, 421, 279, 9); out['tournee-90-pleine'] = await d.save(); }
  { const { d, p } = await nouveau([595.28, 841.89]); const img = await d.embedPng(pngScan); p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 }); out.scan = await d.save(); }
  { const { d, p, f, fb } = await nouveau([595.28, 841.89]); p.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: PL.rgb(0.88, 0.88, 0.88) }); etiquette(p, f, fb, 150, 40, 283, 380, true); out['gris-clair'] = await d.save(); }
  { const { d, p, f, fb } = await nouveau([595.28, 841.89]); etiquette(p, f, fb, 10, 440, 575, 395, false); remplir(p, f, 4, 4, 591, 838, 9); out['a4-pleine'] = await d.save(); }
  return out;
}
// L'issue attendue pour chaque forme (null : toute issue, mais un tampon).
const ATTENDU = {
  // (3 nov.) bande coupée (refus de Julien du 28 oct.) : sans zone libre, la fiche colis aussi en normale.
  'pleine-10x15': { normale: 'fiche', thermique: 'fiche' },
  'a4-quart': { normale: 'blanc', thermique: null },
  'tournee-270': { normale: 'blanc', thermique: null },
  'tournee-90-pleine': { normale: 'fiche', thermique: 'fiche' },
  scan: { normale: 'blanc', thermique: null },
  'gris-clair': { normale: 'blanc', thermique: null },
  'a4-pleine': { normale: 'fiche', thermique: 'fiche' },
};

// ── Le serveur (pdf.js, pdf-lib) et la page ─────────────────────────────────
const srv = http.createServer((q, r) => {
  const f = q.url.split('?')[0]; let p = '';
  if (f.startsWith('/pdfjs/')) p = PDFJS_DIR ? path.join(PDFJS_DIR, path.basename(f).replace(/\.mjs$/, '.js')) : path.join(NM, 'pdfjs-dist', 'build', path.basename(f));
  else if (f === '/pdf-lib.js') p = path.join(NM, 'pdf-lib', 'dist', 'pdf-lib.min.js');
  if (!p) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><html><body></body></html>'); }
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/javascript' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });

// Dans la page : imprime (a) et (b), puis compare leurs rendus.
const DANS_PAGE = `
window.__imprimer = async (b64, thermique, numero, titre) => {
  const PL = window.PDFLib, src = await PL.PDFDocument.load(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
  const out = await PL.PDFDocument.create();
  const r0 = await __vrm.poserBordereau(PL, out, src, { numero, title: titre, pos: null, thermique });
  const o = await out.save(); let s = ''; for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
  return { r0, b64: btoa(s) };
};
const __charge = async (b64) => (await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)), isEvalSupported: false }).promise);
const __rendre = async (doc, n, s) => { const pg = await doc.getPage(n), v = pg.getViewport({ scale: s }); const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height); const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: x, viewport: v }).promise; return { c, d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; };
window.__analyser = async (aB64, bB64, captures) => {
  const A = await __charge(aB64), B = await __charge(bB64), S = 2;
  try {
    const pages = [], png = [];
    for (let i = 1; i <= A.numPages; i++) {
      const pg = await A.getPage(i), v = pg.getViewport({ scale: 1 });
      const items = (await pg.getTextContent()).items.map(it => { const mm = pdfjsLib.Util.transform(v.transform, it.transform); return { s: it.str, droit: mm[0] > 0 && Math.abs(mm[1]) < 0.01 * mm[0] && Math.abs(mm[2]) < 0.01 * mm[0] && mm[3] < 0 }; });
      pages.push({ w: v.width, h: v.height, texte: items.map(x => x.s).join(' '), items });
      if (captures) { const r = await __rendre(A, i, 1.2); png.push(r.c.toDataURL('image/png')); }
    }
    const pagesB = []; for (let i = 1; i <= B.numPages; i++) { const v = (await B.getPage(i)).getViewport({ scale: 1 }); pagesB.push({ w: v.width, h: v.height }); }
    // Page 1 : ce qui change entre (a) et (b), et où.
    const ra = await __rendre(A, 1, S), rb = await __rendre(B, 1, S);
    const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const vert = (d, i) => d[i + 1] - d[i] >= 8 && d[i + 1] - d[i + 2] >= 8 && d[i + 1] > 200;
    const W = Math.min(ra.w, rb.w), H = Math.min(ra.h, rb.h);
    // Les zones protégées et l'encre d'origine, élargies de 1 px.
    const garde = new Uint8Array(rb.w * rb.h);
    for (let y = 0; y < rb.h; y++) for (let x = 0; x < rb.w; x++) { const i = (y * rb.w + x) * 4; const sombre = (k) => k >= 0 && k < rb.d.length && lum(rb.d, k) < 200; if (vert(rb.d, i) || (sombre(i) && [-4, 4, -rb.w * 4, rb.w * 4, -rb.w * 4 - 4, -rb.w * 4 + 4, rb.w * 4 - 4, rb.w * 4 + 4].filter((o) => sombre(i + o)).length >= 2)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < rb.h && xx < rb.w) garde[yy * rb.w + xx] = 1; } }
    let diff = 0, surGarde = 0, horsHaut = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * ra.w + x) * 4, j = (y * rb.w + x) * 4; const dd = Math.abs(ra.d[i] - rb.d[j]) + Math.abs(ra.d[i + 1] - rb.d[j + 1]) + Math.abs(ra.d[i + 2] - rb.d[j + 2]); if (dd > 60) { diff++; if (garde[y * rb.w + x]) surGarde++; } }
    // Ce qui dépasse (la bande) : encre dessous ?
    let bande = 0; for (let y = H; y < ra.h; y++) for (let x = 0; x < ra.w; x++) if (lum(ra.d, (y * ra.w + x) * 4) < 128) bande++;
    return { pages, pagesB, diff, surGarde, bande, aire: W * H, png };
  } finally { await A.destroy(); await B.destroy(); }
};`;

// Le tampon LIBRE : imprime avec `choix` (posé à la main) ou par `choisirTampon`
// (`apercu` : la mémoire par forme), rend le PDF, l'issue, et où le N° est écrit.
const DANS_PAGE_LIBRE = `
window.__libreImprimer = async (b64, thermique, numero, titre, o) => {
  const PL = window.PDFLib, octets = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), copie = octets.slice();
  const src = await PL.PDFDocument.load(octets), out = await PL.PDFDocument.create();
  const choisir = o.apercu !== undefined ? __libre.choisirTampon({ PL, src, numero, titre, apercu: o.apercu }) : (o.choix ? async () => o.choix : null);
  let r0 = null, erreur = null;
  try { r0 = await __vrm.poserBordereau(PL, out, src, { numero, title: titre, pos: null, thermique, choisir }); } catch (e) { erreur = { message: String(e.message || e), annule: !!e.tamponAnnule }; }
  const intact = octets.length === copie.length && octets.every((x, i) => x === copie[i]);
  if (erreur) return { erreur, intact };
  const o2 = await out.save(); let s = ''; for (let i = 0; i < o2.length; i += 0x8000) s += String.fromCharCode.apply(null, o2.subarray(i, i + 0x8000));
  const d = await pdfjsLib.getDocument({ data: o2.slice(), isEvalSupported: false }).promise;
  try {
    const pg = await d.getPage(1), v = pg.getViewport({ scale: 1 });
    const items = (await pg.getTextContent()).items.map(it => { const m = pdfjsLib.Util.transform(v.transform, it.transform); return { s: it.str, x: m[4], y: m[5], t: Math.hypot(m[2], m[3]), droit: m[0] > 0 && Math.abs(m[1]) < 0.01 * m[0] && Math.abs(m[2]) < 0.01 * m[0] && m[3] < 0 }; });
    // La largeur du cartouche de la variante, pour l'échelle attendue.
    const dd = await PL.PDFDocument.create(), c = __libre.cartoucheLibre(await dd.embedFont(PL.StandardFonts.HelveticaBold), await dd.embedFont(PL.StandardFonts.Helvetica), numero, titre, (o.choix && o.choix.v) || 0);
    return { b64: btoa(s), r0, pages: d.numPages, W: v.width, H: v.height, items, cw: c.w, ch: c.h, intact };
  } finally { await d.destroy(); }
};
// Dans le cadre du tampon : le tampon seul (comparé à la même page blanche
// tamponnée) ; hors du cadre : la page d'origine (comparée à b, sans tampon).
window.__libreOpacite = async (aB64, bB64, cB64, box) => {
  const S = 2, rd = async (x) => { const d = await __charge(x); try { return await __rendre(d, 1, S); } finally { await d.destroy(); } };
  const A = await rd(aB64), B = await rd(bB64), C = await rd(cB64);
  const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const bx = box.x * S, by = box.y * S, bw = box.w * S, bh = box.h * S;
  let dans = 0, cache = 0, encreDessous = 0, hors = 0, horsDiff = 0;
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
    const i = (y * A.w + x) * 4, dedans = x > bx + 1 && x < bx + bw - 1 && y > by + 1 && y < by + bh - 1, bord = x > bx - 2 && x < bx + bw + 2 && y > by - 2 && y < by + bh + 2;
    if (dedans) { dans++; if (lum(B.d, i) < 128) encreDessous++; if (Math.abs(lum(A.d, i) - lum(C.d, i)) > 60) cache++; }
    else if (!bord) { hors++; if (Math.abs(lum(A.d, i) - lum(B.d, i)) > 60) horsDiff++; }
  }
  return { dans, cache, encreDessous, hors, horsDiff };
};
// La même page, BLANCHE (même taille, même rotation), tamponnée au même choix.
window.__libreBlanc = async (b64, numero, titre, choix) => {
  const PL = window.PDFLib, s0 = await PL.PDFDocument.load(Uint8Array.from(atob(b64), c => c.charCodeAt(0))), p0 = s0.getPages()[0];
  const d = await PL.PDFDocument.create(), p = d.addPage([p0.getSize().width, p0.getSize().height]); p.setRotation(p0.getRotation());
  const b = await d.save(); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return (await __libreImprimer(btoa(s), false, numero, titre, { choix })).b64;
};
window.__libreCodes = async (b64) => { const PL = window.PDFLib, d = await PL.PDFDocument.load(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); return __libre.zonesCodesTampon(await __libre.rendrePremierePage(d)); };
`;
const proche = (a, b, e = 0.6) => Math.abs(a - b) <= e;
// Où le N° doit tomber : coin haut-gauche (vx·W, vy·H) + marge 3 pt, ligne de base à (3 + 18·0,78)·k ;
// k borné : N° ≥ 9 pt et titre ≥ 5 pt (variante 0 : 18 pt et 8 pt).
const attenduN = (r, ch) => { const k = Math.max(Math.max(9 / 18, 5 / 8), Math.min(r.W / r.cw, r.H / r.ch, ch.vw * r.W / r.cw)); return { x: ch.vx * r.W + 3 * k, y: ch.vy * r.H + (3 + 18 * 0.78) * k, t: 18 * k, k }; };
async function libre(pg, pdfs) {
  console.log('\n── Le tampon LIBRE (posé à la main, même sur du texte) ──');
  const dispo = await pg.evaluate(() => !!window.__libre);
  dit(dispo, 'le tampon libre existe (choisirTampon, zonesCodesTampon, cartoucheLibre)');
  if (!dispo) return;
  const b64 = (n) => Buffer.from(pdfs[n]).toString('base64');
  const imprimer = (n, th, o) => pg.evaluate(([x, t, nu, ti, oo]) => __libreImprimer(x, t, nu, ti, oo), [b64(n), th, NUMERO, TITRE, o]);
  const N = (r) => r.items.find((x) => /B125/.test(x.s));
  const posJuste = (t, r, ch) => { const n = N(r), e = attenduN(r, ch); dit(!!n && proche(n.x, e.x, 2) && proche(n.y, e.y, 2) && proche(n.t, e.t, 0.8), `${t} : le N° est à la place choisie (±2 pt)`, n ? `N° à (${n.x.toFixed(1)}, ${n.y.toFixed(1)}) ${n.t.toFixed(1)} pt, attendu (${e.x.toFixed(1)}, ${e.y.toFixed(1)}) ${e.t.toFixed(1)} pt` : 'N° absent'); dit(!!n && n.droit, `${t} : le N° se lit à l'endroit`); };
  // L1 — sur du TEXTE (A4 couverte d'un bord à l'autre) : posé, fond opaque, rien d'autre ne bouge.
  const CH = { vx: 0.25, vy: 0.45, vw: 0.4, v: 0 };
  const r1 = await imprimer('a4-pleine', false, { choix: CH });
  dit(r1.r0 && r1.r0.tampons[0] === 'libre', 'sur du texte : issue « libre » (rien n\'est refusé)', JSON.stringify(r1.r0 || r1.erreur));
  dit(r1.pages === 1, 'sur du texte : pas de fiche colis ajoutée', `${r1.pages} pages`);
  dit(r1.intact, 'le PDF rangé (les octets reçus) n\'est pas modifié');
  posJuste('sur du texte', r1, CH);
  {
    const ref = await pg.evaluate(([x]) => __imprimer(x, false, '', ''), [b64('a4-pleine')]);
    const blanc = await pg.evaluate(([x, n, t, c]) => __libreBlanc(x, n, t, c), [b64('a4-pleine'), NUMERO, TITRE, CH]);
    const k = attenduN(r1, CH).k;
    const { dans, cache, encreDessous, hors, horsDiff } = await pg.evaluate(([a, b, c, bx, by, bw, bh]) => __libreOpacite(a, b, c, { x: bx, y: by, w: bw, h: bh }), [r1.b64, ref.b64, blanc, CH.vx * r1.W, CH.vy * r1.H, r1.cw * k, r1.ch * k]);
    dit(encreDessous > dans * 0.03, 'sur du texte : il y avait bien du texte sous le tampon', `${encreDessous} px d'encre sur ${dans}`);
    dit(cache <= dans * 0.01, 'sur du texte : FOND OPAQUE — dans le cadre, seul le tampon se voit (le texte dessous est caché)', `${cache} px du texte d'origine visibles sur ${dans}`);
    dit(horsDiff <= hors * 0.001, 'sur du texte : hors du cadre, la page est intacte', `${horsDiff} px changés`);
  }
  // L2 — page tournée 270 (Vestiaire) : la place est celle de la page AFFICHÉE.
  const r2 = await imprimer('tournee-270', false, { choix: CH });
  dit(r2.r0 && r2.r0.tampons[0] === 'libre', 'page /Rotate 270 : issue « libre »', JSON.stringify(r2.r0 || r2.erreur));
  dit(proche(r2.W, 595.28, 1) && proche(r2.H, 841.89, 1), 'page /Rotate 270 : affichée debout 595×842', `${r2.W}×${r2.H}`);
  posJuste('page /Rotate 270', r2, CH);
  // L2b — page tournée 90, posée tout en bas à droite (bornée à la page).
  const CH2 = { vx: 0.6, vy: 0.8, vw: 0.35, v: 0 };
  const r2b = await imprimer('tournee-90-pleine', false, { choix: CH2 });
  posJuste('page /Rotate 90', r2b, CH2);
  // L3 — thermique, étiquette découpée en 100×150 : posé sur l'étiquette, pas de fiche.
  const r3 = await imprimer('pleine-10x15', true, { choix: { vx: 0.05, vy: 0.55, vw: 0.6, v: 0 } });
  dit(r3.r0 && r3.r0.tampons.every((x) => x === 'libre') && proche(r3.W, 283.46, 1) && proche(r3.H, 425.2, 1), 'thermique : posé sur l\'étiquette 100×150, aucune fiche, même taille', JSON.stringify(r3.r0) + ` ${r3.pages} p. ${r3.W}×${r3.H}`);
  posJuste('thermique', r3, { vx: 0.05, vy: 0.55, vw: 0.6, v: 0 });
  // L4 — « Toujours ici » : la forme suivante reprend la place ; une autre forme ⇒ choix auto.
  await pg.evaluate(() => { __libre.vider(); window.__appels = 0; __libre.placeur((q) => { window.__appels++; window.__derniere = q.forme; q.resolve({ choix: { vx: 0.3, vy: 0.5, vw: 0.35, v: 0 }, toujours: true }); }); });
  const CH4 = { vx: 0.3, vy: 0.5, vw: 0.35, v: 0 };
  const m1 = await imprimer('a4-quart', false, { apercu: true });
  const ap1 = await pg.evaluate(() => ({ n: window.__appels, f: window.__derniere, store: __libre.store() }));
  dit(ap1.n === 1 && m1.r0 && m1.r0.tampons[0] === 'libre', 'forme sans place : l\'aperçu s\'ouvre une fois, la place choisie s\'imprime', JSON.stringify({ appels: ap1.n, r0: m1.r0 }));
  posJuste('aperçu', m1, CH4);
  const pos = ap1.store.vrm_tampon_positions || {};
  dit(ap1.f && pos[ap1.f.cle] && proche(pos[ap1.f.cle].vx, 0.3, 1e-4), '« Toujours ici » : la place est mémorisée pour la FORME (`vrm_tampon_positions`)', JSON.stringify(pos));
  const m2 = await imprimer('a4-quart', false, { apercu: true });
  dit((await pg.evaluate(() => window.__appels)) === 1 && m2.r0 && m2.r0.tampons[0] === 'libre', 'même forme ensuite : pas d\'aperçu, la place mémorisée reprend directement');
  posJuste('même forme', m2, CH4);
  const m3 = await imprimer('scan', false, { apercu: false });
  dit(m3.r0 && m3.r0.tampons[0] === 'libre', 'un lot (sans aperçu) : la place mémorisée de la forme', JSON.stringify(m3.r0));
  posJuste('lot', m3, CH4);
  const m4 = await imprimer('tournee-270', false, { apercu: false });
  dit(m4.r0 && m4.r0.tampons[0] === 'blanc', 'une AUTRE forme (A4 couchée tournée) : le choix automatique de VRM', JSON.stringify(m4.r0));
  // L5 — « Revenir au choix de VRM » oublie la place ; Annuler n'imprime rien.
  await pg.evaluate(() => { __libre.placeur((q) => { window.__appels++; q.resolve({ choix: null, toujours: true }); }); });
  const m5 = await imprimer('a4-quart', false, { apercu: 'force' });
  const st5 = await pg.evaluate(() => __libre.store().vrm_tampon_positions || {});
  dit(m5.r0 && m5.r0.tampons[0] === 'blanc' && !Object.keys(st5).length, '« Revenir au choix de VRM » : choix automatique, la place est oubliée', JSON.stringify({ r0: m5.r0, st5 }));
  await pg.evaluate(() => { __libre.placeur((q) => q.resolve(null)); });
  const m6 = await imprimer('a4-quart', false, { apercu: true });
  dit(m6.erreur && m6.erreur.annule && m6.intact, 'Annuler : rien ne s\'imprime, le PDF rangé est intact', JSON.stringify(m6.erreur));
  await pg.evaluate(() => { __libre.placeur(null); });
  // L6 — la puce « recouvre le code-barres » : le code-barres et le QR sont vus, l'adresse non.
  const z = await pg.evaluate(([x]) => __libreCodes(x), [b64('a4-quart')]);
  const rec = (b) => z.some((q) => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y);
  dit(rec({ x: 100, y: 45, w: 40, h: 20 }), 'le code-barres est détecté', JSON.stringify(z.map((q) => [q.x, q.y, q.w, q.h].map(Math.round))));
  dit(rec({ x: 235, y: 160, w: 20, h: 20 }), 'le QR est détecté');
  dit(!rec({ x: 32, y: 134, w: 70, h: 50 }) && !rec({ x: 32, y: 96, w: 100, h: 14 }), 'l\'adresse et le n° de suivi (du texte) ne sont pas pris pour un code');
}
async function juger(pg, nom, b64, thermique, attendu) {
  const mode = thermique ? 'thermique' : 'normale';
  const t = `${nom} · ${mode}`;
  let a, b;
  try { a = await pg.evaluate(([x, th, n, ti]) => __imprimer(x, th, n, ti), [b64, thermique, NUMERO, TITRE]); }
  catch (e) { dit(false, `${t} : le bordereau sort`, String(e.message || e).split('\n')[0].slice(0, 160)); return; }
  dit(true, `${t} : le bordereau sort`);
  try { b = await pg.evaluate(([x, th]) => __imprimer(x, th, '', ''), [b64, thermique]); }
  catch (e) { dit(false, `${t} : la référence sans tampon sort`, String(e.message || e).slice(0, 120)); return; }
  const z = await pg.evaluate(([x, y, c]) => __analyser(x, y, c), [a.b64, b.b64, !!CAPT]);
  const issue = ((a.r0 && a.r0.tampons) || [])[0] || '?';
  const tout = z.pages.map((p) => p.texte).join(' ');
  const items = z.pages.flatMap((p) => p.items);
  dit(/N°\s*B125/.test(tout), `${t} : « N° B125 » est dans le PDF`, issue);
  dit(/Nike Air Max 1/.test(tout), `${t} : le titre est dans le PDF`);
  const num = items.filter((x) => /B125/.test(x.s));
  dit(num.length > 0 && num.every((x) => x.droit), `${t} : le N° se lit à l'endroit`);
  if (attendu) dit(issue === attendu, `${t} : issue attendue « ${attendu} »`, `obtenu « ${issue} »`);
  const p1a = z.pages[0], p1b = z.pagesB[0];
  if (issue === 'blanc') {
    dit(z.pages.length === z.pagesB.length && proche(p1a.w, p1b.w) && proche(p1a.h, p1b.h), `${t} : zone libre — même nombre de pages, même taille`);
    dit(z.diff > 50 && z.surGarde === 0, `${t} : zone libre — le tampon ne touche ni une zone protégée ni l'encre`, `${z.diff} px changés, ${z.surGarde} sur une zone gardée`);
  } else if (issue === 'bande') {
    dit(!thermique, `${t} : pas de bande en thermique`);
    dit(proche(p1a.w, p1b.w) && proche(p1a.h, p1b.h + 40), `${t} : bande — la page grandit de 40 pt, rien d'autre`, `${p1b.w.toFixed(1)}×${p1b.h.toFixed(1)} → ${p1a.w.toFixed(1)}×${p1a.h.toFixed(1)}`);
    dit((p1a.w <= 596.3 && p1a.h <= 842.9) || (p1a.w <= 842.9 && p1a.h <= 596.3), `${t} : bande — la page tient sur un A4 (aucune réduction)`);
    dit(z.diff <= z.aire * 0.002 && z.bande > 50, `${t} : bande — l'original est intact à 1:1, le tampon est dans la bande`, `${z.diff} px différents sur l'original, ${z.bande} px d'encre dans la bande`);
  } else if (issue === 'fiche') {
    dit(z.pages.length === z.pagesB.length + 1, `${t} : fiche — une page de plus`);
    dit(z.diff <= z.aire * 0.002, `${t} : fiche — la page de l'étiquette est intacte`, `${z.diff} px différents`);
    const f = z.pages[1];
    dit(f && proche(f.w, 283.46, 1) && proche(f.h, 425.2, 1) && /B125/.test(f.texte), `${t} : fiche — 100×150 juste après l'étiquette, avec le N°`);
  } else dit(false, `${t} : une issue connue`, issue);
  if (thermique) {
    const tailles = z.pages.map((p) => `${p.w.toFixed(1)}×${p.h.toFixed(1)}`), avant = z.pagesB.map((p) => `${p.w.toFixed(1)}×${p.h.toFixed(1)}`);
    dit(tailles.slice(0, avant.length).join() === avant.join() && tailles.slice(avant.length).every((x) => x === '283.5×425.2'), `${t} : thermique — aucune page ne change de taille`, tailles.join(' '));
  }
  if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); z.png.forEach((u, i) => fs.writeFileSync(path.join(CAPT, `${nom}-${mode}-p${i + 1}.png`), Buffer.from(u.split(',')[1], 'base64'))); }
}

(async () => {
  await new Promise((o) => srv.listen(PORT, o));
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    const pg = await nav.newPage();
    pg.on('pageerror', (e) => console.log('   [pageerror] ' + e.message));
    await pg.goto(`http://localhost:${PORT}/`);
    await pg.addScriptTag({ url: '/pdf-lib.js' });
    if (PDFJS_DIR) { await pg.addScriptTag({ url: '/pdfjs/pdf.min.js' }); await pg.evaluate(() => { pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'; }); }
    else await pg.addScriptTag({ type: 'module', content: `import * as m from '/pdfjs/pdf.min.mjs'; m.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'; window.pdfjsLib = { ...m, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } };` });
    await pg.waitForFunction(() => window.pdfjsLib, null, { timeout: 15000 });
    await pg.addScriptTag({ content: SCRIPT });
    await pg.addScriptTag({ content: DANS_PAGE });
    await pg.addScriptTag({ content: DANS_PAGE_LIBRE });
    // Le « scan » : une image grise bruitée, des points noirs isolés, une étiquette.
    const pngScan = Buffer.from(await pg.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1190; c.height = 1684; const x = c.getContext('2d'), im = x.createImageData(c.width, c.height);
      let g = 3; const a = () => { g = (g * 16807) % 2147483647; return g / 2147483647; };
      for (let i = 0; i < im.data.length; i += 4) { const v = a() < 0.002 ? 60 : 236 + Math.floor(a() * 17); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0);
      x.fillStyle = 'rgb(235,255,235)'; x.fillRect(90, 1000, 820, 220); x.fillRect(90, 1250, 560, 300); x.fillRect(700, 1250, 300, 300);
      x.fillStyle = '#111'; for (let bx = 100; bx < 900; bx += 6 + Math.floor(a() * 8)) x.fillRect(bx, 1010, 3 + Math.floor(a() * 4), 200);
      x.font = '34px sans-serif'; ['Destinataire', 'Jeanne Exemple', '12 rue Imaginaire', '75000 PARIS', 'FRANCE'].forEach((l, i) => x.fillText(l, 100, 1300 + i * 48));
      for (let r = 0; r < 25; r++) for (let q = 0; q < 25; q++) if (a() < 0.5) x.fillRect(712 + q * 11, 1262 + r * 11, 11, 11);
      return c.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const pdfs = await fabriquer(pngScan);
    console.log(`Tampon du bordereau${MUT ? ' — MUTATION ' + MUT : ''} (${APP.includes(DEBUT) ? 'code actuel' : 'code d\'avant'}, pdf.js ${PDFJS_DIR ? '3.11 local' : 'du dépôt'})`);
    for (const [nom, octets] of Object.entries(pdfs)) {
      if (process.env.BANC_SEUL === 'libre') break;
      const b64 = Buffer.from(octets).toString('base64');
      for (const th of [false, true]) await juger(pg, nom, b64, th, ATTENDU[nom][th ? 'thermique' : 'normale']);
    }
    await libre(pg, pdfs);
    // Les vrais bordereaux, s'ils sont fournis (jamais dans le dépôt).
    if (process.env.BANC_REELS && fs.existsSync(process.env.BANC_REELS)) {
      for (const f of fs.readdirSync(process.env.BANC_REELS).filter((x) => x.endsWith('.pdf')).sort()) {
        const b64 = fs.readFileSync(path.join(process.env.BANC_REELS, f)).toString('base64');
        for (const th of [false, true]) await juger(pg, 'reel-' + f.replace(/\.pdf$/, ''), b64, th, null);
      }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
