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
  if (d === null) return { ton: 'passu', phrase: 'Pas su — la lecture n’a pas abouti.' };
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

// Le pas-à-pas par messagerie (10 nov. : une étape = une phrase de 12 mots au
// plus — Julien déteste les murs de texte). `ecran` : le dessin schématique
// (le champ où coller). `code` : la messagerie envoie une confirmation à
// l'adresse VRM, que la feuille affiche à cette étape (index de l'étape).
// Chemins de menu : pages d'aide officielles (Gmail, iCloud, Outlook, Yahoo,
// relevés le 6 nov., docs/passation/2026-11-06-onglets-c.md) ; Orange et Free :
// libellés relevés le 10 nov. sur l'aide de la communauté Orange et l'aide
// Zimbra — ils peuvent changer, la note le dit.
export const FOURNISSEURS = [
  {
    id: 'gmail', nom: 'Gmail', ou: 'Sur un ordinateur : l’app du téléphone ne sait pas.',
    lien: 'https://mail.google.com/mail/u/0/#settings/fwdandpop', lienMot: 'Ouvrir les réglages de Gmail',
    etapes: [
      '⚙︎ → Voir tous les paramètres → Transfert et POP/IMAP.',
      'Ajouter une adresse de transfert : colle ton adresse VRM.',
      'Gmail envoie un code à VRM. Il s’affiche juste ici.',
      'Colle ce code dans Gmail, puis Valider.',
      'Choisis « Transférer une copie », puis Enregistrer.',
    ],
    code: 2, filtre: true,
    ecran: { titre: 'Transfert et POP/IMAP', champ: 'Ajouter une adresse de transfert', bouton: 'Suivant' },
  },
  {
    id: 'icloud', nom: 'iCloud', ou: 'Sur icloud.com, depuis un ordinateur.',
    lien: 'https://www.icloud.com/mail/', lienMot: 'Ouvrir iCloud Mail',
    etapes: [
      'iCloud Mail → ⚙︎ → Réglages → Règles.',
      'Ajouter une règle : « De » contient « vinted ».',
      'Alors « Transférer à » : colle ton adresse VRM.',
      'Terminé. Refais-le pour chaque transporteur si tu veux.',
    ],
    relais: true,
    ecran: { titre: 'Règles', champ: 'Transférer à', bouton: 'Terminé' },
  },
  {
    id: 'outlook', nom: 'Outlook', ou: 'Sur outlook.com (Hotmail, Live), depuis un ordinateur.',
    lien: 'https://outlook.live.com/mail/0/options/mail/forwarding', lienMot: 'Ouvrir les réglages d’Outlook',
    etapes: [
      'Outlook → ⚙︎ → Courrier → Transfert.',
      'Active le transfert et colle ton adresse VRM.',
      'Coche « Conserver une copie », puis Enregistrer.',
    ],
    note: 'Certains comptes Outlook bloquent le transfert. Fais l’essai plus bas.',
    ecran: { titre: 'Transfert', champ: 'Transférer mon courrier à', bouton: 'Enregistrer' },
  },
  {
    id: 'orange', nom: 'Orange', ou: 'Sur mail.orange.fr, depuis un ordinateur.',
    lien: 'https://mail.orange.fr/', lienMot: 'Ouvrir Mail Orange',
    etapes: [
      'Mail Orange → ⚙︎ → Préférences.',
      'Ouvre « Transférer mes mails vers une autre boîte ».',
      'Choisis « Envoyer une copie » : tes e-mails restent chez Orange.',
      'Colle ton adresse VRM, puis Valider.',
    ],
    note: 'Orange change parfois ses menus : cherche « Transfert ».',
    ecran: { titre: 'Préférences', champ: 'Envoyer une copie à', bouton: 'Valider' },
  },
  {
    id: 'free', nom: 'Free', ou: 'Sur zimbra.free.fr, depuis un ordinateur.',
    lien: 'https://zimbra.free.fr/', lienMot: 'Ouvrir le webmail de Free',
    etapes: [
      'Webmail Free → Préférences → Mail.',
      'Section « Réception des messages » : champ « Faire suivre ».',
      'Colle ton adresse VRM. Garde une copie chez Free.',
      'Enregistrer.',
    ],
    note: 'Les libellés peuvent changer : cherche « Faire suivre ».',
    ecran: { titre: 'Préférences · Mail', champ: 'Faire suivre une copie à', bouton: 'Enregistrer' },
  },
  {
    id: 'yahoo', nom: 'Yahoo', ou: 'Réservé à Yahoo Mail Plus (payant).',
    lien: 'https://mail.yahoo.com/', lienMot: 'Ouvrir Yahoo Mail',
    etapes: [
      'Yahoo Mail → Paramètres → Plus de paramètres.',
      'Boîtes aux lettres → ton adresse → Transfert.',
      'Colle ton adresse VRM, puis Vérifier.',
      'Yahoo envoie un lien. Il s’affiche juste ici.',
      'Ouvre le lien, puis Enregistrer.',
    ],
    code: 3,
    ecran: { titre: 'Boîtes aux lettres', champ: 'Adresse de transfert', bouton: 'Vérifier' },
  },
  {
    id: 'autre', nom: 'Autre', ou: 'SFR, La Poste, Proton… : le principe est le même.',
    lien: '', lienMot: '',
    etapes: [
      'Ouvre les réglages de ta messagerie.',
      'Cherche « Transfert », « Faire suivre » ou « Redirection ».',
      'Colle ton adresse VRM. Garde une copie chez toi.',
      'Une confirmation demandée ? Elle arrive dans ta boîte VRM.',
    ],
    ecran: { titre: 'Réglages', champ: 'Transférer à', bouton: 'Enregistrer' },
  },
];

// Le relais d'Apple (« Masquer mon adresse e-mail », « Se connecter avec
// Apple ») : une adresse @privaterelay.appleid.com n'est PAS une boîte. Apple
// fait suivre vers UNE adresse de ton compte Apple (le réglage « Transférer à »
// n'accepte que celles-là) : le transfert vers VRM se pose dans CETTE boîte.
export const RELAIS_APPLE = [
  'C’est le relais d’Apple : il fait suivre vers ta vraie boîte.',
  'iPhone : Réglages → ton nom → iCloud → Masquer mon adresse.',
  'Regarde « Transférer à » : c’est ta vraie boîte.',
  'Crée le transfert vers VRM dans CETTE boîte-là.',
];

// Le filtre Gmail « seulement Vinted et les colis ».
export const ETAPES_FILTRE_GMAIL = [
  'Fais d’abord les étapes 1 à 4.',
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
