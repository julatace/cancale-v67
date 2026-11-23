// La page du banc scripts/bancs/republier-priorite.cjs (21 nov., lot prio-recherche) : l'écran Annonces natif
// (src/natif/ecrans/Annonces.jsx) avec SA vue « À republier » (src/natif/ecrans/RepublierPriorite.jsx), nourrie par les VRAIES
// règles (src/articles/sources.js, src/articles/modele.js, src/republierPriorite.js) sur une base INVENTÉE ; et la rangée
// d'Aujourd'hui (src/natif/ecrans/Aujourdhui.jsx). Le geste « Republier N » est relevé (window.__ouvertures : l'URL du panneau
// que l'app ouvrirait, `lienPanneau`), jamais envoyé.   ?vue=annonces|aujourdhui &etat=arepublier &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import fr from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque } from '../../src/natif/index.js';
import VueAnnonces from '../../src/natif/ecrans/Annonces.jsx';
import Aujourdhui from '../../src/natif/ecrans/Aujourdhui.jsx';
import RepublierPriorite, { usePrioSelection, PleinRepublier } from '../../src/natif/ecrans/RepublierPriorite.jsx';
import { annoncesVinted } from '../../src/articles/sources.js';
import { construireArticles, filtrerArticles, compterArticles, trierArticles, statutTableau, NOM_SITE } from '../../src/articles/modele.js';
import { republierEnPriorite, lireReglagePrio, rangeeAujourdhui } from '../../src/republierPriorite.js';
import { lienPanneau } from '../../src/ouvrirPanneau.js';
import { ACTIONS_EXTENSION } from '../../src/actionsExtension.js';
import { LogoSite } from '../../src/natif/LogoSite.jsx';

ajouterSourceApp(fr);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const VUE = P.get('vue') || 'annonces';
const J = 24 * 3600e3, NOW = Date.now();
const MOD = ['Nike Air Max 1 bleu marine', 'Adidas Handball Spezial noir gomme', 'Nike SB Dunk Low Saint Patrick vert', 'Nike P-6000 gris argent', 'Salomon XT-6 noir', 'New Balance 550 blanc vert'];
const item = (i, jours, extra = {}) => ({ id: String(10000 + i), title: MOD[i % MOD.length] + ' taille ' + (38 + (i % 8)), photo: `/photo/${i}.svg`, price: 35 + (i * 7) % 60, size: String(38 + (i % 8)),
  condition: 'Très bon état', brand: 'Nike', createdTs: NOW - jours * J, favourites: (i * 3) % 7, views: 20 + (i * 13) % 140, url: '', ...extra });
// Compte 111 : 9 annonces qui dorment (31 à 120 j), 3 récentes, 1 masquée de 80 j ; compte 444 : 3 qui dorment ;
// compte 333 (PERSONNEL) : 2 qui dorment ; compte 222 (BLOQUÉ) : 2 qui dorment.
const c111 = [item(1, 41, { views: 136, favourites: 0 }), item(2, 90, { views: 10, favourites: 3 }), item(3, 35, { views: 5, favourites: 0 }), item(4, 120, { views: 60, favourites: 1 }),
  item(5, 64, { views: 22, favourites: 0 }), item(6, 33, { views: 140, favourites: 6 }), item(7, 50, { views: null, favourites: null }), item(8, 75, { views: 8, favourites: 0 }), item(9, 45, { views: 31, favourites: 2 }),
  item(10, 5), item(11, 12), item(12, 20)];
const c444 = [item(20, 58, { views: 12, favourites: 0 }), item(21, 39, { views: 44, favourites: 1 }), item(22, 95, { views: 3, favourites: 0 })];
const c333 = [item(30, 70), item(31, 80)];
const c222 = [item(40, 88), item(41, 66)];
const comptes = [
  { uid: '111', pseudo: 'atelier.nord', ok: true, lu: NOW - 18 * 60e3, enLigne: c111, aConfirmer: [], masquees: [item(13, 80)], brouillons: [] },
  { uid: '444', pseudo: 'nord.sneakers', ok: true, lu: NOW - 25 * 60e3, enLigne: c444, aConfirmer: [], masquees: [], brouillons: [] },
  { uid: '333', pseudo: 'perso.julien', ok: true, lu: NOW - 30 * 60e3, enLigne: c333, aConfirmer: [], masquees: [], brouillons: [] },
  { uid: '222', pseudo: 'shop_bloque', ok: true, lu: NOW - 40 * 60e3, enLigne: c222, aConfirmer: [], masquees: [], brouillons: [] },
];
const annonces = annoncesVinted(comptes);
// La paire N°5 est VENDUE sur Leboncoin (même N°) : jamais proposée.
annonces.push({ site: 'leboncoin', id: 'lb5', compte: 'lbc-1', pseudo: 'Atelier Nord', titre: 'Paire vendue sur Leboncoin', photo: null, prix: 49, taille: '42', condition: '', depuis: NOW - 9 * J, favoris: null, vues: null, messages: null, etat: 'vendue', numero: '6', vintedId: '', url: '' });
const fiches = {}; [...c111, ...c444, ...c333, ...c222, item(13, 80)].forEach((it) => { fiches[it.id] = { numero: String(Number(it.id) - 10000 + 1), buyPrice: '20' }; });
const M = construireArticles({ annonces, fiches, faits: {}, achatsParNum: {}, slots: {}, aVinted: true });
const euros = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' €';
const JOURNAL = { 'vinted#10003': [[NOW - 34 * J, 0, 0], [NOW - 20 * J, 4, 0], [NOW - 1 * J, 5, 0]] };
window.__ouvertures = [];
window.__banc = {};

