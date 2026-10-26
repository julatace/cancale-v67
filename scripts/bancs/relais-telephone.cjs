// Banc : LE RELAIS DU TÉLÉPHONE (16 octobre, extension 5.183).
//
// Julien : « quand je suis sur mon téléphone et que l'extension est allumée
// [sur mon ordinateur] je veux pouvoir faire des actions ». L'app RENDUE (build
// de dist/), sur un téléphone (390 px, `isMobile + hasTouch` : pointeur
// grossier, aucun survol — ce que l'app mesure), avec une base À ÉTAT : le
// signe de vie de l'extension (`relais_ext`) et les lignes de commande
// (`cmd_relais_*`) que le téléphone écrit ; « l'extension » est simulée par le
// banc, qui fait avancer ces lignes (prise, en cours, fait, refus) — ou ne les
// prend jamais. Données INVENTÉES (le dépôt est public). Ce qu'il exige :
//   1. relais vivant ⇒ les boutons d'action sont actifs, la pastille dit
//      « Actions via ton ordinateur · {compte} », la phrase « via ton
//      ordinateur » est dite UNE fois au-dessus de la liste ;
//   2. un clic ÉCRIT la commande, dans la bonne forme (cmd, args, pour,
//      échéance 10 min, etat « attente ») — et rien d'autre ;
//   3. « envoyé à ton ordinateur… » tant que personne ne l'a prise, puis ce que
//      L'EXTENSION a écrit (en cours, fait, refus avec sa raison) — jamais
//      « fait » avant elle ;
//   4. pas prise en 2 min (raccourci au banc) ⇒ annulée par une écriture
//      CONDITIONNELLE (etat=attente), et c'est dit ;
//   5. compte ouvert sur l'ordinateur ≠ compte de la vente ⇒ grisé AVANT le
//      clic, avec la raison ;
//   6. relais éteint (signe de vie de 10 min) ⇒ grisé, « pas donné signe de vie
//      depuis 10 min » ; lecture ratée ⇒ grisé, AUCUNE promesse ;
//   7. messagerie : refuser une offre passe par le relais et dit le résultat de
//      l'extension ; accepter DEMANDE d'abord, puis la ligne porte `confirme` ;
//   8. l'autre sens, sur ordinateur (1512 px, sans extension) : le relais n'est
//      pas utilisé, même pas lu.
// On juge les ÉTATS (`data-*`) et ce qui est ÉCRIT dans la base.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4941;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeuse@exemple.fr' } };
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const VENTES = Array.from({ length: 4 }, (_, i) => ({ transaction_id: 7001 + i, title: `Paire banc ${i + 1}`, price: { amount: '50', currency_code: 'EUR' },
  status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(1 + i / 10) }));
const FIL_OFFRE = { id: 301, opposite_user: { id: 5301, login: 'acheteuse_1' }, transaction: { id: 9001, item_id: 444 }, description: 'Nike Air Max 1',
  messages: [
    { entity_type: 'message', entity: { user_id: 5301, body: 'Bonjour, vous feriez 45 € ?' } },
    { entity_type: 'offer_request_message', entity: { user_id: 5301, current: true, status: 10, status_title: '', price: { amount: '45.0' }, transaction_id: 9001, offer_request_id: 77 } },
  ] };
const LIGNES = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [{ id: 301, unread: true, updated_at: iso(1), description: 'Vous feriez 45 € ?', opposite_user: { id: 5301, login: 'acheteuse_1' } }] } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: FIL_OFFRE } } },
];

