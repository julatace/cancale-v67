# Les bancs — l'app RENDUE, sur une copie des vraies données

Un audit lit le code. Un banc **rend l'app** et regarde ce qui s'affiche. Les
deux sont nécessaires : la moitié des défauts trouvés en septembre ne levaient
**aucune erreur** et passaient tous les audits.

## Comment les lancer

Les bancs lisent leurs données dans un dossier `fx/` **à côté d'eux**, qui n'est
**jamais** dans le dépôt : ce sont les vraies ventes, les vrais acheteurs, les
vraies adresses — et **ce dépôt est public**.

```bash
mkdir -p /tmp/bancs && cp scripts/bancs/*.cjs /tmp/bancs/
node scripts/bancs/copie-fixtures.mjs <SUPABASE_URL> <ANON_KEY>   # écrit fx/
npm run build            # ⚠️ jamais pendant qu'un banc sert dist/
node /tmp/bancs/verif_visuel.cjs
```

`copie-fixtures.mjs` ne copie **jamais** les PDF (§4.4 : 6 Mo dont 99 % de PDF).

## Ce que chacun protège

| banc | ce qu'il rend, et le défaut qu'il a attrapé |
|---|---|
| `verif_visuel.cjs` | les 10 écrans, à 390 et 1512 px : écran vide, débordement, garde-fou, recouvrement par l'île d'actions |
| `verif_dark.cjs` | les mêmes en sombre |
| `colis.cjs` | l'écran Colis voit ses bordereaux, et un bouton Imprimer les sort |
| `perfv.cjs` | Ventes : frappe < 250 ms, filtre < 300 ms, « Voir plus » sans changer les totaux |
| `retrait.cjs` | chaque colis à retirer a une porte vers son code ; les colis non réclamés sont nommés |
| `oublies.cjs` | les colis « jamais retirés » montrent leur code **et** leur QR |
| `carte.cjs` | la ville déjà renseignée déclenche la recherche des points relais |
| `postes.cjs` | cocher « Colis fait » ne fait disparaître personne, et les comptes collent |
| `conflit.cjs` | **le risque n°1** : deux paires sous le même numéro. Il FORCE le cas (aucun n'existe aujourd'hui) et vérifie que l'app crie en rouge sur Colis |
| `capacites.cjs` | **l'app ne promet que ce que l'extension INSTALLÉE sait faire**. Il simule le pont (`__vmr:'ready'`) dans ses cinq états — absent · muet · 5.37 · 5.38 · 5.52 — et FORCE des prix planchers (0 en vrai). Vérifie des deux côtés du seuil 5.38, et que le bandeau compte sur la même base que la grille |
| `serie.cjs` | la saisie en série des prix d'achat : ouverture < 1,2 s, toutes les paires annoncées sont saisissables, une suggestion relie et écrit |

## Les trois pièges qui m'ont fait mesurer des fictions

1. **La projection `select=`.** Rendre la ligne brute (`{id,data}`) pour une
   requête qui demande `select=id,filename:data->>filename,…` fait lire
   `r.filename` sur un objet qui ne l'a pas. **Tous les bordereaux tombaient**
   et l'écran affichait « 0 bordereau prêt à imprimer » alors que dix étaient en
   base. Chaque banc applique donc la projection pour de vrai (`projette`).
2. **Le garde-fou d'écran passe tous les contrôles.** « Cet écran n'a pas pu
   s'afficher » est un vrai texte, sans débordement, sans `pageerror` (React
   avale l'exception) : le banc répondait « rendu conforme » sur un écran
   **mort**. Le contrôle « aucun écran n'est tombé sur le garde-fou » existe
   pour ça.
3. **Playwright prend la DERNIÈRE route enregistrée en premier.** Un fourre-tout
   `**/api/**` posé après `**/api/relais**` avale la route précise et répond
   `{pret:true}` : la carte restait vide sans lever la moindre erreur. Le
   général d'abord, le particulier ensuite.

Et la règle qui les résume : **regarder la capture fait partie du test**.
