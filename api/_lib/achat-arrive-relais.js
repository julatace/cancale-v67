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
function decoder64(b) {
  try {
    const n = b.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    return Buffer.from(n + '='.repeat((4 - (n.length % 4)) % 4), 'base64').toString('utf8');
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
export function cleArrivee(lu, messageId, hash) {
  if (lu && lu.conv) return `email_track_autre_conv-${lu.conv}`;
  return `email_track_autre_arr-${hash(String(messageId || '') || `${lu ? lu.titre : ''}|${lu ? lu.lieu : ''}`)}`;
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
