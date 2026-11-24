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
Voir la section « Résultats » ci-dessous (remplie à la fin du lot).
