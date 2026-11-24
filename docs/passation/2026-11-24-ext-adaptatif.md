# 24 nov. 2026 — Extension 5.448.0 : elle s'adapte sur tous ses sites (Vinted, Leboncoin, Vestiaire, eBay)

Branche `claude/ext-adaptatif`. Capacités `adaptatif`, `adaptatiflbc`, `adaptatifvc`, `adaptatifebay`, `arretsimple` =
**5.448.0** (5.440.1 et 5.441 → 5.447 sont pris par d'autres lots). **La PR doit être fusionnée APRÈS les autres PR de
l'extension** (#1327, #1311, #1329, #1331, les lots 5.446 et 5.447) : elle remonte la version au-dessus d'elles.

Julien : « elle doit pouvoir marcher sur tous les sites, s'adapter » ; « hors de question qu'il y ait encore une erreur ».

## 1. Ce que la vraie base dit (24 nov., lecture seule, formes et compteurs seulement)

`panel_diag_capture` de Julien (5.440.0, 24 nov. 06:59) et la file des favoris :

| constat | chiffre | ce que c'est | état |
|---|---|---|---|
| `suivi_forme_inattendue_escrow` | 804 | une LECTURE (suivi d'achat) de forme inattendue | déjà « rien rangé + forme notée » (contrat de suivi) — pas un repérage de page |
| `forme_inconnue_champ_conversation` / `conversation_lecture_ou_forme_ratee` | 250 / 210 | relecture des conversations (refus de Vinted pris pour une forme, puis nouvelle messagerie uuid) | traité en 5.193 et 5.440 (`messagerieuuid`) |
| `label_url_introuvable` / `label_url_trouve` | 48 / 80 | bordereau : l'adresse du PDF pas dans la réponse | une lecture, réessayée ; hors de ce lot |
| `formulaire_selecteur_cloche`, `interface_favoriOuvrir_rien_cloche`, `formulaire_reessai_favoriOuvrir` | 18 / 5 / 10 | la cloche de Vinted introuvable (FAVORIS) | réparé en 5.440 (couche de repérage) |
| file des favoris : `element_introuvable` (cause `element_absent:cloche`) | 3 | même cause | idem |
| `releve_forme_inconnue`, `vc_format_inconnu_annonces` | 12 / 4 | lectures de forme inconnue | déjà « rien rangé + forme notée » |
| `vinted_refus_champs_size` / `_photos` / `_description` | 10 / 7 / 2 | refus de Vinted au dépôt (le SITE dit non, pas un élément introuvable) | hors de ce lot |
| `trouve_rien_*` | 0 | la 5.440 vient d'être installée | la mémoire et le journal tournent |
| Leboncoin / Vestiaire « appris » | rien en base | la signature apprise vit dans CE Chrome (`vrmLbcUi`, `vrmVcUi`), la base ne reçoit que « appris » | — |

**Conclusion** : ce qui a VRAIMENT cassé jusqu'ici, côté pages, c'est Vinted (la cloche), réparé en 5.440. Mais
l'audit du code montre que la même panne attend chaque autre geste : un sélecteur fixe ou une signature exacte, et
au premier changement du site, un arrêt (au mieux) ou le mauvais élément (au pire).

## 2. L'audit du code, site par site (avant ce lot)

| site | geste / lecture | comment il trouvait sa cible | quand la page change |
|---|---|---|---|
| Vinted | supprimer (republication) | `button[data-testid="item-delete-button"]`, puis l'appris | arrêt (« élément « supprimer » introuvable ») ou geste demandé |
| Vinted | **confirmer la suppression** | le **PREMIER** bouton de la fenêtre dont le texte CONTIENT « supprimer / confirmer / delete… » | **mauvais élément possible** (« Ne pas supprimer » contient « supprimer » ; deux boutons ⇒ le premier) — geste IRRÉVERSIBLE |
| Vinted | vendre, titre, description, prix, photos, brouillon, ajouter, enregistrer | `#title`, `#price`, `data-testid` fixes, puis l'appris | arrêt, puis « touche le bouton » |
| Vinted | message, offre, cloche | déjà sur la couche de repérage (5.440) | — |
| Vinted | geste appris (republication) | signature exacte | un attribut renommé ⇒ plus rien, re-apprendre |
| Leboncoin | message, prix, pause, suppression, réactiver | signature EXACTE de SON geste (`vrmLbcUi`) | arrêt « refais ce geste une fois à la main » |
| Vestiaire | message | signature EXACTE (`vrmVcUi`) | arrêt « envoie une réponse toi-même » |
| eBay | titre, description, prix, référence | le **PREMIER** champ dont le nom/libellé contient « titre / title… » (FR/EN) | **mauvais champ possible** (« Sous-titre » avant « Titre ») ; rien en allemand/italien/espagnol |
| tous | phrase d'arrêt Vinted | « élément « message-envoyer » introuvable ou en double » | un nom de code, aucun geste |
| tous | lectures (réponses du site) | `formeDouteuse`, `formeInconnue` (VC), contrat de suivi | déjà : rien rangé, forme notée |

## 3. Ce qui est livré

### 3.1 La couche de repérage commune pour tous les sites (`vrm-trouver.js`, v2)
- Elle tourne dans le monde de la page (Vinted) ET dans le monde isolé des scripts de contenu (Leboncoin, Vestiaire,
  eBay : ajoutée au manifeste AVANT `lbc-ecrire.js`, `vc-ecrire.js`, `ebay.js`). Elle ne lit que le DOM, ne clique rien.
- Une **table par site** (`trouver('lbc.champMessage')` ou `ctx.site`) : chaque élément a plusieurs stratégies pondérées,
  le nom accessible EXACT en 5 langues, le libellé du champ, l'indication, le contexte, des exclusions (en-tête, recherche,
  filtres « min / max », fenêtres, ce que VRM pose), un seuil, **un seul gagnant** (deux au même score ⇒ rien).
  - Vinted (+ ce lot) : `vendre`, `titre`, `description`, `prix`, `photos`, `brouillon`, `publier`, `enregistrer`,
    `supprimer`, `supprimerConfirmer` (dans la SEULE fenêtre ouverte, jamais « Annuler »).
  - Leboncoin : `champMessage`, `envoyer` (de SON formulaire), `champPrix`. Vestiaire : `champMessage`, `envoyer`.
  - eBay : `titre` (jamais « sous-titre »), `description`, `prix`, `sku`.
- **`souple(sig)`** : un geste APPRIS dont la page a changé un morceau (un data-testid, un data-qa-id renommé) est
  retrouvé par ce qui reste vrai — balise, attributs, **le mot du bouton EXIGÉ quand il en avait un** —, au moins la
  moitié des points d'origine, un seul gagnant, borné à la rangée de l'annonce pour la 1re étape.

### 3.2 Branchements
- **Vinted** (`vrm-formulaire.js`) : `attendreN` = sélecteur fixe → l'appris (exact puis souple) → la table. La
  **confirmation de suppression** n'est plus « le premier bouton qui contient supprimer » : un seul candidat par
  data-testid, sinon la table (nom EXACT, 5 langues) ; deux ⇒ `supprimer-confirmation-ambigu`, rien n'est cliqué. Le
  champ du titre / de la description / du prix passe aussi par la table.
- **Leboncoin** (`lbc-ecrire.js`) : exact → souple → table, pour le champ du message, « Envoyer », le champ du prix ;
  exact → souple pour chaque étape de pause / suppression / réactivation. « Fait » reste prouvé par la page (CETTE
  écriture vue par `lbc-inject.js`) ; le compte de la page, l'identifiant de l'annonce et de la conversation : inchangés.
- **Vestiaire** (`vc-ecrire.js`) : pareil pour le champ et le bouton.
- **eBay** (`ebay.js`) : la table d'abord ; rien au-dessus du seuil ⇒ les motifs d'avant mais **un seul candidat**.
  Un champ vu en double n'est JAMAIS rempli : le bandeau le nomme (« le prix : VRM voit deux champs pareils sur cette
  page et n'a rien mis. Remplis-le toi-même »). eBay ne publie toujours rien seul.

### 3.3 Mémoire et journal par site
- Le gagnant (sa stratégie) est rangé par site et par version de la page : `vrmTrouve` (Vinted, inchangé),
  `vrmTrouve_lbc`, `vrmTrouve_vc`, `vrmTrouve_ebay` ; une nouvelle version d'un site vide SA mémoire seulement.
- Rien trouvé ⇒ `vrmTrouverJournal` (40 au plus, avec le site, l'élément, chaque stratégie et combien de candidats elle
  a vus — jamais un texte) + compteurs `trouve_rien_<site>_<élément>`, `trouve_ambigu_…`, `trouve_<site>_<élément>_<stratégie>`
  (dans `panel_diag_capture`, lisibles d'ici : c'est la mesure de la prochaine panne).
- Les scripts de contenu envoient `trouveJournal` au fond ; le site retenu est celui de l'ONGLET (jamais celui que le
  message dit), cadre principal seulement.

