# 5 nov. 2026 — L'onglet « E-mails » : boîte de réception + « Relier ma boîte »

Branche `v31-onglet-emails` (partie de `claude/project-review-nsk5su`), **pas poussée**, pas de PR.
Demande : `docs/passation/demandes-2026-11-05.md` §9 et « Précisions du vocal » (E-mails) :
« une vraie boîte de réception, filtres (par compte, ventes, achats, codes…), et le motion design
par boîte (Google, iCloud…) ; e-mails de Vinted, Leboncoin, Vestiaire, eBay, Mondial Relay,
Chronopost, Vinted Go… ».

## Ce qui a été mesuré d'abord (lecture seule, base `lgonxzrzjcqthjtbdpzo`, SELECT seulement)

- Les emails rangés par `api/email-inbound.js` ont **une ligne de suivi** `email_reception_{empreinte}`
  par Message-ID (883 lignes le 5 nov., 577 octets en moyenne, 885 au plus) : `adresses` (adresses
  de réception), `messageId`, `subject`, `from`, `receivedAt`, `sourceDate`, `at`, `etat`
  (`integre` · `a-verifier` · `erreur`), `type`, `raison`, et `resume` (413 lignes, celles rangées
  depuis le 31 oct.). Le texte lisible vit à part : `email_texte_{empreinte}` (413 lignes, ≤ 1 593 o).
- `type` est présent sur toutes les lignes : `connu-sans-action` 327, `suivi` 189, `offre` 98, `achat`
  65, `favori` 57, `action` 53, `message` 34, `vente` 19, `bordereau` 19, `finalisation` 12, `ignoré` 10.
- Le code de retrait vit dans `resume.code` (45 lignes). Une ligne d'avant le résumé n'a pas de code
  lu ⇒ elle est dans « Colis », jamais dans « Codes » (pas su ≠ oui).
- **Aucune liste de pièces jointes n'était gardée** sur la ligne de suivi (le PDF d'un bordereau vit
  dans `email_bord_*`, jusqu'à 249 Ko — jamais lu ici, §4.4).
- Domaines d'expéditeur vus : `vinted.fr` (1 404), `icloud.com` (1 133 — transferts iCloud),
  `relay.vinted.com`, `privaterelay.appleid.com`, `ebay.com`, `reply.ebay.fr`, `mondialrelay.com/.fr`,
  `team.vinted.com`, `performance.leboncoin.fr`, `leboncoin.fr`… Chronopost, Vinted Go, Relais Colis et
  Vestiaire ne sont pas (encore) vus en expéditeur direct : leurs mots-clés viennent des lecteurs de la
  route (`chronopost.fr`, `vintedgo.com`, `vestiairecollective.com`) ; Relais Colis reste un mot-clé large.

## Ce qui a été fait

### Serveur (aucune fonction de plus — 12/12, on étend `api/email-rattacher.js?mode=journal`)
- `api/_lib/boite-email.js` (NOUVEAU, une règle, §11) : les rubriques de la boîte
  (`RUBRIQUES_BOITE` : Ventes · Achats · Codes de retrait · Colis · Autres), `rubriqueEmail` (l'étiquette
  d'une ligne, lue par l'écran), `filtreBoite` (le même filtre en PostgREST, lu par le serveur),
  `listePieces` (nom, type, poids — jamais le contenu ; 10 pièces au plus).
  « Codes » = `suivi` avec un code LU ; « Colis » = `suivi` + `bordereau` (codes compris) ; « Autres » =
  tout le reste. La rubrique se lit sur le `type` posé au classement, **jamais sur le sujet**.
