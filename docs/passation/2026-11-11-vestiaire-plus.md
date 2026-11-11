# 11 novembre 2026 — Vestiaire « plus » (branche `claude/vestiaire-plus`, extension 5.364.0)

Demandes de Julien (validées) : 1. le parcours d'une vente Vestiaire étape par étape ;
2. les photos exigées par Vestiaire avant « Préparer sur Vestiaire » ; 3. baisser le prix
en série sur Vestiaire, appris de son propre geste ; 4. les offres Vestiaire dans Ma
journée. Puis (message du coordinateur) : « Vestiaire Collective doit être
IRRÉPROCHABLE » — revue de tout ce qui touche Vestiaire.

## ÉTAT À LA REPRISE

- Tête poussée sur `claude/vestiaire-plus` (voir le dernier commit). Aucune PR, aucune fusion sur `main`.
- Extension **5.364.0** (numéro réservé) : `CODE_VERSION`, manifeste, `CAPTEUR_VERSION`,
  `relaisVersion`, `EXT_ATTENDUE`, zip régénéré. `EXT_CAPACITES.vcprix = '5.364.0'`.
- Fichiers neufs : `src/parcoursVestiaire.js`, `src/ParcoursVestiaire.jsx`,
  `src/photosVestiaire.js`, `src/PhotosVestiaire.jsx`, `src/baissePrixVestiaire.js`,
  `src/BaissePrixVestiaire.jsx`, `scripts/audit-vc-prix.cjs`,
  `scripts/audit-vestiaire-plus.cjs`, `scripts/bancs/vestiaire-plus.cjs`.
- Touchés : `vinted-sync-extension/{vc-inject.js,vc.js,background.js}` (blocs 5.364 seulement),
  `src/ecrans/Vestiaire.jsx`, `src/App.jsx` (Ma journée, lecture `vc_offres`, cloche),
  `src/OffresVestiaire.jsx` (traduit), `src/offresVestiaire.js` (`offresJourneeVc`),
  `src/i18n/langues/*.js`, `src/nouveautes.js`, `scripts/audit-traduction.cjs` (MIGRES),
  `scripts/audit-coherence.cjs` (FONCTIONS : `vcprix`).

## Mesuré avant de coder (lecture seule, base de Julien, 11 nov.)

- `vc_ventes` : une vente, clés `aExpedier, bordereau, compte, date, etapesVc, etat, etiquette,
  limite, montant, paiementEstime, photo, premiereVue, productId, ref, sources, statutVc, suivi,
  titre, transporteur, vuAt` ; `etat` « ACTION_NEEDED », `statutVc` « shipmentInProgress »,
  `etapesVc` = { sellerSale: done, sellerShipment: pending, sellerConformity: upcoming,
  sellerDelivery: upcoming, sellerPayment: upcoming }.
- **0 ligne `email_*` / `vc_email*` qui parle de Vestiaire** dans cette base. Les formes
  d'e-mails reconnues (vente, « Il vous reste N jours… », annonce, offres) viennent des relevés
  du 2 et du 9 nov. (`vestiaire-email*.js`) ; AUCUNE ne dit une étape d'après l'envoi.
- `vc_recon.chemins` (écritures) : aucune écriture sur un article publié (seulement brouillons,
  photos de dépôt, likes, négociations) ⇒ la requête qui change un prix n'a JAMAIS été vue.
