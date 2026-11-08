// ════════════════════════════════════════════════════════════════════════════
//  « OFFRE AU-DESSUS DE TON PRIX MINI » : UNE LECTURE BORNÉE (7 nov., audit
//  « 1 000 vendeurs »). Le cron du matin (api/ship-reminders.js) cherchait les
//  offres en attente avec un filtre `cs` sur le JSON de TOUTES les conversations
//  du vendeur. Sans migration, la lecture est bornée par deux filtres :
//   M1. la date de capture (`meta->>capturedAt`, scalaire du déclencheur 004) :
//       7 jours en arrière, ISO, filtré par la base ;
//   M2. les articles qui ont un prix mini (`item_id=in.(…)`, numériques seuls ;
//       au-delà de 200 articles, date seule — l'URL resterait trop longue) ;
//   M3. la requête de la route les porte, garde son `cs`, ne lit jamais `data`
//       entier, et la règle est EXÉCUTÉE (filtresOffresMini).
//  `--prouve` : chaque mutation rougit. Le comportement de bout en bout (une
//  offre ≥ mini ⇒ une notification) reste tenu par scripts/bancs/offres-mini-push.cjs.
//  Lancer : node scripts/audit-offres-mini-lecture.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const F = 'api/ship-reminders.js';
const MUTATIONS = {
  'pas de filtre de date': [[F, "return `meta->>capturedAt=gte.${encodeURIComponent(depuis)}${parArticle}`;", 'return `${parArticle.slice(1)}`;']],
  'pas de filtre d’article': [[F, "const parArticle = ids.length && ids.length <= OFFRES_MINI_ARTICLES_MAX ?", 'const parArticle = false ?']],
  'identifiants pas vérifiés': [[F, ".filter((x) => /^\\d{1,20}$/.test(x))", '']],
  'route sans les filtres': [[F, '&${filtresOffresMini(planchers, maintenant)}&${OFFRES_MINI_FILTRE}', '&${OFFRES_MINI_FILTRE}']],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const vrai = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };
(async () => {
  process.env.CRON_SECRET = process.env.CRON_SECRET || 'x';
  const { filtresOffresMini } = await import(path.join(R, F));
  const T = Date.parse('2026-11-07T05:00:00Z');
  const f = decodeURIComponent(filtresOffresMini(new Map([['444', 40], ['5555', 12]]), T));
  vrai(f.includes('meta->>capturedAt=gte.2026-10-31T05:00:00.000Z'), `M1 date de capture : 7 jours en arrière, ISO (${f.slice(0, 60)}…)`);
  vrai(/&data->payload->conversation->transaction->>item_id=in\.\(444,5555\)$/.test(f), 'M2 seulement les articles qui ont un prix mini');
  const g = decodeURIComponent(filtresOffresMini(new Map([['444', 40], ['1);drop', 3], ['x,y', 2]]), T));
  vrai(/item_id=in\.\(444\)$/.test(g), 'M2 un identifiant qui n’est pas un nombre n’entre pas dans la requête');
  const beaucoup = new Map(); for (let i = 0; i < 201; i++) beaucoup.set(String(1000 + i), 10);
  const h = decodeURIComponent(filtresOffresMini(beaucoup, T));
  vrai(!/item_id=in/.test(h) && /capturedAt=gte\./.test(h), 'M2 plus de 200 articles ⇒ la date seule');
  const src = sansCommentaires(fs.readFileSync(path.join(R, F), 'utf8'));
  const l = (/fetchPaginated\(scoped\(`app_data\?id=like\.harvest_%25_conv_%25[^`]*`\)\)/.exec(src) || [''])[0];
  vrai(/&\$\{filtresOffresMini\(planchers, maintenant\)\}&\$\{OFFRES_MINI_FILTRE\}&select=/.test(l), 'M3 la lecture des conversations porte les deux filtres et garde son `cs`');
  vrai(l && !/select=[^`]*\bdata(,|`|$)/.test(l), 'M3 elle ne lit jamais `data` entier (projection)');
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
}
