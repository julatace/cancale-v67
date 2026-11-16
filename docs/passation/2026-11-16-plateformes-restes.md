# 16 nov. — Lot `plateformes-restes` (points 38 à 43)

Branche `claude/plateformes-restes` (partie de `origin/main` b8f26f36d). Extension **5.397.0** (réservée dans
`versions-reservees.txt` : 5.394 traduction-restes, 5.395 extension-restes, 5.396 extension-robuste).
Aucune écriture dans la vraie base : toutes les mesures ci-dessous sont des `select` projetés (jamais `select=data`
sur une ligne lourde).

## ÉTAT À LA REPRISE

Fait et poussé : 38, 39 (« Vendu ! » d'après ce que VRM lit, pas d'e-mail), 40 (en partie), 41, 42, 43. **Aucun
lecteur d'e-mail inventé** : aucune forme d'e-mail de vente ou d'achat Leboncoin / eBay / Vestiaire n'existe dans la base.
La notification « achat arrivé » n'est PAS faite : elle contredit deux décisions de Julien (voir 40).
**PR #1188 ouverte, NON fusionnée** (règle de Julien du 16 nov. : zéro rouge, y compris ceux déjà sur `main`).
Les rouges de la CI de la PR sont tous déjà sur `main` (vérifiés un par un en local, et en remettant le fichier de
`main` à la place du mien quand le lot y touchait) : audits `benefice` (identifiants déclarés deux fois entre
App.jsx et src/ecrans — `partageFichiersPossible` dans Republier.jsx, `joursAvant`), `dates-paris` (soldes.js,
recherchePhrase.js…), `numeros-clenum` (aRetirerAilleurs.js), `config-facture` (« le carton » dans des textes),
`ebay-colis`, `extension-capture` K2, `lien-vc`, `conseils`, `journee-coherence`…, banc `nouveau-vendeur`
(cibles 44 px, Paramètres), `regles` (`lot-preparation-reprise` : `React` absent de sa VM), `comptes-et-reception`,
`achats-sourcing`. Aucun ne vient de ce lot. À reprendre : quand `main` est revenu au vert (lots « rouges »),
vrai merge de `origin/main`, repousser, attendre la CI, fusionner.
Reste aussi : les gestes de mesure listés en bas.

## Ce qui a été mesuré (lecture seule, 16 nov.)

| quoi | résultat |
|---|---|
| e-mails non reconnus (`email_inconnu_*`, 2 054) d'un expéditeur Leboncoin / eBay / Vestiaire | 29, **aucun de vente ni d'achat** : publicités eBay, « L'objet … a été mis en vente », « Un nouvel appareil… », eBay Developers, Leboncoin « Suppression de vos annonces », « Boostez… », « 2 annonces ont besoin de vous », « Nouvel appareil détecté » |
| index des e-mails (`email_reception_*`, 1 528 depuis le 21 oct.), quarantaine (598), textes (1 058) | les mêmes 5 publicités eBay ; 2 textes qui citent eBay (publicités) ; rien de Vestiaire |
| `email_sale_*`, `email_achat_*`, `email_final_*`, `email_track_*` | 0 ligne qui parle de Leboncoin, eBay ou Vestiaire |
| `lbc_ventes` (vendeur principal) | 3 ventes (`isSeller: true`) et 7 achats (`false`) avec bordereau ; **`label.reference` = le `exp=` du lien Mondial Relay, 8 chiffres, 9 cas sur 9** ; côté achat, `prixListe` (total payé) ≥ `price` (article) sur les 7 |
| `vc_achats` | **la ligne n'existe pas** : aucun achat Vestiaire relevé |
| `lbc_catalogue` | formulaire de dépôt capté pour la seule catégorie **53 « Chaussures »** (15 oct.) ; `fforms` v5 du 28 oct. ; rien de neuf |

## 38 · La douchette reconnaît eBay et Leboncoin (par identité)

- `src/douchette.js` : `lignesAutresSites({ ebay, lbc, numEbay, numLbc, engagee })`. eBay : n° de commande
  (`orderId`, `legacyOrderId`) et le SKU « VRM-{N°} » d'une de SES lignes, tel quel (forme stricte ; « 124 » seul ne
  désigne rien) ; une commande annulée/remboursée ne prête pas son SKU. Leboncoin : vente prouvée seulement
  (`isSeller === true`), n° de transaction, `label.reference` et `exp=` du lien de suivi (mesurés égaux) — le
  code-barres de 26 chiffres de l'étiquette Mondial Relay les porte aux chiffres 3 à 10 (`candidatsDuScan`, forme
  mesurée du 14 nov.). Un SKU « VRM-12 » (5 caractères utiles) passe sous le minimum de 6 seulement sous sa forme
  stricte.
