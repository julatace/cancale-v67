# 11 nov. — Achats Leboncoin, eBay, Vestiaire par e-mail (lot `achats-auto`)

Demande de Julien (validée) : les achats Leboncoin, eBay et Vestiaire entrent tout seuls, comme
ceux de Vinted, à partir des e-mails de confirmation de chaque plateforme.

## ÉTAT À LA REPRISE (reprise du 11 nov., soir — FAIT)

**Livré sur `claude/achats-auto`** (rien sur `main`, aucune écriture dans la vraie base).

### Ce qui est fait
- **Règle serveur pure** `api/_lib/achats-email.js` : `lireEmailAchat(mail, texte, emailAt)` ⇒
  `null` (pas un achat : le flux d'avant continue) · `{ ok:false, aVerifier, raison, lecture }` · `{ ok:true, achat }`.
  - Reconnu = expéditeur OFFICIEL (domaine exact `@…leboncoin.fr`, `@…ebay.fr|com|co.uk|de|it|es|be|ch`,
    `@…vestiairecollective.com` ; un faux domaine `leboncoin-securite.com` ⇒ `null`) **ET** un sujet d'achat
    (confirmation · expédition · annulation · remboursement). Un sujet de VENDEUR (« vous avez vendu »,
    « vient d'être vendu », « votre acheteur », « expédiez », « mis en vente », « offre reçue ») ⇒ `null`.
  - Identité = n° de COMMANDE derrière son libellé (« N° de commande », « Numéro de commande »,
    « Référence de commande », « Commande n° », « Order number », « N° de transaction »). Aucun ⇒ à vérifier ;
    deux différents ⇒ à vérifier. Jamais le titre.
  - Montants derrière leur libellé, en euros : article (« Prix de l'article », « Sous-total »…), port (« Frais de
    port/livraison », « Livraison », gratuit = 0), protection (« Protection acheteurs », « Frais de service »,
    « Frais d'authentification »…), total (« Total », « Total payé », « Montant total »…). Deux valeurs pour un
    libellé, une autre devise (£ $ GBP USD CHF), ou un total ≠ article + port + protection ⇒ à vérifier.
  - Titre = libellé « Article / Objet / Annonce / Produit : », sinon ce qui suit « : » dans le sujet (affichage).
    Photo = UNE image du CDN du site (`img.leboncoin.fr`, `i.ebayimg.com`, `images.vestiairecollective.com`,
    tailles eBay fusionnées, logos écartés), sinon rien. Suivi = libellé « N° de suivi » seul, rangé dans la
    MÊME ligne (relié par le n° de commande). Date = « Date de commande : JJ/MM/AAAA », sinon la date de l'e-mail.
  - **Un e-mail TRANSFÉRÉ** (« TR: », « Fwd: », en-tête de transfert) n'a pas d'expéditeur officiel lisible :
    toujours « à vérifier », sa lecture (site de l'en-tête « De : » transféré, n°) est gardée.
  - `fusionAchatEmail` : remplit les vides, ne remplace jamais une valeur connue (désaccord noté dans
    `desaccords`), même Message-ID ⇒ rien ; `annule` / `rembourse` posés et collants.
- **Route** `api/email-inbound.js` : `traiterAchatEmail` appelée (a) dans le bloc Vestiaire APRÈS vente et
  autres formes, juste avant « forme pas encore apprise », (b) avant `0a)` pour Leboncoin, eBay et les
  transferts. Le vendeur est déjà décidé par l'adresse de RÉCEPTION (quarantaine neutre inchangée, en amont).
  - lu ⇒ `modifierCas('achat_email_{site}_{n° normalisé}')` (UNE ligne : rejeu, deux e-mails, deux adresses) ;
    réponse `type:'achat-site'` ; aucun texte brut, aucune adresse dans la ligne.
  - à vérifier ⇒ `achat_email_verif_{site}_{empreinte}` (raison + lecture) ET l'e-mail ENTIER (`garderInconnu`),
    réponse `garde:true` (l'index des e-mails le range « à vérifier »). Rien créé.
  - écriture ratée ⇒ 503 (rejeu).
  - Journal des e-mails : `resume-email.js` (`achat-site`, `achat-a-verifier`) et `src/journalEmail.js`
    (« Achat eBay : … · commande n° … », « Gardé entier, aucun achat créé »). ⚠️ Ces phrases suivent la forme
    du fichier (français, pas encore `tr()` — tout `journalEmail.js` est dans ce cas).
- **App** : `src/achatsAuto.js` (pur) + carte `src/AchatsParEmail.jsx` (« Achats lus dans tes e-mails »,
  écran Achats, au-dessus des achats hors plateforme ; repliée ; textes `tr()` en 5 langues).
  - **Décision (dans l'esprit de §2.5)** : le serveur n'écrit jamais `main`, et rien n'entre dans « dépensé »
    sans SON clic : « Ajouter à mes achats » crée UNE entrée `vinted_offvinted_buys` (ref = n° de commande,
    prix lu = total payé « 51,50 », `prixSource:'email'`, port et protection gardés à part, `achatEmail`) ;
    un achat déjà saisi à la main avec le même n° (`refAchat`, la règle des achats en double) est « relié »,
    « Compléter » ne remplit que SES vides (son prix gagne). Annulé / remboursé : dit, aucun bouton.
  - Lecture ratée ⇒ « — » + raison, jamais « aucun ». Rien reçu ⇒ la carte ne s'affiche pas.

### Preuves
- `node scripts/audit-achats-email.cjs` : **36 verts** (exécute la vraie route, e-mails INVENTÉS ; C confirmations
  3 sites, D rejeu/2e e-mail/valeur jamais remplacée, X annulation/remboursement, V8 cas « à vérifier » dont le
  transfert gardé entier, N vendeur/faux domaine/autre e-mail/vente Vestiaire, E 503, A règle de l'app dont
  50 achats au même titre ⇒ aucun relié). **Rouge sur l'avant** (38348f9 : 6 ✅ · 23 ❌ — l'e-mail eBay y était
  pris pour un reçu Vinted). **Mutations** rougies : garde des deux n°, garde du transfert, remplacement d'une
  valeur connue, deux valeurs d'un libellé, total qui ne colle pas, autre devise, `!famille`.
- Les 58 audits qui exécutent `email-inbound` : tous verts. Audits du socle : verts. Build vert.
- Banc `scripts/bancs/achats-email.cjs` (390 tactile, 1512) : **20 OK**, captures regardées (titre sur deux lignes au téléphone, aucun débordement, cibles ≥ 44 px). Le motif « à vérifier » vient du serveur en français (pas encore `tr()`).

### Ce qui reste
- **Les formes sont SUPPOSÉES.** Aucun vrai e-mail d'achat Leboncoin / eBay / Vestiaire n'a été vu.
  Le premier vrai de chaque site sera probablement « à vérifier » (ou « aucune règle ») : le relire dans
  `email_inconnu_*` / `achat_email_verif_*` et ajuster les sujets / libellés, puis ajouter sa forme
  (anonymisée, inventée) à l'audit.
- « À retirer » depuis `vrm_colis_retirer` (le suivi est rangé dans la ligne, pas encore croisé avec Colis).
- Notification à l'arrivée d'un achat lu : pas posée (rien qui sonne sur une forme supposée).

### CE QUE JULIEN DOIT FAIRE pour qu'un premier vrai e-mail soit vérifié
1. Au prochain achat sur Leboncoin, eBay ou Vestiaire, **laisser l'e-mail de confirmation arriver tel quel**
   sur l'adresse que VRM lit (si sa boîte transfère déjà vers VRM, rien à faire).
2. Sinon, **transférer** l'e-mail de confirmation (et, s'il vient, celui d'expédition) à son adresse de
   réception VRM (Paramètres → E-mails). Un transfert n'est **jamais** transformé en achat : il arrive dans
   Achats → « Achats lus dans tes e-mails » → « À vérifier », gardé entier.
3. Le dire à la session suivante : elle relit cet e-mail (lecture seule), ajuste la règle, et ce site entre
   ensuite tout seul.

## ÉTAT D'AVANT (mesure et plan du matin)



La session a été arrêtée à la demande de Julien (le travail continue dans la session principale).
**Aucun code n'est écrit.** Ce qui suit est la mesure faite et le plan tiré du code, prêt à reprendre.

### Fait (mesuré, lecture seule)
- **Vraie base, lecture seule** (`email_inconnu_*`, `email_quarantaine_*`, `email_journal`) :
  **aucun e-mail d'achat Leboncoin, eBay ou Vestiaire n'a jamais été reçu.** On a seulement eBay
  « L'objet … a été mis en vente », des publicités eBay et Leboncoin, « Suppression de vos annonces »
  Leboncoin, et « Nouvel appareil ». Les historiques (`docs/passation/historique-*.md`) n'ont aucune
  forme réelle non plus. ⇒ D'après la demande, **les trois formes sont « pas encore vues »** : préparer
  l'analyseur, et ranger chaque e-mail « à vérifier » sans rien créer.
- Côté serveur (`api/email-inbound.js`, à jour avec #1135) :
  - le bloc Vestiaire `00)` (≈ l. 2327) : vente (`lireEmailVenteVc`) puis autres formes
    (`lireEmailVcAutre`) ; tout le reste part dans `garderInconnu(… 'Vestiaire : forme pas encore apprise')`.
    **Brancher l'achat Vestiaire juste avant ce `garderInconnu`.**
  - Leboncoin et eBay : aucune branche aujourd'hui. Les brancher avant `0a)` (« Commande mise à jour »,
    ≈ l. 2412), après le bloc Vestiaire.
  - Écriture : `modifierCas(id, f)` (`api/_lib/suivi-vinted.js`, comparer-et-échanger sur `data.rev`,
    `null` ⇒ 503 + `marquerEcritureRatee()`) ; id en `[a-z0-9_]` seulement ; clé primaire `(owner,id)`.
  - Banc : `scripts/_faux-inbound.cjs` (fausse base PostgREST de la vraie forme, `recoit(mail)`,
    `panne(id)`), modèle d'audit : `scripts/audit-vestiaire-email.cjs`.
- Côté app :
  - achats saisis à la main = `vinted_offvinted_buys` (dans `main`, le serveur n'y écrit JAMAIS) ;
    champ `ref` = « N° de commande ou de facture » ; doublons par identité déjà dans `src/achatsDoubles.js` ;
    `offBuys` (≈ App.jsx l. 37622) alimente le « dépensé » (`treasury`).
  - Achats par site : `rendreTache('achats')` ⇒ Leboncoin `AchatsLeboncoin` (App.jsx ≈ l. 21933),
    Vestiaire `AchatsVestiaire` (≈ l. 23628, `vc_achats`), eBay `rendreEbay('achats')`.
  - Pastille : `LogoSite` de `src/SelecteurSites.jsx`.
  - « À retirer » : consommer la PUBLICATION `vrm_colis_retirer` (tuples `colis[i][3]` = identité
    `e:{suivi}`), sans toucher Colis. (Option plus profonde, qui touche Colis : un paramètre en plus à
    `indexAchatsAutresSites`, `src/retraitQr.js` l. 220 — à éviter tant que Colis est en intégration.)
  - L'app peut importer `../api/_lib/*.js` (déjà fait par `src/relaisChange.js`…) ⇒ UNE règle.

### Plan retenu (rien de commencé)
1. `api/_lib/achats-email.js` (pur) : `plateformeAchat(mail)` (expéditeur leboncoin.fr / ebay.* /
   vestiairecollective — il choisit la LECTURE, jamais le vendeur) ; `lireEmailAchat(mail, texte, emailAt)`
   ⇒ `null` (pas un achat : le flux continue) · `{ ok:false, aVerifier, raison }` · `{ ok:true, famille
   (confirmation|expedition|annulation|remboursement), forme, achat }`. Sujet d'abord ; garde vendeur
   (« vous avez vendu », « votre acheteur », « expédiez » ⇒ `null`). N° de commande LIBELLÉ seulement,
   deux n° différents ⇒ à vérifier. Prix article / port / protection / total en euros ; autre devise ou
   total qui ne colle pas ⇒ à vérifier. Vendeur = pseudo libellé seul. Photo = UNE image produit du CDN
   du site, sinon rien. Aucun texte brut, aucune adresse dans la ligne d'achat.
   `fusionAchatEmail(cur, lu, at)` : remplit les vides, ne remplace jamais une valeur connue (conflit noté),
   même messageId ⇒ rien ; annulé/remboursé collant.
2. Route : ligne `achat_email_{site}_{n°normalisé}` (rejeu, deux e-mails, deux adresses ⇒ UNE ligne).
   Forme pas encore apprise (cas de TOUTES aujourd'hui) ⇒ `achat_email_verif_{hash}` portant la lecture
   + `garderInconnu` (e-mail entier) ; rien créé. Formes apprises = ligne `achats_email_formes` (lecture
   ratée ⇒ 503), écrite par SON clic « C'est bien mon achat » sur une carte à vérifier (la recette apprise
   de son propre geste, comme `vc_envoi.appris`).
3. App : `src/achatsAuto.js` (pur) `fusionAchatsAuto(manuels, autos)` — un achat à la main de même `ref`
   normalisée est COMPLÉTÉ (vides seulement, son prix gagne), sinon entrée virtuelle `auto_…` avec
   `price` = prix lu, `prixSource:'email'` (« lu dans l'e-mail », corrigeable : la correction matérialise
   l'entrée dans `vinted_offvinted_buys`) ; annulé/remboursé ⇒ dit, et hors coût. Carte « Achats lus dans
   tes e-mails » dans les Achats de chaque site, avec pastille, suivi, « À retirer » lu dans
   `vrm_colis_retirer`, et les « à vérifier ».
4. Preuves §6 : audit exécutant la vraie route avec e-mails INVENTÉS (jamais un vrai), rouge sur l'avant
   + mutation ; banc 390/1512 regardé ; `tr()` pour tout texte ; `src/nouveautes.js` ; ligne §9.

### Pièges
- Les formes sont SUPPOSÉES (aucun e-mail réel) : ne jamais créer d'achat sur une forme non apprise ;
  le premier vrai e-mail de chaque site doit être relu (`email_inconnu_*`) avant d'ajuster l'analyseur.
- Le serveur n'écrit jamais `main` (donc jamais `vinted_offvinted_buys`).
- Vestiaire : les sujets de VENTE portent « (#n°) » — la branche achat passe APRÈS vente et autres formes.
- 12 fonctions `api/` au plus : tout dans `api/_lib/`, aucune route nouvelle.
