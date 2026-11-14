require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA REFONTE DE MESSAGES, E-MAILS ET STOCK (14 nov.) — jugée sur l'app RENDUE.
//  Récit : docs/passation/2026-11-14-refonte-messages-stock.md.
//
//  Julien : « toute l'application, change totalement, dramatique », puis « imagine si
//  j'ai 1000 articles », puis (AJOUT 3) « la liste arrive après 1,5 écran ». Ce banc
//  sert une base INVENTÉE au volume (`_base-messages-stock.cjs` : 1 000 conversations,
//  1 000 e-mails, 1 000 paires en ligne) et mesure la RÈGLE, jamais un libellé :
//
//  A. FORME — 390 tactile ET 1512, clair ET sombre, sur chacun des trois écrans :
//     premiere  au téléphone, le HAUT de la 1re rangée de la liste ≤ 50 % de 844 px ;
//     vides     aucune carte dont la valeur principale est « — » (un tiret seul en ≥ 20 px) ;
//     pleins    au plus UN bouton plein accent visible dans le premier écran ;
//     capsules  aucune rangée de plus de 3 capsules grises ≥ 44 px, posées sans défilement ;
//     flottant  rien de fixe posé sur la liste au-dessus de la barre du bas après 3 s ;
//     visibles  au téléphone, au moins 8 rangées ENTIÈRES dans un écran, la liste en haut.
//  B. VOLUME — 390 tactile, clair, la base de 1 000 :
//     rendu     temps jusqu'à la 1re rangée de la liste ;
//     cls       décalages de mise en page en défilant jusqu'en bas (≈ 0) ;
//     noeuds    nœuds du DOM ;
//     recherche le mot (Messages : un pseudo ; E-mails : un n° de suivi ; Stock : un N°)
//               tapé dans la recherche de l'écran trouve sa rangée en < 300 ms.
//     `BANC_REF=<dist d'origin/main>` : les mêmes mesures sur l'avant ; rouge si l'après fait
//     pire (temps +25 % et +250 ms, nœuds +10 %, CLS +0,02, une rangée visible de moins).
//  `PARTIES=forme,volume` `ECRANS=messages,emails,stock` `LARGEURS=390` `THEMES=clair`
//  pour un sous-ensemble ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures, `DSF=2`
//  des captures d'iPhone nettes. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, pret, srv, PORT, chromium } = P;
const B = require('./_base-messages-stock.cjs');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const PARTIES = liste('PARTIES', 'forme,volume');
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ECRANS_VOULUS = liste('ECRANS', 'messages,emails,stock');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-refonte-messages-stock');
fs.mkdirSync(SHOTS, { recursive: true });
const ECRANS = { messages: '/?tab=messages', emails: '/?tab=emails', stock: '/?tab=garage' };
// La rangée de la liste de chaque écran (sa forme dans l'app, pas un libellé).
const RANGEES = { messages: '.vrm-msg-list .vrm-inbox-row', emails: '.vrm-boite-ligne', stock: '[data-stock-annonce]' };

