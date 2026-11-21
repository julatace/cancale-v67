// Le harnais du banc confort-securite (14 nov., lots 117–130) : les VRAIS écrans montés
// seuls (src/EcranAtelier.jsx, src/ConnexionQr.jsx, src/LienAide.jsx, src/VerrouCode.jsx,
// src/ApercuAnnonce.jsx, src/InventaireTournant.jsx, src/CarteMerci.jsx) avec leurs VRAIES
// règles ; le serveur est bouchonné (`fetch`) et note chaque appel (window.__appels).
// La projection du lien d'aide passe par la VRAIE liste blanche (src/lienAideProjection.js) :
// la page de l'aide reçoit ce que le serveur renverrait. Données INVENTÉES.
// Scène : le fragment de l'adresse (#atelier, #qr-ordi, #qr-iphone, #verrou, #code,
// #aide, #aide-fin, #aide-reglage, #apercu, #tournant, #merci) + « -sombre ».
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ajouterSourceApp } from '../../../src/i18n/index.js';
import fr from '../../../src/i18n/langues/fr.js';
import '../../../src/styles-systeme.css';
import EcranAtelier from '../../../src/EcranAtelier.jsx';
import { QrOrdinateur, ApprouverQr } from '../../../src/ConnexionQr.jsx';
import { VueLienAide, ReglageLienAide } from '../../../src/LienAide.jsx';
import { VerrouCode, ReglageCodeLocal } from '../../../src/VerrouCode.jsx';
import ApercuAnnonce from '../../../src/ApercuAnnonce.jsx';
import InventaireTournant from '../../../src/InventaireTournant.jsx';
import { ReglageCarteMerci } from '../../../src/CarteMerci.jsx';
import { projectionLienAide } from '../../../src/lienAideProjection.js';
import { fabriquerCode, ecrireCode } from '../../../src/codeLocal.js';
import { texteAnnonceVinted } from '../../../src/annonceVinted.js';