### 3.4 Chaque arrêt dit quoi et LE geste (`phraseElement`)
Avant : « Vinted a changé sa page (élément « message-envoyer » introuvable ou en double) ». Maintenant, par exemple :
- « VRM ne trouve plus le bouton « Ajouter » sur la page Vinted (Vinted a changé sa page) : rien n'est parti. Geste :
  relance ; si VRM ne le retrouve toujours pas, il te demandera de toucher ce bouton UNE fois dans l'onglet de travail,
  puis il s'en souviendra. »
- « VRM voit deux boutons « Confirmer et supprimer » sur la page Vinted et ne choisit jamais à ta place : rien n'est
  parti. Geste : fais-le toi-même sur vinted.fr cette fois, et touche « Envoyer un rapport » dans la fenêtre de
  l'extension : la correction arrive avec la prochaine version. »
Les phrases de la republication et du brouillon (`PHRASE_SELECTEUR`, `PHRASE_PAS_PRETE`) portent le même geste à la fin.
Leboncoin et Vestiaire gardaient déjà des phrases simples avec leur geste (« refais ce geste une fois à la main ») : inchangées.

## 3 bis. « L'extension doit être intelligente » (demandes du coordinateur, même lot 5.448.0)

Mesuré d'abord (vraie base, lecture seule) : 22 lignes `ext_appareil_*` ; sur les 48 dernières heures, ses navigateurs
tournaient sur **5.409.0, 5.410.1, 5.410.7, 5.410.8, 5.418.0, 5.436.0, 5.438.0, 5.439.0, 5.440.0** (Chrome · Mac surtout,
un Orion · Mac en 5.409, un Chrome · Linux en 5.440). Les noms d'appareils ne sont pas rangés (`nav` · `systeme` seulement).

