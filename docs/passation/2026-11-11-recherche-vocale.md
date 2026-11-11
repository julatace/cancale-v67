# Parler à la loupe — 11 nov. 2026

Branche `claude/recherche-vocale` (depuis `origin/main`). Mission : un micro sur la
loupe de la recherche universelle et sur le champ de recherche des écrans de liste ;
la reconnaissance vocale DU NAVIGATEUR (§2.9 : aucune clé, aucun serveur à nous),
la transcription en direct, puis la recherche existante ; un N° dit ouvre
directement l'article si son identité est unique (§5).

## Ce qui existait déjà (3–6 nov.)

- `src/rechercheVocale.js` : `requeteDeLaVoix` (« numéro 124 », « cent vingt-quatre »
  ⇒ 124 ; « B 125 », « bé 125 » ⇒ B125 ; le reste tel quel), son audit
  `audit-recherche-vocale.cjs`.
- `MicDictee` (App.jsx) sur la loupe (ordinateur et téléphone), le Stock, la réponse
  aux messages ; le micro de `ChampRecherche` (Annonces, Messages).
- Pas de transcription en direct (`interimResults:false`), un micro refusé disparaissait
  **sans un mot**, un N° dit remplissait seulement la loupe, deux moteurs de dictée
  recopiés (MicDictee et ChampRecherche).

## Ce qui change pour lui

1. **Un seul moteur** : `src/dicteeNavigateur.js` (`ecouter`, `voixDisponible`,
   `PHRASES_VOIX`, `POURQUOI_VOIX`, état par canal). `MicDictee` et `ChampRecherche`
   l'utilisent tous les deux. Toujours `fr-FR`, toujours la Web Speech API.
2. **En direct** : ce qui est entendu s'écrit dans le champ pendant qu'il parle ; la
   loupe dit « J'écoute… » puis « J'entends : « cent vingt » ». Le texte final passe
   par `requeteDeLaVoix` (une fois : `audit-parler-loupe` le prouve).
3. **Un N° dit ouvre SA fiche** (loupe) : `ficheDeLaVoix` — l'identité `cleNum`
   (« 007 » = « 7 », « B125 » ≠ « 125 ») doit être portée par UNE seule fiche parmi
   TOUTES, d'un compte affiché. Deux fiches au même N°, aucune, un compte écarté ⇒ la
   loupe montre la liste (« Tout sur le N°7 », les deux articles). Un texte ne désigne
   jamais une fiche (50 paires au même titre : la recherche normale).
4. **Tailles dites en lettres** : « Nike rouge quarante-deux » ⇒ « Nike rouge 42 »,
   « nike taille quarante deux » ⇒ « nike taille 42 » (`taillesEnChiffres` : après
   « taille »/« pointure », ou un 16–50 qui finit la phrase). « deux nike », « douze
   paires noires », « air max quatre-vingt-dix » restent des mots (rien deviné).
5. **Appui long sur la loupe (téléphone)** : 550 ms ⇒ la recherche s'ouvre et écoute
   (même canal que le micro : re-toucher arrête) ; relâcher ne referme pas ; un
   toucher court reste un toucher (ouvre sans écouter). Sans reconnaissance, l'appui
   long ne fait rien de plus (`data-recherche-loupe-voix="0"`).
