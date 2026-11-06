// Banc : MESSAGES · LEBONCOIN, eBay, VESTIAIRE EN VOLETS (1er nov.) — la même
// présentation que Messages · Vinted (`messages-volets.cjs`) : liste · fil ·
// fiche de la paire, par la composition partagée (`LigneConv`, `CadreFil`,
// `BulleConv`, `ComposeConv`, `PiedSansEnvoi`, `FicheConvVolet`).
//
// Rend le VRAI écran sur des données INVENTÉES (le dépôt est public) et exige :
//   1. 1512 px : trois volets côte à côte (liste, fil, fiche) sur chaque site ;
//      390 px : la liste plein écran, le fil plein écran avec un retour, pas de fiche ;
//   2. la fiche est reliée par IDENTITÉ seulement (§5). Deux annonces portent le
//      MÊME titre (« Salomon XT-6 blanc ») sous les N°80 et N°81 :
//        · eBay : l'échange porte l'ItemID 2001 (SKU VRM-80) ⇒ la fiche montre
//          N°80, 120 €, 11 observateurs, Meuble C — jamais N°81 / 130 € / 3 / Meuble D ;
//          un échange SANS ItemID, au même titre ⇒ « Pas reliée », aucun N° ;
//        · Vestiaire : la conversation porte la référence VRM 80 ⇒ N°80, 11 favoris,
//          Meuble C, le titre de la fiche N°80 ; une conversation sans référence ⇒
//          « Pas reliée » ;
//        · Leboncoin : Leboncoin ne donne aucun texte ni aucune annonce ⇒ toujours
//          « Pas reliée », jamais une paire devinée ;
//   3. le pied HONNÊTE : là où VRM peut répondre (eBay avec ItemID, Vestiaire
//      5.295 + recette apprise) : pastilles de réponses rapides partagées, champ,
//      micro de dictée, Envoyer rond ; là où il ne peut pas (Leboncoin, eBay sans
//      ItemID, Vestiaire sans recette) : AUCUN champ, la raison et « … sur le site ↗ » ;
//   4. aucun envoi sans clic : ouvrir, une réponse rapide (qui REMPLIT le champ) —
//      aucune écriture ne part (ni route eBay `repondre`, ni commande `vcRepondre`).
// Captures : <tmp>/messages-sites-{site}-1512.png, -{site}-390-fil.png.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4392;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const TITRE = 'Salomon XT-6 blanc';
// Les fiches VRM : deux paires au MÊME titre, N°80 et N°81 (numérotées hier, hors panne).
const NUMEROS = {
  '801': { numero: '80', title: TITRE, photo: 'https://images1.vinted.net/t/801/f800/a.jpeg', numberedAt: iso(30) },
  '802': { numero: '81', title: TITRE, photo: 'https://images1.vinted.net/t/802/f800/a.jpeg', numberedAt: iso(30) },
};
const MEUBLES = [{ id: 'm1', name: 'Meuble C', cols: 3, rows: 2 }, { id: 'm2', name: 'Meuble D', cols: 2, rows: 2 }];
const SLOTS = { '80': { m: 'm1', i: 0 }, '81': { m: 'm2', i: 3 } };
// eBay : 2002 (VRM-81, 130 €, 3 observateurs) d'abord, puis 2001 (VRM-80, 120 €, 11).
const EBAY_ANNONCES = [
  { itemId: '2002', sku: 'VRM-81', title: TITRE, price: '130.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/b/s-l500.jpg', observateurs: 3 },
  { itemId: '2001', sku: 'VRM-80', title: TITRE, price: '120.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/a/s-l500.jpg', observateurs: 11 },
];
const EBAY_MESSAGES = [
  { id: 'e1', itemId: '2001', titre: TITRE, sender: 'acheteur_e', subject: 'Question sur l’annonce', body: 'Elle taille comment ?', responses: ['Taille normale.'], status: 'Unanswered', date: iso(2), type: 'AskSellerQuestion' },
  { id: 'e2', itemId: '', titre: TITRE, sender: 'acheteuse_f', subject: 'Question', body: 'La boîte est incluse ?', responses: [], status: 'Unanswered', date: iso(1) },
];
const VC_FIL = [
  { id: 'V1', t: 'Bonjour, toujours dispo ?', deMoi: false, at: iso(3) },
  { id: 'V2', t: 'Oui !', deMoi: true, at: iso(2.5) },
  { id: 'V3', t: 'Vous faites 110 € ?', deMoi: false, at: iso(2) },
];
const LIGNES = (appris) => ({
  ebay_listings: [{ items: EBAY_ANNONCES, capturedAt: iso(0) }],
  // (1er nov.) Lecture PROJETÉE (`compteurs:data->compteurs,comptes:data->comptes`) : la vraie forme.
  lbc_messages: [{ compteurs: { u1: { unread: 4, at: iso(0.2) } }, comptes: { u1: { name: 'Compte particulier', pro: false, at: iso(0) } } }],
  vc_messages: [{ compteur: { messages: 1, at: iso(0.3) }, conversations: {
    C1: { productId: '900001', ref: '80', nonLu: true, date: iso(2), apercu: 'Vous faites 110 € ?', apercuDeMoi: false },
    C2: { productId: '900002', ref: '', nonLu: false, date: iso(1), apercu: 'La boîte est incluse ?', apercuDeMoi: false } }, lecture: { at: iso(0), total: 2, complet: true, page: '/messages/' } }],
  vc_listings: [{ liens: {}, items: { 900001: { ref: '80', favoris: 11 }, 900002: { ref: '', favoris: 3 } } }],
  vc_fil_C1: [{ messages: VC_FIL, page: '/messages/', at: iso(0) }],
  vc_fil_C2: [{ messages: [{ id: 'W1', t: 'La boîte est incluse ?', deMoi: false, at: iso(1) }], page: '/messages/', at: iso(0) }],
  vc_envoi: appris ? [{ appris: true, raison: '', at: iso(24) }] : [],
});
const VC_FILS_META = [
  { id: 'vc_fil_C1', n: '3', da: iso(2), ap: 'Vous faites 110 € ?', dm: 'false', pid: '900001', ref: '80' },
  { id: 'vc_fil_C2', n: '1', da: iso(1), ap: 'La boîte est incluse ?', dm: 'false', pid: '900002', ref: '' },
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
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

// Le pont simulé (extension 5.295) : chaque commande est NOTÉE, aucune n'est jouée.
const PONT = ({ version }) => {
  window.__cmds = [];
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, vcRepondre: true } });
    if (d.__vmr === 'cmd') { window.__cmds.push(String(d.cmd || '')); setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } }), 50); }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, tel, site, { appris = true } = {}) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecritures = [];
  await pg.addInitScript(({ n, m, s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_meubles', JSON.stringify(m)); localStorage.setItem('vrm_slots', JSON.stringify(s)); } catch (_) {} }, { n: NUMEROS, m: MEUBLES, s: SLOTS });
  await pg.addInitScript(PONT, { version: '5.295.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const L = LIGNES(appris);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { ecritures.push(route.request().method() + ' ' + u.slice(0, 120)); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    // La rangée de filtres ne montre que les sites où il a un compte (sonde `select=id`).
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'lbc_accounts' }, { id: 'vc_listings' }, { id: 'ebay_listings' }]);
    if (/id=like\.vc_fil_/.test(u)) return j(VC_FILS_META);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && L[eq[1]]) return j(L[eq[1]]);
    return j([]);
  });
  await pg.route('**/api/ebay', async (r) => {
    const body = r.request().method() === 'POST' ? (r.request().postDataJSON() || {}) : {};
    const a = body.action;
    if (!['messages', 'message', 'status', 'agent'].includes(a)) ecritures.push('ebay ' + a);
    let j = { ok: true, connected: true, ready: true };
    if (a === 'status') j = { ok: true, connected: true, comptes: [{ cle: '', ref: 'principal', principal: true, pseudo: 'Compte de banc', relie: true }] };
    if (a === 'messages') j = { ok: true, messages: EBAY_MESSAGES, page: 1, totalPages: 1 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await pg.route('**/api/**', (r) => (/\/api\/ebay/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  await pg.goto(`http://localhost:${PORT}/?tab=messages&site=${site}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector(`[data-messagerie-site="${site}"] .vrm-inbox-row`, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  // (4 nov.) Messages · eBay s'ouvre sur « Questions » (une ligne par annonce) ; ce banc juge la liste « Tout ».
  if (site === 'ebay') { await pg.click('[data-ebay-vue="tout"]').catch(() => {}); await pg.waitForTimeout(300); }
  return { ctx, pg, errs, ecritures };
}
const boite = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { l: b.left, r: b.right, t: b.top, w: b.width, h: b.height, vis: cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0 }; }, sel);
const fiche = (pg) => pg.evaluate(() => { const e = document.querySelector('.vrm-msg-fiche'); return e ? { etat: e.getAttribute('data-fiche-conv'), site: e.getAttribute('data-fiche-site'), item: e.getAttribute('data-fiche-item'), num: e.getAttribute('data-fiche-num'), txt: e.innerText } : null; });
const pied = (pg) => pg.evaluate(() => {
  const p = document.querySelector('.vrm-chat-panel .vrm-chat-foot'); if (!p) return null;
  const s = p.querySelector('.vrm-chat-send'); const b = s && s.getBoundingClientRect(); const o = p.querySelector('[data-pied-ouvrir]');
  return { impossible: p.getAttribute('data-pied-envoi') === 'impossible', champ: !!p.querySelector('.vrm-chat-compose textarea'), ph: (p.querySelector('.vrm-chat-compose textarea') || {}).placeholder || '',
    rapides: p.querySelectorAll('.vrm-chat-rapides button').length, mic: !!p.querySelector('.vrm-chat-compose [data-mic-dictee]'), dicteeOk: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
    rond: b ? Math.abs(b.width - b.height) <= 1 && b.width >= 44 : false, ouvrir: o ? o.href : '', raison: (p.querySelector('.vrm-chat-pied-raison') || {}).innerText || '' };
});
const volets = async (pg) => {
  const L = await boite(pg, '.vrm-message-workspace > .vrm-inbox-column'), F = await boite(pg, '.vrm-message-workspace .vrm-chat-panel'), D = await boite(pg, '.vrm-message-workspace > .vrm-msg-fiche');
  return { ok: !!(L && F && D && L.vis && F.vis && D.vis && L.r <= F.l + 1 && F.r <= D.l + 1 && Math.abs(L.t - F.t) < 4 && Math.abs(F.t - D.t) < 4 && D.w >= 240), L, F, D };
};
const pasDeDebord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const cmds = (pg) => pg.evaluate(() => window.__cmds.slice());
const piedPret = (p) => p && !p.impossible && p.champ && p.ph === 'Écris ta réponse…' && p.rapides >= 3 && (p.mic || !p.dicteeOk) && p.rond;
const piedHonnete = (p, re) => p && p.impossible && !p.champ && re.test(p.ouvrir) && p.raison.length > 20;

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/opt/pw-browsers/chromium'), args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    // ── eBay ──────────────────────────────────────────────────────────
    console.log('── eBay · 1512 px');
    let r = await ouvrir(b, false, 'ebay');
    try {
      const l1 = await r.pg.evaluate(() => (document.querySelector('[data-ebay-message="e1"]') || {}).innerText || '');
      dit(/Salomon XT-6/.test(l1) && /N°80/.test(l1) && !/N°81/.test(l1), 'la ligne dit « modèle · N° » — le N° du SKU de SON annonce (ItemID 2001), jamais l’autre au même titre', l1.replace(/\n/g, ' | '));
      dit(!(await boite(r.pg, '.vrm-message-workspace .vrm-chat-panel')), 'rien n’est ouvert tout seul');
      const f0 = await fiche(r.pg);
      dit(f0 && f0.etat === 'aucune' && f0.site === 'ebay', 'la fiche attend une conversation', JSON.stringify(f0));
      await r.pg.click('[data-ebay-message="e1"]');
      await r.pg.waitForSelector('.vrm-chat-panel .vrm-chat-foot', { timeout: 8000 }).catch(() => {});
      await r.pg.waitForTimeout(500);
      const v = await volets(r.pg);
      dit(v.ok, 'trois volets côte à côte : la liste, le fil, la fiche', JSON.stringify(v));
      const f1 = await fiche(r.pg); const t = (f1 && f1.txt) || '';
      dit(f1 && f1.etat === 'reliee' && f1.item === '2001' && f1.num === '80', 'la fiche est celle de l’ItemID de l’échange (2001, N°80 par son SKU)', JSON.stringify(f1 && { e: f1.etat, i: f1.item, n: f1.num }));
      dit(/N°\s*80/.test(t) && /120\s?€/.test(t) && /11 observateurs/.test(t) && /Meuble C/.test(t) && /eBay/.test(t), 'elle porte son prix, le N°, sa place dans « Mes meubles » et ses observateurs', t.replace(/\n/g, ' | '));
      dit(!/N°81|130\s?€|3 observateurs|Meuble D/.test(t), 'rien de l’autre annonce au même titre (N°81, 130 €, 3 observateurs, Meuble D)');
      const bulles = await r.pg.evaluate(() => [...document.querySelectorAll('.vrm-chat-panel .vrm-bulle')].map((x) => x.getAttribute('data-bulle')));
      dit(bulles.join() === 'acheteur,moi', 'le fil : la question de l’acheteur puis SA réponse, en bulles', bulles.join());
      const p1 = await pied(r.pg);
      dit(piedPret(p1), 'le pied : réponses rapides partagées, « Écris ta réponse… », micro de dictée, Envoyer rond', JSON.stringify(p1));
      await r.pg.locator('.vrm-chat-rapides button').first().click();
      await r.pg.waitForTimeout(200);
      const rep = await r.pg.locator('.vrm-chat-compose textarea').inputValue();
      dit(rep.trim().length > 0 && r.ecritures.length === 0, 'une réponse rapide remplit le champ, rien n’est envoyé', JSON.stringify({ rep, e: r.ecritures }));
      await r.pg.locator('.vrm-chat-compose textarea').fill('');
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-sites-ebay-1512.png') });
      await r.pg.click('[data-ebay-message="e2"]');
      await r.pg.waitForFunction(() => document.querySelector('.vrm-msg-fiche')?.getAttribute('data-fiche-conv') === 'non-reliee', null, { timeout: 8000 }).catch(() => {});
      const f2 = await fiche(r.pg);
      dit(f2 && f2.etat === 'non-reliee' && !f2.item && !f2.num && /Pas reliée/.test(f2.txt) && !/N°8\d/.test(f2.txt), 'un échange au même titre SANS ItemID : « Pas reliée », aucun N° deviné', JSON.stringify(f2));
      const l2 = await r.pg.evaluate(() => (document.querySelector('[data-ebay-message="e2"]') || {}).innerText || '');
      dit(!/N°8\d/.test(l2), 'et sa ligne ne porte aucun N°', l2.replace(/\n/g, ' | '));
      const p2 = await pied(r.pg);
      dit(piedHonnete(p2, /^https:\/\/www\.ebay\.fr\//), 'sans ItemID, VRM ne peut pas répondre : le pied le dit, sans champ, et ouvre eBay', JSON.stringify(p2));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-sites-ebay-1512-nonreliee.png') });
      dit(await pasDeDebord(r.pg), 'aucun débordement horizontal');
      dit(r.ecritures.length === 0 && r.errs.length === 0, 'aucune écriture, aucune erreur', JSON.stringify({ e: r.ecritures, x: r.errs }));
    } catch (e) { dit(false, 'la section a tourné jusqu’au bout', String(e.message).slice(0, 120)); } finally { await r.ctx.close(); }

    // ── Vestiaire ─────────────────────────────────────────────────────
    console.log('── Vestiaire · 1512 px — extension 5.295, recette apprise');
    r = await ouvrir(b, false, 'vestiaire');
    try {
      const l1 = await r.pg.evaluate(() => (document.querySelector('[data-vc-conv="C1"]') || {}).innerText || '');
      dit(/Salomon XT-6/.test(l1) && /N°80/.test(l1) && !/N°81/.test(l1) && /110/.test(l1), 'la ligne : le modèle de la fiche N°80 (sa référence VRM), le N°, le dernier message', l1.replace(/\n/g, ' | '));
      await r.pg.click('[data-vc-conv="C1"] button');
      await r.pg.waitForSelector('[data-vc-fil="lu"]', { timeout: 8000 }).catch(() => {});
      await r.pg.waitForTimeout(400);
      const v = await volets(r.pg);
      dit(v.ok, 'trois volets côte à côte : la liste, le fil, la fiche', JSON.stringify(v));
      const f1 = await fiche(r.pg); const t = (f1 && f1.txt) || '';
      dit(f1 && f1.etat === 'reliee' && f1.num === '80' && f1.item === '900001', 'la fiche est celle de la référence VRM de l’article (N°80)', JSON.stringify(f1 && { e: f1.etat, i: f1.item, n: f1.num }));
      dit(/Salomon XT-6/.test(t) && /N°\s*80/.test(t) && /11 favoris/.test(t) && /Meuble C/.test(t) && !/N°81|3 favoris|Meuble D/.test(t), 'elle porte le titre, le N°, ses favoris, sa place — rien de N°81', t.replace(/\n/g, ' | '));
      const bulles = await r.pg.evaluate(() => [...document.querySelectorAll('.vrm-chat-panel [data-vc-msg] .vrm-bulle')].map((x) => x.getAttribute('data-bulle') + (x.querySelector('time') ? '+h' : '')));
      dit(bulles.join() === 'acheteur+h,moi+h,acheteur+h', 'le fil : trois bulles, chacune avec son heure', bulles.join());
      const p1 = await pied(r.pg);
      dit(piedPret(p1), 'le pied : réponses rapides partagées, champ, micro, Envoyer rond', JSON.stringify(p1));
      await r.pg.locator('.vrm-chat-rapides button').first().click();
      await r.pg.waitForTimeout(200);
      const rep = await r.pg.locator('.vrm-chat-compose textarea').inputValue();
      const c = await cmds(r.pg);
      dit(rep.trim().length > 0 && !c.includes('vcRepondre'), 'une réponse rapide remplit le champ, aucune commande ne part', JSON.stringify({ rep, c }));
      await r.pg.locator('.vrm-chat-compose textarea').fill('');
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-sites-vestiaire-1512.png') });
      await r.pg.click('[data-vc-conv="C2"] button');
      await r.pg.waitForFunction(() => document.querySelector('.vrm-msg-fiche')?.getAttribute('data-fiche-conv') === 'non-reliee', null, { timeout: 8000 }).catch(() => {});
      const f2 = await fiche(r.pg);
      dit(f2 && f2.etat === 'non-reliee' && !f2.num && /Pas reliée/.test(f2.txt) && !/N°8\d/.test(f2.txt), 'une conversation sans référence VRM : « Pas reliée », aucun N°', JSON.stringify(f2));
      dit(await pasDeDebord(r.pg), 'aucun débordement horizontal');
      dit(r.ecritures.length === 0 && r.errs.length === 0 && !(await cmds(r.pg)).includes('vcRepondre'), 'aucune écriture, aucune commande, aucune erreur', JSON.stringify({ e: r.ecritures, x: r.errs }));
    } catch (e) { dit(false, 'la section a tourné jusqu’au bout', String(e.message).slice(0, 120)); } finally { await r.ctx.close(); }
    console.log('── Vestiaire · 1512 px — recette PAS apprise');
    r = await ouvrir(b, false, 'vestiaire', { appris: false });
    try {
      await r.pg.click('[data-vc-conv="C1"] button');
      await r.pg.waitForSelector('[data-vc-repondre]', { timeout: 8000 }).catch(() => {});
      const p = await pied(r.pg);
      dit(piedHonnete(p, /^https:\/\/fr\.vestiairecollective\.com\//) && /envoie une réponse toi-même/.test(p.raison), 'sans recette apprise : pas de champ, le geste est dit, « Répondre sur Vestiaire ↗ »', JSON.stringify(p));
      dit(!(await cmds(r.pg)).includes('vcRepondre') && r.errs.length === 0, 'aucune commande, aucune erreur', JSON.stringify(r.errs));
    } catch (e) { dit(false, 'la section a tourné jusqu’au bout', String(e.message).slice(0, 120)); } finally { await r.ctx.close(); }

    // ── Leboncoin ─────────────────────────────────────────────────────
    console.log('── Leboncoin · 1512 px');
    r = await ouvrir(b, false, 'leboncoin');
    try {
      const l1 = await r.pg.evaluate(() => (document.querySelector('[data-compte-lbc="u1"]') || {}).innerText || '');
      dit(/Compte particulier/.test(l1) && /4 messages non lus/.test(l1), 'la ligne : le compte, SON nombre de non-lus', l1.replace(/\n/g, ' | '));
      await r.pg.click('[data-compte-lbc="u1"] button');
      await r.pg.waitForSelector('[data-lbc-fil]', { timeout: 8000 }).catch(() => {});
      await r.pg.waitForTimeout(300);
      const v = await volets(r.pg);
      dit(v.ok, 'trois volets côte à côte : la liste, le fil, la fiche', JSON.stringify(v));
      const fil = await r.pg.evaluate(() => { const e = document.querySelector('[data-lbc-fil-texte]'); return e ? { etat: e.getAttribute('data-lbc-fil-texte'), t: e.innerText, bulles: document.querySelectorAll('.vrm-chat-panel .vrm-bulle').length } : null; });
      dit(fil && fil.etat === 'absent' && fil.bulles === 0 && /jamais le texte/.test(fil.t), 'le fil dit que Leboncoin ne donne pas le texte — aucune bulle inventée', JSON.stringify(fil));
      const p = await pied(r.pg);
      dit(piedHonnete(p, /^https:\/\/www\.leboncoin\.fr\/messages/), 'le pied : pas de champ, la raison, « Répondre sur Leboncoin ↗ »', JSON.stringify(p));
      const f = await fiche(r.pg);
      dit(f && f.etat === 'non-reliee' && f.site === 'leboncoin' && !/N°\d/.test(f.txt), 'la fiche : « Pas reliée » (aucune identité ne relie un message Leboncoin à une annonce)', JSON.stringify(f));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-sites-leboncoin-1512.png') });
      dit(await pasDeDebord(r.pg), 'aucun débordement horizontal');
      dit(r.ecritures.length === 0 && r.errs.length === 0, 'aucune écriture, aucune erreur', JSON.stringify({ e: r.ecritures, x: r.errs }));
    } catch (e) { dit(false, 'la section a tourné jusqu’au bout', String(e.message).slice(0, 120)); } finally { await r.ctx.close(); }

    // ── Téléphone ─────────────────────────────────────────────────────
    for (const [site, ligne, attendu] of [['ebay', '[data-ebay-message="e1"]', 'pret'], ['vestiaire', '[data-vc-conv="C1"] button', 'pret'], ['leboncoin', '[data-compte-lbc="u1"] button', 'honnete']]) {
      console.log(`── ${site} · 390 px`);
      r = await ouvrir(b, true, site);
      try {
        const row = await boite(r.pg, ligne);
        dit(row && row.vis && row.w >= 330, 'la liste prend toute la largeur', JSON.stringify(row));
        dit(!(await boite(r.pg, '.vrm-msg-fiche') || {}).vis, 'pas de volet de fiche au téléphone');
        await r.pg.click(ligne);
        await r.pg.waitForSelector('.vrm-chat-panel .vrm-chat-foot', { timeout: 8000 }).catch(() => {});
        await r.pg.waitForTimeout(500);
        const P = await boite(r.pg, '.vrm-chat-panel');
        dit(P && P.vis && P.w >= 389 && P.h >= 800 && P.t <= 1, 'le fil prend tout l’écran', JSON.stringify(P));
        const p = await pied(r.pg);
        dit(attendu === 'pret' ? piedPret(p) : piedHonnete(p, /^https:\/\/www\.leboncoin\.fr\//), attendu === 'pret' ? 'le pied d’envoi (rapides, champ, micro, Envoyer)' : 'le pied honnête (raison, « Répondre sur Leboncoin »)', JSON.stringify(p));
        await r.pg.screenshot({ path: path.join(os.tmpdir(), `messages-sites-${site}-390-fil.png`) });
        await r.pg.click('.vrm-chat-panel .vrm-chat-back');
        await r.pg.waitForTimeout(500);
        dit(!(await boite(r.pg, '.vrm-chat-panel') || {}).vis && (await boite(r.pg, ligne) || {}).vis, 'le retour ramène à la liste');
        dit(await pasDeDebord(r.pg), 'aucun débordement horizontal');
        dit(r.ecritures.length === 0 && r.errs.length === 0 && !(await cmds(r.pg)).includes('vcRepondre'), 'aucune écriture, aucune erreur', JSON.stringify({ e: r.ecritures, x: r.errs }));
      } catch (e) { dit(false, 'la section a tourné jusqu’au bout', String(e.message).slice(0, 120)); } finally { await r.ctx.close(); }
    }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n❌ messages-sites : ${ko} rouge(s)` : '\n✅ messages-sites : tout est vert');
    process.exitCode = ko ? 1 : 0;
  }
})();
