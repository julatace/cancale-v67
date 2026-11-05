// ═══════════════════════════════════════════════════════════════════════════
// BANC : L'AGENT eBAY EST ARRÊTÉ — PLUS AUCUNE NOTIFICATION DU MATIN (5 nov.)
//        node scripts/bancs/agent-ebay-push.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien (5 nov.) : « le bot eBay, arrête-le, c'est nul ». Jusqu'au 4 nov., le
// cron du matin lisait le résumé publié par l'agent (`main.vrm_agent_ebay_resume`)
// et demandait « 🛒 N paires prêtes pour eBay — publier ? ». Ce banc (qui
// prouvait cette question) prouve maintenant son SILENCE.
//
// §4.10 : on EXÉCUTE la vraie route `api/ship-reminders.js` contre une fausse
// base et un faux Web Push. Données inventées. Avec les cas où l'ancienne route
// SONNAIT (résumé frais, préparé, agent actif, préférence allumée), on exige :
//   A. aucune notification « … pour eBay », aucun mémo `agent_ebay_dedup`
//      écrit, le résumé de l'agent n'est même plus lu ; la route répond 200 ;
//   B. la catégorie « agentebay » est RETIRÉE (api/_lib/notif-textes.js) : plus
//      dans aucune famille, refusée même allumée, et absente des défauts.
// §6.1 : RACINE se déduit de __dirname.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
process.env.CRON_SECRET = 'cle-banc-rappels';
const OWNER = '11111111-2222-3333-4444-555555555555';
process.env.VRM_OWNER_UID = OWNER;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';

const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
const journal = [];   // l'ordre : écritures du mémo et envois
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { const o = JSON.parse(body); pushes.push({ endpoint: sub.endpoint, ...o }); journal.push('push:' + (o.tag || '')); return { statusCode: 201 }; };

