// ══════════════════════════════════════════════════════════════════════════════
// LA VENTE VUE PAR E-MAIL ET SON ANNONCE ENCORE « EN LIGNE » (24 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 24 nov. (trois captures) : « la vente a été détectée par les mails mais pas encore sur l'extension, donc
// l'annonce n'a pas encore été supprimée des annonces en ligne — comment on peut faire ? » Ventes disait « Autry reelwind
// low noir taille 36 · N° en attente » ; Annonces montrait encore le N° 262 « en ligne » ; la fiche disait « pas lu » trois fois.
// Récit : docs/passation/2026-11-24-vente-mail-annonce.md.
//
// Mesuré (lecture seule, vraie base, 24 nov.) : l'e-mail de vente porte la photo de l'annonce sous la forme
//   images1.vinted.net/t/{dossier}/150x210/{fichier}.jpeg?s=…   ;  l'annonce N° 262 (dressing) :
//   images1.vinted.net/tc/{dossier}/{fichier}.jpeg?s=…           — le MÊME dossier, le MÊME fichier (l'image elle-même),
// seuls le préfixe (/t/ ou /tc/), le dossier de TAILLE et la signature changent. La fiche numérotée porte déjà cette identité
// (`photoK` = « dossier/fichier »). Ce n'était donc pas la photo qui ratait : l'app REFUSAIT de relier une vente à une
// annonce que la dernière lecture du dressing montre encore en ligne (« une paire en ligne n'est pas vendue »,
// `resolvedEntry`) — vrai pour une vente LUE, faux pour une vente prouvée par e-mail AVANT la relecture du dressing.
//
// LA RÈGLE (une seule, pour Ventes, Annonces et la fiche — §11) : une annonce EN LIGNE est « vendue · par e-mail, en
// attente de Vinted » quand un e-mail de VENTE (le compte = l'adresse de RÉCEPTION, §5) la désigne par une IDENTITÉ :
//   1. SON clic « Relier à l'annonce » (`liens[cle] = { item }`) — une proposition peut venir de la ressemblance, c'est
//      son toucher qui relie ; « Délier » l'enlève (`liens[cle] = { aucun: true }` : plus rien de relié, même par la photo) ;
//   2. sinon la PHOTO EXACTE : la même image (`cleImageVinted` : dossier + fichier, jamais une ressemblance visuelle) que
//      l'annonce du MÊME compte — une seule annonce ; deux annonces à la même image ⇒ rien (pas su).
// Et seulement tant que la lecture du dressing qui la montre en ligne est PLUS ANCIENNE que l'e-mail : une lecture faite
// après l'e-mail fait foi (§5 « En ligne » — la vente a pu être annulée, l'annonce remise). Une annonce (re)numérotée
// APRÈS l'e-mail est une paire republiée : rien. Jamais par le titre, la taille ou le prix (§5) : « même avec 50 articles
// identiques », seule l'identité relie. Rien n'est supprimé : l'annonce sort des totaux « en ligne », elle reste lisible.
// Module PUR (audit : scripts/audit-vente-mail-annonce.cjs).

import { preuveVenteEmail } from './venteEmailFraiche.js';

const str = (v) => String(v == null ? '' : v).trim();
export const LIENS_VENTE_MAIL = 'vrm_vente_mail_liens';
export const STATUT_VENDUE_MAIL = 'Vendue · par e-mail, en attente de Vinted';

