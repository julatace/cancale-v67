# 22 nov. 2026 — Après la finale, côté extension (ext. 5.435.0) · branche `claude/apres-finale-ext`

Partie de `claude/integration-finale` (ext. 5.434), re-fusionnée (vrai `git merge`) avant de rendre. **Pas de PR, pas de
fusion sur main** (l'intégrateur). Version **5.435.0** : `CODE_VERSION`, manifeste, `CAPTEUR_VERSION` (lbc-inject.js),
`relaisVersion` (lbc-relay.js), `EXT_ATTENDUE`. ⚠️ **Zips NON régénérés** et `public/extension-version.json` /
`VRM-Orion-installation.txt` laissés à 5.434.0 (consigne : c'est l'intégrateur qui sert la version). Capacités 5.435.0 dans
`EXT_CAPACITES` et `audit-coherence` : `sauvegardereglages` (`sauvegardeReglagesCarte`), `lbcoffres`
(`lbc-inject.js:offreMsgLbc`), `retoursautres` (`retourLbcDe`) ; ligne §8 de CLAUDE.md (59 005 octets). Quoi de neuf :
`sauvegarde-reglages`, `sites-egalite`. Aucune fonction `api/` ajoutée (12 au plus).

## Choisis par Julien (22 nov.)

### 22. Sauvegarde des réglages de l'extension — fait
- **Panneau → Paramètres → « Sauvegarde de mes réglages »** (`vrm-badge.js` `sauvegardeHtml`, 5 langues `sr_*` dans
  vrm-ui.js) : « Sauvegarder mes réglages » télécharge `vrm-reglages-AAAA-MM-JJ-HHMM.json` (JSON indenté, `format`
  `vrm-reglages-extension`, `formatVersion` 1, version de l'extension, date, compte de l'onglet) ; « Restaurer… » lit le
  fichier (≤ 1 Mo) et montre ce qui changerait, une ligne par réglage, avant → après, le compte nommé, « S'allume » en
  ambre pour une automatisation qui s'allumerait, la version du fichier dite ; « Non » ⇒ rien ; **« Oui, remplacer »** ⇒
  l'écriture.
- **Fond** (`background.js`, après `reglageAutoCarte`) : `sauvegardeReglagesCarte` (`exporter` · `apercu` · `annuler` ·
  `restaurer`).
  - Ce qui entre : la LISTE BLANCHE — `vrm_reglages_auto` (main superposé, `lireMain`) : offres auto, refus et ses
    versions, paliers, réponses rapides, seuil de la garde du prix, retirer partout, mémoire de « Publier sur… » (sans son
    historique `envois`) ; par compte : cadence (`vinted_cadence`), « comme Bleam » section par section passée par
    `bleamDe` (messages aux favoris et versions, Agent VRM et ses heures calmes, relances, cycle de vie et ses horaires,
    bordereau, stock, note des acheteurs…), baisse par règle (Vinted, `lbc:`, `vc:`) ; `vrm_favoris_reglages_{uid}`
    (message, versions, rythme, offre). Puis le filtre `srNettoyer` (clé de secret ou de personne, valeur qui ressemble à
    un jeton ⇒ retirée — aller ET retour).
  - JAMAIS : session, jeton, cookie, mot de passe, conversation, pseudo, boutons appris (`vrmLbcUi`, `vrmVcUi`… restent
    dans `chrome.storage.local`, jamais lus ici). Une lecture ratée ⇒ aucun fichier (il serait incomplet).
  - Restaurer : `apercu` n'écrit rien (jeton 15 min dans `chrome.storage.local` `vrmRestauration`) ; `restaurer` exige
    `confirme: true` + le jeton + le MÊME compte d'onglet ; le plan est refait DANS le comparer-et-échanger
    (`modifierLigneCas`) par les chemins existants : `reglageAutoNormalise` (SON « Oui » vaut la confirmation d'un réglage
    qui s'allume, l'aperçu l'a dit) + `ligneAvecReglage` ; favoris par `GARDES_APP.validerReglagesFavoris` (`envoisActifs`
    toujours faux). Un réglage refusé par sa règle est dit.
  - Comptes : un réglage de compte va au MÊME uid (le compte de l'onglet, ou un compte Vinted de SON VRM —
    `getStoredAccounts`) ; un autre compte du fichier est NOMMÉ (une case décochée) et ne va au compte de l'onglet que sur
    SON choix. Versions : format 1 et extension ≥ 5.410.0 acceptés (une autre version est dite) ; plus récent, trop ancien,
    pas une sauvegarde VRM, JSON abîmé ⇒ refusé et dit.

### 2. Leboncoin et Vestiaire à égalité avec Vinted
- **(a) Fiche « Sur les sites »** — fait. `src/ficheSites.js` `annoncesHorsLigneAutresSites` (pur, aucun titre lu) :
  Leboncoin EN PAUSE (`etatAnnonceLeboncoin` + `lbcSortieDe` = 'pause') et Vestiaire HORS LIGNE (famille 'attente', ou
  'retiree' dont le mot dit dépublié / désactivé ; supprimée ⇒ « plus en ligne » ; vendue ou état pas dit ⇒ aucune rangée),
  par la MÊME identité que la règle du prix (`numeroLbcIdentite`, `numeroVcIdentite`). App.jsx `sitesAutresFiche` les
  ajoute ; une annonce que la règle du prix lit « active » mais que VRM a mise en pause n'est plus aussi « en ligne » (une
  rangée). États `en-pause` / `hors-ligne` (`fd.sites.enPause`, `fd.sites.horsLigne`, 5 langues), sans « Publier » (elle y est).
