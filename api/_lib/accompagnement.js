// ── LES GROUPES D'ACCOMPAGNEMENT, CÔTÉ SERVEUR (5 nov.) ──────────────────────
// Migration 025 (supabase/migrations/025-communaute-accompagnement.sql), PAS
// APPLIQUÉE tant que Julien ne l'a pas collée. Toutes les garanties vivent dans
// la BASE (identité tirée du jeton, validation par le créateur, partage choisi
// par le membre, effacé à la révocation). Cette route RELAIE, avec le JETON DE
// L'APPELANT (jamais la clé de service), dans la fonction existante
// `api/compte.js?mode=communaute` (12 fonctions au plus : aucune nouvelle) :
//   POST { action: 'accomp-lire' }                         → { ok, accomp }
//   POST { action: 'accomp-apercu', code }                 → ce qu'on rejoint, AVANT de demander
//   POST { action: 'accomp-creer', nom, description, createur }
//   POST { action: 'accomp-demander', code, nom, partage } (partage absent ⇒ « rien »)
//   POST { action: 'accomp-decider', membre, oui }         (le créateur)
//   POST { action: 'accomp-retirer', membre }              (le créateur)
//   POST { action: 'accomp-code' | 'accomp-fermer', groupe } (le créateur)
//   POST { action: 'accomp-quitter', adhesion }            (le membre)
//   POST { action: 'accomp-partage', adhesion, partage }   (le membre, révocable)
//   POST { action: 'accomp-vu', adhesion }                 (le membre : ce que voit le créateur)
//   POST { action: 'accomp-publier', chiffres, detail }    (l'app du membre : SES agrégats)
// TROIS ÉTATS, JAMAIS DEUX : 200 lu/fait · 503 `non-installe` (la 025 n'est pas
// appliquée : l'écran le dit et ne promet rien) · 503 `pas-su` (la base n'a pas
// répondu : rien n'est affirmé) · 4xx un refus RÉEL, dit en clair.
import { rpcEquipe } from './equipe.js';
import { sbCle } from './cle.js';

