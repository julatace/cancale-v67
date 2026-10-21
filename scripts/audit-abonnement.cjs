// Audit : l'abonnement Stripe ne se contourne pas, ne se perd pas, et ne fait
// jamais payer le propriétaire (api/compte.js, demande du 4 octobre :
// « 9,99 € par mois pour tout le monde sauf moi » — 12,99 € depuis le
// 11 octobre, décision de Julien après l'étude des coûts).
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
let base, ecritures, appelsStripe, panneEcriture, fkInconnue, obligatoire, panneRpc, appData, lecturesSubs, ecrituresData, mains, subsStripe, facturesStripe, panneFactures, prixStripe;
// Le prix rangé chez Stripe sous `vrm_mensuel`, tel que Stripe le rend (centimes
// entiers). Par défaut : celui des CGV (12,99 € par mois).
const PRIX_STRIPE_CGV = { id: 'price_banc', unit_amount: 1299, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } };
const reset = () => {
  base = {}; ecritures = []; appelsStripe = []; panneEcriture = false; fkInconnue = false; prixStripe = PRIX_STRIPE_CGV;
  subsStripe = {}; facturesStripe = []; panneFactures = false;
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
      // §6.3 : servir la FORME que PostgREST rend. Avec `return=representation`
      // il rend les lignes réellement écrites (et `ignore-duplicates` n'écrase
      // pas une ligne existante : rien n'est rendu pour elle). `push_subs`
      // s'écrit ainsi depuis le 11 octobre (écriture conditionnelle).
      const prefer = String(h.Prefer || h.prefer || '');
      const rendus = [];
      for (const l of JSON.parse(opts.body)) {
        const cle = `${l.owner || ''}|${l.id}`;
        if (/ignore-duplicates/.test(prefer) && appData[cle]) continue;
        ecrituresData.push({ url: u, ...l }); appData[cle] = l; rendus.push(l);
      }
      return /return=representation/.test(prefer) ? rep(rendus, 201) : rep('', 201);
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
    if (chemin === 'prices') return prixStripe === 'panne' ? rep({ error: { message: 'panne' } }, 500) : rep({ data: prixStripe ? [prixStripe] : [] });
    if (chemin === 'checkout/sessions') return rep({ id: 'cs_banc', url: 'https://checkout.stripe.com/c/pay/cs_banc' });
    if (chemin === 'billing_portal/sessions') return rep({ url: 'https://billing.stripe.com/p/session/banc' });
    // ⚠️ Le faux Stripe rend TOUTES les factures qu'on lui a données, quel que
    //    soit le client demandé : c'est le serveur qui doit ne garder que celles
    //    de SON client (une défense, pas une confiance).
    if (chemin === 'invoices') return panneFactures ? rep({ error: { message: 'panne' } }, 500) : rep({ object: 'list', data: facturesStripe });
    if (chemin.startsWith('customers/')) return rep({ id: chemin.split('/')[1], invoice_settings: { default_payment_method: { card: { brand: 'mastercard', last4: '5555', exp_month: 1, exp_year: 2030 } } } });
    if (chemin.startsWith('subscriptions/')) {
      const id = chemin.split('/')[1];
      if (subsStripe[id] === 'panne') return rep({ error: { message: 'panne' } }, 500);
      if (subsStripe[id]) {
        if (m === 'POST') {
          const p = new URLSearchParams(opts.body || '');
          if (p.has('cancel_at_period_end')) subsStripe[id] = { ...subsStripe[id], cancel_at_period_end: p.get('cancel_at_period_end') === 'true' };
        }
        return rep(subsStripe[id]);
      }
      return rep({ id, status: 'active', customer: 'cus_A', metadata: { owner: A }, items: { data: [{ current_period_end: 1800000000 }] } });
    }
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
    const q = req({ method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer aa.bb.A', origin: 'https://site-pirate.example' }, corps: JSON.stringify({ cgv: true, owner: B, client_reference_id: B }) });
    q.body = { cgv: true, owner: B, client_reference_id: B };
    await compte(q, r);
    const s = appelsStripe.find((x) => x.chemin === 'checkout/sessions');
    const corps = decodeURIComponent((s && s.corps) || '');
    dit(r.code === 200 && r.corps && /checkout\.stripe\.com/.test(r.corps.url), 'un vendeur connecté obtient une page de paiement Stripe', `HTTP ${r.code}`);
    dit(/client_reference_id=11111111-1111-4111-8111-111111111111/.test(corps) && /subscription_data\[metadata\]\[owner\]=11111111/.test(corps) && !/22222222/.test(corps),
      'l’abonnement est rattaché au vendeur PROUVÉ par sa session — jamais à un identifiant envoyé par le navigateur', corps.slice(0, 160));
    dit(/success_url=https:\/\/vrm\.center\//.test(corps) && !/site-pirate/.test(corps), 'l’adresse de retour est fixe (jamais l’origine de la requête)');
    dit(/price\]=price_banc/.test(corps) && /mode=subscription/.test(corps), 'abonnement au prix de la clé vrm_mensuel (12,99 €/mois, celui des CGV)');
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

  // ⚠️⚠️ 11 OCTOBRE : 12,99 € (décision de Julien). Les CGV le disent ; le prix
  //    PRÉLEVÉ est celui rangé chez Stripe sous `vrm_mensuel`, que seul Julien
  //    recrée dans son tableau de bord. Tant qu'il ne l'a pas fait, Stripe
  //    facturerait 9,99 € à quelqu'un qui vient d'accepter des CGV à 12,99 €.
  //    La donnée déclenche (le montant que Stripe RENVOIE), jamais une phrase.
  console.log('\n── Le prix facturé est celui des CGV, sinon le paiement reste fermé');
  const payer = async () => {
    const r = faireRes();
    const q = req({ method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer aa.bb.A' }, corps: JSON.stringify({ cgv: true }) });
    q.body = { cgv: true };
    await compte(q, r);
    return { r, session: appelsStripe.some((x) => x.chemin === 'checkout/sessions') };
  };
  // Le texte des CGV tel que l'APP l'écrit (PRIX_CGV_LISIBLE) : c'est contre lui
  // que le propriétaire compare le prix de Stripe — on le lit dans le source, on
  // ne le recopie pas (audit-lancement vérifie qu'il est celui des CGV).
  const PRIX_CGV_APP = (/const PRIX_CGV_LISIBLE\s*=\s*'([^']+)'/.exec(require('./_source-app.cjs')(path.join(RACINE, 'src', 'App.jsx'))) || [])[1] || '';
  const avecWarn = async (f) => {
    const vu = [], av = console.warn;
    console.warn = (...a) => { vu.push(a.map(String).join(' ')); };
    try { return { res: await f(), warn: vu.join('\n') }; } finally { console.warn = av; }
  };
  await essaie('prix 9,99 chez Stripe', async () => {
    reset(); prixStripe = { ...PRIX_STRIPE_CGV, unit_amount: 999 };
    const { res: { r, session }, warn } = await avecWarn(payer);
    const m = (r.corps && r.corps.message) || '';
    dit(r.code === 503 && r.corps && r.corps.erreur === 'prix-cgv' && !session,
      'Stripe dit encore 9,99 € (prix pas recréé) : le paiement ne s’ouvre PAS, aucune session Stripe', `HTTP ${r.code} · ${r.corps && r.corps.erreur} · session ${session}`);
    // ⚠️ Revue du 11 octobre : ce refus ne part qu'à un VENDEUR (le propriétaire
    //    a eu 409 avant) — il ne nomme donc PAS le montant réglé chez Stripe. Il
    //    disait « le prix réglé chez Stripe (9,99 € / mois)… » sous le bouton.
    dit(!/\d+,\d{2}/.test(m) && /rien n'a été prélevé/i.test(m) && /pas encore ouvert/i.test(m),
      '  le vendeur lit « pas encore ouvert, rien n’a été prélevé » — sans le montant réglé chez Stripe (ni aucun montant)', m);
    dit(/9,99 € \/ mois/.test(warn) && warn.includes('≠ CGV ' + PRIX_CGV_APP) && /vrm_mensuel/.test(warn),
      '  le détail (les deux prix, le geste) reste dans les journaux du serveur', warn.slice(0, 200));
  });
  for (const [nom, prix] of [
    ['en dollars', { ...PRIX_STRIPE_CGV, currency: 'usd' }],
    ['par an', { ...PRIX_STRIPE_CGV, recurring: { interval: 'year', interval_count: 1 } }],
    ['tous les 3 mois', { ...PRIX_STRIPE_CGV, recurring: { interval: 'month', interval_count: 3 } }],
    ['sans montant unitaire (prix par paliers)', { ...PRIX_STRIPE_CGV, unit_amount: null, billing_scheme: 'tiered' }],
    ['ponctuel (pas un abonnement)', { id: 'price_banc', unit_amount: 1299, currency: 'eur', type: 'one_time' }],
  ]) {
    await essaie('prix ' + nom, async () => {
      reset(); prixStripe = prix;
      const { r, session } = await payer();
      dit(r.code === 503 && r.corps && r.corps.erreur === 'prix-cgv' && !session, `12,99 ${nom} : pas le prix des CGV → paiement fermé`, `HTTP ${r.code} · session ${session}`);
    });
  }
  await essaie('prix conforme', async () => {
    reset();
    const { r, session } = await payer();
    dit(r.code === 200 && session && /checkout\.stripe\.com/.test((r.corps && r.corps.url) || ''), 'l’autre sens : 12,99 € par mois en euros → le paiement s’ouvre', `HTTP ${r.code}`);
  });
  await essaie('carte : prix relayé seulement s’il est celui des CGV', async () => {
    reset(); prixStripe = { ...PRIX_STRIPE_CGV, unit_amount: 999 };
    const ra = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } }), ra);
    dit(ra.code === 200 && ra.corps.prix === null && ra.corps.prixConforme === false && ra.corps.prixStripe === null,
      'Stripe à 9,99 € : la carte ne relaie PAS ce prix (l’app dirait 9,99 € à côté de CGV à 12,99 €), dit « pas conforme », et ne montre le montant Stripe qu’au propriétaire', JSON.stringify({ prix: ra.corps.prix, prixConforme: ra.corps.prixConforme, prixStripe: ra.corps.prixStripe }));
    const rp = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.P' } }), rp);
    dit(rp.code === 200 && rp.corps.prixConforme === false && rp.corps.prixStripe && rp.corps.prixStripe.montant === 9.99,
      '  le propriétaire, lui, reçoit le montant réglé chez Stripe (c’est lui qui le corrige)', JSON.stringify(rp.corps.prixStripe));
    reset();
    const rb = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.A' } }), rb);
    dit(rb.code === 200 && rb.corps.prix && rb.corps.prix.montant === 12.99 && rb.corps.prixConforme === true && rb.corps.prixStripe === null,
      '  Stripe à 12,99 € : le prix est relayé, « conforme »', JSON.stringify({ prix: rb.corps.prix, prixConforme: rb.corps.prixConforme }));
    reset(); prixStripe = 'panne';
    const rn = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.P' } }), rn);
    dit(rn.code === 200 && rn.corps.prix === null && rn.corps.prixConforme === null && rn.corps.prixStripe === null,
      '  Stripe muet : « pas su » (null) — jamais « pas conforme »', JSON.stringify({ prix: rn.corps.prix, prixConforme: rn.corps.prixConforme }));
  });

  // ⚠️⚠️ REVUE DU 11 OCTOBRE : l'alerte du propriétaire sert à guider SON geste
  //    dans Stripe. L'app reformatait le prix en ignorant la devise et le rythme :
  //    « 12,99 € / mois n'est pas 12,99 € / mois » pour un prix en dollars, tous
  //    les 3 mois ou par semaine, et « 0,00 € » pour un prix sans montant fixe.
  //    Le serveur rend le TEXTE (`prixStripe.texte`) et l'app l'affiche tel quel.
  //    La règle : un prix non conforme ne s'écrit JAMAIS comme celui des CGV, et
  //    n'invente aucun montant.
  console.log('\n── Le propriétaire lit le vrai prix de Stripe (montant, devise, rythme)');
  await essaie('prixTexte des CGV', async () => {
    const mod = await import('file://' + path.join(RACINE, 'api', 'compte.js'));
    const t = typeof mod.prixTexte === 'function' ? mod.prixTexte(mod.PRIX_CGV) : null;
    dit(!!PRIX_CGV_APP && t === PRIX_CGV_APP, 'le prix des CGV s’écrit côté serveur exactement comme dans l’app', `serveur « ${t} » · app « ${PRIX_CGV_APP} »`);
  });
  for (const [nom, prix, attendu] of [
    ['9,99 € par mois', { ...PRIX_STRIPE_CGV, unit_amount: 999 }, /^9,99 € \/ mois$/],
    ['en dollars', { ...PRIX_STRIPE_CGV, currency: 'usd' }, /USD/],
    ['tous les 3 mois', { ...PRIX_STRIPE_CGV, recurring: { interval: 'month', interval_count: 3 } }, /tous les 3 mois/],
    ['par semaine', { ...PRIX_STRIPE_CGV, recurring: { interval: 'week', interval_count: 1 } }, /semaine/],
    ['par jour', { ...PRIX_STRIPE_CGV, recurring: { interval: 'day', interval_count: 1 } }, /jour/],
    ['par an', { ...PRIX_STRIPE_CGV, recurring: { interval: 'year', interval_count: 1 } }, /\/ an$/],
    ['sans montant unitaire (paliers)', { ...PRIX_STRIPE_CGV, unit_amount: null, billing_scheme: 'tiered' }, /sans montant fixe/],
    ['ponctuel', { id: 'price_banc', unit_amount: 1299, currency: 'eur', type: 'one_time' }, /en une fois/],
  ]) {
    await essaie('texte ' + nom, async () => {
      reset(); prixStripe = prix;
      const rp = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer aa.bb.P' } }), rp);
      const t = rp.corps && rp.corps.prixStripe && rp.corps.prixStripe.texte;
      dit(rp.code === 200 && rp.corps.prixConforme === false && typeof t === 'string' && t !== PRIX_CGV_APP && attendu.test(t) && !/0,00|\?/.test(t),
        `prix Stripe ${nom} : le texte rendu au propriétaire diffère de celui des CGV, et le dit`, `« ${t} »`);
      if (nom === 'sans montant unitaire (paliers)') dit(rp.corps.prixStripe && rp.corps.prixStripe.montant === null, '  sans montant unitaire : montant `null` (pas su), jamais 0', JSON.stringify(rp.corps.prixStripe));
    });
  }

  // ⚠️ REVUE DU 11 OCTOBRE : un abonnement Stripe garde le prix auquel il a été
  //    souscrit. La carte « Abonné · … » disait le prix de l'OFFRE (ou, quand le
  //    serveur ne le relayait pas, celui des CGV) — 12,99 € au-dessus de
  //    factures à 9,99 €. Le serveur lit le prix de SON abonnement.
  console.log('\n── Le prix de SON abonnement, pas celui de l’offre du moment');
  const SUB_A = (prixArticle, extra = {}) => ({ id: 'sub_A', status: 'active', customer: 'cus_A', metadata: { owner: A }, items: { data: [{ current_period_end: 1800000000, quantity: 1, price: prixArticle }] }, ...extra });
  const aboDe = async (jwt) => { const r = faireRes(); await compte(req({ mode: 'abonnement', headers: { authorization: 'Bearer ' + jwt } }), r); return r; };
  await essaie('prix de son abonnement', async () => {
    reset(); base[A] = { owner: A, statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A' };
    subsStripe.sub_A = SUB_A({ id: 'price_ancien', unit_amount: 999, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } });
    const r = await aboDe('aa.bb.A');
    dit(r.code === 200 && r.corps.prixAbonnement && r.corps.prixAbonnement.texte === '9,99 € / mois' && r.corps.prix && r.corps.prix.montant === 12.99,
      'abonné à 9,99 € quand l’offre est à 12,99 € : `prixAbonnement` dit 9,99 € (le prix qu’il paie), `prix` reste celui de l’offre', JSON.stringify({ prixAbonnement: r.corps.prixAbonnement, prix: r.corps.prix }));
    reset(); base[A] = { owner: A, statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A' };
    subsStripe.sub_A = SUB_A({ id: 'price_ancien', unit_amount: 999, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } });
    prixStripe = { ...PRIX_STRIPE_CGV, unit_amount: 999 };
    const r2 = await aboDe('aa.bb.A');
    dit(r2.code === 200 && r2.corps.prix === null && r2.corps.prixConforme === false && r2.corps.prixAbonnement && r2.corps.prixAbonnement.texte === '9,99 € / mois',
      '  pendant la transition (offre ≠ CGV) : le prix de l’offre n’est pas relayé, celui de SON abonnement si', JSON.stringify({ prix: r2.corps.prix, prixAbonnement: r2.corps.prixAbonnement }));
  });
  for (const [nom, prep] of [
    ['abonnement d’un AUTRE client Stripe', () => { subsStripe.sub_A = SUB_A({ unit_amount: 999, currency: 'eur', recurring: { interval: 'month' } }, { customer: 'cus_autre' }); }],
    ['Stripe muet sur l’abonnement', () => { subsStripe.sub_A = 'panne'; }],
    ['deux articles (on ne choisit pas)', () => { subsStripe.sub_A = SUB_A(null, { items: { data: [{ quantity: 1, price: { unit_amount: 999, currency: 'eur', recurring: { interval: 'month' } } }, { quantity: 1, price: { unit_amount: 300, currency: 'eur', recurring: { interval: 'month' } } }] } }); }],
  ]) {
    await essaie('prixAbonnement ' + nom, async () => {
      reset(); base[A] = { owner: A, statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A' }; prep();
      const r = await aboDe('aa.bb.A');
      dit(r.code === 200 && r.corps.prixAbonnement === null && r.corps.actif === true, `${nom} : « pas su » (null) — la carte dira « Abonné » sans montant, jamais un prix deviné`, `HTTP ${r.code} · ${JSON.stringify(r.corps.prixAbonnement)}`);
    });
  }
  await essaie('prixAbonnement résilié', async () => {
    reset(); base[A] = { owner: A, statut: 'canceled', client_stripe: 'cus_A', abonnement_stripe: 'sub_A' };
    const r = await aboDe('aa.bb.A');
    dit(r.code === 200 && r.corps.prixAbonnement === null && !appelsStripe.some((x) => x.chemin.startsWith('subscriptions/')),
      'abonnement terminé : aucun prix d’abonnement, et Stripe n’est pas interrogé pour rien', JSON.stringify(appelsStripe.map((x) => x.chemin)));
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

  console.log('\n── L’assistant IA : la clé du serveur se paie');
  const ia = (await charge('api/ai.js')).default;
  const appelIa = async (jeton) => { const r = faireRes(); await ia({ method: 'POST', query: {}, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body: { title: 'Nike', brand: 'Nike' } }, r); return r; };
  await essaie('ia', async () => {
    reset(); process.env.AI_API_KEY = 'cle-ia-banc';
    const sans = await appelIa('');
    dit(sans.code === 401, 'sans session, la clé IA du serveur ne sert à personne', `HTTP ${sans.code}`);
    obligatoire = true;
    const coupe = await appelIa('aa.bb.A');
    dit(coupe.code === 402, 'un vendeur qui ne paie plus ne s’en sert plus non plus', `HTTP ${coupe.code}`);
    obligatoire = false; if (oublierAcces) oublierAcces();   // la mémoire d'une minute du serveur
    const avec = await appelIa('aa.bb.A');
    dit(avec.code !== 401 && avec.code !== 402, 'autre sens : un vendeur connecté s’en sert', `HTTP ${avec.code}`);
    delete process.env.AI_API_KEY;
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

  console.log('\n── Mon compte : SES factures, SA carte, résilier / reprendre');
  const abonneA = () => {
    base[A] = { owner: A, statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A', fin_periode: '2026-11-04T10:00:00.000Z', annule_fin_periode: false };
    subsStripe.sub_A = { id: 'sub_A', object: 'subscription', status: 'active', customer: 'cus_A', livemode: false, cancel_at_period_end: false, metadata: { owner: A },
      default_payment_method: { card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027 } }, items: { data: [{ current_period_end: 1800000000 }] } };
    subsStripe.sub_B = { id: 'sub_B', object: 'subscription', status: 'active', customer: 'cus_B', livemode: false, cancel_at_period_end: false, metadata: { owner: B }, items: { data: [{ current_period_end: 1800000000 }] } };
    facturesStripe = [
      { id: 'in_1', customer: 'cus_A', status: 'paid', total: 1299, currency: 'eur', created: 1791100000, number: 'VRM-1', invoice_pdf: 'https://pay.stripe.com/invoice/x/pdf', hosted_invoice_url: 'https://invoice.stripe.com/i/x' },
      { id: 'in_B', customer: 'cus_B', status: 'paid', total: 1299, currency: 'eur', created: 1791100000, invoice_pdf: 'https://pay.stripe.com/invoice/b/pdf' },
      { id: 'in_brouillon', customer: 'cus_A', status: 'draft', total: 1299, currency: 'eur', created: 1791200000 },
      { id: 'in_lien', customer: 'cus_A', status: 'paid', total: 1299, currency: 'eur', created: 1788500000, invoice_pdf: 'https://site-pirate.example/f.pdf', hosted_invoice_url: 'javascript:alert(1)' },
    ];
  };
  await essaie('factures', async () => {
    reset(); abonneA();
    const r = faireRes(); await compte(req({ mode: 'factures', headers: { authorization: 'Bearer aa.bb.A' } }), r);
    const ids = r.corps && Array.isArray(r.corps.factures) ? r.corps.factures.map((f) => f.id) : null;
    dit(r.code === 200 && ids && ids.join(',') === 'in_1,in_lien', 'A reçoit SES factures — jamais celle d’un autre client, jamais un brouillon', `HTTP ${r.code} · ${JSON.stringify(ids)}`);
    const appel = appelsStripe.find((x) => x.chemin === 'invoices');
    dit(appel && /customer=cus_A/.test(appel.corps), '  Stripe est interrogé avec le client lu dans SA ligne (pas un paramètre du navigateur)', appel && appel.corps);
    const f1 = ids && r.corps.factures[0], f2 = ids && r.corps.factures[1];
    dit(f1 && f1.montant === 12.99 && f1.pdf === 'https://pay.stripe.com/invoice/x/pdf' && f1.statut === 'paid', '  montant (12,99, pas 1299), statut et PDF Stripe', JSON.stringify(f1));
    dit(f2 && f2.pdf === null && f2.page === null, '  un lien qui ne mène pas chez Stripe n’est jamais transmis', JSON.stringify(f2));
    dit(r.corps && r.corps.carte && r.corps.carte.fin === '4242' && r.corps.carte.marque === 'visa', '  la carte de l’abonnement (marque, 4 derniers chiffres)', JSON.stringify(r.corps && r.corps.carte));
  });
  await essaie('factures sans abonnement', async () => {
    reset(); abonneA();
    const r = faireRes(); await compte(req({ mode: 'factures', headers: { authorization: 'Bearer aa.bb.B' } }), r);
    dit(r.code === 200 && r.corps.factures.length === 0 && !appelsStripe.some((x) => x.chemin === 'invoices'), 'B, jamais abonné : aucune facture, et Stripe n’est même pas interrogé (rien de A ne fuit)', `HTTP ${r.code} · ${JSON.stringify(r.corps)}`);
    const rn = faireRes(); await compte(req({ mode: 'factures', headers: {} }), rn);
    dit(rn.code === 401, '  sans session : 401');
  });
  await essaie('factures illisibles', async () => {
    reset(); abonneA(); panneFactures = true;
    const r = faireRes(); await compte(req({ mode: 'factures', headers: { authorization: 'Bearer aa.bb.A' } }), r);
    dit(r.code >= 500 && !(r.corps && Array.isArray(r.corps.factures)), 'Stripe ne répond pas → une erreur, JAMAIS « aucune facture »', `HTTP ${r.code}`);
  });
  await essaie('résilier', async () => {
    reset(); abonneA();
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'resilier', headers: { authorization: 'Bearer aa.bb.A' } }), r);
    const post = appelsStripe.find((x) => x.m === 'POST' && x.chemin === 'subscriptions/sub_A');
    dit(r.code === 200 && r.corps.annuleFinPeriode === true && post && /cancel_at_period_end=true/.test(post.corps), 'résilier : à la FIN de la période (cancel_at_period_end), jamais une coupure immédiate', `HTTP ${r.code} · ${post && post.corps}`);
    dit(base[A].annule_fin_periode === true, '  la ligne est mise à jour tout de suite (l’écran rouvert dit « résilié »)', JSON.stringify(base[A]));
    const r2 = faireRes(); await compte(req({ method: 'POST', mode: 'reprendre', headers: { authorization: 'Bearer aa.bb.A' } }), r2);
    dit(r2.code === 200 && r2.corps.annuleFinPeriode === false && subsStripe.sub_A.cancel_at_period_end === false, 'reprendre : la résiliation est annulée', `HTTP ${r2.code}`);
  });
  await essaie('résilier un abonnement qui n’est pas le sien', async () => {
    reset(); abonneA(); base[A].abonnement_stripe = 'sub_B';
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'resilier', headers: { authorization: 'Bearer aa.bb.A' } }), r);
    dit(r.code === 403 && !appelsStripe.some((x) => x.m === 'POST' && x.chemin.startsWith('subscriptions/')), 'un abonnement qui appartient à un autre client Stripe n’est JAMAIS modifié', `HTTP ${r.code}`);
  });
  await essaie('résilier sans abonnement', async () => {
    reset(); abonneA();
    const r = faireRes(); await compte(req({ method: 'POST', mode: 'resilier', headers: { authorization: 'Bearer aa.bb.B' } }), r);
    dit(r.code === 404 && !appelsStripe.some((x) => x.m === 'POST'), 'rien à résilier → 404, rien n’est envoyé à Stripe', `HTTP ${r.code}`);
    const rn = faireRes(); await compte(req({ method: 'POST', mode: 'resilier', headers: {} }), rn);
    dit(rn.code === 401, '  sans session : 401');
    const rg = faireRes(); await compte(req({ method: 'GET', mode: 'resilier', headers: { authorization: 'Bearer aa.bb.A' } }), rg);
    dit(rg.code === 405, '  un simple lien (GET) ne résilie jamais', `HTTP ${rg.code}`);
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
