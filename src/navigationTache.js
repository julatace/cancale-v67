// ── LA NAVIGATION « PAR TÂCHE » (31 octobre, décision de Julien : « A · par
// tâche, en améliorant encore ») ─────────────────────────────────────────────
// La barre ne range plus les écrans par SITE (Vinted · Leboncoin · eBay) mais
// par CE QU'IL FAIT : Journée · Annonces · Ventes · Colis · Plus. Dans Annonces,
// Ventes et Messages, une rangée de filtres de site choisit QUEL site on
// regarde ; le filtre « Vinted » rend EXACTEMENT l'écran Vinted d'avant (mêmes
// composants, aucune copie, §11), « Leboncoin »/« eBay »/« Vestiaire » l'écran
// de ce site.
//
// Ce module ne porte que la RÈGLE, sans React : quelles tâches, quels sites,
// et où mène un ancien identifiant d'onglet. L'app (`setTab`) et les bancs la
// lisent ; elle n'existe qu'ici.
//
// ⚠️ « Toutes » n'existe que pour Ventes : chaque site a sa propre règle
// « en ligne » (Vinted : dernière lecture COMPLÈTE de moins de 24 h, masquées
// par Vinted, « à confirmer » ; Leboncoin : listes complètes par compte et
// annonces disparues ; eBay : statut de l'annonce ; Vestiaire : lecture
// complète). Une liste mélangée des ANNONCES devrait recopier ces quatre règles
// hors de leur écran (deux règles pour une notion, §11) ou montrer « en ligne »
// une paire que l'écran du site dit « à confirmer ». Les VENTES, elles, sont
// déjà lues par la coque, site par site, avec leurs trois états.

export const SITES_TACHE = [
  { id: 'vinted', label: 'Vinted' },
  { id: 'leboncoin', label: 'Leboncoin' },
  { id: 'ebay', label: 'eBay' },
  { id: 'vestiaire', label: 'Vestiaire' },
];
const IDS_SITES = SITES_TACHE.map((s) => s.id);

// Les écrans qui portent la rangée de filtres de site, et s'ils ont « Toutes ».
export const TACHES_SITE = {
  ventes: { toutes: true },
  annonces: { toutes: false },
  messages: { toutes: false },
};
export const estTacheSite = (tab) => Object.prototype.hasOwnProperty.call(TACHES_SITE, tab);

// Le filtre effectif d'un écran : celui demandé s'il existe pour cet écran,
// sinon le défaut (« Toutes » pour Ventes, « Vinted » ailleurs).
export const siteDeTache = (tab, sub) => {
  const t = TACHES_SITE[tab];
  if (!t) return null;
  if (sub === 'toutes' && t.toutes) return 'toutes';
  if (IDS_SITES.includes(sub)) return sub;
  return t.toutes ? 'toutes' : 'vinted';
};

// L'onglet d'un site (l'espace complet, avec ses sections propres) ⇄ le site.
export const ONGLET_DE_SITE = { vinted: 'plat_vinted', leboncoin: 'plat_leboncoin', ebay: 'plat_ebay', vestiaire: 'plat_vestiaire' };
const SITE_D_ONGLET = { plat_vinted: 'vinted', plat_leboncoin: 'leboncoin', plat_ebay: 'ebay' };
// Les sections d'un espace de site qui sont devenues des TÂCHES.
const SECTIONS_TACHE = ['ventes', 'annonces', 'messages'];

// Où mène un identifiant d'onglet (lien profond `?tab=`, notification, bouton
// d'un autre écran) avec la section demandée. Rend `{ tab, sub }` ; `sub` vaut
// `null` quand rien n'est imposé. JAMAIS un écran blanc : un identifiant inconnu
// d'ici ressort tel quel (l'app décide).
//  · `plat_vinted` / `plat_leboncoin` / `plat_ebay` : leur section Ventes,
//    Annonces ou Messages ⇒ la tâche, filtrée sur le site ; sans section, ils
//    ouvraient sur leurs ventes ⇒ Ventes filtré sur le site. Une autre section
//    (Achats, Colis Leboncoin, À traiter eBay…) reste dans l'espace du site.
//  · `plat_vestiaire` reste l'écran Vestiaire complet (une seule page).
export function redirigerOnglet(id, sub, deplaces) {
  const d = deplaces && deplaces[id];
  if (d) return { tab: d[0], sub: d[1] == null ? null : d[1] };
  const site = SITE_D_ONGLET[id];
  if (site) {
    const s = sub || 'ventes';
    if (SECTIONS_TACHE.includes(s)) return { tab: s, sub: site };
    return { tab: id, sub: s };
  }
  return { tab: id, sub: sub == null ? null : sub };
}

// Le filtre retenu, par écran (une commodité de CET appareil : le dernier site
// choisi). Lu et écrit sous try/catch : navigation privée, stockage bloqué ⇒
// le défaut, rien ne casse.
const CLE_FILTRES = 'vrm_filtre_site';
export function filtreRetenu(tab) {
  try {
    const m = JSON.parse(localStorage.getItem(CLE_FILTRES) || '{}') || {};
    const v = m[tab];
    return typeof v === 'string' ? siteDeTache(tab, v) : null;
  } catch (_) { return null; }
}
export function retenirFiltre(tab, site) {
  if (!estTacheSite(tab)) return;
  try {
    const m = JSON.parse(localStorage.getItem(CLE_FILTRES) || '{}') || {};
    if (m[tab] === site) return;
    m[tab] = site;
    localStorage.setItem(CLE_FILTRES, JSON.stringify(m));
  } catch (_) {}
}
