# 11 nov. — Les audits rouges sur `main`, remis au vert (branche `claude/audits-rouges`)

Point de départ : `origin/main` à 3cb90230. Tous les `scripts/audit-*.cjs` lancés (454) :
une quarantaine sortaient en erreur. Certains n'étaient rouges que par la charge (8 en
parallèle, mémoire pleine : `timeout`) — relancés seuls, ils sont verts
(bilan-mois, bilan-semaine, ebay-retrait-auto, rappel-urssaf, renum-b, suivi-colis,
vc-publier, benefice, extension-zip, entree-publier-ailleurs, recherche-unique,
transp-ext, tdz).

## Vrais défauts corrigés dans le code

| audit | défaut | correction |
|---|---|---|
| `pagination-ordre` | `api/_lib/pilotage.js` (`lireTout`) lisait par pages `Range` **sans ordre** : une ligne pouvait sauter ou être lue deux fois | `ordreStable(chemin)` ; `essais_gratuits: 'cle.asc'` ajouté à `ORDRE_PAR_TABLE` (clé primaire `cle`, migration 022) |
| `chrome-en-dur` | Mode vacances (`src/ModeVacances.jsx`) écrivait « Ouvert dans Chrome » même sur Orion | `motsNavigateur().dansNu` (« dans Orion », « dans Chrome »…) |
| `config-facture` T1 | « Dans tes cartons », « Je vérifie mes cartons » (inventaire annuel) : Julien range aussi sur des étagères | « Dans ton rangement », « Je vérifie mon rangement », « au rangement » ; Emballages : « Note tes emballages (cartons, sacs) » |
| `coque-parametres` | Réglages : 4 icônes en double (calendar, chart, grid, send) | agenda → `clock`, widget → `device`, raccourcis → `key`, signaler → `chat` |
| `conseils` | le conseil « Un compte sans e-mail » visait `[data-colis-comptes-muets-ouvrir]`, retiré de Colis le 10 nov. (Julien : « déjà marqué au-dessus ») : il ne pouvait plus paraître | il vise le geste de la ligne de fraîcheur du haut (`[data-fraicheur-geste="emails"]`, puis la rangée) |
| `garde-ecrans` | les trois captures d'instantané (Ma journée, Colis, Ventes) étaient montées sans garde-fou | chacune sous `<GardeEcran nom="capture-…">` |
| `signalement` | « Signaler un problème » depuis Litiges, Republier ou Favoris : écran refusé par le serveur | `litiges`, `republier`, `favoris` ajoutés à `ECRANS` (`api/_lib/signalement.js`) |
| `photos-vinted` | des `<img>` brutes en repli (À trancher, Litiges, Baisser le prix, Visionneuse) : une photo Vinted partait avec le référent, sans secours | plus de repli brut (les appelants passent tous `PhotoVinted`) |

## Outils d'audit réparés (le texte de l'app, l'historique)

- `scripts/_source-app.cjs` : le texte recollé (App.jsx + écrans) déclarait deux fois un nom
  (Babel « already been declared ») — une ligne d'import finie par un commentaire
  (`DEMANDE_APPAREIL`, lot H) et un écran qui importe un autre écran (`FilsTous` →
  `MessagesLeboncoin`). Rendait rouges label-latest, lus-deux-appareils, frein-relais-vinted,
  lbc-plus-vue-pause.
- `scripts/_versions-publiees.cjs` : sur un clone SUPERFICIEL, l'historique est coupé et la
  5.170.0 « manquait » sans que rien ne le dise (`preuve-vente`). Clone superficiel ⇒ `null`
  (pas su, dit : `git fetch --unshallow origin main`). Sur l'historique complet : vert.

## Audits périmés par un changement VOLONTAIRE (même règle, jamais affaiblie)

- `chantier-f` : l'en-tête s'appelle « Argent » (fusion Statistiques + Compta) ; toujours
  sans date en surtitre ; la mutation vise le nouvel en-tête (12/12 rouges).
- `journal-semaine` : la semaine passée vit dans la frise de Ma journée v2 (`FriseJournee`,
  par `journalSemaine`).
- `vente-verification` V4 : le récapitulatif porte la frise PROUVÉE (lot BE) ; l'étape
  « Au centre de vérification » y entre par `auCentreDeVerification(o)`.
- `reprise-ecran` : plus de balayage d'onglet au doigt (décision du 9 nov.) ; s'il revient,
  il doit laisser les 24 px des bords.
- `relier-compte` R7 (Ma journée) : la carte vit dans la liste de Ma journée v2 ;
  `conseils` : `tour` compte aussi « Ma configuration » ouverte.
- `signalement` : `/api/sante` lit aussi la ligne bornée `statut_sondes` (9 nov.) ; le
  collecteur reste UNE lecture scalaire.
- `qui-dorment`, `journee-hors-ligne`, `prix-mini` S3, `facture-achat` : fenêtres de texte
  réajustées (commentaire JSX, effet entier, fin de l'élément, `<span>`).
- Bancs d'exécution : `achats-export` (factureAchat.js importé), `argent-a-venir`
  (formatsDate.js), `donnees-ecrans` (formats créés une fois), `lus-deux-appareils`
  (journalNotifs empaqueté par esbuild), `label-latest` (AUTH absent du banc).
- `a-envoyer-preuves` : bombe à retardement (bordereau « reçu il y a 48 h » devenu plus récent
  que le dépôt daté du 7 nov.) — date fixe.

## Après le merge de `origin/main` (11 nov., reprise)

- `_source-app.cjs` et `InventaireAnnuel.jsx` : `main` avait fait la même correction
  (imports recollés ; « Dans tes rangements ») — sa version gardée.
- `ma-semaine` : « semaine » n'est plus le dernier de `ECRANS` — la règle (présent) gardée.
- `prix-mini` E4 : l'extension lit le mini par `seuilOffreLu` (5.342) — sa vraie règle EXÉCUTÉE
  (« 41 » ⇒ 41, « 0 »/vide ⇒ rien).
- `plans-solo-pro` : l'accueil dit « un compte vend par plateforme » (textes courts) — même sens.
- `controle-prod-quotidien` : rouge sur un `dist/` d'avant le merge (5.339 servie, 5.342
  attendue) ; vert après `npm run build`.
- Mutations (chaque correction réaffaiblie ⇒ audit rouge) : pagination-ordre, chrome-en-dur,
  signalement, conseils, coque-parametres, garde-ecrans, ma-semaine, chantier-f (12/12),
  prix-mini (10/10), lus-deux-appareils (`--muter`).

## Encore rouges — hors de ce lot (zones d'autres sessions)

- `colis-envoi` (B : la barre dépend de l'onglet — le Scanner a un mode « retrait », lot V),
  `relier-compte` R7 Colis (la ligne « compte à relier » retirée de Colis le 10 nov.),
  `photos-vinted` (3 `<img>` de Colis : `ModeRelais` QR et photo, `ScannerColis` photo) :
  **zone Colis**.
- `rouge-doublon`, `violet` : **zone logos** (autre session).
- `doublons-historique` (n vs n²) et `recherche-universelle` (< 300 ms) : mesures de temps,
  rouges seulement sous la charge des autres agents ; à relancer seuls.
