// ── ARGENT : UN SEUL ENDROIT POUR L'ARGENT (10 nov.) ─────────────────────────
// Julien, 9 nov. : « L'onglet Compta est trop flou, tu peux peut-être le relier
// avec Stats. » Et son retour le plus récent : pas de murs de texte, du visuel.
//
// Statistiques et Comptabilité deviennent UN endroit, « Argent », à quatre
// segments. Les deux écrans d'avant restent les mêmes composants (mêmes
// lectures, mêmes publications, mêmes gestes) : seul leur rangement change.
//   · Résumé       — `compta` (sa vue « resume ») : les 4 réponses, l'anneau,
//                    les six mois, puis le détail replié (bénéfice, vendu et
//                    reçu, bilan, délai, porte-monnaie, dépenses, packs) ;
//   · Statistiques — `dashboard` (l'écran d'avant, entier ; « Prix qui marche »
//                    reste sa rubrique) ;
//   · Déclarer     — `compta` (vue « declarer ») : URSSAF, statut, DAC7, et ce
//                    qui part chez le comptable (export, registres, récap) ;
//   · Factures     — `compta` (vue « factures ») : Factures, facturation électronique.
// Les anciens chemins (`?tab=compta`, `?tab=dashboard`, `?tab=invoices`,
// `?tab=prixmarche`, `?tab=stats`) mènent ICI (src/App.jsx, `ONGLETS_DEPLACES`).
//
// JS pur, sans React : scripts/audit-argent.cjs l'exécute.

export const SEGMENTS_ARGENT = Object.freeze([
  Object.freeze({ id: 'resume', l: 'Résumé', tab: 'compta', sub: 'compta' }),
  Object.freeze({ id: 'stats', l: 'Statistiques', tab: 'dashboard', sub: 'stats' }),
  Object.freeze({ id: 'declarer', l: 'Déclarer', tab: 'compta', sub: 'declarer' }),
  Object.freeze({ id: 'factures', l: 'Factures', tab: 'compta', sub: 'factures' }),
]);
export const IDS_SEGMENTS = SEGMENTS_ARGENT.map((s) => s.id);

// La vue de l'écran `compta` pour une section (`platSub`) : une section inconnue
// (« ventes », le défaut de la coque, ou rien) ⇒ le Résumé.
export const vueCompta = (sub) => (sub === 'declarer' ? 'declarer' : sub === 'factures' ? 'factures' : 'resume');
// Le segment allumé pour un écran et sa section ; `null` hors d'Argent.
export const segmentArgent = (tab, sub) => (tab === 'dashboard' ? 'stats' : tab === 'compta' ? vueCompta(sub) : null);
// Où mène un segment : [onglet, section].
export const cheminSegment = (id) => { const s = SEGMENTS_ARGENT.find((x) => x.id === id); return s ? [s.tab, s.sub] : ['compta', 'compta']; };

// Les noms d'hier ⇒ leur place dans Argent ([onglet, section]). `compta` et
// `dashboard` restent des écrans (leur nom sert de lien) : ils ne sont pas ici.
export const CHEMINS_ARGENT = Object.freeze({
  argent: ['compta', 'compta'],
  stats: ['dashboard', 'stats'],
  statistiques: ['dashboard', 'stats'],
  argent_declarer: ['compta', 'declarer'],
});

// Le nom qu'un segment passe à `setTab` (la coque le résout par `ONGLETS_DEPLACES`).
export const ONGLET_SEGMENT = Object.freeze({ resume: 'argent', stats: 'stats', declarer: 'argent_declarer', factures: 'invoices' });

