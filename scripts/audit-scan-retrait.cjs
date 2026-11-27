// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU 27 NOV. — AU POINT RELAIS : JE SCANNE, LA PAIRE ENTRE DANS LE STOCK (lot scan-ce-matin).
//  Julien (27 nov.) : au point relais, scanner le code du colis (code-barres OU QR du retrait) au téléphone ⇒
//  le colis est trouvé PAR IDENTITÉ (code de retrait ou n° de suivi SEULEMENT), noté retiré, relié à SON achat,
//  la paire reçoit son N° par les règles de numérotation, puis « Écris N°X sur la boîte ». Deux scans du même code
//  ne créent jamais deux paires ; aucune identité ⇒ « à vérifier » ; le prix d'achat ne vient que du REÇU.
//  Récit : docs/passation/2026-11-27-scan-ce-matin.md. Données INVENTÉES (le dépôt est public). Lecture seule.
//
//  I · l'identité (src/arriveeAchat.js `achatDuRetraitScan`, sur la VRAIE lecture `lireCodeColis`) :
//      I1 2 colis au MÊME titre (et 50 identiques) : chaque CODE DE RETRAIT ⇒ SON achat, jamais l'autre ;
//      I2 chaque n° de suivi ⇒ SON achat ; le n° de suivi passe avant le code ;
//      I3 un code inconnu, un début de code, un code voisin, le TITRE scanné ⇒ jamais un achat ;
//      I4 un colis à retirer sans achat relié ⇒ « sansAchat » (à vérifier) ; deux achats au même code ⇒ « plusieurs » ;
//      I5 trop court (< 4) ⇒ « pas reconnu » ; une VENTE au même code n'est pas un colis reçu.
//  D · deux scans : le 2e scan du même code désigne le MÊME achat, et l'écran d'arrivée dit « déjà rangé »
//      (`numeroArrivee` : une fiche d'arrivée porte SON n° de transaction) — aucune 2e paire.
//  P · le prix écrit : le REÇU de CET achat seulement (`lignesArrivee`, source « recu ») ; l'article seul ⇒ rien.
//  B · les branchements (texte du code, commentaires retirés) : le scanner de l'arrivée passe par
//      `achatDuRetraitScan`, la CAMÉRA y a droit au code de retrait ; « Rangé » dit « Écris N°X sur la boîte » ;
//      « aucun » et « sansAchat » disent « À vérifier » (fr) ; les 5 langues ont les clés.
//
//  `--src <dossier>` : les règles d'un autre arbre (le code d'avant : il doit rougir).
//  `--prouve` : chaque MUTATION (une règle réaffaiblie) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const iS = process.argv.indexOf('--src');
const RACINE = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
let ko = 0, ok = 0;
const dit = (c, nom, det) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${nom}${c || det === undefined ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400)}`); };
const imp = (rel) => import(pathToFileURL(path.join(RACINE, 'src', rel)).href);
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const MUTATIONS = [
  ['src/arriveeAchat.js', "e.code && normCode(e.code) === n);", "e.code && (normCode(e.code).startsWith(n.slice(0, 4)) || n.startsWith(normCode(e.code).slice(0, 4))));", 'I1 : un code qui RESSEMBLE relie'],
  ['src/arriveeAchat.js', "if (A.length > 1) return { etat: 'plusieurs', lu: luCode, trouves: A, par: 'code' };", "if (A.length > 1) return { etat: 'un', lu: luCode, trouve: A[0], par: 'code' };", 'I4 : deux achats au même code ⇒ le premier'],
  ['src/arriveeAchat.js', "if (U.length) return { etat: 'sansAchat', lu: luCode, par: 'code' };", "if (U.length) return { etat: 'un', lu: luCode, trouve: U[0], par: 'code' };", 'I4 : un colis sans achat pris pour un achat'],
  ['src/arriveeAchat.js', "(e.sorte === 'achat' || e.sorte === 'colis') && e.code", "e.code", 'I5 : une vente au même code prise pour un colis reçu'],
  ['src/arriveeAchat.js', "if (n.length >= CODE_RETRAIT_MIN) {", "if (n.length >= 2) {", 'I5 : un code de 3 caractères relie'],
  ['src/arriveeAchat.js', "if (deja.length) return { su: true, etat: 'range',", "if (false) return { su: true, etat: 'range',", 'D : le 2e scan range une 2e paire'],
  ['src/arriveeAchat.js', "&& prixRecu && prixRecu.source === 'recu'", "&& prixRecu", 'P : le prix de l’article seul écrit comme payé'],
  ['src/ScannerRetrouver.jsx', "const idPossible = (tape || arrivee) && normaliserN(brut).length >= 4;", "const idPossible = tape && normaliserN(brut).length >= 4;", 'B1 : la caméra ne lit plus le code de retrait'],
  ['src/ecrans/Comptabilite.jsx', "x.ranger = () => { const e = en2();", "x.rangerX = () => { const e = en2();", 'B5 : « Ranger » du scanner universel oublie le retrait'],
  ['src/ArriveeAchat.jsx', "tr('arv.fait.ecris', { num: fait.numeros[0] })", "tr('arv.fait.titre')", 'B2 : « Écris N°X sur la boîte » oublié'],
];
function prouver() {
  let rouges = 0;
  for (const [f, a, b, quoi] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-retrait-mut-'));
    fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
    try { fs.symlinkSync(path.join(RACINE, 'package.json'), path.join(tmp, 'package.json')); } catch (_) {}
    const p = path.join(tmp, f);
    const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(a)) { console.log(`❌ mutation introuvable (${f}) : ${quoi}`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, s.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${quoi} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' (' + (r.stdout.split('\n').filter((l) => l.startsWith('❌')).slice(0, 1).join(' | ').slice(0, 200)) + ')' : ''}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const tous = rouges === MUTATIONS.length;
  console.log(`\n${tous ? '✅ --prouve : les ' + MUTATIONS.length + ' mutations rougissent' : '❌ --prouve : ' + (MUTATIONS.length - rouges) + ' mutation(s) ne rougissent pas'}`);
  process.exit(tous ? 0 : 1);
}
if (PROUVE) prouver();

(async () => {
  let A, SC;
  try { [A, SC] = await Promise.all(['arriveeAchat.js', 'scanColis.js'].map(imp)); }
  catch (e) { dit(false, 'C0 · les règles de l’arrivée se chargent', e.message); process.exit(1); }
  if (typeof A.achatDuRetraitScan !== 'function') { dit(false, 'C1 · `achatDuRetraitScan` existe (src/arriveeAchat.js)'); console.log(`\n❌ audit-scan-retrait : ${ko} rouge(s)`); process.exit(1); }
  const S = A.achatDuRetraitScan;
  const TITRE = 'Nike Dunk Low Panda 42 noir';
  const lu = (x) => SC.lireCodeColis(x);
  const scan = (x, E) => S(x, lu(x), E);
  const achat = (k, { code = '', suivis = [] } = {}) => ({ sorte: 'achat', site: 'vinted', cle: 'a:' + (8800000000 + k), titre: TITRE, prix: 45, taille: '42', suivis, code });

  // ════════ I · L'IDENTITÉ ═══════════════════════════════════════════════════
  {
    const deux = [achat(1, { code: 'K7Q2M9', suivis: ['49110001'] }), achat(2, { code: 'K7Q2M8', suivis: ['49110002'] })];
    const a = scan('K7Q2M9', deux), b = scan('K7Q2M8', deux);
    dit(a.etat === 'un' && a.trouve.cle === 'a:8800000001' && b.etat === 'un' && b.trouve.cle === 'a:8800000002',
      'I1a · 2 colis au MÊME titre : chaque code de retrait ⇒ SON achat, jamais l’autre', { a: a.etat, ac: a.trouve && a.trouve.cle, b: b.etat, bc: b.trouve && b.trouve.cle });
    const cinquante = Array.from({ length: 50 }, (_, k) => achat(k, { code: String(410000 + k * 13), suivis: [String(49200000 + k * 7)] }));
    const bad = [];
    for (let k = 0; k < 50; k++) {
      const r = scan(String(410000 + k * 13), cinquante);
      if (r.etat !== 'un' || r.trouve.cle !== 'a:' + (8800000000 + k)) bad.push({ k, r: r.etat, c: r.trouve && r.trouve.cle });
    }
    dit(bad.length === 0, 'I1b · 50 colis identiques : chaque code de retrait ⇒ SON achat', bad.slice(0, 3));
    const qrCode = scan('k7q2-m9', deux);
    dit(qrCode.etat === 'un' && qrCode.trouve.cle === 'a:8800000001', 'I1c · le même code lu avec tiret / minuscules (QR) ⇒ le même achat (égalité sans séparateurs)', qrCode.etat);
    const s1 = scan('49110002', deux);
    dit(s1.etat === 'un' && s1.trouve.cle === 'a:8800000002' && s1.par === 'suivi', 'I2a · le n° de suivi ⇒ SON achat', s1);
    const croise = [achat(3, { code: '49110004', suivis: ['49110003'] }), achat(4, { code: 'ZZ99', suivis: ['49110004'] })];
    const s2 = scan('49110004', croise);
    dit(s2.etat === 'un' && s2.trouve.cle === 'a:8800000004' && s2.par === 'suivi', 'I2b · un n° de suivi passe avant un code égal', s2);
    const inconnus = ['K7Q2M7', 'K7Q2', 'K7Q2M9X', TITRE, 'Nike Dunk', '42'].map((x) => [x, scan(x, deux)]);
    dit(inconnus.every(([, r]) => r.etat !== 'un' && r.etat !== 'plusieurs'), 'I3 · code inconnu, début de code, code voisin, titre scanné ⇒ jamais un achat', inconnus.map(([x, r]) => x + ':' + r.etat));
    const colis = [{ sorte: 'colis', site: 'vinted', cle: 'r:e:1', titre: TITRE, suivis: ['49110009'], code: 'P4P4P4' }];
    const sa = scan('P4P4P4', [...deux, ...colis]);
    dit(sa.etat === 'sansAchat', 'I4a · un colis à retirer sans achat relié ⇒ « sansAchat » (à vérifier, rien d’inventé)', sa.etat);
    const dbl = scan('Q1Q1Q1', [achat(5, { code: 'Q1Q1Q1' }), achat(6, { code: 'Q1Q1Q1' })]);
    dit(dbl.etat === 'plusieurs' && dbl.trouves.length === 2, 'I4b · deux achats au même code ⇒ « plusieurs » (la question), jamais le premier', dbl.etat);
    const court3 = scan('K7Q', [...deux, achat(9, { code: 'K7Q' })]);
    dit(court3.etat === 'pasReconnu', 'I5a · un code de 3 caractères (même porté par un colis) ⇒ « pas reconnu », rien relié', court3.etat);
    const vente = [{ sorte: 'vente', site: 'vinted', cle: 'v:1', titre: TITRE, suivis: [], code: 'V3V3V3' }];
    dit(!['un', 'plusieurs', 'sansAchat'].includes(scan('V3V3V3', vente).etat), 'I5b · une VENTE au même code n’est pas un colis reçu', scan('V3V3V3', vente).etat);
  }

  // ════════ D · DEUX SCANS ═══════════════════════════════════════════════════
  {
    const E = [achat(7, { code: 'D2D2D2', suivis: ['49110077'] })];
    const r1 = scan('D2D2D2', E), r2 = scan('D2D2D2', E);
    dit(r1.etat === 'un' && r2.etat === 'un' && r1.trouve.cle === r2.trouve.cle, 'D1 · deux scans du même code ⇒ le MÊME achat (une identité, pas une création)');
    const tx = '8800000007';
    const avant = A.numeroArrivee({ tx, fiches: {} });
    const apres = A.numeroArrivee({ tx, fiches: { f1: { id: 'f1', numero: '214', origine: A.ORIGINE_ARRIVEE, achat: { tx } } } });
    dit(avant.su && avant.etat === 'nouveau' && apres.su && apres.etat === 'range' && apres.fiches.length === 1 && apres.fiches[0].numero === '214',
      'D2 · après le 1er scan rangé, le 2e dit « déjà rangé · N°214 » : aucune 2e paire, aucun 2e N°', { avant, apres: apres.etat });
  }

  // ════════ P · LE PRIX ══════════════════════════════════════════════════════
  {
    const entree = { tx: '8800000008', titre: TITRE, n: 1 };
    const recu = A.lignesArrivee({ entree, numeros: ['215'], cases: [null], n: 1, prixRecu: { source: 'recu', centimes: 4870 } });
    const article = A.lignesArrivee({ entree, numeros: ['215'], cases: [null], n: 1, prixRecu: { source: 'achat', centimes: 4500 } });
    dit(recu && recu[0].prix === '48,70' && article && article[0].prix === '', 'P · le prix écrit = le REÇU de CET achat ; l’article seul ⇒ aucun prix', { recu: recu && recu[0].prix, article: article && article[0].prix });
  }

  // ════════ B · LES BRANCHEMENTS ═════════════════════════════════════════════
  {
    const sc = sansCommentaires(lire('src/ScannerRetrouver.jsx'));
    dit(/achatDuRetraitScan\(brut, lu, S\.enregistrements\)/.test(sc), 'B1a · le scanner de l’arrivée passe par `achatDuRetraitScan`');
    dit(/const idPossible = \(tape \|\| arrivee\) &&/.test(sc), 'B1b · à l’arrivée, la CAMÉRA lit le code de retrait (pas seulement la saisie)');
    const ar = sansCommentaires(lire('src/ArriveeAchat.jsx'));
    dit(/tr\('arv\.fait\.ecris', \{ num: fait\.numeros\[0\] \}\)/.test(ar) && /'data-arv-ecrire'/.test(ar), 'B2 · rangé ⇒ « Écris N°X sur la boîte » (data-arv-ecrire)');
    const fr = lire('src/i18n/langues/fr/arriveeScan.js');
    dit(/"arv\.scan\.aucun": "À vérifier/.test(fr) && /"arv\.scan\.sansAchat": "À vérifier/.test(fr), 'B3 · « aucun » et « sansAchat » disent « À vérifier »');
    const co = sansCommentaires(lire('src/ecrans/Comptabilite.jsx'));
    dit(/x\.entree = \(\) => \{ const e = en\(\); return e \? \{ \.\.\.e, opsRetire: \(\) => opsRetraitScan\(c\) \} : e; \};[\s\S]{0,200}x\.ranger = \(\) => \{ const e = en2\(\);[\s\S]{0,120}ouvrirAtelierArrivee\(\[e\]/.test(co),
      'B5 · « Ranger » depuis le scanner universel (achat à retirer) passe par l’entrée qui note le colis RETIRÉ (`opsRetire`)');
    const manque = ['fr', 'en', 'es', 'it', 'de'].filter((l) => { const s = lire(`src/i18n/langues/${l}/arriveeScan.js`); return !/"arv\.fait\.ecris":/.test(s) || !/"arv\.fait\.ecrisN":/.test(s); });
    dit(!manque.length, 'B4 · les 5 langues ont « Écris N°X sur la boîte »', manque);
  }

  console.log(`\n${ko ? '❌' : '✅'} audit-scan-retrait : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
