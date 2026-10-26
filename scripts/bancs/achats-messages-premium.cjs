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
const FIL = { id: 301, opposite_user: { id: 5301, login: 'margaux_lp' }, transaction: { id: 9901, item_id: 4301,item_title:'Nike Air Max 90 blanche taille 43' }, description: 'Nike Air Max 90 blanche taille 43', allow_reply: true,
  messages: [
    msg(5301, 'Bonjour ! Elle est toujours disponible ? Est-ce que la semelle est en bon état ?', 30),
    msg(Number(UID), 'Bonjour, oui toujours dispo 🙂 La semelle est en très bon état, portée 3 ou 4 fois.', 29),
    msg(5301, 'Super. Vous feriez 45 € ?', 5),
    { entity_type:'offer_request_message',created_at_ts:ilYa(0,6),entity:{user_id:Number(UID),current:false,status:20,status_title:'Offre précédente',price:{amount:'50.00',currency_code:'EUR'}} },
    { entity_type: 'offer_request_message',created_at_ts:ilYa(0,4.5), entity: { user_id: 5301, current: true, status: 10, status_title: '', price: { amount: '45.0',currency_code:'EUR' }, transaction_id: 9901, offer_request_id: 77 } },
  ] };
// Native message identities are stable across stored and refreshed copies.
FIL.messages=FIL.messages.map((m,i)=>({...m,id:i+1,entity:{...m.entity,id:i+1}}));
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
  { id: `harvest_${UID}_notifications`, owner:'0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', data:{uid:UID,type:'notifications',domain:'www.vinted.fr',payload:{notifications:[{id:'favori-banc-1',body:'Camille a ajouté ton article à ses favoris.',link:'/items/101/conversation/new?native_target=201',user_id:701,updated_at:new Date(MAINT).toISOString()}],pagination:{total_pages:2}}} },
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
  let version = '5.216.0';
  window.majExtensionFavoris=()=>{version='5.226.0';post({__vmr:'ready',version});};
  const post = (m) => window.postMessage({id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',...m}, '*');
  Object.defineProperty(window.chrome,'runtime',{configurable:true,value:{sendMessage:(id,m,cb)=>{
    if(id!=='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')return cb(null);
    if(m.type==='favorisEtat')return cb({ok:true,ext:id,version,code:version,vrm:{ok:true,connecte:true,email:'banc@vrm.test',user_id:'0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'},vinted:{uid:'111',login:'julatace35260'},cmds:{}});
    if(m.type==='favorisOuvrir'){window.favorisOuvertures=window.favorisOuvertures||[];window.favorisOuvertures.push(m);return cb({ok:true,status:200,data:{ouvert:true,preuve:'confirmee',version}});}
    if(m.type==='favorisExec'){window.favorisExec=window.favorisExec||[];window.favorisExec.push(m);return cb({ok:true,status:200,data:{resultat:'envoye'}});}
    cb(null);
  }}});
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */, cloisonne: false } });
    if (d.__vmr === 'etat'&&version==='5.216.0') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code:version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */ }, vinted: { uid: '111', login: 'julatace35260' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      window.favorisExec=window.favorisExec||[];if(d.endpoint==='/vrm/favoris')window.favorisExec.push(d);
      const m = /conversations\/(\d+)$/.exec(d.endpoint || '');
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: d.method === 'GET' ? { conversation: (m && fils[m[1]]) || null } : d.endpoint==='/vrm/favoris'?{resultat:'envoye'}:{} }), 50);
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
  const prefsFavoris=new Map();
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if(route.request().method()==='POST'&&u.includes('on_conflict=owner,id')){const row=route.request().postDataJSON();if(row.id?.startsWith('vrm_favoris_reglages_')){prefsFavoris.set(row.id,row);return j([row]);}}
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if(eq&&prefsFavoris.has(eq[1]))return j([prefsFavoris.get(eq[1])]);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  let fileFavoris={active:false,raison:'',jobs:[]};
  await pg.route('**/api/**',r=>{
    if(!r.request().url().includes('mode=favoris'))return r.fulfill({status:200,contentType:'application/json',body:'{"pret":true}'});
    const c=r.request().method()==='POST'?r.request().postDataJSON():{};let out={ok:true,vue:fileFavoris};
    if(c.action==='lancer'){fileFavoris={active:true,raison:'',jobs:[{id:'j1',notificationId:'favori-banc-1',etat:'attente'}]};out={ok:true,vue:fileFavoris};}
    if(c.action==='suivant'){fileFavoris={...fileFavoris,jobs:[{id:'j1',notificationId:'favori-banc-1',etat:'reserve'}]};out={ok:true,vue:fileFavoris,travail:{jeton:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}};}
    if(c.action==='terminer'){fileFavoris={active:false,raison:'',jobs:[{id:'j1',notificationId:'favori-banc-1',etat:c.resultat}]};out={ok:true,vue:fileFavoris};}
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)});
  });
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
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
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
          if (onglet === 'attente') {
            const lignes = await pg.evaluate(() => [...document.querySelectorAll('.vrm-pickup-card')].map(e => {
              const info=e.querySelector(':scope > div:first-of-type'), code=e.querySelector('.vrm-pickup-code'), bouton=e.querySelector('.vrm-pickup-collect');
              if (!info || !code || !bouton) return null;
              const a=info.getBoundingClientRect(), b=code.getBoundingClientRect(), c=bouton.getBoundingClientRect();
              const chiffre=code.querySelector('strong').getBoundingClientRect(), copie=code.querySelector('small').getBoundingClientRect();
              return {aligne:b.left>=a.right-1&&chiffre.right<=copie.left+1&&chiffre.left>=b.left&&copie.right<=b.right+1, compact:c.height<=48, code:code.querySelector('strong')?.innerText};
            }).filter(Boolean));
            dit(lignes.length>0 && lignes.every(x=>x.aligne&&x.compact), `${T} codes à droite des articles et confirmation compacte`, JSON.stringify(lignes));
          }
          await ctx.close();
        });
      }
      console.log(`\n── Messages · liste puis fil · ${T}`);
      await essaie(`messages ${T}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, 'cat_msg');
        await pg.waitForFunction(() => document.querySelectorAll('[data-messagerie] [data-conv]').length === 5, null, { timeout: 30000 });
        await pg.waitForTimeout(1500);
        const l = await mesurer(pg, tel);
        await capturer(pg, 'messages-liste', vp);
        dit(!l.tombe && !errs.length, `${T} la liste s’affiche sans erreur`, errs.join(' | ').slice(0, 160));
        dit(l.deb <= 1, `${T} aucun débordement horizontal (liste)`, `${l.deb} px`);
        dit(l.nConvs === 5, `${T} les 5 conversations des deux comptes sont listées`, String(l.nConvs));
        if (tel) dit(!l.petits.length, `${T} aucune cible tactile < 44 px (liste)`, l.petits.slice(0, 8).join(' | '));
        await pg.selectOption('#vrm-sel-compte', UID);
        await pg.getByRole('button',{name:'Favoris reçus',exact:true}).click();
        await pg.locator('.vrm-favoris-rows article').first().waitFor();
        dit(await pg.locator('.vrm-favoris-rows article').count()===1, `${T} la liste des favoris captés est raccordée au compte`);
        await pg.locator('.vrm-favoris-rows input[type=checkbox]').check();
        dit(await pg.getByRole('textbox',{name:'Ton message',exact:true}).count()===1, `${T} sélectionner un favori ouvre la préparation du message`);
        if(!tel){
          await pg.getByRole('textbox',{name:'Ton message',exact:true}).fill('Merci pour ton favori !');
          await pg.getByRole('button',{name:'Lancer les envois sélectionnés',exact:true}).click();
          await pg.getByRole('alert').filter({hasText:'5.226'}).waitFor();
          dit(await pg.evaluate(()=>!window.favorisExec?.length),`${T} ancien code : blocage expliqué sans message`);
          await pg.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.controleOuverture=t}}));
          await pg.getByRole('button',{name:'Vérifier le premier sélectionné',exact:true}).click();
          await pg.getByRole('alert').filter({hasText:'Vérification interrompue'}).waitFor();
          await pg.getByRole('button',{name:'Copier le contrôle',exact:true}).click();
          const avantMaj=await pg.evaluate(()=>JSON.parse(window.controleOuverture));
          dit(avantMaj.extension==='5.216.0'&&avantMaj.etape==='connexion'&&avantMaj.code==='extension_a_actualiser',`${T} refus avant ouverture : version mesurée et cause conservées`);
          dit(await pg.evaluate(()=>!window.favorisOuvertures?.length&&!window.favorisExec?.length),`${T} précontrôle refusé : aucune ouverture ni message`);
          await pg.evaluate(()=>window.majExtensionFavoris());
          await pg.getByRole('button',{name:'Vérifier le premier sélectionné',exact:true}).click();
          await pg.getByText('Lien enregistré',{exact:true}).waitFor();
          dit(await pg.evaluate(()=>window.favorisOuvertures?.length===1&&window.favorisOuvertures[0].body.notificationId==='favori-banc-1'&&!('url' in window.favorisOuvertures[0].body)),`${T} le bouton vérifie le favori capté par son identifiant, sans URL libre`);
          dit(await pg.evaluate(()=>!window.favorisExec?.length),`${T} vérifier le lien ne lance aucun message`);
          await pg.evaluate(()=>window.dispatchEvent(new Event('focus')));
          await pg.waitForFunction(()=>!document.querySelector('.vrm-favoris-check input:checked'));
          await pg.getByRole('checkbox',{name:/Sélectionner Camille/}).check();

          await pg.getByRole('button',{name:'Lancer les envois sélectionnés',exact:true}).click();
          await pg.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor().catch(async e=>{await pg.screenshot({path:path.join(SHOTS,'favoris-echec.png'),fullPage:true});console.log(await pg.locator('.vrm-favoris-liste').innerText());throw e;});
          dit(await pg.evaluate(()=>window.favorisExec?.length===1&&window.favorisExec[0].uid==='111'&&window.favorisExec[0].body.jeton==='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),`${T} le lancement passe une seule autorisation au pont du compte choisi`);
        }else{
          await pg.getByRole('button',{name:'Lancer les envois sélectionnés',exact:true}).click();
          await pg.getByRole('alert').filter({hasText:'extension'}).waitFor();
          dit(await pg.evaluate(()=>!window.favorisExec?.length),`${T} téléphone sans extension : explication et aucun lancement`);
        }
        await pg.locator('.vrm-favoris-liste').getByRole('button',{name:'Masquer',exact:true}).click();
        await pg.getByRole('button',{name:'Conversations',exact:true}).click();
        dit(await pg.locator('.vrm-favoris-rows').count()===0, `${T} masquer la liste rend la place aux conversations`);
        await pg.selectOption('#vrm-sel-compte', '*');
        await pg.click('[data-conv="301"]');
        await pg.waitForFunction(() => document.querySelector('.vrm-chat-panel [data-offre]'), null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(900);
        const f = await mesurer(pg, tel);
        await pg.screenshot({ path: path.join(SHOTS, `messages-fil-${vp.width}.png`) });
        dit(!f.tombe && !errs.length, `${T} le fil s’affiche sans erreur`, errs.join(' | ').slice(0, 160));
        dit(f.deb <= 1, `${T} aucun débordement horizontal (fil)`, `${f.deb} px`);
        dit((await pg.locator('.vrm-chat-head-s').innerText()).includes('Nike Air Max 90 blanche taille 43'),`${T} l’en-tête montre l’article réel, pas le dernier message`);
        dit(!!f.offre, `${T} l’offre de l’acheteuse est montrée dans le fil`, String(f.offre));
        dit(await pg.locator('.vrm-chat-offer-event[data-offer-side="recue"]').count()===1&&await pg.locator('.vrm-chat-offer-event[data-offer-side="envoyee"]').count()===1,`${T} historique : offres reçues et envoyées clairement distinguées`);
        if(!tel){
        dit(await pg.locator('.vrm-chat-negociation').getAttribute('open')===null,`${T} la contre-offre est repliée pour laisser la place aux messages`);
        await pg.getByText('Proposer un autre prix',{exact:true}).click();
        dit(await pg.getByRole('textbox',{name:"Prix de l'offre",exact:true}).isVisible(),`${T} proposer un autre prix ouvre le champ sans envoyer`);

        }else dit(await pg.locator('.vrm-chat-prix').count()===0,`${T} sans extension : aucun formulaire de contre-offre inutilisable`);
        dit(!f.coupes.length, `${T} aucun montant coupé dans le fil`, f.coupes.join(' | '));
        if (tel) dit(!f.petits.length, `${T} aucune cible tactile < 44 px (fil)`, f.petits.slice(0, 8).join(' | '));
        await ctx.close();
      });
      if(!tel) await essaie('sélection souris sans navigation',async()=>{
        const {ctx,pg}=await ouvrir(b,vp,'plat_vinted');
        const actif=pg.locator('.vrm-rail-button[aria-label="Vinted"]');await actif.waitFor();
        await pg.waitForFunction(()=>document.querySelector('.vrm-rail-button[aria-label="Vinted"]')?.getAttribute('aria-current')==='page');
        const box=await pg.evaluate(()=>{const e=document.createElement('div');e.id='banc-selection';e.style.cssText='position:absolute;z-index:900;left:400px;top:230px;width:650px;height:60px;padding-left:120px;background:white;color:black;user-select:text';e.textContent='Texte de démonstration à sélectionner sans changer de plateforme';document.querySelector('.vrm-app-shell').append(e);const r=e.getBoundingClientRect();return{x:r.x,y:r.y};});
        await pg.mouse.move(box.x+5,box.y+15);await pg.mouse.down();await pg.mouse.move(box.x+550,box.y+15,{steps:15});await pg.mouse.up();
        dit(await actif.getAttribute('aria-current')==='page','glisser depuis une marge ne quitte pas Vinted');
        dit(await pg.evaluate(()=>document.body.style.userSelect!=='none'),'le geste ne désactive pas la sélection du navigateur');
        await pg.evaluate(()=>{const e=document.getElementById('banc-selection'),r=document.createRange();r.selectNodeContents(e);window.getSelection().removeAllRanges();window.getSelection().addRange(r);});
        await pg.mouse.move(box.x+10,box.y+45);await pg.mouse.down();await pg.mouse.move(box.x+500,box.y+45,{steps:12});await pg.mouse.up();
        dit(await actif.getAttribute('aria-current')==='page','relâcher un deuxième glissement reste sur le même compte');
        await pg.evaluate(()=>document.getElementById('banc-selection').remove());
        await pg.locator('.vrm-rail-button[aria-label="Leboncoin"]').click();
        dit(await pg.locator('.vrm-rail-button[aria-label="Leboncoin"]').getAttribute('aria-current')==='page','le clic explicite sur Leboncoin fonctionne toujours');
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${SHOTS}\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
