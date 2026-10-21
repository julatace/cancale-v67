// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA RÈGLE « MESSAGE eBAY SANS RÉPONSE » (21 octobre)
// node scripts/audit-ebay-messages-nonlus.cjs [--mutation=reponses|fenetre|complet|retire]
// ═══════════════════════════════════════════════════════════════════════════
// Exécute la VRAIE règle (api/_lib/ebay-messages-nonlus.js), importée par la
// route ET par l'écran eBay → Messages (§11), et vérifie :
//   · Unanswered sans réponse, de moins de 7 j ⇒ compté ; répondu, vieux, ou
//     date illisible ⇒ non ;
//   · liste illisible ⇒ `null` (pas su — la route n'écrit rien) ;
//   · d'autres pages chez eBay ⇒ `complet: false` (« au moins ») ;
//   · le résumé ne porte aucun nom ni texte ;
//   · une réponse sort l'échange une fois, jamais en dessous de 0 ;
//   · l'écran eBay → Messages et Ma journée lisent la MÊME règle.
// `--mutation=…` réaffaiblit la règle dans une copie : le contrôle doit rougir.
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'api', '_lib', 'ebay-messages-nonlus.js');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  let code = fs.readFileSync(SRC, 'utf8');
  const remplace = (a, b) => { if (!code.includes(a)) { console.log('KO  mutation impossible : ancre absente'); process.exit(1); } code = code.replace(a, b); };
  if (mut === 'reponses') remplace("&& !(Array.isArray(m.responses) && m.responses.length)", '');
  if (mut === 'fenetre') remplace('maintenant - t >= MSG_EBAY_RECENT_MS', 'false');
  if (mut === 'complet') remplace('complet: !(Number.isInteger(totalPages) && totalPages > 1)', 'complet: true');
  if (mut === 'retire') remplace("if (!d.ids.includes(id)) return undefined;", '');
  const tmp = path.join(os.tmpdir(), 'audit-ebay-msg-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, code);
  const R = await import('file://' + tmp);
  fs.unlinkSync(tmp);
  const N = Date.parse('2026-10-21T12:00:00Z'), J = 86400000;
  const m = (id, status, jours, rep, extra = {}) => ({ id, status, date: new Date(N - jours * J).toISOString(), responses: rep ? ['oui'] : [], sender: 'acheteur_secret', body: 'texte privé', subject: 'Dispo ?', ...extra });
  const liste = [m('A', 'Unanswered', 1), m('B', 'Answered', 1, true), m('C', 'Unanswered', 10), m('D', 'Unanswered', 2, true), m('E', 'unanswered', 0.5), m('F', 'Unanswered', 0, false, { date: 'pas une date' })];
  const r = R.resumeMessagesEbay(liste, 1, N);
  dit(r && r.nonLus === 2 && r.ids.join(',') === 'A,E', 'Unanswered sans réponse de moins de 7 j : comptés (A, E) ; répondu, vieux, date illisible : non', JSON.stringify(r && r.ids));
  dit(R.resumeMessagesEbay(null, 1, N) === null && R.resumeMessagesEbay(undefined, 1, N) === null, 'liste illisible ⇒ null (pas su : rien n\'est écrit)');
  dit(r && r.complet === true && R.resumeMessagesEbay(liste, 3, N).complet === false && R.resumeMessagesEbay(liste, null, N).complet === true, 'd\'autres pages chez eBay ⇒ « au moins » (complet:false)');
  dit(r && !/acheteur_secret|texte privé|Dispo/.test(JSON.stringify(r)), 'le résumé ne porte ni nom, ni texte, ni sujet', JSON.stringify(r));
  dit(R.messageEbayNonLu(m('X', 'Unanswered', 1, true)) === false && R.messageEbayNonLu(m('X', 'Unanswered', 1)) === true, 'une réponse déjà là ⇒ pas « non lu »');
  const d = { nonLus: 2, ids: ['A', 'E'], complet: true };
  const d2 = R.retirerMessageRepondu(d, 'A');
  dit(d2 && d2.nonLus === 1 && d2.ids.join(',') === 'E', 'une réponse sort l\'échange (2 → 1)', JSON.stringify(d2));
  dit(R.retirerMessageRepondu(d2, 'A') === undefined && R.retirerMessageRepondu({ nonLus: 0, ids: [] }, 'Z') === undefined, 'un échange absent ne retire rien (jamais deux fois, jamais sous 0)');
  // §11 : l'écran eBay → Messages et la route lisent la même règle.
  const ecran = fs.readFileSync(path.join(RACINE, 'src', 'ebayGestion.jsx'), 'utf8');
  dit(/import\s*\{\s*messageEbayNonLu\s*\}\s*from\s*'..\/api\/_lib\/ebay-messages-nonlus\.js'/.test(ecran) && /aRepondre=messageEbayNonLu\(m\)/.test(ecran), 'eBay → Messages marque « non lu » par la même règle (§11)');
  const route = fs.readFileSync(path.join(RACINE, 'api', 'ebay.js'), 'utf8');
  dit(/resumeMessagesEbay/.test(route) && /retirerMessageRepondu/.test(route), 'la route range le résumé et le met à jour après une réponse');
  console.log(ko ? `\n❌ messages eBay sans réponse : ${ko} rouge(s)${mut ? ' (mutation ' + mut + ')' : ''}` : '\n✅ messages eBay sans réponse : tout est vert');
  process.exit(ko ? 1 : 0);
})();
