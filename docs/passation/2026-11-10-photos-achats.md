# 10 nov. 2026 — Lot AN : la photo en grand partout, Achats plus beaux, facture d'achat jointe

Branche `claude/photos-achats` (depuis `origin/main` af4831b9). Poussée à chaque commit. **Pas de PR, pas
de merge** (consigne du coordinateur).

Julien, mot pour mot (9 nov.) : « Je veux que quand on clique sur la photo de l'article cela nous mette la
photo en grand, sur ordi ou tel, là c'est pour toute l'app » ; « dans les achats je veux que la mise en page
soit beaucoup mieux et plus belle » ; « je veux que l'on puisse, si on veut, mettre une facture d'achat qui
ne provient pas de Vinted ». Et : pas de murs de texte, des phrases courtes, du visuel.

## 1. La photo en grand, partout

- **Un seul composant** : `src/Visionneuse.jsx`, monté UNE fois par la coque (`App.jsx`, à côté de
  `PiluleAnnulerCoque`). La règle sans React : `src/visionneuse.js`.
- **Comment une vignette l'ouvre, sans toucher chaque écran** : `PhotoVinted` (la photo d'article de toute
  l'app) pose `data-vrm-vignette` sur son `<img>` ; quelques `<img>` d'article hors `PhotoVinted` aussi
  (`PhotoVente` secours, `PhotoVc`, Vestiaire, scanner, mode relais, « qui dorment », pile de vignettes,
  Leboncoin, eBay, achats hors plateforme). La visionneuse écoute le clic **en capture sur le document** :
  la rangée ne reçoit pas ce clic (le reste de la rangée garde son geste : ⋯, titre, case…).
- **Ce qui n'ouvre rien** : une image pas chargée (« image absente ⇒ rien »), une icône < 32 px, une photo
  qui EST tout un bouton / label (case du Stock, choix d'une photo dans l'atelier Republier : le geste du
  bouton gagne), un endroit marqué `data-sans-visionneuse`.
