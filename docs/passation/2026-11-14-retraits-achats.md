# 14 nov. (soir) — « Je n'ai plus les retraits d'achat, je ne comprends pas »

Julien, mot pour mot : « je n'ai plus les retraits d'achat, je ne comprends pas ». Branche `claude/retraits-achats`
(depuis origin/main c084e3bf). Aucune donnée réelle dans ce récit : chiffres et formes seulement.

## Mesures (vraie base, lecture seule, projections `meta->>` et scalaires)

Propriétaire principal, le 14 nov. vers 20 h (heure de Paris) :

- **Achats lus par l'extension** : 15 lignes `harvest_*_orders_purchased` ; 6 comptes relus le 14 nov. (19 h 46–19 h 55),
  le grand compte (2 001 achats) et un autre le 11 nov., un le 10 nov., les autres plus anciens.
- **Achats « déposé en point relais »** (`isAtRelayStatus`) : 16 (7 + 3 + 6 sur trois comptes). Code de retrait lu
  dans leur conversation (`panel_colis_relais`) : **1 sur 16** (un Vinted Go, code lu le 13 nov., transporteur
  « disponible »). Les 15 autres : 9 dont le n° de suivi est « retiré » chez le transporteur (fin prouvée), 6 sans
  code ni fin — reliés par leur conversation à des e-mails Vinted « t'attend » sans code.
- **E-mails de suivi `email_track_*` « disponible » depuis le 3 nov.** : 49 Mondial Relay avec code et n°
  (**47 « retiré » chez le transporteur** — « Colis livré au destinataire », la plupart le jour même —, **2 du
  matin du 14 nov. sans aucune lecture transporteur**), 3 Chronopost (transporteur « Livraison effectuée »),
  5 Vinted Go (retirés), 48 e-mails Vinted (`autre`) sans n° de suivi, dont 44 sans code.
- **Retours (440)** : aucun nouveau sur ces achats.
- **Ce que l'app a calculé sur son appareil** (publication `vrm_colis_retirer` dans `main`, écrite à 19 h 55 le
  14 nov.) : `total 3 · prets 3 · aVerifier 5 · enVerification 1 · urgents 0` — les 3 = les 2 Mondial Relay du
  matin + le Vinted Go, **chacun avec son code** ; les 5 « à vérifier » = des e-mails Vinted sans code.
- Réglage de la carte (`vrm_carte_stats`) : rien de posé pour Achats ⇒ la bande par défaut (Dépensé · En route ·
  À retirer · Arrivés).

⇒ **La règle n'a rien perdu** : 3 colis réellement au point avec leur code devaient être « À retirer », ils l'étaient
(et Ma journée disait « 3 colis à retirer »). Aucun colis écarté par la règle « sans code ⇒ À vérifier » à tort, aucune
fin prouvée à tort, aucune lecture d'achats trop ancienne pour ces 3-là.

## La cause : l'affichage d'Achats (refonte du 14 nov.)

La refonte d'Achats (`2026-11-14-refonte-achats.md`) a rangé toute la section « À retirer » (points, codes, QR, mode
relais, outils) dans `RepliRetirerAchats`, **fermé par défaut**. Sur Achats · Vinted (`sansLigne`), la ligne du repli
est même **cachée** quand il est fermé : il ne restait que le chiffre « 3 · À retirer » dans la bande de chiffres
(une case qui ouvre le repli, mais rien ne le dit). Ses 3 colis et leurs codes avaient disparu de l'écran où il les
cherche. Les colis « à vérifier » (dans le même repli) n'étaient plus visibles du tout. §5 : un colis caché est un
colis perdu.

Banc `achats-retraits` (vert sur origin/main) ne le voyait pas : il vérifie que la section précède la liste dans le
DOM (`compareDocumentPosition`), pas qu'elle est VISIBLE (§6.2 : regarder la capture fait partie du test).

## Correction (règle minimale, aucun nouveau dessin)

`src/repliRetirer.js` (nouveau, pur) — `etatRepliRetirer(pub, { choix, demande })` et `choixApresBascule` :

