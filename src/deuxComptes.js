// ══════════════════════════════════════════════════════════════════════════
// « DEUX COMPTES, UNE PAIRE » (15 nov., lot deux-comptes — Julien : « lance »)
//
// La même paire en vente sur DEUX de ses comptes Vinted à la fois : deux acheteurs
// peuvent la payer. Ce module dit QUELLES annonces, avec QUELLE certitude, et LE geste :
// « Retirer celle de kicks_sud ».
//
// Module PUR (aucun accès au navigateur, à la base ni à l'extension) : Ma journée,
// Annonces (`Comptabilite`, App.jsx) et `scripts/audit-deux-comptes.cjs` exécutent les
// MÊMES fonctions (§11).
//
// ⚠️ « EN LIGNE » N'EST PAS JUGÉ ICI : les deux entrées viennent déjà de la règle unique
//    (<enligne-regle>) — `enLigneDeuxFois` (src/enLigneDeuxFois.js) et `calculerPhotosComptes`
//    (src/photosComptes.js) ne reçoivent que les annonces EN LIGNE d'un compte lu depuis
//    moins de 24 h ; un compte pas lu ne conclut rien (nommé dans `manque`).
//
// ⚠️ L'IDENTITÉ (§5) — JAMAIS LE TITRE, JAMAIS LA MARQUE, JAMAIS LA TAILLE.
//    « sûr »        : une IDENTITÉ prouvée, celles de `enLigneDeuxFois` : la même PHOTO EXACTE
//                     (le même fichier), `recreeDe` (VRM a recréé l'annonce), ou deux fiches
//                     qu'IL a fusionnées (src/fusionFiches.js, SON clic) ;
//    « à vérifier » : un INDICE, montré les deux photos côte à côte, jamais compté sûr :
//                     · la même photo à l'EMPREINTE (src/photoEmpreinte.js), au seuil STRICT
//                       `SEUIL_MEME_PHOTO` (12, mesuré) — et seulement si l'appariement est
//                       UNIQUE : une photo proche de plus d'une autre annonce (50 paires
//                       identiques photographiées au même endroit tombent à 0–12 entre elles,
//                       mesuré par le lot meme-photo-sure) ne dit rien ⇒ aucune alerte ;
//                     · le même N° sur deux annonces de deux comptes (c'est aussi « deux
//                       paires sous un N° », le bloc rouge, qui reste : ici on dit seulement
//                       que c'est PEUT-ÊTRE la même paire, et c'est SON clic qui tranche).
//    La deuxième mesure fine (`claude/meme-photo-sure`, src/photoFine.js) n'est pas fusionnée
//    (chantier en cours, extension pas publiée) : une empreinte seule reste « à vérifier ».
//
// ⚠️ LE GESTE EST LE SIEN (§3) : supprimer une annonce Vinted automatiquement est REFUSÉ, et
//    Vinted n'offre aucune « pause » d'une annonce seule que VRM sache faire (le mode vacances
//    masque TOUT le compte). Le geste ouvre donc l'annonce en trop sur vinted.fr, il la retire
//    lui-même (connecté à SON compte), et la prochaine lecture COMPLÈTE de ce compte le dit
//    (`etatRetrait`). Rien ne part tout seul.
// ══════════════════════════════════════════════════════════════════════════
import { motsEmpreinte, distanceMots, SEUIL_MEME_PHOTO } from './memePhoto.js';

const arr = (a) => (Array.isArray(a) ? a : []);
const fini = (x) => typeof x === 'number' && Number.isFinite(x);
const cleDefaut = (n) => { const s = String(n == null ? '' : n).toUpperCase().replace(/[\s\-_.]/g, ''); return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s; };

