# Passation générale — 9 novembre 2026 (soir)

> À lire en premier par toute nouvelle session. Elle remplace la passation générale du
> 7 novembre comme point d'entrée. Chaque chantier a sa passation détaillée (liste §3) :
> ici, l'état, les décisions, ce qui reste, et les gestes de Julien.

## 1. Où en est la production

- **Production** : https://vrm.center (Vercel, déployé à chaque fusion sur `main`).
  Santé : `curl https://vrm.center/api/sante` (champs oui/non + `etat` + `statut` public).
- **Extension servie : 5.335.0** (zip Chrome `public/VRM-extension.zip`, Orion
  `public/VRM-Orion-dossier.zip` + `.xpi`). Chaque version publiée ne change plus jamais
  de contenu (`audit-extension-zip`, `scripts/_versions-publiees.cjs`).
- **Branche d'intégration de la session du 8-9 nov.** : `claude/amazing-lovelace-xd7obl`.
  Chaque lot y est fusionné, vérifié, puis envoyé par PR sur `main` (PR #1054 à #1067 le
  9 nov.). Les agents travaillent chacun sur sa branche `claude/<chantier>` et ne
  fusionnent jamais eux-mêmes.
- **Extension, ce que chaque version a apporté le 8-9 nov.** (table complète : CLAUDE.md §8) :
  | version | quoi | passation |
  |---|---|---|
  | 5.329 | e-mail + mot de passe DANS la carte du logo (shadow root fermée), aucun onglet ; session qui tient | `2026-11-08-connexion-carte-2.md` |
  | 5.330 | « Me connecter avec un code » (e-mail, tout compte, `create_user:false`) ; Google/Discord dans le MÊME onglet sur Orion | `2026-11-08-connexion-carte-3.md` |
  | 5.331 | compte relié signalé tout de suite (`POST /api/push {action:'comptes'}`) | `2026-11-09-fiabilite.md` |
  | 5.332 | carte en iframe de l'extension sur Chrome/Edge/Firefox (Orion : carte) ; liaison d'un compte Vinted neuf vérifiée par le serveur ; origine `cancale-v67-ten.vercel.app` retirée | `2026-11-09-securite-2.md` |
  | 5.334 | « Où est ton numéro ? » : fin de description lue au passage (Vinted, Leboncoin) | `2026-11-09-numero-etiquette.md` |
  | 5.335 | Leboncoin : rattrapage après connexion, `X` = `lbc-account:X`, « Mes annonces » relue en entier, « à retirer » prouvé, carte claire | `2026-11-09-leboncoin-clair.md` |
  (5.333 n'existe pas : numéro réservé puis abandonné pour garder l'ordre de sortie.)

## 2. Décisions de Julien prises le 8-9 nov. (à ne pas renégocier)

- **Sans abonnement** : extrait net + reste flouté, aucune action (8 nov.) — **sauf
  « Exporter mes données »**, ouvert sans abonnement (9 nov., RGPD portabilité). La
  « Sauvegarde complète » reste fermée.
- **Offres** : **Solo 16,99 €** = UN compte vendeur Vinted + comptes d'achat illimités ;
  **Pro 19,99 €** = les ventes de tous ses comptes. Julien est Pro, jamais bridé. Un Solo
  souscrit sous les CGV d'avant le 9 nov. n'est jamais bridé (elles promettaient « tous
  tes comptes »). Solo ne porte que sur Vinted aujourd'hui (Leboncoin/eBay/Vestiaire : à
  décider, §4).
- **Clients partis** : données gardées 12 mois après la fin d'abonnement (date lue chez
  Stripe), e-mail à 11 mois, suppression à 12 ; factures Pro émises gardées 10 ans.
- **Numéros** : « Je numérote moi-même » + « Où est ton numéro ? » (description / titre /
  référence) ⇒ VRM n'attribue plus rien ; un N° écrit qui contredit le N° posé ⇒ « à
  vérifier », jamais écrasé ; remise en ligne ⇒ « C'est la même paire que N°X ? » (photo
  = forte, ressemblance = simple suggestion, son clic relie).
- **Sécurité** : liaison d'un compte Vinted neuf seulement après preuve (migration 029) ;
  formulaire de connexion isolé en iframe hors Orion.
- **Visuel** : « l'après » de la direction artistique validé ; grammaire de rangée unique
  (colonnes fixes, N° en pastille tabulaire, montant calé, une action) ; style Apple,
  accent bleu rare, ambre = geste, rouge = deux paires sous un N°.
- **Notifications** : sans emoji, regroupées, heures calmes 22 h–8 h (sauf double vente et
  échéance avant 10 h), bruit retiré.