- **Une photo-lien** (la photo d'une carte d'Annonces menait à l'annonce sur Vinted) : elle s'ouvre en
  grand et la visionneuse garde le lien en bas (« Voir l'annonce ↗ »). Rien de perdu.
- **Les autres photos de l'article** : celles que l'app a déjà lues (annonces du dressing : `photos`,
  `photosDetail`), rangées par la clé du FICHIER (recopie de `photoKey` : hôte et taille retirés) —
  identité de fichier, jamais un titre. Inconnues ⇒ la seule photo touchée. Aucune nouvelle source lue.
- **Gestes** : glisser ou flèches (← → au clavier), compteur « 2/5 » ; pincer (doigt), double toucher /
  double clic, molette (ordinateur), déplacement borné quand zoomée ; Échap, croix ronde 44 px, le RETOUR
  du téléphone (`FermeAuRetour`) ; fond noir, portail z 15000 (au-dessus des feuilles, sous les
  confirmations et les messages), focus piégé et rendu ; mouvement réduit respecté.

## 2. Achats : rangées DA6

`src/styles-achats-photos.css` (couche `vrm-premium`, importé après `styles-widgets-ios.css`) + la rangée
d'achat d'`App.jsx` retouchée (aucun `data-*` retiré) :
- groupe arrondi 24, une rangée par achat ; **vignette 64 px** (60 au téléphone), rayon 14 ;
- titre 16/600 sur deux lignes au plus ; une sous-ligne grise (compte si plusieurs, date, « depuis N j »,
  lieu, N°) ;
- **l'état en UNE pastille** remplie (plus un point de couleur) : ambre seulement pour un geste à faire
  (au relais, retour), grise sinon ; le reçu Vinted et la facture jointe en pastilles à côté (44 px de
  cible au doigt, pilule de 26 dessinée dedans) ;
- prix payé 17/700 tabulaire calé à droite, un seul ⋯ ;
- photo qui ne charge pas ⇒ le pictogramme, jamais l'icône « image cassée ».
- **Ordre** : NON touché ici. `claude/ordre-recent` (pas encore sur `main`) réécrit exactement le bloc
  `achatsAffiches` : y toucher aussi aurait fait un conflit. Sa règle s'appliquera telle quelle.
- Phrases : aucune phrase de plus de 12 mots dans une rangée (banc A2).

## 3. Facture d'achat hors Vinted

**Où elle vit, et pourquoi** : une ligne `app_data` PAR facture, `achat_facture_{tx|hors}_{identité}`,
écrite avec `withOwner` (`src/factureAchat.js`, état et pastille : `src/FactureAchat.jsx`).
- Cloisonnement : celui de toute la base — migration **021** (RLS restrictive : un vendeur ne lit,
  n'écrit, ne modifie ni ne vide que SES lignes ; anonyme fermé), **027** (sans abonnement : aucune
  écriture), et le mode équipe (**016**) ne laisse lire que sa liste blanche d'`id` — `achat_facture_*`
  n'y est pas. **Aucune migration nouvelle**, aucun compartiment Storage, aucune fonction `api/` (12 au
  plus). C'est déjà ainsi que vivent la photo d'un achat hors plateforme (`achat_hors_photo_*`) et les
  PDF de bordereaux ; la suppression de compte efface déjà toutes ses lignes.
- Écarté : Supabase Storage (compartiment privé + politiques `storage.objects` par dossier uid). Sûr
  aussi, mais il fallait une migration (geste de Julien), un nouveau chemin d'écriture et l'ajouter à
  l'effacement de compte — pour le même cloisonnement que la 021 donne déjà.
- Bornes : PDF ou photo (JPEG, PNG, WebP, HEIC) ; 4 Mo au plus avant envoi ; une photo est recompressée
  (2000 px, JPEG) ; un PDF doit commencer par `%PDF` ; une image SVG est refusée ; ce qui part ≤ 3 Mo.
- Lecture : la liste ne projette que des scalaires (nom, type, taille, date — jamais `select=data`, jamais
  `b64`) ; le contenu est lu par son `id` au toucher seulement.
- Où : menu ⋯ d'un achat Vinted → « Joindre une facture » (puis « Remplacer ») ; « + Ajouter » (achat hors
  plateforme) → « Facture (facultatif) ». La rangée dit « Facture jointe » ; la toucher l'ouvre en grand
  (photo, visionneuse) ou en PDF (visionneuse PDF de l'app ; iPhone : le lecteur du téléphone).
- Export comptable : la ligne d'achat porte « facture jointe (nom) » dans sa note (CSV). Pas lue ⇒ aucune
  mention.
- Retirer une facture : la ligne est VIDÉE (`supprime: true`) ; la fonction existe (`retirer`), pas de
  bouton dédié (« Remplacer » suffit aujourd'hui).
- « Relier un achat » (la feuille qui relie une annonce à son achat Vinted) : pas de facture là — la
  facture se pose sur l'achat lui-même (Achats), visible ensuite partout où l'achat l'est.

## Preuves

- `scripts/audit-factures-achat.cjs --prouve` : EXÉCUTE le vrai `src/factureAchat.js` (fetch simulé) et la
  VRAIE migration 021 + la VRAIE liste blanche 016 sur un PostgreSQL jetable (A, B membre de l'équipe de
  A, anonyme). **27 verts** ; 5 mutations toutes rouges (liste qui rapatrie `data`, écriture sans owner,
  borne de taille retirée, 021 absente : 8 rouges, liste blanche élargie à `achat_facture_*` : 2 rouges).
  Sur `origin/main` : le module n'existe pas (rouge).
- `scripts/bancs/photos-achats.cjs` (données inventées, photos dessinées, 390 tactile sombre + 1512 clair) :
  V1 la visionneuse s'ouvre depuis Achats, Annonces, Ventes, Colis, Ma journée ; V2 galerie / flèche /
  clavier / glisser / lien gardé / photo seule ; V3 zoom ; V4 retour, Échap, croix ; V5 la vignette n'ouvre
  pas le menu ⋯, le ⋯ l'ouvre ; V6 photo absente ⇒ rien ; A1-A2 rangées ; F1-F4 facture. Résultat : voir
  « Bancs » ci-dessous. Sur `origin/main` (A seul) : **20 rouges** (vignette 44 px, état = un point).
- Planches avant / après : `docs/passation/planches-an/` (regardées).

## Ce qui reste

- Le tri du plus récent en haut : `claude/ordre-recent`.
- Un bouton « Retirer la facture » si Julien le veut.
- La galerie complète pour les achats/ventes (Vinted n'envoie qu'une photo par commande) : seules les
  annonces du dressing donnent toutes leurs photos.

## Reprise (10 nov., après-midi) : une seule visionneuse, `main` fusionné, bancs verts

- **Merge** : vrai `git merge origin/main` (lots AZ photo du carton, colis-propre-logos, coût de vente, litiges,
  ordre récent, à trancher en cartes). Conflits : CLAUDE.md §9 et `historique-divers.md` seulement (leurs lignes
  gardées ; la ligne « À trancher (lot AC) » déplacée telle quelle, taille). `claude/ordre-recent` étant sur
  `main`, son tri s'applique aux Achats tel quel.
- **Une seule visionneuse** : `VuePhotoCarton` (src/PhotoCarton.jsx, sa vue plein écran à part) est RETIRÉE ;
  « Voir » (fiche de la vente) et l'aperçu après « Colis fait » appellent `ouvrirVisionneuse([src], 0,
  { titre: 'Photo du carton', sous: 'N°… · date' })`. La visionneuse prend une **légende** (titre + sous-ligne,
  aussi pour la facture jointe : « Facture d'achat · nom du fichier »). Styles `.vrm-pc-vue*` retirés.
- **Ordre des couches** : la visionneuse était à z 15000, SOUS le scanner (z 19998) — une photo touchée dans le
  scanner s'ouvrait derrière lui. Elle passe à **19999** (devant le scanner et les pleins écrans, sous les
  confirmations 20000 et les messages 30000).
- **Échap** : l'écouteur clavier est celui de la coque, posé au démarrage (avant ceux des feuilles), avec
  `stopImmediatePropagation` : Échap ferme la photo SEULE, jamais le scanner / Préparer / mode relais dessous.
- **Gestes corrigés** (trouvés par le banc au vrai toucher) : un toucher SUR la photo ne ferme plus rien (à côté,
  dans le noir, il ferme ; le rectangle réel de la photo contenue est calculé) ; le « clic » qui suit un glisser
  ou un pincement ne ferme plus ; au doigt, le `dblclick` que Chrome ajoute au double toucher est ignoré (il
  dézoomait aussitôt). La photo remplit l'écran, contenue (même petite, comme Photos).
- **Preuves** :
  - `scripts/audit-visionneuse.cjs --prouve` (NOUVEAU, le commentaire de `src/visionneuse.js` le citait sans
    qu'il existe) : EXÉCUTE la vraie règle — galerie par fichier (2 annonces au même titre gardent chacune
    leurs photos), ce qui ouvre / n'ouvre pas, légende, une seule vue, couches, Échap. **19 verts**, **6/6
    mutations rouges** ; sur `origin/main` : le module n'existe pas (rouge) ; sur la pointe d'avant la reprise
    (c41f45cf) : **5 rouges** (légende, z sous le scanner, vue à part, Échap).
  - `scripts/bancs/photo-colis-scan.cjs` : **124 conformes** (390/1512 × clair/sombre). Nouveau P5 : l'aperçu
    ⇒ LA visionneuse, une seule, devant le scanner, légende « Photo du carton · N°33 », Échap ferme la photo et
    le scanner reste. F1 « Voir » jugé dans la visionneuse. P3 compté depuis SON scan (sous charge, la capture
    faisait dépasser les 5 s d'« Annuler » : rouge aussi sur `main` avec `SHOTS`, mesuré).
  - `scripts/bancs/photos-achats.cjs` : **142 verts** (390 sombre + 1512 clair) et **142 verts**
    (`PA_VUES=390-clair,1512-sombre`). Le doigt ne touche qu'une vignette à l'écran que rien ne couvre (l'écran
    finit de se poser : instantané, ligne de fraîcheur) ; le menu ⋯ refermé par un toucher sur son fond ; V4
    nouveau : un toucher sur la photo ne ferme pas, à côté il ferme.
  - `npm run build` ; audits variables, tdz, coherence, identite, icones, fonctions-api, factures-achat : verts.
  - Captures regardées : Achats 390 clair / 1512 sombre (rangées, pastilles, facture jointe), galerie 3/3 avec
    « Voir l'annonce », photo du carton en grand devant le scanner (390) et depuis la fiche (1512 sombre).

## Ce qui reste (après la reprise)

- Le menu ⋯ d'un achat ne se ferme pas à Échap (son fond seul le ferme) : hors de ce lot.
- Au téléphone, le menu message « Facture jointe » (z 30000) passe un instant devant la légende de la
  visionneuse quand on ouvre la facture tout de suite après l'avoir jointe : il disparaît seul.
- Litiges : la preuve « Carton » dit seulement qu'une photo existe ; la toucher pour la voir (dans LA
  visionneuse, `ouvrirVisionneuse`) serait le prochain pas.
