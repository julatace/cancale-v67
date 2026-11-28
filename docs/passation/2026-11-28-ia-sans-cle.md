# 28 nov. 2026 — L'IA sans aucune clé (lot ia-sans-cle)

Julien, mot pour mot : « je ne veux pas avoir à mettre de clé, ni pour moi ni pour les utilisateurs, débrouille-toi ».

Branche `claude/ia-sans-cle` (depuis `origin/main` ba443543), PR vers `main`.

## Recensement des fonctions « IA » (avant → après)

| fonction | avant | après (aucune clé) |
|---|---|---|
| **Assistant de rangement** (Stock → Meubles, `src/rangement/`) | `/api/ai?mode=rangement` sur la clé du vendeur (coffre `ia-cle`, collée dans la feuille) ou celle du serveur pour le propriétaire ; sinon règles | **l'IA du navigateur** (`src/iaNavigateur.js`, API Prompt de Chrome `LanguageModel`, sur l'appareil) ; à télécharger ⇒ rangée « Télécharger » (SON toucher, progression) et l'assistant guidé répond en attendant ; sinon **l'assistant guidé** (`entretien.js`) |
| **Aide à la réponse** (messages) | `/api/ai mode:reply` — plus appelé par rien (ni app ni extension) | les **réponses rapides** par mots-clés (`src/reponsesRapides.js`, déjà sans IA) + la puce **« ✦ Proposer »** (`src/ReponseNavigateur.jsx`) : le modèle du navigateur écrit UNE réponse, validée (`src/reponseNavigateur.js`), qui REMPLIT le champ — visible seulement si le modèle est prêt |
| **Traduction** des messages | déjà le `Translator` intégré à Chrome (`src/TraduireLocal.jsx`, 21 nov.) | inchangé ; sans l'API, une ligne le dit (`TraductionAbsente`) |
| **« Rédiger une annonce (IA) »** (Annonces) et **« Optimiser le titre avec l'IA »** (eBay) | retirés de l'écran par Julien le 30 sept. (« ça ne va pas servir »), mais leur code restait (feuille `iaOpen` jamais ouverte, bouton `{false && aiPret}`) et lisait `vrm_ai_key` | **code mort supprimé** (dernier lecteur de `vrm_ai_key`) ; PAS remis à l'écran (sa décision du 30 sept. ; `bancs/ia.cjs` et `ebay-form.cjs` vérifient qu'ils ne reviennent pas) |
| **Clé IA** (`vrm_ai_key`, carte « Ta clé IA (Anthropic) », coffre `api/_lib/ia-cle.js`, `/api/compte?mode=ia-cle`) | saisie dans l'assistant de rangement | **retirés** (0 ligne `ia_cle` en base, mesuré le 28 nov. en lecture seule) |

Hors périmètre, à décider par Julien : **la clé Photoroom** (détourage Vestiaire, écran Vestiaire) — c'est une clé de service photo, pas d'IA de texte ; le détourage local gratuit (U²-Net) existe déjà dans le Studio photo.

## Le moteur du navigateur (`src/iaNavigateur.js`)

- `apiModele()` : `window.LanguageModel` (API actuelle de Chrome), sinon l'ancien `window.ai.languageModel`.
- `etatModele({ langue })` : `availability()` avec `expectedInputs/expectedOutputs` dans la langue de l'écran (repli sans
  contrainte de langue) ⇒ `disponible` · `telechargeable` · `telechargement` · `absente` ; une exception = `absente`
  (« pas su » ≠ « oui »).
- `ouvrirSession({ systeme, surProgres })` : `LanguageModel.create({ initialPrompts: [{ role: 'system', … }], monitor })`,
  l'événement `downloadprogress` (`e.loaded` 0…1) nourrit la barre ; le téléchargement ne part que d'un toucher.
- `demanderJSON(session, texte, schema)` : `session.prompt(texte, { responseConstraint: schema })`, premier objet JSON lu ;
  `forme` (illisible) ou `panne` (exception) — jamais une réponse inventée.
