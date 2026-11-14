// ── BANC : SÉCURITÉ DES COMPTES (12 nov.) — l'avertissement avant un message risqué,
//    la carte « Protège ton compte VRM », la copie des annonces par compte.
//        BANC_PORT=… node scripts/bancs/securite-comptes-avertir.cjs   (captures : SHOTS=dossier)
// Données INVENTÉES (aucune donnée réelle). 390 px tactile et 1512 px, clair ET sombre.
// A. Messages · Leboncoin, un fil lu (forme des lignes de l'extension 5.318) :
//    A1 un message risqué (« PayPal », un numéro) est dit en AMBRE pendant la saisie ;
//    A2 « Envoyer » ouvre la feuille « Leboncoin bannit pour ça… », lignes ambre, AUCUNE
//       commande ne part ; « Corriger » ne fait rien partir ;
//    A3 « Envoyer quand même » fait partir UNE commande `lbcRepondre`, le texte tel quel ;
//    A4 un message sûr part sans feuille (rien de changé pour lui).
// B. Paramètres :
//    B1 la carte « Protège ton compte VRM » (double vérification lue inactive), 44 px ;
//       « Plus tard » la range, elle ne revient pas au rechargement ;
//    B2 Mes comptes → « Copie de mes annonces » : une ligne par compte ; « Télécharger »
//       produit UN zip (annonces.csv, LISEZ-MOI.txt) sans RIEN écrire en base.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4617);
const CAP = process.env.SHOTS || path.join(require('os').tmpdir(), 'vrm-bancs');
const auj = Date.now(), iso = (ms) => new Date(ms).toISOString();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const U1 = 'aaaa1111-0000-4000-8000-000000000001';
const CONV = 'c0c0c0c0-1111-4222-8333-944455556666';
const MESSAGES = [
  { id: 'm1', t: 'Bonjour, les Air Max sont toujours dispo ?', deMoi: false, at: iso(auj - 3 * 3600e3) },
  { id: 'm2', t: 'Oui, toujours !', deMoi: true, at: iso(auj - 2 * 3600e3) },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null }];
