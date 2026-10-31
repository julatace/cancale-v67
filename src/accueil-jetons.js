// ── LES JETONS VISUELS DE LA PAGE D'ACCUEIL (famille « VRM Noir », §7) ───────
// Un seul objet pour la page, la carte « Aujourd'hui », les écrans dessinés et
// le film. Il vit dans son propre fichier pour que ces modules ne s'importent
// pas les uns les autres en cercle.
//
// ⚠️ UNE SEULE COULEUR D'ACCENT, ET ELLE EST RARE. Dans le cadre de la page :
//    le fond du bouton principal (`cta`) et l'anneau de focus — rien d'autre.
//    L'ambre (`warn`) et les points de plateforme ne vivent QUE dans les
//    écrans dessinés et le film.
// (31 oct.) VITRINE, le choix de Julien pour l'app (src/themeMineral.js) : la
// page publique prend les mêmes jetons — blanc franc, encre, une seule couleur
// d'accent (le cobalt, sur le bouton principal), plus de pétrole ni d'ardoise.
export const K = {
  bg: '#FFFFFF',           // fond blanc franc
  surface: '#F5F5F3',
  card: '#FFFFFF',
  card2: '#F5F5F3',        // puce / zone intérieure
  line: 'rgba(15,15,14,0.09)',
  line2: 'rgba(15,15,14,0.15)',
  text: '#0F0F0E',         // encre (19:1 sur le blanc)
  muted: '#56564F',        // 7:1
  faint: '#56564F',        // jamais sous AA
  cta: '#2442B8',          // cobalt : le bouton principal, texte blanc (8,6:1)
  accent: '#2442B8',
  accentSoft: 'rgba(36,66,184,0.10)',
  warn: '#8A5300',         // ambre lisible sur clair (texte)
  warnDot: '#F0B44C',      // la pastille ambre (décor, pas du texte)
  paper: '#FFFFFF',
  ink: '#0F0F0E',
  // ── L'encre des aplats sombres (le film) ──
  rail: '#0F0F0E',
  rail2: '#1A1A18',
  railText: '#F2F2EE',
  railMuted: '#B0B0A8',
  railLine: 'rgba(255,255,255,0.08)',
  railActive: '#252522',
};

// Les deux courbes, en CSS (les mêmes que `sortie` et `trajet` du moteur).
export const COURBE_SORTIE = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const COURBE_TRAJET = 'cubic-bezier(0.77, 0, 0.175, 1)';

// Ombres à deux couches sur fond clair (contact net + diffusion large et pâle,
// teintée encre/bleu — les cartes « décollent » sans noircir).
export const OMBRE_CARTE = '0 1px 2px rgba(15,15,14,.06), 0 18px 44px rgba(15,15,14,.10)';
export const REFLET = 'none';

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
