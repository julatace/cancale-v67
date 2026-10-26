// Banc : MESSAGES — LE COMPTE DE L'EXTENSION D'ABORD, LES AUTRES EN LECTURE SEULE
// (16 octobre).
//
// L'extension n'agit qu'au nom du compte connecté dans l'onglet Vinted de ce
// Chrome (`gardeStricte`, §3). Avant : le compte de Chrome FILTRAIT la liste —
// les conversations des autres comptes disparaissaient de Messages — et, sous
// « Tous les comptes », le fil d'un autre compte proposait « Accepter » /
// « Envoyer » alors que le clic ne pouvait qu'échouer.
// Ce banc exige :
//   1. Chrome sur compte_a : TOUTES les conversations, celles de compte_a EN
//      TÊTE et actionnables, celles de compte_b ensuite, lisibles (ni floutées,
//      ni inertes), marquées lecture seule ;
//   2. la raison de la lecture seule dite UNE fois (§7), qui nomme le compte de
//      Chrome et le geste (basculer Chrome sur l'autre compte) ;
//   3. dans le fil de compte_b : Accepter, Refuser, l'offre, la réponse et les
//      réponses rapides GRISÉS — et un clic forcé n'envoie RIEN à l'extension ;
//   4. dans le fil de compte_a : les mêmes boutons actifs (l'autre sens) ;
//   5. « pas su » (cookie Vinted pas lu à temps) : rien n'est affirmé, ni
//      lecture seule ni groupe — le comportement d'avant.
// Données INVENTÉES (il vit dans le dépôt, public). Ce qui est jugé : des
// attributs `data-*`, `disabled`, le style calculé — jamais une formulation,
// sauf le nom du compte et la présence du geste dans la phrase commune.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4652;
const OUT = process.env.BANC_CAPTURES || os.tmpdir();

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const fil = (id, login, tx, oid, prix) => ({ id, opposite_user: { id: 5000 + id, login }, transaction: { id: tx, item_id: 400 + id }, description: 'Paire ' + id, allow_reply: true,
  messages: [
    { entity_type: 'message', entity: { user_id: 5000 + id, body: 'Bonjour, vous feriez ' + prix + ' € ?' } },
    { entity_type: 'offer_request_message', entity: { user_id: 5000 + id, current: true, status: 10, status_title: '', price: { amount: prix + '.0' }, transaction_id: tx, offer_request_id: oid } },
  ] });
