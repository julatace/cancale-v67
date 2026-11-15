# 15 nov. 2026 — Le suivi des retours, câblé (branche `claude/retours-suivi`)

Julien : « regarde les retours et câble les numéros de suivi, etc. » Suite de
`2026-11-15-retours.md` (carte « À renvoyer »).

## Mesuré d'abord (lecture seule, base de production)

- **Le retour Nike était DÉJÀ DÉPOSÉ le 10 nov.** : Mondial Relay a écrit « Votre colis est entre de
  bonnes mains » pour le n° exact de son bordereau de retour (`email_track_mondialrelay_{n°}`, en transit,
  sens sortant). La carte disait pourtant « avant demain 10 h » : aucun fait du transporteur n'était relié
  aux retours.
- **Le n° lu sur l'ACHAT n'est pas celui du retour** : `harvest_{uid}_suivi_{tx}` du retour Autry porte le
  colis d'ORIGINE (BRT Italie, capté le 5 nov., avant le retour). Il n'est jamais utilisé pour un retour.
- **Côté vente, aucun n° de retour n'existe** : les transactions 440 (« Retour initié ») ne portent que
  `status`, `status_title` dans `shipment` (8 lignes sur 8, aucun n°).
- Le bordereau de retour Autry porte un n° `XU…JF` (transporteur pas reconnu à la forme) ; le PDF du
  bordereau Nike est créé par « MondialRelay ».

## La règle — `api/_lib/retour-suivi.js` (pure, l'app ET le serveur)

- Le n° d'un retour d'achat vient de SON bordereau de retour (même transaction), rien d'autre.
- Un fait ne rejoint un retour que par **égalité exacte** du n° normalisé ; deux retours au même n° ⇒ ni
  l'un ni l'autre (la carte le dit).
- Les faits : e-mails du transporteur (`email_track_*` : en transit ⇒ déposé ; disponible ⇒ au point relais
  du vendeur ; livré/retiré ⇒ livré au vendeur ; repart ⇒ revient chez toi) et lecture chez le
  transporteur (`depart_*`). Le plus avancé gagne ; la date de dépôt est le PREMIER fait. « Pas su » ne fait
  rien bouger.
- Le colis d'un retour est **SORTANT** : rangé `sens: 'sortant'` par son bordereau de retour, jamais « à
  retirer » chez Julien (prouvé : sans ça, l'e-mail « disponible » du relais du vendeur aurait sonné « à
  retirer » avec son code — mutation de l'audit).

## Ce qui avance tout seul

| fait lu | la carte |
|---|---|
| e-mail du transporteur « en transit » / prise en charge lue | « Déposé le 10 nov. · en route vers le vendeur » + « lu dans l'e-mail Mondial Relay » ; plus de date limite, ni « Imprimer », ni « Déposé » (le fait remplace le geste) ; sort de « À renvoyer » en tête de Ma journée |
| « disponible » au relais du vendeur | « Au point relais du vendeur depuis le … » |
| livré / retiré | « Livré au vendeur le … · remboursement sous 2 jours » |
| e-mail « … a été remboursée » | « Remboursé 34,32 € » |
| rien | « Déposé » reste SON geste ; lectures ratées ⇒ « Suivi pas encore lu. » |

La carte porte le logo du transporteur (celui LU sur l'étiquette, sinon celui du fait), le n° (un toucher =
copié) et « Suivre ↗ » vers la page PUBLIQUE du transporteur (Mondial Relay, Chronopost, Vinted Go — jamais
une simple recherche).

## Serveur

- `api/email-inbound.js` : le bordereau de retour garde le transporteur lu sur l'étiquette
  (`transporteurPdf`, même lecture que les bordereaux d'envoi) ; l'e-mail d'un transporteur dont le n° est
  celui d'UN bordereau de retour est rangé sortant et sonne « Retour déposé · <article> » (pas si Julien a
  touché « Déposé » lui-même, `main.vrm_retours_deposes`) puis « Retour livré au vendeur » ; le
  remboursement d'un achat sonne « Remboursé · 34,32 € » (une fois par transaction, rien sur écriture ratée).
  Textes : `api/_lib/notif-redaction.js` (sortes `retourDepose`, `retourLivre`, `rembourse`, 5 langues).
- `api/_lib/transporteurs-lecture.js` / `depart-colis.js` : les n° des bordereaux de retour sont lus comme
  des DÉPARTS (`depart_*`, jamais `transp_*`) — Chronopost et Vinted Go par le serveur. Mondial Relay ne se
  lit pas par le serveur pour un colis qu'il poste (code postal de destination inconnu, décision du 8 nov.) :
  ses e-mails font foi (le cas Nike).

## Côté vente

Aucun n° (mesuré) : le retour suit l'état Vinted (règle existante `src/retoursStock.js`). Ma journée dit
désormais aussi « N retours revenus chez toi ? · N°21 · remets en stock sous son N° » (la règle
`retourAReceptionner`), qui ouvre Colis (« Déjà reçu » ⇒ remise en stock sous SON N°).

## Preuves

- `scripts/audit-retours-suivi.cjs` (règle + route EXÉCUTÉE + départ + textes 5 langues) : vert, 9/9
  mutations attrapées (dont « retour non sortant », vérifiée à part après ajout du contrôle).
- Banc `scripts/bancs/retours-suivi.cjs` (faux transporteur local, 390/1512, clair/sombre) : vert ;
  captures regardées.
- `retours-emails`, `retours-litiges`, `fonctions-api` (12), `traduction`, `identite`, audits du suivi colis.

## Geste de Julien

Aucun. Le retour Nike apparaîtra « Déposé le 10 nov. » dès la mise en ligne (l'e-mail Mondial Relay est
déjà en base). Pour Autry : « Imprimer le bordereau », déposer — la carte avancera d'elle-même si le
transporteur écrit, sinon toucher « Déposé ».
