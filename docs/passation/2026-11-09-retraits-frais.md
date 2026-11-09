# 9 nov. — Retraits frais : un colis retiré sort partout, la carte = l'onglet, le statut relu toutes les 15 min (branche `claude/retraits-frais`)

Julien (9 nov., capture iPhone de Colis → À retirer, mode sombre) : « Le statut de la disponibilité des
colis doit être regardé très souvent ; on ne doit pas avoir un colis s'il a été retiré. » et « il y a
beaucoup d'erreurs ». La capture : onglets « À envoyer · 18 », « Envoyés · 20 », « À retirer · 0 » ; une
puce ambre « 1 compte à relire » ; une CARTE à deux pastilles « 1 » et « 17 » et « Deux doigts pour
déplacer la carte » écrit en travers ; « Réduire » ; « À vérifier 3 » ; « Peut-être en double 18 ».

Aucune base réelle accessible d'ici : tout est mesuré sur le code et sur des données INVENTÉES de la vraie
forme. Extension : rien changé (aucune version montée ; 5.340.0 reste libre). Les fichiers des chantiers
voisins (`claude/transporteurs-emails`, `claude/scanner-colis-achats`) ne sont pas touchés.

## 1. D'où venait chaque nombre de la capture (mesuré dans le code)

| ce qu'il voyait | d'où ça vient | le défaut |
|---|---|---|
| « À retirer · 0 » | `pickupUnion.total` (src/App.jsx), publié dans `vrm_colis_retirer` : Ma journée, la cloche, le widget le lisent | juste |
| la carte « 1 » + « 17 » | `ColonneRetirerF` (src/CarteRelais.jsx) plaçait TOUS les points connus de la vue (`pointsARetirer`), y compris ceux qui n'ont que des colis hors compte ; l'épingle prenait alors `nombreEpingle` = le nombre d'« à vérifier » / « en double » (`sorte: 'averifier'`) | **D1** une carte qui contredit l'onglet |
| « Peut-être en double · 18 » | `regrouperArrivees` (api/_lib/achat-arrive-relais.js) : une moitié Vinted « ton achat t'attend » sans identité, au même point qu'un colis de transporteur arrivé à ±3 jours — **finis compris** (5 nov. : « un colis retiré reste un témoin de son arrivée ») — devient « doute » | **D2** une moitié dont le seul témoin est RETIRÉ restait « peut-être en double » d'un colis… déjà retiré, jusqu'à 7 jours, puis passait « à vérifier » (garde dépassée) |
| (même cause) | les témoins ne comprenaient que les lignes `available` : une ligne de transporteur réécrite « retiré » par son e-mail (`status: delivered`, arrivée gardée) n'était plus témoin | **D3** la moitié de ce colis-là redevenait « à retirer » (comptée) |
| (même cause) | plusieurs moitiés au même point pouvaient toutes s'appuyer sur le MÊME témoin | **D4** un témoin servait N moitiés |
| « Deux doigts pour déplacer la carte » | `cooperativeGestures` de MapLibre : son voile s'affiche à CHAQUE glissement d'un doigt sur la carte — donc à chaque défilement de la page qui passe dessus | **D5** texte en travers de la carte |
| « 1 compte à relire » | puce de Colis : le compte n'était que dans `title` (invisible au doigt) et le toucher ouvrait Paramètres sans rien dire | **D6** §2.7 : une alerte qui ne dit ni lequel ni quoi faire |
| fraîcheur | le statut chez le transporteur n'était relu que **app ouverte** (demande toutes les 5 min ; un colis « disponible » relu toutes les 30 min, « en route » toutes les 2 h) et par les crons de **5 h et 18 h UTC** | **D7** app fermée, un colis retiré à 10 h restait « à retirer » jusqu'à 19 h (widget, cloche, rappel) |

Mesuré le 5 nov. (historique colis) : 16 moitiés Vinted d'une adresse sans compte relié face à 17 colis
Mondial Relay au même point, dont **13 retirés** d'après le transporteur — c'est exactement D2 : la règle
du doute ne regardait pas si le témoin était fini.

