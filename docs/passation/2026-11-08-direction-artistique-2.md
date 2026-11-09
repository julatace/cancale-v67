# 8-9 nov. 2026 — Direction artistique, phase 2 : la grammaire de la rangée de données

Branche `claude/direction-artistique-2` (partie de `claude/amazing-lovelace-xd7obl`, qui porte la
phase 1). Pas de PR, pas de merge : à valider par Julien.

Julien (8 nov., 23 h 50), après les avant/après de la phase 1 : « fais ça bien pour TOUT ; les
données, on dirait qu'elles partent dans tous les sens ; tout doit être clair et parfait ». Ses
captures : Colis → Envoyés, rangées où photo, N°, titre, ligne d'état, frise et bouton tombent à
des places différentes ; la carte sombre qui passe SOUS la barre de recherche en défilant.

Tout est dans `src/styles-premium.css` (couche `@layer vrm-premium`, section 10, jetons `--p-g-*`).
Style seulement : aucun texte, chiffre, `data-*`, geste ni ordre de blocs ne change (texte rendu
`innerText` comparé avant/après sur chaque capture).

## La grammaire, en une page

**Une rangée de données a UNE forme, sur tous les écrans.** Ses colonnes ne dépendent jamais du
contenu : une rangée sans N°, sans frise ou sans bouton garde la place vide, la suivante tombe au
même pixel.

```
ordinateur   [vignette 44] [N° 52] [titre, 1 ligne]                 [état 300] [montant 96 ⟩] [action 176]
                                    [site · compte · date, 1 ligne]
téléphone    [vignette 44] [N° 52] [titre, 1 ligne — 2 au plus]                    [montant | action]
                                    [site · compte · date, 1 ligne]
```

