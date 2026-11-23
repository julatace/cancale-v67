# Interface de l’aperçu VRM

L’application reprend la version 11 de l’aperçu validé le 18 novembre. Les quatre feuilles dans `src/designV2/interface/` suivent l’ordre de l’aperçu et entrent dans la feuille Vite, qui porte l’empreinte du build. Le style Apple conserve sa propre palette.

- Achats. Les factures et les reçus gardent leurs actions et adoptent les icônes de l’aperçu. Les passes de retrait affichent la photo de l’article quand la commande fournit l’image, avec navigation entre colis du même relais. Si des codes se contredisent, la passe renvoie vers le détail.
- Annonces Leboncoin. Le choix d’une annonce Vinted numérotée passe par une sélection explicite et reprend le lien par N° ainsi que la lecture du prix d’achat existants. L’étiquette « À retirer » provient de la règle commune qui vérifie la vente et la présence sur Leboncoin.
