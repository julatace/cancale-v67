// ═══════════════════════════════════════════════════════════════════════════
// SE CONNECTER SUR L'ORDINATEUR EN SCANNANT UN QR AVEC L'IPHONE (14 nov., lot 119)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Connexion sur l'ordinateur en scannant un QR avec ton iPhone, sans
// retaper ton mot de passe. » Le flux « un appareil DÉJÀ connecté approuve » :
//
//   1. L'ORDINATEUR (pas connecté) demande un ticket : `creer`. Le ticket est
//      SIGNÉ par le serveur (HMAC) et porte : un identifiant au hasard (128 bits),
//      son expiration (≤ 2 min), le nom que l'ordinateur se donne (« Mac de … »)
//      et l'EMPREINTE d'un secret que seul l'ordinateur garde (en mémoire, jamais
//      dans le QR, jamais rangé). Aucune écriture en base à cette étape : un
//      inconnu ne remplit pas la base en demandant des QR.
//   2. Le QR porte le ticket SEUL (pas le secret). L'iPhone CONNECTÉ le scanne :
//      `voir` (avec SA session) rend « Connecter “Mac de …” ? ».
//   3. C'est SON CLIC qui approuve : `approuver` (avec SA session). La ligne
//      `qrc_{id}` est CRÉÉE (insertion seule : une seconde approbation du même
//      ticket est refusée) au nom du propriétaire NEUTRE, état `approuve`, avec
//      l'identité vérifiée par Supabase (jamais un champ envoyé par le téléphone).
//      ⚠️ Double vérification : un compte qui a un facteur TOTP VÉRIFIÉ ne peut
//      approuver que depuis une session `aal2` (le niveau lu dans SON jeton).
//   4. L'ordinateur attend (`attendre`, ticket + secret) : tant que rien n'est
//      approuvé ⇒ « en attente », RIEN d'autre. Approuvé ⇒ la ligne passe à
//      `consomme` par comparer-et-échanger (un seul gagnant), PUIS la session est
//      fabriquée côté serveur par la voie de Supabase (lien magique généré par
//      l'administration, aussitôt échangé, comme `session-extension`) : une
//      session NEUVE, à elle, ni le jeton de l'iPhone ni aucun mot de passe.
//      ⚠️ Cette session est `aal1` : un compte avec double vérification passe par
//      l'écran du code sur l'ordinateur (`PorteMfa`) — la MFA n'est jamais sautée.
//   Rejoué (déjà consommé) ⇒ refusé. Expiré ⇒ refusé. Mauvais secret ⇒ refusé.
//   Refusé sur l'iPhone ⇒ l'ordinateur le dit, rien n'est créé.
//
// Pur à l'injection près : `routeQrConnexion` reçoit le dépôt (la base) et
// l'authentification (Supabase) en paramètres — scripts/audit-confort-securite.cjs
// l'EXÉCUTE avec des doublures, api/compte.js avec les vraies.
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const QR_DUREE_MS = 120000;           // ≤ 2 min, de la création à la récupération
export const PREFIXE_LIGNE_QR = 'qrc_';
const ID_OK = /^[A-Za-z0-9_-]{22}$/;
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const egal = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// Le nom que l'ordinateur se donne : du texte court, sans balise ni retour.
export function nomAppareilPropre(v) {
  const t = String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return t || 'Ordinateur';
}

// ── LE TICKET (signé, sans état) ────────────────────────────────────────────
export function creerTicket({ cle, appareil, maintenant = Date.now(), alea = randomBytes } = {}) {
  if (!cle) return null;
  const i = b64u(alea(16));
  const secret = b64u(alea(32));
  const corps = { i, e: maintenant + QR_DUREE_MS, a: nomAppareilPropre(appareil), h: sha(secret) };
  const charge = b64u(JSON.stringify(corps));
  const sig = b64u(createHmac('sha256', cle).update(charge).digest());
  return { ticket: `${charge}.${sig}`, secret, exp: corps.e, appareil: corps.a };
}

