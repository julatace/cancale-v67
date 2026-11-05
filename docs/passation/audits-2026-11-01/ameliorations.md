# VRM — 20 améliorations proposées (1er nov. 2026)

Mesuré sur `origin/main` f04af748 (lecture seule, rien modifié). Classées par **gain réel pour un revendeur** :
temps gagné chaque jour, argent gagné ou perte évitée, erreurs évitées, envie de payer 16,99 €.
Rien de ce qui est refusé au §3 (ni la liste du 11 octobre), rien de ce qui est déjà en correction dans
`audit-final/*.md`. Chaque idée a été cherchée dans le code (grep) pour ne pas proposer un doublon.

| # | Amélioration | Où | Effort | Risque | Retenu 11 oct. ? |
|---|---|---|---|---|---|
| 1 | Ventes hors plateforme (main propre, Insta, dépôt-vente) | Ventes → « + Vente hors plateforme » | moyen | moyen (règles CA + copies serveur) | non (complète « bénéfice réel ») |
| 2 | Tour du stock (inventaire guidé, case par case) | Stock → Meubles / Cases | moyen | faible | non |
| 3 | « Si tu acceptes : bénéfice +18 € » sur la carte d'offre | Messages (offre Vinted), Favoris | petit | faible | non (complète « bénéfice réel ») |
| 4 | Importer son ancien tableur (N°, prix d'achat, date) | Comptabilité → saisie en série ; Bienvenue | moyen | moyen (numéros d'avant le 9 oct.) | non (sert « prix d'achat au numérotage ») |
| 5 | Photo du colis fermé = preuve en cas de litige | Mode emballage → récap de la vente | moyen | moyen (où ranger les photos) | non |
| 6 | Dossier pour le comptable en un seul fichier | Comptabilité → Exporter | moyen | faible | oui (prolonge « récap comptable ») |
| 7 | Publier sur plusieurs sites en un geste | Annonces → fiche d'une paire | gros | moyen (dépend de l'audit A1 Vestiaire) | non |
| 8 | Démarrage instantané (Ma journée affichée avant le chargement) | `index.html` + `journeeHorsLigne.js` | moyen | moyen (chiffres d'avant présentés comme frais) | oui (« app plus rapide ») |
| 9 | Notes de la paire (défauts, longueur de semelle, boîte) visibles dans Messages | fiche du N° → Messages | petit | faible | non (aide « réponses rapides ») |
| 10 | Mode comptoir au point relais | Colis → À retirer / Tournée | petit | faible | oui (prolonge « codes de retrait hors ligne ») |
| 11 | Scanner un colis reçu → son achat s'ouvre | Colis / Achats | moyen | faible | oui (« fiche prête à l'arrivée d'un achat ») |
| 12 | Pastille sur l'icône + raccourcis (appui long) | `manifest.webmanifest`, `sw.js` | petit | à lui demander (proche du widget refusé) | non |
| 13 | Rappel qu'il pose lui-même sur une paire | fiche du N° → Ma journée | petit | faible | non |
| 14 | Premier bilan du vendeur à l'essai | Bienvenue / Ma journée (jour 1) | petit | faible | non |
| 15 | Marges par source d'achat (brocante, Vinted, fournisseur) | Statistiques | petit | faible | non (proche de « ce qui part vite ») |
| 16 | 2 ou 4 bordereaux par feuille A4 | Paramètres → Impression, Colis | moyen | moyen (code-barres coupé) | non |
| 17 | Heures calmes pour les notifications | Paramètres → Notifications du téléphone | petit | faible | non |
| 18 | Page publique « VRM fonctionne ? » | vrm.center/etat | petit | faible | oui (« page tout va bien ? », version abonnés) |
| 19 | Parrainage (un mois offert à chacun) | Paramètres → Abonnement, accueil public | moyen | moyen (Stripe pas encore en réel) | non |
| 20 | Dicter les prix d'achat en série | saisie en série des prix d'achat | petit | faible (pas sur Safari iPhone) | oui (« saisie vocale ») |

---

## Le détail, une idée par ligne

1. **Ventes hors plateforme** — *Sa journée* : une paire vendue en main propre, sur Instagram ou en dépôt-vente se note en 10 secondes, et ça la sort du stock, la met dans « à retirer » de Vinted/Leboncoin/eBay par son N°, et la compte dans le bénéfice et le CA URSSAF (sinon sa déclaration est fausse sans qu'il le sache). *Mesuré* : les achats hors plateforme existent (`SOURCES_ACHAT_HORS`, App.jsx l. 10697), mais `ventesFaites` / `ventesDeclarables` (l. 6237, 6346) ne lisent que Vinted, Leboncoin et eBay ; les factures manuelles (`vinted_invoices`) n'entrent pas dans le CA. *Conformité* : l'identité, c'est le N° qu'il tape (jamais le titre) ; la date et le montant sont les siens, jamais devinés ; il faut refaire les copies serveur (`api/_lib/ventes-regle.js` avec `--recopie`), comme pour l'audit A2 (Vestiaire hors du CA), à faire ensemble.

2. **Tour du stock (inventaire)** — *Sa journée* : une fois par mois, il passe carton par carton, coche ou dicte les N° qu'il voit, et VRM lui sort deux listes : « en ligne mais pas vue dans le carton » (une paire qu'il pourrait vendre sans l'avoir : annulation, mauvaise note, compte surveillé) et « dans le carton mais en ligne nulle part » (de l'argent qui dort). *Mesuré* : le plan du Stock et « Où est la N° ? » existent, mais aucun mode pointage (aucun résultat pour « pointage », « inventaire » guidé). *Conformité* : rien n'est changé tout seul ; « pas vue » ≠ « perdue » (« pas su » reste dit) ; on compare par `cleNum`.

3. **« Si tu acceptes : bénéfice »** — *Sa journée* : sur chaque offre, il voit aussitôt « tu reçois 65 € · bénéfice +18 € (achat 47 € du N° 112) », et un geste « mettre mon mini au prix d'achat », donc il tranche en 2 secondes sans calculer. *Mesuré* : la carte d'offre Vinted (App.jsx l. 46480) montre l'offre et « ton mini », jamais le bénéfice ; eBay dit seulement « sous ton prix d'achat ». *Conformité* : le prix d'achat est lu par identité (`item_id` → N° → prix d'achat), jamais par titre (l'audit A7 corrige justement un conseil tiré du titre) ; pas de prix d'achat ⇒ « — » et le geste pour le saisir ; c'est un calcul, pas un « prix conseillé » (refusé).

4. **Importer son ancien tableur** — *Sa journée* : le vendeur qui arrive avec son Excel (N°, prix d'achat, date) remplit d'un coup ses prix d'achat, au lieu de « Coût d'achat · 1/184 renseigné » ; c'est souvent ce qui fait payer. *Mesuré* : VRM exporte en CSV partout, mais « Coller en masse » ne prend que des N° (l. 32064) ; aucune importation de prix. *Conformité* : ce sont SES prix (règle 2.5 tenue) ; aperçu ligne par ligne, rien n'écrase un prix déjà saisi sans le montrer, rien n'est écrit sans son « Importer » ; un « 230 » d'avant le 9 octobre désigne B230 (013, `numeroExterne`), la règle est à poser avec lui.

5. **Photo du colis fermé** — *Sa journée* : dans le Mode emballage, une photo (paire dans la boîte, bordereau visible) par colis ; en cas de litige « boîte vide / pas la bonne paire », il la retrouve dans le récap de la vente et la fiche « Toute l'histoire du N° ». *Mesuré* : `ModeEmballage.jsx` a 3 cases et le maintien de l'écran allumé, mais aucune photo. *Conformité* : rangée par n° de transaction (identité) ; par défaut sur l'appareil (IndexedDB), car le stockage Supabase est sur le compte de Julien pour tous les vendeurs (à trancher : quota, durée de garde).

6. **Dossier pour le comptable** — *Sa journée* : un bouton « Tout pour mon comptable (2026) » donne un seul ZIP : livre des recettes dans l'ordre des dates, registre des achats, reçus d'achat reliés, achats hors plateforme, charges, factures émises, ce qui a été déclaré à l'URSSAF face au calcul. *Mesuré* : les morceaux existent séparément (rapport PDF l. 45412, `vrm-comptabilite-*.csv`, `charges-*.csv`, suivi URSSAF CSV, e-reporting, factures CSV) ; c'est surtout un assemblage. *Conformité* : jamais « encaissé » (audit-urssaf), couverture affichée (« au moins », les ventes « à dater » nommées).

7. **Publier sur plusieurs sites en un geste** — *Sa journée* : sur la fiche, il coche Leboncoin · eBay · Vestiaire et lance UNE fois ; chaque site part par son propre chemin, qui existe déjà (`publierDepuisApp`, `publierVestiaire`). *Mesuré* : publication site par site seulement (aucun « partout »). *Conformité* : uniquement sur son clic, garde-fous et plafonds de chaque site tenus. À faire **après** la correction de l'audit A1 (Vestiaire hors de l'anti double vente), sinon le risque de double vente augmente.

8. **Démarrage instantané** — *Sa journée* : au téléphone, en ouvrant VRM il voit tout de suite ses colis du jour et ses codes (la dernière photo, marquée « à 14 h 02, mise à jour… »), au lieu d'un écran vide pendant que les 3,16 Mo de code arrivent. *Mesuré* : la photo `journeeHorsLigne.js` existe mais ne sert qu'hors ligne ; le découpage du code est déjà dans l'audit limites n° 21 (ce point est différent : afficher quelque chose AVANT le code). *Conformité* : la photo n'est écrite qu'après une lecture complète, appartient à un seul vendeur, est en lecture seule et datée. Elle ne dit jamais « tout est à jour ».

9. **Notes de la paire dans Messages** — *Sa journée* : « longueur semelle 27,5 cm, petite tache talon gauche, boîte d'origine » est noté une fois sur le N° et s'affiche à côté de la conversation (et s'insère dans une réponse) ; moins de questions, moins de retours « pas conforme ». *Mesuré* : une note interne existe pour les ACHATS seulement (`achatNotes`, l. 43573), rien pour une annonce ni un N°. *Conformité* : rattachée par identité (`item_id` → N°).

10. **Mode comptoir au relais** — *Sa journée* : au relais, un colis par écran, QR et code en très grand, on glisse au suivant, l'écran reste allumé, ça marche sans réseau. *Mesuré* : codes et QR hors ligne existent (`journeeHorsLigne.js`, cache `vrm-hl-qr`), le maintien de l'écran allumé n'existe que dans le Mode emballage. *Conformité* : lecture seule, aucune règle neuve.

11. **Scanner un colis reçu** — *Sa journée* : il scanne l'étiquette d'un colis qu'il reçoit, et VRM ouvre l'achat correspondant (photo, prix payé, reçu) avec « Copier le prix payé pour le numérotage » ; plus besoin de chercher dans 500 achats. *Mesuré* : aucune lecture de code-barres (`BarcodeDetector`, `getUserMedia` absents) ; « fiche prête à l'arrivée » n'a pas été construite faute d'identité, alors que le n° de suivi EN EST une côté achat. *Conformité* : lecture locale (le `BarcodeDetector` du navigateur, sinon une bibliothèque libre chargée seulement quand on en a besoin), sans IA ni clé ; le lien vers la future annonce reste SON clic. Ce n'est pas l'« étiquette de carton avec QR » refusée : on lit l'étiquette du transporteur.

12. **Pastille sur l'icône + raccourcis** — *Sa journée* : l'icône VRM du téléphone porte le nombre de colis à poster aujourd'hui, et un appui long ouvre direct Colis, Codes de retrait ou Emballer. *Mesuré* : `manifest.webmanifest` n'a aucun `shortcuts`, et sa couleur `#21343e` date d'avant Vitrine ; aucun `setAppBadge`. *Conformité* : le nombre vient de `vrm_colis_aposter` (son propriétaire) ; « pas su » ⇒ pas de pastille (jamais un faux 0). ⚠️ Ça ressemble au « widget iPhone enrichi » qu'il a refusé : **lui demander d'abord**.

13. **Rappel posé sur une paire** — *Sa journée* : « Me le rappeler dans 14 jours » sur une paire (« baisser si pas vendue », « relancer l'acheteur ») ; le jour dit, une ligne apparaît dans Ma journée « À faire ». *Mesuré* : aucun rappel personnel (rien pour « me le rappeler » ni `vrm_rappels`). *Conformité* : c'est SON rappel, ce n'est pas un automatisme et rien ne part sur Vinted ; on n'en tire aucune alerte refusée (ni messages sans réponse, ni évaluations).

14. **Premier bilan à l'essai** — *Sa journée (nouveau vendeur)* : après la première lecture complète, une page « Ce que VRM a trouvé chez toi » : annonces, ventes sur 12 mois, CA, paires sans N°, colis à poster, prix d'achat manquants, chacun avec son geste. C'est ce qui donne envie de payer avant la fin des 7 jours. *Mesuré* : la rétrospective « Wrapped » existe (l. 52978, et l'audit D8 corrige son « Julien ») ; rien n'est fait pour le jour 1. *Conformité* : seulement des chiffres lus, la couverture dite, « pas su » si la lecture n'est pas complète.

15. **Marges par source d'achat** — *Sa journée* : « brocante : +38 % · Vinted : +22 % · fournisseur : +12 % » lui dit où acheter. *Mesuré* : Statistiques fait déjà les marges par marque, modèle, taille, plateforme et compte, mais pas par source ; les sources existent dans `SOURCES_ACHAT_HORS`. *Conformité* : seulement les ventes reliées à leur achat par identité ; couverture affichée (« sur 41 ventes reliées »).

16. **2 ou 4 bordereaux par A4** — *Sa journée* : 10 colis donnent 3 feuilles au lieu de 10 ; moins de papier et moins de découpe. *Mesuré* : deux modes seulement, `normale` et `thermique` (l. 9231) ; le mode thermique découpe déjà l'étiquette seule sur les 3 mises en page mesurées, il suffit de les regrouper. *Conformité* : la règle « quand on ne sait pas, la page part entière » est gardée, sinon un code-barres est coupé ; le N° reste tamponné sur chaque étiquette.

17. **Heures calmes** — *Sa journée* : pas de vibration à 2 h du matin pour un favori ; ce qui compte (double vente, code de retrait qui expire) passe quand même, le reste arrive à 8 h. *Mesuré* : 18 catégories de notifications, aucune plage de silence (rien dans `api/push.js` ni dans l'app). *Conformité* : rien ne se perd, on retarde seulement.

18. **Page publique « VRM fonctionne ? »** — *Sa journée (abonnés)* : quand Vinted change quelque chose, ils voient « lecture des ventes Vinted : en panne depuis 10 h, correction en cours » au lieu de croire que leurs données sont fausses. *Mesuré* : `/api/sante` existe, aucune page publique. *Conformité* : aucune donnée de vendeur, seulement des états agrégés ; une sonde qui n'a pas répondu n'est ni un feu vert ni une alerte.

19. **Parrainage** — *Pour Julien* : un abonné qui amène un revendeur gagne un mois, le filleul aussi ; c'est le canal le moins cher dans un milieu où tout le monde se connaît (Discord). *Mesuré* : rien (aucun « parrain », coupon ni code promo). *Conformité* : Stripe seulement (pas d'usage payant sur sa clé) ; à faire **après** le passage de Stripe en mode réel (gestes encore attendus de Julien), et avec une protection contre les faux comptes.

20. **Dicter les prix d'achat en série** — *Sa journée* : il dit « 112, quarante-cinq ; 113, soixante » et la saisie en série se remplit. *Mesuré* : la dictée existe (`MicDictee`, l. 13521) pour la recherche, le modèle et les réponses, pas pour les prix. *Conformité* : c'est le navigateur seul, sans clé (règle 2.9), et rien n'est enregistré avant qu'il valide ; absente sur Safari iPhone (le bouton ne s'affiche pas), donc utile surtout sur ordinateur ou Android, d'où la dernière place.

---

## Écarté exprès (déjà fait, refusé ou déjà en correction)

- **Déjà en production** : prix d'achat au numérotage (G1) et saisie en série, « relier un achat », achats hors plateforme, trésorerie (en attente / reçu), projection du plafond et de la TVA, « à mettre de côté », rappels URSSAF, CFE, rapport comptable PDF/CSV, sauvegarde complète, retour → stock, boost rentable, compte qui vend le mieux, temps de vente, paires qui dorment, baisse de prix en place (Republier, mode réel), dictée (recherche, réponses), codes de retrait hors ligne, Mode emballage, Tournée, recherche en place, double vente app fermée, page d'accueil publique avec démo et prix.
- **Refusé (§3, 11 octobre)** : badge « bonne affaire » sur Vinted (donc pas d'alerte « tu as déjà ce modèle » posée sur les pages Vinted), prix conseillé, étiquettes de carton avec QR, alerte « achat jamais arrivé » ou « argent bloqué », rappels de messages ou d'évaluations, sauvegarde envoyée chez lui, photo d'étiquette → fiche.
- **Déjà dans les audits en correction** : découpage du code (limites n° 21), deux appareils qui s'écrasent (limites n° 1), Vestiaire hors anti double vente et hors CA (flux A1, A2), écrans faux pendant le chargement (limites n° 3, 11), offres acceptées sur une paire vendue (plateformes P2), port eBay (P4).
- **Vu en passant, à signaler** : App.jsx garde un calcul de « prix conseillé » (l. 44757-44766, médiane des ventes au même titre) ; il faut vérifier qu'il n'est plus affiché, puisque le prix conseillé a été refusé le 11 octobre.