| demande | ce qui est livré | fonction | preuve |
|---|---|---|---|
| (1) se rattraper seule | Leboncoin : session pas dite, canal muet, conversation pas chargée, compte pas su ⇒ l'onglet de travail est **rechargé UNE fois** et le même ordre repart ; Vestiaire : la même réponse « pas prête » ⇒ 2 s puis UN nouvel essai (son onglet n'est jamais rechargé). Seulement quand la page a dit « rien n'est parti » (aucun clic, rien tapé) ; un clic final « pas vu » n'est JAMAIS rejoué. Vinted avait déjà ses nouveaux essais et sa navigation vers la bonne page (`etapeFormulaire`, `GESTES_INTERFACE`). | `repriseSeule`, `rechargerOnglet` | audit R1–R4 |
| (2) forme changée | Vinted l'avait (`formeDouteuse` : rien rangé, forme gardée, « Vinted a changé… »). Vestiaire (`inconnu`) et Leboncoin (« Mes annonces » de forme inconnue : `lbc_forme_inconnue_mes_annonces`, `vrmLbcForme`) le disent maintenant aussi : ligne de santé « X a changé … : VRM attend la correction » + une notification, une fois. | `santeSites`, `majSanteSites` | audit S5 |
| (3) reprise après interruption | **pas de nouveau code** : les mécanismes existants sont ceux qu'il faut — messages aux favoris : jeton du serveur, chaque favori une fois, attente reprise par un worker neuf (`reprendreMessagesFavoris`) ; republication : `reprendreRepub` / verrou de recréation ; Vestiaire et Leboncoin « intéressés » : `reprendreOffresAimesVc`, `reprendreInteressesLbc`. Un geste « incertain » n'est jamais rejoué (la règle `issueUiLbc`, inchangée). | — | audits existants (`audit-favoris-auto`, `audit-comme-bleam`…) verts |
| (4) santé par site | une ligne par site : « Vinted : tout marche. » / « … ne marche plus … Geste : … » (ambre) / rien si jamais vu ici ; en tête du grand panneau de la carte, et dans la carte Leboncoin ; chaque NOUVEAU problème dit une fois par une notification de l'ordinateur ; aussi dans l'état rendu à l'app (`sitesSante`). | `santeSites` | audit S1–S5, banc `sante-sites-carte` (13 verts ; rouge sur main) |
| (5) version dépassée | « Tout va bien ? » de l'app nommait DÉJÀ chaque navigateur et sa version, avec « Installer la X » (`fiab.ext.appareil`, `garde-capture.js`) — inchangé. Nouveau côté extension : `vrm.center/extension-version.json` porte `regles` (geste → version où sa règle a changé ; aujourd'hui `vinted:supprimer` → 5.448.0). Une extension ≥ 5.448 devenue dépassée **lit toujours** mais ne fait pas un geste dont la règle a changé : rien ne part, la phrase dit sa version, celle à installer et LE geste. La carte disait déjà « Version X disponible · Mettre à jour » (`majHtml`). ⚠️ Les versions d'AVANT la 5.448 ne lisent pas `regles` : elles ne se protègent pas (impossible sans les mettre à jour). | `regleDepassee` | audit V0–V4 |
| (6) contrôle au démarrage | 20 s après le démarrage ou une mise à jour : chaque onglet Vinted / Leboncoin / Vestiaire / eBay est sondé (DOM du monde isolé, aucune requête) ; scripts de VRM absents ⇒ rechargé UNE fois s'il est en fond et n'est pas un formulaire ou une messagerie ; sinon « recharge cet onglet » (ligne de santé + notification). | `autoControleOnglets` | audit A1–A4 |
| (7) rapport | « Envoyer un rapport » porte le journal de repérage (40) et les 20 derniers arrêts (site, geste, code) — étiquettes seulement (`etiquetteRapport`), jamais un texte de page ni un pseudo ; le serveur (`api/_lib/rapport-extension.js`) les garde par la même liste blanche. | `noterArret` | audit T |

