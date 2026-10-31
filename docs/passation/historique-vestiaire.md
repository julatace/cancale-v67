# Historique — vestiaire

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> **28-29 octobre (nuit) — VESTIAIRE : étiquette en 2ᵉ, Taille/État/Prix remplis, description sans doublon (5.269-5.270) :**
> MESURÉ (`panel_vc_form`, 28 oct. 23 h 06, 5.268) : après les photos, l'écran « Détails » est une liste de LIGNES-BOUTONS
> (« Marque Nike », « Taille Ajouter », « État Ajouter », « Prix Ajouter », « Votre adresse Ajouter »…), chacune ouvre une
> fiche (« Retourner en arrière »). `vc-depot.js` (`remplirFiches`) ouvre Taille, État, Prix une fois par paire et par onglet,
> ne clique que l'option au texte EXACT (taille « 40 » = « 40 », « EU 40 », « FR 40 » ; état mot pour mot), tape le prix
> dans le seul champ de la fiche, puis « Enregistrer/Valider » ; rien d'exact ⇒ fiche refermée et DIT. `obligatoiresVides`
> compte toute ligne « Ajouter » (Catégorie, Modèle, Taille, État, Prix, Votre adresse) : « Mettre en vente » n'est jamais
> cliqué avant (le prix se relit sur la ligne « Prix 99,00 € »). ⚠️ La forme des fiches n'a jamais été vue : écrite sur
> l'écran mesuré, à confirmer à son prochain essai (`rapporterEtape` relève chaque fiche ouverte). Étiquette : Vestiaire
> veut la photo de l'étiquette en 2ᵉ ; Julien la CHOISIT dans VRM → Vestiaire (`vrm_vc_etiquettes[id]` = `clePhotoLbc`,
> synchronisé, clé à part — jamais un champ de la fiche N°), `ordrePhotosVestiaire` la met en 2ᵉ ; jamais devinée.
> Description (`descriptionLbcDe`, app = extension) : une caractéristique que le texte Vinted dit déjà n'est plus répétée,
> « Envoi rapide » non plus s'il parle d'envoi, la lettre de Republier retirée. Preuves : `audit-vc-publier.cjs` (110,
> section smart listing) ; banc `vc-publier.cjs` (étiquette).

