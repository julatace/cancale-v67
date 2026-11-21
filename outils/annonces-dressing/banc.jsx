// La page du banc scripts/bancs/annonces-dressing.cjs (21 nov.) : l'écran Annonces natif (src/natif/ecrans/Annonces.jsx) nourri
// par les VRAIES règles (src/articles/sources.js `annoncesVinted`, src/articles/modele.js) sur une base INVENTÉE :
// deux comptes Vinted dont UN BLOQUÉ (en pause : sa lecture + la trace de ses fiches, comme `lireAnnoncesEgalite` la lui passe),
// un compte Leboncoin, un compte eBay. ?v=tous|volume|vide&theme=dark. Les photos viennent du serveur du banc (/photo/N.svg),
// servies EN RETARD : une carte qui ne réserve pas sa place saute quand elles arrivent.
// N'importe que des modules qui existaient avant le 21 nov. : le même banc tourne sur l'arbre d'avant (il doit y rougir).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr/natif.js';
import frEgalite from '../../src/i18n/langues/fr/egalite.js';
import frTableau from '../../src/i18n/langues/fr/tableau.js';
import { poserIcone } from '../../src/natif/index.js';
import VueAnnonces from '../../src/natif/ecrans/Annonces.jsx';
import { annoncesVinted } from '../../src/articles/sources.js';
import { construireArticles, filtrerArticles, compterArticles, trierArticles, statutTableau, NOM_SITE } from '../../src/articles/modele.js';

ajouterSourceApp(frNatif); ajouterSourceApp(frEgalite); ajouterSourceApp(frTableau);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const V = P.get('v') || 'tous';
const J = 24 * 3600e3, NOW = Date.now();
const MOD = ['nike air max 1 bleu', 'adidas handball spezial noir', 'nike SB dunk low saint patrick’s day vert', 'nike p-6000 gris', 'salomon XT-6 noir', 'new balance 550 blanc vert édition très longue pour voir la coupe'];
const MARQ = ['Nike', 'adidas', 'Nike SB', 'Nike', 'Salomon', 'New Balance'];
const photo = (i) => (i % 9 === 4 ? null : `/photo/${i}.svg`);
const item = (i, extra = {}) => ({ id: String(10000 + i), title: MOD[i % MOD.length] + ' taille ' + (38 + (i % 8)), photo: photo(i), price: 27 + (i * 7) % 60, size: String(38 + (i % 8)),
  condition: 'Très bon état', brand: MARQ[i % MARQ.length], createdTs: NOW - ((i * 5) % 50) * J, favourites: (i * 3) % 21, views: (i * 13) % 140, url: '', ...extra });
const n = V === 'volume' ? 1000 : V === 'vide' ? 0 : 7;
const lues = Array.from({ length: n }, (_, i) => item(i));
const comptes = [{ uid: '111', pseudo: 'atelier.nord', ok: true, lu: NOW - 18 * 60e3, enLigne: lues.slice(0, Math.max(0, n - 2)), aConfirmer: [], masquees: lues.slice(Math.max(0, n - 2), Math.max(0, n - 1)), brouillons: lues.slice(Math.max(0, n - 1)) }];
// Le compte BLOQUÉ (en pause) : sa lecture d'après le blocage ne porte qu'une vente ; ses 2 autres annonces sont la trace de ses fiches.
if (V !== 'vide') comptes.push({ uid: '222', pseudo: 'shop_bloque', ok: true, lu: NOW - 3 * J, horsLigne: true, enLigne: [item(900)], aConfirmer: [], masquees: [], brouillons: [],
  traces: [{ it: item(901, { brand: '' }), le: Date.parse('2026-11-18T15:15:00Z'), par: 'numero' }, { it: item(902, { brand: '' }), le: NOW - 3 * J, par: 'lecture' }] });
