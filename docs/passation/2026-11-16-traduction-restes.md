# 16 nov. 2026 — Traduction, les restes (lot `traduction-restes`, extension 5.394.0)

Branche `claude/traduction-restes`. Brief commun du 16 nov. (coordinateur). Quatre missions :
(17) l'extension non traduite, (18) les 30 textes « paire/article » laissés en français
(`2026-11-13-integration-traduction.md`), (19) les textes en dur hors `tr()`, (20) le centre
d'aide public qui disait encore d'anciens chemins. **Le français affiché ne change pas d'un mot**
(banc `traduction-restes`, R1). Toutes les traductions sont **de première main : relecture
native requise** avant d'ouvrir VRM hors de France.

## ÉTAT À LA REPRISE
- Tout est poussé sur `claude/traduction-restes` ; voir la PR (titre « Traduction, les restes… »).
- Extension **5.394.0** réservée (`scratchpad/versions-reservees.txt` du coordinateur) ; zips régénérés.
- Ce qui reste (dit, pas caché) : voir « Ce qui n'est pas fait » en bas.
- **Reprise du 16 nov. (soir)** : vrai `git merge origin/main` (98 commits ; conflits : CLAUDE.md §9
  et `src/nouveautes.js` réunis, zips refaits). Les 6 nouveautés arrivées de main (relier-fiable,
  fiche-delier-recu, vente-email-particulier, barre-achats, selection-visible, iphone-fluide)
  traduites en en/es/it/de (D2/F2 verts). `vrm-regles-achat.js` recopié des règles de l'app
  (`regles-achat-extension.cjs --recopie`) : `audit-infos-vinted` I10 était rouge sur main (copie
  périmée) — pris dans la 5.394.0, jamais servie. Fini, à intégrer (PR #1191).
- Second merge de main (62 commits) : 3 nouveautés de plus traduites (stock-case-allumee,
  fiche-porte-achat, achats-qr ; `audit-traduction` D2/F2 les avait rougies). Preuves : passe de
  107 audits (dont les 99 qui exécutent le vrai background.js) : 105 verts, 2 rouges = ceux de main
  (vendeur-generaliste, vocabulaire-article, lot derniers-rouges) ; build vert ; banc
  `traduction-restes` : R2/R3 verts, R1 a 4 écarts **qui sont aussi entre deux relevés du MÊME build
  de main** (bandeau « Vérification de tes données… » / « 2 choses à revoir » et sections
  d'Achats chargées à la demande : dépend du moment) ⇒ R1 dépend de l'heure du relevé, pas du lot.
  Vu en anglais : « rangé » (Stock) reste en français — texte de main, à reprendre.

## (20) Les chemins d'aide — `scripts/audit-chemins-aide.cjs`
Mesuré sur main (b8f26f36d) : **4 rouges réels** que personne ne voyait :
- `Colis → À retirer` (2 fois dans l'aide publique, 3 fiches de l'aide intégrée) : l'onglet Colis
  a quitté la navigation le 11 nov. ⇒ `Achats → À retirer`, `Ventes → À envoyer`, `Ventes → « Tout imprimer »` ;
- « Vérifier mon installation » rangée dans « Aide et « Tout va bien ? » » ⇒ elle est dans **Mes plateformes** ;
- fiches intégrées : `Paramètres → Aide → …` ⇒ `Aide et « Tout va bien ? »` ; `Taille` ⇒ `Taille de l'affichage` ;
  `Imprimante` ⇒ `Imprimante et bordereaux` ;
- `Qui numérote ? Moi` ⇒ `Qui numérote ?` → `Moi` (deux segments).
L'audit relit chaque chemin des trois sources (`scripts/aide-contenu.cjs` ARTICLES et ETAPES_ECRANS,
`src/aideFiches.js`) contre l'app : P1 la catégorie existe (`parametres.cat.*`), P2 la rangée ou le
groupe est dans CETTE catégorie (`lib` relu dans `src/ecrans/Reglages.jsx`, rangement
`src/parametres/categories.js`), P3 la suite existe dans le texte de l'app (contrôle faible, dit tel
quel), N1 l'écran de départ est dans la navigation (`entreeNav`) — « Réglages », « Colis » rougissent,
N2 la suite d'un chemin d'écran existe. Les chemins hors VRM (Gmail, iCloud, Réglages de l'iPhone,
Orion) ne sont pas jugés. `public/aide/` régénéré (`node scripts/aide-generer.cjs`), version servie
5.394.0. **Preuves** : rouge sur main (4 rouges), vert après ; `--prouve` **5/5** mutations rouges.

