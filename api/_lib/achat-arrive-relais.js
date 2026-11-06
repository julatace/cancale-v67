// api/_lib/achat-arrive-relais.js
// ────────────────────────────────────────────────────────────────────────────
// (3 nov.) « COMMANDE MISE À JOUR POUR <titre> » — L'ACHAT QUI T'ATTEND.
//
// Mesuré sur sa base (3 nov., lecture seule) : Vinted envoie à l'ACHETEUR, au
// sujet « Commande mise à jour pour <titre de l'article> », trois tournures qui
// disent qu'un de SES achats est arrivé :
//   · « Ton achat t'attend au point relais <NOM>, <RUE>, <CP> <VILLE> »
//   · « Ta commande t'attend ici : <NOM>, <RUE>, <CP> <Ville>. Utilise le code
//       <CODE> pour la retirer. »                                   (consigne)
//   · « Ton colis a été livré dans le Point Relais <NOM>, <RUE>, <CP> <Ville>.
//       Tu peux, dès maintenant, aller le récupérer. »
// Toutes classées « connu-sans-action » jusqu'ici : aucun colis à retirer.
// 58 colis en 30 jours, dont les 9 de Cancale du 2-3 nov.
//
// L'IDENTITÉ : le lien « Aller sur la conversation » mène (via un lien de suivi
// `links.vinted.com/t/<base64>`) à `vinted.fr/inbox/<id>` — l'`id` est le
// `conversation_id` de la commande (liste « Mes commandes ») et le
// `user_msg_thread_id` de sa transaction. Mesuré : 47 des 58 conversations
// sont celles d'une commande relevée. JAMAIS le titre du sujet (22 % de titres
// en double) : le titre n'est qu'un LIBELLÉ.
//
// Pur : aucune lecture, aucune écriture. Une règle, testée par
// `scripts/audit-achat-attend-relais.cjs`.
// ────────────────────────────────────────────────────────────────────────────

const SUJET = /^\s*(?:(?:TR|Fwd?|Re)\s*:\s*)*Commande mise [àa] jour pour\s+(.+?)\s*$/i;

// Le texte lisible : les blancs (retours à la ligne de 76 colonnes compris)
// ramenés à une espace.
const plat = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

