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
// ⚠️ « Toutes » n'existe que pour Ventes (et Messages depuis le 10 nov. : des FILS,
// regroupés par identité, jamais une règle « en ligne » recopiée) : chaque site a sa propre règle
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
// (31 oct., soir) + Achats : la liste de ses achats, site par site (Vinted,
// Leboncoin, eBay, Vestiaire) — sans « Toutes » (chaque site lit ses achats
// à sa façon, aucune liste mélangée fiable).
export const TACHES_SITE = {
  ventes: { toutes: true },
  annonces: { toutes: false },
  // (10 nov., lot AB) Messages a « Tous » : un seul fil par acheteur et par paire,
  // toutes plateformes (src/filUnique.js). Le défaut reste Vinted (`defaut`) : les
  // liens d'hier (`?tab=messages`, notifications, Favoris & offres) n'en changent pas.
  // (11 nov., décision C9 — Julien : « tranche ») « Tous » par défaut, et SON dernier choix
  // retenu (`choixSeul` : seul son toucher sur la rangée l'écrit, jamais un lien ni le défaut).
  // Les liens qui visent une conversation Vinted portent `site=vinted` (notifications, cat_msg).
  messages: { toutes: true, defaut: 'toutes', choixSeul: true },
  achats: { toutes: false },
};
export const estTacheSite = (tab) => Object.prototype.hasOwnProperty.call(TACHES_SITE, tab);

// (31 oct., soir — Julien : « enlever Plateformes… les répartir avec les
// onglets du haut ») Ce qu'un site a en propre vit DANS la tâche filtrée sur
// lui, en petite rangée de sous-onglets. La valeur retenue par l'écran
// (`platSub`) s'écrit « site » ou « site.section » (« ebay.agent ») : le site
// d'abord, la section ensuite — un seul état, que l'historique (retour) rejoue.
//   Ventes · eBay    : Commandes · À traiter (l'agent, retours, évaluations) · Offres
//                      (une offre acceptée VEND la paire : c'est la vente qui se négocie) ;
//   Annonces · eBay  : Annonces · Promotion.
// Leboncoin · Colis va dans Colis (sous-rangée), eBay · Compte dans Paramètres.
export const SOUS_SECTIONS = {
  'ventes.ebay': [['ventes', 'Commandes'], ['agent', 'À traiter'], ['offres', 'Offres']],
  'annonces.ebay': [['annonces', 'Annonces'], ['promo', 'Promotion']],
};
export const sousSections = (tab, site) => SOUS_SECTIONS[tab + '.' + site] || null;

// Le filtre effectif d'un écran : celui demandé s'il existe pour cet écran,
// sinon le défaut (« Toutes » pour Ventes, « Vinted » ailleurs).
export const siteDeTache = (tab, sub) => {
  const t = TACHES_SITE[tab];
  if (!t) return null;
  const s = typeof sub === 'string' ? sub.split('.')[0] : sub;
  if (s === 'toutes' && t.toutes) return 'toutes';
  if (IDS_SITES.includes(s)) return s;
  if (t.defaut) return t.defaut;
  return t.toutes ? 'toutes' : 'vinted';
};
// La section rendue d'une tâche filtrée : celle demandée si ce site l'a, sinon
// la première (la tâche elle-même : `ventes`, `annonces`…).
export const sectionDeTache = (tab, sub) => {
  const site = siteDeTache(tab, sub);
  const l = sousSections(tab, site);
  if (!l) return tab;
  const x = typeof sub === 'string' ? sub.split('.')[1] : null;
  return l.some(([id]) => id === x) ? x : l[0][0];
};
export const subDeTache = (site, section) => (section ? site + '.' + section : site);