## (19) Les textes en dur hors tr()
Clés `src/i18n/langues/<l>/restes.js` (fr, en, es, it, de) :
- `src/prochainGesteAnnonces.js` (`pga.*`) : la règle pure appelle `t()` et pose son français
  (`ajouterSourceApp`) pour qu'un audit qui la lit seule lise le français ; nombres en texte (« 0/1500 »).
- « Quoi de neuf » : `src/QuoiDeNeuf.jsx` (`qdn.*`), et **chaque nouveauté** : le français EST
  `src/nouveautes.js` (`src/i18n/langues/fr/nouveautes.js` le recopie à l'import, une seule source) ;
  `en|es|it|de/nouveautes.js` : 187 titres + phrases. **Une nouveauté ajoutée sans ses quatre
  traductions rougit `audit-traduction` (D2, F2)** — le message dit le fichier.
  Les dates : mois court d'avant en français, `Intl` ailleurs.
- `src/facturationElectronique.js` (`fe.*`) : ce que l'écran DIT (état, raison, geste, manques
  affichés `manquesAffiches`). La facture PDF, le récapitulatif CSV/JSON et leurs manques restent
  **en français** (documents fiscaux français).
- Bandeau « Bordereau téléchargé il y a N min » et sa confirmation (App.jsx, `bordFrais.*`).
- `src/design/QuiDorment.jsx` (`qd.*`). Le geste proposé par ligne (`a.geste.t`, src/dormantes.js) reste en français.
- Périodes du livre et du registre : `src/periodeLangue.js` (`libellePeriodeLangue`) pour le CHOIX
  affiché (RegistresVue, Argent → Exporter) ; le titre des PDF garde `libellePeriode` (français).
