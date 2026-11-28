// ── outils/avant-publier/banc.jsx — le banc de « Avant de publier » et du dossier « À publier » (hors du paquet de prod) ──
// Les VRAIS composants (src/publier/, src/aPublier/, src/depot/PreparerFiche.jsx) avec des données INVENTÉES (aucune vraie
// donnée : le dépôt est public). Construit par esbuild et servi par `node scripts/bancs/avant-publier.cjs`.
//   ?vue=preparer · feuille · dossier · regrouper · fiche · aussi · choix · annonce   &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr/natif.js';
import frDepot from '../../src/i18n/langues/fr/depot.js';
import frAvant from '../../src/i18n/langues/fr/avantPublier.js';
import frClarte from '../../src/i18n/langues/fr/styleClarte.js';
import { poserIcone, Page } from '../../src/natif/index.js';
import PreparerFiche from '../../src/depot/PreparerFiche.jsx';
import DossierAPublier from '../../src/aPublier/DossierAPublier.jsx';
import { BlocAvantPublier, RelierAchatFeuille } from '../../src/publier/AvantPublier.jsx';
import { poserOutilsAchat } from '../../src/publier/outilsAchat.js';
import { faDemande } from '../../src/aPublier/fileAussi.js';
import '../natif-galerie/galerie.css';