// ── A. La mesure de FORME, dans la page ─────────────────────────────────────
function mesurerForme({ tactile, sombre, sel }) {
  const out = { premiere: [], vides: [], pleins: [], capsules: [], flottant: [], visibles: [] };
  const root = document.querySelector('.vrm-main'); if (!root) { out.premiere.push('pas de .vrm-main'); return out; }
  const H = innerHeight;
  const rgba = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const ACCENT = new Set(['#0071E3', '#0066CC', '#0A84FF', '#409CFF', '#007AFF']);
  const vis = (el) => { if (!el || !el.isConnected) return false; if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; const r = el.getBoundingClientRect(); return r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.top < H; };
  const nom = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''} « ${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)} »`;
  const haut = (document.querySelector('.vrm-app-header') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
  const bas = (document.querySelector('.vrm-mobile-nav') || { getBoundingClientRect: () => ({ top: H }) }).getBoundingClientRect().top;
  // premiere : la 1re rangée de la liste, dans le premier écran (défilement à zéro).
  const rangees = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 8);
  if (!rangees.length) out.premiere.push('aucune rangée de liste');
  else if (tactile) { const t = rangees[0].getBoundingClientRect().top + (document.querySelector('.vrm-main').scrollTop || 0) + (document.scrollingElement.scrollTop || 0); if (t > 0.5 * 844) out.premiere.push({ top: Math.round(t), max: 422 }); }
  // vides : un « — » seul en grand dans une carte (la valeur principale manque).
  for (const el of root.querySelectorAll('*')) {
    if (el.children.length) continue; const t = (el.textContent || '').trim();
    if (!/^[—–-]$/.test(t) || !vis(el)) continue;
    if ((parseFloat(getComputedStyle(el).fontSize) || 0) < 20) continue;
    out.vides.push(nom(el.parentElement || el));
  }
  // pleins : boutons pleins accent dans le premier écran.
  for (const el of document.querySelectorAll('.vrm-main button, .vrm-main a, .vrm-main [role="button"]')) {
    if (!vis(el) || el.closest('[inert], [aria-hidden="true"]')) continue;
    const c = rgba(getComputedStyle(el).backgroundColor); if (!c || c.a < 0.9) continue;
    const r = el.getBoundingClientRect(); if (r.width < 60 || r.height < 28) continue;
    if (ACCENT.has(hex(c))) out.pleins.push(nom(el));
  }
  if (out.pleins.length <= 1) out.pleins = [];
  // capsules : une rangée de plus de 3 capsules grises ≥ 44 px, sans défilement.
  const lignes = new Map();
  for (const el of root.querySelectorAll('button, a, [role="button"], select, span, div')) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.height < 44 || r.height > 70 || r.width > 320) continue;
    const cs = getComputedStyle(el); const rad = parseFloat(cs.borderTopLeftRadius) || 0; if (rad < r.height / 2 - 2) continue;
    const c = rgba(cs.backgroundColor); if (!c || c.a < 0.05) continue; const m = (c.r + c.g + c.b) / 3; if (Math.abs(c.r - c.b) > 18) continue;
    if (sombre ? m < 30 || m > 120 : m < 200 || m > 248) continue;
    let rail = false; for (let x = el.parentElement; x && x !== root; x = x.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(x).overflowX)) { rail = true; break; } }
    if (rail) continue;
    const k = Math.round(r.top / 6); lignes.set(k, (lignes.get(k) || []).concat(nom(el)));
  }
  for (const [, l] of lignes) if (l.length > 3) out.capsules.push(l.slice(0, 4));
  // flottant : un élément fixe posé sur la liste (entre la barre du haut et celle du bas).
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (cs.position !== 'fixed') continue; if (!vis(el)) continue;
    if (el.closest('.vrm-app-header, .vrm-mobile-nav, [role="dialog"], .vrm-fs, .vrm-chat-overlay, .vrm-toast, [aria-live="assertive"]')) continue;
    const r = el.getBoundingClientRect(); if (r.height > H * 0.6 || r.width < 60 || r.height < 16) continue;
    if (r.top > haut && r.bottom <= bas + 2 && r.top > H * 0.45) out.flottant.push(nom(el));
  }
  return out;
}
// visibles : la 1re rangée amenée sous la barre du haut, puis les rangées ENTIÈRES dans l'écran.
async function compterVisibles(pg, sel) {
  return pg.evaluate(async (sel) => {
    const l = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 8);
    if (!l.length) return 0;
    const m = document.querySelector('.vrm-main'); const sc = m && m.scrollHeight > m.clientHeight + 4 ? m : document.scrollingElement;
    const haut = (document.querySelector('.vrm-app-header') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
    sc.scrollTop += l[0].getBoundingClientRect().top - haut - 8;
    await new Promise((r) => setTimeout(r, 400));
    const bas = (document.querySelector('.vrm-mobile-nav') || { getBoundingClientRect: () => ({ top: innerHeight }) }).getBoundingClientRect().top;
    let plafond = haut; for (const s of document.querySelectorAll('.vrm-main *')) { const cs = getComputedStyle(s); if (cs.position === 'sticky') { const r = s.getBoundingClientRect(); if (r.top <= haut + 2 && r.bottom > plafond && r.height < 200) plafond = r.bottom; } }
    return l.filter((e) => { const r = e.getBoundingClientRect(); return r.top >= plafond - 1 && r.bottom <= bas + 1; }).length;
  }, sel);
}

// ── B. Le volume, mesuré DANS la page ───────────────────────────────────────
const RECHERCHE = {
  // Messages : un pseudo de la base (la conversation n° 700, loin dans la liste).
  messages: { champ: '[data-msg-recherche] input, input[data-msg-recherche]', mot: 'adam_vintage_paris', trouve: (t) => /adam_vintage_paris/.test(t), rangee: '.vrm-msg-list .vrm-inbox-row' },
  // E-mails : un n° de suivi loin dans la boîte (servi par la route du banc).
  emails: { champ: 'input[type="search"], .vrm-boite input', mot: '4180700', trouve: (t) => /Relais|4180700|Colis/.test(t), rangee: '.vrm-boite-ligne' },
  // Stock : un N° de la base (la paire n° 1937).
  stock: { champ: '[data-stock-recherche] input', mot: '1937', trouve: (t) => /N°\s*1937(?!\d)/.test(t), rangee: '[data-stock-res], [data-stock-annonce]' },
};
async function mesurerVolume(nav, ecran) {
  const o = await ouvrir(nav, { W: 390, sombre: false, b: B.baseVolume(), url: ECRANS[ecran], api: B.apiVolume });
  const t0 = Date.now(); const sel = RANGEES[ecran];
  const vu = await o.pg.waitForSelector(sel, { timeout: 45000, state: 'attached' }).then(() => true).catch(() => false);
  const rendu = vu ? Date.now() - t0 : null;
  await o.pg.waitForTimeout(3000);
  const noeuds = await o.pg.evaluate(() => document.querySelectorAll('*').length);
  const visibles = await compterVisibles(o.pg, sel);
  const cls = await o.pg.evaluate(async () => {
    window.__cls = 0;
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; });
    po.observe({ type: 'layout-shift', buffered: false });
    const m = document.querySelector('.vrm-main'); const sc = m && m.scrollHeight > m.clientHeight + 4 ? m : document.scrollingElement;
    for (let i = 0; i < 80; i++) { const av = sc.scrollTop; sc.scrollTop += innerHeight * 0.9; await new Promise((r) => setTimeout(r, 60)); if (sc.scrollTop === av) break; }
    await new Promise((r) => setTimeout(r, 500)); po.disconnect();
    return Math.round(window.__cls * 1000) / 1000;
  });
  await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; document.scrollingElement.scrollTop = 0; });
  await o.pg.waitForTimeout(300);
  const R = RECHERCHE[ecran];
  const recherche = await o.pg.evaluate(async ({ champ, mot, rangee, src }) => {
    const trouve = new Function('t', 'return (' + src + ')(t)');
    const el = [...document.querySelectorAll(champ)].find((x) => x.getBoundingClientRect().height > 8);
    if (!el) return { ms: null, pourquoi: 'pas de champ' };
    const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const t0 = performance.now(); poser.call(el, mot); el.dispatchEvent(new Event('input', { bubbles: true }));
    while (performance.now() - t0 < 6000) {
      const l = [...document.querySelectorAll(rangee)].filter((e) => e.getBoundingClientRect().height > 8);
      if (l.length && l.length <= 12 && l.some((e) => trouve(e.textContent.replace(/\s+/g, ' ')))) return { ms: Math.round(performance.now() - t0) };
      await new Promise((r) => setTimeout(r, 10));
    }
    return { ms: null, pourquoi: 'pas trouvé en 6 s' };
  }, { champ: R.champ, mot: R.mot, rangee: R.rangee, src: R.trouve.toString() });
  await o.pg.screenshot({ path: path.join(SHOTS, `volume-${ecran}-${path.basename(path.dirname(process.env.BANC_DIST || 'dist/x'))}.png`) });
  await o.ctx.close();
  return { rendu, noeuds, visibles, cls, recherche: recherche.ms, pourquoi: recherche.pourquoi, erreurs: o.erreurs.slice(0, 2) };
}
function mesurerRef(ref) {
  const sortie = path.join(SHOTS, 'volume-ref.json');
  try { fs.unlinkSync(sortie); } catch (_) {}
  require('child_process').spawnSync(process.execPath, [__filename], { env: { ...process.env, BANC_DIST: ref, BANC_REF: '', PARTIES: 'volume', SORTIE_VOLUME: sortie, BANC_PORT: '' }, stdio: 'ignore', timeout: 480000 });
  try { return JSON.parse(fs.readFileSync(sortie, 'utf8')); } catch (_) { return null; }
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  let rouges = 0;
  if (PARTIES.includes('forme')) {
    const CLES = ['premiere', 'vides', 'pleins', 'capsules', 'flottant', 'visibles'];
    const total = Object.fromEntries(CLES.map((k) => [k, 0]));
    for (const W of LARGEURS) for (const theme of THEMES) for (const e of ECRANS_VOULUS) {
      const suf = `${e}-${W}-${theme}`; let o;
      try {
        o = await ouvrir(nav, { W, sombre: theme === 'sombre', b: B.baseVolume(), url: ECRANS[e], api: B.apiVolume });
        await pret(o.pg); await o.pg.waitForSelector(RANGEES[e], { timeout: 30000 }).catch(() => {});
        await o.pg.waitForTimeout(3500);   // les pastilles passagères ont disparu
        const m = await o.pg.evaluate(mesurerForme, { tactile: W < 600, sombre: theme === 'sombre', sel: RANGEES[e] });
        await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
        if (W < 600) { const v = await compterVisibles(o.pg, RANGEES[e]); if (v < 8) m.visibles.push({ visibles: v, min: 8 }); }
        const n = CLES.reduce((s, k) => s + m[k].length, 0);
        console.log(`${n ? '✗' : '✓'} ${suf} : ${CLES.map((k) => `${k} ${m[k].length}`).join(' · ')}`);
        for (const k of CLES) { total[k] += m[k].length; m[k].slice(0, Number(process.env.DETAIL || 3)).forEach((x) => console.log(`    ${k} ${JSON.stringify(x)}`)); }
        if (o.erreurs.length) { console.log('    erreurs JS :', o.erreurs.slice(0, 2).join(' | ')); rouges++; }
      } catch (err) { console.log('ÉCHEC', suf, String(err.message || err).slice(0, 200)); rouges++; }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
    console.log(`FORME : ${CLES.map((k) => `${k} ${total[k]}`).join(' · ')}`);
    rouges += Object.values(total).reduce((a, b) => a + b, 0);
  }
  if (PARTIES.includes('volume')) {
    const ref = process.env.BANC_REF || '';
    const refs = ref ? mesurerRef(ref) : null;
    if (ref && !refs) { console.log('✗ la référence (BANC_REF) n’a rien mesuré'); rouges++; }
    const mesures = {};
    for (const e of ['messages', 'emails', 'stock'].filter((x) => ECRANS_VOULUS.includes(x))) {
      try {
        const a = await mesurerVolume(nav, e); mesures[e] = a;
        const r = refs ? refs[e] : null; const fautes = [];
        if (a.rendu == null) fautes.push('aucune rangée rendue');
        if (a.visibles < 8) fautes.push(`${a.visibles} rangées visibles (< 8)`);
        if (a.cls > 0.05) fautes.push(`CLS ${a.cls} (> 0,05)`);
        if (!(a.recherche != null && a.recherche < 300)) fautes.push(`recherche : ${a.recherche == null ? a.pourquoi : a.recherche + ' ms'} (≥ 300 ms)`);
        if (r) {
          if (a.rendu != null && r.rendu != null && a.rendu > r.rendu * 1.25 + 250) fautes.push(`rendu ${a.rendu} ms, pire que l'avant (${r.rendu} ms)`);
          if (a.noeuds > r.noeuds * 1.1) fautes.push(`${a.noeuds} nœuds, plus que l'avant (${r.noeuds})`);
          if (a.cls > r.cls + 0.02) fautes.push(`CLS ${a.cls}, pire que l'avant (${r.cls})`);
          if (a.visibles < r.visibles) fautes.push(`${a.visibles} rangées visibles, moins que l'avant (${r.visibles})`);
          if (a.recherche != null && r.recherche != null && a.recherche > r.recherche * 1.25 + 100) fautes.push(`recherche ${a.recherche} ms, pire que l'avant (${r.recherche} ms)`);
        }
        const dit = (x) => `rendu ${x.rendu} ms · nœuds ${x.noeuds} · visibles ${x.visibles} · CLS ${x.cls} · recherche ${x.recherche == null ? '—' : x.recherche + ' ms'}`;
        console.log(`${fautes.length ? '✗' : '✓'} volume ${e} : ${dit(a)}${r ? `  (avant : ${dit(r)})` : ''}`);
        fautes.forEach((f) => console.log('    ' + f));
        if (a.erreurs.length) console.log('    erreurs JS :', a.erreurs.join(' | '));
        rouges += fautes.length;
      } catch (err) { console.log('ÉCHEC volume', e, String(err.message || err).slice(0, 200)); rouges++; }
    }
    if (process.env.SORTIE_VOLUME) fs.writeFileSync(process.env.SORTIE_VOLUME, JSON.stringify(mesures));
  }
  console.log(rouges ? `✗ ROUGE — ${rouges} défauts` : '✓ VERT — la liste d’abord, dense à 1 000, rien qui flotte');
  console.log('captures :', SHOTS);
  await nav.close(); srv.close();
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
