export const meta = {
  name: 'chantier-fonctions',
  description: "Un groupe de fonctions retenues par Julien le 11 octobre : mesurer et concevoir, construire dans un worktree dédié, relectures adverses qui reproduisent, réfutation, correction — jusqu'à deux tours sans défaut neuf",
  phases: [
    { title: 'Concevoir', detail: 'mesure en lecture seule, carte du code, spécification' },
    { title: 'Construire', detail: 'worktree feat-<cle>, preuves rouge avant / vert après / rouge sous mutation' },
    { title: 'Relire', detail: 'deux lentilles qui reproduisent' },
    { title: 'Réfuter', detail: 'deux sceptiques par défaut' },
    { title: 'Corriger', detail: 'défauts confirmés' },
  ],
}
const A = args
const SP = '/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/feat-' + A.cle
const WT = '/home/user/cancale-v67/.claude/worktrees/feat-' + A.cle
const CTX = `Contexte : VRM (dépôt /home/user/cancale-v67 ; CLAUDE.md est dans ton contexte — respecte-le, en particulier §2 (dont §2.8 l'acheteur paie le bordereau eBay et §2.9 aucune fonction payante sur la clé de Julien : sans IA d'abord, sinon la clé du vendeur), §3 (refus définitifs, et les propositions qu'il a refusées le 11 octobre), §4 (lois du code), §5 (identité jamais par ressemblance, numéros jamais réattribués, migration 013 « anciens numéros en B »), §6 (preuves), §7 (une seule couleur d'accent, une cause une phrase), §11 (une règle, un propriétaire)).
Base de départ : commit ${A.base} de la branche d'intégration (worktree /home/user/cancale-v67/.claude/worktrees/integ-11oct — n'y écris JAMAIS). D'autres chantiers tournent en parallèle sur la machine : ports de banc RÉSERVÉS à ce chantier : ${A.ports} (aucun autre). Un banc chronométré qui rate une fois se relance SEUL avant de conclure. Fixtures réelles (fx/) : lien symbolique temporaire vers /home/user/cancale-v67/scripts/bancs/fx (ignoré par git), retiré après. node_modules : lien symbolique vers /home/user/cancale-v67/node_modules.
INTERDITS : aucune écriture dans la base de production (lecture SEULEMENT, SELECT projetés via l'outil SQL Supabase projet lgonxzrzjcqthjtbdpzo, jamais un jeton, jamais un nom/adresse/message d'acheteur dans tes notes) ; aucun appel à Vinted, eBay ou Leboncoin ; aucun push, aucune PR, aucun déploiement ; aucune nouvelle fonction dans api/ (12 sur 12 : des modes de fonctions existantes) ; aucun nouveau cron Vercel sans l'avoir prouvé possible (un cron refusé bloque TOUS les déploiements) ; aucune migration appliquée (une migration nécessaire s'écrit dans supabase/migrations/ avec son essai annulé et son audit sur Postgres jetable, comme 013/014). Si l'extension doit changer : version ${A.ext} (numéro réservé à ce chantier, jamais publié), zip régénéré, EXT_ATTENDUE suivi, EXT_CAPACITES à cette version pour toute promesse nouvelle — l'intégration renumérotera.
CE QUE JULIEN A DEMANDÉ (11 octobre, il a dit « je veux que tu fasses ça » ; il ne veut plus de questions — tranche toi-même, dis ce que tu as tranché) :
${A.demandes}`
const SPEC = { type: 'object', properties: { chemin: { type: 'string' }, resume: { type: 'string' } }, required: ['chemin', 'resume'] }
const BUILD = { type: 'object', properties: { worktree: { type: 'string' }, branche: { type: 'string' }, commit: { type: 'string' }, fait: { type: 'string' }, preuves: { type: 'string' }, nonMesure: { type: 'string' } }, required: ['worktree', 'commit', 'fait', 'preuves', 'nonMesure'] }
const DEF = { type: 'object', properties: { defauts: { type: 'array', items: { type: 'object', properties: { titre: { type: 'string' }, gravite: { type: 'string', enum: ['haute', 'moyenne', 'basse'] }, reproduction: { type: 'string' }, correctif: { type: 'string' } }, required: ['titre', 'gravite', 'reproduction'] } } }, required: ['defauts'] }
const VERDICT = { type: 'object', properties: { refute: { type: 'boolean' }, reproduit: { type: 'boolean' }, raison: { type: 'string' } }, required: ['refute', 'reproduit', 'raison'] }

phase('Concevoir')
const spec = await agent(`${CTX}\n\nTA TÂCHE — MESURER ET CONCEVOIR (aucun code). Pour CHAQUE demande : (1) ce qui existe déjà dans le code (fichier:ligne, réutilise les propriétaires existants, §11) ; (2) ce que sa vraie base dit (lecture seule, projeté, chiffres) ; (3) ce qu'il faut construire, les trois états (lu / pas su / rien), l'identité utilisée, ce qui ne se devine pas ; (4) ce qui n'est pas mesurable et comment l'écran le dit honnêtement ; (5) le plan de preuve (audit qui exécute la vraie règle dans un vm, banc de rendu aux deux tailles sur données inventées, rouge avant / vert après / mutation). Écris ${SP}/spec.md (crée le dossier). Rends le chemin et un résumé.`, { label: 'concevoir', phase: 'Concevoir', schema: SPEC })

