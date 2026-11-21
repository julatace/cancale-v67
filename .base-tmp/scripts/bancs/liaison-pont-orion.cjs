require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA LIAISON PAR LE PONT, SANS CANAL DIRECT » — Orion iPhone (5.328)
//
//  Julien, 8 nov. (Orion, extension 5.326) : « "Se connecter" change de page VRM
//  et ça ne se connecte pas ». Lu dans le code : le paquet Orion n'a pas
//  `externally_connectable`, mais la page peut porter un
//  `chrome.runtime.sendMessage` qui ne répond JAMAIS (ni réponse, ni erreur) ;
//  avec un identifiant à 32 lettres, l'app prenait ce canal, attendait 5 s, et
//  concluait « absente » sans essayer le pont (exprès : pas deux envois sur un
//  délai). Vraie app (dist), faux Supabase, faux pont de page qui annonce
//  `canal: 'pont'` (ce que dit bridge.js 5.328 quand son manifeste n'a pas de
//  canal direct). Aucune donnée réelle.
//   P1  la demande de liaison passe par le PONT, adressée à CET identifiant ;
//   P2  la session fabriquée par le serveur arrive par le pont, avec le nonce ;
//   P3  rien n'est envoyé au canal direct qui ne répond pas (aucune liaison) ;
//   P4  autre sens : un pont SANS `canal: 'pont'` (Chrome) garde le canal direct.
//  `BANC_DIST` : un autre build (preuve sur le code d'avant — doit être rouge).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const UID = '11111111-2222-3333-4444-555555555555';
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };

(async () => {
  const srv = http.createServer((req, res) => {
    let f = new URL(req.url, 'http://x').pathname;
    if (f === '/') f = '/index.html';
    let p = path.join(DIST, f);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html');
    res.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    res.end(fs.readFileSync(p));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const ORIG = 'http://127.0.0.1:' + srv.address().port;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse@exemple.test', app_metadata: { provider: 'email' } } };

  async function jouer(pont) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    const j = { pont: [], direct: [], serveur: 0 };
    await pg.route('**/*', async (r) => {
      const u = r.request().url();
      if (/mode=session-extension/.test(u)) { j.serveur++; return r.fulfill({ status: 200, json: { ok: true, session: { access_token: 'a.ext', refresh_token: 'r.ext', expires_at: Date.now() + 3600e3, user_id: UID, email: 'vendeuse@exemple.test' } } }); }
      if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, json: { external: { google: true, discord: true } } });
      if (/\/auth\/v1\/user/.test(u)) return r.fulfill({ status: 200, json: { id: UID, email: 'vendeuse@exemple.test', identities: [{ provider: 'email' }] } });
      if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, json: {} });
      if (/\/rest\/v1\//.test(u)) return r.fulfill({ status: 200, json: [] });
      if (/\/api\//.test(u)) return r.fulfill({ status: 200, json: /mode=confidentialite/.test(u) ? { ok: true, uid: UID } : {} });
      if (u.startsWith(ORIG + '/')) return r.continue();
      return r.abort();
    });
    await pg.exposeFunction('__note', (q, m) => { j[q].push(m); });
    await pg.addInitScript(({ SESSION, ID, pont }) => {
      try { localStorage.setItem('vrm_session', JSON.stringify(SESSION)); } catch (_) {}
      // Orion : `sendMessage` existe dans la page mais ne répond jamais.
      window.chrome = window.chrome || {};
      window.chrome.runtime = { sendMessage: (id, m) => { try { window.__note('direct', m); } catch (_) {} } };
      // Le pont de l'extension (bridge.js), simulé : il annonce SON identifiant.
      const pret = () => window.postMessage(Object.assign({ __vmr: 'ready', version: '5.328.0', id: ID }, pont === 'pont' ? { canal: 'pont' } : {}), '*');
      let nonce = '';
      window.addEventListener('message', (e) => {
        const d = e.data; if (e.source !== window || !d || typeof d.__vmr !== 'string') return;
        if (d.__vmr === 'ping') { pret(); return; }
        if (d.__vmr === 'etat' && d.reqId) { window.postMessage({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, code: '5.328.0', version: '5.328.0', ext: ID, vrm: { ok: true, connecte: false, cloisonne: true } } }, '*'); return; }
        if (d.__vmr === 'adresse' && d.reqId) {
          if (d.ext !== ID) return;
          try { window.__note('pont', d.msg); } catch (_) {}
          let resp = { ok: false };
          if (d.msg.type === 'liaison') { nonce = 'n-' + Date.now(); resp = { ok: true, besoin: true, nonce, raison: 'demande' }; }
          if (d.msg.type === 'session') resp = d.msg.nonce === nonce ? { ok: true, email: 'vendeuse@exemple.test' } : { ok: false, code: 'nonce' };
          setTimeout(() => window.postMessage({ __vmr: 'adresse:result', reqId: d.reqId, ext: ID, resp }, '*'), 5);
        }
      });
      setTimeout(pret, 50); setTimeout(pret, 800);
    }, { SESSION, ID, pont });
    await pg.goto(ORIG + '/?tab=plat_vinted&lier-extension=' + ID);
    await pg.waitForTimeout(9000);
    await ctx.close();
    return j;
  }

  try {
    console.log('\n── Orion : pas de canal direct, le pont l’annonce');
    const o = await jouer('pont');
    const liaison = o.pont.find((m) => m.type === 'liaison');
    const session = o.pont.find((m) => m.type === 'session');
    dit(!!liaison && liaison.pour === UID, 'P1 · la demande de liaison passe par le PONT, adressée à cette extension, pour ce compte', JSON.stringify(o.pont.map((m) => m.type)));
    dit(!!session && session.session && session.session.user_id === UID && o.serveur === 1, 'P2 · la session fabriquée par le serveur arrive par le pont (avec son nonce)', JSON.stringify({ types: o.pont.map((m) => m.type), serveur: o.serveur }));
    dit(!o.direct.some((m) => m && (m.type === 'liaison' || m.type === 'session')), 'P3 · rien de la liaison n’est envoyé au canal direct qui ne répond pas', JSON.stringify(o.direct.map((m) => m && m.type)));
    console.log('\n── Chrome : le pont n’annonce rien, le canal direct reste');
    const c = await jouer('chrome');
    dit(c.direct.some((m) => m && m.type === 'liaison') && !c.pont.some((m) => m.type === 'liaison'), 'P4 · autre sens : sans `canal: pont`, la liaison prend le canal direct (inchangé)', JSON.stringify({ direct: c.direct.map((m) => m && m.type), pont: c.pont.map((m) => m.type) }));
  } catch (e) { ko++; console.log('  ❌ a levé : ' + (e && e.message)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} liaison-pont-orion : ${ok} verts, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exitCode = ko ? 1 : 0;
})();
