// ════════════════════════════════════════════════════════════════════════════
//  LA COQUE DU STUDIO BLEU CLAIR (14 nov.) : RETIRÉ le 19 nov.
//  Décision de Julien du 19 nov. (« VRM natif », docs/design/NATIF.md §2) : la barre du bas en verre flottante, sa
//  pastille enfoncée, le disque « + » et son éventail (déjà retirés le 17 nov.), l'ondulation au changement d'espace, la
//  navigation de gauche en verre et l'île du haut ne sont plus rendus. La coque est la coque NATIVE (src/natif/) :
//  barre d'onglets native au téléphone, barre de titre (Messages + la photo ⇒ « Plus »), recherche avec le scanner dedans ;
//  barre latérale fixe à l'ordinateur. `natif-coque.cjs` juge tout cela (K1–K8) et tourne ici à sa place.
//  Le « un seul plein par écran rendu » reste mesuré par les bancs des écrans. L'ancien banc : git log.
// ════════════════════════════════════════════════════════════════════════════
console.log('studio-coque : la coque « Studio » est retirée (19 nov.) — natif-coque.cjs juge la coque native.');
require('./natif-coque.cjs');
