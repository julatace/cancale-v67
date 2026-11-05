// Banc : LES MESSAGES EN MOTS, LES OFFRES DANS LA LISTE (5 novembre).
//
// Julien : « les messages reçus doivent être beaucoup mieux agencés, on a le
// code et pas les vrais messages » ; « les offres dans les messages, avec marqué
// à côté l'offre ». Formes MESURÉES sur sa base (lecture seule, 5 nov.) — servies
// ici avec des données INVENTÉES (le dépôt est public) :
//   · `offer_message` (ses offres, 587) : affichée « currency_code: EUR » dans un
//     encadré « Colis · retrait » ;
//   · `action_message` : sous-titre en HTML (`<a class="msg-status__link">`, `<br/>`) ;
//   · `portal_message` (l'équipe Vinted) : corps en HTML ;
//   · la LISTE montrait la `description` de la boîte = le titre de l'annonce
//     (720 fois sur 1 095 conversations captées) ou un montant nu (« 45,00 € »).
// Exige, à 1512 px et 390 px tactile, en clair et en sombre :
//   1. l'extrait de chaque ligne = le DERNIER message réel quand le fil capté le
//      confirme (même instant que la boîte) — jamais le titre de la paire ;
//   2. une offre en dernier message est marquée « Offre » avec SON montant, à sa
//      conversation (« Ton offre 40 € », « Offre reçue 50 € · acceptée ») ; un
//      montant nu de la boîte devient « Offre 45 € » ;
//   3. aucun code nulle part (`currency_code`, `*_message`, `msg-status`, `<a `) ;
//   4. le fil : la carte d'offre « Ton offre 40,00 € au lieu de 55,00 € », le
//      sous-titre de Vinted sans HTML, l'équipe Vinted nommée, un évènement sans
//      texte non affiché ;
//   5. aucun débordement horizontal, aucune erreur de page.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7931;

