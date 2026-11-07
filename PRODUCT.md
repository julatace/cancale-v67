# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Julien, revendeur de sneakers d'occasion (plusieurs comptes Vinted, plus Leboncoin, eBay, Vestiaire Collective). Il n'est pas développeur. Il utilise VRM autant sur iPhone (au point relais, en préparant les colis, entre deux gestes) que sur ordinateur (Chrome avec l'extension VRM, pour publier, imprimer, répondre). Demain : d'autres revendeurs du même profil (confirmé : « quand il y en aura 1000 »).

## Product Purpose
VRM est l'outil de gestion du revendeur : annonces, ventes, achats, colis à envoyer et à retirer, numéros de rangement des paires, messages, comptabilité (CA, URSSAF). Le succès : il sait à tout moment quoi faire maintenant, sans se tromper de paire, sans rater une date limite, avec des chiffres qu'il peut vérifier.

## Positioning
Un seul endroit pour tous ses comptes et toutes ses plateformes, qui relie chaque vente à la bonne paire physique par une identité (jamais par ressemblance) et qui dit honnêtement ce qu'il ne sait pas (« — », « au moins »), là où les plateformes ne montrent chacune que leur morceau.

## Operating Context
Écrans principaux : Ma journée, Annonces, Ventes, Colis, Achats, Messages, E-mails, Compta, Statistiques, Stock (rangement 3D), Réglages. Gestes réels : imprimer des bordereaux, déposer et retirer des colis (codes de retrait, QR), écrire le N° sur les cartons, répondre aux offres, déclarer à l'URSSAF. L'extension Chrome capte les données Vinted depuis son navigateur.

## Capabilities and Constraints
- Une seule application React (`src/App.jsx`), styles en ligne + couches CSS (`src/styles-*.css`, `src/styles-vitrine.css` en dernier).
- Règles permanentes, refus et règles métier : `CLAUDE.md` (§2, §3, §5) — elles priment sur toute décision de design.
- Trois états partout : en cours · pas su (« — » avec la raison) · valeur lue ; jamais un 0 inventé.
- Cibles au doigt 44 px ; mode sombre choisi par l'utilisateur.

## Brand Commitments
- Style Apple choisi le 2 nov. et reconfirmé le 7 nov. (« garder Apple, en mieux ») : blanc, encre, accent bleu Apple `#0071E3` / `#0A84FF` RARE, police système (SF Pro), chiffres alignés.
- Ton : outil professionnel calme (façon Réglages, Mail, Wallet), confirmé le 7 nov.
- Violet refusé. Ambre = un geste à faire. Rouge = seulement deux paires sous un même N°.
- L'iPhone et l'ordinateur doivent être aussi soignés l'un que l'autre (7 nov.).

## Evidence on Hand
Aucune donnée réelle ne monte dans le dépôt (public). Les bancs (`scripts/bancs/`) et le mode exemple (`src/modeExemple.js`) servent des données inventées. Pas de témoignages, pas de clients : ne rien inventer.

## Product Principles
1. Le prochain geste d'abord : chaque écran dit ce qu'il y a à faire maintenant.
2. Mieux vaut un blanc qu'un faux : jamais un chiffre ou un rapprochement deviné.
3. Une phrase par idée, une couleur rare : le calme est une fonctionnalité.
4. Les deux appareils sont des citoyens de première classe.

## Accessibility & Inclusion
Cibles 44 px, contrastes AA (jetons du 6 nov.), grand texte d'iPhone suivi, mouvement réduit respecté.
