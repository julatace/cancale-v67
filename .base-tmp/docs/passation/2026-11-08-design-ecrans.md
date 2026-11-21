# 8 nov. — Design 2026, passage 2 : le système appliqué aux écrans

Branche `claude/design-ecrans` (partie de `claude/amazing-lovelace-xd7obl`, qui porte les
fondations du 7 nov.). Pas de PR : le coordinateur fusionne.

## La demande

Julien : « améliore le visuel de tout le site, du petit message à la structure, je veux que
tout soit mieux, là c'est vraiment pas beau ; je t'ai installé des skills, sers-t'en ». Style
Apple GARDÉ en beaucoup mieux, iPhone ET ordinateur, « outil pro calme » (Réglages, Mail,
Wallet). Le premier passage a été jugé trop timide : le gain doit se voir au premier coup
d'œil, en restant calme et natif.

Skills : `impeccable` (polish, mode Operate, `craft-floor` lu avant chaque retouche),
`apple-design` (groupes, matières, échelle), `emil-design-eng` (appui, survol à la souris
seulement, durées), `mobile-native` (pas de survol collant, contrôles non sélectionnables),
`ux-copy` (aucune phrase réécrite : seules les voix — taille, graisse, couleur — ont changé ;
aucun FAIT ni chiffre touché). **Aucune question posée** : agent sans interlocuteur —
PRODUCT.md, DESIGN.md et le brief en ont tenu lieu.

## La méthode

Une section par écran dans `src/styles-design-2026.css` (§6 à §16), jetons `--d-*` seulement,
sélecteurs `:root:root body .vrm-app-shell .vrm-main …`. JSX touché seulement là où la
structure l'exigeait, sans changer un texte ni une donnée :
- `data-vide` sur les valeurs saisissables de la carte d'annonce (achat, accepter dès,
  refuser sous, boost) — pour griser un « — » à saisir ;
- `className="vrm-acct-tag"` sur `AcctTag` ;
- `className="vrm-recherche-num"` sur la pastille de N° de la loupe.
DESIGN.md : six composants ajoutés (rangée de liste, état d'une rangée, feuille groupée,
bandes de chiffres, champ de recherche, Réglages).

## Ce qui a changé, écran par écran

| écran | avant | après |
|---|---|---|
| **Ventes** | ventes à l'ordinateur flottant sur le gris ; pastille « Vendue » grise sur chacune des 420 ventes ; « À venir » encadrée ; tiroir en traits pleine largeur, trait noir de 1,5 px au-dessus du bénéfice | UNE carte à rangées (téléphone ET ordinateur), filet après la vignette ; l'état en mot gris, « À envoyer » à l'encre avec un point ambre ; « À venir » posée ; le tiroir en feuille groupée (blocs blancs sur le gris, filets, gestes en cartes) |
| **Annonces** | 3 colonnes à l'ordinateur, photo de 475 px (8 écrans pour 72 paires) ; six tuiles de chiffres pleines de « — » ; « Numéros à vérifier » en trait ambre à gauche, deux lignes par article ; « Prochain geste » en étiquette + phrase | 5 colonnes, photo carrée ~220 px ; deux bandes à filets, « — » à saisir en gris ; point ambre, une rangée par article à l'ordinateur (photo · titre · gestes) ; un point ambre devant la phrase |
| **Achats** | rangées 13/600, compte en étiquette cerclée, recherche blanche encadrée | la rangée de Ventes (15/600 sur deux lignes, note 13), compte en mots, recherche d'iOS |
| **Messages** | filtres sur deux lignes ; pastille « Question » cerclée ; heure en chasse fixe ; conversation ouverte = trait noir à gauche | filtres sur UNE ligne avec Actualiser ; commandes resserrées ; liste façon Mail (une carte, filet après la photo), état en mot gris, heure alignée, conversation ouverte = fond |
| **E-mails** | volet de lecture vide = grande carte blanche | les jetons ; le volet vide laisse le fond (dessin + phrase grise) |
| **Compta** | « Quel est ton statut ? » sous le bénéfice, quatre cartes cerclées dans une carte | tant qu'il est vide, le statut passe EN PREMIER (ordre CSS), point ambre ; réponses en liste de Réglages au téléphone, cases grises à l'ordinateur |
| **Statistiques** | tuiles au chiffre moyen, « — » à l'encre | libellé gris, chiffre 20/700 (28 à l'ordinateur, l'échelle jugée par stats-premium), « — » gris ; 5 tuiles sur une ligne à l'ordinateur |
| **Stock** | résumé collé au bord de sa carte ; recherche cerclée d'encre | marge de carte, grand chiffre 34/800 ; recherche d'iOS |
| **Réglages** | noms en gras, phrases en gras gris, icônes nues | Réglages d'iOS : tuile d'icône neutre 30 px (rayon 6), nom 17 régulier, phrase 13 grise, titres de groupe en note ; « À terminer » avec un point ambre |
| **Vestiaire / eBay / Leboncoin** | cartes Vestiaire sans marge (3 px), « Depuis ton ordinateur » en ambre ; états vides encadrés | marges rendues, la note en gris, entrée « Publier sur Vestiaire » pleine largeur ; états vides posés (titre 17/600, phrase grise) |
| **Coque** | loupe : cartes cerclées empilées, N° en rond BLEU sur chaque ligne ; menu Plus en tuiles cerclées ; toast rectangulaire | loupe : une carte par groupe, filets, N° en pastille à l'encre ; tuiles posées ; toast en capsule flottante ; feuilles au rayon 24 |

