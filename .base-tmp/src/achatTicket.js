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
export function ticketVersBrouillon(d, { lu = {}, raison = null, fichier = null, aujourdhui = '', enMontant = (c) => String(c) } = {}) {
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
  };
  return n;
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
