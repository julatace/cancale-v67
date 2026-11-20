# 20 novembre 2026 — Leboncoin : les intéressés ; Vestiaire : une solution (branche `claude/lbc-vc-interesses`, extension 5.410.0 partagée)

Julien (20 nov.) : « regarde tout ce que tu peux faire, parce qu'on reçoit quand une personne est intéressée sur
Leboncoin ; pour Vestiaire trouve une solution » (limites dites avant : Leboncoin ne dit pas qui a mis en favori ;
Vestiaire sans date de mise en ligne ⇒ ni baisse auto ni moteur d'offres).

## ÉTAT À LA REPRISE
- Branche poussée `claude/lbc-vc-interesses` (depuis `origin/main` dd3336382). Aucune PR, aucune fusion.
- Extension : blocs **5.410.0** seulement ; manifeste, `CODE_VERSION`, zips **pas** touchés (lot partagé, le
  manifeste monte avec `claude/panneau-vintex`). ⇒ `audit-coherence` a 4 rouges attendus « seuil 5.410.0
  atteignable — manifeste 5.409.0 » qui tombent quand le manifeste passe à 5.410.0.
- Capacités (`EXT_CAPACITES`, `audit-coherence` FONCTIONS) : `vcdatemise` (`dateMiseVcFiche`), `baissevc`
  (`regleBaisseVcTick`), `lbcinteresses` (`interessesLbcPanneau`), `lbcecrireinteresses` (`ecrireInteressesLbc`).
- **Le panneau** : les gestes sont exposés au fond comme actions du panneau (`from: 'vrm-badge'`) :
  `interessesLbc` (lecture : liste, par annonce, déjà écrits, série en cours, `appris`, `parToucher`, `ecartS`) et
  `ecrireInteressesLbc` (`{ annonce, convs, textes, confirme: true }`). L'**interface** du panneau (liste à cocher,
  récapitulatif « Écrire à N personnes » ⇒ « Confirmer ») est à dessiner dans `vrm-badge.js` par le lot
  `claude/panneau-vintex` (fichier en refonte là-bas : pas touché ici pour ne pas croiser).

## Mesuré (lecture seule, sa base, 20 nov. — aucune valeur réelle ici)
- **E-mails Leboncoin** : 7 en tout, tous du 21 oct. (« suppression de vos annonces » ×2, « nouvel appareil » ×1,
  « boostez vos annonces » ×2, « N annonces ont besoin de vous » ×2), classés `inconnu`. **Aucun** « X est
  intéressé », « nouveau message » ou « ajouté à ses favoris » — ni chez lui ni chez aucun autre vendeur de la base.
  `email_texte` : 0 texte qui parle de Leboncoin, de Vestiaire, d'« intéressé » ou d'« a aimé ». ⇒ la notification
  « une personne est intéressée » qu'il reçoit n'arrive pas dans VRM (push de l'app Leboncoin, ou e-mail non
  transféré) : rien à brancher côté e-mail tant qu'on n'en a pas vu un.
