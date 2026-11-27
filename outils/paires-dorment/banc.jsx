// La page du banc scripts/bancs/paires-dorment.cjs (27 nov., « Paires qui dorment ») : l'écran Annonces natif
// (src/natif/ecrans/Annonces.jsx) sur le segment « Dorment », avec l'ENTRÉE du plan et SA feuille
// (src/natif/ecrans/PairesDorment.jsx), nourries par les VRAIES règles (src/articles/sources.js, src/articles/modele.js,
// src/pairesDorment.js) sur une base INVENTÉE. La porte est simulée (?porte=mix : compte 111 connecté, 444 non ;
// ?porte=non : aucun) ; chaque geste est RELEVÉ (window.__gestes), jamais envoyé.   ?ouvert=1 &theme=dark &porte=mix|non
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import fr from '../../src/i18n/langues/fr.js';
import { poserIcone } from '../../src/natif/index.js';
import VueAnnonces from '../../src/natif/ecrans/Annonces.jsx';
import { EntreePairesDorment, FeuillePairesDorment } from '../../src/natif/ecrans/PairesDorment.jsx';
import { annoncesVinted } from '../../src/articles/sources.js';
import { construireArticles, filtrerArticles, compterArticles, trierArticles, statutTableau, NOM_SITE } from '../../src/articles/modele.js';
import { planPairesDorment, selectCourbesPlan } from '../../src/pairesDorment.js';
import { LogoSite } from '../../src/natif/LogoSite.jsx';

ajouterSourceApp(fr);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const PORTE = P.get('porte') || 'mix';
const J = 24 * 3600e3, NOW = Date.now();
const item = (i, jours, extra = {}) => ({ id: String(10000 + i), title: 'Nike Air Max 1 bleu marine taille 42', photo: `/photo/${i}.svg`, price: 60 + (i * 7) % 60, size: '42',
  condition: 'Très bon état', brand: 'Nike', createdTs: NOW - jours * J, favourites: (i * 3) % 7, views: 20 + (i * 13) % 140, url: '', ...extra });
// Compte 111 (connecté en ?porte=mix) : 5 paires qui dorment au MÊME titre, 2 récentes ; compte 444 (pas connecté) : 3 qui dorment,
// dont une au même titre encore. Achats : connus sauf deux (la porte « Saisir l'achat »). 21 j pile : hors plan.
const c111 = [item(1, 41, { views: 136, favourites: 0 }), item(2, 90, { views: 10, favourites: 3 }), item(3, 22, { views: 5, favourites: 2 }), item(4, 120, { views: 60, favourites: 1 }),
  item(5, 64, { views: null, favourites: null }), item(10, 5), item(11, 21)];