// Les trois tournures. Le lieu s'arrête au point final de la phrase (jamais
// dans le pied d'e-mail) : avant « Utilise le code », « Tu peux », « Aller sur ».
const FORMES = [
  { forme: 'attend', re: /Ton achat t['’]attend au point relais\s+(.+?)(?:\s*\.\s|\s+Aller sur la conversation|\s*$)/i },
  { forme: 'ici', re: /Ta commande t['’]attend ici\s*:\s*(.+?)(?:\s*\.\s*Utilise|\s*\.\s|\s+Aller sur la conversation|\s*$)/i },
  { forme: 'livre', re: /Ton colis a [ée]t[ée] livr[ée] dans le Point Relais\s+(.+?)(?:\s*\.\s*Tu peux|\s*\.\s|\s+Aller sur la conversation|\s*$)/i },
];

// Le lieu : « NOM, RUE, CP VILLE » tel qu'écrit, sans « , France » ni point
// final. Il faut un code postal (5 chiffres) : sans lui ce n'est pas un lieu.
export function lieuDeLArrivee(brut) {
  let s = plat(brut).replace(/[<\[][^>\]]*[>\]]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/[.\s]+$/, '').replace(/,\s*France$/i, '').trim();
  if (!/\b\d{5}\b/.test(s) || s.length > 160) return '';
  return s;
}

// L'identité de la conversation : directe (`/inbox/<id>`) ou dans un lien de
// suivi Vinted (`links.vinted.com/…/t/<base64>`). Un UUID (forme d'aujourd'hui)
// ou un nombre (forme ancienne). Deux conversations différentes dans le même
// e-mail ⇒ '' (on ne choisit pas).
const INBOX = /vinted\.[a-z.]{2,8}(?:\/|%2F)inbox(?:\/|%2F)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{3,20})(?![0-9a-z-])/gi;
const SUIVI = /links\.vinted\.com\/(?:e\/)?t\/([A-Za-z0-9_\-+/]{16,}={0,2})/g;
// ⚠️ (6 nov., statut des colis) LE MÊME DÉCODAGE DANS LE NAVIGATEUR. `Buffer` n'existe
// que dans Node : l'app (src/arriveesRelues.js, la relecture des e-mails gardés avant
// le 3 nov.) rendait '' ici, sans erreur — la conversation du lien de suivi était
// perdue, la ligne prenait une clé d'empreinte (`…_arr-…`) et n'avait plus d'identité.
// Mesuré sur sa base : 49 e-mails Vinted relus, dont 32 d'achats « Transaction
// finalisée » — affichés « à vérifier » ou « peut-être en double » au lieu de finis.
// `atob` (navigateur, Node ≥ 16) + `TextDecoder` pour l'UTF-8 ; `Buffer` sinon.
function decoder64(b) {
  try {
    let n = b.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    // Un lien COUPÉ (corps gardé à 2 000 caractères) : un dernier caractère seul ne
    // porte aucun octet — `Buffer` l'ignore, `atob` refuse tout ; on l'ignore aussi.
    if (n.length % 4 === 1) n = n.slice(0, -1);
    const p = n + '='.repeat((4 - (n.length % 4)) % 4);
    if (typeof atob === 'function') {
      const bin = atob(p);
      if (typeof TextDecoder === 'function') { const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return new TextDecoder('utf-8').decode(o); }
      return bin;
    }
    return typeof Buffer !== 'undefined' ? Buffer.from(p, 'base64').toString('utf8') : '';
  } catch (_) { return ''; }
}
export function conversationVinted(mail) {
  // Le quoted-printable déjà décodé par la lecture de l'e-mail ; un « =\n »
  // resté dans un lien est recollé par prudence.
  const t = `${(mail && mail.html) || ''}\n${(mail && mail.text) || ''}`.replace(/=\r?\n/g, '').replace(/&amp;/g, '&');
  const vus = new Set();
  for (const m of t.matchAll(INBOX)) vus.add(m[1].toLowerCase());
  for (const m of t.matchAll(SUIVI)) {
    const d = decoder64(m[1]);
    for (const k of d.matchAll(INBOX)) vus.add(k[1].toLowerCase());
  }
  return vus.size === 1 ? [...vus][0] : '';
}

// Lecture complète. null ⇒ ce n'est pas un e-mail d'achat arrivé (la famille
// « commande mise à jour » d'avant le garde).
export function lireArriveeAchat(mail, texte) {
  const sujet = String((mail && mail.subject) || '');
  const ms = SUJET.exec(sujet);
  if (!ms) return null;
  const corps = plat(texte);
  for (const f of FORMES) {
    const m = f.re.exec(corps);
    if (!m) continue;
    const lieu = lieuDeLArrivee(m[1]);
    const code = f.forme === 'ici' ? ((/Utilise le code\s+([A-Z0-9]{4,12})\s+pour la retirer/i.exec(corps) || [])[1] || '') : '';
    return { forme: f.forme, titre: ms[1].slice(0, 140), lieu, code: code || null, conv: conversationVinted(mail) };
  }
  return null;
}

// La clé de la ligne : la conversation (un colis = une conversation), sinon le
// Message-ID (jamais le titre). Les deux étapes d'un même colis (« t'attend »
// puis « livré dans le Point Relais ») tombent sur la même ligne.
// L'empreinte est calculée ICI (la même au serveur et dans l'app : une relecture
// retombe sur la ligne que le serveur aurait rangée).
function empreinte(s) {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = (h1 * 33) ^ c; h2 = (h2 * 33) ^ c; }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
export function cleArrivee(lu, messageId) {
  if (lu && lu.conv) return `email_track_autre_conv-${lu.conv}`;
  const m = String(messageId || '').trim();
  return `email_track_autre_arr-${empreinte(m || `${lu ? lu.titre : ''}|${lu ? lu.lieu : ''}|${lu ? lu.forme : ''}`)}`;
}

// La commande d'une ligne par SA conversation (identité) — une seule, sinon
// personne. Partagé avec l'app (`src/App.jsx`, `commandeDuColis`).
export function achatParConversation(conv, achats) {
  const c = String(conv || '').toLowerCase();
  if (!c) return null;
  const vus = new Map();
  for (const a of achats || []) {
    if (a && a.conversation_id != null && String(a.conversation_id).toLowerCase() === c) vus.set(String(a.transaction_id), a);
  }
  return vus.size === 1 ? [...vus.values()][0] : null;
}

// Le code postal d'un lieu (pour le DOUTE seulement, jamais pour relier).
export function cpDuLieu(lieu) {
  const m = /\b(\d{5})\b/.exec(String(lieu || ''));
  return m ? m[1] : '';
}

// ── UN COLIS, UNE LIGNE — DANS LA LISTE « À RETIRER » (§11 : l'app l'appelle) ──
// `liste` : les lignes d'e-mail à retirer ; `commandeDe(t)` : la commande reliée
// par IDENTITÉ (conversation, n° de suivi, code) ou null ; `score`, `fusion` :
// la règle de l'app pour garder la ligne la plus complète.
// 1. Deux lignes qui mènent à la MÊME commande sont le même colis : une ligne.
// 2. Une ligne annoncée par Vinted SANS commande, au même code postal qu'une
//    ligne de transporteur elle aussi sans commande : peut-être le même carton,
//    rien ne le dit ⇒ `doutes` (montrée « à vérifier », jamais comptée deux fois).
//    Seule à son code postal, elle reste à retirer. Le titre n'entre jamais ici.
// ── (5 nov.) LE DOUTE, ÉLARGI — mesuré sur sa base : 16 e-mails Vinted « ton achat
// t'attend » d'une adresse sans compte relié, et 17 e-mails Mondial Relay « disponible »
// au même point, même adresse de réception, les mêmes jours. Le transporteur dit 13 de
// ces 17 RETIRÉS : ils sortaient de la comparaison (seuls les colis encore à retirer
// comptaient), et les 16 moitiés Vinted redevenaient « à retirer » — 33 au lieu de ~10.
// Trois changements, toujours sans relier rien par le titre :
//  · `temoins` : les lignes de TRANSPORTEUR (n° de suivi) déjà vues à ce point, FINIES
//    COMPRISES, arrivées à ±3 jours ; un colis retiré reste un témoin de son arrivée ;
//  · le point est le même LIEU (nom propre + code postal quand les deux le donnent :
//    « Consigne Vinted Go, Nom, 13 Rue… » = « Nom, 13 Rue…, 56000 Ville »),
//    et la même adresse de réception quand les deux la connaissent ;
//  · `sansIdentite(t, commande)` : une ligne Vinted RELIÉE à sa commande, mais dont la
//    commande n'a aucun n° de suivi connu, n'a pas d'identité vers le transporteur : elle
//    peut être la moitié Vinted d'une ligne de transporteur sans commande.
// Une ligne de transporteur reliée à une AUTRE commande n'est jamais son témoin.
const NOM_LIEU_PREFIXE = /^(?:\s*(?:consigne\s+vinted\s+go|point\s+relais|relais\s+pickup|locker)\s*[,:-]?\s*)+/i;
export function cleLieuDoute(lieu) {
  const s = String(lieu || '').replace(/[’']/g, '').trim();
  if (!s) return null;
  const sansPrefixe = s.replace(NOM_LIEU_PREFIXE, '');
  const nom = (sansPrefixe.split(',')[0] || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!nom) return null;
  return { nom, cp: cpDuLieu(s) };
}
const memeLieu = (a, b) => !!a && !!b && a.nom === b.nom && (!a.cp || !b.cp || a.cp === b.cp);
const destinataire = (t) => {
  const a = String((t && t.account) || '').trim().toLowerCase();
  const r = Array.isArray(t && t.recuSur) && t.recuSur[0] ? String(t.recuSur[0]).trim().toLowerCase() : '';
  return { a, r };
};
const memeDestinataire = (x, y) => {
  const a = destinataire(x), b = destinataire(y);
  if (a.a && b.a) return a.a === b.a;
  if (a.r && b.r) return a.r === b.r;
  return true;
};
const arriveeMs = (t) => { for (const k of ['arriveLe', 'emailAt', 'receivedAt']) { const v = Date.parse((t && t[k]) || ''); if (Number.isFinite(v)) return v; } return NaN; };
export const FENETRE_DOUTE_J = 3;
export function aUnTemoin(t, cmd, temoins, { commandeDe = () => null, fenetreJ = FENETRE_DOUTE_J } = {}) {
  const lt = cleLieuDoute(t && t.lieu); if (!lt) return false;
  const at = arriveeMs(t);
  const txT = cmd && cmd.transaction_id != null ? String(cmd.transaction_id) : '';
  return (temoins || []).some((w) => {
    if (!w || w === t || w.source === 'vinted-commande') return false;
    if (!memeLieu(lt, cleLieuDoute(w.lieu)) || !memeDestinataire(t, w)) return false;
    const cw = commandeDe(w); const txW = cw && cw.transaction_id != null ? String(cw.transaction_id) : '';
    if (txT && txW && txT !== txW) return false;
    const aw = arriveeMs(w);
    return !Number.isFinite(at) || !Number.isFinite(aw) || Math.abs(aw - at) <= fenetreJ * 86400000;
  });
}
export function regrouperArrivees(liste, { commandeDe, score = () => 0, fusion = (m, s) => ({ ...s, ...m }), temoins = null, sansIdentite = null } = {}) {
  const parTx = new Map(); const garde = []; const cmds = [];
  for (const t of liste || []) {
    const c = commandeDe(t); const k = c && c.transaction_id != null ? String(c.transaction_id) : '';
    if (!k) { garde.push(t); cmds.push(null); continue; }
    if (!parTx.has(k)) { parTx.set(k, garde.length); garde.push(t); cmds.push(c); continue; }
    const i = parTx.get(k); const a = garde[i];
    const [m, s] = score(t) > score(a) ? [t, a] : [a, t];
    garde[i] = { ...fusion(m, s), artTitle: m.artTitle || s.artTitle || null, conv: m.conv || s.conv || '', source: m.source || s.source };
  }
  const cpOrphelins = new Map();
  garde.forEach((t, i) => { if (!cmds[i] && t.source !== 'vinted-commande') { const cp = cpDuLieu(t.lieu); if (cp) cpOrphelins.set(cp, (cpOrphelins.get(cp) || 0) + 1); } });
  const reste = [], doutes = [], commandes = [], doutesCommandes = [];
  garde.forEach((t, i) => {
    if (t.source === 'vinted-commande' && (!cmds[i] || (sansIdentite && sansIdentite(t, cmds[i])))) {
      const doute = Array.isArray(temoins)
        ? aUnTemoin(t, cmds[i], temoins, { commandeDe })
        : (!cmds[i] && (() => { const cp = cpDuLieu(t.lieu); return !!cp && cpOrphelins.get(cp) > 0; })());
      if (doute) { doutes.push(t); doutesCommandes.push(cmds[i] || null); return; }
    }
    reste.push(t); commandes.push(cmds[i]);
  });
  return { liste: reste, doutes, commandes, doutesCommandes };
}

// ── LA LIGNE RANGÉE (une forme pour le serveur ET la relecture de l'app) ──────
// `prev` : la ligne déjà rangée sous la même clé (ou null). La PREMIÈRE arrivée
// reste l'arrivée ; un « retiré » rangé n'est jamais redescendu ; ce qui est déjà
// su (code, QR, limite, n° de suivi) n'est jamais effacé.
const dateOk = (x) => Number.isFinite(Date.parse(x || ''));
export function ligneArrivee(lu, { cleLigne, subject, emailAt, recuLe, prev = null, account = '', recuSur = null } = {}) {
  const p = prev || {};
  const arriveLe = [emailAt, p.arriveLe].filter(dateOk).sort()[0] || emailAt || recuLe || null;
  const emailAtLigne = [emailAt, p.emailAt].filter(dateOk).sort().pop() || emailAt || null;
  const retire = p.status === 'delivered';
  return {
    ...p,
    type: 'suivi', carrier: p.carrier && p.carrier !== 'autre' ? p.carrier : 'autre', suivi: p.suivi || '',
    status: retire ? 'delivered' : 'available',
    statusLabel: retire ? (p.statusLabel || 'Livré / retiré') : 'Arrivé au point relais (Vinted)',
    subject, receivedAt: recuLe || p.receivedAt || emailAt || null,
    emailAt: emailAtLigne, arriveLe,
    code: lu.code || p.code || null, code2: p.code2 || null,
    artTitle: lu.titre, lieu: lu.lieu || p.lieu || null,
    limite: p.limite || null, consigne: lu.forme === 'ici' || !!p.consigne,
    conv: lu.conv || p.conv || '', source: 'vinted-commande', forme: lu.forme, cleLigne,
    qrB64: p.qrB64 || null, qrType: p.qrType || null, qrUrl: p.qrUrl || null,
    account: account || p.account || '',
    ...(!account && Array.isArray(recuSur) && recuSur.length ? { recuSur: recuSur.map((x) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 3) } : {}),
  };
}

// ── LA RELECTURE DES E-MAILS DÉJÀ REÇUS (classés « sans action » avant le 3 nov.)
// Le corps gardé (`email_inconnu_*.brut`, borné à 2 000 caractères) est le JSON
// reçu, COUPÉ : on en relit le champ `text` (le lien de la conversation y est,
// mesuré avant le 900e caractère). Rien de lisible ⇒ null.
export function texteDuBrut(brut) {
  const s = String(brut || '');
  const m = /"text"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(s);
  if (!m) return '';
  return m[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ').replace(/\\"/g, '"').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\\/g, '\\');
}
export function arriveeDUnGarde(row) {
  const d = row || {};
  const subject = String(d.subject || '');
  const text = texteDuBrut(d.brut);
  if (!subject || !text) return null;
  const lu = lireArriveeAchat({ subject, text, html: '' }, text);
  if (!lu) return null;
  const cleLigne = cleArrivee(lu, d.messageId || (/"messageId"\s*:\s*"([^"]{3,300})"/.exec(String(d.brut || '')) || [])[1] || '');
  const emailAt = (/"sourceDate"\s*:\s*"(\d{4}-[^"]+)"/.exec(String(d.brut || '')) || [])[1] || d.receivedAt || null;
  return ligneArrivee(lu, { cleLigne, subject, emailAt, recuLe: d.receivedAt || emailAt });
}
