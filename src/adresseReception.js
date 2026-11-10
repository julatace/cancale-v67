// ══════════════════════════════════════════════════════════════════════════════
// LA FEUILLE « TON ADRESSE VRM » — les mots et les pas-à-pas (8 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// La règle vit au serveur (api/_lib/adresse-reception.js) : ici, rien que ce que
// la feuille DIT, pur, testé par le banc `adresse-reception.cjs`.
// Trois états partout : `undefined` en cours · `null` pas su · réponse lue.
// ══════════════════════════════════════════════════════════════════════════════

export const ROUTE_ADRESSE = '/api/email-rattacher?mode=adresse-unique';

// « il y a 3 min », « il y a 2 h », « le 5 nov. » — d'une date LUE (jamais devinée).
export function ilYa(at, maintenant = Date.now()) {
  const t = Date.parse(at || '');
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((maintenant - t) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return 'le ' + new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// L'état de l'adresse, en une ligne (le point et sa phrase).
//   { ton: 'ok' | 'attente' | 'off' | 'passu', phrase }
export function etatAdresse(d, maintenant = Date.now()) {
  if (d === undefined) return { ton: 'attente', phrase: 'Lecture…' };
  if (d === null) return { ton: 'passu', phrase: 'Pas su pour l’instant.' };
  if (!d.pret) return { ton: 'off', phrase: 'Pas encore ouverte.' };
  if (d.actif === false) return { ton: 'off', phrase: 'Désactivée : rien ne t’est rangé.' };
  if (!('dernier' in d)) return { ton: 'passu', phrase: 'Dernier e-mail : pas su pour l’instant.' };
  if (!d.dernier) return { ton: 'attente', phrase: 'Aucun e-mail reçu pour l’instant.' };
  return { ton: 'ok', phrase: `Dernier e-mail reçu ${ilYa(d.dernier.at, maintenant)}` };
}

// Un code de confirmation se montre 3 jours (Gmail le garde valable bien moins).
export const codeAMontrer = (d, maintenant = Date.now()) =>
  !!(d && d.code && (d.code.code || d.code.lien) && maintenant - Date.parse(d.code.recuLe || '') < 3 * 864e5);

export const NOM_FOURNISSEUR = { gmail: 'Gmail', yahoo: 'Yahoo', outlook: 'Outlook' };

// Le pas-à-pas par messagerie — (10 nov., soir, lot « adresse-vrm-simple »)
// TROIS pas au plus, chacun = une phrase de 12 mots au plus + UN bouton :
//   'ouvrir' → la page de réglages de la messagerie (lien direct quand il
//   existe) · 'copier' → l'adresse VRM · 'vinted' → le mot « vinted » ·
//   'code' → la confirmation envoyée par la messagerie à l'adresse VRM,
//   affichée à ce pas dès qu'elle arrive.
// Chemins de menu : pages d'aide officielles (Gmail, iCloud, Outlook, Yahoo,
// relevés le 6 nov., docs/passation/2026-11-06-onglets-c.md) ; Orange et Free :
// aide de la communauté Orange et aide Zimbra (10 nov.) — ils peuvent changer.
export const FOURNISSEURS = [
  {
    id: 'gmail', nom: 'Gmail', lettre: 'G',
    lien: 'https://mail.google.com/mail/u/0/#settings/fwdandpop', lienMot: 'Ouvrir Gmail',
    pas: [
      { t: 'Sur ordinateur, ouvre « Transfert et POP/IMAP ».', geste: 'ouvrir' },
      { t: '« Ajouter une adresse de transfert » : colle ton adresse VRM.', geste: 'copier' },
      { t: 'Valide avec le code, puis « Transférer une copie ».', geste: 'code' },
    ],
    filtre: true,
  },
  {
    id: 'icloud', nom: 'iCloud Mail', lettre: 'i',
    lien: 'https://www.icloud.com/mail/', lienMot: 'Ouvrir iCloud Mail',
    pas: [
      { t: 'Sur icloud.com : ⚙︎ → Réglages → Règles.', geste: 'ouvrir' },
      { t: 'Nouvelle règle : « De » contient « vinted ».', geste: 'vinted' },
      { t: 'Alors « Transférer à » : colle ton adresse VRM.', geste: 'copier' },
    ],
  },
  {
    id: 'outlook', nom: 'Outlook', lettre: 'O',
    lien: 'https://outlook.live.com/mail/0/options/mail/forwarding', lienMot: 'Ouvrir Outlook',
    pas: [
      { t: 'Sur outlook.com, ouvre Courrier → Transfert.', geste: 'ouvrir' },
      { t: 'Active le transfert et colle ton adresse VRM.', geste: 'copier' },
      { t: 'Coche « Conserver une copie », puis Enregistrer.', geste: 'code' },
    ],
  },
  {
    id: 'orange', nom: 'Orange', lettre: 'O',
    lien: 'https://mail.orange.fr/', lienMot: 'Ouvrir Mail Orange',
    pas: [
      { t: 'Mail Orange → ⚙︎ → Préférences → « Transférer mes mails ».', geste: 'ouvrir' },
      { t: '« Envoyer une copie » : colle ton adresse VRM.', geste: 'copier' },
      { t: 'Valide. Tes e-mails restent aussi chez Orange.', geste: '' },
    ],
  },
  {
    id: 'free', nom: 'Free', lettre: 'F',
    lien: 'https://zimbra.free.fr/', lienMot: 'Ouvrir le webmail Free',
    pas: [
      { t: 'Webmail Free → Préférences → Mail.', geste: 'ouvrir' },
      { t: '« Faire suivre » : colle ton adresse VRM.', geste: 'copier' },
      { t: 'Garde une copie chez Free, puis Enregistrer.', geste: '' },
    ],
  },
  {
    id: 'yahoo', nom: 'Yahoo', lettre: 'Y',
    lien: 'https://mail.yahoo.com/', lienMot: 'Ouvrir Yahoo Mail',
    pas: [
      { t: 'Paramètres → Boîtes aux lettres → Transfert (Yahoo Mail Plus).', geste: 'ouvrir' },
      { t: 'Colle ton adresse VRM, puis « Vérifier ».', geste: 'copier' },
      { t: 'Ouvre le lien reçu, puis Enregistrer.', geste: 'code' },
    ],
  },
  {
    id: 'autre', nom: 'Autre messagerie', lettre: '@',
    lien: '', lienMot: '',
    pas: [
      { t: 'Dans tes réglages, cherche « Transfert » ou « Faire suivre ».', geste: '' },
      { t: 'Colle ton adresse VRM, garde une copie chez toi.', geste: 'copier' },
      { t: 'Un code demandé ? Il s’affiche ici.', geste: 'code' },
    ],
  },
];

// La messagerie d'une adresse, par son DOMAINE (jamais devinée autrement).
// '' = pas une adresse ; 'autre' = domaine inconnu.
const DOMAINES_MESSAGERIE = [
  ['relais-apple', /^privaterelay\.appleid\.com$/],
  ['gmail', /^(?:gmail\.com|googlemail\.com)$/],
  ['icloud', /^(?:icloud\.com|me\.com|mac\.com)$/],
  ['outlook', /^(?:outlook|hotmail|live|msn)\.[a-z.]+$/],
  ['orange', /^(?:orange\.fr|wanadoo\.fr)$/],
  ['free', /^(?:free\.fr|aliceadsl\.fr)$/],
  ['yahoo', /^(?:yahoo|ymail)\.[a-z.]+$/],
];
export function messagerieDeDomaine(adresse) {
  const a = String(adresse || '').trim().toLowerCase();
  const i = a.lastIndexOf('@');
  if (i < 1) return '';
  const d = a.slice(i + 1);
  for (const [id, re] of DOMAINES_MESSAGERIE) if (re.test(d)) return id;
  return 'autre';
}
// La messagerie la plus présente parmi SES adresses (relais d'Apple et
// domaines inconnus à part) ; '' si aucune n'est connue.
export function messagerieDetectee(adresses) {
  const n = new Map();
  for (const a of Array.isArray(adresses) ? adresses : []) {
    const m = messagerieDeDomaine(a);
    if (!m || m === 'relais-apple' || m === 'autre') continue;
    n.set(m, (n.get(m) || 0) + 1);
  }
  let best = '', max = 0;
  for (const [m, k] of n) if (k > max) { best = m; max = k; }
  return best;
}

// Un relais d'Apple (« Masquer mon adresse ») n'est pas une boîte : Apple fait
// suivre vers UNE boîte de son compte Apple. Le geste : y choisir une boîte qui
// arrive DÉJÀ à VRM (liste déroulante des boîtes reliées).
export const PAS_RELAIS = [
  { t: 'Ouvre « Masquer mon adresse » sur iCloud.', geste: 'ouvrir', lien: 'https://www.icloud.com/settings/', lienMot: 'Ouvrir iCloud' },
  { t: '« Transférer à » : choisis cette boîte.', geste: 'boite' },
  { t: 'Enregistre. VRM vérifie tout seul.', geste: '' },
];

// Le lien de confirmation n'est rendu QUE s'il pointe chez la messagerie (le
// serveur le filtre déjà, api/_lib/adresse-reception.js ; l'app re-vérifie :
// un faux message ne fait jamais afficher un lien piégé). Ouvert sur SON clic,
// dans un nouvel onglet — jamais suivi par le serveur.
const HOTES_CONFIRMATION = {
  gmail: /^(?:mail-settings\.google\.com|mail\.google\.com|isolated\.mail\.google\.com)$/,
  yahoo: /(?:^|\.)(?:yahoo\.com|yahoo\.net)$/,
  outlook: /(?:^|\.)(?:live\.com|outlook\.com|microsoft\.com|office\.com)$/,
};
export function lienConfirmationSur(code) {
  if (!code || !code.lien) return '';
  try {
    const u = new URL(code.lien);
    const re = HOTES_CONFIRMATION[code.fournisseur];
    return u.protocol === 'https:' && re && re.test(u.hostname) ? u.href : '';
  } catch (_) { return ''; }
}

// ── LA PROGRESSION 1 · 2 · 3 · ✓ (et la reprise) ─────────────────────────────
// `voulue` : l'étape où il s'est arrêté (gardée sur CET appareil, un confort) ;
// la preuve LUE passe devant : essai reçu ou compte relié ⇒ ✓ (4) ; un code
// de confirmation arrivé ⇒ au moins l'étape 2 (c'est là qu'il sert).
export function etapeDuParcours({ voulue, essai, relie, code } = {}) {
  if (relie || essai === 'recu') return 4;
  const v = [1, 2, 3].includes(Number(voulue)) ? Number(voulue) : 1;
  return code && v < 2 ? 2 : v;
}
export const CLE_PARCOURS = 'vrm_parcours_adresse_vrm';

// Le filtre Gmail « seulement Vinted et les colis ».
export const ETAPES_FILTRE_GMAIL = [
  'Fais d’abord les 3 étapes du transfert.',
  'Barre de recherche → ⚙︎ des options → champ « De ».',
  'Colle la règle ci-dessous → Créer un filtre.',
  'Coche « Transférer à » ton adresse VRM → Créer.',
];

// Ce que VRM lit, par famille d'expéditeurs (les mots de l'app, une table).
export const CE_QUI_EST_LU = [
  { id: 'vinted', titre: 'Vinted', detail: 'Ventes, bordereaux, codes de retrait, offres et messages' },
  { id: 'transporteurs', titre: 'Transporteurs', detail: 'Colis arrivés à retirer, QR des casiers, suivi' },
  { id: 'sites', titre: 'Leboncoin, Vestiaire, eBay', detail: 'Ventes et suppressions d’annonces' },
];

// ── L'E-MAIL D'ESSAI (10 nov.) ──────────────────────────────────────────────
// Un petit code (alphabet sans ambiguïté de api/_lib/adresse-reception.js, en
// majuscules) mis dans l'objet : « Essai VRM K7P2 ». Le serveur le range chez
// lui à l'arrivée (`essai: { code, at }`) ; la feuille dit « Reçu ✓ » quand le
// code rangé est CELUI qu'elle attend — une identité, jamais une heure.
export const ALPHABET_ESSAI = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function nouveauCodeEssai(aleas) {
  const n = ALPHABET_ESSAI.length;
  let out = '';
  while (out.length < 4) {
    let octets;
    if (aleas) octets = aleas(16);
    else { octets = new Uint8Array(16); try { crypto.getRandomValues(octets); } catch (_) { for (let i = 0; i < octets.length; i++) octets[i] = Math.floor(Math.random() * 256); } }
    for (const b of octets) { if (b >= 256 - (256 % n)) continue; out += ALPHABET_ESSAI[b % n]; if (out.length === 4) break; }
  }
  return out;
}
export const sujetEssai = (code) => `Essai VRM ${code}`;
// Le lien de l'e-mail d'essai : sa propre messagerie, vers son adresse VRM.
export const lienEssai = (adresse, code = '') => adresse
  ? `mailto:${adresse}?subject=${encodeURIComponent(code ? sujetEssai(code) : 'Essai VRM')}&body=${encodeURIComponent('Un e-mail d’essai pour vérifier que mon adresse VRM reçoit bien.')}`
  : '';
// Combien de temps on attend (au-delà : « Pas encore reçu », avec le geste).
export const ATTENTE_ESSAI_MS = 15 * 60000;
//   { etat: 'repos' | 'attente' | 'recu' | 'trop-long' | 'passu', at? }
export function etatEssai(d, attendu, maintenant = Date.now()) {
  if (!attendu || !attendu.code) return { etat: 'repos' };
  if (d && d.essai && String(d.essai.code || '').toUpperCase() === attendu.code) return { etat: 'recu', at: d.essai.at };
  if (d === null || (d && !('essai' in d))) return { etat: 'passu' };
  if (maintenant - (attendu.depuis || 0) > ATTENTE_ESSAI_MS) return { etat: 'trop-long' };
  return { etat: 'attente' };
}

// ── PAS ENCORE OUVERTE : ce que voit le PROPRIÉTAIRE (10 nov.) ──────────────
// La route ne lui rend que des états (`miseEnService: { domaine, cle }`),
// jamais une valeur. Le reste se vérifie par l'e-mail d'essai.
//   [{ id, titre, etat: 'fait' | 'a-faire' | 'a-verifier', detail }]
export function gestesMiseEnService(m) {
  const x = m && typeof m === 'object' ? m : {};
  return [
    { id: 'domaine', titre: 'Un domaine de réception sur Cloudflare', etat: x.domaine === 'ok' ? 'fait' : 'a-faire', detail: 'Ex. recu-vrm.fr, environ 10 € par an.' },
    { id: 'worker', titre: 'Cloudflare : tout vers le Worker VRM', etat: 'a-verifier', detail: 'Se vérifie avec l’e-mail d’essai, une fois ouvert.' },
    { id: 'cle', titre: 'La clé de réception, Vercel et Worker', etat: x.cle === true ? 'fait' : x.cle === false ? 'a-faire' : 'a-verifier', detail: 'EMAIL_INBOUND_SECRET : la même valeur aux deux endroits.' },
    { id: 'variable', titre: 'Le domaine posé sur Vercel', etat: x.domaine === 'ok' ? 'fait' : 'a-faire', detail: x.domaine === 'mal-forme' ? 'DOMAINE_RECEPTION mal écrit : le domaine seul, sans @.' : 'DOMAINE_RECEPTION = le domaine, puis redéployer.' },
  ];
}
export const DOC_MISE_EN_SERVICE = 'docs/emails-transfert-mise-en-service.md';
