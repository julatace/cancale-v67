# 22-23 nov. — `claude/bugs-totale` : vente connue par e-mail partout, colis sans photo, boucle de rendus, finitions

Julien, 22 nov. : « l'app bug beaucoup trop, corrige absolument tout » ; « j'ai fait une vente que j'ai reçue par mail, j'ai vu le
montant, mais ce n'est pas actualisé dans l'application ; elle n'a pas été captée sur Vinted, seulement par mail ».
Passation : `2026-11-22-passation-generale.md` §3.2, §3.3, §3.4.

## 1. Déjà sur la branche (22 nov., sessions précédentes)

- Ma journée : bénéfice du jour (les ventes EN COURS publiées à part dans `vrm_benefice_jours.encours`, même règle et même prix
  d'achat par identité ; le mois reste aux finalisées), « Dernières ventes » d'une vente reçue par e-mail (titre par l'identité de la
  transaction, jamais le titre), Messages (bulle coupée, article dit une fois, toast hors du fil), volet Ventes fermé au retour,
  Calculette nommée, toast des N° (10 s depuis sa première apparition), Paramètres au téléphone (le retour referme la catégorie),
  champs de recherche à 16 px (zoom iOS).
- Vente connue par e-mail relue toutes les 2 min et au retour sur l'app (elle n'était relue qu'au changement de la liste Vinted).
- Fusion de `main` du 23 nov. (style-clarte) : le toast garde sa durée ET la réserve de main ; Achats ordi et « carte seule » d'Aujourd'hui
  pris de main (style-clarte avait réglé les mêmes trous autrement).

## 2. Vente connue seulement par e-mail, partout (§3.2)

### Mesuré (lecture seule, vraie base, 23 nov. — aucun nom, pseudo ni n° ici)
- 13 e-mails de vente depuis le 12 nov. : les ventes de comptes **particuliers n'ont jamais de n° de transaction** (11/13), celles du
  compte Pro oui. Chaque ligne porte l'`uid` du compte de RÉCEPTION, le prix, le titre, la photo.
- L'e-mail du **bordereau** qui suit (5 vérifiés) porte, lui, le n° (`email_bord_{tx}`, `transaction`) et le même `uid` — pas de photo.
- La **photo** de l'e-mail de vente est, adresse comprise (hors hôte et signature), celle de la vente dans la liste Vinted captée
  ensuite : **7 sur 7** (11/12 retrouvées par le fichier ; la 12e : compte pas relu depuis le 11 nov.). Vente ≈ 1 min avant l'e-mail.
- Conséquence : une vente de particulier entrait déjà dans Ventes, Vendu et le CA du jour (règle du 16 nov.), mais **son colis
  n'apparaissait nulle part** (Colis, « À envoyer » de Ma journée) : sans n°, elle ne peut pas retrouver son bordereau, et un bordereau
  sans vente n'était qu'un diagnostic.

### Ce qui change
- **Le bordereau reçu d'une vente pas encore relue fait le colis** (`ventesDuBordereauSeul`, src/bordereauVenteEmail.js) aux mêmes
  conditions que la vente e-mail : n° numérique ; `uid` de réception = compte lié, pas écarté, liste lue (« pas su » ⇒ rien) ; n° absent
  de la liste ET bordereau arrivé APRÈS la dernière lecture de cette liste (la lecture fait foi : vente annulée, compte supprimé ne
  laissent aucun fantôme) ; moins de 21 jours ; n° déjà porté par une vente e-mail ⇒ rien de plus. Il entre dans Colis et Ma journée
  (`colisEmailSources` → `expeditionsCalc`, `toShip`), **jamais dans Ventes ni dans le CA** : la vente e-mail compte le chiffre, une fois.
  Prix « — » (jamais inventé), titre de l'article du bordereau, N° par la décision existante (`decisionNumeroVenteEmail`).
- **La photo exacte tranche la fenêtre ambiguë** (`clePhotoVente`, `autreQueLaFenetre`, src/venteEmailFraiche.js) : une vente sans n°
  dont la liste, lue juste avant l'e-mail, porte une vente du même compte < 30 min avant ⇒ même fichier photo : c'est elle (rien) ;
  toutes un autre fichier : ce n'en est aucune (la vente e-mail entre) ; un fichier manquant : pas su (rien), comme avant.
- Inchangé : compte = adresse de réception ; identité = n° de transaction, sinon la ligne de l'e-mail, sinon la photo exacte ; jamais le
  titre ; URSSAF / CA déclaré (daté au versement) ne reçoivent aucune ligne e-mail ; la ligne dit « vue par e-mail ».
- Quoi de neuf : « Une vente reçue par e-mail se voit partout ».

### Preuves
- `audit-bordereau-des-email` : 54 verts (§6 neuf, 13 contrôles) ; `--prouve` 14/14 ; **arbre de main : 12 rouges**.
- `audit-vente-email-fraiche` : tout vert (F11 neuf, 7 contrôles) ; `--prouve` toutes attrapées (dont 3 neuves sur la photo ; ancre
  « liste de Ventes » repointée sur src/ecrans/Comptabilite.jsx) ; **arbre de main : 3 rouges**.
- Banc `bugs-totale-email` : **42/42** (390 et 1512) : forme avec n° (Ventes, CA +85 € et +1 vente du jour, app déjà ouverte puis
  retour, captée ensuite = UNE vente) et **forme sans n° mesurée** (CA +64 €/+1, « À envoyer » 70→71, Imprimer 14→15, Colis montre le
  colis, sans l'e-mail rien de ce titre, captée ensuite : une vente et un colis). Porté sur Ma journée « verre » (`data-jv2-*`,
  `data-sj-*` ; le jour d'aujourd'hui touché). Captures regardées (Ventes « À envoyer » : la ligne du bordereau, prix « — »).

## 3. Colis à retirer sans photo (§3.4)
`Contenu` (src/natif/RetraitsPoints.jsx) dessinait `<Icon>` sans le recevoir : « Icon is not defined » dès qu'un colis à retirer n'avait
pas de photo. `Icon` passé et gardé (`LigneEnRoute` aussi). `audit-retraits-sans-photo` (exécute le vrai composant, esbuild +
renderToStaticMarkup) : 4 verts ; **arbre de main : 4 rouges** ; `--mutation` 2/2.

## 4. Boucle de rendus sur Aujourd'hui (§3.3)
- Banc neuf `scripts/bancs/rendus-repos.cjs` : crochet des outils de React posé avant l'app, validations comptées sur 10 s au repos,
  déclencheurs (composant dont l'état a changé), `vrm:save` de la fenêtre ; noms lisibles avec un build de diagnostic (config vite
  sans minification, `BANC_DIST`). `PONT_MS` / `SAVE_MS` simulent l'activité d'un ordinateur où l'extension capte (un « ready » du pont
  et une écriture sans rapport toutes les 1,3 s ; rien ne change dans l'état).
- Sans activité, la base inventée ne boucle pas (1 validation en 10 s après 25 s). Avec l'activité : **16 validations en 10 s au
  téléphone, 15 à l'ordinateur — une toutes les ~1,3 s, la boucle de la passation**, 2 666 / 2 917 composants rendus.
- Source : chaque message du pont (« ready » à chaque sonde, battement, évènement de commande, relecture du relais) prévenait TOUS les
  abonnés d'`onVmrExt` même sans changement (pastille `EtatActions`, `LigneFraicheur`, `FileReseauExt`, `PhotosBloquees`,
  `ParcoursArriveeApp`, Argent, boutons d'extension…) ; et `AccueilResteJournee` se refaisait à chaque `vrm:save` de n'importe quelle clé.
- Correctif : `onVmrExt` ne prévient un abonné que si l'**empreinte** de l'état de l'extension a changé depuis son dernier appel
  (`signatureExt` : prêt, versions, état du battement, commandes, relais, liaison, ponts… + la minute en cours, pour ce qui dépend de
  l'heure ; une empreinte par tour de messages) ; Accueil ne se refait que pour SA clé (`vrm_trouve_sans_numero`).
- Mesure, écran SERVI (natif) : **11 → 6 validations en 10 s (téléphone), 13 → 6 (ordinateur), 1 501 → 799 et 2 086 → 885 composants** ;
  sur le DOM d'avant le 17 nov. (échafaudage des bancs) : 16 → 3 et 15 → 2. ⚠️ Les bancs `bugs-totale*` tournaient sur ce DOM d'avant
  (`vrm_banc_dom_ancien` posé par `_garde-reseau`) : `_bt-commun` le retire désormais (`BANC_DOM_ANCIEN=1` pour le garder) ; les validations restantes sont de vrais
  changements (battement sans réponse). Banc vert après, rouge avant (même banc, build de diagnostic de l'arbre d'avant).

## ÉTAT À LA REPRISE
- Branche `claude/bugs-totale` poussée ; voir la PR et la CI dans le rapport de la session.
- À mesurer sur un vrai ordinateur avec l'extension : le nombre de validations au repos (le banc simule le pont, il n'est pas l'extension).
- La ligne de Ventes d'une vente sans n° dit encore « bordereau à venir » quand le colis du bordereau est déjà dans « À envoyer » (aucune
  identité ne les relie ; jamais par le titre) — le colis, lui, est bien là. Geste de Julien : aucun.
