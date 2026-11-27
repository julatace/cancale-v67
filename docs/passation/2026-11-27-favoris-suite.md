# 27 nov. nuit — Favoris : la suite de la 5.455.4 (ext. 5.455.5)

Branche `claude/favoris-suite` (partie de `claude/favoris-tous-les-cas`, PR #1453). Données des bancs INVENTÉES.

## Ce qui est livré
| point | avant | maintenant | preuve |
|---|---|---|---|
| C7 · fenêtres d'autorisation (60 s `consommer`, 90 s `verifier`) | une attente derrière une autre action (file de l'extension, une requête Vinted à la fois) pouvait périmer l'autorisation | **bail** renouvelé toutes les 30 s par l'extension qui mène la tentative (`avecBailFavori` → `prolonger`) ; les fenêtres se comptent depuis le dernier renouvellement | test `favoris-progression` (consommer à 95 s, vérifier à 200 s) ; V42, V43 ; mutations `sans-bail`, `carte-sans-bail` |
| C8 · un verrou par compte, envoi > 120 s | une tentative de plus de 2 min passait « incertaine » au moindre `suivant` d'un autre Chrome | la file d'un compte n'a qu'une tentative (`d.enCours`), tenue par le bail ; un 2ᵉ Chrome ne réserve rien tant qu'il tient ; worker tué ⇒ plus de bail ⇒ abandon à 2 min, comme avant ; borne absolue 15 min (`BAIL_MAX_MS`) | test (2ᵉ Chrome à 300 s : rien ; sans bail : « incertain » à 121 s ; borne) |
| mode auto · pré-contrôle « sous prix mini » | prix du DRESSING (peut-être ancien) | `prixFavoriVivant` (article, page, dressing de moins de 10 min) ; pas su ⇒ rien conclu, la transaction tranche | V44, V44b ; mutation `auto-dressing-ancien` |
| chemin par clics, fenêtre « Faire une offre » (`?offer_request=true`) | le champ était déjà vidé puis tapé (I7d vert aussi sur la 5.455.3) ; mais un échec (bouton « Proposer » introuvable, champ illisible) LAISSAIT la fenêtre ouverte | toute sortie en échec avant « Proposer » referme la fenêtre ; l'offre n'est « faite » que VUE dans le fil, sinon aucun message (règle existante) | banc `interface-vinted` I7d (55,00 € ⇒ « 49,50 », proposé, vu), I7e (fenêtre refermée ; rouge sur la 5.455.3) |

Le chemin par clics reste une réserve (`vrmFavorisChemin: 'interface'`), jamais choisi seul ; le chemin par défaut fait l'offre par
l'API (V37).

Geste de Julien : installer **5.455.5** quand elle sera servie.
