// ══════════════════════════════════════════════════════════════════════════════
// LA FEUILLE « TON ADRESSE VRM » — les mots et les pas-à-pas (8 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// La règle vit au serveur (api/_lib/adresse-reception.js) : ici, rien que ce que
// la feuille DIT, pur, testé par le banc `adresse-reception.cjs`.
// Trois états partout : `undefined` en cours · `null` pas su · réponse lue.
// ══════════════════════════════════════════════════════════════════════════════

export const ROUTE_ADRESSE = '/api/email-rattacher?mode=adresse-unique';

// « il y a 3 min », « il y a 2 h », « le 5 nov. » — d'une date LUE (jamais devinée).
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

// Le pas-à-pas par messagerie. `ecran` : le dessin schématique (le champ où coller).
// Les chemins de menu sont ceux des pages d'aide officielles (relevés le 6 nov.,
// docs/passation/2026-11-06-onglets-c.md).
export const FOURNISSEURS = [
  {
    id: 'gmail', nom: 'Gmail', ou: 'Sur un ordinateur — l’app Gmail du téléphone ne sait pas le faire.',
    lien: 'https://mail.google.com/mail/u/0/#settings/fwdandpop', lienMot: 'Ouvrir les réglages de Gmail',
    etapes: [
      'Gmail → ⚙︎ → Voir tous les paramètres → Transfert et POP/IMAP.',
      'Ajouter une adresse de transfert : colle ton adresse VRM, puis Suivant.',
      'Gmail envoie un code à ton adresse VRM : il s’affiche en haut de cette feuille dans la minute. Copie-le dans Gmail, puis Valider.',
      'Choisis « Transférer une copie des e-mails reçus » et « conserver la copie dans la boîte de réception », puis Enregistrer.',
    ],
    ecran: { titre: 'Transfert et POP/IMAP', champ: 'Ajouter une adresse de transfert', bouton: 'Suivant' },
  },
  {
    id: 'icloud', nom: 'iCloud', ou: 'Sur icloud.com, depuis un ordinateur.',
    lien: 'https://www.icloud.com/mail/', lienMot: 'Ouvrir iCloud Mail',
    etapes: [
      'iCloud Mail → ⚙︎ → Réglages → Règles → Ajouter une règle.',
      'Si un e-mail est « de » vinted (puis une règle par transporteur si tu veux).',
      'Alors « Transférer à » : colle ton adresse VRM. Terminé.',
    ],
    ecran: { titre: 'Règles', champ: 'Transférer à', bouton: 'Terminé' },
  },
  {
    id: 'outlook', nom: 'Outlook', ou: 'Sur outlook.com (Hotmail, Live).',
    lien: 'https://outlook.live.com/mail/0/options/mail/forwarding', lienMot: 'Ouvrir les réglages d’Outlook',
    etapes: [
      'Outlook → ⚙︎ → Courrier → Transfert.',
      'Active le transfert et colle ton adresse VRM.',
      'Coche « Conserver une copie des messages transférés », puis Enregistrer.',
    ],
    ecran: { titre: 'Transfert', champ: 'Transférer mon courrier à', bouton: 'Enregistrer' },
  },
  {
    id: 'yahoo', nom: 'Yahoo', ou: 'Le transfert de Yahoo est réservé à Yahoo Mail Plus (payant).',
    lien: 'https://mail.yahoo.com/', lienMot: 'Ouvrir Yahoo Mail',
    etapes: [
      'Yahoo Mail → Paramètres → Plus de paramètres → Boîtes aux lettres → ton adresse.',
      'Transfert : colle ton adresse VRM, puis Vérifier.',
      'Yahoo envoie un lien de vérification à ton adresse VRM : il s’affiche en haut de cette feuille. Ouvre-le, puis Enregistrer.',
    ],
    ecran: { titre: 'Boîtes aux lettres', champ: 'Adresse de transfert', bouton: 'Vérifier' },
  },
];

// Ce que VRM lit, par famille d'expéditeurs (les mots de l'app, une table).
export const CE_QUI_EST_LU = [
  { id: 'vinted', titre: 'Vinted', detail: 'Ventes, bordereaux, codes de retrait, offres et messages' },
  { id: 'transporteurs', titre: 'Transporteurs', detail: 'Colis arrivés à retirer, QR des casiers, suivi' },
  { id: 'sites', titre: 'Leboncoin, Vestiaire, eBay', detail: 'Ventes et suppressions d’annonces' },
];

// Le lien de l'e-mail d'essai : sa propre messagerie, vers son adresse VRM.
export const lienEssai = (adresse) => adresse
  ? `mailto:${adresse}?subject=${encodeURIComponent('Essai VRM')}&body=${encodeURIComponent('Un e-mail d’essai pour vérifier que mon adresse VRM reçoit bien.')}`
  : '';
