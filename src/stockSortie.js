// ── LE STOCK EN 2D : UN ARTICLE VENDU, SA CASE, ET LA SORTIE TOUTE SEULE ──────
// (5 nov. 2026, demande de Julien) « Article rangé puis vendu : sa case en
// surbrillance jusqu'à ce qu'on l'enlève ; oubliée, elle se vide quand le colis
// est expédié. »
//
// Module PUR (aucun accès au navigateur ni à la base) : l'écran Stock
// (`StockMeubles`), la sortie automatique (`sortirPartisDuStock`, App.jsx) et
// `scripts/audit-stock-2d.cjs` exécutent les MÊMES fonctions (§11).
//
// ⚠️ UNE RÈGLE : « parti » est décidé AILLEURS, une seule fois — par
//    `venteSortieDuStock` (Vinted : le colis est en acheminement, déposé, livré,
//    finalisé), `lbcExpediee`/`lbcFinalisee`, eBay « Expédiée », Vestiaire
//    `vcVentePartie` — qui fabriquent les CANDIDATS ({ cle, num, … }). Ici on
//    ne fait que libérer la case de ces candidats-là. Rien n'est deviné.
// ⚠️ L'IDENTITÉ d'une place est le NUMÉRO (`cle` = `cleNum`), jamais le titre (§5).
// ⚠️ Le NUMÉRO n'est jamais touché : seule la case se libère (il est écrit sur
//    un carton, il sert encore au bordereau, au bénéfice, à un retour).
// ⚠️ « Remettre » (sur son clic) pose `garder[cle]` : une paire remise n'est
//    plus jamais sortie toute seule.
// ⚠️ (15 nov., étagères) Dans une colonne EN PILE, les cartons du dessus descendent d'un
//    cran par case libérée (`tasserPiles`, src/stockEtageres.js) — l'emplacement change,
//    jamais le N° — et chaque descente est rendue (`descentes`) pour être DITE.

import { tasserPiles } from './stockEtageres.js';
const seulement = (ms, ids) => { const set = new Set(ids.map(String)); return ms.filter((m) => m && set.has(String(m.id))); };

const cleDefaut = (n) => {
  const s = String(n == null ? '' : n).toUpperCase().replace(/\s+/g, '').replace(/^N[°O]?(?=\d)/, '');
  const m = /^([A-Z]*)0*(\d+)$/.exec(s);
  return m ? m[1] + m[2] : s;
};

// (16 nov., lot retirer-case-compact — Julien : « dans le Stock, quand une paire est vendue ET expédiée, elle est
// d'office supprimée du Stock ; il faut bien tout articuler ») LA RÈGLE UNIQUE de la sortie à l'expédition :
//   · une vente annulée, un retour, une non réclamée (`annulee`, PAS_UNE_VENTE) ⇒ JAMAIS ;
//   · le statut de la plateforme dit le colis parti (`statutParti` : `venteSortieDuStock`, lbc/eBay/Vestiaire) ⇒ OUI ;
//   · sinon, une preuve de DÉPART du TRANSPORTEUR pour le n° de suivi EXACT du bordereau de CETTE transaction
//     (`ventesPartiesParPreuve`, api/_lib/depart-vente.js : `email` de dépôt/en route/livré, ou `transporteur`, la prise
//     en charge lue) ⇒ OUI, même si la liste Vinted dit encore « à expédier » ;
//   · « Colis fait » coché, « expédié » à la main, « traité » au panneau ne suffisent PAS (décision du 27 oct. : un
//     colis coché peut ne jamais être parti) — la case reste allumée, son toucher la sort ;
//   · rien lu (raison absente, lecture ratée ⇒ `null`) ⇒ NON : une absence ne sort jamais une paire.
export const PREUVES_DEPART_STOCK = Object.freeze(['email', 'transporteur']);
export function partieDuStock({ statutParti = false, annulee = false, raison = null } = {}) {
  if (annulee) return false;
  if (statutParti === true) return true;
  return !!(raison && typeof raison === 'object' && PREUVES_DEPART_STOCK.includes(raison.type));
}

// La case d'un meuble, en mots (rangée en partant du haut, colonne depuis la gauche).
export function placeCase(i, meuble) {
  const cols = Math.max(1, Number(meuble && meuble.cols) || 1);
  return { rangee: Math.floor(i / cols) + 1, colonne: (i % cols) + 1 };
}

