// ── LES JETONS VISUELS DE LA PAGE D'ACCUEIL (famille « VRM Noir », §7) ───────
// Un seul objet pour la page, la carte « Aujourd'hui », les écrans dessinés et
// le film. Il vit dans son propre fichier pour que ces modules ne s'importent
// pas les uns les autres en cercle.
//
// ⚠️ UNE SEULE COULEUR D'ACCENT, ET ELLE EST RARE. Dans le cadre de la page :
//    le fond du bouton principal (`cta`) et l'anneau de focus — rien d'autre.
//    L'ambre (`warn`) et les points de plateforme ne vivent QUE dans les
//    écrans dessinés et le film.
// Les textes secondaires et le bouton ardoise restent contrastés sur le fond minéral.
export const K = {
  bg: '#F2F5F3',           // fond clair (contenu de la maquette)
  surface: '#FFFFFF',
  card: '#FFFFFF',
  card2: '#EDF2EF',        // puce / zone intérieure
  line: 'rgba(18,27,44,0.09)',
  line2: 'rgba(18,27,44,0.15)',
  text: '#243D43',         // encre (15:1 sur le fond)
  muted: '#52636B',        // 6:1
  faint: '#52636B',        // 5:1 — jamais sous AA
  cta: '#2B4548',          // ardoise de marque, texte blanc contrasté
  accent: '#355F61',
  accentSoft: 'rgba(53,95,97,0.12)',
  warn: '#B45309',         // ambre lisible sur clair (texte)
  warnDot: '#F59E0B',      // la pastille ambre (décor, pas du texte)
  paper: '#FFFFFF',
  ink: '#243D43',
  // ── Ardoise du rail et du héros ──
  rail: '#21343E',
  rail2: '#192C34',
  railText: '#F0F5F2',
  railMuted: '#B0C5BC',
  railLine: 'rgba(255,255,255,0.08)',
  railActive: '#2C4548',
};

// Les deux courbes, en CSS (les mêmes que `sortie` et `trajet` du moteur).
export const COURBE_SORTIE = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const COURBE_TRAJET = 'cubic-bezier(0.77, 0, 0.175, 1)';

// Ombres à deux couches sur fond clair (contact net + diffusion large et pâle,
// teintée encre/bleu — les cartes « décollent » sans noircir).
export const OMBRE_CARTE = '0 1px 2px rgba(18,27,44,.06), 0 18px 44px rgba(18,27,44,.10)';
export const REFLET = 'inset 0 1px 0 rgba(255,255,255,.6)';

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
