# Moteur de recherche et qualité des alertes

## Une correspondance à trois états

Chaque règle rend `oui`, `non` ou `inconnu`, avec la source et l'instant de lecture. Un seul critère obligatoire non respecté rejette l'annonce. Un critère obligatoire inconnu conduit à « à vérifier », pas à « conforme ». Les critères préférés servent au classement après les obligations.

Exemples :
- Article 45 €, plafond 50 €, livraison inconnue : budget total **inconnu**.
- Article 45 € + port confirmé 4 € pour la destination : total connu 49 €.
- Bon prix mais quantité de lot inconnue : ne pas calculer un prix par unité certain.
- « i7 » sans génération : ne pas déclarer que le processeur exact correspond.
- Titre indiquant une boîte et caractéristiques indiquant un appareil : contradiction à vérifier.

Normalisation Unicode, accents, unités et références ; synonymes proposés et modifiables. Prévoir exclusions exactes et expressions, sans transformer une recherche en expression régulière libre coûteuse côté serveur. Tolérance aux fautes facultative, mais jamais sur un identifiant exact, un numéro de série ou une compatibilité imposée.

Un éventuel modèle d'IA peut expliquer une annonce ou proposer des critères, en séparant extraction et déduction. Le texte d'une annonce est une donnée non fiable : aucune instruction qu'il contient ne modifie les règles, le budget ou une action. L'IA ne valide pas seule un paiement, une authenticité ou une compatibilité.

## Identité, cycle de vie et doublons

Clé d'annonce officielle + marketplace + variante si le contrat l'exige. Un même modèle n'est pas une même annonce. Deux articles identiques de vendeurs différents restent deux occasions. Une remise en vente avec nouvel identifiant est distincte, avec rapprochement informatif éventuel, jamais une fusion certaine par titre.

Notification identifiée par utilisateur + recherche + annonce + type d'événement + version de seuil. Une notification ne se recrée pas à chaque nouvelle lecture. Refus conservé jusqu'à une règle de réapparition explicite : baisse sous un nouveau seuil, ou réexamen demandé. Plusieurs recherches du même vendeur peuvent produire une carte regroupée sans lui envoyer plusieurs alertes identiques.

Premier lancement : montrer les annonces déjà trouvées comme résultats initiaux ; ne pas envoyer cent notifications « nouvelles » pour un historique. Une nouvelle annonce signifie « nouvelle pour cette veille » lorsque l'heure d'indexation eBay n'est pas connue. Les deux notions restent distinctes.

## Polling et capacité : d'abord un budget de requêtes

Ne pas annoncer de fréquence minimale tant que le quota, les droits et le coût par méthode ne sont pas connus.

Charge journalière approximative :

`Somme(groupes × lectures/jour × pages/lecture) + détails + relectures avant décision + reprises`.

Exemple purement arithmétique, pas une affirmation de quota : 100 recherches indépendantes relues toutes les 60 secondes représentent déjà 144 000 premières pages par jour, avant pagination et détails. Une même promesse de cadence pour tous serait donc irréaliste sans capacité validée.

- Regrouper les requêtes publiques strictement équivalentes lorsque les contrats autorisent le cache ; paramètres, pays, tri, devise et destination pertinents inclus dans la clé.
- Ne jamais mutualiser les données privées, jetons ou frais personnalisés d'un utilisateur.
- Appliquer ensuite les critères et destinations propres à chaque recherche.
- Ordonnanceur équitable par vendeur et enveloppe de requêtes, avec réserve pour les relectures critiques. Un utilisateur ne peut pas épuiser le quota commun.
- Pagination bornée et couverture affichée. Une recherche trop large propose un affinement ; elle n'est pas annoncée exhaustive.
- HTTP 429 et erreurs temporaires : respecter les indications eBay, temporisation progressive et dispersion. Pas de rotation de comptes ou d'IP pour contourner les limites.
- File persistante, bail de travail, reprise après interruption, traitement idempotent. Ne pas maintenir un processus permanent dans une fonction Vercel qui peut être arrêtée.
- Événements/Feed uniquement si disponibles et autorisés ; pas de prétendu push universel des nouvelles annonces.

## Disponibilité et fraîcheur

Conserver séparément : date annoncée par eBay, première observation VRM, dernière lecture réussie, fin de l'analyse, envoi au canal, réception confirmée si disponible. Une notification push acceptée par un fournisseur ne prouve pas qu'elle a été lue sur le téléphone.

États opératoires : configuration, lecture initiale, active, pause volontaire, capacité limitée, erreur temporaire, autorisation expirée, arrêtée. L'état actif nécessite une observation récente selon la cadence effectivement accordée. Une panne n'efface pas les résultats et ne donne pas « 0 annonce ».

Montrer les critères supportés, non supportés et seulement déclarés par le vendeur. Une annonce correspondant au titre ne prouve pas son authenticité. En cas de port, taxe ou taux de change inconnu, le total est incomplet ; ne pas classer l'annonce comme la moins chère sur un faux total.

## Notifications

Consentement par canal, horaires silencieux et fuseau du destinataire. Respecter la pause et la révocation même si une notification est déjà en file. Une expiration d'alerte utile s'apprécie à l'envoi ; relecture de disponibilité avant de proposer un achat, pas seulement à la découverte.

Canaux : liste intégrée toujours disponible ; push et email facultatifs. Un canal refusé ne crée pas une fausse réussite. Récapitulatif configurable, alerte immédiate soumise au délai réel, regroupement par recherche. Pas de code de retrait, adresse privée ou jeton dans un push visible sur écran verrouillé.

Mesures à publier après pilote : délai p50/p95 de découverte et d'envoi, taux de faux positifs sur résultats annotés, disponibilité des recherches, coût de requêtes par résultat utile, refus/retenus/achats confirmés, déduplication et taux d'erreurs. Le taux d'occasions manquées n'est pas connu sans référence indépendante.
