export const meta = {
  name: 'chantier-agent-ebay',
  description: "Un chantier de l'agent eBay autonome (spec-finale.md) : construire dans un worktree isolé, deux relectures adverses qui reproduisent, corriger — rouge sur l'avant, rouge sous mutation",
  phases: [
    { title: 'Construire' },
    { title: 'Relire' },
    { title: 'Corriger' },
  ],
}

const SP = '/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad'
const SPEC = SP + '/agent-ebay-autonome/spec-finale.md'
const K = args && args.k
const TITRE = (args && args.titre) || ''
const BASE = (args && args.base) || 'claude/project-review-nsk5su'
const EXTRA = (args && args.extra) || ''
if (!K) throw new Error('args.k manquant')
const NOTES = `${SP}/agent-ebay-chantiers/${K}`

const CTX = `Contexte : VRM (dépôt /home/user/cancale-v67) est l'outil de Julien, revendeur de sneakers. Il veut un agent eBay « 100 % autonome, qui ne dépend de personne ». La conception est faite et relue adversairement : ${SPEC} (lis §0 à §5 et §7, puis la section de TON chantier en entier, et §10 pour la carte des zones). Les études sous-jacentes sont dans ${SP}/agent-ebay-autonome/ (bordereaux.md, suivi.md, infra.md, etat.md, relectures).

TON CHANTIER : ${K}${TITRE ? ' — ' + TITRE : ''}.
${EXTRA}

DÉCISIONS DÉJÀ PRISES (Julien ne veut plus de questions ; elles sont tranchées) : §9 de la spec, recommandation retenue partout — (1) Vercel Pro plus tard, avant d'ouvrir l'agent aux autres vendeurs : l'interrupteur d'installation reste « propriétaire seulement » ; (2) l'exception « annonce publiée après la vente » est remplacée par la règle vue_le ; (3) l'envoi se déclare à eBay au PREMIER SCAN du transporteur ; (4) pas d'offre automatique aux observateurs ; (5) réponses aux questions préparées, envoyées sur son clic ; (6) pas de service payant de suivi Mondial Relay pour l'instant ; (7) une clé La Poste pour l'installation, résultats rangés par vendeur ; (9) une annulation de bordereau déjà décidée va jusqu'au bout. L'horloge pg_cron/pg_net est ACCEPTÉE (migration séparée, appliquée plus tard par la session principale après essai annulé — tu n'appliques RIEN en production).

RÈGLES : CLAUDE.md (dans ton contexte) en entier, en particulier §2-§6, §11, « rien lu ne vaut pas rien », §4.10 (une route n'est vérifiée que si un banc l'EXÉCUTE), le plafond de 12 fonctions Vercel (audit-fonctions-api), aucun cron Vercel ajouté. eBay par son API officielle seulement. Aucun appel réel à eBay, à un transporteur, à La Poste ou à Vinted : les bancs servent des faux serveurs à la VRAIE forme documentée. Production : lecture seule projetée seulement (ToolSearch "select:mcp__Supabase__execute_sql", projet lgonxzrzjcqthjtbdpzo) ; jamais un jeton, jamais une donnée d'acheteur dans ce que tu écris. Aucune fixture réelle dans le dépôt (public). Preuves : chaque contrôle ROUGE sur le code d'avant (§6.1, copie de l'arbre d'avant, chemins relatifs à __dirname) et ROUGE sous mutation de la règle. Aucun identifiant de modèle dans les commits ; chaque message de commit se termine par :
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012UsEbcF3XbBnmXpwYyNnbn
Ne pousse rien, ne touche à aucun autre worktree, n'ouvre aucune PR. Si tu modifies vinted-sync-extension/, NE change PAS sa version (la session principale renumérote à la fusion) mais régénère le zip. Notes et scripts temporaires : ${NOTES}/.`

const OUT = { type: 'object', properties: { worktree: { type: 'string' }, branche: { type: 'string' }, commit: { type: 'string' }, fait: { type: 'string' }, preuves: { type: 'string' }, nonMesure: { type: 'string' }, gestesJulien: { type: 'string' } }, required: ['worktree', 'branche', 'commit', 'fait', 'preuves'] }

