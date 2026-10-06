// ⚠️⚠️ « FERMER MON COMPTE » — L'OPÉRATION LA PLUS DESTRUCTRICE DU SERVEUR, EXÉCUTÉE
//
// La politique de confidentialité promet l'effacement des données à la clôture
// du compte ; aucun bouton ne le faisait (5 octobre). `api/compte.js?mode=fermer`
// efface désormais les données d'un vendeur, puis son compte de connexion.
// §4.10 : une route serveur n'est vérifiée que si on l'EXÉCUTE. Ce contrôle
// charge le VRAI api/compte.js avec une fausse base à DEUX vendeurs, un faux
// stockage, une fausse authentification et un faux Stripe, et prouve :
//   · sans session : 401, rien n'est touché ;
//   · le propriétaire de l'installation est REFUSÉ (variable d'environnement OU
//     ce que dit la base) — c'est sa boutique ;
//   · la confirmation (son adresse email, recopiée) est vérifiée PAR LE SERVEUR ;
//   · chaque suppression porte `owner=eq.<lui>` et rien d'autre : l'autre
//     vendeur reste INTACT (lignes, comptes Vinted, photos, compte) ;
//   · l'abonnement s'arrête AVANT tout effacement, et Stripe muet ⇒ rien n'est
//     effacé (jamais un compte effacé qui serait encore prélevé) ;
//   · un échec à mi-chemin est DIT (ce qui est fait, ce qui ne l'est pas), le
//     compte de connexion est gardé pour pouvoir relancer — jamais « fermé ».
// Aucune donnée réelle : tout est inventé ici.
const path = require('path');
const RACINE = path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const P = '99999999-9999-4999-8999-999999999999';
const JETONS = { 'aa.bb.A': { id: A, email: 'vendeuse.a@exemple.test' }, 'aa.bb.B': { id: B, email: 'b@exemple.test' }, 'aa.bb.P': { id: P, email: 'proprio@exemple.test' } };

