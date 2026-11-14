require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA REFONTE DES LISTES (14 nov.) — Ma journée, Ventes (avec « À expédier ») et
//  Annonces, jugées sur l'app RENDUE. Récit : docs/passation/2026-11-14-refonte-listes.md.
//
//  Julien, sur son iPhone : « C'est moche. … rien n'a changé », puis « le design fait
//  basique, il faut vraiment qu'on sorte des classiques », puis « il faut que ça soit
//  pratique, imagine si j'ai 1000 articles ». Ce banc mesure la RÈGLE, pas un libellé :
//
//  A. FORME — base inventée (`design-passe.cjs` : 3 comptes), 390 tactile ET 1512,
//     clair ET sombre, tout l'écran (pas seulement le premier écran) :
//     murs      un texte GRIS (le gris du système) étalé sur 2 lignes ou plus, hors d'un
//               repli fermé : une sous-ligne tient sur UNE ligne, l'explication est repliée ;
//     debords   un élément qui sort de sa carte (le « … » qui dépassait à droite) ;
//     cartes    une carte (fond carte + ombre ou cadre) posée DANS une carte ;
//     accent    un montant (« 43 € ») écrit dans la couleur d'accent (le bleu est aux actions) ;
//     repetes   la même phrase (≥ 28 signes) sur 3 rangées ou plus : c'est UNE phrase, elle va
//               dans l'en-tête du groupe ;
//     heros     au téléphone : UNE carte héros en haut de l'écran, son chiffre ≥ 48 px, et
//               elle tient dans 40 % du premier écran (le reste est à la liste).
//  B. VOLUME — 1 000 annonces (un compte) et 1 000 ventes, 390 tactile, clair :
//     rendu     temps jusqu'à la première rangée de la liste ;
//     cls       somme des décalages de mise en page en défilant jusqu'en bas (≈ 0) ;
//     noeuds    nombre de nœuds du DOM ;
//     visibles  rangées ENTIÈRES dans un écran d'iPhone une fois la liste en haut (≥ 8) ;
//     recherche le N° tapé dans la recherche d'Annonces trouve sa paire (< 300 ms).
//     `BANC_REF=<dist d'origin/main>` : les mêmes mesures sur l'avant ; rouge si l'après
//     fait pire (marges : temps +25 % et +250 ms, nœuds +10 %, CLS +0,02, une rangée de moins).
//  `PARTIES=forme,volume` `ECRANS=journee,ventes,annonces` `LARGEURS=390` `THEMES=clair`
//  pour un sous-ensemble ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures (`DSF=2`
//  pour des captures d'iPhone nettes). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const P = require('./design-passe.cjs');
const { ouvrir, base, pret, srv, PORT, chromium } = P;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const PARTIES = liste('PARTIES', 'forme,volume');
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ECRANS_VOULUS = liste('ECRANS', 'journee,ventes,annonces');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-refonte-listes');
const DSF = Number(process.env.DSF || 1);
fs.mkdirSync(SHOTS, { recursive: true });
const ECRANS = { journee: '/?tab=journee', ventes: '/?tab=ventes', annonces: '/?tab=annonces' };

