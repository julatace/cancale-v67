// AUDIT « LA BONNE TAILLE DE PHOTO » (23 nov., lot photos-nettes) — exécute src/photoTaille.js.
// Julien : « toutes les photos sont floues ». La règle : parmi les adresses DÉJÀ LUES du même
// fichier, la plus petite qui donne ≥ 2 px réels par point ; jamais une adresse fabriquée ;
// jamais plus petite que celle qu'on a. `MUTATION=nom` réaffaiblit la règle (doit rougir).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const MUTATION = process.env.MUTATION || '';
const MUTER = {
  'jamais-plus-grand': (s) => s.replace("if (!L.length || !(besoin > w0)) return u;", 'return u;'),
  'toujours-pleine': (s) => s.replace('const assez = L.find((t) => t.largeur >= besoin);', 'const assez = null;'),
  'facteur-1': (s) => s.replace('export const FACTEUR_RETINA = 2;', 'export const FACTEUR_RETINA = 1;'),
};
let ko = 0, ok = 0;
const dit = (b, q, d) => { if (b) ok++; else ko++; console.log(`${b ? '  ✅ ' : '  ❌ '}${q}${!b && d ? ' — ' + d : ''}`); };
(async () => {
  let fichier = path.join(R, 'src', 'photoTaille.js');
  if (MUTATION) {
    if (!MUTER[MUTATION]) { console.log('mutation inconnue : ' + Object.keys(MUTER).join(', ')); process.exit(2); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-taille-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'visionneuse.js'), fs.readFileSync(path.join(R, 'src', 'visionneuse.js'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'photoTaille.js'), MUTER[MUTATION](fs.readFileSync(fichier, 'utf8')));
    fichier = path.join(dir, 'photoTaille.js');
  }
  const T = await import(fichier);
  const V = (seg, t, s) => t === 'tc' ? `https://images1.vinted.net/tc/${seg}/17.webp?s=${s}` : `https://images1.vinted.net/t/${seg}/${t}/17.webp?s=${s}`;
  const p150 = V('05_a_X', '150x210', 'a'), p310 = V('05_a_X', '310x430', 'b'), p800 = V('05_a_X', 'f800', 'c'), ptc = V('05_a_X', 'tc', 'd');
  const autre = V('05_a_Y', 'f800', 'e');
  dit(T.largeurPhoto(p150) === 150 && T.largeurPhoto(p800) === 800 && T.largeurPhoto(ptc) === T.LARGEUR_PLEINE && T.largeurPhoto('https://img.leboncoin.fr/x.jpg') === null, 'T1 la largeur se lit dans le chemin Vinted (150x210, f800, /tc/), pas sue ailleurs');
  dit(T.pleineTaille(p150) === p150, 'T2 rien de connu ⇒ la même adresse (aucune adresse fabriquée)');
  T.noterPhotos({ url: p800, full_size_url: ptc, thumbnails: [{ url: p150, width: 150 }, { url: p310, width: 310 }] });
  T.noterPhotos(autre);
  dit(T.photoPour(p150, 88) === p150, 'T3 une vignette de 44 pt (88 px) garde 150x210');
  dit(T.photoPour(p150, 300) === p310, 'T4 une carte de 150 pt (300 px) prend 310x430, pas la pleine taille');
  dit(T.photoPour(p150, 600) === p800, 'T5 600 px ⇒ f800 (la plus petite qui suffit)');
  dit(T.pleineTaille(p150) === ptc && T.pleineTaille(p800) === ptc, 'T6 plein écran ⇒ la plus grande taille connue du MÊME fichier');
  dit(T.photoPour(p800, 100) === p800 && T.photoPour(ptc, 100) === ptc, 'T7 jamais plus petite que celle qu’on a');
  dit(T.pleineTaille(V('05_a_Z', '150x210', 'f')) === V('05_a_Z', '150x210', 'f') && !T.taillesConnues(p150).some((t) => t.url === autre), 'T8 un autre fichier ne prête jamais sa photo');
  const tous = new Set([p150, p310, p800, ptc, autre]);
  dit([88, 300, 600, 5000].every((b) => tous.has(T.photoPour(p150, b))), 'T9 toute adresse rendue a été LUE (jamais réécrite)');
  dit(T.besoinAffiche(44, 44, 150, 210, 'cover') === 88 && T.besoinAffiche(390, 844, 150, 210, 'contain') === 780, 'T10 le besoin : 2 px réels par point (44 pt rognée ⇒ 88 ; plein écran 390 pt ⇒ 780)');
  console.log(`\n${ko ? '❌' : '✅'} audit-photo-taille : ${ok} bon(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
