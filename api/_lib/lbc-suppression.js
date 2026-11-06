// api/_lib/lbc-suppression.js
// ────────────────────────────────────────────────────────────────────────────
// (6 nov.) L'E-MAIL LEBONCOIN « SUPPRESSION DE VOS ANNONCES SUR LEBONCOIN.FR »
//
// MESURÉ en lecture seule sur sa base (2 e-mails du 21 oct., gardés « aucune
// règle ne le reconnaît ») : expéditeur `no.reply@leboncoin.fr`, corps « Votre
// annonce <titre> a bien été supprimée du site leboncoin.fr le <j mois aaaa>. »
// puis le titre seul. Les liens du HTML : leboncoin.fr, « déposer une annonce »,
// les CGU, les réseaux, les magasins d'applications — AUCUN identifiant
// d'annonce (ni lien `/ad/…`, ni `list_id`, ni n° à 8 chiffres ou plus qui
// ne soit celui d'une appli ou d'une page Facebook).
// ⇒ Aucune IDENTITÉ : le titre n'en est pas une (§5 — « même avec 50 articles
//    identiques »). VRM ne retire donc RIEN, ne relie RIEN, ne change aucun N°.
//    Il garde l'e-mail (« on ne jette aucun e-mail », famille reconnue) et dit
//    LE geste qui apporte l'identité : ouvrir « Mes annonces » sur Leboncoin —
//    l'extension relit alors la liste COMPLÈTE de ce compte (`lbc_listings`),
//    et c'est elle qui fait foi.
// Une notification « Rappels », UNE fois par jour (Paris) : une suppression en
// lot envoie un e-mail par annonce (deux à une seconde d'écart chez lui), le
// geste est le même pour toutes.
// Pur : aucune lecture, aucune écriture.
// ────────────────────────────────────────────────────────────────────────────

// La catégorie de notification (famille « Rappels », api/_lib/notif-textes.js).
export const CAT_LBC_SUPPRESSION = 'lbcsuppression';
// La famille reconnue (le même mot côté app, `familleEmail` — audit-email-formes).
export const FAMILLE_LBC_SUPPRESSION = 'annonce Leboncoin supprimée';

const DE_LBC = /@(?:[a-z0-9-]+\.)*leboncoin\.fr\b/i;
const SUJET = /^\s*(?:(?:tr|fwd?|fw)\s*:\s*)*Suppression\s+de\s+vos\s+annonces\b/i;
// Le titre ne traverse jamais une autre « Votre annonce » (le corps commence par
// « *Votre annonce a été supprimée* », sans titre).
const PHRASE = /Votre\s+annonce\s+((?:(?!Votre\s+annonce)[\s\S]){2,200}?)\s+a\s+bien\s+[ée]t[ée]\s+supprim[ée]e\s+du\s+site\s+leboncoin\.fr(?:\s+le\s+(\d{1,2}(?:er)?\s+[A-Za-zÀ-ÿ]+\s+\d{4}))?/i;

// L'e-mail est-il un « Suppression de vos annonces » de Leboncoin ?
// Le SUJET et l'expéditeur, ou la phrase de Leboncoin (un transfert « TR: »
// garde le sujet ; un relais peut réécrire l'expéditeur).
export function estSuppressionLbc({ subject = '', from = '', text = '' } = {}) {
  const s = String(subject || ''), f = String(from || ''), t = String(text || '');
  if (SUJET.test(s) && (DE_LBC.test(f) || /leboncoin/i.test(s) || PHRASE.test(t))) return true;
  return PHRASE.test(t) && DE_LBC.test(f);
}

// Ce que l'e-mail DIT (jamais deviné) : le titre et la date, tels qu'écrits.
// `identite` est toujours `null` : mesuré, l'e-mail n'en porte aucune.
export function lireSuppressionLbc({ text = '' } = {}) {
  const t = String(text || '').replace(/\*/g, '');
  const m = PHRASE.exec(t);
  const titre = m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const date = m && m[2] ? m[2].replace(/\s+/g, ' ').trim() : '';
  return { titre, date, identite: null };
}

// Le jour de Paris (clé de la notification « une fois par jour »).
export const jourParis = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

// Le texte : ce qui s'est passé, puis LE geste.
export function texteSuppressionLbc({ titre = '', date = '' } = {}) {
  return {
    title: 'Leboncoin : annonce supprimée',
    body: `${titre ? `« ${String(titre).slice(0, 50)} »` : 'Une annonce'}${date ? ` (le ${date})` : ''} — ouvre « Mes annonces » sur Leboncoin pour que VRM relise la liste.`,
  };
}
