# 28 nov. 2026 — L'assistant de rangement (lot agent-rangement)

Julien, mot pour mot : « je veux que tu améliores le ranger : je veux un vrai agent IA qui pose des questions, totalement
intelligent, qui adapte les étages, les pièces de rangement, etc. ».

Branche `claude/agent-rangement` (depuis `origin/main` 9f083ef7), PR vers `main`.

## Ce que fait l'assistant

Stock → Meubles : une rangée « Assistant de rangement » en tête (aussi dans « ⋯ » et dans le vide d'un Stock sans meuble).
Une feuille native (`src/rangement/AssistantRangement.jsx`) :

- **une question à la fois**, réponses en **boutons**, en **texte libre** (« trois », « 5 boîtes », un nom de pièce) et
  **photo facultative** (réduite à 1024 px avant tout envoi) ;
- **il s'adapte** : « 2 pièces » ⇒ une série (nom, nombre de meubles) par pièce ; « 3 meubles » ⇒ type, étages, boîtes par
  étage pour chacun ; plusieurs meubles ⇒ « lequel est près de la porte ? » (ses cases proposées en premier : les nouvelles
  partent vite) ; « comment numérotes-tu tes cartons ? » (VRM en chiffres, VRM avec une lettre — l'archive « B » refusée et
  redemandée —, moi-même) ;
- **il repère les incohérences** : plus d'articles que de places ⇒ « il manque N places » avec « ajouter N étages à … »,
  « ajouter un meuble », « garder comme ça » (redemandé tant que ça ne tient pas) ; pile de plus de 12 boîtes ; pièce vide ;
  meuble existant plein ⇒ « ajouter un étage ? » ;
- **relancé plus tard, il MODIFIE** le plan : ajouter un meuble (dans une pièce ou une nouvelle), ajouter des étages, changer
  un meuble de pièce, ajouter une pièce, retirer un meuble, la numérotation ;
- à la fin, **le plan dessiné** (pièces → meubles dessinés par `MeubleDessin`, les cartons d'aujourd'hui à leur place,
  « Près de la porte », « nouveau »), les incohérences, **les déplacements proposés** (« N° 20 : Armoire · r1 c1 → … »), ce
  qui repart « à ranger » faute de place — et **rien n'est écrit avant « Appliquer ce plan »** (le seul plein de la feuille).

## Les deux moteurs (choisis seuls, DITS en haut de la feuille)

- **Avec IA** : `/api/ai?usage=rangement` dit qui répond. La clé est celle **du vendeur**, collée dans la feuille
  (« Ajouter ma clé IA »), envoyée une fois, vérifiée chez Anthropic (liste des modèles, gratuite), **chiffrée dans le coffre**
  (`api/_lib/ia-cle.js`, usage `ia-anthropic-v1`, ligne `ia_cle`, même chemin que la clé Photoroom) ; le navigateur n'en
  apprend que les 4 derniers caractères. Pour le seul propriétaire de l'installation (`VRM_OWNER_UID`), la clé du serveur
  (règle d'`api/ai.js`). **Jamais de repli** : « pas su » ⇒ 503, aucune clé ⇒ `no-key` ⇒ l'assistant passe sans IA et le dit.
  Le modèle (`AI_MODEL_RANGEMENT`, défaut `claude-opus-5-5`, effort `medium`) conduit l'entretien et rend un JSON strict
  (`question` ou `plan`, consigne dans `api/_lib/rangement-ia.js`). Ce qui part : l'entretien, les meubles (noms, pièces,
  tailles, cases prises), le nombre d'articles, la photo s'il en joint une — **aucun titre, aucun N°, aucun prix**.
  Chaque réponse est **validée** par `lireReponseIA` (`src/rangement/moteurIA.js`) puis `validerPlan` : une réponse fausse
  (texte libre, JSON tronqué, clé inconnue comme `numeros`, ref inconnue, 999 étages, question sans réponse possible) n'est
  jamais affichée : « La réponse de l'IA n'était pas valable… je continue sans IA ».
  ⚠️ L'ancien chemin des autres fonctions IA (`vrm_ai_key` local envoyé dans le corps) n'est PAS pris par le rangement : la
  consigne §2.9 dit « rangée côté serveur, jamais relue par le navigateur ». Les autres fonctions IA restent comme avant
  (hors lot) ; elles pourraient passer au coffre plus tard.
- **Sans IA** : `src/rangement/entretien.js`, une FILE de questions qui grandit selon les réponses (arbre adaptatif), le même
  plan JSON, la même validation. Gratuit, toujours là.

## Données (CLAUDE.md §5)

- `vrm_meubles` : même clé, même forme, chaque meuble **augmenté** de `piece` (nom) et `porte` (true) — facultatifs, aucune
  migration, aucun drapeau du navigateur. Ordre (`ordre`) : les meubles « porte » d'abord, puis l'ordre des pièces.
- `vrm_slots` : **seuls `m` et `i` changent**. Une paire garde sa rangée et sa colonne quand son meuble grandit ou rétrécit ;
  hors des cases restantes (rétréci, retiré) ⇒ un déplacement vers une case libre (`casesProposees`, piles comprises) ;
  sans place ⇒ « à ranger » (sa case libérée, son N° intact). Aucune clé créée ni renommée : **aucun N° changé**.
- Un meuble existant absent du plan est **gardé** ; seul `retirer` (nommé) retire.
- « Appliquer » **recalcule** le plan sur l'état le plus frais (Stock.jsx `assistant.appliquer`) ; si les déplacements ne sont
  plus ceux qu'il a vus, rien n'est écrit (« Ton stock a changé… »). Puis `save` ⇒ lire-fusionner-réécrire de `cloudPush`.
- La numérotation passe par `ecrituresMethode` (src/etiquetage/methode.js) : `vrm_numero_ecrit` / `vrm_num_prefixe`, jamais un N°.
- Le Stock (Meubles) se range par pièce dès qu'il y en a deux (`data-sm-piece-titre`), pastille « Près de la porte ».

## Preuves

- `node scripts/audit-agent-rangement.cjs --mutation` : **65 verts**, **14/14 mutations rouges**. E1 1 pièce/1 meuble ;
  E2 3 pièces/6 meubles (porte en premier, lettre d'archive redemandée) ; E3 plus d'articles que de places ; E4 modification
  (plein ⇒ étage, retirer un meuble plein ⇒ 3 déplacements, nouvelle pièce, déplacement de pièce ; mêmes clés de `vrm_slots`,
  rétréci, pile tassée, meuble oublié gardé, pas lu ⇒ rien) ; V 13 refus de validerPlan ; I1-I3 chemin IA simulé
  (`handleRangement` exécuté avec un fetch simulé : question, plan, photo ; refus serveur et navigateur ; contexte sans N°) ;
  K api/ai.js (clé du coffre, jamais du corps, serveur pour le seul propriétaire, pas su ⇒ 503).
- Banc `scripts/bancs/agent-rangement.cjs` (390 tactile clair/sombre, 1512 clair/sombre ; /api/ai simulé, données
  inventées) : A sans IA (modifier → casier dans « Cave » tapée → plan dessiné → appliqué, `vrm_slots` et N° identiques,
  Stock par pièce) ; B IA simulée (boutons du modèle, plan valide dessiné, réponse invalide refusée ⇒ sans IA, rien écrit,
  aucune clé dans la requête) ; C base vide ; Q (pas de défilement de côté, un plein, réponses ≥ 44 px, aucune erreur).
  Captures regardées (jamais commitées).
- Audits : tdz, variables, traduction (5 langues, `rgt.*`, fichier ajouté à MIGRES), coherence, quoi-de-neuf, identite,
  fonctions-api (toujours 12), icones, secrets ; build vert.

## Reste / gestes

- Aucun geste obligatoire. Pour l'IA chez lui : rien (la clé du serveur sert au propriétaire). Les autres vendeurs collent
  leur clé dans la feuille.
- Plus tard : passer « ✨ Rédiger » / aide à la réponse au coffre (aujourd'hui `vrm_ai_key` local) ; dessiner la pièce en plan.