// ── LES QUATRE RÉPONSES EN TÊTE ──────────────────────────────────────────────
// « Combien j'ai vendu ce mois ? », « Combien j'ai reçu ? », « Mon bénéfice ? »,
// « Combien je dois déclarer, et quand ? ». AUCUN chiffre n'est calculé ici :
//   · vendu, reçu, bénéfice = `valeurChiffre` (src/design/carteChiffres.js), les
//     MÊMES valeurs que la carte de Ma journée et de Compta (mois en cours) ;
//   · à déclarer = `previsionUrssaf` (src/previsionUrssaf.js), la carte
//     « Prochaine déclaration » : le chiffre d'affaires de la période, sa date ;
//   · ce que le statut permet = `profilFiscal` (src/profilFiscal.js) : rien
//     d'URSSAF pour un particulier ou une société ; statut pas choisi ⇒ le dire.
// Trois états (§5) : `valeur` nombre ; `null` + `raison` (pas su, dit) ; `texte`
// quand la réponse n'est pas un montant (« Rien », « Export »). Jamais « au
// moins 0 » ; jamais « encaissé ».
// Entrées : { vendu, recu, benefice } (résultats de `valeurChiffre`), `prevision`
// (résultat de `previsionUrssaf`), `profil` (résultat de `profilFiscal`),
// `raisonCourte` (la règle des cases, carteChiffres.js), `mois` (« novembre »),
// `dateCourte` (ms → « 30 nov. »).
const pluriel = (n, un, plusieurs) => (n > 1 ? plusieurs : un);
export function questionsArgent({ vendu, recu, benefice, prevision, profil, raisonCourte, mois = '', dateCourte = (t) => String(t) }) {
  const rc = typeof raisonCourte === 'function' ? raisonCourte : () => '';
  const chiffre = (x) => {
    if (!x) return { valeur: null, partiel: false, note: 'pas lu', raison: 'pasSu' };
    if (x.valeur == null) return { valeur: null, partiel: false, note: rc(x) || 'pas lu', raison: x.raison || 'pasSu' };
    const note = x.aDater > 0 ? rc(x) : x.partiel && x.manque && x.manque.length ? `sans ${x.manque[0]}` : '';
    return { valeur: x.valeur, partiel: !!x.partiel, note, raison: '' };
  };
  const Q = [
    { id: 'vendu', libelle: `Vendu en ${mois}`, question: 'Combien j’ai vendu ce mois ?', aller: 'stats', ...chiffre(vendu) },
    { id: 'recu', libelle: `Reçu en ${mois}`, question: 'Combien j’ai reçu ?', aller: 'compta-ca', ...chiffre(recu) },
    { id: 'benefice', libelle: `Bénéfice en ${mois}`, question: 'Mon bénéfice ?', aller: 'compta-benefice', ...chiffre(benefice) },
  ];
  Q.push({ id: 'declarer', libelle: 'À déclarer', question: 'Combien je dois déclarer, et quand ?', aller: 'declarer', ...declarerDe(prevision, profil, dateCourte) });
  return Q;
}

// La réponse « À déclarer », selon le statut (une règle : `profilFiscal`).
export function declarerDe(P, profil, dateCourte = (t) => String(t)) {
  const etat = profil && profil.etat;
  const vide = (note, raison, texte = null) => ({ valeur: null, partiel: false, note, raison, texte });
  if (!profil || etat === 'encours') return vide('lecture…', 'encours');
  if (etat === 'aChoisir' || etat === 'inconnu') return vide('choisis ton statut', 'statut');
  if (etat === 'particulier') return vide('particulier : pas d’URSSAF', 'particulier', 'Rien');
  if (etat === 'societe' || etat === 'marge') return vide('pour ton comptable', 'societe', 'Export');
  // Micro-entrepreneur : la prochaine déclaration.
  if (!P || P.etat === 'encours') return vide('lecture…', 'encours');
  if (P.etat === 'rythme') return vide('choisis ton rythme', 'rythme');
  if (P.etat === 'aucune') return vide('aucune échéance', 'aucune');
  if (P.etat === 'statut') return vide('choisis ton statut', 'statut');
  if (P.etat === 'horsMicro') return vide('pas d’URSSAF', 'horsMicro');
  const quand = P.dueDate ? `avant le ${dateCourte(P.dueDate)}` : '';
  const aDater = P.aDater > 0 ? `${P.aDater} ${pluriel(P.aDater, 'vente', 'ventes')} à dater` : '';
  if (P.etat !== 'lu' || P.ca == null) return { ...vide([quand, 'ouvre Ventes'].filter(Boolean).join(' · '), 'passu'), echeance: P.dueDate || null };
  // « Au moins 0 » ne se dit jamais (§5).
  if (P.partiel && !(P.ca > 0)) return { ...vide([quand, aDater || 'pas tout lu'].filter(Boolean).join(' · '), 'partiel'), echeance: P.dueDate || null };
  return { valeur: P.ca, partiel: !!P.partiel, note: [quand, aDater].filter(Boolean).join(' · '), raison: '', texte: null, echeance: P.dueDate || null, periode: P.label || '' };
}
