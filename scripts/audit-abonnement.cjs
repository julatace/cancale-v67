// Audit : l'abonnement Stripe ne se contourne pas, ne se perd pas, et ne fait
// jamais payer le propriétaire (api/compte.js, demande du 4 octobre :
// « 9,99 € par mois pour tout le monde sauf moi »).
//
// §4.10 : une route serveur n'est vérifiée que si on l'EXÉCUTE. Ce banc charge
// le VRAI api/compte.js avec un faux Stripe et une fausse base, et vérifie :
//   · le webhook n'écrit QUE sur une signature valide, récente, sur le corps
//     exact (sinon n'importe qui se déclarerait « abonné ») ;
//   · le statut s'écrit au nom du vendeur que NOUS avons posé dans Stripe,
//     jamais au nom d'un identifiant envoyé par le navigateur ;
//   · un événement plus ancien n'écrase pas un plus récent ;
//   · une écriture ratée répond 5xx (Stripe réessaie) — jamais « reçu » ;
//   · le propriétaire (VRM_OWNER_UID) ne paie pas ; un abonné ne paie pas deux fois ;
//   · l'adresse de retour du paiement ne vient jamais de la requête ;
//   · QUI NE PAIE PLUS NE REÇOIT PLUS RIEN (Julien, 4 octobre) : ni
//     notification, ni chiffres sur le widget — selon la règle de la BASE
//     (`vrm_acces` / `vrm_acces_pour`), jamais une copie ; « pas su » ne coupe
//     pas ; 14 jours de grâce quand le prélèvement échoue ;
//   · un appareil s'enregistre chez le vendeur de SA SESSION (le téléphone d'un
//     vendeur ne reçoit jamais les ventes d'un autre).
// La fausse base applique `regle()`, recopie de `vrm_regle_acces` (migration
// 006) — la règle SQL elle-même a été exécutée sur la vraie base dans une
// transaction annulée, cinq cas, le 4 octobre.
// Aucune donnée réelle : tout est inventé ici.
const path = require('path'), crypto = require('crypto');
const RACINE = path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };

const A = '11111111-1111-4111-8111-111111111111';     // un vendeur
const B = '22222222-2222-4222-8222-222222222222';     // un autre vendeur
const PROPRIO = '99999999-9999-4999-8999-999999999999';
const SECRET = 'whsec_banc_abonnement';
const JETONS = { 'aa.bb.A': { id: A, email: 'a@exemple.test' }, 'aa.bb.B': { id: B, email: 'b@exemple.test' }, 'aa.bb.P': { id: PROPRIO, email: 'p@exemple.test' } };

// ── Fausse base + faux Stripe ───────────────────────────────────────────────
let base, ecritures, appelsStripe, panneEcriture, fkInconnue, obligatoire, panneRpc, appData, lecturesSubs, ecrituresData, mains;
const reset = () => {
  base = {}; ecritures = []; appelsStripe = []; panneEcriture = false; fkInconnue = false;
  obligatoire = false; panneRpc = false; appData = {}; lecturesSubs = []; ecrituresData = []; mains = [];
  if (oublierAcces) oublierAcces();
};
let oublierAcces = null;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
// Recopie de `vrm_regle_acces` (supabase/migrations/006-acces-abonnement.sql).
const regle = (obl, proprio, statut, impaye) => !obl || !!proprio || ['active', 'trialing'].includes(statut || '')
  || (statut === 'past_due' && (impaye ? Date.parse(impaye) : Date.now()) > Date.now() - 14 * 864e5);
