#!/usr/bin/env node
// ── audit-inventaire — LE MODE INVENTAIRE DU STOCK (6 nov. 2026) ─────────────
// Julien passe devant ses cartons et dit quels N° sont là ; VRM répond ce qui
// MANQUE, ce qui est EN TROP, ce qui est VENDU MAIS ENCORE RANGÉ.
// Exécute la VRAIE règle (src/inventaire.js) sur un attendu fabriqué par la
// VRAIE règle du Stock (`annoncesActuelles`, src/stockAnnonces.js — la même
// chaîne que l'écran), sur des données INVENTÉES (dépôt public), et vérifie dans
// App.jsx que l'écran passe par elles. Ce qu'il exige :
//   I1 attendu · vendu · en trop · pas su, chacun à sa place ; le bilan dit les
//      trois listes (manque, en trop, vendu encore rangé) ;
//   I2 « 007 » = « 7 », « b125 » = « B125 », et B125 ≠ 125 (l'archive, §5) ;
//   I3 un compte pas lu ⇒ AUCUN « manque » pour lui (nommé) ; une annonce « à
//      confirmer » pas vue ⇒ « pas su », jamais « manque » ; un N° vu qu'une
//      lecture manquante pourrait porter ⇒ « pas su », jamais « en trop » ;
//      ventes jamais publiées ⇒ « pas su » ;
//   I4 50 paires au même titre : l'identité est le N° seul (rien ne se rapproche
//      par le titre ; un texte qui n'est pas un N° est « illisible ») ;
//   I5 le rouge seulement pour deux paires sous un même N° (conflit connu, ou
//      « 2ᵉ carton » dit) ;
//   I6 la session : annuler le dernier, terminer, reprendre ; la fusion de deux
//      appareils ne perd aucune saisie ; l'écriture (lire-fusionner-réécrire sur
//      `rev`) : lecture ratée ⇒ RIEN d'écrit, conflit ⇒ relire et réunir ;
//   I7 App.jsx : l'attendu vient du Stock (aa, jugeable, vrm_stock_vendus), la
//      ligne dédiée `vrm_inventaire` écrite en comparer-et-échanger, aucun N°
//      écrit par l'inventaire, Stock → « Inventaire » et la carte de Ma journée.
//   node scripts/audit-inventaire.cjs                 la règle du dépôt
//   node scripts/audit-inventaire.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-inventaire.cjs --prouve        toutes les mutations : chacune doit rougir
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'inventaire.js');
const APP = path.join(RACINE, 'src', 'App.jsx');
const ECRAN = path.join(RACINE, 'src', 'InventaireStock.jsx');

