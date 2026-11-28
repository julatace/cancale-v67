// La page du banc scripts/bancs/republier-essouffle.cjs (28 nov.) : l'écran Annonces natif sur sa vue « À republier »
// (src/natif/ecrans/RepublierPriorite.jsx), nourrie par les VRAIES règles (src/articles/, src/republierPriorite.js,
// src/essoufflement.js) sur une base et des courbes INVENTÉES. Les gestes sont relevés (window.__ouvertures), jamais envoyés.
//   ?theme=dark  &courbes=passu (lecture ratée) | lecture (en cours)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import fr from '../../src/i18n/langues/fr.js';
import { poserIcone } from '../../src/natif/index.js';
import VueAnnonces from '../../src/natif/ecrans/Annonces.jsx';
import RepublierPriorite, { usePrioSelection, PleinRepublier } from '../../src/natif/ecrans/RepublierPriorite.jsx';
import { annoncesVinted } from '../../src/articles/sources.js';
import { construireArticles, filtrerArticles, compterArticles, trierArticles, statutTableau, NOM_SITE } from '../../src/articles/modele.js';
import { republierEnPriorite, lireReglagePrio } from '../../src/republierPriorite.js';
import { courbesParCompte } from '../../src/essoufflement.js';
import { jourCourbe } from '../../src/courbeAnnonce.js';
import { lienPanneau } from '../../src/ouvrirPanneau.js';
import { ACTIONS_EXTENSION } from '../../src/actionsExtension.js';
import { LogoSite } from '../../src/natif/LogoSite.jsx';

ajouterSourceApp(fr);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const J = 24 * 3600e3, NOW = Date.now(), AUJ = jourCourbe(NOW);
const MOD = ['Nike Air Max 1 bleu marine', 'Adidas Handball Spezial noir gomme', 'Nike SB Dunk Low Saint Patrick vert', 'Nike P-6000 gris argent', 'Salomon XT-6 noir', 'New Balance 550 blanc vert'];
const item = (i, jours, extra = {}) => ({ id: String(10000 + i), title: MOD[i % MOD.length] + ' taille ' + (38 + (i % 8)), photo: `/photo/${i}.svg`, price: 35 + (i * 7) % 60, size: String(38 + (i % 8)),
  condition: 'Très bon état', brand: 'Nike', createdTs: NOW - jours * J, favourites: (i * 3) % 7, views: 20 + (i * 13) % 140, url: '', ...extra });
// Compte 111 : 1 (41 j), 2 (90 j), 3 (35 j), 10 (12 j, JEUNE) à plat ; 4 et 9 dorment mais vivent ; 5 réservée (à plat) ; 11 trou.
// Compte 444 : 20 (12 j) à plat, sans aucune republication passée (gain « — ») ; 21 dort et vit.
const c111 = [item(1, 41, { views: 136, favourites: 2 }), item(2, 90, { views: 61, favourites: 3 }), item(3, 35, { views: 45, favourites: 1 }), item(4, 120, { views: 260, favourites: 4 }),
  item(5, 64, { reserved: true }), item(9, 45), item(10, 12, { views: 18, favourites: 0 }), item(11, 14)];
