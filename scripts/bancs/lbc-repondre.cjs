// ── BANC : LEBONCOIN — LIRE UNE CONVERSATION ET Y RÉPONDRE SUR SON CLIC (3 nov., 5.318)
// Julien a choisi « répondre aux messages Leboncoin depuis VRM ». Données
// INVENTÉES, à la forme des lignes que range l'extension 5.318 (`lbc_messages`,
// `lbc_fil_{conv}` lu en scalaires `meta`, `lbc_envoi`, `lbc_accounts`). Exige :
//   · Messages · Leboncoin : la conversation lue, son aperçu, le compte nommé ;
//   · le fil : le texte, « Toi », jamais un nom ;
//   · « Envoyer » n'existe qu'avec une extension 5.318 ET une recette apprise —
//     sinon « Répondre sur Leboncoin ↗ », AUCUNE commande ne part ;
//   · ouvrir le fil ne fait rien partir ; un envoi = UNE commande
//     `lbcRepondre { conv, texte }`, sur SON clic, résultat dit (fait · refusé) ;
//   · 390 px tactile et 1512 px, clair ET sombre : rien ne déborde, 44 px au doigt.
// 5.362 (revue extension, moyennes 60 et 63) : sur leboncoin.fr, l'ordre « répondre »
// passe du relais à la page par un CANAL PRIVÉ (MessageChannel lbc-relay ⇄ lbc-inject),
// plus jamais par `window` — jugé par `audit-lbc-repondre` (le relais qui prend le port).
// CE banc juge l'autre bout : l'APP ⇄ le pont de l'extension sur vrm.center
// (`__vmr`, bridge.js), que 5.362 n'a pas changé ; l'app n'envoie jamais rien à
// leboncoin.fr elle-même. Relancé sur 5.362 : 31 verts (12 nov.).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4393);
const CAP = process.env.SHOTS || path.join(require('os').tmpdir(), 'vrm-bancs');
const auj = Date.now();
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const U1 = 'aaaa1111-0000-4000-8000-000000000001';
const CONV = 'c0c0c0c0-1111-4222-8333-944455556666';
const MESSAGES = [
  { id: 'm1', t: 'Bonjour, les Air Max sont toujours dispo ?', deMoi: false, at: new Date(auj - 3 * 3600e3).toISOString() },
  { id: 'm2', t: 'Oui, toujours !', deMoi: true, at: new Date(auj - 2 * 3600e3).toISOString() },
  { id: 'm3', t: 'Envoi possible en point relais ?', deMoi: false, at: new Date(auj - 1 * 3600e3).toISOString() },
];
const PONT = ({ version, suite }) => {
  window.__cmds = [];
  if (!version) return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, lbcRepondre: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      const resp = d.cmd !== 'lbcRepondre' ? { accepte: false, code: 'inconnue', raison: 'commande inconnue' }
        : suite === 'refuse' ? { accepte: true, etape: 'refuse', statut: 429, raison: 'Leboncoin a refusé (429) — VRM se met en pause 30 min sur la messagerie Leboncoin' }
        : { accepte: true, etape: 'fait', statut: 201 };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), 150);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};
