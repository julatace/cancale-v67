# 16 nov. 2026 — Deux annonces d'un même compte, une paire (lot `doublons-meme-compte`, mission 10)

Branche `claude/doublons-meme-compte` (depuis `origin/main`). Mission :
`docs/passation/file-attente-16nov/10-doublons-compte.md` (validée par Julien). Rien dans `vinted-sync-extension/`
(les empreintes de photos sont déjà calculées par l'extension 5.358).

## Ce qui existait (lu avant de coder)
- `src/enLigneDeuxFois.js` : la même paire en ligne deux fois sur Vinted, par PHOTO EXACTE, `recreeDe` ou fusion
  (son clic) ; même compte ou deux comptes. Carte « N°x en ligne deux fois » dans Ma journée, alerte et marque
  « En double » dans Annonces. Le même N° seul ⇒ le bloc ROUGE « deux paires sous un N° » (`numeroSeul`).
- `src/deuxComptes.js` : « Deux comptes, une paire » (sûr par identité, « à vérifier » par EMPREINTE au seuil
  strict, unique et mutuelle) — SEULEMENT entre deux comptes.
- Il manquait : l'empreinte sur un MÊME compte, et l'écart d'une republication en cours.

## Ce qui change
- `src/doublonsCompte.js` (neuf, pur) : `doublonsMemeCompte` rend les groupes d'un même compte :
  - « sûr » : les groupes même compte de `enLigneDeuxFois` (photo exacte, `recreeDe`, fusion) ;
  - « à vérifier » : la même photo à l'EMPREINTE (`apparieParEmpreinte(…, { memeCompte: true })`, la règle de
    « deux comptes » : seuil `SEUIL_MEME_PHOTO` 12, appariement UNIQUE et MUTUEL — 50 paires photographiées au
    même endroit ne disent rien) ;
  - jamais le titre, la marque, la taille ; le même N° reste au bloc rouge (pas de seconde alerte) ;
  - **une republication en cours est écartée** (`republicationsEnCours`) : l'opération Republier de CET appareil
    (`vrm_operation_repub`, pas finie, touchée depuis < 2 h) qui porte l'une des deux ; le journal
    `vrm_repub_journal` (l'une remplace l'autre depuis < 2 h) ; le lien `recreeDe` quand la nouvelle est en ligne
    depuis < 2 h. Au-delà de 2 h, l'ancienne encore en ligne est dite (vraie double vente possible).
  - `texteDoublonsCompte` : la carte courte « N°124 · 2 annonces de tomj606 » / « La même paire · retire celle en
    trop » (« Peut-être la même paire · à vérifier » pour un indice), geste « Voir les deux » ; la phrase entière
    « 2 annonces de tomj606 sont la même paire (N°124) » dans l'infobulle et pour le lecteur d'écran.
- `src/deuxComptes.js` : `apparieParEmpreinte` prend `memeCompte` (le seul tri final change).
- `App.jsx` (`Comptabilite`) : `doublonsCompte` puis `deuxFoisADire` (même compte + deux comptes non dits par
  « Deux comptes ») — UNE liste lue par la carte de Ma journée, l'alerte d'Annonces et la marque « En double »
  des lignes (§11). Le journal des republications est lu aussi pour Ma journée. Rien n'est supprimé (§3) : la
  feuille ouvre chaque annonce sur vinted.fr.
- `EnLigneDeuxFois.jsx` : la preuve « photo presque identique, à vérifier ». Textes `doublons.*` en 5 langues.
  Ligne « Quoi de neuf » `doublons-meme-compte`.

## Preuves
- `node scripts/audit-doublons-compte.cjs` (neuf) : 24 contrôles verts (50 annonces au même titre ⇒ rien ; photo
  exacte ⇒ sûr ; empreinte ⇒ à vérifier ; 50 au même endroit ⇒ rien ; même N° ⇒ rien ici, le rouge le dit ; deux
  comptes ⇒ rien ici ; plus en ligne / compte pas relu ⇒ rien ; republication en cours (recreeDe 20 min, journal
  10 min, opération en cours) ⇒ écartée ; 3 jours / 5 h / opération finie ou abandonnée ⇒ dite ; textes ;
  branchement de l'app). `--prouve` : **12/12 mutations** attrapées. Sur origin/main le module n'existe pas.
- `audit-deux-comptes` 48/48 (sa mutation `meme-compte` suit la ligne changée et reste attrapée),
  `audit-en-ligne-deux-fois` 42/42, `audit-photos-comptes`, `audit-meme-photo`, `audit-traduction`,
  `audit-quoi-de-neuf` verts. `audit-vocabulaire-article` S1 rouge **déjà sur main** (clés `studio.paires.*`
  d'App.jsx, sans lien).
- Banc `scripts/bancs/en-ligne-deux-fois.cjs` : A mis à jour (titre court, infobulle avec la phrase et les deux N°,
  « Voir les deux ») ; G (empreinte même compte : carte « à vérifier », feuille, marque sur les DEUX lignes
  d'Annonces), H (Republier en cours ⇒ aucune carte), I (même N° même compte ⇒ le rouge seul). Résultat : voir
  « ÉTAT À LA REPRISE ».

## ÉTAT À LA REPRISE
- Code, audit, récit poussés ; PR ouverte (voir le rapport). Build et banc de rendu en attente du sémaphore
  (machine saturée le 16 nov. au soir) : à lancer `npx vite build --outDir dist-dc` puis
  `BANC_DIST=dist-dc BANC_PORT=… CAPTURES=… node scripts/bancs/en-ligne-deux-fois.cjs` et regarder les captures
  `deux-fois-G-*`.
- Le mot « paire » de la phrase suit les autres textes de la carte (motsVendeur n'existe qu'en français).
- Rien à faire pour Julien.
