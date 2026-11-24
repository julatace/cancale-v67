// ════════════════════════════════════════════════════════════════════════════
//  BANC « AUCUN ORANGE, NULLE PART » (24 nov., lot sauts-orange)
//  Récit : docs/passation/2026-11-24-sauts-orange.md
//
//  Décision de Julien du 23 nov. (docs/passation/2026-11-23-passation-generale.md §3) : gris clair étagé,
//  accent ardoise, AUCUN orange ni ambre — le jour ET la nuit ; « à faire » = gras + accent ; le rouge seulement
//  pour deux paires sous un N°. Le robot du 24 nov. trouvait encore de l'orange (Argent « À venir », Paramètres
//  « Tout va bien ? ») : une couleur écrite à la main dans une feuille d'un écran d'hier passe sous les jetons.
//
//  Ce banc REND chaque écran principal (Aujourd'hui, Annonces, Ventes, Achats, Argent et Statistiques, Stock,
//  Messages, le menu, Paramètres et CHACUNE de ses sections, la loupe), 390 tactile ET 1512, clair ET sombre, et
//  lit la couleur CALCULÉE (getComputedStyle) de tout ce qui se voit : texte, fond, bords, contour, ombre, dégradé,
//  trait et remplissage SVG, et les pseudo-éléments ::before/::after. Une couleur est ORANGE/AMBRE quand sa teinte
//  est entre 15° et 55°, sa saturation ≥ 40 % (≥ 25 % pour un or terne jusqu'à 85 % de clarté), sa clarté entre 15 % et 96 % et son opacité ≥ 0,1 (les teintes pâles
//  #FFF4E5 comptent). Le rouge du doublon (teinte < 15°) n'est pas de l'orange. Seuls écartés : les LOGOS des
//  transporteurs et des sites (une marque, pas l'app) et les photos. Une seule touche ⇒ ROUGE.
//
//  Base INVENTÉE (celle du parcours iPhone : _base-messages-stock.cjs + deux colis au point relais). Jamais de vraies
//  données. `THEMES=clair` `LARGEURS=390` pour un sous-ensemble ; `BANC_DIST=…` pour juger un autre build.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-sans-orange');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const THEMES = liste('THEMES', 'clair,sombre');
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const CAPTURES = process.env.CAPTURES !== '0';
const SEUL = process.env.SEULEMENT || '';   // `SEULEMENT=messages` : seulement Messages (et sa conversation)

const jour = (d) => { const x = new Date(Date.now() + d * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const base = () => {
  const b = B.baseVolume();
  b.rows.push(
    { id: 'email_track_mondial_relay_MR999000111', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '4321', lieu: 'Tabac du Port', carrier: 'mondial_relay', suivi: 'MR999000111', artTitle: '', receivedAt: new Date(Date.now() - 3600e3).toISOString(), limite: jour(1) } },
    { id: 'email_track_vinted_VGSBANC000001', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: 'C49341', lieu: 'Consigne Laverie du Port', carrier: 'vinted', suivi: 'VGSBANC000001', artTitle: '', receivedAt: new Date(Date.now() - 7200e3).toISOString(), limite: jour(4) } },
    { id: 'ebay_orders', data: { orders: [], capturedAt: new Date().toISOString() } },
  );
  return b;
};
const apiBanc = (u, req) => /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true } : B.apiVolume(u, req);

