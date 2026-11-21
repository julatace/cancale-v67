# Retour à une archive Orion de référence

## Demande et limites confirmées
Le vendeur signale toujours « erreur d’extensions, quelque chose a mal tourné » en sélectionnant les paquets 5.320 puis 5.321, alors qu’une ancienne version s’installait. L’ancienne extension n’est plus présente ; sa version n’a pas pu être relevée. La 5.319 est la dernière archive publiée avant nos changements, pas une identification certaine de celle qu’il avait installée.

La correction des droits 5.321 n’a pas résolu son refus. Ne pas la présenter comme une cause démontrée. Aucun iPhone/Orion réel n’est accessible ici ; les tests de moteur, DOM et métadonnées ne certifient pas l’installation.

## Comparaison effective
Archive lue directement dans le commit `61304fafeb063628c58d056165e15c00c22236e2` ; comparaison avec l’archive publiée 5.321, membre par membre, et métadonnées ZIP. Diff complet : `2026-11-05-orion-319-321.diff`.

- Six fichiers diffèrent. `manifest.json`, `lbc-inject.js` et `lbc-relay.js` changent uniquement les numéros de version. Aucun ajout de permission ni changement de MV2, identifiant, scripts de démarrage, ressources ou règle d’hôte.
- `background.js` : version et limites d’attente de la connexion par mot de passe (12 s réseau, 6 s corps).
- `popup.js` : connexion sans ouvrir VRM, attente bornée, compte affiché après succès, notice Orion, panneau connecté restant sur la plateforme.
- `compat-orion.js` : adaptation supplémentaire des appels à rappel quand les API natives renvoient des promesses, erreur locale pendant le rappel.
- Le jeu de fichiers de l’archive directe est identique. ZIP intègre, pas de chiffrement, même compression et créateur Unix. Dates/flux compressés changent lors de la reconstruction. Droits 644/755 en 5.319, 600/700 en 5.320, rétablis 644/755 en 5.321.

Ces constatations n’isolent pas à elles seules le refus générique d’Orion. Ne pas produire un nouveau moteur modifié à partir d’une hypothèse non confirmée.

## Livrable de référence
Trois archives sont remises publiquement sous des noms explicitement versionnés : `VRM-Orion-reference-5.319.0.xpi`, `.zip` et `-dossier.zip`. Elles sont les blobs Git originaux, pas des ZIP reconstruits. Le moteur actuel et les téléchargements canoniques ne sont pas remplacés. La notice distingue cette ancienne référence du correctif de connexion : le comportement d’ouverture de VRM de 5.319 reste présent.

Origines et empreintes SHA-256 : `scripts/orion-reference-5.319.0.json`. Contrôle `scripts/tests/orion-reference.py` : empreintes, CRC, racines de manifeste, version 5.319, parité des deux fichiers directs. Une mutation d’un octet doit être refusée. Vérifier également les téléchargements HTTP après publication.

Étape utile sur appareil : vérifier si cette archive antérieure exacte s’installe. Si elle échoue aussi, le problème ne peut pas être attribué uniquement aux changements fonctionnels 5.320. Si elle s’installe, repartir de cette référence et isoler les changements de connexion avant de promettre un correctif global. Ne pas demander la suppression d’une ancienne installation pour connaître sa version.
