# 16 nov. 2026 — Les 5 captures iPhone de Julien (lot bugs-captures-16nov)

Branche `claude/bugs-captures-16nov` (depuis `origin/main` ec97a8bfe). Captures reçues : Ma journée (haut, bas),
Ventes · À expédier, fiche d'une vente (haut, bas).

## Ce que les captures montrent VRAIMENT

Les captures portent l'heure 23:00–23:03, alors que la session tournait le 16 nov. vers 19 h 30 (heure de Paris) :
elles datent au plus tard du **15 nov. au soir**, avant plusieurs mises en ligne du 16 (vérifié sur le code et
sur la production, Vercel prod = `main`) :
- « Contrôle de cette nuit : 1 741 ventes à dater » — retiré par la 5.390 (versements-auto, fusionné le 16 à
  05 h 21) ; Ma journée ne porte plus la carte du contrôle (d6015f44f) ; la source « ventes à dater » n'est plus
  dans « À trancher » (6495a5abe). Le « 1 762 » des captures = 1 741 à dater + 21 : mesuré (lecture seule,
  projection scalaire) `vinted_urssaf_mois.aDater.n = 1 731` sur son compte.
- Ventes · À expédier en « TeteStudio » (« Tous 3 · Colissimo · Transporteur inco… », « Classique · A4 ▾ ») et la
  fiche de vente à frise de 7 étapes avec « pas lu » × 4, « Emballage non saisi » en ambre : remplacés le 15–16 nov.
  (Verre dépoli : segment À envoyer / En route / Toutes, tuiles derrière « … », plus jamais de tuile
  « Transporteur inconnu » ; fiche D ; emballage non saisi discret, `ventes-verre.css`).
⇒ Si Julien voit encore ces écrans, son iPhone tourne sur une version gardée : fermer l'app (balayer) et la rouvrir.

## Ce qui restait sur `main` et qui est corrigé ici (banc rouge sur main, vert après)

1. **« Au moins 98 choses à trancher »** (feuille « Tout va bien ? ») : la somme comptait ce que d'AUTRES cartes de Ma
   journée disent déjà (36 annonces sans prix d'achat, 60 colis à vérifier, N° à écrire…) — le même nombre deux fois
   (§7). `src/aTrancher.js` : `JOB_SOURCE`, `sansSourcesDites`, `sourcesDitesPar` ; Ma journée ne compte que le
   reste (« Au moins 2 choses à trancher »). L'écran « À trancher » garde tout.
2. **« Colis à vérifier · délais dépassés · pas encore relié »** ne disait pas quoi faire ⇒ la ligne dit le geste
   (« Vérifie leur suivi avant d'y aller » / « Pas encore relié : ouvre l'achat sur Vinted »), les raisons comptées
   restent dans l'infobulle (`data-job-geste`, `data-job-raisons`). 5 langues.
3. **Fiche d'un colis, feuille « Plus »** : l'icône carton grise (transporteur pas lu, sans nom) seule à gauche
   d'« Imprimer le bordereau » se tait (comme sur la ligne de vente) ; la tuile « Bordereau » ne redit plus le geste
   de la ligne (contexte colis, `FichePaire.jsx`).
4. **« L'état »** : « achat pas relié à cette paire » sous deux chiffres ⇒ dit une fois sous le titre.
5. **À expédier** : titres sur deux lignes au plus (plus « New Balance spezial taill… »).
6. **« 9 autres · Choisir »** ⇒ « 9 colis n'y sont pas · Choisir » (sous « Imprimer les N bordereaux »). 5 langues.

## Preuves

- Banc `scripts/bancs/bugs-captures-16nov.cjs` (base inventée 3 comptes / 2 000 ventes, presque toutes sans date de
  versement ; publication « À trancher » posée sur l'appareil ; 390 tactile et 1512, clair et sombre) :
  **main (ec97a8bfe) 13 ✅ · 20 ❌** (T, V, O, B, S rouges partout, E à 390) ; **après 31 ✅ · 2 ❌** — les deux
  rouges restants sont des préconditions d'une machine à charge 35 (une ligne pas encore là, T0), pas la règle.
- Mutation (build avec `sourcesDitesPar` vidé et la règle CSS retirée) : T (98 au lieu de 2) et O rouges.
- Audits : traduction, a-trancher, onglets-a, retrait-fiable, suivi-colis, tdz, variables, quoi-de-neuf,
  textes-courts, icônes : verts.
- Captures regardées : `…/scratchpad/shots/banc-apres/` (journée, à expédier, feuille Plus, L'état ; 4 variantes).
- Outils de regard (pas des bancs) : `scripts/bancs/_explore-captures.cjs`, `_explore-eval.cjs`.

## Pas fait (dit)
- Tuiles de transporteurs coupées à gauche (« ous 3 ») : sur `main` elles vivent derrière « … », dans un conteneur
  sans rognage (mesuré) ; pas reproduit sans transporteurs lus dans la base de banc.
- Feuille « Plus » d'un colis : « Frais Vinted − 0 € », « Frais notés − 0 € », « 0 € de frais » redisent le même
  zéro (§7) — pas touché.
- La « date 22 nov. » sur une ligne « vendue aujourd'hui » (capture 35) : sur `main` la ligne dit « avant le 19 nov. ·
  dans 3 j » (date limite, étiquetée) — rien à faire.

## ÉTAT À LA REPRISE
Branche poussée ; PR ouverte (voir le rapport). Geste de Julien : fermer et rouvrir l'app sur l'iPhone si les
anciens écrans reviennent.
