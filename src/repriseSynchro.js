// ── CHAQUE ÉCRAN SE ROUVRE COMME ON L'A LAISSÉ, SUR N'IMPORTE QUEL APPAREIL ──
// (11 nov., lot reprise-ecrans.) La reprise du 5 nov. (src/repriseEcran.js) ne
// vivait que sur l'APPAREIL : posé un filtre « En transit » sur l'iPhone, l'ordinateur
// rouvrait Ventes sur « Tout ». Ici, la RÈGLE (sans React) d'UNE clé légère,
// synchronisée (SYNC_KEYS), par compte VRM : `vrm_reprise_ecrans`.
//
// Ce qui est retenu (rien d'autre — aucune donnée, aucun montant, aucune identité
// d'acheteur) :
//   · `vues`   : le filtre / segment, le tri, la période, la recherche de chaque
//                écran ({ [nom]: { valeur, at } }, le nom de `useVueSession`) ;
//   · `comptes`: le compte choisi PAR SITE (src/compteChoix.js) ;
//   · `sites`  : le site choisi par tâche (src/navigationTache.js) ;
//   · `ecran`  : le dernier écran ouvert ({ tab, sub, colis, at }).
//
// Les durées (décision du lot) :
//   · le dernier écran ne rouvre que s'il a moins de 30 min (sinon Ma journée) ;
//   · une RECHERCHE ne revient que si on l'a quittée il y a moins de 10 min (un mot
//     oublié cacherait des annonces sans qu'on comprenne pourquoi) ;
//   · un filtre, un tri : 60 jours — et il est TOUJOURS dit à l'écran, avec
//     « Effacer » (`retenusAffiches`, le bandeau de la coque).
// La position de défilement N'EST PAS ici : elle reste sur l'appareil
// (`MemoireDefilement`) — elle n'a pas de sens sur un autre écran.
//
// ⚠️ UN LIEN REÇU GAGNE TOUJOURS : une adresse `?tab=` (notification, e-mail) fait
// taire la reprise d'écran entièrement (`lienRecu`, la même règle qu'avant).
// ⚠️ « PAS SU » NE DEVIENT RIEN : une forme inconnue, un autre vendeur, une valeur
// « du futur », un écran hors liste blanche ⇒ la valeur par défaut, jamais devinée.
import { lienRecu, formeReprise } from './repriseEcran.js';
import { periodeReutilisable, cleParcours } from './parcoursQuotidien.js';

export const CLE_REPRISE_ECRANS = 'vrm_reprise_ecrans';
export const DUREE_ECRAN = 30 * 60000;
export const DUREE_RECHERCHE = 10 * 60000;
export const DUREE_REGLAGE = 60 * 86400000;
// Écrite avec un délai : une frappe dans la recherche n'écrit pas à chaque lettre.
export const DELAI_ECRITURE = 1500;
const MAX_VUES = 60;
const NOM_OK = /^[a-z][a-z0-9-]{1,48}$/;
const SITES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
const VAL_COURTE = /^[\w*.:@-]{0,80}$/;

export const estRecherche = (nom) => /recherche$/.test(String(nom || ''));
// Les « Voir plus » (`-limite`) ne sont pas des réglages : restés sur l'appareil.
export const vueSynchronisee = (nom) => NOM_OK.test(String(nom || '')) && !/-limite$/.test(nom);

// L'écran qui porte une vue (le moteur `Comptabilite` monte TOUTES ses vues, quel
// que soit l'écran montré : le nom dit l'écran, pas le montage).
const ECRANS_DE_VUE = [
  [/^annonces-/, ['annonces']],
  [/^commandes-/, ['ventes', 'achats']],
  [/^(ventes|leboncoin-ventes|ebay-ventes)-/, ['ventes']],
  [/^achats-/, ['achats']],
  [/^(messages|favoris|leboncoin-messages)-/, ['messages']],
];
export function ecransDeVue(nom) {
  for (const [re, t] of ECRANS_DE_VUE) if (re.test(String(nom || ''))) return t;
  return [];
}

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const entreeOk = (e, now, duree) => estObjet(e) && Number.isFinite(e.at) && now >= e.at && now - e.at < duree;

// La carte relue telle qu'elle est rangée — nettoyée ; un autre vendeur ⇒ vide.
export function lireCarte(brut, owner) {
  let o = brut;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (_) { o = null; } }
  const vide = { owner: owner || '', vues: {}, comptes: {}, sites: {}, ecran: null };
  if (!estObjet(o)) return vide;
  if (o.owner && owner && o.owner !== owner) return vide;
  const out = { ...vide };
  if (estObjet(o.vues)) for (const [k, e] of Object.entries(o.vues)) if (vueSynchronisee(k) && estObjet(e) && Number.isFinite(e.at)) out.vues[k] = { valeur: e.valeur, at: e.at };
  if (estObjet(o.comptes)) for (const [k, e] of Object.entries(o.comptes)) if (SITES.includes(k) && estObjet(e) && Number.isFinite(e.at) && typeof e.valeur === 'string' && VAL_COURTE.test(e.valeur)) out.comptes[k] = { valeur: e.valeur, at: e.at };
  if (estObjet(o.sites)) for (const [k, e] of Object.entries(o.sites)) if (NOM_OK.test(k.replace(/_/g, '-')) && estObjet(e) && Number.isFinite(e.at) && typeof e.valeur === 'string' && VAL_COURTE.test(e.valeur)) out.sites[k] = { valeur: e.valeur, at: e.at };
  if (estObjet(o.ecran) && Number.isFinite(o.ecran.at)) out.ecran = { ...o.ecran };
  return out;
}

