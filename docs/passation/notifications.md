# Les notifications de VRM — inventaire (3 novembre 2026)

Demande de Julien (3 nov., 13 h 02) : « améliore aussi les notifs ; il y en a qui servent
absolument à rien et qui ne sont vraiment pas cohérentes ; par exemple elles disent
"arrivé au point relais" alors que le message disait qu'il VA arriver ».

Règle depuis le 3 nov. : **une notification dit un fait CONSTATÉ, au bon temps, une seule
fois par objet (identité : n° de suivi, code de retrait, transaction, conversation), en
texte court, et ouvre l'écran de l'objet.** Familles et textes : `api/_lib/notif-textes.js`.
Arrivée constatée : `api/_lib/etat-colis-email.js` (`arriveeDansPhrase`, `arriveeConstatee`).
Preuve : `scripts/audit-notifications.cjs` (route exécutée, e-mails fabriqués des formes mesurées).

## 1. Ce qui a été mesuré (base réelle, lecture seule, 20 oct. → 3 nov.)

Les notifications ne sont pas journalisées ; leur trace est la clé posée dans `push_dedup`
(300 dernières, écrite seulement quand la catégorie est active, juste avant l'envoi) et le
journal des e-mails (`email_journal`, 200 derniers, sujet + état rangé).

| e-mail réel (sujet) | rangé | clé envoyée | notification partie | verdict |
|---|---|---|---|---|
| « Où vous livrer en cas de point indisponible ? » (Mondial Relay, 2 nov. 22:21) | **à retirer** | `relais-79566801-sans` | « 📍 Colis arrivé au point de retrait » | **FAUX** — « disponible » lu dans « indisponible » ; le colis roulait |
| « Confirmation de commande Mondial Relay » (31 oct. 17:51) | **à retirer**, lieu « vous recevrez un e-mail » | `relais-20423324-sans` | « 📍 Colis arrivé … à retirer chez vous recevrez un e-mail » | **FAUX** — « dès que votre colis sera disponible » (futur + condition) |
| « Action requise : le colis semble avoir été perdu — Nike air Max 1 » (2 nov. 23:01 ; idem 11 oct.) | **livré / retiré** | `retire-email_track_autre_op6i9s` | « ✅ Colis livré » | **FAUX** — un colis perdu n'est pas livré |
| « Ton colis arrive aujourd'hui ! #… » (×2 le 3 nov., 12 en tout) | en transit | `track-…` | « 🚚 Colis en transit » | inutile (aucun geste) — et « arrive » lu « arrivé » |
| « Votre colis est en route ! » (corps « sera livré au point relais ») | livré (1) | — | — | FAUX rangement (« livré au point » lu au futur) |
| Étape Vinted « Ton colis vient d'arriver au centre de tri » (8 des 20 étapes) | — | `vs-track-…` | « 📦 <titre> — Vinted : « Ton colis vient d'arriver au centre de tri » » | se lit « arrivé » ; aucun geste |
| « Ton reçu pour la commande … » | achat | `achat-tx…` (**~60 en 8 jours**) | « 🛍 Achat confirmé » | inutile : il vient de l'acheter |
| « Ton article … a été marqué comme favori » | favori | `fav-…` (6 en 15 s le 2 nov. 21:55) | « ❤️ Nouveau favori ! » | bruit |
| « Votre colis … est disponible 📦 » ×8 (3 nov. 09:48-09:56) + « Commande mise à jour pour … » ×8 (09:17-09:20) | à retirer | `relais-…-code` | « 📍 Colis arrivé … » ×8 | juste ; mais avec la règle « Commande mise à jour » du 3 nov. (`relais-conv-…`) les mêmes colis auraient sonné **deux fois** (aucune identité commune) |

Préférences de Julien (`push_prefs`) : `{achat, suivi, favori, facture, message}` toutes
allumées à la main ; le reste au défaut (allumé).

## 2. L'inventaire (après le 3 nov.)

Famille = interrupteur dans Paramètres → Notifications (ligne `push_prefs.familles`, lue par
le serveur avant d'envoyer ; une famille jamais touchée suit l'ancien réglage de la catégorie,
sinon son défaut — toutes allumées par défaut). Fréquence = au plus.

### Ventes
| notification | déclencheur exact | texte | toucher | une fois par |
|---|---|---|---|---|
| 💸 Vendu ! | e-mail Vinted « Ton article s'est vendu » | `💸 Vendu !` · `<article> — <prix> € (<compte>)` | Ventes · la vente (n° de transaction) | transaction (`sale-…`) |
| Vendu sur Vestiaire | e-mail de vente Vestiaire (nouvelle vente) | `Vendu sur Vestiaire` · `<article> — tu reçois X € — à envoyer avant le JJ/MM.` | Vestiaire | `productId` |
| 💰 Argent reçu | e-mail « commande finalisée » (versement) | `💰 Argent reçu` · article, montant | Ventes | transaction |
| ⚠️ Double vente | vente Vinted apprise + N° PROUVÉ encore en ligne sur eBay/Leboncoin/Vestiaire | `⚠️ Vendue sur Vinted — N°X encore en vente sur …` | Annonces · la ligne du doublon | N° + plateforme |
| 🛒 Agent eBay | cron quotidien, paires prêtes | `🛒 N paires prêtes pour eBay — publier ?` | eBay · agent | jour |

### Colis à poster
| 📦 Bordereau prêt | e-mail « Bordereau d'envoi » | `📦 Bordereau prêt à imprimer` · `<modèle> — N°X : déjà tamponné — à expédier avant le …` | Colis · la carte (tx) | transaction |
| 📮 Rappel du matin | cron, colis dus aujourd'hui/demain/en retard | texte `texteMatin` | Colis · « Prêts à imprimer » | jour + total |
| 📮/⏰ Demain : N | cron du soir | `texteSoir` | Colis | jour |

### Colis arrivés
| 📍 … t'attend | **seulement si l'e-mail le CONSTATE** (phrase au présent/passé, sans « si », « au cas où », « dès que », futur, conditionnel ; mot entier — « indisponible » ≠ « disponible ») : e-mail du transporteur (« est disponible », « vous attend », « est arrivé en relais/consigne », « récupère ton colis », « à retirer avant ») ; e-mail Vinted « Ta commande t'attend ici … Utilise le code X » ; code lu dans une conversation (extension) ; statut « disponible » lu chez le transporteur ; étape Vinted « Disponible pour retrait » | `📍 <article ou « Ton colis <transporteur> »> t'attend` · `<Point>, <Ville> · code X · jusqu'au JJ/MM` (ex. « 📍 Ton colis Mondial Relay t'attend » / « Maison de la Presse, Cancale · code 454602 · jusqu'au 12/11 ») | Colis · À retirer · la carte (n° de suivi / tx) | colis : `relais-{n°}-*`, `relais-tx{tx}-*`, `retrait-code-{CODE}` partagées par toutes les voies |
| 📍 Dernier jour · <point> | cron du matin, limite LUE = aujourd'hui | `📍 Dernier jour · Maison de la Presse` · `À retirer aujourd'hui avant 11 h 34 · Mondial Relay n°…` | Colis · la carte | colis + état |
| ↩️ Colis reparti chez l'expéditeur | le transporteur ÉCRIT qu'il repart (e-mail ou lecture) | `↩️ … repart chez l'expéditeur` · « vérifie le remboursement » | Achats | n° |
| ⚠️ quitté le point / problème / statut inconnu | lecture chez le transporteur après l'arrivée | inchangé (`texteNotifTransp`) | Achats | n° + état |

### Offres
| 💰 Offre | e-mail « Nouvelle offre » | `💰 Offre X € de <pseudo>` | Messages · la conversation | e-mail |
| Offre au-dessus du prix mini | cron, offre ≥ prix mini posé | `Une offre au-dessus de ton prix mini` | la conversation (une) / Offres (plusieurs) | `offer_request_id` |

### Messages
| 💬 <paire> | e-mail « Nouveau message » | `💬 <paire>` · extrait | la conversation | message |
| ⚠️ Annulation demandée | e-mail « souhaite annuler son achat » | `⚠️ Annulation demandée — <article>` · `<pseudo> veut annuler (« raison ») — accepte ou refuse…` | la conversation | e-mail |
| ⏳ À confirmer avant le … | e-mail « <article> - Confirmation requise » (commande livrée) | `⏳ À confirmer avant le 18 oct. 11:25 · <article>` · « Vinted dit ta commande livrée : signale un problème avant cette date… » | Achats | e-mail |
| ⚠️ Colis peut-être perdu | e-mail « Action requise : le colis semble avoir été perdu — <article> » | `⚠️ Colis peut-être perdu · <article>` · « Vinted te demande une action : ouvre la conversation. » | la conversation (si le lien est là) | conversation, sinon sujet |
| ❤️ Messages aux favoris | file d'envoi finie / interrompue ; mode auto bloqué | bilan de la file / le geste qui débloque | Messages · Favoris | lot / code |

### Compta
| 🧾 URSSAF | cron, le 1er du mois et la veille de l'échéance | inchangé | Comptabilité · déclaration | mois |
| 📊 Bilan de la semaine | cron du lundi | inchangé | Ma journée | semaine |

## 3. Ce qui ne sonne plus (et pourquoi)

| retirée | pourquoi |
|---|---|
| « 📍 Colis arrivé » sur une annonce, une question, une condition, un futur | **FAUX** (mesuré, §1). Remplacé par « 📍 … t'attend » sur constat seulement. |
| « 🚚 Colis en transit » / « 📦 Suivi colis » / « en route » (e-mail, transporteur, suivi Vinted) | aucun geste ; la moitié se lisait « arrivé » (« arrive aujourd'hui », « vient d'arriver au centre de tri »). Le suivi reste dans l'app. |
| « ✅ Colis livré / retiré » de SES achats | il l'a retiré lui-même. |
| « ✅ Ta vente : colis retiré par l'acheteur » | aucun geste ; l'argent arrive avec « 💰 Argent reçu ». |
| « 🛍 Achat confirmé » | il vient de l'acheter (~60 en 8 jours). |
| « ❤️ Nouveau favori ! » | bruit (6 en 15 s) ; les favoris ont leur écran et leur mode auto. |
| « 📍 Achat arrivé au point relais » sans code (e-mail Vinted « t'attend au point relais » / « livré dans le Point Relais ») | **doublon** de l'e-mail du transporteur du même colis, qui porte le code (mesuré le 3 nov. : 8 + 8 e-mails pour 8 colis, sans identité commune). Le colis est rangé « à retirer » quand même. La consigne Vinted AVEC code sonne (dédoublonnée par le code). |
| « Colis à vérifier : n°… » (cron) | un délai passé ne dit pas où est le colis (29 oct. : 5 sur 5 avaient été retirés). Reste dans Colis → à vérifier. |
| « ✅ Colis livré » sur « colis perdu » | FAUX ; remplacé par « ⚠️ Colis peut-être perdu » (Messages). |

Les anciennes catégories `suivi`, `achat`, `favori` sont **retirées** : plus jamais
envoyées, même allumées avant (`CATEGORIES_RETIREES`).

## 4. Paramètres → Notifications

Six interrupteurs, sans texte : Ventes · Colis à poster · Colis arrivés · Offres · Messages ·
Compta. Écrits dans `push_prefs.familles` (base, lue par le serveur ; copie gardée avec les
appareils pour une instance froide). Une famille coupée ⇒ rien n'est envoyé de cette famille.

## 5. Codes de retrait hors ligne

Existait (G9, `vrm_codes_hors_ligne`, QR mis en cache par le service worker). Mesuré au banc
`codes-hors-ligne` le 3 nov. : (a) rouge sur `main` — attente fixe de 2,5 s, l'écran publie
plus tard (corrigé : attente de l'état) ; (b) **réseau réellement coupé** (nouvelle phase 3,
`setOffline`) : l'app rouverte par le service worker affichait « Hors ligne — aucune copie de
ta journée » et **aucun code**, alors qu'ils étaient gardés. Corrigé : `BlocCodesHorsLigne`
rendu aussi par « Ma journée hors ligne » sans photo.
