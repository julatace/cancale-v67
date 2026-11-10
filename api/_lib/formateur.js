// ── LA COMMUNAUTÉ POUR LES FORMATEURS, CÔTÉ SERVEUR (10 nov., lot AR) ─────────
// Migration 031 (supabase/migrations/031-communaute-formateurs.sql), PAS
// APPLIQUÉE tant que Julien ne l'a pas collée. Elle s'appuie sur la 025 (les
// groupes d'accompagnement) sans la changer. Toutes les garanties vivent dans la
// BASE (identité tirée du jeton, page publique seulement publiée, étapes d'un
// élève visibles seulement avec SON accord, aucun chiffre d'élève). Cette route
// RELAIE, avec le JETON DE L'APPELANT (jamais la clé de service), dans la
// fonction existante `api/compte.js` (12 fonctions au plus : aucune nouvelle) :
//   ?mode=communaute, POST { action: 'form-lire' }                       → { ok, form }
//   POST { action: 'form-page', adresse }                                 (aperçu de SA page, connecté)
//   POST { action: 'form-page-ranger', adresse, nom, presentation, publiee }
//   POST { action: 'form-vitrine', groupe, montre }                       (le formateur)
//   POST { action: 'form-demander', adresse, groupe, nom, partage }       (partage absent ⇒ « rien »)
//   POST { action: 'form-etape', groupe, titre } · { action: 'form-etape-retirer', etape }
//   POST { action: 'form-annonce', groupe, texte } · { action: 'form-annonce-retirer', annonce }
//   POST { action: 'form-cocher', adhesion, etape, fait }                 (l'élève)
//   POST { action: 'form-accord', adhesion, etapes }                      (l'élève, révocable)
//   ?mode=formateur&f=<adresse>, GET SANS session : la page PUBLIQUE (clé publique,
//   la base ne rend que nom, présentation, groupes montrés).
// TROIS ÉTATS : 200 lu/fait · 503 `non-installe` (la 031 n'est pas appliquée) ·
// 503 `pas-su` (la base n'a pas répondu) · 4xx un refus RÉEL, dit en clair.
import { rpcEquipe } from './equipe.js';
import { sbCle } from './cle.js';
import { PARTAGES } from './accompagnement.js';

export const FORM_NON_INSTALLE = "L'espace formateur n'est pas encore activé sur ta base.";
const PAS_SU = "Je n'ai pas pu joindre la base — rien n'a changé. Réessaie dans un instant.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Une adresse de page : 3 à 30 caractères, minuscules, chiffres, tirets (jamais au bord, jamais « -- »).
export const ADRESSE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const adresseLue = (x) => String(x || '').trim().toLowerCase();
export const adresseOk = (a) => ADRESSE_RE.test(a) && !a.includes('--');

export const RAISONS_FORM = {
  session: 'Connecte-toi à VRM pour faire ça.',
  abonnement: "Ton abonnement n'est pas actif : l'espace formateur est fermé pour l'instant.",
  adresse: 'L’adresse fait 3 à 30 caractères : lettres minuscules, chiffres, tirets.',
  'adresse-prise': 'Cette adresse est déjà prise : choisis-en une autre.',
  nom: 'Ton nom fait de 2 à 40 caractères, sans « @ ».',
  presentation: 'La présentation fait 600 caractères au plus, sans « < » ni « > ».',
  page: "Cette page n'existe pas, ou elle n'est plus en ligne.",
  'pas-createur': 'Seule la personne qui a créé le groupe peut faire ça.',
  titre: 'Une étape fait de 2 à 80 caractères, sans « < » ni « > ».',
  'trop-etapes': '30 étapes au plus par groupe.',
  texte: 'Une annonce fait de 1 à 1 000 caractères.',
  'plafond-annonces': '10 annonces par jour au plus : réessaie demain.',
  adhesion: "Tu ne fais pas (ou plus) partie de ce groupe.",
  etape: "Cette étape n'est plus au programme.",
  soi: "C'est ton propre groupe : tu en es le créateur.",
  partage: 'Choisis ce que tu partages : rien, tes chiffres, ou tes chiffres et le détail.',
  code: "Ce groupe n'est plus ouvert.",
  'trop-groupes': 'Tu es déjà dans 20 groupes (ou en attente) : quittes-en un d’abord.',
  'trop-demandes': 'Ce groupe a déjà 100 demandes en attente.',
};

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