- **Lignes Leboncoin** : `lbc_listings` 194 annonces (19 nov.), **0** avec `stats` (le nombre de favoris n'a jamais
  été relevé chez lui : il faut ouvrir « Statistiques » d'une annonce) ; **0** ligne `lbc_fil_*` ; `lbc_messages`
  (compteur) relu le 19 nov. ; `lbc_envoi` absent (recette d'envoi jamais apprise).
- **`lbc_recon`** (80 formes) : `…/hal/{moi}/conversations/{conv}/messages` vu le 22 oct. avec
  `conversationContext.{conversationId, itemId, itemType, partnerId, partnerName, partnerProfilePictureUrl,
  lastMessage…}` et `_embedded.messages[].{text, outgoing, date, sentAt, read…}` ⇒ **la personne qui écrit est
  identifiée, et la conversation dit l'annonce**. La LISTE des conversations n'a jamais été vue.
  `contacted-classified-api/v1/replied` = ses conversations d'ACHETEUR ; `myfavorites` = ses favoris d'acheteur ;
  `followme` = ses abonnés. Rien ne dit qui a mis une annonce en favori.
- **Vestiaire** : `vc_listings` 3 articles (lecture du 2 nov., 18 jours), statut `published`, `favoris` **null**,
  aucun `compte`, aucun lien de N°. La forme mesurée de « Mes articles » porte **`listingDate`** (relevé dans les
  réponses gardées : 3 dates ISO avec fuseau, 29–30 oct.) et `negotiationsSummary.{totalNegotiationsCount,
  ongoingNegotiationsCount, pendingSellerActionCount}`. **0** `vc_offres`, **0** `vc_aimes`, **0**
  `vc_prix_recette`, **0** `vc_offres_recette` : aucune offre reçue lue, aucun geste appris.

## 1. Leboncoin — les intéressés (identifiés), et « Leur écrire » (panneau)
- `lbc-inject.js` `noteFilLbc` : lit `conversationContext.itemId` (6–12 chiffres, même conversation) ⇒ `annonce`
  du fil ; jamais `partnerId`/`partnerName`/photo. Relais `lbc-relay.js` le passe.
- `rangerLbcFil` : `annonce` (un fil ne change jamais d'annonce), `deLuiN` (messages de la personne),
  `premierDeLuiAt`. Scalaires ⇒ dans `meta` (migration 004).
- Règle `<interesses-lbc-regle>` (la MÊME dans `background.js` et `src/interessesLbc.js`) : intéressé = une
  conversation de CE compte, sur CETTE annonce, où la personne a écrit au moins une fois. Jamais un « favori ».
- `ecrireInteressesLbc` : depuis le panneau sur leboncoin.fr seulement, `confirme: true` exigé ; chaque conversation
  choisie doit être un intéressé de cette annonce sur le compte de l'onglet, sinon **rien ne part** (`pas-interesse`) ;
  recette d'envoi apprise de SON geste (`lbcrepondre`, 5.318) ; une fois par personne et par annonce
  (`vrmLbcInteressesFaits`, posé avant l'envoi) ; 10 par toucher ; puis une à la fois (`deroulerInteressesLbc`) :
  Tout arrêter, anti-robot, pause 429/403, onglet du compte, porte des favoris (`porteDiscretion('lbc:{id}',
  'favori')` — la porte accepte désormais `lbc:{id}`, verrou et série site par site), sécurité du compte en série,
  45/h ; **40–90 s au hasard** jamais deux fois de suite (`tirerSansRepeter`) ; 1 à 5 variantes, jamais deux fois de
  suite le même texte (`texteJamaisRepete`) ; un refus arrête tout ; file reprise par un worker neuf
  (`reprendreInteressesLbc`, réveil `vrm-offres`, 10 min trop tard ⇒ rien).
- `repondreLeboncoin(msg, { serie })` : en série, sécurité `favori/serie` et réserve de 5 gestes (45/h) ; au clic,
  inchangé.
- App : Messages → Leboncoin → Favoris reçus : la phrase (qui t'a écrit ; Leboncoin ne dit pas qui a mis en favori ;
  leur écrire depuis le panneau), « N intéressés · N attendent ta réponse » sur chaque annonce, les conversations
  dont l'annonce n'est pas lue comptées à part. Aucun bouton d'envoi.
- Le nombre de favoris : déjà affiché par annonce quand il est relevé (`lbcstats`) ; « Baisser le prix » existe
  (recette apprise) et la baisse par règle Leboncoin aussi (`baisselbc`). **Pas fait** : « quand ça monte sans
  vente » dans le panneau — il faudrait l'HISTORIQUE des relevés (chaque relevé remplace `stats`, choix du 1er nov.)
  et aucun relevé n'existe chez lui (0/194).

## 2. Vestiaire — la date, la baisse par règle
- `vc-inject.js` `dateMiseVc` (`listingDate` seulement, valide, ni avant 2009 ni dans le futur) et `negosVc` (trois
  nombres, jamais qui) ; relais `vc.js` ; fond `dateMiseVcFiche` : `misEnLigne` (EXACTE) et `vueDepuis` (1re
  lecture, jamais avancée — BORNE BASSE).
- App `src/dateMiseVc.js` : exacte ⇒ « en ligne depuis le … » ; borne ⇒ **toujours** « vue en ligne depuis au moins
  le … » (Vestiaire · Annonces, `data-vc-depuis`).
- `regleBaisseVcTick` (réveil `vrm-relais`) : règle `vinted_baisse_regle.comptes['vc:{compte}']`, éteinte par
  défaut ; compte de l'annonce (jamais prêté) ; « depuis » = date exacte sinon borne basse (jamais plus tôt qu'avec
  la vraie date) ; plancher = le PLUS HAUT des planchers sus (faits de l'annonce `vrm_articles_sites['Vestiaire:id']`,
  fiche du N° : `vrm_vc_liens` → `vc_listings.liens` → « VRM-n° » → `vrm_vc_numeros`), N° à deux fiches ⇒ rien,
  aucun plancher ⇒ rien ; recette de prix pas apprise ⇒ rien déposé ; 12/jour ; une commande `cmd_prix_*` (site
  vestiaire, `depuisExacte`) exécutée par `prixAttenteTick` → `baisserPrixVestiaire` (prix lu = aperçu, compte de
  l'onglet, 45/h, prix RELU).
- App Automatisations → Baisse par règle : les comptes Vestiaire (`vc:{id}`) s'ajoutent quand l'extension sait
  `baissevc`, avec la phrase sur la date et le geste à apprendre.

## 3. Vestiaire — offres reçues et négociation par paliers : PAS branchée (ce qui manque, précisément)
- Aucune offre reçue n'a jamais été lue chez lui (`vc_offres` absent) et aucune réponse n'a été apprise
  (`vc_offres_recette` absent). Le chemin existe (5.319 : `rangerVcOffres`, `repondreOffreVestiaire`, contre-offre
  « si apprise ») mais n'a jamais servi sur sa base : brancher un moteur automatique sur une forme jamais vue
  serait jouer à l'aveugle.
- Il faut, dans ce Chrome : ouvrir « Mes offres » sur Vestiaire (l'extension lit les offres), puis faire UNE
  contre-offre à la main (la recette s'apprend). Ensuite `palierContreOffre` (src/negociationPaliers.js) peut être
  branché sur `vc_offres` exactement comme sur Vinted. Ce qui est lu dès la 5.410 : `negos.aToi` (combien attendent
  sa réponse, par article).

## 4. Messages aux « aimés » Vestiaire (5.393)
- Vérifié : `audit-favoris-sites` vert (vrai vc-inject + vc.js + fond). Sur SA base : **jamais servi** (0 `vc_aimes`,
  0 recette) — le geste d'apprentissage n'a pas été fait.
- Aligné : l'écart entre deux personnes passe de 8–20 s à **40–90 s** (le rythme des favoris du 19 nov.,
  `VC_AIMES_ECART_S`) ; le récapitulatif existait déjà (« Envoyer l'offre de X € à N personnes »).

## Preuves
- `scripts/audit-lbc-vc-interesses.cjs` : VRAI vc-inject.js + vc.js + background.js (`_fond-vm.cjs`), règle de
  l'app importée — **49 contrôles verts** ; sur `origin/main` : **13 rouges sur 16** (fonctions absentes) ;
  `--prouve` : 28 mutations (date ignorée/future, borne avancée, borne prise pour exacte, personne dans les
  négociations, sous le plancher, plancher le plus bas, sans recette, compte prêté, N° deviné, « depuis » truqué,
  « au moins » dit exact, partenaire sorti, annonce ignorée, intéressé sans écrire, autre compte, hors liste envoyé,
  sans confirmation, deux fois, délai fixe, sans attente, texte répété, plafond, 10 par toucher, refus qui continue,
  porte ignorée, règle de l'app différente, l'app qui envoie).
- Audits verts : `audit-favoris-sites` (mis à 40–90 s), `audit-regles-auto`, `audit-vc-prix`, `audit-lbc-repondre`,
  `audit-capture-vc-lbc`, `audit-relais-lbc-kinds`, `audit-actions-gardees`, `audit-traduction`, `audit-tdz`,
  `audit-variables`, `audit-quoi-de-neuf`. `audit-coherence` : 4 rouges « manifeste 5.409.0 » (voir plus haut).
- Banc `scripts/bancs/lbc-vc-interesses.cjs` (390 clair, 1512 sombre) — résultat dans le rapport du lot.

## Ce qui reste impossible, et pourquoi
- Écrire à quelqu'un qui a mis une annonce **Leboncoin** en favori : Leboncoin ne dit jamais qui (mesuré) ; VRM
  n'écrit qu'aux personnes qui ont écrit.
- Brancher l'e-mail « X est intéressé » : aucun n'arrive dans VRM (mesuré). Si Julien en reçoit par e-mail, transférer
  UN tel e-mail à l'adresse VRM permettra d'en relever la forme.
- Négociation par paliers Vestiaire : voir §3 (aucune offre lue, aucune réponse apprise).

## Gestes de Julien
1. Installer la **5.410.0** quand elle sort (lot partagé).
2. Leboncoin, dans ce Chrome : ouvrir une conversation, puis répondre UNE fois à la main (la recette d'envoi
   s'apprend, et le fil porte son annonce).
3. Vestiaire, dans ce Chrome : ouvrir « Mes articles » (les dates arrivent), changer UNE fois un prix à la main
   (la baisse sait partir), puis allumer la règle dans Automatisations s'il la veut.
