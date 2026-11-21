# 10 nov. 2026 — E-mails de transfert (lot AQ, demande 6 du 9 nov. 21 h)

Branche `claude/emails-transfert`. Julien : « câbler la création des adresses
e-mail de transfert depuis l'app, simplement ».

## Ce qui est fait

- **La ligne** : Paramètres → **Mes e-mails** → **Mon adresse VRM**
  (`src/ecrans/Reglages.jsx`, `id:'adresse-vrm'`, `data-reglage-adresse-vrm`), juste
  avant **SMS de colis** (`src/SmsColis.jsx`, arrivé avec colis-propre-logos, gardé
  tel quel). Une phrase : « Une adresse à toi : tes e-mails Vinted y arrivent seuls. »
  Elle ouvre LA feuille de l'adresse (`FeuilleAdresseReception`, chargée à la demande) ;
  rien n'est demandé au serveur avant son toucher.
- **La création** : au premier `GET /api/email-rattacher?mode=adresse-unique`, le
  serveur fabrique SON jeton (`api/_lib/adresse-reception.js`) — l'app ne fabrique
  jamais une adresse. Sans `DOMAINE_RECEPTION` : « Bientôt disponible » au vendeur ; au
  SEUL propriétaire, ce qui manque (domaine absent / mal écrit, clé posée ou non —
  jamais une valeur, `etatMiseEnService`).
- **La feuille** (`src/AdresseReception.jsx`) : 3 étapes (copier l'adresse · créer le
  transfert, 7 messageries dont Orange et Free · l'e-mail d'essai « Essai VRM K7P2 »
  suivi en direct, « Reçu ✓ » jugé sur le CODE, jamais sur une heure), le code de
  confirmation Gmail/Yahoo affiché à l'étape, relais Apple, filtre Gmail « seulement
  Vinted ».
- **Le serveur** : `api/email-inbound.js` range le code d'essai chez le vendeur de
  l'ADRESSE (`vrm_adresse_reception_essai`) ; aucune fonction `api/` ajoutée (12/12).
- **Le Worker Cloudflare** à coller : `cloudflare/worker-reception.js` (sans paquet,
  e-mail brut + enveloppe, lève sur une réponse non-2xx pour que Cloudflare fasse
  renvoyer). Notice pour Julien : `docs/emails-transfert-mise-en-service.md` (le bloc
  de code y est, octet pour octet, le fichier testé).

## Preuves

- `scripts/audit-emails-transfert.cjs` (29 ✅) : EXÉCUTE le Worker sur un vrai MIME puis
  la vraie route sur une fausse base à forme réelle (A–G) ; **H** (10 nov.) : la ligne
  est dans Mes e-mails avant les SMS, elle ouvre la feuille qui se referme, la notice y
  mène. H rouge sur l'arbre d'avant (3 ❌) et par mutation (rendu de la feuille retiré ⇒ 1 ❌).
- `scripts/bancs/adresse-reception.cjs` : en plus du chemin E-mails → Relier ma boîte,
  le chemin Paramètres à 390 tactile / 1512, clair / sombre (ordre des lignes, 44 px,
  aucun appel avant le toucher, adresse lue par SA session, « Terminé » ramène).
  Captures `reglages-*` regardées.
- Audits verts : variables, tdz, coherence, identite, icones, fonctions-api,
  sms-colis, adresse-reception. `audit-politique-hotes` est rouge **sur main** pour
  des fichiers d'autres lots (`src/profilFiscal.js`, `src/relaisChange.js`), pas ceux-ci.

## Gestes de Julien

La notice entière : `docs/emails-transfert-mise-en-service.md` (≈ 30 min) — un
domaine de réception (jamais `vrm.center`) sur Cloudflare, le Worker `vrm-reception`
avec `EMAIL_INBOUND_SECRET`, Email Routing catch-all → Worker, `DOMAINE_RECEPTION`
sur Vercel puis Redeploy, et l'e-mail d'essai depuis Paramètres → Mes e-mails →
Mon adresse VRM.
