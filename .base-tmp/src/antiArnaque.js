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
// (15 nov., lot securite-ventes — Julien : « vas-y fais tout ») LES CINQ LANGUES : les
// mêmes motifs écrits aussi en anglais, espagnol, italien et allemand (un acheteur
// étranger arnaque dans SA langue), + le faux « j'ai payé, vérifie ton mail »
// (`fauxPaiement`). L'écran dit UNE phrase par motif (`phrase`, clé tr() : le risque
// ET le geste), le site nommé. Toujours sans IA, toujours sans aucune action.

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

// (15 nov.) Les motifs écrits en français d'abord, puis en anglais, espagnol, italien, allemand.
const ENVOIE_DABORD_FR = UNE(/\b(envoie|envoi|envoyer|envoyez|expedie|expedier|expediez|poste|poster|postez)\b.{0,40}\b(d'abord|en premier|avant)\b.{0,60}\b(pai|pay|vir|regl|regl)\w*|\b(je|on) (te |vous )?(paie|paye|payerai|paierai|regle|reglerai|vire|virerai)\b.{0,25}\b(apres|a la reception|des reception|a reception|quand je (l'|les )?(ai|aurai) recu|une fois (recu|le colis recu))|\bpaiement (a la reception|apres reception|a la livraison|apres livraison)\b/);
const ENVOIE_DABORD_AILLEURS = UNE(/\b(send|ship|post)\b.{0,30}\bfirst\b.{0,60}\b(pay|paid)\w*|\bi('ll| will) pay\b.{0,30}\b(after|once|when)\b.{0,30}\b(receiv|deliver|arriv)\w*|\b(pay|payment) on (delivery|receipt|arrival)\b|\b(envia|enviame|enviamelo|enviala|manda)\w*\b.{0,30}\b(primero|antes)\b.{0,60}\b(pag)\w*|\bte (pago|pagare)\b.{0,30}\b(cuando (lo|la|las|los) reciba|al recibir|despues|a la entrega)|\b(contra ?reembolso|pago a la entrega)\b|\b(spedisci|spediscimi|manda|invia)\w*\b.{0,30}\bprima\b.{0,60}\b(pag)\w*|\bti (pago|paghero)\b.{0,30}\b(alla (ricezione|consegna)|quando (arriva|lo ricevo|la ricevo|arrivano)|dopo)|\b(contrassegno|pagamento alla consegna)\b|\b(schick|sende|versende|verschick)\w*\b.{0,30}\b(zuerst|vorher|erst)\b.{0,60}\b(zahl|bezahl|uberweis)\w*|\b(ich )?(zahle|bezahle|uberweise)\b.{0,30}\b(bei|nach) (erhalt|ankunft|lieferung)\b|\bper nachnahme\b/);
// « J'ai payé » (passé, une affirmation) ET « regarde tes mails » : les deux dans le message.
const PAYE_DIT = /\b(j'ai (deja |bien )?(paye|regle|vire|envoye (le |l')?(paiement|argent))|paiement (effectue|envoye|fait|valide|confirme)|c'est paye|i('ve| have)? (already )?(paid|sent (the |you the )?(payment|money))|payment (has been |was )?(sent|made|completed|confirmed)|(ya )?(te )?he pagado|(ya )?pague|pago (realizado|enviado|hecho|confirmado)|ho (gia )?(pagato|inviato il pagamento)|pagamento (effettuato|inviato|fatto|confermato)|(ich )?habe (schon |bereits )?(bezahlt|uberwiesen|gezahlt)|zahlung (ist )?(erfolgt|gesendet|bestatigt|raus))\b/;
const VOIS_MAIL = /\b(verifie|regarde|consulte|check|ouvre|vois|look at|check out|open|revisa|mira|comprueba|abre|controlla|guarda|apri|verifica|schau|prufe|check|offne|sieh)\b.{0,30}\b(mail|mails|e-mail|e-mails|email|emails|boite|boite mail|inbox|correo|posta|casella|postfach|spam)\b|\b(mail|e-mail|email|correo|posta) (de|from|da|von) (vinted|paypal|leboncoin|vestiaire|ebay)\b/;
const TRANSPORTEUR_FR = UNE(/\b(mon|ma|notre) (propre )?(transporteur|livreur|coursier|chauffeur|societe de (livraison|transport)|agent de livraison)\b|\b(un|une) (coursier|livreur|transporteur|chauffeur)\b.{0,30}\b(va|viendra|passera|passe|vient)\b.{0,30}\b(recuperer|chercher|prendre|enlever)\b|\blivraison (par|avec) (mon|ma|un|une) (transporteur|coursier|livreur|societe)\b/);
const TRANSPORTEUR_AILLEURS = UNE(/\bmy (own )?(courier|shipping (agent|company)|delivery (agent|guy|man)|driver)\b|\b(a|my) (courier|driver|delivery agent)\b.{0,30}\b(will|is going to|gonna)\b.{0,20}\b(pick|collect|come)\b|\bmi (propio )?(transportista|mensajero|repartidor|chofer)\b|\bun (mensajero|transportista|repartidor)\b.{0,30}\b(recog|pasar)\w*|\bil mio (corriere|autista|trasportatore)\b|\bun (corriere|fattorino)\b.{0,30}\b(ritir|passer)\w*|\bmein (eigener )?(kurier|spediteur|fahrer|paketdienst)\b|\bein (kurier|fahrer)\b.{0,30}\b(holt|abholen|kommt)\b/);

