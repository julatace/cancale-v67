// ═══════════════════════════════════════════════════════════════════════════
// LES MOTS QUI FONT BANNIR UN COMPTE (12 nov., validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// UNE règle, deux familles, utilisée partout (§11 : un propriétaire) :
//   • MESSAGES (Vinted, Leboncoin, Vestiaire, eBay ; réponses, favoris, refus auto) :
//     sortir la vente de la plateforme — un numéro de téléphone, un e-mail, un lien
//     vers un autre site, un autre moyen de paiement (PayPal, virement, Lydia…), une
//     autre messagerie (WhatsApp…), « en dehors de Vinted », la main propre proposée
//     (sauf Leboncoin : la remise en main propre y est prévue par le site).
//   • ANNONCES (publier, republier, modifier) : les mots de contrefaçon (réplica,
//     inspiré de, copie, 1:1, fake, non authentique, type/style <marque>…), plus les
//     coordonnées et paiements ci-dessus.
// Ce que l'app en fait :
//   • envoi À LA MAIN : avertissement ambre, l'envoi part seulement sur SON
//     « Envoyer quand même » (`verifierMessageAvantEnvoi`, src/App.jsx) ;
//   • message AUTOMATIQUE (favoris, refus auto d'une offre) : jamais envoyé
//     (`messageAutoPermis` faux ⇒ pas enregistré, et le serveur refuse le tour) ;
//   • annonce : une ligne dans « vérifier avant de publier » (src/verifAnnonce.js),
//     jamais bloquante, jamais coupable par « Ne plus me le dire ».
// Règle PURE (aucune lecture). Exécutée par scripts/audit-message-sur.cjs (60 phrases).
// Prudence sur les faux positifs : « téléphone portable Samsung » (un titre) n'est
// pas un numéro, « 42 », « 120 € », « 12/11/2026 », un n° de suivi ne le sont pas ;
// une négation dans la même phrase (« je ne fais pas de main propre », « pas une
// copie ») ne compte pas ; une virgule l'arrête (« pas de souci, PayPal » compte).

export const NOMS_SITES = { vinted: 'Vinted', leboncoin: 'Leboncoin', lbc: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
const nomSite = (site) => NOMS_SITES[site] || 'Vinted';
const estLbc = (site) => site === 'leboncoin' || site === 'lbc';

// Minuscule, sans accent, espaces simples ; les apostrophes typographiques ramenées à « ' ».
export const normaliser = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[‘’ʼ]/g, "'").toLowerCase().replace(/\s+/g, ' ');

// Une négation dans les 30 caractères avant le mot : « je ne fais pas de main propre »,
// « jamais de PayPal », « pas une copie », « sans WhatsApp ».
const NEGATION = /(?:\bpas\b|\bjamais\b|\bsans\b|\bni\b|\baucun(?:e)?\b|\bn'(?:accepte|utilise|ai|est)\b|\bne\b[^.!?,;]{0,20}$)[^.!?,;]{0,22}$/;
const nie = (t, i) => NEGATION.test(t.slice(Math.max(0, i - 30), i));

// Le premier passage NON nié d'un motif (global) ; rend le passage lu, ou ''.
function trouver(t, re, avecNegation = true) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(t))) {
    if (!avecNegation || !nie(t, m.index)) return m[0].trim();
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return '';
}

