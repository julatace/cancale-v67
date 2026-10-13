# Reprise Codex — 12 octobre 2026

Base de travail : `origin/main`, commit `eaa8a0b`.
Branche locale : `claude/codex-preparation-publication`.

## Premier lot : rendre les vérifications reproductibles

- 85 scripts de navigateur utilisaient le chemin du Chromium Linux de la
  machine Claude ; plusieurs chargeaient Playwright depuis `/home/user`.
  Ils utilisent désormais le Playwright du dépôt et `scripts/_chromium.cjs`.
  Le Chromium du conteneur reste prioritaire s'il existe. Sinon, le navigateur
  installé par Playwright est utilisé. `BANC_CHROMIUM` permet un choix explicite.
- La procédure du README des bancs lance une copie complète du dépôt.
- `audit-planchers-code` déclarait à tort que la 5.175 ne savait pas lier
  une session. Sa regex de retrait des commentaires traversait le code réel.
  L'analyse Babel retrouve `demanderLiaison` et `code: CODE_VERSION` sans
  supprimer des chaînes ou des motifs. Les frontières de l'extension restent
  celles de production : aucun comportement de session n'a été modifié.
- Vite passe de 5.4 à 6.4.4 ; plugin React 4.7. Les dépendances transitives
  sont mises à jour dans le verrou. `npm audit` : 7 vulnérabilités avant,
  0 après. Le build Vite 6 passe.

## Vérifications

- Avant correction : compilation verte ; 83/92 audits verts, 9 rouges.
- Après correction des chemins et de l'analyse : 92/92 audits verts.
- Syntaxe de 87 scripts vérifiée par `node --check`.
- Choix Chromium local, choix explicite et refus d'un chemin inexistant : verts.
- Banc premierjour sur le build d'origine : 67 verts, 0 rouge.
- Nouveau build Vite 6 : vert ; banc démarrage : vert.
- Dernier passage complet après mise à jour des dépendances : 92/92 audits
  verts ; banc accueil : 171 verts, 0 rouge (téléphone, tablette, ordinateur
  et film).
- `audit-agent-sql` et `audit-renum-b` : NON exécutés, PostgreSQL absent.
- Bancs utilisant les fixtures réelles `fx/` : NON exécutés, fixtures absentes.

## État du travail précédent

Les journaux des Agents 1 et 2 remplacent les anciennes listes du README pour
ce qui a été intégré depuis : 5.175, accueil, prix d'achat au numérotage, fiche
à l'arrivée, classement des comptes, remise native, dictée, codes hors ligne,
traduction. Ne pas reprendre aveuglément les anciens bundles.

