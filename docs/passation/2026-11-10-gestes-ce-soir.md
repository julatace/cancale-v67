# Les gestes de Julien — soir du 10 novembre 2026

Julien : « fait tout je ferais les actions que tu me demandes ce soir ». Dans l'ordre, le plus
utile d'abord. Chaque geste dit où le faire. Aucun ne demande d'écrire du code.

| # | geste | où | pourquoi |
|---|---|---|---|
| 1 | Installer l'extension **5.335.0** | vrm.center/VRM-extension.zip → remplacer le dossier → ⟳ dans CHAQUE Chrome (Orion : VRM-Orion-dossier.zip) | sans elle, la lecture Vinted des colis et des codes reste à l'ancienne |
| 2 | Ouvrir « Mes annonces » sur chaque compte Leboncoin | leboncoin.fr, connecté sur chaque compte | VRM apprend tes annonces Leboncoin |
| 3 | `CRON_SECRET` dans les secrets GitHub | GitHub → dépôt → Settings → Secrets → Actions → New secret, même valeur que sur Vercel | colis à retirer relus toutes les 15 min (sinon 2 fois par jour) |
| 4 | Capture du logo **Chronopost** (et Colissimo, InPost, Relais Colis si tu les as) | une capture d'écran du haut d'un e-mail, envoyée dans la conversation | aujourd'hui ces logos sont leur nom en couleurs, pas le vrai dessin |
| 5 | Migrations **029** puis **028** puis **030** | Supabase → SQL Editor ; chaque fichier commence par un ESSAI (rien gardé) : le lancer, voir « ESSAI OK », puis appliquer | 029 : preuve du compte Vinted ; 028 : formules Solo/Pro ; 030 : Solo = un compte par plateforme |
| 6 | Dire si **Solo = un compte vendeur par plateforme** te va | dans la conversation | c'est le choix par défaut de la 030 |
| 7 | Ventes à dater (≈ 1 780) : choisir | dans la conversation : tout dater · seulement l'année en cours · les sortir du compte | VRM ne décide pas à ta place |
| 8 | Adresse de réception des e-mails (≈ 30 min) | `docs/emails-transfert-mise-en-service.md` : acheter un domaine (jamais vrm.center), Cloudflare, Worker `vrm-reception`, `DOMAINE_RECEPTION` sur Vercel, e-mail d'essai depuis Paramètres → Mes e-mails | les autres vendeurs voient « Bientôt disponible » d'ici là |
| 9 | Variables d'e-mail VRM sur Vercel (Brevo) | `RELANCES_SMTP_HOTE`, `_PORT`, `_UTILISATEUR`, `_MOT_DE_PASSE`, `RELANCES_EXPEDITEUR` | factures et liens de preuve d'adresse |
| 10 | Pour pouvoir encaisser | remplir `public/legal/editeur.js` et `src/contact.js` ; Stripe (prix, `STRIPE_SECRET_KEY`, webhook) ; relire les CGV | tant que c'est vide, personne ne peut payer |
| 11 | Relier l'adresse qui reçoit les e-mails Vinted « ton achat t'attend » sans compte (17 e-mails) | VRM → E-mails → Relier ma boîte | ces colis deviennent des identités (aujourd'hui rapprochés par point + date seulement) |
| 12 | Ouvrir sur vinted.fr le compte des deux achats irlandais à vérifier | vinted.fr, connecté sur ce compte | Vinted seul dira s'ils ont été retirés |

Le reste (Vercel Pro vers 70 vendeurs, compte de démo, notifications GitHub) attend :
`2026-11-09-passation-generale.md` §5.
