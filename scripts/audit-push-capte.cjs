#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « SUR MON TÉLÉPHONE » : CE QUE L'EXTENSION VIENT DE CAPTER (21 nov., ext. 5.422, `pushcapte`)
// ════════════════════════════════════════════════════════════════════════════
// Ce banc EXÉCUTE la vraie route `api/push.js` (§4.10 : une fonction serverless n'est vérifiée que si
// un banc l'exécute) — session (`/auth/v1/user`), fausse base (forme app_data owner/id/data,
// projections `alias:data->a->b->0`, comparer-et-échanger sur `rev`), web-push intercepté.
// Aucune donnée réelle : tout est inventé (dépôt public).
//   S1  une vente Vinted PROUVÉE (dans SA liste de ventes) ⇒ UNE notification « Vente : … taille 40 »
//       · « 45 € · Imprimer le bordereau », qui mène à la vente
//   S2  jamais deux fois : le même appel rejoué ⇒ rien ; la vente déjà sonnée par l'e-mail « Vendu »
//       (même clé `sale-tx…`) ⇒ rien
//   S3  rien sans preuve : une vente absente de SA liste, annulée, un compte Vinted d'un autre vendeur
//   S4  offre en attente ⇒ « Offre de 45 € », le pseudo et rien d'autre de l'acheteur ; mène à SA conversation
//   S5  message : éteint par défaut ; allumé ⇒ « Message de @pseudo » ; le texte du message ne part jamais
//   S6  plusieurs dans le même appel ⇒ UNE notification (« 3 nouveautés · 1 vente · 2 offres »)
//   S7  réglage par type : famille coupée ⇒ rien ; type coupé ⇒ rien ; défauts vente/offre allumés
//   S8  lecture ratée ⇒ 503, rien réservé, rien envoyé ; sans session ⇒ 401
//   S9  heures calmes : rangée, ne sonne pas
//   S10 ce que le corps prétend (titre, prix, pseudo) n'est jamais cru : le texte vient de SES lignes
//   S11 Leboncoin, Vestiaire : ventes et offre relues dans leurs lignes
// `--prouve` : chaque mutation de la règle rend l'audit rouge. `--avant` : la route d'avant (sans
// l'action) est rouge (§6.1, joué sur `git archive`).
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const iR = args.indexOf('--racine');
const R = iR >= 0 ? path.resolve(args[iR + 1]) : path.join(__dirname, '..');

const MUTATIONS = {
  dedup: ['neufs = prouves.filter((x) => !ks.includes(cleCapte(x.e)));', 'neufs = prouves.slice();'],
  compte: ["if (!comptes.some((x) => str(x && x.vinted_user_id) === e.c)) return { rien: 'compte' };", ''],
  preuve: ["if (!o) return { rien: 'pas-dans-ses-ventes' };", "if (!o) return { d: { titre: '' } };"],
  defaut: ["{ id: 'messages', cat: 'message', def: false }", "{ id: 'messages', cat: 'message', def: true }"],
  type: ['const permis = evs.filter((e) => capteActif(prefs, TYPE_DE[e.s]) && decisionNotif(prefs, CAT_DE[e.s]));', 'const permis = evs.slice();'],
  lecture: ["if (r === null) return { status: 503, raison: 'pas-su' };\n    if (r.rien)", "if (r === null) continue;\n    if (r.rien)"],
  groupe: ['if (neufs.length === 1) {', 'if (true) {'],
  // (5.435) l'offre Leboncoin crue sans « de l'autre personne »
  lbcoffre: ["if (!o || o.deMoi !== false) return { rien: 'offre-pas-recue' };", "if (!o) return { rien: 'offre-pas-recue' };"],
  lbccompte: ["if (!r || str(r.conv) !== e.conv || cleLbc(r.compte) !== cleLbc(e.c)) return { rien: 'conversation' };", "if (!r) return { rien: 'conversation' };"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of ['(témoin, sans mutation)', ...Object.keys(MUTATIONS)]) {
    const dos = fs.mkdtempSync(path.join(os.tmpdir(), 'push-capte-mut-'));
    let rouge = false;
    try {
      execFileSync('cp', ['-r', path.join(R, 'api'), dos]);
      fs.symlinkSync(path.join(R, 'node_modules'), path.join(dos, 'node_modules'));
      fs.symlinkSync(path.join(R, 'src'), path.join(dos, 'src'));   // api/ importe des règles de src/
      fs.copyFileSync(path.join(R, 'package.json'), path.join(dos, 'package.json'));
      const [a, b] = MUTATIONS[m] || ['', ''];
      let fait = !MUTATIONS[m];
      for (const f of ['api/_lib/push-capte.js', 'api/_lib/notif-textes.js']) {
        const p = path.join(dos, f); const s = fs.readFileSync(p, 'utf8');
        if (a && s.includes(a)) { fs.writeFileSync(p, s.split(a).join(b)); fait = true; }
      }
      if (!fait) { console.log(`❌ mutation ${m} introuvable`); rates++; continue; }
      try { execFileSync(process.execPath, [__filename, '--racine', dos], { stdio: 'pipe', timeout: 120000 }); } catch (e) { rouge = e.status === 1; }
    } finally { try { fs.rmSync(dos, { recursive: true, force: true }); } catch (_) {} }
    if (!MUTATIONS[m]) { console.log(`${rouge ? '❌' : '✅'} ${m} ⇒ ${rouge ? 'ROUGE (la copie ne tourne pas)' : 'vert'}`); if (rouge) rates++; continue; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + String(d).slice(0, 500) : '')); } };