- **Pas fait, dit** : le n° de suivi d'une commande eBay n'est pas dans nos lignes (l'API Fulfillment ne le porte
  pas dans la commande ; l'étiquette se prend chez eBay) — rien n'est inventé.
- App : `lignesDouchette` ajoute ces lignes (tous sites, quel que soit le filtre affiché). Trouvée ⇒ eBay : SA
  commande (`DEMANDE_EBAY_CIBLE` ⇒ eBay → Ventes, le chemin de « Gérer sur eBay ») ; Leboncoin :
  `?tab=ventes&site=leboncoin&cible=lbcvente&tx=…` — nouvelle cible `lbcvente` (src/cibleNotif.js), la carte
  `vrm-lbc-package` porte `data-lbc-vente` + `data-cible="lbcvente:{tx}"`.

## 39 · « Vendu ! » Leboncoin, eBay, Vestiaire (décision de Julien relayée le 16 nov.)

**Pas d'e-mail** : aucune forme d'e-mail de vente de ces sites en base (tableau ci-dessus) ⇒ aucun lecteur d'e-mail.
**Source = ce que VRM lit déjà** (`api/_lib/ventes-sites-notif.js`, pur) : `lbc_ventes` (ventes `isSeller`),
`ebay_orders*` (comptes actifs, `lireCommandesEbay`), `vc_ventes` (`ventesVcDe`). Branché sur le passage de
15 min (`?moment=groupe`, `passageVentesSites` dans api/ship-reminders.js) : seuls les vendeurs qui ont une de ces
lignes sont visités.
- Une fois par vente : identité = n° de transaction Leboncoin / n° de commande eBay / productId Vestiaire ; mémo
  `vrm_ventes_sites_vues` (`comptes`, `vus`) écrit AVANT l'envoi (mémo illisible ⇒ rien ; écriture ratée ⇒ rien
  envoyé) ; puis le tag réservé dans `push_dedup` (Vestiaire : `vc-vente-{productId}`, le tag de l'e-mail de vente
  Vestiaire ⇒ l'un ou l'autre, jamais les deux).
- Jamais l'historique : la 1re lecture d'un compte range tout « vu » sans sonner ; une vente de plus de 72 h ou
  sans date lisible est rangée sans sonner ; annulée / remboursée / pas payée ⇒ rien (elle sonnera si elle devient
  une vente fraîche).
- Texte : famille « Ventes » (`texteVendu`, catégorie `vente`), « Vendu 45 € · N°124 · titre » / « sur Leboncoin ·
  Prépare le colis : l'étiquette est sur le site » (`venduAilleurs`, 5 langues). Le N° n'est dit que s'il vient de
  l'identité (Vestiaire) ; eBay et Leboncoin sans N° (un SKU d'avant la remise à zéro désigne l'ancienne paire).
- **Ce qu'il faut savoir** : Leboncoin et Vestiaire ne sonnent qu'après la LECTURE par l'extension (une vente pas
  encore relue n'est pas connue du serveur) ; eBay après la dernière lecture des commandes (l'app, ou le cron du
  matin), pas en temps réel. Les comptes écartés / hors offre ne sont pas encore filtrés pour ce « Vendu ! ».
- Frise et cycle hors Vinted : rien de neuf (aucune forme d'e-mail).
- Preuves : `audit-plateformes-restes` section N (N1–N11) ; mutations première lecture, annulée, vieille,
  deux fois, mémo après l'envoi : rouges.

## 40 · Achats Leboncoin / eBay / Vestiaire

- **E-mails** : même mesure, aucun e-mail d'achat de ces sites. Le lecteur `api/_lib/achats-email.js` (lot
  `achats-auto`, formes SUPPOSÉES) reste tel quel ; rien n'est présenté comme mesuré.
- **Notification à l'arrivée d'un achat : PAS FAITE, exprès.** La catégorie `achat` est RETIRÉE des notifications
  (`CATEGORIES_RETIREES`, api/_lib/notif-textes.js, 3 nov. : « plus jamais ») et, le 15 nov., Julien a fait retirer
  la ligne « Arrivé · … » de la cloche (« on range une ANNONCE, pas un achat », `2026-11-15-pas-ranger-achat.md`).
  À rouvrir seulement s'il le redemande.
