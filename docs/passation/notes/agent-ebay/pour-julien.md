# Ton agent eBay : ce qu'il fera, ce qu'il te demandera

*11 octobre 2026. Le détail technique est dans `spec-finale.md`.*

## Tout de suite (2 minutes)

1. **Retire de la vente sur eBay l'annonce « Autry reelwind beige taille 36 »
   (120 €)**, si elle y est encore. La paire est vendue sur Vinted depuis le
   10 octobre au soir. VRM ne l'a pas vu, et c'est le premier défaut que l'agent
   corrige. Dans VRM, cette paire s'appelle maintenant **N°1** (avant : 553).
2. Dans VRM → eBay → Annonces, **relie à sa paire ton annonce qui n'a pas de
   numéro**. Sans ce lien, aucune protection ne la voit.

## Ce qu'il fera tout seul, même VRM fermé

- **Il voit chaque vente eBay et fait sonner ton téléphone** : le numéro de la
  paire, le prix, la date limite d'envoi, et si elle est encore en vente sur
  Vinted ou Leboncoin. Quand il ne le sait pas, il le dit.
- **Il range la vente** dans Colis, Ma journée et le widget. Si l'acheteur
  demande l'annulation, il affiche « Ne poste pas ».
- **Le soir, un seul bouton : « Imprimer la journée ».** Tu as d'abord la liste
  des cartons à aller chercher, dans l'ordre de tes étagères. Ensuite viennent
  tous tes bordereaux Vinted et eBay, un par feuille, avec le numéro.
- **Il suit chaque colis jusqu'au client** : parti, au relais, livré. Il te
  prévient si un colis n'est pas scanné en 48 h, s'il bloque ou s'il revient. Il
  garde la preuve de livraison, en cas de litige.
- **Il refuse de mettre sur eBay une paire déjà vendue ailleurs.** Si tu
  l'allumes, il retire aussi d'eBay une paire vendue sur Vinted.
- **Il note dans un journal tout ce qu'il fait en ton nom**, avec le texte exact
  et le prix exact. Tu peux tout relire.

## Ce qu'il te demandera

- **Le bordereau, quand eBay impose le sien** (c'est sans doute ton cas) : un
  clic dans eBay par vente. En France, aucun programme ne peut l'acheter à ta
  place. Conseil : achète-le le soir, au moment d'imprimer. Dès qu'il est acheté,
  l'acheteur ne peut plus annuler simplement.
- **Imprimer, et déposer les colis.**
- **Tout ce qui coûte de l'argent ou ne se défait pas, c'est toi qui l'allumes.**
  Ça vaut pour trois choses : le bordereau payé par VRM (seulement si eBay laisse
  le choix), les messages aux acheteurs et les baisses de prix. Au début, l'agent
  fait seulement **semblant** : il écrit ce qu'il aurait fait, et tu compares.
  Chaque geste a des plafonds par jour et par mois.
- **Ton mot de passe VRM pour cinq réglages sensibles** : les clés d'un
  transporteur, le passage en vrai, un plafond plus haut, ton adresse
  d'expédition, le texte d'un message. Si quelqu'un vole ta session, il ne
  peut pas les changer.
- **Relier une vente Vinted** que VRM n'arrive pas à rattacher à une paire. En
  attendant, il bloque la mise sur eBay des paires de ce compte.

## Ce qu'il ne fera jamais, et pourquoi

- **Toucher à Vinted** (une annonce, un prix, un message) : c'est ce qui fait
  bloquer les comptes.
- **Accepter une offre**, sauf par le seuil que tu poses toi-même sur une
  annonce eBay.
- **Deviner une paire, un point relais, un poids ou une catégorie.** Un blanc
  vaut mieux qu'une erreur : une erreur, c'est la mauvaise paire envoyée.
- **Mettre un lien, un téléphone ou le nom de Vinted dans un message à un
  acheteur** : eBay peut suspendre le compte pour ça.
- **Rembourser, accepter un retour, annuler une commande** : c'est ta décision,
  dans eBay.
- **Te promettre « plus jamais de double vente »**. VRM apprend tes ventes
  Vinted par ton extension, compte par compte, parfois avec des heures de
  retard. L'agent réduit ce délai, il ne peut pas le supprimer.

## Ce que tu fais une seule fois, dans l'ordre

1. Installer l'extension quand je te la livre (garder un seul dossier VRM).
2. Coller sur Vercel deux codes secrets que je te prépare, et **garder une
   copie du premier** dans ton gestionnaire de mots de passe.
3. Dans eBay, **retirer VRM de tes applications autorisées**, puis te
   **reconnecter une fois** depuis VRM. Ta connexion eBay sera alors rangée
   chiffrée, et l'ancienne ne servira plus à rien.
4. Me dire **oui** pour « l'horloge » de l'agent, dans ta base.
5. **Allumer l'agent.**
6. Créer une **clé gratuite** sur le site des développeurs de La Poste, pour
   suivre les colis Colissimo et Chronopost.
7. Dans eBay, allumer **« Automatiser les évaluations »**.
8. Choisir tes messages aux acheteurs. Je te conseille de commencer par « votre
   colis vous attend au relais ».
9. Plus tard, et seulement si eBay te laisse acheter ton bordereau ailleurs :
   ouvrir un compte pro chez Boxtal et faire un essai sans payer d'abord.
10. Avant d'ouvrir l'agent à d'autres revendeurs : **passer Vercel en payant**
    (environ 20 $ par mois), et demander à eBay plus d'appels (c'est gratuit).

## Dans quel ordre ça arrive

1. Une paire vendue sur Vinted ne reste plus en vente sur eBay sans que VRM te
   le dise.
2. eBay dit vrai dans VRM : ta connexion, tes ventes, l'état de la paire
   obligatoire.
3. **Ton téléphone sonne à chaque vente eBay, VRM fermé.**
4. Ta journée et ton impression du soir incluent eBay (Vinted y gagne aussi).
5. Le retrait d'eBay d'une paire vendue sur Vinted se fait VRM fermé, si tu
   l'allumes.
6. Ton chiffre d'affaires eBay devient l'argent que tu reçois vraiment. VRM te
   rappelle de demander ton virement eBay.
7. Les ventes eBay arrivent dans la minute.
8. Chaque colis est suivi jusqu'au client.
9. Les messages aux acheteurs partent, si tu les allumes.
10. Le bordereau est acheté par VRM, mais seulement si eBay le permet sur ton
    compte.
11. Les questions, les retours, les litiges et les prix des paires qui dorment.

## Ce que tu décides (rien d'urgent)

- **Vercel payant** : oui, avant d'ouvrir l'agent à d'autres revendeurs.
- **Une annonce eBay remise en vente exprès** après la vente : je propose que
  l'agent la signale seulement, sans la retirer.
- **Déclarer l'envoi à eBay** : au premier scan du transporteur, pas avant (je
  le conseille).
- **L'offre automatique aux personnes qui suivent une annonce** : non, pour
  l'instant.
- **Les réponses automatiques aux questions** : d'abord des réponses préparées,
  que tu envoies.
- **Un service payant pour suivre Mondial Relay** : à voir après 10 ventes eBay.
- **Une seule clé La Poste** pour tous les revendeurs : oui.
- **Un revendeur qui arrête de payer** : il voit quand même ce qui a été payé en
  son nom, et une annulation de bordereau déjà lancée va jusqu'au bout.
- **Une question pour toi** : ton compte eBay particulier revend-il des paires
  achetées pour être revendues ? eBay demande alors un compte professionnel.
