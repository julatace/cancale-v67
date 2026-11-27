# 27 nov. — Trois fonctions rendues après le passage aux écrans natifs

Choisies par Julien le 27 nov. Branche `claude/retour-fonctions-27nov` (partie de `origin/main` + `origin/claude/bancs-natifs-b`, PR #1435).
Aucune donnée inventée en base, rien dans `vinted-sync-extension/`.

## 1. Ventes · Terminées : le filtre « Compte » au téléphone

- **Règle unique** (`src/filtrePlateforme.js`) : `comptesDeLignes`, `choixCompteEffectif`, `filtrerCompte`. Une vente est du compte que
  SA lecture a posé sur sa ligne (`l.compte`), jamais de son titre. Le tableau de l'ordinateur passe par les mêmes fonctions
  (comportement identique : il garde SON état, le choix du téléphone ne s'y applique pas).
- **Composant** : `FiltreSeul` (`src/natif/TableauTravail.jsx`) = le bouton de la barre d'outils du tableau + sa feuille, mêmes
  `data-tt-filtre="compte"`, `data-tt-filtre-choix="compte:…"`. Montré seulement avec deux comptes ou plus. « Tous les comptes » par défaut.
- **Mémoire** : la clé du filtre de site `vrm_filtre_plateformes`, entrée `compte:ventes` = `{ vendeur, compte }` ; `vendeur` = l'id de
  la session VRM (`AUTH.user.id`). Un autre vendeur sur l'appareil repart de « Tous les comptes ». Un compte disparu ⇒ « Tous ».
- Un compte exclu n'a déjà aucune ligne (`compteEcarte`) : jamais un choix.

## 2. Statistiques · Annulations : « un compte annule plus que les autres »

- L'alerte du 5 nov. (ancien Ventes · Vinted, `docs/passation/2026-11-05-chantier-e2.md`) : **la même règle importée**,
  `comptesQuiAnnulent` + `SEUILS_ANNULATIONS` (`src/ventesEcran.js` : ≥ 5 ventes et ≥ 2 annulations, autres comptes ≥ 5 ventes,
  part ≥ 2× ET ≥ 15 points au-dessus). Elle juge les **lignes de la carte** (toutes plateformes lues, la période choisie), pas une
  fenêtre de 30 jours à part : la phrase vient de la source de ses chiffres (§5).
- Une ligne au-dessus des taux : « vendeuse_b annule nettement plus que tes autres comptes », SANS nombre (« même nombre jamais deux
  fois » : la rangée dit déjà 50 %) ; « Pourquoi ? » donne les taux, « sur la période choisie » et les seuils.
- **Pas su ≠ 0** : un compte connu mais pas lu (`manquants`) rend la comparaison partielle ⇒ rien n'est comparé ; la ligne dit
  « Pas comparé : X pas lu » (et la note du pied ne le redit pas). Une plateforme jamais lue n'a pas de comptes : rien de supposé.

## 3. Messages « Tous » : les questions eBay sans réponse d'abord

- `convEbay` porte `aRepondre = estQuestion(m) && sansReponse(m)` (règles de `src/questionsEbay.js`, la même que « non lu » de
  Ma journée). `ordreARepondre` / `attenteARepondre` (`src/filUnique.js`) : ces fils en tête, la plus ancienne attente d'abord ;
  le reste garde l'ordre du 12 nov. Le compte qui en porte passe en tête des groupes (comptes toujours séparés).
- Marque « À répondre » (`data-fil-a-repondre`, gras, pastille calme à l'accent) ; identité inchangée `ebay:{compte}:{id}`.

## Preuves

| banc | avant (28f97aa87) | après | mutation |
|---|---|---|---|
| `comptes-securite` A | 2 KO au téléphone (aucun filtre) ; ordinateur vert (inchangé) | vert, 390/1512, clair/sombre, polices CI | `lireChoixCompte` sans le vendeur ⇒ KO « autre vendeur » |
| `ventes-e2` A2 (`SCENARIOS=annul,egal,exclu,ko`) | 4 KO (aucune ligne) | vert | `partiel: false` ⇒ KO scénario `ko` |
| `offres-objectif` C | 3 KO (ordre q4,q2,q1,q3) | vert (q1,q2,q4,q3) | `ordreARepondre` sans tri ⇒ 3 KO |

## 4. (même jour) « Terminées » devient « Toutes »

Décision de Julien : le segment `toutes` de Ventes (VentesToutes) liste TOUTES les ventes — c'est la seule liste complète. Libellé
`vn.toutesVentes` (Toutes · All · Todas · Tutte · Alle) ; la liste ne change pas ; Leboncoin garde `vn.terminees`. Les bancs
`rentabilite`, `ventes-ligne-propre`, `natif-ventes` lisent la clé `data-colis-onglet-choix="toutes"` (§6.4), plus le texte —
verts après (82, 16, 58).
