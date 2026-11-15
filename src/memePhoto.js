// ══════════════════════════════════════════════════════════════════════════
// « LA MÊME PHOTO » ENTRE VINTED ET LES AUTRES SITES (15 nov., lot meme-photo).
//
// Julien : « quand je poste une paire sur Vinted et que je la poste après sur
// Leboncoin sans avoir dit que c'était la même, je veux que VRM propose que c'est
// exactement la même — on ne parle pas du tout de titre, mais vraiment exactement
// la même photo ».
//
// • L'entrée : les EMPREINTES perceptuelles (src/photoEmpreinte.js : dHash + pHash à
//   trois recadrages, seuil MESURÉ `SEUIL_PHOTO`) de ses annonces Vinted
//   (`photo_emprunte_{uid}`, extension 5.358) et de ses annonces Leboncoin, eBay,
//   Vestiaire (`photo_empreinte_{lbc|vc|ebay}`, extension 5.382 / page pour eBay).
//   Jamais un titre, une marque, une taille ou un prix : seule la photo compte.
// • La sortie : des PROPOSITIONS. §5 « une proposition peut utiliser la
//   ressemblance ; c'est toujours SON clic qui relie » : ce module ne relie rien,
//   n'écrit rien, ne renumérote rien. Le geste « Relier » (App.jsx, `relierParPhoto`)
//   pose le lien qui existait déjà pour chaque site (`vrm_lbc_liens`,
//   `vrm_ebay_liens`, `vrm_vc_liens`) — la même identité que lit le retrait ailleurs.
// • « Mieux vaut un blanc qu'un faux » :
//     – une photo trouvée sur DEUX paires différentes ⇒ AMBIGU : on montre les
//       deux, il choisit (jamais un choix automatique) ;
//     – une photo GÉNÉRIQUE (logo, boîte, fond, étiquette : vue sur plus de
//       `GENERIQUE_ANNONCES` annonces, ou sur `GENERIQUE_PAIRES` paires ou plus)
//       est ignorée ;
//     – une annonce Vinted SANS N° ne peut rien donner (aucune proposition) ; un N°
//       porté par deux paires (`numerosDouteux`) n'est jamais proposé seul ;
//     – « Ce n'est pas la même » (`refus`) : le couple annonce × N° ne revient plus.
// • Module PUR (aucun accès au navigateur, à la base, à l'extension) : l'app et
//   `scripts/audit-meme-photo.cjs` exécutent les MÊMES fonctions (§11).
// ══════════════════════════════════════════════════════════════════════════
import { SEUIL_PHOTO, empreinteValide } from './photoEmpreinte.js';

// Une photo vue sur PLUS de 6 annonces (la même paire en ligne partout : Vinted, un
// second compte Vinted, Leboncoin, eBay, Vestiaire = 5 au plus) n'est pas une photo
// de paire : c'est un logo, une boîte, un fond.
export const GENERIQUE_ANNONCES = 6;
// Une photo vue sur 3 paires DIFFÉRENTES ou plus : générique aussi (sur 2 : ambigu).
export const GENERIQUE_PAIRES = 3;
// Les sites qu'on relie à une paire Vinted (le nom tel que l'app l'écrit partout).
export const SITES_MEME_PHOTO = ['Leboncoin', 'eBay', 'Vestiaire'];

const arr = (a) => (Array.isArray(a) ? a : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const cleNumDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

// ── LA DISTANCE, EN MOTS DE 32 BITS ───────────────────────────────────────────
// La MÊME distance que `distanceEmpreintes` (meilleur dHash + meilleur pHash / 2, sur
// les trois recadrages), calculée sur des mots déjà lus : une comparaison coûte 36
// comptes de bits au lieu de 288 lectures de caractères (des milliers de photos).
// `audit-meme-photo` vérifie l'égalité avec la règle sur des milliers de couples.
export function motsEmpreinte(h) {
  if (!empreinteValide(h)) return null;
  const w = new Uint32Array(12);
  for (let i = 0; i < 12; i++) w[i] = parseInt(h.slice(i * 8, i * 8 + 8), 16) >>> 0;
  return w;
}
const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24; };
export function distanceMots(a, b) {
  if (!a || !b) return null;
  let dd = 64, dp = 64;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const d = pop(a[2 * i] ^ b[2 * j]) + pop(a[2 * i + 1] ^ b[2 * j + 1]);
    if (d < dd) dd = d;
    const p = pop(a[6 + 2 * i] ^ b[6 + 2 * j]) + pop(a[7 + 2 * i] ^ b[7 + 2 * j]);
    if (p < dp) dp = p;
  }
  return dd + dp / 2;
}

