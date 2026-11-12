# Dossier de passation — second agent (session youthful-wozniak), 11 nov. 2026, soir

À lire avec `docs/passation/COORDINATION-AGENTS.md` (branche `claude/coordination`) : l'**agent principal**
est le seul à fusionner sur `main`. Le second agent travaille sur des branches `claude/agent2-*`, sans PR ni
fusion, et note chaque branche finie dans « Fini, à intégrer ».

## 1. Ce qui est déjà en ligne (vrm.center)

- Tout jusqu'à la PR #1130 (facture SIRET, extension jusqu'à 5.344, achats, dates de versement, textes
  courts, profil, offres, « pas que des sneakers », audits remis au vert), plus les paquets de l'agent principal.
- `claude/agent2-robustesse-serveur` : déjà dans `main` (PDF gardés en quarantaine, versements jamais fondus,
  e-mail rangé par l'adresse de réception, webhook Stripe 503, effacement 12 mois seulement si l'avis est parti,
  relances ratées retentées, délais Stripe/eBay/IA, `maxDuration`).

## 2. Fini, PAS encore en ligne (à intégrer par l'agent principal)

| branche | contenu | geste de Julien après mise en ligne |
|---|---|---|
| `claude/agent2-vinted-forme` | **extension 5.357** (CONTIENT 5.356 : intégrer celle-ci seulement) : action seulement depuis l'onglet du bon compte, offres auto jamais en double, N° réservé sans doublon, messages de page vérifiés, faux clics retirés, base muette sans blocage ; alerte « Vinted a changé sa page » ; mode prudence 24 h après un refus (20/h, plafond normal 50 inchangé) | installer 5.357.0 dans chaque Chrome + Orion |
| `claude/agent2-robustesse-metier` | « Synchroniser les ventes » par preuve seulement ; « En ligne » jamais retiré par ressemblance ; « J'ai déclaré ce mois » attend Vestiaire ; N° et numéros de facture jamais redonnés ; « 25,50 » lu ; « — » au lieu de 0 € ; « Accepter » bloqué si vendue ailleurs ; « Prix conseillé » à la mise en ligne retiré ; plus de rouge pour un bénéfice négatif | aucun |
| `claude/agent2-temps-reel` | ce que capte l'extension apparaît sans recharger (≤ 25 s), pastille « Mis à jour à hh:mm » | facultatif : migration **040** (essai annulé puis 040 puis vérifier, voir le récit) |
| `claude/agent2-veille` | alarme quand le stock / le CA d'un mois passé chute sans raison ; contrôle de nuit (2 paires sous un N°, ventes sans versement > 30 j, comptes pas relus > 48 h, e-mails sans vendeur, Stripe) ; vue des plantages tous comptes | aucun |
| `claude/agent2-cloisonnement` | test « B n'atteint jamais A » (1 560 essais, 0 trou) ; « Simuler une création de compte » (Réglages, propriétaire seul) ; test « comme un vrai client » après chaque mise en ligne | facultatif : compte de démo + secrets GitHub `VRM_DEMO_EMAIL`, `VRM_DEMO_MOT_DE_PASSE` |
| `claude/agent2-limites-client` | Annonces par paquets de 72 ; cron borné 60 s par vendeur ; widget réparé à 1 000 e-mails ; 429 propre ; usage par vendeur | migration **041** (lecture seule) |
| `claude/agent2-saisie-rapide` | prix d'achat demandé le jour de la vente (notification + cron) ; « Vendu ailleurs » ; « vendues en octobre » à la voix ; bilans serveur à jour | aucun |
| `claude/agent2-argent-parrainage` | prévision du mois ; coût de chaque plateforme mois par mois ; parrainage `vrm.center/r/CODE`, anti-abus même carte | migration **037**, Stripe (voir §4), relire CGV art. 2 bis |

Numéros de migration des branches agent2 : **037**, **040**, **041** (038 = `claude/base-tables` de l'agent
principal). Aucune n'est appliquée.

## 3. En cours au moment d'écrire

| branche | quoi |
|---|---|
| `claude/agent2-robustesse-donnees` | défauts critiques/hauts de la couche données (vendeur suivant qui voit le précédent, saisies perdues à la déconnexion, doublons Leboncoin, adresses e-mail écrasées, commandes coupées à 1 200) |
| `claude/agent2-familles-app` | défauts moyens/petits de l'app par famille : dates Paris, « pas su » ≠ 0, N° par `cleNum`, une règle par notion, `localStorage` protégé — chaque famille avec un audit gardien |
| `claude/agent2-familles-serveur` | défauts moyens/petits du serveur par famille : délai sur chaque appel sortant, pagination à ordre stable, pas de `select=data` lourd, comparer-et-échanger, identifiants plus longs (CONTIENT `agent2-robustesse-serveur`) |

