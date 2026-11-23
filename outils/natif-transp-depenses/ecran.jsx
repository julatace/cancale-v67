// ── outils/natif-transp-depenses/ecran.jsx — Statistiques · Transporteurs (4 sites) et Argent · « + Dépense », SEULS ──
// (21 nov., lot transp-depenses ; hors du paquet de prod). Les VRAIS écrans (src/natif/ecrans/StatsTransporteurs.jsx,
// src/natif/ecrans/DepensesMois.jsx) et les VRAIES règles (src/statsTransporteurs.js : les lignes de chaque site et
// `statsTransporteurs` ; src/depensesRapides.js : la forme et l'écriture), sur des données INVENTÉES (le dépôt est public).
// Jugé par scripts/bancs/transp-depenses.cjs.   ?vue=transp | depenses   &base=lu | partiel | vide   &pret=0   &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque, Page } from '../../src/natif/index.js';
import StatsTransporteurs from '../../src/natif/ecrans/StatsTransporteurs.jsx';
import DepensesMois from '../../src/natif/ecrans/DepensesMois.jsx';
import { ligneVente, ligneVenteLbc, ligneVenteVc, ligneVenteEbay, ligneAchat, ligneAchatVc, suivisPartages, statsTransporteurs, reunirPubTransp, clePubTransp, lignePubliee } from '../../src/statsTransporteurs.js';
import { nouvelleDepense, ecrireDepense, depensesDuMois, jourLocal } from '../../src/depensesRapides.js';
import { fenetre } from '../../src/aujourdhui/pilotage.js';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const VUE = P.get('vue') || 'transp', BASE = P.get('base') || 'lu', PRET = P.get('pret') !== '0';
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 }).format(x);
const JOUR = 86400000, H = 3600000;
const MAINTENANT = Date.now();
const M0 = (() => { const d = new Date(MAINTENANT); d.setHours(0, 0, 0, 0); return d.getTime(); })();
const iso = (t) => new Date(t).toISOString();

