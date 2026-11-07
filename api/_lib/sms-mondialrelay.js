// ─────────────────────────────────────────────────────────────────────────────
// LES SMS DE MONDIAL RELAY (6 nov.) — lecteur strict + rangement.
//
// Constat (6 nov., mesuré) : Julien reçoit de Mondial Relay (expéditeur
// « MRELAY ») des SMS pour des colis en CASIER (« LOCKER 24/7 ») qu'AUCUN
// e-mail ne lui annonce. VRM ne les connaissait pas du tout.
//
// Un iPhone ne laisse aucune app lire les SMS. C'est SON automatisation
// Raccourcis (« Message » reçu ⇒ « Obtenir le contenu de l'URL », POST) qui nous
// envoie le texte, avec SON jeton (`vrm_sms_token`, ligne `main`, généré par
// l'app sur son clic, révocable en le régénérant).
//
// ⚠️ LE VENDEUR EST CELUI DU JETON, JAMAIS LE TEXTE (§5 « Les emails » : c'est
//    l'adresse de réception qui décide ; ici c'est le jeton). Rien dans le SMS
//    (n°, lieu, code) ne désigne un vendeur.
// ⚠️ UN CODE D'AUTHENTIFICATION N'EST JAMAIS RANGÉ (« Votre code de vérification
//    est 123456. ») : reconnu d'abord, quelle que soit l'expéditeur, ignoré, ni
//    rangé ni journalisé.
// ⚠️ ON NE JETTE PAS UN COLIS (§5) : un SMS de Mondial Relay d'une forme pas
//    encore apprise, s'il porte un n° de colis, est rangé « à vérifier » avec ce
//    n° SEUL (jamais le texte du SMS).
// La ligne rangée a LA FORME des e-mails de suivi Mondial Relay
// (`email_track_mondialrelay_{n°}`) : l'app, le widget et le rappel du matin la
// lisent sans rien changer à leurs règles (`relireLigneSuivi`, `etatRetrait`
// avec la garde de 5 j de Mondial Relay quand aucune date limite n'est connue).
// Fusion par n° de suivi : un e-mail déjà rangé GAGNE sur les champs qu'il a ;
// un « retiré » reste retiré (`conserverRetrait`, api/_lib/etat-colis-email.js).
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { conserverRetrait, normaliserSuivi } from './etat-colis-email.js';
import { vendeurParIndex, ecrireIndexJeton, memeJeton } from './jeton-index.js';
import { arriveLeAuRangement } from './arrivee-colis.js';
import { sbCle } from './cle.js';

