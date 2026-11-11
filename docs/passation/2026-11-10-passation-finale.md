# VRM — passation finale du 10 novembre 2026 (22 h UTC) · À LIRE EN PREMIER

Écrite à la demande de Julien : « un dossier de passation qui explique le plus précisément
possible ce que j'ai et ce que tu as à faire pour finir l'app ». Deux lecteurs :
**Julien** (parties A, B, C) et **la prochaine session Claude** (parties D, E, F).
Remplace, pour l'état, `2026-11-10-passation-generale.md` et `2026-11-09-passation-generale.md`
(toujours utiles pour l'historique).

---

## A. Ce que tu as aujourd'hui (en ligne sur vrm.center)

Mis en ligne le 10 nov. (PR #1088 → #1121, toutes vérifiées avant mise en ligne) :

| domaine | ce qui marche |
|---|---|
| **Ma journée** | ligne de fraîcheur propre ; widgets (l'euro ne dépasse plus) ; « Ma semaine » (écran + notification du dimanche) ; résumé du soir (une notification, seulement s'il y a quelque chose demain) |
| **Annonces** | grille par compte comme le dressing Vinted (tes 7 corrections) ; Republier dans Annonces (à la main conseillé : kit à copier, photos vers la galerie) ; baisse de prix en série (extension 5.336) ; « Qui dorment » ; note privée par paire ; textes courts |
| **Ventes** | coût réel d'une vente (barre achat · frais · emballage · bénéfice) ; frise prouvée (vendue → versée) ; Litiges en cours + dossier PDF ; retours par modèle ; sélection multiple, filtres enregistrés, fiche à côté (ordinateur) |
| **Colis** | logos transporteurs ; « Tout imprimer » seul ; « changé de plan » = changement de point ; colis à retirer vérifiés (sources, code sûr, 2 codes ⇒ ambre) ; scan du bordereau en grand + photo du carton ; « Je dépose » au relais ; hors ligne au relais ; relecture toutes les 15 min (`CRON_SECRET` posé ce soir) |
| **Achats** | une visionneuse photo ; Achats plus beaux ; facture d'achat jointe ; achat saisi deux fois ; « Revendu combien ? » ; calculette d'achat ; Siri « Ajouter un achat » |
| **Stock** | valeur du stock (au moins … sur N) ; emballages ; inventaire de fin d'année ; Atelier dans Organisation |
| **Argent** | Compta + Statistiques réunies (Résumé · Statistiques · Déclarer · Factures) ; mois bouclé ; comparer deux mois ; d'où viennent mes achats ; vitesse d'envoi ; avis Vinted ; factures Pro (à envoyer, envoi auto ÉTEINT, avoir, registre + zip) ; factures Leboncoin/eBay ; facture bilingue ; alerte seuil de TVA ; livre de police |
| **Partout** | Mon adresse VRM en un parcours 1·2·3·✓ (code Gmail affiché, plus de roue sans fin) ; raccourcis clavier (« ? » pour la liste) et lecteur d'écran ; recherche universelle (identité exacte en tête) ; À trancher en cartes ; corbeille 30 jours ; textes courts (3 séries) |
| **Offres** | Solo 16,99 € = 1 compte vendeur par plateforme · **Pro 19,99 € = comptes vendeurs illimités** (ta décision de ce soir) ; CGV du 10 nov. |
| **Extension** | 5.339.0 servie (jauge 50 actions/h, journal, mode vacances appris sur ton geste, infos sous tes annonces sur vinted.fr, calculette sur l'annonce d'un autre vendeur) |

**Fait par toi ce soir** : `CRON_SECRET` (GitHub + Vercel, vérifié : relecture des colis OK) ·
migrations **028, 030, 024, 025, 026, 027** posées (vérifiées en base) · domaine **recu-vrm.com**
(Cloudflare) · Worker **vrm-reception** + secret `EMAIL_INBOUND_SECRET` (= la valeur de ton script
Gmail) · Email Routing catch-all → Worker · `DOMAINE_RECEPTION=recu-vrm.com` sur Vercel + Redeploy.

---

## B. Ce qu'il te reste à faire toi-même (dans l'ordre)

Le pas à pas détaillé de chaque geste : `docs/passation/2026-11-10-guide-gestes-julien.md`.

1. **Tester la réception** : vrm.center → E-mails → Adresses → « Recevoir tes e-mails Vinted dans VRM »
   → ton adresse doit finir par `@recu-vrm.com` → « Envoyer l'e-mail d'essai » → « Reçu ✓ ».
   Si ça ne passe pas : sur Vercel, mettre `EMAIL_INBOUND_SECRET` = la même valeur que ton script Gmail
   (Apps Script → Paramètres du projet → Propriétés), puis Redeploy.
2. **Installer l'extension 5.339.0** dans chaque Chrome (remplacer le dossier, puis ⟳) et Orion.
   Puis, une seule fois sur vinted.fr : mettre un compte en vacances à la main, puis le rouvrir à
   la main (VRM apprend les deux gestes ; Paramètres → Mes comptes → Mode vacances le dira).
3. **Après l'extension** : migrations **029** puis **023** (Supabase → SQL Editor, copier le fichier
   depuis GitHub → Run). Aucun compte Vinted en double (vérifié) : la 023 passera.
4. **angeled92** (adresse Apple « Masquer mon adresse ») : iPhone → Réglages → [ton nom] → iCloud →
   Masquer mon adresse e-mail → Transférer à → shopcancale35@gmail.com.
5. **Leboncoin** : ouvrir « Mes annonces » sur chaque compte (avec l'extension à jour).
6. **Logos** : m'envoyer une capture des logos Chronopost, Colissimo, InPost, Relais Colis.
7. **E-mails envoyés par VRM (Brevo)** : variables `RELANCES_SMTP_HOTE/PORT/UTILISATEUR/MOT_DE_PASSE`
   + `RELANCES_EXPEDITEUR` sur Vercel (guide, étape 7). Sans ça, aucune facture ni lien ne part.
8. **Ma facture** : Argent → Factures → Ma facture (SIRET, forme, TVA, e-mail).
9. **Pour encaisser** : tes 9 informations légales (`public/legal/editeur.js` + `src/contact.js` —
   envoie-les, je les pose) ; Stripe (prix Solo 16,99 € `vrm_mensuel`, Pro 19,99 € `vrm_pro_mensuel`,
   `STRIPE_SECRET_KEY`, webhook, `STRIPE_PRIX_PRO`) ; relire les CGV (paragraphe Pro).
10. **Supabase Auth** : Site URL, Redirect URLs, SMTP Brevo, confirmation d'e-mail.
11. **Communauté pour formateurs** : migration **032** (Supabase → SQL Editor, fichier `032-communaute-formateurs.sql` → Run), puis Communauté → Groupes → « Créer ma page ».
12. **Facultatif** : migration 016 (mode équipe), préfecture (livre de police, cerfa 11733).

Mis en ligne après la rédaction (10 nov., 22 h–23 h) : annonces à compléter, avis par vente (pas relié, dit), Messages → « Tous » (un fil par acheteur), marge par plateforme, Communauté pour les formateurs (PR #1112–#1114), puis import tableur des achats + aide par écran (#1115), échéances dans l'agenda + alerte nouvel appareil (#1116).

## C. Ce que toi seul peux décider

1. **≈ 1 780 ventes à dater** : tout dater · seulement l'année en cours · les sortir du compte
   (change le CA déclaré ; elles empêchent « Mois bouclé » de dire « prêt »).
2. **« Je dépose »** remplace-t-il l'ancienne « Tournée de dépôt » ?
3. **Un seul bouton « Retiré »** partout (y compris hors ligne) ?
4. **Factures au téléphone** : ranger les 5 boutons dans un menu ?
5. **Comparer deux mois** : compter les paires plutôt que les achats ?
6. **Revendu combien ?** : afficher le prix médian une seule fois ?
7. **Livre de police** : saisir l'identité des vendeurs dans VRM (données de tiers) ou seulement sur l'export ?
8. **Heure du résumé du soir** (aujourd'hui 19 h l'hiver / 20 h l'été).
9. **Messages** : « Tous » par défaut au lieu de Vinted ?
10. **Outils** : l'ancien bloc « Annonces à compléter » — le fondre dans la nouvelle vue ou le renommer ?
11. **Marge par plateforme** : cacher un site que tu n'utilises pas ?

---

## D. Pour la prochaine session Claude : ce qui reste à finir

### D1. Chantiers commencés, travail POUSSÉ mais PAS vérifié (reprendre la branche)

| lot | branche | état | reste |
|---|---|---|---|
| (aucun : tout ce qui était commencé est en ligne au 10 nov., PR #1119) | | | |

Pour reprendre : `git fetch origin && git checkout -B <lot> origin/claude/<lot>`, lire son récit
s'il existe (`docs/passation/2026-11-10-<lot>.md`) et `git log origin/main..HEAD`, finir, vrai
`git merge origin/main`, preuves (banc rouge sur main + mutation, captures regardées), PR, merge.
Les briefs complets des lots sont dans `docs/passation/2026-11-09-file-des-lots.md` et les règles
communes à recopier dans chaque brief sont résumées en F.

### D2. Pas encore commencés

| lot | contenu | note |
|---|---|---|
| K | ouverture légère (cache par `data.rev`) | en dernier ; mesurer avant/après |
| textes courts, 4e série | FavorisVinted.jsx (8, dont « Aucune garantie contre un blocage Vinted » : voir avec Julien), Operations.jsx (9), Communaute.jsx (7), écrans de connexion/installation | chercher chaque libellé dans `scripts/` avant de le changer |
| logos exacts | Chronopost, Colissimo, InPost, Relais Colis, Shop2Shop, GLS, Colis Privé (aujourd'hui « mot-symbole ») | attendre les captures de Julien ; `DESSINS_TRANSPORTEURS` dans `src/transporteursVisuels.js` |
| Vestiaire | facture Pro : l'extension doit ranger `sellerPrice` (prix payé) | nouvelle version d'extension |
| avis datés | l'extension garde un historique daté par capture | nouvelle version d'extension |

### D3. Bancs rouges connus (déjà rouges sur `main`, à remettre au vert)

`reglages` (cherche l'interrupteur « Colis à poster » qui n'existe plus ⇒ le bloc « n'ont pas pu
être lus » est compté deux fois) · `compta-abonnements` (cherche le formulaire d'abonnement sur
Résumé ; il est dans Argent → Déclarer depuis le lot « Argent ») · `stock-annonces` (16–20) ·
`annonces-actions` (A, K) · `annonces-ventes-brouillon` (23) · `carte-stats` (3) · `navigation-tache`
(5, menu « Plus » après Argent) · `annuler-commandes` (K3, K5) · `recherche-universelle` (11) ·
`colis-ventes-instantanes` (6) · `achats-retraits` (8) · `inventaire` étape H (hors ligne) ·
`facturx` (3) · `argent-mois` (journal de Ma journée) · `compta-simple` (« 7,44 € ×3 ») ·
`compta-stats-coherence` B (U1). Audits rouges connus : `audit-photos-vinted` (`<img>` des lots
récents), `audit-rouge-doublon` et `audit-violet` (couleurs FedEx/Relais Colis dans
`src/transporteursVisuels.js`), `audit-coque-parametres` (icônes en double), `audit-achats-export`,
`audit-a-envoyer-preuves` (2), `audit-colis-envoi` (1).

---

## E. L'état exact de la base (vérifié en lecture seule le 10 nov., 21 h UTC)

| migration | état |
|---|---|
| 001–021 (hors 016) | appliquées |
| 016 mode équipe | **non** (facultative) |
| 022 essais gratuits | appliquée |
| 023 un compte Vinted = un VRM | **non** — après la 029 ; aucun doublon aujourd'hui |
| 024 appareils connectés | ✅ appliquée ce soir |
| 025 communauté accompagnement | ✅ appliquée ce soir |
| 026 eBay léger | ✅ appliquée ce soir (en un bloc SANS `concurrently` : l'éditeur SQL enveloppe dans une transaction) |
| 027 aperçu + parrainage | ✅ appliquée ce soir (accès vérifié : les 3 comptes VRM gardent l'accès) |
| 028 Solo/Pro | ✅ appliquée ce soir |
| 029 preuve du compte Vinted | **non** — après l'extension ≥ 5.332 partout |
| 030 Solo par plateforme | ✅ appliquée ce soir |
| 031 | supprimée (Pro illimité) |
| 032 communauté formateurs | **non** — en ligne côté app depuis le 10 nov. 23 h ; sans elle l'écran dit « pas encore activé » |

`app_data` : 11 777 lignes, 85 Mo. Propriétaire de l'installation : `VRM_OWNER_UID` (Vercel).

---

## F. Comment travailler (leçons du 10 nov.)

1. **Agents** : la limite d'utilisation de 5 h tombe vite. 5 à 8 chantiers en parallèle au plus ;
   **chaque agent pousse à chaque commit** (sinon tout est perdu à l'arrêt : 4 chantiers n'avaient
   rien poussé ce soir, sauvés à la main en WIP). Un agent arrêté par la limite se reprend par
   SendMessage tant que la session vit ; après un redémarrage de la session, relancer un agent
   neuf sur SA branche.
2. Règles communes à recopier dans chaque brief : lire CLAUDE.md + la passation + la file des lots ;
   branche `claude/<lot>` poussée à chaque commit ; vrai `git merge origin/main` ; UNE ligne §9 de
   CLAUDE.md (< 59 000 octets, déplacer telle quelle la plus ancienne dans `historique-divers.md`) ;
   peu de texte (≤ 12 mots), DA6 ; identité jamais par ressemblance ; « pas su » ≠ 0 ; banc rouge
   sur main ET par mutation ; captures regardées ; chercher un libellé dans `scripts/` avant de le
   changer.
3. **Intégration** : merger la branche dans `claude/<branche de session>`, régler CLAUDE.md /
   `historique-divers.md` en gardant les deux côtés, `npm run build`, audits `variables tdz coherence
   identite icones` + ceux du lot, banc du lot (port `BANC_PORT` aléatoire), puis PR + merge.
4. Julien n'est pas développeur : une étape à la fois, une capture à la fois ; lui donner le
   **chemin à cliquer**, pas seulement un lien ; ne jamais lui demander de coller un secret dans
   la conversation ; vérifier soi-même ce qu'on peut (SQL en lecture seule, Vercel, GitHub Actions).