// Une valeur de vue n'est reprise que si elle a la FORME de la valeur par défaut.
export function valeurVue(v, initial, nom) {
  if (typeof initial === 'string') return typeof v === 'string' && v.length <= 2000 ? { ok: true, valeur: v } : { ok: false };
  if (typeof initial === 'number') return Number.isFinite(v) && v >= initial && v <= 10000 ? { ok: true, valeur: v } : { ok: false };
  if (initial === null && String(nom).includes('periode')) {
    if (v === null) return { ok: true, valeur: null };
    const p = periodeReutilisable(v);
    return p ? { ok: true, valeur: { from: new Date(p.from), to: new Date(p.to), ...(typeof v.label === 'string' ? { label: v.label.slice(0, 100) } : {}) } } : { ok: false };
  }
  return { ok: false };
}

// La valeur à reprendre pour UNE vue, ou `initial`.
export function vueReprise(carte, nom, initial, now = Date.now()) {
  if (!vueSynchronisee(nom)) return initial;
  const e = carte && carte.vues ? carte.vues[nom] : null;
  if (!entreeOk(e, now, estRecherche(nom) ? DUREE_RECHERCHE : DUREE_REGLAGE)) return initial;
  const r = valeurVue(e.valeur, initial, nom);
  return r.ok ? r.valeur : initial;
}

export function compteReprise(carte, site) {
  const e = carte && carte.comptes ? carte.comptes[site] : null;
  return e && typeof e.valeur === 'string' ? e.valeur : null;
}
export function siteReprise(carte, tab) {
  const e = carte && carte.sites ? carte.sites[tab] : null;
  return e && typeof e.valeur === 'string' && SITES.includes(e.valeur) ? e.valeur : null;
}

// La reprise locale du 5 nov. (vrm_parcours:<owner>:reprise), relue AVEC sa date.
export function repriseLocale(storage, owner) {
  try {
    const k = cleParcours(owner, 'reprise'); const x = k && JSON.parse(storage.getItem(k) || 'null');
    return x && x.owner === owner && Number.isFinite(x.at) && estObjet(x.valeur) ? { ...x.valeur, at: x.at } : null;
  } catch (_) { return null; }
}

// L'écran où rouvrir : le plus FRAIS de l'appareil et du compte, s'il a moins de
// 30 min ; un lien reçu ⇒ null (le lien décide) ; rien de sûr ⇒ null (Ma journée).
export function ecranAOuvrir({ carte, locale, ongletsOk, search = '', now = Date.now() }) {
  if (lienRecu(search)) return null;
  const cands = [carte && carte.ecran, locale].filter((e) => entreeOk(e, now, DUREE_ECRAN));
  cands.sort((a, b) => b.at - a.at);
  for (const c of cands) { const f = formeReprise(c, ongletsOk); if (f) return { ...f, at: c.at }; }
  return null;
}

// Pose un changement (gestes datés) et rend la NOUVELLE carte. `valeur === undefined`
// (ou `efface`) retire l'entrée : la vue revient à son défaut.
export function poserCarte(carte, patch, owner, ongletsOk) {
  const c = lireCarte(carte, owner);
  const out = { owner: owner || c.owner || '', vues: { ...c.vues }, comptes: { ...c.comptes }, sites: { ...c.sites }, ecran: c.ecran };
  const p = patch || {};
  for (const [nom, e] of Object.entries(p.vues || {})) {
    if (!vueSynchronisee(nom)) continue;
    if (!e || e.efface || e.valeur === undefined) { delete out.vues[nom]; continue; }
    const v = e.valeur instanceof Date ? e.valeur.toISOString() : (estObjet(e.valeur) && e.valeur.from ? { from: new Date(e.valeur.from).toISOString(), to: new Date(e.valeur.to).toISOString(), ...(e.valeur.label ? { label: String(e.valeur.label).slice(0, 100) } : {}) } : e.valeur);
    if (typeof v === 'string' && v.length > 2000) continue;
    out.vues[nom] = { valeur: v, at: e.at };
  }
  for (const [site, e] of Object.entries(p.comptes || {})) {
    if (!SITES.includes(site)) continue;
    if (!e || !e.valeur) { delete out.comptes[site]; continue; }
    if (typeof e.valeur === 'string' && VAL_COURTE.test(e.valeur)) out.comptes[site] = { valeur: e.valeur, at: e.at };
  }
  for (const [tab, e] of Object.entries(p.sites || {})) {
    if (!e || !e.valeur) { delete out.sites[tab]; continue; }
    if (SITES.includes(e.valeur)) out.sites[tab] = { valeur: e.valeur, at: e.at };
  }
  if (p.ecran) { const f = formeReprise(p.ecran, ongletsOk); if (f && Number.isFinite(p.ecran.at)) out.ecran = { ...f, at: p.ecran.at }; }
  // Bornée : les vues les plus anciennes partent d'abord.
  const noms = Object.keys(out.vues);
  if (noms.length > MAX_VUES) noms.sort((a, b) => out.vues[a].at - out.vues[b].at).slice(0, noms.length - MAX_VUES).forEach((n) => delete out.vues[n]);
  return out;
}

