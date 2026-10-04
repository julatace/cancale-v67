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
//   · l'adresse de retour du paiement ne vient jamais de la requête.
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
let base, ecritures, appelsStripe, panneEcriture, fkInconnue;
const reset = () => { base = {}; ecritures = []; appelsStripe = []; panneEcriture = false; fkInconnue = false; };
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
  if (u.includes('/auth/v1/user')) {
    const j = String(h.Authorization || '').replace('Bearer ', '');
    return JETONS[j] ? rep(JETONS[j]) : rep({ msg: 'invalid' }, 401);
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
