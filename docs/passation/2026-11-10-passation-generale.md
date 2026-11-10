# Passation générale — 10 novembre 2026 (à lire en premier)

Session d'intégration du 10 nov. sur la branche `claude/youthful-wozniak-v71bap` : une seule
session principale (celle-ci) intègre ; des agents travaillent chacun sur sa branche
`claude/<lot>`, dans un worktree, et la session principale fusionne, vérifie, puis met en
ligne par PR + merge (règle §2.2). Pour l'ancien : `2026-11-09-passation-generale.md`,
puis `2026-11-07-passation-generale.md`. File complète des lots et décisions :
`2026-11-09-file-des-lots.md` et `2026-11-09-propositions.md`.

## 1. Ce qui est en ligne depuis ce matin (vrm.center)

| PR | contenu | récit |
|---|---|---|
| #1088 | fraîcheur redessinée (« N choses à revoir », une rangée par source) ; l'euro ne dépasse plus des widgets ; Republier dans Annonces, Favoris & offres dans Messages (lot AL) | `2026-11-09-navigation-fusion.md` |
| #1089 | À trancher en cartes (photo par identité, ≤ 12 mots, geste sur place annulable) | `2026-11-10-a-trancher-cartes.md` |
| #1090 | Colis propre : logos des transporteurs, plus de doublons, « Votre colis a changé de plan » = changement de point, SMS de colis avec les e-mails | `2026-11-10-colis-propre-logos.md` |
| #1091 | coût réel d'une vente + valeur du stock (emballage = nouveau frais) | `2026-11-10-cout-vente-valeur-stock.md` |
| #1092 | Litiges en cours + retours par modèle | `2026-11-10-litiges-retours.md` |
| #1093 | scan du bordereau en grand + photo du carton fermé | `2026-11-10-photo-colis-scan.md` |
| #1094 | Ma semaine ; Mon adresse VRM (e-mails de transfert) | `2026-11-10-ma-semaine.md`, `2026-11-10-emails-transfert.md` |
| #1095 | colis à retirer irréprochables (97 colis vérifiés en lecture seule ; code par identité avec ses sources) | `2026-11-10-retraits-irreprochables.md` |
| #1096 | textes courts (lot AI) : pastilles ≤ 12 mots, « Pourquoi ? » replié | `2026-11-09-popups-propre.md` |
| #1097 | note privée sur une paire ; achat saisi deux fois | `2026-11-10-note-achat-double.md` |
| #1098 | « Argent » : Compta + Statistiques en une entrée | `2026-11-10-compta-stats.md` |
| #1099 | photo en grand partout (une visionneuse), Achats plus beaux, facture d'achat | `2026-11-10-photos-achats.md` |
| #1100 | frise prouvée d'une vente ; d'où viennent mes achats | `2026-11-10-frise-source.md` |
| #1101 | « Je dépose » + hors ligne au relais ; baisse de prix en série (**extension 5.336.0**) | `2026-11-10-depot-hors-ligne.md`, `2026-11-10-baisse-prix-serie.md` |

Intégrée sur la branche, à mettre en ligne : textes courts suite (Réglages, eBay,
Leboncoin, Vestiaire, Messages, Achats, App) — `2026-11-10-textes-courts-suite.md`.
Correction faite à l'intégration : la consigne de mise à jour de l'extension dans
Réglages doit garder « en un seul dossier » (`audit-extension-zip` la lit mot pour mot).

## 2. Chantiers lancés, pas encore rendus (branches sur l'origine)

| lot | branche | où |
|---|---|---|
| AX recherche universelle | `claude/recherche-universelle` | ⌘K + loupe |
| AM Annonces en grille (+ capture de Julien du 10 nov. 13 h 54 : carte ouverte qui étire la grille, libellés coupés, « Ranger au stoc » tronqué, « V » répété) | `claude/annonces-grille` | Annonces |
| Q factures Pro (envoi auto éteint, à envoyer, avoir, registre + zip) | `claude/factures-pro-2` | Argent → Factures |
| BK + BL mois bouclé, comparer deux mois | `claude/mois-boucle` | Argent → Déclarer / Statistiques |
| BJ + BM + BN dossier litige PDF, vitesse d'envoi, avis Vinted | `claude/vitesse-avis` | Litiges, Argent → Statistiques |

Si la session tombe : regarder ces branches sur l'origine (`git log origin/main..origin/claude/<lot>`),
reprendre la branche dans un nouvel agent (son récit dit ce qui reste), vrai `git merge
origin/main`, vérifier, PR, merge.