// Deux patchs en attente (le délai d'écriture) : le plus récent gagne, champ par champ.
export function cumulerPatch(a, b) {
  const o = { vues: { ...(a && a.vues) }, comptes: { ...(a && a.comptes) }, sites: { ...(a && a.sites) }, ecran: (a && a.ecran) || null };
  if (b) { Object.assign(o.vues, b.vues || {}); Object.assign(o.comptes, b.comptes || {}); Object.assign(o.sites, b.sites || {}); if (b.ecran) o.ecran = b.ecran; }
  return o;
}

// Les noms de vues d'un écran (pour « Réinitialiser cet écran »).
export const vuesDeLEcran = (tab, noms) => (noms || []).filter((n) => ecransDeVue(n).includes(tab));

// ── CE QUI EST DIT À L'ÉCRAN ─────────────────────────────────────────────────
// Un filtre retenu ne cache JAMAIS une donnée en silence : chaque vue montée sur
// l'écran courant dont la valeur n'est pas le défaut est dite, avec « Effacer ».
const NOMS_VUE = {
  'annonces-recherche': 'Recherche', 'annonces-tri': 'Tri', 'commandes-recherche': 'Recherche', 'commandes-periode': 'Période',
  'ventes-filtre': 'Filtre', 'achats-filtre': 'Filtre', 'messages-recherche': 'Recherche', 'messages-filtre': 'Filtre', 'favoris-zone': 'Vue',
  'leboncoin-ventes-filtre': 'Filtre Leboncoin', 'leboncoin-ventes-recherche': 'Recherche Leboncoin', 'ebay-ventes-filtre': 'Filtre eBay',
  'ebay-ventes-recherche': 'Recherche eBay', 'leboncoin-messages-zone': 'Vue Leboncoin',
};
const NOMS_VALEUR = {
  aexpedier: 'À expédier', transit: 'En transit', finalisees: 'Finalisées', annulees: 'Annulées', encours: 'En cours', all: 'Tout',
  attente: 'En attente', route: 'En route', recus: 'Reçus', recent: 'Plus récentes', oldest: 'Plus anciennes', price_desc: 'Prix décroissant',
  price_asc: 'Prix croissant', favs: 'Favoris', views: 'Vues', nonum: 'Sans numéro', boost: 'Boostées', sleeping: 'À relancer',
  republier: 'Republier', selection: 'Sélection', brouillons: 'Brouillons', masquees: 'Masquées', sansachat: 'Sans achat', acompleter: 'À compléter',
  unread: 'Non lues', repondre: 'À répondre', offres: 'Offres', favoris: 'Favoris', conversations: 'Conversations',
};
export const nomVue = (nom) => NOMS_VUE[nom] || 'Filtre';
export function texteValeur(nom, v) {
  if (estRecherche(nom)) return typeof v === 'string' && v.trim() ? `« ${v.trim().slice(0, 40)} »` : '';
  if (v && typeof v === 'object' && v.from) {
    if (typeof v.label === 'string' && v.label) return v.label;
    const f = (d) => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
    return `${f(v.from)} → ${f(v.to)}`;
  }
  return typeof v === 'string' ? (NOMS_VALEUR[v] || NOMS_VALEUR[v.split(':')[0]] || '') : '';
}
const memeValeur = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return a === b; } };
// `montees` : [{ nom, valeur, initial }] — rend ce que le bandeau dit, pour l'écran `tab`.
export function retenusAffiches(montees, tab) {
  const vus = new Set(); const out = [];
  for (const m of montees || []) {
    if (!m || vus.has(m.nom) || !vueSynchronisee(m.nom) || !ecransDeVue(m.nom).includes(tab)) continue;
    if (memeValeur(m.valeur, m.initial)) continue;
    if (estRecherche(m.nom) && !(typeof m.valeur === 'string' && m.valeur.trim())) continue;
    vus.add(m.nom);
    out.push({ nom: m.nom, quoi: nomVue(m.nom), valeur: texteValeur(m.nom, m.valeur) });
  }
  return out;
}
