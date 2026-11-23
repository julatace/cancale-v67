#!/usr/bin/env node
// ── audit-sortie-expedition — VENDUE : CASE ALLUMÉE ; EXPÉDIÉE PROUVÉE : SORTIE DU STOCK (16 nov. 2026) ──
// Julien (16 nov.) : « dans l'onglet Stock, la case doit être en surbrillance si l'article n'est pas rangé/retiré »,
// puis « quand une paire est vendue ET expédiée, elle est d'office supprimée du Stock ; il faut bien tout
// articuler ». Récit : docs/passation/2026-11-16-retirer-case-compact.md (le tableau des états).
// Exécute les VRAIES règles (src/stockSortie.js : `partieDuStock`, `libererCasesPartis`, `remettreCase`,
// `etatCase`, `resteAuStock`) sur des données INVENTÉES, puis vérifie dans App.jsx que la sortie automatique
// passe par `partieDuStock` avec la preuve de départ partagée (`partisVinted` = `ventesPartiesParPreuve`).
//   E1 vendue, pas expédiée ⇒ la case reste, état « vendue » (la surbrillance) ;
//   E2 preuve de dépôt du transporteur (e-mail / prise en charge, par le n° de SON bordereau) ⇒ sortie : case libre,
//      plus de surbrillance, une case occupée de moins ; le N° n'est pas touché (fiches, pool) ;
//   E3 vente annulée / retour ⇒ rien, même avec une preuve ; E4 lecture ratée (raison null) ⇒ rien ;
//      « Colis fait » seul ⇒ rien (décision du 27 oct.) ;
//   E5 « Remettre » rend SA case seulement si elle est libre ; une case reprise par une autre paire ⇒ rien posé ;
//      une paire remise (`garder`) n'est plus jamais sortie toute seule ;
//   E6 App.jsx : la sortie appelle `partieDuStock` avec `partisVinted`, ne sort rien d'une vente annulée.
//   node scripts/audit-sortie-expedition.cjs            la règle du dépôt
//   node scripts/audit-sortie-expedition.cjs --prouve   chaque mutation doit rougir
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'src', 'stockSortie.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

const MUTATIONS = {
  'annulee-ignoree': ['sortie', '  if (annulee) return false;\n', ''],
  'colis-fait-suffit': ['sortie', "export const PREUVES_DEPART_STOCK = Object.freeze(['email', 'transporteur']);", "export const PREUVES_DEPART_STOCK = Object.freeze(['email', 'transporteur', 'colis-fait']);"],
  'absence-sort': ['sortie', "  return !!(raison && typeof raison === 'object' && PREUVES_DEPART_STOCK.includes(raison.type));", '  return true;'],
  'preuve-ignoree': ['sortie', "  return !!(raison && typeof raison === 'object' && PREUVES_DEPART_STOCK.includes(raison.type));", '  return false;'],
  'remettre-ecrase': ['sortie', "  if (Object.keys(slots).some((c) => slots[c] && slots[c].m === m.id && slots[c].i === i)) return { slots, remise: false, raison: 'sa case est prise' };\n", ''],
  'app-sans-preuve': ['app', 'raison: raisonDepart })) continue;', 'raison: null })) continue;'],
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d != null ? ' — ' + String(d).slice(0, 300) : '')); };

