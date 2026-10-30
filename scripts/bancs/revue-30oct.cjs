require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
const FX = f => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
const FXok = f => { try { return FX(f); } catch (_) { return []; } };
const main = FX('main');
const accounts = FX('accounts').map(a => { const { owner, ...r } = a; return r; });
const rows = [...FX('sold'), ...FX('purch'), ...dressingsDuJour(FX('listings')), ...FXok('inbox'), ...FXok('track'), ...FX('bord'), ...FX('label'), ...FXok('billing')];
const txn = FX('txn');
const extra = []; for (const f of fs.readdirSync(path.join(SC,'fx'))) { if (/^(main|accounts|sold|purch|listings|inbox|track|bord|label|billing|txn)\.json$/.test(f) || !f.endsWith('.json')) continue; try { const a = JSON.parse(fs.readFileSync(path.join(SC,'fx',f),'utf8')); if (Array.isArray(a) && a.length && a[0] && a[0].id && a[0].data) extra.push(...a); } catch(_){} }
if (process.env.EXTRA !== '0') rows.push(...extra);
function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]); out[alias] = v == null ? null : v; continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx':'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
const PORT = Number(process.env.BANC_PORT) || 9433; srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris — relance le banc seul'); process.exit(1); }); srv.listen(PORT);

