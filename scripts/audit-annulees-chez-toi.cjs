#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — REMETTRE EN VENTE UNE VENTE ANNULÉE AVANT L'ENVOI (6 nov., vague 2 · 1)
//        node scripts/audit-annulees-chez-toi.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/annuleesChezToi.js (et la VRAIE reprise du N°, src/repriseNumero.js) :
//   R  quelles ventes sont « à remettre » : annulée PROUVÉE par la transaction (pas su
//      ⇒ rien), compte exclu écarté, annonce de nouveau chez lui sur Vinted ⇒ rien,
//      « Déjà remise en vente » ⇒ rien, remise faite ⇒ plus dite, une vente une fois ;
//   N  le N° : gardé par identité, jamais un N° d'archive (B…) redonné, « paire pas
//      reliée » sans N° ; la reprise (`repriseNumerosRecreation`) remet le N° de la
//      vente sur la nouvelle annonce désignée par SON clic, même quand le N° est posé
//      sur la VENTE seule ; jamais sur une annonce qu'une autre paire en ligne porte ;
//   J  Ma journée : une ligne, le nombre, « paire pas reliée » nommé ;
//   M  le verdict du moteur (mesuré dans `recreerVinted`, extension LUE, jamais
//      modifiée) : il supprime l'ancienne annonce avant la mise en ligne ⇒ « à la main » ;
//   S  le branchement dans l'app (src/App.jsx, commentaires retirés) : la ligne d'une
//      vente annulée porte « Remettre en vente » → « Republier à la main » (aucune
//      commande à l'extension), Ma journée dit la ligne, la reprise lit la fiche prêtée.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'pas-su-vaut-oui': ['src/annuleesChezToi.js', 'if (annuleeAvantEnvoi(o) !== true) continue;', 'if (annuleeAvantEnvoi(o) === false) continue;'],
  'exclu-ignore': ['src/annuleesChezToi.js', "if (typeof ecarte === 'function' && ecarte(o)) continue;", ''],
  'presente-ignoree': ['src/annuleesChezToi.js', "if (item && typeof presente === 'function' && presente(item)) continue;", ''],
  'reglee-ignoree': ['src/annuleesChezToi.js', 'if (reglees && reglees[tx]) continue;', ''],
  'fait-redit': ['src/annuleesChezToi.js', "if (etat === 'fait') continue;", ''],
  'archive-redonne': ['src/annuleesChezToi.js', "ancienId: x.item, uid: x.uid, num: x.num && ok(x.num) ? x.num : ''", 'ancienId: x.item, uid: x.uid, num: x.num'],
  'fiche-archive': ['src/annuleesChezToi.js', '    if (!num || !ok(num)) continue;\n    const e = numeros', '    if (!num) continue;\n    const e = numeros'],
  'fiche-ecrase': ['src/annuleesChezToi.js', "if (e && String(e.numero || '').trim()) continue;\n    out[anc]", 'out[anc]'],
  'app-moteur': ['src/App.jsx', 'const remettreEnVente = (x) => { const p = paireARemettre(x, { reprenable: numeroReprenable }); if (p) setRepubMainOuvert(p); };', "const remettreEnVente = (x) => { const p = paireARemettre(x, { reprenable: numeroReprenable }); if (p) vmrCmdSuivi({ cmd:'recreerVinted', uid:p.uid, id:p.ancienId, confirme:true }); };"],
  'app-txn': ['src/App.jsx', 'annuleeAvantEnvoi: (o) => o.transaction_id != null && txnAnnuleeAvantEnvoi(o.transaction_id),', "annuleeAvantEnvoi: (o) => classifyOrderStatus(o.status) === 'cancelled',"],
  'app-pret': ['src/App.jsx', 'numeros: { ...fichesAnciennesAnnulees(repubMain, nextNum, { reprenable: numeroReprenable }), ...nextNum }, recrees: recreesEff', 'numeros: nextNum, recrees: recreesEff'],
  'app-journee': ['src/App.jsx', "if (lj) jobs.push({ id: 'remettre-en-vente'", "if (false) jobs.push({ id: 'remettre-en-vente'"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'annulees-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const [f, de, vers] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + String(d).slice(0, 300))); };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  let A, P;
  try {
    A = await import(require('url').pathToFileURL(path.join(SRC, 'annuleesChezToi.js')).href);
    P = await import(require('url').pathToFileURL(path.join(SRC, 'repriseNumero.js')).href);
  } catch (e) { dit(false, 'src/annuleesChezToi.js se charge', e.message); A = null; }
  if (A) {
  const reprenable = (n) => !!String(n || '').trim() && !/^B/i.test(String(n).trim());
  const cle = (n) => String(n == null ? '' : n).trim().toUpperCase().replace(/^0+(?=\d)/, '');
  const T0 = Date.parse('2026-10-20T12:00:00Z');
  const acc = (u) => ({ vinted_user_id: u, domain: 'www.vinted.fr' });
  const v = (tx, item, o = {}) => ({ transaction_id: tx, title: `Paire ${tx}`, price: { amount: '47.0', currency_code: 'EUR' }, status: 'Remboursement effectué', date: new Date(T0 - tx * 1000).toISOString(), _acc: acc('111'), _item: item, _num: '', ...o });
  // La preuve de la transaction : 520 (annulée), 450 (finalisée), 520 partie (le colis a bougé), pas lue.
  const TXN = { 1: 'ann', 2: 'ann', 3: 'fin', 4: 'parti', 5: undefined, 6: 'ann', 7: 'ann', 8: 'ann', 9: 'ann', 10: 'ann', 11: 'ann' };
  const base = (o = {}) => ({
    annuleeAvantEnvoi: (x) => (TXN[x.transaction_id] === undefined ? null : TXN[x.transaction_id] === 'ann'),
    identite: (x) => x._item, numeroDe: (x) => x._num, ecarte: (x) => x._acc && x._acc.vinted_user_id === '999',
    presente: (id) => id === '1000000006', reprenable, cle, ...o,
  });
  const liste = (ventes, o) => A.annuleesChezToi({ ventes, ...base(o) });

  console.log('\n── R. Quelles ventes sont « à remettre »');
  const V = [v(1, '1000000001', { _num: '12' }), v(2, '1000000002', { _num: 'B230' }), v(3, '1000000003', { _num: '14' }), v(4, '1000000004', { _num: '15' }),
    v(5, '1000000005', { _num: '16' }), v(6, '1000000006', { _num: '17' }), v(7, '1000000007', { _acc: acc('999'), _num: '18' }), v(8, '1000000008'), v(1, '1000000001', { _num: '12' })];
  const l = liste(V);
  const txs = l.map((x) => x.tx).sort().join(',');
  dit(txs === '1,2,8', 'R1 seules les annulées PROUVÉES, paire chez lui : 1, 2, 8', txs);
  dit(!l.some((x) => x.tx === '3'), 'R2 une vente finalisée n’est jamais « à remettre »');
  dit(!l.some((x) => x.tx === '4'), 'R3 annulée APRÈS le départ du colis (expédition bougée) ⇒ rien (la paire n’est pas chez lui)');
  dit(!l.some((x) => x.tx === '5'), 'R4 transaction pas lue ⇒ rien (« pas su » ne vaut pas « oui »)');
  dit(!l.some((x) => x.tx === '6'), 'R5 l’annonce est de nouveau chez lui sur Vinted ⇒ rien à remettre');
  dit(!l.some((x) => x.tx === '7'), 'R6 un compte exclu n’entre jamais');
  dit(l.filter((x) => x.tx === '1').length === 1, 'R7 une vente lue deux fois n’est dite qu’une fois');
  dit(liste(V, { reglees: { 1: '2026-11-06' } }).every((x) => x.tx !== '1'), 'R8 « Déjà remise en vente » (SON clic) ⇒ plus dite');
  dit(liste(V, { recrees: { 1000000099: '1000000001' } }).every((x) => x.tx !== '1'), 'R9 l’extension l’a déjà recréée (identité prouvée) ⇒ plus dite');
  const enCours = liste(V, { suivis: { 1000000001: { at: 'x' } } }).find((x) => x.tx === '1');
  dit(enCours && enCours.etat === 'en-cours', 'R10 Vinted ouvert pour la publier ⇒ « en cours », toujours dite');
  const lie = liste(V, { suivis: { 1000000001: { at: 'x', nouvelId: '1000000050' } }, numeros: {} }).find((x) => x.tx === '1');
  dit(lie && lie.etat === 'en-cours', 'R11 nouvelle désignée, N° pas encore dessus ⇒ « en cours »');
  dit(!liste(V, { suivis: { 1000000001: { nouvelId: '1000000050' } }, numeros: { 1000000050: { numero: '12' } } }).some((x) => x.tx === '1'), 'R12 la nouvelle porte le N° ⇒ fait, plus dite');
  dit(!liste(V, { suivis: { 1000000002: { nouvelId: '1000000051' } } }).some((x) => x.tx === '2'), 'R13 N° d’archive : la nouvelle désignée suffit ⇒ fait');
  dit(A.annuleesChezToi({ ventes: V }).length === 0 && A.annuleesChezToi({}).length === 0, 'R14 sans la règle de la transaction ⇒ rien (jamais deviné)');

  console.log('\n── N. Le N°');
  const un = l.find((x) => x.tx === '1'), ar = l.find((x) => x.tx === '2'), sans = l.find((x) => x.tx === '8');
  dit(un.num === '12' && !un.archive && !un.sansNum, 'N1 le N° de la vente, par identité');
  dit(ar.archive && A.paireARemettre(ar, { reprenable }).num === '' && A.paireARemettre(ar, { reprenable }).numAffiche === 'B230', 'N2 un N° d’archive (B…) n’est jamais redonné : la nouvelle annonce en prendra un neuf');
  dit(sans.sansNum && A.paireARemettre(sans, { reprenable }).num === '', 'N3 sans N° : « paire pas reliée »');
  const pr = A.paireARemettre(un, { reprenable });
  dit(pr && pr.ancienId === '1000000001' && pr.num === '12' && pr.annulee === true && pr.tx === '1', 'N4 « Remettre en vente » ouvre « à la main » sur l’annonce fermée, N° 12, vente 1');
  dit(A.paireARemettre({ ...un, item: '' }) === null, 'N5 annonce pas identifiée ⇒ rien n’est ouvert');
  // La VRAIE reprise : SON clic a désigné la nouvelle (1000000050) ; le N° 12 est posé sur la VENTE (pas de fiche).
  const suivis = { 1000000001: { uid: '111', num: '12', annulee: true, tx: '1', nouvelId: '1000000050' }, 1000000002: { num: '', annulee: true, nouvelId: '1000000051' }, 1000000003: { num: 'B231', annulee: true, nouvelId: '1000000052' } };
  const fiches = A.fichesAnciennesAnnulees(suivis, {}, { reprenable });
  dit(fiches['1000000001'] && fiches['1000000001'].numero === '12' && !fiches['1000000002'] && !fiches['1000000003'], 'N6 la fiche prêtée à la reprise : le N° de la vente, jamais pour une archive');
  dit(Object.keys(A.fichesAnciennesAnnulees(suivis, { 1000000001: { numero: '40' } }, { reprenable })).length === 0, 'N7 une vraie fiche existe ⇒ elle gagne, rien n’est prêté');
  dit(Object.keys(A.fichesAnciennesAnnulees({ 1000000001: { num: '12', nouvelId: '1000000050' } }, {}, { reprenable })).length === 0, 'N8 seulement une remise d’une vente annulée (marquée par SON clic)');
  const reprise = (num, enLigne) => P.repriseNumerosRecreation({ enLigneIds: enLigne, numeros: { ...fiches, ...num }, recrees: { 1000000050: '1000000001' }, reprenable, cle });
  const r1 = reprise({ 1000000050: { numero: '901', auto: true } }, ['1000000050']);
  dit(r1['1000000050'] && r1['1000000050'].numero === '12' && r1['1000000050'].numeroRendu && r1['1000000050'].numeroRendu.de === '901', 'N9 la nouvelle annonce (numérotée auto 901) reprend le N°12 de la vente ; le 901 reste brûlé');
  const r2 = reprise({ 1000000050: { numero: '901', auto: true }, 1000000060: { numero: '12' } }, ['1000000050', '1000000060']);
  dit(!r2['1000000050'], 'N10 le N°12 déjà porté par une AUTRE annonce en ligne ⇒ rien (jamais deux paires sous un N°)');
  const r3 = P.repriseNumerosRecreation({ enLigneIds: ['1000000051'], numeros: { ...A.fichesAnciennesAnnulees(suivis, { 1000000002: { numero: 'B230' } }, { reprenable }), 1000000002: { numero: 'B230' } }, recrees: { 1000000051: '1000000002' }, reprenable, cle });
  dit(!r3['1000000051'], 'N11 un N° d’archive ne passe jamais sur la nouvelle annonce');

  console.log('\n── J. Ma journée');
  const j = A.ligneJournee(l);
  dit(j && j.n === 3 && /3 ventes annulées avant l’envoi/.test(j.court) && /1 sans N°/.test(j.detail) && !/paire/.test(j.court + j.detail), 'J1 une ligne : le nombre, la vente sans N° nommée (des mots d’« articles », §Ma journée)', JSON.stringify(j));
  dit(A.ligneJournee([]) === null && A.ligneJournee(null) === null, 'J2 rien à remettre ⇒ aucune ligne');

  console.log('\n── M. Le verdict du moteur (extension LUE, jamais modifiée)');
  const BG = fs.readFileSync(path.join(R, 'vinted-sync-extension', 'background.js'), 'utf8');
  const i = BG.indexOf('async function recreerVinted(msg)'), jFin = BG.indexOf('\nasync function ', i + 10);
  const corps = i >= 0 ? BG.slice(i, jFin > 0 ? jFin : i + 40000) : '';
  const iSupp = corps.indexOf('`/api/v2/items/${id}/delete`'), iBr = corps.indexOf("'/api/v2/item_upload/drafts'");
  dit(i >= 0 && iBr > 0 && iSupp > iBr, 'M1 `recreerVinted` range un brouillon puis SUPPRIME l’ancienne annonce (il ne sait pas recréer sans supprimer)');
  dit(A.VERDICT_MOTEUR && A.VERDICT_MOTEUR.moteur === 'main', 'M2 verdict : « Republier à la main » accompagné (rien n’est promis au moteur)');

  }
  console.log('\n── S. Le branchement dans l’app');
  const APP = sansCommentaires(require("./_source-app.cjs").sourceAppDe(path.join(SRC, 'App.jsx')));
  const iR = APP.indexOf('const remettreEnVente = (x) =>');
  const remise = iR >= 0 ? APP.slice(iR, APP.indexOf('\n', iR)) : '';
  dit(/setRepubMainOuvert\(p\)/.test(remise) && !/vmrCmd|recreerVinted|publierBrouillon/.test(remise), 'S1 « Remettre en vente » ouvre « Republier à la main » — aucune commande à l’extension', remise.slice(0, 200));
  dit(/annuleeAvantEnvoi: \(o\) => o\.transaction_id != null && txnAnnuleeAvantEnvoi\(o\.transaction_id\)/.test(APP), 'S2 l’annulation avant l’envoi est celle de la TRANSACTION (`txnAnnuleeAvantEnvoi`), jamais le libellé de la liste');
  dit(/data-remettre-vente=\{txL\}[^>]*onClick=\{\(\)=>remettreEnVente\(annChez\)\}/.test(APP), 'S3 la ligne de la vente annulée porte « Remettre en vente » (SON clic)');
  dit(/numeros: \{ \.\.\.fichesAnciennesAnnulees\(repubMain, nextNum, \{ reprenable: numeroReprenable \}\), \.\.\.nextNum \}, recrees: recreesEff/.test(APP), 'S4 la reprise du N° lit la fiche prêtée (N° posé sur la vente), la vraie fiche gagne');
  dit(/if \(lj\) jobs\.push\(\{ id: 'remettre-en-vente'/.test(APP) && /ligneAnnuleesJournee\(annulChez\)/.test(APP), 'S5 Ma journée « À faire » le dit une fois');
  dit(/paire\.annulee[\s\S]{0,200}rien à supprimer/.test(APP), 'S6 « à la main » dit que l’ancienne est fermée : rien à supprimer');
  dit(!/useEffect\([^;]*remettreEnVente/.test(APP), 'S7 rien n’est remis en vente tout seul (aucun effet n’appelle « Remettre en vente »)');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
