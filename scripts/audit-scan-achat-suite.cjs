// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU 23 NOV. — LE COLIS D'ACHAT SCANNÉ : SON N° ET LE GESTE SUIVANT (lot scan-achat). Il EXÉCUTE la règle
//  (src/scanAchatSuite.js) sur des données INVENTÉES (le dépôt est public). Lecture seule.
//  Récit : docs/passation/2026-11-23-scan-achat.md
//
//  I · l'identité (CLAUDE.md §5) :
//      I1 50 achats au MÊME titre, un seul relié à une fiche : seul CET achat a un N° ; les 49 autres « Numéroter » ;
//      I2 une fiche rangée à l'arrivée (`vrm_fiches_neuves`, `achat.tx`) donne SON N° ; retirée ⇒ plus rien ;
//      I3 fiches pas lues ⇒ pas su (`su: false`), jamais « Numéroter » ;
//      I4 le n° de transaction tapé ⇒ CET achat (égalité exacte) ; un n° voisin, un début ⇒ rien ; le code de retrait
//         tapé ⇒ SON colis ; deux colis au même code ⇒ « plusieurs » ; un titre tapé ⇒ rien.
//  S · la suite :
//      S1 N° dans une case ⇒ « range » et la case dite (meuble, rangée, colonne) ;
//      S2 N° sans case ⇒ « aRanger » et la case PROPOSÉE par la règle du Stock (la première libre, jamais une prise) ;
//         cases pas lues ⇒ aucune case proposée ; aucun meuble ⇒ dit ;
//      S3 une vente lue (pas annulée) porte ce N° par identité (son annonce ou sa correction) ⇒ « vendue », SA vente ;
//         une vente annulée ⇒ pas vendue ; ventes pas lues ⇒ `venteSu: false`, jamais « vendue » ;
//      S4 un lot de 3 N° ⇒ 3 cases différentes.
//  B · les branchements (texte, commentaires retirés) : la fiche d'achat du scanner lit `e.suite()` ; la source
//      d'Achats la bâtit par `numerosDeLAchat` / `numerosVendus` / `suiteAchatScan` ; l'identité tapée passe par
//      `achatParIdentite` et seulement pour un n° TAPÉ (`tape`).
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
const dit = (c, nom, det) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${nom}${c || det === undefined ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500)}`); };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const FICHIERS = ['src/scanAchatSuite.js', 'src/ouRanger.js', 'src/stockSortie.js', 'src/stockRegles.js', 'src/stockEtageres.js', 'src/scanColis.js', 'src/ScannerRetrouver.jsx', 'src/ecrans/Comptabilite.jsx'];

const MUTATIONS = [
  ['src/scanAchatSuite.js', "if (e && str(e.buyFromId) === t) ajoute(e.numero);", "if (e && e.title === 'Nike Dunk Low panda') ajoute(e.numero);", 'I1 : le N° pris sur une fiche au même TITRE'],
  ['src/scanAchatSuite.js', "if (f && !f.retireeAt && f.achat && str(f.achat.tx) === t) ajoute(f.numero);", "if (f && f.achat && str(f.achat.tx) === t) ajoute(f.numero);", 'I2 : une fiche retirée garde son N°'],
  ['src/scanAchatSuite.js', "if (!/^\\d+$/.test(t) || !estObjet(fiches) || !estObjet(rangees) || typeof cleNum !== 'function') return null;", "if (!/^\\d+$/.test(t) || typeof cleNum !== 'function') return null; fiches = fiches || {}; rangees = rangees || {};", 'I3 : fiches pas lues ⇒ « Numéroter »'],
  ['src/scanAchatSuite.js', "String(e.cle) === 'a:' + n", "String(e.cle).startsWith('a:' + n.slice(0, 6))", 'I4 : un n° de transaction voisin relie'],
  ['src/scanAchatSuite.js', "if (U.length > 1) return { etat: 'plusieurs', par, trouves: U };", "if (U.length > 1) return { etat: 'un', par, trouve: U[0] };", 'I4 : deux colis au même code ⇒ le premier'],
  ['src/scanAchatSuite.js', "if (notees.every(Boolean)) return", "if (false) return", 'S1 : un achat rangé reproposé à ranger'],
  ['src/scanAchatSuite.js', "const prop = casesProposees({ meubles, slots, cles: sans });", "const prop = Object.fromEntries(sans.map((c) => [c, { meubleId: String(meubles[0] && meubles[0].id), meuble: 'X', i: 0, rangee: 1, colonne: 1 }]));", 'S2 : la case proposée sans la règle du Stock (case prise)'],
  ['src/scanAchatSuite.js', "if (!estObjet(slots) || !Array.isArray(meubles)) return { su: true, etat: 'aRanger', numeros: nums, places: null, venteSu };", "slots = slots || {}; meubles = meubles || [];", 'S2 : cases pas lues ⇒ une case inventée'],
  ['src/scanAchatSuite.js', "if (typeof annulee === 'function' && annulee(o)) continue;", "", 'S3 : une vente annulée dite « vendue »'],
  ['src/scanAchatSuite.js', "if (!Array.isArray(ventes) || typeof cleNum !== 'function') return null;", "if (typeof cleNum !== 'function') return null; ventes = ventes || [];", 'S3 : ventes pas lues ⇒ « pas vendue »'],
  ['src/ScannerRetrouver.jsx', "const idPossible = tape && normaliserN(brut).length >= 4;", "const idPossible = normaliserN(brut).length >= 4;", 'B : un code lu par la caméra cherché comme identité'],
  ['src/ScannerRetrouver.jsx', "const suite = React.useMemo(() => lireSuite(e), [e]);", "const suite = { su: false };", 'B : la fiche ne dit plus le N° ni le geste'],
];
function prouver() {
  let rouges = 0;
  for (const [f, a, b, quoi] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-suite-mut-'));
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
  try { R = await import(pathToFileURL(path.join(RACINE, 'src', 'scanAchatSuite.js')).href); } catch (e) { dit(false, 'src/scanAchatSuite.js existe et se charge', String(e && e.message)); console.log(`\n❌ audit-scan-achat-suite : ${ko} rouge(s)`); process.exit(1); }
  const { numerosDeLAchat, suiteAchatScan, numerosVendus, achatParIdentite } = R;
  const cleNum = (v) => String(v == null ? '' : v).toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]*)0+(\d)/, '$1$2');
  const TITRE = 'Nike Dunk Low panda';
  const TX0 = 18000009400;

  // ── I ──
  const fiches = { 7001: { numero: '13', title: TITRE, buyFromId: String(TX0 + 23) }, 7002: { numero: '40', title: TITRE } };
  let nonVides = 0, bon = null;
  for (let k = 0; k < 50; k++) { const n = numerosDeLAchat({ tx: TX0 + k, fiches, rangees: {}, cleNum }); if (n && n.length) { nonVides++; if (k === 23) bon = n; } }
  dit(nonVides === 1 && bon && bon.join() === '13', 'I1 50 achats au même titre : seul l’achat relié porte un N° (N°13)', { nonVides, bon });
  const s49 = suiteAchatScan({ numeros: numerosDeLAchat({ tx: TX0 + 7, fiches, rangees: {}, cleNum }), slots: {}, meubles: [], vendus: new Map(), cleNum });
  dit(s49.su && s49.etat === 'aNumeroter', 'I1 un autre achat au même titre ⇒ « Numéroter » (jamais le N° d’un voisin)', s49);
  const rang = { ra1: { numero: '21', origine: 'arrivee', achat: { tx: String(TX0 + 30), ligne: 0 } }, ra2: { numero: '22', origine: 'arrivee', achat: { tx: String(TX0 + 31) }, retireeAt: 123 } };
  dit((numerosDeLAchat({ tx: TX0 + 30, fiches: {}, rangees: rang, cleNum }) || []).join() === '21', 'I2 une fiche rangée à l’arrivée donne SON N°');
  dit((numerosDeLAchat({ tx: TX0 + 31, fiches: {}, rangees: rang, cleNum }) || ['x']).length === 0, 'I2 une fiche retirée ne donne plus rien');
  const pasLu = numerosDeLAchat({ tx: TX0 + 23, fiches: null, rangees: {}, cleNum });
  dit(pasLu === null && suiteAchatScan({ numeros: pasLu, cleNum }).su === false, 'I3 fiches pas lues ⇒ pas su (jamais « Numéroter »)', pasLu);
  const E = [];
  for (let k = 0; k < 50; k++) E.push({ sorte: 'achat', cle: 'a:' + (TX0 + k), titre: TITRE, suivis: [String(41000000 + k)] });
  E.push({ sorte: 'colis', cle: 'c1', code: 'K4 72 19', suivis: [] }, { sorte: 'achat', cle: 'a:1', code: '991204', suivis: [] }, { sorte: 'colis', cle: 'c2', code: '991204', suivis: [] });
  const t = achatParIdentite(String(TX0 + 17), E);
  dit(t.etat === 'un' && t.trouve.cle === 'a:' + (TX0 + 17) && t.par === 'transaction', 'I4 le n° de transaction tapé ⇒ CET achat parmi 50 au même titre', t);
  dit(achatParIdentite(String(TX0 + 17).slice(0, 9), E).etat === 'aucun' && achatParIdentite(String(TX0 + 99), E).etat === 'aucun', 'I4 un début de n°, un n° voisin ⇒ rien');
  const c = achatParIdentite('k47219', E);
  dit(c.etat === 'un' && c.trouve.cle === 'c1' && c.par === 'code', 'I4 le code de retrait tapé (espaces, minuscules) ⇒ SON colis', c);
  dit(achatParIdentite('991204', E).etat === 'plusieurs', 'I4 deux fiches au même code ⇒ « plusieurs » (la question)');
  dit(achatParIdentite(TITRE, E).etat === 'aucun' && achatParIdentite('KX', E).etat === 'aucun', 'I4 un titre, un code trop court ⇒ rien');

  // ── S ──
  const meubles = [{ id: 'm1', name: 'Étagère A', cols: 4, rows: 3 }];
  const slots = { 13: { m: 'm1', i: 6 }, 99: { m: 'm1', i: 0 } };
  const sR = suiteAchatScan({ numeros: ['13'], slots, meubles, vendus: new Map(), cleNum });
  dit(sR.etat === 'range' && sR.places[0].meuble === 'Étagère A' && sR.places[0].rangee === 2 && sR.places[0].colonne === 3, 'S1 N° dans une case ⇒ « rangé », rangée 2 colonne 3', sR);
  const sA = suiteAchatScan({ numeros: ['14'], slots, meubles, vendus: new Map(), cleNum });
  dit(sA.etat === 'aRanger' && sA.places[0] && sA.places[0].propose && sA.places[0].i === 1, 'S2 N° sans case ⇒ la première case LIBRE proposée (la 1re est prise)', sA);
  const sP = suiteAchatScan({ numeros: ['14'], slots: null, meubles, vendus: new Map(), cleNum });
  dit(sP.etat === 'aRanger' && sP.places === null, 'S2 cases pas lues ⇒ aucune case proposée', sP);
  const sM = suiteAchatScan({ numeros: ['14'], slots: {}, meubles: [], vendus: new Map(), cleNum });
  dit(sM.etat === 'aRanger' && sM.aucunMeuble && sM.places[0] === null, 'S2 aucun meuble ⇒ dit, aucune case inventée', sM);
  const ventes = [{ transaction_id: 555, status: 'Vendu', item_id: 'it15' }, { transaction_id: 556, status: 'Commande annulée', item_id: 'it16' }, { transaction_id: 557, status: 'Vendu' }];
  const fv = { it15: { numero: '15' }, it16: { numero: '16' } };
  const vendus = numerosVendus({ ventes, identiteAnnonce: (o) => o.item_id || null, fiches: fv, corrections: { 557: { numero: '17' } }, annulee: (o) => /annul/i.test(o.status), cleNum });
  const sV = suiteAchatScan({ numeros: ['15'], slots, meubles, vendus, cleNum });
  dit(sV.etat === 'vendue' && sV.vente.tx === '555', 'S3 une vente lue porte ce N° (son annonce) ⇒ « vendue », SA vente', sV);
  dit(suiteAchatScan({ numeros: ['17'], slots, meubles, vendus, cleNum }).etat === 'vendue', 'S3 la correction posée sur une vente ⇒ « vendue »');
  dit(suiteAchatScan({ numeros: ['16'], slots, meubles, vendus, cleNum }).etat !== 'vendue', 'S3 une vente annulée ⇒ pas « vendue »');
  const vPas = numerosVendus({ ventes: null, cleNum });
  const sX = suiteAchatScan({ numeros: ['15'], slots, meubles, vendus: vPas, cleNum });
  dit(vPas === null && sX.etat !== 'vendue' && sX.venteSu === false, 'S3 ventes pas lues ⇒ `venteSu: false`, jamais « vendue »', sX);
  const sL = suiteAchatScan({ numeros: ['30', '31', '32'], slots, meubles, vendus: new Map(), cleNum });
  const iL = (sL.places || []).map((p) => p && p.i);
  dit(sL.etat === 'aRanger' && iL.length === 3 && new Set(iL).size === 3 && !iL.includes(0) && !iL.includes(6), 'S4 un lot de 3 ⇒ 3 cases libres différentes', iL);

  // ── B ──
  const scan = sansCommentaires(lire('src/ScannerRetrouver.jsx'));
  const compta = sansCommentaires(lire('src/ecrans/Comptabilite.jsx'));
  dit(/const suite = React\.useMemo\(\(\) => lireSuite\(e\), \[e\]\);/.test(scan) && /<BlocNumero s=\{suite\}\/>/.test(scan), 'B la fiche d’achat du scanner dit le N° et le geste (`e.suite()`)');
  dit(/suite: \(\) => \{[\s\S]{0,200}numerosDeLAchat\(\{ tx, fiches: numeros/.test(compta) && /numerosVendus\(\{ ventes: Array\.isArray\(sales\.items\)/.test(compta) && /return suiteAchatScan\(/.test(compta), 'B la source d’Achats bâtit la suite par la règle (identité : n° de transaction)');
  // (27 nov., lot scan-ce-matin) À l'ARRIVÉE (au point relais), la caméra lit aussi le code de retrait (une identité exacte) ;
  // le n° de TRANSACTION reste réservé à la saisie (`tape && luId`), et hors arrivée rien ne change.
  dit(/const idPossible = \(tape \|\| arrivee\) && /.test(scan) && /achatParIdentite\(brut, S\.enregistrements\)/.test(scan) && /tape && luId\) \{/.test(scan), 'B l’identité tapée (transaction) seulement pour un n° TAPÉ ; à l’arrivée, le code de retrait aussi à la caméra');

  console.log(ko ? `\n❌ audit-scan-achat-suite : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-scan-achat-suite : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
