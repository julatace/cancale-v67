# 14 nov. — Retrait Vinted Go réacheminé : le QR, le point, les colis sans code

Julien, sur son iPhone (Achats → À retirer, colis Vinted Go réacheminé par Vinted Go vers un autre point) :
« Il n'y a pas le QR code qui est présent dans l'application. Pareil, c'est marqué à Cancale alors que le colis
est à Vannes. » Puis, le midi : « Regarde les numéros de suivi ? Parce que j'ai des paires sans code. Je t'ai déjà
dit que je ne veux pas que tu affiches des colis sans code, surtout quand c'est des erreurs. »
Captures gardées hors dépôt (données réelles). Branche `claude/retrait-vinted-go`.

## Mesures (vraie base, lecture seule, projections)

- Le colis : conversation Vinted (`panel_colis_relais`) = code et nouveau point, `qr: ''` ; suivi Vinted =
  « Disponible pour retrait » ; transporteur Vinted Go (`transp_vinted_*`) = disponible, rue + ville, SANS nom ni
  code postal, événement « Colis réacheminé vers point relais » ; e-mail Vinted Go « Nouveau relais : il est temps
  de récupérer ton colis ! » rangé `status: transit`, `relaisChange: true`, `lieu: null`, **avec** le code et le QR
  (`qrUrl`).
- **Le QR existait en base** : `http://p.vintedgo.com/public/v1/qr_codes/{n° de suivi}:{code}:{signature 64 hex}?email_code=…&amp;time=…`.
  37 adresses de QR Vinted Go en base, les 37 de cette forme ; sur les 26 lignes qui ont un n° et un code, 26/26
  ont le MÊME n° et le MÊME code dans l'adresse. Les 37 portent `&amp;` (attribut HTML non décodé).
  ⇒ le QR Vinted Go **n'est pas** le code mis en image (une signature de 64 caractères) : VRM ne le fabrique
  jamais ; il montre l'image de Vinted Go, seulement quand l'adresse désigne CE colis.
- « Cancale » : **aucune ligne de la base ne relie Cancale à ce colis** (0 ; tous les textes rangés pour lui —
  conversation, e-mails, transporteur, 2 notifications — disent le nouveau point). Le rendu de la même forme
  (Achats, Ma journée, mode relais) n'écrit pas Cancale. Ce qui est écrit « Cancale » sur ses captures, ce sont
  les cartes VOISINES : deux achats SANS code (« Nike trainers » à la Maison de la Presse, « Autry donna » au
  Super U, 35260) — `code: ''` dans la conversation, n° de suivi PRÉSENTS dans `harvest_*_suivi_*` (un suivi
  « disponible », un suivi arrêté à « Envoyé »), aucun e-mail ni lecture transporteur pour ces n°.
- En base : 50 retraits lus dans les conversations, **33 sans code** (17 à un point 35260, 12 lus depuis 7 j).
  Colis réacheminés : 1 e-mail Vinted Go « Nouveau relais » (celui-ci), 6 « Votre colis a changé de plan »
  (Mondial Relay, 4 en route, 2 rangés « livré » avant la règle du 10 nov.), 1 lecture transporteur « redirected ».

## Causes et correctifs

