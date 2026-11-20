// ════════════════════════════════════════════════════════════════════════════
//  LES ANCIENS ÉCRANS DANS LE STYLE DU NATIF (19 nov., décision « VRM natif », docs/design/NATIF.md).
//  Un écran pas encore réécrit avec les composants de src/natif/ est au moins dans les couleurs, la typo, les rayons
//  et les fonds du natif : ses jetons d'hier (`--sb-*`, `--sv-*`, `--v2-*`, `--d-*`…) lisent `--n-*`.
//    · anciens-ecrans.css     — la couche `n-anciens` (la première nommée dans index.html) : le style unique ;
//    · anciens-composants.css — la disposition de quatre composants que seul l'habillage « VRM » du 18 nov. stylait ;
//    · minimaliste.css        — (20 nov., NATIF §1 bis) ce qui restait décoré : ombres de carte, filets, cartes empilées.
//  Importé UNE fois, par src/App.jsx, AVANT les feuilles du studio (studio.css reste la dernière : audit-studio S3).
//  À retirer quand le dernier écran est réécrit en natif.
// ════════════════════════════════════════════════════════════════════════════
import './anciens-ecrans.css';
import './anciens-composants.css';
import './minimaliste.css';   // (20 nov., NATIF §1 bis) « simple et minimaliste comme Paramètres » : ombres, filets, cartes empilées
