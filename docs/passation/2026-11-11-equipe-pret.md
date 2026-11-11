# 11 nov. 2026 — Lot `equipe-pret` : le compte « équipe », prêt à activer

Branche `claude/equipe-pret` (depuis `origin/main` 1ca9c09), poussée à chaque commit. Pas de PR.
Rien dans `vinted-sync-extension/`, aucune nouvelle fonction `api/` (toujours 12). Aucune
écriture en base réelle. **La 016 n'est PAS appliquée** : c'est le geste de Julien (§4 ci-dessous).

## Ce qui existait déjà (vérifié, pas refait)

Tout le mode équipe date des 16-22 octobre (`historique-communaute-equipe.md`) :
table `vrm_equipe`, fonctions `SECURITY DEFINER`, liste blanche d'`id`, projection
`vrm_equipe_colis` sans montant, en-tête `x-vrm-equipe` exigé, route `api/compte.js?mode=equipe`,
aiguillage `PorteEquipe` avant l'abonnement, écran de l'aide `ColisEquipe`.

- **L'espace de l'aide est déjà un écran à lui** (`ColisEquipe`, monté par `PorteEquipe`, hors
  d'`AppCoeur`) : « À envoyer » (impression du bordereau) et « À retirer » (codes, QR), plus les
  codes reçus par e-mail et les « à vérifier ». Il ne dépend **pas** de l'onglet Colis.
  Vérifié contre la branche DJ3 (`claude/colis-a-leur-place`) : elle ne retire aucune des
  fonctions que l'écran utilise (`aExpedier`, `isAtRelayStatus`, `etatColisEmail`,
  `lirePdfLigne`, `tamponnerBordereau`…) et ne touche pas `ColisEquipe`.
- Impression par l'aide : PDF lu AVEC l'en-tête, tamponné du N° porté par la ligne
  `email_bord_*` et du titre (l'aide ne lit jamais `main`).
- Retrait de l'accès : Paramètres → Mon compte → Équipe → « Retirer » → confirmer. Effet
  immédiat (prouvé en SQL : « révoqué : le membre ne lit PLUS RIEN, tout de suite »).

## Le défaut trouvé : la 016 contre la 027

La **027** (8 nov., « sans abonnement : un aperçu, aucune écriture », pas encore appliquée
non plus) pose `abonnement_requis … using (true)`. La 016 réécrivait cette restrictive
sans condition. **Appliquée après la 027, la 016 refermait la lecture de qui ne paie pas** :
l'aperçu flouté de Julien serait mort en silence (l'app croit `lecture: true`, la base
ne rend rien). Et la garde §11 ter aurait pris la restrictive `true` pour un verrou.

Corrigé dans `supabase/migrations/016-equipe.sql` :
- §11 : `abonnement_requis` n'est réécrite que si elle ne vaut pas déjà `true` ;
- §11 ter : une restrictive `true` ne compte pas comme « bloquante » ;
- `scripts/equipe-sql/essai-annule.cjs --verifier` : reconnaît la 027 à SA restrictive
  `abonnement_requis_effacer` (pas au `true`, sinon une règle ouverte à la main passerait).

