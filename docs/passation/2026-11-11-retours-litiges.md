# 11 nov. — Assistant retours et litiges — branche `claude/retours-litiges` (partie de `origin/claude/revue-colis` @ 903c2258)

Demande de Julien : « pour les retours on doit avoir les bordereaux à imprimer aussi », dans les deux sens
(vendeur : retour / litige ouvert par l'acheteur ; acheteur : il renvoie un achat).

**Session ARRÊTÉE sur demande de Julien (relayée par la session principale) avant toute ligne de code.**
Rien n'a été modifié dans `src/`, `api/` ni l'extension. Aucune écriture en base (lectures SQL seulement).

## REPRISE DU 11 NOV. (soir) — FAIT

Code écrit et poussé (branche `claude/retours-litiges`). Extension : **rien** (la 5.359.0 n'est pas prise :
tout arrive par e-mail). Aucune écriture en base.

### Ce qui change pour lui
- **Achats → « Retours »** (au-dessus des listes, à côté du bloc « à renvoyer ») : une carte par bordereau
  de retour reçu par e-mail — N° de la paire (celui de la fiche reliée à CET achat par son clic, sinon
  « Sans N° »), « À déposer avant le 18 nov. à 23 h 59 » (ambre à moins de 48 h ; « Date limite non lue »
  sinon), le suivi du colis de retour (statut du transporteur, trois états), « Pas encore remboursé » ou
  « Remboursé 45,90 € » (« en partie » si moins que payé), **« Imprimer le bordereau »** : SON PDF (lu par
  son n°, à l'impression seulement), tamponné **« RETOUR · N°31 »** + titre (`src/tamponRetour.js`), ouvert
  dans la visionneuse (téléchargé sur iPhone). « Voir sur Vinted ↗ ». Remboursés de plus de 30 j : repliés.
- **« Tout imprimer » → section « Retours »** (après « Étiquette dans eBay ») : les bordereaux de retour pas
  encore remboursés, imprimés un par un (pas mêlés au PDF des envois : un retour ne passe pas « prêt à
  déposer » des ventes). Une section AJOUTÉE, la feuille du lot DJ3 n'est pas réécrite.
- **Litiges → « Pas à pas »** sur chaque carte : feuille avec la PREUVE (transaction / e-mail / les deux /
  eBay — la vente n'est en retour que si c'est prouvé, règle inchangée de `src/litiges.js`), les **délais avec
  leur source** (date LUE dans l'e-mail ou par eBay, sinon « Vinted ne l'écrit pas » ; « vérifier la paire :
  2 jours après réception » = règle écrite par Vinted dans ses e-mails de retour), les étapes (répondre ·
  attendre · le colis revient · reçu · remboursé · remise au stock), ses preuves (photo du carton, bordereau
  de départ), **« Préparer mon dossier »** (le PDF du lot BJ), **« Paire revenue · N°21 »** ⇒
  `remettreDepuisCarte` existant (SON N°, conflit DEMANDÉ, jamais un nouveau N°) — grisé « Sans N° : pose son
  N° d'abord » sans identité —, **« Pas la bonne paire / abîmée ↗ »** ⇒ SA conversation (« Signale-le sur le
  site avant le remboursement »).
- **Compta** : un achat dont le remboursement est PROUVÉ par e-mail (même n°, montant ≥ payé) sort des
  coûts tout de suite (`avecRemboursementsProuves` posé sur `buysBase` : son statut devient « Remboursement
  effectué », ce que `achatAnnule` — Dépensé, registre des achats, export — voit) ; partiel ⇒ rien ne bouge.
  Une vente en retour / remboursée n'entre dans aucun mois du CA déclaré (règle existante, PROUVÉE par l'audit
  sur `api/_lib/ventes-regle.js`).

