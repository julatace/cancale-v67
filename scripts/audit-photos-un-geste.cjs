// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : AMÉLIORER LES PHOTOS D'UNE PAIRE EN UN GESTE (23 nov., lot photos-un-geste)
// Il EXÉCUTE la vraie règle (src/ameliorerPhoto.js `ameliorerPixels`) sur des images INVENTÉES (pixels calculés ici) :
//   P1 lumière : une photo terne est étalée (1 % → noir, 99 % → blanc), le gain est BORNÉ ; une photo déjà étalée
//      n'est pas touchée ;
//   P2 fond uniforme : le fond RELIÉ au bord passe en blanc ; une zone de la même teinte ENFERMÉE par la chaussure
//      n'est jamais blanchie ; la chaussure ne change pas ;
//   P3 un fond pas uni n'est pas touché, et c'est dit (`pas-uni`) ;
//   P4 recadrage : la boîte du sujet, au format 3:4, le sujet entier dedans ; aucun sujet ⇒ pas de recadrage, dit ;
//   P5 l'ORIGINAL n'est jamais modifié (les pixels d'entrée intacts ; l'écran range `ameliore` À CÔTÉ de `img`) ;
//   P6 §2.9 : aucun envoi, aucune clé, aucun modèle dans le module ; le même réglage sur CHAQUE photo de la paire ;
//      pas promis à Leboncoin ni à eBay (seul le studio l'importe) ; chaque texte dans les cinq langues.
// Lancer : node scripts/audit-photos-un-geste.cjs [--mutation=<nom>]  (chaque mutation doit rougir)
//   mutations : gain connexe uni original ratio envoi un-reglage
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ug-'));
for (const f of ['src/ameliorerPhoto.js', 'src/StudioPhoto.jsx', ...['fr', 'en', 'es', 'it', 'de'].map((l) => `src/i18n/langues/${l}/memePhoto.js`)]) {
  if (!fs.existsSync(path.join(R, f))) continue; fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.copyFileSync(path.join(R, f), path.join(T, f));
}
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  gain: ['src/ameliorerPhoto.js', 'const gain = Math.min(GAIN_MAX, 255 / ecart);', 'const gain = 255 / ecart;'],
  connexe: ['src/ameliorerPhoto.js', '  while (top) {', '  for (let p = 0; p < w * h; p++) pousser(p);\n  while (top) {'],
  uni: ['src/ameliorerPhoto.js', 'if (R.fond) { if (A.uni) {', 'if (R.fond) { if (true) {'],
  original: ['src/StudioPhoto.jsx', '{ ...x, ameliore: faits.get(x.id).img, amelioreAt: at,', '{ ...x, img: faits.get(x.id).img, ameliore: faits.get(x.id).img, amelioreAt: at,'],
  ratio: ['src/ameliorerPhoto.js', '  if (bw / bh > RATIO) bh = bw / RATIO; else bw = bh * RATIO;\n', ''],
  envoi: ['src/ameliorerPhoto.js', 'export async function ameliorerDataUrl(src,', "export const envoyer = (x) => fetch('/api/ai', { method: 'POST', body: x });\nexport async function ameliorerDataUrl(src,"],
  'un-reglage': ['src/StudioPhoto.jsx', 'const r = await ameliorerDataUrl(liste[i].img, R);', 'const r = await ameliorerDataUrl(liste[i].img, i ? { ...R, fond: false } : R);'],
};
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
  console.log('… mutation « ' + MUT + ' » posée');
}
const sansCommentaires = (f) => fs.readFileSync(path.join(T, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Une image inventée : w × h, `px(x, y)` ⇒ [r, g, b].
const image = (w, h, px) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = px(x, y); const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } return { data: d, width: w, height: h }; };
const pix = (im, x, y) => { const i = (y * im.width + x) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2]]; };
const lumi = (im) => { const l = []; for (let i = 0; i < im.data.length; i += 4) l.push(0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2]); l.sort((a, b) => a - b); return [l[Math.floor(l.length * 0.01)], l[Math.floor(l.length * 0.99)]]; };
let graine = 7; const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };

