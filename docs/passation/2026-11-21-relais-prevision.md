# 21 nov. — Points relais : prévoir les retraits, Achats · À retirer refait (ext. 5.411.0)

Branche `claude/relais-prevision`. Julien (21 nov.) : « l'extension peut essayer de capter le nom des points relais dans
lesquels les colis vont arriver pour pouvoir prévoir […] une carte avec les colis à aller chercher pour chaque point
relais » ; ses captures iPhone d'Achats (fda7a8e6, 6dabc692, b92d68cb, 9fe873c8, cbe84f77) : « c'est dégueulasse sur
téléphone ». Session reprise après une interruption (commit « En cours (sauvegarde avant reprise) »).

## 1. Ce qui a été MESURÉ (lecture seule, 21 nov., session précédente)

- 49 lignes `harvest_*_suivi_*`, **aucune** avec `relaisNom` : le suivi (`journey_summary`) ne porte aucun lieu, la
  transaction non plus (`shipment` = id, statut). La lecture 5.295 (`relaisdest`) n'a donc jamais rien rangé.
- L'expédition d'une commande (`/api/v2/escrow_orders/{id}/shipment`, vue 744 fois par ses pages) porte
  `pickup_point_name`, `pickup_point_address` (un texte), `carrier.name`, `receiver_id` — et était jetée
  (« forme inattendue », 740 réponses sur 744).
- `journey_summary.estimated_detail.time_period` : un texte (« période d'arrivée ») à côté de `status`, `message`.

## 2. Extension 5.411.0 (fait, commits 97a49f885 et bfa2e749d)

- `relaisDestination` lit aussi la FORME PLATE (`pickup_point_name` / `pickup_point_address`), nom exigé.
- Voie passive (la page reçoit l'expédition) : un contrat SANS étape qui ne range que le lieu et le transporteur ;
  le DESTINATAIRE (`receiver_id`) doit être le compte de l'onglet (une vente porte le point de l'acheteur) ; la
  transaction est trouvée par IDENTITÉ (`transaction.order.id` de SES transactions rangées, une seule, sinon rien).
- Voie active (`capterSuivisAchats`) : un achat EN ROUTE sans point lit l'expédition de SA commande (l'id de commande
  lu dans SA transaction rangée, jamais deviné), une lecture de plus dans le budget « suivi » (6/h, une requête à la
  fois, compte de l'onglet, rien dans le plafond d'actions) ; un refus (429/403) arrête la visite.
- La période d'arrivée (`arriveePeriode`) rangée telle quelle (60 caractères), dite « selon Vinted ».
- Lire-fusionner-réécrire gardé : relecture de la ligne ratée ⇒ rien d'écrit.
- Capacité `relaisprevu` (5.411.0) dans `EXT_CAPACITES` ; `relaisdest` (5.295) reste la lecture du suivi.
  Le nom demandé était `relaisdest`, mais il existe déjà (une autre version, une autre fonction) : le changer aurait
  menti sur les extensions 5.295–5.410 ; ligne §8 de CLAUDE.md.
- Zips NON régénérés (l'intégrateur le fera, `node scripts/zip-extension.cjs`).

Preuve : `node scripts/audit-relais-dest.cjs` EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) : 28 verts ; sur le
`background.js` de `origin/main` (`--src`) : 10 rouges ; mutations `plate`, `destinataire`, `identite`, `sansEtape`,
`actif` : chacune rouge.

## 3. App — Achats · À retirer, téléphone d'abord