// Les clés synchronisées (SYNC_KEYS d'App.jsx) : ses « Ce n'est pas la même paire »
// ({ [cleCouple]: date }) et les annonces qu'il a ouvertes pour les retirer
// ({ [idAnnonce]: { at, uid } }).
export const CLE_REFUS_DEUX_COMPTES = 'vrm_deux_comptes_non';
export const CLE_RETRAITS_DEUX_COMPTES = 'vrm_deux_comptes_retraits';
// Une marque « ouverte pour la retirer » de plus de 7 jours ne dit plus rien.
export const MARQUE_MS = 7 * 24 * 3600e3;
export { SEUIL_MEME_PHOTO };

// La clé d'un groupe : ses annonces, triées (le même groupe garde la même clé partout).
export const cleCouple = (ids) => arr(ids).map(String).sort().join('+');
export const lienVinted = (a) => (/^https:\/\/www\.vinted\.[a-z.]+\//.test(String((a && a.url) || '')) ? a.url : `https://www.vinted.fr/items/${encodeURIComponent(String((a && a.id) || ''))}`);

// ── LES APPARIEMENTS PAR EMPREINTE (« à vérifier ») ─────────────────────────────
// `photos` : la sortie de `calculerPhotosComptes` ({ lu, annonces, empreintes }).
// Rend [{ ids: [a, b], distance }] : deux annonces de DEUX comptes Vinted dont une photo
// est à ≤ `seuil`, l'une pour l'autre leur SEULE annonce proche (toutes annonces et tous
// comptes confondus, même compte compris). Une photo proche de 3 annonces ou plus est
// générique (une boîte, un fond) ou une série de paires identiques : rien.
export function apparieParEmpreinte(photos, { seuil = SEUIL_MEME_PHOTO } = {}) {
  if (!photos || !photos.lu || !photos.empreintes) return [];
  const points = [];
  for (const a of arr(photos.annonces)) {
    if (!a || !a.id || !a.compte || (a.plateforme || 'vinted') !== 'vinted') continue;
    const cc = `vinted:${a.compte}`;
    if (photos.comptesLus && photos.comptesLus[cc] === false) continue;   // compte pas relu : il ne conclut rien
    const emp = (photos.empreintes[cc] && photos.empreintes[cc][String(a.id)]) || {};
    for (const h of Object.values(emp)) { const w = motsEmpreinte(h); if (w) points.push({ id: String(a.id), compte: String(a.compte), w }); }
  }
  // annonce ⇒ Map(autre annonce ⇒ meilleure distance)
  const proches = new Map();
  const noter = (x, y, d) => { if (!proches.has(x)) proches.set(x, new Map()); const m = proches.get(x); if (!m.has(y) || m.get(y) > d) m.set(y, d); };
  const compteDe = new Map();
  for (const p of points) compteDe.set(p.id, p.compte);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    for (let j = i + 1; j < points.length; j++) {
      const q = points[j];
      if (q.id === p.id) continue;
      const d = distanceMots(p.w, q.w);
      if (d == null || d > seuil) continue;
      noter(p.id, q.id, d); noter(q.id, p.id, d);
    }
  }
  const out = [], vus = new Set();
  for (const [x, m] of proches) {
    if (m.size !== 1) continue;                         // proche de plusieurs annonces : rien
    const [y, d] = [...m][0];
    const my = proches.get(y);
    if (!my || my.size !== 1 || !my.has(x)) continue;   // l'appariement doit être mutuel et unique
    if (compteDe.get(x) === compteDe.get(y)) continue;  // même compte : pas « deux comptes »
    const k = cleCouple([x, y]);
    if (vus.has(k)) continue;
    vus.add(k);
    out.push({ ids: [x, y].sort(), distance: d });
  }
  return out;
}

// Laquelle retirer : celle qui a le MOINS de favoris (lus), sinon la plus RÉCENTE en ligne,
// sinon le plus grand identifiant (la plus récente annonce). On garde celle qui vend le mieux.
function ordreGarder(a, b) {
  if (fini(a.favoris) && fini(b.favoris) && a.favoris !== b.favoris) return b.favoris - a.favoris;
  if (fini(a.depuis) && fini(b.depuis) && a.depuis !== b.depuis) return a.depuis - b.depuis;
  return (Number(a.id) || 0) - (Number(b.id) || 0);
}

