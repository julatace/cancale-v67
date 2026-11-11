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

## Preuves
Voir la fin du fichier (mis à jour à la fin de la session).