- **(b) Retours Leboncoin, Vestiaire, eBay** — règle et captures faites ; écran : eBay seulement.
  - Règle `api/_lib/retour-vente-suivi.js` : `explicite` (un n° que le SITE nomme retour : la date n'est plus exigée,
    l'égalité avec l'aller reste refusée, un n° partagé aussi), `retourDeVenteAutreSite`, `suiviRetourAutreSite`.
  - Captures (⚠️ **aucun retour de ces sites n'a jamais été mesuré** : elles APPRENNENT) : Leboncoin `retourLbcDe` (un objet
    du détail de transaction dont la clé dit `return…`, son n° sous une clé de suivi, transporteur, statut ; `retourForme` =
    les chemins de clés sans valeur ni personne) rangé dans `lbc_ventes.ventes[tx].retour` (1re date gardée) ; Vestiaire :
    l'étape de la frise vendeur dont la clé dit retour (vc-inject `noteTimeline` → vc.js → `rangerVcTimeline`
    `retourVc`) ; eBay : `returnShipmentInfo.shipmentTracking` du retour Post-Order (`ebay-apres-vente.js`
    `suiviRetourEbay`, documentation, NON mesuré).
  - App : la ligne de retour eBay porte `retourEbay` ; `suiviRetourDe` (Comptabilite) l'applique ⇒ n°, étapes, arrivée
    prouvée ⇒ « reçu » comme Vinted. **Pas fait** : des lignes Leboncoin / Vestiaire dans « Retours et litiges » (l'écran
    ne connaît que Vinted / eBay : « Sur Vinted ↗ », libellés) — la règle et les données sont prêtes, à brancher quand un
    premier retour aura été capté.
