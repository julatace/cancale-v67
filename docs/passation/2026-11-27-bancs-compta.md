# 27 nov. · Les dix bancs compta remis au vert (`claude/bancs-compta`)

Dix bancs compta étaient rouges sur `main` (hors CI bloquante), plus `audit-pas-su --prouve` (6/7) et
`audit-registres --prouve` (17/18). Chacun : cause trouvée, puis l'app corrigée (un vrai défaut) ou le banc
porté à l'écran et à la règle d'aujourd'hui. Aucune garantie retirée sans la décision qui l'a retirée.

## Un défaut de l'app, corrigé
**« J'ai déclaré » ne faisait plus rien.** Les trois boutons (Argent → Résumé/Déclarer, « Tes déclarations
URSSAF », la ligne URSSAF d'Aujourd'hui) posent `DEMANDE_DECLARATION` et mènent à Ventes, où le rapport comptable
devait s'ouvrir sur le mois. Depuis Ventes natif, Ventes est rendu par l'instance « Colis dans Ventes »
(`Comptabilite only="bordereaux" colisDans="ventes"`, App.jsx `rendreColisSection`) : plus aucune instance
`curSub === 'ventes'` n'était montée, rien ne s'ouvrait. Correctif : `hoteVentes` (src/ecrans/Comptabilite.jsx).
Et `RaisonDeclBloquee` porte `data-decl-bloque-etat` (`encours` / `rate`) : « lecture en cours » est un état de
passage, un banc attend un vrai refus.

## Bancs portés (cause → où vit chaque garantie)
| banc | cause | port |
|---|---|---|
| achats-export | décision du 19 nov. « 2 oui » : le prix du REÇU se pose seul (src/prixAchatRecu.js) ; Ventes s'ouvre sur « À envoyer » | A juge la règle rendue : N°12 85,40 € posé seul (lien, source reçu) ; N°13 sans reçu rien ; 10 fiches identiques rien ; reçus illisibles rien. « Garder / Corriger / Tout garder » retirés par la même décision (l'atelier Compléter a son banc). |
| registres | colonne « Paires » → mot du vendeur (`motsVendeur().Noms`, §2.11) | la même ligne en gros, colonne « Paires » ou « Articles » |
| urssaf | Argent à quatre segments (10 nov.) : la carte du mois est dans « Déclarer » ; espace insécable avant « % » | on y va d'un toucher ; mêmes nombres jugés |
| suivi-urssaf | segment Déclarer ; écritures de `main` en PATCH conditionnel (src/ligneCas.js) servies `[]` ⇒ refus ; « J'ai déclaré » cassé (ci-dessus) | `_ecriture-representee.cjs` ; repli du suivi seul ouvert ; attente de l'écriture, pas d'un délai |
| declare-urssaf | idem + rapport sans menu « Outils » (Ventes natif) ; « Ma journée » (`BeneficeJournee`) plus montée ; bouton natif grisé = `aria-disabled` | A/C sur Résumé (boutons VISIBLES), relevé (D) par « J'ai déclaré » ; E/F dans Argent → Ton bénéfice / Tes dépenses ; deux points « À DÉCIDER » rapportés (plus bas) |
| dac7-comptes | règle du 6 nov. (src/aDaterAnnee.js : vendue cette année = comptée) ; segment Déclarer ; sombre par défaut (25 nov.) | 82100 compté (n=6) ; « au moins » et manque NOMMÉ jugés sur 82101, vendue fin de l'an dernier ; « clair » posé comme SON choix ; cibles 44 px au doigt, 32 px à la souris (5 nov., chantier B) |
| export-donnees | RGPD (12 nov.) : pages du serveur `GET /api/compte?mode=mes-donnees` ; Paramètres en catégories (15 nov.) ; port fixe | pages servies à leur forme (2 pages, `suite`) et recollées ; panne ⇒ INCOMPLET.txt ; la lecture GET n'est pas une écriture ; nom du geste + au plus une ligne (23 nov., plafond tenu par textes-visibles) |
| compta-claire | Argent (10 nov., Julien 9 nov. « Compta trop flou ») ; montants ronds sans centimes ; zone de toucher `::after` | réponses d'Argent dans l'ordre, la carte « gagne » dans « Ton bénéfice » (un toucher) ; montants ronds comptés (U plus fort) ; lignes d'« À venir » = détail d'un total |
| statut-fiscal, seuils-prevision | segment Déclarer + replis ; écritures CAS | `ouvrirCarte` (scripts/bancs/_compta.cjs) : le segment puis les replis de la carte seulement |
| audit-pas-su `--prouve` | la grille Achats vit dans src/ecrans/Comptabilite.jsx (découpe du 22 nov.) | mutation remise sur ce fichier : 7/7 |
| audit-registres `--prouve` | l'appel porte `importees, main, declare` depuis le 11 nov. | motif de mutation à jour : 18/18 |

## Preuves
- Les dix bancs verts avec les polices de la CI (`FONTCONFIG_FILE=…/fc/fonts.conf`), lancés par `scripts/lancer-bancs.cjs`.
- Mutations (arbre `git archive`, posées ensemble, un build) — chaque banc rougit sur SES contrôles :
  M1 `hoteVentes` retiré ⇒ declare-urssaf A/B/C/D, suivi-urssaf D/S · M2 l'article seul posé comme payé ⇒
  achats-export A N°13 · M3 règle du 6 nov. oubliée ⇒ dac7-comptes (2 contrôles × 4 modes) · M4 achat en gros
  refait de ses parts ⇒ registres (16) · M5 versement libératoire oublié (src/profilFiscal.js) ⇒ statut-fiscal C ·
  M6 à payer + 1 centime ⇒ urssaf, compta-claire M, achats-export B · M7 rythme deviné ⇒ seuils-prevision C ·
  M8 page RGPD ratée passée sous silence ⇒ export-donnees (panne) · M9 « À déclarer » avant « Vendu » ⇒ compta-claire Q.
- CI : les dix bancs entrent dans les bancs bloquants (une part chacun) ; `ci-controles --diff origin/main` :
  dix ajouts, rien retiré.

## À décider par Julien
1. **Aujourd'hui ne dit plus « avant tes dépenses »** quand aucune dépense n'a jamais été notée (règle du 22 oct.,
   proposition 9) : la case « Bénéfice » de l'ancienne Ma journée n'est plus montée, la tuile d'Aujourd'hui montre
   le net seul. Dans Argent, le chiffre se nomme bien « Net avant tes dépenses » (infobulle), mais le choix « Je
   n'ai pas de dépenses à noter / Ajouter une dépense » est CACHÉ (src/design/fusion.css §15, maquette du 2 nov.).
   Le banc le rapporte (« À DÉCIDER ») sans le juger. Le remettre visible, ou acter son retrait ?
2. **Argent → Résumé redit un montant** : « Reçu 60 € » et, sous l'URSSAF, « 12,4 % de 60 € reçus » quand la période
   déclarée est le mois en cours (§7 : un nombre, une fois). Rapporté par compta-claire.
3. **Deux boutons « J'ai déclaré » visibles dans Argent → Déclarer** (la carte « Prochaine déclaration »
   `data-compta-urssaf` et le parcours URSSAF) : un doublon (§7).
4. **« Rapport comptable » n'est plus atteignable depuis Ventes** (le menu « Outils » de l'ancien Ventes) ; il
   s'ouvre seulement par « J'ai déclaré ». À rendre ailleurs ?
5. La ligne d'aide d'« Exporter mes données » fait 10 mots (règle du 23 nov. : 8).

## Geste de Julien
Aucun.
