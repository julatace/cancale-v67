# Passation du 22-23 octobre 2026 — l'intégration « finir ce qui n'était pas fini »

Julien, le 22 octobre au soir, à propos du travail commencé et de celui des autres IA : « tu fais ce
qui n'est pas fini », puis « ok continue et mets en ligne ». Treize chantiers ouverts ont été
finis, relus par un relecteur adverse, corrigés, puis fusionnés dans une seule branche
d'intégration (`integ-22oct`, poussée sur `claude/project-review-nsk5su`) avant la mise en ligne.
Chaque chantier a sa section datée du 22 octobre dans `CLAUDE.md` : ce qui a été mesuré, décidé,
prouvé, et ce qui n'a pas été mesuré.

## 1. Ce qui part en ligne (13 chantiers)

| chantier | branche | ce que c'est | relu, corrigé |
|---|---|---|---|
| CSP | `v22-csp` | politique de sécurité du contenu complète, en **Report-Only** (rien n'est bloqué) ; plus aucun script en ligne (`public/demarrage-theme.js`) | oui |
| Ma journée en widgets | `v22-widgets` | « Modifier » : ranger, retirer, ajouter, élargir les blocs ; disposition synchronisée (`vrm_journee_widgets`) ; les alertes d'argent restent en tête, jamais retirables | oui |
| Carte de la communauté | `v22-carte` | OpenFreeMap seul (`positron` / `dark`), noms en français, repli en liste | oui |
| Offres + adresse prouvée | `v22-adresse` | « N offres à trancher » en tête de Messages ; une adresse de réception se PROUVE par un lien de confirmation (envoyé par le script Gmail) | oui |
| Double vérification gratuite | `v22-mfa` | un second appareil TOTP (secours), nommé, retirable ; aucun SMS | oui |
| Fiabilité | `v22-fiabilite` | Ma journée relit moins (5 causes retirées), barre des Ventes sur téléphone, photos d'une extension muette | oui |
| Colis à l'heure | `v22b-colis` | une règle de date limite (`api/_lib/limite-envoi.js`) pour l'app, le rappel du matin, le soir et le widget ; l'heure limite affichée | oui |
| Numéros et annonces masquées | `v22b-numeros` | une annonce masquée par Vinted compte comme paire présente (doublons N°51, 52, 59, 73) | oui |
| Photos sans freiner Vinted | `v22b-photos` | une page photo par tour, 45 s d'écart fixe, rien pendant qu'il navigue ; la fiche enregistrée sur Vinted est gardée | oui |
| Leboncoin « plus vue » et pause | `v22b-lbc` | une annonce absente d'une liste COMPLÈTE de son profil passe « plus vue » ; « Mettre en pause sur Leboncoin » sur son clic | oui |
| URSSAF et compta | `v22b-urssaf` | « C'est déclaré » (Comptabilité, Ma journée), notification du 1er avec le montant publié (jamais « au moins 0 € »), heure de Paris | oui |
| Petits correctifs | `v22b-petits` | code de retrait Chronopost, mentions légales exigées avant de payer, compte à rebours de l'email… | oui |
| Mode équipe (016) | `v22b-016` | migration 016 retouchée pour la 021 (essai annulé sur la vraie base) | oui |

Plus deux fusions de `origin/main` (d9d2743, puis 5dbeb42 — la palette « Perle »). Le bloc
« Performance » que main a ajouté à Ma journée y devient un widget proposé dans « Ajouter » : la
disposition d'origine reste celle que le banc `revendeurs` exige (stock et dernières ventes
visibles sans défiler).

Extension : **5.213.0** — photos, Leboncoin et petits correctifs modifient `vinted-sync-extension/`,
et la 5.212.0 est déjà servie par main avec un autre contenu (deux contenus ne portent jamais le
même numéro).

## 2. ⚠️ Le piège de banc mesuré cette nuit

