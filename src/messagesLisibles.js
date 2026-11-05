// ── LES MESSAGES EN MOTS, JAMAIS EN CODE (5 novembre) ─────────────────────────
// Julien : « on a le code et pas les vrais messages ». MESURÉ (lecture seule,
// 3 269 entités de conversations captées) :
//   · `offer_message` (587, ses offres et contre-offres, sans titre ni corps) :
//     le fil affichait « currency_code: EUR » — le balayage « défensif » des
//     codes prenait `price.currency_code` pour un code de retrait, et l'encadrait
//     même en « Colis · retrait » ;
//   · `action_message` : 166 sous-titres sur 265 portent du HTML de Vinted
//     (`<a class="msg-status__link …">point relais</a>`, `<br/>`) ;
//   · `portal_message` (5, l'équipe Vinted) : corps en HTML, rangé en évènement ;
//   · dans la LISTE, l'extrait était la `description` de la boîte : le titre de
//     l'annonce (ou « 45,00 € » pour une offre) — jamais le dernier message. Sur
//     les conversations captées, le dernier message réel était un message écrit
//     199 fois, une offre 511 fois, un évènement 99 fois.
// Une règle, ici, pour le fil et la liste (§11). Ce qu'on ne sait pas lire n'est
// jamais remplacé par un nom de type (`status_message`) : `texte` vaut ''.

import { instantVinted } from './suiviMessagerieVinted.js';

const ENTITES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
export function texteSansHtml(t) {
  return String(t == null ? '' : t)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m; }
      return Object.prototype.hasOwnProperty.call(ENTITES, e.toLowerCase()) ? ENTITES[e.toLowerCase()] : m;
    })
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Un nom de type (`offer_message`, `status_title`…) n'est pas un texte pour lui.
export const estCodeTechnique = (t) => /^[a-z]+(?:_[a-z]+)+$/.test(String(t || '').trim());

const montantDe = (p) => {
  const brut = p && typeof p === 'object' ? p.amount : p;
  if (typeof brut === 'number') return Number.isFinite(brut) && brut > 0 ? brut : null;
  if (typeof brut !== 'string' || !/^\s*\d+(?:[,.]\d{1,2})?\s*$/.test(brut)) return null;
  const n = Number(brut.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const deviseDe = (p, e) => {
  const d = (p && typeof p === 'object' && (p.currency_code || p.currency)) || (e && e.currency);
  return typeof d === 'string' && /^[A-Z]{3}$/.test(d) ? d : null;
};

// Un CODE de retrait rangé dans un champ : seulement une clé qui le DIT (jamais
// `currency_code`) et une valeur qui en a la forme (lettres/chiffres, 4 à 20,
// au moins un chiffre). Mesuré : aucune des 2 609 entités d'évènement n'en porte
// aujourd'hui (les codes vivent dans le texte) — le filet reste, sans faux.
const CLE_CODE = /(^|_)(pickup|retrait|collection|parcel|locker|pin|code)(_|$)/i;
const PAS_UN_CODE = /currency|country|locale|lang|style|template|status|type|url|link|href/i;
const codesRanges = (e) => {
  const out = []; const vus = new Set();
  const scan = (o, d) => {
    if (!o || typeof o !== 'object' || d > 5) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === 'object') { scan(v, d + 1); continue; }
      if (typeof v !== 'string' && typeof v !== 'number') continue;
      const s = String(v).trim();
      if (!CLE_CODE.test(k) || PAS_UN_CODE.test(k)) continue;
      if (!/^[A-Z0-9-]{4,20}$/i.test(s) || !/\d/.test(s) || vus.has(s)) continue;
      vus.add(s); out.push(s);
    }
  };
  scan(e, 0);
  return out;
};

// Le texte d'une ENTITÉ de conversation Vinted. `oppId` : l'interlocuteur.
// Rend { kind: 'message'|'offer'|'event', texte, offre?, vinted? } — `texte` ''
// quand rien de lisible (l'appelant ne l'affiche pas).
export function lireEntiteVinted(entityType, entity, oppId) {
  const e = entity && typeof entity === 'object' ? entity : {};
  const t = String(entityType || '');
  const sensDe = () => (e.user_id != null && oppId != null ? (String(e.user_id) === String(oppId) ? 'recue' : 'envoyee') : 'inconnu');
  if (t === 'message') return { kind: 'message', texte: texteSansHtml(e.body) };
  if (t === 'portal_message') return { kind: 'message', texte: texteSansHtml(e.body), vinted: true };
  if (t === 'offer_message' || t === 'offer_request_message') {
    const montant = montantDe(e.price);
    if (montant != null) {
      const ancien = montantDe(e.original_price);
      return { kind: 'offer', texte: '', offre: { montant, devise: deviseDe(e.price, e), ancien: ancien != null && ancien !== montant ? ancien : null, sens: sensDe(), type: t } };
    }
  }
  const morceaux = [];
  for (const k of ['title', 'subtitle', 'body', 'text']) {
    const s = texteSansHtml(e[k]);
    if (s && !estCodeTechnique(s) && !morceaux.includes(s)) morceaux.push(s);
  }
  const codes = codesRanges(e).filter((c) => !morceaux.some((m) => m.includes(c)));
  for (const c of codes) morceaux.push('Code de retrait : ' + c);
  return { kind: 'event', texte: morceaux.join('\n') };
}

