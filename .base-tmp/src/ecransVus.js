// ── « NOUVEAU » SUR LES ÉCRANS PAS ENCORE OUVERTS (14 nov., accueil des nouveaux, n° 138) ──
// Julien : un badge « Nouveau » sur les écrans qu'un nouveau compte n'a pas encore
// ouverts ; il disparaît à la première visite.
//
//   · PAR COMPTE VRM : la liste des écrans vus est dans la ligne `main` du compte
//     (`vrm_ecrans_vus`, SYNC_KEYS) — vu sur l'iPhone, vu sur l'ordinateur.
//   · SEULEMENT POUR UN COMPTE NEUF : la première fois que la liste manque (nuage lu),
//     un compte créé il y a moins de `JOURS_COMPTE_NEUF` jours la commence (l'écran
//     ouvert y est déjà) ; un compte plus ancien est noté `installe` — il ne voit
//     JAMAIS un badge (un vendeur installé n'est pas interrompu). Date de création
//     illisible ⇒ installé (« pas su » ne montre rien).
//   · JAMAIS SUR UNE PASTILLE QUI PORTE DÉJÀ UN NOMBRE (un geste à faire passe avant) ;
//     un point déjà posé (messages non lus) reste le point.
//   · Seulement les écrans de `ECRANS_NOUVEAUX` : un groupe (« Paires » de la barre du
//     bas), une vue ou une entrée qui n'est pas un écran n'en porte jamais.
// JS pur : `scripts/audit-accueil-nouveaux.cjs` l'exécute. Le branchement (lecture,
// écriture, abonnement) est posé par l'app (`poserStockageEcransVus`).

export const CLE_ECRANS_VUS = 'vrm_ecrans_vus';
export const JOURS_COMPTE_NEUF = 30;
export const ECRANS_NOUVEAUX = Object.freeze(['journee', 'ventes', 'annonces', 'achats', 'messages', 'garage', 'emails', 'compta', 'communaute']);

export function lireEcransVus(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  if (!o || o.v !== 1) return null;
  const vus = {};
  if (o.vus && typeof o.vus === 'object') for (const [k, v] of Object.entries(o.vus)) if (ECRANS_NOUVEAUX.includes(k) && typeof v === 'string') vus[k] = v;
  return { v: 1, depuis: typeof o.depuis === 'string' ? o.depuis : null, installe: o.installe === true, vus };
}

// La liste qu'il faut écrire la première fois (rien d'écrit ⇒ `null`).
// `creeLe` : la date de création du compte VRM (session) ; `ecran` : celui qui est ouvert.
export function premiereListe(brut, { creeLe, ecran, maintenant = Date.now() } = {}) {
  if (lireEcransVus(brut)) return null;
  const at = new Date(maintenant).toISOString();
  const t = Date.parse(creeLe || '');
  const neuf = Number.isFinite(t) && t <= maintenant + 60000 && maintenant - t < JOURS_COMPTE_NEUF * 86400000;
  if (!neuf) return { v: 1, depuis: at, installe: true, vus: {} };
  return { v: 1, depuis: at, installe: false, vus: ECRANS_NOUVEAUX.includes(ecran) ? { [ecran]: at } : {} };
}

// L'écran `ecran` vient d'être ouvert : la liste à écrire, ou `null` si rien ne change.
export function marquerVu(brut, ecran, maintenant = Date.now()) {
  const l = lireEcransVus(brut);
  if (!l || l.installe || !ECRANS_NOUVEAUX.includes(ecran) || l.vus[ecran]) return null;
  return { ...l, vus: { ...l.vus, [ecran]: new Date(maintenant).toISOString() } };
}

// L'écran porte-t-il « Nouveau » ? Liste absente (pas encore lue, ou pas encore commencée) ⇒ non.
export function estNouveau(brut, ecran) {
  const l = lireEcransVus(brut);
  return !!(l && !l.installe && ECRANS_NOUVEAUX.includes(ecran) && !l.vus[ecran]);
}

// La pastille d'une entrée de navigation : un nombre (> 0) ou le point gardent leur place ;
// sinon « nouveau » quand l'écran n'a jamais été ouvert.
export function badgeAvecNouveau(v, nouveau) {
  if (typeof v === 'number' && v > 0) return v;
  if (v === true) return true;
  return nouveau ? 'nouveau' : v;
}

// ── Le branchement (posé par l'app) ─────────────────────────────────────────
let lecteur = () => null;
const abonnes = new Set();
export function poserStockageEcransVus(lire) { if (typeof lire === 'function') lecteur = lire; signalerEcransVus(); }
export const ecransVusRanges = () => { try { return lecteur(); } catch (_) { return null; } };
export const ecranNouveau = (ecran) => estNouveau(ecransVusRanges(), ecran);
export function signalerEcransVus() { [...abonnes].forEach((f) => { try { f(); } catch (_) {} }); }
export function abonnerEcransVus(f) { abonnes.add(f); return () => abonnes.delete(f); }
