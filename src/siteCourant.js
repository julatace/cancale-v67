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

const valide = (v) => (SITES_COURANTS.includes(v) ? v : 'toutes');

export function lireSiteCourant() {
  try {
    if (_io && _io.load) return valide(_io.load(CLE_SITE_COURANT, 'toutes'));
    const t = localStorage.getItem(CLE_SITE_COURANT); return valide(t ? JSON.parse(t) : 'toutes');
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