// ── LES GROUPES ──────────────────────────────────────────────────────────────
// enLigneDeux : la sortie de `enLigneDeuxFois` (`vinted` : groupes d'identité ; `numeroSeul` :
//               le même N° sur plusieurs paires) ; null = lecture pas prête ⇒ rien.
// photos      : la sortie de `calculerPhotosComptes` ; null = pas su ⇒ aucun indice photo.
// infoDe(id)  : { uid, nom, titre, photo, url, numero, prix, depuis, favoris } d'une annonce EN
//               LIGNE (celle de l'écran) ; null ⇒ l'annonce n'est pas (plus) en ligne : écartée.
// refus       : { [cleCouple]: date } — ses « Ce n'est pas la même paire ».
// choix       : { [cleGroupe]: idARetirer } — « plutôt celle de … » (son choix, la séance).
// Rend { pret, groupes, nSurs, nAVerifier, manque } ; un groupe :
//   { id, etat: 'sur'|'verifier', preuves: ['photo'|'recree'|'fusion'|'empreinte'|'numero'],
//     numeros, annonces: [annonce…] (celle à GARDER d'abord), garder, retirer: [annonce…], distance }
export function groupesDeuxComptes({ enLigneDeux = null, photos = null, infoDe = () => null, refus = {}, choix = {}, cle = cleDefaut, seuil = SEUIL_MEME_PHOTO } = {}) {
  if (!enLigneDeux || !enLigneDeux.su) return { pret: false, groupes: [], nSurs: 0, nAVerifier: 0, manque: arr(enLigneDeux && enLigneDeux.manque) };
  const R = refus && typeof refus === 'object' ? refus : {};
  const parCle = new Map();
  const annonceDe = (id, repli) => {
    const i = infoDe(String(id));
    if (!i) return null;
    return { id: String(id), uid: String(i.uid || (repli && repli.uid) || ''), nom: String(i.nom || (repli && repli.nom) || ''), titre: String(i.titre || (repli && repli.titre) || ''),
      photo: i.photo || (repli && repli.photo) || null, url: i.url || (repli && repli.url) || '', numero: String(i.numero != null ? i.numero : ((repli && repli.numero) || '')),
      prix: fini(i.prix) ? i.prix : (repli && fini(repli.prix) ? repli.prix : null), depuis: fini(i.depuis) ? i.depuis : (repli && fini(repli.depuis) ? repli.depuis : null),
      favoris: fini(i.favoris) ? i.favoris : null };
  };
  const poser = (ids, etat, preuves, repli, distance = null) => {
    const k = cleCouple(ids);
    const deja = parCle.get(k);
    if (deja) {                                           // la même annonce par deux chemins : sûr l'emporte, les preuves s'ajoutent
      for (const p of preuves) if (!deja.preuves.includes(p)) deja.preuves.push(p);
      if (etat === 'sur') deja.etat = 'sur';
      if (distance != null && (deja.distance == null || distance < deja.distance)) deja.distance = distance;
      return;
    }
    const annonces = ids.map((id) => annonceDe(id, repli && repli.get(String(id)))).filter(Boolean);
    if (annonces.length < 2) return;
    if (new Set(annonces.map((a) => a.uid)).size < 2) return;   // le risque est entre DEUX comptes
    parCle.set(k, { id: k, etat, preuves: [...preuves], annonces, distance });
  };
  // 1. Les identités prouvées (sûr), sur au moins deux comptes.
  for (const g of arr(enLigneDeux.vinted)) {
    if (!g || !Array.isArray(g.comptes) || g.comptes.length < 2) continue;
    const vint = arr(g.annonces).filter((a) => a && a.plat === 'vinted');
    poser(vint.map((a) => a.id), 'sur', arr(g.preuves).filter((p) => p !== 'numero'), new Map(vint.map((a) => [String(a.id), a])));
  }
  // 2. Le même N° sur DEUX annonces de deux comptes (exactement deux : au-delà, VRM ne choisit pas).
  for (const g of arr(enLigneDeux.numeroSeul)) {
    const vint = arr(g && g.annonces).filter((a) => a && a.plat === 'vinted');
    if (vint.length !== 2 || new Set(vint.map((a) => a.uid)).size !== 2) continue;
    poser(vint.map((a) => a.id), 'verifier', ['numero'], new Map(vint.map((a) => [String(a.id), a])));
  }
  // 3. La même photo à l'empreinte (unique, mutuelle, seuil strict).
  for (const x of apparieParEmpreinte(photos, { seuil })) poser(x.ids, 'verifier', ['empreinte'], null, x.distance);

  const groupes = [];
  for (const g of parCle.values()) {
    if (g.etat !== 'sur' && R[g.id]) continue;            // « Ce n'est pas la même » : il a tranché
    const tri = [...g.annonces].sort(ordreGarder);
    let garder = tri[0];
    const veut = choix && choix[g.id] != null ? String(choix[g.id]) : '';
    if (veut && tri.some((a) => a.id === veut) && tri.length === 2) garder = tri.find((a) => a.id !== veut);
    const retirer = tri.filter((a) => a !== garder);
    const numeros = [...new Set(g.annonces.map((a) => a.numero).filter(Boolean))];
    groupes.push({ ...g, preuves: [...new Set(g.preuves)].sort(), numeros, annonces: [garder, ...retirer], garder, retirer, cleNum: numeros.length ? cle(numeros[0]) : '' });
  }
  // Les sûrs d'abord, puis par N°.
  groupes.sort((a, b) => (a.etat === b.etat ? 0 : a.etat === 'sur' ? -1 : 1) || String(a.cleNum).localeCompare(String(b.cleNum), 'fr', { numeric: true }) || a.id.localeCompare(b.id));
  return { pret: true, groupes, nSurs: groupes.filter((g) => g.etat === 'sur').length, nAVerifier: groupes.filter((g) => g.etat !== 'sur').length, manque: arr(enLigneDeux.manque) };
}