phase('Construire')
const build = await agent(`${CTX}

TA TÂCHE — CONSTRUIRE ${K}, dans ce worktree isolé. D'abord : git log -1 ; puis git merge --no-edit ${BASE} depuis le dépôt d'origine (jamais -s ours) pour partir de la dernière intégration. Construis EXACTEMENT ce que la spec demande pour ${K} (geste vu par Julien, appels, données, trois états, gardes, identité SKU VRM-{n°} et numérotation 013 via api/_lib/numerotation.js, cloisonnement par vendeur ET par compte eBay, preuves), dans les zones de ${K} seulement. Écris l'audit/banc demandés, prouve-les rouges sur l'avant et sous mutation, lance npm run build, TOUS les scripts/audit-*.cjs, et les bancs que tu touches un par un (regarde les captures). Ajoute à CLAUDE.md une section courte et datée (11 octobre) pour ${K} : ce qui est fait, les preuves, ce qui n'est pas mesuré, les gestes de Julien. Commit.`, { label: `construire:${K}`, phase: 'Construire', isolation: 'worktree', schema: OUT })
if (!build) return { erreur: 'construction sans résultat', k: K }

phase('Relire')
const LENT = [
  "JUSTESSE ET SÛRETÉ : reproduis chaque défaut (exécute la vraie route/fonction dans un vm, rends l'écran). Cherche : « pas su » qui agit, double vente, mauvais vendeur ou mauvais compte eBay, idempotence et course (deux passages, deux onglets), argent engagé sans garde, donnée d'acheteur rangée ou loguée, jeton exposé, garde-fous de Vinted touchés, écart avec la spec.",
  "PREUVES ET HONNÊTETÉ : les audits/bancs mordent-ils vraiment (rejoue-les sur l'avant et sous tes propres mutations) ; formes servies par les faux serveurs = forme documentée (§6.3) ; ce que l'écran affirme est-il mesuré (trois états, §7 une cause une phrase) ; promesses non tenables ; régressions sur les audits et bancs voisins (relance-les) ; CLAUDE.md dit-il vrai.",
]
const relus = await parallel(LENT.map((l, i) => () => agent(`${CTX}

${K} est construit dans ${build.worktree} (branche ${build.branche}, commit ${build.commit}). Fait : ${build.fait}\nPreuves annoncées : ${build.preuves}

TA TÂCHE — RELECTURE ADVERSE, lentille ${l}
Ne modifie pas ce worktree (copie-le dans ${NOTES}/relecture-${i}/ pour muter). Ne rapporte que ce que tu as REPRODUIT. Notes : ${NOTES}/relecture-${i}.md.`, { label: `relire:${K}:${i}`, phase: 'Relire', schema: { type: 'object', properties: { defauts: { type: 'array', items: { type: 'object', properties: { titre: { type: 'string' }, preuve: { type: 'string' }, correctif: { type: 'string' }, gravite: { type: 'string' } }, required: ['titre', 'preuve', 'correctif', 'gravite'] } }, avis: { type: 'string' } }, required: ['defauts', 'avis'] } })))
const defauts = relus.filter(Boolean).flatMap(r => r.defauts)
log(`${K} : ${defauts.length} défaut(s) rapporté(s)`)
if (!defauts.length) return { k: K, build, relus }

phase('Corriger')
const fix = await agent(`${CTX}

${K} est dans ${build.worktree} (branche ${build.branche}, commit ${build.commit}). Deux relecteurs adverses ont rapporté :
${JSON.stringify(defauts, null, 2)}

TA TÂCHE — CORRIGER dans ce même worktree (cd ${build.worktree}). Pour chaque défaut : reproduis-le, corrige-le ou rejette-le avec la preuve, et ajoute le contrôle qui l'attrape (rouge sur ${build.commit}, vert après, rouge sous mutation). Puis build, tous les audits, les bancs touchés un par un ; mets à jour la section de CLAUDE.md ; commit.`, { label: `corriger:${K}`, phase: 'Corriger', schema: OUT })

return { k: K, build, relus, fix }