- `api/_lib/reception-email.js` : `lireJournalEmail` accepte `boite=` (rubrique inconnue ⇒ 400), projette
  `pieces` pour rendre `pj` (le NOMBRE de pièces) et compte `parRubrique` sur les 200 derniers (même
  règle que l'étiquette, couverture dite). `lireEmailBoite` (NOUVEAU, `?mode=journal&lire=<id>`) : UN
  email — sa ligne de suivi en scalaires projetés + son texte + ses pièces, sous SON owner ; pièces
  `null` = liste non gardée (email rangé avant le 5 nov.), `[]` = aucune lue.
- `api/email-inbound.js` : la ligne de suivi garde `pieces: listePieces(mail.attachments)`.

### App
- Nouvel écran `emails` (« E-mails », icône `mail`, groupe « Gérer » ; `?tab=emails` dans `TABS_OK`),
  chargé à la demande (`src/BoiteEmails.jsx`, `lazy`). Deux vues :
  - **Boîte de réception** : rubriques en pastilles (nombre sur les 200 derniers, couverture écrite),
    compte = adresse de réception (liste rendue par la route : nom du compte quand l'adresse en désigne
    un seul), 20 par page + « Voir plus », trombone + nombre de pièces, « à vérifier » en ambre. Lire un
    email : sujet, expéditeur lisible + adresse, date (celle de la boîte d'origine si transmise, sinon
    l'arrivée dans VRM, et c'est dit), adresse de réception et compte, « Ce que VRM en a fait » (la
    phrase du journal, `src/journalEmail.js`), le corps **nettoyé** (`nettoyerCorps` : liens de pistage
    réduits à leur domaine, invisibles retirés, lignes resserrées) rendu en TEXTE, les pièces jointes
    listées (ou « liste non gardée », ou « aucune »). Ordinateur : liste | lecture côte à côte ;
    téléphone : feuille plein écran en portail avec `FermeAuRetour`.
  - **Lien vers l'objet relié — par IDENTITÉ seulement** (`objetRelie`, `src/boiteEmails.js`) : n° de
    suivi (colis à retirer, `?tab=cat_bord&cible=retrait&suivi=…`), n° de transaction (colis de la vente
    `cible=colis`, achat `cible=achat` — pas si le reçu est délié par lui), N° lu dans l'email
    (« Tout sur le N° », jamais un N° retrouvé par le titre). Sinon : « Relié à rien de précis dans
    VRM », dit. Un colis SORTANT n'invente pas de cible « à retirer ».
  - **Relier ma boîte** (`src/RelierBoite.jsx`, contenu dans `src/relierBoite.js`) : cinq messageries
    (Gmail, iCloud Mail, Outlook/Hotmail, Orange/SFR/Free, autre), cinq étapes chacune, une **scène
    animée en CSS/SVG** (fenêtre de messagerie inventée, sans logo : la roue, l'adresse tapée, le code
    de validation, la règle qui se remplit, un email qui arrive et une copie qui part vers VRM) avec
    Précédent / Lecture-Pause / Suivant et points d'étape ; huit expéditeurs (Vinted, Vinted Go, Mondial
    Relay, Chronopost, Relais Colis, Leboncoin, eBay, Vestiaire) à cocher : toucher un expéditeur
    montre SA règle dans la scène ; la règle à copier (Gmail : une ligne pour « De » ; ailleurs : une
    règle par expéditeur) et la vraie adresse de VRM (`ADRESSE_COLLECTRICE`) à copier HORS de la scène.
    Adresses de la scène inventées en `.test`. **Aucune requête** sur cette vue. `prefers-reduced-motion`
    : scène figée, lecture automatique coupée. Un lien mène à Réglages → E-mails → Adresses (déclarer et
    confirmer son adresse : la preuve reste là-bas).
- Le journal de Réglages → E-mails (31 oct.) reste tel quel (rien retiré, §4.11).

## Preuves
- `npm run build` vert.
- `node scripts/audit-boite-emails.cjs` : **56/56** — exécute la vraie `email-inbound` (pièces listées,
  aucun contenu) et la vraie `email-rattacher?mode=journal` sur une base servie dans sa forme réelle
  (`select=` projeté, chemins `data->resume->>code`, `in.`/`not.in.`/`not.is.null`/`cs.`, owner) :
  chaque rubrique filtrée par la base = la même que l'étiquette, 400 sur rubrique inconnue, `lire=` sous
  SON owner, l'email d'un autre vendeur jamais rendu, 503 sur panne, jamais `select=data`, 50 reçus au
  même titre jamais reliés. Sur le code d'avant : plante (module absent). **Mutations** : filtre
  « codes » sans le code ⇒ 3 rouges ; lien gardé sur un reçu délié ⇒ 1 rouge ; contenu des pièces
  gardé ⇒ 2 rouges.
- `scripts/bancs/boite-emails.cjs` (données inventées, `BANC_PORT=7967`, `CHROMIUM_PATH=/opt/pw-browsers/chromium`)
  : **165 verts / 0 rouge** à 390 px tactile et 1512 px, clair et sombre, + mouvement réduit. Sur l'arbre
  d'avant (`git archive 33200ec6`, banc copié dedans, port 7968) : **0 vert / 5 rouges** (`?tab=emails`
  n'existe pas). Captures regardées : liste et lecture côte à côte (1512), feuille plein écran sombre
  (390), les cinq scènes à la fin de leur mouvement (clair, sombre).
