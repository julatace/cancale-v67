# 11 nov. 2026 — Lot achat-photo : la photo du ticket propose l'achat

Branche `claude/achat-photo` (depuis `origin/main`). Poussée à chaque commit. Pas de PR, pas de fusion
dans `main` (consigne du coordinateur).

Demande : une photo du TICKET (ou facture, capture d'écran de commande) pré-remplit « Nouvel achat » :
montant total, date, lieu, nombre d'articles. Le vendeur VALIDE toujours le prix (§2.5). Lecture sans
IA payante (§2.9).

## Ce qui existait, réutilisé (rien doublé)

- `src/depensesTicket.js` (Compta, boîte à dépenses, 3 nov.) : la lecture LOCALE du ticket —
  `TextDetector` du navigateur s'il existe, sinon Tesseract (WASM, exécuté dans la page, chargé de
  cdn.jsdelivr.net, déjà autorisé par la CSP et déclaré dans la politique des hôtes) — et
  `montantDuTicket`. **Améliorés sur place** (la dépense en profite aussi) :
  - « Total (TVA incluse) 45,00 € » n'est plus écarté (le mot TVA écartait la ligne) ;
  - « Total 60 € » (capture d'écran sans centimes) : un entier compte s'il est collé à « € »/« EUR » ;
  - une remise « -5,00 » n'est jamais un total ; « à rendre », « réduction », « fidélité » écartés ;
  - la ligne d'après n'est lue que si la ligne du mot n'a AUCUN chiffre (« TOTAL ARTICLES 3 » ne
    prenait plus le « CB » suivant par hasard) ;
  - neuf : `dateDuTicket`, `lieuDuTicket`, `articlesDuTicket`, `lireTicketAchat`, et
    `lireTexteTicket` qui dit POURQUOI rien n'est lu (`hors-ligne`, `chargement`, `delai`, `erreur`).
    `texteDuTicket` (Compta) garde sa forme.
- « Nouvel achat » refait le 11 nov. (lot DJ5, `2026-11-11-achats-relier.md`) : formulaire gardé tel
  quel, tous ses `data-*` gardés. La photo de l'ARTICLE reste la photo de l'achat (tuile renommée
  « Photo de l'article » pour la distinguer du ticket).
- La facture jointe (lot AN, `src/factureAchat.js`) : le ticket y va.

## Le parcours

1. En tête du formulaire, une rangée « Photo du ticket · Remplit le prix, la date et le lieu. »
2. Un toucher, la photo (appareil ou galerie). « Lecture du ticket… Sur ton appareil, rien n'est envoyé. »
3. Les champs **VIDES** reçoivent ce qui est lu (`src/achatTicket.js`, pur) :
   - prix : marqué ambre « Lu sur le ticket — vérifie » (ambre = geste à faire, §7) ;
   - date : la date du ticket remplace celle du jour posée par défaut (une date qu'il a changée reste) ;
   - lieu : l'enseigne écrite (liste courte connue) ou la 1re ligne de lettres en tête du ticket ;
   - « 3 articles sur ce ticket : c'est le total. » (dit, jamais découpé) ;
   - le ticket devient la facture jointe (« Ticket joint comme facture · Retirer »).
4. Le bouton dit le montant : **« Valider 45,00 € et ajouter »**. Rien n'est écrit avant ce clic.
   Il retape le prix ⇒ le marquage tombe, le bouton redevient « Ajouter l'achat ».

## Tranché (ambigu)

- **« Jamais enregistré sans son clic »** : le prix lu remplit le champ (demandé : « champ proposé,
  surligné ») mais le bouton porte le montant. Son clic sur « Valider 45,00 € » EST la validation :
  aucun geste de plus, et il ne peut pas valider sans voir le chiffre.
- **Ce qu'il a tapé n'est jamais écrasé** (prix, lieu, date changée).
- **Lieu sans total ni date lus** : seule une enseigne connue compte (un texte quelconque d'OCR
  n'est pas un lieu). Mieux vaut un blanc qu'un faux.
- **Le ticket comme facture** : par défaut (un geste gagné), écrit seulement à « Ajouter », retirable.
  Même si la lecture a échoué : la photo reste un justificatif.
- **Nouvel achat seulement** (pas en modification) : relire un ticket sur un achat validé brouillerait.
- Plusieurs articles : on dit le nombre, on ne répartit rien (le prix est le sien à saisir, §2.5).

## Gestes comptés (achat en magasin avec ticket)

- Avant : nom, prix (taper), lieu, date (sélecteur), facture (bouton + choix), Ajouter ⇒ **7 gestes**
  et un montant à taper.
- Après : Photo du ticket, prendre la photo, nom, « Valider 45,00 € et ajouter » ⇒ **4 gestes**, rien
  à taper sauf le nom.

## Preuves

- `node scripts/audit-achat-ticket.cjs` : **41 verts** (tickets inventés : total ≠ sous-total, rendu
  monnaie ignoré, « à rendre », 12.50, « TVA incluse », « 60 € », HT/TVA, remise, sans total ⇒ rien ;
  dates JJ/MM/AAAA, JJ-MM-AA, JJ.MM.AAAA, « 5 nov. 2026 », « valable jusqu'au » écartée, future et
  31/02 ⇒ rien ; enseigne, adresse ≠ lieu ; articles ; brouillon : jamais écrasé, prix « lu » attend
  son clic). `--prouve` : **9/9 mutations rouges** (plus grand nombre, TVA incluse, remise négative,
  date future, prix écrasé, prix sans clic, lieu inventé, lieu sans ticket, bouton muet).
  Sur `origin/main` (git archive) : rouge (module absent).
- `node scripts/audit-depense-ticket.cjs` : 10 verts, ses 2 mutations toujours rouges (motifs remis à jour).
- `scripts/bancs/achat-ticket.cjs` (neuf) : **la VRAIE lecture** — Tesseract servi aux MÊMES adresses
  jsdelivr depuis les paquets npm officiels (`npm pack`, cache temporaire), aucun simulateur ; le banc
  vérifie que moteur, langue et wasm ont été servis et que `TextDetector` est absent. Ticket inventé
  dessiné par le banc (`planches-achat-photo/ticket-invente.png`). 390 tactile et 1512, clair et
  sombre : **69 verts** (T1 bouton en tête ; T2 lecteur coupé ⇒ prix vide + raison ; T3 45,00 / date /
  lieu / 3 articles / marquage / bouton / facture ; T4 rien écrit avant ; T5 son clic ⇒ achat 45 € +
  facture `achat_facture_hors_*` ; T6 prix tapé gardé ; T7 sans total ⇒ vide). Lecture ≈ 1 s.
  Sur `origin/main` rebâti (git archive) : **56 rouges**.
- Non régression : `achats-relier` 126 verts, `depense-ticket` 56 verts.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
  csp, politique-hotes. `npm run build` vert. Captures regardées : `planches-achat-photo/`.

## Limites dites

- Tesseract se télécharge au 1er ticket (~6 Mo depuis jsdelivr) : hors connexion sans détecteur du
  navigateur ⇒ « Pas de connexion : lecture impossible. Tape le prix. »
- Un vrai ticket froissé ou flou lira moins bien qu'un ticket du banc : rien lu ⇒ champ vide, jamais un
  chiffre deviné. Mesure sur de vrais tickets : à faire par Julien (aucune donnée réelle dans le dépôt).