ajouterSourceApp(fr);
const h = location.hash.slice(1);
const scene = h.replace(/-sombre$/, '');
const sombre = /-sombre$/.test(h);
document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
document.body.style.cssText = `margin:0;background:var(--d-fond);color:var(--d-encre);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`;
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000aa';
const now = Date.now();
const jour = (d) => { const x = new Date(now + d * 86400000); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const MOD = ['Nike Air Max 90 blanche', 'Adidas Samba OG noire', 'New Balance 550 crème', 'Asics Gel-1130 argent', 'Salomon XT-6 grise', 'Nike Dunk Low panda'];
// Une photo de Ma journée INVENTÉE, avec ce qui ne doit JAMAIS sortir vers l'aide (montants, comptes, acheteur).
const PHOTO = { v: 2, uid: UID, at: now - 4 * 60000, nEnvoyer: 7, nRetirer: 3, nAVerifier: 0, nePasPoster: 0,
  envoyer: Array.from({ length: 7 }, (_, i) => ({ titre: `${MOD[i % 6]} taille ${39 + i}${i === 1 ? ' — 120 €' : ''}`, numero: String(118 + i * 7), compte: 'boutique_au_nom_vraiment_tres_long_pour_voir', plateforme: i === 5 ? 'ebay' : 'vinted', tx: String(62000 + i), prix: 60 + i, pdf: i < 5 ? [`email_bord_${62000 + i}`] : [], jour: jour(i === 0 ? -1 : i % 3), heure: i % 2 ? '12:00' : '', trNom: ['Mondial Relay', 'Vinted Go', 'Chronopost', 'Colissimo'][i % 4], acheteur: 'pseudo_acheteur', adresse: '12 rue Inventée' })),
  retirer: [
    { titre: 'Asics Gel-Kayano 14 crème', lieu: 'Relais Pressing du Marché, 4 place Inventée, 75011 Paris', code: 'AB12CD', transporteur: 'Mondial Relay', limite: jour(0), compte: 'acheteur_x', prix: 70 },
    { titre: 'New Balance 2002R grise', lieu: 'Locker Vinted Go — Gare Inventée', code: '583921', transporteur: 'Vinted Go', limite: jour(3) },
    { titre: '', lieu: 'Bureau de poste Inventé', code: '', transporteur: 'Colissimo', limite: jour(5) },
  ], aVerifier: [] };
const BENEF = { v: 2, at: now - 60000, jours: { [jour(0)]: [4, 31750, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } };
window.__appels = [];
const vraiFetch = window.fetch.bind(window);
const rep = (st, j) => new Response(JSON.stringify(j), { status: st, headers: { 'Content-Type': 'application/json' } });
let attentes = 0;
window.fetch = async (u, init = {}) => {
  const url = String(u);
  if (!/\/api\/compte\?mode=/.test(url)) return vraiFetch(u, init);
  const corps = init.body ? JSON.parse(init.body) : null;
  window.__appels.push({ url, methode: init.method || 'GET', corps, auth: !!(init.headers && init.headers.Authorization) });
  await new Promise((r) => setTimeout(r, 60));
  if (/qr-connexion/.test(url)) {
    if (corps.action === 'creer') return rep(200, { ok: true, ticket: 'eyJpIjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1diJ9.c2lnbmF0dXJlLWRlLWJhbmMtaW52ZW50ZWU', secret: 'secret-de-banc-jamais-dans-le-qr', exp: Date.now() + 120000, appareil: corps.appareil });
    if (corps.action === 'attendre') { attentes++; return rep(200, attentes < 3 ? { ok: true, etat: 'attente' } : { ok: true, etat: 'connecte', session: { access_token: 'a.b.c', refresh_token: 'r', expires_in: 3600, user: { id: UID, email: 'j@exemple.test', factors: [] } } }); }
    if (corps.action === 'voir') return rep(200, { ok: true, appareil: 'Mac de Julien', exp: Date.now() + 90000, deja: false });
    if (corps.action === 'approuver' || corps.action === 'refuser') return rep(200, { ok: true, etat: corps.action === 'approuver' ? 'approuve' : 'refuse' });
  }
  if (/lien-aide/.test(url)) {
    if (/[?&]t=/.test(url)) return scene === 'aide-fin' ? rep(404, { erreur: 'introuvable' }) : rep(200, { ok: true, exp: now + 20 * 3600000, projection: projectionLienAide(PHOTO, now) });
    if ((init.method || 'GET') === 'GET') return rep(200, { ok: true, liens: [{ id: 'A'.repeat(22), cree: now - 3600000, exp: now + 23 * 3600000, revoque: false, actif: true, ouvertures: 3, journal: [{ at: now - 600000, quoi: 'ouvert', ua: 'Safari' }] }, { id: 'B'.repeat(22), cree: now - 3 * 86400000, exp: now - 2 * 86400000, revoque: true, actif: false, ouvertures: 1, journal: [] }] });
    if (corps.action === 'creer') return rep(200, { ok: true, id: 'C'.repeat(22), exp: now + 86400000, jeton: 'C'.repeat(22) + '.' + (now + 86400000) + '.' + 'S'.repeat(43) });
    return rep(200, { ok: true });
  }
  return rep(200, {});
};
const toast = (m) => { window.__toasts = [...(window.__toasts || []), m]; };
const entetes = () => ({ Authorization: 'Bearer jeton-de-banc' });
const tel = innerWidth < 600;
const Page = ({ children, titre }) => <div style={{ maxWidth: 560, margin: '0 auto', padding: tel ? '24px 16px' : '40px 24px' }}><h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.024em', margin: '0 0 16px' }}>{titre}</h1>{children}</div>;
const photoCanvas = (teinte) => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const g = c.getContext('2d'); g.fillStyle = teinte; g.fillRect(0, 0, 300, 400); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(150, 260, 110, 40, 0, 0, Math.PI * 2); g.fill(); return c.toDataURL('image/jpeg', 0.8); };

(async () => {
  try { localStorage.clear(); } catch (_) {}
  localStorage.setItem('vrm_hl_photo_' + UID, JSON.stringify(PHOTO));
  localStorage.setItem('vrm_benefice_jours', JSON.stringify(BENEF));
  let el = null;
  if (scene === 'atelier') el = <EcranAtelier uid={UID} onFermer={() => { window.__ferme = true; }}/>;
  else if (scene === 'atelier-vide') { localStorage.removeItem('vrm_hl_photo_' + UID); localStorage.removeItem('vrm_benefice_jours'); el = <EcranAtelier uid={UID} onFermer={() => {}}/>; }
  else if (scene === 'qr-ordi') el = <Page titre="Connexion"><QrOrdinateur onSession={(s) => { window.__session = s; }} origine="https://vrm.center"/></Page>;
  else if (scene === 'qr-iphone') el = <Page titre="Ma journée"><p>…</p><ApprouverQr ticket="eyJpIjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1diJ9.c2lnbmF0dXJlLWRlLWJhbmMtaW52ZW50ZWU" entetes={entetes} onFin={() => { window.__fin = true; }}/></Page>;
  else if (scene === 'verrou') { ecrireCode(localStorage, await fabriquerCode('4826', { subtle: crypto.subtle, alea: (u) => crypto.getRandomValues(u) })); el = <><Page titre="Ma journée"><p>Contenu de l’app (sous le verrou).</p></Page><VerrouCode onDeconnexion={() => { window.__deconnecte = true; }}/></>; }
  else if (scene === 'code') el = <Page titre="Code à l’ouverture"><ReglageCodeLocal toast={toast}/></Page>;
  else if (scene === 'aide' || scene === 'aide-fin') el = <VueLienAide jeton={'A'.repeat(22) + '.' + (now + 3600000) + '.' + 'S'.repeat(43)}/>;
  else if (scene === 'aide-reglage') el = <Page titre="Lien pour ton aide"><ReglageLienAide uid={UID} entetes={entetes} toast={toast}/></Page>;
  else if (scene === 'apercu') {
    const fiche = { id: 'f1', numero: '124', titre: 'Nike Air Max 90 blanche', description: 'Très bon état, portées deux fois.\nBoîte d’origine.', prix: { amount: '89.5' }, marque: 'Nike', taille: '42', etat: 'Très bon état', couleur: 'Blanc' };
    el = <Page titre="Annonces"><ApercuAnnonce fiche={fiche} texte={texteAnnonceVinted(fiche, { numeroEcrit: { actif: true, ou: ['description'] } })} photos={[photoCanvas('#c9c4bb'), photoCanvas('#9fb4c7')]} onFermer={() => { window.__ferme = true; }}/></Page>;
  } else if (scene === 'tournant') {
    const unites = Array.from({ length: 1000 }, (_, i) => ({ cles: [String(i + 1)], numero: String(i + 1), titre: `${MOD[i % 6]} taille ${38 + (i % 8)}`, photo: '', etat: i % 17 === 0 ? 'vendu' : i % 23 === 0 ? 'aconfirmer' : 'enligne' }));
    window.__unites = unites;
    let etat = {};
    el = <Page titre="Stock"><InventaireTournant unites={unites} uid={UID} lire={() => etat} ecrire={(v) => { etat = v; window.__etat = v; }}/></Page>;
  } else if (scene === 'merci') {
    let r = { signature: 'Julien', boutique: 'Atelier Sneakers Inventé' };
    el = <Page titre="Carte de remerciement"><ReglageCarteMerci lire={() => r} ecrire={(v) => { r = v; }} telecharger={(b, nom) => { window.__pdf = { taille: b.size, nom }; }}/></Page>;
  }
  const hote = document.createElement('div'); document.body.appendChild(hote);
  createRoot(hote).render(el);
  window.__pret = true;
})();
