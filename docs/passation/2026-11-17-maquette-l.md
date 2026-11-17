# Maquette L — « Le dressing » (17 nov. 2026)

Proposition pour Julien (« propose encore d'autres maquettes, c'est pas assez bien », puis « là c'est vibe codé »).
**Pas une livraison** : aucune PR. Branche `claude/maquette-l` (partie de `claude/onglets-design-c`).

## L'idée
Les apps de mode (Vinted, Vestiaire, SSENSE, Grailed) montrent tout par la photo. L fait pareil, mais pour le
**vendeur** : le dressing de Julien, ses paires posées sur le fond bleu (gardé : il lui plaît), sans carte autour.
- **Téléphone** : grille de 2 colonnes, **5 à l'ordinateur**. Sous chaque photo : le prix, la date qui compte
  (« avant jeudi », « 61 j »), le titre. Sur la photo : le **N° en petite plaque** et **un seul badge d'état**
  (À envoyer, À retirer, À vérifier, Sans N°, À publier, En ligne, Vendue, En route) — affiché seulement quand le
  filtre mélange des états (dans « En ligne », toutes les paires le sont : pas de badge répété).
- **Les onglets deviennent des filtres en mots** : À faire · En ligne · Vendues · Achats (un rail souligné, comme C).
  « À faire » remplace Ma journée : le dressing s'ouvre sur ce qu'il y a à faire, trié par urgence (date limite lue).
- **Toucher une photo** ouvre la fiche plein écran (à l'ordinateur : un panneau à droite) : la photo en grand,
  le titre, l'état, Acheté · Vendu · Marge, les lignes utiles (compte, vendue le, suivi), et **le geste du moment
  en bas, au pouce** (Imprimer le bordereau, J'ai retiré le colis, Baisser le prix, Régler le N°…).
- **À retirer** : la fiche met le **code de retrait en grand** (40 px) et le **QR seulement s'il existe vraiment**
  (image Vinted Go / Chronopost) — aucun QR n'est fabriqué (règle d'App.jsx : générateur retiré à dessein).
- **Un bouton plein par écran**, blanc, flottant au-dessus de la barre : « Imprimer 6 bordereaux » (À faire),
  « Codes de retrait 2 » (Achats) ; rien sur En ligne et Vendues (rien à faire).
- **Argent** reste une liste chiffrée sobre : En novembre (Vendu · Reçu · Bénéfice « au moins », couverture dite) ·
  À venir · Derniers versements (vignette + date de versement).
- **Barre du bas à 4 entrées** : Dressing · Messages · Argent · Moi.

## L'état est CALCULÉ (src/maquettes/l/dressing.js, module pur)
Mêmes règles que la maquette G (recopiées d'App.jsx, non exportées : PAS_UNE_VENTE, COLIS_DEJA_BOUGE,
venteQuiRevient, venteVivante, « en ligne » = dressing lu < 24 h). Identité §5 : fiche N° par l'id de SON annonce,
vente par `item_id`, bordereau par n° de transaction, achat par `buyFromId`, **code de retrait par le n° de
transaction de l'achat** (ligne publiée `vrm_colis_retirer`, forme de `ligneRetrait`). Deux paires présentes
sous un N° ⇒ plaque rouge, dans « À faire ». Payée ⇒ Argent (date de VERSEMENT, transaction 450).

## Ce que ça casse (si Julien la retient)
- **La barre à 5 onglets + le disque « + »** disparaissent : Annonces, Ventes et Achats fusionnent dans le Dressing ;
  le disque (Chercher · Scanner · Publier · Imprimer) n'a plus de place — Chercher passe en loupe en haut, Imprimer
  devient le bouton plein du filtre, **Scanner et Publier n'ont pas encore de place** (à mettre dans la loupe ou « ⋯ »).
- **Ma journée disparaît** (le chiffre du jour, la semaine, Vendu/Reçu/Bénéfice) : « À faire » la remplace, les
  chiffres vont dans Argent.
- **Moins de paires par écran** : 2 colonnes = 4 paires entières visibles au téléphone (la règle « 1 000 articles »
  de vrm-design en demande ≥ 8 en liste). Pour 1 000 annonces : `content-visibility`, recherche par N° obligatoire ;
  une vue liste resterait nécessaire pour les gestes en série (sélectionner 40 paires, republier, baisser les prix).
- **Leboncoin, eBay, Vestiaire, le choix du compte, Stock 3D, E-mails, Paramètres** : pas maquettés (le choix du
  compte irait dans la loupe ; les plateformes en petit logo sur la plaque).
- Les règles d'état sont recopiées : si L est retenue, elles sortent d'App.jsx dans un module partagé.
- Textes en français seulement (prototype) : à passer par `tr()` si retenue.

## Comment la voir
`npm run build && SHOTS=/tmp/l node scripts/bancs/maquette-l.cjs` — base inventée (3 comptes, ~150 paires, un cas
par règle, 2 achats au point relais dont un avec QR). Les « photos » sont des **dessins de baskets inventés** (sans
marque ni logo), servis par le banc. Le prototype n'est monté que si l'appareil porte `vrm_banc_maquette` = 'l'
(`src/main.jsx`) : invisible pour Julien.
