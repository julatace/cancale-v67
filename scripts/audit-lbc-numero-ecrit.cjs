#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : LEBONCOIN, LE N° ÉCRIT À LA FIN DE LA DESCRIPTION RELIE L'ANNONCE (24 nov., lot lbc-numero-ecrit)
//
//  Julien : « Oui, relie par le N° ». « Même avec 50 articles identiques, tu ne dois pas pouvoir te tromper » (§2.4).
//  Exécute LA règle (src/lbcNumeroEcrit.js), LA lecture de l'app (`lectureFinLbc`, extraite d'App.jsx) et LA
//  lecture d'un texte (src/numeroEcrit.js) — aucune donnée réelle, aucun réseau.
//
//   N   50 annonces Leboncoin IDENTIQUES (même titre, même photo, même prix, même début de description) face à
//       50 paires identiques : SEUL le N° écrit à la fin décide — 50 liens, chacun le sien ; sans N° écrit : 0 ;
//   R   le N° dans le titre seul ne relie pas · lecture partielle ⇒ rien (« partielle ») · deux numéros ⇒ rien ·
//       deux paires ⇒ rien · N° inconnu ⇒ rien · autre vendeur ⇒ rien · deux annonces au même N° ⇒ aucune ·
//       la remise à zéro (avant la coupure : « 3 » = B3) · pas su (paires pas lues) ⇒ rien ;
//   M   SA main gagne : un lien posé, un lien défait (vide), « Délier » (= pas la même paire, retenu dans le
//       journal, relu à l'instant par `liensLbcAvecNumeroEcrit`) ; un AUTRE N° écrit ensuite se relit ;
//   A   « Relier mes annonces » : l'annonce reliée porte la preuve « N° écrit » en tête ; « à relier » porte la
//       raison ; `delier` (src/liaisonActions.js, EXÉCUTÉ) note le journal, n'écrit aucun lien ;
//   B   le branchement : tout lecteur d'identité Leboncoin lit `liensLbcLus()` (jamais réécrit) ; la numérotation
//       ne donne pas de N° neuf à une annonce au N° écrit non relié ; l'écran dit la raison ; 5 langues.
//
//  Preuve par mutation : `--mutations` rejoue l'audit sur 4 règles affaiblies (relier par le titre, ignorer
//  « Délier », accepter une lecture partielle, ignorer un lien posé) — chacune DOIT le rendre rouge.
//  `--racine=<arbre>` : un autre arbre (git archive d'avant : rouge).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const RACINE = path.resolve(arg('racine') || path.join(__dirname, '..'));
const MUTATION = arg('mutation') || '';

const MUTATIONS = {
  // relier par le titre : la lecture de l'app lit aussi le titre comme une source de N°
  titre: { fichier: 'app', de: "ou: ['description'] });", vers: "titre: ad.subject || '', ou: ['description', 'titre'] });" },
  // « Délier » ignoré : la règle ne relit plus le journal
  delier: { fichier: 'regle', de: 'if (non && cle(non.numero) === k)', vers: 'if (false)' },
  // lecture partielle acceptée : une description coupée est lue comme entière
  partielle: { fichier: 'app', de: 'descriptionCoupee: !!body && body.length >= 400', vers: 'descriptionCoupee: false' },
  // un lien posé à la main ignoré
  main: { fichier: 'regle', de: 'if (a(P, id)) continue;', vers: '' },
};

