// Le harnais du banc idees-paires (14 nov., idées 154-158) : les VRAIS composants et les VRAIES
// règles, montés seuls, sur des données INVENTÉES (le dépôt est public). Une scène par adresse :
//   #temps · #note · #modele · #taille · #heure   (+ « sombre » pour la nuit).
// Les gestes sont notés dans window.__* (rien n'est écrit nulle part).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ajouterSourceApp } from '../../../src/i18n/index.js';
import fr from '../../../src/i18n/langues/fr.js';
import { toutSurLeNumero } from '../../../src/rechercheNumero.js';
import { histoireArticle } from '../../../src/histoireArticle.js';
import { cleNumero } from '../../../src/numeroEcrit.js';
import LigneDeTemps, { OngletsFiche } from '../../../src/paireHistoire/LigneDeTemps.jsx';
import VueACompleter from '../../../src/AnnoncesACompleter.jsx';
import { notesAnnonces } from '../../../src/noteAnnonce/noteAnnonce.js';
import RemplirModele from '../../../src/modelesDescription/RemplirModele.jsx';
import AutreTaille from '../../../src/autreTaille/AutreTaille.jsx';
import MeilleureHeure, { useMeilleureHeure } from '../../../src/meilleureHeure/MeilleureHeure.jsx';

ajouterSourceApp(fr);
const sombre = /sombre/.test(location.hash);
const scene = (/#(\w+)/.exec(location.hash) || [])[1] || 'temps';
document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
document.body.style.margin = '0';
document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
document.body.style.background = sombre
  ? 'radial-gradient(90% 40% at 18% 0%, rgb(110 160 230 / .10), transparent 70%), linear-gradient(180deg, #15263D 0%, #0C1829 40%, #060E19 100%)'
  : 'radial-gradient(90% 40% at 18% 0%, rgb(255 255 255 / .55), transparent 70%), linear-gradient(180deg, #EEF6FD 0%, #D5E8F6 40%, #C6DDF0 100%)';
document.body.style.minHeight = '100vh';
document.body.style.color = sombre ? '#EAF2FB' : '#0C1D30';

const c = document.createElement('canvas'); c.width = 88; c.height = 88; const g = c.getContext('2d'); g.fillStyle = '#d9dee4'; g.fillRect(0, 0, 88, 88); g.fillStyle = '#fff'; g.fillRect(14, 40, 60, 20);
const PHOTO = c.toDataURL('image/jpeg', 0.8);
const Photo = ({ src, className }) => <img src={src} className={className} alt="" width="44" height="44"/>;

// ── LA PAIRE N°7 (et ses 49 jumelles au même titre) : la VRAIE chaîne d'identité ──
const J = 86400e3, T0 = Date.parse('2026-09-01T10:00:00Z');
const isoJ = (j, h = 0) => new Date(T0 + j * J + h * 3600e3).toISOString();
const TITRE = 'Nike Dunk Low Panda 42';
const item = (k) => String(9000000 + k), tx = (k) => String(7000000 + k);
const fiches = {}, coffres = {}, crees = {}, prixVinted = [];
for (let k = 1; k <= 50; k++) {
  fiches[item(k)] = { numero: String(k), title: TITRE, price: '80', numberedAt: isoJ(k), auto: true, buyPrice: '40', taille: '42', photo: PHOTO,
    ...(k === 7 ? { buyFrom: { title: TITRE, seller: 'vendeur_x', date: isoJ(1) }, buyFromId: '5550007' } : {}) };
  coffres[item(k)] = { firstSavedAt: isoJ(k + 2) };
  crees[item(k)] = T0 + (k + 1) * J;
  prixVinted.push({ item: item(k), avant: 90, apres: 80, at: isoJ(k + 5) });
}
prixVinted.push({ item: item(7), avant: 80, apres: 85, at: isoJ(30) });
const D = { fiches, pool: Array.from({ length: 50 }, (_, i) => String(i + 1)), enLigne: new Set(Object.keys(fiches).filter((id) => id !== item(7))),
  ventes: [{ transaction_id: tx(7), title: TITRE, price: { amount: '85', currency_code: 'EUR' }, status: 'Commande finalisée', date: isoJ(40) }],
  txnItem: { [tx(7)]: item(7) }, saleOv: {}, bordereaux: [{ tx: tx(7), pdf: true }], imprimes: {}, postes: { [tx(7)]: true }, ebayCommandes: [], ebayAnnonces: [], lbcVentes: [], plan: { items: [] } };
const oRN = { cleNum: cleNumero, ouStock: () => null, expediee: () => true, aPoster: () => false, revenue: () => false, conflits: () => [] };
const oH = { etapeVente: () => ({ label: 'Commande finalisée', step: 4 }), venteAnnulee: () => false, montantRecuEbay: () => ({ eur: null }), commandeEbayEngagee: () => true, lbcAnnulee: () => false, lbcFinalisee: () => false };
const histoire = (k) => histoireArticle(toutSurLeNumero(String(k), D, oRN), { fiches, saleOv: {}, buyByNum: {}, stats: {}, versements: { [tx(7)]: isoJ(48) }, nomCompte: () => 'boutique_test',
  coffres, offres: [], recus: new Set(['5550007']), autresEnLigne: [{ site: 'leboncoin', id: 'l1', lien: null, prix: 82 }],
  colisVente: { [tx(7)]: { bord: { at: isoJ(41), suivi: 'XY123456789FR' }, depose: isoJ(42), suivis: [{ status: 'available', at: isoJ(44) }, { status: 'delivered', at: isoJ(45) }] } },
  journalPrix: [], prixVinted, prixLus: null, sortieStock: null }, oH);

function SceneTemps() {
  const [vue, setVue] = React.useState('temps');
  const h = React.useMemo(() => histoire(7), []);
  window.__histoire = h;
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>
      <h1 style={{ font: '400 32px/1 -apple-system, system-ui', margin: '6px 0 4px' }}>N°7 · {TITRE}</h1>
      <OngletsFiche vue={vue} onVue={setVue}/>
      {vue === 'temps' ? <LigneDeTemps h={h} extra={{ reception: { ms: T0 + 3 * J, source: 'livraison' }, crees, lireStudio: async () => [{ id: 'studio_photos_7', a0: isoJ(4), a1: isoJ(4, 1), a2: isoJ(4, 2) }] }}/> : <p data-vue-etapes="">(le parcours par étape)</p>}
    </main>
  );
}

