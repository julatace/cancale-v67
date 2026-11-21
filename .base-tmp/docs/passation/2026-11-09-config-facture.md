# 9 nov. 2026 (soir) — Ma facture et Ma configuration : SIRET vérifié, « Qu'est-ce que tu vends ? », le numéro de rangement, l'affichage

Branche `claude/config-facture` (depuis `origin/main` 2fa8e47b), poussée à chaque commit. Pas de PR,
pas de fusion. Rien dans `vinted-sync-extension/`.

## Les demandes de Julien (9 nov., soir), mot pour mot

1. « Sur la facture, quand on remplit le SIRET, le nom, le RCS, le nom de l'entreprise se remplissent
   automatiquement ; ça fait une animation recherche et après on demande à la personne de vérifier si
   les infos sont bonnes. Je veux aussi que ce soit pareil lorsqu'on choisit le statut de l'entreprise. »
2. « Je t'ai dit d'adapter car tout le monde ne vend pas des sneakers ; la première question c'est
   sneakers ou autre chose, fais plein de propositions. »
3. « Tu dis "Le numéro qui dit dans quel carton est l'article" : ça peut très bien être sur des
   étagères et pas dans des cartons, donc faux encore. »
4. « Cette étape n'est pas claire : "Simple ou complet ? Tu pourras changer à tout moment." »

## 1. Le SIRET : recherche visible, puis « Vérifie ces informations »

**La source** : celle déjà utilisée depuis le 17 oct. (`grep SIRET` ⇒ `api/_lib/entreprise.js`,
`/api/compte?mode=entreprise`, `chercherEntreprise` d'App.jsx) — l'API publique, gratuite et sans clé
« Recherche d'entreprises » de l'État (`recherche-entreprises.api.gouv.fr/search?q=<siret>`), appelée
par le SERVEUR (session exigée, SIREN EXACT seulement, jamais « ce qui ressemble »). Aucune nouvelle
fonction `api/` (toujours 12), aucune clé, CSP inchangée (l'appel reste même origine).

**La forme de l'API** : lue le 9 nov. dans la doc officielle (`app/doc/open-api.yml` du dépôt
`annuaire-entreprises-data-gouv-fr/search-api`, raw.githubusercontent ; le site de l'API et insee.fr
n'étaient pas joignables depuis la session) : `results[].siren`, `nom_complet`, `nom_raison_sociale`,
`nature_juridique` (code INSEE), `etat_administratif` (A / C), `siege` et `matching_etablissements[]`
(`siret`, `adresse`, `code_postal`, `libelle_commune`, `etat_administratif` A / F,
`activite_principale_registre_metier`), `complements.est_entrepreneur_individuel`, **`tva`** (« Liste
des numéros de TVA intracommunautaire français actifs (source : DGFiP) »). Libellés des catégories
juridiques vérifiés dans `api-proxy/src/utils/helpers/labels/code-juridiques.ts` (même organisation) :
1000 Entrepreneur individuel, 5498 SARL unipersonnelle, 5499 SARL, 5710 SAS, 5720 SASU.

**Le serveur** (`lireReponseEntreprise`) rend en plus, TELS QUE le registre les dit (absent ⇒ `null`) :
`nature`, `ei`, `tva`, `rm`, `fermeUnite`, `etabFerme`. `audit-entreprise-siret` reste vert.

**La règle partagée** — `src/entrepriseRecherche.js` (pure) + `src/RechercheEntreprise.jsx`
(`useRechercheEntreprise`, `CarteVerifEntreprise`, `src/recherche-entreprise.css`), utilisée par
« Ma facture » ET « Ma configuration » :
- SIRET 14 chiffres ou SIREN 9, clé de Luhn (`verifierSiret` de la facture) ; faux ⇒ « ne semble pas
  valide », **aucune requête**.
- Valide ⇒ « Recherche de l'entreprise… » (trois points qui pulsent, figés en mouvement réduit),
  affiché **pendant la requête seulement** (aucun délai fabriqué).
- Trouvée ⇒ « Vérifie ces informations » : nom/raison sociale, forme (EI, EURL, SARL, SAS, SASU —
  seulement ces codes ; un autre code ⇒ rien proposé, dit), adresse (rue, sans le code postal), code
  postal, ville, n° de TVA. Chaque ligne : **« C'est bon »** (écrit CE champ) / **« Modifier »** (n'écrit
  rien, met le doigt sur le champ). Un champ qu'il a déjà rempli autrement montre l'écart (« Tu as
  écrit : … ») : **« Remplacer » / « Garder la mienne »** — jamais écrasé sans son accord. « Tout est bon :
  remplir les N champs » ne remplit que les champs VIDES. Rien n'est écrit sans un de ces gestes.
- **TVA** : le n° est CALCULÉ (clé = (12 + 3 × (SIREN mod 97)) mod 97) et proposé SEULEMENT si le
  registre (DGFiP) le porte parmi les n° actifs ⇒ assujettie. Liste vide ⇒ rien proposé, la carte
  explique « TVA non applicable, art. 293 B du CGI » (choisir « Franchise de TVA ») ; champ absent ⇒
  rien ; n° du registre différent du calcul ⇒ rien, dit.
- **RCS / RM** : l'API ne donne PAS la ville du greffe ⇒ **jamais proposé** (pas d'invention). La carte
  dit : société ⇒ « Recopie « RCS <ville> <SIREN> » de ton extrait Kbis » ; inscrite au répertoire des
  métiers ⇒ « Recopie ton n° RM (extrait D1) » ; EI ⇒ « seulement si tu es inscrit ».
  ⚠️ Julien attendait « le RCS se remplit » : ce n'est pas possible sans inventer avec cette source
  gratuite (l'immatriculation complète est au RNE de l'INPI, accès sur compte). Dit ici et sur la carte.