const accesDeLaBase = (id) => regle(obligatoire, id === PROPRIO, base[id] && base[id].statut, base[id] && base[id].impaye_depuis);
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
  const jwt = String(h.Authorization || '').replace('Bearer ', '');
  if (u.includes('/auth/v1/user')) {
    return JETONS[jwt] ? rep(JETONS[jwt]) : rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) {
    if (panneRpc) return rep('<html>522</html>', 522);
    if (JETONS[jwt]) return rep({ message: 'permission denied' }, 401);   // service seulement
    return rep(accesDeLaBase(JSON.parse(opts.body).u));
  }
  if (u.includes('/rest/v1/rpc/vrm_acces')) {
    if (panneRpc) return rep('<html>522</html>', 522);
    const qui = JETONS[jwt];
    if (!qui) return rep({ message: 'JWT' }, 401);
    return rep({ obligatoire, proprietaire: qui.id === PROPRIO, acces: accesDeLaBase(qui.id) });
  }
  if (u.includes('/rest/v1/app_data')) {
    const own = /owner=eq\.([^&]+)/.exec(u), id = /id=eq\.([^&]+)/.exec(u);
    if (m === 'POST') {
      for (const l of JSON.parse(opts.body)) { ecrituresData.push({ url: u, ...l }); appData[`${l.owner || ''}|${l.id}`] = l; }
      return rep('', 201);
    }
    if (/select=owner&limit=1/.test(u)) return rep([]);                      // base cloisonnée
    if (id && id[1] === 'main') return rep(mains);
    if (id && (id[1] === 'push_subs' || id[1] === 'push_prefs')) {
      const o = own ? decodeURIComponent(own[1]) : null;
      if (id[1] === 'push_subs') lecturesSubs.push(o);
      if (!o) return rep(Object.entries(appData).filter(([k]) => k.endsWith('|' + id[1])).map(([, l]) => ({ data: l.data })));
      const l = appData[`${o}|${id[1]}`];
      return rep(l ? [{ data: l.data }] : []);
    }
    return rep([]);
  }
  if (u.includes('/rest/v1/abonnements')) {
    const service = !String(h.Authorization || '').includes('aa.bb.');
    if (m === 'POST') {
      if (!service) return rep({ message: 'RLS' }, 403);
      if (panneEcriture) return rep('<html>522</html>', 522);
      const lignes = JSON.parse(opts.body);
      if (fkInconnue) return rep({ code: '23503', message: 'violates foreign key' }, 409);
      for (const l of lignes) { ecritures.push(l); base[l.owner] = { ...(base[l.owner] || {}), ...l }; }
      return rep('', 201);
    }
    if (!service) {   // lecture par le vendeur : RLS = sa ligne seulement
      const qui = JETONS[String(h.Authorization || '').replace('Bearer ', '')];
      return rep(qui && base[qui.id] ? [base[qui.id]] : []);
    }
    const own = /owner=eq\.([^&]+)/.exec(u); const cli = /client_stripe=eq\.([^&]+)/.exec(u);
    if (own) return rep(base[decodeURIComponent(own[1])] ? [base[decodeURIComponent(own[1])]] : []);
    if (cli) { const l = Object.values(base).find((x) => x.client_stripe === decodeURIComponent(cli[1])); return rep(l ? [l] : []); }
    return rep([]);
  }
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
    appelsStripe.push({ m, chemin, corps: opts.body || u.split('?')[1] || '', h });
    if (chemin === 'prices') return rep({ data: [{ id: 'price_banc', unit_amount: 999, currency: 'eur', recurring: { interval: 'month' } }] });
    if (chemin === 'checkout/sessions') return rep({ id: 'cs_banc', url: 'https://checkout.stripe.com/c/pay/cs_banc' });
    if (chemin === 'billing_portal/sessions') return rep({ url: 'https://billing.stripe.com/p/session/banc' });
    if (chemin.startsWith('subscriptions/')) return rep({ id: chemin.split('/')[1], status: 'active', customer: 'cus_A', metadata: { owner: A }, items: { data: [{ current_period_end: 1800000000 }] } });
    return rep({ error: { message: 'inconnu' } }, 404);
  }
  return rep({}, 404);
};

