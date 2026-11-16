// ════════════════════════════════════════════════════════════════════════════
//  UNE PAIRE REPUBLIÉE DANS L'APP VINTED DU TÉLÉPHONE (15 nov., lot numeros-masquees)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « imagine que la personne publie sur l'app Vinted et ne lie pas
// l'extension directement après », puis « ou alors quand VRM reconnaît la photo
// qu'elle a modifiée, elle attribue le numéro ».
//
// LE DÉFAUT MESURÉ (code) : une republication faite entièrement dans l'app Vinted
// (supprimer puis recréer, sans l'atelier ni la feuille guidée) ne laisse AUCUNE
// identité « qui remplace qui » (src/repriseNumero.js ne la connaît que par
// l'extension, l'atelier ou le clic « C'est republié »), et les photos ré-envoyées
// sont de NOUVEAUX fichiers (la reprise par fichier photo ne les relie pas). À la
// lecture suivante, en « VRM numérote », la nouvelle annonce recevait un N° NEUF :
// le carton porte l'ancien. Un N° faux, le pire défaut (§5).
//
// LA RÈGLE (le DERNIER recours de la numérotation, juste avant un N° neuf ; les
// identités — vente, N° écrit, N° réservé, fichier photo, republication connue —
// passent toujours avant) :
//   1. SA réponse « Non, c'est une autre paire » ⇒ N° neuf (la règle normale).
//   2. LA PHOTO QUE VRM A FABRIQUÉE pour un N° (registre `vrm_photos_vrm` : l'empreinte
//      de l'image PRODUITE par VRM — feuille guidée, kit, « Publier à la main » —,
//      le N°, l'annonce d'origine). C'est une IDENTITÉ (comme un SKU : VRM a fabriqué
//      ce fichier pour CE N°), reconnue à un seuil SÛR mesuré (`SEUIL_PHOTO_VRM`,
//      banc photos-vrm-seuil.cjs). Le N° est REPRIS tout seul et DIT une fois
//      (« N°42 reconnu par sa photo ») seulement si : un SEUL N° du registre
//      correspond, l'annonce d'origine n'est plus chez lui sur Vinted, aucune autre
//      annonce présente ne porte ce N°, aucune vente ne le porte. Sinon ⇒ proposé.
//   3. Aucune annonce de CE compte n'a disparu récemment (vue en ligne puis absente
//      d'une lecture complète, ni vendue, ni remplacée, ni déclarée partie) ⇒ N° neuf
//      tout de suite (rien ne change).
//   4. Une disparue existe : on COMPARE les photos (empreintes Vinted captées par
//      l'extension, `photo_emprunte_{uid}`, gardées par VRM pour les fiches
//      numérotées `vrm_empreintes_fiches` — l'extension efface celles d'une annonce
//      supprimée). Même photo (≤ `SEUIL_REPUB_PHOTO`) ⇒ PROPOSÉE dans Ma journée
//      (« N°42 republiée ? ») : SON clic relie (« Oui, garder N°42 ») ou donne un
//      N° neuf (« Non, c'est une autre paire »). Aucune ne correspond (toutes
//      comparées) ⇒ N° neuf. Une empreinte pas encore captée ⇒ on ATTEND, au plus
//      `ATTENTE_REPUB_MS` (24 h) depuis la première fois que VRM a vu l'annonce sans
//      N° (`vrm_republie_attente`), puis N° neuf.
//   Jamais le titre, jamais la marque ou la taille (§5) ; une ressemblance de photo
//   n'est qu'une PROPOSITION, son clic relie — sauf la photo fabriquée par VRM.
//
// Module PUR : la numérotation (App.jsx, bloc <numerotation-passage>), Ma journée et
// `scripts/audit-republie-telephone.cjs` exécutent les MÊMES fonctions (§11).
import { distanceEmpreintes, empreinteValide } from './photoEmpreinte.js';

