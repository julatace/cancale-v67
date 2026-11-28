// Banc « Compta finitions » (28 novembre) — Julien : « fais tout le reste parfaitement ».
//
// Les points « À décider » des bancs compta (docs/passation/2026-11-27-bancs-compta.md), jugés sur l'écran que
// Julien VOIT (le design natif, `BANC_DESIGN_V2=defaut` : pas le DOM d'avant le 17 nov. que gardent les autres bancs
// compta), à 390 px tactile et 1512 px, en clair ET en sombre, sur des données INVENTÉES (dépôt public) :
//   D  « avant tes dépenses » (règle du 22 oct.) : aucune dépense jamais notée ⇒ la rangée Bénéfice d'Argent le dit, et
//      Aujourd'hui aussi (Net du mois) ; « Dépenses du mois » le dit en UNE phrase (jamais « 0 € de charges ») avec UN
//      bouton « Je n'ai pas de dépenses » (≥ 44 px au doigt). Son toucher ÉCRIT la réponse (`vrm_compta.sansDepenses`) ;
//      ensuite plus rien n'est redemandé, même après un rechargement (§2.10 : pas de carte de reproche récurrente).
//   U  Argent → Mois : chaque montant visible s'écrit UNE fois (la barre du mois en cours ne redit pas l'affiche) ;
//      les lignes d'une liste (versements, à venir) détaillent, elles ne redisent pas.
//   J  Argent → Déclarer : UN seul « J'ai déclaré » (ni « Noter ma déclaration » en double) ; le montant à recopier
//      et les cotisations de la période ouverte, une fois chacun.
//   R  « Rapport comptable » atteignable : une rangée dans Déclarer → Récap ; son toucher ouvre le rapport (Ventes) sur
//      le mois choisi, SANS le formulaire de déclaration.
//   O  Aucun orange / ambre RENDU (décision du 23 nov.) sur Argent (Mois, Déclarer), Aujourd'hui et Ventes : la couleur
//      CALCULÉE de chaque élément visible (texte, fond, bord), pas son orthographe.
//   E  L'aide d'« Exporter mes données » : 8 mots au plus, dans les cinq langues.
// Les captures (SHOTS=dossier) se regardent : elles font partie du test (§6.2).
//   node scripts/bancs/compta-finitions.cjs   (BANC_PORT, SHOTS, BANC_MODES=390c,390s,1512c,1512s)
'use strict';
process.env.BANC_DESIGN_V2 = 'defaut';   // l'écran que voit Julien (scripts/bancs/_garde-reseau.cjs)
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const { corpsEcrit } = require('./_ecriture-representee.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const RACINE = path.join(__dirname, '..', '..');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9341;
const MAINTENANT = '2026-10-27T10:00:00+01:00';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: '2026-10-27T08:00:00Z' }];
// [tx, titre, prix, vendue le, versée le (null = en cours)]
const VENTES = [
  [9301, 'Nike Air Max inventée taille 42', 100, '2026-09-10T12:00:00+02:00', '2026-09-15T08:00:00+02:00'],
  [9302, 'Salomon XT-6 inventée taille 40', 80, '2026-09-12T12:00:00+02:00', '2026-09-20T08:00:00+02:00'],
  [9303, 'Adidas Samba inventée taille 41', 120, '2026-09-25T12:00:00+02:00', '2026-09-29T08:00:00+02:00'],
  [9304, 'Asics Gel inventée taille 43', 60, '2026-10-05T12:00:00+02:00', '2026-10-10T08:00:00+02:00'],
  [9305, 'New Balance 550 inventée taille 44', 75, '2026-10-24T12:00:00+02:00', null],
];
const LIGNE = { at: Date.parse('2026-10-27T07:00:00Z'), mois: [{ ym: '2026-10', ca: 60, n: 1, par: { Vinted: { n: 1, ca: 60 } } }, { ym: '2026-09', ca: 300, n: 3, par: { Vinted: { n: 3, ca: 300 } } }], aDater: { n: 0, ca: 0, par: {} }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' } };
const ROWS = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: '2026-10-27T07:30:00Z', payload: { my_orders: VENTES.map(([tx, t, p, d, v]) => ({ transaction_id: tx, title: t, price: { amount: String(p), currency_code: 'EUR' }, status: v ? 'Commande finalisée' : 'Le paiement a été validé', date: d })) } } },
  ...VENTES.filter((x) => x[4]).map(([tx, , , , v]) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: '2026-10-27T07:30:00Z', payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: v } } } })),
  { id: 'ebay_orders', data: { orders: [] } }, { id: 'lbc_ventes', data: { ventes: {} } },
];
// Aucune dépense JAMAIS notée, pas de réponse ; septembre fini et PAS encore noté déclaré (la déclaration est ouverte).
const main = (sombre) => ({
  vinted_dark: sombre, vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: LIGNE,
  vinted_sale_overrides: { 9301: { buyPrice: '40' }, 9302: { buyPrice: '30' }, 9303: { buyPrice: '50' }, 9304: { buyPrice: '30' } },
  vrm_compta: { depenses: [], abonnements: [], fixes: [], packs: [] },
  vrm_urssaf_declare: {},
  vrm_micro_options: { liberatoire: 'non', acre: false, at: Date.parse('2026-10-20T09:00:00Z') },
});

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.on('error', (e) => { console.log(e.code === 'EADDRINUSE' ? `KO le port ${PORT} est pris — relance-le seul (BANC_PORT=…)` : `KO serveur : ${e.message}`); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => { if (!sel || sel === '*') return row; const out = {}; for (const part of sel.split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; const src = m[2], alias = m[1] || src.split(/->>|->/).pop(); if (src === 'id') { out[alias] = row.id; continue; } if (src === 'data') { out[alias] = row.data; continue; } let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg]; if (/->>/.test(src) && v != null && typeof v !== 'object') v = String(v); out[alias] = v == null ? null : v; } return out; };

let ko = 0, ok = 0;
const check = (cond, msg, detail) => { if (cond) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (detail !== undefined ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400) : '')); } };
const essaie = async (msg, fn) => { try { await fn(); } catch (e) { ko++; console.log(`❌ ${msg} — ${String(e.message || e).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`); } };