## 2. Ce qui est corrigé (une règle, un propriétaire)

- **D2 / D4** `api/_lib/achat-arrive-relais.js` : `temoinsDe` (la liste des témoins, même règle que
  `aUnTemoin`) et `apparierTemoins` — chaque moitié reçoit SON témoin (le plus proche dans le temps, jamais
  pris deux fois). `regrouperArrivees(…, { temoinActif })` :
  - témoin encore montré (à retirer, à vérifier) ⇒ `doutes` + `doutesTemoins` : la moitié est COMPTÉE AVEC ce
    colis, une fois — sa ligne dit « Compté avec le n°…21TS » (section « Comptés avec un autre colis ») ;
  - témoin FINI ⇒ `probables` : finie avec lui — dite dans les sortis, jamais comptée ;
  - plus de témoin libre (un témoin = un carton, déjà pris par une autre moitié) ⇒ `seul` : un AUTRE colis
    (sa conversation, son achat), À RETIRER, compté ;
  - sans `temoinActif`, la règle d'avant (rien ne change pour un autre appelant).
  (17 h 24, Julien : « TU NE PEUX PAS AVOIR D'HÉSITATION ») : plus de « Peut-être en double », plus du
  paragraphe d'explication de 6 lignes (`explicationEnDouble` n'est plus rendue) ; chaque moitié a UN état.
- `src/App.jsx` (`pickupUnion`) :
  - **D3** les témoins comprennent les lignes dont l'e-mail a dit « retiré »/« retour » (avec `arriveLe`) ;
  - `temoinFini(w)` = son n° fini (`finis`, la règle des fins), e-mail « retiré »/« retour », ou coché ;
  - chaque moitié finie est NOTÉE dans « Sortis de « à retirer » » (`noterProbable`) :
    « Fini avec le n°…0011 — Mondial Relay : retiré le 6 nov. » (`data-sorti-via="doute"`),
    gardée tant que la fin du témoin a moins de 3 jours OU que la moitié est arrivée il y a moins de 10 jours ;
  - une moitié passée « à vérifier » par l'âge seul, sans identité, dont TOUS les témoins sont finis : idem.
  Le total « à retirer » change dans deux cas, tous deux tranchés : D3 (une moitié dont le seul témoin était
  une ligne d'e-mail « retiré » ne compte plus) et `seul` (une moitié de plus qu'il n'y a de colis du
  transporteur au point est COMPTÉE — avant, « peut-être en double » et jamais comptée).
- **D1** `src/relaisColis.js` `surLaCarte(p)` = un point où un colis COMPTÉ attend (`nComptes > 0`) ; les
  deux colonnes de `src/CarteRelais.jsx` n'épinglent et ne géocodent que ces points. Les « à vérifier »,
  « en double », « en route » restent dans leurs replis sous la carte. « À retirer · 0 » ⇒ pas de carte.
- **D5** `src/styles-colis-colonnes.css` éteint le voile de MapLibre ; `FondRelais` montre à la place UN
  indice bref en haut à gauche (« Deux doigts pour déplacer la carte », `data-carte-indice`), la première
  fois que la carte s'affiche au doigt pendant la visite, effacé après 2,5 s. Un doigt fait toujours défiler
  la page (la carte ne le prend pas).
- **D6** la puce dit « Relire compte_a · 3 j » (un compte) ou « N comptes à relire » ; la toucher ouvre,
  juste dessous, chaque compte et son âge, LE geste (« Ouvre vinted.fr connecté sur compte_a, dans le
  navigateur où est l'extension VRM : elle le relit toute seule. D'ici là, un colis déjà retiré ou expédié
  peut encore apparaître. ») et « Mes comptes ».
