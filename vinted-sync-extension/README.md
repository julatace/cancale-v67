# Shop Cancale35 — Extension Vinted Sync (v2)

Cette extension tourne **dans ton navigateur** (jamais sur un serveur). Elle fait deux choses :

1. **Capture tes comptes** : elle lit les cookies de session Vinted (jamais ton mot de passe) et les envoie dans ta base Supabase, pour que l'app sache quels comptes sont liés.
2. **Capture passive de tes données** : pendant que tu navigues normalement sur Vinted (ta boutique, tes ventes, tes messages), elle **range les données que Vinted envoie déjà à ton navigateur** dans ta base. **Aucune requête supplémentaire n'est envoyée à Vinted** — c'est ce qui la rend invisible.

> **v3.5 — Boosts.** Quand tu ouvres ton **porte-monnaie / ta facturation** sur Vinted, l'extension capte tes dépenses de boost (remontées d'annonce, mise en avant) et l'app affiche le total dans l'onglet Ventes (bénéfice net plus juste). Pense à **recharger l'extension** (`chrome://extensions` → ⟳) après mise à jour.

> **v3.6 — Points relais officiels.** Quand tu fais un achat et que tu ouvres la **carte de choix du point relais**, l'extension capte la liste que Vinted te propose (autour de l'adresse de livraison) et l'app l'affiche sur sa carte (onglet Achats). C'est LA liste que Vinted utilise, complète — sans OpenStreetMap, sans code de retrait, sans requête en plus. **Recharge l'extension** après mise à jour.

## Pourquoi c'est plus sûr que l'ancienne méthode
Avant, l'app interrogeait Vinted depuis un serveur (IP de datacenter) — visible et suspect. Maintenant, tout part de **ton navigateur, ton IP maison, ta vraie session** : c'est indistinguable de toi qui utilises Vinted.

> ⚠️ Ça ne rend pas un blocage « impossible » (le multi-comptes, l'empreinte du navigateur, une vérif manuelle restent hors de portée du code). Mais côté données, c'est le plus discret possible.

## Installation / mise à jour (une seule fois)

### Sur Mac
1. Télécharge ce dossier `vinted-sync-extension` depuis GitHub (bouton **Code → Download ZIP** sur le dépôt, puis décompresse) et place-le où tu veux (par ex. le Bureau).
2. Ouvre Chrome et va sur `chrome://extensions`.
3. En haut à droite, active **« Mode développeur »**.
4. Si tu avais déjà l'ancienne version : clique **« Supprimer »** dessus d'abord.
5. Clique **« Charger l'extension non empaquetée »** et sélectionne le dossier `vinted-sync-extension`.
6. C'est prêt. Va sur `vinted.fr`, connecte-toi à ton compte : l'extension capture la session.

### Sur Windows
Mêmes étapes : `chrome://extensions` → **Mode développeur** → **« Charger l'extension non empaquetée »** → choisis le dossier.

## Comment vérifier que ça marche
- Clique sur l'icône de l'extension (puzzle en haut à droite de Chrome) : le popup montre les comptes détectés et un bouton **« Synchroniser maintenant »**.
- Ensuite, **navigue sur ta boutique Vinted, tes ventes, tes messages** : c'est en faisant ça que l'extension moissonne les données. Plus tu regardes une page, plus elle est à jour dans l'app.

## Fichiers
- `manifest.json` — déclaration de l'extension (MV3).
- `background.js` — service worker : capture des comptes + rangement des données dans Supabase.
- `content.js` — sur la page Vinted : injecte `inject.js` et relaie ce qu'il capte.
- `inject.js` — observe (sans les provoquer) les requêtes que la page Vinted fait déjà.
- `popup.html` / `popup.js` — petit tableau de bord.