// ── LE LECTEUR (pur) ─────────────────────────────────────────────────────────
const plat = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
// Un code d'AUTHENTIFICATION (vérification, connexion, mot de passe à usage
// unique) : jamais rangé, d'où qu'il vienne. Jugé AVANT tout le reste.
const AUTHENTIFICATION = /code\s+(?:de\s+|d['’]\s*)?(?:v[ée]rification|confirmation|s[ée]curit[ée]|validation|connexion|authentification|acc[èe]s|activation)|verification\s+code|one[- ]time|\bOTP\b|mot\s+de\s+passe|ne\s+(?:le\s+)?(?:communiquez|partagez|transmettez|donnez)/i;
const MARQUE_MR = /mondial\s*relay|mondialrelay\.|mrcolis|\bMRELAY\b/i;
const N_COLIS = /\bcolis\s+(?:n[°ºo]\s*)?(\d{8,14})\b/i;
// « Votre colis 81234567 est disponible au LOCKER 24/7 ENSEIGNE. Retirez-le vite avec le code 712345. »
const DISPONIBLE = /\bcolis\s+(?:n[°ºo]\s*)?(\d{8,14})\s+est\s+disponible\s+(?:au|à\s+la|a\s+la|à\s+l['’]|a\s+l['’]|dans\s+(?:le|la|votre)|chez)\s+([^.\n]{2,60}?)\s*\.\s.*?\bcode\s*:?\s*(\d{6})\b/i;
// « Au cas où le point de retrait pour votre colis 81234567 serait indisponible, sélectionnez-en un autre… »
const EN_ROUTE = /au\s+cas\s+o[uù]\s+le\s+point\s+de\s+retrait\s+pour\s+votre\s+colis\s+(?:n[°ºo]\s*)?(\d{8,14})\s+serait\s+indisponible/i;
export const CONSIGNE = /locker|consigne|casier/i;

const lieuPropre = (s) => {
  const l = plat(s).replace(/[®™©*_]+/g, ' ').replace(/[\s,;:–-]+$/, '').replace(/\s+/g, ' ').trim();
  if (l.length < 2 || l.length > 60 || /https?:|www\.|@/i.test(l) || !/[A-Za-zÀ-ÿ]{2}/.test(l)) return '';
  return l;
};

// Rend :
//   { type: 'ignore', raison: 'authentification' | 'pas-mondial-relay' | 'vide' }
//   { type: 'disponible', suivi, lieu, code, consigne }
//   { type: 'en_route', suivi }
//   { type: 'inconnu', suivi }             (Mondial Relay, forme pas apprise ; suivi peut être '')
export function lireSmsMondialRelay({ texte = '', expediteur = '' } = {}) {
  const t = plat(texte);
  if (!t) return { type: 'ignore', raison: 'vide' };
  if (AUTHENTIFICATION.test(t)) return { type: 'ignore', raison: 'authentification' };
  if (!MARQUE_MR.test(t) && !MARQUE_MR.test(plat(expediteur))) return { type: 'ignore', raison: 'pas-mondial-relay' };
  const d = DISPONIBLE.exec(t);
  if (d) {
    const suivi = normaliserSuivi(d[1]); const lieu = lieuPropre(d[2]); const code = d[3];
    if (suivi && lieu && code && code !== suivi) return { type: 'disponible', suivi, lieu, code, consigne: CONSIGNE.test(lieu) };
  }
  const r = EN_ROUTE.exec(t);
  if (r) return { type: 'en_route', suivi: normaliserSuivi(r[1]) };
  const n = N_COLIS.exec(t);
  return { type: 'inconnu', suivi: n ? normaliserSuivi(n[1]) : '' };
}

// ── LA LIGNE RANGÉE (pure) ───────────────────────────────────────────────────
// `prev` : la ligne `email_track_mondialrelay_{n°}` déjà rangée (ou null).
// Rend { data, action } — `data: null` ⇒ rien à écrire (et `action` dit pourquoi).
const isoOk = (v) => Number.isFinite(Date.parse(String(v || '')));
export const idLigneSms = (suivi) => `email_track_mondialrelay_${normaliserSuivi(suivi)}`;
export function ligneSms(lu, prev, { smsAt, maintenant } = {}) {
  if (!lu || !lu.suivi) return { data: null, action: 'sans-numero' };
  const p = prev && typeof prev === 'object' ? prev : null;
  const now = maintenant || new Date().toISOString();
  const at = isoOk(smsAt) ? new Date(Date.parse(smsAt)).toISOString() : now;
  const emailAt = [at, p && p.emailAt].filter(isoOk).sort().pop() || at;
  const base = { type: 'suivi', carrier: 'mondialrelay', suivi: lu.suivi };
  const smsTrace = { at, forme: lu.type };
  if (lu.type === 'disponible') {
    if (p && p.status === 'delivered') return { data: null, action: 'deja-retire' };
    const plusRecent = !!(p && isoOk(p.emailAt) && Date.parse(at) > Date.parse(p.emailAt));
    const subject = `Votre colis ${lu.suivi} est disponible au ${lu.lieu} (SMS Mondial Relay)`;
    if (!p) {
      return { action: 'range', data: { ...base, status: 'available', statusLabel: 'Arrivé au point de retrait (SMS)',
        subject, receivedAt: now, emailAt: at, arriveLe: arriveLeAuRangement(null, subject, 'available', at),
        code: lu.code, code2: null, artTitle: null, lieu: lu.lieu, limite: null, consigne: !!lu.consigne,
        qrB64: null, qrType: null, qrUrl: null, account: '', source: 'sms', sms: smsTrace } };
    }
    const garde = conserverRetrait(p, { status: 'available', label: 'Arrivé au point de retrait (SMS)' }, plusRecent);
    const status = garde.status;
    // Un e-mail plus riche GAGNE sur les champs qu'il a ; le SMS ne fait que combler.
    const data = { ...p, ...base,
      status, statusLabel: status === p.status ? (p.statusLabel || garde.label) : garde.label,
      subject: status === p.status ? (p.subject || subject) : subject,
      receivedAt: now, emailAt,
      code: p.code || lu.code, lieu: p.lieu || lu.lieu, consigne: !!(p.consigne || lu.consigne),
      limite: p.limite || null, sms: smsTrace, aussiSms: true };
    if (p.code && String(p.code) !== lu.code) data.codeSms = lu.code;       // dit à l'écran, jamais caché
    const a = arriveLeAuRangement(p, subject, status, at); if (a) data.arriveLe = a;
    if (p.smsAVerifier) delete data.smsAVerifier;
    return { action: status === 'available' ? 'fusionne' : 'garde-etat', data };
  }
  if (lu.type === 'en_route') {
    // « Au cas où… » ne prouve rien d'une arrivée ni d'un départ : il ne fait
    // jamais descendre une ligne déjà connue.
    if (p) return { data: null, action: 'deja-connu' };
    return { action: 'range', data: { ...base, status: 'transit', statusLabel: 'En route (SMS Mondial Relay)',
      subject: `SMS Mondial Relay : colis ${lu.suivi} en route`, receivedAt: now, emailAt: at,
      code: null, code2: null, artTitle: null, lieu: null, limite: null, consigne: false,
      qrB64: null, qrType: null, qrUrl: null, account: '', source: 'sms', sms: smsTrace } };
  }
  if (lu.type === 'inconnu') {
    if (p) return { data: null, action: 'deja-connu' };
    // Le n° SEUL, jamais le texte du SMS (il peut porter un code).
    return { action: 'a-verifier', data: { ...base, status: 'info', statusLabel: 'SMS Mondial Relay pas reconnu — à vérifier',
      subject: `SMS Mondial Relay pas reconnu (colis ${lu.suivi})`, receivedAt: now, emailAt: at,
      code: null, code2: null, artTitle: null, lieu: null, limite: null, consigne: false,
      qrB64: null, qrType: null, qrUrl: null, account: '', source: 'sms', smsAVerifier: true, sms: smsTrace } };
  }
  return { data: null, action: 'ignore' };
}

// La réponse courte (Raccourcis l'affiche si on la lui demande).
const fin4 = (s) => `…${String(s || '').slice(-4)}`;
export function messageSms(lu, action) {
  if (!lu || lu.type === 'ignore') return lu && lu.raison === 'authentification' ? 'Code de vérification : ignoré, rien rangé' : 'Pas un SMS de colis Mondial Relay : rien rangé';
  if (!lu.suivi) return 'SMS Mondial Relay sans n° de colis : rien rangé';
  const c = `Colis ${fin4(lu.suivi)}`;
  if (action === 'deja-retire') return `${c} déjà retiré : rien changé`;
  if (action === 'deja-connu') return `${c} déjà connu : rien changé`;
  if (lu.type === 'disponible') return `${c} rangé · code ✓ · ${lu.lieu}`;
  if (lu.type === 'en_route') return `${c} rangé · en route`;
  return `${c} rangé · à vérifier (SMS pas reconnu)`;
}

// ── LE JETON ─────────────────────────────────────────────────────────────────
// Le format seul (le jeton généré par l'app : 32 caractères [A-Za-z0-9]) : tout
// le reste est refusé AVANT toute lecture de la base. « coupe » (réception
// coupée) n'a pas ce format : il ne désigne personne.
export const jetonSmsValide = (k) => /^[A-Za-z0-9]{24,64}$/.test(String(k || ''));
export const SMS_PAR_HEURE = 60;
const heureDe = (ms) => new Date(ms).toISOString().slice(0, 13);

// Le corps envoyé par Raccourcis : JSON { texte, expediteur, date, essai } (autres
// noms acceptés), ou le texte brut.
export function corpsSms(req) {
  let b = req && req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = { texte: b }; } }
  if (!b || typeof b !== 'object') return null;
  const pick = (...ks) => { for (const k of ks) if (b[k] != null && b[k] !== '') return b[k]; return ''; };
  const texte = pick('texte', 'text', 'message', 'contenu', 'body', 'sms');
  return {
    texte: typeof texte === 'string' ? texte : String(texte || ''),
    expediteur: String(pick('expediteur', 'sender', 'from', 'de') || ''),
    date: String(pick('date', 'recuLe', 'receivedAt') || ''),
    essai: b.essai === true || b.essai === 'true' || b.essai === 1 || b.essai === '1',
  };
}
// La date du SMS : celle envoyée si elle est lisible et plausible (ni plus d'une
// heure dans le futur, ni plus de 30 jours en arrière), sinon l'heure de réception.
export function dateSms(v, maintenant = Date.now()) {
  const ms = Date.parse(String(v || ''));
  if (!Number.isFinite(ms) || ms > maintenant + 3600000 || ms < maintenant - 30 * 86400000) return new Date(maintenant).toISOString();
  return new Date(ms).toISOString();
}

