// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LA PHOTO EN GRAND, PARTOUT » (10 nov., lot AN) — src/visionneuse.js
//
//  Julien (9 nov.) : « quand on clique sur la photo de l'article cela nous mette la
//  photo en grand, sur ordi ou tel, là c'est pour toute l'app ». UNE visionneuse.
//  Cet audit EXÉCUTE la vraie règle (`src/visionneuse.js`, éléments simulés) :
//   G. la galerie d'une photo touchée vient de la clé de son FICHIER (taille servie
//      ignorée), jamais d'un titre : 2 annonces au même titre gardent chacune SES
//      photos ; une photo inconnue ⇒ elle seule ;
//   T. ce qui ouvre : une vignette marquée, chargée, ≥ 32 px ; pas une icône, pas une
//      image absente, pas une photo qui EST tout un bouton, pas `data-sans-visionneuse` ;
//   O. `ouvrirVisionneuse(photos, i, { titre, sous })` : l'index borné, la légende
//      transmise (la photo du carton, lot AZ, passe par elle) ;
//   U. il n'y en a qu'UNE : la vue à part de la photo du carton (`VuePhotoCarton`,
//      `data-photo-carton-vue`) n'existe plus ; elle passe devant le scanner
//      (z > Z_CONFIRMATION − 2) et sous les confirmations (z < Z_CONFIRMATION).
//  `--prouve` rejoue l'audit sous des MUTATIONS : chacune DOIT être rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const RACINE = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

