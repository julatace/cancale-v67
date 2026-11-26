// ── outils/natif-gains/ecran.jsx — Statistiques › Gains, SEUL (hors du paquet de prod ; 24 nov., lot gains-reels) ──
// Le VRAI écran (src/natif/ecrans/StatsPilotage.jsx › StatsGains) et la VRAIE chaîne (src/ceQuiRapporte.js `releveVentes`
// → src/aujourdhui/lectures.js `lignesReleve` → src/gainsReels.js `gainsReels`) sur des données INVENTÉES (dépôt public :
// aucune vraie paire, aucun vrai pseudo). Jugé par scripts/bancs/gains-reels.cjs.
//   ?base=lu | attente | passu   &theme=dark   &vue=paire|modele|source|compte
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque, Page } from '../../src/natif/index.js';
import StatsPilotage from '../../src/natif/ecrans/StatsPilotage.jsx';
import { releveVentes } from '../../src/ceQuiRapporte.js';
import { lignesReleve } from '../../src/aujourdhui/lectures.js';
import { gainsReels } from '../../src/gainsReels.js';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
try { if (P.get('vue')) localStorage.setItem('vrm_stats_gains_vue', P.get('vue')); } catch (_) {}
const BASE = P.get('base') || 'lu';
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);
const J = 86400000, MAINTENANT = Date.now();

// LES VENTES INVENTÉES (forme des commandes Vinted lues) : 4 modèles, 2 comptes + 1 compte ÉCARTÉ, prix d'achat manquants,
// frais notés, une vente à perte, une vente en GBP, une non finalisée.
const TITRES = [['Nike', 'Nike Dunk Low panda'], ['Adidas', 'Adidas Samba OG blanche'], ['New Balance', 'New Balance 550 blanche'], ['Asics', 'Asics Gel Kayano 14 argent'], ['', 'Lot de chaussures inventé']];
const ventes = [], items = {}, txn = {};
let i = 0;
const ajoute = (compte, m, prix, achat, frais, jours, devise = 'EUR', statut = 'completed') => {
  i += 1; const tx = String(7000 + i), it = 'it' + i, ts = MAINTENANT - (i % 25) * J - 3600000;
  items[it] = { id: it, brand: TITRES[m][0], size: '42', title: TITRES[m][1], enLigne: ts - jours * J }; txn[tx] = { item: it };
  ventes.push({ transaction_id: tx, date: new Date(ts).toISOString(), status: statut, title: TITRES[m][1], price: { amount: String(prix), currency_code: devise }, _c: compte, _a: achat, _f: frais, _n: String(200 + i) });
};
for (let k = 0; k < 7; k++) ajoute('vendeur_exemple', 0, 110 + k * 6, 55, k % 3 ? 0 : 3.5, 3 + k);
for (let k = 0; k < 6; k++) ajoute('second_exemple', 1, 72, k === 0 ? null : k === 1 ? 96 : 38, 0, 18 + k * 3);
for (let k = 0; k < 2; k++) ajoute('vendeur_exemple', 2, 95, 35, 0, 2);
for (let k = 0; k < 4; k++) ajoute('second_exemple', 3, 105, null, 0, 14);
for (let k = 0; k < 3; k++) ajoute('vendeur_exemple', 4, 30 + k * 4, 12, 0, 35);
for (let k = 0; k < 4; k++) ajoute('compte_ecarte', 0, 400, 10, 0, 1);
ajoute('vendeur_exemple', 0, 140, 55, 0, 4, 'GBP');
ajoute('vendeur_exemple', 0, 140, 55, 0, 4, 'EUR', 'pending');
const rows = releveVentes({ vinted: ventes, estMasquee: (o) => o._c === 'compte_ecarte', estFinalisee: (o) => o.status === 'completed', an0: 2025,
  montant: (o) => (o.price.currency_code !== 'EUR' ? null : Number(o.price.amount)), achat: (o) => o._a, frais: (o) => o._f, compte: (o) => o._c, numero: (o) => o._n });
const lignes = lignesReleve(rows, { items, txn, dates: null }, (it) => it.enLigne);
const BILAN = { at: MAINTENANT, sansAchat: 4, achatPasLu: 0, vintedLus: true, sources: [
  { cle: 'vinted', libelle: 'Vinted', genre: 'vinted', articles: 22, revendus: 14, nBenef: 11, beneficeMoyen: 2600, delaiMoyen: 11, nDelai: 11, partiel: false },
  { cle: 'f:brocante', libelle: 'Brocante inventée', genre: 'hors', articles: 7, revendus: 5, nBenef: 5, beneficeMoyen: 4100, delaiMoyen: 27, nDelai: 5, partiel: false },
  { cle: 'f:lbc', libelle: 'Leboncoin', genre: 'hors', articles: 3, revendus: 2, nBenef: 2, beneficeMoyen: 8800, delaiMoyen: 3, nDelai: 2, partiel: false },
  { cle: 'f:magasin', libelle: 'Magasin inventé', genre: 'hors', articles: 5, revendus: 4, nBenef: 4, beneficeMoyen: -900, delaiMoyen: 40, nDelai: 4, partiel: false },
  { cle: 'non-saisie', libelle: 'Source pas saisie', genre: '', articles: 6, revendus: 3, nBenef: 0, beneficeMoyen: null, delaiMoyen: null, nDelai: 0 },
] };
const G = BASE === 'attente' ? undefined : BASE === 'passu' ? null : gainsReels({ lignes, bilan: BILAN, horsEuro: 1 });
window.__G = G; window.__LIGNES = lignes; window.__VENTES = ventes;
const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['ventes', 'Ventes', 'bag'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
function Ecran() {
  const [seg, setSeg] = React.useState('gains');
  const [f, setF] = React.useState('30');
  return (
    <Coque onglets={ONGLETS} plus={[]} actif="compta" onChoisir={() => {}} compte={{ initiales: 'CE', nom: 'Camille Exemple' }} titre="Statistiques">
      <Page titre="Statistiques">
        <StatsPilotage M={null} etats={{ ventes: 'lu', journal: 'lu', releve: 'lu' }} montant={euros} Icon={Icon} seg={seg} setSeg={setSeg} f={f} setF={setF} gains={G}/>
      </Page>
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
