# 9 nov. 2026 — Ma configuration : tout ce qui se personnalise, au départ, en plein écran

Branche `claude/configuration-depart` (depuis `origin/main` 868ac2a8). Pas de PR, pas de merge.
Rien dans `vinted-sync-extension/` ni `public/`.

Julien, 9 nov. : « Le choix des plateformes au tout début doit être vraiment en plein milieu de
l'écran, prendre tout l'écran. Que ce soit là que tu choisis ton régime d'entreprise, absolument
tout : ta méthode d'étiquetage, sur quelles plateformes tu vends, etc. Tout ce qui est
personnalisable, tu le fais. Améliore aussi la personnalisation suivant ton régime, ce n'est
vraiment pas encore abouti. »

## Ce qui change pour le vendeur

1. **« Ma configuration », plein écran** (`src/ConfigurationDepart.jsx`, `src/configuration-depart.css`) :
   une étape par écran, titre 34 px centré, barre de progression, « Retour », « Plus tard », des
   cartes à toucher (≥ 44 px, une coche bleue, jamais une liste de cases). Étapes :
   | # | étape | ce qu'elle écrit (clés EXISTANTES sauf mention) |
   |---|---|---|
   | 1 | Que vends-tu ? (sneakers / autre chose) | `vrm_je_vends` |
   | 2 | Où vends-tu ? (Vinted, Leboncoin, eBay, Vestiaire ; un compte relié reste coché) | `vrm_plateformes_affichees` |
   | 3 | Quel est ton statut ? particulier · micro achat-revente · micro prestations · société (EI au réel, EURL, SASU…) · je ne sais pas encore | `vinted_regime` (+ `vrm_micro_options.activite`, `vinted_urssaf_taux`) ; « je ne sais pas » ⇒ `null`, retenu dans `vrm_configuration.statut` |
   | 4 | (micro) rythme mensuel/trimestriel, versement libératoire oui/non, ACRE non/avant/depuis juillet 2026 — le taux se compose sous ses yeux | `vinted_urssaf_freq`, `vrm_micro_options`, `vinted_urssaf_taux` |
   | 4 | (société) franchise en base / TVA collectée / TVA sur la marge | **`vrm_societe_tva`** (nouvelle) ; « sur la marge » ⇒ `vinted_regime: 'marge'` |
   | 5 | Où est ton numéro ? VRM numérote / je numérote moi-même ⇒ où : fin de description, titre, champ référence (plusieurs, jamais aucun) | `vrm_numero_ecrit` `{ actif, ou }` (le réglage de `claude/numero-etiquette`, voir plus bas) |
   | 6 | Simple / Complet / Automatique | `vrm_affichage` |
   | 7 | Ce qui sonne sur ton téléphone (les 8 familles) | la ligne `push_prefs` LUE puis réécrite entière (heures calmes gardées) |
   | 8 | Le récap, « Modifier » par ligne, « C'est parti » | **`vrm_configuration`** `{ etat: 'fait'|'plusTard', at, statut, version }` |
2. **Quand elle s'ouvre seule** : une fois, au premier lancement — nuage lu, base qui répond, après
   Bienvenue, jamais en mode exemple, **jamais pour le propriétaire** de l'installation (Julien la
   rejoue depuis Réglages), « pas su » ⇒ pas d'ouverture, et seulement si ni la configuration ni le
   choix des plateformes n'a jamais été fait (un vendeur installé n'est jamais interrompu). La
   visite en bulles, les conseils et la feuille « compte relié » attendent qu'elle soit fermée.
3. **Rejouable** : Réglages → Affichage → **« Ma configuration »** (en tête du groupe ; le groupe
   « Mes comptes » doit rester premier, `audit-onglets-d` C1), et la carte de Ma journée
   « Termine ta configuration » / « Configure VRM » (elle remplace la question « Où vends-tu ? »
   posée en ligne dans le guide depuis le 8 nov.).
4. **Rien n'est écrasé** : les choix déjà faits sont pré-sélectionnés ; une étape n'écrit QUE ce
   qui change ; une étape sans réponse (« Passer cette étape ») n'écrit rien ; un taux URSSAF posé à
   la main (ex. 13,5 %) n'est jamais remplacé ; la méthode d'étiquetage ne touche ni
   `vinted_annonce_numeros` ni le pool — **jamais une renumérotation**. « Plus tard » écrit
   l'étape en cours puis ferme : tout ce qui a été choisi est gardé.

## La personnalisation par statut — UNE règle : `src/profilFiscal.js`

`profilFiscal({ regime, inconnu, options, rythme, tauxBrut, tvaSociete })` dit ce que chaque écran a
le droit de montrer et de calculer ; `cotisationsUrssaf` est LA règle que `urssafConcerne` de l'app
appelle (Comptabilité, Ma journée, Statistiques — bénéfice après cotisations —, rapports, rappel).

