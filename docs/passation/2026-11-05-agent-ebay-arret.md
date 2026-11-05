# 5 nov. — L'agent eBay arrêté, des photos du téléphone sur eBay (branche `v31-agent-ebay-arret`)

<!-- Section déplacée telle quelle de la fin de CLAUDE.md lors de l'intégration `integration-lot1` (5 nov.). -->

## 11. 5 nov. · L'agent eBay arrêté, des photos du téléphone sur eBay

- **Fait** (branche `v31-agent-ebay-arret`) : l'agent eBay ne propose ni ne prépare plus rien
  (section « Agent eBay » d'À traiter, calcul en fond, ligne et badge de Ma journée, notification
  du matin retirés ; catégorie `agentebay` dans `CATEGORIES_RETIREES` ; `publish` + `agent:true` ⇒
  410). Données `vrm_agent_ebay_*` gardées, plus lues. ⚠️ Ne pas le remettre sans qu'il le demande.
  Vendre sur eBay : bloc « Photos » (appareil `capture=environment`, galerie `multiple`, aperçu,
  ‹ ›, ×) ; chaque photo réduite à 1600 px puis confiée à l'hébergement d'images d'eBay (action
  `photo`, `UploadSiteHostedPictures`, `api/_lib/ebay-photo.js`), son adresse i.ebayimg.com part
  avec l'annonce ; 12 ajoutées, 24 en tout ; envoi en cours ou raté ⇒ publication bloquée et dite.
  Revue : changer d'article retire les photos ajoutées (envois en cours compris) et le dit.
- **Prouvé** : bancs `ebay-photos-agent-arret` (37 ; 12 rouges sur le code d'avant, 3 sur l'avant-revue, 3 mutations attrapées),
  `ebay-photo-route` (15, 8/8 mutations), `agent-ebay-push` réécrit (16, 15 rouges avant) ; build.
- **Non mesuré** : `UploadSiteHostedPictures` sur un vrai compte eBay (forme de la documentation) ;
  durée de vie d'une photo hébergée gardée dans un brouillon. Récit : `historique-ebay.md`.
