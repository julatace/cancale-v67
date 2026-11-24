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

## 4. Ce qui n'a PAS changé (§3)
Compte de l'onglet, 50 actions/h avec réserve 5, 15/h favoris, une action à la fois, pause 429/403, arrêt sur une
vérification visible, `vintedPage` GET seulement (aucune écriture fabriquée par VRM). **Refusé et pas fait** : vrais clics
par `chrome.debugger`, rythme « humain » pour paraître humain, pilotage clavier/souris. Un geste jamais appris sur
Leboncoin / Vestiaire (« pas-appris ») le reste : la toute première fois, Julien le fait à la main (décision du 21 nov.).

## 5. Preuves
- `scripts/bancs/ext-adaptatif.cjs` — 28 verts : Vinted V1–V5, Leboncoin L1–L6, Vestiaire C1–C3, eBay E1–E4 (bonne
  cible trouvée sur 2–3 variantes plausibles, page ambiguë ⇒ rien cliqué / rien rempli, page vide ⇒ journal, message).
  **Rouge sur origin/main** (voir la PR) ; `--prouve` : 6 mutations, 6 rouges. Captures regardées (V3, L5, E3…).
- `scripts/audit-ext-adaptatif.cjs` — VRAI `background.js` (`_fond-vm.cjs`) : manifeste, phrases (quoi + geste,
  jamais un nom de code), mémoire et journal par site, garde-fous §3 ; `--prouve` 7/7 rouges.
- Audits voisins relancés : `audit-ext-cloche-favoris`, `audit-lbc-interface`, `audit-coherence`, `audit-extension-zip`,
  `audit-quoi-de-neuf`, banc `cloche-favoris`, `npm run build`.

## 6. À essayer par Julien (le banc ne remplace pas le vrai site)
Voir le rapport de fin de lot (liste des gestes, site par site). En bref : republier une annonce Vinted (suppression +
mise en ligne), répondre et baisser un prix sur Leboncoin, répondre sur Vestiaire, « Préparer sur eBay ». Si un arrêt
apparaît : lire la phrase (elle dit le geste), puis « Envoyer un rapport » — le journal dit quelle stratégie a vu quoi.
