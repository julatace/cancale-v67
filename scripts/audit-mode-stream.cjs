#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « MODE STREAM PROGRAMMÉ » (5 nov.) — EXÉCUTE la règle src/modeStream.js
//  et vérifie son branchement dans l'app :
//   1. le programme : tout caché par défaut ; seul un `false` EXPLICITE montre une
//      catégorie (« pas su » ne vaut pas « montre ») ; les mots sont nettoyés ;
//   2. la règle sur le texte : montants, marques (mot entier), « les mots qui
//      commencent par… », pseudos de ses comptes et des acheteurs (jetons),
//      adresses, e-mails, téléphones, IBAN, SIRET ; les N° restent ; une case
//      décochée montre sa catégorie et seulement elle ;
//   3. « toutes les annonces qui contiennent… » cache la LIGNE ;
//   4. un montant coupé en deux nœuds est caché ;
//   5. l'app : le bouton « Stream » remplace l'œil des montants et la pastille
//      rouge (§7), il est RENDU dans l'en-tête ; le programme est synchronisé
//      (SYNC_KEYS), l'interrupteur propre à l'appareil ; la notification système
//      passe par la règle ; l'ancien flou (streamFlou.js) n'existe plus ; le CSS
//      floute lignes, bordereaux et QR.
//  `--prouve` : rejoue l'audit sur des copies MUTÉES de la règle (chaque mutation
//  réaffaiblit une règle) et exige qu'il passe au ROUGE.
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

