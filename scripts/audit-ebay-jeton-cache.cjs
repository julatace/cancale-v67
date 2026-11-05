#!/usr/bin/env node
// ── audit-ebay-jeton-cache — LE JETON D'ACCÈS eBay GARDÉ (2 nov., audit P9) ──
// Exécute le VRAI `accessToken` d'api/_lib/ebay.js contre une fausse base À ÉTAT
// (ce qui est écrit se relit) et un faux eBay qui COMPTE les échanges OAuth.
// Exige :
//   1. deux gestes de suite ⇒ UN seul échange chez eBay (le second réutilise) ;
//   2. jeton à moins de 5 min de sa fin ⇒ redemandé ;
//   3. refresh_token changé (reconnexion) ⇒ le jeton gardé n'est jamais servi ;
//   4. lecture de la base ratée ⇒ pas de cache, on redemande (jamais un faux jeton) ;
//   5. déconnexion ⇒ le jeton gardé est effacé ;
//   6. le jeton ne vit que sous `ebay_tokens…` (garde d'écriture de la base, 014).
//   node scripts/audit-ebay-jeton-cache.cjs [--racine copie]
const path = require('path');
const argv = process.argv;
const R = argv.includes('--racine') ? path.resolve(argv[argv.indexOf('--racine') + 1]) : path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const OWNER = '00000000-0000-4000-8000-0000000000aa';

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'cle-de-banc';
process.env.EBAY_APP_ID = process.env.EBAY_APP_ID || 'app';
process.env.EBAY_CERT_ID = process.env.EBAY_CERT_ID || 'cert';

const base = new Map();     // id → data
let lectureKO = false;
let oauth = 0, n = 0;
const rep = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  if (/oauth2\/token/.test(u)) { oauth++; n++; return rep(200, { access_token: 'jeton-' + n, expires_in: 7200 }); }
  if (/\/rest\/v1\/app_data/.test(u)) {
    if ((opts.method || 'GET') === 'POST') {
      for (const r of JSON.parse(opts.body)) base.set(r.id, r.data);
      return rep(201, null);
    }
    if (lectureKO) return rep(503, { message: 'base' });
    const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    const d = base.get(id);
    if (!d) return rep(200, []);
    if (/select=refresh_token:data->>refresh_token/.test(u)) return rep(200, [{ refresh_token: d.refresh_token || '' }]);
    return rep(200, [{ data: d }]);
  }
  return rep(404, {});
};

(async () => {
  let L;
  try { L = await import('file://' + path.join(R, 'api', '_lib', 'ebay.js')); } catch (e) { dit(false, 'api/_lib/ebay.js se charge', e.message); process.exit(1); }
  base.set('ebay_tokens', { refresh_token: 'v^1.1#refresh-A' });

  console.log('1. Deux gestes de suite');
  const a = await L.accessToken(OWNER, '');
  const b = await L.accessToken(OWNER, '');
  dit(a.ok && b.ok && a.token === b.token && oauth === 1, 'un seul échange OAuth chez eBay pour deux gestes', { oauth, a: a.token, b: b.token });
  const ids = [...base.keys()].filter((k) => k !== 'ebay_tokens');
  dit(ids.length === 1 && ids[0].startsWith('ebay_tokens'), 'le jeton gardé vit sous `ebay_tokens…` (écriture interdite aux navigateurs)', ids);
  dit(!JSON.stringify(base.get(ids[0]) || {}).includes('refresh-A'), 'la ligne gardée ne porte pas le refresh_token en clair', base.get(ids[0]));

  console.log('\n2. Bientôt expiré');
  const g = base.get(ids[0]); base.set(ids[0], { ...g, expireA: Date.now() + 4 * 60 * 1000 });
  const c = await L.accessToken(OWNER, '');
  dit(c.ok && oauth === 2 && c.token !== a.token, 'à moins de 5 min de sa fin ⇒ un jeton neuf est demandé', { oauth, token: c.token });

  console.log('\n3. Reconnexion (autre refresh_token)');
  base.set('ebay_tokens', { refresh_token: 'v^1.1#refresh-B' });
  const d = await L.accessToken(OWNER, '');
  dit(d.ok && oauth === 3 && d.token !== c.token, 'le jeton gardé de l\'ancienne connexion n\'est jamais servi', { oauth, token: d.token });

  console.log('\n4. Base qui ne répond pas');
  const avant = oauth;
  lectureKO = true;
  const e = await L.accessToken(OWNER, '');
  lectureKO = false;
  dit(!e.ok && e.reason === 'store-unreachable' && oauth === avant, 'refresh illisible ⇒ « base injoignable », rien envoyé à eBay', e);

  console.log('\n5. Déconnexion');
  dit(typeof L.oublierAcces === 'function', '`oublierAcces` existe');
  if (typeof L.oublierAcces === 'function') {
    await L.oublierAcces(OWNER, '');
    base.set('ebay_tokens', { refresh_token: 'v^1.1#refresh-B' });
    const f = await L.accessToken(OWNER, '');
    dit(f.ok && oauth === avant + 1, 'après « oublier », le prochain geste redemande un jeton', { oauth });
  }
  console.log('\n6. `neuf` force l\'échange');
  const av2 = oauth;
  const h = await L.accessToken(OWNER, '', { neuf: true });
  dit(h.ok && oauth === av2 + 1, '`{ neuf: true }` ne sert jamais le jeton gardé', { oauth });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
