# 8 nov. — Le « ? » de chaque écran, « Signaler un problème » enrichi, le centre d'aide, les alertes de plantage

Branche `claude/aide-signalement` (depuis `claude/amazing-lovelace-xd7obl`). Julien : « fais tout » ;
des vendeurs vont payer. Quatre morceaux, rien de payant (§2.9), pas de 13ᵉ fonction.

## 1. Le « ? » de chaque écran

- **Où** : il SUIT la phrase de l'écran (`PhraseEcran`, App.jsx — icône seule, le texte de la phrase
  ne change pas ; Réglages pose le sien dans sa propre phrase). Les 12 écrans de `PHRASES_ECRAN`.
- **Quoi** : une feuille (`src/composants/AideEcran.jsx`, styles `aide-ecran.css`) : 3 questions de
  CET écran (dépliables, la première ouverte), l'article du centre d'aide (`/aide/<slug>`, nouvel
  onglet), « Tout le centre d'aide », « Signaler un problème ». Pas de visite forcée, pas d'IA.
- **Le texte** : `src/aideEcrans.js` (une source ; clés = `PHRASES_ECRAN`). Chaque réponse dit une
  règle de CLAUDE.md §3/§5 ou un geste qui existe ; ≤ 45 mots, sans jargon (`JARGON`).
- L'instantané de l'écran (pour « Signaler ») est pris AU TOUCHER du « ? », avant que la feuille
  ne le recouvre.
- Réglages → Aide gagne « Centre d'aide » (ouvre `/aide`).

## 2. « Signaler un problème » enrichi

Toujours UNE règle (`normaliserSignalement`, api/_lib/signalement.js), l'aperçu = ce qui part.
Nouveaux champs, tous fermés ou numériques :
- `appareil` (téléphone · tablette · ordinateur), `systeme` (liste fermée), `enLigne`, `theme` ;
- `etatEcran` : nombres de boutons, champs, feuilles, squelettes, pannes affichées, garde-fou tombé,
  défilement (`src/signalementContexte.js`) ;
- `plan` : **la capture SCHÉMATIQUE** — un rectangle `[x, y, l, h, sorte]` par bloc visible (bloc,
  texte, bouton, champ, image, masqué), des NOMBRES seulement. Pourquoi pas une photo : une vraie
  capture porte pseudos, prix, adresses, codes ; la masquer après coup ne se prouve pas, et sans
  bibliothèque lourde le navigateur ne la dessine pas avec les images des autres sites. Ce que le
  mode stream marque sensible (`.vrm-sensible`) est un bloc « masqué ». La feuille le dessine
  (`PlanEcran`) ;
- `lectures` : les 30 dernières requêtes de la page (`src/lecturesRecentes.js`, enveloppe de
  `window.fetch` posée dans main.jsx) : méthode, FAMILLE (`base:app_data`, `api:compte:mode`,
  `auth`…), code HTTP (0 = pas de réponse), durée, heure — jamais une adresse, un paramètre, un
  corps ;
- `plantages` : les **50** dernières erreurs de l'appareil (`erreursRecentes`, src/plantages.js,
  bruit compris et marqué), message nettoyé (`nettoyer` + `masquer`).
- **Masquage** : `masquer` cache aussi les MONTANTS (`{montant}`) ; le message tapé perd les mots à
  forme de pseudo (`a_b`, `a.b`, `lea75` ⇒ `{pseudo}`, `masquerPseudos`) ; l'app passe en plus
  `masque = masquerPourEnvoi` (src/modeStream.js : le programme COMPLET du stream avec les jetons
  publiés par les écrans — pseudos de ses comptes, des acheteurs), que le stream soit allumé ou non.
- Serveur : la ligne garde un `resume` (nombres) ; la LISTE du propriétaire est PROJETÉE (§4.4,
  `SELECT_LISTE`) ; le détail d'un signalement se lit à la demande (`?mode=signalement&id=`,
  « Voir le détail » : schéma, requêtes, erreurs).

## 3. Le centre d'aide `vrm.center/aide`

- Pages statiques `public/aide/*.html` (pas l'app), `aide.css` (Apple calme, clair/sombre : le choix
  `vinted_dark` de l'app, sinon le système), `aide.js` (thème + recherche locale sur
  `index-recherche.json`, sans accents ; aucun script en ligne — CSP).
- **Générées** par `scripts/aide-generer.cjs` depuis `scripts/aide-contenu.cjs` (le texte, une fois).
  `node scripts/aide-generer.cjs --verifier` est rouge si `public/aide/` n'est pas à jour.
  ⚠️ Pour changer un texte : modifier `aide-contenu.cjs`, relancer le générateur.
- 9 articles : extension (Chrome, Orion), boîte e-mail (Gmail, iCloud, relais Apple, Yahoo, Outlook),
  numéros, bordereau, retirer un colis, Compta/URSSAF, abonnement, « Tout va bien ? », signaler.