const c444 = [item(20, 58, { views: 12, favourites: 4 }), item(21, 39, { views: 44, favourites: 1, title: 'Adidas Handball Spezial noir gomme' }), item(22, 95, { views: 3, favourites: 0 })];
const comptes = [
  { uid: '111', pseudo: 'atelier.nord', ok: true, lu: NOW - 18 * 60e3, enLigne: c111, aConfirmer: [], masquees: [item(13, 80)], brouillons: [] },
  { uid: '444', pseudo: 'nord.sneakers', ok: true, lu: NOW - 25 * 60e3, enLigne: c444, aConfirmer: [], masquees: [], brouillons: [] },
];
const annonces = annoncesVinted(comptes);
const achats = { 10001: '45', 10002: '30', 10003: '80', 10004: '', 10005: '55', 10020: '62,50', 10021: '', 10022: '20', 10010: '40', 10011: '40', 10013: '90' };
const fiches = {}; [...c111, ...c444, item(13, 80)].forEach((it) => { fiches[it.id] = { numero: String(Number(it.id) - 10000 + 1), buyPrice: achats[it.id] || '', ...(it.id === '10002' ? { min: '50' } : {}) }; });
const M = construireArticles({ annonces, fiches, faits: {}, achatsParNum: {}, slots: {}, aVinted: true });
const euros = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Math.round(x * 100) / 100) ? 0 : 2 }) + ' €';
// La courbe LUE de la paire 10001 (compte 111) : son dernier jour lu dit 140 vues · 1 favori ; une courbe d'un AUTRE compte au même identifiant est ignorée.
const jour = (t) => { const d = new Date(t); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); };
const ids = M.articles.flatMap((a) => a.annonces.filter((x) => x.site === 'vinted').map((x) => x.id));
const sel = selectCourbesPlan(ids);
const COURBES = { alias: sel.alias, rows: [
  { id: 'courbes_annonces_111_chrome', [sel.alias['10001']]: [[jour(NOW - 3 * J), 130, 0, 6000, 600], [jour(NOW - J), 140, 1, 6000, 610]] },
  { id: 'courbes_annonces_444_chrome', [sel.alias['10001']]: [[jour(NOW), 999, 99, 6000, 700]] },
] };
const juger = (site, compte) => (PORTE === 'mix' && String(compte) === '111' ? { ok: true, voie: 'ici' }
  : { ok: false, lecture: true, raison: 'pas-ouvert', cle: 'agir.raison.pas-ouvert', vars: { compte: String(compte) === '111' ? 'atelier.nord' : 'nord.sneakers', site: 'Vinted' }, geste: 'ouvrir-site' });
const texteRaison = (v) => (v && !v.ok ? tr(v.cle, { nav: 'Chrome', ...(v.vars || {}) }) : '');
window.__gestes = [];
window.__banc = {};

function Annonces() {
  const [filtre, setFiltre] = React.useState({ site: 'tous', etat: 'dorment' });
  const [ouvert, setOuvert] = React.useState(P.get('ouvert') === '1');
  const opts = { maintenant: NOW, seuil: 30 };
  const plan = React.useMemo(() => planPairesDorment(M.articles, { maintenant: NOW, courbes: COURBES }), []);
  window.__banc.plan = plan && { n: plan.n, argentC: plan.argentC, connus: plan.achatsConnus, cles: plan.lignes.map((l) => l.cle), lignes: plan.lignes.map((l) => ({ cle: l.cle, id: l.id, achatC: l.achatC, jours: l.jours, vues: l.vues, favoris: l.favoris, baisseC: l.baisseC, compte: l.compte })) };
  const sites = [...new Set(M.articles.flatMap((a) => a.sites))];
  const liste = trierArticles(filtrerArticles(M.articles, { ...opts, ...filtre }));
  const lignesT = trierArticles(M.articles).map((a) => ({ a, statut: statutTableau(a, {}) })).filter((x) => x.statut);
  const note = (k) => (l, x) => window.__gestes.push([k, l.cle, x == null ? null : x]);
  return <>
    <VueAnnonces dorment={{ entree: <EntreePairesDorment plan={plan} euros={euros} onOuvrir={() => setOuvert(true)}/> }} articles={liste} comptes={compterArticles(M.articles, opts)} filtre={filtre} onFiltre={setFiltre} sites={sites} filtreSite={false}
      actions={[]} onAction={() => {}} onFait={async () => ({ ok: true })} onPrix={() => {}} onRelier={() => {}} onFiche={() => {}}
      travail={{ site: 'tous', articles: lignesT, filtres: [], compte: '', majLe: NOW - 18 * 60e3, onRafraichir: () => {} }}
      Logo={(s) => <LogoSite site={s}/>} euros={euros} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((NOW - ms) / J) })} nomSite={(s) => NOM_SITE[s]} Icon={Icon}/>
    <FeuillePairesDorment ouverte={ouvert} onFermer={() => setOuvert(false)} plan={plan} juger={juger} euros={euros} texteRaison={texteRaison}
      Photo={(src) => <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>}
      onRepublier={note('republier')} onBaisser={note('baisser')} onFavoris={note('favoris')} onAchat={note('achat')}/>
  </>;
}
createRoot(document.getElementById('r')).render(<Annonces/>);
