// ════════════════════════════════════════════════════════════════════════════
//  LE RÉCAPITULATIF D'UNE VENTE (1er nov., Julien : « je n'aime pas trop le
//  récapitulatif de la vente », puis devant les maquettes : « applique tout, je
//  veux que ce soit clair » — option A, « fiche en lignes nettes »).
//
//  Ce module ne porte que des RÈGLES, sans React ni DOM : la frise
//  Vendue → Bordereau → Déposée → Livrée → Argent reçu, et la phrase d'état.
//  L'écran (App.jsx, tiroir de Ventes) lui passe des PREUVES qu'il lit déjà
//  ailleurs — aucune règle neuve :
//    · bordereau  — un PDF relié à la vente par son n° de TRANSACTION (email ou
//                   capté par l'extension, `bordParTx` / `labelsCaptes`) ;
//    · deposee    — « Colis fait » coché (`vinted_ship_done`, le geste
//                   `marquerPoste`) OU un statut Vinted qui dit que le colis a
//                   bougé (déposé, en transit, au relais, livré, finalisé) ;
//    · livree     — un statut « livré / remis / réceptionné » ou « finalisée » ;
//    · argent     — la commande FINALISÉE (450, ou le texte / champ machine) :
//                   c'est le versement sur le porte-monnaie (la date de
//                   versement de la compta, `fetchVersementsVinted`).
//
//  ⚠️ UNE ÉTAPE NON SUE N'EST PAS COCHÉE. Une étape est faite si SA preuve est
//  lue (`preuve: 'lue'`) ou si une étape PLUS LOIN l'est (`'deduite'` : un colis
//  livré a forcément été déposé). Sans preuve, elle reste « à venir » — jamais
//  devinée d'une date, d'un délai ou d'une absence. La date n'est écrite que si
//  elle est LUE (jamais « estimée » ici).
//
//  ⚠️ LA FRISE REMPLACE LA PASTILLE DE STATUT dans ce récapitulatif (une barre
//  de progression avait été retirée le 28 sept. parce qu'elle redisait la
//  pastille) : l'écran montre l'une OU l'autre, jamais les deux.
// ════════════════════════════════════════════════════════════════════════════

export const ETAPES_VENTE = [
  ['vendue', 'Vendue'],
  ['bordereau', 'Bordereau'],
  ['deposee', 'Déposée'],
  ['livree', 'Livrée'],
  ['argent', 'Argent reçu'],
];

// Les états qui sortent du parcours normal : pas de frise, la phrase dit l'état.
export const ETATS_HORS_PARCOURS = ['Annulée', 'Remboursée', 'Retournée', 'Retour en cours', 'Suspendue'];

const ms = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 1e11 ? v : null;   // un drapeau « 1 » n'est pas une date
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};

// preuves : { vendue, bordereau, deposee, livree, argent } — chacune
// `{ lu: bool, t: date|ms|null }` (ou absente = pas de preuve).
// Rend 5 étapes { cle, label, fait, preuve: 'lue'|'deduite'|null, t: ms|null,
// ici: bool } — `ici` marque la DERNIÈRE étape faite (où en est la vente).
export function friseVente(preuves = {}) {
  const lues = ETAPES_VENTE.map(([cle]) => !!(preuves[cle] && preuves[cle].lu === true));
  const derniereLue = lues.lastIndexOf(true);
  const etapes = ETAPES_VENTE.map(([cle, label], i) => {
    const p = preuves[cle] || null;
    const lue = lues[i];
    const fait = lue || i < derniereLue;
    return { cle, label, fait, preuve: lue ? 'lue' : (fait ? 'deduite' : null), t: lue ? ms(p && p.t) : null, ici: false };
  });
  if (derniereLue >= 0) etapes[derniereLue].ici = true;
  return etapes;
}

// La phrase d'état, en clair : { gras, suite }. `etat` = l'étiquette de la vente
// (`etapeVente(o).label`, la même règle que la liste), `aide` son explication.
// Elle ne redit AUCUNE date (la frise les porte : un nombre une seule fois, §7).
export function phraseVente({ etat = '', aide = '', etapes = [], aExpedier = false, posteMain = false } = {}) {
  if (ETATS_HORS_PARCOURS.includes(etat)) return { gras: `${etat}.`, suite: aide || '' };
  const ici = etapes.find((e) => e.ici);
  const cle = ici ? ici.cle : null;
  if (cle === 'argent') return { gras: 'Terminée.', suite: "L'acheteur a confirmé : l'argent est versé sur ton porte-monnaie Vinted." };
  if (cle === 'livree') return { gras: 'Livrée.', suite: "L'argent arrive quand l'acheteur confirme que tout va bien." };
  if (etat === 'Au relais') return { gras: 'Au point relais.', suite: "L'acheteur doit aller la retirer." };
  if (cle === 'deposee') return posteMain && etat === 'Posté'
    ? { gras: 'Déposée.', suite: "Vinted confirmera l'envoi au premier passage chez le transporteur." }
    : { gras: 'En route.', suite: 'Le colis est chez le transporteur.' };
  if (cle === 'bordereau') return aExpedier
    ? { gras: 'Bordereau prêt.', suite: 'Imprime-le et dépose le colis.' }
    : { gras: `${etat || 'En cours'}.`, suite: '' };
  if (aExpedier) return { gras: 'À expédier.', suite: 'Génère le bordereau, puis dépose le colis.' };
  return { gras: `${etat || 'En cours'}.`, suite: '' };
}

// « 79,00 € », « −1,95 € » — deux décimales, pour des colonnes alignées.
export const eurosRecap = (v) => {
  if (v == null || !Number.isFinite(Number(v))) return '';
  const n = Math.round(Number(v) * 100) / 100;
  const abs = Math.abs(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return `${n < 0 ? '\u2212' : ''}${abs}\u00a0€`;
};
