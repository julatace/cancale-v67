# 27 nov. soir — Favoris : tous les cas, et « autre article dans la conversation » (ext. 5.455.4)

Branche `claude/favoris-tous-les-cas`. Données des bancs INVENTÉES (dépôt public).

## Ce que Julien a vu (5.455.3, 27 nov. 18:42, compte arthuror2, file de 2)
- Favori 1 (N°247) : « Ignoré · autre article dans la conversation ». Favori 2 : « En attente · 18:42 », « 0 sur 2 ».
- « Le chronomètre ne marche pas » : le temps avant le prochain envoi ne bougeait pas.
- Ses mots : « tu vas tout reprendre de A à Z », « fais comme les concurrents ».

## La cause
Quatre vérifications de la 5.455.3 passaient AVANT l'historique et pouvaient dire « autre article » sur une conversation que
Vinted rend pour la demande `{item_ids:[X], receiver_id:Y}` mais qui avait été ouverte avant, avec la même personne, à
propos d'un AUTRE article : (1) `data.items` de la conversation, (2) transaction de la conversation ≠ celle de la demande,
(3) la transaction de la CONVERSATION préférée à celle de la DEMANDE (l'ancienne transaction relue ⇒ autre article),
(4) la recherche de `transaction_id` jusque DANS les anciens messages. Laquelle a joué chez lui : pas mesurable d'ici (les
formes sont notées sur SA machine) ; la règle ci-dessous les retire toutes.

## La règle (comme Vintex et Bleam)
- La DEMANDE fait l'identité : Vinted a créé ou rendu LA conversation de cet article et de cette personne.
- **Seule une AUTRE PERSONNE lue refuse** (`destinataire_different`).
- L'historique d'abord : une conversation déjà écrite ⇒ « déjà en conversation » (sauté). Une offre déjà dedans (la sienne,
  `offer_message`, ou celle de l'acheteur) compte comme un contact : jamais une 2ᵉ offre.
- Mode auto : un message quel qu'il soit dans la conversation ⇒ rien n'est écrit (garde-fou 5.309, perdu en 5.455).
- La transaction est celle de la DEMANDE (`inquiries` → `transaction_id`). Celle de la conversation (ou de l'ancien n°) ne sert
  qu'à défaut, et seulement si elle porte CET article (sinon écartée : pas d'offre, favori sauté « prix pas lu »). Jamais une
  recherche dans les messages. La transaction de la demande qui dirait un autre article ⇒ rien (contradiction sur l'objet même
  de l'offre).
- Les articles listés dans la conversation ne refusent plus : leur forme est notée (`vrmFormesFavori`, `favori_req_conv_autre_article`).

## Le chronomètre
- `vrm-badge.js` : UNE horloge pour tout le panneau (carte, grand panneau, page principale, rangées) avance chaque
  `[data-fav-dans]` de l'ombre chaque seconde ; à zéro, le panneau se relit une fois. Avant : un minuteur sur la seule carte,
  arrêté dès qu'elle n'était pas ouverte. La rangée du prochain favori dit « En attente · prochain dans 42 s » (avant : une heure figée).
- `vrm-action.js` (fenêtre « VRM · Messages aux favoris », écran plein) : même principe pour `[data-action-dans]` ; avant, une mise
  à jour sur place remplaçait l'élément et le minuteur s'arrêtait.

## Les autres cas corrigés dans ce lot
| cas | avant | maintenant |
|---|---|---|
| création refusée 400 (téléphone), 429, 403, 409 | comptée comme une écriture : favori « contacté » pour toujours, auto jamais repris, un 4xx propre à ce favori arrêtait la file | `ecrits` 0 (`ecritureFavoriPartie`) : renvoyable, sauté si propre à lui |
| VRM injoignable à l'autorisation | « incertain » : file bloquée sur « vérifie sur Vinted » | « pas envoyé » (rien n'est parti) |
| prix dans une autre devise | offre calculée et comparée au prix mini en euros | aucune offre, sauté « prix pas lu en euros » |
| prix pas lu (`offre_prix_inconnu`) | arrêtait la file | refus local : sauté, trois de suite arrêtent |
| 3 conversations ouvertes de suite sans relecture | « ignore » ne comptait pas : une conversation vide avec chaque acheteur | comptées dans les « N de suite » (`sautSuspect`), la file s'arrête au 3ᵉ |
| saut après une écriture | le rythme était remis à zéro | le rythme 20–60 s est gardé |

## Preuves
- `audit-favoris-requetes-vintex.cjs` : 33 verts ; sur la 5.455.3 (origin/main) **11 rouges** (V16b, V16c, V19, V21–V28) ;
  `--prouve` : chaque mutation rouge (dont `article-refuse`, `tx-conversation-dabord`, `tx-conv-autre-article-gardee`,
  `ecrit-sur-4xx`, `offre-pas-contact`, `auto-messages-systeme`, `autre-devise`, `autorisation-incertaine`).
- `favoris-progression.test.mjs` : 2 tests neufs (3 sauts suspects arrêtent, rythme gardé ; prix pas lu = sauté).
- Banc `favoris-auto.cjs` F2b : le compte à rebours avance (43 → 40 s) et continue après une mise à jour sur place ; rouge sur la 5.455.3.

## Reste (5.455.5, en cours)
Reprise après la mort du service worker entre l'offre et le message (uuid), `terminer` perdu rejoué, texte vérifié avant
l'offre, registre des offres faites, fenêtres d'autorisation, `read_after_write_token` à la relecture, raisons des gardes.

Geste de Julien : installer **5.455.4** (remplacer le dossier, ⟳ dans chaque Chrome), puis relancer l'envoi.
