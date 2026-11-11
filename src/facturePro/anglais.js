// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE EN ANGLAIS — une option PAR FACTURE (10 nov., lot T)
// ════════════════════════════════════════════════════════════════════════════
// Julien (proposition 29, validée) : « Facture en anglais quand l'acheteur est
// à l'étranger (mentions identiques, traduites une fois, sans IA) ».
//
// ── POURQUOI LA FACTURE RESTE BILINGUE (le français ne disparaît jamais) ────
// · Loi n° 94-665 du 4 août 1994 (« loi Toubon »), art. 2 : dans « les factures
//   et quittances, l'emploi de la langue française est obligatoire » — obligatoire
//   mais NON exclusif ; une traduction est permise, mais « la présentation en
//   langue française doit, dans ce cas, être aussi lisible et intelligible que
//   la présentation en langues étrangères » (réponse ministérielle,
//   questions.assemblee-nationale.fr, QE n° 2838, 15e législature). Texte de la
//   loi : legifrance.gouv.fr, JORFTEXT000000349929.
// · Côté impôts (entreprendre.service-public.gouv.fr, fiche F31411 « Facturation :
//   mentions obligatoires », relue par recherche le 10 nov. 2026 — le site n'était
//   pas joignable depuis le banc) : une facture PEUT être rédigée dans une langue
//   étrangère, mais « l'administration peut pour contrôle en exiger la
//   traduction certifiée par un traducteur juré ».
// ⇒ Le plus sûr pour un micro-entrepreneur : chaque libellé écrit « français /
//   English », À LA MÊME TAILLE, le français en premier. Les mentions légales
//   (art. 293 B, régime de la marge) restent mot pour mot en français, suivies
//   de leur traduction. Aucune traduction certifiée à payer, aucun contrôle à
//   craindre, et l'acheteur étranger lit sa facture.
//
// ── CE QUI NE CHANGE PAS ───────────────────────────────────────────────────
// · La devise : toujours l'EURO (CLAUDE.md §3 : VRM reste sur la France).
// · Le format des dates (jj/mm/aaaa), les montants, le numéro, la séquence.
// · Les textes libres du vendeur (désignation, note, mention de paiement) :
//   jamais traduits (ni IA, ni dictionnaire : on ne réécrit pas ses mots).
// · L'application elle-même reste en français (§3) : seule LA FACTURE choisie,
//   et son e-mail, parlent aussi anglais.
//
// Module PUR : l'aperçu (src/FacturePro.jsx), le PDF (./pdf.js) et le serveur
// (api/_lib/facture-pro.js, via ./regle.js) lisent la MÊME table (§11).

// Les libellés fixes de la facture, traduits une fois.
export const EN = {
  FACTURE: 'INVOICE',
  AVOIR: 'CREDIT NOTE',
  "Date d'émission": 'Issue date',
  'Émise le': 'Issued on',
  'Annule la facture': 'Cancels invoice',
  VENDEUR: 'SELLER',
  Vendeur: 'Seller',
  'FACTURÉ À': 'BILL TO',
  'Facturé à': 'Bill to',
  CLIENT: 'CUSTOMER',
  'Date de la vente': 'Date of sale',
  Nature: 'Type',
  'Livraison de biens': 'Supply of goods',
  'Référence': 'Reference',
  'Désignation': 'Description',
  'Qté': 'Qty',
  'Prix unit. HT': 'Unit price excl. VAT',
  'Prix unitaire': 'Unit price',
  'Total HT': 'Total excl. VAT',
  Total: 'Total',
  TVA: 'VAT',
  'non applicable': 'not applicable',
  'Total TTC': 'Total incl. VAT',
  'Total TTC à rembourser': 'Total incl. VAT to refund',
  'Net à payer': 'Amount due',
  'Total à payer': 'Amount due',
  'Montant à rembourser': 'Amount to refund',
};

// Les mentions légales : le texte français EXACT (./regle.js) → sa traduction.
// Marge : la formule de la directive 2006/112/CE, art. 226 point 14 (version
// anglaise) — « Margin scheme — Second-hand goods ».
export const MENTIONS_EN = {
  'TVA non applicable, art. 293 B du CGI': 'VAT not applicable, article 293 B of the French General Tax Code (CGI)',
  "Régime particulier – Biens d'occasion (art. 297 A du CGI)": 'Margin scheme – Second-hand goods (article 297 A of the French General Tax Code)',
};

export const LANGUES = ['fr', 'en'];
export const langueValide = (l) => (l === 'en' ? 'en' : 'fr');

// « français / English » — le français d'abord, la même taille (réponse QE 2838).
// Un libellé absent de la table reste en français seul (jamais un trou).
export const bi = (fr, anglais) => (anglais && EN[fr] ? `${fr} / ${EN[fr]}` : fr);

// La phrase de paiement en anglais (la date et la plateforme viennent de
// l'instantané ; la mention libre du vendeur n'est PAS traduite).
export const paiementEn = ({ type, venteJour, plateforme }) => (type === 'avoir'
  ? 'Amount refunded to the buyer.'
  : `Invoice paid on ${venteJour}${plateforme ? ` via ${plateforme}` : ''}.`);

// Ce que l'instantané garde de la traduction (il ne change plus jamais,
// comme le reste de la facture) : posé par `contenuFacture` quand la langue
// est 'en', absent sinon (les factures d'avant ne bougent pas).
export function traductionContenu({ mentions = [], venteJour = '', plateforme = '' } = {}) {
  return {
    v: 1,
    mentions: mentions.map((m) => MENTIONS_EN[m] || ''),
    paiement: paiementEn({ type: 'facture', venteJour, plateforme }),
    nature: EN['Livraison de biens'],
  };
}
// La phrase de paiement d'un instantané bilingue (un avoir reprend la facture
// et dit « remboursé »).
export const paiementAnglais = (c) => (!c || !c.anglais ? '' : c.type === 'avoir' ? paiementEn({ type: 'avoir' }) : String(c.anglais.paiement || ''));

// ── L'E-MAIL ────────────────────────────────────────────────────────────────
// Le message par défaut, anglais puis français (le vendeur qui a écrit SON
// message le garde tel quel : on ne le traduit pas).
export const MESSAGE_DEFAUT_EN = 'Hello {acheteur},\n\nPlease find attached invoice {numero} for your purchase "{article}".\n\nThank you for your trust,\n{boutique}';
// (11 nov., lot DJ1) L'ancien pied « This invoice is sent to you by VRM on behalf of … » est RETIRÉ
// (Julien : « je veux pas de ce message ») : l'e-mail ne porte que le texte du vendeur.

// Un indice, jamais une décision : l'adresse PROUVÉE de l'acheteur (remise en
// lignes par `adresseVintedLisible`, qui n'ajoute le pays que s'il n'est pas la
// France) se termine par un pays écrit en toutes lettres. Sert seulement à
// pré-cocher « Facture en anglais » : c'est SON clic qui émet la facture.
export function acheteurHorsFrance(adresse) {
  const l = String(adresse || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (l.length < 3) return false;
  const dern = l[l.length - 1];
  if (/\d/.test(dern) || /^france$/i.test(dern)) return false;
  return /\d/.test(l[l.length - 2]);
}
