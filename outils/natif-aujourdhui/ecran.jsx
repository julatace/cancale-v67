// ── outils/natif-aujourdhui/ecran.jsx — « Aujourd'hui » et « À régler » SEULS, dans la coque native (hors du paquet de prod) ──
// Le VRAI écran (src/natif/ecrans/Aujourdhui.jsx) et le VRAI bloc (src/designV2/ARegler.jsx), avec des données INVENTÉES
// qui reproduisent la capture de Julien du 19 nov. Construit par esbuild et jugé par scripts/bancs/aujourdhui-natif.cjs.
//   ?base=capture (défaut) | volume | vide | attente     &vue=aujourdhui (défaut) | regler     &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';   // tout le français de l'app (les textes v2.*, journee.*)
import { poserIcone, Coque, Page } from '../../src/natif/index.js';
import Aujourdhui from '../../src/natif/ecrans/Aujourdhui.jsx';
import ARegler from '../../src/designV2/ARegler.jsx';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => {
  const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
};
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const BASE = P.get('base') || 'capture', VUE = P.get('vue') || 'aujourdhui';

const photo = (teinte) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><rect width="112" height="112" fill="hsl(${teinte} 32% 86%)"/><path d="M18 74c10-4 20-16 28-26 6 8 14 12 26 14 12 2 22 6 22 14v4H18z" fill="hsl(${teinte} 36% 42%)"/></svg>`);
const Photo = (p) => <img {...p}/>;
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);
const M0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
const jours = (valeurs, ns) => valeurs.map((v, k) => { const d = new Date(M0 - (6 - k) * 86400000);
  return { cle: d.toISOString().slice(0, 10), lettre: d.toLocaleDateString('fr-FR', { weekday: 'narrow' }).toUpperCase(), long: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    court: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), v, n: ns[k], partiel: false, auj: k === 6 }; });
const NUMS = ['91', '93', '15', 'B309', '19', '14', '92', '1234'];
const colis = (n) => Array.from({ length: n }, (_, k) => ({ cle: 'v:' + k, num: k % 7 === 5 ? '' : NUMS[k % NUMS.length], titre: 'Paire inventée ' + k, photo: k % 4 === 3 ? '' : photo(30 + k * 47), prix: '45 €', e: { txt: k < 2 ? 'demain 10 h' : '25 nov.', ambre: k < 2 } }));
const VENTES = [
  { cle: 'Vinted:1', site: 'Vinted', ts: Date.now() - 2 * 3600000, prix: '58 €', titre: 'Nike Air Max 1 bleu marine taille 44', photo: photo(210), num: '124' },
  { cle: 'Vinted:2', site: 'Vinted', ts: Date.now() - 5 * 3600000, prix: '1 284 €', titre: 'Asics Gel-1130 argent bleu taille 41,5 — très bon état, boîte d’origine, semelles neuves', photo: photo(120), num: 'B309' },
  { cle: 'eBay:3', site: 'eBay', ts: Date.now() - 26 * 3600000, prix: '44 €', titre: '', photo: '', num: '' },
  { cle: 'Leboncoin:4', site: 'Leboncoin', ts: Date.now() - 3 * 86400000, prix: '82,50 €', titre: '', photo: '', num: '' },
  { cle: 'Vinted:5', site: 'Vinted', ts: Date.now() - 4 * 86400000, prix: '36 €', titre: 'Adidas Samba OG blanc vert taille 42', photo: photo(28), num: '13' },
];
// Les chiffres d'une période (la forme de `statsPeriodes`, src/aujourdhui/modele.js).
const st = (v, n, b, { vp = false, bp = '', ecart = null } = {}) => ({ vendu: { valeur: v, partiel: vp, note: v == null ? 'pas lu' : '' }, ventes: { valeur: n, partiel: false, note: n == null ? 'pas lu' : '' },
  panier: v != null && n > 0 && !vp ? { valeur: Math.round((v / n) * 100) / 100, note: '' } : { valeur: null, note: n === 0 ? 'aucune' : 'partiel' },
  benefice: { valeur: b, brut: true, partiel: !!bp, couverture: bp, note: b == null ? 'prix d’achat manquants' : '' }, ecart });
const CAS = {
  capture: { pret: true, affiche: { n: 8, pasSu: false, sous: '3 pas encore prêts', ambre: true }, colis: colis(8), plein: { n: 5 },
    retraits: { n: 15, pasSu: false, nPoints: 6, points: [{ lieu: 'Relais Pickup Tabac-Presse du Marché Couvert de la Gare Centrale', code: '416362' }], premier: { txt: 'dernier jour', ambre: true } },
    alerte: { id: 'poster', txt: '2 pressés · 1 j de retard', faire: () => {} }, ventes: { etat: 'lu', lignes: VENTES }, aVenir: null,
    chiffres: { etat: 'lu', stats: { jour: st(102, 2, 38, { ecart: 85 }), semaine: st(497, 10, 141, { bp: '8/10', ecart: -12 }), mois: st(968, 21, 187, { vp: true, bp: '12/30' }) }, moisAvant: 'octobre', jours: jours([69, 0, 47, 94, 246, 55, 102], [2, 0, 1, 2, 5, 1, 2]), montre: 6, mois: { nom: 'Novembre', vendu: { valeur: 968, partiel: true, note: '' }, recu: { valeur: 372, partiel: false, note: '' }, benefice: { valeur: 187, partiel: false, couverture: { k: 12, n: 30 }, libelle: 'Bénéfice brut' } } } },
  volume: { pret: true, affiche: { n: 30, pasSu: false, sous: '15 pas encore prêts' }, colis: colis(12), plein: { n: 15 },
    retraits: { n: 8, pasSu: false, nPoints: 8, points: [{ lieu: 'Relais 0', code: '100000' }], premier: { txt: 'dans 3 j', ambre: false } }, alerte: null, ventes: { etat: 'lu', lignes: VENTES }, aVenir: null,
    chiffres: { etat: 'lu', stats: { jour: st(0, 0, 0), semaine: st(7050, 56, 2380.5, { ecart: 4 }), mois: st(22740, 182, null) }, moisAvant: 'octobre', jours: jours([1380, 1270, 1160, 1410, 1080, 750, 0], [12, 11, 9, 13, 8, 3, 0]), montre: 5, mois: { nom: 'Novembre', vendu: { valeur: 22740, partiel: false, note: '' }, recu: { valeur: 15960, partiel: true, note: '' }, benefice: { valeur: null, partiel: false, note: 'prix d’achat manquants' } } } },
  vide: { pret: true, affiche: { n: 0, pasSu: false, sous: '' }, colis: [], plein: null, retraits: { n: 0, pasSu: false, points: [] }, alerte: null, ventes: { etat: 'lu', lignes: [] }, aVenir: null,
    chiffres: { etat: 'lu', stats: { jour: st(0, 0, null), semaine: st(0, 0, null), mois: st(0, 0, null) }, moisAvant: 'octobre', jours: jours([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]), montre: 6, mois: { nom: 'Novembre', vendu: { valeur: 0, partiel: false, note: '' }, recu: { valeur: null, partiel: false, note: 'ouvre Ventes' }, benefice: { valeur: null, partiel: false, note: 'rien à compter' } } } },
  attente: { pret: false, affiche: { n: null, pasSu: true, sous: '' }, colis: [], plein: null, retraits: null, alerte: null, ventes: { etat: 'encours', lignes: [] }, aVenir: null,
    chiffres: { etat: 'encours', jours: jours([null, null, null, null, null, null, null], [null, null, null, null, null, null, null]), montre: 6, mois: { nom: 'Novembre', vendu: null, recu: null, benefice: null } } },
};
const GROUPES = [
  { id: 'colis-limite', onglet: 'ventes', icone: 'truck', titre: '2 colis pressés', detail: '1 j de retard', n: 2, ambre: true, photo: photo(210), geste: { txt: 'Voir', faire: () => {} } },
  { id: 'litige', onglet: 'ventes', icone: 'alert', titre: 'Litige · N°124 · nike air max 1 athletic department bleu taille 44', detail: 'délai non lu · compte vendeur_1', n: 1, ambre: false, photo: photo(120), geste: { txt: 'Voir', faire: () => {} } },
  { id: 'retours-vente', onglet: 'ventes', icone: 'restore', titre: '2 retours en route vers toi', detail: 'N°13 salomon XT-6 gris taille 44,5 · N°B309 Asics gel résolution 9', n: 2, ambre: false, photo: null, geste: { txt: 'Voir', faire: () => {} } },
  { id: 'double-vente', onglet: 'ventes', icone: 'alert', titre: '1 paire vendue encore en ligne ailleurs', detail: '', n: 1, ambre: false, photo: null, geste: { txt: 'Voir', faire: () => {} } },
  { id: 'achats-a-numeroter', onglet: 'achats', icone: 'box', titre: '5 achats arrivés à numéroter', detail: 'Son N°, puis sa case, ses photos, son prix et sa fiche.', n: 5, ambre: false, photo: null, geste: { txt: 'Commencer', faire: () => {} } },
];
const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant', 0], ['annonces', 'Annonces', 'tag', 13], ['ventes', 'Ventes', 'bag', 8], ['achats', 'Achats', 'box', 15], ['compta', 'Argent', 'euro', 0]]
  .map(([cle, libelle, ic, n]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/>, pastille: n || undefined, libellePastille: n ? n + ' à faire' : undefined }));
const PLUS = [{ entrees: [{ cle: 'stock', libelle: 'Stock', icone: <Icon name="box" size={22}/> }, { cle: 'messages', libelle: 'Messages', icone: <Icon name="chat" size={22}/>, pastille: 19, libellePastille: '19 messages à lire' }] }];

function Ecran() {
  const [actif, setActif] = React.useState(VUE === 'regler' ? 'ventes' : 'journee');
  const c = CAS[BASE] || CAS.capture;
  const coque = { onglets: ONGLETS, plus: PLUS, actif, onChoisir: setActif, compte: { initiales: 'CE', nom: 'Camille Exemple' }, messages: { n: 19, libelle: 'Messages', icone: <Icon name="chat" size={24}/>, onOuvrir: () => {} } };
  if (VUE === 'regler') return (
    <Coque {...coque} titre="Ventes">
      <Page titre="Ventes">
        <ARegler onglet="ventes" Icon={Icon} Photo={Photo} groupes={GROUPES}/>
        <ARegler onglet="achats" Icon={Icon} Photo={Photo} groupes={GROUPES}/>
      </Page>
    </Coque>
  );
  return (
    <Coque {...coque} titre="Aujourd’hui">
      <Aujourdhui titre="Aujourd’hui" Icon={Icon} Photo={Photo} pret={c.pret} affiche={c.affiche} colis={c.colis} retraits={c.retraits} groupes={null} alerte={c.alerte} ventes={c.ventes} aVenir={c.aVenir}
        plein={c.plein ? { n: c.plein.n, faire: () => { document.documentElement.setAttribute('data-banc-imprime', String(c.plein.n)); } } : null}
        chiffres={{ ...c.chiffres, montant: euros, ouvrirPeriode: (p) => { document.documentElement.setAttribute('data-banc-argent', p); setActif('compta'); } }} onScanner={() => {}} onColis={() => setActif('ventes')} onRetraits={() => setActif('achats')} onVentes={() => setActif('ventes')}/>
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
