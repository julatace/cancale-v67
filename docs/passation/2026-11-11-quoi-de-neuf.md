# 11 nov. 2026 — « Quoi de neuf », discret, après chaque mise en ligne

Branche `claude/quoi-de-neuf` (depuis `origin/main` fc3883d), poussée à chaque commit. Pas de PR, pas
de fusion. Rien dans `vinted-sync-extension/`, aucune fonction `api/`, aucune écriture en base réelle.
Principe de Julien : « plus beau, simple, surtout PRATIQUE ».

## Ce qui est livré
- **`src/nouveautes.js`** : la liste `NOUVEAUTES` versionnée dans le dépôt, une ligne par nouveauté
  `{ id, date, titre, phrase, tab, pour, mode }`, et les règles PURES :
  - `nouveautesDuCompte(ctx)` : seulement ce qui est arrivé **après le jour de son inscription**
    (`AUTH.user.created_at`, jour local) — un compte neuf ne voit pas l'historique ; date pas sue ⇒ rien ;
  - `pourLui(n, ctx)` : `pour` = `tous` · `sneakers` (il en vend) · `autre` (pas que des sneakers) ·
    `pro` (régime micro, société ou marge **choisi**) ; « pas su » ne vaut pas « pour toi » ;
    `mode: 'complet'` (un écran que Simple ne montre pas) est caché en Simple ;
  - `nouveautesAVoir` (pas encore vues), `marquerVues` (ajoute, n'efface ni ne redate rien).
- **L'état « vu »** : `vrm_nouveautes_vues` = `{ vues: { [id]: iso } }`, dans **SYNC_KEYS** (ligne
  `main` du compte VRM, le même sur tous ses appareils). Écrit par `save` sur SON geste seulement.
- **Ma journée** : une ligne « Nouveau · N nouveautés · <le 1er titre> › » juste sous la tête, avant
  les notifications muettes et « À faire » — un bouton, jamais une fenêtre ; rien à voir ⇒ rien. Rien
  non plus tant que la coque n'a pas posé le profil (Simple/Complet, ce qu'il vend) ET que le nuage
  n'est pas lu (`isCloudReady`) : mesuré au banc, la carte disait 15 puis la feuille 12 (le défaut
  automatique passait en Simple après coup), et 12 puis 14 avant la lecture du nuage (statut, « vu »
  d'un autre appareil) — la carte changeait sous ses yeux.
- Constaté au banc, pas changé (règle générale de l'app) : `save` attend son minuteur avant d'écrire ;
  un rechargement dans la seconde qui suit un geste le perd. Le banc attend l'écriture dans `main`.
- **La feuille** (`SheetShell` : portail, `FermeAuRetour`, Échap, glisser) : une ligne par nouveauté
  (titre, phrase, date courte), « Voir » (44 px, vrai lien `?tab=…`) range CETTE ligne et mène à
  l'écran ; « Tout vu » range tout ; fermer n'est pas « vu ».
- **Paramètres → Aide → « Quoi de neuf »** : tout ce qui le concerne depuis l'inscription (vues
  comprises, point bleu sur les nouvelles) ; sinon « Rien de neuf depuis ton inscription. »
- Composants : `src/QuoiDeNeuf.jsx`, styles `src/quoi-de-neuf.css` (jetons ; l'accent sur la seule
  pastille « Nouveau » et le point).

## Ce qui est dans la liste (vérifié présent dans `main`)
11 nov. : Facture Pro SIRET (pro) · « Tu vends quoi ? » · plus de « pointure » sur eBay (autre) ·
photo de profil = menu · offres auto sûres (Complet) · republier à la main en 3 gestes (Complet) ·
« Créé par VRM » · dates de versement plus vite (pro) · Messages « Tous » · heure du résumé du soir.
10 nov. : import d'un tableur · partage d'une photo vers VRM. 9 nov. : export comptable (pro) ·
chercher par photo (Complet) · objectif du mois. 8 nov. : centre d'aide.
**Pas mis** (introuvables dans `main` à cette heure, sans doute des lots parallèles) : « statistiques
par catégorie ». « App installable » n'a pas de ligne : le guide iPhone existe depuis le 5 nov. et
aucune nouveauté du jour ne le touche — à ajouter par le lot qui la livre.

## ⚠️ La règle pour la suite
**Chaque lot visible ajoute SA ligne en tête de `src/nouveautes.js`** (id neuf jamais réutilisé, date
du jour de la mise en ligne, titre ≤ 8 mots, phrase ≤ 12 mots, écran de `ONGLETS_LIENS`, `pour`,
`mode`). `node scripts/audit-quoi-de-neuf.cjs` vérifie le format et l'écran cible.

## Preuves
- `npm run build` vert ; `audit-{variables,tdz,coherence,identite,icones,textes-courts,fonctions-api,secrets,csp}` verts.
- `audit-quoi-de-neuf` : format (F), règles exécutées (R), branchement (B) — vert ; `--prouve` :
  **20/20 mutations** attrapées (historique pour un compte neuf, date pas sue ⇒ tout, Simple montre
  Complet, pro sur un « pas su », « autre » pour tous, « Vu » redate, une vue revient, titre de 9 mots,
  phrase de 13 mots, écran inexistant, id en double, ordre cassé, clé hors SYNC_KEYS, carte retirée,
  statut pas su ⇒ pas pro, carte avant le profil, carte avant le nuage, feuille hors SheetShell, carte en fenêtre, Paramètres sans l'entrée).
- Sur `origin/main` (git archive) l'audit est rouge — mais seulement parce que le module n'existe pas :
  ce n'est pas une preuve à lui seul ; ce sont les mutations qui la font.
- Banc `scripts/bancs/quoi-de-neuf.cjs` (390 et 1512, clair et sombre) : Q1 carte → feuille → « Voir »
  → une de moins → « Tout vu » → `main` écrite → un autre appareil ne la revoit pas ; Q2 compte du jour :
  aucune carte, Paramètres « Rien de neuf » ; Q3 Simple + statut pas choisi + Lunettes. Captures regardées.

Geste de Julien : aucun.