// [ancre, remplacement] dans src/inventaire.js
const MUTATIONS = {
  // La clé brute : « 007 » n'est plus « 7 ».
  'cle-brute': ["  const kk = k ? cle(k) : '';", "  const kk = k ? String(k).trim().toUpperCase() : '';"],
  // La lettre oubliée : B125 devient 125 (l'archive redonnée, §5).
  'lettre-ignoree': ["  const kk = k ? cle(k) : '';", "  const kk = k ? cle(String(k).replace(/^[a-z]+/i, '')) : '';"],
  // Une vendue jugée « attendue » (l'annonce encore lue l'emporte).
  'vendu-apres-attendu': ["  if (vendus && vendus.has(kk)) {", "  if (vendus && vendus.has(kk) && !u) {"],
  // « Pas su » dit « en trop » (la lecture manquante oubliée).
  'passu-dit-trop': ["  if (!vendus || !s.su || typeof s.jugeable !== 'function' || !s.jugeable(kk)) {", "  if (!vendus || !s.su) {"],
  // Ventes jamais publiées traitées comme « aucune vente ».
  'ventes-null-trop': ["  if (!vendus || !s.su || typeof s.jugeable !== 'function' || !s.jugeable(kk)) {", "  if (!s.su || typeof s.jugeable !== 'function' || !s.jugeable(kk)) {"],
  // « À confirmer » (lecture vieille) pas vue ⇒ « manque ».
  'aconfirmer-manque': ["      if (u.etat === 'aconfirmer') aConfirmer.push(u); else manque.push(u);", "      manque.push(u);"],
  // Une vendue pas vue ⇒ « manque » (elle part, elle n'est plus attendue).
  'manque-vendu': ["      if (vendusSet && u.cles.some((k) => vendusSet.has(k))) continue;   // vendue : pas « attendue », elle part\n", ''],
  // Le titre rapproche : 50 paires au même titre n'en font plus qu'une (§5).
  'par-titre': ["    if (cles.some((k) => parCle.has(k))) continue;          // déjà porté (même paire sous deux N°)",
    "    if (cles.some((k) => parCle.has(k)) || unites.some((x) => x.titre && x.titre === u.titre)) continue;"],
  // Les paires gardées « encore là » oubliées.
  'gardee-oubliee': ["    if (!s.garder[k0]) continue;", "    continue;"],
  // Le conflit connu (deux paires sous un N°) oublié : plus de rouge.
  'doublon-oublie': ["  const doublon = !!(s.doublons && typeof s.doublons.has === 'function' && s.doublons.has(kk));", "  const doublon = false;"],
  // Le « 2ᵉ carton » dit pendant l'inventaire oublié.
  'deuxieme-oublie': ["    e.fois += 1; if (x.d) e.deuxieme = true;", "    e.fois += 1;"],
  // Une saisie annulée compte encore.
  'annulee-comptee': ["    .filter(([sid, x]) => estObjet(x) && x.k && !mortes[sid])", "    .filter(([sid, x]) => estObjet(x) && x.k)"],
  // La fusion de deux appareils perd les saisies de l'un.
  'fusion-ecrase': ["  const saisies = { ...(estObjet(b.saisies) ? b.saisies : {}), ...(estObjet(a.saisies) ? a.saisies : {}) };", "  const saisies = { ...(estObjet(a.saisies) ? a.saisies : {}) };"],
  // Une lecture ratée écrit quand même (« lecture KO, écriture OK », §5).
  'lecture-ko-ecrit': ["    if (!l || typeof l !== 'object') return { ok: false, raison: 'lecture', data: null, ecrit: false };", "    if (!l || typeof l !== 'object') l = { existe: true, data: {} };"],
  // Un conflit de `rev` pris pour un succès (l'autre appareil écrasé).
  'conflit-ignore': ["    if (r === 'ok') return { ok: true, raison: '', data: fusion, ecrit: true };", "    if (r === 'ok' || r === 'conflit') return { ok: true, raison: '', data: fusion, ecrit: true };"],
  // Case par case : la case vue n'est plus comparée à la case notée.
  'place-ignoree': ["      if (sl && sl.m != null && !e.cases.has(String(sl.m) + ':' + Number(sl.i))) pasASaPlace.push", "      if (false) pasASaPlace.push"],
  // « Terminé » ne se défait plus : « Reprendre » ne rouvre pas.
  'reprise-ignoree': ["export const enCours = (session) => estObjet(session) && !(Number(session.finAt) > Number(session.reprisAt || 0));", "export const enCours = (session) => estObjet(session) && !(Number(session.finAt) > 0);"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

let n = 0, ko = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 400) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le contrôle a tourné jusqu’au bout', e && e.stack); } };

(async () => {
  let fichier = REGLE;
  if (!fs.existsSync(REGLE)) { console.log('❌ src/inventaire.js absent : la règle de l’inventaire n’existe pas'); process.exit(1); }
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    const src = fs.readFileSync(REGLE, 'utf8');
    if (!src.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    // La copie vit dans un dossier temporaire qui reproduit src/ et api/_lib/ (ses
    // imports relatifs restent justes, et rien n'est jamais écrit dans le dépôt).
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-inventaire-'));
    fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true });
    fs.copyFileSync(path.join(RACINE, 'api', '_lib', 'numerotation.js'), path.join(dir, 'api', '_lib', 'numerotation.js'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fichier = path.join(dir, 'src', 'inventaire.js');
    fs.writeFileSync(fichier, src.replace(m[0], m[1]));
  }
  let R, S, N;
  try {
    R = await import(pathToFileURL(fichier).href);
    S = await import(pathToFileURL(path.join(RACINE, 'src', 'stockAnnonces.js')).href);
    N = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'numerotation.js')).href);
  } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  finally { if (fichier !== REGLE) try { fs.rmSync(path.dirname(path.dirname(fichier)), { recursive: true, force: true }); } catch (_) {} }
  const cle = N.cleNum;

  // ── L'attendu, fabriqué par la VRAIE chaîne du Stock (`annoncesActuelles`) ──
  // Compte A (lu, frais) : N°1, N°2 masquée, N°7 (prouvée vendue, encore lue en ligne), N°B125 (archive encore en ligne).
  // Compte B (lu, mais vieux) : N°20 « à confirmer ».
  // Compte C (lecture RATÉE) : sa N°30 rangée dans une case.
  // eBay : N°40. Leboncoin : rien. Vestiaire : pas demandé.
  const it = (id, title) => ({ id, title, photo: null });
  const numeros = { 101: { numero: '1', accountId: 'A' }, 102: { numero: '2', accountId: 'A' }, 107: { numero: '7', accountId: 'A' }, 125: { numero: 'B125', accountId: 'A' }, 120: { numero: '20', accountId: 'B' }, 130: { numero: '30', accountId: 'C' } };
  const vinted = [
    { uid: 'A', nom: 'compte_a', ok: true, lu: Date.now(), enLigne: [it(101, 'Nike Dunk Low Panda 42'), it(107, 'Nike Dunk Low Panda 42'), it(125, 'Vieille paire')], aConfirmer: [], masquees: [it(102, 'Masquée')] },
    { uid: 'B', nom: 'compte_b', ok: true, lu: Date.now() - 72 * 3600e3, enLigne: [], aConfirmer: [it(120, 'Vieille lecture')], masquees: [] },
    { uid: 'C', nom: 'compte_c', ok: false },
  ];
  const vendus = new Set(['7', '9']);
  const aa = S.annoncesActuelles({ vinted, numeros, ebay: { liste: [{ numero: '40', title: 'Sur eBay' }], illisibles: [] }, lbc: [], vendus: new Set(), cle });
  const fichesParCompte = { '1': 'A', '2': 'A', '7': 'A', 'B125': 'A', '20': 'B', '30': 'C' };
  const lusOk = new Set(['A', 'B']);
  // `jugeable` : la même question que le Stock (« toutes les lectures qui pourraient porter ce N° ont répondu ? »).
  const jugeable = (k) => { const u = fichesParCompte[k]; return u ? lusOk.has(u) : vinted.every((c) => c.ok); };
  const base = { su: aa.su, articles: aa.articles, manque: aa.manque, vendus, physiques: new Set(['1', '2', '7', '40', 'B125']), garder: { '55': 1 }, gardees: { '55': { numero: '55', titre: 'Gardée' } },
    jugeable, connues: new Set(['1', '2', '7', '9', 'B125', '20', '30', '40', '55', '60']), archive: 'B', doublons: new Set(['2']), slots: { '30': { m: 'm1', i: 0 }, '1': { m: 'm1', i: 1 } } };
  // Le même stock, mais tous les comptes lus (pour juger « en trop »).
  const jugeableTout = (k) => { const u = fichesParCompte[k]; return u ? (u === 'A' || u === 'B') : true; };
  const plein = { ...base, manque: [], jugeable: jugeableTout };

  await essaie('I1 — attendu, vendu, en trop, pas su', () => {
    const j = (k, st = plein) => R.jugerSaisie(k, st, { cle });
    dit(j('1').etat === 'attendu', 'I1 N°1 en ligne ⇒ attendu', JSON.stringify(j('1')));
    dit(j('2').etat === 'attendu', 'I1 N°2 masquée par Vinted (toujours chez lui) ⇒ attendue', JSON.stringify(j('2')));
    dit(j('40').etat === 'attendu', 'I1 N°40 en ligne sur eBay ⇒ attendu', JSON.stringify(j('40')));
    dit(j('55').etat === 'attendu' && j('55').raison === 'gardee', 'I1 N°55 gardée « encore là » ⇒ attendue', JSON.stringify(j('55')));
    const v7 = j('7');
    dit(v7.etat === 'vendu' && v7.parti === false, 'I1 N°7 prouvée vendue (même encore lue en ligne) ⇒ « vendu, à sortir pour l’envoi »', JSON.stringify(v7));
    const v9 = j('9');
    dit(v9.etat === 'vendu' && v9.parti === true, 'I1 N°9 vendue, colis parti selon VRM ⇒ « vendu », à vérifier', JSON.stringify(v9));
    dit(j('60').etat === 'trop' && j('60').raison === 'plusenligne', 'I1 N°60 numérotée mais plus en annonce ⇒ en trop', JSON.stringify(j('60')));
    dit(j('777').etat === 'trop' && j('777').raison === 'jamais', 'I1 N°777 jamais donné ⇒ en trop (« jamais donné »)', JSON.stringify(j('777')));
    dit(j('B9').etat === 'trop' && j('B9').raison === 'archive', 'I1 B9 (archive, plus en ligne) ⇒ en trop (« ancien numéro »)', JSON.stringify(j('B9')));
    dit(j('nike').etat === 'illisible' && j('').etat === 'illisible', 'I1 un texte qui n’est pas un N° ⇒ illisible (rien n’est compté)');
  });

  await essaie('I2 — l’identité du N°', () => {
    const j = (k) => R.jugerSaisie(k, plein, { cle });
    dit(j('007').etat === 'vendu' && j('007').k === '7', 'I2 « 007 » = « 7 » (la même clé que l’app)', JSON.stringify(j('007')));
    dit(j('0001').etat === 'attendu' && j('0001').k === '1', 'I2 « 0001 » = N°1', JSON.stringify(j('0001')));
    dit(j('b125').etat === 'attendu' && j('b125').k === 'B125', 'I2 « b125 » = « B125 » (attendue : encore en ligne)', JSON.stringify(j('b125')));
    dit(j('125').etat !== 'attendu' && j('125').k === '125', 'I2 « 125 » n’est PAS « B125 » (un ancien numéro ne se redonne jamais)', JSON.stringify(j('125')));
    dit(j('B 125').k === 'B125', 'I2 « B 125 » (espace) = B125', JSON.stringify(j('B 125')));
  });

  await essaie('I3 — pas su n’est pas manque', () => {
    const s0 = R.ajouterSaisie(R.nouvelleSession({ maintenant: 1000, id: 'inv-a' }), { k: '1', at: 1001, sid: 's1' });
    const b = R.bilanInventaire({ session: s0, stock: base, cle });
    const manque = b.manque.map((u) => u.cles[0]);
    dit(!manque.includes('30'), 'I3 N°30 du compte_c (lecture ratée) n’est PAS dans « manque »', JSON.stringify(manque));
    dit(b.lectures.some((m) => /compte_c/.test(m.nom)), 'I3 la lecture ratée est NOMMÉE (compte_c)', JSON.stringify(b.lectures));
    dit(!manque.includes('20') && b.aConfirmer.some((u) => u.cles.includes('20')), 'I3 N°20 « à confirmer » (lecture de 3 j) pas vue ⇒ « pas su », jamais « manque »', JSON.stringify({ manque, ac: b.aConfirmer.map((u) => u.cles) }));
    dit(manque.includes('2') && manque.includes('40') && manque.includes('B125') && manque.includes('55'), 'I3 les attendues fraîches pas vues ⇒ « manque » (2 masquée, 40 eBay, B125, 55 gardée)', JSON.stringify(manque));
    dit(!manque.includes('7'), 'I3 N°7 vendue pas vue n’est pas « manque » (elle part)', JSON.stringify(manque));
    dit(b.vendusNonVus.includes('7') && !b.vendusNonVus.includes('9'), 'I3 N°7 vendue à envoyer pas vue est dite à part (déjà emballée ?) ; N°9 (partie) non', JSON.stringify(b.vendusNonVus));
    const p30 = R.jugerSaisie('30', base, { cle });
    dit(p30.etat === 'passu', 'I3 N°30 VUE alors que son compte n’est pas lu ⇒ « pas su », jamais « en trop »', JSON.stringify(p30));
    const pInconnu = R.jugerSaisie('999', base, { cle });
    dit(pInconnu.etat === 'passu', 'I3 un N° inconnu alors qu’un compte n’est pas lu ⇒ « pas su »', JSON.stringify(pInconnu));
    const sansVentes = R.jugerSaisie('60', { ...plein, vendus: null }, { cle });
    dit(sansVentes.etat === 'passu' && sansVentes.raison === 'ventes', 'I3 ventes jamais publiées ⇒ un N° hors annonces est « pas su » (peut-être vendu)', JSON.stringify(sansVentes));
    const rien = R.bilanInventaire({ session: s0, stock: { su: false, articles: [], manque: [{ plateforme: 'vinted', nom: 'compte_a', raison: 'lecture ratée' }], vendus: null }, cle });
    dit(rien.manque.length === 0 && rien.su === false, 'I3 rien lu ⇒ aucun « manque », `su: false`', JSON.stringify(rien));
  });

  await essaie('I1 — le bilan et ses trois listes', () => {
    let s = R.nouvelleSession({ maintenant: 1000, id: 'inv-b' });
    for (const [i, k] of ['1', '7', '60', '777', '20', 'nike'].entries()) s = R.ajouterSaisie(s, { k: R.jugerSaisie(k, plein, { cle }).k || k, s: k, at: 2000 + i, sid: 's' + i });
    const b = R.bilanInventaire({ session: s, stock: plein, cle });
    dit(b.attendus.map((v) => v.k).join(',') === '1,20', 'I1 attendus vus : N°1, N°20 (à confirmer, le voilà)', b.attendus.map((v) => v.k).join(','));
    dit(b.vendus.map((v) => v.k).join(',') === '7', 'I1 vendue encore rangée : N°7', b.vendus.map((v) => v.k).join(','));
    dit(b.trop.map((v) => v.k).join(',') === '60,777', 'I1 en trop : N°60, N°777', b.trop.map((v) => v.k).join(','));
    dit(b.manque.map((u) => u.cles[0]).join(',') === '2,40,55,B125', 'I1 manque : N°2, N°40, N°55, B125', b.manque.map((u) => u.cles[0]).join(','));
    dit(!b.manque.some((u) => u.cles.includes('20')) && b.aConfirmer.length === 0, 'I1 N°20 vue : ni manque ni « à confirmer »');
  });

  await essaie('I4 — 50 paires au même titre', () => {
    const N50 = Array.from({ length: 50 }, (_, i) => ({ id: 5000 + i }));
    const num50 = {}; N50.forEach((x, i) => { num50[x.id] = { numero: String(i + 1), accountId: 'A' }; });
    const aa50 = S.annoncesActuelles({ vinted: [{ uid: 'A', nom: 'a', ok: true, lu: Date.now(), enLigne: N50.map((x) => it(x.id, 'Nike Dunk Low Panda 42')), aConfirmer: [], masquees: [] }], numeros: num50, ebay: { liste: [], illisibles: [] }, lbc: [], vendus: new Set(), cle });
    const st = { su: true, articles: aa50.articles, manque: [], vendus: new Set(), physiques: new Set(), garder: {}, jugeable: () => true, connues: new Set(Object.values(num50).map((f) => f.numero)), archive: 'B', doublons: new Set(), slots: {} };
    const idx = R.indexerAttendu(st, cle);
    dit(idx.unites.length === 50, 'I4 50 paires au même titre = 50 attendues (aucune réunie par le titre)', String(idx.unites.length));
    const j12 = R.jugerSaisie('12', st, { cle, index: idx });
    dit(j12.etat === 'attendu' && j12.unite && j12.unite.cles.join() === '12', 'I4 « 12 » désigne la N°12 et elle seule', JSON.stringify(j12.unite && j12.unite.cles));
    const jT = R.jugerSaisie('Nike Dunk Low Panda 42', st, { cle, index: idx });
    dit(jT.etat === 'illisible', 'I4 le titre tapé n’est pas un N° : illisible, rapproché de rien', JSON.stringify(jT));
    const j51 = R.jugerSaisie('51', st, { cle, index: idx });
    dit(j51.etat === 'trop', 'I4 N°51 (jamais donné, même titre ailleurs) ⇒ en trop', JSON.stringify(j51));
    let s = R.nouvelleSession({ maintenant: 1, id: 'inv-50' }); s = R.ajouterSaisie(s, { k: '12', at: 2, sid: 'x' });
    const b = R.bilanInventaire({ session: s, stock: st, cle });
    dit(b.manque.length === 49 && !b.manque.some((u) => u.cles.includes('12')), 'I4 une vue sur 50 ⇒ 49 manquent, jamais la N°12', String(b.manque.length));
  });

  await essaie('I5 — le rouge', () => {
    dit(R.jugerSaisie('2', plein, { cle }).doublon === true, 'I5 N°2 portée par deux paires (conflit connu) ⇒ doublon');
    dit(R.jugerSaisie('1', plein, { cle }).doublon === false, 'I5 N°1 ⇒ pas de doublon');
    let s = R.nouvelleSession({ maintenant: 1, id: 'inv-d' });
    s = R.ajouterSaisie(s, { k: '1', at: 2, sid: 'a' }); s = R.ajouterSaisie(s, { k: '1', at: 3, sid: 'b', d: 1 }); s = R.ajouterSaisie(s, { k: '2', at: 4, sid: 'c' });
    const b = R.bilanInventaire({ session: s, stock: plein, cle });
    dit(b.doublons.map((v) => v.k + ':' + v.raison).join(',') === '1:cartons,2:conflit', 'I5 « 2ᵉ carton » dit sur N°1 et le conflit de N°2 ⇒ les deux en rouge, rien d’autre', JSON.stringify(b.doublons.map((v) => v.k + ':' + v.raison)));
    dit(R.compterVus(s) === 3, 'I5 un 2ᵉ carton compte un carton de plus (3)', String(R.compterVus(s)));
  });

  await essaie('I8 — case par case', () => {
    let s = R.nouvelleSession({ maintenant: 1, id: 'inv-c' });
    s = R.ajouterSaisie(s, { k: '1', at: 2, sid: 'a', c: 'm1:5' });   // N°1 est notée dans m1:1
    s = R.ajouterSaisie(s, { k: '40', at: 3, sid: 'b', c: 'm1:5' });  // N°40 n'a pas de case notée
    const b = R.bilanInventaire({ session: s, stock: plein, cle });
    dit(b.pasASaPlace.length === 1 && b.pasASaPlace[0].k === '1' && b.pasASaPlace[0].notee.m === 'm1' && b.pasASaPlace[0].notee.i === 1, 'I8 N°1 vue dans m1:5, notée dans m1:1 ⇒ « pas dans sa case » ; N°40 (sans case notée) non', JSON.stringify(b.pasASaPlace.map((v) => [v.k, v.notee])));
    let s2 = R.nouvelleSession({ maintenant: 1, id: 'inv-c2' }); s2 = R.ajouterSaisie(s2, { k: '1', at: 2, sid: 'a', c: 'm1:1' });
    dit(R.bilanInventaire({ session: s2, stock: plein, cle }).pasASaPlace.length === 0, 'I8 N°1 vue dans SA case ⇒ rien à dire');
  });

  await essaie('I6 — la session et son écriture', async () => {
    let s = R.nouvelleSession({ maintenant: 10, id: 'inv-s' });
    s = R.ajouterSaisie(s, { k: '1', at: 11, sid: 'a' }); s = R.ajouterSaisie(s, { k: '40', at: 12, sid: 'b' });
    const r = R.annulerDerniere(s, 13);
    dit(r.annulee && r.annulee.k === '40' && R.saisiesVivantes(r.session).map((x) => x.k).join() === '1' && r.session.n === 1, 'I6 « Annuler le dernier » retire N°40, pas N°1', JSON.stringify(R.saisiesVivantes(r.session)));
    const t = R.terminerSession(r.session, 20);
    dit(!R.enCours(t), 'I6 « Terminer » : plus en cours');
    dit(R.enCours(R.reprendreSession(t, 30)), 'I6 « Reprendre » : de nouveau en cours');
    // Deux appareils sur la même session.
    const A = { courant: R.ajouterSaisie(s, { k: '2', at: 14, sid: 'c' }), anciens: [] };
    const B = { courant: R.ajouterSaisie(R.annulerDerniere(s, 15).session, { k: '55', at: 16, sid: 'd' }), anciens: [] };
    const F = R.fusionnerInventaire(A, B);
    dit(R.saisiesVivantes(F.courant).map((x) => x.k).join(',') === '1,2,55', 'I6 deux appareils : saisies réunies, l’annulation de l’un tient (1, 2, 55)', R.saisiesVivantes(F.courant).map((x) => x.k).join(','));
    // Une autre session commencée ailleurs : la plus récente est la courante, l'autre gardée.
    const G = R.fusionnerInventaire({ courant: s, anciens: [] }, { courant: R.ajouterSaisie(R.nouvelleSession({ maintenant: 99, id: 'inv-t' }), { k: '7', at: 100, sid: 'e' }), anciens: [] });
    dit(G.courant.id === 'inv-t' && G.anciens.some((x) => x.id === 'inv-s'), 'I6 deux sessions : la plus récente courante, l’autre gardée (jamais jetée)', JSON.stringify({ c: G.courant.id, a: G.anciens.map((x) => x.id) }));
    // L'écriture : une base factice qui sert la VRAIE forme (rev, conflit).
    const base0 = { existe: true, data: { rev: 4, courant: R.ajouterSaisie(s, { k: '9', at: 13, sid: 'z' }), anciens: [] } };
    let ligne = JSON.parse(JSON.stringify(base0)), ecritures = 0;
    const lire = async () => JSON.parse(JSON.stringify(ligne));
    const ecrire = async ({ rev, data }) => { ecritures++; if (rev !== (ligne.data.rev ?? null)) return 'conflit'; ligne = { existe: true, data }; return 'ok'; };
    const loc = { courant: R.ajouterSaisie(s, { k: '2', at: 14, sid: 'c' }), anciens: [] };
    const w = await R.enregistrerInventaire({ lire, ecrire, local: loc });
    dit(w.ok && ligne.data.rev === 5 && R.saisiesVivantes(ligne.data.courant).map((x) => x.k).join(',') === '1,40,9,2', 'I6 écriture : relue, fusionnée (la N°9 de l’autre appareil gardée), rev 4 → 5', JSON.stringify({ rev: ligne.data.rev, k: R.saisiesVivantes(ligne.data.courant).map((x) => x.k) }));
    // Lecture ratée : RIEN ne s'écrit.
    let ec2 = 0;
    const w2 = await R.enregistrerInventaire({ lire: async () => null, ecrire: async () => { ec2++; return 'ok'; }, local: loc });
    dit(!w2.ok && ec2 === 0, 'I6 lecture ratée ⇒ aucune écriture (« lecture KO, écriture OK » est le cas qui détruit)', JSON.stringify({ w2, ec2 }));
    // Conflit : un autre appareil écrit entre la lecture et l'écriture ⇒ relire et réunir.
    let l3 = { existe: true, data: { rev: 1, courant: s, anciens: [] } }; let fois = 0;
    const lire3 = async () => JSON.parse(JSON.stringify(l3));
    const ecrire3 = async ({ rev, data }) => {
      fois++;
      if (fois === 1) { l3 = { existe: true, data: { rev: 2, courant: R.ajouterSaisie(s, { k: '60', at: 50, sid: 'autre' }), anciens: [] } }; }
      if (rev !== l3.data.rev) return 'conflit';
      l3 = { existe: true, data }; return 'ok';
    };
    const w3 = await R.enregistrerInventaire({ lire: lire3, ecrire: ecrire3, local: { courant: R.ajouterSaisie(s, { k: '2', at: 51, sid: 'moi' }), anciens: [] } });
    const k3 = R.saisiesVivantes(l3.data.courant).map((x) => x.k);
    dit(w3.ok && k3.includes('60') && k3.includes('2') && l3.data.rev === 3, 'I6 conflit de rev ⇒ relu et réuni : la saisie de l’autre appareil (N°60) ET la mienne (N°2)', JSON.stringify({ w3: w3.ok, k3, rev: l3.data.rev }));
    // Ligne absente : créée.
    let l4 = { existe: false, data: {} };
    const w4 = await R.enregistrerInventaire({ lire: async () => l4, ecrire: async ({ existe, data }) => { if (existe) return 'ko'; l4 = { existe: true, data }; return 'ok'; }, local: loc });
    dit(w4.ok && l4.existe && l4.data.rev === 1, 'I6 ligne absente ⇒ créée avec rev 1', JSON.stringify(l4.data.rev));
  });

  await essaie('I7 — App.jsx et l’écran', () => {
    const sans = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/[^\n]*/gm, '').replace(/(^|[;,{}()\s])\/\/ [^\n]*/g, '$1');
    const app = sans(fs.readFileSync(APP, 'utf8'));
    const ecran = fs.existsSync(ECRAN) ? sans(fs.readFileSync(ECRAN, 'utf8')) : '';
    const regle = sans(fs.readFileSync(REGLE, 'utf8'));
    const meubles = app.slice(app.indexOf('function StockMeubles('), app.indexOf('function ChoixPlanches('));
    const el = meubles.slice(meubles.indexOf('const elInventaire'), meubles.indexOf('const elInventaire') + 4000);
    dit(/<InventaireStock /.test(el) && /articles: aa\.articles/.test(el) && /jugeable,/.test(el) && /su: aa\.su/.test(el) && /manque: aa\.manque/.test(el), 'I7 l’attendu de l’inventaire est celui du Stock (aa.articles, aa.manque, jugeable) — jamais une copie', el.slice(0, 300));
    dit(/vendus: venduSig && Array\.isArray\(venduSig\.nums\) \? vendus : null/.test(el), 'I7 ventes jamais publiées (vrm_stock_vendus absent) ⇒ `null`, pas su');
    dit(/lire=\{lireLigneInventaire\}/.test(el) && /ecrire=\{ecrireLigneInventaire\}/.test(el), 'I7 l’écran lit et écrit SA ligne par les fonctions de l’app');
    const io = app.slice(app.indexOf('const lireLigneInventaire'), app.indexOf('function useInventaireEnCours('));
    dit(/id=eq\.\$\{LIGNE_INVENTAIRE\}/.test(io) && /data->>rev=eq\.\$\{rev\}/.test(io) && /data->>rev=is\.null/.test(io) && /'conflit'/.test(io), 'I7 `vrm_inventaire` écrite en comparer-et-échanger sur data.rev', io.slice(0, 200));
    dit(/withOwner\(\{ id: LIGNE_INVENTAIRE, data \}\)/.test(io), 'I7 la création passe par withOwner (updated_at estampillé)');
    dit(/LIGNE_INVENTAIRE = 'vrm_inventaire'/.test(regle), 'I7 la ligne dédiée s’appelle vrm_inventaire');
    const NUMS = /vinted_annonce_numeros|vinted_used_numeros|vinted_sale_overrides|vrm_vc_numeros|vrm_slots|recordUsed|setNumero/;
    dit(!!ecran && !NUMS.test(ecran) && !NUMS.test(regle) && !/\bsave\(|saveTout\(/.test(ecran + regle), 'I7 l’inventaire n’écrit AUCUN numéro (ni fiche, ni pool, ni case) — §5');
    dit(/localStorage\.setItem\(cleLocale\(owner\)/.test(ecran) && (ecran.match(/localStorage\.setItem\(/g) || []).length === 1, 'I7 sur l’appareil : la seule copie locale est celle de l’inventaire');
    dit(/onSubmit=\{\(e\) => \{ e\.preventDefault\(\); valider\(texte\); \}\}/.test(ecran) && /inputMode=\{lettres \? 'text' : 'numeric'\}/.test(ecran), 'I7 « N° + Entrée » (et « OK ») au pavé numérique, dans l’inventaire');
    dit(/data-stock-inventaire-ouvrir/.test(app) && /vrm:inventaire-ouvrir/.test(meubles), 'I7 Stock → « Inventaire » ouvre l’inventaire');
    dit(/id: 'inventaire-en-cours'/.test(app) && /DEMANDE_STOCK_INVENTAIRE\.at = Date\.now\(\)/.test(app) && /useInventaireEnCours\(only === 'journee'\)/.test(app), 'I7 Ma journée dit « Inventaire en cours » et y mène');
    const iC = app.indexOf('const conflitsNum = useMemo('), iP = app.indexOf("save('vrm_num_doublons'");
    dit(iC > 0 && iP > iC, 'I7 les N° en conflit sont publiés (vrm_num_doublons) APRÈS leur calcul (TDZ, §4.6)');
    dit(/requeteDeLaVoix/.test(ecran) && /Micro \?/.test(ecran), 'I7 la saisie vocale du navigateur (gratuite, §2.9), seulement si elle existe');
  });

  await essaie('I9 — aucune couleur hors des jetons (§7)', () => {
    const CSS = path.join(RACINE, 'src', 'styles-inventaire.css');
    const css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') : '';
    const ecran = fs.existsSync(ECRAN) ? fs.readFileSync(ECRAN, 'utf8').replace(/^[ \t]*\/\/[^\n]*/gm, '') : '';
    const LITTERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:green|lime|red|orange|blue|yellow|teal)\b/;
    dit(!!css && !LITTERAL.test(css), 'I9 styles-inventaire.css : aucune couleur écrite en dur (seulement les jetons --vrm-*)', (css.match(LITTERAL) || [])[0]);
    dit(!/--vrm-inv-[a-z-]*\s*:/.test(css), 'I9 aucune couleur propre à l’inventaire (pas de jeton --vrm-inv-*)', (css.match(/--vrm-inv-[a-z-]*\s*:[^;]*/) || [])[0]);
    const vars = [...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);
    const JETONS = new Set(['--vrm-ink', '--vrm-muted', '--vrm-faint', '--vrm-hair', '--vrm-bar', '--vrm-accent', '--vrm-accent-texte', '--vrm-on-accent', '--vrm-card2', '--vrm-line', '--vrm-surface', '--vrm-bg', '--vrm-warn', '--vrm-warn-soft', '--vrm-doublon']);
    const hors = vars.filter((v) => !JETONS.has(v));
    dit(vars.length > 0 && hors.length === 0, 'I9 chaque couleur est un jeton de la coque (encre, gris, accent, ambre, rouge du doublon)', hors.join(', '));
    dit(/\[data-inv-retour="attendu"\] \.vrm-inv-retour-t \{ color: var\(--vrm-ink\); \}/.test(css) && /\[data-inv-etat="attendu"\] \.vrm-inv-point \{ background: var\(--vrm-ink\); \}/.test(css), 'I9 « attendu » est neutre : l’encre');
    dit(/t: '✓ Attendu'/.test(ecran), 'I9 « attendu » se dit par la coche ✓ et le mot (pas par une couleur)');
    const rouge = css.split('\n').filter((l) => /--vrm-doublon/.test(l));
    dit(rouge.length > 0 && rouge.every((l) => /vrm-inv-double/.test(l)), 'I9 le rouge seulement sur un doublon de N° (.vrm-inv-double)', rouge.join(' | '));
  });

  console.log(`\n${n - ko}/${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
