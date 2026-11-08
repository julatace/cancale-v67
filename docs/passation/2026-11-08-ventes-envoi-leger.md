# 8 nov. — Les ventes et les achats s'envoient LÉGERS (extension 5.326.0)

Branche `claude/ventes-envoi-leger` (partie de `claude/amazing-lovelace-xd7obl`, 5.325.0). Pas de PR :
intégrée par la session principale.

## Ce qu'il a vu (captures iPhone, 8 nov.)
- Extension **5.322** dans un navigateur iOS, sur vinted.fr : « Dernier envoi refusé à l'instant — la base
  n'a pas répondu, ça réessaie tout seul ».
- VRM → Ventes : les ventes récentes de shop_cancale restent « Vendue — vue par e-mail, pas encore relue
  sur Vinted · ventes de ce compte relues le 6 nov. 11 h 22 », alors qu'il a rechargé Vinted. Le compte a
  ~2 164 ventes.

## La cause (lue dans le code et mesurée au banc ; la base réelle n'était pas joignable d'ici)
Deux choses s'additionnent.
1. **Sa 5.322 n'écrit jamais les ventes d'un gros compte en passant** (défaut connu, corrigé en 5.323,
   `2026-11-06-extension-5323.md`) : une lecture de 320 ou 1 000 ventes est refusée « plus pauvre » devant
   les 2 000 rangées. Seule la moisson de 20 × 100 de la page peut écrire — et c'est une ligne entière.
   D'où la date figée au 6 nov. 11 h 22 (sa dernière écriture réussie, sans doute depuis un ordinateur).
2. **Chaque écriture des ventes, même en 5.323–5.325, part ENTIÈRE.** La fusion de la 5.323 RELIT la ligne
   `harvest_{uid}_orders_sold` (projection `my_orders`) puis la RÉÉCRIT en entier pour y ranger 320 ventes.
   Mesuré au banc sur des commandes à la forme réelle, allégées comme en base (`commandeMaigre` : prix objet
   `{amount, currency_code}`, photo `{url, high_resolution}`, n° à 11 chiffres, statuts longs) :
   **≈ 540 octets par vente ⇒ 1 055 Ko pour 2 000 ventes**, à lire PUIS à envoyer depuis le téléphone —
   8,6 s de liaison montante à 1 Mb/s, 2,9 s à 3 Mb/s, sans compter la relecture. (Les mesures en base du
   6 nov. disaient ≈ 0,7–1,3 Mo pour cette ligne : même ordre de grandeur. L'agent d'avant avait estimé
   ~3 Mo sur un banc qui servait des commandes NON allégées.) Sur iOS, le service worker d'une extension
   est suspendu vite : un `POST` d'un mégaoctet est coupé en route ⇒ `reseau`, rien n'arrive, et la même
   ligne repart à la visite suivante. Les autres grosses lignes envoyées par `supabaseUpsert` :
   `orders_purchased` (la même forme, ~1 000 Ko pour 1 985 achats — traitée pareil), `listings` (allégée,
   ~300 Ko mesurés en base le 6 nov., écrite seulement quand le dressing est complet), `inbox` (bornée à
   300 conversations, quelques dizaines de Ko).
- **Pas prouvé sur l'appareil** : la 5.325 dit la taille de chaque refus. Si, après la 5.326, la carte
  montre encore un refus, son repli « Les 5 derniers refus » dira la famille et la taille : l'envoi des
  ventes y apparaît comme `harvest_orders_sold`, toujours sous 200 Ko.

## Le choix (mesuré)
Trois pistes regardées :
- **Alléger le contenu** : `commandeMaigre` ne garde déjà que ce qu'on lit (date, prix, titre, statut,
  n° de transaction, de conversation, d'article, état machine, une photo). Il n'y a presque plus rien à
  retirer : on gagnerait 20 %, pas un facteur 10. Écarté.
- **Une ligne « récente » à côté de la ligne complète** : petite, mais TOUS les lecteurs devraient fusionner
  deux lignes — l'app (une vingtaine d'endroits : ventes, preuves de vente, colis, fraîcheur, bilan,
  versements, sonde), `api/widget.js`, `api/ship-reminders.js`, `api/_lib/facture-pro.js`,
  `suivi-vinted.js`, le bilan, et l'extension elle-même ; une app ancienne en cache ne la verrait pas.
  Le risque d'oublier un lecteur est exactement le défaut le plus coûteux du projet. Écarté.
- **Retenu : la fusion se fait chez `vrm.center`** (`api/_lib/commandes-leger.js`, mode `commandes` de
  `api/compte.js` — aucune fonction de plus, toujours 12). Le téléphone n'envoie que ce que la base n'a
  pas ; le serveur relit et réécrit la ligne (centre de données ↔ base, pas de liaison montante de
  téléphone). **La ligne garde exactement sa forme : aucun lecteur ne change.**

