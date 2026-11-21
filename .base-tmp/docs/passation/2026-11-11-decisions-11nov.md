# 11 nov. 2026 — Les petites décisions tranchées (lot `decisions-11nov`, C4 à C11)

Branche `claude/decisions-11nov` (depuis `origin/main` 3c9f7148, `origin/main` refusionnée par un vrai
merge). Julien : « tranche le reste toi-même ». Les questions C4–C11 de
`2026-11-10-passation-finale.md` (partie C) sont tranchées ici, dans l'esprit de sa demande et de son
principe du 11 nov. (« plus beau, plus simple, surtout PRATIQUE : gagner du temps »).
Non touchés (autres lots) : colis, « Je dépose », « Retiré » (C2/C3), stock, configuration, profil,
offres/republier, facture SIRET.

## Ce qui est tranché, et comment

| | décision | où | gestes avant → après |
|---|---|---|---|
| **C4** Factures au téléphone | La ligne du titre gardait 5 boutons tassés. Au téléphone : le geste principal (« + Nouvelle facture », le seul primaire de l'écran) + « … » (44 px) ; « … » ouvre une feuille en PORTAIL (`SheetShell`) : Relire, Exporter Excel, Ma facture, Réglages des factures (lignes de 48 px). Ordinateur : inchangé. ⚠️ Le brief parlait de « Envoyer/Télécharger selon l'état » : ces gestes-là sont dans la feuille d'une facture (3 boutons, déjà sobre), pas dans les 5 ; les 5 sont ceux de la ligne du titre (`src/ecrans/Compta.jsx`, `Invoices`). | `Compta.jsx`, `styles-argent.css` | geste principal : 1 → 1 ; ligne du titre : 5 cibles → 2 ; gestes rares : 1 → 2 (choix assumé : ils sont rares) |
| **C5** Comparer deux mois | Les **PAIRES** achetées, le nombre d'achats en petit dessous (« 2 achats »). Règle : un achat en gros = SES paires (saisies) ; hors plateforme = 1 ; Vinted = la règle des lots de l'écran Achats (`estLot`/`nombreLot` : titre « Lot 3 … », `items_count` de SA transaction — lu en projection pour les achats des deux mois —, lot déclaré). Un lot sans nombre écrit ⇒ compté 1, « au moins », nommé (« 1 lot sans nombre »), aucune flèche. Ligne `paires` (libellé « Paires » : « Paires achetées » était coupé à 390 px, vu en capture). | `src/comparerMois.js` (`pairesDeLigne`, `pairesEntre`), `ecrans/Stats.jsx` | aucun geste ; un chiffre juste |
| **C6** Revendu combien ? | Le prix médian UNE fois : replié, la phrase le dit ; déplié, la case « Prix de vente » le dit et la phrase devient « Tes ventes de ce modèle ». | `src/ReventeModele.jsx` | — ; un nombre en moins |
| **C7** Livre de police | VÉRIFIÉ : aucune saisie d'identité dans VRM (aucun champ, rien d'identité écrit dans `vrm_livre_police`) ; l'export porte la colonne « Identité du vendeur » à remplir. Ajouté : une phrase à l'écran, sous les exports : « L'identité des vendeurs se remplit sur l'export, pas dans VRM. » (la fin redondante du « Pourquoi ? » retirée). | `src/LivrePoliceCarte.jsx` | — |
| **C8** Heure du résumé du soir | Défaut INCHANGÉ (cron Vercel 18:00 UTC : 19 h l'hiver, 20 h l'été). Réglable dans Paramètres → Notifications : « Résumé du soir » 18–22 h (heure de Paris), rangé dans `push_prefs.soirHeure` (⚠️ pas `soir` : c'est l'ancienne catégorie on/off, encore lue). Serveur : `soirALHeure` (`api/_lib/notif-textes.js`) ; le cron d'avant attend SON heure ; un passage horaire `?moment=soir&passage=heure` (GitHub, `.github/workflows/resume-soir-heure.yml`, 16–21 h UTC) sert les vendeurs qui ont choisi une heure, le résumé seul (ni sondes, ni eBay relu, ni bilan), avec SON curseur par heure (`soir-h17`…) ; mémo du jour ⇒ une fois par soir. Une heure dans ses heures calmes (22 h par défaut) est DITE en une phrase. | `notif-textes.js`, `ship-reminders.js`, `ecrans/Reglages.jsx`, workflow | régler : 2 gestes (ouvrir Notifications, choisir) — nouveau |
| **C9** Messages | « Tous » par défaut ; SON dernier choix retenu (`vrm_filtre_site`, clé `messages:choix`, écrite par SON toucher sur la rangée des sites seulement — jamais par un lien ni par le défaut). L'ancienne valeur (posée à chaque visite : « vinted » chez tous) n'est plus lue. Aucun lien cassé : les notifications portent `site=vinted`, « Conversation » d'un récap et « Favoris » passent par `cat_msg` (⇒ Messages · Vinted). | `src/navigationTache.js`, `App.jsx` | voir « Tous » : 1 toucher à chaque visite → 0 ; rester sur Vinted : 1 toucher une fois, puis 0 |
| **C10** Outils | L'ancien bloc « Annonces à compléter » (Outils, règle `bilanAnnonce`) est FONDU dans la vue d'Annonces « À compléter » : sa règle reçoit titre vide, prix absent et description lue vide (un champ pas lu ne dit rien) ; son geste (brouillon VRM, l'atelier `AtelierBrouillon`) devient « Brouillon » sur ces lignes. Dans Outils, une ligne « À compléter · N » (44 px) ouvre la vue. `bilanAnnonce` et l'ancien composant retirés (un seul endroit, une règle). | `annoncesACompleter.js`, `AnnoncesACompleter.jsx`, `App.jsx`, `OutilsArticlesVinted.jsx` | Outils → bloc → filtre → Compléter (3–4) → Outils → À compléter (2), ou le bouton de la vue (1) |
| **C11** Marge par plateforme | Un site qu'il n'utilise pas est caché : aucune vente du site (toutes dates, la règle de « Vendu », montants pas lus compris) ET aucune annonce ni vente rangée pour lui (lignes `lbc_*`, `ebay_*`, `vc_*`, premier élément seulement, jamais `select=data`). « Pas su » ⇒ montré : lecture en cours ou ratée, site manquant. Vinted toujours montré. | `margePlateforme.js` (`sitesMontres`), `MargePlateforme.jsx`, `Stats.jsx` | — ; une à trois lignes vides en moins |

## Preuves

| contrôle | résultat |
|---|---|
| `npm run build` | vert (après le merge aussi) |
| audits `variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets` | verts |
| `audit-mois-boucle` (C5 : lot, items_count, gros, lot sans nombre) | **53 verts** ; `--prouve` **15/15** (dont `paires-achats`, `lot-sans-nombre-tu`) ; sur l'arbre d'`origin/main` : rouge |
| `audit-livre-police` (P10, C7) | **34 verts** ; `--prouve` **15/15** (dont `saisie-identite`, `phrase-tue`) ; sur `origin/main` : 1 rouge |
| `audit-annonces-a-completer`, `comparer-mois`, `revente-modele`, `marge-plateforme`, `onglets-a/d`, `notifs-belles`, `cibles-notif`, `suivi-colis`, `colis-heure`, `urssaf`, `argent` | verts |
| `scripts/tests/outils-articles-vinted-interface.cjs` (ancien bloc retiré du test) | 24 verts |
| banc `rappel-soir` (route RÉELLE ; C8 : 22 h choisie, 18 h choisie, défaut, catégorie coupée, workflow) | **39/0** ; sur `origin/main` : **5 rouges** |
| banc `factures-pro-2` (C4, 390/1512 clair/sombre) | **102/0** ; sur le build d'`origin/main` : **4 rouges** |
| banc `mois-boucle` (C5) | **202/0** |
| banc `revente-modele` (C6) | **30/0** ; sur le build d'`origin/main` : **4 rouges** |
| banc `livre-police` (C7) | **65/0** |
| banc `centre-notifs` (C8, réglage) | **116/0** |
| banc `fil-unique` (C9) | tout vert ; sur le build d'`origin/main` : **2 rouges** (C9) |
| banc `annonces-avis` (C10) | **84/0** |
| banc `marge-plateforme` (C11 + « pas su » ⇒ tout montré) | **56/0** ; sur le build d'`origin/main` : 1 rouge |

Captures regardées (390 et 1512) : feuille « Factures » (portail, 4 lignes), ligne du titre à 1512
(5 boutons), Comparer (libellé « Paires … » coupé ⇒ corrigé en « Paires »), feuille « Revendu combien ? »,
livre de police (phrase), Résumé du soir (22 h + phrase des heures calmes), Outils (« À compléter 4 »),
Marge par plateforme (Vinted + Vestiaire).
Bancs retouchés pour la règle neuve : `argent-mois` (ligne `paires`), `mode-stream` (`site=vinted` :
il visait la page des conversations Vinted).

## Ce qui reste
- C8 : une heure choisie AU-DELÀ de 20 h (été) / 19 h (hiver) n'arrive que par le passage GitHub ; sans
  `CRON_SECRET` dans GitHub, elle ne part pas (le journal du workflow le dit). 18 h choisie sans GitHub :
  part au cron de Vercel (une heure plus tard).
- C10 : la description n'est un manque que LUE vide ; non lue, rien n'est dit (pas de ligne « pas lue » :
  elle n'est presque jamais dans la moisson actuelle).
- C5 : `items_count` lu seulement pour les achats des deux mois choisis ; sans détail de transaction, un
  lot sans « Lot » dans le titre ni déclaration compte 1 (la règle de l'écran Achats).

## Geste de Julien
`CRON_SECRET` dans les secrets GitHub (déjà demandé pour colis-frais et factures) — seulement s'il
choisit une heure du résumé autre que le défaut.
