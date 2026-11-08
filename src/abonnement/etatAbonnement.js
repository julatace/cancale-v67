// ═══════════════════════════════════════════════════════════════════════════
// L'ABONNEMENT, LU DU SERVEUR — UNE règle d'affichage (8 nov., « abonnement
// propre »). Julien : « des vendeurs vont payer — fais tout ».
// ═══════════════════════════════════════════════════════════════════════════
// Le SERVEUR décide (api/compte.js `mode=abonnement`, la base `vrm_acces`) ;
// ici on traduit sa réponse en UN état d'écran, partagé par la page Abonnement,
// la ligne de la coque (J-3, J-1) et la porte. Rien n'est recalculé de l'accès :
// `acces` et `lecture` viennent de la base.
//
//   chargement · pas-su · proprietaire · non-branche · sans · essai ·
//   essai-resilie · actif · resilie · impaye · expire
//
// À l'EXPIRATION (essai fini sans paiement, abonnement arrêté, impayé > 14 j,
// quand l'abonnement est obligatoire) : la base laisse LIRE (migration 027,
// `lecture: true`) et refuse d'écrire. L'app passe alors en LECTURE SEULE :
// tout reste visible, et une garde (ci-dessous) refuse les écritures sans
// réseau, avec une phrase. Sans la 027 (`lecture` absent), la base ferme aussi
// la lecture : l'ancienne porte reste, pour ne jamais montrer une app vide.
// ═══════════════════════════════════════════════════════════════════════════

export const JOUR_MS = 86400000;

// Jours entiers restants avant `finIso` (arrondi au-dessus) ; `null` = pas su.
export function joursAvant(finIso, maintenant = Date.now()) {
  const t = Date.parse(finIso || '');
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - maintenant) / JOUR_MS));
}

const dateCourte = (iso) => {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }); } catch (_) { return ''; }
};
export const dansJours = (j) => j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : `dans ${j} jours`;

const STATUTS_TERMINES = new Set(['canceled', 'incomplete_expired', 'incomplete', 'paused']);

export function etatAbonnement(x, maintenant = Date.now()) {
  if (x === undefined) return { etat: 'chargement' };
  if (!x || typeof x !== 'object') return { etat: 'pas-su' };
  const lectureSeule = x.acces === false && x.lecture === true;
  const prixAbo = x.prixAbonnement && typeof x.prixAbonnement.texte === 'string' && x.prixAbonnement.texte.trim() ? x.prixAbonnement.texte.trim() : null;
  const base = { lectureSeule, acces: x.acces, prixAbonnement: prixAbo, finPeriode: x.finPeriode || null };
  if (x.proprietaire) return { ...base, etat: 'proprietaire', lectureSeule: false };
  const statut = String(x.statut || '');
  if (statut === 'trialing') {
    const jours = joursAvant(x.finPeriode, maintenant);
    return { ...base, etat: x.annuleFinPeriode ? 'essai-resilie' : 'essai', jours, finLe: x.finPeriode ? dateCourte(x.finPeriode) : '' };
  }
  if (statut === 'active') return { ...base, etat: x.annuleFinPeriode ? 'resilie' : 'actif', finLe: x.finPeriode ? dateCourte(x.finPeriode) : '' };
  if (statut === 'past_due' || statut === 'unpaid') return { ...base, etat: x.acces === false ? 'expire' : 'impaye', impaye: true };
  // Plus d'abonnement vivant : expiré seulement si la BASE le dit (obligatoire).
  if (x.acces === false) return { ...base, etat: 'expire', ancien: STATUTS_TERMINES.has(statut) || !!x.peutGerer };
  if (x.configure === false) return { ...base, etat: 'non-branche' };
  return { ...base, etat: 'sans' };
}

