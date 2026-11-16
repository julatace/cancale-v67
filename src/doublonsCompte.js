// ══════════════════════════════════════════════════════════════════════════
// « DEUX ANNONCES D'UN MÊME COMPTE, UNE PAIRE » (16 nov., lot doublons-meme-compte —
// mission 10 de la file, validée par Julien)
//
// La même paire en ligne DEUX FOIS sur le MÊME compte Vinted : deux acheteurs peuvent
// la payer. Ce module dit QUELLES annonces, avec QUELLE certitude ; le geste reste le
// sien (§3 : VRM ne supprime jamais une annonce tout seul — il ouvre l'annonce en trop
// sur vinted.fr et la retire lui-même ; la prochaine lecture complète le voit).
//
// Module PUR (aucun accès au navigateur, à la base ni à l'extension) : Ma journée,
// Annonces (`Comptabilite`, App.jsx) et `scripts/audit-doublons-compte.cjs` exécutent
// les MÊMES fonctions (§11).
//
// ⚠️ « EN LIGNE » N'EST PAS JUGÉ ICI : les entrées viennent de la règle unique
//    (<enligne-regle>) — `enLigneDeuxFois` et `calculerPhotosComptes` ne reçoivent que
//    les annonces EN LIGNE d'un compte lu en entier depuis moins de 24 h ; « à confirmer »
//    et les annonces MASQUÉES par Vinted n'y sont jamais. Un compte pas lu ne conclut rien.
//
// ⚠️ L'IDENTITÉ (§5) — JAMAIS LE TITRE, JAMAIS LA MARQUE, JAMAIS LA TAILLE.
//    « sûr »        : les groupes d'un même compte de `enLigneDeuxFois` — la même PHOTO
//                     EXACTE (le même fichier), `recreeDe` (VRM a recréé l'annonce et
//                     l'ancienne est encore là), ou deux fiches qu'IL a fusionnées ;
//    « à vérifier » : la même photo à l'EMPREINTE (src/photoEmpreinte.js, calculée par
//                     l'extension 5.358), au seuil STRICT `SEUIL_MEME_PHOTO` et seulement si
//                     l'appariement est UNIQUE et MUTUEL (`apparieParEmpreinte`, la règle de
//                     « deux comptes ») : 50 paires identiques photographiées au même endroit
//                     ne disent rien. Un indice : « peut-être », jamais compté sûr.
//    LE MÊME N° sur deux annonces présentes : c'est « deux paires sous un même N° », le bloc
//    ROUGE (`conflitsDeNumeros`, §5) qui le dit déjà et les règle — pas de seconde alerte ici.
//
// ⚠️ UNE REPUBLICATION EN COURS N'EST PAS UN DOUBLON. L'atelier Republier enregistre,
//    supprime, recrée : pendant quelques minutes l'ancienne et la nouvelle peuvent être
//    lues ensemble. Un couple est écarté (et compté dans `exclus`) quand :
//      · l'opération de republication de CET appareil (`vrm_operation_repub`, pas finie,
//        touchée depuis moins de 2 h) porte l'une des deux annonces ;
//      · le journal des republications (`vrm_repub_journal`) dit que l'une remplace
//        l'autre depuis moins de 2 h ;
//      · le lien `recreeDe` de la fiche les relie et la nouvelle est en ligne depuis moins
//        de 2 h (ou le journal la date de moins de 2 h).
//    Au-delà, l'ancienne toujours en ligne est une VRAIE double vente possible : dite.
// ══════════════════════════════════════════════════════════════════════════
import { tr } from './i18n/index.js';
import { apparieParEmpreinte, cleCouple } from './deuxComptes.js';
import { SEUIL_MEME_PHOTO } from './memePhoto.js';

const arr = (a) => (Array.isArray(a) ? a : []);
const fini = (x) => typeof x === 'number' && Number.isFinite(x);
const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
export const FENETRE_REPUB_MS = 2 * 3600e3;
export const ETATS_OPERATION = ['attente', 'encours', 'fait'];

// Ce qui est EN TRAIN d'être republié. journal : `entreesDe(vrm_repub_journal)` ({ [nouvelId]:
// { anc, at } }) ; operation : `vrm_operation_repub` ({ fini, majAt, paires: [{ id, etat }] }) ;
// fiches : `vinted_annonce_numeros` ({ [id]: { recreeDe } }).
// Rend { ids: Set (annonces portées par une opération en cours), couples: Set(cleCouple),
//        liens: Map(nouvelId ⇒ ancienId) (recreeDe ou journal, sans date) }.
export function republicationsEnCours({ journal = null, operation = null, fiches = null, maintenant = Date.now() } = {}) {
  const ids = new Set(), couples = new Set(), liens = new Map();
  const J = journal && typeof journal === 'object' ? journal : {};
  for (const [nid, e] of Object.entries(J)) {
    if (!e || !e.anc) continue;
    liens.set(String(nid), String(e.anc));
    if (fini(e.at) && maintenant - e.at >= 0 && maintenant - e.at < FENETRE_REPUB_MS) couples.add(cleCouple([nid, e.anc]));
  }
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  for (const [id, f] of Object.entries(F)) if (f && f.recreeDe != null && String(f.recreeDe).trim()) liens.set(String(id), String(f.recreeDe).trim());
  const o = operation && typeof operation === 'object' ? operation : null;
  const maj = o ? ms(o.majAt) : null;
  if (o && !o.fini && maj != null && maintenant - maj < FENETRE_REPUB_MS) {
    for (const p of arr(o.paires)) if (p && p.id != null && ETATS_OPERATION.includes(String(p.etat || 'attente'))) ids.add(String(p.id));
  }
  return { ids, couples, liens };
}

