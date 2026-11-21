# 11 nov. 2026 — Être prévenu tout de suite quand Vinted cache, supprime ou restreint (ext. 5.350)

Branche `claude/alerte-moderation` (pas de PR, pas de merge dans `main` : consigne de la session).

## Ce que Julien demandait
Être prévenu **tout de suite** quand Vinted masque une annonce, en supprime une ou
limite un compte — sur **preuve** seulement, jamais sur « pas su », jamais deux fois
pour le même événement, avec une notification regroupée (heures calmes), une carte
en tête de Ma journée (quoi, quand, la raison si Vinted la donne, le geste) et
l'historique dans « Ce que VRM a fait ».

## Principe : aucune requête Vinted de plus
L'extension compare ce qu'elle lit **déjà** :

| événement | source (déjà lue) | preuve exigée |
|---|---|---|
| **masquée** | moisson ACTIVE complète du dressing (`dressingCompletFaitFoi`, toutes les pages, total atteint) | en ligne (ou réservée) à la lecture complète d'avant, `is_hidden` à la suivante |
| **disparue** | idem | en ligne ou masquée avant, **absente** d'une lecture complète, **aucune suppression vue** (`harvest_{uid}_supprimees` + la file locale `vrmSupprAttente` : ses suppressions sur vinted.fr dans ce Chrome, et celles de VRM pendant une republication). Vinted ne supprime pas une vendue : il la FERME (`item_closing_action: 'sold'`, mesuré, commentaire de `CHAMPS_ARTICLE`) |
| **compte fermé** | profil `users/current` (`noterEtatCompte`) | `is_account_banned` vrai, alors que le dernier état connu n'était pas « banni » |
| **compte limité** | refus de Vinted sur une mise en ligne / une offre (`poserFreinRepub`) | le SIGNAL `restricted`/`suspended` (`refusRestreint`), jamais un refus ordinaire |

**Une capture passive ne compare jamais rien** : elle peut être une page filtrée
(son total ne dit pas le dressing entier). Seule la voie active `storeHarvestRow`
avec `complet` déclenche `guetterDressing`. La première lecture complète d'un compte
dans un Chrome ne fait que poser le point de départ.

