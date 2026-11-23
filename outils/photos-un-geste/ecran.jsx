// ── outils/photos-un-geste/ecran.jsx — le Studio photo et « Améliorer en un geste », SEUL (hors du paquet de prod) ──
// Le VRAI studio (src/StudioPhoto.jsx) et la VRAIE règle (src/ameliorerPhoto.js), sur TROIS photos INVENTÉES (dessinées
// ici : fond gris uni un peu terne, une « chaussure » sombre). La base est une fausse ligne `studio_photos_12` (lecture,
// comparer-et-échanger) tenue dans la page. Jugé par scripts/bancs/photos-un-geste.cjs.   ?base=lu | ko (écriture refusée)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import StudioPhoto from '../../src/StudioPhoto.jsx';
import '../../src/styles-boutons.css';

ajouterSourceApp(frNatif);
const P = new URLSearchParams(location.search);
const sombre = P.get('theme') === 'dark';
document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
document.body.style.background = sombre ? '#0F0F11' : '#F1F3F6';
const C = sombre ? { bg: '#18181B', text: '#F4F4F5', muted: '#A1A1AA', border: '#2E2E33', card: '#1F1F23' } : { bg: '#FFFFFF', text: '#18181B', muted: '#6B6B73', border: '#E4E4E7', card: '#FFFFFF' };
// Trois photos inventées : 300 × 400, fond gris (160-190 selon la photo), chaussure sombre placée différemment.
const photo = (k) => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d');
  const f = 160 + k * 12; x.fillStyle = `rgb(${f},${f},${f - 4})`; x.fillRect(0, 0, 300, 400);
  x.fillStyle = 'rgb(70,58,50)'; x.fillRect(30 + k * 40, 240 - k * 30, 150, 70); x.fillStyle = 'rgb(120,110,100)'; x.fillRect(40 + k * 40, 290 - k * 30, 130, 12);
  x.fillStyle = `rgb(${f},${f},${f - 4})`; x.fillRect(80 + k * 40, 260 - k * 30, 14, 14);
  return c.toDataURL('image/jpeg', 0.9); };
let ligne = { numero: '12', cle: '12', photos: [0, 1, 2].map((k) => ({ id: 'sp' + k, at: '2026-11-2' + k + 'T10:00:00.000Z', img: photo(k), cadre: 'fichier' })), rev: 3 };
window.__ORIGINAUX = ligne.photos.map((p) => p.img);
window.__ECRITURES = 0;
const vrai = window.fetch.bind(window);
window.fetch = async (u, o = {}) => {
  const url = String(u);
  if (!/\/rest\/v1\/app_data/.test(url)) return vrai(u, o);
  const rep = (s, j) => new Response(JSON.stringify(j), { status: s, headers: { 'content-type': 'application/json' } });
  if (!o.method || o.method === 'GET') return rep(200, [{ data: JSON.parse(JSON.stringify(ligne)) }]);
  if (o.method === 'PATCH') { if (P.get('base') === 'ko') return rep(503, { message: 'refusé' }); const b = JSON.parse(o.body); ligne = b.data; window.__ECRITURES++; window.__LIGNE = ligne; return rep(200, [{ id: 'studio_photos_12' }]); }
  return rep(405, {});
};
const base = { url: 'https://base.invalid', auth: (x) => ({ ...(x || {}) }), entete: () => ({}), withOwner: (o) => o };
createRoot(document.getElementById('r')).render(<StudioPhoto C={C} paires={[{ num: '12', cle: '12', titre: 'Nike Air Max 90 inventée' }]} base={base} initiale="12" onClose={() => {}}/>);
