// ── outils/natif-journee-stats/ecran.jsx — Ma journée (courte) et Statistiques (Pilotage · Finances), SEULES (hors du paquet de prod) ──
// Les VRAIS écrans (src/natif/ecrans/Aujourdhui.jsx, src/natif/ecrans/StatsPilotage.jsx) et les VRAIES règles
// (src/aujourdhui/modele.js `statsPeriodes`, src/aujourdhui/pilotage.js `statsFenetre`), sur des données INVENTÉES (aucune
// donnée réelle : le dépôt est public). Le faux propriétaire des chiffres a la FORME de `valeurChiffre`. Jugé par
// scripts/bancs/journee-stats.cjs.   ?vue=journee | stats    &base=lu | attente | vide    &theme=dark    &seg=finances    &f=7|30|90
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque, Page } from '../../src/natif/index.js';
import Aujourdhui from '../../src/natif/ecrans/Aujourdhui.jsx';
import StatsPilotage from '../../src/natif/ecrans/StatsPilotage.jsx';
import { statsPeriodes } from '../../src/aujourdhui/modele.js';
import { statsFenetre } from '../../src/aujourdhui/pilotage.js';
import { delaisPar, margesPar } from '../../src/statsVentes.js';
import { ligneVente, ligneAchat, statsTransporteurs } from '../../src/statsTransporteurs.js';
import { fenetre } from '../../src/aujourdhui/pilotage.js';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const VUE = P.get('vue') || 'journee', BASE = P.get('base') || 'lu';
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);
const JOUR = 86400000;
const MAINTENANT = Date.now();
const M0 = (() => { const d = new Date(MAINTENANT); d.setHours(0, 0, 0, 0); return d.getTime(); })();

// LES VENTES INVENTÉES : 120 jours, un rythme régulier (aucune vraie paire, aucun vrai pseudo).
const MARQUES = ['Nike', 'Adidas', 'Asics', 'New Balance', 'Salomon'], TAILLES = ['42', '43', '44', '41', '45'], COMPTES = ['vendeur_exemple', 'second_exemple'];
const LIGNES = [];
for (let k = 0; k < 120; k++) {
  const n = [2, 1, 0, 1, 3, 0, 2][k % 7];
  for (let i = 0; i < n; i++) {
    const ts = M0 - k * JOUR + (k === 0 ? (i + 1) * 60000 : (10 + i) * 3600000);
    if (ts > MAINTENANT) continue;
    const site = (k + i) % 9 === 0 ? 'eBay' : (k + i) % 11 === 0 ? 'Leboncoin' : 'Vinted';
    LIGNES.push({ plateforme: site, tx: 'tx' + k + '_' + i, ts, eur: 35 + ((k * 7 + i * 13) % 60), compte: site === 'Vinted' ? COMPTES[(k + i) % 2] : '', item: 'it' + k + '_' + i,
      marque: MARQUES[(k + i) % 5], taille: TAILLES[(k * 3 + i) % 5], achat: (k + i) % 4 === 0 ? null : 18 + ((k + i) % 20) });
  }
}
window.__LIGNES = LIGNES; window.__MAINTENANT = MAINTENANT;
// LE JOURNAL INVENTÉ (la forme de la route : l'heure en millisecondes).
const TYPES = ['favori', 'favori', 'favori_offre', 'baisse_prix', 'bordereau', 'republication'];
const JOURNAL = [];
for (let k = 0; k < 40; k++) for (let i = 0; i < (k % 5 === 4 ? 0 : 1 + (k % 3)); i++) {
  const t = M0 - k * JOUR + (k === 0 ? 2 * 60000 + i * 1000 : (8 + i) * 3600000); if (t > MAINTENANT) continue;
  JOURNAL.push({ type: TYPES[(k + i) % TYPES.length], resultat: (k + i) % 13 === 0 ? 'refuse' : 'ok', at: t, auto: (k + i) % 2 === 0, cle: { item: 'it' + Math.max(0, k - 2) + '_0' } });   // l'annonce vendue deux jours APRÈS le message (identité)
}
window.__JOURNAL = JOURNAL;
// (21 nov., ext. 5.420) LES RÉPONSES AUX FAVORIS INVENTÉES (la forme de la ligne `favoris_reponses_{uid}_{nav}` : des scalaires
// par envoi) — un message sur l'annonce de certaines ventes inventées, 2 jours avant ; un sur trois répond, un sur cinq relu sans réponse.
const REP_FAV = [{ id: 'favoris_reponses_111_navbanc', e: LIGNES.filter((l, k) => l.plateforme === 'Vinted' && k % 3 === 0).slice(0, 30).map((l, k) => ({ t: l.ts - 2 * JOUR, k: k % 2 ? 'u2' : 'u1', i: l.item, ...(k % 3 === 0 ? { r: l.ts - JOUR, l: l.ts - JOUR } : k % 5 === 0 ? { l: l.ts - JOUR } : {}), ...(k % 4 === 0 ? { oa: 1 } : {}), ...(k % 6 === 1 ? { au: 1 } : {}) })) }];
window.__REP_FAV = REP_FAV;
// LE FAUX PROPRIÉTAIRE (la forme de `valeurChiffre`) : vendu · ventes par bornes et sélection ; brut et net d'un tableau fixe.
const bornes = (p) => (p && typeof p === 'object' ? p : p === 'jour' ? { de: M0, a: M0 + JOUR } : p === 'mois' ? { de: new Date(new Date(M0).setDate(1)).getTime(), a: new Date(new Date(M0).getFullYear(), new Date(M0).getMonth() + 1, 1).getTime() }
  : { de: M0 - 6 * JOUR, a: M0 + JOUR });
