# Annexe — catalogue historique des idées (fourni par Julien le 15 octobre 2026)

188 entrées (doublons volontairement conservés). Statuts de décision :
**APP-01 et APP-06 EXCLUES** (ne pas réintroduire) · **VISUEL-01 à VISUEL-20
ABANDONNÉES** (ne pas fusionner la refonte `codex/refonte-visuelle-app`) ·
tout le reste « Retenue, mise en œuvre à inventorier ». La priorité actuelle est
eBay et la veille d'achat. Consigne : attribuer à chaque entrée une
fonctionnalité consolidée et son état ; ne supprimer aucune demande parce
qu'elle recoupe une autre (relier les deux au même travail) ; distinguer
sélection de produit et preuve de disponibilité API.

## Premières améliorations fonctionnelles (5)
- FONC-01 Fiabiliser les photos, notamment des articles vendus dont l'annonce disparaît.
- FONC-02 Rapprocher les ventes des paires historiques sans suggérer une paire encore en ligne.
- FONC-03 Conserver conversations, offres et codes de retrait ; répondre via l'extension quand le compte est connecté.
- FONC-04 Préparer les actions eBay, suivre leurs résultats, reprendre les échecs sans réessai aveugle.
- FONC-05 Bénéfice par paire : achat, frais, port vendeur, boosts, remboursements ; inconnus signalés.

## Parcours général de l'app (6)
- APP-01 Une fiche unique par paire — **EXCLUE**.
- APP-02 Accès direct à la conversation, l'offre ou la commande eBay depuis une tâche.
- APP-03 Messagerie plus pratique : recherche, brouillons, codes faciles à retrouver.
- APP-04 Bénéfice plus précis sur toutes les plateformes (frais réels, remboursements, coûts manquants).
- APP-05 Synchronisation compréhensible : dernière lecture par compte, problème précis, bouton pour reprendre.
- APP-06 Nouveau mode d'expédition rapide sur téléphone — **EXCLU**.

