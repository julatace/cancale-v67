# Photos du mode exemple — crédits

Les photos de `public/exemple/` illustrent le mode « Découvrir avec des exemples » de VRM
(données inventées, jamais en base). Chaque photo est une **vraie photo de sneakers**, sous une
licence qui permet de l'embarquer dans un dépôt public et une app commerciale :

| licence | source permise | attribution |
|---|---|---|
| `CC0 1.0` | Wikimedia Commons, Openverse (filtre CC0) | pas obligatoire, donnée ici |
| `Domaine public` | Wikimedia Commons, Openverse | pas obligatoire, donnée ici |
| `Unsplash License` | unsplash.com | pas obligatoire, donnée ici |
| `Pexels License` | www.pexels.com | pas obligatoire, donnée ici |

Règles (vérifiées par `scripts/audit-exemple-photos.cjs`) :

- une ligne ci-dessous par photo, licence **lue sur la page source** le jour de l'ajout ;
- deux fichiers par photo : `{fichier}-400.webp` (400 × 400) et `{fichier}-120.webp` (120 × 120),
  chacun **< 40 Ko** ;
- aucune photo d'une vraie annonce Vinted, aucune personne identifiable, aucun visage ;
- licence relue SUR la page source le 14 nov. 2026 (modèle `{{self|cc-zero}}`, `{{PD-self}}`,
  `{{PD-user}}` ou `{{PD-user-w}}` : l'auteur a lui-même versé sa photo), aucune demande de suppression ;
  les marques (logos) visibles sur les chaussures restent celles de leurs fabricants ;
- « ce qu'on voit » (marque, modèle, couleur) est celui de l'entrée de `src/exemplePhotos.js` :
  le titre de la paire d'exemple en est tiré.

## Photos

| fichier | ce qu'on voit | auteur | page source | licence | vérifiée le |
|---|---|---|---|---|---|
| adidas-samba-og-blanche | Adidas Samba OG blanche | LeDroider | https://commons.wikimedia.org/wiki/File:Adidas_Samba_OG.jpg | CC0 1.0 | 2026-11-14 |
| nike-air-force-1-blanche | Nike Air Force 1 blanche | Kyntömies (Wikipedia en finnois) | https://commons.wikimedia.org/wiki/File:Nike_Air_Force_1.jpg | Domaine public | 2026-11-14 |
| new-balance-574-grise | New Balance 574 grise | LeDroider | https://commons.wikimedia.org/wiki/File:New_Balance_574.jpg | CC0 1.0 | 2026-11-14 |
| adidas-sl-72-og-rouge | Adidas SL 72 OG rouge | LeDroider | https://commons.wikimedia.org/wiki/File:Adidas_SL_72_OG.jpg | CC0 1.0 | 2026-11-14 |
| nike-dunk-low-noire-blanche | Nike Dunk Low noire et blanche | LeDroider | https://commons.wikimedia.org/wiki/File:Panda_Nike_Dunk.jpg | CC0 1.0 | 2026-11-14 |
| puma-suede-noire | Puma Suede noire | LeDroider | https://commons.wikimedia.org/wiki/File:Puma_Suede.jpg | CC0 1.0 | 2026-11-14 |
| new-balance-550-blanche-bordeaux | New Balance 550 blanche et bordeaux | LeDroider | https://commons.wikimedia.org/wiki/File:New_Balance_550.jpg | CC0 1.0 | 2026-11-14 |
| nike-air-tailwind-grise-bleue | Nike Air Tailwind grise et bleue | LeDroider | https://commons.wikimedia.org/wiki/File:Nike_Air_Tailwind.jpg | CC0 1.0 | 2026-11-14 |
| adidas-sl-72-rs-bleue | Adidas SL 72 RS bleue | LeDroider | https://commons.wikimedia.org/wiki/File:Adidas_SL_72_RS.jpg | CC0 1.0 | 2026-11-14 |
| nike-zoom-vomero-5-argent | Nike Zoom Vomero 5 argent | LeDroider | https://commons.wikimedia.org/wiki/File:Nike_Zoom_Vomero_5.jpg | CC0 1.0 | 2026-11-14 |
| new-balance-numeric-480-marron | New Balance Numeric 480 marron et verte | LeDroider | https://commons.wikimedia.org/wiki/File:New_Balance_Numeric_480.jpg | CC0 1.0 | 2026-11-14 |
| adidas-superstar-blanche | Adidas Superstar blanche | Xanor | https://commons.wikimedia.org/wiki/File:Adidas_Superstar.JPG | CC0 1.0 | 2026-11-14 |
| nike-cortez-blanche-rouge | Nike Cortez blanche et rouge | LeDroider | https://commons.wikimedia.org/wiki/File:Nike_Cortez.jpg | CC0 1.0 | 2026-11-14 |
| new-balance-1906r-argent | New Balance 1906R argent | LeDroider | https://commons.wikimedia.org/wiki/File:New_Balance_1906R.jpg | CC0 1.0 | 2026-11-14 |
| adidas-handball-spezial-noire | Adidas Handball Spezial noire | LeDroider | https://commons.wikimedia.org/wiki/File:Adidas_Handball_Spezial.jpg | CC0 1.0 | 2026-11-14 |
| nike-air-max-90-blanche | Nike Air Max 90 blanche | Mr. Carter4 (Wikipedia en anglais) | https://commons.wikimedia.org/wiki/File:Air_max_90.JPG | Domaine public | 2026-11-14 |
| nike-terminator-low-rose-grise | Nike Terminator Low rose et grise | LeDroider | https://commons.wikimedia.org/wiki/File:Nike_Terminator_Low.jpg | CC0 1.0 | 2026-11-14 |
| adidas-forum-low-blanche | Adidas Forum Low blanche | LeDroider | https://commons.wikimedia.org/wiki/File:Adidas_Forum.jpg | CC0 1.0 | 2026-11-14 |
| adidas-nmd-r1-bleu-marine | Adidas NMD R1 bleu marine | LeDroider | https://commons.wikimedia.org/wiki/File:Adidas_NMD_R1.jpg | CC0 1.0 | 2026-11-14 |
| adidas-campus-00s-marron | Adidas Campus 00s marron | LeDroider | https://commons.wikimedia.org/wiki/File:Adidas_Campus_00s.jpg | CC0 1.0 | 2026-11-14 |
| nike-air-max-ltd-2-grise | Nike Air Max LTD 2 grise | Mr. Carter4 (Wikipedia en anglais) | https://commons.wikimedia.org/wiki/File:Air_Max_ltd_2.jpg | Domaine public | 2026-11-14 |

