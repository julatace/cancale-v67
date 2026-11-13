// ── ALERTE ARNAQUE DANS LES MESSAGES (11 nov., lot anti-arnaque) ────────────
// Demande validée par Julien : repérer dans un message REÇU les motifs typiques
// d'escroquerie et le DIRE (une bannière ambre sur la conversation, un compteur
// discret dans Messages). SANS IA (§2.9) : des règles écrites, ici, pures.
//
// Ce que la règle promet :
//   · elle ne lit QUE les messages PROUVÉS de l'autre personne (`deMoi === false`).
//     Un message de lui, ou dont l'auteur n'est pas su (`null`/`undefined`),
//     n'est jamais lu (« pas su » ne vaut pas « oui », et jamais de faux positif
//     sur SES propres messages) ;
//   · elle n'AGIT jamais : ni signalement, ni blocage, ni réponse. Elle rend des
//     motifs ; l'écran dit la raison et le bon geste, SON clic fait le reste ;
//   · un motif est une RAISON nommée (clé tr()), jamais un score.
// Banc des motifs : `scripts/audit-anti-arnaque.cjs` (vrais positifs ET messages
// normaux qui ne doivent pas déclencher) ; rendu : `scripts/bancs/anti-arnaque.cjs`.

// Le texte comparé : minuscules, sans accents, apostrophes droites, espaces simples.
export function normaliser(texte) {
  return String(texte == null ? '' : texte)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[  \t\r\n]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}
// Le même texte sans rien d'autre que les lettres et chiffres (« w.h.a.t.s app » ⇒ « whatsapp »).
const compact = (n) => n.replace(/[^a-z0-9]+/g, '');
// Les phrases (un motif à deux morceaux se cherche DANS une phrase, jamais à cheval).
const phrases = (n) => n.split(/[.!?;\n]+(?:\s|$)|\s[-–—]\s/).map((s) => s.trim()).filter(Boolean);

