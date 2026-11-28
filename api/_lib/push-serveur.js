// ════════════════════════════════════════════════════════════════════════════
//  « MODE ORDINATEUR ALLUMÉ » : LE MESSAGE, L'OFFRE, LE COMPTE DÉCONNECTÉ (28 nov., ext. 5.457.0, `serveur`)
// ════════════════════════════════════════════════════════════════════════════
// Julien (28 nov.) : « je veux une notification dès qu'il y a vraiment un nouveau message, avec la vraie question de la
// personne et le nom du compte Vinted si j'en ai plusieurs. » — sa décision remplace, pour CE chemin, la règle du 21 nov.
// (« le texte du message ne part jamais ») : le texte part, nettoyé et coupé proprement (`srvTexte`).
//
// Le chemin : la veille de l'extension (background.js, section « ORDINATEUR SERVEUR ») relit la boîte du compte de SON
// profil, range le fil de chaque conversation neuve (`harvest_{uid}_conv_{conv}`), PUIS appelle
// `POST /api/push { action:'serveur', evenements:[{ s, c, conv, mid|oid } | { s:'deconnecte', c, at }] }`.
// ⚠️ LE CORPS NE PORTE QUE DES IDENTITÉS. Le texte, le pseudo, le titre, le montant sont RELUS ICI, au nom du vendeur de
//    la session, dans SES lignes (projections scalaires, §4.4) : un compte Vinted qui n'est pas à lui, un message qui
//    n'est pas dans le fil rangé, un message de lui-même, une offre qui n'attend plus ⇒ rien ne sonne.
// ⚠️ JAMAIS DEUX FOIS : la clé de l'objet est réservée dans `push_dedup` AVANT l'envoi (comparer-et-échanger). L'offre
//    porte la clé de la voie « capte » (`offer-capte-vinted-{n°}`) : l'une des deux se tait.
// ⚠️ L'E-MAIL D'APRÈS SE TAIT : chaque conversation sonnée ici est notée dans `push_serveur_vu` (compte, instant du
//    message) ; l'e-mail « nouveau message / nouvelle offre » de Vinted qui porte CETTE conversation (son lien
//    /inbox/{id}) dans les 45 min ne sonne pas (`serveurDejaSonne`, api/email-inbound.js).
// ⚠️ UNE LECTURE RATÉE N'ENVOIE RIEN ET NE RÉSERVE RIEN (503) : l'extension garde ses événements et rappelle.

