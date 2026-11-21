# 8 nov. 2026 — Les premières minutes : un vendeur neuf réussit seul en dix minutes

Branche `claude/premieres-minutes`, partie de `origin/claude/amazing-lovelace-xd7obl`
(2fb6058f). Rien dans `vinted-sync-extension/` ni `public/`. Pas de PR, pas de merge.

Julien, 8 nov. : des vendeurs vont payer ; « fais tout ». Un vendeur qui crée son compte doit
réussir SEUL en dix minutes.

## Ce qui change pour le vendeur

1. **Le parcours « Démarrer avec VRM » passe à 5 étapes** (évolution du guide du 6 nov.) :
   Créer ton compte ✓ · Installer l'extension · Ouvrir Vinted pour relier ton compte · Relier ta
   boîte e-mail · Voir ta première vente arriver. Barre en 5 segments (fait = bleu, étape courante =
   bleu pâle), une seule étape ouverte à la fois (dessin, pourquoi, son geste), les autres en
   rangées iOS. Chaque étape se coche SEULE sur une preuve lue :
   | étape | preuve (trois états, « pas su » ≠ fait) |
   |---|---|
   | compte | la session de CE compte VRM |
   | extension | le pont répond dans ce navigateur, ou un compte Vinted est déjà dans sa base |
   | Vinted | `vinted_accounts` lu, au moins une ligne |
   | boîte e-mail | une ligne `email_reception_*` (`select=id`, limit 1) |
   | première vente | le compteur `nItems` de `harvest_{uid}_orders_sold` (scalaire, jamais `select=data`) ; une vente lue suffit, un compteur illisible ⇒ « pas pu vérifier » |
   L'étape « première vente » est une ATTENTE : aucun geste, un point bleu qui respire (rien sous
   mouvement réduit).
2. **« Plus tard » sur chaque étape** (jamais bloquant) : l'étape passe 7 jours de côté, la
   suivante devient la courante. Mettre l'extension de côté met aussi Vinted de côté (sur un
   téléphone : on passe à la boîte e-mail, faisable d'ici). Enregistré dans
   `vrm_parcours_plus_tard` (`SYNC_KEYS`, le même choix sur tous ses appareils). « Masquer le
   guide » reste (dès qu'un compte est relié). Aucune visite forcée, aucune fenêtre : c'est une
   carte de Ma journée.
3. **Le choix de la numérotation au départ** : « Qui écrit le numéro de tes paires ? » — « VRM
   numérote mes paires » / « Je numérote moi-même », une phrase et un petit dessin chacun. Écrit
   `vrm_numero_ecrit` `{ actif, depuis, choisi }` (le réglage du 7 nov., la forme lue par
   `lireReglageNumeroEcrit`) ; « Modifiable ensuite dans Paramètres → Numéros de rangement » ;
   « Plus tard » possible. **Posée seulement** à un compte qui n'a jamais choisi (ni `depuis` ni
   `choisi`) ET dont on a LU zéro N° : un vendeur installé (Julien) n'est jamais interrogé ;
   N° pas encore lus ⇒ pas de question.
4. **Mode exemple** (`src/modeExemple.js` réutilisé tel quel, rien écrit en base) : « Voir VRM
   avec des exemples » (compte sans compte Vinted relié) et, dans l'exemple, le bandeau « Passer
   à mes vraies données » (avant « Découvrir avec des exemples » / « Brancher mes comptes » ;
   mêmes `data-exemple-*`).
5. **« Vérifier mon installation »** : dans le pied du guide, et dans Paramètres → Aide (panneau
   `verifier`). Une rangée par contrôle, l'état en un mot (OK · À faire · Pas su · …) et LE geste :
   extension ici (absente ⇒ « Installer » selon le navigateur : zip Chrome/Edge, boutique publiée
   `LIENS_BOUTIQUES`, Orion sur iPhone ; téléphone sans extension ⇒ « sur ton ordinateur », et OK si
   des comptes arrivent ; version en retard ⇒ « Mettre à jour » ; pas connectée / connectée à un
   AUTRE compte VRM ⇒ à régler ; muette ⇒ « Réessayer »), comptes Vinted (« Ouvrir vinted.fr »),
   boîte e-mail (« Relier ma boîte »), dernière relecture (> 24 h ⇒ le compte NOMMÉ, « Ouvrir
   vinted.fr »). « Tout est en place » seulement si tout est lu et bon. Sondes existantes :
   `useEtapePont`, `vmrExtVersion`/`extEnRetard`, `fetchVintedAccounts` (ou la liste de la coque),
   la lecture `email_reception_*` du guide, `lireCapturesDetail`.

