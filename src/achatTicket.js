// ═══════════════════════════════════════════════════════════════════════════
// NOUVEL ACHAT : LA PHOTO DU TICKET PROPOSE LES CHAMPS (11 nov., lot achat-photo)
// docs/passation/2026-11-11-achat-photo.md
// ═══════════════════════════════════════════════════════════════════════════
// Règle pure, sans React. La lecture (texte du ticket) vit dans
// src/depensesTicket.js : la même que la boîte à dépenses de Compta (3 nov.),
// locale et gratuite (§2.9). Ici : ce que la lecture fait au brouillon.
//
// ⚠️ §2.5 « il saisit les prix d'achat lui-même » : le montant lu n'est qu'une
//    PROPOSITION. Il remplit un champ VIDE seulement (jamais ce qu'il a tapé),
//    il est marqué « lu sur le ticket — vérifie », et le bouton dit le montant
//    (« Valider 45,00 € et ajouter ») : c'est SON clic qui l'enregistre.
//    Rien lu ⇒ le champ reste vide. Jamais un « plus grand nombre ».
// ─────────────────────────────────────────────────────────────────────────────

// Ce que la lecture fait au brouillon du formulaire. `lu` = lireTicketAchat(texte).
export function ticketVersBrouillon(d, { lu = {}, raison = null, fichier = null, aujourdhui = '', enMontant = (c) => String(c), texte = '' } = {}) {
  if (!d) return d;
  const n = { ...d };
  const champs = {};
  if (lu.montant != null && !String(d.price || '').trim()) { n.price = enMontant(lu.montant); champs.price = n.price; }
  // La date du jour est celle posée par défaut : la date LUE la remplace, une date qu'il a changée reste.
  if (lu.date && (!d.date || d.date === aujourdhui)) { n.date = lu.date; champs.date = lu.date; }
  if (lu.lieu && !String(d.source || '').trim()) { n.source = lu.lieu; champs.source = lu.lieu; }
  if (fichier && !d.facture) { n.facture = fichier; n.factureDuTicket = true; }
  const trouve = lu.montant != null || !!lu.date || !!lu.lieu;
  n.ticket = {
    etat: raison ? 'impossible' : trouve ? 'lu' : 'rien',
    raison: raison || null,
    champs,
    montant: lu.montant != null ? lu.montant : null,
    date: lu.date || null,
    lieu: lu.lieu || null,
    articles: lu.articles || null,
    // (23 nov., lot achats-hors-vinted) Le ticket à PLUSIEURS articles (vide-grenier, magasin) : la proposition de lot.
    lot: raison ? null : lotDuTicket(lu, lignesDuTicket(texte)),
  };
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// (23 nov., lot achats-hors-vinted) UN TICKET, PLUSIEURS ARTICLES ⇒ UN LOT PROPOSÉ
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé le 23 nov.) : « ajouter des achats faits hors Vinted (magasin, Leboncoin, vide-grenier) : photo du
// ticket (lecture locale dans le navigateur, sans IA payante — §2.9), ou import CSV ; chaque ligne devient un achat
// avec coût, date, lieu ; relier aux paires reste SON toucher ». La photo du ticket et l'import d'un tableur
// existaient (11 nov., 10 nov.) ; un ticket de trois paires n'était lu qu'en UN achat au total.
// La règle, prudente (§2.5 « il saisit les prix d'achat lui-même ») :
//   · une LIGNE d'article = un libellé (des lettres) suivi d'UN montant en fin de ligne (« NIKE AIR 25,00 € ») ; les
//     lignes de total, TVA, paiement, rendu, remise, quantité (« 2 x 5,00 ») ne sont jamais des articles ;
//   · le lot n'est PROPOSÉ que si la somme des lignes lues est EXACTEMENT le total lu (au centime) et, quand le ticket
//     écrit son nombre d'articles, que ce nombre est le même : sinon rien (« mieux vaut un blanc qu'un faux ») ;
//   · 2 à LOT_MAX lignes. Rien n'est écrit : « Diviser en N articles » remplit le formulaire de lot (mode « à la main »,
//     un montant par article, marqué « lu sur le ticket — vérifie ») ; c'est SON « Ajouter le lot » qui enregistre ;
//   · aucune ligne n'est reliée à une paire : relier reste son toucher (identité, §5).
const PAS_ARTICLE = /total|sous[\s-]?tot|\btva\b|\bht\b|\bttc\b|\bcb\b|carte|esp[eè]ces|rendu|monnaie|remise|r[eé]duc|r[eé]glement|paiement|pay[eé]|avoir|fid[eé]lit|net\s+[aà]|[aà]\s+payer|montant|solde|change|acompte|frais\s+de\s+port|livraison|cash|ch[eè]que|virement|merci/i;
const MONTANT_FIN = /^(.*?)\s+(-?\d{1,4}(?:[\s.]\d{3})*[,.]\d{2})\s*(?:€|eur|euros?)?\s*[a-z*]?\s*$/i;
const QUANTITE = /^\d+\s*[x×*]\s|\b\d+\s*[x×*]\s*\d|\bqt[eé]\b|\bquantit/i;
export function lignesDuTicket(texte) {
  const out = [];
  for (const brute of String(texte == null ? '' : texte).split(/\r?\n/)) {
    const l = brute.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    const m = MONTANT_FIN.exec(l);
    if (!m) continue;
    const libelle = m[1].replace(/[^\p{L}\p{N}&'’ ./-]/gu, ' ').replace(/\s+/g, ' ').trim();
    // Une ligne de QUANTITÉ (« 2 x Lacets 3,00 ») : combien d'articles ? pas su ⇒ le ticket entier n'est pas proposé en lot.
    if (QUANTITE.test(l)) { out.push({ quantite: true, libelle: '', centimes: Math.round(Number(m[2].replace(/[\s.](?=\d{3}\b)/g, '').replace(',', '.')) * 100) || 0 }); continue; }
    if ((libelle.match(/\p{L}/gu) || []).length < 3 || PAS_ARTICLE.test(libelle)) continue;
    const c = Math.round(Number(m[2].replace(/[\s.](?=\d{3}\b)/g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(c) || c <= 0) continue;
    out.push({ libelle: libelle.slice(0, 60), centimes: c });
  }
  return out;
}
// `max` : le plafond d'un lot (LOT_MAX de src/grosLot.js, 60 — passé par l'appelant ; ce module reste sans import, l'audit
// achat-ticket le copie seul ; audit-achats-hors-vinted vérifie que le défaut est bien LOT_MAX).
export const LOT_MAX_TICKET = 60;
export function lotDuTicket(lu, lignes, max = LOT_MAX_TICKET) {
  const L = Array.isArray(lignes) ? lignes : [];
  if (L.some((x) => x && x.quantite)) return null;
  if (L.length < 2 || L.length > max || !lu || !Number.isInteger(lu.montant)) return null;
  const somme = L.reduce((t, x) => t + x.centimes, 0);
  if (somme !== lu.montant) return null;
  if (Number.isInteger(lu.articles) && lu.articles !== L.length) return null;
  return { n: L.length, total: somme, articles: L.map((x) => ({ titre: x.libelle, centimes: x.centimes })) };
}
// Le lot du formulaire (src/GrosLot.jsx : { n, frais, mode, articles, ranger }) rempli par la proposition : mode « à la
// main », un montant par article (`main`, en texte « 25,00 »), le titre lu ; ce qu'il avait déjà tapé est GARDÉ.
export function lotFormulaireDuTicket(lot0, prop, enMontant = (c) => String(c)) {
  if (!prop) return lot0;
  const base = lot0 && typeof lot0 === 'object' ? lot0 : { n: '', frais: '', mode: 'egal', articles: [], ranger: true };
  const avant = Array.isArray(base.articles) ? base.articles : [];
  const articles = prop.articles.map((a, i) => {
    const x = avant[i] || { titre: '', taille: '', visee: '', main: '', photo: null, numero: '' };
    return { ...x, titre: String(x.titre || '').trim() ? x.titre : a.titre, main: String(x.main || '').trim() ? x.main : enMontant(a.centimes), duTicket: true };
  });
  return { ...base, n: String(prop.n), mode: 'main', articles, duTicket: true };
}

// Le champ porte-t-il encore la valeur LUE (il ne l'a pas retouchée) ?
export const champEncoreLu = (form, k) => !!(form && form.ticket && form.ticket.champs && form.ticket.champs[k] != null && String(form[k] || '') === String(form.ticket.champs[k]));
// Le prix proposé attend SA validation : le bouton le dit.
export const prixEncoreLu = (form) => champEncoreLu(form, 'price');

// Pourquoi rien n'a été lu — une phrase, et ce qu'il fait.
export const RAISON_TICKET = {
  'hors-ligne': 'Pas de connexion : lecture impossible. Tape le prix.',
  chargement: 'Lecteur de ticket pas chargé. Tape le prix.',
  delai: 'Lecture trop longue. Tape le prix.',
  erreur: 'Ce navigateur ne lit pas le ticket. Tape le prix.',
  image: 'Photo illisible. Essaie une autre photo.',
};

// La ligne sous le bouton : ce qui a été LU, en court.
export function resumeTicket(t, { dateCourte = (x) => x, euros = (c) => String(c) } = {}) {
  if (!t) return '';
  if (t.etat === 'lecture') return 'Lecture du ticket…';
  if (t.etat === 'impossible') return RAISON_TICKET[t.raison] || RAISON_TICKET.erreur;
  if (t.etat === 'rien') return 'Rien de lisible sur ce ticket. Tape le prix.';
  const bouts = [t.montant != null ? euros(t.montant) : '', t.date ? dateCourte(t.date) : '', t.lieu || ''].filter(Boolean);
  return `Lu : ${bouts.join(' · ')}`;
}
