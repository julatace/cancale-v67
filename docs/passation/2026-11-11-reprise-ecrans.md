# 11 novembre — Chaque écran se rouvre comme on l'a laissé, sur n'importe quel appareil

Branche `claude/reprise-ecrans`. Suite de la reprise du 5 nov. (`2026-11-05-iphone-reprise.md`), qui ne
vivait que sur l'APPAREIL : un filtre posé sur l'iPhone n'existait pas sur l'ordinateur.

## Ce qui est fait

### Une clé légère, synchronisée, par compte VRM — `vrm_reprise_ecrans` (SYNC_KEYS)
Règle pure : `src/repriseSynchro.js`. Forme :
`{ owner, vues: { [nom]: { valeur, at } }, comptes: { [site]: { valeur, at } }, sites: { [tâche]: { valeur, at } }, ecran: { tab, sub, colis, at } }`.
- **vues** : le filtre / segment, le tri, la période, la recherche de chaque écran (les noms de
  `useVueSession` : `ventes-filtre`, `annonces-tri`, `annonces-recherche`, `commandes-periode`,
  `messages-filtre`…). Les « Voir plus » (`-limite`) restent sur l'appareil (`vrm_parcours`, comme avant).
- **comptes** : le compte choisi par site (`src/compteChoix.js`) — celui du compte VRM d'abord, sinon celui
  de l'appareil (`vrm_compte_choisi`, toujours écrit).
- **sites** : le site choisi d'une tâche (`retenirFiltre`, qui rend maintenant `true`/`false`) ; la règle C9
  tient : un écran `choixSeul` (Messages) ne retient que le site TOUCHÉ.
- **ecran** : le dernier écran ouvert.
- **Jamais** : la position de défilement (reste sur l'appareil, `MemoireDefilement`), une donnée, un montant,
  une identité. 60 vues au plus (les plus anciennes partent).

### Les durées
- Dernier écran : rouvert s'il a **moins de 30 min** (le plus FRAIS de l'appareil — reprise locale du 5 nov.
  — et du compte), sinon Ma journée (`ecranAOuvrir`).
- Recherche : revient seulement si on l'a **quittée il y a moins de 10 min**. Quitter = changer d'écran,
  passer en arrière-plan, démonter l'écran : la recherche non vide est re-datée à ce moment. Dans la même
  visite, revenir sur l'écran après 10 min la vide aussi (`reprendreRecherches`).