const c444 = [item(20, 12, { views: 33, favourites: 1 }), item(21, 39)];
const comptes = [
  { uid: '111', pseudo: 'atelier.nord', ok: true, lu: NOW - 18 * 60e3, enLigne: c111, aConfirmer: [], masquees: [], brouillons: [] },
  { uid: '444', pseudo: 'nord.sneakers', ok: true, lu: NOW - 25 * 60e3, enLigne: c444, aConfirmer: [], masquees: [], brouillons: [] },
];
const annonces = annoncesVinted(comptes);
const fiches = {}; [...c111, ...c444].forEach((it) => { fiches[it.id] = { numero: String(Number(it.id) - 10000 + 1), buyPrice: '20' }; });
const M = construireArticles({ annonces, fiches, faits: {}, achatsParNum: {}, slots: {}, aVinted: true });
const euros = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' €';
// Les courbes : vues/favoris par jour lu, jusqu'à aujourd'hui (`null` = jour non lu).
const courbe = (vf) => vf.map((x, i) => (x ? [AUJ - vf.length + 1 + i, x[0], x[1], 4000, 600] : null)).filter(Boolean);
const plat = (v, f, n = 6) => Array.from({ length: n }, (_, i) => [v + Math.floor(i / 3), f]);
const vit = (v, f) => [[v, f], [v + 6, f], [v + 13, f + 1], [v + 21, f + 1], [v + 30, f + 2]];
const jr = AUJ - 30;
const lignes = [
  { id: 'courbes_annonces_111_navA', a: { '10001': courbe(plat(136, 2, 6)), '10002': courbe(plat(61, 3, 8)), '10003': courbe(plat(45, 1, 5)), '10004': courbe(vit(230, 2)), '10005': courbe(plat(70, 2)),
      '10009': courbe(vit(40, 1)), '10010': courbe(plat(18, 0, 7)), '10011': courbe([[30, 1], null, [30, 1], [30, 1], [30, 1], [30, 1]]),
      // SES republications passées : 3 annonces neuves (14, 22 et 27 vues au 3e jour ⇒ +21 en moyenne, d'après 3)
      '19001': [[jr, 3, 0, 4000, 700], [jr + 3, 14, 0, 4000, 700]], '19002': [[jr + 6, 2, 0, 4000, 700], [jr + 9, 22, 1, 4000, 700]], '19003': [[jr + 12, 5, 0, 4000, 700], [jr + 15, 27, 2, 4000, 700]] },
    ev: { '19001': [[jr, 'r']], '19002': [[jr + 6, 'r']], '19003': [[jr + 12, 'r']] } },
  { id: 'courbes_annonces_444_navA', a: { '10020': courbe(plat(33, 1, 5)), '10021': courbe(vit(50, 1)) }, ev: {} },
];
const lus = { '111': ['10001', '10002', '10003', '10004', '10005', '10009', '10010', '10011', '19001', '19002', '19003'], '444': ['10020', '10021'] };
const COURBES = P.get('courbes') === 'passu' ? null : P.get('courbes') === 'lecture' ? undefined : courbesParCompte(lignes, lus);
window.__ouvertures = [];
window.__banc = {};

function Annonces() {
  const [filtre, setFiltre] = React.useState({ site: 'tous', etat: 'arepublier' });
  const [q, setQ] = React.useState('');
  const [reg, setReg] = React.useState(() => lireReglagePrio({}));
  const opts = { maintenant: NOW, seuil: reg.jours };
  const prio = React.useMemo(() => republierEnPriorite(M.articles, { ...reg, maintenant: NOW, courbes: COURBES }), [reg]);
  window.__banc.prio = prio && { n: prio.n, ids: prio.liste.map((l) => l.annonce.id), ess: prio.liste.filter((l) => l.essouffle).map((l) => l.annonce.id), etat: prio.essouffle, exclues: prio.exclues };
  const L = prio ? prio.liste : [];
  const sel = usePrioSelection(L);
  const a = ACTIONS_EXTENSION.republier;
  const onRepublier = ({ ids }) => { window.__ouvertures.push(lienPanneau({ site: 'vinted', page: a.page, ids, action: a.action })); };
  const priorite = { n: prio ? prio.liste.length : undefined, plein: L.length ? <PleinRepublier lignes={L} coches={sel.coches} onRepublier={onRepublier}/> : null,
    contenu: <RepublierPriorite res={prio} lignes={L} coches={sel.coches} onBasculer={sel.onBasculer} onTout={sel.onTout} onReglage={(r) => setReg((x) => lireReglagePrio({ ...x, ...r }))}
      onRepublierUne={(l) => onRepublier({ ids: [l.annonce.id], compte: l.annonce.compte })} Logo={(s) => <LogoSite site={s}/>} euros={euros} Icon={Icon}/> };
  const sites = [...new Set(M.articles.flatMap((x) => x.sites))];
  const liste = trierArticles(filtrerArticles(M.articles, { ...opts, ...filtre, recherche: q }));
  const lignesT = trierArticles(M.articles).map((x) => ({ a: x, statut: statutTableau(x, {}) })).filter((x) => x.statut);
  return <VueAnnonces priorite={priorite} articles={liste} comptes={compterArticles(M.articles, opts)} filtre={filtre} onFiltre={setFiltre} sites={sites} recherche={q} onRecherche={setQ} filtreSite={false}
    actions={[]} onAction={() => {}} onFait={async () => ({ ok: true })} onPrix={() => {}} onRelier={() => {}} onFiche={() => {}}
    travail={{ site: 'tous', articles: lignesT, filtres: [], compte: '', majLe: NOW - 18 * 60e3, onRafraichir: () => {} }}
    Logo={(s) => <LogoSite site={s}/>} euros={euros} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((NOW - ms) / J) })} nomSite={(s) => NOM_SITE[s]} Icon={Icon}/>;
}
createRoot(document.getElementById('r')).render(<Annonces/>);