## 3. Validés, pas encore lancés

H (.ics + nouvel appareil) · I (marge par plateforme ; les délais de litige sont faits par BB) ·
J (import Excel, partage Photos, aide par écran sans vidéo) · L (calculette d'achat,
historique de prix, stock d'emballages) · N (étapes d'atelier dans Organisation) ·
O (mode vacances, ext. 5.338) · P (clavier + VoiceOver) · R (livre de police) ·
S (factures Pro LBC/eBay/Vestiaire) · T (facture en anglais + seuil TVA) ·
U (annonces à compléter + avis sur chaque vente) · W (inventaire annuel) ·
X (sélection multiple, filtres enregistrés, fiche à côté) · Y (corbeille 30 j) ·
AA (infos sous ses annonces sur vinted.fr, ext. 5.339) · AB (un fil par acheteur et par paire) ·
AH (Siri) · AP (republication à la main attirante) · AR (Communauté formateurs) ·
AT (résumé du soir 20 h) · AV (prix de revente réel par modèle) · K (ouverture légère, en dernier) ·
textes courts restants (≈ 150 : Compta/Comptabilite, Republier, Accueil, FacturePro).
Versions d'extension réservées : 5.337 = G (jauge + journal), 5.338 = O, 5.339 = AA ;
5.340 est libre.

Refusés (ne pas reproposer) : ceux du 11 oct. (CLAUDE.md §3), « Ma liste de recherche »
(9 nov.), objectif par compte, rangement guidé, mode « photo » (10 nov.).

## 4. Les gestes de Julien

La liste ordonnée est `2026-11-10-gestes-ce-soir.md` (12 gestes). Les plus utiles :
installer l'extension **5.336.0** dans chaque Chrome ; `CRON_SECRET` dans les secrets
GitHub ; capture du logo Chronopost (et Colissimo, InPost, Relais Colis) — aujourd'hui ces
sept logos sont leur nom en couleurs ; migrations 029 → 028 → 030 ; relier la boîte qui
reçoit les 17 e-mails « ton achat t'attend » sans compte ; ouvrir sur vinted.fr le compte
des deux achats irlandais « à vérifier ».

## 5. Décisions attendues de Julien

1. Les ≈ 1 780 ventes à dater : tout dater · seulement l'année en cours · les sortir du compte
   (le CA déclaré en dépend — ne pas décider à sa place).
2. « Je dépose » remplace-t-il la « Tournée de dépôt » du 5 nov. ? (les deux restent en attendant).
3. ✅ Réponse de Julien (10 nov.) : « Solo = un compte vendeur par plateforme : oui, et 19,99 pour 10 comptes vendeurs ». Pro (19,99 €/mois) passe de « tous les comptes » à **10 comptes vendeurs** (lu : 10 au total, toutes plateformes — à confirmer s'il voulait 10 par plateforme) : lot BO, `claude/pro-10-comptes`. ⛔ **Annulé à 20 h** : « on fait un nombre de comptes de vente illimité » ⇒ Pro = comptes vendeurs illimités (lot `claude/pro-illimite`, `2026-11-10-pro-illimite.md`).
4. Un seul « Retiré » partout (le mode relais hors ligne n'en propose pas, la liste hors ligne si) ?
5. Factures au téléphone : ranger les cinq boutons d'action dans un menu ?

## 6. Leçons de la journée (pour la session suivante)

- **5 agents en même temps au plus** : au-delà, la limite d'utilisation de 5 h tombe (deux fois
  aujourd'hui). Un agent arrêté par la limite se REPREND par un message (son travail est
  gardé) ; un agent « stopped » (session interrompue) ne se reprend pas : relancer un agent
  neuf sur SA branche poussée.
- Conflits récurrents : `CLAUDE.md` §9 et `historique-divers.md` (chaque lot ajoute une ligne
  et déplace la plus ancienne). Les garder des deux côtés, puis repasser sous 59 000 octets en
  déplaçant telles quelles les lignes §9 les plus anciennes.
- Avant chaque mise en ligne : `npm run build`, audits `variables`, `tdz`, `coherence`,
  `identite`, `icones`, les audits du lot, et son banc (port aléatoire `BANC_PORT`). Un banc
  rouge sur `main` avant le lot n'est pas une raison de bloquer — le dire.
- Un agent qui raccourcit des textes doit chercher l'ancien libellé dans `scripts/` avant de
  le changer : plusieurs audits lisent une phrase exacte (ici la consigne d'installation).