// ── LA ROUTE (POST /api/widget?mode=sms&k=<jeton>) ───────────────────────────
// Trois états partout : une lecture ratée ⇒ 503, jamais une écriture ; une
// écriture ratée ⇒ 503 (Raccourcis peut renvoyer) ; jamais 200 sur un SMS pas rangé.
export async function routeSms(req, res, { url, key, maintenant = Date.now } = {}) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, erreur: 'POST seulement' }); return; }
  const H = { ...sbCle(key) };
  const k = String((req.query && (req.query.k || req.query.key)) || (req.headers && (req.headers['x-vrm-sms'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) || '');
  if (!jetonSmsValide(k)) { res.status(401).json({ ok: false, erreur: 'jeton invalide' }); return; }
  const corps = corpsSms(req);
  if (!corps) { res.status(400).json({ ok: false, erreur: 'corps illisible' }); return; }
  if (corps.texte.length > 1000) { res.status(413).json({ ok: false, erreur: 'SMS trop long' }); return; }
  // Base cloisonnée exigée (comme la réception des e-mails) : sans colonne
  // `owner`, on ne saurait pas à qui ranger.
  let cl = null;
  try { const r = await fetch(`${url}/rest/v1/app_data?select=owner&limit=1`, { headers: H }); cl = r.ok ? true : (r.status === 400 ? false : null); } catch (_) { cl = null; }
  if (cl !== true) { res.status(503).json({ ok: false, erreur: cl === false ? 'cloisonnement-requis' : 'base-injoignable' }); return; }
  // LE VENDEUR DU JETON. (7 nov., audit « 1 000 vendeurs ») D'abord l'INDEX
  // (api/_lib/jeton-index.js : une ligne lue par sa clé, le jeton re-comparé en
  // durée constante à celui du `main` désigné). Sans index (jeton d'avant, ou
  // jeton neuf) ⇒ l'ancienne recherche UNE fois — filtre exact sur le jeton
  // (format déjà vérifié : aucun caractère à échapper) ; aucun ⇒ 401 ; deux
  // vendeurs au même jeton ⇒ on ne choisit pas (409) — puis l'index est écrit.
  const idx = await vendeurParIndex({ url, headers: H, genre: 'sms', jeton: k });
  if (idx === undefined) { res.status(503).json({ ok: false, erreur: 'base-injoignable' }); return; }
  if (idx.etat === 'perime') { res.status(401).json({ ok: false, erreur: 'jeton invalide' }); return; }
  let owner = idx.etat === 'trouve' ? idx.owner : '';
  if (!owner) {
    let lignes = null;
    try {
      const r = await fetch(`${url}/rest/v1/app_data?id=eq.main&data->>vrm_sms_token=eq.${k}&select=owner,t:data->>vrm_sms_token&limit=2`, { headers: H });
      const j = r.ok ? await r.json() : null; lignes = Array.isArray(j) ? j : null;
    } catch (_) { lignes = null; }
    if (lignes === null) { res.status(503).json({ ok: false, erreur: 'base-injoignable' }); return; }
    if (!lignes.length || !lignes[0].owner || !memeJeton(k, lignes[0].t)) { res.status(401).json({ ok: false, erreur: 'jeton invalide' }); return; }
    if (lignes.length > 1) { res.status(409).json({ ok: false, erreur: 'jeton ambigu' }); return; }
    owner = String(lignes[0].owner);
    await ecrireIndexJeton({ url, headers: H, genre: 'sms', jeton: k, owner });
  }
  const ow = `owner=eq.${encodeURIComponent(owner)}`;
  const nowMs = typeof maintenant === 'function' ? maintenant() : Number(maintenant);
  const lu = lireSmsMondialRelay(corps);
  const smsAt = dateSms(corps.date, nowMs);
  const lireLigne = async (id) => {
    try {
      const r = await fetch(`${url}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&${ow}&select=data`, { headers: H });
      if (!r.ok) return { lu: false };
      const j = await r.json(); if (!Array.isArray(j)) return { lu: false };
      return { lu: true, data: (j[0] && j[0].data) || null };
    } catch (_) { return { lu: false }; }
  };
  const ecrire = async (id, data) => {
    try {
      const r = await fetch(`${url}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ owner, id, data }]) });
      return !!(r && r.ok);
    } catch (_) { return false; }
  };
  // MODE ESSAI (bouton « Tester » de l'app) : le jeton est vérifié, le SMS lu,
  // et RIEN n'est écrit — ni colis, ni compteur.
  if (corps.essai) {
    const ligne = lu.suivi ? ligneSms(lu, null, { smsAt, maintenant: new Date(nowMs).toISOString() }) : { data: null, action: lu.type === 'ignore' ? 'ignore' : 'sans-numero' };
    res.status(200).json({ ok: true, essai: true, range: false, lu: lu.type === 'ignore' ? { type: 'ignore', raison: lu.raison } : lu, ligne: ligne.data ? { status: ligne.data.status, lieu: ligne.data.lieu, consigne: ligne.data.consigne, code: ligne.data.code ? '✓' : '' } : null, message: `Essai : ${messageSms(lu, ligne.action)} (rien n'a été rangé)` });
    return;
  }
  // ANTI-ABUS : 60 SMS par heure et par jeton (`vrm_sms_compteur`, chez lui).
  const cpt = await lireLigne('vrm_sms_compteur');
  if (!cpt.lu) { res.status(503).json({ ok: false, erreur: 'base-injoignable' }); return; }
  const h = heureDe(nowMs);
  const n = cpt.data && cpt.data.heure === h && Number.isFinite(cpt.data.n) ? cpt.data.n : 0;
  if (n >= SMS_PAR_HEURE) { res.status(429).json({ ok: false, erreur: 'trop de SMS', message: `Plus de ${SMS_PAR_HEURE} SMS cette heure-ci : rien rangé` }); return; }
  if (!(await ecrire('vrm_sms_compteur', { heure: h, n: n + 1 }))) { res.status(503).json({ ok: false, erreur: 'ecriture-ratee' }); return; }
  if (lu.type === 'ignore' || !lu.suivi) { res.status(200).json({ ok: true, range: false, type: lu.type, raison: lu.raison || 'sans-numero', message: messageSms(lu) }); return; }
  const id = idLigneSms(lu.suivi);
  const avant = await lireLigne(id);
  if (!avant.lu) { res.status(503).json({ ok: false, erreur: 'base-injoignable' }); return; }
  const l = ligneSms(lu, avant.data, { smsAt, maintenant: new Date(nowMs).toISOString() });
  if (!l.data) { res.status(200).json({ ok: true, range: false, type: lu.type, action: l.action, message: messageSms(lu, l.action) }); return; }
  if (!(await ecrire(id, l.data))) { res.status(503).json({ ok: false, erreur: 'ecriture-ratee', message: 'Pas rangé : réessaie' }); return; }
  res.status(200).json({ ok: true, range: true, type: lu.type, action: l.action, ligne: id, message: messageSms(lu, l.action) });
}

// Un jeton neuf (côté serveur, pour les audits ; l'app a le sien, même format).
export const nouveauJetonSms = () => crypto.randomBytes(24).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 32).padEnd(32, '0');
