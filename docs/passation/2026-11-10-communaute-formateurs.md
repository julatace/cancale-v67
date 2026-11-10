# 10 nov. 2026 — La Communauté pour les créateurs de formation (lot AR, branche `claude/communaute-formateurs`)

Demande 7 de Julien (9 nov., 21 h, `2026-11-09-propositions.md`), mot pour mot :
« Communauté : un outil parfait et pratique pour les créateurs de formation. »

## Ce qui existait
- 018-020 (carte, classement, groupes de comparaison) **appliquées** le 20 oct.
- **025** (groupes d'accompagnement : entrer = DEMANDER, le créateur valide, le membre
  choisit son partage — rien · chiffres · détail —, RIEN par défaut) : **appliquée** (vérifié
  en lecture seule le 10 nov. : 3 tables, 22 fonctions). Écran Communauté → Groupes.
- Manquait pour un formateur : une page publique, un programme, des annonces, un suivi d'un
  coup d'œil.

## Ce qui est fait — posé SUR la 025, sans la changer
### Migration `supabase/migrations/032-communaute-formateurs.sql` — **PAS APPLIQUÉE**
(La 031 a été prise puis retirée par le lot « Pro illimité » : celle-ci est la **032**.)
- Six tables `vrm_form_*` (pages, vitrine, etapes, progres, accords, annonces) : RLS activé ET
  forcé, aucune règle, aucun droit (anon, authenticated, service_role) ; 18 fonctions SECURITY
  DEFINER, `search_path` vide, identité par `auth.uid()`. Empreinte des tables
  (`508fd6a9…`). Exige la 025 (refusée sans elle). **Aucune suppression** dans le fichier.
  **Essai `BEGIN … ROLLBACK` en tête** (attendu : « ESSAI OK : 6 tables (RLS forcé),
  18 fonctions, page inconnue refusée »).
- **Page publique** `vrm_form_page(adresse)` — la SEULE fonction ouverte à `anon` : rend nom,
  présentation, groupes MONTRÉS (id, nom, description) ; seulement publiée ET formateur abonné ;
  jamais un compte, un email, un code, un membre ni un chiffre. Éteinte par défaut ; une adresse
  ne se vole pas ; dépublier marche même sans abonnement.
- **Demander depuis la page** (`vrm_form_demander`) = `vrm_accomp_demander` de la 025 (statut
  « attente », partage « rien » par défaut), seulement pour un groupe montré sur cette page.
- **Programme** : étapes par groupe (30 au plus), écrites par le formateur seul ; l'élève
  ACCEPTÉ coche les SIENNES. **Le formateur ne voit les coches qu'avec l'ACCORD de l'élève**
  (`vrm_form_accords.etapes`, FAUX par défaut, révocable, effet immédiat) — règle unique
  `vrm_form_progres_vu`. Élève en attente, retiré, parti ⇒ absent du tableau.
- **Annonces** : du formateur à son groupe (1–1 000 car., 10 / 24 h) ; seuls les membres
  ACCEPTÉS d'un groupe ouvert les lisent.
- **Aucun chiffre d'élève** dans la 032 : les chiffres restent ceux de la 025 (`vrm_accomp_vue`,
  rien sans partage). La 032 ne lit ni `app_data`, ni `vinted_accounts`, ni `vrm_accomp_partages`.
- « Fermer mon compte » : `vrm_form_effacer` (clé de service) dépublie et détache la page
  (adresse libérée), retire ses accords, retire ses groupes de la vitrine — appelée AVANT
  `vrm_accomp_effacer` (`api/_lib/communaute.js` → `effacerCommunaute`).

