# Intégration des PR restées ouvertes depuis le 16–17 nov. (23 nov.)

Session d'intégration du 23 nov. (agent `integration-prs`). Mission : mettre en ligne, une par une, les PR prêtes du
16–17 nov., après un vrai `git merge origin/main` (design noir encre, extension 5.439 puis 5.440, latence), en gardant
le design et les règles de `main`.

**Règle temporaire reçue en cours de route (coordinateur)** : Julien présente VRM le 23 nov. à 17 h (Paris) ⇒ **aucune
fusion sur main entre 15:00 UTC et le 24 nov. 07:00 UTC** ; avant 15:00, seulement les PR les plus sûres (CI sans
rouge nouveau, effet visible vérifié) ; machine saturée ⇒ aucun build/banc local jusqu'à 15:30 UTC.

## Méthode suivie

- Un worktree par lot (`/home/user/wt-integ/<lot>`), vrai merge de `origin/main`, build, audits et bancs du lot sous `lourd.sh`.
- **CLAUDE.md laissé à main dans chaque PR.** La ligne du §9 de chaque lot faisait entrer chaque PR en conflit avec
  toutes les autres (toutes ajoutent en tête du §9), et une PR en conflit ne lance même pas la CI. Les lignes du §9 sont
  regroupées dans la PR de ce récit (une seule ligne, le détail ici).
- **Quoi de neuf** : chaque entrée garde sa date d'origine et se pose parmi les entrées du même jour, à une place propre au
  lot (deux lots ne touchent jamais la même ligne de `src/nouveautes.js`).
- Code découpé sur `main` depuis le 16 nov. (`src/ecrans/Comptabilite.jsx`, balises `// ⟦→ …⟧`) : les morceaux du lot écrits
  dans `App.jsx` ont été reportés à leur nouvelle place (patch par morceau, puis relecture des identifiants et des chemins
  `../`) ; les audits qui lisaient `App.jsx` seul lisent l'app recollée (`scripts/_source-app.cjs`) ou le fichier qui porte
  le code — portés sur la RÈGLE, jamais affaiblis.
- Styles du 16 nov. (« Verre », bleu `#0060CC`) repassés sur les jetons natifs de main (`src/natif/jetons.css`) partout
  où `audit-style-vintex` les attrapait.
