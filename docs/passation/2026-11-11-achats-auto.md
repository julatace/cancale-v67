# 11 nov. — Achats Leboncoin, eBay, Vestiaire par e-mail (lot `achats-auto`)

Demande de Julien (validée) : les achats Leboncoin, eBay et Vestiaire entrent tout seuls, comme
ceux de Vinted, à partir des e-mails de confirmation de chaque plateforme.

## ÉTAT À LA REPRISE

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
