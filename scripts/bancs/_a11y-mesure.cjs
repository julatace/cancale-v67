// ════════════════════════════════════════════════════════════════════════════
//  Mesures de la partie E du banc `accessibilite.cjs` (17 nov., audit WCAG 2.1 AA).
//  Rien n'est lu dans le code : tout est MESURÉ dans la page rendue.
//   · contrastePixels : le texte rendu transparent, une capture, la MÉDIANE des pixels du cadre
//     de chaque texte = le fond tel qu'il s'affiche (verre, dégradé bleu compris) ; le texte
//     recouvert par un autre élément est ignoré, comme celui qui passe sous le fondu de la barre
//     du bas (il défile, la dernière ligne remonte au-dessus) et les logos de marque (exemptés, 1.4.3).
//   · cibles : chaque contrôle visible < 44 × 44 (zone étendue `::before/::after` comptée) ; un
//     lien DANS une phrase est exempté (2.5.5, « en ligne »).
//   · nomsVides : l'arbre d'accessibilité de Chrome (CDP), contrôles sans nom.
//   · sequenceTab : N appuis sur Tab, l'élément actif à chaque arrêt (taille, contour visible).
// ════════════════════════════════════════════════════════════════════════════
const SEL_FOCUS = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

async function attendreDemarrage(pg) {
  for (let i = 0; i < 60; i++) {
    if (await pg.evaluate(() => !document.getElementById('vrm-demarrage') && !document.documentElement.hasAttribute('data-vrm-boot'))) return true;
    await pg.waitForTimeout(500);
  }
  return false;
}

async function contrastePixels(pg, racine) {
  const els = await pg.evaluate((racine) => {
    try { for (const a of document.getAnimations()) { try { a.finish(); } catch (_) {} } } catch (_) {}
    const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const barre = document.querySelector('.vrm-tabbar'); const br = barre && barre.getClientRects().length ? barre.getBoundingClientRect() : null;
    const fondu = br ? br.top - 110 : Infinity;
    const vu = new Set(), out = [];
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const t = tw.currentNode; if (!t.textContent.trim()) continue;
      const el = t.parentElement; if (!el || vu.has(el)) continue; vu.add(el);
      if (el.closest('[aria-hidden="true"],[inert],script,style,noscript,svg,[data-marque],#vrm-demarrage')) continue;
      if (racine) { const d = [...document.querySelectorAll(racine)].filter((e) => e.getClientRects().length).pop(); if (!d || !d.contains(el)) continue; }
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight - 4 || r.left > innerWidth || r.right < 0) continue;
      if (!racine && r.bottom > fondu && !(barre && barre.contains(el))) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const h = document.elementFromPoint(cx, cy); if (!h || !(el.contains(h) || h.contains(el))) continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      const fg = parse(cs.color); if (!fg || fg[3] * op < 0.1) continue;
      const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight || 400;
      let sel = el.tagName.toLowerCase(); if (el.className && typeof el.className === 'string' && el.className.trim()) sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
      out.push({ texte: t.textContent.trim().slice(0, 40), sel, fg: cs.color, a: fg[3] * op, rgb: fg.slice(0, 3), grand: fs >= 24 || (fs >= 18.66 && fw >= 700), fs,
        dis: !!el.closest('button[disabled],[aria-disabled="true"],[disabled]'), x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(r.width, innerWidth - Math.max(0, r.left)), h: Math.min(r.height, innerHeight - Math.max(0, r.top)) });
    }
    const st = document.createElement('style'); st.id = 'banc-sans-texte';
    st.textContent = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;transition:none!important}';
    document.head.appendChild(st);
    return out;
  }, racine || null);
  await pg.waitForTimeout(120);
  const buf = await pg.screenshot({ fullPage: false });
  return pg.evaluate(async ({ b64, els }) => {
    const st = document.getElementById('banc-sans-texte'); if (st) st.remove();
    const dpr = devicePixelRatio;
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const p = lum(a), q = lum(b); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
    return els.map((e) => {
      const d = x.getImageData(Math.floor(e.x * dpr), Math.floor(e.y * dpr), Math.max(1, Math.floor(e.w * dpr)), Math.max(1, Math.floor(e.h * dpr))).data;
      const px = []; for (let i = 0; i < d.length; i += 12) px.push([d[i], d[i + 1], d[i + 2]]);
      px.sort((a, b) => lum(a) - lum(b)); const bg = px[Math.floor(px.length / 2)];
      const fg = e.rgb.map((v, i) => v * e.a + bg[i] * (1 - e.a));
      return { texte: e.texte, sel: e.sel, fg: e.fg, bg: 'rgb(' + bg.join(',') + ')', ratio: Math.round(ratio(fg, bg) * 100) / 100, req: e.grand ? 3 : 4.5, dis: e.dis, y: Math.round(e.y) };
    }).filter((r) => !r.dis && r.ratio < r.req);
  }, { b64: buf.toString('base64'), els });
}

