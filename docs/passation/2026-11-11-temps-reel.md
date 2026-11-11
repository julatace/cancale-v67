# 11 nov. 2026 — Ce que l'extension capte arrive sans recharger (second agent, `claude/agent2-temps-reel`)

Demande de Julien : « quand l'extension capte de nouvelles infos, pas besoin de recharger VRM pour que
ces données apparaissent ». Branche `claude/agent2-temps-reel` (depuis `origin/main`), poussée à chaque
commit ; pas de PR, pas de fusion (l'agent principal intègre). Pas d'extension.

## 1. Ce qui change pour Julien
- VRM ouvert et visible (Mac, iPhone…) : une vente, un achat, une annonce que l'extension capte —
  depuis CE navigateur ou un AUTRE — apparaissent tout seuls, en **moins de 25 s** (mesuré au banc :
  16 à 22 s), sans recharger. Une petite pastille flottante grise dit **« Mis à jour à 14:32 »** pendant
  6 s ; elle ne pousse rien (rien ne saute à l'écran).
- Après la migration 040 (geste ci-dessous) : dans la seconde, et la base est moins sollicitée.

## 2. Ce qui existait (mesuré sur `origin/main`)
| quand l'app relit ce que l'extension écrit | ventes | achats | annonces | jauge / import |
|---|---|---|---|---|
| au montage de l'écran | oui | oui | oui | oui |
| retour sur l'onglet (≥ 20 s d'absence) | oui | oui | oui | oui |
| signal `vrm:ext` (extension dans CE navigateur seulement) | oui | oui | oui | import |
| à intervalle, onglet visible | sonde 60 s (Ventes, Journée, Colis, Messages) | — | — | 60 s |

⇒ sur l'iPhone, ou quand la capture vient d'un autre Mac, une annonce ou un achat n'arrivait **jamais**
à un écran resté ouvert. Banc sur `origin/main` : Annonces « jamais (35 s) », Ma journée « jamais ».

## 3. La règle (`src/tempsReel.js`, `src/VeilleTempsReel.jsx`)
- **La veille** : toutes les 25 s, onglet visible seulement (rythme commun `rythmeLectures` : rien
  quand l'onglet est caché, ×5 quand personne n'y touche, tout de suite quand la main revient), UNE
  lecture des **versions** des lignes du vendeur écrites dans les 10 dernières minutes :
  `owner=eq.<uid>&or=(updated_at.gt.X,meta->>capturedAt.gt.X,meta->>purgedAt.gt.X)&select=id,updated_at,cap:meta->>capturedAt,rev:meta->>rev,sup:meta->>supprime,pg:meta->>purgedAt`
  — scalaires seulement (§4.4), toutes les pages (§4.5). Mesuré sur la vraie base (lecture seule) :
  9 lignes écrites en 10 min, toutes familles et tous vendeurs confondus ⇒ ~1 à 7 Ko par lecture.
- Une ligne dont la **version a changé** ⇒ un signal `vrm:neuf` { ids, quoi, uid } — familles :
  `orders_sold`/`txn_*` → ventes, `orders_purchased` → achats, `listings`/`enligne` → annonces,
  `suivi_*`, `transp_*`, `import_vinted_*`, `actions_compte_*` (jauge), `journal_vrm_*`. Le bruit
  (`wreq_*`, `seen_urls`, `profile`…) n'est jamais signalé.
- L'écran relit par **son chemin habituel** (le même que le signal de l'extension `vrm:ext`) : ventes
  et achats du SEUL compte touché (les autres comptes, confirmés inchangés par la veille, restent
  servis), dressing par le lot K (version ⇒ la seule ligne changée), jauge, import. Seules les
  lectures mémorisées de CES lignes sont oubliées (`viderMemoLignes`), jamais toute la mémoire.
- **Budget** : jamais plus d'un signal par ligne toutes les 10 s (un second changement trop proche part
  à la fin du délai, regroupé).
