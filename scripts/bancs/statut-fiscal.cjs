// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE STATUT FISCAL S'ADAPTE À LA PERSONNE (27 octobre)
//        (BANC_PORT=6351 node scripts/bancs/statut-fiscal.cjs — après `npm run build`)
// Julien : « des gens sont en société, d'autres ne sont pas revendeurs : ils
// n'ont pas besoin du taux URSSAF ; ça doit s'adapter à la personne ». On juge :
//   · statut jamais choisi ⇒ Comptabilité POSE la question, aucune carte URSSAF,
//     aucun rappel URSSAF dans Ma journée, aucune cotisation déduite ;
//   · particulier / société ⇒ aucune carte URSSAF, aucun rappel, aucune cotisation ;
//   · micro-entrepreneur ⇒ la carte URSSAF, le rappel, et le taux officiel
//     composé par ses options (12,4 % ; versement libératoire 13,4 %).
// (En-tête et banc commun recopiés de declare-urssaf.cjs.)
// ═══════════════════════════════════════════════════════════════════════════
// Trois propositions du 22 octobre, mesurées sur sa base :
//   (5) il n'a JAMAIS noté un mois « déclaré » : le geste n'existait que dans
//       Ventes → Outils → Rapport comptable, alors que le rappel et Ma journée
//       envoient sur Comptabilité. « C'est déclaré » (Comptabilité ET Ma
//       journée) ouvre LE formulaire du rapport sur le bon mois — mêmes gardes ;
//   (9) son « bénéfice net » retirait 0 € de dépenses jamais notées et se
//       présentait comme complet : « net avant tes dépenses », et le choix une
//       seule fois (aucune dépense à noter / ajouter une dépense) ;
//  (10) le rapport promettait « l'extension récupère ton relevé à ta prochaine
//       visite » — faux chez lui (0 relevé, `history` vide) : plus de promesse.
// Ce banc rend l'app sur des données INVENTÉES (il vit dans le dépôt, public),
// horloge fixée au 27 octobre 2026, aux deux tailles (390 px tactile, 1512 px).
// On juge les ATTRIBUTS, les nombres et ce qui est écrit dans la base — jamais
// une formulation seule.
require('./_porte-banc.cjs');                       // la session de banc (l'accès direct n'existe plus)
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6351;
const MAINTENANT = '2026-10-27T10:00:00+01:00';

const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: '2026-10-27T08:00:00Z' }];
// Trois ventes versées en septembre (300 €), une en octobre (60 €).
const VENTES = [
  [9301, 'Nike Air Max inventée taille 42', 100, '2026-09-10T12:00:00+02:00', '2026-09-15T08:00:00+02:00'],
  [9302, 'Salomon XT-6 inventée taille 40', 80, '2026-09-12T12:00:00+02:00', '2026-09-20T08:00:00+02:00'],
  [9303, 'Adidas Samba inventée taille 41', 120, '2026-09-25T12:00:00+02:00', '2026-09-29T08:00:00+02:00'],
  [9304, 'Asics Gel inventée taille 43', 60, '2026-10-05T12:00:00+02:00', '2026-10-10T08:00:00+02:00'],
];
const LIGNE = { at: Date.parse('2026-10-27T07:00:00Z'), mois: [{ ym: '2026-10', ca: 60, n: 1, par: { Vinted: { n: 1, ca: 60 } } }, { ym: '2026-09', ca: 300, n: 3, par: { Vinted: { n: 3, ca: 300 } } }], aDater: { n: 0, ca: 0, par: {} }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'nonRelie' } };
const ROWS = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: '2026-10-27T07:30:00Z', payload: { my_orders: VENTES.map(([tx, t, p, d]) => ({ transaction_id: tx, title: t, price: { amount: String(p), currency_code: 'EUR' }, status: 'Commande finalisée', date: d })) } } },
  ...VENTES.map(([tx, , , , v]) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: '2026-10-27T07:30:00Z', payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: v } } } })),
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: [] } },
];
const mainDe = (extra = {}) => ({ vinted_regime: 'micro', vinted_urssaf_taux: 13.5, vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: LIGNE, vrm_journee_benefice: true,
  vinted_sale_overrides: { 9301: { buyPrice: '40' }, 9302: { buyPrice: '30' }, 9303: { buyPrice: '50' }, 9304: { buyPrice: '30' } }, ...extra });

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
// §6.3 : la projection `select=` s'applique pour de vrai.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (/->>/.test(src) && v != null && typeof v !== 'object') v = String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

