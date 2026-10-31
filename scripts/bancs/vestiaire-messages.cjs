// ── BANC : VESTIAIRE — LIRE UNE CONVERSATION ET Y RÉPONDRE SUR SON CLIC (31 oct., 5.295)
// Julien : « au moins pouvoir lire les messages et écrire aux personnes, sans
// forcément automatiser ». Données INVENTÉES, à la forme des lignes que range
// l'extension 5.295 (`vc_messages`, `vc_fil_{conv}` lu en scalaires `meta`,
// `vc_envoi`, `vc_listings`). Exige :
//   · la liste : l'aperçu du dernier message, le N° par la référence VRM ;
//   · le fil : le texte, « Toi » / « L'autre personne », rien d'autre ;
//   · « Envoyer » n'existe qu'avec une extension 5.295 ET une recette apprise —
//     sinon le geste est dit (et aucune commande ne part) ;
//   · un envoi part en UNE commande `vcRepondre { conv, texte }`, le résultat est dit
//     (fait · refusé), sans jamais « fait » sur un refus ;
//   · les favoris : un NOMBRE par annonce, jamais « qui » ;
//   · 390 px tactile et 1512 px : rien ne déborde, cibles de 44 px.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4391);
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

const MESSAGES = [
  { id: 'M1', t: 'Bonjour, la paire est toujours dispo ?', deMoi: false, at: new Date(auj - 3 * 3600e3).toISOString() },
  { id: 'M2', t: 'Oui, toujours disponible !', deMoi: true, at: new Date(auj - 2 * 3600e3).toISOString() },
  { id: 'M3', t: 'Super, vous pouvez faire 110 € ?', deMoi: false, at: new Date(auj - 1 * 3600e3).toISOString() },
];
const PONT = ({ version, suite }) => {
  window.__cmds = [];
  if (!version) return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, vcRepondre: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      const resp = d.cmd !== 'vcRepondre' ? { accepte: false, code: 'inconnue', raison: 'commande inconnue' }
        : suite === 'refuse' ? { accepte: true, etape: 'refuse', statut: 429, raison: 'Vestiaire a refusé (429) — VRM se met en pause 30 min sur Vestiaire' }
        : { accepte: true, etape: 'fait', statut: 201 };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), 150);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, { version = '5.295.0', suite = 'fait', appris = true } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, { version, suite });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const brut = route.request().url();
    const u = decodeURIComponent(metaVersData(brut));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/id=eq\.vc_messages/.test(u)) return j([{ compteur: { messages: 1, at: new Date(auj - 20 * 60e3).toISOString() }, conversations: { C7777: { productId: '900001', ref: '401', nonLu: true, date: MESSAGES[2].at, apercu: 'Super, vous pouvez faire 110 € ?', apercuDeMoi: false } }, lecture: { at: new Date(auj).toISOString(), total: 1, complet: true, page: '/messages/' } }]);
    if (/id=like\.vc_fil_/.test(u)) return j([{ id: 'vc_fil_C7777', n: '3', da: MESSAGES[2].at, ap: MESSAGES[2].t, dm: 'false', pid: '900001', ref: '401' }]);
    if (/id=eq\.vc_fil_C7777/.test(u)) return j([{ messages: MESSAGES, page: '/messages/', at: new Date(auj).toISOString() }]);
    if (/id=eq\.vc_envoi/.test(u)) return j(appris ? [{ appris: true, raison: '', at: new Date(auj - 86400e3).toISOString() }] : []);
    if (/id=eq\.vc_listings/.test(u)) return j([{ items: { 501: { boost: false, cles: ['boosted'], ref: '12', favoris: 3, cleFavoris: 'likesCount', vuAt: new Date(auj).toISOString() }, 502: { boost: null, cles: [], ref: '', favoris: null, cleFavoris: '' } }, liens: {}, capturedAt: new Date(auj - 3600e3).toISOString(), complet: true, total: 2 }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=plat_vestiaire`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-vc-messages="lu"]', { timeout: 15000 }).catch(() => {});
  return { ctx, pg, errs };
}

(async () => {
  let b;
  try {
    fs.mkdirSync(CAP, { recursive: true });
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 900 }]) {
      const L = vp.width;
      console.log(`── ${L} px — extension 5.295, recette apprise`);
      const { ctx, pg, errs } = await ouvrir(b, vp);
      const conv = await pg.evaluate(() => { const e = document.querySelector('[data-vc-conv="C7777"]'); return e ? { num: e.getAttribute('data-vc-conv-num'), lu: e.getAttribute('data-vc-conv-lu'), t: e.innerText } : null; });
      dit(conv && conv.num === '401' && conv.lu === 'oui' && /Super, vous pouvez faire 110/.test(conv.t), 'la liste : N°401 (référence VRM), l’aperçu du dernier message', JSON.stringify(conv));
      await pg.click('[data-vc-conv="C7777"] button');
      await pg.waitForSelector('[data-vc-fil="lu"]', { timeout: 8000 }).catch(() => {});
      const fil = await pg.evaluate(() => { const e = document.querySelector('[data-vc-fil]'); if (!e) return null; return { etat: e.getAttribute('data-vc-fil'), n: e.getAttribute('data-vc-fil-n'), qui: [...e.querySelectorAll('[data-vc-msg]')].map((x) => x.getAttribute('data-vc-msg')), t: e.innerText }; });
      dit(fil && fil.etat === 'lu' && fil.n === '3' && fil.qui.join() === 'autre,moi,autre' && /Toi/.test(fil.t) && /L'autre personne/.test(fil.t), 'le fil : trois messages, « Toi » et « L’autre personne », jamais un nom', JSON.stringify(fil && { n: fil.n, q: fil.qui }));
      const rep = await pg.evaluate(() => { const e = document.querySelector('[data-vc-repondre]'); const btn = document.querySelector('[data-vc-envoyer]'); const f = [...document.querySelectorAll('[data-vc-fil-ouvert] button')].find((x) => /Fermer/.test(x.textContent)); return e ? { etat: e.getAttribute('data-vc-repondre'), ta: !!e.querySelector('textarea'), h: btn ? btn.getBoundingClientRect().height : 0, hf: f ? f.getBoundingClientRect().height : 0, dis: btn ? btn.disabled : null } : null; });
      dit(rep && rep.etat === 'pret' && rep.ta && rep.dis === true, '« Envoyer » prêt (extension 5.295, recette apprise), grisé tant que rien n’est écrit', JSON.stringify(rep));
      dit(rep && rep.h >= 44 && rep.hf >= 44, '« Envoyer » et « Fermer » se touchent au doigt (44 px)', JSON.stringify(rep && { h: rep.h, f: rep.hf }));
      await pg.fill('[data-vc-repondre] textarea', 'Je peux faire 115 €, envoi demain.');
      await pg.click('[data-vc-envoyer]');
      await pg.waitForSelector('[data-vc-resultat]', { timeout: 8000 }).catch(() => {});
      const apres = await pg.evaluate(() => ({ cmds: window.__cmds, res: (document.querySelector('[data-vc-resultat]') || {}).getAttribute ? document.querySelector('[data-vc-resultat]').getAttribute('data-vc-resultat') : null, t: (document.querySelector('[data-vc-resultat]') || {}).textContent || '' }));
      const cmds = apres.cmds.map((x) => JSON.parse(x)).filter((x) => x.cmd === 'vcRepondre');
      dit(cmds.length === 1 && cmds[0].conv === 'C7777' && cmds[0].texte === 'Je peux faire 115 €, envoi demain.', 'UNE commande `vcRepondre { conv, texte }` part, sur SON clic', JSON.stringify(cmds));
      dit(apres.res === 'ok' && /Envoyé sur Vestiaire/.test(apres.t), 'le résultat est dit : envoyé', apres.t);
      await pg.screenshot({ path: path.join(CAP, `vestiaire-messages-${L}.png`), fullPage: false });
      const fav = await pg.evaluate(() => { const e = document.querySelector('[data-vc-favoris-resume]'); return e ? { etat: e.getAttribute('data-vc-favoris-resume'), total: e.getAttribute('data-vc-favoris-total'), t: e.textContent } : null; });
      dit(fav && fav.etat === 'lu' && fav.total === '3' && /N°12 · 3/.test(fav.t) && /dont Vestiaire ne dit pas le nombre/.test(fav.t), 'favoris : un nombre par annonce (N°12 · 3), le « pas su » dit à part, jamais « qui »', JSON.stringify(fav));
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
    for (const [nom, o, attendu] of [['recette pas encore apprise', { appris: false }, 'pas-appris'], ['extension 5.293 (sans vcRepondre)', { version: '5.293.0' }, 'ext-retard']]) {
      console.log(`── 390 px — ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, o);
      await pg.click('[data-vc-conv="C7777"] button').catch(() => {});
      await pg.waitForSelector('[data-vc-repondre]', { timeout: 8000 }).catch(() => {});
      const e = await pg.evaluate(() => { const x = document.querySelector('[data-vc-repondre]'); return x ? { etat: x.getAttribute('data-vc-repondre'), ta: !!x.querySelector('textarea'), t: x.innerText } : null; });
      dit(e && e.etat === attendu && !e.ta, `${nom} : pas de champ « Envoyer », la raison`, JSON.stringify(e));
      if (attendu === 'pas-appris') dit(e && /envoie une réponse toi-même sur Vestiaire/.test(e.t), 'le geste est dit : envoyer UNE réponse sur Vestiaire pour que l’extension apprenne', e && e.t.slice(0, 160));
      if (attendu === 'ext-retard') dit(e && /5\.295\.0/.test(e.t), 'la version qui le sait est dite', e && e.t.slice(0, 160));
      const n = await pg.evaluate(() => window.__cmds.filter((x) => /vcRepondre/.test(x)).length);
      dit(n === 0, 'aucune commande d’envoi ne part', String(n));
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
    console.log('── 390 px — Vestiaire refuse (429)');
    {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, { suite: 'refuse' });
      await pg.click('[data-vc-conv="C7777"] button');
      await pg.waitForSelector('[data-vc-repondre="pret"]', { timeout: 8000 }).catch(() => {});
      await pg.fill('[data-vc-repondre] textarea', 'Bonjour');
      await pg.click('[data-vc-envoyer]');
      await pg.waitForSelector('[data-vc-resultat]', { timeout: 8000 }).catch(() => {});
      const t = await pg.evaluate(() => { const x = document.querySelector('[data-vc-resultat]'); return x ? { ton: x.getAttribute('data-vc-resultat'), t: x.textContent } : null; });
      dit(t && t.ton === 'ko' && /429/.test(t.t) && !/Envoyé/.test(t.t), 'un refus est dit comme un refus (jamais « envoyé »)', JSON.stringify(t));
      const ta = await pg.inputValue('[data-vc-repondre] textarea').catch(() => '');
      dit(ta === 'Bonjour', 'le texte reste dans le champ (rien n’est perdu)', ta);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Vestiaire messages : ${ko} rouge(s)` : '\n✅ Vestiaire messages : tout est vert');
  process.exit(ko ? 1 : 0);
})();