| statut | ce qui change |
|---|---|
| `null` (pas choisi) | rien calculé ni rappelé, et dit (« aucune cotisation tant que… ») |
| « je ne sais pas encore » | idem + une aide COURTE et NEUTRE (3 phrases, aucune ne tranche) et 3 pages officielles (service-public F36126, F23961, autoentrepreneur.urssaf.fr) — Compta (`AideStatutNeutre`) et la configuration |
| particulier | pas d'URSSAF, DAC7 ; **Ma journée** : rappel DAC7 rare — seulement quand une plateforme APPROCHE (≥ 80 %) le seuil sans l'atteindre, sur des ventes LUES (`dac7ParPlateforme`, la règle de Compta ; incomplet ou pas lu ⇒ rien) ; mots « tes ventes » |
| micro | URSSAF au rythme choisi, taux de SON activité, plafond et seuils TVA de SON activité (jauge de Compta), rappel de déclaration (déjà existant, serveur inchangé) |
| société / marge | pas d'URSSAF micro ; **le livre des recettes, le registre des achats et l'export comptable remontent sous « Combien je dois déclarer ? »** (rendus à un seul endroit, plus dans « Documents et réglages ») ; la TVA choisie est dite, pas dite ⇒ « choisis-la » |

Notifications : la famille « Rappels » dit, selon le statut, si la déclaration URSSAF en fait partie
(« Aucun rappel URSSAF : tu vends en particulier »…). Le serveur ne change pas : il n'envoyait déjà
le rappel URSSAF qu'à un micro (`api/_lib/rappel-urssaf.js`).

## Les taux et seuils — vérifiés le 9 nov. 2026 sur service-public.gouv.fr

| source | vérifié par la page | ce qui en est tiré |
|---|---|---|
| F36232 | « vérifié le 01 janvier 2026 » | cotisations : vente de marchandises 12,3 % (13,3 % avec VL ⇒ VL 1 %) ; prestations commerciales ou artisanales (BIC) 21,2 % (22,9 % avec VL ⇒ VL 1,7 %) |
| F23459 | « vérifié le 01 janvier 2026 » | formation professionnelle : commerciale 0,1 %, artisanale 0,3 %, libérale 0,2 % (VRM compose la commerciale ; un artisan ou un libéral pose son taux à la main) |
| F32353 | « vérifié le 21 février 2026 » | plafond micro : 203 100 € (vente), **83 600 € (services)** |
| F21746 | « vérifié le 01 janvier 2026 » | franchise de TVA 2026 : 85 000 / 93 500 € (vente), **37 500 / 41 250 € (services)** |

ACRE : la règle déjà appliquée par Compta (décret n° 2026-69 : −50 % avant le 1er juillet 2026,
−25 % depuis), appliquée aux prestations (10,6 % / 15,9 %). Résultat : achat-revente 12,4 % (13,4 %
avec VL) ; prestations 21,3 % (23 % avec VL ; ACRE 10,7 % / 16 %). Les libéraux (BNC) ne sont pas
proposés (pas de taux composé vérifié ici : ils posent leur taux à la main). Les seuils des services
sont rangés dans `SEUILS_MICRO[2026].services` (`src/microEntreprise.js`, leur propriétaire) ;
`jaugeSeuils({ …, activite })` et `seuilsDe(annee, activite)` les lisent. L'achat-revente de
`profilFiscal.TAUX_ACTIVITE.vente` recopie `TAUX_MICRO` de Compta (l'audit exige l'égalité).

## La méthode d'étiquetage = le réglage de `claude/numero-etiquette`

Au début du chantier, la branche parallèle n'était pas sur le dépôt distant (une clé
`vrm_methode_numero` avait été prévue). Elle a été fusionnée sur `main` pendant le chantier
(ddd19feb, extension 5.334) : « Où est ton numéro ? » y est **`vrm_numero_ecrit.ou`** ⊂
`['description', 'titre', 'ref']` (`OU_NUMERO`, `NOM_OU`, `basculerOu` de `src/numeroEcrit.js` ;
jamais vide ; absent = les trois). L'étape s'y branche directement, **sans clé à part**
(`vrm_methode_numero` retirée avant tout usage) : « VRM numérote » ⇒ `actif: false` (endroits
gardés) ; « Je numérote moi-même » ⇒ `actif: true` + les endroits cochés ; la date `depuis` ne
bouge que si allumé/éteint change ; un réglage allumé sans `ou` reconfirmé tel quel n'est pas réécrit.

## Où est le code

- Règles pures : `src/configurationDepart.js` (étapes, `choixInitiaux`, `ecrituresEtape`,
  `appliquerEcritures`, `ecritureFin`, `configurationAOuvrir`, `recapConfiguration`) et
  `src/profilFiscal.js` (`profilFiscal`, `cotisationsUrssaf`, `tauxMicro`, `detailTaux`,
  `tauxEstOfficiel`, `seuilsActivite`, `rappelDac7Journee`, `AIDE_NEUTRE`, `SOURCES_OFFICIELLES`).