### Serveur (`api/email-inbound.js`, avant toute autre branche ; règle pure `api/_lib/retour-email.js`)
- Sujet `Bordereau de retour…` ⇒ n° de transaction de la pièce `Bon-Retour-Vinted-{tx}.pdf` puis du corps (deux
  n° différents ⇒ rien), une seule pièce PDF exigée, suivi, limite (corps puis sujet, heure de Paris via
  `lireDateLimite`), article ⇒ `email_bordretour_{tx}` (PDF ENTIER) + notification « ↩️ Bordereau de retour
  reçu » (famille colis, ouvre l'achat). Illisible ⇒ `garderInconnu` « bordereau de retour : <raison> »
  (« à vérifier »), écriture ratée ⇒ 503.
- « La commande "…" a été remboursée ! » + « paiement que tu as fait » ⇒ `email_rembachat_{tx}` (montant,
  date estimée — JAMAIS le moyen de paiement ni ses chiffres) ; sans n° ou sans montant ⇒ la famille d'avant.
- « Retourne ta commande d'ici le … » : inchangé (aucun n°, lu par `src/litiges.js`).
- App : lecture en PROJECTION (`meta->>`, `_pdf`), cache 5 min (`fetchRetoursAchat`).

### Preuves
- `scripts/audit-retours-litiges.cjs` (EXÉCUTE la route sur des e-mails INVENTÉS à la forme mesurée + règles
  de l’app + tampon sur un vrai PDF + compta) : **38/38** ; sur l'arbre d'avant (1c8e0a07, git archive) :
  **15 rouges** (le bordereau de retour sortait « ignoré », le remboursement « connu-sans-action ») ;
  `--prouve` : **11/11** mutations rouges (branche absente, n° du corps seul, sans PDF rangé, e-mail jeté, carte rangée, relié par titre, remboursement inventé, partiel sorti des coûts, « Paire revenue » sans N°, source tue, tampon sans N°).
- Banc `scripts/bancs/retours-litiges.cjs` (390 tactile clair/sombre, 1512 clair) : voir ci-dessous.
- Touchés et verts : audit-litiges-ecran, litiges, retours-stock, lbc-suppression, variables, tdz,
  coherence, identite, icones, textes-courts, fonctions-api, secrets, quoi-de-neuf, traduction (C2 était
  rouge avant la fusion de `origin/claude/revue-colis`, vert après).

### Reste
- Leboncoin / Vestiaire / eBay : aucun bordereau de retour d'ACHAT jamais vu ⇒ rien (Vinted seul).
- Le PDF du 8 nov. reste perdu (brut tronqué) : à retélécharger sur Vinted s'il sert encore.
- Un « Remboursé » d'achat sans bordereau de retour = une annulation : pas de carte « Retours » (il sort des
  coûts quand même, prouvé par son n°).

## ÉTAT À LA REPRISE (première session, avant tout code — gardé tel quel)

### Fait
- Branche créée et poussée (`claude/retours-litiges`, même tête que `claude/revue-colis` + ce récit).
- Inventaire de l'existant (à NE PAS refaire) :
  - `src/LitigesEnCours.jsx` + `src/litigesEcran.js` + `src/litiges.js` (lots BB/BI, 10 nov.) : écran
    `?tab=litiges`, une carte par vente en litige/retour, date limite LUE sinon « non lue », 4 pastilles de
    preuves, lien vers le site ; « Retours par modèle ». Récit `2026-11-10-litiges-retours.md`.
  - Dossier PDF par carte (lot BJ, `contenuDossierLitige`, pdf-lib dans le navigateur, bordereau joint
    seulement sur case cochée) : récit `2026-11-10-litige-pdf-vitesse-avis.md`. ⇒ « Préparer mon dossier » EXISTE.
  - `src/retoursStock.js` : retour d'une VENTE (440 / « Retour initié » / non réclamée) suivi initié → en
    route → reçu (SON clic) → remboursé, remise en stock par identité (`remiseEnStock`, N° gardé).
  - `litiges.js` lit déjà le sujet « Retourne ta commande d'ici le … » (`SUJET_RETOUR_ACHAT`, sens achat).
  - Serveur : `api/email-inbound.js` ne reconnaît que « Bordereau d'envoi » (l. ~2595, `parseBordereauEmail`,
    `stampBordereau` de `api/_lib/stamp.js`, ligne `email_bord_{tx}`).

### Mesuré (vraie base, lecture seule, 11 nov.) — formes, sans aucune donnée personnelle
1. **« Bordereau de retour - {article} - à utiliser avant le JJ/MM/AAAA HH h MM »** (côté ACHAT, 1 e-mail,
   8 nov.) : rangé en `email_inconnu_*` type `inconnu` (« aucune règle ne le reconnaît ») ⇒ **le PDF est
   perdu** (le `brut` gardé est tronqué). Forme :
   - pièce jointe `Bon-Retour-Vinted-{n° de transaction}.pdf`, `application/pdf`, créée par MondialRelay ;
   - corps : « Ton bordereau de retour est joint à ce message », « *Numéro de suivi :* {8 chiffres} »,
     « *Date limite d'envoi :* JJ/MM/AAAA HH h MM », « *Numéro de transaction :* {11 chiffres} »,
     « *Article :* … » ; délai Vinted écrit : remboursement « dans les 2 jours qui suivent la réception de la
     commande par le vendeur, à moins qu'il ne signale un problème » ; pas envoyé à temps ⇒ « la transaction
     sera conclue et le paiement transféré au vendeur ».
