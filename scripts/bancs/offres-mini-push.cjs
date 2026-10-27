// ═══════════════════════════════════════════════════════════════════════════
// BANC : « UNE OFFRE A PASSÉ TON PRIX MINI » → UNE NOTIFICATION (1 tap)
//        node scripts/bancs/offres-mini-push.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Demande de Julien (27 oct.) : être prévenu sur le téléphone dès qu'une offre
// dépasse le prix mini posé à côté du N°, pour l'accepter en 1 tap dans VRM.
// RIEN n'est accepté tout seul — la notification mène au fil, c'est son tap qui
// vend (§3). Détection SERVEUR (app fermée) : `rappelsOffresMini` dans le cron.
//
// §4.10 : on EXÉCUTE la vraie route `api/ship-reminders.js` contre une fausse
// base et un faux Web Push. Données inventées. On exige :
//   A. plancher 40 € + offre 45 € (≥) ⇒ UNE notification « au-dessus de ton
//      prix mini », qui ouvre ?tab=cat_msg ;
//   B. offre 35 € (< plancher) ⇒ rien ;
//   C. aucun plancher posé ⇒ rien ;
//   D. préférence « offremini » coupée ⇒ rien ;
//   E. abonnement coupé (vrm_acces_pour = false) ⇒ rien ;
//   F. offre déjà notifiée (dans le mémo) ⇒ rien (dédoublé par offer_request_id) ;
//   G. conversations illisibles (522) ⇒ rien d'inventé ;
//   H. main illisible (522) ⇒ rien.
// §6.1 : RACINE se déduit de __dirname.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
process.env.CRON_SECRET = 'cle-banc-rappels';
const OWNER='11111111-2222-3333-4444-555555555555';
process.env.VRM_OWNER_UID = OWNER;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';

const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