function SceneNote() {
  const base = { nPhotos: 6, marque: 'Nike', taille: '42', etat: 'Très bon état', champsLus: { marque: true, taille: true, etat: true }, prixAchat: 40, domaine: 'www.vinted.fr', photo: PHOTO };
  const res = notesAnnonces([
    { ...base, id: 11, num: '11', titre: 'Nike Dunk Low Panda 42', prix: '30', nPhotos: 2, desc: 'Très bon état.' },
    { ...base, id: 12, num: '12', titre: 'Nike Dunk Low Panda 43', prix: '80', desc: 'Court.' },
    { ...base, id: 13, num: '13', titre: 'Adidas Samba OG noires — un titre très long pour voir si la ligne tient sur un téléphone', prix: '60', prixAchat: null, desc: 'x'.repeat(120) },
    { ...base, id: 14, num: '14', titre: 'New Balance 550', prix: '90', desc: 'x'.repeat(120) },
    { ...base, id: 15, num: '15', titre: 'Asics Gel-1130', prix: '70', descLen: undefined },
  ], {});
  window.__note = res;
  return <main style={{ maxWidth: 760, margin: '0 auto', padding: '16px' }}><VueACompleter res={res} Photo={Photo} onPrixAchat={(id) => { window.__prixAchat = id; }} onBrouillon={() => {}}/></main>;
}

const MODELES = [
  { id: 'm1', nom: 'Sneakers', texte: '{marque} {modele} · taille {taille}\n{etat} · {boite}\nEnvoi soigné sous 24 h.' },
  { id: 'm2', nom: 'Court', texte: '{etat}, taille {taille}.' },
];
const NEUVE = { id: 'n51', numero: '51', titre: 'Nike Dunk Low Panda 43', marque: 'Nike', taille: '43', etat: 'Très bon état', prix: 80, description: 'Ancien texte.' };
const REGLAGES = { numeroEcrit: { actif: true, ou: ['description'] } };
function SceneModele() {
  return <main style={{ padding: 16 }}><h1>Fiche N°51</h1><RemplirModele fiche={NEUVE} modeles={MODELES} reglages={REGLAGES} onPoser={(d) => { window.__pose = d; }} onFermer={() => { window.__ferme = true; }}/></main>;
}
function SceneTaille() {
  const src = { titre: 'Nike Dunk Low Panda 42', marque: 'Nike', taille: '42', etat: 'Très bon état', description: 'Taille 42, semelle 28 cm.\nPortées deux fois, aucun défaut.\n\nN°7', prix: 80 };
  return <main style={{ padding: 16 }}><h1>Fiche N°7</h1><AutreTaille src={src} numero="7" modeles={MODELES} reglages={REGLAGES} onFermer={() => { window.__ferme = true; }}
    onCreer={async (champs, finir) => { await new Promise((r) => setTimeout(r, 150)); const fiche = { id: 'n241', numero: '241', ...champs, photos: [] }; window.__cree = { champs, fin: finir ? finir(fiche) : null }; return { ok: true, numero: '241', fiche }; }}/></main>;
}
function SceneHeure() {
  const dim = new Date(2026, 10, 8, 18, 30, 0).getTime();
  const lignes = [];
  for (let i = 0; i < 60; i++) lignes.push({ plateforme: 'Vinted', ts: dim - (i % 20) * 7 * J, eur: 50 });
  for (let i = 0; i < 352; i++) lignes.push({ plateforme: 'Vinted', ts: dim - (i % 40) * J - ((i * 5) % 11) * 3600e3 - 9 * 3600e3, eur: 50 });
  for (let i = 0; i < 12; i++) lignes.push({ plateforme: 'Leboncoin', ts: new Date(2026, 10, 2, 0, 0, 0).getTime(), eur: 40, heureLue: false });
  const r = useMeilleureHeure(lignes), peu = useMeilleureHeure(lignes.slice(0, 10));
  const [val, setVal] = React.useState('');
  window.__heure = r;
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
      <h1>Programmer</h1>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Heure de départ<input type="datetime-local" data-rp-heure="" value={val} onChange={(e) => setVal(e.target.value)} style={{ minHeight: 44, fontSize: 16 }}/></label>
      <MeilleureHeure r={r} onChoisir={(ms) => { window.__choisi = ms; const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); setVal(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`); }} maintenant={new Date(2026, 10, 14, 12).getTime()}/>
      <hr/>
      <MeilleureHeure r={peu}/>
    </main>
  );
}

const SCENES = { temps: SceneTemps, note: SceneNote, modele: SceneModele, taille: SceneTaille, heure: SceneHeure };
const S = SCENES[scene] || SceneTemps;
const hote = document.createElement('div'); document.body.appendChild(hote);
createRoot(hote).render(<S/>);
window.__pret = true;