### Ce qui ne déclenche rien (« pas su » ≠ alerte)
- mode vacances lu dans son profil (`is_on_holiday`, retenu localement, aucune lecture de plus) ;
- **toutes** les annonces en ligne masquées d'un coup (≥ 3) : c'est le compte, pas une annonce ;
- suppressions illisibles (lecture ratée de `harvest_{uid}_supprimees`) ⇒ aucune « disparue » ;
- tout le dressing vide d'un coup (≥ 3) ⇒ rien (suppression en masse ou lecture incomprise) ;
- une **réservée** qui disparaît (vente en cours), une vendue, une fermée, un brouillon ;
- côté app, une « disparue » dont la vente est **prouvée** (`lirePreuvesVenteVinted`, lue seulement s'il y en a une).

### Formulation prudente
« L'annonce … a disparu · Peut-être retirée par Vinted — sauf si tu l'as supprimée
depuis ton téléphone. Aucune vente prouvée, aucune suppression vue par VRM. »
(une suppression faite depuis l'app Vinted du téléphone n'est pas vue par l'extension).
« Masquée » dit aussi « si tu ne l'as pas masquée toi-même » : le geste de masquer
sur vinted.fr n'est pas observé (non mesuré, pas deviné).

## La règle — `src/moderationVinted.js` (une règle, §11)
Bloc `// <moderation-regle>` … `// </moderation-regle>` **recopié** dans
`background.js` par `node scripts/audit-alerte-moderation.cjs --recopie` (jamais à la
main ; C1 vérifie l'égalité). Le reste du module (cartes, textes, notification,
journal) sert l'app et le serveur.

Ligne `moderation_vinted_{uid}` (écrite par l'extension seule) :
`{ uid, v, majAt, e: [{ k, s, t, a?, av?, j?, r?, f? }] }` — sorte, quand, l'annonce
(identifiant), la lecture d'avant, « jusqu'à » (limité), la raison donnée par Vinted
(≤ 160 car., jamais un pseudo), fin.

**Jamais deux fois** : un événement ouvert de la même sorte sur la même annonce (ou
le même compte) n'est pas recréé (deux Chrome qui voient la même chose = une alerte) ;
un « limité » ne revient pas dans les 24 h, et n'est « ouvert » que jusqu'à sa fin
(défaut trouvé par mutation : sans ça, une seconde limite des semaines plus tard
n'aurait jamais été dite). Une annonce redevenue visible **ferme** son alerte ; un
profil redevenu actif ferme « fermé ».

## Extension 5.350.0 — `vinted-sync-extension/background.js`
- `guetterDressing(uid, items, at)` : appelée après l'écriture d'une lecture complète
  (`capturePrevue && ecritRow !== false`). Le point de départ (`vrmModerationVu`,
  états o/r/h/s/c/d seulement) **n'avance que si ce qui a été trouvé est rangé** :
  lecture ratée de la ligne ⇒ rien écrit, et la lecture suivante le retrouve (E5).
  Les suppressions ne sont lues que s'il y a une disparue à juger (égress).
- `noterCompteModeration` : « banni » depuis `noterEtatCompte` (transition), « actif »
  ferme ; « restreint » depuis `poserFreinRepub` (raison : `raisonRefusVinted`).
- **Banni ⇒ frein de 24 h posé** (`poserFreinCompte`) : la phrase « VRM a arrêté ses
  actions automatiques sur ce compte pour 24 h (republication, baisses de prix, offres
  auto) » est VRAIE — c'est exactement ce que `lireFreinRepub` arrête. Rien d'autre
  n'est promis (les favoris passent par leur file serveur, non touchée).
- `signalerModeration` : `POST https://vrm.center/api/push {action:'moderation'}` avec la
  session ; le corps ne dit rien. Échec ⇒ marque locale, renvoyée au passage suivant
  (`signalerModeration(false)` dans la boucle de visite) ; le cron est le filet.
- Capacité `moderation` (5.350.0) dans `EXT_CAPACITES` ; `audit-coherence` la relie à `guetterDressing`.

## Serveur
- `api/_lib/moderation-notif.js` · `notifierModeration()` : relit SES lignes (projection
  `e`) et SES comptes (moins les comptes retirés : « ne plus lui en parler ») ; réserve
  les clés dans `vrm_moderation_notifie` par comparer-et-échanger sur `rev` **avant**
  d'envoyer (trois appels ensemble ⇒ une notification, S3) ; UNE notification
  regroupée, le plus grave d'abord ; plus de 3 jours ⇒ pas de rattrapage tardif.
- `api/push.js` action `moderation` ; `api/ship-reminders.js` l'appelle matin et soir (filet).
  Aucune fonction serverless nouvelle (12 au plus).
- Famille « **Vinted cache ou limite** » (`moderation`, allumée par défaut) dans
  `api/_lib/notif-textes.js` ; aperçu dans Paramètres → Notifications (`notif-apercus.js`,
  le vrai texte). Heures calmes et cloche : celles de `sendPushToAll` (H1).
- « Ce que VRM a fait » (`api/_lib/securite-compte.js`) : source `moderation`, preuve
  « Constaté par l'extension en relisant ton dressing ou ton profil Vinted », résultat
  « À vérifier », filtre « Vinted » (`src/securiteCompte.js`).

## App
- `src/AlerteModeration.jsx` (chargée à la demande, aucune place prise quand il n'y a
  rien), montée **en tête** de Ma journée. Une lecture `moderation_vinted_*` (`e`
  seulement), relue sur `vrm:ext` (`maj · moderation|etatcompte`) et au retour sur
  l'onglet. L'annonce est nommée par le N° de **sa** fiche (identifiant → `vinted_annonce_numeros`),
  sinon par son identifiant — jamais un titre (§5). Lien direct `vinted.fr/items/{id}`
  (masquée) ou `vinted.fr/inbox`. « C'est vu » / « Tout est vu » ⇒ `vrm_moderation_vu`
  (SYNC_KEYS : vu sur un appareil, rangé sur tous). Ambre doux, jamais rouge (§7).

## Preuves
- `node scripts/audit-alerte-moderation.cjs` : **65 contrôles** — R (règle exécutée,
  dont 50 paires au même titre), E (le vrai `background.js` dans un vm : deux lectures
  complètes ⇒ ligne + UN appel push + **0 requête Vinted** ; lecture partielle ⇒ rien ;
  suppression vue ⇒ rien ; lecture KO ⇒ rien écrit puis retrouvé ; restreint ; banni +
  frein ; rouvert), S (la vraie route `api/push.js` contre une base qui sert la vraie
  forme, `ignore-duplicates` compris), H (heures calmes), C (copie), J (journal).
- `--prouve` : **14/14 mutations de la règle + 4 mutations du fond** rougissent ; le
  `background.js` d'`origin/main` rougit E.
- Banc `scripts/bancs/alerte-moderation.cjs` : **67 contrôles**, 390 px tactile et
  1512 px, clair et sombre ; vente prouvée, base 503, alerte fermée, compte retiré.
  Captures regardées (le geste était illisible en sombre et trop appuyé : corrigé en
  teinte douce ; la date répétée « le 11 nov … et le 11 nov » : dite une fois).
- `npm run build` vert ; audits demandés verts (variables, tdz, coherence, identite,
  icones, textes-courts, fonctions-api, secrets, extension-zip). `audit-cibles-notif`
  exigeait l'aperçu de la nouvelle famille : ajouté.

## Pas fait / à savoir
- La raison d'un **masquage** n'est pas lue : rien dans le dressing ne la porte (non
  mesuré sur sa base, donc pas inventé) ; le geste renvoie à l'annonce, où Vinted l'écrit.
- Une suppression faite depuis l'**app Vinted du téléphone** n'est pas vue par
  l'extension : d'où « peut-être », jamais « Vinted l'a supprimée ».
- Le point de départ vit dans CHAQUE Chrome : un Chrome neuf pose le sien à sa
  première lecture complète (aucune alerte sur ce qu'il n'a pas vu changer).

## Geste de Julien
Installer l'extension **5.350.0** (remplacer le dossier, ⟳ dans chaque Chrome).
