# 28 nov. 2026 — Leboncoin, Vestiaire et eBay soignés « comme la page de connexion eBay » (`claude/sites-soignes`)

Julien (28 nov.) : « je veux que tu améliores même Vestiaire Collective, Leboncoin et eBay ; pour eBay je veux que tu
fasses tout parfaitement comme la page de connexion ; les designs un peu simples doivent être améliorés ».
Consigne du jour : **ne pas toucher à l'extension** (aucun fichier de `vinted-sync-extension/`, aucune version, aucun zip).

## 1. La référence : la page de connexion eBay (Paramètres › Comptes eBay, non relié)

`src/ebay/ConnexionEbayGuidee.jsx`. Ce qui la rend réussie :

- **Hiérarchie** : UN titre net (« Relier ton compte eBay », 17/700), rien au-dessus qui le concurrence.
- **Ce qui va se passer, dit AVANT** : trois étapes numérotées, chacune dans une **pastille ronde teintée** (28 px,
  chiffre 15/700), texte 15/21 à l'encre, 10 px entre deux étapes — on lit l'ordre sans effort.
- **UN plein** (« Connecter mon compte eBay »), rien d'autre de plein sur la page.
- **Une note courte** (13, secondaire) sous le geste : la réponse à la question suivante (« Plusieurs comptes ? »).
- **Aucun texte d'explication en paragraphe**, aucune boîte grise dans une boîte, aucune couleur de marque sur un texte.

Ce qui manquait encore à la référence elle-même : l'identité du site. Elle reçoit la **tuile du logo** (48 px, coins
13, fond teinté discret du site) au-dessus du titre ; c'est ce qui la distingue d'une page Vinted sans couleur criarde.

## 2. La recette, en deux pièces (`src/sites/SiteSoigne.jsx`, `src/sites/site-soigne.css`)

- `TeteSite({ site, section })` — la tête d'une page propre à un site : tuile du logo (40 px), titre 17/700, UNE ligne
  qui dit à quoi sert la page (`ss.tete.<section>`), un geste discret à droite au besoin. `data-site-tete`.
- `EtatSite({ site, titre, etapes | phrase, action, secondaire, note })` — un état sans contenu (jamais relevé, vide,
  panne) dit comme la connexion : tuile, titre, étapes numérotées (ou une phrase), UN plein, une note. `data-ss-etat`.
- Jetons natifs seulement (`--n-*`) ; la teinte du site (`--ss-teinte`) ne colore JAMAIS un texte : fond de la tuile et
  des pastilles d'étapes. Mêmes mesures sur les trois sites ; seul le logo change (§2.11).
