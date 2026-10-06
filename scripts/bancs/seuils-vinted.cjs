// Banc : « Ce que Vinted transmet aux impôts », compte par compte (6 octobre).
//
// Chaque année, Vinted transmet aux impôts les vendeurs qui atteignent 30 ventes
// ou dépassent 2 000 € dans l'année (directive DAC7). La carte vit UNE fois, dans
// Ventes → Outils → Registre annuel. Ce banc l'ouvre sur des ventes INVENTÉES
// (aucune donnée réelle : il vit dans le dépôt, qui est public), à 390 et
// 1512 px, et juge les NOMBRES rendus (`data-*`), jamais un libellé :
//   1. un compte exclu de l'app n'apparaît PAS (ni ligne, ni nom) ;
//   2. ventes finalisées seulement — l'annulée de 999 € ne compte pas ;
//   3. 30 ventes ⇒ atteint · 2 000,01 € ⇒ atteint · 2 000,00 € pile ⇒ sous ;
//   4. un compte dont la lecture a échoué ⇒ un tiret et la raison, JAMAIS 0 ;
//   5. une vente vendue fin décembre, versement pas daté ⇒ « incertaine », à part ;
//   6. le texte rendu porte les MÊMES nombres que les `data-*` ;
//   7. aucun rouge, aucun ambre (§7), aucun débordement, aucune erreur d'app.
// Port 4802.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4802;

const maintenant = Date.now();
const AN = new Date(maintenant).getFullYear();
const debutAn = new Date(AN, 0, 1, 12).getTime();
// Une date de CETTE année, avant aujourd'hui (k heures en arrière, jamais avant le 1er janvier).
const ilYa = (k) => new Date(Math.max(debutAn, maintenant - (k + 1) * 3600e3)).toISOString();
const FIN = 'Commande finalisée - l\'acheteur a validé la commande';
const COMPTES = {
  '9101': 'compte_alpha',   // 31 ventes de 10 € → 30 ventes atteintes
  '9102': 'compte_beta',    // 29 ventes, 2 000,00 € PILE → sous les seuils
  '9103': 'compte_gamma',   // 3 ventes, 2 000,01 € → plus de 2 000 €
  '9104': 'compte_exclu',   // exclu de l'app : 40 ventes qui ne doivent apparaître nulle part
  '9105': 'compte_panne',   // sa lecture échoue (500) : « pas su »
  '9106': 'compte_delta',   // 29 ventes + 1 vendue fin décembre, versement pas daté
};
const ACCOUNTS = Object.entries(COMPTES).map(([uid, login], i) => ({ id: i + 1, vinted_user_id: uid, login, domain: 'www.vinted.fr', updated_at: new Date().toISOString() }));
let tx = 70000;
const VENTES = {}, VERS = {};
const vente = (uid, eur, statut, date, verse) => {
  const t = ++tx;
  (VENTES[uid] = VENTES[uid] || []).push({ transaction_id: t, title: 'Paire inventée ' + t, price: { amount: String(eur), currency_code: 'EUR' }, status: statut, date });
  if (verse) VERS[t] = { uid, date };
};
for (let i = 0; i < 31; i++) vente('9101', 10, FIN, ilYa(i), i < 10);
vente('9101', 999, 'Commande annulée', ilYa(40));
for (let i = 0; i < 27; i++) vente('9102', 70, FIN, ilYa(i), i % 2 === 0);
vente('9102', 109.9, FIN, ilYa(30), true);
vente('9102', 0.1, FIN, ilYa(31), false);
vente('9103', 900, FIN, ilYa(2), true); vente('9103', 800, FIN, ilYa(3), false); vente('9103', 300.01, FIN, ilYa(4), true);
for (let i = 0; i < 40; i++) vente('9104', 60, FIN, ilYa(i), false);
for (let i = 0; i < 29; i++) vente('9106', 15, FIN, ilYa(i), false);
vente('9106', 15, FIN, new Date(AN - 1, 11, 20, 12).toISOString(), false);
const ATTENDU = {
  '9101': { n: 31, eur: '310.00', verdict: 'atteint', inc: 0 },
  '9102': { n: 29, eur: '2000.00', verdict: 'sous', inc: 0 },
  '9103': { n: 3, eur: '2000.01', verdict: 'atteint', inc: 0 },
  '9106': { n: 29, eur: '435.00', verdict: 'peutEtre', inc: 1 },
};

const rows = [
  { id: 'main', data: { vinted_accounts_hidden: ['9104'] } },
  ...Object.entries(VENTES).map(([uid, l]) => ({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: new Date().toISOString(), payload: { my_orders: l } } })),
  ...Object.entries(VERS).map(([t, v]) => ({ id: `harvest_${v.uid}_txn_${t}`, data: { capturedAt: new Date().toISOString(), payload: { transaction: { id: Number(t), status: 450, status_updated_at: new Date(Date.parse(v.date) + 3600e3).toISOString() } } } })),
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

