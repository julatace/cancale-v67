# 14 nov. — « Studio bleu clair » sur Ventes (À expédier) et Achats (À retirer)

Branche `claude/studio-ventes` (depuis `claude/integration-refonte`). Décision de Julien : la direction t25
« Studio bleu clair » (bleu clair partout, objets posés, actif = enfoncé + diode, QUATRE formes de bouton, un seul
plein par écran, « tout doit être parfait, tu peux changer les dispositions », aucune fonction ne disparaît).
Message de Julien en cours de lot : « je n'ai plus les retraits d'achat, je ne comprends pas, donc dans la nouvelle
version ça doit être mieux » ⇒ « À retirer » en tête d'Achats, ouvert sans toucher.

Le parcours d'impression (branche `claude/impression-simple`) n'est PAS touché : le plein « Imprimer N » appelle
`ouvrirLot`, compte `resumeLot`, porte les mêmes `data-colis-barre-btn="imprimer"`, `data-lot-ouvrir`,
`data-imprimer-prets`. Seuls son habit et sa place changent. `src/retraitPreuves.js` n'est pas touché (un autre agent,
`claude/retraits-achats`, cherche pourquoi des retraits ont disparu en production).

## Avant / après

Captures (données inventées) : `docs/design/avant-apres/studio-ventes-{avant,apres}.png` (390),
`studio-ventes-1512-{avant,apres}.png`, `studio-achats-retirer-{avant,apres}.png`.

