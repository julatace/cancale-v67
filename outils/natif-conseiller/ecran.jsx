// ── outils/natif-conseiller/ecran.jsx — le Conseiller SEUL (hors du paquet de prod) ──
// Les VRAIS composants (src/conseiller/Conseiller.jsx, DemandeVRM.jsx) et les VRAIES règles (src/conseiller/regles.js sur
// src/conseiller/sources.js et ses propriétaires) sur des données INVENTÉES (le dépôt est public). Jugé par
// scripts/bancs/conseiller.cjs.   ?vue=carte | ecran    &base=lu | vide    &theme=dark    &cle=aucune | posee
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque, Page } from '../../src/natif/index.js';
import { CarteConseils, EcranConseiller } from '../../src/conseiller/Conseiller.jsx';
import DemandeVRM from '../../src/conseiller/DemandeVRM.jsx';
import { sourcesConseiller } from '../../src/conseiller/sources.js';
import { conseils as conseilsDe } from '../../src/conseiller/regles.js';
import { publierBaisses } from '../../src/conseiller/publications.js';
import '../../src/conseiller/conseiller.css';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frNatif);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const VUE = P.get('vue') || 'ecran', BASE = P.get('base') || 'lu';
const JOUR = 86400000, NOW = Date.now(), UID = '11111111-1111-1111-1111-111111111111';
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// LES VENTES INVENTÉES (aucun vrai pseudo, aucune vraie paire).
const MODS = [['Adidas', 'Adidas Samba OG noir'], ['Nike', 'Nike Dunk Low panda'], ['New Balance', 'New Balance 550 blanche'], ['Asics', 'Asics Gel-Kayano 14']];
const rows = [], txn = {}, items = {};
if (BASE === 'lu') for (let i = 0; i < 48; i++) {
  const [marque, titre] = MODS[i % 4];
  const ts = NOW - (i + 1) * 1.5 * JOUR, id = 'tx' + i, item = 'it' + i;
  rows.push(['Vinted', i % 3 ? 'vendeur_exemple' : 'second_exemple', id, ts, i % 4 === 1 ? 65 : 80, i % 4 === 1 ? 70 : 40, 4, titre]);
  txn[id] = { item }; items[item] = { id: item, brand: marque, size: '42', title: titre, listed: ts - (5 + (i % 4)) * JOUR };
}
const store = BASE === 'lu' ? {
  vinted_urssaf_mois: { mois: [{ ym: `${new Date(NOW).getFullYear()}-01`, ca: 70000, n: 400, parPlateforme: { Vinted: { ca: 70000, n: 400 } } }] }, vrm_seuils_vus: {},
  vrm_colis_aposter: { at: NOW - 3600000, total: 3, liste: [{ num: '7', jour: iso(NOW), nom: 'Samba' }, { num: '8', jour: iso(NOW + JOUR) }, { num: '9', jour: iso(NOW + JOUR), estimee: true }] },
} : {};
try {
  localStorage.clear();
  if (BASE === 'lu') {
    localStorage.setItem('vrm_offres_sans_reponse', JSON.stringify({ owner: UID, n: 2, plusAncienne: NOW - 3 * JOUR, at: NOW - 60000 }));
    publierBaisses(5, { owner: UID, lu: true });
    localStorage.setItem('vrm_valeur_stock', JSON.stringify({ owner: UID, n: 30, nPrix: 25, nSans: 5, c: 120000, at: NOW }));
  }
} catch (_) {}
const live = { venduLignes: rows.map((r) => ({ plateforme: 'Vinted', compte: r[1], tx: r[2], ts: r[3] })) };
const valeurSel = (id, p, sel) => {
  if (BASE !== 'lu') return { valeur: null };
  if (id === 'dorment') return { valeur: 11, partiel: false };
  if (!p || typeof p !== 'object') return { valeur: null };
  const c = sel && sel.compte ? sel.compte.login : null;
  const L = live.venduLignes.filter((l) => (!c || l.compte === c) && l.ts >= p.de && l.ts < p.a);
  return { valeur: id === 'ventes' ? L.length : id === 'vendu' ? L.length * 75 : null };
};
const outils = { uid: () => UID, load: (k) => (k in store ? store[k] : null), regime: () => (BASE === 'lu' ? 'micro' : undefined), enLigne: (it) => it.listed, entete: () => ({ authorization: 'Bearer essai' }), vue: () => {} };
const S = sourcesConseiller({ o: outils, valeurSel, live: BASE === 'lu' ? live : null, L: { releve: BASE === 'lu' ? rows : null, extras: BASE === 'lu' ? { txn, items, dates: null } : null }, maintenant: NOW });
const LISTE = conseilsDe(S, NOW);
window.__CONSEILS = LISTE; window.__GESTES = [];
const geste = (g) => window.__GESTES.push(g);

const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'box'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
function Ecran() {
  const [actif, setActif] = React.useState('journee');
  return (
    <Coque onglets={ONGLETS} plus={[]} actif={actif} onChoisir={setActif} compte={{ initiales: 'CE', nom: 'Camille Exemple' }} titre={VUE === 'carte' ? 'Aujourd’hui' : 'Conseiller'}>
      <Page titre={VUE === 'carte' ? 'Aujourd’hui' : 'Conseiller'}>
        {VUE === 'carte' ? <div data-banc-carte=""><CarteConseils liste={LISTE} onGeste={geste} onToutVoir={() => geste('tout')} Icon={Icon}/></div>
          : <EcranConseiller liste={LISTE} etat="lu" onGeste={geste} Icon={Icon} demande={<DemandeVRM sources={S} conseils={LISTE} outils={outils} onGeste={geste} Icon={Icon}/>}/>}
      </Page>
    </Coque>
  );
}
createRoot(document.getElementById('r')).render(<Ecran/>);