## Premières séries eBay (46) — avec la faisabilité observée par Codex le 14 octobre
- EBAY-INITIAL-01 Retours et remboursements — eBay à valider (lecture, droits, états, montants ; aucune action financière automatique).
- EBAY-INITIAL-02 Modification des annonces — déjà partiel (prix, quantité, titre, description, fin ; enchères/variantes limitées).
- EBAY-INITIAL-03 Modifications par lot — VRM (aperçu par annonce, confirmations, séquentiel, résultat individuel).
- EBAY-INITIAL-04 Rapprochement argent, frais, remboursements, versements — eBay à valider.
- EBAY-INITIAL-05 Pagination commandes, messages, offres — déjà partiel.
- EBAY-INITIAL-06 Vérification du résultat des actions de l'agent — déjà partiel.
- EBAY-INITIAL-07 Prix plancher et bénéfice minimum — VRM (coût absent ≠ zéro).
- EBAY-INITIAL-08 Réponses personnalisables — VRM (modèles → brouillon, l'utilisateur envoie).
- EBAY-INITIAL-09 Brouillons de contre-offres — VRM (revalider l'offre avant envoi).
- EBAY-INITIAL-10 Recherche avancée des ventes — VRM.
- EBAY-INITIAL-11 Organisation des photos — déjà partiel.
- EBAY-INITIAL-12 Repérage des annonces qui stagnent — VRM.
- EBAY-INITIAL-13 Contrôle avant publication — déjà partiel.
- EBAY-INITIAL-14 Export comptable eBay — VRM.
- EBAY-INITIAL-15 Vue Aujourd'hui — VRM (pas de notifications supplémentaires, pas de faux compteurs).
- EBAY-INITIAL-16 Historique des prix — VRM (pas de reconstruction des prix jamais capturés).
- EBAY-INITIAL-17 Notes privées par échange — VRM (cloisonnées vendeur/compte/conversation).
- EBAY-INITIAL-18 Comparaison des comptes — VRM (couverture affichée).
- EBAY-INITIAL-19 Frais de publication avant validation — déjà partiel.
- EBAY-INITIAL-20 Contrôle des paramètres de livraison — déjà partiel.
- EBAY-INITIAL-21 Annulation d'une commande — eBay à valider (≠ déprogrammer/terminer).
- EBAY-INITIAL-22 Bilan après opération — déjà partiel.
- EBAY-INITIAL-23 Réservations temporaires — VRM (ne bloque pas une vente eBay).
- EBAY-INITIAL-24 Doublons de référence — VRM (SKU explicite ; titre/photo ne prouvent rien).
- EBAY-INITIAL-25 Suivi des litiges — eBay à valider.
- EBAY-INITIAL-26 Pièces jointes dans les messages — eBay à valider (MessageMedia).
- EBAY-INITIAL-27 Calculateur de contre-offre — VRM.
- EBAY-INITIAL-28 Préférences par compte — VRM.
- EBAY-INITIAL-29 Journal des modifications par lot — VRM.
- EBAY-INITIAL-30 Récapitulatif hebdomadaire consultable — VRM (pas de notification demandée).
- EBAY-INITIAL-31 Contrôle avant expédition — VRM (checklist, aucun nouveau mode d'expédition rapide).
- EBAY-INITIAL-32 Dossier de preuves par commande — VRM (stockage privé).
- EBAY-INITIAL-33 Stock incohérent — VRM (références et quantités explicites).
- EBAY-INITIAL-34 Prévisualisation mobile des annonces — VRM.
- EBAY-INITIAL-35 Colis bloqués — eBay à valider.
- EBAY-INITIAL-36 Modèles d'annonce par produit — VRM.
- EBAY-INITIAL-37 Simulateur de baisse de prix — VRM.
- EBAY-INITIAL-38 Filtres enregistrés — VRM.
- EBAY-INITIAL-39 Comparaison avant/après publication — déjà partiel (GetItem).
- EBAY-INITIAL-40 Historique des négociations — VRM.
- EBAY-INITIAL-41 Variantes incohérentes — VRM.
- EBAY-INITIAL-42 Justificatifs manquants — VRM.
- EBAY-INITIAL-43 Gestion des absences — eBay à valider.
- EBAY-INITIAL-44 Commandes du même acheteur — VRM (aucun regroupement automatique).
- EBAY-INITIAL-45 Délai de vente par catégorie — VRM.
- EBAY-INITIAL-46 Frais des options payantes — déjà partiel (aucun achat automatique).

## Liste de 50 idées eBay
EBAY-50-01 ouvrir une commande depuis une tâche · 02 ouvrir la bonne conversation ·
03 ouvrir l'offre concernée · 04 pages suivantes des commandes avec progression ·
05 plus d'historique de messages · 06 toutes les offres avec échéances ·
07 brouillons de réponse par conversation · 08 brouillons de contre-offre ·
09 rechercher dans les messages · 10 copier les codes de retrait sans perdre les
zéros · 11 modèles de réponse · 12 notes privées · 13 photos jointes aux messages
si eBay le permet · 14 historique des négociations · 15 prix plancher par annonce ·
16 contre-offre selon le bénéfice souhaité · 17 simuler une baisse de prix ·
18 commissions réellement fournies par eBay · 19 bénéfice connu/estimé/impossible ·
20 remboursements dans le résultat · 21 rapprocher ventes et versements ·
22 expliquer prix vendu vs argent versé · 23 export compta ventes et frais ·
24 comparer les comptes · 25 frais connus avant publication · 26 coût des options
payantes avant validation · 27 modifier prix/quantité/titre/description ·
28 modifications par lot avec aperçu · 29 ancien et nouveau prix ·
30 comparer préparée vs publiée · 31 prévisualiser sur téléphone · 32 modèles
d'annonce par type de produit · 33 caractéristiques obligatoires manquantes ·
34 contradictions de taille/couleur · 35 paramètres de livraison · 36 annonces
qui stagnent · 37 délai de vente par catégorie · 38 doublons sur référence
explicite · 39 écarts quantité eBay / stock VRM · 40 réservations temporaires ·
41 commandes d'un même acheteur · 42 liste de vérification avant expédition ·
43 preuves article/colis/dépôt · 44 colis bloqués · 45 demandes de retour et
échéances · 46 litiges et justificatifs · 47 annulation/remboursement avec
confirmation si l'API le permet · 48 absences selon eBay · 49 filtres et
préférences par compte · 50 vue « Aujourd'hui » (tâches, incertains, récap).

## Veille d'achat
- VEILLE-CONCEPT-01 Assistant de veille : article + critères + prix maximum,
  notifications facultatives (ex. Adidas Spezial 42, bon état, 60 € livraison
  comprise). Droits et quotas à vérifier ; livraison inconnue ⇒ budget total non
  confirmé ; aucun achat ni paiement automatique.
- VEILLE-50-01 recherche depuis le lien d'un article · 02 plusieurs modèles ·
  03 marque · 04 taille exacte · 05 plusieurs tailles · 06 couleur · 07 états
  acceptés · 08 mots exclus · 09 plusieurs noms d'un modèle · 10 prix maximum ·
  11 budget livraison comprise · 12 prix article vs coût total connu · 13 pays du
  vendeur · 14 distance si connue · 15 plateformes à surveiller · 16 prix fixe ·
  17 enchères à part · 18 exclure les lots · 19 seulement des lots · 20 nombre
  maximum d'articles · 21 alerte nouvelle annonce · 22 alerte prix sous le seuil ·
  23 immédiat ou récapitulatif · 24 horaires silencieux · 25 pause · 26 arrêt
  quand trouvé · 27 pas de doublon d'alerte · 28 annonce plus disponible ·
  29 pourquoi elle correspond · 30 critères invérifiables · 31 tri coût total ·
  32 tri date · 33 comparer côte à côte · 34 liste « À examiner » · 35 refuser
  une annonce · 36 note privée · 37 partager avec un collaborateur · 38 infos
  vendeur avec source · 39 contradictions titre/taille · 40 sans photos
  exploitables · 41 question au vendeur · 42 offre de prix après confirmation ·
  43 bénéfice potentiel depuis un prix de revente saisi · 44 frais connus ·
  45 prix d'achat maximum pour une marge · 46 budget hebdo/mensuel · 47 alerte
  dépassement de budget · 48 historique et décisions · 49 dernière vérification
  et recherches indisponibles · 50 quelles recherches aboutissent.
- COMPLEMENT-01 tester une recherche avant d'activer ses alertes · 02 resserrer
  une recherche trop large · 03 équivalences EU/UK/US par marque · 04 scénarios
  de prix de revente · 05 budget par marque/catégorie · 06 bénéfice envisagé vs
  réel · 07 motifs de refus · 08 raison précise d'une alerte · 09 mode simulation
  sans notifications · 10 indicateur de fraîcheur et disponibilité vérifiée.

## Vingt dispositions visuelles — ABANDONNÉES (pour mémoire, ne pas implémenter)
VISUEL-01 Liste compacte · 02 Atelier contrasté · 03 Liste business · 04 Grille
de paires · 05 Deux colonnes · 06 Tableau de travail · 07 Liste et détail ·
08 Suivi financier · 09 Chiffres sur le côté · 10 Par compte · 11 Deux files de
travail · 12 Fil d'activité · 13 Catalogue photo · 14 Numéros de rangement ·
15 Par pointure · 16 Filtres visibles · 17 Sélection en lots · 18 Expédition en
priorité · 19 Navigation en haut · 20 Sections sur le côté.

## Idées « achat et rentabilité » de la même conversation (à relier au catalogue)
Budget réservé aux achats · rentabilité avant achat · prix maximal à proposer ·
comparaison neuf/occasion · fourchette de revente prudente/moyenne/ambitieuse ·
fiabilité de l'estimation (nombre et ancienneté des comparables) · détection des
mauvaises références · coût de remise en état · lots (prix et répartition du
coût) · alertes selon la trésorerie · offres à traiter en priorité · comparer
deux offres · historique des négociations · plancher de négociation personnel
(avertissement, sans bloquer) · explication d'une baisse de marge · articles qui
immobilisent l'argent · simulation de déstockage · bilan après revente ·
contrôle avant publication · photo principale à choisir · défauts documentés ·
rangement physique du stock · contrôle du colis · dossier en cas de litige ·
objectif mensuel concret · réservations temporaires · détection des doublons ·
suivi des litiges · pièces jointes · calculateur de contre-offre · préférences
par compte · journal des modifications par lot · récapitulatif hebdomadaire ·
liste de contrôle avant expédition · dossier de preuves par commande · stock
incohérent · prévisualisation téléphone · colis bloqués · modèles d'annonce ·
simulateur de baisse de prix · filtres enregistrés · comparaison avant/après
publication · variantes incohérentes · justificatifs manquants · absences ·
commandes d'un même acheteur · délai de vente par catégorie · frais d'une option
payante · retours et remboursements · modifications d'annonces · lots ·
rapprochement de l'argent · pagination · agent qui vérifie ses résultats ·
photos fiables · rapprochement des ventes · messagerie complète · gestion eBay
complète · bénéfice exact par paire.
