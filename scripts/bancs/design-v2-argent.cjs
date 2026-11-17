require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ARGENT ET PARAMÈTRES, NOUVEAU DESIGN (17 nov., phase 2) — src/designV2/ArgentMois.jsx, ArgentNav (App.jsx),
//  argent-v2.css, Reglages.jsx (liste groupée d'iOS). Réglage RÉEL `vrm_design_v2`.
//      npm run build && node scripts/bancs/design-v2-argent.cjs
//  Base INVENTÉE (le jeu de `nouveau-vendeur` + versements lus, micro-entrepreneur mensuel — le scénario B
//  d'argent.cjs). Tailles : 390 tactile sombre et clair, 1512 clair et sombre (`TAILLES=` restreint).
//  Mesure, par taille :
//    F  LES CHIFFRES, ÉTEINT = ALLUMÉ, sur la même base : REÇU (l'affiche = la case « Reçu » d'hier), le mois en
//       cours du graphe = l'affiche, BÉNÉFICE (la case d'hier, le net ou le brut), VENDU (« Comparer » de
//       Statistiques), URSSAF (à payer et chiffre d'affaires de la carte de Déclarer) ; le geste plein existe
//       SI ET SEULEMENT SI la porte « prix à saisir » d'hier existe, avec le même nombre ;
//    S  la structure : grand titre « Argent », UNE ligne comptes, UN segmenté de 4 (Mois · Statistiques ·
//       Déclarer · Factures), le segment allumé est le bon sur les quatre écrans ; l'affiche dit « reçus en » ;
//       graphe ≤ 80 px ; 4 faits ; versements en rangées, l'étiquette N° sur celles qui ont un N° ;
//    P  exactement UN bouton plein sur Mois quand il y a un geste, au plus un ailleurs ;
//    T  cibles ≥ 44 × 44 ; X aucun texte tronqué sans « … », rien ne déborde ; C contraste ≥ 4,5:1 (3:1 en grand) ;
//    R  Paramètres : sections à en-tête 13/600, rangées icône + nom + valeur + chevron ≥ 44, séparateurs indentés ;
//    O  ÉTEINT, RIEN NE CHANGE : signature DOM (balises, classes, noms des data-*) d'Argent (Mois, Déclarer),
//       Statistiques et Paramètres identique à celle du build de référence (`BANC_JSON=f` l'écrit ;
//       `BANC_REFERENCE=f` l'exige — lancer d'abord sur le build de origin/claude/design-v2).
//  `SHOTS=dossier` garde les captures (regarde-les). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-v2-argent');
fs.mkdirSync(SHOTS, { recursive: true });
// `375:clair` : un iPhone plus étroit ; `390:clair:tres` : le réglage « Très grand » de la taille du texte.
const TAILLES = String(process.env.TAILLES || '390:sombre,390:clair,375:clair,390:sombre:tres,1512:clair,1512:sombre').split(',').map((x) => { const [w, t, g] = x.split(':'); return { W: Number(w), sombre: t === 'sombre', tres: g === 'tres' }; });
const JSON_OUT = process.env.BANC_JSON || '';
const REF = process.env.BANC_REFERENCE ? JSON.parse(fs.readFileSync(process.env.BANC_REFERENCE, 'utf8')) : null;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

