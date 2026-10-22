// ══════════════════════════════════════════════════════════════════════════════
// UNE ADRESSE DE RÉCEPTION PROUVÉE (22 octobre)
// ══════════════════════════════════════════════════════════════════════════════
// C'est l'adresse de réception qui décide à quel vendeur appartient un email
// (`proprietaire-email.js`). Jusqu'ici, une adresse DÉCLARÉE suffisait — et
// rien ne prouvait que celui qui la déclare la possède : un vendeur pouvait
// déclarer l'adresse d'un autre et recevoir ses ventes, ses bordereaux, le nom
// et l'adresse de ses acheteurs (CLAUDE.md : « bloquant avant d'ouvrir VRM à
// des inconnus »).
//
// ── LA PREUVE ─────────────────────────────────────────────────────────────────
// Un lien est envoyé À CETTE ADRESSE (par la boîte VRM, le script Gmail
// collectif — le même canal que les factures Pro). Seul celui qui lit cette
// boîte le reçoit. Le clic, DEPUIS LA SESSION du vendeur qui l'a demandé, range
// la preuve — côté serveur, sous le propriétaire NEUTRE : aucune session ne
// peut l'écrire (RLS : `owner = auth.uid()` à l'insertion comme à la
// modification, mesuré le 22 octobre).
//   · le lien ne contient AUCUN secret rangé en base : c'est un HMAC (clé dérivée
//     de la clé de service) sur la ligne et un aléa — lire la base ne suffit pas
//     à le fabriquer ;
//   · il ne sert qu'au vendeur qui l'a demandé : la ligne se trouve par SON
//     identifiant de session (un autre compte qui l'ouvre ne trouve rien) ;
//   · il périme (72 h), et se renvoie au plus une fois toutes les 10 minutes.
// Deuxième preuve, sans email : l'adresse EST l'adresse de connexion VRM du
// vendeur, et Supabase l'a confirmée par un lien (`confirmation_sent_at` puis
// `email_confirmed_at`). Une confirmation automatique (sans lien envoyé) ne
// prouve rien : elle ne compte pas.
//
// ── CE QUI EST ATTRIBUÉ (base cloisonnée) ─────────────────────────────────────
// Une adresse déclarée n'est retenue que si elle est PROUVÉE pour CE vendeur.
// Une adresse non prouvée est traitée comme une adresse que personne n'a
// déclarée : l'email est mis de côté (quarantaine), jamais donné. Il se
// récupère dès la preuve (`peutReclamer` relit le même registre).
//
// ── LA TRANSITION (et pourquoi elle n'a pas de date) ──────────────────────────
// Le PROPRIÉTAIRE DE L'INSTALLATION (`VRM_OWNER_UID`) garde ses adresses
// déclarées, prouvées ou non — dites « à confirmer ». Mesuré le 22 octobre :
// 16 adresses déclarées, toutes par lui, dont 2 relais Apple
// (`privaterelay.appleid.com`) qui n'acceptent QUE les emails de Vinted : aucun
// lien ne pourrait jamais les prouver. Couper ses adresses, ce serait perdre
// ses ventes. Et l'exiger de lui ne protège personne : il exploite
// l'installation (il a la clé de service, il lit déjà toute la base). Une date
// de fin dans le code aurait fait un piège à retardement (une adresse déclarée
// le lendemain du déploiement, coupée sans un mot). Ses adresses restent donc
// retenues, et une adresse qu'il partage avec un vendeur qui l'a PROUVÉE ne
// désigne personne (conflit → quarantaine, la règle existante).
import crypto from 'node:crypto';
import { normAdresse, estAdresseCollectrice, PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';

export const PREFIXE_PREUVE = 'vrm_email_preuve_';
export const DUREE_LIEN_MS = 72 * 3600e3;
export const DELAI_RENVOI_MS = 10 * 60e3;
export const MAX_ENVOIS_ADRESSE_JOUR = 5;
export const MAX_ADRESSES_JOUR = 10;
export const SITE_VRM = 'https://vrm.center';
export const PARAM_LIEN = 'confirmer-adresse';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// L'identité d'une demande : le vendeur ET l'adresse (deux vendeurs, deux lignes).
export const empreintePreuve = (owner, adresse) => sha(`${String(owner || '').trim()}|${normAdresse(adresse)}`).slice(0, 40);
export const idPreuve = (owner, adresse) => PREFIXE_PREUVE + empreintePreuve(owner, adresse);

// La clé des liens : dérivée de la clé de SERVICE (jamais la clé publique, qui
// est dans le dépôt). Absente ⇒ `null` : on ne fabrique aucun lien.
export function cleLiens(service) {
  const s = String(service || '');
  if (!s) return null;
  return crypto.createHmac('sha256', s).update('vrm-preuve-adresse-v1').digest();
}
export function jetonLien(cle, id, nonce, expire) {
  return b64url(crypto.createHmac('sha256', cle).update(`${id}|${nonce}|${expire}`).digest());
}
export const lienConfirmation = (id, jeton) => `${SITE_VRM}/?${PARAM_LIEN}=${String(id).slice(PREFIXE_PREUVE.length)}.${jeton}`;
// Ce que l'app renvoie : « <empreinte>.<jeton> ». Rend `{ empreinte, jeton }` ou `null`.
export function lireLien(texte) {
  const m = /^([0-9a-f]{40})\.([A-Za-z0-9_-]{43})$/.exec(String(texte || '').trim());
  return m ? { empreinte: m[1], jeton: m[2] } : null;
}
// 'ok' · 'perime' · 'faux' — comparaison en temps constant.
export function verifierJeton(cle, ligne, jeton, maintenant = Date.now()) {
  if (!cle || !ligne || !ligne.nonce || !ligne.expire) return 'faux';
  const attendu = Buffer.from(jetonLien(cle, ligne.id, ligne.nonce, ligne.expire));
  const recu = Buffer.from(String(jeton || ''));
  if (attendu.length !== recu.length || !crypto.timingSafeEqual(attendu, recu)) return 'faux';
  if (!(Date.parse(ligne.expire) > maintenant)) return 'perime';
  return 'ok';
}
// Les liens de confirmation qu'un email ENTRANT porterait (une confirmation
// transférée vers la boîte collective) sont retirés avant d'être rangés : le
// lien ne doit jamais devenir lisible par un autre que le destinataire.
export const retirerLiensPreuve = (s) => (typeof s === 'string' ? s.replace(/confirmer-adresse(=|%3D)[0-9a-f]{40}(\.|%2E)[A-Za-z0-9_-]{20,}/gi, 'confirmer-adresse=retire') : s);

// Un relais Apple « Se connecter avec Apple » n'accepte que les expéditeurs
// enregistrés par l'application (Vinted) : un lien envoyé par VRM n'y arrive
// pas (documentation d'Apple — non mesuré d'ici).
export const relaisApple = (a) => /@privaterelay\.appleid\.com$/i.test(normAdresse(a));

// L'adresse de connexion VRM, confirmée PAR UN LIEN (pas automatiquement).
export function prouveeParCompte(adresse, user) {
  if (!user || !user.email) return false;
  if (normAdresse(user.email) !== normAdresse(adresse)) return false;
  const conf = Date.parse(user.email_confirmed_at || user.confirmed_at || '');
  const envoi = Date.parse(user.confirmation_sent_at || '');
  return Number.isFinite(conf) && Number.isFinite(envoi) && conf >= envoi;
}

// ── L'ÉTAT D'UNE ADRESSE POUR CE VENDEUR — UNE RÈGLE (§11) ───────────────────
// `preuve` : la ligne de preuve (data) de CE vendeur pour CETTE adresse, ou null.
//   'prouvee'    prouvée (lien ou adresse de connexion confirmée)
//   'transition' déclarée par le propriétaire de l'installation, pas prouvée
//   'impossible' relais Apple : aucun lien ne peut y arriver
//   'envoi'      lien demandé, pas encore parti (la boîte VRM l'envoie)
//   'envoyee'    lien parti, pas encore cliqué
//   'perimee'    lien périmé
//   'aucune'     rien de demandé
export function etatAdresse({ adresse, owner, preuve, installation, maintenant = Date.now() }) {
  const a = normAdresse(adresse), o = String(owner || '').trim();
  const p = preuve && String(preuve.owner || '') === o && normAdresse(preuve.adresse) === a ? preuve : null;
  if (p && p.etat === 'prouvee') return 'prouvee';
  if (o && installation && o === String(installation).trim()) return 'transition';
  if (relaisApple(a)) return 'impossible';
  if (p && p.etat === 'attente') {
    if (!(Date.parse(p.expire) > maintenant)) return 'perimee';
    return p.envoyeLe ? 'envoyee' : 'envoi';
  }
  return 'aucune';
}
export const etatRetenu = (e) => e === 'prouvee' || e === 'transition';

// La garde du registre (base cloisonnée) : la décision d'`etatAdresse`, sur
// l'index des preuves PROUVÉES (`Map` id → ligne). Rend `true` si l'adresse
// déclarée par `owner` peut lui être attribuée.
export function retenue(adresse, owner, garde) {
  if (!garde || !(garde.preuves instanceof Map)) return false;
  const preuve = garde.preuves.get(idPreuve(owner, adresse)) || null;
  return etatRetenu(etatAdresse({ adresse, owner, preuve, installation: garde.installation }));
}

// L'email de confirmation (le serveur l'écrit, le script Gmail l'envoie tel quel).
export function emailConfirmation(adresse, lien) {
  const sujet = 'VRM — confirme ton adresse de réception';
  const texte = [
    'Bonjour,',
    '',
    `Quelqu'un a ajouté l'adresse ${adresse} à son compte VRM pour y recevoir ses emails Vinted (ventes, bordereaux, colis).`,
    '',
    "Si c'est toi, ouvre ce lien en étant connecté à VRM avec CE compte :",
    lien,
    '',
    "Il est valable 72 heures. Si ce n'est pas toi, ignore ce message : rien ne te sera attribué, et cette adresse ne sera donnée à personne.",
    '',
    'VRM',
  ].join('\n');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const html = `<p>Bonjour,</p><p>Quelqu'un a ajouté l'adresse <b>${esc(adresse)}</b> à son compte VRM pour y recevoir ses emails Vinted (ventes, bordereaux, colis).</p><p>Si c'est toi, ouvre ce lien en étant connecté à VRM avec <b>ce</b> compte :</p><p><a href="${esc(lien)}">Confirmer cette adresse</a></p><p style="color:#666">Il est valable 72 heures. Si ce n'est pas toi, ignore ce message : rien ne te sera attribué, et cette adresse ne sera donnée à personne.</p><p>VRM</p>`;
  return { sujet, texte, html };
}

// Une adresse qu'on accepte de vérifier (même forme que l'app).
export const ADRESSE_OK = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
export const adresseVerifiable = (a) => { const n = normAdresse(a); return !!n && ADRESSE_OK.test(n) && !estAdresseCollectrice(n); };
export { PROPRIETAIRE_NEUTRE };
