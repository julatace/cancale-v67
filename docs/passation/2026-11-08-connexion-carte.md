# 8 nov. 2026 — Extension 5.328 : se connecter DANS l'extension (carte du logo et fenêtre), pas d'envoi sans connexion

Branche `claude/connexion-carte` (depuis `claude/amazing-lovelace-xd7obl`, qui porte la 5.327 pas encore
publiée). Pas de PR, pas de merge (consigne).

## Ce que Julien a dit (8 nov., capture iPhone, Orion, extension 5.326 sur vinted.fr)
La carte disait « COMPTE VRM UTILISÉ : Pas connecté — clique pour te connecter », « TES DONNÉES : Dernier
envoi refusé à l'instant — connecte-toi à VRM pour que ça reparte », « VRM s'ouvre et connecte
l'extension — rien à taper ici » et un seul bouton « Se connecter avec VRM ».
- « Ça pue. Je veux que tu mettes directement l'endroit de connexion avec le mot de passe, le Google,
  Discord, parce que "Se connecter" change de page VRM et ça ne se connecte pas. »
- « Je ne veux pas avoir besoin d'aller sur le site pour connecter l'extension. »
- « Il ne doit pas y avoir d'envoi si l'extension n'est pas connectée. »
- « Fais tout parfaitement sur l'extension, améliore le visuel — c'est de là que part l'application. »

## La cause (lue dans le code, prouvée au banc — pas mesurée sur l'iPhone)
« Se connecter avec VRM » ouvre `vrm.center/?lier-extension=<id>` ; l'app connectée fabrique une session
pour l'extension et la lui ADRESSE (`versExtension`). Deux canaux : le canal direct
(`chrome.runtime.sendMessage(id, …)` depuis la page, `externally_connectable`) et le pont de la page
(`bridge.js`, message `adresse`).
- Le paquet Orion n'a PAS `externally_connectable` (`scripts/zip-extension.cjs`, `manifesteOrion`, le retire).
- Mais la page peut quand même porter un `chrome.runtime.sendMessage` (Orion, note de version : « externally_connectable.matches
  avec runtime.sendMessage échoue », ticket 13767). Avec un identifiant à 32 lettres, l'app prenait le
  canal direct ; un envoi qui ne répond JAMAIS (ni réponse ni erreur) finissait au délai de 5 s, et l'app
  ne repasse par le pont que sur un refus CERTAIN (exprès : jamais deux envois sur un simple délai) ⇒
  « absente », rien de connecté. VRM s'était ouvert, la page avait changé, l'extension restait « Pas connecté ».
- Prouvé : `scripts/bancs/liaison-pont-orion.cjs` (vraie app `dist`, canal direct muet, faux pont) — sur le
  build de la branche de départ : 3 rouges (la liaison part au canal muet, rien par le pont, aucune
  session) ; sur la 5.328 : 4 verts.