let ko = 0, okc = 0;
const dit = (c, m, d) => { if (c) okc++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// Une offre EN ATTENTE (statut 10) de l'acheteur `opp` sur l'article `item`.
const offreMsg = (opp, oid, prix) => ({ entity_type: 'offer_request_message', entity: { user_id: opp, current: true, status: 10, status_title: '', price: { amount: String(prix) }, transaction_id: 'TX' + oid, offer_request_id: oid } });
const conv = (item, opp, oid, prix) => ({ opp: String(opp), item: String(item), msgs: [offreMsg(opp, oid, prix)] });

let CFG;
function reset(cfg) {
  pushes.length = 0;
  CFG = Object.assign({ planchers: { 444: { numero: '7', min: '40' } }, convs: [], dedup: { oids: [] }, pref: { offremini: true }, acces: true, convKO: false, mainKO: false }, cfg);
}
function poserFetch() {
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    const KO = () => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
    if (/^https:\/\/push\//.test(u) || /web\.push|fcm\.googleapis/.test(u)) { return new Response('', { status: 201 }); }
    if (/\/rpc\/vrm_acces_pour/.test(u)) return J(CFG.acces);
    if ((opts.method || 'GET').toUpperCase() !== 'GET') return new Response('', { status: 201 });
    const sel = new URL(u).searchParams.get('select') || '';
    // Sonde de cloisonnement : la colonne existe (base cloisonnée, un vendeur 'A').
    if (/select=owner&limit=1/.test(u)) return J([{ owner: OWNER }]);
    if (/id=eq\.main/.test(u) && /select=owner/.test(u) && !/owner=eq\./.test(u)) return J([{ owner: OWNER }]);
    // main : projection du prix mini (notre lecture) vs les autres (urssaf…).
    if (/id=eq\.main/.test(u)) {
      if (/vinted_annonce_numeros/.test(sel)) return CFG.mainKO ? KO() : J([{ vinted_annonce_numeros: CFG.planchers }]);
      return J([{ data: {} }]);
    }
    if (/id=like\.harvest_%25_conv_%25|id=like\.harvest_%_conv_%/.test(u)) return CFG.convKO ? KO() : J(CFG.convs);
    if (/id=eq\.offres_mini_dedup/.test(u)) return J([{ data: CFG.dedup }]);
    if (/id=eq\.push_prefs/.test(u)) return J([{ data: CFG.pref }]);
    if (/id=eq\.push_subs/.test(u)) return J([{ data: { subs: [{ endpoint: 'https://web.push.apple.com/iphone-A' }] } }]);
    if (/\/vinted_accounts/.test(u)) return J([{ vinted_user_id: '900', login: 'compte_banc' }]);
    return J([]);   // tout le reste (bilan, colis, ebay…) : benin
  };
}
const mini = () => pushes.filter((p) => /prix mini/i.test(`${p.title} ${p.body}`));

(async () => {
  poserFetch();
  let mod, libPush, libAbo = {};
  try { mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js')); } catch (e) { dit(false, 'api/ship-reminders.js se charge', String(e && e.message)); process.exit(1); }
  try { libPush = await import('file://' + path.join(RACINE, 'api', '_lib', 'push.js')); } catch (_) { libPush = {}; }
  try { libAbo = await import('file://' + path.join(RACINE, 'api', '_lib', 'abonnement.js')); } catch (_) {}
  const lancer = async () => {
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof libAbo.oublierAcces === 'function') libAbo.oublierAcces();
    const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
    await mod.default({ method: 'GET', headers: { authorization: 'Bearer cle-banc-rappels' }, query: {} }, res);
    return res;
  };

  console.log('── A. plancher 40 €, offre 45 € (au-dessus) : une notification « 1 tap »');
  reset({ convs: [conv(444, 5301, 'O1', 45)] });
  await lancer();
  { const p = mini()[0] || {};
    console.log(`     téléphone : « ${p.title} » / « ${p.body} »`);
    dit(mini().length === 1, 'UNE notification « au-dessus de ton prix mini »', String(mini().length));
    dit(/1 tap/i.test(p.body || ''), 'elle dit « à accepter en 1 tap »', p.body);
    dit(p.url === '/?tab=cat_msg', 'le clic ouvre Messages (?tab=cat_msg)', p.url); }

  console.log('\n── B. offre 35 € (sous le plancher) : rien');
  reset({ convs: [conv(444, 5301, 'O2', 35)] });
  await lancer();
  dit(mini().length === 0, 'une offre sous le mini ne notifie pas', String(mini().length));

  console.log('\n── C. aucun prix mini posé : rien');
  reset({ planchers: { 444: { numero: '7' } }, convs: [conv(444, 5301, 'O3', 45)] });
  await lancer();
  dit(mini().length === 0, 'sans prix mini, aucune notification', String(mini().length));

  console.log('\n── D. préférence « offremini » coupée : rien');
  reset({ convs: [conv(444, 5301, 'O4', 45)], pref: { offremini: false } });
  await lancer();
  dit(mini().length === 0, '« Offre à accepter » coupé ⇒ rien', String(mini().length));

  console.log('\n── E. abonnement coupé : rien');
  reset({ convs: [conv(444, 5301, 'O5', 45)], acces: false });
  await lancer();
  dit(mini().length === 0, 'qui ne paie plus ne reçoit plus rien', String(mini().length));

  console.log('\n── F. offre déjà notifiée (mémo) : rien');
  reset({ convs: [conv(444, 5301, 'O6', 45)], dedup: { oids: ['O6'] } });
  await lancer();
  dit(mini().length === 0, 'une offre déjà notifiée ne re-sonne pas (dédoublée par offer_request_id)', String(mini().length));

  console.log('\n── G. conversations illisibles (522) : rien d’inventé');
  reset({ convs: [conv(444, 5301, 'O7', 45)], convKO: true });
  await lancer();
  dit(mini().length === 0, 'conversations illisibles ⇒ « pas su », rien envoyé', String(mini().length));

  console.log('\n── H. main (les planchers) illisible (522) : rien');
  reset({ convs: [conv(444, 5301, 'O8', 45)], mainKO: true });
  await lancer();
  dit(mini().length === 0, 'planchers illisibles ⇒ « pas su », rien envoyé', String(mini().length));

  console.log(`\n${okc} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