## Comment ça marche
Extension (`commandesParServeur`, `appelCommandesServeur`, `apresCommandesServeur`, background.js), sur
les deux voies (passive `storeHarvest`, active `storeHarvestRow`) :
1. Lecture COMPLÈTE et petite (≤ 150 commandes) ⇒ écrite directement, comme avant.
2. Fenêtre identique déjà rangée il y a moins d'une heure ⇒ rien (règle 5.323 gardée).
3. Sinon, UN envoi : la fenêtre en abrégé (`fenetre` = « n° : empreinte » dans l'ordre lu, ≈ 25 octets par
   commande), les 100 commandes du haut EN ENTIER (neuves ou changées le plus souvent), les n° « à expédier /
   au point relais » de la fenêtre selon la règle de l'extension (`ae`, `resumeCommandes`), les transactions
   qui ne s'expédient plus (`exclues`, `transactionsQuiNeSExpedientPlus`), la pagination, l'heure de lecture.
4. Le serveur reconstitue la fenêtre : chaque commande est soit fournie (son empreinte est revérifiée —
   une différence ⇒ 400, rien écrit), soit prise dans la base **si son empreinte y est la même** ; sinon elle
   est DEMANDÉE (`manquants`). Il fusionne avec la règle de la 5.323, **au caractère près la même** :
   `src/commandesFusion.js` est la seule définition, recopiée dans `background.js` par
   `node scripts/sync-commandes.cjs` (bloc COMMANDES PARTAGEES ; `--verifier` sort en erreur si la copie
   diffère) et importée par le serveur. L'empreinte (`empreinteCommande`) trie les clés à chaque niveau
   (la base jsonb range les clés à sa façon) et combine deux hachages de 32 bits.
5. S'il manque des commandes, l'extension les envoie par lots de 200 (≤ 12 envois au total). Chaque lot
   est rangé (fusion : rien n'est effacé) ; **« relues le … » (`capturedAt`) n'avance qu'avec la fenêtre
   ENTIÈRE**. Une ligne qui n'existait pas reçoit la date dès la première part.
6. Le résumé (`resume.txns`, lu par le widget et les rappels) : la règle de l'extension pour chaque commande
   de la fenêtre, l'ancien résumé pour celles hors fenêtre, puis les exclusions. Identique, au banc, à la
   règle de l'extension appliquée à la liste entière. (Une ligne sans résumé — aucune aujourd'hui, elles en
   ont depuis août — compterait ses commandes hors fenêtre comme « pas à expédier ».)
7. Écriture AU NOM du vendeur (son jeton, RLS, `vendeurExige`), comparer-et-échanger sur `data.rev` ET
   `data.capturedAt` : une extension ancienne qui réécrit la ligne entre-temps fait échouer l'échange ⇒ le
   serveur relit et refusionne (une fois), sinon 409 et rien écrit. Base illisible ⇒ 503, rien écrit.
   La ligne porte en plus `rev` (compteur) et `envoi: 'leger'` (diagnostic) ; aucun lecteur ne lit `data` en
   entier pour ses clés.

Ce qui arrive sur un échec :
- coupure, 503, 409, 401 (après un renouvellement de session) ⇒ rien n'est compté comme rangé ; la carte du
  logo garde le refus avec son code, la famille `harvest_orders_sold` (ou `_purchased`) et la taille — qui
  reste sous 200 Ko : **le prochain essai est petit** ; aucun repli sur l'envoi entier après une coupure ;
- `vrm.center` qui ne connaît pas encore la route (404 : production pas encore déployée) ⇒ la voie d'avant
  (relire + réécrire), pour ne rien perdre pendant le déploiement ;
- tours épuisés ⇒ ce qui est rangé l'est, la date ne bouge pas, diag `envoi_leger_incomplet_<type>`.

Aucune requête Vinted de plus ; rien de plus dans le budget de lecture (20/h) ni dans les 50 actions/h ;
garde-fous de l'extension intacts (compte de l'onglet, une requête Vinted à la fois, pause 429/403).

## Tailles (banc, forme réelle)
| | avant (5.323–5.325) | 5.326 |
|---|---|---|
| visite, 320 ventes lues dont 1 neuve, 2 000 en base | relit ~1 055 Ko + envoie ~1 055 Ko | **un envoi de 61,5 Ko**, rien relu |
| un changement hors des 100 du haut | idem | 61,6 Ko + un second envoi de 8,8 Ko (la fenêtre abrégée + la commande demandée) |
| ligne absente, 2 000 lues (moisson) | un envoi de ~1 055 Ko | 11 envois de 104 à 157 Ko |
| égress de la base | lu par le téléphone | lu par le serveur (même volume par écriture ; 1 h sans rien de neuf ⇒ rien) |

