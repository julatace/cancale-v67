// Un « banc » minuscule pour juger la garde réseau (scripts/tests/garde-reseau.cjs) : ESSAI=propre|prod|continue|internet.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, body: '[]' }));
  if (process.env.ESSAI === 'continue') await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/rest\/v1/.test(r.request().url()) ? r.fallback() : r.continue()));
  await p.setContent('<p>x</p>');
  const mode = process.env.ESSAI || 'propre';
  const r = await p.evaluate(async (mode) => {
    const out = [];
    out.push(await fetch('https://lgonxzrzjcqthjtbdpzo.supabase.co/rest/v1/app_data').then((x) => 'servi ' + x.status, (e) => 'échec'));
    if (mode === 'prod') out.push(await fetch('https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/settings').then((x) => 'sorti ' + x.status, () => 'refusé'));
    if (mode === 'continue') out.push(await fetch('https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/user', { headers: { Authorization: 'Bearer jeton-de-banc' } }).then((x) => 'sorti ' + x.status, () => 'refusé'));
    if (mode === 'internet') out.push(await fetch('https://registry.npmjs.org/', { mode: 'no-cors' }).then((x) => 'sorti ' + x.type, (e) => 'refusé ' + e.message));
    return out;
  }, mode);
  console.log(mode, JSON.stringify(r));
  await b.close();
  console.log('✅ fini');
})();