- « Dernier envoi refusé à l'instant » sans être connecté : RIEN n'était parti (aucun `fetch` sans jeton —
  vrai déjà en 5.327, mesuré S1 sur le code d'avant) ; c'était l'étiquette `sans_session` qui était rangée
  comme un refus.

## Ce qui change (5.328)
**1. La connexion est DANS l'extension, partout (Chrome, Edge, Firefox, Orion)** — `popup.js`, le même code
pour la fenêtre de l'icône et la carte du logo (`?mode=carte`) :
1. « Email de ton compte VRM » / « Mot de passe VRM » (champs 44 px, 16 px, étiquetés), « Me connecter »
   (bleu, le seul), Entrée ; champs vides et email mal formé dits AVANT tout envoi ; service worker muet
   20 s ⇒ « L'extension n'a pas répondu… » (jamais un bouton figé) ; « Mot de passe oublié ? » →
   `vrm.center/?connexion&mot-de-passe-oublie` (l'app ouvre directement la récupération, `mode 'reset'`).
   Le mot de passe part UNE fois au service worker (`authLogin`, inchangé) → Supabase ; jamais gardé,
   jamais dans une adresse ; aucun onglet VRM ouvert. Captcha : le refus est dit, et le seul recours qui
   marche (« Se connecter avec VRM ») proposé — **mesuré le 8 nov. : Turnstile n'apparaît pas dans
   `/auth/v1/settings` et CLAUDE.md le dit « prêt et éteint »** : le mot de passe marche aujourd'hui.
2. « ou », puis « Continuer avec Google » / « Continuer avec Discord » (seulement activés — mesuré le
   8 nov. : `google: true`, `discord: true`).
3. Tout en bas, en petit lien : « Rien ne marche ? Se connecter en passant par le site VRM » (l'ancien chemin).

**2. Google / Discord sans passer par l'app** (`background.js`, `oauthDepart` / `oauthRetour`,
`oauth-retour.js`, `public/extension-retour.html`) :
- clic ⇒ le service worker tire un vérificateur PKCE (rangé dans `chrome.storage.local`, 10 min, une fois)
  et ouvre un onglet `…supabase.co/auth/v1/authorize?provider=…&redirect_to=https://vrm.center/extension-retour.html&code_challenge=…&code_challenge_method=s256` ;
- Google/Discord → Supabase → `https://vrm.center/extension-retour.html?code=…` : une page FIXE, sans
  l'app ni aucun script ; le script de contenu `oauth-retour.js` (document_start, vrm.center seulement)
  remet le code au service worker, qui vérifie l'origine (vrm.center), le départ en cours (≤ 10 min,
  consommé avant l'échange) et échange avec SON vérificateur (`grant_type=pkce`) ⇒ session rangée dans
  l'extension (`depuis` daté), onglet fermé, retour à l'onglet de départ ; la carte nomme le compte.
- annulé / refusé / réseau / plus de 10 min ⇒ la phrase (stockée `vrmOAuthEtat`, montrée par la fenêtre) ;
  compte Google NEUF (créé < 10 min, sans identité email) ⇒ « un compte VRM neuf vient d'être créé… ».
- adresse de retour pas encore autorisée chez Supabase ⇒ Supabase renvoie sur sa « Site URL »
  (`vrm.center/?code=`) : le même script la reprend, SEULEMENT si un départ de l'extension est en cours et
  que la page n'a pas son propre départ (`vrm_pkce`, `vrm_oauth_liaison`) — une connexion de l'app n'est
  jamais touchée. L'app affiche alors brièvement « Connexion expirée » avant que l'onglet se ferme.
- Pourquoi pas `chrome.identity.launchWebAuthFlow` : une autorisation de plus dans le manifeste (fiches des
  boutiques à refaire) et rien ne dit qu'Orion l'a ; ce chemin n'utilise que les onglets et un script de
  contenu sur vrm.center, qui existent partout. **Aucune autorisation ajoutée** (`audit-paquets-boutiques` vert).

**3. Orion : la liaison par le pont d'emblée** — `bridge.js` dit `canal: 'pont'` dans son « ready » quand
SON manifeste n'a pas `externally_connectable` (mesuré dans le manifeste, jamais deviné) ; l'app
(`__vmrPontSeul`, `versExtension`) parle alors à cet identifiant par le pont, un seul envoi, mêmes règles
(origine, nonce 2 min, une fois, compte annoncé). Chrome inchangé. `ID_EXT` accepte aussi un UUID nu.

**4. La carte du logo** (`vrm-badge.js`) : pas connecté ⇒ toucher/cliquer le logo ouvre la carte AVEC la
connexion dedans (iframe de l'extension posé sous l'état, gardé d'un rendu à l'autre, hauteur donnée par
le cadre via `__vrmCarte` — « prete » et « hauteur », rien d'autre ne sort du cadre) ; plus de
« VRM s'ouvre… rien à taper » ; « Pas connecté — connecte-toi ci-dessous » ; un formulaire ouvert ne se
ferme pas au survol ; cadre pas affiché en 6 s ⇒ la carte le dit et propose « Se connecter avec VRM ».
Connecté depuis la carte ⇒ elle reste ouverte : « C'est fait : l'extension est connectée à <email> ».
Tout est à jour ⇒ « Tes données sont à jour · il y a 2 min ».

**5. Pas d'envoi, pas de « refus », sans connexion** (`supabaseUpsert`, `appelCommandesServeur`,
`noterFlux`) : sans session (aucune, morte, renouvellement raté UNE fois) rien ne part — et rien n'est
noté comme refus (ni `_statutDernierRefus`, ni `vrmFlux.refus`, ni `ecriture_ratee_*_sans_session`) ;
`vrmFlux.<site>.attenteAt` ⇒ « En attente : connecte l'extension pour envoyer tes données » (gris) ;
l'historique des refus ne liste jamais un « pas de session ». Un refus daté d'AVANT la connexion
(`depuis`) ne dit plus « connecte-toi » ni n'allume l'ambre. Dès la connexion (mot de passe, Google,
liaison) : `visiteApresSession` relance la visite de l'onglet Vinted ouvert (capture fraîche). Leboncoin et
Vestiaire, eux, captent en passant : la page suivante envoie.

**6. Le visuel** : fenêtre et carte aux jetons de l'app (`--d-*`, DESIGN.md) — fond #F2F2F7 / #000, cartes
#FFF / #1C1C1E, filets iOS, bleu Apple #0071E3 / #0A84FF (le seul accent, sur « Me connecter »), ambre
#B25000 / #FF9F0A (un geste), police système, 15 px, rayons 12/14, boutons secondaires remplis gris
(iOS), pression `scale(.98)` ; la carte est en verre (`backdrop-filter`, clair et sombre), 320 px, une
colonne ; le logo flottant noir pur.

## Gestes de Julien
1. **Supabase → Authentication → URL Configuration → Redirect URLs : ajouter
   `https://vrm.center/extension-retour.html`** (une seule adresse, la même pour Chrome, Edge, Firefox
   `vrm@vrm.center` et Orion — la page de retour est sur vrm.center, pas dans l'extension). Si
   `https://vrm.center/**` y est déjà, rien à faire. Site URL : `https://vrm.center`.
2. Installer la 5.328 (zip, ou `VRM-Orion-dossier.zip` sur l'iPhone) ; la page de retour doit être en
   production (fusion de cette branche, `public/extension-retour.html`).
3. Sur l'iPhone : toucher le logo VRM sur vinted.fr → email + mot de passe VRM → « Me connecter ».

## Preuves (§6)
- `scripts/audit-sans-session-envoi.cjs [--prouve]` (VRAI background.js) : 8 verts ; sur la 5.327
  (`origin/claude/amazing-lovelace-xd7obl`) : 5 rouges ; 2 mutations attrapées.
- `scripts/bancs/liaison-pont-orion.cjs` : 4 verts ; build de la branche de départ : 3 rouges.
- `scripts/tests/orion-pont-canal.cjs` (vrai bridge.js) : vert ; sur l'arbre de départ : rouge.
- `scripts/audit-extension-oauth.cjs` : + O1–O6 (PKCE, retour, origine, une fois, 10 min, annulé) : 0 rouge.
- `scripts/bancs/badge.cjs` : 126 verts (connexion dans la carte au doigt clair/sombre, cadre muet,
  connecté depuis la carte, refus d'avant la connexion, « en attente » sans « sans session ») ;
  `scripts/bancs/popup.cjs` : 149 verts (ordre mot de passe → Google/Discord → site ; oauthDepart ; refus dit ;
  jetons de l'app). Règles jugées (ordre, data-*, couleurs calculées), pas l'orthographe.
- `audit-coherence`, `audit-extension-zip`, `audit-paquets-boutiques`, `audit-extension-captcha`,
  `audit-pont-session`, `audit-liaison-visite`, `audit-extension-navigateurs`, `audit-extension-ui`,
  `audit-violet`, `audit-fonctions-api` : verts ; `npm run build` OK.

## Pas fait / pas vérifié
- Rien n'est mesuré sur un vrai iPhone : qu'Orion ouvre l'onglet Supabase (`tabs.create`) et lance
  `oauth-retour.js` au retour.
- Les panneaux posés dans les pages (Republier, favoris, capture) ne sont pas repassés au visuel.
- Que GoTrue garde un code PKCE après un échange raté avec un AUTRE vérificateur (cas d'une connexion de
  l'app et d'une de l'extension lancées dans les mêmes 10 min, repli Site URL) : non mesuré.
