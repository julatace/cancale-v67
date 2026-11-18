// ── LE COUCOU ET L'HABILLAGE DES GROUPES, CÔTÉ SERVEUR (17 nov.) ─────────────
// Migration 046 (supabase/migrations/046-communaute-coucous.sql), PAS APPLIQUÉE
// tant que Julien ne l'a pas collée. Les garanties vivent dans la BASE (identité
// tirée du jeton, même groupe, une fois par paire et par 24 h, 20 par jour,
// sourdine). Cette route RELAIE avec le JETON DE L'APPELANT, dans la fonction
// existante `api/compte.js?mode=communaute` (12 fonctions au plus : aucune
// nouvelle) :
//   POST { action: 'accomp-coucou-lire' }                      → { ok, coucou }
//   POST { action: 'accomp-coucou', groupe, membre|null }      (membre null = le créateur)
//   POST { action: 'accomp-coucou-sourdine', coucou, oui }     (celui qui a reçu)
//   POST { action: 'accomp-coucou-ouvrir', adhesion, oui }     (un membre, pour lui-même)
//   POST { action: 'accomp-habiller', groupe, discord, photo } (le créateur)
// UN COUCOU NE PORTE AUCUN TEXTE : aucune de ces actions n'en lit un, et rien de
// ce que le navigateur envoie d'autre n'est relayé (seuls les identifiants).
// Deux appels à la CLÉ DE SERVICE, toujours avec l'identité VÉRIFIÉE de
// l'appelant (jamais un champ du corps) :
//   · après un coucou réussi, `vrm_coucou_a_sonner(coucou, moi)` ⇒ chez qui
//     sonner : la notification part au nom de CELUI QUI REÇOIT (sa cloche, ses
//     appareils, ses réglages, sa langue) — famille « Coucous de la communauté » ;
//   · à la lecture, `vrm_coucou_auteurs(moi)` ⇒ qui m'a fait coucou, pour
//     proposer SON profil Discord s'il l'a relié à VRM (identifiant SIGNÉ par le
//     serveur, api/_lib/avatar-discord.js) — le compte n'est jamais renvoyé.
// TROIS ÉTATS : 200 lu/fait · 503 `non-installe` (la 046 manque : « bientôt
// disponible ») · 503 `pas-su` · 4xx un refus réel, dit en clair.
import { rpcEquipe } from './equipe.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { contexteVendeur } from './owner.js';
import { sendPushToAll, langueDuVendeur } from './push.js';
import { lienNotif } from './lien-notif.js';
import { idDiscordVerifie } from './avatar-discord.js';
import { lienDiscordGroupe, photoValide, texteCoucou } from '../../src/communaute/coucou.js';
export { texteCoucou };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const COUCOU_NON_INSTALLE = 'Le coucou arrive bientôt : il n’est pas encore activé sur ta base.';
const PAS_SU = "Je n'ai pas pu joindre la base — rien n'a changé. Réessaie dans un instant.";
export const RAISONS_COUCOU = {
  session: 'Connecte-toi à VRM pour faire ça.',
  abonnement: "Ton abonnement n'est pas actif : les groupes sont fermés pour l'instant.",
  groupe: 'Tu ne fais pas (ou plus) partie de ce groupe.',
  cible: 'Cette personne n’est pas (ou plus) joignable dans ce groupe.',
  soi: 'On ne se fait pas coucou à soi-même.',
  deja: 'Vous vous êtes déjà fait coucou aujourd’hui. Pour continuer, écrivez-vous sur Discord.',
  plafond: 'Tu as fait 20 coucous en 24 h : c’est le maximum. Réessaie demain.',
  indisponible: 'Ce coucou ne peut pas partir.',
  coucou: 'Ce coucou n’est pas pour toi.',
  adhesion: 'Tu ne fais pas (ou plus) partie de ce groupe.',
  'pas-createur': 'Seule la personne qui a créé le groupe peut faire ça.',
  'discord-groupe': 'Ce lien n’est pas un lien Discord : colle une invitation (discord.gg/…) ou l’adresse d’un salon (discord.com/channels/…).',
  photo: 'Cette photo ne va pas : choisis une image (elle est réduite à un petit carré).',
};

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const cleService = () => process.env.SUPABASE_SERVICE_KEY || '';

