#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// « JE DÉPOSE » NE REVIENT PAS — node scripts/audit-depose-retire.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Décision de Julien du 19 nov. (« 4 oui », CLAUDE.md §3 « Gestes d'envoi ») : « Préparer mes colis », « Je dépose », la
// tournée et « Emballer » sont retirés ; le dépôt est CONSTATÉ par le suivi du transporteur. Le 20 nov. (chasse-bugs-2),
// « Je dépose » vivait encore : hors ligne sur Aujourd'hui (mode comptoir + « Déposé » sur chaque colis), dans la feuille
// « ⋯ » de Ventes (« Je dépose », la tournée), en série (« Je dépose »), dans la fiche d'une vente (« Marquer déposé »),
// sur la ligne d'une vente (bouton et balayage) et sur la carte d'un colis (« Déposé »). Puis (même jour) « Préparer mes
// colis », « Emballer », le scanner d'envoi qui cochait « Colis fait », et « Colis fait » sur Leboncoin et Vestiaire.
// Gardé : « Déposé » d'un RETOUR d'achat (un autre geste).
// Ce qui reste permis : LIRE une marque « Déposé » notée avant (`vinted_ship_done`, `vinted_bords_shipped`) — rien n'est
// perdu, rien n'est refait — et dire l'ÉTAPE « À déposer » (un fait, pas un geste).
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const sansCom = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`\\])\/\/[^\n'"`]*$/gm, '$1');
function juger(app, natif, bavard = true) {
  let ko = 0;
  const dit = (c, m, d = '') => { if (!c) ko++; if (bavard) console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
  const A = sansCom(app), N = sansCom(natif);
  const interdits = [
    ['>Je dépose<', 'un bouton « Je dépose »'],
    // (20 nov., suite) « Préparer mes colis », « Emballer », le scanner qui coche « Colis fait ».
    ["tr('v2v.outils.preparer')", '« Préparer mes colis » dans la feuille « ⋯ »'],
    ["tr('v2v.outils.emballer')", '« Emballer » dans la feuille « ⋯ »'],
    ['>Préparer mes colis<', 'un bouton « Préparer mes colis »'],
    ['>Emballer<', 'un bouton « Emballer »'],
    ['setPreparerOuvert(true)', 'l’ouverture de « Préparer mes colis »'],
    ['setEmballage(true)', 'l’ouverture du mode emballage'],
    ["jobs.push({ id:'emballer'", 'la tâche « Emballer » d’Aujourd’hui'],
    ['onEmballer=', '« Emballer » depuis la fiche'],
    ['onConfirmer={(x) => deposeScan.demander', 'le scanner d’envoi qui coche « Colis fait »'],
    ["tr('journee.jeDepose')", '« Je dépose » hors ligne (Aujourd’hui)'],
    ["tr('v2v.outils.deposer')", '« Je dépose » dans la feuille « ⋯ » de Ventes'],
    ["tr('v2v.outils.tournee')", 'la tournée de dépôt dans la feuille « ⋯ »'],
    ["k: 'depose', libelle: 'Je dépose'", '« Je dépose » en série'],
    ['libelle="Déposé"', '« Déposé » sur un colis hors ligne'],
    ['gesteColisFait(o, b, !posted)', '« Marquer déposé / Déposé » (fiche, volet, carte de colis)'],
    ['onFait: () => gesteColisFait', 'le balayage « Colis fait »'],
    ['setDepotOuvert(true)', 'l’ouverture du mode « Je dépose »'],
    ['setDepotHL(true)', 'l’ouverture du mode « Je dépose » hors ligne'],
    ["'data-lg-depose'", 'le balayage « Déposé » d’une ligne de vente'],
  ];
  for (const [motif, quoi] of interdits) dit(!A.includes(motif), `plus de ${quoi}`, motif);
  dit(/const peutDeposer = false;/.test(A) && /const aDeposerVente = /.test(A), 'la ligne d’une vente : aucun geste « Déposé » (l’étape « À déposer » reste dite)');
  dit(/^\s*depose: null,/m.test(A), 'la fiche d’une vente (Ventes natif) ne reçoit plus « Marquer déposé »');
  // Leboncoin et Vestiaire : « Colis fait » / « Marquer comme posté » retirés (le départ est constaté par l'état lu du site).
  const lbc = sansCom(fs.readFileSync(path.join(R, 'src', 'ecrans', 'Leboncoin.jsx'), 'utf8'));
  const vc = sansCom(fs.readFileSync(path.join(R, 'src', 'ecrans', 'Vestiaire.jsx'), 'utf8'));
  dit(/const LBC_VC_COLIS_FAIT_RETIRE = true;/.test(A) && /gestes=\{LBC_VC_COLIS_FAIT_RETIRE \? null : <button type="button" data-geste="fait" data-lbc-fait/.test(A)
    && /\{LBC_VC_COLIS_FAIT_RETIRE \? null : <button type="button" data-geste="fait" data-vc-fait/.test(A), 'Ventes : plus de « Déposé / Colis fait » sur un colis Leboncoin ou Vestiaire');
  dit(!/'Marquer comme posté'/.test(lbc), 'écran Leboncoin : plus de « Marquer comme posté »');
  dit(!/\{v\.aExpedier \? <Bouton[^\n]*data-vc-fait/.test(vc), 'écran Vestiaire : plus de « Colis fait »');
  // Gardé exprès : « Déposé » d'un RETOUR d'achat (un autre geste, il le garde).
  dit(/data-retour-depose=\{c\.cle\} onClick=\{\(\) => onDepose\(c\.cle\)\}/.test(fs.readFileSync(path.join(R, 'src', 'RetoursLitiges.jsx'), 'utf8')), '« Déposé » d’un retour d’achat reste (un autre geste)');
  dit(/const TOURNEE_DEPOT_RETIREE = true;/.test(A) && /const tourneeEl = TOURNEE_DEPOT_RETIREE \? null :/.test(A), 'la tournée de dépôt n’est plus montrée');
  dit(!/r\.gestes\.depose \? \{ cle: 'depose'/.test(N) || /depose: null,/.test(A), 'le balayage de Ventes natif n’a plus de « Déposé » (geste nul)');
  // Rien de perdu : une marque notée avant reste LUE.
  dit(/data-hl-fait-lu=\{ef\}/.test(A) && /Noté déposé/.test(A), 'hors ligne : une marque « Déposé » notée avant reste lue (« Noté déposé »), sans geste');
  dit(/vinted_ship_done: \{ sorte: 'ensemble'/.test(fs.readFileSync(path.join(R, 'src', 'gestesHorsLigne.js'), 'utf8')), 'la file hors ligne garde ses marques d’avant (vinted_ship_done : rien perdu)');
  return ko;
}
const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
const natif = fs.readFileSync(path.join(R, 'src', 'natif', 'ecrans', 'Ventes.jsx'), 'utf8');
if (process.argv.includes('--prouve')) {
  const muts = [
    ['« Je dépose » remis dans la feuille', app.replace("                              // (20 nov., chasse-bugs-2 — décision « 4 oui ») « Je dépose » et la tournée retirés", "                              (nEnv || 0) > 0 ? { k: 'deposer', icon: 'scan', lab: tr('v2v.outils.deposer'), on: () => setDepotOuvert(true) } : null,\n                              //")],
    ['« Marquer déposé » remis dans la fiche', app.replace('          depose: null,', '          depose: () => gesteColisFait(o, b, !posted),')],
    ['le bouton de la ligne remis', app.replace('const peutDeposer = false;', 'const peutDeposer = aDeposerVente;')],
    ['« Colis fait » Leboncoin remis', app.replace('const LBC_VC_COLIS_FAIT_RETIRE = true;', 'const LBC_VC_COLIS_FAIT_RETIRE = false;')],
  ];
  let r = 0; for (const [nom, src] of muts) { const k = src === app ? 0 : juger(src, natif, false); if (k) r++; console.log(`${k ? '✅' : '❌'} mutation « ${nom} » ⇒ ${k ? 'ROUGE' : 'encore vert'}`); }
  process.exit(r === muts.length ? 0 : 1);
}
const ko = juger(app, natif);
console.log(ko ? `❌ audit-depose-retire : ${ko} rouge(s)` : '✅ audit-depose-retire : « Je dépose » reste retiré');
process.exit(ko ? 1 : 0);
