# 25 nov. soir — Filtre par plateforme dans les onglets (branche `claude/filtre-plateformes`)

Julien : « On doit avoir un filtre avec toutes les plateformes et par plateforme dans les onglets. » Et plus tôt :
« laisse le design de l'app actuel » ⇒ aucune refonte : la rangée de puces d'Annonces (`.n-ad-puces`) au téléphone,
le menu de filtres EXISTANT du tableau de travail (`[data-tt-filtre="site"]`) à l'ordinateur.

⚠️ Ce n'est PAS un retour des « onglets par plateforme » retirés le 20 nov. (#1283/#1286, `2026-11-20-sans-selecteur.md`) :
tout reste mêlé par défaut (« Toutes »), chaque rangée garde le logo de son site ; le filtre est un FILTRE de l'onglet,
choisi par lui, retenu sur l'appareil.

## Ce qui est fait

- **La règle, UNE** : `src/filtrePlateforme.js` — une ligne appartient au site de SON champ lu (`x.site`, posé par sa
  lecture) ; un article (Annonces) aux sites de ses annonces (`annonces[].site`, la règle de `filtrerArticles`). Entrées :
  « Toutes » puis chaque site PRÉSENT (moins de deux sites ⇒ aucun filtre) ; un choix rangé sans entrée ⇒ « Toutes »
  (jamais un filtre vide). Choix : `vrm_filtre_plateformes` = `{ annonces, ventes, achats }`, cet appareil seulement
  (`stockageSur`, pas dans SYNC_KEYS, ne touche à aucune donnée).
- **La forme** : `src/natif/FiltrePlateformes.jsx` — `useFiltrePlateforme(ecran)` (le choix, partagé entre les morceaux
  d'un écran par un événement), `FiltrePlateformes` (la rangée de puces, `LogoSite` + nom + nombre, 44 au doigt ; eBay :
  le logo EST le nom), `filtreTableau` (l'entrée « Site » du menu du tableau, le logo devant chaque site — `TableauTravail`
  accepte désormais `icone` sur une option), `phraseFiltre` (« Leboncoin seulement »).
- **Ventes** (`src/natif/ecrans/Ventes.jsx`) : À envoyer et En route — liste, nombres du segmenté, « N sans bordereau »,
  « N cochés », en-tête (« Leboncoin seulement ») ; le PLEIN n'imprime que les colis MONTRÉS (`g.parmi`, ajouté dans
  Comptabilite : `resumeLot` / `pleinImprimer` / `imprimerLot` sur l'intersection ; sans `g.parmi`, le plein se tait) ;
  les étiquettes retour (Vinted) seulement sous Toutes / Vinted. Terminées (`VentesToutes`, App.jsx) : le même choix,
  liste, Annulées, état de lecture du seul site choisi ; le tableau de l'ordinateur prend la même entrée.
- **Annonces** (`src/ecrans/AnnoncesEgalite.jsx`, `src/natif/ecrans/Annonces.jsx`) : le site de l'écran EST le filtre
  (liste du téléphone avec les nombres du segment, `compterArticles` ; tableau de l'ordinateur avec ses rangées, `nRangeesSite`).
- **Achats** (`src/achats/FiltreAchats.jsx`, `src/achats/nombresAchatsSites.js`) : chaque morceau PUBLIE le nombre de SA liste
  (Vinted : Comptabilite `only=achats` ; Leboncoin / Vestiaire : `AchatsSite` ; eBay : `EbayAchats`, par compte) ; un morceau
  d'un autre site reste monté mais caché (il continue de lire et de publier) ; « À retirer » suit (`siteColisDemande`).

## Ce qui n'est pas fait (et pourquoi)

- **Aujourd'hui, Argent** : leurs chiffres sont des publications d'autres écrans (« une seule règle, un seul propriétaire ») ;
  les filtrer demande que chaque publication porte son détail par site — un lot à part, pas fait ici.
- **Annonces, « Toutes » ≠ somme** : un article en vente sur deux sites compte une fois sous Toutes et sous chacun de ses
  sites (c'est la règle des segments) ; dans Ventes et Achats, Toutes = la somme.
- **eBay dans Achats** : ses achats viennent de l'API (pas de base) ; tant qu'ils ne sont pas lus, aucune entrée eBay.

## Preuves

`scripts/bancs/filtre-plateformes.cjs` (base INVENTÉE de `minimaliste.cjs --sites` + achats Leboncoin/Vestiaire inventés) :
F1 entrées + logos + nombres, F2 Toutes = somme, F3 chaque site ne montre que ses lignes (et le segmenté suit), F4 retenu
après rechargement, F5 site sans donnée ⇒ pas d'entrée, F6 aucun débordement / erreur ; 390 et 1512, clair et sombre.
Rouge sur un build d'`origin/main` (F1, F5) ; rouge par mutation (`filtrerPlateforme` sans effet ⇒ F3 de Ventes).