// ── Dans la page : chaque couleur calculée de ce qui se voit. ──
function chercherOrange() {
  const rgba = (s) => {
    const t = String(s || '');
    const c = t.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const toutes = (s) => { const out = []; const re = /color\(srgb [^)]+\)|rgba?\([^)]+\)/g; let m; while ((m = re.exec(String(s || '')))) { const c = rgba(m[0]); if (c) out.push(c); } return out; };
  const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; if (mx === mn) return { h: 0, s: 0, l }; const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s, l }; };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const orange = (c) => { if (!c || c.a < 0.1) return false; const h = hsl(c); return h.h >= 15 && h.h <= 55 && h.l >= 0.15 && h.l <= 0.96 && (h.s >= 0.4 || (h.s >= 0.25 && h.l <= 0.85)); };   // = scripts/_couleurs-orange.cjs (l'or terne #AD9658 compte)
  // Écartés : une MARQUE (logo d'un transporteur, d'un site), une photo, une vignette — pas la palette de l'app.
  const LOGO = '[data-logo], [data-logo-transporteur], [data-transporteur-logo], .n-logo-site, [class*="logo-transp"], [class*="vrm-logo-site"], [class*="LogoTransporteur"], [data-site-logo], img, picture, video, canvas';
  const nom = (el) => {
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : (el.className && el.className.baseVal ? el.className.baseVal.split(/\s+/).slice(0, 2).join('.') : '');
    const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join('');
    let t = ''; for (let x = el; x && !t; x = x.parentElement) t = (x.innerText || x.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${d} « ${t} »`;
  };
  const aTexte = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const touches = [];
  const noter = (el, prop, c, pseudo = '') => { touches.push({ quoi: nom(el) + pseudo, prop, c: hex(c) + (c.a < 1 ? '/' + Math.round(c.a * 100) / 100 : '') }); };
  const juger = (el, cs, pseudo) => {
    const svg = el instanceof SVGElement;
    if ((aTexte(el) || pseudo) && cs.color) { const c = rgba(cs.color); if (orange(c)) noter(el, 'color', c, pseudo); }
    const bg = rgba(cs.backgroundColor); if (orange(bg)) noter(el, 'background', bg, pseudo);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') for (const c of toutes(cs.backgroundImage)) if (orange(c)) { noter(el, 'dégradé', c, pseudo); break; }
    for (const cote of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs['border' + cote + 'Width']) > 0 && cs['border' + cote + 'Style'] !== 'none') { const c = rgba(cs['border' + cote + 'Color']); if (orange(c)) { noter(el, 'bord', c, pseudo); break; } }
    }
    if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') { const c = rgba(cs.outlineColor); if (orange(c)) noter(el, 'contour', c, pseudo); }
    if (cs.boxShadow && cs.boxShadow !== 'none') for (const c of toutes(cs.boxShadow)) if (orange(c)) { noter(el, 'ombre', c, pseudo); break; }
    if (cs.textDecorationLine && cs.textDecorationLine !== 'none' && aTexte(el)) { const c = rgba(cs.textDecorationColor); if (orange(c)) noter(el, 'soulignement', c, pseudo); }
    if (svg) {
      if (cs.fill && cs.fill !== 'none') { const c = rgba(cs.fill); if (orange(c) && Number(cs.fillOpacity || 1) >= 0.1) noter(el, 'fill', c); }
      if (cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) { const c = rgba(cs.stroke); if (orange(c) && Number(cs.strokeOpacity || 1) >= 0.1) noter(el, 'stroke', c); }
    }
  };
  let n = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD|META|LINK)$/.test(el.tagName)) continue;
    if (el.closest(LOGO)) continue;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    if (el.closest('[inert]')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    n++;
    const cs = getComputedStyle(el);
    juger(el, cs, '');
    for (const ps of ['::before', '::after']) { const p = getComputedStyle(el, ps); if (p && p.content && p.content !== 'none' && p.display !== 'none' && (parseFloat(p.width) > 0 || p.content.length > 2)) juger(el, p, ps); }
  }
  return { n, touches };
}

const rapport = [];
let ROUGES = 0;
const dit = (ok, quoi, detail = '') => { if (!ok) ROUGES++; const l = `${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`; rapport.push(l); console.log('   ' + l); };

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await PW.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const th of THEMES) for (const W of LARGEURS) {
      console.log(`\n── ${W} · ${th}`);
      const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: base(), url: '/?tab=journee', api: apiBanc });
      const pg = o.pg;
      await P.pret(pg);
      const vus = new Set();
      const juger = async (ecran) => {
        await pg.waitForTimeout(600);
        const r = await pg.evaluate(chercherOrange);
        const uniques = []; const cles = new Set();
        for (const t of r.touches) { const k = t.quoi + t.prop + t.c; if (cles.has(k) || vus.has(k)) continue; cles.add(k); vus.add(k); uniques.push(t); }
        dit(r.n > 30 && r.touches.length === 0, `${W} ${th} · ${ecran} : aucun orange ni ambre (${r.n} éléments lus)`, r.touches.length ? `${r.touches.length} touche(s) : ` + uniques.slice(0, 8).map((t) => `${t.quoi} ${t.prop} ${t.c}`).join(' | ') : '');
        if (CAPTURES) await pg.screenshot({ path: path.join(SHOTS, `${W}-${th}-${ecran.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => {});
      };
      // Aller sur un écran comme lui : l'onglet du bas (390), la barre latérale (1512), sinon le menu « Plus ».
      const visible = async (sel) => { const l = pg.locator(sel).first(); return (await l.count()) && (await l.isVisible().catch(() => false)) ? l : null; };
      const aller = async (cle) => {
        if (await pg.evaluate(() => !!document.querySelector('[data-n-recherche-ouverte]'))) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(300); }
        let l = await visible(`.n-onglet[data-n-onglet="${cle}"]`) || await visible(`[data-n-entree="${cle}"]`);
        if (!l) { const plus = await visible('[data-n-coque-plus]'); if (plus) { await plus.click().catch(() => {}); await pg.waitForTimeout(500); } l = await visible(`[data-nav-entree="${cle}"]`); }
        if (!l) return false;
        await l.click().catch(() => {}); await pg.waitForTimeout(2500); return true;
      };
      if (!SEUL) for (const [ecran, cle] of [['aujourdhui', 'journee'], ['annonces', 'paires'], ['ventes', 'ventes'], ['achats', 'achats'], ['argent', 'compta'], ['stock', 'garage']]) {
        if (await aller(cle) || (cle === 'paires' && await aller('annonces'))) await juger(ecran); else dit(false, `${W} ${th} · ${ecran} : écran introuvable`);
      }
      // Messages
      // Messages, puis « Offres », puis une conversation qui porte une offre Vinted (sa carte d'offre : le cadre doré du 24 nov.).
      { const m = await visible('[data-n-coque-messages]') || await visible('[data-n-entree="messages"]');
        if (m) {
          await m.click().catch(() => {}); await pg.waitForTimeout(2500); await juger('messages');
          const off = await visible('[data-msg-vue="offres"]'); if (off) { await off.click().catch(() => {}); await pg.waitForTimeout(1200); await juger('messages-offres'); }
          let fil = await visible('[data-fil-offre]:not([data-fil-offre=""]):not([data-fil-offre="0"])');
          if (!fil) { const t = await visible('[data-msg-vue="toutes"]'); if (t) { await t.click().catch(() => {}); await pg.waitForTimeout(1200); } fil = await visible('[data-fil-offre]:not([data-fil-offre=""]):not([data-fil-offre="0"])') || await visible('[data-fil]'); }
          if (fil) { await fil.click().catch(() => {}); await pg.waitForTimeout(3000); await juger('messages-conversation'); await pg.goBack().catch(() => {}); await pg.waitForTimeout(800); }
          else dit(false, `${W} ${th} · messages : aucune conversation à ouvrir`);
          await pg.goBack().catch(() => {}); await pg.waitForTimeout(800);
        } }
      // Argent → Statistiques (le segment)
      if (!SEUL && await aller('compta')) {
        const stats = await visible('[data-argent-seg="stats"], [data-section="stats"], .vrm-seg-btn:has-text("Statistiques")');
        if (stats) { await stats.click().catch(() => {}); await pg.waitForTimeout(1500); await juger('statistiques'); }
      }
      // Paramètres et chacune de ses sections
      if (SEUL) { /* rien */ } else if (await aller('settings')) {
        await juger('parametres');
        const sections = await pg.evaluate(() => [...document.querySelectorAll('[data-categorie-ouvrir]')].map((x) => x.getAttribute('data-categorie-ouvrir')));
        for (const s of sections) {
          let l = await visible(`[data-categorie-ouvrir="${s}"]`);
          if (!l) { await aller('settings'); l = await visible(`[data-categorie-ouvrir="${s}"]`); }   // 1512 : le retour ne ramène pas toujours la liste
          if (!l) { dit(false, `${W} ${th} · parametres-${s} : section introuvable`); continue; }
          await l.click().catch(() => {}); await pg.waitForTimeout(1200);
          await juger(`parametres-${s}`);
          await pg.goBack().catch(() => {}); await pg.waitForTimeout(700);
        }
      } else dit(false, `${W} ${th} · parametres : écran introuvable`);
      // La loupe (sans rien taper, puis un N°)
      if (!SEUL) await aller('journee');
      const loupe = pg.locator('[data-recherche-loupe]:visible, [data-n-tete-loupe]:visible, [data-n-recherche]:visible, .vrm-global-search input:visible').first();
      if (!SEUL && await loupe.count()) {
        await loupe.click().catch(() => {}); await pg.waitForTimeout(2500); await juger('loupe');
        await pg.keyboard.type('12', { delay: 40 }).catch(() => {}); await pg.waitForTimeout(1500); await juger('loupe-resultats');
      } else if (!SEUL) dit(false, `${W} ${th} · loupe : introuvable`);
      if (o.erreurs.length) dit(false, `${W} ${th} : erreur JS`, o.erreurs.slice(0, 3).join(' | '));
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  const rouges = rapport.filter((l) => l.startsWith('❌'));
  console.log(`\n${rouges.length ? '❌' : '✅'} sans orange : ${rouges.length} rouge(s) sur ${rapport.length} — captures : ${SHOTS}`);
  if (rouges.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
