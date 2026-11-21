// Banc : « Avis 2★ reçu sur compte-alpha » dans Ma journée (11 nov., lot avis-negatif).
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles : `vrm_avis_bas`
// (la mémoire du serveur, `alertes`), `vrm_avis_bas_vus`, `harvest_{uid}_feedbacks`
// (`payload.user_feedbacks` : { id, rating, feedback } mesuré le 10 nov.),
// `harvest_{uid}_profile` (`payload.user.id`). Projections `select=` APPLIQUÉES.
// Téléphone 390 tactile et ordinateur 1512, clair et sombre. Il juge ce qui est RENDU :
//   A. un 2★ sans n° de transaction, texte rangé : la carte dans « À faire » (comptée,
//      ambre), son titre, le texte de l'avis ; « Lire » ouvre la feuille : le texte,
//      « Répondre sur Vinted ↗ » vers le PROFIL DES AVIS (id de profil 4242, nouvel
//      onglet), PAS de « Voir la vente », la phrase « Vinted ne dit pas quelle vente » ;
//      cibles ≥ 44 px ; « C'est vu » écrit `vrm_avis_bas_vus` (la clé de l'avis, les
//      autres gardées) et la carte s'en va ; ouvrir la feuille n'écrit rien ;
//   B. un 1★ qui porte son n° de transaction, texte PAS rangé : « Lis l'avis sur Vinted. »,
//      « Voir la vente et écrire » mène à Ventes (cible = CETTE transaction) ;
//   C. la mémoire illisible (522) : aucune carte, aucune erreur ; D. alerte d'un compte
//      retiré, ou déjà vue : aucune carte.
// `BANC_DIST=<dist>` : un autre build (l'arbre d'avant). Captures : CAPTURES=<dossier>.
//   npm run build && NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=9661 node scripts/bancs/avis-negatif.cjs
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || Number(process.env.PORT) || 9661;
const CAPT = process.env.CAPTURES || '';

const maintenant = new Date(2026, 10, 11, 15, 30, 0);
const MS = maintenant.getTime();
const iso = (h) => new Date(MS - h * 3600e3).toISOString();
const A = '111', B = '222';
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'compte-alpha', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: B, login: 'compte-beta', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const TEXTE = 'Chaussures pas conformes à la description, semelle abîmée.';
const LIGNES_BASE = [
  { id: `harvest_${A}_feedbacks`, data: { type: 'feedbacks', uid: A, capturedAt: iso(1), payload: { user_feedbacks: [{ id: '7001', rating: 2, feedback: TEXTE }, { id: '7000', rating: 5, feedback: 'Parfait' }] } } },
  { id: `harvest_${A}_profile`, data: { type: 'profile', payload: { user: { id: 4242, login: 'compte-alpha' } } } },
  { id: `harvest_${B}_feedbacks`, data: { type: 'feedbacks', uid: B, capturedAt: iso(1), payload: { user_feedbacks: [{ id: '8000', rating: 5, feedback: 'Top' }] } } },
];
const SCENARIOS = {
  A: { memo: { comptes: {}, alertes: [{ uid: A, id: '7001', note: 2, at: iso(2), notifie: iso(2) }], rev: 4 }, vus: { vus: { '111:6000': iso(48) } } },
  B: { memo: { comptes: {}, alertes: [{ uid: B, id: '8001', note: 1, tx: '9876543210', at: iso(3), notifie: iso(3) }], rev: 2 }, vus: null },
  C: { panne: true },
  D: { memo: { comptes: {}, alertes: [{ uid: '999', id: '1', note: 1, at: iso(2) }, { uid: A, id: '7001', note: 2, at: iso(2) }], rev: 1 }, vus: { vus: { '111:7001': iso(1) } } },
};

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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};

