// Audit « abonnement propre » (8 nov.) — Julien : « des vendeurs vont payer,
// fais tout ». Exécute le VRAI api/compte.js (faux Stripe, fausse base) et le
// VRAI src/abonnement/etatAbonnement.js, et lit la migration 027 :
//   1. l'essai : la fin de l'essai est rendue (trialing), les jours restants et
//      la ligne de la coque à J-3 et J-1, jamais à J-5 ;
//   2. l'expiration : la base laisse LIRE (027 : USING true, WITH CHECK et
//      DELETE gardés), le serveur dit `lectureSeule`, l'app n'affiche pas la
//      porte quand la base laisse lire, et la garde refuse les ÉCRITURES (pas
//      les lectures, ni rpc/, ni /api/) ;
//   3. le portail Stripe s'ouvre sur le client de SA ligne, jamais sur un
//      identifiant envoyé par le navigateur ; Stripe absent ⇒ 503 calme, rien
//      n'est appelé ;
//   4. le parrainage : pas soi-même, une fois par filleul, compte neuf, éteint
//      par défaut, un mois offert à chacun au PREMIER paiement réel, jamais
//      doublé par un webhook rejoué, plafond de 12 par an, rien sur les filleuls.
// Aucune donnée réelle : tout est inventé ici.
require('./_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const RACINE = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const N = '33333333-3333-4333-8333-333333333333';     // un compte neuf (filleul)
const SECRET = 'whsec_banc_propre';
const RECENT = new Date(Date.now() - 2 * 864e5).toISOString();
const ANCIEN = new Date(Date.now() - 90 * 864e5).toISOString();
const JETONS = {
  'aa.bb.A': { id: A, email: 'a@exemple.test', created_at: ANCIEN },
  'aa.bb.B': { id: B, email: 'b@exemple.test', created_at: ANCIEN },
  'aa.bb.N': { id: N, email: 'n@exemple.test', created_at: RECENT },
};

// ── Le monde inventé ────────────────────────────────────────────────────────
let abos, acces, lecture, stripe, codes, parr, reglages, essais, vinted, balance, sansStripeTable;
const reset = () => {
  abos = {}; acces = {}; lecture = undefined; stripe = []; codes = {}; parr = {}; reglages = { parrainage: '1' };
  essais = []; vinted = {}; balance = {}; sansStripeTable = false;
};
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const q = (u, k) => { const m = new RegExp('[?&]' + k + '=([^&]+)').exec(u); return m ? decodeURIComponent(m[1]) : null; };
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
  const jwt = String(h.Authorization || '').replace('Bearer ', '');
  const service = !jwt.startsWith('aa.bb.');
  if (u.includes('/auth/v1/user')) return JETONS[jwt] ? rep(JETONS[jwt]) : rep({ msg: 'invalid' }, 401);
  if (u.includes('/rest/v1/rpc/vrm_acces')) {
    const qui = JETONS[jwt]; if (!qui) return rep({}, 401);
    const o = { obligatoire: true, proprietaire: false, acces: acces[qui.id] !== false };
    if (lecture !== undefined) o.lecture = lecture;
    return rep(o);
  }
  if (u.includes('/rest/v1/abonnements')) {
    if (m === 'POST') { for (const l of JSON.parse(opts.body)) abos[l.owner] = { ...(abos[l.owner] || {}), ...l }; return rep('', 201); }
    if (!service) { const qui = JETONS[jwt]; return rep(qui && abos[qui.id] ? [abos[qui.id]] : []); }
    const o = q(u, 'owner'), c = q(u, 'client_stripe');
    if (o) { const id = o.replace(/^eq\./, ''); return rep(abos[id] ? [{ ...abos[id], owner: id }] : []); }
    if (c) { const cl = c.replace(/^eq\./, ''); const e = Object.entries(abos).find(([, l]) => l.client_stripe === cl); return rep(e ? [{ owner: e[0] }] : []); }
    return rep([]);
  }
  if (u.includes('/rest/v1/vrm_reglages')) return rep(reglages.parrainage != null ? [{ valeur: reglages.parrainage }] : []);
  if (u.includes('/rest/v1/parrainage_codes')) {
    if (sansStripeTable) return rep({ message: 'relation does not exist' }, 404);
    if (m === 'POST') { for (const l of JSON.parse(opts.body)) if (!codes[l.owner]) codes[l.owner] = l.code; return rep('', 201); }
    const o = q(u, 'owner'), c = q(u, 'code');
    if (o) { const id = o.replace(/^eq\./, ''); return rep(codes[id] ? [{ code: codes[id] }] : []); }
    if (c) { const cc = c.replace(/^eq\./, ''); const e = Object.entries(codes).find(([, v]) => v === cc); return rep(e ? [{ owner: e[0] }] : []); }
    return rep([]);
  }
  if (u.includes('/rest/v1/parrainages')) {
    if (sansStripeTable) return rep({ message: 'relation does not exist' }, 404);
    if (m === 'POST') {
      const rendus = [];
      for (const l of JSON.parse(opts.body)) { if (parr[l.filleul]) continue; parr[l.filleul] = { ...l }; rendus.push(l); }
      return rep(rendus, 201);
    }
    if (m === 'PATCH') { const f = q(u, 'filleul').replace(/^eq\./, ''); parr[f] = { ...parr[f], ...JSON.parse(opts.body) }; return new Response(null, { status: 204 }); }
    const f = q(u, 'filleul'), p = q(u, 'parrain');
    let l = Object.values(parr);
    if (f) l = l.filter((x) => x.filleul === f.replace(/^eq\./, ''));
    if (p) l = l.filter((x) => x.parrain === p.replace(/^eq\./, ''));
    if (/paye_le=not\.is\.null/.test(u)) l = l.filter((x) => x.paye_le);
    if (/credit_parrain_le=is\.null/.test(u)) l = l.filter((x) => !x.credit_parrain_le);
    return rep(l.map((x) => ({ paye_le: null, credit_filleul_le: null, credit_parrain_le: null, ...x })));
  }
  if (u.includes('/rest/v1/vinted_accounts')) { const o = (q(u, 'owner') || '').replace(/^eq\./, ''); return rep((vinted[o] || []).map((v) => ({ vinted_user_id: v }))); }
  if (u.includes('/rest/v1/essais_gratuits')) { if (m === 'POST') return rep('', 201); return rep(essais.some((c) => u.includes(encodeURIComponent(c))) ? [{ cle: 'x' }] : []); }
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
    const corps = new URLSearchParams(opts.body || u.split('?')[1] || '');
    stripe.push({ m, chemin, corps, cle: h['Idempotency-Key'] || '' });

    if (chemin === 'billing_portal/sessions') return rep({ url: 'https://billing.stripe.com/p/session/banc' });
    if (chemin === 'prices') return rep({ data: [{ id: 'price_banc', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } }] });
    const bt = /^customers\/([^/]+)\/balance_transactions$/.exec(chemin);
    if (bt) {
      const c = bt[1]; balance[c] = balance[c] || [];
      if (m === 'GET') return rep({ object: 'list', data: balance[c] });
      const t = { id: 'cbtxn_' + balance[c].length, amount: Number(corps.get('amount')), metadata: { vrm_parrainage: corps.get('metadata[vrm_parrainage]') } };
      balance[c].push(t); return rep(t);
    }
    if (chemin.startsWith('subscriptions/')) return rep({ id: chemin.split('/')[1], status: 'active', customer: 'cus_A', items: { data: [{ quantity: 1, price: { unit_amount: 1699, currency: 'eur', recurring: { interval: 'month' } } }] } });
    return rep({ error: { message: 'inconnu' } }, 404);
  }
  return rep({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const req = ({ method = 'GET', mode, headers = {}, corps = null, query = {} }) => {
  const buf = corps == null ? null : Buffer.from(typeof corps === 'string' ? corps : JSON.stringify(corps), 'utf8');
  return { method, query: { mode, ...query }, headers, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${c}`).digest('hex')}`; };
const evt = (type, objet, created) => JSON.stringify({ id: 'evt_' + created, type, created, livemode: false, data: { object: objet } });

(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  try { await import('file://' + path.join(RACINE, 'public', 'legal', 'editeur.js')); } catch (_) {}
  if (globalThis.VRM_EDITEUR) for (const k of Object.keys(globalThis.VRM_EDITEUR)) globalThis.VRM_EDITEUR[k] = 'valeur d’essai ' + k;
  let E = {};
  try { E = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'etatAbonnement.js')); } catch (e) { dit(false, 'src/abonnement/etatAbonnement.js se charge', e.message); }
  const appel = async (o) => { const r = faireRes(); await compte(req(o), r); return r; };

  console.log('── 1. L’essai : sa fin est rendue, les jours se comptent, la coque parle à J-3 et J-1');
  await essaie('fin d’essai', async () => {
    reset(); const fin = new Date(Date.now() + 5 * 864e5).toISOString();
    abos[A] = { statut: 'trialing', client_stripe: 'cus_A', abonnement_stripe: 'sub_A', fin_periode: fin, annule_fin_periode: false };
    const r = await appel({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } });
    dit(r.code === 200 && r.corps.finEssai === fin, 'essai en cours : le serveur rend la fin de l’essai (`finEssai` = fin de la période)', `HTTP ${r.code} · ${r.corps && r.corps.finEssai}`);
    abos[A].statut = 'active';
    const r2 = await appel({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } });
    dit(r2.corps && r2.corps.finEssai === null, '  abonné payant : aucune fin d’essai inventée', String(r2.corps && r2.corps.finEssai));
  });
  const T0 = Date.parse('2026-11-08T10:00:00Z');
  const srv = (jours, extra = {}) => ({ ok: true, configure: true, proprietaire: false, statut: 'trialing', acces: true, finPeriode: new Date(T0 + jours * 864e5 - 3600e3).toISOString(), prixAbonnement: { texte: '16,99 € / mois' }, ...extra });
  await essaie('états', async () => {
    const e5 = E.etatAbonnement(srv(5), T0), e3 = E.etatAbonnement(srv(3), T0), e1 = E.etatAbonnement(srv(1), T0);
    dit(e5.etat === 'essai' && e5.jours === 5 && E.rappelEssai(e5) === null, 'J-5 : « essai », 5 jours, aucune ligne dans la coque', JSON.stringify({ etat: e5.etat, j: e5.jours, r: E.rappelEssai(e5) }));
    const r3 = E.rappelEssai(e3), r1 = E.rappelEssai(e1);
    dit(r3 && r3.seuil === 'j3' && /dans 3 jours/.test(r3.texte) && /16,99 € \/ mois/.test(r3.texte) && /résilies avant/.test(r3.texte), 'J-3 : la ligne dit quand, combien, et qu’on peut résilier avant', r3 && r3.texte);
    dit(r1 && r1.seuil === 'j1' && /demain/.test(r1.texte), 'J-1 : « demain »', r1 && r1.texte);
    const er = E.etatAbonnement(srv(1, { annuleFinPeriode: true }), T0), rr = E.rappelEssai(er);
    dit(er.etat === 'essai-resilie' && rr && /Rien ne sera prélevé/.test(rr.texte), 'essai résilié, J-1 : « rien ne sera prélevé »', rr && rr.texte);
    const sansPrix = E.rappelEssai(E.etatAbonnement(srv(2, { prixAbonnement: null }), T0));
    dit(sansPrix && !/€/.test(sansPrix.texte), '  prix de SON abonnement pas su : aucun montant deviné', sansPrix && sansPrix.texte);
    const actif = E.etatAbonnement({ ok: true, configure: true, statut: 'active', acces: true }, T0);
    const resilie = E.etatAbonnement({ ok: true, configure: true, statut: 'active', annuleFinPeriode: true, acces: true }, T0);
    const impaye = E.etatAbonnement({ ok: true, configure: true, statut: 'past_due', acces: true }, T0);
    const impayeLong = E.etatAbonnement({ ok: true, configure: true, statut: 'past_due', acces: false, lecture: true }, T0);
    const expire = E.etatAbonnement({ ok: true, configure: true, statut: 'canceled', acces: false, lecture: true, peutGerer: true }, T0);
    const expireSans027 = E.etatAbonnement({ ok: true, configure: true, statut: 'canceled', acces: false }, T0);
    const absent = E.etatAbonnement({ ok: true, configure: false, statut: null, acces: true }, T0);
    dit(actif.etat === 'actif' && resilie.etat === 'resilie' && impaye.etat === 'impaye' && absent.etat === 'non-branche', 'actif · résilié · impayé · Stripe absent : chacun son état', [actif.etat, resilie.etat, impaye.etat, absent.etat].join(' · '));
    dit(expire.etat === 'expire' && expire.lectureSeule === true && impayeLong.etat === 'expire' && impayeLong.impaye === true && impayeLong.lectureSeule, 'expiré (essai fini, abonnement arrêté, impayé > 14 j) : lecture seule quand la base laisse lire', JSON.stringify({ expire, impayeLong }));
    dit(expireSans027.lectureSeule === false, '  sans la 027 (la base ferme aussi la lecture) : PAS de lecture seule promise', JSON.stringify(expireSans027));
    dit(E.rappelEssai(actif) === null && E.rappelEssai(expire) === null, '  hors essai : aucune ligne de rappel');
    dit(E.etatAbonnement(undefined).etat === 'chargement' && E.etatAbonnement(null).etat === 'pas-su', '  trois états : en cours · pas su');
  });

  console.log('── 2. L’expiration : lisible, pas inscriptible');
  await essaie('serveur lecture seule', async () => {
    reset(); acces[A] = false; lecture = true; abos[A] = { statut: 'canceled', client_stripe: 'cus_A', abonnement_stripe: 'sub_A' };
    const r = await appel({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } });
    dit(r.corps && r.corps.acces === false && r.corps.lecture === true && r.corps.lectureSeule === true, 'accès coupé + la base laisse lire (027) ⇒ `lectureSeule: true`', JSON.stringify(r.corps && { acces: r.corps.acces, lecture: r.corps.lecture, ls: r.corps.lectureSeule }));
    lecture = undefined;
    const r2 = await appel({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } });
    dit(r2.corps && r2.corps.lectureSeule === false, '  base sans la 027 : `lectureSeule: false` (la porte reste, jamais une app vide)', JSON.stringify(r2.corps && r2.corps.lectureSeule));
  });
  await essaie('garde', async () => {
    const base = 'https://projet.supabase.co'; const vus = [];
    let actif = true;
    const f = E.creerGardeEcriture(async (u, o) => { vus.push((o && o.method || 'GET') + ' ' + u); return new Response('[]'); }, base, () => actif);
    const ecr = await f(base + '/rest/v1/app_data?on_conflict=owner,id', { method: 'POST', body: '[]' });
    const j = await ecr.json();
    dit(ecr.status === 403 && j.code === E.CODE_LECTURE_SEULE && /abonne-toi/.test(j.message) && vus.length === 0, 'lecture seule : une écriture vers la base est refusée SANS partir, avec une phrase', `${ecr.status} · ${JSON.stringify(j)} · parti=${vus.length}`);
    await f(base + '/rest/v1/app_data?id=eq.x', { method: 'DELETE' });
    await f(base + '/storage/v1/object/photos/x.jpg', { method: 'PUT' });
    dit(vus.length === 0, '  … DELETE et dépôt de fichier aussi');
    await f(base + '/rest/v1/app_data?select=id'); await f(base + '/rest/v1/rpc/vrm_acces', { method: 'POST' }); await f('/api/compte?mode=checkout', { method: 'POST' });
    dit(vus.length === 3, '  les LECTURES, les fonctions rpc/ et /api/ (le paiement) passent', vus.join(' | '));
    actif = false; await f(base + '/rest/v1/app_data', { method: 'POST' });
    dit(vus.length === 4, '  abonnement actif : rien n’est retenu');
  });
  await essaie('migration 027', async () => {
    const sql = lire('supabase/migrations/027-abonnement-lecture-et-parrainage.sql').replace(/--[^\n]*/g, '');
    dit(/alter policy abonnement_requis on public\.%I using \(true\)/.test(sql), '027 : la restrictive laisse LIRE (USING true)');
    dit(!/with check\s*\(\s*true\s*\)/i.test(sql) && !/alter policy abonnement_requis[^;]*with check/i.test(sql), '  … sans toucher au WITH CHECK (écrire exige toujours l’accès)');
    dit(/as restrictive for delete to authenticated[\s\S]*vrm_acces_ok\(\)/.test(sql), '  … et une restrictive DELETE (USING seul ne garderait plus l’effacement)');
    dit(/'lecture', true/.test(sql) && !/drop /i.test(sql), '  `vrm_acces()` dit `lecture: true` ; aucun DROP');
  });
  await essaie('porte', async () => {
    const app = lire('src/App.jsx');
    const p = (/function PorteAbonnement[\s\S]*?\n}\n/.exec(app) || [''])[0];
    dit(/x\.acces === false && x\.lecture !== true/.test(p) && /publierAbonnement\(x\)/.test(p), 'la porte ne ferme l’app QUE si la base ferme aussi la lecture ; elle publie l’état (garde, coque)');
    dit(/installerGardeEcriture\(SUPABASE_URL\)/.test(app) && /<BandeauAbonnement setTab=\{setTab\}\/>/.test(app), '  la garde est posée, et la ligne de l’abonnement est sur la coque');
  });

  console.log('── 3. Le portail Stripe : SON client, et rien sans Stripe');
  await essaie('portail', async () => {
    reset(); abos[A] = { statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A' };
    const r = await appel({ method: 'POST', mode: 'portail', headers: { authorization: 'Bearer aa.bb.A' }, corps: { customer: 'cus_B', client: 'cus_B' }, query: { customer: 'cus_B' } });
    const s = stripe.find((x) => x.chemin === 'billing_portal/sessions');
    dit(r.code === 200 && s && s.corps.get('customer') === 'cus_A', 'le portail s’ouvre sur le client de SA ligne — un `customer` envoyé par le navigateur est ignoré', `HTTP ${r.code} · ${s && s.corps.get('customer')}`);
    dit(s && /^https:\/\/vrm\.center\//.test(s.corps.get('return_url') || ''), '  retour FIXE sur vrm.center', s && s.corps.get('return_url'));
    reset(); abos[B] = { statut: 'active', client_stripe: 'cus_B' };
    const r2 = await appel({ method: 'POST', mode: 'portail', headers: { authorization: 'Bearer aa.bb.A' }, corps: { customer: 'cus_B' } });
    dit(r2.code === 404 && !stripe.some((x) => x.chemin === 'billing_portal/sessions'), '  sans abonnement à lui : 404, Stripe n’est pas appelé (jamais celui d’un autre)', `HTTP ${r2.code}`);
    const r3 = await appel({ method: 'POST', mode: 'portail', corps: {} });
    dit(r3.code === 401, '  sans session : 401');
    process.env.STRIPE_SECRET_KEY = ''; reset(); abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    const r4 = await appel({ method: 'POST', mode: 'portail', headers: { authorization: 'Bearer aa.bb.A' } });
    const r5 = await appel({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } });
    process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
    dit(r4.code === 503 && /pas encore branché/.test(r4.corps.message) && stripe.length === 0, 'Stripe absent : 503 avec une phrase, aucun appel', `HTTP ${r4.code}`);
    dit(r5.code === 200 && r5.corps.configure === false, '  … et la page sait que le paiement n’est pas branché (`configure: false`)');
  });

  console.log('── 4. Le parrainage');
  const get = (j) => appel({ mode: 'parrainage', headers: { authorization: 'Bearer ' + j } });
  const post = (j, code) => appel({ method: 'POST', mode: 'parrainage', headers: { authorization: 'Bearer ' + j }, corps: { action: 'rattacher', code } });
  await essaie('lien', async () => {
    reset();
    const r = await get('aa.bb.A');
    dit(r.code === 200 && r.corps.installe && /^[A-HJ-NP-Z2-9]{8}$/.test(r.corps.code) && r.corps.suivi.inscrits === 0, 'un code personnel de 8 signes, et un suivi en nombres', JSON.stringify(r.corps));
    const r2 = await get('aa.bb.A');
    dit(r2.corps.code === r.corps.code, '  le même code à chaque fois');
    dit(!JSON.stringify(r.corps).match(/[0-9a-f]{8}-[0-9a-f]{4}/), '  aucun identifiant de vendeur dans la réponse');
    dit(E.lienParrainage(r.corps.code) === `https://vrm.center/?parrain=${r.corps.code}` && E.codeParrainDe('?parrain=' + r.corps.code.toLowerCase()) === r.corps.code && E.codeParrainDe('?parrain=x<script>') === '', '  le lien, et sa lecture (un code mal formé n’est pas gardé)');
    reset(); sansStripeTable = true;
    const r3 = await get('aa.bb.A');
    dit(r3.code === 200 && r3.corps.installe === false && !r3.corps.code, '  027 pas passée : « pas installé », aucun lien promis', JSON.stringify(r3.corps));
  });
  await essaie('règles', async () => {
    reset(); const code = (await get('aa.bb.A')).corps.code;
    let r = await post('aa.bb.A', code); dit(r.code === 400 && r.corps.raison === 'soi-meme', 'pas soi-même', JSON.stringify(r.corps));
    r = await post('aa.bb.B', code); dit(r.code === 409 && r.corps.raison === 'ancien', 'un compte de plus de 30 jours n’est pas un filleul', JSON.stringify(r.corps));
    reglages.parrainage = '0'; r = await post('aa.bb.N', code); dit(r.code === 409 && r.corps.raison === 'ferme' && !parr[N], 'éteint par défaut (`parrainage` = 0) : rien n’est rattaché', JSON.stringify(r.corps));
    reglages.parrainage = '1'; essais = ['email:n@exemple.test']; r = await post('aa.bb.N', code); dit(r.corps.raison === 'deja-essaye' && !parr[N], 'un essai déjà consommé (e-mail ou compte Vinted) : pas un filleul', JSON.stringify(r.corps));
    essais = []; vinted[A] = ['777']; vinted[N] = ['777']; r = await post('aa.bb.N', code); dit(r.corps.raison === 'soi-meme' && !parr[N], 'un compte Vinted en commun avec le parrain : c’est soi-même', JSON.stringify(r.corps));
    vinted[N] = ['888']; abos[N] = { statut: 'canceled', client_stripe: 'cus_N' }; r = await post('aa.bb.N', code); dit(r.corps.raison === 'deja-client', 'déjà client Stripe : pas un premier abonnement', JSON.stringify(r.corps));
    delete abos[N]; r = await post('aa.bb.N', 'ZZZZZZZZ'); dit(r.code === 404, 'code inconnu : 404');
    r = await post('aa.bb.N', code); dit(r.code === 200 && r.corps.ok && parr[N] && parr[N].parrain === A, 'compte neuf, code du parrain : rattaché', JSON.stringify(r.corps));
    const codeB = (await get('aa.bb.B')).corps.code;
    r = await post('aa.bb.N', codeB); dit(r.corps.raison === 'deja-parraine' && parr[N].parrain === A, 'UNE fois par filleul : un second parrain ne prend pas sa place', JSON.stringify(r.corps));
    const s = (await get('aa.bb.A')).corps.suivi;
    dit(s.inscrits === 1 && s.payes === 0, '  le parrain lit « 1 inscrit, 0 a payé »', JSON.stringify(s));
  });
  const facture = (client, montant, n) => evt('invoice.paid', { id: 'in_' + n, object: 'invoice', customer: client, amount_paid: montant, subscription: 'sub_x' }, 1000 + n);
  const webhook = async (c) => { const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), r); return r; };
  await essaie('récompense', async () => {
    reset(); const code = (await get('aa.bb.A')).corps.code; await post('aa.bb.N', code);
    abos[N] = { statut: 'trialing', client_stripe: 'cus_N' }; abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    let r = await webhook(facture('cus_N', 0, 1));
    dit(r.code === 200 && !(balance.cus_N || []).length && !(balance.cus_A || []).length && !parr[N].paye_le, 'la facture à 0 € de l’essai : rien n’est offert', `HTTP ${r.code}`);
    r = await webhook(facture('cus_N', 1699, 2));
    const fN = balance.cus_N || [], fA = balance.cus_A || [];
    dit(r.code === 200 && fN.length === 1 && fN[0].amount === -1699 && fA.length === 1 && fA[0].amount === -1699, 'premier paiement réel : un mois (16,99 €) crédité au filleul ET au parrain', JSON.stringify({ fN, fA }));
    dit(parr[N].paye_le && parr[N].credit_filleul_le && parr[N].credit_parrain_le, '  les dates sont rangées');
    await webhook(facture('cus_N', 1699, 2)); await webhook(facture('cus_N', 1699, 3));
    dit((balance.cus_N || []).length === 1 && (balance.cus_A || []).length === 1, 'webhook rejoué, mois suivant : jamais un second mois offert', `${(balance.cus_N || []).length} / ${(balance.cus_A || []).length}`);
    const s = (await get('aa.bb.A')).corps.suivi;
    dit(s.payes === 1 && s.moisOfferts === 1, '  le parrain lit « 1 a payé, 1 mois offert »', JSON.stringify(s));
    // Les crédits portent leur marque : une ligne perdue ne recrédite pas.
    parr[N].credit_filleul_le = null; parr[N].credit_parrain_le = null;
    await webhook(facture('cus_N', 1699, 4));
    dit((balance.cus_N || []).length === 1 && (balance.cus_A || []).length === 1, '  même si la base a perdu la date : la marque Stripe empêche le double crédit');
  });
  await essaie('attente et plafond', async () => {
    reset(); const code = (await get('aa.bb.A')).corps.code; await post('aa.bb.N', code);
    abos[N] = { statut: 'active', client_stripe: 'cus_N' };
    await webhook(facture('cus_N', 1699, 1));
    dit((balance.cus_N || []).length === 1 && !parr[N].credit_parrain_le, 'parrain jamais abonné : son mois reste EN ATTENTE', JSON.stringify(parr[N]));
    dit((await get('aa.bb.A')).corps.suivi.enAttente === 1, '  … et c’est dit (« en attente »)');
    abos[A] = { statut: 'trialing', client_stripe: 'cus_A' };
    await webhook(facture('cus_A', 0, 2));
    dit((balance.cus_A || []).length === 1 && parr[N].credit_parrain_le, '  dès qu’il a un client Stripe : crédité', JSON.stringify(balance.cus_A || []));
    reset(); codes[A] = 'AAAAAAAA'; abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    const an = new Date().toISOString();
    for (let i = 0; i < 12; i++) parr['f' + i] = { filleul: 'f' + i, parrain: A, paye_le: an, credit_parrain_le: an };
    parr[N] = { filleul: N, parrain: A, code: 'AAAAAAAA' }; abos[N] = { statut: 'active', client_stripe: 'cus_N' };
    await webhook(facture('cus_N', 1699, 9));
    dit((balance.cus_N || []).length === 1 && !(balance.cus_A || []).length, 'plafond : au plus 12 mois offerts au parrain par an (le filleul garde le sien)', JSON.stringify({ N: balance.cus_N, A: balance.cus_A }));
    reset(); reglages.parrainage = '0'; parr[N] = { filleul: N, parrain: A, code: 'X' }; abos[N] = { statut: 'active', client_stripe: 'cus_N' }; abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    const r = await webhook(facture('cus_N', 1699, 1));
    dit(r.code === 200 && !(balance.cus_N || []).length, 'programme éteint : rien n’est crédité, Stripe ne boucle pas (200)', `HTTP ${r.code}`);
  });
  await essaie('textes légaux', async () => {
    const cgv = lire('public/legal/cgv.html');
    dit(/Parrainage/.test(cgv) && /12 mois offerts/.test(cgv) && /se parrainer soi-même/.test(cgv), 'CGV : le parrainage et ses règles sont écrits');
    dit(/lecture seule/.test(cgv) && /ne sont pas supprimées|aucune n’est supprimée/.test(cgv), 'CGV : l’expiration laisse les données consultables, rien supprimé');
    dit(/trois jours puis un jour avant la fin de l’essai/.test(cgv) && /Paramètres → Abonnement → Résilier, puis confirmer/.test(cgv), 'CGV : les rappels d’essai et le chemin de résiliation (deux gestes)');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-abonnement-propre : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
