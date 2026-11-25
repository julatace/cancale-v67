require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LE LOGO VINTED ET LA PHOTO DU COMPTE EN TÊTE DE CHAQUE COMPTE (25 nov. 2026 — docs/passation/2026-11-25-logo-vinted-pp.md)
//  Julien (iPhone, Monochrome, Annonces) : « corrige le logo compte Vinted » — « le logo de Vinted, mais pour le compte la pp
//  du compte Vinted » ; puis (Ventes) : « Mets ce logo Vinted » (le V turquoise des ventes).
//  Sur l'app RENDUE (base inventée de design-passe, 3 comptes Vinted), Annonces, 390 tactile ET 1512, clair ET sombre,
//  style par défaut ET Monochrome :
//    L  chaque en-tête de compte Vinted porte LE logo Vinted des ventes (`.n-logo-site[data-site="vinted"]`), ≥ 18 px,
//       à la couleur de la marque : sa couleur calculée n'est pas l'encre (écart ≥ 80), saturée (≥ 0,4), et tient 3:1 sur
//       le fond de la page (WCAG 1.4.11) ;
//    V  c'est le MÊME rendu que le V de Ventes (même classe, même couleur calculée, même taille) — Ventes rendue à côté ;
//    P  le rond du compte montre la VRAIE photo de SON compte (`harvest_{uid}_profile` du même uid) : un <img> rond, recadré
//       (object-fit cover), chargé paresseusement ; un compte sans photo, ou une photo http (pas https), ou une ligne dont
//       `payload.user.id` dit un AUTRE compte ⇒ l'initiale, jamais un trou ; une photo en erreur ⇒ l'initiale ;
//    R  une seule lecture des photos de profil pour l'écran (projetée, jamais `select=data`) ;
//  `MUTATION=encre` (le logo repeint à l'encre, comme l'ancien) ⇒ L et V rouges. La règle d'identité des photos (même uid, https,
//  jamais une ligne qui dit un autre compte) : `node scripts/audit-photo-profil-compte.cjs --prouve` (mutations du code).
//  `BANC_DIST=<dist d'avant>` ⇒ rouge sur origin/main. `SHOTS=<dossier>` les captures. `STYLES=,monochrome` `THEMES` `LARGEURS`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-logo-vinted-pp');
fs.mkdirSync(SHOTS, { recursive: true });
const STYLES = (process.env.STYLES !== undefined ? process.env.STYLES : ',monochrome').split(',');
const THEMES = (process.env.THEMES || 'clair,sombre').split(',');
const LARGEURS = (process.env.LARGEURS || '390,1512').split(',').map(Number);
const MUT = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); } return c; };

// La base : 3 comptes Vinted (design-passe). Le 1er a une photo https ; le 2e une ligne dont `payload.user.id` dit un AUTRE
// compte (jamais montrée) ; le 3e une photo http (jamais montrée) ; et une ligne de profil ORPHELINE (aucun compte relié)
// porte une photo : elle ne doit apparaître nulle part.
const PP = (uid) => `https://images1.vinted.net/t/pp-${uid}/50x50/avatar.jpeg?s=pp`;
function base() {
  const b = P.base();
  const uids = b.accounts.map((a) => String(a.vinted_user_id));
  const prof = (uid) => b.rows.find((r) => r.id === `harvest_${uid}_profile`);
  prof(uids[0]).data.payload.user.photo = { url: PP(uids[0]) };
  prof(uids[1]).data.payload.user.photo = { url: PP(uids[1]) };
  prof(uids[1]).data.payload.user.id = 999000111;   // la ligne dit un AUTRE compte : jamais sa photo
  prof(uids[2]).data.payload.user.photo = { url: PP(uids[2]).replace('https:', 'http:') };
  b.rows.push({ id: 'harvest_777000777_profile', data: { capturedAt: new Date().toISOString(), payload: { user: { id: 777000777, login: 'orphelin', photo: { url: PP('777000777') } } } } });
  return { b, uids };
}

