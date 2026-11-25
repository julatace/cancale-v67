require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « ANTI-CHEVAUCHEMENT » DES LISTES (23 nov. — Julien, capture iPhone d'Achats : « pas possible, les bugs visuels, le
//  logo mal positionné »). Sur chaque liste (Achats, Ventes, Annonces, Retraits), à 390 tactile et 1512, la RÈGLE :
//    L1 aucun élément visible ne sort de sa rangée (logo du transporteur, pastille, icône du reçu…) ;
//    L2 aucune rangée n'en chevauche une autre ;
//    L3 aucun séparateur double (« 12 nov. · · Relais ») ni espace double autour d'un « · » ;
//    L4 aucun texte coupé net : ce qui ne tient pas finit par « … » (text-overflow: ellipsis) ;
//    L5 Achats (390) : le menu « ⋯ » d'une rangée est une FEUILLE qui monte du bas (portail), jamais un popover qui déborde
//       sous la barre d'onglets ;
//    L6 Achats : aucune pastille orange (nouvelle apparence : plus d'ambre sur l'état d'une rangée).
//  Base inventée (design-passe) + des suivis Vinted sur 8 achats (le transporteur, son logo, le point relais) : la forme
//  réelle des lignes `harvest_{uid}_suivi_{tx}` (projection `meta->>`). `BANC_DIST=<dist d'avant>` : rouge. `SHOTS=…`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-chevauchement');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(6000); };

function baseSuivis() {
  const b = base();
  const ach = b.rows.find((r) => /^harvest_\d+_orders_purchased$/.test(r.id) && r.data && r.data.payload && (r.data.payload.my_orders || []).length > 20);
  const uid = /^harvest_(\d+)_/.exec(ach.id)[1];
  const maintenant = Date.now();
  (ach.data.payload.my_orders || []).slice(0, 8).forEach((o, i) => {
    const tx = String(o.transaction_id);
    b.rows.push({ id: `harvest_${uid}_suivi_${tx}`, data: { tx, suivi: (i % 2 ? 'VGS' : '') + String(50000000 + i * 7919), transporteur: i % 2 ? 'Vinted Go' : 'Mondial Relay', capturedAt: new Date(maintenant - 3600e3).toISOString(),
      dernier: { t: i % 3 ? 'Ton colis est en route' : 'Ton colis est arrivé au point relais', at: new Date(maintenant - (i + 1) * 3600e3).toISOString() }, etapes: [{ t: 'Ton colis est en route' }],
      relaisNom: i % 3 ? '' : 'Relais Vinted Go Bourse', relaisRue: '', relaisCp: '', relaisVille: '' } });
  });
  return b;
}

const MESURE = `
  const vis = (x) => { if (!x) return false; const r = x.getBoundingClientRect(); const c = getComputedStyle(x); return r.width > 0.5 && r.height > 0.5 && c.visibility !== 'hidden' && c.display !== 'none' && Number(c.opacity) > 0.01 && !x.closest('[hidden]') && !(x.closest('details:not([open])') && !x.closest('summary')); };
  const SEL = '.vrm-buy-list > .vrm-buy-row, tr[data-tt-ligne], [data-tt-liste] [data-tt-ligne], .vrm-sale-row, .n-rp-billet, .n-rp-liste > li, .n-ad-carte, [data-eg-article], [data-vn-liste] [data-vn-rang], [data-vn-rang]';
  const rangees = [...document.querySelectorAll(SEL)].filter(vis).filter((r) => { const b = r.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; }).slice(0, 40);
  const nom = (e) => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/)[0] : e.tagName) + ' « ' + (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24) + ' »';
  const hors = [], doubles = [], coupes = [];
  for (const r of rangees) {
    const R = r.getBoundingClientRect();
    for (const e of r.querySelectorAll('*')) {
      if (!vis(e) || e.closest('[role="menu"], [role="dialog"], .vrm-acts-menu, .vrm-menu-pop, [data-popover]')) continue;
      const b = e.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      // un ancêtre qui rogne (overflow) : ce qui dépasse est caché, pas « hors »
      let rogne = false; for (let a = e.parentElement; a && a !== r; a = a.parentElement) { const c = getComputedStyle(a); if (/hidden|clip|auto|scroll/.test(c.overflow + c.overflowX + c.overflowY)) { const A = a.getBoundingClientRect(); if (b.top >= A.top - 1 && b.bottom <= A.bottom + 1 && b.left >= A.left - 1 && b.right <= A.right + 1) break; rogne = true; break; } }
      if (rogne) continue;
      if (b.left < R.left - 1 || b.right > R.right + 1 || b.top < R.top - 1 || b.bottom > R.bottom + 1) hors.push(nom(e) + ' ' + [Math.round(b.top - R.top), Math.round(R.bottom - b.bottom)].join('/'));
      if (!e.children.length && b.width > 2 && b.height > 2) { const c = getComputedStyle(e); if (/inset\\(50%\\)|rect\\(0/.test(c.clipPath + c.clip)) continue; if ((e.innerText || '').trim().length > 2 && e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(c.overflowX) && c.textOverflow !== 'ellipsis') coupes.push(nom(e)); }
    }
    const t = (r.innerText || '').replace(/[\\u00a0\\u202f]/g, ' ');
    if (/·\\s*·/.test(t) || / {2,}·|· {2,}/.test(t)) doubles.push(t.replace(/\\s+/g, ' ').slice(0, 80));
  }
  const chev = [];
  for (let i = 0; i < rangees.length; i++) for (let j = i + 1; j < rangees.length; j++) { if (rangees[i].contains(rangees[j]) || rangees[j].contains(rangees[i])) continue; const a = rangees[i].getBoundingClientRect(), c = rangees[j].getBoundingClientRect();
    if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) chev.push(nom(rangees[i]) + ' × ' + nom(rangees[j])); }
  return { n: rangees.length, hors: hors.slice(0, 8), nHors: hors.length, doubles: doubles.slice(0, 4), coupes: coupes.slice(0, 6), chev: chev.slice(0, 4) };`;

async function liste(nav, b, W, nomL, url, prep) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url });
  try {
    await pret(pg);
    if (prep) await prep(pg);
    const m = await pg.evaluate(new Function(MESURE));
    const suf = `${nomL} ${W}`;
    dit(m.n > 0, `L0 ${suf} : la liste est rendue (${m.n} rangées)`, m.n);
    dit(!m.nHors, `L1 ${suf} : rien ne sort de sa rangée`, m.hors);
    dit(!m.chev.length, `L2 ${suf} : aucune rangée n'en chevauche une autre`, m.chev);
    dit(!m.doubles.length, `L3 ${suf} : aucun séparateur double`, m.doubles);
    dit(!m.coupes.length, `L4 ${suf} : aucun texte coupé net (ellipse « … »)`, m.coupes);
    await pg.screenshot({ path: path.join(SHOTS, `${nomL}-${W}.png`) });
    if (nomL === 'achats' && W < 600) {
      const prem = await pg.evaluate(() => { for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop = 0; scrollTo(0, 0); const r = [...document.querySelectorAll('.vrm-buy-list > .vrm-buy-row')].find((x) => x.getClientRects().length); return r ? Math.round(r.getBoundingClientRect().top) : null; });
      dit(prem != null && prem <= 422, `L7 ${suf} : avec des achats attendus à un point, la 1re rangée reste au premier écran, à mi-hauteur au plus (${prem} ≤ 422)`, prem);
    }
    if (nomL === 'achats') {
      const orange = await pg.evaluate(() => {
        const o = (c) => { const m = String(c).match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return false; if (m.length > 3 && Number(m[3]) < 0.05) return false; const [r, g, b] = m.map(Number); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 50) return false; let h; if (mx === r) h = 60 * (((g - b) / (mx - mn)) % 6); else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2); else h = 60 * ((r - g) / (mx - mn) + 4); if (h < 0) h += 360; return h >= 15 && h <= 50; };
        return [...document.querySelectorAll('.vrm-buy-row .vrm-buy-statut, .vrm-buy-row .vrm-buy-statut *')].filter((x) => x.getClientRects().length).filter((x) => { const c = getComputedStyle(x); return o(c.backgroundColor) || o(c.color); }).map((x) => (x.innerText || '').trim().slice(0, 20));
      });
      dit(!orange.length, `L6 ${suf} : aucune pastille orange sur les rangées`, orange);
      if (W < 600) {
        await pg.locator('.vrm-buy-row .vrm-buy-act button, .vrm-buy-row [data-achat-menu], .vrm-buy-row button[aria-haspopup]').first().click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(900);
        const f = await pg.evaluate(() => {
          const vis = (x) => !!x && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
          const menu = [...document.querySelectorAll('[role="menu"], [role="dialog"], .vrm-fs, .n-feuille')].filter(vis).pop();
          if (!menu) return null;
          const r = menu.getBoundingClientRect(); const barre = [...document.querySelectorAll('.n-onglets, .vrm-bottom-nav, nav[aria-label]')].filter(vis).map((x) => x.getBoundingClientRect().top).filter((t) => t > innerHeight / 2);
          return { bas: Math.round(r.bottom), vh: innerHeight, dansListe: !!menu.closest('.vrm-buy-row'), barre: barre.length ? Math.round(Math.min(...barre)) : null, coupe: menu.scrollHeight > menu.clientHeight + 1 && getComputedStyle(menu).overflowY === 'visible' };
        });
        dit(!!f && !f.dansListe && f.bas <= f.vh + 12, `L5 ${suf} : « ⋯ » ouvre une feuille d'actions (portail, rien sous la barre d'onglets)`, f);
        await pg.screenshot({ path: path.join(SHOTS, `${nomL}-menu-${W}.png`) });
      }
    }
    dit(!erreurs.length, `${suf} : aucune erreur d'app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = baseSuivis();
  try {
    for (const W of [390, 1512]) {
      console.log(`\n── ${W}`);
      for (const [n, u, prep] of [['achats', '/?tab=achats'], ['ventes', '/?tab=ventes'], ['annonces', '/?tab=cat_annonces'],
        ['retraits', '/?tab=achats', async (pg) => { await pg.locator('[data-achats-onglet="route"]').first().click({ timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(1200); }]]) {
        try { await liste(nav, b, W, n, u, prep); } catch (e) { dit(false, `${n} ${W} : le banc a pu se dérouler`, String(e && e.message || e)); }
      }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} chevauchement : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
