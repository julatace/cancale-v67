# 12 nov. — Vert et vitesse (second agent, branche `claude/agent2-vert-vitesse`)

## 1. CI rouge sur `main`

### « ecrans (parcours-quotidien) » (Reprise des chantiers)
- **Le banc** `scripts/bancs/parcours-quotidien.cjs` extrait `useVueSession` d'App.jsx. Depuis la reprise
  synchronisée (11 nov., afbf9ec27) cette fonction lit `vueSynchronisee`, `carteReprise`, `noterReprise`…,
  absents du banc ⇒ « vueSynchronisee is not defined », rien ne s'affiche. Porté : le banc prend le VRAI
  écrivain de la reprise d'App.jsx (bloc `let _repriseAttente` → `// Quitter un écran`), servi par un
  stockage local, et attend l'écriture réelle de la carte avant de juger « état retrouvé ».
  Rouge sur main, vert après (6 passes) ; mutations : propriétaire non isolé dans `lireCarte` ⇒ rouge,
  `vueReprise` qui rend toujours le défaut ⇒ rouge.
- **Un vrai défaut, trouvé par le test suivant du même job** (`scripts/tests/navigation-plateformes.cjs`,
  jamais atteint tant que le banc tombait) : en décembre et en janvier, la carte « Clôturer l'année »
  remplissait la liste des tâches d'un vendeur qui ARRIVE ⇒ son guide de démarrage plein écran
  (`premierJour`) disparaissait (horloge du banc en janvier 1970). Corrigé : pas de carte de clôture à la
  première visite. 52 contrôles verts ; `audit-cloture-annee` 54/0.
- Les 7 autres tests du job : verts en local.

### « comptes-et-reception » (Parcours critiques)
- `scripts/tests/favoris-historique-interface.cjs` testait l'ancienne liste PAR PERSONNE (retirée par
  favoris-clair : « VRM ne montre jamais qui »). Porté sur la page en trois temps, mêmes règles jugées
  sur les attributs (`data-fc-annonce`, `data-fc-personnes`, `data-fc-aecrire`, `data-fc-choisie`) :
  pages fusionnées sans perdre la première, « lu » ≠ « envoyé », vérification du premier favori sans
  envoi ni double ouverture, refus en haut de la feuille, preuve non confirmée ≠ statut positif, contrôle
  copiable sans donnée privée, lancement refusé expliqué et copié, vendu jamais choisi et retiré du choix.
  Comme l'app : `chargementAutomatique` (Favoris lit à l'ouverture). Jeu : n3 n'a plus de job « annulé »
  (lu, jamais écrit) et une 5e notification — favoris-clair ne repropose ni l'interrompu ni le clôturé.