| rôle | forme | jeton |
|---|---|---|
| vignette | 44 × 44, rayon 10, centrée sur la rangée | `--p-g-vignette` |
| gouttière | 12 px entre la vignette et le texte | `--p-g-gout` |
| bord | 16 px à gauche et à droite de la rangée | `--p-g-bord` |
| filet | 0,5 px, commence après la vignette (16 + 44 + 12 = 72) | `--p-g-filet` |
| N° | pastille de `Numero.jsx`, **largeur mini 52**, chiffres tabulaires, centrée ; ses couleurs restent les siennes (encre le jour, #48484A la nuit — jamais blanche ; rouge = deux paires ; ambre = à vérifier) | `--p-g-num` |
| titre | 15/600, interligne 20, **une ligne** coupée à la fin ; au téléphone à côté de deux gestes, **deux lignes au plus** (règle des deux lignes de DESIGN.md) | `--p-g-ligne-titre` |
| sous-ligne | 13/400 grise, interligne 18, **une ligne**, les morceaux séparés par « · » (posé par la feuille, pas dans le texte) | `--p-g-ligne-meta` |
| état | un mot gris sur la sous-ligne ou dans sa colonne ; geste à faire = le mot à l'encre + **point ambre 7 px** devant ; jamais une dalle, jamais une phrase ambre ; rouge seulement deux paires sous un N° | — |
| frise d'étapes | colonne fixe de 300 px à l'ordinateur (mêmes 4 mots aux mêmes places sur chaque rangée, dans « À envoyer » ET « Envoyés ») ; au téléphone sous le texte, alignée sur lui, ne nommant que la dernière étape faite (les autres mots restent lus) | `--p-g-etat` |
| montant | 15/600 tabulaire, aligné à droite, **sur la ligne de base du titre** ; « — » pour pas su | `--p-g-montant` |
| action | UNE, à droite, zone de largeur fixe réservée même vide (176 à l'ordinateur) ; cible 44 | `--p-g-action` |
| groupe | en-tête à gauche (20/700), compte à droite (13 gris, tabulaire), 20 px au-dessus, 8 dessous ; une phrase répétée sur chaque rangée va dans l'en-tête (§7) | — |
| en-tête collant | la barre de recherche de l'ordinateur a un **fond plein** et un filet (elle était translucide à 84 % + flou : le contenu passait dessous) | — |

## Ce qui a été fait, écran par écran

1. **Colis** (3 onglets ; la logique d'Envoyés reste à `claude/colis-envoyes-tri`, style seulement) :
   À envoyer et Envoyés partagent les colonnes [identité 1fr | état 300 | action 176] ; la limite
   et l'attente passent sur la sous-ligne avec le compte ; À retirer prend toute la largeur
   (900 px avant) en [ouvrir | code 136 | J'ai retiré 136], états « Code à venir » en mot gris ;
   Envoyés au téléphone : titre sur toute la largeur, frise + action sur la 2e ligne (114 px par
   colis au lieu de 170) ; carte « 140 colis à retirer » lisible au téléphone (« 140 c » coupé).
   Mesuré (`grille.js`, 40 rangées) : un seul bord gauche/droit par rôle et une hauteur unique.
2. **Ventes** : la rangée devient une grille au téléphone (plus de montant en absolu), montant
   et N° sur la ligne de base du titre ; le N° quitte la colonne du montant pour une colonne de
   52 px devant le titre, réservée dès qu'une vente de la liste en porte un ; la note d'une seule
   couleur. Pastille du N° : plus jamais blanche la nuit (défaut de la phase 1 sur Colis).
3. **Ma journée** : « À faire » = [vignette | titre / note | une action au même bord droit] ;
   note pressée à l'encre avec un point ambre (plus de phrase ambre).
4. **Annonces** : la fiche est UNE carte (photo, titre, prix tabulaire, bandes d'un bord à l'autre
   séparées d'un filet) au lieu d'éléments posés à nu ; « N numéros à vérifier » en rangées, les
   gestes dans une zone fixe à droite (dessous au téléphone).
5. **Achats** : [photo 44 | titre / état · compte · date | montant | ⋯ 44], sous-ligne sur une
   ligne (la date tombait seule sur une 3e ligne au téléphone).

6. **Messages** (en partie) : une taille par rôle (nom 15/600, heure 13 tabulaire, méta 13,
   extrait 15 gris, encre si non lu), avatar 44. La ligne « paire · N° · compte · motif » se
   coupe encore en trois morceaux au téléphone (comme avant) : à reprendre avec un N° hors du
   titre (JSX).
7. **Coque, en partie** : grand titre 34/700, phrase grise et plus de tuile d'icône devant le
   titre sur TOUS les écrans ; barre de recherche à fond plein sur l'ordinateur.

Pas faits dans cette session : Stock (au-delà de l'en-tête), Favoris & offres, Republier,
Statistiques, Compta, E-mails, Leboncoin/eBay/Vestiaire, Réglages, et le reste de la coque
(barre latérale, barre du bas, feuilles, confirmations, toasts, états vides). Captures AVANT
de tous ces écrans déjà faites (`da2/avant/`).

## Vérifications

Captures AVANT (`origin/claude/amazing-lovelace-xd7obl`, 1f3e1a34) et APRÈS, base inventée
(`_base-volume.cjs`, mêmes données), iPhone 390 tactile et ordinateur 1512, clair et sombre ;
planches côte à côte dans le dossier de livraison de la session (`da2/comparer/`).
Texte rendu identique avant/après, sauf deux coupes mesurées par l'app (`data-lignes`) : à
l'ordinateur, dans « À faire », une note longue se coupe un mot plus tôt (le point ambre prend
13 px) ; et « vendue il y a 12 j » → « 13 j » sur Envoyés (l'horloge a passé un jour entre les
deux captures, pas la feuille).
`npm run build`, audits `violet`, `icones`, `boutons`, `variables`, `tdz`, `coherence`,
`photos-vinted` : verts. Bancs (un à la fois, base inventée), rouges comparés à la branche de
départ (arbre `git archive` de 1f3e1a34 avec son propre `dist/`) :

| banc | branche | départ |
|---|---|---|
| `colis-envoi` | 119 verts | — |
| `colis-retirer-propre` | 129 verts | — |
| `colis-colonnes` | 2 rouges (« dernier jour » en ambre) | les mêmes (déjà sur `main`, phase 1) |
| `ventes-e2` · `ventes-une-phrase` · `ventes-compte` | verts (V0–V9, 19, 56) | — |
| `journee-premium` | 1 rouge (1er geste sous la barre du bas, 844 px) | le même |
| `journee-mieux` | 24 rouges | 25 (un de moins ; aucun nouveau) |
| `achats-messages-premium` | 2 rouges (codes de retrait 2/3) | les mêmes |
| `annonces-coherence` | 4 rouges (bandeau « Prix d'achat 2/6 ») | 8 (les mêmes 4 + 4 « prix conseillé ») |
| `beaute` | 1 rouge (C « Déposé » au glisser) | 2 (le même + « Annuler ») |
| `iphone-reprise` · `ecrans-gardes` | 139 · 29 verts (1 rouge de minutage au 1er passage, vert au 2e) | verts |
| `chargement` | Stock : CLS 0,038 au téléphone | le même |

## Suite (phase 3)

- Écrans 6 à 15 avec la même grammaire (même section 10, un bloc par écran).
- Une phrase répétée sur chaque colis (« date estimée dépassée — vérifie la vraie limite sur
  Vinted ») devrait monter dans l'en-tête du groupe (§7) : c'est du JSX (Colis → À envoyer),
  pas fait ici (la logique de Colis est partagée avec `claude/colis-envoyes-tri`).
- Retirer des anciennes couches ce que la section 10 remplace (phase 2 de la passation du 8 nov.).
