// Banc : « Ce que Vinted transmet aux impôts », compte par compte (6 octobre,
// revu le même jour après une relecture contradictoire).
//
// Chaque année, Vinted transmet aux impôts les vendeurs qui atteignent 30 ventes
// ou dépassent 2 000 € dans l'année (directive DAC7). La carte vit UNE fois, dans
// Ventes → Outils → Registre annuel. Ce banc l'ouvre sur des ventes INVENTÉES
// (aucune donnée réelle : il vit dans le dépôt, qui est public), à 390 et
// 1512 px, et juge les NOMBRES rendus (`data-*`), jamais un libellé seul :
//   A. la partie SÛRE de chaque compte (ventes datées du versement) est
//      EXACTEMENT la partie Vinted du registre affiché juste au-dessus, compte
//      par compte ET au total ; les ventes pas encore datées sont à part, jamais
//      dans la partie sûre ; un seuil atteint seulement avec elles se dit
//      « atteint si… » ; une ligne TOTAL de tous les comptes, « au moins » quand
//      un compte manque ; « à ce jour » et ce qu'il reste avant le seuil ;
//      aucune phrase « jamais d'écart », aucun « Vinted transmet ce compte » ;
//   B. CACHE : un compte en panne au premier passage reste « pas su » après un
//      rechargement (le cache gardait la liste sans son échec ⇒ « 0 vente ») ;
//      le bandeau de l'écran Ventes le dit encore ; « Relire mes ventes » relit
//      vraiment et le compte apparaît ;
//   C. un libellé de compte arrivé du nuage APRÈS la lecture : le compte en
//      panne reste « pas su » (jugé par son identité, pas par son nom) ;
//   D. panne totale et lecture en cours : la phrase dite UNE fois au-dessus des
//      lignes, « — » sur chaque ligne, aucun « 0 € » au registre ;
//   E. une année passée : pas de « à ce jour », pas de reste avant le seuil ;
//   F. (revue du 9 octobre) le cache des ventes ne savait pas QUELS comptes il
//      couvrait : un compte lié depuis la dernière lecture (liste de comptes du
//      navigateur périmée, ou rechargement dans les 3 min) s'affichait « 0 vente
//      · sous les seuils », le total se disait complet ; un compte RETIRÉ restait
//      compté au registre (registre ≠ carte) ;
//   G. relecture DISCRÈTE ratée pour un compte déjà lu : le registre comptait ses
//      ventes d'avant tout en écrivant « ventes de X pas lues », et la carte
//      (« sans X ») donnait un autre total. Une même panne, un même chiffre :
//      registre == carte, et la phrase dit ce que le chiffre contient ;
//   H. même panne sur Ma journée : « Reçu en {mois} » ne compte plus ce compte
//      et le DIT à côté du chiffre.
// Et toujours : un compte exclu n'apparaît pas, aucun rouge ni ambre (§7),
// aucun débordement, aucune erreur d'app. Port 4802.
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
  '9101': 'compte_alpha',   // 31 ventes de 10 € : 10 datées du versement, 21 pas encore → « atteint si »
  '9102': 'compte_beta',    // 15 datées (1 089,90 €) + 14 pas encore (910,10 €) = 2 000,00 € pile → sous
  '9103': 'compte_gamma',   // 2 datées (1 200,01 €) + 1 pas encore (800 €) = 2 000,01 € → « atteint si »
  '9104': 'compte_exclu',   // exclu de l'app : 40 ventes qui ne doivent apparaître nulle part
  '9105': 'compte_panne',   // 35 ventes datées (700 €) — c'est sa LECTURE qui échoue
  '9106': 'compte_delta',   // 0 datée, 29 pas encore + 1 vendue fin décembre dernier → « atteint si »
  '9107': 'compte_epsilon', // 32 ventes datées de 20 € + 1 PAS datée mais DÉCLARÉE → 33 sûres, atteint
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
for (let i = 0; i < 35; i++) vente('9105', 20, FIN, ilYa(i), true);
for (let i = 0; i < 29; i++) vente('9106', 15, FIN, ilYa(i), false);
vente('9106', 15, FIN, new Date(AN - 1, 11, 20, 12).toISOString(), false);
for (let i = 0; i < 32; i++) vente('9107', 20, FIN, ilYa(i), true);
// Une vente sans date de versement, mais qu'il a DÉCLARÉE (« J'ai déclaré ce
// mois ») : le registre la compte au mois de sa déclaration — elle est donc
// dans la partie sûre, et jamais EN PLUS dans les « pas encore datées » (le
// premier correctif rappelait la règle sans les déclarations : comptée deux fois).
vente('9107', 20, FIN, ilYa(5), false);
const TX_DECLAREE = tx, DATE_DECLAREE = VENTES['9107'][VENTES['9107'].length - 1].date;
const ymDe = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const DECLARATIONS = { [ymDe(DATE_DECLAREE)]: { ids: ['vinted:' + TX_DECLAREE], n: 1, ca: 20, regle: 'versement', at: maintenant } };
// La partie SÛRE (datée du versement) et la partie pas encore datée, compte par compte.
const ATTENDU = {
  '9101': { n: 10, eur: '100.00', ad: 21, verdict: 'atteintSi' },
  '9102': { n: 15, eur: '1089.90', ad: 14, verdict: 'sous', resteN: 15, resteEur: '910.11' },
  '9103': { n: 2, eur: '1200.01', ad: 1, verdict: 'atteintSi' },
  '9106': { n: 0, eur: '0.00', ad: 30, verdict: 'atteintSi' },
  '9107': { n: 33, eur: '660.00', ad: 0, verdict: 'atteint' },
};
const PANNE_LU = { n: 35, eur: '700.00', ad: 0, verdict: 'atteint' };

