# Tes gestes, pas à pas (28 octobre)

Trois choses que VRM ne peut pas faire à ta place : elles se font dans tes
comptes (Google, Vercel, Stripe) ou avec tes informations légales.

## 1. Recoller le script Gmail (factures Pro, preuves d'adresse)

Aujourd'hui l'ANCIEN script tourne encore : ses lectures sont refusées, donc
aucune facture Pro et aucun lien de confirmation d'adresse ne part.

1. Ouvre https://script.google.com avec le compte Gmail qui fait suivre les emails.
2. Ouvre le projet du script VRM, sélectionne tout le code et supprime-le.
3. Colle à la place le contenu de `scripts/gmail-forwarder.gs` (dépôt GitHub).
4. ⚙️ Paramètres du projet → Propriétés du script → Ajouter :
   `EMAIL_INBOUND_SECRET` = une longue phrase secrète que tu inventes (au moins 32 caractères).
5. Enregistre. Lance une fois la fonction principale pour autoriser le script.
6. Sur Vercel → projet → Settings → Environment Variables → ajoute
   `EMAIL_INBOUND_SECRET` (Production) avec **la même valeur**, puis redéploie.

L'ordre compte peu : un email refusé n'est pas marqué, le script le renverra.

## 2. Remplir les mentions légales (sinon personne ne peut payer)

Deux fichiers, à remplir sur GitHub (crayon « Edit ») :

- `public/legal/editeur.js` : remplace chaque `null` par ton texte entre
  guillemets **droits** (`"…"`), par exemple `nom: "Julien Fournier (entrepreneur individuel)",`.
  ⚠️ Une apostrophe dans ton texte (« d'Exemple ») casse le fichier si tu
  utilises des apostrophes autour : mets des guillemets droits `"`.
  Les 10 champs : nom, forme, adresse, SIRET, RCS, TVA, email, téléphone,
  directeur de la publication, médiateur de la consommation.
- `src/contact.js` : `CONTACT_EMAIL = 'ton.adresse@…'` (la même que `email` ci-dessus).

Tant qu'un champ manque, Réglages → Mon compte te dit lequel.

## 3. Recréer le prix Stripe à 12,99 €

Un prix Stripe ne se modifie pas, il se recrée :

1. Stripe → Catalogue de produits → le produit VRM → « Ajouter un prix ».
2. 12,99 €, récurrent, mensuel.
3. Options avancées → clé de recherche `vrm_mensuel`, cocher
   « Transférer la clé de recherche depuis un prix existant ».
4. Archive l'ancien prix à 9,99 €.
5. Vercel : vérifie que `STRIPE_SECRET_KEY` est posée (Production).

Tant que le prix Stripe ≠ celui des CGV, VRM garde le paiement fermé (rien
n'est prélevé), et ta carte « Mon compte » te montre les deux prix.