// ── Les domaines ───────────────────────────────────────────────────────────
// Les domaines OFFICIELS des marques qu'un faux site imite (un sous-domaine compte).
const OFFICIELS = [
  'vinted.fr', 'vinted.com', 'vinted.be', 'vinted.es', 'vinted.it', 'vinted.de', 'vinted.co.uk', 'vinted.nl', 'vinted.pl', 'vinted.lu', 'vinted.at', 'vinted.pt', 'vinted.ie', 'vinted.lt', 'vinted.cz', 'vinted.net',
  'leboncoin.fr', 'leboncoin.io',
  'paypal.com', 'paypal.fr', 'paypal.me', // paypal.me est bien PayPal : c'est un PAIEMENT hors plateforme (motif à part), pas une imitation
  'vestiairecollective.com',
  'ebay.fr', 'ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.it', 'ebay.es', 'ebay.be', 'ebay.nl', 'ebaystatic.com', 'ebayimg.com',
  'mondialrelay.fr', 'mondialrelay.com', 'mondialrelay.be', 'mondialrelay.es',
  'laposte.fr', 'laposte.net', 'colissimo.fr', 'chronopost.fr', 'relaiscolis.com', 'vrm.center',
];
// Les marques imitées, écrites comme on les « déguise » (0 ⇒ o, 1/l ⇒ i).
const MARQUES = ['vinted', 'leboncoin', 'paypal', 'vestiaire', 'ebay', 'mondialrelay', 'mondial-relay', 'colissimo', 'chronopost', 'laposte', 'la-poste', 'relaiscolis'];
const deguise = (s) => s.replace(/0/g, 'o').replace(/[1l|!]/g, 'i').replace(/-/g, '');
// Les raccourcisseurs : le lien cache sa vraie destination.
const RACCOURCIS = ['bit.ly', 'tinyurl.com', 'cutt.ly', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'rebrand.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 's.id', 'v.gd', 'buff.ly', 'tr.im', 'shorte.st', 'adf.ly', 'bl.ink', 'lnkd.in', 'qrco.de', 'urlz.fr', 'gg.gg', 'short.io', 'tiny.one', 't.ly'];
const officiel = (h) => OFFICIELS.some((d) => h === d || h.endsWith('.' + d));
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g;
const UN_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;
// Un hôte : « http(s)://… », « www.… », ou « mot.tld » suivi d'un chemin ou d'une fin.
const HOTE = /(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,12})(?=[/:?#\s)\]"'<>,!]|\.(?:\s|$)|$)/g;
export function hotesDuTexte(n) {
  const sans = n.replace(EMAIL, ' ');
  const out = [];
  let m; HOTE.lastIndex = 0;
  while ((m = HOTE.exec(sans))) {
    const h = m[1].replace(/^www\./, '');
    // « 12.50 », « m.dupont » : un hôte a au moins deux lettres avant son extension.
    if (!/(?:^|\.)(?=[a-z0-9-]*[a-z][a-z0-9-]*[a-z])[a-z0-9-]+\.[a-z]{2,12}$/.test(h) && !RACCOURCIS.includes(h)) continue;
    out.push(h);
  }
  return out;
}
const imite = (h) => {
  if (officiel(h)) return null;
  const d = deguise(h);
  for (const mq of MARQUES) if (d.includes(deguise(mq))) return mq.replace(/-/g, '');
  return null;
};

// ── Les motifs ─────────────────────────────────────────────────────────────
// Chaque motif : un identifiant (data-*), sa raison et son geste (clés tr()),
// et sa règle sur le texte normalisé. L'ORDRE est la priorité : la bannière dit
// la raison la plus grave en une phrase.
const UNE = (re) => (n) => phrases(n).some((p) => re.test(p));
const ET = (a, b) => (n) => phrases(n).some((p) => a.test(p) && b.test(p));
const PLATEFORME = /\b(vinted|leboncoin|vestiaire|ebay)\b/;

export const MOTIFS_ARNAQUE = [
  {
    // « Donne-moi le code que tu viens de recevoir par SMS » — le vol de compte.
    id: 'codeSms', raison: 'antiArnaque.raison.codeSms', geste: 'antiArnaque.geste.codeSms',
    test: (n) => phrases(n).some((p) => {
      if (/\b(retrait|suivi|promo|postal|relais|casier|locker|colis)\b/.test(p)) return false;
      return /\bcode\b(?:\W+\w+){0,6}?\W+(sms|texto|par message|sur ton (tel|telephone|portable))\b/.test(p)
        || /\b(sms|texto)\b(?:\W+\w+){0,6}?\W+code\b/.test(p)
        || /\b(donne|envoie|envoi|communique|transmets|transmet|dis|renvoie|copie)[- ]?(moi|nous)?\W+(le|ce|ton|les|tes) (code|chiffres)\b/.test(p)
        || /\bcode (de verification|de confirmation|de securite|a usage unique|a 6 chiffres)\b/.test(p);
    }),
  },
  {
    // Le faux « paiement bloqué » : payer des frais pour « débloquer » son argent.
    id: 'fauxBlocage', raison: 'antiArnaque.raison.fauxBlocage', geste: 'antiArnaque.geste.fauxBlocage',
    test: (n) => /\bfrais (de |d')(deblocage|activation|verification|validation|securisation|assurance|certification)\b/.test(n)
      || UNE(/\bdebloqu\w*\b.{0,40}\b(paiement|argent|fonds|virement|transaction|compte|vente|somme)\b|\b(paiement|argent|fonds|virement|transaction|somme)\b.{0,40}\bdebloqu/)(n)
      || ET(/\b(paiement|argent|fonds|virement|transaction|somme)\b.{0,30}\b(bloque|bloquee|suspendu|suspendue|gele|gelee)\b/, /\b(frais|payer|paye|regler|valider|confirmer|activer|lien|clique)\b/)(n),
  },
  {
    // Un lien vers un site qui imite Vinted, Leboncoin, PayPal, un transporteur…
    id: 'lienImite', raison: 'antiArnaque.raison.lienImite', geste: 'antiArnaque.geste.lien',
    test: (n) => hotesDuTexte(n).some((h) => !!imite(h))
      || /\b(vinted|v1nted|vlnted|leboncoin|leb0ncoin|paypal|paypa1|vestiaire)[-_](secur\w*|verif\w*|paiement|payment|pay|support|livraison|delivery|protect\w*|confirm\w*|transaction|garantie|client|help|service|safe)\b/.test(n),
  },
  {
    // Un lien raccourci : on ne voit pas où il mène.
    id: 'lienRaccourci', raison: 'antiArnaque.raison.lienRaccourci', geste: 'antiArnaque.geste.lien',
    test: (n) => hotesDuTexte(n).some((h) => RACCOURCIS.includes(h)),
  },
  {
    // Payer hors de la plateforme : virement, RIB, PayPal « entre proches », Lydia, mandat…
    id: 'paiementHors', raison: 'antiArnaque.raison.paiementHors', geste: 'antiArnaque.geste.resteSurPlateforme',
    test: (n) => {
      const c = compact(n);
      if (/paypal\W*(entre|pour|en)?\W*(proches?|amis?|famille|friends)|amis et (la )?famille|friends (and|&) family|\bf ?& ?f\b/.test(n)) return true;
      if (hotesDuTexte(n).some((h) => h === 'paypal.me' || h.endsWith('.paypal.me') || h === 'lydia-app.com' || h === 'lydia.me')) return true;
      if (/\b(par|via|sur|avec|en) (lydia|paylib|wero|western union|moneygram|revolut|sumeria)\b|\blydia pro\b|\bwestern ?union\b|\bmoneygram\b/.test(n)) return true;
      if (/\bmandat (cash|postal|compte|western)\b/.test(n)) return true;
      if (/\b(iban|rib)\b/.test(n) || c.includes('ibanfr')) return true;
      // Un « virement » proposé par la personne — pas le versement de la plateforme.
      return phrases(n).some((p) => /\bvirement\b|\bvirer\b|\bje (te |vous )?(vire|virerai)\b/.test(p) && !PLATEFORME.test(p));
    },
  },
  {
    // « Envoie d'abord, je paie après » : la paire part, l'argent jamais.
    id: 'envoieDabord', raison: 'antiArnaque.raison.envoieDabord', geste: 'antiArnaque.geste.envoieDabord',
    test: UNE(/\b(envoie|envoi|envoyer|envoyez|expedie|expedier|expediez|poste|poster|postez)\b.{0,40}\b(d'abord|en premier|avant)\b.{0,60}\b(pai|pay|vir|regl|regl)\w*|\b(je|on) (te |vous )?(paie|paye|payerai|paierai|regle|reglerai|vire|virerai)\b.{0,25}\b(apres|a la reception|des reception|a reception|quand je (l'|les )?(ai|aurai) recu|une fois (recu|le colis recu))|\bpaiement (a la reception|apres reception|a la livraison|apres livraison)\b/),
  },
  {
    // « Mon transporteur passe la récupérer » : un colis qui part hors de la plateforme.
    id: 'transporteurPerso', raison: 'antiArnaque.raison.transporteurPerso', geste: 'antiArnaque.geste.transporteurPerso',
    test: UNE(/\b(mon|ma|notre) (propre )?(transporteur|livreur|coursier|chauffeur|societe de (livraison|transport)|agent de livraison)\b|\b(un|une) (coursier|livreur|transporteur|chauffeur)\b.{0,30}\b(va|viendra|passera|passe|vient)\b.{0,30}\b(recuperer|chercher|prendre|enlever)\b|\blivraison (par|avec) (mon|ma|un|une) (transporteur|coursier|livreur|societe)\b/),
  },
  {
    // Continuer AILLEURS : WhatsApp, Telegram, e-mail, numéro de téléphone.
    id: 'horsPlateforme', raison: 'antiArnaque.raison.horsPlateforme', geste: 'antiArnaque.geste.resteSurPlateforme',
    test: (n) => {
      const c = compact(n);
      if (/whatsapp|whatsap|watsap|watsapp|whatapp|wathsapp|telegram|telegramme/.test(c)) return true;
      if (/\bwa\.me\/|\bt\.me\/|\bviber\b|\bsnapchat\b|\bsur snap\b|\bmessenger\b|\bsignal\.me\b/.test(n)) return true;
      if (UN_EMAIL.test(n)) return true;
      // Un numéro de portable français (06/07, +33 6/7), jamais un n° de suivi (plus long, pas en 06/07).
      if (/(?:^|[^\d+])(?:\+33 ?|0033 ?|0)[67](?:[ .-]?\d{2}){4}(?!\d)/.test(n)) return true;
      return UNE(/\b(ecris|ecrivez|contacte|contactez|appelle|appelez|joins|joignez|repond|repondez)[- ]?(moi|nous)?\b.{0,20}\b(par|sur|au|a mon) (mail|e-mail|email|sms|telephone|tel|portable|numero)\b|\b(mon|ma) (mail|e-mail|email|adresse mail|adresse e-mail|numero de (telephone|portable|tel)|num de tel|06)\b(?!.{0,10}\bsuivi\b)/)(n);
    },
  },
];
const PAR_ID = new Map(MOTIFS_ARNAQUE.map((m) => [m.id, m]));

// Les motifs d'UN texte (dans l'ordre de priorité), sans savoir qui l'a écrit.
export function motifsDuTexte(texte) {
  const n = normaliser(texte);
  if (!n) return [];
  return MOTIFS_ARNAQUE.filter((m) => { try { return m.test(n); } catch (_) { return false; } }).map((m) => m.id);
}

// L'alerte d'une CONVERSATION. `messages` : [{ t, deMoi }]. Seuls les messages
// PROUVÉS de l'autre personne (`deMoi === false`) sont lus. Rend `null` (rien vu)
// ou { motif, raison, geste, motifs: [ids], n } — `n` = messages reçus concernés.
export function alerteArnaque(messages) {
  if (!Array.isArray(messages) || !messages.length) return null;
  const vus = new Set(); let n = 0;
  for (const m of messages) {
    if (!m || m.deMoi !== false) continue;
    const ids = motifsDuTexte(m.t);
    if (ids.length) { n++; ids.forEach((id) => vus.add(id)); }
  }
  if (!vus.size) return null;
  const motifs = MOTIFS_ARNAQUE.filter((m) => vus.has(m.id)).map((m) => m.id);
  const p = PAR_ID.get(motifs[0]);
  return { motif: p.id, raison: p.raison, geste: p.geste, motifs, n };
}

// Le dernier message d'une ligne de la liste (son aperçu) : une alerte seulement
// s'il est PROUVÉ de l'autre personne. Rend l'identifiant du motif, ou null.
export function motifDeLApercu(texte, deMoi) {
  if (deMoi !== false) return null;
  const ids = motifsDuTexte(texte);
  return ids.length ? ids[0] : null;
}

// Le motif → ses textes (clés tr()) ; inconnu ⇒ null.
export const motifArnaque = (id) => { const m = PAR_ID.get(id); return m ? { motif: m.id, raison: m.raison, geste: m.geste } : null; };
