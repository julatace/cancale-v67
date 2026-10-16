// Banc : ACHATS et MESSAGES « premium » sur téléphone (390 px) et ordinateur
// (1512 px), sur des données INVENTÉES (ce banc vit dans le dépôt, public).
// Demande de Julien (16 octobre) : « ça fait encore trop vibe-codé — une
// meilleure organisation visuelle, surtout sur téléphone ».
//
// Il juge ce qui est RENDU, jamais un libellé (§6.5) :
//   1. l'écran s'affiche, sans erreur ni garde-fou ;
//   2. aucun débordement horizontal (page) ;
//   3. aucun montant ni code de retrait COUPÉ (texte rogné par sa boîte) ;
//   4. au téléphone, aucune cible tactile de moins de 44 px de haut (boutons,
//      liens-boutons, résumés repliables, champs) dans l'écran ou le fil ;
//   5. les éléments que les autres bancs lisent sont toujours là
//      (`data-achat-tx`, `.vrm-pickup-code`, `data-messagerie`, `data-conv`…).
// Captures : SHOTS=<dossier> (sinon le dossier temporaire).
// Lancer : npm run build && BANC_PORT=53xx node scripts/bancs/achats-messages-premium.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5341;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'achats-messages-premium');

const MAINT = Date.now();
const ilYa = (j, h = 0) => new Date(MAINT - j * 864e5 - h * 36e5).toISOString();
const UID = '111', UID2 = '222';
let nPh = 0;
const ph = () => ({ url: `https://images1.vinted.net/t/b${++nPh}/f800/x.jpeg?s=x` });
const achat = (id, titre, prix, statut, j, extra = {}) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: ilYa(j), photo: ph(), ...extra });
const ACHATS = [
  achat(9301, 'Nike Air Max 90 blanche taille 43', 38, 'Colis déposé en point relais', 4, { transaction_user_status: 'needs_action' }),
  achat(9302, 'Adidas Samba OG noir taille 42', 45.5, 'Colis déposé en point relais', 3, { transaction_user_status: 'needs_action' }),
  achat(9303, 'Salomon XT-6 Advanced gris anthracite taille 44 2/3', 112, 'Colis en cours d\'acheminement', 2),
  achat(9304, 'New Balance 550 crème taille 41', 52, 'Bordereau envoyé au vendeur', 1),
  achat(9305, 'Asics Gel-Kayano 14 argent taille 44', 61.9, 'Commande finalisée', 12),
  achat(9306, 'Nike Dunk Low panda taille 38', 48, 'Colis livré', 6),
  achat(9307, 'Converse Chuck 70 noir taille 42', 29, 'Commande annulée', 15),
  achat(9308, 'Adidas Gazelle rouge taille 40', 34, 'Commande non réclamée - Retournée à l\'expéditeur.rice', 9),
];
const RELAIS = {
  9301: { code: '012345', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: ilYa(0) },
  9302: { code: '481207', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: ilYa(0) },
};
const TRACK = { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '7731', lieu: 'Tabac de la Houle', carrier: 'chronopost', suivi: 'XW476115185FR', artTitle: 'Nike Air Force 1 blanche taille 42', receivedAt: ilYa(1), limite: ilYa(-3) };

const conv = (id, login, desc, unread, h, acc) => ({ id, unread, updated_at: ilYa(0, h), description: desc, opposite_user: { id: 5000 + id, login }, item_photos: id % 2 ? [ph()] : [] });
const msg = (uid, body, h) => ({ entity_type: 'message', entity: { user_id: uid, body, created_at_ts: ilYa(0, h) }, created_at_ts: ilYa(0, h) });
const FIL = { id: 301, opposite_user: { id: 5301, login: 'margaux_lp' }, transaction: { id: 9901, item_id: 4301 }, description: 'Nike Air Max 90 blanche taille 43', allow_reply: true,
  messages: [
    msg(5301, 'Bonjour ! Elle est toujours disponible ? Est-ce que la semelle est en bon état ?', 30),
    msg(Number(UID), 'Bonjour, oui toujours dispo 🙂 La semelle est en très bon état, portée 3 ou 4 fois.', 29),
    msg(5301, 'Super. Vous feriez 45 € ?', 5),
    { entity_type: 'offer_request_message', entity: { user_id: 5301, current: true, status: 10, status_title: '', price: { amount: '45.0' }, transaction_id: 9901, offer_request_id: 77 } },
  ] };
