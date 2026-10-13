export const meta = {
  name: 'k3-revue-2',
  description: "Migration 014 (mémoire de l'agent eBay, worktree wf_281a8833-afe-1, 9dcd405) : second tour adverse sur les 24 corrections, jusqu'à deux tours sans défaut neuf, avant toute application en production",
  phases: [
    { title: 'Relire', detail: 'deux lentilles, reproduction sur un Postgres jetable' },
    { title: 'Réfuter', detail: 'deux sceptiques par défaut' },
    { title: 'Corriger', detail: 'rouge avant / vert après / rouge sous mutation' },
  ],
}
const W = '/home/user/cancale-v67/.claude/worktrees/wf_281a8833-afe-1'
const CTX = `Contexte : VRM, dépôt /home/user/cancale-v67. Chantier K3 de l'agent eBay autonome (spec : /tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/agent-ebay-autonome/spec-finale.md, §0bis « l'acheteur paie le bordereau », §3 invariants R1-R22, §5.1-5.2 tables et fonctions). Worktree ${W}, branche worktree-wf_281a8833-afe-1, HEAD 9dcd405 au départ : supabase/migrations/014-agent.sql (16 tables, fonctions SECURITY DEFINER, RLS, gardes ebay_tokens, journal immuable, pierre tombale vrm_agent_effaces, horloge simulée seulement sous vrm.horloge_simulee), scripts/agent-sql/supabase-min.sql (imitation mesurée de la prod), scripts/agent-sql/essai-annule.cjs (essai annulé, --verifier, --morceaux), scripts/audit-agent-sql.cjs (Postgres 16 jetable, --prouve), section K3 de CLAUDE.md. La migration n'est PAS appliquée en production et ne doit pas l'être par toi. AUCUNE écriture, aucun appel à la base de production (lecture du catalogue seulement si indispensable, via l'outil SQL Supabase, jamais une donnée). Aucun appel à eBay ni Vinted.
Le premier tour a trouvé et fait corriger 24 constats (bail lié à la commande, temps borné, pierre tombale, vérificateur, R18, rendre sur échec, réveil, file équitable, droits, forme des tables…). Ton rôle : chercher ce qui RESTE ou ce que ces corrections ont CASSÉ.`
const DEF = { type: 'object', properties: { defauts: { type: 'array', items: { type: 'object', properties: { titre: { type: 'string' }, gravite: { type: 'string', enum: ['haute', 'moyenne', 'basse'] }, reproduction: { type: 'string' }, correctif: { type: 'string' } }, required: ['titre', 'gravite', 'reproduction'] } } }, required: ['defauts'] }
const VERDICT = { type: 'object', properties: { refute: { type: 'boolean' }, reproduit: { type: 'boolean' }, raison: { type: 'string' } }, required: ['refute', 'reproduit', 'raison'] }
const FIX = { type: 'object', properties: { commit: { type: 'string' }, fait: { type: 'string' }, preuves: { type: 'string' }, nonFait: { type: 'string' } }, required: ['commit', 'fait', 'preuves', 'nonFait'] }
const LENTILLES = [
  `LENTILLE CONCURRENCE ET TEMPS : deux battements, un clic et la veille en même temps ; bail expiré repris pendant qu'un ancien porteur écrit encore ; réveil ; rendre sur échec ; planifier ; prendre équitable (un vendeur avec 250 tâches n'affame pas les autres) ; réservation d'argent (plafond, +15 %, rendue une seule fois — et §0bis : rien ne doit permettre de dépenser l'argent de Julien pour une étiquette) ; quota ; horloge simulée qui ne peut pas fuir en production ; purge et compaction qui ne détruisent pas un mémo d'idempotence vivant. Fais tourner de VRAIES transactions concurrentes (plusieurs connexions psql/pg en parallèle) sur le Postgres jetable de l'audit.`,
  `LENTILLE DROITS, DONNÉES ET MISE EN PRODUCTION : RLS et droits (anon, authenticated, service_role, propriétaire), abonnement_requis, garde ebay_tokens (y compris les écritures légitimes de api/ebay.js et api/_lib/ebay.js avec la clé de service : la garde ne doit PAS les casser — vérifie ce que ces routes écrivent vraiment), journal immuable vs anonymisation et effacement d'un vendeur (« Fermer mon compte » d'api/compte.js doit pouvoir tout effacer), R18 (aucune donnée d'acheteur gardée), et le chemin d'application : l'essai annulé sur une base forme-prod laisse-t-il vraiment rien ? --verifier attrape-t-il une installation partielle ou dénaturée ? les morceaux s'appliquent-ils dans l'ordre sans fenêtre ouverte ? la migration est-elle rejouable sans rien casser ? compatible Postgres 17.6 (la prod) ?`,
]
let aCorriger = []
const hist = []
let secs = 0
for (let tour = 1; tour <= 3; tour++) {
  phase('Relire')
  const vus = hist.flatMap(h => h.corriges)
  const trouves = (await parallel(LENTILLES.map((l, i) => () => agent(`${CTX}\n\nTOUR ${tour}. Tu es RELECTEUR ADVERSE du worktree ${W} à son HEAD actuel. Travaille sur une COPIE (git -C ${W} archive HEAD | tar -x -C <scratchpad>/k3r2/t${tour}-r${i}), node_modules en lien symbolique vers /home/user/cancale-v67/node_modules. ${l}\nNe rapporte QUE ce que tu as REPRODUIT (script SQL ou Node exécuté sur le Postgres jetable, avec la sortie). Déjà traités : ${JSON.stringify(vus)}. Au plus 8 défauts, les plus graves d'abord ; zéro est une réponse valable.`, { label: `relire:${tour}:${i}`, phase: 'Relire', schema: DEF })))).filter(Boolean).flatMap(r => r.defauts || [])
  const juges = await parallel(trouves.map((d, i) => () => parallel([0, 1].map(j => () => agent(`${CTX}\n\nUn relecteur affirme ce défaut de la migration 014 (worktree ${W}, HEAD actuel). RÉFUTE-le si tu peux en le reproduisant toi-même sur une copie et un Postgres jetable. refute=true si tu ne le reproduis pas, si c'est du style, ou si c'est sans conséquence réelle pour l'agent ou les données de Julien. En cas de doute, refute=true.\nDÉFAUT : ${JSON.stringify(d)}`, { label: `refuter:${tour}:${i}:${j}`, phase: 'Réfuter', schema: VERDICT }))).then(vs => ({ d, vs: vs.filter(Boolean) }))))
  aCorriger = juges.filter(Boolean).filter(x => x.vs.filter(v => v.refute).length < 2 && x.vs.some(v => v.reproduit && !v.refute)).map(x => x.d)
  log(`tour ${tour} : ${trouves.length} rapportés, ${aCorriger.length} confirmés`)
  if (!aCorriger.length) { secs++; if (secs >= 2) break; continue }
  secs = 0
  phase('Corriger')
  const fix = await agent(`${CTX}\n\nCORRIGE ces défauts confirmés dans ${W} et commite là (ne pousse rien, n'applique rien en production) :\n${JSON.stringify(aCorriger, null, 1)}\nPour chacun : reproduis (rouge sur le HEAD de départ du tour), corrige à la racine, ajoute le contrôle à scripts/audit-agent-sql.cjs (vert après) et une mutation à --prouve qui le refait passer au rouge. Puis : node scripts/audit-agent-sql.cjs vert, --prouve toutes rouges, l'essai annulé régénéré et sa taille, --verifier, npm run build, tous les scripts/audit-*.cjs à 0 (lien node_modules temporaire si besoin, retiré après), section K3 de CLAUDE.md mise à jour. Si un défaut est faux en le reproduisant, dis-le dans nonFait.`, { label: `corriger:${tour}`, phase: 'Corriger', schema: FIX })
  hist.push({ tour, corriges: aCorriger.map(d => d.titre), fix })
  if (!fix || !fix.commit) break
}
return { hist, restants: aCorriger }
