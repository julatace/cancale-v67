# 5 nov. — Revue de cohérence de toute l'app (avant les chantiers d'interface)

Julien : « on dirait tu fais des trucs incohérents au possible, fais tout parfaitement,
de belles interfaces ». Revue en lecture seule de `origin/main` (7ca87761) : 176
captures (390 tactile et 1512, clair et sombre, données inventées), script
`scratchpad/coherence/revue.cjs` (hors dépôt). Le banc `nouveau-vendeur` est vert
(632/632) : aucun des défauts ci-dessous n'est vu par un contrôle automatique.

## Vocabulaire retenu (décidé le 5 nov. pour avancer ; Julien peut changer un mot)
Une constante par notion dans `src/libelles.js` :
- colis à faire partir : **« à envoyer »** partout (plus « à poster », « à expédier ») ;
- colis en chemin : **« En route »** partout (plus « En transit ») ;
- colis arrivés : **« Arrivés »** ; « Reçu » réservé à l'ARGENT ;
- **« Vendu »**, **« Bénéfice »** (sans « brut » dans un titre), **« Compta »** ;
- **« Statut »** (plus « Régime fiscal ») ; **« Favoris »** ; **« Comptes liés »** ;
- un seul écran **« E-mails »** (le sous-écran de Paramètres devient « Relier ma boîte »).

## Gravité 1 — partout
1.1 Deux bleus d'accent (`C.accent` #0066CC/#409CFF texte NOIR en sombre, contre
`--fu-bleu` #0071E3/#0A84FF). ⇒ `themeMineral.js` : aplats `accent` #0071E3 / #0A84FF,
`onAccent` blanc ; jeton `accentTexte` (#0066CC / #409CFF) pour les liens seulement ;
`design/fusion.css` : `--fu-bleu: var(--vrm-accent)`.
1.2 Plusieurs mots pour une chose (voir le vocabulaire ci-dessus).
1.3 Segmenté écrasé (aucun padding latéral à 1512 ; « Semaine » coupé au téléphone) :
`.vrm-seg-btn` redéfini dans 6 feuilles ⇒ UNE règle dans `styles-coque.css`
(padding-inline 14 px, hauteur 36/44, un rayon). `SelecteurSites` : icônes seules, le
nom seulement sur le site actif (plus « eBay eBay »).
1.4 Quatre écritures des montants (`fmt`, `fmtE`, `fmtE0`, `prixTxt`) ⇒ une fonction
`montant()` dans `src/format.js` (centimes seulement s'ils existent).
1.5 `tabular-nums` posé sur du texte (« Nike XT - 6 », « E - mails ») ⇒ seulement sur
les nombres ; retirer les polices mortes (Inter, Space Grotesk, Bricolage, Geist).
1.6 Rouge hors doublon de N° : 88 usages de `C.danger` ⇒ `danger` = ambre ; nouveau
jeton `doublon` (rouge) seulement pour `dv==='num'` ; un audit interdit le rouge ailleurs.
1.7 « 0,00 € » qui veut dire « pas su » (Reçu · mois, Comparer, À déclarer sans statut)
⇒ « — » avec la raison.
1.8 Cinq dessins de champ de recherche ⇒ composant `ChampRecherche` + `.vrm-recherche`.
1.9 Feuilles faites main (36 calques fixes contre 15 `SheetShell`, trois croix) ⇒
`SheetShell` unique (poignée, titre, croix icône 44 px), variante lumineuse pour « En grand ».
1.10 Cinq dessins d'état de panne ⇒ composant `EtatPanne({quoi, onReessayer})`.
1.11 Structure (787 `<button>` bruts, 65 feuilles CSS, `Comptabilite` de 18 000 lignes) :
chantier à part, plus tard, seul.

## Gravité 2 — par écran (résumé ; détail dans le rapport de revue)
- **Ma journée** : « 5 gestes » pour 6 cartes (Vendus ailleurs pas compté) ; carte
  Semaine sous l'arrondi ; carte sombre fondue en mode sombre ; libellés d'action
  différents pour « voir » ; même icône pour trois choses.
- **Annonces** : trois chemins pour republier avec des mots différents ⇒ une seule
  feuille d'actions (Republier · Modifier prix ou titre · Mettre en brouillon · Mettre
  en ligne) ; carte d'ordinateur à 9 boutons ⇒ deux gestes + « … » ; « Prix d'achat »
  ambre sur chaque carte ⇒ un bandeau « Prix d'achat · 0/12 → Compléter » ; quatre
  vignettes sans photo ⇒ `PhotoVide` ; la pastille N° change de forme ⇒ `Numero` /
  `.vrm-num` (jamais blanche en sombre) ; barre d'outils au téléphone.
- **Ventes** : « Modifier » chevauche la carte sombre ; le même montant trois fois ;
  l'état coupé au téléphone ⇒ sur sa ligne ; phrases permanentes inutiles.
- **Achats** : carte sombre ET grille disent la même chose ⇒ supprimer la grille ;
  Fournisseurs / Délai / Lots dans « … » ; point vert hors palette ; filets.
- **Colis** : la frise contredit l'état (« Livré » en encre pour un colis en route) ;
  « 2 » cinq fois et tuiles à 0 ; titre d'une ligne à retirer = l'article ; barre du
  haut qui saute ; « En grand » : titre au vouvoiement (sujet d'e-mail), phrase en
  double, emoji, bouton de 36 px ; liste « À retirer » arrêtée à 900 px.
- **Messages** : filtres en contour (ailleurs pleins), liens de pied, colonne de
  275 px à l'ordinateur ; glyphe ♡ au lieu de l'icône.
- **E-mails** : deux écrans ⇒ un seul.
- **Statistiques** : segment au-dessus du titre ; 7 cartes vides sur 12 ⇒ repliées.
- **Compta** : carte blanche vide (anneau sans données) ; statut choisi à 4 endroits ;
  survol collé au toucher (`@media (hover:hover)`).
- **Coque** : cinq icônes sans libellé dans l'en-tête du téléphone ; l'œil sert à deux
  choses ; mode stream et œil presque pareils ⇒ fusion ; panneau de la pastille
  contradictoire ; fraîcheur dite à cinq endroits ; Paramètres (icônes réutilisées,
  « Organisation » encore listée, carte-dans-carte) ; icônes de navigation partagées
  (Ventes = Achats = Vestiaire) ; filtre actif blanc en sombre.

## Gravité 3 — détails
Casse des tuiles ; surtitres au hasard ; « ... » ASCII ; chevrons sous le texte ;
zéros inutiles ; cloche sans poignée ; « + Créer » contre « + Ajouter ».

## Chantiers
A jetons et formes de base · B composants partagés (`SheetShell`, `Bouton`, `Segmente`,
`ChampRecherche`, `PhotoVide`, `Numero`, `EtatPanne`, `format.js`, `libelles.js`) —
A et B d'abord ; puis en parallèle C Annonces · D Colis · E1 Ma journée · E2 Ventes et
Achats · F Compta et Statistiques · G Messages, E-mails, Communauté · H Coque,
navigation, Paramètres. I (découpage de `Comptabilite`) plus tard, seul.