const J = '11111111-1111-4111-8111-111111111111', K = '22222222-2222-4222-8222-222222222222';
const JETON_J = 'aaa.bbb.julien', JETON_K = 'aaa.bbb.autre';
let base, comptesV, panne, requetes;
const kk = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
const seg = (x, s) => (x == null ? undefined : Array.isArray(x) && /^\d+$/.test(s) ? x[Number(s)] : x[decodeURIComponent(s)]);
function projeter(sel, id, d) {
  if (!sel || sel === 'data') return { id, data: d };
  const o = {};
  for (const p of sel.split(',')) {
    if (p === 'id') { o.id = id; continue; }
    const m = /^(?:(\w+):)?data((?:->>?(?:[\w%-]+|"[\w%-]+"))+)$/.exec(p);   // (22 nov.) + une clé entre guillemets (`->"123"` : une CLÉ, jamais un indice)
    if (!m) throw new Error('projection inconnue : ' + p);
    const segs = m[2].split(/->>?/).filter(Boolean).map((x) => x.replace(/^"(.*)"$/, '$1'));
    let v = d; for (const s of segs) v = seg(v, s);
    o[m[1] || segs[segs.length - 1]] = /->>(?:[\w%-]+|"[\w%-]+")$/.test(m[2]) && v != null ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : (v === undefined ? null : v);
  }
  return o;
}
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const q = u.searchParams;
  const methode = (o.method || 'GET').toUpperCase();
  requetes.push({ methode, chemin: u.pathname, recherche: decodeURIComponent(u.search) });
  if (u.pathname.endsWith('/auth/v1/user')) {
    const a = String((o.headers || {}).Authorization || '');
    if (a === 'Bearer ' + JETON_J) return rep({ id: J, email: 'j@banc.test' });
    if (a === 'Bearer ' + JETON_K) return rep({ id: K, email: 'k@banc.test' });
    return rep({ message: 'invalid' }, 401);
  }
  if (u.pathname.endsWith('/rpc/vrm_acces_pour')) return rep(true);
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  if (u.pathname.endsWith('/rest/v1/vinted_accounts')) {
    if (panne.has('vinted_accounts')) return rep('<html>522</html>', 522);
    const f = (q.get('vinted_user_id') || '').replace(/^eq\./, '');
    return rep((comptesV[owner] || []).filter((a) => !f || String(a.vinted_user_id) === f).map((a) => ({ vinted_user_id: a.vinted_user_id })));
  }
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const id = (q.get('id') || '').replace(/^eq\./, '');
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    if (!owner) return rep([]);
    if (panne.has(id)) return rep('<html>522</html>', 522);
    const d = base.get(kk(owner, id));
    return rep(d === undefined ? [] : [projeter(q.get('select'), id, d)]);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    const ignore = /ignore-duplicates/.test(((o.headers || {}).Prefer) || '');
    const out = [];
    for (const l of lignes) {
      if (!l.owner) return rep({ message: 'sans vendeur' }, 400);
      if (panne.has('ecrire:' + l.id)) return rep('<html>522</html>', 522);
      if (ignore && base.has(kk(l.owner, l.id))) continue;
      base.set(kk(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
    }
    return rep(out, 201);
  }
  if (methode === 'PATCH') {
    const c = kk(owner, id);
    if (!owner || !base.has(c)) return rep([]);
    if (panne.has('ecrire:' + id)) return rep('<html>522</html>', 522);
    const d = base.get(c);
    const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    base.set(c, JSON.parse(o.body).data);
    return rep([{ id }]);
  }
  return rep([]);
};
const pushes = [];
const TEL = 'https://web.push.apple.com/iphone-banc-capte', TEL_K = 'https://web.push.apple.com/iphone-autre';
const TX = '91000000011', TX2 = '91000000012', TX_ANN = '91000000013';
function prepare({ prefs = null } = {}) {
  base = new Map(); panne = new Set(); requetes = []; pushes.length = 0;
  comptesV = { [J]: [{ vinted_user_id: '111' }], [K]: [{ vinted_user_id: '222' }] };
  base.set(kk(J, 'push_subs'), { subs: [{ endpoint: TEL, keys: { p256dh: 'x', auth: 'y' } }] });
  base.set(kk(K, 'push_subs'), { subs: [{ endpoint: TEL_K, keys: { p256dh: 'x', auth: 'y' } }] });
  if (prefs) base.set(kk(J, 'push_prefs'), prefs);
  base.set(kk(J, 'harvest_111_orders_sold'), { type: 'orders_sold', payload: { my_orders: [
    { transaction_id: Number(TX), title: 'Adidas Samba', size_title: '40', price: { amount: '45.0', currency_code: 'EUR' }, status: 'Envoie le colis avant le 25 nov.' },
    { transaction_id: Number(TX2), title: 'Nike Air Max 90', price: { amount: '60.0' }, status: 'Envoie le colis avant le 25 nov.' },
    { transaction_id: Number(TX_ANN), title: 'Asics Gel', price: { amount: '30.0' }, status: 'Commande annulée' },
  ] } });
  base.set(kk(J, 'harvest_222_orders_sold'), { type: 'orders_sold', payload: { my_orders: [{ transaction_id: 91000000099, title: 'Vente d’un autre', price: { amount: '10' } }] } });
  const offre = (oid, prix, user) => ({ entity_type: 'offer_request_message', created_at_ts: '2026-11-21T10:00:00+01:00', entity: { offer_request_id: oid, transaction_id: 5001, user_id: user, status: 10, status_title: 'En attente', current: true, price: { amount: String(prix) } } });
  base.set(kk(J, 'harvest_111_conv_7001'), { type: 'conversation', payload: { conversation: { id: 7001, description: 'Bonjour, mon adresse est 3 rue du Banc', opposite_user: { id: 4242, login: 'julie_92', real_name: 'Julie Inventée' }, transaction: { item_title: 'Adidas Samba', item_id: 6001 }, messages: [offre(8001, 45, 4242)] } } });
  base.set(kk(K, 'harvest_222_conv_9001'), { type: 'conversation', payload: { conversation: { id: 9001, opposite_user: { id: 4646, login: 'acheteur_k' }, transaction: { item_title: 'Puma Suede' }, messages: [offre(9101, 20, 4646)] } } });
  base.set(kk(J, 'harvest_111_conv_7002'), { type: 'conversation', payload: { conversation: { id: 7002, opposite_user: { id: 4343, login: 'marc.b' }, transaction: { item_title: 'Nike Dunk' }, messages: [offre(8002, 38.5, 4343)] } } });
  base.set(kk(J, 'harvest_111_inbox'), { type: 'inbox', payload: { conversations: [
    { id: 7003, description: 'Mon numéro : 06 00 00 00 00', unread: true, updated_at: '2026-11-21T10:05:00+01:00', opposite_user: { id: 4444, login: 'leo_x' } },
    { id: 7004, unread: false, updated_at: '2026-11-21T09:00:00+01:00', opposite_user: { id: 4545, login: 'lu_deja' } },
  ] } });
  base.set(kk(J, 'lbc_ventes'), { ventes: { 'lbc-tx-1': { txId: 'lbc-tx-1', isSeller: true, account: 'lbc-account:77', title: 'Veste Carhartt', price: 5500, stepStatus: 'paid' } } });
  base.set(kk(J, 'vc_ventes'), { ventes: { 'p123456': { productId: 'p123456', compte: 'vc1', titre: 'Sac Longchamp', prixVente: { valeur: 84, devise: 'EUR' } } } });
  // (22 nov., ext. 5.435) un fil Leboncoin rangé avec ses OFFRES (identité : le n° du message).
  base.set(kk(J, 'lbc_fil_conv-lbc-1'), { v: 1, conv: 'conv-lbc-1', compte: '77', messages: [{ id: 'm1', t: 'Bonjour, 40 € ?', deMoi: false, at: '2026-11-21T09:00:00.000Z' }],
    offres: [{ id: 'm2', at: '2026-11-21T09:01:00.000Z', deMoi: false, c: 4000, s: '' }, { id: 'm3', at: '2026-11-21T09:02:00.000Z', deMoi: true, c: 4500, s: '' }, { id: 'm4', at: '2026-11-21T09:03:00.000Z', deMoi: false, c: null, s: '' }] });
  base.set(kk(J, 'vc_offres'), { offres: { 'n555': { id: '555', compte: 'vc1', aToi: true, ouverte: true, titre: 'Sac Longchamp', dernier: { action: 'offer', par: 'acheteur', cents: 7000, at: '2026-11-21T09:30:00.000Z' } } } });
}
const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
const vente = (id = TX, c = '111') => ({ s: 'vente', p: 'vinted', c, id });

