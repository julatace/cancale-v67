// ── outils/historique-paire/ecran.jsx — la ligne de temps d'UNE paire, SEULE (hors du paquet de prod) ──
// Le VRAI composant (src/paireHistoire/LigneDeTemps.jsx) et la VRAIE règle (ligneDeTemps.js), sur une paire INVENTÉE :
// achetée, numérotée, RANGÉE (vrm_fiches_neuves : case + caseAt), publiée sur deux sites, une baisse, vendue, partie,
// versement. 50 fiches au MÊME titre sous 50 N° : seule celle de CE N° compte. Jugé par scripts/bancs/historique-paire.cjs.
//   ?cas=date (fiche datée) | slot (case du Stock sans date) | passu (fiches pas lues) | double (deux fiches sous le N°)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Page, Groupe } from '../../src/natif/index.js';
import LigneDeTemps from '../../src/paireHistoire/LigneDeTemps.jsx';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const CAS = P.get('cas') || 'date';
const cleNum = (x) => String(x).toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]*)0+(?=\d)/, '$1');
const fiches = {};
for (let i = 1; i <= 50; i++) fiches['f' + i] = { id: 'f' + i, numero: String(i), title: 'Nike Dunk Low Panda 42', ...(i % 7 === 0 ? { case: { m: 'm1', i }, caseAt: '2026-10-2' + (i % 9) + 'T09:00:00.000Z' } : {}) };
if (CAS !== 'slot') { fiches.f12.case = { m: 'm1', i: 12 }; fiches.f12.caseAt = '2026-10-04T16:20:00.000Z'; }
if (CAS === 'double') fiches.g = { numero: '012', title: 'Une autre paire', case: { m: 'm2', i: 1 }, caseAt: '2026-10-05T08:00:00.000Z' };
const h = { num: '12', etapes: [
  { cle: 'achat', etat: 'fait', evenements: [{ at: '2026-10-01T10:00:00.000Z', preuve: 'achat n° 7000012', vendeur: 'vendeur_invente' }] },
  { cle: 'numero', etat: 'fait', evenements: [{ at: '2026-10-03T10:00:00.000Z', preuve: 'fiche' }] },
  { cle: 'annonces', etat: 'fait', evenements: [{ cle: 'ebay', at: '2026-10-06T10:00:00.000Z', preuve: 'SKU VRM-12' }, { cle: 'leboncoin', at: '2026-10-07T10:00:00.000Z', preuve: 'référence VRM 12' }] },
  { cle: 'prix', etat: 'fait', evenements: [{ at: '2026-10-12T10:00:00.000Z', avant: 95, apres: 85, site: 'ebay', preuve: 'eBay' }] },
  { cle: 'vente', etat: 'fait', evenements: [{ cle: 'ebay', at: '2026-10-15T10:00:00.000Z', texte: 'Vendue 85 €', preuve: 'commande eBay 11-22-33' }] },
  { cle: 'colis', etat: 'fait', evenements: [{ cle: 'depose', at: '2026-10-16T10:00:00.000Z', preuve: 'ton clic' }] },
], resume: { achat: 4000 }, double: false };
const extra = { reception: undefined, fichesNeuves: CAS === 'passu' ? null : fiches, slots: CAS === 'slot' ? { 12: { m: 'm1', i: 12 }, 13: { m: 'm1', i: 13 } } : {}, cleNum };
function Ecran() {
  return (
    <Page titre="N°12 · Nike Dunk Low Panda 42">
      <Groupe titre="Dans l’ordre"><div style={{ padding: '8px 16px' }}><LigneDeTemps h={h} extra={extra}/></div></Groupe>
    </Page>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
