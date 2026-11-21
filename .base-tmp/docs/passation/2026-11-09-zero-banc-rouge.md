# 9 nov. — Zéro banc rouge

Branche `claude/zero-banc-rouge` (depuis `origin/main`, refusionnée avec `main` le 9 au soir par un
vrai `git merge`). Demande de Julien : « je veux que tout soit parfait ». Méthode : celle de
`2026-11-08-zero-audit-rouge.md` — pour chaque rouge, la cause, puis (1) vrai défaut ⇒ l'app,
(2) banc périmé (décision écrite de Julien) ⇒ le banc à la règle ACTUELLE, prouvé par mutation,
(3) banc fragile ⇒ déterministe (condition, horloge, faux serveur complet). Aucun contrôle retiré,
aucun seuil élargi, aucun `skip`. Deux sessions ont travaillé sur la branche (partie A et partie B).

## Tableau

| banc | rouges avant | cause | correction | après |
|---|---|---|---|---|
| `iphone-reprise` | 5 | périmé : le groupe « Plateformes » a été retiré de la colonne le 8 nov. (`2026-11-08-navigation-plateformes.md`), et le texte était lu en capitales | groupes lus sur `data-nav-groupe` ; Vendre · Gérer · Argent · Moi exigés, titres des 3 premiers visibles, « Plateformes » interdit. Mutation (Gérer → Plateformes dans le build) ⇒ 5 rouges | 139/139 |
| `colis-fiables` | 58 | **vrai défaut** + périmé + fragile (voir plus bas) | `fusion.css` ; banc déplie les lignes ; règles du 3, 4, 5 et 6 nov. ; lecture lente TENUE | 118/118 |
| `colis-tous-sites` | 12 | périmé : sans `SUPABASE_SERVICE_KEY` les routes répondent 503 depuis le 7 nov. (`api/_lib/cle-service.js`) ; le banc supprimait la clé | clé FICTIVE (le faux fetch ne la lit pas ; vendeurs non-UUID ⇒ accès « pas su ») ; le 503 sans clé reste tenu par `audit-cle-service` | 12/12 |
| `rappel-soir` | 9 | idem | idem | 17/17 |
| `bilan-semaine` | 21 | idem + `notif-belle` (8 nov.) remplace l'espace fine de `toLocaleString` par une espace | clé fictive ; montants comparés sans le caractère d'espacement (le nombre jugé) | 27/27 |
| `badge` | 2 (selon la charge) | fragile : états datés au chargement du banc, « il y a 3 min » devenait « 5 min » | chaque état fabriqué au moment où le test le prend (accesseur). Preuve : 65 s d'attente au départ ⇒ avant 2 rouges, après 126/126 | 126/126 |
| `colis-colonnes` | 2 | fragile/périmé : la barre du délai (8 nov., `2026-11-08-retirer-carte-delai.md`) n'est ambre que dans les dernières 24 h ; le point « au dernier jour » avait une limite à DEMAIN (ambre seulement le soir) | limite à aujourd'hui (le dernier jour, ce que le contrôle nomme) | vert |
| `ventes-colis-premium` | 4 | **vrai défaut** + banc qui mesurait une fiction | `styles-premium.css` ; le banc mesure le montant AFFICHÉ | 33/33 |
| `achats-messages-premium` | 2 | fragile : faux serveur incomplet (ni `id=in.(…)`, ni la colonne `meta`, ni les filtres `data->>`) — le colis Chronopost de l'e-mail n'existait pas | faux serveur à la vraie forme (migration 004, `_minipgrest.test`) ; contrôle inchangé | 62/62 |
| `csp` | 2 | périmé : depuis la ligne par colis (4 nov.) le QR n'est dessiné qu'à l'ouverture de la ligne | le banc ouvre la ligne (Colis → À retirer), attend la requête, revient. Mutation (`qrEnHttps` neutralisé) ⇒ 2 rouges | vert |
| `chiffres-coherents` | 2 (widget 503) | déjà réglé sur `main` (clé fictive posée) | — | 26/26 |
| `annonces-coherence` | 4–8 | partie B (ee1dc5fb) : attend l'écran OUVERT ; « Prix d'achat N/M » dans le bandeau OU le prochain geste (6 nov.) | — | vert |
| `outils-stats` | 2 | partie B (3721aaf9) : **vrai défaut** — « Préparer sur eBay… » proposé pour un site masqué ; seuls les sites affichés | — | vert |
| `stats-vitrine`, `emails-stats-clairs` | 6 + 4 | partie B (c4e15611) : montants sans centimes inutiles (5 nov.), 5 chiffres en tête (7 nov.), « Comparer » (6 nov.) | — | vert |
| `reglages` | 6 | partie B (102c63f0) : notifications par famille, adresses sur E-mails | — | vert |
| `reglages-premium` | 4 | partie B (9cf9ab69) : vendeuse installée, forme réelle de `api/compte.js`, plus de délai fixe | — | vert |
| `chargement` | CLS ponctuels | partie B (48bb6160) : **vrai défaut** — le filtre des sites s'affichait avant que les plateformes soient sues, puis disparaissait (décalage 0,011) | — | 6/6 |
| `fiche-paire` | 2 | partie B (76dec571) : **vrai défaut** — paire partie dont la case a été libérée dite « pas rangée » | — | vert |
| `suivi-colis` | 1 | partie B (967341e2) : la panne de `panel_colis_relais` servie aussi sur `id=in.(…)` | — | vert |
| `lbc-supprimer` | 5 | partie B (4ecd1c23) : rangée défilante des filtres, Ma journée v2 | — | vert |
| `glisser-onglet` | 3–4 | partie B, après la fusion de `main` (#1069–#1078) : périmé — `?tab=plat_ebay` revenait sur « Ventes · toutes » car le vendeur du banc (base vide) n'AFFICHE pas eBay (« Mes plateformes », 8 nov. : un site masqué ramène sur un site affiché) | `main` servi avec les 4 sites affichés ; rouge sans | vert |
| `messages-volets` | 1 | partie B : périmé — l'en-tête d'offre est `ResumeOffre` depuis le 8 nov. (« Clarifier les offres ») : Prix affiché · Offre reçue · Ton minimum + repère | lu par `data-offre-prix` (recue 100 €, mini 105 €), `data-offre-niveau="sous-minimum"` et « 5 € sous ton minimum ». Mutation (offre et minimum inversés) ⇒ rouge | vert |

## Les vrais défauts corrigés dans l'app (partie A)

1. **Colis : la note « N colis sont arrivés sur une adresse reliée à aucun compte » et son geste
   « Paramètres → Comptes liés » étaient CACHÉS** (`src/design/fusion.css`, 2 nov. : toutes les
   `.vrm-colis-note` retirées comme « textes explicatifs »). Celle-ci porte un geste (§2.7) : elle
   reste (`:not([data-pickup-sans-compte])`). Rouge avant (3 contrôles), vert après.
2. **Colis au téléphone : la limite d'envoi (« 5 j pour l'envoyer · attend depuis 2 j ») était
   invisible** (largeur 0) quand la maquette cache le bloc « N° en attente » : la ligne, en
   `flex: 1 1 0`, se logeait au bout de la ligne du titre. `src/styles-premium.css` : au moins 40 %,
   sinon elle passe à la ligne ; plus de « · » orphelin. Rouge avant (6 éléments à 282–516 px sur
   390), vert après, capture regardée.

