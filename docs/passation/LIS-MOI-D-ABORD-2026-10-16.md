# 🔴 PASSATION — LIS-MOI D'ABORD (mise à jour du 19 octobre 2026)

**Pour le Claude qui reprend VRM.** La session qui a travaillé du 2 au 16 octobre
sur la branche `claude/project-review-nsk5su` a atteint sa limite. Ce fichier dit
ce qu'il reste de SON travail et de SES demandes en cours, **mesuré contre `main`
le 19 octobre**. Le détail (chaque demande de Julien depuis le 2 octobre) est dans
`docs/passation/PASSATION-2026-10-16.md`, à lire avec la mise à jour ci-dessous.

Lis `CLAUDE.md` de **`main`** (pas celui de cette branche : il a 3 jours de retard).
Julien ne veut **pas de questions** : tranche et dis ce que tu as tranché. Il a
autorisé le déploiement (PR vers `main`, merge).

---

## 1. ⚠️ Ce qui a changé depuis le 16 octobre — À LIRE AVANT TOUT

Pendant que cette session s'arrêtait, deux autres agents ont continué **directement
sur `main`** : la branche `claude/agent2-nsk5su` (PR #552 à #582) et des branches
`codex/…`. Le 19 octobre :

| | |
|---|---|
| `main` (production, vrm.center) | **74 commits** de plus que la base commune `416519d` (14 oct.), extension **5.190.0** |
| `claude/project-review-nsk5su` (cette branche) | **76 commits** que `main` n'a pas, extension **5.177.0** |
| recouvrement | `main` a **réimplémenté de son côté** presque tout ce que cette branche faisait (aucun symbole commun : c'est une autre implémentation des mêmes demandes) |

### ⛔ Donc : NE PAS fusionner cette branche dans `main`. NE PAS appliquer les patchs de `docs/passation/wip/` sur `main`.
Ils portent une version d'extension (5.177/5.178) **plus vieille** que la
production (5.190), et des implémentations concurrentes des mêmes écrans : les
fusionner ferait régresser la production. Ils restent une **référence** : on y
lit une idée, une règle, une preuve, et on la **porte** à la main dans le code de
`main` si `main` ne l'a pas.

### Déjà dans `main` (vérifié dans le code et le dossier de `main`, 19 oct.)
- Publication Leboncoin : titre, prix de Vinted, ville, livraison (#536) ; **fiche
  « Publier sur Leboncoin » dans l'app** (5.182) ; booster impossible, publication
  gratuite jusqu'au bout (5.186).
- Plus de saut eBay → Vestiaire (#536) ; **eBay en un clic** : au choix de la
  paire, analyse automatique (catégorie et caractéristiques), état Vinted → état
  eBay, description et prix de Vinted, photos lues par l'extension (`choisirPaire`).
- « Tout imprimer » avec aperçu (#537) ; **tampons et imprimante thermique avec un
  aperçu par type** (17 oct.) ; Colis en lignes fines, la plus récente en haut (#582).
- **Litige / colis de retour hors des « colis à faire »** (`COLIS_DEJA_BOUGE`,
  17 oct.) ; lieux et codes de retrait (Mondial Relay, Vinted Go).
- Nuage qui dit pourquoi (#537) ; comptes « Actif / Banni » relevés par
  l'extension (5.181) ; mode stream (#540).
- **Numérotation** : la synchro de la ligne `main` était cassée depuis la 013 →
  migration 017 (18 oct.) ; le chargement fusionne ; les paires renumérotées par
  la panne sont nommées et reçoivent un numéro neuf d'un clic (#581). Mesuré en
  base le 19 oct. : **52 fiches numérotées depuis le 11 oct., la dernière le
  18 oct.** — la numérotation automatique remarche.
- Réponse automatique Vinted retirée (5.179) ; propositions 17 (2FA TOTP),
  33 (studio photo dans le navigateur), 2 (double vente app fermée, notifiée par
  le serveur), 37 (mode équipe — écran livré, **migration 016 PAS appliquée**).
- Comptabilité : profil fiscal, abonnements, CA par période, Factur-X, Super PDP,
  bénéfice brut et net (#573) ; URSSAF dans Compta.
- eBay après la vente : retours, annulations, promotion, achats (#562).
- Design de la maquette : identité claire puis « ardoise » (#532-#533, #546-#550,
  #571-#577), logo officiel, coque mobile façon iOS, bouton retour (#568).
- Extension sur Firefox, Edge, Opera, Brave et Android (5.188) ; relais du
  téléphone par l'ordinateur (5.183).

---

## 2. Ce qui reste VRAIMENT (absent de `main`, vérifié le 19 oct.)

| # | quoi | d'où ça vient | comment |
|---|---|---|---|
| 1 | **Le colis de RETOUR d'une vente arrivé au point relais doit apparaître dans « colis à retirer »** (Ma journée, Achats), avec le lieu lu dans la conversation ; et la **date limite de renvoi d'un ACHAT en litige** (« Retourne la commande d'ici le … ») en rouge une fois dépassée | plainte du 15 oct. ; `main` a seulement sorti ce colis des « à faire » | **porter** l'idée du patch `wip/1-p1-retours-3-commits.patch` (la conversation porte `event_group return_shipment` / `held_at_post_office`, lien par n° de transaction ; aucun code ni QR pour un retour) ; rapport de mesure : `notes/15oct/retours-litige.md` |
| 2 | **CA eBay = « l'argent que tu reçois »** (`totalDueSeller − totalMarketplaceFee`) | décision de Julien du 3 oct. ; 0 occurrence dans `main` | branche eBay de `ventesDeclarables`/`ventesFaites` ; frais inconnus ou autre devise ⇒ écartée et dite ; régénérer `api/_lib/ventes-regle.js` (`audit-bilan-semaine.cjs --recopie`) |
| 3 | **Les offres reçues en tête de Messages** | régression du 13 oct. ; la règle `offresAtraiter` existe dans `main` mais n'est plus affichée nulle part (elle passait par la cloche, retirée le 17) | rebrancher le bloc « N offres à trancher » dans Messages |
| 4 | **Adresse de réception PROUVÉE** (lien de confirmation) | bloquant avant d'ouvrir VRM à des inconnus | il faut un SMTP (geste de Julien, §4) |
| 5 | Politique **CSP `script-src`** | revue sécurité du 5 oct. | d'abord un banc qui sert `dist/` avec les en-têtes de `vercel.json` |
| 6 | **PDF des bordereaux dans le stockage** (étapes 1 à 4) | 4 oct. | migration 009 sur une branche Supabase d'abord |
| 7 | **Rappel la veille au soir** (proposition 10) | 11 oct. | un 2ᵉ cron Vercel bloque tous les déploiements s'il est refusé : passer par le cron existant |
| 8 | « **Tes connexions** » (voir/couper ses sessions) ; **pointage du stock carton par carton** | construits avant le 12 oct., jamais fusionnés (bundle `branches-locales-2026-10-11.bundle`, table de correspondance dans `docs/passation/README.md`) | refusionner ou réécrire sur `main` ; migration 020+ pour les sessions |
| 9 | Ligne « **mois pas encore connu** » dans le registre annuel pour les ventes sans date de versement | 8 oct. | `main` dit « à dater » ailleurs : vérifier que le registre annuel le dit aussi |
| 10 | **Leboncoin : la catégorie la plus proche** quand rien ne correspond, tout rempli au clic | décision du 15 oct. | `main` a la fiche et `categorieLbcDe` : vérifier sur un vrai dépôt que rien ne reste à remplir à la main |
| 11 | **Mode équipe** : appliquer la migration 016 | `main` dit « PAS APPLIQUÉE » | essai annulé sur une copie, puis sur son accord |
| 12 | Les demandes eBay restantes (pause stock 0, commandes eBay dans Colis, évaluation, qualité, modifier en série, soldes, modèles) | 5-8 oct. | vérifier chacune contre `main` (eBay a beaucoup avancé le 17) avant de coder |

Les **décisions de Julien** à ne pas défaire et les **pièges** sont aux §7-§9 de
`PASSATION-2026-10-16.md` (toujours valables).

---

## 3. Les fichiers utiles de cette branche
- `docs/passation/demandes-julien-2-16-octobre.md` — **toutes ses demandes**, texte intégral.
- `docs/passation/PASSATION-2026-10-16.md` — chaque demande avec son état au 16 oct.
  ⚠️ Beaucoup de lignes « ⬜ / 🟨 » de ce fichier sont devenues ✅ sur `main` depuis
  (voir §1 ci-dessus) : **revérifier contre `main` avant de coder quoi que ce soit.**
- `docs/passation/wip/` — 7 patchs (référence seulement, voir §1) et
  `defauts-relectures-15oct.md` (défauts reproduits par les relecteurs du 15).
- `docs/passation/notes/15oct/` — rapports bruts des mesures sur sa base (retours en
  litige, publication automatique eBay/Leboncoin, P0 du 15).
- `docs/roadmap/` — la demande du 15 oct., son annexe, la matrice de couverture
  (écrite avant tout le travail des 15-19 oct. : à remettre à jour contre `main`).

## 4. Gestes que seul Julien peut faire (à vérifier avant de les lui redemander)
- Installer l'extension la plus récente (**5.190** ou plus), dans UN seul dossier,
  en retirant toute autre copie de VRM (la ligne `panel_diag_capture` de sa base dit
  encore `5.128.0` vue le 2 oct. : elle n'est plus mise à jour, ne pas s'y fier).
- `EMAIL_INBOUND_SECRET` posée sur Vercel ET dans son script Gmail (sinon n'importe
  qui peut envoyer un faux email de vente).
- Supabase : Site URL `https://vrm.center`, Redirect `https://vrm.center/**`, SMTP
  personnalisé, confirmation d'email, protection des mots de passe fuités.
- Stripe : le prix 12,99 € sous la clé `vrm_mensuel` ; les CGV dans Stripe.
- Adresse de contact (`src/contact.js` et `public/legal/editeur.js`).
- Registre URSSAF : noter les mois déjà déclarés.
- Dépôt GitHub en privé ; supprimer les branches `claude/wip-ext-5162` et
  `claude/wip-bilan-lancement` ; supprimer les vieilles tables de sauvegarde avec
  un humain devant l'écran.