const MESURE = () => {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const t = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const rapport = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const sat = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; return d ? d / (1 - Math.abs(2 * l - 1)) : 0; };
  const fondDe = (el) => { for (let x = el.parentElement; x; x = x.parentElement) { const c = parse(getComputedStyle(x).backgroundColor); if (c && c.a > 0.9) return c; } return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; };
  // la couleur PEINTE d'un logo : son fond (masque) ou, pour un <svg> en ligne, son `fill` calculé
  const peinte = (el) => { const cs = getComputedStyle(el); const bg = parse(cs.backgroundColor); if (bg && bg.a > 0.5) return bg;
    const p = el.querySelector('path'); if (p) { const f = parse(getComputedStyle(p).fill); if (f) return f; } return parse(cs.color); };
  const encre = parse(getComputedStyle(document.querySelector('.n-ad-compte-nom') || document.body).color);
  const tetes = [...document.querySelectorAll('[data-ad-repli^="vinted:"]')];
  return {
    style: document.documentElement.getAttribute('data-style'), theme: document.documentElement.getAttribute('data-theme'),
    tetes: tetes.map((t) => {
      const zone = t.querySelector('.n-eg-compte-logo') || t;
      const logo = zone.querySelector('.n-logo-site, .vrm-logo-site, [data-logo]');
      const r = logo ? logo.getBoundingClientRect() : null;
      const c = logo ? peinte(logo) : null, f = fondDe(t);
      const av = t.querySelector('[data-inv-avatar]'); const img = av && av.querySelector('img');
      const ir = img ? img.getBoundingClientRect() : null, ics = img ? getComputedStyle(img) : null;
      return { cle: t.getAttribute('data-ad-repli'), classe: logo ? String(logo.className) : '', site: logo ? (logo.getAttribute('data-site') || logo.getAttribute('data-logo-site')) : '',
        w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0, couleur: c, encre, ecart: c && encre ? Math.abs(c.r - encre.r) + Math.abs(c.g - encre.g) + Math.abs(c.b - encre.b) : 0,
        sat: c ? Math.round(sat(c) * 100) / 100 : 0, k: c ? Math.round(rapport(c, f) * 100) / 100 : 0,
        img: img ? { src: img.currentSrc || img.src, lazy: img.getAttribute('loading'), rond: ics.borderRadius, fit: ics.objectFit, w: Math.round(ir.width), h: Math.round(ir.height), charge: img.complete && img.naturalWidth > 0 } : null,
        initiale: av ? (av.innerText || '').trim() : null, avW: av ? Math.round(av.getBoundingClientRect().width) : 0 };
    }),
    pageHtml: document.body.innerHTML.includes('pp-777000777'),
  };
};
const MESURE_VENTES = () => {
  const l = [...document.querySelectorAll('.vrm-main .n-logo-site[data-site="vinted"]')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.top < innerHeight; });
  if (!l) return null; const r = l.getBoundingClientRect();
  return { classe: String(l.className), bg: getComputedStyle(l).backgroundColor, w: Math.round(r.width), h: Math.round(r.height) };
};

