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

## 1er novembre — Vestiaire « parfait » : annonces en fiches, ventes par étape, compte ouvert mis en avant (extension 5.296.0)

Julien : « occupe-toi des dernières modifications : les annonces Vestiaire
Collective, les ventes, tout ça — que tout soit parfait ».

- **Annonces · Vestiaire en FICHES** (`AnnoncesVestiaire`, même mise en page que
  Leboncoin, `vrm-lbc-catalog`) : photo, titre, N° relié par IDENTITÉ seulement
  (`vc_listings.liens` ou référence VRM-{n°}, jamais le titre), prix lu (le nom
  de sa clé en `title`), état (en ligne · en attente de validation · vendue ·
  retirée ; un mot inconnu recopié tel quel, aucun mot ⇒ « état non dit »).
  « Vendue » est PROUVÉE par une vente lue du même article (`vc_ventes.productId`).
  La fraîcheur est dite une fois en tête ; plus de 24 h ⇒ « à confirmer » avec le
  geste (rien n'est retiré). Le résumé du boost de « Mettre une paire en vente »
  ne répète plus le nombre d'annonces (§7).
- **L'extension lit la fiche** (`vc-inject.js` `ficheAnnonce`, fond
  `ficheVcAnnonce`) sur `users/me/product-listings`, par des clés dont le NOM dit
  ce qu'elles portent : titre (name/title…), UNE photo https d'un hôte
  vestiairecollective.com, prix + clé (cents convertis), statut court ; jamais
  rien sous une clé de personne ; la FORME de la première annonce est rangée
  (`vc_listings.forme`). Un champ que la réponse ne porte pas n'efface jamais un
  plein. ⚠️ Forme jamais vue pleine chez lui : à vérifier sur sa base
  (`vc_listings.forme`, `items.*.titre/photo/prix/statut`) après son passage.
- **Le compte de l'onglet sur chaque ligne** : annonces, ventes et achats portent
  `compte` (celui que l'onglet a lu sur `/users/me`, jamais un compte dit par le
  message). Une liste ENTIÈRE d'un compte ne retire plus les annonces d'un AUTRE
  compte ; « à expédier » lue en entier sur un compte ne retire plus « à
  expédier » aux ventes d'un autre (un colis caché est un colis perdu).
- **Flou par compte BRANCHÉ** (`compteVcOuvert`, `vcFloute` dans
  src/flouCompte.js, même règle que Leboncoin) : `vc_session` de moins de 12 h,
  extension de CE navigateur connectée et à jour ; Annonces, Ventes, Achats,
  Messages (conversations). Ligne sans compte ⇒ jamais floutée.
- **Ventes par ÉTAPE** (`etapeVenteVc`) : à expédier (date limite, bordereau) →
  contrôle par Vestiaire → livrée → versée/terminée, annulée/retournée ; « paid »
  seul (payée par l'acheteur ? versée ?) n'est PAS rangé, recopié tel quel.
  **Aucun montant à l'écran** (ni par vente) : la raison est dite UNE fois. Le
  montant reste rangé, compté nulle part.
- **États** : chaque lecture Vestiaire passe par `lireBaseRelue` (relue une fois
  sur 401/5xx/réseau) ; « pas su » dit la raison avec « Réessayer » (44 px) ;
  « jamais lu » et « vide » disent le geste sur vestiairecollective.com ; une
  date illisible ne donne plus « Invalid Date ».
- Preuves : `scripts/audit-lbc-vc-lecture.cjs` (V1-V5, vrai `vc-inject.js`,
  vrai `vc.js`, vrai `background.js`) — 9 rouges Vestiaire sur la 5.295, vert
  après, `--prouve` 5 mutations Vestiaire rouges ; banc
  `scripts/bancs/vestiaire-fiches.cjs` (390/1512 : fiches, étapes, aucun montant,
  flou, sans extension, session de 20 h, 401 relu, panne « pas su ») — rouge sur
  `origin/main`, vert après. `vestiaire`, `vestiaire-messages`, `vestiaire-colis`,
  `vc-publier` verts.
- **Gestes de Julien** : installer la 5.296.0 ; sur vestiairecollective.com
  (même Chrome), ouvrir « Mes articles », « Mes ventes », « Articles à
  expédier » une fois.

## 1er novembre — « Que l'extension capte les annonces et les messages parfaitement » : audit de la capture (extension 5.299.0)

Julien : « fais en sorte que l'extension capte les annonces et les messages pour
Vestiaire et Leboncoin parfaitement ». Tracé de chaque capture Vestiaire, de la
réponse réseau (`vc-inject.js`) au relais (`vc.js`), au fond (`rangerVc*`,
`noterSessionVc`, `rangerVcFil`) et à l'écran (`AnnoncesVestiaire`,
`MessagesVestiaire`, `colisVestiaire`). Défauts trouvés (tous reproduits sur le
vrai code de la 5.296) et corrigés :

1. **Une réponse d'erreur passait pour une lecture.** Les analyseurs ne
   regardaient pas le code HTTP : un 401 JSON (`{errors:[…]}`) de
   `users/me/product-listings` partait comme une liste vide — `capturedAt` à
   « maintenant », `total` effacé, `lectures[compte]` daté : l'écran disait
   « lue à l'instant » sur des données anciennes. ⇒ seules les réponses 2xx sont
   lues (listes, compte, schéma).
2. **Un format inconnu passait pour « aucune annonce ».** Une réponse dont aucune
   liste n'est reconnue (champ renommé, autre API) donnait `items: []`. ⇒ c'est
   une liste VIDE seulement sous la forme connue (`[]`, `{data: []}`,
   `meta.count === 0`) ; sinon `inconnu` (la forme : noms de clés + types) : le
   fond ne date rien, ne vide rien, garde `formeInconnue` (vc_listings,
   vc_messages, vc_achats ; `forme['inconnu-…']` pour vc_ventes) et note
   `vc_format_inconnu_*`.
