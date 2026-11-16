# 16 nov. 2026 — Les bordereaux de retour dans « Imprimer » (lot impression-retours)

Branche `claude/impression-retours`.

Julien, mot pour mot : « Les colis imprimé tu peux mettre le retour, mais il faut bien préciser que c'est un
retour et pas en avance. » Précisé ensuite : « bien préciser que c'est un retour et pas une vente ». Un bordereau
de retour (un ACHAT qu'il renvoie : e-mail « Bordereau de retour », ligne `email_bordretour_{tx}`, carte de
`retoursAchat`, lots retours-litiges du 11 nov., retours et retour-parfait du 15 nov.) ne doit jamais ressembler
à une vente : ni à l'écran, ni sur le PDF, ni dans les compteurs.

## Ce que main faisait (mesuré avant de coder)

- « Choisir » (l'ancienne feuille « Tout imprimer ») avait une section « Retours » : chaque retour s'imprimait
  UN PAR UN, à part (`RetoursAImprimer` + son bouton). Le bouton « Imprimer (N) » d'À expédier, le plein de
  Ventes et le PDF du lot n'emportaient AUCUN retour.
- Le PDF d'un retour (`preparerRetourPdf`) passait par le tampon d'une VENTE : « N° 31 » en tête, puis le titre
  préfixé « RETOUR · … » en petit — d'un coup d'œil, le tampon d'une vente.
- `src/tamponRetour.js` (cartouche « RETOUR · N°… » en haut à gauche) n'est plus appelé par l'app depuis le
  15 nov. (seul `audit-retours-litiges` T1 l'exécute) : laissé tel quel.

## Ce qui change

1. **Les lignes de retour** (`src/impression/retoursLot.js`, pur) : `lignesRetoursLot(retoursAchatRes)` — une
   ligne par retour À DÉPOSER, avec PDF, ni remboursé ni contredit par une vente, identité = le n° de
   transaction (`r:{tx}`), `retour: true`, `site: 'retour'`. Le vendeur à qui on renvoie est lu sur l'ACHAT relié
   par ce n° (`seller` / `user_login` / `opposite_user.login`), sinon rien. Déjà imprimé sur cet appareil
   (`vrm_retours_imprimes`, local) ⇒ plus coché d'office, toujours choisissable.
2. **Jamais une ligne de vente** : `lignesLotTous` (le nombre du bouton, « à envoyer », `vrm_colis_prets`,
   le disque de la barre) est inchangé. Le lot IMPRIMÉ = `lignesLotImpression()` = ventes PUIS retours ;
   `lancerImpression` y ajoute les retours cochés (`opts.retours`, sinon les cases de l'écran). Une sélection de
   ventes (actions en série) n'emporte aucun retour.
3. **À l'écran** : sous les ventes d'À envoyer (Ventes « Verre dépoli ») et dans « Choisir », la section
   **« RETOUR · tu renvoies un achat »** (`RetoursLot`, `src/RetoursLitiges.jsx`) : pastille RETOUR (neutre,
   bordée ; **ambre** seulement quand la date limite de dépôt est à moins de 48 h ; jamais rouge), N° (par
   l'achat, sinon « Sans N° »), titre, « à renvoyer à … », « À déposer avant … » (date LUE, sinon rien), une
   case. À côté de chaque bouton d'impression : **« + 1 retour »** (ou « 1 retour » quand aucune vente ne part),
   jamais mêlé au nombre des ventes.
4. **Sur le PDF** : un item `retour` prend le **cartouche RETOUR** (`cartoucheTampon(…, retour = true)`) :
   « RETOUR » en grand (1,35 × la taille du N° d'une vente), cadre noir, « N° 31 » dessous, le titre,
   « Achat renvoyé · pas une vente ». Même recherche de zone blanche que les ventes, sinon fiche 10×15 RETOUR
   après l'étiquette ; en thermique, la fiche de préparation RETOUR même si le réglage l'a éteinte (jamais
   « rien de tamponné ») ; ni le tampon choisi pour une vente (« N° seul », « Rien »), ni l'aperçu de placement,
   ni d'emplacement de rangement (la paire part). « Imprimer le bordereau » de la carte « À renvoyer » prend le
   même cartouche.
5. **Après** : la feuille dit « 2 bordereaux dans le PDF · dont 1 retour », la vignette du retour porte RETOUR
   (pas de changement de tampon proposé sur un retour). Un retour absent est nommé avec SA raison
   (« bordereau de retour pas encore là : ouvre l'e-mail de Vinted »), jamais « génère-le sur la vente ».
6. Textes par `tr()` en 5 langues (`src/i18n/langues/<l>/impression.js`, clés `impr.retour.*`) ; mots du PDF
   aussi (`impr.retour.pdfHaut/pdfBas/pdfPied`). « Quoi de neuf » : `impression-retours`.

## Preuves

- `scripts/audit-impression-retours.cjs` : 25 verts ; `--prouve` 7/7 mutations rouges (remboursé gardé, déposé
  gardé, ligne non marquée, comptes mêlés, **tampon de vente sur un retour**, retours absents du lot, mot RETOUR
  absent).
- Banc `scripts/bancs/impression-retours.cjs` (1512 clair, 390 tactile clair et sombre) — voir « Résultat ».

## Résultat

(rempli à la fin du lot, plus bas)

## ÉTAT À LA REPRISE

Voir la fin de ce fichier.