// La ligne discrète de la coque : à J-3 et J-1 de la fin de l'essai (et le
// dernier jour). `null` en dehors : rien à dire. `seuil` sert à la fermer
// pour la journée sans la cacher au seuil suivant.
export function rappelEssai(e) {
  if (!e || (e.etat !== 'essai' && e.etat !== 'essai-resilie') || !Number.isInteger(e.jours) || e.jours > 3) return null;
  const seuil = e.jours <= 1 ? 'j1' : 'j3';
  const quand = dansJours(e.jours);
  const texte = e.etat === 'essai-resilie'
    ? `Ton essai gratuit se termine ${quand}. Rien ne sera prélevé : tu l'as résilié.`
    : `Ton essai gratuit se termine ${quand}${e.finLe ? ` (le ${e.finLe})` : ''} : ${e.prixAbonnement ? `ensuite ${e.prixAbonnement}` : "ensuite l'abonnement démarre"}, sauf si tu résilies avant.`;
  return { seuil, jours: e.jours, texte };
}

// ── LA GARDE D'ÉCRITURE EN LECTURE SEULE ────────────────────────────────────
// La base refuse déjà (RLS, `with check`). La garde évite de lancer pour rien
// des écritures vouées au refus, et rend un refus LISIBLE (code
// `vrm-lecture-seule`) au lieu d'un 403 muet. Seules les écritures vers la base
// (REST et stockage) sont visées ; les lectures, les fonctions `rpc/` et nos
// routes `/api/` (dont le paiement) passent.
export const CODE_LECTURE_SEULE = 'vrm-lecture-seule';
export const PHRASE_LECTURE_SEULE = "Lecture seule : ton abonnement n'est plus actif. Tes données sont là ; abonne-toi pour enregistrer à nouveau.";
const ECRITURES = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
export function estEcritureBase(url, methode, base) {
  const b = String(base || '').replace(/\/+$/, '');
  const u = String(url || '');
  if (!b || u.indexOf(b) !== 0 || !ECRITURES.has(String(methode || 'GET').toUpperCase())) return false;
  const reste = u.slice(b.length);
  if (/^\/rest\/v1\/rpc\//.test(reste)) return false;
  return /^\/rest\/v1\//.test(reste) || /^\/storage\/v1\/object\//.test(reste);
}
export function creerGardeEcriture(fetchOrig, base, estActive) {
  return function (input, init) {
    const url = typeof input === 'string' ? input : (input && typeof input.url === 'string' ? input.url : (typeof URL !== 'undefined' && input instanceof URL ? input.href : ''));
    const methode = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
    if (estActive() && estEcritureBase(url, methode, base)) {
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vrm:lecture-seule')); } catch (_) {}
      return Promise.resolve(new Response(JSON.stringify({ code: CODE_LECTURE_SEULE, message: PHRASE_LECTURE_SEULE }), { status: 403, headers: { 'content-type': 'application/json' } }));
    }
    return fetchOrig(input, init);
  };
}
let _lectureSeule = false;
export const lectureSeuleActive = () => _lectureSeule;
export function poserLectureSeule(v) { _lectureSeule = v === true; }
export function installerGardeEcriture(base) {
  try {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.__vrmGardeLectureSeule) return;
    window.fetch = creerGardeEcriture(window.fetch.bind(window), base, lectureSeuleActive);
    window.__vrmGardeLectureSeule = true;
  } catch (_) {}
}

// ── LA DERNIÈRE RÉPONSE DU SERVEUR, PARTAGÉE (porte → coque → page) ─────────
let _abo; const _ecoutes = new Set();
export function publierAbonnement(x) {
  _abo = x;
  const e = etatAbonnement(x);
  poserLectureSeule(e.lectureSeule === true);
  _ecoutes.forEach((f) => { try { f(x); } catch (_) {} });
}
export const abonnementPublie = () => _abo;
export function suivreAbonnement(f) { _ecoutes.add(f); return () => _ecoutes.delete(f); }

// ── PARRAINAGE : le code du lien (?parrain=XXXX), gardé jusqu'à l'inscription ─
export const CLE_PARRAIN = 'vrm_parrain_code';
export const CODE_PARRAIN_RE = /^[A-HJ-NP-Z2-9]{8}$/;
export function codeParrainDe(search) {
  try {
    const c = String(new URLSearchParams(search || '').get('parrain') || '').trim().toUpperCase();
    return CODE_PARRAIN_RE.test(c) ? c : '';
  } catch (_) { return ''; }
}
export const lienParrainage = (code) => (CODE_PARRAIN_RE.test(String(code || '')) ? `https://vrm.center/?parrain=${code}` : '');
