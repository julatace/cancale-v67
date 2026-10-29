// ═══════════════════════════════════════════════════════════════════════════
// BANC : « 🛒 N PAIRES PRÊTES POUR eBAY — PUBLIER ? » — la notification du matin
//        node scripts/bancs/agent-ebay-push.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien (29 oct.) : « je veux juste qu'il demande s'il doit poster les
// articles ». L'agent PROPOSE (dans l'app) et publie un résumé dans un réglage
// synchronisé (`main.vrm_agent_ebay_resume` = { v, n, at, pause? }). Le cron du
// matin le LIT et pose la question sur le téléphone — il ne publie RIEN.
//
// §4.10 : on EXÉCUTE la vraie route `api/ship-reminders.js` contre une fausse
// base et un faux Web Push. Données inventées. On exige :
//   A. résumé frais (n = 3, sans préparation) ⇒ UNE notification « 🛒 3 paires
//      à regarder pour eBay » (jamais « prêtes » sans préparation, revue du
//      29 oct.) qui ouvre ?tab=ebay_agent, et le mémo du jour est écrit AVANT
//      l'envoi ; A2. résumé préparé ⇒ « 3 proposées · 1 prête », « 2 prêtes » ;
//   B. résumé de plus de 48 h ⇒ rien ;
//   C. « Pas maintenant » aujourd'hui (pause) ⇒ rien ;
//   D. n = 0 ⇒ rien ;
//   E. préférence « agentebay » coupée ⇒ rien ;
//   F. abonnement coupé ⇒ rien ;
//   G. déjà demandé aujourd'hui (mémo) ⇒ rien ;
//   H. main illisible (522) ⇒ rien ;
//   I. mémo illisible (522) ⇒ rien ;
//   J. mémo non écrit (la base refuse l'écriture) ⇒ rien ;
//   K. le rappel du SOIR ne pose pas la question.
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
      if (/vrm_agent_ebay_resume:data->vrm_agent_ebay_resume/.test(u)) return CFG.mainKO ? KO() : J([{ vrm_agent_ebay_resume: CFG.resume }]);
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

  console.log('── A. résumé frais (3 paires) : UNE notification, le mémo écrit AVANT');
  reset();
  await lancer();
  { const p = agent()[0] || {};
    console.log(`     téléphone : « ${p.title} » / « ${p.body} »`);
    dit(agent().length === 1, 'UNE notification', String(agent().length));
    dit(p.title === '🛒 3 paires à regarder pour eBay', 'sans préparation chez eBay : « 🛒 3 paires à regarder pour eBay » — jamais « prêtes »', p.title);
    dit(/Rien n.est publi/.test(p.body || ''), 'elle dit que rien n\'est publié sans son oui', p.body);
    dit(p.url === '/?tab=ebay_agent', 'le clic ouvre eBay → À traiter, où vit l\'agent (?tab=ebay_agent)', p.url);
    const iM = journal.indexOf('memo'), iP = journal.findIndex((x) => /^push:agent-ebay/.test(x));
    dit(iM >= 0 && iP > iM, 'le mémo du jour est écrit AVANT l\'envoi', journal.join(' > '));
    dit(CFG.ecrits[0] && CFG.ecrits[0].date === auj() && CFG.ecrits[0].n === 3, 'le mémo porte le jour de Paris et le nombre', JSON.stringify(CFG.ecrits[0])); }

  console.log('\n── A2. résumé PRÉPARÉ par l\'écran (3 proposées, 1 prête)');
  reset({ resume: { v: 1, n: 3, pretes: 1, at: Date.now() - 3600000 } });
  await lancer();
  { const p = agent()[0] || {};
    dit(p.title === '🛒 3 paires proposées pour eBay · 1 prête à publier', 'la notification suit les préparations : « 3 proposées · 1 prête »', p.title); }
  reset({ resume: { v: 1, n: 2, pretes: 2, at: Date.now() - 3600000 } });
  await lancer();
  { const p = agent()[0] || {};
    dit(p.title === '🛒 2 paires prêtes pour eBay — je les publie ?', 'toutes préparées et prêtes : « 🛒 2 paires prêtes pour eBay — je les publie ? »', p.title); }

  console.log('\n── B. résumé de plus de 48 h : rien');
  reset({ resume: { v: 1, n: 3, at: Date.now() - 49 * 3600000 } });
  await lancer();
  dit(agent().length === 0, 'un résumé périmé ne fait rien sonner (des paires ont pu se vendre)', String(agent().length));

  console.log('\n── C. « Pas maintenant » aujourd’hui : rien');
  reset({ resume: { v: 1, n: 3, at: Date.now() - 3600000, pause: auj() } });
  await lancer();
  dit(agent().length === 0, 'son « pas maintenant » du jour est respecté', String(agent().length));

  console.log('\n── D. aucune paire prête : rien');
  reset({ resume: { v: 1, n: 0, at: Date.now() - 3600000 } });
  await lancer();
  dit(agent().length === 0, 'n = 0 ⇒ aucune notification', String(agent().length));

  console.log('\n── E. préférence « agentebay » coupée : rien');
  reset({ pref: { agentebay: false } });
  await lancer();
  dit(agent().length === 0, '« Agent eBay » coupé ⇒ rien', String(agent().length));

  console.log('\n── F. abonnement coupé : rien');
  reset({ acces: false });
  await lancer();
  dit(agent().length === 0, 'qui ne paie plus ne reçoit plus rien', String(agent().length));

  console.log('\n── G. déjà demandé aujourd’hui : rien');
  reset({ dedup: { date: auj(), n: 3 } });
  await lancer();
  dit(agent().length === 0, 'une seule question par jour', String(agent().length));

  console.log('\n── H. main illisible (522) : rien');
  reset({ mainKO: true });
  await lancer();
  dit(agent().length === 0, 'résumé illisible ⇒ « pas su », rien envoyé', String(agent().length));

  console.log('\n── I. mémo illisible (522) : rien');
  reset({ memoKO: true });
  await lancer();
  dit(agent().length === 0, 'mémo illisible ⇒ rien envoyé (sinon deux fois le même jour)', String(agent().length));

  console.log('\n── J. mémo non écrit (la base refuse) : rien');
  reset({ ecritureKO: true });
  await lancer();
  dit(agent().length === 0, 'mémo non écrit ⇒ rien envoyé', String(agent().length));

  console.log('\n── K. le rappel du soir ne pose pas la question');
  reset();
  await lancer({ moment: 'soir' });
  dit(agent().length === 0, 'seul le cron du matin demande', String(agent().length));

  console.log(`\n${okc} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
