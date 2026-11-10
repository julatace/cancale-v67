# 10 nov. — Colis à réceptionner irréprochables (branche `claude/retraits-irreprochables`)

Julien, mot pour mot : « je veux que tu améliores les Colis à réceptionner avec les codes de retrait et etc.
il faut vraiment quelque chose de parfait, d'irréprochable, il doit y avoir aucune erreur, impossible que ce
soit sur les messages, les mails et la lecture sur Vinted directement. »

Extension : **rien changé** (aucune version montée ; la lecture Vinted n'avait pas d'écart). Aucune fonction
`api/` ajoutée (12/12). Zones des autres agents non touchées.

## 1. Mesure d'abord (vraie base, lecture seule, données jamais versées au dépôt)

Outil SQL Supabase en lecture seule, projections seulement (jamais `select=data` sur une ligne lourde ; les
commandes lues par `jsonb_array_elements` projeté). Puis un banc LOCAL (hors dépôt) qui rend la vraie app
construite sur une copie de ses lignes (e-mails de suivi, lectures transporteur, suivis Vinted, commandes,
conversations, bordereaux, états de transaction) : « ce que VRM affiche » est mesuré, pas déduit.
Le tableau de rapprochement complet (colis · VRM · chaque source · écart) est resté hors du dépôt.

