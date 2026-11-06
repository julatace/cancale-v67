#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « STREAM : BOUTON AU CHOIX ET PHOTOS FLOUTÉES » (6 nov.) — EXÉCUTE la
//  règle src/modeStream.js et vérifie son branchement.
//  Julien (6 nov., mot pour mot) : « pour le bouton stream tu peux faire une
//  option qui n'apparaît que si on le sélectionne dans les paramètres ; je veux
//  que on puisse aussi flouter les photos en lien avec ce que on veut cacher ».
//   1. le programme : `bouton` éteint par défaut (seul un `true` le montre),
//      `photos` allumé par défaut (seul un `false` l'éteint), `photosToutes`
//      éteint par défaut ;
//   2. `photoACacherSelon(article, R)` — LA MÊME règle compilée que le texte :
//      marque cachée ⇒ floue ; autre marque ⇒ nette ; « commence par… » et
//      « annonce entière qui contient… » ⇒ floue ; mot entier pour une marque
//      (« Nikeland » nette) ; « Flouter toutes les photos » ⇒ floue ; « Flouter
//      aussi les photos » éteint ⇒ nette ; une fiche (objet) se lit par ses
//      textes, jamais par l'adresse de sa photo ;
//   3. `photoACacher(article)` : stream ÉTEINT ⇒ nette ; l'œil des montants seul ⇒
//      nette (et le texte : seuls les montants) ; stream allumé ⇒ la règle ;
//   4. l'app : le bouton « Stream » n'est rendu que s'il est choisi (ou tant que
//      le mode est allumé), l'œil des montants revient sans lui ; les réglages
//      (bouton, photos, toutes) et l'aperçu passent par `photoACacherSelon` ;
//      aucune autre règle de photo dans l'app ; le CSS floute `data-stream-photo` ;
//      la visionneuse « Agrandir » dit son article (`data-stream-article`) ; la
//      couche de la page pose `data-stream-photo`, masque `alt`, ignore QR et logos.
//  `--prouve` : rejoue l'audit sur des copies MUTÉES et exige le ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F = {
  regle: path.join(R, 'src/modeStream.js'),
  montants: path.join(R, 'src/montantsCaches.js'),
  app: path.join(R, 'src/App.jsx'),
  html: path.join(R, 'index.html'),
};
const sansCommentaires = (s) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

