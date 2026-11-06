# 6 nov. — La boîte mail façon Mail (v36)

Julien (6 nov.) : « continue à améliorer la boîte mail de l'app, c'est pas ouf », puis « je veux
vraiment quelque chose de plus visuel, de beaucoup plus beau — pour les mails surtout ».
Branche LOCALE `v36-boite-mail`, partie de `claude/project-review-nsk5su` (704bdaf2). Rien dans
`vinted-sync-extension/`, `public/` intact. Rien poussé. Skills `apple-design`, `emil-design-eng`,
`impeccable` appliqués dans les limites de §7 (sous-agent : pas de question possible à Julien,
le cadrage vient de la demande et de la passation ; aucune couleur nouvelle posée).

## Mesuré d'abord (sa base, SELECT seulement — aucun nom, adresse, pseudo ni sujet ici)

- **970 lignes `email_reception_*`** (≈ 100 par jour cette semaine) ; **470 (48 %) rangées avant
  le résumé** (31 oct.) : ni résumé, ni texte, ni pièces — la ligne ne peut dire que la famille.
- **37 % « rien à faire »** (357 `connu-sans-action`), dont 95 « commande mise à jour » en six
  jours, souvent **en rafales** (11 en une minute sur un même compte) ; 47 favoris dont 38 sans
  article ni pseudo ; 83 offres résumées dont 37 sans montant.
- **91 « colis au relais »** : 49 avec un code lu, **46 « à vérifier »** sans n° de suivi
  (e-mails « commande mise à jour » de Vinted : « ton colis a été livré au point relais »), le
  lieu en CAPITALES avec l'adresse entière.
- **49 % des e-mails arrivent par un transfert iCloud** (expéditeur réécrit), 9 adresses de réception.
- **500 textes gardés** (≤ 1 500 caractères) : lignes coupées à ~76 caractères au milieu des
  phrases, « *gras* » en astérisques, « [image: Instagram] », points orphelins, « E-mail Vinted »
  en tête, 5 à 8 lignes de mentions légales mêlées au message.
- **Le HTML d'origine n'est gardé nulle part** pour un e-mail rangé (`email_texte_*` = texte borné ;
  `email_inconnu_*` seulement pour l'incompris). Base : 236 Mo sur 500.

## La critique (captures 390 et 1512, clair et sombre, inventées ET sa copie)

1. **Au téléphone, 400 px d'outils avant le premier e-mail** (onglets, recherche, rangée de
   pastilles coupée « Codes d… », menu des comptes, phrase « Les nombres ne comptent que tes 200
   derniers e-mails ») : 4 à 5 e-mails par écran.
