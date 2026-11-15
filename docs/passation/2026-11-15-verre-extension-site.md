# 15 nov. 2026 — « Verre dépoli » : la carte et la fenêtre de l'extension, le site public

Branche `claude/verre-extension-site` (partie de `origin/claude/project-review-nsk5su`). Pas de PR
(consolidation par la session principale). L'app elle-même : autre agent, `claude/verre-app`
(`src/design/studio-verre.css`).

## La décision de Julien

« J'aime la 9 » : la disposition **9 · Verre dépoli** pour toute l'app, l'extension et le site —
des panneaux de verre dépoli sur un bleu profond dégradé, le chiffre principal en blanc sur le fond,
tout ce qui se lit sur le verre. Couleurs gardées : encre `#0C1D30`, accent `#0060CC` rare, ambre pour
un geste à faire, Inter. Maquette : planche `dispo30/lot2/p09-verre` (CSS `.d9` de `d09.cjs`).

## Les valeurs (une seule famille, partout)

| | jour | nuit |
|---|---|---|
| dégradé | `linear-gradient(170deg, #1E5DA4 0%, #174C88 45%, #0F2F57 100%)` + deux halos bleus à 16 % | `linear-gradient(170deg, #133A68 0%, #0C2848 50%, #06142A 100%)` + un halo à 14 % |
| fond uni (dessous) | `#174C88` | `#0C2848` |
| verre | `rgb(247 250 253 / .9)`, `blur(26px) saturate(1.4)`, bord blanc .75, rayon 18–28 | `rgb(8 18 33 / .72)`, bord blanc .12 |
| verre opaque (sans flou, transparence réduite) | `#D7DEE6` | `#0E2139` |
| sur le bleu | blanc ; second texte `#EEF4FB` | blanc ; second texte `#D6E4F3` |
| sur le verre | encre `#0C1D30`, gris `#3F5468`, pâle `#4F6276`, lien `#0055B8`, ambre `#764300` | `#EAF2FB`, `#A9BBCF`, `#8FA3B9`, `#6CB4FF`, `#F2B65E` |
| bouton plein | sur le bleu : **blanc** à l'encre ; sur le verre : encre (la nuit : blanc) | blanc à l'encre |

Écart assumé avec la maquette : le verre est à **90 %** (la maquette : 74 %). À 74–86 %, le gris
`#3F5468` en 12 px tombait sous 4,5:1 sur la partie la plus sombre du dégradé (mesuré : 4,42 puis
4,45:1 dans le formulaire de connexion) ; les halos clairs de la maquette (`#9CC8F2` plein) ont été
ramenés à 16 % pour que le blanc du titre garde l'AA partout.

## Ce qui a changé