- `vc_catalogue.deposit_catalog` : univers/catégories/sous-catégories, **aucune règle de photo**.
- L'aide de Vestiaire (faq.vestiairecollective.com) n'est pas joignable d'ici (réseau) ; ce qui
  en a été relevé par la recherche : chaussures = étiquette intérieure, marque sous la semelle,
  pointure, numéro de série s'il existe ; preuve d'origine (n° de série OU preuve d'achat OU
  certificat, cachée de l'annonce) ; défauts en gros plan ; le contrôle compare aux photos.

## 1. Le parcours d'une vente (`src/parcoursVestiaire.js`, `ParcoursVestiaire.jsx`)

Dans le récapitulatif d'une vente Vestiaire (Ventes · Vestiaire → toucher la vente), une
section « Chez Vestiaire » : la frise existante (`src/design/Frise.jsx`) des cinq étapes
**Colis envoyé → Arrivé chez Vestiaire → Authentification → Validé / Refusé → Payé**, une
ligne par étape (le … · en cours · à venir · « — pas encore lu » · « Vestiaire écrit « … » »)
et « L'argent » : versé le … · dans le CA de <mois> (heure de Paris) / Vestiaire estime : … ·
pas encore dans le CA / « — date de versement pas lue : dans aucun mois du CA ».
Règles : « done » seul prouve ; « pending » = en cours ; arrivé = contrôle en cours ou fait
(jamais le temps passé) ; refusé seulement DIT par un mot de Vestiaire ; un mot inconnu ⇒ « pas
su » avec le mot ; « shipmentInProgress » (l'état mesuré d'une vente À ENVOYER) ne prouve pas
l'envoi (le mot ne compte que hors « à expédier », `vcVentePartie`). Une vente annulée n'a pas
de parcours. La ligne de vente garde sa frise à 4 segments (la même que Vinted).
⚠️ Décision : aucun sujet d'e-mail n'est inventé pour les étapes d'après l'envoi (aucun vu) ;
ils restent gardés entiers, et se brancheront sur leur forme réelle.

## 2. Les photos exigées (`src/photosVestiaire.js`, `PhotosVestiaire.jsx`)

Sous chaque article de « Mettre en vente » (Annonces · Vestiaire) : « Photos Vestiaire · N
manque · M à vérifier », qui déplie la liste (vue · état · d'où vient la demande). VRM ne sait
que ce qu'il peut vérifier SANS IA (§2.9) : le nombre de photos (chaussures : au moins 4),
l'étiquette en 2ᵉ choisie par lui, la clé Photoroom (fond détouré, Vestiaire seul §3 —
conseillé, jamais bloquant). Le reste (semelle, pointure, n° de série, preuve d'origine,
défauts) est « à vérifier toi-même » — jamais « ok ». Sacs : liste des guides de vendeurs,
dite « conseillé ». Vêtements, bijoux, montres : « liste pas relue », dit. « Préparer sur
Vestiaire » DEMANDE d'abord quand quelque chose manque (« Compléter d'abord » n'envoie rien ;
« Préparer quand même » continue, puis la vérification d'avant).

## 3. Baisser le prix en série (extension 5.364)

- `vc-inject.js` : les prix vus dans « Mes articles » (`annoncesVuesPrix`, mémoire de la page) ;
  `recettePrix` apprend de SON changement de prix à la main (écriture 2xx, article montré par la
  page, UN prix dans le corps, trous `{produit}` `{prixCents}`/`{prix}`, mots fixes, NOMS
  d'en-têtes) ; la recette n'est **apprise qu'une fois le nouveau prix RELU** (réponse ou « Mes
  articles » relu) — sinon « pas-encore-relu ». L'ordre `prix` : compte de la page = compte
  attendu, prix vu dans la page = prix de l'aperçu, une écriture, puis la relecture de « Mes
  articles » (la même adresse que la page) ; `prixVuCents` rendu.
- `vc.js` : relais `vcprixappris`, `vcprixresultat`, ordre `vcPrix`.
- `background.js` : `vrmVcRecettePrix` + `vc_prix_recette` (appris / raison / dernier essai) ;
  `baisserPrixVestiaire` (commande `vcPrix`) : une action Vestiaire à la fois, pause 429/403,
  recette apprise, annonce lue au prix de l'aperçu, compte de l'annonce connu (jamais prêté
  au compte de l'onglet) et ouvert dans l'onglet, **45/h** (`RESERVE_GESTES`), place rendue si
  rien n'est parti, « fait » seulement au prix RELU (sinon « écart » / « incertain »).
  État : `vcPrix: true`.
- App : « Baisser des prix » (Annonces · Vestiaire) ouvre la feuille (même forme que Vinted) :
  pas appris ⇒ « Fais-le une fois à la main, VRM apprendra. » + « Ouvrir Vestiaire ↗ » et rien
  ne part ; appris ⇒ −X € / −X %, ancien → nouveau, coches, confirmation, une commande à la fois
  (pause 3–8 s), le prix relu affiché.
- ⚠️ La forme de la requête dans l'audit est INVENTÉE (inconnue) : c'est la règle
  d'apprentissage qui est jugée. À relire dans `vc_prix_recette` après son premier geste.

## 4. Les offres Vestiaire dans Ma journée

`lireVestiaireColis` lit aussi `vc_offres` ; `offresJourneeVc` (src/offresVestiaire.js) : les
offres reçues encore à lui (la liste de Messages, jamais une expirée ni la sienne), celle qui
expire le plus tôt d'abord, 4 lignes au plus, le reste compté (« N autres offres Vestiaire ») ;
ambre sous 6 h. Chaque ligne : « Offre 120 € sur Vestiaire · N°41 · titre · expire dans 2 h » +
« Répondre » ⇒ **Messages · Vestiaire** (les cartes d'offres : Accepter / Refuser /
Contre-offre si appris, sinon « Répondre sur Vestiaire ↗ »).

## Revue « irréprochable » — défaut · cause · correction · preuve

| défaut | cause | correction | preuve |
|---|---|---|---|
| Ma journée « N messages Vestiaire non lus » ouvrait **Annonces** Vestiaire | `tab: 'plat_vestiaire'` ⇒ `redirigerOnglet` prend la section par défaut du site (`annonces`) | la ligne (et les offres) ouvrent `?tab=messages&site=vestiaire` | banc `vestiaire-plus` A (rouge sur l'avant : `data-tache-vestiaire="annonces"`) |
| Cloche : « N **paires** vendues …, encore en ligne sur Vestiaire » | texte d'avant le 2 nov. (« ce n'est pas toujours une paire ») | « N articles vendus … » | lecture du code |
| Offres Vestiaire en français seulement | écran pas migré | `OffresVestiaire.jsx` passe par `tr()` (16 clés, 5 langues), ajouté à MIGRES | `audit-traduction` |
| (voir la suite ci-dessous, bancs Vestiaire) | | | |

Audits Vestiaire relancés, tous verts : `audit-numeros-vestiaire` 26, `audit-vc-conversations` 36,
`audit-vc-messages` 40, `audit-vc-offres` 45, `audit-vc-publier` 111, `audit-vc-recon` 11,
`audit-vestiaire-email` 47, `audit-vestiaire-emails-autres` 17, `audit-vestiaire-partout` 44,
`audit-capture-vc-lbc` 45, `audit-lbc-vc-lecture` 20, `audit-fiabilite-annonces` 20,
`audit-frise-sites` 18, `audit-lien-vc` 45.

Pas fait (dit) : l'écran `src/ecrans/Vestiaire.jsx` entier n'est pas traduit (≈ 380 textes,
étape 5 de la méthode de traduction : lot à part) ; les messages de `src/offresVestiaire.js`
(`prixContre`, `etiquetteOffre`) restent en français ; Colis (« À envoyer », logo, « Tout
imprimer ») n'est PAS touché (écrans en cours d'intégration ailleurs) — « Tout imprimer » porte
déjà les bordereaux Vestiaire rangés (`lignesLotTous`).

## Preuves

- `scripts/audit-vc-prix.cjs` : VRAI vc-inject.js + vc.js + background.js (`_fond-vm.cjs`),
  35 contrôles ; `--prouve` 16/16 mutations rouges. Sur `origin/main` : la fonction n'existe pas
  ⇒ rouge (et prouvé par mutations).
- `scripts/audit-vestiaire-plus.cjs` : 19 contrôles ; `--prouve` 13/13 mutations rouges.
- Banc `scripts/bancs/vestiaire-plus.cjs` (390 tactile clair, 1512 sombre).

## Gestes de Julien

1. Installer l'extension **5.364.0** (remplacer le dossier, ⟳ dans chaque Chrome).
2. Sur vestiairecollective.com (ce Chrome, connecté) : ouvrir « Mes articles », changer UNE
   fois à la main le prix d'une annonce, puis rouvrir « Mes articles » : VRM saura baisser les
   prix (Annonces · Vestiaire → « Baisser des prix »).
3. Faire arriver les e-mails Vestiaire d'expédition / contrôle / paiement (règle iCloud
   « vestiairecollective ») : dès qu'un vrai arrive, son étape pourra se brancher.