const ACCOUNTS = [
  { id: 1, vinted_user_id: UID, login: 'julatace35260', domain: 'www.vinted.fr', updated_at: ilYa(0) },
  { id: 2, vinted_user_id: UID2, login: 'tomj606', domain: 'www.vinted.fr', updated_at: ilYa(0) },
];
const cap = ilYa(0);
const LIGNES = [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'email_track_chronopost_XW476115185FR', data: TRACK },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: `harvest_${UID2}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_inbox`, data: { capturedAt: cap, payload: { conversations: [
    conv(301, 'margaux_lp', 'Super. Vous feriez 45 € ?', true, 5), conv(303, 'kevin.b', 'Merci, bien reçu, nickel !', false, 26),
    conv(305, 'sneakers_addict_du_35', 'Vous pouvez m’envoyer une photo de la semelle de près ?', true, 50),
  ] } } },
  { id: `harvest_${UID2}_inbox`, data: { capturedAt: cap, payload: { conversations: [conv(402, 'lea.m', 'Est-ce que vous faites un lot avec les Samba ?', false, 80), conv(404, 'antoine', 'D’accord, je réfléchis', false, 200)] } } },
  { id: `harvest_${UID}_conv_301`, data: { capturedAt: cap, payload: { conversation: FIL } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
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
const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${teintes[k % teintes.length]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

// Le pont de l'extension (ordinateur seulement) : Chrome connecté sur le compte 111.
const PONT = ({ fils }) => {
  const version = '5.190.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'vendeur@exemple.test', user_id: 'u1', cloisonne: false } });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'vendeur@exemple.test', user_id: 'u1' }, vinted: { uid: '111', login: 'julatace35260' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      const m = /conversations\/(\d+)$/.exec(d.endpoint || '');
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: d.method === 'GET' ? { conversation: (m && fils[m[1]]) || null } : {} }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

async function ouvrir(b, vp, tab) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); } catch (_) {} });
  if (!tel) await pg.addInitScript(PONT, { fils: { 301: FIL } });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}

// Mesure de l'écran rendu : débordement, textes coupés, cibles trop petites.
const mesurer = (pg, tel) => pg.evaluate((tel) => {
  const zones = [...document.querySelectorAll('.vrm-main, .vrm-chat-panel')];
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('details:not([open]) > :not(summary)'); };
  const coupes = [];
  for (const z of zones) for (const e of z.querySelectorAll('[data-montant], .vrm-pickup-code strong, .vrm-buy-price, [data-code-retrait]')) {
    if (!vis(e)) continue;
    if (e.scrollWidth > e.clientWidth + 1) coupes.push(e.textContent.trim().slice(0, 30));
    const p = e.closest('.vrm-buy-row, .vrm-pickup-card, .vrm-chat-panel');
    if (p) { const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); if (a.right > b.right + 1 || a.left < b.left - 1) coupes.push('hors carte : ' + e.textContent.trim().slice(0, 30)); }
  }
  const petits = [];
  if (tel) for (const z of zones) for (const e of z.querySelectorAll('button, summary, input:not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea, a')) {
    if (!vis(e)) continue;
    const s = getComputedStyle(e);
    if (e.tagName === 'A' && s.display === 'inline') continue;   // lien dans une phrase
    if (e.closest('[role=menu]')) continue;
    // Le résumé « Chiffres de la plateforme » appartient à l'en-tête commun
    // des plateformes (hors Achats et Messages) : jugé par son propre banc.
    if (e.closest('.vrm-platform-summary')) continue;
    const r = e.getBoundingClientRect();
    if (r.height < 43.5) petits.push(`${e.tagName.toLowerCase()} « ${(e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().slice(0, 28)} » ${Math.round(r.height)} px`);
  }
  return {
    deb: document.documentElement.scrollWidth - window.innerWidth,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    coupes, petits,
    nAchats: document.querySelectorAll('[data-achat-tx]').length,
    nCodes: document.querySelectorAll('.vrm-pickup-code').length,
    nConvs: document.querySelectorAll('[data-messagerie] [data-conv]').length,
    offre: (document.querySelector('[data-offre]') || { getAttribute: () => null }).getAttribute('data-offre'),
  };
}, tel);