// ── APRÈS SON GESTE : CE QUE LA LECTURE DIT ─────────────────────────────────────
// marque : { at, uid } posée quand il a ouvert l'annonce pour la retirer ; luAt : l'heure de la
// dernière lecture COMPLÈTE de ce compte (ms). Rend :
//   'aRetirer' (aucune marque, ou trop ancienne) ·
//   'ouverte'  (il l'a ouverte ; aucune lecture complète depuis : « VRM relira ») ·
//   'encore'   (une lecture complète APRÈS l'ouverture la montre encore en ligne).
// (Une annonce qui n'est plus en ligne n'est plus dans aucun groupe : `reglees` la dit.)
export function etatRetrait(marque, luAt, maintenant = Date.now()) {
  const at = marque && Number(marque.at);
  if (!fini(at) || maintenant - at > MARQUE_MS) return { etat: 'aRetirer' };
  if (fini(luAt) && luAt > at) return { etat: 'encore', lu: luAt };
  return { etat: 'ouverte', at };
}
// Les annonces qu'il a ouvertes pour les retirer et qu'une lecture COMPLÈTE de leur compte,
// faite APRÈS, ne montre plus en ligne : « Retirée ✓ (relu à …) ». `enLigne(id)` : vrai si
// l'annonce est encore en ligne ; `luDe(uid)` : la dernière lecture complète du compte (ms).
export function reglees(marques, { enLigne = () => true, luDe = () => null, maintenant = Date.now() } = {}) {
  const out = [];
  for (const [id, m] of Object.entries(marques && typeof marques === 'object' ? marques : {})) {
    const at = m && Number(m.at);
    if (!fini(at) || maintenant - at > MARQUE_MS) continue;
    const lu = luDe(String((m && m.uid) || ''));
    if (fini(lu) && lu > at && !enLigne(String(id))) out.push({ id: String(id), uid: String(m.uid || ''), at, lu, nom: String(m.nom || ''), numero: String(m.numero || '') });
  }
  return out.sort((a, b) => b.lu - a.lu);
}
// Les marques encore utiles (moins de 7 jours) — pour ne pas laisser grossir la clé.
export function marquesUtiles(marques, maintenant = Date.now()) {
  return Object.fromEntries(Object.entries(marques && typeof marques === 'object' ? marques : {}).filter(([, m]) => m && fini(Number(m.at)) && maintenant - Number(m.at) <= MARQUE_MS));
}

