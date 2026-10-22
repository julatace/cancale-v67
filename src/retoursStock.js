// ── RETOUR → STOCK (fonction retenue par Julien le 11 octobre) ─────────────────
// Un retour acheteur est suivi jusqu'à son retour en stock : initié · en route
// · reçu chez toi · remboursé, puis « remis en stock » sur SON clic.
//
// Mesuré le 21 octobre (lecture seule, sa base) :
//   · la transaction d'une VENTE en retour porte `status` 440 (« Retour
//     initié ») ; son `ship_status_title` dit où en est le colis de RETOUR :
//     vide ou « Bordereau envoyé au vendeur » (pas encore parti), « colis
//     déposé en bureau de Poste ou point relais » (en route), « Commande
//     livrée ! » (Vinted dit livré — ⚠️ ambigu : ce peut être la livraison
//     d'origine, jamais lu comme « reçu chez toi ») ;
//   · la liste des ventes (`orders_sold`) passe ensuite à « Remboursement
//     effectué » (`transaction_user_status: failed`) — les transactions, elles,
//     restent à 440 pour toujours (un instantané : jamais relues) ;
//   · « Commande non réclamée - Retournée à l'expéditeur » : la paire revient
//     aussi (jamais livrée).
//   · Une transaction 440 d'un ACHAT n'est pas un retour d'une vente : seules
//     les VENTES entrent ici (le caller ne passe que `orders_sold`).
//
// Règles (§5) : la paire se reconnaît par son IDENTITÉ — la correction posée
// sur la vente (`numeroVente`), sinon transaction → annonce (`txnItem`) → fiche
// N° (`numeros[itemId].numero`). JAMAIS le titre : deux paires au même titre
// ne se confondent pas. Sans identité, la ligne dit « paire pas reliée » et
// n'a pas de geste de remise en stock.
// « Reçu chez toi » n'est jamais déduit : c'est SON clic (`recus`). Rien ne
// change tout seul. Le CA ne se touche pas ici : une vente remboursée sort
// déjà du CA déclaré par les règles existantes (§11, une seule règle).

export const ETAPES_RETOUR = ['initie', 'en-route', 'recu', 'rembourse'];
export const LIBELLE_ETAPE = {
  initie: 'Retour initié',
  'en-route': 'En route vers toi',
  recu: 'Reçu chez toi',
  rembourse: 'Remboursé',
};

const RE_RETOUR = /retour\s*initi|retour\s*en\s*cours|retour\s*demand/i;
const RE_NON_RECLAME = /non\s*r[ée]clam/i;
const RE_REMBOURSE = /rembours/i;
const RE_EN_ROUTE = /d[ée]pos[ée]|acheminement|en\s*cours\s*de\s*livraison|transit|en\s*route/i;
const RE_LIVRE = /livr[ée]e?\s*!?\s*$|commande\s*livr/i;

// L'étape d'une VENTE Vinted, ou `null` si ce n'est pas un retour.
// `etat` = l'état de la transaction (`TXN_ETATS` : { s, ss }) ou null (pas lu).
export function etapeRetourVinted(vente, etat) {
  if (!vente) return null;
  const st = String(vente.status || '');
  const s = etat && isFinite(Number(etat.s)) ? Number(etat.s) : null;
  const ss = String((etat && etat.ss) || '');
  const retour = s === 440 || RE_RETOUR.test(st);
  const nonReclamee = RE_NON_RECLAME.test(st) || RE_NON_RECLAME.test(ss);
  if (!retour && !nonReclamee) return null;
  const origine = retour ? 'retour' : 'non-reclamee';
  const rembourse = RE_REMBOURSE.test(st) || String(vente.transaction_user_status || '') === 'failed';
  // Une transaction figée à 440 dont la VENTE est finalisée (mesuré : 1 cas) :
  // le retour n'a pas eu lieu, la paire est chez l'acheteur — rien ne revient.
  if (!rembourse && (/finalis/i.test(st) || String(vente.transaction_user_status || '') === 'completed')) return null;
  let etape = 'initie', livreeSelonVinted = false;
  if (nonReclamee) etape = 'en-route';
  if (RE_EN_ROUTE.test(ss)) etape = 'en-route';
  else if (retour && RE_LIVRE.test(ss)) { etape = 'en-route'; livreeSelonVinted = true; }
  if (rembourse) etape = 'rembourse';
  return { etape, origine, rembourse, livreeSelonVinted };
}

// L'étape d'un retour eBay (Post-Order, `retoursEbay`), ou `null` s'il est
// clos SANS remboursement (refusé, annulé) — il ne revient rien.
export function etapeRetourEbay(r) {
  if (!r) return null;
  const e = String(r.etat || '').toUpperCase();
  const rembourse = !!r.rembourse || /REFUND_ISSUED|CLOSED_WITH_REFUND/.test(e);
  if (!rembourse && /^(CLOSED|RETURN_CLOSED)$/.test(e)) return null;
  let etape = 'initie', livreeSelonVinted = false;
  if (/SHIPPED|IN_TRANSIT/.test(e)) etape = 'en-route';
  if (/DELIVERED|RECEIVED/.test(e)) { etape = 'en-route'; livreeSelonVinted = true; }
  if (rembourse) etape = 'rembourse';
  return { etape, origine: 'retour', rembourse, livreeSelonVinted };
}

