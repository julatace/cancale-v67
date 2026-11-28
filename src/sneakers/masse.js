// ═════════════════════════════════════════════════════════════════════════════
//  LA MODIFICATION EN MASSE (28 nov. 2026, lot sneakers-cote) — copié de Bleam Dressing, Vintedge, Vendoo, Crosslist
// ═════════════════════════════════════════════════════════════════════════════
// Il coche N annonces (tous sites) ⇒ « −x % », « nouveau prix », ou (côté VRM) la marque / la pointure ⇒ UN
// récapitulatif, ligne par ligne, puis SON « Appliquer ».
//
// ⚠️ LE PLANCHER (CLAUDE.md §3, la règle de `src/reglesAuto.js`) : le prix mini posé sur l'annonce, sinon le prix
//    d'achat + 10 % ; un prix visé sous le plancher n'est JAMAIS envoyé (« sous le plancher », dit). Sans plancher
//    connu, la ligne n'est envoyée que s'il coche « aussi celles sans plancher » dans le récapitulatif.
// ⚠️ QUI EXÉCUTE (décision de Julien du 20 nov., `src/actionsExtension.js`, `audit-actions-app`) :
//    · eBay : l'API (la route `revise` existante, confirmée, au prix VU — `envoisPrix(...).ebay`, src/prixPartout.js) ;
//    · Vinted, Leboncoin, Vestiaire : LA FILE que l'extension exécute déjà — `envoyerGeste` de src/agir/porte.js
//      (geste 'baisser', file 'prix' ⇒ une commande `cmd_dist_*` d'« À distance » par annonce, au nom du compte de
//      SON annonce, prise par l'extension qui a CE compte dans son onglet, avec tous ses garde-fous : prix relu
//      avant, 45/h, pause 429/403, captcha). C'est le chemin de « Paires qui dorment » (27 nov.). La PORTE
//      (`agirMaintenant`) dit non pour un compte (pas connecté, bloqué, extension absente) ⇒ cette ligne passe par le
//      PANNEAU de l'extension (`lienPanneau`, page « Prix », la sélection en ids) — rien ne part avant SON « Lancer ».
//      L'app ne range AUCUNE `cmd_prix_*` (« plus de baisse rangée par l'app », 20 nov.) et n'envoie aucune commande
//      de plateforme par le pont (`CMDS_PLATEFORME`). Une HAUSSE ne passe jamais par la file (§3) : le panneau.
//    · marque, pointure, référence : écrites dans VRM seulement (la fiche du N°), jamais envoyées à un site.
// Module PUR. Exécuté par scripts/audit-sneakers.cjs.
// ═════════════════════════════════════════════════════════════════════════════
import { lienPanneau } from '../ouvrirPanneau.js';

export const SITES_MASSE = ['vinted', 'ebay', 'leboncoin', 'vestiaire'];
export const MAX_MASSE = 200;   // le panneau prend 200 ids au plus (`lienPanneau`)
const c = (e) => (e == null || !Number.isFinite(Number(e)) ? null : Math.round(Number(e) * 100));

// Le plancher d'une ligne, en centimes : { cents, source: 'mini' | 'achat' } ou null.
export function plancherDe(l) {
  const m = c(l && l.mini);
  if (m != null && m > 0) return { cents: m, source: 'mini' };
  const a = c(l && l.achat);
  if (a != null && a > 0) return { cents: Math.ceil(a * 1.1), source: 'achat' };
  return null;
}

// L'opération lue : { sorte: 'pct', pct: 1..90 } (une BAISSE de x %) · { sorte: 'prix', cents } · null (illisible).
export function lireOperation(sorte, valeur) {
  const s = String(valeur == null ? '' : valeur).replace(',', '.').trim();
  if (sorte === 'pct') { if (!/^\d{1,2}(?:\.\d)?$/.test(s)) return null; const p = Number(s); return p >= 1 && p <= 90 ? { sorte: 'pct', pct: p } : null; }
  if (sorte === 'prix') { if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(s)) return null; const n = Math.round(Number(s) * 100); return n >= 100 && n < 10000000 ? { sorte: 'prix', cents: n } : null; }
  return null;
}

