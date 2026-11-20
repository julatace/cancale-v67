# 20 nov. 2026 — « Tout comme Bleam », la suite (ext. 5.410.4, branche `claude/bleam-suite`)

Contient la fusion de `claude/comme-bleam` (5.410.3 : republication par le formulaire, séquence des favoris).
Zips NON régénérés (l'intégration le fera). Version 5.410.4 : manifeste, `CODE_VERSION`, `lbc-inject.js`,
`lbc-relay.js`, `EXT_ATTENDUE` ; capacités `apresvente stockauto cyclevie sauvegardeauto dressingplus negotranches favfiltres`.

Tout se règle dans le panneau de l'extension (Automatisations), PAR COMPTE, ÉTEINT par défaut, allumer = « Oui,
allumer ». Une seule règle de réglage : `vinted_bleam.comptes[uid][section]` dans `vrm_reglages_auto`
(`src/reglagesAutoLigne.js`, bloc recopié dans background.js : `bleamDe`, `bleamSection`, `BLEAM_PRESETS`).

1. **Après-vente** (`apresVenteTick`, `apresVenteAFaire` règle pure) : bordereau commandé dès la vente par compte
   (en plus de l'interrupteur de l'app ; Colissimo « point relais » = rien forcé, « boîte aux lettres » = la valeur
   `drop_off_type` APPRISE de sa commande à la main, sinon rien et dit ; Vinted seul, jamais eBay) ; messages après
   la vente, après la finalisation, rappel 24 h après l'arrivée au point relais, demande d'évaluation 24 h après la
   fin (versions au hasard, jamais deux fois le même texte) ; évaluation 5 étoiles par le GESTE APPRIS (sa propre
   évaluation rangée `harvest_*_wreq_*feedback*`, clés connues seulement ; jamais vu ⇒ rien). Litige ⇒ rien. Au
   premier passage d'un compte, le passé est noté sans rien envoyer. Chaque geste noté AVANT de partir.
   **Stock auto** : vente prouvée ⇒ son annonce ⇒ sa fiche ⇒ son N° ; quantité posée par lui (≥ 2) ⇒ remise en
   ligne par `recreerVinted` `dupliquer` + méthode directe (l'annonce vendue n'est jamais supprimée), puis − 1.
2. **Négociation** (`src/negociationPaliers.js` = `palierContreOffre`) : tranches « de X à Y € : baisse max Z € »,
   bonus de lot, arrondi 1 € / 0,50 €, « rester flexible » (acceptée si l'écart au palier ≤ N € et au-dessus du
   plancher), messages par étape (acceptée / contre-offre / finale, `{price}`), délais tirés au hasard. Plancher
   ABSOLU : prix mini, sinon achat + 10 % — jamais en dessous.
3. **Cycle de vie** (`cycleVieTick`, `cycleAction` pure) : Anti-stagnation, Déstockage, Vierge ; plafond de baisse
   totale depuis le prix d'ORIGINE (gardé par N° à travers les republications), plancher §3, rythme par jour (min–max
   tiré au hasard), jours et plage horaire (heure de Paris). Baisse = la même commande `cmd_prix_*` que la baisse
   par règle ; republication = `executerCommande` (le chemin gardé de Republier).
4. **Dressing amélioré** (`vrm-dressing.js`, `dressingPlus`/`dressingAction`) : profil du compte de l'onglet seul ;
   plaque N° par identité, cases, tri et filtre « sauvegardées » à l'affichage ; barre : Sauvegardes, Planifications,
   Stock auto, Planifier, Modifier (page de Vinted), Republier (atelier, son « Lancer »), Supprimer (sa confirmation,
   10 au plus, gardes strictes, journal `supprimee`).
5. **Sauvegarde horaire** (`sauvegardeAutoTick`, le coffre depuis la dernière lecture, aucune requête Vinted) ;
   **analyse des favoris** (`analyseFavoris` : par version, envoyés / réponses sur conversations relues ;
   envois notés dès 5.410.4) ; **filtres des favoris** (note, par article, période, délai, réécrire) appliqués à
   l'aperçu ET au geste (`favoriFiltre`).
6. **App** : rôle par compte Vinted (Paramètres › Comptes liés › Gérer : vente / achats / personnel,
   `vrm_roles_comptes`, `src/rolesComptes.js`) ; un compte personnel sort du CA déclaré (`venteOffDeclareOf`) et
   des totaux de Comptabilité, comme un compte écarté. ⚠️ Pas encore recopié côté serveur (bilan de la semaine,
   widget) : à faire par la même règle.

Refusé et non fait : photos modifiées « anti-doublon », empreinte / IP par compte, tout camouflage.

Preuves : `audit-bleam-suite` (50, `--prouve` 12 mutations), `audit-negociation-paliers` (22, 8 mutations),
bancs `grand-panneau` (416) et `dressing-ameliore` (22) ; coherence, actions-gardees, discretion, traduction,
extension-feuille, quoi-de-neuf, identite, urssaf, reglages-auto, moteur-offres, regles-auto, comme-bleam verts.
Geste de Julien : installer 5.410.4 ; pour l'évaluation auto et la « boîte aux lettres », faire le geste une fois à la main.