async function audit(fichiers, bavard) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (bavard) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 240) : ''}`); };
  let S = null;
  try { S = await import(pathToFileURL(fichiers.regle).href + '?t=' + Date.now() + Math.random()); } catch (e) { dit(false, 'module modeStream', e.message); return ko; }
  if (typeof S.photoACacherSelon !== 'function' || typeof S.photoACacher !== 'function') { dit(false, '0. modeStream exporte photoACacherSelon et photoACacher'); return ko + 1; }

  // ── 1. Le programme ───────────────────────────────────────────────────────
  const d = S.normaliserRegles(null);
  dit(d.bouton === false && d.photos === true && d.photosToutes === false, '1.1 rien de lu ⇒ bouton caché, photos concernées floutées, pas toutes', JSON.stringify(d));
  const p = S.normaliserRegles({ bouton: 'oui', photos: 0, photosToutes: 1 });
  dit(p.bouton === false && p.photos === true && p.photosToutes === false, '1.2 seul `true` montre le bouton / floute tout ; seul `false` éteint les photos', JSON.stringify(p));
  const q = S.normaliserRegles({ bouton: true, photos: false, photosToutes: true });
  dit(q.bouton === true && q.photos === false && q.photosToutes === true, '1.3 les choix explicites sont gardés', JSON.stringify(q));

  // ── 2. La règle des photos ────────────────────────────────────────────────
  const PROG = { marques: ['Nike', 'New Balance'], prefixes: ['Sal'], contient: ['Asics'] };
  const JET = { comptes: ['vendeuse_a'], acheteurs_vinted: ['marc.b'] };
  const Rg = S.compilerRegle(PROG, JET);
  const cas = [
    ['Nike Air Max 90 · taille 42', true, 'marque cachée ⇒ floue'],
    ['nike dunk', true, 'majuscules ignorées'],
    ['Adidas Samba OG', false, 'autre marque ⇒ nette'],
    ['Nikeland édition', false, 'marque : mot entier (« Nikeland » nette)'],
    ['New  Balance 550', true, 'marque en deux mots, espaces quelconques'],
    ['Salomon XT-6', true, '« commence par Sal » ⇒ floue'],
    ['ma paire Asics-Kayano', true, '« annonce entière qui contient Asics » ⇒ floue'],
    ['Basics blanche', false, '« Basics » ne contient pas le MOT « Asics »'],
    ['Vendue sur vendeuse_a à marc.b', false, 'un nom de compte ou un pseudo seul ne floute pas la photo (décision : la catégorie « comptes » est cochée par défaut, toutes les photos le seraient)'],
    ['', false, 'article vide ⇒ nette'],
  ];
  for (const [a, attendu, quoi] of cas) dit(S.photoACacherSelon(a, Rg) === attendu, `2. « ${a} » ⇒ ${attendu ? 'floue' : 'nette'} (${quoi})`, S.photoACacherSelon(a, Rg));
  dit(S.photoACacherSelon({ title: 'Air Max 90', brand_title: 'Nike', photo: { url: 'https://x/a.jpg' } }, Rg) === true, '2.a une fiche (objet) se lit par ses textes (marque Nike) ⇒ floue');
  dit(S.photoACacherSelon({ title: 'Samba', brand_title: 'Adidas', photo: { url: 'https://cdn.exemple/nike-air.jpg' } }, Rg) === false, '2.b l\'adresse de la photo n\'est pas l\'article (« nike-air.jpg » ⇒ nette)');
  const Rt = S.compilerRegle({ photosToutes: true }, {});
  dit(S.photoACacherSelon('Adidas Samba', Rt) === true && S.photoACacherSelon('', Rt) === true, '2.c « Flouter toutes les photos » ⇒ floue, même sans mot');
  const Rsans = S.compilerRegle({ ...PROG, photos: false }, JET);
  dit(S.photoACacherSelon('Nike Air Max', Rsans) === false, '2.d « Flouter aussi les photos » éteint ⇒ nette (le texte reste caché)');
  dit(S.masquerTexteStream('Nike Air Max', Rsans) === '••• Air Max', '2.e photos éteintes : le TEXTE suit toujours la règle', S.masquerTexteStream('Nike Air Max', Rsans));
  // Même source : un mot ajouté au programme change le texte ET la photo, sans rien d'autre.
  const Rx = S.compilerRegle({ marques: ['Puma'] }, {});
  dit(S.masquerTexteStream('Puma Suede', Rx) === '••• Suede' && S.photoACacherSelon('Puma Suede', Rx) === true && S.photoACacherSelon('Nike', Rx) === false, '2.f même source : le mot qui cache le texte floute la photo, et lui seul');

  // ── 3. L'état du module (stream éteint, œil des montants) ─────────────────
  S.poserReglesStream({ ...PROG });
  S.demarrerMontants(false); S.demarrerStream(false);
  dit(S.photoACacher('Nike Air Max') === false, '3.1 stream ÉTEINT ⇒ nette');
  dit(S.textePourStream('Nike · 89,00 €') === 'Nike · 89,00 €', '3.2 stream éteint ⇒ texte en clair', S.textePourStream('Nike · 89,00 €'));
  S.demarrerMontants(true);
  dit(S.photoACacher('Nike Air Max') === false, '3.3 l\'œil des montants seul ⇒ photos nettes');
  dit(S.textePourStream('Nike · 89,00 € · vendeuse_a') === 'Nike · ••• · vendeuse_a', '3.4 l\'œil des montants ne cache QUE les montants', S.textePourStream('Nike · 89,00 € · vendeuse_a'));
  S.demarrerMontants(false); S.demarrerStream(true);
  dit(S.photoACacher('Nike Air Max') === true && S.photoACacher('Adidas Samba') === false, '3.5 stream allumé ⇒ marque cachée floue, autre nette');
  S.poserReglesStream({ ...PROG, photosToutes: true });
  dit(S.photoACacher('Adidas Samba') === true, '3.6 stream allumé, « toutes » ⇒ floue');
  S.demarrerStream(false);
  dit(S.photoACacher('Adidas Samba') === false, '3.7 éteint de nouveau ⇒ nette');

  // ── 4. Le branchement ─────────────────────────────────────────────────────
  const appBrut = fs.readFileSync(fichiers.app, 'utf8');
  const app = sansCommentaires(appBrut);
  const html = fs.readFileSync(fichiers.html, 'utf8');
  const regle = sansCommentaires(fs.readFileSync(fichiers.regle, 'utf8'));
  dit(/\(reglesStream\.bouton \|\| streamOn\) \? <BoutonStream\/> : null/.test(app), '4.1 le bouton « Stream » n\'est rendu que s\'il est choisi, ou tant que le mode est allumé');
  dit(/\(!reglesStream\.bouton \|\| montantsCaches\) \? <BoutonMontants\/> : null/.test(app) && /function BoutonMontants\(\)[\s\S]{0,600}data-bouton-montants=""[\s\S]{0,300}poserMontants\(!cache\)/.test(app), '4.2 sans le bouton « Stream », l\'œil des montants revient (rien de perdu)');
  dit(/const reglesStream = useReglesStream\(\);/.test(app), '4.3 l\'en-tête lit le programme SYNCHRONISÉ (pas un drapeau de l\'appareil)');
  dit(/data-stream-option="bouton"[\s\S]{0,900}changer\(\{ bouton: !regles\.bouton \}\)/.test(app), '4.4 Réglages → Mode stream : « Afficher le bouton Stream »');
  dit(/data-stream-option="photos"[\s\S]{0,500}changer\(\{ photos: !regles\.photos \}\)/.test(app) && /data-stream-option="photosToutes"[\s\S]{0,500}changer\(\{ photosToutes: !regles\.photosToutes \}\)/.test(app), '4.5 Réglages : « Flouter aussi les photos » et « Flouter toutes les photos »');
  dit(/const floue = photoACacherSelon\(t, Rp\);/.test(app) && /data-apercu-photo=\{floue \? 'floue' : 'nette'\}/.test(app), '4.6 l\'aperçu des photos passe par la MÊME règle');
  const autres = (app.match(/\brePhoto\b|\bphotoACacher\b/g) || []);
  dit(autres.length === 0, '4.7 aucune autre règle de photo dans l\'app (la décision vient de src/modeStream.js)', JSON.stringify(autres));
  dit(/\[data-stream="1"\] \[data-stream-photo\],\s*\[data-apercu-photo="floue"\] img \{ filter: blur\((\d+)px\)/.test(html) && Number((/\[data-stream-photo\],\s*\[data-apercu-photo="floue"\] img \{ filter: blur\((\d+)px\)/.exec(html) || [])[1]) >= 16, '4.8 le CSS floute FORT les photos (et l\'aperçu montre le même flou)');
  dit(/className="vrm-photo-panel" data-stream-article=\{titre \|\| ''\}/.test(app), '4.9 la visionneuse « Agrandir » dit son article');
  dit(/if \(R\.photosToutes \|\| photoACacherSelon\(articleDe\(el, racine, texteDe, altDe\), R\)\) aFlouter\.add\(el\);/.test(regle), '4.10 la couche de la page décide par photoACacherSelon (même règle)');
  dit(/const ATTRS = \[[^\]]*'alt'/.test(regle) && /\(a === 'alt' && photos\.has\(el\)\) \? toutMasquer\(o\)/.test(regle), '4.11 le texte alternatif d\'une photo floutée ne dit rien');
  dit(/el\.closest\('\[data-stream-libre\], \[data-stream-image\], \[data-mfa-qr\]'\)/.test(regle) && /if \(\/\^QR\\b\/\.test\(alt\)\) return false;/.test(regle), '4.12 QR, bordereaux et logos ne sont pas des photos d\'article (leurs flous restent les leurs)');
  dit(/if \(R && R\.seulMontants\) return false;/.test(regle), '4.13 l\'œil ne cache aucun bloc (codes, pseudos) : seulement les montants');
  dit(/<img\b/.test(appBrut) && !/backgroundImage\s*:\s*`url\(/.test(app), '4.14 aucune photo posée en image de fond (que la règle ne verrait pas)');
  return ko;
}