- **(c) Offres Leboncoin** — fait (capture qui apprendra). ⚠️ Aucune offre Leboncoin mesurée. `lbc-inject.js`
  `offreMsgLbc` : un message n'est une offre que s'il le DIT (clé de type `type`/`messageType`/`kind`/`template`… dont la
  valeur nomme offre / proposition, ou un objet `offer`/`priceProposal`, sur le message ou un objet joint) ; montant gardé
  seulement si l'unité est dans le nom de la clé (`…Cents` ⇒ centimes) ; sinon « Offre » sans montant. `lbcfil` porte
  `offres` + `formeOffre` (1re forme vue) ; `rangerLbcFilMaintenant` les range dans `lbc_fil_{conv}` ; une offre NOUVELLE
  de l'autre personne ⇒ `capteLbc('offres')` ⇒ push-capte (chemin existant) ; le message qui EST l'offre n'est plus aussi
  un « message » (jamais deux fois). Serveur `api/_lib/push-capte.js` : offre Leboncoin `{conv}:{n° du message}` PROUVÉE
  dans le fil de CE compte (de l'autre personne, pas tranchée), clé `offer-capte-leboncoin-…` réservée avant l'envoi,
  « Offre de 40 € » ou « Offre », toucher ⇒ Messages sur la conversation.
- **(d) Messages Leboncoin et Vestiaire dans la recherche** — fait. `src/rechercheEcran.js`
  `messagesAutresSitesPourRecherche` : `lbc_fil_*` (compte, date, annonce) et `vc_fil_*` + la liste `vc_messages`, en
  scalaires ; trouvés par le titre et le N° de LEUR annonce (identité : l'annonce que la page dit / le produit du fil, puis
  le lien posé ou la référence VRM) ; aucun pseudo. `rechercheUnique.js` : l'entrée « message » porte son site (logo) et
  son N° (`numK`). `FilsTous.jsx` : chaque rangée porte `data-cible` `conv:{conv}` (la loupe mène au fil, Vinted aussi).

### 27 (côté extension). « Annonce plus vue » — rien à ajouter
La règle de `claude/apres-finale-app` (`src/plusVue.js`) lit `vinted_suivi_{uid}` (relevé quotidien de l'extension 5.429,
`noterSuiviAnnonces`, déjà dans le budget de lecture) : **aucune lecture de plus des vues n'est nécessaire** ; rien n'a été
ajouté.

## Preuves (tout inventé)

| contrôle | résultat |
|---|---|
| `audit-sauvegarde-reglages` (neuf, vrai background.js) | **43 verts** ; `--prouve` **8/8** (filtre, envois, « Oui », jeton, compte, plus récent, trop ancien, lecture ratée) ; sur le background d'avant : rouge |
| banc `sauvegarde-reglages-panneau` (neuf, vrai vrm-badge.js + vrm-ui.js ; 390 Orion clair/sombre puis 1512) | **56 verts** ; extension d'avant (`BANC_EXT`) : 8 rouges ; captures regardées (l'aperçu passé en colonne après la 1re capture à 1512) |
| `audit-lbc-offres` (neuf, vrai lbc-inject.js dans Chromium) | **8 verts** ; `--prouve` 4/4 ; lbc-inject d'avant : 5 rouges |
| `audit-push-capte` (+S12 offres Leboncoin) | **40 verts** ; `--prouve` 9/9 (+ lbcoffre, lbccompte) |
| `audit-push-capte-fond` (+F9, vrai rangement du fil) | **22 verts** ; `--prouve` 9/9 (+ lbcdouble, lbcoffre) |
| `audit-fiche-sites` (+S9) | **36/36** ; mutations 11/13 (+ pauseIdentite, vcPasDit, pauseDouble) — `serieLibre` / `serieAvance` « introuvables », déjà ainsi sur la tête de l'intégration (code déplacé) |
| `audit-identite` (+§18 : 50 en pause / hors ligne au même titre) | vert |
| `audit-recherche-partout` (+P8) | vert ; `--prouve` **15/15** (+ 4 mutations) |
| `audit-retours-autres-sites` (neuf) | **16 verts** ; `--prouve` **8/8** |
| `audit-retours-vente` | vert, mutations toutes prises (ancre `date` mise à la nouvelle ligne) |
| `audit-coherence`, `audit-traduction` (45), `audit-actions-gardees` (13), `audit-discretion` (82), `audit-tout-interface` (9), `audit-couleur-panneau` (19), `audit-fonctions-api`, `audit-reglages-auto`, `audit-cadence`, `audit-lbc-interface`, `audit-lbc-repondre`, `audit-capture-vc-lbc`, `audit-lbc-messages`, `audit-quoi-de-neuf` | verts |
| bancs `grand-panneau` (450), `panneau-telephone` | verts |
| build | vert |

## Gestes de Julien
1. Installer la **5.435.0** quand l'intégrateur l'aura servie.
2. Panneau → Paramètres → « Sauvegarder mes réglages » : garder le fichier ; « Restaurer… » sur un autre navigateur.
3. Rien à faire pour Leboncoin / Vestiaire : la première offre et le premier retour vus seront appris (leur forme rangée).
