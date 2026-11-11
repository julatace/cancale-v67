// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — RANGER UN ACHAT À SON ARRIVÉE (11 nov. 2026, lot rangement-guide)
//
//  EXÉCUTE les vraies règles (aucune copie), sur des données INVENTÉES (dépôt public) :
//    N · le N° proposé    src/rangementArrivee.js + le VRAI `prochainLibre` d'App.jsx :
//                         après le plus haut, jamais un trou, jamais un N° servi, N à la suite
//    T · le N° tapé       « Je numérote moi-même » : un N° servi, l'archive « B », un doublon ⇒ refusés
//    C · la case          première libre à la suite de la dernière case rangée, meuble empilé
//                         respecté, une case prise (même par un N° parti) jamais proposée
//    L · l'achat          prix LU seulement, lot ⇒ N lignes sans prix divisé tout seul
//    E · « Rangé »        fiche liée au n° de transaction, case, coût ; refus plutôt qu'écrasement
//    A · App.jsx          pool avant le geste, jamais retiré par « Annuler », branchements
//
//  `--prouve` (§6.1) : (1) les mêmes contrôles sur origin/main (ou `--avant <ref>`) :
//  rouges ; (2) des MUTATIONS, une à la fois, sur une copie : chacune rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.RANGER_RACINE || path.join(__dirname, '..');
const FICHIERS = ['rangementArrivee.js', 'stockSortie.js', 'stockRegles.js', 'App.jsx'];
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

