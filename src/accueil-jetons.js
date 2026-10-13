// ── LES JETONS VISUELS DE LA PAGE D'ACCUEIL (famille « VRM Noir », §7) ───────
// Un seul objet pour la page, la carte « Aujourd'hui », les écrans dessinés et
// le film. Il vit dans son propre fichier pour que ces modules ne s'importent
// pas les uns les autres en cercle.
//
// ⚠️ UNE SEULE COULEUR D'ACCENT, ET ELLE EST RARE. Dans le cadre de la page :
//    le fond du bouton principal (`cta`) et l'anneau de focus — rien d'autre.
//    L'ambre (`warn`) et les points de plateforme ne vivent QUE dans les
//    écrans dessinés et le film.
// ⚠️ `faint` vaut #8A93A3 (6,4:1 sur le fond) : l'ancien #687284 échouait à
//    4,11:1. `cta` vaut #2458E6 : le blanc dessus tient 5,8:1 (sur #3D7BFF, le
//    bouton d'avant, 3,84:1 — sous le seuil AA).
export const K = {
  bg: '#07090D',
  surface: '#0B0E13',
  card: '#10141B',
  card2: '#151A23',
  line: 'rgba(255,255,255,0.08)',
  line2: 'rgba(255,255,255,0.13)',
  text: '#EEF1F6',
  muted: '#9AA3B2',
  faint: '#8A93A3',
  cta: '#2458E6',
  accent: '#3D7BFF',
  accentSoft: 'rgba(61,123,255,0.14)',
  warn: '#FFB23E',
  paper: '#F4F6FA',
  ink: '#111620',
};

// Les deux courbes, en CSS (les mêmes que `sortie` et `trajet` du moteur).
export const COURBE_SORTIE = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const COURBE_TRAJET = 'cubic-bezier(0.77, 0, 0.175, 1)';

// Ombres à deux couches (contact serré + diffusion large et pâle).
export const OMBRE_CARTE = '0 1px 2px rgba(0,0,0,.5), 0 24px 60px rgba(0,0,0,.45)';
export const REFLET = 'inset 0 1px 0 rgba(255,255,255,.06)';

// La hauteur FINALE de chaque écran dessiné, [ordinateur, compact (< 560 px)].
// La page réserve cette boîte AVANT que le morceau des scènes arrive : rien ne
// saute pendant le chargement. Les scènes s'y tiennent exactement — mesuré au
// rendu (bas du dernier élément visible, à 1512 et 390 px) : 428/382 pour Colis,
// 200/344 pour « vendu ailleurs », 315/339 pour le mois. Réserver plus, c'est du
// vide sous l'écran ; réserver moins, c'est un écran qui déborde sur la suite.
export const HAUTEURS_SCENES = {
  colis: [432, 386],
  ailleurs: [200, 344],
  urssaf: [320, 344],
  premier: [132, 108],
};
// Sous cette largeur de conteneur, un écran passe en variante compacte.
export const LARGEUR_COMPACTE = 560;
