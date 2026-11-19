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
import { useCartes } from '../../src/aujourdhui/cartes.js';
import { CARTES_AUJOURDHUI } from '../../src/aujourdhui/modele.js';

// Le choix des cartes, comme dans l'app (src/aujourdhui/cartes.js), rangé dans le stockage de la page : deux onglets
// du banc = deux appareils (l'autre onglet reçoit l'événement `storage`). `&cartes=toutes` sème toutes les cartes.
const CLE_CARTES = 'vrm_aujourdhui_cartes';
const OUTILS_H = { cle: CLE_CARTES, load: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } },
  save: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, onCloudReady: (f) => { f(); return () => {}; } };
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
// (19 nov.) Les cartes en plus : 30 jours de vendu, la table par compte, ce que l'extension a capté, ce que VRM a fait.
const C30 = Array.from({ length: 30 }, (_, k) => { const d = new Date(M0 - (29 - k) * 86400000); const v = [0, 45, 120, 0, 58, 247, 90, 36, 0, 180][k % 10] + (k === 29 ? 57 : 0);
  return { cle: d.toISOString().slice(0, 10), de: d.getTime(), a: d.getTime() + 86400000, v, n: v ? Math.max(1, Math.round(v / 50)) : 0, partiel: false, auj: k === 29 }; });
const TABLE = (f) => [{ cle: 'vinted|vendeur_1', nom: 'vendeur_1', site: 'Vinted', v: 612 * f, vp: true, n: 13 * f }, { cle: 'vinted|julien.sneakers', nom: 'julien.sneakers', site: 'Vinted', v: 268 * f, vp: false, n: 6 * f },
  { cle: 'ebay', nom: 'eBay', site: 'eBay', v: 1284 * f, vp: false, n: 1 * f }, { cle: 'leboncoin', nom: 'Leboncoin', site: 'Leboncoin', v: 82.5 * f, vp: false, n: 1 * f }];
const STATS2 = { stock: { enLigne: 142, raisonEnLigne: '', achat: 4380, achatPartiel: true, achatN: 142, achatNPrix: 118, raisonAchat: '' },
  parPeriode: { jour: { n: 2, vitesse: { mediane: 6, nDelai: 2, n: 2 }, marge: { pct: 41.2, brut: 38, nCout: 2, n: 2 }, marques: { top: [{ k: 'Nike', n: 1, ca: 58 }, { k: 'Asics', n: 1, ca: 44 }], sansMarque: 0 } },
    semaine: { n: 10, vitesse: { mediane: 9, nDelai: 8, n: 10 }, marge: { pct: 38.5, brut: 141, nCout: 8, n: 10 }, marques: { top: [{ k: 'Nike', n: 4, ca: 236 }, { k: 'Adidas', n: 3, ca: 152 }, { k: 'Asics', n: 2, ca: 88 }], sansMarque: 1 } },
    mois: { n: 30, vitesse: { mediane: 11.5, nDelai: 24, n: 30 }, marge: { pct: 36.9, brut: 187, nCout: 12, n: 30 }, marques: { top: [{ k: 'Nike', n: 12, ca: 512 }, { k: 'Adidas', n: 8, ca: 301 }, { k: 'Asics', n: 4, ca: 1462 }, { k: 'New Balance', n: 3, ca: 141 }, { k: 'Salomon', n: 2, ca: 134 }], sansMarque: 2 } } },
  ecoulement: { pct: 18, ventes: 26, enLigne: 142 }, prevision: { etat: 'ok', centre: 310000, bas: 260000, haut: 360000, cumul: 196800, jours: 18, joursMois: 30, partiel: false },
  dorment: { valeur: 37, partiel: false, raison: '' }, avenir: { valeur: 952, partiel: false, raison: '' } };
const PLUS = { stats2: STATS2, courbe: { jours: C30 }, comptes: { jour: TABLE(1).slice(0, 2), semaine: TABLE(1), mois: TABLE(3) }, capte: { favoris: null, offres: 4, messages: 7, ventes: 2 },
  vrm: [{ cle: 'baisses', n: 3 }, { cle: 'favoris', n: 12 }, { cle: 'offres', n: 1 }], objectif: { etat: 'lu', type: 'ca', cible: 3000, valeur: 1840, pct: 61, partiel: false, atteint: false, jours: 11, enregistrer: () => true, retirer: () => {} } };
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
const PLUS_MENU = [{ entrees: [{ cle: 'stock', libelle: 'Stock', icone: <Icon name="box" size={22}/> }, { cle: 'messages', libelle: 'Messages', icone: <Icon name="chat" size={22}/>, pastille: 19, libellePastille: '19 messages à lire' }] }];

function Ecran() {
  // `&cartes=toutes` : toutes les cartes montrées (la capture de chaque carte) ; sinon le réglage par défaut.
  if (P.get('cartes') === 'toutes' && !localStorage.getItem(CLE_CARTES)) OUTILS_H.save(CLE_CARTES, { ordre: [...CARTES_AUJOURDHUI], montrees: [...CARTES_AUJOURDHUI], rev: 1, at: 1 });
  const cartesH = useCartes(OUTILS_H);
  const [actif, setActif] = React.useState(VUE === 'regler' ? 'ventes' : 'journee');
  const c = CAS[BASE] || CAS.capture;
  const coque = { onglets: ONGLETS, plus: PLUS_MENU, actif, onChoisir: setActif, compte: { initiales: 'CE', nom: 'Camille Exemple' }, messages: { n: 19, libelle: 'Messages', icone: <Icon name="chat" size={24}/>, onOuvrir: () => {} } };
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
      <Aujourdhui {...(BASE === 'capture' || BASE === 'volume' ? PLUS : BASE === 'attente' ? { objectif: { ...PLUS.objectif, etat: 'encours', valeur: null, pct: null } } : { objectif: { etat: 'aucun', type: 'ca', cible: null, jours: 11, enregistrer: () => true } })} cartes={cartesH} titre="Aujourd’hui" Icon={Icon} Photo={Photo} pret={c.pret} affiche={c.affiche} colis={c.colis} retraits={c.retraits} groupes={null} alerte={c.alerte} ventes={c.ventes} aVenir={c.aVenir}
        plein={c.plein ? { n: c.plein.n, faire: () => { document.documentElement.setAttribute('data-banc-imprime', String(c.plein.n)); } } : null}
        chiffres={{ ...c.chiffres, montant: euros, ouvrirPeriode: (p) => { document.documentElement.setAttribute('data-banc-argent', p); setActif('compta'); } }} onScanner={() => {}} onColis={() => setActif('ventes')} onRetraits={() => setActif('achats')} onVentes={() => setActif('ventes')}/>
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
