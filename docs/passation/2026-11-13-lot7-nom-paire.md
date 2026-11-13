# 13 nov. — Lot 7 : le nom de la paire sur chaque colis à retirer

Demande de Julien (point 7) : **chaque colis à retirer (Colis/Achats → À retirer, Ma journée, widget iPhone) porte le
nom de la paire qui est dedans** (titre de l'achat + photo), au lieu de « Colis Mondial Relay ». Règle §5 : relié
UNIQUEMENT par identité (n° de suivi, code de retrait, n° de transaction, conversation de SA commande) ; mieux vaut
« Colis {transporteur} » qu'un faux nom.

Branche `claude/lot7-nom-paire` (partie de `origin/main` 1fd4c452). Base de production en lecture seule (SQL
projeté). Fixtures inventées. `vinted-sync-extension/` pas touché.

## 1. Mesure (lecture seule, 13 nov. au soir)

**La dernière photo publiée** (`vrm_colis_retirer`, 13 nov. 18 h 56 UTC) : **12 colis à retirer**.

| colis | identité trouvée en base | nom possible |
|---|---|---|
| 4 e-mails Vinted « Commande mise à jour pour … » (Intermarché ×2, Maison de la Presse, Super U) | la **conversation** de la commande (`conv` de l'e-mail = `conversation_id` de l'achat) | oui (4) |
| 4 Mondial Relay (88033064, 88196607, 43264289, 43269495) | le **n° de suivi** dans `harvest_{uid}_suivi_{tx}` (lu par l'extension, source `journey`) | oui (4) |
| 1 Mondial Relay (42538470) | aucune : sa commande n'a pas de ligne de suivi, l'e-mail ne porte ni titre ni n° de commande | non |
| 3 Chronopost / DPD Pickup (07294012928553, 08448881184010, 09447440008085) | aucune : n° de 2e étape d'un envoi international (la ligne de suivi Vinted, quand elle existe, porte le n° de 1re étape `CP…IE` / BRT) ; les e-mails Pickup disent seulement « Expéditeur : VINTED » | non |

⇒ **8 sur 12 reliables par identité** ; ce qui était affiché avant ce lot :

| écran | avant | après |
|---|---|---|
| Colis → À retirer (titre) | 8/12 (le titre suivait déjà `cmdParColis`) | 8/12 |
| Colis → À retirer (photo) | 4/12 (n° de suivi seul) | **8/12** (+ les 4 reliés par conversation) |
| Mode relais | 8/12 | 8/12 (+ un Vinted Go relié par son code, cas mesuré ailleurs) |
| Ma journée (case « À retirer ») | aucun nom (pile de photos) | **les noms** (deux au plus, « et N autres ») |
| Ma journée hors ligne, codes hors ligne | 4/12 (titre de l'e-mail seul) | **8/12** |
| Widget iPhone (`api/widget.js`) | 0/12 (un nombre) | **8/12** (`pickupColis`, les 4 autres « Colis Mondial Relay / Chronopost ») |

**Sur 30 jours** (lignes « disponible » des e-mails depuis le 14 oct.) : 129 lignes ; **81 reliables par identité**
(47 par conversation, 30 par n° de suivi, 10 par code, recouvrements compris) — avant ce lot, les écrans hors
« Colis » n'en nommaient que 47 (le titre de l'e-mail), la carte 77 (n° de suivi ou titre de l'e-mail) ; 4 lignes
reliées par le **code seul** (Vinted Go) restaient « Colis Vinted Go » partout sauf dans le titre de Colis.
**Les 48 lignes sans lien ont toutes un n° de suivi** (MR 32, Vinted Go 10, Chronopost 6) que **aucune ligne de suivi
Vinted ne porte** : 30 achats « expédiés » sur les comptes lus n'ont pas de `harvest_*_suivi_*` (jamais relus), et
les colis internationaux changent de n° en France.

Identités cherchées et absentes : e-mails transporteurs (aucun titre, aucun n° de commande — Chronopost/DPD dit
« Expéditeur VINTED »), `email_texte_*` (« Où vous livrer… » : n° seul), `email_reception_*` (résumé : n°, code),
conversations `harvest_*_conv_*` et transactions `harvest_*_txn_*` (aucun des 4 n° manquants ; un code « 783858 »
trouvé dans une transaction d'un autre compte : un nombre de hasard, pas une identité — non utilisé),
`transp_*` (événements du transporteur, pas de référence Vinted). **Aucune identité neuve exacte n'existe en base pour
les 4 colis sans nom** : elle ne peut venir que de l'extension **5.372** (panneau « Détails » : n° de suivi de la
dernière étape et point) ; ses extensions sont en 5.368 / 5.336 / 5.329. Tant qu'elle n'est pas installée, l'app dit
« Colis Mondial Relay » / « Colis Chronopost Pickup », sans rien inventer.

## 2. Ce qui change

- **Une jonction, partout** : `commandeRetrait(t)` (src/App.jsx, juste après `pickupUnion`) = la commande de
  `pickupUnion.cmdParColis` (conversation, n° de suivi, code — `commandeDuColisRegle`) ET celle du n° de suivi seul
  (`achatDuColis`) ; elles doivent dire la même (`commandeUnique`, **api/_lib/commande-colis.js**, partagé avec le
  serveur), sinon personne. Lue par : la carte de Colis (nom + photo ; avant, le n° seul), le titre de Colis
  (`titreRetrait`), le mode relais (via la carte), la pile de photos et la case de Ma journée, la photo hors ligne de
  Ma journée, les codes hors ligne, la liste publiée.
- **Ma journée** : la case « À retirer » dit le nom des paires qui attendent (deux, puis « et N autres » —
  `journee.nomsEtAutres`, 5 langues), neutre ; « + N à vérifier » (ambre) garde la priorité ; un colis sans
  identité n'y a pas de nom (jamais « Colis »).
- **Widget iPhone** : la liste publiée `vrm_colis_retirer.colis[i]` porte **[7] = le nom** (l'achat relié par
  identité, sinon l'article de l'e-mail de CE colis, sinon '') ; `retirerPublie` (api/_lib/retrait-colis.js) rend
  `liste` (les colis encore comptés, un par un) ; `api/widget.js` rend **`pickupColis`** :
  `[{ nom, paire, transporteur, jours, limite }]`, le plus pressé d'abord, 20 au plus ; sans nom ⇒
  « Colis {transporteur} » (`paire: false`). Le widget ne relie rien lui-même. Une publication d'avant (sans [7]) ⇒
  « Colis {transporteur} ». ⚠️ Le script Scriptable de l'iPhone n'est pas dans le dépôt : pour **afficher** ces noms,
  il doit lire `pickupColis` (geste de Julien, ou la prochaine version du script).
- L'agenda (`api/_lib/agenda-ics.js`) garde « Colis à retirer · {transporteur} » : il écrit volontairement sans
  titre d'annonce (règle du 10 nov.).

## Preuves

- **Banc `scripts/bancs/retirer-nom-paire.cjs`** (base inventée à la forme mesurée : MR relié par ligne de suivi,
  Vinted Go par code, e-mail Vinted par conversation, Chronopost sans identité au même point qu'un achat « au point
  relais » sans n° — le piège) : **44/0** sur la branche (390 tactile et 1512, clair et sombre) ; **28 rouges sur
  `origin/main`** (A2/A3 photo, B, C1–C3, D) ; **mutation** (`commandeRetrait` réduite au n° de suivi seul) :
  **25 rouges**. Captures regardées : Colis → À retirer (les trois points), mode relais, Ma journée (390 clair, 1512
  sombre : « 4 colis à retirer · Adidas Spezial bleu 42 · Nike P6000 argent et 2 autres »).
- **Audit `scripts/audit-nom-paire-retrait.cjs`** (EXÉCUTE `commandeUnique`, `retirerPublie` et la vraie route
  `api/widget.js` sur une fausse base PostgREST) : **16/0** ; **rouge sur `origin/main`** (2 verts, 5 rouges) ;
  `--prouve` : **4/4 mutations** attrapées (commande devinée, nom pas relu, widget sans liste, widget sans
  transporteur).
- Verts : audits retrait-fiable, suivi-colis (+ ceux listés dans la ligne §9) ; `vite build` vert.

## Restes

- Les 4 colis sans nom (et 48 lignes sur 30 jours) attendent le n° de suivi du panneau « Détails » (extension
  5.372, à installer) ou une relecture des achats par l'extension (30 achats « expédiés » sans ligne de suivi).
- Le script Scriptable du widget doit lire `pickupColis` pour montrer les noms.

Geste de Julien : installer l'extension 5.372 et passer sur ses conversations Vinted ; mettre à jour le script du
widget pour lire `pickupColis`.
