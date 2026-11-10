# 10 nov. 2026 (soir) — « Ton adresse VRM » : un seul parcours, plus simple, plus beau

Branche `claude/adresse-vrm-simple`. Julien, mot pour mot : « je veux que tu améliores le
processus de création de l'adresse de transfert dans l'app si possible, je veux que ce soit
beaucoup plus simple et intuitif, je veux que tout soit plus beau ». Puis, sur sa capture de
E-mails → Relier ma boîte (compte en « Masquer mon adresse » d'Apple) : « pk ça charge en
continu, je veux que tout soit plus beau c'est pas ouf là ». Et il s'inquiétait de devoir
« valider la demande de transfert » de Gmail.

## Ce qui a changé

- **UN parcours** (`ParcoursAdresseVrm`, `src/AdresseReception.jsx`), en tête de
  **E-mails → Relier ma boîte** ; **Paramètres → Mes e-mails → Mon adresse VRM** ouvre la MÊME
  pièce dans une feuille (« Recevoir tes e-mails »). L'ancienne rangée qui ouvrait une feuille,
  l'ancien « Relier la boîte de … » (`RelierCompte`) et la scène animée vers la boîte collective
  ne sont plus montés ensemble : la scène (`RelierBoite`) ne revient que si l'adresse VRM n'est
  PAS ouverte (`pret === false`, pas de `DOMAINE_RECEPTION`). La ligne de l'adresse dans
  E-mails → Adresses est retirée (le parcours est juste au-dessus).
- **Barre 1 · 2 · 3 · ✓** (Adresse · Transfert · Essai · Reçu), une étape à l'écran, chaque rond
  se touche ; **reprise** là où il s'est arrêté (`vrm_parcours_adresse_vrm`, cet appareil, un
  confort) ; la preuve lue passe devant : essai reçu ou compte relié ⇒ ✓ ; un code de
  confirmation arrivé ⇒ au moins l'étape 2 (`etapeDuParcours`).
- **1. Ton adresse VRM** en grand (monospace), « Copier l'adresse » (gros bouton bleu), « Suivant ».
- **2. Fais suivre tes e-mails** : les comptes à relier en **puces** (initiale + pseudo), la boîte
  du compte (à copier), **SA messagerie détectée par le DOMAINE** (`messagerieDeDomaine`,
  `messagerieDetectee` : boîte du compte, sinon boîtes qui arrivent, source du code, adresse de
  connexion) en UNE grande tuile, les autres sous « Autre messagerie » ; **3 pas** au plus, une
  phrase ≤ 12 mots + un bouton (« Ouvrir Gmail » → `#settings/fwdandpop`, Outlook → page
  Transfert, iCloud, Orange, Free, Yahoo) ; filtre Gmail replié.
  **Apple « Masquer mon adresse »** : « Choisis où Apple fait suivre » + **liste déroulante des
  boîtes déjà reliées** (jamais un relais), « Ouvrir iCloud », « Une autre boîte ? ».
- **Le code de confirmation** (Gmail ; Yahoo/Outlook s'ils en envoient un — iCloud n'en envoie
  pas) : déjà rangé par `api/email-inbound.js` chez le vendeur de l'ADRESSE UNIQUE
  (`vrm_adresse_reception_code`, jamais par l'expéditeur) et rendu par
  `email-rattacher?mode=adresse-unique` ; le parcours le relit toutes les 5 s pendant l'étape 2
  et l'affiche **seul**, en grand, « Copier le code », **« Confirmer dans Gmail ↗ »** (le lien LU
  dans l'e-mail, nouvel onglet, sur SON clic ; jamais suivi par le serveur). L'app re-vérifie
  l'hôte (`lienConfirmationSur` : `mail-settings.google.com`, `mail.google.com`… en https),
  en plus du filtre serveur. Aucun hôte écrit en dur de plus dans `src/` (politique des hôtes
  inchangée : `mail.google.com`, `www.icloud.com`… y sont déjà en « lien »).
- **3. Vérifie que ça marche** : « Envoyer l'e-mail d'essai » (mailto, objet « Essai VRM K7P2 ») ;
  état en direct **calme** : horloge, « En attente… · vérifié à 23:14 », « Vérifier ».
  ⚠️ **Plus jamais de roue qui tourne sans fin** : la roue n'apparaît que pendant SA
  vérification (bouton « Vérifier »), aussi pour la preuve d'un compte (`Verification`,
  `src/RelierCompte.jsx`). **✓ Reçu** quand SON code arrive (identité, jamais une heure).