Si la session tombe : chaque branche est poussée ; reprendre avec son récit `docs/passation/2026-11-11-<sujet>.md`
sur la branche, vrai `git merge origin/main`, finir, noter dans « Fini, à intégrer ».

## 4. Gestes de Julien (dans l'ordre, quand c'est en ligne)

1. Installer l'extension **5.357.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion : `VRM-Orion-dossier.zip`).
2. Parrainage : migration **037** · `STRIPE_SECRET_KEY` (`sk_test_…`) sur Vercel + Redeploy · webhook Stripe
   `https://vrm.center/api/stripe-webhook` avec `invoice.paid` en plus, `STRIPE_WEBHOOK_SECRET` · allumer :
   `update vrm_reglages set valeur='1' where cle='parrainage';` · relire CGV art. 2 bis · essai avec la carte 4242…
3. Migration **041** (usage par vendeur, lecture seule).
4. Facultatif : migration **040** (temps réel en ~1 s au lieu de ≤ 25 s).
5. Facultatif : compte de démo vide + secrets GitHub `VRM_DEMO_EMAIL` / `VRM_DEMO_MOT_DE_PASSE`.
6. Ouvrir vinted.fr sur le grand compte (les 1 751 dates de versement arrivent en ~6 jours, ext. ≥ 5.341).

## 5. Questions ouvertes pour Julien

- **Boîte commune des e-mails** : quand un e-mail arrive par la boîte collective de transfert, VRM ne peut pas
  toujours prouver l'adresse d'origine ; tout bloquer mettrait tout en quarantaine. Laissé tel quel.
- **Prudence (5.357)** : la relecture des ventes au début de chaque visite continue pendant les 24 h (anti
  double vente), alors qu'il avait validé « tout s'arrête sauf les codes de retrait ». Garder ou couper ?
- « X € conseillé » sur une paire qui dort : gardé (baisse, jamais sous le prix d'achat) — à confirmer.

## 6. Refusé par Julien le 11 nov. (ne pas reproposer)

Carte « Ce qui a changé depuis hier soir » ; « annonces jumelles » ; tableau de bord « Bienvenue » du
premier jour.

## 7. Restes connus, hors de ma zone (signalés à l'agent principal)

- Le plein écran « Tu vends quoi ? » bloque l'essai/résilier dans le banc `abonnement-propre` (9 rouges).
- `api/vinted-refresh.js` a l'URL Supabase de production en dur.
- Fonctions SQL communauté/équipe/formateurs : cloisonnement pas encore testé (banc SQL à faire).
- Avec 20 000 ventes, chaque écran met encore 7–19 s au démarrage (calculs de Comptabilite) : vitesse.
- « délai dépassé » en rouge dans Colis ; `audit-benefice` rouge sur main (`MeilleuresSources` déclaré deux fois).
- Revue robustesse complète (525 points) : `docs/passation/robustesse/` sur `claude/agent2-robustesse`.

## 8. Mise à jour du 12 nov. (nuit) — ce qu'il faut intégrer, au plus court

Plusieurs branches en contiennent d'autres. Pour tout avoir, l'agent principal n'intègre QUE :

| branche | contient |
|---|---|
| `claude/agent2-revue-fin` | `agent2-serveur-migrations`, `agent2-familles-serveur`, `agent2-robustesse-serveur`, `agent2-familles-app`, `agent2-robustesse-metier` |
| `claude/agent2-extension-moyennes` (ext. **5.362**) | `agent2-familles-extension` (5.361), `agent2-vinted-forme` (5.357), `agent2-robustesse-extension` (5.356) |
| `claude/agent2-donnees-suite` | `agent2-robustesse-donnees` |
| `claude/agent2-messages` · `claude/agent2-regroupe-comptes` · `claude/agent2-ventes-vestiaire` · `claude/agent2-temps-reel` · `claude/agent2-veille` · `claude/agent2-cloisonnement` · `claude/agent2-limites-client` · `claude/agent2-saisie-rapide` · `claude/agent2-argent-parrainage` | eux-mêmes |

Migrations des branches agent2 : 037, 040, 041 **appliquées par Julien le 11 nov.** (vérifiées) ; **042** (écritures atomiques) écrite, pas appliquée (3 blocs : `scripts/serveur-migrations-sql/`).

Décisions attendues de Julien : ordre de Messages (compte de l'onglet d'abord ou tout mélangé) ; pause sur tout 403 ou seulement 429/anti-robot (conseil : garder) ; relecture des ventes en mode prudence ; « X € conseillé » d'une paire qui dort.