const faireRes = () => { const r = { code: null, corps: null, entetes: {} }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = (k, v) => { r.entetes[k] = v; }; r.end = () => r; return r; };
// Une requête comme Vercel la donne : un flux qu'on peut lire, plus query/headers.
const req = ({ method = 'GET', mode, headers = {}, corps = null }) => {
  const buf = corps == null ? null : Buffer.from(corps, 'utf8');
  return { method, query: mode ? { mode } : {}, headers, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
const signer = (corps, t = Math.floor(Date.now() / 1000), secret = SECRET) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex')}`;
const evenement = (type, objet, created = 1000) => JSON.stringify({ id: 'evt_' + created, type, created, livemode: false, data: { object: objet } });
const SUB = (owner, status = 'active', extra = {}) => ({ id: 'sub_' + owner.slice(0, 4), object: 'subscription', status, customer: 'cus_' + owner.slice(0, 4), metadata: owner ? { owner } : {}, items: { data: [{ current_period_end: 1800000000 }] }, ...extra });

(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  process.env.VRM_OWNER_UID = PROPRIO;
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); console.log(`\n${ko} contrôle(s) en échec.`); process.exit(1); }
  // Les autres routes : un module absent (code d'avant) donne des contrôles
  // ROUGES, jamais un banc qui meurt avant son bilan.
  const charge = async (rel) => { try { return await import('file://' + path.join(RACINE, ...rel.split('/'))); } catch (e) { dit(false, `${rel} se charge`, e.message); return {}; } };
  const libPush = await charge('api/_lib/push.js');
  const { contexteVendeur } = await charge('api/_lib/owner.js');
  const routePush = (await charge('api/push.js')).default;
  const widget = (await charge('api/widget.js')).default;
  oublierAcces = (await charge('api/_lib/abonnement.js')).oublierAcces || null;
  const commeVendeur = (owner, f) => contexteVendeur.run({ owner }, f);

  console.log('── Le webhook : seule une signature Stripe valide écrit');
  await essaie('webhook signé', async () => {
    reset();
    const c = evenement('customer.subscription.created', SUB(A), 1000);
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), r);
    dit(r.code === 200 && base[A] && base[A].statut === 'active', 'un événement signé enregistre le statut du vendeur', `HTTP ${r.code} · ${JSON.stringify(base[A] || null)}`);
    dit(base[A] && base[A].fin_periode === new Date(1800000000 * 1000).toISOString(), 'la fin de période vient de l’article de l’abonnement (forme de l’API figée)', base[A] && base[A].fin_periode);
  });
  for (const [nom, entete, corpsEnvoye] of [
    ['sans signature', '', null],
    ['signée avec un autre secret', null, 'autre'],
    ['signée il y a 10 minutes (rejeu)', 'vieux', null],
    ['corps modifié après signature', 'modifie', null],
  ]) {
    await essaie(nom, async () => {
      reset();
      const c = evenement('customer.subscription.created', SUB(B), 2000);
      let e = entete, corps = c;
      if (e === null) e = signer(c, undefined, 'whsec_pirate');
      if (e === 'vieux') e = signer(c, Math.floor(Date.now() / 1000) - 600);
      if (e === 'modifie') { e = signer(c); corps = c.replace('"active"', '"trialing"'); }
      const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: e ? { 'stripe-signature': e } : {}, corps }), r);
      dit(r.code === 400 && ecritures.length === 0, `webhook ${nom} → refusé, rien d’écrit`, `HTTP ${r.code} · ${ecritures.length} écriture(s)`);
    });
  }
  await essaie('ordre', async () => {
    reset();
    const recent = evenement('customer.subscription.updated', SUB(A, 'active'), 5000);
    const ancien = evenement('customer.subscription.created', SUB(A, 'incomplete'), 4000);
    await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(recent) }, corps: recent }), faireRes());
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(ancien) }, corps: ancien }), r);
    dit(base[A].statut === 'active' && r.code === 200, 'un événement plus ANCIEN arrivé après n’écrase pas le plus récent', `statut final ${base[A].statut}`);
  });
  await essaie('panne écriture', async () => {
    reset(); panneEcriture = true;
    const c = evenement('customer.subscription.created', SUB(A), 1000);
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), r);
    dit(r.code >= 500, 'base injoignable → 5xx : Stripe RÉESSAIE (jamais « reçu » sans avoir rangé)', `HTTP ${r.code}`);
  });
  await essaie('sans propriétaire', async () => {
    reset();
    const c = evenement('customer.subscription.created', SUB('', 'active', { customer: 'cus_inconnu' }), 1000);
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), r);
    dit(r.code === 200 && ecritures.length === 0, 'un abonnement qu’on ne sait attribuer à personne n’est attribué à PERSONNE (jamais deviné)', `HTTP ${r.code} · ${ecritures.length} écriture(s)`);
  });
  await essaie('vendeur supprimé', async () => {
    reset(); fkInconnue = true;
    const c = evenement('customer.subscription.updated', SUB(B), 1000);
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), r);
    dit(r.code === 200, 'un vendeur supprimé : acquitté (réessayer n’y changerait rien), pas une boucle de 3 jours', `HTTP ${r.code}`);
  });
  await essaie('checkout terminé', async () => {
    reset();
    const c = evenement('checkout.session.completed', { id: 'cs_1', mode: 'subscription', subscription: 'sub_AAAA', client_reference_id: A, customer: 'cus_A' }, 1000);
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), r);
    dit(r.code === 200 && base[A] && base[A].abonnement_stripe === 'sub_AAAA', 'paiement terminé → l’état complet est relu chez Stripe et rangé', `HTTP ${r.code}`);
  });

  console.log('\n── Payer : qui paie, et au nom de qui');
  await essaie('checkout A', async () => {
    reset();
    const r = faireRes();
    const q = req({ method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer aa.bb.A', origin: 'https://site-pirate.example' }, corps: JSON.stringify({ owner: B, client_reference_id: B }) });
    q.body = { owner: B, client_reference_id: B };
    await compte(q, r);
    const s = appelsStripe.find((x) => x.chemin === 'checkout/sessions');
    const corps = decodeURIComponent((s && s.corps) || '');
    dit(r.code === 200 && r.corps && /checkout\.stripe\.com/.test(r.corps.url), 'un vendeur connecté obtient une page de paiement Stripe', `HTTP ${r.code}`);
    dit(/client_reference_id=11111111-1111-4111-8111-111111111111/.test(corps) && /subscription_data\[metadata\]\[owner\]=11111111/.test(corps) && !/22222222/.test(corps),
      'l’abonnement est rattaché au vendeur PROUVÉ par sa session — jamais à un identifiant envoyé par le navigateur', corps.slice(0, 160));
    dit(/success_url=https:\/\/vrm\.center\//.test(corps) && !/site-pirate/.test(corps), 'l’adresse de retour est fixe (jamais l’origine de la requête)');
    dit(/price\]=price_banc/.test(corps) && /mode=subscription/.test(corps), 'abonnement au prix de la clé vrm_mensuel (9,99 €/mois)');
  });
  await essaie('checkout sans session', async () => {
    reset(); const r = faireRes();
    await compte(req({ method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer faux.jeton.x' } }), r);
    dit(r.code === 401 && appelsStripe.length === 0, 'sans session valide : refusé, Stripe n’est même pas appelé', `HTTP ${r.code}`);
  });
  await essaie('checkout propriétaire', async () => {
    reset(); const r = faireRes();
    await compte(req({ method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer aa.bb.P' } }), r);
    dit(r.code === 409 && !appelsStripe.some((x) => x.chemin === 'checkout/sessions'), 'le propriétaire de VRM ne paie pas (aucune page de paiement)', `HTTP ${r.code}`);
  });
  await essaie('checkout déjà abonné', async () => {
    reset(); base[A] = { owner: A, statut: 'active', client_stripe: 'cus_A' };
    const r = faireRes();
    await compte(req({ method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer aa.bb.A' } }), r);
    dit(r.code === 409 && !appelsStripe.some((x) => x.chemin === 'checkout/sessions'), 'déjà abonné : pas de second abonnement', `HTTP ${r.code}`);
  });

  console.log('\n── Le prélèvement qui échoue : 14 jours de grâce, comptés depuis le PREMIER échec');
  await essaie('impaye_depuis', async () => {
    reset();
    const t1 = Math.floor(Date.now() / 1000) - 3 * 86400, t2 = t1 + 86400, t3 = t2 + 86400;
    for (const [st, t] of [['past_due', t1], ['past_due', t2]]) {
      const c = evenement('customer.subscription.updated', SUB(A, st), t);
      await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), faireRes());
    }
    dit(base[A] && base[A].impaye_depuis === new Date(t1 * 1000).toISOString(), 'impayé : la date du PREMIER échec est gardée (un nouvel essai raté ne relance pas les 14 jours)', base[A] && base[A].impaye_depuis);
    const c = evenement('customer.subscription.updated', SUB(A, 'active'), t3);
    await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), faireRes());
    dit(base[A] && base[A].impaye_depuis === null, 'payé de nouveau : la date d’impayé est effacée', base[A] && String(base[A].impaye_depuis));
  });

  console.log('\n── Qui ne paie plus ne reçoit plus rien (notifications)');
  const pousser = (owner) => commeVendeur(owner, () => libPush.sendPushToAll({ title: 'vente', tag: 't' }));
  const avecAppareil = (o) => { appData[`${o}|push_subs`] = { owner: o, id: 'push_subs', data: { subs: [{ endpoint: 'https://push.exemple.test/' + o.slice(0, 4), keys: {} }] } }; };
  await essaie('push coupé', async () => {
    reset(); obligatoire = true; avecAppareil(A);
    const r = await pousser(A);
    dit(r && r.coupe === 'abonnement' && r.sent === 0, 'abonnement obligatoire, A ne paie pas → AUCUNE notification', JSON.stringify(r));
    dit(!lecturesSubs.includes(A), 'et sa liste d’appareils n’est même pas lue (rien ne part, rien n’est effacé)', JSON.stringify(lecturesSubs));
  });
  await essaie('push payeur', async () => {
    reset(); obligatoire = true; base[B] = { owner: B, statut: 'active' }; avecAppareil(B);
    const r = await pousser(B);
    dit(r && !r.coupe && r.total === 1, 'B paie → ses notifications partent vers SES appareils', JSON.stringify(r));
  });
  await essaie('push grâce', async () => {
    reset(); obligatoire = true; avecAppareil(A);
    base[A] = { owner: A, statut: 'past_due', impaye_depuis: new Date(Date.now() - 3 * 864e5).toISOString() };
    const r1 = await pousser(A);
    dit(r1 && !r1.coupe, 'impayé depuis 3 jours (Stripe réessaie) → toujours notifié', JSON.stringify(r1));
    reset(); obligatoire = true; avecAppareil(A);
    base[A] = { owner: A, statut: 'past_due', impaye_depuis: new Date(Date.now() - 20 * 864e5).toISOString() };
    const r2 = await pousser(A);
    dit(r2 && r2.coupe === 'abonnement', 'impayé depuis 20 jours → coupé', JSON.stringify(r2));
  });
  await essaie('push pas obligatoire', async () => {
    reset(); obligatoire = false; avecAppareil(A);
    const r = await pousser(A);
    dit(r && !r.coupe && r.total === 1, 'tant que l’abonnement n’est pas obligatoire, rien ne change (A sans abonnement est notifié)', JSON.stringify(r));
  });
  await essaie('push propriétaire', async () => {
    reset(); obligatoire = true; avecAppareil(PROPRIO);
    const r = await pousser(PROPRIO);
    dit(r && !r.coupe && r.total === 1, 'le propriétaire n’est jamais coupé', JSON.stringify(r));
  });
  await essaie('push pas su', async () => {
    reset(); obligatoire = true; panneRpc = true; avecAppareil(A);
    const r = await pousser(A);
    dit(r && !r.coupe && r.total === 1, 'la base ne répond pas sur l’accès → « pas su » NE COUPE PAS (un payeur ne rate pas une vente pour un hoquet)', JSON.stringify(r));
  });
  await essaie('préférences', async () => {
    reset(); appData[`${A}|push_prefs`] = { owner: A, id: 'push_prefs', data: { offre: false } };
    const v = await commeVendeur(A, () => libPush.pushCategorieActive('offre'));
    dit(v === false, 'les réglages de notification du vendeur sont lus (« offres » éteintes → pas de notification d’offre)', String(v));
  });

  console.log('\n── Le téléphone de qui ? (route /api/push)');
  const appelPush = async (jeton, corps) => {
    const r = faireRes();
    await routePush({ method: 'POST', query: {}, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body: corps }, r);
    return r;
  };
  await essaie('push sans session', async () => {
    reset();
    const r = await appelPush('', { action: 'subscribe', sub: { endpoint: 'https://push.exemple.test/x', keys: {} } });
    dit(r.code === 401 && ecrituresData.length === 0, 'base cloisonnée, sans session → refusé, aucun appareil rangé (il n’atterrit pas chez le propriétaire)', `HTTP ${r.code} · ${ecrituresData.length} écriture(s)`);
  });
  await essaie('push deux vendeurs', async () => {
    reset();
    const ra = await appelPush('aa.bb.A', { action: 'subscribe', sub: { endpoint: 'https://push.exemple.test/A', keys: {} } });
    const rb = await appelPush('aa.bb.B', { action: 'subscribe', sub: { endpoint: 'https://push.exemple.test/B', keys: {} } });
    const la = appData[`${A}|push_subs`], lb = appData[`${B}|push_subs`], lp = appData[`${PROPRIO}|push_subs`];
    dit(ra.code === 200 && rb.code === 200, 'chaque vendeur connecté enregistre son appareil', `A ${ra.code} · B ${rb.code}`);
    dit(la && la.data.subs.length === 1 && la.data.subs[0].endpoint.endsWith('/A') && lb && lb.data.subs[0].endpoint.endsWith('/B') && !lp,
      'le téléphone de A est rangé chez A, celui de B chez B — jamais chez le propriétaire', JSON.stringify(Object.keys(appData)));
  });
  await essaie('push test coupé', async () => {
    reset(); obligatoire = true; avecAppareil(A);
    const r = await appelPush('aa.bb.A', { action: 'test' });
    dit(r.code === 200 && r.corps && r.corps.coupe === 'abonnement', 'le bouton « tester » d’un vendeur qui ne paie plus dit pourquoi rien n’arrive', JSON.stringify(r.corps));
  });

  console.log('\n── Le widget de l’iPhone');
  const appelWidget = async (cle) => { const r = faireRes(); await widget({ method: 'GET', query: { k: cle }, headers: {} }, r); return r; };
  await essaie('widget coupé', async () => {
    reset(); obligatoire = true;
    mains = [{ owner: A, vrm_widget_token: 'cle-widget-A-0123456789' }, { owner: B, vrm_widget_token: 'cle-widget-B-0123456789' }];
    base[B] = { owner: B, statut: 'active' };
    const ra = await appelWidget('cle-widget-A-0123456789');
    const nombres = ra.corps ? Object.values(ra.corps).filter((v) => typeof v === 'number') : [];
    dit(ra.code === 402 && nombres.length === 0, 'A ne paie plus → le widget ne montre AUCUN chiffre', `HTTP ${ra.code} · ${JSON.stringify(ra.corps).slice(0, 100)}`);
    const rb = await appelWidget('cle-widget-B-0123456789');
    dit(rb.code !== 402, 'B paie → son widget répond', `HTTP ${rb.code}`);
  });

  console.log('\n── L’écran lit la règle de la BASE');
  await essaie('accès de la base', async () => {
    reset(); obligatoire = true; delete process.env.VRM_ABONNEMENT_OBLIGATOIRE;
    base[B] = { owner: B, statut: 'active', client_stripe: 'cus_B' };
    const ra = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } }), ra);
    const rb = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.B' } }), rb);
    dit(ra.code === 200 && ra.corps.obligatoire === true && ra.corps.acces === false, 'obligatoire dans la base (aucune variable d’environnement) → A n’a plus accès', JSON.stringify(ra.corps).slice(0, 140));
    dit(rb.code === 200 && rb.corps.acces === true, 'B, abonné, a accès', JSON.stringify(rb.corps).slice(0, 140));
    reset(); panneRpc = true;
    const rp = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } }), rp);
    dit(rp.code === 503, 'la base ne dit pas qui a accès → 503 « pas su » (jamais une réponse devinée)', `HTTP ${rp.code}`);
  });

  console.log('\n── Lire son statut');
  await essaie('statut', async () => {
    reset(); base[B] = { owner: B, statut: 'active', client_stripe: 'cus_B', fin_periode: '2026-11-04T10:00:00.000Z' };
    const ra = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } }), ra);
    dit(ra.code === 200 && ra.corps.actif === false && ra.corps.statut === null, 'A ne voit PAS l’abonnement de B (lecture avec sa propre session)', JSON.stringify(ra.corps).slice(0, 120));
    const rb = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.B' } }), rb);
    dit(rb.code === 200 && rb.corps.actif === true && rb.corps.peutGerer === true, 'B voit son abonnement actif', JSON.stringify(rb.corps).slice(0, 120));
    const rp = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.P' } }), rp);
    dit(rp.code === 200 && rp.corps.proprietaire === true && rp.corps.actif === true, 'le propriétaire est « actif » sans abonnement');
    const rn = faireRes(); await compte(req({ mode: 'abonnement', headers: {} }), rn);
    dit(rn.code === 401, 'sans session : 401');
  });
  await essaie('portail', async () => {
    reset(); const r = faireRes();
    await compte(req({ method: 'POST', mode: 'portail', headers: { authorization: 'Bearer aa.bb.A' } }), r);
    dit(r.code === 404 && !appelsStripe.some((x) => x.chemin === 'billing_portal/sessions'), 'pas d’abonnement : pas de page de gestion (et aucun client Stripe d’un autre)', `HTTP ${r.code}`);
  });
  await essaie('santé', async () => {
    reset(); const r = faireRes(); await compte(req({ mode: 'sante' }), r);
    const valeurs = Object.values(r.corps || {});
    dit(r.code === 200 && valeurs.every((v) => typeof v === 'boolean'), 'la route publique de santé ne rend que des oui/non (aucun secret)', JSON.stringify(r.corps));
  });

  console.log(ko ? `\n${ko} contrôle(s) en échec, ${ok} vert(s).` : `\n✅ abonnement : ${ok} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