const ouvrir = async (b, vp, sc, sombre) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: tel ? 2 : 1, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [], selData = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((d) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', d ? 'true' : 'false'); } catch (_) {} window.__aller = []; window.addEventListener('vrm:aller', (e) => window.__aller.push(e.detail)); }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  const LIGNES = LIGNES_BASE.slice();
  const vusEcrits = [];
  if (sc.memo) LIGNES.push({ id: 'vrm_avis_bas', data: sc.memo });
  if (sc.vus) LIGNES.push({ id: 'vrm_avis_bas_vus', data: sc.vus });
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      ecritures.push({ m: req.method(), u, corps: req.postData() || '' });
      if (/vrm_avis_bas_vus/.test(req.postData() || '')) {
        const rows = JSON.parse(req.postData());
        const r0 = rows[0]; vusEcrits.push(r0.data);
        const i = LIGNES.findIndex((x) => x.id === 'vrm_avis_bas_vus'); if (i >= 0) LIGNES.splice(i, 1);
        LIGNES.push({ id: 'vrm_avis_bas_vus', data: r0.data });
        return j([{ id: 'vrm_avis_bas_vus' }]);
      }
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    if (sc.panne && /vrm_avis_bas/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    if (/harvest_/.test(u) && /select=data(&|$)/.test(u)) selData.push(u);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const s = new Set(dans[1].split(',')); return j(LIGNES.filter((r) => s.has(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelector('[data-journee-avis-bas]'), null, { timeout: 6000 }).catch(() => {});
  await pg.waitForTimeout(900);
  return { ctx, pg, errs, ecritures, vusEcrits, selData };
};

const carte = (pg) => pg.evaluate(() => {
  const c = document.querySelector('[data-journee-avis-bas]');
  if (!c) return { carte: false, rendu: !!document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') };
  const n = c.querySelector('.vrm-day-task-note'), t = c.querySelector('.vrm-day-task-title');
  const box = c.getBoundingClientRect();
  const g = document.querySelector('[data-fu-gestes]');
  return { carte: true, rendu: true, cles: c.getAttribute('data-journee-avis-bas'), titre: t && t.textContent, note: n && n.textContent,
    couleurNote: n && getComputedStyle(n).color, couleurTitre: t && getComputedStyle(t).color,
    gestes: g ? g.getAttribute('data-fu-gestes') : (document.querySelector('[data-prochain]') ? 'prochain' : null),
    prochain: c.hasAttribute('data-prochain'), h: Math.round(box.height), visible: box.width > 2 && box.height > 2, deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
const feuille = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-avis-bas-feuille]');
  if (!s) return { feuille: false };
  const cibles = [...s.querySelectorAll('a, button')].map((x) => ({ t: x.textContent.trim(), h: Math.round(x.getBoundingClientRect().height) }));
  const v = s.querySelector('[data-avis-vinted]');
  return { feuille: true, texte: (s.querySelector('[data-avis-texte]') || {}).textContent || '', absent: !!s.querySelector('[data-avis-texte-absent]'),
    absentTxt: (s.querySelector('[data-avis-texte-absent]') || {}).textContent || '',
    vinted: v ? v.getAttribute('href') : null, cible: v ? v.getAttribute('target') : null, vente: !!s.querySelector('[data-avis-voir-vente]'),
    sansVente: !!s.querySelector('[data-avis-sans-vente]'), cibles, deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }]) for (const sombre of [false, true]) {
      const nom = `${vp.width < 600 ? '390' : '1512'}${sombre ? '-sombre' : ''}`;
      console.log(`\n── ${nom}`);
      await essaie(`A ${nom}`, async () => {
        const { ctx, pg, errs, ecritures, vusEcrits, selData } = await ouvrir(b, vp, SCENARIOS.A, sombre);
        if (CAPT) { await pg.waitForTimeout(3500); await pg.screenshot({ path: path.join(CAPT, `avis-A-${nom}.png`) }); }
        const r = await carte(pg);
        dit(r.carte, 'A un 2★ neuf : la carte est dans « À faire »', JSON.stringify(r));
        if (r.carte) {
          dit(r.cles === '111:7001', 'A la carte porte l’identité de l’avis (compte:avis)', r.cles);
          dit(r.titre === 'Avis 2★ reçu sur compte-alpha', 'A titre « Avis 2★ reçu sur compte-alpha »', r.titre);
          dit((r.note || '').startsWith('« Chaussures pas conformes'), 'A la ligne : le texte rangé de l’avis', r.note);
          const rgb = (s) => (/rgba?\(([^)]+)\)/.exec(s || '') || [])[1];
          dit(!!rgb(r.couleurNote) && rgb(r.couleurNote) !== rgb(r.couleurTitre) && !/255,\s*59,\s*48|255,\s*69,\s*58/.test(r.couleurNote), 'A la ligne en AMBRE (un geste), jamais le rouge', `${r.couleurNote} / ${r.couleurTitre}`);
          dit(r.gestes != null, 'A comptée parmi les gestes (ou posée en tête)', String(r.gestes));
          dit(r.visible && !r.deborde && r.h >= 44, 'A visible, ≥ 44 px, aucun débordement', JSON.stringify({ h: r.h, deborde: r.deborde }));
        }
        const avant = ecritures.length;
        await pg.click('[data-journee-avis-bas]').catch(() => {});
        await pg.waitForSelector('[data-avis-bas-feuille]', { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(500);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `avis-A-${nom}-feuille.png`) });
        const f = await feuille(pg);
        dit(f.feuille, 'A « Lire » ouvre la feuille');
        if (f.feuille) {
          dit(f.texte.includes(TEXTE), 'A la feuille montre le texte rangé', f.texte);
          dit(f.vinted === 'https://www.vinted.fr/member/4242?tab=feedback' && f.cible === '_blank', 'A « Répondre sur Vinted ↗ » : le profil des avis (id de profil), nouvel onglet', `${f.vinted} ${f.cible}`);
          dit(!f.vente && f.sansVente, 'A sans n° de transaction : pas de « Voir la vente », et la phrase dit pourquoi');
          dit(f.cibles.every((c) => c.h >= 44) && !f.deborde, 'A cibles ≥ 44 px, aucun débordement', JSON.stringify(f.cibles));
        }
        const pendant = ecritures.slice(avant).filter((e) => /vrm_avis/.test(e.corps));
        dit(pendant.length === 0, 'A ouvrir la feuille n’écrit rien', JSON.stringify(pendant));
        await pg.click('[data-avis-vu="111:7001"]').catch(() => {});
        await pg.waitForTimeout(900);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `avis-A-${nom}-vu.png`) });
        const w = vusEcrits[vusEcrits.length - 1];
        dit(w && w.vus && w.vus['111:7001'] && w.vus['111:6000'], 'A « C’est vu » écrit la clé de l’avis et garde les autres', JSON.stringify(w));
        const apres = await carte(pg);
        dit(!apres.carte && !(await pg.$('[data-avis-bas-feuille]')), 'A … la carte et la feuille s’en vont', JSON.stringify(apres));
        dit(selData.length === 0, 'A aucune lecture `select=data` d’une moisson', selData.slice(0, 2).join(' | '));
        dit(errs.length === 0, 'A aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`B ${nom}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.B, sombre);
        const r = await carte(pg);
        dit(r.carte && r.titre === 'Avis 1★ reçu sur compte-beta' && r.note === 'Lis l’avis sur Vinted.', 'B texte pas rangé : « Lis l’avis sur Vinted. »', JSON.stringify(r));
        await pg.click('[data-journee-avis-bas]').catch(() => {});
        await pg.waitForSelector('[data-avis-bas-feuille]', { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(400);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `avis-B-${nom}-feuille.png`) });
        const f = await feuille(pg);
        dit(f.feuille && f.absent && f.vente && !f.sansVente, 'B avis qui porte son n° de transaction : « Voir la vente et écrire »', JSON.stringify(f));
        await pg.click('[data-avis-voir-vente]').catch(() => {});
        await pg.waitForTimeout(1500);
        const ou = await pg.evaluate(() => ({ aller: window.__aller.slice(), journee: !!document.querySelector('[data-journee-avis-bas]'), h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).filter(Boolean).join(' | ') }));
        dit(ou.aller.length === 1 && ou.aller[0] === '?tab=ventes&site=vinted&cible=vente&tx=9876543210', 'B … qui demande Ventes, cible = CETTE transaction (et rien d’autre)', JSON.stringify(ou.aller));
        dit(!ou.journee && /Ventes/.test(ou.h1), 'B … et l’écran Ventes s’ouvre', ou.h1);
        dit(errs.length === 0, 'B aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      if (!sombre) {
        await essaie(`C ${nom}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.C, sombre);
          const r = await carte(pg);
          dit(r.rendu && !r.carte, 'C mémoire illisible (522) : aucune carte', JSON.stringify(r));
          dit(errs.length === 0, 'C aucune erreur JS', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
        await essaie(`D ${nom}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.D, sombre);
          const r = await carte(pg);
          dit(r.rendu && !r.carte, 'D alerte d’un compte retiré, ou déjà vue : aucune carte', JSON.stringify(r));
          dit(errs.length === 0, 'D aucune erreur JS', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
      }
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