// ── LES COLIS INVENTÉS DES QUATRE SITES, dans la forme que chaque site range ─────────────────────────────────────────
const departs = new Map();
const dep = (n, carrier, prise, etat, etatAt, extra = {}) => { departs.set(n, { suivi: n, carrier, priseAt: iso(prise), etat, etatAt: iso(etatAt), ...extra }); };
// Vinted : la ligne déjà rangée (la forme de `ligneVente`), 10 colis Mondial Relay et Vinted Go.
const VINTED = [];
for (let k = 0; k < 10; k++) {
  const venteAt = M0 - (k * 2 + 1) * JOUR + 9 * H, depot = venteAt + (20 + (k % 3) * 8) * H;
  VINTED.push(ligneVente({ tr: k < 6 ? { cle: 'mondialrelay', nom: 'Mondial Relay' } : { cle: 'vinted', nom: 'Vinted Go' }, venteAt,
    depart: { priseAt: iso(depot), etat: 'disponible', etatAt: iso(depot + (40 + k * 3) * H) }, limiteAt: venteAt + 5 * JOUR }));
}
// Leboncoin : 4 transactions (deux au MÊME titre), Mondial Relay et Colissimo par `deliveryMethod`, le n° du bordereau.
const LBC = [0, 1, 2, 3].map((k) => {
  const venteAt = M0 - (k * 3 + 2) * JOUR + 10 * H, n = 'LBCEX' + k;
  if (k < 3) dep(n, 'mondialrelay', venteAt + (30 + k * 6) * H, k === 2 ? 'retire' : 'disponible', venteAt + (80 + k * 6) * H, k === 2 ? { arriveeAt: iso(venteAt + (70 + k * 6) * H) } : {});
  return { txId: 'L' + k, isSeller: true, title: k < 2 ? 'Paire inventée identique' : 'Paire inventée ' + k, dateVente: iso(venteAt), deliveryMethod: k < 3 ? 'mondial_relay' : 'colissimo', label: { reference: n, voucherUrl: 'x' } };
});
// Vestiaire : 3 ventes Colissimo (n° lus), dont une retournée.
const VC = { v1: { date: iso(M0 - 4 * JOUR), suivi: 'VCEX1', transporteur: 'Colissimo', etat: 'delivered' }, v2: { date: iso(M0 - 9 * JOUR), suivi: 'VCEX2', transporteur: 'Colissimo', etat: 'shipped' }, v3: { date: iso(M0 - 12 * JOUR), suivi: 'VCEX3', transporteur: 'Colissimo', etat: 'returned' } };
// eBay : 3 commandes, l'expédition gérée par eBay ; une sans transporteur nommé ; le port payé par l'acheteur n'entre nulle part.
const EBAY = [0, 1, 2].map((k) => ({ orderId: 'E' + k, creationDate: iso(M0 - (k * 4 + 3) * JOUR), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED',
  pricingSummary: { deliveryCost: { value: '7.90', currency: 'EUR' } }, fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO', shippingStep: k < 2 ? { shippingCarrierCode: 'Colissimo' } : {} }] }));
const partages = suivisPartages([...LBC.map((o) => o.label.reference), ...Object.values(VC).map((v) => v.suivi)]);
const PUB = {
  [clePubTransp('ventes', 'vinted')]: VINTED.map(lignePubliee),
  [clePubTransp('ventes', 'leboncoin')]: LBC.map((o) => ligneVenteLbc(o, { departs, partages })).filter(Boolean).map(lignePubliee),
  [clePubTransp('ventes', 'ebay')]: EBAY.map(ligneVenteEbay).filter(Boolean).map(lignePubliee),
  [clePubTransp('ventes', 'vestiaire')]: Object.values(VC).map((v) => ligneVenteVc(v, { departs, partages })).filter(Boolean).map(lignePubliee),
  [clePubTransp('achats', 'vinted')]: [0, 1, 2, 3].map((k) => ligneAchat({ tr: { cle: 'mondialrelay', nom: 'Mondial Relay' }, payeAt: M0 - (k + 2) * JOUR, trajet: { etapes: [{ cle: 'expedie', at: M0 - (k + 1) * JOUR, lue: true }, { cle: 'point', at: M0 - k * JOUR, lue: true }] }, ligne: { etat: 'disponible', etatAt: iso(M0 - k * JOUR), lieuNom: 'Relais inventé', lieuVille: 'Exempleville' } })).map(lignePubliee),
  [clePubTransp('achats', 'vestiaire')]: [ligneAchatVc({ date: iso(M0 - 6 * JOUR), suivi: 'VCA1', transporteur: 'Colissimo', etat: 'delivered' }, {})].map(lignePubliee),
};
if (BASE === 'partiel') { delete PUB[clePubTransp('ventes', 'vestiaire')]; delete PUB[clePubTransp('achats', 'vestiaire')]; }
window.__PUB = PUB;

function Transp() {
  const [site, setSite] = React.useState(P.get('site') || 'toutes');
  const V = reunirPubTransp('ventes', (k) => (BASE === 'vide' ? null : PUB[k] || null)), A = reunirPubTransp('achats', (k) => (BASE === 'vide' ? null : PUB[k] || null));
  const F = fenetre('30', MAINTENANT);
  const T = statsTransporteurs({ ventes: V.L, achats: A.L, de: F.de, a: F.a, site });
  window.__T = T;
  return <Page titre="Statistiques"><StatsTransporteurs T={T} etats={{ ventes: V.L ? 'lu' : 'passu', achats: A.L ? 'lu' : 'passu', pasLus: { ventes: V.pasLus, achats: A.pasLus }, site, setSite }}/></Page>;
}

// ── ARGENT · DÉPENSES : la ligne `vrm_compta` tenue ici (un faux navigateur), écrite par la VRAIE `ecrireDepense` ──────────
const ym = jourLocal(MAINTENANT).slice(0, 7);
let LIGNE = BASE === 'vide' ? null : { depenses: [{ id: 'ex1', date: jourLocal(M0 - (new Date(MAINTENANT).getDate() > 1 ? JOUR : 0)), libelle: 'Cartons inventés', cat: 'Emballage', montant: 8.4 }], fixes: [{ id: 'fx', libelle: 'Local inventé', montant: 20 }], packs: [], abonnements: [] };
// Le total du mois montré par la carte : dans l'app, la règle des charges (`comptaChargesMois`) ; ici sa forme la plus simple
// (coûts fixes + dépenses du mois), pour que le banc vérifie que la carte MONTRE ce qu'on lui passe.
const chargesDu = (c) => (c ? (c.fixes || []).reduce((t, x) => t + x.montant, 0) + depensesDuMois(c, ym).reduce((t, x) => t + x.montant, 0) : 0);
function Depenses() {
  const [c, setC] = React.useState(LIGNE);
  const [n, setN] = React.useState(0);
  window.__COMPTA = c; window.__ECRITURES = n;
  const enregistrer = async ({ id, cat, montant, date, note, photo }) => {
    const f = nouvelleDepense({ id: id || 'b' + Date.now(), cat, montant, date, note, ticket: !!photo });
    if (!f.ok) return f;
    const geste = id ? { type: 'modifier', id, champs: { date: f.d.date, libelle: f.d.libelle, cat: f.d.cat, montant: f.d.montant } } : { type: 'ajouter', d: f.d };
    return ecrireDepense({ pret: () => PRET, lire: () => LIGNE, ecrire: (v) => { LIGNE = v; setC(v); setN((x) => x + 1); } }, geste);
  };
  const retirer = (id) => { LIGNE = { ...LIGNE, depenses: (LIGNE.depenses || []).filter((x) => x.id !== id) }; setC(LIGNE); setN((x) => x + 1); };
  return (
    <Page titre="Argent">
      <DepensesMois etat={PRET ? 'lu' : 'encours'} moisLong={new Date(MAINTENANT).toLocaleDateString('fr-FR', { month: 'long' })} chargesMois={{ total: chargesDu(c) }}
        lignes={depensesDuMois(c, ym)} montant={euros} onEnregistrer={enregistrer} onRetirer={retirer} onPhoto={async () => 'data:image/png;base64,iVBORw0KGgo='}/>
    </Page>
  );
}

const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'box'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
function Ecran() {
  return (
    <Coque onglets={ONGLETS} plus={[]} actif="compta" onChoisir={() => {}} compte={{ initiales: 'CE', nom: 'Camille Exemple' }} titre={VUE === 'transp' ? 'Statistiques' : 'Argent'}>
      {VUE === 'transp' ? <Transp/> : <Depenses/>}
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