| | avant | après |
|---|---|---|
| tête de « À expédier » | intertitre « À expédier » + barre Scanner · « Tout imprimer (3) » bleu · « … » | **le grand chiffre** (Urbanist 200, 88/104 px) « 5 colis à envoyer » + ambre « 2 avant demain » ; **le seul plein** : rond d'encre « Imprimer 3 » (72, 80 sur ordinateur) ; Scanner et « … » en deux ronds de 44 |
| filtres | capsules « Tous · 5 », « Chronopost · 2 »… dans la liste | **tuiles-filtres** sous le chiffre (téléphone : rangée qui défile ; ordinateur : à droite de la tête) : Tous · **Avant demain** · un transporteur par tuile ; la posée est ENFONCÉE + diode ; re-toucher rend tout |
| rangées | carte par colis, « … » + « Imprimer » rond (téléphone) / « Imprimer » (ordinateur), × Masquer | rangée de 64 px (60 ordinateur) dans un **plan de verre** : vignette posée 44 · plaque N° gravée · titre sur une ligne · « attend depuis N j » · **échéance courte à droite** (« demain 12 h », « 9 nov. », « à vérifier ») ; **aucun bouton dans la rangée** |
| gestes d'un colis | sur la carte | la rangée touchée ouvre la fiche au premier plan (proposition 62) : **Imprimer le bordereau** (touche d'encre), Marquer imprimé, Déposé, Masquer, Suivre, J'ai le PDF, Relier, Poser le N°, Générer (BoutonBordereau) |
| Achats · À retirer | replié derrière une ligne « À retirer · N » (fermé par défaut ⇒ « je n'ai plus les retraits ») | **en tête et ouvert** dès qu'un colis attend (à retirer, à vérifier, en vérification : `vrm_colis_retirer`) ; grand chiffre « 1 colis à retirer » + ambre « N d'ici demain » ; un point = une carte posée ; **code en grande plaque** (17/600, +0,07 em) ; « À vérifier » **ouvert** dessous |
| ventes en route / terminées | cartes blanches | le même plan de verre, vignettes posées, encre/encre 2 du studio |

## Inventaire des gestes — chacun à sa place (rien de retiré)

| geste | avant | après |
|---|---|---|
| Tout imprimer (lot, PDF par transporteur) | bouton bleu de la barre | **le plein « Imprimer N »** (même fonction, même compte) |
| Scanner (bordereau / colis à retirer) | bouton « Scanner » | rond 44 en tête (Ventes et Achats), `data-colis-barre-btn="scanner"` |
| Outils (Emballer, Tout générer) | « … » | rond « … » en tête, `aria-expanded` |
| À envoyer · Envoyés | segment | segment creusé, l'actif posé (le nombre d'« À envoyer » n'est plus redit : c'est le grand chiffre, §7) |
| Préparer mes colis · Je dépose · Préparer la tournée | rangée (ordinateur) / « À faire » (téléphone) | inchangé, touches posées |
| Imprimer CE bordereau (+ facture pro) | sur la carte | fiche du colis, touche d'encre pleine largeur |
| Marquer imprimé · Déposé · Suivre · J'ai le PDF · Relier · Poser le N° · Générer | sur la carte | fiche du colis (DansFiche, mêmes éléments, mêmes data-*) |
| Masquer un bordereau | × de 32 px (caché en section par fusion.css : injoignable) | **touche « Masquer » dans la fiche** (`data-geste="masquer"`) — rendu joignable |
| Colis fait au glisser | rangée | inchangé |
| Où sont ces articles dans le stock | sous la liste | inchangé |
| Mode relais · J'ai retiré · QR (Vinted Go prouvé, Pickup Pass) · Ajouter un QR Mondial Relay · Itinéraire · Masquer un point | À retirer | inchangés, À retirer en tête |
| Achats : relier, reçu, code, suivre, note, facture, revente, étiquette, masquer | « … » de la rangée + fiche | inchangés (la refonte d'Achats du 14 nov. reste la base) |

## Règles tenues

- Aucun chiffre neuf : le grand chiffre = la publication `vrm_colis_aposter` (« au moins » si un site n'est pas lu),
  « — » si pas lue ; Achats = `vrm_colis_retirer.total`, ambre = `.urgents`.
- « Avant demain » : UNE règle (`avantDemainColis`, App.jsx) sur LA liste de l'écran (`colisAEnvoyerBase`, celle de
  « Tout imprimer ») : limite d'aujourd'hui ou demain, ou LUE et passée. **Une date estimée dépassée n'est jamais
  « en retard »** : hors du compte, et l'échéance courte dit « à vérifier ».
- Les colis douteux restent visibles (« À vérifier » ouvert), aucun colis caché par un filtre (une tuile qui ne
  filtre plus rien revient à « tous »).
- Rouge : seulement le doublon de N° (la plaque N° studio ne s'applique pas à un `Numero` marqué `data-num-etat`).
- Tout texte neuf par `tr()` : `src/i18n/langues/{fr,en,es,it,de}/studioventes.js`.

## Technique

- `src/design/StudioVentes.jsx` : `TeteStudio`, `BoutonPlein`, `Rond`, `TuilesFiltres`, icônes au trait 1,5 px.
- `src/design/studio-ventes.css` : jetons et formes du contrat (`sb-*`) **marqués « provisoire : vient de
  studio.css »** — à retirer quand la fondation est fusionnée (le rouge `--sb-doublon` n'y est pas défini :
  audit-rouge-doublon, la fondation le pose).
- **Couche `vrm-studio`** : sous Ventes/Colis, `vrm-premium` pose ses règles `!important` DANS une couche, qui
  gagnent contre tout `!important` hors couche. L'ordre `@layer vrm-studio, vrm-premium;` est posé en tête
  d'`index.html` (premier `<style>`, avant toute feuille) : pour `!important`, la couche nommée la première gagne.
  Tout ce qui est dans la couche est `!important` (une déclaration normale en couche perd contre les feuilles hors
  couche). Les composants `sb-*` neufs restent hors couche.
- Fond bleu clair : `body:has(.vrm-tache[data-espace="ventes"])` — provisoire, la fondation le pose pour toute l'app.
- `data-espace="ventes"` sur la racine de Ventes et d'Achats (`rendreTache`).

## Preuves

- `npm run build` ✓.
- Audits verts : traduction, tdz, variables, coherence, composants, violet, rouge-doublon, identite, codes-retrait,
  retrait-fiable, retrait-vinted-go, colis-plus, impression, quoi-de-neuf.
- Bancs verts : `studio-ventes` (NEUF, 96 verts : 390 tactile et 1512, clair et sombre — chiffre, ambre, un seul
  plein, ronds nommés 44, tuiles enfoncées + diode + liste filtrée par identité, rangées sans bouton, échéance,
  rangée ouverte avec ses gestes, chaque geste joignable, AA sur le fond réel, rien ne déborde, À retirer en tête
  et ouvert, code en grande plaque, aucun plein sur Achats), `tout-imprimer` (28), `tout-imprimer-garde` (8),
  `achats-retraits` (84), `refonte-achats` (37), `colis-envoi` (122 — ses 2 rouges d'avant, « En grand » à 36 px
  sur ordinateur, sont réglés), `garde-ecrans`.
- Bancs adaptés (ils jugeaient l'ancienne disposition, dit ici) :
  - `colis-envoi` B « une seule forme de bouton » ⇒ « quatre formes : des ronds de 44 et UN plein (« Imprimer N ») » ;
  - `colis-retirer-propre` « À vérifier · 3 replié » ⇒ « ouvert, juste sous À retirer » (décision de Julien du jour).
- Huit tours capture → correction (chevauchement titre/échéance, rangées de 100–120 px, tuiles prises dans le plan
  de verre, tête alignée à droite, « Imprimer » réduit à 32 px dans la fiche, socle clair des vignettes la nuit…).

## Ce qui reste (à d'autres lots)

- La fiche elle-même (`FichePaire`) garde son « Emballer » bleu plein et ses liens bleus : à l'agent qui l'habille.
- Rangées d'Achats : le « … » et les ronds rapides restent sur la rangée (huit bancs les touchent : recu-achat,
  facture-achat, photos-achats…) ; leurs gestes sont déjà dans la fiche (`DansFiche`) — les retirer de la rangée
  demande d'adapter ces bancs.
- La bande de chiffres d'Achats peut redire « À retirer · N » (case réglable de la carte) sous le grand chiffre.
- Sur ordinateur, la rangée s'ouvre en fiche (la fiche unique choisie par Julien, proposition 62), pas en carte
  dans la liste comme la maquette C.
- Polices Urbanist / Inter : chargées par la fondation (`studio-polices.css`) ; ici, repli système.
