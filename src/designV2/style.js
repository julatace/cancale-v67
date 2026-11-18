import React from 'react';
import './theme-apple.css';
import './theme-vrm.css';

export const CLE_STYLE = 'vrm_style';
export const STYLES = ['vrm', 'apple', 'studio'];
const EVT = 'vrm:style';

export function styleActif() {
  try {
    const choix = localStorage.getItem(CLE_STYLE);
    return STYLES.includes(choix) ? choix : 'vrm';
  } catch (_) { return 'vrm'; }
}

export function couleurStyle(s, sombre, studio) {
  if (s === 'vrm') return sombre ? '#111B20' : '#F1F4F2';
  if (s === 'apple') return sombre ? '#000000' : '#F2F2F7';
  return studio;
}

function appliquer(s) {
  try {
    const r = document.documentElement;
    if (s === 'studio') r.removeAttribute('data-theme-style'); else r.setAttribute('data-theme-style', s);
    // La barre d'état d'iOS prend le fond de la page (plus le bleu du verre).
    const m = document.querySelector('meta[name="theme-color"]');
    const sombre = r.getAttribute('data-theme') === 'dark';
    if (m) m.setAttribute('content', couleurStyle(s, sombre, sombre ? '#133460' : '#2563A8'));
  } catch (_) { /* sans document : rien */ }
}

export function poserStyle(s) {
  const v = STYLES.includes(s) ? s : 'vrm';
  try { localStorage.setItem(CLE_STYLE, v); } catch (_) { /* stockage bloqué : le choix ne tient que le temps de la page */ }
  appliquer(v);
  try { window.dispatchEvent(new Event(EVT)); } catch (_) {}
}

if (typeof document !== 'undefined') appliquer(styleActif());

function abonner(f) {
  const g = (e) => { if (!e || e.type === EVT || e.key === CLE_STYLE) { appliquer(styleActif()); f(); } };
  window.addEventListener(EVT, g); window.addEventListener('storage', g);
  return () => { window.removeEventListener(EVT, g); window.removeEventListener('storage', g); };
}

export function useStyle() {
  return React.useSyncExternalStore(abonner, styleActif, () => 'vrm');
}