- **D7** la fréquence (tableau §3) :
  - `api/_lib/transporteurs.js` `RYTHME_MS` : disponible **15 min** (avant 30), en route **1 h** (avant 2 h) ;
  - `api/_lib/colis-frequent.js` + `api/ship-reminders.js?moment=colis` + `.github/workflows/colis-frais.yml`
    (toutes les 15 min, 5 h–21 h 45 UTC) : trois lectures PROJETÉES `select=owner` (jamais `data`) trouvent
    les vendeurs qui ont une ligne due — `transp_` au point relais lu il y a plus de 15 min, `transp_` en route
    lu il y a plus d'1 h (non finis), e-mail « disponible » arrivé depuis moins d'un jour (sa première
    lecture) — et SEULS ceux-là sont visités, ordre tournant, 4 en parallèle, 100 s au plus, 200 vendeurs au
    plus ; chacun : `passageTransporteurs` avec ses garde-fous (une requête à la fois par transporteur,
    1,5 s d'écart, pause sur refus, User-Agent honnête), 6 lectures, 2 départs, 15 s. Sélection pas lue ⇒
    503, personne visité. Réponse : des nombres seulement. **Aucune fonction `api/` ajoutée** (12/12).
  - l'app : « Suivi vérifié il y a N min » sous les onglets de « À retirer » (`data-retirer-verifie`, la
    lecture réussie la plus récente des lignes `transp_`) ; une relecture serveur réussie sans changement
    relit maintenant les seules lignes `transp_` (`vrm:transp-lu`) pour que cette ligne dise vrai.
- Un colis vu « retiré » sort de « À retirer », de la carte, de Ma journée, de la cloche et du widget par la
  MÊME règle qu'avant (`pickupUnion` → `vrm_colis_retirer` ; le widget relit les `transp_`) : ce qui change,
  c'est qu'il est lu plus tôt.

## 3. Fréquences, avant / après