- Écran : `src/ConfigurationDepart.jsx` (portail, plein écran, `FermeAuRetour` posé par l'app).
- Branchement : `src/App.jsx` (`ConfigurationDepartApp`, `ReprendreConfiguration`,
  `ecrirePushPrefs`, `useProfilFiscal`/`profilFiscalLu`, ouverture dans `AppCoeur`, rappel DAC7 des
  alertes `jr`, `SYNC_KEYS`) ; `src/ecrans/Compta.jsx` (`StatutFiscal`, `MicroEntreprise`,
  `AideStatutNeutre`, export devant en société) ; `src/ecrans/Reglages.jsx` (« Ma configuration »,
  note de la famille Rappels) ; `src/microEntreprise.js` (services, `activite` gardée par
  `optionsMicro` — avant, « Ton profil URSSAF » l'aurait effacée en réécrivant les options).

## Preuves (§6)

SHA : voir le rapport de fin (branche `claude/configuration-depart`, poussée à chaque commit,
`origin/main` fusionné par un vrai `git merge`).

- `npm run build` ✓.
- **Nouvel audit** `scripts/audit-configuration-depart.cjs` (F1-F8 : statut ⇒ profil, taux =
  Compta, seuils, pré-sélection, écritures, ouverture, rappel DAC7, branchement) — vert ;
  `--prouve` : **18 mutations** (statut pas choisi qui calcule, particulier avec URSSAF, société
  avec URSSAF, taux des prestations faux, VL des prestations à 1 %, taux manuel pris pour officiel,
  TVA devinée, DAC7 pour un micro, DAC7 sur ventes incomplètes, seuils services = vente, statut
  pré-coché, réécriture d'un choix inchangé, « je ne sais pas » qui pose un statut, taux manuel
  remplacé, ouverture pour le propriétaire, ouverture chez un installé, notifications écrites sans
  lecture, étape micro pour un particulier, « je numérote » sans endroit, date du réglage du N°
  réécrite) ⇒ **20 rouges**.
- **Nouveau banc** `scripts/bancs/configuration-depart.cjs` (base inventée, 390 tactile et 1512,
  clair et sombre) : C1 vendeur neuf de bout en bout (plein écran mesuré, titre centré, barre,
  cartes ≥ 44 px, chaque clé écrite dans `main`, `push_prefs` fusionnée, récap, fermeture), C2
  « Plus tard » garde les choix et « Reprendre » rouvre coché, C3 vendeur installé : rien ne
  s'ouvre seul, Réglages la rouvre pré-sélectionnée, tout passer n'écrase RIEN (taux manuel 13,5 %,
  numéros, réglages, push_prefs pas réécrite), C4 Compta selon le statut (particulier, société TVA
  franchise avec export devant une seule fois, « je ne sais pas » avec l'aide, micro prestations
  21,3 %). **Vert sur les 4 combinaisons (390/1512 × clair/sombre).** Sur `origin/main` d'avant
  (868ac2a8, `git archive` + build, banc copié dedans) : **10 rouges** à 390 clair (la
  configuration n'existe pas ; C4 société/inconnu/prestations rouges). **Mutations de l'app** :
  export société remis derrière (`exportDevant = false`) ⇒ C4 rouge ; une étape qui réécrit
  l'affichage inchangé ⇒ C3 rouge (« rien n'est écrasé »).
- Audits suivis : urssaf, abonnement-propre, premieres-minutes, identite, statuts, variables, tdz,
  icones, boutons, violet, coherence, micro-entreprise, plateformes-2nov, rappel-urssaf,
  suivi-urssaf, prevision-urssaf, vendeurs-differents, numero-ecrit, onglets-d, registres,
  achats-export, carte-chiffres, comparer-mois : verts. **Déjà rouges sur `origin/main`, pas
  touchés** : `audit-coque-parametres` (« pulse » en double dans Réglages) et `audit-registres`
  (`compteEcarteChoix is not defined` dans son bac à sable, arrivé avec la fusion de main).
- Captures regardées : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/configuration/`
  (défauts vus et corrigés : anneau de focus sur le titre, deux réponses courtes empilées au
  téléphone, captures prises pendant le fondu d'entrée).

## Pas fait / à voir

- Libéraux (BNC) et artisans : pas de taux composé (CFP 0,2/0,3 %, cotisations BNC) — ils posent
  leur taux à la main dans Réglages → Statut. À ajouter si un vendeur le demande, avec la même
  vérification.
- Le choix de TVA d'une société n'alimente pas encore « Ma facture » (Facture Pro garde son propre
  `tva_regime`) : à relier si Julien le veut (une règle, un propriétaire).
- Geste de Julien : aucun. Regarder la configuration d'un compte neuf (ou la rejouer : Réglages →
  Affichage → Ma configuration).
