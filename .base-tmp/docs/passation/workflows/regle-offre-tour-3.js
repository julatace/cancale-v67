export const meta = {
  name: 'regle-offre-tour-3',
  description: "Règle d'offre eBay (worktree wf_30feaf2f-334-8, bac8da1) : corriger les sept défauts restants, puis relire adversairement jusqu'à deux tours sans défaut neuf",
  phases: [
    { title: 'Corriger', detail: 'défauts restants, rouge avant / vert après / rouge sous mutation' },
    { title: 'Relire', detail: 'deux lentilles qui reproduisent' },
    { title: 'Réfuter', detail: 'deux sceptiques par défaut' },
  ],
}

const W = '/home/user/cancale-v67/.claude/worktrees/wf_30feaf2f-334-8'
const CTX = `Contexte : VRM, dépôt /home/user/cancale-v67. Chantier « règle d'offre eBay » : Julien (9 octobre, mot pour mot) « Je veux juste définir une règle sur chaque annonce et à chaque offre au-dessus ça accepte », eBay SEULEMENT (CLAUDE.md §3 : sur Vinted rien ne change). Forme unique : le seuil NATIF d'eBay (Item.ListingDetails.BestOfferAutoAcceptPrice, et MinimumBestOfferPrice pour le refus), posé annonce par annonce SUR SON CLIC avec une confirmation qui dit qu'une offre acceptée vend la paire ; VRM n'appelle aucune route d'acceptation (audit-offres-auto.cjs le garde). Le chantier est dans le worktree ${W} (branche worktree-wf_30feaf2f-334-8, HEAD bac8da1, base multi-comptes 2a34c1c), JAMAIS poussé. Documentation mesurée : /tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/regle-offre/ (doc.md, code.md, donnees.md, spec-final.md). La sous-section de CLAUDE.md du worktree sur la règle d'offre dit ce qui est fait.
Preuves (§6) : audit scripts/audit-ebay-route.cjs (--src pour lancer sur une copie), scripts/prouve-regle-offre.cjs, banc scripts/bancs/ebay-regle-offre.cjs (PORT réglable, BANC_EBAY_DELAI, BANC_TXN_DELAI), scripts/prouve-banc-regle-offre.cjs, bancs eBay (ebay-annonces, ebay-programmer, ebay-form, ebay-comptes, annonces-carte). D'AUTRES BANCS TOURNENT EN MÊME TEMPS SUR LA MACHINE : utilise les ports 4791 à 4799 uniquement, et relance SEUL un banc chronométré qui rate une fois avant de conclure. Aucun appel à eBay pour de vrai, ni à la base de production, ni à Vinted.`

const DEF = { type: 'object', properties: { defauts: { type: 'array', items: { type: 'object', properties: {
  titre: { type: 'string' }, gravite: { type: 'string', enum: ['haute', 'moyenne', 'basse'] }, fichier: { type: 'string' }, reproduction: { type: 'string' } },
  required: ['titre', 'gravite', 'reproduction'] } } }, required: ['defauts'] }
const VERDICT = { type: 'object', properties: { refute: { type: 'boolean' }, reproduit: { type: 'boolean' }, raison: { type: 'string' } }, required: ['refute', 'reproduit', 'raison'] }
const FIX = { type: 'object', properties: { commit: { type: 'string' }, fait: { type: 'string' }, preuves: { type: 'string' }, nonFait: { type: 'string' } }, required: ['commit', 'fait', 'preuves', 'nonFait'] }

