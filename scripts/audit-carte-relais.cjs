// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DE LA CARTE DES POINTS RELAIS   —   node scripts/audit-carte-relais.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « prends la carte des points relais dans les achats, je veux
// renseigner ma ville (ou qu'elle soit détectée) et que l'app fasse la suite ».
//
// MESURÉ SUR LA VRAIE BASE le 6 septembre, avant de coder :
//   • `vrm_ville` = « Cancale » — il l'avait DÉJÀ renseignée ;
//   • `vrm_ville_points` : ABSENT — la liste de la ville n'a jamais été chargée ;
//   • `/api/relais?city=Cancale` répond pourtant 5 points, en 200 ;
//   • `vrm_points_relais` : 4 points, dont « Juste Ici » à 48.6→43.3 / -1.8→5.4,
//     c'est-à-dire **Marseille**, listé comme un point relais de Cancale.
//
// LA CAUSE, mesurée au banc : chaque écran lit ses réglages au montage
// (`useState(() => load(...))`). Le nuage, lui, arrive ~500 ms plus tard. Sur le
// PREMIER écran ouvert, l'écran lit donc du vide et personne ne le réveille :
// zéro appel à /api/relais, champ ville vide. On change d'onglet, on revient
// (le composant remonte) — et là tout marche. C'est ce que Julien voyait : un
// écran qui se présente comme s'il n'avait jamais été réglé.
//
// Ce que ce fichier protège :
//   1. la racine PRÉVIENT les écrans quand le nuage a atterri ;
//   2. l'écran ne relit QUE ce qui est resté vide — écraser une saisie faite
//      pendant le chargement serait, pour les NUMÉROS, le pire défaut de l'app ;
//   3. la liste des points montre bien ceux de la VILLE, pas seulement les
//      enregistrés (le titre les comptait déjà) ;
//   4. ce que le filtre masque est dit (il cachait 4 des 5 points de Cancale) ;
//   5. un point manifestement hors de la ville est signalé — jamais supprimé
//      tout seul : c'est sa liste.
//
// ⚠️ Contrôle STATIQUE. Le rendu se vérifie au banc `carte.cjs`.
// Lecture seule.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// ── 1. LE RÉVEIL APRÈS L'ARRIVÉE DU NUAGE ──────────────────────────────────
// ⚠️ On réutilise `onCloudReady`, le mécanisme qui existait déjà pour les
// numéros — surtout PAS un second canal en parallèle.
const i = APP.indexOf("setVille(v => v || load('vrm_ville'");
const R = i < 0 ? '' : APP.slice(Math.max(0, i - 900), i + 900);
dit(i > 0, 'la ville est relue quand le nuage a atterri',
  'sans ça, le premier écran ouvert reste sur des réglages vides');
dit(/onCloudReady\(\(\) => \{/.test(R),
  'elle passe par `onCloudReady` — le mécanisme existant, pas un second');

// ── 2. ET ELLE N'ÉCRASE JAMAIS UNE SAISIE ──────────────────────────────────
dit(/const vide = /.test(R), 'la relecture ne remplace que ce qui est resté vide');
dit(/setVille\(v => v \|\| load/.test(R),
  'la ville saisie sur cet appareil gagne toujours');
dit(/vide\(p\) \? load\('vrm_points_relais'/.test(R),
  'ses points relais enregistrés aussi');

// ── 3. LA LISTE MONTRE LES POINTS DE LA VILLE ──────────────────────────────
dit(/g\.saved \|\| g\.ville \|\| g\.vinted/.test(APP),
  'la liste montre les points de la ville, pas seulement les enregistrés',
  'le titre disait « Points relais à Cancale (4) » en ne listant que ses 4 points à lui');

// ── 4. CE QUE LE FILTRE CACHE SE VOIT ──────────────────────────────────────
dit(/const masquesFiltre/.test(APP), 'ce que le filtre masque est compté');
dit(/masquesFiltre>0 &&/.test(APP), 'et affiché à côté du bouton',
  'il cachait 4 des 5 points de Cancale sans jamais le dire');

// ── 5. UN POINT HORS SUJET EST SIGNALÉ, PAS SUPPRIMÉ ───────────────────────
dit(/center: \(j && j\.center\) \|\| null/.test(APP), 'le centre de la ville est conservé');
dit(/const kmDeLaVille/.test(APP) && /km > 30/.test(APP),
  'un point à plus de 30 km de la ville est signalé', '« Juste Ici » est à 819 km');
const j = APP.indexOf('const kmDeLaVille');
const K = j < 0 ? '' : APP.slice(j, j + 400);
dit(!/removeSavedPoint|hidePoint/.test(K),
  'et il n\'est JAMAIS retiré tout seul — c\'est sa liste');

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLa ville arrive jusqu\'à l\'écran, et la carte dit ce qu\'elle montre.');
process.exit(ko ? 1 : 0);
