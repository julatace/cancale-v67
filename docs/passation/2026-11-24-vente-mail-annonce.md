# 24 nov. — `claude/vente-mail-annonce` : la vente vue par e-mail et son annonce encore « en ligne »

Julien, 24 nov. 13:22, trois captures iPhone :
- **Ventes « À envoyer »** : « Autry reelwind low noir taille 36 · N° en attente · avant le 1 déc. », 77 €, Mondial Relay — une vente
  connue par l'e-mail (vente + bordereau), pas encore relue par l'extension ;
- **Annonces** : la même paire, **N° 262**, 84 €, encore « en ligne » ;
- **la fiche du N° 262** : « Ventes pas encore lues », « — pas lu », « bénéfice — ventes pas lues », « En ligne — pas lu ».

Sa question : « la vente a été détectée par les mails mais pas encore sur l'extension, donc l'annonce n'a pas encore été
supprimée des annonces en ligne — comment on peut faire ? »

## 1. Mesuré (lecture seule, vraie base — formes seulement, rien de personnel ici)

- L'e-mail de VENTE (`email_sale_tx{n°}`, compte Pro : il porte le **n° de transaction**) : `type: vente`, `uid` du compte de
  réception, `prix`, `designation`, et **la photo de l'annonce** :
  `https://images1.vinted.net/t/{dossier}/150x210/{fichier}.jpeg?s=…`. Aucun lien `/items/{id}` (pas d'identifiant d'annonce).
- L'e-mail du BORDEREAU (`email_bord_{n°}`, 30 min après) : même `uid`, même n°, `dateLimite` « 01/12/2026 12 h 28 »,
  `transporteur: mondialrelay`, `suivi` (8 chiffres), `article`/`modele`/`taille`, **`numero: "262"`** — posé par le serveur
  au TITRE (`findNumeroByTitle`, cf. 6 nov.) : ce n'est pas une identité, l'app a raison de ne pas le croire. Pas de photo.
- L'annonce N° 262 (dressing du compte, lecture complète de la veille au soir, donc AVANT l'e-mail) : photo
  `https://images1.vinted.net/tc/{dossier}/{fichier}.jpeg?s=…` — **le même dossier, le même fichier** que l'e-mail ; seuls le
  préfixe (`/t/` ↔ `/tc/`), le dossier de taille (`150x210`) et la signature changent. Sa fiche numérotée porte déjà cette
  identité : `photoK = "{dossier}/{fichier}"` (minuscules).
- Autres « Autry reelwind low … » du même compte : 6 (rose 36, blanc 36, blanc 40, gris 37, noir 39, gris 40) — chacune sa
  propre image. Une seule « noir taille 36 » aujourd'hui, mais il en revend plusieurs identiques : le titre ne décide jamais.
- La vente n'était pas encore dans `harvest_{uid}_orders_sold` (lue 3 jours avant) ; la transaction pas lue (`txnItem` vide).

## 2. Pourquoi #1310 (« la photo exacte ») n'a pas relié

#1310 compare la photo de l'e-mail aux photos des **ventes déjà lues** (fenêtre ambiguë) : il ne relie jamais l'e-mail à une
**annonce**. Et la règle d'identité de Ventes (`identiteAnnonce` → `entryKeyByPhoto`) trouvait bien la fiche du N° 262 par la
photo (`photoKey` enlève hôte, taille, signature : même clé) — mais `resolvedEntry` **refuse toute annonce encore en ligne**
(« une paire en ligne n'est pas vendue », juste pour une vente LUE, faux pour une vente prouvée par e-mail avant la relecture du
dressing). D'où « N° en attente ». Et l'annonce restait « en ligne » : `venduesParEmail` (11 nov.) ne retire une annonce que par
`txnItem` (pas lu) ou un bordereau relié par N° admis (le N° du serveur, au titre, ne l'est pas) ; l'écran Annonces natif
(`AnnoncesEgalite`) ne lisait aucune de ces exclusions.

## 3. Ce qui change

**Une règle, `src/venteMailAnnonce.js` (pure), pour Ventes, Annonces et la fiche (§11).** Une annonce EN LIGNE est « Vendue · par
e-mail, en attente de Vinted » quand un e-mail de vente du MÊME compte (l'adresse de réception décide, §5) la désigne par :
1. **son clic** « Relier à l'annonce » (`vrm_vente_mail_liens[cle] = { item }`, synchronisée) ; « Délier » pose `{ aucun }` (plus
   rien, même par la photo) ;
2. sinon **l'image exacte** (`cleImageVinted` : dossier + fichier, la clé de `photoKey` / `photoK`) d'une SEULE annonce du compte
   (deux annonces à la même image ⇒ rien ; deux ventes pour une annonce ⇒ rien).

Seulement tant que la lecture du dressing qui la montre en ligne est **plus ancienne que l'e-mail** (une lecture d'après fait foi ;
heure inconnue ⇒ rien) et que l'annonce n'a pas été (re)numérotée après l'e-mail (paire republiée). Jamais titre, taille ni prix.
Les e-mails lus sont les lignes projetées de `lireVentesEmail` (30 j, la même lecture gardée) — aussi après que la liste Vinted a
relu la vente (la ligne de Ventes disparaît, l'annonce reste à dire jusqu'à la relecture du dressing).

