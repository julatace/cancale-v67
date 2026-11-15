# 15 nov. 2026 — Le parcours d'un nouveau, l'onglet « Nouveaux comptes », l'aide pour se débrouiller seul

Branche `claude/parcours-nouveau` (partie d'`origin/claude/project-review-nsk5su` f782040f, avec
`origin/claude/verre-app` — le « Verre dépoli » — et `origin/claude/parametres` — dix catégories —
fusionnées par un vrai merge). Pas de PR (consigne). Extension NON touchée. Aucune migration, aucune
13ᵉ fonction (`api/` : 12).

Julien (15 nov.) : « Améliore le parcours. Je veux avoir un onglet dans le compte admin pour voir ce
que ceux qui créent des comptes auront. » Et : « L'aide aux autres utilisateurs : quand quelqu'un
d'autre aura un souci, il faut qu'il puisse se débrouiller sans toi : un centre d'aide à jour avec les
nouveaux écrans, et "Signaler un problème" qui t'arrive vraiment. Fais. »

## 1. Le parcours joué d'une traite (mesuré avant de coder)

Banc `nouveau-vendeur` (compte VIDE, 390 tactile) sur l'arbre de départ, captures regardées.

| # | accroc | fait |
|---|---|---|
| 1 | **Quatre accueils empilés** pour un compte neuf : Bienvenue (7 écrans, le premier « Choisis ton univers » — clair/nuit, rien d'utile), puis la visite en bulles (3), puis « Ma configuration » (plein écran), puis la carte « Démarrer avec VRM » (3 étapes). | UN parcours en huit étapes (`src/parcoursNouveau/`) qui les REMPLACE pour un compte neuf : Bienvenue, la visite et « Ma configuration » ne s'ouvrent plus ni devant ni derrière (`vrm_bienvenue_vue`, `vrm_visite_vue` posés à sa fermeture ; la configuration attend tant qu'un parcours existe). |
| 2 | **Deux chemins, deux pleins** sur Ma journée : « Configure VRM · Commencer » ET « Démarrer avec VRM · Continuer ». | UNE carte « Démarrer avec VRM · Étape 3 sur 8 · Continuer » (`CarteParcoursNouveau`) tant que le parcours n'est pas fini — ou, fini, tant qu'une PREUVE manque (extension, première lecture). Ni « Configure VRM », ni l'ancienne carte pour un compte qui a le nouveau parcours. |
| 3 | Sur iPhone : « Installe l'extension : télécharge-la, puis installe-la **sur ton ordinateur** » — rien sur Orion, rien sur l'écran d'accueil. | L'étape 3 choisit sa consigne par l'appareil (`appareilIci`) : ordinateur = zip + 3 gestes ; **iPhone = Orion (App Store) + VRM-Orion.xpi + le raccourci « Ouvrir les URL » vers vinted.fr** (Orion navigateur par défaut) + « un site ajouté à l'écran d'accueil n'a AUCUNE extension » ; Android = Firefox ou un ordinateur. Dans Safari : « Ici, Safari ne peut pas la voir : ouvre VRM dans Orion pour vérifier » (pas su dit, jamais « absente »). |
| 4 | « Qui numérote » et « j'ai déjà mes N° sur mes cartons » n'étaient posés qu'après coup (cartonsNumeros, si des N° écrits étaient lus). | Étape 5 : trois choix (VRM · moi-même · « j'ai déjà mes N° sur mes cartons »), écrits dans `vrm_numero_ecrit` avec EXACTEMENT la forme de `reglageDuChoix` / `reponseCartons` (l'audit compare). |
| 5 | L'import des 12 mois n'était dit nulle part au départ. | Étape 6 : l'état LU de `import_vinted_{uid}` (« Commence dès que Vinted est ouvert », « En cours · 340 sur 1 200 », « lu », « pas su »). |
| 6 | L'abonnement : rien au départ. | Étape 8 : l'état lu du serveur (gratuit pour l'instant / essai J-n / actif / pas su), Solo 16,99 € et Pro 19,99 € (« Bientôt » tant que `PRO_OUVERT` est faux — constantes de `accueil-reglages.js`, jamais en dur), et §3 « Sans abonnement : un extrait net, le reste flouté. Rien n'est supprimé. » |
| 7 | Après le parcours, la visite de Ma journée (« Tout sur un N° ») sautait aussitôt dessus. | L'étape 7 montre Ma journée (capture RÉELLE du mode exemple) : sa visite est notée vue à la fin (rejouable par son « ? »). |
| 8 | L'inscription : le titre « Ton espace de revendeur. » gris sur bleu, « Découvrir avec des exemples » et le pied presque illisibles (verre). | **Pas touché** : c'est la feuille du chantier « Verre dépoli » en cours (`claude/verre-app`) — signalé ici pour lui. |
| 9 | Annonces d'un compte vide restait sur l'écran de démarrage à 1,5 s (banc). | Pas reproduit en attendant plus ; pas touché. |

### L'écran (verre dépoli, maquette 9)

`src/parcoursNouveau/ParcoursNouveau.jsx` + `parcours-nouveau.css` : le bleu profond dégradé (jetons
`--sv-*`), huit segments en haut (fait / courant / vu), « Étape 3 sur 8 · Extension », « Plus tard » ;
UNE illustration (capture du mode exemple marquée « Exemple · inventé », ou un dessin en trait : le
navigateur et son badge VRM, l'iPhone avec Orion et le raccourci, les douze mois) ; le titre blanc
30/700 (40 sur ordinateur), une phrase, UNE plaque de verre (le statut avec sa diode : vert fait,
ambre à faire, bleu en cours, gris pas su) ; en pied « Précédent » et UN plein (rond d'encre en barre
— au téléphone sur toute la largeur, « Continuer » en lien dessous quand le plein emmène ailleurs).
Ordinateur : deux colonnes. `prefers-reduced-motion` respecté ; l'entrée est un glissé (jamais un fondu :
mesuré, une horloge d'animation calée laissait l'étape à opacité 0 dans le cadre de l'aperçu).
Tout passe par `tr()` (`src/i18n/langues/<l>/parcoursNouveau.js`, cinq langues ; écran ajouté aux
migrés d'`audit-traduction`).

La règle (JS pur) : `src/parcoursNouveau/regle.js` — `parcoursNouveauAOuvrir` (jamais le propriétaire,
jamais « pas su », jamais le mode exemple ; un compte neuf seulement ; repris s'il est commencé ; fini ⇒
jamais ; « Plus tard » ⇒ 3 jours), `etatsEtapes` (chaque étape sur SA preuve : session, `vrm_plateformes_affichees`,
le pont et la première lecture de `useParcoursArrivee` — la même règle que la carte —, `vrm_numero_ecrit`,
l'import, l'abonnement ; « pas su » n'est jamais « fait »), `positionApres` (`vrm_parcours_nouveau` dans
SYNC_KEYS : repris à la même étape sur n'importe quel appareil).

## 2. L'onglet « Nouveaux comptes » (propriétaire)

**Où** : Paramètres → Aide et « Tout va bien ? » → (groupe propriétaire) **Nouveaux comptes**
(`?tab=settings&reglage=nouveaux-comptes`). Monté seulement si `useEstProprietaire()` (le SERVEUR le dit,
`/api/compte?mode=abonnement` → `proprietaire`, lu dans `vrm_reglages.proprietaire`).

**L'aperçu en direct** (`src/parcoursNouveau/NouveauxComptes.jsx`) : la VRAIE app dans un `<iframe
name="vrm-bac-a-sable-nouveau" src="/apercu-nouveau?bac=<étape>&appareil=…">`, à 390×844 (téléphone,
« Consigne iPhone » cochable) ou 1512×945 (ordinateur), mis à l'échelle ; « Étape 3 / 10 · Bienvenue »,
‹ ›, et les dix pastilles : la vitrine publique, l'inscription, puis les huit étapes.
- **Le bac à sable** (`src/modeExemple.js`, la porte du mode exemple) s'installe AVANT l'app, et
  SEULEMENT dans un cadre nommé ainsi dont le parent est de la MÊME origine (un onglet, un autre nom, un
  autre site : jamais). Base VIDE en mémoire (un compte qui vient d'être créé), session d'un compte
  fictif (`UID_BAC`), base et `/api` répondues sur place (aucune requête ne sort), extension coupée,
  notifications refusées, **ni IndexedDB, ni l'évènement `storage`** (le cadre partage l'origine de
  l'onglet de Julien : sa copie des lignes, ses gestes hors ligne, sa session qui change), **rien dans le
  vrai sessionStorage** (« Découvrir avec des exemples » ne fait rien dans le cadre), pas de bandeau
  « Exemple ». Le compteur « Écritures bloquées dans l'aperçu : n » lit `__vrmExemple()` du cadre.
- **vercel.json** : seul `/apercu-nouveau` (réécrit vers index.html) porte `X-Frame-Options: SAMEORIGIN`
  et `frame-ancestors 'self'` (une règle en fin de liste, qui gagne) ; tout le reste garde `DENY` /
  `'none'` ; `frame-src` gagne `'self'` (la page de Julien encadre la sienne). Le service worker laisse
  `/apercu-nouveau` au réseau (ce n'est pas la coquille).

**Le tableau anonyme** : `/api/compte?mode=pilotage&quoi=parcours` (`api/_lib/parcours-comptes.js`, la
garde du tableau de bord : jeton vérifié, propriétaire seul, **403 et RIEN lu** sinon). Seulement ce que
la base mesure déjà : comptes créés (Auth), app ouverte (ligne `main`), extension vue (`ext_appareil_*`,
`vinted_accounts`, `lbc_accounts`, `vc_session`, ou une lecture rangée), première lecture
(`harvest_*_listings|orders_*`, `lbc_*`, `vc_*`), étape du parcours (`main.vrm_parcours_nouveau`,
projeté), abonnés (`abonnements`, tests écartés). Rendu : l'entonnoir, « où ils s'arrêtent », l'étape
atteinte, les inscrits par semaine (lundi), et « Pas mesuré : … » pour ce qui manque. Aucun e-mail,
aucun identifiant, aucune date au jour près.

**En base de production (lecture seule, 15 nov.)** : 7 comptes en dehors de Julien (semaines du 28 sept.
×2, 5 oct., 19 oct. ×3, 2 nov.) ; 6 ont ouvert l'app ; 3 ont un compte Vinted rangé, 4 une lecture
(un compte lu dont la ligne `vinted_accounts` a disparu — d'où « une lecture prouve l'extension ») ;
0 abonné, 0 essai ; **l'étape du parcours n'est pas mesurée** pour eux (ils sont arrivés avant). Accès :
`abonnement_obligatoire = 0` (gratuit pour l'instant).

## 3. L'aide pour se débrouiller seul

**Centre d'aide** (`scripts/aide-contenu.cjs` → `node scripts/aide-generer.cjs`, `public/aide/`) :
- chemins mis à jour (Paramètres en dix catégories : plus aucun « Réglages → ») ;
- 8 fiches neuves : **Tes premières minutes** (les huit étapes, reprendre), **Paramètres : où trouver
  quoi**, **Le Stock en étagères**, **Vendue ? La retirer des autres sites**, **Même photo : relier**,
  **Republier, pas à pas**, **Retours : « À renvoyer »**, **L'argent à venir** (+ `ARTICLES_AIDE`) ;
- Extension : le raccourci iPhone « Ouvrir les URL » (Orion par défaut), « un site ajouté à l'écran
  d'accueil n'a AUCUNE extension », la version servie (5.385.0) ; Abonnement : Solo / Pro, « Sans
  abonnement » (§3) ; Signaler : « Reçu · on te répond ici » et où lire la réponse.
- `audit-parcours-nouveau` (A) : aucun « Réglages → », chaque « Paramètres → X » nomme une catégorie
  qui existe, chaque écran d'aujourd'hui a sa fiche.

**« Signaler un problème » — le chemin réel, mesuré** :
1. L'app : `POST /api/compte?mode=signalement` (la session ; `normaliserSignalement` : texte, écran,
   version, extension, appareil, schéma de l'écran, 30 requêtes, 50 dernières erreurs — montants,
   e-mails, pseudos masqués).
2. Le serveur range la ligne `signalement_<heure>_<compte>_<k>` dans `app_data` du **PROPRIÉTAIRE**
   (`vrm_reglages.proprietaire` = le compte de Julien, lu en prod), 5/h par compte.
3. Une notification « 🛟 Problème signalé » part vers ses appareils (`sendPushToAll` ; en prod il a
   12 abonnements push rangés).
4. Il la voit dans Paramètres → Aide → **Signalements reçus** (« Voir le détail », « Traité »).
- **En base de production : 0 signalement, 0 demande d'aide** à ce jour (rien à « avoir vu »).
- **Ce qui manquait** : le retour. Ajouté : « Répondre » sous chaque signalement (propriétaire seul,
  `repondreSignalement` : rangé SUR la ligne du signalement — `reponse`, `reponduLe`, traité —, une
  lecture ratée n'écrit rien), puis UNE notification « 🛟 VRM t'a répondu » vers les appareils de
  l'AUTEUR (`contexteVendeur.run({ owner: r.de })`), qui ouvre **Paramètres → Aide → Mes
  signalements** (`?reglage=mes-signalements`) : ses signalements (« Reçu · on te répond ici ») et la
  réponse. Lus par le serveur, filtrés sur SA session (`data->>de`) — jamais une ligne qu'il pourrait
  écrire lui-même : personne ne se fabrique une « réponse de VRM ». La feuille dit maintenant
  « Reçu · on te répond ici — Mes signalements » après l'envoi.

## Preuves

- `npm run build` vert.
- **`node scripts/audit-parcours-nouveau.cjs`** : 44 verts (R règle, B bac à sable exécuté sur une
  fenêtre simulée, V vercel.json, P route « Nouveaux comptes » sur une fausse base PostgREST, S réponse
  aux signalements, A centre d'aide). **`--prouve` : 13/13 mutations rouges** (propriétaire interrompu,
  installé interrompu, « pas su » = fait, forme des cartons, bac hors cadre, IndexedDB laissé, session
  écrite, garde serveur retirée, e-mail qui sort, réponse par n'importe qui, suivi de tous, cadre pour
  tous, ancien chemin d'aide). Sur l'arbre de départ (`--racine`) : rouge (les modules n'existent pas).
- **Banc `scripts/bancs/parcours-nouveau.cjs`** (390 tactile + 1512, clair + sombre, un navigateur par
  partie) : P le parcours entier joué (vitrine → Essayer gratuitement → inscription → compte neuf : les
  huit étapes, un plein chacune, visibles, rien ne déborde, 44 px, écritures de SES réglages, reprise
  après rechargement, iPhone Orion + raccourci, fini ⇒ Ma journée seule) ; A l'onglet (propriétaire
  seulement ; un autre compte : pas d'entrée ET 403 du VRAI code serveur ; dix étapes dans le cadre ;
  213 requêtes du cadre interceptées : 0 vers la base, 0 vers /api, 0 écriture ; son stockage et sa base
  intacts ; tableau = calcul serveur, sans e-mail ni identifiant) ; S un signalement d'un autre compte
  arrive chez le propriétaire, le notifie, il répond, l'auteur est notifié et lit la réponse ; un autre
  compte ne liste ni ne répond (403).
  **Résultat : 375 OK, 0 KO** (390 + 1512, clair + sombre, un passage complet ; machine chargée à 42 :
  deux passages précédents avaient un onglet tombé à 1512, rejoués seuls : verts). Après la fusion finale
  d'`origin/claude/project-review-nsk5su` : 390 clair rejoué, 99 OK, 0 KO.
  **Rouge sur l'arbre de départ** (`git archive` de f782040f, banc copié DEDANS, son propre `dist` et son
  propre code serveur) : 5 KO (le parcours ne s'ouvre pas, pas d'onglet, pas de « Reçu », la réponse
  n'existe pas).
  **Mutation** (bac à sable retiré, `demandeBacASable` ⇒ `null`, arbre reconstruit) : 8 KO — le cadre
  rouvre l'app avec la VRAIE session de Julien et part vers la base (« GET …/rest/v1/app_data… »).
- Audits verts : `traduction` (+ deux écrans migrés), `tdz`, `variables`, `studio`, `csp`,
  `fonctions-api` (12), `centre-aide`, `quoi-de-neuf`, `identite`, `entetes`, `aide-generer --verifier`.
  `audit-aide-signalement` : 1 rouge DÉJÀ présent avant ce lot (« Réglages pose le sien » : la ligne du
  « ? » de Paramètres a changé avec le chantier Verre/Paramètres) — pas touché.

## Restes / gestes de Julien

- Aucun geste technique. Ouvrir Paramètres → Aide → **Nouveaux comptes** et feuilleter les dix étapes
  (Téléphone / Ordinateur, « Consigne iPhone »).
- La notification de réponse est en français (comme celles du propriétaire) : la langue de l'auteur
  n'est pas connue du serveur.
- Les captures de la vitrine (`public/accueil/*.webp`) datent d'avant le verre : le parcours les montre
  telles quelles (vraies captures du mode exemple) ; à refaire avec le chantier vitrine.
- L'inscription (accroc 8) reste au chantier Verre.
