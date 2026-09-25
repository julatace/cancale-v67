// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DE LA CARTE DES POINTS RELAIS   —   node scripts/audit-carte-relais.cjs
// ═══════════════════════════════════════════════════════════════════════════
// HISTORIQUE — pourquoi ce fichier a changé de sujet (25 septembre) :
//   La première version protégeait la recherche de relais « PAR VILLE »
//   (`fetchVillePoints('/api/relais?city=')` → liste `villeCache` + filtre +
//   drapeau 30 km). Cet AFFICHAGE a été remplacé, sessions plus tôt, par
//   « Où déposer tes colis » (points captés par l'extension, `dropOffs`) et par
//   la recherche/ajout MANUEL (`relayPicker`, `savedPoints`). Mais le fetch
//   `villeCache` tournait ENCORE à chaque visite Achats, son résultat rendu
//   NULLE PART — le motif du tiroir `Nav` (§4.11) : du code mort qui s'exécute.
//   L'audit, lui, exigeait toujours `masquesFiltre` / `kmDeLaVille` /
//   `g.saved||g.ville||g.vinted` : quatre tokens d'une implémentation retirée,
//   donc un rouge PERMANENT qui rassure sur rien (un audit doit suivre la RÈGLE,
//   pas l'orthographe d'un code disparu).
//   ⇒ Le code mort a été supprimé (état `ville`/`villeCache`/`villeInput`/
//     `villeLoading`, la fonction, et ses deux réveils `onCloudReady`).
//   Ce fichier teste désormais ce qui est VIVANT et ce qui compte :
//     1. la liste des points enregistrés (`savedPoints`, synchronisée) est
//        rattrapée par `onCloudReady` (§5.49 : lue au montage → le nuage arrive
//        après), et seulement si elle est restée VIDE (jamais écraser une
//        saisie faite pendant le chargement) ;
//     2. un point hors sujet est MASQUÉ (réversible), JAMAIS supprimé tout
//        seul de la base — c'est sa liste (`hidePoint` n'écrit que le masque
//        local `vrm_points_hidden`, et `unhideAll` le rend) ;
//     3. le code mort « par ville » ne revient pas (un relecteur ne doit pas le
//        « rebrancher » en croyant réparer un oubli — cf. tiroir `Nav`).
//
// ⚠️ Contrôle STATIQUE. Le rendu se vérifie au banc `carte.cjs`. Lecture seule.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// ── 1. LA LISTE ENREGISTRÉE EST RÉVEILLÉE APRÈS L'ARRIVÉE DU NUAGE ──────────
// On réutilise `onCloudReady`, le mécanisme qui existait déjà pour les numéros
// (§5.49) — surtout PAS un second canal en parallèle. La ligne doit vivre
// DANS un `onCloudReady(...)`.
// Il y a PLUSIEURS `onCloudReady` dans le fichier : on vise celui qui réveille
// `savedPoints`, en partant de la ligne elle-même et en regardant son voisinage.
const iSP = APP.indexOf("setSavedPoints(p => vide(p) ? load('vrm_points_relais'");
const blocOC = iSP < 0 ? '' : APP.slice(Math.max(0, iSP - 600), iSP + 120);
dit(iSP > 0, 'la liste des points enregistrés est relue quand le nuage a atterri',
  'sans ça, le premier écran ouvert reste sur une liste vide (§5.49)');
dit(/onCloudReady\(\(\) => \{/.test(blocOC),
  'elle passe par `onCloudReady` — le mécanisme existant, pas un second');
dit(/const vide = /.test(blocOC),
  'et elle ne remplace QUE ce qui est resté vide (jamais écraser une saisie)');

// ── 2. UN POINT HORS SUJET EST MASQUÉ, JAMAIS SUPPRIMÉ ──────────────────────
// « Juste Ici » (capté d'un email, géocodé à Marseille) ne doit pas être effacé
// tout seul : c'est SA liste. On le MASQUE (réversible), on ne le retire pas.
const iHP = APP.indexOf('const hidePoint =');
const HP = iHP < 0 ? '' : APP.slice(iHP, iHP + 260);
dit(iHP > 0, 'masquer un point est possible (`hidePoint`)');
dit(/save\('vrm_points_hidden'/.test(HP),
  'le masquage n\'écrit QUE le masque local, pas la liste des points');
dit(!/removeSavedPoint|persistPoints\(|save\('vrm_points_relais'/.test(HP),
  'masquer ne supprime JAMAIS un point de la base — c\'est sa liste');
dit(/const unhideAll = /.test(APP), 'et le masquage est réversible (`unhideAll`)');

// ── 3. LE CODE MORT « PAR VILLE » NE REVIENT PAS (§4.11) ────────────────────
// On retire les commentaires d'abord : ce fichier CITE les noms disparus pour
// expliquer la suppression — un balayage naïf crierait au loup sur l'explication
// elle-même (récidive connue du dossier). On juge le CODE, pas les commentaires.
const sansComm = APP
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + '');
dit(!/\bfetchVillePoints\b/.test(sansComm),
  'la fonction morte `fetchVillePoints` est bien supprimée',
  'elle tournait à chaque visite Achats sans rien afficher (§4.11)');
dit(!/\bvilleCache\b/.test(sansComm),
  '`villeCache` (jamais rendu) est supprimé');
dit(!/\/api\/relais\?city=/.test(sansComm),
  'plus d\'appel `/api/relais?city=` jeté à chaque ouverture');

// ── 4. CE QUI EST VIVANT L'EST TOUJOURS ─────────────────────────────────────
// La recherche/ajout MANUEL et « Où déposer » ne doivent pas partir avec le
// ménage : ce sont eux qui portent la fonction aujourd'hui.
dit(/setRelayPicker\(/.test(APP), 'la recherche manuelle de relais (`relayPicker`) est toujours là');
dit(/dropOffs/.test(APP), '« Où déposer tes colis » (`dropOffs`) est toujours là');

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLa liste des points survit au chargement, un point hors sujet se masque sans se perdre, et le code mort « par ville » ne revient pas.');
process.exit(ko ? 1 : 0);
