# Messages : les vrais messages, les offres dans la liste (5 novembre 2026)

Branche `v31-messages-offres`. Demandes de Julien (`docs/passation/demandes-2026-11-05.md`, §5 et
vocal) : « on a le code et pas les vrais messages » ; « les offres DANS les messages, marquées
« offre » ».

## Mesuré d'abord (lecture seule, base de production, 5 nov.)

Conversations captées (`harvest_{uid}_conv_*`), 3 269 entités :

| type | n | ce que VRM affichait |
|---|---|---|
| `message` | 1 099 | le texte (juste) |
| `offer_request_message` | 920 | la carte d'offre (juste) ; 911 reçues, 9 envoyées |
| `offer_message` | 587 | **« currency_code: EUR »**, encadré « Colis · retrait » — ses offres et contre-offres (584 envoyées par lui). Le balayage « défensif » des codes d'`extractEventText` prenait `price.currency_code` pour un code de retrait. |
| `status_message` | 393 | titre (juste) ; 7 sous-titres en HTML |
| `action_message` | 265 | **166 sous-titres en HTML de Vinted** (`<a class="msg-status__link …">point relais</a>`, `<br/>`) ; les balises étaient retirées à l'affichage mais le type pouvait ressortir quand rien n'était lisible |
| `portal_message` | 5 | message de l'équipe Vinted, corps HTML (`<p>`), rangé en « évènement » |

Aucune clé d'évènement ne porte un vrai code de retrait (les codes vivent dans le texte).

La LISTE : l'extrait était la `description` de la boîte (`harvest_{uid}_inbox`). Sur les
1 095 conversations captées qui ont leur boîte : description = **titre de l'annonce 720 fois**,
le corps du dernier message 39 fois, un montant nu (« 45,00 € ») 50 fois — et ces 50 sont
toutes des offres (`offer_message` en dernier). Le dernier message réel du fil capté : un
message écrit 199 fois, une offre 511 fois, un évènement 99 fois. Le résumé capté porte le
MÊME dernier message que la boîte 546 fois ; la boîte est plus récente 288 fois (Vinted la
déplace sur une offre tranchée ou un évènement) ; 1 642 entrées de boîte n'ont aucun fil capté.

## Fait

- **Une règle** `src/messagesLisibles.js` (§11) pour le fil et la liste :
  - `lireEntiteVinted(type, entité, interlocuteur)` : message / équipe Vinted (`portal_message`,
    « Équipe Vinted · … ») / offre (`offer_message` ET `offer_request_message` : montant, prix
    d'avant, sens reçue/envoyée) / évènement (titre + sous-titre sans HTML, entités décodées, le
    texte des liens gardé). Plus jamais un nom de type ni « currency_code » : un évènement sans
    rien de lisible a un corps vide et n'est pas affiché. Un code de retrait rangé dans un champ
    n'est repris que si la clé le DIT (jamais `currency_code`) et la valeur en a la forme.
  - `extraitConversation(boîte, résumé, titre de la paire)` : l'extrait d'une ligne = le dernier
    message RÉEL quand le résumé capté le confirme (même instant que la boîte, à la seconde) ;
    sinon la description de la boîte — mais jamais le titre de la paire présenté comme un message
    (la ligne de la paire le dit déjà), et un montant nu devient « Offre 45 € ».
- `extractEventText` est retiré (son balayage faisait le défaut).
- **Le résumé** (`fetchResumesConversations`) lit en plus, en scalaires, le type, le corps, le
  titre, le montant, le prix d'avant et le statut du dernier message (jamais le fil entier, §4.4).
- **La liste** : l'extrait est le vrai message (« Vous feriez 30 € ? »), un évènement est dit
  « Vinted : Envoie ta commande », l'équipe Vinted « Équipe Vinted : … ». Une offre en dernier
  message est marquée DANS l'extrait, à sa conversation : « Ton offre 40 € ~~55 €~~ », « Offre
  reçue 50 € · acceptée », « Offre 45 € » (montant de la boîte, sens inconnu). L'offre EN
  ATTENTE garde sa pastille d'accent « Offre 45 € en attente » (règle du fil, inchangée).
  Attributs : `data-conv-extrait`, `data-conv-extrait-source`, `data-offre-derniere`,
  `data-offre-sens`, `data-offre-etat`.
