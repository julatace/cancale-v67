# 24 nov. · Messages : la conversation refaite (branche `claude/messages-pro`)

**Julien (24 nov., sur la capture `messages-B-390-clair` de #1364)** : « C'est vraiment pas ouf, ça fait encore beaucoup trop
[vieux]. Je veux vraiment quelque chose fait par un professionnel du design… parfaitement, parce que c'est ça qui va jouer
sur l'application. »

Base : `origin/claude/agir-tout` (#1374, qui contient #1364) + `origin/main` + `origin/claude/visuel-jeu` +
`origin/claude/style-graphite` (famille de boutons, demandé par le coordinateur). La PR passe **après #1374**.

**Affichage seulement.** Aucune règle ne change : la porte (`src/agir/peutAgir.js`), Accepter qui DEMANDE (il vend la paire),
rien ne part sans son toucher, l'identité de l'offre (tx + offer_request_id) et de la paire (item_id), « pas su » ≠ 0.

## Ce qui n'allait pas (la capture de Julien)
- le pied (offre + réponses rapides + champ) prenait tout l'écran : **le fil n'était plus visible du tout** ;
- un bord doré autour de l'offre (orange interdit) ;
- « Prix affiché 85 € · Ton minimum — · Minimum non renseigné » : jargon, tiret, tassé ;
- « Prix d'achat pas saisi : le plancher n'est pas calculé. Saisir le prix d'achat », coupé au centre ;
- une phrase juridique « Ta réponse part sur Vinted, au nom du compte de l'onglet. Rien ne part sans ton toucher. » ;
- la raison « Onglet sur boutique_a : ouvre Vinted sur atelier_b » écrite **trois fois** (sous Accepter, sous Refuser,
  sous Envoyer) ;
- les réponses rapides en gros blocs de texte, un champ gris géant « Lecture seule », un « Envoyer » gris.

## Ce qui est fait
| pièce | avant | maintenant | où |
|---|---|---|---|
| lecture seule | la raison sous chaque bouton (3×) | **UN bandeau** en tête du fil : cadenas, « Lecture seule », la raison de la porte, « Ouvrir Vinted » (quand le geste est d'ouvrir le site) ; les boutons éteints ne la répètent pas (`decrit` ⇒ `aria-describedby` vers le bandeau) | `BandeauLectureSeule`, `BoutonAgir decrit` (src/agir/Agir.jsx) |
| l'offre | dans le pied, bord doré, tableau prix/mini | **une carte dans le fil**, à la place de l'évènement de l'offre (comme Vinted) : « Offre de **70 €** », 85 € barré, l'acheteuse et l'heure ; Refuser · **Accepter 70 €** côte à côte, « Proposer N € » en discret dessous | `CarteOffre` (src/agir/CarteOffre.jsx), `carteOffreDuFil` (Comptabilite.jsx), `GestesOffreVinted` |
| marge | phrase « plancher » | **une puce** : « +24 € de marge » (offre − prix d'achat − frais connus, `margeFacePlancher` = la même règle que le bénéfice), « Au plus +24 € » si les frais ne sont pas tous confirmés, « 8 € à perte » (contour ardoise, gras — jamais orange ni rouge) ; la phrase entière en titre ; prix d'achat pas saisi ⇒ le lien « Ajouter le prix d'achat », **aucune marge** | `LignePlancher puce`, `margeFacePlancher` (src/plancherOffre.js) |
| prix mini | « Ton minimum — / Minimum non renseigné » | une puce seulement s'il est posé : « Mini 75 € atteint » / « 5 € sous ton mini » ; pas posé ⇒ rien | `CarteOffre` |
| réponses rapides | blocs de texte + titre + note | **puces défilantes** au-dessus du champ (le NOM de la réponse ; le texte entier va dans le champ au toucher, rien ne part) ; seulement quand on peut répondre | `ReponsesRapidesApp puces` |
| champ | textarea 64 px + « Envoyer » plein largeur | **pilule** qui grandit (1 → 5 lignes), bouton rond d'envoi (icône, nommé), 16 px (pas de zoom iPhone) ; lecture seule ⇒ **une barre fine** « Réponse désactivée » (la raison est dans le bandeau ; sans bandeau — Leboncoin, Vestiaire — la barre dit la raison elle-même, une fois) | `ComposerReponse` |
| phrase juridique | sous la carte | retirée de la carte (la confirmation d'Accepter dit déjà « Accepter vend la paire ») | — |

L'ancienne note « Lecture seule — pour répondre, ouvre vinted.fr… » (règle locale `msgLectureSeule`) ne se montre plus que si
la porte, elle, laisse agir (`SiAgir`) : jamais deux « Lecture seule » à l'écran.

Styles : `src/agir/agir.css` (classes neuves `vrm-mp-*`, que les couches d'avant ne touchent pas), jetons natifs seulement
(`--n-*`, `--g-*` de la famille Graphite quand un style est choisi : `data-n-famille="second"` sur « Ouvrir Vinted » et les
puces), grille de 4 pt, cibles 44 px, clair et sombre. Textes : `mpro.*` dans `src/i18n/langues/{fr,en,es,it,de}/messagesPro.js`.

## Preuves
- `scripts/bancs/messages-pro.cjs` (vraie app, faux Supabase à état, 390 tactile et 1512, clair et sombre ; A connecté +
  offre + prix d'achat 40 € + 6 € de frais confirmés · B lecture seule + offre + prix d'achat inconnu — l'état exact de la
  capture de Julien · A sans offre, fil de 30 messages) : **116 verts, 0 rouge**. Jugé sur les data-* et la base :
  raison écrite UNE fois (bandeau) et aucune `[data-n-raison]` sous les boutons ; « Ouvrir Vinted » ; Accepter/Refuser
  éteints ; barre fine (aucun champ) ; « Ajouter le prix d'achat » et AUCUNE marge sans prix d'achat ; « +24 € de marge »
  (2400 centimes) avec ; carte dans le fil ; une bulle au moins visible ; aucun orange dans les couleurs CALCULÉES (texte,
  fond, bords, ombre, contour) ; cibles ≥ 44 px ; aucun débordement ; toucher Refuser/Accepter/Proposer/Envoyer sur B ⇒
  aucune `cmd_dist_*` ni confirmation ; une puce remplit le champ sans rien envoyer ; Accepter ouvre SA confirmation et
  rien ne part avant « Oui, accepter » (puis UNE commande au nom de A, pour CETTE offre) ; Envoyer ⇒ UNE `repondre`.
- **Rouge sur la base** (build de `claude/agir-tout` + main) : 10 rouges sur 29 en 390 clair — raison ×3, pas de bandeau,
  champ géant, pas de carte dans le fil, **le fil écrasé (28 px, 0 bulle visible)**, l'orange du bord
  (`rgba(178,106,0,.5)`), pas de marge, pas de puces.
- `--prouve` : 7 mutations du build (raison répétée, champ en lecture seule, marge sans prix d'achat, Accepter sans
  confirmation, orange, petites cibles, débordement), **toutes rouges**.
- `scripts/bancs/agir-si-connecte.cjs` mis à la nouvelle forme (la raison lue dans le bandeau, la barre au lieu du champ
  éteint ; la mutation « champ-allume » visée sur la barre) ; `audit-agir-si-connecte` : 62 verts (le contrôle du champ
  éteint devient « lecture seule ⇒ une barre, envoi par la porte »).
- Audits : traduction 45 verts (5 langues, `mpro.*`), plancher-stock 35 verts (la ligne du fil passe toujours par
  `<LignePlancher plancher={plancherDeItem(itemF,pc?.devise)} … puce>`), quoi-de-neuf vert (et l'ordre cassé par la fusion
  de visuel-jeu remis), icônes vertes, actions-app vert.

## Pièges trouvés en route (pour la suite)
- Les couches d'avant peignent la bulle REÇUE par variables (`--v2-socle`, `--d-bulle-autre`, `--sb-porcelaine`…) qui
  valent le gris du fond en clair : la bulle était invisible (mesuré `rgb(223,225,229)`). Corrigé en posant ces variables
  sur la rangée reçue seulement (`agir.css`, fin).
- L'heure de SA bulle est forcée en blanc par `n-anciens` (!important en couche) : invisible sur la bulle blanche du mode
  sombre. Corrigé par `-webkit-text-fill-color` (la couleur peinte), sans toucher la couche.
- `.vrm-chat-panel button { min-height: 40px }` (styles-mineral) bat une classe seule : les cibles neuves sont écrites
  `.vrm-chat-panel button.vrm-mp-…`.

## Reste / limites
- À 1512 le champ garde un rayon de 12 px (une couche de bureau) au lieu de la pilule ; le reste est identique.
- La carte « annonce partie » (offre plus acceptable) reste l'ancienne, dans le pied (rare) ; Leboncoin et Vestiaire ont
  le nouveau champ (pilule / barre qui dit la raison une fois) mais pas encore de bandeau en tête de leur fil.
- Geste de Julien : aucun. Regarder la capture avant/après.