export async function routeFormateur(req, res, { corps, qui, action }) {
  const dire = (code, c) => res.status(code).json(c);
  const nonInstalle = () => dire(503, { ok: false, erreur: 'non-installe', message: FORM_NON_INSTALLE });
  const pasSu = () => dire(503, { ok: false, erreur: 'pas-su', message: PAS_SU });
  const refus = (raison, code = 400) => dire(raison === 'session' ? 401 : raison === 'abonnement' ? 403 : code,
    { ok: false, erreur: raison, message: RAISONS_FORM[raison] || `La base a refusé (${raison}).` });
  const c = corps || {};
  const uuid = (k, raison) => { const v = String(c[k] || ''); return UUID_RE.test(v) ? v : (refus(raison, 404), null); };

  if (action === 'form-lire') {
    const r = await rpcEquipe('vrm_form_lire', {}, qui);
    if (r.etat === 'absent') return nonInstalle();
    if (r.etat !== 'ok') return pasSu();
    const d = objet(r.data);
    if (!d) return refus('session');
    if (d.acces === false) return refus('abonnement');
    if (!Array.isArray(d.crees) || !Array.isArray(d.rejoints)) return pasSu();
    return dire(200, { ok: true, form: { page: objet(d.page), crees: d.crees, rejoints: d.rejoints } });
  }

  let nom, args;
  if (action === 'form-page') {
    const a = adresseLue(c.adresse); if (!adresseOk(a)) return refus('page', 404);
    nom = 'vrm_form_page'; args = { p_adresse: a };
  } else if (action === 'form-page-ranger') {
    const a = adresseLue(c.adresse), n = String(c.nom || '').trim(), p = String(c.presentation || '').trim();
    if (!adresseOk(a)) return refus('adresse');
    if (n.length < 2 || n.length > 40 || /[@<>]/.test(n)) return refus('nom');
    if (p.length > 600 || /[<>]/.test(p)) return refus('presentation');
    nom = 'vrm_form_page_ranger'; args = { p_adresse: a, p_nom: n, p_presentation: p, p_publiee: c.publiee === true };
  } else if (action === 'form-vitrine') {
    const g = uuid('groupe', 'pas-createur'); if (!g) return;
    nom = 'vrm_form_vitrine_regler'; args = { p_groupe: g, p_montre: c.montre === true };
  } else if (action === 'form-demander') {
    const a = adresseLue(c.adresse); if (!adresseOk(a)) return refus('page', 404);
    const g = uuid('groupe', 'page'); if (!g) return;
    const q = String(c.nom || '').trim(); if (q.length < 2 || q.length > 40 || /[@<>]/.test(q)) return refus('nom');
    // PAR DÉFAUT RIEN : un partage absent ou inconnu n'est jamais « élargi ».
    const p = c.partage == null ? 'rien' : String(c.partage);
    if (!PARTAGES.includes(p)) return refus('partage');
    nom = 'vrm_form_demander'; args = { p_adresse: a, p_groupe: g, p_nom: q, p_partage: p };
  } else if (action === 'form-etape' || action === 'form-annonce') {
    const g = uuid('groupe', 'pas-createur'); if (!g) return;
    if (action === 'form-etape') {
      const t = String(c.titre || '').trim(); if (t.length < 2 || t.length > 80 || /[<>]/.test(t)) return refus('titre');
      nom = 'vrm_form_etape'; args = { p_groupe: g, p_titre: t };
    } else {
      const t = String(c.texte || '').trim(); if (t.length < 1 || t.length > 1000) return refus('texte');
      nom = 'vrm_form_annonce'; args = { p_groupe: g, p_texte: t };
    }
  } else if (action === 'form-etape-retirer') {
    const e = uuid('etape', 'pas-createur'); if (!e) return;
    nom = 'vrm_form_etape_retirer'; args = { p_etape: e };
  } else if (action === 'form-annonce-retirer') {
    const a = uuid('annonce', 'pas-createur'); if (!a) return;
    nom = 'vrm_form_annonce_retirer'; args = { p_annonce: a };
  } else if (action === 'form-cocher') {
    const a = uuid('adhesion', 'adhesion'); if (!a) return;
    const e = uuid('etape', 'etape'); if (!e) return;
    nom = 'vrm_form_cocher'; args = { p_adhesion: a, p_etape: e, p_fait: c.fait === true };
  } else if (action === 'form-accord') {
    const a = uuid('adhesion', 'adhesion'); if (!a) return;
    // PAR DÉFAUT NON : seul un `true` explicite donne l'accord.
    nom = 'vrm_form_accord'; args = { p_adhesion: a, p_etapes: c.etapes === true };
  } else return dire(400, { ok: false, erreur: 'action', message: 'Action inconnue.' });

  const r = await rpcEquipe(nom, args, qui);
  if (r.etat === 'absent') return nonInstalle();
  if (r.etat !== 'ok' || !objet(r.data)) return pasSu();
  if (r.data.ok !== true) {
    const raison = String(r.data.raison || 'inconnue');
    return refus(raison, raison === 'page' || raison === 'adhesion' || raison === 'etape' ? 404 : 409);
  }
  const { ok: _ok, ...reste } = r.data;
  return dire(200, { ok: true, ...reste });
}