- **97 colis** entrants vérifiés (preuve d'arrivée depuis le 20 oct.), chacun par toutes ses identités :
  n° de suivi, n° de transaction (commande ← conversation de l'e-mail Vinted), code de retrait.
- Sources croisées : e-mails (transporteurs et Vinted), lectures chez le transporteur (`transp_*`), suivi
  Vinted des achats (`harvest_*_suivi_*`), commandes Vinted, conversations (`panel_colis_relais`), SMS
  (**0 ligne SMS en base** : la voie SMS n'est pas utilisée chez lui).
- VRM affichait : **0 à retirer, 2 à vérifier, 2 en route (point changé), 33 sortis** — identique à la
  publication de production (`vrm_colis_retirer`). Vérité des sources : 0 colis encore au point prouvé ;
  les 2 « à vérifier » sont deux colis postaux internationaux (S10 « …IE ») au point depuis 11-13 jours,
  que Vinted dit encore « déposés » et qu'aucun transporteur ne sait lire — bien rangés.

| type d'écart | trouvés | état |
|---|---|---|
| colis déjà retiré encore affiché | 0 | — |
| colis arrivé absent | 0 affiché, **2 latents** (le prochain e-mail l'aurait déclenché) | corrigé (D1) |
| code manquant (connu par une autre source) | 0 (forme possible : e-mail sans code, conversation avec) | corrigé (D5) |
| code faux / d'un autre colis | 0 (5 consignes : code e-mail = code conversation) | désaccord désormais dit (D5) |
| mauvais point relais | 0 affiché, **2 latents** (nouveau point effacé à l'arrivée) | corrigé (D3) |
| date limite fausse | 0 | — |
| transporteur faux | 0 affiché (les lignes « chronopost » jamais lues des n° S10 sont ignorées depuis le 6 nov.) | — |
| doublon | 0 | — |
| changement de point | **2** : jamais relus chez le transporteur depuis 14 h et 36 h | corrigé (D2) ; alerte contradictoire corrigée (D4) |
| renvoyé à l'expéditeur / expiré | 0 | — |
| e-mail mal classé | **1** « le colis semble avoir été perdu » rangé « livré / retiré » (ligne d'avant la règle du 3 nov.) | corrigé (D6) |
| pas su (aucune identité) | 17 moitiés Vinted d'une adresse sans compte relié, finies avec leur témoin (décision du 9 nov., 17 h 24) | inchangé, dit |

## 2. Les défauts et leur cause (corrigés à la règle, jamais un cas particulier)

- **D1 — un faux « retiré » retenait le colis.** Deux colis Mondial Relay « Votre colis a changé de plan 📍 »
  étaient rangés `delivered` en base (rangés avant la règle du 10 nov. matin). La route garde « un retiré
  reste retiré » (`conserverRetrait`) en lisant le statut BRUT de la ligne d'avant : l'e-mail suivant
  (« disponible » au nouveau point, avec son code) aurait été rangé `delivered`, avec le sujet « changé de
  plan », donc relu « en route » — le colis arrivé n'aurait été nulle part. Règle : `retraitTenu(precedent)`
  (api/_lib/etat-colis-email.js) — un « retiré » ne tient que si SON sujet le dit encore (§5 : le sujet
  d'abord) ; un changement de point ou un colis perdu ne retient rien. Sert à la route e-mail (état, sujet
  gardé, `retireLe`) et aux trois voies SMS (même fonction).
- **D2 — un colis redirigé n'était plus relu chez le transporteur.** `sensDeLigne` ne reconnaît le sens que
  par le sujet ; « changé de plan » n'est ni entrant ni sortant ⇒ `suivisAInterroger` l'écartait (mesuré :
  ces deux n° lus il y a 14 h et 36 h, les autres en route il y a 1-4 h). Règle : un changement de point
  (`relaisChange` ou le sujet) est un colis REÇU (le code de retrait y est écrit), sauf le n° d'un de ses
  bordereaux (déjà écarté avant).
- **D3 — le nouveau point effacé à l'arrivée.** `fusionTransporteur` remplaçait le lieu de la ligne par celui
  du transporteur — vide chez Mondial Relay (mesuré : `lieuNom` vide sur ses lectures). Règle : pour une
  ligne `relaisChange`, le point lu dans l'e-mail du MÊME n° (une identité) reste ; une ligne « en route »
  ordinaire ne donne jamais son lieu (rien de deviné).
- **D4 — « Point relais changé · pas encore arrivé » à côté du même colis « à retirer ».** L'alerte ne lisait
  que les e-mails. Règle (`colisRelaisChange`, `transp`) : un n° que le transporteur dit disponible, retiré
  ou reparti par un événement daté APRÈS l'e-mail du changement n'est plus annoncé en route.
- **D5 — le code : une source, choisie en silence.** La carte d'un e-mail ne montrait que le code de
  l'e-mail : celui de la conversation de SA commande était ignoré (seul : « Code à venir » alors qu'il est
  connu ; différent : choix silencieux). Règle (src/sourcesRetrait.js, `verdictCode`) : les codes LUS par
  identité (e-mails/SMS du n° — le plus récent daté fait foi entre eux, l'ancien est dit « remplacé » — et la
  conversation de la commande reliée par n° de suivi, code ou conversation) ; deux voix indépendantes
  (source + émetteur ; un rappel du même transporteur n'est qu'une voix) au même code ⇒ **sûr** ; deux codes
  différents ⇒ **aucun choisi**, les deux valeurs et leur source, en ambre. Même verdict pour la carte, son
  détail, « En grand », le mode relais en ligne et hors ligne (`vrm_codes_hors_ligne`). Deux lignes du même
  n° fondues gardent chacune ce qu'elles disaient (`codesLus`).
- **D6 — « le colis semble avoir été perdu » rangé « livré ».** La règle du 3 nov. ne relisait pas les lignes
  d'avant. `relireLigneSuivi` : une ligne `delivered` dont le sujet dit « perdu » redevient une information
  (« Colis perdu (d'après Vinted) »), sans date de retrait.

## 3. L'affichage (Colis → À retirer, DA6, peu de texte)

Sous le titre de chaque colis, en petit gris : ses **sources** (Vinted · e-mail · message · SMS ·
transporteur) et « **vérifié à 09:40** » (la plus récente des lectures datées : e-mail reçu, lecture chez le
transporteur, conversation lue, achats relus ; rien de daté ⇒ rien). Le bouton « Code » porte une **coche**
quand le code est sûr. Deux codes en désaccord : bouton ambre « **2 codes** », et dans le détail « Deux codes
différents — vérifie sur place » avec chaque valeur et sa source ; jamais « code à venir », jamais « code pas
lu ». Le logo du transporteur reste sur la vignette (src/transporteursVisuels.js).

## 4. Preuves (§6)

- `scripts/audit-retraits-irreprochables.cjs` : **48 vérifications vertes** (A règle du faux retrait, B la
  VRAIE route e-mail exécutée sur une fausse base à état, C relecture « perdu », D sélection transporteur,
  E fusion transporteur, F verdict du code, H alerte, G branchement). Arbre `origin/main` (git archive) :
  **27 rouges** (§F n'y tourne pas : le module n'existait pas — compté une fois). `--prouve` : **14/14 mutations rouges**.
- `scripts/bancs/retraits-irreprochables.cjs` (cinq colis inventés de la vraie forme, 390 tactile sombre +
  1512 clair) : **28 verts** ; build d'`origin/main` : **16 rouges** ; build muté (désaccord tranché ⇒ 1
  rouge ; nouveau point perdu ⇒ 1 rouge). Captures regardées : 390 sombre (marques, coche, « 2 codes » ambre,
  détail du désaccord), 1512 clair (idem).
- Banc local sur la copie réelle (hors dépôt) : avant/après identiques sur ses données d'aujourd'hui (0 à
  retirer, 2 à vérifier, 2 en route redirigés, 33 sortis) ; les cartes « à vérifier » disent « Vinted ·
  message · vérifié le 7 nov. ».
- Audits relancés verts : `codes-retrait` (sa fusion extraite reçoit `codeLuDeLigne`), `relais-change`
  (l'alerte lit aussi `transpMap`), `retrait-preuves`, `retraits-suivi`, `suivi-colis`, `colis-frequent`,
  `retrait-fiable`, `retrait`, `colis-retrait`, `retrait-conv`, `arrivee-colis`, `achat-attend-relais`,
  `colis-sens`, `variables`, `tdz`, `coherence`, `identite`, `icones`, `statuts`, `fonctions-api`. Bancs
  relancés : voir §6.

## 5. Ce qui reste

- **17 moitiés Vinted sans identité** (adresse de réception reliée à aucun compte) : finies avec leur
  témoin par proximité (point et date), la règle du 9 nov. Le seul moyen d'en faire des identités : relier
  l'adresse qui reçoit ces e-mails à son compte Vinted (E-mails → Relier ma boîte) ou relire ce compte sur
  vinted.fr. **Geste de Julien.**
- **Deux colis postaux internationaux** (S10 « …IE ») « à vérifier » depuis 11-13 jours : aucun transporteur
  lisible ; seul Vinted dira s'ils ont été retirés (relire le compte de ces achats sur vinted.fr). **Geste.**
- Le passage « colis » toutes les 15 min reste suspendu au `CRON_SECRET` GitHub (lot AK) : app fermée, les
  deux colis redirigés ne sont relus qu'au cron du matin/soir. **Geste : `CRON_SECRET`.**
- Les lignes déjà rangées « livré » par un « changé de plan » se corrigent à la relecture et au prochain
  e-mail ; aucune migration de données (§5).
