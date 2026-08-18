
---

## 5.36 — UN LOT DE BORDEREAUX, MAIS UN PAR UN (5.29.0)

Julien : « je veux que ça la récupère automatiquement quand j'appuie sur généré, et je veux pouvoir sélectionner plusieurs ventes pour générer des bordereaux ».

### Ce qui existait déjà (vérifié avant de coder, pas réécrit)
La récupération automatique **était faite** depuis §5.32 : `genererBord` génère, puis appelle `recupererLabel` et envoie le PDF dans l'app, et le bouton rend compte (« ✓ envoyé à l'app » / « ✓ généré » si le PDF n'est pas récupérable). Rien à refaire — c'est la sélection multiple qui manquait.

### La sélection : séquentielle, jamais en rafale
- Case à cocher sur chaque vente actionnable **du compte connecté uniquement** (les autres comptes restent floutés, §5.32 — agir depuis la session d'un autre compte est LE signal multi-comptes, §48). « tout cocher » + **« ▶ Traiter la sélection »**.
- La boucle **attend la réponse de Vinted avant d'envoyer la suivante**. Le service worker ne reçoit donc jamais un lot à lâcher d'un coup : un message = un bordereau, comme avant. C'est ce qui sépare une file séquentielle d'une rafale (§32/§43) — et ce n'est **pas** une temporisation déguisée : il n'y a aucun `setTimeout` entre deux, c'est le rythme du réseau.
- ⚠️ **Le vrai garde-fou reste le plafond de 20 actions/h par compte** (`garde`). Un refus (`code`) **arrête le lot** au lieu de s'acharner : les suivantes taperaient le même mur. Le motif exact s'affiche dans le bandeau d'alerte du panneau.
- Chaque ligne garde son propre bouton (un clic = un bordereau) ; la sélection ne fait que les enchaîner.
- `bordPick` (Set de n° de transaction) survit aux rendus : un `load()` en cours de route ne vide pas la sélection.

**Vérifié au banc panneau** (faux `chrome`, 4 ventes dont une sur un autre compte) : **3 cases** (la 4ᵉ vente, compte `222`, n'en a pas), « tout cocher » → 3, le lot envoie **3 messages espacés de 10-11 ms — donc bien l'un après l'autre** — avec la bonne action par ligne (`genererBord` sur « paiement validé », `recupBord` sur « Bordereau envoyé au vendeur »), et le refus simulé du garde-fou **arrête le lot** en affichant « 20 actions/h atteint ». **0 erreur page/console.**

⚠️ Piège de banc (le harnais mentait, encore — §21) : `load()` fait `DATA = resp`, pas `resp.data`. Mon stub renvoyait `{ok:true, data:DATA}` → `DATA.toShip` vide → **0 case rendue**, et j'aurais conclu que la fonctionnalité ne marchait pas. Et `.vrm-tab` n'est pas « visible » au sens Playwright : cliquer via `$eval(e=>e.click())`.

### Le reçu d'achat : retour à l'ancien modèle
Julien, deux fois : « je n'aime toujours pas ce modèle, je veux vraiment l'ancien, il était super ». Repris **tel quel** depuis `7256d7e^` (page 420×560, une colonne, étiquette grise puis valeur) plutôt que réécrit de mémoire. Trois ajouts seulement : le **N° de la paire** (les 3 boutons appelants passaient déjà `opts.numero`), la **virgule décimale** (document comptable français) et les **accents** (vérifié : ils passent en WinAnsi, §5.28).

**Vérifié à l'octet** (Playwright + la vraie fonction découpée du fichier, texte hex du flux décompressé) : 19 lignes imprimées, **aucune ne chevauche la suivante** (y strictement décroissants, écart ≥ 13), tous les champs présents, **le symbole € présent** (`0x80` WinAnsi — invisible en latin1, d'où la vérification en hexadécimal).
⚠️ Deux pièges du harnais : le découpage de la fonction gardait le `;` final → `return (…;)` = SyntaxError ; et pdf-lib écrit le texte en **hexadécimal dans un flux Flate** — chercher une chaîne dans le PDF brut ne trouve jamais rien. Il faut décompresser puis décoder `<hex> Tj`.
