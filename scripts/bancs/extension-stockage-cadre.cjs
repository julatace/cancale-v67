// ════════════════════════════════════════════════════════════════════════════
//  5.396 (revue de robustesse de l'extension, moyennes 67 et 68) — dans un VRAI
//  Chromium, la VRAIE extension (dossier vinted-sync-extension) :
//   S1  le fond réserve `chrome.storage.local` à l'extension (`setAccessLevel`) ;
//   S2  le miroir des pages (`chrome.storage.session`) ne porte AUCUN jeton : la
//       session VRM y est un simple signal `{ at, present }` ;
//   S3  une valeur sans secret (l'apparence) arrive au miroir, et la carte du logo
//       (script de contenu) la suit sur vinted.fr — la page n'a rien perdu ;
//   C1  vinted.fr encadre la fenêtre de l'extension (`popup.html?mode=carte`) ;
//   C2  un AUTRE site qui encadre vinted.fr qui encadre la fenêtre : refusé PAR LE
//       NAVIGATEUR (`frame-ancestors` de la politique de l'extension) — avant, la
//       page se chargeait et seul popup.js se taisait.
//  Usage : node scripts/bancs/extension-stockage-cadre.cjs [--ext dossier]
//  `--ext` : un autre dossier d'extension (preuve sur le code d'avant, §6.1).
//  Aucune requête vers un vrai site : chaque adresse est servie par le banc.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const i = process.argv.indexOf('--ext');
const EXT = i > 0 ? path.resolve(process.argv[i + 1]) : path.resolve(__dirname, '../../vinted-sync-extension');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
const dit = (ok, m, d) => { out.push(ok); console.log((ok ? '✅ ' : '❌ ') + m + (ok || d === undefined ? '' : ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)))); };

(async () => {
  const c = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-stockage-')), {
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
    headless: true, locale: 'fr-FR', ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT],
  });
  try {
    const w = c.serviceWorkers()[0] || await c.waitForEvent('serviceworker', { timeout: 20000 });
    const id = w.url().split('/')[2];
    await pause(1500);
    const etat = await w.evaluate(() => ({ verrou: typeof STOCKAGE_VERROUILLE === 'undefined' ? null : STOCKAGE_VERROUILLE }));
    dit(etat.verrou === true, 'S1 le fond réserve `chrome.storage.local` à l’extension (les scripts de contenu n’y ont plus accès)', etat);
    await w.evaluate(async () => {
      await chrome.storage.local.set({ vrmApparence: 'sombre', vrmSession: { access_token: 'JETON-SECRET-BANC', refresh_token: 'RENOUV-SECRET-BANC', user_id: 'vendeur-banc', email: 'banc@exemple.test', expires_at: Date.now() + 3600000 } });
    });
    await pause(600);
    const miroir = await w.evaluate(async () => (chrome.storage.session ? await chrome.storage.session.get(null) : null));
    const texte = JSON.stringify(miroir || {});
    dit(!!miroir && !/SECRET|banc@exemple/.test(texte) && miroir.vrmSession && miroir.vrmSession.present === true && !('access_token' in miroir.vrmSession),
      'S2 le miroir des pages ne porte aucun jeton ni e-mail : la session y est un signal `{ at, present }`', texte.slice(0, 300));
    dit(!!miroir && miroir.vrmApparence === 'sombre', 'S3 une valeur sans secret (l’apparence) est recopiée dans le miroir', texte.slice(0, 300));
    await c.route('https://**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith('https://autre-site.test/')) return r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><iframe src="https://www.vinted.fr/cadre"></iframe></body></html>' });
      if (u.startsWith('https://www.vinted.fr/cadre')) return r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>vinted<iframe src="chrome-extension://${id}/popup.html?mode=carte"></iframe></body></html>` });
      if (u.startsWith('https://www.vinted.fr/')) return r.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="fr"><body><main><h1>Mon dressing</h1><p>page de banc</p></main></body></html>' });
      return r.fulfill({ status: 404, body: '' });
    });
    const p = await c.newPage();
    await p.goto('https://www.vinted.fr/member/1');
    await pause(2500);
    const theme = await p.evaluate(() => { const h = document.getElementById('vrm-badge'); return h ? (h.getAttribute('data-theme') || '(aucun)') : null; });
    dit(theme === 'sombre', 'S3 sur vinted.fr, la carte du logo (script de contenu) lit l’apparence par le miroir', { theme });
    const cadre = async (pg) => { const f = pg.frames().find((x) => x.url().startsWith('chrome-extension://')); if (!f) return null; return f.evaluate(() => (document.body ? document.body.innerHTML.length : 0)).catch(() => null); };
    const p2 = await c.newPage(); await p2.goto('https://www.vinted.fr/cadre'); await pause(2000);
    const n2 = await cadre(p2);
    dit(n2 !== null && n2 > 200, 'C1 vinted.fr encadre la fenêtre de l’extension (la carte du logo)', { n2 });
    const p3 = await c.newPage(); await p3.goto('https://autre-site.test/'); await pause(2500);
    const n3 = await cadre(p3);
    dit(n3 === null, 'C2 un autre site qui encadre vinted.fr qui encadre la fenêtre : le navigateur la refuse (`frame-ancestors`)', { n3, cadres: p3.frames().map((f) => f.url().slice(0, 50)) });
    await p.screenshot({ path: path.join(os.tmpdir(), 'vrm-stockage-cadre-vinted.png') }).catch(() => {});
  } finally { await c.close(); }
  const r = out.filter((x) => !x).length;
  console.log(r ? `❌ ${r} contrôle(s) rouge(s)` : `✅ stockage et cadre de l'extension : ${out.length} vert(s)`);
  process.exit(r ? 1 : 0);
})().catch((e) => { console.log('❌ banc : ' + (e && e.message)); process.exit(1); });