## Où est le code

- La règle, JS pur : `src/guideDemarrage.js` (`ETAPES_GUIDE`, `preuve*`, `compterVentes`,
  `reporteeActive`, `etatGuide(preuves, { plusTard })`, `numerotationAChoisir`, `reglageDuChoix`,
  `verifierInstallation`).
- Le dessin : `src/GuideDemarrage.jsx` (`GuideDemarrage`, `ChoixNumerotation`,
  `VerificationInstallation`, `IllustrationEtape`, `BandeauExemple`) et `src/guide-demarrage.css`
  (jetons `--d-*`, clair/sombre, `prefers-contrast`, mouvement réduit).
- Le branchement (lectures) : `src/App.jsx`, bloc « LE GUIDE DE DÉMARRAGE, BRANCHÉ SUR LES
  PREUVES » (`useVentesGuide`, `usePlusTardParcours`, `lienInstallerIci`, `GuideDemarrageCarte`,
  `VerifierInstallationApp` exporté à part) ; `SYNC_KEYS` + `vrm_parcours_plus_tard`.
- Paramètres → Aide : `src/ecrans/Reglages.jsx` (une ligne d'import, un item `verifier`).

## Compatibilité avec les autres chantiers

- **Page « Tout va bien ? »** (branche `claude/garde-fous-capture`, pas sur ma base) : elle
  détaille chaque appareil et chaque compte (Paramètres → Mes comptes). « Vérifier mon
  installation » reste le contrôle en un geste des premières minutes (Aide) et n'en duplique pas
  la page. À la fusion : rien à résoudre côté code (fichiers et groupes différents) ; si Julien
  préfère, l'item `verifier` peut pointer vers `toutvabien`.
- **Boutiques d'extension** (`claude/extension-boutiques`) : le geste « Installer » lit
  `LIENS_BOUTIQUES` / `boutiqueIci()` comme `PremiersPas` — une fiche publiée remplace le zip
  toute seule.
- La visite en bulles cible toujours `[data-guide-etape="extension"]` / `"emails"` et
  `[data-exemple-entrer]` (inchangés).

## Preuves (§6)

- `npm run build` ✓ ; `audit-variables`, `audit-tdz`, `audit-conseils` (135 ✓), `audit-mode-exemple`,
  `audit-icones`, `audit-violet` : verts. `node --test scripts/tests/parcours-clairs.test.mjs` : 3/3.
- **Nouvel audit** `scripts/audit-premieres-minutes.cjs` (P1-P7 : règle exécutée + branchement) et
  `--prouve` : 9 mutations (liste pas lue cochée, extension cochée pendant la question, nombre pas
  su coché, compteur illisible lu comme 0, preuve absente = fait, numérotation demandée sans
  lecture, « Plus tard » éternel, OK sur un pas su, comptes illisibles dits reliés) ⇒ 9 rouges.
- **Nouveau banc** `scripts/bancs/premieres-minutes.cjs` (base inventée, 390 tactile et 1512, clair
  et sombre) : N1-N5 compte neuf de bout en bout (1 sur 5, question de numérotation 44 px, choix
  écrit dans `main`, vérification « à faire » avec gestes, « Plus tard » ⇒ boîte e-mail, mi-chemin
  4 sur 5 en attente), I1 compte installé (aucune étape, aucune question ; Paramètres → Vérifier :
  comptes, boîte, relecture OK), I2 ventes illisibles ⇒ « pas pu vérifier ». **Vert** sur les 4
  combinaisons ; **11 rouges** sur la branche de départ (2fb6058f, `git archive` + build) ;
  **3 rouges** sous mutation de l'app (`vente: … 'fait'` au lieu de la preuve lue).
- Banc `mode-exemple.cjs` suivi (1 sur 5, nouveaux libellés, G3 : une lecture en panne reste
  l'étape courante, G4 avec une vente lue) : vert à 390 clair.
- Captures regardées (390 sombre, 1512 clair/sombre) : défaut vu et corrigé — dans Paramètres,
  la vérification faisait une carte dans la carte ; gestes gris sur gris dans la case du guide.

## Pas fait / à voir

- La présentation `Bienvenue` (premier jour) n'est pas modifiée : son dernier écran dit déjà
  « Ma journée te montre chaque geste ».
- La première vente ne lit que Vinted (`orders_sold`) : un vendeur Leboncoin/Vestiaire seul garde
  l'étape en attente (il peut la mettre « Plus tard » ou masquer le guide).
- Geste de Julien : aucun. Regarder Ma journée d'un compte neuf (ou « Voir VRM avec des exemples »).