let aCorriger = (args && Array.isArray(args.titres)) ? args.titres.map((t, i) => ({ titre: t, gravite: 'voir fichier', reproduction: `défaut n°${i + 1} du fichier ${args.fichier} (lis le fichier EN ENTIER : il porte la sonde, la commande, la sortie et la cause de chacun)` })) : []
if (!aCorriger.length) throw new Error('args.titres manquant')
const historique = []
let secs = 0
for (let tour = 1; tour <= 4; tour++) {
  if (aCorriger.length) {
    phase('Corriger')
    const fix = await agent(`${CTX}\n\nTOUR ${tour}. CORRIGE ces défauts (chacun reproduit par un relecteur, avec sa sonde) dans ${W}, commite là (ne pousse rien) :\n${JSON.stringify(aCorriger, null, 1)}\n\nPour CHAQUE défaut : reproduis-le d'abord (sa sonde, ou ton propre contrôle) ; corrige à la racine (une règle, un propriétaire — §11 ; « pas su » ne vaut ni oui ni non) ; ajoute un contrôle à l'audit ou au banc qui est ROUGE sur le HEAD de départ du tour (copie git archive, lancée depuis la copie, §6.1), vert après, et ROUGE sous une mutation qui réaffaiblit ta correction (ajoute la mutation à prouve-regle-offre.cjs ou prouve-banc-regle-offre.cjs). Si un défaut est faux en le reproduisant, ne le corrige pas et dis pourquoi dans nonFait.\nPuis : npm run build ; TOUS les scripts/audit-*.cjs à 0 (audit-renum-b peut être sauté) ; les bancs eBay un par un (ports 4791-4799) ; mets à jour la sous-section règle d'offre de CLAUDE.md (défauts du tour, preuves chiffrées). Rends le commit final.`,
      { label: `corriger:${tour}`, phase: 'Corriger', schema: FIX })
    historique.push({ tour, corriges: aCorriger.map(d => d.titre), fix })
    if (!fix || !fix.commit) { log(`tour ${tour} : correction sans commit, arrêt`); break }
  }
  phase('Relire')
  const vus = historique.flatMap(h => h.corriges)
  const lentilles = [
    `LENTILLE ARGENT : tout chemin qui pourrait faire accepter par eBay une offre que Julien n'a pas voulue — seuil posé sur un prix périmé, montant mal formé, règle existante écrasée, seuil qui survit à une baisse de prix, programmée, brouillon, lot « Une règle pour toutes », multi-comptes (le bon compte eBay, jamais celui d'un autre vendeur), anti double vente avec Vinted quand une offre est acceptée (la vente eBay doit sortir la paire de Vinted : le dit-on, et vite ?), relecture des ventes eBay.`,
    `LENTILLE VÉRITÉ À L'ÉCRAN : chaque phrase, pastille et chiffre de la règle d'offre (carte, ligne du haut, aperçu du lot, bilan, feuille de publication, planificateur, programmées) dit-il ce qui est mesuré ? trois états (lu / pas su / aucune), une cause une phrase (§7), rien d'affirmé sur une lecture ratée, rendu aux deux tailles sans débordement, aucune couleur hors palette, pas de « ✓ » sur un échec ; et les écrans eBay voisins (Annonces, Ventes, Compte eBay) n'ont pas régressé.`,
  ]
  const trouves = (await parallel(lentilles.map((l, i) => () => agent(`${CTX}\n\nTu es RELECTEUR ADVERSE du worktree ${W} à son HEAD actuel. Travaille sur une COPIE (git -C ${W} archive HEAD | tar -x -C <scratchpad>/regle-offre/tour${tour}-r${i}), node_modules en lien symbolique vers /home/user/cancale-v67/node_modules, build dans la copie. ${l}\nNe rapporte QUE ce que tu as REPRODUIT (sonde qui exécute la vraie route ou la vraie règle dans un vm, ou rendu du banc), avec la commande et la sortie. Déjà corrigés (ne les re-signale pas sauf s'ils ne le sont pas vraiment) : ${JSON.stringify(vus)}. Au plus 8 défauts, les plus graves d'abord ; zéro est une réponse valable.`,
    { label: `relire:${tour}:${i}`, phase: 'Relire', schema: DEF })))).filter(Boolean).flatMap(r => r.defauts || [])
  const juges = await parallel(trouves.map((d, i) => () => parallel([0, 1].map(j => () => agent(`${CTX}\n\nUn relecteur affirme ce défaut du worktree ${W} (HEAD actuel). RÉFUTE-le si tu peux : reproduis-le toi-même sur une copie. refute=true si tu ne le reproduis pas, si c'est du style ou un « on pourrait », ou si c'est hors du chantier ET identique avant lui. En cas de doute, refute=true.\nDÉFAUT : ${JSON.stringify(d)}`,
    { label: `refuter:${tour}:${i}:${j}`, phase: 'Réfuter', schema: VERDICT }))).then(vs => ({ d, vs: vs.filter(Boolean) }))))
  aCorriger = juges.filter(Boolean).filter(x => x.vs.filter(v => v.refute).length < 2 && x.vs.some(v => v.reproduit && !v.refute)).map(x => x.d)
  log(`tour ${tour} : ${trouves.length} rapportés, ${aCorriger.length} confirmés`)
  if (!aCorriger.length) { secs++; if (secs >= 2) break } else secs = 0
}
return { historique, restants: aCorriger }
