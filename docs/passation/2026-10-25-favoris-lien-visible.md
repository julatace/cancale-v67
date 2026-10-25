# Favoris 5.225 — lien natif affiché et inspection bornée

Le vendeur confirme après5.224 que la cloche s’ouvre et que la notification choisie est visible, mais pas sa conversation. Son contrôle est `favori_non_trouve`. Cela exclut la cloche comme étape courante du blocage, sans donner la forme du DOM ni l’URL effective.

Défaut reproduit : un lien `display:contents` affiche ses enfants, mais n’a pas de rectangle propre et était rejeté par le détecteur. La reconnaissance accepte désormais ce cas uniquement si un enfant possède une géométrie visible. Les ancêtres inertes ou masqués ARIA restent refusés. L’URL exacte avec tous ses paramètres reste obligatoire. Les liens multiples ne sont pas acceptés arbitrairement ; ils donnent `favori_lien_ambigu`.

Une sonde sans clic fournit quatre compteurs : `liensFavoris`, `memeArticle`, `exacts`, `visibles`. Ils traversent le relais isolé et le contrôle copié après filtrage strict (entiers0..10000, aucune valeur libre). Si le refus continue, ces compteurs distinguent article absent du DOM, URL/paramètres différents, lien masqué et duplication. Le rapport n’expose aucun lien, pseudo, identifiant ou message. Aucun rapprochement par pseudo, aucun retrait de paramètre, aucune navigation directe inventée.

Le défaut display:contents est reproduit sur la source5.224 et corrigé sur fixtures. Sa présence dans la page réelle du vendeur n’est pas établie. Aucun message réel envoyé et aucune session authentifiée observée. Ne pas présenter la5.225 comme réparation certaine de son compte.

Validation ciblée :23 assertions DOM, contrôle de la transmission des compteurs via MAIN/monde isolé, refus des doublons dans le worker, copie filtrée et absence de valeurs privées. Moteur, consignes et archives Chrome/Orion passent ensemble à5.225.0.
