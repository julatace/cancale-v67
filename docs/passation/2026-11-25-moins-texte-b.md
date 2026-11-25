# Argent, Messages, Réglages : moins de texte — 25 nov. 2026 (lot B)

Branche `claude/moins-texte-b` (depuis `origin/main`, puis `git merge origin/main` : #1398 C3 doux, #1396 parrainage 20 %).
Pas de PR (le train la prendra). Modèle : `2026-11-25-aujourdhui-moins-texte.md`.

## La demande

Julien, 25 nov. : « je veux vraiment que tu regardes toute l'application et que dès qu'il y a du texte, tu l'enlèves ;
ou alors si c'est vraiment indispensable tu le mets mais tu fais un bel affichage ». Ce lot : **Argent** (Résumé et
ses replis, Statistiques, Déclarer, Factures), **Messages** (liste, fil), **Paramètres** (l'écran et ses catégories),
le **menu**, **Comptes liés**, **Extension**, **À distance**, **Parrainage**. Aujourd'hui (fait), Annonces / Achats /
Colis / loupe et les rangées de Ventes : d'autres lots.

## La méthode (la même qu'Aujourd'hui)

Pour chaque phrase : retirée si elle répète un chiffre, un état ou un titre déjà visible, explique l'évidence ou décrit
un bouton ; sinon raccourcie (≤ 8 mots) ; le reste au lecteur d'écran (`vrm-sr-seul`, `n-lu-seul`, `vg-sr`), au
survol (`title`) ou sous « Pourquoi ? ». Un état en mots remplacé par un signe quand le signe suffit (coche, rond vide,
logo du site). Rien de recalculé : aucune règle, aucune donnée, aucun `data-*` retiré. Textes neufs par `tr()`,
cinq langues : `src/i18n/langues/{fr,en,es,it,de}/moinsTexteB.js` (clés `mtb.*`).

**Jamais retiré** : un chiffre, un geste, une alerte qui dit quoi faire (raccourcie), les mentions de la compta
(« au moins » / ≥, la couverture « 0/30 », « à dater », « — » pour « pas su », jamais « encaissé »), le panneau
« Sécurité des données » (ses phrases restent écrites : `phraseEcrite`, Reglages.jsx), les mentions légales.

## Ce qui change

(voir la table « avant → après » plus bas)

## Les preuves

(voir plus bas)
