// La page du banc scripts/bancs/publier-agent.cjs (19 nov.) : l'écran « Publier sur… » (src/ecrans/PublierAgent.jsx)
// nourri par les VRAIES règles (src/publier/, src/articles/modele.js) sur une base INVENTÉE. ?v=melange|volume|vide&theme=dark&ext=0
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr/natif.js';
import frEgalite from '../../src/i18n/langues/fr/egalite.js';
import frAgent from '../../src/i18n/langues/fr/publierAgent.js';
import { poserIcone } from '../../src/natif/index.js';
import { construireArticles } from '../../src/articles/modele.js';
import PublierAgent from '../../src/ecrans/PublierAgent.jsx';

ajouterSourceApp(frNatif); ajouterSourceApp(frEgalite); ajouterSourceApp(frAgent);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const V = P.get('v') || 'melange';
const B = window.__banc; if (P.get('ext') === '0') B.ext = 'retard';
const photo = (i) => `https://images1.vinted.net/t/banc-${i}.jpg`;
const NOW = Date.parse('2026-11-19T12:00:00Z');
const ann = (site, id, x = {}) => ({ site, id: String(id), compte: site + '-1', pseudo: 'atelier.nord', titre: 'Nike Air Max 90 T42', photo: photo(id), prix: 80, taille: '42', condition: 'Très bon état', marque: 'Nike',
  depuis: NOW - 5 * 864e5, favoris: 2, vues: 10, messages: null, etat: 'enligne', numero: '', vintedId: '', url: '', ...x });
const SCEN = {
  melange: () => {
    B.fiches = { 101: { codes: { catalog_id: 1242 }, description: 'Très belle paire.', photos: [photo(101), photo(102)] },
      102: { codes: { catalog_id: 1242 }, description: 'Paire propre.', photos: [photo(103)] },
      103: { codes: { catalog_id: 2651 }, description: 'Running légère.', photos: [photo(104)] },
      104: { codes: {}, description: 'Sans catégorie lue.', photos: [photo(105)] },
      105: { codes: { catalog_id: 5426 }, description: 'Manuel.', photos: [photo(106)] } };
    B.lbc = { 9001: { id: 9001, subject: 'Baskets montantes', category: 'Chaussures', body: 'Bon état', images: ['https://img.leboncoin.fr/banc/a.jpg'], seenAt: '2026-11-19T10:00:00Z' } };
    return [ann('vinted', 101, { numero: '12', titre: 'Nike Air Max 90 blanches très belle paire édition limitée rare' }), ann('vinted', 102, { numero: '13', marque: 'Nike SB', titre: 'Nike SB Dunk Low' }),
      ann('vinted', 103, { numero: '14', titre: 'Asics Gel Nimbus femme', marque: 'Asics', taille: '39.5' }), ann('vinted', 104, { numero: '15', titre: 'Salomon XT-6' }),
      ann('vinted', 105, { numero: '16', titre: 'Manuel de maths 3e', marque: '', taille: '' }),
      ann('leboncoin', 9001, { numero: '17', titre: 'Baskets montantes', marque: '', taille: '', condition: '', photo: 'https://img.leboncoin.fr/banc/a.jpg' })];
  },
  volume: () => {
    B.fiches = {};
    return Array.from({ length: 60 }, (_, i) => { const id = 200 + i; B.fiches[id] = { codes: { catalog_id: [1242, 2632, 2645, 2651, 2618, 2656][i % 6] }, description: 'Paire ' + i, photos: [photo(id)] };
      return ann('vinted', id, { numero: String(100 + i), titre: ['Nike Air Max 90', 'Adidas Samba OG', 'Salomon XT-6 très longue désignation de modèle', 'New Balance 550', 'Dr. Martens 1460', 'Paraboot Michael'][i % 6] + ' T' + (38 + (i % 8)),
        marque: ['Nike', 'adidas', 'Salomon', 'New Balance', 'Dr. Martens', 'Paraboot'][i % 6], taille: String(38 + (i % 8)) }); });
  },
  vide: () => [],
};
const annonces = (SCEN[V] || SCEN.melange)();
const fiches = {}; annonces.filter((a) => a.site === 'vinted').forEach((a) => { fiches[a.id] = { numero: a.numero }; });
const faits = {}; annonces.filter((a) => a.site !== 'vinted').forEach((a) => { faits['Leboncoin:' + a.id] = { numero: { valeur: a.numero } }; });
const M = construireArticles({ annonces: annonces.map((a) => ({ ...a, numero: a.site === 'vinted' ? '' : a.numero })), fiches, faits, achatsParNum: {}, slots: {}, aVinted: true });
// Les annonces d'un autre site sans N° dans la base inventée : le N° y est posé comme l'app le lit (référence VRM).
const articles = M.articles.map((a) => (a.numero ? a : { ...a, numero: (annonces.find((x) => String(x.id) === a.annonces[0].id) || {}).numero || '' }));
function Banc() { const [ouverte, setOuverte] = React.useState(true); return ouverte ? <PublierAgent ouverte articles={articles} onRetour={() => setOuverte(false)}/> : <div data-pa-ferme="">fermé</div>; }
createRoot(document.getElementById('r')).render(<Banc/>);
