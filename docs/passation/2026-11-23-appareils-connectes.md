# 23 nov. 2026 — Appareils connectés : les navigateurs de l'extension (lot `claude/appareils-connectes`)

Validé par Julien le 23 nov. (n° 4) : « liste des sessions/appareils connectés au compte VRM (Supabase Auth : sessions
actives si l'API le permet ; sinon appareils connus par `ext_appareil_*` et derniers accès), « Déconnecter partout »
(signOut global) avec confirmation ; aucune donnée d'un autre owner ».

## Ce qui existait (mesuré dans le code, pas refait)

- Paramètres → Sécurité → « Appareils connectés » (4 nov., regroupé le 11 nov. : `src/appareilsGroupes.js`) : les
  SESSIONS Supabase Auth du compte, lues par le serveur (`/api/compte?mode=appareils`, sa session seulement), « Cet
  appareil » en tête, le détail par connexion, « Déconnecter » une connexion, les anciennes (> 30 j) fermées sur son
  clic, « Déconnecter les autres appareils » (scope others) et « Se déconnecter partout » (`deconnecterPartout`,
  `/auth/v1/logout?scope=global`, confirmé ; ce navigateur effacé seulement après la réponse).

## Ce qui manquait, fait ici

- La liste des sessions ne dit pas OÙ l'extension tourne. Nouvelle carte **« Navigateurs avec l'extension VRM »**
  dans la même section (`NavigateursExtension`, src/ecrans/Reglages.jsx ; règle pure `src/appareilsExtension.js`) :
  une rangée par ligne `ext_appareil_{id}` que chaque extension publie (5.327) — « Mac · Chrome », « version 5.441.0 »,
  « vue il y a 3 h », « Active » si vue depuis moins de 24 h. Lue en PROJECTION scalaire (`data->>ver`, `data->>atMs`,
  `data->appareil->>nav|systeme`) avec `owner=eq.<lui>`, par `lireTout` (pagination) — jamais `select=data`, jamais la
  ligne d'un autre vendeur.
- « Pas su » : lecture ratée ⇒ « Je n'ai pas pu lire tes navigateurs » + « Réessayer » (jamais « aucun ») ; une date
  illisible n'est ni active ni ancienne ; une version illisible n'est pas affichée.
- Aucun geste neuf : la phrase dit que « Se déconnecter partout » ferme aussi l'extension (sa session est une session
  du compte). Textes `parametres.appExt.*` (5 langues).

## Preuves

- `node scripts/audit-appareils-extension.cjs` : **12 verts**, avec une FAUSSE BASE à deux vendeurs qui rend tout dès
  qu'un filtre manque. Mutations rouges (7/7) : `owner`, `data`, `passu`, `date`, `ordre`, `carte`, `partout`.
  Code d'avant : le module n'existe pas.

## Textes et boutons (consigne de Julien relayée le 23 nov. : « trop de texte, pas assez de beaux boutons »)

- Au plus une phrase courte par bloc (≤ 8 mots), le détail sous « Pourquoi ? » (repli `vrm-repli`), les gestes en
  boutons communs (`Bouton` natif, icône + verbe court). La branche `claude/style-clair` n'ajoute pas d'autre composant
  bouton : c'est celui de `src/natif/Bouton.jsx`.

## Mesures de la vraie base (lecture seule)

Mesures base (lecture seule, 23 nov. ~11:55 UTC, projections scalaires) :
- ext_appareil_* : 19 lignes, 1 owner, 19/19 à la forme attendue (data->>atMs, data->appareil->>nav).
- vrm_meilleures_sources : 0 ligne en base (publication sur l'appareil, normal).
- studio_photos_* : 0 ligne (personne n'a encore rangé de photo au studio).
- email_invoice_* : 24 lignes.
- main : vrm_colis_retirer présent sur 4 lignes main (1 colis, tuple à 8 cases, limite lue AAAA-MM-JJ, transporteur vinted) ;
  vrm_colis_aposter ABSENT de la base (publication de CET appareil seulement : la liste des envois n'existe que là où Colis/Ma journée l'a calculée) ;
  vrm_fiches_neuves ABSENT partout ; vrm_slots : 1 ligne main, 8 cases.

## ÉTAT À LA REPRISE

- Branche poussée ; banc de rendu (Paramètres › Sécurité, 390/1512) et PR après 15:30 UTC ; fusion pas avant le
  24 nov. 07:00 UTC.
- Les textes d'avant de la section (sessions, boutons) sont encore en français en dur (pas migrés vers `tr()`) — à
  faire dans un lot de traduction, pas ici.

Geste de Julien : aucun.
