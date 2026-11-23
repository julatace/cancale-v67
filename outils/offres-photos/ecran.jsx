// ── outils/offres-photos/ecran.jsx — la page du banc scripts/bancs/offres-photos.cjs (22 nov., choix n° 33 et 35) ──
// Les VRAIS écrans (src/natif/ecrans/Aujourdhui.jsx, Annonces.jsx, OffresSansReponse.jsx, PhotoEnDouble.jsx) nourris par
// les VRAIES règles (src/offresVinted.js, src/offresVestiaire.js, src/offresSansReponse.js, src/photoEnDouble.js et la
// `photoKey` d'App.jsx, extraite par le banc) sur une base INVENTÉE. Hors du paquet de prod.
//   ?vue=journee (défaut) | offres | annonces | annonces-liste     &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { photoKey } from 'vrm-photokey-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frTout from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque, Page } from '../../src/natif/index.js';
import Aujourdhui from '../../src/natif/ecrans/Aujourdhui.jsx';
import VueAnnonces from '../../src/natif/ecrans/Annonces.jsx';
import OffresSansReponseListe from '../../src/natif/ecrans/OffresSansReponse.jsx';
import PhotoEnDouble from '../../src/natif/ecrans/PhotoEnDouble.jsx';
import { NoteAcheteurApp } from '../../src/TraduireLocal.jsx';
import { offreVintedEnAttente } from '../../src/offresVinted.js';
import { offresVestiaire } from '../../src/offresVestiaire.js';
import { offresSansReponse } from '../../src/offresSansReponse.js';
import { photosEnDouble, refuserGroupe } from '../../src/photoEnDouble.js';
import { annoncesVinted } from '../../src/articles/sources.js';
import { construireArticles, filtrerArticles, trierArticles, compterArticles } from '../../src/articles/modele.js';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frTout);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const VUE = P.get('vue') || 'journee';
const H = 3600e3, J = 24 * H, NOW = Date.now();
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);
const Photo = (p) => <img {...p}/>;
// Les photos INVENTÉES : un fichier par « prise de vue », servi sous l'URL du CDN (photoKey lit dossier + fichier).
const svg = (t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><rect width="112" height="112" fill="hsl(${t} 32% 86%)"/><path d="M18 74c10-4 20-16 28-26 6 8 14 12 26 14 12 2 22 6 22 14v4H18z" fill="hsl(${t} 36% 42%)"/></svg>`);
const cdn = (dossier, fichier, taille = 'f800') => `https://images1.vinted.net/t/${dossier}/${taille}/${fichier}.jpeg?s=x`;

// ── Les annonces Vinted EN LIGNE : 50 au MÊME titre (photos différentes) + deux paires au même FICHIER ───────────────
const it = (id, titre, prix, photo) => ({ id: String(id), title: titre, photo: { url: photo }, price: { amount: String(prix) }, size: '42', condition: 'Très bon état', brand: 'Nike', createdTs: NOW - 20 * J, favourites: 2, views: 30, url: 'https://www.vinted.fr/items/' + id });
const enLigne = [
  ...Array.from({ length: 50 }, (_, k) => it(1000 + k, 'Nike Air Max 90 blanc taille 42', 60 + (k % 5), cdn('01_00a' + (k % 3), 'prise' + k))),
  it(2001, 'Nike Dunk Low Panda taille 42', 85, cdn('02_bbb', 'panda1')), it(2002, 'Dunk Low noir et blanc 42', 80, cdn('02_bbb', 'panda1', '310x430')),
  it(2003, 'Adidas Samba OG blanc vert taille 41', 70, cdn('03_ccc', 'samba1')), it(2004, 'Samba OG 41', 72, cdn('03_ccc', 'samba1')),
];
const fiches = { 2001: { numero: '142' }, 2002: { numero: '157' }, 2003: { numero: '160' }, 2004: { numero: '161' }, ...Object.fromEntries(Array.from({ length: 50 }, (_, k) => [String(1000 + k), { numero: String(200 + k) }])) };
const annoncesV = enLigne.map((x) => ({ id: x.id, compte: '11', pseudo: 'shopa', titre: x.title, photo: x.photo.url, prix: Number(x.price.amount), url: x.url }));
const PHOTO_SVG = Object.fromEntries(enLigne.map((x, k) => [x.photo.url, svg(20 + (k * 37) % 300)]));
const vignette = (u) => PHOTO_SVG[u] || u;

// ── Les offres : la règle du fil sur des conversations INVENTÉES ───────────────────────────────────────────────────
const OPP = '900', MOI = '777', sec = (t) => Math.round(t / 1000);
const offre = (tx, oid, prix, ts, o = {}) => ({ entity_type: 'offer_request_message', created_at_ts: sec(ts), entity: { transaction_id: tx, offer_request_id: oid, user_id: OPP, status: 10, price: { amount: String(prix), currency_code: 'EUR' }, ...o } });
const msg = (u, ts) => ({ entity_type: 'message', created_at_ts: sec(ts), entity: { user_id: u, body: 'ok' } });
const convs = [
  { id: '51', item: '2001', titre: 'Nike Dunk Low Panda taille 42', messages: [offre(71, 1, 80, NOW - 2 * H)], note: { review_count: 132, feedback_reputation: 0.98 } },
  { id: '52', item: '2003', titre: 'Adidas Samba OG blanc vert taille 41', messages: [offre(72, 2, 50, NOW - 27 * H)], note: { review_count: 0, feedback_reputation: 0 } },
  { id: '53', item: '1001', titre: 'Nike Air Max 90 blanc taille 42', messages: [offre(73, 3, 55, NOW - 4 * H), msg(MOI, NOW - 3 * H)] },   // il a répondu ⇒ sort
  { id: '54', item: '1002', titre: 'Nike Air Max 90 blanc taille 42', messages: [offre(74, 4, 40, NOW - 80 * H, { status: 20 })] },   // acceptée ⇒ jamais
];
const offresConv = new Map(convs.flatMap((c) => { const o = offreVintedEnAttente({ opposite_user: { id: OPP }, messages: c.messages }); return o ? [[`11_${c.id}`, { ...o, titre: c.titre, item: c.item, side: 'seller', msgs: c.messages, opp: OPP, note: c.note || null }]] : []; }));
const vc = offresVestiaire({ capturedAt: new Date(NOW).toISOString(), offres: { n1: { id: '9001', produit: '55', compte: 'vc1', titre: 'Jordan 1 Mid Chicago taille 44', offre: 9000, initial: 12000, min: 9500, ouverte: true, aToi: true, expire: new Date(NOW + 5 * H).toISOString(), dernier: { action: 'offer', par: 'acheteur', at: new Date(NOW - 50 * H).toISOString() } } } }, NOW);
const prixDe = Object.fromEntries(enLigne.map((x) => [x.id, Number(x.price.amount)]));
const mini = { 2001: 75, 2003: 60 };
const osr = offresSansReponse({ vinted: offresConv, vestiaire: vc, maintenant: NOW,
  ficheDe: (uid, item) => ({ prix: prixDe[item] ?? null, mini: mini[item] ?? null, plancher: null, numero: (fiches[item] || {}).numero || '', photo: (enLigne.find((x) => x.id === item) || { photo: {} }).photo.url || null }) });
const osrVu = { ...osr, lignes: osr.lignes.map((l) => ({ ...l, photo: vignette(l.photo) })) };

function useRefus() {
  const [refus, setRefus] = React.useState({});
  const res = photosEnDouble({ annonces: annoncesV, fiches, clePhoto: photoKey, refus });
  window.__banc = { groupes: res.groupes.map((g) => g.cle), osr: osr.lignes.map((l) => l.cle) };
  return [{ ...res, groupes: res.groupes.map((g) => ({ ...g, annonces: g.annonces.map((a) => ({ ...a, photo: vignette(a.photo) })) })) }, (g) => setRefus((r) => refuserGroupe(r, g.cle))];
}

const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'box'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
const M0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
const jours = Array.from({ length: 7 }, (_, k) => { const d = new Date(M0 - (6 - k) * J); return { cle: d.toISOString().slice(0, 10), lettre: 'L', long: '', court: '', v: [40, 0, 55, 0, 90, 30, 60][k], n: 1, partiel: false, auj: k === 6 }; });
const st = (v, n) => ({ vendu: { valeur: v, partiel: false, note: '' }, ventes: { valeur: n, partiel: false, note: '' }, panier: { valeur: n ? v / n : null, note: '' }, benefice: { valeur: null, brut: true, partiel: false, couverture: '', note: 'prix d’achat manquants' }, ecart: null });

function Ecran() {
  const [actif, setActif] = React.useState(VUE.startsWith('annonces') ? 'annonces' : 'journee');
  const [photoRes, pasDoublon] = useRefus();
  const coque = { onglets: ONGLETS, plus: [], actif, onChoisir: setActif, compte: { initiales: 'CE', nom: 'Camille Exemple' }, messages: { n: 2, libelle: 'Messages', icone: <Icon name="chat" size={24}/>, onOuvrir: () => {} } };
  if (VUE === 'offres') return (
    <Coque {...coque} titre="Messages"><Page titre="Offres">
      <OffresSansReponseListe res={osrVu} euros={euros} Note={NoteAcheteurApp} Icon={Icon} onOuvrir={(l) => document.documentElement.setAttribute('data-banc-panneau', l.site + ':' + (l.site === 'vestiaire' ? l.oid : l.conv))}/>
    </Page></Coque>
  );
  if (VUE.startsWith('annonces')) {
    const M = construireArticles({ annonces: annoncesVinted([{ uid: '11', pseudo: 'shopa', ok: true, lu: NOW - 600e3, enLigne, aConfirmer: [], masquees: [], brouillons: [] }]), fiches, faits: {}, achatsParNum: {}, slots: {}, aVinted: true });
    const [filtre, setFiltre] = React.useState({ site: 'tous', etat: VUE === 'annonces-liste' ? 'enligne' : 'photodouble' });
    const liste = trierArticles(filtrerArticles(M.articles, { site: 'tous', etat: filtre.etat === 'photodouble' ? 'enligne' : filtre.etat }));
    const contenu = <PhotoEnDouble res={photoRes} euros={euros} Icon={Icon} onPasDoublon={pasDoublon} onAnnonce={(a) => document.documentElement.setAttribute('data-banc-fiche', a.numero)}/>;
    return (
      <Coque {...coque} titre="Annonces">
        <VueAnnonces articles={liste} comptes={compterArticles(M.articles, {})} filtre={filtre} onFiltre={setFiltre} sites={['vinted']} recherche="" onRecherche={() => {}} filtreSite={false}
          actions={[]} onAction={() => {}} onFait={async () => ({ ok: true })} photoDouble={{ n: photoRes.groupes.length, contenu }}
          Photo={(src) => <img src={vignette(src)} alt=""/>} euros={euros} depuisTexte={() => '20 j'} nomSite={() => 'Vinted'} Icon={Icon}/>
      </Coque>
    );
  }
  return (
    <Coque {...coque} titre="Aujourd’hui">
      <Aujourdhui titre="Aujourd’hui" Icon={Icon} Photo={Photo} pret affiche={{ n: 0, pasSu: false, sous: '' }} colis={[]} retraits={{ n: 1, pasSu: false, nPoints: 1, points: [{ lieu: 'Relais du Marché', code: '416362' }], premier: { txt: 'dans 3 j', ambre: false } }}
        groupes={null} alerte={null} ventes={{ etat: 'lu', lignes: [] }} aVenir={null} objectif={{ etat: 'aucun', type: 'ca', cible: null, jours: 11, enregistrer: () => true }}
        chiffres={{ etat: 'lu', montant: euros, stats: { jour: st(60, 1), semaine: st(275, 5), mois: st(980, 17) }, moisAvant: 'octobre', jours, montre: 6, mois: { nom: 'Novembre', vendu: { valeur: 980, partiel: false, note: '' }, recu: { valeur: 700, partiel: false, note: '' }, benefice: { valeur: null, partiel: false, note: '' } } }}
        offresSR={osr.etat === 'lu' && osr.n > 0 ? { n: osr.n, age: osr.lignes[0].age, ouvrir: () => document.documentElement.setAttribute('data-banc-vers', 'offres') } : null}
        photoDouble={photoRes.groupes.length ? { n: photoRes.groupes.length, groupes: photoRes.groupes, ouvrir: () => document.documentElement.setAttribute('data-banc-vers', 'photodouble') } : null}
        onColis={() => {}} onRetraits={() => {}} onVentes={() => {}}/>
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