let base, deletes, appelsStripe, pannes, proprioRpc;
const reset = () => {
  base = {
    app_data: [{ owner: A, id: 'main' }, { owner: A, id: 'harvest_11_orders_sold' }, { owner: A, id: 'email_bord_1' }, { owner: B, id: 'main' }, { owner: B, id: 'harvest_22_orders_sold' }],
    vinted_accounts: [{ owner: A, vinted_user_id: '11' }, { owner: B, vinted_user_id: '22' }],
    detourage_usage: [{ owner: A, mois: '2026-10' }, { owner: B, mois: '2026-10' }],
    abonnements: { [A]: { statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A' }, [B]: { statut: 'active', client_stripe: 'cus_B', abonnement_stripe: 'sub_B' } },
    stockage: [`${A}/aaa-v1.jpg`, `${A}/bbb-v1.jpg`, `${B}/ccc-v1.jpg`],
    utilisateurs: new Set([A, B, P]),
    subs: { sub_A: { id: 'sub_A', customer: 'cus_A', status: 'active' }, sub_B: { id: 'sub_B', customer: 'cus_B', status: 'active' } },
  };
  deletes = []; appelsStripe = []; pannes = new Set(); proprioRpc = null;
  delete process.env.VRM_OWNER_UID;
};
const rep = (o, status = 200, h = {}) => new Response(o == null ? null : (typeof o === 'string' ? o : JSON.stringify(o)), { status, headers: { 'content-type': 'application/json', ...h } });
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET', h = opts.headers || {};
  const jwt = String(h.Authorization || h.authorization || '').replace(/^Bearer\s+/, '');
  if (u.includes('/auth/v1/user')) return JETONS[jwt] && base.utilisateurs.has(JETONS[jwt].id) ? rep({ ...JETONS[jwt], email_confirmed_at: '2026-10-01T00:00:00Z' }) : rep({ msg: 'invalid' }, 401);
  if (u.includes('/auth/v1/logout')) return pannes.has('logout') ? rep('<html>522</html>', 522) : rep(null, 204);
  if (u.includes('/auth/v1/admin/users/')) {
    if (m !== 'DELETE') return rep({}, 405);
    deletes.push(u);
    if (pannes.has('auth')) return rep('<html>522</html>', 522);
    base.utilisateurs.delete(u.split('/admin/users/')[1]);
    return rep({}, 200);
  }
  if (u.includes('/rest/v1/rpc/vrm_acces')) {
    if (pannes.has('rpc')) return rep('<html>522</html>', 522);
    const qui = JETONS[jwt];
    if (!qui) return rep({ message: 'JWT' }, 401);
    return rep({ obligatoire: false, proprietaire: qui.id === proprioRpc, acces: true });
  }
  if (u.includes('/rest/v1/abonnements')) {
    if (pannes.has('abonnements')) return rep('<html>522</html>', 522);
    const qui = JETONS[jwt];
    return rep(qui && base.abonnements[qui.id] ? [base.abonnements[qui.id]] : []);
  }
  if (u.includes('/storage/v1/object/list/detourage')) {
    const pref = JSON.parse(opts.body).prefix;
    return rep(base.stockage.filter((x) => x.startsWith(pref + '/')).map((x) => ({ name: x.slice(pref.length + 1) })).slice(0, 100));
  }
  if (u.includes('/storage/v1/object/detourage') && m === 'DELETE') {
    const noms = JSON.parse(opts.body).prefixes;
    deletes.push('stockage:' + noms.join(','));
    base.stockage = base.stockage.filter((x) => !noms.includes(x));
    return rep([]);
  }
  const mr = /\/rest\/v1\/(app_data|vinted_accounts|detourage_usage)\?(.*)$/.exec(u);
  if (mr && m === 'DELETE') {
    deletes.push(u);
    if (pannes.has(mr[1])) return rep('<html>522</html>', 522);
    const own = (/(?:^|&)owner=eq\.([^&]+)/.exec(mr[2]) || [])[1];
    // Une suppression sans filtre propriétaire viderait TOUTE la table : la
    // fausse base l'exécute pour de vrai, pour que le contrôle le voie.
    const garde = (l) => own ? l.owner !== own : false;
    const avant = base[mr[1]].length;
    base[mr[1]] = base[mr[1]].filter(garde);
    return rep(null, 204, { 'content-range': `*/${avant - base[mr[1]].length}` });
  }
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
    appelsStripe.push({ m, chemin, corps: String(opts.body || '') });
    if (pannes.has('stripe')) return rep({ error: { message: 'panne' } }, 500);
    const id = chemin.split('/')[1];
    const s = base.subs[id];
    if (!s) return rep({ error: { message: 'inconnu' } }, 404);
    if (m === 'POST' && /cancel_at_period_end=true/.test(String(opts.body))) s.cancel_at_period_end = true;
    if (m === 'DELETE') s.status = 'canceled';
    return rep(s);
  }
  return rep({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const req = (jeton, corps, method = 'POST') => {
  const buf = corps == null ? null : Buffer.from(JSON.stringify(corps), 'utf8');
  return { method, query: { mode: 'fermer' }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
const intactB = () => base.app_data.filter((l) => l.owner === B).length === 2 && base.vinted_accounts.some((l) => l.owner === B)
  && base.detourage_usage.some((l) => l.owner === B) && base.stockage.includes(`${B}/ccc-v1.jpg`) && base.utilisateurs.has(B) && !base.subs.sub_B.cancel_at_period_end;
const rienTouche = () => deletes.length === 0 && !appelsStripe.some((x) => x.m !== 'GET');

(async () => {
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); console.log(`\n${ko} en échec`); process.exit(1); }
  const fermer = async (jeton, corps, method) => { const r = faireRes(); await compte(req(jeton, corps, method), r); return r; };

  console.log('── Qui peut fermer, et quoi');
  await essaie('sans session', async () => {
    reset(); const r = await fermer(null, { confirmation: 'vendeuse.a@exemple.test' });
    dit(r.code === 401 && rienTouche(), 'sans session : 401, rien n’est touché', `HTTP ${r.code}`);
  });
  await essaie('GET', async () => {
    reset(); const r = await fermer('aa.bb.A', null, 'GET');
    dit(r.code === 405 && rienTouche(), 'en GET : refusé (une fermeture ne part jamais d’un simple lien)', `HTTP ${r.code}`);
  });
  await essaie('mauvaise confirmation', async () => {
    reset(); const r = await fermer('aa.bb.A', { confirmation: 'b@exemple.test' });
    dit(r.code === 400 && rienTouche() && base.utilisateurs.has(A), 'confirmation fausse (l’adresse d’un autre) : 400, rien n’est touché', `HTTP ${r.code}`);
    reset(); const r2 = await fermer('aa.bb.A', {});
    dit(r2.code === 400 && rienTouche(), 'confirmation absente : 400, rien n’est touché (la case de l’écran ne suffit pas)', `HTTP ${r2.code}`);
  });
  await essaie('propriétaire env', async () => {
    reset(); process.env.VRM_OWNER_UID = P;
    const r = await fermer('aa.bb.P', { confirmation: 'proprio@exemple.test' });
    dit(r.code === 403 && rienTouche() && appelsStripe.length === 0, 'le propriétaire de l’installation (VRM_OWNER_UID) : REFUSÉ, rien n’est touché', `HTTP ${r.code} · ${r.corps && r.corps.erreur}`);
  });
  await essaie('propriétaire base', async () => {
    reset(); proprioRpc = P;
    const r = await fermer('aa.bb.P', { confirmation: 'proprio@exemple.test' });
    dit(r.code === 403 && rienTouche(), '… et quand c’est la BASE qui le dit (vrm_reglages), refusé aussi', `HTTP ${r.code}`);
  });
  await essaie('propriété pas sue', async () => {
    reset(); pannes.add('rpc');
    const r = await fermer('aa.bb.A', { confirmation: 'vendeuse.a@exemple.test' });
    dit(r.code === 503 && rienTouche(), 'la base ne dit pas s’il est le propriétaire : refus (« pas su » n’efface rien)', `HTTP ${r.code}`);
  });

  console.log('\n── La fermeture : SES données, et seulement les siennes');
  await essaie('fermeture A', async () => {
    reset();
    const r = await fermer('aa.bb.A', { confirmation: '  Vendeuse.A@Exemple.test ' });
    dit(r.code === 200 && r.corps && r.corps.ok === true, 'A ferme son compte : 200, ok', `HTTP ${r.code} · ${r.corps && r.corps.message}`);
    dit(!base.app_data.some((l) => l.owner === A) && !base.vinted_accounts.some((l) => l.owner === A) && !base.detourage_usage.some((l) => l.owner === A), 'ses données, ses comptes Vinted et ses compteurs sont effacés');
    dit(!base.stockage.some((x) => x.startsWith(A + '/')), 'ses photos détourées sont effacées');
    dit(!base.utilisateurs.has(A), 'son compte de connexion est supprimé, EN DERNIER');
    dit(intactB(), 'l’autre vendeur est INTACT (lignes, comptes Vinted, compteurs, photos, compte, abonnement)');
    const rest = deletes.filter((x) => x.includes('/rest/v1/'));
    dit(rest.length === 3 && rest.every((x) => new RegExp(`/rest/v1/(app_data|vinted_accounts|detourage_usage)\\?owner=eq\\.${A}$`).test(x)), 'chaque suppression porte owner=eq.<lui> et RIEN d’autre', rest.map((x) => x.split('/rest/v1/')[1]).join(' · '));
    const ordre = deletes.map((x) => x.includes('admin/users') ? 'auth' : x.startsWith('stockage') ? 'photos' : x.split('/rest/v1/')[1].split('?')[0]);
    dit(ordre[ordre.length - 1] === 'auth' && ordre.indexOf('app_data') < ordre.indexOf('auth'), 'ordre : données, puis comptes, puis photos, puis le compte de connexion', ordre.join(' → '));
    const res = appelsStripe.find((x) => x.m === 'POST');
    dit(!!res && /cancel_at_period_end=true/.test(res.corps) && base.subs.sub_A.cancel_at_period_end, 'l’abonnement est résilié à la fin de la période payée (aucun nouveau prélèvement)');
    dit(/abonnement résilié/.test(r.corps.message) && !/INCOMPL/i.test(r.corps.message), 'le message dit ce qui a été fait', r.corps.message);
  });
  await essaie('impayé', async () => {
    reset(); base.abonnements[A].statut = 'past_due'; base.subs.sub_A.status = 'past_due';
    const r = await fermer('aa.bb.A', { confirmation: 'vendeuse.a@exemple.test' });
    dit(r.code === 200 && appelsStripe.some((x) => x.m === 'DELETE' && x.chemin === 'subscriptions/sub_A') && base.subs.sub_A.status === 'canceled', 'abonnement en IMPAYÉ : arrêté tout de suite (Stripe ne retentera plus la carte d’un compte fermé)');
  });
  await essaie('sans abonnement', async () => {
    reset(); delete base.abonnements[A];
    const r = await fermer('aa.bb.A', { confirmation: 'vendeuse.a@exemple.test' });
    dit(r.code === 200 && !appelsStripe.length && !base.utilisateurs.has(A), 'jamais abonné : fermé, Stripe n’est même pas appelé');
  });

  console.log('\n── Un échec n’est jamais présenté comme une fermeture');
  await essaie('stripe muet', async () => {
    reset(); pannes.add('stripe');
    const r = await fermer('aa.bb.A', { confirmation: 'vendeuse.a@exemple.test' });
    dit(r.code >= 500 && deletes.length === 0 && base.utilisateurs.has(A), 'Stripe ne répond pas : RIEN n’est effacé (on n’efface pas un compte encore prélevé)', `HTTP ${r.code}`);
  });
  await essaie('abonnement illisible', async () => {
    reset(); pannes.add('abonnements');
    const r = await fermer('aa.bb.A', { confirmation: 'vendeuse.a@exemple.test' });
    dit(r.code === 503 && deletes.length === 0, 'abonnement illisible : rien n’est effacé (pas su s’il paie encore)', `HTTP ${r.code}`);
  });
  await essaie('comptes vinted ratés', async () => {
    reset(); pannes.add('vinted_accounts');
    const r = await fermer('aa.bb.A', { confirmation: 'vendeuse.a@exemple.test' });
    const c = r.corps || {};
    dit(r.code >= 500 && c.ok === false, 'les comptes Vinted ne s’effacent pas : réponse en échec (ok:false)', `HTTP ${r.code}`);
    dit(base.utilisateurs.has(A), '… et son compte de connexion est GARDÉ (il peut se reconnecter et relancer)');
    dit(/INCOMPL/i.test(c.message || '') && /comptes Vinted/.test(c.message || '') && /données effacées/.test(c.message || ''), '… et le message dit ce qui est fait ET ce qui ne l’est pas', c.message);
    dit(intactB(), '… l’autre vendeur reste intact');
  });
  await essaie('compte de connexion raté', async () => {
    reset(); pannes.add('auth');
    const r = await fermer('aa.bb.A', { confirmation: 'vendeuse.a@exemple.test' });
    const c = r.corps || {};
    dit(c.ok === false && r.code >= 500 && /compte de connexion/.test(c.message || '') && !/est fermé/.test(c.message || ''), 'le compte de connexion ne se supprime pas : jamais « compte fermé »', c.message);
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