// §6.3 : une requête PROJETÉE reçoit la projection — `alias:data->a->>b`, `id`, `data`.
const projette = (r, sel) => {
  if (!sel) return { ...r, updated_at: new Date().toISOString() };
  const o = {}; let vu = false;
  for (const champ of sel.split(',')) {
    if (champ === 'id') { o.id = r.id; vu = true; continue; }
    if (champ === 'data') { o.data = r.data; vu = true; continue; }
    if (champ === 'updated_at') { o.updated_at = new Date().toISOString(); vu = true; continue; }
    const m = /^(\w+):data((?:->>?\w+)+)$/.exec(champ); if (!m) continue;
    vu = true;
    let v = r.data; for (const p of m[2].split(/->>?/).filter(Boolean)) v = v == null ? v : v[p];
    o[m[1]] = (v != null && /->>\w+$/.test(m[2])) ? String(v) : v;
  }
  return vu ? o : { ...r };
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_accounts_hidden', JSON.stringify(['9104'])); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
        // La lecture des ventes de « compte_panne » ÉCHOUE (la forme réelle d'une panne : pas de JSON).
        if (/harvest_9105_/.test(u)) return route.fulfill({ status: 500, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>erreur</html>' });
        if (route.request().method() !== 'GET') return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
        const eq = /[?&]id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
        const lk = /[?&]id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3000);
      try {
        await pg.getByText('Outils', { exact: false }).first().click({ timeout: 5000 });
        await pg.getByText('Registre annuel', { exact: true }).first().click({ timeout: 5000 });
      } catch (e) { dit(false, 'le registre annuel s’ouvre depuis « Outils »', String(e.message).slice(0, 100)); await ctx.close(); continue; }
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(() => {
        const carte = document.querySelector('[data-seuils-vinted]');
        const lignes = carte ? [...carte.querySelectorAll('[data-seuil-compte]')].map((l) => ({ uid: l.dataset.seuilCompte, etat: l.dataset.etat, n: l.dataset.n, eur: l.dataset.eur, verdict: l.dataset.verdict, inc: l.dataset.incertaines, txt: l.innerText })) : null;
        // §7 : aucune couleur d'ALERTE (rouge, ambre) dans la carte.
        const alertes = [];
        if (carte) for (const el of [carte, ...carte.querySelectorAll('*')]) {
          const cs = getComputedStyle(el);
          for (const prop of ['color', 'borderTopColor', 'borderLeftColor', 'backgroundColor']) {
            const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(cs[prop]); if (!m) continue;
            if (m[4] != null && Number(m[4]) < 0.05) continue;
            const [R, G, B] = [m[1], m[2], m[3]].map(Number);
            if (R - Math.max(G, B) > 70) alertes.push(prop + ' ' + cs[prop]);
          }
        }
        return { annee: carte ? carte.dataset.seuilsVinted : null, txt: carte ? carte.innerText : '', lignes, alertes, mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      dit(!r.mort, 'l’écran n’est pas tombé sur le garde-fou');
      dit(r.annee === String(AN), 'la carte « Ce que Vinted transmet aux impôts » est dans le registre annuel, pour l’année affichée', `année ${r.annee}`);
      const L = r.lignes || [];
      const par = Object.fromEntries(L.map((l) => [l.uid, l]));
      dit(!par['9104'] && !/compte_exclu/.test(r.txt), 'un compte EXCLU de l’app n’apparaît pas — ni sa ligne, ni son nom', par['9104'] ? JSON.stringify(par['9104']) : '');
      dit(L.length === 5, 'les cinq autres comptes sont là, aucun perdu', `${L.length} ligne(s)`);
      for (const [uid, a] of Object.entries(ATTENDU)) {
        const l = par[uid];
        dit(l && l.etat === 'lu' && Number(l.n) === a.n && l.eur === a.eur && l.verdict === a.verdict && Number(l.inc) === a.inc,
          `${COMPTES[uid]} : ${a.n} ventes · ${a.eur} € · ${a.verdict}${a.inc ? ' · ' + a.inc + ' incertaine' : ''}`, l ? `rendu n=${l.n} · ${l.eur} € · ${l.verdict} · inc ${l.inc} · ${l.etat}` : 'absent');
        // Le TEXTE porte les mêmes nombres que les data-* (sinon l'attribut ment).
        const eurFr = a.eur.replace('.', ',');
        dit(l && new RegExp('\\b' + a.n + ' ventes?\\b').test(l.txt) && l.txt.includes(eurFr + ' €'), `${COMPTES[uid]} : le texte rendu dit ${a.n} ventes et ${eurFr} €`, l ? l.txt.replace(/\n/g, ' | ').slice(0, 160) : '');
      }
      const p = par['9105'];
      dit(p && p.etat === 'pasSu' && p.n === '' && p.verdict === '', 'compte_panne : lecture ratée ⇒ « pas su », aucun nombre, aucun verdict', p ? `etat ${p.etat} · n «${p.n}» · verdict «${p.verdict}»` : 'absent');
      dit(p && /—/.test(p.txt) && !/\b0 vente/.test(p.txt) && !/sous les seuils/i.test(p.txt), 'compte_panne : un tiret et la raison, JAMAIS « 0 vente · sous les seuils »', p ? p.txt.replace(/\n/g, ' | ').slice(0, 160) : '');
      dit(/exclus de l'app/.test(r.txt), 'la carte dit, une fois et sans les nommer, que les comptes exclus ne sont pas comptés');
      dit(/30 ventes/.test(r.txt) && /2[\s\u00a0\u202f]?000[\s\u00a0\u202f]€/.test(r.txt) && /DAC7/.test(r.txt), 'la carte dit les deux seuils et leur source, une fois');
      dit((r.txt.match(/pour qu'il n'y ait jamais d'écart/g) || []).length === 1, 'la phrase « pourquoi c’est utile » est dite une seule fois');
      dit(r.alertes.length === 0, 'aucune couleur d’alerte (rouge, ambre) dans la carte (§7)', r.alertes.slice(0, 3).join(' · '));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      try { await pg.locator('[data-seuils-vinted]').first().screenshot({ path: path.join(require('os').tmpdir(), 'seuils-vinted-' + vp.width + '.png') }); } catch (_) {}
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ seuils-vinted : ${ko} rouge(s)` : '\n✅ seuils-vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
