// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA CAPTURE DES PHOTOS D'UNE ANNONCE VINTED, EXÉCUTÉE POUR DE VRAI
//        node scripts/bancs/photos.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 19 sept. : « il n'y a que 5 photos… c'est peut-être parce que la
// capture Vinted ne prend que 5 photos ». MESURÉ : ses annonces captées ont
// ≤ 6 photos (aucune au-dessus). CAUSE : `readListingDetailFromPage` ne lisait
// que `img[src]`, or le carrousel Vinted charge ses images au fur et à mesure —
// les slides pas encore affichées n'ont pas de `src`, seulement `srcset` /
// `data-src`. C'est §4.10 : cette fonction n'avait jamais tourné hors de Chrome.
//
// Ce banc extrait la VRAIE fonction (AVANT = HEAD, APRÈS = arbre de travail) et
// les exécute sur LE MÊME DOM — un carrousel où seules 5 images ont un `src` et
// le reste vit dans `srcset`/`data-src`/<source>. Il exige :
//   · APRÈS collecte TOUTES les photos (> 6), pas seulement les visibles ;
//   · une même photo à deux formats (f800 + f1200) ne compte qu'UNE fois
//     (sinon Leboncoin recevrait un doublon) ;
//   · les vignettes (f70) et les images non-Vinted sont écartées ;
//   · AVANT plafonnait bien à ≤ 6 sur ce même DOM (la preuve du défaut, §6.1).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path'), cp = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const FICH = 'vinted-sync-extension/vinted-panel.js';

// Extrait `const PUB_VINTED = …;` + la fonction nommée readListingDetailFromPage
// d'un texte source, en comptant les accolades (un regex ne suffit pas).
function extrait(src) {
  const pub = (src.match(/const PUB_VINTED\s*=\s*\/[^\n]*\/[a-z]*;/) || [])[0];
  const i = src.indexOf('function readListingDetailFromPage()');
  if (i < 0 || !pub) return null;
  let j = src.indexOf('{', i), prof = 0, k = j;
  for (; k < src.length; k++) {
    if (src[k] === '{') prof++;
    else if (src[k] === '}') { prof--; if (prof === 0) { k++; break; } }
  }
  return pub + '\n' + src.slice(i, k);
}

const NEUF = fs.readFileSync(path.join(REPO, FICH), 'utf8');
const VIEUX = cp.execSync('git show HEAD:' + FICH, { cwd: REPO, encoding: 'utf8' });
const fnNeuf = extrait(NEUF), fnVieux = extrait(VIEUX);

// Le DOM d'une page d'annonce dont le carrousel n'a chargé QUE 5 slides en `src`.
// og:image = photo 1. Photos 2-6 en `src`. 7-9 seulement en lazy (data-src,
// srcset, <source>). Photo 8 apparaît en f800 ET f1200 (même photo, doit
// compter une fois). Une vignette f70 et une image étrangère sont là pour être
// écartées. Toutes les URL portent une query `?s=…` comme les vraies.
const V = (h, f, n) => `https://images1.vinted.net/t/${h}/${f}/${n}.jpeg?s=abc${n}`;
const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted</title>
<meta property="og:image" content="${V('01_aaa', 'f800', 1)}">
</head><body>
  <div data-testid="description"><span>Superbe paire, portée deux fois. Envoi soigné.</span></div>
  <div class="carousel">
    <img src="${V('02_bbb', 'f800', 2)}">
    <img src="${V('03_ccc', 'f800', 3)}">
    <img src="${V('04_ddd', 'f800', 4)}">
    <img src="${V('05_eee', 'f800', 5)}">
    <img src="${V('06_fff', 'f800', 6)}">
    <img data-src="${V('07_ggg', 'f800', 7)}">
    <img srcset="${V('08_hhh', 'f800', 8)} 1x, ${V('08_hhh', 'f1200', 8)} 2x">
    <picture><source srcset="${V('09_iii', 'f1200', 9)} 2x"><img></picture>
    <img src="${V('01_aaa', 'f1200', 1)}">            <!-- même photo que og:image, autre format : doublon -->
    <img src="https://images1.vinted.net/t/xx_thumb/f70/99.jpeg?s=z">  <!-- vignette : écartée -->
    <img src="https://cdn.autre-site.com/pub/banniere.jpg">            <!-- étrangère : écartée -->
  </div>