- **Un vrai défaut** : un « Envoyer » refusé par le serveur ne disait RIEN sur la page (`erreurLancer`
  lisait `controleEnvoi.message`, qui n'existe pas : le contrôle ne porte que code et compteurs). Le moteur
  passe maintenant sa phrase (`onErreur(controle, phrase)`), la page la dit dans « Avant d'envoyer », et
  elle s'efface quand le moteur la retire (nouvelle vérification). Contrôle copiable inchangé.
- Preuves : 99 contrôles (320/390/1512) ; rouge sur main (l'erreur n'apparaît jamais) ; mutations :
  le refus jamais effacé ⇒ rouge ; `envoye` retiré de `bloque` ⇒ rouge ; les trois gardes « vendu »
  retirées ensemble ⇒ rouge (une seule ne suffit pas : la règle est tenue trois fois).
- ⚠️ La branche `claude/agent2-favoris-compte` (ext. 5.372) remplace cette page par la liste par compte :
  à son intégration, relancer ce test et le reporter sur sa forme (son banc `favoris-compte` juge QUI).

## 2. « Tout imprimer (15) » ouvrait « Imprimer (6) »
- Cause : le bouton comptait TOUTES les lignes du lot (déjà imprimées, anciennes, sans bordereau, eBay),
  la feuille n'imprime que les cochées d'office.
- Une source : `resumeLot(L, coches)` (src/lotSelection.js) — ce qui part, et par raison ce qui n'y est
  pas (eBay, sans bordereau, déjà imprimé, vendue il y a plus de 14 j, décochée par lui). Le bouton dit
  `resumeLot(L).partent` ; il reste ouvrable quand rien n'est neuf (il dit pourquoi). La feuille dit
  « Pas dans ce lot » en haut : « N sans bordereau encore — Tout générer (N) » (les ventes Vinted sans
  bordereau + les lignes sans PDF), « N déjà imprimé — coche pour réimprimer », « N vendue il y a plus de
  14 j — à vérifier », « N décoché par toi ». eBay garde sa section.
- Banc `scripts/bancs/tout-imprimer-compte.cjs` (1512 clair, 390 tactile sombre, données inventées) :
  16 verts ; avant : 10 rouges (bouton 4, feuille 2, aucun pourquoi) ; mutation (le pourquoi sans la
  sélection) ⇒ rouge. Captures regardées. Bancs voisins verts : colis-colonnes, colis-a-leur-place (184),
  tout-imprimer-garde ; audits selection-bordereaux, colis-trois.

## 3. Vitesse
### (a) Une vente écrite par l'extension
- Mesuré (banc `scripts/bancs/ventes-relecture-compte.cjs`, `_base-volume` au poids réel, Ventes ouverte,
  65 s plus tard une vente sur UN compte + le signal `vrm:ext`) : **7 lignes de commandes relues, 1 263 Ko
  lourds, 1 350 Ko en tout**. Deux lecteurs : `relire(uid)` relançait `loadOrders` sur tous les comptes
  (la mémoire des lignes, 60 s, avait expiré) — et la cloche de la coque (`passe`, recomptée à chaque vente
  signalée) relisait aussi tous les comptes.
- Corrigé : `loadOrders(..., { seulement:[uid], prec })` relit le seul compte et le fusionne dans la liste
  montrée (les autres comptes gardés tels quels, leur « pas su » aussi ; lecture ratée ⇒ rien changé) ;
  un seul oubli par signal pour les deux moteurs de Ventes (`oublierCommandesCompte`, 4 s) ; la cloche
  garde les commandes 10 min (`cachedRow(..., ttl)`) et oublie le compte signalé.
- Après : **1 ligne lourde (182 Ko), 268 Ko en tout**, la vente à l'écran en 0,3 s, les ventes des autres
  comptes toujours là ; 12 verts (1512 et 390). Rouge avant ; mutation (sans `seulement`) ⇒ rouge.
- Limite assumée : une vente d'un AUTRE navigateur vue seulement par la cloche (aucun écran de ventes
  ouvert, donc aucune sonde) peut mettre jusqu'à 10 min à compter dans la cloche.

### (b) 20 000 ventes — mesuré, pas corrigé
- `_base-volume` accepte `ventes` (et `_mesure-demarrage` `VENTES=20000`) : de vieilles ventes
  finalisées dans `orders_sold` seulement. Base par défaut inchangée.
- Mesure (390, CPU ×4, 4G) : Ma journée prête au plafond en 7,3 s (9,7 s de tâches longues), Ventes 9,6 s
  (12,2 s), Achats 8,1 s (17,5 s, une tâche de 11 s).
- Profil (build non minifié) : `Comptabilite` ~16 s inclusif sur Achats, dont `useMemo` 14,6 s ; en
  propre : `isHidden` 2,7 s, `classifyOrderStatus` 1,1 s, `compteEcarteChoix` 1,0 s, `photoKey` 0,7 s,
  `memoRendu` 0,65 s. Ce sont des centaines de milliers d'appels par rendu sur les mêmes 20 000 ventes.
- Essai : mémoire d'un rendu sur `isHidden` — gain non démontré (la mesure varie du simple au double
  d'une passe à l'autre) et la comparaison des chiffres par le texte de l'écran n'est pas déterministe
  (l'écran n'est pas au même stade). **Retiré** : ni gain prouvé, ni preuve « aucun chiffre changé ».
- À faire (lot dédié) : une liste « ventes visibles » calculée UNE fois par changement de `sales.items` /
  masques / offre, que les mémos lisent au lieu de refiltrer ; `classifyOrderStatus`/`photoKey` mémorisés
  par chaîne (attention : une dizaine d'audits extraient ces fonctions TELLES QUELLES, une mémoire de
  module les casserait) ; un audit node qui calcule les totaux d'Argent sur la même base avant/après.
  Budget-vitesse : rien relevé.

## 4. Restes vus en passant
- `scripts/bancs/ventes-colis-premium.cjs` : 2 rouges « aucune seconde liste « À envoyer », un lien vers
  Colis » — le lien `data-ventes-vers-colis` n'existe plus depuis que Colis vit dans Ventes (DJ3) ; banc
  hors CI, à porter (pas touché ici).
- La sonde de 60 s des ventes et la veille temps réel (branche `agent2-temps-reel`, non intégrée)
  passent toutes deux par `relire(uid)` : elles profitent de la relecture d'un seul compte.

## 5. Gestes de Julien
Aucun.