// Proposer : la même photo passée par un autre envoi (mesuré sur claude/meme-photo,
// banc photos-comptes-seuil : réutilisée ≤ 11, une autre prise de vue de la même paire ≥ 15).
export const SEUIL_REPUB_PHOTO = 12;
// Reprendre tout seul : la photo QUE VRM A PRODUITE, recompressée par Vinted (mesuré,
// banc photos-vrm-seuil.cjs, jeu inventé : photo VRM passée par Vinted ≤ 7 ; autre photo de la même
// paire ≥ 23, autre paire ≥ 19 — 8 laisse plus du double de marge).
export const SEUIL_PHOTO_VRM = 8;
export const ATTENTE_REPUB_MS = 24 * 3600e3;
export const DISPARUE_RECENTE_MS = 14 * 86400e3;
export const MARGE_DISPARUE_MS = 5 * 60e3;
export const REGISTRE_JOURS = 60;
export const CLE_PHOTOS_VRM = 'vrm_photos_vrm';               // { [empreinte]: { n, src, uid, at } }
export const CLE_EMPREINTES_FICHES = 'vrm_empreintes_fiches'; // { [idAnnonce]: { n, h: [empreinte], uid, at } }
export const CLE_REPUB_REPONSES = 'vrm_republie_reponses';    // { [nouvelId]: { choix: 'non', anciens: [id], at } }
export const CLE_REPUB_ATTENTE = 'vrm_republie_attente';      // { [nouvelId]: iso — la première fois vue sans N° }
const EMPREINTES_PAR_FICHE = 4;

