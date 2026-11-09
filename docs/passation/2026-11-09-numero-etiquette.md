# 9 novembre 2026 — « Où est ton numéro ? » et « Je l'ai remise en ligne »

Branche `claude/numero-etiquette` (depuis `origin/main` 868ac2a8). Extension **5.334.0**
(5.332 et 5.333 sont prises par `claude/securite-2` et `claude/leboncoin-clair`).

## La demande (mot pour mot)

> « Pour Vinted, la personne met son numéro d'étiquetage à la fin de sa description. Capte
> ce numéro pour l'intégrer dans l'application et n'attribue pas de numéro
> automatiquement. Ça peut être dans le titre aussi, ou dans le numéro d'étiquetage pour
> les comptes professionnels Vinted. On peut appliquer ça à Leboncoin, eBay,
> Vestiaire… » — « l'application détecte quand on supprime un article ; mets aussi que je
> le remets en ligne, et suggère le numéro de l'ancien colis ».

## Ce qui existait déjà (7 nov., `docs/passation/2026-11-07-numero-ecrit.md`)

La règle `src/numeroEcrit.js` (formes acceptées, jamais un nombre nu, deux N° ⇒ ambigu,
contradiction ⇒ « à vérifier » et SON clic, archive 013), le réglage « Je numérote
moi-même » (`vrm_numero_ecrit`), allumé ⇒ VRM ne donne aucun N° (app et extension 5.324,
`numeroEcritAllume`). Ce qui manquait : choisir OÙ il écrit ; la description Vinted
n'était lue que pour les annonces ouvertes une fois sur vinted.fr ; la fin d'une
description Leboncoin de plus de 400 caractères était perdue ; la remise en ligne.

## Ce qui est livré

