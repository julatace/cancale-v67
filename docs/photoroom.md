# Détourage des photos avec Photoroom

Le détourage (retirer le fond, ne garder que la chaussure sur fond blanc) se
fait avec l'API **Photoroom**, **juste avant** que l'extension attache tes
photos à une annonce **Leboncoin**. Tes photos sur Vinted ne changent pas.
⚠️ **eBay** : la mise en vente passe par l'API d'eBay (`EbayPublier` → `/api/ebay`),
sans l'extension — ses photos partent telles quelles. La brancher serait une
modification de `api/ebay.js`, qui appartient à la session eBay.

Tout le code est en place (4 octobre). Il ne manque que **ta clé Photoroom**,
parce que c'est **ton** compte et que ça t'est **facturé à l'image**.

## 1. Créer la clé et juger la qualité (10 min)

1. Va sur **https://www.photoroom.com/api** et crée un compte (ou connecte-toi).
2. Active l'API : tu obtiens une **clé** (une longue suite de lettres et de
   chiffres). C'est le seul secret dont VRM a besoin — ce n'est **pas** un mot
   de passe, ne me donne jamais ton mot de passe.
3. Tu as **10 détourages gratuits**. Avant de payer quoi que ce soit, essaie-les
   sur **3 vraies paires** : une blanche, une noire, une avec une semelle claire.
   Regarde les lacets, la semelle et le bord de la chaussure. Si un détourage
   mange un lacet ou la semelle, dis-le-moi avant d'activer.

**Le coût** : formule « Remove Background », environ **20 $ par mois pour
1 000 photos** (≈ 2 centimes la photo). VRM ne paie **jamais deux fois la même
photo** : chaque photo détourée est gardée (par son empreinte exacte) dans un
espace privé de ta base.

## 2. Coller la clé dans Vercel (2 min)

1. **vercel.com** → ton projet VRM → **Settings** → **Environment Variables**.
2. Ajoute `PHOTOROOM_API_KEY` = la clé, environnement **Production**.
3. **Save**, puis **Redeploy** (Deployments → … → Redeploy).

Deux réglages facultatifs, au même endroit :

| variable | ce qu'elle décide | sans elle |
|---|---|---|
| `PHOTOROOM_PLAFOND_MOIS` | combien de photos **un vendeur** peut faire détourer par mois | **150** (≈ 3 $) |
| `PHOTOROOM_POUR` | `tous` = les abonnés qui **paient vraiment** (Stripe actif, ou impayé de moins de 14 jours) y ont droit, à tes frais — un compte gratuit, jamais | **toi seul** (`VRM_OWNER_UID`) |

⚠️ Avant de mettre `PHOTOROOM_POUR=tous` : un abonné qui publie beaucoup peut te
coûter plus que son abonnement — c'est pour ça que le plafond existe. Photoroom
est déjà listé comme sous-traitant dans la politique de confidentialité.

## 3. L'allumer dans l'app

**Réglages → Détourer mes photos avant de publier** : *Éteint* (par défaut) ·
*Photo de couverture* (conseillé : une photo par annonce) · *Toutes les photos*.
La carte dit ce que le serveur sait : clé posée ou non, combien de photos ce
mois-ci sur combien. L'extension doit être en **5.156** ou plus.

## Ce que VRM fait (et ne fait pas)

- **Où** : `detourerPhotos` dans l'extension (`background.js`), le seul point où
  passent les photos que l'extension attache (Leboncoin ; et eBay le jour où sa
  publication repassera par l'extension). Le serveur est un mode de
  `api/ai.js` (`?mode=detourage`, rewrite `/api/detourage`) — le plan Vercel
  gratuit plafonne à 12 fonctions, `scripts/audit-fonctions-api.cjs` y veille.
- **L'empreinte d'abord** : l'extension envoie l'empreinte SHA-256 de la photo
  sans la photo ; si elle est déjà détourée, le serveur la rend sans rien payer.
  Sinon elle envoie la photo, le serveur recalcule l'empreinte (une photo ne peut
  pas être rangée sous l'empreinte d'une autre) et appelle Photoroom (fond blanc,
  JPEG).
- **Le plafond** est compté par la base en une seule instruction
  (`vrm_detourage_reserver`, migration 008) : un compteur illisible fait
  **refuser** de payer, jamais compter zéro. Un REFUS de Photoroom rend l'unité ;
  un délai ou une coupure après sa réponse la garde comptée (l'image a pu être
  facturée). Plafond atteint ⇒ la sonde le dit, aucune photo n'est envoyée.
- **Cache illisible** ⇒ on ne repaie pas une photo peut-être déjà détourée.
- **L'affiche générique de Vinted** (12 des 780 photos captées) n'est jamais
  envoyée : on ne paie pas pour détourer une affiche.
- **Toute autre issue garde la photo d'origine** — pas de clé, plafond atteint,
  crédits épuisés, extension pas connectée à VRM, délai — et le bandeau
  Leboncoin dit pourquoi, en clair. Jamais un faux « détourée ».

Preuves : `scripts/audit-detourage-ext.cjs` (le vrai `background.js`),
`scripts/bancs/detourage.cjs` (la vraie route), `scripts/bancs/detourage-reglage.cjs`
(le réglage rendu).
