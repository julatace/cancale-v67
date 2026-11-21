# 21 nov. — « Parcours critiques VRM » rouge sur main : les tests d'offre reportés sur le panneau

Branche `claude/ci-offres-panneau`. Geste de Julien : **aucun** (installer l'extension quand l'intégrateur sert
la 5.410.9, comme d'habitude).

## Ce qui était rouge

Le workflow `.github/workflows/parcours-critiques.yml` (et donc les e-mails « Run failed ») tombait sur main
depuis le 18 nov. au soir (dernier vert : 18 nov. 06:57), au pas `node scripts/audit-parcours-production.mjs`,
groupe « Comptes, emails, synchronisation et favoris » :

- `scripts/tests/actions-offres-vinted.test.mjs` extrayait `  const actionOffre = async` de `src/App.jsx` ;
- `scripts/tests/conversation-relecture.test.mjs` extrayait `  const sendReply = async () => {`.

Les deux gestes ont été RETIRÉS VOLONTAIREMENT de l'app au merge a12c5b769 (décision du 20 nov. : toute action de
plateforme se fait dans le panneau de l'extension, `docs/passation/2026-11-20-actions-extension.md` l. 67-68 ;
la carte d'offre porte `data-offre-panneau` et `BoutonExtension action="offres"`). Les tests ne pouvaient plus
rien lire : le groupe entier était rouge.

## Ce qui a changé

Aucun test supprimé : leurs garanties sont reportées sur le chemin qui existe.

**App** (`actions-offres-vinted` A1-A2) : aucune écriture d'offre vers Vinted ne part de `src/App.jsx` ni des
écrans découpés (`offer_requests`, `…/offers`, `actionOffre` interdits, commentaires retirés) ; la carte d'offre
ouvre le panneau avec le n° de CETTE conversation, et le panneau la choisit (`vrm-badge.js` : `page === 'messages'`
+ un seul id ⇒ `convChoisie`, rendu jugé par `scripts/bancs/grand-panneau.cjs` « lien carte d'offre »).

**Extension** (`offreCarte`, `repondreCarte` de `background.js`, exécutés par `scripts/_fond-vm.cjs`) — ce qui
manquait est codé (ext. **5.410.9**, zips NON régénérés : `public/` est exactement celui de main, l'intégrateur
régénère une fois) :
- `etatGesteVinted` : confirmé / refusé / incertain (la règle de `src/reponseVinted.js`) ; un HTTP 200 qui porte
  `code` ≠ 0 ne confirme rien (ni offre, ni réponse — `repondreCarte` lisait `r.json`, la porte rend `data` : un
  refus était dit « parti ») ; « rien n'est parti » (onglet hors Vinted, autre compte, pause : `rienParti`) n'est
  pas incertain ;
- issue incertaine (5xx, délai dépassé) ⇒ la conversation est bloquée 30 min, dit, ni second toucher ni autre
  geste ; le blocage est écrit dans `chrome.storage.local` AVANT le départ (un worker tué en vol le garde) ;
- double toucher pendant l'envoi ⇒ un seul départ (verrou pris sans attente entre test et prise) ;
- confirmé ⇒ attaché à compte:transaction:offre (`vrmOffresCarte`, 7 j) : l'offre ne repasse pas « à trancher »
  quand la relecture ne l'a pas encore vue ou rate, et le moteur automatique ne la retraite pas (`vrmOffresFaites`).

Tests : `actions-offres-vinted` B1-B7, `conversation-relecture` « un accusé de réponse n'est parti que si Vinted
l'a confirmé (panneau) ». Déjà jugé ailleurs (référencé dans l'en-tête du test) : bascule de compte pendant la file
(`audit-argent-vinted.cjs` V3), anti double-vente et plancher (`audit-extension-porte-app.cjs` G).

## Preuves

- `node scripts/audit-parcours-production.mjs` (avec et sans `NODE_OPTIONS=--require=scripts/bancs/_garde-reseau.cjs`) :
  9/9 groupes, 230+ tests verts.
- Sur l'arbre de main (`git archive origin/main`, tests copiés dedans) : A2 et B1-B7 rouges (A1 vert : c'est une
  garde contre le retour du geste, prouvée par mutation — `actionOffre` remis dans App.jsx ⇒ A1 rouge).
- 10 mutations de `background.js` (verrou, blocage avant départ, refus HTTP 200, `rienParti`, confirmée réaffichée,
  re-tranchable, clé sans compte, moteur non prévenu, incertain = refusé, réponse relue sur `json`) : 10/10 rouges.

## Les autres workflows rouges sur main (21 nov., non traités ici — hors périmètre)

- **Reprise des chantiers VRM** : `regles` (pas « archives portables » : `scripts/tests/orion-base-validee.py`
  ne connaît pas `vrm-dressing.js` et `vrm-formulaire.js`, ajoutés en 5.410.3) ; `ecrans` argent-mois (16 rouges,
  « À venir »), offres-objectif (12 rouges), achats-sourcing (« … » d'Achats), comptes-securite, parcours-quotidien,
  bureau-chargement (TimeoutError).
- **Sauvegarde quotidienne de la base** : « Vérifier que les deux secrets sont posés » — secrets absents (geste de
  Julien dans les réglages GitHub).
