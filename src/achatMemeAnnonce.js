// ══════════════════════════════════════════════════════════════════════════════
//  « TU AS DÉJÀ ACHETÉ CETTE ANNONCE » (14 nov., lot messages-achats-plus, n° 131)
//  docs/passation/2026-11-14-messages-achats-plus.md
// ══════════════════════════════════════════════════════════════════════════════
// Une annonce Vinted achetée deux fois (deux transactions, le même identifiant
// d'annonce) se SIGNALE — par IDENTITÉ seulement (§5) : l'`item_id` exact de la
// transaction d'achat (le détail de la transaction, `meta->>item_id`), sur TOUS ses
// comptes. Jamais par titre, photo, marque, taille ou prix : cinquante achats au
// même titre ne font aucun signal ; deux titres différents sous le même identifiant
// en font un.
// Où : dans Achats (« Même annonce achetée 2 fois ») et dans l'encart VRM de
// l'extension sur la page de l'annonce (« Déjà achetée le … »). Rien n'est bloqué,
// rien n'est masqué : c'est un signal.
// La carte est PUBLIÉE par l'écran Achats (§11 : l'écran qui a toutes les sources
// publie) dans `vrm_annonces_achetees` (ligne `main`) : { v, at, total, connus,
// ids: { [itemId]: [{ tx, c, d }] } } — la transaction, le compte, la date ; ni
// prix, ni titre, ni pseudo. L'extension la LIT (aucune requête Vinted).
// La couverture est dite : « annonce connue pour N achats sur M » (un achat dont la
// transaction n'a pas encore été relue n'a pas d'identifiant d'annonce).
// Recopiée dans l'extension par scripts/regles-achat-extension.cjs.
// Module PUR : exécuté par scripts/audit-messages-achats-plus.cjs et audit-identite.cjs.
// ══════════════════════════════════════════════════════════════════════════════

export const CLE_ANNONCES_ACHETEES = 'vrm_annonces_achetees';
const idOk = (v) => { const s = String(v == null ? '' : v).trim(); return /^\d{4,15}$/.test(s) ? s : ''; };
const txOk = (v) => { const s = String(v == null ? '' : v).trim(); return /^\d{4,20}$/.test(s) ? s : ''; };

// achats : les achats Vinted LUS ({ transaction_id, date, _acc: { vinted_user_id } }) ;
// itemDeTx : { [tx]: itemId } (le détail des transactions) ; estAnnule(o) : la règle
// de « Dépensé » (un achat annulé n'est pas un achat).
export function annoncesAchetees({ achats = [], itemDeTx = {}, estAnnule = null, maintenant = Date.now() } = {}) {
  const ids = {};
  let total = 0, connus = 0;
  const vus = new Set();
  for (const o of (Array.isArray(achats) ? achats : [])) {
    const tx = txOk(o && o.transaction_id); if (!tx || vus.has(tx)) continue;
    vus.add(tx);
    if (typeof estAnnule === 'function' && estAnnule(o)) continue;
    total++;
    const item = idOk(itemDeTx && itemDeTx[tx]); if (!item) continue;
    connus++;
    const c = o._acc && o._acc.vinted_user_id != null ? String(o._acc.vinted_user_id) : '';
    const t = Date.parse(o.date || '');
    (ids[item] || (ids[item] = [])).push({ tx, c, d: Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '' });
  }
  for (const k of Object.keys(ids)) ids[k].sort((a, b) => String(a.d).localeCompare(String(b.d)) || a.tx.localeCompare(b.tx));
  return { v: 1, at: new Date(maintenant).toISOString(), total, connus, ids };
}
// Les achats de CETTE annonce (identifiant exact), ou [] ; carte illisible ⇒ [].
export function achatsDeLAnnonce(carte, itemId) {
  const id = idOk(itemId);
  if (!id || !carte || typeof carte !== 'object' || !carte.ids || typeof carte.ids !== 'object') return [];
  const l = carte.ids[id];
  return Array.isArray(l) ? l.filter((x) => x && txOk(x.tx)) : [];
}
// Les annonces achetées AU MOINS deux fois : [{ item, achats }], les plus récentes d'abord.
export function groupesMemeAnnonce(carte) {
  if (!carte || !carte.ids || typeof carte.ids !== 'object') return [];
  const out = [];
  for (const [item, l] of Object.entries(carte.ids)) {
    const a = achatsDeLAnnonce(carte, item);
    if (new Set(a.map((x) => x.tx)).size >= 2) out.push({ item, achats: a });
  }
  out.sort((x, y) => String(y.achats[y.achats.length - 1].d).localeCompare(String(x.achats[x.achats.length - 1].d)) || x.item.localeCompare(y.item));
  return out;
}
// La version allégée envoyée par l'extension à la page : seulement les achats de l'annonce ouverte.
export const dejaAchete = (carte, itemId) => achatsDeLAnnonce(carte, itemId).length > 0;