// ── BANC : la relecture de l'intégration du 30 octobre (§7, une phrase une fois) ──
// Sur les fixtures (`fx/`, gitignorées) : Comptabilité (reçu « au moins », compteur
// des déclarations, titre une fois), Statistiques (« Choisir une période », plus de
// « Total Vinted »), Annonces (la case Leboncoin dit son état), Achats (la fraîcheur
// une fois, le compte d'un groupe uniforme une fois). Il juge des ATTRIBUTS et des
// comptes d'occurrences, jamais une formulation seule.
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const [W, H, tactile] of [[390, 844, true], [1512, 950, false]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: tactile, hasTouch: tactile });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r3) => { const t3 = r3.request().resourceType(); if (t3 === 'image' || t3 === 'media' || t3 === 'font') return r3.abort(); return r3.continue(); });
    await pg.route('**://*.vinted.net/**', r4 => r4.abort());
    await pg.route('**/rest/v1/**', async route => {
      const u = metaVersData(route.request().url());
      const j = d => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
      if (route.request().method() !== 'GET') return j([]);
      if (/select=owner(&|$)/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
      if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
      if (/\/rest\/v1\/rpc\//.test(u)) return j([]);
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1]; const S = sel ? decodeURIComponent(sel) : null;
      if (/id=eq\.main/.test(u)) return j(main.map(r => projette(r, S)));
      if (/transaction->>id/.test(u)) return j(txn);
      const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j([...rows, ...txn].filter(r => r.id === k).map(r => projette(r, S))); }
      const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[*%]/g, '.*') + '$'); return j([...rows, ...(/_txn_/.test(m[1]) ? txn : [])].filter(r => re.test(r.id)).map(r => projette(r, S))); }
      return j([]);
    });
    await pg.route('**/api/**', r2 => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
    const aller = async (tab, sec) => {
      await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      if (sec) { await pg.locator('.vrm-seg-btn', { hasText: sec }).first().click({ timeout: 6000 }).catch(() => {}); await pg.waitForTimeout(2500); }
    };
    const nom = `${W}`;
    // ── Comptabilité
    await aller('compta');
    const c = await pg.evaluate(() => {
      const txt = document.body.innerText;
      const sansDate = /ventes? finalisées? sans date de versement/.test(txt);
      const recus = [...document.querySelectorAll('[data-ca-cur="recu"], td[data-ca-cellule="recu"]')];
      const serie = document.querySelector('[data-suivi-serie]'), ret = document.querySelector('[data-suivi-retard]'), ad = document.querySelector('[data-suivi-a-declarer]');
      return { sansDate, nRecu: recus.length, nMin: recus.filter((x) => x.getAttribute('data-ca-min') === '1').length,
        serie: serie ? Number(serie.getAttribute('data-suivi-serie')) : null, retard: ret ? Number(ret.getAttribute('data-suivi-retard')) : null, aDeclarer: ad ? Number(ad.getAttribute('data-suivi-a-declarer')) : 0,
        titres: txt.split('\n').filter((l) => l.trim() === 'Comptabilité').length,
        depense: (txt.match(/Ajouter une dépense/g) || []).length };
    });
    dit(c.sansDate && c.nRecu > 1 && c.nMin === c.nRecu, `${nom} Compta : des ventes sans date de versement ⇒ chaque « reçu » dit « au moins » (jamais un 0,00 € présenté comme vrai)`, JSON.stringify(c));
    dit(c.serie == null || c.retard == null || c.serie === c.retard + c.aDeclarer, `${nom} Compta : « N périodes passées » et « Noter mes M mois » s'accordent (M = en retard + à déclarer)`, JSON.stringify(c));
    dit(c.titres <= 1, `${nom} Compta : « Comptabilité » écrit une fois en tête`, `${c.titres} fois`);
    dit(c.depense <= 1, `${nom} Compta : « Ajouter une dépense » proposé une fois`, `${c.depense} fois`);
    // ── Statistiques
    await aller('dashboard');
    const s = await pg.evaluate(() => {
      const txt = document.body.innerText;
      const lib = [...document.querySelectorAll('[data-periode-libelle]')].map((x) => x.textContent.trim());
      return { lib, choisis: /Choisis une période dans le calendrier/.test(txt), total: /Total Vinted/.test(txt) };
    });
    dit(s.lib.includes('Choisir une période') && !s.lib.includes('Toute la période') && !s.choisis, `${nom} Stats : rien de choisi ⇒ le bouton dit « Choisir une période » (plus « Toute la période » au-dessus de « choisis une période »)`, JSON.stringify(s));
    dit(!s.total, `${nom} Stats : plus de « Total Vinted » (c'est « Finalisé sur Vinted » en tête)`);
    // ── Annonces
    await aller('plat_vinted', 'Annonces');
    const a = await pg.evaluate(() => [...document.querySelectorAll('[data-fiche-place="lbc"]')].map((x) => ({ e: x.getAttribute('data-fiche-place-etat'), t: x.innerText.trim() })));
    dit(a.length > 0 && a.every((x) => (x.e === 'on' ? /^Dans la file Leboncoin/.test(x.t) : /^Ajouter à la file Leboncoin/.test(x.t))), `${nom} Annonces : la case Leboncoin dit son ÉTAT (« Dans la file » / « Ajouter à la file »)`, JSON.stringify(a.slice(0, 3)));
    // ── Achats → À retirer
    await aller('plat_vinted', 'Achats');
    const h = await pg.evaluate(() => {
      const txt = document.body.innerText;
      const tete = document.querySelector('[data-fraicheur-comptes]');
      return { tete: !!tete, achats: !!document.querySelector('[data-fraicheur-achats]'), commun: (document.querySelector('[data-a-verifier-commun]') || {}).getAttribute ? document.querySelector('[data-a-verifier-commun]').getAttribute('data-a-verifier-commun') : null,
        lignes: [...document.querySelectorAll('[data-a-verifier] [data-a-verifier-vinted], [data-a-verifier] [data-oublie]')].map((x) => x.innerText.split('\n').slice(0, 2).join(' / ')), n: Number((document.querySelector('[data-a-verifier]') || { getAttribute: () => 0 }).getAttribute('data-a-verifier')) };
    });
    dit(h.tete && !h.achats, `${nom} Achats : les comptes pas relus sont dits UNE fois (la tête de Vinted), pas une seconde fois au-dessus des achats`, JSON.stringify({ tete: h.tete, achats: h.achats }));
    const comptes = new Set(h.lignes.map((l) => (/(\b[a-z0-9_.-]{4,})\s·/.exec(l) || [])[1]).filter(Boolean));
    dit(h.n >= 2 && h.commun && !h.lignes.some((l) => l.includes(h.commun + ' ·')), `${nom} Achats : groupe « à vérifier » sur un seul compte ⇒ le compte nommé une fois en tête, pas sur chaque ligne`, JSON.stringify(h));
    dit(!errs.length, `${nom} aucune erreur de page`, errs[0]);
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ tout est vert (${ok})`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('mort ' + e.stack); process.exit(1); });
