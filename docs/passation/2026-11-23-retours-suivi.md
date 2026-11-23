# 23 nov. 2026 — Le suivi des retours d'achat, et leurs cartes refaites (branche `claude/retours-suivi`)

Julien (captures iPhone, Achats → « À renvoyer ») : « je veux que tu fasses le suivi des colis retournés si possible ».
Puis (coordinateur) : « améliore le design des litiges que je renvoie (À renvoyer) ET des colis à retirer, propose-moi des
designs » ; « trop de texte, pas assez de beaux boutons ». Nouvelle apparence du jour : gris clair, cartes blanches, AUCUN
orange/ambre. Suite de `2026-11-15-retours-suivi.md` (la règle par n° exact), `2026-11-15-retour-parfait.md` (les étapes),
`2026-11-16-impression-retours.md`, `2026-11-21-retours-suivi.md` (le retour d'une VENTE, l'autre sens).

## ÉTAT À LA REPRISE

- Branche `claude/retours-suivi` poussée (worktree `/home/user/wt/retours-suivi`, checkout CREUX : `docs/` sauf
  `docs/*.md`, `docs/passation/*.md`, `docs/design/*.md`, et `dist/` ne sont pas extraits — le disque était PLEIN à 11:45 UTC).
- PAS de PR ni de fusion : consigne « pas de fusion avant le choix de Julien » (maquettes ci-dessous) et « aucune fusion
  avant demain 07:00 UTC ».
- « À retirer » : la proposition C est codée (consigne du coordinateur en attendant le choix de Julien) ; A et B restent des maquettes.
- Voir « Reste à faire » en bas.

## Mesuré d'abord (lecture seule, base de production, projections scalaires)

Sources possibles de l'état d'un retour d'ACHAT (ce qu'il renvoie) :

