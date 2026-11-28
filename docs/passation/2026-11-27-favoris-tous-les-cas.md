# 27 nov. nuit — Favoris : le chemin de Vintex réécrit, tous les cas (ext. 5.455.4)

Branche `claude/favoris-tous-les-cas`. Données des bancs INVENTÉES (dépôt public).

## Ce que Julien a vu et demandé (5.455.3, 27 nov.)
- 18:42, arthuror2, file de 2 : favori 1 (N°247) « Ignoré · autre article dans la conversation » ; favori 2 « En attente · 18:42 »,
  « 0 sur 2 » ; « le chronomètre ne marche pas ».
- « Tu vas tout reprendre comme Vintex », « tu enlèves ce qui existe si c'est pas ouf », « je ne veux aucune erreur possible »,
  « 100 % automatique » ; « sur certains comptes, quand on ouvre le favori, l'offre est proposée directement ».

## La cause de « autre article »
La 5.455.3 vérifiait, AVANT l'historique, les articles listés dans la conversation, comparait la transaction de la conversation
à celle de la demande, PRÉFÉRAIT la transaction de la conversation (cherchée jusque dans les anciens messages) et relisait
l'ancienne conversation. Vinted peut rendre, pour `{item_ids:[X], receiver_id:Y}`, une conversation déjà ouverte avec cette
personne à propos d'un autre article : l'une de ces vérifications a dit « autre article ». Laquelle chez lui : pas mesurable
d'ici (les formes sont notées sur SA machine) ; toutes sont retirées.

## Le chemin réécrit (background.js, `executerMessageFavori`, bloc `cheminFavoris()==='requetes'`, ~100 lignes)
1. Autorisation du serveur (`consommer`, puis `verifier` juste avant d'écrire), compte de l'onglet (`garde`).
2. **Registre** `vrmFavorisFaits` (par compte, `article:acheteur`) : une offre (`o`) ou un message (`m`) déjà faits ⇒ sauté, rien ne
   part. Illisible ⇒ rien ne part.
3. `inquiries {item_ids:[X], receiver_id:Y}` ; `conversation_id` et `transaction_id` pris dans SA réponse ; des clés neuves dans la
   réponse sont notées (`favori_req_inquiry_cles_neuves`), jamais bloquantes.
4. UNE relecture (3 essais si Vinted ne la sert pas encore) : une AUTRE PERSONNE lue ⇒ refusé ; un message ÉCRIT ou une offre AVEC
   montant ⇒ sauté « déjà en conversation ». Un message du système, ou l'invitation de Vinted à faire une offre (type `offer…` sans
   montant), ne fait PAS sauter : leurs types sont notés. Plus aucune vérification d'article sur la conversation.
5. La transaction de la réponse relue (comme Vintex) : son prix, maintenant ; son article ≠ X ⇒ rien (jamais une offre sur un autre
   article). Sans transaction ou sans prix lu ⇒ pas d'offre, favori sauté « prix pas lu » (jamais le prix du dressing, qui peut être
   ancien). Devise ≠ EUR ⇒ pas d'offre.
6. Le texte ENTIER (variables, `texteSurVinted`, jamais deux fois le même) jugé AVANT l'offre.
7. L'offre sur CETTE transaction (`offreAvecPlancher`, `gardePrixEcriture`) ; registre `o` dès qu'elle est faite ou peut-être faite.
8. Le message dans CETTE conversation ; registre `m` posé AVANT l'envoi (retiré si Vinted le refuse net, 4xx).
- Retirés : `txConversationMessagerie` (recherche profonde), l'ancienne conversation `core_id_deprecated`, les articles de la
  conversation, le prix du dressing. Le chemin par clics (`vrmFavorisChemin: 'interface'`) reste en réserve, jamais choisi seul.
- Mode auto : le MÊME chemin (pilote → `executerPourAppCoeur` → `executerMessageFavori`), mêmes gardes, même registre.

