// ── CE QUE VRM A FAIT PENDANT TON ESSAI (14 nov., idée d'accueil 145) ────────
// Dans l'app (Ma journée, en bas, et Paramètres → Abonnement) : colis suivis,
// bordereaux imprimés, temps gagné, jours d'essai restants.
//
// ⚠️ Des chiffres PROUVÉS seulement (§5) :
//   · l'essai : `statut === 'trialing'` et `finEssai` lus du serveur (api/compte.js,
//     `abonnements` écrit par le webhook Stripe signé). Le début = la fin − 7 jours
//     (la durée des CGV, `DUREE_ESSAI_JOURS` d'api/_lib/relances-essai.js) ; rien d'autre
//     n'est deviné. Pas en essai, ou pas su ⇒ la carte n'existe pas ;
//   · bordereaux imprimés : les dates de `vinted_bords_printed` (posées au geste
//     « imprimé », par n° de transaction) comprises dans l'essai — une entrée sans date
//     lisible ne compte pas ;
//   · colis suivis : les n° de suivi DISTINCTS (normalisés) lus dans un e-mail reçu
//     pendant l'essai (`email_track_*`, `meta->>receivedAt`) ; lecture ratée ⇒ `null` (« — ») ;
//   · temps gagné : une ESTIMATION, dite comme telle, avec SA règle : les durées de
//     référence de la page d'accueil (src/accueil/tempsGagne.js, `GESTES` « bordereaux » et
//     « suivi » : sans − avec VRM, par unité), arrondie (à la minute sous 5 min, sinon à
//     5 min). Un nombre pas su n'entre pas dans le total ; il est dit « au moins ».
// JS pur : scripts/audit-accueil-reste.cjs l'exécute.
import { GESTES } from '../accueil/tempsGagne.js';

export const DUREE_ESSAI_JOURS = 7;
const JOUR_MS = 86400000;
const geste = (id) => GESTES.find((g) => g.id === id) || { sans: 0, avec: 0 };
export const SECONDES_PAR = Object.freeze({ bordereau: geste('bordereaux').sans - geste('bordereaux').avec, colis: geste('suivi').sans - geste('suivi').avec });

// La période d'essai lue, ou null (pas en essai, pas su).
export function periodeEssai(abo, maintenant = Date.now()) {
  if (!abo || typeof abo !== 'object' || abo.statut !== 'trialing') return null;
  const fin = Date.parse(abo.finEssai || '');
  if (!Number.isFinite(fin)) return null;
  const debut = fin - DUREE_ESSAI_JOURS * JOUR_MS;
  const restants = Math.max(0, Math.ceil((fin - maintenant) / JOUR_MS));
  return { debut, fin, restants };
}

// Les bordereaux imprimés dans la période : { tx: iso } → nombre.
export function bordereauxImprimes(imprimes, { debut, fin }) {
  if (!imprimes || typeof imprimes !== 'object') return null;
  let n = 0;
  for (const v of Object.values(imprimes)) { const t = Date.parse(typeof v === 'string' ? v : ''); if (Number.isFinite(t) && t >= debut && t <= fin) n++; }
  return n;
}

// Les colis suivis : lignes projetées [{ suivi, at }] (`null` = lecture ratée).
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function colisSuivis(lignes, { debut, fin }) {
  if (!Array.isArray(lignes)) return null;
  const vus = new Set();
  for (const l of lignes) { const t = Date.parse((l && l.at) || ''); const k = norm(l && l.suivi); if (k.length >= 6 && Number.isFinite(t) && t >= debut && t <= fin) vus.add(k); }
  return vus.size;
}

// L'arrondi d'une estimation (jamais une précision qu'elle n'a pas).
export const arrondiMinutes = (s) => { const m = s / 60; return m < 5 ? Math.round(m) : Math.round(m / 5) * 5; };

// Le bilan : { restants, bordereaux, colis, minutes, partiel } ou null (pas en essai).
export function bilanEssai({ abo, imprimes, suivis, maintenant = Date.now() } = {}) {
  const p = periodeEssai(abo, maintenant);
  if (!p) return null;
  const fenetre = { debut: p.debut, fin: Math.min(p.fin, maintenant) };
  const bordereaux = bordereauxImprimes(imprimes, fenetre);
  const colis = colisSuivis(suivis, fenetre);
  const s = (Number.isInteger(bordereaux) ? bordereaux * SECONDES_PAR.bordereau : 0) + (Number.isInteger(colis) ? colis * SECONDES_PAR.colis : 0);
  return { restants: p.restants, fin: p.fin, bordereaux, colis, minutes: arrondiMinutes(s), partiel: !Number.isInteger(bordereaux) || !Number.isInteger(colis) };
}