// LE RÉCAPITULATIF. lignes : [{ cle, site, id, compte, titre, prix (euros), devise, mini, achat }]
// Rend [{ ...ligne, avantC, apresC, plancher, etat, voie }] — etat :
//   ok · sous-plancher · sans-plancher · inchange · pas-lu · devise · hausse (jamais par la file, §3 : le panneau)
// voie : 'api' (eBay) · 'file' (Vinted, Leboncoin, Vestiaire — une baisse) · 'panneau' (une hausse sur ces sites)
export function planMasse(lignes, op) {
  if (!op) return [];
  return (lignes || []).filter((l) => l && SITES_MASSE.includes(l.site)).slice(0, MAX_MASSE * 4).map((l) => {
    const voie = l.site === 'ebay' ? 'api' : 'file';
    const base = { ...l, voie, avantC: c(l.prix), apresC: null, plancher: plancherDe(l) };
    if (l.devise && String(l.devise).toUpperCase() !== 'EUR') return { ...base, etat: 'devise' };
    if (base.avantC == null || base.avantC <= 0) return { ...base, etat: 'pas-lu' };
    const apres = op.sorte === 'pct' ? Math.round(base.avantC * (1 - op.pct / 100)) : op.cents;
    const r = { ...base, apresC: apres };
    if (apres === base.avantC) return { ...r, etat: 'inchange' };
    if (apres > base.avantC && voie === 'file') return { ...r, voie: 'panneau', etat: 'hausse' };
    if (!r.plancher) return { ...r, etat: 'sans-plancher' };
    if (apres < r.plancher.cents) return { ...r, etat: 'sous-plancher' };
    return { ...r, etat: 'ok' };
  });
}
// Les lignes qui PARTENT sur « Appliquer » : « ok », et « sans plancher » seulement s'il l'a coché.
export const lignesAEnvoyer = (plan, avecSansPlancher = false) => (plan || []).filter((l) => l.etat === 'ok' || (avecSansPlancher && l.etat === 'sans-plancher'));
export function resumePlan(plan, avecSansPlancher = false) {
  const n = {}; for (const l of plan || []) n[l.etat] = (n[l.etat] || 0) + 1;
  const part = lignesAEnvoyer(plan, avecSansPlancher);
  return { parEtat: n, partent: part.length, api: part.filter((l) => l.voie === 'api').length, file: part.filter((l) => l.voie === 'file').length,
    hausses: (plan || []).filter((l) => l.etat === 'hausse').length };
}
// Les liens du panneau : UN par site (et par compte quand il est connu), la sélection en ids, l'action du panneau
// (« baisser » pour un pourcentage, « changer » pour un prix). Rien ne part : le panneau s'ouvre sur la sélection.
// `lignes` : celles que la porte a refusées (rendues par `appliquerFile`) et les hausses.
export function liensPanneau(lignes, op) {
  const g = new Map();
  for (const l of lignes || []) {
    if (!l || l.site === 'ebay') continue;
    const k = l.site + '|' + (l.compte || '');
    const x = g.get(k) || { site: l.site, compte: l.compte || '', ids: [] };
    if (x.ids.length < MAX_MASSE) x.ids.push(String(l.id));
    g.set(k, x);
  }
  return [...g.values()].map((x) => ({ ...x, page: 'prix', action: op && op.sorte === 'pct' ? 'baisser' : 'changer', url: lienPanneau({ site: x.site, page: 'prix', ids: x.ids, action: op && op.sorte === 'pct' ? 'baisser' : 'changer' }) }));
}
// L'envoi eBay (SON clic) : une annonce à la fois, par `envoyerEbay(ligne, euros)` ⇒ { etat: fait|refuse|incertain, raison }.
export async function appliquerEbay(plan, envoyerEbay, { avecSansPlancher = false, surEtat = null } = {}) {
  const res = {};
  for (const l of lignesAEnvoyer(plan, avecSansPlancher)) {
    if (l.voie !== 'api') continue;
    if (surEtat) surEtat(l.cle, { etat: 'envoi' });
    let r;
    try { r = await envoyerEbay({ site: 'ebay', id: l.id, compte: l.compte, prix: l.prix }, l.apresC / 100); } catch (_) { r = { etat: 'incertain', raison: 'pas de réponse' }; }
    res[l.cle] = { etat: r && ['fait', 'refuse', 'incertain'].includes(r.etat) ? r.etat : 'incertain', raison: (r && r.raison) || null };
    if (surEtat) surEtat(l.cle, res[l.cle]);
  }
  return res;
}

// La FILE (SON clic) : une commande par annonce de Vinted / Leboncoin / Vestiaire, par `envoyerGeste` (src/agir/porte.js,
// donné par l'appelant). Rend { res: { [cle]: { etat: 'file' | 'panneau' | 'refuse', raison } }, panneau: [lignes] } —
// les lignes que la porte refuse (le compte n'est pas joignable) vont au panneau, jamais perdues, jamais forcées.
export async function appliquerFile(plan, envoyer, { avecSansPlancher = false, surEtat = null } = {}) {
  const res = {}, panneau = [];
  for (const l of lignesAEnvoyer(plan, avecSansPlancher)) {
    if (l.voie !== 'file') continue;
    if (surEtat) surEtat(l.cle, { etat: 'envoi' });
    let r;
    try { r = await envoyer({ site: l.site, compte: String(l.compte || ''), geste: 'baisser', distGeste: 'prix', args: { id: String(l.id), prix: l.apresC / 100, prixAvant: l.avantC / 100 }, num: l.num || '', avant: l.avantC / 100 }); } catch (_) { r = { ok: false, raison: 'base' }; }
    if (r && r.ok) res[l.cle] = { etat: 'file', raison: null, id: r.id || null };
    else if (r && r.raison === 'deja') res[l.cle] = { etat: 'file', raison: 'deja' };
    else if (r && r.verdict) { res[l.cle] = { etat: 'panneau', raison: r.raison || null }; panneau.push(l); }
    else res[l.cle] = { etat: 'refuse', raison: (r && r.raison) || 'base' };
    if (surEtat) surEtat(l.cle, res[l.cle]);
  }
  return { res, panneau };
}