// L'onglet d'un site d'hier ⇄ le site.
export const ONGLET_DE_SITE = { vinted: 'plat_vinted', leboncoin: 'plat_leboncoin', ebay: 'plat_ebay', vestiaire: 'plat_vestiaire' };
const SITE_D_ONGLET = { plat_vinted: 'vinted', plat_leboncoin: 'leboncoin', plat_ebay: 'ebay', plat_vestiaire: 'vestiaire' };
// Les sections d'un espace de site qui sont des TÂCHES (même nom).
const SECTIONS_TACHE = ['ventes', 'annonces', 'messages', 'achats'];
// Les sections propres d'un site → leur place d'aujourd'hui : [onglet, sub].
const PLACE_SECTION = {
  leboncoin: { colis: ['cat_bord', 'leboncoin'] },
  ebay: { agent: ['ventes', 'ebay.agent'], offres: ['ventes', 'ebay.offres'], promo: ['annonces', 'ebay.promo'], compte: ['settings', 'ebay'] },
};
// Sans section (ou une section inconnue), l'espace d'un site ouvrait sur ses
// ventes ; Vestiaire (une page qui commençait par « Publier ») sur ses annonces.
const DEFAUT_SITE = { vinted: 'ventes', leboncoin: 'ventes', ebay: 'ventes', vestiaire: 'annonces' };

// Où mène un identifiant d'onglet (lien profond `?tab=`, notification, bouton
// d'un autre écran) avec la section demandée. Rend `{ tab, sub }` ; `sub` vaut
// `null` quand rien n'est imposé. JAMAIS un écran blanc : un identifiant inconnu
// d'ici ressort tel quel (l'app décide).
//  · `plat_vinted` / `plat_leboncoin` / `plat_ebay` / `plat_vestiaire` : aucun
//    espace de site n'est plus monté (31 oct., soir). Ventes, Annonces,
//    Messages, Achats ⇒ la tâche filtrée sur le site ; À traiter / Offres eBay ⇒
//    Ventes · eBay et son sous-onglet ; Promotion ⇒ Annonces · eBay ; Compte
//    eBay ⇒ Paramètres ; Colis Leboncoin ⇒ Colis, sous-rangée Leboncoin.
export function redirigerOnglet(id, sub, deplaces) {
  const d = deplaces && deplaces[id];
  if (d) return { tab: d[0], sub: d[1] == null ? null : d[1] };
  const site = SITE_D_ONGLET[id];
  if (site) {
    const p = PLACE_SECTION[site] && sub ? PLACE_SECTION[site][sub] : null;
    if (p) return { tab: p[0], sub: p[1] };
    const s = SECTIONS_TACHE.includes(sub) ? sub : DEFAUT_SITE[site];
    return { tab: s, sub: site };
  }
  return { tab: id, sub: sub == null ? null : sub };
}

// Le filtre retenu, par écran (une commodité de CET appareil : le dernier site
// choisi). Lu et écrit sous try/catch : navigation privée, stockage bloqué ⇒
// le défaut, rien ne casse.
const CLE_FILTRES = 'vrm_filtre_site';
// (11 nov., C9) Un écran `choixSeul` lit SA clé `tab:choix` (écrite par son toucher seul) : la
// valeur d'avant (posée à chaque visite, « vinted » chez tous) n'est plus lue.
const cleFiltre = (tab) => (TACHES_SITE[tab] && TACHES_SITE[tab].choixSeul ? tab + ':choix' : tab);
export function filtreRetenu(tab) {
  try {
    const m = JSON.parse(localStorage.getItem(CLE_FILTRES) || '{}') || {};
    const v = m[cleFiltre(tab)];
    return typeof v === 'string' ? siteDeTache(tab, v) : null;
  } catch (_) { return null; }
}
// (11 nov., reprise-ecrans) Rend `true` quand le site est RETENU (écrit, ou déjà le même) — la
// coque le range alors aussi pour le compte VRM (src/repriseSynchro.js) ; `false` quand cet écran
// ne retient pas un site vu sans choix (`choixSeul`).
export function retenirFiltre(tab, site, choix = false) {
  if (!estTacheSite(tab)) return false;
  if (TACHES_SITE[tab].choixSeul && !choix) return false;
  try {
    const m = JSON.parse(localStorage.getItem(CLE_FILTRES) || '{}') || {};
    const k = cleFiltre(tab);
    if (m[k] === site) return true;
    m[k] = site;
    localStorage.setItem(CLE_FILTRES, JSON.stringify(m));
  } catch (_) {}
  return true;
}