async function ouvrir(b, vp, { version = '5.318.0', suite = 'fait', appris = true, sombre = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version, suite });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'lbc_accounts' }]);
    if (/id=eq\.lbc_messages/.test(u)) return j([{ compteurs: { [U1]: { unread: 1, at: new Date(auj - 600e3).toISOString() } }, comptes: { [U1]: { name: 'Totomondu', pro: false, at: new Date(auj).toISOString() } } }]);
    if (/id=eq\.lbc_accounts/.test(u)) return j([{ a: { ['lbc-account:' + U1]: { id: 'lbc-account:' + U1, name: 'Totomondu', type: 'particulier', sessionAt: new Date(auj).toISOString() } } }]);
    if (/id=like\.lbc_fil_/.test(u)) return j([{ id: 'lbc_fil_' + CONV, n: '3', da: MESSAGES[2].at, ap: MESSAGES[2].t, dm: 'false', compte: U1 }]);
    if (/id=eq\.lbc_fil_/.test(u)) return j([{ messages: MESSAGES, page: '/messages/id/' + CONV }]);
    if (/id=eq\.lbc_envoi/.test(u)) return j(appris ? [{ appris: true, raison: '', at: new Date(auj - 86400e3).toISOString() }] : []);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=messages&site=leboncoin`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-lbc-conv]', { timeout: 15000 }).catch(() => {});
  return { ctx, pg, errs };
}

(async () => {
  let b;
  try {
    fs.mkdirSync(CAP, { recursive: true });
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
    for (const sombre of [false, true]) for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 900 }]) {
      const L = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
      console.log(`── ${L} — extension 5.318, recette apprise`);
      const { ctx, pg, errs } = await ouvrir(b, vp, { sombre });
      const conv = await pg.evaluate((c) => { const e = document.querySelector(`[data-lbc-conv="${c}"]`); return e ? e.innerText : null; }, CONV);
      dit(conv && /Totomondu/.test(conv) && /Envoi possible en point relais/.test(conv), `${L} : la conversation lue, le compte nommé, l’aperçu du dernier message`, conv && conv.replace(/\n/g, ' · '));
      await pg.click(`[data-lbc-conv="${CONV}"] button`);
      await pg.waitForSelector('[data-lbc-fil-etat="lu"]', { timeout: 8000 }).catch(() => {});
      const fil = await pg.evaluate(() => { const e = document.querySelector('[data-lbc-fil-etat]'); if (!e) return null; return { etat: e.getAttribute('data-lbc-fil-etat'), n: e.getAttribute('data-lbc-fil-n'), qui: [...e.querySelectorAll('[data-lbc-msg]')].map((x) => x.getAttribute('data-lbc-msg')), t: e.innerText }; });
      dit(fil && fil.etat === 'lu' && fil.n === '3' && fil.qui.join() === 'autre,moi,autre' && /Toi/.test(fil.t), `${L} : le fil, trois messages, « Toi »`, JSON.stringify(fil && { n: fil.n, q: fil.qui }));
      const cmd0 = await pg.evaluate(() => window.__cmds.map((x) => JSON.parse(x)).filter((x) => x.cmd === 'lbcRepondre').length);
      dit(cmd0 === 0, `${L} : ouvrir le fil ne fait RIEN partir`);
      const rep = await pg.evaluate(() => { const e = document.querySelector('[data-lbc-repondre]'); const btn = document.querySelector('[data-lbc-envoyer]'); return e ? { etat: e.getAttribute('data-lbc-repondre'), ta: !!e.querySelector('textarea'), h: btn ? btn.getBoundingClientRect().height : 0, dis: btn ? btn.disabled : null } : null; });
      dit(rep && rep.etat === 'pret' && rep.ta && rep.dis === true && rep.h >= 44, `${L} : « Envoyer » prêt, grisé tant que rien n’est écrit, 44 px`, JSON.stringify(rep));
      await pg.fill('[data-lbc-repondre] textarea', 'Oui, Mondial Relay, envoi demain.');
      await pg.screenshot({ path: path.join(CAP, `lbc-repondre-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`), fullPage: false });
      await pg.click('[data-lbc-envoyer]');
      await pg.waitForSelector('[data-lbc-resultat]', { timeout: 8000 }).catch(() => {});
      const apres = await pg.evaluate(() => ({ cmds: window.__cmds, res: document.querySelector('[data-lbc-resultat]') ? document.querySelector('[data-lbc-resultat]').getAttribute('data-lbc-resultat') : null, t: (document.querySelector('[data-lbc-resultat]') || {}).textContent || '' }));
      const cmds = apres.cmds.map((x) => JSON.parse(x)).filter((x) => x.cmd === 'lbcRepondre');
      dit(cmds.length === 1 && cmds[0].conv === CONV && cmds[0].texte === 'Oui, Mondial Relay, envoi demain.', `${L} : UNE commande \`lbcRepondre { conv, texte }\`, sur SON clic`, JSON.stringify(cmds));
      dit(apres.res === 'ok' && /Envoyé sur Leboncoin/.test(apres.t), `${L} : le résultat est dit`, apres.t);
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, `${L} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, `${L} : aucune erreur d’app`, errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
    for (const [nom, o, attendu] of [['recette pas encore apprise', { appris: false }, 'pas-appris'], ['extension 5.317 (sans lbcRepondre)', { version: '5.317.0' }, 'ext-retard'], ['refus de Leboncoin', { suite: 'refuse' }, 'refus']]) {
      console.log(`── 390 px — ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, o);
      await pg.click(`[data-lbc-conv="${CONV}"] button`).catch(() => {});
      await pg.waitForSelector('[data-lbc-repondre]', { timeout: 8000 }).catch(() => {});
      if (attendu === 'refus') {
        await pg.fill('[data-lbc-repondre] textarea', 'Bonjour');
        await pg.click('[data-lbc-envoyer]');
        await pg.waitForSelector('[data-lbc-resultat]', { timeout: 8000 }).catch(() => {});
        const x = await pg.evaluate(() => { const e = document.querySelector('[data-lbc-resultat]'); return e ? { ton: e.getAttribute('data-lbc-resultat'), t: e.textContent } : null; });
        dit(x && x.ton === 'ko' && /429/.test(x.t) && !/Envoyé/.test(x.t), 'un refus (429) est dit, jamais « envoyé »', JSON.stringify(x));
      } else {
        const e = await pg.evaluate(() => { const x = document.querySelector('[data-lbc-repondre]'); return x ? { etat: x.getAttribute('data-lbc-repondre'), ta: !!x.querySelector('textarea'), lien: (x.querySelector('[data-pied-ouvrir]') || {}).href || '' } : null; });
        dit(e && e.etat === attendu && !e.ta && /^https:\/\/www\.leboncoin\.fr\/messages\/id\//.test(e.lien), `${nom} : pas de champ « Envoyer », « Répondre sur Leboncoin ↗ » vers la page du fil`, JSON.stringify(e));
        const cmds = await pg.evaluate(() => window.__cmds.map((x) => JSON.parse(x)).filter((x) => x.cmd === 'lbcRepondre').length);
        dit(cmds === 0, `${nom} : aucune commande ne part`);
        await pg.screenshot({ path: path.join(CAP, `lbc-repondre-${attendu}-390.png`), fullPage: false });
      }
      dit(errs.length === 0, `${nom} : aucune erreur d’app`, errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ répondre sur Leboncoin : ${ko} rouge(s)` : '\n✅ répondre sur Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