// L'APERÇU du dernier message d'une conversation, pour la LISTE, à partir des
// scalaires du résumé (`fetchResumesConversations`) : dt (type), db (corps),
// dti (titre), dp (montant), dpo (ancien montant), dst (statut), dstt (libellé
// du statut), der (auteur), opp (interlocuteur). Rien lu ⇒ null.
export function apercuDernierMessage(r) {
  if (!r || !r.dt) return null;
  const entite = { body: r.db, title: r.dti, user_id: r.der, price: r.dp != null ? { amount: r.dp } : null, original_price: r.dpo != null ? { amount: r.dpo } : null };
  const lu = lireEntiteVinted(r.dt, entite, r.opp);
  if (lu.kind === 'offer') {
    const st = r.dst != null && r.dst !== '' ? Number(r.dst) : null;
    const etat = st === 20 ? 'acceptee' : st === 30 ? 'refusee' : st === 10 ? 'attente' : null;
    return { kind: 'offer', offre: { ...lu.offre, etat } };
  }
  const texte = lu.texte.split('\n')[0];
  return texte ? { kind: lu.kind, texte, vinted: !!lu.vinted } : null;
}

// Le mot d'une offre sur la liste et dans le fil : jamais un code.
export function libelleOffre(o) {
  return !o ? 'Offre' : o.sens === 'recue' ? 'Offre reçue' : o.sens === 'envoyee' ? 'Ton offre' : 'Offre';
}
export function etatOffreCourt(etat) {
  return etat === 'acceptee' ? 'acceptée' : etat === 'refusee' ? 'refusée' : etat === 'attente' ? 'en attente' : '';
}

// La `description` de la boîte n'est PAS un message quand elle redit le titre de
// la paire, ou n'est qu'un montant (une offre, mesuré 50 fois sur 50).
export function descriptionBoite(desc, titrePaire, norm) {
  const d = String(desc || '').trim();
  if (!d) return { kind: 'vide' };
  const m = /^(\d+(?:[,.]\d{1,2})?)\s*€$/.exec(d);
  if (m) return { kind: 'montant', montant: Number(m[1].replace(',', '.')) };
  const n = typeof norm === 'function' ? norm : (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (titrePaire && n(d) === n(titrePaire)) return { kind: 'titre' };
  return { kind: 'texte', texte: texteSansHtml(d) };
}

// Le résumé capté porte-t-il BIEN le dernier message de la boîte ? Même instant
// (à la seconde), ou une capture plus récente que la boîte. Sinon le résumé
// dirait un AUTRE message (mesuré : 288 boîtes plus récentes que leur fil capté,
// Vinted la déplace sur une offre acceptée ou un évènement) — on n'affirme rien.
export function dernierMessageConfirme(c, r) {
  if (!c || !r) return false;
  const a = instantVinted(r.derTs), b = instantVinted(c.updated_at);
  if (a == null || b == null) return false;
  return Math.floor(a / 1000) >= Math.floor(b / 1000);
}

// L'extrait d'UNE ligne de la liste : le dernier message réel quand le fil capté
// le confirme ; sinon ce que la boîte en dit, sans jamais présenter le titre de
// la paire comme un message ni un montant nu comme du texte.
export function extraitConversation(c, r, titrePaire, norm) {
  if (r && dernierMessageConfirme(c, r)) {
    const a = apercuDernierMessage(r);
    if (a) return { ...a, source: 'fil' };
  }
  const d = descriptionBoite(c && c.description, titrePaire, norm);
  if (d.kind === 'montant') return { kind: 'offer', offre: { montant: d.montant, devise: 'EUR', sens: 'inconnu', etat: null }, source: 'boite' };
  if (d.kind === 'texte') return { kind: 'message', texte: d.texte, source: 'boite' };
  return { kind: 'aucun', source: 'boite' };
}
