# 28 nov. — Extension 5.455.8 : « un envoi ne peut pas échouer » et l'agent autonome des favoris

Branche `claude/favoris-urgent` (depuis `origin/main` 8908343b7, 5.455.7). Pas de PR ouverte (consigne du coordinateur).

## Les mots de Julien
« Je sélectionne ceux à envoyer et ça m'affiche que les favoris n'ont pas pu être lus » · « Tu dois simplement ouvrir la
conversation, faire une offre et un message » · « pourquoi tout prend du temps » · « l'offre de la XT6 depuis un mois » ·
« Import de ton passé : je t'avais demandé de l'enlever » · « je veux un vrai agent autonome qui envoie des messages aux favoris ».

## Cause de « Tes favoris n'ont pas pu être lus » (reproduite sur le code de la 5.455.7)
1. Un envoi resté **« à vérifier »** chez VRM (tentative dont le bail a expiré : worker endormi, Chrome fermé) faisait REFUSER
   tout nouvel envoi par le serveur (`lancerFile` : « Vérifie les envois incertains… »), et la file active, elle, ne réservait
   plus rien (`reserverFile`, blocage GLOBAL sur tout `incertain`, sans fin). Même chose pour une file restée active
   (« Une file est déjà en cours… »), et `apercuPourCarte` rendait alors « Des messages partent déjà » SANS la liste.
