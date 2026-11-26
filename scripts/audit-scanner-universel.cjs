// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU 24 NOV. — LE SCANNER UNIVERSEL (lot scanner-universel). Il EXÉCUTE la règle (src/scanUniversel.js) sur
//  des données INVENTÉES (le dépôt est public). Lecture seule. Récit : docs/passation/2026-11-24-scanner-universel.md
//
//  « Même avec 50 articles identiques, tu ne dois pas pouvoir te tromper » (CLAUDE.md §5) : 50 ventes, 50 achats et
//  50 paires au MÊME titre, chacun avec ses identités (n° de suivi, n° de transaction, code de retrait, N°).
//   T1 chaque sorte de code ⇒ LA bonne fiche : n° de suivi (Mondial Relay 8 chiffres, Code 128 « 55… » 26 chiffres,
//      S10 Chronopost, QR de suivi) ⇒ sa vente / son achat ; n° de transaction ⇒ sa vente ou son achat ; code de retrait
//      (espaces, minuscules) ⇒ son colis ; « 124 », « N°124 », « VRM-124 », « 0124 » ⇒ LA paire N°124 ;
//   T2 deux fiches pour un même code ⇒ « plusieurs » (la question), jamais la première ;
//   T3 une boîte (EAN-13 / UPC-A à clé GS1 juste) n'ouvre JAMAIS rien — même si un N° ou une transaction lui ressemble ;
//      tapée, seule une transaction EXACTE répond ; jamais une paire ;
//   T4 la remise à zéro du 11 oct. (migration 013, archive « B ») : « 230 » ⇒ les DEUX (230 et B230) quand les deux
//      existent ; « B230 » ⇒ B230 seule ; « VRM-230 » comme « 230 » ; sans archive, « 230 » ⇒ 230 seule ;
//   T5 jamais une ressemblance : un titre ⇒ rien ; « 12 » n'est pas « 124 » ; un n° de transaction tronqué ou voisin ⇒
//      rien ; un N° qu'aucune paire ne porte ⇒ « aucun » (dit, avec le N°) ; « 124 Nike » n'est pas un N° ;
//   T6 la source des paires : un enregistrement par N° SERVI, par sa clé (deux fiches au même N° = une paire).
//  B · les branchements (texte, commentaires retirés) : le scanner passe par `reconnaitre` (caméra comprise) et ouvre
//      une paire par `vrm:fiche-paire` ; la coque enregistre la source des paires avec SES règles (`cleNum`, archive) ;
//      la barre du haut porte le scanner ; un EAN ne montre que « Chercher ».
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
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const FICHIERS = ['src/scanUniversel.js', 'src/scanColis.js', 'src/ScannerRetrouver.jsx', 'src/App.jsx', 'src/retrouverColis.js'];