3. **XHR en `responseType = 'json'` ignorée** (rien n'était lu). ⇒ lue (comme Leboncoin).
4. **Changer de compte dans le même onglet rangeait sous l'ANCIEN compte.** Le
   fond prenait le compte de l'onglet (dernier `/users/me`) ; la page neuve rend
   « Mes articles » avant son `/users/me` ⇒ la liste ENTIÈRE du compte B était
   rangée sous A et effaçait les annonces de A. ⇒ chaque capture porte le `moi`
   de la page (lu dans CE document) ; le compte n'est posé que si page et onglet
   disent le même (`compteVcCapture`, après la file de `noterSessionVc`), sinon
   `''`. Et une liste entière lue sans compte su ne retire plus une annonce (ni
   « à expédier », ni « non lu ») rangée sous un compte (`autreCompteVc`).
   Répondre : le fond dit au nom de quel compte il parle, la page refuse si son
   `/users/me` n'est pas celui-là (`autre-compte`, rien ne part).
5. **Liste en plusieurs pages jamais entière.** Seule la page 0 qui rend tout
   faisait foi : au-delà d'une page, une annonce vendue/supprimée restait « en
   ligne » pour toujours. ⇒ `lotComplet` (règle de la liste complète Leboncoin) :
   pages du même document, même requête hors pagination, même total, même
   compte, < 3 min, identifiants distincts = total ⇒ `complet` (les ids) ; le fond
   fait foi avec (annonces, à expédier, non-lus). Côté app : une annonce plus vue
   depuis 24 h alors que la liste a été relue est « Plus vue sur Vestiaire depuis
   … — à confirmer » (`etatAnnonceVc`, rien n'est retiré).
6. **La fiche se trompait** : lecture en profondeur d'abord ⇒ `brand.name`
   (« Nike ») pris pour titre quand `brand` précède `name`, l'avatar du vendeur
   (`seller.picture`) pris pour photo. ⇒ niveau par niveau, rien sous
   vendeur/marque/profil/logo (`PAS_FICHE`).
7. **Un émoji coupé faisait refuser la ligne entière.** `slice(0,160)` au milieu
   d'un émoji laisse une moitié (`\ud83d`) que jsonb REFUSE : un aperçu de
   message mal coupé empêchait d'enregistrer toutes les conversations (et le
   fil). ⇒ `coupe` (page) / `coupeVc` (fond) : jamais de moitié d'émoji.
8. **Les non-lus d'un seul compte.** `vc_messages.compteur` était celui du
   dernier onglet. ⇒ `compteur.compte` + `compteurs[compte]` ; l'app additionne
   (`nonLusVestiaire`, « sur tes N comptes, le plus ancien relevé il y a … »).

Laissés (dit) : une conversation dont tous les messages sont des photos est
rangée avec `n = 0` (l'app dit « Texte pas encore lu ») ; les paramètres de
pagination réels de Vestiaire ne sont toujours pas MESURÉS (une requête
`page[offset]` ne fera jamais foi — le sens sûr) ; le compte d'une capture
arrivée avant `/users/me` reste `''` (jamais flouté, jamais un faux).

Preuves : `scripts/audit-capture-vc-lbc.cjs` (C1-C9 : vrai vc-inject.js avec
fetch ET XHR, vrai vc.js, vrai background.js dans `_fond-vm.cjs` avec une base
qui refuse les moitiés d'émoji comme jsonb, vraies fonctions de l'écran extraites
de App.jsx) — 22 rouges sur `origin/main`, vert après ; `--prouve` : 17 mutations
toutes rouges. `audit-lbc-vc-lecture` et `audit-vc-conversations` passent le `moi`
comme le vrai relais (leurs mutations remises sur le nouveau texte, toutes rouges).

**Gestes de Julien** : installer la 5.299.0 ; sur vestiairecollective.com (même
Chrome), ouvrir « Mes articles » et faire défiler JUSQU'AU BOUT (toutes les pages :
c'est ce qui permet de retirer une annonce supprimée), puis la messagerie. S'il a
plusieurs comptes Vestiaire : recharger la page après chaque changement de compte.

### Même jour — « Envoyées à VRM… et rien n'apparaît dans VRM » (retour de Julien, 5.299.0)

La carte de l'extension disait « hopcancale35@gmail.com · Compte Vestiaire
Collective · connecté · Ventes / Annonces / Messages : lues à l'instant · Envoyées
à VRM à l'instant », et l'app ne montrait rien. Tracé de bout en bout (la base de
Julien n'est PAS lisible d'ici : l'outil Supabase de cette session pointe un autre
projet — rien n'a été mesuré sur sa base). Ce qui pouvait empêcher l'affichage :

1. **Vestiaire absent des filtres et de la colonne.** `sitesPresents` ne
   montrait Vestiaire que si `vc_listings` ou `vc_ventes` existait, lu UNE fois au
   montage de l'app : extension qui n'avait rangé que ses messages (compteur,
   `vc_session`), ou première lecture faite app ouverte ⇒ aucune entrée Vestiaire
   (Annonces, Ventes, Messages, Achats, colonne) — « rien n'apparaît ». ⇒
   Vestiaire est TOUJOURS là (sa demande : « même s'il n'y a rien de capté… je
   veux qu'il y ait les onglets »), chaque écran dit « pas encore lu » + le geste.
2. **« lues » ne voulait pas dire « trouvées ».** `noterVcCapte` posait « lues »
   dès qu'une réponse était rangée, même vide (0 annonce), même au format inconnu
   (avant 5.299 rangé comme liste vide), et le simple compteur de non-lus
   s'affichait « Messages : lues ». ⇒ la carte dit le NOMBRE trouvé (« aucune dans
   ce que Vestiaire a rendu — ouvre la page de tes annonces »), « forme pas encore
   lue » pour un format inconnu, et les non-lus à part (`nonlus`).
   « Envoyées à VRM » (vrmFlux.okAt) n'est posé que sur une réponse 2xx de la base
   (`supabaseUpsert` → `res.ok`) : vérifié, pas un mensonge.
3. **Extension connectée à un autre compte VRM** : elle écrit sous le compte VRM
   où ELLE est connectée (la carte affiche hopcancale35@gmail.com) ; si l'app est
   ouverte sur un autre compte, rien n'arrive, et l'écran disait seulement « pas
   encore lu ». ⇒ chaque écran Vestiaire le dit en tête (`ExtVestiaireCompte`,
   texte de `raisonExtGlobale` : `autre-vrm`, `vrm`, `vrm-passu`).
4. Format inconnu ⇒ l'écran Annonces dit « Vestiaire a répondu dans une forme que
   VRM ne sait pas encore lire » (`data-vc-annonces="format"`), jamais « aucune
   annonce ».

Preuves : `scripts/bancs/vestiaire-bout-en-bout.cjs` — le VRAI vc-inject.js →
vc.js → background.js (`_fond-vm.cjs`) écrit les lignes, l'app (dist/) sert
EXACTEMENT ces lignes : annonces (N°41 relié), vente à expédier, conversation et
3 non-lus affichés (390/1512) ; base vide ⇒ filtre « Vestiaire » proposé depuis
Vinted sur les 4 écrans + entrée de la colonne + « pas encore lu » ; autre compte
VRM ⇒ dit en tête. Sur `origin/main` : 13 rouges (filtre et colonne absents,
autre compte muet), vert après. `bancs/badge.cjs` §6 bis : 4 rouges sur l'ancienne
carte, vert après ; `audit-capture-vc-lbc` C1/C6 (carte : inconnu, non-lus à part).

**Gestes de Julien** : vérifier que le compte VRM de l'app est bien
hopcancale35@gmail.com (sinon l'écran Vestiaire le dit maintenant en orange) ;
installer la 5.299.0 ; la carte dira alors COMBIEN d'annonces elle a trouvées sur
« Mes articles » — si elle dit « aucune » alors qu'il en a, ou « forme pas encore
lue », c'est que la page « Mes articles » ne charge pas `users/me/product-listings`
sous la forme connue : relire `vc_recon.chemins`/`schemas` et `vc_listings.formeInconnue`
(lecture seule) pour viser la bonne route.


## 1er novembre 2026 — Vestiaire partout (anti double vente, argent, colis)

Julien : « fais tout comme un pro, il ne doit y avoir aucune erreur possible ».
L'audit des parcours du 1er novembre avait mesuré que Vestiaire vivait à part :

- **A1** une vente Vestiaire ne faisait « à retirer » nulle part (Vinted,
  Leboncoin, eBay), ne sortait pas la paire du Stock ; une vente ailleurs ne
  disait jamais « à retirer de Vestiaire » ;
- **A2** « toutes plateformes » (CA déclaré, URSSAF, Vendu, bénéfice, seuils
  TVA/plafond) sans Vestiaire, et sans le dire ;
- **A4** les colis Leboncoin et Vestiaire à poster n'étaient comptés que dans
  l'écran Colis (ni Ma journée, ni la cloche, ni le widget, ni les rappels) ;
- **A6** « Vendus ailleurs » comparait les N° en minuscules (« 007 » ≠ « 7 ») ;
- **A10** une vente Vinted au prix illisible comptait 0 € dans le CA et le Vendu.

### Ce qui est fait — UNE règle, UN propriétaire

- `api/_lib/vestiaire-regle.js` (nouveau, importé par l'app ET le serveur) :
  identité (`numVcVente`, `numVcAnnonce` : lien posé par VRM, sinon référence
  VRM-n° de l'article — jamais le titre), étapes (`VC_VENTE_ETAPES` déplacée
  d'App.jsx), `vcVenteAnnulee`, `vcVentePartie`, l'argent (`montantRecuVc` : compté
  seulement si le NOM de la clé dit « ce que tu reçois » et la devise est EUR ;
  `dateVersementVc` : seulement une clé `verseLe`), les colis (`colisVcAPoster`,
  jours à l'heure de Paris), l'état d'une annonce (`etatAnnonceVcBrut`,
  `VC_ANNONCE_ETATS` déplacée), `annoncesVcEnLigne` (lecture < 24 h, sinon rien),
  `stockVestiaire`, `retraitsVestiaire`.
- `api/_lib/colis-sites.js` (nouveau) : `lbcColisAPoster` (la règle de l'écran
  Colis Leboncoin, qui l'utilise), `colisLbcAPoster`, `resumeColisSites`,
  `totalColis`. Les règles Leboncoin viennent du miroir `ventes-regle.js`
  (+ `lbcExpediee`, + `montantCommandeLu` dans `NOMS`, refabriqué par
  `audit-bilan-semaine.cjs --recopie` ; sa tête importe les règles Vestiaire).
- **Anti double vente** : `numerosDejaVendus` reçoit `ventesVc` (« pas su »
  nommé, vente sans identité comptée `vcSansPaire`) ⇒ eBay « à retirer »
  (`aRetirerEbayAilleurs`, texte « vendue sur Vestiaire »), programmées à
  annuler, publication pas reproposée ; écran Leboncoin : carte « vendue sur
  Vestiaire — à retirer de Leboncoin » (`numerosVendusVc` + `aRetirerDeLbcEbay`) ;
  cloche : « vendu sur Vestiaire, encore en vente sur Vinted », « vendue … encore
  en ligne sur Vestiaire — à retirer de Vestiaire », « à retirer de Leboncoin
  (vendue sur Vestiaire) » ; « Vendus ailleurs » (`chargerRetraitsMulti`) lit
  `vc_listings`/`vc_ventes` (`retraitsVestiaire`) ; la sortie du Stock
  (`stockVestiaire`) ; le serveur (email entrant d'une vente Vinted) pousse
  « encore en vente sur Vestiaire » (`annoncesVcEnLigne`, `doubleVenteApprise`).
  VRM ne retire JAMAIS rien tout seul de Vestiaire ni sur une vente Vestiaire
  (le retrait automatique eBay ne lit que la preuve Vinted).
- **Argent** : `ventesFaites` / `ventesDeclarables` reçoivent `vestiaire` ;
  `montantCommandeLu` (null, jamais 0) ; les ventes non comptées sont rendues
  (`nonComptees`, `ecartees[].manque`) et dites : Ma journée (Vendu « au moins ·
  N non comptées », Reçu, CA de l'année, cotisations), carte CA de Compta, carte
  URSSAF (Puce « dans aucun chiffre — ce total est un minimum »), seuils
  (`caAnnee`), rappel URSSAF (`montantPeriodeUrssaf` partiel, miroir refabriqué),
  widget (`recuDuMoisPublie`, `moneyAuMoins`), bilan de la semaine, facturation
  électronique, Statistiques, bénéfice (« sans N vente Vestiaire », publié
  `horsVestiaire`). La publication `vinted_urssaf_mois` porte
  `sources.Vestiaire` et `nonComptees: { n, par }`.
- **Colis** : `vrm_colis_aposter` porte `leboncoin` et `vestiaire` (total et
  retards) ; la case « À envoyer » de Ma journée (`data-leboncoin`,
  `data-vestiaire`) et la Tournée les comptent ; le widget et les rappels (matin :
  date limite Vestiaire ; soir : « Demain : N colis » ; bilan) lisent les mêmes
  règles ; un site illisible ⇒ « au moins », nommé. Leboncoin n'écrit aucune date
  limite : jamais « en retard ».
- **A6** : `articlesVendusAilleurs` compare par `cleNum`.

### Preuves (§6)

- `scripts/audit-vestiaire-partout.cjs` : 43 verts ; sur `origin/main` (copié dans
  `git archive`) 22 rouges dont des rouges de COMPORTEMENT sans aucune règle neuve
  (prix vide compté `eur: 0`, « 007 »/« 7 » non rapprochés) ; `--mutations` : 9/9
  tuées (montant sans clé « versé », annulée comptée, identité par titre, prix
  illisible à 0 €, « Colis fait » recompté, lecture périmée dite en ligne, sans
  `cleNum`, date limite jamais en retard, Vestiaire hors du verdict).
- `scripts/bancs/colis-tous-sites.cjs` (les VRAIES routes widget + soir) : 12 OK,
  9 KO sur l'avant (widget 1 au lieu de 3, soir « 1 colis »).
- `scripts/bancs/vestiaire-bout-en-bout.cjs` §E : la vente écrite par le vrai
  code de l'extension compte dans Ma journée, la cloche et Colis (même nombre),
  et son montant pas sûr est nommé.
  Sur l'avant : 4 rouges (Colis montrait 1 carte, la cloche publiait 0).
- Bancs relancés, verts : `vendu-recu`, `journee-mieux`, `journee-chiffres`,
  `colis-colonnes`, `revendeurs`, `tournee`, `bilan-semaine`, `rappel-soir`,
  `widget-colis`, `widget-multi`, `ship-multi`, `double-vente-push`. Rouges
  IDENTIQUES sur `origin/main` (pas de ce chantier) : `double-vente` (bouton
  « Vestiaire » des filtres rogné, 2 KO), `statuts-colis` (filtres de Ventes),
  `audit-numerotation-lecteurs` (déjà noté dans l'audit des parcours).
- Audits adaptés à la règle déplacée (jamais affaiblis) : `audit-urssaf`
  (`montantCommandeLu` extrait), `audit-capture-vc-lbc` (familles chargées depuis
  le module), banc `bilan-semaine`.

### Ce qui reste

- Le montant Vestiaire : tant que l'extension ne range pas une clé dont le nom dit
  ce que Vestiaire verse (et `verseLe`), TOUTES ses ventes sont « non comptées »,
  dites à côté de chaque total. Mesurer la forme réelle (`vc_ventes.forme`) avant
  d'apprendre une clé à l'extension.
- A3 (même paire sur deux comptes Vinted), A5, A7–A9, A11–A14 : hors de ce chantier.

## 2 novembre (soir) — 5.314.0 : « Mes articles » Vestiaire enfin LUS (la forme réelle)

Julien : « est-ce que l'extension est prête pour Vestiaire ? j'ai fait une vente ». Mesuré (lecture seule) :
`vc_listings` du 1er nov. portait `formeInconnue` — chaque élément de `/users/me/product-listings` est
une ENVELOPPE `{ type: 'published', published: { product: { id, headline, subHeadline, price.cents,
sellerEarnings, picturePath, path }, listingDate, negotiationsSummary } }`, sans id au premier niveau :
`tableauAnnonces` n'y voyait aucune liste ⇒ AUCUNE annonce Vestiaire lue. `vc_ventes` : une seule lecture
(« à expédier », vide, le 1er nov. 22 h) ; aucun e-mail Vestiaire n'arrive dans VRM.
- `vc-inject.js` : l'enveloppe est DÉPLIÉE (`deplier`) — son contenu, `status` = le type, l'identifiant
  de SON produit, titre = headline + subHeadline (affichage seul). Rien d'autre deviné ; la photo
  (`picturePath`, chemin relatif d'hôte inconnu) n'est PAS reconstruite (un blanc plutôt qu'un faux).
  Les ventes et achats passent par la même fonction : une enveloppe y est dépliée de même.
- `audit-capture-vc-lbc` C10 (forme réelle, valeurs inventées) : rouge sur la 5.313, vert sur la 5.314.
Geste : installer la 5.314.0, puis sur vestiairecollective.com ouvrir « Mes articles » ET « Mes ventes »
(défiler jusqu'au bout) : la vente apparaît dans VRM à ce moment-là.

## 2 novembre (soir) — 5.315.0 : « TOUT Vestiaire » gardé tel quel

Julien : « fais vraiment une extension qui capte tout Vestiaire : dès que je vais sur un onglet, ça
enregistre, pour après pouvoir capter toutes les infos — les ventes, les bordereaux, etc. »
- Rien n'est DEMANDÉ à Vestiaire (aucune requête de plus, aucun geste simulé) : on garde ce que la page
  charge déjà, sur SON compte, dans SON onglet.
- `vc-inject.js` : toute réponse JSON 2xx de vestiairecollective.com (≤ 400 Ko), les données de page
  (`__NEXT_DATA__`) à chaque chargement, et tout PDF reçu par la page (bordereau, ≤ 3 Mo, d'où qu'il
  vienne, en-tête `%PDF` vérifié). Paramètres d'adresse « secrets » masqués (`token=_`).
- Le fond (`rangerVcBrut`, `rangerVcPdf`) : une ligne par adresse `vc_brut_{empreinte}` = { url, methode,
  sorte (api/page), page, compte (celui de l'onglet, `compteVcCapture`), at, taille, json } — la dernière
  réponse vue ; clés secrètes du contenu VIDÉES (`[retiré]` : jetons, mots de passe, carte, IBAN…) ;
  `vc_pdf_{empreinte}` = { url, page, compte, at, taille, b64 }. Deux budgets (taille de la base) : SES
  données (/me/, commandes, ventes, envois, bordereaux, messages, porte-monnaie…) 1 500 adresses × 400 Ko ;
  le reste (catalogue, autres vendeurs) 300 × 100 Ko (`chrome.storage.local`, §4.9). L'app ne lit pas
  ces lignes : elles servent à construire les lectures exactes (ventes, montant versé, bordereaux) sur la
  forme RÉELLE.
- `audit-capture-vc-lbc` C11.
Geste : installer la 5.315.0 et se promener sur Vestiaire (Mes articles, Mes ventes, une vente ouverte,
son bordereau, les messages, le porte-monnaie) ; puis dire à la session : « regarde ce qu'elle a capté ».

## 2 novembre (soir) — 5.316.0 : ta vente Vestiaire complète, photos, bordereau

Julien : « les photos ne chargent pas […] je veux que ma vente apparaisse ». Lu dans ce que la 5.315 a
gardé (`vc_brut_*`, formes réelles) :
- photos : Vestiaire n'écrit que le NOM du fichier (`picturePath` / `imageUrl`, « 73026101-1_3.jpg ») ; ses
  pages l'affichent depuis `https://images.vestiairecollective.com/produit/{nom}` (relevé dans ses propres
  réponses) ⇒ `photoVc` (annonces et ventes) ; une autre forme ⇒ pas de photo ;
- la vente (`/ots/sales`, `/users/me/awaiting-shipping-items`) : `productId`, `brandName` + `productName`,
  `sellerEarning` (« 203,23 € », ce que Vestiaire verse — clé reconnue par `CLE_RECU_VC`, donc comptée
  dans les totaux), `shipByDate` ; elle était déjà rangée dans `vc_ventes` (sans titre, photo ni montant) ;
- le suivi (`/contents/timeline/seller?product=`) : transporteur (`chosenCarrier.carrierName`), n° de suivi,
  BORDEREAU (`shippingLabelUrl`, PDF sur un stockage amazonaws, adresse signée), étapes, paiement estimé
  ⇒ `noteTimeline` → `rangerVcTimeline` : le fond rapatrie le PDF (vérifie `%PDF`, ≤ 3 Mo) dans
  `vc_label_{produit}`, la vente porte `bordereau: { id, at }`, transporteur, suivi, `paiementEstime`.
- App (« Tes ventes Vestiaire ») : photo, titre, « Vestiaire te verse … · paiement estimé le … »,
  « Imprimer le bordereau » (PDF lu au clic, `BoutonBordereauVc`).
- `audit-capture-vc-lbc` C10 (photo) et C12 (vente, montant, suivi, bordereau rapatrié).
Reste : les ACTIONS depuis VRM (baisser un prix, répondre à une offre, retirer une annonce…) — Julien
doit dire lesquelles ; chacune s'apprend sur SON geste fait une fois sur Vestiaire (recette, comme
`vcrepondre`), jamais devinée.

## 2 novembre (nuit) — les emails de vente Vestiaire intégrés (branche `claude/vc-emails`)

Julien (21 h 38) : « regarde pour les mails de Vestiaire Collective pour les ventes, je veux qu'on les
intègre, fais ça bien ». Puis (21 h 44) : « ce n'est pas toujours une paire, là c'est un sac » — tout
texte Vestiaire dit « l'article ».

### Ce que la base montrait (lecture seule, 2 nov. vers 21 h 45)
- **Aucun email Vestiaire n'est jamais arrivé** dans VRM : 0 ligne `email_inconnu_*`, `email_reception_*`,
  `email_texte_*`, journal ni quarantaine qui parle de Vestiaire — alors que les emails Vinted, eBay,
  Leboncoin (et même Whatnot) arrivent (dernier reçu le soir même).
- Le registre des adresses porte deux adresses « Masquer mon e-mail » (privaterelay) : ce sont celles
  des comptes VINTED (les emails Vinted relayés y arrivent). Apple fabrique UNE adresse par site :
  celle de Vestiaire n'y est (très probablement) pas.
- Pourquoi rien n'arrive : la règle de transfert iCloud documentée (`docs/email-pipeline.md`, étape 4)
  est « expéditeur contient `vinted` ». L'email Vestiaire arrive par le relais Apple avec un expéditeur
  réécrit `…_at_vestiairecollective_com_…@privaterelay.appleid.com` (nom « Vestiaire Collective ») :
  il ne contient pas « vinted », il reste dans iCloud.
- L'extension avait DÉJÀ lu cette vente (`vc_ventes`, clé = productId = n° du sujet, montant
  `sellerEarning` égal au « Vous gagnez » de l'email, limite `…T23:59:59+01:00`). La forme de
  `vc_ventes` sert donc de référence au rangement de l'email.

### Défaut trouvé sur le code d'avant
Si l'email était arrivé, il aurait été pris par la branche **vente Vinted** (le sujet contient
« vendu ») : `parseSaleEmail` échoue (pas de « a acheté ») ⇒ gardé TRONQUÉ à 2 000 caractères,
« analyse impossible ». Un autre email Vestiaire parlant de « colis … livré » devenait un suivi de
colis `autre` sans n°.

### Ce qui est fait
- `api/_lib/vestiaire-email.js` (fonctions pures) : identité = n° du SUJET « Votre article vient
  d'être vendu (#N) » ; la « Réf » du corps doit dire le même, sinon rien n'est rangé (email gardé
  entier, « à vérifier ») ; « Vous gagnez » en EUR (clé `vousGagnez`, ajoutée à `CLE_RECU_VC`) —
  absent ou autre devise ⇒ `null`, jamais le prix de vente ; date limite « avant le lundi 9 novembre »
  ⇒ `2026-11-09T23:59:59+01:00` (décalage de Paris calculé, année suivante pour décembre→janvier,
  date impossible ⇒ rien) ; date de vente = heure de l'email si même jour que « Vente confirmée »,
  sinon le jour seul ; étiquette `true` seulement si le bouton est là ; photo seulement une image
  `images.vestiairecollective.com` qui porte le productId. Le LIEN de l'étiquette n'est pas gardé
  (redirection ou lien signé qui expire ; l'extension rapatrie déjà le PDF, `vc_label_*`).
- `api/email-inbound.js` : branche Vestiaire AVANT les colis et les ventes Vinted (le vendeur est
  déjà décidé par l'adresse de réception) ; l'email lu va dans `vc_email_vente_{productId}` (prix de
  vente et marque y restent), puis la vente est fusionnée dans **`vc_ventes`** par `modifierCas`
  (`fusionnerVenteEmailVc`) : vente connue (même clé ou même `productId` sous une autre clé) ⇒
  seulement ce qui est vide est complété, `aExpedier`/état jamais touchés, un montant sûr jamais
  remplacé (un montant « pas sûr » l'est) ; vente inconnue ⇒ née « à expédier », source `email`,
  sans `verseLe` (le CA reste daté au versement). Lecture ou écriture ratée ⇒ 503. Notification
  « Vendu sur Vestiaire » (catégorie vente, une fois par annonce) seulement pour une vente nouvelle.
  Un autre email Vestiaire (forme pas apprise) est gardé ENTIER (`email_inconnu`, raison
  « Vestiaire : forme pas encore apprise ») — sauf un email de transporteur NOMMÉ.
- Journal « Tes emails, ce que VRM en a fait » : type `vente-vestiaire` (résumé : annonce, gain,
  limite ; phrase « Vente Vestiaire : … · tu reçois … » ; filtre « Ventes et versements »).
- Aucune ligne de l'app ni de l'extension changée : Ventes, Colis → À envoyer, Ma journée, le widget,
  les rappels et les totaux lisent déjà `vc_ventes` par `api/_lib/vestiaire-regle.js`.

### Preuves (§6)
- `scripts/audit-vestiaire-email.cjs` (47 contrôles) EXÉCUTE la route sur des emails fabriqués de
  la forme reçue (HTML en tableaux ; email BRUT MIME quoted-printable, sujet RFC 2047) : V1-V13,
  R1-R3 (règles de l'app : colis à poster, montant compté, aucun mois de CA), D1-D9 (une seule vente
  avec l'extension, colis parti pas ressuscité, autre annonce intacte), I1-I2, Q1-Q2 (adresse
  inconnue ⇒ quarantaine neutre), E1-E3 (503), A1-A2, P1-P10, J1-J3.
- Code d'avant (`origin/main` au 2 nov.) : **25 rouges**. Mutations (Réf différente acceptée,
  `aExpedier` ressuscité, prix de vente pris pour le gain, lecture ratée acquittée, identité par clé
  seule, montant sûr écrasé) : chacune rouge.
- Verts : `audit-vestiaire-partout`, `audit-routes-revue`, `audit-secrets`, `audit-fonctions-api`
  (toujours 12), `audit-journal-emails`, `audit-email-formes`, `audit-proprietaire-email`,
  `audit-email-rattacher`, `audit-preuve-adresse`, `audit-offres-email`… Rouges identiques AVANT et
  APRÈS (environnement) : `vendeur-neutre`, `recu-achat`, `colis-retrait` (`@babel/parser` absent
  ici), `flux-divers`, `lectures`, `transporteurs`, `codes-retrait`, `retrait-fiable`.

### Reste / limites
- Les emails Vestiaire d'expédition, de livraison, de **paiement** et d'annulation : formes
  inconnues (aucun dans la base). Ils seront gardés entiers dès qu'ils arriveront ; le paiement
  (date de versement ⇒ CA déclaré) se branchera sur leur forme réelle, jamais devinée.
- Risque résiduel : l'extension réécrit `vc_ventes` sans comparer-et-échanger ; si elle écrit dans
  la même fraction de seconde que l'email, l'entrée de l'email peut sauter — la ligne
  `vc_email_vente_*` la garde, et l'extension relit de toute façon la même vente chez Vestiaire.
- Pas de notification « double vente » depuis l'email Vestiaire (le texte de `notificationDoubleVente`
  dit « Vendue sur Vinted ») ; l'app montre déjà « vendu sur Vestiaire, encore en vente sur Vinted ».

### Geste de Julien
Faire arriver les emails Vestiaire : dans iCloud.com → Mail → Réglages → Règles, ajouter une règle
« Si l'expéditeur contient `vestiairecollective` → Transférer à » **la même adresse que la règle
Vinted** ; puis, si VRM met le premier email Vestiaire en quarantaine (adresse non reconnue),
déclarer et confirmer dans VRM l'adresse « Masquer mon e-mail » que Vestiaire utilise (Paramètres →
Comptes et emails).

## 2 novembre (soir) — Vestiaire comme Vinted et Leboncoin : photo entière, un N° par annonce, ventes et colis à la même forme, bordereau tamponné

Julien (captures du 2 nov., 21 h) : « pour Vestiaire c'est bien, juste c'est beaucoup zoomé sur le produit ; et
pour la vente je veux la même mise en page avec les mêmes fonctionnalités que Vinted, Leboncoin ; je veux un
numéro attribué par annonce et je veux que le titre de l'annonce soit tamponné sur le bordereau. »
Aucune modification de l'extension (tout ce qu'il faut était déjà rangé par la 5.316).

- **Photo entière** : `PhotoVc` est CONTENUE sur fond blanc (`object-fit: contain`), la fiche garde ses
  proportions 4/5 (`.vrm-vc-catalog`, styles-vitrine.css) ; même photo contenue sur les lignes de vente et de colis.
- **Un N° par annonce** (`src/numerosVestiaire.js`, `numeroterVestiaire` dans App.jsx) : identité = `productId`
  (jamais le titre). Pas de N° neuf si l'annonce en porte déjà un : lien posé par VRM à la publication
  (`vc_listings.liens`), référence VRM-n° lue, N° déjà donné. Sinon `prochainLibre` — LE mécanisme de Vinted,
  passé en paramètre — sur TOUS les N° servis (pool, fiches, ventes, liens Leboncoin et Vestiaire, réservés, refs
  lues) : le plus haut + 1, jamais un trou. Rangé dans `main.vrm_vc_numeros` ({ productId: { numero,
  numberedAt, auto } }, synchronisée, **fusionnée comme les fiches** : `CLES_FICHES` — la même annonce numérotée
  différemment sur deux appareils ⇒ conflit, rien écrit) et ajouté au pool append-only. Une annonce retirée n'en
  reçoit pas ; une vente « à expédier » dont l'annonce n'a jamais été lue reçoit le N° de SON produit ; la vente
  hérite du N° de son annonce par `productId` (`numVcVente(v, liens, auto)`, `numVcAnnonce(id, it, liens, auto)`
  dans `api/_lib/vestiaire-regle.js` : lien > référence > N° donné). Tous les lecteurs de l'app passent `auto`
  (`avecNumerosVc`), le widget et les rappels aussi (ils lisent `main.vrm_vc_numeros`).
  ⚠️ Écriture dans `main` (risque mesuré, fait au plus sûr) : rien sans version de la numérotation relue
  (`numerotationPermise`), ni pendant une écriture de numéros en route dans l'onglet (`_saveTimers` du pool,
  des fiches, des ventes ⇒ on repasse 1,5 s plus tard) ; une lecture ratée (annonces, ventes, réservés) ⇒ rien.
  Les N° donnés sont visibles tout de suite (`_vcMem`) et les 4 numérotations automatiques de Vinted les
  comptent (`ajouterNumerosHorsEcran`). Aucune migration, rien sur le localStorage seul.
- **Ventes** : `LigneVenteVc` = `LigneVenteCompacte` comme Vinted (`vrm-sale-row`, `data-tx="vc:…"`,
  « N° · titre », date · « à envoyer avant … », l'étape, ce que Vestiaire verse, Achat · Bénéfice — prix
  d'achat SAISI pour le N° (`vinted_buyprice_by_num`, seulement si ≤ 1 fiche porte ce N°), « Prix d'achat » sur
  la ligne) et le récapitulatif au toucher (frise, l'argent, détails, Imprimer, Colis fait, Fiche de l’article).
- **Colis → À envoyer** : `CarteColisVc` = la carte d'un colis Vinted (`vrm-colis-carte`, `data-bord-card`,
  Imprimer · Imprimé · Colis fait, `data-geste`) ; « Chronopost · suivi … » n'est plus écrit deux fois : la
  pastille transporteur (`PastilleTransporteur`, module transporteurs fusionné en #971) à côté du bouton, le n° de
  suivi seul en texte. « Colis fait » (`main.vrm_vc_colis_done`) sort le colis de « à poster » PARTOUT
  (`colisVcAPoster(d.fait)` : Colis, Ma journée, cloche, widget, rappels) ; « Imprimé » (`main.vrm_vc_imprimes`).
- **Bordereau tamponné** : `imprimerBordereauVc` lit `vc_label_{produit}` au clic et le passe à
  `annotateAndDownloadBordereau` (la fonction de Vinted et Leboncoin : version relue, `confirmerNumerosAVerifier`,
  même cartouche N° + titre) ; la ligne rangée n'est jamais réécrite.

### Preuves (§6)
- `scripts/audit-numeros-vestiaire.cjs` : 25 verts (50 annonces au même titre ⇒ 50 N°, plus haut + 1, relue
  garde, jamais redonné, la vente prend le N° de son annonce partout, lien/référence d'abord, titre jamais lu,
  retirée/annulée) ; `--mutations` 7/7 tuées (N° donné oublié, lien oublié, identité par titre, trou comblé, vente
  sans N° d'annonce, retirée numérotée, numérotation Vinted aveugle aux N° Vestiaire).
- Banc `scripts/bancs/vestiaire-parite.cjs` (données inventées, 390 tactile clair + 1512 sombre) : 68 verts ; le
  PDF produit est relu par pdf.js (titre et N° dedans). pdf.js 3.11 n'est pas téléchargeable ici : le banc sert la
  pdfjs-dist du dépôt en `window.pdfjsLib` (BANC_PDFJS_DIR prend la 3.11 si on l'a).
- Bancs `vestiaire-colis` et `vestiaire-fiches` remis à la règle (« sans référence ⇒ pas de N° » devient « un N°
  neuf », le montant SÛR s'affiche), `vestiaire`, `recap-vente` verts.

### Ce qui reste / à décider
- Une paire en vente sur Vinted ET sur Vestiaire sans référence VRM-n° ni publication depuis VRM reçoit un SECOND
  N° (aucune identité ne relie les deux annonces) : il faut alors publier depuis VRM ou poser « VRM-n° » dans la
  description Vestiaire. Un « Relier à une paire » à la main (comme Leboncoin) n'est pas fait.
- Les annonces Vestiaire seules n'entrent pas encore au Stock (`vinted_nums_physiques` reste Vinted/eBay/Leboncoin).
- Le bénéfice d'une vente Vestiaire est sur la ligne ; le total « bénéfice » dit toujours « sans N vente Vestiaire ».
- Le serveur (e-mail entrant) ne lit pas `vrm_vc_numeros` pour l'anti double vente immédiate (l'app, oui).
- (21 h 44, Julien : « ce n'est pas toujours une paire, là c'est un sac ») Sur les écrans touchés (annonces,
  publier, ventes, colis Vestiaire) : « article », jamais « paire » ; aucune taille ni catégorie supposée.
  Disent encore « paire » (pas touchés ici) : Messages Vestiaire (« Conversation pas reliée à une paire »,
  « Pas reliée à une paire »), la cloche (« N paires vendues …, encore en ligne sur Vestiaire »), l'écran
  Leboncoin (« La vente Vestiaire désigne cette paire… »), `LIB_KO` (« pas reliée à une paire »).

## 3 novembre — 5.317.0 : les messages Vestiaire enfin captés (la messagerie passe par « Stream »)

Julien (3 nov., 10 h 02) : « les messages Vestiaire ne marchent pas, ils ne sont pas captés, même avec la
dernière extension » (5.316.0 installée : `vc_envoi.ver` = 5.316.0).

### Ce que la base montrait (lecture seule, 3 nov. vers 10 h, noms de clés et hôtes)
- `vc_messages` : seulement `compteur` (0 non lu, relevé à 08 h 56) — **aucune** conversation ; **0 ligne
  `vc_fil_*`** ; **pas de `vc_session`** (Vestiaire ne charge jamais `/users/me` : `compte` vide partout).
- `vc_brut_*` (capture 5.315) sur la page `/chat/` : `GET apiv2…/chat/user/token` ⇒ `{ data: { userToken: {
  token, provider: 'stream', expirationDate } } }` ; `POST apiv2…/chat/channel/` ⇒ `{ data: { id:
  '{acheteur}-{article}', type: 'chat_channel', buyer, seller, product: '{article}' } }` ;
  `notification-feed?category=messages` (et `/v2`) ⇒ `data[]` de cartes `{ id, date, status: 'read', tapped,
  category: 'messages', eventType: 'chat_message_new', cardTypeV2: 'chat', senderId, senderName,
  textBody, productLink: { meta: { type: 'chat', data: { id: '{acheteur}-{article}' } } }, productTitle,
  productPicture: { url }, profilePicture, lastChatMessage }` (24 cartes, une par conversation) ;
  `negotiations?role=seller&withEvents=true` (les offres).
- `vc_recon.hotes` : **`chat.stream-chat.com` × 14** — la page parle à la messagerie Stream (Stream Chat),
  par fetch/XHR (c'est `noteVu` qui l'a compté : l'enveloppe de `vc-inject` VOIT ces requêtes).
- `vc_envoi` : `{ appris: false, chemin: '/chat/channel/', raison: 'texte-introuvable' }` — l'OUVERTURE
  d'une conversation prise pour un essai d'envoi.

### La cause (mesurée)
1. Les conversations et leurs messages ne viennent PAS de vestiairecollective.com mais de
   `chat.stream-chat.com` : `vc-inject.js` ne lisait que `DE_VC` ⇒ rien.
2. La seule liste sur vestiairecollective.com (le fil des notifications « messages ») était écartée exprès
   (`noteMessages` : `/notification/` exclu ; 5.238 : « jamais le fil des notifications »).
3. `/users/me` jamais chargé ⇒ compte ouvert inconnu ⇒ « de toi » et « non lu » impossibles à dire.
4. `POST /chat/channel/` notait un faux « essai d'envoi » (texte-introuvable).
Ni une autre enveloppe (5.314), ni une WebSocket seule, ni un iframe, ni le compte VRM, ni une écriture
refusée : la ligne `vc_messages` est bien écrite (compteur à jour à 08 h 56).

### Ce qui est fait (extension 5.317.0)
- `vc-inject.js` (aucune requête de plus, aucune permission ajoutée — c'est la page qui parle à Stream) :
  - `noteStream` : réponses 2xx de `*.stream-chat.com` / `*.stream-io-api.com` — `POST /channels` (la liste :
    `channels[].channel`, `messages`, `read`), `POST /channels/{type}/{id}/query` (une conversation ouverte),
    `POST /channels/{type}/{id}/message` (un message que TU envoies). Par conversation : identifiant,
    article (`channel.product`, sinon la forme mesurée `{acheteur}-{article}`), « non lu » = la ligne `read`
    du COMPTE OUVERT (`unread_messages`, sinon `null`), aperçu ; un FIL par conversation (texte, date,
    « de toi » = `user.id` du message = compte ouvert ; supprimé ou sans texte ⇒ écarté). Jamais un nom,
    un avatar ; les réponses Stream ne sont PAS gardées brutes (`vc_brut_*` reste vestiairecollective.com).
    Forme inconnue ⇒ « forme inconnue » (`inconnu`), `{channels: []}` ⇒ liste vide, 4xx ⇒ rien.
  - `noteMoiStream` : le compte ouvert = le `user_id` que la page met dans l'adresse de chaque requête Stream
    (chiffres seulement), jamais à la place d'un `/users/me` lu dans le document ; `vcmoi { source: 'stream' }`
    ⇒ `vc_session.source = 'stream'`.
  - `noteFluxMessages` : le fil des notifications « messages » ⇒ une conversation par carte `type: 'chat'`
    (la plus récente gagne) : aperçu `lastChatMessage`, date, « de toi » par `senderId` si le compte est su,
    « lu » SEULEMENT si `status: 'read'` ou si c'est ton message (autre mot ⇒ pas su), titre et photo de
    l'ARTICLE (`productTitle`, `productPicture.url` sur images.vestiairecollective.com/produit/) ; jamais
    `senderName`, `contactName`, `profilePicture`.
  - `noteCanal` : `POST /chat/channel/` ⇒ la conversation et son article (sans acheteur ni vendeur).
  - Recette d'envoi : `/chat/channel/` et `/chat/user/` ne sont plus des « essais » ; un envoi vu sur Stream
    est noté **pas rejouable, raison `messagerie-stream`** (le corps porte un identifiant fabriqué par la page
    et le jeton Stream voyage en en-tête : rien n'y est sûr à refaire). « Envoyer sur Vestiaire » reste
    fermé — Julien répond sur Vestiaire, sa réponse rejoint le fil dans VRM.
- `vc.js` relaie `titre`, `photo`, `source` des conversations et `source` du compte ; `background.js` les range
  (`vc_messages.conversations[*].titre/photo/source`, `vc_session.source`) et accepte la recette Stream
  (pas rejouable seulement ; une rejouable n'est jamais remplacée).
- App (Messages → Vestiaire) : sans référence VRM, la ligne montre le TITRE et la PHOTO de l'article (affichage
  seul, jamais une identité) ; « Pas reliée à un article VRM » ; la raison `messagerie-stream` est dite en
  français ; l'ancien faux essai `/chat/channel/` n'est plus présenté ; `EXT_CAPACITES.vcfil` = 5.317.0.
- Versions : `CODE_VERSION`, manifeste, `CAPTEUR_VERSION` (lbc-inject.js), `relaisVersion` (lbc-relay.js),
  `EXT_ATTENDUE` = 5.317.0 ; zip régénéré (un dossier).

### Preuves (§6)
- `scripts/audit-vc-messages.cjs` (M1-M9, 38 contrôles ; VRAI vc-inject.js → VRAI vc.js → VRAI background.js
  dans `_fond-vm.cjs`, réponses FABRIQUÉES : la forme du fil des notifications et de `/chat/channel/` est
  celle MESURÉE ; celle de Stream est celle de son API REST documentée — jamais vue chez lui, à relire dans
  `vc_messages.forme` après son passage). Code d'avant (`origin/main`) : **33 rouges**. `--prouve` : **16/16
  mutations tuées** (hôte Stream ignoré, fil des notifications écarté, user_id non numérique accepté,
  `/users/me` écrasé, non-lu deviné, « lu » deviné, message supprimé gardé, forme inconnue = liste vide,
  erreur lue, `/chat/channel/` pris pour un envoi, Stream rejouable, fond qui refuse la recette Stream, titre
  perdu, compte de la page pris sans l'onglet, titre/raison absents de l'app).
- Banc `scripts/bancs/vestiaire-messages.cjs` : + 3 parcours « messagerie Stream (5.317) » (390 tactile et
  1512 : titre et photo de l'article, fil lu, raison en français, aucun envoi ; ancien faux essai
  `/chat/channel/`) — 9 KO sur l'app d'`origin/main`, vert après. Captures regardées.
- Verts : `audit-vc-conversations`, `audit-capture-vc-lbc`, `audit-lbc-vc-lecture`, `audit-coherence`,
  `audit-extension-zip`, `audit-fiabilite-annonces`, `audit-vc-publier`, `audit-secrets`,
  `audit-vestiaire-partout`. Rouge IDENTIQUE sur `origin/main` (pas de ce chantier) : `audit-vc-recon`
  (2 contrôles « rien ne quitte la page » contredits par la capture brute voulue de la 5.315).

### Limites (dites)
- Un message arrivé PENDANT que la page est ouverte vient par la WebSocket de Stream, que l'on n'écoute pas :
  il est rangé au prochain chargement de `/chat/` ou à l'ouverture de la conversation (le compteur de non-lus,
  lui, est relu par la page).
- Un message photo seule n'a pas de texte : il n'est pas rangé (comme avant).
- Si Vestiaire ne passe pas `user_id` dans l'adresse Stream, le compte reste inconnu : « de toi » et
  « non lu » restent « pas su » (jamais devinés).
- Répondre depuis VRM n'est pas possible tant que la messagerie est Stream (refus dit, rien ne part).

### Geste de Julien
Installer la **5.317.0** (remplacer le dossier, ⟳ dans chaque Chrome), puis sur vestiairecollective.com
(même Chrome) ouvrir la **messagerie** (`/chat/`) et une conversation. Ensuite VRM → Messages → Vestiaire.
Pour vérifier (lecture seule) : `vc_messages.conversations`, `vc_messages.forme`, `vc_fil_*`, `vc_session.source`.
