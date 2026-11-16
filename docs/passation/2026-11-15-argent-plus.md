# 15 nov. 2026 — Argent plus : bilan de fin de mois, alertes de seuils, bénéfice par article, sauvegarde

Branche `claude/argent-plus` (partie de `origin/claude/project-review-nsk5su`). Julien : « vas-y fais tout ».
Un autre chantier (`claude/ecrans-verre-2`) refait la DISPOSITION de l'écran Argent : ce lot n'y touche pas —
il ajoute des composants séparés (que ce chantier placera) et la logique dans des règles pures.

## Ce qui existait déjà (mesuré dans le code avant d'écrire)

- La carte « Bilan du mois » (Argent → Le détail) et son PDF (`src/bilanMois.js`, 5 nov.), le « Rapport du mois »
  (11 nov.), l'export « Pour mon comptable » (zip : PDF + xlsx + CSV, 9-11 nov.), l'e-mail du bilan le 1er
  (`api/_lib/bilan-mois.js`, 8 nov.), la notification URSSAF du 1er (`api/_lib/rappel-urssaf.js`).
- La jauge « Tes seuils » (`jaugeSeuils`, `src/microEntreprise.js`, seuils 2026 vérifiés avec leur fiche
  service-public) et DAC7 par plateforme / par compte (`src/seuilsAnnee.js`, `src/dac7Comptes.js`).
- Le bénéfice d'une vente (`beneficeLigneVente` → `beneficePaire`), la cascade (`cascadeVente`), le
  « si vendue » (`src/dormantes.js`), la tuile « Bénéfice » de la fiche (`src/fichePaire.js`).
- « Exporter mes données » (7 tableaux CSV + toutes les lignes générées par le SERVEUR, RGPD) — sans PDF.

Il manquait : l'URSSAF et les articles qui dorment dans le bilan, une NOTIFICATION du bilan, un tableur du bilan,
des ALERTES (une fois chacune) au lieu d'une jauge qu'il faut aller voir, les frais du site dans le bénéfice
d'un article, un total de liste honnête, et une sauvegarde faite dans le navigateur avec les bordereaux.

## 1. Le bilan de fin de mois

- `src/bilanFinMois.js` (pur, l'app ET le serveur l'importent) : `urssafDuBilan` — états `encours` · `regime`
  (aucun régime choisi : « choisis ton régime », jamais deviné) · `autre` (particulier, société, marge) ·
  `passu` · `su` (« au moins » quand la règle le dit, JAMAIS « au moins 0 ») ; le montant est
  `montantPeriodeUrssaf` (la règle de la carte « Prochaine déclaration ») sur le MOIS. `lignesFinMois` ajoute
  « URSSAF du mois » et « Articles qui dorment » (`dormentDe`, la règle du bilan de la semaine et de Ma semaine,
  sur la publication `vrm_paires_dorment`). `lignesTableurBilan` : le tableur = les MÊMES lignes que la carte.
- `bilanDuMois` accepte `enPlus` (ajouté à la fin) : la carte, le PDF et le Rapport du mois les lisent sans
  changement de disposition. La carte : la ligne URSSAF porte « Choisir mon régime » quand il n'y en a pas.
- `src/BilanFinMois.jsx` `ExportBilanMois` : le pied de la carte — PDF (inchangé), **Tableur** (CSV « ; »,
  BOM), **« Pour mon comptable »** (ouvre l'export comptable complet sur CE mois ; l'export accepte désormais
  un mois demandé, plus seulement une année).