// ── LA BASE (le scénario B d'argent.cjs) ─────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const txn = (uid, tx, jVerse) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(jVerse) } } } });
const jeu = () => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v2 = L.find((r) => r.id === 'harvest_222_orders_sold');
  v2.data.payload.my_orders.push({ transaction_id: 62006, title: 'Asics Gel-1130 argent taille 42', price: { amount: '70', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(12), photo: null });
  // + des versements d'octobre et de septembre (la déclaration d'octobre a un chiffre d'affaires), et un titre très long.
  v2.data.payload.my_orders.push(
    { transaction_id: 62010, title: 'Adidas Gazelle bleue taille 40', price: { amount: '64', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(38), photo: null },
    { transaction_id: 62011, title: 'New Balance 550 blanche taille 43', price: { amount: '88', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(66), photo: null },
    { transaction_id: 62012, title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red édition anniversaire taille 43', price: { amount: '129', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(4), photo: null });
  L.push(txn(222, 62005, 6), txn(111, 62002, 4), txn(222, 62010, 33), txn(222, 62011, 61), txn(222, 62012, 1));
  const main = L.find((r) => r.id === 'main');
  // Un prix d'achat saisi sur la fiche de la vente 62012 (par identité : son annonce 562012) ⇒ « acheté 60 € → +69 € ».
  main.data.vinted_annonce_numeros = { ...(main.data.vinted_annonce_numeros || {}), 562012: { numero: '21', buyPrice: '60' } };
  main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel'; main.data.vrm_urssaf_declare = {};
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};

const CONTRASTE = `(() => {
  const rgba = (t) => { t = String(t || ''); const m = t.match(/^rgba?\\(([^)]+)\\)$/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = t; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } catch (_) { return null; } };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const jeton = (v) => { const d = document.createElement('i'); d.style.color = 'var(' + v + ')'; document.body.appendChild(d); const c = rgba(getComputedStyle(d).color); d.remove(); return c; };
  const fond = (el) => { const couches = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { couches.push(c); if (c.a >= 0.99) break; } }
    const lum0 = (() => { const v = jeton('--sv-haut'); return v && v.a > 0 ? v : jeton('--sb-bas'); })(); let f = couches.length && couches[couches.length - 1].a >= 0.99 ? couches.pop() : lum0; for (let i = couches.length - 1; i >= 0; i--) f = sur(couches[i], f); return f; };
  return { rgba, sur, ratio, jeton, fond };
})()`;

// La signature d'un écran : balises, classes triées et NOMS des data-* (jamais les valeurs ni le texte : l'heure bouge).
const SIGNATURE = () => { const m = document.querySelector('.vrm-main'); if (!m) return null; const out = [];
  const pas = (e, d) => { if (d > 60 || e.matches('.vrm-fraicheur-hote, [data-temps-reel-neuf], [data-fraicheur-unique], [data-geste-disque], .vrm-toast, .vrm-settings-status')) return; const cl = [...e.classList].sort().join('.'); const da = [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-') && !/^data-(sb-|vu$)/.test(n)).sort().join(',');
    out.push(d + ':' + e.tagName + (cl ? '.' + cl : '') + (da ? '[' + da + ']' : '')); for (const c of e.children) pas(c, d + 1); };
  pas(m, 0); return out.join('\n'); };

const aller = async (pg, q, attente = 3200) => {
  await pg.goto(`http://localhost:${NV.PORT}/?${q.includes('=') ? q : 'tab=' + q}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(attente);
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  await pg.waitForTimeout(300);
};
const capture = async (pg, nom) => { await pg.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollTop) e.scrollTop = 0; }); await pg.waitForTimeout(250); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }); };
// La signature RELEVÉE STABLE : deux relevés égaux à 1,5 s d'écart (une lecture encore en cours change un état, pas le code).
const sigStable = async (pg) => { let a = await pg.evaluate(SIGNATURE); for (let i = 0; i < 5; i++) { await pg.waitForTimeout(1500); const b = await pg.evaluate(SIGNATURE); if (b === a) return a; a = b; } return a; };
const allumer = (pg, on) => pg.evaluate((x) => { if (x) localStorage.setItem('vrm_design_v2', '1'); else localStorage.removeItem('vrm_design_v2'); }, on);

// Les chiffres d'hier (éteint) et ceux du nouvel écran (allumé), lus sur les data-* de LEURS règles.
const lireAvant = (pg) => pg.evaluate(() => {
  const at = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; };
  const brut = document.querySelector('[data-argent-q="benefice"] [data-benef-notion="brut"], [data-argent-q="benefice"] .vg-a-brut');
  return { recu: at('[data-argent-q="recu"]', 'data-argent-valeur'), recuPartiel: at('[data-argent-q="recu"]', 'data-argent-partiel') === '1',
    benefice: at('[data-argent-q="benefice"]', 'data-argent-valeur'), brut: brut ? brut.textContent.replace(/\s/g, '') : null,
    porte: at('[data-benef-porte]', 'data-benef-manque'), apayer: at('[data-prevision-carte]', 'data-prevision-apayer'), ca: at('[data-prevision-carte]', 'data-prevision-ca') };
});
const lireApres = (pg) => pg.evaluate(() => {
  const at = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; };
  const b = document.querySelector('[data-v2-argent-fait="benefice"]');
  return { recu: at('[data-v2-argent-recu]', 'data-v2-argent-recu'), recuPartiel: at('[data-v2-argent-recu]', 'data-v2-argent-partiel') === '1',
    barres: at('[data-v2-argent-barres]', 'data-v2-argent-barres'), benefice: b ? b.getAttribute('data-v2-argent-valeur') : null, beneficeTexte: b ? b.querySelector('.v2-ar-fait-v').textContent.replace(/\s/g, '') : null,
    geste: at('[data-v2-argent-geste]', 'data-v2-argent-geste'), apayer: at('[data-prevision-carte]', 'data-prevision-apayer'), ca: at('[data-prevision-carte]', 'data-prevision-ca') };
});
const lireVendu = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-comparer-ligne="vendu"]'); return e ? e.getAttribute('data-a') : null; });

// Les mesures communes d'un écran allumé, sur les zones du nouveau design.
async function mesurer(pg, nom, zonesSel) {
  const r = await pg.evaluate(([src, zonesSel]) => { const K = eval(src);
    const zones = [...document.querySelectorAll(zonesSel)];
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const boutons = zones.flatMap((z) => z.matches('button') ? [z] : [...z.querySelectorAll('button')]).filter(vis);
    const petits = boutons.filter((b) => b.offsetHeight < 44 || b.offsetWidth < 44).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30) + ':' + b.offsetWidth + 'x' + b.offsetHeight);
    const rogne = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const st = getComputedStyle(p); if (st.clipPath === 'inset(50%)' || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(st.clip)) return true; } return false; };
    const textes = zones.flatMap((z) => [z, ...z.querySelectorAll('*')]).filter(vis).filter((e) => !rogne(e)).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const tronques = textes.filter((e) => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && /hidden|clip/.test(cs.overflowX) && e.clientWidth > 0; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 30));
    const coupes = textes.filter((e) => { const cs = getComputedStyle(e); return cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && !e.closest('.v2-ar-v-titre, .v2-ar-v-date'); }).map((e) => e.textContent.trim().slice(0, 30));
    // Un mot coupé en deux (titre, montant) : une ligne qui commence au milieu d'un mot (Range par caractère).
    const coupesMot = textes.filter((e) => !e.closest('.vg-sr') && !/@/.test(e.textContent)).flatMap((e) => [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 3).map((n) => { const t = n.textContent; const r = document.createRange(); let y0 = null, cut = null;
      for (let i = 0; i < t.length; i++) { r.setStart(n, i); r.setEnd(n, i + 1); const q = r.getClientRects()[0]; if (!q) continue; if (y0 != null && q.top > y0 + 4 && i > 0 && /\S/.test(t[i - 1]) && /\S/.test(t[i]) && !/[-–—\/·]/.test(t[i - 1])) { cut = t.slice(Math.max(0, i - 8), i) + '|' + t.slice(i, i + 8); break; } y0 = q.top; }
      return cut; }).filter(Boolean));
    const W = innerWidth; const deb = document.documentElement.scrollWidth - W;
    const defilant = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true; } return false; };
    const hors = textes.filter((e) => !defilant(e)).filter((e) => { const q = e.getBoundingClientRect(); return q.right > W + 1 || q.left < -1; }).map((e) => e.textContent.trim().slice(0, 30));
    const contrastes = textes.map((e) => { const cs = getComputedStyle(e); const c = K.rgba(cs.color); if (!c) return null; const f = K.fond(e); const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      if (Number(cs.opacity) === 0) return null; return { t: e.textContent.trim().slice(0, 24), r: Math.round(K.ratio(K.sur(c, f), f) * 100) / 100, min: big ? 3 : 4.5 }; }).filter(Boolean);
    const faibles = contrastes.filter((x) => x.r < x.min);
    const pleinFond = K.jeton('--v2-plein-fond'); const memeFond = (e) => { const c = K.rgba(getComputedStyle(e).backgroundColor); return c && pleinFond && c.a > .9 && Math.abs(c.r - pleinFond.r) + Math.abs(c.g - pleinFond.g) + Math.abs(c.b - pleinFond.b) < 12; };
    const pleins = [...document.querySelectorAll('[data-v2b="principal"], .sb-btn-plein, .vrm-main .vrm-b-primaire')].filter(vis).filter((e) => e.matches('[data-v2b="principal"], .sb-btn-plein') || memeFond(e)).filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.width > 0; }).map((e) => e.textContent.trim().slice(0, 30));
    return { nZones: zones.length, n: boutons.length, petits, tronques, coupes, coupesMot, deb, hors, nTextes: contrastes.length, faibles, pleins, minC: contrastes.length ? Math.min(...contrastes.map((x) => x.r)) : null };
  }, [CONTRASTE, zonesSel]);
  dit(r.nZones > 0, `${nom} : le nouveau design est rendu (${r.nZones} zones)`);
  dit(!r.petits.length, `T ${nom} : ${r.n} boutons, tous ≥ 44 × 44`, r.petits);
  dit(!r.tronques.length && !r.coupes.length && !r.coupesMot.length, `X ${nom} : aucun texte tronqué, aucun mot coupé en deux`, { t: r.tronques, c: r.coupes, m: r.coupesMot });
  dit(r.deb <= 1 && !r.hors.length, `X ${nom} : rien ne déborde de l’écran`, { deb: r.deb, hors: r.hors });
  dit(r.nTextes > 0 && !r.faibles.length, `C ${nom} : ${r.nTextes} textes au contraste suffisant (min ${r.minC})`, r.faibles);
  return r;
}


// ── AIR (17 nov. soir, Julien : « c'est trop compacté ») : l'échelle d'espacement, mesurée sur ce qui est RENDU. ──
//   texte ≥ 20 px du bord de SA carte ; 16 px entre deux cartes voisines (0 = une liste groupée collée) ;
//   ≥ 12 px entre deux boutons voisins, jamais 3 boutons ou plus sur une rangée ; rangée de liste ≥ 64 px ; interligne ≥ 1,35.
async function air(pg, nom, racineSel) {
  const r = await pg.evaluate((racineSel) => {
    const racines = [...document.querySelectorAll(racineSel)].filter((e) => e.getClientRects().length);
    const ferme = (e) => { for (let p = e; p; p = p.parentElement) { const d = p.parentElement; if (d && d.tagName === 'DETAILS' && !d.open && p.tagName !== 'SUMMARY') return true; } return false; };
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && !ferme(e);
    const EXCLU = 'button, a, input, select, textarea, .v2-seg, .vrm-seg, .v2-etiquette, .v2-ar-barre, .vrm-tabbar, .v2-sq, svg, img, [role="progressbar"], .vrm-av-barre, .vrm-jauge, [data-jauge]';
    const estCarte = (e) => { if (e.matches(EXCLU) || e.closest('button, a, .vrm-tabbar')) return false; const cs = getComputedStyle(e); if (!(parseFloat(cs.borderTopLeftRadius) >= 12 || parseFloat(cs.borderBottomLeftRadius) >= 12)) return false;
      const bg = cs.backgroundColor; const fond = !/rgba\(0, 0, 0, 0\)|transparent/.test(bg) || cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none'); if (!fond) return false;
      const q = e.getBoundingClientRect(); return q.width >= 200 && q.height >= 40; };
    const cartes = racines.flatMap((z) => [...z.querySelectorAll('*')]).filter(vis).filter(estCarte);
    const set = new Set(cartes);
    const carteDe = (n) => { for (let p = n.parentElement; p; p = p.parentElement) if (set.has(p)) return p; return null; };
    const serres = [];
    const marcher = (z) => { const w = document.createTreeWalker(z, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || !vis(el) || el.closest('.vg-sr, .vrm-sr-seul, button, .v2-seg, .vrm-seg, select, input')) continue;
      const c = carteDe(n); if (!c) continue; const r0 = document.createRange(); r0.selectNodeContents(n); const rs = [...r0.getClientRects()].filter((q) => q.width > 1 && q.height > 1); if (!rs.length) continue;
      const C = c.getBoundingClientRect(); for (const q of rs) { const d = Math.min(q.left - C.left, C.right - q.right, q.top - C.top, C.bottom - q.bottom); if (d < 19.5 && d > -400) { serres.push({ t: n.textContent.trim().slice(0, 24), d: Math.round(d), c: String(c.className || c.tagName).slice(0, 40) }); break; } } } };
    racines.forEach(marcher);
    const ecarts = [];
    for (const c of cartes) { const s = c.nextElementSibling; if (!s || !set.has(s)) continue; const g = s.getBoundingClientRect().top - c.getBoundingClientRect().bottom; if (g > 0.5 && g < 15.5) ecarts.push({ g: Math.round(g), c: String(c.className).slice(0, 30) }); }
    const boutons = racines.flatMap((z) => [...z.querySelectorAll('button, a.vrm-b')]).filter(vis).filter((b) => !b.closest('.v2-seg, .vrm-seg, .v2-ar-barres, [role="radiogroup"], .vrm-tabbar, .v2-ar-faits, .v2-ar-liste, .v2-pm-liste, summary') && b.getBoundingClientRect().width > 0);
    const boites = boutons.map((b) => ({ b, q: b.getBoundingClientRect() }));
    const pres = [], rangees = [];
    for (const x of boites) { const memes = boites.filter((y) => y !== x && Math.min(x.q.bottom, y.q.bottom) - Math.max(x.q.top, y.q.top) > Math.min(x.q.height, y.q.height) * 0.5 && x.b.parentElement && (x.b.closest('div,span,section') === y.b.closest('div,span,section')));
      for (const y of memes) { const g = y.q.left - x.q.right; if (g >= -1 && g < 11.5) pres.push((x.b.textContent || x.b.getAttribute('aria-label') || '').trim().slice(0, 16) + '|' + (y.b.textContent || y.b.getAttribute('aria-label') || '').trim().slice(0, 16) + ':' + Math.round(g)); }
      if (memes.length >= 2) rangees.push((x.b.textContent || '').trim().slice(0, 16)); }
    const lignes = racines.flatMap((z) => [...z.querySelectorAll('.v2-ar-v, .v2-pm-rangee, .vrm-set-ligne, details.vrm-compta-repli > summary, details.vrm-micro-repli > summary')]).filter(vis).map((e) => ({ t: (e.textContent || '').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h > 0 && x.h < 63.5);
    const interligne = racines.flatMap((z) => [...z.querySelectorAll('p')]).filter(vis).map((e) => { const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize); return { t: e.textContent.trim().slice(0, 20), r: lh && fs ? Math.round(lh / fs * 100) / 100 : 1.5 }; }).filter((x) => x.r < 1.35);
    return { n: cartes.length, serres, ecarts, pres: [...new Set(pres)], rangees: [...new Set(rangees)], lignes, interligne };
  }, racineSel);
  dit(r.n > 0 && !r.serres.length, `A ${nom} : ${r.n} cartes, aucun texte à moins de 20 px de leur bord`, r.serres.slice(0, 8));
  dit(!r.ecarts.length, `A ${nom} : 16 px entre deux cartes voisines (ou collées en liste groupée)`, r.ecarts.slice(0, 6));
  dit(!r.pres.length && !r.rangees.length, `A ${nom} : ≥ 12 px entre deux boutons, aucune rangée de 3 boutons ou plus`, { pres: r.pres.slice(0, 6), rangees: r.rangees.slice(0, 6) });
  dit(!r.lignes.length, `A ${nom} : rangées de liste ≥ 64 px`, r.lignes.slice(0, 6));
  dit(!r.interligne.length, `A ${nom} : interligne du texte ≥ 1,35`, r.interligne.slice(0, 6));
  return r;
}

const ZONES_ARGENT = '.v2-argent, .v2-argent-nav, .vrm-screen-head:has(.v2-argent-nav)';

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const releve = {};
  try {
    for (const { W, sombre, tres } of TAILLES) {
      const T = `${W} ${sombre ? 'sombre' : 'clair'}${tres ? ' très grand' : ''}`, tel = W < 600, th = (sombre ? 'sombre' : 'clair') + (tres ? '-tres' : '');
      console.log(`\n── ${T}`);
      const o = await NV.ouvrir(nav, { W, sombre, base: jeu(), tab: 'journee' });
      const pg = o.pg;
      if (tel && W !== 390) await pg.setViewportSize({ width: W, height: 812 });
      if (tres) await pg.evaluate(() => localStorage.setItem('vrm_taille_texte', 'tresGrand'));
      try {
        // ── ÉTEINT : les chiffres d'hier et les signatures ──
        await allumer(pg, false);
        await aller(pg, 'cat_ventes', 4500);
        await aller(pg, 'dashboard', 3600);
        const venduAvant = await lireVendu(pg);
        const sigs = { stats: await sigStable(pg) };
        await aller(pg, 'compta', 3600);
        const avant = await lireAvant(pg);
        sigs.mois = await sigStable(pg);
        await aller(pg, 'argent_declarer', 3000); sigs.declarer = await sigStable(pg);
        await aller(pg, 'settings', 2500); sigs.settings = await sigStable(pg);
        releve[T] = sigs;
        if (REF && REF[T]) for (const k of Object.keys(REF[T])) {
          const a = String(REF[T][k] || '').split('\n'), b = String(sigs[k] || '').split('\n');
          const i = a.findIndex((x, j) => x !== b[j]);
          dit(REF[T][k] === sigs[k], `O ${T} ${k} : éteint, la signature DOM est celle de la référence (${b.length} nœuds)`, i < 0 ? `longueurs ${a.length}/${b.length}` : `1re différence au nœud ${i} : réf « ${a[i]} » / ici « ${b[i]} »`);
        }
        // ── ALLUMÉ ──
        await allumer(pg, true);
        await aller(pg, 'compta', 4200);
        const apres = await lireApres(pg);
        console.log('     avant', JSON.stringify(avant), '\n     après', JSON.stringify(apres));
        dit(avant.recu != null && apres.recu === avant.recu && apres.recuPartiel === avant.recuPartiel, `F ${T} : REÇU — l’affiche = la case « Reçu » d’hier (${avant.recu} c${avant.recuPartiel ? ', au moins' : ''})`, { avant: avant.recu, apres: apres.recu });
        dit(apres.barres != null && apres.barres.split(',').length === 6 && apres.barres.split(',')[5] === (apres.recu || ''), `F ${T} : le mois en cours du graphe = l’affiche (${apres.barres})`, apres.barres);
        dit(avant.benefice != null && (avant.benefice === '' ? (avant.brut ? apres.beneficeTexte === avant.brut : apres.benefice === '') : apres.benefice === avant.benefice), `F ${T} : BÉNÉFICE — le même que la case d’hier (${avant.benefice || avant.brut || '—'})`, { avant, apres });
        dit((avant.porte == null && apres.geste == null) || (avant.porte != null && apres.geste === avant.porte), `F ${T} : le geste plein existe si et seulement si la porte « prix à saisir » d’hier existe, au même nombre (${avant.porte} / ${apres.geste})`);
        const s = await pg.evaluate(() => {
          const vis = (e) => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');
          const h = [...document.querySelectorAll('.vrm-main h1, .vrm-main h2.vrm-display')].find(vis);
          const navs = [...document.querySelectorAll('.v2-argent-nav')].filter(vis);
          const segs = navs[0] ? [...navs[0].querySelectorAll('[data-section]')].map((b) => ({ id: b.getAttribute('data-section'), on: b.getAttribute('aria-selected') === 'true', l: b.textContent.trim(), w: Math.round(b.getBoundingClientRect().width), y: Math.round(b.getBoundingClientRect().top) })) : [];
          const segBox = navs[0] && navs[0].querySelector('.v2-seg'); const segL = segBox ? Math.round(segBox.getBoundingClientRect().width) : 0; const mainL = Math.round(document.querySelector('.v2-ar-faits') ? document.querySelector('.v2-ar-faits').getBoundingClientRect().width : 0);
          const vMarge = [...document.querySelectorAll('[data-v2-argent-achat]')].map((e) => ({ a: e.getAttribute('data-v2-argent-achat'), m: e.getAttribute('data-v2-argent-marge'), t: e.textContent.trim() }));
          const etiq = [...document.querySelectorAll('[data-v2-argent-versement] .v2-etiquette')].length;
          const barV = [...document.querySelectorAll('[data-v2-argent-barre-v]')].map((e) => e.textContent.trim());
          const faitsH = [...document.querySelectorAll('[data-v2-argent-fait]')].map((e) => ({ h: Math.round(e.getBoundingClientRect().height), y: Math.round(e.getBoundingClientRect().top) }));
          const fig = document.querySelector('.v2-ar-barres'); const af = document.querySelector('.v2-ar-affiche');
          const vers = [...document.querySelectorAll('[data-v2-argent-versement]')].filter(vis);
          const txt = document.querySelector('.vrm-main').innerText;
          return { titre: h ? h.textContent.trim() : '', nNav: navs.length, comptes: navs[0] ? !!navs[0].querySelector('[data-v2-argent-comptes]') : false, segs, affiche: af ? af.textContent.replace(/\s+/g, ' ').trim() : '',
            afficheTaille: af ? parseFloat(getComputedStyle(af.querySelector('.v2-affiche-sig-n')).fontSize) : 0, graphe: fig ? Math.round(fig.getBoundingClientRect().height / (parseFloat(getComputedStyle(document.documentElement).zoom) || 1)) : null,
            faits: document.querySelectorAll('[data-v2-argent-fait]').length + ((document.querySelector('[data-v2-argent-passu]') || { getAttribute: () => '' }).getAttribute('data-v2-argent-passu') || '').split(' ').filter(Boolean).length, faitsTiret: [...document.querySelectorAll('[data-v2-argent-fait] [data-v2-pas-su]')].length, vers: vers.length, versN: vers.filter((v) => v.querySelector('.v2-etiquette')).length, segL, mainL, vMarge, etiq, barV, faitsH,
            versNum: vers.filter((v) => v.tagName === 'BUTTON').length, ancienVisible: [...document.querySelectorAll('[data-argent-questions]')].some(vis),
            encaisse: /encaiss/i.test(txt), auMoins0: /au moins 0[,\s]*0?0?\s*€/i.test(txt), nan: /\bNaN\b|undefined|Invalid Date/.test(txt) };
        });
        console.log('     structure', JSON.stringify(s));
        dit(s.titre === 'Argent' && s.nNav === 1 && s.comptes, `S ${T} : « Argent », puis UNE ligne comptes`, s);
        dit(s.segs.length === 4 && s.segs.map((x) => x.l).join('·') === 'Mois·Statistiques·Déclarer·Factures' && s.segs.filter((x) => x.on).map((x) => x.id).join() === 'resume', `S ${T} : UN segmenté Mois · Statistiques · Déclarer · Factures, « Mois » allumé`, s.segs);
        dit(tres ? Math.abs(s.segL - s.mainL) <= 1 && new Set(s.segs.map((x) => x.y)).size === 1 : tel ? Math.abs(s.segL - s.mainL) <= 1 && new Set(s.segs.map((x) => x.w)).size === 1 : s.segL >= 520 && new Set(s.segs.map((x) => x.w)).size === 1, `S ${T} : le segmenté prend toute la largeur (${s.segL} px / contenu ${s.mainL}), segments égaux (${s.segs.map((x) => x.w).join('/')})`, s);
        dit(s.barV.length === 1 && /€/.test(s.barV[0]), `S ${T} : le montant écrit au-dessus d’UNE barre seulement (« ${s.barV.join(' | ')} »)`, s.barV);
        dit(s.vMarge.length >= 1 && s.vMarge.some((x) => x.a === '6000' && x.m === '6900' && /acheté 60/.test(x.t) && /\+69/.test(x.t)), `S ${T} : « acheté 60 € → +69 € » sur la vente au prix d’achat connu, rien sur les autres (${s.vMarge.length})`, s.vMarge);
        dit([...new Set(s.faitsH.map((f) => f.y))].every((y) => new Set(s.faitsH.filter((f) => f.y === y).map((f) => f.h)).size === 1), `F ${T} : les faits d’une même rangée ont la même hauteur (${s.faitsH.map((f) => f.h).join('/')})`, s.faitsH);
        dit(/reçus en/.test(s.affiche) && s.afficheTaille >= 56, `S ${T} : l’affiche « ${s.affiche} » en ${s.afficheTaille} px`, s.affiche);
        dit(s.graphe != null && s.graphe <= 80, `S ${T} : le graphe tient en ${s.graphe} px (≤ 80)`, s.graphe);
        dit(s.faits === 4 && s.faitsTiret === 0, `S ${T} : 4 faits (disponible, en attente, bénéfice, coûts saisis) — aucune carte « — » (un fait pas su est nommé sur une ligne)`, s);
        dit(s.vers > 0 && s.versN === s.versNum, `S ${T} : ${s.vers} versements en rangées, l’étiquette N° sur les ${s.versN} qui ont un N°`, s);
        dit(!s.ancienVisible, `S ${T} : l’écran d’hier (les quatre réponses) n’est pas montré en double`);
        dit(!s.encaisse && !s.auMoins0 && !s.nan, `S ${T} : jamais « encaissé », jamais « au moins 0 », ni NaN`, s);
        const mm = await mesurer(pg, `Mois ${T}`, ZONES_ARGENT);
        dit(apres.geste != null ? mm.pleins.length === 1 : mm.pleins.length === 0, `P Mois ${T} : ${apres.geste != null ? 'exactement UN' : 'aucun'} bouton plein (${mm.pleins.join(' | ') || 'aucun'})`, mm.pleins);
        await air(pg, `Mois ${T}`, '.vrm-argent [data-argent-vue="resume"]');
        await capture(pg, `argent-mois-${W}-${th}`);
        // ── Q · QUALITÉ ET FLUIDITÉ ──
        // Q1 la réponse au toucher : un fait enfoncé change de fond en moins de 100 ms (sans déclencher le geste).
        const bF = await pg.$('[data-v2-argent-fait]'); const rF = bF && await bF.boundingBox();
        const fondDe = () => pg.evaluate(() => getComputedStyle(document.querySelector('[data-v2-argent-fait]')).backgroundColor);
        let q1 = null;
        if (rF) { const a = await fondDe(); await pg.mouse.move(rF.x + 20, rF.y + 20); await pg.mouse.down(); await pg.waitForTimeout(60); const p = await fondDe(); await pg.mouse.move(2, 2); await pg.mouse.up(); q1 = { a, p }; }
        dit(q1 && q1.a !== q1.p, `Q ${T} : un fait répond au toucher en < 100 ms (fond ${q1 && q1.a} → ${q1 && q1.p})`, q1);
        // Q2 finition : tailles de texte et rayons du nouvel écran.
        const fin = await pg.evaluate(() => {
          const z = [...document.querySelectorAll('.v2-argent, .v2-argent-nav')]; const vis = (e) => e.getClientRects().length;
          const tailles = new Set(), rayons = new Set();
          for (const e of z.flatMap((x) => [x, ...x.querySelectorAll('*')]).filter(vis)) { if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) tailles.add(parseFloat(getComputedStyle(e).fontSize)); }
          for (const e of document.querySelectorAll('.v2-ar-faits, .v2-ar-liste, .v2-ar-vide, .v2-argent-nav .v2-seg, .v2-ar-geste button')) rayons.add(parseFloat(getComputedStyle(e).borderTopLeftRadius));
          return { tailles: [...tailles].sort((a, b) => a - b), rayons: [...rayons].sort((a, b) => a - b) };
        });
        dit(fin.tailles.every((t) => [10, 13, 14, 15, 17, 22, 32, 34, 56].includes(t)), `Q ${T} : texte en 13 · 15 · 17 (+ chiffres 22 · 56, étiquette 10/14) — ${fin.tailles.join(', ')}`, fin.tailles);
        dit(fin.rayons.every((r) => [12, 14, 20].includes(r)), `Q ${T} : rayons des cartes et contrôles ∈ {12, 14, 20} — ${fin.rayons.join(', ')}`, fin.rayons);
        // Q3 mouvement réduit : ni fondu d'arrivée, ni reflet du squelette.
        await pg.emulateMedia({ reducedMotion: 'reduce' });
        const rm = await pg.evaluate(() => getComputedStyle(document.querySelector('.v2-ar-mois')).animationName);
        await pg.emulateMedia({ reducedMotion: 'no-preference' });
        dit(rm === 'none', `Q ${T} : mouvement réduit respecté (animation « ${rm} »)`, rm);
        // Q4 la tête défilée : une barre de verre PLEINE LARGEUR, jamais un bloc posé sur le contenu.
        if (tel) {
          await pg.evaluate(() => { const l = document.querySelector('.v2-ar-liste') || document.querySelector('.v2-ar-vide'); if (l) l.scrollIntoView({ block: 'end' }); }); await pg.waitForTimeout(500);
          const td = await pg.evaluate(() => { const h = document.querySelector('.vrm-app-header'); if (!h) return null; const r = h.getBoundingClientRect(); const cs = getComputedStyle(h); const m = cs.backgroundColor.match(/[\d.]+/g) || []; return { defile: h.classList.contains('is-defile'), l: Math.round(r.left), w: Math.round(r.width), W: innerWidth, a: m.length > 3 ? Number(m[3]) : 1, flou: cs.backdropFilter || cs.webkitBackdropFilter || '' }; });
          dit(td && td.defile && td.l === 0 && td.w === td.W && td.a >= 0.7 && /blur/.test(td.flou), `Q ${T} : défilée, la tête est une barre de verre pleine largeur (${td && td.w}/${td && td.W} px, opacité ${td && td.a})`, td);
          await pg.screenshot({ path: path.join(SHOTS, `argent-mois-bas-${W}-${th}.png`) });
        }
        // Q5 changer de segment : jamais d'écran blanc, aucun saut de mise en page (CLS hors geste = 0).
        await pg.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollTop) e.scrollTop = 0; }); await pg.waitForTimeout(700);
        await pg.evaluate(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; (window.__clsSrc = window.__clsSrc || []).push(Math.round(e.startTime) + ' ' + e.value.toFixed(4) + ' ' + (e.sources || []).map((x) => x.node ? (x.node.className || x.node.nodeName) + '' : '?').map((t) => String(t).slice(0, 50)).join(' + ')); } }).observe({ type: 'layout-shift' }); } catch (_) { window.__cls = null; } window.scrollTo(0, 0); for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollTop) e.scrollTop = 0; });
        await pg.waitForTimeout(300);
        await pg.click('.v2-argent-nav [data-section="declarer"]');
        await pg.waitForTimeout(120);
        const blanc = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return !m || (m.innerText || '').trim().length < 20 || !document.querySelector('.v2-argent-nav'); });
        await pg.waitForTimeout(2800);
        const cls = await pg.evaluate(() => window.__cls); const clsSrc = await pg.evaluate(() => window.__clsSrc || []);
        dit(!blanc, `Q ${T} : Mois → Déclarer sans écran blanc (120 ms après le toucher)`);
        dit(cls != null && cls < 0.01, `Q ${T} : Mois → Déclarer, CLS hors geste ${cls == null ? '—' : cls.toFixed(4)}`, clsSrc);
        // Déclarer
        await aller(pg, 'argent_declarer', 3400);
        const dcl = await lireApres(pg);
        dit(avant.apayer != null && dcl.apayer === avant.apayer && dcl.ca === avant.ca, `F ${T} : URSSAF — à payer ${dcl.apayer} et chiffre d’affaires ${dcl.ca}, ceux d’hier`, { avant: [avant.apayer, avant.ca], apres: [dcl.apayer, dcl.ca] });
        const segD = await pg.evaluate(() => { const b = document.querySelector('.v2-argent-nav [aria-selected="true"]'); return b ? b.getAttribute('data-section') : null; });
        dit(segD === 'declarer', `S ${T} : sur Déclarer, « Déclarer » allumé`, segD);
        const md = await mesurer(pg, `Déclarer ${T}`, ZONES_ARGENT);
        dit(md.pleins.length <= 1, `P Déclarer ${T} : au plus un bouton plein (${md.pleins.join(' | ') || 'aucun'})`, md.pleins);
        await air(pg, `Déclarer ${T}`, '.vrm-argent [data-argent-vue="declarer"]');
        await capture(pg, `argent-declarer-${W}-${th}`);
        if (tel) { await pg.evaluate(() => { const e = document.querySelector('[data-registres]') || document.querySelector('[data-micro-repli]'); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }); await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(SHOTS, `argent-registres-${W}-${th}.png`) }); }
        // Factures
        await aller(pg, 'invoices', 3000);
        const segF = await pg.evaluate(() => { const b = document.querySelector('.v2-argent-nav [aria-selected="true"]'); return b ? b.getAttribute('data-section') : null; });
        dit(segF === 'factures', `S ${T} : sur Factures, « Factures » allumé`, segF);
        const fa = await pg.evaluate(() => { const vis = (e) => !!e && e.getClientRects().length > 0; const p = document.querySelector('[data-v2-principal="facture"]');
          return { plein: vis(p) ? Math.round(p.getBoundingClientRect().top) : null, champs: [...document.querySelectorAll('.v2-fac-outils input')].filter(vis).length, chercher: [...document.querySelectorAll('.v2-fac button')].filter((b) => /^Chercher$/.test(b.textContent.trim())).length,
            zones: document.querySelectorAll('[data-fac-zones] .v2-seg-btn').length, vide: vis(document.querySelector('.v2-fac-vide')), ancienne: !!document.querySelector('.v2-fac .vrm-screen-head, .v2-fac [data-fac-actions]') }; });
        dit(fa.plein != null && fa.plein < 200 && fa.champs === 1 && fa.chercher === 0 && fa.zones === 2 && fa.vide && !fa.ancienne, `S ${T} : Factures — « Nouvelle facture » sur la ligne du titre, UNE recherche, UN segmenté En attente · Comptabilisées, un état vide dessiné`, fa);
        const mfa = await mesurer(pg, `Factures ${T}`, ZONES_ARGENT + ', .v2-fac > header, .v2-fac-outils, [data-fac-zones], .v2-fac-vide');
        const pf = await pg.evaluate(() => [...document.querySelectorAll('[data-v2b="principal"]')].map((e) => ({ t: e.textContent.trim(), r: e.getClientRects().length, h: !!e.closest('[hidden]'), v: getComputedStyle(e).visibility })));
        dit(pf.filter((x) => x.r && !x.h).length === 1 && mfa.pleins.length <= 1, `P Factures ${T} : exactement UN plein (${pf.filter((x) => x.r && !x.h).map((x) => x.t).join(' | ')})`, { pf, m: mfa.pleins });
        await air(pg, `Factures ${T}`, '[data-argent-factures]');
        await capture(pg, `argent-factures-${W}-${th}`);
        // Statistiques
        await aller(pg, 'dashboard', 3600);
        const venduApres = await lireVendu(pg);
        dit(venduAvant != null && venduApres === venduAvant, `F ${T} : VENDU — « Comparer » de Statistiques identique (${venduAvant})`, { venduAvant, venduApres });
        const segS = await pg.evaluate(() => { const b = document.querySelector('.v2-argent-nav [aria-selected="true"]'); return b ? b.getAttribute('data-section') : null; });
        dit(segS === 'stats', `S ${T} : sur Statistiques, « Statistiques » allumé`, segS);
        const st = await pg.evaluate(() => { const vis = (e) => e.getClientRects().length && !e.closest('[hidden]'); const h = document.querySelector('.vrm-statistiques-premium');
          const segs = h ? [...h.querySelectorAll('.vrm-seg, .v2-seg, [role="tablist"]')].filter(vis).filter((e) => e.getBoundingClientRect().top < 500) : [];
          const lignes = [...new Set([...document.querySelectorAll('.v2-argent-nav [data-section]')].map((b) => Math.round(b.getBoundingClientRect().top)))];
          return { n: segs.length, periode: !!document.querySelector('[data-v2-stats-periode]'), prix: !!document.querySelector('[data-v2-stats-prix]'), lignes: lignes.length };
        });
        dit(st.n === 1 && st.periode && st.prix, `S ${T} : Statistiques n’a qu’UN segmenté (la période en menu « Mois ⌄ », « Prix qui marche › » en lien)`, st);
        dit(st.lignes === 1, `S ${T} : les quatre segments d’Argent sur UNE ligne (${st.lignes})`, st);
        await mesurer(pg, `Statistiques ${T}`, ZONES_ARGENT);
        await capture(pg, `argent-stats-${W}-${th}`);
        // Paramètres (téléphone : le premier écran est la liste groupée)
        await aller(pg, 'settings', 2800);
        if (tel) {
          const pm = await pg.evaluate(() => {
            const r = document.querySelector('[data-v2-parametres]'); if (!r) return null;
            const hs = [...r.querySelectorAll('.v2-pm-h')].map((h) => ({ t: h.textContent.trim(), fs: parseFloat(getComputedStyle(h).fontSize), fw: Number(getComputedStyle(h).fontWeight) }));
            const rangs = [...r.querySelectorAll('.v2-pm-liste .v2-pm-rangee')];
            const sep = rangs.filter((x) => x.previousElementSibling).map((x) => { const b = getComputedStyle(x, '::before'); return parseFloat(b.left); });
            return { hs, n: rangs.length, petits: rangs.filter((x) => x.offsetHeight < 44).length, ic: rangs.filter((x) => x.querySelector('.v2-pm-ic svg, .v2-pm-av')).length, chev: rangs.filter((x) => x.querySelector('.v2-pm-chev svg')).length, val: rangs.filter((x) => x.querySelector('.v2-pm-val')).length, horsComposant: [...r.querySelectorAll('button')].filter((b) => !b.hasAttribute('data-v2-rangee') && !b.hasAttribute('data-v2b')).length, sep };
          });
          dit(pm && pm.hs.length >= 2 && pm.hs.every((h) => h.fs === 13 && h.fw === 600), `R ${T} : Paramètres en sections, en-têtes 13/600 (${pm ? pm.hs.map((h) => h.t).join(' · ') : '—'})`, pm);
          dit(pm && pm.n >= 6 && pm.petits === 0 && pm.ic === pm.n && pm.chev === pm.n && pm.horsComposant === 0, `R ${T} : ${pm ? pm.n : 0} rangées ≥ 44 px (composant RangeeTouchable), chacune icône + nom + chevron (${pm ? pm.val : 0} avec leur valeur)`, pm);
          dit(pm && pm.sep.length && pm.sep.every((x) => x >= 40), `R ${T} : séparateurs indentés (à ${pm && pm.sep[0]} px)`, pm && pm.sep);
          const pt = await pg.evaluate(() => { const vis = (e) => !!e && e.getClientRects().length > 0; const i = document.querySelector('[data-recherche-reglages] input, input[data-recherche-reglages]');
            return { loupe: [...document.querySelectorAll('[data-recherche-loupe]')].filter(vis).length, profil: [...document.querySelectorAll('.vrm-app-header [data-profil-tete], .vrm-app-header .vrm-profil-tete')].filter(vis).length, ph: i ? i.getAttribute('placeholder') : null, phCoupe: i ? i.scrollWidth > i.clientWidth + 1 : null }; });
          dit(pt.loupe === 0 && pt.ph === 'Chercher un réglage', `R ${T} : Paramètres sans la rangée de ronds d’hier, recherche « ${pt.ph} »`, pt);
          await mesurer(pg, `Paramètres ${T}`, '[data-v2-parametres]');
          await air(pg, `Paramètres ${T}`, '.vrm-pm');
          await capture(pg, `parametres-${W}-${th}`);
          // L'interrupteur « Nouveau design (essai) » : Apparence et langue → Apparence.
          const inter = await pg.evaluate(() => !!document.querySelector('[data-design-v2-bouton]'));
          dit(inter, `R ${T} : l’interrupteur « Nouveau design (essai) » est monté dans Paramètres`);
        } else await capture(pg, `parametres-${W}-${th}`);
        dit(!o.journal.erreurs.length, `${T} : aucune erreur JS`, o.journal.erreurs);
      } catch (e) { dit(false, `${T} : le banc a planté`, String(e && e.stack || e)); }
      await o.ctx.close();
    }
  } finally {
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(releve));
    await nav.close(); NV.srv.close();
    console.log(`\n${ok} ✅  ${ko} ❌   (captures : ${SHOTS})`);
    process.exit(ko ? 1 : 0);
  }
})();
