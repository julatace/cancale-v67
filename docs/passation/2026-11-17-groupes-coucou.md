# 17 nov. 2026 — Groupes d'accompagnement : créer en trois étapes, et le « coucou » (branche `claude/groupes-coucou`)

Julien, mot pour mot : « Je veux que tu améliores aussi la création de groupe
d'accompagnement. Je veux aussi que les personnes puissent se faire coucou, mais pas
échanger des messages dans mon app, mais sur Discord. »

## Mesuré avant de coder

**La base de production, en lecture seule (17 nov.)** :
- la **025 est appliquée** : 22 fonctions `vrm_accomp_*`, les trois tables
  `vrm_accomp_groupes/membres/partages` avec RLS activé ET forcé ;
- la **032 (formateurs) n'est PAS appliquée** (0 fonction `vrm_form_*`) ;
- aucune table de coucou ; les tables `vrm_communaute_*` de la 018-020 sont là (dont
  `vrm_communaute_messages` : la messagerie de la CARTE, voir « À trancher »).

**La création d'avant** (code de `main` et son banc `communaute-groupes.cjs`) :
- une feuille, 3 champs (nom, description de 500 caractères, « ton nom »), 1 bouton ;
  2 touchers + 3 champs ; ensuite un toast « Groupe créé. Son code : … ».