1. **« Où est ton numéro ? »** (Réglages → Numéros de rangement, sous la bascule, visible
   quand elle est allumée) : trois cases (44 px) — « À la fin de la description » ·
   « Dans le titre » · « Dans le champ « référence » de la plateforme ». Plusieurs
   cochables, **jamais zéro** (`basculerOu` ; la dernière ne se décoche pas, c'est dit).
   Enregistré dans le même réglage synchronisé : `vrm_numero_ecrit = { actif, depuis, ou }`
   (`ou` absent ou vide ⇒ les trois : le comportement du 7 nov., rien ne change chez
   personne). Une source décochée n'est **plus lue du tout** — ni pour poser un N°, ni
   pour se dire « ambigu » (`lireNumeroEcrit({ …, ou })`). Toute l'app passe par
   `lireNumeroEcrit = (o) => lireNumeroEcritRegle({ ou: ouNumeroEcrit(), ...o })`
   (Vinted, Leboncoin, Vestiaire, vente à expédier, aperçu de Réglages) ; le SKU eBay
   n'est lu que si « référence » est cochée (`skuEcrit`). L'aperçu par site dit ce qui
   est lu selon les cases.
   - Champ « référence » : **eBay = SKU**, **Leboncoin pro = `CustomRef`** (mesurés dans
     le code de capture). **Vinted pro et Vestiaire : aucun champ n'a été vu** dans les
     données captées — rien n'y est lu, l'écran le dit (« pas de champ lu pour
     l'instant »). Rien inventé.
2. **L'essai** « Colle une description » : VRM dit ce qu'il lit (`data-numero-essai`) —
   « VRM lit N°125 (à la fin, « N° 125 ») », « deux numéros : VRM ne choisit pas »,
   « un N° est écrit, mais pas à la fin », « aucun numéro lu (un nombre seul n'est jamais
   pris) ». Rien n'est enregistré.
3. **La lecture dans l'extension (5.334, capacité `numerodescription`)** : la règle de
   lecture est un bloc `<numero-ecrit-lecture>` de `src/numeroEcrit.js`, **recopié tel
   quel** dans `background.js` par `node scripts/audit-numero-etiquette.cjs --recopie`
   (enveloppé dans `VRM_NUMERO_ECRIT`, aucune collision de nom). `lectureNumeroDescription`
   lit :
   - **Vinted** : la description du dressing (`articleMaigre` : le dressing envoie le
     texte entier, l'allègement le jetait) ⇒ `numEcrit` (quelques octets : `{etat, cle,
     brut}`) — **jamais le texte** ; toutes les annonces, plus seulement celles ouvertes
     sur vinted.fr ;
   - **Leboncoin** : la description **entière** avant d'en ranger 400 caractères
     (`handleLbcRaw`) ⇒ `numEcrit` ; une capture sans description (tableau de bord pro)
     n'efface pas la lecture d'avant (`Object.assign`).
   - L'app : `mapWardrobeItem` pose `numEcritDesc: lectureRecue(it.numEcrit)` (une forme
     inconnue vaut « pas lue », jamais un N°) ; le détail de page (`fetchDescLens`) ne
     sert plus qu'en repli ; `lectureEcriteLbc` passe `descriptionLue: ad.numEcrit`.
   - Lire n'est pas décider : seule l'app décide (réglage, identité, « à vérifier »).
4. **Intégration** : inchangée et rejouée — N° lu sur une paire sans N° ⇒ il devient le
   sien (identité = son annonce) ; N° différent déjà posé ⇒ rien ne change, « à vérifier »
   avec les deux N° (« Garder N°X / Prendre N°Y ») ; deux paires présentes au même N° ⇒
   le rouge ; archive « B… » / annonce d'avant la coupure 013 ⇒ pas pris. Allumé, aucun
   N° automatique (app + extension, aucun N° réservé à côté de « Publier »).
5. **« Je l'ai remise en ligne »** (`src/remiseEnLigne.js`, bloc en tête d'Annonces,
   `data-remise-bloc`) : une annonce **supprimée** (preuve de l'extension,
   `harvest_{uid}_supprimees`, capacité `supprimees` 5.165) dont la fiche porte un N°, et
   une **nouvelle** annonce du même compte mise en ligne après (marge d'un jour, 30 jours
   au plus) ⇒ « C'est la même paire que N°7 « … » ? ».
   - Force : **même fichier photo** ⇒ « forte » (cache les ressemblances) ; sinon **même
     marque + même taille + même modèle (ou un mot de modèle commun)** ⇒ « simple »,
     l'écran dit « vérifie l'étiquette avant de dire oui » ; marque, taille ou modèle
     différents ⇒ rien. Plusieurs anciennes ressemblent ⇒ au plus 3 choix, dit ; une
     ancienne proposée à deux nouvelles ⇒ dit.
   - Jamais proposé : un N° d'archive, un N° qu'une paire **présente** porte (deux paires
     sous un N°), une annonce au N° posé à la main ou qui porte déjà ce N°, une annonce
     dont le N° est **écrit** dans le texte (identité qu'il a écrite : si c'est l'ancien,
     la règle du N° écrit le reprend sans question), un autre compte, ce qu'il a écarté.
   - **« Oui, N°7 »** passe par `poserNumero(it, '7', avant, { carton: true, memePaire:
     true })` : ses garde-fous (archive, déjà pris), la reprise de la fiche de l'ancienne
     (prix d'achat, `repriseDe`), **rien à barrer** (le carton dit déjà N°7) ; la question
     « même article ? » n'est pas reposée. Le N° auto donné entre-temps reste brûlé (pool
     append-only). **« Non, une autre paire »** ⇒ `vrm_remise_refus` (synchronisé), plus
     reproposé.

## Mesuré vs supposé

- **Mesuré dans le code** : le dressing Vinted porte `description` (c'est d'elle que
  `descLen` est tiré depuis le 23 août) ; `handleLbcRaw` a `node.body` entier avant la
  coupe ; SKU eBay et `CustomRef` Leboncoin existent dans la capture.
- **Pas mesuré** (aucun accès à sa base ici) : le champ « numéro d'étiquetage » d'un
  compte **Vinted pro** (ses comptes sont particuliers) ; une référence vendeur sur
  **Vestiaire**. Il faut une réponse `items/{id}` d'un compte pro pour connaître le nom
  du champ.
- La lecture du dressing n'arrive qu'avec l'extension 5.334 ; avant, seule la page
  ouverte (`vinted_item_details`) donne la description.

## Preuves

- `node scripts/audit-numero-etiquette.cjs` : **48 vérifications** — 50 descriptions
  piégées (pointures, prix, années, « 2 paires », cm, références de modèle, deux N°,
  « 007 », « B125 », émojis, `\r\n`, lettre de Republier), le réglage `ou` (jamais zéro,
  une source décochée n'est plus lue), 50 annonces identiques sans N° ⇒ aucune n'en
  reçoit, copie exacte du bloc dans l'extension, **vrai `background.js` exécuté**
  (`_fond-vm.cjs` : les 50 lectures identiques à l'app, le dressing allégé porte
  `numEcrit` sans le texte, aucun N° réservé allumé), la remise en ligne (17 cas, dont
  50 paires identiques supprimées ⇒ jamais « forte » par ressemblance, la photo désigne
  LA paire), le câblage de l'app.
  **Sur `origin/main` : 25 rouges** (`--src`). `--mutation=toutes` : **témoin vert,
  12/12 mutations attrapées** (ou, jamais zéro, forme reçue, copie, dressing, Leboncoin,
  marque, paire présente, archive, compte, avant la suppression, app sans `ou`).
- Banc `scripts/bancs/numero-etiquette.cjs` (390 tactile et 1512, clair et sombre) :
  **103/103** ; **sur un build d'`origin/main` : rouge** (voir le rapport). Captures
  regardées : les trois cases, l'essai « VRM lit N°125 », le bloc « 2 annonces remises en
  ligne ? » avec « Oui, N°7 / Non, une autre paire ».
- Verts : `audit-numero-ecrit`, `identite`, `coherence`, `etiquette-numero`,
  `numerotation-lecteurs`, `numeros-lettres`, `reprise-numero`, `tdz`, `variables`,
  `statuts`, `sans-session-envoi`, `annonces-actions`, `annulees-chez-toi`,
  `double-vente`, `ebay-deja-vendue`, `preuve-vente`, `supprimees`, `extension-zip`,
  `paquets-boutiques` (après régénération des paquets). `npm run build`.

## Gestes de Julien

- Installer l'extension **5.334.0** (remplacer le dossier, ⟳ dans chaque Chrome) : sans
  elle, la description n'est lue que sur les annonces ouvertes une fois sur vinted.fr.
- S'il numérote lui-même : Réglages → Numéros de rangement → « Je numérote moi-même »,
  cocher où il écrit, coller une description dans « Essaie » pour voir ce que VRM lit.

## Questions ouvertes

1. Vinted pro : une capture d'une annonce d'un compte pro pour trouver le champ
   « numéro d'étiquetage » (rien n'est lu là tant que ce n'est pas mesuré).
2. Remise en ligne sur Leboncoin / Vestiaire / eBay : la suppression n'y est pas
   prouvée de la même façon (Leboncoin a `supprimeeAt`) — à étendre si utile.
