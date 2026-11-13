// Sonde TEMPORAIRE (branche claude/sonde-webkit, jamais fusionnée) : comment WebKit voit
// une requête cross-origin servie par une route Playwright. Aucun hôte réel n'est joint
// (abc.supabase.co est refusé par la route du contexte).
const pw = require('playwright');
const http = require('http');
(async () => {
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end('<html><body>ok</body></html>'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origine = 'http://127.0.0.1:' + srv.address().port;
  for (const moteur of (process.env.MOTEURS || 'webkit').split(',')) {
    const b = await pw[moteur].launch(moteur === 'chromium' ? { executablePath: process.env.VRM_CHROMIUM_PATH } : {});
    const ctx = await b.newContext();
    await ctx.route((u) => /supabase\.co$/.test(u.hostname), (r) => { console.log(moteur, 'CTX-ROUTE', r.request().method(), r.request().url()); return r.abort('blockedbyclient'); });
    const p = await ctx.newPage();
    ctx.on('response', async (rep) => { let a = null; try { a = await rep.serverAddr(); } catch (e) { a = 'err ' + e.message; } console.log(moteur, 'RESPONSE', rep.request().method(), rep.status(), rep.url(), 'serverAddr=', JSON.stringify(a)); });
    ctx.on('requestfailed', (q) => console.log(moteur, 'FAILED', q.method(), q.url(), (q.failure() || {}).errorText));
    await p.route('**/*', async (r) => {
      const q = r.request();
      console.log(moteur, 'PAGE-ROUTE', q.method(), q.url());
      if (q.url().startsWith(origine)) return r.continue();
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': q.headers()['access-control-request-headers'] || '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      if (q.url().includes('/settings')) return r.fulfill({ status: 503, headers: cors, json: {} });
      return r.fulfill({ status: 200, headers: cors, json: [] });
    });
    await p.goto(origine + '/');
    const res = await p.evaluate(async () => {
      const out = [];
      for (const [u, h] of [['https://abc.supabase.co/rest/v1/app_data?select=id&limit=1', { apikey: 'x', Authorization: 'Bearer x' }], ['https://abc.supabase.co/auth/v1/settings', { apikey: 'x' }], ['https://abc.supabase.co/auth/v1/settings', { apikey: 'x' }], ['https://abc.supabase.co/rest/v1/simple', {}]]) {
        try { const r = await fetch(u, { headers: h }); out.push(u + ' -> ' + r.status); } catch (e) { out.push(u + ' -> ERR ' + e.message); }
      }
      return out;
    });
    console.log(moteur, 'PAGE', JSON.stringify(res, null, 1));
    await p.waitForTimeout(1000);
    await b.close();
  }
  srv.close();
})();