const capturer = async (pg, nom, vp) => {
  await pg.screenshot({ path: path.join(SHOTS, `${nom}-${vp.width}-ecran.png`) });
  const h = await pg.evaluate(() => Math.max(...[...document.querySelectorAll('.vrm-main, .vrm-chat-history')].map((e) => e.scrollHeight), 0));
  if (h > vp.height) { await pg.setViewportSize({ width: vp.width, height: Math.min(h + 260, 5000) }); await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(SHOTS, `${nom}-${vp.width}.png`) }); await pg.setViewportSize(vp); await pg.waitForTimeout(300); }
};

(async () => {
  let b;
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const tel = vp.width < 600, T = vp.width + ' px';
      for (const [onglet, nomOnglet] of [['attente', 'a-retirer'], ['all', 'tous']]) {
        console.log(`\n── Achats · ${nomOnglet} · ${T}`);
        await essaie(`achats ${nomOnglet} ${T}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, vp, 'cat_achats');
          await pg.waitForFunction(() => document.querySelector('.vrm-pickup-code') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
          if (onglet === 'all') {
            await pg.evaluate(() => { const b = [...document.querySelectorAll('button[aria-pressed]')].find((x) => /^Tous/.test(x.innerText.trim())); if (b) b.click(); });
            await pg.waitForFunction(() => document.querySelectorAll('[data-achat-tx]').length >= 6, null, { timeout: 8000 }).catch(() => {});
          }
          await pg.waitForTimeout(900);
          const m = await mesurer(pg, tel);
          await capturer(pg, `achats-${nomOnglet}`, vp);
          dit(!m.tombe && !errs.length, `${T} l’écran s’affiche sans erreur`, errs.join(' | ').slice(0, 160));
          dit(m.deb <= 1, `${T} aucun débordement horizontal`, `${m.deb} px`);
          dit(!m.coupes.length, `${T} aucun montant ni code coupé`, m.coupes.join(' | '));
          if (tel) dit(!m.petits.length, `${T} aucune cible tactile < 44 px`, m.petits.slice(0, 8).join(' | '));
          if (onglet === 'attente') dit(m.nCodes >= 3, `${T} les codes de retrait sont là (3 colis)`, String(m.nCodes));
          else dit(m.nAchats >= 6, `${T} la liste des achats est là`, String(m.nAchats));
          await ctx.close();
        });
      }
      console.log(`\n── Messages · liste puis fil · ${T}`);
      await essaie(`messages ${T}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, 'cat_msg');
        await pg.waitForFunction(() => document.querySelectorAll('[data-messagerie] [data-conv]').length >= 3, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const l = await mesurer(pg, tel);
        await capturer(pg, 'messages-liste', vp);
        dit(!l.tombe && !errs.length, `${T} la liste s’affiche sans erreur`, errs.join(' | ').slice(0, 160));
        dit(l.deb <= 1, `${T} aucun débordement horizontal (liste)`, `${l.deb} px`);
        dit(l.nConvs === 5, `${T} les 5 conversations des deux comptes sont listées`, String(l.nConvs));
        if (tel) dit(!l.petits.length, `${T} aucune cible tactile < 44 px (liste)`, l.petits.slice(0, 8).join(' | '));
        await pg.click('[data-conv="301"]');
        await pg.waitForFunction(() => document.querySelector('.vrm-chat-panel [data-offre]'), null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(900);
        const f = await mesurer(pg, tel);
        await pg.screenshot({ path: path.join(SHOTS, `messages-fil-${vp.width}.png`) });
        dit(!f.tombe && !errs.length, `${T} le fil s’affiche sans erreur`, errs.join(' | ').slice(0, 160));
        dit(f.deb <= 1, `${T} aucun débordement horizontal (fil)`, `${f.deb} px`);
        dit(!!f.offre, `${T} l’offre de l’acheteuse est montrée dans le fil`, String(f.offre));
        dit(!f.coupes.length, `${T} aucun montant coupé dans le fil`, f.coupes.join(' | '));
        if (tel) dit(!f.petits.length, `${T} aucune cible tactile < 44 px (fil)`, f.petits.slice(0, 8).join(' | '));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${SHOTS}\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
