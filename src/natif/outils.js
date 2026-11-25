// ── src/natif/outils.js — les petits outils partagés par les composants natifs ───────────
import React from 'react';
import { tr } from '../i18n/index.js';

// Assemble des classes : cx('n-bouton', large && 'n-bouton-large', className).
export const cx = (...c) => c.filter(Boolean).join(' ');

export const mouvementReduit = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
};

// La dernière valeur d'une fonction, lue dans une référence : un écran qui se redessine ne relance aucun effet.
export function useDernier(v) { const r = React.useRef(v); r.current = v; return r; }

// Les éléments qu'on peut atteindre au clavier dans un conteneur (piège de focus d'une feuille).
const SEL_FOCUS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function focusables(el) {
  if (!el) return [];
  return [...el.querySelectorAll(SEL_FOCUS)].filter((n) => n.offsetParent !== null || n === document.activeElement);
}

// « — » : la valeur qu'on ne connaît pas (CLAUDE.md §5 : « pas su » ne vaut ni 0 ni vide).
export const TIRET = '—';
export const estVide = (v) => v == null || v === '' || v === TIRET;

// Le conteneur des feuilles : UN nœud, créé une fois sous <body> et gardé. Ouvrir une feuille
// n'insère donc rien sous <body> (rien qui invalide le style du document) : elle entre dans ce nœud.
let _portail = null;
export function portailNatif() {
  if (typeof document === 'undefined') return null;
  if (_portail && _portail.isConnected) return _portail;
  _portail = document.querySelector('[data-n-portail]');
  if (!_portail) {
    _portail = document.createElement('div');
    _portail.setAttribute('data-n-portail', '');
    _portail.className = 'n-portail';
    document.body.appendChild(_portail);
  }
  return _portail;
}

// (24 nov., livrable) UN CHIFFRE EN COURS DE LECTURE : sa raison est « lecture… » (`v2.jour.lecture`, ou la raison courte
// des cartes de chiffres, src/design/carteChiffres.js). La case dessine alors un SQUELETTE à la place du « — » et cache sa
// raison (src/styles-chiffre-attente.css : 15 s au plus, puis « — » et la raison reviennent) — jamais « pas su » (null,
// raison dite) ni une valeur. `enCours` explicite gagne ; sinon on reconnaît la raison.
export const estLecture = (t) => typeof t === 'string' && (t === tr('v2.jour.lecture') || t === 'lecture…');
export const attenteDe = (enCours, su, raison) => (!su && (enCours === true || (enCours == null && estLecture(raison))));
export const attrsAttente = (oui, role) => (oui ? { 'data-chiffre-attente': role } : null);