| source | lignes | ce qu'elle prouve |
|---|---|---|
| `email_bordretour_{tx}` (bordereau de retour, n° de suivi, transporteur lu sur l'étiquette, date limite) | 2 | bordereau reçu |
| `email_retourdemande_*` (« Retourne ta commande d'ici le … ») | 3 | un retour est demandé, sa date limite |
| `email_track_{transporteur}_{n°}` sens sortant, n° EXACT du bordereau | 1 (Mondial Relay « en transit ») | déposé / en route |
| `email_rembachat_{tx}` | 1 (35,98 €) | remboursé |
| `depart_*` / `transp_*` (lecture serveur chez le transporteur) | 0 pour ces n° | — (abandonnée : clés retirées, décision de Julien) |
| `harvest_{uid}_suivi_{tx}` (`capterSuivisAchats`) | 1, mais c'est le colis d'ORIGINE (BRT Italie, 5 nov.) | rien sur le retour |
| liste des achats (`orders_purchased`) | statut figé « Commande expédiée… » | rien sur le retour (Vinted ne le dit pas dans la liste) |

Couverture par étape, sur ses 2 retours avec bordereau : **bordereau 2/2 · déposé 1/2 · en route 1/2 · livré au vendeur 0/2
· remboursé 1/2**. Le troisième (Salomon) n'a qu'un avis (limite du 14 oct.) ⇒ « À vérifier ».

⚠️ **Mondial Relay n'écrit JAMAIS l'arrivée à l'expéditeur** : sur toute la base, 29 e-mails Mondial Relay sortants « en
transit », 0 « livré » (Chronopost sortant : 8 « transit », 4 « livré »). « Livré au vendeur » d'un retour Mondial Relay ne
peut donc venir que du remboursement (qui l'implique) — d'où le cas de sa capture.

## Ce qui est livré

1. **La règle des étapes impliquées** (`src/retoursAchat.js` `etapesRetour`) : une étape postérieure PROUVÉE coche les
   précédentes, `implicite: true`, **« date pas vue »**, `at` nul — jamais une date inventée. Exception : le remboursement ne
   prouve PAS que le colis a voyagé quand il est PARTIEL (l'article est souvent gardé) ou quand il n'y a ni bordereau, ni
   dépôt, ni fait du transporteur ⇒ ces étapes restent grisées (« pas su » ≠ « oui »). Son cas : Bordereau ✓ · Déposé ✓ 10 nov.
   · En route ✓ date pas vue · Livré au vendeur ✓ date pas vue · Remboursé ✓ 35,98 €.
2. **La carte refaite** (`src/RetoursLitiges.jsx` `CarteRenvoyer`, `src/styles-retours-cartes.css`, proposition A) : carte
   blanche à filet, tête (photo 48, titre, N° en plaque, compte, étiquette pastel : À déposer gris · Délai dépassé au contour
   d'encre · En route teal · Livré / Remboursé vert), UNE ligne d'état (« Date limite de dépôt dépassée » + « lun. 23 nov. ·
   10 h » à droite ; « À déposer avant … » ; « En route vers le vendeur » + « déposé le 21 nov. » ; « Remboursé · 35,98 € »),
   au plus une phrase courte (≤ 8 mots) et **« Pourquoi ? »** replié pour le reste, la **frise horizontale** des 5 étapes
   (plein + coche = prouvé daté ; contour + coche = fait, date pas vue ; pointé = où il en est ; pointillé = passé sans
   preuve), le n° de suivi (logo, un toucher = copié), puis des **vrais boutons** icône + verbe : Imprimer · Déposé · Suivre ·
   Vinted (forme commune `n-actions` / `n-bouton` de la branche `claude/style-clair` ; `src/natif/actions.css` recopié tel
   quel). Un seul plein : la première carte qui attend SON geste. **Plus d'encadré orange** (`BandeLimite` supprimée) ; ce qui
   était ambre dans « Imprimer → Retour » est à l'encre, en gras. **Plus aucun bouton hors d'une carte.**
3. **« À vérifier » réparé** (`RetoursAVerifier`) : une carte, vignette 44 (tuile neutre sans photo), titre + « Sans
   nouvelles depuis le 14 oct. » sur toute la largeur, deux boutons alignés dessous (Vinted · Réglé). Les anciennes règles
   `.vrm-ret-verif-*` de `verre-journee.css` ne s'y appliquent plus (nouvelles classes `vrm-rt-*`).
4. **Le suivi se met à jour tout seul** (`src/ecrans/Comptabilite.jsx`, `src/tempsReel.js`) : avant, bordereaux et
   remboursements n'étaient lus qu'au montage, et les e-mails du transporteur seulement sur `vrm:transp-maj` (la lecture
   serveur, abandonnée). Maintenant : `email_bordretour_*` / `email_retourdemande_*` / `email_rembachat_*` rangés ⇒ signal
   `vrm:neuf` « retours » (la veille) ⇒ relecture des retours ; `email_track_*` (« colis ») ⇒ relecture des faits du
   transporteur ; retour sur l'app après 20 s ⇒ les deux. Projections scalaires, mêmes lecteurs.
5. **« À retirer » — proposition C** (`src/natif/RetraitsPoints.jsx`, `src/natif/retraits.css`, `data-rp-variante="c"`, défaut) :
   une carte BLANCHE par point (logo, nom, « transporteur · comptoir », l'échéance LUE — au contour d'encre quand elle presse, plus
   d'ambre —, adresse · horaires lus), chaque colis en RANGÉE compacte (photo 44, titre, N° · prix, le CODE à droite en chasse
   fixe, son QR en vignette 44 ; toucher = le plein écran d'avant), la frise fine dessous, et au pied des VRAIS boutons :
   « Itinéraire » (plein sur le premier point, celui qui presse le plus) et « Code » quand un seul colis attend. Aucune règle
   touchée : `pointsARetirer`, `colisDuPoint`, `src/retraitPreuves.js`, l'identité — inchangés ; les repères `data-rp-*` sont ceux
   d'avant. Les variantes « a » / « b » restent (`vrm_banc_retrait_variante`). Mini-carte par point : PAS faite (aucune tuile
   gratuite sûre par carte ; la carte des points existante, `CartePoints`, reste sur son bouton).
6. « Quoi de neuf » : `retours-achat-suivi`. Textes en 5 langues (`rt.*` dans `src/i18n/langues/<l>/renvoyer.js`).

## URGENT du soir : « le point relais n'est pas reconnu » (Vinted Go)

Capture de Julien en production : « Point pas encore connu · Vinted Go · comptoir · adresse pas lue · fermé — ouvre demain à 8 h ·
à retirer avant le 25 nov. », code et QR bien affichés.

- **Mesuré (lecture seule)** : la ligne `email_track_vinted_{n°}` (e-mail Vinted Go « Rappel : récupère ton colis… ») porte
  `lieu` = « Relais Vinted Go, <commerce>, <n° et rue> » — SANS code postal ni ville — et `horaires` (les plages du point). Cette
  forme est récente : 2 e-mails (15 et 22 nov.) contre 23 « Consigne Vinted Go, … ». Aucune ligne de suivi Vinted (`harvest_*_suivi_*`)
  pour ce n°.
- **Cause** : `cleanLieu` (src/App.jsx, `TYPE_LIEU`) ne connaissait pas « Relais Vinted Go » comme TYPE ⇒ il devenait le NOM ;
  `nomRelaisPropre` (src/relaisColis.js) l'écartait (que des mots de type) ⇒ le vrai nom (2e morceau) perdu ; sans code postal ⇒
  point « inconnu », « adresse pas lue ». Les horaires venaient du MÊME e-mail : justes (lundi 18 h 04, fermé ; mardi 8 h).
- **Correction** : « Relais Vinted Go » / « Relais Vinted » est un TYPE dans `TYPE_LIEU` (App.jsx) et `TYPE_EN_TETE`
  (relaisColis.js). Résultat sur les 2 formes réelles : « Joubert Peintures · 10 Rue Du Bois Aurant », « Épicerie Saveurs
  D'Ailleurs · 43 Rue du Lt François Fromentin » ; « Consigne Vinted Go, … 56000 Vannes » inchangé. La rue sans code postal est
  déjà gérée (identité nom + rue ; recherche carte « texte » jugée par la règle existante).
- **Preuves** : `scripts/audit-point-vinted-go.cjs` (V1–V4) vert, 3 rouges sur origin/main ; `--prouve` 2/2 mutations rouges ;
  banc `retrait-point-c.cjs` K6 (la forme réelle, valeurs inventées) — voir « Preuves ».

## L'extension : ce qu'il faudrait (PAS fait aujourd'hui : 5.440–5.443 réservées ailleurs)

Mesuré : `capterSuivisAchats` relit bien l'achat en retour (il n'est ni « livré » ni fini), mais le `journey_summary` lu
est celui du colis d'ORIGINE ; la liste des achats garde « Commande expédiée… ». Pour un retour d'achat, rien côté Vinted
n'est lu aujourd'hui. Le plan (sur le modèle de `capterSuivisRetours`, 5.431, côté vente) :

1. Cibles : les achats de CE compte dont un `email_bordretour_{tx}` existe (n° de transaction exact), ni remboursés ni
   finalisés — lus dans la base par l'extension (une requête scalaire `id=like.email_bordretour_*&select=tx:meta->>transaction,
   suivi:meta->>suivi`).
2. Lecture : `/transactions/{tx}` (état de la commande : code de statut et `status_updated_at`, qui disent « retour
   expédié / livré au vendeur / remboursé ») et `/transactions/{tx}/shipment/journey_summary` (le shipment courant) — dans
   les MÊMES bornes que le suivi des achats (budget « suivi » 6/h DANS les 20 lectures/h, 2 par visite, mémo 3 h, une
   requête à la fois, compte de l'onglet, pause sur 429/403).
3. Rangement : `harvest_{uid}_retourachat_{tx}` seulement si quelque chose change (`{ tx, statut, statutAt, suivis: [n°…],
   etapes: [{ code, t, at }], capturedAt }`), sans rien de personnel ; forme inconnue ⇒ rien écrit, `retourachat_forme_inconnue`
   au diagnostic.
4. Règle (app, pure, dans `src/retoursAchat.js`) : la ligne ne rejoint le retour que si l'un de ses n° est ÉGAL au n° du
   bordereau de retour (jamais par titre) ET ses étapes sont datées après la réception du bordereau ; deux retours au même
   n° ⇒ ni l'un ni l'autre. Ses étapes deviennent des faits (`source: 'vinted'`) à côté des e-mails : « livré au vendeur »
   enfin daté pour Mondial Relay.
5. Capacité `retourachat` dans `EXT_CAPACITES` à la version qui la porte ; l'app ne promet rien à une extension plus vieille.
6. Mesure qui manque : la FORME de `/transactions/{tx}` d'un achat en retour n'a jamais été vue — la première lecture en
   mode mesure (1 par jour) doit la ranger telle quelle (scalaires) avant toute règle.

## Les maquettes (3 par écran, données inventées)

`/tmp/claude-0/-home-user-cancale-v67/01ffd5bd-b42b-5f82-ac63-09da1576e3a7/scratchpad/retours-maquettes/`
(`maquettes.html`, rendu `m.html?v=retirer-A&w=390`) : `retirer-{A,B,C}-{390,1512}.png`, `renvoyer-{A,B,C}-{390,1512}.png`.
- À retirer : A carte ticket (photo, code en très grand, point + horaires + limite, Itinéraire · Code) · B liste compacte +
  feuille (code en grand, QR, suivi) · C regroupé par point relais (mini-carte, colis et codes, Itinéraire · Codes).
- À renvoyer : A frise horizontale (CODÉE) · B liste compacte + feuille · C « maintenant » en haut puis historique replié.

## Preuves

(à compléter après 15:30 UTC — build, banc, mutation)
- `node scripts/audit-retour-parfait.cjs` : vert ; `--prouve` : les 2 mutations neuves (`etape-impliquee-oubliee`,
  `implique-sans-voyage`) rougissent ; `tampon-par-dessus` : ancre introuvable DÉJÀ sur main (le code a quitté App.jsx).
- `audit-studio` : `n-bouton` (le bouton du design natif) admis comme forme du contrat ; vert. `audit-traduction`,
  `audit-quoi-de-neuf`, `audit-veille`, `audit-veille-plantages`, `audit-temps-reel-sql`, `audit-retours-*`,
  `audit-impression-retours`, `audit-depose-retire`, `audit-style-vintex`, `audit-textes-courts` : verts.
  `audit-colis-trois`, `audit-vocabulaire-article` : rouges AUSSI sur main (sans lien).
- Banc `scripts/bancs/retours-renvoyer-suivi.cjs` (R1–R6).

## Reste à faire

- Faire tourner build + bancs (après 15:30 UTC), rouge sur le code d'avant, captures avant/après regardées.
- « À retirer » : coder la proposition choisie par Julien (ne rien changer à `src/retraitPreuves.js` ni à l'identité).
- PR après 15:30 UTC ; fusion demain après 07:00 UTC selon la règle, et après le choix de Julien.

## 23 nov. au soir — « le transporteur inconnu, le logo mal mis, l'affichage est moche » (capture iPhone 390, production)

Julien a CHOISI la proposition C. Sa capture montrait la PRODUCTION (`main`, variante « b » billet, sans la correction du point) :
« Point pas encore connu · Vinted Go · comptoir », pastille « à retirer avant le 25 nov. », « adresse pas lue · fermé — ouvre demain
à 8 h » (contradiction : point inconnu, horaires connus), logo décalé, orange sur « Vérifie leur suivi avant d'y aller ».

**Mesuré (lecture seule, projections scalaires, rien de personnel copié ici)** : le colis de la capture (Vinted Go, payé 13,36 €,
au point le 19, limite le 25, code 978 216) est `email_track_vinted_{n°}` ; `lieu` = « Relais Vinted Go, <commerce>, <n° et rue> »
SANS code postal ni ville, `horaires` = tableau `[{jours:[1..4], plages:[{de,a},{de,a}]}, {jours:[5],…}, {jours:[6],…}, {jours:[7], plages:[]}]`,
`consigne` false, `status` available. Le 1er e-mail (19 nov., « Nouveau relais ») n'avait PAS de lieu ; le rappel (22 nov.) l'a
apporté. Aucune ligne `harvest_*_suivi_*` ni de destination de l'extension pour ce n°. Sur les 46 lignes `email_track_vinted_*` :
23 « Consigne Vinted Go, … », 3 « *Consigne Vinted Go* », 2 « Relais Vinted Go, … » (avec horaires), 18 SANS lieu.
**Cause** : celle déjà corrigée sur cette branche (`TYPE_LIEU` / `TYPE_EN_TETE` : « Relais Vinted Go » pris pour le nom puis écarté) ;
les horaires venaient du MÊME e-mail, d'où la contradiction. Avec la vraie forme, la branche nomme le point (audit V1/V5, banc K6/K7).
Les 18 lignes sans lieu restent sans nom : le titre devient alors le TRANSPORTEUR (« Vinted Go »), jamais « Point pas encore connu ».

**Changé (variante C seulement ; a/b intactes pour les captures)** — `src/natif/RetraitsPoints.jsx`, `src/natif/retraits.css` :
- en-tête du point façon liste iOS : logo ENTIER 36 px (la tuile du transporteur, comme #1321) centré sur le bloc du titre ; nom sur
  UNE ligne ; dessous « transporteur · avant le 24 nov. » (l'échéance LUE en texte calme, gras si elle presse : « dernier jour demain »,
  « 1 à vérifier ») — plus de pastille ; « comptoir » seulement pour le lecteur d'écran, « consigne » dit ;
- nom pas lu ⇒ titre = transporteur (`data-rp-nom-de="transporteur"`), sinon « Point relais » ; « adresse pas lue » seulement si
  RIEN n'est lu (ni adresse ni horaires) ;
- « adresse · horaires » sur une ligne (l'adresse se coupe, les horaires restent entiers) ;
- titre d'un colis 15 px sur 2 lignes au plus ; « En route · point pas encore dit 22 » ⇒ « 22 en route » (le pourquoi est dedans) ;
- « Pas compté dans « à retirer ». » + « Pourquoi ? » (le reste replié) ; le résumé « À retirer » sans cadre ;
- plus d'orange : pastille d'état d'Achats (`--a-ambre-*`, `src/styles-achats-photos.css`) et ambre de NUIT (`--n-ambre*`,
  `src/natif/jetons.css` — il nourrissait aussi `--sv-ambre`/`--ap-ambre`) passent à l'ardoise / l'encre claire. « Colis à vérifier ·
  Vérifie leur suivi » (rangée `ton="ambre"` d'« À régler ») est donc neutre en clair (déjà, style-clair) ET en sombre.
- « Tout le détail des retraits » : la coque défile DANS l'écran (`data-n-defile="ecran"`, barre d'onglets dans le flux) — le lien ne
  peut pas passer sous la barre ; la capture était prise en cours de défilement. Garde-fou K12 posé (vert avant et après : rien à corriger).
- Textes neufs : `retraits.p.pointRelais`, `retraits.p.echAvant/echAuj/echDemain`, `retraits.m.horsCompteCourt` (5 langues).

**Preuves** :
- `scripts/audit-point-vinted-go.cjs` V5–V7 (RetraitsPoints RENDU par esbuild + react-dom/server, forme réelle) : vert ; rouge sur
  le code d'avant (87ccb0ce5 : V5–V7) et sur `origin/main` (V1, V3, V4, V5–V7) ; `--prouve` 5/5 mutations rouges.
- Banc `scripts/bancs/retrait-point-c.cjs` K7–K12 (forme réelle + colis sans lieu avec horaires + colis à limite dépassée) :
  78 verts à 390/1512 clair/sombre ; sur le code d'avant 19 rouges (K7 logo pas entier, K8 « Point pas encore connu », K9 pastille,
  K10 orange, K11 « En route · point pas encore dit 60 ») ; mutation « ambre de nuit remis » ⇒ K10 rouge.
- Captures regardées : 390 et 1512, clair et sombre (scratchpad de la session, jamais dans le dépôt).
- Voisins : `retrait-billet` 106/0, `relais-prevision` 52/0, `retraits-visuel` 240/0 (un rouge instable, différent à chaque passage, AUSSI sur le code d'avant) ; audits retrait-*, codes, coherence, style-vintex, rouge-doublon,
  textes-courts, traduction, quoi-de-neuf, studio : verts. `retraits-parfaits` lit `.n-rp-sorte` (classe disparue AVANT ce lot) : 4 rouges
  anciens. `audit-boutons-natifs` : rouge sur `AchatsTableau.jsx` (venu de main, sans lien).
- Train : #1341 se fusionne APRÈS #1326 (`claude/style-clair`, déjà fusionnée dans cette branche).
