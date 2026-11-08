# VRM sur l'iPhone : le parcours Orion

Sur l'iPhone, **Orion** (navigateur de Kagi, gratuit) est le seul navigateur qui installe des extensions
de boutique. Safari demanderait une app signée par Apple (Mac, Xcode, 99 $ par an — voir
`docs/boutiques-extension.md` §4) : pas pour maintenant.

## Aujourd'hui (aucune fiche publiée) — installation par fichier, SANS mise à jour automatique

C'est ce que propose l'app (Réglages → État des connexions → « Installer ou mettre à jour l'extension ») :
le fichier `VRM-Orion.xpi` (ou « Orion · en dossier »), puis Orion → Extensions → + → depuis un fichier.
⚠️ **Une extension installée par fichier ne se met jamais à jour toute seule** : c'est pourquoi l'iPhone de
Julien tournait encore en 5.322 le 8 novembre. Chaque version demande de refaire le geste.

## Demain (fiche Firefox publiée) — installation depuis la boutique

Le jour où la fiche addons.mozilla.org est validée et son adresse posée dans `LIENS_BOUTIQUES.firefox`,
l'app propose d'elle-même « Installer dans Orion » (bouton `data-premiers-geste="orion"`, `boutiqueOrion()`).

1. App Store → **Orion Browser by Kagi** → Obtenir.
2. Orion → **•••** → **Réglages** → **Extensions** → allumer « Firefox extensions ».
3. Dans Orion, ouvrir **vrm.center** et se connecter → toucher « Installer dans Orion » (la fiche
   addons.mozilla.org s'ouvre) → **Ajouter** → accepter les autorisations.
4. **Retirer l'ancienne VRM installée par fichier** (Orion → Extensions) : deux extensions VRM, l'app coupe
   les commandes.
5. Ouvrir **vinted.fr** connecté : le logo VRM en bas à droite ouvre la carte qui dit le compte VRM.

## Ce qui n'est PAS vérifié (à regarder sur l'iPhone, une fois la fiche publiée)

- **Qu'Orion sur iPhone met bien à jour tout seul** une extension installée depuis addons.mozilla.org. Kagi
  le promet pour les extensions de boutique ; ce n'est mesuré ni ici ni chez Julien. Repère : après une
  nouvelle version validée par Mozilla, la carte de l'extension dans VRM (Réglages → État des connexions)
  doit afficher la nouvelle version sans aucun geste.
- Les intitulés exacts des menus d'Orion (ils changent d'une version à l'autre).
- La lecture de Vinted depuis Orion iPhone reste « en essai » (`navigateursServis().lectureTelephone`
  = `false`) : les API d'Orion sont partielles ; l'app ne promet rien de plus.