export const ACCOMP_NON_INSTALLE = "Les groupes d'accompagnement ne sont pas encore activés sur ta base.";
const PAS_SU = "Je n'ai pas pu joindre la base — rien n'a changé. Réessaie dans un instant.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PARTAGES = ['rien', 'chiffres', 'detail'];
export const codeLu = (x) => String(x || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
const POIDS_MAX = 262144;

export const RAISONS_ACCOMP = {
  session: 'Connecte-toi à VRM pour faire ça.',
  abonnement: "Ton abonnement n'est pas actif : les groupes sont fermés pour l'instant.",
  'nom-groupe': 'Le nom du groupe fait de 2 à 60 caractères, sans « @ ».',
  description: 'La description fait 500 caractères au plus, sans « < » ni « > ».',
  nom: 'Ton nom dans le groupe fait de 2 à 40 caractères, sans « @ » (jamais ton adresse email).',
  code: "Ce code ne correspond à aucun groupe ouvert. Vérifie-le (8 caractères), ou demande le nouveau lien au créateur.",
  partage: 'Choisis ce que tu partages : rien, tes chiffres, ou tes chiffres et le détail.',
  soi: "C'est ton propre groupe : tu en es le créateur.",
  'trop-crees': 'Tu as déjà 5 groupes ouverts : ferme-en un d’abord.',
  'trop-groupes': 'Tu es déjà dans 20 groupes (ou en attente) : quittes-en un d’abord.',
  'trop-demandes': 'Ce groupe a déjà 100 demandes en attente : réessaie quand le créateur les aura traitées.',
  'groupe-plein': 'Ce groupe a déjà 200 membres.',
  'pas-createur': 'Seule la personne qui a créé le groupe peut faire ça.',
  etat: 'Cette demande a déjà été traitée.',
  adhesion: "Tu ne fais pas (ou plus) partie de ce groupe.",
  'rien-a-partager': "Tu ne partages rien dans tes groupes : rien n'est envoyé.",
  forme: "Ces chiffres n'ont pas la forme attendue : rien n'a été rangé.",
  'trop-lourd': 'Trop de lignes à partager : rien n’a été rangé.',
};

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

export async function routeAccompagnement(req, res, { corps, qui, action }) {
  const dire = (code, c) => res.status(code).json(c);
  const nonInstalle = () => dire(503, { ok: false, erreur: 'non-installe', message: ACCOMP_NON_INSTALLE });
  const pasSu = () => dire(503, { ok: false, erreur: 'pas-su', message: PAS_SU });
  const refus = (raison, code = 400) => dire(raison === 'session' ? 401 : raison === 'abonnement' ? 403 : code,
    { ok: false, erreur: raison, message: RAISONS_ACCOMP[raison] || `La base a refusé (${raison}).` });
  const c = corps || {};
  const uuid = (k, raison) => { const v = String(c[k] || ''); return UUID_RE.test(v) ? v : (refus(raison, 404), null); };

  // Les lectures : la forme est vérifiée, jamais supposée.
  if (action === 'accomp-lire' || action === 'accomp-vu') {
    let nom = 'vrm_accomp_lire', args = {};
    if (action === 'accomp-vu') { const a = uuid('adhesion', 'adhesion'); if (!a) return; nom = 'vrm_accomp_ce_que_voit'; args = { p_adhesion: a }; }
    const r = await rpcEquipe(nom, args, qui);
    if (r.etat === 'absent') return nonInstalle();
    if (r.etat !== 'ok') return pasSu();
    const d = objet(r.data);
    if (!d) return refus('session');
    if (d.acces === false) return refus('abonnement');
    if (action === 'accomp-vu') {
      if (d.erreur === 'adhesion') return refus('adhesion', 404);
      return objet(d.vue) ? dire(200, { ok: true, vue: d.vue }) : pasSu();
    }
    if (!Array.isArray(d.crees) || !Array.isArray(d.rejoints)) return pasSu();
    return dire(200, { ok: true, accomp: { crees: d.crees, rejoints: d.rejoints, niveau: Number(d.niveau) || 0, publie: objet(d.publie) } });
  }

  let nom, args;
  if (action === 'accomp-apercu') {
    const code = codeLu(c.code); if (!CODE_RE.test(code)) return refus('code', 404);
    nom = 'vrm_accomp_apercu'; args = { p_code: code };
  } else if (action === 'accomp-creer') {
    const n = String(c.nom || '').trim(), d = String(c.description || '').trim(), q = String(c.createur || '').trim();
    if (n.length < 2 || n.length > 60 || /[@<>]/.test(n)) return refus('nom-groupe');
    if (d.length > 500 || /[<>]/.test(d)) return refus('description');
    if (q.length < 2 || q.length > 40 || /[@<>]/.test(q)) return refus('nom');
    nom = 'vrm_accomp_creer'; args = { p_nom: n, p_description: d, p_createur: q };
  } else if (action === 'accomp-demander') {
    const code = codeLu(c.code); if (!CODE_RE.test(code)) return refus('code', 404);
    const q = String(c.nom || '').trim(); if (q.length < 2 || q.length > 40 || /[@<>]/.test(q)) return refus('nom');
    // PAR DÉFAUT RIEN : un partage absent ou inconnu n'est jamais « élargi ».
    const p = c.partage == null ? 'rien' : String(c.partage);
    if (!PARTAGES.includes(p)) return refus('partage');
    nom = 'vrm_accomp_demander'; args = { p_code: code, p_nom: q, p_partage: p };
  } else if (action === 'accomp-decider' || action === 'accomp-retirer') {
    const m = uuid('membre', 'pas-createur'); if (!m) return;
    nom = action === 'accomp-decider' ? 'vrm_accomp_decider' : 'vrm_accomp_retirer';
    args = action === 'accomp-decider' ? { p_membre: m, p_oui: c.oui === true } : { p_membre: m };
  } else if (action === 'accomp-code' || action === 'accomp-fermer') {
    const g = uuid('groupe', 'pas-createur'); if (!g) return;
    nom = action === 'accomp-code' ? 'vrm_accomp_code' : 'vrm_accomp_fermer'; args = { p_groupe: g };
  } else if (action === 'accomp-quitter' || action === 'accomp-partage') {
    const a = uuid('adhesion', 'adhesion'); if (!a) return;
    if (action === 'accomp-quitter') { nom = 'vrm_accomp_quitter'; args = { p_adhesion: a }; }
    else {
      const p = String(c.partage || ''); if (!PARTAGES.includes(p)) return refus('partage');
      nom = 'vrm_accomp_partage'; args = { p_adhesion: a, p_partage: p };
    }
  } else if (action === 'accomp-publier') {
    const ch = c.chiffres == null ? null : objet(c.chiffres), de = c.detail == null ? null : objet(c.detail);
    if ((c.chiffres != null && !ch) || (c.detail != null && !de)) return refus('forme');
    if (JSON.stringify(ch || '').length + JSON.stringify(de || '').length > POIDS_MAX) return refus('trop-lourd', 413);
    nom = 'vrm_accomp_publier'; args = { p_chiffres: ch, p_detail: de };
  } else return dire(400, { ok: false, erreur: 'action', message: 'Action inconnue.' });

  const r = await rpcEquipe(nom, args, qui);
  if (r.etat === 'absent') return nonInstalle();
  if (r.etat !== 'ok' || !objet(r.data)) return pasSu();
  if (r.data.ok !== true) {
    const raison = String(r.data.raison || 'inconnue');
    return refus(raison, raison === 'code' || raison === 'adhesion' ? 404 : raison === 'trop-lourd' ? 413 : 409);
  }
  const { ok: _ok, ...reste } = r.data;
  return dire(200, { ok: true, ...reste });
}

// « Fermer mon compte » (clé de service) : nombre de lignes détachées, 0 si la
// base n'a pas la 025, `null` si la base n'a pas répondu.
export async function effacerAccompagnement(owner, SERVICE) {
  if (!UUID_RE.test(String(owner || '')) || !SERVICE) return null;
  const r = await rpcEquipe('vrm_accomp_effacer', { p_owner: owner }, sbCle(SERVICE));
  if (r.etat === 'absent') return 0;
  if (r.etat !== 'ok') return null;
  const n = Number(r.data);
  return Number.isFinite(n) ? n : null;
}
