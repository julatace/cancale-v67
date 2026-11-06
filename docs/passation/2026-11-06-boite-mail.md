# 6 nov. — La boîte mail façon Mail (v36)

Julien (6 nov.) : « continue à améliorer la boîte mail de l'app, c'est pas ouf », puis « je veux
vraiment quelque chose de plus visuel, de beaucoup plus beau — pour les mails surtout ».
Branche LOCALE `v36-boite-mail`, partie de `claude/project-review-nsk5su` (704bdaf2). Rien dans
`vinted-sync-extension/`, `public/` intact. Rien poussé. Skills `apple-design`, `emil-design-eng`,
`impeccable` appliqués dans les limites de §7 (sous-agent : pas de question possible à Julien,
le cadrage vient de la demande et de la passation ; aucune couleur nouvelle posée).

## Mesuré d'abord (sa base, SELECT seulement — aucun nom, adresse, pseudo ni sujet ici)

- **970 lignes `email_reception_*`** (≈ 100 par jour cette semaine) ; **470 (48 %) rangées avant
  le résumé** (31 oct.) : ni résumé, ni texte, ni pièces — la ligne ne peut dire que la famille.
- **37 % « rien à faire »** (357 `connu-sans-action`), dont 95 « commande mise à jour » en six
  jours, souvent **en rafales** (11 en une minute sur un même compte) ; 47 favoris dont 38 sans
  article ni pseudo ; 83 offres résumées dont 37 sans montant.
- **91 « colis au relais »** : 49 avec un code lu, **46 « à vérifier »** sans n° de suivi
  (e-mails « commande mise à jour » de Vinted : « ton colis a été livré au point relais »), le
  lieu en CAPITALES avec l'adresse entière.
- **49 % des e-mails arrivent par un transfert iCloud** (expéditeur réécrit), 9 adresses de réception.
- **500 textes gardés** (≤ 1 500 caractères) : lignes coupées à ~76 caractères au milieu des
  phrases, « *gras* » en astérisques, « [image: Instagram] », points orphelins, « E-mail Vinted »
  en tête, 5 à 8 lignes de mentions légales mêlées au message.
- **Le HTML d'origine n'est gardé nulle part** pour un e-mail rangé (`email_texte_*` = texte borné ;
  `email_inconnu_*` seulement pour l'incompris). Base : 236 Mo sur 500.

## La critique (captures 390 et 1512, clair et sombre, inventées ET sa copie)

1. **Au téléphone, 400 px d'outils avant le premier e-mail** (onglets, recherche, rangée de
   pastilles coupée « Codes d… », menu des comptes, phrase « Les nombres ne comptent que tes 200
   derniers e-mails ») : 4 à 5 e-mails par écran.
