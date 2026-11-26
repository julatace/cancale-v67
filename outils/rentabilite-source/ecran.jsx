// ── outils/rentabilite-source/ecran.jsx — « Ce que tu vends le mieux », axe « Source », SEUL (hors du paquet de prod) ──
// Le VRAI composant (src/natif/ecrans/StatsVendsMieux.jsx) et les VRAIES règles (bilanSources → rentabiliteParSource)
// sur des achats et ventes INVENTÉS (aucune donnée réelle : le dépôt est public). Jugé par scripts/bancs/rentabilite-source.cjs.
//   ?base=lu | passu
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Page, Colonnes } from '../../src/natif/index.js';
import StatsVendsMieux from '../../src/natif/ecrans/StatsVendsMieux.jsx';
import { bilanSources } from '../../src/meilleuresSources.js';
import { rentabiliteParSource } from '../../src/rentabiliteSource.js';
import { vendsMieux } from '../../src/vendsMieux.js';
import '../../src/natif/ecrans/stats.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const J = 86400000, T0 = Date.parse('2026-06-01T12:00:00Z'), MAINTENANT = Date.parse('2026-11-23T12:00:00Z');
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);
// 30 achats Vinted (20 revendus), 6 Leboncoin, 4 vide-grenier, 5 au magasin, 3 chez « Grossiste inventé », 2 sans source.
const achatsVinted = [], hors = [], fiches = {}, ventes = [];
const cleNum = (x) => String(x).toUpperCase();
for (let i = 0; i < 30; i++) { const tx = String(7000001 + i); achatsVinted.push({ transaction_id: tx, title: 'Paire inventée', date: new Date(T0 + i * J).toISOString(), price: { amount: String(30 + i) } }); fiches['it' + i] = { numero: String(i + 1), buyFromId: tx };
  if (i < 20) ventes.push({ id: 'vinted:' + (9000001 + i), ts: T0 + i * J + (5 + i) * J, entree: { numero: String(i + 1), buyFromId: tx }, prix: (60 + i) * 100, benefice: i < 17 ? (25 + i) * 100 : null, partiel: i === 3 }); }
const SRC = [...Array(6).fill('Leboncoin'), ...Array(4).fill('Vide-grenier'), ...Array(5).fill('Magasin'), ...Array(3).fill('Grossiste inventé'), '', ''];
SRC.forEach((src, j) => { const num = String(100 + j); hors.push({ id: 'h' + j, title: 'Paire inventée', price: '20', date: new Date(T0 + j * 3 * J).toISOString().slice(0, 10), source: src, numero: num });
  if (j % 3 !== 2) ventes.push({ id: 'autre:' + j, ts: T0 + j * 3 * J + (4 + j * 2) * J, entree: { numero: num }, prix: 5000 + j * 300, benefice: 2600 - j * 90, partiel: false }); });
for (let k = 0; k < 8; k++) ventes.push({ id: 'vinted:' + (9100001 + k), ts: T0 + 40 * J, entree: { numero: String(500 + k) }, prix: 7000, benefice: 4000, partiel: false });
const bilan = bilanSources({ achatsVinted, estAnnule: () => false, montantVinted: (o) => Number(o.price.amount), hors, prixHors: (b) => Number(b.price), registre: null, fiches, saleOv: {}, ventes, cleNum, maintenant: MAINTENANT });
const S = P.get('base') === 'passu' ? null : rentabiliteParSource(bilan);
window.__S = S;
try { localStorage.setItem('vrm_stats_mieux_axe', P.get('axe') || 'source'); localStorage.setItem('vrm_stats_mieux_tri', P.get('tri') || 'marge'); } catch (_) {}
const mieux = vendsMieux({ lignes: [], annonces: [], de: MAINTENANT - 30 * J, a: MAINTENANT });
createRoot(document.getElementById('r')).render(<Page titre="Statistiques"><Colonnes><StatsVendsMieux mieux={mieux} sur="30 derniers jours" montant={euros} sources={S}/></Colonnes></Page>);
