// ── LE MODE EMBALLAGE (1er nov., maquette validée par Julien) ────────────────
// Les colis « Prêts à imprimer » passés UN PAR UN : le N° en très grand, la
// photo, le nom et la taille, où est la paire, le transporteur, et trois cases
// (« paire trouvée », « emballée », « bordereau collé »). À la fin, SUR SON
// CLIC, « Marquer ces colis comme postés » — le geste existant de Colis
// (`vinted_ship_done` + `vinted_bords_shipped`), rien d'autre.
//
// ⚠️ CE MODULE NE DÉCIDE RIEN QUE L'APP N'AIT DÉJÀ DÉCIDÉ (§11) :
//   · la liste et son ORDRE sont ceux de la colonne « Prêts à imprimer »
//     (`colonnesColis`) — jamais triés par emplacement (refus du 11 octobre :
//     « imprimer la journée triée par emplacement ») ;
//   · « deux paires sous ce N° » est la règle `conflitsDeNumeros` (§5, le seul
//     rouge de l'app) ; « N° à vérifier sur son carton » est celle de
//     l'impression (`ficheAVerifier`, `reattribueAEcrire`) — fournies par
//     l'appelant, jamais réécrites ici ;
//   · l'emplacement vient du Stock (`ouDansMeubles`, puis la pièce) PAR N°.
// Module PUR (sauf la mémoire des cases, sur l'appareil) : l'écran et le banc
// `emballage.cjs` lisent les mêmes fonctions.

import { motsVendeur } from './profilVendeur.js';
export const CASES_EMBALLAGE = [
  { cle: 'trouvee', get libelle() { return `${motsVendeur().Nom} trouvé${motsVendeur().e}`; } },
  { cle: 'emballee', libelle: 'Emballée' },
  { cle: 'colle', libelle: 'Bordereau collé' },
];

// L'état du N° d'un colis : 'sans' (aucun N° relié) · 'double' (deux paires
// présentes le portent — rouge, §5) · 'a-verifier' (à vérifier sur le carton —
// ambre) · 'ok'. `o` : { cleNum, conflits: [{numero}], fiches: {id: fiche},
// aVerifier: (fiche) => bool }.
export function etatNumeroColis(num, o) {
  const cleNum = o && o.cleNum;
  const k = num != null && String(num).trim() && typeof cleNum === 'function' ? cleNum(num) : '';
  if (!k) return 'sans';
  if ((o.conflits || []).some((c) => c && cleNum(c.numero) === k)) return 'double';
  const fiches = o.fiches || {};
  if (typeof o.aVerifier === 'function' && Object.values(fiches).some((f) => f && String(f.numero == null ? '' : f.numero).trim() && cleNum(f.numero) === k && o.aVerifier(f))) return 'a-verifier';
  return 'ok';
}

// L'ordre de la séance : celui de la colonne au moment de l'ouverture ; un colis
// qui devient prêt pendant la séance s'ajoute À LA FIN (rien ne saute d'une
// place à l'autre sous ses yeux). Un colis qui n'est plus « prêt » reste dans
// l'ordre, marqué `sorti` (il n'est plus proposé au geste final).
export function ordreSeance(ordrePrecedent, colisVivants) {
  const vivants = Array.isArray(colisVivants) ? colisVivants : [];
  const ordre = Array.isArray(ordrePrecedent) ? ordrePrecedent.slice() : [];
  const vu = new Set(ordre);
  for (const c of vivants) if (c && c.cle && !vu.has(c.cle)) { ordre.push(c.cle); vu.add(c.cle); }
  return ordre;
}

export const complet = (cases) => !!cases && CASES_EMBALLAGE.every((c) => cases[c.cle] === true);

// Les colis proposés au geste final : les trois cases cochées ET toujours dans
// « Prêts à imprimer » (un colis sorti entre-temps n'est pas re-marqué).
export function aMarquerPostes(ordre, cases, colisVivants) {
  const vivants = new Set((Array.isArray(colisVivants) ? colisVivants : []).map((c) => c && c.cle));
  return (Array.isArray(ordre) ? ordre : []).filter((cle) => vivants.has(cle) && complet((cases || {})[cle]));
}

// ── LA MÉMOIRE DES CASES, SUR L'APPAREIL, LE TEMPS D'UNE SÉANCE ─────────────
// Une feuille fermée par erreur (retour, appel entrant) se rouvre là où il en
// était. Rien ne part dans le nuage : ce n'est pas une donnée, c'est un brouillon
// de geste. Une séance de plus de 12 h est oubliée ; le geste final l'efface.
export const CLE_SEANCE = 'vrm_emballage_seance';
const DUREE_SEANCE = 12 * 3600e3;
export function lireSeance(maintenant = Date.now()) {
  try {
    const s = JSON.parse(localStorage.getItem(CLE_SEANCE) || 'null');
    if (!s || typeof s !== 'object' || !Number.isFinite(s.debut) || maintenant - s.debut > DUREE_SEANCE) return { debut: maintenant, cases: {}, ordre: [] };
    return { debut: s.debut, cases: s.cases && typeof s.cases === 'object' ? s.cases : {}, ordre: Array.isArray(s.ordre) ? s.ordre : [] };
  } catch (_) { return { debut: maintenant, cases: {}, ordre: [] }; }
}
export function ecrireSeance(s) { try { localStorage.setItem(CLE_SEANCE, JSON.stringify(s)); } catch (_) {} }
export function oublierSeance() { try { localStorage.removeItem(CLE_SEANCE); } catch (_) {} }
