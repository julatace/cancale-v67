# 25 nov. — Banc `e2e-extension` remis au vert (`claude/e2e-extension-vert`)

Sur `origin/main` (6e46f58a0), le banc non bloquant `e2e-extension` avait 13 rouges sur 41.
Lancé comme la CI (`node scripts/bancs/e2e-extension.cjs`, vrai Chromium, vraie extension, faux Vinted
et faux Supabase), captures regardées.

| étape | cause | geste |
|---|---|---|
| 3 · la vente dans Ventes | **banc périmé** : il lisait `.vrm-sale-row[data-tx]`, liste qui n'est plus rendue sous Ventes natif (la vente était bien à l'écran, « À envoyer ») | lit les rangées natives `data-vn-rang` / `data-vn-route` = `v:{n° de transaction}`, visibles ; même règle (identité par transaction, titre, rien de l'autre compte) |
| 2 · annonces visibles | (vert, mais lisait la vieille grille `data-carte-annonce`, montée cachée) | lit les rangées natives visibles `data-eg-article="vinted#{id}"` |
| 4 · la baisse | **banc périmé** (depuis le 20 nov. l'app ne fait plus de geste : « Baisser » ouvre le panneau ; depuis la 5.414 le prix est TAPÉ dans la page « Modifier ») **+ un vrai défaut de l'extension** : la copie du dressing (`_infosPage`, 2 min) lue 1 s avant la première moisson gardait « 0 annonce » — le panneau ouvert par le lien de l'app montrait 0 annonce et perdait la paire pré-cochée | banc : Annonces → Ancienneté « Dorment » → cocher → « Baisser » ⇒ le lien du panneau ⇒ dans le panneau (racine d'ombre fermée lue par le protocole du navigateur, rien de changé dans l'extension) : prix, Revoir, Lancer. Le faux Vinted sert la page « Modifier » (`#price`, `upload-form-save-button`). Mêmes juges : une modification, cookie 111, aucun Authorization, prix arrivé, relu, commande finie au prix relu ; plafond ⇒ rien, commande « plafond » ; 429 ⇒ pause ; pendant la pause rien. Extension **5.440.4** : `oublierInfosPage` à chaque dressing rangé (rouge avant, vert après) |
| 5 · autre compte | (vert mais VIDE : la vue « Qui dorment » n'existe plus) | même chemin du panneau sur l'onglet autre_b : rien n'est rangé ni envoyé |
| 6 · extension en retard | **vrai défaut de l'app** : « Baisser » ouvrait vinted.fr même pour une extension d'avant le lien du panneau (< 5.410.0, `panneaucomplet`), qui l'ignore : rien ne se passait, rien n'était dit | `ouvrirPanneau` refuse et dit « Mets à jour l'extension VRM de ce navigateur. » quand l'extension D'ICI est en retard (pas d'extension ici ⇒ le lien s'ouvre comme avant, Orion) ; les gestes du panneau d'Annonces sont fermés avec cette phrase. Rouge avant, vert après. Mutation `capacite` portée sur `panneaucomplet` |

Le banc répond aussi « Oui, capter ce compte » à la question de l'extension (première visite d'un compte), comme lui.

**Suite (même PR, 5.440.4 jamais servie)** : le lien `action=baisser` (et `remettre`) de l'app ouvre DIRECTEMENT la feuille
du prix de la paire dans le panneau (avant : « Baisser » seulement pré-choisi dans le menu — re-choisir l'option déjà
choisie ne déclenche rien). La feuille ouverte par le lien ne garde que les annonces du compte de l'onglet (aucune ⇒ fermée).
Le banc ne touche plus au menu : rouge avec l'ancien vrm-badge.js (paire cochée, « baisser » pré-choisi, aucune feuille),
vert avec le nouveau. Le banc refait aussi le filtre « Dorment » et la case si l'écran se redessine (une lecture qui
arrive remet filtre et cases à zéro) : deux passages complets en parallèle, 44 verts chacun.