- **Ventes** (Comptabilite) : `onlineAnnonceIds` ne contient plus l'annonce reliée ⇒ la vente reçoit **son N°** (262) par
  `identiteAnnonce` (le lien d'abord, sinon la photo) ; `emailSoldIds` l'ajoute (totaux « en ligne », Ma journée, publication
  `vinted_annonces_email_sold`). Sans identité : la rangée porte UN geste, **« Relier à l'annonce »** (à la place de l'achat) :
  une feuille avec la photo de la vente et les annonces en ligne du MÊME compte, rangées par ressemblance (`candidatsRelier`,
  8 au plus, photo Vinted, N°, prix) — **son toucher relie** ; reliée à la main : « Délier » (rangée et détail).
- **Annonces** (`AnnoncesEgalite`, phase 2 comme « Vendue » du 22 nov.) : l'annonce passe `vendue` + `venteMail` ⇒ hors
  d'« En ligne » et des totaux, dans « Vendues », dite « Vendue · par e-mail, en attente de Vinted ». Rien n'est supprimé.
- **La fiche** : le chargeur de « Tout sur le N° » applique la même règle (`numData.venduesMail`), l'annonce passe
  `vendue-mail`, l'étape vente `mail`, la ligne d'état « Vendue · par e-mail, en attente de Vinted » + « Pourquoi ? ».
- **« Pas su » sur la fiche** : la ligne d'état dit « Pas encore relue » UNE fois, neutre, avec « Pourquoi ? » (la raison en
  gris clair, sur demande) ; les faits manquants s'écrivent « — » seul (plus « pas lu », « ventes pas lues » répétés). Jamais 0.
- Textes par `tr()` en 5 langues (`src/i18n/langues/*/venteMail.js`, `fd.etat.passu`) ; aucun orange (gris clair).
- Quand l'extension lit la vraie vente : la ligne e-mail sort (une ligne, `avecVentesEmail`), et la vente Vinted trouve la même
  annonce (photo) — plus refusée tant que le lien tient ; à la relecture du dressing, l'annonce est fermée/absente : la règle ne
  dit plus rien. Jamais compté deux fois.

## 4. Preuves

- `audit-vente-mail-annonce` (neuf) : **37 verts** sur la forme mesurée (50 « Autry 36 » identiques : seule l'image de l'e-mail
  relie ; sans photo : aucune ; deux images, autre compte, lecture d'après, N° d'après : rien ; Relier / Délier ; En ligne 10→9
  et « Vendues » ; une ligne quand l'extension lit la vente ; l'écran, Annonces et la fiche appliquent la règle).
  `--prouve` **12/12** (dont « relier par le TITRE », « sans photo, la première du compte », « image d'un autre compte »).
  Arbre d'`origin/main` : rouge (la règle n'existe pas).
- `audit-identite` : ancre mise à jour (le `new Set([...venduesParEmail(...), ...venduesMail.keys()])`) + la partie qui relie ne
  lit aucun titre — vert. `audit-enligne`, `audit-enligne-public-vide`, `audit-vente-email-fraiche`, `audit-bordereau-des-email`,
  `audit-photo-vente-email`, `audit-traduction`, `audit-recherche-numero` : verts. `audit-preuve-vente` : 1 rouge
  **déjà sur main** (extension, `ventesApresVente`, rien de touché ici).
- Banc `scripts/bancs/vente-mail-annonce.cjs` (390 tactile ; `ETIQUETTE=avant|apres`, `BANC_DIST`) — résultats et captures :
  voir la PR.

## ÉTAT À LA REPRISE
- PR ouverte, pas fusionnée (consigne). Geste de Julien : aucun (la vente reliée apparaît dès la mise en ligne ; sans photo dans
  l'e-mail, « Relier à l'annonce » sur la vente).