const auj = Date.now();
const iso = (h) => new Date(Math.floor((auj - h * 3600e3) / 1000) * 1000).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) }];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const tx = (id, titre, extra = {}) => ({ id: 9000 + id, item_id: 700 + id, status: 1, current_user_side: 'seller', item_title: titre, ...extra });
const FILS = {
  // 501 : SON offre (offer_message) en dernier — la boîte dit le titre.
  501: { id: 501, opposite_user: { id: 5501, login: 'ach_501' }, transaction: tx(501, 'Salomon XT-6 noir 42'), messages: [
    { id: 1, created_at_ts: iso(30), entity_type: 'message', entity: { id: 1, user_id: 5501, body: 'Elle est encore dispo ?' } },
    { id: 2, created_at_ts: iso(20), entity_type: 'offer_message', entity: { user_id: 111, currency: 'EUR', current: true, price_fixed: false, price: { amount: '40.0', currency_code: 'EUR' }, original_price: { amount: '55.0', currency_code: 'EUR' }, price_label: '40,00 €', original_price_label: '55,00 €' } },
  ] },
  // 502 : un évènement de Vinted (HTML) en dernier.
  502: { id: 502, opposite_user: { id: 5502, login: 'ach_502' }, transaction: tx(502, 'Adidas Spezial bleu 41', { status: 230 }), messages: [
    { id: 3, created_at_ts: iso(25), entity_type: 'status_message', entity: { template: { style: 'clear_box' }, interpolation_values: {} } },
    { id: 4, created_at_ts: iso(19), entity_type: 'action_message', entity: { title: 'Envoie ta commande', subtitle: 'Dépose ton colis au <a href="/" class="msg-status__link react-drop-off-point-map-link" target="_blank">point relais</a> le plus proche.<br/><br/>Garde le rythme.', template: { style: 'gray_box' }, interpolation_values: { subtitle: { carrier_name: 'Mondial Relay' } }, actions: [{ action: 'print', title: 'Imprimer le bordereau', primary: true }], notification: 'x' } },
  ] },
  // 503 : un vrai message de l'acheteur en dernier — la boîte dit le titre ;
  //       plus tôt, un message de l'équipe Vinted en HTML.
  503: { id: 503, opposite_user: { id: 5503, login: 'ach_503' }, transaction: tx(503, 'Nike Air Max 90 blanc 43'), messages: [
    { id: 5, created_at_ts: iso(40), entity_type: 'portal_message', entity: { id: 5, user_id: null, body: '<p>Bonjour,</p><p>Ton échange est protégé par Vinted.</p>', photos: [], is_hidden: false, safety_flag: 0, sent_via_mobile: false } },
    { id: 6, created_at_ts: iso(18), entity_type: 'message', entity: { id: 6, user_id: 5503, body: 'Vous feriez 30 € ?' } },
  ] },
  // 505 : une offre REÇUE acceptée en dernier.
  505: { id: 505, opposite_user: { id: 5505, login: 'ach_505' }, transaction: tx(505, 'Asics Gel-Lyte III gris 40'), messages: [
    { id: 7, created_at_ts: iso(16), entity_type: 'offer_request_message', entity: { id: 7, user_id: 5505, current: true, status: 20, status_title: '- Offre acceptée', title: 'Hey, ach_505 t’a fait une offre', body: '50,00 €', price: { amount: '50.0', currency_code: 'EUR' }, original_price: { amount: '60.0', currency_code: 'EUR' }, transaction_id: 9505, offer_request_id: 905 } },
  ] },
  // (relecture) 506 : le fil capté est PLUS RÉCENT que la boîte et SA réponse est
  //       le dernier message — elle doit se lire « Toi : … », jamais comme celle
  //       de l'acheteur (`auteurDernierConfirme` exige le même instant, il se tait).
  506: { id: 506, opposite_user: { id: 5506, login: 'ach_506' }, transaction: tx(506, 'New Balance 550 vert 44'), messages: [
    { id: 8, created_at_ts: iso(16), entity_type: 'message', entity: { id: 8, user_id: 5506, body: 'Vous l’envoyez quand ?' } },
    { id: 9, created_at_ts: iso(14.5), entity_type: 'message', entity: { id: 9, user_id: 111, body: 'Je la dépose demain matin' } },
  ] },
  // (relecture) 507 : une offre reçue ANNULÉE (statut 40, « Annulée », 22 mesurées).
  507: { id: 507, opposite_user: { id: 5507, login: 'ach_507' }, transaction: tx(507, 'Puma Suede rouge 39'), messages: [
    { id: 10, created_at_ts: iso(13), entity_type: 'offer_request_message', entity: { id: 10, user_id: 5507, current: true, status: 40, status_title: 'Annulée', title: 'Hey', body: '35,00 €', price: { amount: '35.0', currency_code: 'EUR' }, transaction_id: 9507, offer_request_id: 907 } },
  ] },
  // (relecture) 508 : statut 10 mais `current: false` — le fil dit « Offre
  //       précédente » : la liste ne doit pas la dire « en attente ».
  508: { id: 508, opposite_user: { id: 5508, login: 'ach_508' }, transaction: tx(508, 'Vans Old Skool noir 42'), messages: [
    { id: 11, created_at_ts: iso(12), entity_type: 'offer_request_message', entity: { id: 11, user_id: 5508, current: false, status: 10, status_title: 'En attente', title: 'Hey', body: '30,00 €', price: { amount: '30.0', currency_code: 'EUR' }, transaction_id: 9508, offer_request_id: 908 } },
  ] },
};
const rows = [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [
    conv(501, 'ach_501', 'Salomon XT-6 noir 42', false, 20),
    conv(502, 'ach_502', 'Adidas Spezial bleu 41', false, 19),
    conv(503, 'ach_503', 'Nike Air Max 90 blanc 43', true, 18),
    conv(504, 'ach_504', '45,00 €', true, 17),
    conv(505, 'ach_505', 'Asics Gel-Lyte III gris 40', false, 16),
    conv(506, 'ach_506', 'Vous l’envoyez quand ?', false, 15),
    conv(507, 'ach_507', 'Puma Suede rouge 39', false, 13),
    conv(508, 'ach_508', 'Vans Old Skool noir 42', false, 12),
  ] } } },
  ...[501, 502, 503, 505, 506, 507, 508].map((id) => ({ id: `harvest_111_conv_${id}`, data: { capturedAt: iso(0), payload: { conversation: FILS[id] } } })),
];

