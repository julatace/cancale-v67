// La page du banc scripts/bancs/annonces-egalite.cjs (19 nov.) : l'écran Annonces natif (src/natif/ecrans/Annonces.jsx)
// nourri par les VRAIES règles (src/articles/modele.js) sur une base INVENTÉE. ?v=lbc|ebay|vc|tous|volume|vide&theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr/natif.js';
import frEgalite from '../../src/i18n/langues/fr/egalite.js';
import { poserIcone } from '../../src/natif/index.js';
import VueAnnonces from '../../src/natif/ecrans/Annonces.jsx';
import { construireArticles, filtrerArticles, compterArticles, trierArticles, limitesDe, NOM_SITE } from '../../src/articles/modele.js';
import { tr } from '../../src/i18n/index.js';

ajouterSourceApp(frNatif); ajouterSourceApp(frEgalite);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const V = P.get('v') || 'lbc';
const J = 24 * 3600e3, NOW = Date.parse('2026-11-19T12:00:00Z');
const MOD = ['Nike Air Max 90', 'Adidas Samba OG', 'New Balance 550', 'Asics Gel-Lyte III', 'Puma Suede Classic', 'Reebok Club C 85 Vintage édition limitée très longue'];
const photo = (i) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${(i * 47) % 360},30%,70%)"/></svg>`)}`;
const ann = (site, i, extra = {}) => ({ site, id: site.slice(0, 2) + i, compte: site + '-1', pseudo: site === 'vinted' ? 'atelier.nord' : site === 'leboncoin' ? 'Atelier Nord' : site === 'ebay' ? 'ateliernord' : 'atelier_nord',
  titre: MOD[i % MOD.length] + ' T' + (38 + (i % 8)), photo: photo(i), prix: 40 + (i * 7) % 90, taille: String(38 + (i % 8)), condition: 'Très bon état', depuis: NOW - ((i * 9) % 80) * J,
  favoris: site === 'vestiaire' ? (i % 4) : (i * 3) % 17, vues: site === 'vestiaire' ? null : (i * 11) % 140, messages: null, etat: 'enligne', numero: String(10 + i), vintedId: '', ...extra });
const seul = (site, n) => Array.from({ length: n }, (_, i) => ann(site, i));
const SCEN = {
  lbc: () => seul('leboncoin', 8), ebay: () => seul('ebay', 8), vc: () => seul('vestiaire', 8),
  tous: () => [...seul('vinted', 4), ...seul('leboncoin', 3).map((a, i) => ({ ...a, numero: i === 0 ? '10' : '' })), ...seul('ebay', 2).map((a) => ({ ...a, numero: '' })), ...seul('vestiaire', 2)],
  volume: () => Array.from({ length: 400 }, (_, i) => ann(['vinted', 'leboncoin', 'ebay', 'vestiaire'][i % 4], i, { numero: String(100 + i) })),
  vide: () => [],
};
const annonces = (SCEN[V] || SCEN.lbc)();
const faits = {}; annonces.forEach((a, i) => { if (a.site !== 'vinted' && i % 3 !== 2) faits[`${NOM_SITE[a.site]}:${a.id}`] = { buyPrice: String(20 + i % 15), min: String(30 + i % 20) }; });
const fiches = {}; annonces.filter((a) => a.site === 'vinted').forEach((a, i) => { fiches[a.id] = { numero: a.numero, buyPrice: i % 2 ? String(25 + i) : '', min: i % 2 ? '' : String(35 + i) }; });
const M = construireArticles({ annonces, fiches, faits, achatsParNum: {}, slots: {}, aVinted: annonces.some((a) => a.site === 'vinted') });
const euros = (n) => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }) + ' €';
function Banc() {
  const [filtre, setFiltre] = React.useState({ site: 'tous', etat: P.get('etat') || 'enligne' });
  const [q, setQ] = React.useState('');
  const opts = { maintenant: NOW, seuil: 30 };
  const sites = [...new Set(M.articles.flatMap((a) => a.sites))];
  const liste = trierArticles(filtrerArticles(M.articles, { ...opts, ...filtre, recherche: q }));
  const actions = ['republier', 'main', 'baisser'].map((k) => ({ cle: k, libelle: tr('egalite.action.' + k), phrase: tr('egalite.action.' + k + '.phrase'), pour: () => true, juger: (s) => ({ ok: s.length > 0 }) }));
  return <VueAnnonces articles={liste} comptes={compterArticles(M.articles, opts)} filtre={filtre} onFiltre={setFiltre} sites={sites} recherche={q} onRecherche={setQ}
    actions={actions} onAction={() => {}} onFait={async () => ({ ok: true })} onPrix={() => {}} onRelier={() => {}} onPublier={() => {}} onEcranSite={() => {}}
    limites={limitesDe(sites).map((l) => tr('egalite.limite.' + l.quoi, { site: NOM_SITE[l.site] }))} euros={euros}
    depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((NOW - ms) / J) })} nomSite={(s) => NOM_SITE[s]} Icon={Icon}/>;
}
createRoot(document.getElementById('r')).render(<Banc/>);