- **Réglages de l'adresse** repliés : Adresse active, Ce que VRM lit, deux notes d'une ligne,
  Remplacer (confirmé sur place).
- **Adresses sans compte** (`AdressesSansCompte`, App.jsx) : un groupe DA6, une rangée par
  adresse (pastille @, adresse sur une ligne, « 4 e-mails · 9 nov. » en ambre), deux pilules
  « Relier » · « Acheteur » ; la longue phrase d'aide est retirée (la confirmation la porte).
- Serveur, sécurité : **rien changé** (l'adresse de réception décide, preuve d'adresse,
  quarantaine) ; 12 fonctions `api/` ; aucune écriture en base.

## Mesuré en lecture seule (Supabase, 10 nov. 22 h)

Une seule ligne `vrm_adresse_reception` (clés `actif`, `creeLe`, `jeton`) et son index
`jeton_reception_*` (NEUTRE : `at`, `genre`, `owner`), créés à 19:36 UTC ; **aucun**
`_vu`, `_code` ni `_essai` encore : aucun e-mail n'est arrivé sur l'adresse. Le banc sert donc
la forme écrite par le code (`api/email-inbound.js` l. 2203, `api/email-rattacher.js`).

## Preuves

- Banc `scripts/bancs/adresse-reception.cjs` (refait) : **147 ✅ · 0 ❌** — A (parcours entier
  390 tactile / 1512, clair / sombre : détection Gmail, code qui ARRIVE puis s'affiche, lien de
  Google sur son clic sans aucune requête vers Google, reprise après rechargement, attente sans
  roue après 6 s, ✓ Reçu), B (relais d'Apple + liste des boîtes), C (Paramètres, même pièce),
  D (pas ouverte / pas su), règles pures (hôte du lien, domaine, 3 pas ≤ 12 mots).
  **Rouge sur origin/main** (git archive + banc copié dedans) : 12 ✅ · 21 ❌.
  **Mutations** : roue toujours affichée ⇒ 4 ❌ ; `lienConfirmationSur` sans contrôle d'hôte ⇒ 1 ❌.
- `vague2-comptes` vert (W2 : 42 ✅) ; `onglets-c` : C1 vert, seul C5 (Ma journée) rouge — **déjà
  rouge sur origin/main** ; `boite-emails` : 4 ❌ sur la marque d'expéditeur — **déjà rouges sur
  origin/main**.
- Audits verts : variables, tdz, coherence, identite, icones, fonctions-api, emails-transfert,
  adresse-reception, adresse-sans-compte (A4 ajusté à la ligne compacte), sms-colis ;
  `relier-compte` : R6 réécrit (un parcours, l'ancienne scène seulement si l'adresse n'est pas
  ouverte), R7 rouge **déjà sur origin/main** ; `politique-hotes` rouge **déjà sur origin/main**
  (`LivrePoliceCarte.jsx`, `raccourcisSiri.js`). `npm run build` vert.
- Planches avant/après : `docs/passation/planches-adresse-vrm/` (1 adresse + transfert 390 ;
  2 Relier ma boîte 1512 — la capture de Julien rejouée sur des données inventées ; 3 adresses
  sans compte + code Gmail + Reçu).

## Reste

- Outlook/Yahoo : la forme réelle de leurs e-mails de confirmation n'a jamais été mesurée
  (règle serveur d'avant, inchangée) ; un message non reconnu reste un e-mail de sa boîte VRM.
- Liens « Ouvrir … » : pages d'aide officielles relevées le 6 et le 10 nov. ; Orange/Free
  peuvent changer leurs menus.

## Geste de Julien

Aucun. Pour voir : E-mails → Relier ma boîte (ou Paramètres → Mes e-mails → Mon adresse VRM),
puis faire le transfert Gmail : le code s'affiche tout seul à l'étape 2.
