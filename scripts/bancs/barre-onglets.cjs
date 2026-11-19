// ════════════════════════════════════════════════════════════════════════════
//  LA BARRE D'ONGLETS — ses cinq styles (17 nov. soir) : RETIRÉ le 19 nov.
//  Décision de Julien du 19 nov. (« VRM natif », docs/design/NATIF.md §2 ; « la mise en page est catastrophique, revois
//  absolument tout ») : la barre « Studio » et ses cinq styles C/A/B/D/E (src/designV2/barre.*) ne sont plus rendus.
//  La barre est la barre NATIVE (`src/natif/BarreOnglets.jsx`) : 5 onglets de même largeur, icône + libellé, l'actif à
//  l'accent. Ce que ce banc protégeait (onglet allumé = écran, cibles 44, rien de coupé, rien sous la barre, contraste,
//  un nom par onglet) est jugé par `natif-coque.cjs` (K1, K2, K5), qui tourne ici à sa place. L'ancien banc : git log.
// ════════════════════════════════════════════════════════════════════════════
console.log('barre-onglets : la barre « Studio » est retirée (19 nov.) — natif-coque.cjs juge la barre native.');
require('./natif-coque.cjs');