// Libère les cases de « Mes meubles » (`vrm_slots`) des articles PARTIS.
//   slots     { [cle]: { m, i } }       — la case de chaque N°
//   meubles   [{ id, name, cols, rows }]
//   candidats [{ cle, num, tx, titre, statut, plateforme }] — décidés par la règle de sortie
//   garder    { [cle]: ts }              — remis à la main : jamais retirés tout seuls
// Rend { slots, sortis, descentes } ; `slots` est le MÊME objet si rien ne bouge.
export function libererCasesPartis({ slots, meubles, candidats, garder = {}, cle = cleDefaut, maintenant = Date.now() } = {}) {
  if (!slots || typeof slots !== 'object') return { slots, sortis: [], descentes: [] };
  const ms = Array.isArray(meubles) ? meubles : [];
  let out = slots; const sortis = [];
  for (const c of (Array.isArray(candidats) ? candidats : [])) {
    const k = cle(c && (c.cle || c.num)); if (!k) continue;
    if (garder && garder[k]) continue;
    const s = out[k]; if (!s) continue;
    const m = ms.find((x) => x && x.id === s.m);
    if (out === slots) out = { ...slots };
    delete out[k];
    const p = m ? placeCase(s.i, m) : null;
    sortis.push({ ...c, cle: k, source: 'meubles', meubleId: s.m, i: s.i, itemName: m ? String(m.name || 'Meuble') : 'Meuble supprimé',
      nom: p ? `rangée ${p.rangee}, colonne ${p.colonne}` : '', at: maintenant });
  }
  if (!sortis.length) return { slots: out, sortis, descentes: [] };
  // La gravité des piles, APRÈS les sorties (une sortie prouvée, et rien d'autre, vide une case).
  const t = tasserPiles(out, seulement(ms, sortis.map((x) => x.meubleId)));
  const descentes = t.descentes;
  // Chaque sortie dit qui est descendu dans SON meuble (le journal « Cases libérées toutes seules »).
  for (const x of sortis) { const d = descentes.filter((y) => y.m === String(x.meubleId)).map((y) => y.cle); if (d.length) x.descendus = [...new Set(d)]; }
  return { slots: t.slots, sortis, descentes };
}

// Remettre (sur SON clic) un article sorti tout seul : dans SA case si elle
// est encore libre et que le meuble existe ; sinon rien n'est posé (il choisit).
// Rend { slots, remise: true | false, raison }.
export function remettreCase({ slots, meubles, sorti, cle = cleDefaut } = {}) {
  const k = cle(sorti && (sorti.cle || sorti.num));
  if (!k || !slots) return { slots, remise: false, raison: 'numéro illisible' };
  if (slots[k]) return { slots, remise: true, raison: 'déjà rangé' };
  const m = (Array.isArray(meubles) ? meubles : []).find((x) => x && x.id === sorti.meubleId);
  if (!m) return { slots, remise: false, raison: 'le meuble n’existe plus' };
  const i = Number(sorti.i);
  if (!(i >= 0 && i < (Number(m.cols) || 1) * (Number(m.rows) || 1))) return { slots, remise: false, raison: 'la case n’existe plus' };
  if (Object.keys(slots).some((c) => slots[c] && slots[c].m === m.id && slots[c].i === i)) return { slots, remise: false, raison: 'sa case est prise' };
  return { slots: { ...slots, [k]: { m: m.id, i } }, remise: true, raison: '' };
}

// Un article reste-t-il montré dans le Stock 2D ?
//   · posé dans une case : OUI, toujours — même vendu, il est montré (en
//     surbrillance) jusqu'à ce qu'il l'enlève ou que le colis parte ;
//   · pas posé, vendu (preuve de vente, `vrm_stock_vendus`) ET plus présent
//     (`vinted_nums_physiques` : annonce en ligne ou colis pas encore parti) :
//     NON — il est parti, il ne revient pas dans « À ranger » ;
//   · « pas su » (liste des présents jamais publiée : `physiques` null) : OUI,
//     comme avant — on ne cache jamais sur une absence de lecture ;
//   · REMISE à la main (« Remettre », `garder`) : OUI — il a dit qu'elle est
//     chez lui ; si sa case était prise, elle attend dans « À ranger » (avant,
//     elle disparaissait de l'écran : ni case, ni « À ranger », ni journal).
export function resteAuStock(f, { pose, vendus, physiques, garder, cle = cleDefaut } = {}) {
  const k = cle(f && f.numero); if (!k) return false;
  if (pose) return true;
  if (garder && garder[k]) return true;
  if (!physiques) return true;
  if (vendus && vendus.has(k) && !physiques.has(k)) return false;
  return true;
}

// L'état d'une case, une règle pour l'écran et le banc :
//   'vide' · 'occupee' · 'vendue' (accent, jamais rouge : rien d'irréversible)
export function etatCase(occupant, { vendus, cle = cleDefaut } = {}) {
  if (!occupant) return 'vide';
  return vendus && vendus.has(cle(occupant.numero)) ? 'vendue' : 'occupee';
}