Dans un **worktree**, les bancs qui chargent playwright par le chemin ABSOLU
`/home/user/cancale-v67/node_modules/playwright` ne reçoivent pas la porte des bancs
(`scripts/bancs/_porte-banc.cjs`, qui patche la copie du worktree) : l'app reste sur l'écran de
connexion (l'accès direct est retiré, `bypass = false`) et le banc sort des dizaines de rouges
FAUX (messagerie : 17 rouges, puis 0 avec le correctif). Lancer les bancs avec :

```
NODE_OPTIONS="--require /tmp/claude-0/redir-pw.cjs" BANC_PORT=… node scripts/bancs/<banc>.cjs
```

`redir-pw.cjs` ramène le chemin absolu sur la copie du worktree (un crochet de
`Module._resolveFilename`, dix lignes : le recréer s'il a disparu). Un rouge obtenu sans ça ne
prouve rien. Dans le dépôt principal (`/home/user/cancale-v67`), rien à faire.

## 3. Rouges connus, laissés

- `colis` et `verif_visuel` : rouges À L'IDENTIQUE sur main (cause à part, déjà notée).
- `benefice-journee` section D (« éteint ⇒ plus de carte ») : rouge identique sur main — le banc
  sert la sonde de schéma en 400, la synchro ne part pas.
- `vitesse` : sous la charge de la machine partagée (load > 10), Ma journée à 390 px mesure
  14 rendus (plafond 13) et Ventes 9 lectures identiques (plafond 8) — bruit déjà noté par le
  chantier fiabilité ; à remesurer seul, machine calme.

## 4. La migration 016 (mode équipe)

Relue : « sûre à appliquer » (144 contrôles, 19 mutations sur 19 ; essai annulé sur la vraie base,
rien n'est resté). Mesuré en production : 021 en place, confirmation d'email active (6 comptes,
0 non confirmé). Une fois appliquée, un aide invité peut aussi faire avancer SES missions dans
Organisation (jamais valider, créer, ni toucher aux réservations).

## 5. Les gestes de Julien

1. **Installer l'extension 5.213** dans UN seul dossier (retirer toute autre copie de VRM), puis ⟳
   dans chaque Chrome.
2. **Recoller `scripts/gmail-forwarder.gs`** dans la boîte Gmail du script, avec la clé
   `EMAIL_INBOUND_SECRET` dans ses propriétés — sans ça aucun lien de confirmation d'adresse ne
   part, et l'ancien script (clés JWT refusées) ne peut envoyer aucune facture Pro.
3. **Supabase → Authentication** : Site URL `https://vrm.center`, Redirect `https://vrm.center/**`,
   un SMTP personnalisé.
4. **URSSAF** : « C'est déclaré » sur septembre (et sur août s'il l'a déclaré à la date de vente) —
   avant le 31 octobre. S'il n'a aucune dépense : « Je n'ai pas de dépenses à noter » une fois.
5. **Cartons** : à la prochaine ouverture, quatre paires en ligne reçoivent un numéro neuf (anciens
   N°51, 52, 59, 73) ; barrer l'ancien, écrire le nouveau, « C'est écrit ». Les paires masquées par
   Vinted gardent le leur.
6. **Mentions légales** : remplir `public/legal/editeur.js` et `src/contact.js` — tant qu'ils sont
   vides, personne ne peut payer l'abonnement (la carte « Mon compte » liste ce qui manque).
7. **Leboncoin** : ouvrir une fois sa page profil (la liste de toutes ses annonces) et « Mes
   transactions ».
8. **Vinted** : « Modifier » puis « Enregistrer » sur ses annonces déjà en ligne, pour que leur
   description, catégorie et couleurs soient gardées pour Leboncoin et eBay.
9. **Vercel Pro** avant le premier client payant ; surveiller l'égress Supabase.
10. CSP : après 7 jours sans plantage d'origine `csp` (requête dans `CLAUDE.md`), passer la clé
    `Content-Security-Policy-Report-Only` en `Content-Security-Policy` dans `vercel.json`.

## 6. Ce qui n'a pas été mesuré

Rien n'a été envoyé à Vinted, eBay ou Leboncoin d'ici. Les formes non vues (réponse de Leboncoin
à une pause, `owner_listing` complet, PUT de modification Vinted au-delà de 6 cas, l'en-tête
`x-vrm-equipe` à travers la passerelle Supabase, le vrai OpenFreeMap sur son téléphone, un vrai
iPhone pour les widgets) sont listées dans chaque section du 22 octobre de `CLAUDE.md`.