// ── LES IDENTITÉS POUR « À RETIRER AILLEURS » ──────────────────────────────────
// Quand l'une des deux se VEND, l'autre doit sortir en tête de « À retirer ailleurs » : la règle
// (`articlesVendusAilleurs`, src/bilanSynchronisation.js) a besoin de savoir que la vente du
// compte A et l'annonce du compte B sont la même paire — par une IDENTITÉ, jamais par l'indice.
// `fiches` : `vinted_annonce_numeros` ; `fusions` : `pairesFusionnees(...)` (SON clic).
// Rend [[idA, idB], …] : la même PHOTO EXACTE de fiche (`photoK`, deux fiches seulement — trois
// fiches au même fichier ne disent pas laquelle), les fusions, et `recreeDe`.
export function memesPairesFiches(fiches, fusions = []) {
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  const out = [];
  const parPhoto = new Map();
  for (const [id, f] of Object.entries(F)) {
    if (!f || typeof f !== 'object') continue;
    const k = f.photoK != null ? String(f.photoK).trim() : '';
    if (k) { if (!parPhoto.has(k)) parPhoto.set(k, []); parPhoto.get(k).push(String(id)); }
    if (f.recreeDe != null && String(f.recreeDe) && F[String(f.recreeDe)]) out.push([String(id), String(f.recreeDe)]);
  }
  for (const ids of parPhoto.values()) if (ids.length === 2) out.push(ids);
  for (const m of arr(fusions)) if (Array.isArray(m) && m.length === 2) out.push(m.map(String));
  return out;
}

// ── CE QUE DISENT LA CARTE ET LE TITRE (une source, §11) ──────────────────────────
// `t` : la fonction de traduction (tr) ; `et` : « a et b » dans la langue.
export function texteDeuxComptes(groupes, t, et = (l) => l.join(', ')) {
  const g = arr(groupes);
  if (!g.length) return null;
  // Le titre et la ligne tiennent chacun sur UNE ligne à 390 px (la règle des cartes de « À faire ») ;
  // la phrase entière (« N°42 est en vente sur shop_nord et kicks_sud ») est dans `complet` et dans la feuille.
  if (g.length === 1) {
    const x = g[0];
    const noms = [...new Set(x.annonces.map((a) => a.nom).filter(Boolean))];
    const titre = x.numeros.length ? t('deuxComptes.titreNum', { numero: x.numeros[0] }) : t('deuxComptes.titreSans');
    const complet = x.numeros.length ? t('deuxComptes.complet', { numero: x.numeros[0], comptes: et(noms) }) : t('deuxComptes.completSans', { comptes: et(noms) });
    return { titre, detail: x.etat === 'sur' ? t('deuxComptes.detailSur') : t('deuxComptes.detailVerifier'), complet, n: 1 };
  }
  const nSurs = g.filter((x) => x.etat === 'sur').length;
  const titre = t('deuxComptes.titreN', { n: g.length });
  return { titre, detail: nSurs === g.length ? t('deuxComptes.detailSur') : t('deuxComptes.detailMixte', { n: g.length - nSurs }), complet: titre, n: g.length };
}