// ── Les motifs (sur le texte normalisé) ──────────────────────────────────────
// Téléphone français : 06 12 34 56 78 · 06.12.34.56.78 · 0612345678 · +33 6 12 34 56 78.
const RE_TEL = /(?:\+33|0033|\b0)\s*[1-9](?:[\s.-]?\d{2}){4}\b/g;
// En toutes lettres (« zéro six… ») ou l'invitation à écrire/appeler en dehors.
const RE_TEL_MOTS = /\bzero (?:six|sept)\b|\b(?:envoie|envoyez|ecris|ecrivez|appelle|appelez)[- ]?(?:moi|nous)? (?:un |par )?(?:sms|texto)\b|\bpar (?:sms|texto)\b|\bmon (?:portable|tel|06|07)\b/g;
const RE_EMAIL_ADR = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g;
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+|\b(?:gmail|hotmail|outlook|yahoo|icloud|laposte\.net|orange\.fr)\b|\barobase\b/g;
// Un lien : http(s)://, www., ou nom.domaine connu — sauf vers le site lui-même.
const RE_LIEN = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]{2,}\.(?:com|fr|net|org|io|me|ly|co|be|shop|store|link)\b(?:\/\S*)?/g;
const LIEN_DU_SITE = /(?:^|[/.])(?:vinted|leboncoin|vestiairecollective|ebay)\.[a-z.]+/;
const RE_PAIEMENT = /\bpay ?pal\b|\bvirement\b|\blydia\b|\bpaylib\b|\bwero\b|\biban\b|\brib\b|\bwestern union\b|\bmandat cash\b|\bpaysafecard\b|\bcrypto\b|\bbitcoin\b/g;
const RE_ESPECES = /\ben (?:especes|liquide|cash)\b|\bpaiement (?:en )?(?:especes|cash)\b/g;
const RE_MESSAGERIE = /\bwhats ?app\b|\bwa\.me\b|\btelegram\b|\bsnap(?:chat)?\b|\binsta(?:gram)?\b|\bmessenger\b|\bfacebook\b/g;
const RE_HORS = /\b(?:en dehors|hors|sans passer par|a cote) (?:de |du |d')?(?:la |l')?(?:vinted|leboncoin|le bon coin|vestiaire|ebay|plateforme|appli(?:cation)?|site)\b|\bhors plateforme\b|\b(?:payer|paie|paye|paies|payes|payez|regler|reglez)(?:[- ]moi)? (?:directement|en direct)\b|\bevit(?:er|e|es|ons|ez) les frais\b|\bsans (?:les )?frais (?:de )?(?:protection|vinted|plateforme)\b|\ben direct sans (?:vinted|leboncoin|vestiaire|ebay)\b/g;
const RE_MAIN_PROPRE = /\b(?:en |remise en |remise |rdv en |rendez-vous en )?mains? propres?\b|\bje peux (?:passer|venir) (?:te |vous )?(?:la |le |les )?(?:deposer|donner|apporter)\b|\bon (?:se voit|peut se voir|se retrouve)\b/g;

// Contrefaçon (annonces).
const MARQUES = ['nike', 'adidas', 'jordan', 'air jordan', 'yeezy', 'new balance', 'asics', 'puma', 'vans', 'converse', 'reebok', 'salomon', 'gucci', 'louis vuitton', 'lv', 'dior', 'balenciaga', 'prada', 'chanel', 'hermes', 'off-white', 'off white', 'supreme', 'stone island', 'moncler', 'the north face', 'north face', 'lacoste', 'ralph lauren', 'burberry', 'versace', 'fendi', 'celine', 'saint laurent', 'ysl', 'bape', 'rolex', 'cartier', 'golden goose', 'alexander mcqueen', 'mcqueen', 'canada goose', 'arc\'teryx', 'arcteryx', 'trapstar', 'corteiz', 'essentials', 'fear of god'];
const RE_MARQUE = MARQUES.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const RE_CONTREFACON = new RegExp([
  '\\br[e]?plica(?:s)?\\b', '\\breplique(?:s)?\\b', '\\bfake(?:s)?\\b', '\\bdupe(?:s)?\\b', '\\bimitation(?:s)?\\b', '\\bcontrefacon(?:s)?\\b',
  '\\bcopie(?:s)?\\b(?! (?:de |du |d\'|de la )?(?:la |le )?(?:facture|ticket|preuve|recu|bon|carte|cni|piece|etiquette|boite|bordereau))',
  '\\b1 ?[:/] ?1\\b', '\\b(?:non|pas) (?:authentique|original(?:e)?|officiel(?:le)?|d\'origine)\\b',
  '\\binspire(?:e|es|s)? (?:de|par|d\'|du)\\b(?! (?:l\'univers|les annees|des annees|annees))',
  '\\b(?:type|style|facon|genre|look) (?:' + RE_MARQUE + ')\\b',
  '\\b(?:ua|top|best) ?batch\\b', '\\bqualite (?:miroir|identique a l\'original)\\b',
].join('|'), 'g');

