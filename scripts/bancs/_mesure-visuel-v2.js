// ════════════════════════════════════════════════════════════════════════════
//  LA MESURE DANS LA PAGE de l'audit visuel v2 (scripts/audit-visuel-v2.cjs) — évaluée telle quelle
//  (`page.evaluate`). Rend un objet JSON : coordonnées = la fenêtre. Aucune règle d'affaires : ce qui est RENDU.
//  Logique reprise de l'audit visuel du 17 nov. (mesure.js, mots.js) ; chaque bloc porte le numéro de sa règle.
// ════════════════════════════════════════════════════════════════════════════
(opts) => {
  const tactile = !!opts.tactile, W = innerWidth, H = innerHeight, echelle = Number(opts.echelle) || 1;
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  // Rogné entièrement par un ancêtre qui coupe (une boîte de 1 px, overflow:hidden) : rien ne se voit.
  const rogneTout = (e) => { const r = e.getBoundingClientRect(); for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/hidden|clip/.test(cs.overflowX + cs.overflowY)) { const q = p.getBoundingClientRect(); const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (ix < 2 || iy < 2) return true; } } return false; };
  const dansEcran = (r) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  const R = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  const txt = (e) => ((e.getAttribute && e.getAttribute('aria-label')) || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const rgba = (t) => { const m = String(t || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const fondDe = (el) => { const c = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const x = rgba(getComputedStyle(e).backgroundColor); if (x && x.a > 0) { c.push(x); if (x.a >= .99) break; } } let f = c.length && c[c.length - 1].a >= .99 ? c.pop() : { r: 30, g: 90, b: 160, a: 1 }; for (let i = c.length - 1; i >= 0; i--) f = sur(c[i], f); return f; };
  const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s, l }; };
  const estAmbre = (c) => { if (!c || c.a < .3) return false; const x = hsl(c); return x.h >= 22 && x.h <= 50 && x.s >= .55 && x.l >= .3 && x.l <= .85; };
  const estRouge = (c) => { if (!c || c.a < .3) return false; const x = hsl(c); return (x.h <= 12 || x.h >= 345) && x.s >= .55 && x.l >= .25 && x.l <= .7; };
  const main = document.querySelector('.vrm-main') || document.body;
  // Le PÉRIMÈTRE jugé : l'écran (.vrm-main), la tête de la coque et la barre du bas — jamais une feuille fermée ni un portail caché.
  const dansPerimetre = (e) => main.contains(e) || !!e.closest('.vrm-app-header, .vrm-tabbar, .v2-feuille, .vrm-confirmation, [role="dialog"]');
  const tous = [...document.body.querySelectorAll('*')].filter((e) => !e.closest('svg') || e.tagName === 'svg');
  const visibles = tous.filter(vis).filter(dansPerimetre);
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const avecTexte = visibles.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !/sr-seul|vg-sr|sr-only|visually-hidden/.test(String(e.className)) && ownText(e); });
  const CLIQ = 'button, a[href], [role="button"], [role="tab"], [role="switch"], input:not([type="hidden"]), select, textarea, summary';
  const cliquables = visibles.filter((e) => e.matches(CLIQ) && !e.closest('[inert]') && !rogneTout(e));
  const couvert = (e) => { const r = e.getBoundingClientRect(); const x = Math.max(1, Math.min(W - 2, r.left + Math.min(r.width, 40) / 2)), y = Math.max(1, Math.min(H - 2, r.top + r.height / 2)); const t = document.elementFromPoint(x, y); return !t || !(t === e || e.contains(t) || t.contains(e)); };
  const out = { W, H, design: document.documentElement.getAttribute('data-design'), grand: document.documentElement.hasAttribute('data-grand-texte') };

  // ── 1. LISTE D'ABORD : la 1re rangée utile et les bandes de contrôles avant elle ──
  let premiere = null;
  for (const s of opts.premier || []) {
    const c = [...document.querySelectorAll(s)].filter(vis).map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.top >= 0 && x.r.height > 24 && x.r.left < W && x.r.right > 0).sort((a, b) => a.r.top - b.r.top)[0];
    if (c && (!premiere || c.r.top < premiere.r.top)) premiere = { ...c, s };
  }
  out.premiere = premiere ? { sel: premiere.s, y: Math.round(premiere.r.top), t: txt(premiere.e).slice(0, 40) } : null;
  const limite = premiere ? premiere.r.top : H;
  const ctrlAvant = cliquables.map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.bottom <= limite + 1 && x.r.top >= 0 && x.r.top < H && !x.e.closest('.vrm-tabbar'));
  const chiffresAvant = avecTexte.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom <= limite && r.top >= 0 && parseFloat(getComputedStyle(e).fontSize) >= 22 && /\d/.test(e.textContent); }).map((e) => ({ e, r: e.getBoundingClientRect() }));
  const bandes = [];
  for (const it of [...ctrlAvant, ...chiffresAvant].sort((a, b) => a.r.top - b.r.top)) { const c = (it.r.top + it.r.bottom) / 2; const b = bandes.find((x) => c >= x.y0 - 2 && c <= x.y1 + 2); if (b) { b.y0 = Math.min(b.y0, it.r.top); b.y1 = Math.max(b.y1, it.r.bottom); b.l.push(txt(it.e).slice(0, 16)); } else bandes.push({ y0: it.r.top, y1: it.r.bottom, l: [txt(it.e).slice(0, 16)] }); }
  out.bandes = bandes.map((b) => ({ y: Math.round(b.y0), l: b.l.slice(0, 4) }));

  // ── 2. UN SEUL PLEIN (coque comprise), aucun plein dans une rangée de liste ──
  out.pleins = [];
  for (const e of cliquables) {
    if (!e.matches('button, a[href], [role="button"]') || e.closest('.vrm-tabbar, .vrm-seg, [role="tablist"], .v2-seg') || e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-selected') === 'true') continue;
    const r = e.getBoundingClientRect(); if (!dansEcran(r)) continue;
    const cs = getComputedStyle(e); const bg = rgba(cs.backgroundColor);
    const principal = e.matches('[data-v2b="principal"], .sb-btn-plein');
    let plein = principal;
    if (!plein && bg && bg.a >= .85 && r.width >= 60 && r.height >= 30) { const f = fondDe(e.parentElement); const k = ratio(sur(bg, f), f); if (k >= 2.2 || (hsl(bg).s > .5 && k >= 1.6)) plein = true; }
    if (plein && !couvert(e)) out.pleins.push({ t: txt(e).slice(0, 30), rect: R(r), rangee: !!e.closest('[data-v2l], .v2-ligne, .v2-afaire-ligne, .vrm-buy-row, [data-fiche-ligne]') });
  }

  // ── 3. LE PLEIN DIT SON NOMBRE EN ENTIER ──
  out.pleinsCoupes = [...document.querySelectorAll('[data-v2b="principal"]')].filter(vis).filter((b) => dansEcran(b.getBoundingClientRect())).flatMap((b) => {
    const l = b.querySelector('.v2b-lib'), n = b.querySelector('.v2b-n'); const ko = [];
    if (l && l.clientWidth > 2 && l.scrollWidth > l.clientWidth + 1) ko.push({ t: txt(b), k: 'libelle' });   // un libellé masqué visuellement (rond « + ») n'est pas tronqué
    if (n && (!vis(n) || n.scrollWidth > n.clientWidth + 1)) ko.push({ t: txt(b), k: 'nombre' });
    if (b.getAttribute('data-v2-principal') && /^\d+$/.test(b.getAttribute('data-v2-principal')) && !(b.textContent || '').includes(b.getAttribute('data-v2-principal'))) ko.push({ t: txt(b), k: 'absent' });
    return ko; });

  // ── 4. AUCUN MOT COUPÉ (deux rectangles de ligne pour un mot de 3 lettres ou plus) ──
  out.mots = [];
  { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const p = n.parentElement; if (!p || !vis(p) || !dansPerimetre(p)) continue; const s = n.textContent; const re = /[^\s  ·,;:()«»"]{3,}/g; let m;
      while ((m = re.exec(s))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const rs = [...rg.getClientRects()].filter((q) => q.width > 0.5);
        const tops = new Set(rs.map((q) => Math.round(q.top / 4))); if (tops.size > 1 && !/[-‑–/]/.test(m[0])) { const b = rg.getBoundingClientRect(); if (b.bottom > 0 && b.top < H) out.mots.push({ mot: m[0].slice(0, 20), rect: R(b) }); } } } }
  out.mots = out.mots.slice(0, 30);

  // ── 5. AUCUN TEXTE ROGNÉ sans « … » ; aucun « … » dans un h1 ni dans un plein ──
  out.rognes = []; out.suspensionsInterdites = [];
  for (const e of avecTexte) { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (!dansEcran(r)) continue;
    const horiz = e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(cs.overflowX);
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 1;
    if (horiz && cs.textOverflow !== 'ellipsis') out.rognes.push({ t: e.textContent.trim().slice(0, 40), cls: String(e.className).slice(0, 40), rect: R(r) });
    if ((horiz || clamp) && e.closest('h1, [data-v2b="principal"]')) out.suspensionsInterdites.push({ t: e.textContent.trim().slice(0, 40), rect: R(r) });
  }
  for (const e of avecTexte) { const r = e.getBoundingClientRect(); if (!dansEcran(r)) continue;
    for (let p = e.parentElement, k = 0; p && k < 4; p = p.parentElement, k++) { const cs = getComputedStyle(p); if (/hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(cs.overflowY)) { const q = p.getBoundingClientRect(); if ((r.right > q.right + 2 || r.left < q.left - 2 || r.bottom > q.bottom + 2) && q.height > 8 && !p.matches('.vrm-main, body, html, [class*="defile"], [class*="piste"], [class*="bande"], [class*="liste"], [class*="feuille"]') && p.scrollHeight <= p.clientHeight + 2 && p.scrollWidth <= p.clientWidth + 2) out.rognes.push({ t: e.textContent.trim().slice(0, 40), cls: 'parent:' + String(p.className).slice(0, 36), rect: R(r) }); break; } } }

  // ── 6. CIBLES ≥ 44 × 44 au doigt (hors liens dans une phrase) ──
  out.petits = [];
  if (tactile) for (const e of cliquables) { const r = e.getBoundingClientRect(); if (!dansEcran(r) || r.width <= 2 || r.height <= 2) continue; if (e.matches('a') && getComputedStyle(e).display === 'inline') continue; if (e.matches('input[type="checkbox"], input[type="radio"]') && e.closest('label')) continue;
    if (r.width < 43.5 || r.height < 43.5) out.petits.push({ t: txt(e).slice(0, 26), w: Math.round(r.width), h: Math.round(r.height), cls: String(e.className).slice(0, 30), rect: R(r) }); }

  // ── 7. COMPOSANT UNIQUE : les boutons visibles hors du composant (le cliquet par écran) ──
  out.horsComposant = cliquables.filter((e) => e.matches('button, [role="button"]') && dansEcran(e.getBoundingClientRect())
    && !e.matches('[data-v2b], [data-v2-rangee], [data-v2l-glisse], .v2-seg-btn, .vrm-tab, [role="tab"]') && !e.closest('.vrm-tabbar, .v2-seg, [role="tablist"]'))
    .map((e) => String(e.className).split(/\s+/)[0] || e.tagName.toLowerCase());

  // ── 8. ÉCHELLE FERMÉE dans le nouveau design (.v2-*, .v2b*, .v2l*) ──
  const TAILLES = [11, 13, 15, 17, 20, 28, 34, 56], GRAISSES = ['400', '600', '700'], RAYONS = [8, 12, 14, 16, 20];
  const estV2 = (e) => /(^|\s)v2/.test(String(e.className && e.className.baseVal != null ? e.className.baseVal : e.className));
  const horsEchelle = { tailles: {}, graisses: {}, rayons: {}, espaces: {} };
  const note = (k, v, e) => { const o = horsEchelle[k]; o[v] = o[v] || []; if (o[v].length < 3) o[v].push(String(e.className).split(/\s+/).slice(0, 2).join('.')); };
  for (const e of visibles) { if (!estV2(e) || !dansEcran(e.getBoundingClientRect())) continue; const cs = getComputedStyle(e);
    if (ownText(e)) { const f = parseFloat(cs.fontSize) / echelle; if (!TAILLES.some((t) => Math.abs(t - f) <= 0.6)) note('tailles', Math.round(f * 2) / 2, e); if (!GRAISSES.includes(cs.fontWeight)) note('graisses', cs.fontWeight, e); }
    const rad = parseFloat(cs.borderTopLeftRadius); const bg = rgba(cs.backgroundColor);
    if (rad > 0 && !String(cs.borderTopLeftRadius).includes('%') && rad < 900 && ((bg && bg.a > .02) || parseFloat(cs.borderTopWidth) > 0 || e.tagName === 'IMG') && !RAYONS.includes(Math.round(rad)) && !(rad >= e.getBoundingClientRect().height / 2 - 1) && !e.closest('.v2-etiquette')) note('rayons', Math.round(rad), e);   /* l'étiquette carton (signature) : coin coupé et rayon de 3, dessinés */
    for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) { const v = parseFloat(cs[p]); if (!v || isNaN(v) || v <= 2 || v > 64) continue;   /* > 64 : une réserve calculée (la pile du bas), pas un espacement */ const vv = Math.round(v * 2) / 2; if (vv % 4 !== 0) note('espaces', vv, e); } }
  out.horsEchelle = horsEchelle;
  out.nHorsEchelle = Object.values(horsEchelle).reduce((t, o) => t + Object.keys(o).length, 0);

  // ── 9. RANGÉES RÉGULIÈRES : contrôles d'une même rangée (± 2 px), rangées d'une même liste v2 (± 1 px) ──
  out.hauteurs = [];
  for (const p of visibles) { if (!dansEcran(p.getBoundingClientRect())) continue; const cs = getComputedStyle(p); if (!((cs.display.includes('flex') && !cs.flexDirection.startsWith('column')) || cs.display.includes('grid'))) continue;
    const enf = [...p.children].filter(vis).filter((e) => e.matches('button, a[href], [role="button"], input, select') && !e.matches('.v2-rangee, [data-v2-rangee]')).map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.height >= 24);
    if (enf.length < 2) continue;
    const lignes = []; for (const x of enf) { const c = (x.r.top + x.r.bottom) / 2; const l = lignes.find((L) => Math.abs(L.c - c) < Math.min(L.h, x.r.height) / 2); if (l) l.m.push(x); else lignes.push({ c, h: x.r.height, m: [x] }); }
    for (const L of lignes) { if (L.m.length < 2) continue; const hs = L.m.map((x) => Math.round(x.r.height)); if (Math.max(...hs) - Math.min(...hs) > 2) out.hauteurs.push({ cls: String(p.className).slice(0, 40), hs, t: L.m.map((x) => txt(x.e).slice(0, 12)) }); } }
  out.listesInegales = [];
  for (const [sel, rangee] of [['.v2-liste-annonces', ':scope > [data-v2l]'], ['.v2-groupe[data-v2-en-route] .v2-liste', ':scope > .v2-ligne']]) {
    for (const l of document.querySelectorAll(sel)) { const hs = [...l.querySelectorAll(rangee)].filter(vis).map((e) => e.getBoundingClientRect()).filter((r) => r.bottom > 0 && r.top < H).map((r) => Math.round(r.height));
      if (hs.length >= 2 && Math.max(...hs) - Math.min(...hs) > 1) out.listesInegales.push({ sel, hs: [...new Set(hs)].slice(0, 6) }); } }

  // ── 10. CONTRASTE : les rectangles de texte à juger sur les PIXELS (le calcul est fait hors de la page) ──
  const barre = document.querySelector('.vrm-tabbar'); const basVisible = barre && vis(barre) ? barre.getBoundingClientRect().top - 40 : H;
  const dialogue = [...document.querySelectorAll('[role="dialog"], .vrm-fp, .v2-feuille')].filter(vis).pop() || null;
  out.textes = avecTexte.filter((e) => !dialogue || dialogue.contains(e)).map((e) => { const r = e.getBoundingClientRect(); if (!dansEcran(r) || r.width < 4 || r.height < 6) return null; const cs = getComputedStyle(e); if (Number(cs.opacity) < .99 || e.closest('[aria-disabled="true"], [disabled], .v2-bande-attente, [aria-hidden="true"]')) return null;
    let verre = 0; for (let p = e; p; p = p.parentElement) { const s = getComputedStyle(p); if (/gradient/.test(s.backgroundImage) || s.backgroundImage.includes('url(')) { verre = 1; break; } }
    let tr = null; try { const tn = [...e.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); const rg = document.createRange(); rg.selectNodeContents(tn); const rs = [...rg.getClientRects()].filter((q) => q.width > 1 && q.height > 4); if (rs.length) tr = rs[0]; } catch (_) {}
    if (!tr) return null; const fs = parseFloat(cs.fontSize), fw = Number(cs.fontWeight);
    return { dansBarre: !!e.closest('.vrm-tabbar, .v2-pouce'), t: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30), grand: fs >= 24 || (fs >= 18.66 && fw >= 700), verre, couvert: couvert(e), rect: { x: Math.round(tr.left), y: Math.round(tr.top), w: Math.round(Math.min(tr.width, W - tr.left)), h: Math.round(tr.height) } }; }).filter(Boolean).filter((x) => !x.couvert && x.rect.w > 2 && x.rect.y >= 0 && x.rect.y + x.rect.h <= Math.min(H, basVisible) || (x.rect.y >= basVisible && x.rect.y + x.rect.h <= H && x.dansBarre)).slice(0, 260);

  // ── 11. AUCUN NOMBRE DOUBLÉ sur le premier écran (deux contextes différents) ──
  const nombres = {};
  for (const e of avecTexte) { if (!main.contains(e)) continue; const r = e.getBoundingClientRect(); if (!dansEcran(r)) continue; const s = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
    if (e.closest('.v2-etiquette, [data-v2-etiquette], .vrm-num-plaque')) continue;   // un N° de carton est une identité, pas un compte
    if (e.closest('[data-v2b="principal"]')) continue;
    if (/^\s*·?\s*T\.?\s?\d{2}([,.]5)?\s*$/.test(s) || /\btaille\s+\d{2}\b/i.test(s) && e.closest('[data-v2l]')) continue;   // une TAILLE (T36) est un attribut de la paire, pas un compte   // le nombre du plein EST son geste (« Imprimer 15 ») ; l'écart nommé à côté est une autre chose
    for (const m of s.matchAll(/(\d[\d   ]{0,8}\d|\d)(?:[,.]\d+)?\s?(€|%)?/g)) { const brut = m[0].replace(/[\s  ]/g, ''); const dig = brut.replace(/\D/g, ''); if (dig.length < 2 && !m[2]) continue; if (/^(19|20)\d\d$/.test(dig)) continue; if (/\d{1,2}:\d{2}/.test(s)) continue;
      const ctx = String(e.className).split(/\s+/)[0] || e.parentElement.className; (nombres[brut] = nombres[brut] || []).push({ ctx, t: s.trim().slice(0, 30) }); } }
  out.doubles = Object.entries(nombres).map(([n, v]) => ({ n, ctxs: [...new Set(v.map((x) => x.ctx))], t: v.map((x) => x.t).slice(0, 3) })).filter((x) => x.ctxs.length >= 2);

  // ── 12. RIEN DE RÉPÉTÉ PAR RANGÉE (≥ 80 % des rangées d'une liste de 4 ou plus, liste vue dans les deux premiers écrans) ──
  out.repetes = [];
  for (const p of visibles) { const enf = [...p.children].filter(vis); if (enf.length < 4) continue; const r0 = enf[0].getBoundingClientRect(); if (r0.top > 2 * H || r0.bottom < 0) continue;
    const sig = (e) => e.tagName + '.' + [...e.classList].sort().join('.'); const cpt = {}; for (const e of enf) cpt[sig(e)] = (cpt[sig(e)] || 0) + 1; const [s, n] = Object.entries(cpt).sort((a, b) => b[1] - a[1])[0]; if (n < 4) continue;
    const rows = enf.filter((e) => sig(e) === s); const vus = {};
    for (const row of rows) { const set = new Set([...row.querySelectorAll('button, a[href], [role="button"], .v2l-lien, [data-v2l-relier]')].filter(vis).filter((b) => b !== row).map((b) => txt(b) || String(b.className).split(/\s+/)[0]).filter(Boolean));
      for (const x of row.querySelectorAll('*')) if (vis(x) && ownText(x) && /[a-zà-ÿ]{3}/i.test(x.textContent) && !/\d/.test(x.textContent)) set.add('« ' + x.textContent.trim().slice(0, 30) + ' »');
      for (const t of set) vus[t] = (vus[t] || 0) + 1; }
    for (const [t, k] of Object.entries(vus)) if (k >= Math.max(4, rows.length * .8)) out.repetes.push({ t, k, rows: rows.length, cls: s.slice(0, 50) }); }

  // ── 13. AMBRE = GESTE ; ROUGE = deux paires sous un N° ──
  out.ambres = []; out.rouges = [];
  for (const e of visibles) { if (!main.contains(e)) continue; const r = e.getBoundingClientRect(); if (!dansEcran(r)) continue; const cs = getComputedStyle(e);
    const amb = (ownText(e) && estAmbre(rgba(cs.color))) || estAmbre(rgba(cs.backgroundColor)) || (e.tagName === 'svg' && (estAmbre(rgba(cs.color)) || estAmbre(rgba(cs.stroke))));
    if (amb && (r.width < 4 || r.height < 4 || rogneTout(e))) continue;   // une boîte vide, repliée (rien ne se voit)
    if (amb) out.ambres.push({ t: txt(e).slice(0, 30) || (e.tagName.toLowerCase() + '.' + String(e.className).split(/\s+/)[0]), rect: R(r), geste: !!e.closest('[data-geste], [data-a-faire]'), rangee: (e.closest('[data-v2l], .v2-ligne, .v2-afaire-ligne, .v2-bande-carte, [data-fiche-ligne]') || {}).outerHTML ? 1 : 0, cle: e.closest('[data-v2l], .v2-ligne, .v2-afaire-ligne, .v2-bande-carte, [data-fiche-ligne]') });
    const rou = (ownText(e) && estRouge(rgba(cs.color))) || estRouge(rgba(cs.backgroundColor)) || estRouge(rgba(cs.borderTopColor)) && parseFloat(cs.borderTopWidth) > 0;
    if (rou && !e.closest('.is-double, [data-double], [data-v2-double]')) out.rouges.push({ t: txt(e).slice(0, 30), rect: R(r) }); }
  out.ambres = out.ambres.filter((a, i, A) => !A.some((b, j) => j !== i && b.rect.x <= a.rect.x && b.rect.y <= a.rect.y && b.rect.x + b.rect.w >= a.rect.x + a.rect.w && b.rect.y + b.rect.h >= a.rect.y + a.rect.h && b.rect.w * b.rect.h > a.rect.w * a.rect.h));
  const parRangee = new Map(); for (const a of out.ambres) if (a.cle) parRangee.set(a.cle, (parRangee.get(a.cle) || 0) + 1);
  out.ambreRangeeMax = Math.max(0, ...parRangee.values());
  out.ambres = out.ambres.map(({ cle, ...x }) => x);

  // ── 14. LA PILE DU BAS : les éléments fixes du bas ne se recouvrent pas ──
  const fixesBas = [...document.querySelectorAll('.vrm-tabbar, .v2-pouce, .vrm-acc, .vrm-acc-apres, .vrm-toasts > *, .v2-barre')].filter(vis).map((e) => ({ e, r: e.getBoundingClientRect(), pos: getComputedStyle(e).position })).filter((x) => /fixed|sticky/.test(x.pos) || x.e.closest('.vrm-toasts') || x.e.matches('.v2-pouce'));
  out.pileChevauche = [];
  for (let i = 0; i < fixesBas.length; i++) for (let j = i + 1; j < fixesBas.length; j++) { const a = fixesBas[i], b = fixesBas[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue; const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top); if (ix > 1 && iy > 1) out.pileChevauche.push([String(a.e.className).slice(0, 24), String(b.e.className).slice(0, 24), Math.round(iy)]); }
  const pouce = document.querySelector('.v2-pouce'); out.pouceHaut = pouce && vis(pouce) && getComputedStyle(pouce).position === 'fixed' ? Math.round(pouce.getBoundingClientRect().top) : null;

  // ── 15. RIEN SUR LE TITRE ──
  const h1 = [...main.querySelectorAll('h1')].find(vis);
  out.titre = null; out.surTitre = [];
  if (h1) { const r = h1.getBoundingClientRect(); out.titre = { t: txt(h1), rect: R(r) };
    const rg = document.createRange(); rg.selectNodeContents(h1); for (const q of [...rg.getClientRects()].filter((x) => x.width > 2)) for (const fx of [.1, .5, .9]) { const x = q.left + q.width * fx, y = q.top + q.height / 2; if (x < 0 || y < 0 || x >= W || y >= H) continue; const t = document.elementFromPoint(x, y); if (t && !(t === h1 || h1.contains(t) || t.contains(h1))) out.surTitre.push(String(t.className).slice(0, 40) || t.tagName); } }

  // ── 17. TRAITS DES ICÔNES (épaisseur rendue) ──
  const traits = {};
  for (const s of document.querySelectorAll('svg')) { if (!vis(s) || !dansPerimetre(s)) continue; const r = s.getBoundingClientRect(); if (!dansEcran(r) || r.width > 64 || r.width < 8) continue; const el = s.querySelector('path, circle, rect, line, polyline'); if (!el) continue; const cs = getComputedStyle(el); if (!cs.stroke || cs.stroke === 'none') continue; const sw = parseFloat(cs.strokeWidth); if (!sw) continue;
    const vb = (s.viewBox && s.viewBox.baseVal && s.viewBox.baseVal.width) || r.width; const eff = cs.vectorEffect === 'non-scaling-stroke' ? sw : sw * r.width / vb; const k = Math.round(eff * 4) / 4; traits[k] = (traits[k] || 0) + 1; (out.traitsOu = out.traitsOu || {})[k] = out.traitsOu[k] || String((s.parentElement || {}).className || '').slice(0, 30); }
  out.traits = traits;

  // ── 18. ANTI-GÉNÉRIQUE : emoji, verre hors coque, dégradés dans .v2-*, ombre sur une rangée ──
  const emo = []; let verreHors = [], degV2 = [], ombreRangee = [];
  // Un RESTE DE CODE rendu en texte (« ))} », « {x} », « undefined », « [object Object] ») : 18 aussi.
  const restes = avecTexte.filter((e) => { const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); return /^[)}\]({[]{2,}$/.test(t) || /\{[a-zA-Z_]+\}|\bundefined\b|\bNaN\b|\[object Object\]/.test(t); }).map((e) => e.textContent.trim().slice(0, 30));
  for (const e of avecTexte) { const m = e.textContent.match(/\p{Extended_Pictographic}/u); if (m && !/[©®™↗→←↑↓›‹✓✕×]/.test(m[0])) emo.push(m[0] + ' ' + e.textContent.trim().slice(0, 20)); }
  for (const e of visibles) { if (!dansEcran(e.getBoundingClientRect())) continue; const cs = getComputedStyle(e);
    if (cs.backdropFilter && cs.backdropFilter !== 'none' && !e.closest('.vrm-tabbar, .vrm-app-header, .sb-plan, .v2-feuille, .v2-voile, .vrm-barre-haut, .v2-pouce, .vrm-acc, .vrm-toasts, .v2-barre, nav')) verreHors.push(String(e.className).slice(0, 30));
    if (estV2(e) && /linear-gradient/.test(cs.backgroundImage) && !e.closest('.v2-ticket, .v2-pouce, .v2-squelette, [class*="squelette"], .vrm-app-header')) degV2.push(String(e.className).slice(0, 30));
    if (e.matches('[data-v2l], .v2-ligne, .v2-afaire-ligne, .vrm-buy-row') && cs.boxShadow && cs.boxShadow !== 'none') ombreRangee.push(String(e.className).slice(0, 30)); }
  out.ia = { restesCode: [...new Set(restes)].slice(0, 6), emoji: [...new Set(emo)].slice(0, 6), verreHors: [...new Set(verreHors)].slice(0, 6), degV2: [...new Set(degV2)].slice(0, 6), ombreRangee: ombreRangee.length };
  out.debord = document.documentElement.scrollWidth - W;
  return out;
}