const MUTATIONS = [
  ['src/scanUniversel.js', "if (num) ajoute('numero', L.filter((e) => e.sorte === 'paire' && num.cles.includes(String(e.cle).replace(/^n:/, ''))));",
    "if (num) ajoute('numero', L.filter((e) => e.sorte === 'paire' && num.cles.some((c) => String(e.cle).replace(/^n:/, '').startsWith(c))));", 'T5 : un N° partiel (« 12 » ⇒ 124) accepté'],
  ['src/scanUniversel.js', "if (T.length === 1) return { etat: 'un'", "if (!T.length) { const t = L.find((e) => e.titre && normaliserN(e.titre) === n); if (t) T.push(t); }\n  if (T.length === 1) return { etat: 'un'", 'T5 : un titre ouvre une fiche'],
  ['src/scanUniversel.js', "if (T.length > 1) return { etat: 'plusieurs', lu, trouves: T, par, parCle };", "if (T.length > 1) return { etat: 'un', lu, trouve: T[0], trouves: T, par, parCle };", 'T2 : deux fiches ⇒ la première'],
  ['src/scanUniversel.js', "if (camera && !lu0 && estEanBoite(texte)) return", "if (false) return", 'T3 : une boîte lue par la caméra cherchée comme identité'],
  ['src/scanUniversel.js', "const num = estEanBoite(texte) ? null : lireNumeroScan(texte, { cleNum, archive });", "const num = lireNumeroScan(texte.slice(-6), { cleNum, archive });", 'T3 : la fin d’un EAN lue comme un N°'],
  ['src/scanUniversel.js', "if (a && /^\\d+$/.test(k)) cles.push(cleNum(a + k));", "", 'T4 : « 230 » ne propose plus l’ancienne B230'],
  ['src/scanUniversel.js', "if (/^\\d{9,13}$/.test(n)) ajoute('transaction', L.filter((e) => (e.sorte === 'vente' && String(e.cle) === 'v:' + n) || (e.sorte === 'achat' && String(e.cle) === 'a:' + n)));",
    "if (/^\\d{7,13}$/.test(n)) ajoute('transaction', L.filter((e) => (e.sorte === 'vente' || e.sorte === 'achat') && String(e.cle).slice(2).startsWith(n)));", 'T5 : un n° de transaction tronqué relie'],
  ['src/scanUniversel.js', "e.code && normaliserN(e.code) === n", "e.code && normaliserN(e.code).includes(n)", 'T5 : un morceau de code de retrait relie'],
  ['src/ScannerRetrouver.jsx', "const u = reconnaitre(brut, { enregistrements: S.enregistrements, regles: S.regles, camera: !tape });", "const u = { etat: 'aucun', par: [], trouves: [] };", 'B : le scanner ne passe plus par la règle'],
];
function prouver() {
  let rouges = 0;
  for (const [f, a, b, quoi] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-univ-mut-'));
    for (const x of FICHIERS) { const d = path.join(tmp, x); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(RACINE, x), d); }
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
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
  let R;
  try {
    // Un arbre sans `"type": "module"` (le dépôt) : la règle est copiée dans un dossier qui le dit.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-univ-'));
    for (const x of ['src/scanUniversel.js', 'src/scanColis.js']) { const d = path.join(tmp, x); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(RACINE, x), d); }
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
    R = await import(pathToFileURL(path.join(tmp, 'src', 'scanUniversel.js')).href);
    process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} });
  } catch (e) { dit(false, 'src/scanUniversel.js existe et se charge', String(e && e.message).slice(0, 160)); console.log(`\n❌ audit-scanner-universel : ${ko} rouge(s)`); process.exit(1); }
  const { reconnaitre, pairesDuScan, lireNumeroScan, estEanBoite } = R;
  // La clé d'un N° de l'app (src/App.jsx `cleNum`), recopiée : majuscules, sans espace ni tiret, « 007 » = « 7 ».
  const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
  const TITRE = 'Nike Dunk Low panda';
  const cleS10 = (h) => { const p = [8, 6, 4, 2, 3, 5, 9, 7]; let t = 0; for (let i = 0; i < 8; i++) t += Number(h[i]) * p[i]; const c = 11 - (t % 11); return c === 10 ? 0 : c === 11 ? 5 : c; };
  const gs1 = (d) => { let s = 0; for (let i = d.length - 1, p = 3; i >= 0; i--, p = p === 3 ? 1 : 3) s += Number(d[i]) * p; return d + ((10 - (s % 10)) % 10); };
  const MR = (k) => String(46000000 + k * 13);
  const TXV = (k) => String(15193000000 + k), TXA = (k) => String(16000000000 + k * 7);
  const E = [];
  for (let k = 0; k < 50; k++) {
    E.push({ sorte: 'vente', site: 'vinted', cle: 'v:' + TXV(k), suivis: [MR(k)], titre: TITRE, num: String(100 + k) });
    E.push({ sorte: 'achat', site: 'vinted', cle: 'a:' + TXA(k), suivis: [String(47000000 + k * 11)], titre: TITRE, code: `K${String(4700 + k)}Q` });
  }
  const S10 = `XW${'30303031'}${cleS10('30303031')}TS`;
  E.push({ sorte: 'vente', site: 'vinted', cle: 'v:9301', suivis: [S10], titre: TITRE });
  const fiches = {}; for (let k = 0; k < 50; k++) fiches['it' + k] = { numero: String(100 + k), title: TITRE };
  fiches.itB = { numero: 'B230', title: TITRE }; fiches.it230 = { numero: '230', title: TITRE }; fiches.it230b = { numero: '0230', title: TITRE };
  fiches.itB77 = { numero: 'B77', title: TITRE };
  const paires = pairesDuScan({ fiches, neuves: { f1: { numero: '777', titre: TITRE }, f2: { numero: '778', titre: TITRE, retireeAt: 1 } }, pool: [1, 2, 'B5', 124], cleNum });
  const L = [...E, ...paires];
  const regles = { cleNum, archive: 'B' };
  const R0 = (t, o = {}) => reconnaitre(t, { enregistrements: L, regles, ...o });
  const cle = (r) => (r && r.trouve ? `${r.trouve.sorte}:${r.trouve.cle}` : null);

  // ── T6 ── la source des paires
  const n230 = paires.filter((p) => p.cle === 'n:230');
  dit(n230.length === 1 && paires.some((p) => p.cle === 'n:B230') && paires.some((p) => p.cle === 'n:777') && !paires.some((p) => p.cle === 'n:778') && paires.some((p) => p.cle === 'n:B5'),
    'T6 un enregistrement par N° servi (« 230 » et « 0230 » = une paire ; une fiche retirée n’en donne pas ; le pool compte)', paires.filter((p) => /230|77|B5/.test(p.cle)).map((p) => p.cle));

  // ── T1 ── chaque sorte de code ⇒ LA bonne fiche, parmi 50 au même titre
  let bons = 0; for (let k = 0; k < 50; k++) { const r = R0(MR(k), { camera: true }); if (r.etat === 'un' && cle(r) === 'vente:v:' + TXV(k)) bons++; }
  dit(bons === 50, 'T1 n° de suivi Mondial Relay (caméra) ⇒ SA vente, 50 sur 50 au même titre', bons);
  const r26 = R0('55' + MR(23) + '0101' + '000000123456', { camera: true });
  dit(r26.etat === 'un' && cle(r26) === 'vente:v:' + TXV(23) && r26.par[0] === 'suivi', 'T1 le Code 128 de 26 chiffres « 55… » ⇒ SA vente', r26);
  const rS = R0(S10, { camera: true });
  dit(rS.etat === 'un' && cle(rS) === 'vente:v:9301', 'T1 un S10 Chronopost (clé vérifiée) ⇒ SA vente', rS);
  const rQ = R0('https://www.mondialrelay.fr/suivi-de-colis/?exp=' + MR(31), { camera: true });
  dit(rQ.etat === 'un' && cle(rQ) === 'vente:v:' + TXV(31), 'T1 le QR d’un lien de suivi ⇒ SA vente', rQ);
  const rTv = R0(TXV(17), { camera: true }), rTa = R0(TXA(42));
  dit(rTv.etat === 'un' && cle(rTv) === 'vente:v:' + TXV(17) && rTv.par[0] === 'transaction' && rTa.etat === 'un' && cle(rTa) === 'achat:a:' + TXA(42), 'T1 n° de transaction (caméra ou tapé) ⇒ SA vente / SON achat', { rTv: cle(rTv), rTa: cle(rTa) });
  const rC = R0(' k 4733 q ');
  dit(rC.etat === 'un' && cle(rC) === 'achat:a:' + TXA(33) && rC.par[0] === 'code', 'T1 le code de retrait (espaces, minuscules) ⇒ SON colis', rC);
  const nums = ['124', 'N°124', 'n° 124', '#124', 'VRM-124', 'vrm 124', '0124'].map((t) => R0(t, { camera: true }));
  dit(nums.every((r) => r.etat === 'un' && cle(r) === 'paire:n:124' && r.par[0] === 'numero'), 'T1 « 124 », « N°124 », « VRM-124 », « 0124 » ⇒ LA paire N°124 (parmi 50 au même titre)', nums.map((r) => r.etat + ':' + cle(r)));
  dit(R0('b77').etat === 'un' && cle(R0('b77')) === 'paire:n:B77', 'T1 « b77 » ⇒ la paire B77 (la clé, pas la casse)');

  // ── T2 ── deux fiches ⇒ la question
  const D = [...L, { sorte: 'retour', cle: 'r:9', suivis: [MR(4)], titre: TITRE }, { sorte: 'colis', cle: 'c:2', code: 'K4705Q', suivis: [] }];
  const d1 = reconnaitre(MR(4), { enregistrements: D, regles, camera: true });
  const d2 = reconnaitre('K4705Q', { enregistrements: D, regles });
  dit(d1.etat === 'plusieurs' && d1.trouves.length === 2 && !d1.trouve, 'T2 un n° de suivi sur une vente ET un retour ⇒ les deux, aucune ouverte', d1.etat);
  dit(d2.etat === 'plusieurs' && d2.trouves.length === 2, 'T2 deux colis au même code de retrait ⇒ « plusieurs »', d2.etat);
  const X = [...L, { sorte: 'colis', cle: 'c:3', code: '0777', suivis: [] }];
  const d3 = reconnaitre('0777', { enregistrements: X, regles });
  dit(d3.etat === 'plusieurs' && d3.par.includes('code') && d3.par.includes('numero'), 'T2 un code de retrait qui est aussi un N° ⇒ les deux proposés (jamais l’un deviné)', { e: d3.etat, par: d3.par });

  // ── T3 ── la boîte
  const ean = gs1('301234567890'), upc = gs1('01234567890');
  dit(estEanBoite(ean) && estEanBoite(upc) && !estEanBoite(ean.slice(0, 12) + ((Number(ean[12]) + 1) % 10)), 'T3 la clé GS1 est vérifiée (une clé fausse n’est pas une boîte)');
  const Eb = [...L, { sorte: 'paire', cle: 'n:' + cleNum(ean.slice(-6)), num: ean.slice(-6), suivis: [] }, { sorte: 'vente', cle: 'v:' + ean, suivis: [] }];
  const b1 = reconnaitre(ean, { enregistrements: Eb, regles, camera: true });
  dit(b1.etat === 'ean' && !b1.trouve && !(b1.trouves || []).length, 'T3 une boîte lue par la caméra n’ouvre RIEN (même une transaction ou un N° qui lui ressemble)', b1);
  const b2 = reconnaitre(ean, { enregistrements: Eb, regles });
  dit(b2.etat === 'un' && cle(b2) === 'vente:v:' + ean, 'T3 tapé, 13 chiffres : seule une transaction EXACTE répond', b2.etat + ':' + cle(b2));
  const b3 = reconnaitre(ean, { enregistrements: L, regles });
  dit(b3.etat === 'ean', 'T3 tapé sans transaction : « boîte », jamais une paire', b3.etat);
  let jamaisPaire = true; for (let k = 0; k < 200; k++) { const e13 = gs1(String(400000000000 + k * 7919)); const r = reconnaitre(e13, { enregistrements: Eb, regles, camera: true }); if (r.etat !== 'ean') jamaisPaire = false; }
  dit(jamaisPaire, 'T3 200 boîtes lues par la caméra : 200 « boîte », aucune fiche');

  // ── T4 ── la coupure du 11 oct.
  const c1 = R0('230', { camera: true }), c2 = R0('B230'), c3 = R0('VRM-230');
  dit(c1.etat === 'plusieurs' && c1.trouves.map((e) => e.cle).sort().join() === 'n:230,n:B230', 'T4 « 230 » sur un carton : la 230 ET la B230 (il choisit)', c1.etat + ' ' + (c1.trouves || []).map((e) => e.cle));
  dit(c2.etat === 'un' && cle(c2) === 'paire:n:B230', 'T4 « B230 » ⇒ B230 seule', cle(c2));
  dit(c3.etat === 'plusieurs' && c3.trouves.length === 2, 'T4 le SKU « VRM-230 » (aucune date) ⇒ les deux aussi', c3.etat);
  const c4 = reconnaitre('230', { enregistrements: L, regles: { cleNum, archive: '' } });
  dit(c4.etat === 'un' && cle(c4) === 'paire:n:230', 'T4 sans archive : « 230 » ⇒ la 230 seule', cle(c4));
  const c5 = R0('77');
  dit(c5.etat === 'un' && cle(c5) === 'paire:n:B77', 'T4 « 77 » quand seule B77 existe ⇒ B77 (l’ancienne, jamais une 77 inventée)', cle(c5));
  dit(R0('5').etat === 'un' && cle(R0('5')) === 'paire:n:B5', 'T4 le pool compte : « 5 » ⇒ B5 (servie, sans fiche)');
  const lu = lireNumeroScan('230', { cleNum, archive: 'B' });
  dit(lu && lu.cles.join() === '230,B230' && lireNumeroScan('B230', { cleNum, archive: 'B' }).cles.join() === 'B230', 'T4 les clés d’une étiquette : « 230 » ⇒ [230, B230] ; « B230 » ⇒ [B230]', lu);

  // ── T5 ── jamais une ressemblance
  dit(R0(TITRE).etat !== 'un' && R0(TITRE).etat !== 'plusieurs', 'T5 un titre ⇒ rien');
  const p12 = R0('12');
  dit(p12.etat === 'aucun' && (p12.numero || []).includes('12'), 'T5 « 12 » n’ouvre pas la 124 : « aucun », le N° dit', p12);
  dit(R0(TXV(17).slice(0, 10)).etat === 'aucun' && R0(String(Number(TXV(17)) + 50000)).etat === 'aucun', 'T5 un n° de transaction tronqué ou voisin ⇒ rien');
  dit(R0('4733').etat === 'aucun' || !R0('4733').trouves || !R0('4733').trouves.some((e) => e.sorte === 'achat'), 'T5 un morceau de code de retrait ⇒ pas SON colis');
  dit(R0('124 Nike').etat === 'aucun' && lireNumeroScan('124 Nike', { cleNum }) === null, 'T5 « 124 Nike » n’est pas un N°');
  dit(R0('999', { camera: true }).etat === 'aucun', 'T5 un N° qu’aucune paire ne porte ⇒ « aucun » (jamais créé)');
  dit(R0('').etat === 'vide' && R0('—').etat === 'vide', 'T5 une lecture vide ⇒ rien');

  // ── B ── les branchements
  const scan = sansCommentaires(lire('src/ScannerRetrouver.jsx'));
  const app = sansCommentaires(lire('src/App.jsx'));
  dit(/reconnaitre\(brut, \{ enregistrements: S\.enregistrements, regles: S\.regles, camera: !tape \}\)/.test(scan), 'B le scanner passe par `reconnaitre` (caméra comprise, les règles de l’app)');
  dit(/e\.sorte === 'paire' && e\.num/.test(scan) && /'vrm:fiche-paire'/.test(scan), 'B une paire s’ouvre par SA fiche (`vrm:fiche-paire`)');
  dit(/res\.etat === 'ean' \?/.test(scan) && !/res\.etat === 'ean'[\s\S]{0,600}data-scan-r-ouvrir/.test(scan.slice(scan.indexOf("res.etat === 'ean' ?"), scan.indexOf("res.etat === 'ean' ?") + 900)), 'B une boîte : « Chercher » seulement, aucun « Ouvrir »');
  dit(/enregistrerSourceColis\('paires'/.test(app) && /regles = \{ cleNum, archive: archiveNumeros\(\) \}/.test(app) && /pairesDuScan\(\{ fiches: load\('vinted_annonce_numeros'/.test(app), 'B la coque enregistre la source des paires avec SES règles (cleNum, archive 013)');
  dit(/data-n-tete-scanner/.test(app) && /ouvrirRetrouver\('tete'\)/.test(app), 'B la barre du haut porte le scanner');
  dit(/OUVRE_SEULE = new Set\(\['vente', 'retour', 'colis', 'paire'\]\)/.test(scan) && !/OUVRE_SEULE[^\n]*'achat'/.test(scan), 'B l’ouverture directe : jamais un achat (sa fiche du scanner EST la destination)');

  console.log(ko ? `\n❌ audit-scanner-universel : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-scanner-universel : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
