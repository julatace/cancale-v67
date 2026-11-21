# 13 nov. 2026 — Intégration, étape 1 : la CI (WebKit, App + vraie extension, iphone-reprise B5)

Branche `claude/integration-13nov-ci` (second agent, intégrateur). Sonde jetable : `claude/sonde-webkit`
(workflow `sonde-webkit.yml`, jamais fusionnée) — WebKit ne s'installe pas dans le conteneur des sessions
(téléchargement refusé), tout ce qui suit a été MESURÉ sur des runners GitHub.

## Ce qui était faux dans le constat de départ
« Bancs sous WebKit » n'est pas rouge « depuis Ubuntu 26 » : il n'a JAMAIS été vert (≈ 60 passages relus
du 10 au 13 nov., tous `failure`, ubuntu-24.04 compris le 13 nov. à 1 h UTC). Le job est épinglé sur
`ubuntu-24.04` quand même (comme les audits ; le WebKit de Playwright est construit pour 24.04).

## La vraie panne de WebKit : le service worker (et une fuite vers la VRAIE base)
Sonde du 13 nov. : la même requête cross-origin servie par `page.route` passe sous WebKit tant que la page
n'a pas de service worker. Dans l'app, `sw.js` s'installe ; ensuite les requêtes de la page vers la base
passent par lui, et **Playwright ne route pas le trafic d'un service worker sous WebKit** : ni les routes du
banc, ni le refus de la garde réseau. Mesuré : `connexion-claire` a reçu une réponse de **172.64.149.246:443**
(la vraie base, derrière Cloudflare) — la garde le notait (« ❌ garde réseau »), le banc ne recevait rien.
**Correction** (`scripts/bancs/_garde-reseau.cjs`) : tout contexte WebKit/Firefox de banc est créé avec
`serviceWorkers: 'block'`, sans interrupteur. Chromium (qui route le service worker) inchangé. Une note de
la garde dit maintenant par quel chemin elle a vu la requête (`réponse de IP:port`).
Résultat sur le lot WebKit de la CI : de 8 bancs rouges à 3 (connexion-claire, journee-coherence,
colis-retirer-propre, retraits-suivi, tout-imprimer passent).

## iphone-reprise B5 : pas une course de banc, un vrai défaut Safari
B5 (« panneau Plus ouvert, toucher Ventes y va ») était rouge sous WebKit sur les 4 tailles, 3 passages sur 3
(sonde, banc de main inchangé). Cause : toucher un onglet ferme « Plus » tout de suite, mais pose l'écran en
tâche interruptible (`demarrer`). La feuille fermée retire son entrée d'historique (`FermeAuRetour`) : comme
l'écran n'était pas encore posé, elle fait `history.back()` ; l'écouteur `popstate` de la coque prenait ce
retour pour un geste « retour » et ramenait Ma journée. **Correction** (`src/App.jsx`, `onPop` de la coque) :
le retour qu'une feuille fait ELLE-MÊME (`__vrmRetourFeuille`, ou l'événement noté `__vrmPopFeuille`) ne
change jamais d'écran ; l'écran touché est empilé ensuite par `pousser` (qui attendait déjà ce retour).
Le banc n'est pas modifié. Preuve : sonde « B5 sous WebKit, app de main » rouge, « app corrigée » verte
(même banc) ; sous Chromium iphone-reprise vert ; `retour-historique` et `feuilles-coque` : mêmes rouges
qu'avant sur main (16 et 2, identiques ligne à ligne — préexistants).

## « App + vraie extension » : la garde bloquait vrm.center
Le banc sert les vrais noms (vrm.center, la base, vinted.fr) sur 127.0.0.1 par `--host-resolver-rules` et
`--no-proxy-server` ; la garde réseau (posée le même jour que le banc) refusait vrm.center au niveau du
contexte : `net::ERR_BLOCKED_BY_CLIENT`, 4 verts / 8 rouges. **Correction** : un nom que le banc envoie
LUI-MÊME vers 127.0.0.1:PORT (Chromium sans proxy) n'est plus refusé ; une réponse de ce nom qui ne vient
pas exactement de 127.0.0.1:PORT reste notée ; sans `--no-proxy-server`, rien n'est tenu pour local.
L'extension publiée n'est pas changée (elle vise vrm.center ; c'est le DNS du Chromium de banc qui pointe
sur le serveur local). Deux ajustements du banc à l'app d'aujourd'hui : « Baisser le prix » propose
« Dans les N h » par défaut (5.370) ⇒ le scénario d'envoi immédiat touche « Maintenant » ; l'extension
attend 2–5 min après une ouverture de Vinted (`vrmOuverture`) ⇒ l'heure d'ouverture notée est reculée
d'une heure (le temps passé ; aucune porte retirée). En local : **39 verts / 2 rouges**.

## Restes (non bloquants, dits)
- e2e-extension : « l'app dit le plafond » et « un 429 pose la pause » — après une première baisse, la
  feuille ne remonte plus la paire (`L2` vide) : règle de l'app à relire avec le banc.
- WebKit : `nouveau-vendeur` (requêtes « due to access control checks », bouton « N°1 » sur deux lignes au
  Stock), `iphone-reprise` R (`clock.setSystemTime` sous WebKit), `ventes-e2` (onglet planté une fois).
- Les deux jobs restent NON bloquants.

Geste de Julien : aucun.
