// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE WIDGET ANNONCE LES MÊMES COLIS À POSTER QUE L'APP
//        (node scripts/bancs/widget-colis.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 4 octobre sur sa vraie base : pour 3 colis réellement à poster, le
// widget de son iPhone en annonçait 6, dont 2 « en retard » qui n'existaient
// pas. Trois causes, toutes servies ici (données INVENTÉES, aucune fixture) :
//   • la moisson d'un compte RETIRÉ de VRM reste en base — le widget la comptait ;
//   • les colis qu'il a cochés « posté » (`vinted_ship_done`) ou marqués expédiés
//     sur leur bordereau (`vinted_bords_shipped`) — l'app les sort, pas le widget ;
//   • la boucle de retard ne regardait que « imprimé » : un colis déjà posté dont
//     la date limite est passée sortait « en retard ».
// Et l'autre sens, sans lequel « tout retirer » passerait :
//   • la liste des comptes lue VIDE (clé publique sur base cloisonnée) ou en
//     panne ⇒ on ne filtre RIEN (§4.1 : une liste vide n'est pas une réponse) ;
//   • sans résumé de l'extension, le repli lit la vente entière et reconnaît
//     « Bordereau d'envoi commandé » (le champ machine `needs_action`).
// §4.10 — la VRAIE route est exécutée (import du module, faux fetch).
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const PASSE = '01/01/2020', LOIN = '31/12/2099';
const BORDS = [
  { transaction: 'T1', dateLimite: LOIN },   // à poster, pas pressé
  { transaction: 'T2', dateLimite: PASSE },  // coché « posté » dans l'app
  { transaction: 'T3', dateLimite: PASSE },  // bordereau marqué expédié
  { transaction: 'T9', dateLimite: PASSE },  // compte retiré de VRM
];

function poserFetch({ comptes, resume = true }) {
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if ((opts.method || 'GET') !== 'GET') return new Response('', { status: 201 });
    if (/select=owner&limit=1/.test(u)) return J({ message: 'column app_data.owner does not exist' }, 400); // base non cloisonnée
    if (/vinted_accounts/.test(u)) {
      if (comptes === 'panne') return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
      return J(comptes.map((id) => ({ vinted_user_id: id })));
    }
    if (/id=eq\.main/.test(u)) return J([{ vrm_widget_token: '', vinted_pickup_done: {}, vinted_bords_printed: {},
      vinted_ship_done: { T2: 1759500000000 }, vinted_bords_shipped: { T3: 1 }, vinted_sales_hidden: [] }]);
    if (/id=eq\.widget_stats/.test(u)) return J([]);
    if (/id=like\.email_bord_/.test(u)) return J(BORDS);
    if (/id=like\.email_final_|id=like\.email_sale_/.test(u)) return J([]);
    if (/orders_sold/.test(u) && /resume/.test(u)) {
      if (!resume) return J([{ id: 'harvest_111_orders_sold', txns: null }, { id: 'harvest_999_orders_sold', txns: null }]);
      return J([{ id: 'harvest_111_orders_sold', txns: ['T1', 'T2', 'T3'] }, { id: 'harvest_999_orders_sold', txns: ['T9'] }]);
    }
    if (/orders_sold/.test(u)) return J([
      { id: 'harvest_111_orders_sold', data: { payload: { my_orders: [
        { transaction_id: 'T1', status: "Bordereau d'envoi commandé", transaction_user_status: 'needs_action' },
        { transaction_id: 'T2', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action' },
        { transaction_id: 'T3', status: 'Le paiement a été validé', transaction_user_status: 'needs_action' },
        { transaction_id: 'T4', status: "Commande expédiée et en cours d'acheminement ! ", transaction_user_status: 'waiting' },
      ] } } },
      { id: 'harvest_999_orders_sold', data: { payload: { my_orders: [
        { transaction_id: 'T9', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action' },
      ] } } },
    ]);
    if (/orders_purchased/.test(u) && /resume/.test(u)) return J(resume ? [{ id: 'harvest_111_orders_purchased', txns: [] }] : []);
    if (/orders_purchased/.test(u)) return J([]);
    return J([]);
  };
}

async function appeler(opts) {
  poserFetch(opts);
  const mod = await import('file://' + path.join(RACINE, 'api', 'widget.js') + '?t=' + Math.random());
  const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
  await mod.default({ method: 'GET', headers: {}, query: {} }, res);
  return res;
}

(async () => {
  try {
    const r = await appeler({ comptes: ['111'] });
    const s = (r.corps && r.corps.ship) || {};
    dit(r.code === 200, 'réponse rendue', 'HTTP ' + r.code);
    dit(s.total === 1, 'à expédier = 1 : ni le compte retiré, ni le colis coché « posté », ni le bordereau marqué expédié', `ship.total=${s.total}`);
    dit(s.overdue === 0, 'aucun « en retard » inventé (les dates dépassées sont celles de colis déjà partis ou d\'un compte retiré)', `ship.overdue=${s.overdue}`);
  } catch (e) { dit(false, 'cas normal exécuté', String(e && e.message).slice(0, 160)); }

  try {
    const r = await appeler({ comptes: [] });
    const s = (r.corps && r.corps.ship) || {};
    dit(s.total === 2, 'liste des comptes lue VIDE ⇒ on ne filtre rien (une liste vide n\'est pas une réponse) — T1 et T9 restent', `ship.total=${s.total}`);
  } catch (e) { dit(false, 'cas « liste vide » exécuté', String(e && e.message).slice(0, 160)); }

  try {
    const r = await appeler({ comptes: 'panne' });
    const s = (r.corps && r.corps.ship) || {};
    dit(r.code === 200 && s.total === 2, 'liste des comptes en panne ⇒ on ne filtre rien, et le widget répond quand même', `HTTP ${r.code} · ship.total=${s.total}`);
  } catch (e) { dit(false, 'cas « panne des comptes » exécuté', String(e && e.message).slice(0, 160)); }

  try {
    const r = await appeler({ comptes: ['111'], resume: false });
    const s = (r.corps && r.corps.ship) || {};
    dit(s.total === 1, 'sans résumé de l\'extension, le repli reconnaît « Bordereau d\'envoi commandé » (champ machine) et garde les mêmes exclusions', `ship.total=${s.total}`);
  } catch (e) { dit(false, 'cas « repli sans résumé » exécuté', String(e && e.message).slice(0, 160)); }

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