2. **Aucun lu / non lu** : sur ~100 e-mails par jour, rien ne dit ce qui est nouveau.
3. **Bruit** : les rafales occupent chacune leur ligne (11 « Commande mise à jour » d'affilée) ;
   37 % de « rien à faire » au même rang que les ventes.
4. **Le code de retrait** n'était qu'un fragment de la ligne, ni grand ni copiable ; ouvert, il
   était écrit deux fois ; 46 lignes identiques « Colis à retirer · code pas encore lu ».
5. **Le lieu** en capitales brutes, adresse comprise, mangé par « … » sur la ligne.
6. **Natures longues** sur deux lignes (« Virement du porte-monnaie vers ta banque », « Achat
   livré, à vérifier avant la date limite »).
7. **Les avatars** : le même « V » sur 85 % des lignes ; les transporteurs en monogramme alors que
   l'app sert déjà leurs logos (`LogoTransporteur`).
8. **Le message d'origine** : du texte brut cassé (voir « Mesuré »), dans une boîte grise.
9. **La lecture** : pas de « qui » en tête, le lieu en capitales dans les détails, la date limite
   sans « dans N j », un seul geste (pas « Voir la vente » alors que le n° de transaction est lu).
10. **20 e-mails par page + « Voir plus »** : 47 touchers pour parcourir 950 e-mails.
11. **Ordinateur** : aucun repère de jour en défilant ; le volet vide est un grand cadre.
12. **« Autres »** mêlait les 98 offres aux newsletters (pas de rubrique « Offres »).
13. **Faux au fond** : rien d'inventé trouvé — la règle « du résumé, jamais du sujet » tenait.

## Ce qui change

### Règles (une source chacune)
- **Lu / non lu** — `api/_lib/emails-lus.js` (NOUVEAU, une règle lue par la route ET l'écran) :
  ligne `vrm_emails_lus` du vendeur `{ jusqua, lus, nonlus, rev }` (clés = 24 caractères de
  l'empreinte, jamais un sujet), bornée (600 + 150). Sans ligne : ce qui est rangé avant la mise en
  service (`LUS_DEPUIS`, 6 nov. 18 h UTC) est lu — la boîte ne s'allume pas de 900 points.
  Ligne illisible ⇒ `null` partout (aucun point, aucun nombre, « Non lus » refusé en 503).
  Lu / non lu ne cache RIEN (§5) ; **pas d'« Archiver »** (un e-mail caché est un colis perdu).
- **Écriture** — `src/emailsLusEcriture.js` : sur SON geste, relire, rejouer ses gestes, écrire en
  comparer-et-échanger sur `data.rev` (3 essais) ; lecture ratée ⇒ rien n'est écrit.
- **Route** — `lireJournalEmail` (`api/_lib/reception-email.js`) : `lu` par ligne, `nonlus=1`
  (lignes après `jusqua` + les remises non lues, filtrées par la règle, paginées ici),
  `compteurs.nonLus`, `dernierAt`, `parPage` 20 ou 50. Colis (`compte=1`) inchangé : une lecture,
  deux scalaires. Jamais `select=data`. Toujours 12 fonctions.
- **Rubrique « Offres »** — `api/_lib/boite-email.js` (le `type` posé au classement).
- **Écran** — `src/boiteEmails.js` : `lieuLisible` (casse et segments du lieu LU, rien
  d'ajouté), `limiteLue` (« demain », « dans 4 j »), `carteHeros` (ce qu'il faut savoir, depuis le
  résumé), `gestesEmail` (par identité : n° de suivi, de transaction, d'annonce Vestiaire, N° lu ;
  l'offre n'ouvre que le filtre « Offres » de Messages, dit comme tel), `empiler` (rafales ≥ 3
  identiques et consécutives, même compte, jamais deux codes), `codeSurLigne` (code LU d'un colis à
  retirer, sinon rien), `lireCorps` (le texte gardé en blocs : lignes recollées, gras, listes,
  liens http(s) seulement, mentions à part — balises, scripts, `on…=` retirés).

### La boîte (src/BoiteEmails.jsx, src/boite-emails.css)
- Ligne façon Mail : point bleu des non-lus (l'accent, rare), avatar rond (logo du site, logo du
  transporteur de l'app, sinon monogramme neutre), nature courte (gras si non lu), l'essentiel (le
  lieu en court, montant, N° lu, article), le geste (ambre seulement si proche ou à vérifier), le
  compte. **Le code de retrait sous la ligne, en gros chiffres, un toucher le copie**. La photo de
  la paire quand le bordereau est relié à une vente par son n° de transaction (`photoDe`, App.jsx).
- **Piles** : « Commande mise à jour · 11 e-mails » en une ligne qui se déplie (rien de caché).
- Pastilles : Tout · Non lus · Codes · Colis · Ventes · Achats · Offres · À vérifier. Les nombres
  des rubriques ne s'affichent que s'ils sont COMPLETS (≤ 200 e-mails) ; « Non lus » et « À
  vérifier » gardent le leur (« 48+ »). Plus de phrase de couverture sous les pastilles.
- « Tout marquer lu » (ou « Marquer ceux-ci lus » sous un filtre) ; au doigt, **glisser la ligne
  vers la droite** bascule lu / non lu (le fond « Lu / Non lu » n'existe que pendant le geste) ;
  « Marquer non lu » dans la lecture.
- En-têtes de jour collants (opaques : un flou dessous coûtait des images en défilant) ; 50 par
  page, la suite chargée au défilement (racine de l'observateur = le conteneur qui défile
  vraiment) ; « Voir plus » reste pour le clavier.
- États illustrés (petit dessin SVG, une phrase, LE geste) : vide, tout est lu, recherche vide,
  compte sans e-mail, rien à vérifier ; volet de lecture vide dessiné.
- **Lecture** : avatar + titre + « qui · compte · heure » ; la carte « ce qu'il faut savoir » —
  pour un retrait une **carte d'embarquement** (transporteur, code en 44 px + Copier, perforation,
  point de retrait mis en forme, « à retirer avant le … · dans N j » en ambre si proche) ; pour une
  vente / offre / achat / versement : le montant en grand, l'article, le N° LU, la photo ; puis les
  gestes par identité ; le message d'origine rendu proprement (mentions repliées) ; les pièces.
  Feuille opaque qui monte avec un léger ressort (`linear()`, repli : courbe des tiroirs).

## Preuves
(remplies plus bas, section « Mesures et bancs »)

## Ce qui reste / à décider par Julien
- **Le HTML d'origine** (mise en page de Vinted, photo de l'article dans l'e-mail) n'est pas gardé
  à la réception. Le garder coûterait des dizaines de Ko par e-mail (~100/jour, base à 236 Mo sur
  500) : proposé — garder le HTML ASSAINI des seuls e-mails « à geste » (vente, bordereau, colis à
  retirer, offre, achat) 30 jours, puis le purger. Pas posé sans sa décision.
- Les 470 e-mails d'avant le 31 oct. n'ont ni résumé ni texte : ils restent « détail non gardé ».
- Plan du point relais dans la carte : l'app a une carte (MapLibre, Colis → À retirer) mais aucun
  plan statique ; rien n'est ajouté ici (le geste « Voir le colis à retirer » y mène).
- La photo ne vient que des ventes (n° de transaction d'un bordereau) ; un achat n'en a pas encore.
- Couleur : aucune proposée (la palette suffit).

## Geste de Julien
Ouvrir **E-mails** au téléphone : toucher le code d'un colis à retirer sur la ligne (il est copié),
ouvrir l'e-mail (carte d'embarquement), glisser une ligne vers la droite (lu / non lu), toucher une
pile « Commande mise à jour ».