// La page PUBLIQUE (sans session) : la clé publique seule ; la base ne rend que
// ce qui est public (nom, présentation, groupes montrés).
export async function pagePublique(adresse, ANON) {
  const a = adresseLue(adresse);
  if (!adresseOk(a)) return { code: 404, corps: { ok: false, erreur: 'page', message: RAISONS_FORM.page } };
  const r = await rpcEquipe('vrm_form_page', { p_adresse: a }, { apikey: ANON, Authorization: `Bearer ${ANON}` });
  if (r.etat === 'absent') return { code: 503, corps: { ok: false, erreur: 'non-installe', message: FORM_NON_INSTALLE } };
  const d = r.etat === 'ok' ? objet(r.data) : null;
  if (!d) return { code: 503, corps: { ok: false, erreur: 'pas-su', message: PAS_SU } };
  if (d.ok !== true) return { code: 404, corps: { ok: false, erreur: 'page', message: RAISONS_FORM.page } };
  const groupes = (Array.isArray(d.groupes) ? d.groupes : []).filter((g) => g && UUID_RE.test(String(g.id || '')))
    .map((g) => ({ id: g.id, nom: String(g.nom || ''), description: String(g.description || '') }));
  return { code: 200, corps: { ok: true, page: { adresse: a, nom: String(d.nom || ''), presentation: String(d.presentation || ''), groupes } } };
}

// « Fermer mon compte » (clé de service) : 0 si la base n'a pas la 031, `null`
// si la base n'a pas répondu. À appeler AVANT `vrm_accomp_effacer` (025).
export async function effacerFormateur(owner, SERVICE) {
  if (!UUID_RE.test(String(owner || '')) || !SERVICE) return null;
  const r = await rpcEquipe('vrm_form_effacer', { p_owner: owner }, sbCle(SERVICE));
  if (r.etat === 'absent') return 0;
  if (r.etat !== 'ok') return null;
  const n = Number(r.data);
  return Number.isFinite(n) ? n : null;
}