2. Le panneau, sur un refus contenant « incertain », mettait `apercuFav = null` : la liste disparaissait et
   `favorisOngletCorps` affichait « Tes favoris n’ont pas pu être lus : <la raison de l'ENVOI> » (la même variable `favErreur`
   servait à la lecture ET à l'envoi). Mesuré par l'audit (E2, arbre d'avant) : « Tes favoris n’ont pas pu être lus : Un envoi
   est à vérifier : regarde la conversation… ».
3. Un seul favori refusé (offre refusée par Vinted, onglet, session…) **arrêtait toute la file** (`terminerFile`) : le 2ᵉ ne
   partait jamais.

## Ce qui a changé
- **Serveur** (`api/_lib/favoris-file.js`, `favoris.js`, `favoris-auto.js`) : plus de refus pour un envoi « à vérifier »
  (il reste écarté pour SON favori seul — `connus`), ni pour une file active (la sélection s'y ajoute avec `ajouter`, sinon le
  reste d'hier est annulé), ni pour des réglages changés ailleurs (ses réglages enregistrés partent) ; une tentative abandonnée
  ne retient plus la file (`abandonne`) ; un refus propre à un favori laisse les AUTRES partir ; ARRÊT seulement pour « Tout
  arrêter », la vérification de Vinted, un texte que Vinted refuse ; ATTENTE (le favori repart, 3 fois au plus) pour une pause
  403/429, onglet, compte, session, autorisation ; l'aperçu montre la liste même quand une file tourne.
- **Extension** : `lancer` relit l'aperçu chez VRM au lieu de refuser (« rouvre l'onglet Favoris »), écarte seulement les favoris
  plus à contacter (dit sur leur rangée, `ecartes`) ; une file du même compte reçoit la nouvelle sélection ; la file réessaie
  seule (VRM injoignable, rien à prendre) ; la phrase de refus de Vinted est gardée (`faits[n].refus`) et dite sur la rangée.
- **Panneau** : « pas pu être lus » ne dit plus que la LECTURE ratée (`favLectureKo`) ; un envoi refusé se dit sur la rangée,
  qui reste envoyable ; « Envoyer » (rangée ou sélection) ouvre DIRECTEMENT le récapitulatif (étape 4 : offre, message prêt,
  rythme, « Lancer ») ; le plafond de l'heure ne ferme plus le bouton (les favoris attendent leur place).
- **Offres** : une offre « en attente » de plus de 7 jours (ou la fin donnée par Vinted) est expirée — jamais listée à trancher,
  jamais un geste (`offreExpiree`, `offreExpireeMsg`). L'expiration réelle de Vinted n'a jamais été mesurée : 7 j est un plafond.
- **Import de ton passé** : plus aucune carte ni bouton (panneau, Ma journée / « Tout va bien ? », Réglages → une ligne).
  `HistoriqueSites` (Leboncoin, Vestiaire, eBay) garde ses « Tout récupérer » : autre sujet, à trancher par Julien.
- **Agent autonome** : interrupteur « Envoyer automatiquement aux nouveaux favoris » sur la page Favoris (message, offre %,
  plancher ; SON « Allumer » = l'autorisation) ; ligne en direct « Agent favoris : actif · N envoyés aujourd'hui · prochain
  dans 42 s », « Pause » / « Reprendre » (local, par compte), « Arrêter » (éteint chez VRM), journal (heure, personne, article,
  offre, message). Le pilote (`piloteFavorisTick`) suit l'heure donnée par le serveur ; l'écart PROTÉGÉ entre envois
  automatiques reste 3–12 min (`AUTO_ECART_MS`, CLAUDE.md §3 : défaut jamais changé sans sa demande — un premier passage à
  20–60 s a été REMIS à 3–12 min, mutation « ecart-20-60 » dans `audit-favoris-agent`) ; une attente de l'extension n'est plus
  comptée « sautée ». Ses réglages (attente 10–60 min après le favori, plage, 15/h, jour) sont inchangés.
- **Reprise sans cul-de-sac** (Julien : « si l'agent ne parvient pas, il doit trouver le chemin ») — chemin des requêtes :
  page pas prête ⇒ l'onglet de travail ramené UNE fois sur vinted.fr (chargement attendu, jamais un délai fixe) puis l'étape
  refaite ; offre en 404 ⇒ le message d'abord, puis l'offre depuis la conversation relue ; pas de transaction ⇒ celle de la
  conversation (même article, sinon rien) ; envoi à moitié fait (offre partie, message pas) ⇒ conversation relue, jamais une
  2ᵉ offre, son message déjà là ⇒ « fait » ; la route qui a marché est retenue par étape (`vrmFavorisRoutes`) et prise
  directement la fois suivante. Chemin par l'interface : sélecteur → repérage (`vrm-trouver.js`) → geste appris
  (`vrm-appris.js`), déjà en place. Prouvé par `audit-favoris-reprise` (R1–R6, 7 mutations).
  Pas fait : un favori que VINTED refuse (offre refusée, texte refusé) n'est PAS relancé seul (il redemanderait la même chose
  à Vinted) : sa phrase est sur sa rangée ; les attentes (pause, onglet, compte, session) reprennent seules (3 fois). Captcha = arrêt jusqu'à « Reprendre »
  (§3, non réglable) ; 403/429 = pause posée, reprise seule.

## Temps (mesurés, `audit-favoris-envoi-direct` E1)
Avant : « Envoyer » → 4 étapes (3 touchers « Suivant » + « Lancer ») ; 1er message : attentes voulues 24–28 s (fil 1–1,6 s,
transaction 3,5–5,6 s, offre 0,5–0,7 s, offre→message 8–20 s [sa décision du 12 nov.], écriture 2–6 s). Après : 1 toucher
« Envoyer » + « Lancer » ; les mêmes attentes (aucune pause protégée raccourcie) ; 2ᵉ message 20–60 s après (mesuré 22 s, 55 s).
Les blocages qui faisaient « attendre sans fin » (incertain, file active, tentative abandonnée) ne retiennent plus rien.

## Preuves
`audit-favoris-envoi-direct` (vrai serveur + vrai fond + vrai panneau, E1–E6 ; arbre d'avant : 8 rouges ; 7 mutations
rouges) · `audit-favoris-agent` (A1–A5, 5 mutations rouges) · `audit-favoris-reprise` (R1–R6, 7 mutations) · banc `favoris-envoi-direct` (390/1512, clair/sombre, captures
regardées) · audits et bancs remis à la nouvelle règle : `audit-ext-cloche-favoris` K3/K9, `audit-favoris-clair`,
`audit-favoris-trancher` T1, `audit-favoris-liste` B1, `audit-favoris-discretion` D6, `audit-offres-sans-reponse` (heure du
banc), `audit-favoris-auto` (écart), bancs `panneau-favoris-tableau`, `favoris-envoi`, `import-depart`.
Rouges d'AVANT cette branche (aussi rouges sur 8908343b7) : bancs `extension-favoris-liste`, `import-passe`, `badge`.

## Gestes de Julien
Installer l'extension 5.455.8 (remplacer le dossier, ⟳). S'il veut l'agent : Favoris → l'interrupteur → « Allumer ».

## Revue indépendante (28 nov. soir) — 7 défauts confirmés, corrigés
Contrôle permanent : `scripts/audit-favoris-revue.cjs` (V1–V7 ; sur l'arbre d'avant 9c85efda3 : 16 rouges / 17 ; 12 mutations).
Scripts du relecteur : `scripts/_revue/` (s1–s5).
1. **Mauvaise transaction** : la transaction de la CONVERSATION n'est prise que si sa relecture dit CET article ET CETTE personne
   (`achTx`, `txDeConv`) ; sinon écartée — offre demandée ⇒ rien de plus.
2. **« Message d'abord » RETIRÉ** : toujours l'offre puis le message (Vintex). Offre refusée ou 404 ⇒ aucun message, la phrase de
   Vinted sur la rangée, rien au registre (l'offre peut être refaite). Routes retenues par compte, 7 jours ; aucune ne change
   plus l'ordre (la route « offre après message » n'existe plus).
3. **Reprise d'un envoi à moitié fait** : l'acheteur a répondu ⇒ `acheteur_a_repondu`, rien n'est écrit ; l'auteur d'un message
   reconnu par user_id / sender_id / author_id (message ou `entity`, objets user/sender/author) ; le message repris dit le prix
   de l'offre RÉELLEMENT faite (`faits[n].px`).
4. **Agent « occupé » pour toujours** : `expirerBail` est appelé à chaque tour de l'agent (route `auto`) et à chaque `suivant` ;
   une tentative abandonnée retient le compte `GRACE_ABANDON_MS` (4 min après son dernier signe de vie), puis plus rien.
5. **Un 2ᵉ lancement n'annule jamais une file en cours** : il s'y ajoute ; seul le reste d'une file ARRÊTÉE est remplacé (`remplace`).
6. **409 « réglages ont changé »** : plus aucune relance automatique ; le nouveau récapitulatif est rendu au panneau (`reglages_changes`),
   « Lancer » à nouveau. Les réglages envoyés restent ceux qu'il a vus (plus de remplacement silencieux à la relecture).
7. **Import du passé** : `titreImport` et les composants morts retirés ; E6 élargi à tout `src/` et à l'extension. « Tout récupérer »
   des AUTRES sites (`HistoriqueSites.jsx`) laissé, en attente de Julien.
Risques traités : pause de l'agent chez VRM par compte (`auto_pause`, `pauseAgent`) ; `rechargerPageFavori` ne touche que l'onglet
de travail de VRM ; grâce d'une tentative abandonnée (aucune 2ᵉ écriture simultanée) ; offre sans date expirée par la date de sa
conversation (`updated_at`).
