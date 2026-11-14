# Refonte Messages · E-mails · Stock — 14 nov. 2026

Branche `claude/refonte-messages-stock`. Julien : « toute l'application, change totalement, dramatique »,
puis « imagine si j'ai 1000 articles », puis (AJOUT 3, captures Annonces) « la liste arrive après
1,5 écran ». Ordre suivi quand deux règles se contredisent : AJOUT 3 (liste d'abord) > AJOUT 2 (1 000)
> direction Atelier. **Forme seulement** : aucune règle métier, aucun chiffre calculé autrement, rien
supprimé — on déplace, on replie, on hiérarchise.

## Ce qui était laid (mesuré sur une base inventée de 1 000, origin/main)

| écran | avant (390 × 844) |
|---|---|
| Stock | 1re paire de la liste à **1 541 px** (presque deux écrans) : la carte « au moins N en ligne » + quatre capsules grises + un `select` « Tous les comptes », la carte « Comment marche le Stock » (dessin), les cartes valeur / emballages / inventaire de l'année, puis la liste ; rangées de 101 px ; deux boutons capsule pleine largeur sous le titre ; une carte « — » (valeur du stock) ; 7 rangées visibles |
| E-mails | 1re rangée à **510 px** ; tout dans une carte blanche (champ, rubriques, compte) ; rangées de 150 px (le code de retrait sur sa propre ligne en dessous) ; 6 rangées visibles ; recherche 461–748 ms (350 ms d'attente avant de chercher) |
| Messages | phrase d'explication sous le titre ; aucune recherche (1 000 fils, 80 montrés) ; rangées de 86 px ; la question « Peut-être la même paire ? » en carte au-dessus de la liste ; fil : barre plate, bulles grises sans forme, l'information « Les offres se font depuis le navigateur… » en 28 px gras dans une carte |

Captures : `docs/design/avant-apres/{messages,emails,stock}-{avant,apres}.png` (390, dsf 2, clair, données
inventées).

## Ce qui a changé

**Commun** — les briques de `src/ui` (reprises de `claude/refonte-listes` : `BandeChiffres`, `MenuCompte`,
`BarreOutils` + `BoutonIcone`, `Filtres`, `LigneAFaire`, `Feuille`, et leurs textes `listes.*`) et les jetons
« §4 Atelier » de `src/styles-systeme.css` (repris de `claude/refonte-coque`). Une feuille de style à part,
`src/styles-refonte-ms.css` (importée après la tablette, couche `vrm-premium`), qui ne vise que les classes
des trois écrans. La phrase sous le titre disparaît, le « ? » reste à côté du titre. Textes nouveaux :
`ms.*` dans `src/i18n/langues/<l>/refonte-ms.js` (5 langues).

**Stock** (`src/ecrans/Stock.jsx`, `StockMeubles` et `Garage`) — l'ordre : titre + « ? » + deux icônes
(Trouver par photo, Faire l'inventaire) sur UNE ligne ; une bande de chiffres (`BandeChiffres` : en ligne
— « au moins » à côté du chiffre —, rangées, à ranger) ; les puces d'état sur une ligne + le compte en UN
menu (`MenuCompte`) et les plateformes en petites capsules (`Filtres`) ; la recherche collée ; UNE ligne
« À faire · N › » (`LigneAFaire`) dont la feuille nomme chaque chose (ventes à sortir, retours, plus en
ligne, rangements pas vérifiés, cases libérées, à ranger) et y mène ; **la liste** (groupe blanc, rangées
de 68 px fixes, vignette 52, le N° en pastille encre, UNE sous-ligne texte) ; puis « À faire » (les blocs
d'avant, intacts, avec leurs gestes et la sélection en série), « Mes meubles » (la vue 2D, la bande « à
ranger », le glisser, « Comment ça marche »), « Plus » (valeur, emballages, inventaire de l'année). La
barre « Range N° … touche une case » reste collée en haut de page (elle sert depuis la liste).

**Messages** (`src/ecrans/FilsTous.jsx` + classes partagées des fils) — une recherche collée (pseudo,
modèle, N° ou mot du dernier message, filtrée ICI ; l'ordre des fils inchangé) ; les questions « Peut-être
la même paire / le même acheteur ? » dans « À relier · N › » (la feuille montre la question du moment et
SES deux gestes ; rien n'est relié sans son clic) ; rangées de 72 px (photo de la paire 52, pseudo 16/600
— 700 non lu —, heure à droite, « modèle · N° » sur une ligne, le dernier message sur une ligne, point bleu
non lu à gauche) ; les 12 premières apparaissent en ressort court. Le fil : barre du haut en matériau
translucide, bulles nettes (moi : encre ; l'autre : gris clair, rayon 20, coin de queue 6), l'offre en
carte centrée au montant à l'encre, la saisie et les réponses rapides (petites capsules qui défilent)
collées en bas en matériau ; l'information « Les offres se font depuis le navigateur… » redevient une
ligne grise. ⚠️ « Messages, comptes SÉPARÉS » (§3) : l'ordre des listes n'est pas touché (Vinted : compte
de l'onglet d'abord, puis chaque autre, du plus récent au plus ancien dans chaque groupe). Leboncoin :
VRM n'écrit à personne — rien de changé.

**E-mails** (`src/BoiteEmails.jsx`) — la carte autour de la boîte disparaît ; « Boîte de réception · Relier
ma boîte » en contrôle segmenté de 32 px ; le champ de recherche collé (36 px) ; rubriques en capsules de
34 px (la choisie à l'encre) ; le compte et « Sélectionner » sur une ligne ; les jours en en-têtes 13 px
gris ; rangées de 72 px (le code de retrait à DROITE de la rangée, gros chiffres, copiable) ; recherche :
150 ms au lieu de 350 avant de demander à la route, et pendant ce temps l'aperçu LOCAL des e-mails déjà
lus qui contiennent le mot (comme Mail) — la réponse de la route le remplace ensuite.

Références (skill `references-design`, principes seulement) : la densité et la retenue d'un client mail
« outil pro » (une rangée = qui · quoi · quand, le non-lu en graisse, aucune couleur sauf l'action), et les
listes denses à vignette des apps de réservation (photo à gauche, une ligne de méta). Aucune identité
reprise ; le violet de ces références est refusé (§3).

## Preuves

- **Banc** `scripts/bancs/refonte-messages-stock.cjs` (+ base `_base-messages-stock.cjs` : 1 000 conversations
  sur 3 comptes à longs pseudos, 1 000 e-mails servis par la vraie forme de la route, 1 000 paires numérotées).
  Forme (390 et 1512, clair et sombre) : 1re rangée ≤ 50 % de 844, pas de carte « — », ≤ 1 bouton plein
  accent, pas de rangée de > 3 capsules grises ≥ 44 px, rien de fixe posé sur la liste après 3 s, ≥ 8 rangées
  entières. Volume (390, `BANC_REF` = dist d'origin/main) : rendu (de la coque à la 1re rangée, le meilleur
  de deux ouvertures), nœuds, CLS en défilant jusqu'en bas, recherche < 300 ms.
  - origin/main : **13 défauts** (Stock 1re rangée à 1 541 px, 7 visibles, carte « — » ; E-mails 510 px,
    6 visibles, recherche 461 ms ; Messages sans recherche).
  - après : **vert**, forme 0 défaut sur les 12 cas ; volume (machine très chargée, charge 50–60) :
    Messages 9 visibles (8 avant), recherche ~80–250 ms ; E-mails 9 visibles (6), recherche ~230 ms ;
    Stock 9 visibles (7), recherche ~70–200 ms, CLS 0, nœuds +2 %.
  - **mutation** : remettre la carte « Comment marche le Stock » au-dessus de la liste (ordre d'avant)
    ⇒ `premiere` rouge ; rendre la hauteur des rangées libre ⇒ voir la passation du banc (résultat noté
    ci-dessous).
  - La pastille « Mis à jour à … » de la COQUE est dite à part (« hors de ce banc ») : son chantier est
    `claude/refonte-coque` (elle n'y vit que 2 s).
- `fil-unique.cjs` : ouvre la feuille « À relier » avant de lire les questions (même règle jugée).
- Audits verts : traduction, tdz, icones, coherence, variables, composants, violet, rouge-doublon,
  quoi-de-neuf. Bancs rejoués : voir le rapport de fin de session.

## Restes / à reprendre

- Quand `claude/refonte-listes` et `claude/refonte-coque` fusionnent, garder UNE copie de `src/ui` et de
  §4 (les nôtres sont leurs fichiers, tels quels).
- Messages · Vinted (le site seul) garde sa composition d'avant au-dessus de la liste (sélecteur de compte,
  favoris, synchronisation) : les rangées et le fil y prennent déjà la nouvelle forme.
- Le temps de rendu à 1 000 est bruyant sur une machine partagée : le banc prend le meilleur de deux
  ouvertures et compare à une marge (+25 % et +250 ms).
