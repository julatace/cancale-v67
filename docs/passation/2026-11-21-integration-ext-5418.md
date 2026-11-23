# 21 nov. 2026 (soir) — Intégration de l'extension 5.418.0 : tout le travail du 21 nov. en un zip

Branche `claude/integration-ext-5418` (depuis `origin/main` 52a52466f). **Pas fusionnée sur main, pas de PR** :
c'est l'intégrateur principal qui décide. Julien a demandé « donne l'extension » : un seul zip à installer.

## 1. Les fusions (vrais `git merge --no-ff`, dans cet ordre, un commit chacune)

| ordre | branche | version portée | récit |
|---|---|---|---|
| 1 | `claude/ci-offres-panneau` | 5.410.9 | `2026-11-21-ci-offres-panneau.md` |
| 2 | `claude/relais-prevision` | 5.411.0 | `2026-11-21-relais-prevision.md` |
| 3 | `claude/vestiaire-messages-21nov` | 5.412.0 | `2026-11-21-vestiaire-messages.md` |
| 4 | `claude/panneau-telephone` | 5.413.0 | `2026-11-21-panneau-telephone.md` |
| 5 | `claude/extension-interface` | 5.414.0 | `2026-11-21-extension-interface.md` |
| 6 | `claude/extension-connexion` | 5.415.0 | `2026-11-21-extension-connexion.md` |
| 7 | `claude/lbc-interface` | 5.416.0 | `2026-11-21-lbc-interface.md` |
| 8 | `claude/favoris-perso` | 5.417.0 | `2026-11-21-favoris-perso.md` |

Puis la version **5.418.0** partout (`CODE_VERSION`, manifeste, `CAPTEUR_VERSION` de lbc-inject.js, `relaisVersion` de
lbc-relay.js, `EXT_ATTENDUE`, `public/extension-version.json`) ; les capacités gardent leur version d'arrivée
(5.410.9 → 5.417.0, toutes ≤ 5.418.0). Zips régénérés UNE fois (`node scripts/zip-extension.cjs`) :
`public/VRM-extension.zip` (un seul dossier `VRM-extension/`, manifeste 5.418.0, avec `vrm-formulaire.js`,
`lbc-ecrire.js`, `vc-ecrire.js`), `public/VRM-Orion-dossier.zip` (un dossier `VRM-Orion/`), `VRM-Orion.xpi`,
`VRM-Orion.zip`, `VRM-Orion-installation.txt`. `_versions-publiees.cjs` lit l'historique de main : rien à y écrire.

## 2. Les conflits et leur résolution

- **Numéros de version** (chaque fusion : background.js, manifeste, lbc-inject.js, lbc-relay.js, `EXT_ATTENDUE`,
  extension-version.json) : la plus récente gardée, puis 5.418.0.
- **`EXT_CAPACITES` (src/App.jsx) et `FONCTIONS` (scripts/audit-coherence.cjs)** : une seule ligne chacune, réécrite
  par chaque branche ⇒ UNION des clés (aucune capacité perdue : relaisprevu, vcecrireui, vcfilpanneau, vcaimespanneau,
  panneautelephone, toutinterface, connexionsimple, lbcinterface, favorisperso2 + toutes celles de main).
  `audit-coherence` rejoué vert après chaque fusion.
- **CLAUDE.md §8 et src/nouveautes.js** : toutes les lignes gardées.
- **background.js, fusion 5 (ci-offres-panneau × extension-interface)** :
  - le retour de `executerPourAppCoeur` garde LES DEUX : `rienParti` (ci-offres : « VRM sait que rien n'est parti »)
    ET `pasVu` (interface : la page a répondu, geste pas vu à l'écran) ;
  - `offreCarte` : la structure de ci-offres (verrou de conversation, blocage 30 min AVANT le départ, preuve
    attachée compte:transaction:offre, `etatGesteVinted`) + le `conv: off.conv` de l'interface dans les deux requêtes
    (accepter/refuser/contre-offre trouvent leur conversation par identité, sans relecture `convDeTransaction`).
  - `scripts/tests/actions-offres-vinted.test.mjs` (de ci-offres) : B1-B5, B7 jugeaient la requête du service worker ;
    depuis l'interface, accepter / refuser relit le fil avant le clic ⇒ le faux Vinted du test sert maintenant la
    conversation où CETTE offre attend (forme captée, `offer_request_message` statut 10). Aucune assertion affaiblie :
    9/9 verts ; mutation (verrou et blocage retirés) ⇒ B1, B2, B3, B7 rouges.
- **lbc-relay.js, fusions 7 et 8** : la version de lbc-interface gardée (plus aucun ordre d'écriture, le pont
  `__vrmLbcPont`) ; `envoisEnAttente` / `prixEnAttente` de l'ancien relais ne reviennent pas.
- **background.js, fusion 8 — le raccord de favoris-perso dans la séquence réécrite par l'interface** (son récit,
  « Le point de raccord ») :
  - `annonceOffreFavori` de favoris-perso (connaît `{prix_offre}`) + `raisonFavoriInterface` et `lienDuFavori` de
    l'interface + `choixMessageFavori`, `noterChoixFavori`, `favPersoCompte`… de favoris-perso ;
  - `sequenceFavoriBleam` : diagnostic de l'interface (`favori_offre_pas_vue`) + `fini.offreFaite` (statistiques) ;
  - chemin « offre d'abord » de `executerMessageFavori` : les branches de l'interface (`rienParti`, pause/robot,
    `incertain`, PAS VU ⇒ incertain jamais renvoyé) gardées ; l'envoi PARTI note par `noterChoixFavori` (clé de
    version, offre faite) au lieu de `noterEnvoiFavori` seul ;
  - le reste du raccord (`persoF` + `fpUneEnvoyable` avant toute écriture, `choixP` une fois, `versionB` et
    `version` = `choixP.version`, `op = choixP.op`, `noterChoixFavori` après la séquence Bleam) s'est posé sans conflit
    et a été relu dans la séquence d'interface.
