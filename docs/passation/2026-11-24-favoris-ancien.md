# 24 nov. 2026 — Extension 5.440.2 : plus de « Favori trop ancien » à tort ; la liste des notifications indexée

Branche `claude/favoris-ancien`. Capacité `favorislisteentiere` = **5.440.2** (les PR ouvertes portent 5.441–5.451 : celle-ci
passe dessous et se merge EN PREMIER).

## Ce que Julien a vu (24 nov. 17:45–17:48, Paris)

Compte tomj606 (uid 3170801262), Messages aux favoris, 6 favoris : « 0 envoyés · 2 sautés · 4 en attente ». Les deux sautés :
« Sauté · Favori trop ancien pour Vinted » (adidas spezial vert 39,5, N° 234 ; adidas handball spezial marron 36, N° 227).
Le 3ᵉ « En cours · Ouverture de la conversation… », puis les autres « Ignoré · arrêté avant son tour » (« Tout arrêter »).
Puis Julien : « si les favoris sont dans la cloche, rends l'extension intelligente ».

## Ce qui a été MESURÉ (vraie base, lecture seule, formes seulement)

| constat | valeur |
|---|---|
| file du serveur (`favoris_file_…4ebee2`) | 3 tâches `ignore`, `favori_trop_ancien`, `etape: conversation` (items 10880751436 ×2, 10872053464), 16:46:47 → 16:47:40 UTC, ~25 s chacune |
| leur rang dans la liste de Vinted (`harvest_3170801262_notifications`, capturée 16:47 UTC, `per_page` 20, 49 lignes, 3 pages) | **1, 2 et 4** — tout en HAUT de la liste, dates 23–24 nov. |
| forme du lien | web `/items/N/want_it/new?offering_id=U` (U = le destinataire de la tâche) |
| relevé passif de la page (`seen_urls`) | une seule lecture de la cloche sur `api.vinted.fr` à 16:46:25 ; aucune page `/member/notifications` relevée |

**Conclusion** : ce n'est PAS « la cloche ne montre que les dernières ». La lecture de la cloche par VRM (`GET
api.vinted.fr/inbox-notifications/v1/notifications`) les a TROUVÉS (sinon l'étape serait `cloche`). C'est l'étape suivante,
dans la PAGE, qui n'a pas trouvé la ligne (ni dans la cloche ouverte, ni sur la page complète) et la 5.440.1 a conclu « trop
ancien » d'une simple absence à l'écran. La forme exacte de la ligne sur la page de Vinted n'a jamais été relevée (le lien
de la ligne peut porter d'autres paramètres, la liste peut vivre dans un bloc qui défile, sa suite peut venir lentement) :
la cause précise ne se prouve que sur son compte. La 5.440.2 rend le résultat SÛR quelle que soit cette cause.

## La règle (5.440.2)

1. **« Pas trouvé dans tes notifications » (ex-« trop ancien ») ne se dit que si la liste de Vinted a été lue jusqu'à sa
   DERNIÈRE page** (`pagination.total_pages`) sans la ligne. Une page de l'écran qui ne la montre pas ne prouve RIEN.
2. **La liste est indexée une fois** (`listeClocheJusqua`, `vrmIndexCloche` dans `chrome.storage.local`) : chaque page lue,
   chaque ligne par son id ET par ses deux identités tirées de son lien (web `/items/N/want_it/new?offering_id=U` ou
   d'application `vintedfr://messaging?item_id=&user_id=`). Les favoris suivants vont DIRECTEMENT à leur page ; l'index ne
   vaut que 10 min, pour ce compte, tant que la tête de la liste (5 premiers ids) n'a pas changé. Au plus 6 pages lues
   (GET, onglet de travail, 0,6–1,5 s entre deux) ; au-delà, rien n'est conclu.
3. **Une ligne d'un AUTRE id mais des mêmes article ET personne** (une seule) est celle du favori ; même article, autre
   personne : jamais.
