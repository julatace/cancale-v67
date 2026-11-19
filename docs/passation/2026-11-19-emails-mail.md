# 19 nov. — E-mails comme Mail + « Relier ma boîte » accompagné (branche `claude/emails-mail`)

> **À l'agent `claude/app-tableaux`** : ce lot PREND l'écran E-mails (tu l'avais « si le temps le permet »).
> Ton `TableauTravail` n'était pas sur `claude/integration-19nov` quand ce lot est parti (seulement en local dans ton
> worktree) : l'écran est fait avec les briques du natif (`Segmente`, `Groupe`, `Rangee`, `Bouton`, `Feuille`, `Vide`,
> `Attente`, `Plaque`) et ses propres rangées `n-mail-*`. Ne touche pas `src/BoiteEmails.jsx` sans fusionner ceci.

## Demande de Julien

« L'onglet e-mails est absolument catastrophique, les e-mails sont moches, et quand je ne clique sur rien tout est
regroupé à gauche, condensé. "À traiter · Colis · Ventes" peut être en haut et prendre toute la largeur, et après on a
le beau mail directement dans l'application. » — « Relier la boîte mail : un processus beaucoup plus accompagné,
beaucoup plus simple. »

## Ce qui est livré

1. **La boîte (src/BoiteEmails.jsx, src/emails-mail.css, classes `n-mail-*`, jetons `--n-*`, couche `vrm-natif`)**
   - en haut, sur toute la largeur : le segmenté **À traiter · Colis · Ventes · Achats · Tout** (le `Segmente` du
     natif, nombres seulement s'ils sont complets, comme avant), puis recherche, compte, « Relier ma boîte »
     (ordinateur) et « ⋯ » (feuille : Non lus, Codes, Offres, Tout marquer lu, Sélectionner, Relier ma boîte) ;
   - la liste : **expéditeur (ou plateforme), sujet, ce que VRM a compris en UNE ligne, date** ; le code de retrait
     copiable à droite ; plaque du N° LU ; ambre seulement pour un geste proche / à vérifier ;
   - **sans sélection, la liste prend toute la place** ; à l'ordinateur (≥ 1024, `useOrdinateur`) une rangée par
     e-mail, colonnes expéditeur | sujet — compris | date ; **un e-mail ouvert ⇒ deux volets** (liste 340–400 |
     lecture collante). Au téléphone la lecture est une feuille opaque (`FermeAuRetour`).
   - l'ancienne classe `.vrm-boite` n'est plus sur l'écran : les ~60 règles `:root:root… !important` de
     studio-reste.css / studio-verre.css / anciens-ecrans.css ne l'atteignent plus.
2. **L'e-mail ouvert** : sujet, expéditeur, compte, date ; puis **« Ce que VRM a compris »** (le titre en mots
   simples, l'article, le N° lu sur sa plaque, le code de retrait en 48 px + « Copier le code », le point, la date
   limite ambre si proche, le montant, « à vérifier » + quoi faire, les gestes PAR IDENTITÉ — le principal est LE
   plein —, « Relié par … · Dans VRM : … ») ; puis le **message d'origine** (HTML assaini dans `CadreEmail`, images à
   la demande, liens `_blank noopener` ; sinon le texte en éléments React) ; pièces jointes ; ligne De/Reçu sur/date.
   « Ranger » / « Sortir » et « Marquer non lu » dans la barre. « C'est à moi » reste sur les e-mails à rattacher
   (même route, même session).
3. **« Relier ma boîte » accompagné (src/RelierMaBoite.jsx, src/relierMaBoite.js, src/relier-ma-boite.css)** :
   une étape par écran — la messagerie (Gmail, Outlook, iCloud, Autre ⇒ Orange, Free, Yahoo, une autre ; celle du
   domaine de ses adresses marquée « Détectée ») → **l'adresse VRM, copiée d'un toucher** → les gestes de SA
   messagerie (Gmail 4, Outlook 3, iCloud 3, Orange 2, Free 2, Yahoo 3, autre 3), chacun avec une **capture
   dessinée** (fenêtre neutre « exemple dessiné », aucune vraie capture, aucun logo) et UN geste (ouvrir la page de
   réglages, copier l'adresse, copier « vinted », le code envoyé par la messagerie affiché tout seul) → **l'e-mail
   d'essai** (objet « Essai VRM XXXX », mailto ou « Copier l'objet ») guetté toutes les 5 s → **« Reçu ✓ »** quand
   la route range CE code (`etatEssai`, une identité, jamais une heure) ou que le compte choisi est prouvé
   (`Verification`). « Étape n sur N », Retour, reprise sur l'appareil (`vrm_relier_ma_boite`).
   Lecture seule de `GET /api/email-rattacher?mode=adresse-unique` (hook `useAdresseVrm`, exporté de
   AdresseReception.jsx) ; aucune nouvelle fonction `api/`, aucune écriture ; preuve d'adresse par lien inchangée.
   Adresse pas ouverte ⇒ « Bientôt disponible », ce qui manque (propriétaire), et l'ancienne scène vers la boîte
   collective comme avant (`pret === false`).
4. Textes : `src/i18n/langues/*/emailsMail.js` (161 clés, 5 langues) ; `audit-traduction` surveille
   RelierMaBoite.jsx (tout) et les fonctions refaites de BoiteEmails.jsx. Quoi de neuf : `emails-mail`,
   `relier-boite-guide`.

## Preuves

