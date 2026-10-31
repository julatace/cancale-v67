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
