# 14 novembre — Confort et sécurité (lots 117 à 130)

Branche `claude/confort-securite`. Julien a validé « fais tout » sur neuf idées :
117 Ma journée selon l'heure · 118 écran d'atelier · 119 connexion par QR · 120 lien
temporaire pour l'aide · 126 dossier de litige · 127 code à 4 chiffres · 128 aperçu de
l'annonce · 129 inventaire tournant · 130 carte de remerciement.

## Ce qui existait, ce qui manquait, ce qui est fait

| lot | existait (mesuré avant de coder) | manquait | fait | pas livré, et pourquoi |
|---|---|---|---|---|
| **117** Ma journée selon l'heure | « Modifier ma journée » (`src/journeePerso.js` : ordre, interrupteurs, cartes fixes, urgences forcées en tête) | aucun ordre selon le moment | règle pure `src/journeeSelonHeure.js` (matin 5–12 h : colis à envoyer puis à retirer en tête ; soir 18–5 h : les 7 derniers jours en haut, messages / favoris / prix / republier avant le reste ; journée : l'ordre d'origine) ; **un seul point d'entrée** dans App.jsx : `ordreJourneeHeure(zone, persoJ)` remplace deux appels `ordreJournee` | rien. Ma journée elle-même est refaite par `claude/refonte-listes` : elle n'a qu'à appeler `ordreJourneeHeure`. SON ordre (s'il a rangé ses cartes) gagne toujours ; une carte fixe garde sa place ; un colis pressé reste devant (cartes forcées d'abord, inchangé) |
| **118** Écran d'atelier | la photo de Ma journée (`vrm_hl_photo_{uid}`, écrite après une lecture COMPLÈTE), `vrm_benefice_jours`, le Wake Lock déjà utilisé par le mode emballage | aucun plein écran | `src/atelierEcran.js` (règle pure) + `src/EcranAtelier.jsx` : heure, 3 chiffres (à envoyer · à retirer · vendu du jour), deux listes (retard d'abord, codes de retrait en grand), relu toutes les 60 s, à chaque publication et au retour de l'onglet ; Wake Lock si dispo (sinon « l'écran peut se mettre en veille ») ; **lecture seule** (un seul bouton : Fermer). Paramètres → Confort et sécurité → « Écran d'atelier », ou `?atelier` | — |
| **119** Connexion par QR | `session-extension` : une session NEUVE fabriquée côté serveur par un lien magique d'administration (`admin/generate_link`, aucun e-mail) aussitôt échangé (`verify`) ; la porte de la double vérification (`etatMfa` → `PorteMfa`) | tout le flux d'approbation | voir « 119 en détail » ci-dessous | — (la voie sûre existe sans clés d'accès : livré) |
| **120** Lien pour l'aide | le mode équipe (016) **non appliqué** ; la projection sans montant de l'équipe vit dans la base (RLS) | un accès sans la 016 | voir « 120 en détail » | rien ne demande la 016. Ce n'est pas le mode équipe : une PHOTO filtrée (rafraîchie tant que l'app du vendeur tourne), pas un accès aux lignes ; aucune mission, aucune écriture de l'aide |
| **126** Dossier de litige | **existait** (10 nov., lot BJ, `src/dossierLitige.js`) : N°, compte, date, transaction, photo de l'annonce, photo du carton, bordereau, suivi PROUVÉ, PDF pdf-lib local | les **échanges** | `echangesDossier` : la conversation de CETTE transaction (`conversation.transaction.id` = son n°, égalité exacte), projetée (jamais `select=data`) ; une page « Échanges avec l'acheteur » (Toi / L'acheteur / Vinted, date, texte ; 40 derniers) ; jamais un pseudo ni un identifiant ; aucune conversation lue ⇒ « Conversation pas lue », jamais « aucun échange » | — |
| **127** Code à 4 chiffres | rien | tout | `src/codeLocal.js` + `src/VerrouCode.jsx` : PBKDF2-SHA-256, 150 000 tours, sel de 16 octets, rangé sur CET appareil (`vrm_code_local`, jamais synchronisé, jamais en clair) ; verrou à l'ouverture et après 1 / 5 / 15 min en arrière-plan ; 1234, 0000… refusés ; 5 erreurs ⇒ `authSignOut` (déconnexion propre) et code effacé ; « Code oublié ? » ⇒ même chose. **Le réglage le dit : ce n'est pas une sécurité du serveur** (le mot de passe et la double vérification le sont) | — |
| **128** Aperçu de l'annonce | « Créer sur Vinted » (`src/CreerSurVinted.jsx`, règle `src/annonceVinted.js`) | l'aperçu | `src/apercuAnnonce.js` + `src/ApercuAnnonce.jsx` : bouton « Aperçu » par fiche ; le titre et la description qui PARTIRONT (`texteAnnonceVinted`, N° compris), photos, prix, marque, taille, état, couleur ; « Vinted ajoute ses frais de protection acheteur » (on ne calcule pas leur barème) ; aucune requête | — |
| **129** Inventaire tournant | le mode inventaire (`src/inventaire.js`, `InventaireStock.jsx`), l'attendu du Stock (`indexerAttendu`) | le tirage du jour | `src/inventaireTournant.js` + `src/InventaireTournant.jsx` (carte du Stock) : 10 N° par jour, tirage DÉTERMINISTE (FNV-1a de jour · vendeur · N°), parmi les paires PRÉSENTES (jamais vendue, « à confirmer », sans N°), un N° vu depuis moins de 30 j repoussé ; « Vu » / « Pas trouvé » / « Retrouvé » dans `vrm_inventaire_tournant` (synchronisé, fusion par date) ; **aucun N° changé, aucune fiche supprimée** : « Pas trouvé » = un signal « À chercher » (point ambre) | — |
| **130** Carte de remerciement | rien | tout | `src/carteMerci.js` + `src/CarteMerci.jsx` : signature, boutique, message, lien ; aperçu ; PDF pdf-lib local, 4 cartes A6 sur A4 (traits de coupe) ou une A6 ; `vrm_carte_merci` (ses champs) ; **rien de l'acheteur** (§3 : « acheteurs fidèles » refusé) | — |

## 119 en détail — pourquoi c'est sûr, et ce que ce n'est pas

`api/_lib/qr-connexion.js` (pur à l'injection près), routé par `api/compte.js?mode=qr-connexion` (aucune 13ᵉ fonction).

1. **L'ordinateur** (pas connecté) : `creer` ⇒ un ticket **signé** (HMAC, clé `QR_CONNEXION_SECRET` ou dérivée de la clé de service) : id au hasard 128 bits, expiration **2 min**, nom (« Mac de … », nettoyé), empreinte SHA-256 d'un **secret** que seul l'ordinateur garde en mémoire. **Aucune écriture en base** à cette étape (un inconnu ne remplit pas la base). Le QR porte le ticket SEUL.
2. **L'iPhone connecté** scanne avec l'appareil photo ⇒ `vrm.center/?connexion-qr=…` ⇒ l'app (session ET double vérification passées) montre « Connecter “Mac de …” ? Seulement si cet ordinateur est devant toi. » ; le ticket est retiré de la barre d'adresse.
3. **SON clic** : `approuver` (SA session, identité lue chez Supabase, jamais dans le corps). Compte avec facteur TOTP vérifié ⇒ le jeton de l'iPhone doit être `aal2`. La ligne `qrc_{id}` est **insérée** (propriétaire neutre) : une seconde approbation ⇒ 409. « Refuser » insère `refuse`.
4. **L'ordinateur attend** (`attendre`, ticket + secret, toutes les 2 s) : rien d'approuvé ⇒ « en attente », rien d'autre ; approuvé ⇒ la ligne passe à `consomme` par **comparer-et-échanger** (un seul gagnant), PUIS `sessionNeuvePour` fabrique la session par la voie de Supabase (lien magique d'administration aussitôt échangé, exactement `session-extension`) : **ni le jeton de l'iPhone, ni un mot de passe**. La session rendue porte les facteurs TOTP : `sessionFrom` les range, la session est `aal1` ⇒ **`PorteMfa` demande le code sur l'ordinateur**.
5. Rejoué ⇒ 410. Expiré (même approuvé à temps) ⇒ 410. Mauvais secret ⇒ 403. Ticket altéré ⇒ 400.

Ce que ce n'est PAS : une protection contre quelqu'un qui envoie SON QR à Julien et le convainc de l'approuver (hameçonnage par QR) — d'où la phrase « Seulement si cet ordinateur est devant toi » et les 2 minutes. Aucune clé d'accès (passkeys refusées, §3).

## 120 en détail

`api/_lib/lien-aide.js` + la liste blanche `src/lienAideProjection.js` (même fonction dans l'app et le serveur, sans dépendance), routé par `api/compte.js?mode=lien-aide`.

- **Signé** : `id.exp.sig`, sig = HMAC(clé, id · vendeur · exp) ; changer l'id, l'expiration ou le vendeur ⇒ 404.
- **24 h** posées par le serveur ; **révocable** (« Couper ») ; 3 liens actifs au plus.
- **Projection** = celle du mode équipe : colis à envoyer (N°, titre, date limite, transporteur, bordereau de CETTE vente), colis à retirer (titre, lieu, code, transporteur, date limite) ; **aucun montant** (même « 120 € » glissé dans un titre est retiré, avec son tiret), aucun compte, aucun message, aucun acheteur. Refiltrée à l'écriture ET à la lecture.
- **Lecture seule** : la page `?aide=…` (sans compte, avant toute porte d'auth) ne fait que lire ; un bordereau n'est servi que s'il est dans la liste (lecture `data->>pdfB64` projetée).
- **Journalisé** : chaque ouverture et chaque bordereau (heure, navigateur en 40 caractères), visibles dans le réglage. Le journal s'écrit **sous condition « pas révoqué »** : une ouverture lue avant « Couper » ne peut pas ré-ouvrir le lien.
- **Fraîcheur** : tant qu'un lien est actif sur cet appareil, la coque renvoie la photo de Ma journée quand elle change (et toutes les 5 min). Sans app ouverte, l'aide voit la dernière photo, datée (« liste de sam. 10:12 »).
- Invalide, expiré, révoqué, inconnu, d'un autre vendeur : **tous 404**.

## Où c'est branché

- `src/App.jsx` : `ordreJourneeHeure` (117) ; `QR_A_APPROUVER`, `LIEN_AIDE_JETON` lus une fois ; `if (LIEN_AIDE_JETON) return <VueLienAide/>` ; `<QrOrdinateur>` dans l'écran de connexion (« Se connecter avec l'iPhone », repli) ; `<ConfortCoque>` (src/ConfortCoque.jsx : verrou, approbation QR, atelier, rafraîchissement du lien) à côté de `VisionneusePdf`, après les portes d'auth et de double vérification ; dossier de litige : lecture de la conversation par n° ; `SYNC_KEYS` + `vrm_inventaire_tournant`, `vrm_carte_merci`.
- `src/ecrans/Reglages.jsx` : groupe « Confort et sécurité » (code, QR, lien d'aide, écran d'atelier, carte de remerciement).
- `src/ecrans/Stock.jsx` : la carte de l'inventaire tournant (unités de `indexerAttendu`, mémorisées sur `sigAttendu`).
- `src/CreerSurVinted.jsx` : « Aperçu » par fiche.
- `src/styles-confort.css` : jetons `--d-*` du système (la nuit vient d'eux), un accent (bouton principal), ambre en point, jamais de rouge.
- Textes : `confort.*` dans `src/i18n/langues/<l>/confort.js` (5 langues) ; 9 lignes dans `src/nouveautes.js`.
- `src/ui/*` de `claude/refonte-listes` : repris puis **retirés** — aucun de ces écrans n'est une liste longue (les rangées utilisent `.vrm-cf-liste`, sur les mêmes jetons) ; les reprendre aurait dupliqué `listes.*` et des jetons absents de `main`.

## Preuves

- `node scripts/audit-confort-securite.cjs` : **88 contrôles** qui EXÉCUTENT les règles (la route QR entière avec base et Supabase de doublure ; la route du lien avec sa base de doublure ; WebCrypto de Node ; pdf-lib réel) + le branchement. `--prouve` : **26 mutations, toutes rouges** (sans clic, rejoué, sans expiration, sans signature, sans secret, sans MFA ; montant dans la projection, « € » dans un titre, sans expiration, sans révocation, journal qui ré-ouvre, bordereau hors liste, sans journal ; code en clair, sans sel, sans plafond ; tirage au hasard, vendues tirées, N° modifié, sans signal ; ordre ignoré, fixe déplacé ; atelier d'un autre jour ; échanges par ressemblance, pseudo ; carte avec l'acheteur).
- `scripts/bancs/confort-securite.cjs` : les vrais écrans montés seuls (esbuild, aucun `npm run build`), 390 tactile ET 1512, clair ET sombre, **140 contrôles verts** (contenu, lecture seule, aucun €, secret jamais dans le QR, rien sans clic, 5 erreurs ⇒ déconnexion, 10 N° parmi 1 000 sans en changer un, débords, cibles 44 px, aucune erreur). `MUTATION=aide-montant` ⇒ rouge. Sur `origin/main` ⇒ rouge (les écrans n'existent pas). Captures regardées (atelier, QR, verrou, aide, aperçu, tournant, merci).
- Gardés verts : `npm run build`, audits traduction, tdz, coherence, variables, csp, fonctions-api, equipe-ecriture-membre, identite, quoi-de-neuf.

## Gestes de Julien

- Aucun obligatoire. Facultatif : poser `QR_CONNEXION_SECRET` et `LIEN_AIDE_SECRET` (≥ 32 caractères) sur Vercel ; sinon une clé est dérivée de la clé de service (jamais écrite nulle part). Sans clé de service, les deux routes répondent 503 et l'écran le dit.
- Pour essayer 119 : sur l'ordinateur, vrm.center → « Se connecter avec l'iPhone » → scanner avec l'appareil photo de l'iPhone connecté → « Connecter ».