async function page(b, vp, sombre, errs) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push('page : ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_/i.test(m.text())) errs.push('console : ' + m.text()); });
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  const etat = { m: main(sombre), ecritures: [] };
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      // L'écriture de `main` (POST d'une ligne entière ou PATCH conditionnel) : la base du banc la GARDE (un rechargement la relit).
      try {
        const corps = JSON.parse(req.postData() || 'null');
        for (const x of [].concat(corps || [])) {
          if (x && x.data && typeof x.data === 'object' && (x.id === 'main' || /id=eq\.main(&|$)/.test(u))) { etat.m = x.data; etat.ecritures.push(x.data); }
        }
      } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: corpsEcrit(req) });
    }
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: '2026-10-27T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([forme({ id: 'main', data: etat.m })]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, tel, etat };
}
const ouvrir = (pg, tab) => pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
const visible = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].some((e) => e.checkVisibility && e.checkVisibility()), sel);
async function captures(pg, vp, nom) {
  if (!process.env.SHOTS) return;
  await pg.evaluate(() => { for (const e of [document.scrollingElement, ...document.querySelectorAll('main, .vrm-main')]) if (e) e.scrollTop = 0; });
  for (let i = 0; i < 7; i++) {
    await pg.screenshot({ path: path.join(process.env.SHOTS, `compta-finitions-${nom}-${i}.png`) }).catch(() => {});
    const fin = await pg.evaluate((h) => { const els = [document.scrollingElement, ...document.querySelectorAll('main, .vrm-main')].filter((e) => e && e.scrollHeight > e.clientHeight + 4); const e = els.find((x) => getComputedStyle(x).overflowY !== 'visible' || x === document.scrollingElement); if (!e) return true; const a = e.scrollTop; e.scrollTop += h * 0.85; return e.scrollTop === a; }, vp.height);
    if (fin) break;
  }
  await pg.evaluate(() => { for (const e of [document.scrollingElement, ...document.querySelectorAll('main, .vrm-main')]) if (e) e.scrollTop = 0; });
}
async function segment(pg, seg) {
  const sel = `[data-v2-argent-nav] [data-section="${seg}"]`;
  await pg.waitForSelector(sel, { timeout: 40000 });
  await pg.click(sel, { timeout: 20000 });
  await pg.waitForFunction((seg) => { const p = document.querySelector(`[data-argent-vue="${seg}"]`); return !!p && !p.hidden; }, seg, { timeout: 20000 });
  await pg.waitForTimeout(800);
}
// O — aucun orange RENDU : la couleur CALCULÉE (texte, fond, bords) de chaque élément visible de l'écran.
async function orangesRendus(pg) {
  return pg.evaluate(() => {
    const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return { h, s, l }; };
    const orange = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m) return false; if (m[4] !== undefined && Number(m[4]) < 0.05) return false; const { h, s, l } = hsl(+m[1], +m[2], +m[3]); return h >= 18 && h <= 50 && s >= 0.55 && l >= 0.2 && l <= 0.97; };
    const out = [];
    for (const e of document.querySelectorAll('.vrm-main *, .vrm-app-shell *')) {
      if (!e.checkVisibility || !e.checkVisibility()) continue;
      if (e.closest('[data-marque], svg[data-logo], .n-logo-site, [data-logo-site]')) continue;   // un logo de marque garde ses couleurs
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(e);
      const props = [['color', (e.innerText || '').trim() ? cs.color : ''], ['background', cs.backgroundColor], ['fond-image', /gradient/.test(cs.backgroundImage) ? cs.backgroundImage : ''],
        ['bord', cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none' ? cs.borderTopColor : ''], ['bord-g', cs.borderLeftWidth !== '0px' && cs.borderLeftStyle !== 'none' ? cs.borderLeftColor : ''],
        ['fill', e instanceof SVGElement ? cs.fill : ''], ['stroke', e instanceof SVGElement && cs.stroke !== 'none' ? cs.stroke : '']];
      for (const [k, v] of props) {
        const couleurs = (v || '').match(/rgba?\([^)]*\)/g) || [];
        if (couleurs.some(orange)) { out.push(`${(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.tagName).toString().slice(0, 40)} ${k}=${couleurs.find(orange)} « ${(e.innerText || '').trim().slice(0, 24)} »`); break; }
      }
      if (out.length > 12) break;
    }
    return out;
  });
}
const MONTANT = /-?\d{1,3}(?:[\u202f\u00a0 ]\d{3})*(?:,\d{2})?[\u202f\u00a0 ]?€/g;
// Le texte VISIBLE d'un segment, les lignes de liste retirées (elles détaillent un total) et le texte « lecteur d'écran » seul.
const texteSegment = (pg, seg, retirer) => pg.evaluate(([seg, retirer]) => {
  const e = document.querySelector(`[data-argent-vue="${seg}"]`); if (!e) return '';
  const c = e.cloneNode(true); c.querySelectorAll(retirer + ', .n-lu-seul').forEach((x) => x.remove());
  c.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + e.clientWidth + 'px'; document.body.appendChild(c); const t = c.innerText; c.remove(); return t;
}, [seg, retirer]);
const montantsRedits = (t) => { const m = (t.match(MONTANT) || []).map((x) => x.replace(/[\u202f\u00a0 ]/g, ' ').replace(/\s?€/, ' €')); return { n: m.length, redits: [...new Set(m.filter((x, i) => m.indexOf(x) !== i))] }; };