const MUTATIONS = [
  ['regle', "out.bouton = s.bouton === true;", "out.bouton = s.bouton !== false;", 'bouton affiché par défaut'],
  ['regle', "out.photos = s.photos !== false;", "out.photos = s.photos === true;", 'photos éteintes par défaut'],
  ['regle', "if (R.photosToutes) return true;\n  if (!R.photos || !R.rePhoto) return false;", "if (!R.photos || !R.rePhoto) return false;", '« toutes » sans effet'],
  ['regle', "if (!R.photos || !R.rePhoto) return false;", "if (!R.rePhoto) return false;", '« Flouter aussi les photos » sans effet'],
  ['regle', "...(r.marques.length ? [`(?:${tri(r.marques).map(motif).join('|')})(?![${L}])`] : []),", "...(r.marques.length ? [`(?:${tri(r.marques).map(motif).join('|')})`] : []),", 'marque : plus le mot entier'],
  ['regle', "...(r.prefixes.length ? [`(?:${tri(r.prefixes).map(motif).join('|')})`] : []),", "", '« commence par » ignoré'],
  ['regle', "return _actif ? photoACacherSelon(article, regleCourante()) : false;", "return photoACacherSelon(article, regleCourante());", 'stream éteint : photos floutées'],
  ['regle', "if (typeof article === 'string') return /^(https?:|blob:|data:)/i.test(article.trim()) ? '' : article;", "if (typeof article === 'string') return article;", 'l\'adresse de la photo lue comme article'],
  ['regle', "if (R && R.seulMontants) return false;", "", 'l\'œil cache des blocs'],
  ['regle', "export function regleEffective() { return _actif ? regleCourante() : _montantsSeuls ? R_MONTANTS : null; }", "export function regleEffective() { return _actif || _montantsSeuls ? regleCourante() : null; }", 'l\'œil applique tout le programme'],
  ['regle', "const ATTRS = ['title', 'placeholder', 'alt', 'aria-label'];", "const ATTRS = ['title', 'placeholder'];", 'alt en clair'],
  ['app', "{(reglesStream.bouton || streamOn) ? <BoutonStream/> : null}", "<BoutonStream/>", 'bouton toujours affiché'],
  ['app', "{(!reglesStream.bouton || montantsCaches) ? <BoutonMontants/> : null}", "", 'œil perdu'],
  ['app', "const floue = photoACacherSelon(t, Rp);", "const floue = /Nike/i.test(t);", 'aperçu : une seconde règle'],
  ['html', "[data-stream=\"1\"] [data-stream-photo],", "[data-stream=\"1\"] [data-stream-photo-x],", 'CSS des photos absent'],
];

(async () => {
  if (!process.argv.includes('--prouve')) {
    const ko = await audit(F, true);
    console.log(ko ? `\n${ko} KO` : '\n✅ audit-stream-photos : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  if (await audit(F, false)) { console.log('KO  l\'audit doit être vert avant les mutations'); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-stream-photos-'));
  fs.copyFileSync(F.montants, path.join(tmp, 'montantsCaches.js'));
  let rates = 0;
  for (const [cle, de, vers, nom] of MUTATIONS) {
    const src = fs.readFileSync(F[cle], 'utf8');
    if (!src.includes(de)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); rates++; continue; }
    const ext = { regle: '.js', app: '.jsx', html: '.html' }[cle];
    const f = path.join(tmp, cle + '-' + Math.random().toString(36).slice(2) + ext);
    fs.writeFileSync(f, src.replace(de, vers));
    const ko = await audit({ ...F, [cle]: f }, false);
    console.log(`${ko ? 'OK  ' : 'KO  '}mutation « ${nom} » ⇒ ${ko ? ko + ' rouge(s)' : 'RESTE VERT'}`);
    if (!ko) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non vue(s)` : `\n✅ les ${MUTATIONS.length} mutations passent au rouge`);
  process.exit(rates ? 1 : 0);
})();