- **Feuille « Relier un achat »** : `src/achatsAutresRelier.js` — ses achats Leboncoin (`lbc:{n° de transaction}`,
  prix proposé = `prixListe`, le total payé, forme mesurée ; illisible ⇒ aucun prix) et Vestiaire (`vc:{n°}`,
  titre/photo/date, **aucun prix** : forme jamais vue en base) entrent dans la feuille, à côté des achats Vinted
  (« Leboncoin · compte » dans la ligne). Annulés écartés. C'est SON clic qui relie (`buyFromId` = cette identité).
  Seulement la feuille (pas la saisie en série). **eBay pas fait** : ses achats se lisent à la demande chez eBay
  (route `achats`, son jeton), ils ne sont rangés nulle part.

## 41 · Publier partout : la catégorie Vestiaire reçue par l'extension (5.397.0)

- Extension : `categorieVcDemandee(dem, _catVc)` (background.js) — univers, catégorie DE cet univers,
  sous-catégorie DE cette catégorie, chacun tel quel (casse/espaces mis à part) dans le catalogue de dépôt capté ;
  sinon `null`. `vcPreparer` reçoit `categorie` ; posée ⇒ `ad.vcCategorie` (avec SES ids) ; introuvable ⇒ la règle
  d'avant, `publier` forcé à faux, réponse `categorie: 'introuvable'`. Capacité **`vccategorie`** (5.397.0).
- App : la catégorie part seulement à une extension `vccategorie` et seulement entière ; `lignePartout`
  (src/publierPartout.js) ne la met plus « à finir sur Vestiaire » dans ce cas ; `executerPartout` joint le
  `finir` rendu par l'extension (« à finir sur Vestiaire : Catégorie »).
- **Leboncoin hors chaussures : rien changé** — aucune forme neuve (le formulaire n'est capté que pour 53) ; la
  garde du 15 nov. tient (une option absente du menu ⇒ rien choisi, la publication s'arrête).

## 42 · Vestiaire : une règle du « finalisé »

- `finalisesVestiaire` / `resumeFinaliseVestiaire` (src/caAutresParJour.js) : « Finalisé par plateforme »
  (Stats.jsx, `caVestiaireFinalise`) et « CA entre deux dates » (`caAutresParJour`) lisent la même règle. Choix
  (§5 « on somme ce qu'on connaît, le manque nommé ») : les sûres sont sommées, « au moins : N au montant pas sûr,
  hors total » ; rien de sûr ⇒ « — ». Le total de la carte dit « au moins » quand une ligne l'est. Textes `tr()`
  (`stats.vcFin.*`, `stats.totalAuMoins`, 5 langues).
- **Retrait / suppression Vestiaire : aucune voie créée** — aucune recette apprise n'existe (ni dans l'extension,
  ni en base) ; la paire reste « à retirer sur le site ».

## 43 · Facture Pro : commande eBay à plusieurs lignes

`venteEbay` (src/facturePro/sources.js) : une facture, une ligne par article (`lignes`, consommées par
`lignesDeVente`) — chaque ligne lue en entier (titre, quantité 1, prix en euros) ; une seule illisible, en autre
devise ou à plusieurs exemplaires ⇒ toute la commande refusée. `venteFacture` transmet les lignes. TVA sur marge :
une commande à plusieurs articles n'a pas de prix « d'une paire » (prix `null`, pas su).

## Preuves

- `node scripts/audit-plateformes-restes.cjs` : **46 verts** ; `--prouve` : **18/18 mutations rouges** ; sur
  `origin/main` (fichiers extraits) : **15 rouges, 0 vert**.
- `node scripts/audit-factures-autres.cjs` : **53 verts** ; sur `origin/main` : 5 rouges (S2 ×4, S10) ; mutation
  « les lignes ne passent pas dans `venteFacture` » ⇒ 2 rouges.
- `audit-coherence` vert (capacité `vccategorie` ⇒ `categorieVcDemandee`), `audit-quoi-de-neuf` vert.

## Gestes de Julien

1. Installer l'extension **5.397.0** (remplacer le dossier, puis ⟳ dans chaque Chrome).
2. Au prochain article vendu sur Leboncoin et sur eBay, et au prochain achat sur Leboncoin, eBay, Vestiaire :
   laisser l'e-mail arriver dans la boîte relevée par VRM (débloque 39 et les e-mails de 40).
3. Ouvrir « Mes commandes » sur Vestiaire dans Chrome avec l'extension : les achats Vestiaire seront relevés (leur
   prix pourra alors être mesuré).
4. Déposer UNE annonce Vêtements / Accessoires / Enfants sur leboncoin.fr avec l'extension (le formulaire est capté).