const valeur = (id, p, sel) => {
  if (BASE === 'attente') return { valeur: null, raison: 'encours' };
  const B = bornes(p);
  const L = (BASE === 'vide' ? [] : LIGNES).filter((x) => x.ts >= B.de && x.ts < B.a && (!sel || !sel.site || sel.site === 'toutes' || x.plateforme.toLowerCase() === sel.site) && (!sel || !sel.compte || x.compte === sel.compte.login));
  if (id === 'vendu') return { valeur: Math.round(L.reduce((t, x) => t + x.eur * 100, 0)) / 100, partiel: false, manque: [] };
  if (id === 'ventes') return { valeur: L.length, partiel: false };
  if (id === 'brut') { const c = L.filter((x) => x.achat != null); return c.length ? { valeur: Math.round(c.reduce((t, x) => t + (x.eur - x.achat) * 100, 0)) / 100, partiel: c.length < L.length, couverture: c.length < L.length ? `${c.length} sur ${L.length}` : '', n: L.length } : (L.length ? { valeur: null, raison: 'achats' } : { valeur: 0, n: 0 }); }
  if (id === 'benefice') { const c = L.filter((x) => x.achat != null); if (!L.length) return { valeur: null, raison: 'rien' }; if (c.length < L.length) return { valeur: null, raison: 'achats', B: { chargesAuMois: p === 'jour' } };
    return { valeur: Math.round(c.reduce((t, x) => t + (x.eur - x.achat) * 0.876 * 100, 0)) / 100, B: { chargesAuMois: p === 'jour' } }; }
  if (id === 'enligne') return { valeur: 142 };
  if (id === 'dorment') return { valeur: 37 };
  return { valeur: null, raison: 'inconnu' };
};
const raisonCourte = (x) => (x && x.valeur == null ? ({ encours: 'lecture…', pasSu: 'pas lu', achats: 'prix d’achat manquants', rien: 'rien à compter' }[x.raison] || 'pas lu') : '');
const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'box'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));