if (process.argv.includes('--mutations')) {
  let rouge = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${m}`, `--racine=${RACINE}`], { encoding: 'utf8' });
    const ko = r.status !== 0;
    console.log(`${ko ? '✅' : '❌'} mutation « ${m} » ⇒ ${ko ? 'ROUGE (attendu)' : 'VERT — l’audit ne la voit pas'}`);
    if (!ko) { rouge++; console.log(r.stdout.split('\n').slice(-6).join('\n')); }
  }
  process.exit(rouge ? 1 : 0);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };

(async () => {
  const src = (f) => path.join(RACINE, 'src', f);
  if (!fs.existsSync(src('lbcNumeroEcrit.js'))) { dit(false, 'src/lbcNumeroEcrit.js existe (la règle)', 'absent'); return fin(); }
  // Les modules, copiés dans un dossier temporaire (une mutation s'y applique, jamais dans l'arbre).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lbc-num-'));
  let regle = fs.readFileSync(src('lbcNumeroEcrit.js'), 'utf8');
  const M = MUTATIONS[MUTATION];
  if (MUTATION && !M) { console.log('mutation inconnue'); process.exit(2); }
  if (M && M.fichier === 'regle') { if (!regle.includes(M.de)) { console.log('mutation introuvable'); process.exit(3); } regle = regle.replace(M.de, M.vers); }
  fs.writeFileSync(path.join(tmp, 'lbcNumeroEcrit.js'), regle);
  fs.copyFileSync(src('numeroEcrit.js'), path.join(tmp, 'numeroEcrit.js'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const R = await import(pathToFileURL(path.join(tmp, 'lbcNumeroEcrit.js')).href);
  const NE = await import(pathToFileURL(path.join(tmp, 'numeroEcrit.js')).href);

  // LA lecture de l'app, extraite telle quelle d'App.jsx.
  const { sourceApp } = require(path.join(RACINE, 'scripts', '_source-app.cjs'));
  const APP = sourceApp(RACINE);
  const debut = APP.indexOf('function lectureFinLbc(ad) {');
  let corps = debut >= 0 ? APP.slice(debut, APP.indexOf('\n}\n', debut) + 2) : '';
  dit(!!corps, 'B0 · App.jsx : `lectureFinLbc` (la lecture de la fin de la description) existe');
  if (M && M.fichier === 'app') { if (!corps.includes(M.de)) { console.log('mutation introuvable'); process.exit(3); } corps = corps.replace(M.de, M.vers); }
  const lectureFinLbc = corps ? new Function('lireNumeroEcritRegle', corps + '\nreturn lectureFinLbc;')(NE.lireNumeroEcrit) : () => null;
  const cle = NE.cleNumero;
  const titreDe = (ad) => NE.lireNumeroTexte(ad.subject || ad.title || '', 'titre');

  // ── Le monde inventé : 50 paires identiques, 50 annonces identiques ─────────────────────────────
  const TITRE = 'adidas spezial noir taille 38';
  const DEBUT = 'Très bon état, portée deux fois. Envoi rapide en point relais.';
  const ad = (id, fin, o = {}) => ({ id, subject: TITRE, body: fin == null ? DEBUT : `${DEBUT}\n\n${fin}`, price: 60, images: ['https://img.leboncoin.fr/api/v1/lbcpb1/images/meme.jpg'], account: 'lbc-account:987', status: 'active', ...o });
  const SIENS = new Set(['987']);
  const sienne = (x) => SIENS.has(String(x.account || x.lbcUser || '').replace(/^lbc-account:/i, ''));
  const connus50 = new Set(Array.from({ length: 50 }, (_, i) => String(i + 1)));
  const calc = (annonces, o = {}) => R.identitesNumeroEcrit({ annonces, lecture: lectureFinLbc, titre: titreDe, sienne, traduire: o.traduire || ((k) => k), connus: o.connus === undefined ? connus50 : o.connus, douteux: o.douteux || new Set(), poses: o.poses || {}, journal: o.journal || {}, cle });

  // N — 50 identiques.
  {
    const A = {}; for (let i = 1; i <= 50; i++) A[String(5000 + i)] = ad(5000 + i, `N°${i}`);
    const I = calc(A);
    const justes = Object.entries(I.Leboncoin).filter(([id, n]) => n === String(Number(id) - 5000)).length;
    dit(I.lu && justes === 50 && Object.keys(I.Leboncoin).length === 50, 'N1 · 50 annonces identiques : chacune reliée à SON N° écrit (50/50, aucune autre)', JSON.stringify({ justes, n: Object.keys(I.Leboncoin).length }));
    const B = {}; for (let i = 1; i <= 50; i++) B[String(6000 + i)] = ad(6000 + i, null);
    const J = calc(B);
    dit(J.lu && Object.keys(J.Leboncoin).length === 0 && Object.keys(J.aRelier).length === 0, 'N2 · les mêmes 50 sans N° écrit : RIEN relié, rien deviné', JSON.stringify(J.Leboncoin));
    // Le titre de la paire 7 recopié mot pour mot dans le titre de l'annonce, sans N° écrit à la fin.
    const C = { 7001: ad(7001, null, { subject: TITRE + ' N°7' }) };
    const K = calc(C);
    dit(!K.Leboncoin['7001'], 'N3 · un N° dans le TITRE seul ne relie jamais', JSON.stringify(K));
  }
  // R — chaque refus.
  {
    const long = DEBUT + ' '.repeat(10) + 'x'.repeat(420);
    const I = calc({ 1: ad(1, null, { body: long + '\nN°3' }) });
    dit(!I.Leboncoin['1'] && (I.aRelier['1'] || {}).raison === 'partielle', 'R1 · description lue en partie (≥ 400 car., pas de lecture entière) : rien, « partielle »', JSON.stringify(I));
    const Iok = calc({ 1: ad(1, null, { body: long + '\nN°3', numEcrit: { etat: 'lu', cle: '3', brut: 'N°3' } }) });
    dit(Iok.Leboncoin['1'] === '3', 'R1b · la même, lue EN ENTIER par l’extension (`numEcrit`) : reliée à N°3', JSON.stringify(Iok));
    const I2 = calc({ 2: ad(2, 'N°3', { subject: 'adidas N°4' }) });
    dit(!I2.Leboncoin['2'] && (I2.aRelier['2'] || {}).raison === 'deux-numeros', 'R2 · N°3 à la fin, N°4 dans le titre : rien, « deux numéros »', JSON.stringify(I2));
    const I2b = calc({ 2: ad(2, 'N°3 ou N°4') });
    dit(!I2b.Leboncoin['2'] && (I2b.aRelier['2'] || {}).raison === 'deux-numeros', 'R2b · deux N° dans la description : rien', JSON.stringify(I2b));
    const I3 = calc({ 3: ad(3, 'N°12') }, { douteux: new Set(['12']) });
    dit(!I3.Leboncoin['3'] && (I3.aRelier['3'] || {}).raison === 'deux-paires', 'R3 · deux paires sous N°12 : rien, « deux paires »', JSON.stringify(I3));
    const I4 = calc({ 4: ad(4, 'N°999') });
    dit(!I4.Leboncoin['4'] && (I4.aRelier['4'] || {}).raison === 'inconnu', 'R4 · N° qu’aucune paire ne porte : rien, « inconnu »', JSON.stringify(I4));
    const I5 = calc({ 5: ad(5, 'N°12', { account: 'lbc-account:111' }) });
    dit(!I5.Leboncoin['5'], 'R5 · l’annonce d’un AUTRE vendeur : rien', JSON.stringify(I5));
    const I6 = calc({ 6: ad(6, 'N°12'), 7: ad(7, 'N°12') });
    dit(!I6.Leboncoin['6'] && !I6.Leboncoin['7'] && I6.aRelier['6'].raison === 'deux-annonces', 'R6 · deux de ses annonces écrivent N°12 : aucune reliée', JSON.stringify(I6));
    const I6b = calc({ 8: ad(8, 'N°12') }, { poses: { 9: '12' } });
    dit(!I6b.Leboncoin['8'] && I6b.aRelier['8'].raison === 'deux-annonces', 'R6b · N°12 déjà relié à la main à une autre annonce : rien', JSON.stringify(I6b));
    const COUPURE = Date.parse('2026-10-11T00:00:00Z');
    const traduire = (k, x) => (/^\d+$/.test(k) && Date.parse(x.publieeLe || '') < COUPURE ? 'B' + k : k);
    const I7 = calc({ 10: ad(10, 'N°3', { publieeLe: '2026-09-01T10:00:00Z' }), 11: ad(11, 'N°4', { publieeLe: '2026-11-01T10:00:00Z' }) }, { connus: new Set(['B3', '3', '4']), traduire });
    dit(I7.Leboncoin['10'] === 'B3' && I7.Leboncoin['11'] === '4', 'R7 · remise à zéro : « N°3 » d’une annonce d’avant la coupure désigne B3, l’ANCIENNE paire', JSON.stringify(I7.Leboncoin));
    const I8 = calc({ 12: ad(12, 'N°3') }, { connus: null });
    dit(!I8.lu && !Object.keys(I8.Leboncoin).length, 'R8 · paires pas lues (pas su) : rien relié', JSON.stringify(I8));
    const I9 = calc({ 13: ad(13, 'Réf. CW2288-111') });
    dit(!I9.Leboncoin['13'], 'R9 · une référence de MODÈLE n’est pas un N°', JSON.stringify(I9));
  }
  // M — SA main gagne.
  {
    const I = calc({ 20: ad(20, 'N°3') }, { poses: { 20: '12' } });
    const L = R.liensLbcAvecNumeroEcrit({ 20: '12' }, I);
    dit(!I.Leboncoin['20'] && L['20'] === '12', 'M1 · un lien posé à la main gagne sur le N° écrit', JSON.stringify({ I: I.Leboncoin, L }));
    const I2 = calc({ 21: ad(21, 'N°3') }, { poses: { 21: '' } });
    dit(!I2.Leboncoin['21'] && R.liensLbcAvecNumeroEcrit({ 21: '' }, I2)['21'] === '', 'M2 · un lien DÉFAIT (vide) n’est jamais refait par le N° écrit', JSON.stringify(I2.Leboncoin));
    const J = { [R.cleNonEcrit('22')]: { numero: '3', at: '2026-11-24T10:00:00Z' } };
    const I3 = calc({ 22: ad(22, 'N°3') }, { journal: J });
    dit(!I3.Leboncoin['22'] && (I3.aRelier['22'] || {}).raison === 'delie', 'M3 · « Délier » (pas la même paire) est retenu : N°3 ne se refait pas', JSON.stringify(I3));
    const I4 = calc({ 22: ad(22, 'N°4') }, { journal: J });
    dit(I4.Leboncoin['22'] === '4', 'M4 · il écrit ensuite un AUTRE N° (4) : celui-là se relit', JSON.stringify(I4.Leboncoin));
    const avant = calc({ 23: ad(23, 'N°3') });
    const J2 = { [R.cleNonEcrit('23')]: { numero: '3' } };
    dit(avant.Leboncoin['23'] === '3' && !R.liensLbcAvecNumeroEcrit({}, avant, J2)['23'], 'M5 · « Délier » gagne À L’INSTANT (journal relu par les liens lus, avant tout recalcul)', '');
  }
  // A — « Relier mes annonces ».
  {
    const I = calc({ 30: ad(30, 'N°5'), 31: ad(31, 'N°999') });
    const autres = [{ plateforme: 'Leboncoin', id: '30', relie: false, numero: '', identites: [] }, { plateforme: 'Leboncoin', id: '31', relie: false, numero: '', identites: [] }, { plateforme: 'Leboncoin', id: '32', relie: true, numero: '8', identites: [{ sorte: 'lien', numero: '8' }] }];
    const V = R.autresAvecNumeroEcrit(autres, I);
    dit(V[0].relie && V[0].numero === '5' && V[0].identites[0].sorte === 'numero-ecrit', 'A1 · reliée par le N° écrit, preuve « numero-ecrit » en tête', JSON.stringify(V[0]));
    dit(!V[1].relie && V[1].numeroEcrit && V[1].numeroEcrit.raison === 'inconnu' && V[1].numeroEcrit.numero === '999', 'A2 · « à relier » porte la raison (N°999 inconnu)', JSON.stringify(V[1]));
    dit(V[2] === autres[2], 'A3 · une annonce déjà reliée (son lien) n’est pas touchée', '');
    // `delier` EXÉCUTÉ (src/liaisonActions.js) avec un écrivain qui note chaque opération.
    if (fs.existsSync(src('liaisonActions.js'))) {
      for (const f of ['liaisonActions.js', 'liaisonSites.js', 'suggestionsAchat.js', 'lienVestiaire.js']) if (fs.existsSync(src(f))) fs.copyFileSync(src(f), path.join(tmp, f));
      for (const f of fs.readdirSync(path.join(RACINE, 'src')).filter((x) => /\.js$/.test(x) && !fs.existsSync(path.join(tmp, x)))) fs.copyFileSync(src(f), path.join(tmp, f));
      fs.writeFileSync(path.join(tmp, 'lbcNumeroEcrit.js'), regle);
      const ACT = await import(pathToFileURL(path.join(tmp, 'liaisonActions.js')).href);
      const joues = [];
      const cartes = { vrm_lbc_liens: {}, vrm_ebay_liens: {}, vrm_vc_liens: {}, vrm_liaison_sites: {}, vrm_articles_sites: {} };
      const L = ACT.creerLiaison({ pret: () => true, proprio: () => 'u1', lireCarte: (k) => cartes[k], geste: (t, ops) => joues.push(...ops), memePhoto: async () => null, annoncesAutres: async () => ({ autres: [], illisibles: [] }), pairesVinted: async () => ({ paires: [] }), pistes: async () => null, douteux: () => new Set(), numerosConnus: () => new Set(), numeroVcDe: () => '', donnerNumero: async () => ({ refus: 'pas-su' }), refuserPhoto: () => null, cleNum: cle, marqueDe: () => '', tr: (k) => k, publier: () => {}, lire: () => null });
      const r = L.delier({ annonce: V[0] });
      const op = joues[0] || {};
      dit(r && r.ok && joues.length === 1 && op.k === 'vrm_liaison_sites' && op.id === R.cleNonEcrit('30') && op.apres && op.apres.numero === '5' && !joues.some((o) => o.k === 'vrm_lbc_liens'), 'A4 · « Délier » une annonce reliée par son N° écrit : le journal note « pas la même (N°5) », aucun lien écrit', JSON.stringify({ r, joues }));
      const r2 = ACT.creerLiaison({ pret: () => true, proprio: () => 'u1', lireCarte: () => undefined, geste: (t, ops) => joues.push(...ops), memePhoto: async () => null, annoncesAutres: async () => null, pairesVinted: async () => null, pistes: async () => null, douteux: () => new Set(), numerosConnus: () => null, numeroVcDe: () => '', donnerNumero: async () => null, refuserPhoto: () => null, cleNum: cle, marqueDe: () => '', tr: (k) => k, publier: () => {}, lire: () => null }).delier({ annonce: V[0] });
      dit(r2 && r2.refus === 'pas-su' && joues.length === 1, 'A5 · cartes pas lues : « Délier » n’écrit rien (pas su)', JSON.stringify(r2));
    } else dit(false, 'A4 · src/liaisonActions.js présent', 'absent');
  }
  // B — le branchement.
  {
    const tout = APP;
    const lecteurs = (tout.match(/liensLbcLus\(\)/g) || []).length;
    dit(lecteurs >= 20, `B1 · les lecteurs d’identité Leboncoin lisent \`liensLbcLus()\` (${lecteurs} lectures)`, String(lecteurs));
    const anti = ["const liensR=load('vrm_lbc_liens',{})||{};", "const liensL=load('vrm_lbc_liens',{})||{};", "const liensE=load('vrm_lbc_liens',{})||{};", "liensLbc:load('vrm_lbc_liens',{})||{}, ventesVc:vcC", "numerosLbcSortis(ls.items, { ...(load('vrm_lbc_liens', {}) || {}) }", "liensLbc: load('vrm_lbc_liens', {}) || {}, ventesVc: ventesVcDv", "numLbc: (ad, id) => numeroLbcIdentite({ itemId: id }, { [id]: ad }, load('vrm_lbc_liens', {}) || {})"];
    const restes = anti.filter((x) => tout.includes(x));
    dit(!restes.length, 'B2 · plus aucune lecture BRUTE des liens là où une identité se décide (retirer ailleurs, ventes croisées, bénéfice, recherche, numérotation)', JSON.stringify(restes));
    dit(!/(save|ecrireCopieLocale|vcPoser)\([^)\n]*(liensLbcLus|avecNumeroEcritLbc)\(/.test(tout), 'B3 · les liens LUS (avec le N° écrit) ne sont jamais réécrits en base', '');
    dit(/function liensLbcLus\(\) \{ return liensLbcAvecNumeroEcrit\(liensLbcPoses\(\), identEcritDuCompte\(\), load\(CLE_LIAISON/.test(tout), 'B4 · `liensLbcLus()` = SES liens, puis le N° écrit, « Délier » relu', '');
    const num = (/async function numeroterSites[\s\S]*?\n\}\n/.exec(tout) || [''])[0];
    dit(/ecritEnAttente/.test(num) && /lbc\.filter\(\(a\) => !ecritEnAttente\(a\)\)/.test(num) && /await chargerNumerosEcritsLbc\(\)/.test(num), 'B5 · numérotation : une annonce au N° écrit non relié ne reçoit jamais un N° neuf ; une reconnue garde le sien', '');
    const amp = (/async function annoncesAutresMemePhoto[\s\S]*?\n\}\n/.exec(tout) || [''])[0];
    dit(/autresAvecNumeroEcrit\(autres, identEcritDuCompte\(\)\)/.test(amp), 'B6 · « Relier mes annonces » voit les annonces À TRAVERS le N° écrit', '');
    const ls = fs.existsSync(src('LiaisonSites.jsx')) ? fs.readFileSync(src('LiaisonSites.jsx'), 'utf8') : '';
    dit(/data-liaison-ecrit=\{a\.numeroEcrit\.raison\}/.test(ls) && /tr\('lia\.ecrit\.' \+ a\.numeroEcrit\.raison/.test(ls), 'B7 · l’écran dit la raison d’un N° écrit pas relié (par `tr`)', '');
    const manque = [];
    for (const l of ['fr', 'en', 'es', 'it', 'de']) {
      const p = path.join(RACINE, 'src', 'i18n', 'langues', l, 'liaisonSites.js');
      const t = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      for (const k of ['lia.preuve.numero-ecrit', 'lia.c.src.numero-ecrit', ...R.RAISONS_ECRIT.map((x) => 'lia.ecrit.' + x)]) if (!t.includes(`"${k}"`)) manque.push(l + ':' + k);
    }
    dit(!manque.length, 'B8 · les textes en 5 langues (preuve, source, chaque raison)', manque.join(' '));
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  fin();
})().catch((e) => { dit(false, 'l’audit a planté', String(e && e.stack || e).slice(0, 400)); fin(); });

function fin() {
  console.log(`\n${ko ? '❌' : '✅'} audit-lbc-numero-ecrit${MUTATION ? ` (mutation « ${MUTATION} »)` : ''} : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
}