- Introuvable / entreprise cessée / établissement fermé / registre muet ⇒ dit, rien proposé, saisie à
  la main (« Réessayer » si muet).

**Ma facture** (`src/FacturePro.jsx`) : l'ancien remplissage SILENCIEUX du nom et de l'adresse (champs
vides, à la réponse du registre) est retiré ; la carte est posée sous le champ SIRET.

**Ma configuration, étape statut** (`SiretConfiguration` dans `src/ConfigurationDepart.jsx`) : micro
(achat-revente ou prestations) ou société ⇒ « Ton SIRET (facultatif) », la MÊME recherche et la MÊME
carte (le SIRET y est lui-même une ligne à valider). Ce qu'il valide est écrit dans SA fiche de facture
`vrm_pro_facture` (relue juste avant, fusionnée ; **lecture ratée ⇒ rien écrit**, dit ; l'événement
`vrm:fiche-facturation` met à jour la lecture partagée de « Ma facture »). Le statut trouvé est
**PROPOSÉ** : société (catégorie 5xxx) ⇒ « Le registre dit : SAS. Ton statut serait donc Société »
« C'est bon » / « Non » (cochée seulement sur son geste, écrite au « Continuer » comme toute l'étape) ;
entrepreneur individuel ⇒ « micro-entreprise ou réel, le registre ne le dit pas » — jamais deviné ;
« Je ne sais pas encore » reste `null`.

## 2. « Qu'est-ce que tu vends ? » — 18 tuiles à choix multiple