// Le couple (a, b) est-il une republication en cours ? `depuis(id)` : depuis quand l'annonce est en ligne (ms) ou null.
function enRepublication(idsGroupe, rep, depuis, maintenant) {
  const l = idsGroupe.map(String);
  if (l.some((id) => rep.ids.has(id))) return true;
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    const a = l[i], b = l[j];
    if (rep.couples.has(cleCouple([a, b]))) return true;
    const nouvelle = rep.liens.get(a) === b ? a : rep.liens.get(b) === a ? b : null;
    if (nouvelle != null) { const d = depuis(nouvelle); if (fini(d) && maintenant - d < FENETRE_REPUB_MS) return true; }
  }
  return false;
}

// enLigneDeux : la sortie de `enLigneDeuxFois` ; photos : celle de `calculerPhotosComptes` (null = pas su ⇒
// aucun indice photo) ; infoDe(id) : { uid, nom, titre, photo, url, numero, prix, depuis } d'une annonce EN LIGNE
// (null ⇒ pas/plus en ligne : écartée) ; republication : la sortie de `republicationsEnCours`.
// Rend { pret, groupes, nSurs, nAVerifier, exclus } ; un groupe a la forme des groupes de `enLigneDeuxFois`
// (la feuille et l'alerte d'Annonces les rendent tels quels) + { id, etat: 'sur'|'verifier', uid, nom }.
export function doublonsMemeCompte({ enLigneDeux = null, photos = null, infoDe = () => null, republication = null, maintenant = Date.now(), seuil = SEUIL_MEME_PHOTO } = {}) {
  if (!enLigneDeux || !enLigneDeux.su) return { pret: false, groupes: [], nSurs: 0, nAVerifier: 0, exclus: 0 };
  const rep = republication || { ids: new Set(), couples: new Set(), liens: new Map() };
  const groupes = [];
  const dejaSurs = new Set();
  let exclus = 0;
  const depuisDe = (annonces) => (id) => { const a = annonces.find((x) => String(x.id) === String(id)); return a && fini(a.depuis) ? a.depuis : null; };
  for (const g of arr(enLigneDeux.vinted)) {
    if (!g || !g.memeCompte) continue;
    const v = arr(g.annonces).filter((a) => a && a.plat === 'vinted');
    if (v.length < 2) continue;
    const ids = v.map((a) => String(a.id));
    if (enRepublication(ids, rep, depuisDe(v), maintenant)) { exclus++; continue; }
    for (const id of ids) dejaSurs.add(id);
    groupes.push({ ...g, id: cleCouple(ids), etat: 'sur', uid: String(v[0].uid || ''), nom: String(v[0].nom || '') });
  }
  for (const p of apparieParEmpreinte(photos, { seuil, memeCompte: true })) {
    const [x, y] = p.ids;
    if (dejaSurs.has(String(x)) && dejaSurs.has(String(y))) continue;    // déjà dit, sûr
    const a = infoDe(String(x)), b = infoDe(String(y));
    if (!a || !b || String(a.uid || '') !== String(b.uid || '') || !String(a.uid || '')) continue;
    const annonces = [a, b].map((i, k) => ({ plat: 'vinted', id: String(p.ids[k]), uid: String(i.uid), nom: String(i.nom || ''), titre: String(i.titre || ''), photo: i.photo || null,
      url: String(i.url || ''), numero: String(i.numero || ''), prix: fini(i.prix) ? i.prix : null, depuis: fini(i.depuis) ? i.depuis : null }));
    if (enRepublication(p.ids, rep, depuisDe(annonces), maintenant)) { exclus++; continue; }
    const numeros = [...new Set(annonces.map((x2) => x2.numero).filter(Boolean))];
    groupes.push({ id: cleCouple(p.ids), etat: 'verifier', uid: annonces[0].uid, nom: annonces[0].nom, cle: '', numeros, annonces, comptes: [annonces[0].uid], memeCompte: true, preuves: ['empreinte'], distance: p.distance });
  }
  groupes.sort((g1, g2) => (g1.etat === g2.etat ? 0 : g1.etat === 'sur' ? -1 : 1) || String(g1.id).localeCompare(String(g2.id)));
  return { pret: true, groupes, nSurs: groupes.filter((g) => g.etat === 'sur').length, nAVerifier: groupes.filter((g) => g.etat === 'verifier').length, exclus };
}

// La carte de Ma journée (une source pour le titre, la ligne, l'infobulle — §7). null s'il n'y a rien.
// « 2 annonces de tomj606 sont la même paire (N°124) » ; un indice dit « peut-être ».
export function texteDoublonsCompte(groupes) {
  const g = arr(groupes);
  if (!g.length) return null;
  if (g.length === 1) {
    const x = g[0];
    const n = arr(x.annonces).length, compte = x.nom || x.uid || '';
    const num = arr(x.numeros)[0] || '';
    const cle = x.etat === 'verifier' ? (num ? 'doublons.titreVerifierNum' : 'doublons.titreVerifier') : (num ? 'doublons.titreNum' : 'doublons.titre');
    const titre = tr(cle, { n, compte, num });
    const detail = tr(x.etat === 'verifier' ? 'doublons.detailVerifier' : 'doublons.detailSur');
    return { titre, detail, complet: `${titre} — ${detail}`, geste: tr('doublons.voirLesDeux') };
  }
  const titre = tr('doublons.titrePlusieurs', { n: g.length });
  const detail = tr(g.every((x) => x.etat === 'verifier') ? 'doublons.detailVerifier' : 'doublons.detailSur');
  return { titre, detail, complet: `${titre} — ${detail}`, geste: tr('doublons.voir') };
}
