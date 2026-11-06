// ═══════════════════════════════════════════════════════════════════════════
// BANC : LITIGES AVEC DÉLAI + RECHERCHE UNIQUE (3 novembre)
//        (node scripts/bancs/litiges-recherche.cjs — après le build)
//        BANC_PORT=… pour un autre port · BANC_DIST=… pour un autre build
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES à la forme mesurée dans sa base le 3 novembre (le dépôt est
// public : aucune vraie donnée). Deux ventes au MÊME titre (9401, 9402) :
//   9401  conversation A ; e-mail « Action requise : problème avec la commande »
//         dont le lien de suivi (base64) mène à A ⇒ carte « Litige · N°12 »,
//         « délai non lu », pilule vers vinted.fr/inbox/A ; pseudo « poupacho »
//         dans l'e-mail de vente (même n° de transaction)
//   9402  conversation B, rien ⇒ aucune carte ; son bordereau porte le suivi
//         XW309277125JF
//   9403  « Retour initié » ⇒ carte « Retour · N°20 »
//   achat « Retourne ta commande d'ici le <demain> » ⇒ carte pressée (ambre), date LUE
//   colis (e-mail transporteur) suivi 1Z999AA10123456784, code 482913
// Il exige, à 390 px tactile et 1512 px, en clair et en sombre : les cartes de Ma
// journée par identité (`data-litige*`), la pilule = un LIEN vers le site, le
// litige dans le récapitulatif de la vente 9401 (pas 9402), la recherche qui
// trouve pseudo / suivi / code / titre en groupes, ouvre l'écran existant, plein
// écran au téléphone, lignes ≥ 44 px ; aucun débordement, aucune erreur.
// Captures : $TMPDIR/litiges-*.png, $TMPDIR/recherche-*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4391;

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const T = 'Alpha Spezial noir taille 40';
const CONV_A = '01a1452f-4b49-7bb1-9dd8-e969bdcd3001', CONV_B = '01a1452f-4b49-7bb1-9dd8-e969bdcd3002';
const b64 = (s) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const lien = (conv) => `https://links.vinted.com/t/${b64(`https://www.vinted.fr/inbox/${conv}|0f3c|sig`)}`;
const brut = (texte) => JSON.stringify({ from: 'no-reply@vinted.fr', subject: 'x', text: texte });
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const demain = new Date(MAINTENANT + 24 * H); const jourDemain = `${demain.getDate()} ${MOIS[demain.getMonth()]}`;

const VENTES = [
  { transaction_id: 9401, title: T, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', conversation_id: CONV_A, date: ilYaH(30), price: { amount: '60.0', currency_code: 'EUR' } },
  { transaction_id: 9402, title: T, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', conversation_id: CONV_B, date: ilYaH(29), price: { amount: '61.0', currency_code: 'EUR' } },
  { transaction_id: 9403, title: 'Bravo Retour taille 42', status: 'Retour initié', transaction_user_status: 'needs_action', conversation_id: '24618670003', date: ilYaH(200), price: { amount: '70.0', currency_code: 'EUR' } },
];
const ACHATS = [
  { transaction_id: 9501, title: 'Charlie Achat taille 43', status: "Commande expédiée et en cours d'acheminement ! ", transaction_user_status: 'waiting', conversation_id: '01a14e83-2b7a-7845-b66e-d2303ce10001', date: ilYaH(100), price: { amount: '30.0', currency_code: 'EUR' } },
];
const TXN = [{ tx: 9401, item: 'i12', s: 230 }, { tx: 9402, item: 'i13', s: 230 }, { tx: 9403, item: 'i20', s: 440 }];
const NUMEROS = { i12: { numero: '12', title: T }, i13: { numero: '13', title: T }, i20: { numero: '20', title: 'Bravo Retour taille 42' } };
const EMAILS = [
  { id: 'email_inconnu_l1', data: { subject: `Action requise\u00a0: problème avec la commande « ${T} »`, receivedAt: ilYaH(5), type: 'inconnu',
    brut: brut(`L'acheteur a signalé un problème avec la commande « ${T} ». Nous avons suspendu la commande jusqu'à ce que tu le fasses.\nVoir le litige \n<${lien(CONV_A)}>\n*Remboursement intégral avec retour* : l'acheteur renvoie le ou les articles concernés sous 5 jours ouvrés.`) } },
  { id: 'email_inconnu_r1', data: { subject: `Retourne ta commande d'ici le ${jourDemain} : Charlie Achat`, receivedAt: ilYaH(48), type: 'inconnu', brut: brut('Retourne la commande avant la date. Sinon, tu devras la garder.') } },
  { id: 'email_sale_p1', data: { type: 'sale', pseudo: 'poupacho', transaction: '9401', designation: T, prix: '60', receivedAt: ilYaH(30) } },
  { id: 'email_bord_b1', data: { type: 'bordereau', suivi: 'XW309277125JF', transaction: '9402', article: T, receivedAt: ilYaH(28) } },
  { id: 'email_track_t1', data: { type: 'suivi', suivi: '1Z999AA10123456784', code: '482913', status: 'available', sens: 'entrant', artTitle: 'Delta Colis', carrier: 'mondialrelay', lieu: 'Tabac du port, 1 rue du Port, 35260 Cancale', receivedAt: ilYaH(3) } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_used_numeros: [12, 13, 20], vinted_dark: false } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: VENTES.length, payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: ACHATS.length, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
  ...TXN.map((t) => ({ id: `harvest_111_txn_${t.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: t.tx, item_id: t.item, status: t.s, status_updated_at: ilYaH(5), shipment: { status_title: '' } } } } })),
  ...EMAILS,
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) { localStorage.setItem('vinted_dark', 'true'); } } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    // La lecture des e-mails de litige : `or=(id.like.A,id.like.B)` + un filtre de sujet.
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou && /id\.like\./.test(ou[1])) {
      const res = ou[1].split(',').map((x) => /^id\.like\.(.+)$/.exec(x.trim())).filter(Boolean).map((m) => motif(m[1]));
      const sujet = /subject=match\.([^&]*)/.exec(u);
      const rs = sujet ? new RegExp(sujet[1], 'i') : null;
      return j(ROWS.filter((r) => res.some((re) => re.test(r.id)) && (!rs || rs.test(String(r.data.subject || '')))).map(forme));
    }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const cartes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-job="litige"]')].map((x) => {
  const g = x.querySelector('[data-litige-geste]'); const rg = g ? g.getBoundingClientRect() : null;
  return { cle: x.getAttribute('data-litige'), genre: x.getAttribute('data-litige-genre'), num: x.getAttribute('data-litige-num'), limite: x.getAttribute('data-litige-limite'),
    urgent: x.classList.contains('is-urgent'), lien: g ? g.getAttribute('href') : null, tag: g ? g.tagName : null, cible: g ? g.getAttribute('target') : null, hGeste: rg ? Math.round(rg.height) : 0, txt: x.innerText.replace(/\n/g, ' · ') };
}));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`;
        console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
        const { ctx, pg, errs } = await preparer(b, vp, sombre);
        await essaie('Ma journée', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          // L'écran attend ses données essentielles derrière son squelette (AttenteEcran) : les cartes y sont
          // montées mais cachées (innerText vide). On juge l'écran MONTRÉ.
          // (Juste après domcontentloaded, l'attente n'est pas encore montée : on attend qu'elle SOIT là et ouverte.)
          await pg.waitForFunction(() => !!document.querySelector('[data-attente]:not([data-attente="attente"])') && !document.getElementById('vrm-demarrage'), null, { timeout: 15000 }).catch(() => {});
          for (let i = 0; i < 40; i++) { if ((await cartes(pg)).length >= 3) break; await pg.waitForTimeout(250); }
          await pg.waitForTimeout(600);
          const c = await cartes(pg);
          const par = (k) => c.find((x) => x.cle === k) || null;
          const l1 = par('v:9401');
          dit(l1 && l1.genre === 'probleme' && l1.num === '12' && l1.limite === '', `${TT} Ma journée : « Litige · N°12 » relié PAR SA CONVERSATION, délai non lu`, JSON.stringify(l1));
          dit(l1 && /délai non lu/.test(l1.txt), `${TT} la carte dit « délai non lu » (jamais une date devinée)`, l1 && l1.txt);
          dit(!par('v:9402'), `${TT} la vente jumelle de titre (9402) n’a aucune carte`);
          dit(l1 && l1.tag === 'A' && l1.cible === '_blank' && l1.lien === `https://www.vinted.fr/inbox/${CONV_A}`, `${TT} le geste est un LIEN vers SA conversation sur Vinted (son clic)`, l1 && l1.lien);
          const r3 = par('v:9403');
          dit(r3 && r3.genre === 'retour' && r3.num === '20', `${TT} la vente « Retour initié » : « Retour · N°20 »`, JSON.stringify(r3));
          const ra = c.find((x) => x.genre === 'retour' && x.limite);
          dit(ra && ra.urgent && /avant le/.test(ra.txt), `${TT} le retour d’achat à renvoyer demain : date LUE, carte pressée (ambre)`, JSON.stringify(ra));
          dit(c.length && c.every((x) => x.hGeste >= 43.5), `${TT} pilules ≥ 44 px`, c.map((x) => x.hGeste).join(','));
          await pg.screenshot({ path: path.join(os.tmpdir(), `litiges-journee-${vp.width}${sombre ? '-sombre' : ''}.png`), fullPage: false });
          await sain(pg, `${TT} Ma journée`);
          // La carte ouvre SA vente.
          await pg.locator('[data-litige="v:9401"] .vrm-day-task-ouvrir').click({ timeout: 5000 });
          await pg.waitForTimeout(1500);
          const vu = await pg.evaluate(() => { const r = document.querySelector('.vrm-sale-row[data-tx="9401"]'); return { url: location.search, row: !!r, lit: !!document.querySelector('[data-recap-litige="probleme"][data-litige-cle="v:9401"]') }; });
          dit(vu.row, `${TT} la carte ouvre Ventes, sur la vente 9401`, JSON.stringify(vu));
        });
        await essaie('Récap de la vente', async () => {
          const ouvert = await pg.evaluate(() => !!document.querySelector('[data-recap-litige]'));
          if (!ouvert) { const t = pg.locator('.vrm-sale-row[data-tx="9401"] .vrm-ledger-sale-toggle').first(); if (await t.count()) await t.click({ timeout: 4000 }); else await pg.locator('.vrm-sale-row[data-tx="9401"]').first().click({ timeout: 4000 }); await pg.waitForTimeout(1200); }
          const r = await pg.evaluate(() => { const el = document.querySelector('[data-recap-litige]'); if (!el) return null; const a = el.querySelector('[data-litige-geste]'); return { genre: el.getAttribute('data-recap-litige'), cle: el.getAttribute('data-litige-cle'), txt: el.innerText.replace(/\n/g, ' · '), href: a && a.getAttribute('href'), h: a ? Math.round(a.getBoundingClientRect().height) : 0 }; });
          dit(r && r.cle === 'v:9401' && /délai non lu/.test(r.txt) && r.href === `https://www.vinted.fr/inbox/${CONV_A}`, `${TT} le récapitulatif de la vente 9401 dit le litige, son délai et le lien`, JSON.stringify(r));
          await pg.screenshot({ path: path.join(os.tmpdir(), `litiges-vente-${vp.width}${sombre ? '-sombre' : ''}.png`) });
        });
        await essaie('Recherche', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.waitForTimeout(2500);
          if (tel) await pg.locator('button[aria-label="Rechercher une paire"]').first().tap(); else await pg.locator('[data-recherche-champ]').first().click();
          await pg.waitForTimeout(400);
          const taper = async (q) => { await pg.locator('[data-recherche-champ]').first().fill(q); for (let i = 0; i < 30; i++) { const n = await pg.evaluate(() => document.querySelectorAll('[data-recherche-resultat]').length); if (n) break; await pg.waitForTimeout(250); } await pg.waitForTimeout(250); };
          const res = () => pg.evaluate(() => ({ r: [...document.querySelectorAll('[data-recherche-resultat]')].map((x) => ({ type: x.getAttribute('data-recherche-resultat'), par: x.getAttribute('data-recherche-par'), cle: x.getAttribute('data-recherche-cle'), h: Math.round(x.getBoundingClientRect().height) })),
            groupes: [...document.querySelectorAll('[data-recherche-groupe]')].map((g) => g.getAttribute('data-recherche-groupe')),
            panneau: (() => { const p = document.querySelector('[data-recherche-panneau]'); if (!p) return null; const r = p.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })(),
            sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          await taper('poupa');
          let x = await res();
          dit(x.r.length === 1 && x.r[0].cle === 'vente:9401' && x.r[0].par === 'pseudo', `${TT} « poupa » ⇒ la vente 9401 par le pseudo de l’acheteur (pas sa jumelle)`, JSON.stringify(x.r));
          if (tel) dit(x.panneau && x.panneau.bottom >= vp.height - 2, `${TT} au téléphone les résultats prennent tout l’écran`, JSON.stringify(x.panneau));
          await pg.screenshot({ path: path.join(os.tmpdir(), `recherche-pseudo-${vp.width}${sombre ? '-sombre' : ''}.png`) });
          await taper('XW309277125JF');
          x = await res();
          dit(x.r.length === 1 && x.r[0].cle === 'vente:9402' && x.r[0].par === 'suivi', `${TT} n° de suivi ⇒ la vente 9402 (son bordereau)`, JSON.stringify(x.r));
          await taper('alpha spezial');
          x = await res();
          dit(x.r.filter((r) => r.type === 'vente').map((r) => r.cle).sort().join() === 'vente:9401,vente:9402', `${TT} le titre trouve les DEUX jumelles, deux lignes`, JSON.stringify(x.r));
          await taper('482913');
          x = await res();
          dit(x.r.some((r) => r.type === 'colis' && r.par === 'code'), `${TT} code de retrait ⇒ le colis, groupe « Colis »`, JSON.stringify(x));
          dit(x.r.every((r) => r.h >= 43.5), `${TT} lignes ≥ 44 px`, x.r.map((r) => r.h).join(','));
          dit(x.sw <= x.cw + 1, `${TT} recherche : aucun débordement`, `${x.sw} > ${x.cw}`);
          await pg.screenshot({ path: path.join(os.tmpdir(), `recherche-code-${vp.width}${sombre ? '-sombre' : ''}.png`) });
          await pg.locator('[data-recherche-resultat="colis"]').first().click({ timeout: 4000 });
          await pg.waitForTimeout(1200);
          const apres = await pg.evaluate(() => ({ panneau: !!document.querySelector('[data-recherche-panneau]'), colis: !!document.querySelector('[data-cc-colonne], [data-groupe], .vrm-colis-bas, [data-colis-onglet]'), url: location.search }));
          dit(!apres.panneau && apres.colis, `${TT} le colis ouvre l’écran Colis (la recherche se ferme)`, JSON.stringify(apres));
        });
        dit(errs.length === 0, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ litiges + recherche : ${ko} rouge(s)` : '\n✅ litiges + recherche : tout est vert');
  process.exit(ko ? 1 : 0);
})();