Pas fait (reste pour le suivant) : Vinted (écran de site = Ventes/Annonces filtrées, couvert
par eux) et Communauté (carte des revendeurs : rien de lu au banc, pas jugeable) gardent leur
forme ; la barre latérale et la barre du bas n'ont pas bougé (déjà conformes à DESIGN.md) ;
les squelettes et confirmations aussi ; le compteur bleu « À ranger · 84 » du Stock (bleu
non rare) ; « 1645 € » sans espace dans Statistiques (formatage d'un chiffre : pas touché).

## Avant / après (données inventées, `_base-volume.cjs` corrigée `numero`)

Dossier : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/design-2/`
(`cap.cjs`, `avant/` = branche de départ, `apres/` = cette branche ; 390 tactile et 1512,
clair et sombre ; `m/` = planches côte à côte). Boîte e-mails : `avant/bm/`, `apres/bm/`
(captures du banc `boite-mail`).

| écran | avant | après |
|---|---|---|
| Ventes · Tous · 1512 | `avant/ventes-1512-clair.png` | `apres/ventes-1512-clair.png` |
| Tiroir d'une vente · 390 | `avant/tiroirVinted-390-clair.png` | `apres/tiroirVinted-390-clair.png` |
| Annonces · 1512 (long) | `avant/annonces-1512-clair-long.png` | `apres/annonces-1512-clair-long.png` |
| Messages · 390 | `avant/messages-390-clair.png` | `apres/messages-390-clair.png` |
| Compta · 390 | `avant/compta-390-clair.png` | `apres/compta-390-clair.png` |
| Réglages · 390 | `avant/reglages-390-clair.png` | `apres/reglages-390-clair.png` |
| Stock · 1512 | `avant/stock-1512-clair.png` | `apres/stock-1512-clair.png` |
| Statistiques · 1512 sombre | `avant/stats-1512-sombre.png` | `apres/stats-1512-sombre.png` |
| Vestiaire · 390 | `avant/vestiaire-390-clair.png` | `apres/vestiaire-390-clair.png` |
| Loupe · 390 | `avant/loupe-390-clair.png` | `apres/loupe-390-clair.png` |

## Vérifications

Chaque rouge comparé au même banc sur la branche de départ (`git archive`, même machine) :
- verts : ventes-e2, recap-vente (68), vague2-ventes, annonces-carte, annonces-outils,
  achats-hors-plateforme, achats-messages-premium (62), achats-en-route-ordre,
  messages-lisibles, messages-sites, messages-priorite, boite-mail (104), boite-emails,
  stats-premium (42), stock-2d ;
- rouges À L'IDENTIQUE sur la branche de départ (pas à ce passage) : annonces-coherence (8),
  annonces-actions (1), messages-volets (1), compta-claire (4), compta-simple (4),
  statut-fiscal (4), stats-vitrine (6), stats-detail (14), reglages-premium (2), reglages (6),
  stock-finitions (81, pas de WebGL au banc).
- **banc adapté** : `annonces-carte` — « la première photo en grand (≥ 330 px) » devient
  ≥ 200 px à l'ordinateur : la règle (la photo est un carré sur toute la largeur de la fiche)
  est gardée, la mesure suit les cinq colonnes demandées par le brief (« la zone photo vide de
  ~400 px »).
- plateformes et coque : vestiaire, ebay-visuel, ebay-lbc-visuel (82), recherche-universelle,
  coque-mobile (124) verts ; feuilles-coque (25) rouge à l'identique sur la branche de départ.
- transverses : iphone-reprise (139 OK), fluidite verts ; chargement vert (un premier passage,
  machine chargée, avait 1 rouge « Ma journée revient sans clignotement » à 390 — relancé seul :
  vert ; vert aussi sur la branche de départ) ; tous-boutons : 2 défauts, Ma journée à 1512
  (« écran tombé dès l'ouverture » et un texte), au 50ᵉ écran d'un passage de 40 min — relancé
  sur Ma journée 1512 seule : aucun défaut, comme la branche de départ (écran non touché ici).
- audits (`lancer-audits`) : 347 verts ; rouges = ceux déjà rouges sur main (argent-a-venir,
  export-donnees, journee-coherence, politique-hotes, photos-vinted, registres ; chemin-json
  connu) ; audit-violet, audit-icones, audit-boutons, audit-fusion, audit-rouge-doublon verts.
- détecteur `impeccable detect` : deux rayons hors échelle (8 et 10 px) ramenés au rayon de
  pastille ; plus rien.
- `git merge origin/main` (vrai merge), build vert.