> **28 octobre (nuit, fin) — VESTIAIRE : on ouvre le FORMULAIRE, pas l'accueil (5.268) :** Julien : « ça m'amène
> juste sur Vestiaire, sur Vendre un article, et ça ne fait rien après ». Cause : `VC_PAGE_VENDRE` ouvrait
> `/sell-clothes-online/` (page d'accueil, aucun champ) ; à 22:50, `vc_recon` le voit passer, `panel_vc_form` rien.
> Le formulaire est le smart listing `/smart-listing/` (MESURÉ : `vc_recon.pages`, `panel_vc_form` du 28 à 13 h 37).
> On l'ouvre directement ; et `vc-depot.js`, sur une page « vendre » sans formulaire avec une paire en cours, y va UNE
> fois par paire et par onglet (`vrmVcVersSmart:{id}`, pas de boucle). Preuve : `audit-vc-publier.cjs` (94 ; rouge sur
> la 5.267). ⚠️ Toujours non mesuré : les écrans du smart listing après les photos.

> **28 octobre (nuit, fin) — VESTIAIRE bloqué faute de clé Photoroom (5.267) :** Julien : « ça ne veut pas faire de smart
> listing ni de Photoroom ». Mesuré : aucune clé Photoroom (ni `PHOTOROOM_API_KEY` sur Vercel, ni `vrm_photoroom_cle`), 24
> `detourage_no_key` ; or `vc-depot.js` n'attache QUE des photos détourées (sa règle du 27 oct.) ⇒ 0 photo, et le smart
> listing (photos d'abord) ne démarrait jamais. Le bandeau dit la raison en français et propose, sur SON clic, « Attacher mes
> photos sans détourage » (WebP converti en JPEG) ; la publication ne les bloque plus ensuite. Geste : coller sa clé Photoroom
> dans VRM → Vestiaire (son compte paie). Preuve : `audit-vc-publier.cjs` (+3). ⚠️ Non mesuré : les écrans du smart listing
> après les photos (`panel_vc_form` n'en a jamais vu).

> **28 octobre — le tour de l'espace Vestiaire sur ses vraies données :** Julien : « fais pareil pour
> Vestiaire ». Mesuré (lecture seule) : `vc_listings` vide (jamais lue : `product-listings` et
> `awaiting-shipping-items` vus le 26 oct., VIDES, avant la 5.236/5.237 ; aucun `vc_ventes`, aucun `vc_achats`),
> `vc_messages` 0 non lu (relevé du jour), un brouillon smart listing du 27 relié au N°94 (`liens`, id de
> BROUILLON — sans effet, rien de publié). Rendu 390/1512 : corrigé la phrase du bas « tes ventes ne remontent
> pas encore… choisis-la ci-dessous » (fausse depuis la 5.237, la liste est AU-DESSUS, redite des cartes, §7) ;
> « VRM apprend à lire Vestiaire · 5 pages, 26 appels, 20 formes de réponse » ⇒ « Dernier passage de
> l'extension sur Vestiaire : il y a … » (§2.7, chiffres en `data-vc-mesure-*`) ; « Où trouver ma clé
> Photoroom » à 44 px. Preuve : `vestiaire.cjs` (4 rouges sur l'avant). Geste : ouvrir « Mes articles »,
> « Mes ventes » et « Mes commandes » sur Vestiaire une fois avec l'extension à jour.

> **27 octobre (soir) — les VENTES Vestiaire captées (5.237) :** Julien : « fais pareil pour capter les
> ventes Vestiaire ». `vc-inject.js` `noteVentes` lit ce que la page charge déjà : `users/me/awaiting-
> shipping-items` (à expédier, vue chez lui, vide le 26) et une liste de ventes reconnue à son chemin
> (`users/me/…sales|sold|transactions`, `/sales` — JAMAIS VUE) ; jamais panier ni achats. Par vente : id,
> article, réf `VRM-{n°}`, un état court, une date, un montant AVEC le nom de sa clé — rien de l'acheteur
> (`PAS_ACHETEUR`). `rangerVcVentes` → `vc_ventes` (une écriture à la fois, lecture ratée ⇒ rien ; « à
> expédier » lue EN ENTIER fait foi, une vente n'est jamais effacée). App `VentesVestiaire` : N° par
> identité seulement (réf ou `vc_listings.liens`), « à expédier », « encore en ligne sur Vinted — retire-la ».
> ⚠️ Le montant n'entre dans AUCUN total (prix ou versement : pas su) et la place du Stock ne se libère pas
> encore (état « expédiée » jamais vu). `audit-vc-publier.cjs` 58 (mutations « page partielle retire » et
> « montant sans sa clé » ⇒ rouges).

> **27 octobre — Vestiaire 5.241, colis et « partout »** (5.240 était déjà prise par l'atelier de republication : deux contenus, deux numéros) **:** les ventes à
> expédier portent la date limite, le transporteur, le n° de suivi et « bordereau
> disponible » (true/false/null, JAMAIS son adresse). Une règle
> (`lireVestiaireColis` + `colisVestiaire`, une requête `id=in.(vc_…)` dans la
> vague eBay) pour Colis (« Ventes Vestiaire à envoyer », « Achats Vestiaire en
> route » + Suivre) et Ma journée (`vestiaire-envoyer`, ambre si limite ≤ demain ;
> `vestiaire-messages`). Pas su ⇒ Colis le dit une fois, Ma journée se tait.
> Pas encore : CA/URSSAF (montant = prix ou versé ? inconnu), Stock libéré
> (« expédiée » jamais vu). Banc `vestiaire-colis.cjs` (16 rouges sur main, mutation 6).

> **27 octobre — Vestiaire 5.239, achats :** l'extension lit la liste de tes
> achats (`users/me/…orders|purchases|bought…`, jamais vue d'ici : reconnue au
> chemin ; jamais le panier `orders/current-light`) dans `vc_achats` : id,
> article, NOM de l'article (affichage seul, jamais un rapprochement), état,
> date, montant avec sa clé, n° de suivi + transporteur. Jamais le vendeur, ton
> adresse, ton email ni ta carte. Le montant n'entre dans aucun prix d'achat
> (§2.5). Carte « Tes achats Vestiaire » + « Suivre ↗ ». Preuves :
> `audit-vc-publier.cjs` (80, 3 mutations rouges), banc `vestiaire.cjs` (5 rouges sur main).

> 🔴🔴 **PASSATION DU 30 OCTOBRE — LIS D'ABORD `docs/passation/2026-10-30.md`** : sept branches v29-* construites
> et relues mais PAS en ligne (leur contenu est dans `docs/passation/branches-2026-10-30.bundle`), l'ordre de
> mise en ligne (une seule intégration, un seul numéro d'extension), la refonte des boutons en cours, Vestiaire.

### Vestiaire Collective : mesurer la forme AVANT de capter (4 octobre, 5.154)
Julien : « commence à faire Vestiaire Collective bien ». **Mesuré d'abord** :
**zéro ligne `vc_*`** en base, et le site me renvoie **403** — je ne connais ni
ses adresses d'API ni la forme de ses pages. Écrire un analyseur de ventes
aujourd'hui, ce serait deviner (§4.10, §6.3) et ranger des chiffres faux dans
sa comptabilité. ⇒ Même méthode que Leboncoin et eBay : **on fait mesurer le
site par SON navigateur**.
- `vc-inject.js` (monde MAIN) enveloppe fetch/XHR et ne regarde que ce que la
  page charge **déjà** — aucune requête de plus, aucun clic (§3). Il relève :
  les **chemins** d'API (méthode + chemin normalisé + code + type), la
  **structure** des réponses JSON (chemin de clé + TYPE de feuille), les
  **familles** de pages, et les **hôtes** tiers (le nom seul, compté).
- ⚠️⚠️ **JAMAIS UNE VALEUR** : ses pages vendeur portent nom, adresse, IBAN,
  téléphone, messages. Les identifiants (nombres ≥ 3 chiffres, UUID, longues
  suites hexadécimales) deviennent `{id}`/`{uuid}`, y compris quand ils sont une
  CLÉ d'objet (une carte indexée par email ou par produit) ; un segment de
  chemin qui n'a pas la forme d'un mot devient `{x}`. `vc.js` relaie (source =
  cette page, notre étiquette, et c'est NOUS qui posons l'origine et l'action) ;
  le fond (`storeVcRecon`) range `vc_recon` en lire-fusionner-réécrire gardé
  contre la lecture ratée, et **n'écrit rien quand rien n'est neuf** (mémo
  `vrmVcConnu` dans `chrome.storage.local`, §4.9).
- **Aucune vente, aucune annonce n'est comptée** : l'onglet Vestiaire de l'app
  dit ce qui a été relevé (`VestiaireMesure` : relevé · jamais · pas su) et le
  bouton VRM du site le dit aussi (« VRM apprend à lire Vestiaire Collective »).
  Le jour où la structure montre où vivent une vente, son montant net et sa
  date, on écrira l'analyseur — pas avant.
- **Le geste de Julien** : installer la 5.154, puis ouvrir dans ce Chrome ses
  pages vendeur Vestiaire (ventes, articles en vente, paiements).
- Preuves : `audit-vc-recon.cjs` (le VRAI `vc-inject.js` dans un vrai
  navigateur sous le nom de vestiairecollective.com, nourri de données
  personnelles inventées — **10 contrôles** ; réaffaibli pour relever des
  valeurs au lieu de types → **3 rouges**) ; `audit-fusion.cjs` porte
  `vc_recon` ; banc `vestiaire.cjs` (trois états, aucun chiffre inventé).
- Extension **5.154.0**, zip régénéré, `EXT_ATTENDUE` suivie,
  `EXT_CAPACITES.vestiaire`. Aucune permission d'hôte ajoutée : les scripts de
  contenu suffisent, le fond n'appelle jamais Vestiaire.


## 31 octobre — Flou par compte : PAS livré sur Vestiaire (aucune identité de compte)

Demande : « pareil pour leboncoin et vestiaire … les autres floutées comme pour
vinted ». Vérifié dans l'extension (`vc.js`, `vc-inject.js`, `background.js`) :
`vc_listings`, `vc_ventes`, `vc_achats`, `vc_messages` ne portent **aucun
identifiant de compte Vestiaire** (une seule boîte supposée), et rien ne relève le
compte connecté sur vestiairecollective.com (`etatSite` le dit : « Vestiaire n'est
pas encore capté »). Flouter serait deviner : rien n'est fait côté app.
Capacité d'extension à construire (pas livrée, autre chantier sur la version) :
lire l'id du compte connecté sur une route « moi » de Vestiaire, l'écrire
(`vc_session = { id, at }`) et estampiller `compte` sur chaque ligne `vc_*` ; l'app
appliquerait alors `STYLE_FLOU` (src/flouCompte.js) avec la même règle de
fraîcheur que Leboncoin.

## 31 octobre (soir) — Extension 5.294 : une liste filtrée n'est plus « la liste »

- **Défaut (prouvé sur le vrai `vc-inject.js` + `background.js`)** : le fond tient
  une liste Vestiaire pour ENTIÈRE quand la page 0 rend autant d'éléments que
  `meta.count` — alors `rangerVcAnnonces` REMPLACE toutes les annonces, et
  `rangerVcVentes` (« à expédier ») retire `aExpedier` à ce qui n'y est plus. Or
  `meta.count` est le total de la REQUÊTE : un onglet ou une recherche
  (`?status=sold`, `?q=…`) rend le total du filtre. Une annonce « vendue » effaçait
  les autres (boosts perdus), une recherche vide disait « Aucune annonce sur
  Vestiaire », une vente à expédier cachée par un filtre n'était plus à expédier
  (un colis caché est un colis perdu).
- **Correction** (`vc-inject.js`, `sansFiltre`) : hors pagination, tri et langue
  (liste blanche `PARAMS_NEUTRES`), le total n'est pas transmis (`null` ⇒ la page
  ne fait que compléter, l'écran dit « au moins »). Même règle que la liste
  complète Leboncoin (la requête ne filtre sur rien). Annonces, ventes, messages,
  achats. ⚠️ Non mesuré : les paramètres que Vestiaire met vraiment sur ces
  requêtes (aucune n'a été vue pleine) — si une requête sans filtre porte un
  paramètre hors liste, la liste ne fera jamais foi (le sens sûr) ; l'ajouter à
  `PARAMS_NEUTRES` une fois MESURÉ.
- Preuve : `scripts/audit-fiabilite-annonces.cjs` (B1-B2) — 5 rouges sur le code
  d'avant, vert après, mutation « filtre ignoré » rouge.
## 31 octobre — Vestiaire : le compte ouvert, tes conversations en clair, répondre sur ton clic, les favoris (extension 5.295.0)

Demande de Julien : « j'ai déjà mis des annonces aujourd'hui, prépare aussi les ventes,
les messages aux favoris et tout ça ; au moins pouvoir lire les messages et écrire aux
personnes, sans forcément automatiser — à toi de voir ».

**Ce qui était PROUVÉ de la forme Vestiaire avant de coder** (code, historiques, audits) :
seules ces réponses ont été vues chez lui — `notification-feed-counter/v2`
(`data.unseen.messages`), `users/me/product-listings`, `users/me/awaiting-shipping-items`
(vides le 26 oct.), `orders/current-light`, `deposit/catalog|brands`, et le support
`partners/zendesk/conversations`. La forme `{meta:{count,offset}, data:[…]}` de l'API v2
est connue. ⚠️ La base de Julien (`vc_recon.schemas`) n'était PAS lisible depuis cette
session (l'outil Supabase disponible pointe un autre projet) : rien n'a été mesuré sur sa
base. **Aucune route n'a été inventée** : chaque lecture neuve est reconnue à son CHEMIN
et à des noms de clés qui disent ce qu'ils portent, autre chose ⇒ rien (« pas su »), et sa
FORME (clés + types) part avec pour viser juste ensuite — la méthode 5.237-5.239.

Ce qui est livré (extension **5.295.0** ; une autre session livre la 5.294.0) :
- **Le compte ouvert** (`vc-inject.js` `noteMoi`) : une réponse `/users/me` (ou
  `/v{n}/users/me`) ⇒ `data.id` (ou `id` à la racine ; `data.type` doit dire user/member/
  account s'il existe). Jamais le nom, l'e-mail, l'avatar. Le fond le tient **par onglet**
  (`vrmVcOnglets`) et range `vc_session = { id, at, source, forme, comptes }` (réécrit
  seulement s'il change, ou toutes les 6 h). ⚠️ La route `/users/me` exacte n'a jamais été
  vue chez lui : si Vestiaire ne la charge pas, `vc_session` reste vide — le flou par compte
  (src/flouCompte.js, même règle que Leboncoin) n'est PAS branché côté app dans ce chantier.
  Les conversations et les fils portent `compte` (celui de l'onglet, jamais celui du message).
- **Les conversations en clair** : la liste (5.238) gagne l'aperçu du dernier message
  (texte borné à 160, jamais l'auteur nommé) ; un FIL (`…/conversations/{id}` ou
  `…/conversations/{id}/messages`, un identifiant avec un chiffre) donne le texte des
  messages (clé body/text/content/message), leur date, et « de toi » (une clé booléenne
  isMine/fromMe/outgoing…, ou l'auteur = le compte ouvert ; sinon `null`, dit « auteur
  non dit par Vestiaire »). Rangé dans `vc_fil_{conv}` (lire-fusionner-réécrire, une écriture
  à la fois par conversation, lecture ratée ⇒ rien, un message n'est jamais effacé, 300 au
  plus) avec des scalaires lus par l'app en `meta` (n, dernierAt, apercu, dernierDeMoi).
  ⚠️ Le choix du 27 oct. « VRM n'en garde ni le texte… » est levé sur SA demande : le texte
  est gardé ; le NOM de la personne, jamais (audit-vc-publier E corrigé en conséquence).
- **Répondre sur son clic** — rien à l'aveugle : l'adresse et la forme du corps
  **s'apprennent** quand Julien envoie lui-même un message sur la page (une écriture 2xx sur
  un chemin de conversation) : la « recette » (`vrmVcRecette` + `vc_envoi` pour l'app) garde
  méthode, hôte, chemin à trou `{conv}`, clé du texte, mots fixes du corps (`"type":
  "messages"`), et les NOMS des en-têtes — jamais une valeur d'en-tête, jamais son texte.
  Deux identifiants dans le chemin, une valeur inconnue, une conversation jamais vue dans
  l'onglet ⇒ « pas rejouable » (avec la raison) ; un essai pas rejouable ne remplace jamais
  une recette rejouable. VRM → Vestiaire → Messages : la conversation s'ouvre, « Envoyer sur
  Vestiaire » ⇒ commande `vcRepondre { conv, texte }` ⇒ `repondreVestiaire` : une à la fois,
  pause 30 min posée par un 429/403 (`vrmPauseVc`), plafond **50 actions/h** sous le compte
  `vc:{id}` (`compterAction`, place RENDUE si rien n'est parti), conversation déjà lue,
  onglet vestiairecollective.com dont l'extension SAIT le compte et du MÊME compte que la
  conversation (sinon refus dit), envoi par l'onglet (`vc.js` → `vc-inject.js`, jeton) avec
  les en-têtes que la page vient d'envoyer, gardés en mémoire dans la page seulement ; sans
  eux : « recharge ta messagerie Vestiaire » (rien n'est parti). Le message envoyé rejoint
  le fil (« envoyé depuis VRM »). Muet ⇒ « je ne sais pas si c'est parti, regarde avant de
  renvoyer », jamais « fait ».
- **Favoris** : chaque annonce de `product-listings` porte `favoris` = un NOMBRE lu sur une
  clé likes/favorites/wishlist… (une liste de personnes ⇒ sa longueur seulement) ; aucune clé
  ⇒ `null`. L'écran Vestiaire dit « N favoris sur M annonces (N°12 · 3…) ». **« Écrire aux
  favoris » n'est PAS construit** : aucune réponse vue ne dit QUI a mis en favori, VRM
  n'écrit à personne (même règle que Leboncoin).
- **Ventes** : la carte « Tes ventes Vestiaire » met les ventes à expédier d'abord (date
  limite la plus proche), et dit le colis (« à envoyer avant le … », transporteur + n° de
  suivi, « plus dans à expédier depuis le … »). Toujours AUCUN montant dans un total (prix
  ou versement : pas su).

Preuves : `scripts/audit-vc-conversations.cjs` (36 contrôles ; le VRAI vc-inject.js dans
Chromium + le VRAI background.js dans `_fond-vm.cjs`) — sur le code d'avant 3 ✅ · 16 ❌ ;
mutations rouges : conversation non vue, valeurs d'en-tête, « de toi », hôte, pause,
plafond, compte, place rendue. Banc `scripts/bancs/vestiaire-messages.cjs` (390 px tactile
et 1512 px : fil, Envoyer, pas appris, extension 5.293, refus 429, favoris).

**Gestes de Julien** : installer la 5.295.0 ; sur vestiairecollective.com (même Chrome),
ouvrir sa messagerie et UNE conversation, puis **envoyer une réponse lui-même une fois** :
l'extension apprend la forme d'envoi (VRM → Vestiaire → Messages dit alors « Envoyer sur
Vestiaire »). Relire ensuite `vc_recon.schemas`, `vc_session`, `vc_envoi.dernierEssai` et la
`forme` de `vc_fil_*` (lecture seule) : si une réponse n'a pas été reconnue, c'est là que sa
forme est écrite.