// Rend le contenu du ticket, ou { refus } : 'ticket' (abîmé / signature) · 'expire'.
export function lireTicket(ticket, { cle, maintenant = Date.now() } = {}) {
  const t = String(ticket || '');
  if (!cle || t.length > 600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) return { refus: 'ticket' };
  const [charge, sig] = t.split('.');
  const attendu = b64u(createHmac('sha256', cle).update(charge).digest());
  if (!egal(sig, attendu)) return { refus: 'ticket' };
  let c = null;
  try { c = JSON.parse(deB64u(charge).toString('utf8')); } catch (_) { return { refus: 'ticket' }; }
  if (!c || !ID_OK.test(String(c.i)) || !Number.isFinite(c.e) || typeof c.h !== 'string') return { refus: 'ticket' };
  if (!(maintenant < c.e)) return { refus: 'expire' };
  if (c.e - maintenant > QR_DUREE_MS + 5000) return { refus: 'ticket' };   // une expiration plus longue que permise
  return { id: c.i, exp: c.e, appareil: nomAppareilPropre(c.a), h: c.h };
}

export const ligneQr = (id) => PREFIXE_LIGNE_QR + String(id);

// Le niveau d'assurance d'un jeton déjà vérifié par Supabase (`aal1` · `aal2`).
export function aalDe(jeton) {
  try {
    const p = String(jeton || '').split('.')[1];
    const j = JSON.parse(deB64u(p).toString('utf8'));
    return typeof j.aal === 'string' ? j.aal : null;
  } catch (_) { return null; }
}
export const aDoubleVerif = (u) => (Array.isArray(u && u.factors) ? u.factors : []).some((f) => f && f.factor_type === 'totp' && f.status === 'verified');

// ── LA ROUTE ────────────────────────────────────────────────────────────────
// depot : { lire(id) → { data } | null (absente) | undefined (pas su),
//           inserer(id, data) → true · false (existe déjà) · null (pas su),
//           remplacerSi(id, etatAvant, data) → true (gagné) · false (devancé) · null (pas su) }
// auth  : { utilisateur(jeton) → { id, email, emailConfirme, factors } | null (refusé) | undefined (pas su),
//           session(uid, email) → { access_token, refresh_token, expires_in, user } | null }
// Rend { status, body }.
export async function routeQrConnexion({ corps = {}, jeton = '', cle, depot, auth, maintenant = Date.now(), alea } = {}) {
  const action = String((corps && corps.action) || '');
  if (!cle) return { status: 503, body: { erreur: 'non-configure' } };

  if (action === 'creer') {
    const t = creerTicket({ cle, appareil: corps.appareil, maintenant, alea });
    return { status: 200, body: { ok: true, ticket: t.ticket, secret: t.secret, exp: t.exp, appareil: t.appareil } };
  }

  const tk = lireTicket(corps.ticket, { cle, maintenant });
  if (tk.refus) return { status: tk.refus === 'expire' ? 410 : 400, body: { erreur: tk.refus } };
  const id = ligneQr(tk.id);

  if (action === 'voir' || action === 'approuver' || action === 'refuser') {
    const u = await auth.utilisateur(jeton);
    if (u === undefined) return { status: 503, body: { erreur: 'pas-su' } };
    if (!u) return { status: 401, body: { erreur: 'session' } };
    if (action === 'voir') {
      const l = await depot.lire(id);
      if (l === undefined) return { status: 503, body: { erreur: 'pas-su' } };
      return { status: 200, body: { ok: true, appareil: tk.appareil, exp: tk.exp, deja: !!l } };
    }
    if (action === 'approuver') {
      if (!u.email || !u.emailConfirme) return { status: 409, body: { erreur: 'email' } };
      // La double vérification : approuver demande le même niveau qu'entrer dans l'app.
      if (aDoubleVerif(u) && aalDe(jeton) !== 'aal2') return { status: 403, body: { erreur: 'mfa' } };
    }
    const etat = action === 'approuver' ? 'approuve' : 'refuse';
    const r = await depot.inserer(id, { etat, uid: action === 'approuver' ? u.id : '', email: action === 'approuver' ? u.email : '', at: maintenant, exp: tk.exp, appareil: tk.appareil, rev: 1 });
    if (r === null) return { status: 503, body: { erreur: 'pas-su' } };
    if (r === false) return { status: 409, body: { erreur: 'deja' } };
    return { status: 200, body: { ok: true, etat } };
  }

  if (action === 'attendre') {
    if (!egal(sha(String(corps.secret || '')), tk.h)) return { status: 403, body: { erreur: 'secret' } };
    const l = await depot.lire(id);
    if (l === undefined) return { status: 503, body: { erreur: 'pas-su' } };
    if (!l) return { status: 200, body: { ok: true, etat: 'attente', exp: tk.exp } };   // rien approuvé : rien d'autre
    const d = l.data || {};
    if (d.etat === 'refuse') return { status: 200, body: { ok: true, etat: 'refuse' } };
    if (d.etat !== 'approuve' || !d.uid) return { status: 410, body: { erreur: 'deja' } };   // consommé : un rejeu est refusé
    // UN seul gagnant : la ligne passe à `consomme` AVANT toute session.
    const g = await depot.remplacerSi(id, 'approuve', { ...d, etat: 'consomme', consommeAt: maintenant, rev: (Number(d.rev) || 0) + 1 });
    if (g === null) return { status: 503, body: { erreur: 'pas-su' } };
    if (!g) return { status: 410, body: { erreur: 'deja' } };
    const s = await auth.session(d.uid, d.email);
    if (!s || !s.access_token || !s.user || s.user.id !== d.uid) return { status: 502, body: { erreur: 'session' } };
    return { status: 200, body: { ok: true, etat: 'connecte', session: s } };
  }
  return { status: 400, body: { erreur: 'action' } };
}