## Les autres cas corrigés
| cas | avant | maintenant |
|---|---|---|
| création refusée 400 (téléphone), 429, 403, 409 | comptée « écrite » : favori bloqué pour toujours, auto jamais repris, un 4xx propre arrêtait la file | `ecrits` 0 (`ecritureFavoriPartie`) |
| VRM injoignable à l'autorisation | « incertain », file bloquée | « pas envoyé », renvoyable |
| `terminer` perdu | tentative « incertaine » après 2 min | rangé (`vrmFavorisTerminer`) et rejoué avant le favori suivant |
| worker tué entre l'offre et le message (uuid) | l'attente jetée en silence : offre faite, aucun message | repris par les requêtes, une fois (registre), serveur prévenu |
| 3 conversations ouvertes de suite sans relecture | « ignore » ne comptait pas | comptées dans les « N de suite » (`sautSuspect`), arrêt au 3ᵉ |
| saut après une écriture | rythme remis à zéro | rythme gardé |
| prix pas lu | arrêtait la file | refus local : sauté, trois de suite arrêtent |
| garde de l'onglet | « Vinted a refusé » | sa raison (autre compte, pause, vérification) |
| chronomètre | minuteur de la seule carte ouverte ; rangée « En attente · 18:42 » figée ; fenêtre perdue après mise à jour sur place | UNE horloge (vrm-badge.js, vrm-action.js) ; rangée « prochain dans 42 s » vivante |

## « offer_request=true » et l'autre outil (Julien, 19:17)
- Aucune ligne de VRM n'ouvre `/inbox/<uuid>?offer_request=true` ni la case « Faire une offre » (grep : `offer_request=` absent de
  l'extension) ; la phrase « 1 message favoris envoyé automatiquement aujourd'hui » n'existe pas dans VRM : c'est celle d'un autre
  outil installé dans ce Chrome (Bleam, icône « B »). Le chemin de VRM fait l'offre par l'API sur la transaction de la demande, au
  prix calculé, la confirme (code 0), puis écrit le message (V37, V37b).
- Deux outils sur les mêmes favoris = deux offres : le mode AUTO de VRM ne part pas tant qu'une page vinted.fr montre la trace
  d'un autre outil de messages aux favoris (`autreOutilFavoris`, journal `favori_auto_autre_outil`). Un envoi qu'il lance reste
  permis, protégé par la relecture et le registre.

## Réponses de Julien (19:40), appliquées dans la même 5.455.4
- « VRM envoie quand même » : le retrait du mode auto devant un autre outil (V38) est RETIRÉ. Reste la garantie de VRM : jamais
  deux fois au même acheteur pour le même article (registre).
- « Il doit voir le prix » : `prixFavoriVivant`, dans l'ordre — (a) la transaction de la demande, (b) la réponse de la demande,
  (c) `GET /api/v2/items/{id}` depuis la page, (d) la page publique de l'annonce (`extraireDetailPage`), (e) SON dressing seulement
  s'il a été lu il y a moins de 10 min. EUR seulement ; plancher et garde du prix inchangés. « Prix introuvable » (`offre_prix_inconnu`)
  seulement quand TOUT a échoué (V39, V39b, V39c, V18, V40 ; mutations `sans-article-vivant`, `sans-prix-demande`,
  `sans-page-annonce`, `dressing-ancien`).
- L'invitation « offre proposée » et les messages du système ne bloquent pas (V36, inchangé).
- C4 : la relecture porte le `read_after_write_token` de la demande (deux premiers essais ; le 3ᵉ sans lui, au cas où Vinted le
  refuserait) (V41) ; `fil_non_relu` n'est plus définitif : le favori repart une fois après les autres, puis compte dans les
  « de suite » (test `favoris-progression`).

## Preuves
- `audit-favoris-requetes-vintex.cjs` (vrai background.js) : 48 verts ; sur la 5.455.3 : rouge sur V16b, V16c, V19, V21–V32 ;
  `--prouve` : chaque mutation rouge (voir le rapport de session).
- `favoris-progression.test.mjs` : sauts suspects, rythme gardé, prix pas lu = sauté.
- Bancs : `favoris-auto.cjs` F2b (chrono de la fenêtre), `panneau-favoris-tableau.cjs` (chrono de la rangée : 4 rouges sur la
  5.455.3, verts après), `e2e-extension` vert.

## Ce qui ne se vérifie que sur son compte
- La forme réelle d'une conversation rendue « à propos d'un autre article » et de l'« offre proposée directement » : notées seules
  (`vrmFormesFavori` : `inquiry/cles`, `conversation/types`).
- Un autre point d'entrée de Vinted pour « offrir aux intéressés » : jamais observé ; VRM fait comme Vintex (`transactions/{tx}/offers`).

Geste de Julien : installer **5.455.4** (remplacer le dossier, ⟳ dans chaque Chrome), puis relancer l'envoi.
