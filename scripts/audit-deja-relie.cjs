#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « Ce compte Vinted est déjà relié à un autre compte VRM » (9 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  1. La ROUTE exécutée (api/vinted-connect.js, fausse base, faux GoTrue) : un
//     autre compte VRM porte le compte Vinted ⇒ 409 `deja_relie`, Vinted pas
//     appelé, le litige est noté chez le DEMANDEUR (sa ligne
//     `vrm_vinted_litige_{id}`, { vinted_user_id, at, source } seulement) ; ni la
//     réponse ni aucune écriture ne portent l'uid ou l'e-mail de l'autre compte.
//  2. La RÈGLE de l'app (src/vintedDejaRelie.js) : lecture projetée, ligne qui
//     dit un autre compte écartée, compte déjà relié chez soi ⇒ rien, « pas su »
//     ⇒ rien, masqué à cette date ⇒ rien, refus plus récent ⇒ revient ; les mots
//     nomment le pseudo (ou le n° Vinted) et le geste, jamais un autre compte.
//  3. Le BRANCHEMENT : l'app lit SA ligne (aucune route de plus) et montre la
//     carte dans Comptes liés ET sur le guide de démarrage.
//  `--prouve` : des mutations de la règle, chacune doit rougir.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'vintedDejaRelie.js');
const ROUTE = path.join(RACINE, 'api', 'vinted-connect.js');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const MAIL_B = 'autre.vendeur@exemple.fr';
const JWT = (o) => 'e30.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.sig';
const SESSION_A = JWT({ sub: A });
const JETON = JWT({ account_id: 777, exp: Math.floor(Date.now() / 1000) + 3600 });

async function route() {
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';
  const appels = [];
  const avant = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); const m = opts.method || 'GET';
    appels.push({ u, m, corps: typeof opts.body === 'string' ? opts.body : '' });
    if (u.includes('/auth/v1/user')) {
      const h = opts.headers || {};
      return (h.Authorization || h.authorization) === `Bearer ${SESSION_A}` ? new Response(JSON.stringify({ id: A, email: 'a@exemple.fr', email_confirmed_at: '2026-01-01' }), { status: 200 }) : new Response('{}', { status: 401 });
    }
    if (u.includes('/rpc/vrm_acces_pour')) return new Response('true', { status: 200 });
    if (u.includes('/rest/v1/vinted_accounts') && m === 'GET') return new Response(JSON.stringify([{ owner: B, email: MAIL_B }]), { status: 200 });
    if (u.includes('/rest/v1/')) return new Response('', { status: 201 });
    if (u.includes('vinted.')) return new Response(JSON.stringify({ user: { id: 9, login: 'shop_a' } }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  try {
    const { default: h } = await import(pathToFileURL(ROUTE).href);
    const r = { statusCode: 200, corps: undefined, status(c) { this.statusCode = c; return this; }, json(j) { this.corps = j; return this; }, send(j) { this.corps = j; return this; }, end() { return this; }, setHeader() {} };
    await h({ method: 'POST', query: {}, headers: { authorization: `Bearer ${SESSION_A}`, origin: 'chrome-extension://abcdefghijklmnop' }, body: { source: 'extension', accessToken: JETON, refreshToken: 'r', domain: 'www.vinted.fr' } }, r);
    return { r, appels };
  } finally { globalThis.fetch = avant; }
}

async function juger(cheminRegle, bavard = true) {
  let ok = 0, ko = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (bavard) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  // ── 1. la route ──
  if (bavard) console.log('— 1. la route exécutée');
  const { r, appels } = await route();
  dit(r.statusCode === 409 && r.corps && r.corps.raison === 'deja_relie', '409 deja_relie quand un autre compte VRM porte ce compte', JSON.stringify(r.corps));
  dit(!appels.some((x) => /vinted\.(fr|com)/.test(x.u)), 'Vinted pas appelé');
  const ecr = appels.filter((x) => x.m !== 'GET' && x.u.includes('/rest/v1/'));
  const litige = ecr.find((x) => x.u.includes('/rest/v1/app_data'));
  let ligne = null; try { ligne = JSON.parse(litige.corps)[0]; } catch (_) {}
  dit(!!ligne && ligne.id === 'vrm_vinted_litige_777' && ligne.owner === A, 'litige noté chez le DEMANDEUR (vrm_vinted_litige_777, owner = session)', JSON.stringify(ligne));
  dit(!!ligne && JSON.stringify(Object.keys(ligne.data).sort()) === '["at","source","vinted_user_id"]', 'la ligne ne porte que vinted_user_id, at, source', ligne && JSON.stringify(ligne.data));
  dit(!ecr.some((x) => x.u.includes('/rest/v1/vinted_accounts')), 'aucun compte Vinted rangé');
  const tout = JSON.stringify(r.corps) + ecr.map((x) => x.corps).join('');
  dit(!tout.includes(B) && !tout.includes(MAIL_B), 'ni la réponse ni une écriture ne portent l’uid ou l’e-mail de l’autre compte VRM');
  // ── 2. la règle ──
  if (bavard) console.log('— 2. la règle de l’app');
  const R = await import(pathToFileURL(cheminRegle).href + '?v=' + Math.random());
  dit(!/select=data\b|select=\*/.test(R.REQUETE_LITIGES) && /select=id,vid:data->>vinted_user_id,at:data->>at$/.test(R.REQUETE_LITIGES), 'lecture projetée (identifiant, compte, date)', R.REQUETE_LITIGES);
  dit(R.litigesDeLignes(null) === null && R.litigesDeLignes(undefined) === null, 'lecture ratée ⇒ null (pas su)');
  const L = R.litigesDeLignes([
    { id: 'vrm_vinted_litige_777', vid: '777', at: '2026-11-09T10:00:00Z' },
    { id: 'vrm_vinted_litige_888', vid: '999', at: '2026-11-09T11:00:00Z' },
    { id: 'vrm_vinted_litige_abc', vid: 'abc', at: '' },
    { id: 'harvest_777_profile', vid: '777' },
    { id: 'vrm_vinted_litige_555', vid: '555', at: '2026-11-08T10:00:00Z' },
  ]);
  dit(Array.isArray(L) && L.map((l) => l.vid).join(',') === '777,555', 'ligne qui dit un autre compte, id non numérique, autre ligne : écartées ; la plus récente d’abord', JSON.stringify(L));
  const comptes = [{ vinted_user_id: 555 }];
  dit(R.litigesAAfficher(L, comptes, {}).map((l) => l.vid).join(',') === '777', 'un compte relié chez soi depuis ne s’affiche plus');
  dit(R.litigesAAfficher(L, null, {}).length === 0 && R.litigesAAfficher(null, comptes, {}).length === 0, 'comptes ou litiges pas lus ⇒ rien');
  dit(R.litigesAAfficher(L, [], { 777: L[0].at }).map((l) => l.vid).join(',') === '555', 'masqué à cette date ⇒ caché');
  dit(R.litigesAAfficher(L, [], { 777: '2026-11-01T00:00:00.000Z' }).some((l) => l.vid === '777'), 'un refus plus récent que le masque revient');
  dit(R.requetePseudos(['777', 'x;drop', '12']) === 'id=in.(harvest_777_profile,harvest_12_profile)&select=id,login:data->payload->user->>login', 'pseudos : identifiants numériques seulement, projeté');
  const P = R.pseudosDeLignes([{ id: 'harvest_777_profile', login: 'shop_a' }, { id: 'harvest_9_profile', login: '' }, { id: 'autre', login: 'x' }]);
  dit(JSON.stringify(P) === '{"777":"shop_a"}', 'pseudo lu de SA ligne de profil', JSON.stringify(P));
  const t1 = R.texteDejaRelie(L[0], 'shop_a'), t2 = R.texteDejaRelie(L[1], '');
  dit(t1.titre.includes('« shop_a »') && t2.titre.includes('n° 555'), 'les mots nomment le pseudo, sinon le n° Vinted');
  dit(/support/.test(t1.geste) && /reconnecte-toi/.test(t1.geste), 'le geste : l’autre compte VRM ou le support');
  dit(![t1.titre, t1.phrase, t1.geste].join(' ').match(/[0-9a-f]{8}-[0-9a-f]{4}-/) && !/@/.test([t1.titre, t1.phrase, t1.geste].join(' ')), 'aucun identifiant ni e-mail d’un compte VRM dans les mots');
  // ── 3. le branchement ──
  if (bavard) console.log('— 3. le branchement');
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const reg = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Reglages.jsx'), 'utf8');
  const lire = (app.match(/async function lireLitigesVinted\(\)[\s\S]*?\n}\n/) || [''])[0];
  dit(/REQUETE_LITIGES\}\$\{filtreInventaire\(\)\}/.test(lire) && /sbAuth\(\)/.test(lire) && !/\/api\//.test(lire), 'l’app lit SA ligne sous sa session (aucune route de plus)');
  const guide = (app.match(/function GuideDemarrageApp\(props\)[\s\S]*?\n}\n/) || [''])[0];
  dit(/<AlerteDejaRelie lire=\{lireLitigesVinted\}/.test(guide), 'la carte sur le guide de démarrage (Ma journée)');
  dit(/<AlerteDejaRelie lire=\{lireLitigesLus\}/.test(reg) && /function VintedAccounts/.test(reg), 'la carte dans Comptes liés');
  return { ok, ko };
}

