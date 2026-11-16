# 16 nov. 2026 — Satisfaction des clients (les vendeurs qui utilisent VRM)

Mission : `docs/passation/file-attente-16nov/1-satisfaction.md` (validée par Julien). Branche
`claude/satisfaction-clients`. Quatre points.

## 1. Zéro bug visible sur iPhone, en permanence — le contrôle de nuit

- **Workflow** `.github/workflows/controle-nuit-iphone.yml` : chaque nuit (1 h 37 UTC) et à la demande.
  Le build de `main` servi avec la base INVENTÉE des bancs, aucun secret, jamais la production, garde
  réseau posée. Deux jobs : **WebKit « iPhone 15 »** et **Chromium à 390 px** (`LARGEUR=390`, ajouté au
  banc). Le banc est celui du lot `stabilite-iphone` (déjà fusionné, `scripts/bancs/stabilite-iphone.cjs`) :
  tous les écrans principaux, sous-onglets, feuilles, chargement lent, clair et sombre ; S1 erreurs JS,
  S2 garde-fou, S3/S10 contraste, S4 débordement, S5 barres qui se recouvrent, S6 sous la barre du bas,
  S7 cibles recouvertes, S8 défilement bloqué, S9 longues tâches, S11 textes superposés, S12 plaques
  blanches, S13 chiffres coupés.
- Rouge ⇒ le banc sort en 1 ⇒ le job échoue ⇒ GitHub prévient. **Résumé lisible** sur la page du
  workflow : `scripts/bancs/_resume-nuit.cjs` (par moteur, chaque famille en mots simples, les écrans
  touchés ; « Pas de résultat » si le banc a planté). Captures en pièce jointe 7 jours.
- Essai local (Chromium, 2 écrans, `LARGEUR=390`) : la largeur passe à 390, le résumé sort ; WebKit ne
  se télécharge pas dans ce conteneur (il tournera en CI, comme `iphone-webkit.yml`).
- ⚠️ Le banc a des rouges connus sur `main` (longues tâches sur une machine chargée, etc.) : la première
  nuit dira la liste réelle. Le workflow ne bloque aucune PR (planifié seulement).

## 3. « Signaler un problème » avec suivi — reçu · en cours · corrigé

- Existait (15 nov.) : « Reçu · on te répond ici », la réponse et sa notification. Ajouté : un **état**
  rangé sur la ligne du signalement chez le propriétaire (`etat`, `etatLe`, `mot`), écrit par le serveur
  seul : `changerEtatSignalement` (api/_lib/signalement.js), action `etat` de `/api/compte?mode=signalement`
  (aucune fonction api/ en plus). Propriétaire seul (403 sinon), lecture ratée ⇒ rien d'écrit.
- **Notification au vendeur** au passage à « corrigé » (famille existante `signalement`, ses appareils,
  son contexte) avec le mot du propriétaire ; déjà corrigé ⇒ jamais une seconde.