Une liste groupée PAR POINT (`src/natif/RetraitsPoints.jsx`, règles inchangées : `pointsARetirer`, `pickupUnion`,
`src/retraitPreuves.js`) :
- en tête de la liste : « À retirer », les nombres UNE fois (« 2 colis · 2 points · 3 en route »), le scanner d'un colis
  à retirer (le geste du grand chiffre d'avant), « Carte » quand un point a une position LUE ;
- un groupe par point : nom, adresse, horaires LUS, nombre, « Itinéraire » ; chaque colis : vignette, titre complet +
  taille, transporteur, frise des étapes, CODE en grand, QR ; toucher le code ⇒ plein écran pour le guichet ;
- « En route vers ce point » replié dessous, avec la date : lue (« prévu demain »), le texte de Vinted (« selon
  Vinted »), sinon « date d'arrivée pas encore dite » (jamais une date devinée) — `src/relaisPrevision.js` ;
- « Bientôt » : les points où rien n'attend encore mais où des achats arrivent ;
- les achats en route sans point lu : UNE rangée repliée à la fin (avant : une liste de 20 rangées sous les codes),
  avec la raison (extension à jour ou non : `extSait('relaisprevu')`) ;
- la carte des points (`src/natif/CartePoints.jsx`, OpenFreeMap / MapLibre déjà dans l'app, sans clé) sur son toucher,
  positions LUES seulement (`repere` de la liste de points Vinted), jamais un géocodage.

Retiré (captures de Julien) : le grand chiffre « À retirer · 1 » et sa ligne « 1 avec code · 3 à vérifier », « Mode
relais », « Suivi vérifié à l'instant », la liste « EN ROUTE 20 · POINT PAS ENCORE DIT », « Je lis tes colis… » qui
restait (il ne dépend plus que des deux lectures qui manquent vraiment : e-mails de suivi et achats — la liaison encore
en cours ne le laisse plus pour toujours), la note « Je relie encore… », les trois grands logos Leboncoin / eBay /
Vestiaire vides et « Achats Vestiaire : pas encore lus » (aucune section par plateforme, décision du 20 nov. ; un site
n'a de groupe que s'il a des achats, son nom dans le titre du groupe), les trois ronds + / loupe / cube, le menu
« Vinted shop_cancale ⌄ » et le « ? » de l'en-tête, les cases vides des rangées « À régler » d'Achats (icône du groupe,
plus la photo d'un seul élément).

### Les gestes, comptés avant / après (aucun perdu)

| geste | avant | après |
|---|---|---|
| Ajouter un achat | rond « + » de l'en-tête | feuille « ⋯ » → « Ajouter un achat » (`data-v2-principal="ajouter-achat"`, même évènement) |
| Retrouver un colis (scanner) | rond loupe de l'en-tête | feuille « ⋯ » → « Retrouver un colis » (`data-scan-retrouver-bouton`) ; aussi le scanner du champ de recherche |
| Arrivée d'un colis (scanner) | rond cube de l'en-tête | feuille « ⋯ » → « Un colis arrivé : scanner son étiquette » (`data-arv-bouton`) |
| Choisir le compte Vinted | menu « Vinted shop_cancale ⌄ » | feuille « ⋯ » → le même `SelecteurCompte` |
| Aide de l'écran (« ? ») | à côté du menu | feuille « ⋯ » → la même `PhraseEcran` |
| Scanner un colis à retirer | rond du grand chiffre | rond à droite de « À retirer » (mêmes `data-colis-scanner`) |
| Code en grand au guichet | « Mode relais » ou toucher le code | toucher le code (le même `openQrView`) |
| Itinéraire | dans la carte du point | inchangé |
| Détail de tous les retraits | replié en bas | inchangé |

En-tête : 4 contrôles avant (3 ronds + menu, plus « ? »), 1 après. Deux touchers au plus pour chaque geste.

### Aujourd'hui
La carte « À retirer » d'Aujourd'hui porte une rangée de prévision (`data-journee-prevision`) : « Demain : 1 colis chez
RELAIS X » seulement sur une date LUE ; sinon « En route : N colis vers X » ; rien sans point lu. La carte paraît aussi
quand rien n'est à retirer mais qu'un achat arrive.

## 4. Preuves
(complété en fin de session — voir §5)

## 5. Ce qui reste / limites
- La liste des achats elle-même (fda7a8e6) : voir §4 (ce qui a été fait ou non).
- Les vignettes vides de la liste viennent de photos Vinted expirées sur iPhone (pas d'extension pour les relire) : le
  système `PhotoVinted` n'a pas été touché.

Geste de Julien : installer l'extension 5.411.0 (après l'intégration), passer sur Vinted : les points d'arrivée se
remplissent seuls.
