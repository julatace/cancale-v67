# 16 nov. — Lot `transporteurs-suivi` : Mondial Relay pour les colis vendus ; Colissimo / UPS par clé RETIRÉS

Branche `claude/transporteurs-suivi`, PR julatace/cancale-v67#1182. Mission (60) du brief du 16 nov., puis
**décision de Julien le même jour** : « on laisse tomber, enlève, on garde le suivi de Vinted ».
Aucune requête réelle aux transporteurs depuis les tests (faux serveurs), aucune écriture en vraie base,
12 fonctions `api/`, extension pas touchée.

## ÉTAT À LA REPRISE

- **PR #1182 PAS fusionnée** : règle de Julien du 16 nov., « zéro rouge pour fusionner, y compris les rouges
  déjà sur main des jobs touchés ». Les jobs Audits / Bancs / parcours-critiques avaient ~69 rouges hérités de
  main (domaines sans rapport : accueil, aide, annonces, textes courts, paramètres « taille-texte »,
  politique-hotes…). Un lot `audits-vert-main` les traite : **quand main est vert, refusionner main
  (`git merge origin/main`), repousser, attendre la CI, et fusionner seulement sans aucun rouge.**
- Le seul rouge neuf de ce lot (`audit-retours-suivi` D1) a été corrigé.
- Mesures qui manquent (rien n'a été inventé) :
  1. la forme RÉELLE d'une étiquette Mondial Relay de vente (le code postal du point est-il écrit en texte ?) —
     à mesurer en lecture seule : `cpsDeLEtiquette(await texteDuPdf(pdf))` sur 3 bordereaux, sans recopier le
     texte ; puis regarder les lignes `depart_mondialrelay_*` (`cp`, `cpsRefuses`, `essaiRes`) ;
  2. quel code postal la route `_mvc` accepte pour un colis vendu (point de l'acheteur seulement, ou aussi
     l'expéditeur) — les deux sont essayés dans l'ordre de l'étiquette, chacun prouvé par l'écho ;
  3. SMS Chronopost : toujours pas de vrai SMS copié (lecteur prudent du 9 nov. inchangé).

## Geste de Julien

**Aucun.** Il peut supprimer de Vercel les variables `LAPOSTE_OKAPI_KEY`, `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`
(plus lues nulle part). Le pas-à-pas du 13 nov. (`2026-11-13-guide-cles-transporteurs.md`) est marqué abandonné.

## 1. (a) Mondial Relay : un colis VENDU est lu chez le transporteur — GARDÉ

Par les mêmes voies que l'existant, sans aucune clé : le serveur (`api/_lib/transporteurs-lecture.js`), la même
route `_mvc` que pour les achats (mesurée le 24 oct.), la même file, le même User-Agent honnête, la même pause.
Lignes `depart_mondialrelay_{n°}` (jamais `transp_` : rien ne devient « à retirer » chez Julien, rien ne sonne).
- qui : un bordereau Vinted (`email_bord_{tx}`) ou un bon de retour (`email_bordretour_{tx}`) dont l'e-mail OU
  l'étiquette NOMME Mondial Relay (InPost compris ; deux noms différents ⇒ aucun) ; jamais par la forme du n° ;
  un n° aussi porté par un ACHAT ⇒ ambigu, jamais lu ; une vente Vestiaire Mondial Relay (aucune étiquette) n'est
  pas choisie ;
- le code postal : le PDF de l'étiquette de CETTE transaction (identité, §5), lu UNE fois ; `cpsDeLEtiquette`
  garde « 5 chiffres + ville » (jamais le code-barres, jamais le siège 59650), au plus 4, en scalaires
  (`cpsPdf`, `cpsLu`) — **le texte n'est jamais gardé** ;
- la preuve : un code postal n'est gardé (`cp`) que sur l'ÉCHO de ce n° à ce code postal ; refusé ⇒ `cpsRefuses`,
  jamais réessayé ; plus rien à essayer ⇒ aucune requête (`mrSansCodePostal`) ;
- la prise en charge est datée du 1er évènement « de route » (`classeMr`) ⇒ « Mondial Relay l'a pris en charge le … » ;
- Ventes : « Pas encore lu chez Mondial Relay. » ou, constaté, « Mondial Relay : pas de code postal du point lisible
  sur l'étiquette. Vinted et les e-mails font foi. » (`tr()`, 5 langues, `src/i18n/langues/*/suiviVente.js`).
- Fichiers : `api/_lib/depart-colis.js`, `api/_lib/transporteurs-lecture.js`, `src/App.jsx` (`raisonPasLuVente`),
  page de confidentialité (colis envoyés, « seuls les codes postaux sont gardés »).

## 2. (b) Colissimo / La Poste et UPS par clé — RETIRÉS (décision de Julien)

D'abord livré dans ce lot (clé du vendeur dans un coffre, écran Paramètres), puis **entièrement retiré**, avec le
chemin du 13 nov. (lot 89) par variables Vercel :
- supprimés : `api/_lib/cles-transporteurs.js`, `src/parametres/ClesSuivi.jsx`, la route `/api/compte?mode=cles-suivi`,
  la rangée Paramètres et son icône, les textes i18n, la ligne « Quoi de neuf », la ligne de confidentialité
  La Poste / UPS, le banc `cles-suivi` ;
- `api/_lib/transporteurs.js` : plus de `CARRIERS_CLE`, `lecturesCle`, `noterLecturesServeur`, `lireReponseLaPoste`,
  `lireReponseUps` ; `CARRIERS_SERVEUR` = Mondial Relay, Chronopost, Vinted Go ; Colissimo / UPS jamais « lisibles »,
  toujours « non lus » ; `api/_lib/transporteurs-lecture.js` : plus d'adresse La Poste / UPS, d'en-tête de clé, de
  jeton OAuth ; la réponse du passage ne porte plus `lecture` ; `api/_lib/suivi-public.js` : « aucune voie serveur,
  suivi Vinted et e-mails ».
- La ligne d'un colis Colissimo / UPS dit « **Colissimo : suivi lu par Vinted et les e-mails** — Regarde ses e-mails
  ou le site de Colissimo. » (`src/retraitSuivi.js`).

## 3. DPD, GLS, Relais Colis — rien

Aucune API officielle de suivi gratuite et ouverte à un particulier n'est documentée (services web de DPD et GLS
réservés aux clients sous contrat ; Relais Colis sans service public) ; pages jamais mesurées. Rien branché.

## 4. Preuves

- `scripts/audit-suivi-ventes-mr.cjs` (neuf) : le VRAI passage, un VRAI PDF (pdf-lib) lu par `texteDuPdf`, un faux
  mondialrelay.fr à la forme mesurée — **18 verts** ; **10 rouges** sur origin/main ; `--prouve` **10/10**.
- `scripts/audit-suivi-cles.cjs` (réécrit sur la règle « aucun suivi Colissimo / UPS par clé ») — **10 verts** :
  aucun module, écran, route, rangée, appel (api.laposte.fr, onlinetools.ups.com), en-tête (X-Okapi-Key) ni variable
  (LAPOSTE_OKAPI_KEY, UPS_CLIENT_*) dans le code ; aucun texte « colle ta clé » ; variables Vercel posées ⇒ le vrai
  passage n'envoie AUCUNE requête à La Poste ni à UPS. **6 rouges** sur origin/main ; `--prouve` **5/5**
  (Colissimo lisible, appel La Poste, variable Vercel, texte qui propose une clé, rangée Paramètres).
- Portés : `audit-colis-sortants`, `audit-suivi-commandes`, `audit-politique-hotes`, `audit-retours-suivi` (D1).
- Verts : statut-transporteurs, mondialrelay-serveur, depart-mondialrelay, transp-ext, transp-notif,
  transporteur-lu, suivi-public, retraits-irreprochables, fonctions-api (12/12), coherence, traduction,
  quoi-de-neuf, icones, export-rgpd. Rouges hérités de main, inchangés : parametres, politique-hotes.
