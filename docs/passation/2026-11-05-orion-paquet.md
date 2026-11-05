# Refus d’installation Orion — 5 novembre

Julien indique que l’ancienne extension s’installait, puis que les deux formats de la 5.320 ne s’installent pas. Le message exact et le format de l’installation précédente ne sont pas connus. Ne pas déclarer une installation réussie ni la cause certaine sans observation iPhone.

Comparaison des archives de 61304faf (5.319) et de 5.320 : même manifeste hors version, mêmes noms et contenu métier attendu, pas de CRC invalide ni chiffrement. Une différence mesurée : le manifeste et plusieurs fichiers sont 0600 dans les nouveaux ZIP, contre 0644 auparavant. Le générateur copiait les permissions du poste de construction. Une extraction via un fournisseur de fichiers et une lecture depuis un autre contexte peut être gênée par ces permissions. Cela reste une cause possible, pas une preuve de la panne Orion.

5.321 normalise uniquement les copies temporaires destinées à l’archive : fichiers ordinaires 0644, dossiers 0755 ; ressources non régulières refusées. Chrome, Store, Firefox, Safari et Orion passent par cette règle ; le dossier enveloppe VRM-Orion aussi. Les permissions des sources ne sont pas élargies. Le correctif de connexion 5.320 est conservé. Une version publiée n’est pas remplacée sous le même numéro.

Test `scripts/tests/paquets-portables.py` : construit réellement sept archives à partir de sources 0600 et dossiers 0700, vérifie 180 entrées, droits, absence de doublons/chiffrement, intégrité CRC, manifeste unique, racine de chaque format Orion et parité XPI/ZIP. Exécuté en CI sans navigateur. Le test doit échouer sur le générateur précédent et si la normalisation est retirée.

À remettre : les formats XPI et dossier avec leur rôle exact. Le ZIP direct n’est pas le ZIP « un dossier ». Sans message d’erreur ou appareil réel, aucun nouveau format ne peut être promis comme accepté par son Orion. Une application d’écran d’accueil autonome reste distincte du navigateur et de ses extensions.
