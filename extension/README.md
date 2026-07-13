# VRM — Extension Porte-monnaie Vinted

Synchronise automatiquement le solde de ton porte-monnaie Vinted dans VRM.
Dès que tu navigues sur vinted.fr (page Porte-monnaie / Solde), l'extension
lit le montant affiché et l'envoie dans l'app. Aucune action requise.

## Installation (Chrome / Edge / Brave, sur ordinateur)

1. Ouvre `chrome://extensions`
2. Active le **Mode développeur** (interrupteur en haut à droite)
3. Clique **Charger l'extension non empaquetée**
4. Sélectionne ce dossier `extension/`

C'est tout. Va sur vinted.fr → Porte-monnaie : le solde apparaît dans
VRM (Dashboard → 💰 Portes-monnaies) avec l'indicateur ⟳.

## Multi-comptes

L'extension détecte le pseudo du compte Vinted connecté et le fait
correspondre au bon compte VRM (via le pseudo renseigné dans
Paramètres → Comptes). Connecte-toi à chacun de tes comptes Vinted
au moins une fois pour synchroniser tous les soldes.

## Si la base Firebase est verrouillée

Ouvre `content.js` et renseigne `FIREBASE_SECRET` avec la même clé que
dans VRM → Paramètres → Clé secrète Firebase, puis recharge l'extension.

## Annonces

Quand tu ouvres **ton profil** Vinted (ton dressing), l'extension lit tes
annonces en ligne (titre, prix, n° d'article) et les synchronise dans VRM
(Dashboard → 📣 Annonces en ligne). Fais défiler ton dressing jusqu'en bas
pour capter toutes les annonces — le scan s'accumule pendant le défilement.

## iPhone

Les extensions Chrome ne fonctionnent pas sur iPhone. Sur mobile, le solde
est maintenu automatiquement par le script Gmail (paiement reçu = +,
virement banque = −) et se recalibre à chaque visite de Vinted sur ordinateur.