async function audit(fichiers, bavard) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (bavard) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 240) : ''}`); };
  let S = null;
  try { S = await import(pathToFileURL(fichiers.regle).href + '?t=' + Date.now() + Math.random()); } catch (e) { dit(false, 'module modeStream', e.message); return ko; }

  // ── 1. Le programme ───────────────────────────────────────────────────────
  const d = S.normaliserRegles(null);
  dit(S.CATEGORIES.every(([k]) => d[k] === true), '1.1 rien de lu ⇒ TOUT caché', JSON.stringify(d));
  const p = S.normaliserRegles({ montants: false, comptes: 'non', acheteurs: 0, marques: [' Nike ', 'nike', 'x', 'A'.repeat(50), 'New  Balance'] });
  dit(p.montants === false && p.comptes === true && p.acheteurs === true, '1.2 seul un `false` explicite montre une catégorie', JSON.stringify(p));
  dit(JSON.stringify(p.marques) === '["Nike","New Balance"]', '1.3 mots nettoyés (espaces, doublons, trop courts, trop longs)', JSON.stringify(p.marques));
  dit(Array.isArray(S.normaliserRegles({ prefixes: 'Sal' }).prefixes) && S.normaliserRegles({ prefixes: 'Sal' }).prefixes.length === 0, '1.4 une liste abîmée ne casse rien');

  // ── 2. La règle sur le texte ──────────────────────────────────────────────
  const PROG = { marques: ['Nike', 'New Balance'], prefixes: ['Sal'], contient: ['Asics'] };
  const JET = { comptes: ['vendeuse_a', 'Ma boutique'], acheteurs_vinted: ['marc.b'] };
  const Rg = S.compilerRegle(PROG, JET);
  const cas = [
    ['Nike Air Max 90 · 89,00 €', '••• Air Max 90 · •••'],
    ['Nikeland reste', 'Nikeland reste'],
    ['NIKE dunk', '••• dunk'],
    ['New Balance 550', '••• 550'],
    ['Salomon XT-6', '••• XT-6'],
    ['Vendu sur vendeuse_a à marc.b', 'Vendu sur ••• à •••'],
    ['Ma boutique · Leboncoin', '••• · Leboncoin'],
    ['8 Rue de la Paix, 35000 Rennes', '•••, •••'],
    ['a.b@exemple.fr · 06 12 34 56 78', '••• · •••'],
    ['FR76 3000 6000 0112 3456 7890 189', '•••'],
    ['SIRET 123 456 789 00012', 'SIRET •••'],
    ['N°12 · N°B125 · 3 paires', 'N°12 · N°B125 · 3 paires'],
    ['Le 05/11/2026 à 10 h 00', 'Le 05/11/2026 à 10 h 00'],
  ];
  for (const [a, b] of cas) dit(S.masquerTexteStream(a, Rg) === b, `2. « ${a} » ⇒ « ${b} »`, S.masquerTexteStream(a, Rg));
  const sansMontants = S.compilerRegle({ ...PROG, montants: false }, JET);
  dit(S.masquerTexteStream('Nike · 89,00 €', sansMontants) === '••• · 89,00 €', '2.a case « montants » décochée : le prix se montre, la marque reste cachée', S.masquerTexteStream('Nike · 89,00 €', sansMontants));
  const sansAcheteurs = S.compilerRegle({ ...PROG, acheteurs: false }, JET);
  dit(S.masquerTexteStream('vendeuse_a à marc.b', sansAcheteurs) === '••• à marc.b', '2.b case « pseudos » décochée : l\'acheteur se montre, SON compte reste caché', S.masquerTexteStream('vendeuse_a à marc.b', sansAcheteurs));
  const sansComptes = S.compilerRegle({ ...PROG, comptes: false }, JET);
  dit(S.masquerTexteStream('vendeuse_a', sansComptes) === 'vendeuse_a', '2.c case « comptes » décochée : son compte se montre');
  const sansAdr = S.compilerRegle({ ...PROG, adresses: false, numeros: false }, JET);
  dit(S.masquerTexteStream('35000 Rennes · FR76 3000 6000 0112 3456 7890 189', sansAdr) === '35000 Rennes · FR76 3000 6000 0112 3456 7890 189', '2.d adresses et numéros décochés : montrés');

  // ── 3. Les lignes entières ────────────────────────────────────────────────
  dit(S.ligneACacher('Asics Gel-1130 argent', Rg) && S.ligneACacher('ma paire asics', Rg) && S.ligneACacher('Asics-Kayano', Rg), '3.1 « contient Asics » cache la ligne (majuscules ignorées)');
  dit(!S.ligneACacher('Nike Air Max', Rg) && !S.ligneACacher('Basics', Rg), '3.2 une autre ligne n\'est pas cachée (« Basics » ne contient pas le mot « Asics »)');
  dit(S.masquerTexteStream('Asics Gel', Rg) === '••• Gel', '3.3 le mot lui-même est aussi caché', S.masquerTexteStream('Asics Gel', Rg));
  dit(S.toutMasquer('  K48291 ') === '  ••• ' && S.toutMasquer('   ') === '   ', '3.4 un élément caché en bloc garde ses espaces');

  // ── 4. Un montant coupé en deux nœuds ─────────────────────────────────────
  const su = S.masquerSuiteStream(['Bénéfice ', '45', ' €', ' · Nike'], [true, true, true], Rg);
  dit(su.join('') === 'Bénéfice ••• · •••', '4.1 « 45 » puis « € » : caché comme un seul montant', JSON.stringify(su));

  // ── 5. Le branchement dans l'app ──────────────────────────────────────────
  const app = fs.readFileSync(fichiers.app, 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
  const html = fs.readFileSync(fichiers.html, 'utf8');
  dit(!/data-bouton-montants|function BoutonMontants|<BoutonMontants/.test(app), '5.1 l\'œil « cacher les montants » est retiré');
  dit(!/data-stream-pastille|function PastilleStream/.test(app), '5.2 la pastille ROUGE du stream est retirée (rouge = doublon de N° seulement)');
  dit((app.match(/<BoutonStream\/>/g) || []).length === 1 && /data-bouton-stream=""/.test(app), '5.3 le bouton « Stream » est RENDU, une fois, dans l\'en-tête');
  const sync = (/const SYNC_KEYS = \[([\s\S]*?)\];/.exec(app) || ['', ''])[1];
  dit(/'vrm_stream_regles'/.test(sync) && !/'vrm_stream'/.test(sync), '5.4 programme synchronisé, interrupteur propre à l\'appareil', '');
  dit(/new Notification\(textePourStream\(title\), \{ body: textePourStream\(body\)/.test(app), '5.5 la notification affichée passe par la même règle');
  dit(!fs.existsSync(path.join(R, 'src/streamFlou.js')) && !/streamFlou/.test(app), '5.6 l\'ancien flou (streamFlou.js) n\'existe plus : une seule règle');
  dit(/\[data-stream="1"\] \[data-stream-ligne\]/.test(html) && /data-stream-image="bordereau"/.test(html) && /data-stream-image="code"/.test(html), '5.7 le CSS floute lignes, bordereaux et QR');
  dit(/\{ id:'stream', type:'panneau'[^\n]*<ReglagesStream\/>/.test(app), '5.8 Réglages → Mode stream ouvre le programme');
  dit(/useReglesStream\(\);/.test(app), '5.9 le programme est suivi au niveau de l\'app (nuage relu ⇒ règle changée)');
  return ko;
}

const MUTATIONS = [
  ['regle', "for (const [k] of CATEGORIES) out[k] = s[k] !== false;", "for (const [k] of CATEGORIES) out[k] = s[k] === true;", 'pas su = montré'],
  ['regle', "if (R.reJetons) t = t.replace(R.reJetons, MASQUE);", '', 'pseudos de ses comptes ignorés'],
  ['regle', "return masquerAutres(R.montants ? masquerTexte(s) : s, R);", "return masquerAutres(s, R);", 'montants jamais cachés'],
  ['regle', "(?:${tri(r.marques).map(motif).join('|') || '(?!)'})(?![${L}])", "(?:${tri(r.marques).map(motif).join('|') || '(?!)'})[${L}]*", 'marque : plus le mot entier'],
  ['regle', "if (R.rePrefixes) t = t.replace(R.rePrefixes, (m, a) => a + MASQUE);", '', 'préfixes ignorés'],
  ['regle', "return !!(R && R.reLigne && texte && R.reLigne.test(String(texte)));", "return false;", 'lignes entières jamais cachées'],
  ['regle', "const cat = /^acheteurs/.test(nom) ? 'acheteurs' : 'comptes';", "const cat = 'comptes';", 'case pseudos sans effet'],
  ['regle', "if (r.adresses) motifs.push(EMAIL, TEL, RUE, CP_VILLE);", "if (r.adresses) motifs.push(EMAIL, TEL);", 'adresses postales montrées'],
  ['regle', "if (r.numeros) motifs.push(IBAN, CARTE, SIRET);", "", 'IBAN montré'],
  ['regle', "const m = R.montants ? masquerSuite(t, voisins) : t;", "const m = t.map((x) => R.montants ? masquerTexte(x) : x);", 'montant coupé en deux nœuds'],
  ['regle', "return /\\S/.test(s) ? s.replace(/\\S[\\s\\S]*\\S|\\S/, MASQUE) : s;", "return s;", 'bloc sensible montré'],
];

(async () => {
  if (!process.argv.includes('--prouve')) {
    const ko = await audit(F, true);
    console.log(ko ? `\n${ko} KO` : '\n✅ audit-mode-stream : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  if (await audit(F, false)) { console.log('KO  l\'audit doit être vert avant les mutations'); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-stream-'));
  fs.copyFileSync(F.montants, path.join(tmp, 'montantsCaches.js'));
  let rates = 0;
  for (const [cle, de, vers, nom] of MUTATIONS) {
    const src = fs.readFileSync(F[cle], 'utf8');
    if (!src.includes(de)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); rates++; continue; }
    const f = path.join(tmp, 'modeStream-' + Math.random().toString(36).slice(2) + '.js');
    fs.writeFileSync(f, src.replace(de, vers));
    const ko = await audit({ ...F, [cle]: f }, false);
    console.log(`${ko ? 'OK  ' : 'KO  '}mutation « ${nom} » ⇒ ${ko ? ko + ' rouge(s)' : 'RESTE VERT'}`);
    if (!ko) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non vue(s)` : `\n✅ les ${MUTATIONS.length} mutations passent au rouge`);
  process.exit(rates ? 1 : 0);
})();
