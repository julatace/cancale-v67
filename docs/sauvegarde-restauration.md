# Sauvegarde et restauration — la procédure vérifiée (9 nov. 2026)

Ce qui est écrit ici a été lu le 9 novembre 2026 dans la documentation de Supabase
(supabase.com/pricing, /docs/guides/platform/backups, /docs/guides/platform/clone-project).
Le script de vérification a été essayé sur deux bases inventées (jamais la production).

## 1. Ce que Supabase garde, selon l'offre

| offre | sauvegardes | ce qu'on peut récupérer |
|---|---|---|
| **Gratuite** (aujourd'hui) | **aucune** sauvegarde automatique | rien : seulement un export fait à la main (`supabase db dump`) |
| **Pro** (25 $/mois) | **une par jour, gardées 7 jours** (sauvegarde physique, Postgres ≥ 15.8.1.079) | l'état d'un des 7 derniers jours |
| **Pro + PITR** (≈ +100 $/mois pour 7 jours) | journal envoyé toutes les ~2 minutes ; remplace les sauvegardes du jour | n'importe quelle seconde des 7 derniers jours (perte maximale ≈ 2 min) |

À savoir :
- La sauvegarde contient **la base** (tables, index, rôles, comptes de connexion
  `auth.users`). Elle ne contient **pas** les fichiers du Storage, les réglages
  d'authentification (Site URL, SMTP, fournisseurs Google/Discord), les clés d'API,
  les Edge Functions. VRM ne range rien dans le Storage aujourd'hui (tout est dans
  `app_data`) : la base suffit.
- Restaurer **sur place** remplace la base actuelle et la rend indisponible pendant
  la restauration. **On ne restaure jamais sur place sans avoir d'abord restauré dans
  un projet NEUF** (« Restore to a New Project ») et vérifié la copie.

**Geste de Julien n° 1 : passer en Pro** (supabase.com → Organization → Billing →
Upgrade to Pro). Tant que le projet est en Gratuit, il n'existe AUCUNE sauvegarde.

## 2. Restaurer dans un projet COPIE (jamais sur place d'abord)

1. supabase.com → le projet VRM → **Database → Backups** → onglet
   **« Restore to a New Project »**.
2. Choisir la sauvegarde (ou, avec PITR, la date et l'heure), lire le coût mensuel
   estimé du nouveau projet, confirmer. Supabase crée le projet dans la même région
   avec la même taille de machine.
3. ⚠️ Les extensions qui agissent seules (pg_cron, pg_net) repartent dès la fin de
   la restauration. VRM n'en utilise pas aujourd'hui ; si un jour oui, couper leurs
   tâches dans la copie avant tout.
4. ⚠️ La copie n'est **branchée sur rien** : ni Vercel, ni l'extension, ni le Worker
   des e-mails ne la connaissent. Ne pas lui donner ces adresses. Elle ne sert qu'à
   être comparée.
5. Dans la copie : Project Settings → API → noter l'URL et la clé **service_role**
   (ou `sb_secret_…`). Faire de même pour le projet de production.

## 3. Vérifier la copie — `scripts/sauvegarde/verifier-restauration.mjs`

Sur un ordinateur (jamais dans le dépôt, jamais dans une conversation) :

```
SOURCE_URL=https://<projet-prod>.supabase.co  SOURCE_CLE=<clé service prod> \
COPIE_URL=https://<projet-copie>.supabase.co  COPIE_CLE=<clé service copie> \
node scripts/sauvegarde/verifier-restauration.mjs
```

Ce qu'il fait, **en lecture seule** (le code n'envoie que des GET ; toute autre
méthode est refusée avant le réseau) :
- pour chaque vendeur : nombre de comptes Vinted liés, nombre de lignes `app_data`,
  nombre par famille (main, `harvest_*_orders_sold`, `email_bord_*`…), empreinte de
  la liste des identifiants (aucune ligne perdue ni en trop) ;
- empreinte de la ligne `main` entière, et à part **celle des numéros de rangement**
  (`vinted_annonce_numeros`, `vinted_used_nums`, `vrm_numerotation`) ;
- il n'affiche **aucun contenu** : des nombres, des empreintes de 12 caractères, les
  8 premiers caractères de l'identifiant du vendeur.

Réponses : **0** identiques · **1** écarts (listés, ceux des NUMÉROS marqués ⚠️) ·
**2** « pas su » (une base n'a pas répondu ou une page est incohérente — on ne
conclut rien, on relance).

Lire le résultat :
- La copie est l'état d'**hier** (ou de l'heure choisie). La production a bougé
  depuis : des écarts sur `harvest_*` (captures de l'extension), `email_*`,
  `mesures_*`, `cron_curseur_*` sont **normaux** s'ils vont dans le sens « la
  production en a plus ». Pour une comparaison nette, la faire juste après la
  restauration, un moment calme.
- Un écart sur les **NUMÉROS** ou sur `main` d'un vendeur qui n'a rien modifié
  depuis la sauvegarde est **anormal** : ne pas restaurer cette sauvegarde sur place.
- Un vendeur « absent de la copie » est anormal (sauf s'il s'est inscrit depuis).
- En plus, vérifier dans le tableau de bord de la copie : Authentication → Users,
  le même nombre de comptes que la production (à l'écart des inscriptions du jour).
- Coût : chaque base relit ~70 octets par ligne plus la ligne `main` de chaque
  vendeur (~100 Ko) — ≈ 0,4 Go d'égress par base à 1 000 vendeurs.

Supprimer le projet copie une fois vérifié (il coûte tant qu'il existe).

## 4. Le rythme conseillé

- **Une fois par mois** (et avant toute migration SQL) : restaurer la sauvegarde de
  la nuit dans un projet copie, lancer le script, noter le résultat (date, code, nombre
  d'écarts) dans `docs/passation/`, supprimer la copie.
- Avant une migration lourde (013, 016…) : en Pro sans PITR, attendre la sauvegarde
  de la nuit ou faire un `supabase db dump` (Database → connexion « Session pooler »)
  gardé hors du dépôt.

## 5. Ce qui a été essayé (preuve)

`node scripts/audit-sauvegarde-verifier.cjs` lance le vrai script contre deux faux
PostgREST locaux (3 vendeurs inventés, ~3 700 lignes chacun) : copie identique ⇒ 0 ;
une ligne effacée ⇒ 1 avec le vendeur et la famille ; un numéro changé ⇒ 1 « NUMÉROS » ;
un vendeur manquant ⇒ 1 ; base injoignable ou page en 500 ⇒ 2 ; aucune écriture
reçue par les bases ; rien de lisible dans la sortie ; même URL des deux côtés ⇒ refusé.
`--prouve` : 5 mutations du script, toutes attrapées.