## 4. Ce qui n'a PAS changé (§3)
Compte de l'onglet, 50 actions/h avec réserve 5, 15/h favoris, une action à la fois, pause 429/403, arrêt sur une
vérification visible, `vintedPage` GET seulement (aucune écriture fabriquée par VRM). **Refusé et pas fait** : vrais clics
par `chrome.debugger`, rythme « humain » pour paraître humain, pilotage clavier/souris. Un geste jamais appris sur
Leboncoin / Vestiaire (« pas-appris ») le reste : la toute première fois, Julien le fait à la main (décision du 21 nov.).

## 5. Preuves
- `scripts/bancs/ext-adaptatif.cjs` — **29 verts** : Vinted V1–V5, Leboncoin L1–L7, Vestiaire C1–C3, eBay E1–E4. Sur
  l'extension d'origin/main : **4 bons, 24 défauts** (dont V3 : la suppression part sur le PREMIER bouton d'une fenêtre
  ambiguë). `--prouve` : 6 mutations, 6 rouges. Captures regardées (V3, L5, E3).
- `scripts/audit-ext-adaptatif.cjs` — VRAI `background.js` (`_fond-vm.cjs`) : **48 verts** (manifeste, phrases, mémoire et
  journal par site, santé S1–S5, rapport T, version dépassée V0–V4, contrôle des onglets A1–A4, champs `ext_appareil` X,
  reprise R1–R4, garde-fous G1) ; sur le background d'origin/main : rouge (lève) ; `--prouve` : 17 mutations, 17 rouges.
- `scripts/bancs/sante-sites-carte.cjs` — **13 verts** (390 / 1512, clair / sombre ; « tout marche » sans couleur, le
  problème et son geste en ambre) ; rouge sur origin/main (5 / 8) ; captures regardées.
- Voisins verts : audit-coherence, audit-extension-zip, audit-ext-boutique, audit-quoi-de-neuf, audit-lbc-interface,
  audit-ext-cloche-favoris, audit-ext-arrets-formulaire, audit-comme-bleam, audit-tout-interface, audit-vc-ecrire,
  audit-lbc-supprimer, audit-lbc-plus-vue-pause, audit-familles-extension, audit-formulaire-rythme, audit-garde-prix,
  audit-ext-contrat-messages, audit-couleur-panneau, audit-extension-feuille, audit-confiance, audit-cloisonnement,
  audit-offres-auto, audit-vc-messages ; banc cloche-favoris ; `npm run build`.
- Champs publiés dans `ext_appareil_*` pour l'app (codes seulement) : `sante` { site: { k, nom } }, `arret` { site, geste,
  code, at }, `servie`, `depassee`.

## 6. À essayer par Julien (le banc ne remplace pas le vrai site)
Voir le rapport de fin de lot (liste des gestes, site par site). En bref : republier une annonce Vinted (suppression +
mise en ligne), répondre et baisser un prix sur Leboncoin, répondre sur Vestiaire, « Préparer sur eBay ». Si un arrêt
apparaît : lire la phrase (elle dit le geste), puis « Envoyer un rapport » — le journal dit quelle stratégie a vu quoi.