let ko = 0, okc = 0;
const dit = (c, m, d) => { if (c) okc++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const auj = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

let CFG;
function reset(cfg) {
  pushes.length = 0; journal.length = 0;
  CFG = Object.assign({ resume: { v: 1, n: 3, at: Date.now() - 3600000 }, dedup: null, pref: { agentebay: true }, acces: true, mainKO: false, memoKO: false, ecritureKO: false, ecrits: [] }, cfg);
}
function poserFetch() {
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    const KO = () => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
    if (/^https:\/\/push\//.test(u) || /web\.push|fcm\.googleapis/.test(u)) return new Response('', { status: 201 });
    if (/\/rpc\/vrm_acces_pour/.test(u)) return J(CFG.acces);
    const methode = (opts.method || 'GET').toUpperCase();
    if (methode !== 'GET') {
      let corps = []; try { corps = JSON.parse(opts.body || '[]'); } catch (_) {}
      for (const r of (Array.isArray(corps) ? corps : [corps])) if (r && r.id === 'agent_ebay_dedup') { journal.push('memo'); CFG.ecrits.push(r.data); if (CFG.ecritureKO) return KO(); }
      return new Response('', { status: 201 });
    }
    if (/select=owner&limit=1/.test(u)) return J([{ owner: OWNER }]);
    if (/id=eq\.main/.test(u) && /select=owner/.test(u) && !/owner=eq\./.test(u)) return J([{ owner: OWNER }]);
    if (/id=eq\.main/.test(u)) {
      if (/vrm_agent_ebay_resume:data->vrm_agent_ebay_resume/.test(u)) return CFG.mainKO ? KO() : J([{ vrm_agent_ebay_resume: CFG.resume, ...(/vrm_agent_ebay_regles/.test(u) ? { vrm_agent_ebay_regles: CFG.regles || null } : {}) }]);
      return J([{ data: {} }]);
    }
    if (/id=eq\.agent_ebay_dedup/.test(u)) return CFG.memoKO ? KO() : J(CFG.dedup ? [{ data: CFG.dedup }] : []);
    if (/id=eq\.push_prefs/.test(u)) return J([{ data: CFG.pref }]);
    if (/id=eq\.push_subs/.test(u)) return J([{ data: { subs: [{ endpoint: 'https://web.push.apple.com/iphone-A' }] } }]);
    if (/\/vinted_accounts/.test(u)) return J([{ vinted_user_id: '900', login: 'compte_banc' }]);
    return J([]);   // tout le reste (bilan, colis, eBay…) : bénin
  };
}
const agent = () => pushes.filter((p) => /pour eBay/.test(`${p.title} ${p.body}`));

(async () => {
  poserFetch();
  let mod, libPush, libAbo = {};
  try { mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js')); } catch (e) { dit(false, 'api/ship-reminders.js se charge', String(e && e.message)); process.exit(1); }
  try { libPush = await import('file://' + path.join(RACINE, 'api', '_lib', 'push.js')); } catch (_) { libPush = {}; }
  try { libAbo = await import('file://' + path.join(RACINE, 'api', '_lib', 'abonnement.js')); } catch (_) {}
  const lancer = async (query = {}) => {
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof libAbo.oublierAcces === 'function') libAbo.oublierAcces();
    const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
    try { await mod.default({ method: 'GET', headers: { authorization: 'Bearer cle-banc-rappels' }, query }, res); } catch (e) { dit(false, 'la route ne lève pas', String(e && e.message)); }
    return res;
  };

  const lus = [];
  const fetch0 = global.fetch;
  global.fetch = async (url, opts) => { const u = decodeURIComponent(String(url)); if (/vrm_agent_ebay_resume|agent_ebay_dedup/.test(u)) lus.push(u.slice(0, 120)); return fetch0(url, opts); };
  for (const [nom, cfg] of [
    ['résumé frais, 3 à regarder', {}],
    ['résumé préparé, 2 prêtes', { resume: { v: 1, n: 2, pretes: 2, at: Date.now() - 3600000 } }],
    ['agent actif, 3 prêtes', { resume: { v: 1, n: 3, pretes: 3, at: Date.now() - 3600000 }, regles: { v: 1, actif: true } }],
  ]) {
    console.log(`── A. ${nom} : rien ne sonne`);
    reset(cfg); lus.length = 0;
    const res = await lancer();
    dit(agent().length === 0, 'aucune notification « … pour eBay »', agent().map((p) => p.title).join(' | ') || 'aucune');
    dit(!CFG.ecrits.length && !journal.includes('memo'), 'aucun mémo agent_ebay_dedup écrit', JSON.stringify(CFG.ecrits));
    dit(lus.length === 0, 'le résumé de l\'agent n\'est même plus lu', lus.join(' · '));
    dit(res.code === 200 && res.corps && !/"agentebay"/.test(JSON.stringify(res.corps)), 'la route répond 200, sans rubrique « agentebay »', `HTTP ${res.code} ${(/"agentebay":[^,}]*/.exec(JSON.stringify(res.corps || {})) || ['sans rubrique'])[0]}`);
  }

  console.log('\n── B. la catégorie « agentebay » est retirée');
  let T = {}; try { T = await import('file://' + path.join(RACINE, 'api', '_lib', 'notif-textes.js')); } catch (e) { dit(false, 'notif-textes se charge', String(e && e.message)); }
  dit(T.FAMILLE_DE && !Object.prototype.hasOwnProperty.call(T.FAMILLE_DE, 'agentebay'), 'elle n\'appartient plus à aucune famille');
  dit(T.decisionNotif && T.decisionNotif({ agentebay: true, familles: { ventes: true } }, 'agentebay') === false, 'refusée même allumée (ancien réglage) et famille Ventes allumée');
  dit(libPush.PUSH_DEFAUT && !Object.prototype.hasOwnProperty.call(libPush.PUSH_DEFAUT, 'agentebay'), 'absente des défauts du serveur');
  dit(T.decisionNotif && T.decisionNotif({}, 'vente') === true, 'l\'autre sens : une vente sonne toujours');

  console.log(`\n${okc} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