**Règle F d'`audit-traduction`** : les six fichiers ajoutés ; une entrée peut porter `{ champs }`
(propriétés ou constantes dont la valeur est un texte affiché, conditions et gabarits compris) et
`@data-x` (l'élément JSX qui porte data-x) ; **F2** : nouveautés traduites, feuille par `tr()`,
périodes dans la langue. `--prouve` : un **témoin** (la copie sans mutation doit être verte — avant,
`--prouve` ne copiait pas `src/i18n/langues/fr/*` et chaque mutation rougissait d'office), **18/18**.
Rouge sur main : F1 et F2 (4 rouges).

## (18) « paire / article » dans chaque langue — `src/motsLangues.js`
`MOTS_LANGUES` : les 49 mots de `motsVendeur()` pour en/es/it/de (sneakers ⇒ pair/par/paio/Paar,
autre ⇒ item/artículo/articolo/Artikel ; les marques d'accord `e`/`es` valent '' : chaque traduction
écrit ses accords). `trm(clé, vars)` = `tr()` avec ces mots en variables ; en français ce sont
EXACTEMENT ceux de `motsVendeur()`. 30 textes passés (`src/i18n/langues/<l>/mots.js`, `mv.*`) :
masquées par Vinted (2), « Même paire ? » et sa feuille (7), achats en gros (6), conversations sans
article (2), emballer (2), doublons de N°, prix à baisser (2), « paires en ligne » (Ma journée, Stock),
Stock « Enlever du stock » et export, Statistiques (3), Messages « Peut-être la même paire ? »,
mise à jour des offres auto, N° Leboncoin, « Paires du lot » (2), « +X €/paire » ; Argent :
`motsLangue().noms` dans la phrase en morceaux. Les pluriels dont le mot change (nom/noms) sont deux
clés `.un`/`.plusieurs` (même règle `n > 1` que le français). `scripts/_source-app.cjs` rend
`trm('k')` à sa forme d'avant (`${motsVendeur().nom}`) pour les audits qui lisent le code en français ;
`audit-actions-serie` B9 et `audit-ligne-glissable` portés sur la règle (15/15 mutations).

## (17) L'extension — 5.394.0
- `vinted-sync-extension/_locales/{fr,en,es,it,de}/messages.json`, `default_locale: "fr"`.
- `T(clé, français, vars)` dans popup.js, vrm-badge.js, parcours-popup.js : `chrome.i18n.getMessage`
  (la langue du **navigateur** — l'extension ne lit pas le choix de l'app), le français écrit dans
  le code en repli (API muette ⇒ le texte d'avant). popup.html : `data-i18n` / `data-i18n-aria`.
- Traduit : la fenêtre (connexion, compte neuf, mise à jour, permission transporteurs), le diagnostic
  des favoris, et dans la carte du logo **la ligne d'état** (`resumeEtat`), les durées (`depuis`) et
  **tout le formulaire de connexion** (code, mot de passe, Google/Discord) — 141 textes.
- `scripts/extension-langues.cjs` écrit `_locales` depuis le code + `scripts/extension-langues-traductions.cjs` ;
  `--verifier` rougit si une clé manque une langue, si une variable diffère, si un fichier n'est pas à jour.
- `scripts/audit-extension-langues.cjs` : L1-L5 (à jour, aucun texte en dur hors T() dans les zones
  traduites, T() exécuté : repli français et traduction, zips avec `_locales`) ; `--prouve` **8/8** + témoin ;
  rouge sur main (4 rouges).
- `EXT_CAPACITES.langues = '5.394.0'` (`popup.js:traduirePage`), CODE_VERSION, manifeste, EXT_ATTENDUE,
  `extension-version.json`, zips (`node scripts/zip-extension.cjs`, un dossier).

## Preuves (machine partagée, 4 créneaux)
- `audit-traduction` 48/48, `--prouve` 18/18 + témoin ; `audit-chemins-aide` 11/11, 5/5 ;
  `audit-extension-langues` 6/6, 8/8 ; `audit-quoi-de-neuf`, `audit-onglets-d`, `audit-coherence`,
  `audit-ligne-glissable` (15/15), `audit-actions-serie` 30/30 verts. Les rouges restants des audits
  touchés sont les MÊMES que sur main (comparés un à un : revue-fin, coque-parametres,
  vendeur-generaliste, infos-vinted, vocabulaire-article, qui-dorment, dates-paris, aide-signalement).
- Banc `traduction-restes` : relevé du texte de 7 écrans à 390 et 1512 px, build de main contre build
  de la branche (R1), en anglais aucune clé brute (R2) ; captures regardées (voir la PR).

## Ce qui n'est pas fait (et pourquoi)
- **Carte du logo, le reste** : favoris (file, états), « Ce mois dans VRM », listes Favoris/Annonces/Ventes,
  détail des refus, mises à jour — ≈ 180 textes encore en français dans vrm-badge.js ; même chose pour
  vinted-infos.js (encart sur vinted.fr) et les notifications de background.js. La mécanique (T, _locales,
  générateur, audit) est en place : chaque zone ajoutée à `audit-extension-langues` L3.
- La langue CHOISIE dans l'app n'est pas lue par l'extension (chrome.i18n suit le navigateur).
- `src/dormantes.js` (le geste proposé par ligne d'« Articles qui dorment »), les autres usages de
  `motsVendeur()` hors des écrans traduits (≈ 280 : notifications, règles, écrans pas encore migrés).
- Relecture native des quatre langues.

Geste de Julien : installer l'extension 5.394.0 (remplacer le dossier, ⟳ ; Orion : `VRM-Orion-dossier.zip`).
