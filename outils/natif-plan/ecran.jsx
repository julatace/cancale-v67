// ── outils/natif-plan/ecran.jsx — le Conseiller avec le « Plan du matin » (hors du paquet de prod) ──
// Les VRAIS composants (src/conseiller/Conseiller.jsx, PlanDorment.jsx) et les VRAIES règles (planDorment.js → publierPlan →
// sourcesConseiller → planGestes.js) sur des annonces INVENTÉES (le dépôt est public), à la forme des lignes d'Annonces.
// Jugé par scripts/bancs/plan-dorment.cjs.   ?base=lu | peu | vide    &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque, Page } from '../../src/natif/index.js';
import { EcranConseiller } from '../../src/conseiller/Conseiller.jsx';
import { PlanDuMatin } from '../../src/conseiller/PlanDorment.jsx';
import { planDuMatin } from '../../src/conseiller/planDorment.js';
import { agirPlan, verdictPlan } from '../../src/conseiller/planGestes.js';
import { sourcesConseiller } from '../../src/conseiller/sources.js';
import { conseils as conseilsDe } from '../../src/conseiller/regles.js';
import { publierPlan, publierBaisses } from '../../src/conseiller/publications.js';
import '../../src/conseiller/conseiller.css';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const BASE = P.get('base') || 'lu';
const NOW = Date.now(), UID = '11111111-1111-1111-1111-111111111111';
const TEINTES = ['#D9E4DD', '#E8DCCB', '#D6DCE8', '#E6D3D3', '#DDE6D0'];
const PHOTO = (k) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" fill="${TEINTES[k % 5]}"/><path d="M8 40c6 0 10-8 16-12 4 4 10 6 18 6 6 0 10 2 10 6v4H8z" fill="#2B2F36"/><path d="M8 44h44v3H8z" fill="#fff"/></svg>`);

// Les annonces EN LIGNE inventées, à la forme de `planMatin` (Comptabilite.jsx) : deux comptes, prix en texte, vues `null`
// quand Vinted rend 0, âge mesuré (la plupart jeunes : il republie), un prix d'achat saisi pour certaines.
const COMPTES = [['3100000001', 'compte_exemple'], ['3100000002', 'second_exemple']];
const lignes = [];
const n = BASE === 'peu' ? 6 : BASE === 'lu' ? 34 : 0;
for (let i = 0; i < n; i++) {
  const [uid, compte] = COMPTES[i % 2];
  lignes.push({ id: String(7300000000 + i), uid, compte, numero: String(120 + i), photo: PHOTO(i), prix: `${45 + (i * 7) % 60}.0`,
    age: i < 8 ? 3 + i : 14 + (i % 11) + (i === 30 ? 30 : 0), vues: 18 + ((i * 37) % 160), favoris: (i * 5) % 9, achat: i % 3 ? 25 + (i % 5) : null,
    plancherVente: null, mini: i === 30 ? '68.00' : null, derniereBaisse: null, surLbc: i % 4 === 0, surVc: null, surEbay: false });
}
if (BASE === 'lu') {
  // Une paire très vieille mais aux vues PAS LUES : jamais « dort » (§5) ; une vieille vue sans favori, achat connu : la baisse.
  lignes.push({ ...lignes[9], id: '7300009999', numero: '999', vues: null, age: 80 });
  lignes.push({ ...lignes[10], id: '7300008888', numero: '888', vues: 900, favoris: 0, age: 45, prix: '92.0', achat: 30 });
}
const PLAN = BASE === 'vide' ? null : planDuMatin(lignes, { bloque: {}, sites: ['leboncoin', 'ebay'], maintenant: NOW });
try {
  localStorage.clear();
  localStorage.setItem('vrm_conseiller_presentation_vue', 'banc');
  if (PLAN) publierPlan(PLAN, { owner: UID, lu: true, maintenant: NOW });
  if (BASE === 'lu') publierBaisses(3, { owner: UID, lu: true, photos: [PHOTO(3), PHOTO(4)] });
} catch (_) {}
const outils = { uid: () => UID, load: () => null, regime: () => undefined, enLigne: () => null, vue: () => {} };
const S = sourcesConseiller({ o: outils, valeurSel: (id) => (id === 'dorment' && BASE === 'lu' ? { valeur: 4, partiel: false } : { valeur: null }), live: null, L: { releve: null, extras: null }, maintenant: NOW });
const avecPlan = !!(S.plan && S.plan.lignes && S.plan.lignes.length);
const LISTE = conseilsDe(S, NOW).filter((c) => !(avecPlan && c.id === 'dorment'));
// La porte d'essai : le second compte n'a pas l'extension connectée ⇒ ses boutons sont éteints.
const PORTE = P.get('mutation') === 'porte' ? null : { agirMaintenant: (site, compte) => (compte === '3100000002' ? { ok: false, cle: 'cplan.cpBloqueCompte', vars: {} } : { ok: true }) };
window.__PLAN = S.plan; window.__PLAN_CALCULE = PLAN; window.__OUVERTS = []; window.__EBAY = [];
const ouvrir = (o) => { window.__OUVERTS.push(o); return ''; };

const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'box'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
const Photo = (p) => <img {...p}/>;
function Ecran() {
  const [actif, setActif] = React.useState('journee');
  const plan = S.plan ? <PlanDuMatin plan={S.plan} onAgir={(l) => agirPlan(l, { ouvrir, onEbay: (id) => window.__EBAY.push(id) })} verdict={(l) => verdictPlan(l, PORTE, tr)} Icon={Icon} Photo={Photo}/> : null;
  return (
    <Coque onglets={ONGLETS} plus={[]} actif={actif} onChoisir={setActif} compte={{ initiales: 'CE', nom: 'Camille Exemple' }} titre="Conseiller">
      <Page titre="Conseiller">
        <EcranConseiller liste={LISTE} etat="lu" onGeste={() => {}} Icon={Icon} Photo={Photo} plan={plan}/>
      </Page>
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