4. **Sur la page** (`vrm-formulaire.js`, `__vrmFormulaireV` 7.3) : la ligne se reconnaît par ses deux identités quelle que
   soit la forme de son adresse (`identiteLigneFavori` : `/items/N/want_it…` ou `item_id=N`, ET `offering_id`/`receiver_id`/
   `user_id` = la personne, une seule clé ; un autre paramètre `…_id` ⇒ refusée). La page complète est lue jusqu'au bout :
   fenêtre ET bloc qui défile (positions posées : `scrollTo`, `scrollTop`), « Afficher plus » s'il est seul, 4 s pour chaque
   suite, arrêt après 3 essais sans rien de neuf ou 90 s. ⚠️ **Aucun événement fabriqué** : un `dispatchEvent(new
   Event('scroll'))` a été essayé (90e6337e4) puis RETIRÉ — `isTrusted:false` est la même preuve d'automatisation que la
   souris et le clavier (§3). C'est le navigateur qui envoie son propre « scroll ».
   ⚠️ **Limite mesurée en simulation** : l'onglet de travail est en ARRIÈRE-PLAN ; le navigateur n'y rend rien, donc
   n'envoie pas son « scroll » — une liste qui charge sa suite au défilement ne la charge pas. D'où la règle 4 bis.
4 bis. **L'adresse NATIVE du favori** (Julien : « c'est à l'extension d'aller capter les favoris et d'actualiser l'écran, pas
   à moi » ; refusés : « ouvre la page des notifications », « garde l'onglet devant ») : la liste de Vinted est lue comme
   DONNÉE (règle 2, GET paginé depuis l'onglet, lecture) ; quand la ligne n'est pas dans la cloche montrée (ou qu'elle est
   plus bas que ce que la cloche montre), le lien web de SA notification (`/items/N/want_it/new?offering_id=U`, la forme
   mesurée sur tomj606, article ET personne vérifiés) est OUVERT dans l'onglet de travail (`favoriLien`, une navigation
   comme au clic de la ligne, aucun événement fabriqué) : la page de Vinted ouvre la conversation elle-même (relevé passif
   du 23 nov. : `/inbox/want_it` puis `POST …/inquiries` 201). Rien ne dépend du rendu ni du défilement. Lien
   d'application seulement (`vintedfr://…`, pas d'adresse web relevée) ⇒ la page complète, comme avant.
   ⚠️ À confirmer sur un vrai compte : que l'adresse `want_it` ouverte directement ouvre bien la conversation (le
   relevé le montre ; la simulation le reproduit). Sinon : rien n'est envoyé, « en recherche ».
5. **Pas trouvée sur la page alors que la liste de Vinted la contient** ⇒ `notification_pas_trouvee` : rien n'est écrit, le
   favori **attend** (il repart après les autres ; seul, dans 3 min), une fois, puis « pas envoyé · notification en
   recherche (VRM réessaie seul) » — aucune consigne à Julien ; il redevient sélectionnable. Jamais sauté pour ça.
6. **Ordre** : la file part des favoris les plus RÉCENTS (date de leur notification ; `ordreRecents`, `api/_lib/favoris.js`) —
   ceux que la cloche montre — puis les plus anciens.
7. **Directement la page complète** : quand la cloche n'a pas montré une ligne, VRM retient combien elle en montre
   (`vrmTailleCloche`, 24 h) ; un favori plus bas dans la liste de Vinted va droit à la page complète.
8. Inchangé : clics dans la page seulement (ni `chrome.debugger`, ni souris ni clavier réels, ni rythme « humain »), 15/h,
   50/h réserve 5, une à la fois, pause 429/403, arrêt au captcha.

## Preuves

Voir la section « Résultats » ci-dessous (simulation de la vraie extension, audits, mutations).

## Gestes de Julien
- Installer l'extension **5.440.2** (⟳ dans chaque Chrome).
- Relancer les 2 favoris sautés : ils repartent (rien n'avait été écrit pour eux).
