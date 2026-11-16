require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LES RESTES DU VERRE (16 nov., lot design-restes) — jugés sur l'app RENDUE.
//  Récit : docs/passation/2026-11-16-design-restes.md ; la carte : src/paires/PaireAvantSite.jsx ;
//  styles : src/design/verre-restes.css.
//
//  Base inventée à la vraie forme (design-passe-2 `baseSites` : Vinted + Leboncoin + eBay + Vestiaire),
//  + un prix d'achat SAISI pour le N°41 (Vestiaire P1) et trois meubles. On juge la RÈGLE (data-*, nombres) :
//  M  MONTE (390 tactile, clair et sombre) — Leboncoin, eBay, Vestiaire, Stock : toucher une rangée la fait
//     monter À SA PLACE (`data-sb-avant` = la clé de CETTE rangée), aucune fiche ne s'ouvre par-dessus, la carte
//     porte le prix lu (`data-sb-avant-chiffre="prix"`), les autres rangées reculent (opacité < .6), « × » la
//     fait redescendre ; Vestiaire N°41 : « acheté » = 55 (le prix d'achat saisi de SON N°) ; Stock : la place.
//  P  PLAN (1512) — le même toucher ouvre la fiche (`.vrm-fp`), rien ne monte.
//  F  FOND — « À faire · N », les notes eBay, le pied des listes posés sur le bleu : contraste ≥ 4,5:1 contre la
//     stop LA PLUS CLAIRE du dégradé du fond (le pire cas).
//  R  RECHERCHE — le placeholder des champs eBay et Leboncoin tient dans son champ à 390 (mesuré à la police réelle).
//  G  GLISSE — Stock : la poignée d'un meuble glissée sous le suivant le pose là (ordre relu dans `vrm_meubles`),
//     les deux touches « monter / descendre » restent.
//  `PARTIES=monte,plan,fond,recherche,glisse` `THEMES=clair,sombre` ; `BANC_DIST=` le build jugé ; `SHOTS=` captures.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const D2 = require('./design-passe-2.cjs');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const PARTIES = liste('PARTIES', 'monte,plan,fond,recherche,glisse');
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-restes');
fs.mkdirSync(SHOTS, { recursive: true });

function baseRestes() {
  const b = D2.baseSites();
  const m = b.main[0].data;
  m.vinted_buyprice_by_num = Object.assign({}, m.vinted_buyprice_by_num || {}, { 41: '55' });
  m.vrm_meubles = [{ id: 'mA', name: 'Garage', cols: 3, rows: 2 }, { id: 'mB', name: 'Bureau', cols: 3, rows: 2 }, { id: 'mC', name: 'Cave', cols: 3, rows: 2 }];
  return b;
}
const ECRANS = {
  lbc: { url: '/?tab=annonces&site=leboncoin', rangee: '[data-pf-liste="leboncoin"] li[data-fiche-ligne]', toucher: '' },
  ebay: { url: '/?tab=annonces&site=ebay', rangee: '.vrm-ebay-liste .vrm-eb-carte', toucher: '.vrm-eb-ouvrir' },
  vc: { url: '/?tab=annonces&site=vestiaire', rangee: '[data-pf-liste="vestiaire"] li[data-vc-annonce="P1"]', toucher: '.vrm-ui-ligne-titre' },
  stock: { url: '/?tab=garage', rangee: '[data-stock-liste] > [data-stock-annonce]:not([data-stock-annonce^="sans:"])', toucher: '.vrm-ms-titre' },
};