- Filtre, tri, période : 60 jours (toujours dits à l'écran, voir plus bas).

### L'écriture
`noterReprise(patch)` cumule les gestes DATÉS (l'heure du geste, pas de l'envoi) et écrit par `save` après
**1,5 s** (`DELAI_ECRITURE`) — mesuré au banc : 9 lettres tapées ⇒ 1 écriture de `main`. Au passage en
arrière-plan (`visibilitychange`/`pagehide`), ce qui attend part tout de suite. Un patch porte le vendeur ;
sous un autre vendeur il se tait. **Rien n'est écrit au montage** (l'écran de départ n'est pas un geste : il
effacerait celui de l'autre appareil à la fusion), ni quand un écran repose la même valeur.
La fusion à trois voies du nuage (`fusion3`) garde deux réglages différents posés sur deux appareils.
`vrm_reprise_ecrans` est dans `CLES_NEUTRES` (src/ecransGardes.jsx) : elle est réécrite à chaque changement
d'écran, sans elle aucun écran ne resterait gardé.

### Le nuage arrive après l'ouverture
Un appareil neuf démarre avant d'avoir lu le nuage. Au nuage lu (`onCloudReady`, §5) ou relu (« distant ») :
- l'écran : on y va **une fois**, seulement s'il est plus frais que celui du départ, si rien n'a été navigué
  ici (une section ajustée à l'ouverture ne compte pas) et sans lien reçu ;
- chaque vue : prise **seulement si elle n'a pas été touchée** ici depuis l'ouverture ;
- le compte et le site de l'écran : même règle.

### Un lien profond gagne toujours
L'adresse lue au chargement (`search0`) porte `tab=` ⇒ aucun écran repris (ni au départ ni au nuage). Une
notification ouverte app lancée passe par `setTab` ⇒ c'est une navigation, le nuage ne s'impose plus.

### Rien n'est caché en silence : « Affiché avec … · Effacer »
`RepriseRetenue` (sous la barre du haut, dans `<main>`) dit chaque vue de l'écran courant qui n'est pas au
défaut (« Tri : Ordre Vinted · Effacer », « Recherche : « Air Max 3 » · Effacer »), et « Réinitialiser
l'écran » (vues + compte choisi) dès qu'il y en a deux. 44 px au doigt, neutre (aucun accent, §7),
`src/styles-reprise-ecrans.css`. ⚠️ Il n'existe pas de « menu de l'écran » commun à tous les écrans : la
ligne elle-même porte « Réinitialiser » (choix de cette session, à revoir si Julien le veut ailleurs).
Le compte retenu reste dit par sa rangée « Tous · compte… » (inchangée).

### Un défaut trouvé en route (corrigé)
Au passage en arrière-plan, la reprise partait par `save`, dont l'écriture LOCALE attend 500 ms : l'app
fermée aussitôt (iOS) perdait la recherche (banc `iphone-reprise` R3 rouge). `viderSave(k)` (App.jsx) fait
tout de suite la sauvegarde en attente d'UNE clé, par le même chemin (fusion, file d'envoi, nuage) ; appelé
seulement pour `vrm_reprise_ecrans`, au passage en arrière-plan / `pagehide`.

## Preuves
- `npm run build` vert.
- `node scripts/audit-reprise-synchro.cjs` : **34/34** ; `--prouve` : **15/15 mutations attrapées**
  (recherche 60 j, écran 60 j, lien ignoré, autre vendeur, le moins frais gagne, bandeau muet, « Voir plus »
  synchronisés, clé hors SYNC_KEYS, sans délai, écrit au montage, adopte un réglage touché, adopte après un
  geste, bandeau absent, écrans gardés périmés, C9 « choix seul » perdu). Sur l'arbre d'`origin/main` :
  rouge (module absent).
- `audit-reprise-ecran` : 30/30 et 12/12 mutations (ses deux contrôles de câblage suivent le nouveau départ
  `ecranAOuvrir` et l'écriture hors montage ; son rouge « balayage du bord », présent en début de session, est
  vert après la fusion de `main`).
- `audit-{variables,tdz,coherence,identite,icones,textes-courts,fonctions-api,secrets,bancs}` verts.
  `audit-coherence` exige l'historique complet de `main` (clone superficiel ⇒ « historique illisible ») :
  vert après `git fetch --unshallow`.
- `fusion-echelle --verifier` : mon fichier CSS est sur l'échelle ; 92 autres fichiers de `main` ne le sont
  pas (déjà le cas). ⚠️ Sans `--verifier`, ce script RÉÉCRIT 93 fichiers : lancé une fois par erreur,
  annulé aussitôt (`git checkout -- .`).
- **Banc `scripts/bancs/reprise-ecrans.cjs`** (deux contextes Playwright, ordinateur 1512 px + iPhone 390 px
  tactile, même compte, base à état `_base-ecritures.cjs`, données inventées) : **28/28 vert après** ;
  **15 KO sur le build d'`origin/main`** (archive, même banc, `BANC_DIST`). Une version intermédiaire sans
  `onCloudReady` avait P2–P4 rouges (l'iPhone neuf restait sur Ma journée) : la reprise au nuage lu à
  l'ouverture est bien ce qui les fait passer. Mesuré : 9 lettres tapées ⇒ 1 écriture de `main`.
- Captures regardées : ordinateur (Annonces, « Affiché avec Recherche · Tri · Réinitialiser l'écran »),
  iPhone (Annonces repris, Ventes « Finalisées » et site Vinted repris, Ma journée après 30 min, Achats par
  lien).
- Mode sombre regardé (iPhone 390, bandeau lisible sur ses jetons).
- **Bancs voisins, avant / après identiques** (build d'`origin/main` contre ce lot) : `deux-appareils` 12 KO
  des deux côtés (parties C et D : le chemin « Outils → Compléter les prix d'achat » a changé sur `main`) ;
  `navigation-tache` 7 KO des deux côtés, `iphone-reprise` 15 KO des deux côtés (structure du menu
  « Plus » / colonne : Vendre · Gérer · Moi, lots AC/AL). Partie R d'`iphone-reprise` (la reprise du 5 nov.) :
  16/16 après.

## Ce qui reste
- Aucune écriture en base réelle, aucune PR : la branche attend d'être fusionnée.
- Sur ses deux appareils (geste de Julien, une fois fusionné) : poser un filtre sur l'ordinateur, ouvrir
  l'iPhone dans les 30 min — même écran, même filtre, et la ligne « Affiché avec … » pour l'effacer.
- La fusion du nuage tranche champ par champ (`fusion3`) : si les DEUX appareils changent la MÊME vue entre
  deux synchronisations, c'est celle de l'appareil qui écrit qui gagne (pas forcément la plus récente).
  Rare et sans perte de donnée ; à revoir seulement si cela gêne.
- « Réinitialiser » vit dans la ligne « Affiché avec … » (aucun menu propre à chaque écran n'existe).