async function verifier({ mutation = '' } = {}) {
  let ok = 0, ko = 0;
  const dit = (c, n, d) => { if (c) ok++; else ko++; if (!mutation) console.log(`${c ? '✅' : '❌'} ${n}${!c && d ? ' — ' + String(d).slice(0, 200) : ''}`); };

  let src = lire('src/visionneuse.js');
  if (mutation === 'taille-gardee') src = src.replace("filter((s) => !/^(f\\d{2,4}|\\d{2,4}x\\d{2,4}|thumbnails?)$/i.test(s))", 'filter(Boolean)');
  if (mutation === 'sans-borne-taille') src = src.replace('if (r.width < TAILLE_MIN_VIGNETTE || r.height < TAILLE_MIN_VIGNETTE) return null;', '');
  if (mutation === 'absente-ouvre') src = src.replace("if (img.complete === false || !(img.naturalWidth > 0)) return null;", '');
  if (mutation === 'legende-perdue') src = src.replace('index: Math.max(0, Math.min(Number(index) || 0, L.length - 1)), titre, sous }', 'index: Math.max(0, Math.min(Number(index) || 0, L.length - 1)) }');
  let jsx = lire('src/Visionneuse.jsx'), carton = lire('src/PhotoCarton.jsx');
  if (mutation === 'deux-vues') carton += "\nexport function VuePhotoCarton() { return <div data-photo-carton-vue=\"\"/>; }\n";
  if (mutation === 'z-sous-scanner') jsx = jsx.replace(/const Z_VISIONNEUSE = \d+;/, 'const Z_VISIONNEUSE = 15000;');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-visionneuse-'));
  const fichier = path.join(tmp, 'visionneuse.mjs'); fs.writeFileSync(fichier, src);
  const V = await import('file://' + fichier);
  fs.rmSync(tmp, { recursive: true, force: true });

  // ── G. La galerie, par fichier ───────────────────────────────────────────────
  V.oublierGaleries();
  const ph = (d, f, t = 'f800') => `https://images1.vinted.net/t/${d}/${t}/${f}.jpeg?s=abc`;
  const A = { title: 'Nike Air Max 90 blanche 42', photos: [{ url: ph('a1', '111'), full_size_url: ph('a1', '111', 'f1600') }, { url: ph('a1', '112') }, { url: ph('a1', '113') }] };
  const B = { title: 'Nike Air Max 90 blanche 42', photos: [{ url: ph('b1', '211') }, { url: ph('b1', '212') }] };
  V.enregistrerGaleries([A, B]);
  const gA = V.galerieDe(ph('a1', '112', '310x430'));
  dit(gA.photos.length === 3 && gA.index === 1 && /\/112\./.test(gA.photos[1]), 'G1 la vignette (autre taille servie) ⇒ la galerie de SON annonce, à SA place (2/3)', JSON.stringify(gA));
  const gB = V.galerieDe(ph('b1', '211', 'thumbnails'));
  dit(gB.photos.length === 2 && gB.photos.every((u) => /\/b1\//.test(u)), 'G2 même titre, autre annonce ⇒ SES photos, jamais celles de l’autre', JSON.stringify(gB));
  const gX = V.galerieDe('https://images1.vinted.net/t/zz/f800/999.jpeg');
  dit(gX.photos.length === 1 && gX.index === 0, 'G3 photo inconnue ⇒ elle seule', JSON.stringify(gX));
  dit(V.galerieDe('').photos.length === 0, 'G4 rien touché ⇒ rien');

  // ── T. Ce qui ouvre ──────────────────────────────────────────────────────────
  const el = ({ w = 64, h = 64, charge = true, marque = true, sans = false, porte = null } = {}) => {
    const img = { tag: 'img', complete: charge, naturalWidth: charge ? 600 : 0, getAttribute: () => null,
      getBoundingClientRect: () => ({ width: w, height: h }), parentElement: { closest: (q) => (/button/.test(q) ? porte : null) } };
    img.closest = (q) => {
      if (/img\[data-vrm-vignette\]/.test(q)) return marque ? img : null;
      if (/data-sans-visionneuse/.test(q)) return sans ? {} : null;
      return null;
    };
    return img;
  };
  dit(V.vignetteTouchee(el()) !== null, 'T1 une vignette marquée, chargée, 64 px ⇒ ouvre');
  dit(V.vignetteTouchee(el({ w: 20, h: 20 })) === null, 'T2 une icône (< 32 px) ⇒ rien');
  dit(V.vignetteTouchee(el({ charge: false })) === null, 'T3 image absente ⇒ rien');
  dit(V.vignetteTouchee(el({ marque: false })) === null, 'T4 une image sans le marqueur ⇒ rien');
  dit(V.vignetteTouchee(el({ sans: true })) === null, 'T5 `data-sans-visionneuse` ⇒ rien');
  dit(V.vignetteTouchee(el({ porte: { getBoundingClientRect: () => ({ width: 66, height: 66 }) } })) === null, 'T6 une photo qui EST tout le bouton ⇒ le geste du bouton gagne');
  dit(V.vignetteTouchee(el({ porte: { getBoundingClientRect: () => ({ width: 360, height: 80 }) } })) !== null, 'T7 une vignette dans une rangée-bouton plus grande ⇒ ouvre');

  // ── O. L'ouverture par code (facture, photo du carton) ──────────────────────
  const recu = [];
  global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  global.window = { dispatchEvent: (e) => { recu.push(e); return true; } };
  V.ouvrirVisionneuse(['data:image/jpeg;base64,AAAA'], 7, { titre: 'Photo du carton', sous: 'N°33 · 10 nov.' });
  const d = recu[0] && recu[0].detail;
  dit(d && d.index === 0 && d.photos.length === 1, 'O1 l’index est borné à la galerie', JSON.stringify(d));
  dit(d && d.titre === 'Photo du carton' && d.sous === 'N°33 · 10 nov.', 'O2 la légende passe (titre, sous)', JSON.stringify(d));
  dit(V.ouvrirVisionneuse([], 0) === false, 'O3 aucune photo ⇒ rien ne s’ouvre');
  delete global.window; delete global.CustomEvent;

  // ── U. Une seule visionneuse ─────────────────────────────────────────────────
  const app = lire('src/App.jsx');
  const zConf = Number((app.match(/const Z_CONFIRMATION = (\d+);/) || [])[1]);
  const zScan = /<ScannerColis[^\n]*zIndex=\{Z_CONFIRMATION - 2\}/.test(app) ? zConf - 2 : NaN;
  const zVis = Number((jsx.match(/const Z_VISIONNEUSE = (\d+);/) || [])[1]);
  dit(zVis > zScan && zVis < zConf, `U1 la visionneuse passe devant le scanner (${zScan}) et sous les confirmations (${zConf}) : ${zVis}`);
  const sansCom = (t) => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  dit(!/VuePhotoCarton|data-photo-carton-vue/.test(sansCom(carton)) && /ouvrirVisionneuse\(/.test(sansCom(carton)), 'U2 la photo du carton s’ouvre dans LA visionneuse (plus de vue à part)');
  const autres = fs.readdirSync(path.join(RACINE, 'src')).filter((f) => /\.jsx?$/.test(f) && f !== 'Visionneuse.jsx')
    .filter((f) => /data-photo-carton-vue|VuePhotoCarton/.test(sansCom(f === 'PhotoCarton.jsx' ? carton : lire('src/' + f))));
  dit(autres.length === 0, 'U3 aucun autre fichier ne dessine sa propre « photo en grand »', autres.join(', '));
  dit(/<Visionneuse\b/.test(app) && (app.match(/<Visionneuse\b/g) || []).length === 1, 'U4 la coque monte la visionneuse UNE fois');
  dit(/stopImmediatePropagation\(\); fermer\(\)/.test(jsx) && /clavier\.current = k/.test(jsx), 'U5 Échap ferme la photo SEULE (écouteur de la coque, avant ceux des feuilles)');
  return { ok, ko };
}

(async () => {
  const r = await verifier();
  console.log(`\n${r.ko ? '❌' : '✅'} ${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (!PROUVE) process.exit(r.ko ? 1 : 0);
  let tenu = 0; const M = ['taille-gardee', 'sans-borne-taille', 'absente-ouvre', 'legende-perdue', 'deux-vues', 'z-sous-scanner'];
  for (const m of M) { const x = await verifier({ mutation: m }); console.log(`${x.ko ? '✅' : '❌'} mutation ${m} : ${x.ko} rouge(s)`); if (x.ko) tenu++; }
  console.log(`\n${tenu === M.length ? '✅' : '❌'} ${tenu}/${M.length} mutations rouges`);
  process.exit(r.ko || tenu !== M.length ? 1 : 0);
})();