- **Le fil** : la carte d'offre dit « Ton offre / Offre reçue », et « au lieu de 55,00 € »
  quand il n'y a pas de statut ; l'encadré colis s'appelle « Colis » (il portait « Colis ·
  retrait » sur des consignes d'ENVOI) ; un évènement garde ses retours à la ligne.
- Mise en page (§4 de la demande) : la ligne garde compte · heure / paire · N° · état /
  extrait ; l'offre passe à gauche dans l'extrait (elle était poussée à droite d'un extrait vide).

## Décidé, pas fait

- **Offres reçues par e-mail** : non remises dans Messages. Julien les a fait RETIRER le 24 oct.
  (« ne pas rétablir ce bloc », `audit-offres-email`), et une offre e-mail n'a aucune identité
  de conversation (0 sur 518 : ni annonce, ni transaction, ni conversation ; `qui` vide sur 248/248
  le 22 oct.) — l'attacher « à sa conversation » serait un rapprochement par ressemblance (§5).
  La règle `memeOffre` reste prête : le jour où l'e-mail porte l'acheteur, elle les unit.
- **Favoris reçus** : déjà une zone à part (« Conversations · Favoris reçus ») ; non touchée
  (décision de Julien : ne pas toucher aux envois aux favoris).

## Côté extension (à faire par la session extension, rien touché ici)

- 1 642 entrées de boîte n'ont pas de fil capté : leur ligne garde la description de la boîte
  (souvent le titre). Pour que TOUTES les lignes montrent le vrai message, l'extension doit capter
  le fil des conversations de la boîte modifiées depuis la dernière lecture. ⚠️ Mesuré le 29 oct. :
  depuis le 18 oct. la page d'une conversation ne charge plus `/api/v2/conversations/{id}` ;
  la nouvelle route se mesure dans `harvest_{uid}_seen_urls.conversation` (relevé posé par
  `v29-colis-ext`). La lire là d'abord, puis capter le fil par cette route (lecture, budget de
  lecture, file Vinted), rangé dans `harvest_{uid}_conv_{id}` à la forme actuelle.

## Preuves

- `npm run build` vert.
- Banc `scripts/bancs/messages-lisibles.cjs` (données inventées, formes mesurées ; 1512 et 390
  tactile, clair et sombre ; `BANC_PORT`, `BANC_DIST`, `SHOTS`) : **0 KO après, 40 KO sur le build
  de HEAD** (cdd871a4 : « Colis · retrait », titre en guise de message, aucune offre marquée…).
  Mutations : résumé jamais confirmé ⇒ 16 KO ; `offer_message` lu comme évènement ⇒ 8 KO.
- `scripts/tests/messages-offres-historique.test.mjs` : 10/10 (4 nouveaux : offre de
  `offer_message`, HTML retiré, aucun type affiché, équipe Vinted) ; `conversation-relecture` 14/14 ;
  `actions-offres-vinted` 7/7.
- Audits verts : `audit-offres-email`, `audit-tdz`, `audit-variables`, `audit-coherence`,
  `audit-bancs`, `audit-photos-vinted`, `audit-icones`, `audit-boutons`. `audit-chiffres` : 6 rouges,
  les MÊMES sur HEAD. `fusion-echelle --verifier` : 4 fichiers hors échelle, aucun de ce chantier.

- Banc voisin `messagerie.cjs`, machine chargée : 190 à 194 OK et 1 à 5 KO qui CHANGENT d'un passage
  à l'autre (liste encore vide après l'attente fixe de 3,5 s) ; le build de HEAD sort les mêmes (4 KO,
  « conversations listées — [] »). Instable sous charge, pas ce chantier — à relancer seul.

## Non mesuré

- `messages->-1->entity->price->>amount` (et les autres chemins du résumé) contre SA PostgREST :
  grammaire de `der`/`derTs` déjà en place ; refusé, la lecture repart sans ces champs
  (`_resumeConvSansAuteur`) et la liste retombe sur la boîte.
- Le rendu sur sa vraie base (données inventées).
