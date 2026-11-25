# 25 nov. — Favoris « comme une personne » et connexion de l'extension (ext. 5.453.0)

Branche `claude/favoris-gestes-humains` (partie de `claude/agir-tout`, #1374). Pas de PR ouverte.

## Ce que Julien a demandé
« J'en ai marre que tu rames, tu dois faire tous les gestes que je fais pour faire les favoris », puis « ça doit être
humain » (sans être lent), puis « améliore la page de connexion de l'extension ».

## Le chemin humain d'un favori (tel que le code le connaît)
1. la cloche (liste des notifications) → la ligne de CE favori (article + personne, jamais un titre) ;
   sinon la page complète, sinon l'adresse native du favori (`favoriLien`) ;
2. la page de Vinted ouvre la conversation (`/inbox/{n°}` ou `/inbox/{uuid}`) ;
3. la conversation relue (identités, historique vide) ;
4. le champ du message : taper le texte, puis « Envoyer » ; le message vu dans le fil ;
5. 8 à 15 s plus tard (séquence Bleam), « Faire une offre », le prix tapé, « Proposer », l'offre vue.

## Où l'ancienne séquence ramait ou s'arrêtait
- **Le temps d'écriture (5 à 45 s) s'attendait au fond, l'écran immobile**, puis le texte apparaissait d'un coup.
- **« Envoyer » était exigé AVANT la frappe** : une messagerie qui l'éteint tant que le champ est vide ⇒
  « élément message-envoyer introuvable », 2 réessais (2–6 s chacun), arrêt. Prouvé par le banc (G3 rouge sur le code d'avant).
- Aucune hésitation avant un clic (cloche, ligne, Faire une offre, Proposer, Envoyer) ; le prix posé d'un coup.
- La conversation attendue 8 s seulement (nouvelle messagerie : l'ancien n° arrive parfois après) ⇒ « identité » non rejouée.

## Ce qui a changé (5.453.0, capacité `favorishumains` → `taperMessageFavori`)
- Le MÊME temps d'écriture tiré (règle du 12 nov.) se passe à écrire : lecture 1,2–3,2 s au fond (gardes à chaque tranche),
  puis frappe lettre à lettre DANS la page (`vrm-formulaire.js` `taperHumain`, 55 ms–0,9 s par lettre, pauses entre les
  mots), ramenée au reste du temps ; étape `taper` = rien n'est envoyé ; gardes revues (Tout arrêter, robot, pause,
  compte de l'onglet) ; puis l'étape trouve le texte déjà là et touche « Envoyer ».
- `toucher` : élément amené à l'écran (`scrollIntoView`), hésitation 0,25–0,9 s, captcha revu, clic. `regarder` : 0,4–1,4 s
  quand un écran change. Jamais deux fois de suite le même temps (`tirerUnique`).
- Conversation attendue 15 s pour un favori. Rien de maquillé (ni isTrusted, ni souris, ni débogueur).
- Durée typique d'un favori de bout en bout (message de ~70 lettres + offre) : ~45–60 s, puis la pause 20–60 s
  entre deux personnes (défaut inchangé).

## Connexion de l'extension (popup)
Gris clair de l'app, logo centré, « Connecte VRM » + une ligne, œil du mot de passe (44 px), l'attente puis l'erreur
sous « Me connecter », « ou », « Relier par vrm.center » (explication en bulle), « Mot de passe oublié ? » discret.
Mêmes états et chemins (5.415 `connexionsimple`) ; banc `popup` 85/0.

## Contrôles
`audit-favoris-gestes-humains` (neuf) : 12 verts ; code d'avant 10 rouges ; 5/5 mutations.

## Geste de Julien
Installer la 5.453.0 ; lancer 2 ou 3 favoris en regardant l'onglet de travail : le texte doit s'écrire lettre à lettre,
puis « Envoyer ». Si une ligne dit « élément … introuvable », envoyer la phrase exacte.

## Ajout : la connexion ouvre le panneau (même 5.453.0)
Julien : « la connexion à l’extension doit ouvrir le panneau, comme ça on voit à quoi ça ressemble ». « Me connecter » réussi, ou « Relier par vrm.center » qu’il a demandé (session arrivée) ⇒ le panneau sur son ACCUEIL par le lien de l’app (`?vrm=panneau`), dans l’onglet Vinted de départ (sinon un onglet Vinted ouvert, sinon un nouveau), et la petite fenêtre se ferme. Jamais sur un échec, jamais sans session, jamais pour une liaison que l’app fait seule ; fenêtre rouverte connectée : « Ouvrir le panneau » (le plein), « Ouvrir VRM » en contour. Contrôles : `audit-connexion-simple` S7 (3 rouges sur le code d’avant), banc `popup` 89/0 (3 rouges sur le code d’avant).