</body></html>`;

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  if (!fnNeuf || !fnVieux) { console.log('KO  extraction de readListingDetailFromPage impossible'); process.exit(1); }
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE); });
  await new Promise((res) => srv.listen(4493, res));
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  } catch (e) { console.log('KO  Chromium indisponible :', e.message); srv.close(); process.exit(1); }
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Aucune image ne part sur le réseau : un banc ne dépend pas d'un CDN.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (r.request().resourceType() === 'image' ? r.abort() : r.continue()));
  await pg.goto('http://127.0.0.1:4493/');

  const run = (fn) => pg.evaluate((code) => { eval(code); const r = readListingDetailFromPage(); return r ? r.photos : []; }, fn);
  const avant = await run(fnVieux);
  const apres = await run(fnNeuf);

  console.log('AVANT (HEAD) :', avant.length, 'photos · APRÈS (arbre) :', apres.length, 'photos');

  // §6.1 : le défaut existait bien sur le code d'AVANT — il RATAIT les slides
  // pas encore affichées (data-src, srcset, <source>), qui n'ont pas de `src`.
  const cle0 = (u) => String(u).replace(/\?.*$/, '').replace(/\/(f\d+|tc)\//, '/');
  const lazy = [V('07_ggg', 'f800', 7), V('08_hhh', 'f800', 8), V('09_iii', 'f1200', 9)].map(cle0);
  const avantCles = avant.map(cle0);
  const manquantesAvant = lazy.filter((k) => !avantCles.includes(k)).length;
  dit(manquantesAvant === 3, 'AVANT : les 3 photos en lazy (data-src/srcset/source) étaient PERDUES', 'manquantes : ' + manquantesAvant + '/3');
  // Et il doublait la même photo vue à deux formats (photo 1 en og + f1200).
  dit(new Set(avantCles).size < avantCles.length, 'AVANT : une photo à deux formats était comptée DEUX fois (doublon)', avant.length + ' URL, ' + new Set(avantCles).size + ' distinctes');

  // Le correctif : toutes les photos, y compris les slides pas encore affichées.
  dit(apres.length === 9, 'APRÈS : les 9 photos réelles sont captées (5 visibles + 4 en lazy)', apres.length + ' photos');
  dit(apres.length > avant.length, 'APRÈS capte STRICTEMENT plus qu’AVANT', avant.length + ' → ' + apres.length);

  // Pas de doublon : même photo à deux formats = une seule.
  const cle = (u) => String(u).replace(/\?.*$/, '').replace(/\/(f\d+|tc)\//, '/');
  const cles = apres.map(cle);
  dit(new Set(cles).size === cles.length, 'aucun doublon : une photo à deux formats (f800+f1200) ne compte qu’une fois', cles.length + ' URL, ' + new Set(cles).size + ' photos distinctes');
  dit(cles.filter((k) => k === cle(V('08_hhh', 'f800', 8))).length === 1, 'la photo 8, vue en f800 ET f1200, n’est présente qu’une fois');
  dit(cles.filter((k) => k === cle(V('01_aaa', 'f800', 1))).length === 1, 'la photo principale (og:image + <img> f1200) n’est pas doublée');

  // La photo principale reste en tête.
  dit(cle(apres[0]) === cle(V('01_aaa', 'f800', 1)), 'la photo principale (og:image) reste en PREMIER');

  // Les slides lazy sont bien remontées.
  dit(apres.some((u) => cle(u) === cle(V('07_ggg', 'f800', 7))), 'la photo en data-src est captée');
  dit(apres.some((u) => cle(u) === cle(V('08_hhh', 'f800', 8))), 'la photo en srcset est captée');
  dit(apres.some((u) => cle(u) === cle(V('09_iii', 'f1200', 9))), 'la photo dans <source srcset> est captée');

  // Ce qu'il ne faut JAMAIS prendre.
  dit(!apres.some((u) => /\/f70\//.test(u)), 'la vignette f70 est écartée');
  dit(!apres.some((u) => /autre-site/.test(u)), 'l’image non-Vinted est écartée');
  dit(apres.every((u) => /\/(f800|f1200|tc)\//.test(u) && /vinted\.net/.test(u)), 'toutes les photos gardées sont des grands formats Vinted');

  dit(errs.length === 0, 'aucune erreur de page', errs.join(' | '));

  await b.close(); srv.close();
  console.log(ko === 0 ? '\nLa capture prend TOUTES les photos de l’annonce, sans doublon.' : '\n' + ko + ' contrôle(s) au rouge.');
  process.exit(ko === 0 ? 0 : 1);
})();
