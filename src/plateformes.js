// ════════════════════════════════════════════════════════════════════════════
//  LES PLATEFORMES, UNE SEULE FORME (5 novembre 2026, demande de Julien)
// ════════════════════════════════════════════════════════════════════════════
// « Les mêmes onglets que Vinted pour Leboncoin, eBay et Vestiaire, séparés par
// le logo de chaque plateforme » — « Ventes : le compte sur lequel l'article a
// été vendu doit apparaître ».
//
// Module PUR (aucune lecture, aucun React) : la coque, le sélecteur à logos
// (`src/SelecteurSites.jsx`), les listes de ventes et
// `scripts/audit-plateformes-logo.cjs` lisent CES règles (§11).
//
//  · PLATEFORMES : l'ordre, le nom, le logo (servi localement, `public/brands/`).
//  · ONGLETS_PLATEFORME : les MÊMES onglets pour chaque site (ceux de Vinted).
//  · optionsSelecteur : ce que le sélecteur montre — « Tous » quand l'écran le
//    permet, puis les sites où il a un compte (`sites` : Set, `null` = pas su ⇒
//    tous) ; le site choisi reste toujours montré.
//  · ONGLET_SANS_DONNEE : quand un site n'a rien d'écrit pour un onglet, ce qui
//    manque ET le geste (§2.7 : une phrase qui ne dit pas quoi faire ne sert à rien).
//  · nomCompteVente : le compte d'une vente, PAR SON IDENTITÉ (l'uid Vinted, le
//    compte Leboncoin de la transaction, la référence du compte eBay, l'id du
//    compte Vestiaire) — jamais deviné : inconnu ⇒ '' (rien d'écrit plutôt
//    qu'un faux, §5).

export const PLATEFORMES = Object.freeze([
  Object.freeze({ id: 'vinted', nom: 'Vinted', logo: '/brands/vinted.svg' }),
  Object.freeze({ id: 'leboncoin', nom: 'Leboncoin', logo: '/brands/leboncoin.svg' }),
  Object.freeze({ id: 'ebay', nom: 'eBay', logo: '/brands/ebay.svg' }),
  Object.freeze({ id: 'vestiaire', nom: 'Vestiaire', logo: '/brands/vestiaire.svg' }),
]);
export const IDS_PLATEFORMES = Object.freeze(PLATEFORMES.map((p) => p.id));
export const plateforme = (id) => PLATEFORMES.find((p) => p.id === id) || null;
export const nomPlateforme = (id) => (plateforme(id) || {}).nom || '';
export const logoPlateforme = (id) => (plateforme(id) || {}).logo || '';

// Les onglets de Vinted, les mêmes pour chaque site.
export const ONGLETS_PLATEFORME = Object.freeze(['annonces', 'ventes', 'achats', 'messages', 'colis']);
export const NOM_ONGLET = Object.freeze({ annonces: 'Annonces', ventes: 'Ventes', achats: 'Achats', messages: 'Messages', colis: 'Colis' });

// Le sélecteur. `toutes` : l'écran a « Tous » (Ventes, Colis). Rend
// [{ id, nom, court, logo }] — `id: 'toutes'` sans logo.
export function optionsSelecteur({ site = null, sites = null, toutes = false } = {}) {
  const voit = (id) => !sites || (typeof sites.has === 'function' && sites.has(id)) || id === site;
  const out = toutes ? [{ id: 'toutes', nom: 'Tous les sites', court: 'Tous', logo: '' }] : [];
  for (const p of PLATEFORMES) if (voit(p.id)) out.push({ id: p.id, nom: p.nom, court: p.nom, logo: p.logo });
  return out;
}