6. **Micro refusé ⇒ une phrase** : « Micro refusé par le navigateur : autorise-le pour
   ce site (cadenas à gauche de l'adresse) puis recharge, ou tape ta recherche. » —
   dans la loupe (elle reste), sous le champ de liste, en toast ailleurs ; puis le
   micro disparaît pour la session. « Rien entendu », réseau, micro absent : chacun
   sa phrase ; un arrêt voulu ne dit rien.
7. **« Pourquoi ? »** (loupe, sous « À la voix : … ») : VRM n'enregistre ni n'envoie
   aucun son ; selon le navigateur, la reconnaissance peut passer par le service de son
   éditeur (Google/Chrome, Microsoft/Edge, Apple/Safari) ; sans reconnaissance
   (Firefox, certains Safari), pas de micro.
8. **Micro ajouté** aux champs : Ventes (les deux champs), Achats, ventes Vinted
   (liste), annonces eBay, réception des e-mails, e-mails à rattacher, recherche des
   réglages (ces trois en `voix="brut"` : pas de conversion en N°).

## Le code

| fichier | quoi |
|---|---|
| `src/dicteeNavigateur.js` (nouveau) | le moteur commun |
| `src/composants/voix.jsx` (nouveau) | `useEtatVoix`, `LigneVoix` (la ligne de la loupe) |
| `src/rechercheVocale.js` | `taillesEnChiffres`, `ficheDeLaVoix` |
| `src/composants/ChampRecherche.jsx` | moteur commun, en direct, phrase d'erreur sous le champ |
| `src/App.jsx` | `MicDictee` sur le moteur (+ `onDirect`, `onErreur`, `canal`) ; loupe : `directRecherche`, `dicterRecherche` (fiche unique), `dicterLoupe`, appui long (`appuiLoupe`), `LigneVoix` ; micros des listes |
| `src/ecrans/Ebay.jsx`, `Reglages.jsx`, `src/ReceptionEmails.jsx` | micros |
| `scripts/audit-parler-loupe.cjs` (nouveau) | 43 contrôles, `--prouve` 15 mutations |
| `scripts/audit-recherche-vocale.cjs` | + tailles, branchement suivi au moteur commun, 8 mutations |
| `scripts/bancs/parler-loupe.cjs` (nouveau) | le banc (fausse reconnaissance) |

## Preuves

- `audit-parler-loupe` : vert ; `--prouve` 15/15 mutations rouges (pas en direct,
  final deux fois, refus oublié, entendu perdu à l'arrêt, « aborted » dit, langue,
  « Pourquoi » muet, première fiche au lieu de l'unique, compte ignoré, sans `cleNum`,
  loupe sans fiche, sans appui long, champ muet, champ brut, MicDictee sans mot).
  Sur `origin/main` (`git archive`, moteur et ligne recopiés pour qu'il s'exécute) :
  **20 rouges**.
- `audit-recherche-vocale` : vert, `--prouve` 8/8.
- Banc `parler-loupe` (390 tactile clair, 1512 sombre) : **tout vert** — micro, « Pourquoi ? »,
  fr-FR en direct, fiche 124 ouverte, B125 (pas 125), « sept » ⇒ aucune fiche et
  « Tout sur le N°7 », texte + taille, refus dit et micro retiré, appui long, toucher
  court, Annonces en direct + refus sous le champ, sans API aucun micro, aucune erreur
  de page. Au premier passage, mes données de banc portaient DEUX fiches « 124 » :
  l'app n'a rien ouvert (la règle de l'unicité, vue en vrai) — corrigé dans le banc.
  Mutation bâtie dans l'app (`ficheDeLaVoix` prend la première fiche, build à part,
  `BANC_DIST`) : **8 rouges** (« sept » ouvre une fiche à 390 et 1512 ; les contrôles
  suivants tombent derrière la fiche restée ouverte).
- Après le vrai `git merge origin/main` : build, audits et bancs `parler-loupe`,
  `dictee` relancés, verts ; `recherche-exacte`, `recherche-unique` (audits) verts.
- Captures regardées (`$TMPDIR/vrm-bancs/parler-loupe/`) : en direct (390), fiche 124
  (390), refus (1512 sombre), doublon 7 (1512 sombre), aide + « Pourquoi ? » (390),
  refus sous le champ d'Annonces (390).
- `npm run build` vert ; audits variables, tdz, coherence, identite, icones,
  textes-courts, fonctions-api, secrets, csp, annonces-coherence verts.

## Ce qui reste

- Le banc ne peut pas tester la vraie reconnaissance (absente de Chromium du banc) :
  à essayer sur Chrome (ordinateur, Android). Safari iPhone : `webkitSpeechRecognition`
  existe selon la version ; sinon pas de micro (voulu).
- Les petits champs de recherche des feuilles (favoris, reçus, offres eBay, Leboncoin
  « Republier »…) n'ont pas de micro : seulement les écrans de liste.

## Geste de Julien

Aucun. Essayer : la loupe, le micro, « cent vingt-quatre » (sa fiche s'ouvre) ; au
téléphone, garder le doigt sur la loupe.