async function charger(mut) {
  let src = fs.readFileSync(SORTIE, 'utf8');
  if (mut && MUTATIONS[mut][0] === 'sortie') { const [, a, b] = MUTATIONS[mut]; if (!src.includes(a)) throw new Error('ancre absente : ' + mut); src = src.replace(a, b); }
  // Écrit à côté de l'original (ses imports relatifs se résolvent), effacé aussitôt importé.
  const f = path.join(RACINE, 'src', `.stockSortie-audit-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(pathToFileURL(f).href); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function controles(mut) {
  const S = await charger(mut);
  const meubles = [{ id: 'mA', name: 'Étagère', cols: 3, rows: 2 }];
  const slots0 = { 3: { m: 'mA', i: 1 }, 7: { m: 'mA', i: 3 }, 1: { m: 'mA', i: 0 } };
  const pool = ['1', '3', '7'];                         // le pool append-only (jamais touché ici)
  const vendus = new Set(['3', '7']);
  // La règle appliquée aux ventes, comme l'effet d'App (une ligne par vente).
  const ventes = [
    { num: '3', statutParti: false, annulee: false, raison: { type: 'email', suivi: 'X1' } },        // déposée, Vinted dit encore « à expédier »
    { num: '7', statutParti: false, annulee: false, raison: null },                                   // vendue, pas expédiée
  ];
  const cand = (L) => L.filter((v) => S.partieDuStock(v)).map((v) => ({ cle: v.num, num: v.num }));
  const r = S.libererCasesPartis({ slots: slots0, meubles, candidats: cand(ventes) });
  const occ = (sl) => Object.keys(sl).length;
  dit(S.etatCase({ numero: '7' }, { vendus }) === 'vendue' && !!r.slots['7'], 'E1 vendue, pas expédiée (N°7) : sa case reste, état « vendue » (la surbrillance)', JSON.stringify(r.slots));
  dit(!r.slots['3'] && occ(r.slots) === occ(slots0) - 1 && r.sortis.length === 1 && r.sortis[0].cle === '3', 'E2 preuve de dépôt (N°3) : sortie automatique, case libre, une case occupée de moins', JSON.stringify(r));
  dit(pool.join(',') === '1,3,7' && r.sortis[0] && r.sortis[0].num === '3', 'E2 le N° n\'est jamais touché (pool append-only, N°3 garde son numéro dans le journal)', JSON.stringify(r.sortis));
  dit(S.partieDuStock({ statutParti: true }) === true && S.partieDuStock({ raison: { type: 'transporteur' } }) === true, 'E2 statut Vinted parti, ou prise en charge du transporteur : sortie', '');
  dit(S.partieDuStock({ statutParti: true, annulee: true }) === false && S.partieDuStock({ annulee: true, raison: { type: 'email' } }) === false, 'E3 vente annulée / retour : jamais sortie, même avec une preuve', '');
  dit(S.partieDuStock({ raison: null }) === false && S.partieDuStock({}) === false, 'E4 lecture ratée (raison null) : rien', '');
  dit(S.partieDuStock({ raison: { type: 'colis-fait' } }) === false && S.partieDuStock({ raison: { type: 'expedie-main' } }) === false && S.partieDuStock({ raison: { type: 'panneau' } }) === false, 'E4 « Colis fait », « expédié » à la main, « traité » au panneau : rien (décision du 27 oct.)', '');
  // E5 Remettre.
  const sorti = r.sortis[0] || { cle: '3', num: '3', meubleId: 'mA', i: 1 };
  const libre = S.remettreCase({ slots: r.slots, meubles, sorti });
  dit(libre.remise && libre.slots['3'] && libre.slots['3'].i === 1, 'E5 « Remettre » rend SA case quand elle est libre', JSON.stringify(libre));
  const prise = S.remettreCase({ slots: { ...r.slots, 9: { m: 'mA', i: 1 } }, meubles, sorti });
  dit(!prise.remise && !prise.slots['3'], 'E5 sa case reprise par une autre paire (N°9) : rien n\'est posé (il choisit)', JSON.stringify(prise));
  const g = S.libererCasesPartis({ slots: slots0, meubles, candidats: [{ cle: '3', num: '3' }], garder: { 3: Date.now() } });
  dit(!!g.slots['3'] && !g.sortis.length, 'E5 une paire remise (garder) n\'est plus jamais sortie toute seule', JSON.stringify(g));
  // E6 App.jsx.
  let app = fs.readFileSync(APP, 'utf8');
  if (mut && MUTATIONS[mut][0] === 'app') { const [, a, b] = MUTATIONS[mut]; app = app.replace(a, b); }
  const bloc = (() => { const i = app.indexOf('const statutParti = venteSortieDuStock(o), raisonDepart = partisVinted.get('); return i < 0 ? '' : app.slice(i - 600, i + 900); })();
  dit(/partieDuStock\(\{ statutParti, annulee, raison: raisonDepart \}\)/.test(bloc) && /classifyOrderStatus\(String\(o\.status\)\) === 'cancelled' \|\| venteQuiRevient\(o\)/.test(bloc), 'E6 App.jsx : la sortie passe par `partieDuStock` avec la preuve partagée (`partisVinted`) et écarte annulée/retour', bloc.slice(0, 200));
  dit(/\[sales\.items, listings\.items, porteursNum, baseKO, lbcLu, lbcVentes, ebayCmd, lbcItemsBenef, ventesVc, partisVinted\]/.test(app), 'E6 l\'effet se relance quand une preuve de départ arrive (`partisVinted` dans ses dépendances)', '');
}

(async () => {
  if (process.argv.includes('--prouve')) {
    for (const m of Object.keys(MUTATIONS)) {
      const avant = ko; const log = console.log; console.log = () => {};
      try { await controles(m); } catch (e) { ko++; console.error('    (mutation « ' + m + ' » : ' + String(e && e.message).slice(0, 160) + ')'); }
      console.log = log;
      const rouge = ko > avant; ko = avant;
      dit(rouge, `mutation « ${m} » : l'audit devient ROUGE`);
    }
  } else await controles(null);
  console.log(ko ? `\n${ko} KO` : '\n✅ audit-sortie-expedition : tout est vert');
  process.exit(ko ? 1 : 0);
})();
