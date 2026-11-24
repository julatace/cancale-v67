// ═══════════════════════════════════════════════════════════════════════════
// BANC : UNE LIGNE DE VENTE PROPRE AU TÉLÉPHONE (17 nov., chasse-bugs)
//        node scripts/bancs/ventes-ligne-propre.cjs — après `npm run build`
// ═══════════════════════════════════════════════════════════════════════════
// Julien (capture iPhone, Ventes) : « Regarde c'est moche » — « Prix d'achat ? » peint SUR « · T37,5 », le pseudo
// coupé en « jujuf… » et l'état en « Ven… », « Envoyer la facture » / « Bon de retour » en grosses pilules.
// Données INVENTÉES : le jeu de `nouveau-vendeur`, pseudos longs, aucun prix d'achat saisi (la puce « Prix d'achat ? »
// est sur chaque ligne). 390 et 375 px tactile, texte « Normal » et « Très grand » (Réglages → Taille du texte).
// Exige, dans CHAQUE ligne de vente (`.vrm-sale-row`) :
//   L1 aucun texte n'en recouvre un autre (rectangles des morceaux de texte, au pixel près) ;
//   L2 le pseudo et l'état ne sont jamais rognés (aucun « … » de CSS sur eux) ;
//   L3 aucune erreur de page.
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '10799';
const path = require('path');
const NV = require('./nouveau-vendeur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const SHOTS = process.env.SHOTS || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d != null ? ' — ' + String(d).slice(0, 500) : '')); };
const base = () => {
  const comptes = JSON.parse(JSON.stringify(NV.JEU_COMPTES)).map((c, i) => ({ ...c, login: i ? 'arthuror_vend_beaucoup2' : 'shop_cancale_officielle' }));
  return { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes, ecritures: 0 };
};
const mesure = (pg) => pg.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.opacity !== '0'; };
  // (24 nov., main-vert) Ventes natif : une vente est une RANGÉE native — « À envoyer » (`data-vn-num`, src/natif/ecrans/Ventes.jsx)
  // et « Terminées » (`data-toutes-vente`, VentesListeTel). Le pseudo est dans le sous-titre, l'état est sa pastille.
  const rows = [...document.querySelectorAll('.vrm-main .vrm-sale-row, .vrm-main .n-rangee[data-vn-num], .vrm-main .n-rangee[data-toutes-vente]')].filter(vis).slice(0, 12);
  const chevauche = [], rognes = [];
  for (const row of rows) {
    // Les morceaux de texte visibles de la ligne (un rectangle par ligne de texte).
    const boites = [];
    const tw = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!/\S/.test(n.nodeValue)) continue; const p = n.parentElement; if (!p || !vis(p) || p.closest('[aria-hidden="true"], .vrm-sr-seul, svg')) continue;
      const cs = getComputedStyle(p); if (cs.clip !== 'auto' && cs.clip !== '' && cs.position === 'absolute') continue;
      // Un texte rogné par un parent (overflow) ne se voit que dans la boîte de ce parent : on coupe son rectangle.
      let cl = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
      for (let q = p; q && q !== document.body; q = q.parentElement) { const c = getComputedStyle(q); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { const b = q.getBoundingClientRect(); cl = { left: Math.max(cl.left, b.left), top: Math.max(cl.top, b.top), right: Math.min(cl.right, b.right), bottom: Math.min(cl.bottom, b.bottom) }; } }
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r0 of rg.getClientRects()) { const r = { left: Math.max(r0.left, cl.left), top: Math.max(r0.top, cl.top), right: Math.min(r0.right, cl.right), bottom: Math.min(r0.bottom, cl.bottom) }; if (r.right - r.left > 2 && r.bottom - r.top > 2) boites.push({ r, t: n.nodeValue.trim().slice(0, 18), n }); }
    }
    for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
      if (boites[i].n === boites[j].n) continue;   // deux lignes d'un même texte
      const a = boites[i].r, b = boites[j].r;
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 2 && iy > 3) chevauche.push(`« ${boites[i].t} » × « ${boites[j].t} »`);
    }
    // (24 nov., main-vert) Rangée native : le PSEUDO est un morceau du sous-titre (`data-toutes-compte` dit lequel) — jugé là où il
    // est écrit (sa boîte de texte entière dans la boîte visible du sous-titre), jamais toute la ligne de détail, que la rangée
    // compacte d'« À envoyer » coupe exprès (23 nov.). L'état est sa pastille (`.n-pastille`), jamais rognée.
    const pseudo = row.getAttribute('data-toutes-compte') || '';
    if (pseudo) for (const st of row.querySelectorAll('.n-rangee-sous-texte')) {
      if (!vis(st)) continue; const boite = st.getBoundingClientRect();
      const tw2 = document.createTreeWalker(st, NodeFilter.SHOW_TEXT);
      for (let n = tw2.nextNode(); n; n = tw2.nextNode()) { const i = n.nodeValue.indexOf(pseudo); if (i < 0) continue;
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + pseudo.length); const r = rg.getBoundingClientRect();
        if (r.right > boite.right + 1 || r.left < boite.left - 1 || st.scrollWidth > st.clientWidth + 1 && r.right > boite.right - 12) rognes.push(pseudo + ' (pseudo coupé)'); }
    }
    for (const e of row.querySelectorAll('.vrm-fu-vente-compte, .vrm-fu-vente-compte *, .vrm-fu-legende, .vrm-ledger-sale-state, .n-pastille')) {
      if (!vis(e)) continue; const cs = getComputedStyle(e);
      const tx = (e.innerText || '').trim(); if (tx && cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) rognes.push(tx.slice(0, 30) + ' (' + e.className + ')');
    }
  }
  return { n: rows.length, chevauche: [...new Set(chevauche)].slice(0, 8), rognes: [...new Set(rognes)].slice(0, 8) };
});

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const taille of ['normal', 'tresGrand']) for (const W of [390, 375]) {
      const T = `[${W}px ${taille}]`;
      const o = await NV.ouvrir(nav, { W: 390, sombre: false, base: base(), tab: 'cat_ventes' });
      const { pg, journal } = o;
      await pg.setViewportSize({ width: W, height: W === 375 ? 667 : 844 });
      await pg.evaluate((t) => { try { if (t === 'normal') localStorage.removeItem('vrm_taille_texte'); else localStorage.setItem('vrm_taille_texte', t); } catch (_) {} }, taille);
      await pg.reload({ waitUntil: 'domcontentloaded' });
      const LIGNE = '.vrm-main .vrm-sale-row, .vrm-main .n-rangee[data-vn-num], .vrm-main .n-rangee[data-toutes-vente]';
      await pg.waitForSelector(LIGNE, { timeout: 30000 }).catch(() => {});
      await pg.waitForTimeout(3000);
      // « À envoyer » (l'ouverture) PUIS « Toutes » (la capture de Julien) : les lignes des deux listes.
      const m1 = await mesure(pg);
      // (24 nov., main-vert) « Toutes » est devenu le choix « Terminées » du segmenté natif (role=radio) : on attend SES rangées.
      const toutes = pg.locator('.vrm-main').getByRole('radio', { name: /^Terminées/ }).first();
      if (await toutes.count()) { await toutes.tap().catch(() => {}); await pg.waitForSelector('.vrm-main .n-rangee[data-toutes-vente]', { timeout: 30000 }).catch(() => {}); }
      await pg.waitForSelector(LIGNE, { timeout: 30000 }).catch(() => {});
      await pg.waitForTimeout(2500);
      const m2 = await mesure(pg);
      const m = { n: m2.n, chevauche: [...m1.chevauche, ...m2.chevauche], rognes: [...m1.rognes, ...m2.rognes] };
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ventes-ligne-${W}-${taille}.png`) });
      dit(m.n >= 3, `${T} des lignes de vente sont là (${m.n})`);
      dit(!m.chevauche.length, `${T} L1 aucun texte n’en recouvre un autre dans une ligne`, m.chevauche.join(' ¦ '));
      dit(!m.rognes.length, `${T} L2 le pseudo et l’état ne sont jamais rognés`, m.rognes.join(' ¦ '));
      dit(!journal.erreurs.filter((x) => !/access control checks|lgonxzrzjcqthjtbdpzo\.supabase\.co/.test(x)).length, `${T} L3 aucune erreur de page`, journal.erreurs.filter((x) => !/access control checks|lgonxzrzjcqthjtbdpzo\.supabase\.co/.test(x)).join(' | '));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 400)); }
  finally { await nav.close().catch(() => {}); NV.srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'} ventes-ligne-propre : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