const annonces = annoncesVinted(comptes);
if (V !== 'vide') annonces.push(
  { site: 'leboncoin', id: 'lb1', compte: 'lbc-1', pseudo: 'Atelier Nord', titre: 'adidas samba gris taille 36,5', photo: '/photo/31.svg', prix: 49, taille: '36,5', condition: '', depuis: NOW - 40 * J, favoris: 4, vues: 52, messages: 1, etat: 'enligne', numero: '', vintedId: '', url: '' },
  { site: 'ebay', id: 'eb1', compte: 'eb-1', pseudo: 'ateliernord', titre: 'Nike Air Force 1 Low blanc taille 42', photo: '/photo/32.svg', prix: 55, taille: '42', condition: '', depuis: NOW - 12 * J, favoris: 2, vues: 21, messages: null, etat: 'enligne', numero: '', vintedId: '', url: '' });
const fiches = {}; comptes.forEach((c) => [...(c.enLigne || []), ...(c.masquees || []), ...(c.brouillons || []), ...((c.traces || []).map((t) => t.it))].forEach((it, k) => { fiches[it.id] = { numero: String(c.uid === '222' ? 'B' + (40 + k) : 1 + Number(it.id) - 10000), buyPrice: k % 3 ? String(20 + k % 9) : '' }; }));
// Un doublon de N° (deux annonces présentes du même compte sous le N° 3) : le SEUL rouge, sur la Plaque.
if (n >= 4) fiches['10003'].numero = '3', fiches['10002'].numero = '3';
const M = construireArticles({ annonces, fiches, faits: {}, achatsParNum: {}, slots: {}, aVinted: true });
const euros = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
const opts = { maintenant: NOW, seuil: 30 };
const dortDe = (a) => { if (!filtrerArticles([a], { ...opts, etat: 'dorment' }).length) return null; const d = a.annonces.filter((x) => x.etat === 'enligne' && x.depuis != null).map((x) => x.depuis); return d.length ? Math.floor((NOW - Math.min(...d)) / J) : null; };
window.__banc = { comptes: compterArticles(M.articles, opts), nBloque: 3 };
function Banc() {
  const [filtre, setFiltre] = React.useState({ site: 'tous', etat: P.get('etat') || 'enligne' });
  const [q, setQ] = React.useState('');
  const sites = [...new Set(M.articles.flatMap((a) => a.sites))];
  const liste = trierArticles(filtrerArticles(M.articles, { ...opts, ...filtre, recherche: q }));
  const actions = [{ cle: 'recreer', libelle: tr('egalite.action.republier'), icone: 'sync', phrase: tr('egalite.action.republier.phrase'),
    pour: (a) => a.annonces.some((x) => x.site === 'vinted' && x.etat === 'enligne'), juger: (s) => ({ ok: s.length > 0 }) }];
  const lignesT = trierArticles(M.articles).map((a) => ({ a, statut: statutTableau(a, {}) })).filter((x) => x.statut);
  window.__lance = window.__lance || [];
  return <>
    <VueAnnonces articles={liste} comptes={compterArticles(M.articles, opts)} filtre={filtre} onFiltre={setFiltre} sites={sites} recherche={q} onRecherche={setQ} filtreSite={false}
    actions={actions} onAction={(k, s) => window.__lance.push([k, s.map((a) => a.cle)])} onFait={async () => ({ ok: true })} onPrix={() => {}} onRelier={() => {}} onPublier={() => {}} onFiche={(a) => { window.__fiche = a.cle; }}
    travail={{ site: 'tous', articles: lignesT, filtres: [], compte: '', majLe: NOW - 18 * 60e3, onRafraichir: () => { window.__rafraichi = (window.__rafraichi || 0) + 1; } }}
    Logo={(s) => <span data-logo={s}/>} dortDe={dortDe} euros={euros} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((NOW - ms) / J) })} nomSite={(s) => NOM_SITE[s]} Icon={Icon}/>
  </>;
}
createRoot(document.getElementById('r')).render(<Banc/>);
