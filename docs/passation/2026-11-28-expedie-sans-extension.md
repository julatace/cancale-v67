# 28 nov. — Une vente expédiée restait « à imprimer » sans l'extension

Branche `claude/expedie-sans-extension`. Audit : `scripts/audit-expedie-sans-extension.cjs`
(rouge sur `origin/main` : 24 contrôles ; `--prouve` : 13/13 mutations attrapées).

## La demande de Julien (28 nov.)

« L'extension n'était pas chargée sur un compte. Pour une paire VENDUE ET DÉJÀ EXPÉDIÉE, VRM me
proposait encore d'imprimer le bordereau. Le statut ne s'est pas mis à jour tout seul, même avec
les e-mails […] Tout doit se mettre à jour automatiquement SANS l'extension. J'ai failli me tromper
et envoyer une paire que je ne devais pas. »

## Ce qui existait (mesuré dans le code)

Une règle unique (`api/_lib/depart-vente.js`, `ventesPartiesParPreuve`) décide si une vente
« à expédier » chez Vinted (`aExpedier`) attend encore l'envoi. Elle est lue par Colis, Ma journée,
la cloche, Ventes (l'app), le widget et les rappels (serveur). Preuves déjà lues :
Colis fait, expédié à la main, panneau, e-mail du transporteur pour le n° EXACT du bordereau de
CETTE transaction (n° de l'e-mail, sinon de l'étiquette), prise en charge lue chez Chronopost /
Vinted Go / Mondial Relay (`depart_*`, code postal lu sur l'étiquette).

## Les causes trouvées (pourquoi la paire restait à imprimer)

1. **Les e-mails de Vinted sur une VENTE n'étaient jamais une preuve.** Ils portent le n° de la
   TRANSACTION (lien `/transactions/{tx}`), pas le n° de suivi. La règle ne regardait que le n° de
   suivi. Pire : le dernier repli du n° de suivi (`\d{8,14}`) prenait le n° de la transaction
   (10 chiffres) pour un n° de suivi — la ligne portait un faux n° que rien ne reconnaît. Et sans
   n°, deux e-mails au même sujet (« Votre objet a été expédié ») partageaient UNE ligne : le second
   effaçait le premier.
2. **App fermée, le départ n'était lu chez le transporteur qu'au cron du matin (6 h UTC).** Le
   passage de 15 min (`api/_lib/colis-frequent.js`) ne visitait que les colis ACHETÉS et les colis
   vendus déjà pris en charge : un colis vendu pas encore vu partir ne faisait visiter personne.
   Widget, cloche, rappel du soir le disaient « à expédier » toute la journée.
3. **La vente finalisée n'était pas une preuve** (e-mail « Transaction finalisée » qui porte son n°,
   date de versement de l'app) : une liste figée gardait une vente finie « à expédier ».
4. **Rien ne disait qu'une liste était ancienne** : « à envoyer » se présentait comme sûr même quand
   la liste des ventes du compte n'avait pas été relue depuis des jours.
5. **Réimprimer un colis parti ne demandait rien.**

Ce que le code ne peut pas trancher seul : quel e-mail Julien a reçu pour CETTE paire. Si c'était
un e-mail Colissimo / UPS / DPD / Relais Colis, ces transporteurs ne sont pas lus chez eux (décision
du 16 nov.) ; Mondial Relay sans code postal sur l'étiquette non plus. Voir « À confirmer ».

## Ce qui change

- `api/_lib/depart-vente.js` : deux preuves PAR IDENTITÉ de la vente — `email-tx` (un e-mail au n°
  de SA transaction dont le SUJET constate le départ : « a été expédié / déposé / livré », « est en
  route », « a bien reçu » ; jamais un rappel, « bordereau », « étiquette », un futur, une négation,
  une question, une annulation) et `finalisee`. Daté plus d'un jour avant la vente ⇒ rien. N°
  inconnu ⇒ rien, aucune vente fabriquée. Le serveur les lit projetées (`tx:meta->>transaction`,
  `REQ_FINALISEES`). Widget, rappels, bilan, ventes vues par e-mail : la même règle.
- `api/email-inbound.js` : `txDuTexteEmail` (un seul n° de transaction, sinon aucun) ; il est rangé
  sur la ligne (`transaction`), donne SA ligne à un e-mail sans n° de suivi (`email_track_vinted_tx{tx}`),
  n'est jamais pris pour un n° de suivi ; s'il est celui d'une de SES ventes (`email_bord_{tx}`) la
  ligne est SORTANTE (jamais « à retirer »).
- `api/_lib/colis-frequent.js` : deux sélections de plus (projetées sur `owner`) — un `depart_` pas
  encore pris en charge dont l'essai a passé son rythme, et un bordereau de vente avec n° reçu depuis
  moins de 3 jours. La visite ne force aucune lecture (rythme et reculs inchangés). 12 fonctions : inchangé.
- App (`src/ecrans/Comptabilite.jsx`) : la date de versement passe à la règle ; la liste « Envoyés »
  montre aussi ces preuves avec leur phrase (`vuPartir`, `src/etiquettesDepart.js`) ; chaque geste
  « Imprimer » d'une vente (Ventes, carte et rangée de Colis) demande « Ce colis est déjà parti · le … »
  avec la raison, « Imprimer quand même » ; une vente « à envoyer » dont la liste des ventes du
  compte a plus de 24 h (la règle « en ligne », `ENLIGNE_FRAIS_MS`) ou n'a jamais été lue dit
  « À confirmer · Vinted pas relu sur X depuis N h · Ouvre Vinted sur X ». Textes en 5 langues.
- Extension : rien (aucune version montée).

## À confirmer avec les vrais e-mails de Julien

La forme réelle des e-mails Vinted d'une VENTE après le dépôt n'est pas dans le dépôt (public,
aucune fixture réelle). La règle est écrite défensivement : il faut qu'il transfère (ou qu'on lise
dans `email_inconnu_*` / le journal) :
1. l'e-mail Vinted reçu quand le colis est déposé / en route (sujet exact, expéditeur, et s'il porte
   le lien `/transactions/{n°}` ou « N° de transaction ») ;
2. l'e-mail « livré » / « l'acheteur a reçu » côté vendeur ;
3. pour la paire du 28 nov. : son transporteur (le bordereau) — si c'est Colissimo / UPS / DPD /
   Relais Colis, aucune lecture serveur n'existe (décision du 16 nov.).
Si un sujet réel n'est pas reconnu, l'ajouter à `SUJET_CONSTATE_TX` (jamais un rappel) et au §A
de l'audit.