async function ouvrir(nav, { W, sombre, style, url, b }) {
  try { const d = b.main[0].data; d.vrm_apparence = sombre ? 'sombre' : 'clair'; d.vinted_dark = !!sombre; } catch (_) {}
  const o = await P.ouvrir(nav, { W, sombre, b, url, dsf: 2 });
  await o.pg.addInitScript(([st, sombre]) => { try { sessionStorage.setItem('banc_defaut_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); if (st) localStorage.setItem('vrm_style', JSON.stringify(st)); else localStorage.removeItem('vrm_style'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); } catch (_) {} }, [style, sombre]);
  o.profils = [];
  o.pg.on('request', (q) => { const u = decodeURIComponent(q.url()); if (/\/rest\/v1\/app_data/.test(u) && /_profile/.test(u) && /photo/.test(u)) o.profils.push(u.replace(/^.*\/rest\/v1\//, '')); });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  o.profils.length = 0; o.erreurs.length = 0;
  return o;
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const { b, uids } = base();
  try {
    for (const W of LARGEURS) for (const style of STYLES) for (const th of THEMES) {
      const sombre = th === 'sombre';
      const cle = `${style || 'defaut'}-${th}-${W}`;
      console.log(`\n── ${cle}`);
      // Ventes d'abord : le V que Julien montre (« Mets ce logo Vinted »)
      let vv = null;
      { const o = await ouvrir(nav, { W, sombre, style, url: '/?tab=ventes', b });
        try { await o.pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {});
          await o.pg.waitForFunction(() => !!document.querySelector('.vrm-main .n-logo-site[data-site="vinted"]'), null, { timeout: 45000 }).catch(() => {});
          await o.pg.waitForTimeout(1200); vv = await o.pg.evaluate(MESURE_VENTES);
          await o.pg.screenshot({ path: path.join(SHOTS, `ventes-${cle}.png`) });
        } finally { await o.ctx.close(); } }
      const o = await ouvrir(nav, { W, sombre, style, url: '/?tab=annonces', b });
      try {
        await o.pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {});
        await o.pg.waitForFunction(() => document.querySelectorAll('[data-ad-repli^="vinted:"]').length >= 3, null, { timeout: 60000 }).catch(() => {});
        await o.pg.waitForTimeout(2500);
        if (MUT === 'encre') await o.pg.addStyleTag({ content: '.n-logo-site, .vrm-logo-site { background: var(--n-encre) !important; color: var(--n-encre) !important; }' });
        const m = await o.pg.evaluate(MESURE);
        const t = m.tetes;
        dit(t.length >= 3, `${cle} : les ${uids.length} en-têtes de compte Vinted sont rendus`, t.length);
        if (style) dit(m.style === style, `${cle} : le style ${style} est appliqué`, m.style);
        const mauvaisL = t.filter((x) => !(x.site === 'vinted' && /n-logo-site/.test(x.classe) && x.w >= 18 && x.h >= 18 && x.ecart >= 80 && x.sat >= 0.4 && x.k >= 3));
        dit(t.length && !mauvaisL.length, `L ${cle} : chaque en-tête porte le logo Vinted en couleur de marque (≥ 18 px, ≠ encre, ≥ 3:1)`, mauvaisL.map((x) => ({ cle: x.cle, classe: x.classe, w: x.w, h: x.h, couleur: x.couleur, ecart: x.ecart, sat: x.sat, k: x.k })));
        const t0 = t[0];
        dit(!!vv && !!t0 && vv.classe === t0.classe && `rgb(${t0.couleur.r}, ${t0.couleur.g}, ${t0.couleur.b})` === vv.bg.replace(/rgba?\(([^,]+), ([^,]+), ([^,)]+).*$/, 'rgb($1, $2, $3)') && Math.abs(vv.w - t0.w) <= 4,
          `V ${cle} : le même V que sur Ventes (classe, couleur, taille ±4)`, { ventes: vv, annonces: t0 && { classe: t0.classe, couleur: t0.couleur, w: t0.w } });
        const parUid = (u) => t.find((x) => x.cle === 'vinted:' + u);
        const a = parUid(uids[0]), bb = parUid(uids[1]), c = parUid(uids[2]);
        dit(!!a && !!a.img && a.img.src.includes('pp-' + uids[0]) && a.img.lazy === 'lazy' && /50%|9999|999px/.test(a.img.rond) && a.img.fit === 'cover' && a.img.w >= 18 && Math.abs(a.img.w - a.img.h) <= 1,
          `P ${cle} : le compte 1 montre SA photo de profil (ronde, recadrée, paresseuse)`, a && a.img);
        dit(!!bb && !bb.img && !!bb.initiale, `P ${cle} : une ligne de profil qui dit un AUTRE compte ⇒ l'initiale, jamais sa photo`, bb && { img: bb.img, initiale: bb.initiale });
        dit(!!c && !c.img && !!c.initiale, `P ${cle} : une photo http (pas https) ⇒ l'initiale`, c && { img: c.img, initiale: c.initiale });
        dit(!m.pageHtml, `P ${cle} : la photo d'une ligne orpheline (aucun compte relié) n'apparaît nulle part`);
        dit(o.profils.length === 1 && !/select=data(&|$)/.test(o.profils[0]) && /photo/.test(o.profils[0]), `R ${cle} : une seule lecture des photos de profil, projetée`, o.profils);
        dit(!o.erreurs.length, `${cle} : aucune erreur d'app`, o.erreurs);
        await o.pg.evaluate(() => { const e = document.querySelector('[data-ad-repli^="vinted:"]'); if (e) e.scrollIntoView({ block: 'center' }); });
        await o.pg.waitForTimeout(300);
        await o.pg.screenshot({ path: path.join(SHOTS, `annonces-${cle}.png`) });
        // gros plan sur l'en-tête (pour la planche)
        const bx = await o.pg.evaluate(() => { const e = document.querySelector('[data-ad-repli^="vinted:"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: Math.min(innerWidth - Math.max(0, r.left - 8), Math.max(r.width, 260) + 16), height: r.height + 16 }; });
        if (bx) await o.pg.screenshot({ path: path.join(SHOTS, `tete-${cle}.png`), clip: bx });
        // une photo qui ne se charge pas ⇒ l'initiale (jamais un trou)
        if (W === 390 && !style && th === 'clair') {
          const o2 = await ouvrir(nav, { W, sombre, style, url: '/?tab=annonces', b });
          try {
            await o2.pg.route(/pp-\d+/, (r) => r.fulfill({ status: 404, body: '' }));
            await o2.ctx.route(/pp-\d+/, (r) => r.fulfill({ status: 404, body: '' }));
            await o2.pg.reload({ waitUntil: 'domcontentloaded' });
            await o2.pg.waitForFunction(() => document.querySelectorAll('[data-ad-repli^="vinted:"]').length >= 3, null, { timeout: 60000 }).catch(() => {});
            await o2.pg.waitForTimeout(2500);
            const m2 = await o2.pg.evaluate(MESURE); const a2 = m2.tetes.find((x) => x.cle === 'vinted:' + uids[0]);
            dit(!!a2 && !a2.img && !!a2.initiale, `P ${cle} : une photo en erreur ⇒ l'initiale`, a2 && { img: a2.img, initiale: a2.initiale });
          } finally { await o2.ctx.close(); }
        }
      } finally { await o.ctx.close(); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} logo-vinted-pp : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