| quoi | avant | après |
|---|---|---|
| colis au point relais, app ouverte | demande toutes les 5 min, relu si lu il y a > 30 min | demande toutes les 5 min, relu si lu il y a > 15 min |
| colis en route, app ouverte | > 2 h | > 1 h |
| app fermée | cron 5 h et 18 h UTC seulement (2×/jour) | toutes les 15 min de 6 h à 23 h (Paris), vendeurs dus seulement, + les deux crons |
| premier colis arrivé (e-mail « disponible ») app fermée | lu au prochain cron (jusqu'à 13 h plus tard) | lu dans les 15 min |
| extension (`transpTick`, `capterSuivisAchats`) | inchangé : `transpTick` toutes les 30 min seulement quand le serveur est refusé ; suivi Vinted des achats 3/visite, 6/h, mémo 3 h | inchangé (budget de lecture 20/h tenu ; aucune version) |

Charge : chaque passage lit 3 listes `owner` filtrées sur `meta` (quelques Ko), puis, par vendeur dû,
les lignes projetées de `lireBaseTransp` (celles du passage « app ouverte ») ; aucun `select=data` sur
une ligne lourde. GitHub : 4 × 17 = 68 appels/jour (gratuit sur un dépôt public). Vercel : 68 invocations
de plus de `ship-reminders` par jour, aucune fonction de plus.

## 4. Preuves (§6)

- `scripts/audit-colis-frequent.cjs` (A1-A5, B, C1-C5 ; **exécute** la vraie route sur une fausse base
  PostgREST à état et de faux transporteurs) : **21 verts** ; `--prouve` **9/9** mutations rouges (témoin
  fini laissé double, « plus de témoin libre ⇒ encore peut-être », témoin pris deux fois, app sans `temoinActif`, carte qui épingle les douteux, rythme
  de 30 min, tous les vendeurs visités, « pas su = rien à faire », moment absent). Arbre `origin/main`
  (git archive, audit copié dedans) : **rouge** (A1-A5, B, C).
- `scripts/bancs/retraits-frais.cjs` (les deux captures, 390 tactile sombre + 1512 clair) : **34 verts** —
  18 moitiés Vinted (titres de sa capture : « Adidas spezial suède », « Nike P-6000 », « Wildleder Stiefel
  von… », « Zapatillas ADIDAS »…) au point de colis Mondial Relay RETIRÉS ; à Vannes un Chronopost à
  retirer et deux moitiés à côté. Onglet = publication = colonne = 2 (le Chronopost + la seconde moitié, sans
  témoin libre) ; la carte ne place que Vannes (une épingle « 2 ») ; « Comptés avec un autre colis » = 1,
  sa ligne « Compté avec le n°…21TS », aucun « peut-être », aucun paragraphe ; « À vérifier » = 1 ; aucun
  colis retiré nulle part ; les 18 moitiés dites « Fini avec le n°…0011 — Mondial Relay : retiré le 6 nov. »,
  les autres retirés dits par leur identité (« — par son code de retrait », « — par le n° de suivi de sa
  commande ») ; « Suivi vérifié il y a 10 min » ; « Relire compte_a · 3 j » et son
  geste ; voile de MapLibre `display:none`, indice bref qui s'efface.
  **Sur `origin/main` : 24 rouges** — la carte place 4 points (`1:aretirer`, `15:averifier`, `3:averifier`,
  `1:averifier`), « Peut-être en double · 20 » avec chaque ligne « À relier » et le paragraphe « Vinted annonce
  ces 20 colis… », « 1 compte à relire » sans nom, voile `flex` : les captures de Julien. Mutations de l'app (build + banc) : sans `temoinActif` ⇒ 3 rouges ; `surLaCarte` sans
  `nComptes` ⇒ 2 rouges ; voile rallumé ⇒ 1 rouge.
- Captures regardées : 390 sombre (en-tête, carte à une épingle, indice, puce nommée), sortis (8 lignes,
  les « Fini avec »), « Comptés avec un autre colis » (une ligne, son état), 1512 clair.
- Audits verts : build, `variables`, `tdz`, `coherence`, `identite`, `statuts`, `fonctions-api`,
  `retrait-preuves` (D3 accepte `temoinActif`), `achat-attend-relais`, `retraits-suivi`, `suivi-colis`,
  `retrait-fiable`, `cron-lots`, `statut-transporteurs`, `transporteurs`, `transp-notif`,
  `mondialrelay-serveur`, `transporteur-lu`, `colis-trois`, `codes-retrait`, `retrait`, `colis-prochain`,
  `icones`, `transp-ext`. `pagination-ordre` rouge AVANT ce chantier (api/_lib/pilotage.js:66, pas touché).
- Bancs voisins : voir §6.

## 5. Mesurer sur sa base (lecture seule, aucune donnée personnelle) — pour Julien

Remplacer `<UUID>` par son identifiant (Supabase → Authentication → Users).

```sql
-- 1. Les moitiés Vinted « t'attend » des 10 derniers jours, par code postal du point :
--    combien, sur combien de conversations, et combien d'une adresse reliée à aucun compte.
select substring(meta->>'lieu' from '\d{5}') as cp,
       count(*) as moities,
       count(distinct coalesce(meta->>'conv', id)) as conversations,
       count(*) filter (where data ? 'recuSur') as adresse_non_reliee
from app_data
where owner = '<UUID>' and id like 'email_track_autre_%' and meta->>'source' = 'vinted-commande'
  and meta->>'status' = 'available' and (meta->>'arriveLe')::timestamptz > now() - interval '10 days'
group by 1 order by 2 desc;

-- 2. Les colis de transporteur arrivés aux mêmes points, et ce que dit le transporteur.
select substring(e.meta->>'lieu' from '\d{5}') as cp, e.meta->>'carrier' as transporteur,
       coalesce(t.meta->>'etat', 'pas lu') as etat_transporteur, count(*) as colis
from app_data e
left join app_data t on t.owner = e.owner and t.id like 'transp_%' and t.meta->>'suivi' = e.meta->>'suivi'
where e.owner = '<UUID>' and e.id like 'email_track_%' and e.meta->>'source' is distinct from 'vinted-commande'
  and coalesce(e.meta->>'suivi', '') <> '' and (e.meta->>'arriveLe')::timestamptz > now() - interval '10 days'
group by 1, 2, 3 order by 1, 4 desc;
```
Attendu après ce chantier : une moitié du point dont le transporteur dit `retire` n'est plus « en double ».
Si la requête 1 montre beaucoup plus de moitiés que de conversations, c'est un autre défaut (une moitié
par e-mail au lieu d'une par colis) : à regarder avec le chantier `claude/transporteurs-emails`.

## 6. Bancs voisins (lancés un par un sur le build final)

Verts : `retraits-suivi` 39, `statut-colis` 81 (C13 mis à jour : « Compté avec le n°… », plus de
paragraphe), `retirer-carte-delai` 111 (mis à jour : Quimper « à vérifier » n'a plus d'épingle et reste
visible sous « À vérifier »), `colis-villes` 46, `colis-retirer-propre` 129.
Rouges AVANT ce chantier, autant sur `origin/main` (même nombre) : `retrait-relais-carte` 11,
`carte-stable` 3, `retrait-carte` 3, `relais-telephone` 3, `retrait-autre-ville` 5 (chantier
`claude/zero-banc-rouge`).

## 6 bis. D'où viennent les 18 « peut-être en double » (17 h 24) — mesuré dans le code

Une moitié Vinted (`email_track_autre_conv-*`, `source: 'vinted-commande'`) devient un candidat au doute
quand (`regrouperArrivees`) : (a) sa conversation ne mène à AUCUN achat relu (`achatParConversation` sur
`buysBase` = les achats des comptes Vinted RELIÉS et relus par l'extension), ou (b) l'achat est trouvé mais
n'a ni n° de suivi ni code connus (`sansIdentite`). Mesuré le 6 nov. : 18 des 19 arrivent sur une adresse
qu'aucun compte relié ne porte ⇒ cas (a) : l'achat est sur un compte Vinted que VRM ne lit pas, donc
`capterSuivisAchats` (suivi Vinted de l'achat, 5.217) ne peut pas le lire — l'extension ne lit que le compte
connecté dans l'onglet et ses achats relus. Pistes de Julien :
1. l'achat Vinted fait foi : appliqué quand l'achat est RELU (sa fin ⇒ sorti, `finCommandeAchat` ; son n° ou
   son code ⇒ un seul colis, `finParIdentite`/`fusionnerParCode`, inchangés) ;
2. au point relais sans n° ni code (b) ⇒ maintenant tranché par « un témoin = un carton » (compté avec le
   colis du transporteur, ou à retirer) — jamais deux fois ;
3. relecture automatique : impossible sans le compte (aucune version d'extension montée, 5.340.0 reste
   libre) ; le geste qui la rend possible est dit sur la puce « Relire … » et sous « À retirer » (adresse non
   reliée : « Paramètres → Comptes liés ») ;
4. il ne reste aucun « peut-être » : chaque moitié est comptée avec un colis, finie avec lui, ou à retirer.
Requête de mesure : §5, requête 1 (les moitiés par point, et combien d'une adresse non reliée).

## 7. Ce qui reste

- Les moitiés Vinted d'une adresse reliée à aucun compte n'ont toujours AUCUNE identité vers le colis du
  transporteur : la règle « un témoin = un carton » tranche le COMPTE (jamais l'identité : la moitié n'hérite
  ni du code, ni du n°, ni de la photo du témoin). Le geste qui les relie pour de bon : relier l'adresse (E-mails → Relier
  ma boîte) ou relire le compte d'achat sur Vinted.
- L'extension n'a pas été rendue plus fréquente (budget de lecture 20/h, mémo de 3 h des suivis Vinted) :
  le serveur suffit pour Chronopost, Vinted Go et Mondial Relay ; l'extension reste le secours.
- Le passage « colis » s'arrête la nuit (23 h → 6 h Paris) : un colis retiré à minuit sort au premier
  passage de 6 h (ou à l'ouverture de l'app).

## Gestes de Julien

1. `CRON_SECRET` dans les secrets GitHub (déjà demandé pour /statut, geste n° 7 de la passation générale) :
   sans lui, le passage « colis » toutes les 15 min ne tourne pas (le journal GitHub le dit) — le statut
   reste relu app ouverte et à 6 h / 19 h.
2. Facultatif : lancer les deux requêtes du §5 et nous donner les nombres.