// Les contrôles, dans un ordre fixe (le plus grave d'abord).
const ETIQUETTES = {
  telephone: 'Un numéro de téléphone',
  email: 'Une adresse e-mail',
  lien: 'Un lien vers un autre site',
  paiement: 'Un paiement hors plateforme',
  messagerie: 'Une autre messagerie',
  hors: 'La vente proposée hors plateforme',
  mainpropre: 'La main propre proposée',
  contrefacon: 'Un mot de contrefaçon',
};
export const CODES_RISQUE = Object.keys(ETIQUETTES);

// → [{ code, mot, texte }] : `mot` = le passage lu (normalisé), `texte` = la ligne dite.
function chercher(texte, site, famille) {
  const t = normaliser(texte);
  if (!t.trim()) return [];
  const out = [];
  const pose = (code, mot) => { if (mot && !out.some((x) => x.code === code)) out.push({ code, mot, texte: `${ETIQUETTES[code]} : « ${mot.slice(0, 32)} »` }); };
  pose('telephone', trouver(t, RE_TEL, false) || trouver(t, RE_TEL_MOTS));
  pose('email', trouver(t, RE_EMAIL, false));
  // (une adresse e-mail n'est pas AUSSI un lien : « gmail.com » d'une adresse est retiré avant)
  const tl = t.replace(RE_EMAIL_ADR, ' ');
  RE_LIEN.lastIndex = 0; let m; let lien = '';
  while ((m = RE_LIEN.exec(tl))) { if (!LIEN_DU_SITE.test(m[0])) { lien = m[0]; break; } }
  pose('lien', lien);
  pose('paiement', trouver(t, RE_PAIEMENT) || (estLbc(site) ? '' : trouver(t, RE_ESPECES)));
  pose('messagerie', trouver(t, RE_MESSAGERIE));
  pose('hors', trouver(t, RE_HORS));
  if (!estLbc(site)) pose('mainpropre', trouver(t, RE_MAIN_PROPRE));
  if (famille === 'annonce') pose('contrefacon', trouver(t, RE_CONTREFACON));
  return out;
}
export const risquesMessage = (texte, site = 'vinted') => chercher(texte, site, 'message');
export const risquesAnnonce = (texte, site = 'vinted') => chercher(texte, site, 'annonce');
// Un message AUTOMATIQUE ne part que si rien n'est relevé (un texte vide n'a rien de risqué).
export const messageAutoPermis = (texte, site = 'vinted') => risquesMessage(texte, site).length === 0;

// Les phrases (≤ 12 mots).
export const phraseRisqueMessage = (site) => `${nomSite(site)} bannit pour ça : sortir la vente de la plateforme`;
export const phraseRisqueAnnonce = (site) => `${nomSite(site)} supprime l’annonce, voire le compte, pour ça`;
export const GESTE_MESSAGE = 'Retire-le du message';
export const GESTE_ANNONCE = 'Retire-le du titre ou de la description';
export const TEXTE_AUTO_REFUSE = 'Ce message ne partira jamais tout seul : retire ce mot.';
// L'erreur d'un message automatique (favoris, refus auto) : '' quand il peut partir.
export function erreurMessageAuto(texte, site = 'vinted') {
  const r = risquesMessage(texte, site);
  return r.length ? `${r[0].texte}. ${TEXTE_AUTO_REFUSE}` : '';
}
// Les lignes de la feuille « vérifier » (src/App.jsx `ListeVerif`) : ambre, jamais coupables.
export const lignesRisqueMessage = (texte, site) => risquesMessage(texte, site).map((r) => ({ code: 'messageRisque', sorte: r.code, texte: r.texte, geste: GESTE_MESSAGE, ambre: true }));