export const MOTIFS_ARNAQUE = [
  {
    // « Donne-moi le code que tu viens de recevoir par SMS » — le vol de compte.
    id: 'codeSms', raison: 'antiArnaque.raison.codeSms', geste: 'antiArnaque.geste.codeSms', phrase: 'antiArnaque.phrase.codeSms',
    test: (n) => phrases(n).some((p) => {
      if (/\b(retrait|suivi|promo|postal|relais|casier|locker|colis|tracking|pickup|seguimiento|recogida|tracciamento|ritiro|sendungsverfolgung|abholcode|paket)\b/.test(p)) return false;
      return /\bcode\b(?:\W+\w+){0,6}?\W+(sms|texto|par message|sur ton (tel|telephone|portable))\b/.test(p)
        || /\b(sms|texto)\b(?:\W+\w+){0,6}?\W+code\b/.test(p)
        || /\b(donne|envoie|envoi|communique|transmets|transmet|dis|renvoie|copie)[- ]?(moi|nous)?\W+(le|ce|ton|les|tes) (code|chiffres)\b/.test(p)
        || /\bcode (de verification|de confirmation|de securite|a usage unique|a 6 chiffres)\b/.test(p)
        // en · es · it · de (« le code reçu par SMS », « envoie-moi le code », « code de vérification »)
        || /\b(code|codigo|codice)\b(?:\W+\w+){0,6}?\W+(sms|text message|texto|mensaje|messaggio)\b|\b(sms|text)\b(?:\W+\w+){0,6}?\W+(code|codigo|codice)\b/.test(p)
        || /\b(send|give|tell|forward|text) me (the|that|your) (code|digits)\b|\b(verification|confirmation|security|one[- ]time|6[- ]digit) code\b/.test(p)
        || /\b(pasame|dame|enviame|mandame|dime) (el|ese|tu) codigo\b|\bcodigo de (verificacion|confirmacion|seguridad)\b/.test(p)
        || /\b(mandami|dammi|inviami|dimmi|girami) (il|quel|tuo) codice\b|\bcodice di (verifica|conferma|sicurezza)\b/.test(p)
        || /\b(schick|sende|gib|sag) mir (den|deinen|diesen) code\b|\b(bestatigungs|verifizierungs|sicherheits)code\b|\bcode per sms\b/.test(p);
    }),
  },
  {
    // Le faux « paiement bloqué » : payer des frais pour « débloquer » son argent.
    id: 'fauxBlocage', raison: 'antiArnaque.raison.fauxBlocage', geste: 'antiArnaque.geste.fauxBlocage', phrase: 'antiArnaque.phrase.fauxBlocage',
    test: (n) => /\bfrais (de |d')(deblocage|activation|verification|validation|securisation|assurance|certification)\b/.test(n)
      // en · es · it · de : « unlock fee », « pago bloqueado … paga », « pagamento bloccato … clicca », « Zahlung blockiert … zahlen »
      || /\b(unlock|release|activation|verification|insurance) fee\b|\btasa de (desbloqueo|activacion|verificacion)\b|\bcommissione di (sblocco|attivazione|verifica)\b|\b(freischalt|aktivierungs|verifizierungs)gebuhr\b/.test(n)
      || ET(/\b(payment|money|funds|pago|dinero|fondos|pagamento|soldi|fondi|zahlung|geld)\b.{0,30}\b(blocked|on hold|frozen|suspended|bloqueado|retenido|congelado|bloccato|sospeso|congelato|blockiert|gesperrt|eingefroren)\b/, /\b(fee|pay|click|link|confirm|verify|paga|pagar|clic|haz clic|enlace|confirma|clicca|link|conferma|zahl\w*|klick\w*|link|bestatig\w*)\b/)(n)
      || UNE(/\bdebloqu\w*\b.{0,40}\b(paiement|argent|fonds|virement|transaction|compte|vente|somme)\b|\b(paiement|argent|fonds|virement|transaction|somme)\b.{0,40}\bdebloqu/)(n)
      || ET(/\b(paiement|argent|fonds|virement|transaction|somme)\b.{0,30}\b(bloque|bloquee|suspendu|suspendue|gele|gelee)\b/, /\b(frais|payer|paye|regler|valider|confirmer|activer|lien|clique)\b/)(n),
  },
  {
    // Un lien vers un site qui imite Vinted, Leboncoin, PayPal, un transporteur…
    id: 'lienImite', raison: 'antiArnaque.raison.lienImite', geste: 'antiArnaque.geste.lien', phrase: 'antiArnaque.phrase.lienImite',
    test: (n) => hotesDuTexte(n).some((h) => !!imite(h))
      || /\b(vinted|v1nted|vlnted|leboncoin|leb0ncoin|paypal|paypa1|vestiaire)[-_](secur\w*|verif\w*|paiement|payment|pay|support|livraison|delivery|protect\w*|confirm\w*|transaction|garantie|client|help|service|safe)\b/.test(n),
  },
  {
    // Un lien raccourci : on ne voit pas où il mène.
    id: 'lienRaccourci', raison: 'antiArnaque.raison.lienRaccourci', geste: 'antiArnaque.geste.lien', phrase: 'antiArnaque.phrase.lienRaccourci',
    test: (n) => hotesDuTexte(n).some((h) => RACCOURCIS.includes(h)),
  },
  {
    // Payer hors de la plateforme : virement, RIB, PayPal « entre proches », Lydia, mandat…
    id: 'paiementHors', raison: 'antiArnaque.raison.paiementHors', geste: 'antiArnaque.geste.resteSurPlateforme', phrase: 'antiArnaque.phrase.paiementHors',
    test: (n) => {
      const c = compact(n);
      if (/paypal\W*(entre|pour|en)?\W*(proches?|amis?|famille|friends)|amis et (la )?famille|friends (and|&) family|\bf ?& ?f\b/.test(n)) return true;
      if (hotesDuTexte(n).some((h) => h === 'paypal.me' || h.endsWith('.paypal.me') || h === 'lydia-app.com' || h === 'lydia.me')) return true;
      if (/\b(par|via|sur|avec|en) (lydia|paylib|wero|western union|moneygram|revolut|sumeria)\b|\blydia pro\b|\bwestern ?union\b|\bmoneygram\b/.test(n)) return true;
      if (/\bmandat (cash|postal|compte|western)\b/.test(n)) return true;
      // en · es · it · de : PayPal « amis », Bizum, Satispay, Venmo, cartes cadeaux, « hors de la plateforme »
      if (/paypal\W*(amigos|amici|freunde|familie|familia|famiglia)|\bfreunde (und|&) familie\b|\bamigos y familia(res)?\b|\bamici e (parenti|famiglia)\b/.test(n)) return true;
      if (/\b(bizum|satispay|venmo|zelle|cash ?app|paysafecard|neosurf|transcash|pcs mastercard)\b/.test(n)) return true;
      if (/\b(gift ?card|carte cadeau|carte prepayee|tarjeta regalo|buono regalo|carta regalo|geschenkkarte|gutscheinkarte|coupon (pcs|transcash|neosurf))\b/.test(n)) return true;
      if (UNE(/\b(pai|pay|regl|vir|pag|zahl|uberweis)\w*\b.{0,40}\b(hors|en dehors|outside|fuera|fuori|ausserhalb)\b.{0,15}\b(de |du |of |the |di |della |dell'|von |der )?(vinted|leboncoin|vestiaire|ebay|plateforme|site|appli|application|app|platform|plataforma|piattaforma|plattform)\b/)(n)) return true;
      if (UNE(/\b(pay|paying|pago|pagar|pagare|zahle|zahlen)\b.{0,25}\b(directly|direct|directamente|direttamente|direkt)\b/)(n)) return true;
      if (/\b(iban|rib)\b/.test(n) || c.includes('ibanfr')) return true;
      // Un « virement » proposé par la personne — pas le versement de la plateforme.
      return phrases(n).some((p) => /\bvirement\b|\bvirer\b|\bje (te |vous )?(vire|virerai)\b|\b(bank|wire) transfer\b|\btransferencia( bancaria)?\b|\bbonifico\b|\buberweisung\b|\buberweise\b/.test(p) && !PLATEFORME.test(p));
    },
  },
  {
    // « Envoie d'abord, je paie après » : la paire part, l'argent jamais.
    id: 'envoieDabord', raison: 'antiArnaque.raison.envoieDabord', geste: 'antiArnaque.geste.envoieDabord', phrase: 'antiArnaque.phrase.envoieDabord',
    test: (n) => ENVOIE_DABORD_AILLEURS(n) || ENVOIE_DABORD_FR(n),
  },
  {
    // (15 nov.) Le FAUX « j'ai payé, vérifie ton mail » : un faux e-mail de paiement remplace la plateforme.
    id: 'fauxPaiement', raison: 'antiArnaque.raison.fauxPaiement', geste: 'antiArnaque.geste.fauxPaiement', phrase: 'antiArnaque.phrase.fauxPaiement',
    test: (n) => PAYE_DIT.test(n) && VOIS_MAIL.test(n),
  },
  {
    // « Mon transporteur passe la récupérer » : un colis qui part hors de la plateforme.
    id: 'transporteurPerso', raison: 'antiArnaque.raison.transporteurPerso', geste: 'antiArnaque.geste.transporteurPerso', phrase: 'antiArnaque.phrase.transporteurPerso',
    test: (n) => TRANSPORTEUR_FR(n) || TRANSPORTEUR_AILLEURS(n),
  },
  {
    // Continuer AILLEURS : WhatsApp, Telegram, e-mail, numéro de téléphone.
    id: 'horsPlateforme', raison: 'antiArnaque.raison.horsPlateforme', geste: 'antiArnaque.geste.resteSurPlateforme', phrase: 'antiArnaque.phrase.horsPlateforme',
    test: (n) => {
      const c = compact(n);
      if (/whatsapp|whatsap|watsap|watsapp|whatapp|wathsapp|telegram|telegramme/.test(c)) return true;
      if (/\bwa\.me\/|\bt\.me\/|\bviber\b|\bsnapchat\b|\bsur snap\b|\bmessenger\b|\bsignal\.me\b/.test(n)) return true;
      if (UN_EMAIL.test(n)) return true;
      // Un numéro de portable français (06/07, +33 6/7), jamais un n° de suivi (plus long, pas en 06/07).
      if (/(?:^|[^\d+])(?:\+33 ?|0033 ?|0)[67](?:[ .-]?\d{2}){4}(?!\d)/.test(n)) return true;
      // (15 nov.) Un portable ÉTRANGER écrit à l'international (+44 7…, +34 6…, +39 3…, +49 15…) : un « + » et 9 à 12 chiffres.
      if (/(?:^|[^\w+])\+(?:3[0-9]|4[0-9]|1)[ .-]?\(?\d{1,4}\)?(?:[ .-]?\d{2,4}){2,4}(?!\d)/.test(n) && (n.match(/\d/g) || []).length >= 9) return true;
      // « Continue ailleurs » : hors de la plateforme, en français et en quatre langues.
      if (UNE(/\b(continu|parl|discut|ecri|contact)\w*\b.{0,25}\b(en dehors|hors) (de |du |d')?(vinted|leboncoin|vestiaire|ebay|la plateforme|l'appli|l'application|du site)\b/)(n)) return true;
      if (UNE(/\b(text|call|email|e-mail|message|contact|reach|dm) me\b.{0,15}\b(on|at|via|by)\b|\bmy (phone|mobile|cell|whatsapp|telegram)( number| no)?\b|\bmy (email|e-mail)( address)?\b|\b(let's|lets) (talk|chat|continue) (on|outside|off)\b|\boutside (of )?(vinted|the app|the platform|ebay)\b/)(n)) return true;
      if (UNE(/\b(escribeme|llamame|contactame|hablame)\b.{0,15}\b(al|por|en|a mi)\b|\bmi (numero|movil|telefono|correo|email)\b(?! (de |di )?(seguimiento|tracciamento|pedido|envio|ordine|spedizione|transaccion))|\bfuera de (vinted|la app|la aplicacion|la plataforma)\b/)(n)) return true;
      if (UNE(/\b(scrivimi|chiamami|contattami)\b.{0,15}\b(su|al|per|via|alla|a)\b|\bil mio (numero|cellulare|telefono|indirizzo email|email)\b(?! (di )?(tracciamento|ordine|spedizione))|\bla mia (mail|email)\b|\bfuori da (vinted|l'app|la piattaforma)\b/)(n)) return true;
      if (UNE(/\b(schreib|ruf|kontaktier|meld)\w* (mir|mich)\b.{0,15}\b(auf|per|bei|uber|unter|an)\b|\bmeine (handynummer|telefonnummer|e-mail|email|mailadresse)\b|\bausserhalb (von )?(vinted|der app|der plattform)\b/)(n)) return true;
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
  return { motif: p.id, raison: p.raison, geste: p.geste, phrase: p.phrase, motifs, n };
}

// Le dernier message d'une ligne de la liste (son aperçu) : une alerte seulement
// s'il est PROUVÉ de l'autre personne. Rend l'identifiant du motif, ou null.
export function motifDeLApercu(texte, deMoi) {
  if (deMoi !== false) return null;
  const ids = motifsDuTexte(texte);
  return ids.length ? ids[0] : null;
}

// Le motif → ses textes (clés tr()) ; inconnu ⇒ null.
export const motifArnaque = (id) => { const m = PAR_ID.get(id); return m ? { motif: m.id, raison: m.raison, geste: m.geste, phrase: m.phrase } : null; };