// ── A. La mesure de FORME, dans la page ─────────────────────────────────────
function mesurerForme({ tactile, sombre }) {
  const out = { murs: [], debords: [], cartes: [], accent: [], repetes: [], heros: [] };
  const root = document.querySelector('.vrm-main');
  if (!root) { out.heros.push('pas de .vrm-main'); return out; }
  const rgba = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const GRIS = new Set(['#6E6E73', '#98989D']);
  const ACCENT = new Set(['#0071E3', '#0066CC', '#0A84FF', '#409CFF', '#007AFF']);
  const CARTE = new Set(sombre ? ['#1C1C1E'] : ['#FFFFFF']);
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest('.vrm-tache-tete, .vrm-phrase-ecran, [inert], .vrm-sr-seul, .vrm-sr, .vrm-sr-only, [aria-hidden="true"] .vrm-sr-seul, .vrm-fs, [role="dialog"], .vrm-neuf-hote, .vrm-fraicheur-hote')) return false;
    for (let x = el; x; x = x.parentElement) { if (x.tagName === 'DETAILS' && !x.open && !(el.closest('summary'))) return false; }
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const nom = (el) => {
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join('');
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 48);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${d} « ${t} »`;
  };
  const estCarte = (el) => {
    const cs = getComputedStyle(el);
    const c = rgba(cs.backgroundColor); if (!c || c.a < 1 || !CARTE.has(hex(c))) return false;
    if ((parseFloat(cs.borderTopLeftRadius) || 0) < 10) return false;
    const r = el.getBoundingClientRect(); if (r.width < 120 || r.height < 40) return false;
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) || el.getAttribute('role') === 'tab') return false;
    if ((parseFloat(cs.borderTopLeftRadius) || 0) >= r.height / 2 - 1) return false;   // une capsule (segment, pilule)
    return true;
  };
  const marquee = (el) => { const cs = getComputedStyle(el); return cs.boxShadow !== 'none' || (parseFloat(cs.borderTopWidth) || 0) > 0.4; };
  // Les textes : un nœud texte par élément porteur.
  const textes = new Map();
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t.length < 2) continue;
    const el = n.parentElement; if (!el || !vis(el)) continue;
    if (!textes.has(el)) textes.set(el, []);
    textes.get(el).push(n);
  }
  const lignesDe = (nodes) => { const tops = new Set(); for (const n of nodes) { const r = document.createRange(); r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) tops.add(Math.round(q.top / 4)); } return tops.size; };
  const vus = new Map();
  for (const [el, nodes] of textes) {
    const cs = getComputedStyle(el);
    const c = rgba(cs.color); const h = c ? hex(c) : '';
    const t = nodes.map((n) => n.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
    // murs : un texte GRIS sur deux lignes ou plus (ou coupé net après deux lignes).
    if (GRIS.has(h) && t.length > 12) {
      const l = lignesDe(nodes);
      const clamp = Number(cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp')) || 0;
      if (l >= 2 || clamp >= 2) out.murs.push({ l, clamp: clamp || undefined, quoi: nom(el) });
    }
    // accent : un montant dans le bleu des actions.
    if (ACCENT.has(h) && /\d[\d\s  .,]*\s?€/.test(t) && !el.closest('button, a, [role="button"]')) out.accent.push({ couleur: h, quoi: nom(el) });
    // une PHRASE (note grise ou ambre), pas un nom de paire : deux paires peuvent porter le même titre.
    if (t.length >= 28 && !/^#(1D1D1F|F5F5F7|FFFFFF|000000)$/.test(h)) vus.set(t, (vus.get(t) || 0) + 1);
  }
  for (const [t, n] of vus) if (n >= 3) out.repetes.push({ n, t: t.slice(0, 80) });
  // cartes et débords
  const cartes = [...root.querySelectorAll('div, section, article, li, a, header, details, aside')].filter((el) => vis(el) && estCarte(el));
  const setC = new Set(cartes);
  for (const el of cartes) {
    let a = el.parentElement, carteMere = null;
    while (a && a !== root) { const cs = getComputedStyle(a); const c = rgba(cs.backgroundColor); if (c && c.a >= 1) { if (setC.has(a)) carteMere = a; break; } a = a.parentElement; }
    if (carteMere && marquee(el)) out.cartes.push({ quoi: nom(el), dans: nom(carteMere).slice(0, 60) });
  }
  for (const el of cartes) {
    const r = el.getBoundingClientRect();
    if (/(hidden|clip)/.test(getComputedStyle(el).overflowX)) continue;   // une carte qui coupe ne laisse rien dépasser à la vue
    for (const d of el.querySelectorAll('button, a, span, b, strong, img, svg, input')) {
      if (!vis(d) || d.closest('svg') && d.tagName !== 'svg') continue;
      // dans un rail qui défile (ou une case qui coupe), le dépassement est voulu
      let rail = false; for (let x = d.parentElement; x && x !== el; x = x.parentElement) { const cs = getComputedStyle(x); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { rail = true; break; } }
      if (rail) continue;
      const q = d.getBoundingClientRect(); if (q.width < 2) continue;
      if (q.right > r.right + 1.5 || q.left < r.left - 1.5) { out.debords.push({ de: Math.round(Math.max(q.right - r.right, r.left - q.left)), quoi: nom(d), carte: nom(el).slice(0, 50) }); break; }
    }
  }
  // le héros (au téléphone) : dans le premier écran, un chiffre ≥ 48 px, et sa carte ≤ 40 % de l'écran.
  if (tactile) {
    const H = window.innerHeight; let meilleur = null;
    for (const [el] of textes) {
      const r = el.getBoundingClientRect(); if (r.top > H || r.bottom < 0) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (!/\d/.test(el.textContent || '')) continue;
      if (!meilleur || fs > meilleur.fs) meilleur = { fs, el };
    }
    if (!meilleur || meilleur.fs < 48) out.heros.push({ quoi: 'pas de chiffre d’affiche dans le premier écran', plusGrand: meilleur ? Math.round(meilleur.fs) : 0, el: meilleur ? nom(meilleur.el) : '' });
    else {
      let carte = meilleur.el; while (carte && carte !== root && !/vrm-fu-carte|data-heros/.test((carte.className || '') + ' ' + (carte.hasAttribute && carte.hasAttribute('data-heros') ? 'data-heros' : ''))) carte = carte.parentElement;
      if (carte && carte !== root) { const h = carte.getBoundingClientRect().height; if (h > 0.4 * H + 1) out.heros.push({ quoi: 'carte héros trop haute', h: Math.round(h), max: Math.round(0.4 * H) }); }
    }
  }
  return out;
}

// ── B. Une base au VOLUME de ses listes : 1 000 annonces, 1 000 ventes ───────
function baseVolume() {
  const b = base();
  const a = b.accounts[0]; const uid = a.vinted_user_id;
  const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`);
  const MARQ = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'], MOD = ['samba', 'spezial', 'air max 1', 'xt-6', 'gazelle', '550', 'gel-1130', 'old skool'];
  const NOW = Date.now(); const J = 86400000;
  const items = []; const num = b.main[0].data.vinted_annonce_numeros;
  let n0 = 500;
  for (let i = 0; i < 1000; i++) {
    const id = 7500000000 + i;
    items.push({ id, title: `${MARQ[i % 6]} ${MOD[i % 8]} taille ${36 + (i % 10)}`, brand_title: MARQ[i % 6], size_title: String(36 + (i % 10)), status: 'Très bon état',
      price: { amount: String(30 + (i * 7) % 90) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: i % 5, view_count: 10 + (i % 40),
      created_at_ts: new Date(NOW - (i % 200 + 1) * J).toISOString(), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg?s=abc`, high_resolution: { timestamp: Math.floor((NOW - (i % 200 + 1) * J) / 1000) } } });
    num[id] = { num: String(n0 + i), numberedAt: new Date(NOW - (i % 200 + 1) * J).toISOString() };
  }
  lst.data.payload.items = items; lst.data.nItems = items.length; lst.data.payload.pagination = { total_entries: items.length };
  const enl = b.rows.find((r) => r.id === `harvest_${uid}_enligne`);
  if (enl) { enl.data.n = items.length; enl.data.ids = items.map((x) => x.id); enl.data.items = items.map((x) => ({ id: x.id, title: x.title })); }
  b.main[0].data.vinted_used_nums = Object.values(num).map((x) => Number(x.num));
  // 1 000 ventes : des ventes FINALISÉES en plus, sur le premier compte.
  const sold = b.rows.find((r) => r.id === `harvest_${uid}_orders_sold`);
  let tx = 30000000000;
  for (let i = sold.data.payload.my_orders.length; i < 1000; i++) {
    const t = tx++, it = 8000000000 + i;
    sold.data.payload.my_orders.push({ transaction_id: t, title: `${MARQ[i % 6]} ${MOD[(i + 3) % 8]} taille ${37 + (i % 9)}`, price: { amount: String(25 + (i * 13) % 90) + '.0', currency_code: 'EUR' },
      status: 'Commande finalisée', date: new Date(NOW - (90 + i * 0.3) * J).toISOString(), item_id: it, transaction_user_status: 'completed', photo: { url: `https://images1.vinted.net/t/${it}/f800/v.jpeg?s=abc` } });
  }
  sold.data.nItems = sold.data.payload.my_orders.length;
  return b;
}

// Le volume, mesuré DANS la page : la liste, ses rangées, le défilement.
const RANGEES = { annonces: '[data-carte-annonce]', ventes: '.vrm-toutes-ligne' };
async function mesurerVolume(nav, dist, ecran) {
  const o = await ouvrirSur(nav, dist, { W: 390, sombre: false, b: baseVolume(), url: ECRANS[ecran], perf: true });
  const t0 = Date.now();
  const sel = RANGEES[ecran];
  const vu = await o.pg.waitForSelector(sel, { timeout: 45000, state: 'attached' }).then(() => true).catch(() => false);
  const rendu = vu ? Date.now() - t0 : null;
  await o.pg.waitForTimeout(2500);
  const noeuds = await o.pg.evaluate(() => document.querySelectorAll('*').length);
  // visibles : la première rangée amenée sous la barre du haut, puis les rangées ENTIÈRES dans l'écran.
  const visibles = await o.pg.evaluate(async (sel) => {
    const l = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 8);
    if (!l.length) return 0;
    const m = document.querySelector('.vrm-main'); const sc = m && m.scrollHeight > m.clientHeight + 4 ? m : document.scrollingElement;
    const haut = (document.querySelector('.vrm-app-header') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
    sc.scrollTop += l[0].getBoundingClientRect().top - haut - 8;
    await new Promise((r) => setTimeout(r, 400));
    const bas = (document.querySelector('.vrm-mobile-nav') || { getBoundingClientRect: () => ({ top: innerHeight }) }).getBoundingClientRect().top;
    // les en-têtes collants posés au-dessus de la liste réduisent la place : seules les rangées non couvertes comptent
    let plafond = haut; for (const s of document.querySelectorAll('.vrm-main *')) { const cs = getComputedStyle(s); if (cs.position === 'sticky') { const r = s.getBoundingClientRect(); if (r.top <= haut + 2 && r.bottom > plafond && r.height < 200) plafond = r.bottom; } }
    return l.filter((e) => { const r = e.getBoundingClientRect(); return r.top >= plafond - 1 && r.bottom <= bas + 1; }).length;
  }, sel);
  // CLS : décalages de mise en page en défilant jusqu'en bas, par pas d'un écran.
  const cls = await o.pg.evaluate(async () => {
    window.__cls = 0;
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; });
    po.observe({ type: 'layout-shift', buffered: false });
    const m = document.querySelector('.vrm-main'); const sc = m && m.scrollHeight > m.clientHeight + 4 ? m : document.scrollingElement;
    for (let i = 0; i < 80; i++) { const av = sc.scrollTop; sc.scrollTop += innerHeight * 0.9; await new Promise((r) => setTimeout(r, 60)); if (sc.scrollTop === av) break; }
    await new Promise((r) => setTimeout(r, 500)); po.disconnect();
    return Math.round(window.__cls * 1000) / 1000;
  });
  let recherche = null;
  if (ecran === 'annonces') {
    await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; document.scrollingElement.scrollTop = 0; });
    await o.pg.waitForTimeout(300);
    const champ = o.pg.locator('[data-ann-recherche] input, input[data-ann-recherche]').first();
    if (process.env.DEBUG) console.log('    champ :', await champ.count());
    if (await champ.count()) {
      await champ.fill('');
      recherche = await o.pg.evaluate(async () => {
        const el = document.querySelector('[data-ann-recherche] input, input[data-ann-recherche]');
        const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        // le N° d'une paire lointaine de la liste, LU sur sa pastille (jamais deviné)
        const ns = [...document.querySelectorAll('[data-carte-annonce] [data-num]')].map((e) => e.getAttribute('data-num')).filter((x) => /^\d+$/.test(x || ''));
        const cible = ns[Math.min(ns.length - 1, 40)];
        if (!cible) { window.__rech = { pasDeNumero: true }; return null; }
        const re = new RegExp('N°\\s*' + cible + '(?!\\d)');
        const t0 = performance.now(); poser.call(el, cible); el.dispatchEvent(new Event('input', { bubbles: true }));
        let l = [];
        while (performance.now() - t0 < 6000) {
          l = [...document.querySelectorAll('[data-carte-annonce]')].filter((e) => e.getBoundingClientRect().height > 8);
          if (l.length && l.length <= 10 && l.some((e) => re.test(e.textContent.replace(/\s+/g, ' ')))) return Math.round(performance.now() - t0);
          await new Promise((r) => setTimeout(r, 10));
        }
        window.__rech = { cible, n: l.length, t: l.slice(0, 3).map((e) => e.textContent.slice(0, 60)) };
        return null;
      });
    }
  }
  if (recherche == null && ecran === 'annonces') console.log('    recherche :', JSON.stringify(await o.pg.evaluate(() => window.__rech || null)));
  await o.pg.screenshot({ path: path.join(SHOTS, `volume-${ecran}-${path.basename(dist)}.png`) });
  await o.ctx.close();
  return { rendu, noeuds, visibles, cls, recherche, erreurs: o.erreurs.slice(0, 2) };
}

