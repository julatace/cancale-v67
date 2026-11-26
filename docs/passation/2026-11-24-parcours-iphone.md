# 24 nov. · La journée de Julien sur iPhone, jouée par un robot (`claude/parcours-iphone`)

Julien : « elle bug trop encore ». Il se sert de VRM surtout sur iPhone (Safari et l'app de
l'écran d'accueil). Base de travail : la pointe de `claude/style-clair` (#1326, le nouveau
look qui fusionne en premier) + `origin/main`. **Cette PR fusionne APRÈS #1326.**

## Ce qui a été joué

Banc neuf `scripts/bancs/parcours-iphone.cjs` (base INVENTÉE, jamais de vraies données) :
390 px tactile, agent iPhone 15 ; ouvrir · Aujourd'hui (jusqu'en bas) · chaque onglet de la
barre (et chacun jusqu'en bas) · une vente puis retour · imprimer · Achats → À retirer →
code en grand → retour · Annonces → une annonce → retour · Argent → Statistiques → Résumé ·
Messages · Menu → Paramètres, CHAQUE section puis retour · la loupe · paysage puis portrait ·
arrière-plan puis retour · réseau lent (3 s par lecture). Après chaque geste : P1 erreur
JS · P2 écran blanc / garde-fou · P3 le geste agit · P4 le « retour » ferme la feuille et
reste dans VRM · P5 défilement retrouvé · P6 rien de touchable sous la barre en bas de page ·
P7 texte coupé ou superposé · P8 zone touchable ≥ 44 px (sondée au doigt : une `::before`
élargie compte) · P9 sauts de mise en page · P10 < 1 s après le toucher · P11 la loupe nomme
le transporteur. Les captures sont REGARDÉES (72 par passage).

⚠️ **WebKit** : ce conteneur ne peut pas télécharger WebKit (cdn.playwright.dev refusé par le
proxy). Le banc a tourné ici sous Chromium (appareil iPhone, tactile) ; il est ajouté au
workflow à la demande `iphone-webkit.yml` (« Parcours de la journée sous WebKit »), où P10
est rouge (machine à soi). Ici la machine était chargée (≈ 5-7 par cœur) : P10 n'y est que
rapporté.

## Défauts trouvés

| # | écran | défaut | état |
|---|---|---|---|
| 1 | Achats → À retirer → code en grand (« Montre ce code au comptoir ») | le geste « retour » d'iPhone ne fermait PAS la feuille : il QUITTAIT VRM (la feuille, en portail, n'avait pas `FermeAuRetour`, contrairement à §7) | **corrigé** (`src/ventes/AchatsVerre.jsx` : `FermeAuRetourUi`, Échap laissé à FermeAuRetour) |
| 2 | la loupe (sans rien taper) | « Colis mondial_relay », « Colis vinted » : l'identifiant machine du transporteur au lieu de son nom | **corrigé** (`src/App.jsx`, ligne de résultat « colis » : `CARRIERS[carrierKey()].name`) ⇒ « Colis Mondial Relay », « Colis Vinted Go » |
| 3 | Achats (arrivée) | la section des codes de retrait (e-mails du transporteur, lue après) arrive APRÈS « À vérifier » et pousse tout de ~46 px (CLS 0,53 ; défilement décalé de ~320 px si on a déjà défilé) | **pas corrigé** — il faut tenir le panneau jusqu'à ce que TOUTES ses sources soient lues (trois états) ; chantier dans `CarteRelais`/Comptabilite, trop gros pour le train du jour. Dans `SAUTS_CONNUS`. |
| 4 | Argent (arrivée) | la carte « Tes seuils de l'année » (DAC7) arrive après le reste et le pousse de ~54 px (CLS 0,21, une fois sur trois) | **pas corrigé**, même famille ; `SAUTS_CONNUS` |
| 5 | la loupe | « Colis à retirer » arrive après « Dernières ventes » et la pousse (CLS 0,12) | **pas corrigé**, même famille ; `SAUTS_CONNUS` |
| 6 | Achats, tout en bas | la liste qui s'allonge déplace la fin (CLS jusqu'à 0,94) | **pas corrigé** ; `SAUTS_CONNUS` |
| 7 | réseau lent | l'ouverture attend la vérification de la séparation des données (PorteConfidentialite) : un aller-retour entier avant la coque (≈ 4,7 s à 3 s par lecture) | **voulu** (sécurité) ; le seuil du banc = un aller-retour + 1,5 s. (Une 2ᵉ attente de 2,5 s, l'équipe, n'existe qu'à la toute première ouverture d'un appareil.) |
| 8 | Ventes (lignes « Relier » / « + prix ») et Argent (« 27 prix à saisir ») | boîtes de 28 et 24 px de haut | **faux défaut** : leurs `::before`/`::after` élargissent la zone touchable à 44 px (mesuré au doigt) |
| 9 | Argent → « Vendu » → retour | le retour quitte VRM | **voulu** (16 et 21 nov. : Argent ↔ Statistiques sont des segments qui se remplacent, comme une barre d'onglets iOS) ; le banc revient par « Résumé » |
| 10 | Paramètres (Safari) | l'aide « VRM sur ton écran d'accueil » couvre les tuiles du bas jusqu'à « Compris » | voulu (une fois, Safari seulement) ; le robot la ferme comme lui |

Vu sur les captures, hors règle du banc (cosmétique, pour le train du look) : la pile de
photos de « 75 € vendu dimanche » touche le bord droit et la fin de la phrase ; « À venir »
d'Argent et « Tout va bien ? Pas tout à fait » de Paramètres sont encore **orange/ambre**
(décision du 23 nov. : aucun orange) ; « Les saisir » en ligne dans « 6 derniers mois »
écarte les deux lignes de texte ; dans la fiche d'une vente, « Vendu » et « Pour toi » ne
sont pas à la même hauteur.

## Preuves

- **Avant** (`BANC_DIST` = build de la base, sans les correctifs) : `code-retour : le retour
  reste dans VRM … SORTI` (P4, plus P1/P2 : la page d'avant VRM) ; `loupe : … (P11) — Colis
  mondial_relay | Colis vinted`.
- **Après** : P4 vert (« écran achats · dans VRM », défilement 489 → 489), P11 vert
  (« Colis Mondial Relay | Colis Vinted Go ») ; 67 verts.
- **Mutation** (les deux correctifs retirés, build à part) : les deux mêmes rouges reviennent.
- Bancs voisins : `ventes-verre.cjs`, `recherche-partout.cjs` ; `npm run build`.
- `audit-stockage-sur.cjs` était déjà rouge sur la base (2 rouges identiques avant / après).

## Geste de Julien

Aucun. Pour WebKit : Actions → « iPhone sous WebKit (à la demande) » → Run workflow (branche
`main` une fois fusionnée).