- **CLAUDE.md** : 61 041 octets après les fusions ⇒ les six plus anciennes lignes du §9 (20 nov. : lectures légères,
  ventes en tableau, 5.410.2, instantané, relier-achats, sans-selecteur) déplacées telles quelles à la fin de
  `historique-divers.md` ; une ligne pour cette intégration ; « Extension servie » et le geste d'installation à
  5.418.0. 59 574 octets.

## 3. Contrôles (sur la branche, après `npm run build` vert)

| contrôle | résultat |
|---|---|
| `npm run build` | vert |
| audit-coherence, audit-extension-zip, audit-identite, audit-fonctions-api | verts |
| audit-actions-gardees 12 · audit-discretion 82 · audit-traduction 45 · audit-tout-interface 9 | verts |
| audit-lbc-interface 29 · audit-vc-ecrire · audit-favoris-perso P1–P11 · audit-connexion-simple 13 | verts |
| audit-relais-dest 28 · audit-comme-bleam 42 · audit-bleam-suite 50 · audit-messages-malins 17 | verts |
| tests `actions-offres-vinted` 9/9 (adapté, voir §2) · `conversation-relecture` 14/14 | verts |
| bancs interface-vinted 24 · lbc-interface 30 · favoris-perso 54 · panneau-telephone 179 | verts |
| bancs connexion-extension 52 · popup 85 · grand-panneau 438 | verts |
| banc repub-formulaire | 14/14 sur 3 passes de suite ; UNE passe (la 1re, lancée juste après d'autres bancs) a donné B7/B8 rouges (le formulaire s'était arrêté après 3 clics) — intermittent, pas reproduit ; à surveiller |
| `node scripts/audit-parcours-production.mjs` | 9/9 groupes conformes |

Aucun nouveau rouge. Captures regardées (390 d'abord) : panneau Favoris au téléphone (5 onglets, « Voir l'onglet »,
rangées) et l'éditeur des messages personnalisés dans la feuille du bas — cohérents ensemble.

## 4. Livrables

- `public/VRM-extension.zip` (5.418.0, un dossier `VRM-extension/`), `public/VRM-Orion-dossier.zip` (un dossier
  `VRM-Orion/`), `VRM-Orion.xpi`, `VRM-Orion.zip`.

## 5. Gestes de Julien

1. **Installer la 5.418.0** dans CHAQUE Chrome : remplacer le dossier `VRM-extension` par celui du zip, puis ⟳ sur
   `chrome://extensions` ; Orion : `VRM-Orion-dossier.zip`.
2. **Apprendre une fois sur Vestiaire** : sur vestiairecollective.com, ouvrir la messagerie et répondre UNE fois à la
   main à une conversation (VRM apprend le champ, le bouton, l'adresse — jamais le texte) ; ouvrir « Mes articles »,
   « Mes ventes » et les notifications.
3. **Apprendre une fois sur Leboncoin** : sur leboncoin.fr, faire UNE fois à la main chaque geste que VRM refera
   (mettre une annonce en pause, en supprimer une, changer un prix, répondre à un message) ; VRM n'apprend que de ses
   vrais clics.
4. **Essayer UNE republication et UN message à UN favori** en regardant l'onglet de travail : tout passe désormais par
   la page (clic, saisie) ; si un élément manque, VRM s'arrête et le NOMME (« élément … introuvable ») — c'est ce nom
   à transmettre.
5. Favoris → Réglages : relire ses messages personnalisés, enregistrer.
6. L'extension : se connecter par la fenêtre (mot de passe ou « Relier par vrm.center »).
