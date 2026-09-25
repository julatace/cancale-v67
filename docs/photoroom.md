# Détourage des photos avec Photoroom — ce que TU dois faire (une fois)

Le détourage (retirer le fond, ne garder que la chaussure) se fait via l'API
**Photoroom**. Le code est prêt côté VRM (`api/detourage.js`). Il ne manque que
**ta clé Photoroom**, à créer et à coller dans Vercel. C'est toi qui la crées,
parce que c'est **ton** compte et que ça t'est **facturé à l'image**.

## 1. Créer le compte et la clé (5 min)

1. Va sur **https://www.photoroom.com/api** et crée un compte (ou connecte-toi).
2. Ouvre les réglages de l'API et **active l'API** → tu obtiens une **clé**
   (une longue suite de lettres/chiffres). C'est le seul secret dont VRM a besoin.
   Ce n'est **pas** un mot de passe : ne me donne jamais ton mot de passe.
3. Tu as **10 détourages gratuits** (non filigranés) pour tester la qualité avant
   de payer, plus un mode bac à sable gratuit.

**Le coût, pour décider en connaissance de cause :** formule Remove Background
≈ **20 $/mois + 0,02 $ par photo**. VRM ne détourera **que les paires que tu
publies** (pas tout ton stock d'un coup) pour maîtriser la facture.

## 2. Coller la clé dans Vercel (2 min)

1. Va sur **vercel.com** → ton projet VRM → **Settings** → **Environment
   Variables**.
2. Ajoute une variable :
   - **Name** : `PHOTOROOM_API_KEY`
   - **Value** : la clé copiée à l'étape 1
   - Environnements : coche **Production** (et Preview si tu veux).
3. **Save**, puis **redéploie** (Deployments → … → Redeploy) pour que la clé
   soit prise en compte.
4. Dis-moi « clé Photoroom en place » — VRM saura alors que le détourage est
   branché (la route répond `ready: true`).

## Ce que VRM fait ensuite (mon travail, déjà prêt / à brancher)

- `api/detourage.js` reçoit une photo (les octets, que l'extension a déjà pour
  le cross-post), appelle Photoroom **avec ta clé** (jamais dans le code : le
  dépôt est public), et renvoie la photo **détourée** (chaussure sur fond blanc).
- Prochaine étape (une fois la clé posée) : brancher ça sur les photos de tes
  annonces Vinted et réutiliser les versions propres pour publier sur Leboncoin,
  eBay et Vestiaire Collective — VC n'aura plus le détourage à faire.

⚠️ Sans la clé, VRM ne détoure rien et ne fait **pas semblant** : il garde la
photo d'origine. Aucun détourage inventé.