- Banc `scripts/bancs/emails-mail.cjs` (390 tactile, 1280, 1512, clair et sombre ; base de 64 e-mails inventés de la
  vraie forme et base vide) : A segmenté en haut pleine largeur · B liste ≥ 92 % sans sélection · C expéditeur /
  sujet / compris une ligne / date · D deux volets ou feuille opaque, « compris » avant l'origine, code ≥ 40 px,
  point, limite, Ranger, HTML dans le cadre, images à la demande, geste par identité + plaque · E contrastes ≥ 4,5
  sur le fond rendu, ≥ 13 px, cibles ≥ 44, un seul plein, rien de coupé, pas de défilement de côté · F parcours
  Gmail complet jusqu'à « Reçu ✓ », aucun POST. Résultats : voir la fin de ce fichier.
- Audits verts : traduction, tdz, variables, quoi-de-neuf, boite-emails, boite-mail, emails-html, emails-transfert,
  relier-compte (R6 mis à jour : LE parcours de l'écran est `RelierMaBoite`), email-rattacher, journal-emails,
  stockage-sur, icones.

## Restes faits (19 nov., soir, demande du coordinateur)

1. **Un seul parcours.** Paramètres → Mes e-mails → « Mon adresse VRM » ouvre `RelierMaBoite` dans sa feuille
   (`FeuilleAdresseReception`, src/AdresseReception.jsx réduit à la feuille et à son entrée). « Adresse active » et
   « Remplacer l'adresse » vivent DANS le parcours (repliés sous « Réglages de l'adresse »), sur les MÊMES gestes de la
   MÊME route : POST `{ geste: 'actif', actif }` et POST `{ geste: 'remplacer' }` (Remplacer demande un second toucher).
   L'ancien `ParcoursAdresseVrm` (barre 1·2·3·✓) est RETIRÉ ; sa lecture `useAdresseVrm` est passée dans RelierMaBoite.jsx.
2. **L'ancien panneau « Aperçu · Journal · Adresses · À rattacher »** (`reglages` de l'écran : `AdressesSansCompte` +
   `EmailsSetting`) est rangé sous le parcours, replié derrière une rangée natif « Réception des e-mails » ; il ne se
   monte qu'à SON toucher (ou quand l'ancienne scène demande « Mes adresses »). Il garde son dessin d'avant (exclu du
   pont `revert-layer`).
3. **Les mots de src/boiteEmails.js par `tr()`, 5 langues** : les règles restent écrites et jugées en français (les
   gestes se reconnaissent à leur mot) ; `enClair(mot)` traduit à l'AFFICHAGE — table des mots fixes (natures, gestes,
   « détail non gardé », jours) et formes à trou (« code {x} », « avant le {x} (demain) », « tu reçois {x} », « Voir le
   N°{x} », identités « colis n° {x} »…). Clés `bm.*` (src/i18n/langues/*/emailsMail.js). Les familles rangées par le
   serveur (`r.f`) et les dates courtes (« 9 nov. ») restent telles que lues.
4. **Bancs réécrits sur le nouvel écran** : `boite-emails` (en entier), `design-v2-messages` (partie E-mails : E1
   compare à la route — il n'y a plus de boîte « d'hier » ni de dessin « éteint » pour E-mails ; E3 : plus de bouton de
   geste dans les rangées), `adresse-reception` (A–D sur le parcours accompagné, C avec les réglages de l'adresse ; au
   téléphone Paramètres montre des tuiles : la ligne se trouve par la recherche des réglages), `emails-densite`.
   **Règle remplacée, sur la demande de Julien du 19 nov.** : « le sujet brut n'est sur aucune ligne » (5 nov.) ⇒ la
   ligne porte l'expéditeur, le SUJET d'origine, ce que VRM a compris en une ligne, la date. **Deux mesures de densité
   remplacées aussi** : « la liste fait 340–420 px » ⇒ sans sélection elle prend toute la place (340–440 seulement en
   deux volets) ; « le code ≤ 34 px » ⇒ le code de retrait EN GRAND (≥ 40 px), demandé le 19 nov. À 1280 px l'e-mail HTML
   tient dans le volet (échelle ≤ 1) ; à 1512, taille naturelle.
   Ajout à `src/natif/Segmente.jsx` : `attrs` par choix (des data-* ; aucune API cassée).

## Résultats (19 nov., fin du lot)

- `node scripts/bancs/emails-mail.cjs` sur le build de la branche : **111 verts, 0 rouge** (6 combinaisons × boîte,
  vide, relier). Captures regardées (liste, lecture, vide, chaque écran du parcours, « Reçu ✓ ») à 390 / 1280 / 1512,
  clair et sombre.
- **Le même banc sur l'écran d'AVANT** (src/BoiteEmails.jsx du train, `BANC_DIST`) : **15 rouges** — entre autres
  « B — la liste prend 64 % de la largeur utile, colonne de lecture vide affichée », segmenté absent, sujet absent des
  rangées, code de retrait à 28 px, cibles de 36 px, pas de parcours `[data-relier-ma-boite]`.
- Trouvé en route : `:where(.vrm-app-shell) button { background: var(--fu-remplir) }` (sans couche) repeignait en
  gris les rangées et les boutons natifs de l'écran (CDP `getMatchedStylesForNode`) ⇒ pont `all: revert-layer` en
  tête de src/emails-mail.css (même principe que src/coque-native.css), sans valeur ni `!important` hors du champ de
  recherche et du menu du compte (règle d'avant en `!important`, passée par `#vrm-contenu`).
- Build : `NODE_OPTIONS=--max-old-space-size=6144` nécessaire (le tas par défaut de 2 Go casse `vite build`).
