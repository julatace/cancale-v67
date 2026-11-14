// Le harnais du banc annonce-vinted : la VRAIE feuille « Créer sur Vinted » (src/CreerSurVinted.jsx),
// la VRAIE règle (src/annonceVinted.js) et la VRAIE feuille « VRM travaille » (lancerTravail),
// montées seules ; l'extension est bouchonnée (`envoyer`) et note chaque commande. Rien de réel.
import React from 'react';
import { createRoot } from 'react-dom/client';
import CreerSurVinted from '../../../src/CreerSurVinted.jsx';
import { SuiviTravailHote } from '../../../src/composants/SuiviTravail.jsx';
import { ajouterSourceApp } from '../../../src/i18n/index.js';
import fr from '../../../src/i18n/langues/fr.js';
import { variablesTheme, MINERAL, MINERAL_DARK } from '../../../src/themeMineral.js';
import '../../../src/design/fusion.css';

ajouterSourceApp(fr);
const sombre = /sombre/.test(location.hash);
const sansCompte = /sanscompte/.test(location.hash);
document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
for (const [k, v] of Object.entries(variablesTheme(sombre ? MINERAL_DARK : MINERAL, sombre))) document.documentElement.style.setProperty(k, v);
document.body.style.background = 'var(--vrm-bg)';
const app = document.createElement('div'); app.id = 'app'; app.innerHTML = '<h1 style="padding:16px">Annonces</h1>'; document.body.appendChild(app);
const c = document.createElement('canvas'); c.width = 120; c.height = 90; const g = c.getContext('2d'); g.fillStyle = '#c9c4bb'; g.fillRect(0, 0, 120, 90); g.fillStyle = '#fff'; g.fillRect(20, 40, 80, 25);
const PHOTO = c.toDataURL('image/jpeg', 0.8);
const FICHES = [
  { id: 'n1', numero: '41', titre: 'Nike Air Max 90 blanches', description: 'Très bon état, portées deux fois.', prix: 65, marque: 'Nike', taille: '42', etat: 'Très bon état', photos: [PHOTO, PHOTO] },
  { id: 'n2', numero: '42', titre: 'Adidas Samba OG noires — un titre très long pour voir si la ligne tient sur un téléphone', description: 'Bon état.', prix: 48.5, marque: 'Adidas', taille: '43', etat: 'Bon état', photos: [] },
];
const OPTIONS = [];
for (const [gn, base] of [['Hommes', 1200], ['Femmes', 1300], ['Enfants', 1400]]) for (const [i, t] of ['Baskets', 'Bottes', 'Sandales', 'Mocassins', 'Chaussures de sport', 'Espadrilles'].entries()) OPTIONS.push([String(base + i), `${gn} > Chaussures > ${t}`]);
window.__envois = [];
const envoyer = async (p) => {
  window.__envois.push(JSON.parse(JSON.stringify(p)));
  await new Promise((r) => setTimeout(r, 400));
  if (/refus/.test(location.hash)) return { accepte: false, code: 'refuse', raison: 'Vinted demande une photo plus nette' };   // (5.376) un refus dit sur la ligne
  if (!p.reponses.catalog_id) return { accepte: false, code: 'question', question: { champ: 'catalog_id', nom: 'la catégorie', options: OPTIONS, num: p.fiche.numero, texte: '' } };
  return { accepte: true, etape: 'fait', draftId: '88001', lie: true, aFinir: ['la taille du colis'] };
};
const hote = document.createElement('div'); document.body.appendChild(hote);
createRoot(hote).render(<><SuiviTravailHote lireJobs={() => ({})}/><CreerSurVinted fiches={FICHES} compteOnglet={sansCompte ? null : { uid: '111', login: 'compte_banc' }} reglages={{ numeroEcrit: { actif: true, ou: ['description'] } }} envoyer={envoyer} entreMs={0} onCree={(f, r) => { window.__cree = [f.id, r.draftId]; }} onFermer={() => { window.__ferme = true; }}/></>);
window.__pret = true;
