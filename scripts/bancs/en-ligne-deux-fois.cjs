// Banc : « N°x en ligne deux fois sur Vinted » dans Ma journée (6 nov., vague 3).
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles
// (`harvest_{uid}_listings` : `capturedAt`, `payload.items` ; `main.vinted_annonce_numeros`).
// Deux comptes. Téléphone 390 tactile et ordinateur 1512. Il juge ce qui est RENDU :
//   A. même PHOTO EXACTE sur deux comptes (N°12 et N°40) ⇒ UNE carte dans « À faire »,
//      `data-n=1`, ses deux annonces, sa ligne en AMBRE (jamais le rouge du doublon),
//      comptée dans « N gestes » ; « Voir » ouvre la feuille : les deux annonces, chacune
//      avec « Ouvrir sur Vinted » (vinted.fr, nouvel onglet), aucune écriture ni
//      commande ne part (VRM ne supprime rien) ; ni débordement ni erreur JS ;
//   B. 50 annonces au MÊME TITRE (photos et N° différents) ⇒ aucune carte ;
//   C. la même photo, mais le second compte lu il y a 30 h ⇒ aucune carte (« pas su »).
// Lancer :
//   npm run build && NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=9651 node scripts/bancs/en-ligne-deux-fois.cjs
// Captures : CAPTURES=<dossier>.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || Number(process.env.PORT) || 9651;
const CAPT = process.env.CAPTURES || '';

const maintenant = new Date(2026, 10, 6, 15, 30, 0);
const MS = maintenant.getTime();
const iso = (h) => new Date(MS - h * 3600e3).toISOString();
const A = '111', B = '222';
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'compte-alpha', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: B, login: 'compte-beta', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const photo = (dossier, fichier, taille = 'f800') => `https://images1.vinted.net/t/${dossier}/${taille}/${fichier}.jpeg?s=abc`;
const annonce = (id, title, ph) => ({ id, title, photo: ph, url: `https://www.vinted.fr/items/${id}-annonce`, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: iso(240), favourite_count: 1, view_count: 10 });

// Les scénarios : { listings: { uid: { cap, items } }, fiches }.
const SCENARIOS = {
  A: (() => {
    const pA = [annonce(5000001, 'Nike Air Max 90 blanc 42', photo('05_aaa_dossiera', '1700000001')), annonce(5000002, 'Adidas Samba noir 41', photo('05_bbb_dossierb', '1700000002')), annonce(5000003, 'Puma Suede bleu 40', photo('05_ccc_dossierc', '1700000003'))];
    const pB = [annonce(6000001, 'Air Max 90 blanche', photo('05_aaa_dossiera', '1700000001', 'f310')), annonce(6000002, 'Asics Gel bleu 43', photo('05_ddd_dossierd', '1700000004'))];
    return { listings: { [A]: { cap: iso(1), items: pA }, [B]: { cap: iso(2), items: pB } },
      fiches: { 5000001: { numero: '12', photoK: '05_aaa_dossiera/1700000001', accountId: A }, 5000002: { numero: '13', photoK: '05_bbb_dossierb/1700000002', accountId: A }, 5000003: { numero: '14', photoK: '05_ccc_dossierc/1700000003', accountId: A },
        6000001: { numero: '40', photoK: '05_aaa_dossiera/1700000001', accountId: B }, 6000002: { numero: '41', photoK: '05_ddd_dossierd/1700000004', accountId: B } } };
  })(),
  B: (() => {
    const lA = [], lB = [], fiches = {};
    for (let i = 0; i < 50; i++) {
      const id = 7000000 + i, ph = photo(`05_${i}_dossier${i}`, `17100000${i}`);
      (i % 2 ? lA : lB).push(annonce(id, 'Nike Dunk Low Panda 42', ph));
      fiches[id] = { numero: String(100 + i), photoK: `05_${i}_dossier${i}/17100000${i}`, accountId: i % 2 ? A : B };
    }
    return { listings: { [A]: { cap: iso(1), items: lA }, [B]: { cap: iso(1), items: lB } }, fiches };
  })(),
};
SCENARIOS.C = { listings: { [A]: SCENARIOS.A.listings[A], [B]: { ...SCENARIOS.A.listings[B], cap: iso(30) } }, fiches: SCENARIOS.A.fiches };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 300)); } };

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
    if (src === 'updated_at') { out[alias] = row.data && row.data.capturedAt || maintenant.toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};

