// AUDIT : eBay → « À traiter » (16 nov., lot ebay-a-traiter) — vu par Julien en production :
//   « Retours : Réponse eBay illisible pour les retours. » (il n'a AUCUN retour)
//   « Compte eBay mal désigné — rien n'a été envoyé à eBay. » sous « Tâches à traiter ».
// Exécute la VRAIE route `api/ebay.js` (§4.10) contre une fausse base (registre `ebay_comptes`
// à la forme mesurée : un principal relié, clé de 16 hexadécimaux) et un FAUX eBay (Trading,
// Post-Order v2 `return/search` et `cancellation/search` aux formes de la documentation).
// Données inventées, aucun appel réel.
//   node scripts/audit-ebay-a-traiter.cjs            (le dépôt)
//   node scripts/audit-ebay-a-traiter.cjs --prouve   (chaque mutation doit rougir)
//   node scripts/audit-ebay-a-traiter.cjs --avant    (l'arbre de main d'avant doit rougir)
// On exige :
//   T. `taches` (« Tâches à traiter ») : `compte:'principal'` (le nom que l'app donne au principal)
//      ou absent ⇒ les tâches du principal ; un second compte (clé ⇒ suffixe) ⇒ SES lignes
//      seulement ; `ebay_orders` lue PROJETÉE, jamais `select=data` ; une clé qui n'est pas un
//      compte ⇒ refus qui dit le geste (« reconnecte ») ; rien n'est écrit chez eBay ;
//   R. retours : corps vide / 204 / total à 0 ⇒ « aucun retour » (liste vide) ; `members` lus ;
//      forme inconnue ⇒ « illisible » qui dit où les voir, jamais une liste vide ; 401/403 ⇒
//      « reconnecte » (raison `scope`) ;
//   A. annulations : même règle ;
//   E. évaluations à laisser : aucune ⇒ liste vide ; une ⇒ lue ; sur le principal désigné
//      « principal ».
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const PROPRIO = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://base.banc.test';
const MAINTENANT = Date.now(), JOUR = 86400000;
const CLE_P = 'aaaaaaaaaaaaaaaa', CLE_B = 'bbbbbbbbbbbbbbbb';
const commande = (id, titre) => ({ orderId: id, orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: new Date(MAINTENANT - JOUR).toISOString(), lineItems: [{ title: titre, quantity: 1, lineItemFulfillmentStatus: 'NOT_STARTED' }] });