- CI comparée **audit par audit, banc par banc, job par job** à celle de la dernière PR fusionnée sur main (#1306, puis
  #1307) ; un audit « instable — vert au second essai » n'est pas un rouge. Outils (scratchpad de la session) :
  `integ/rouges.sh`, `integ/etat.sh`.
- File GitHub Actions saturée (35 runs en file, 2–3 en cours) : les runs des lots qui n'étaient pas les prochains ont été
  annulés pour laisser passer les autres (dont `favoris-auto`, priorité de Julien), puis relancés.
- Disque : 0,8 Go libres à 09:00 UTC ⇒ dossiers temporaires d'audits de plus de 2 h supprimés dans `/tmp` (3,3 Go), worktrees
  de lots déjà fusionnés retirés (`style-clarte*`, `ext-5438`, `latence`, `annulees-vc`).

## Tableau

| PR | lot | état | remarque |
|---|---|---|---|
| #1237 | abonnement-clair | **fusionnée** (c50fdb6cc, Vercel success) | CI : aucun rouge nouveau ; audits du lot verts ; banc `abonnement` : la partie d'avant clique des onglets de Paramètres qui n'existent plus (rouge aussi sur main), la partie du lot (`BANC_SEUL=rappel`) n'a pas pu tourner (machine) |
| #1223 | reprendre-ou-jetais | **fusionnée** (4c13f9643, Vercel success) | position gardée 12 h posée sur la règle de défilement de main ; banc `reprise-ecrans` : les contrôles du lot (11 h ⇒ rouvre, 13 h ⇒ Ma journée) verts ; P1/P2/P4/P7/P8 rouges = filtres de Ventes refaits par le design (pas le lot) |
| #1232 | onglet-annonces-iphone | **fusionnée** (820f42d47, Vercel success) | banc `barre-depuis-journee` porté sur la barre native (Aujourd'hui · Annonces · Ventes · Achats · Argent) : 39/39 |
| #1235 (+#1227) | apparence-rangee (contient sombre-auto) | prête | Apparence native de main gardée, « Comme l'appareil » en premier et par défaut, interrupteur retiré ; banc `sombre-auto` 16/16 (porté sur `data-apparence-coche`), capture 1512 regardée |
| #1224 | alerte-soir-colis | prête | vrai défaut corrigé en CI : la clé du N° entre guillemets dans le chemin JSON (`audit-chemin-json-guillemets`) ; banc `rappel-soir` 44/44 (fausse base : `->"id"` = clé, comme PostgREST) ; CI : seul `audit-ext-arrets-formulaire`, instable (2/3 verts en local, sans lien) |
| #1189 | serveur-robuste | prête, pas fusionnée avant la démo (changements serveur) | audits portés : `audit-sms-colis` (ancre de mutation du filtre encodé), `audit-sms-expediteurs` (le lien SMS est désormais borné 20/min : compteur vidé par appel) |
| #1229 | doublons-meme-compte | prête | reportée dans `Comptabilite.jsx` ; audits `doublons-compte` (12/12 mutations) et `doublons-historique` (39/39, Annonces et Ma journée lisent `deuxFoisADire`) portés ; banc `en-ligne-deux-fois` vert |
| #1241 | partage-aidant | prête | page de l'aidant à l'encre (plus de bleu), photo permise avec sa raison, réglage chargé à la demande (part française du démarrage ≤ 80 Ko) ; audits et banc verts |
| #1234 | confiance-clients | prête | pages d'aide régénérées (`aide-generer.cjs`) ; CI : Audits part 2 annulé (relancer) |
| #1238 | aide-videos | prête | vidéos et textes chargés avec la feuille (`audit-francais-differe` vert) ; ⚠️ sur main, le « ? » n'est plus rendu sur Ventes, Annonces, Argent (design noir encre) : banc `aide-videos` 120/124 pour ça ; vidéos tournées sur l'écran du 16 nov., à refilmer sur le noir encre (`scripts/films/aide-videos.cjs`) |
| #1221 | stock-mieux | à finir | couleurs passées sur les jetons (ambre = paire à sortir) ; banc `stock-mieux` : H « 12 / 32 rangées » mesuré 1,19:1 au pixel alors que la capture le montre lisible — à comprendre avant fusion |
| #1218 | factures-mieux | prête côté code | reportée dans `Comptabilite.jsx`, boutons en `BoutonBase` ; banc `factures-mieux` vert ; `facture-pro`, `facture-vente-pro`, `facture-mobile` cherchent l'ancienne ligne de Ventes (`.vrm-ledger-sale-toggle`) — bancs périmés par le design |
| #1225 | deux-prix-compter | prête côté code | règle reportée (App + Comptabilite), miroir serveur refabriqué ; audits `deux-prix-compter` 42/42, `deux-prix-serveur` 11/11, `vinted-pro` 32/32 ; banc `argent-mieux` 66/72 (contrôles E du lot verts ; B « Copier » et L libellés = design) |
| #1222 | anti-bug | prête côté code | **WebKit et e2e-extension laissés non bloquants** : les exceptions du 16 nov. ne décrivent plus les rouges de main ; le reste (journal des plantages, rechargement propre, contrôle de prod sous WebKit) gardé |
| #1233 | satisfaction-clients | prête côté code | mesure des 10 premières minutes posée sur le « Bien démarrer » refait de main (étapes de main), audit porté 43/43 |
| #1212 | ebay-achats-refonte | prête côté code | cartes eBay sur les jetons natifs (plus de capitales ni de bleu) ; bancs pas joués (machine) |
| #1215 | derniers-rouges | prête côté code | « article » hors Sneakers pour les lignes arrivées depuis (16 phrases), Quoi de neuf par `phraseVendeur` ; CI, budget, PDF laissés à main (déjà faits) ; `vocabulaire-article` / `vendeur-generaliste` restent rouges comme sur main (S1/S2/S3/B10 : textes neufs de main) |
| #1231 | aide-decision | prête côté code, **réduite** | sans la contre-offre automatique (remplacée par la négociation intelligente, 5.437) ; reste par modèle, délai d'envoi par compte, argent qui dort par meuble ; audit 23/23, 13/13 mutations |
| #1220 | recherche-tolerante | **fermée** | `main` porte la même règle depuis le 21 nov. (prio-recherche) |
| #1240 | impression-directe | **fermée** | moteur d'impression refait ; « Imprimer N » en un toucher existe depuis le 19 nov. ; reste à trancher par Julien : sans aperçu + « Annuler » |
| #1186, #1191, #1219 | extension-robuste, traduction-restes, photo-identite-sites | **ouvertes, à refaire** | l'extension est passée en 5.440 avec des refontes des mêmes chemins (écritures dans la page, carte à 9 onglets, liaison guidée) : conflits de fond ; un lot dédié, un train, version réservée 5.442.0 |
| #1228 | vitesse-moteur | **ouverte, à refaire** | 30 morceaux dans le moteur retravaillé par la latence ; preuve « aucun chiffre ne bouge » (`chiffres-volume`) impossible sur la machine saturée |

## ÉTAT À LA REPRISE

- Gel des fusions jusqu'au 24 nov. 07:00 UTC. Les branches « prêtes » ont été refusionnées avec `main` du 23 nov. (après
  #1308 favoris-auto) et poussées ; leur CI tourne (file GitHub lente).
- À la reprise : pour chaque PR « prête », `integ/etat.sh <lot>` (aucun rouge nouveau), `git merge origin/main`, build,
  puis fusion par REST avec le SHA. Ordre conseillé : apparence-rangee, alerte-soir-colis, doublons-meme-compte,
  partage-aidant, confiance-clients, serveur-robuste, deux-prix-compter, factures-mieux, anti-bug, satisfaction-clients,
  ebay-achats-refonte, aide-decision, derniers-rouges, aide-videos, stock-mieux (après le contraste H).
- Bancs non rejoués à cause de la machine : `abonnement` (partie rappel), `ebay-achats-refonte`, `alertes-ebay`,
  `suivi-urssaf`, `parcours-nouveau` (partie signalements), `aide-videos` après le chargement différé.