// ── Un onglet sans donnée : ce qui manque, le geste ─────────────────────────
// Le texte dit D'OÙ la donnée viendrait et QUEL geste la fait venir. « Rien lu »
// n'est jamais « rien » (§5) : ces phrases ne s'affichent que quand le site n'a
// JAMAIS rien écrit pour cet onglet (lecture faite, ligne absente).
export const ONGLET_SANS_DONNEE = Object.freeze({
  leboncoin: Object.freeze({
    annonces: { manque: 'Tes annonces Leboncoin ne sont pas encore lues.', geste: 'Ouvre « Mes annonces » sur leboncoin.fr, dans le navigateur où l’extension est installée.' },
    ventes: { manque: 'Tes ventes Leboncoin ne sont pas encore lues.', geste: 'Ouvre « Mes transactions » sur leboncoin.fr, avec l’extension à jour.' },
    achats: { manque: 'Tes achats Leboncoin ne sont pas encore lus.', geste: 'Ouvre « Mes transactions » sur leboncoin.fr : les achats arrivent avec les ventes.' },
    messages: { manque: 'Tes conversations Leboncoin ne sont pas encore lues.', geste: 'Ouvre la messagerie sur leboncoin.fr avec l’extension à jour.' },
    colis: { manque: 'Aucun bordereau Leboncoin lu.', geste: 'Ouvre la vente sur leboncoin.fr : l’extension relève le bordereau et le QR.' },
  }),
  ebay: Object.freeze({
    annonces: { manque: 'Aucun compte eBay relié.', geste: 'Paramètres → Comptes liés → eBay : connecte ton compte.' },
    ventes: { manque: 'Aucun compte eBay relié.', geste: 'Paramètres → Comptes liés → eBay : connecte ton compte.' },
    achats: { manque: 'Aucun compte eBay relié.', geste: 'Paramètres → Comptes liés → eBay : connecte ton compte.' },
    messages: { manque: 'Aucun compte eBay relié.', geste: 'Paramètres → Comptes liés → eBay : connecte ton compte.' },
    colis: { manque: 'Aucune commande eBay à expédier lue.', geste: 'Paramètres → Comptes liés → eBay : connecte ton compte.' },
  }),
  vestiaire: Object.freeze({
    annonces: { manque: 'Tes annonces Vestiaire ne sont pas encore lues.', geste: 'Ouvre « Mes articles » sur vestiairecollective.com, avec l’extension à jour.' },
    ventes: { manque: 'Tes ventes Vestiaire ne sont pas encore lues.', geste: 'Ouvre « Mes ventes » sur vestiairecollective.com, avec l’extension à jour.' },
    achats: { manque: 'Tes achats Vestiaire ne sont pas encore lus.', geste: 'Ouvre « Mes achats » sur vestiairecollective.com, avec l’extension à jour.' },
    messages: { manque: 'Tes conversations Vestiaire ne sont pas encore lues.', geste: 'Ouvre la messagerie (/chat/) sur vestiairecollective.com, puis une conversation.' },
    colis: { manque: 'Aucune vente Vestiaire à expédier lue.', geste: 'Ouvre « Mes ventes » sur vestiairecollective.com, avec l’extension à jour.' },
  }),
  vinted: Object.freeze({
    annonces: { manque: 'Tes annonces Vinted ne sont pas encore lues.', geste: 'Ouvre vinted.fr connecté, dans le navigateur où l’extension est installée.' },
    ventes: { manque: 'Tes ventes Vinted ne sont pas encore lues.', geste: 'Ouvre vinted.fr connecté, dans le navigateur où l’extension est installée.' },
    achats: { manque: 'Tes achats Vinted ne sont pas encore lus.', geste: 'Ouvre vinted.fr connecté, dans le navigateur où l’extension est installée.' },
    messages: { manque: 'Tes conversations Vinted ne sont pas encore lues.', geste: 'Ouvre ta messagerie sur vinted.fr, avec l’extension à jour.' },
    colis: { manque: 'Aucun bordereau Vinted lu.', geste: 'Ouvre vinted.fr connecté : l’extension relève tes ventes à expédier.' },
  }),
});
// → { manque, geste } ou null (site/onglet inconnu : on ne dit rien plutôt qu'un faux).
export const ongletSansDonnee = (site, onglet) => {
  const s = ONGLET_SANS_DONNEE[site];
  return (s && s[onglet]) || null;
};

// ── Le compte d'une vente, par identité ─────────────────────────────────────
// annuaire : { vinted: {uid: nom}, leboncoin: {id: nom}, ebay: {ref: nom}, vestiaire: {id: nom} }
// vente    : la ligne telle que lue sur SON site.
//   vinted    → `_acc.vinted_user_id` (le compte qui a lu la vente) ;
//   leboncoin → `account` (la transaction porte son compte ; « lbc-account:ID » = ID) ;
//   ebay      → `_compte` (la référence du compte dont la ligne de commandes vient ;
//               absente = « principal », la première ligne `ebay_orders`) ;
//   vestiaire → `compte` (l'id du compte relevé par l'extension).
// Un compte connu de l'identité mais sans nom lu ⇒ son identifiant court
// (« n° 8442aaaa »), jamais un nom deviné ; aucune identité ⇒ ''.
const idLbc = (v) => String(v == null ? '' : v).trim().replace(/^lbc-account:/i, '');
export function identiteCompteVente(site, vente) {
  const v = vente || {};
  if (site === 'vinted') { const u = v._acc && v._acc.vinted_user_id != null ? String(v._acc.vinted_user_id) : (v.accountId != null ? String(v.accountId) : ''); return u; }
  if (site === 'leboncoin') return idLbc(v.account);
  if (site === 'ebay') return v._compte ? String(v._compte) : (v.orderId || v.id ? 'principal' : '');
  if (site === 'vestiaire') return v.compte != null && /^[\w-]{1,40}$/.test(String(v.compte)) ? String(v.compte) : '';
  return '';
}
export function nomCompteVente(site, vente, annuaire) {
  const id = identiteCompteVente(site, vente);
  if (!id) return '';
  const a = (annuaire && annuaire[site]) || {};
  const nom = a[id] != null ? String(a[id]).trim() : '';
  if (nom) return nom.slice(0, 64);
  if (site === 'vinted') { const l = vente && vente._acc && vente._acc.login; return l ? String(l).slice(0, 64) : `#${id}`; }
  if (site === 'ebay') return id === 'principal' ? 'Compte principal' : `n° ${id.slice(0, 8)}`;
  if (site === 'vestiaire') return id === '-' ? '' : `n° ${id.slice(0, 8)}`;
  return `n° ${id.slice(0, 8)}`;
}
// L'annuaire Leboncoin depuis `lbc_accounts.accounts` (« 8442… » et
// « lbc-account:8442… » = UN compte ; le nom tel que Leboncoin l'a donné).
export function annuaireLbc(accounts) {
  const out = {};
  for (const [cle, a] of Object.entries(accounts && typeof accounts === 'object' ? accounts : {})) {
    if (!a || typeof a !== 'object') continue;
    const id = idLbc(a.id || cle);
    if (!id) continue;
    if (!out[id] && typeof a.name === 'string' && a.name.trim()) out[id] = a.name.trim().slice(0, 64);
    else if (!(id in out)) out[id] = '';
  }
  return out;
}