(async () => {
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(REGLE, 'utf8');
    const mutations = [
      ['compte relié chez soi encore montré', "!relies.has(l.vid) && ", ''],
      ['ligne d’un autre compte acceptée', "if (r.vid != null && String(r.vid) !== m[1]) continue;", ''],
      ['« pas su » devient « aucun »', 'if (!Array.isArray(rows)) return null;', 'if (!Array.isArray(rows)) return [];'],
      ['lecture non projetée', "select=id,vid:data->>vinted_user_id,at:data->>at", 'select=id,data'],
      ['masque éternel', 'm[l.vid] !== l.at', '!m[l.vid]'],
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deja-relie-'));
    let rouges = 0;
    for (const [nom, a, b] of mutations) {
      if (!src.includes(a)) { console.log('  ❌ mutation introuvable : ' + nom); continue; }
      const f = path.join(dir, `m${rouges}-${Math.random().toString(36).slice(2)}.mjs`);
      fs.writeFileSync(f, src.replace(a, b));
      const { ko } = await juger(f, false);
      console.log((ko ? '  ✅ rouge : ' : '  ❌ reste vert : ') + nom);
      if (ko) rouges++;
    }
    console.log(`${rouges}/${mutations.length} mutations rouges`);
    process.exit(rouges === mutations.length ? 0 : 1);
  }
  if (!fs.existsSync(REGLE)) { console.log('  ❌ src/vintedDejaRelie.js absent : l’app ne lit pas le refus'); process.exit(1); }
  const { ok, ko } = await juger(REGLE);
  console.log({ ok, ko });
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('  ❌ ' + (e && e.stack || e)); process.exit(1); });
