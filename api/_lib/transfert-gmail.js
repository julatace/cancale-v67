// ══════════════════════════════════════════════════════════════════════════════
// LE CODE DE VALIDATION D'UN TRANSFERT GMAIL (1er novembre 2026)
// ══════════════════════════════════════════════════════════════════════════════
// Un vendeur ajoute la boîte collective de VRM comme « adresse de transfert »
// dans SON Gmail. Gmail envoie alors le code de validation… à la boîte de VRM,
// pas à lui : il ne pouvait pas finir son transfert sans que Julien aille lire
// la boîte à la main (audit « un autre vendeur », D1).
//
// ── À QUI EST CE CODE ? ──────────────────────────────────────────────────────
// Cet email arrive sur l'adresse COLLECTRICE : son adresse de réception ne
// désigne personne (`resoudreProprietaire` le met en quarantaine). Son identité
// est l'adresse SOURCE du transfert, celle que Gmail nomme dans le message
// (« x@gmail.com a demandé à transférer automatiquement… ») — et elle ne vaut
// que si elle est une adresse DÉCLARÉE ET PROUVÉE par un seul vendeur (le même
// registre, la même garde que pour tous ses emails : `lireRegistreEmails`).
// Deux garde-fous de plus, parce que le corps est du texte :
//   · l'expéditeur est `forwarding-noreply@google.com` ET l'en-tête
//     `Authentication-Results` posé par Gmail à la livraison dit DKIM ou DMARC
//     « pass » pour google.com (le script le transmet) — un faux message
//     « de Google » ne passe pas ;
//   · le sujet et le corps nomment LA MÊME adresse et LE MÊME code, la
//     destination nommée est la boîte collective ; un seul désaccord ⇒ `null`.
// Non attribuable (adresse pas prouvée, ou déclarée par deux vendeurs) ⇒
// quarantaine au propriétaire NEUTRE, réclamable par celui qui prouvera
// l'adresse (la règle existante). Non authentifié ⇒ quarantaine que PERSONNE ne
// peut réclamer. Jamais donné à un autre vendeur.
//
// ── CE QUI EST RANGÉ ─────────────────────────────────────────────────────────
// Le CODE seul (des chiffres), l'adresse et la date, dans une ligne du vendeur
// (`vrm_gmail_transfert_<empreinte>`). JAMAIS le lien de confirmation du
// message : il valide le transfert d'un clic, sans code — il est retiré du
// texte avant toute quarantaine (`sansLienConfirmation`).
import crypto from 'node:crypto';
import { normAdresse, estAdresseCollectrice } from './proprietaire-email.js';

export const EXPEDITEUR_TRANSFERT = 'forwarding-noreply@google.com';
export const PREFIXE_CODE_GMAIL = 'vrm_gmail_transfert_';
export const idCodeGmail = (adresse) => PREFIXE_CODE_GMAIL + crypto.createHash('sha256').update(normAdresse(adresse)).digest('hex').slice(0, 40);

const RE_ADRESSE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const uniques = (l) => [...new Set(l.filter(Boolean))];

// Est-ce un message de confirmation de transfert Gmail ? (l'expéditeur seul)
export function estConfirmationTransfert(mail) {
  return normAdresse((mail && mail.from) || '') === EXPEDITEUR_TRANSFERT;
}

// L'en-tête de livraison posé par Gmail dit-il que Google l'a signé ?
export function authentifieGoogle(authentification) {
  const a = String(authentification || '');
  const dkim = /\bdkim=pass\b[^;]*\bheader\.(?:i|d)=@?(?:[a-z0-9-]+\.)*google\.com\b/i.test(a);
  const dmarc = /\bdmarc=pass\b[^;]*\bheader\.from=(?:[a-z0-9-]+\.)*google\.com\b/i.test(a);
  return dkim || dmarc;
}

const texteDe = (mail) => {
  const t = String((mail && mail.text) || '');
  if (t.trim()) return t;
  return String((mail && mail.html) || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#64;|&commat;/g, '@');
};

// Lit { source, code } — ou `null` dès que le message ne dit pas UNE adresse
// et UN code, d'accord entre sujet et corps, vers la boîte collective.
// (8 nov.) `destination` : l'ADRESSE DE RÉCEPTION UNIQUE d'un vendeur
// (api/_lib/adresse-reception.js). Sans elle, la destination attendue reste la
// boîte collective — la règle d'avant, inchangée.
export function lireConfirmationTransfert(mail, { destination } = {}) {
  if (!estConfirmationTransfert(mail)) return null;
  const versIci = destination ? ((a) => normAdresse(a) === normAdresse(destination)) : estAdresseCollectrice;
  const sujet = String((mail && mail.subject) || '');
  const corps = texteDe(mail);
  // Le code : « (#123456789) » en tête du sujet ; « Code de confirmation : 123456789 »
  // / « Confirmation code: 123456789 » dans le corps.
  const codeSujet = (/\(#\s*(\d{6,12})\s*\)/.exec(sujet) || [])[1] || '';
  const codesCorps = uniques([...corps.matchAll(/(?:code\s+de\s+confirmation|confirmation\s+code)\s*:?\s*(\d{6,12})/gi)].map((m) => m[1]));
  const codes = uniques([codeSujet, ...codesCorps]);
  if (codes.length !== 1 || !codeSujet) return null;
  // La source : l'adresse du sujet (« … de x@… » / « … from x@… ») et celle
  // qui, dans le corps, « a demandé à transférer » / « has requested to … forward ».
  const sujetAdresses = uniques((sujet.match(RE_ADRESSE) || []).map(normAdresse));
  const corpsSources = uniques([...corps.matchAll(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\s+(?:a\s+demand[ée]\s+(?:à|a)\s+transf[ée]rer|has\s+requested\s+to\s+(?:automatically\s+)?forward)/gi)].map((m) => normAdresse(m[1])));
  const sources = uniques([...sujetAdresses, ...corpsSources]).filter((a) => !estAdresseCollectrice(a) && !versIci(a));
  if (sources.length !== 1 || !corpsSources.length || !sujetAdresses.length) return null;
  // La destination nommée (« vers votre adresse X » / « to your email address X »),
  // si le texte la donne, doit être la boîte collective.
  const dest = uniques([...corps.matchAll(/(?:vers\s+votre\s+adresse|to\s+your\s+(?:email\s+)?address)\s+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => normAdresse(m[1])));
  if (dest.some((d) => !versIci(d))) return null;
  return { source: sources[0], code: codes[0] };
}

// Le lien de confirmation (valide d'un clic, sans code) ne se range NULLE PART.
export function sansLienConfirmation(s) {
  return typeof s === 'string'
    ? s.replace(/https?:\/\/(?:mail-settings\.google\.com|mail\.google\.com|isolated\.mail\.google\.com)\/[^\s"'<>)]*/gi, '[lien de validation retiré par VRM]')
    : s;
}
