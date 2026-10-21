# Réception collective — vrm.vinted35@gmail.com

## État de mise en service

Le nouveau script est préparé et testé localement. Modifier le dépôt et publier VRM ne modifie pas le projet Google Apps Script installé dans Gmail. Aucun accès Google n'est connecté à cette session Codex ; ne transmettre aucun mot de passe ni code de double authentification dans le chat.

Si le diagnostic répond `cle-non-configuree`, configurer la même clé des deux côtés. Le nouveau protocole `gmail-shared` refuse de confirmer sa réception tant que ce paramètre manque. L'ancien canal reste compatible pendant cette préparation : ne pas annoncer une migration Gmail terminée avant les étapes ci-dessous.

## Activation par l'administrateur dans Google et Vercel

1. Garder une copie du script et des déclencheurs Google actuellement installés. Ne supprimer aucun email ni libellé pour repartir de zéro.
2. Dans `script.google.com`, connecté à **vrm.vinted35@gmail.com**, mettre à jour le projet de transfert avec `scripts/gmail-forwarder.gs` (copie téléchargeable : `/VRM-gmail-forwarder.gs`).
3. Dans l'éditeur Apps Script, **Services → Ajouter un service → Gmail API**. Autoriser les accès Google demandés. Le script utilise Gmail message par message et non des déplacements de conversations entières.
4. Si une clé de réception existe déjà, conserver sa valeur. Sinon, exécuter `preparerCleReceptionVRM` : une clé est créée dans les propriétés du script, sans être imprimée dans les logs. Copier sa valeur depuis **Paramètres du projet → Propriétés du script** vers la variable **EMAIL_INBOUND_SECRET** du projet Vercel, environnement Production, puis redéployer. Si un autre collecteur (Cloudflare ou autre) est utilisé, y configurer aussi cette même clé. Ne jamais la committer, l'inclure dans une capture ou la transmettre dans le chat.
5. La propriété Google **EMAIL_INBOUND_SECRET** et la variable Vercel doivent être identiques. La constante `SECRET` du fichier public reste vide.
6. Facultatif : propriété **VRM_START_DATE**, au format AAAA-MM-JJ, pour une date de départ collective. Le script collectif ne reprend pas le réglage d'import personnel d'un utilisateur. Le défaut historique reste 2026/07/15, et les anciens messages déjà labellisés `vrm-traite` ne sont pas rejoués automatiquement.
7. Exécuter **verifierInstallationVRM**. Elle vérifie le compte Google et le diagnostic VRM v2, sans transférer ou envoyer d'email.
8. Exécuter **installerVRM**. Elle conserve un seul déclencheur `forwardVintedEmails` toutes les cinq minutes ; les autres déclencheurs sont conservés.
9. Vérifier avec le prochain email réel provenant d'une règle de transfert déjà validée. Regarder l'exécution Google, puis les libellés et l'écran VRM correspondant. Ne pas créer de fausse vente en production pour tester.

La configuration de la clé doit être coordonnée avec le remplacement du script existant : un ancien script sans clé ne sera plus accepté dès que la clé serveur est activée. La conservation des messages et la reprise du transfert doivent être contrôlées à cette étape.

## Ce que le nouveau collecteur garantit dans ses tests

- Vérifie le compte Google avant de déplacer ou transmettre un message.
- Verrou de passage : deux déclencheurs ne travaillent pas simultanément.
- File limitée à 80 nouveaux messages et 20 reprises par passage, avec budget de temps. Les reprises utilisent un curseur, réinitialisé si Gmail le refuse. Les quotas Google restent applicables ; ce n'est pas une capacité illimitée.
- Préserve To, Cc, Delivered-To, X-Original-To, Message-ID, texte, HTML et pièces jointes. Aucun tronquage silencieux des pièces jointes : un message trop volumineux reste à réessayer dans Gmail.
- Envoie l'original à VRM avec la clé dans un en-tête, sans l'inscrire dans l'URL. VRM renvoie le même Message-ID et une empreinte SHA-256 du contenu JSON reçu, uniquement après confirmation de ses écritures. Le script vérifie l'identité, l'empreinte et `stocke:true` ; un simple HTTP 200 ne suffit plus.
- L'empreinte vérifie le **transport du contenu**, pas une copie brute intégrale en base. VRM conserve les données métier extraites et ses archives prévues ; l'original reste dans Gmail, récupérable après archivage.
- Une réponse illisible, une identité différente, une empreinte différente, un échec de stockage ou de classement laisse le message récupérable. Son identifiant est conservé pour la reprise idempotente.
- Les confirmations Google de transfert reçoivent le libellé `vrm-configuration` et restent dans la boîte. Aucun lien de validation n'est ouvert automatiquement : l'administrateur vérifie à qui appartient la demande.
- Les messages confirmés sont classés `vrm-achats`, `vrm-ventes`, `vrm-bordereaux`, `vrm-versements`, `vrm-colis`, `vrm-messages`, `vrm-offres`, `vrm-informations` ou `vrm-a-verifier` ; les échecs reçoivent `vrm-a-reessayer`.
- Le ménage par défaut **archive** seulement les messages portant le nouveau libellé de preuve `vrm-confirme-v2`, au-delà de six jours. Il ne déplace jamais tout le fil et ne considère pas l'ancien libellé seul comme une nouvelle preuve. Le mode corbeille n'est pas activé.
- La facturation Pro préexistante reste limitée par le serveur au propriétaire de l'installation. Ce chantier ne crée pas d'envoi de facture pour les autres utilisateurs.
- La propriété privée **VRM_DERNIER_PASSAGE** expose les compteurs de confirmations, à vérifier, échecs, échecs de classement et l'heure de fin. Elle ne contient ni mots de passe, ni corps des emails.

## Attribution aux utilisateurs

La boîte collective, y compris ses variantes Gmail avec points, `+étiquette` ou `googlemail.com`, ne désigne jamais un utilisateur. Une adresse personnelle reconnue dans les destinataires décide du propriétaire. Une adresse inconnue, un conflit entre propriétaires ou un transfert qui masque le destinataire personnel restent en quarantaine ; aucun repli automatique vers le propriétaire de la boîte collective.

Chaque utilisateur déclare **son adresse personnelle de réception**, puis crée une règle de transfert ciblée pour Vinted et ses transporteurs vers la boîte collective, en gardant une copie. Il n'a pas à installer le script central ni à partager ses identifiants. Google peut demander une validation du transfert dans la boîte collective. Les instructions et l'adresse à copier sont dans Réglages → Adresses de réception.

Les reçus d'achat sont consultables dans Vinted → Achats → Reçus d'achat par email, même sans compte Vinted synchronisé. Les emails ne reconstruisent pas artificiellement les listes de commandes, dont la source reste l'extension.
