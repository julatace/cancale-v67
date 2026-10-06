# Les bancs — l'app RENDUE, sur une copie des vraies données

Un audit lit le code. Un banc **rend l'app** et regarde ce qui s'affiche. Les
deux sont nécessaires : la moitié des défauts trouvés en septembre ne levaient
**aucune erreur** et passaient tous les audits.

## Comment les lancer

Les bancs lisent leurs données dans un dossier `fx/` **à côté d'eux**, qui n'est
**jamais** dans le dépôt : ce sont les vraies ventes, les vrais acheteurs, les
vraies adresses — et **ce dépôt est public**.

```bash
mkdir -p /tmp/bancs && cp scripts/bancs/*.cjs /tmp/bancs/
node scripts/bancs/copie-fixtures.mjs <SUPABASE_URL> <ANON_KEY>   # écrit fx/
npm run build            # ⚠️ jamais pendant qu'un banc sert dist/
node /tmp/bancs/verif_visuel.cjs
```

`copie-fixtures.mjs` ne copie **jamais** les PDF (§4.4 : 6 Mo dont 99 % de PDF).

## Ce que chacun protège

| banc | ce qu'il rend, et le défaut qu'il a attrapé |
|---|---|
| `verif_visuel.cjs` | les 10 écrans, à 390 et 1512 px : écran vide, débordement, garde-fou, recouvrement par l'île d'actions |
| `verif_dark.cjs` | les mêmes en sombre |
| `colis.cjs` | l'écran Colis voit ses bordereaux, et un bouton Imprimer les sort. **Compare aussi Ma journée et Colis sur le nombre de bordereaux prêts** — dans l'ordre le plus risqué (accueil ouvert EN PREMIER, rien de publié), et vérifie que le bandeau d'urgence dit **où** est un colis pressé quand il n'est pas dans le premier groupe |
| `perfv.cjs` | Ventes : frappe < 250 ms, filtre < 300 ms, « Voir plus » sans changer les totaux |
| `retrait.cjs` | chaque colis à retirer a une porte vers son code ; les colis non réclamés sont nommés |
| `oublies.cjs` | les colis « jamais retirés » montrent leur code **et** leur QR |
| `carte.cjs` | la ville déjà renseignée déclenche la recherche des points relais |
| `postes.cjs` | cocher « Colis fait » ne fait disparaître personne, et les comptes collent |
| `conflit.cjs` | **le risque n°1** : deux paires sous le même numéro. Il FORCE le cas (aucun n'existe aujourd'hui) et vérifie que l'app crie en rouge sur Colis |
| `urssaf.cjs` | **la carte du mois se vérifie toute seule** : il prend les nombres RENDUS et exige que CA × taux = à payer et CA − à payer = net, que le CA vienne de la ligne publiée par Ventes, et que le compte affiché soit celui des finalisées. Aucun libellé ne sert à juger |
| `panne.cjs` | **quand la base ne répond pas, l'app le DIT** : il sert la vraie forme de la panne (522 + HTML) sur **les 15 écrans joignables** (il n'en rendait que 4 — les quatre que je venais de corriger : huit se taisaient, dont « Comptes liés » et le panneau de **sécurité**, qui affirmait « Lecture sans compte · fermée »). Il exige qu'aucune affirmation ne s'affiche, que chaque écran l'AVOUE, et qu'il le dise **une** fois, pas trois — puis vérifie l'autre sens, aucune fausse alerte en marche normale |
| `reglages.cjs` | **un réglage qu'on n'a pas pu lire ne se fait pas écraser** : quatre panneaux de Réglages réécrivent leur ligne ENTIÈRE au premier réglage touché. Il sert le cas qui détruit — **lecture KO, écriture OK**, seules ces quatre lignes échouent — puis CLIQUE, et exige que **zéro** écriture parte. Puis l'autre sens : en marche normale le clic écrit pour de vrai, avec les autres clés intactes (sans quoi « ne jamais écrire » passerait le banc). **11 échecs** sur le code d'avant, dont `push_prefs ← {"suivi":true}` — une clé au lieu de cinq. Il compte aussi les occurrences (le bloc ×1, une pastille par panneau) : quatre fois la même phrase est §7 |
| `comptes.cjs` | **un choix n'est pas une panne** : il FORCE le masquage du compte le moins frais et vérifie qu'il sort du décompte des pannes, qu'il est compté à part, et que sa carte ne lui réclame plus une capture — sans jamais le faire disparaître |
| `capacites.cjs` | **l'app ne promet que ce que l'extension INSTALLÉE sait faire**. Il simule le pont (`__vmr:'ready'`) dans ses six états — absent · muet · 5.37 · 5.38 · 5.52 · 5.59 — et FORCE des prix planchers (0 en vrai). Vérifie des deux côtés du seuil 5.38, que le bandeau compte sur la même base que la grille, et **§7 : la phrase commune aux deux places se dit UNE fois** — il cherche la répétition (toute phrase ≥ 45 caractères rendue deux fois), jamais un libellé, et exige que les deux places restent nommées |
| `ebay.cjs` | **l'assistant eBay EXÉCUTÉ** : `ebay.js` n'avait jamais tourné (`node --check` ne lit que la syntaxe). Il sert une fausse page de mise en vente avec le VRAI en-tête d'eBay (mesuré) et charge le script avec un faux `chrome.runtime`. **35 contrôles, 16 échecs sur le code d'avant** : les photos s'ATTACHENT (0 téléchargement), l'état/la marque/la pointure sont choisis mais **jamais la catégorie**, la barre de recherche et le filtre « Prix min » restent vides, le presse-papier refusé retombe sur l'ancienne méthode (il annonçait « copié » sans rien copier), le bandeau écrit les CHIFFRES, « Re-remplir » relance la surveillance, et la structure de chaque étape est rapportée |
| `ebay-programmer.cjs` | **les brouillons et le planificateur eBay** (5 oct., données inventées, port 4721) — horloge figée, navigateur à l'heure de New York EXPRÈS : l'aperçu donne l'heure exacte de PARIS (changement d'heure du 25 octobre compris), les brouillons au-delà de 3 semaines restent des brouillons, les frais sont lus par nom (« pas su » jamais 0), rien ne part avant que le risque soit coché, six `programmer` partent chacun avec SON heure UTC et SON UUID, le bilan dit chaque refus, les programmées sont groupées par jour, « Déplacer » est grisé dans la dernière heure, « Annuler » rend la réponse d'eBay ; et une lecture ratée des brouillons n'écrit RIEN. **14 rouges** sur le build d'avant, rouge sous quatre mutations |
| `serveur.cjs` | **les routes `api/` EXÉCUTÉES** (§4.10 : `npm run build` ne compile pas `api/`, aucun banc ne les avait jamais lancées). Base injoignable : l'email entrant doit répondre 5xx — un 200 fait SUPPRIMER l'email chez l'expéditeur ; le widget ne doit annoncer aucun zéro ; `subscribe` ne doit ni dire « activé » ni **réécrire** la liste des appareils depuis une lecture ratée (3ᵉ état servi : lecture KO, écriture OK — le cas qui efface) |
| `repondre.cjs` | **ce qui part en son nom est relisible, et les nombres sont les VRAIS**. Julien a choisi « elle répond à tout » ; mesuré sur ses **32 conversations non lues**, l'extension n'en répond que **3** (17 sans échange capté, 9 sans message de l'acheteur, 1 refusée par Vinted, **1 où c'est LUI l'acheteur**). Le panneau écrit les deux nombres et les causes, jamais « à tout ». Il rend quatre états (lecture ratée · ligne absente · deux jeux de chiffres différents) et exige que le texte **suive la donnée** — un texte figé passerait sinon. **7 rouges** sur un rendu réaffaibli à « Elle répond à tout » |
| `rapport.cjs` | **le rapport comptable détaille les VENTES** (G2) — sur des ventes INVENTÉES, il vit dans le dépôt sans `fx/`. Une ligne par vente finalisée du mois, la somme des lignes = le CA affiché (jugé sur les nombres rendus), bénéfice inconnu = « — », le PDF se génère. Et sur téléphone émulé, les boutons CSV/PDF sont cliquables : l'animation d'entrée `both` gardait un contexte d'empilement et la barre du bas les recouvrait. **9 rouges** sur le code d'avant |
| `ventes-bordereau.cjs` | **le bordereau à côté de chaque vente** (E1) — sur des ventes INVENTÉES et un PDF de test (`bordereau-test.b64`, aucune donnée réelle). Le bouton n'apparaît que si le bordereau est relié par la TRANSACTION ; un bordereau au même titre sans transaction ne relie rien (§5) ; un clic demande le PDF de CE bordereau et l'imprime sans erreur. **8 rouges** sur le code d'avant |
| `statuts-colis.cjs` | **« à expédier » dit la même chose partout** (4 oct.) — un compte et huit ventes INVENTÉS couvrant les libellés réels (bordereau envoyé, bordereau d'envoi commandé, coché « posté », au relais, en route, non réclamée, finalisée, paiement échoué) + un achat au relais. Colis : 2 cartes (`data-bord-card`), la bonne au groupe « prêt » (`data-groupe`) ; Ma journée « Expédier 2 colis » et le nombre PUBLIÉ ; la cloche dit 2 après Ma journée ET sur un appareil neuf (repli) ; Ventes : chaque filtre cliqué, « À expédier » = exactement les 2 (boutons `data-tx`), « En transit » contient le relais, la route et la non réclamée, chaque vente dans UN SEUL des quatre filtres ; étapes « À expédier » / « Au relais » / ni « Remboursée » ni « Annulée » ; Achats « À retirer », jamais « Reçu ». Et la cloche d'un appareil neuf où le NUAGE (qui porte « colis posté ») arrive après les ventes ; l'étiquette ne contredit jamais le filtre. **38 rouges** sur le code d'avant (c117b30), **6** sur le travail des statuts sans les trois correctifs (8cb3843) |
| `widget-colis.cjs` | **le widget iPhone compte les mêmes colis que l'app** (4 oct.) — ni compte retiré, ni colis coché « posté », ni faux retard ; une liste de comptes vide ne filtre rien. Aucune fixture. **5 rouges** sur l'avant |
| `fluidite.cjs` | **une relecture ne fait pas clignoter** (4 oct.) — aucun squelette pendant un rafraîchissement, un signal de l'extension reçu ailleurs n'est pas perdu, une panne de NOTRE base ne déclenche aucun appel au relais Vinted, et Colis le dit. **12 rouges** sur l'avant |
| `detourage.cjs` | **la route du détourage Photoroom** (exécutée, pas rendue) — session, propriétaire, abonnement réellement payé pour `PHOTOROOM_POUR=tous`, cache par empreinte, plafond atomique, cache illisible = pas de repaiement, unité gardée sur une coupure après le 200. **21 + 6 rouges** sur les deux versions d'avant |
| `detourage-reglage.cjs` | **le réglage « Détourer mes photos » dit ce que le serveur dit** — six états (prêt · autre jeu · sans clé · réservé · pas su · compteur illisible), le clic écrit le réglage, réservé ⇒ rien ne s'écrit. **3 rouges** en réaffaiblissant |
| `plantages.cjs` | **le journal des plantages** — nettoyé (email, jeton, login, téléphone, prix, UUID), bruit écarté sur la frame qui a levé, une empreinte par erreur (pas par déploiement), file gardée sur un échec ou un plantage pendant l'envoi ; dans l'app rendue : envoyé au nom du vendeur, montré dans Réglages. **8 rouges** en réaffaiblissant |
| `sauvegarde.cjs` | **la sauvegarde complète et sa restauration** — clique pour de vrai : aucun secret dans le fichier, « incomplet » quand une page manque, une vieille sauvegarde ne libère aucun numéro, un échec d'écriture n'affiche jamais « restaurée ». **9 rouges** sur l'avant, dont 7 secrets |
| `proxy.cjs` | **`/api/vinted-proxy` n'est plus un relais ouvert** (route exécutée, aucune fixture) — sans session : 401 et rien ne part ; geste, adresse non permise, compte d'un autre : refusé ; base en panne : 503 ; le vendeur lit SON compte avec le jeton de la base, jamais celui du navigateur. **13 rouges** sur l'avant. Et (5 oct.) un jeton renouvelé est rangé PAR LE RELAIS, avec la session du vendeur ; une écriture refusée est dite (`persiste: false`) — **4 rouges** sur l'avant |
| `lot-bordereaux.cjs` | **« Tout imprimer » ne présente jamais un lot partiel comme complet** (aucune fixture) — un PDF abîmé (commence par %PDF, refusé par pdf-lib) est compté à part, le nombre imprimé est celui de la fusion. **2 rouges** sur l'avant (« 2 sur 3 imprimés » pour 1 parti) |
| `recus.cjs` | **Registre annuel : un reçu illisible n'est pas avalé** (aucune fixture) — deux comptes, l'un lu, l'autre en 522 : la liste dit le compte manquant. **1 rouge** sur l'avant |
| `ship-multi.cjs` | **les rappels d'expédition par vendeur** (route exécutée) — un vendeur, ses lectures, son mémo ; sonde en panne ⇒ ni passe globale ni rappel ; réglages illisibles ⇒ silence ; 24 vendeurs en parallèle borné (8). **3 rouges** sur l'avant |
| `bilan-semaine.cjs` | **le bilan de la semaine** (le vrai cron, base cloisonnée à deux vendeurs, faux Web Push, un lundi figé) — chacun SES chiffres, ceux de la règle de l'app (`ventesFaites` extraite d'App.jsx) ; « à expédier » = le widget ; un bilan par semaine (mémo écrit avant l'envoi et vérifié, mémo illisible ⇒ rien) ; préférence coupée ⇒ rien ; source illisible ⇒ « au moins » et la source nommée ; jeudi ⇒ rien. Aucune fixture. **14 rouges** sur l'avant |
| `comptes-annonces.cjs` | **les comptes ne s'empilent plus sur Annonces** (H1) — trois comptes INVENTÉS. Plus aucune puce de compte cliquable (elles MASQUAIENT le compte au tap), une ligne « Annonces de N comptes · Gérer les comptes → » qui mène à Comptes liés, et là-bas masquer DEMANDE confirmation (« Annuler » ne masque rien). **12 rouges** sur le code d'avant |
| `pont.cjs` | **l'app commande l'extension** (2 oct.) — rejoue le VRAI dialogue du pont (`ready`/`etat`/`cmd`/`evt`) sur des ventes inventées : absente, muette (présente n'est pas allumée), bon compte (bouton actif → commande → « fait » → impression sans recharger), autre compte (grisé, les deux comptes nommés), téléphone. La raison commune est dite UNE fois |
| `serie.cjs` | la saisie en série des prix d'achat : ouverture < 1,2 s, toutes les paires annoncées sont saisissables, une suggestion relie et écrit |

## Les trois pièges qui m'ont fait mesurer des fictions

1. **La projection `select=`.** Rendre la ligne brute (`{id,data}`) pour une
   requête qui demande `select=id,filename:data->>filename,…` fait lire
   `r.filename` sur un objet qui ne l'a pas. **Tous les bordereaux tombaient**
   et l'écran affichait « 0 bordereau prêt à imprimer » alors que dix étaient en
   base. Chaque banc applique donc la projection pour de vrai (`projette`).
2. **Le garde-fou d'écran passe tous les contrôles.** « Cet écran n'a pas pu
   s'afficher » est un vrai texte, sans débordement, sans `pageerror` (React
   avale l'exception) : le banc répondait « rendu conforme » sur un écran
   **mort**. Le contrôle « aucun écran n'est tombé sur le garde-fou » existe
   pour ça.
3. **Playwright prend la DERNIÈRE route enregistrée en premier.** Un fourre-tout
   `**/api/**` posé après `**/api/relais**` avale la route précise et répond
   `{pret:true}` : la carte restait vide sans lever la moindre erreur. Le
   général d'abord, le particulier ensuite.

Et la règle qui les résume : **regarder la capture fait partie du test**.
