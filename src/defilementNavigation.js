// ════════════════════════════════════════════════════════════════════════════
//  OÙ S'OUVRE UN ÉCRAN : EN HAUT, OU À SA PLACE (17 nov., chasse-bugs)
//  Julien (iPhone, Argent) : « Quand j'ai déclaré par exemple, ça me met en plein milieu de la page,
//  j'ai pas tout en haut ». Mesuré : `MemoireDefilement` rendait à CHAQUE écran la position gardée de sa
//  dernière visite, quelle que soit la façon d'y arriver (un geste « J'ai déclaré », une carte de Ma
//  journée, un retour), et ne remettait JAMAIS la zone à 0 (la même `.vrm-main` gardait le défilement de
//  l'écran d'avant) ; les segments d'Argent (Résumé · Statistiques · Déclarer · Factures) partageaient une
//  seule clé : changer de segment gardait le défilement du segment d'avant.
//  LA RÈGLE (une seule, partagée — le chantier vitesse-cache s'y branche) :
//   · une action qui change d'écran, de segment ou de sous-onglet ouvre la destination EN HAUT ;
//   · revenir sur un onglet de la barre (ou de la colonne) qu'on avait quitté garde SA position ;
//   · la première ouverture de l'app (reprise) garde la position rangée sur l'appareil ;
//   · toucher l'onglet déjà actif remonte en haut (geste d'iOS) — `remonterEnHaut` dans App.jsx.
//  Un lien « aller à cet élément » fait défiler jusqu'à lui lui-même (scrollIntoView) : la règle ne l'en
//  empêche pas, elle ne fait que choisir le point de départ.
// ════════════════════════════════════════════════════════════════════════════

const etat = { garderAt: 0 };
const VALIDITE_MS = 4000;

// La barre / la colonne : le prochain écran monté garde SA position (s'il en a une).
export function revenirSurOnglet(now = Date.now()) { etat.garderAt = now; }
// Lu une fois par l'écran qui s'ouvre (puis oublié) : vrai seulement juste après un toucher de la barre.
export function prendreRetourOnglet(now = Date.now()) {
  const g = etat.garderAt > 0 && now - etat.garderAt >= 0 && now - etat.garderAt < VALIDITE_MS;
  etat.garderAt = 0;
  return g;
}
// La position où ouvrir : la position gardée seulement pour une reprise ou un retour par la barre ; sinon 0.
export function positionAOuvrir({ premier = false, retourOnglet = false, memorisee = 0 } = {}) {
  const m = Number(memorisee);
  if (!(premier || retourOnglet) || !Number.isFinite(m) || m <= 0) return 0;
  return Math.min(1000000, Math.round(m));
}
// La clé d'un écran pour la mémoire du défilement : l'onglet ET son segment quand il en a (Argent, sites).
export function cleDefilement(tab, sub, avecSegment) {
  return `${tab}:${avecSegment ? (sub || '') : ''}`;
}
