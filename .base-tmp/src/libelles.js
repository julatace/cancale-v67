// ═══════════════════════════════════════════════════════════════════════════
// LES MOTS DE L'APP — une constante par notion (5 nov., revue de cohérence 1.2)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « on dirait tu fais des trucs incohérents au possible ». Mesuré le
// 5 nov. : « à poster », « à expédier » et « à envoyer » pour le même colis ;
// « En transit » et « En route » ; « Reçu » pour un colis ET pour de l'argent ;
// « Régime fiscal » ici, « Statut » là. Une notion = UN mot, écrit ICI.
// Vocabulaire retenu : docs/passation/2026-11-05-revue-coherence.md. Julien
// peut changer un mot : on le change ICI, et tous les écrans qui l'importent suivent.
//
// Règles d'écriture :
//   · un mot d'écran est en français courant, jamais un nom de champ ;
//   · « Reçu » est réservé à l'ARGENT (un colis arrivé est « Arrivé ») ;
//   · « Bénéfice » ne porte jamais « brut » dans un titre ;
//   · un verbe d'action est à l'infinitif ; un « … » final est U+2026, jamais « ... » ;
//   · aucune majuscule au milieu d'un libellé (« Comptes liés », pas « Comptes Liés »).
// `titre` : le mot d'un titre, d'un onglet ou d'un bouton (majuscule initiale) ;
// `bas` : le même mot DANS une phrase (« 3 colis à envoyer ») ;
// `ecartes` : les mots qu'un écran ne doit plus écrire pour cette notion.
// Exécuté par scripts/audit-composants.cjs.
// ═══════════════════════════════════════════════════════════════════════════

// ── Les notions ──────────────────────────────────────────────────────────────
export const NOTIONS = Object.freeze({
  // Les colis, dans l'ordre de leur vie.
  aEnvoyer:    Object.freeze({ titre: 'À envoyer', bas: 'à envoyer', ecartes: ['à poster', 'à expédier'] }),
  envoyes:     Object.freeze({ titre: 'Envoyés',   bas: 'envoyés',   un: 'Envoyé', ecartes: ['expédiés'] }),
  enRoute:     Object.freeze({ titre: 'En route',  bas: 'en route',  ecartes: ['en transit'] }),
  arrives:     Object.freeze({ titre: 'Arrivés',   bas: 'arrivés',   un: 'Arrivé', ecartes: ['reçus'] }),
  aRetirer:    Object.freeze({ titre: 'À retirer', bas: 'à retirer', ecartes: [] }),
  // L'argent (« Reçu » n'appartient qu'à lui ; jamais « encaissé », §5).
  recu:        Object.freeze({ titre: 'Reçu',      bas: 'reçu',      ecartes: ['encaissé'] }),
  vendu:       Object.freeze({ titre: 'Vendu',     bas: 'vendu',     ecartes: [] }),
  benefice:    Object.freeze({ titre: 'Bénéfice',  bas: 'bénéfice',  ecartes: ['bénéfice brut'] }),
  compta:      Object.freeze({ titre: 'Compta',    bas: 'compta',    ecartes: [] }),
  // (10 nov.) Statistiques et Compta réunies en UN endroit (src/argent.js).
  argent:      Object.freeze({ titre: 'Argent',    bas: 'argent',    ecartes: [] }),
  statut:      Object.freeze({ titre: 'Statut',    bas: 'statut',    ecartes: ['régime fiscal'] }),
  // Les écrans et les réglages.
  favoris:     Object.freeze({ titre: 'Favoris',   bas: 'favoris',   ecartes: ['likes'] }),
  comptesLies: Object.freeze({ titre: 'Comptes liés', bas: 'comptes liés', ecartes: ['comptes connectés'] }),
  emails:      Object.freeze({ titre: 'E-mails',   bas: 'e-mails',   ecartes: ['emails'] }),
  relierBoite: Object.freeze({ titre: 'Relier ma boîte', bas: 'relier ma boîte', ecartes: [] }),
});

// Le mot d'un titre ou d'un bouton : `L.aEnvoyer` ⇒ « À envoyer ».
export const L = Object.freeze(Object.fromEntries(Object.entries(NOTIONS).map(([k, v]) => [k, v.titre])));
// Le même mot DANS une phrase : `Lbas.aEnvoyer` ⇒ « à envoyer ».
export const Lbas = Object.freeze(Object.fromEntries(Object.entries(NOTIONS).map(([k, v]) => [k, v.bas])));

// ── Les verbes d'action communs ─────────────────────────────────────────────
// Un geste = un verbe, le même sur tous les écrans (« Voir », pas « Ouvrir »
// ici et « Afficher » là).
export const VERBES = Object.freeze({
  voir: 'Voir',
  toutVoir: 'Tout voir',
  ouvrirSur: (site) => `Ouvrir sur ${site}`,
  imprimer: 'Imprimer',
  toutImprimer: 'Tout imprimer',
  reessayer: 'Réessayer',
  relire: 'Relire',
  modifier: 'Modifier',
  enregistrer: 'Enregistrer',
  annuler: 'Annuler',
  fermer: 'Fermer',
  supprimer: 'Supprimer',
  confirmer: 'Confirmer',
  ajouter: 'Ajouter',          // « + Ajouter » partout (plus « + Créer »)
  completer: 'Compléter',
  copier: 'Copier',
  copie: 'Copié',
  effacer: 'Effacer',
  rechercher: 'Rechercher',
  dicter: 'Dicter',
  relier: 'Relier',
  delier: 'Délier',
  continuer: 'Continuer',
  enGrand: 'En grand',
  plus: 'Plus d’actions',      // le nom (lu) du bouton « … » d'une carte
});

// ── Les mots de l'état « pas su » (§5) ──────────────────────────────────────
// « Pas su » ne vaut pas « oui », « rien lu » ne vaut pas « rien » : un chiffre
// qu'on ne connaît pas s'écrit « — » avec la raison, jamais « 0,00 € ».
export const PAS_SU = Object.freeze({
  vide: '—',
  phrase: (quoi) => `${quoi} : pas su pour l’instant.`,
  sansRaison: 'La lecture n’a pas répondu.',
  enCours: 'Lecture en cours…',
});

// ── Les mots ÉCARTÉS ────────────────────────────────────────────────────────
export const MOTS_ECARTES = Object.freeze(Object.values(NOTIONS).flatMap((n) => n.ecartes));

// Un texte d'écran emploie-t-il un mot écarté ? Rend la liste des mots trouvés
// (vide si le texte est propre). Sans accent ni casse ; mot entier seulement
// (« reçus » n'attrape pas « reçu »).
const plier = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").toLowerCase();
export function motsEcartesDans(texte) {
  const t = ' ' + plier(texte).replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  return MOTS_ECARTES.filter((m) => t.includes(' ' + plier(m) + ' '));
}
