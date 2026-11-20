// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU 20 NOV. — L'ARRIVÉE D'UN ACHAT GUIDÉE (lot arrivee-scan). Il EXÉCUTE les règles sur des données
//  INVENTÉES (le dépôt est public). Lecture seule. Récit : docs/passation/2026-11-20-arrivee-scan.md
//
//  S · le scan ⇒ l'achat (src/arriveeAchat.js `achatDuScan`, sur la VRAIE lecture `lireCodeColis`) :
//      S1 50 achats IDENTIQUES (même titre, même prix, même taille) : chaque n° de suivi ⇒ SON achat, jamais un autre ;
//      S2 aucun achat ⇒ « aucun » ; un colis à retirer sans achat ⇒ « sansAchat » ; une VENTE au même n° ne compte pas ;
//      S3 deux achats au même n° ⇒ « plusieurs » (la question), jamais le premier ;
//      S4 le titre seul ne relie rien (un achat sans n° au titre identique ⇒ « aucun ») ; un n° voisin ⇒ « aucun ».
//  N · le N° :
//      N1 un achat déjà rangé (une fiche d'arrivée porte SON n° de transaction) ⇒ « range » (jamais deux fois) ;
//         un N° déjà porté par cet achat ⇒ « attribue » (gardé) ; fiches pas lues ⇒ rien ;
//      N2 le prochain N° : la VRAIE règle `prochainLibre` (extraite de src/App.jsx) par `numerosEnSerie` — après le
//         plus haut, jamais un trou, jamais un N° servi ; un lot de 3 ⇒ 3 N° à la suite ;
//      N3 l'écriture refuse un N° servi entre-temps (`opsRanger` sur les lignes de `lignesArrivee`) et un ancien N°
//         tapé (« B230 ») ; « je numérote moi-même » ⇒ son N° ;
//      N4 le prix écrit : le REÇU de CET achat seulement ; l'article seul ou un lot ⇒ aucun prix.
//  C · les cases : un lot de 3 ⇒ 3 cases différentes (la règle du Stock) ; une case prise ou celle d'une autre paire
//      touchée ⇒ refusée ; un N° déjà en case ⇒ aucune nouvelle case.
//  R · « Arrivés · à ranger » : un achat rangé n'y est plus, un achat noté deux fois n'y est qu'une fois.
//  E · l'étiquette : seulement pour la méthode « imprimée », les N° de CE colis tels quels.
//  B · les branchements (texte du code, commentaires retirés) : « J'ai retiré » ⇒ `ouvrirAtelierArrivee` ⇒ l'écran
//      d'arrivée ; le pool écrit AVANT le geste ; le geste en 10 s ; le scanner de l'arrivée passe par `achatDuScan`.
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
const imp = (rel) => import(pathToFileURL(path.join(RACINE, 'src', rel)).href);
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const MUTATIONS = [
  ['src/arriveeAchat.js', "L.filter((e) => e.sorte === 'achat')", "L", 'S2 : une vente au même n° prise pour l’achat'],
  ['src/arriveeAchat.js', "if (r.etat === 'un' || r.etat === 'plusieurs') return r;", "if (r.etat === 'plusieurs') return { etat: 'un', lu, trouve: r.trouves[0] }; if (r.etat === 'un') return r;", 'S3 : deux achats ⇒ le premier choisi seul'],
  ['src/arriveeAchat.js', "if (c.etat === 'un' || c.etat === 'plusieurs') return { etat: 'sansAchat', lu };", "", 'S2 : un colis sans achat dit « aucun »'],
  ['src/scanColis.js', "return s === lu.suivi;", "return s.slice(0, 6) === lu.suivi.slice(0, 6);", 'S1 : un n° qui RESSEMBLE relie'],
  ['src/arriveeAchat.js', "if (deja.length) return { su: true, etat: 'range',", "if (false) return { su: true, etat: 'range',", 'N1 : un achat rangé deux fois'],
  ['src/arriveeAchat.js', "if (!estObjet(fiches)) return { su: false };", "if (!estObjet(fiches)) fiches = {};", 'N1 : une lecture ratée vaut « rien »'],
  ['src/App.jsx', "for (const x of prisInt) { const n = Number(x); if (Number.isFinite(n) && n >= c) c = n + 1; }", "while (prisInt.has(c)) c++;", 'N2 : un trou redonné'],
  ['src/arriveeAchat.js', "&& prixRecu && prixRecu.source === 'recu'", "&& prixRecu", 'N4 : le prix de l’article seul écrit comme payé'],
  ['src/arriveeAchat.js', "const recu = nums.length === 1 && Number(n || 1) === 1", "const recu = true", 'N4 : le prix d’un lot posé sur la 1re paire'],
  ['src/arriveeAchat.js', "const autres = (Array.isArray(cases) ? cases : []).filter((c, j) => j !== k && c);", "const autres = [];", 'C1 : deux paires dans la même case'],
  ['src/arriveeAchat.js', "if (!c || slots[c] || !place || place.meubleId == null) return null;", "if (!c || !place || place.meubleId == null) return null;", 'C2 : un N° déjà en case reçoit une 2e case'],
  ['src/arriveeAchat.js', "&& !ranges.has(str(p.tx))", "", 'R1 : un achat rangé reste « à ranger »'],
  ['src/arriveeAchat.js', "if (!methode || methode.support !== 'imprimee') return null;", "if (!methode) return null;", 'E1 : une étiquette proposée à qui écrit à la main'],
  ['src/App.jsx', "if (typeof d.prendre === 'function') d.prendre(); setArrivees({", "if (typeof d.prendre === 'function') d.prendre(); setEntrees(d.entrees); if (0) setArrivees({", 'B1 : « J’ai retiré » rouvre l’atelier d’avant'],
  ['src/App.jsx', "gesteVrm(texte, [...r.ops, ...retire], {}, () => relire([CLE_FICHES_RANGEES, 'vrm_slots', 'vinted_buyprice_by_num', ...clesRetire]), 'arrivee.ranger', null, null, duree);", "gesteVrm(texte, [...r.ops], {}, () => relire([CLE_FICHES_RANGEES, 'vrm_slots', 'vinted_buyprice_by_num', ...clesRetire]), 'arrivee.ranger');", 'B2 : le retrait oublié, « Annuler » 5 s'],
];
function prouver() {
  let rouges = 0;
  for (const [f, a, b, quoi] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arrivee-mut-'));
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
  let A, SC, RA, NE;
  try { [A, SC, RA, NE] = await Promise.all(['arriveeAchat.js', 'scanColis.js', 'rangementArrivee.js', 'numeroEcrit.js'].map(imp)); }
  catch (e) { dit(false, 'C0 · la règle de l’arrivée (src/arriveeAchat.js) existe', e.message); console.log(`\n❌ audit-arrivee-scan : ${ko} rouge(s)`); process.exit(1); }
  const cleNum = NE.cleNumero;
  const TITRE = 'Nike Dunk Low Panda 42 noir';
  const mr = (k) => String(41000000 + k * 7);
  const achat = (k, suivis) => ({ sorte: 'achat', site: 'vinted', cle: 'a:' + (9400 + k), titre: TITRE, prix: 45, taille: '42', suivis });
  const lu = (n) => SC.lireCodeColis(n);

  // ════════ S · LE SCAN ⇒ L'ACHAT ═══════════════════════════════════════════
  {
    const E = Array.from({ length: 50 }, (_, k) => achat(k, [mr(k)]));
    const bad = [];
    for (let k = 0; k < 50; k++) { const r = A.achatDuScan(lu(mr(k)), E); if (r.etat !== 'un' || r.trouve.cle !== 'a:' + (9400 + k)) bad.push({ k, r: r.etat, c: r.trouve && r.trouve.cle }); }
    dit(bad.length === 0, 'S1 · 50 achats identiques : chaque n° de suivi ⇒ SON achat, jamais un autre', bad.slice(0, 3));
    const qr = A.achatDuScan(lu(`https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRVINTED&exp=${mr(17)}&language=FR`), E);
    dit(qr.etat === 'un' && qr.trouve.cle === 'a:9417', 'S1b · le QR Mondial Relay de l’étiquette ⇒ le même achat (même n°)', qr.etat);
    const vente = [{ sorte: 'vente', site: 'vinted', cle: 'v:1', titre: TITRE, suivis: ['48880001'] }];
    const r1 = A.achatDuScan(lu('48880001'), [...E, ...vente]);
    dit(r1.etat === 'aucun', 'S2a · une VENTE au même n° n’est pas un colis reçu ⇒ « aucun achat »', r1.etat);
    const r2 = A.achatDuScan(lu('48880002'), [...E, { sorte: 'colis', site: 'vinted', cle: 'r:e:x', titre: 'Colis à retirer', suivis: ['48880002'] }]);
    dit(r2.etat === 'sansAchat', 'S2b · un colis à retirer sans achat relié ⇒ « relié à aucun achat » (dit, jamais deviné)', r2.etat);
    const r3 = A.achatDuScan(lu('48889999'), E);
    dit(r3.etat === 'aucun', 'S2c · un n° que VRM ne connaît pas ⇒ « aucun »', r3.etat);
    const r4 = A.achatDuScan(lu(mr(3)), [...E, achat(77, [mr(3)])]);
    dit(r4.etat === 'plusieurs' && r4.trouves.length === 2, 'S3 · deux achats au même n° ⇒ la question (« plusieurs »), jamais le premier', r4.etat);
    const r5 = A.achatDuScan(lu('48881111'), [achat(90, []), { ...achat(91, []), titre: '48881111' }]);
    dit(r5.etat === 'aucun', 'S4a · un titre identique (ou égal au n°) ne relie rien', r5.etat);
    const r6 = A.achatDuScan(lu(String(Number(mr(5)) + 1)), E);
    dit(r6.etat === 'aucun' || (r6.etat === 'un' && r6.trouve.cle !== 'a:9405'), 'S4b · un n° voisin ne désigne pas l’achat voisin', r6.etat);
    dit(A.achatDuScan(null, E).etat === 'pasReconnu', 'S4c · un code illisible ⇒ « pas reconnu », rien de cherché');
  }

  // ════════ N · LE N° ═══════════════════════════════════════════════════════
  {
    const fiches = { a1: { id: 'a1', numero: '13', origine: 'arrivee', achat: { tx: '9401' } } };
    const n1 = A.numeroArrivee({ tx: '9401', fiches });
    dit(n1.su && n1.etat === 'range' && n1.fiches[0].numero === '13', 'N1a · un achat déjà rangé ⇒ « déjà rangé · N°13 » (jamais une 2e fois)', n1);
    const n2 = A.numeroArrivee({ tx: '9402', fiches, numsAchat: ['B230'] });
    dit(n2.su && n2.etat === 'attribue' && n2.numeros[0] === 'B230', 'N1b · un N° déjà porté par CET achat ⇒ gardé tel quel', n2);
    const n3 = A.numeroArrivee({ tx: '9403', fiches });
    dit(n3.su && n3.etat === 'nouveau', 'N1c · un achat sans N° ⇒ le prochain N°', n3);
    dit(!A.numeroArrivee({ tx: '9401', fiches: null }).su && !A.numeroArrivee({ tx: '9401', fiches: undefined }).su, 'N1d · fiches pas lues ⇒ rien de proposé (« pas su » n’est pas « rien »)');
    const n4 = A.numeroArrivee({ tx: '9404', fiches: { b: { id: 'b', numero: '20', origine: 'arrivee', achat: { tx: '9405' } }, c: { id: 'c', numero: '21', origine: 'arrivee', titre: TITRE, achat: { tx: '' } } } });
    dit(n4.etat === 'nouveau', 'N1e · la fiche d’un AUTRE achat (ou au même titre) ne rend pas celui-ci « rangé »', n4);

    // N2 — la VRAIE règle prochainLibre (src/App.jsx).
    const app = lire('src/App.jsx');
    const m = /const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/.exec(app);
    let prochainLibre = null; try { prochainLibre = m ? new Function(m[0] + '\nreturn prochainLibre;')() : null; } catch (_) { prochainLibre = null; }
    dit(typeof prochainLibre === 'function', 'N2a · la règle `prochainLibre` de l’app est lue');
    if (prochainLibre) {
      const int = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12];   // un TROU au 5 (peut-être écrit sur un carton)
      const pris = { int, cles: int.map(String) };
      const un = RA.numerosEnSerie({ pris, n: 1, prochainLibre, cleNum });
      dit(Array.isArray(un) && un[0] === '13', 'N2b · le prochain N° part du plus haut (13), jamais du trou (5)', un);
      const trois = RA.numerosEnSerie({ pris, n: 3, prochainLibre, cleNum });
      dit(Array.isArray(trois) && trois.join(',') === '13,14,15', 'N2c · un lot de 3 ⇒ 13, 14, 15 (un par un, à la suite)', trois);
      const pref = RA.numerosEnSerie({ pris: { int: [], cles: ['C1', 'C2', 'B230'] }, pref: 'C', n: 1, prochainLibre, cleNum });
      dit(Array.isArray(pref) && pref[0] === 'C3', 'N2d · la série de la méthode (lettre « C ») ⇒ C3 ; l’archive B ne compte pas', pref);
      dit(!un.includes('5') && !trois.some((x) => int.includes(Number(x))), 'N2e · aucun N° servi n’est repris');
    }
    // N3 — l'écriture refuse un N° servi entre-temps.
    const entree = { tx: '9406', titre: TITRE, prix: 45, taille: '42', site: 'vinted' };
    const lignes = A.lignesArrivee({ entree, numeros: ['13'], cases: [null], n: 1 });
    const pris13 = new Set(['13']);
    const r = RA.opsRanger({ lignes, achat: entree, fiches: {}, slots: {}, couts: {}, meubles: [], pris: pris13, cleNum, ids: ['x'] });
    dit(!r.ok && r.raison === 'pris', 'N3a · un N° servi entre-temps (autre appareil) ⇒ refusé, rien d’écrit', r);
    const r2 = RA.opsRanger({ lignes, achat: entree, fiches: {}, slots: {}, couts: {}, meubles: [], pris: new Set(), cleNum, ids: ['x'] });
    dit(r2.ok && r2.fiches[0].numero === '13' && r2.fiches[0].achat.tx === '9406', 'N3b · le N° libre ⇒ la fiche liée à CET achat (son n° de transaction)', r2.ok ? r2.fiches[0] : r2);
    const deux = RA.opsRanger({ lignes, achat: entree, fiches: r2.ok ? { x: r2.fiches[0] } : {}, slots: {}, couts: {}, meubles: [], pris: new Set(), cleNum, ids: ['y'] });
    dit(!deux.ok && deux.raison === 'deja', 'N3c · le même achat rangé une 2e fois ⇒ refusé (« déjà »)', deux);
    const arch = RA.validerNumeroTape('B230', { pris: new Set(), archive: 'B', cleNum });
    const tape = RA.validerNumeroTape('412', { pris: new Set(['13']), archive: 'B', cleNum });
    dit(!arch.ok && arch.raison === 'archive' && tape.ok, 'N3d · « je numérote moi-même » : un ancien N° (B230) refusé, le sien (412) accepté', { arch, tape });
    // N4 — le prix.
    const recu = { centimes: 5190, source: 'recu', tx: '9406' };
    const lr = A.lignesArrivee({ entree, numeros: ['13'], cases: [null], n: 1, prixRecu: recu });
    const la = A.lignesArrivee({ entree, numeros: ['13'], cases: [null], n: 1, prixRecu: { centimes: 4500, source: 'achat', tx: '9406' } });
    const ll = A.lignesArrivee({ entree: { ...entree, lot: true, n: 3, prix: 120 }, numeros: ['13', '14', '15'], cases: [null, null, null], n: 3, prixRecu: recu });
    dit(lr && lr[0].prix === '51,90', 'N4a · le REÇU de CET achat ⇒ 51,90 posé', lr && lr[0]);
    dit(la && la[0].prix === '', 'N4b · l’article seul (sans port ni frais) n’est pas écrit comme payé', la && la[0]);
    dit(ll && ll.length === 3 && ll.every((l) => l.prix === ''), 'N4c · un lot ⇒ aucun prix, jamais divisé', ll);
    dit(A.lignesArrivee({ entree, numeros: ['13', ''], n: 2 }) === null, 'N4d · un N° vide ⇒ rien d’écrit');
  }

  // ════════ C · LES CASES ═══════════════════════════════════════════════════
  {
    const meubles = [{ id: 'm1', name: 'Étagère A', cols: 3, rows: 2 }];
    const slots = { 1: { m: 'm1', i: 0 } };
    const c = A.casesArrivee({ meubles, slots, numeros: ['13', '14', '15'], cleNum });
    const cles = c.su ? c.cases.map((x) => x && `${x.meubleId}:${x.i}`) : [];
    dit(c.su && new Set(cles).size === 3 && !cles.includes('m1:0'), 'C1a · un lot de 3 ⇒ 3 cases différentes, jamais une case prise', cles);
    const pris = A.autreCase({ meubles, slots, cases: c.cases, k: 0, m: 'm1', i: 0 });
    const autre = A.autreCase({ meubles, slots, cases: c.cases, k: 0, m: 'm1', i: c.cases[1].i });
    const libre = A.autreCase({ meubles, slots, cases: c.cases, k: 0, m: 'm1', i: 5 });
    dit(pris === null && autre === null && libre && libre.i === 5, 'C1b · toucher une case prise ou celle d’une autre paire ⇒ refusé ; une libre ⇒ acceptée', { pris, autre, libre });
    dit(!A.casesArrivee({ meubles, slots: null, numeros: ['13'], cleNum }).su, 'C1c · cases pas lues ⇒ rien de proposé');
    const op = A.opCaseNumero({ slots: { B230: { m: 'm1', i: 2 } }, numero: 'B230', place: { meubleId: 'm1', i: 4 }, meubles, cleNum });
    const op2 = A.opCaseNumero({ slots, numero: 'B231', place: { meubleId: 'm1', i: 4 }, meubles, cleNum });
    dit(op === null && op2 && op2.id === 'B231' && op2.apres.i === 4, 'C2 · un N° déjà en case n’en reçoit pas une 2e ; sinon SA case', { op, op2 });
    const rng = RA.opsRanger({ lignes: A.lignesArrivee({ entree: { tx: '9500', titre: 'x' }, numeros: ['16'], cases: [{ meubleId: 'm1', i: 0 }], n: 1 }), achat: { tx: '9500' }, fiches: {}, slots, couts: {}, meubles, pris: new Set(), cleNum, ids: ['z'] });
    dit(!rng.ok && rng.raison === 'case', 'C3 · une case prise entre-temps ⇒ l’écriture refuse (rien d’écrasé)', rng);
  }

  // ════════ R · ARRIVÉS À RANGER ════════════════════════════════════════════
  {
    const T = Date.parse('2026-11-20T10:00:00Z');
    const notes = { 9401: { tx: '9401', titre: TITRE, at: T - 3600e3 }, 9402: { tx: '9402', titre: TITRE, at: T - 7200e3 }, 9403: { tx: '9403', at: T - 30 * 864e5 } };
    const fiches = { a: { id: 'a', numero: '13', origine: 'arrivee', achat: { tx: '9401' } } };
    const l = A.arrivesARanger({ notes, fiches, maintenant: T });
    dit(l.length === 1 && l[0].tx === '9402', 'R1 · un achat rangé n’est plus « à ranger » ; une note de 30 jours non plus', l.map((x) => x.tx));
    dit(A.arrivesARanger({ notes, fiches: null, maintenant: T }).length === 0, 'R2 · fiches pas lues ⇒ rien (on ne dit pas « à ranger » sans savoir)');
  }

  // ════════ E · L'ÉTIQUETTE ═════════════════════════════════════════════════
  {
    const lg = [{ numero: '13', titre: TITRE }, { numero: '14', titre: TITRE }];
    dit(A.etiquettesArrivee({ support: 'main' }, lg) === null && A.etiquettesArrivee(null, lg) === null, 'E1a · écrite à la main (ou pas choisie) ⇒ aucune impression proposée');
    const e = A.etiquettesArrivee({ support: 'imprimee', format: '62x29', titre: true }, lg);
    dit(e && e.format === '62x29' && e.etiquettes.map((x) => x.num).join(',') === '13,14', 'E1b · imprimée ⇒ les N° de CE colis, tels quels, au format choisi', e);
  }

  // ════════ B · LES BRANCHEMENTS ════════════════════════════════════════════
  {
    const app = sansCommentaires(lire('src/App.jsx'));
    const sr = sansCommentaires(lire('src/ScannerRetrouver.jsx'));
    const jsx = sansCommentaires(lire('src/ArriveeAchat.jsx'));
    dit(/const markCollected = \(t\) => \{[^\n]*apresRetraitAtelier\(entreeArriveeColis\(t\)\)/.test(app) && /ouvrirAtelierArrivee\(\[e\]\)/.test(app), 'B1a · « J’ai retiré » enchaîne sur l’arrivée de CET achat (`ouvrirAtelierArrivee`)');
    dit(/'vrm:atelier-numeroter'[\s\S]{0,400}/.test(app) && /d\.prendre\(\); setArrivees\(\{ file: d\.entrees/.test(app) && !/'vrm:atelier-numeroter'[^\n]*\n?[^\n]*setEntrees\(d\.entrees\)/.test(app) && /<ArriveeAchatLazy /.test(app), 'B1b · l’événement de « J’ai retiré » ouvre l’ÉCRAN D’ARRIVÉE');
    const f = /async function ecrireArrivee\([\s\S]*?\n\}/.exec(app);
    const corps = f ? f[0] : '';
    const iPool = corps.indexOf("save('vinted_used_numeros'"), iGeste = corps.lastIndexOf('gesteVrm(texte');
    dit(iPool > 0 && iGeste > iPool && /numerosServisLus\(\)/.test(corps) && /if \(!pris\) return \{ ok: false, raison: 'lecture' \}/.test(corps), 'B2a · « Ranger ici » relit les N° servis (lecture ratée ⇒ rien), écrit le pool AVANT le geste annulable');
    dit(/\.\.\.r\.ops, \.\.\.retire\]/.test(corps) && /null, null, duree\)/.test(corps) && /DUREE_ANNULER_ARRIVEE = 10000/.test(lire('src/arriveeAchat.js')), 'B2b · un seul geste (fiche, case, prix du reçu, retrait), « Annuler » 10 s');
    dit(/arrivee\) \{[\s\S]{0,600}achatDuScan\(lu, S\.enregistrements\)/.test(sr), 'B3 · le scanner de l’arrivée passe par `achatDuScan` (achats seulement, n° exact)');
    dit(!/fetch\(|save\(|localStorage\.setItem/.test(jsx), 'B4 · l’écran d’arrivée n’écrit rien lui-même (la coque écrit sur SON toucher)');
    dit(/horsLigne/.test(corps) && /noterArrivees\(\[sansFonctions\(e\)\]\)/.test(corps), 'B5 · hors ligne : aucun N° donné, l’arrivée notée, le retrait dans la file');
    dit(/indexHorsLigne === 'function' && typeof navigator !== 'undefined' && navigator\.onLine === false/.test(sr) && /if \(arrivee && achatsLus\(S\)\)/.test(sr), 'B6 · l’index de l’appareil ne sert QUE hors ligne (en ligne, les vraies sources sont relues)');
  }

  console.log(`\n${ko ? '❌' : '✅'} audit-arrivee-scan : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
