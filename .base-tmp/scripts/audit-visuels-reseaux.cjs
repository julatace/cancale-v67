// ════════════════════════════════════════════════════════════════════════════
//  VISUELS RÉSEAUX (11 nov., lot visuels-reseaux) — la règle EXÉCUTÉE
//
//  src/visuelsReseaux.js tourne ici (import ESM), avec une mesure approchée et un
//  faux contexte 2D. On exige :
//    R1 un article du visuel ne porte RIEN d'autre que titre, marque, taille, état,
//       prix, photos (ni N°, ni prix d'achat, ni compte, ni pseudo) — et le plan
//       ne les écrit jamais ;
//    R2 prix : euros seulement (autre devise ⇒ rien, jamais converti), forme objet
//       `{amount}` comprise ; pas su ⇒ null ;
//    R3 pour chaque format × modèle, seul et en lot : tout dans l'image (aucun NaN,
//       rien hors cadre), UNE photo par article dessiné, jamais une photo pas lue
//       (un article sans photo lue sort du plan, aucun plan ⇒ `vide`) ;
//    R4 le prix écrit seulement quand il est su ; R5 le nom de boutique écrit
//       seulement s'il est posé (vide par défaut) ;
//    R6 les pages : 4 par carré, 6 par story, 24 au plus ;
//    R7 le dessin refuse un plan dont une photo manque (jamais une image trouée) ;
//    R8 le câblage : la photo d'un canvas passe par `lirePhotoVisuel` (route photo
//       de VRM, puis copie de l'extension — jamais le <img> natif d'un CDN), le
//       composant ne charge QUE ce que `lirePhoto` rend, le réglage est dans
//       SYNC_KEYS, les deux entrées (fiche « … », Actions) existent.
//  `--prouve` : six mutations ⇒ chacune doit rendre l'audit ROUGE.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const R = process.env.VIS_RACINE || path.join(__dirname, '..');
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : ''}`); };

async function principal() {
  const V = await import(pathToFileURL(path.join(R, 'src', 'visuelsReseaux.js')).href + '?t=' + Date.now());
  const SECRET_NUM = 'N°4711', SECRET_ACHAT = '33,33', SECRET_PSEUDO = 'pseudo_invente_x';
  const item = (o = {}) => ({ id: '90000001', title: 'Baskets inventées modèle test', brand: 'MarqueX', size: '42', condition: 'Très bon état',
    price: { amount: '80.0' }, currency: 'EUR', photo: 'https://images1.vinted.net/t/a/f800/1.jpeg', numero: SECRET_NUM, buyPrice: SECRET_ACHAT,
    _acc: { vinted_user_id: '111', login: SECRET_PSEUDO }, ...o });

  console.log('── R1 rien de privé');
  const a = V.articleVisuel(item(), ['https://images1.vinted.net/t/a/f800/2.jpeg', 'https://images1.vinted.net/t/a/f800/3.jpeg', 'https://images1.vinted.net/t/a/f800/4.jpeg']);
  dit(JSON.stringify(Object.keys(a).sort()) === JSON.stringify(['cle', 'etat', 'marque', 'photos', 'prix', 'taille', 'titre']), 'R1 un article porte seulement titre, marque, taille, état, prix, photos (et sa clé)', Object.keys(a));
  dit(!JSON.stringify(a).includes(SECRET_NUM) && !JSON.stringify(a).includes(SECRET_ACHAT) && !JSON.stringify(a).includes(SECRET_PSEUDO), 'R1 ni N°, ni prix d’achat, ni pseudo dans l’article', a);
  dit(a.photos.length === V.PHOTOS_MAX_SEULE && a.photos[0].endsWith('/1.jpeg'), 'R1 la photo de l’annonce d’abord, trois au plus', a.photos);
  dit(V.articleVisuel(item({ photo: 'javascript:alert(1)' }), ['http://x/1.jpg']).photos.length === 0, 'R1 une photo qui n’est ni https, ni data:, ni blob: est écartée');

  console.log('── R2 prix');
  dit(V.prixEuros({ amount: '80.0' }, 'EUR') === 80 && V.prixEuros('79,5') === 79.5, 'R2 objet {amount} et virgule lus');
  dit(V.prixEuros({ amount: '80.0' }, 'GBP') === null && V.prixEuros(80, 'usd') === null, 'R2 autre devise ⇒ null (jamais converti)');
  dit(V.prixEuros(null) === null && V.prixEuros('') === null && V.prixEuros(0) === null && V.prixEuros('abc') === null, 'R2 pas su ⇒ null');

  console.log('── R3-R5 plans');
  const art = (i, o = {}) => ({ ...V.articleVisuel(item({ id: String(90000000 + i), ...o }), [`https://images1.vinted.net/t/a/f800/${i}b.jpeg`, `https://images1.vinted.net/t/a/f800/${i}c.jpeg`]), lues: [0, 1, 2] });
  const textes = { taille: (t) => `Taille ${t}`, lot: 'Nouveautés de la semaine' };
  let hors = [], photoMauv = [], prixKo = [], boutKo = [], prive = [];
  for (const format of Object.keys(V.FORMATS)) for (const modele of V.MODELES) for (const n of [1, 2, 3, 4, 6]) for (const boutique of ['', 'Boutique Inventée']) {
    const arts = Array.from({ length: n }, (_, i) => art(i + 1, i === 1 ? { price: null } : {}));
    const plan = V.planVisuel({ format, modele, accent: 'bleu', boutique, articles: arts.slice(0, V.PAR_PAGE[format]), lot: n > 1, page: 1, pages: 1, textes });
    const { w, h } = V.FORMATS[format];
    const cle = `${format}/${modele}/${n}/${boutique ? 'b' : '-'}`;
    for (const op of plan.ops) {
      const nums = ['x', 'y', 'w', 'h', 'r'].filter((k) => k in op).map((k) => op[k]);
      if (nums.some((v) => !Number.isFinite(v))) hors.push(cle + ' NaN ' + op.t);
      if (op.t !== 'fond' && (op.x < -0.5 || op.y < -0.5 || (op.w != null && op.x + op.w > w + 0.5) || (op.h != null && op.y + op.h > h + 0.5) || op.y > h)) hors.push(`${cle} ${op.t} ${op.texte || ''}`);
      if (op.t === 'texte' && [SECRET_NUM, SECRET_ACHAT, SECRET_PSEUDO].some((s) => op.texte.includes(s))) prive.push(cle);
    }
    const photosOps = plan.ops.filter((o) => o.t === 'photo');
    const dessines = Math.min(n, V.PAR_PAGE[format]);
    const parArt = new Set(photosOps.map((o) => o.a));
    if (parArt.size !== dessines || photosOps.some((o) => !arts[o.a] || !arts[o.a].lues.includes(o.p))) photoMauv.push(cle);
    const txt = plan.ops.filter((o) => o.t === 'texte').map((o) => o.texte);
    const nPrix = txt.filter((t) => /80 €/.test(t)).length;
    if (nPrix !== (dessines >= 2 ? dessines - 1 : 1)) prixKo.push(`${cle} prix=${nPrix}`);
    if (txt.includes('Boutique Inventée') !== !!boutique) boutKo.push(cle);
  }
  dit(!hors.length, 'R3 tout tient dans l’image, aucun NaN (3 modèles × 2 formats × 1–6 articles)', hors.slice(0, 8));
  dit(!photoMauv.length, 'R3 une photo LUE par article dessiné', photoMauv.slice(0, 8));
  dit(!prive.length, 'R1 le plan n’écrit ni N°, ni prix d’achat, ni pseudo', prive);
  dit(!prixKo.length, 'R4 le prix est écrit seulement quand il est su', prixKo.slice(0, 8));
  dit(!boutKo.length, 'R5 le nom de boutique est écrit seulement s’il est posé', boutKo.slice(0, 8));
  const sansLue = V.planVisuel({ format: 'carre', modele: 'epure', articles: [{ ...art(1), lues: [] }, art(2)], lot: true, textes });
  dit(sansLue.ops.filter((o) => o.t === 'photo').length === 1 && sansLue.ops.filter((o) => o.t === 'photo')[0].a === 0, 'R3 un article sans photo lue sort du plan', sansLue.ops.filter((o) => o.t === 'photo'));
  const rien = V.planVisuel({ format: 'story', modele: 'carte', articles: [{ ...art(1), lues: [] }], textes });
  dit(rien.vide === true && !rien.ops.length, 'R3 aucune photo lue ⇒ plan vide (jamais une image vide)', rien);
  dit(V.reglagesValides({}).boutique === '' && V.reglagesValides({ accent: 'violet' }).accent === 'bleu', 'R5 boutique vide par défaut ; une couleur inconnue (violet) retombe au bleu');

  console.log('── R6 pages');
  const neuf = Array.from({ length: 9 }, (_, i) => i);
  dit(JSON.stringify(V.pagesLot(neuf, 'carre').map((p) => p.length)) === '[4,4,1]' && JSON.stringify(V.pagesLot(neuf, 'story').map((p) => p.length)) === '[6,3]', 'R6 4 par carré, 6 par story');
  dit(V.pagesLot(Array.from({ length: 40 }, (_, i) => i), 'carre').flat().length === V.LOT_MAX, 'R6 24 annonces au plus');

  console.log('── R7 dessin');
  const faux = () => { const appels = []; const c = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...x) => { appels.push(k); return { addColorStop() {} }; }), set: (t, k, v) => { t[k] = v; return true; } }); c.measureText = (s) => ({ width: String(s).length * 10 }); return { c, appels }; };
  const plan1 = V.planVisuel({ format: 'carre', modele: 'plein', articles: [art(1)], textes });
  const f1 = faux(); const img = { naturalWidth: 800, naturalHeight: 1000 };
  dit(V.dessinerVisuel(f1.c, plan1, () => img) === true && f1.appels.includes('drawImage'), 'R7 photos lues ⇒ dessin complet');
  const f2 = faux();
  dit(V.dessinerVisuel(f2.c, plan1, () => null) === false, 'R7 une photo manquante ⇒ dessin refusé (jamais une image trouée)');
  const cv = V.couvrir(800, 1000, 1080, 1080);
  dit(cv && Math.abs(cv.sw - 800) < 0.01 && Math.abs(cv.sh - 800) < 0.01 && Math.abs(cv.sy - 100) < 0.01, 'R7 découpe « cover » centrée', cv);

  console.log('── R8 câblage');
  const app = lire('src/App.jsx').replace(/\/\/[^\n]*/g, '');
  const fn = (app.match(/async function lirePhotoVisuel\([\s\S]*?\n\}/) || [''])[0];
  const iV = fn.indexOf('estPhotoVinted'), iS = fn.indexOf('photoViaServeur'), iF = fn.indexOf("mode: 'cors'");
  dit(fn && iV > 0 && iS > iV && iF > iS && /blobDe\(u\)/.test(fn) && /vmrPhotoIssue\(u/.test(fn), 'R8 photo Vinted : route photo de VRM, puis copie de l’extension, puis l’extension ; une autre : CORS', fn.slice(0, 300));
  dit(!/return u;\s*\n\s*}\s*\n\s*if \(!\/\^https/.test(fn) && !/estPhotoVinted\(u\)\)\s*return u/.test(fn), 'R8 une photo Vinted n’est jamais rendue telle quelle au canvas');
  const comp = lire('src/composants/VisuelsReseaux.jsx').replace(/\/\/[^\n]*/g, '');
  const charges = [...comp.matchAll(/chargerImage\(([^)]*)\)/g)].map((m) => m[1].trim()).filter((x) => x !== 'src');
  dit(!charges.length && /src = await lirePhoto\(u\)/.test(comp), 'R8 le composant ne charge QUE ce que `lirePhoto` rend', charges);
  dit(/const SYNC_KEYS = \[[\s\S]{0,400}'vrm_visuels_reglages'/.test(app), 'R8 le réglage (boutique, modèle, couleur) est dans SYNC_KEYS');
  dit(/data-fiche-visuels=[\s\S]{0,200}'vrm:visuels'/.test(app) && /k==='visuels'[\s\S]{0,400}'vrm:visuels'[\s\S]{0,80}lot:true/.test(app) && /addEventListener\('vrm:visuels'/.test(app) && /<VisuelsReseaux /.test(app), 'R8 les deux entrées (fiche « … », Actions) ouvrent la feuille');
  const aa = lire('src/annoncesActions.js');
  dit(/k: 'visuels'[^\n]*robot: false[^\n]*multiComptes: true/.test(aa), 'R8 « Nouveautés de la semaine » ne part pas chez Vinted (ni robot, ni compte du navigateur)');
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  return ko;
}

const MUTATIONS = [
  ['autre devise convertie', 'src/visuelsReseaux.js', "  if (d !== 'EUR') return null;\n", ''],
  ['article sans photo lue gardé', 'src/visuelsReseaux.js', ".filter((a) => a && Array.isArray(a.lues) && a.lues.length);", ".filter((a) => a).map((a) => ({ ...a, lues: a.lues && a.lues.length ? a.lues : [0] }));"],
  ['tout recopié dans l’article', 'src/visuelsReseaux.js', "  return {\n    cle:", "  return { ...a,\n    cle:"],
  ['dessin troué accepté', 'src/visuelsReseaux.js', "if (!c) { complet = false; continue; }", "if (!c) { continue; }"],
  ['photo Vinted rendue telle quelle', 'src/App.jsx', "  if (photosVinted.estPhotoVinted(u)) {\n    const d = await photoViaServeur(u);", "  if (photosVinted.estPhotoVinted(u)) return u;\n  if (photosVinted.estPhotoVinted(u)) {\n    const d = await photoViaServeur(u);"],
  ['boutique ignorée', 'src/visuelsReseaux.js', "const boutique = propre(o.boutique, BOUTIQUE_MAX);", "const boutique = '';"],
];

if (process.argv.includes('--prouve')) {
  const base = path.join(__dirname, '..');
  let rouges = 0;
  for (const [nom, fichier, de, vers] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vis-mut-'));
    for (const f of ['src/visuelsReseaux.js', 'src/App.jsx', 'src/annoncesActions.js', 'src/composants/VisuelsReseaux.jsx']) {
      fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
      let s = fs.readFileSync(path.join(base, f), 'utf8');
      if (f === fichier) { if (!s.includes(de)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); process.exitCode = 1; } s = s.replace(de, vers); }
      fs.writeFileSync(path.join(tmp, f), s);
    }
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(tmp, 'src', 'package.json'), '{"type":"module"}');
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, VIS_RACINE: tmp }, encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'VERT (le contrôle ne la voit pas)'}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${rouges}/${MUTATIONS.length} mutations rouges`);
  process.exit(rouges === MUTATIONS.length && !process.exitCode ? 0 : 1);
} else {
  principal().then((k) => process.exit(k ? 1 : 0), (e) => { console.error(e); process.exit(1); });
}
