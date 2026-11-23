// ── outils/appareils-connectes/ecran.jsx — « Navigateurs avec l'extension VRM », SEULE (hors du paquet de prod) ──
// Le VRAI composant (src/NavigateursExtension.jsx) et la VRAIE règle (src/appareilsExtension.js) ; la lecture est une
// FAUSSE BASE à la forme PostgREST qui sert DEUX vendeurs et rend tout si le filtre `owner` manque (données INVENTÉES).
//   ?base=lu | passu   Jugé par scripts/bancs/appareils-connectes.cjs.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Page } from '../../src/natif/index.js';   // poserIcone : les glyphes du bouton commun
import NavigateursExtension from '../../src/NavigateursExtension.jsx';
import '../../src/comptes-securite.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const MOI = '11111111-aaaa-4bbb-8ccc-000000000001', AUTRE = '22222222-aaaa-4bbb-8ccc-000000000002';
const M = Date.now();
const BASE = [
  { owner: MOI, id: 'ext_appareil_aa1', ver: '5.441.0', atMs: M - 3 * 3600000, nav: 'Chrome', sys: 'Mac' },
  { owner: MOI, id: 'ext_appareil_bb2', ver: '5.430.0', atMs: M - 5 * 86400000, nav: 'Firefox', sys: 'Windows' },
  { owner: MOI, id: 'ext_appareil_cc3', ver: '', atMs: null, nav: 'Orion', sys: 'Mac' },
  { owner: AUTRE, id: 'ext_appareil_zz9', ver: '5.441.0', atMs: M, nav: 'Edge', sys: 'Windows' },
];
window.__Q = [];
const lireTout = async (q) => {
  window.__Q.push(q);
  if (P.get('base') === 'passu') return null;
  const p = new URLSearchParams(q); const own = /^eq\.(.+)$/.exec(p.get('owner') || '');
  return BASE.filter((r) => !own || r.owner === decodeURIComponent(own[1])).reverse().map((r) => ({ id: r.id, ver: r.ver, atMs: r.atMs == null ? null : String(r.atMs), nav: r.nav, sys: r.sys }));
};
const quand = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
createRoot(document.getElementById('r')).render(<Page titre="Appareils connectés"><div style={{ padding: '0 16px' }}><NavigateursExtension owner={MOI} lireTout={lireTout} quand={quand}/></div></Page>);