// La clé d'un REFUS (« Ce n'est pas la même ») : l'annonce de l'autre site × le N°.
export const cleRefusMemePhoto = (plateforme, id, numero, cle = cleNumDefaut) => `${plateforme}:${id}|${cle(numero)}`;
// La clé d'une annonce, partout la même.
export const cleAnnonceMemePhoto = (a) => `${a.plateforme}:${a.id}`;

// ── LES PROPOSITIONS ─────────────────────────────────────────────────────────
// `vinted`  : [{ id, compte, compteNom, numero, titre, photo, lien }] — ses annonces
//             Vinted (en ligne) avec leur N° de fiche ('' s'il n'y en a pas) ;
// `autres`  : [{ plateforme: 'Leboncoin'|'eBay'|'Vestiaire', id, compte, compteNom,
//             titre, photo, lien, relie, numero }] — ses annonces des autres sites ;
//             `relie` = déjà reliée à une paire par IDENTITÉ (lien posé, référence,
//             SKU) : elle ne reçoit aucune proposition, mais ses photos comptent pour
//             reconnaître une photo générique ;
// `empreintes` : { vinted: { [uid]: { [idAnnonce]: { [clePhoto]: hex } } },
//                  Leboncoin|eBay|Vestiaire: { [idAnnonce]: { [clePhoto]: hex } } } ;
//                `null` ⇒ lecture ratée : rien n'est proposé, rien n'est dit « vérifié » ;
// `refus`   : { [cleRefusMemePhoto]: date } — ses « Ce n'est pas la même » ;
// `numerosDouteux` : Set des N° (cleNum) portés par deux paires présentes ;
// `cle`     : cleNum de l'app (« 007 » = « 7 », « b125 » = « B125 »).
// Rend { lu, propositions, ambigus, nGeneriques, nSansEmpreinte, nVerifiees,
//        nARelier, parNumero } :
//   proposition = { id, annonce, numero, vinted: [annonce Vinted…], photoAutre,
//                   photoVinted, distance } ;
//   ambigu      = { id, annonce, raison: 'deux-paires'|'numero-double'|'sans-numero',
//                   paires: [{ numero, vinted: [annonce…], photoAutre, photoVinted, distance }] }.
export function propositionsMemePhoto({ vinted = [], autres = [], empreintes = null, refus = {}, numerosDouteux = null, cle = cleNumDefaut, seuil = SEUIL_PHOTO } = {}) {
  const vide = { lu: false, propositions: [], ambigus: [], nGeneriques: 0, nSansEmpreinte: 0, nVerifiees: 0, nARelier: 0, parNumero: new Map() };
  const E = objet(empreintes);
  if (!E) return vide;
  const douteux = numerosDouteux instanceof Set ? numerosDouteux : new Set(arr(numerosDouteux).map((x) => cle(x)));
  const refuses = objet(refus) || {};
  // Une photo calculée = un point.
  const points = [];
  const ajouter = (cote, a, parPhoto) => {
    for (const [k, h] of Object.entries(objet(parPhoto) || {})) {
      const w = motsEmpreinte(h);
      if (w) points.push({ cote, a, k, w, cleA: cote === 'vinted' ? `Vinted:${a.id}` : cleAnnonceMemePhoto(a) });
    }
  };
  const EV = objet(E.vinted) || {};
  for (const a of arr(vinted)) {
    if (!a || a.id == null) continue;
    const parCompte = objet(EV[String(a.compte)]) || {};
    ajouter('vinted', a, parCompte[String(a.id)]);
  }
  const candidats = [];
  let nSansEmpreinte = 0, nVerifiees = 0;
  for (const a of arr(autres)) {
    if (!a || a.id == null || !SITES_MEME_PHOTO.includes(a.plateforme)) continue;
    const parSite = objet(E[a.plateforme]) || {};
    const avant = points.length;
    ajouter('autre', a, parSite[String(a.id)]);
    if (a.relie) continue;
    if (points.length === avant) { nSansEmpreinte++; continue; }
    nVerifiees++;
    candidats.push({ a, debut: avant, fin: points.length });
  }
  const propositions = [], ambigus = [];
  let nGeneriques = 0;
  for (const c of candidats) {
    const parPaire = new Map();               // clé de paire ⇒ { numero, vinted: Map, photoAutre, photoVinted, distance }
    for (let i = c.debut; i < c.fin; i++) {
      const p = points[i];
      const annoncesVues = new Set(), paires = new Map();
      for (const q of points) {
        if (q.cleA === p.cleA) continue;      // l'annonce elle-même (ses autres photos)
        const d = distanceMots(p.w, q.w);
        if (d == null || d > seuil) continue;
        annoncesVues.add(q.cleA);
        if (q.cote !== 'vinted') continue;
        const n = cle(q.a.numero || '');
        const kp = n ? `n:${n}` : `a:${q.a.id}`;
        const x = paires.get(kp);
        if (!x || d < x.distance) paires.set(kp, { numero: n, q, distance: d });
      }
      // Générique : vue sur plus de N annonces (elle comprise), ou sur 3 paires et plus.
      if (annoncesVues.size + 1 > GENERIQUE_ANNONCES || paires.size >= GENERIQUE_PAIRES) { nGeneriques++; continue; }
      for (const [kp, x] of paires) {
        const e = parPaire.get(kp) || { numero: x.numero, vinted: new Map(), photoAutre: p.k, photoVinted: x.q.k, distance: x.distance };
        e.vinted.set(String(x.q.a.id), x.q.a);
        if (x.distance < e.distance) { e.distance = x.distance; e.photoAutre = p.k; e.photoVinted = x.q.k; }
        parPaire.set(kp, e);
      }
    }
    // Ses « Ce n'est pas la même » : ce couple ne revient plus.
    for (const [kp, e] of [...parPaire]) if (e.numero && refuses[cleRefusMemePhoto(c.a.plateforme, c.a.id, e.numero, cle)]) parPaire.delete(kp);
    if (!parPaire.size) continue;
    const paires = [...parPaire.values()].map((e) => ({ numero: e.numero, vinted: [...e.vinted.values()], photoAutre: e.photoAutre, photoVinted: e.photoVinted, distance: e.distance }))
      .sort((x, y) => x.distance - y.distance || String(x.numero).localeCompare(String(y.numero), 'fr', { numeric: true }));
    const id = cleAnnonceMemePhoto(c.a);
    if (paires.length >= 2) { ambigus.push({ id, annonce: c.a, raison: 'deux-paires', paires }); continue; }
    const seule = paires[0];
    if (!seule.numero) { ambigus.push({ id, annonce: c.a, raison: 'sans-numero', paires }); continue; }
    if (douteux.has(seule.numero)) { ambigus.push({ id, annonce: c.a, raison: 'numero-double', paires }); continue; }
    propositions.push({ id, annonce: c.a, numero: seule.numero, vinted: seule.vinted, photoAutre: seule.photoAutre, photoVinted: seule.photoVinted, distance: seule.distance });
  }
  const ordre = (x, y) => SITES_MEME_PHOTO.indexOf(x.annonce.plateforme) - SITES_MEME_PHOTO.indexOf(y.annonce.plateforme) || String(x.id).localeCompare(String(y.id));
  propositions.sort((x, y) => x.distance - y.distance || ordre(x, y));
  ambigus.sort(ordre);
  // L'autre sens (la fiche de la paire) : N° ⇒ les annonces d'ailleurs à relier.
  const parNumero = new Map();
  for (const p of propositions) { if (!parNumero.has(p.numero)) parNumero.set(p.numero, []); parNumero.get(p.numero).push(p); }
  // Une annonce sans N° Vinted (« sans-numero ») n'a rien à relier : elle n'est pas comptée à faire.
  const nARelier = propositions.length + ambigus.filter((x) => x.raison !== 'sans-numero').length;
  return { lu: true, propositions, ambigus, nGeneriques, nSansEmpreinte, nVerifiees, nARelier, parNumero };
}

// Les propositions d'UN site (la file « À relier » de son écran).
export function duSite(res, plateforme) {
  if (!res || !res.lu) return { propositions: [], ambigus: [] };
  return { propositions: res.propositions.filter((p) => p.annonce.plateforme === plateforme), ambigus: res.ambigus.filter((p) => p.annonce.plateforme === plateforme && p.raison !== 'sans-numero') };
}
