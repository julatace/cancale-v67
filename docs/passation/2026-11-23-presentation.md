# 23 nov. 2026 — Mode présentation (`claude/presentation`)

Demande : Julien présente VRM le 23 nov. à 17 h. Un interrupteur qui cache à l'écran montants, pseudos d'acheteurs et
de vendeurs, adresses, e-mails, codes de retrait, n° de suivi, noms de ses comptes (« Compte 1, 2… »), en gardant
photos, titres, N° de rangement, compteurs et graphiques. Purement visuel, mémorisé sur l'appareil, état visible.

## Ce qui est fait
- **Une seule règle, celle du mode stream** (`src/modeStream.js`, 5–6 nov.) : la présentation est un PROGRAMME FIXE
  (`REGLES_PRESENTATION` : toutes les catégories cachées, aucune liste de mots, AUCUNE photo floutée). Pas un second
  mécanisme : la même couche DOM (texte réécrit « ••• » avant la peinture, champs et QR floutés par le CSS
  d'`index.html`, `data-stream="1"`), les mêmes marquages des composants (`.vrm-sensible` + `data-stream-type`
  `acheteur|code|compte|adresse`, `data-stream-image`, `data-stream-libre`), les mêmes jetons publiés par les écrans
  (`jetonsStream`). Priorité : stream > présentation > œil des montants.
- **« Compte 1, 2… »** : `jetonsStream` accepte une entrée en TABLEAU = les alias d'UN compte (pseudo, e-mail,
  libellé, identifiant) ; `compilerRegle` leur donne un seul numéro (`comptesN`) ; un bloc marqué
  `data-stream-type="compte"` devient « Compte N » s'il est exactement un compte connu, sinon « ••• ». Libellé par
  `tr('presentation.compte')` (5 langues).
- **N° de suivi / transaction** : en présentation seulement, deux motifs de plus (lettres+chiffres 10–34 signes ;
  8–22 chiffres). Un N° de rangement (≤ 6 chiffres) n'en est jamais un.
- **Où l'allumer** : Paramètres → Apparence et langue → groupe « Quand tu filmes » → « Mode présentation » (`data-reglage-presentation`, lien profond `?tab=settings&reglage=presentation`) ; menu du compte
  (`data-profil-menu="presentation"`) ; feuille « Plus » du téléphone (`data-n-plus-entree="presentation"`) ; sur
  ordinateur, le bouton ▶ juste à côté de l'œil en bas de la barre latérale (`data-bouton-presentation`).
- **État visible** : pastille « Présentation » en haut au centre, en portail au-dessus des feuilles
  (`data-pastille-presentation`, jamais réécrite) ; un toucher quitte le mode.
- **Propre à l'appareil** : `localStorage.vrm_presentation` ; rien n'est écrit en base (le banc le vérifie).
- « Quoi de neuf » : `mode-presentation`.

## Preuves
- Banc `scripts/bancs/mode-presentation.cjs` (390 tactile + 1512) : A hors mode, montants et pseudos lisibles (banc
  non vide) ; B l'interrupteur de Paramètres allume, rien envoyé au nuage ; C sur 14 écrans + le menu : aucun montant,
  aucun compte/pseudo/adresse/code/n° de suivi du jeu inventé, N° lisibles, « Compte N » présent, aucune photo
  floutée, pastille visible ; D un toucher sur la pastille rallume les montants sans recharger.
- Rouge sur le code d'avant (origin/main) : voir le rapport de la session (B échoue : l'interrupteur n'existe pas).

## ÉTAT À LA REPRISE
- Limite connue : la règle lit le TEXTE rendu ; un pseudo jamais publié par un écran (`jetonsStream`) et jamais
  marqué `.vrm-sensible` resterait lisible. Les écrans principaux publient leurs pseudos (ventes, achats,
  conversations, factures, eBay, recherche). Un nouvel écran qui montre un pseudo doit le marquer.
- Un montant d'affiche coupé (« 272 » + `<span class="eur">€</span>`) n'était pas caché par la règle du texte sur
  Argent → Résumé (cause pas trouvée à temps) : les composants sont désormais MARQUÉS `data-stream-type="montant"`
  (`MontantAffiche`, `Montant`, `Somme`, `prixAffiche`, `sommeAffiche`, `petitEuro`) et le banc détecte tout
  « montant coupé » (`.sb-eur`, `.eur`, `.vrm-jc-eur` dont le parent garde un chiffre).
- `audit-stream-photos` 4.13 porté sur la règle : l'œil cache aussi un montant marqué, jamais un code ni un pseudo.
- Les canvas (graphiques) ne sont pas réécrits : leurs axes en euros restent dessinés (forme seule voulue, mais une
  étiquette d'axe « 1 200 € » dans un canvas serait lisible).
