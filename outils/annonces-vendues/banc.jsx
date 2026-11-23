// La page du banc scripts/bancs/annonces-vendues.cjs (22 nov.) : le TABLEAU Annonces de l'ordinateur (src/natif/ecrans/Annonces.jsx
// → AnnoncesTableau → TableauTravail) nourri par les VRAIES règles (src/articles/sources.js `annoncesVinted`,
// `annoncesVintedVendues`, src/articles/modele.js, src/natif/ecrans/annoncesComptes.js) sur une base INVENTÉE multi-sites :
// Vinted (2 comptes : en ligne, masquée, retirée, 3 ventes PROUVÉES sorties du dressing dont 2 au même titre), Leboncoin (3 vendues,
// 1 en ligne), eBay (1 vendue, 1 en ligne). Le filtre Site et ses nombres : la formule d'AnnoncesEgalite (`nRangeesSite`).
// ?theme=dark.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr/natif.js';
import frEgalite from '../../src/i18n/langues/fr/egalite.js';
import frTableau from '../../src/i18n/langues/fr/tableau.js';
import { poserIcone } from '../../src/natif/index.js';
import VueAnnonces from '../../src/natif/ecrans/Annonces.jsx';
import { annoncesVinted, annoncesVintedVendues } from '../../src/articles/sources.js';
import { construireArticles, trierArticles, statutTableau, NOM_SITE, SITES } from '../../src/articles/modele.js';
import { groupesParCompte } from '../../src/natif/ecrans/annoncesComptes.js';

ajouterSourceApp(frNatif); ajouterSourceApp(frEgalite); ajouterSourceApp(frTableau);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const J = 24 * 3600e3, NOW = Date.now();
const it = (id, titre, prix, extra = {}) => ({ id: String(id), title: titre, photo: null, price: prix, size: '42', condition: 'Très bon état', brand: 'Nike', createdTs: NOW - 20 * J, favourites: 3, views: 40, url: '', ...extra });
const comptes = [
  { uid: '11', pseudo: 'shopa', ok: true, lu: NOW - 600e3, enLigne: [it(601, 'Nike Dunk Low gris taille 42', 60)], aConfirmer: [], masquees: [], brouillons: [], retirees: [it(604, 'Asics Gel-Lyte III taille 41', 45)] },
  { uid: '12', pseudo: 'shopb', ok: true, lu: NOW - 600e3, enLigne: [it(602, 'Adidas Gazelle bleu taille 40', 55)], aConfirmer: [], masquees: [it(603, 'Puma Suede taille 43', 40)], brouillons: [] },
];
const ventes = [
  { _acc: { vinted_user_id: 11, login: 'shopa' }, transaction_id: 9001, title: 'Nike Air Max 90 taille 42', price: { amount: '60.0' }, date: new Date(NOW - 2 * J).toISOString() },
  { _acc: { vinted_user_id: 11, login: 'shopa' }, transaction_id: 9002, title: 'Nike Air Max 90 taille 42', price: { amount: '55.0' }, date: new Date(NOW - 3 * J).toISOString() },
  { _acc: { vinted_user_id: 12, login: 'shopb' }, transaction_id: 9003, title: 'Adidas Samba OG taille 40', price: { amount: '70.0' }, date: new Date(NOW - 4 * J).toISOString() },
];
const vendues = annoncesVintedVendues({ ventes, txnItem: { 9001: '501', 9002: '502', 9003: '503' }, vendus: new Set(['501', '502', '503']), comptes: { 11: 'shopa', 12: 'shopb' } });
const autre = (site, id, compte, pseudo, titre, etat) => ({ site, id, compte, pseudo, titre, photo: null, prix: 50, taille: '42', condition: '', marque: '', depuis: NOW - 15 * J, favoris: null, vues: null, messages: null, etat, numero: '', vintedId: '', url: '' });
const annonces = [...annoncesVinted(comptes), ...vendues,
  autre('leboncoin', 'lb1', 'L1', 'Atelier Nord', 'Adidas Spezial marron taille 40,5', 'vendue'), autre('leboncoin', 'lb2', 'L1', 'Atelier Nord', 'Nike air max 1 olive taille 43', 'vendue'),
  autre('leboncoin', 'lb3', 'L1', 'Atelier Nord', 'Salomon XT-6 noir taille 43,5', 'vendue'), autre('leboncoin', 'lb4', 'L1', 'Atelier Nord', 'New Balance 550 taille 42', 'enligne'),
  autre('ebay', 'eb1', 'E1', 'ateliernord', 'Nike Air Force 1 taille 42', 'vendue'), autre('ebay', 'eb2', 'E1', 'ateliernord', 'Jordan 1 Mid taille 44', 'enligne')];
const M = construireArticles({ annonces, fiches: {}, faits: {}, achatsParNum: {}, slots: {}, aVinted: true });
const nRangeesSite = (s) => groupesParCompte(M.articles.filter((a) => statutTableau(a, { site: s })), s).reduce((n, g) => n + g.articles.length, 0);
const sites = [...new Set(M.articles.flatMap((a) => a.sites))];
window.__banc = { attendu: { vendue: 7, parSite: Object.fromEntries(['tous', ...sites].map((s) => [s, nRangeesSite(s)])) } };
function Banc() {
  const [site, setSite] = React.useState('tous');
  const lignesT = trierArticles(M.articles).map((a) => ({ a, statut: statutTableau(a, { site }) })).filter((x) => x.statut);
  const filtres = [{ cle: 'site', libelle: tr('tableau.col.site'), valeur: site, onChange: setSite,
    options: [{ cle: 'tous', libelle: tr('egalite.site.tous'), n: nRangeesSite('tous') }, ...SITES.filter((s) => sites.includes(s)).map((s) => ({ cle: s, libelle: NOM_SITE[s], n: nRangeesSite(s) }))] }];
  return <VueAnnonces articles={[]} comptes={{}} filtre={{ site: 'tous', etat: 'enligne' }} onFiltre={() => {}} sites={sites} recherche="" onRecherche={() => {}} filtreSite={false}
    actions={[]} onAction={() => {}} onFait={async () => ({ ok: true })} onPrix={() => {}} onRelier={() => {}} onPublier={() => { window.__publie = 1; }} onFiche={() => {}}
    limites={['Leboncoin : l’acceptation automatique des offres n’existe pas sur ce site.']}
    travail={{ site, articles: lignesT, filtres, compte: '', majLe: NOW - 60e3, onRafraichir: () => {} }}
    Logo={(s) => <span data-logo={s}/>} euros={(x) => x + ' €'} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((NOW - ms) / J) })} nomSite={(s) => NOM_SITE[s]} Icon={Icon}/>;
}
createRoot(document.getElementById('r')).render(<Banc/>);
