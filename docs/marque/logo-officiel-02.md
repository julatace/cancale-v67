# Identité VRM — logo 02

Choix confirmé par Julien le 20 octobre 2026 sur la planche de six propositions : logo angulaire « VRM », monogramme « VR » blanc sur fond ardoise #21343e.

- `public/vrm-wordmark-v3.png` : mot complet transparent, utilisé comme masque pour respecter les couleurs du thème.
- `public/vrm-logo-v3-{96,192}.png` : monogramme carré pour l'interface, l'accueil et la connexion.
- `public/vrm-icon-v3-{192,512}.png`, `vrm-apple-touch-icon-v3.png` (180 px), `vrm-maskable-v3-512.png` : icônes navigateur et installation.
- Les anciennes URL publiques de logo servent également cette identité.
- Les factures utilisent le nouveau monogramme embarqué. Les icônes et le badge de l'extension sont remplacés ; le zip 5.200.0 est reconstruit depuis sa source.

Le panneau de détail des ventes conserve le correctif `photoNoeud` de main. Le banc photo ouvre désormais chaque panneau via le bouton de la vente et retrouve son contenu par `aria-controls`, en conservant les vérifications de source exacte des images et de distinction de la photo de l'achat.

Une icône déjà enregistrée sur l'écran d'accueil iOS peut conserver son ancienne image : supprimer ce raccourci puis ajouter à nouveau le site permet de récupérer la nouvelle icône.
