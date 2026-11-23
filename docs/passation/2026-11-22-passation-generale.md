# Passation générale — 22 novembre 2026 (soir)

À lire après `CLAUDE.md`. Elle remplace `2026-11-20-passation-generale.md` comme point d'entrée.
Écrite par la session qui a piloté les chantiers du 21 au 22 nov. (une quinzaine d'agents en parallèle).
Tout ce qui est dit « en ligne » a été vu READY sur Vercel ; tout le reste est sur une branche, pas plus.

## 0. Méthode (inchangée, elle marche)

- Un chantier = une branche `claude/<nom>`, poussée à chaque commit, un récit `docs/passation/2026-11-22-<nom>.md`.
- Mise en ligne : vrai `git merge origin/main` dans la branche, build (`NODE_OPTIONS=--max-old-space-size=8192 flock /tmp/vrm-build.lock npm run build`), audits (aucun rouge nouveau par rapport à `main`), PR, merge avec le SHA de 40 caractères, Vercel READY, `/api/sante` par l'outil Vercel (le conteneur ne joint pas vrm.center).
- Extension : une seule version servie par train ; zips régénérés une fois à la fin (`node scripts/zip-extension.cjs`), copiés dans le scratchpad puis envoyés à Julien.
- `CLAUDE.md` est à ~59 900 octets : toute ligne ajoutée au §9 oblige à déplacer la plus ancienne dans `historique-divers.md`.
- Trop d'agents à la fois = file de builds (9 en attente vues) et bancs de vitesse faussés (charge 14–22 sur 4 cœurs) ; et la limite d'usage de 5 h tombe pour tous en même temps. 5–6 agents est le bon nombre.

## 1. En ligne ce soir (`main` = a772f4977)

| PR | Quoi |
|---|---|
| #1294 | Version finale : extension 5.434.0, chasse aux bugs P1-1…P2-5 |
| #1295 | Fluidité : gel après Achats (géocodage en boucle), lectures partagées, zéro saut, reprise iPhone ↔ ordi, « Plus vue » |
| #1296 | Anti-robot : Turnstile cité dans la confidentialité (clé de site sur Vercel) |
| #1297 | Extension **5.436.0** : à distance + « Mes comptes », sauvegarde des réglages, parité LBC/VC, offres sans réponse |
| #1298 | Achats en lot : diviser, répartir au centime |
| #1299 | Onglets : gel des écrans gardés hors transition, filet de 1,5 s (déploiement à vérifier READY) |

**Anti-robot ALLUMÉ** (22 nov.) : `VITE_TURNSTILE_SITE_KEY` sur Vercel (production), CAPTCHA Turnstile activé par Julien dans Supabase. Retour arrière : éteindre dans Supabase d'abord. L'extension se connecte par « Se connecter avec VRM ».

**Extension servie : 5.436.0.** Julien l'a installée dans au moins un Chrome (celui des favoris).

## 2. Prêt sur une branche, pas en ligne

| Branche (SHA) | Contenu | Reste avant mise en ligne |
|---|---|---|
| `claude/ext-5438` (c34174cb1) | Train de l'extension **5.438.0** : contient 5.437 (prix mini à la publication, négociation intelligente — éteinte par défaut —, formulaire en ordre variable, description collée, republication en pause quand Vinted vérifie, favoris 15/h max, automatisations la nuit + ordinateur gardé éveillé) + 5.438 (note de santé et cadence par palier, compte précieux, annonce masquée par Vinted, relance des offres sans suite, lot proposé, brouillons qui se remplissent seuls) | Fusionner `claude/audit-extension` (1c5a4c1de) et `main` ; CLAUDE.md < 60 000 ; audits sans rouge nouveau ; zips ; PR. **PRIORITÉ 1** (voir §3) |
| `claude/audit-extension` (1c5a4c1de) | Correctif **favoris/cloche** (voir §3), curseur du panneau, « Publier aussi » après mort du worker, cibles 44 px, bancs `panneau-tout-toucher`, `cloche-favoris`, `audit-ext-*` | Part avec le train 5.438. À relancer : tout-toucher à 390, `--langues`, contrat des messages |
| `claude/bugs-totale` (b9ea3417b) | Bénéfice du jour dans Ma journée, vente connue par e-mail (relue toutes les 2 min), volet Ventes, Achats ordi, Calculette, toast | Finir « vente par e-mail partout » (§3), `Icon` de `RetraitsPoints.jsx` (§3), bancs, PR |
| `claude/style-clarte` (de7f8c0ad) | Design **noir encre** validé par Julien : jetons, Aujourd'hui en tableau de bord (héros bénéfice, graphique 7/30 j, actions rondes, étincelles, Par site), feuille « Ton extension » groupée. Banc `style-clarte` vert d'après son dernier commit | Regarder les captures avant/après, fusion de `main`, PR. Puis tranche 2 (rangées denses Ventes/Annonces/Achats, fiche, reste) |
| `claude/annulees-vc-validation` (7c85bfbb5) | Ventes annulées toutes plateformes (`src/ventesAnnulees.js`), Statistiques ; Vestiaire « en attente de validation » en cours | Écrans, extension (5.439 si capture ajoutée), récit |
| `claude/latence-totale` (1bd7c6da8) | Bancs `latence-repos` et `lighthouse-app`, premières corrections | Inventaire chiffré, corrections, rapport |
| `claude/audit-boutons` (ddf589751) | Robot `scripts/bancs/chaque-bouton.cjs` | Le faire tourner partout, corriger ce qu'il attrape |
| `claude/fluidite-3` | Fusionné (#1299). Suite P1 pas commencée | Voir §3 |

Maquettes du design (données inventées) : scratchpad `maq/planche-tel-N.jpg`, `maq/planche-ordi-N.jpg` (le scratchpad ne survit pas au conteneur : la référence durable est le récit `2026-11-22-style-clarte.md`).

## 3. Bugs ouverts, par priorité

1. **Messages aux favoris bloqués en production (5.436.0)**. Cause reproduite : la cloche ne montre que les dernières notifications (tous types) ; le favori absent ⇒ réessai ⇒ bouton de la cloche plus reconnu ⇒ raison `element_introuvable` inconnue du serveur ⇒ `vinted_refus` (« autre refus ») ⇒ file arrêtée. Correctif sur `claude/audit-extension` (cloche à plusieurs ancres, « Voir tout », favori sauté, `etape`/`cause` sur la ligne, file qui continue). **Non vérifié sur un vrai compte** (forme réelle de « Voir tout »). Il faut livrer la 5.438 et demander à Julien d'essayer.
2. **Une vente connue seulement par e-mail n'apparaît pas** (Ventes, Aujourd'hui, CA du jour). Partiel sur `claude/bugs-totale`. Règles : compte = adresse de réception ; fusion par identité à la capture (jamais le titre) ; jamais comptée deux fois ; URSSAF inchangé.
3. **Boucle de rendus sur Aujourd'hui** (DefaultLane toutes les ~1,3 s : `EtatActions`, `LigneFraicheur`, `AccueilReste` qui compte chaque `vrm:save`, composants de capture) : elle affame les transitions d'onglet. Source exacte pas trouvée ; le filet de #1299 la couvre. Le banc `fluidite-generale` journalise les clés `vrm:save` au moment du blocage.
4. **`src/natif/RetraitsPoints.jsx` ~l.120** lit `Icon` non reçu par `Contenu` : un colis à retirer sans photo doit lever « Icon is not defined » (lu, pas joué).
5. Vitesse : toucher → image Ventes ~1,4 s, Achats ~2,9 s, Ma journée ~0,8 s (390, CPU ×4). Le vrai chantier : découper `Comptabilite` par onglet et virtualiser Annonces ; le banc de non-régression est prêt (`chiffres-volume`, `compare-chiffres-volume`), le découpage pas commencé.
6. Restes visuels : CLS Argent 1512 (+21 px, piste `MemoireDefilement`), titre d'Annonces coupé à 1512, même icône pour « Mes comptes » et « Extension », bancs périmés à réécrire (`cout-vente`, `centre-notifs`, `prix-sans-manuel`).
7. Achats en lot : seuls 43 détails de transaction d'achat sont captés ; les 115 achats « Lot… » restent « Lot ? » tant que l'extension ne lit pas leur détail (à ajouter côté extension).

## 4. Décisions de Julien du 22 nov. (à ne pas re-négocier)

- **Accès à distance = relais par SON ordinateur.** Navigateur dans le cloud et IP/empreinte par compte : refusés (par l'assistant, puis acceptés par lui : « on fait comme avant, avec le relais ordinateur, mais beaucoup mieux fait »).
- **Design : mélange « banque moderne » + « pro Vintex », en NOIR encre**, couleurs sobres, 5 onglets gardés, iPhone et ordinateur au même soin, « simple, pas bâclé », graphiques sur Aujourd'hui, tout le monde doit comprendre (plus de murs de texte).
- **Favoris : 15 messages/heure PAR COMPTE** (maximum réglable ramené à 15 : « la limite de Vinted ») ; seulement les articles pas vendus ; mode automatique dès que compte et extension sont allumés (interrupteur par compte).
- **Les automatisations tournent la nuit** quand l'extension est connectée (remplace « offres selon l'heure » du 12 nov. — il n'a pas reconfirmé explicitement ce remplacement : le lui redemander).
- Prix minimum demandé à la publication ; négociation intelligente par paliers vers ce minimum ; remplissage du formulaire en ordre/rythme variables (valeurs jamais aléatoires) ; description collée par défaut.
- Republication en série mise en pause tant que Vinted vérifie une annonce.
- Achats : lot détecté et divisé sur son toucher, prix réparti ; un achat simple se divise aussi.
- Ventes annulées comptées par plateforme (jamais dans le CA) ; Vestiaire : état « en attente de validation ».
- Retenus pour l'extension : santé du compte (1), compte précieux (2), annonce masquée (3), relance d'offre (5), lot auto (6), brouillons seuls (11).
- Anti-robot sur le site : oui (fait).

## 5. Gestes attendus de Julien

- Installer la **5.436.0** dans chaque Chrome (puis la 5.438 dès qu'elle sort) ; connexion par « Se connecter avec VRM ».
- Relais à distance : laisser Chrome ouvert sur l'ordinateur allumé ; premier essai d'un geste simple (« Relire » un compte) et dire ce qu'il voit — **jamais essayé sur un vrai compte**.
- Confirmer que la nuit tourne au même rythme que le jour.
- Après la 5.438 : choisir « Intelligente » dans Automatisations → Négociation s'il la veut.
- Les gestes anciens restent ceux de `CLAUDE.md` (« Gestes encore attendus ») : secrets GitHub de la sauvegarde, Stripe, éditeur légal, migration 016, etc.

## 6. Pour reprendre

1. Vérifier que le déploiement de a772f4977 est READY.
2. Finir et livrer le train **5.438** (favoris débloqués) : c'est ce que Julien attend en premier.
3. Livrer `bugs-totale` (vente par e-mail), puis `style-clarte` tranche 1 après avoir regardé les captures.
4. Reprendre les agents arrêtés par la limite d'usage (leur travail est poussé ; repartir de leur branche).
5. Ne jamais dire « parfait » : dire ce qui est vérifié, ce qui ne l'est pas sans vrai compte.
