// ═══════════════════════════════════════════════════════════════════════════
// LES ANNONCES À COMPLÉTER (10 nov., lot U) — la règle, une seule (§11)
// ═══════════════════════════════════════════════════════════════════════════
// Validé par Julien (propositions du 9 nov., n° 31) : « moins de 5 photos, taille
// ou marque absente, pas de N° — liste avec le geste ». Règles FIXES, aucune IA,
// rien envoyé à Vinted : la vue d'Annonces « À compléter » montre la photo, le
// manque NOMMÉ et le geste qui ouvre l'endroit (la page « modifier » de Vinted ;
// la saisie du prix d'achat dans VRM).
//
// ⚠️ « Pas su » ne vaut pas « manque » (§5) : un manque n'est dit que s'il est LU.
//   · photos : `nPhotos` posé par l'extension (mesuré : 681 annonces sur 683) ;
//     absent ⇒ pas su, jamais « 0 photo » (ni le « 1 » déduit de la seule photo
//     gardée par l'allègement : l'appelant ne passe que le nombre LU) ;
//   · marque / taille / état : le CHAMP doit avoir été lu dans le dressing
//     (`champsLus`, posé par `mapWardrobeItem`) ; un champ lu VIDE est un manque,
//     un champ jamais vu est « pas su » ;
//   · N° : seulement quand il numérote LUI-MÊME à la fin de la description
//     (réglage « Je numérote moi-même », source « description » cochée,
//     src/numeroEcrit.js). Sinon VRM donne lui-même le N° d'une annonce qui n'en
//     a pas (§5 (a)) : rien à compléter. La description doit avoir été LUE
//     (`numEcritDesc`) : jamais lue ⇒ pas su ;
//   · prix d'achat : celui de VRM (`prixAchatDe`, saisi par lui, §2.5) — VRM le
//     sait toujours ; absent ⇒ manque, geste « Prix d'achat » (jamais deviné).
// Fonctions PURES : scripts/audit-annonces-a-completer.cjs les exécute.
// ─────────────────────────────────────────────────────────────────────────────
import { lectureRecue } from './numeroEcrit.js';

export const MIN_PHOTOS = 5;

// L'ordre d'affichage des manques (ceux de Vinted d'abord, puis celui de VRM).
export const MANQUES = ['photos', 'marque', 'taille', 'etat', 'numero', 'achat'];
// Où se fait le geste : 'vinted' (modifier l'annonce sur le site) · 'vrm'.
export const OU_MANQUE = { photos: 'vinted', marque: 'vinted', taille: 'vinted', etat: 'vinted', numero: 'vinted', achat: 'vrm' };
// Le nom court d'un manque (une pastille), et la phrase du « pas su ».
export const NOM_MANQUE = { photos: 'photos', marque: 'Sans marque', taille: 'Sans taille', etat: 'Sans état', numero: 'Pas de N° à la fin', achat: 'Sans prix d’achat' };
export const NOM_PAS_SU = { photos: 'photos pas lues', marque: 'marque pas lue', taille: 'taille pas lue', etat: 'état pas lu', numero: 'description pas lue' };

const vide = (v) => v == null || String(v).trim() === '';
const prixDe = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const f = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(f) && f > 0 ? f : null; };

// Le texte d'un manque, tel qu'il s'affiche (court, ≤ 12 mots).
export function texteManque(m) {
  if (!m) return '';
  if (m.cle === 'photos') return `${m.n} photo${m.n > 1 ? 's' : ''} sur ${m.min}`;
  if (m.cle === 'numero' && m.ailleurs) return 'N° pas à la fin';
  if (m.cle === 'numero' && m.ambigu) return 'Deux N° écrits';
  return NOM_MANQUE[m.cle] || m.cle;
}

// UNE annonce. `a` : { nPhotos, marque, taille, etat, champsLus: { marque, taille, etat },
//   descNumero (lecture compacte de la fin de la description, ou absente), prixAchat }.
// `numeroEcrit` : vrai si le vendeur écrit son N° à la fin de la description.
// Rend { manques: [{ cle, ... }], pasSu: [cle] }.
export function manquesAnnonce(a, { minPhotos = MIN_PHOTOS, numeroEcrit = false } = {}) {
  const manques = [], pasSu = [];
  if (!a || typeof a !== 'object') return { manques, pasSu: ['photos', 'marque', 'taille', 'etat'] };
  const n = a.nPhotos;
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) { if (n < minPhotos) manques.push({ cle: 'photos', n, min: minPhotos }); }
  else pasSu.push('photos');
  const lus = a.champsLus && typeof a.champsLus === 'object' ? a.champsLus : {};
  for (const [cle, val] of [['marque', a.marque], ['taille', a.taille], ['etat', a.etat]]) {
    if (lus[cle] !== true) { pasSu.push(cle); continue; }
    if (vide(val)) manques.push({ cle });
  }
  if (numeroEcrit) {
    const l = lectureRecue(a.descNumero);
    if (!l) pasSu.push('numero');
    else if (l.etat === 'ambigu') manques.push({ cle: 'numero', ambigu: true });
    else if (l.etat === 'rien') manques.push({ cle: 'numero', ...(l.ailleurs ? { ailleurs: true } : {}) });
  }
  const p = a.prixAchat;
  if (!(typeof p === 'number' && Number.isFinite(p))) manques.push({ cle: 'achat' });
  manques.sort((x, y) => MANQUES.indexOf(x.cle) - MANQUES.indexOf(y.cle));
  return { manques, pasSu };
}

// Le lien « modifier l'annonce » sur Vinted, par son identifiant (jamais par titre).
export function lienModifier(id, domaine) {
  const d = /^[\w.-]+\.vinted\.[a-z.]+$/.test(String(domaine || '')) ? domaine : 'www.vinted.fr';
  return /^\d+$/.test(String(id || '')) ? `https://${d}/items/${id}/edit` : '';
}

// TOUTES les annonces en ligne. `annonces` : `undefined` en cours · `null` pas su
// (lecture ratée) · tableau. Rend { etat:'encours' } · { etat:'passu' } ·
// { etat:'lu', total, n, items, parManque: {cle: n}, pasSu: {cle: n} }.
// `items` : le plus récent en haut (mise en ligne), puis l'identifiant.
export function annoncesACompleter(annonces, opts = {}) {
  if (annonces === undefined) return { etat: 'encours' };
  if (!Array.isArray(annonces)) return { etat: 'passu' };
  const items = [], parManque = {}, pasSu = {}, vus = new Set();
  let total = 0;
  for (const a of annonces) {
    if (!a || a.id == null) continue;
    const id = String(a.id);
    if (vus.has(id)) continue;
    vus.add(id); total++;
    const r = manquesAnnonce(a, opts);
    for (const k of r.pasSu) pasSu[k] = (pasSu[k] || 0) + 1;
    if (!r.manques.length) continue;
    for (const m of r.manques) parManque[m.cle] = (parManque[m.cle] || 0) + 1;
    items.push({
      id, titre: String(a.titre || ''), photo: String(a.photo || ''), num: String(a.num || ''), compte: String(a.compte || ''),
      prix: prixDe(a.prix), ts: Number(a.ts) || 0, manques: r.manques,
      vinted: r.manques.some((m) => OU_MANQUE[m.cle] === 'vinted'), achat: r.manques.some((m) => m.cle === 'achat'),
      lien: lienModifier(id, a.domaine),
    });
  }
  items.sort((x, y) => (y.ts - x.ts) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return { etat: 'lu', total, n: items.length, items, parManque, pasSu };
}