- Une réponse passe le signalement « en cours » (sauf déjà corrigé). Une ligne d'avant : traité ⇒ corrigé,
  sinon reçu (`etatDe`, la même règle pour l'app et le serveur).
- Propriétaire (Paramètres → Aide → Signalements reçus) : pastille d'état, « Passer en cours »,
  « Marquer corrigé » (+ un mot facultatif), « Rouvrir ». « À traiter » = pas corrigé.
- Vendeur (Paramètres → Aide → Mes signalements) : la même pastille, « Corrigé le … · le mot ».
  Lu par le serveur filtré sur SA session : aucun vendeur ne voit l'état d'un autre.

## 4. Les 10 premières minutes — « sans abus »

- `src/mesureDemarrage.js` (une règle, app + serveur) : pour chaque étape du parcours en huit étapes
  ATTEINTE, le temps passé dans le parcours pour y arriver (arrondi à 10 s, plafonné à 1 h, repris de là
  où il en était — jamais une date). Rangé dans SA ligne `main` (`vrm_mesure_demarrage`). Rien d'autre :
  ni contenu, ni e-mail, ni pseudo, ni appareil, aucun service tiers.
- **Coupable** : Paramètres → Sécurité des données → « Mesure du démarrage » (`vrm_mesure_demarrage_coupee`,
  synchronisée) ; coupée ⇒ plus rien n'est écrit et ce qui l'était est effacé ; le serveur l'écarte aussi.
- **Regroupé côté serveur** (`api/_lib/parcours-comptes.js`, route du propriétaire déjà gardée) :
  `agregerDemarrage` rend seulement, par étape, combien l'ont atteinte et le temps médian — **rien du tout
  sous 5 vendeurs mesurés** (pas même le nombre), un temps médian seulement si 5 l'ont atteinte ;
  propriétaire et neutre écartés ; « l'étape qui perd le plus » nommée.
- Tableau chez Julien : Paramètres → Aide → Nouveaux comptes → « Les 10 premières minutes ».
- Page de confidentialité : une ligne dans le tableau « Quelles données » (quoi, seuil, comment couper).
- **Corriger l'étape qui perd le plus** : impossible aujourd'hui — en base, 0 vendeur mesuré (la mesure
  commence avec cette version). À regarder quand 5 nouveaux auront démarré.

## 6. Le récap de la semaine

- Existait : la notification du dimanche soir (19–20 h à Paris, jamais la nuit, heures calmes : cron du
  soir existant, `api/_lib/bilan-semaine.js`, `audit-bilan-semaine`) et l'écran « Ma semaine »
  (vendu, ventes, bénéfice brut, reçu, colis envoyés, qui dorment, comparaison).
- Ajouté à l'écran : **Argent à venir** (`aVenirPour` de la coque, semaine en cours seulement) et
  **Temps gagné** (la règle du calculateur `src/accueil/tempsGagne.js` sur SES ventes de la semaine,
  « estimation », « au moins » si les ventes sont partielles ou dépassent ce que la règle compte).
- **Pas fait** : l'e-mail hebdomadaire sur activation (aucune voie e-mail des relances n'est configurée :
  `RELANCES_SMTP_*` est un geste de Julien) ; argent à venir et temps gagné dans la NOTIFICATION (le
  serveur n'a pas de copie refabriquée de `argentAVenir` — à faire par `--recopie`, pas à la main).

## Preuves

- `scripts/audit-satisfaction-clients.cjs` : 43/43 ; `--prouve` : les 10 mutations rougissent
  (planning retiré, WebKit retiré, banc toujours vert, garde propriétaire, double notification, suivi sans
  état, seuil d'anonymat, interrupteur ignoré, champs en trop recopiés, borne du temps) ; sur l'arbre de
  `main` : 2/13, rouge.
- Bancs : `parcours-nouveau` partie S (vrai code serveur dans le navigateur, 390/1512, clair/sombre) :
  en cours après réponse, 403 d'un autre compte, corrigé + mot rangé, UNE notification avec le mot, pas de
  seconde, l'auteur voit « Corrigé » et le mot — vert. `signaler-etat` : « Corrigé » envoie l'action ;
  ses 16 rouges (feuille d'envoi) sont les MÊMES sur `main`. `ma-semaine` : 2–3 rouges « barres du jour à
  0 » qui changent d'une passe à l'autre (mesure prise pendant l'animation des barres ; pas touchées ici).
- Audits verts : traduction, quoi-de-neuf, signalement, parametres, ma-semaine, parcours-nouveau,
  icones, cloisonnement (action `etat` jouée par chaque compte).
- Captures regardées : Mes signalements (390 clair), Signalements reçus (390 sombre), Ma semaine (1512 sombre).

## ÉTAT À LA REPRISE

PR ouverte (voir le rapport). Restes : e-mail hebdomadaire sur activation (après SMTP), récap
notification enrichi (copie refabriquée d'`argentAVenir`), correction de l'étape qui perd le plus
(attendre 5 vendeurs mesurés), première nuit du workflow à lire (Actions → « Contrôle de nuit iPhone »).
