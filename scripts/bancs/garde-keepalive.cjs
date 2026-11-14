// ════════════════════════════════════════════════════════════════════════════
//  BANC « UNE ÉCRITURE DE SORTIE NE QUITTE JAMAIS LE BANC » (14 nov., fiabilité prod)
//
//  Mesuré dans les journaux de la PRODUCTION (edge_logs, 13 → 14 nov.) : des
//  PATCH `app_data?id=eq.main&…&data->>rev=eq.N` et ~240 OPTIONS par jour venus de
//  `http://localhost:10033/10038` (des bancs WebKit, en CI) — tous refusés 401 (un
//  jeton de banc), mais ils sortaient. Et ici, sous Chromium, `reseau-instable`
//  était rouge (« garde réseau : 2 requête(s) vers un hôte réel ») sur le code de
//  départ : la même écriture de `main`. C'est l'envoi de SORTIE de l'app
//  (App.jsx, `pagehide` ⇒ PATCH `keepalive: true`) : une requête `keepalive`
//  survit à la page, et les routes de Playwright ne la voient pas — Chromium la
//  laisse filer vers le réseau, WebKit (sans règle de résolution) jusqu'à la base.
//  La garde réseau (_garde-reseau.cjs) retire `keepalive` des requêtes vers la
//  production DANS la page : la requête reste une requête de la page, que les
//  routes du banc servent (ou qui meurt avec elle). Jamais une écriture dehors.
//  Ce banc : une page locale envoie l'écriture de sortie (PATCH keepalive vers la
//  base de production) quand elle s'en va (`pagehide`). Le nom de la base est
//  envoyé vers un PIÈGE local (une prise TCP qui compte les connexions) : une
//  requête que les routes du banc ont servie n'y arrive jamais ; une requête qui
//  leur échappe s'y connecte — c'est elle qui, en CI WebKit, joignait la base.
//   K1 la route du banc sert l'écriture tant que la page vit (contrôle du banc) ;
//   K2 l'écriture de SORTIE (keepalive, au `pagehide`) n'atteint jamais le piège ;
//   K3 la même sans keepalive non plus (rien d'autre ne change).
//  `BANC_GARDE_KEEPALIVE=0` retire la règle (rouge attendu sur K2).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), net = require('net');
require('./_garde-reseau.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = Number(process.env.BANC_PORT) || 10061;
const BASE = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 400) : ''}`); };
const PAGE = (keepalive) => `<!doctype html><meta charset="utf-8"><title>sortie</title><body>banc<script>
  window.envoyer = () => fetch(${JSON.stringify(BASE)} + '/rest/v1/app_data?id=eq.main&owner=eq.0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b&data-%3E%3Erev=eq.1&select=id', { method: 'PATCH', ${keepalive ? 'keepalive: true, ' : ''}headers: { apikey: 'cle-de-banc', Authorization: 'Bearer jeton-de-banc', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data: { rev: 2 } }) }).then((r) => r.status, (e) => 'erreur ' + e.message);
  addEventListener('pagehide', () => { for (let i = 0; i < 5; i++) window.envoyer(); });
</script>`;

(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE(!/sans/.test(q.url))); });
  await new Promise((ok) => srv.listen(PORT, ok));
  const piege = { n: 0 };
  const trappe = net.createServer((c) => { piege.n++; c.destroy(); });
  await new Promise((ok) => trappe.listen(0, '127.0.0.1', ok));
  const TRAPPE = trappe.address().port;
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server', `--host-resolver-rules=MAP lgonxzrzjcqthjtbdpzo.supabase.co 127.0.0.1:${TRAPPE}`] });
  try {
    for (const [nom, chemin] of [['keepalive', '/'], ['sans keepalive', '/sans']]) {
      const ctx = await nav.newContext();
      const recus = [];
      await ctx.route((u) => /supabase\.co$/.test(u.hostname), (route) => {
        const rq = route.request();
        if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        recus.push(rq.method());
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[{"id":"main"}]' });
      });
      let statut = null;
      // Trois sorties de suite (le moment exact où la page meurt varie) : 5 envois chacune.
      for (let tour = 0; tour < 3; tour++) {
        const pg = await ctx.newPage();
        await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'load' });
        if (tour === 0) statut = await pg.evaluate(() => window.envoyer());
        // Comme l'app (App.jsx, `pagehide` ⇒ `viderAvantFermeture`) : l'envoi part quand la page s'en va.
        await pg.goto('about:blank');
        await pg.close({ runBeforeUnload: true });
      }
      await new Promise((ok) => setTimeout(ok, 1500));
      dit(statut === 200 && recus.length >= 1, `K1 [${nom}] la route du banc sert l'écriture tant que la page vit`, JSON.stringify({ recus, statut }));
      dit(piege.n === 0, `${nom === 'keepalive' ? 'K2' : 'K3'} [${nom}] l'écriture de sortie (au pagehide) n'échappe jamais aux routes du banc`, `${piege.n} connexion(s) au piège (la base, en vrai)`);
      piege.n = 0;
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack).slice(0, 300)); }
  await nav.close(); srv.close(); trappe.close();
  if (ko) { console.log(`\n❌ garde-keepalive : ${ko} défaut(s)`); process.exitCode = 1; }
  else console.log('\n✅ garde-keepalive : aucune écriture de sortie ne quitte le banc');
})();