async function mode(b, vp, sombre) {
  const nom = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
  const errs = [];
  const { ctx, pg, tel, etat } = await page(b, vp, sombre, errs);
  try {
    // Ventes publie le bénéfice (`vrm_benefice_jours`) : on attend l'ÉTAT, pas un délai.
    await ouvrir(pg, 'cat_ventes');
    await pg.waitForFunction(() => !!localStorage.getItem('vrm_benefice_jours'), null, { timeout: 90000 });
    await pg.waitForTimeout(1500);
    await essaie(`${nom} O Ventes`, async () => { const o = await orangesRendus(pg); check(o.length === 0, `${nom} — O Ventes : aucun orange rendu`, o); });
    await captures(pg, vp, `ventes-${nom}`);

    // ── Aujourd'hui : Net du mois « avant tes dépenses » (aucune dépense jamais notée).
    await ouvrir(pg, 'journee');
    await essaie(`${nom} D Aujourd'hui`, async () => {
      await pg.waitForSelector('[data-v2-bloc="chiffres"][data-v2-chiffres="lu"]', { timeout: 40000 });
      await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-v2-bloc="chiffres"] button, [data-v2-bloc="chiffres"] [role="radio"], [data-v2-bloc="chiffres"] [role="tab"]')].find((x) => /^\s*Mois\s*$/.test(x.textContent)); if (b) b.click(); });
      await pg.waitForFunction(() => { const e = document.querySelector('[data-v2-bloc="chiffres"]'); return e && e.getAttribute('data-v2-periode') === 'mois'; }, null, { timeout: 10000 }).catch(() => {});
      const t = await pg.evaluate(() => { const e = document.querySelector('[data-v2-stat="net"]'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
      check(/avant tes dépenses/.test(t), `${nom} — D Aujourd'hui, Net du mois : « avant tes dépenses » (aucune dépense jamais notée)`, t);
      const o = await orangesRendus(pg); check(o.length === 0, `${nom} — O Aujourd'hui : aucun orange rendu`, o);
    });
    await captures(pg, vp, `aujourdhui-${nom}`);

    // ── Argent → Mois.
    await ouvrir(pg, 'compta');
    await pg.waitForSelector('[data-v2-argent-mois]', { timeout: 40000 });
    await pg.waitForSelector('[data-dep-mois="lu"]', { timeout: 40000 });
    await pg.waitForSelector('[data-v2-argent-fait="benefice"]:not([data-v2-pas-su])', { timeout: 40000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    await captures(pg, vp, `argent-mois-${nom}`);
    await essaie(`${nom} D Argent`, async () => {
      const r = await pg.evaluate(() => { const e = document.querySelector('[data-v2-argent-fait="benefice"]'); return e ? { av: e.hasAttribute('data-v2-avant-depenses'), t: e.innerText.replace(/\s+/g, ' ') } : null; });
      check(!!r && r.av && /avant tes dépenses/.test(r.t), `${nom} — D Argent → Mois : la rangée Bénéfice dit « avant tes dépenses »`, r);
      const d = await pg.evaluate(() => { const c = document.querySelector('[data-dep-mois="lu"]'); const b = c && c.querySelector('[data-depenses-aucune]'); const r = b && b.getBoundingClientRect(); return c ? { jamais: c.hasAttribute('data-dep-jamais'), charges: c.getAttribute('data-dep-charges'), t: c.innerText.replace(/\s+/g, ' '), bouton: !!(b && b.checkVisibility()), h: r ? Math.round(r.height) : 0, n: c.querySelectorAll('[data-depenses-aucune]').length } : null; });
      check(!!d && d.jamais && /avant tes dépenses/.test(d.t) && !/\b0[\u202f\u00a0 ]?€/.test(d.t) && d.charges === '', `${nom} — D Dépenses du mois : une phrase « avant tes dépenses », jamais « 0 € de charges »`, d);
      check(!!d && d.bouton && d.n === 1 && (!tel || d.h >= 44), `${nom} — D le choix « Je n'ai pas de dépenses » est là, une fois, ${tel ? '≥ 44 px au doigt' : 'visible'}`, d);
    });
    await essaie(`${nom} U Argent → Mois`, async () => {
      const t = await texteSegment(pg, 'resume', '[data-v2-argent-versements] .n-rangee, [data-v2-argent-versements] tr, [data-v2-argent-versements] [role="row"], [data-a-venir-ligne], [data-av-vente], .vg-av-groupe-eur');
      const { n, redits } = montantsRedits(t);
      check(n >= 4 && redits.length === 0, `${nom} — U Argent → Mois : chaque montant visible écrit une fois (${n} montants${redits.length ? ', redits : ' + redits.join(' · ') : ''})`);
      // L'affiche « Reçu en octobre » écrit son chiffre en morceaux (« 60 » puis « € ») : la barre du mois en cours est jugée
      // à part — son texte VISIBLE (hors lecteur d'écran) ne porte aucun montant quand l'affiche en porte un.
      const b = await pg.evaluate(() => { const li = document.querySelector('.n-arg-m6[data-courant] .n-arg-m6-v'); if (!li) return null; const c = li.cloneNode(true); c.querySelectorAll('.n-lu-seul').forEach((x) => x.remove()); const aff = document.querySelector('[data-v2-argent-recu]'); return { t: c.textContent.trim(), affiche: aff ? aff.getAttribute('data-v2-argent-recu') : '' }; });
      check(!!b && !!b.affiche && !/€/.test(b.t), `${nom} — U la barre du mois en cours ne redit pas l'affiche (« ${b && b.t} »)`, b);
      const o = await orangesRendus(pg); check(o.length === 0, `${nom} — O Argent → Mois : aucun orange rendu`, o);
    });

    // ── Argent → Déclarer : un seul « J'ai déclaré » ; montant et cotisations de la période ouverte, une fois.
    await essaie(`${nom} J Déclarer`, async () => {
      await segment(pg, 'declarer');
      await pg.waitForSelector('[data-urssaf-parcours]', { timeout: 30000 });
      await pg.waitForTimeout(800);
      await captures(pg, vp, `argent-declarer-${nom}`);
      const boutons = await pg.evaluate(() => [...document.querySelectorAll('[data-argent-vue="declarer"] :is(button, a, [role="button"])')].filter((e) => e.checkVisibility() && /J.ai déclaré|Noter ma déclaration|C.est déclaré/i.test(e.innerText)).map((e) => e.innerText.trim()));
      check(boutons.length === 1, `${nom} — J Déclarer : UN seul « J'ai déclaré » (${boutons.length} : ${JSON.stringify(boutons)})`);
      const t = await texteSegment(pg, 'declarer', '[data-revision-ligne], [data-v2-revision] .n-rangee, [data-revision] li');
      const norm = t.replace(/[\u202f\u00a0]/g, ' ');
      const compte = (x) => (norm.match(new RegExp('(?<![\\d,])(?<!\\d )' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      check(compte('300 €') === 1 && compte('37,20 €') === 1, `${nom} — J la période ouverte : « 300 € » et « 37,20 € » écrits une fois chacun (${compte('300 €')} · ${compte('37,20 €')})`);
      const o = await orangesRendus(pg); check(o.length === 0, `${nom} — O Argent → Déclarer : aucun orange rendu`, o);
    });
    // ── R : « Rapport comptable », depuis Déclarer → Récap du mois.
    await essaie(`${nom} R rapport`, async () => {
      const sel = '[data-argent-vue="declarer"] [data-recap-rapport]';
      await pg.waitForSelector(sel, { timeout: 20000 });
      const r = await pg.evaluate((sel) => { const e = document.querySelector(sel); const b = e.getBoundingClientRect(); return { vis: e.checkVisibility(), h: Math.round(b.height), ym: e.getAttribute('data-recap-rapport'), t: e.innerText.trim() }; }, sel);
      check(r.vis && /Rapport comptable/.test(r.t) && (!tel || r.h >= 44), `${nom} — R « Rapport comptable » est une rangée atteignable dans Déclarer (${r.h} px)`, r);
      // Le mois de septembre (FINI, PAS noté) : là où « J'ai déclaré » ouvrirait le formulaire — le rapport seul ne doit pas.
      await pg.selectOption('[data-argent-vue="declarer"] [data-recap-mois-choix]', '2026-09');
      await pg.waitForFunction((sel) => { const e = document.querySelector(sel); return e && e.getAttribute('data-recap-rapport') === '2026-09'; }, sel, { timeout: 10000 });
      await pg.locator(sel).scrollIntoViewIfNeeded();
      await pg.click(sel);
      await pg.waitForSelector('[data-rapport-vinted]', { timeout: 40000 });
      await pg.waitForTimeout(2500);
      const s = await pg.evaluate(() => { const e = document.querySelector('[data-rapport-vinted]'); let f = e; while (f && f.parentElement && !/fixed/.test(getComputedStyle(f).position)) f = f.parentElement; const t = f ? f.innerText : ''; return { form: !!document.querySelector('[data-decl-form]'), mois: /septembre 2026/i.test(t), t: t.replace(/\s+/g, ' ').slice(0, 160) }; });
      check(s.mois && !s.form, `${nom} — R son toucher ouvre le rapport comptable sur le mois choisi (septembre 2026, fini, pas noté), SANS le formulaire de déclaration`, s);
      await captures(pg, vp, `rapport-${nom}`);
    });

    // ── D (suite) : « Je n'ai pas de dépenses » ÉCRIT la réponse, et plus rien n'est redemandé, même rechargé.
    await essaie(`${nom} D réponse`, async () => {
      await ouvrir(pg, 'compta');
      await pg.waitForSelector('[data-dep-mois="lu"] [data-depenses-aucune]', { timeout: 40000 });
      await pg.locator('[data-dep-mois="lu"] [data-depenses-aucune]').scrollIntoViewIfNeeded();
      await pg.click('[data-dep-mois="lu"] [data-depenses-aucune]');
      await pg.waitForFunction(() => !document.querySelector('[data-depenses-aucune]'), null, { timeout: 10000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      const ecrit = etat.ecritures.some((d) => d && d.vrm_compta && d.vrm_compta.sansDepenses && d.vrm_compta.sansDepenses.at);
      const apres = await pg.evaluate(() => ({ choix: !!document.querySelector('[data-depenses-aucune]'), av: !!document.querySelector('[data-v2-avant-depenses]') }));
      check(ecrit && !apres.choix && !apres.av, `${nom} — D son toucher ÉCRIT « pas de dépenses » (vrm_compta.sansDepenses) ; le choix et « avant tes dépenses » partent`, { ecrit, ...apres });
      await ouvrir(pg, 'compta');
      await pg.waitForSelector('[data-dep-mois="lu"]', { timeout: 40000 });
      await pg.waitForTimeout(2000);
      const re = await pg.evaluate(() => ({ choix: !!document.querySelector('[data-depenses-aucune]'), av: !!document.querySelector('[data-v2-avant-depenses]') }));
      check(!re.choix && !re.av, `${nom} — D rechargé : rien n'est redemandé (§2.10)`, re);
    });
    check(!errs.length, `${nom} — aucune erreur de page`, errs[0]);
  } finally { await ctx.close(); }
}

// E — l'aide d'« Exporter mes données » (Paramètres) : 8 mots au plus, dans chaque langue (la règle du 23 nov.).
function aideExport() {
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const s = fs.readFileSync(path.join(RACINE, 'src', 'i18n', 'langues', l + '.js'), 'utf8');
    const m = /"reglages\.donnees\.desc":\s*"([^"]*)"/.exec(s);
    const mots = m ? m[1].split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length : 99;
    check(!!m && mots <= 8, `E « Exporter mes données » (${l}) : l'aide fait ${mots} mots (8 au plus)`, m && m[1]);
  }
}

(async () => {
  aideExport();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const MODES = { '390c': [{ width: 390, height: 844 }, false], '390s': [{ width: 390, height: 844 }, true], '1512c': [{ width: 1512, height: 950 }, false], '1512s': [{ width: 1512, height: 950 }, true] };
  const voulus = (process.env.BANC_MODES || '390c,390s,1512c,1512s').split(',').filter((k) => MODES[k]);
  try { for (const k of voulus) await mode(b, ...MODES[k]); } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