**Tranché** : les deux ordres marchent. Inutile d'attendre la 027 pour la 016, ni l'inverse.
Avec la 027 : un vendeur qui ne paie plus lit ses lignes, n'écrit rien, et **son aide ne
voit rien** (l'abonnement est celui du vendeur, comme avant).

## L'écran (« plus beau, simple, PRATIQUE »)

- **Invitation à partager** : VRM n'envoie aucun e-mail. À côté de chaque invitée, « Envoyer
  l'invitation » ouvre la feuille de partage du téléphone (sinon copie le message, sinon
  l'affiche à sélectionner). Le message : l'adresse, `https://vrm.center`, « Accepter ».
  **Tranché** : aucun lien secret. L'accès se prouve par l'adresse confirmée, jamais par un lien
  (un lien transféré ouvrirait les colis à n'importe qui).
- **Sans la 016** : l'aide lit « Le mode équipe n'est pas encore activé sur ta base. Le
  vendeur doit l'activer. Rien à faire de ton côté. » ; le propriétaire lit dans Réglages
  « Supabase → SQL Editor → colle 016-equipe.sql → Run. ».
- Ce que voit un aide : six phrases courtes (`CE_QUE_VOIT_UN_MEMBRE`, même règle qu'avant).
- Rangée d'une invitée : les deux boutons restent ensemble (à 390 px, « Retirer » passait seul
  à la ligne — vu sur la capture).

## Preuves

- `node scripts/audit-equipe-sql.cjs` (Postgres jetable, socle + 021 + 027 réels) : **182 verts**.
  Nouveaux : « 021, 027 puis 016 » et « 021, 016 puis 027 » (parcours membre complet,
  `abonnement_requis` reste `true`, vendeur sans abonnement lit et n'écrit pas, son aide ne lit
  rien, vendeur qui paie ⇒ l'aide relit exactement la liste blanche, `--verifier` ok) ; les deux
  SQL à coller sont à jour.
  **Rouge sur la 016 d'avant** (celle d'`origin/main`) : 4 rouges, dont « la 027 tient » et
  « sans abonnement, le vendeur LIT ses lignes ».
  `--prouve` : **21/21 mutations** au rouge (dont `ecrase-027` et `garde-027-bloque`, neuves).
  Mutation du fichier `016-3-verifier.sql` (une ligne ajoutée) ⇒ rouge.
- `node scripts/audit-equipe-ecriture-membre.cjs` : 16 verts.
- Banc `scripts/bancs/equipe.cjs` (390 et 1512 px) : **90 verts**. Il était **rouge sur `main`**
  (9 rouges) : la feuille « Qu'est-ce que tu vends ? » (9 nov.) couvrait les Réglages, et une
  expression cherchait « plus accès » au lieu de « plus d'accès ». Réparé (le vendeur du banc a
  fait sa configuration). Nouveaux contrôles : « Envoyer l'invitation » proposé à l'invitée et
  pas au membre actif ; message partagé = adresse + vrm.center + « Accepter », aucun identifiant ;
  le geste dit à l'aide sans la 016. **8 rouges sur le build d'`origin/main`** (§6.1).
- Captures regardées (390 et 1512) : écran de l'aide, Réglages → Équipe, « pas encore activé ».
- `npm run build` vert ; audits `variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, csp, vendeurs-differents, fermer-compte, confidentialite-sql` verts.

## Non mesuré (dit)

- **La vraie base n'a pas été relue cette session** (aucune requête, même en lecture). On ne
  sait donc pas si la 027 y est déjà. Les deux cas sont couverts. L'essai annulé du 22 oct. a été
  joué sur l'ANCIEN texte : rejouer le nouveau (étape 1 ci-dessous) avant d'appliquer.
- L'en-tête `x-vrm-equipe` à travers la passerelle de Supabase, depuis un navigateur (CORS).
  S'il était refusé, l'écran dit « pas pu lire », jamais « aucun colis ».
- La feuille de partage sur un vrai iPhone (le banc la remplace par une fausse).
- Le bloc « Mes missions » (Organisation) sur l'écran de l'aide : inchangé, non retesté ici.

## 4. Le pas à pas EXACT pour Julien (sans terminal)

Les fichiers se copient sur GitHub une fois la branche fusionnée : ouvrir le fichier → bouton
« Raw » → tout sélectionner → copier.

0. **Supabase → Authentication → Sign In / Providers → Email → « Confirm email » activé.**
   Sans ça, l'adresse « confirmée » ne prouve rien (quelqu'un créerait un compte à l'adresse invitée).
1. **Essai (rien ne reste)** : Supabase → **SQL Editor** → **New query** → coller
   `scripts/equipe-sql/016-1-essai-annule.sql` → **Run**. La ligne `essai` doit montrer
   `"table" : true` et `"rls" : true`. Le fichier finit par ROLLBACK : rien n'est installé.
2. **Activer** (VRM peu utilisé, ~1 s) : **New query** → coller `supabase/migrations/016-equipe.sql`
   → **Run**. « Success. No rows returned. »
3. **Vérifier** : **New query** → coller `scripts/equipe-sql/016-3-verifier.sql` → **Run**.
   La ligne `verification` doit dire `"ok" : true`. Sinon, `ecarts` nomme ce qui diffère :
   ne rien toucher, ouvrir une session. (Avec un terminal :
   `node scripts/equipe-sql/essai-annule.cjs --verifier`, même texte.)
4. **Inviter** : VRM → Paramètres → Mon compte → **Équipe** → e-mail de l'aide → **Inviter** →
   **Envoyer l'invitation** (SMS, WhatsApp…).
5. L'aide crée son compte VRM **avec cette adresse**, la confirme, touche **Accepter** : il arrive
   sur « Colis à préparer ». Il ne paie rien.
6. **Retirer** : Équipe → **Retirer** → confirmer. Effet immédiat.

Retour arrière (sans DROP) : les deux `alter policy` d'avant sont écrits en tête de la 016.