const ROWS = [
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', capturedAt: iso(auj - 60e3), payload: { items: [
    { id: 9001, title: 'Nike Air Max 90 blanches', price: { amount: '60.0', currency_code: 'EUR' }, photos: [] },
    { id: 9002, title: 'Adidas Samba noires', price: { amount: '45.0', currency_code: 'EUR' }, description: 'Taille 41', photos: [] },
  ], pagination: { total_entries: 2, current_page: 1, total_pages: 1 } } } },
];
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'updated_at' || src === 'owner') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const PONT = ({ version }) => {
  window.__cmds = [];
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, lbcRepondre: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: d.cmd === 'lbcRepondre' ? { accepte: true, etape: 'fait', statut: 201 } : { accepte: false, code: 'banc', raison: 'banc' } }), 120);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};
async function ouvrir(b, vp, sombre, url) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecrits = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: '5.344.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { ecrits.push(req.method() + ' ' + u.slice(0, 120)); return j([]); }
    if (/select=owner/.test(u) && !/vinted_accounts/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'lbc_accounts' }]);
    if (/id=eq\.lbc_messages/.test(u)) return j([{ compteurs: { [U1]: { unread: 1, at: iso(auj - 600e3) } }, comptes: { [U1]: { name: 'Totomondu', pro: false, at: iso(auj) } } }]);
    if (/id=eq\.lbc_accounts/.test(u)) return j([{ a: { ['lbc-account:' + U1]: { id: 'lbc-account:' + U1, name: 'Totomondu', type: 'particulier', sessionAt: iso(auj) } } }]);
    if (/id=like\.lbc_fil_/.test(u)) return j([{ id: 'lbc_fil_' + CONV, n: '2', da: MESSAGES[1].at, ap: MESSAGES[1].t, dm: 'true', compte: U1 }]);
    if (/id=eq\.lbc_fil_/.test(u)) return j([{ messages: MESSAGES, page: '/messages/id/' + CONV }]);
    if (/id=eq\.lbc_envoi/.test(u)) return j([{ appris: true, raison: '', at: iso(auj - 86400e3) }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecrits };
}
const capture = async (pg, nom) => { fs.mkdirSync(CAP, { recursive: true }); await pg.waitForTimeout(250); await pg.screenshot({ path: path.join(CAP, nom + '.png'), fullPage: false }).catch(() => {}); };
const lbcCmds = (pg) => pg.evaluate(() => window.__cmds.map((x) => JSON.parse(x)).filter((x) => x.cmd === 'lbcRepondre'));
const RISQUE = 'Paie par PayPal stp, mon 06 12 34 56 78';

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const sombre of [false, true]) for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 900 }]) {
      const L = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`, suf = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
      // (14 nov., système de design) une cible fait 44 px au doigt (390, tactile) et 36 à la souris (1512) — DESIGN.md §6.
      const CIBLE = vp.width < 600 ? 44 : 36;
      console.log(`\n══ ${L} — A. message risqué sur Leboncoin`);
      {
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=messages&site=leboncoin');
        await pg.waitForSelector(`[data-lbc-conv="${CONV}"] button`, { timeout: 20000 }).catch(() => {});
        await pg.click(`[data-lbc-conv="${CONV}"] button`).catch(() => {});
        await pg.waitForSelector('[data-lbc-repondre="pret"] textarea', { timeout: 10000 }).catch(() => {});
        await pg.fill('[data-lbc-repondre] textarea', RISQUE);
        const a1 = await pg.evaluate(() => { const p = document.querySelector('[data-message-risque]'); const t = document.querySelector('[data-lbc-repondre] textarea'); if (!p) return null; const r = p.getBoundingClientRect(); return { codes: p.getAttribute('data-message-risque'), texte: p.innerText, couleur: getComputedStyle(p).color, encre: getComputedStyle(document.body).color, vu: r.width > 0 && r.bottom <= innerHeight + 1 && r.top >= 0, champ: t ? getComputedStyle(t).color : '' }; });
        dit(a1 && /telephone/.test(a1.codes) && /paiement/.test(a1.codes) && /Leboncoin bannit pour ça/.test(a1.texte), `${L} : A1 dit pendant la saisie (téléphone, paiement)`, JSON.stringify(a1));
        dit(a1 && a1.couleur !== a1.encre && a1.couleur !== a1.champ && a1.vu, `${L} : A1 en ambre, visible`, a1 && `${a1.couleur} / encre ${a1.encre}`);
        await capture(pg, `securite-saisie-${suf}`);
        await pg.click('[data-lbc-envoyer]');
        await pg.waitForSelector('[data-verif-sheet="leboncoin"]', { timeout: 8000 }).catch(() => {});
        const a2 = await pg.evaluate(() => { const s = document.querySelector('[data-verif-sheet="leboncoin"]'); if (!s) return null; const q = s.querySelector('[data-verif-publier]'), c = s.querySelector('[data-verif-corriger]'); return { titre: (s.querySelector('[data-verif-titre]') || {}).innerText || '', ambres: s.querySelectorAll('[data-verif-ambre]').length, couper: s.querySelectorAll('[data-verif-couper]').length, ok: q ? q.innerText : '', hq: q ? q.getBoundingClientRect().height : 0, hc: c ? c.getBoundingClientRect().height : 0 }; });
        dit(a2 && /Leboncoin bannit pour ça : sortir la vente de la plateforme/.test(a2.titre) && a2.ambres >= 2 && a2.couper === 0 && /Envoyer quand même/.test(a2.ok), `${L} : A2 la feuille : le site, deux lignes ambre, « Envoyer quand même », rien à couper`, JSON.stringify(a2));
        dit(a2 && a2.hq >= 44 && a2.hc >= 44, `${L} : A2 boutons 44 px`, a2 && `${a2.hq} · ${a2.hc}`);
        dit((await lbcCmds(pg)).length === 0, `${L} : A2 rien n’est parti pendant la feuille`);
        await capture(pg, `securite-feuille-${suf}`);
        await pg.click('[data-verif-corriger]');
        await pg.waitForTimeout(300);
        dit((await lbcCmds(pg)).length === 0, `${L} : A2 « Corriger » : rien ne part, le texte reste`, await pg.inputValue('[data-lbc-repondre] textarea').catch(() => ''));
        await pg.click('[data-lbc-envoyer]');
        await pg.waitForSelector('[data-verif-publier]', { timeout: 8000 }).catch(() => {});
        await pg.click('[data-verif-publier]');
        await pg.waitForSelector('[data-lbc-resultat]', { timeout: 8000 }).catch(() => {});
        const c3 = await lbcCmds(pg);
        dit(c3.length === 1 && c3[0].texte === RISQUE && c3[0].conv === CONV, `${L} : A3 « Envoyer quand même » : UNE commande, le texte tel quel`, JSON.stringify(c3));
        await pg.fill('[data-lbc-repondre] textarea', 'Oui, envoi demain en point relais.');
        dit(!(await pg.$('[data-message-risque]')), `${L} : A4 un message sûr n’est pas averti`);
        await pg.click('[data-lbc-envoyer]');
        await pg.waitForTimeout(600);
        const c4 = await lbcCmds(pg);
        dit(!(await pg.$('[data-verif-sheet]')) && c4.length === 2, `${L} : A4 et part sans feuille`, JSON.stringify(c4.map((x) => x.texte)));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `${L} : aucun débordement`, deb);
        dit(errs.length === 0, `${L} : aucune erreur d’app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      }
      console.log(`══ ${L} — B. Paramètres`);
      {
        const { ctx, pg, errs, ecrits } = await ouvrir(b, vp, sombre, '?tab=settings');
        await pg.waitForSelector('[data-carte-mfa]', { timeout: 30000 }).catch(() => {});
        const b1 = await pg.evaluate(() => { const c = document.querySelector('[data-carte-mfa]'); if (!c) return null; const r = c.getBoundingClientRect(); return { t: c.innerText, h: [...c.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height), w: r.width, droite: r.right <= innerWidth + 1 }; });
        dit(b1 && /Protège ton compte VRM/.test(b1.t) && /2 minutes/.test(b1.t) && /Activer/.test(b1.t) && b1.droite, `${L} : B1 la carte, le pas à pas, « Activer »`, JSON.stringify(b1));
        dit(b1 && b1.h.length === 2 && b1.h.every((h) => h >= CIBLE), `${L} : B1 boutons ${CIBLE} px`, b1 && b1.h.join(','));
        await pg.locator('[data-carte-mfa]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `securite-carte-mfa-${suf}`);
        // « Plus tard » : rangée, et pas de retour au rechargement.
        await pg.click('[data-carte-mfa-plus-tard]').catch(() => {});
        await pg.waitForTimeout(200);
        const range = !(await pg.$('[data-carte-mfa]'));
        await pg.reload({ waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-sous-ouvrir], [data-reglage-toutvabien]', { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(800);
        await pg.waitForSelector('[data-sous-ouvrir="copieannonces"], [data-copie-annonces]', { timeout: 20000 }).catch(() => {});
        dit(range && !(await pg.$('[data-carte-mfa]')), `${L} : B1 « Plus tard » la range pour de bon`);
        // La copie : la ligne de Paramètres, ouverte.
        const sous = pg.locator('[data-sous-ouvrir="copieannonces"]').first();
        if (!(await pg.locator('[data-copie-annonces]').first().isVisible().catch(() => false))) await sous.click().catch(() => {});
        await pg.waitForSelector('[data-copie-compte="111"]', { timeout: 15000 }).catch(() => {});
        const b2 = await pg.evaluate(() => { const l = document.querySelector('[data-copie-compte="111"]'); const btn = l && l.querySelector('[data-copie-telecharger]'); return l ? { t: l.innerText, h: btn ? btn.getBoundingClientRect().height : 0 } : null; });
        dit(b2 && /atelier_test/.test(b2.t) && b2.h >= CIBLE, `${L} : B2 une ligne par compte, « Télécharger » ${CIBLE} px`, JSON.stringify(b2));
        await capture(pg, `securite-copie-${suf}`);
        const avant = ecrits.length;
        const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }).catch(() => null), pg.click('[data-copie-telecharger="111"]').catch(() => {})]);
        let zip = null; if (dl) { const p = await dl.path().catch(() => null); if (p) zip = fs.readFileSync(p); }
        const txt = zip ? zip.toString('latin1') : '';
        dit(!!zip && txt.startsWith('PK') && /VRM-annonces-atelier_test-\d{4}-\d{2}-\d{2}\/annonces\.csv/.test(txt) && /LISEZ-MOI\.txt/.test(txt) && /9001/.test(txt) && /9002/.test(txt), `${L} : B2 UN zip, un dossier, les deux annonces`, dl ? dl.suggestedFilename() : 'aucun téléchargement');
        await pg.waitForSelector('[data-copie-compte="111"][data-copie-etat="fini"]', { timeout: 8000 }).catch(() => {});
        dit(ecrits.length === avant, `${L} : B2 rien n’est écrit en base`, ecrits.slice(avant).join(' | '));
        dit(errs.length === 0, `${L} : aucune erreur d’app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ sécurité des comptes : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ sécurité des comptes : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