- La NOTIFICATION du 1er : `api/_lib/argent-passes.js` `passeBilanMoisPush`, dans le passage du matin de
  `api/ship-reminders.js` (rattrapage jusqu'au 7 si rien n'était lisible), UNE fois par mois
  (`bilan_mois_push_dedup`, réservé par comparer-et-échanger AVANT l'envoi ; mémo illisible ⇒ rien), famille
  « Rappels » (cat `bilan`). Les chiffres : `calculerBilanMois` (le calcul de l'e-mail, miroir des règles de
  l'app) — vendu au jour de la vente, reçu au jour du versement — + l'URSSAF du mois (miroir
  `api/_lib/urssaf-regle.js`) + qui dorment. Le texte : sorte `bilanMois` de la règle de rédaction
  (`api/_lib/argent-notif.js`, 5 langues, ≤ 40 / ≤ 90) : « Ton bilan d’octobre » / « Vendu 1 240 € · reçu
  au moins 980,50 € · URSSAF au moins 121,58 € · 12 qui dorment ». Elle ouvre Argent → « Bilan du mois » de
  CE mois (`DESTINATIONS.bilanMois`), où sont le bénéfice et sa couverture, le meilleur compte, PDF et tableur.
  Les lectures du bilan sont faites UNE fois pour l'e-mail et la notification. La réponse du cron : des états.
- ⚠️ **Le bénéfice reste « Bénéfice » avec sa couverture (« prix d'achat connus 3/4 »), pas « au moins »** :
  la règle du 13 nov. (`src/beneficeNoms.js`) le refuse — une vente au prix d'achat inconnu peut être à perte,
  ce n'est pas un plancher. La demande disait « au moins » ; la règle de Julien gagne.

## 2. Les alertes de seuils (80 %, puis 100 %, une fois chacune)

- `src/alertesSeuils.js` (pur) : `alertesSeuils` lit le CA de l'année TEL QUE L'APP LE CALCULE (`caAnnee` sur
  la ligne publiée `vinted_urssaf_mois`, datée au versement) et `seuilsDe(année, activité)` ; plafond micro
  (203 100 €), TVA (85 000 €, 93 500 €) **seulement si le régime choisi est micro** ; DAC7 par plateforme
  (`dac7ParPlateforme` / `atteintDac7` : 30 ventes OU PLUS de 2 000 €, centimes entiers) pour tous. « Dépasse »
  = strictement au-dessus. Un CA partiel est un minimum : au-dessus d'un palier ⇒ atteint, dit « au moins ».
  Une année sans seuils vérifiés ⇒ rien (jamais un plafond périmé). `alertesADire` : le plus haut palier pas
  encore dit ; 100 % atteint d'un coup ⇒ une seule alerte, les deux paliers rangés.
- Les phrases (5 langues, une source pour l'écran ET la notification) disent ce que dit le texte officiel :
  - plafond micro : **F32353** (entreprendre.service-public.gouv.fr, « vérifié le 21 février 2026 ») — dépassé
    deux années de suite ⇒ sortie du régime micro au 1er janvier suivant ; une seule année ne fait pas sortir ;
  - TVA : **F21746** (« vérifié le 1er janvier 2026 ») — au-delà de 85 000 € (sans 93 500 €) ⇒ TVA au
    1er janvier suivant ; au-delà de 93 500 € ⇒ TVA dès le jour du dépassement ;
  - DAC7 : **directive (UE) 2021/514** (eur-lex.europa.eu/eli/dir/2021/514/oj) — la plateforme transmet les
    vendeurs à 30 ventes ou plus de 2 000 € et leur remet ces informations au plus tard le 31 janvier.
  Aucune phrase ne conseille (« tu dois… ») : elles disent la règle et sa source, en lien.
- L'écran : `src/AlertesSeuils.jsx` (placé en tête du Résumé d'Argent ; RIEN rendu s'il n'y a rien à dire),
  « Compris » range les clés dans `vrm_seuils_vus` (SYNC_KEYS : une fois, sur tous ses appareils). Cible de
  notification `seuils` (`src/cibleNotif.js`).
- La notification : `passeSeuilsPush`, chaque matin, cat `seuil` (famille « Rappels »), 3 au plus par passage,
  `seuils_alertes_dedup` réservé avant l'envoi.

## 3. Le bénéfice réel par article

- `src/beneficeArticle.js` (pur) ASSEMBLE les règles existantes : ce que le site VERSE (Vinted et Leboncoin =
  le prix, aucune commission vendeur ; eBay = `montantRecuEbay`, frais eBay LUS, port jamais compté ;
  Vestiaire = le versé `sellerEarning`, commission = prix − versé quand les deux sont lus) puis
  `beneficeLigneVente` sur ce versé (− prix d'achat saisi − frais saisis : boost, port payé par lui, emballage,
  commission notée…). États nommés : `ok` · `partiel` (« au plus » : frais pas confirmés, un plafond) · `achat`
  · `plateforme` (frais du site pas lus) · `prix` · `illisible` · `annulee`. Mille tirages au centime = la
  règle de la ligne ; vente − site − saisis − achat = bénéfice.
- `beneficeListe` : la somme des articles calculables « sur N ventes de M », « au plus » si l'un est au plus,
  les manques comptés (prix d'achat à saisir, frais du site pas lus, frais à confirmer, prix pas lus) —
  **jamais « au moins »** (même raison qu'au §1). Le nom : « Après frais de vente » (`NOM_APRES_FRAIS`).
- `src/BeneficeArticle.jsx` : `BeneficeListeResume` en tête de la liste des ventes (Ventes) ; sur la fiche,
  `BeneficeArticleDetail` ne montre que ce que les tuiles ne disent pas déjà (frais du site, frais notés ; eBay :
  le dû au vendeur) — le même nombre ne s'écrit jamais deux fois (§7).
- **Défaut corrigé** : la fiche d'une vente eBay comptait « versé − achat » sans les frais SAISIS, alors que
  Ventes et la compta (`ventesAutresBenefice`) les retirent. Elle passe par la même règle (`fichePaire.js`).

## 4. « Télécharger toutes mes données »

- Paramètres → Sécurité des données (`src/SauvegardeDonnees.jsx`, logique `src/sauvegardeDonnees.js`) : un zip
  fait DANS LE NAVIGATEUR depuis SES lignes (sa session, RLS, et `owner=eq.<lui>` sur chaque lecture), rien
  envoyé ailleurs, rien lu avant son clic. Un dossier `VRM-sauvegarde-AAAA-MM-JJ/` : `donnees/<catégorie>.json`
  (ventes, achats, annonces, colis, messages, compta, e-mails, réglages, autres), `tableaux/ventes.csv`,
  `achats.csv` (ceux d'« Exporter mes données »), `annonces.csv` (les dressings lus, N° par identité),
  `bordereaux/*.pdf` (ceux encore en base), `LISEZMOI.txt`.
- §4.5 : tout par `lireTout` (pagination). §4.4 : les lignes lourdes (`LOURDS`, LES MÊMES que l'export RGPD du
  serveur — l'audit exige l'égalité) ne donnent que `id, updated_at, meta` ; le PDF d'un bordereau se lit SEUL
  (`data->>pdfB64`, `%PDF` vérifié, `label_latest` exclu, 3 à la fois), sans les effets de `lirePdfLigne`
  (garde hors connexion, lecture du transporteur). Les lignes `SECRETS` ne sont pas lues ; tout champ de jeton
  est retiré (`sansSecrets`, la règle du serveur). Une lecture ratée ⇒ « incomplet », NOMMÉE à l'écran et dans
  LISEZMOI.txt (jamais un zip présenté complet).

## Preuves

- `node scripts/audit-argent-plus.cjs` — **78 contrôles verts** : il EXÉCUTE les règles (esbuild), le vrai
  `calculerBilanMois` et le vrai `montantPeriodeUrssaf` (miroir) sur une base inventée, la rédaction en 5
  langues (≤ 40 / ≤ 90), les passes du cron (une fois, mémo illisible ⇒ rien, réservation ratée ⇒ rien, après
  le 7 rien n'est lu), `parcoursPaire` (fiche eBay), la sauvegarde sur une fausse base (owner partout, jamais
  `data` lourd, page ratée nommée, zip relu, aucun secret), les clés de traduction. `--mutation` : **14/14
  mutations rougissent** (au moins 0, régime deviné, qui dorment à 0, palier 70 %, « dépasse » = « atteint »,
  régime ignoré, deux fois la même alerte, eBay au prix au lieu du versé, liste jamais « au plus », fiche eBay
  sans frais saisis, owner retiré, motif lourd oublié, page ratée tue, envoi sans mémo). Sur l'arbre de départ
  (`git archive 3093d6f0`), l'audit est rouge (les modules n'existent pas).
- Banc `scripts/bancs/argent-plus.cjs` (données inventées, base servie par le banc de `nouveau-vendeur`, 390
  tactile clair + 1512 sombre, statut micro ET statut jamais choisi) : **116 verts**. S1 l'alerte en tête
  d'Argent (TVA dépassée, TVA majorée à 80 %, DAC7 Vinted atteint ; plafond micro à 44 % muet ; sans régime :
  DAC7 seul), sources officielles en lien, « Compris » écrit `vrm_seuils_vus` dans la base et l'alerte ne
  revient pas au rechargement ; S2 la cible de la notification ouvre le Bilan du mois écoulé : URSSAF du mois
  = 30 000 € × 12,4 % = 3 720 € (ou « — » + « Choisir mon régime »), 5 articles qui dorment, le tableur
  téléchargé dit les MÊMES valeurs que la carte, le PDF est un PDF ; S3 Ventes : « Après frais de vente 36 € ·
  sur 1 vente de 4 » (68 − 2 − 30), le manque pas redit sous le bandeau qui le dit déjà ; S4 « Télécharger
  toutes mes données » : un zip, UN dossier, JSON par catégorie, les 3 tableaux (12 annonces), le PDF du
  bordereau, aucun jeton, chaque lecture DE LA SAUVEGARDE porte `owner=eq.`, jamais `select=data` lourd, aucune
  écriture ; S5 aucune erreur JS, rien ne déborde. Captures : `docs/passation/captures-argent-plus/`.
  ⚠️ Les tableaux ventes/achats réutilisent les lecteurs d'« Exporter mes données » (RLS seule, sans
  `owner=eq.`, comme toutes les lectures de l'app) : le banc l'a vu ; laissé tel quel (une règle).
  Non fait : le banc sur le build de l'arbre de départ (disque à 95 %, machine saturée) — ses contrôles
  portent sur des `data-*` que l'arbre de départ n'avait pas ; l'audit, lui, a été lancé sur l'arbre de départ.
- Audits voisins relancés, verts : `audit-rappel-urssaf`, `audit-urssaf`, `audit-une-regle` (9 verts),
  `audit-chiffres`, `audit-bilan-mois` (51 — son contrôle du branchement suit les lectures partagées),
  `audit-chantier-f` (24), `audit-quoi-de-neuf`, `audit-fonctions-api` (12/12), `audit-traduction` (45),
  `audit-variables`, `audit-tdz`, `audit-export-rgpd` (25), `audit-export-donnees` (19), `audit-seuils-annee`
  (20), `audit-pas-su` (17), `audit-benefice-unique` (56), `audit-coherence`. `npm run build` vert.

## Vu en passant (pas corrigé ici)

- `src/i18n/langues/fr.js` porte DEUX fois la clé `reglages.securite.lib` (« Sécurité des données » puis
  « Sécurité des comptes ») : le panneau Sécurité des données s'intitule « Sécurité des comptes » à l'écran.
  À trancher par le chantier Paramètres (`claude/ecrans-verre-2` le refait).

## Gestes de Julien

Aucun pour l'app. La notification du 1er décembre sera la première (famille « Rappels », réglable).