- Captures en MODE EXEMPLE seulement (`CAPTURES_AIDE=1 node scripts/bancs/aide-signalement.cjs`,
  `public/aide/captures/*.jpg`, 390 px, clair).
- `vercel.json` : `/aide` → `/aide/index.html`, `/aide/<slug>` → `.html` ; `public/sw.js` laisse
  `/aide` au réseau (sinon la navigation ouvrait l'app à la place).

## 4. Les alertes de plantage pour Julien

- **Appareil** (`src/alertesPlantages.js`, branché sur `noterPlantage` par `brancherAlertes` dans
  src/mesuresCollecte.js) : chaque erreur comptée par TYPE (`cleType` de la veille) AVANT le « une
  fois par heure » du journal. Événement si l'écran est tombé sur son garde-fou (origine `ecran` /
  `feuille`) ou si l'erreur s'est répétée 3 fois (`REPETITION_MIN`). Il part ANONYME avec le lot des
  temps réels (`p`, `sendBeacon`, une fois par minute au plus) : écran (liste fermée), message
  nettoyé et masqué, version, nombre.
- **Serveur** (`api/_lib/alertes-plantages.js`, appelé par `recevoirMesures`) : additionné dans
  `plantages_terrain_<jour de Paris>` du PROPRIÉTAIRE (comparer-et-échanger sur `rev`, 4 essais ;
  lecture ratée ⇒ rien écrit, 503) ; appareils comptés par l'empreinte DU JOUR des temps réels ;
  **une notification groupée par heure au plus** (`GROUPE_MS`), ligne marquée AVANT l'envoi ;
  pendant l'heure de repos les types attendent — le lot suivant après l'heure, ou le cron du matin
  (`vidangerAlertesPlantages`, api/ship-reminders.js), les dit. Catégorie `signalement`, étiquette
  `vrm-alerte-plantages` (la nouvelle remplace l'ancienne).
- **Panneau** : Réglages → Sécurité des données → « Plantages chez les vendeurs »
  (`src/composants/PlantagesTerrain.jsx`, `?mode=mesures&quoi=plantages`, propriétaire seul, 403
  sinon ; nombres d'appareils, jamais d'empreinte).
- La veille du matin (types jamais vus, `veille-plantages.js`) reste telle quelle.

## Preuves

- `node scripts/audit-aide-signalement.cjs` — 46 contrôles (H aide, D aucune donnée, F familles,
  G alertes par la vraie `recevoirMesures` et la vraie route `api/compte.js`, fausse base de forme
  PostgREST). `--prouve` : **13/13 mutations rouges** (montants, capture, adresses des requêtes,
  nettoyage, pseudos inconnus, masque de l'écran, regroupement, seuil de répétition, marquage avant
  envoi, famille, « ? » retiré, réponse trop longue, empreintes rendues).
  Sur l'arbre de départ (`git archive 2fb6058f`) : **rouge** (10 ✗, dont de VRAIES fuites :
  prix, titre, pseudos passaient dans le signalement).
- `node scripts/bancs/aide-signalement.cjs` — mode exemple, 390 tactile et 1512, clair et sombre :
  « ? » sur 7 écrans (44 px, rien dessus, nommé), feuille à 3 questions, article existant,
  « Signaler » depuis le « ? » (le schéma est celui de l'ÉCRAN, aucune donnée de l'exemple ni de ce
  qu'on tape dans le texte exact envoyé), le centre d'aide servi avec la CSP de production (recherche,
  chaque page, captures, 44 px, aucune violation). Captures regardées.
- Verts : `npm run build`, `audit-signalement` (62, champs mis à jour), `audit-fonctions-api` (12),
  `audit-variables`, `audit-tdz`, `audit-icones`, `audit-violet`, `audit-politique-hotes`,
  `audit-confidentialite-sql`, `audit-mesures-terrain`, `audit-veille-plantages`, `audit-csp`,
  `audit-secrets`, `audit-coherence`, `audit-urssaf`, `audit-notifs-centre`, `audit-cibles-notif`,
  `audit-conseils`, `audit-journee-hors-ligne`, `audit-vapid`, `audit-verifier-production`.

## Ce qui reste / gestes

- Rien à poser : mêmes variables que les signalements (`SUPABASE_SERVICE_KEY`, `VRM_OWNER_UID`,
  `VAPID_PRIVATE_KEY` pour que l'alerte sonne).
- Geste de Julien : ouvrir `vrm.center/aide` ; toucher le « ? » de Colis ; s'envoyer un signalement
  et regarder « Voir le détail » dans Réglages → Aide → Signalements reçus.
- Un `sendBeacon` n'a pas d'accusé : une alerte marquée « envoyée » sur l'appareil peut se perdre si
  le réseau tombe à cet instant (comme les temps réels) ; la veille du matin (journal par vendeur)
  reste le filet.