- Aucun composant partagé de `src/natif/` modifié (ajout seulement) ; App.jsx : 4 retouches courtes (import, têtes des
  sections eBay / Messages, `OngletManque`, le montant « Ventes payées » retiré d'À traiter · Offres · Promotion).

## 3. Les pages refaites

État de départ mesuré (captures AVANT sur `origin/main` du 28 nov., `scripts/bancs/sites-soignes.cjs`) : depuis le
20 nov. tout est mélangé (plus de pages Ventes/Annonces/Messages par site). Les pages PROPRES aux sites qui restent :

| page | avant | après |
|---|---|---|
| **eBay · Comptes eBay, relié** (Paramètres) | « ✓ Compte eBay relié » en texte nu, boîtes grises dans la carte, « Actualiser » et « Régler » en touches lourdes, « + Connecter un autre compte » en bouton isolé | tête du site (tuile, « 2 comptes eBay reliés », « aucun mot de passe ne passe par VRM », « Actualiser » discret) ; liste groupée native « Tes comptes eBay » (pseudo, étiquettes Pro/Particulier, état de l'autorisation et « Reconnecter » sur la même rangée, « Déconnecter » à droite), « Connecter un autre compte eBay » est une rangée ; « Publication › Réglages de publication » en rangée à chevron ; « Données et argent » repliés comme avant |
| **eBay · Comptes eBay, non relié / pas configuré / pas vérifié** | texte nu (« eBay n'est pas encore activé… », « Connexion eBay pas vérifiée (serveur muet) ») | `EtatSite` : tuile, titre, une phrase, rien d'autre — la connexion guidée garde ses trois étapes, avec la tuile |
| **Un site sans données** (`OngletManque` : eBay pas relié, Leboncoin / Vestiaire jamais lus) | carte « logo + phrase + bouton » | `EtatSite` : pour eBay **les trois étapes de la connexion elles-mêmes** + « Relier mon compte eBay » ; pour Leboncoin / Vestiaire : 1 le geste qui fait venir la donnée, 2 l'extension relève, 3 tout apparaît ici, + « Ouvrir … ↗ » et « Rien lu ne veut pas dire rien » |
| **eBay · Tableau, Argent, Santé, Trafic** | à l'ordinateur la section vit dans la colonne de liste : deux colonnes de cartes y coupaient les libellés (« Disponi… », « Niv… ») | tête du site ; la mise en page suit la place RÉELLE (requête de conteneur `ebt-place`) : une colonne sous 700 px, deux au-delà |
| **eBay · À traiter, Offres, Promotion** | « 165 € Ventes payées » répété sur chaque section, titre « Offres eBay » redit | tête du site, montant retiré (il reste sur le Tableau et dans Argent), titre redit caché à l'œil (lecteur d'écran) |
| **eBay · Offres illisibles** | « Les offres ne sont pas lisibles. » en texte rouge + bouton isolé « Proposer aux observateurs » | `EtatSite` panne : tuile, titre, phrase, « Réessayer » (le bouton isolé attend que les offres soient lues) |
| **Leboncoin · Messages jamais relevés** | trois lignes de texte + bouton bleu | `EtatSite` : 3 étapes + « Ouvrir Leboncoin » |
| **Vestiaire · Messages jamais relevés** | une phrase grise nue | `EtatSite` : 3 étapes + « Ouvrir Vestiaire ↗ » |
| **Leboncoin · À envoyer** | « Générer le bordereau » plein sur CHAQUE vente + « Générer tous » plein | « Générer tous » reste le seul plein ; chaque ligne garde son geste en touche à contour |

Rien n'a changé dans les données ni les règles (§3 : détourage Vestiaire seul, eBay : l'acheteur paie le bordereau,
jamais « livraison gratuite » — aucun texte ni geste touché là). Tous les textes nouveaux par `tr()` (clés `ss.*`,
`src/i18n/langues/<l>/sitesSoignes.js`, 5 langues).

## 4. Ce que les outils de revue ont trouvé

- **Contrastes (a11y-enforcer:contrast)** : chiffres des étapes sur la teinte 16,4:1 (clair) / 8,8:1 (sombre) ; le logo
  Leboncoin #EC5A13 sur sa teinte à 12 % ne faisait que **2,73:1** (< 3:1 pour un graphique) ⇒ teinte ramenée à 5 %
  (3,28:1 sur la page, le nom du site l'accompagne toujours) ; eBay 4,38:1, Vestiaire 13,6:1. Aucune couleur de marque
  n'est posée sur un texte (Leboncoin en texte sur blanc ferait 3,48:1 — refusé).
- **Critique (design:design-critique)** : 1er regard = la tuile + le titre (juste) ; défaut relevé et corrigé : le
  montant des ventes répété sous chaque section eBay (deux choses principales par écran) ; défaut relevé et RESTANT :
  la carte « Données · Voir le détail » (`BilanSynchronisation`, commune à d'autres écrans) est rognée en haut dans
  Comptes eBay — à reprendre avec son propriétaire ; « À traiter » garde des lignes de texte nu (« Annulations : pas pu
  les lire. ») et la Promotion un paragraphe d'explication — prochain lot.
- **Textes (design:ux-copy)** : titres = ce qu'on voit (« Offres eBay », « Santé du compte eBay »), lignes = à quoi ça
  sert, une phrase ; les états disent ce qui manque PUIS le geste, jamais « erreur ».

## 5. Preuves

- `scripts/bancs/sites-soignes.cjs` (nouveau) : chaque page propre aux sites (21), 390 tactile et 1512, clair / sombre,
  base de volume / vide / panne (`BASES=panne`). Relève pleins, cibles < 44, contrastes, textes cassés (débordement, mot
  coupé), tête native (`tete: true` : les sections eBay et la connexion ; une LISTE n'en a pas — AJOUT 3 de vrm-design).
  `SEUIL=1` rouge si > 1 plein, une cible trop petite, un texte cassé ou une tête manquante ; `MUTATION=plein|tete`.
  Captures AVANT : `BANC_DIST=<build d'origin/main>` ; APRÈS : le `dist/` de la branche.
- Audits verts : tdz, variables, traduction (45), coherence, icones, quoi-de-neuf, identite ; banc `detourage-reglage`.
- Bancs eBay existants : voir le rapport de PR (mêmes rouges avant et après sur `ebay-complet` / `ebay-comptes` :
  leurs sélecteurs datent d'avant le mélange des sites du 20 nov. — `data-poster`, `selectOption` du compte).

## 6. Reste à faire

- « À traiter » (retours, annulations, historique) et la Promotion en rangées natives (mêmes lectures, aucune règle).
- La carte `BilanSynchronisation` rognée dans Comptes eBay (composant commun).
- Recherches et alertes eBay (feuille poussée) : déjà natives, une tête de site possible.