Sneakers · Vêtements · Luxe & créateurs · Sacs & maroquinerie · Montres & bijoux · Accessoires ·
Vintage · Enfants & puériculture · Livres & BD · Jeux vidéo & consoles · High-tech · Cartes à
collectionner · Jouets & figurines · Maison & déco · Sport & outdoor · Beauté · Vinyles & musique ·
Autre chose (champ libre, 80 caractères). Icônes au trait dessinées dans `ConfigurationDepart.jsx`
(aucun emoji ; `ICON_PATHS` vit dans App.jsx, que la configuration n'importe pas).

**La donnée** : toujours `vrm_je_vends`, sans casser ses lecteurs (`src/profilVendeur.js`, son
propriétaire) : `{ choix, categories, autre?, at }` — `choix` reste `sneakers | autre | auto` et se
DÉDUIT des catégories : **sneakers SEULES ⇒ `sneakers`** (« paire », taille et marque jugées) ; tout
le reste (sneakers + vêtements, livres…) ⇒ `autre` (« article », taille et marque facultatives). Tous
les lecteurs (`jeVendsEffectif`, `motsArticle`, `champsFacultatifs`, Réglages, la coque) ne lisent
que `choix` : rien d'autre à changer. Pré-coché : les catégories enregistrées ; un ancien réglage
« sneakers » ⇒ Sneakers ; « autre » ⇒ Autre chose ; jamais choisi ⇒ rien. Une étape inchangée n'écrit
rien (« rien n'est écrasé »). Réglages → Affichage → Je vends : garde les catégories si elles disent la
même chose que le segment choisi, sinon les met d'accord (`reglageJeVendsDepuisChoix`) et rappelle le
détail (« Tu as dit vendre : … »).

## 3. Le numéro de rangement n'est plus « le carton »

« Le numéro de rangement : il dit où est l'article (carton, étagère, bac…) ». « carton » est gardé
quand c'est vraiment un carton : emballage d'envoi (dépenses « cartons, papier bulle », bordereau
collé sur le colis, « le même carton vu deux fois » au point relais), et les objets « carton » / piles
de cartons du Stock 3D (ce sont des boîtes dessinées). Phrases changées (textes affichés seulement) :

| fichier | avant | après |
|---|---|---|
| configurationDepart.js | Le numéro qui dit dans quel carton est l'article. | Le numéro de rangement : il dit où est l'article (carton, étagère, bac…). |
| configurationDepart.js | Chaque annonce reçoit un numéro ; tu l'écris sur le carton. | … tu l'écris là où tu ranges l'article. |
| ConfigurationDepart.jsx | … les numéros déjà écrits sur tes cartons restent. | … les numéros déjà écrits là où tu ranges tes articles restent. |
| CompteRelie.jsx | Aucun N° déjà écrit sur un carton ne change | Aucun N° déjà écrit là où tes articles sont rangés ne change |
| ModeEmballage.jsx | … vérifie le carton avant d'emballer. | … vérifie là où elles sont rangées avant d'emballer. |
| ModeEmballage.jsx | Le N°… est à vérifier sur son carton | … est à vérifier là où l'article est rangé |
| App.jsx | As-tu écrit le N°… sur le carton ? | … là où l'article est rangé ? |
| App.jsx | Son carton porte peut-être encore l'ancien. | Là où il est rangé (carton, étagère, bac…), c'est peut-être encore l'ancien qui est écrit. |
| App.jsx | Fais le tour de tes cartons sans réseau | Fais le tour de tes rangements sans réseau |
| App.jsx | N°x → N°y sur le carton. | N°x → N°y là où l'article est rangé. |
| App.jsx | … range le carton sous le numéro écrit dessus. | … range-le sous le numéro écrit dessus. |
| App.jsx | (il est peut-être écrit sur un carton) | (il est peut-être écrit là où un article est rangé : carton, étagère, bac…) |
| App.jsx | — écris le nouveau sur le carton | — écris le nouveau là où l'article est rangé |
| App.jsx | N nouveaux N° pour tes cartons / Nouveau N° pour un carton | N nouveaux N° à écrire / Nouveau N° à écrire |
| App.jsx | Si le carton porte encore l'ancien numéro, barre-le… | Si l'ancien numéro est encore écrit là où l'article est rangé, barre-le… |
| App.jsx | Barre l'ancien numéro sur le carton et écris le nouveau. | Barre l'ancien numéro là où l'article est rangé (carton, étagère, bac…) et écris le nouveau. |
| App.jsx | (celui de ton carton, par exemple) | (celui que tu as déjà écrit sur ton rangement, par exemple) |
| App.jsx (×2) | Regarde les deux cartons : VRM ne choisit pas à ta place. | Regarde les deux articles là où ils sont rangés : … |
| App.jsx | · écris-le sur son carton | · écris-le là où il est rangé |
| App.jsx | … rien à réécrire sur le carton. | … rien à réécrire là où elle est rangée. |
| journalEmail.js | Vérifie ce N° sur ton carton avant d'imprimer… | Vérifie ce N° là où l'article est rangé (carton, étagère, bac…) avant d'imprimer… |
| Accueil.jsx | …un numéro de rangement, celui que tu écris sur le carton. | …un numéro de rangement : il dit où est l'article (carton, étagère, bac…). |
| Accueil.jsx | …devant tes cartons, à la fin du mois | …devant ton stock, à la fin du mois |
| accueil-scenes.jsx | « Carton 12 · titre · taille » (scène de l'accueil) | « N°12 · titre · taille » |
| aideEcrans.js | …numéros à écrire sur tes cartons… / Vérifie les deux cartons. | …numéros à écrire là où tes articles sont rangés… / Vérifie les deux là où ils sont rangés. |
| composants/Numero.jsx | , à vérifier sur le carton | , à vérifier là où l'article est rangé |
| FichePaire.jsx | vérifie le carton avant d'emballer ou d'imprimer. | vérifie là où elles sont rangées avant… |
| InventaireStock.jsx | Tape le numéro écrit sur le carton · vérifie les deux cartons · Tes cartons, un par un · 2ᵉ carton · Passe devant tes cartons · même carton, rien à faire · C'est un 2ᵉ carton N° · Deux cartons sous ce N° · Numéro écrit sur le carton · Deux cartons portent ce N° · sors-les du carton · cherche le carton · Vues sur un carton | …sur l'article ou son rangement · vérifie les deux · Tes articles rangés, un par un · 2ᵉ article · Passe devant tes rangements (cartons, étagères, bacs…) · même article · C'est un 2ᵉ article N° · Deux articles sous ce N° · …sur l'article ou son rangement · Deux articles rangés portent ce N° · sors-les de leur rangement · cherche l'article · Vues dans tes rangements |
| StudioPhoto.jsx | sous le numéro du carton | sous le numéro de rangement |
| accompagnement.js | Tape les N° de tes cartons | Tape les N° de tes articles rangés |
| ecrans/Reglages.jsx | Écris le numéro sur la boîte · Sur le carton, comme d'habitude. | Écris le numéro là où tu ranges l'article · Sur le carton, l'étagère ou le bac, comme d'habitude. |
| ecrans/Reglages.jsx | …le numéro écrit sur ton carton. / « numéros à écrire sur tes cartons » | …là où l'article est rangé. / « Nouveaux N° à écrire » |
| ecrans/Stock.jsx | (son carton sort de cette case) / retire-les du carton | (il sort de cette case) / retire-les de leur case |
| ecrans/Loupe.jsx | Vérifie les cartons… / pas encore écrit sur le carton. | Vérifie là où ils sont rangés… / pas encore écrit là où l'article est rangé. |
| ecrans/Republier.jsx | …: le même carton. / à écrire sur son carton | …: le même rangement. / à écrire là où l'article est rangé |
| etiquetteNumero.js | Le N° reste sur ton carton | Le N° reste là où l'article est rangé |
| annulerCommandes.js | un N° posé ou changé s'écrit sur un carton | … s'écrit là où l'article est rangé |
| aide (scripts/aide-contenu.cjs ⇒ public/aide/ régénéré) | Un numéro par paire, écrit sur le carton… · Tu l'écris sur son carton : … quel carton prendre · écrit sur un carton · à écrire sur tes cartons · vérifie les deux cartons · tu prends le bon carton · Prends le carton qui porte ce numéro… | Un numéro par article : il dit où il est rangé (carton, étagère, bac…)… · Tu l'écris là où tu la ranges (…) : … laquelle prendre · sur un rangement · nouveaux numéros à écrire · vérifie les deux, là où elles sont rangées · tu prends la bonne paire là où elle est rangée · Prends la paire rangée sous ce numéro (carton, étagère, bac…), emballe-la… |

**Contrôles mis à jour (ils lisaient l'ancienne phrase)** : `scripts/bancs/emballage.cjs`
(`/vérifie là où elles sont rangées/`), `scripts/audit-journal-emails.cjs` (`/là où l’article est rangé/`),
`scripts/audit-configuration-depart.cjs` (`vends` est une LISTE, la mutation « réécrit ce qui n'a pas
changé » suit le nouveau code) et `scripts/bancs/configuration-depart.cjs` (18 tuiles au lieu de 2).

## 4. L'étape d'affichage

Titre « **Tout voir, ou l'essentiel ?** », sous-titre « Ce choix ne change que le menu et les conseils :
aucun chiffre, aucune donnée. » Trois cartes, avec ce que fait VRAIMENT `entreeMontree` /
`caseJourneeMontree` :
- **L'essentiel (Simple)** — « Le menu cache Stock tant que tu n'as rangé aucun meuble, et Republier
  tant que tu n'as jamais republié » · « Les plateformes que tu n'as pas reliées n'apparaissent pas » ·
  « Ma journée garde tout ce qui est à faire, sans le conseil « Prix à baisser » ».
- **Tout voir (Complet)** — tous les écrans dans le menu ; tous les conseils de Ma journée.
- **Laisser VRM choisir** — « L'essentiel tant que tu as un seul compte Vinted et moins de 30 ventes sur
  30 jours ; tout, au-delà. »
« **Recommandé pour toi** » (`affichageRecommande`) = la règle existante `affichageAuto`, seulement
quand on SAIT (comptes Vinted et ventes des 30 jours lus, propriétaire ⇒ Complet) ; pas su ⇒ aucune
recommandation. Pied : « Rien n'est supprimé : chaque écran reste joignable. Tu pourras changer dans
Réglages → Affichage → Affichage » (chemin vérifié dans `Reglages.jsx`, contrôle A3).

## Preuves (§6)

- `npm run build` ✓.
- **Nouvel audit `scripts/audit-config-facture.cjs`** : 37 verts (R1-R10 recherche sur une réponse
  FABRIQUÉE de la forme documentée, passée par la vraie règle du serveur ; V1-V7 ce qu'il vend ; A1-A3
  affichage ; T1-T2 aucun « carton » comme définition dans src/ et public/aide ; B1-B4 branchement).
  `--prouve` : **13/13 mutations rouges** (TVA proposée sans le registre, clé TVA fausse, « C'est bon »
  qui écrase, « Tout est bon » qui écrase, forme devinée, entreprise cessée proposée, RCS inventé,
  micro deviné pour un EI, TVA absente lue « aucune », « paire » pour sneakers + autre chose,
  recommandation sur un pas-su, « dans quel carton » remis, remplissage silencieux remis). Sur
  `origin/main` (2fa8e47b, `git archive`) : rouge (les modules n'existent pas — la preuve est la mutation).
- **Nouveau banc `scripts/bancs/config-facture.cjs`** (base inventée, registre fabriqué servi par la
  VRAIE route `routeEntreprise`, requête TENUE pour voir l'animation) : 390 tactile sombre + 1512 clair,
  **vert** (F1 animation puis carte, rien écrit avant « C'est bon », écart montré et nom gardé,
  « C'est bon » adresse n'écrit qu'elle ; F2 Luhn faux ⇒ aucune requête ; F3 registre 503 ⇒ dit,
  « Réessayer » ; C1 18 tuiles, « paire » / « article », `vrm_je_vends` ; C2 SIRET à l'étape statut,
  « Société » proposé pas coché, rien écrit avant « Tout est bon », fiche remplie après ; C3 numéro de
  rangement, affichage clair ; 44 px, rien ne déborde, aucune erreur). **Sur `origin/main` d'avant**
  (build de l'arbre `git archive`, banc copié dedans) : **rouge** — 390 sombre F : 7 défauts (dont « RIEN
  n'est écrit avant C'est bon » : l'ancien code écrivait seul adresse, code postal et ville) ; 1512 clair
  C : 5 défauts (« Que vends-tu ? », 2 cartes, pas d'icône, pas de « paire »).
- Captures regardées (`/tmp/claude-0/-home-user-cancale-v67/58c455bc-1453-511d-b34c-22764476ca7c/scratchpad/shots/cf-*.png`) :
  défaut vu et corrigé — en sombre la carte était blanche sur texte blanc (`--vrm-card` n'existe pas :
  jetons `--d-*` de styles-design-2026 pris à la place) ; trop de bleu (un « C'est bon » bleu par ligne)
  ⇒ un seul bouton accent (« Tout est bon », ou le « C'est bon » s'il est seul).
- Bancs suivis : `configuration-depart` 390/1512 sombre **vert** ; `facture-pro` 1512 sombre **30 verts**.
  `emballage` : rouge AVANT et APRÈS (même 3 rouges sur `origin/main` : « le contrôle a pu s'exécuter »,
  un clic qui n'aboutit pas — pas de ce chantier).
- Audits verts : variables, tdz, coherence, identite, statuts, icones, configuration-depart (+`--prouve`),
  facture-pro, entreprise-siret, csp, vendeurs-differents, journal-emails, xss-facture,
  annuler-commandes, inventaire, aide-signalement (+ `aide-generer --verifier`), accompagnement,
  accueil-demo, etiquette-numero, numero-ecrit, numero-etiquette, fonctions-api (12), premieres-minutes,
  onglets-d, violet, boutons, plateformes-2nov, micro-entreprise, registres. **Déjà rouge sur
  `origin/main`, pas touché** : `audit-coque-parametres` (icône `chart` en double dans Réglages).

## Ce qui reste

- **Le RCS ne peut pas se remplir seul** avec la source gratuite (pas de ville du greffe) : seule la
  phrase « recopie-le de ton Kbis » est dite. Une source qui le donne (RNE de l'INPI) demande un compte
  et une clé — à décider par Julien (§2.9 : jamais sur sa clé pour les autres).
- « Ton entreprise » de Comptabilité (`ProfilFiscalCarte`, 17 oct.) remplit toujours le nom (et
  l'adresse vide) tout seul, comme Julien l'avait demandé le 17 oct. ; elle écrit la même ligne
  `vrm_pro_facture`. À passer sur la même carte si Julien veut la même règle partout.
- Le choix de TVA de la configuration (`vrm_societe_tva`) n'alimente toujours pas « Ma facture »
  (`tva_regime`) — déjà noté le 9 nov.
- Le badge « Recommandé pour toi » n'a pas de capture (la base du banc n'a pas de ventes lues ⇒ « pas
  su », aucune recommandation, comme la règle le veut) ; la règle est jugée par l'audit (A2).
- Geste de Julien : aucun. Regarder « Ma facture » (taper son SIRET) et rejouer « Ma configuration »
  (Réglages → Affichage → Ma configuration).