async function controles(racine, silencieux) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, msg, d) => { if (c) ok++; else { ko++; rouges.push(msg); } if (!silencieux) console.log((c ? '✅ ' : '❌ ') + msg + (!c && d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 260) : '')); };
  const essai = (msg, f) => { try { const r = f(); dit(r === true, msg, r === true ? undefined : r); } catch (e) { dit(false, msg, e && e.message); } };
  let R = {}; try { R = await import(pathToFileURL(path.join(racine, 'src', 'rangementArrivee.js')).href + '?t=' + Date.now() + Math.random()); } catch (e) { R = { __erreur: String(e && e.message || e).slice(0, 160) }; }
  let APP = ''; try { APP = require('./_source-app.cjs').sourceAppDe(path.join(racine, 'src', 'App.jsx')); } catch (_) { try { APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8'); } catch (__) {} }
  dit(typeof R.numerosEnSerie === 'function' && typeof R.casesEnSerie === 'function' && typeof R.opsRanger === 'function', 'src/rangementArrivee.js se charge', R.__erreur);
  let prochainLibre = null;
  try { const x = /const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/.exec(APP); prochainLibre = x ? new Function(x[0] + '\nreturn prochainLibre;')() : null; } catch (_) { prochainLibre = null; }
  dit(typeof prochainLibre === 'function', 'N0 · le VRAI `prochainLibre` extrait d’App.jsx');
  if (typeof R.numerosEnSerie !== 'function' || typeof prochainLibre !== 'function') return { ok, ko, rouges };

  // ── N : le N° proposé ──
  const pris = (l) => ({ int: new Set(l.filter((x) => /^\d+$/.test(String(x))).map(Number)), cles: new Set(l.map(cleNum)) });
  essai('N1 · servis 1…7, 9, 12 ⇒ le suivant est 13 (après le plus haut, jamais le trou 8, 10 ou 11)', () => {
    const r = R.numerosEnSerie({ pris: pris([1, 2, 3, 4, 5, 6, 7, 9, 12]), n: 1, prochainLibre, cleNum }); return JSON.stringify(r) === '["13"]' || r; });
  essai('N2 · un lot de 3 ⇒ 13, 14, 15 (consécutifs, aucun servi)', () => {
    const r = R.numerosEnSerie({ pris: pris([1, 9, 12]), n: 3, prochainLibre, cleNum }); return JSON.stringify(r) === '["13","14","15"]' || r; });
  essai('N3 · les anciens « B230 » ne comptent pas dans la nouvelle série, ne sont jamais redonnés', () => {
    const r = R.numerosEnSerie({ pris: pris(['B230', 'B231', 4]), n: 2, prochainLibre, cleNum }); return JSON.stringify(r) === '["5","6"]' || r; });
  essai('N4 · une série à lettres (« C ») : après son plus haut', () => {
    const r = R.numerosEnSerie({ pris: pris(['C3', 'C7', 40]), pref: 'C', n: 2, prochainLibre, cleNum }); return JSON.stringify(r) === '["C8","C9"]' || r; });
  essai('N5 · une règle qui rendrait un N° servi ⇒ null (rien n’est proposé)', () => R.numerosEnSerie({ pris: pris([3]), n: 1, prochainLibre: () => '3', cleNum }) === null);
  essai('N6 · les servis ne sont pas modifiés (copie)', () => { const p = pris([1, 2]); R.numerosEnSerie({ pris: p, n: 3, prochainLibre, cleNum }); return p.int.size === 2 && p.cles.size === 2; });

  // ── T : le N° tapé ──
  const S = new Set(['5', '12', 'B230']);
  essai('T1 · N° tapé déjà servi ⇒ refusé « pris »', () => R.validerNumeroTape('12', { pris: S, cleNum }).raison === 'pris');
  essai('T2 · « 012 » = « 12 » (même identité cleNum) ⇒ refusé', () => R.validerNumeroTape('012', { pris: S, cleNum }).raison === 'pris');
  essai('T3 · la série d’archive « B » ⇒ refusée, même libre', () => R.validerNumeroTape('B999', { pris: S, archive: 'B', cleNum }).raison === 'archive');
  essai('T4 · deux lignes au même N° ⇒ refusé', () => R.validerNumeroTape('40', { pris: S, cleNum, autres: ['40'] }).raison === 'double');
  essai('T5 · N° libre ⇒ accepté', () => R.validerNumeroTape('41', { pris: S, archive: 'B', cleNum }).ok === true);
  essai('T6 · servis pas lus ⇒ pas accepté (« pas su » ≠ « libre »)', () => R.validerNumeroTape('41', { pris: null, cleNum }).ok === false);

  // ── C : la case ──
  const A = { id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }, B = { id: 'mB', name: 'Bac B', cols: 2, rows: 3, gravite: true };
  essai('C1 · sans habitude : la première case libre (lecture), une case prise par un N° PARTI reste prise', () => {
    const r = R.casesEnSerie({ meubles: [A], slots: { 'B230': { m: 'mA', i: 0 } }, n: 1 }); return (r.cases[0] && r.cases[0].i === 1) || r; });
  essai('C2 · habitude (dernière case rangée mA:3) ⇒ la suivante mA:4, puis mA:5 pour un lot', () => {
    const fiches = { f: { origine: 'arrivee', case: { m: 'mA', i: 3 }, rangeAt: '2026-11-10' } };
    const h = R.caseHabitude({ fiches, meubles: [A] });
    const r = R.casesEnSerie({ meubles: [A], slots: { 7: { m: 'mA', i: 3 } }, n: 2, habitude: h }); return JSON.stringify(r.cases.map((c) => c && c.i)) === '[4,5]' || r; });
  essai('C3 · meuble empilé : seule la case la plus basse libre d’une colonne (jamais une case en l’air)', () => {
    const r = R.casesEnSerie({ meubles: [B], slots: {}, n: 3 }); return JSON.stringify(r.cases.map((c) => c && c.i)) === '[4,5,2]' || JSON.stringify(r.cases.map((c) => c && c.i)); });
  essai('C4 · plan pas lu ⇒ rien proposé ; aucun meuble ⇒ « sans case », jamais une case inventée', () => {
    const a = R.casesEnSerie({ meubles: null, slots: {}, n: 1 }), b = R.casesEnSerie({ meubles: [], slots: {}, n: 2 });
    return a.cases === null && b.aucunMeuble === true && b.cases.every((c) => c === null); });
  essai('C5 · plein ⇒ null pour la ligne (dit « plus de case libre »)', () => {
    const sl = {}; for (let i = 0; i < 6; i++) sl['x' + i] = { m: 'mA', i };
    const r = R.casesEnSerie({ meubles: [A], slots: sl, n: 1 }); return r.cases[0] === null; });
  essai('C6 · toucher une case prise ou celle d’une autre ligne ⇒ refusé ; une libre ⇒ acceptée', () =>
    R.caseChoisie({ meubles: [A], slots: { 3: { m: 'mA', i: 2 } }, m: 'mA', i: 2 }) === null
    && R.caseChoisie({ meubles: [A], slots: {}, m: 'mA', i: 1, autres: [{ meubleId: 'mA', i: 1 }] }) === null
    && !!R.caseChoisie({ meubles: [A], slots: {}, m: 'mA', i: 1 }));
  essai('C7 · la case dite « meuble · niveau · case »', () => R.caseEnMots({ meuble: 'Étagère A', rangee: 2, colonne: 3 }) === 'Étagère A · niveau 2 · case 3');

  // ── L : l'achat ⇒ les lignes ──
  essai('L1 · achat simple : titre, taille, prix LU repris tels quels (modifiables), marque lue par la règle', () => {
    const l = R.lignesDeLAchat({ tx: '880001', titre: 'Nike Air Max 90 42', prix: { amount: '40.5' }, taille: '42' }, { marqueDe: (t) => /nike/i.test(t) ? 'Nike' : '' });
    return (l.length === 1 && l[0].prix === '40,5' && l[0].taille === '42' && l[0].marque === 'Nike') || l; });
  essai('L2 · prix pas lu ⇒ vide (jamais deviné)', () => R.lignesDeLAchat({ tx: '1', titre: 'x', prix: null })[0].prix === '');
  essai('L3 · lot de 3 sans détail ⇒ 3 lignes, AUCUN prix posé (l’indication seulement)', () => {
    const l = R.lignesDeLAchat({ tx: '2', titre: 'Lot de 3 paires', prix: 60, lot: true, n: 3 }, { n: 3 });
    return (l.length === 3 && l.every((x) => x.prix === '' && x.indicatif === '20')) || l; });

  // ── E : « Rangé » ──
  const base = () => ({ fiches: {}, slots: { 9: { m: 'mA', i: 0 } }, couts: {}, meubles: [A], pris: new Set(['9', '12']), cleNum });
  essai('E1 · une ligne ⇒ fiche (n° de transaction gardé), case, coût — et rien d’autre', () => {
    const r = R.opsRanger({ ...base(), lignes: [{ numero: '13', titre: 'Nike', prix: '40', case: { meubleId: 'mA', i: 1 } }], achat: { tx: '880001', suivi: 'XY123' }, ids: ['f1'], maintenant: 'T' });
    if (!r.ok) return r;
    const f = r.ops.find((o) => o.k === 'vrm_fiches_neuves');
    return (r.ops.length === 3 && f.apres.achat.tx === '880001' && f.apres.achat.suivi === 'XY123' && f.apres.numero === '13' && f.apres.prixAchat === 40
      && r.ops.some((o) => o.k === 'vrm_slots' && o.id === '13' && o.apres.i === 1) && r.ops.some((o) => o.k === 'vinted_buyprice_by_num' && o.apres === '40')
      && r.ops.every((o) => o.avant === undefined)) || r.ops; });
  essai('E2 · N° déjà servi entre-temps ⇒ refus, aucune écriture', () => { const r = R.opsRanger({ ...base(), lignes: [{ numero: '12' }], achat: { tx: '1' }, ids: ['f'] }); return r.ok === false && r.raison === 'pris'; });
  essai('E3 · N° d’une case déjà notée (sur un carton) ⇒ refus', () => { const r = R.opsRanger({ ...base(), pris: new Set(), lignes: [{ numero: '9' }], achat: { tx: '1' }, ids: ['f'] }); return r.ok === false && r.raison === 'pris'; });
  essai('E4 · case prise entre-temps ⇒ refus', () => { const r = R.opsRanger({ ...base(), lignes: [{ numero: '13', case: { meubleId: 'mA', i: 0 } }], achat: { tx: '1' }, ids: ['f'] }); return r.ok === false && r.raison === 'case'; });
  essai('E5 · deux lignes au même N° ou à la même case ⇒ refus', () => {
    const a = R.opsRanger({ ...base(), lignes: [{ numero: '13' }, { numero: '13' }], achat: { tx: '1' }, ids: ['a', 'b'] });
    const b = R.opsRanger({ ...base(), lignes: [{ numero: '13', case: { meubleId: 'mA', i: 2 } }, { numero: '14', case: { meubleId: 'mA', i: 2 } }], achat: { tx: '1' }, ids: ['a', 'b'] });
    return a.raison === 'double' && b.raison === 'case'; });
  essai('E6 · un achat déjà rangé (une fiche porte SON n° de transaction) ⇒ rien d’écrit deux fois', () => {
    const r = R.opsRanger({ ...base(), fiches: { x: { origine: 'arrivee', achat: { tx: '880001' }, numero: '13' } }, lignes: [{ numero: '14' }], achat: { tx: '880001' }, ids: ['f'] }); return r.ok === false && r.raison === 'deja'; });
  essai('E7 · un coût déjà posé sur ce N° n’est jamais écrasé', () => {
    const r = R.opsRanger({ ...base(), couts: { 13: '55' }, lignes: [{ numero: '13', prix: '40' }], achat: { tx: '1' }, ids: ['f'] }); return r.ok && !r.ops.some((o) => o.k === 'vinted_buyprice_by_num'); });
  essai('E8 · lecture ratée (cases pas lues) ⇒ refus', () => R.opsRanger({ ...base(), slots: null, lignes: [{ numero: '13' }], achat: { tx: '1' }, ids: ['f'] }).raison === 'lecture');
  essai('E9 · lot : fiches liées à la MÊME transaction, ligne k sur N', () => {
    const r = R.opsRanger({ ...base(), lignes: [{ numero: '13' }, { numero: '14' }], achat: { tx: '7' }, ids: ['a', 'b'] });
    return (r.ok && r.fiches.map((f) => f.achat.tx + ':' + f.achat.ligne + '/' + f.achat.sur).join() === '7:1/2,7:2/2') || r; });
  essai('E10 · les propositions déjà rangées, « faites » ou vieilles de 14 j ne sont plus proposées', () => {
    const now = Date.parse('2026-11-11');
    const l = R.achatsARanger({ proposes: { a: { tx: 'a', at: now }, b: { tx: 'b', at: now, fait: 1 }, c: { tx: 'c', at: now - 15 * 86400000 }, d: { tx: 'd', at: now } }, fiches: { f: { origine: 'arrivee', achat: { tx: 'd' } } }, maintenant: now });
    return l.map((x) => x.tx).join() === 'a' || l.map((x) => x.tx).join(); });
  essai('E11 · rattrapage : les N° rangés absents du pool sont à réserver (append-only)', () =>
    JSON.stringify(R.numerosAReserver({ fiches: { a: { origine: 'arrivee', numero: '13' }, b: { origine: 'arrivee', numero: '14' }, c: { numero: '99' } }, pool: [1, 13], cleNum })) === '["14"]');

  // ── A : App.jsx ──
  const f = (APP.match(/async function ecrireRangement[\s\S]*?\n}\n/) || [''])[0];
  essai('A1 · « Rangé » : le pool est écrit AVANT le geste annulable, et jamais dans ses opérations', () => {
    const iP = f.indexOf("save('vinted_used_numeros'"), iG = f.indexOf('gesteVrm(');
    return (iP > 0 && iG > iP && !/k:\s*'vinted_used_numeros'/.test(f)) || { iP, iG }; });
  essai('A2 · les N° servis relus (réservés de l’extension compris) avant de proposer et avant d’écrire', () =>
    /async function numerosServisRangement[\s\S]*panel_num_reserves[\s\S]*numerosReserves\(/.test(APP) && (APP.match(/await numerosServisRangement\(\)/g) || []).length >= 2);
  essai('A3 · « J’ai retiré » (colis et commande Vinted) ouvre la feuille ; au comptoir elle attend la fermeture', () =>
    /const markCollected = \(t\) => \{[^\n]*apresRetrait\(entreeRangementColis\(t\)\)/.test(APP) && /const markPickupDone = \(o\) => \{[^\n]*apresRetrait\(entreeRangementVinted\(o\)\)/.test(APP) && /if \(scanOuvert \|\| relaisOuvert\) \{ retraitsARanger\.current\.push/.test(APP));
  essai('A4 · l’achat d’un colis par IDENTITÉ seulement (`achatDuColis`)', () => /const entreeRangementColis = \(t\) => \{[\s\S]{0,200}achatDuColis\(t, buysBase, indexSuivisAchats\)/.test(APP));
  essai('A5 · la feuille est montée et la carte de Ma journée existe', () => /<RangerAchatCoque\/>/.test(APP) && /id: 'achats-a-ranger'/.test(APP));
  essai('A6 · les fiches à publier comptent comme N° servis partout (`ajouterNumerosHorsEcran`)', () => /const ajouterNumerosHorsEcran = [\s\S]{0,900}vrm_fiches_neuves/.test(APP));
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['prochainLibre comble les trous (App.jsx)', 'src/App.jsx', 'for (const x of prisInt) { const n = Number(x); if (Number.isFinite(n) && n >= c) c = n + 1; }', 'while (prisInt.has(c)) c++;'],
  ['un N° servi réattribué (garde de la série retirée)', 'src/rangementArrivee.js', 'if (!c || avant.has(c) || out.some((x) => cleNum(x) === c)) return null;', 'if (!c) return null;'],
  ['N° tapé déjà servi accepté', 'src/rangementArrivee.js', "if (pris.has(c)) return { ok: false, raison: 'pris' };\n  if ((autres", 'if ((autres'],
  ['archive « B » acceptée', 'src/rangementArrivee.js', "if (archive && new RegExp('^' + archive + '\\\\d+$').test(c)) return { ok: false, raison: 'archive' };", ''],
  ['« Rangé » écrase un N° servi', 'src/rangementArrivee.js', "if (pris.has(c) || slots[c]) return { ok: false, raison: 'pris', ligne: k };", ''],
  ['case prise proposée', 'src/rangementArrivee.js', '  if (prise(i)) return false;\n  if (m.gravite)', '  if (m.gravite)'],
  ['gravité ignorée', 'src/rangementArrivee.js', 'if (!fond && !prise((r + 1) * cols + c)) return false;', ''],
  ['habitude ignorée', 'src/rangementArrivee.js', 'const iH = depuis ? ms.findIndex', 'const iH = false ? ms.findIndex'],
  ['prix de lot divisé tout seul', 'src/rangementArrivee.js', "return { k, titre: '', marque: '', taille: '', prix: '',", "return { k, titre: '', marque: '', taille: '', prix: prixEnTexte(indicatif),"],
  ['identité de l’achat perdue', 'src/rangementArrivee.js', "achat: { tx, site:", "achat: { tx: '', site:"],
  ['achat rangé deux fois', 'src/rangementArrivee.js', "return { ok: false, raison: 'deja' };", "{}"],
  ['pool dans le geste annulable (App.jsx)', 'src/App.jsx', "  save('vinted_used_numeros', pool.sort(triPool));\n  emettreClesRelues(['vinted_used_numeros']);\n  const texte = r.numeros.length", "  r.ops.push({ k: 'vinted_used_numeros', type: 'ensemble', id: r.numeros[0], apres: true, avant: false });\n  const texte = r.numeros.length"],
];

const copieArbre = (src) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ranger-'));
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  for (const f of FICHIERS) { const p = path.join(src, 'src', f); if (fs.existsSync(p)) fs.copyFileSync(p, path.join(d, 'src', f)); }
  fs.writeFileSync(path.join(d, 'package.json'), '{"type":"module"}');
  return d;
};

(async () => {
  const prouve = process.argv.includes('--prouve');
  console.log('— Ranger un achat à son arrivée, sur ' + RACINE);
  const r = await controles(RACINE, false);
  console.log(`\n${r.ko ? '❌' : '✅'} audit-rangement-guide : ${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (!prouve) process.exit(r.ko ? 1 : 0);
  const ia = process.argv.indexOf('--avant'); const avant = ia > 0 ? process.argv[ia + 1] : 'origin/main';
  const dAv = fs.mkdtempSync(path.join(os.tmpdir(), 'ranger-avant-'));
  cp.execSync(`git -C ${JSON.stringify(RACINE)} archive ${avant} src api | tar -x -C ${JSON.stringify(dAv)}`);
  fs.writeFileSync(path.join(dAv, 'package.json'), '{"type":"module"}');
  const rav = await controles(dAv, true);
  console.log(`\n— Sur ${avant} : ${rav.ko} rouge(s) sur ${rav.ok + rav.ko} (attendu : des rouges) ${rav.ko ? '✅' : '❌'}`);
  let tuees = 0;
  for (const [nom, fichier, de, vers] of MUTATIONS) {
    const d = copieArbre(RACINE); const p = path.join(d, fichier); const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(de)) { console.log(`❌ mutation introuvable : ${nom}`); continue; }
    fs.writeFileSync(p, t.replace(de, vers));
    const rm = await controles(d, true);
    if (rm.ko) tuees++;
    console.log(`${rm.ko ? '✅' : '❌'} mutation « ${nom} » : ${rm.ko} rouge(s)${rm.ko ? ' — ' + rm.rouges[0] : ''}`);
  }
  console.log(`\n${tuees === MUTATIONS.length && rav.ko ? '✅' : '❌'} preuve : ${tuees}/${MUTATIONS.length} mutations attrapées, ${rav.ko} rouge(s) sur le code d'avant`);
  process.exit(tuees === MUTATIONS.length && rav.ko && !r.ko ? 0 : 1);
})();
