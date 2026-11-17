# Maquette F — « La paire au centre » (17 nov. 2026)

Demande de Julien (17 nov.) : « lance des agents qui vont révolutionner les maquettes, qui me proposent des
choses TOTALEMENT différentes ». Les autres propositions : A sobre, B iOS natif, C Studio, D fil d'actions,
E tableau en tuiles. **F ne navigue plus par écrans, mais par la PAIRE.**

C'est une **proposition**, pas une livraison : aucune PR. Branche `claude/maquette-f`.

## Ce que c'est
- **Une barre de commande toujours là** (en haut au téléphone, ⌘K sur l'ordinateur) : N°, pseudo, n° de suivi,
  code de retrait, n° de transaction, modèle, « à envoyer », « colis Super U ». Elle répond par des **fiches
  vivantes** (une paire = une ligne de 72 px : vignette, plaque N°, là où elle en est, son **fil de vie**).
- **Le fil de vie** : sept marches (achat · case · en ligne · vendue · bordereau · envoi · argent). Fait = encre,
  geste à faire = ambre, pas encore = creux, pas su = pointillé. Sur chaque ligne, en petit ; sur la page, en grand.
- **La page d'une paire** raconte toute sa vie, de l'achat (relié par son n° de transaction) à l'argent, avec
  LE geste du moment (« À envoyer avant vendredi · Imprimer le bordereau ») et Achat · Vente · Marge.
- **Les listes sont des recherches enregistrées** : À envoyer, À retirer, Offres, En ligne, Qui dorment — des
  pastilles comptées en haut ; une liste choisie devient un jeton DANS la barre.
- **L'ordinateur** : trois colonnes qui ne bougent pas (recherche + listes · résultats · fiche), comme Linear.
- Inspirations (principes, rien de copié) : Raycast (la commande qui répond par types), Superhuman (une liste =
  une recherche enregistrée comptée), Linear (trois colonnes denses).

## Ce qui est gardé (règles §5, §7)
- **Identité jamais par ressemblance** : la recherche utilise le moteur de l'app (`src/rechercheUnique.js`) ;
  « C'est elle » = identité exacte seulement ; un N° qui ne fait que **contenir** la saisie est dit « N° qui
  contient » ; le titre va dans « Ressemble — à toi de choisir, rien n'est relié ». Une paire est reliée à sa vente
  par l'`item_id`, à son bordereau par la transaction, à son achat par `buyFromId` (son clic).
- Chiffres vrais ou « — » (coût pas saisi, date limite pas lue, « estimation vente + 7 j » dite comme telle).
- Un seul bouton plein par écran, cibles ≥ 44 px au téléphone, ambre = geste, aucun rouge, le fond bleu
  « Verre dépoli » de l'app (`src/design/studio-verre.css`).

## Ce que ça casse (si Julien la retient)
- **La barre du bas et les onglets** (Ma journée, Annonces, Achats, Ventes, Argent) disparaissent : tout part de la
  barre de commande et des pastilles. Le disque central (Chercher · Scanner · Publier · Imprimer) n'a plus de place.
- **Ma journée** (la carte héros, la semaine, Vendu/Reçu/Bénéfice) est remplacée par « le geste du moment + ça
  bouge » : les chiffres du mois devraient retrouver une place (une recherche enregistrée « Ce mois » ?).
- **Les écrans par plateforme** (Vinted / Leboncoin / eBay / Vestiaire) deviennent des lignes de la vie de la paire.
- **Argent, Paramètres, Messages** n'ont pas encore leur place dans ce modèle (pas maquettés).
- Les décisions de navigation passées (la coque, la barre du bas, le disque) sont à rouvrir.

## Comment la voir
`npm run build && SHOTS=/tmp/f node scripts/bancs/maquette-f.cjs` — base inventée riche (3 comptes, 1 000 paires
en ligne, 1 000 conversations, la paire N° 124 racontée de bout en bout, des colis à retirer au Super U).
Le prototype (`src/maquettes/f/`) n'est monté que si l'appareil porte `vrm_banc_maquette` = 'f' (posé par le banc,
`src/main.jsx`) : invisible pour Julien. Textes en français seulement (à passer par `tr()` si retenue).

Mesures du banc (390 tactile et 1512, clair et sombre) : 1 bouton plein visible au plus, aucune cible < 44 px,
1re ligne de liste à 335–430 px (≤ 422 demandé : l'accueil à 430 met le geste du moment avant), aucun
« undefined/NaN », « reliée par son n° de transaction » sur la paire 124, aucune ligne « exacte » qui ne l'est
pas (rouge sur la 1re version — « N° exact » sur 1240 — vert après).
