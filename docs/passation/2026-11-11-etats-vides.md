# 11 nov. 2026 — Les quatre états de chaque écran (lot « états vides »)

Branche `claude/etats-vides`, partie de `origin/main` (76445c0). Rien fusionné sur `main`.

## Le banc : `scripts/bancs/etats-vides.cjs`

Base INVENTÉE (aucune fixture), servie par `_minipgrest`. Treize écrans — Ma journée (`journee`),
Annonces, Ventes, Achats, Stock (`garage`), Argent (`compta`), Messages, E-mails, Paramètres
(`settings`), Statistiques (`dashboard`), Leboncoin, eBay, Vestiaire (`plat_*`) — chacun dans
quatre états, à 390 px tactile et 1512 px, clair et sombre :

| état | ce qu'on sert | ce qu'on exige (lu sur le RENDU) |
|---|---|---|
| **V** vide | `main` seul, aucun compte | l'écran parle, un geste visible, pas le garde-fou, ni « 0,00 € », ni « au moins 0 », ni « lecture… » au bout de 6 s, ni « Tout est à jour » |
| **P** pas su | un compte, toute lecture `app_data` hors `main` en 500 | ni « 0,00 € », ni « Aucune vente/annonce/… » seul (« Aucune vente **lue** » est permis : il dit la lecture), ni « Tout est à jour » |
| **B** base injoignable | toute la base et `/api` en 503 | `BaseInjoignable` UNE fois, aucun « Tout est à jour », **aucun POST/PATCH/DELETE** |
| **H** hors ligne | un écran lu (copies gardées), puis base qui hoquette, puis réseau coupé, puis retour | « Vu à hh:mm · pas relu » une fois ; « Hors connexion — dernier état du … » une fois ; au retour une relecture part et les deux mentions s'en vont |

Variables : `LARGEURS`, `THEMES`, `ETATS=V,P,B,H`, `ECRANS=journee,…`, `SHOTS=dossier`, `BANC_PORT`
(aléatoire par défaut), `ATTENTE_V` (6 s). Navigateur : `/opt/pw-browsers/chromium`.

## Les trous trouvés, et le correctif (au plus juste)

1. **« lecture… » à l'infini sur un compte neuf** (Achats, Annonces, Ventes, Argent, Statistiques,
   Leboncoin/eBay/Vestiaire) : sans aucun compte, rien ne sera jamais lu, et les cases attendaient.
   ⇒ la coque PROUVE l'absence de tout compte (`sansAucunCompte` : liste Vinted lue et vide, lignes
   Leboncoin/Vestiaire/eBay lues et absentes, aucun compte eBay au registre, base joignable) et la
   passe par un contexte (`SansCompteCarte`, `useSansCompte`) ; `useSourcesCarte` la porte
   (`sources.sansCompte`) ; `sansCompteSur` (src/design/carteChiffres.js) change seulement la RAISON
   d'un chiffre inconnu (`encours`, `pasSu`, `publication`, `colis`) en « aucun compte relié ».
   Toujours « — », jamais 0 ; une valeur connue reste. Argent (les quatre réponses) et « Marge par
   plateforme » lisent la même chose. Pas su ⇒ `false`, rien n'est deviné.
2. **Messages · Tous muet sur un compte neuf** (« Lecture… », aucun geste) ⇒ la carte « Aucun compte
   Vinted lié · Relier un compte » (`NoAcc`) et la part Vinted des fils est vide (`[]`), pas « en cours ».
3. **Stock : « au moins 0 annonces actuelles »** (§5 : « au moins 0 » ne se dit jamais) ⇒ « — ».
   Sans compte : un bouton « Relier un compte » (`data-stock-sans-compte`).
4. **Annonces sans compte** : la section « Vérifications » (« Données · Lecture… ») n'a rien à vérifier
   ⇒ elle se tait quand `noAcc` (la carte « Relier un compte » reste).
5. **Base injoignable : Paramètres écrivait** — la sonde « Sécurité des données » envoyait son POST
   (deux fois la même ligne, annulé par conception) même quand la base ne répondait pas. ⇒ si la
   première lecture de la sonde n'a pas répondu (`colonne === null`), aucun envoi, « pas su ».
   Le panneau n'est pas « simplifié » (§5), seul l'envoi vers une base muette est retiré.
6. **Retour du réseau : « Vu à hh:mm · pas relu » restait** — les commandes gardées (lot K) ne se
   revalident qu'au préchargement, une fois par ouverture ; les écrans remontés relisaient par un autre
   chemin et la mention ne partait jamais. ⇒ à l'évènement `online`, s'il reste des copies pas relues :
   caches de lecture vidés (module, avant le remontage des écrans) et préchargement relancé — la MÊME
   règle `lireAvecCopie` (src/copieLignes.js n'est pas modifié). Réussi ⇒ la mention part ; raté ⇒
   elle reste. Plus un écouteur dans l'écran ouvert (même chemin que le retour sur l'app, sans Vinted).

## Preuves

- Rouge sur `origin/main` (`git archive`, banc copié dedans) : V 390 clair **10 KO** (les « lecture… »,
  « au moins 0 », Messages) ; H **KO** (« pas relu » reste au retour) ; B Paramètres **KO** (POST de la sonde).
- Vert ici : voir la dernière ligne de la passe complète dans le récit de la session (ci-dessous).
- `npm run build` vert ; audits variables, tdz, identite, icones, textes-courts, fonctions-api, secrets
  verts ; coherence : 1 « non conforme » préexistant (clone superficiel, versions publiées illisibles,
  même chose sur `origin/main`) ; argent, carte-chiffres, marge-plateforme, fil-unique, onglets-a,
  journee-coherence, lectures-lourdes, benefice-unique, objectif-mois verts.

## Ce qui reste / notes

- `plat_leboncoin`, `plat_ebay` sur un compte neuf ouvrent Ventes (filtre du site), `plat_vestiaire`
  Annonces : c'est le hub actuel, pas un trou ; servis tels quels.
- E-mails sur un compte neuf : « Ta boîte VRM : pas su pour l'instant » quand `/api` ne dit rien —
  le banc sert `{}` ; la phrase est honnête (pas su ≠ vide) et porte « Réessayer ».
- La ligne de fraîcheur dit « Vérification de tes données… » longtemps sur un compte vide (banc :
  `/api` muette) ; ce n'est pas « Tout est à jour », laissé tel quel.
- Colis non touché (en cours ailleurs).
