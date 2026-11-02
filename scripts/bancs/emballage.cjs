// ── BANC : LE MODE EMBALLAGE (1er nov., maquette validée par Julien) ────────────
// Depuis Colis (colonne « Prêts à imprimer », bouton « Emballer ») et Ma journée,
// un écran plein passe les colis prêts UN PAR UN. Données INVENTÉES (le dépôt est
// public), à la forme des lignes réelles :
//   · 4 ventes à expédier AVEC bordereau (prêtes) : N°117 rangé dans « Meuble B »,
//     N°42 porté par DEUX ventes à poster de titres différents (deux paires sous un
//     N° ⇒ rouge, §5), N°73 numéroté pendant la panne (à vérifier ⇒ ambre) ;
//   · 1 vente sans bordereau (en attente) — pas proposée ;
//   · 1 vente déjà cochée « postée » — pas proposée.
// Exige (390 px tactile et 1512 px) :
//   A. le bouton « Emballer » de la colonne Prêts porte le nombre de prêts ;
//   B. l'ORDRE de la séance = l'ordre des cartes de la colonne « Prêts » (pas trié
//      par emplacement — refus du 11 oct.) ;
//   C. le N° en très grand (police système depuis le style Apple du 2 nov. ; Geist Mono avant), l'emplacement lu dans le Stock (« Meuble
//      B · rangée 2, colonne 3 ») ou « Pas rangée » ;
//   D. deux paires sous un N° ⇒ le N° en rouge + « vérifie le carton » ; N° à
//      vérifier ⇒ ambre ;
//   E. les cases restent cochées après fermeture (sur l'appareil, le temps de la
//      séance) ;
//   F. rien n'est posté sans SON clic : après avoir tout parcouru, `vinted_ship_done`
//      est inchangé ; « Marquer ces N colis » ne compte que les colis aux 3 cases ;
//   G. le geste final écrit EXACTEMENT ce qu'écrit le bouton « ✓ Colis fait » d'une
//      carte (`vinted_ship_done[tx]` horodaté, `vinted_bords_shipped[tx] = 1`) ;
//   H. Ma journée → « Emballer les colis prêts » ouvre la séance sur Colis ;
//   I. cibles ≥ 44 px, aucun débordement, aucune erreur ; captures regardées.
// `BANC_MUTATION` : `tri` (trier par emplacement), `rouge` (ignorer les conflits),
// `auto` (marquer posté sans clic), `moitie` (n'écrire que la vente) ⇒ rouge.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9231);
const SHOTS = process.env.SHOTS || os.tmpdir();
const MUT = process.env.BANC_MUTATION || '';

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const AEXP = 'Le paiement a été validé';
const v = (tx, titre, j, item) => ({ transaction_id: tx, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(j), item_id: item });
const VENTES = [
  v(7001, 'Adidas Samba OG taille 41', 0.2, 5001),
  v(7002, 'Nike Air Max 90 taille 42', 0.4, 5002),
  v(7003, 'Nike Dunk Low taille 44', 0.6, 5003),
  v(7004, 'Puma Suede taille 39', 0.8, 5004),
  v(7005, 'Asics Gel-1130 taille 40', 1.0, 5005),
  v(7006, 'New Balance 550 taille 43', 2, 5006),
];
const NUMS = {
  5001: { numero: '117', title: VENTES[0].title, numberedAt: '2026-10-20T10:00:00Z', auto: false },
  5002: { numero: '42', title: VENTES[1].title, numberedAt: '2026-10-20T10:00:00Z', auto: false },
  5003: { numero: '73', title: VENTES[2].title, numberedAt: '2026-10-15T10:00:00Z' },
  5004: { numero: '42', title: VENTES[3].title, numberedAt: '2026-10-21T10:00:00Z', auto: false },
  5005: { numero: '61', title: VENTES[4].title, numberedAt: '2026-10-20T10:00:00Z', auto: false },
  5006: { numero: '64', title: VENTES[5].title, numberedAt: '2026-10-20T10:00:00Z', auto: false },
};
const MEUBLES = [{ id: 'mB', name: 'Meuble B', cols: 4, rows: 3 }];
const SLOTS = { 117: { m: 'mB', i: 6 } };
const SHIP0 = { 7006: M - 3600e3 };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const ROWS = [
  { id: 'main', data: { vinted_ship_done: SHIP0, vinted_annonce_numeros: NUMS, vrm_meubles: MEUBLES, vrm_slots: SLOTS } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), payload: { my_orders: [] } } },
  // Le pont transaction → annonce (la forme de la base, `meta` servi par `_meta.cjs`).
  ...VENTES.map((x) => ({ id: `harvest_111_txn_${x.transaction_id}`, data: { capturedAt: iso(M), payload: { transaction: { id: x.transaction_id, item_id: x.item_id, status: 230, status_title: 'Payée' } } } })),
  ...[7001, 7002, 7003, 7004, 7006].map((tx) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi: `TRK${tx}`, receivedAt: iso(M - 3 * 3600e3), pdfB64: 'JVBERi0xLjQK' } })),
];
const PRETS = ['v:7001', 'v:7002', 'v:7003', 'v:7004'];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  let corps = fs.readFileSync(p);
  // Les mutations : on réaffaiblit la règle DANS le paquet servi.
  if (MUT && /\.js$/.test(p)) {
    let t = corps.toString('utf8');
    if (MUT === 'tri') t = t.replace(/return prets\.map\(/g, 'return prets.slice().sort((a,b)=>String(a.num).localeCompare(String(b.num))).map(');
    if (MUT === 'rouge') t = t.replace(/conflits:\s*conflitsNum/g, 'conflits:[]').replace(/conflits:([a-zA-Z_$][\w$]*),fiches:/g, 'conflits:[],fiches:');
    if (MUT === 'moitie') t = t.replace(/if\s*\(\s*b\s*\)\s*markBordShipped\(b\)/g, 'void 0');
    corps = Buffer.from(t, 'utf8');
  }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(corps);
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
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    if (/pdfB64$/.test(src)) x = x ? 'true' : null;
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x === 'object' ? JSON.stringify(x) : x);
  }
  return out;
};