const str = (v) => String(v == null ? '' : v).trim();
const cleDefaut = (v) => { let s = str(v).toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
// Les empreintes d'une annonce (une carte { clé: hex } ou une liste), valides seulement.
export const empreintesDe = (x) => (Array.isArray(x) ? x : objet(x) ? Object.values(x) : []).filter(empreinteValide);
export function distanceMin(A, B) {
  let m = null;
  for (const a of A || []) for (const b of B || []) { const d = distanceEmpreintes(a, b); if (d != null && (m == null || d < m)) m = d; }
  return m;
}

// ── LE REGISTRE DES PHOTOS FABRIQUÉES PAR VRM ────────────────────────────────
// Ajoute les empreintes d'images PRODUITES pour un N° (jamais l'image). Purge > 60 j.
// Rend le registre à écrire, ou `null` si rien ne change.
export function ajouterAuRegistre(reg, entrees, maintenant = Date.now()) {
  const avant = objet(reg) || {};
  const out = {}; let change = false;
  const limite = maintenant - REGISTRE_JOURS * 86400e3;
  for (const [h, e] of Object.entries(avant)) { if (empreinteValide(h) && e && Date.parse(e.at || '') >= limite) out[h] = e; else change = true; }
  for (const x of Array.isArray(entrees) ? entrees : []) {
    if (!x || !empreinteValide(x.h) || !str(x.n)) continue;
    // (16 nov.) Une entrée datée (l'empreinte rangée par l'extension, `photo_vrm_{uid}`) garde SA date :
    // le registre la purge 60 jours après la photo, pas après sa recopie.
    const tx = Date.parse(str(x.at));
    if (tx && tx < limite) continue;
    const e = { n: str(x.n), src: str(x.src), uid: str(x.uid), at: new Date(tx && tx <= maintenant ? tx : maintenant).toISOString() };
    const p = out[x.h];
    if (p && p.n === e.n && p.src === e.src && p.uid === e.uid) continue;
    out[x.h] = e; change = true;
  }
  return change ? out : null;
}
// Les N° du registre que ces empreintes désignent (au seuil SÛR). Map cléN° ⇒ { numero, sources: Set, d }.
export function numerosDuRegistre(hexes, reg, { seuil = SEUIL_PHOTO_VRM, cle = cleDefaut, maintenant = Date.now() } = {}) {
  const out = new Map();
  const H = empreintesDe(hexes); const R = objet(reg) || {};
  if (!H.length) return out;
  const limite = maintenant - REGISTRE_JOURS * 86400e3;
  for (const [h, e] of Object.entries(R)) {
    if (!e || !empreinteValide(h) || !str(e.n) || !(Date.parse(e.at || '') >= limite)) continue;
    const d = distanceMin(H, [h]);
    if (d == null || d > seuil) continue;
    const k = cle(e.n);
    const x = out.get(k) || { numero: str(e.n), sources: new Set(), d };
    if (str(e.src)) x.sources.add(str(e.src));
    if (d < x.d) x.d = d;
    out.set(k, x);
  }
  return out;
}

// ── LA MÉMOIRE DES EMPREINTES DES FICHES NUMÉROTÉES ─────────────────────────
// L'extension efface l'empreinte d'une annonce sortie du dressing : VRM garde celles
// de ses fiches numérotées (au plus 4 par annonce), pour comparer après une suppression.
// `vues` : [{ id, numero, uid, hexes }] — annonces présentes numérotées dont l'empreinte est lue.
export function majEmpreintesFiches(mem, vues, maintenant = Date.now()) {
  const avant = objet(mem) || {};
  const out = { ...avant }; let change = false;
  const limite = maintenant - REGISTRE_JOURS * 86400e3;
  for (const [id, e] of Object.entries(avant)) if (!e || !(Date.parse(e.at || '') >= limite)) { delete out[id]; change = true; }
  for (const v of Array.isArray(vues) ? vues : []) {
    if (!v || v.id == null || !str(v.numero)) continue;
    const h = empreintesDe(v.hexes).slice(0, EMPREINTES_PAR_FICHE);
    if (!h.length) continue;
    const id = String(v.id), p = out[id];
    const memes = p && p.n === str(v.numero) && Array.isArray(p.h) && p.h.length === h.length && p.h.every((x, i) => x === h[i]);
    // Une fois par jour au plus (la date dit « vue récemment », pas une écriture par ouverture).
    if (memes && Date.parse(p.at || '') > maintenant - 86400e3) continue;
    out[id] = { n: str(v.numero), h, uid: str(v.uid), at: new Date(maintenant).toISOString() };
    change = true;
  }
  return change ? out : null;
}

// ── LES DISPARUES RÉCENTES D'UN COMPTE ───────────────────────────────────────
// Une fiche numérotée de CE compte, vue en ligne (`vrm_vus_en_ligne`) puis ABSENTE de la
// lecture complète `lu` (après la marge), il y a moins de 14 jours ; ni présente
// (en ligne, masquée, à confirmer, brouillon), ni vendue (prouvée), ni remplacée
// (republication connue), ni sortie (déclarée partie, vendue à la main, séparée).
export function disparuesDuCompte({ uid, fiches, presentes, vus, lu, vendue = () => false, remplacees = new Set(), sortie = () => false, reprenable = (n) => !!str(n) } = {}) {
  const u = str(uid); const out = [];
  if (!u || !Number.isFinite(Number(lu))) return out;
  const P = presentes && typeof presentes.has === 'function' ? presentes : new Set();
  for (const [id, f] of Object.entries(objet(fiches) || {})) {
    if (!f || str(f.accountId) !== u || !reprenable(f.numero)) continue;
    if (P.has(String(id)) || (remplacees && remplacees.has(String(id))) || vendue(String(id), f) || sortie(String(id), f)) continue;
    const t = Date.parse((vus && vus[id]) || '');
    if (!Number.isFinite(t) || Number(lu) < t + MARGE_DISPARUE_MS || Number(lu) - t > DISPARUE_RECENTE_MS) continue;
    out.push({ id: String(id), numero: str(f.numero), title: str(f.title), photo: f.photo || null, uid: u });
  }
  return out;
}

// ── LA DÉCISION POUR UNE NOUVELLE ANNONCE SANS N° ────────────────────────────
// action : 'neuf' (la règle normale) · 'reprendre' (photo fabriquée par VRM, sûre : `numero`,
// `source`) · 'proposer' (`candidats` : son clic) · 'attendre' (`jusqua` : ms).
// x : { id, hexes (de la nouvelle) · disparues: [{ id, numero, title, photo, hexes }] ·
//       registre · reponse (`vrm_republie_reponses[id]`) · depuis (iso) ·
//       sourcePresente(id) · numeroPresentAilleurs(cléN°) · numeroVendu(cléN°) ·
//       ficheDe(id) → { numero, title, photo } · maintenant · cle }
export function decisionRepublie(x = {}) {
  const cle = typeof x.cle === 'function' ? x.cle : cleDefaut;
  const now = Number.isFinite(x.maintenant) ? x.maintenant : Date.now();
  const rep = objet(x.reponse);
  if (rep && rep.choix === 'non') return { action: 'neuf', raison: 'reponse' };
  const H = empreintesDe(x.hexes);
  const ficheDe = typeof x.ficheDe === 'function' ? x.ficheDe : () => null;
  // 2. La photo fabriquée par VRM.
  const reg = numerosDuRegistre(H, x.registre, { cle, maintenant: now });
  if (reg.size) {
    const cands = [...reg.values()].sort((a, b) => a.d - b.d).map((r) => {
      const src = [...r.sources][0] || '';
      const f = src ? ficheDe(src) : null;
      return { id: src, numero: r.numero, title: str(f && f.title), photo: (f && f.photo) || null, d: r.d, origine: 'photo-vrm', sources: [...r.sources] };
    });
    if (cands.length === 1) {
      const c = cands[0], k = cle(c.numero);
      const presente = c.sources.some((s) => typeof x.sourcePresente === 'function' && x.sourcePresente(s));
      const ailleurs = typeof x.numeroPresentAilleurs === 'function' && x.numeroPresentAilleurs(k);
      const vendu = typeof x.numeroVendu === 'function' && x.numeroVendu(k);
      if (!presente && !ailleurs && !vendu && c.id) return { action: 'reprendre', numero: c.numero, source: c.id, origine: 'photo-vrm', d: c.d };
      return { action: 'proposer', candidats: cands, raison: presente ? 'origine-presente' : ailleurs ? 'numero-ailleurs' : vendu ? 'numero-vendu' : 'sans-origine' };
    }
    return { action: 'proposer', candidats: cands, raison: 'deux-numeros' };
  }
  // 3. Aucune disparue sur ce compte : rien ne change.
  const D = Array.isArray(x.disparues) ? x.disparues : [];
  if (!D.length) return { action: 'neuf', raison: 'aucune-disparue' };
  const depuis = Date.parse(str(x.depuis)); const t0 = Number.isFinite(depuis) ? depuis : now;
  const jusqua = t0 + ATTENTE_REPUB_MS;
  const attendre = () => (now < jusqua ? { action: 'attendre', jusqua, raison: 'empreintes' } : { action: 'neuf', raison: 'attente-finie' });
  if (!H.length) return attendre();
  // 4. La même photo qu'une disparue : proposée (son clic).
  const refuses = new Set(rep && Array.isArray(rep.anciens) ? rep.anciens.map(String) : []);
  const cands = []; let manque = false;
  for (const d of D) {
    if (refuses.has(String(d.id))) continue;
    const hd = empreintesDe(d.hexes);
    if (!hd.length) { manque = true; continue; }
    const dist = distanceMin(H, hd);
    if (dist != null && dist <= SEUIL_REPUB_PHOTO) cands.push({ id: String(d.id), numero: str(d.numero), title: str(d.title), photo: d.photo || null, d: dist, origine: 'photo' });
  }
  if (cands.length) return { action: 'proposer', candidats: cands.sort((a, b) => a.d - b.d), raison: 'meme-photo' };
  if (manque) return attendre();
  return { action: 'neuf', raison: 'photos-differentes' };
}

// L'attente (`vrm_republie_attente`) : la première fois vue sans N° ; retirée quand l'annonce a son N°.
export function majAttente(att, { attendent = [], numerotees = [] } = {}, maintenant = Date.now()) {
  const avant = objet(att) || {}; const out = { ...avant }; let change = false;
  for (const id of numerotees) if (out[String(id)]) { delete out[String(id)]; change = true; }
  for (const id of attendent) if (!out[String(id)]) { out[String(id)] = new Date(maintenant).toISOString(); change = true; }
  const limite = maintenant - 30 * 86400e3;
  for (const [id, v] of Object.entries(out)) if (!(Date.parse(v || '') >= limite)) { delete out[id]; change = true; }
  return change ? out : null;
}