2. **Aucun lu / non lu** : sur ~100 e-mails par jour, rien ne dit ce qui est nouveau.
3. **Bruit** : les rafales occupent chacune leur ligne (11 « Commande mise à jour » d'affilée) ;
   37 % de « rien à faire » au même rang que les ventes.
4. **Le code de retrait** n'était qu'un fragment de la ligne, ni grand ni copiable ; ouvert, il
   était écrit deux fois ; 46 lignes identiques « Colis à retirer · code pas encore lu ».
5. **Le lieu** en capitales brutes, adresse comprise, mangé par « … » sur la ligne.
6. **Natures longues** sur deux lignes (« Virement du porte-monnaie vers ta banque », « Achat
   livré, à vérifier avant la date limite »).
7. **Les avatars** : le même « V » sur 85 % des lignes ; les transporteurs en monogramme alors que
   l'app sert déjà leurs logos (`LogoTransporteur`).
8. **Le message d'origine** : du texte brut cassé (voir « Mesuré »), dans une boîte grise.
9. **La lecture** : pas de « qui » en tête, le lieu en capitales dans les détails, la date limite
   sans « dans N j », un seul geste (pas « Voir la vente » alors que le n° de transaction est lu).
10. **20 e-mails par page + « Voir plus »** : 47 touchers pour parcourir 950 e-mails.
11. **Ordinateur** : aucun repère de jour en défilant ; le volet vide est un grand cadre.
12. **« Autres »** mêlait les 98 offres aux newsletters (pas de rubrique « Offres »).
13. **Faux au fond** : rien d'inventé trouvé — la règle « du résumé, jamais du sujet » tenait.

## Ce qui change

### Règles (une source chacune)
- **Lu / non lu** — `api/_lib/emails-lus.js` (NOUVEAU, une règle lue par la route ET l'écran) :
  ligne `vrm_emails_lus` du vendeur `{ jusqua, lus, nonlus, rev }` (clés = 24 caractères de
  l'empreinte, jamais un sujet), bornée (600 + 150). Sans ligne : ce qui est rangé avant la mise en
  service (`LUS_DEPUIS`, 6 nov. 18 h UTC) est lu — la boîte ne s'allume pas de 900 points.
  Ligne illisible ⇒ `null` partout (aucun point, aucun nombre, « Non lus » refusé en 503).
  Lu / non lu ne cache RIEN (§5) ; **pas d'« Archiver »** (un e-mail caché est un colis perdu).
- **Écriture** — `src/emailsLusEcriture.js` : sur SON geste, relire, rejouer ses gestes, écrire en
  comparer-et-échanger sur `data.rev` (3 essais) ; lecture ratée ⇒ rien n'est écrit.
- **Route** — `lireJournalEmail` (`api/_lib/reception-email.js`) : `lu` par ligne, `nonlus=1`
  (lignes après `jusqua` + les remises non lues, filtrées par la règle, paginées ici),
  `compteurs.nonLus`, `dernierAt`, `parPage` 20 ou 50. Colis (`compte=1`) inchangé : une lecture,
  deux scalaires. Jamais `select=data`. Toujours 12 fonctions.
- **Rubrique « Offres »** — `api/_lib/boite-email.js` (le `type` posé au classement).
- **Écran** — `src/boiteEmails.js` : `lieuLisible` (casse et segments du lieu LU, rien
  d'ajouté), `limiteLue` (« demain », « dans 4 j »), `carteHeros` (ce qu'il faut savoir, depuis le
  résumé), `gestesEmail` (par identité : n° de suivi, de transaction, d'annonce Vestiaire, N° lu ;
  l'offre n'ouvre que le filtre « Offres » de Messages, dit comme tel), `empiler` (rafales ≥ 3
  identiques et consécutives, même compte, jamais deux codes), `codeSurLigne` (code LU d'un colis à
  retirer, sinon rien), `lireCorps` (le texte gardé en blocs : lignes recollées, gras, listes,
  liens http(s) seulement, mentions à part — balises, scripts, `on…=` retirés).

### La boîte (src/BoiteEmails.jsx, src/boite-emails.css)
- Ligne façon Mail : point bleu des non-lus (l'accent, rare), avatar rond (logo du site, logo du
  transporteur de l'app, sinon monogramme neutre), nature courte (gras si non lu), l'essentiel (le
  lieu en court, montant, N° lu, article), le geste (ambre seulement si proche ou à vérifier), le
  compte. **Le code de retrait sous la ligne, en gros chiffres, un toucher le copie**. La photo de
  la paire quand le bordereau est relié à une vente par son n° de transaction (`photoDe`, App.jsx).
- **Piles** : « Commande mise à jour · 11 e-mails » en une ligne qui se déplie (rien de caché).
- Pastilles : Tout · Non lus · Codes · Colis · Ventes · Achats · Offres · À vérifier. Les nombres
  des rubriques ne s'affichent que s'ils sont COMPLETS (≤ 200 e-mails) ; « Non lus » et « À
  vérifier » gardent le leur (« 48+ »). Plus de phrase de couverture sous les pastilles.
- « Tout marquer lu » (ou « Marquer ceux-ci lus » sous un filtre) ; au doigt, **glisser la ligne
  vers la droite** bascule lu / non lu (le fond « Lu / Non lu » n'existe que pendant le geste) ;
  « Marquer non lu » dans la lecture.
- En-têtes de jour collants (opaques : un flou dessous coûtait des images en défilant) ; 50 par
  page, la suite chargée au défilement (racine de l'observateur = le conteneur qui défile
  vraiment) ; « Voir plus » reste pour le clavier.
- États illustrés (petit dessin SVG, une phrase, LE geste) : vide, tout est lu, recherche vide,
  compte sans e-mail, rien à vérifier ; volet de lecture vide dessiné.
- **Lecture** : avatar + titre + « qui · compte · heure » ; la carte « ce qu'il faut savoir » —
  pour un retrait une **carte d'embarquement** (transporteur, code en 44 px + Copier, perforation,
  point de retrait mis en forme, « à retirer avant le … · dans N j » en ambre si proche) ; pour une
  vente / offre / achat / versement : le montant en grand, l'article, le N° LU, la photo ; puis les
  gestes par identité ; le message d'origine rendu proprement (mentions repliées) ; les pièces.
  Feuille opaque qui monte avec un léger ressort (`linear()`, repli : courbe des tiroirs).

## Preuves
- `npm run build` vert. `fusion-echelle --verifier` : `boite-emails.css` dans l'échelle (les autres
  fichiers rouges sont ceux de la base). Détecteur `impeccable detect` : un seul signal, le curseur
  de la scène animée de « Relier ma boîte » (`border-right` d'un caret de frappe), pas une barre.
- **`audit-boite-mail` (NEUF) : 38/38** — M1 du résumé jamais du sujet (sujet piégé), M2 code sur
  la ligne seulement lu, M3 gestes par identité, M4 message SANS HTML (`<script>`, `<iframe>`,
  `on…=`, entités, `javascript:`), M5 règle des lus, M6 la VRAIE `lireJournalEmail` sur une base
  servie dans sa forme (`_minipgrest`), M7 écriture (lecture ratée ⇒ rien écrit ; conflit relu et
  rejoué), M8 piles. `--prouve` : **13/13 mutations attrapées**. Sur l'arbre d'avant (704bdaf2,
  extrait à part) : plante (module absent) — les mutations font la preuve.
- **Banc `scripts/bancs/boite-mail.cjs` (NEUF)** — 950 e-mails inventés aux proportions mesurées
  (`_fx-boite-mail.cjs`), la VRAIE route, 390 tactile et 1512, clair et sombre + mode stream :
  **104 verts / 0 rouge**. Sa copie réelle (hors dépôt, 971 e-mails, `BANC_FX`) : **96 / 0**. Règles
  jugées : R1 aucun sujet brut sur ~940 lignes, R2 code ⇔ code lu + copie d'un toucher (sans ouvrir),
  R3 point bleu, ouvrir = lu écrit et relu par la règle, R4 gestes portant SON identité, R5 texte
  piégé inerte, R6 glisser = lu sans ouvrir, R7 « Non lus » côté route + « Marquer ceux-ci lus »,
  R8 piles dépliées ; stream : aucun code lisible (liste et carte). Zéro erreur console, zéro
  « undefined/NaN/null », rien qui dépasse, 44 px partout (liens dans le texte exceptés). **Arbre
  d'avant** (banc copié dedans) : R2, R3 rouges puis l'écran lève (aucun non-lu à trouver).
- **Bancs voisins** : `boite-emails` **282 / 0** (attendus mis à jour pour les règles changées :
  rubrique Offres, code sous la ligne et dans la carte, avatar transporteur, titre de lecture à
  côté de l'avatar, lien court cliquable) ; `onglets-c` **148 / 0**.
- Audits verts : `boite-emails` 82, `email-formes` 17, `coherence` 219, `identite` 57, `secrets`,
  `csp` 41, `tdz`, `journal-emails` 58 (Colis : toujours UNE lecture, deux scalaires), `relier-compte`
  44, `comptes-emails-ligne`, `adresse-sans-compte`, `fonctions-api` (12/12), `icones`,
  `lectures-lourdes`, `bancs`. `export-donnees` X6 rouge **déjà sur la base** (non touché).

### Mesures avant → après (banc, Chromium logiciel ; écarts de ±20 % d'une passe à l'autre)
Inventé (950 e-mails) :

| contexte | 1re ligne (ms) | boîte entière (ms) | défilement (images/s) | tâches longues (n · ms) | nœuds | ouvrir (médiane ms) |
|---|---|---|---|---|---|---|
| 390 clair | 4663 → 4498 | 48606 → 11531 | 49 → 52 | 13 · 1536 → 6 · 707 | 12097 → 9004 | 931 → 724 |
| 1512 clair | 2005 → 1956 | 70771 → 11943 | 15 → 26 | 172 · 28577 → 68 · 8577 | 12103 → 9012 | 1360 → 937 |
| 390 sombre | 1660 → 1703 | 41082 → 4891 | 49 → 62 | 10 · 1195 → 0 · 0 | 12097 → 9004 | 952 → 446 |
| 1512 sombre | 2592 → 1861 | 65118 → 7931 | 36 → 54 | 49 · 5442 → 2 · 225 | 12103 → 9012 | 847 → 568 |

Sa copie (971 e-mails) :

| contexte | 1re ligne (ms) | boîte entière (ms) | défilement (images/s) | tâches longues (n · ms) | nœuds | ouvrir (médiane ms) |
|---|---|---|---|---|---|---|
| 390 clair | 2803 → 2408 | 39338 → 5961 | 50 → 60 | 20 · 1397 → 1 · 80 | 12757 → 13760 | 1090 → 566 |
| 1512 clair | 3255 → 2273 | 64264 → 10799 | 16 → 50 | 195 · 27775 → 20 · 1634 | 12763 → 13768 | 1105 → 740 |
| 390 sombre | 3133 → 1747 | 40562 → 6952 | 47 → 61 | 19 · 1686 → 2 · 147 | 12757 → 13760 | 938 → 542 |
| 1512 sombre | 1394 → 1266 | 28861 → 5975 | 46 → 54 | 23 · 1677 → 10 · 708 | 12763 → 13768 | 674 → 542 |

« Boîte entière » : avant, 47 touchers de « Voir plus » (20 par page) ; après, la suite vient au
défilement (50 par page). Défauts de vitesse trouvés et corrigés en route, mesurés : un flou sous
les en-têtes de jour collants (11 images/s à 1512), `content-visibility` (vidait le texte des lignes
hors écran : banc rouge, recherche de page et stream aveugles), des lignes mémoïsées qui se
redessinaient à chaque rendu de l'app (`delies` et `ecrireLus` neufs à chaque fois), et
l'observateur de la suite qui avait la page pour racine (rogné par le `<main>` qui défile, il ne
voyait jamais la sentinelle à 1512) — racine = le conteneur qui défile vraiment.

Captures et planches regardées (hors dépôt, scratchpad de la session `bm/`) : `planche-invente-390`,
`planche-invente-1512`, `planche-reel-390`, `planche-reel-1512` (avant | après), et `apres-*/`
(`nonlus-*`, `pile-*`, `stream-*`). Vu sur capture et corrigé : monogramme blanc sur tuile blanche la
nuit (transporteur), « sur <article> » répété sous la carte d'une offre, heure de pile sur deux
lignes, menu des comptes coupé, natures longues sur deux lignes.

### Alignement avec `v36-visuel`
Sa passation (branche `v36-visuel`) : listes en groupes iOS, filets après la photo, pas de barre
latérale, cascade d'arrivée (6 px, 220 ms, 30 ms, 10 lignes), une ligne d'explication au plus. Ici :
la même cascade, la barre ambre du bandeau « comptes à relier » retirée, filets décalés. Ses
composants (`src/composants/Ios.jsx`) ne sont pas sur cette branche : rien n'en dépend ici ; à
l'intégration, la boîte peut prendre ses jetons d'espacement (`--vrm-entre-sections`).

## Ce qui reste / à décider par Julien
- **Le HTML d'origine** (mise en page de Vinted, photo de l'article dans l'e-mail) n'est pas gardé
  à la réception. Le garder coûterait des dizaines de Ko par e-mail (~100/jour, base à 236 Mo sur
  500) : proposé — garder le HTML ASSAINI des seuls e-mails « à geste » (vente, bordereau, colis à
  retirer, offre, achat) 30 jours, puis le purger. Pas posé sans sa décision.
- Les 470 e-mails d'avant le 31 oct. n'ont ni résumé ni texte : ils restent « détail non gardé ».
- Plan du point relais dans la carte : l'app a une carte (MapLibre, Colis → À retirer) mais aucun
  plan statique ; rien n'est ajouté ici (le geste « Voir le colis à retirer » y mène).
- La photo ne vient que des ventes (n° de transaction d'un bordereau) ; un achat n'en a pas encore.
- Couleur : aucune proposée (la palette suffit).

## Geste de Julien
Ouvrir **E-mails** au téléphone : toucher le code d'un colis à retirer sur la ligne (il est copié),
ouvrir l'e-mail (carte d'embarquement), glisser une ligne vers la droite (lu / non lu), toucher une
pile « Commande mise à jour ».