- **Pas** de photo de carton → N°, **pas** de rangement suggéré (refusés le 9 nov.).
- **Brevo** branché pour les e-mails d'authentification (SMTP Supabase, expéditeur
  `noreply@vrm.center`, domaine authentifié DKIM/DMARC, rate limit Supabase 100/h, blocage
  IP SMTP désactivé chez Brevo). Google et Discord activés chez Supabase.

## 3. Ce qui a été livré le 8-9 nov. (une ligne, la passation détaillée à côté)

| chantier | passation |
|---|---|
| Connexion dans la carte Vinted (5.329, 5.330) | `2026-11-08-connexion-carte-2.md`, `-3.md` |
| Mot de passe oublié (page `/recuperation.html`) + 6 modèles d'e-mail FR/EN | `2026-11-08-recuperation-mails.md`, `docs/supabase-modeles-email.md` |
| E-mails envoyés par VRM (gabarit commun, e-mail d'essai) | `2026-11-08-mails-envoyes.md` |
| Notifications belles et utiles | `2026-11-08-notifications.md` |
| Nouveau compte relié (feuille + notification) | `2026-11-08-compte-relie.md` |
| Colis → Envoyés : transporteur prouvé, plus récent en haut | `2026-11-08-colis-envoyes-tri.md` |
| Direction artistique phases 1-3 | `2026-11-08-direction-artistique.md`, `-2.md`, `2026-11-09-direction-artistique-3.md` |
| Revue de sécurité (4 défauts corrigés, aucune fuite) | `2026-11-09-securite.md` |
| Sécurité 2 (029, iframe) | `2026-11-09-securite-2.md` |
| /statut automatique (sondes, incidents) | `2026-11-09-statut-auto.md` |
| Contrôle quotidien de la prod en navigateur | `2026-11-09-controle-prod.md` |
| Fiabilité (5.331, anciens bordereaux, Mondial Relay) | `2026-11-09-fiabilite.md` |
| Supprimer mon compte + clients partis | `2026-11-09-rgpd-compte.md` |
| Vendre plus (À relancer, ce qui part vite, bénéfice par compte) | `2026-11-09-vendre-plus.md` |
| Recherche ⌘K + fiche paire | `2026-11-09-recherche-fiche.md` |
| Achats proposés (écrits sur son clic) + export comptable | `2026-11-09-achats-export.md` |
| Inventaire au téléphone + hors ligne | `2026-11-09-inventaire-hors-ligne.md` |
| Tableau du propriétaire + note de satisfaction | `2026-11-09-tableau-proprietaire.md` |
| Charge à 1 000 vendeurs + sauvegarde vérifiée | `2026-11-09-charge-sauvegarde.md`, `docs/sauvegarde-restauration.md` |
| Offres Solo / Pro | `2026-11-09-plans-solo-pro.md` |
| Vitesse du démarrage | `2026-11-09-vitesse-demarrage.md` |
| Où est ton numéro ? + remise en ligne (5.334) | `2026-11-09-numero-etiquette.md` |
| Leboncoin clair (5.335) | `2026-11-09-leboncoin-clair.md` |
| Configuration de départ plein écran + profil fiscal | `2026-11-09-configuration-depart.md` |

## 4. Ce qui reste

### Livrés après la première version de cette passation (9 nov., soir)
- `claude/journee-v2` (Ma journée v2, Ventes ↔ Colis) — en production ; `2026-11-09-journee-v2.md`.
- `claude/zero-banc-rouge` (~20 bancs au vert, 2 défauts de Colis) — en production ; `2026-11-09-zero-banc-rouge.md`.
- `claude/suites-serveur` (Solo côté serveur, double vente Leboncoin) — en production (fait par une autre session sous le même nom de branche) ; `2026-11-09-suites-serveur.md`.
- `claude/direction-artistique-4` (feuilles, saisie gardée, toasts, confirmations, états vides, pilules Colis) — en production ; `2026-11-09-direction-artistique-4.md`. Reste : faire passer les ateliers faits main (`VoileAtelier`) par `SheetShell` (poignée), pied d'actions collé sur les longues feuilles.

**À 21 h le 9 nov., plus aucun chantier en cours** : tout ce qui suit dans « Chantiers en cours » est livré ; reste les suites et les décisions ci-dessous.

### Chantiers en cours au moment de cette passation (branches d'agents)
- `claude/journee-v2` — Ma journée refaite (frise de la semaine cliquable, pile des ventes,
  plus de « 0 € » géant, « + 1756 à dater » avec unité, UNE carte pour les paires
  supprimées avec « Remise en ligne », transporteur sur chaque vente, Ventes ↔ Colis sans
  redite). Captures réelles de Julien décrites dans le brief.
- `claude/zero-banc-rouge` — remettre au vert ~20 bancs rouges par la bonne cause (dont
  `iphone-reprise` « groupe Plateformes » à l'ordinateur, venu du commit 732ccf7f).
- `claude/suites-serveur` — offre Solo appliquée aussi par les bilans/rappels/widget
  serveur ; alerte de double vente Leboncoin alignée sur « vue en ligne < 24 h ».
- `claude/direction-artistique-4` — dernière étape du look : feuilles (atelier Republier),
  confirmations, toasts, états vides, barre du bas.
Si une de ces branches existe sur l'origine sans PR : la fusionner dans la branche
d'intégration (vrai merge), vérifier (§6), puis PR vers `main`.

### Suites notées, pas commencées
- Ouverture de l'app plus légère : cache des listes par appareil validé par `data.rev`
  (touche la règle des publieurs uniques — `2026-11-09-charge-sauvegarde.md`).
- Rendre l'adresse de réception unique obligatoire + index par adresse (charge e-mails).
- Relais de l'extension moins bavard (lit toutes les 30 s) — nouvelle version d'extension.
- Purge serveur des PDF de bordereaux livrés > 90 j (destructif : à décider).
- TVA d'une société → « Ma facture » (Facture Pro garde son réglage propre).
- Vinted Pro : champ « numéro d'étiquetage » (il faut une capture d'une annonce Pro).
- L'app n'affiche pas encore « ce compte Vinted est déjà relié à un autre compte VRM »
  (seul le journal de l'extension le dit, 5.332).
- Ma journée : la ligne « à retirer : pas lu » ne dit plus pourquoi (la raison et « Réessayer » ne sont que dans Colis) — relevé par `claude/zero-banc-rouge`.
- Colis : la puce « comptes à relire » ne regarde que la fraîcheur des VENTES ; un compte dont seuls les achats sont vieux n'est pas nommé.
- `SECURITE.md` décrit encore septembre : à réécrire depuis `2026-11-09-securite.md`.

### Décisions attendues de Julien
1. **Ma journée affichée tout de suite** avec les derniers chiffres (≈ 3 s, « mis à jour il y
   a N min ») au lieu d'attendre la relecture complète (≈ 8 s, plafond `AttenteEcran`,
   décision du 6 nov.) — recommandé : oui.
2. **Ouverture hors ligne à froid** : VRM fermé puis rouvert sans réseau reste sur
   « Vérification indisponible » (`src/PorteConfidentialite.jsx`). Proposition : laisser
   passer seulement si CE compte a déjà passé la vérification sur CET appareil
   (`vrm_porte_ok_{uid}`), et revérifier au retour du réseau. ⚠️ Le garde-fou de sécurité
   de la session a refusé cette modification à un agent : ne la faire que sur un « oui »
   explicite de Julien.
3. **Solo pour Leboncoin / eBay / Vestiaire** (aujourd'hui Vinted seulement).

## 5. Les gestes de Julien (il a dit le 9 nov. : « je vais faire ce que je dois faire ce soir »)

| # | geste | détail |
|---|---|---|
| 1 | Installer l'extension **5.335** | Chrome : vrm.center/VRM-extension.zip → remplacer le dossier → ⟳ ; Orion : vrm.center/VRM-Orion-dossier.zip. Puis ouvrir « Mes annonces » sur chaque compte Leboncoin. |
| 2 | Contrôle de sécurité de la base | Requête unique (6 compteurs, attendu 0 partout) : `2026-11-09-securite.md` (7 requêtes) ; version combinée donnée dans la conversation du 9 nov. L'outil SQL de cette session ne voyait pas le projet VRM (`lgonxzrzjcqthjtbdpzo`) : Julien la lance. |
| 3 | Migrations | **029** (essai `BEGIN … ROLLBACK` dans son en-tête ⇒ « ESSAI OK », puis appliquer, vérifier `pg_trigger`), **028** (additive), **023** ensuite seulement, puis 026, 027, 016 (mode équipe, essai annulé déjà fait le 22 oct.). |
| 4 | Stripe | Prix Pro 19,99 € EUR mensuel, lookup key `vrm_pro_mensuel` → `price_…` dans Vercel `STRIPE_PRIX_PRO` ; `STRIPE_SECRET_KEY` ; webhook `https://vrm.center/api/stripe-webhook` ; portail client ; le jour J : `PRO_OUVERT = true` dans `src/accueil-reglages.js`. |
| 5 | Modèles d'e-mail Supabase | Soit un jeton d'accès Supabase (fenêtre sécurisée, jamais dans le chat) pour `scripts/configurer-auth-production.mjs --appliquer`, soit la page « Mails VRM à coller » (artifact claude.ai) : 6 onglets, sujet + contenu. **Magic Link d'abord** (sinon le code par e-mail de la 5.330 n'arrive pas), puis Reset Password. |
| 6 | Variables Vercel des e-mails VRM | `RELANCES_SMTP_HOTE=smtp-relay.brevo.com`, `RELANCES_SMTP_PORT=587`, `RELANCES_SMTP_UTILISATEUR=<identifiant Brevo>`, `RELANCES_SMTP_MOT_DE_PASSE=<clé SMTP>`, `RELANCES_EXPEDITEUR=noreply@vrm.center` (noms EN FRANÇAIS : c'est ce que lit le code). Puis Réglages → Notifications → « M'envoyer un e-mail d'essai ». |
| 7 | `CRON_SECRET` dans les secrets GitHub | Sans lui, les sondes de /statut ne tournent que 2×/jour. |
| 8 | `public/legal/editeur.js` + `src/contact.js` | Sans eux, personne ne peut payer. |
| 9 | Relire les CGV du 9 nov. (Solo/Pro, prorata) | |
| 10 | Vercel Pro | Nécessaire vers ~70 vendeurs actifs (`2026-11-09-charge-sauvegarde.md`). Supabase est déjà en Pro (sauvegarde quotidienne 7 j). |
| 11 | `DOMAINE_RECEPTION` + Cloudflare (adresse de réception unique) | `2026-11-08-adresse-reception.md`. |
| 12 | E-mails « run failed » de GitHub | Settings → Notifications → Actions. |
| 13 | Compte de démo (facultatif) | `PROD_DEMO_EMAIL` / `PROD_DEMO_MDP` dans GitHub pour le contrôle quotidien connecté. |

## 6. Comment intégrer sans casser (leçons du 9 nov.)

- **Toujours** : `git fetch origin main <branche>` → `git merge origin/main` → `git merge
  origin/<branche>` → résoudre → **`git grep -nE '^(<<<<<<<|>>>>>>>)( |$)' -- .` doit être
  vide** (le 9 nov., un marqueur est parti dans `api/ship-reminders.js` puis dans
  `public/VRM-Orion-installation.txt` — rattrapés avant `main`) → `npm run build` →
  audits du chantier + `variables tdz coherence identite statuts` → push → PR → merge.
- **CLAUDE.md** en conflit : garder les deux côtés du §9 (toutes les lignes datées), puis
  revenir sous 59 000 octets en déplaçant TELLES QUELLES les plus vieilles lignes du §9
  dans `historique-divers.md`. Le 9 nov., un outil de fusion ne gardait que les lignes
  « 8 nov » de l'autre côté : des lignes « 9 nov » ont disparu du §9 (récrites le soir
  même dans le §9 ; leurs passations n'ont jamais été perdues).
- **Versions d'extension** : réserver le numéro AVANT de lancer un chantier qui touche
  `vinted-sync-extension/`, et le dire aux autres ; à la fin, un vrai merge de `main` et
  un numéro au-dessus de tout ce qui y est. Une capacité qui vit hors de `background.js`
  s'écrit `fichier:fonction` dans `audit-coherence` (`_versions-publiees.cjs` la juge dans
  ce fichier depuis le 9 nov.).
- **Règles recopiées côté serveur** : jamais à la main. `api/_lib/ventes-regle.js` se
  refabrique par `node scripts/audit-bilan-semaine.cjs --recopie` (le serveur porte
  `compteEcarteChoix` sous le nom `compteEcarte`).
- **Bancs** : un à la fois ; vérifier `df -h /` (le disque s'est rempli deux fois le 9 nov. :
  retirer les worktrees des agents finis — `git worktree remove` après avoir vérifié qu'ils
  sont propres et poussés — et les vieux dossiers de travail).
- **Limite d'utilisation** : 12 agents en parallèle ont épuisé la limite de 5 h deux fois ;
  ~5 en même temps tient. Un agent arrêté se relance par un message (il reprend où il était).
- **Accès** : l'outil SQL Supabase de cette session ne voit pas le projet VRM ; toute
  mesure de la vraie base passe par Julien (requêtes en lecture seule données en clair).

## 7. Contrôles rouges connus sur `main` (non causés par les lots du 9 nov.)
`iphone-reprise` (5, groupe « Plateformes » de la barre latérale), `chargement` (décalages
de mise en page ponctuels sous charge), `colis-fiables` (58), `colis-tous-sites` (12),
`colis-colonnes` (2), `ventes-colis-premium` (4), `achats-messages-premium` (2),
`annonces-coherence` (4), `outils-stats` (1), `emails-stats-clairs` (4), `stats-vitrine` (6),
`rappel-soir` (9), `bilan-semaine` (banc, 21), `reglages` (6), `reglages-premium` (4),
`chiffres-coherents` (2), `badge` (2, horloge), `lbc-supprimer` (5), `fiche-paire` (1),
`suivi-colis` (1), `csp` (1) — en cours de traitement par `claude/zero-banc-rouge`.