async function preparer(b, vp, tab) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sd, n, m, s, mut }) => { try {
    if (sessionStorage.getItem('__banc_pose')) return; sessionStorage.setItem('__banc_pose', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_ship_done', JSON.stringify(sd));
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_meubles', JSON.stringify(m)); localStorage.setItem('vrm_slots', JSON.stringify(s));
    localStorage.removeItem('vrm_emballage_seance');
  } catch (_) {} }, { sd: SHIP0, n: NUMS, m: MEUBLES, s: SLOTS, mut: MUT });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const attendrePrets = async (pg) => {
  await pg.locator('[data-colis-onglet]').first().waitFor({ timeout: 25000 }).catch(() => {});
  for (let i = 0; i < 40; i++) { const n = await pg.evaluate(() => document.querySelectorAll('[data-bord-card][data-groupe-carte="pret"]').length); if (n >= 4) break; await pg.waitForTimeout(400); }
  await pg.waitForTimeout(800);
};
const ls = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const ecran = (pg) => pg.evaluate(() => {
  const d = document.querySelector('[data-emballage]');
  if (!d) return null;
  const c = d.querySelector('[data-emb-cle]');
  const g = d.querySelector('[data-emb-grand-num]');
  const cs = g ? getComputedStyle(g) : null;
  return {
    vue: d.getAttribute('data-emb-vue'), ordre: (d.getAttribute('data-emb-ordre') || '').split(',').filter(Boolean), titre: (d.querySelector('[data-emb-titre]') || {}).textContent || '',
    cle: c ? c.getAttribute('data-emb-cle') : null, num: c ? c.getAttribute('data-emb-num') : null, etatNum: c ? c.getAttribute('data-emb-etat-num') : null,
    grand: g ? g.textContent : null, police: cs ? cs.fontFamily : '', couleur: cs ? cs.color : '', taille: cs ? parseFloat(cs.fontSize) : 0,
    alerte: (d.querySelector('[data-emb-alerte]') || {}).textContent || '', emplEtat: (d.querySelector('[data-emb-emplacement]') || { getAttribute: () => null }).getAttribute('data-emb-emplacement'),
    empl: (d.querySelector('[data-emb-emplacement]') || {}).innerText || '', transport: (d.querySelector('[data-emb-transport]') || {}).textContent || '',
    cases: [...d.querySelectorAll('[data-emb-case]')].map((x) => [x.getAttribute('data-emb-case'), x.getAttribute('aria-checked')]),
    marquer: (() => { const x = d.querySelector('[data-emb-marquer]'); return x ? Number(x.getAttribute('data-emb-marquer')) : null; })(),
    petits: [...d.querySelectorAll('button')].filter((x) => { const r = x.getBoundingClientRect(); return r.height > 0 && (r.height < 43.5 || r.width < 43.5); }).map((x) => (x.textContent || x.getAttribute('aria-label') || '').slice(0, 30)),
    fait: d.querySelector('[data-emb-fait]') ? Number(d.querySelector('[data-emb-fait]').getAttribute('data-emb-fait')) : null,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, veille: d.getAttribute('data-emb-veille'),
  };
});
const rgb = (s) => (/rgba?\((\d+), (\d+), (\d+)/.exec(s || '') || []).slice(1).map(Number);

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      console.log('── ' + T);
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'cat_bord');
        await attendrePrets(pg);
        const cartes = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-groupe-carte="pret"]')].map((k) => k.getAttribute('data-colis-ident')));
        dit(JSON.stringify(cartes.slice().sort()) === JSON.stringify(PRETS.slice().sort()), `${T} la colonne « Prêts » porte les 4 prêts (le banc a de quoi juger)`, cartes.join());
        const bt = await pg.$('[data-emballer-ouvrir]');
        const nBt = bt ? Number(await bt.getAttribute('data-emballer-ouvrir')) : null;
        dit(nBt === cartes.length, `A ${T} « Emballer » dans la colonne Prêts, sur ses ${cartes.length} colis`, String(nBt));
        if (!bt) { await ctx.close(); return; }
        await bt.click();
        await pg.waitForSelector('[data-emballage]', { timeout: 5000 }).catch(() => {});
        let E = await ecran(pg);
        dit(!!E && E.vue === 'colis', `A ${T} l'écran plein s'ouvre sur le premier colis`, E && E.vue);
        dit(!!E && JSON.stringify(E.ordre) === JSON.stringify(cartes), `B ${T} l'ordre de la séance = l'ordre de la colonne « Prêts »`, E && (E.ordre.join() + ' / ' + cartes.join()));
        dit(!!E && E.cle === cartes[0] && /Colis 1 sur 4/.test(E.titre), `B ${T} « Colis 1 sur 4 », le premier de la colonne`, E && (E.cle + ' ' + E.titre));
        const shipAvant = JSON.stringify(await ls(pg, 'vinted_ship_done'));
        const vus = {};
        const cliques = { 'v:7001': ['trouvee', 'emballee', 'colle'], 'v:7003': ['trouvee', 'emballee', 'colle'], 'v:7002': ['trouvee'] };
        for (let i = 0; i < 4 && E; i++) {
          E = await ecran(pg); if (!E || E.vue !== 'colis') break;
          vus[E.cle] = E;
          if (i === 0) await pg.screenshot({ path: path.join(SHOTS, `emballage-${vp.width}-premier.png`) });
          for (const k of (cliques[E.cle] || [])) await pg.click(`[data-emb-case="${k}"]`);
          if (E.cle === 'v:7001') {
            await pg.waitForTimeout(300);
            const fond = await pg.evaluate(() => { const x = document.querySelector('.vrm-emb-boite.is-coche'); return x ? getComputedStyle(x).backgroundColor : null; });
            dit(!!fond && rgb(fond)[0] < 60, `I ${T} une case cochée est pleine, à l'encre`, fond);
          }
          if (E.cle === 'v:7002') { await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `emballage-${vp.width}-double.png`) }); }
          if (i === 1) {
            // E. Fermer puis rouvrir : la séance reprend, les cases sont restées.
            await pg.click('[data-emb-fermer]'); await pg.waitForTimeout(300);
            await pg.click('[data-emballer-ouvrir]'); await pg.waitForSelector('[data-emballage]', { timeout: 5000 });
            const re = await ecran(pg);
            if (re && re.cle !== E.cle) { await pg.click('[data-emb-suivant]'); }
            const re2 = await ecran(pg);
            const attendu = (cliques[E.cle] || []);
            dit(!!re2 && re2.cle === E.cle && re2.cases.filter(([, c]) => c === 'true').map(([k]) => k).join() === attendu.join(), `E ${T} les cases cochées survivent à la fermeture (séance sur l'appareil)`, re2 && JSON.stringify(re2.cases));
          }
          await pg.click('[data-emb-suivant]'); await pg.waitForTimeout(150);
        }
        const p117 = vus['v:7001'];
        dit(!!p117 && p117.grand === '117' && /-apple-system|SF Pro/.test(p117.police) && p117.taille >= 80, `C ${T} le N° en très grand, police système (style Apple du 2 nov.)`, p117 && `${p117.grand} · ${p117.police} · ${p117.taille}px`);
        dit(!!p117 && p117.emplEtat === 'range' && /Meuble B/.test(p117.empl) && /rangée 2, colonne 3/.test(p117.empl), `C ${T} l'emplacement lu dans le Stock, par N°`, p117 && p117.empl);
        // Le bordereau reçu par e-mail ne nomme pas le transporteur : rien n'est inventé.
        dit(!!p117 && !p117.transport && !/Bordereau .+ collé/.test(JSON.stringify(p117.cases)), `C ${T} transporteur pas connu ⇒ aucune ligne inventée`, p117 && p117.transport);
        const p42 = vus['v:7002'], p42b = vus['v:7004'];
        const r42 = p42 ? rgb(p42.couleur) : [];
        dit(!!p42 && p42.etatNum === 'double' && r42[0] > 150 && r42[1] < 110 && /vérifie le carton/.test(p42.alerte) && p42b && p42b.etatNum === 'double', `D ${T} deux paires sous le N°42 ⇒ rouge + « vérifie le carton »`, p42 && `${p42.etatNum} ${p42.couleur} ${p42.alerte}`);
        const p73 = vus['v:7003'], r73 = p73 ? rgb(p73.couleur) : [];
        dit(!!p73 && p73.etatNum === 'a-verifier' && r73[0] > 110 && r73[2] < 90, `D ${T} un N° à vérifier sur son carton ⇒ ambre`, p73 && `${p73.etatNum} ${p73.couleur}`);
        dit(!!p117 && p117.etatNum === 'ok' && rgb(p117.couleur)[0] < 60, `D ${T} un N° sans souci reste à l'encre`, p117 && p117.couleur);
        dit(!!p42b && p42b.emplEtat === 'pas-range' && /Pas rangée/.test(p42b.empl), `C ${T} une paire pas rangée le dit`, p42b && p42b.empl);
        E = await ecran(pg);
        dit(!!E && E.vue === 'fin', `F ${T} après le dernier colis : le récapitulatif`, E && E.vue);
        await pg.waitForTimeout(900); // l'écriture de l'app est différée de 500 ms
        const shipApres = JSON.stringify(await ls(pg, 'vinted_ship_done'));
        dit(shipAvant === shipApres, `F ${T} rien n'est posté sans son clic (vinted_ship_done inchangé après tout le parcours)`, `${shipAvant} → ${shipApres}`);
        dit(!!E && E.marquer === 2, `F ${T} « Marquer ces N colis » ne compte que les colis aux 3 cases cochées`, E && String(E.marquer));
        dit(!!E && !E.petits.length, `I ${T} chaque bouton de l'écran fait au moins 44 px`, E && E.petits.join(' | '));
        dit(!!E && E.sw <= E.cw + 1, `I ${T} aucun débordement horizontal`, E && `${E.sw} > ${E.cw}`);
        await pg.screenshot({ path: path.join(SHOTS, `emballage-${vp.width}-fin.png`) });
        // G. Le geste final, puis le bouton « ✓ Colis fait » d'une AUTRE carte : la même écriture.
        await pg.click('[data-emb-marquer]'); await pg.waitForTimeout(1200);
        E = await ecran(pg);
        dit(!!E && E.fait === 2, `G ${T} le geste final marque les 2 colis complets`, E && String(E.fait));
        const ship = await ls(pg, 'vinted_ship_done') || {}, bords = await ls(pg, 'vinted_bords_shipped') || {};
        const ajoutes = Object.keys(ship).filter((k) => !(k in SHIP0)).sort();
        dit(ajoutes.join() === '7001,7003' && ajoutes.every((k) => Number.isFinite(ship[k])), `G ${T} vinted_ship_done : exactement les deux colis complets, horodatés`, JSON.stringify(ship));
        dit(bords['7001'] === 1 && bords['7003'] === 1 && !('7002' in bords) && !('7004' in bords), `G ${T} vinted_bords_shipped : les mêmes deux bordereaux`, JSON.stringify(bords));
        dit(!(await ls(pg, 'vrm_emballage_seance')), `G ${T} la séance est effacée après le geste`);
        await pg.click('[data-emb-fermer-fin]').catch(() => {}); await pg.waitForTimeout(300);
        const fait = await pg.$('[data-bord-card][data-tx-colis="7004"] [data-geste="fait"]');
        if (fait) {
          await fait.click(); await pg.waitForTimeout(1200);
          const ship2 = await ls(pg, 'vinted_ship_done') || {}, bords2 = await ls(pg, 'vinted_bords_shipped') || {};
          const forme = (s, bb, tx) => JSON.stringify([typeof s[tx], bb[tx]]);
          dit(forme(ship2, bords2, '7004') === forme(ship2, bords2, '7001') && forme(ship2, bords2, '7004') === JSON.stringify(['number', 1]), `G ${T} le bouton « ✓ Colis fait » écrit la même chose que le mode emballage`, `${forme(ship2, bords2, '7004')} / ${forme(ship2, bords2, '7001')}`);
        } else dit(false, `G ${T} le bouton « ✓ Colis fait » de la carte N°42 (7004) est trouvé`);
        const prets2 = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-groupe-carte="pret"]')].map((k) => k.getAttribute('data-colis-ident')));
        dit(prets2.join() === 'v:7002', `G ${T} les colis marqués quittent « Prêts à imprimer »`, prets2.join());
        dit(!errs.length, `I ${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      if (vp.width === 390) await essaie('H', async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'journee');
        let job = null;
        // (1er nov.) Quand la Tournée est là, c'est SON étape « Emballer » qui ouvre la
        // séance (la ligne « Emballer les colis prêts » n'est plus redite, §7) ; sans
        // Tournée, la ligne d'« À faire ». Le même geste, le même mode.
        for (let i = 0; i < 40 && !job; i++) { job = await pg.$('[data-job="emballer"]') || await pg.$('[data-tournee-etape="emballer"][data-etat="afaire"] button'); if (!job) await pg.waitForTimeout(400); }
        const parTournee = !!job && !(await pg.$('[data-job="emballer"]'));
        dit(!!job, `H ${T} Ma journée propose d'emballer les colis prêts${parTournee ? ' (étape Emballer de la Tournée)' : ''}`);
        if (parTournee) dit(!(await pg.$('[data-job="emballer"]')), `H ${T} … une seule fois : pas de ligne « Emballer » en plus de l'étape`);
        if (job) {
          await job.click();
          await pg.waitForSelector('[data-emballage]', { timeout: 15000 }).catch(() => {});
          for (let i = 0; i < 30; i++) { const E = await ecran(pg); if (E && E.ordre.length >= 4) break; await pg.waitForTimeout(400); }
          const E = await ecran(pg);
          const cartes = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-groupe-carte="pret"]')].map((k) => k.getAttribute('data-colis-ident')));
          dit(!!E && E.vue === 'colis' && JSON.stringify(E.ordre) === JSON.stringify(cartes), `H ${T} … qui ouvre la séance sur Colis, dans l'ordre de la colonne`, E && (E.ordre.join() + ' / ' + cartes.join()));
          await pg.screenshot({ path: path.join(SHOTS, `emballage-${vp.width}-depuis-journee.png`) });
          // La fiche complète de la paire, depuis le colis en cours (par son N°).
          const n = E && E.num;
          await pg.click('[data-emb-fiche]').catch(() => {});
          await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
          const fp = await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); return f ? f.getAttribute('data-fiche-paire') : null; });
          dit(!!n && fp === n && !(await pg.$('[data-emballage]')), `H ${T} « Toute l'histoire du N° » ouvre la fiche de CETTE paire`, `${fp} / ${n}`);
        }
        dit(!errs.length, `H ${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ mode emballage : ${ko} rouge(s).` : `\n✅ mode emballage : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
