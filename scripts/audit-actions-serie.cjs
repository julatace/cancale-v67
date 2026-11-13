// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « ACTIONS EN SÉRIE » (11 nov. ; docs/passation/2026-11-11-actions-serie.md)
//  1. La RÈGLE pure (src/selectionSerie.js) EXÉCUTÉE : cocher, Maj-clic = la plage
//     dans l'ordre affiché, « Tout sélectionner » = le filtre, une ligne cachée sort,
//     le plafond Vinted (45/h, « pas su » n'envoie rien), une à la fois, le résumé
//     honnête (« 8 faits · 2 pas faits : raison »).
//  2. Les BRANCHEMENTS (code lu, commentaires retirés) : chaque action en série
//     écrit ce qu'écrit l'action unitaire, en UN geste là où l'unitaire a « Annuler ».
//  Usage : node scripts/audit-actions-serie.cjs [--prouve] [racine]
//  `--prouve` : chaque mutation réaffaiblit une règle ⇒ l'audit doit passer au rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2);
const PROUVE = args.includes('--prouve');
const RACINE = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..'));
const lire = (r) => { try { return fs.readFileSync(path.join(RACINE, r), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

const SOURCES = {
  regle: 'src/selectionSerie.js', geste: 'src/composants/SelectionSerie.jsx', app: 'src/App.jsx',
  stock: 'src/ecrans/Stock.jsx', boite: 'src/BoiteEmails.jsx', facture: 'src/FacturePro.jsx',
};

// Les mutations : [fichier, avant, après, ce qu'elle casse]
const MUTATIONS = [
  ['regle', "return l.includes(k) ? l.filter((x) => x !== k) : [...l, k];", "return [...l, k];", 'basculer ne décoche plus'],
  ['regle', "const morceau = j < 0 ? [k] : o.slice(Math.min(i, j), Math.max(i, j) + 1);", "const morceau = [k];", 'Maj-clic ne prend plus la plage'],
  ['regle', "const n = l.filter((x) => vus.has(x));", "const n = l;", 'une ligne cachée reste sélectionnée'],
  ['regle', "const garde = r == null ? 0 : Math.min(r, PLAFOND_APP_HEURE);", "const garde = r == null ? ok.length : Math.min(r, PLAFOND_APP_HEURE);", '« pas su » laisse partir les gestes Vinted'],
  ['regle', "const garde = r == null ? 0 : Math.min(r, PLAFOND_APP_HEURE);", "const garde = r == null ? 0 : r;", 'le plafond de 45 n’est plus tenu'],
  ['regle', "if (r === false) return { fait: false, raison: 'refusé' };", "", 'un refus compte comme fait'],
  ['regle', "  if (P.length) {", "  if (false) {", 'le résumé tait les « pas faits »'],
  ['regle', "let r; try { r = await faire(l, i); }", "let r; try { r = faire(l, i); }", 'les lignes partent en parallèle'],
  ['app', "return st.step === 3 ? true : 'pas au point relais';", "return true;", '« Retiré » marque un colis pas au relais'],
  ['app', "gesteVrm(L.length > 1 ? `${L.length} colis retirés` : 'Colis retiré', L.map(", "L.forEach((o) => markPickupDone(o)); void (", '« Retiré » en N gestes (N « Annuler »)'],
  ['app', "const { ok, pasFaits } = trierSerie(lignes(cles), (o) => annulee(o) ? 'annulée' : estParti(o) ? 'déjà déposée' : !aExpedier(o) ? 'pas à envoyer' : true);", "const { ok, pasFaits } = trierSerie(lignes(cles), () => true);", '« Je dépose » sur une vente finalisée'],
  ['app', "if (ops.length) gesteVrm(ok.length > 1 ? `${ok.length} colis déposés` : 'Colis déposé', ops,", "if (ops.length) void (", '« Je dépose » n’écrit plus'],
  ['app', "if (ok.length) await batchBordereaux(new Set(ok.map(o => String(o.transaction_id))));", "", '« Imprimer » n’imprime pas'],
  ['app', "gesteVrm(L.length > 1 ? `${L.length} achats masqués` : 'Achat masqué', txs.map(", "void (txs.map(", '« Masquer » en série n’écrit pas'],
  ['stock', "if (!(await askConfirm({ title: `Enlever ${ok.length} paire", "if (false && !(await askConfirm({ title: `Enlever ${ok.length} paire", '« Enlever du stock » sans confirmation'],
  ['stock', "const u = { ...slots }; for (const f of ok) delete u[cleDeFiche(f)];", "for (const f of ok) retirerCase(cleDeFiche(f)); const u = { ...slots };", 'N écritures des cases qui s’écrasent'],
  ['boite', "if (ok.length) poserLu(ok, valeur, ok.map((e) => ({ k: valeur ? 'lu' : 'nonlu', id: e.id, at: e.at })));", "", 'Lu / Non lu n’écrit pas'],
  ['facture', "if (!(await deps.askConfirm({ title: `Envoyer ${prets.length} facture", "if (false && !(await deps.askConfirm({ title: `Envoyer ${prets.length} facture", 'factures envoyées sans confirmation'],
  ['facture', "if (it.etat !== 'a-envoyer') { pasFaits.push(", "if (false) { pasFaits.push(", 'facture envoyée sans acheteur prouvé'],
  ['geste', "if (e.key === 'Escape' && !e.defaultPrevented && !feuilleOuverte())", "if (false)", 'Échap ne ferme plus'],
  ['geste', "if (e.pointerType !== 'touch' || actif) return;", "return;", 'l’appui long n’ouvre plus la sélection'],
];

async function verifier(textes) {
  const res = [];
  const ok = (bon, quoi, det) => res.push({ bon: !!bon, quoi, det });
  // ── 1. LA RÈGLE, exécutée ──
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'serie-'));
  const f = path.join(tmp, 'selectionSerie.mjs'); fs.writeFileSync(f, textes.regle);
  let R; try { R = await import('file://' + f + '?v=' + Math.random()); } catch (e) { ok(false, 'R0 module chargé', e.message); return res; }
  const manque = ['basculer', 'plage', 'toutSelectionner', 'garderVisibles', 'trierSerie', 'executerSerie', 'resumeSerie'].filter((n) => typeof R[n] !== 'function');
  ok(!manque.length, 'R0 la règle existe (src/selectionSerie.js)', manque.join(', '));
  if (!manque.length) {
  ok(R.basculer(['a'], 'b').join() === 'a,b' && R.basculer(['a', 'b'], 'a').join() === 'b', 'R1 cocher / décocher une ligne');
  const ordre = ['1', '2', '3', '4', '5'];
  ok(R.plage(ordre, '2', '4', ['2']).join() === '2,3,4', 'R2 Maj-clic : la plage dans l’ordre affiché', R.plage(ordre, '2', '4', ['2']).join());
  ok(R.plage(ordre, '4', '2', []).join() === '2,3,4', 'R3 plage à rebours');
  ok(R.plage(ordre, 'x', '3', ['1']).join() === '1,3', 'R4 ancre cachée : la ligne seule');
  ok(R.plage(ordre, '1', '3', ['1', '2', '3', '5'], false).join() === '5', 'R5 Maj-clic sur une cochée : la plage se décoche');
  ok(R.toutSelectionner(['a', 'b', 'a']).join() === 'a,b', 'R6 « Tout sélectionner » = le filtre, sans double');
  ok(R.garderVisibles(['1', '9'], ordre).join() === '1', 'R7 une ligne qui n’est plus affichée sort de la sélection');
  const t1 = R.trierSerie([1, 2, 3, 4, 5], (x) => (x === 5 ? 'déjà fait' : true), { vinted: true, restant: 2 });
  ok(t1.ok.length === 2 && t1.pasFaits.length === 3 && t1.pasFaits.filter((p) => /plafond/.test(p.raison)).length === 2, 'R8 geste Vinted : au-delà du plafond restant, « pas fait : plafond »', JSON.stringify(t1));
  const t2 = R.trierSerie([1, 2], () => true, { vinted: true, restant: null });
  ok(t2.ok.length === 0 && t2.pasFaits.length === 2, 'R9 plafond pas lu : aucun geste Vinted ne part');
  const t3 = R.trierSerie(Array.from({ length: 60 }, (_, i) => i), () => true, { vinted: true, restant: 999 });
  ok(t3.ok.length === 45, 'R10 jamais plus de 45 gestes de l’app par heure', t3.ok.length);
  let enCours = 0, max = 0;
  const ex = await R.executerSerie([1, 2, 3, 4], async (x) => { enCours++; max = Math.max(max, enCours); await new Promise((r) => setTimeout(r, 5)); enCours--; if (x === 2) return false; if (x === 3) throw new Error('réseau'); if (x === 4) return { fait: false, raison: 'refus Vinted' }; });
  ok(max === 1, 'R11 une ligne à la fois (jamais en parallèle)', max);
  ok(ex.faits.join() === '1' && ex.pasFaits.map((p) => p.raison).join('|') === 'refusé|réseau|refus Vinted', 'R12 un refus, une exception ⇒ « pas fait » avec SA raison', JSON.stringify(ex));
  ok(R.resumeSerie({ faits: Array(8).fill(0), pasFaits: [{ raison: 'pas au point relais' }, { raison: 'pas au point relais' }] }) === '8 faits · 2 pas faits : pas au point relais', 'R13 « 8 faits · 2 pas faits : raison »', R.resumeSerie({ faits: Array(8).fill(0), pasFaits: [{ raison: 'pas au point relais' }, { raison: 'pas au point relais' }] }));
  ok(R.resumeSerie({ faits: [1], pasFaits: [{ raison: 'a' }, { raison: 'b' }] }) === '1 fait · 2 pas faits : 1 a, 1 b', 'R14 plusieurs raisons : chacune comptée');
  ok(R.resumeSerie({ faits: [1, 2], pasFaits: [] }) === '2 faits', 'R15 tout fait : pas de « 0 pas fait »');
  }
  // ── 2. LES BRANCHEMENTS ──
  const app = sansCommentaires(textes.app), stock = sansCommentaires(textes.stock), boite = sansCommentaires(textes.boite), fac = sansCommentaires(textes.facture), ge = sansCommentaires(textes.geste);
  const tranche = (t, debut, n = 2600) => { const i = t.indexOf(debut); return i < 0 ? '' : t.slice(i, i + n); };
  const ret = tranche(app, 'const markPickupDoneSerie', 700);
  ok(/gesteVrm\(L\.length > 1 \? `\$\{L\.length\} colis retirés`[^;]*L\.map\(o => \(\{ k: 'vinted_pickup_done', type: 'cle'/.test(ret), 'B1 « Retiré » : l’écriture de « J’ai retiré » (vinted_pickup_done), en UN geste ⇒ UN « Annuler »');
  const actA = tranche(app, 'const actionsSerieAchats', 4200);
  ok(/return st\.step === 3 \? true : 'pas au point relais'/.test(actA) && /markPickupDoneSerie\(ok\.map/.test(actA), 'B2 « Retiré » : seul un colis AU POINT RELAIS (les autres « pas faits »)');
  ok(/masquerAchats\(ok\.map/.test(actA) && /gesteVrm\(L\.length > 1 \? `\$\{L\.length\} achats masqués`[^;]*txs\.map\(tx => \(\{ k: ACHATS_MASQUES/.test(tranche(app, 'const masquerAchats', 900)), 'B3 « Masquer » : vinted_purchases_hidden, en UN geste');
  ok(/demanderVue\('sansachat'\)/.test(actA) && !/ecritureRelierAchat|buyFromId/.test(actA), 'B4 « Relier » : jamais par ressemblance — la file « Sans achat relié », SON tap relie');
  const actV = tranche(app, 'const actionsSerieVentes', 4600);
  ok(/estParti\(o\) \? 'déjà déposée' : !aExpedier\(o\) \? 'pas à envoyer' : true/.test(actV) && /gesteVrm\(ok\.length > 1 \? `\$\{ok\.length\} colis déposés`/.test(actV) && /'vinted_ship_done'/.test(actV) && /'vinted_bords_shipped'/.test(actV), 'B5 « Je dépose » : l’écriture de « Colis déposé » (ship_done + bordereau), seulement à envoyer, UN geste');
  ok(/lignesLotTous\(\)/.test(actV) && /await batchBordereaux\(new Set\(ok\.map/.test(actV), 'B6 « Imprimer » : le lot « Tout imprimer » (mêmes bordereaux, même confirmation)');
  ok(/envoyerFacturesSerie\(DEPS_FACTURE/.test(actV) && /action: 'emettre', confirme: true/.test(tranche(fac, 'export async function envoyerFacturesSerie', 5000)) && /action: 'envoyer', confirme: true/.test(tranche(fac, 'export async function envoyerFacturesSerie', 5000)), 'B7 « Facture Pro » : les gestes de « Tout envoyer » (émettre puis envoyer)');
  const fs1 = tranche(fac, 'export async function envoyerFacturesSerie', 5000);
  ok(/if \(!\(await deps\.askConfirm\(\{ title: `Envoyer \$\{prets\.length\} facture/.test(fs1) && /if \(it\.etat !== 'a-envoyer'\) \{ pasFaits\.push/.test(fs1) && /r2\.code === 429 \|\| r2\.code === 503/.test(fs1), 'B8 « Facture Pro » : confirmation, acheteur prouvé seulement, un 429/503 arrête la série');
  const st = tranche(stock, 'const actionsSerieStock', 3000);
  ok((/if \(!\(await askConfirm\(\{ title: `Enlever \$\{ok\.length\} (?:paire|\$\{ok\.length > 1 \? motsVendeur\(\)\.noms : motsVendeur\(\)\.nom\})/.test(st) || /if \(!\(await askConfirm\(\{ title: tr\('stock\.enleverPairesStock', \{ n: String\(ok\.length\) \}\)/.test(st)) && (st.match(/ecrireSlots\(/g) || []).length === 1 && !/retirerCase\(/.test(st), 'B9 « Enlever du stock » : confirmation qui nomme les N°, UNE écriture des cases');
  ok(/n\[cleDeclarationPartie\(f\.numero, f\.id, numeros\)\] = \{ id: String\(f\.id\), at, title: f\.title \|\| '', from: 'stock' \}/.test(st), 'B10 une vendue sort comme « Je l’ai sortie » (vinted_pairs_lost, from: stock) ; le N° reste pris');
  ok(/poserLu\(ok, valeur, ok\.map\(\(e\) => \(\{ k: valeur \? 'lu' : 'nonlu', id: e\.id, at: e\.at \}\)\)\)/.test(boite), 'B11 e-mails « Lu / Non lu » : les gestes de la ligne, en UNE écriture');
  const monte = (t, nom) => t.includes(`useSelectionSerie(`) && t.includes('<BarreSerie serie={' + nom) && t.includes('<CaseSerie serie={' + nom) && t.includes(nom + '.ligne(');
  ok(monte(app, 'serieAchats') && monte(app, 'serieVentes') && monte(stock, 'serieStock') && /attrsSerie=\{serie\.ligne\(/.test(boite) && boite.includes('<BarreSerie serie={serie}'), 'B12 UN mécanisme monté sur Achats, Ventes, Stock, E-mails (barre + case + ligne)');
  ok(/if \(e\.key === 'Escape' && !e\.defaultPrevented && !feuilleOuverte\(\)\)/.test(ge) && /if \(e\.pointerType !== 'touch' \|\| actif\) return;/.test(ge) && /e\.shiftKey && ancre\.current != null/.test(ge), 'B13 Échap (après une feuille), appui long au doigt, Maj-clic à la souris');
  ok(/deps\.push\(serieVentes\.actif \?/.test(app), 'B14 une ligne de vente mémoïsée se redessine quand on la coche');
  return res;
}

// Une mutation « en parallèle » laisse des promesses orphelines : avalées PENDANT les
// mutations seulement — jamais pendant la passe réelle (un audit muet n'est pas vert).
let enMutation = false;
process.on('unhandledRejection', (e) => { if (enMutation) return; console.log('KO  exception : ' + (e && e.stack || e)); process.exit(1); });
(async () => {
  const textes = Object.fromEntries(Object.entries(SOURCES).map(([k, f]) => [k, lire(f)]));
  let res; try { res = await verifier(textes); } catch (e) { console.log('KO  l’audit a planté : ' + (e && e.message)); process.exit(1); }
  const ko = res.filter((r) => !r.bon);
  for (const r of res) if (!r.bon || process.env.BAVARD) console.log(`${r.bon ? 'OK ' : 'KO '} ${r.quoi}${!r.bon && r.det ? ' — ' + String(r.det).slice(0, 300) : ''}`);
  console.log(`audit-actions-serie : ${res.length - ko.length}/${res.length}`);
  if (!PROUVE) process.exit(ko.length ? 1 : 0);
  let mord = 0; enMutation = true;
  for (const [k, avant, apres, quoi] of MUTATIONS) {
    if (!textes[k].includes(avant)) { console.log(`MUTATION SANS ANCRE  ${quoi}`); continue; }
    let r; try { r = await verifier({ ...textes, [k]: textes[k].replace(avant, apres) }); } catch (_) { r = [{ bon: false }]; }
    const rouge = r.some((x) => !x.bon);
    if (rouge) mord++; else console.log(`MUTATION PAS VUE  ${quoi}`);
  }
  console.log(`mutations : ${mord}/${MUTATIONS.length} rouges`);
  process.exit(ko.length || mord !== MUTATIONS.length ? 1 : 0);
})();
