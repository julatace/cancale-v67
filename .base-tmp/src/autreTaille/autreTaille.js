// ════════════════════════════════════════════════════════════════════════════
//  DUPLIQUER UNE ANNONCE DANS UNE AUTRE TAILLE (14 nov., idée 157)
// ════════════════════════════════════════════════════════════════════════════
// Depuis une annonce : « Dans une autre taille » crée une fiche « À publier » —
// même modèle, mêmes textes et réglages (titre, marque, état, description, prix :
// la liste BLANCHE de « Dupliquer », src/dupliquerFiche.js), une AUTRE taille,
// AUCUNE photo (à prendre) et un N° NEUF. Ensuite le chemin d'avant : la fiche est
// dans « À publier », d'où « Créer sur Vinted » (sur SON clic) — aucune action
// nouvelle sur Vinted.
//
// ⚠️ LE N° (§5) : celui de « Dupliquer » (`dupliquerNumero` → `dupliquerFiche` →
//    `prochainLibre` sur TOUS les N° servis, réservés relus en base) : après le plus
//    haut, jamais un trou, jamais un ancien. Ce module ne choisit AUCUN numéro.
// ⚠️ L'ANCIEN N° ÉCRIT DANS LE TEXTE : l'étiquette du N° d'origine (posée par VRM
//    en bord de titre ou de description, src/etiquetteNumero.js) est RETIRÉE ; un
//    autre N° écrit au milieu du texte est SIGNALÉ (« Créer sur Vinted » refuserait
//    deux numéros) — jamais effacé en silence.
// ⚠️ LA TAILLE DANS LE TEXTE : remplacée seulement là où elle est MARQUÉE
//    (« Taille 42 », « T42 », « EU 42 », « Pointure 42 », « Size 42 ») ou en
//    DERNIER mot du titre (« Nike Dunk Low 42 ») ; un « 42 » nu ailleurs (une
//    mesure, une année, une référence) ne bouge pas. Ce qui a changé est COMPTÉ et
//    montré avant la création : il relit, il corrige.
// Module PUR : la feuille (./AutreTaille.jsx) et scripts/audit-idees-paires.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { retirerEtiquette } from '../etiquetteNumero.js';
import { numerosMarques, cleNumero } from '../numeroEcrit.js';

const str = (v) => String(v == null ? '' : v);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// La pointure d'une taille écrite : « 42 », « 42,5 », « 42.5 », « 42 1/2 », « 42 ⅔ » (« EU 42 » ⇒ « 42 »).
export function pointure(t) {
  const m = /(\d{1,2}(?:[.,]\d)?(?:\s?(?:1\/2|1\/3|2\/3|½|⅓|⅔))?)/.exec(str(t));
  return m ? m[1].trim() : '';
}
const MARQUE_TAILLE = '(?:taille|pointure|size|t\\.?|eu|fr|us|uk)';

// Remplace l'ancienne taille par la nouvelle dans un texte. Rend { texte, n }.
export function remplacerTaille(texte, ancienne, nouvelle, { titre = false } = {}) {
  const a = pointure(ancienne), b = str(nouvelle).trim();
  let t = str(texte), n = 0;
  if (!a || !b) return { texte: t, n };
  const apres = '(?![\\d]|[.,]\\d|\\s?(?:1\\/2|1\\/3|2\\/3)|[½⅓⅔])';
  const re = new RegExp(`(^|[^0-9A-Za-zÀ-ÿ])(${MARQUE_TAILLE}\\s?:?\\s?)${esc(a)}${apres}`, 'gi');
  t = t.replace(re, (m0, avant, marque) => { n++; return `${avant}${marque}${b}`; });
  if (titre && !n) {
    const fin = new RegExp(`(^|\\s)${esc(a)}\\s*$`);
    if (fin.test(t)) { t = t.replace(fin, (m0, sp) => `${sp}${b}`); n++; }
  }
  return { texte: t, n };
}

// La copie dans une autre taille, AVANT la création (aperçu, il corrige) :
// src : { titre, marque, taille, etat, description, prix } (`champsSource`) ·
// numeroOrigine : le N° de l'annonce d'origine · nouvelle : la taille voulue.
// Rend { ok, champs: { titre, taille, description }, changes: { titre, description },
//   etiquetteRetiree, autresNumeros: [clé] } ou { ok:false, raison }.
export function copieAutreTaille(src, { numeroOrigine = '', nouvelle = '' } = {}) {
  const s = src || {};
  const nv = str(nouvelle).trim().replace(/\s+/g, ' ');
  if (!nv) return { ok: false, raison: 'taille-vide' };
  if (nv.length > 20) return { ok: false, raison: 'taille-longue' };
  const ancienne = str(s.taille).trim();
  if (ancienne && nv.toLowerCase() === ancienne.toLowerCase()) return { ok: false, raison: 'meme-taille' };
  let titre = str(s.titre), description = str(s.description);
  // L'étiquette du N° d'origine (toutes ses formes, aux bords où VRM l'écrit).
  let etiquetteRetiree = 0;
  if (str(numeroOrigine).trim()) {
    const r = retirerEtiquette({ titre, description }, numeroOrigine, null, ['titre', 'description']);
    titre = r.titre; description = r.description; etiquetteRetiree = r.retire;
  }
  const t = remplacerTaille(titre, ancienne, nv, { titre: true });
  const d = remplacerTaille(description, ancienne, nv);
  const autresNumeros = [...new Set([...numerosMarques(t.texte), ...numerosMarques(d.texte)].map((x) => x.cle))];
  return { ok: true, champs: { titre: t.texte.trim(), taille: nv, description: d.texte }, changes: { titre: t.n, description: d.n }, etiquetteRetiree,
    autresNumeros, origine: cleNumero(numeroOrigine) };
}