let ko = 0, okN = 0;
const dit = (c, m, d) => { if (!c) ko++; else okN++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'owner') { out[alias] = row.owner || null; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    const texte = /->>[^>]*$/.test(src);
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

// `relais` : le signe de vie servi ({ageMin, vUid, vLogin, ver}) · 'ko' (522) · null (aucun).
// `plan(cmd)` : ce que « l'extension » fait de chaque commande : [{ms, etat, resultat}] ou [] (jamais prise).
async function rendre(b, { tel = true, relais = null, plan = () => [], tab = 'cat_bord', attente = 4500 }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => {
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    // Le banc ne peut pas attendre 2 min : les durées du relais sont raccourcies.
    window.__VRM_RELAIS_TEMPS = { prise: 4000, pas: 250, suivi: 250, lecture: 2000, pris: 8000 };
  }, SESSION);
  const cmds = {}, journal = { posts: [], patchs: [], lecturesRelais: 0 };
  const sert = (route, status, d) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => sert(r, 200, { access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    if (/select=owner/.test(u)) return sert(route, 200, []);               // base cloisonnée
    if (/select=id&limit=1/.test(u)) return sert(route, 200, []);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return sert(route, 200, ACCS);
    if (m === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let rows = []; try { rows = JSON.parse(req.postData() || '[]'); } catch (_) {}
      for (const r of [].concat(rows)) if (r && /^cmd_relais_/.test(r.id)) {
        journal.posts.push(JSON.parse(JSON.stringify(r)));
        cmds[r.id] = { id: r.id, owner: r.owner, data: r.data };
        for (const pas of plan(r)) setTimeout(() => { const c = cmds[r.id]; if (c && c.data.etat !== 'annulee') c.data = Object.assign({}, c.data, { etat: pas.etat }, pas.resultat ? { resultat: pas.resultat } : {}); }, pas.ms);
      }
      return sert(route, 201, []);
    }
    if (m === 'PATCH' && /cmd_relais_/.test(u)) {
      const id = (/id=eq\.([^&]+)/.exec(u) || [])[1], cond = (/data->>etat=eq\.([^&]+)/.exec(u) || [])[1];
      let corps = {}; try { corps = JSON.parse(req.postData() || '{}'); } catch (_) {}
      journal.patchs.push({ id, cond: cond || null, etat: corps.data && corps.data.etat });
      const c = cmds[id];
      if (!c || (cond && c.data.etat !== cond)) return sert(route, 200, []);
      c.data = corps.data; return sert(route, 200, [{ id }]);
    }
    if (m !== 'GET') return sert(route, 200, []);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'relais_ext') {
      journal.lecturesRelais++;
      if (relais === 'ko') return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      if (!relais) return sert(route, 200, []);
      const row = { id: 'relais_ext', data: { atMs: Date.now() - (relais.ageMin || 0) * 60000, ver: relais.ver || '5.183.0', code: relais.ver || '5.183.0', vUid: relais.vUid || '', vLogin: relais.vLogin || '', pauseJusqua: 0 } };
      return sert(route, 200, [projette(row, sel)]);
    }
    if (eq && cmds[eq[1]]) return sert(route, 200, [projette(cmds[eq[1]], sel)]);
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    if (eq) return sert(route, 200, LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return sert(route, 200, LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return sert(route, 200, []);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(attente);
  return { ctx, pg, errs, cmds, journal };
}
const bouton = (pg, tx) => pg.evaluate((tx) => { const e = document.querySelector(`[data-bouton-bord][data-tx="${tx}"]`); return e ? { etat: e.getAttribute('data-bouton-bord'), relais: e.getAttribute('data-relais'), txt: e.innerText, titre: (e.querySelector('button') || {}).title || '' } : null; }, String(tx));
const pastille = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-etat-actions]'); return e ? { niveau: e.getAttribute('data-etat-actions'), relais: e.getAttribute('data-etat-relais'), code: e.getAttribute('data-etat-code'), aria: e.getAttribute('aria-label'), txt: e.innerText } : null; });
const cliquer = (pg, tx) => pg.evaluate((tx) => { const b = document.querySelector(`[data-bouton-bord][data-tx="${tx}"] button`); if (b) b.click(); return !!b; }, String(tx));

(async () => {
  let b;
  await new Promise((r) => srv.listen(PORT, r));
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const VIVANT = { ageMin: 0.2, vUid: '111', vLogin: 'compte_a' };

    console.log('── 1. Relais vivant (téléphone) : les boutons sont actifs');
    {
      const plan = (row) => {
        const tx = row.data.args && row.data.args.tx;
        if (tx === '7001') return [{ ms: 900, etat: 'pris' }, { ms: 1800, etat: 'refuse', resultat: { accepte: false, code: 'vinted-autre', actifLogin: 'compte_b', raison: 'Chrome est connecté sur compte_b sur ton ordinateur — bascule sur le bon compte sur vinted.fr' } }];
        if (tx === '7002') return [{ ms: 1500, etat: 'pris' }, { ms: 3000, etat: 'en-cours', resultat: { accepte: true, jobId: 'bord:111:7002', etape: 'file' } }, { ms: 4500, etat: 'en-cours', resultat: { accepte: true, jobId: 'bord:111:7002', etape: 'pdf' } }, { ms: 6500, etat: 'fait', resultat: { accepte: true, jobId: 'bord:111:7002', etape: 'fait' } }];
        return [];                                                       // 7003 : jamais prise
      };
      const r = await rendre(b, { relais: VIVANT, plan });
      const p = await pastille(r.pg);
      dit(p && p.niveau === 'ok' && p.relais === 'vivant', 'la pastille dit « actions possibles », par le relais', JSON.stringify(p));
      dit(p && /Actions via ton ordinateur · compte_a/.test(p.aria || ''), 'son libellé complet : « Actions via ton ordinateur · compte_a »', p && p.aria);
      const info = await r.pg.evaluate(() => [...document.querySelectorAll('[data-relais-info]')].map((e) => ({ uid: e.getAttribute('data-relais-info'), txt: e.innerText })));
      dit(info.length === 1 && info[0].uid === '111' && /via ton ordinateur \(compte Vinted ouvert : compte_a\)/.test(info[0].txt), '« via ton ordinateur (compte Vinted ouvert : compte_a) » dit UNE fois au-dessus de la liste', JSON.stringify(info));
      const b1 = await bouton(r.pg, 7001);
      dit(b1 && b1.etat === 'pret' && b1.relais === 'oui', 'le bouton « Générer le bordereau » est actif, par le relais', JSON.stringify(b1));
      dit(b1 && /via ton ordinateur \(compte Vinted ouvert : compte_a\)/.test(b1.titre), 'chaque bouton le dit (en titre)', b1 && b1.titre);
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'relais-telephone-vivant.png') });
      await r.pg.click('[data-etat-actions]', { timeout: 3000 }).catch(() => {});
      await r.pg.waitForTimeout(400);
      const pan = await r.pg.evaluate(() => { const e = document.querySelector('[data-etat-panneau]'); return e ? { n: e.getAttribute('data-etat-panneau'), txt: e.innerText } : null; });
      dit(pan && pan.n === 'ok' && /via ton ordinateur/.test(pan.txt) && /compte_a/.test(pan.txt) && /signe de vie/.test(pan.txt), 'son panneau : « via ton ordinateur », le compte, le signe de vie de l’extension', pan && pan.txt.replace(/\s+/g, ' ').slice(0, 220));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'relais-telephone-panneau.png') });
      await r.pg.click('[data-etat-actions]', { timeout: 3000 }).catch(() => {});
      await r.pg.waitForTimeout(300);

      // 2. Le clic écrit la commande, dans la bonne forme.
      await cliquer(r.pg, 7001);
      await r.pg.waitForTimeout(400);
      const env = await bouton(r.pg, 7001);
      dit(env && env.relais === 'relais-attente' && /Envoyé à ton ordinateur/.test(env.txt), '« Envoyé à ton ordinateur… » tant que personne ne l’a prise', JSON.stringify(env));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'relais-telephone-envoye.png') });
      const post = r.journal.posts[0] || {};
      const d = post.data || {};
      dit(r.journal.posts.length === 1 && /^cmd_relais_[a-z0-9]{8,40}$/.test(post.id || ''), 'UNE ligne de commande est écrite, à un identifiant de commande', JSON.stringify(r.journal.posts.map((x) => x.id)));
      dit(d.cmd === 'bordereau' && d.args && d.args.uid === '111' && d.args.tx === '7001' && d.etat === 'attente' && d.par === 'telephone',
        'sa forme : cmd « bordereau », args {uid, tx}, etat « attente », par « telephone »', JSON.stringify(d));
      dit(d.pour === SESSION.user.id && post.owner === SESSION.user.id, 'au nom du vendeur (pour + owner)', `${d.pour} · ${post.owner}`);
      dit(Number(d.expire) - Number(d.demandeLe) === 600000, 'son échéance : 10 min après la demande', String(Number(d.expire) - Number(d.demandeLe)));
      await r.pg.waitForTimeout(2600);
      const ref = await r.pg.evaluate(() => { const e = document.querySelector('[data-bouton-bord][data-tx="7001"]'); return e ? e.innerText : ''; });
      dit(/Chrome est connecté sur compte_b/.test(ref), 'le refus de l’extension est dit, avec sa raison (le compte ouvert)', ref.replace(/\s+/g, ' ').slice(0, 160));

      // 3. Le cours d'un bordereau : jamais « fait » avant l'extension.
      await cliquer(r.pg, 7002);
      await r.pg.waitForTimeout(700);
      const a1 = await bouton(r.pg, 7002);
      dit(a1 && a1.relais === 'relais-attente', 'avant la prise : « envoyé à ton ordinateur »', JSON.stringify(a1));
      await r.pg.waitForTimeout(1300);
      const a2 = await bouton(r.pg, 7002);
      dit(a2 && a2.relais === 'relais-pris' && /En cours sur ton ordinateur/.test(a2.txt), 'prise : « en cours sur ton ordinateur »', JSON.stringify(a2));
      await r.pg.waitForTimeout(2200);
      const a3 = await bouton(r.pg, 7002);
      dit(a3 && a3.etat === 'encours', 'l’extension dit « en file » : le bouton suit son étape', JSON.stringify(a3));
      await r.pg.waitForTimeout(3500);
      const a4 = await bouton(r.pg, 7002);
      dit(a4 && a4.etat !== 'encours' && !/En cours|Envoyé/.test(a4.txt), 'l’extension dit « fait » : le bouton n’est plus en cours', JSON.stringify(a4));

      // 4. Jamais prise : annulée, sous condition, et dit.
      await cliquer(r.pg, 7003);
      await r.pg.waitForTimeout(6000);
      const an = r.journal.patchs.find((x) => x.etat === 'annulee');
      dit(an && an.cond === 'attente', 'pas prise à temps : la commande est ANNULÉE par une écriture conditionnelle (etat=attente)', JSON.stringify(r.journal.patchs));
      const t3 = await r.pg.evaluate(() => { const e = document.querySelector('[data-bouton-bord][data-tx="7003"]'); return e ? e.innerText : ''; });
      dit(/n'a pas pris la commande/.test(t3), '« ton ordinateur n’a pas pris la commande » est dit', t3.replace(/\s+/g, ' ').slice(0, 160));
      const sw = await r.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(sw.sw <= sw.cw + 1, 'aucun débordement horizontal (390 px)', `${sw.sw} > ${sw.cw}`);
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    }

    console.log('── 5. Le compte ouvert sur l’ordinateur n’est pas celui de la vente');
    {
      const r = await rendre(b, { relais: { ageMin: 0.2, vUid: '222', vLogin: 'compte_b' } });
      const b1 = await bouton(r.pg, 7001);
      dit(b1 && b1.etat === 'grise' && /Le Chrome de ton ordinateur est connecté sur compte_b/.test(b1.txt), 'grisé AVANT le clic, avec la raison', JSON.stringify(b1));
      await cliquer(r.pg, 7001); await r.pg.waitForTimeout(600);
      dit(r.journal.posts.length === 0, 'et un clic n’écrit rien', String(r.journal.posts.length));
      await r.ctx.close();
    }

    console.log('── 6. Relais éteint, puis lecture ratée');
    {
      const r = await rendre(b, { relais: { ageMin: 10, vUid: '111', vLogin: 'compte_a' } });
      const p = await pastille(r.pg);
      const b1 = await bouton(r.pg, 7001);
      const raison = await r.pg.evaluate(() => { const e = document.querySelector('[data-raison-bord]'); return e ? { code: e.getAttribute('data-raison-bord'), txt: e.textContent } : null; });
      dit(p && p.relais === 'perime' && p.niveau === 'lecture', 'la pastille dit « Lecture seule » (relais éteint)', JSON.stringify(p));
      dit(b1 && b1.etat === 'grise', 'le bouton est grisé', JSON.stringify(b1));
      dit(raison && /pas donné signe de vie depuis 10 min/.test(raison.txt) && /ouvre Chrome/.test(raison.txt), 'la raison : « pas donné signe de vie depuis 10 min — ouvre Chrome »', raison && raison.txt.slice(0, 200));
      await cliquer(r.pg, 7001); await r.pg.waitForTimeout(500);
      dit(r.journal.posts.length === 0, 'un clic n’écrit rien', String(r.journal.posts.length));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'relais-telephone-eteint.png') });
      await r.ctx.close();
    }
    {
      const r = await rendre(b, { relais: 'ko' });
      const p = await pastille(r.pg);
      const b1 = await bouton(r.pg, 7001);
      const corps = await r.pg.evaluate(() => document.body.textContent);
      dit(p && p.relais === 'passu' && p.niveau === 'lecture', 'lecture ratée : « pas su », lecture seule', JSON.stringify(p));
      dit(b1 && b1.etat === 'grise', 'le bouton est grisé', JSON.stringify(b1));
      dit(!/via ton ordinateur/.test(corps) && !/Actions via/.test(corps), 'AUCUNE promesse « via ton ordinateur »');
      dit(/pas pu savoir si ton ordinateur est allumé/.test(corps), 'la raison dit qu’on ne sait pas');
      await r.ctx.close();
    }

    console.log('── 7. Messagerie : refuser, accepter (avec confirmation)');
    {
      const plan = (row) => [{ ms: 700, etat: 'pris' }, { ms: 1400, etat: 'fait', resultat: { ok: true, status: 200 } }];
      const r = await rendre(b, { relais: VIVANT, plan, tab: 'cat_msg' });
      await r.pg.click('[data-conv="301"]', { timeout: 5000 }).catch(() => {});
      await r.pg.waitForTimeout(1500);
      const off = await r.pg.evaluate(() => { const e = document.querySelector('[data-offre]'); return e ? { etat: e.getAttribute('data-offre'), ro: e.getAttribute('data-offre-ro') } : null; });
      dit(off && off.etat === 'attente' && !off.ro, 'l’offre est tranchable d’ici (par le relais)', JSON.stringify(off));
      const via = await r.pg.evaluate(() => { const e = document.querySelector('[data-conv-relais]'); return e ? { e: e.getAttribute('data-conv-relais'), txt: e.innerText } : null; });
      dit(via && /via ton ordinateur \(compte Vinted ouvert : compte_a\)/.test(via.txt), 'le fil dit « via ton ordinateur (compte Vinted ouvert : compte_a) »', JSON.stringify(via));
      await r.pg.getByRole('button', { name: 'Refuser', exact: true }).first().click({ timeout: 3000 }).catch(() => {});
      await r.pg.waitForTimeout(350);
      const pend = await r.pg.evaluate(() => { const e = document.querySelector('[data-conv-relais]'); return e ? e.getAttribute('data-conv-relais') : null; });
      dit(pend === 'relais-attente', 'pendant l’envoi : « envoyé à ton ordinateur »', String(pend));
      await r.pg.waitForTimeout(2200);
      const rej = r.journal.posts.find((x) => x.data && x.data.cmd === 'exec' && /reject$/.test(x.data.args.endpoint));
      dit(rej && rej.data.args.method === 'PUT' && rej.data.args.endpoint === '/api/v2/transactions/9001/offer_requests/77/reject' && rej.data.args.uid === '111', 'refuser écrit EXACTEMENT ce geste, au nom de compte_a', JSON.stringify(rej && rej.data.args));
      const txt = await r.pg.evaluate(() => document.body.innerText);
      dit(/Offre refusée/.test(txt), 'et dit le résultat écrit par l’extension');
      const avantAcc = r.journal.posts.length;
      await r.pg.getByRole('button', { name: 'Accepter', exact: true }).first().click({ timeout: 3000 }).catch(() => {});
      await r.pg.waitForTimeout(500);
      dit(r.journal.posts.length === avantAcc, 'accepter DEMANDE d’abord — rien n’est écrit avant', String(r.journal.posts.length - avantAcc));
      await r.pg.locator('div[style*="z-index: 2000"] button', { hasText: 'Accepter' }).click({ timeout: 3000 }).catch(() => {});
      await r.pg.waitForTimeout(2600);
      const acc = r.journal.posts.find((x) => x.data && /accept$/.test(x.data.args.endpoint || ''));
      dit(acc && acc.data.confirme === true, 'puis la ligne porte la confirmation (`confirme`)', JSON.stringify(acc && acc.data));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'relais-telephone-messages.png') });
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    }

    console.log('── 8. L’autre sens : sur ordinateur, sans extension, le relais n’est pas utilisé');
    {
      const r = await rendre(b, { tel: false, relais: VIVANT });
      const b1 = await bouton(r.pg, 7001);
      const info = await r.pg.evaluate(() => document.querySelectorAll('[data-relais-info]').length);
      const p = await pastille(r.pg);
      dit(r.journal.lecturesRelais === 0, 'le signe de vie n’est même pas lu', String(r.journal.lecturesRelais));
      dit(b1 && b1.etat === 'grise' && !b1.relais, 'le bouton reste grisé (« extension pas détectée »), sans relais', JSON.stringify(b1));
      dit(info === 0 && p && !p.relais, 'aucune phrase de relais, pastille inchangée', JSON.stringify({ info, p }));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'relais-ordinateur.png') });
      await r.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ relais-telephone : ${ko} rouge(s), ${okN} vert(s)` : `\n✅ relais-telephone : tout est vert (${okN})`);
  process.exit(ko ? 1 : 0);
})();