import { sendPushToAll, prefsDuVendeur, langueDuVendeur } from './push.js';
import { modifierCas } from './suivi-vinted.js';
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { DESTINATIONS, lienNotif } from './lien-notif.js';
import { decisionNotif } from './notif-textes.js';
import { montantClair } from './notif-redaction.js';
import { srvTexte, srvMs, SRV_EMAIL_FENETRE_MS } from '../../src/ordinateurServeur.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
export const SERVEUR_MAX = 20;
const str = (v) => String(v == null ? '' : v).trim();
const propre = (s, n) => str(s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const pseudoSur = (s) => { const x = str(s); return /^[\w.-]{2,30}$/.test(x) && !/@/.test(x) ? x : ''; };
const RE_N = /^\d{1,20}$/;

// ── 1. LA FORME DU CORPS (identités seulement) ─────────────────────────────
export function evenementServeur(x) {
  if (!x || typeof x !== 'object') return null;
  const s = str(x.s), c = str(x.c);
  if (!RE_N.test(c)) return null;
  if (s === 'message') return RE_N.test(str(x.conv)) && RE_N.test(str(x.mid)) ? { s, c, conv: str(x.conv), mid: str(x.mid), n: Math.min(20, Math.max(1, Number(x.n) || 1)) } : null;
  if (s === 'offre') return RE_N.test(str(x.conv)) && RE_N.test(str(x.oid)) ? { s, c, conv: str(x.conv), oid: str(x.oid) } : null;
  if (s === 'deconnecte') { const at = Number(x.at); return Number.isInteger(at) && at > 1.6e12 && at < 4e12 ? { s, c, at, ordi: propre(x.ordi, 40) } : null; }
  return null;
}
export function cleServeur(e) {
  if (e.s === 'offre') return `offer-capte-vinted-${e.oid}`;               // la MÊME clé que la voie « capte »
  if (e.s === 'message') return `msg-srv-vinted-${e.conv}-${e.mid}`;
  return `srv-deco-${e.c}-${e.at}`;
}

// ── 2. CE QUI EST RELU ─────────────────────────────────────────────────────
async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(SUPABASE_KEY()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
const prixDe = (v) => { const a = v && typeof v === 'object' ? v.amount : v; const n = Number(String(a == null ? '' : a).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
// Rend { d } · { rien: raison } · null (pas su).
export async function relireServeur(e, comptes, memo = new Map()) {
  const compte = comptes.find((a) => str(a && a.vinted_user_id) === e.c);
  if (!compte) return { rien: 'compte' };
  const nom = pseudoSur(compte.login) || '';
  if (e.s === 'deconnecte') return { d: { nom } };
  const k = 'conv:' + e.c + ':' + e.conv;
  if (!memo.has(k)) memo.set(k, await lire(`app_data?id=eq.harvest_${e.c}_conv_${e.conv}&select=cid:data->payload->conversation->>id,opp:data->payload->conversation->opposite_user->>id,login:data->payload->conversation->opposite_user->>login,ti:data->payload->conversation->transaction->>item_title,msgs:data->payload->conversation->messages`));
  const rows = memo.get(k);
  if (rows === null) return null;
  const r = rows[0];
  if (!r || str(r.cid) !== e.conv) return { rien: 'conversation' };
  const opp = str(r.opp);
  const msgs = Array.isArray(r.msgs) ? r.msgs : [];
  const de = (en) => str(en && en.user_id);
  const base = { nom, pseudo: pseudoSur(r.login), titre: propre(r.ti, 70) };
  if (e.s === 'message') {
    const m = msgs.find((x) => x && x.entity_type === 'message' && x.entity && str(x.entity.id) === e.mid);
    const en = m && m.entity;
    if (!en) return { rien: 'pas-dans-le-fil' };
    if (!de(en) || de(en) === e.c || (opp && de(en) !== opp)) return { rien: 'de-moi' };
    const texte = srvTexte(en.body);
    if (!texte) return { rien: 'vide' };
    return { d: { ...base, texte, at: srvMs(m.created_at_ts != null ? m.created_at_ts : en.created_at_ts) } };
  }
  const m = msgs.find((x) => x && x.entity_type === 'offer_request_message' && x.entity && str(x.entity.offer_request_id) === e.oid);
  const en = m && m.entity;
  if (!en || !de(en) || de(en) === e.c || (opp && de(en) !== opp) || en.current === false || Number(en.status) !== 10 || /accept|refus|reject|expir|annul|cancel|retir/i.test(str(en.status_title))) return { rien: 'offre-pas-en-attente' };
  const prix = prixDe(en.price);
  if (prix == null) return { rien: 'prix' };
  return { d: { ...base, prix, at: srvMs(m.created_at_ts != null ? m.created_at_ts : en.created_at_ts) } };
}

// ── 3. LES TEXTES (cinq langues) ───────────────────────────────────────────
const L = {
  fr: { msg: 'Message de', nouveau: 'Nouveau message', offre: 'Offre', sur: 'sur', compte: 'compte', repondre: 'Répondre', deco: (n) => `Compte ${n} déconnecté`, decoSous: (o) => `Sur ${o || 'ton ordinateur allumé'} : ouvre ce profil Chrome et reconnecte-toi sur vinted.fr`, autres: (k) => `+${k} autre${k > 1 ? 's' : ''}` },
  en: { msg: 'Message from', nouveau: 'New message', offre: 'Offer', sur: 'on', compte: 'account', repondre: 'Reply', deco: (n) => `Account ${n} signed out`, decoSous: (o) => `On ${o || 'your always-on computer'}: open this Chrome profile and sign in again on vinted.fr`, autres: (k) => `+${k} more` },
  es: { msg: 'Mensaje de', nouveau: 'Nuevo mensaje', offre: 'Oferta', sur: 'por', compte: 'cuenta', repondre: 'Responder', deco: (n) => `Cuenta ${n} desconectada`, decoSous: (o) => `En ${o || 'tu ordenador encendido'}: abre este perfil de Chrome y vuelve a iniciar sesión en vinted.fr`, autres: (k) => `+${k} más` },
  it: { msg: 'Messaggio da', nouveau: 'Nuovo messaggio', offre: 'Offerta', sur: 'su', compte: 'account', repondre: 'Rispondi', deco: (n) => `Account ${n} disconnesso`, decoSous: (o) => `Su ${o || 'il computer acceso'}: apri questo profilo di Chrome e accedi di nuovo su vinted.fr`, autres: (k) => `+${k} altri` },
  de: { msg: 'Nachricht von', nouveau: 'Neue Nachricht', offre: 'Angebot', sur: 'für', compte: 'Konto', repondre: 'Antworten', deco: (n) => `Konto ${n} abgemeldet`, decoSous: (o) => `Auf ${o || 'deinem Dauer-Computer'}: öffne dieses Chrome-Profil und melde dich auf vinted.fr wieder an`, autres: (k) => `+${k} weitere` },
};
const lng = (l) => (L[l] ? l : 'fr');
// `plusieurs` : le vendeur a plusieurs comptes Vinted ⇒ le nom du compte est dit (Julien : « si j'en ai plusieurs »).
export function texteServeur(e, d = {}, langue = 'fr', plusieurs = true) {
  const t = L[lng(langue)];
  const compte = plusieurs && d.nom ? `${t.compte} ${d.nom}` : '';
  const pseudo = d.pseudo ? '@' + d.pseudo : '';
  if (e.s === 'deconnecte') return { title: t.deco(d.nom || e.c), body: t.decoSous(e.ordi) };
  if (e.s === 'offre') {
    const prix = montantClair(d.prix, lng(langue));
    return { title: [`${t.offre} ${prix}`, d.titre ? `${t.sur} ${d.titre}` : ''].filter(Boolean).join(' '), body: [compte, pseudo, t.repondre].filter(Boolean).join(' · ') };
  }
  return { title: pseudo ? `${t.msg} ${pseudo}` : t.nouveau, body: [d.texte || '', compte, d.titre || '', e.n > 1 ? t.autres(e.n - 1) : ''].filter(Boolean).join(' · ') };
}
export function urlServeur(e) {
  if (e.s === 'offre') return DESTINATIONS.offre({ conv: e.conv, compte: e.c });
  if (e.s === 'message') return DESTINATIONS.message({ conv: e.conv, compte: e.c });
  return lienNotif('serveur', { compte: e.c });
}

// ── 4. L'E-MAIL D'APRÈS (api/email-inbound.js) ─────────────────────────────
// Vrai si CETTE conversation a sonné ici pour un message daté dans les 45 min avant l'e-mail. Pas su ⇒ faux (l'e-mail
// sonne : une notification de trop se répare, un message avalé non).
export async function serveurDejaSonne(conv, maintenant = Date.now()) {
  if (!RE_N.test(str(conv))) return false;
  const rows = await lire(`app_data?id=eq.push_serveur_vu&select=v:data->c->%22${encodeURIComponent(str(conv))}%22`);
  const v = rows && rows[0] && rows[0].v;
  if (!v || typeof v !== 'object') return false;
  const at = Number(v.msgAt) || Number(v.at) || 0;
  return at > 0 && maintenant - at < SRV_EMAIL_FENETRE_MS && at <= maintenant + 60000;
}
async function noterSonne(liste, maintenant) {
  if (!liste.length) return true;
  const r = await modifierCas('push_serveur_vu', (d) => {
    const c = Object.assign({}, d && d.c && typeof d.c === 'object' ? d.c : {});
    for (const x of liste) c[x.conv] = { at: maintenant, msgAt: Number(x.at) || maintenant, compte: x.c };
    const ks = Object.keys(c).sort((a, b) => (Number(c[b].at) || 0) - (Number(c[a].at) || 0));
    for (const k of ks.slice(300)) delete c[k];
    return { ...(d || {}), c };
  });
  return r === true;
}

// ── 5. LA ROUTE ────────────────────────────────────────────────────────────
export async function notifierServeur(body, maintenant = Date.now()) {
  const brut = Array.isArray(body && body.evenements) ? body.evenements.slice(0, SERVEUR_MAX * 3) : [];
  const evs = []; const vus = new Set();
  for (const x of brut) { const e = evenementServeur(x); if (!e) continue; const k = cleServeur(e); if (vus.has(k)) continue; vus.add(k); evs.push(e); if (evs.length >= SERVEUR_MAX) break; }
  if (!evs.length) return { status: 400, raison: 'evenements' };
  const owner = proprietaireCourant();
  if (!owner) return { status: 401, raison: 'session' };
  const prefs = (await prefsDuVendeur()) || {};
  const permis = evs.filter((e) => decisionNotif(prefs, e.s === 'offre' ? 'offre' : e.s === 'message' ? 'message' : 'capture'));
  const coupe = evs.length - permis.length;
  if (!permis.length) return { status: 200, envoye: false, coupe, n: 0 };
  const comptes = await lire('vinted_accounts?select=vinted_user_id,login');
  if (comptes === null) return { status: 503, raison: 'pas-su' };
  const plusieurs = comptes.length > 1;
  const memo = new Map(); const prouves = []; let rien = 0;
  for (const e of permis) {
    const r = await relireServeur(e, comptes, memo);
    if (r === null) return { status: 503, raison: 'pas-su' };
    if (r.rien) { rien++; continue; }
    prouves.push({ e, d: r.d || {} });
  }
  if (!prouves.length) return { status: 200, envoye: false, coupe, rien, n: 0 };
  let neufs = [];
  const res = await modifierCas('push_dedup', (d) => {
    const ks = d && Array.isArray(d.keys) ? d.keys.filter((x) => typeof x === 'string') : [];
    neufs = prouves.filter((x) => !ks.includes(cleServeur(x.e)));
    if (!neufs.length) return undefined;
    return { ...(d || {}), keys: [...neufs.map((x) => cleServeur(x.e)), ...ks].slice(0, 300) };
  });
  if (res === null) return { status: 503, raison: 'pas-su' };
  const deja = prouves.length - neufs.length;
  if (res === false || !neufs.length) return { status: 200, envoye: false, coupe, rien, deja, n: 0 };
  // L'e-mail d'après se taira (pas su ⇒ on envoie quand même : l'e-mail sonnera, rien n'est avalé).
  await noterSonne(neufs.filter((x) => x.e.s !== 'deconnecte').map((x) => ({ conv: x.e.conv, c: x.e.c, at: x.d.at })), maintenant).catch(() => false);
  const langue = await langueDuVendeur().catch(() => 'fr');
  let envoyes = 0;
  // UNE notification par conversation (et par compte déconnecté) : chacune dit SA question, SON compte.
  for (const { e, d } of neufs) {
    const t = texteServeur(e, d, langue, plusieurs);
    const envoi = await sendPushToAll({ cat: e.s === 'offre' ? 'offre' : e.s === 'message' ? 'message' : 'capture', title: t.title, body: t.body, tag: cleServeur(e), cle: cleServeur(e), url: urlServeur(e) });
    if (envoi && (envoi.sent > 0 || envoi.calme || envoi.attente)) envoyes++;
  }
  return { status: 200, envoye: envoyes > 0, n: neufs.length, coupe, rien, deja };
}