## Compatibilité
- Extension ancienne : elle écrit toujours la ligne entière ; même forme ; elle fait échouer l'échange du
  serveur, qui relit (rien perdu, banc §6).
- App nouvelle ou ancienne (cache) : la ligne a la même forme, `capturedAt`, `nItems`, `resume` compris ;
  rien à lire de plus. `EXT_ATTENDUE` = 5.326.0, capacité `ventesleger` (`commandesParServeur`) dans
  `EXT_CAPACITES` (aucune promesse d'écran ne s'y appuie aujourd'hui).
- Serveur pas encore déployé : voie d'avant (ci-dessus).

## Preuves
- `scripts/audit-ventes-envoi-leger.cjs` (nouveau) : le VRAI `background.js` (`_fond-vm.cjs`) ET la VRAIE
  route (`routeCommandes`) sur une base à état (projection `select=`, filtres du comparer-et-échanger, 409
  d'une création concurrente) : **46 ✅**. 2 000 ventes ⇒ envoi de 61,5 Ko, l'extension ne relit ni ne
  réécrit la liste, 2 001 en base, neuve en tête, état frais, aucune en double, « relues le » avance et
  l'app (`ventesEmailFraiches`) ne la dit plus « vue par e-mail » ; changement hors tête demandé et envoyé
  seul ; 503 et coupure ⇒ rien écrit, carte avec code, famille et taille < 200 Ko, pas de repli entier ;
  51 jumelles (même titre, prix, marque) = 51 lignes, seule la bonne change ; empreinte trafiquée ⇒ 400 ;
  résumé = règle de l'extension (450 exclue) ; extension ancienne pendant la fusion ⇒ relue, rien perdu ;
  par lots (ligne absente / ligne existante dont tout a changé) chaque envoi < 200 Ko et la date n'avance
  qu'à la fin ; complète grosse remplace sans relecture ; complète petite directe ; 404 ⇒ voie d'avant ;
  achats par la voie passive.
- Code d'avant (`--src` = `background.js` de `df2a437e`) : **17 ❌**. Mutations (`--serveur` sur une copie
  modifiée, `--src` pour l'extension) : empreinte non vérifiée ⇒ 2 ❌ ; date avancée sur une part ⇒ 1 ❌ ;
  fenêtre partielle qui remplace tout ⇒ 6 ❌ ; échange sans condition ⇒ 2 ❌ ; tête = toute la fenêtre ⇒
  4 ❌ (envoi de 1 115 Ko).
- `audit-ventes-fusion` (28 ✅, voie d'avant quand la route est absente), `audit-evt-extension` (48 ✅ ;
  son faux réseau répond maintenant 404 pour `vrm.center` : il juge la voie d'avant),
  `scripts/sync-commandes.cjs --verifier`, `audit-coherence`, `audit-extension-zip`, `audit-identite`,
  `audit-statuts`, `audit-fonctions-api`, `audit-fiabilite-fond`, `audit-fusion`, `audit-inbox-fusion`,
  `audit-extension-navigateurs`, `audit-extension-ui`, `audit-bilan-semaine`, `audit-transp-ext`,
  `audit-pont-session`, `audit-relier-compte`, `audit-moisson-dressing`, `audit-enligne`,
  `audit-versement-releve`, et tous les audits qui lisent `my_orders` : verts. `npm run build` OK.
  Bancs `vente-email-fraiche` (64 verts) et `badge` (114 verts).
  (Déjà rouges sur l'arbre d'avant, pas de ce chantier : `audit-politique-hotes` — `src/enLigneLbc.js` ;
  `audit-export-donnees` X6.)

## Version
Extension **5.326.0** (aucune des 366 branches distantes ne la portait) : manifeste, `CODE_VERSION`,
`lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`, `EXT_CAPACITES.ventesleger`, `audit-coherence`, table §8,
paquets régénérés (`node scripts/zip-extension.cjs` : `public/VRM-extension.zip` un dossier, paquets Orion).

## Gestes de Julien
1. Rien côté serveur : la route part avec le déploiement de `main`.
2. Installer l'extension **5.326.0** (remplacer le dossier, ⟳ dans chaque Chrome ; sur l'iPhone, Orion :
   `VRM-Orion.xpi`), PUIS ouvrir Vinted › Mes commandes sur shop_cancale : la ligne « ventes relues le … »
   doit passer à l'heure de la visite. Si la carte du logo dit encore un refus, ouvrir « Les 5 derniers
   refus » : la famille et la taille disent où chercher.