### Route — aucune fonction `api/` ajoutée (toujours 12)
`api/_lib/formateur.js` : `?mode=communaute` actions `form-…` (jeton de l'APPELANT) ;
`GET /api/compte?mode=formateur&f=<adresse>` SANS session (clé publique, `no-store`), ne relaie
que nom/présentation/groupes (id, nom, description) même si la base en rendait plus. 032
absente ⇒ 503 `non-installe` ; panne ⇒ 503 `pas-su`. Accord : seul un `true` explicite.

### L'app (Communauté → Groupes)
- **Ma page de formateur** : créer (nom ⇒ adresse proposée, présentation), « Mettre en ligne » /
  « Retirer du web », « Copier le lien » `vrm.center/f/<adresse>`.
- Dans chaque groupe créé : interrupteur **« Sur ma page publique »** ; segments **Suivi ·
  Programme · Annonces**. Suivi : « Au moins N ventes ce mois · X élèves sur Y partagent »
  (`suiviGroupe`, `src/communaute/formateur.js`) ; par élève « Ne partage pas » / « Pas encore
  reçu » / ventes · vendu, et « k/n étapes » ou « Étapes privées ». Jamais 0 pour « pas su ».
- Côté élève accepté : annonces, programme à cocher, interrupteur **« {formateur} voit mes
  étapes »** (non par défaut).
- Sans la 032 : une ligne « Espace formateur : pas encore activé sur ta base. », rien proposé.

### La page publique `vrm.center/f/<adresse>`
`public/formateur.html` + `public/formateur.js` (aucun script en ligne, CSP), réécriture
`vercel.json` `/f/([a-z0-9-]+)` → `/formateur.html`. Tout en `textContent`. « Demander à
rejoindre » ⇒ `/?tab=communaute&formateur=<adresse>&g=<groupe>` ; l'app garde ce lien
(`vrm_form_lien`, App.jsx une ligne) et ouvre la feuille « Rejoindre un groupe » (« Rien » coché).

## Preuves
- `node scripts/audit-formateurs-sql.cjs` — la 032 EXÉCUTÉE sur un Postgres jetable (socle
  005-007 + 018-020 + 025 telles quelles) : **101 verts**, essai d'en-tête joué (« ESSAI OK »,
  rien gardé) ; `--prouve` **17/17 mutations** (progrès sans accord, accord par défaut, non
  accepté au tableau, page non publiée lue, page sans abonnement, compte rendu par la page,
  demande hors vitrine, partage par défaut élargi, étape/annonce par autrui, annonces aux non
  membres, plafond, adresse volée, étape d'un autre groupe, effacement qui garde, anon qui lit,
  table lisible).
- `node scripts/audit-formateurs.cjs` — règle du suivi, VRAIE route (`api/compte.js`), vrai script
  de la page publique : **30 verts** ; `--prouve` **7/7**. Rouge sur origin/main (fichiers absents).
- Banc `scripts/bancs/communaute-formateurs.cjs` (le vrai `api/compte.js`, faux PostgREST aux
  règles 025 + 032) — 1512 clair/sombre, 390 tactile clair/sombre, page publique 1512 clair et
  390 sombre. Voir le résultat plus bas.
- `audit-accompagnement` 40 · `audit-fermer-compte` · `audit-fonctions-api` · `audit-confiance`
  39/39 · variables · tdz · coherence · identite · icones verts ; `npm run build`.

## Geste de Julien
1. **Migration 032** (`supabase/migrations/032-communaute-formateurs.sql`) : d'abord l'ESSAI de
   son en-tête (coller `begin;` + le contenu entre `begin;` et `commit;` + le bloc `do $e$` +
   `rollback;`) ⇒ « ESSAI OK » ; puis coller le fichier entier d'un bloc (VRM peu sollicité).
   Vérifier : `select count(*) from pg_proc where proname like 'vrm\_form\_%'` ⇒ 18.
2. Communauté → Groupes → « Créer ma page », « Mettre en ligne », « Sur ma page publique ».

## Ce qui reste
- Pas de notification push au formateur pour une demande, ni à l'élève pour une annonce.
- La page publique n'a pas de photo (pas d'hébergement d'image ajouté exprès).
- Le suivi ne montre que le mois en cours ; le détail par semaine/mois reste « Voir » (025).