- Inchangés et verts : `audit-journal-emails` 58/58, `audit-fonctions-api`, `audit-icones`,
  `audit-coherence`, `audit-comptes-securite`, `audit-bancs` (`verif_visuel` et `verif_dark` listent
  `emails` ; ils demandent les fixtures `fx/`, pas relancés ici).
- `node scripts/fusion-echelle.mjs --verifier` est rouge **sur 4 fichiers non touchés** (`fusion.css`,
  `styles-bureau.css`, `styles-chargement.css`, `styles-parcours.css`) — déjà le cas sur la base ;
  `boite-emails.css` est dans l'échelle.

## Ce qui reste
- **Rien n'exige l'extension** pour cet écran. Côté extension, rien à faire.
- Les emails rangés **avant le 5 nov.** n'ont pas de liste de pièces jointes (dit « liste non gardée ») ;
  ceux d'avant le 31 oct. n'ont ni texte ni résumé (dit). Pas de reprise rétroactive : il faudrait relire
  les `email_inconnu_*` (jusqu'à 117 Ko chacun) — non fait, §4.4.
- Les emails mis de côté (quarantaine, adresse non confirmée) ne sont pas dans la boîte : ils restent dans
  Réglages → E-mails → À rattacher.
- Chronopost, Vinted Go, Relais Colis, Vestiaire : mots-clés de filtre pas encore vérifiés sur un email
  reçu chez lui ; à confirmer au premier vrai email (le journal dira « pas compris » s'il arrive sans lecteur).
- Les chemins de menus des messageries (iCloud, Outlook, Orange/SFR/Free) changent selon les versions : la
  scène et le texte le disent (« cherche filtre, règle ou transfert »).

## Geste de Julien
Ouvrir **E-mails** (Plus → Gérer → E-mails au téléphone), regarder la boîte, ouvrir un code de retrait ;
puis **Relier ma boîte** → choisir sa messagerie → poser la règle (copier/coller) sur chacune de ses boîtes.

## Revue adverse (même jour)

Mesuré d'abord (lecture seule, SELECT) : 894 lignes `email_reception_*` ; 9 adresses de réception,
toutes déclarées (aucune avec « + », majuscule ou espace : le filtre `cs.` par compte les trouve
toutes) ; `resume.code` jamais vide (`court()` rend `undefined`) ; 424 `email_texte_*`, dont **20 coupés**
à 1 500 caractères + « … » (`TEXTE_MAX`, `api/_lib/resume-email.js`).

Défauts trouvés, reproduits, corrigés :
1. **Les nombres des pastilles ignoraient le compte choisi** : « Ventes 7 » à côté d'une liste filtrée
   sur une adresse qui n'en a que 3. La route compte maintenant sur l'adresse choisie (pas sur l'état
   ni la rubrique, qu'elle compte) et le dit (`compteurs.adresse`) ; la phrase devient « Comptés sur tes
   N derniers e-mails reçus sur … ». Le journal de Réglages (même route) en profite et le dit aussi.
2. **Un texte coupé à la réception était présenté comme le message entier** : `lire=` rend `texteCoupe`
   et l'écran écrit « Extrait : VRM garde le début du message (1 500 caractères). La suite est dans ta
   messagerie. »
3. **Outlook, étape 4 : « dis-le dans Réglages → E-mails → Aperçu »** — rien ne permet de « le dire »
   là-bas. Remplacé par un constat vérifiable : si rien n'apparaît dans la boîte VRM après le prochain
   email de Vinted, c'est qu'Outlook l'a bloqué.

Preuves : `audit-boite-emails` 61/61 (4 contrôles neufs, rouges sur 3e56e390) ; banc `boite-emails`
173/0 (8 rouges sur 3e56e390, arbre `git archive` reconstruit, banc copié dedans) ; captures
`compte-*` et `extrait-*` regardées. Voisins verts : `audit-journal-emails` 58/58, `audit-fonctions-api`,
`audit-icones`, `audit-coherence`, `audit-comptes-securite`, `audit-bancs`, bancs `journal-emails` 60/0,
`emails-action` 14. Banc `reception-emails` : 3 rouges (deux boutons « Réessayer », sélecteur strict)
— **les mêmes 3 sur 3e56e390**, donc antérieurs à cette branche, non touchés ici.
