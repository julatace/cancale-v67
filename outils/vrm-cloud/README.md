# Pilote VRM Cloud

Le navigateur charge automatiquement l’extension VRM du dépôt. Chaque profil conserve sa propre session sur le VPS. Les données collectées suivent le circuit actuel de l’extension vers VRM et s’affichent dans les écrans habituels. L’établissement de la connexion se fait dans une session graphique privée du VPS, le temps du pilote.

## Installer sur un VPS Linux

Cloner la branche du pilote dans `~/vrm` sous un utilisateur Linux dédié. Installer Node.js 22 ou ultérieur. Avec cet utilisateur connecté à sa session Linux, lancer l’installeur :

```sh
bash outils/vrm-cloud/installer.sh
```

L’installeur installe les dépendances selon le lockfile, récupère Chromium et vérifie hors ligne le chargement de l’extension. Il installe ensuite le service utilisateur. Playwright peut demander `sudo` pour les bibliothèques système. L’activation du service intervient après l’association du compte.

Depuis le bureau privé du VPS, ouvrir le profil de test :

```sh
node outils/vrm-cloud/lancer.mjs pilote --connecter
```

Le panneau de l’extension s’ouvre avec l’extension déjà chargée. Associer l’extension au compte VRM de test avec le parcours existant, puis ouvrir l’onglet Vinted et s’y connecter. Fermer Chromium avant de lancer le service. Le profil dans `~/.local/state/vrm-cloud/pilote` contient les sessions de connexion. Garder ce dossier privé, hors du dépôt.

```sh
systemctl --user enable --now vrm-cloud@pilote.service
journalctl --user -u vrm-cloud@pilote.service -f
```

Pour continuer après fermeture de la session Linux et redémarrage du VPS, activer le maintien du gestionnaire utilisateur avec `sudo loginctl enable-linger "$(id -un)"`. Le service utilise Node disponible dans le `PATH` de systemd. Le journal doit confirmer le chargement de l’extension et sa version.

Pour reconnecter le compte, arrêter d’abord `vrm-cloud@pilote.service`, relancer le même profil avec `--connecter`, puis fermer le navigateur et redémarrer le service. Utiliser un identifiant différent pour chaque autre profil.

## Valider le pilote

```sh
node --test outils/vrm-cloud/profils.test.mjs
node scripts/bancs/commandes-lecture.cjs
```

Le premier test démarre l’extension dans deux profils temporaires, vérifie la séparation des données de test et leur persistance après redémarrage. Le second vérifie la lecture des achats avec deux identités fictives et une base simulée.

Sur le VPS, vérifier ensuite que les achats et leurs colis arrivent dans Achats sur VRM avec l’ordinateur éteint. Redémarrer le service et vérifier la reprise. Mesurer la mémoire et les délais de synchronisation avant d’augmenter le nombre de profils simultanés.