### L'extension (`vinted-sync-extension/`)
- **`vrm-badge.js`** (la carte du logo, shadow root fermée) : un bloc « 5.386 — VERRE DÉPOLI » à la
  fin de la feuille, sous les mêmes noms de jetons. La carte (et la question « c'est bien un de tes
  comptes ? ») est un panneau au dégradé, **opaque** (couleur unie dessous, aucun `backdrop-filter`
  sur la carte : la page Vinted ne se voit jamais à travers) ; « VRM » et la version en blanc sur le
  bleu ; **chaque ligne** (`.contenu > *` : les quatre lignes, « Capté », les listes, les liens du site,
  la sécurité du compte, le mois, « Détails ») et la connexion (`.carte > .connexion`) sont des
  plaques de verre posées sur ce dégradé. Le plein posé sur le bleu est blanc ; la touche, du verre.
  « VRM a capté » : une plaque de verre peinte sur le même dégradé (opaque). Sans flou
  (`@supports not`) ou transparence réduite : verre opaque.
  Mode cadre (l'iframe `popup.html?mode=carte`) : la connexion n'y repeint pas de plaque (elle est
  déjà posée dans la plaque de la carte du site) — fond transparent, comme avant.
- **`popup.html`** (la fenêtre, et la page `?mode=onglet`) : fond au dégradé, « Connexion à VRM » en
  blanc, la connexion (`#auth`), la mise à jour et le diagnostic sur des plaques de verre ; boutons
  pleins d'encre (la nuit : blancs), Inter. `?mode=carte` inchangé (transparent).
- Rien d'autre : mêmes liens (`CHEMINS_ATTESTES`), mêmes données, mêmes garde-fous, mêmes textes.
  Les deux chemins de connexion : iframe (Chrome, Edge, Firefox) et carte dessinée (Orion).

### Le site public
- **Accueil** (`src/accueil/accueil.css`, bloc final) : un fond FIXE au dégradé (`.av:before`, opaque,
  iPhone compris) ; titres, chiffre et phrases du haut en blanc ; tuiles des fonctions, panneaux,
  offre Solo, calculateur du temps gagné, questions et plaque de fin sur du verre (texte à l'encre) ;
  l'offre Pro garde sa carte d'encre ; barre du haut en verre BLEU quand on défile. Un seul plein par
  vue : « Essayer gratuitement » blanc sur le bleu ; la touche « Découvrir avec des exemples » est du
  verre FUMÉ (fond bleu-nuit translucide, mot blanc, bord blanc) — un verre clair comptait comme un
  second plein ; posée sur une plaque (la fin de page), elle redevient la porcelaine à l'encre. Contenu, captures, prix : inchangés.
- **Tarifs** (`src/design/studio-reste-public.css`, bloc final) : la même chose (offres, tableau,
  frise, cartes sur verre ; Pro sur l'encre).
- **Pages légales** (`public/legal/legal.css`), **centre d'aide** (`public/aide/aide.css`), **la
  confiance** (`public/confiance.html`) : fond dégradé, le document (ou chaque liste) sur du verre.
- **Page partenaire** `/pa/…` (`src/partenaires/partenaires.css`, `.vrm-pp` seulement) : le titre et
  LE chiffre (« reste à recevoir ») en blanc sur le bleu, le lien et l'historique sur du verre. Les
  réglages Partenaires de l'app (`.vrm-pt-*`) ne bougent pas (l'app est à l'autre agent).
- **Image de partage** (`scripts/accueil-og.cjs` → `public/og-vrm.jpg`) : refaite au dégradé, la
  promesse en blanc, « vrm.center » sur le plein blanc ; même capture du mode exemple, mêmes mots.
- L'écran de connexion (`AuthScreen`, dans `src/App.jsx`) vit dans l'app : laissé à `claude/verre-app`.

### Les e-mails (ajout du coordinateur : « intègre les e-mails à l'agent design »)
- **Une forme commune** : `api/_lib/mail-verre.js` (jetons `VERRE`, `styleVerre`, `teteVerre`,
  `boutonVerre`, `codeVerre`, `enveloppeVerre`). Un e-mail n'a pas de `backdrop-filter` : le verre se
  rend par un FOND bleu profond (couleur unie `#174C88` — ce que montre une boîte qui retire les images
  de fond — et le dégradé en image de fond), le logo HÉBERGÉ (`https://vrm.center/vrm-logo-v5-192.png`,
  jamais en base64) + le mot « VRM », le TITRE en blanc sur le bleu, une CARTE blanche arrondie (22) à
  l'ombre douce où le texte est à l'encre, UN plein d'encre de 48 px, le pied en clair sur le bleu.
  Tableaux, styles en ligne, 600 px (table fantôme d'Outlook), Inter puis la police du système, aucune
  feuille externe ; sombre par `prefers-color-scheme` ET `[data-ogsc]`/`[data-ogsb]` (bleu-nuit, carte
  `#0E2139`, texte clair, plein blanc).
- **Les e-mails de VRM** (`api/_lib/mail-gabarit.js`, `gabaritMail` — même contrat d'appel) : essai
  j1/j3/j6, bilan du mois, preuve d'adresse, facture Pro (le NOM de la boutique en tête, rien de VRM, ni
  logo), essai de la boîte des factures, e-mail d'essai, suppression prévue / faite, fin d'abonnement.
  Contenu, liens, échappement, pied (« ne plus recevoir », « Gérer mes e-mails », éditeur seulement
  s'il est rempli) : inchangés.
- **Les six modèles de compte Supabase** (`supabase/templates/*.html` + `sujets.json`, fabriqués par
  `node scripts/modeles-email.cjs --ecrire`) : la même forme ; un document entier par langue
  (`{{ if $en }}…{{ else }}…{{ end }}`, `lang` juste) ; le code `{{ .Token }}` EN GRAND (38 px, chiffres
  espacés par l'interlettrage, sélectionnable). Variables vérifiées contre la doc Supabase (Auth → Email
  Templates) : `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .TokenHash }}` (récupération, page
  `recuperation.html`), `{{ .Email }}`, `{{ .NewEmail }}` (changement d'adresse seulement),
  `.Data.langue`. **PAS collés dans Supabase** (geste de Julien, avec sa clé) : Authentication → Emails →
  Templates, un onglet par fichier (`sujets.json` donne l'onglet et le sujet).
- Preuves : **`scripts/audit-emails-verre.cjs --prouve`** EXÉCUTE chaque gabarit (11 e-mails de VRM + 6
  modèles × fr/en) : forme commune telle quelle (F1), un plein (F2), styles en ligne et 600 px (F3),
  logo hébergé seulement (F4), < 100 Ko (F5, le plus lourd : ~16 Ko), sombre (F6), variables Supabase et
  code en grand (F7), contrastes AA des jetons (F8 : encre/blanc 17,0 · gris 7,8 · lien 7,0 · titre blanc
  sur le bleu 8,7 (haut du dégradé 6,7) · pied 6,7 (5,1) · nuit 14,4 / 8,3 / 7,4 / 11,5), aucun violet
  (F9) ; 12 mutations, toutes vues. `audit-modeles-email --prouve` (rendu par le vrai moteur de Go,
  10 mutations) et `audit-mails-envoyes` (92/0) passés à la nouvelle forme (leurs contrôles « bouton bleu
  Apple 44 px / 520 px / aucune image » jugent désormais la forme commune).
- Rendus : `node scripts/mails-apercus.cjs <dossier>` (24 e-mails dont les 12 modèles Supabase fr/en ;
  390 et 600, clair et sombre, et 600 SANS IMAGES).

## Preuves

Banc neuf **`scripts/bancs/verre-extension-site.cjs`** (`--carte`, `--fenetre`, `--site`) : il juge
la règle sur ce que Chromium **calcule et peint** — le texte rendu transparent, la capture lue sous
chaque bout de texte (5ᵉ centile des pixels), 4,5:1 (3:1 en grand) ; une ligne coupée par un
conteneur qui défile n'est lue que sur sa partie visible.
- C1 dégradé bleu profond (contenu caché, haut ≠ bas, un vrai bleu) · C2 lignes en verre ·
  C3 **opaque** : la même carte sur une page blanche et une page noire ⇒ mêmes pixels (écart 0) ·
  C4 AA de chaque texte · C5 transparence réduite ⇒ verre opaque · C6 connexion iframe ET dessinée
  (Orion) sur du verre, AA (cadre compris) · F la fenêtre · S accueil, tarifs, CGV, aide, confiance
  (390 et 1512, clair et sombre) : fond, plaques, titre blanc, AA de chaque texte en défilant toute la
  page, un seul plein au premier écran.

RÉSULTATS : voir la fin de ce fichier.