- Rien ne part sur le réseau (audit : aucun `fetch` dans ces modules). Safari iPhone, Firefox, Orion, Chrome sans modèle :
  l'assistant guidé / les réponses rapides, et l'écran le DIT (« Répond : l'assistant guidé (gratuit, aucune clé) »).
- ⚠️ La doc Chrome (developer.chrome.com/docs/ai) n'était pas joignable depuis la session (hôte hors réseau) : l'API est
  écrite d'après sa forme connue (Chrome 138+), et tolère l'ancienne. À revérifier si Chrome la renomme.

Rangement : la consigne et le schéma vivent dans `src/rangement/moteurIA.js` (`consigne`, `SCHEMA_REPONSE` = question OU
plan, `additionalProperties: false`, `premierMessage` sans titre/N°/prix) ; chaque sortie passe `lireReponseIA` ⇒
`validerPlan` (inchangés). La même session garde l'entretien. Le modèle ne lit pas les photos ici : la photo n'est plus
promise en mode IA.

## Serveur

- `api/ai.js` ne garde que le **détourage** (`?mode=detourage`, /api/detourage) ; tout le reste ⇒ **410 `retire`**, aucun
  appel sortant, `AI_API_KEY` n'est plus lue (même pour le propriétaire). Toujours 12 fonctions.
- Supprimés : `api/_lib/ia-cle.js`, `api/_lib/rangement-ia.js`, le mode `ia-cle` d'`api/compte.js`, `config.ia` de la
  santé du propriétaire. `.env.example` : `AI_API_KEY` à ne plus poser. Politique de confidentialité : la ligne
  « Anthropic PBC » retirée (aucune donnée n'y part).

## Preuves

- `node scripts/audit-ia-sans-cle.cjs --mutation` : **30 verts, 7/7 mutations rouges** — A aucune interface (code, 5 langues,
  confidentialité) ne demande/lit/envoie de clé IA ; B `api/ai.js` EXÉCUTÉ, fetch espionné : rédaction, reply, rangement,
  sondes ⇒ 410 sans aucun appel sortant même `AI_API_KEY` posée, détourage routé, `ia-cle` disparu, ≤ 12 fonctions ;
  C chaque fonction a son moteur sans clé ; D « ✦ Proposer » : sortie simulée valide posée, vide/trou/lien/e-mail/téléphone/
  clé en plus/trop long/refus de la règle des messages ⇒ rien.
- `node scripts/audit-agent-rangement.cjs --mutation` : **69 verts, 16/16** — I1 faux `LanguageModel` (consigne en system,
  `responseConstraint`, question puis plan validés), I2 réponses invalides refusées, panne ⇒ « panne », I3 premier message
  sans titre/N°/prix, I4 sans API / unavailable / exception ⇒ absente, downloadable ⇒ téléchargeable ; K aucun fetch, aucun
  champ de clé.
- Audits mis à jour à la nouvelle règle (« personne ne dépense de clé IA, pas même le propriétaire ») : routes-revue E,
  vendeur-neutre E, abonnement (ia), sante-publique P5, robustesse-serveur D. Verts aussi : tdz, variables, traduction,
  coherence, quoi-de-neuf, fonctions-api, secrets.
- Banc `scripts/bancs/agent-rangement.cjs` (390 tactile clair/sombre, 1512 clair/sombre ; faux `LanguageModel` injecté par
  `addInitScript`, toute requête /api/ai comptée = 0) : A sans API ⇒ assistant guidé, aucune carte de clé ; B modèle prêt ⇒
  question du modèle, plan dessiné, réponse invalide refusée ⇒ assistant guidé ; C base vide ; D modèle à télécharger ⇒
  proposé, progression, puis l'IA reprend. Captures regardées (jamais commitées).

## Reste / gestes

- Aucun geste. Sur un Chrome récent d'ordinateur, l'assistant proposera « Télécharger » une fois (modèle de quelques Go,
  gratuit) ; sur iPhone, l'assistant guidé répond.
- Plus tard : « ✦ Proposer » aussi dans le panneau de l'extension (pas touché : consigne du lot).