const FIL_A = fil(301, 'acheteuse_a', 9001, 77, 45);
const FIL_B = fil(402, 'acheteur_b', 9002, 88, 60);
// compte_b a la conversation la PLUS RÉCENTE (1 h) : sans priorité, elle serait
// en tête. compte_a : 26 et 30 h.
const LIGNES = [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(301, 'acheteuse_a', 'Vous feriez 45 € ?', true, 30), conv(303, 'curieux_a', 'Merci !', false, 26)] } } },
  { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(402, 'acheteur_b', 'Vous faites 60 ?', true, 1), conv(404, 'curieux_b', 'Dispo ?', false, 2)] } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: FIL_A } } },
  { id: 'harvest_222_conv_402', data: { capturedAt: iso(0), payload: { conversation: FIL_B } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// Le pont, dans la vraie forme de `etat` (le cookie Vinted) ; chaque `exec` est
// noté. Une LECTURE (GET d'un fil) rend le fil demandé.
const PONT = ({ chrome, fils }) => {
  const version = '5.163.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */, cloisonne: false } });
    if (d.__vmr === 'etat') {
      const passu = chrome === 'passu';
      const lo = { 111: 'compte_a', 222: 'compte_b' };
      post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */ },
        vinted: !passu && chrome ? { uid: String(chrome), login: lo[chrome] || '' } : null, cmds: {} }, passu ? { vintedPasSu: true } : {}) });
    }
    if (d.__vmr === 'exec') {
      window.__exec && window.__exec(JSON.stringify({ uid: d.uid, method: d.method, endpoint: d.endpoint }));
      const m = /conversations\/(\d+)$/.exec(d.endpoint || '');
      const data = d.method === 'GET' ? { conversation: (m && fils[m[1]]) || null } : {};
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

// `etroit` : une fenêtre Chrome de 390 px (souris, extension présente) ;
// `tel` : un vrai téléphone (tactile, aucune souris) — l'extension n'y existe
// pas, rien ne doit y être déclaré actionnable.
async function rendre(b, { chrome = '111', etroit = false, tel = false, extTel = false } = {}) {
  const vp = (etroit || tel) ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const execs = [];
  await pg.exposeFunction('__exec', (s) => execs.push(JSON.parse(s)));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  // Un iPhone n'a pas d'extension (aucun pont) ; un téléphone Firefox Android
  // en a une depuis la 5.188 (`extTel`) : il agit alors ICI, comme un ordinateur.
  if (!tel || extTel) await pg.addInitScript(PONT, { chrome, fils: { 301: FIL_A, 402: FIL_B } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  return { ctx, pg, errs, execs };
}
const lireListe = (pg) => pg.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-messagerie] [data-conv]')];
  const ro = document.querySelectorAll('[data-msg-lecture-seule]');
  return {
    convs: rows.map((x) => ({ id: x.getAttribute('data-conv'), acces: x.getAttribute('data-conv-acces'), floue: /blur/.test(getComputedStyle(x).filter), inerte: getComputedStyle(x).pointerEvents === 'none' })),
    nRo: ro.length, roTxt: ro[0] ? ro[0].innerText : '', roN: ro[0] ? ro[0].getAttribute('data-msg-lecture-seule') : null, roNonLus: ro[0] ? ro[0].getAttribute('data-nonlus-autres') : null,
    groupeActif: (document.querySelector('[data-msg-groupe-actif]') || { getAttribute: () => null }).getAttribute('data-msg-groupe-actif'),
  };
});
const lireFil = (pg) => pg.evaluate(() => {
  const btn = (name) => { const b = [...document.querySelectorAll('.vrm-chat-panel button')].find((x) => x.innerText.trim() === name); return b ? b.disabled : 'absent'; };
  const ta = document.querySelector('textarea[aria-label="Réponse à la conversation"]');
  const prix = document.querySelector('input[aria-label="Prix de l\'offre"]');
  const off = document.querySelector('[data-offre]');
  const lect = document.querySelectorAll('[data-conv-lecture-seule]');
  return { accepter: btn('Accepter'), refuser: btn('Refuser'), envoyerOffre: btn("Envoyer l'offre"), envoyer: btn('Envoyer'),
    texte: ta ? ta.disabled : 'absent', prix: prix ? prix.disabled : 'absent', offre: off ? off.getAttribute('data-offre') : null,
    lectureSeule: lect.length, lectTxt: lect[0] ? lect[0].innerText : '' };
});
const fermerFil = async (pg) => { await pg.evaluate(() => { const b = document.querySelector('button[aria-label="Fermer la conversation"]'); if (b) b.click(); }); await pg.waitForTimeout(400); };

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const etroit of [false, true]) {
      const t = etroit ? 390 : 1512;
      console.log(`── 1. Chrome connecté sur compte_a · ${t} px`);
      await essaie('1 ' + t, async () => {
        const r = await rendre(b, { chrome: '111', etroit });
        const l = await lireListe(r.pg);
        const ids = l.convs.map((c) => c.id);
        dit(ids.length === 4, 'les conversations des DEUX comptes sont listées (le compte de Chrome ne filtre plus)', JSON.stringify(ids));
        dit(ids.slice(0, 2).sort().join() === '301,303' && ids.slice(2).sort().join() === '402,404', 'celles de compte_a (Chrome) EN TÊTE, malgré une conversation plus récente sur compte_b', JSON.stringify(ids));
        dit(l.convs.filter((c) => ['301', '303'].includes(c.id)).every((c) => c.acces === 'action') && l.convs.filter((c) => ['402', '404'].includes(c.id)).every((c) => c.acces === 'lecture'), 'compte_a actionnable, compte_b en lecture seule', JSON.stringify(l.convs));
        dit(l.convs.every((c) => !c.floue && !c.inerte), 'compte_b reste LISIBLE : ni flouté, ni inerte', JSON.stringify(l.convs));
        dit(l.groupeActif === '111', 'le groupe de compte_a est nommé en tête', String(l.groupeActif));
        dit(l.nRo === 1, 'la raison de la lecture seule est dite UNE fois (§7)', `n=${l.nRo}`);
        dit(/compte_a/.test(l.roTxt) && /bascule Chrome/i.test(l.roTxt), 'elle nomme le compte de Chrome et dit le geste (basculer Chrome)', l.roTxt.replace(/\n/g, ' '));
        dit(l.roN === '2' && l.roNonLus === '1', 'elle compte les conversations en lecture seule et leurs non-lus (rien de caché)', `${l.roN}/${l.roNonLus}`);
        await r.pg.screenshot({ path: path.join(OUT, `messages-priorite-liste-${t}.png`) });

        // 3. le fil de compte_b : tout grisé, rien ne part.
        await r.pg.click('[data-conv="402"]');
        await r.pg.waitForTimeout(1500);
        const fb = await lireFil(r.pg);
        dit(fb.offre === 'attente', 'le fil de compte_b est lisible (son offre de 60 € est montrée)', JSON.stringify(fb));
        dit(fb.accepter === true && fb.refuser === true && fb.envoyerOffre === true && fb.envoyer === true && fb.texte === true && fb.prix === true, 'compte_b : Accepter, Refuser, l’offre, la réponse — tous GRISÉS', JSON.stringify(fb));
        dit(fb.lectureSeule === 1 && /compte_b/.test(fb.lectTxt), 'le fil dit qu’il est en lecture seule et sur quel compte basculer', fb.lectTxt);
        const avant = r.execs.filter((x) => x.method !== 'GET').length;
        await r.pg.evaluate(() => { const b = [...document.querySelectorAll('.vrm-chat-panel button')].find((x) => x.innerText.trim() === 'Accepter'); if (b) { b.disabled = false; b.click(); } });
        await r.pg.waitForTimeout(800);
        const geste = r.execs.filter((x) => x.method !== 'GET').length - avant;
        dit(geste === 0, 'un clic forcé sur « Accepter » n’envoie RIEN à l’extension (aucun geste au nom d’un autre compte)', JSON.stringify(r.execs));
        await r.pg.screenshot({ path: path.join(OUT, `messages-priorite-fil-b-${t}.png`) });
        await fermerFil(r.pg);

        // 4. l'autre sens : le fil de compte_a, actionnable.
        await r.pg.click('[data-conv="301"]');
        await r.pg.waitForTimeout(1500);
        const fa = await lireFil(r.pg);
        dit(fa.offre === 'attente' && fa.accepter === false && fa.refuser === false && fa.texte === false && fa.prix === false && fa.lectureSeule === 0, 'compte_a : les gestes restent ACTIFS (l’autre sens)', JSON.stringify(fa));
        const sw = await r.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(sw.sw <= sw.cw + 1, 'aucun débordement horizontal', `${sw.sw} > ${sw.cw}`);
        dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
        await r.pg.screenshot({ path: path.join(OUT, `messages-priorite-fil-a-${t}.png`) });
        await r.ctx.close();
      });
    }
    console.log('── 2. « Tous les comptes » choisi exprès : la même priorité');
    await essaie('2', async () => {
      const r = await rendre(b, { chrome: '111' });
      if (await r.pg.$('#vrm-sel-compte')) { await r.pg.selectOption('#vrm-sel-compte', '*'); await r.pg.waitForTimeout(500); }
      const l = await lireListe(r.pg);
      dit(l.convs.length === 4 && l.convs[0].acces === 'action' && l.nRo === 1, 'compte_a en tête, compte_b en lecture seule, la raison une fois', JSON.stringify(l));
      // Le défaut d'avant, sous « Tous les comptes » : le fil de compte_b
      // proposait « Accepter » au nom d'un compte que Chrome n'a pas ouvert.
      await r.pg.click('[data-conv="402"]');
      await r.pg.waitForTimeout(1500);
      const fb = await lireFil(r.pg);
      dit(fb.accepter === true && fb.refuser === true && fb.texte === true, '« Tous les comptes » : le fil de compte_b reste grisé (jamais un bouton qui échouerait au clic)', JSON.stringify(fb));
      const avant = r.execs.filter((x) => x.method !== 'GET').length;
      await r.pg.evaluate(() => { const b = [...document.querySelectorAll('.vrm-chat-panel button')].find((x) => x.innerText.trim() === 'Accepter'); if (b) b.click(); });
      await r.pg.waitForTimeout(500);
      await r.pg.evaluate(() => { const b = [...document.querySelectorAll('div[style*="z-index: 2000"] button')].find((x) => x.innerText.trim() === 'Accepter'); if (b) b.click(); });
      await r.pg.waitForTimeout(800);
      dit(r.execs.filter((x) => x.method !== 'GET').length === avant, 'et cliquer « Accepter » n’envoie rien à l’extension', JSON.stringify(r.execs));
      await r.ctx.close();
    });
    console.log('── 3. PAS SU (cookie Vinted pas lu à temps) : rien n’est affirmé');
    await essaie('3', async () => {
      const r = await rendre(b, { chrome: 'passu' });
      const l = await lireListe(r.pg);
      dit(l.convs.length === 4 && l.nRo === 0 && l.groupeActif === null && l.convs.every((c) => c.acces === null), 'aucune lecture seule, aucun groupe : le comportement d’avant', JSON.stringify(l));
      await r.pg.click('[data-conv="402"]');
      await r.pg.waitForTimeout(1500);
      const fb = await lireFil(r.pg);
      dit(fb.lectureSeule === 0, 'le fil n’affirme pas « lecture seule » sur un état inconnu', JSON.stringify(fb));
      await r.ctx.close();
    });
    console.log('── 4b. téléphone AVEC extension (Firefox Android, 5.188) : il agit ici');
    await essaie('4b', async () => {
      const r = await rendre(b, { chrome: '111', tel: true, extTel: true });
      const l = await lireListe(r.pg);
      dit(l.convs.some((c) => c.acces === 'action') && l.convs.some((c) => c.acces === 'lecture'), 'téléphone dont l’extension répond : le compte de Chrome est actionnable, les autres en lecture', JSON.stringify(l));
      await r.ctx.close();
    });
    console.log('── 4. iPhone (tactile, sans souris) : l’extension n’y vit pas, rien n’est promis');
    await essaie('4', async () => {
      const r = await rendre(b, { chrome: '111', tel: true });
      const l = await lireListe(r.pg);
      dit(l.convs.length >= 1 && l.nRo === 0 && l.convs.every((c) => c.acces === null), 'aucune ligne déclarée actionnable ni lecture seule sur un téléphone', JSON.stringify(l));
      const sw = await r.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(sw.sw <= sw.cw + 1, 'aucun débordement horizontal', `${sw.sw} > ${sw.cw}`);
      await r.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ messages-priorite : ${ko} rouge(s)` : '\n✅ messages-priorite : tout est vert');
  process.exit(ko ? 1 : 0);
})();