// L'IDENTITÉ D'UNE IMAGE VINTED : « dossier/fichier » (minuscules, sans extension) — le dossier unique de l'image et son
// fichier, sans l'hôte (images1, images…), sans le préfixe (/t/, /tc/), sans le dossier de taille (150x210, f800…), sans
// la signature. La même clé que `photoKey` (App) et que le `photoK` des fiches. Une adresse qui n'est pas une image
// d'annonce de Vinted ⇒ '' (rien de sûr).
export function cleImageVinted(photo) {
  const u = str(photo && typeof photo === 'object' ? photo.url : photo);
  const m = /^https:\/\/images\d*\.vinted\.net\/tc?\/([^?#\s"'<>]{8,400})/i.exec(u);
  if (!m) return '';
  const segs = m[1].split('/').filter(Boolean).filter((s) => !/^(f\d{2,4}|\d{2,4}x\d{2,4}|thumbnails?)$/i.test(s));
  if (segs.length !== 2) return '';
  const [dossier, fichier0] = segs;
  const fichier = fichier0.replace(/\.(jpe?g|png|webp|gif|avif)$/i, '');
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(dossier) || !/^[A-Za-z0-9_-]{6,80}$/.test(fichier)) return '';
  return (dossier + '/' + fichier).toLowerCase();
}

// UNE VENTE E-MAIL, normalisée : { cle, tx, uid, t, photo } — d'une ligne d'e-mail projetée (`requeteVentesEmail` :
// id, type, tx, uid, at, photo) ou d'une ligne de Ventes (`ventesEmailFraiches` : `_venteEmail`). La clé est celle de
// Ventes (le n° de transaction, sinon « email:{id de la ligne} »). Rien de sûr ⇒ null.
export function venteMailNormale(v) {
  if (!v || typeof v !== 'object') return null;
  if (v._venteEmail) {
    const cle = str(v.transaction_id); const uid = str(v._acc && v._acc.vinted_user_id); const t = Number(v._t);
    if (!cle || !/^\d+$/.test(uid) || !Number.isFinite(t)) return null;
    return { cle, tx: str(v._txMail), uid, t, photo: str(v.photo) };
  }
  const p = preuveVenteEmail(v);
  return p ? { cle: p.cle, tx: p.tx, uid: p.uid, t: p.t, photo: str(v.photo) } : null;
}

const msLu = (v) => (v == null || v === '' ? NaN : Number(v));   // null n'est pas l'heure 0 (« pas su »)
const tsFiche = (f) => { const t = Date.parse(str(f && (f.repriseAt || f.numberedAt))); return Number.isFinite(t) ? t : null; };

// LES ANNONCES VENDUES PAR E-MAIL.
//   ventes   : les e-mails de vente (lignes projetées et/ou lignes de Ventes) ; pas un tableau ⇒ rien (pas su) ;
//   annonces : les annonces EN LIGNE de la dernière lecture complète — [{ id, uid, photo, lu }] (`lu` : l'heure de cette
//              lecture, ms ; inconnue ⇒ l'annonce ne se relie pas : on ne sait pas si la lecture est d'avant l'e-mail) ;
//   liens    : `vrm_vente_mail_liens` (ses clics) ; fiches : `vinted_annonce_numeros` (la date du N°).
// Rend Map id d'annonce → { cle, tx, uid, t, via: 'main' | 'photo' }.
export function venduesParMail({ ventes, annonces, liens = {}, fiches = {} } = {}) {
  const out = new Map();
  if (!Array.isArray(ventes) || !Array.isArray(annonces)) return out;
  const L = liens && typeof liens === 'object' ? liens : {};
  const parCle = new Map();
  for (const v of ventes) { const n = venteMailNormale(v); if (!n) continue; const d = parCle.get(n.cle); if (!d || n.t < d.t || (!d.photo && n.photo)) parCle.set(n.cle, d ? { ...n, photo: n.photo || d.photo, t: Math.min(n.t, d.t) } : n); }
  const parId = new Map();
  for (const a of annonces) { const id = str(a && a.id); if (id && !parId.has(id)) parId.set(id, a); }
  // L'annonce peut-elle être celle de cette vente ? même compte, lue AVANT l'e-mail, pas (re)numérotée après.
  const admise = (a, n) => {
    if (!a || str(a.uid) !== n.uid) return false;
    const lu = msLu(a.lu); if (!Number.isFinite(lu) || !(lu < n.t)) return false;
    const tf = tsFiche(fiches && fiches[str(a.id)]); if (tf != null && tf > n.t) return false;
    return true;
  };
  const prises = new Map();   // id → [{ via, n }]
  const prendre = (id, via, n) => { const l = prises.get(id) || []; l.push({ via, n }); prises.set(id, l); };
  const parImage = new Map();
  for (const a of parId.values()) { const k = cleImageVinted(a.photo); if (!k) continue; const l = parImage.get(k) || []; l.push(a); parImage.set(k, l); }
  for (const n of parCle.values()) {
    const lien = L[n.cle];
    if (lien && lien.aucun) continue;                                   // « Délier » : plus rien, même par la photo
    if (lien && str(lien.item)) { const a = parId.get(str(lien.item)); if (admise(a, n)) prendre(str(a.id), 'main', n); continue; }
    const k = cleImageVinted(n.photo); if (!k) continue;
    const memes = (parImage.get(k) || []).filter((a) => str(a.uid) === n.uid);
    if (memes.length !== 1) continue;                                   // aucune, ou deux annonces à la même image : pas su
    if (admise(memes[0], n)) prendre(str(memes[0].id), 'photo', n);
  }
  for (const [id, l] of prises) {
    const mains = l.filter((x) => x.via === 'main');
    const choix = mains.length ? mains : l;
    if (choix.length !== 1) continue;                                   // deux ventes pour une annonce : rien de choisi
    const { via, n } = choix[0];
    out.set(id, { cle: n.cle, tx: n.tx, uid: n.uid, t: n.t, via });
  }
  return out;
}

// La vente → son annonce (l'inverse de `venduesParMail`).
export const annonceDeVente = (vendues) => { const m = new Map(); for (const [id, x] of (vendues || new Map())) m.set(x.cle, id); return m; };

// LES PROPOSITIONS pour « Relier à l'annonce » : les annonces en ligne du MÊME compte (l'adresse de réception décide), lues
// avant l'e-mail, pas déjà vendues par e-mail. La ressemblance (mots du titre, taille, prix) ne sert qu'à les ORDONNER —
// elle ne relie jamais (§5) : c'est son toucher. `annonces` : [{ id, uid, titre, taille, prix (nombre), photo, lu }].
const mots = (t) => new Set(str(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((m) => m.length > 1));
export function candidatsRelier(vente, annonces, { titre = '', prix = null, dejaPrises = new Set(), max = 8 } = {}) {
  const n = venteMailNormale(vente); if (!n || !Array.isArray(annonces)) return [];
  const mv = mots(titre);
  const tailleV = (/(?:taille|t\.?)\s*(\d{2}(?:[.,]5)?)/i.exec(str(titre)) || [])[1] || '';
  const out = [];
  for (const a of annonces) {
    const id = str(a && a.id); if (!id || str(a.uid) !== n.uid || dejaPrises.has(id)) continue;
    const lu = msLu(a.lu); if (!Number.isFinite(lu) || !(lu < n.t)) continue;
    const ma = mots(a.titre); let communs = 0; for (const m of mv) if (ma.has(m)) communs++;
    const tA = str(a.taille).replace(',', '.'); const memeTaille = !!(tailleV && tA && tA === tailleV.replace(',', '.'));
    const ecart = Number.isFinite(Number(prix)) && Number.isFinite(Number(a.prix)) ? Math.abs(Number(a.prix) - Number(prix)) : null;
    const score = communs * 10 + (memeTaille ? 15 : 0) + (ecart != null ? Math.max(0, 10 - ecart / 2) : 0);
    out.push({ ...a, id, _score: score });
  }
  return out.sort((x, y) => y._score - x._score || (Number(y.lu) || 0) - (Number(x.lu) || 0)).slice(0, max);
}

// Les écritures (sur SON clic seulement). Rendent un nouvel objet.
export const relierVenteMail = (liens, cle, item, at = Date.now()) => ({ ...(liens || {}), [str(cle)]: { item: str(item), at } });
export const delierVenteMail = (liens, cle, at = Date.now()) => ({ ...(liens || {}), [str(cle)]: { aucun: true, at } });