2. **« Retourne ta commande d'ici le {j} {mois}. : {article} »** (côté ACHAT) : `email_inconnu_*` `inconnu`,
   aucune pièce jointe, **aucun n° de transaction** dans le corps (« X a demandé le retour… Retourne la
   commande d'ici le 16 nov. ») ⇒ ne se relie à un achat que par le bordereau de retour (même tx), jamais par
   le titre.
3. **« La commande "{article}" a été remboursée ! »** (côté ACHAT, ~15 depuis le 26 oct.) : `connu-sans-action`
   famille « remboursement d'un de tes achats ». Corps : « Le paiement que tu as fait à … a été annulé »,
   « *Montant remboursé :* NN,NN € », « *N° de transaction :* … », « *Remboursement estimé sur Carte
   bancaire :* JJ/MM/AAAA ». (Contient les 4 derniers chiffres de la carte : ne JAMAIS les ranger.)
   ⇒ preuve « remboursé » d'un achat, par SON n° de transaction.
4. Côté VENTE : rien de neuf mesuré (voir le récit du 10 nov. : 440, 430, « Action requise »). Leboncoin /
   Vestiaire : aucune forme de litige jamais vue ⇒ « ne se lit pas encore », jamais deviné.

### Reste (rien n'est commencé)
1. **Serveur** (`api/email-inbound.js`, AVANT la branche « Bordereau d'envoi ») : règle pure neuve
   `api/_lib/retour-email.js` — sujet `^(?:Fwd?:\s*)?Bordereau de retour\b` ⇒ tx (nom de la PJ
   `Bon-Retour-Vinted-(\d{6,})` puis « Numéro de transaction »), suivi, date limite (corps puis sujet,
   heure de Paris), article ; ligne `email_bordretour_{tx}` `{ type:'bordereau-retour', sens:'achat', pdfB64,
   filename, suivi, dateLimite, article, account, uid, receivedAt }` ; sans tx ou sans PDF ⇒ `garderInconnu`
   (« à vérifier »), jamais jeté ; écriture ratée ⇒ 503. Sujet « La commande "…" a été remboursée » avec
   « paiement que tu as fait » ⇒ `email_rembachat_{tx}` `{ montant, estime, tx }` (jamais la carte).
   Banc qui EXÉCUTE la route (§4.10), formes inventées à la forme mesurée ci-dessus.
2. **App, côté acheteur** : `src/retoursAchat.js` (pur) — une carte par tx de bordereau de retour : achat
   relié par SON tx (`orders_bought.transaction_id`), N° de l'achat s'il en a un, limite, suivi (statut
   `transp_*` : trois états), « Remboursé NN € » seulement prouvé (e-mail par tx ou statut « Remboursement
   effectué » de l'achat), sinon « Pas encore remboursé ». Section « Retours » dans Achats (feuille, ne pas
   toucher les écrans de `revue-colis`), « Imprimer le bordereau de retour » tamponné « RETOUR · N°… »
   (réutiliser le tamponnage de l'app, l. ~12119 de `App.jsx`, ou `stampBordereau`), et une section
   « Retours » dans « Tout imprimer » (l. ~40754-41099, parcours DJ3 — zone Colis : ajouter, ne pas refaire).
   Lecture : projection seulement, jamais `select=data` (PDF lourd).
3. **App, côté vendeur** : sur la carte de `LitigesEnCours`, une feuille « Pas à pas » : délais avec leur
   SOURCE (texte des e-mails Vinted mesurés ; eBay `respondByDate`), « Paire revenue » ⇒ `remiseEnStock`
   existant (N° gardé), « Pas la bonne paire / abîmée » ⇒ lien vers la conversation (signaler avant le
   remboursement, « 2 jours » d'après l'e-mail), photos du carton (`photoCartonDe`), bordereau de départ.
4. **Compta** : vérifier (audit) qu'une vente remboursée sort de `ventesDeclarables` au mois du versement
   (déjà annoncé par `retoursStock.js`, à PROUVER), et qu'un achat remboursé (preuve par tx) sort des coûts.
5. Traduction (`tr()`, fr puis en/es/it/de), « Quoi de neuf » (`src/nouveautes.js`), ligne §9, audits +
   bancs 390/1512 regardés, rouge sur l'avant + mutations, merge `origin/claude/revue-colis` puis `origin/main`.
6. Extension : **5.359.0** réservée pour lire une page de retour Vinted — PAS nécessaire pour Vinted (tout
   arrive par e-mail) ; ne la prendre que si une forme le demande.

### Pièges
- Le dépôt est PUBLIC : aucun n° de transaction, de suivi, pseudo ni chiffre de carte réel dans un banc ou un récit.
- « Retourne ta commande » n'a pas de tx : ne jamais le relier par le titre (§5) ; il ne vaut que comme
  annonce d'un retour à venir.
- Le PDF du 8 nov. n'est pas récupérable depuis la base (brut tronqué) : à retélécharger sur Vinted.
- `remboursé` d'un achat ≠ retour : la plupart des « a été remboursée » sont des annulations ; ne compter
  « retour » que si un bordereau de retour du même tx existe.