// Le N° d'une vente Vinted, par identité seulement.
export function numeroDuRetourVinted(vente, { txnItem, numeros, numeroVente }) {
  const tx = vente && vente.transaction_id != null ? String(vente.transaction_id) : '';
  if (!tx) return { num: null, itemId: null };
  const corr = numeroVente ? numeroVente(tx) : null;
  const itemId = txnItem && txnItem[tx] != null ? String(txnItem[tx]) : null;
  if (corr) return { num: String(corr), itemId };
  if (!itemId) return { num: null, itemId: null };
  const e = numeros && numeros[itemId];
  const n = e && String(e.numero || '').trim();
  return { num: n || null, itemId };
}

// Toutes les lignes « retour ». TROIS états :
//   · `etat: 'encours'` — les ventes ne sont pas encore lues ;
//   · `etat: 'passu'`   — les ventes n'ont pas pu être lues (aucune ligne) ;
//   · `etat: 'lu'`      — `lignes` (en cours) + `remises` (remises en stock,
//                         pas encore republiées) ; `manques` nomme ce qui n'a
//                         pas pu être lu (états des transactions, eBay).
// `ebay` : `undefined` pas encore lu · `null` pas su · liste de retours
// `{ retour, compte, num }` (le N° résolu par le caller, par SKU).
// `ancien` : remboursé, pas noté reçu, vente de plus de 45 jours — montré replié
// (il a sans doute récupéré la paire depuis longtemps), jamais caché.
export const RETOUR_ANCIEN_J = 45;
export function retoursEnCours({ ventes, etats, txnItem, numeros, numeroVente, recus, remis, masques, republiee, ebay, maintenant }) {
  const now = isFinite(maintenant) ? maintenant : Date.now();
  if (ventes === undefined) return { etat: 'encours', lignes: [], remises: [], manques: [] };
  if (ventes === null) return { etat: 'passu', lignes: [], remises: [], manques: ['tes ventes Vinted'] };
  const manques = [];
  if (etats === null) manques.push('l\'état des transactions Vinted');
  if (ebay === null) manques.push('tes retours eBay');
  const R = recus || {}, M = remis || {}, X = masques || {};
  const lignes = [], remises = [];
  const vus = new Set();
  for (const o of ventes) {
    const tx = o && o.transaction_id != null ? String(o.transaction_id) : '';
    if (!tx || vus.has(tx)) continue;
    vus.add(tx);
    const et = etapeRetourVinted(o, etats ? etats(tx) : null);
    if (!et) continue;
    if (X[tx]) continue;
    const { num, itemId } = numeroDuRetourVinted(o, { txnItem, numeros, numeroVente });
    const cle = tx;
    const ligne = { cle, plateforme: 'vinted', tx, itemId, num, vente: o, compte: o._acc || '', titre: String(o.title || ''),
      ...et, recu: !!R[cle], recuLe: R[cle] || null };
    const d = Date.parse(o.date || '');
    ligne.ancien = et.etape === 'rembourse' && !ligne.recu && isFinite(d) && (now - d) > RETOUR_ANCIEN_J * 864e5;
    if (M[cle]) {
      if (republiee && republiee(ligne)) continue;
      remises.push({ ...ligne, remis: M[cle] });
      continue;
    }
    lignes.push(ligne);
  }
  for (const x of (Array.isArray(ebay) ? ebay : [])) {
    const r = x && x.retour; if (!r || !r.returnId) continue;
    const et = etapeRetourEbay(r); if (!et) continue;
    const cle = 'ebay:' + r.returnId;
    if (X[cle]) continue;
    const ligne = { cle, plateforme: 'ebay', returnId: String(r.returnId), orderId: String(r.orderId || ''), itemId: String(r.itemId || ''),
      num: x.num ? String(x.num) : null, compte: x.compte || '', titre: String(r.titre || ''), ...et, recu: !!R[cle], recuLe: R[cle] || null, ancien: false };
    if (M[cle]) { if (republiee && republiee(ligne)) continue; remises.push({ ...ligne, remis: M[cle] }); continue; }
    lignes.push(ligne);
  }
  const rang = (l) => (l.ancien ? 100 : 0) + (l.recu ? 0 : 1) * 10 + ETAPES_RETOUR.indexOf(l.etape);
  lignes.sort((a, b) => rang(a) - rang(b));
  return { etat: 'lu', lignes, remises, manques };
}

// « Remise en stock », sur SON clic. Le N° est GARDÉ (§5 : un numéro n'est
// jamais réattribué). Rend ce que le geste doit DEMANDER — jamais deviné :
//   · `{ ok: false, raison: 'pas-recu' }`      le colis n'est pas noté reçu ;
//   · `{ ok: false, raison: 'sans-numero' }`   aucune identité : rien à garder ;
//   · `{ ok: true, num, archive, conflit }`    `conflit` = l'autre fiche
//     PRÉSENTE (en ligne ou à confirmer) qui porte ce N° — le geste demande ;
//     `archive` = ancien numéro (013) : la paire republiée prendra un numéro
//     neuf (un ancien numéro ne se redonne jamais).
export function remiseEnStock(ligne, { numeros, presentes, cleNum, estArchive }) {
  if (!ligne || !ligne.recu) return { ok: false, raison: 'pas-recu' };
  if (!ligne.num) return { ok: false, raison: 'sans-numero' };
  const k = cleNum ? cleNum(ligne.num) : String(ligne.num);
  let conflit = null;
  for (const id in (numeros || {})) {
    if (ligne.itemId && String(id) === String(ligne.itemId)) continue;
    const e = numeros[id];
    if (!e || !String(e.numero || '').trim()) continue;
    if ((cleNum ? cleNum(e.numero) : String(e.numero)) !== k) continue;
    if (presentes && !presentes.has(String(id))) continue;
    conflit = { id: String(id), titre: String(e.title || '') };
    break;
  }
  return { ok: true, num: String(ligne.num), archive: !!(estArchive && estArchive(ligne.num)), conflit };
}
