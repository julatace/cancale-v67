// La page du banc scripts/bancs/visuel-annonces.cjs (24 nov., lot visuel-annonces) : l'écran Annonces natif
// (src/natif/ecrans/Annonces.jsx) nourri par les VRAIES règles (src/articles/sources.js, src/articles/modele.js) sur une base
// INVENTÉE au volume réel (des centaines d'annonces, trois comptes). Deux annonces portent le MÊME titre avec deux photos
// différentes (le leurre) : chaque carte doit montrer la photo de SON identifiant, jamais celle du titre voisin.
//   ?n=600 · theme=dark · arrivee=700 (ms avant que la lecture finisse ; 0 = contenu DÉJÀ connu, aucun squelette)
// Les photos viennent du serveur du banc (/photo/N.svg), servies EN RETARD.
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
import frInv from 'vrm-inv-fr';   // src/i18n/langues/fr/visuelAnnonces.js (un module vide sur l'arbre d'avant)

ajouterSourceApp(frNatif); ajouterSourceApp(frEgalite); ajouterSourceApp(frTableau); if (frInv) ajouterSourceApp(frInv);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
try { localStorage.setItem('vrm_annonces_vue_tel', 'grille'); localStorage.setItem('vrm_tableau_annonces', JSON.stringify({ vue: 'grille' })); } catch (_) {}
const N = Number(P.get('n') || 600), ARRIVEE = Number(P.get('arrivee') || 0);
const J = 24 * 3600e3, NOW = Date.now();
const MOD = ['Nike Air Max 1 bleu', 'adidas Handball Spezial noir', 'Nike SB Dunk Low vert', 'Nike P-6000 gris', 'Salomon XT-6 noir', 'New Balance 550 blanc vert édition très longue pour voir la coupe du titre'];
const MARQ = ['Nike', 'adidas', 'Nike SB', 'Nike', 'Salomon', 'New Balance'];
const photo = (i) => (i % 11 === 7 ? null : `/photo/${i}.svg`);
const item = (i, extra = {}) => ({ id: String(10000 + i), title: MOD[i % MOD.length] + ' taille ' + (38 + (i % 8)), photo: photo(i), price: 27 + (i * 7) % 160 + (i % 3 ? 0 : 0.5), size: String(38 + (i % 8)),
  condition: 'Très bon état', brand: MARQ[i % MARQ.length], createdTs: NOW - ((i * 5) % 50) * J, favourites: i % 4 === 3 ? undefined : (i * 3) % 41, views: (i * 13) % 1400, url: '', ...extra });
const lues = Array.from({ length: N }, (_, i) => item(i));
// Le LEURRE : deux annonces du 1er compte affiché portent le MÊME titre, chacune SA photo.
const L0 = Math.floor(N / 3) * 2; lues[L0].title = lues[L0 + 1].title = 'Nike Air Max 90 blanc taille 42'; lues[L0].createdTs = lues[L0 + 1].createdTs = NOW - 60e3;   // en tête de liste
const tiers = Math.floor(N / 3);
const comptes = [
  { uid: '111', pseudo: 'atelier.nord', ok: true, lu: NOW - 18 * 60e3, enLigne: lues.slice(0, tiers - 3), aConfirmer: lues.slice(tiers - 3, tiers - 1), masquees: lues.slice(tiers - 1, tiers), brouillons: [] },
  { uid: '222', pseudo: 'zoé_shop', ok: true, lu: NOW - 40 * 60e3, enLigne: lues.slice(tiers, 2 * tiers), aConfirmer: [], masquees: [], brouillons: [] },
  { uid: '333', pseudo: 'kicks.paris', ok: true, lu: NOW - 5 * 60e3, enLigne: lues.slice(2 * tiers), aConfirmer: [], masquees: [], brouillons: [] },
];
const annonces = annoncesVinted(comptes);
annonces.push({ site: 'leboncoin', id: 'lb1', compte: 'lbc-1', pseudo: 'Atelier Nord', titre: 'adidas samba gris taille 36,5', photo: '/photo/9001.svg', prix: 49, taille: '36,5', condition: '', depuis: NOW - 40 * J, favoris: 4, vues: 52, messages: 1, etat: 'enligne', numero: '' });
const fiches = {}; lues.forEach((it, k) => { fiches[it.id] = { numero: String(k + 1) }; });
fiches['10005'].numero = 'B230';
if (N >= 8) { fiches['10003'].numero = '3'; fiches['10002'].numero = '3'; }   // un doublon : le SEUL rouge
const M = construireArticles({ annonces, fiches, faits: {}, achatsParNum: {}, slots: {}, aVinted: true });
// La photo ATTENDUE de chaque article : celle de SON identifiant d'annonce (jamais d'un titre).
const parId = new Map(annonces.map((x) => [String(x.id), x.photo || (lues.find((y) => y.id === String(x.id)) || {}).photo || null]));
window.__attendu = {}; for (const a of M.articles) { const id = a.annonces[0] && a.annonces[0].id; window.__attendu[a.cle] = id != null ? (parId.get(String(id)) || null) : null; }
window.__leurre = M.articles.filter((a) => a.titre === 'Nike Air Max 90 blanc taille 42').map((a) => a.cle);
const euros = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
const opts = { maintenant: NOW, seuil: 30 };
const COMPTES = compterArticles(M.articles, opts);   // calculés une fois (l'app les mémorise aussi)
function Banc() {
  const [filtre, setFiltre] = React.useState({ site: 'tous', etat: 'enligne' });
  const [q, setQ] = React.useState('');
  const [lu, setLu] = React.useState(ARRIVEE <= 0);
  React.useEffect(() => { if (lu) return undefined; const t = setTimeout(() => { window.__arriveeA = performance.now(); setLu(true); }, ARRIVEE); return () => clearTimeout(t); }, []);
  const sites = [...new Set(M.articles.flatMap((a) => a.sites))];
  const liste = React.useMemo(() => (lu ? trierArticles(filtrerArticles(M.articles, { ...opts, ...filtre, recherche: q })) : undefined), [lu, filtre, q]);
  const lignesT = React.useMemo(() => (lu ? trierArticles(M.articles).map((a) => ({ a, statut: statutTableau(a, {}) })).filter((x) => x.statut) : undefined), [lu]);
  return <VueAnnonces articles={liste} comptes={COMPTES} filtre={filtre} onFiltre={(f) => { window.__tapA = performance.now(); setFiltre(f); }} sites={sites} recherche={q} onRecherche={setQ} filtreSite={false}
    actions={[]} onAction={() => {}} onFait={async () => ({ ok: true })} onPrix={() => {}} onRelier={() => {}} onFiche={(a) => { window.__fiche = a.cle; }}
    travail={{ site: 'tous', articles: lignesT, filtres: [], compte: '', majLe: lu ? NOW - 18 * 60e3 : undefined, onRafraichir: () => {} }}
    Photo={(src, o) => <img src={src} alt="" loading="lazy" decoding="async" className={o && o.className} style={o && o.style}/>}
    Logo={(s) => <span data-logo={s}/>} euros={euros} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((NOW - ms) / J) })} nomSite={(s) => NOM_SITE[s]} Icon={Icon}/>;
}
createRoot(document.getElementById('r')).render(<Banc/>);