// Sonner chez celui qui reçoit. `false` si rien n'est parti (pas de clé, pas su) :
// le coucou, lui, est fait — la notification n'est qu'un plus.
async function sonner(coucou, moi, fonction = 'vrm_coucou_a_sonner') {
  const cle = cleService();
  if (!cle || !UUID_RE.test(String(moi || ''))) return false;
  const r = await rpcEquipe(fonction, { p_coucou: coucou, p_de: moi }, sbCle(cle));
  const d = r.etat === 'ok' ? objet(r.data) : null;
  if (!d || !UUID_RE.test(String(d.a || '')) || d.a === moi) return false;
  try {
    return await contexteVendeur.run({ owner: d.a }, async () => {
      const tx = texteCoucou(await langueDuVendeur(), d.de_nom, d.groupe_nom || null);
      const e = await sendPushToAll({ cat: 'coucou', ...tx, tag: 'vrm-coucou-' + coucou, cle: 'coucou-' + coucou, url: lienNotif('communaute', { vue: 'groupes' }) });
      return !!(e && (e.sent || e.rangee));
    });
  } catch (_) { return false; }
}

// Le profil Discord (identifiant signé) de ceux qui m'ont fait coucou :
// { idCoucou: '1234…' }. Une panne ⇒ {} (le repli : le salon du groupe).
async function profilsDesAuteurs(moi, fonction = 'vrm_coucou_auteurs') {
  const cle = cleService();
  if (!cle || !UUID_RE.test(String(moi || ''))) return {};
  const r = await rpcEquipe(fonction, { p_a: moi }, sbCle(cle));
  const liste = r.etat === 'ok' && Array.isArray(r.data) ? r.data.filter((x) => x && UUID_RE.test(String(x.id)) && UUID_RE.test(String(x.de)) && x.de !== moi) : [];
  const auteurs = [...new Set(liste.map((x) => x.de))].slice(0, 200);
  if (!auteurs.length) return {};
  const ids = {};
  try {
    const q = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_discord&data->>verifie=eq.true&owner=in.(${auteurs.join(',')})&select=owner,discord:data->>discord,avatar:data->>avatar,pid:data->>pid,signatureAvatar:data->>signatureAvatar,did:data->>did,signatureId:data->>signatureId`, { headers: sbCle(cle), signal: AbortSignal.timeout(6000) });
    if (!q.ok) return {};
    const rows = await q.json();
    if (!Array.isArray(rows)) return {};
    for (const d of rows) { if (d && auteurs.includes(d.owner)) { const id = idDiscordVerifie(d.owner, d); if (id) ids[d.owner] = id; } }
  } catch (_) { return {}; }
  const parCoucou = {};
  for (const x of liste) if (ids[x.de]) parCoucou[x.id] = ids[x.de];
  return parCoucou;
}

export async function routeCoucou(req, res, { corps, qui, action, utilisateur = null }) {
  const dire = (code, c) => res.status(code).json(c);
  const nonInstalle = () => dire(503, { ok: false, erreur: 'non-installe', message: COUCOU_NON_INSTALLE });
  const pasSu = () => dire(503, { ok: false, erreur: 'pas-su', message: PAS_SU });
  const refus = (raison, code = 400) => dire(raison === 'session' ? 401 : raison === 'abonnement' ? 403 : code,
    { ok: false, erreur: raison, message: RAISONS_COUCOU[raison] || `La base a refusé (${raison}).` });
  const c = corps || {};
  const moi = utilisateur && UUID_RE.test(String(utilisateur.id || '')) ? utilisateur.id : '';
  const uuid = (k, raison) => { const v = String(c[k] || ''); return UUID_RE.test(v) ? v : (refus(raison, 404), null); };

  if (action === 'accomp-coucou-lire') {
    const r = await rpcEquipe('vrm_coucou_lire', {}, qui);
    if (r.etat === 'absent') return nonInstalle();
    if (r.etat !== 'ok') return pasSu();
    const d = objet(r.data);
    if (!d) return refus('session');
    if (d.acces === false) return refus('abonnement');
    if (!Array.isArray(d.groupes) || !Array.isArray(d.recus)) return pasSu();
    const profils = d.recus.length ? await profilsDesAuteurs(moi) : {};
    // Seuls les champs connus repartent (jamais un compte, même si la base en rendait un).
    const recus = d.recus.map((x) => ({ id: x.id, groupe: x.groupe, groupe_nom: x.groupe_nom, de_nom: x.de_nom, le: x.le, discord_groupe: x.discord_groupe || null, profil: profils[x.id] || null }));
    const groupes = d.groupes.map((g) => ({ groupe: g.groupe, discord: g.discord || null, photo: g.photo || null, ouvert: g.ouvert === true,
      cibles: (Array.isArray(g.cibles) ? g.cibles : []).map((x) => ({ cible: x.cible || null, role: x.role === 'createur' ? 'createur' : 'membre', nom: x.nom, deja: x.deja === true })) }));
    const sourdines = (Array.isArray(d.sourdines) ? d.sourdines : []).map((s) => ({ coucou: s.coucou, nom: s.nom }));
    return dire(200, { ok: true, coucou: { envoyes24h: Number(d.envoyes24h) || 0, plafond: Number(d.plafond) || 20, groupes, recus, sourdines } });
  }

  let nom, args;
  if (action === 'accomp-coucou') {
    const g = uuid('groupe', 'groupe'); if (!g) return;
    let m = null;
    if (c.membre != null && c.membre !== '') { m = uuid('membre', 'cible'); if (!m) return; }
    nom = 'vrm_coucou_envoyer'; args = { p_groupe: g, p_membre: m };
  } else if (action === 'accomp-coucou-sourdine') {
    const k = uuid('coucou', 'coucou'); if (!k) return;
    nom = 'vrm_coucou_sourdine'; args = { p_coucou: k, p_oui: c.oui === true };
  } else if (action === 'accomp-coucou-ouvrir') {
    const a = uuid('adhesion', 'adhesion'); if (!a) return;
    nom = 'vrm_coucou_ouvrir'; args = { p_adhesion: a, p_oui: c.oui === true };
  } else if (action === 'accomp-habiller') {
    const g = uuid('groupe', 'pas-createur'); if (!g) return;
    const d = lienDiscordGroupe(c.discord);
    if (d === null) return refus('discord-groupe');
    const p = c.photo == null || c.photo === '' ? '' : String(c.photo);
    if (p && !photoValide(p)) return refus('photo');
    nom = 'vrm_accomp_habiller'; args = { p_groupe: g, p_discord: d || null, p_photo: p || null };
  } else return dire(400, { ok: false, erreur: 'action', message: 'Action inconnue.' });

  const r = await rpcEquipe(nom, args, qui);
  if (r.etat === 'absent') return nonInstalle();
  if (r.etat !== 'ok' || !objet(r.data)) return pasSu();
  if (r.data.ok !== true) {
    const raison = String(r.data.raison || 'inconnue');
    return refus(raison, raison === 'coucou' || raison === 'adhesion' || raison === 'cible' || raison === 'groupe' ? 404 : raison === 'plafond' ? 429 : 409);
  }
  if (action === 'accomp-coucou') {
    const sonne = UUID_RE.test(String(r.data.id || '')) ? await sonner(r.data.id, moi) : false;
    return dire(200, { ok: true, id: r.data.id, sonne });
  }
  const { ok: _ok, ...reste } = r.data;
  return dire(200, { ok: true, ...reste });
}

// « Fermer mon compte » (clé de service) : nombre détaché, 0 si la base n'a pas
// la 046, `null` si la base n'a pas répondu.
export async function effacerCoucous(owner, SERVICE) {
  if (!UUID_RE.test(String(owner || '')) || !SERVICE) return null;
  const r = await rpcEquipe('vrm_coucou_effacer', { p_owner: owner }, sbCle(SERVICE));
  if (r.etat === 'absent') return 0;
  if (r.etat !== 'ok') return null;
  const n = Number(r.data);
  return Number.isFinite(n) ? n : null;
}

// ── LA CARTE (17 nov., migration 047, PAS APPLIQUÉE) : le coucou remplace les messages ──
// Julien : « que les personnes puissent se faire coucou, mais pas échanger des
// messages dans mon app, mais sur Discord » — la même règle que les groupes.
//   POST { action: 'carte-coucou', pid }              (le pid PUBLIC de la carte ; AUCUN texte)
//   POST { action: 'carte-coucou-lire' }              → { ok, coucou: { envoyes24h, deja, recus, sourdines } }
//   POST { action: 'carte-coucou-sourdine', coucou, oui }
// 047 absente ⇒ 503 `non-installe` (« bientôt ») : jamais de repli vers un message.
export const CARTE_COUCOU_NON_INSTALLE = 'Le coucou de la carte arrive bientôt : il n’est pas encore activé sur ta base.';
export async function routeCarteCoucou(req, res, { corps, qui, action, utilisateur = null }) {
  const dire = (code, c) => res.status(code).json(c);
  const nonInstalle = () => dire(503, { ok: false, erreur: 'non-installe', message: CARTE_COUCOU_NON_INSTALLE });
  const pasSu = () => dire(503, { ok: false, erreur: 'pas-su', message: PAS_SU });
  const refus = (raison, code = 400) => dire(raison === 'session' ? 401 : raison === 'abonnement' ? 403 : code,
    { ok: false, erreur: raison, message: RAISONS_CARTE[raison] || RAISONS_COUCOU[raison] || `La base a refusé (${raison}).` });
  const c = corps || {};
  const moi = utilisateur && UUID_RE.test(String(utilisateur.id || '')) ? utilisateur.id : '';
  if (action === 'carte-coucou-lire') {
    const r = await rpcEquipe('vrm_carte_coucou_lire', {}, qui);
    if (r.etat === 'absent') return nonInstalle();
    if (r.etat !== 'ok') return pasSu();
    const d = objet(r.data);
    if (!d) return refus('session');
    if (d.acces === false) return refus('abonnement');
    if (!Array.isArray(d.recus) || !Array.isArray(d.deja)) return pasSu();
    const profils = d.recus.length ? await profilsDesAuteurs(moi, 'vrm_carte_coucou_auteurs') : {};
    const recus = d.recus.map((x) => ({ id: x.id, de_pid: x.de_pid, de_nom: x.de_nom, le: x.le, profil: profils[x.id] || null }));
    const sourdines = (Array.isArray(d.sourdines) ? d.sourdines : []).map((s) => ({ coucou: s.coucou, nom: s.nom }));
    return dire(200, { ok: true, coucou: { envoyes24h: Number(d.envoyes24h) || 0, plafond: Number(d.plafond) || 20, deja: d.deja.filter((p) => UUID_RE.test(String(p))), recus, sourdines } });
  }
  let nom, args;
  if (action === 'carte-coucou') {
    const pid = String(c.pid || ''); if (!UUID_RE.test(pid)) return refus('cible', 404);
    nom = 'vrm_carte_coucou'; args = { p_pid: pid };
  } else if (action === 'carte-coucou-sourdine') {
    const k = String(c.coucou || ''); if (!UUID_RE.test(k)) return refus('coucou', 404);
    nom = 'vrm_carte_coucou_sourdine'; args = { p_coucou: k, p_oui: c.oui === true };
  } else return dire(400, { ok: false, erreur: 'action', message: 'Action inconnue.' });
  const r = await rpcEquipe(nom, args, qui);
  if (r.etat === 'absent') return nonInstalle();
  if (r.etat !== 'ok' || !objet(r.data)) return pasSu();
  if (r.data.ok !== true) {
    const raison = String(r.data.raison || 'inconnue');
    return refus(raison, raison === 'coucou' || raison === 'cible' ? 404 : raison === 'plafond' ? 429 : 409);
  }
  if (action === 'carte-coucou') {
    const sonne = UUID_RE.test(String(r.data.id || '')) ? await sonner(r.data.id, moi, 'vrm_carte_coucou_a_sonner') : false;
    return dire(200, { ok: true, id: r.data.id, sonne });
  }
  const { ok: _ok, ...reste } = r.data;
  return dire(200, { ok: true, ...reste });
}
export const RAISONS_CARTE = {
  carte: 'Mets-toi d’abord sur la carte : on fait coucou à quelqu’un qui peut te voir.',
  cible: 'Cette personne n’est plus sur la carte.',
};
export async function effacerCoucousCarte(owner, SERVICE) {
  if (!UUID_RE.test(String(owner || '')) || !SERVICE) return null;
  const r = await rpcEquipe('vrm_carte_coucou_effacer', { p_owner: owner }, sbCle(SERVICE));
  if (r.etat === 'absent') return 0;
  if (r.etat !== 'ok') return null;
  const n = Number(r.data);
  return Number.isFinite(n) ? n : null;
}
