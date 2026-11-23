// ── outils/calendrier-semaine/ecran.jsx — « Les 7 prochains jours », SEULE (hors du paquet de prod) ──
// La VRAIE feuille (src/calendrierSemaine/CalendrierSemaine.jsx) et la VRAIE règle (src/calendrierSemaine.js), sur des
// publications INVENTÉES à la forme réelle (`vrm_colis_aposter.liste`, `vrm_colis_retirer.colis`), datées à partir
// d'AUJOURD'HUI à Paris. Jugé par scripts/bancs/calendrier-semaine.cjs.   ?base=lu | passu
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Page, Groupe, Rangee } from '../../src/natif/index.js';
import CalendrierSemaine from '../../src/calendrierSemaine/CalendrierSemaine.jsx';
import { jourParis } from '../../api/_lib/retrait-colis.js';
import { plusJours } from '../../api/_lib/bilan-semaine.js';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const auj = jourParis(Date.now());
const j = (k) => plusJours(auj, k);
const midiParis = (ymd) => Date.parse(ymd + 'T11:00:00Z');
const PUB = P.get('base') === 'passu' ? {} : {
  vrm_colis_aposter: { total: 9, vinted: 7, ebay: 2, leboncoin: 0, vestiaire: null, at: Date.now() - 600000, liste: [
    { nom: 'Nike Air Max 90 blanche 42', num: '12', jour: j(0), heure: '', estimee: false, retard: false },
    { nom: 'Adidas Samba OG noire 40', num: '13', jour: j(0), heure: '', estimee: true, retard: false },
    { nom: 'New Balance 550 blanc vert 43', num: '14', jour: j(2), heure: '', estimee: false, retard: false },
    { nom: 'Asics Gel-Lyte III grise 41', num: '', jour: j(4), heure: '12:00', estimee: false, retard: false },
    { nom: 'Puma Suede bleu 44', num: '15', jour: j(-2), heure: '', estimee: false, retard: true },
    { nom: 'Salomon XT-6 noire 42', num: '16', jour: j(-1), heure: '', estimee: true, retard: false },
    { nom: 'Converse Chuck 70 crème 39', num: 'B230', jour: j(9), heure: '', estimee: false, retard: false },
  ] },
  vrm_colis_retirer: { total: 4, at: Date.now() - 900000, colis: [
    [j(1), Date.now() - 86400000, 'mondialrelay', 'e:MR1', 1, '', '', 'Nike Dunk Low Panda 42'],
    ['', Date.now() - 2 * 86400000, 'vinted', 'e:VG1', 1, '', new Date(midiParis(j(3))).toISOString(), 'Jordan 1 Mid 43'],
    ['', Date.now() - 86400000, 'mondialrelay', 'e:MR2', 1, '', '', 'Achat inventé'],
    ['', Date.now() - 86400000, 'colissimo', 'e:CO1', 1, '', '', ''],
  ] },
};
window.__PUB = PUB; window.__AUJ = auj;
const load = (k, d) => (Object.prototype.hasOwnProperty.call(PUB, k) ? PUB[k] : d);
window.__FICHE = [];
window.addEventListener('vrm:fiche-paire', (e) => window.__FICHE.push(e.detail));
function Ecran() {
  const [o, setO] = React.useState(true);
  return (
    <Page titre="Aujourd’hui">
      <Groupe titre="Colis"><Rangee titre="Les 7 prochains jours" fin="chevron" onClick={() => setO(true)} attrs={{ 'data-cal-ouvrir': '' }}/></Groupe>
      {o ? <CalendrierSemaine onFermer={() => setO(false)} load={load} onNav={(t) => { window.__NAV = t; }} Icon={Icon}/> : null}
    </Page>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