const contient = (a, b) => {
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x)));
  if (b && typeof b === 'object') return !!a && typeof a === 'object' && !Array.isArray(a) && Object.keys(b).every((k) => contient(a[k], b[k]));
  return a === b;
};
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
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    // `->>` rend du TEXTE (comme PostgREST) : un nombre devient une chaîne.
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const PONT = ({ version, fils }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_a' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      const idc = (/\/conversations\/(\d+)$/.exec(d.endpoint || '') || [])[1];
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: d.method === 'GET' ? { conversation: fils[idc] } : {} }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { tel, sombre }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ '701': { numero: '31' } })); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: '5.322.0', fils: FILS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const cs = /[?&](data(?:->[^=&]+)+)=cs\.([^&]*)/.exec(u);
    const garde = cs ? (r) => { let v = r.data; for (const seg of cs[1].replace(/^data->/, '').split('->')) v = v == null ? null : v[seg]; try { return contient(v, JSON.parse(cs[2])); } catch (_) { return false; } } : () => true;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1] && garde(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && garde(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  if (await pg.$('#vrm-sel-compte')) { await pg.selectOption('#vrm-sel-compte', '*').catch(() => {}); await pg.waitForTimeout(300); }
  await pg.waitForTimeout(900);
  return { ctx, pg, errs };
}

const CODES = /currency_code|[a-z]+_message\b|msg-status|<a\s|<br|<p>|gray_box|clear_box/;

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [tel, sombre] of [[false, false], [true, false], [false, true], [true, true]]) {
      const nom = `${tel ? '390 px tactile' : '1512 px'} · ${sombre ? 'sombre' : 'clair'}`;
      console.log('── ' + nom);
      const r = await rendre(b, { tel, sombre });
      try {
        const L = await r.pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => {
          const ex = x.querySelector('.vrm-msg-extrait'); const od = x.querySelector('[data-offre-derniere]');
          return [x.getAttribute('data-conv'), { txt: x.innerText, extrait: ex ? ex.innerText : null, kind: ex ? ex.getAttribute('data-conv-extrait') : null, offre: od ? { m: od.getAttribute('data-offre-derniere'), sens: od.getAttribute('data-offre-sens'), etat: od.getAttribute('data-offre-etat'), txt: od.innerText } : null }];
        })));
        dit(Object.keys(L).length === 8, 'les huit conversations sont listées', JSON.stringify(Object.keys(L)));
        const l503 = L['503'] || {}, l501 = L['501'] || {}, l502 = L['502'] || {}, l504 = L['504'] || {}, l505 = L['505'] || {};
        dit(/Vous feriez 30 € \?/.test(l503.extrait || '') && l503.kind === 'message', 'l’extrait est le VRAI dernier message (pas le titre de l’annonce)', JSON.stringify(l503.extrait));
        dit(!/Air Max 90 blanc 43/.test(l503.extrait || '') && /Air Max 90 blanc 43/.test(l503.txt || ''), 'le titre de la paire reste sur SA ligne, jamais dans l’extrait', (l503.txt || '').replace(/\n/g, ' | '));
        dit(l501.offre && l501.offre.m === '40' && l501.offre.sens === 'envoyee' && /Ton offre/.test(l501.offre.txt) && /40/.test(l501.offre.txt) && /55/.test(l501.offre.txt), 'son offre en dernier : « Ton offre 40 € » (55 € barré) à SA conversation', JSON.stringify(l501.offre));
        dit(!/Salomon XT-6 noir 42/.test(l501.extrait || ''), 'pas le titre de la paire en guise de message', JSON.stringify(l501.extrait));
        dit(/^Vinted : Envoie ta commande/.test(l502.extrait || '') && l502.kind === 'event', 'un évènement de Vinted en dernier : dit en mots, « Vinted : … »', JSON.stringify(l502.extrait));
        dit(l504.offre && l504.offre.m === '45' && /^Offre\b/.test(l504.offre.txt) && /45/.test(l504.offre.txt), 'un montant nu de la boîte devient « Offre 45 € »', JSON.stringify(l504.offre));
        dit(l505.offre && l505.offre.sens === 'recue' && l505.offre.etat === 'acceptee' && /Offre reçue/.test(l505.offre.txt) && /acceptée/.test(l505.offre.txt), 'une offre reçue tranchée : « Offre reçue 50 € · acceptée »', JSON.stringify(l505.offre));
        const l506 = L['506'] || {}, l507 = L['507'] || {}, l508 = L['508'] || {};
        dit(/^Toi : Je la dépose demain matin/.test(l506.extrait || '') && l506.kind === 'message', 'fil capté plus récent que la boîte : SA réponse se lit « Toi : … », pas comme celle de l’acheteur', JSON.stringify(l506.extrait));
        dit(l507.offre && l507.offre.etat === 'terminee' && /Offre reçue/.test(l507.offre.txt) && /annulée/.test(l507.offre.txt), 'une offre reçue annulée le dit (« · annulée »), par la règle du fil', JSON.stringify(l507.offre));
        dit(l508.offre && !l508.offre.etat && !/en attente/.test(l508.txt || ''), 'une offre précédente (statut 10, current false) n’est jamais dite « en attente »', JSON.stringify(l508.offre) + ' ' + JSON.stringify(l508.txt));
        const listeTxt = await r.pg.evaluate(() => (document.querySelector('[data-messagerie]') || {}).innerText || '');
        dit(!CODES.test(listeTxt), 'aucun code dans la liste', (listeTxt.match(CODES) || [''])[0]);

        if (process.env.SHOTS) await r.pg.screenshot({ path: path.join(process.env.SHOTS, `liste-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}.png`) });
        // Le fil de 501 : la carte d'offre.
        await r.pg.click('[data-conv="501"]'); await r.pg.waitForTimeout(1400);
        const f501 = await r.pg.evaluate(() => { const p = document.querySelector('.vrm-chat-panel'); const o = [...document.querySelectorAll('.vrm-chat-offer-event')]; return { txt: p ? p.innerText : '', offres: o.map((x) => x.innerText.replace(/\n/g, ' | ')) }; });
        dit(f501.offres.length === 1 && /Ton offre/.test(f501.offres[0]) && /40(,00)?\s?€/.test(f501.offres[0]) && /au lieu de/.test(f501.offres[0]) && /55(,00)?\s?€/.test(f501.offres[0]), 'le fil : « Ton offre 40,00 € au lieu de 55,00 € »', JSON.stringify(f501.offres));
        dit(!CODES.test(f501.txt) && !/Colis · retrait/.test(f501.txt), 'le fil n’affiche aucun code (ni « currency_code: EUR », ni « Colis · retrait »)', (f501.txt.match(/currency_code[^\n]*|Colis · retrait/) || [''])[0]);
        if (tel) { await r.pg.locator('.vrm-chat-back').first().click().catch(() => {}); await r.pg.waitForTimeout(500); }
        // Le fil de 502 : l'évènement sans HTML, le vide caché.
        await r.pg.click('[data-conv="502"]'); await r.pg.waitForTimeout(1400);
        const f502 = await r.pg.evaluate(() => { const p = document.querySelector('.vrm-chat-panel'); return p ? p.innerText : ''; });
        dit(/Envoie ta commande/.test(f502) && /au point relais le plus proche/.test(f502) && /Garde le rythme/.test(f502), 'l’évènement de Vinted en mots, le texte du lien gardé', f502.replace(/\n/g, ' | ').slice(0, 220));
        dit(!CODES.test(f502), 'sans HTML ni nom de type (status_message vide caché)', (f502.match(CODES) || [''])[0]);
        if (tel) { await r.pg.locator('.vrm-chat-back').first().click().catch(() => {}); await r.pg.waitForTimeout(500); }
        // Le fil de 503 : l'équipe Vinted nommée, sans HTML.
        await r.pg.click('[data-conv="503"]'); await r.pg.waitForTimeout(1400);
        const f503 = await r.pg.evaluate(() => { const p = document.querySelector('.vrm-chat-panel'); return p ? p.innerText : ''; });
        dit(/Équipe Vinted · Bonjour,/.test(f503) && /Ton échange est protégé par Vinted\./.test(f503) && !CODES.test(f503), 'le message de l’équipe Vinted est nommé, sans HTML', f503.replace(/\n/g, ' | ').slice(0, 200));
        dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'aucun débordement horizontal');
        dit(r.errs.length === 0, 'aucune erreur de page', r.errs.join(' / '));
        if (process.env.SHOTS) await r.pg.screenshot({ path: path.join(process.env.SHOTS, `messages-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}.png`) });
      } finally { await r.ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a levé', String(e && e.stack || e)); }
  finally { if (b) await b.close(); srv.close(); console.log(ko ? `\n${ko} KO` : '\nTout est vert'); process.exitCode = ko ? 1 : 0; }
})();