(async () => {
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  webpush.sendNotification = async (sub, body) => { const b = JSON.parse(body); for (const k of ['title', 'body']) if (typeof b[k] === 'string') b[k] = b[k].replace(/[\u00a0\u202f]/g, ' '); pushes.push({ tel: sub.endpoint, ...b }); return { statusCode: 201 }; };
  const route = (await import('file://' + path.join(R, 'api', 'push.js') + '?capte')).default;
  const P = await import('file://' + path.join(R, 'api', '_lib', 'push.js'));
  const appeler = async (corps, jeton = JETON_J) => { P.oublierPrefsVues(); const res = faireRes(); await route({ method: 'POST', headers: { authorization: 'Bearer ' + jeton, origin: 'https://vrm.center' }, body: corps }, res); return res; };
  const cles = () => ((base.get(kk(J, 'push_dedup')) || {}).keys || []);

  console.log('\nS1. Une vente Vinted prouvée ⇒ une notification qui dit quoi faire');
  prepare();
  let r = await appeler({ action: 'capte', evenements: [vente()] });
  dit(r.code === 200 && pushes.length === 1, 'S1a 200 et UNE notification', JSON.stringify([r.code, r.corps, pushes.length]));
  const p1 = pushes[0] || {};
  dit(p1.title === 'Vente : Adidas Samba taille 40' && /^45 € · Imprimer le bordereau$/.test(p1.body || ''), 'S1b « Vente : Adidas Samba taille 40 » · « 45 € · Imprimer le bordereau »', JSON.stringify([p1.title, p1.body]));
  dit(/tab=ventes/.test(p1.url || '') && new RegExp('tx=' + TX).test(p1.url || '') && /cible=vente/.test(p1.url || ''), 'S1c le toucher ouvre Ventes sur CETTE vente', p1.url);
  dit(cles().includes('sale-tx' + TX), 'S1d la clé de la vente est réservée (`sale-tx…`, la même que l’e-mail « Vendu »)', JSON.stringify(cles()));
  dit(pushes.every((x) => x.tel === TEL), 'S1e envoyée à SES appareils seulement');

  console.log('\nS2. Jamais deux fois');
  r = await appeler({ action: 'capte', evenements: [vente()] });
  dit(r.code === 200 && pushes.length === 1 && r.corps.deja === 1, 'S2a le même appel rejoué ⇒ rien', JSON.stringify([r.corps, pushes.length]));
  prepare(); base.set(kk(J, 'push_dedup'), { keys: ['sale-tx' + TX] });
  r = await appeler({ action: 'capte', evenements: [vente()] });
  dit(r.code === 200 && pushes.length === 0, 'S2b déjà sonnée par l’e-mail « Vendu » (même clé) ⇒ rien', JSON.stringify([r.corps, pushes.length]));

  console.log('\nS3. Rien sans preuve');
  prepare();
  r = await appeler({ action: 'capte', evenements: [vente('91000000777')] });
  dit(r.code === 200 && pushes.length === 0 && !cles().length, 'S3a une vente absente de SA liste ⇒ rien, rien réservé', JSON.stringify([r.corps, pushes.length]));
  r = await appeler({ action: 'capte', evenements: [vente(TX_ANN)] });
  dit(r.code === 200 && pushes.length === 0, 'S3b une vente annulée ⇒ rien');
  r = await appeler({ action: 'capte', evenements: [vente('91000000099', '222')] });
  dit(r.code === 200 && pushes.length === 0 && !requetes.some((q) => /harvest_222/.test(q.recherche)), 'S3c le compte Vinted d’un AUTRE vendeur ⇒ rien (sa ligne n’est même pas lue)', JSON.stringify([r.corps, pushes.length]));
  r = await appeler({ action: 'capte', evenements: [{ s: 'vente', p: 'vinted', c: '111', id: 'Adidas Samba' }, { s: 'pirate', p: 'vinted', c: '111', id: '1' }] });
  dit(r.code === 400 && pushes.length === 0, 'S3d une forme refusée (identité qui n’en est pas une) ⇒ 400, rien', JSON.stringify(r.corps));

  console.log('\nS4. Une offre : le montant, le pseudo, rien d’autre de l’acheteur');
  prepare();
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'vinted', c: '111', id: '7001@8001' }] });
  const p4 = pushes[0] || {};
  dit(pushes.length === 1 && p4.title === 'Offre de 45 €' && /@julie_92/.test(p4.body || '') && /Répondre$/.test(p4.body || ''), 'S4a « Offre de 45 € » · « @julie_92 · Adidas Samba · Répondre »', JSON.stringify([p4.title, p4.body]));
  dit(!/Julie Invent|rue du Banc|4242/.test(JSON.stringify(p4)), 'S4b ni nom réel, ni texte, ni identifiant de l’acheteur', JSON.stringify(p4));
  dit(/tab=messages/.test(p4.url || '') && /cible=offre/.test(p4.url || '') && /conv=7001/.test(p4.url || ''), 'S4c le toucher ouvre SA conversation, l’offre en évidence', p4.url);
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'vinted', c: '111', id: '7001@8999' }] });
  dit(pushes.length === 1, 'S4d une offre qui n’attend pas dans SA conversation ⇒ rien');

  console.log('\nS5. Un message : éteint par défaut');
  prepare();
  const msg = { s: 'message', p: 'vinted', c: '111', id: '7003@2026-11-21T10:05:00+01:00' };
  r = await appeler({ action: 'capte', evenements: [msg] });
  dit(r.code === 200 && pushes.length === 0 && r.corps.coupe === 1, 'S5a messages éteints par défaut ⇒ rien', JSON.stringify(r.corps));
  prepare({ prefs: { capte: { messages: true } } });
  r = await appeler({ action: 'capte', evenements: [msg] });
  const p5 = pushes[0] || {};
  dit(pushes.length === 1 && p5.title === 'Message de @leo_x' && /Répondre/.test(p5.body || ''), 'S5b allumé ⇒ « Message de @leo_x » · « Répondre »', JSON.stringify([p5.title, p5.body]));
  dit(!/06 00|numéro/.test(JSON.stringify(p5)), 'S5c le texte du message ne part jamais');
  r = await appeler({ action: 'capte', evenements: [{ s: 'message', p: 'vinted', c: '111', id: '7004@2026-11-21T09:00:00+01:00' }] });
  dit(pushes.length === 1, 'S5d une conversation déjà lue ⇒ rien');

  console.log('\nS6. Plusieurs dans le même appel ⇒ une notification');
  prepare();
  r = await appeler({ action: 'capte', evenements: [vente(), { s: 'offre', p: 'vinted', c: '111', id: '7001@8001' }, { s: 'offre', p: 'vinted', c: '111', id: '7002@8002' }] });
  const p6 = pushes[0] || {};
  dit(pushes.length === 1 && p6.title === '3 nouveautés' && p6.body === '1 vente · 2 offres', 'S6a UNE notification « 3 nouveautés » · « 1 vente · 2 offres »', JSON.stringify(pushes.map((x) => [x.title, x.body])));
  dit(['sale-tx' + TX, 'offer-capte-vinted-8001', 'offer-capte-vinted-8002'].every((k) => cles().includes(k)), 'S6b chaque objet réservé : aucun ne re-sonnera seul', JSON.stringify(cles()));

  console.log('\nS7. Réglage par type');
  prepare({ prefs: { familles: { ventes: false } } });
  r = await appeler({ action: 'capte', evenements: [vente()] });
  dit(pushes.length === 0 && !cles().length, 'S7a famille « Ventes » coupée ⇒ rien, rien réservé');
  prepare({ prefs: { capte: { ventes: false } } });
  r = await appeler({ action: 'capte', evenements: [vente(), { s: 'offre', p: 'vinted', c: '111', id: '7001@8001' }] });
  dit(pushes.length === 1 && /^Offre/.test(pushes[0].title), 'S7b « ventes captées » coupé ⇒ la vente se tait, l’offre sonne', JSON.stringify(pushes.map((x) => x.title)));
  const T = await import('file://' + path.join(R, 'api', '_lib', 'notif-textes.js'));
  dit(T.capteActif({}, 'ventes') === true && T.capteActif({}, 'offres') === true && T.capteActif({}, 'messages') === false, 'S7c défauts : vente et offre allumées, message éteint');

  console.log('\nS8. Lecture ratée, session');
  prepare(); panne.add('harvest_111_orders_sold');
  r = await appeler({ action: 'capte', evenements: [vente()] });
  dit(r.code === 503 && pushes.length === 0 && !cles().length, 'S8a lecture de SES ventes ratée ⇒ 503, rien réservé, rien envoyé (l’extension rappellera)', JSON.stringify([r.code, r.corps]));
  prepare(); panne.add('vinted_accounts');
  r = await appeler({ action: 'capte', evenements: [vente()] });
  dit(r.code === 503 && pushes.length === 0, 'S8b ses comptes illisibles ⇒ 503, rien');
  prepare(); panne.add('push_dedup');
  r = await appeler({ action: 'capte', evenements: [vente()] });
  dit(r.code === 503 && pushes.length === 0, 'S8c mémo des notifications illisible ⇒ 503, rien (jamais deux fois)');
  prepare();
  r = await appeler({ action: 'capte', evenements: [vente()] }, 'x.y.inconnu');
  dit(r.code === 401 && pushes.length === 0, 'S8d sans session ⇒ 401, rien');
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'vinted', c: '222', id: '9001@9101' }] }, JETON_K);
  if (process.env.DEBUG_CAPTE) console.log(JSON.stringify(r.corps), requetes.map((q) => q.methode + ' ' + q.recherche).join('\n'));
  dit(r.code === 200 && pushes.length === 1 && pushes[0].tel === TEL_K, 'S8e un autre vendeur : SES lignes, SES appareils', JSON.stringify(pushes.map((x) => x.tel)));

  console.log('\nS9. Heures calmes');
  {
    const avant = process.env.VRM_NOTIF_HORLOGE;
    const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    process.env.VRM_NOTIF_HORLOGE = `${jour}T22:30:00Z`;
    prepare({ prefs: { calme: { actif: true, debut: '22:00', fin: '08:00' } } });
    r = await appeler({ action: 'capte', evenements: [vente()] });
    dit(r.code === 200 && pushes.length === 0 && r.corps.calme === true, 'S9 pendant SES heures calmes : rien ne sonne (rangée dans le centre)', JSON.stringify(r.corps));
    process.env.VRM_NOTIF_HORLOGE = avant;
  }

  console.log('\nS10. Ce que le corps prétend n’est jamais cru');
  prepare();
  r = await appeler({ action: 'capte', evenements: [{ ...vente(), titre: 'Titre inventé', prix: 999, pseudo: 'pirate' }] });
  dit(pushes.length === 1 && !/inventé|999|pirate/.test(JSON.stringify(pushes[0])), 'S10 titre, prix, pseudo du corps ignorés : le texte vient de SES lignes', JSON.stringify(pushes[0]));

  console.log('\nS11. Leboncoin, Vestiaire');
  prepare();
  r = await appeler({ action: 'capte', evenements: [{ s: 'vente', p: 'leboncoin', c: '77', id: 'lbc-tx-1' }] });
  dit(pushes.length === 1 && pushes[0].title === 'Vente : Veste Carhartt' && /55 € · sur Leboncoin · Prépare l’envoi/.test(pushes[0].body) && cles().includes('vendu-leboncoin-lbc-tx-1'), 'S11a Leboncoin : « Vente : Veste Carhartt » · « 55 € · sur Leboncoin · Prépare l’envoi », clé du passage des ventes', JSON.stringify(pushes.map((x) => [x.title, x.body])));
  r = await appeler({ action: 'capte', evenements: [{ s: 'vente', p: 'vestiaire', c: 'vc1', id: 'p123456' }] });
  dit(pushes.length === 2 && pushes[1].title === 'Vente : Sac Longchamp' && /84 € · sur Vestiaire/.test(pushes[1].body) && cles().includes('vc-vente-p123456'), 'S11b Vestiaire : la vente, clé `vc-vente-…` (celle de l’e-mail)', JSON.stringify(pushes.map((x) => [x.title, x.body])));
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'vestiaire', c: 'vc1', id: '555@2026-11-21T09:30:00.000Z' }] });
  dit(pushes.length === 3 && pushes[2].title === 'Offre de 70 €', 'S11c Vestiaire : « Offre de 70 € »', JSON.stringify(pushes.map((x) => x.title)));
  r = await appeler({ action: 'capte', evenements: [{ s: 'vente', p: 'leboncoin', c: '99', id: 'lbc-tx-1' }] });
  dit(pushes.length === 3, 'S11d Leboncoin : la vente d’un AUTRE compte Leboncoin ⇒ rien');

  console.log('\nS12. Leboncoin : une offre reçue dans un fil (ext. 5.435)');
  prepare();
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'leboncoin', c: '77', id: 'conv-lbc-1:m2' }] });
  dit(pushes.length === 1 && pushes[0].title === 'Offre de 40 €' && /sur Leboncoin · Répondre/.test(pushes[0].body) && cles().includes('offer-capte-leboncoin-conv-lbc-1_m2'), 'S12a offre Leboncoin PROUVÉE dans son fil ⇒ « Offre de 40 € » · « sur Leboncoin · Répondre »', JSON.stringify(pushes.map((x) => [x.title, x.body])) + ' ' + JSON.stringify(cles()));
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'leboncoin', c: '77', id: 'conv-lbc-1:m2' }] });
  dit(pushes.length === 1, 'S12b jamais deux fois : la même offre rejouée ⇒ rien');
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'leboncoin', c: '77', id: 'conv-lbc-1:m3' }, { s: 'offre', p: 'leboncoin', c: '99', id: 'conv-lbc-1:m4' }, { s: 'offre', p: 'leboncoin', c: '77', id: 'conv-lbc-1:m9' }] });
  dit(pushes.length === 1, 'S12c ma propre offre, un autre compte, une offre absente du fil ⇒ rien');
  const premiere = pushes[0];
  prepare();
  r = await appeler({ action: 'capte', evenements: [{ s: 'offre', p: 'leboncoin', c: '77', id: 'conv-lbc-1:m4' }] });
  dit(pushes.length === 1 && pushes[0].title === 'Offre' && !/€/.test(pushes[0].title), 'S12d montant pas lu ⇒ « Offre » sans montant (jamais un montant supposé)', JSON.stringify(pushes.map((x) => x.title)));
  dit(/conv=conv-lbc-1/.test(JSON.stringify(premiere)), 'S12e le toucher ouvre SA conversation Leboncoin', JSON.stringify(premiere));

  console.log(`\n${ko ? '❌' : '✅'} audit-push-capte : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