phase('Construire')
const build = await agent(`${CTX}\n\nTA TÂCHE — CONSTRUIRE la spécification ${spec.chemin}. Premier geste : cd /home/user/cancale-v67 && git worktree add ${WT} -b feat-${A.cle} ${A.base} (si le worktree existe déjà, reprends-y ce qui a été fait). COMMITE À CHAQUE ÉTAPE VERTE (aucun push). Pour chaque demande : le code, puis ses preuves (rouge sur ${A.base} via git archive + script copié dedans et lancé depuis cet arbre, vert après, rouge sous une mutation qui réaffaiblit la règle). Regarde les captures aux deux tailles (§6.2). Puis npm run build, TOUS les scripts/audit-*.cjs à 0 (audit-renum-b peut être sauté), les bancs touchés un par un sur tes ports, une section datée dans CLAUDE.md (ce qui est fait, mesuré, les preuves chiffrées, ce qui n'est pas mesuré) et le README des bancs. Rends worktree, branche, commit, fait, preuves, nonMesure.`, { label: 'construire', phase: 'Construire', schema: BUILD })
if (!build || !build.commit) return { spec, build }

const LENTILLES = [
  `LENTILLE VÉRITÉ ET DONNÉES : chaque chiffre, alerte et promesse de ces fonctions dit-il ce qui est MESURÉ ? trois états (une lecture ratée n'est jamais « rien »), identité jamais par ressemblance (§5), numéros jamais réattribués (§5, 013), un total partiel jamais présenté comme complet, aucune écriture qui efface sur une lecture ratée, aucune dépense ni appel payant sur la clé de Julien (§2.9), aucun geste interdit par §3, côté serveur : par vendeur (owner), jamais un mélange entre vendeurs. Exécute les vraies règles dans un vm et la vraie route quand il y en a une.`,
  `LENTILLE ÉCRAN ET USAGE : rends chaque écran touché aux deux tailles (390 px tactile et 1512 px) sur données inventées, et aussi en panne de base et sans extension : la fonction est-elle trouvable, compréhensible par quelqu'un qui n'est pas développeur, sans phrase répétée (§7), sans couleur hors palette, sans débordement, sans écran tombé (TDZ §4.6, React #31) ? un écran voisin a-t-il régressé ? les bancs existants des écrans touchés restent-ils verts ?`,
]
const hist = []
let aCorriger = []
let secs = 0
for (let tour = 1; tour <= 3; tour++) {
  phase('Relire')
  const vus = hist.flatMap(h => h.corriges)
  const trouves = (await parallel(LENTILLES.map((l, i) => () => agent(`${CTX}\n\nTOUR ${tour}. Tu es RELECTEUR ADVERSE du chantier dans ${WT} (HEAD actuel ; ce qu'il dit avoir fait : ${JSON.stringify({ fait: build.fait, nonMesure: build.nonMesure })}). Ne modifie pas ce worktree : travaille sur une COPIE (git -C ${WT} archive HEAD | tar -x -C ${SP}/t${tour}-r${i}). ${l}\nNe rapporte QUE ce que tu as REPRODUIT (commande + sortie, ou capture). Déjà traités : ${JSON.stringify(vus)}. Au plus 8 défauts, les plus graves d'abord ; zéro est une réponse valable.`, { label: `relire:${tour}:${i}`, phase: 'Relire', schema: DEF })))).filter(Boolean).flatMap(r => r.defauts || [])
  const juges = await parallel(trouves.map((d, i) => () => parallel([0, 1].map(j => () => agent(`${CTX}\n\nUn relecteur affirme ce défaut du chantier dans ${WT} (HEAD actuel). RÉFUTE-le si tu peux : reproduis-le toi-même sur une copie. refute=true si tu ne le reproduis pas, si c'est du style ou un « on pourrait », ou s'il est sans conséquence pour Julien. En cas de doute, refute=true.\nDÉFAUT : ${JSON.stringify(d)}`, { label: `refuter:${tour}:${i}:${j}`, phase: 'Réfuter', schema: VERDICT }))).then(vs => ({ d, vs: vs.filter(Boolean) }))))
  aCorriger = juges.filter(Boolean).filter(x => x.vs.filter(v => v.refute).length < 2 && x.vs.some(v => v.reproduit && !v.refute)).map(x => x.d)
  log(`tour ${tour} : ${trouves.length} rapportés, ${aCorriger.length} confirmés`)
  if (!aCorriger.length) { secs++; if (secs >= 2) break; continue }
  secs = 0
  phase('Corriger')
  const fix = await agent(`${CTX}\n\nCORRIGE ces défauts confirmés dans ${WT} et commite là (aucun push) :\n${JSON.stringify(aCorriger, null, 1)}\nPour chacun : reproduis (rouge), corrige à la racine, prouve (vert, rouge sous mutation). Puis build, tous les audits à 0, bancs touchés un par un sur tes ports, CLAUDE.md et README à jour. Si un défaut est faux en le reproduisant, dis-le dans nonMesure.`, { label: `corriger:${tour}`, phase: 'Corriger', schema: BUILD })
  hist.push({ tour, corriges: aCorriger.map(d => d.titre), fix })
  if (!fix || !fix.commit) break
}
return { cle: A.cle, spec, build, hist, restants: aCorriger }