1. **QR absent** — le sujet « Nouveau relais : … il est temps de récupérer ton colis » tombait dans la règle du
   changement de point (« nouveau relais ») ⇒ « en route » ; la ligne qui portait le QR n'entrait jamais dans
   « À retirer » (la carte venait de la conversation, sans QR). Le transporteur le disait disponible 18 s AVANT
   l'e-mail, donc la règle datée ne le remontait pas non plus.
   - `api/_lib/etat-colis-email.js` : `SUJET_RECUPERER_AU_NOUVEAU` — un sujet de changement de point qui INVITE à
     récupérer le colis (« il est temps de récupérer », « récupère ton colis », « t'attend ») est une arrivée.
     « Votre colis a changé de plan » (il roule) reste en route.
   - `api/_lib/suivi-colis.js` (`relireLigneSuivi`, app + serveur) : la ligne déjà rangée « en route · point
     changé » avec ce sujet redevient « à retirer », notée `redirige`.
   - `api/_lib/qr-retrait.js` (nouveau, une règle pour la route et l'app) : `urlQrPropre` (`&amp;` ⇒ `&`),
     `jugerQrDuColis` / `urlQrDuColis` — un QR Vinted Go n'est montré que si son adresse porte le n° et/ou le code
     de la ligne sans rien de contraire ; autre n°, autre code ou aucune identité ⇒ aucune image.
     `api/email-inbound.js` range l'adresse décodée ; `qrImage` (App) passe par `urlQrDuColis`.
   - Extension : rien à changer (le QR vient de l'e-mail Vinted Go, 26/26 de ses e-mails Vinted Go en portent un).
     Le cadre « Code de retrait » / « Télécharger le code » de vinted.fr n'a pas pu être mesuré d'ici (aucun accès
     à vinted.fr) : à mesurer sur son navigateur si un jour un colis Vinted Go arrive SANS e-mail.
2. **Le point** — l'e-mail sans lieu recevait le lieu du transporteur (rue + ville, sans nom) qui devenait le NOM
   du point (« 12 Rue X ») et effaçait l'enseigne : `lieuDeLigne` part de la conversation de SA commande quand le
   lieu de la ligne vient du transporteur. Un achat Vinted sans e-mail confronte maintenant sa conversation au
   transporteur du MÊME n° (`lieuDeVinted`) : le plus récent prouvé gagne (événement daté après l'arrivée lue) ;
   sans date, rien n'est choisi, le désaccord est dit. Un colis DÉPLACÉ ne garde plus le nom de l'ancien point
   (`lieuCompleteParTransporteur`, src/relaisColis.js) : nom du transporteur, sinon sa rue.
3. **Aucun colis sans code dans « À retirer »** (sa règle, redite le 14 nov.) — `pickupUnion` : un achat Vinted
   sans code lu, un e-mail sans code ni QR (et sans code dans la conversation de SA commande) ne sont ni comptés
   (Ma journée, widget, cloche, mode relais) ni présentés à retirer : « À vérifier » avec la raison
   (`achats.sansCodeVinted` / `achats.sansCodeEmail`, 5 langues). Les fins prouvées étaient déjà sorties.
   ⚠️ Non expliqué : pourquoi l'en-tête de point disait « sans n° de suivi » alors que les deux n° existent en
   base (comptes 199082413 et 3203327925) — l'index des suivis ne les relie pas à ces achats ; ces deux cartes
   ne sont plus « à retirer » de toute façon.

4. **Un litige ouvert prouve que le colis a été retiré** (Julien, sur « Autry donna » : « j'ai fait un litige
   tout à l'heure dessus car la taille n'était pas bonne, elle a donc été retirée »). Mesuré : la liste des achats
   de ce compte date du 11 nov. (« colis déposé … point relais ») ; aucun détail de transaction rangé ; l'e-mail
   « Retourne ta commande d'ici le 23 nov. : Autry donna » (14 nov.) et les e-mails « {article} - Confirmation
   requise » (Autry donna le 13, Nike trainers le 11 : « Il a été indiqué que ta commande a été livrée ») ne
   portent AUCUNE identité (ni n° de transaction, ni conversation : liens de suivi vers l'accueil) — le titre
   n'en est pas une (§5) : ils ne servent pas de preuve. En base, statuts d'achats mesurés : « Retour initié »
   (3 achats ; transaction 440), « Transaction suspendue » (430, 1).
   ⇒ `finDeCommandeAchat` (api/_lib/suivi-colis.js, la règle des fins d'achat de `pickupUnion` et du rappel du
   matin `api/ship-reminders.js` — une seule règle, pas de copie) : transaction 440 ou libellé « retour initié /
   demandé / en cours » de CET achat ⇒ retiré, même quand la liste des achats, plus ancienne, dit encore « au
   point relais ». La suspension 430 n'en est pas une (une réclamation peut dire « pas reçu »). Ces deux colis
   sont de toute façon sortis de « À retirer » par la règle 3 (pas de code) ; dès que l'extension relit les
   achats du compte (« Retour initié »), Autry donna sort aussi de « À vérifier ». Nike trainers : aucune fin
   prouvée PAR IDENTITÉ en base (seul l'e-mail « Confirmation requise » au titre le dit livré) — reste « À
   vérifier » jusqu'à la relecture de ses achats.

## Preuves

- `scripts/audit-retrait-vinted-go.cjs` (règles EXÉCUTÉES : vraie `parseCarrierEmail`, `extractPickupQr`,
  `relireLigneSuivi`, `qr-retrait.js`, `qrImage` extraite par Babel, `colisRelaisChange`,
  `lieuCompleteParTransporteur`, `finDeCommandeAchat`) : **10 rouges** sur origin/main (1acc0a05, arbre
  `git archive`), vert après ; `--prouve` **9/9 mutations** rouges (dont litige ignoré, libellé ignoré).
- `scripts/bancs/retirer-vinted-go.cjs` (390 tactile clair + sombre, 1512 ; forme mesurée, données inventées) :
  **8 rouges** sur le build d'origin/main, **36 verts** après (QR chargé à l'adresse du n° et du code, `&time=`
  décodé, QR d'un autre code jamais montré, enseigne gardée, ancien point nulle part — À retirer, mode relais,
  Ma journée —, colis sans code dans « À vérifier »). Captures regardées.
- Verts : build ; audits retrait-fiable, retraits-fiables, retraits-irreprochables, retraits-suivi, suivi-colis,
  statut-transporteurs, nom-paire-retrait, codes-retrait, relais-change, retrait-qr, relais-carte, relais,
  retrait-preuves, csp, identite, coherence, tdz, traduction ; bancs retirer-scene-julien (52), retirer-nom-paire
  (44, mis à la règle « sans code ⇒ À vérifier »), retraits-fiables (24), retraits-irreprochables (26).

## Geste de Julien

Aucun : la ligne déjà rangée se relit seule à l'ouverture d'Achats (le QR apparaît). Extension inchangée
(rien à installer ; la prochaine sera 5.376.0, consolidée à l'intégration). Pour que « Autry donna » et
« Nike trainers » quittent aussi « À vérifier » : ouvrir Vinted sur leurs comptes (relecture des achats).
