// ── LE SITE COURANT, UN SEUL POUR TOUTE L'APP (20 nov.) ─────────────────────────────────────────────────────────────
// Julien demandait s'il fallait « une application par plateforme ». Décision : les onglets restent par FONCTION
// (Aujourd'hui, Annonces, Ventes, Achats, Argent, Messages, E-mails) et UN sélecteur de plateforme global, en haut de
// chaque écran principal (src/natif/SelecteurSite.jsx), choisit le site regardé partout : « Tous · Vinted · Leboncoin ·
// eBay · Vestiaire », seulement les sites RELIÉS, rien quand il n'y en a qu'un.
//
// UNE clé, synchronisée (SYNC_KEYS de src/App.jsx) : `vrm_site_courant` ('toutes' | 'vinted' | 'leboncoin' | 'ebay' |
// 'vestiaire'). Elle REMPLACE les filtres de site locaux (FiltreSites, menu de plateforme, filtre « Site » des tableaux,
// la plateforme de Ventes natif, le menu des sites d'Annonces). Aucun calcul nouveau : chaque écran passe ce site à SES
// règles d'avant (`siteDeTache`, la sélection { site } de la carte des chiffres…). « Tous » = le comportement d'avant.
//
// Ce module ne connaît ni React ni l'app : l'app lui BRANCHE son `load` / `save` (`brancherSiteCourant`) ; avant, il lit
// et écrit le stockage local seul (bancs, tests).
import React from 'react';

export const CLE_SITE_COURANT = 'vrm_site_courant';
export const SITES_COURANTS = ['toutes', 'vinted', 'leboncoin', 'ebay', 'vestiaire'];
const EVT = 'vrm:site-courant';

let _io = null;
export function brancherSiteCourant(io) { _io = io; }

const valide = (v) => (v === 'tous' ? 'toutes' : SITES_COURANTS.includes(v) ? v : 'toutes');   // « tous » : l'écriture d'argent-natif

export function lireSiteCourant() {
  try {
    if (_io && _io.load) return valide(_io.load(CLE_SITE_COURANT, 'toutes'));
    const t = localStorage.getItem(CLE_SITE_COURANT); let v = t; try { v = t ? JSON.parse(t) : 'toutes'; } catch (_) { /* une valeur écrite brute (« leboncoin ») */ } return valide(v);
  } catch (_) { return 'toutes'; }
}

export function poserSiteCourant(v) {
  const s = valide(v);
  if (s === lireSiteCourant()) return s;
  try { if (_io && _io.save) _io.save(CLE_SITE_COURANT, s); else localStorage.setItem(CLE_SITE_COURANT, JSON.stringify(s)); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: s })); } catch (_) {}
  return s;
}

// Le site retenu, ramené aux sites RELIÉS : un site qui n'est plus relié (ou pas encore lu) vaut « Tous ».
export const siteEffectif = (courant, relies) => (courant !== 'toutes' && Array.isArray(relies) && relies.includes(courant) ? courant : 'toutes');

// Le filtre d'une tâche (src/navigationTache.js, TACHES_SITE) pour le site courant : « Tous » rend le filtre d'avant de
// la tâche (`defaut`) — « Toutes » là où la tâche l'a (Ventes, Messages), sinon son écran d'arrivée (Annonces : la liste
// de tous les sites, qui fait son propre « tous » ; Achats : Vinted, qui montre TOUS les colis à retirer).
export function sitePourTache(tache, courant, taches) {
  const t = taches && taches[tache];
  if (!t) return null;
  if (courant && courant !== 'toutes') return courant;
  if (t.toutes) return 'toutes';
  return 'vinted';
}

function abonner(fn) {
  const f = () => fn();
  const g = (e) => { if (e && e.detail && e.detail.k === CLE_SITE_COURANT) fn(); };
  try { window.addEventListener(EVT, f); window.addEventListener('vrm:save', g); window.addEventListener('storage', f); } catch (_) {}
  return () => { try { window.removeEventListener(EVT, f); window.removeEventListener('vrm:save', g); window.removeEventListener('storage', f); } catch (_) {} };
}
// [site, poser] — le même site dans tous les écrans montés, suivi au changement (y compris venu du nuage).
export function useSiteCourant() {
  const s = React.useSyncExternalStore(abonner, lireSiteCourant, () => 'toutes');
  return [s, poserSiteCourant];
}

// Les sites RELIÉS (posés par la coque à chaque rendu) : le site effectif d'un écran qui n'a pas la coque sous la main
// (« À régler », Aujourd'hui) — un site plus relié vaut « Tous ».
let _relies = null;
const _ecouteRelies = new Set();
// (20 nov., sélecteur en pastilles) Un changement des sites reliés RÉVEILLE les sélecteurs montés (avant, un sélecteur rendu
// avant la lecture des sites restait vide à l'ordinateur).
export function poserSitesRelies(l) {
  const n = Array.isArray(l) ? l : null;
  const meme = (n || []).join('|') === (_relies || []).join('|') && !!n === !!_relies;
  _relies = n;
  if (!meme) for (const f of [..._ecouteRelies]) { try { f(); } catch (_) {} }
}
let _reliesSnap = null, _reliesCle = '';
const lireRelies = () => { const c = (_relies || []).join('|'); if (c !== _reliesCle || !_reliesSnap) { _reliesCle = c; _reliesSnap = [...(_relies || [])]; } return _reliesSnap; };
export function useSitesRelies() { return React.useSyncExternalStore((f) => { _ecouteRelies.add(f); return () => _ecouteRelies.delete(f); }, lireRelies, lireRelies); }
export const sitesRelies = () => (_relies || []);
export function siteCourantEffectif(brut = lireSiteCourant()) { return _relies ? siteEffectif(brut, _relies) : brut; }
export function useSiteEffectif() { const [s] = useSiteCourant(); return siteCourantEffectif(s); }
// Le site d'une ligne d'« À régler » par son identifiant (la carte qui l'a faite) ; inconnu ⇒ null : une ligne de TOUS les
// sites (URSSAF, numéros, Compléter…), montrée seulement sous « Tous » — jamais un chiffre global sous le logo d'un site.
const SITE_DES_LIGNES = {
  'colis-limite': 'vinted', 'colis-en-retard': 'vinted', 'poste-sans-depart': 'vinted', 'retrait-dernier-jour': 'vinted', 'supprime-vinted': 'vinted',
  'quoi-republier': 'vinted', 'remettre-en-vente': 'vinted', 'a-confirmer': 'vinted', 'retours-vente': 'vinted', 'retours-vente-revenus': 'vinted', 'emballer': 'vinted',
  'ebay-ne-pas-poster': 'ebay', 'messages-ebay': 'ebay',
  'vestiaire-envoyer': 'vestiaire', 'vestiaire-messages': 'vestiaire', 'vestiaire-offre': 'vestiaire', 'vestiaire-offres-reste': 'vestiaire',
};
export function siteDeLigne(id, tab = '') {
  const base = String(id || '').split(':')[0];
  if (SITE_DES_LIGNES[base]) return SITE_DES_LIGNES[base];
  const m = /^plat_(vinted|leboncoin|ebay|vestiaire)$/.exec(String(tab || ''));
  return m ? m[1] : null;
}