function Annonces() {
  const [filtre, setFiltre] = React.useState({ site: 'tous', etat: P.get('etat') || 'arepublier' });
  const [q, setQ] = React.useState('');
  const [reg, setReg] = React.useState(() => lireReglagePrio({}));
  const opts = { maintenant: NOW, seuil: reg.jours };
  const prio = React.useMemo(() => republierEnPriorite(M.articles, { ...reg, maintenant: NOW, comptesBloques: new Set(['222']), comptesPersonnels: new Set(['333']), enLitige: { nums: new Set(['9']), ids: new Set() }, journalVues: JOURNAL }), [reg]);
  window.__banc.prio = prio && { n: prio.n, ids: prio.liste.map((l) => l.annonce.id), exclues: prio.exclues, comptes: prio.liste.map((l) => l.annonce.compte) };
  const lignes = prio ? prio.liste : [];
  const sel = usePrioSelection(lignes);
  const onRepublier = ({ ids }) => { const a = ACTIONS_EXTENSION.republier; window.__ouvertures.push(lienPanneau({ site: 'vinted', page: a.page, ids, action: a.action })); };
  const priorite = { n: prio ? prio.liste.length : undefined, plein: lignes.length ? <PleinRepublier lignes={lignes} coches={sel.coches} onRepublier={onRepublier}/> : null,
    contenu: <RepublierPriorite res={prio} lignes={lignes} coches={sel.coches} onBasculer={sel.onBasculer} onTout={sel.onTout} onReglage={(r) => setReg((a) => lireReglagePrio({ ...a, ...r }))}
      Logo={(s) => <LogoSite site={s}/>} euros={euros} Icon={Icon}/> };
  const sites = [...new Set(M.articles.flatMap((a) => a.sites))];
  const liste = trierArticles(filtrerArticles(M.articles, { ...opts, ...filtre, recherche: q }));
  const lignesT = trierArticles(M.articles).map((a) => ({ a, statut: statutTableau(a, {}) })).filter((x) => x.statut);
  return <VueAnnonces priorite={priorite} articles={liste} comptes={compterArticles(M.articles, opts)} filtre={filtre} onFiltre={setFiltre} sites={sites} recherche={q} onRecherche={setQ} filtreSite={false}
    actions={[]} onAction={() => {}} onFait={async () => ({ ok: true })} onPrix={() => {}} onRelier={() => {}} onFiche={() => {}}
    travail={{ site: 'tous', articles: lignesT, filtres: [], compte: '', majLe: NOW - 18 * 60e3, onRafraichir: () => {} }}
    Logo={(s) => <LogoSite site={s}/>} euros={euros} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((NOW - ms) / J) })} nomSite={(s) => NOM_SITE[s]} Icon={Icon}/>;
}
const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'box'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
function Journee() {
  const pub = P.get('pub') === 'vide' ? { owner: 'u', n: 0, montres: 0, jours: 30, parJour: 10 } : P.get('pub') === 'aucune' ? null : { owner: 'u', n: 14, montres: 10, jours: 30, parJour: 10 };
  const r = rangeeAujourdhui(pub);
  const [actif, setActif] = React.useState('journee');
  return (
    <Coque onglets={ONGLETS} actif={actif} onChoisir={setActif} titre="Aujourd’hui" compte={{ initiales: 'CE', nom: 'Camille Exemple' }}>
      <Aujourdhui titre="Aujourd’hui" Icon={Icon} pret affiche={{ n: 2, pasSu: false, sous: '' }} colis={[]} retraits={{ n: 1, pasSu: false, nPoints: 1, points: [{ lieu: 'Tabac du port', code: '416362' }] }} groupes={null}
        ventes={{ etat: 'lu', lignes: [] }} chiffres={{ etat: 'lu', montant: euros, jours: [], montre: 0, mois: { nom: 'Novembre', vendu: null, recu: null, benefice: null } }}
        aRepublier={r ? { ...r, ouvrir: () => { window.__nav = 'arepublier'; setActif('annonces'); } } : null} onColis={() => {}} onRetraits={() => {}}/>
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(VUE === 'aujourdhui' ? <Journee/> : <Annonces/>);
