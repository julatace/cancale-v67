// Le harnais du banc suivi-travail : la VRAIE feuille (src/composants/SuiviTravail.jsx) et le VRAI
// magasin (src/suiviTravail.js), montés seuls sur une fausse page « app » ; la jauge est bouchonnée
// (elle lit la base). Rien de réel : des annonces inventées.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SuiviTravailHote } from '../../../src/composants/SuiviTravail.jsx';
import { suivi } from '../../../src/suiviTravail.js';
import { ajouterSourceApp } from '../../../src/i18n/index.js';
import fr from '../../../src/i18n/langues/fr.js';
import { variablesTheme, MINERAL, MINERAL_DARK } from '../../../src/themeMineral.js';
import '../../../src/design/fusion.css';

ajouterSourceApp(fr);
const sombre = /sombre/.test(location.hash);
document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
for (const [k, v] of Object.entries(variablesTheme(sombre ? MINERAL_DARK : MINERAL, sombre))) document.documentElement.style.setProperty(k, v);
document.body.style.background = 'var(--vrm-bg)';
window.__clicsDerriere = 0;
const app = document.createElement('div'); app.id = 'app';
app.innerHTML = '<h1>Annonces</h1><button id="derriere" style="width:300px;height:200px">Un bouton de l’app</button>';
app.querySelector('#derriere').addEventListener('click', () => { window.__clicsDerriere++; });
document.body.appendChild(app);
const hote = document.createElement('div'); document.body.appendChild(hote);
window.__jobs = {};
createRoot(hote).render(<SuiviTravailHote lireJobs={() => window.__jobs}/>);
window.__suivi = suivi;
const ETAPES = [['lecture', "Lecture de l'annonce"], ['photos', 'Envoi des photos'], ['enregistrement', 'Enregistrement dans VRM'], ['brouillon', 'Création du brouillon'], ['suppression', "Retrait de l'ancienne annonce"], ['attente', 'Pause de 1 à 3 min avant la mise en ligne'], ['en-ligne', 'Mise en ligne'], ['accepte', 'Acceptée par Vinted ✓']];
// Une file comme Republier : 4 annonces, la 1re réussie, la 2e refusée (raison + geste), la 3e en cours.
window.__lancer = () => {
  const t = suivi.demarrer({ sorte: 'republier-recreer', titre: 'Republier sur Vinted', etapes: ETAPES,
    articles: [{ id: '101', num: '12', titre: 'Nike Air Max 90 blanches' }, { id: '102', num: '13', titre: 'Adidas Samba noires' }, { id: '103', num: '14', titre: 'New Balance 550 — un titre très long pour voir si la ligne tient sur un téléphone étroit' }, { id: '104', num: 'B230', titre: 'Asics Gel' }] }, Date.now() - 4 * 60000);   // commencé il y a 4 min : un rythme mesurable
  window.__t = t;
  t.etape('101', 'photos', 'photo 2 sur 6'); t.etape('101', 'brouillon'); t.etape('101', 'accepte'); t.fin('101', { etat: 'ok' });
  t.etape('102', 'lecture'); t.fin('102', { etat: 'refus', raison: 'Vinted demande de ralentir', geste: 'Attends la fin de la pause de Vinted, puis relance' });
  t.etape('103', 'brouillon'); t.pause({ ms: 95000, raison: 'Pause au hasard avant la mise en ligne' });
  return true;
};