const ouvrir = async (b, vp, sc) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: tel ? 2 : 1, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  const LIGNES = Object.entries(sc.listings).map(([uid, l]) => ({ id: `harvest_${uid}_listings`, data: { capturedAt: l.cap, uid, payload: { items: l.items, pagination: { total_entries: l.items.length } } } }));
  const main = { vinted_annonce_numeros: sc.fiches };
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecritures.push({ m: req.method(), u, t: Date.now() }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, sel)]);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  // La lecture des annonces arrive après les cases du jour : on attend qu'elle ait rendu.
  await pg.waitForFunction(() => document.querySelector('[data-en-ligne-deux-fois]'), null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs, ecritures };
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }]) {
      const nomVp = vp.width < 600 ? '390' : '1512';
      console.log(`\n── ${nomVp} px`);
      await essaie(`A ${nomVp}`, async () => {
        const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, SCENARIOS.A);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `deux-fois-A-${nomVp}.png`) });
        const r = await pg.evaluate(() => {
          const c = document.querySelector('[data-en-ligne-deux-fois]');
          if (!c) return { carte: false, texte: document.body.innerText.slice(0, 400) };
          const n = c.querySelector('.vrm-day-task-note'), t = c.querySelector('.vrm-day-task-title');
          const racine = getComputedStyle(document.documentElement);
          const box = c.getBoundingClientRect();
          const lignesDe = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const ys = [...new Set([...rg.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round((q.top + q.bottom) / 2)))].sort((a, b) => a - b); let k = 0, der = -1e9; for (const y of ys) { if (y - der > 4) { k++; der = y; } } return k; };
          const coupe = (e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2;
          return { carte: true, n: c.getAttribute('data-n'), complet: c.getAttribute('title'), lt: t ? lignesDe(t) : 0, ln: n ? lignesDe(n) : 0, coupeT: t ? coupe(t) : true, coupeN: n ? coupe(n) : true, ids: c.getAttribute('data-en-ligne-deux-fois'), titre: t && t.textContent, note: n && n.textContent,
            couleurNote: n && getComputedStyle(n).color, couleurTitre: t && getComputedStyle(t).color, warn: racine.getPropertyValue('--vrm-warn').trim(),
            gestes: (document.querySelector('[data-fu-gestes]') || {}).getAttribute ? document.querySelector('[data-fu-gestes]').getAttribute('data-fu-gestes') : null,
            nCartes: document.querySelectorAll('.vrm-day-task-list > .vrm-day-task, .vrm-day-task-list [data-job], .vrm-day-task-list [data-tuile]').length,
            visible: box.width > 2 && box.height > 2, deborde: document.documentElement.scrollWidth > window.innerWidth + 1, h: Math.round(box.height) };
        });
        dit(r.carte, 'même photo exacte sur deux comptes : la carte « en ligne deux fois » est dans « À faire »', r.texte);
        if (r.carte) {
          dit(r.n === '1' && r.ids === '5000001+6000001', 'une paire, ses deux annonces (5000001 + 6000001)', `${r.n} ${r.ids}`);
          dit(r.titre === 'N°12 en ligne deux fois', 'le titre : « N°12 en ligne deux fois »', r.titre);
          dit(r.note === '2 comptes · supprimes-en une', 'la ligne : les deux comptes et le geste', r.note);
          dit(/N°12 et N°40/.test(r.complet || '') && /compte-alpha et compte-beta/.test(r.complet || ''), 'l’infobulle nomme les deux N° et les deux comptes', r.complet);
          dit(r.lt === 1 && r.ln === 1 && !r.coupeT && !r.coupeN, 'titre et ligne tiennent chacun sur UNE ligne, sans être coupés', JSON.stringify({ lt: r.lt, ln: r.ln, coupeT: r.coupeT, coupeN: r.coupeN }));
          const rgb = (s) => (/rgba?\(([^)]+)\)/.exec(s || '') || [])[1];
          dit(!!rgb(r.couleurNote) && rgb(r.couleurNote) !== rgb(r.couleurTitre) && !/255,\s*59,\s*48|255,\s*69,\s*58/.test(r.couleurNote), 'la ligne est en AMBRE (pas l’encre, jamais le rouge du doublon)', `${r.couleurNote} / titre ${r.couleurTitre} / --vrm-warn ${r.warn}`);
          dit(r.visible && !r.deborde, 'visible, aucun débordement horizontal');
          dit(r.gestes != null && Number(r.gestes) >= 1, 'comptée dans « N gestes »', String(r.gestes));
        }
        await pg.click('[data-en-ligne-deux-fois]').catch(() => {});
        await pg.waitForSelector('[data-feuille-deux-fois]', { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(600);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `deux-fois-A-${nomVp}-feuille.png`) });
        const avant = ecritures.length;
        const f = await pg.evaluate(() => {
          const s = document.querySelector('[data-deux-fois-detail]');
          if (!s) return { feuille: false };
          const liens = [...s.querySelectorAll('[data-deux-fois-ouvrir]')].map((a) => ({ href: a.getAttribute('href'), cible: a.getAttribute('target'), h: Math.round(a.getBoundingClientRect().height) }));
          return { feuille: true, annonces: [...s.querySelectorAll('[data-deux-fois-annonce]')].map((e) => e.getAttribute('data-deux-fois-annonce')), liens,
            preuves: (s.querySelector('[data-preuves]') || { getAttribute: () => '' }).getAttribute('data-preuves'), deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
            boutonsSupprimer: [...s.querySelectorAll('button')].filter((x) => /supprim/i.test(x.textContent)).length };
        });
        dit(f.feuille, '« Voir » ouvre la feuille');
        if (f.feuille) {
          dit(f.annonces.join(',') === '5000001,6000001', 'la feuille montre les deux annonces', f.annonces.join(','));
          dit(f.liens.length === 2 && f.liens.every((l) => /^https:\/\/www\.vinted\.fr\/items\/\d+/.test(l.href) && l.cible === '_blank'), 'chaque annonce s’ouvre sur vinted.fr (nouvel onglet)', JSON.stringify(f.liens));
          dit(f.liens.every((l) => l.h >= 44), 'liens ≥ 44 px', JSON.stringify(f.liens.map((l) => l.h)));
          dit(f.preuves === 'photo', 'la preuve dite : la même photo exacte', f.preuves);
          dit(f.boutonsSupprimer === 0 && !f.deborde, 'aucun bouton qui supprime depuis VRM, aucun débordement');
        }
        await pg.waitForTimeout(400);
        const parties = ecritures.slice(avant).filter((e) => !/vrm_journee|push_|_vues|vrm_reprise|vrm_ecran/.test(e.u));
        dit(parties.length === 0, 'ouvrir la feuille n’écrit rien', JSON.stringify(parties.slice(0, 3)));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`B ${nomVp}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.B);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `deux-fois-B-${nomVp}.png`) });
        const r = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-en-ligne-deux-fois]'), rendu: !!document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') }));
        dit(r.rendu && !r.carte, '50 annonces au même titre (photos et N° différents) : aucune carte', JSON.stringify(r));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`C ${nomVp}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.C);
        const r = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-en-ligne-deux-fois]'), rendu: !!document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') }));
        dit(r.rendu && !r.carte, 'second compte lu il y a 30 h : aucune carte (« pas su »)', JSON.stringify(r));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