- **Lecture ratée** ⇒ rien : aucun signal, aucune version oubliée, rien vidé ; l'écran garde ce qu'il
  montre (`listePlusRiche`, « lecture ratée n'écrit rien » restent ceux des lecteurs).
- **Premier passage** (4 s après l'ouverture) : ce qui était là AVANT l'ouverture n'est pas « neuf »
  (l'écran vient de le lire) ; ce qui a été écrit depuis l'est.
- **Cloisonnée** par compte VRM : uid dans le filtre, le sujet du canal, chaque message (l'app vérifie
  `owner`) ; déconnexion / autre vendeur ⇒ la veille et le canal s'arrêtent (`arreter`, `fermer`).
- Elle n'écrit rien et ne publie aucune notion : les publieurs restent les mêmes.
- Limite connue : une ligne écrite par un appareil dont l'horloge retarde de plus de 10 min n'est pas
  vue par la veille (elle l'est au retour sur l'onglet, comme avant).

## 4. Supabase Realtime : migration 040 (préparée, PAS appliquée)
Mesuré (lecture seule) : la publication `supabase_realtime` existe et **ne contient aucune table**.
Ajouter `app_data` à la publication (`postgres_changes`) aurait envoyé la ligne ENTIÈRE (`data`,
PDF compris) à chaque écriture : refusé (§4.4). À la place, `supabase/migrations/040-temps-reel.sql` :
- un déclencheur `after insert or update` sur `app_data` diffuse par `realtime.send` UNIQUEMENT
  `{id, owner, updated_at, cap, rev, sup, pg}` sur le sujet privé `vrm-lignes:<owner>` ; une
  diffusion en panne n'empêche jamais l'écriture (bloc `exception`) ;
- une règle sur `realtime.messages` : un connecté ne reçoit que `vrm-lignes:<son uid>` ;
- `vrm_temps_reel()` (lecture, connectés seulement) : l'app n'ouvre la prise Realtime QUE si elle
  répond `true` — avant la migration, et dans les bancs, **aucune prise n'est ouverte** (garde réseau).
- Côté app : le protocole Phoenix écrit à la main (`ouvrirCanal`, aucune dépendance) ; jonction
  refusée ⇒ plus de tentative pendant cette ouverture ; dès qu'un message est arrivé, le sondage
  ralentit à 2 min (il reste en filet, jamais arrêté).
- `scripts/audit-temps-reel-sql.cjs` l'exécute sur un Postgres jetable (schéma `realtime` imité) :
  15 verts ; `--prouve` 4/4 mutations rouges (`data` diffusée, sans bloc d'exception, interrupteur
  ouvert aux anonymes, règle ouverte). Le garde « sans propriétaire » est doublé (un sujet nul fait
  échouer la diffusion, rattrapée) : sa mutation reste verte, c'est voulu.
- **Essai annulé sur la vraie base : pas joué** — l'outil SQL attend une confirmation humaine pour
  les `DROP` et personne n'a répondu dans le délai. Rien n'a été écrit. Le script est prêt.

## 5. Preuves
- `scripts/bancs/temps-reel.cjs` (390 tactile clair, 1512 sombre ; `PASSES=390s,1512c` inverse) : l'app
  est ouverte, le banc écrit une ligne dans la base inventée SANS aucun signal dans la page :
  V Ventes (vente neuve à l'écran), A Annonces, J Ma journée (ligne relue), B budget (au calme
  seulement des versions ; après l'écriture seule la ligne du compte touché, < 600 Ko), P pastille
  flottante, K versions en 503 ⇒ l'écran garde ce qu'il montre, aucune écriture de moisson.
  - après : **13 verts, 0 rouge** à 390 (vente 21 s, annonce 16 s, journée 18,5 s ; au calme
    1 lecture de versions / 28 s, 7 Ko ; après l'écriture 9 lectures, 193 Ko dont 182 Ko = les
    commandes du seul compte touché) ; 1512 : voir §5 bis.
  - `origin/main` (`git archive`, banc copié dedans) : **5 rouges** (Annonces jamais, Ma journée
    jamais, aucune pastille, aucune lecture de versions). La vente arrive en 21 s grâce à la sonde de
    60 s déjà là (Ventes seulement).
  - mutation « abonnement coupé » (`vrm:neuf` plus écouté) : voir §5 bis.
- `scripts/tests/temps-reel.test.mjs` 9/9 (familles, premier passage, lecture ratée, budget 10 s,
  fenêtre bornée, arrêt, canal : sujet privé + jeton, message d'un autre vendeur ignoré, refus ⇒ plus
  de tentative).
- Audits verts : variables, tdz, coherence, identite, icones, lectures-lourdes, fonctions-api,
  pagination-ordre. `npm run build` OK.

## 6. Gestes de Julien
1. (Facultatif, recommandé) **Migration 040** : dans l'éditeur SQL de Supabase, coller d'un bloc
   `scripts/temps-reel-sql/essai-annule.sql` ⇒ attendu `{"trig":1,"pol":1,"fn":true,"msg":1}` puis
   `0|0|0`. Puis coller `supabase/migrations/040-temps-reel.sql` (VRM peu sollicité : verrou court sur
   `app_data`), puis `scripts/temps-reel-sql/verifier.sql` ⇒ `ok = true`.
   Sans elle, tout marche déjà (≤ 25 s). Pour revenir en arrière : le bas du fichier 040.
2. Rien d'autre (pas d'extension à installer).

## 7. Ce qui reste
- Messages (boîtes de réception), Leboncoin, Vestiaire, e-mails : la veille ne les signale pas encore
  (familles laissées hors de `quoiDe`, leurs écrans gardent leurs relectures) — à ajouter famille par
  famille si Julien le veut, en mesurant leurs lecteurs.
- La sonde de 60 s des ventes (`sonde-ventes`) fait doublon avec la veille : laissée (aucune ligne
  partagée touchée sans besoin) ; à retirer à l'intégration si l'agent principal le souhaite.
- Le canal Realtime n'a été joué que contre une fausse prise (tests) : à regarder une fois la 040
  posée (`data-temps-reel="joint"` sur `<html>`).