## colis-fiables en détail (58 → 0)
- La ligne par colis (4 nov.) replie le détail derrière « ⌄ » et « À vérifier » dans un `<details>` :
  le banc déplie tout puis lit (attente que chaque ligne montre son détail).
- Date limite non lue : ESTIMÉE par la garde du transporteur (6 nov., §5 Retrait), dite « estimé »,
  vers le 26/10 — jamais « non indiquée dans l'e-mail ».
- La fraîcheur se dit par la puce « N comptes à relire » (3 nov.) ; la base du banc sert la vraie
  forme (ventes et achats d'un compte relus à la même visite).
- « N ont encore leur code » n'existe plus : chaque ligne « à vérifier » qui a son code le MONTRE
  (jugé ligne par ligne, 4 lignes, e-mails ET Vinted).
- Ma journée (E1, 5 nov.) : une case pas lue n'est pas une case ; la ligne nomme « À retirer : pas
  lu ». La lecture lente des e-mails de suivi est TENUE par le faux serveur (§6.5) au lieu de 6 s.
- Mutations : puce « comptes à relire » renommée ⇒ 5 rouges ; estimation faussée ⇒ 3 rouges.

## À regarder (pas corrigé ici, zones d'autres sessions)
- **Colis à 1512 px** : les pilules « Poser le N° » / « Relier » chevauchent le filet entre deux
  rangées (capture `ventes-colis-premium`, `colis-1512.png`) — restyle des écrans.
- **Ma journée, « pas lu »** : la ligne dit « à retirer : pas lu » mais plus POURQUOI (« E-mails de
  suivi pas lus — ouvre Colis pour réessayer », `titrePasSu`) depuis E1 ; la raison et « Réessayer »
  restent dans Colis.
- **Fraîcheur des achats seuls** : la puce de Colis se calcule sur les lectures des VENTES
  (`liveStats.dataAge*`) ; un compte dont seuls les achats seraient vieux ne serait pas nommé.
  Sans effet tant que l'extension relit ventes et achats ensemble.
- **`chargement` sur une machine chargée** : lancé en même temps que des audits, 1 rouge
  (390 · 4G · Ventes, CLS 0,079 : la ligne « Vinted : lecture en cours… » qui part à la fin de
  la lecture, contenu à 16,5 s) ; relancé SEUL après la fusion de `main` : tout vert. Un banc
  de vitesse ne se juge que seul.

## Vérifications
`npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `statuts` relancés
après le dernier commit (voir le rapport de la session). `git grep` des marqueurs de conflit : vide.

## Repasse après la fusion de `main` (#1069–#1078, 9 nov. au soir, partie B)
Relancés UN PAR UN sur ce `main` : `annonces-coherence` 130, `outils-stats` 74, `emails-stats-clairs` 53,
`stats-vitrine` 112, `reglages`, `reglages-premium` 264, `chiffres-coherents` 26, `lbc-supprimer`,
`fiche-paire`, `suivi-colis`, `csp`, `iphone-reprise` 139, `colis-fiables`, `colis-tous-sites` 12,
`rappel-soir` 17, `bilan-semaine` 27, `badge` 126, `colis-colonnes`, `ventes-colis-premium` 32,
`achats-messages-premium` 62, `glisser-onglet`, `messages-volets` : tous verts. À regarder par Julien :
la tuile Vendu dit « +213 % », la carte Comparer « +212,5 % » pour le même écart (deux arrondis).