const rowsDe = (main) => [
  { id: 'main', data: main },
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

// Une page de l'app servie par une base FAUSSE dont la panne se règle en direct.
//   etat.panne9105  : la lecture des ventes de compte_panne échoue
//   etat.panne9101  : la lecture des ventes de compte_alpha échoue
//   etat.panneTout  : la lecture de TOUTES les ventes échoue
//   etat.delaiOrders: les ventes répondent avec ce retard (ms)
//   etat.delaiMain  : la ligne `main` (le nuage) répond avec ce retard (ms)
//   etat.lsComptes  : la liste de comptes que le NAVIGATEUR connaît déjà (visite d'avant)
//   etat.delaiComptes: la liste de comptes de la base répond avec ce retard (ms)
//   etat.sansUid    : la base ne connaît pas (encore / plus) ce compte
const page = async (b, vp, etat, main) => {
  const rows = rowsDe(main);
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((ls) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_accounts_hidden', JSON.stringify(['9104'])); if (ls && !localStorage.getItem('vinted_accounts')) localStorage.setItem('vinted_accounts', JSON.stringify(ls)); } catch (_) {} }, etat.lsComptes || null);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    // La forme réelle d'une panne : pas de JSON.
    const panne = () => route.fulfill({ status: 500, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>erreur</html>' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) {
      if (etat.delaiComptes) await new Promise((r) => setTimeout(r, etat.delaiComptes));
      return j(etat.sansUid ? ACCOUNTS.filter((a) => a.vinted_user_id !== etat.sansUid) : ACCOUNTS);
    }
    if (/_orders_/.test(u)) {
      if (etat.delaiOrders) await new Promise((r) => setTimeout(r, etat.delaiOrders));
      if (etat.panneTout) return panne();
      if (etat.panne9105 && /harvest_9105_/.test(u)) return panne();
      if (etat.panne9101 && /harvest_9101_/.test(u)) return panne();
    }
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    if (etat.delaiMain && /id=eq\.main/.test(u)) await new Promise((r) => setTimeout(r, etat.delaiMain));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
};
const ouvreRegistre = async (pg) => {
  await pg.getByText('Outils', { exact: false }).first().click({ timeout: 8000 });
  await pg.getByText('Registre annuel', { exact: true }).first().click({ timeout: 8000 });
  await pg.waitForTimeout(1500);
};
const fermeRegistre = async (pg) => { await pg.locator('button[aria-label="Fermer"]').first().click({ timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(400); };
// Ce que la carte et le registre RENDENT — nombres portés en data-*, texte rendu.
const lit = (pg) => pg.evaluate(() => {
  const carte = document.querySelector('[data-seuils-vinted]');
  const ligne = (l) => ({ uid: l.dataset.seuilCompte, etat: l.dataset.etat, n: l.dataset.n, eur: l.dataset.eur, verdict: l.dataset.verdict, ad: l.dataset.adater, eurAd: l.dataset.eurAdater, resteN: l.dataset.resteN, resteEur: l.dataset.resteEur, partiel: l.dataset.partiel, txt: l.innerText });
  const lignes = carte ? [...carte.querySelectorAll('[data-seuil-compte]')].map(ligne) : null;
  const tot = carte && carte.querySelector('[data-seuils-total]');
  const reg = document.querySelector('[data-registre-vinted]');
  let regParUid = null; try { regParUid = reg ? JSON.parse(reg.dataset.registreVinted) : null; } catch (_) {}
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
  const bt = document.body.innerText;
  const iCA = bt.search(/CA des ventes finalis/i);
  return {
    annee: carte ? carte.dataset.seuilsVinted : null, aCeJour: carte ? carte.dataset.aCeJour : null, txt: carte ? carte.innerText : '', lignes,
    total: tot ? ligne(tot) : null,
    reg: regParUid, regN: reg ? reg.dataset.registreVintedN : null, regEur: reg ? reg.dataset.registreVintedEur : null,
    caRegistre: iCA >= 0 ? bt.slice(iCA, iCA + 110).replace(/\n/g, ' | ') : '',
    nPanne: carte ? carte.querySelectorAll('[data-seuils-panne]').length : 0,
    relire: !!(carte && carte.querySelector('[data-relire-ventes]')),
    alertes, mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(bt), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const compte = (txt, s) => txt.split(s).length - 1;
const par = (r) => Object.fromEntries((r.lignes || []).map((l) => [l.uid, l]));
// La partie SÛRE de chaque ligne == la partie Vinted du registre (absent du registre ⇒ 0).
const egalRegistre = (r, uids, quoi) => {
  const p = par(r);
  for (const uid of uids) {
    const l = p[uid], g = r.reg ? (r.reg[uid] || { n: 0, eur: '0.00' }) : null;
    dit(!!(l && g && l.etat === 'lu' && Number(l.n) === Number(g.n) && l.eur === g.eur),
      `${quoi} ${COMPTES[uid]} : la partie sûre de la carte est EXACTEMENT celle du registre`, l ? `carte ${l.n} · ${l.eur} € (${l.etat}) — registre ${g ? g.n + ' · ' + g.eur + ' €' : 'ABSENT'}` : 'ligne absente');
  }
  const lus = (r.lignes || []).filter((l) => l.etat === 'lu');
  const sn = lus.reduce((s, l) => s + Number(l.n), 0), se = lus.reduce((s, l) => s + Number(l.eur), 0);
  dit(!!(r.total && r.regN != null && Number(r.total.n) === Number(r.regN) && Number(r.total.eur).toFixed(2) === Number(r.regEur).toFixed(2) && Number(r.total.n) === sn && Math.abs(Number(r.total.eur) - se) < 0.005),
    `${quoi} au TOTAL : la ligne « tous tes comptes » == la partie Vinted du registre == la somme des lignes`,
    `total carte ${r.total ? r.total.n + ' · ' + r.total.eur : 'ABSENT'} — registre ${r.regN} · ${r.regEur} — somme des lignes ${sn} · ${se.toFixed(2)}`);
};
const communs = (r, errs, quoi) => {
  dit(!r.mort, `${quoi} l'écran n'est pas tombé sur le garde-fou`);
  dit(r.alertes.length === 0, `${quoi} aucune couleur d'alerte (rouge, ambre) dans la carte (§7)`, r.alertes.slice(0, 3).join(' · '));
  dit(r.sw <= r.cw + 1, `${quoi} aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  dit(errs.length === 0, `${quoi} aucune erreur d'app`, errs.join(' | ').slice(0, 160));
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const mainNormal = { vinted_accounts_hidden: ['9104'], vrm_urssaf_declare: DECLARATIONS };

    // ── A. Le cas courant, aux deux tailles : compte_panne ne répond pas.
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const q = `[A ${vp.width}]`;
      console.log(`── A · ${vp.width} px`);
      const etat = { panne9105: true };
      const { ctx, pg, errs } = await page(b, vp, etat, mainNormal);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3000);
        await ouvreRegistre(pg);
        const r = await lit(pg);
        const p = par(r);
        dit(r.annee === String(AN), `${q} la carte est dans le registre annuel, pour l'année affichée`, `année ${r.annee}`);
        dit(!p['9104'] && !/compte_exclu/.test(r.txt), `${q} un compte EXCLU de l'app n'apparaît pas — ni sa ligne, ni son nom`);
        dit((r.lignes || []).length === 6, `${q} les six autres comptes sont là, aucun perdu`, `${(r.lignes || []).length} ligne(s)`);
        // La partie sûre, et la partie pas encore datée À PART.
        for (const [uid, a] of Object.entries(ATTENDU)) {
          const l = p[uid];
          dit(!!(l && l.etat === 'lu' && Number(l.n) === a.n && l.eur === a.eur && Number(l.ad) === a.ad && l.verdict === a.verdict),
            `${q} ${COMPTES[uid]} : ${a.n} datées · ${a.eur} € · ${a.ad} pas encore datées · ${a.verdict}`, l ? `rendu ${l.n} · ${l.eur} € · ${l.ad} · ${l.verdict} · ${l.etat}` : 'absent');
        }
        egalRegistre(r, Object.keys(ATTENDU), q);
        // « Atteint si… » : le texte dit la condition — jamais « atteint » tout court.
        const al = p['9101'];
        dit(!!(al && /atteint si/i.test(al.txt) && /21 ventes pas encore datées/.test(al.txt)), `${q} compte_alpha : le seuil n'est atteint QU'AVEC les pas encore datées — la ligne le dit (« atteint si… »)`, al ? al.txt.replace(/\n/g, ' | ') : '');
        const ep = p['9107'];
        dit(!!(ep && /seuil atteint/i.test(ep.txt) && !/ si /i.test(ep.txt.split('\n')[1] || '')), `${q} compte_epsilon : seuil atteint sur la partie datée, dit sans condition`, ep ? ep.txt.replace(/\n/g, ' | ') : '');
        // L'année en cours : « à ce jour » et ce qu'il reste avant le seuil (sur la partie sûre).
        const be = p['9102'];
        dit(r.aCeJour === '1' && /à ce jour/.test(r.txt), `${q} l'année en cours se dit « à ce jour »`, `data-a-ce-jour=${r.aCeJour}`);
        dit(!!(be && Number(be.resteN) === 15 && be.resteEur === '910.11' && /encore 15 ventes ou 910,11\s€ avant le seuil/.test(be.txt)), `${q} compte_beta : « encore 15 ventes ou 910,11 € avant le seuil »`, be ? `reste ${be.resteN} · ${be.resteEur} — ${be.txt.replace(/\n/g, ' | ')}` : '');
        // La ligne TOTAL, dite comme telle, « au moins » puisqu'un compte manque.
        dit(!!(r.total && r.total.etat === 'lu' && r.total.partiel === '9105' && /au moins/.test(r.total.txt) && /compte_panne/.test(r.total.txt) && r.total.verdict === 'atteint'),
          `${q} la ligne « tous tes comptes » existe, sans compte_panne, « au moins » — atteint sur ce qu'on sait`, r.total ? `${r.total.etat} · partiel ${r.total.partiel} · ${r.total.verdict} — ${r.total.txt.replace(/\n/g, ' | ')}` : 'absente');
        dit(/ne sait pas si Vinted juge chaque compte/.test(r.txt), `${q} la carte dit qu'on ne sait pas si Vinted juge les comptes à part ou ensemble`);
        dit(!/Vinted transmet ce compte/.test(r.txt) && !/jamais d'écart/.test(r.txt), `${q} ni « Vinted transmet ce compte », ni « jamais d'écart »`);
        dit(compte(r.txt, 'estimation') === 1 && /pas un chiffre du registre/.test(r.txt), `${q} les « pas encore datées » sont dites UNE fois comme une estimation`, `${compte(r.txt, 'estimation')} fois`);
        // La panne : UNE phrase au-dessus des lignes, « — » sur la ligne.
        const pa = p['9105'];
        dit(!!(pa && pa.etat === 'pasSu' && pa.n === '' && pa.verdict === '' && /—/.test(pa.txt) && !/\b0 vente/.test(pa.txt) && !/sous les seuils/i.test(pa.txt) && pa.txt.length < 40),
          `${q} compte_panne : « — » sur la ligne, aucun nombre, aucun verdict`, pa ? `${pa.etat} · «${pa.txt.replace(/\n/g, ' | ')}»` : 'absent');
        dit(r.nPanne === 1 && compte(r.txt, "n'ont pas pu être lues") === 1 && r.relire, `${q} la panne dite UNE fois au-dessus des lignes, avec « Relire mes ventes »`, `${r.nPanne} bloc · ${compte(r.txt, "n'ont pas pu être lues")} phrase · bouton ${r.relire}`);
        dit(/ventes de compte_panne pas lues/.test(r.caRegistre), `${q} le CA du registre dit que les ventes de compte_panne n'ont pas été lues`, r.caRegistre);
        dit(/exclus de l'app/.test(r.txt), `${q} la carte dit, une fois et sans les nommer, que les comptes exclus ne sont pas comptés`);
        communs(r, errs, q);
        try { await pg.locator('[data-seuils-vinted]').first().screenshot({ path: path.join(require('os').tmpdir(), 'seuils-vinted-' + vp.width + '.png') }); } catch (_) {}
        // E. Une année passée : ni « à ce jour », ni reste avant le seuil.
        if (vp.width > 600) {
          await pg.locator('select').filter({ has: pg.locator(`option[value="${AN - 1}"]`) }).first().selectOption(String(AN - 1), { timeout: 4000 });
          await pg.waitForTimeout(800);
          const e = await lit(pg);
          dit(e.annee === String(AN - 1) && e.aCeJour === '0' && !/à ce jour/.test(e.txt) && !/avant le seuil/.test(e.txt), `[E] année ${AN - 1} : ni « à ce jour », ni reste avant le seuil`, `${e.annee} · data-a-ce-jour=${e.aCeJour}`);
          const d = par(e)['9106'];
          dit(!!(d && d.n === '0' && d.ad === '1'), `[E] la vente de décembre sans date : « pas encore datée » de ${AN - 1} aussi, jamais sûre`, d ? `${d.n} · ${d.ad}` : 'absent');
        }
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }

    // ── B. Le CACHE : compte_panne rate le premier passage, la base répond au suivant.
    {
      const q = '[B cache 390]';
      console.log('── B · cache, 390 px');
      const etat = { panne9105: true };
      const { ctx, pg, errs } = await page(b, { width: 390, height: 844 }, etat, mainNormal);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3000);
        etat.panne9105 = false;                                    // la base répond de nouveau
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });   // rechargement < 3 min
        await pg.waitForTimeout(3500);
        const bandeau = await pg.evaluate(() => { const t = document.body.innerText; const m = /\d+ comptes? non chargés?[^\n]*/.exec(t); return m ? m[0] : ''; });
        dit(/compte_panne/.test(bandeau), `${q} écran Ventes, après rechargement : le bandeau « compte non chargé » nomme encore compte_panne`, bandeau.slice(0, 100) || '(aucun bandeau)');
        await ouvreRegistre(pg);
        const r = await lit(pg);
        const pa = par(r)['9105'];
        dit(!!(pa && pa.etat === 'pasSu' && pa.n === ''), `${q} après rechargement, compte_panne est TOUJOURS « pas su » — jamais « 0 vente »`, pa ? `${pa.etat} · n «${pa.n}» · ${pa.txt.replace(/\n/g, ' | ')}` : 'absent');
        dit(/ventes de compte_panne pas lues/.test(r.caRegistre), `${q} le CA du registre le dit encore`, r.caRegistre);
        dit(r.relire, `${q} un bouton « Relire mes ventes » est là`);
        // Relecture DISCRÈTE (l'extension prévient « ventes rangées ») : compte_panne
        // répond, mais compte_alpha tombe à son tour.
        // ⚠️ L'ancienne relecture discrète gardait TOUTE la liste d'avant avec la
        //    NOUVELLE liste d'échecs : compte_panne (absent de la liste d'avant,
        //    plus en échec) passait pour « 0 vente ».
        etat.panne9105 = false; etat.panne9101 = true;
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'ventes' } })));
        for (let i = 0; i < 20; i++) { await pg.waitForTimeout(400); const x = par(await lit(pg)); if (x['9101'] && x['9101'].etat !== 'lu') break; }
        const r1 = await lit(pg);
        const a1 = par(r1)['9105'], b1 = par(r1)['9101'];
        dit(!!(a1 && a1.etat === 'lu' && Number(a1.n) === PANNE_LU.n && a1.eur === PANNE_LU.eur), `${q} relecture discrète où un AUTRE compte tombe : compte_panne a sa lecture fraîche (35 ventes), jamais « 0 vente »`, a1 ? `${a1.etat} · ${a1.n} · ${a1.eur}` : 'absent');
        dit(!!(b1 && b1.etat === 'pasSu' && b1.n === ''), `${q} …et compte_alpha, qui n'a pas répondu cette fois, est « pas su »`, b1 ? `${b1.etat} · n «${b1.n}»` : 'absent');
        dit(r1.nPanne === 1 && /compte_alpha/.test(r1.txt) && r1.relire, `${q} …la phrase de panne nomme compte_alpha, une fois, avec le bouton`, `${r1.nPanne} bloc · bouton ${r1.relire}`);
        // Revue du 9 octobre : après cette relecture ratée, la liste montre encore
        // les ventes d'avant de compte_alpha — le registre ne les compte pas pour
        // autant (il dit « pas lues »), et la carte vaut le registre.
        egalRegistre(r1, Object.keys(ATTENDU).filter((u) => u !== '9101').concat('9105'), q + ' relecture discrète ratée,');
        dit(!!(r1.reg && !r1.reg['9101'] && /ventes de compte_alpha pas lues/.test(r1.caRegistre)), `${q} …le registre ne compte PAS compte_alpha dans son CA, et le dit (« ventes de compte_alpha pas lues »)`, `registre alpha ${JSON.stringify(r1.reg && r1.reg['9101'])} · «${r1.caRegistre}»`);
        // « Relire mes ventes » : compte_alpha répond de nouveau.
        etat.panne9101 = false;
        if (r1.relire) {
          await pg.locator('[data-relire-ventes]').first().click({ timeout: 4000 });
          for (let i = 0; i < 20; i++) { await pg.waitForTimeout(400); const x = par(await lit(pg)); if (x['9101'] && x['9101'].etat === 'lu') break; }
        }
        const r2 = await lit(pg);
        const p2 = par(r2)['9105'];
        dit(!!(p2 && p2.etat === 'lu' && Number(p2.n) === PANNE_LU.n && p2.eur === PANNE_LU.eur && p2.verdict === PANNE_LU.verdict), `${q} « Relire mes ventes » relit pour de vrai : tout est lu, compte_panne à 35 ventes · 700 € · atteint`, p2 ? `${p2.etat} · ${p2.n} · ${p2.eur} · ${p2.verdict}` : 'absent');
        dit(r2.nPanne === 0 && !!r2.total && r2.total.partiel === '' && (r2.lignes || []).every((l) => l.etat === 'lu'), `${q} après « Relire mes ventes », tout est lu : plus de phrase de panne, le total n'est plus partiel`, `${r2.nPanne} · partiel «${r2.total && r2.total.partiel}» · ${(r2.lignes || []).map((l) => l.etat).join(',')}`);
        egalRegistre(r2, [...Object.keys(ATTENDU), '9105'], q + ' après relecture,');
        await fermeRegistre(pg);
        const bandeau2 = await pg.evaluate(() => /comptes? non chargés?/.test(document.body.innerText));
        dit(!bandeau2, `${q} le bandeau de l'écran Ventes est parti`);
        communs(r2, errs, q);
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }

    // ── C. Un libellé arrivé du nuage APRÈS la lecture des ventes.
    {
      const q = '[C libellé 1512]';
      console.log('── C · libellé tardif, 1512 px');
      const etat = { panne9105: true, delaiMain: 4000 };
      const { ctx, pg, errs } = await page(b, { width: 1512, height: 950 }, etat, { ...mainNormal, vinted_account_labels: { '9105': 'Boutique Panne' } });
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(7000);
        const bandeau = await pg.evaluate(() => { const t = document.body.innerText; const m = /\d+ comptes? non chargés?[^\n]*/.exec(t); return m ? m[0] : ''; });
        dit(/Boutique Panne/.test(bandeau), `${q} le bandeau nomme le compte par son libellé du moment (jugé par l'identité)`, bandeau.slice(0, 100) || '(aucun bandeau)');
        await ouvreRegistre(pg);
        const r = await lit(pg);
        const pa = par(r)['9105'];
        dit(!!(pa && pa.etat === 'pasSu' && pa.n === '' && /Boutique Panne/.test(pa.txt)), `${q} renommé après la lecture, le compte en panne reste « pas su » — jamais « 0 vente · sous les seuils »`, pa ? `${pa.etat} · n «${pa.n}» · ${pa.txt.replace(/\n/g, ' | ')}` : 'absent');
        dit(/Boutique Panne/.test(r.total ? r.total.txt : '') && r.total && r.total.partiel === '9105', `${q} le total dit « sans Boutique Panne »`, r.total ? r.total.txt.replace(/\n/g, ' | ') : 'absent');
        communs(r, errs, q);
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }

    // ── D. Lecture en cours, puis panne TOTALE.
    {
      const q = '[D panne 390]';
      console.log('── D · lecture en cours puis panne totale, 390 px');
      const etat = { panneTout: true, delaiOrders: 7000 };
      const { ctx, pg, errs } = await page(b, { width: 390, height: 844 }, etat, mainNormal);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        await ouvreRegistre(pg);
        const c = await lit(pg);
        dit(c.lignes && c.lignes.length === 6 && compte(c.txt, 'Lecture des ventes') <= 1 && c.lignes.every((l) => l.etat === 'enCours' && !/Lecture/.test(l.txt)),
          `${q} pendant la lecture : « Lecture des ventes… » UNE fois au plus, « — » sur les lignes`, `${compte(c.txt, 'Lecture des ventes')} fois · ${(c.lignes || []).map((l) => l.etat).join(',')}`);
        await pg.waitForTimeout(8000);
        const r = await lit(pg);
        dit(r.lignes && r.lignes.length === 6 && r.lignes.every((l) => l.etat === 'pasSu' && l.n === '' && l.txt.length < 40), `${q} panne totale : chaque ligne « — », aucun nombre`, (r.lignes || []).map((l) => `${l.etat}:${l.txt.replace(/\n/g, '|')}`).join(' · ').slice(0, 200));
        dit(r.nPanne === 1 && compte(r.txt, "n'ont pas pu être lues") === 1, `${q} la phrase de panne UNE fois (pas une par compte)`, `${r.nPanne} bloc · ${compte(r.txt, "n'ont pas pu être lues")} phrase(s)`);
        dit(!!(r.total && r.total.etat === 'pasSu' && r.total.n === ''), `${q} le total : « — », jamais 0`, r.total ? `${r.total.etat} · «${r.total.txt.replace(/\n/g, ' | ')}»` : 'absent');
        dit(!/0,00\s€/.test(r.caRegistre.split('|').slice(0, 2).join('|')), `${q} le CA du registre ne dit pas « 0,00 € » sur une lecture ratée`, r.caRegistre);
        communs(r, errs, q);
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }

    // ── F. Les comptes CHANGENT : le cache ne doit couvrir que ceux d'aujourd'hui.
    const TOUS = Object.keys(ATTENDU).concat('9105');
    // F1 : le navigateur connaît 6 comptes (visite d'avant) ; la base en a 7 —
    //      compte_epsilon vient d'être lié — et répond après 4 s.
    {
      const q = '[F1 compte lié, liste en retard 1512]';
      console.log('── F1 · un compte lié depuis la dernière visite, 1512 px');
      const etat = { lsComptes: ACCOUNTS.filter((a) => a.vinted_user_id !== '9107'), delaiComptes: 4000 };
      const { ctx, pg, errs } = await page(b, { width: 1512, height: 950 }, etat, mainNormal);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(9000);
        await ouvreRegistre(pg);
        const r = await lit(pg);
        const ep = par(r)['9107'];
        dit(!!(ep && ep.etat === 'lu' && ep.n === '33' && ep.eur === '660.00' && ep.verdict === 'atteint'), `${q} compte_epsilon, lié depuis, est LU : 33 ventes · 660 € · atteint — jamais « 0 vente · sous les seuils »`, ep ? `${ep.etat} · ${ep.n} · ${ep.eur} · ${ep.verdict}` : 'absent');
        egalRegistre(r, TOUS, q);
        dit(!!(r.total && r.total.partiel === '' && Number(r.total.n) === 95), `${q} le total couvre les SEPT comptes (95 ventes), sans « au moins »`, r.total ? `${r.total.n} · partiel «${r.total.partiel}»` : 'absent');
        communs(r, errs, q);
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }
    // F2 : rechargement dans les 3 min après la liaison d'un compte (cache de session).
    {
      const q = '[F2 compte lié, rechargement 390]';
      console.log('── F2 · rechargement juste après la liaison d\'un compte, 390 px');
      const etat = { sansUid: '9107' };
      const { ctx, pg, errs } = await page(b, { width: 390, height: 844 }, etat, mainNormal);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        etat.sansUid = null;                                        // l'extension vient de lier compte_epsilon
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });   // < 3 min
        await pg.waitForTimeout(4500);
        await ouvreRegistre(pg);
        const r = await lit(pg);
        const ep = par(r)['9107'];
        dit(!!(ep && ep.etat === 'lu' && ep.n === '33' && ep.verdict === 'atteint'), `${q} après rechargement, compte_epsilon est LU (33 ventes) — le cache des six autres ne le cache pas`, ep ? `${ep.etat} · ${ep.n} · ${ep.verdict} · ${ep.txt.replace(/\n/g, ' | ')}` : 'absent');
        egalRegistre(r, TOUS, q);
        communs(r, errs, q);
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }
    // F3 : l'inverse — compte_epsilon RETIRÉ, rechargement dans les 3 min.
    {
      const q = '[F3 compte retiré, rechargement 1512]';
      console.log('── F3 · un compte retiré, rechargement, 1512 px');
      const etat = {};
      const { ctx, pg, errs } = await page(b, { width: 1512, height: 950 }, etat, mainNormal);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        etat.sansUid = '9107';
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        await ouvreRegistre(pg);
        const r = await lit(pg);
        dit(!par(r)['9107'] && !!(r.reg && !r.reg['9107']) && Number(r.regN) === 62, `${q} le compte retiré n'est ni sur la carte, ni dans le registre (62 ventes, plus 95)`, `ligne ${!!par(r)['9107']} · registre epsilon ${JSON.stringify(r.reg && r.reg['9107'])} · regN ${r.regN}`);
        egalRegistre(r, TOUS.filter((u) => u !== '9107'), q);
        communs(r, errs, q);
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }

    // ── G. Relecture DISCRÈTE ratée pour un compte déjà lu (tout était lu avant).
    {
      const q = '[G relecture discrète 1512]';
      console.log('── G · relecture discrète ratée, 1512 px');
      const etat = {};
      const { ctx, pg, errs } = await page(b, { width: 1512, height: 950 }, etat, mainNormal);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        await ouvreRegistre(pg);
        const r0 = await lit(pg);
        egalRegistre(r0, TOUS, q + ' avant le signal,');
        etat.panne9101 = true;
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'ventes' } })));
        for (let i = 0; i < 20; i++) { await pg.waitForTimeout(400); const x = par(await lit(pg)); if (x['9101'] && x['9101'].etat !== 'lu') break; }
        const r = await lit(pg);
        const al = par(r)['9101'];
        dit(!!(al && al.etat === 'pasSu'), `${q} compte_alpha, qui n'a pas répondu, est « pas su » sur la carte`, al ? al.etat : 'absent');
        dit(!!(r.reg && !r.reg['9101'] && /ventes de compte_alpha pas lues/.test(r.caRegistre)), `${q} le registre ne compte PAS les ventes d'avant de compte_alpha, et dit qu'elles ne sont pas lues — la phrase vient du même calcul que le chiffre`, `registre alpha ${JSON.stringify(r.reg && r.reg['9101'])} · «${r.caRegistre}»`);
        egalRegistre(r, TOUS.filter((u) => u !== '9101'), q + ' après le signal,');
        const listeGarde = await pg.evaluate(() => /Paire inventée/.test(document.body.innerText));
        dit(listeGarde, `${q} la liste des ventes reste affichée derrière (rien ne disparaît sur un hoquet)`);
        communs(r, errs, q);
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }

    // ── H. La même panne sur Ma journée : « Reçu en {mois} ».
    {
      const q = '[H Ma journée 390]';
      console.log('── H · Ma journée, relecture discrète ratée, 390 px');
      const etat = {};
      const { ctx, pg, errs } = await page(b, { width: 390, height: 844 }, etat, mainNormal);
      try {
        const ymIci = ymDe(new Date().toISOString());
        // Ce que compte_alpha a reçu CE mois (datées du versement : vente + 1 h).
        const alphaMois = Object.entries(VERS).filter(([t, v]) => v.uid === '9101' && ymDe(new Date(Date.parse(v.date) + 3600e3).toISOString()) === ymIci)
          .reduce((a, [t]) => a + Number((VENTES['9101'].find((o) => String(o.transaction_id) === t) || {}).price.amount) * 100, 0);
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4000);
        const recu = () => pg.evaluate(() => { const e = document.querySelector('[data-recu-mois]'); return e ? { c: e.dataset.recuMois, sans: e.dataset.recuSans, txt: e.innerText } : null; });
        const a = await recu();
        etat.panne9101 = true;
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'ventes' } })));
        let z = null;
        for (let i = 0; i < 20; i++) { await pg.waitForTimeout(400); z = await recu(); if (z && z.c !== (a && a.c)) break; }
        dit(!!(a && z && a.c !== '' && Number(a.c) - Number(z.c) === alphaMois && alphaMois > 0), `${q} « Reçu » ne compte plus compte_alpha une fois sa lecture ratée (−${(alphaMois / 100).toFixed(2)} €)`, `${a && a.c} → ${z && z.c} (attendu −${alphaMois})`);
        dit(!!(z && /compte_alpha/.test(z.sans || '') && /sans compte_alpha/.test(z.txt)), `${q} …et le dit à côté du chiffre (« sans compte_alpha »)`, z ? `sans «${z.sans}» · ${z.txt.replace(/\n/g, ' | ')}` : 'absent');
        dit(errs.length === 0, `${q} aucune erreur d'app`, errs.join(' | ').slice(0, 160));
      } catch (e) { dit(false, `${q} le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 160)); }
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ seuils-vinted : ${ko} rouge(s)` : '\n✅ seuils-vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