// `opts.main` est GARDÉE quand l'app l'écrit (un banc qui jette les écritures
// mesure une fiction, §6.3). `opts.txnKO` : les dates de versement ne se lisent
// pas (la vraie forme : 522 + HTML). `opts.releveKO` : le relevé non plus.
// `opts.pont` : `undefined` = pas d'extension ; sinon la version annoncée.
async function rendre(b, vp, opts) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript((v) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {}
    if (v == null) return;
    window.addEventListener('message', (e) => { if (e.source !== window || !e.data || e.data.__vmr !== 'ping') return; window.postMessage({ __vmr: 'ready', version: v }, '*'); });
  }, opts.pont == null ? null : opts.pont);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    const panne = () => route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') opts.main = x.data; } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    // Base CLOISONNÉE (la production l'est) : sinon l'app n'envoie rien au nuage
    // (`cloudPush` exige CLOISONNE) et l'écriture de la déclaration ne se voit pas.
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (opts.txnKO && /_txn_/.test(u)) return panne();
    if (opts.releveKO && /_releve_/.test(u)) return panne();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: '2026-10-27T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([forme({ id: 'main', data: opts.main || {} })]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const aller = async (pg, tab, repere, ms = 1500) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (repere) await pg.waitForFunction((r) => document.querySelector(r) || /pas pu s'afficher/.test(document.body.innerText), repere, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(ms);
};
const touche = async (pg, sel, vp) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (vp.width < 600) await l.tap(); else await l.click(); };
const attrs = (pg, sel, pref) => pg.evaluate(([s, p]) => { const e = document.querySelector(s); if (!e) return null; const o = {}; for (const a of e.getAttributeNames()) if (a.startsWith(p)) o[a.slice(p.length)] = e.getAttribute(a); return o; }, [sel, pref]);
const registre = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_urssaf_declare') || 'null'); } catch (_) { return null; } });
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
const formulaire = async (pg) => {
  await pg.waitForFunction(() => document.querySelector('[data-decl-form]') || document.querySelector('[data-decl-bloque]'), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(400);
  return pg.evaluate(() => { const f = document.querySelector('[data-decl-form]'); return f ? f.innerText : null; });
};

// (22 oct., revue) Le contraste RENDU (WCAG) d'un texte sur ce qui est vraiment
// peint derrière lui : couleurs du texte et des fonds remontés jusqu'au premier
// fond opaque, un dégradé compté par sa PIRE couleur, l'alpha composé. Vu par
// le relecteur : à 390 px, le choix « Je n'ai pas de dépenses à noter / Ajouter
// une dépense » sortait à 1,7:1 sur le bandeau sombre de Ma journée.
const contrastes = (pg, sels) => pg.evaluate((liste) => {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const sur = (h, bas) => ({ r: h.r * h.a + bas.r * (1 - h.a), g: h.g * h.a + bas.g * (1 - h.a), b: h.b * h.a + bas.b * (1 - h.a), a: 1 });
  const out = {};
  for (const sel of liste) {
    const e = document.querySelector(sel);
    if (!e) { out[sel] = null; continue; }
    const couches = [];
    for (let p = e; p; p = p.parentElement) {
      const st = getComputedStyle(p);
      if (st.backgroundImage && st.backgroundImage !== 'none') {
        const cs = (st.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
        if (cs.length) { couches.push(cs); if (cs.every((c) => c.a >= 1)) break; }
      }
      const bg = parse(st.backgroundColor);
      if (bg && bg.a > 0) { couches.push([bg]); if (bg.a >= 1) break; }
    }
    let fonds = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (const L of couches.reverse()) fonds = L.flatMap((c) => fonds.map((f) => sur(c, f)));
    const t = parse(getComputedStyle(e).color);
    const r = Math.min(...fonds.map((f) => { const tc = sur(t, f); const a = lum(tc), b = lum(f); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }));
    out[sel] = { ratio: Math.round(r * 100) / 100, couleur: getComputedStyle(e).color };
  }
  return out;
}, sels);
const SELS_CHOIX = ['[data-depenses-choix] > span', '[data-depenses-aucune]', '[data-depenses-ajouter]'];
const juge = (cs, quoi) => {
  const faibles = Object.entries(cs).filter(([, v]) => !v || !(v.ratio >= 4.5));
  dit(!faibles.length, `${quoi} : le choix des dépenses se lit (contraste ≥ 4,5:1 sur ce qui est peint derrière)`,
    Object.entries(cs).map(([k, v]) => `${k.replace(/\[data-depenses-|\]|> /g, '')} ${v ? v.ratio + ':1 ' + v.couleur : 'absent'}`).join(' · '));
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const sansStatut = () => { const m = mainDe(); delete m.vinted_regime; delete m.vinted_urssaf_taux; return m; };
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `${vp.width} px`;
      console.log(`── ${T}`);
      await essaie(`A ${T}`, async () => {
        const opts = { main: sansStatut() };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'cat_ventes', '[data-ventes-benef-n]', 2500);   // Ventes publie le bénéfice
        await aller(pg, 'compta', '[data-statut-carte]', 1800);
        await pg.waitForFunction(() => document.querySelector('[data-benef-ligne="cotis"]'), null, { timeout: 15000 }).catch(() => {});
        dit(await pg.$('[data-statut-carte="question"]') != null, `A ${T} : statut jamais choisi ⇒ Comptabilité pose la question`);
        dit(await pg.$('[data-declarer-urssaf]') == null, `A ${T} : aucune carte de déclaration URSSAF`);
        const cot = await attrs(pg, '[data-benef-ligne="cotis"]', 'data-benef-');
        dit(!!(cot && 'sans-cotis' in cot), `A ${T} : aucune cotisation déduite du bénéfice`, JSON.stringify(cot));
        await sain(pg, `A ${T} Comptabilité`);
        await aller(pg, 'journee', '[data-job]', 2500);
        dit(await pg.$('[data-job="urssaf"]') == null, `A ${T} : Ma journée ne parle pas d'URSSAF`);
        // Il choisit « Particulier » : rangé au nuage, la carte suit.
        await aller(pg, 'compta', '[data-statut-carte]', 1500);
        await touche(pg, '[data-statut="particulier"]', vp);
        await pg.waitForTimeout(1600);
        dit(await pg.$('[data-statut-carte="particulier"]') != null, `A ${T} : « Particulier » choisi ⇒ sa carte, sans URSSAF`);
        dit(await pg.$('[data-declarer-urssaf]') == null, `A ${T} : toujours aucune déclaration URSSAF`);
        dit(opts.main && opts.main.vinted_regime === 'particulier', `A ${T} : le choix est rangé au nuage (synchronisé)`, opts.main && opts.main.vinted_regime);
        dit(!errs.length, `A ${T} : aucune erreur de page`, errs[0]);
        await ctx.close();
      });
      await essaie(`B ${T}`, async () => {
        const opts = { main: { ...sansStatut(), vinted_regime: 'societe' } };
        const { ctx, pg } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-statut-carte]', 1800);
        dit(await pg.$('[data-statut-carte="societe"]') != null, `B ${T} : société ⇒ sa carte`);
        dit(await pg.$('[data-declarer-urssaf]') == null, `B ${T} : société ⇒ aucune déclaration URSSAF`);
        await aller(pg, 'journee', '[data-job]', 2500);
        dit(await pg.$('[data-job="urssaf"]') == null, `B ${T} : société ⇒ aucun rappel URSSAF dans Ma journée`);
        await ctx.close();
      });
      await essaie(`C ${T}`, async () => {
        const opts = { main: { ...sansStatut(), vinted_regime: 'micro' } };
        const { ctx, pg } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-statut-taux]', 1800);
        const t0 = await attrs(pg, '[data-statut-taux]', 'data-statut-');
        dit(t0 && t0.taux === '12.4', `C ${T} : micro-entrepreneur sans réglage ⇒ le taux officiel de l'achat-revente (12,4 %)`, JSON.stringify(t0));
        dit(await pg.$('[data-declarer-urssaf]') != null, `C ${T} : micro ⇒ la carte de déclaration URSSAF`);
        await touche(pg, '[data-taux-option="liberatoire"]', vp);
        await pg.waitForTimeout(1600);
        const t1 = await attrs(pg, '[data-statut-taux]', 'data-statut-');
        dit(t1 && t1.taux === '13.4', `C ${T} : versement libératoire ⇒ 13,4 %`, JSON.stringify(t1));
        dit(opts.main && Number(opts.main.vinted_urssaf_taux) === 13.4, `C ${T} : le taux est rangé au nuage`, opts.main && String(opts.main.vinted_urssaf_taux));
        await aller(pg, 'journee', '[data-job]', 2500);
        dit(await pg.$('[data-job="urssaf"]') != null, `C ${T} : micro ⇒ le rappel URSSAF de Ma journée reste`);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `❌ statut-fiscal : ${ko} rouge(s)` : '✅ statut-fiscal : tout est vert');
  process.exit(ko ? 1 : 0);
})();