const cibles = (pg) => pg.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="link"], input:not([type=hidden]), select, summary')) {
    if (e.closest('[aria-hidden="true"],[inert]')) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (e.tagName === 'A' && e.parentElement && /^(P|LI|SPAN|SMALL)$/.test(e.parentElement.tagName) && (e.parentElement.textContent || '').trim().length > (e.textContent || '').trim().length + 12) continue;
    let w = r.width, h = r.height;
    for (const p of ['::before', '::after']) { const s = getComputedStyle(e, p); if (s.content && s.content !== 'none' && s.position === 'absolute') { const ins = (k) => parseFloat(s[k]) || 0; w = Math.max(w, r.width - ins('left') - ins('right')); h = Math.max(h, r.height - ins('top') - ins('bottom')); } }
    const l = e.closest('label'); if (l) { const lr = l.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
    if (w + 0.5 < 44 || h + 0.5 < 44) out.push(`${Math.round(w)}×${Math.round(h)} ${(e.outerHTML || '').replace(/\s+/g, ' ').slice(0, 110)}`);
  }
  return out;
});

const ROLES = new Set(['button', 'link', 'textbox', 'searchbox', 'checkbox', 'switch', 'radio', 'combobox', 'listbox', 'tab', 'slider', 'spinbutton', 'menuitem']);
async function nomsVides(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const out = [];
  for (const n of nodes) {
    if (n.ignored) continue; const role = n.role && n.role.value; const nom = ((n.name && n.name.value) || '').trim();
    if (!ROLES.has(role) || nom) continue;
    let h = '';
    if (n.backendDOMNodeId) { try { const { outerHTML } = await cdp.send('DOM.getOuterHTML', { backendNodeId: n.backendDOMNodeId }); h = outerHTML.replace(/\s+/g, ' ').slice(0, 110); } catch (_) {} }
    out.push(role + ' ' + h);
  }
  await cdp.detach().catch(() => {});
  return out;
}

async function sequenceTab(pg, n = 45) {
  await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} });
  const seq = [];
  for (let i = 0; i < n; i++) {
    await pg.keyboard.press('Tab'); await pg.waitForTimeout(50);
    seq.push(await pg.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return { body: true };
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      const contour = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) || (cs.boxShadow && cs.boxShadow !== 'none')
        || !!(e.closest('label') && getComputedStyle(e.closest('label')).outlineStyle !== 'none');
      return { tag: e.tagName.toLowerCase(), cls: typeof e.className === 'string' ? e.className : '', nom: (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height), contour, nav: !!e.closest('nav'), main: !!e.closest('main'), suggestion: !!e.closest('#vrm-recherche-resultats'), evitement: e.hasAttribute('data-aller-contenu') };
    }));
  }
  return seq;
}

module.exports = { attendreDemarrage, contrastePixels, cibles, nomsVides, sequenceTab, SEL_FOCUS };