let ok = 0, ko = 0;
const rouges = [];
const dit = (cond, quoi, detail) => { if (cond) { ok++; console.log('  ✅', quoi); } else { ko++; rouges.push(quoi); console.log('  ❌', quoi, detail !== undefined ? '— ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''); } };

async function ouvrirEcran(nav, W, sombre, url, b) {
  const o = await P.ouvrir(nav, { W, sombre, b: b || baseRestes(), url, api: D2.api });
  await P.pret(o.pg);
  if (!(await o.pg.evaluate((u) => location.search === u.replace(/^\//, ''), url))) { await o.pg.goto(`http://localhost:${P.PORT}${url}`, { waitUntil: 'domcontentloaded' }); await P.pret(o.pg); }
  // Le site demandé : l'app relit `?site=` puis le retire de l'adresse ; s'il n'est pas choisi, on touche son sélecteur.
  const site = (String(url).match(/site=([a-z]+)/) || [])[1];
  if (site) { const b = o.pg.locator(`button[data-site="${site}"][aria-pressed="false"] >> visible=true`).first(); if (await b.count()) { await b.click().catch(() => {}); await o.pg.waitForTimeout(1200); } }
  return o;
}
const attendre = async (pg, f, arg, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(120); } return false; };

async function partieMonte(nav, sombre) {
  const t = sombre ? 'sombre' : 'clair';
  for (const [nom, e] of Object.entries(ECRANS)) {
    const o = await ouvrirEcran(nav, 390, sombre, e.url);
    const { pg } = o;
    try {
      const present = await attendre(pg, (s) => !!document.querySelector(s), e.rangee, 8000);
      if (!present) { dit(false, `M ${nom} ${t} : une rangée à toucher`, 'aucune'); continue; }
      const cle = await pg.evaluate((s) => { const r = document.querySelector(s); return r ? r.getAttribute('data-sb-avant-cle') : null; }, e.rangee);
      dit(!!cle, `M ${nom} ${t} : la rangée porte sa clé (data-sb-avant-cle)`, cle);
      const cible = pg.locator(e.rangee + (e.toucher ? ' ' + e.toucher : '')).first();
      await cible.scrollIntoViewIfNeeded().catch(() => {});
      await cible.tap({ timeout: 4000 }).catch((x) => console.log('    (tap)', String(x).slice(0, 120)));
      await pg.waitForTimeout(400);   // la carte et le recul sont posés après l'image (hôte)
      const monte = await attendre(pg, (c) => { const r = document.querySelector('[data-sb-avant]'); return !!r && (!c || r.getAttribute('data-sb-avant-cle') === c) && !!r.querySelector('[data-sb-avant-chiffres]'); }, cle, 3000);
      const m = await pg.evaluate(() => {
        const r = document.querySelector('[data-sb-avant]');
        const fiche = [...document.querySelectorAll('.vrm-fp')].some((x) => x.getClientRects().length);
        if (!r) return { fiche };
        const ch = Object.fromEntries([...r.querySelectorAll('[data-sb-avant-chiffre]')].map((c) => [c.getAttribute('data-sb-avant-chiffre'), c.getAttribute('data-val')]));
        const autres = [...(r.closest('[data-sb-liste]') || document).querySelectorAll('[data-sb-avant-cle]:not([data-sb-avant])')].filter((x) => x.getClientRects().length);
        const op = autres.length ? Math.min(...autres.map((x) => { let o = 1; for (let y = x; y && y !== document.body; y = y.parentElement) o *= Number(getComputedStyle(y).opacity); return o; })) : null;
        const cartes = r.querySelectorAll('[data-sb-avant-corps]').length;
        const rr = r.getBoundingClientRect();
        return { cle: r.getAttribute('data-sb-avant-cle'), ch, op, fiche, cartes, debord: rr.right > window.innerWidth + 1 || rr.left < -1 };
      });
      await pg.screenshot({ path: path.join(SHOTS, `monte-${nom}-390-${t}.png`) });
      dit(monte && m.cle === cle, `M ${nom} ${t} : la rangée touchée MONTE à sa place`, m);
      dit(!m.fiche, `M ${nom} ${t} : aucune fiche ne s'ouvre par-dessus`, m.fiche);
      dit(m.cartes === 1, `M ${nom} ${t} : une seule carte dans la rangée`, m.cartes);
      if (nom !== 'stock') dit(!!(m.ch && m.ch.prix), `M ${nom} ${t} : la carte porte le prix lu`, m.ch);
      else dit(!!m.ch && 'prix' in m.ch, `M stock ${t} : la carte porte la case du prix (« — » quand aucun site ne l'a lu)`, m.ch);
      dit(m.op == null || m.op < 0.6, `M ${nom} ${t} : les autres rangées reculent (opacité < .6)`, m.op);
      dit(!m.debord, `M ${nom} ${t} : la carte ne déborde pas de l'écran`);
      if (nom === 'vc') dit(m.ch && m.ch.achat === '55', `M vc ${t} : « acheté » = le prix d'achat saisi de SON N° (55)`, m.ch);
      if (nom === 'stock') dit(m.ch && 'place' in m.ch, `M stock ${t} : la 4e case dit la place au Stock`, m.ch);
      await pg.locator('[data-sb-avant] [data-sb-avant-fermer]').first().tap({ timeout: 3000 }).catch(() => {});
      const redescend = await attendre(pg, () => !document.querySelector('[data-sb-avant]'), null, 3000);
      dit(redescend, `M ${nom} ${t} : « × » la fait redescendre`);
      dit(!o.erreurs.length, `M ${nom} ${t} : aucune erreur de page`, o.erreurs.join(' | '));
    } finally { await o.ctx.close(); }
  }
}

async function partiePlan(nav, sombre) {
  const t = sombre ? 'sombre' : 'clair';
  for (const [nom, e] of Object.entries(ECRANS)) {
    const o = await ouvrirEcran(nav, 1512, sombre, e.url);
    const { pg } = o;
    try {
      if (!(await attendre(pg, (s) => !!document.querySelector(s), e.rangee, 8000))) { dit(false, `P ${nom} ${t} : une rangée`, 'aucune'); continue; }
      await pg.locator(e.rangee + (e.toucher ? ' ' + e.toucher : '')).first().click({ timeout: 4000 }).catch(() => {});
      const fiche = await attendre(pg, () => [...document.querySelectorAll('.vrm-fp')].some((x) => x.getClientRects().length), null, 5000);
      const monte = await pg.evaluate(() => !!document.querySelector('[data-sb-avant]'));
      await pg.screenshot({ path: path.join(SHOTS, `plan-${nom}-1512-${t}.png`) });
      dit(fiche && !monte, `P ${nom} ${t} : à l'ordinateur, la fiche s'ouvre (rien ne monte)`, { fiche, monte });
    } finally { await o.ctx.close(); }
  }
}

// Le contraste contre la stop la PLUS CLAIRE (texte clair) du fond réel.
function mesurerFond(sels) {
  const rgba = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fonds = (el) => {
    for (let x = el.parentElement; x; x = x.parentElement) {
      const cs = getComputedStyle(x); const c = rgba(cs.backgroundColor);
      if (c && c.a >= 0.5) return [c];
      if (cs.backgroundImage && /gradient/.test(cs.backgroundImage)) { const st = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(rgba).filter((k) => k && k.a >= 0.5); if (st.length) return st; }
    }
    return [{ r: 255, g: 255, b: 255, a: 1 }];
  };
  const out = [];
  for (const s of sels) {
    for (const el of document.querySelectorAll(s)) {
      if (!el.getClientRects().length || (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))) continue;
      const c = rgba(getComputedStyle(el).color); if (!c) continue;
      const pire = Math.min(...fonds(el).map((f) => ratio(c, f)));
      out.push({ s, texte: (el.textContent || '').trim().slice(0, 40), ratio: Math.round(pire * 100) / 100 });
    }
  }
  return out;
}
const FOND = {
  lbc: ['.vrm-pf-afaire .vrm-ui-afaire-mots', '.vrm-pf-liste > .vrm-pf-pied > span'],
  ebay: ['.vrm-pf-afaire .vrm-ui-afaire-mots', '.vrm-ebay-suite > .vrm-note-ligne', '.vrm-eb-inactives-titre', '.vrm-ebay-reglages > .vrm-ios-groupe-titre'],
  vc: ['.vrm-pf-afaire .vrm-ui-afaire-mots', '.vrm-pf-pied-vc .vrm-pop-chip'],
};
async function partieFond(nav, sombre) {
  const t = sombre ? 'sombre' : 'clair';
  for (const W of [390, 1512]) for (const [nom, sels] of Object.entries(FOND)) {
    const o = await ouvrirEcran(nav, W, sombre, ECRANS[nom].url);
    try {
      // Sous la charge, l'écran peut tarder : 15 s, puis une seconde ouverture (jamais un délai fixe).
      if (!(await attendre(o.pg, (s) => !!document.querySelector(s), sels[0], 15000))) { await o.pg.goto(`http://localhost:${P.PORT}${ECRANS[nom].url}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await P.pret(o.pg); await attendre(o.pg, (s) => !!document.querySelector(s), sels[0], 15000); }
      let r = await o.pg.evaluate(mesurerFond, sels);
      for (let k = 0; k < 20 && !r.length; k++) { await o.pg.waitForTimeout(500); r = await o.pg.evaluate(mesurerFond, sels); }
      await o.pg.screenshot({ path: path.join(SHOTS, `fond-${nom}-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
      if (!r.length) console.log('    (F) url', await o.pg.evaluate(() => location.search + ' ' + (document.querySelector('.vrm-main') || {}).getAttribute?.('data-ecran')));
      const vus = new Set(r.map((x) => x.s));
      for (const s of sels) if (!vus.has(s)) console.log(`    (F ${nom} ${W} ${t} : ${s} absent de cette base)`);
      const bas = r.filter((x) => x.ratio < 4.5);
      dit(r.length > 0 && !bas.length, `F ${nom} ${W} ${t} : ${r.length} textes sur le fond ≥ 4,5:1`, bas);
    } finally { await o.ctx.close(); }
  }
}

async function partieRecherche(nav, sombre) {
  const t = sombre ? 'sombre' : 'clair';
  for (const [nom, sel] of [['ebay', '.vrm-pf-barre-ebay input'], ['lbc', '[data-pf-outils="leboncoin"] input'], ['vc', '[data-pf-outils="vestiaire"] input']]) {
    const o = await ouvrirEcran(nav, 390, sombre, ECRANS[nom].url);
    try {
      await attendre(o.pg, (s) => !!document.querySelector(s), sel, 6000);
      const m = await o.pg.evaluate((s) => {
        const i = document.querySelector(s); if (!i) return null;
        const cs = getComputedStyle(i); const c = document.createElement('canvas').getContext('2d');
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const place = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return { ph: i.placeholder, texte: Math.ceil(c.measureText(i.placeholder).width), place: Math.floor(place) };
      }, sel);
      dit(m && m.texte <= m.place, `R ${nom} ${t} : le placeholder tient dans son champ à 390`, m);
    } finally { await o.ctx.close(); }
  }
}

async function partieGlisse(nav, sombre) {
  const t = sombre ? 'sombre' : 'clair';
  const o = await ouvrirEcran(nav, 390, sombre, '/?tab=garage');
  const { pg } = o;
  try {
    const vu = await attendre(pg, () => document.querySelectorAll('[data-meuble]').length >= 3, null, 8000);
    if (!vu) { dit(false, `G ${t} : trois meubles rendus`, await pg.evaluate(() => document.querySelectorAll('[data-meuble]').length)); return; }
    const ordre = () => pg.evaluate(() => [...document.querySelectorAll('[data-meuble]')].map((x) => x.getAttribute('data-meuble')).join(','));
    const avant = await ordre();
    dit(await pg.evaluate(() => !!document.querySelector('[data-meuble-monter]') && !!document.querySelector('[data-meuble-descendre]')), `G ${t} : les touches « monter / descendre » restent`);
    const h = await pg.evaluate(() => { const p = document.querySelector('[data-meuble="mA"] [data-meuble-glisser]'); const b = document.querySelector('[data-meuble="mB"]'); if (!p || !b) return null; p.scrollIntoView({ block: 'center' }); const r = p.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, w: r.width, dy: rb.top + rb.height - r.top + 10 }; });
    dit(!!h && h.h >= 44 && h.w >= 44, `G ${t} : la poignée du meuble (44 px au doigt)`, h);
    if (!h) return;
    // Un vrai glisser au doigt : pointerdown, déplacements, pointerup (CDP « touch »).
    await pg.evaluate(() => { window.__ev = []; for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart']) document.addEventListener(t, (e) => { if (window.__ev.length < 30) window.__ev.push(t + ':' + (e.target && e.target.getAttribute ? (e.target.getAttribute('data-meuble-glisser') || e.target.tagName) : '')); }, true); });
    const cdp = await pg.context().newCDPSession(pg);
    const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y) }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(h.x, h.y) });
    for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(h.x, h.y + (h.dy * k) / 8) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const bouge = await attendre(pg, (a) => [...document.querySelectorAll('[data-meuble]')].map((x) => x.getAttribute('data-meuble')).join(',') !== a, avant, 3000);
    const apres = await ordre();
    if (process.env.DEBUG) console.log('    ev', JSON.stringify(await pg.evaluate(() => window.__ev)), JSON.stringify(h));
    await attendre(pg, () => { try { const l = JSON.parse(localStorage.getItem('vrm_meubles') || '[]'); return l.slice().sort((a, b) => a.ordre - b.ordre).map((m) => m.id).join(',') === 'mB,mA,mC'; } catch (_) { return false; } }, null, 4000);
    const stocke = await pg.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('vrm_meubles') || '[]'); return l.slice().sort((a, b) => a.ordre - b.ordre).map((m) => m.id).join(','); } catch (_) { return ''; } });
    await pg.screenshot({ path: path.join(SHOTS, `glisse-390-${t}.png`) });
    dit(bouge && apres === 'mB,mA,mC', `G ${t} : glissé sous « Bureau », « Garage » y est posé`, { avant, apres });
    dit(stocke === 'mB,mA,mC', `G ${t} : l'ordre est écrit (vrm_meubles)`, stocke);
    dit(!o.erreurs.length, `G ${t} : aucune erreur de page`, o.erreurs.join(' | '));
  } finally { await o.ctx.close(); }
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const th of THEMES) {
      const sombre = th === 'sombre';
      console.log(`\n── ${th}`);
      if (PARTIES.includes('monte')) await partieMonte(nav, sombre).catch((x) => dit(false, `M ${th} : la partie s'est arrêtée`, String(x).slice(0, 200)));
      if (PARTIES.includes('plan')) await partiePlan(nav, sombre).catch((x) => dit(false, `P ${th} : la partie s'est arrêtée`, String(x).slice(0, 200)));
      if (PARTIES.includes('fond')) await partieFond(nav, sombre).catch((x) => dit(false, `F ${th} : la partie s'est arrêtée`, String(x).slice(0, 200)));
      if (PARTIES.includes('recherche')) await partieRecherche(nav, sombre).catch((x) => dit(false, `R ${th} : la partie s'est arrêtée`, String(x).slice(0, 200)));
      if (PARTIES.includes('glisse')) await partieGlisse(nav, sombre).catch((x) => dit(false, `G ${th} : la partie s'est arrêtée`, String(x).slice(0, 200)));
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌${ko ? '\n' + rouges.map((r) => '  - ' + r).join('\n') : ''}`);
  process.exitCode = ko ? 1 : 0;
})();