function Journee() {
  const lu = BASE !== 'attente';
  const stats = lu ? statsPeriodes({ valeur, raisonCourte }) : null;
  window.__STATS = stats;
  const nE = BASE === 'vide' ? 0 : 6, nR = BASE === 'vide' ? 0 : 3;
  const ventes = lu ? LIGNES.slice(0, 5).map((l) => ({ cle: l.plateforme + ':' + l.tx, site: l.plateforme, ts: l.ts, prix: euros(l.eur), titre: 'Paire inventée ' + l.marque + ' ' + l.taille, photo: '', num: '' })) : [];
  return (
    <Aujourdhui titre="Aujourd’hui" Icon={Icon} Photo={(p) => <img {...p}/>} pret={lu} affiche={lu ? { n: nE, pasSu: false, sous: nE ? '2 pas encore prêts' : '' } : { n: null, pasSu: true, sous: '' }}
      colis={[]} retraits={lu ? { n: nR, pasSu: false, nPoints: nR ? 2 : 0, points: nR ? [{ lieu: 'Relais inventé de la Gare', code: '416362' }] : [], premier: nR ? { txt: 'dernier jour', ambre: true } : null } : null}
      groupes={null} alerte={null} ventes={{ etat: lu ? 'lu' : 'encours', lignes: ventes }} plein={lu && nE ? { n: 4, faire: () => document.documentElement.setAttribute('data-banc-imprime', '4') } : null}
      chiffres={{ etat: lu ? 'lu' : 'encours', stats, moisAvant: 'octobre', mois: { nom: 'Novembre' }, montant: euros, ouvrirPeriode: () => {} }}
      onNav={(t) => document.documentElement.setAttribute('data-banc-nav', t)} onColis={() => {}} onRetraits={() => {}} onVentes={() => {}}/>
  );
}
// LES COLIS INVENTÉS PAR TRANSPORTEUR (la forme que l'app range : le transporteur LU, la ligne `depart_` / `transp_` de CE n°).
// Exprès : des dates manquantes (pas de prise en charge, pas d'arrivée lue), un transporteur inconnu, un « Autre », un
// transporteur à 2 colis seulement (« — »), un colis bloqué 12 jours (les écarts forts ⇒ médiane).
const CARR = [['mondialrelay', 'Mondial Relay'], ['vinted', 'Vinted Go'], ['chronopost', 'Chronopost'], ['colissimo', 'Colissimo'], ['relaiscolis', 'Relais Colis']];
const H = 3600000;
const VENTES_T = [], ACHATS_T = [];
for (let k = 0; k < 40; k++) {
  const c = k < 16 ? CARR[0] : k < 28 ? CARR[1] : k < 35 ? CARR[2] : k < 37 ? CARR[3] : null;
  const venteAt = M0 - (k % 30) * JOUR + 9 * H;
  const sansDepot = k % 7 === 3, sansLivraison = k % 5 === 1;
  const depot = sansDepot ? null : venteAt + (20 + (k % 4) * 10) * H + (k === 5 ? 12 * JOUR : 0);
  const livre = depot && !sansLivraison ? depot + (40 + (k % 3) * 12) * H : null;
  VENTES_T.push(ligneVente({ tr: c ? { cle: c[0], nom: c[1] } : (k === 39 ? { cle: null, nom: 'Coursier du coin' } : null), venteAt,
    depart: depot ? { priseAt: new Date(depot).toISOString(), etat: livre ? 'disponible' : (k === 20 ? 'incident' : 'en_route'), etatAt: livre ? new Date(livre).toISOString() : null } : null,
    limiteAt: k % 4 === 0 ? null : venteAt + 3 * JOUR, status: k === 8 ? 'Retour en cours' : k === 9 ? 'Transaction suspendue' : 'Commande en cours' }));
}
for (let k = 0; k < 30; k++) {
  const c = k < 14 ? CARR[0] : k < 24 ? CARR[1] : k < 28 ? CARR[4] : null;
  const payeAt = M0 - (k % 28) * JOUR + 8 * H;
  const exp = k % 6 === 2 ? null : payeAt + (24 + (k % 3) * 20) * H;
  const point = exp ? exp + (30 + (k % 4) * 8) * H : (k % 3 === 0 ? payeAt + 4 * JOUR : null);
  const retire = point && k % 4 !== 1 ? point + (10 + (k % 5) * 14) * H : null;
  const etapes = [['paye', payeAt], ['expedie', exp], ['transit', null], ['point', point], ['retire', retire]].map(([cle, at]) => ({ cle, at, lue: at != null }));
  ACHATS_T.push(ligneAchat({ tr: c ? { cle: c[0], nom: c[1] } : null, payeAt, trajet: { etapes },
    ligne: { etat: k === 7 ? 'retour_expediteur' : retire ? 'retire' : 'disponible', etatAt: null, lieuNom: k % 3 ? 'Relais inventé des Lilas' : 'Tabac inventé du Port', lieuVille: 'Exempleville' }, status: '' }));
}
window.__VT = VENTES_T; window.__AT = ACHATS_T;
function Stats() {
  const [seg, setSeg] = React.useState(P.get('seg') || 'pilotage');
  const [f, setF] = React.useState(P.get('f') || '30');
  const lu = BASE !== 'attente';
  const releve = LIGNES.map((l) => ({ plateforme: l.plateforme, compte: l.compte, id: l.tx, ts: l.ts, eur: l.eur, achat: l.achat, frais: 0, titre: '', marqueLue: l.marque, modele: l.marque === 'Nike' ? 'Nike Air Max' : l.marque === 'Adidas' ? 'Adidas Samba' : null, taille: l.taille, enLigne: l.ts - (5 + (l.eur % 20)) * JOUR }));
  const item = Object.fromEntries(LIGNES.map((l) => [l.tx, l.item]));
  const M = lu ? statsFenetre({ cle: f, valeur: (id, p, sel) => valeur(id, p, sel), evenements: BASE === 'vide' ? [] : JOURNAL, lignes: BASE === 'vide' ? [] : LIGNES, itemDeTx: (tx) => item[tx] || null,
    releve: BASE === 'vide' ? [] : releve, regles: { delaisPar, margesPar }, raisonCourte, enLigne: { valeur: 142 }, dorment: { valeur: 37, partiel: false, raison: '' }, maintenant: MAINTENANT,
    reponsesFavoris: BASE === 'vide' ? [] : REP_FAV, txn: Object.fromEntries(LIGNES.map((l) => [l.tx, { item: l.item }])), items: {} }) : null;
  window.__M = M;
  const FT = fenetre(f, MAINTENANT);
  const T = lu && BASE !== 'vide' ? statsTransporteurs({ ventes: VENTES_T, achats: ACHATS_T, de: FT.de, a: FT.a }) : (BASE === 'vide' ? statsTransporteurs({ ventes: [], achats: [], de: FT.de, a: FT.a }) : null);
  window.__T = T;
  const etats = lu ? { ventes: 'lu', journal: 'lu', releve: 'lu' } : { ventes: 'encours', journal: 'encours', releve: 'encours' };
  return (
    <Page titre="Statistiques">
      <StatsPilotage M={M} etats={etats} montant={euros} Icon={Icon} seg={seg} setSeg={setSeg} f={f} setF={setF} onNav={() => {}} onJournal={() => {}} onDorment={() => {}} automatisations={{ n: 1, sur: 3 }} onAutomatisations={() => {}}
        transporteurs={T} etatsTransp={lu ? { ventes: 'lu', achats: 'lu' } : { ventes: 'encours', achats: 'encours' }}/>
    </Page>
  );
}
function Ecran() {
  const [actif, setActif] = React.useState(VUE === 'stats' ? 'compta' : 'journee');
  return (
    <Coque onglets={ONGLETS} plus={[]} actif={actif} onChoisir={setActif} compte={{ initiales: 'CE', nom: 'Camille Exemple' }} titre={VUE === 'stats' ? 'Statistiques' : 'Aujourd’hui'}>
      {VUE === 'stats' ? <Stats/> : <Journee/>}
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