- **au moins un colis à retirer ⇒ OUVERT, en tête d'Achats** (codes visibles) ;
- il peut le refermer ; ce choix ne vaut **que pour la liste de colis qu'il avait sous les yeux** (empreinte des
  identités publiées, `f:{empreinte}`) : un colis de plus ou un autre ⇒ rouvert ; l'ancien « fermé » (`'0'`, d'avant)
  ne cache jamais un colis à retirer ;
- ouvert par lui (`'1'`) ou venu pour un retrait (Ma journée, notification : `vrm:retirer-ouvrir`) ⇒ ouvert ;
- rien à retirer ⇒ fermé (la liste d'abord, AJOUT 3) ; s'il reste des colis « à vérifier » (+ en vérification), la
  ligne reste **visible** sur Achats · Vinted avec « + N à vérifier » (texte existant `journee.verifier2`) ;
- publication pas lue ⇒ rien décidé sur un nombre inconnu.

`src/App.jsx` (`RepliRetirerAchats`) lit cette règle ; `src/styles-achats-photos.css` : une ligne de style pour le
« + N à vérifier ». `src/nouveautes.js` : « Tes colis à retirer, en tête d'Achats ». Aucune règle de retrait
(`pickupUnion`, preuves, codes) n'est touchée. Ma journée disait déjà « 3 colis à retirer » (sa tuile mène à Achats,
qui s'ouvre) : vérifié au banc (R6).

Pour l'agent du design (`claude/studio-ventes`) : seul le corps de `RepliRetirerAchats` change, et le défaut du repli
devient une règle importée — garder `etatRepliRetirer` / `choixApresBascule` si le repli est redessiné.

## Preuves

- `scripts/audit-repli-retirer.cjs` : règle EXÉCUTÉE, 13 verts ; `--prouve` **6/6 mutations rouges** (fermé par
  défaut, ancien « 0 » qui cache, fermer pour toujours, empreinte sans colis, « à vérifier » oublié, l'app sans la
  règle). Rouge sur l'arbre d'avant (le fichier de la règle n'existe pas).
- `scripts/bancs/achats-retirer-visible.cjs` (forme mesurée, données INVENTÉES : 3 à retirer — 2 Mondial Relay du
  matin + 1 Vinted Go au code de sa conversation —, 5 e-mails Vinted sans code, 12 Mondial Relay retirés au même
  point, 1 000 achats finis ; 390 tactile clair + sombre, 1512) : **18 rouges sur le build d'origin/main**
  (R1 ouvert / codes visibles / en tête, R2 ancien « fermé », R4 colis de plus, R5 « à vérifier » nommés — à chaque
  taille) ; **54 verts après** (captures regardées : « À retirer · 3 » en tête, Tabac du Port C00001/C00002,
  Vinted Go V12345 ; à 0, « À retirer + 5 à vérifier › » au-dessus de la liste). Rejoué après le merge d'origin/main :
  vert jusqu'à un arrêt du navigateur faute de mémoire (machine partagée), sans rouge.
- Verts : build ; audits repli-retirer, codes-retrait, retrait-fiable, retrait-vinted-go, suivi-colis,
  nom-paire-retrait, identite, tdz, variables, traduction, quoi-de-neuf, coherence ; bancs achats-retraits (84),
  garde-ecrans, retirer-nom-paire (44), retrait-autre-ville.
- Rouges **déjà rouges sur origin/main, à l'identique** (rejoués depuis un arbre `git archive` d'origin/main) :
  refonte-achats P5 (temps de recherche, 548–824 ms sur une machine chargée), retirer-scene-julien (QR / fiche),
  retraits-fiables F7, retraits-irreprochables R1 + un clic, achats-messages-premium, retrait-carte, retrait-lieux,
  retirer-vinted-go (6). Aucun n'est touché par ce correctif ; à reprendre à part.
- Un piège du banc lui-même, noté : deux colis inventés au MÊME code de retrait sont UN colis (le code est une
  identité, §5) — un code « retiré » ailleurs les faisait sortir ; les codes du banc sont distincts.

## Geste de Julien

Aucun. Ouvrir Achats : « À retirer » est en tête, ouvert, avec ses codes. (Rien à installer : l'extension n'est pas
en cause, ses lectures d'achats et de codes arrivent.)
