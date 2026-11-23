# Pilote VRM Cloud

Le navigateur charge automatiquement l’extension VRM du dépôt. Chaque profil conserve sa propre session sur le VPS. Les données collectées suivent le circuit actuel de l’extension vers VRM et s’affichent dans les écrans habituels. L’établissement de la connexion se fait dans une session graphique privée du VPS, le temps du pilote.

## Installer sur un VPS Linux

Cloner le dépôt dans `~/vrm` sous un utilisateur Linux dédié. Depuis ce dossier, installer les dépendances Node, puis Chromium :

```sh
npm install
npx playwright install --with-deps chromium
node outils/vrm-cloud/lancer.mjs pilote --verifier
```

Depuis le bureau privé du VPS, ouvrir le profil de test :

```sh
node outils/vrm-cloud/lancer.mjs pilote --connecter
```

Le panneau de l’extension s’ouvre avec l’extension déjà chargée. Associer l’extension au compte VRM de test avec le parcours existant, puis ouvrir l’onglet Vinted et s’y connecter. Fermer Chromium avant de lancer le service. Le profil dans `~/.local/state/vrm-cloud/pilote` contient les sessions de connexion. Garder ce dossier privé, hors du dépôt.

```sh
install -Dm644 outils/vrm-cloud/vrm-cloud@.service ~/.config/systemd/user/vrm-cloud@.service
systemctl --user daemon-reload
systemctl --user enable --now vrm-cloud@pilote.service
journalctl --user -u vrm-cloud@pilote.service -f
```

Pour continuer après fermeture de la session Linux et redémarrage du VPS, activer le maintien du gestionnaire utilisateur avec `sudo loginctl enable-linger "$(id -un)"`. Le service utilise Node disponible dans le `PATH` de systemd. Le journal doit confirmer le chargement de l’extension et sa version.

Pour reconnecter le compte, arrêter d’abord `vrm-cloud@pilote.service`, relancer le même profil avec `--connecter`, puis fermer le navigateur et redémarrer le service. Utiliser un identifiant différent pour chaque autre profil.

## Valider le pilote

Éteindre l’ordinateur ayant servi à la connexion et vérifier qu’une nouvelle vente arrive dans Ventes sur VRM, sur le bon compte. Redémarrer le service et vérifier la reprise sans installation manuelle de l’extension. Mesurer ensuite la mémoire et les délais de synchronisation avant d’augmenter le nombre de profils simultanés.