// ── LE DÉPÔT RÉEL (PostgREST, clé de service, propriétaire NEUTRE) ──────────
export function depotPostgrest({ url, entetes, owner, fetcher }) {
  const base = `${url}/rest/v1/app_data`;
  return {
    async lire(id) {
      try {
        const r = await fetcher(`${base}?id=eq.${encodeURIComponent(id)}&owner=eq.${owner}&select=data`, { headers: entetes });
        if (!r.ok) return undefined;
        const j = await r.json();
        return Array.isArray(j) ? (j[0] || null) : undefined;
      } catch (_) { return undefined; }
    },
    async inserer(id, data) {
      try {
        const r = await fetcher(base, { method: 'POST', headers: { ...entetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify([{ id, owner, data, updated_at: new Date().toISOString() }]) });
        if (r.status === 409) return false;
        return r.ok ? true : null;
      } catch (_) { return null; }
    },
    async remplacerSi(id, etatAvant, data) {
      try {
        const r = await fetcher(`${base}?id=eq.${encodeURIComponent(id)}&owner=eq.${owner}&data->>etat=eq.${encodeURIComponent(etatAvant)}`, { method: 'PATCH', headers: { ...entetes, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) });
        if (!r.ok) return null;
        const j = await r.json();
        return Array.isArray(j) ? j.length === 1 : null;
      } catch (_) { return null; }
    },
  };
}

// La clé de signature : `QR_CONNEXION_SECRET` si posée, sinon dérivée de la clé de
// service (jamais écrite nulle part, jamais rendue). Aucune ⇒ '' (la route dit 503).
export function cleSignature(nom, env = process.env) {
  const propre = String(env[nom] || '').trim();
  if (propre.length >= 32) return propre;
  const service = String(env.SUPABASE_SERVICE_KEY || '').trim();
  return service ? createHmac('sha256', service).update('vrm:' + nom).digest('hex') : '';
}
