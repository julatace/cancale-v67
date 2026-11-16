# 16 nov. — lot `derniers-rouges` : les derniers rouges de main

Suite du lot `audits-vert-main` (69 → 3 audits rouges). Mission : `audit-vendeur-generaliste`,
`audit-vocabulaire-article`, `audit-infos-vinted`, `audit-notifs-redaction`, puis les bancs principaux
que personne ne traite (annonces-actions, chiffres-coherents, statut-colis, navigation-tache,
budget-vitesse) et la part 2 des bancs coupée à 45 min.

## 1. `audit-notifs-redaction` (rouge sur main, cause inconnue) — VRAI défaut, d'horloge

Cause : `sendPushToAll` (api/_lib/push.js) date chaque entrée du centre avec SON horloge
(`instantNotif()`, qui lit `VRM_NOTIF_HORLOGE` aux bancs), mais comptait les non lues des 24 h avec
`nonLuesDeGenre(…)` sur `Date.now()` (valeur par défaut). L'horloge du banc est le 15 nov. 13 h 28 :
le 16 nov. à 13 h 28 passé, les 8 offres « avaient plus de 24 h » ⇒ k = 1, jamais « 8 offres à
trancher ». En production les deux horloges sont la même ; la règle reste fausse dès qu'une horloge
est posée (bancs, rejeu). Correctif : `nonLuesDeGenre(rangee.entrees, genre.id, lu, t)`.
Preuve : 134 → 139 verts ; l'appel d'avant (sans `t`) ⇒ 5 rouges (section 4).

## 2. `audit-vocabulaire-article` et `audit-vendeur-generaliste` — vrais défauts

Mesuré : 143 textes « paire(s) » hors liste (sortie complète par `VOCAB_TOUT=1`), dont 82 phrases
de dictionnaire arrivées avec les lots des 14-15 nov. (deux comptes, atelier, fiche, idées, liste,
retrait ailleurs, numéros nouveaux…), 20 lignes de « Quoi de neuf », 2 vidéos d'aide, une carte de
Ma journée ; la SEMELLE demandée à tout vendeur (fiche « Infos à partager », « + semelle » dans la
réponse) ; « air max 90 », « dunk 42 » en exemple à tous.

- **Une règle** (src/i18n/index.js) : `t(clé)` choisit `clé.art` quand le vendeur ne vend pas (que)
  des sneakers (`vendCourant()` de src/profilVendeur.js) et que la variante existe. Sneakers : le
  texte d'avant, mot pour mot. Les variantes : `src/i18n/langues/{fr,en,es,it,de}/article.js`
  (82 clés × 5 langues, accords faits à la main : « cet article », « lequel », « retire-le »,
  « der Artikel », « gli articoli »…). Aucun appel à changer.
- « Quoi de neuf » : `nouveautesDuCompte` passe titre et phrase par `phraseVendeur` (« pas su » ⇒ le
  mot neutre) ; vidéos d'aide (AideVideo.jsx) et cartes de Ma journée (JourneePerso.jsx) aussi ;
  leurs 23 phrases ont leur version écrite en entier dans `PHRASES_ARTICLE`.
- Semelle : le champ ne se montre qu'à un vendeur de Sneakers, ou s'il est déjà rempli
  (InfosPaire.jsx) ; « + semelle » ne se propose qu'à lui (AideReponse.jsx).
- Exemples : « air max 90 » / « Nike » / « 42,5 / 43 » seulement pour Sneakers (AchatsPlus.jsx) ;
  « 124, B125 ou un mot du titre » sinon (`ia.vm.numeroExemple.art`).
- Les audits portés sur la RÈGLE, rien d'affaibli : une clé de traduction passée à `tr()` n'est pas
  un texte (son texte est jugé dans le dictionnaire) ; une phrase de dictionnaire n'est gardée que
  si sa variante `.art` (ou `.autre` pour une clé `.sneakers`) existe ET ne dit pas le mot ;
  A1 EXÉCUTE `t()` (Sneakers ⇒ texte d'avant, autre ⇒ variante, clé sans variante inchangée) ;
  B11 exige la version « article » de chaque phrase de vidéo, carte, nouveauté, et que l'écran la
  prenne. Les permis ajoutés, chacun avec sa raison : libellés exacts des catégories Leboncoin /
  Vestiaire et chemins Vinted (src/correspondances.js), mots de LECTURE (questions d'acheteur,
  recherche des réglages, mots vides), expression de lecture d'une taille, variantes féminines
  `…F`, projection PostgREST, critère « Pointure » d'une catégorie chaussure.
- Preuves : vocabulaire-article 1 rouge → vert ; `--prouve` 24/24 mutations (4 neuves :
  `t()` sans variante, Quoi de neuf sans phraseVendeur, vidéo sans phraseVendeur, variante qui
  redit « paire » ; la vidéo d'abord VERTE sous mutation, le contrôle resserré, puis rouge).
  vendeur-generaliste 2 rouges → vert ; `--prouve` 23/23 (3 neuves : semelle pour tous,
  « dunk 42 » remis, « air max 90 » pour tous). traduction, quoi-de-neuf, annuler-commandes,
  journee-perso, aide-videos, vendeurs-differents, textes-courts, variables, tdz : verts.

## 3. `audit-infos-vinted` — recopie, sans version (PR séparée #1210)

`node scripts/regles-achat-extension.cjs --recopie` ⇒ `vinted-sync-extension/vrm-regles-achat.js`
(frais par plateforme : boosts, commandes eBay dans une autre devise écartées). Contenu d'extension
changé ⇒ `audit-extension-zip` rouge tant qu'elle part seule (5.393.0 déjà servie). Branche
`claude/regles-achat-recopie`, PR #1210 « à fusionner avec la dernière montée de version » ; ligne
écrite dans le fichier des versions réservées du 16 nov. (le train qui monte 5.399/5.400 la prend
dans sa DERNIÈRE version, puis régénère les zips). Aucune version montée ici.

## 4. Bancs

- **Part 2 coupée** : mesuré sur la CI du 16 nov. (job 133301529302) : navigation-tache 9 min,
  budget-vitesse 18 min (3 essais par écran hors budget), accessibilite 8 min et pas finie au délai
  de 45 min ; part 1 : 6 min. Rééquilibré dans `.github/workflows/verifier.yml` (budget-vitesse en
  part 1) : ~25 / ~25 / ~33 min, plutôt qu'un délai allongé (une part rouge coupée ne dit même pas
  quels bancs sont rouges).
- **annonces-actions F à 1512** : vrai défaut — les gestes du carré (« Republier à la main »,
  « Prix mini… », « Baisser le prix… », « Publier partout… », « Nouveautés de la semaine ») sont
  des `Bouton` de 40 px au bureau, ajoutés au carré après le banc (11 nov.) ; 44 px à toute largeur
  dans le carré (styles-annonces-coherence.css), comme les tuiles.

(suite : voir ÉTAT À LA REPRISE)

## ÉTAT À LA REPRISE

(à compléter en fin de lot)