// Le build de référence (BANC_REF) se mesure dans un processus à lui (même banc, même base).
function mesurerRef(ref) {
  const sortie = path.join(SHOTS, 'volume-ref.json');
  try { fs.unlinkSync(sortie); } catch (_) {}
  require('child_process').spawnSync(process.execPath, [__filename], { env: { ...process.env, BANC_DIST: ref, BANC_REF: '', PARTIES: 'volume', SORTIE_VOLUME: sortie, BANC_PORT: '' }, stdio: 'ignore', timeout: 400000 });
  try { return JSON.parse(fs.readFileSync(sortie, 'utf8')); } catch (_) { return null; }
}
const ouvrirSur = (nav, dist, opts) => ouvrir(nav, opts);

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  let rouges = 0;
  if (PARTIES.includes('forme')) {
    const CLES = ['murs', 'debords', 'cartes', 'accent', 'repetes', 'heros'];
    const total = Object.fromEntries(CLES.map((k) => [k, 0]));
    for (const W of LARGEURS) for (const theme of THEMES) for (const e of ECRANS_VOULUS) {
      const suf = `${e}-${W}-${theme}`;
      let o;
      try {
        o = await ouvrir(nav, { W, sombre: theme === 'sombre', b: base(), url: ECRANS[e] });
        if (DSF !== 1) { /* captures nettes : un second contexte au facteur voulu */ }
        await pret(o.pg); await o.pg.waitForTimeout(3500);   // la pastille « Mis à jour » a disparu
        const m = await o.pg.evaluate(mesurerForme, { tactile: W < 600, sombre: theme === 'sombre' });
        await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
        const n = CLES.reduce((s, k) => s + m[k].length, 0);
        console.log(`${n ? '✗' : '✓'} ${suf} : ${CLES.map((k) => `${k} ${m[k].length}`).join(' · ')}`);
        for (const k of CLES) { total[k] += m[k].length; m[k].slice(0, Number(process.env.DETAIL || 4)).forEach((x) => console.log(`    ${k} ${JSON.stringify(x)}`)); }
        if (o.erreurs.length) { console.log('    erreurs JS :', o.erreurs.slice(0, 2).join(' | ')); rouges++; }
      } catch (err) { console.log('ÉCHEC', suf, String(err.message || err).slice(0, 200)); rouges++; }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
    const n = Object.values(total).reduce((a, b) => a + b, 0);
    console.log(`FORME : ${CLES.map((k) => `${k} ${total[k]}`).join(' · ')}`);
    rouges += n;
  }
  if (PARTIES.includes('volume')) {
    const dist = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
    const ref = process.env.BANC_REF || '';
    const refs = ref ? mesurerRef(ref) : null;
    if (ref && !refs) { console.log('✗ la référence (BANC_REF) n’a rien mesuré'); rouges++; }
    const mesures = {};
    for (const e of ['annonces', 'ventes'].filter((x) => ECRANS_VOULUS.includes(x))) {
      try {
        const a = await mesurerVolume(nav, dist, e);
        const r = refs ? refs[e] : null; mesures[e] = a;
        const fautes = [];
        if (a.rendu == null) fautes.push('aucune rangée rendue');
        if (a.visibles < 8) fautes.push(`${a.visibles} rangées visibles (< 8)`);
        if (a.cls > 0.05) fautes.push(`CLS ${a.cls} (> 0,05)`);
        if (e === 'annonces' && !(a.recherche != null && a.recherche < 300)) fautes.push(`recherche par N° : ${a.recherche == null ? 'pas trouvée' : a.recherche + ' ms'} (≥ 300 ms)`);
        if (r) {
          if (a.rendu != null && r.rendu != null && a.rendu > r.rendu * 1.25 + 250) fautes.push(`rendu ${a.rendu} ms, pire que l'avant (${r.rendu} ms)`);
          if (a.noeuds > r.noeuds * 1.1) fautes.push(`${a.noeuds} nœuds, plus que l'avant (${r.noeuds})`);
          if (a.cls > r.cls + 0.02) fautes.push(`CLS ${a.cls}, pire que l'avant (${r.cls})`);
          if (a.visibles < r.visibles) fautes.push(`${a.visibles} rangées visibles, moins que l'avant (${r.visibles})`);
          if (a.recherche != null && r.recherche != null && a.recherche > r.recherche * 1.25 + 100) fautes.push(`recherche ${a.recherche} ms, pire que l'avant (${r.recherche} ms)`);
        }
        console.log(`${fautes.length ? '✗' : '✓'} volume ${e} : rendu ${a.rendu} ms · nœuds ${a.noeuds} · visibles ${a.visibles} · CLS ${a.cls}${e === 'annonces' ? ` · recherche ${a.recherche} ms` : ''}${r ? `  (avant : rendu ${r.rendu} ms · nœuds ${r.noeuds} · visibles ${r.visibles} · CLS ${r.cls}${e === 'annonces' ? ` · recherche ${r.recherche} ms` : ''})` : ''}`);
        fautes.forEach((f) => console.log('    ' + f));
        if (a.erreurs.length) console.log('    erreurs JS :', a.erreurs.join(' | '));
        rouges += fautes.length;
      } catch (err) { console.log('ÉCHEC volume', e, String(err.message || err).slice(0, 200)); rouges++; }
    }
    if (process.env.SORTIE_VOLUME) fs.writeFileSync(process.env.SORTIE_VOLUME, JSON.stringify(mesures));
  }
  console.log(rouges ? `✗ ROUGE — ${rouges} défauts` : '✓ VERT — listes denses, une chose en haut, rien qui déborde');
  console.log('captures :', SHOTS);
  await nav.close(); srv.close();
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
