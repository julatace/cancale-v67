// ════════════════════════════════════════════════════════════════════════════
//  UN MONDE SIMULÉ POUR LE PAIEMENT (12 nov., lot agent2-ouverture-clients)
//  Un faux Stripe QUI A UN ÉTAT (prix, clients, cartes, abonnements, soldes,
//  webhooks déclarés) et une fausse base à la forme PostgREST (abonnements,
//  essais, parrainage, comptes Vinted, `vrm_acces`) — servis au VRAI
//  api/compte.js par `global.fetch`. Aucune vraie clé, aucune vraie carte :
//  « 4242 » n'est qu'une empreinte inventée ici.
//  Utilisé par scripts/bancs/paiement-bout-en-bout.cjs et
//  scripts/audit-ouverture-paiements.cjs.
// ════════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');

const SERVICE = 'sb_secret_monde';
const SECRET_WEBHOOK = 'whsec_monde_paiement';
const rep = (corps, status = 200, entetes = {}) => new Response(corps === null || status === 204 ? null : typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json', ...entetes } });
const formulaire = (s) => { const o = {}; for (const [k, v] of new URLSearchParams(s || '')) o[k] = v; return o; };
const uuid = (n) => `${String(n).repeat(8).slice(0, 8)}-${String(n).repeat(4).slice(0, 4)}-4${String(n).repeat(3).slice(0, 3)}-8${String(n).repeat(3).slice(0, 3)}-${String(n).repeat(12).slice(0, 12)}`;

function creerMonde({ proprio = uuid(9), parrainageOuvert = true, obligatoire = true, lecture027 = true } = {}) {
  const M = {
    proprio, obligatoire, lecture027, maintenant: () => Date.now(),
    users: {},            // jeton → { id, email, created_at }
    // ── Stripe ──
    stripe: {
      prix: [
        { id: 'price_solo_monde', object: 'price', active: true, lookup_key: 'vrm_mensuel', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } },
        { id: 'price_pro_monde', object: 'price', active: true, lookup_key: 'vrm_pro_mensuel', unit_amount: 1999, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } },
      ],
      webhooks: [{ id: 'we_monde', url: 'https://vrm.center/api/stripe-webhook', status: 'enabled', enabled_events: ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid'] }],
      clients: {}, subs: {}, sessions: {}, soldes: {}, cartes: {}, panneWebhooks: false,
    },
    // ── Base ──
    base: { abonnements: {}, essais: {}, vinted: [], codes: {}, parrainages: {}, reglages: { parrainage: parrainageOuvert ? '1' : '0', proprietaire: proprio } },
    appels: [], n: 0, file: [],
  };
  M.id = (p) => `${p}_${++M.n}`;
  M.ajouterUtilisateur = (n, email, { creeIlYa = 0 } = {}) => {
    const id = uuid(n), jeton = `aa.bb.${n}`;
    M.users[jeton] = { id, email, created_at: new Date(Date.now() - creeIlYa).toISOString() };
    return { id, jeton, email };
  };
  // ── La règle d'accès (recopie de vrm_regle_acces, 006 + 027) ──
  const accesDe = (id) => {
    const l = M.base.abonnements[id];
    const ok = !M.obligatoire || id === M.proprio || (l && ['active', 'trialing'].includes(l.statut))
      || (l && l.statut === 'past_due' && Date.parse(l.impaye_depuis || 0) > Date.now() - 14 * 864e5);
    return { obligatoire: M.obligatoire, proprietaire: id === M.proprio, acces: !!ok, lecture: M.lecture027 ? true : undefined };
  };
  M.accesDe = accesDe;
  const qui = (h) => M.users[String(h.Authorization || h.authorization || '').replace('Bearer ', '')] || null;
  const estService = (h) => String(h.apikey || '') === SERVICE && !h.Authorization;
  const filtre = (u, champ) => { const m = new RegExp(`[?&]${champ}=eq\\.([^&]+)`).exec(u); return m ? decodeURIComponent(m[1]) : null; };

  // ── Le faux Stripe ──
  const sub = (id) => M.stripe.subs[id];
  const prixDe = (id) => M.stripe.prix.find((p) => p.id === id || p.lookup_key === id);
  function stripe(m, chemin, corps, u) {
    const S = M.stripe;
    const q = formulaire(u.split('?')[1] || '');
    if (chemin === 'prices' && m === 'GET') { const k = q['lookup_keys[]'] || q['lookup_keys[0]']; return rep({ object: 'list', data: S.prix.filter((p) => p.active && (!k || p.lookup_key === k)) }); }
    if (chemin.startsWith('prices/')) { const p = prixDe(chemin.split('/')[1]); return p ? rep(p) : rep({ error: { message: 'No such price' } }, 404); }
    if (chemin === 'webhook_endpoints') return S.panneWebhooks ? rep({ error: { message: 'panne' } }, 500) : rep({ object: 'list', data: S.webhooks });
    if (chemin === 'checkout/sessions' && m === 'POST') {
      const f = formulaire(corps); const id = M.id('cs');
      S.sessions[id] = { id, f, url: `https://checkout.stripe.com/c/pay/${id}` };
      return rep({ id, url: S.sessions[id].url });
    }
    if (chemin === 'billing_portal/sessions') return rep({ url: 'https://billing.stripe.com/p/session/monde' });
    if (chemin === 'payment_methods') return rep({ object: 'list', data: (S.cartes[q.customer] || []).map((fp) => ({ id: 'pm_' + fp, card: { fingerprint: fp, brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } })) });
    let x = /^customers\/([^/]+)\/balance_transactions$/.exec(chemin);
    if (x) {
      const c = decodeURIComponent(x[1]); S.soldes[c] = S.soldes[c] || [];
      if (m === 'POST') { const f = formulaire(corps); const t = { id: M.id('cbtxn'), amount: Number(f.amount), metadata: { vrm_parrainage: f['metadata[vrm_parrainage]'] } }; S.soldes[c].push(t); return rep(t); }
      return rep({ object: 'list', data: S.soldes[c] });
    }
    x = /^customers\/([^/]+)$/.exec(chemin);
    if (x) return rep({ id: x[1], invoice_settings: { default_payment_method: { card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } } } });
    if (chemin === 'invoices') return rep({ object: 'list', data: (S.factures || []).filter((f) => f.customer === q.customer) });
    x = /^subscriptions\/([^/]+)$/.exec(chemin);
    if (x) {
      const s = sub(decodeURIComponent(x[1]));
      if (!s) return rep({ error: { message: 'No such subscription' } }, 404);
      if (m === 'POST') {
        const f = formulaire(corps);
        if ('cancel_at_period_end' in f) s.cancel_at_period_end = f.cancel_at_period_end === 'true';
        for (const [k, v] of Object.entries(f)) { const mm = /^metadata\[(.+)\]$/.exec(k); if (mm) s.metadata[mm[1]] = v; }
        M.file.push(['customer.subscription.updated', JSON.parse(JSON.stringify(s))]);   // ce que Stripe enverra
      }
      if (m === 'DELETE') { s.status = 'canceled'; }
      return rep(s);
    }
    return rep({ error: { message: 'inconnu ' + chemin } }, 404);
  }

  // ── La fausse base ──
  function base(m, u, h, corps) {
    const B = M.base, moi = qui(h), service = estService(h);
    if (u.includes('/auth/v1/user')) return moi ? rep(moi) : rep({ msg: 'invalid' }, 401);
    if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return service ? rep(accesDe(JSON.parse(corps).u).acces) : rep({ message: 'denied' }, 401);
    if (u.includes('/rest/v1/rpc/vrm_acces')) return moi ? rep(accesDe(moi.id)) : rep({ message: 'JWT' }, 401);
    const table = (/\/rest\/v1\/([a-z_]+)/.exec(u) || [])[1];
    if (table === 'abonnements') {
      if (m === 'POST') { if (!service) return rep({ message: 'RLS' }, 403); for (const l of JSON.parse(corps)) B.abonnements[l.owner] = { ...(B.abonnements[l.owner] || {}), ...l }; return rep('', 201); }
      if (!service) return rep(moi && B.abonnements[moi.id] ? [B.abonnements[moi.id]] : []);
      const o = filtre(u, 'owner'), c = filtre(u, 'client_stripe');
      if (o) return rep(B.abonnements[o] ? [B.abonnements[o]] : []);
      if (c) { const l = Object.values(B.abonnements).find((x) => x.client_stripe === c); return rep(l ? [l] : []); }
      return rep([]);
    }
    if (table === 'essais_gratuits') {
      if (m === 'POST') { for (const l of JSON.parse(corps)) if (!B.essais[l.cle]) B.essais[l.cle] = l; return rep('', 201); }
      const cles = decodeURIComponent(u).match(/"([^"]+)"/g) || [];
      return rep(cles.map((c) => c.slice(1, -1)).filter((c) => B.essais[c]).slice(0, 1).map((cle) => ({ cle })));
    }
    if (table === 'vinted_accounts') {
      const o = filtre(u, 'owner'), v = filtre(u, 'vinted_user_id');
      let l = B.vinted;
      if (!service) l = l.filter((x) => moi && x.owner === moi.id);
      if (o) l = l.filter((x) => x.owner === o);
      if (v) l = l.filter((x) => x.vinted_user_id === v);
      return rep(l.map((x) => ({ owner: x.owner, vinted_user_id: x.vinted_user_id, login: x.login })));
    }
    if (table === 'vrm_reglages') { const c = filtre(u, 'cle'); return rep(c && B.reglages[c] != null ? [{ valeur: B.reglages[c] }] : []); }
    if (table === 'parrainage_codes') {
      if (m === 'POST') { for (const l of JSON.parse(corps)) if (!B.codes[l.owner]) B.codes[l.owner] = l.code; return rep('', 201); }
      const o = filtre(u, 'owner'), c = filtre(u, 'code');
      if (o) return rep(B.codes[o] ? [{ code: B.codes[o] }] : []);
      if (c) { const e = Object.entries(B.codes).find(([, k]) => k === c); return rep(e ? [{ owner: e[0] }] : []); }
      return rep([]);
    }
    if (table === 'parrainages') {
      if (m === 'POST') {
        const rendus = [];
        for (const l of JSON.parse(corps)) if (!B.parrainages[l.filleul]) { B.parrainages[l.filleul] = { ...l, paye_le: null, credit_filleul_le: null, credit_parrain_le: null }; rendus.push(l); }
        return rep(rendus, 201);
      }
      if (m === 'PATCH') { const f = filtre(u, 'filleul'); if (B.parrainages[f]) Object.assign(B.parrainages[f], JSON.parse(corps)); return rep('', 204); }
      let l = Object.values(B.parrainages);
      const f = filtre(u, 'filleul'), p = filtre(u, 'parrain');
      if (f) l = l.filter((x) => x.filleul === f);
      if (p) l = l.filter((x) => x.parrain === p);
      if (/paye_le=not\.is\.null/.test(u)) l = l.filter((x) => x.paye_le);
      if (/credit_parrain_le=is\.null/.test(u)) l = l.filter((x) => !x.credit_parrain_le);
      if (/select=[^&]*refus/.test(u) && !('refus' in (l[0] || { refus: 1 }))) l = l.map((x) => ({ refus: null, ...x }));
      return rep(l);
    }
    if (table === 'app_data') return rep([]);
    return rep([], 200);
  }

  M.fetch = async (url, opts = {}) => {
    const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
    M.appels.push({ m, u: u.slice(0, 200) });
    if (u.startsWith('https://api.stripe.com/v1/')) return stripe(m, u.slice('https://api.stripe.com/v1/'.length).split('?')[0], opts.body || '', u);
    if (/\/(rest|auth)\/v1\//.test(u)) return base(m, u, h, opts.body);
    return rep({ erreur: 'hors monde' }, 404);
  };

  // ── Ce que fait le CLIENT sur la page Stripe : payer avec « 4242 » ──
  // `empreinte` : celle de la carte (la même carte = la même empreinte chez Stripe).
  M.payer = (sessionId, { empreinte = 'fp_4242_' + sessionId } = {}) => {
    const S = M.stripe, s = S.sessions[sessionId];
    if (!s) throw new Error('session inconnue ' + sessionId);
    const f = s.f;
    const client = f.customer || M.id('cus');
    S.clients[client] = { id: client, email: f.customer_email || null };
    S.cartes[client] = Array.from(new Set([...(S.cartes[client] || []), empreinte]));
    const meta = {}; for (const [k, v] of Object.entries(f)) { const mm = /^subscription_data\[metadata\]\[(.+)\]$/.exec(k); if (mm) meta[mm[1]] = v; }
    const essai = Number(f['subscription_data[trial_period_days]'] || 0);
    const prix = prixDe(f['line_items[0][price]']);
    const id = M.id('sub'), fin = Math.floor(Date.now() / 1000) + (essai ? essai : 30) * 86400;
    S.subs[id] = { id, object: 'subscription', status: essai ? 'trialing' : 'active', customer: client, metadata: meta, cancel_at_period_end: false,
      trial_end: essai ? fin : null, livemode: false, items: { data: [{ id: M.id('si'), quantity: 1, price: prix, current_period_end: fin }] } };
    return { client, sub: id, evenements: [
      ['checkout.session.completed', { id: sessionId, object: 'checkout.session', mode: 'subscription', subscription: id, client_reference_id: f.client_reference_id, customer: client }],
      ['customer.subscription.created', S.subs[id]],
      ['invoice.paid', { id: M.id('in'), customer: client, amount_paid: essai ? 0 : prix.unit_amount, subscription: id }],
    ] };
  };
  // La fin de l'essai : Stripe prélève le premier mois.
  M.finEssai = (id) => { const s = sub(id); s.status = 'active'; s.trial_end = null; const p = s.items.data[0].price;
    return [['customer.subscription.updated', s], ['invoice.paid', { id: M.id('in'), customer: s.customer, amount_paid: p.unit_amount, subscription: id }]]; };
  // La fin de la période payée d'un abonnement résilié.
  // Les webhooks que Stripe enverrait après un changement fait par l'API.
  M.enAttente = () => M.file.splice(0);
  M.finPeriode = (id) => { const s = sub(id); s.status = 'canceled'; return [['customer.subscription.deleted', s]]; };

  let horloge = Math.floor(Date.now() / 1000);
  M.evenement = (type, objet) => JSON.stringify({ id: M.id('evt'), type, created: ++horloge, livemode: false, data: { object: objet } });
  M.signer = (corps, secret = SECRET_WEBHOOK, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex')}`;
  return M;
}

// Appeler la VRAIE route comme Vercel.
const faireRes = () => { const r = { code: null, corps: null, entetes: {} }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = (k, v) => { r.entetes[k] = v; }; r.end = () => r; r.send = (b) => { r.corps = b; return r; }; return r; };
const requete = ({ method = 'GET', mode, headers = {}, corps = null, query = {} }) => {
  const buf = corps == null ? null : Buffer.from(typeof corps === 'string' ? corps : JSON.stringify(corps), 'utf8');
  return { method, query: { ...(mode ? { mode } : {}), ...query }, headers: { ...(buf && typeof corps !== 'string' ? { 'content-type': 'application/json' } : {}), ...headers }, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
async function appeler(route, args) { const r = faireRes(); await route(requete(args), r); return r; }
// Livrer des événements signés au webhook.
async function livrer(route, M, evenements) {
  const out = [];
  for (const [type, objet] of evenements) {
    const c = M.evenement(type, JSON.parse(JSON.stringify(objet)));
    out.push(await appeler(route, { method: 'POST', mode: 'webhook', headers: { 'stripe-signature': M.signer(c) }, corps: c }));
  }
  return out;
}
function brancherEnv(M, extra = {}) {
  Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test_monde', STRIPE_WEBHOOK_SECRET: SECRET_WEBHOOK, SUPABASE_SERVICE_KEY: SERVICE, VRM_OWNER_UID: M.proprio, STRIPE_PRIX_PRO: 'vrm_pro_mensuel', ...extra });
}
// Les mentions de l'éditeur, remplies de valeurs INVENTÉES (jamais celles de Julien).
async function remplirMentions(racine) {
  const path = require('path');
  try { await import('file://' + path.join(racine, 'public', 'legal', 'editeur.js')); } catch (_) {}
  const E = globalThis.VRM_EDITEUR; const avant = E ? { ...E } : null;
  if (E) for (const k of Object.keys(E)) if (k !== 'email') E[k] = 'valeur d’essai ' + k;
  return () => { if (E && avant) Object.assign(E, avant); };
}

module.exports = { creerMonde, appeler, livrer, brancherEnv, remplirMentions, faireRes, requete, uuid, SERVICE, SECRET_WEBHOOK };