(async () => {
  let A;
  try { A = await import(pathToFileURL(path.join(T, 'src/ameliorerPhoto.js')).href); } catch (e) { dit(false, 'src/ameliorerPhoto.js se charge', String(e.message).slice(0, 200)); return fin(); }
  // La paire : 240 × 320, fond gris clair (200) uni, une « chaussure » sombre (60,50,40) de 100 × 60 en bas à gauche,
  // et DEDANS une fenêtre (un œillet) de la couleur du fond, enfermée par la chaussure.
  const W = 240, H = 320;
  const dansChaussure = (x, y) => x >= 30 && x < 130 && y >= 220 && y < 280;
  const oeillet = (x, y) => x >= 70 && x < 80 && y >= 240 && y < 250;
  const paire = image(W, H, (x, y) => (oeillet(x, y) ? [200, 200, 200] : dansChaussure(x, y) ? [60, 50, 40] : [200, 200, 200]));
  const avant = Buffer.from(paire.data);

  console.log('── P2. Le fond uniforme');
  const F = A.ameliorerPixels(paire, { lumiere: false, recadrage: false, fond: true });
  dit(F.fait.fond === true && pix(F.image, 5, 5).join() === '255,255,255' && pix(F.image, 200, 100).join() === '255,255,255', 'P2 le fond relié au bord passe en blanc', F.fait);
  dit(pix(F.image, 75, 245).join() === '200,200,200', 'P2b l’œillet de la couleur du fond, ENFERMÉ par la chaussure, n’est pas blanchi', pix(F.image, 75, 245));
  dit(pix(F.image, 50, 230).join() === '60,50,40', 'P2c la chaussure ne change pas', pix(F.image, 50, 230));
  console.log('── P5. L’original');
  dit(Buffer.from(paire.data).equals(avant), 'P5 les pixels d’entrée sont intacts (le résultat est une copie)');

  console.log('── P3. Un fond pas uni');
  const bruit = image(W, H, (x, y) => (dansChaussure(x, y) ? [60, 50, 40] : [Math.floor(hasard() * 255), Math.floor(hasard() * 255), Math.floor(hasard() * 255)]));
  const Bz = A.ameliorerPixels(bruit, { lumiere: false, recadrage: false, fond: true });
  dit(Bz.fait.fond === 'pas-uni' && Buffer.from(Bz.image.data).equals(Buffer.from(bruit.data)), 'P3 fond pas uni : rien de changé, et c’est dit (`pas-uni`)', Bz.fait);

  console.log('── P1. La lumière');
  const terne = image(W, H, (x, y) => { const v = 40 + Math.round(((x + y) % 81)); return [v, v, v]; });   // 40 … 120
  const L1 = A.ameliorerPixels(terne, { lumiere: true, recadrage: false, fond: false });
  const [b0, h0] = lumi(terne), [b1, h1] = lumi(L1.image);
  dit(L1.fait.lumiere === true && h1 - b1 > (h0 - b0) * 1.8, `P1 une photo terne est étalée (écart ${Math.round(h0 - b0)} → ${Math.round(h1 - b1)})`, [b0, h0, b1, h1]);
  dit(h1 - b1 <= (h0 - b0) * A.GAIN_MAX + 2 && A.GAIN_MAX <= 2.5, 'P1b l’étirement est BORNÉ (gain ≤ 2,2)', [h1 - b1, h0 - b0]);
  const pleine = image(W, H, (x) => { const v = Math.round((x / (W - 1)) * 255); return [v, v, v]; });
  const L2 = A.ameliorerPixels(pleine, { lumiere: true, recadrage: false, fond: false });
  dit(L2.fait.lumiere === 'deja' && Buffer.from(L2.image.data).equals(Buffer.from(pleine.data)), 'P1c une photo déjà étalée n’est pas touchée (« deja »)', L2.fait);

  console.log('── P4. Le recadrage');
  const C = A.ameliorerPixels(paire, { lumiere: false, recadrage: true, fond: false });
  const r = C.image.width / C.image.height;
  dit(C.fait.recadrage === true && Math.abs(r - 3 / 4) < 0.02 && C.image.width < W, `P4 la boîte du sujet, au format 3:4 (${C.image.width} × ${C.image.height})`, C.fait);
  // Le sujet entier dedans : on compte les pixels « chaussure » dans le résultat.
  let n = 0; for (let i = 0; i < C.image.data.length; i += 4) if (C.image.data[i] === 60 && C.image.data[i + 1] === 50) n++;
  dit(n === 100 * 60 - 10 * 10, 'P4b la chaussure entière est dans le cadre', n);
  const vide = image(W, H, () => [200, 200, 200]);
  const Cv = A.ameliorerPixels(vide, { lumiere: false, recadrage: true, fond: false });
  dit(Cv.fait.recadrage === 'sujet' && Cv.image.width === W, 'P4c aucun sujet : pas de recadrage, et c’est dit', Cv.fait);

  console.log('── P6. Gratuit, sur toutes les photos, au studio seulement');
  const mod = sansCommentaires('src/ameliorerPhoto.js');
  dit(!/fetch\(|XMLHttpRequest|sendBeacon|photoroom|onnx|\/api\/|import\(/i.test(mod), 'P6 aucun envoi, aucune clé, aucun modèle dans le module');
  const st = sansCommentaires('src/StudioPhoto.jsx');
  const at = (st.split('const ameliorerTout = async () => {')[1] || '').split('\n  };')[0];
  dit(/ameliorerDataUrl\(liste\[i\]\.img, R\)/.test(at) && /const R = \{ \.\.\.reglagesGeste \}/.test(at), 'P6b le MÊME réglage sur CHAQUE photo de la paire');
  dit(/ameliore: faits\.get\(x\.id\)\.img/.test(at) && !/\bimg: faits/.test(at) && /revenirOriginal/.test(st), 'P6c le résultat est rangé À CÔTÉ de l’original (`ameliore`), « Revenir aux originaux » existe');
  const importeurs = [];
  const fouiller = (d) => { for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|i18n/.test(p)) fouiller(p); } else if (/\.(jsx?|cjs)$/.test(e.name) && p !== 'src/ameliorerPhoto.js') { const t = fs.readFileSync(path.join(R, p), 'utf8'); if (/from ['"][./]*ameliorerPhoto\.js['"]/.test(t)) importeurs.push(p); } } };
  fouiller('src'); fouiller('vinted-sync-extension');
  dit(importeurs.length === 1 && importeurs[0] === 'src/StudioPhoto.jsx', 'P6d seul le studio photo l’importe (rien promis à Leboncoin ni à eBay)', importeurs);
  const cles = [...new Set([...st.matchAll(/tr\('(ug\.[^']+)'/g)].map((m) => m[1]).filter((k) => !k.endsWith('.')))].concat(['ug.r.lumiere', 'ug.r.recadrage', 'ug.r.fond']);
  const manque = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = fs.readFileSync(path.join(T, `src/i18n/langues/${l}/memePhoto.js`), 'utf8'); for (const k of cles) if (!t.includes(JSON.stringify(k))) manque.push(l + ':' + k); }
  dit(cles.length >= 15 && manque.length === 0, `P6e chaque texte dans les cinq langues (${cles.length} clés)`, manque);
  fin();
})().catch((e) => { dit(false, 'exécution', String(e && e.stack || e).slice(0, 400)); fin(); });

function fin() {
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-photos-un-geste : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}