Restent notamment à intégrer/valider : la règle d'offre eBay sur
`origin/claude/wip-d-regle-offre` (tête `0255714`), l'application de la migration
014 (le fichier est intégré, l'application est différée selon le journal),
l'agent eBay, le push de double vente app fermée, les sessions/mode équipe,
le studio photo et la passe de vitesse. La revue complète avec les données
réelles reste à faire. Les informations de l'éditeur sont encore vides dans
`public/legal/editeur.js` ; ne rien inventer.

## Blocage de publication

- Git HTTPS : aucune authentification disponible pour pousser.
- Connecteur GitHub : création de branche refusée, HTTP 403,
  `Resource not accessible by integration`.
- Aucun changement de ce lot n'est envoyé sur GitHub ou déployé.
- Les corrections sont conservées localement et exportées en patch.

## Reconnexion GitHub

Après reconnexion par Julien le 12 octobre : le connecteur confirme l'accès
`push` au dépôt. La branche distante `claude/codex-preparation-publication`
est créée. Le lot est envoyé par le connecteur (Git HTTPS reste sans session).
Une PR de revue est préparée ; aucune mise en production de ce lot.

## 12 octobre — reprise eBay et mémoire SQL

La migration 014 a été essayée en transaction annulée puis appliquée au projet
Supabase existant. Le contrôle après application ne trouve aucun écart : 16
 tables de l'agent, RLS forcée, fonctions et déclencheurs attendus. L'installation
`agent_ebay` reste à `0` : aucun agent ni horloge activés. Sur PostgreSQL jetable,
`audit-agent-sql` passe 221 contrôles et `audit-renum-b` 126.

Fusion véritable de `claude/wip-d-regle-offre` (0255714) avec le lot Codex et
main : comptes multiples et règles natives eBay conservés, ainsi que les
preuves par bordereau et la numérotation après migration 013. Le retrait relit
le marqueur du vendeur dans le contexte du compte choisi. Les comparaisons de
SKU traduisent aussi les anciennes annonces avant de comparer les numéros.

Les bancs fusionnés utilisent les preuves projetées actuelles, sans doublon de
ligne orders_sold. Le contrôle du corps de retrait simule désormais le contexte
multi-compte et un statut HTTP, comme la route. Le texte du retrait automatique
réutilise les conditions de sa confirmation.

Vérifications : 93 audits hors SQL passent (le dernier lecteur de numérotation
100/0) ; ses 42 mutations sont détectées ; règle d'offre rendue 376/0 ; comptes
multiples, API, écritures, callback, suppression et formulaire passent. La passe
complète des annonces et de la programmation se termine avant validation K0.
Aucun appel réel eBay/Vinted, aucune annonce créée ou retirée par ces essais.

Julien reporte les informations légales à la fin. Ne pas inventer d'identité
ni considérer le site prêt à ouvrir : K1/K2 et la suite restent à construire.

### Validation de la fusion K0 et première partie K2

Le banc `ebay-annonces` est maintenant entièrement vert sur le build corrigé ;
celui de programmation est vert aussi. La fusion est conservée sur GitHub dans
la PR brouillon #488 (base : lot de préparation #487).

K2 commencé : état de la paire exigé avant publication et vérification ; CDATA
échappée sans perdre la description ; commandes paginées par date de modification,
fusionnées avec l'historique et mises à jour par version de la ligne. Une page
manquante ou une lecture de base ratée n'écrase rien. Une projection explicite
retire les adresses et emails acheteurs, y compris des anciennes captures, au
premier passage réussi ; aucune migration de données aveugle. Le prochain lien
de pagination est limité à la route officielle des commandes, sans identifiants
URL. La capture n'est annoncée rangée que si l'écriture gardée a réussi.

Preuves : audit de route 423 contrôles ; audit commandes (vraies fonctions,
services simulés) couvre conservation, remboursements actualisés, fuite d'adresse,
page en panne, pagination hostile, boucle et plafond. K2 n'est pas terminé :
connexion à trois états, notifications de suppression signées et métadonnées
transport restent à construire.

### 13 octobre — connexion mesurée et suppression signée (K2)

`status` renouvelle désormais le jeton de chaque compte pour mesurer sa connexion :
`ok`, `refuse` (invalid_grant), `pas-su` (panne), au lieu d'affirmer « relié »
sur sa seule présence. Le navigateur conserve le troisième état, attend la lecture,
compte seulement les comptes réellement reliés et dit le refus. Les droits rendus
par OAuth et l'expiration exacte sont rangés à la prochaine connexion ; absence
de scope retourné = inconnue. Les jetons d'application privés ne vont jamais dans
la réponse du diagnostic public.

La route publique de suppression passe par `compte.js` (corps brut), sans nouvelle
fonction Vercel. L'ancienne porte délègue au même contrôle. Signature ECDSA/SHA1
vérifiée sur le brut puis sur le JSON re-sérialisé comme le SDK eBay ; cache public
mémoire/base, dix nouveaux kid par heure et par instance, clé de repli optionnelle
`EBAY_NOTIF_PUBLIC_KEY_KID` / `EBAY_NOTIF_PUBLIC_KEY_PEM`. Signature fausse = 412 et
aucun effacement ; clé inaccessible = 500 ; signature valide = 204 même si la base
est en panne. Une panne d'anonymisation est signalée dans les logs sans identité.
K4 doit compléter le quota global entre instances et la purge du coffre lors
de cette suppression.

L'identité EIAS signée sélectionne le seul compte vendeur à déconnecter. Les
commandes contenant le pseudo acheteur signé sont anonymisées au nom de chaque
propriétaire ; autres comptes et autres acheteurs restent intacts. Une lecture
ratée ne remplace rien. La fermeture VRM appelle désormais la fonction SQL 014
d'effacement de l'agent avant les autres suppressions ; si elle échoue, compte
et données sont conservés pour relancer.

Preuves : route eBay 425 contrôles ; banc comptes multiples avec refus/panne sur
mobile vert ; banc suppression signé vert (vecteur réel du SDK, faux corps,
panne base) ; audit signature (50 kid forgés ⇒ 10 lectures max) ; audit suppression
à deux vendeurs ; fermeture 27/0 ; abonnement 91/0 ; variables et fonctions API
verts. Le build passe. Aucun appel réel vendeur ni déploiement de ce lot.

Sources de contrat :
- https://github.com/eBay/event-notification-nodejs-sdk/blob/main/lib/validator.js
- https://github.com/eBay/event-notification-nodejs-sdk/blob/main/test/test.json
- https://developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion

La suite K2 (politique d'étiquette 1455, Metadata transport, délais et bilan de
synchro visible) et K1 (gel de publication par compte sans preuve) restent en cours.

### 13 octobre — transport et bilan de synchronisation K2

La politique d'étiquette se lit par GetOrders dédié à 1455, sur l'identifiant de
commande exact. Autres appels Trading : 1149. Champ absent dans une commande
retrouvée = `aucune` ; refus, autre commande ou politique inconnue = `null` ;
`EBAY_ONLY` reste contraignant. Aucun bordereau n'est acheté. Les faits rangés
sont pays, noms des champs d'adresse, présence de retrait/programme et service,
jamais les valeurs d'adresse. Lecture bornée des commandes payées encore sans
politique ; les captures précédentes restent à lire aux synchronisations suivantes.

Metadata transport FR : schéma officiel Sell Metadata 1.12.1, lecture mensuelle
par jeton d'application, cache `vrm_reglages.ebay_transport_fr`. Lecture incomplète
n'écrase pas la table. Sources documentées avant implémentation, sans requête
vendeur réelle. v2 défini pour le futur consentement Agent (droit Notification),
v1 reste demandé aujourd'hui.

Délais : eBay 10 s, base eBay 5 s ; budget de synchro 45 s, réserve pour ranger.
maxDuration 60 pour les portes eBay, compte et rappels, sans nouvelle fonction.
Une page de commandes manquante ne remplace pas la capture. Les listes eBay
incomplètes conservent les annonces/programmées précédentes ; rangement par
version et heure de départ pour ne pas écraser une capture plus récente.

Le bilan sous Compte eBay exploite les retours `lu` au lieu de les jeter : chaque
compte et les sources non lues sont dits. Vue sans compte vérifié ⇒ rien n'est
relu sur un autre compte. Les flags sont vrais seulement après rangement réussi.

Le formulaire ne choisit plus Occasion silencieusement. État à choisir pour
chaque nouvelle paire, remise à blanc si la catégorie l'interdit, état gardé
seulement pour un brouillon où il était déjà saisi. Vérifier/publier bloqués avant
le choix ; le serveur l'exige aussi. Les descriptions contenant `]]>` sont
préservées dans un XML valide.

Preuves : route 428 contrôles, dont GetOrders seul à 1455 et eBay qui ne répond
jamais (requête interrompue, capture conservée) ; audit transport (trois états,
identité, minimisation, cache mensuel, panne) ; banc formulaire (choix explicite),
banc comptes (sync partielle, refus et panne) verts. Le build passe. La passe
complète hors SQL est relancée après ces changements.

Sources :
- https://developer.ebay.com/DevZone/XML/Docs/Reference/eBay/types/ShippingDetailsType.html
- https://developer.ebay.com/api-docs/master/sell/metadata/openapi/3/sell_metadata_v1_oas3.json
- https://developer.ebay.com/api-docs/commerce/notification/static/release-notes.html

K1 et la suite Agent restent à implémenter ; ne pas allumer `agent_ebay`.

### Relais des corrections de l'agent 1 — 13 octobre

Julien a transmis `fb75393` puis `a2e4d7f`. Cherry-picks appliqués dans cet ordre,
sans conflit (copies locales a19eeb9 / ae8a851). La moitié app du changement de
prix ne crée plus un risque de règle lorsqu'aucune règle n'existait ; les messages
normaux de programmation et l'action déjà portée par un lien ne sont plus répétés.
Deux contrôles de la vraie fonction app couvrent désormais règle absente/règle
existante avec relecture ratée. Build vert, audit route 430/0, offres auto 16/0,
banc règle d'offre blocs 8+18 à 390 et 1512 px : 24/0.

### 13 octobre — reprise Cloud, gel persistant K1 (premier lot)

Reprise réelle de `claude/codex-ebay` / PR #488 à `498b7f9`, avec les transferts
et `f97f27b` déjà intégrés. Copie Cloud isolée de l'ancien worktree local qui
portait encore des modifications non commitées ; celles-ci n'ont pas été touchées.

`src/vintedPublication.js` porte la règle et la mémoire K1, séparées des règles
autorisant un retrait automatique. Ancre unique `vrm_vinted_publication_activation`
créée sans écrasement puis relue : la fenêtre activation moins 30 jours ne glisse
pas. Les lignes `vrm_vinted_publication_<uid>` conservent les ventes non identifiées
par compte, même à J+100 ou après disparition de la vente de la capture. Seule
une identité, un lien déclaré ou un état explicite de retour/remboursement les
résout. Anciennes ventes : registre distinct, sans gel. Identités contradictoires :
gel, aucune source choisie au hasard. Conversation seule sans vente : rien.

Une lecture ratée/absente/mal formée, une capture plus ancienne ou une écriture
conditionnelle refusée restent `pas su`. La mémoire précédente est conservée.
La création ou modification concurrente est relue une fois, sans boucle ni
écrasement aveugle. La session vendeur est vérifiée avant/après chaque opération.
Le plafond d'un lecteur paginé strict rend maintenant `null`, pas une liste
potentiellement tronquée.

Formulaire et planificateur partagent la garde par compte d'origine et relisent
avant chaque envoi, après la confirmation. Une relecture vieille de 30 min exige
une confirmation du risque. Numéro ambigu ou compte d'origine inconnu : bloqué.
Une identité sans état bloque la paire, sans autoriser de retrait automatique.
Le lien manuel choisit une fiche précise (ID), vérifie son numéro externe unique
sur le bon compte dans le nuage, puis le revérifie après confirmation. Lien
immuable par `(uid, tx)`, rangé dans `vrm_ventes_reliees_<uid>_<tx>` ; miroir
`vrm_ventes_reliees` dans SYNC_KEYS, rattrapé par le chargement Cloud habituel.
Le miroir n'est jamais la vérité utilisée pour dégeler : un appareil ancien ne
peut pas perdre les liens en remplaçant `main`. L'identité conserve l'ID de paire
après une renumérotation, jamais le titre ou un ancien numéro réutilisé.

Après 72 h, Ma journée montre le lien vers eBay → Annonces et compte ce travail
dans son en-tête. Une panne de lecture conserve la liste précédente.

Validation : build Vite 6.4.4 vert ; 97 audits hors SQL verts (corpus/mocks,
fetch réseau désactivé ; Chromium temporaire via BANC_CHROMIUM). Audit eBay
430/0, preuve de vente 92/0, variables et retrait automatique verts.
`audit-vinted-publication.mjs` : 17 scénarios, 8 mutations détectées.
`ebay-gel-publication.cjs` : 28 contrôles rendus à 390/1512 px (gel, compte non
gelé actif, planification bloquée, ancre conservée après navigation/rechargement,
lien posé qui lève le gel et bloque la paire vendue, Ma journée, panne, 0 appel
engageant). Captures inspectées. Le même banc échoue sur le build de `498b7f9`
sur le gel absent. Le banc annonces existant reste vert. Pas de nouvelle passe
SQL : aucune migration SQL dans ce lot, résultats SQL précédents conservés.

K1 n'est pas annoncé entièrement fini : restent les alertes élargies aux liens
manuels/lots et les détails de fraîcheur sur chaque carte. La nouvelle famille
de retrait et `vue_le` sont K8 ; aucune preuve ni règle du retrait automatique
actuel n'a été élargie. K4/K5, Studio et sessions/équipe restent en chantier.
Aucun appel réel eBay/Vinted, aucune donnée de test en production, aucun achat
d'étiquette, aucune activation du moteur, aucun merge vers main ni déploiement.
K14 reste gelé. Les informations légales restent reportées par Julien.
