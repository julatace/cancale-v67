# 11 novembre 2026 — La traduction de VRM (fr · en · es · it · de)

Branche `claude/traduction`. Décision de Julien (11 nov., 14 h 40), qui **remplace**
le refus « International » du 28 oct. (CLAUDE.md §3) : traduire **toute** l'app en
anglais, espagnol, italien, allemand, compta comprise. Ce lot pose **la base** et
migre **les premiers écrans** ; il ne change **aucune règle de calcul** (la compta
par pays est un lot d'étude séparé, `fiscalite-pays`). L'argent reste en euros.

## Ce qui est livré

### L'infrastructure — `src/i18n/` (aucune dépendance)

| fichier | rôle |
|---|---|
| `src/i18n/index.js` | `t()` / `tr()`, pluriels (`Intl.PluralRules`), formats (`nombre`, `monnaie` — euro par défaut, `null` ⇒ « — » —, `date`, `heure`, `dateRelative`, `listeDansLaLangue`), la langue courante, son chargement, `<html lang>` |
| `src/i18n/react.js` | `useLangue()` (`useSyncExternalStore`) : redessine au changement |
| `src/i18n/langues/fr.js` | **la source** (dans le JS initial) |
| `src/i18n/langues/{en,es,it,de}.js` | chargées **à la demande** (`import()`, un morceau Vite chacune) |
| `src/i18n/ChoixLangue.jsx` | le petit sélecteur des pages sans compte (accueil, connexion) |

- **La langue** : le choix du vendeur (Paramètres → Affichage → **Langue**, rangé dans
  `vrm_langue`, ajouté à `SYNC_KEYS` : la même sur tous ses appareils) ; sans choix, la
  langue du navigateur si elle est parmi les cinq (`de-AT` ⇒ `de`), sinon le français.
  Une valeur rangée inconnue est ignorée. Relue du nuage (`vrm:save`, `distant`) ou d'un
  autre onglet (`storage`) ⇒ appliquée tout de suite.
- **Le démarrage** : `src/main.jsx` attend la langue (`preparerLangue`, 2 s au plus ;
  le français n'attend rien) avant le premier rendu — jamais un écran qui saute du
  français à l'anglais. La racine (`Racine`) appelle `useLangue()` : tout l'arbre se
  redessine au changement, **sans rechargement**. Un composant mémorisé (`React.memo`,
  un `useMemo` qui calcule un libellé) doit appeler `useLangue()` lui-même.
- **Repli** : une clé absente d'une langue retombe sur le français, jamais sur un blanc ;
  une clé absente du français rend la clé elle-même (l'audit le refuse).
- **`t` ou `tr`** : dans `App.jsx` et les gros écrans, `t` est un nom de variable local
  partout (`.find(t => …)`) : on importe **`tr`** (même fonction). `tr` est aussi pris
  localement à deux endroits d'App.jsx (traduction des messages, `const [tr, setTr]`)
  — sans conséquence, ces fonctions n'appellent pas la traduction.

### Les écrans migrés (461 clés)

- **La coque** : barre du bas, colonne de l'ordinateur, menu « Plus » / « Tous les écrans »,
  titres de la coque (`titreEcran`), libellés d'accessibilité. Les entrées de navigation
  gardent leur `label:'…'` français dans le source (des audits les lisent) mais
  `entreeNav()` le remplace par un **accesseur** vers `tr('nav.<id>')` ; les groupes
  (`groupeNav`) gardent leur identité française dans `g.nom` (`data-nav-groupe`, clés
  React, `'Moi'`) et affichent `g.titre` traduit. ⚠️ Ne pas recopier une entrée par
  `{...e}` au chargement du module : la copie figerait le nom (passer par `entreeNav`).
- **Le menu du profil** (`src/profil/MenuProfil.jsx`).
- **Paramètres** : la liste entière (titres de groupes, chaque ligne `lib`/`desc`/`val`,
  pieds, dépannage, recherche, onglets Réglages · Mon compte · Abonnement, carte du
  profil, widget) + **la ligne Langue** (`LangueSetting`, la liste d'iOS de
  l'Apparence, chaque langue écrite dans sa langue). Pas encore : le CONTENU des
  sous-panneaux (`NumerosSetting`, `PushSetting`, `ImprimanteSetting`…), et les mots
  de `src/libelles.js` (`L.comptesLies`, `L.emails`, `L.statut`…).
- **Connexion / inscription / mot de passe** (`AuthScreen`, `CaptchaConnexion`,
  `LiensLegaux`, `DOCS_LEGAUX` par accesseur) + le sélecteur de langue sous le formulaire.
  Pas encore : `mapMailError` (les erreurs de Supabase mises en français),
  l'écran de double vérification, `PorteNouveauOAuth`.
- **Les écrans d'erreur** : `DernierFilet` (`src/main.jsx`), `GardeEcran`.
- **La page d'accueil publique** (`src/Accueil.jsx`) : tout le texte, les `alt` des
  captures, le prix dans le format de la langue (« €16.99 » ; en français la valeur des
  CGV telle quelle), la liste des navigateurs par `Intl.ListFormat` hors français, la
  phrase des offres (en français CELLE du serveur `OFFRES`, ailleurs sa traduction —
  `audit-traduction` D9 vérifie que la copie française ne diverge pas), un sélecteur de
  langue dans le pied. ⚠️ Les **captures** de l'app (`public/accueil/*.webp`) restent en
  français ; les **documents légaux** (CGV, CGU, confidentialité) restent en français
  (droit français, à faire relire avant toute traduction) — seuls leurs NOMS sont traduits.

### Pas fait dans ce lot (dit, pas caché)

- **L'extension** (carte du logo, fenêtre `popup.html`) : elle a son propre code
  (`vinted-sync-extension/`, scripts de contenu sans modules) ; la traduire veut dire
  `chrome.i18n` (`_locales/`) ou une copie refabriquée du dictionnaire, puis une version
  publiée (5.345), le zip, `EXT_ATTENDUE`. Pas « simple » : lot séparé, à faire après
  que l'app est migrée (les mots doivent être les mêmes des deux côtés).
- **Les e-mails de compte** (`src/langueCompte.js`, modèles Supabase) : ne connaissent
  que `fr`/`en`. À aligner sur `vrm_langue` (lot séparé, modèles Supabase à écrire).
- **Les notifications du serveur** (`api/push.js`, phrases dans `api/_lib/`) : en français.
  Le serveur devra lire `vrm_langue` du vendeur (ligne `main`) — lot séparé.
- **Tous les autres écrans** : voir l'ordre ci-dessous.

## La méthode — migrer le reste écran par écran

### Ordre conseillé (du plus transverse au plus métier)

1. **Les composants partagés** : `Bouton`, `ScreenHead`, `SheetShell`, `EtatPanne`,
   `ChampRecherche`, `Segmente`, `askConfirm`/`askText` (les boutons OK/Annuler), les
   toasts communs, `src/libelles.js` (`L.*`), `src/phrasesEcran.js` (`PHRASES_ECRAN`),
   les fiches d'aide (`src/aideFiches.js`).
2. **Les sous-panneaux de Paramètres** (même fichier, déjà commencé).
3. **Ma journée** (l'écran qu'on ouvre le plus), puis **Colis**, **Ventes**,
   **Annonces**, **Messages**, **Achats**, **Stock**.
4. **Argent / Compta / URSSAF** — les TEXTES seulement ; « URSSAF », « micro-entreprise »,
   les taux restent ce qu'ils sont (règle française), la page le dira dans la langue.
5. Les écrans par site (eBay, Leboncoin, Vestiaire), Communauté, E-mails.
6. L'extension, les e-mails de compte, les notifications du serveur.

### Règles de clés

- Clé = `<écran>.<élément>[.<précision>]`, en minuscules, `camelCase` après le point :
  `reglages.langue.lib`, `auth.err.motDePasse`, `accueil.faq.arret.q`. **Jamais le texte
  lui-même** (il changera). Le préfixe est celui de l'écran (`journee.`, `colis.`,
  `ventes.`…) ; ce qui sert partout va dans `commun.` (`commun.fermer`, `commun.reessayer`).
- Une phrase = UNE clé, avec ses variables : `tr('auth.renvoyerDans', { s: 12 })` pour
  « Renvoyer dans {s} s ». Ne JAMAIS couper une phrase en morceaux traduits à part
  quand on peut l'éviter (l'ordre des mots change d'une langue à l'autre). Quand un
  morceau doit être en gras ou un lien, découper en `.1/.2/.3` et le dire dans fr.js.
- Un nombre qui fait varier la phrase ⇒ un **pluriel** :
  `"reglages.recherche.trouves": { one: "{n} réglage trouvé", other: "{n} réglages trouvés" }`
  et `tr('reglages.recherche.trouves', { n })` (`n` ou `count`). Un nombre interpolé est
  formaté dans la langue (1 234 / 1,234 / 1.234).
- Montants : `monnaie(x)` (euro) ; dates : `date(d)`, `heure(d)` — jamais
  `toLocaleString('fr-FR')` dans un écran migré.
- Les **données** (titres d'annonces, pseudos, messages des acheteurs, adresses) et les
  **noms propres** (VRM, Vinted, Leboncoin, eBay, Vestiaire Collective, URSSAF, Mondial
  Relay…) ne passent jamais par `tr()`.
- Les attributs `data-*` et les identifiants restent en français (les bancs les lisent) :
  on traduit ce qu'on LIT, pas ce qu'on mesure.

### Comment ajouter un texte (le geste de chaque futur lot)

1. Écrire la clé et le texte français dans `src/i18n/langues/fr.js` (dans sa section).
2. Écrire la MÊME clé dans `en.js`, `es.js`, `it.js`, `de.js` (tutoiement : « you »,
   « tú », « tu », « du » ; vocabulaire : bordereau = shipping label / etiqueta de envío /
   etichetta di spedizione / Versandetikett, point relais = pickup point / punto de
   recogida / punto di ritiro / Paketshop, annonce = listing / anuncio / annuncio /
   Anzeige, N° de rangement = storage number / número de almacenaje / numero di
   magazzino / Lagernummer). L'allemand court : ≤ 160 % du français.
3. Dans l'écran : `import { tr } from '…/i18n/index.js'` et `{tr('ecran.cle')}`.
4. `node scripts/audit-traduction.cjs` (et `--prouve` si on touche l'audit).

### Migrer un fichier entier

```bash
node scripts/i18n-extraire.cjs src/ecrans/Stock.jsx --prefixe stock [--fonction StockScreen]
```

L'outil (lecture seule) liste chaque texte visible (texte JSX, `placeholder`,
`aria-label`, `title`, `alt`, `lib`/`desc`/`titre`/`pied`, `toast`/`setErr`/`setInfo`,
littéraux rendus), propose une clé (une clé déjà dans fr.js pour le même texte est
réutilisée), signale les gabarits `${x}` (⇒ `{x}` + `tr('…', { x })`) et sort le bloc
à coller dans fr.js. On remplace ensuite à la main (ou par un script de remplacements
EXACTS, comme ce lot : chaque remplacement vérifie qu'il trouve son texte une fois),
on traduit, puis on **ajoute le fichier (ou la fonction) à `MIGRES`** dans
`scripts/audit-traduction.cjs` : à partir de là, un texte français remis en dur rougit.

⚠️ Avant de déplacer un texte, `grep` le dans `scripts/` : des audits lisent des phrases
dans le SOURCE (ce lot en a adapté six pour l'accueil : ils lisent aussi
`src/i18n/langues/fr.js`). Juger la règle, pas l'orthographe (§6.4).

## Les preuves

- `npm run build` vert ; les quatre langues sortent en morceaux séparés (`dist/assets/en-*.js`…).
- `node scripts/audit-traduction.cjs` : dictionnaires (clés, formes, pluriels, variables,
  longueurs, barre du bas ≤ 12 caractères, phrase des offres = serveur), clés appelées,
  aucun texte en dur dans les fichiers de `MIGRES`, la règle exécutée (repli, pluriels,
  formats, langue du navigateur). `--prouve` : 11 mutations, toutes rouges.
- Les audits touchés par le déplacement des textes de l'accueil (`audit-accueil-navigateurs`
  — ses 9 mutations visent maintenant fr.js et restent rouges —, `audit-plans-solo-pro`,
  `audit-vendeur-generaliste`, `audit-chrome-en-dur`, `audit-profil-oauth`) : verts.
- La batterie complète des audits (`scripts/audit-*.cjs`) passée sur `main` et sur la
  branche : voir le rapport de fin de session.
- Banc `scripts/bancs/traduction.cjs` (données inventées, harnais de `nouveau-vendeur`) :
  accueil, connexion, inscription, coque, « Plus », Paramètres, panneau Langue, dans les
  cinq langues à 390 px tactile et 1512 px ; `<html lang>`, texte = dictionnaire, aucune
  clé brute, aucun débordement / titre coupé / bouton court sur deux lignes / cible < 44 px,
  changement de langue SANS rechargement avec `vrm_langue` rangé. Captures regardées.

## Gestes de Julien

Aucun. (Plus tard, pour aller au bout : faire relire les traductions par un locuteur
natif de chaque langue avant d'ouvrir VRM hors de France, et décider de la traduction
des CGV/CGU — un texte juridique ne se traduit pas sans relecture.)