- Frictions relevées : le bouton « Créer » reste grisé sans dire pourquoi (nom < 2) ;
  aucune photo ; ni QR code ni feuille de partage : l'invitation se résume à trois
  boutons collés sur la carte (« Copier le lien · Copier le code · Nouveau code » — le
  geste qui casse l'ancien lien est voisin de celui qui le copie) ; aucune règle dite
  au moment de créer (qui entre ? que voit-on ?) — elles étaient dans un « Pourquoi ? » ;
  chaque membre portait deux boutons sur sa rangée (« Voir » · « Retirer ») ; aucun lien
  Discord ; texte collé au bord des cartes (14 px de marge).

## Ce qui change pour Julien

### Créer : trois étapes, une feuille (`src/communaute/Accompagnement.jsx`)
1. **Le groupe** : une photo (facultative — réduite à un carré de 160 px, JPEG, dans la
   ligne du groupe, aucun hébergement), le nom, une phrase (160 caractères). « Continuer ».
2. **Les règles, dites** : « Sur invitation — avec ton lien, ton QR code ou ton code » ;
   « Tu acceptes chaque personne » ; « Ce que les membres partagent : **Rien, par
   défaut** — chacun choisit lui-même ». Aucun réglage ici : la règle de la 025 ne
   change pas (c'est le MEMBRE qui choisit, rien par défaut). Puis « Ton nom dans le
   groupe » et « Créer le groupe ».
3. **Inviter** : le QR code du lien (dessiné dans la page, noir sur blanc même la nuit),
   le code en grand, « **Partager** » (la feuille de partage d'iOS, seulement si elle
   existe), « Copier le lien », « Copier le code », et **le lien de son serveur ou salon
   Discord** (invitation `discord.gg/…`, `discord.com/invite/…` ou salon
   `discord.com/channels/…` ; toute autre adresse est refusée et dite). « Terminé ».

### La page du groupe
Photo, nom, nombre de membres, « N à valider » (ambre : un geste à faire), « ⋯ » (photo,
nouveau code, fermer — le geste qui casse l'ancien lien n'est plus voisin de « Copier »).
Deux gestes : **Inviter** (la feuille de l'étape 3) et **Ouvrir sur Discord**. Les
demandes : **Accepter / Refuser**. Les membres : une rangée par personne (64 px), qui
ouvre sa fiche — ce qu'il partage (la même vue qu'avant, « — » jamais 0), **Coucou**, et
« Retirer du groupe ». Côté membre : statut, choix du partage (inchangé), « Voir ce que
voit … », « Ouvrir sur Discord », et la section « Faire coucou ».

### Le coucou 👋 — un signe, jamais un message
- **Un toucher, aucun champ, aucun contenu.** La requête ne porte que le groupe et la
  personne ; la base n'a pas de colonne pour un texte (et refuse de s'installer sur une
  table qui en aurait une).
- Celui qui le reçoit le voit **en notification** (nouvelle famille « Coucous de la
  communauté », allumée par défaut, réglable dans Paramètres → Notifications, dans SA
  langue, au nom de CELUI QUI REÇOIT : ses appareils, sa cloche) et **dans Groupes**
  (« Léa t'a fait coucou · groupe · il y a 2 h ») avec **UN geste** :
  « **Lui écrire sur Discord** » → le **profil Discord** de Léa si elle a relié Discord à
  VRM (identifiant signé par le serveur), sinon **le salon du groupe**, sinon « **Pas de
  Discord lié** » et rien d'autre. Aucune réponse dans l'app, nulle part.
- **Qui peut faire coucou à qui** : seulement dans un **même groupe ouvert** — le créateur
  et ses membres acceptés, dans les deux sens. Entre deux membres : seulement si **tous
  les deux** ont allumé « Les autres membres peuvent me faire coucou » (**non par
  défaut** : sans ça, rien ne change à la règle de la 025 — un membre ne voit jamais les
  autres membres).
- **Anti-spam** : **un coucou par paire de personnes et par 24 h** (dans un sens ou dans
  l'autre : on ne « répond » pas par un coucou, on s'écrit sur Discord) ; **20 par jour**
  par personne ; « ⋯ » → « **Ne plus recevoir ses coucous** » (refus neutre pour l'autre,
  qui n'est pas prévenu ; ceux d'avant disparaissent ; « Rétablir » dans un repli) ; et on
  peut toujours quitter le groupe.

## La base : migration `supabase/migrations/046-communaute-coucous.sql` — **PAS APPLIQUÉE**
S'appuie sur la 025 **sans la toucher** (son empreinte et ses fonctions identiques avant
et après, vérifié). Quatre tables neuves, RLS activé ET forcé, aucun droit :
`vrm_accomp_habillage` (photo, lien Discord), `vrm_accomp_coucous` **(id, de, à, groupe,
quand — rien d'autre)**, `vrm_accomp_sourdines`, `vrm_accomp_ouverts`. Règles de lecture
écrites même sans droit accordé : un coucou n'est visible QUE de ses deux personnes, une
sourdine de celui qui l'a posée. 12 fonctions (SECURITY DEFINER, `search_path` vide,
identité par le jeton) ; deux réservées à la clé de service (`vrm_coucou_a_sonner`,
`vrm_coucou_auteurs`) rendent le compte de l'autre à la ROUTE seulement (pour sonner chez
lui et trouver le Discord de l'auteur) — la route ne le renvoie jamais. « Fermer mon
compte » : `vrm_coucou_effacer` (appelée par `effacerCommunaute`). Aucune suppression
dans le fichier, rejouable, essai en fin de fichier (« ESSAI OK : 4 tables (RLS forcé),
12 fonctions, coucou sans texte »).

**Tant qu'elle n'est pas appliquée** : tout le reste marche (créer en trois étapes,
inviter, QR, partager, page du groupe) ; la photo, le lien Discord et le coucou disent
« **bientôt disponible** » et ne proposent aucun bouton.

## La route — aucune fonction `api/` ajoutée (toujours 12)
`api/_lib/coucou.js`, branché dans `api/_lib/accompagnement.js` (`?mode=communaute`) :
`accomp-coucou-lire`, `accomp-coucou`, `accomp-coucou-sourdine`, `accomp-coucou-ouvrir`,
`accomp-habiller`. Jeton de l'APPELANT ; la clé de service seulement pour sonner et pour
le Discord, avec l'identité VÉRIFIÉE (jamais un champ du corps). 046 absente ⇒ 503
`non-installe`. **Discord** : `api/_lib/avatar-discord.js` signe désormais l'identifiant
Discord quand on relie son compte (`did` + `signatureId` dans `vrm_discord`) ; une ligne
d'avant donne l'identifiant seulement par son avatar signé (photo personnelle) — sinon
le salon du groupe. Règles pures partagées : `src/communaute/coucou.js` (le choix du lien,
le lien Discord d'un groupe — la MÊME expression que la contrainte SQL —, la photo, le
texte de la notification en cinq langues).

## Preuves
- `node scripts/audit-coucou-sql.cjs` — la 046 EXÉCUTÉE sur un Postgres jetable (socle
  005-007, 018-020, 025 telles quelles) : **96 verts** ; `--prouve` **16/16** mutations
  (paire dans un seul sens, sans plafond, sans sourdine, sourdine visible, hors groupe,
  membres sans ouvrir, ouvert par défaut, cible en attente, règle de lecture ouverte, un
  texte dans la table, compte rendu, sourdine par autrui, habiller par un membre, lien
  Discord libre, fonction de la route ouverte, retiré qui reçoit).
- `node scripts/audit-coucou.cjs` — règle du lien, signature, VRAIE route, écran :
  **65 verts** ; `--prouve` **12/12** (ordre du lien, « aucun » qui propose, Discord libre,
  texte relayé, 046 absente ⇒ liste vide, identifiant non signé, auteur pris dans le
  corps, compte renvoyé, sonner chez soi, « Fermer mon compte » qui oublie, l'écran qui
  envoie un texte, l'écran qui propose de répondre). Rouge sur `main` (fichiers absents).
- Banc `scripts/bancs/groupes-coucou.cjs` (BANC_PORT 7991 ; le vrai `api/compte.js`, faux
  PostgREST aux règles 025 + 046 ; 390 tactile clair/sombre, 1512 clair/sombre) :
  **112 verts** ; `BANC_MUTATION=sans-sourdine` 2 rouges, `paire-un-sens` 1,
  `hors-groupe` 1, `sourdine-visible` 1 ; sur `main` les sélecteurs de la création en
  trois étapes n'existent pas (rouge). Captures regardées (planche
  `scratchpad/onglets/groupes-coucou.png`) ; une passe corrigée : notes, titres et liens
  posés sur le bleu (hors des cartes) étaient illisibles en clair ⇒ encre claire du
  Studio, comme l'en-tête.
- Banc `communaute-groupes.cjs` suivi (création en trois étapes, « Retirer » dans la
  fiche du membre) : **46 verts**. Il était rouge sur `main` (10 rouges : le parcours
  « Tu vends quoi ? » couvrait l'écran) ; il pose désormais un vendeur déjà installé.
- `audit-cloisonnement` : 1 788 appels de B, **5 364 ✅, 0 ❌** (les actions `accomp-coucou-*`
  sont lues dans le code et jouées).
- `audit-accompagnement` 40, `audit-notifications` 31 (douze familles), `audit-traduction`
  (Accompagnement.jsx migré en entier, 192 clés × 5 langues), `audit-quoi-de-neuf`,
  `audit-fonctions-api`, `audit-textes-courts`, `audit-stockage-sur` verts.

## Gestes de Julien
1. **Appliquer la 046** (quand VRM est peu sollicité) : Supabase → SQL Editor → coller
   `supabase/migrations/046-communaute-coucous.sql` **d'un bloc** → Run. Attendu : la
   notice « ESSAI OK : 4 tables (RLS forcé), 12 fonctions, coucou sans texte ». Vérifier :
   `select count(*) from pg_proc where proname like 'vrm\_coucou\_%' or proname = 'vrm_accomp_habiller';`
   ⇒ **12**. (Elle refuse de s'installer sans la 025 — qui est appliquée.)
2. **Lier le Discord de ton groupe** : Communauté → Groupes → ton groupe → « Inviter » →
   « Lien de ton serveur ou de ton salon » : dans Discord, clic droit sur le serveur →
   « Inviter des gens » → « Modifier le lien » → **N'expire jamais** → copier
   (`https://discord.gg/…`) ; ou clic droit sur un salon → « Copier le lien ». Coller,
   « Enregistrer ».
3. Pour que ton coucou ouvre **ton profil** Discord (et pas seulement le salon) :
   Paramètres → Mon compte → Discord → le relier (ou le relier à nouveau s'il l'était
   déjà, pour que l'identifiant soit signé).

## À trancher par Julien
- **La carte a encore une messagerie dans l'app** (018 : `vrm_communaute_messages`,
  bouton « 👋 Coucou » de la carte qui ENVOIE un texte, conversations, blocage,
  signalement). Ce lot ne la touche pas (il porte sur les groupes). Si « pas de messages
  dans mon app » vaut aussi pour la carte, un lot à part : remplacer « Écrire » et le
  coucou-texte de la carte par ce même coucou + « Lui écrire sur Discord ».

## Ce qui reste
- La photo d'un groupe se change dans « ⋯ » ; elle n'a pas encore de recadrage (le centre).
- Pas de notification au créateur quand une DEMANDE arrive (inchangé depuis le 5 nov.).