let ROWS = {}, LECTURES = [], APPELS = [], PO = {};
const remettre = () => {
  ROWS = {
    ebay_comptes: { comptes: [
      { principal: true, cle: CLE_P, pseudo: 'vendeur_fr', type: 'particulier', typeLuLe: MAINTENANT, site: 'FR', ajouteLe: MAINTENANT - 300 * JOUR, vuLe: MAINTENANT, deconnecteLe: null },
      { principal: false, cle: CLE_B, pseudo: 'vendeur_deux', type: 'particulier', typeLuLe: MAINTENANT, site: 'FR', ajouteLe: MAINTENANT - 30 * JOUR, vuLe: MAINTENANT, deconnecteLe: null },
    ] },
    ebay_tokens: { refresh_token: 'RT', saved_at: MAINTENANT - 10 * JOUR, refresh_expires_days: 548 },
    ['ebay_tokens_' + CLE_B]: { refresh_token: 'RT2', saved_at: MAINTENANT - 10 * JOUR, refresh_expires_days: 548 },
    ebay_orders: { orders: [commande('11-00001-00001', 'Paire du principal')], capturedAt: MAINTENANT - 3600000, status: 200 },
    ['ebay_orders_' + CLE_B]: { orders: [commande('22-00002-00002', 'Paire du second compte')], capturedAt: MAINTENANT - 3600000, status: 200 },
  };
  LECTURES = []; APPELS = [];
  PO = { retours: { st: 200, corps: '' }, annulations: { st: 200, corps: '' }, evaluations: '' };
};
const json = (o, st = 200) => new Response(o === undefined ? '' : JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response('<?xml version="1.0" encoding="utf-8"?>' + s, { status: 200 });
global.fetch = async (url, opts = {}) => {
  const u = String(url), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return json({ id: PROPRIO, email: 'p@exemple.test' });
  if (u.includes('identity/v1/oauth2/token')) return json({ access_token: /client_credentials/.test(String(opts.body)) ? 'APP' : (/RT2/.test(String(opts.body)) ? 'AT2' : 'AT'), expires_in: 7200 });
  if (u.includes('/rest/v1/rpc/')) return json(true);
  if (u.includes('/rest/v1/app_data')) {
    const id = (/id=eq\.([^&]*)/.exec(u) || [])[1];
    if (opts.method && opts.method !== 'GET') {
      let corps = null; try { corps = JSON.parse(opts.body); } catch (_) {}
      const ligne = Array.isArray(corps) ? corps[0] : corps; const lid = id || (ligne && ligne.id);
      if (lid && ligne && ligne.data) ROWS[lid] = ligne.data;
      return opts.method === 'PATCH' ? json([{ id: lid }]) : json([], 201);
    }
    if (/select=owner&limit=1/.test(u)) return json([{ owner: PROPRIO }]);
    const sel = decodeURIComponent((/[?&]select=([^&]*)/.exec(u) || [])[1] || 'data');
    LECTURES.push({ id, sel });
    if (!id || !(id in ROWS)) return json([]);
    if (sel === 'data') return json([{ data: ROWS[id] }]);
    if (/^rev:/.test(sel)) return json([{ rev: ROWS[id].rev != null ? String(ROWS[id].rev) : null }]);
    const o = {};
    for (const p of sel.split(',')) {
      const m = /^(?:([^:]+):)?data(->>|->)(\w+)$/.exec(p); if (!m) continue;
      const v = ROWS[id][m[3]]; o[m[1] || m[3]] = v == null ? null : (m[2] === '->>' ? String(v) : v);
    }
    return json([o]);
  }
  if (u.includes('/ws/api.dll')) {
    const nom = h['X-EBAY-API-CALL-NAME'] || '';
    const at = String(h['X-EBAY-API-IAF-TOKEN'] || h.Authorization || '');
    APPELS.push({ hote: 'trading', nom, jeton: at });
    if (nom === 'GetItemsAwaitingFeedback') return xml(`<GetItemsAwaitingFeedbackResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${PO.evaluations}</GetItemsAwaitingFeedbackResponse>`);
    return xml(`<${nom}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></${nom}Response>`);
  }
  if (/^https:\/\/apiz?\.ebay\.com\//.test(u)) {
    const chemin = new URL(u).pathname;
    APPELS.push({ hote: 'rest', chemin, methode: opts.method || 'GET', jeton: String(h.Authorization || '') });
    const rep = (x) => x.st === 204 ? new Response(null, { status: 204 }) : new Response(typeof x.corps === 'string' ? x.corps : JSON.stringify(x.corps), { status: x.st, headers: { 'content-type': 'application/json' } });
    if (chemin === '/post-order/v2/return/search') return rep(PO.retours);
    if (chemin === '/post-order/v2/cancellation/search') return rep(PO.annulations);
    return json({}, 404);
  }
  return json({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
async function charger(racine) {
  const mod = await import(pathToFileURL(path.join(racine, 'api', 'ebay.js')).href + '?t=' + Math.random());
  return (body) => { const res = faireRes(); return mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc-proprio.sig' }, body }, res).then(() => res); };
}
const RETOUR = { returnId: '5000123', orderId: '11-00001-00001', buyerLoginName: 'acheteur_a', state: 'RETURN_REQUESTED', status: 'RETURN_REQUESTED', creationInfo: { item: { itemId: '3001', itemTitle: 'Paire A', returnQuantity: 1 }, reason: 'DOES_NOT_FIT', creationDate: { value: '2026-11-15T10:00:00.000Z' } }, sellerTotalRefund: { estimatedRefundAmount: { value: '80.00', currency: 'EUR' } } };

async function verifier(racine) {
  const out = []; let ko = 0;
  const dit = (c, m, d) => { out.push((c ? 'OK  ' : 'KO  ') + m + (c || !d ? '' : '  → ' + String(d).slice(0, 260))); if (!c) ko++; };
  let route; try { route = await charger(racine); } catch (e) { dit(false, 'la route se charge', e.message); return { ko, out }; }
  const essai = async (t, f) => { try { await f(); } catch (e) { dit(false, t + ' : exception', e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); } };
  const ecritEbay = () => APPELS.filter((a) => a.hote === 'rest' && a.methode !== 'GET').length;

  await essai('T', async () => {
    for (const [nom, corps] of [['compte « principal »', { compte: 'principal' }], ['sans compte', {}]]) {
      remettre();
      const r = await route({ action: 'taches', ...corps });
      const t = (r.corps && r.corps.tasks) || [];
      dit(r.code === 200 && r.corps.ok === true && t.some((x) => x.ref === '11-00001-00001' && x.section === 'ventes') && !t.some((x) => x.ref === '22-00002-00002'), `T1. ${nom} ⇒ les tâches du principal (sa commande à expédier, pas celle de l’autre compte)`, JSON.stringify(r.corps));
      dit(!/mal désigné/.test(JSON.stringify(r.corps)), `T2. ${nom} : jamais « Compte eBay mal désigné »`, JSON.stringify(r.corps));
    }
    remettre();
    const r = await route({ action: 'taches', compte: CLE_B });
    const t = (r.corps && r.corps.tasks) || [];
    dit(r.code === 200 && t.some((x) => x.ref === '22-00002-00002') && !t.some((x) => x.ref === '11-00001-00001'), 'T3. second compte (clé ⇒ suffixe) ⇒ SES tâches, jamais celles du principal', JSON.stringify(r.corps));
    const lo = LECTURES.filter((l) => /^ebay_orders/.test(l.id || ''));
    dit(lo.length > 0 && lo.every((l) => l.id === 'ebay_orders_' + CLE_B), 'T4. seule la ligne `ebay_orders_{clé}` du second compte est lue', JSON.stringify(lo));
    dit(lo.length > 0 && lo.every((l) => l.sel !== 'data' && /data->orders/.test(l.sel)), 'T5. `ebay_orders` lue PROJETÉE (jamais `select=data`, §4.4)', JSON.stringify(lo));
    dit(APPELS.filter((a) => a.hote === 'trading').every((a) => /AT2/.test(a.jeton)), 'T6. eBay interrogé avec le jeton de CE compte', JSON.stringify(APPELS.map((a) => a.jeton)));
    dit(ecritEbay() === 0, 'T7. lecture seule : rien n’est écrit chez eBay');
    remettre();
    const r2 = await route({ action: 'taches', compte: 'pas-une-cle' });
    dit(r2.code === 400 && r2.corps.ok === false && /reconnecte/i.test(r2.corps.error || '') && APPELS.length === 0, 'T8. une clé qui n’est pas un compte ⇒ refusée AVANT eBay, et le refus dit le geste (reconnecter)', JSON.stringify(r2.corps));
    remettre();
    const r3 = await route({ action: 'taches', compte: 'cccccccccccccccc' });
    dit(r3.code === 404 && r3.corps.reason === 'compte-inconnu' && APPELS.length === 0, 'T9. une clé d’un compte qui n’est pas à lui ⇒ rien n’est lu chez eBay', JSON.stringify(r3.corps));
  });

  await essai('R', async () => {
    const cas = [
      ['corps vide (200)', { st: 200, corps: '' }],
      ['204 sans corps', { st: 204 }],
      ['total à 0 sans `members`', { st: 200, corps: { paginationOutput: { limit: 50, offset: 0, totalEntries: 0, totalPages: 0 } } }],
      ['objet vide', { st: 200, corps: {} }],
    ];
    for (const [nom, rep] of cas) {
      remettre(); PO.retours = rep;
      const r = await route({ action: 'retours', compte: 'principal' });
      dit(r.code === 200 && r.corps.ok === true && Array.isArray(r.corps.retours) && r.corps.retours.length === 0, `R1. ${nom} ⇒ « aucun retour » (liste vide), pas « illisible »`, JSON.stringify(r.corps));
    }
    remettre(); PO.retours = { st: 200, corps: { members: [RETOUR], paginationOutput: { totalEntries: 1 } } };
    let r = await route({ action: 'retours' });
    dit(r.corps.ok === true && r.corps.retours.length === 1 && r.corps.retours[0].returnId === '5000123', 'R2. `members` documentés ⇒ le retour est lu', JSON.stringify(r.corps));
    remettre(); PO.retours = { st: 200, corps: { returns: [RETOUR], total: 1 } };
    r = await route({ action: 'retours' });
    dit(r.corps.ok === true && r.corps.retours.length === 1, 'R3. variante `returns` ⇒ lue aussi', JSON.stringify(r.corps));
    remettre(); PO.retours = { st: 200, corps: { autre: 1, total: 3 } };
    r = await route({ action: 'retours' });
    dit(r.corps.ok === false && r.corps.reason === 'illisible' && !Array.isArray(r.corps.retours) && /ebay\.fr/.test(r.corps.error || '') && JSON.stringify(r.corps.champs) === '["autre","total"]', 'R4. forme inconnue (total 3, aucune liste) ⇒ « illisible » qui dit où les voir, avec les NOMS des champs, jamais une liste vide', JSON.stringify(r.corps));
    remettre(); PO.retours = { st: 200, corps: { total: 0, errors: [{ errorId: 1 }] } };
    r = await route({ action: 'retours' });
    dit(r.corps.ok === false && !Array.isArray(r.corps.retours), 'R5. une erreur d’eBay dans un 200 n’est jamais « aucun retour »', JSON.stringify(r.corps));
    for (const st of [401, 403]) {
      remettre(); PO.retours = { st, corps: { errors: [{ errorId: 1100, message: 'Access denied' }] } };
      r = await route({ action: 'retours' });
      dit(r.corps.ok === false && r.corps.reason === 'scope' && /Reconnecte/.test(r.corps.error || '') && !Array.isArray(r.corps.retours), `R6. ${st} (droit manquant) ⇒ « reconnecte ton compte eBay », jamais « aucun retour »`, JSON.stringify(r.corps));
    }
    remettre(); PO.retours = { st: 200, corps: '' };
    r = await route({ action: 'retours' });
    const po = APPELS.find((a) => a.chemin === '/post-order/v2/return/search');
    dit(po && /^IAF /.test(po.jeton), 'R7. Post-Order appelé avec l’en-tête IAF (documentation)', JSON.stringify(po));
  });

  await essai('A', async () => {
    for (const [nom, rep] of [['corps vide', { st: 200, corps: '' }], ['204', { st: 204 }], ['total à 0', { st: 200, corps: { paginationOutput: { totalEntries: 0 } } }]]) {
      remettre(); PO.annulations = rep;
      const r = await route({ action: 'annulations', compte: 'principal' });
      dit(r.corps.ok === true && Array.isArray(r.corps.annulations) && r.corps.annulations.length === 0, `A1. annulations : ${nom} ⇒ aucune`, JSON.stringify(r.corps));
    }
    remettre(); PO.annulations = { st: 200, corps: { x: 1 } };
    const r = await route({ action: 'annulations' });
    dit(r.corps.ok === false && r.corps.reason === 'illisible' && !Array.isArray(r.corps.annulations), 'A2. annulations : forme inconnue ⇒ illisible', JSON.stringify(r.corps));
  });

  await essai('E', async () => {
    remettre();
    let r = await route({ action: 'evaluations', compte: 'principal' });
    dit(r.code === 200 && r.corps.ok === true && Array.isArray(r.corps.evaluations) && r.corps.evaluations.length === 0, 'E1. « Évaluations à laisser » sur le principal désigné « principal » : aucune ⇒ liste vide', JSON.stringify(r.corps));
    remettre(); PO.evaluations = '<ItemsAwaitingFeedback><TransactionArray><Transaction><Item><ItemID>3001</ItemID><Title>Paire A</Title></Item><TransactionID>9001</TransactionID><Buyer><UserID>acheteur_a</UserID></Buyer></Transaction></TransactionArray></ItemsAwaitingFeedback>';
    r = await route({ action: 'evaluations', compte: CLE_B });
    dit(r.corps.ok === true && r.corps.evaluations.length === 1 && r.corps.evaluations[0].buyer === 'acheteur_a' && APPELS.some((a) => a.nom === 'GetItemsAwaitingFeedback' && /AT2/.test(a.jeton)), 'E2. une évaluation à laisser, lue sur le compte désigné', JSON.stringify(r.corps));
  });
  return { ko, out };
}

const MUTATIONS = {
  'principal-refuse': ['api/_lib/ebay.js', "if (!v || v === 'principal') {", 'if (!v) {'],
  'taches-absente': ['api/ebay.js', 'taches:(ctx)=>tachesEbay(ctx),', ''],
  'orders-entiere': ['api/ebay.js', "'orders:data->orders,capturedAt:data->>capturedAt'),", "'data'),"],
  'corps-vide-illisible': ['api/_lib/ebay-apres-vente.js', 'if(r.status===204 || r.vide)return succes({retours:[]});', ''],
  'total-zero-ignore': ['api/_lib/ebay-apres-vente.js', "(data.members==null && data.returns==null && totalDitZero(data))?[]:null", 'null'],
  'erreur-vaut-zero': ['api/_lib/ebay-apres-vente.js', "if(!d || typeof d!=='object' || Array.isArray(d) || !pasErreur(d))return false;", "if(!d || typeof d!=='object' || Array.isArray(d))return false;"],
  'forme-inconnue-vide': ['api/_lib/ebay-apres-vente.js', "const l=retoursEbay(r.data);if(!l)return illisible(", "const l=retoursEbay(r.data)||[];if(!l)return illisible("],
  'sans-geste-compte': ['api/_lib/ebay.js', " Ouvre eBay → Compte et reconnecte ce compte.' } };", "' } };"],
  'annulations-vide-illisible': ['api/_lib/ebay-apres-vente.js', 'if(r.status===204 || r.vide)return succes({annulations:[]});', ''],
};
function copie(mut) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-a-traiter-'));
  for (const sous of ['api', 'src']) fs.cpSync(path.join(RACINE, sous), path.join(d, sous), { recursive: true });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  const [f, a, b] = MUTATIONS[mut];
  const p = path.join(d, f), t = fs.readFileSync(p, 'utf8');
  if (!t.includes(a)) throw new Error(`ancre absente dans ${f}`);
  fs.writeFileSync(p, t.replace(a, b));
  return d;
}
function arbreAvant() {
  if (process.env.AVANT) return process.env.AVANT;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-a-traiter-avant-'));
  execFileSync('tar', ['-x', '-C', d], { input: execFileSync('git', ['archive', '5a9abe571', 'api', 'src'], { cwd: RACINE, maxBuffer: 1 << 28 }) });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  return d;
}
(async () => {
  if (process.argv.includes('--avant')) { const d = arbreAvant(); const { ko, out } = await verifier(d); if (!process.env.AVANT) try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} out.forEach((l) => console.log(l)); console.log(`\nArbre de départ : ${ko} rouge(s) (attendu : plusieurs)`); process.exit(ko ? 0 : 1); }
  if (!process.argv.includes('--prouve')) {
    const { ko, out } = await verifier(RACINE);
    out.forEach((l) => console.log(l));
    console.log(`\n${out.length - ko} contrôle(s) OK, ${ko} en échec`);
    process.exit(ko ? 1 : 0);
  }
  let vertes = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let d; try { d = copie(m); } catch (e) { console.log(`KO  ${m} : ${e.message}`); vertes++; continue; }
    const { ko, out } = await verifier(d);
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}   // le disque est partagé
    console.log(`${ko ? 'OK ' : 'KO '} mutation « ${m} » : ${ko} rouge(s)${ko ? ' — ' + out.filter((l) => l.startsWith('KO')).map((l) => l.slice(4, 70)).slice(0, 2).join(' | ') : ''}`);
    if (!ko) vertes++;
  }
  console.log(`\n${Object.keys(MUTATIONS).length - vertes}/${Object.keys(MUTATIONS).length} mutations rougies`);
  process.exit(vertes ? 1 : 0);
})();