ajouterSourceApp({ ...frNatif, ...frClarte, ...frDepot, ...frAvant });
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const VUE = P.get('vue') || 'dossier';
const photo = (t, f = 0) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="hsl(${t} 30% 84%)"/><path d="M10 78c8-3 16-13 23-21 5 7 12 10 21 11 10 2 18 5 18 11v4H10z" fill="hsl(${t} 36% ${f ? 34 : 46}%)"/></svg>`);
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

// Des achats inventés : 50 « identiques », deux autres.
const achats = [
  ...Array.from({ length: 6 }, (_, i) => ({ transaction_id: String(9000000 + i), title: 'Nike Air Force 1 blanc 42', date: new Date(Date.UTC(2026, 10, 20 - i)).toISOString(), price: { amount: '40.00', currency_code: 'EUR' }, status: 'Commande finalisée', ph: photo(200 + i * 9) })),
  { transaction_id: '9100000', title: 'Adidas Samba OG blanc 42', date: '2026-11-02T10:00:00Z', price: { amount: '52.00', currency_code: 'EUR' }, status: 'Commande finalisée', ph: photo(30) },
  { transaction_id: '9100001', title: 'Asics Gel-Kayano 14 argent 43', date: '2026-10-28T10:00:00Z', price: { amount: '61.50', currency_code: 'EUR' }, status: 'Commande finalisée', ph: photo(120) },
];
const outils = { charger: () => Promise.resolve(achats), liens: new Map(), marqueDe: (t) => ['nike', 'adidas', 'asics'].find((m) => String(t).toLowerCase().includes(m)) || null,
  couleursDe: (t) => ['blanc', 'argent'].filter((c) => String(t).toLowerCase().includes(c)), modeleDe: null, proposition: (a) => ({ source: 'recu', tx: a.transaction_id, centimes: 4590 }),
  accNom: () => 'compte_banc', photoDe: (a) => a.ph, estLot: () => false };
poserOutilsAchat(outils);
const reglages = { autoAccepte: true, paliers: { actif: true, paliers: [50, 80, 100] }, agentActif: false };
const confirmer = () => Promise.resolve(true);
const at = '2026-11-28T09:00:00Z';
const br = (id, o = {}) => ({ id, creeAt: at, origine: 'dossier', titre: 'Nike Air Force 1 blanche', taille: '42', prix: 80, dossier: { v: 1, creeAt: at, cle: 'd' + id, photos: [{ id: 'p' + id }, { id: 'q' + id }, { id: 'r' + id }] }, ...o });
const neuves = {
  dbanc1: br('dbanc1', { numero: '217', buyFromId: '9000000', buyFrom: { title: 'Nike Air Force 1 blanc 42', recu: true }, buyPrice: '45,90', buyPriceSource: 'recu', min: '60', minAt: at }),
  dbanc2: br('dbanc2', { titre: 'Asics Gel-Kayano 14 argent', taille: '43', prix: 95, creeAt: '2026-11-28T08:00:00Z' }),
  dbanc3: br('dbanc3', { numero: '218', titre: 'Adidas Samba OG', taille: '42', prix: 70, creeAt: '2026-11-28T07:00:00Z', buyFromId: '9100000', buyFrom: { title: 'Adidas Samba', aSaisir: true } }),
  dbanc4: br('dbanc4', { numero: '214', titre: 'New Balance 550 blanc vert', publiee: { id: '7712300045', at: '2026-11-27T18:00:00Z', de: 'photo' } }),
  dbanc5: br('dbanc5', { numero: '215', titre: 'Nike Dunk Low Panda', publiee: { id: '7712300046', at: '2026-11-27T17:00:00Z', de: 'numero' } }),
};
const vig = { ddbanc1: photo(210), ddbanc2: photo(120), ddbanc3: photo(30) };
const jl = faDemande({ site: 'leboncoin', brouillon: 'dbanc1', numero: '217' }, null, Date.now() - 3600e3, cleNum);
const jv = faDemande({ site: 'vestiaire', brouillon: 'dbanc1', numero: '217' }, null, Date.now() - 3600e3, cleNum);
const taches = { [jl.cle]: { ...jl.job, etat: 'fait', id: '2900000001' }, [jv.cle]: jv.job };
const nouvelles = [{ id: '7712300099', titre: 'Asics Gel-Kayano 14 argent', photo: photo(122), numero: '219' }, { id: '7712300098', titre: 'Asics Gel-Kayano 14 silver', photo: photo(118), numero: '220' }];
const regroupe = { photos: Array.from({ length: 8 }, (_, i) => ({ id: 'g' + i, img: photo(i < 3 ? 210 : i < 6 ? 30 : 120, i % 2), vig: photo(i < 3 ? 210 : i < 6 ? 30 : 120, i % 2), t: Date.UTC(2026, 10, 28, 9, i < 3 ? i : i < 6 ? 40 + i : 90 + i) })), coupures: new Set([3]), propose: new Set([3, 6]), sets: [0] };

function Dossier({ initial }) {
  const [T, setT] = React.useState(neuves);
  return <DossierAPublier neuves={T} nouvelles={nouvelles} ambigus={{ dbanc2: ['7712300099', '7712300098'] }} outils={outils} reglages={reglages} vignettes={vig} Icon={Icon}
    ecrirePhotos={async () => true} creer={async () => true} modifier={(id, p) => { setT((o) => ({ ...o, [id]: { ...o[id], ...p } })); return true; }} donnerNumeros={async () => ({ ok: true, numeros: {} })}
    imprimer={async () => true} lier={async () => true} confirmer={confirmer} ouvrirPreparer={() => {}} poserMiniNum={() => {}} ouvrirAnnonce={() => {}} dire={() => {}}
    annonceTitre={(id) => ({ 7712300045: 'New Balance 550 blanc vert 43', 7712300046: 'Nike Dunk Low Panda 42' })[id] || ''} taches={taches} mettreEnFile={async () => ({ ok: true })} cleNum={cleNum} initial={initial}/>;
}
function Vue() {
  if (VUE === 'preparer') return <PreparerFiche fiche={{ id: 'n1', numero: '217', titre: 'Nike Air Force 1 blanche', marque: 'Nike', taille: '42', prix: 80, etat: 'Très bon état', depot: { photos: ['a', 'b'], couverture: 'a' } }}
    lireStudio={() => Promise.resolve({ photos: [{ id: 'a', img: photo(210) }, { id: 'b', img: photo(212, 1) }] })} modeles={[]} onEnregistrer={() => true} onFermer={() => {}} onAvant={() => true} lireReglage={(k, d) => ({ vinted_offres_auto: true, vinted_offres_paliers: { actif: true } })[k] ?? d} confirmer={confirmer}/>;
  if (VUE === 'feuille') return <RelierAchatFeuille outils={outils} cible={{ titre: 'Nike Air Force 1 blanc 42', taille: '42', dateRef: '2026-11-28T10:00:00Z' }} onRelier={() => true} onFermer={() => {}}/>;
  if (VUE === 'annonce') return <Page titre="N° 217"><BlocAvantPublier fiche={{ numero: '217', buyFromId: '9000000', buyFrom: { recu: true }, buyPrice: '45,90', buyPriceSource: 'recu', min: '60', minAt: at }} prixC={8000} reglages={reglages} confirmer={confirmer} onRelier={() => {}} onMini={() => true}/></Page>;
  if (VUE === 'regrouper') return <Page titre="Annonces"><Dossier initial={{ regroupe }}/></Page>;
  if (VUE === 'fiche') return <Page titre="Annonces"><Dossier initial={{ ouvert: 'dbanc1' }}/></Page>;
  if (VUE === 'aussi') return <Page titre="Annonces"><Dossier initial={{ aussi: 'dbanc1' }}/></Page>;
  if (VUE === 'choix') return <Page titre="Annonces"><Dossier initial={{ choix: 'dbanc2' }}/></Page>;
  return <Page titre="Annonces"><Dossier/></Page>;
}
createRoot(document.getElementById('r')).render(<Vue/>);
