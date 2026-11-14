require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA PASSE ÉCRAN PAR ÉCRAN DU SYSTÈME DE DESIGN (14 nov.) — ce qu'on MESURE.
//
//  Julien (13 nov.) : « l'appli est pas très belle, tout doit être revu » ; « je veux
//  que tout soit beau, cohérent, simple ». Le système (`src/styles-systeme.css`,
//  `docs/design/DESIGN.md`) est en ligne ; ce banc juge, sur l'app RENDUE, ce qui
//  restait hors de lui (récit : docs/passation/2026-11-14-design-passe.md) :
//
//    A. cibles : tout bouton visible fait 44 px au doigt (390 tactile) et 36 px à la
//       souris (1512) — hauteur RENDUE (getBoundingClientRect) ;
//    B. graisses : 400 · 600 · 700 seulement (graisse CALCULÉE de chaque texte) ;
//    C. tailles : l'échelle du système (11 · 12 · 13 · 15 · 17 · 20 · 28 · 34 · 40 · 44) ;
//    D. gris : un texte gris est LE gris du système (#6E6E73 · #98989D la nuit), jamais
//       un gris écrit à la main (#8E8E93, #999, rgba(0,0,0,.5)…) — couleur CALCULÉE ;
//    E. contraste : ≥ 4,5:1 (3:1 pour un grand texte), couleur du texte contre le fond
//       EFFECTIF (fonds empilés, opacités) ; la carte sombre (dégradé) est écartée ;
//    F. coupures : aucun mot (≤ 20 lettres) coupé sur deux lignes, aucun `hyphens:auto`
//       (« XT-/6 ») — mesuré par Range, mot par mot ;
//    G. la carte « Protège ton compte » : aucun cadre (bord), ni le jour ni la nuit ;
//    H. aucune couleur violette ; le logo Chronopost n'est jamais jaune ;
//    I. aucun chiffre rogné (un montant coupé « 1 47… » dans une tuile trop étroite).
//
//  Écrans : Ma journée, Ventes, Colis, Annonces, Stock, Argent, Paramètres, la loupe
//  (« Tout sur le N° ») et la fiche « Tout sur le N° » — 390 tactile ET 1512, clair ET
//  sombre, deviceScaleFactor 1. Base INVENTÉE (`_base-volume.cjs`, 3 comptes, vignettes
//  SVG inventées), garde réseau : rien ne sort. Un banc ne meurt pas, il rapporte.
//  `ECRANS=journee,fiche` `LARGEURS=390` `THEMES=clair` pour un sous-ensemble ;
//  `BANC_DIST=…` pour juger un autre build (avant/après) ; `SHOTS=…` les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer } = require(path.join(__dirname, '_base-volume.cjs'));
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-passe');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ECRANS_VOULUS = liste('ECRANS', '');
const DETAIL = Number(process.env.DETAIL || 6);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000e7';
const SESSION = { access_token: 'jeton-design', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.exemple@exemple.test', totp: [], user_metadata: { full_name: 'Camille Exemple' } } };
fs.mkdirSync(SHOTS, { recursive: true });

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const vignette = (graine) => {
  let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const t = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="hsl(${t},28%,88%)"/><path d="M70 250 C90 200 140 190 170 170 L210 150 C230 175 260 185 300 190 C330 195 345 215 340 245 L340 262 L70 262 Z" fill="hsl(${t},35%,${35 + (h % 30)}%)"/></svg>`;
};
function base() {
  const b = fabriquer({ comptes: 3 });
  const m = b.main[0].data;
  const at = '2026-11-01T10:00:00.000Z';
  m.vrm_bienvenue_vue = { at }; m.vrm_visite_vue = { at };
  m.vrm_je_vends = { choix: 'sneakers', at };
  m.vrm_configuration = { etat: 'fait', at, statut: null, version: 1 };
  m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay'], at };
  m.vrm_parcours = { etat: 'fini', at };
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.375.0', code: '5.375.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  return b;
}
async function rest(route, b) {
  const req = route.request(), m = req.method();
  const u = decodeURIComponent(req.url());
  if (/\/rest\/v1\/rpc\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  if (m !== 'GET' && m !== 'HEAD') return route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: m === 'PATCH' ? '[{"id":"main"}]' : '[]' });
  if (/\/rest\/v1\/vinted_accounts/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b.accounts.map((a) => ({ ...a, owner: UID }))) });
  if (!/\/rest\/v1\/app_data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  const lignes = [...b.main, ...b.rows].map((l) => ({ owner: UID, updated_at: new Date().toISOString(), ...l }));
  const r = servir(lignes, decodeURIComponent(metaVersData(req.url())), req.headers());
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': r.range || '0-0/0' }, body: JSON.stringify(r.body) });
}
async function ouvrir(nav, { W, sombre, b, url, sansSession = false, api = null, dsf = 1 }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: dsf } : { viewport: { width: 1512, height: 950 }, deviceScaleFactor: dsf }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre, sansSession]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_banc_vends', '1');
        if (!sansSession) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); }
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_aide_installation_vue', '1');
        localStorage.setItem('vrm_langue', 'fr');
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre, sansSession]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vinted\.net|vinted\.fr\/.*\.(jpe?g|png|webp)/i.test(u) || r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignette(u) });
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true } }) });
    if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: { ...SESSION.user, factors: [] }, id: UID, email: SESSION.user.email, factors: [] }) });
    if (/\/rest\/v1\//.test(u)) return rest(r, b);
    return r.abort();
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=confidentialite/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: UID }) });
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: true, acces: true }) });
    if (api) { const x = api(u, r.request()); if (x) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.route('**/rest/v1/**', (r) => rest(r, b));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs, tel };
}
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {}); await pg.waitForTimeout(2800); };

// ── La mesure, DANS la page : tout ce qui est rendu sous les racines voulues. ──
function mesurer({ tactile, sombre, racines, ciblesEnPlus = '' }) {
  const seuil = tactile ? 44 : 36;
  const ECHELLE = [11, 12, 13, 15, 17, 20, 28, 34, 40, 44];
  const out = { cibles: [], graisses: [], tailles: [], gris: [], contraste: [], coupes: [], hyphens: [], rognes: [], mfa: [], violet: [], chrono: [], nTextes: 0, nCibles: 0 };
  const roots = [...new Set(racines.flatMap((s) => [...document.querySelectorAll(s)]))].filter((r) => !roots0(r));
  function roots0(r) { return racines.some((s) => r.parentElement && r.parentElement.closest(s)); }
  const vis = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest('[inert], .vrm-sr-only, .sr-only')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const nom = (el) => {
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join('');
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 34);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${d} « ${t} »`;
  };
  const rgba = (s) => {
    const t = String(s || '');
    // color-mix() se calcule en `color(srgb r g b / a)` (valeurs 0–1)
    const c = t.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (h, bas) => ({ r: h.r * h.a + bas.r * (1 - h.a), g: h.g * h.a + bas.g * (1 - h.a), b: h.b * h.a + bas.b * (1 - h.a), a: 1 });
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; if (mx === mn) return { h: 0, s: 0, l }; const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s, l }; };
  // Les gris PERMIS (un texte) : l'encre, LE gris, le glyphe, le blanc, le noir, le fond (texte sur encre).
  // (14 nov., passe 2) Un texte posé sur une surface SOMBRE (le panneau de marque de la connexion, au jour) se lit
  // avec la palette de la nuit : c'est le fond effectif qui choisit, pas seulement le thème de l'app.
  const PERMIS_NUIT = new Set(['#F5F5F7', '#98989D', '#5A5A5E', '#FFFFFF', '#000000', '#1C1C1E', '#1D1D1F', '#F2F2F7', '#2C2C2E']);
  const PERMIS_JOUR = new Set(['#1D1D1F', '#6E6E73', '#AEAEB2', '#FFFFFF', '#000000', '#F2F2F7', '#F5F5F7', '#1C1C1E']);
  const sombreCarte = (el) => {
    for (let x = el; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.backgroundImage && /url\(|radial-gradient/.test(cs.backgroundImage)) return true;
      const av = getComputedStyle(x, '::before');
      if (av && av.content !== 'none' && av.backgroundImage && av.backgroundImage !== 'none' && /gradient|url/.test(av.backgroundImage) && av.position === 'absolute') return true;
      if (x.tagName === 'IMG' || x.tagName === 'VIDEO') return true;
    }
    return false;
  };
  const fond = (el) => {
    const couches = [];
    for (let x = el; x; x = x.parentElement) {
      const c = rgba(getComputedStyle(x).backgroundColor);
      if (c && c.a > 0) { couches.push(c); if (c.a >= 1) break; }
    }
    let f = { r: 255, g: 255, b: 255, a: 1 };
    if (!couches.length || couches[couches.length - 1].a < 1) f = sombre ? { r: 0, g: 0, b: 0, a: 1 } : { r: 242, g: 242, b: 247, a: 1 };
    for (let i = couches.length - 1; i >= 0; i--) f = melange(couches[i], f);
    return f;
  };
  // Un texte qui APPARAÎT ou S'EFFACE (un toast « Mis à jour à … » en fondu) se juge à son état final : une
  // animation FINIE en cours le met hors mesure. Une boucle infinie (le film du Stock) reste jugée à l'instant mesuré.
  const enFondu = (el) => { for (let x = el; x; x = x.parentElement) { if (x.getAnimations && x.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity)) return true; } return false; };
  const opacite = (el) => { let o = 1; for (let x = el; x; x = x.parentElement) o *= Number(getComputedStyle(x).opacity || 1); return o; };
  const cartes = new Set();
  for (const root of roots) {
    // A. cibles
    // `ciblesEnPlus` (banc 2) : des liens qui SONT des boutons (les appels de la page d'accueil).
    for (const el of root.querySelectorAll('button, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], summary, a.vrm-b, select' + (ciblesEnPlus ? ', ' + ciblesEnPlus : ''))) {
      if (!vis(el) || el.closest('[aria-hidden="true"]')) continue;   // une cible cachée aux lecteurs n'est pas une cible
      if (el.closest('svg')) continue;
      out.nCibles++;
      const r = el.getBoundingClientRect();
      if (r.height + 0.5 < seuil) out.cibles.push({ h: Math.round(r.height * 10) / 10, w: Math.round(r.width), quoi: nom(el), inline: getComputedStyle(el).display === 'inline' });
    }
    // B-F. textes
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const vus = new Set();
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue; if (!t || !t.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('svg, script, style, noscript, textarea, option')) continue;
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      if (!vus.has(el)) {
        vus.add(el); out.nTextes++;
        const g = Number(cs.fontWeight), fs_ = Math.round(parseFloat(cs.fontSize) * 2) / 2;
        const lib = () => nom(el);
        if (![400, 600, 700].includes(g)) out.graisses.push({ g, quoi: lib() });
        // La barre d'onglets du téléphone garde ses 10 pt (la taille des libellés d'onglet d'iOS ; Julien doit encore
        // trancher « libellés à 9 px », CLAUDE.md §9) : hors de l'échelle exprès.
        // Le chiffre d'une tuile de Ma journée au téléphone se RESSERRE pour tenir (Julien, 10 nov. : « l'euro dépasse » ;
        // styles-widgets-ios.css, `--nc`) : une taille fluide entre 14 et 28, exprès — jamais rogné (I le vérifie).
        // (14 nov., passe 2) De même LE chiffre de la carte sombre que `ajusterChiffre` (CarteMois.jsx) a resserré pour
        // tenir (« au moins 87,65 € » : 38 px, la taille posée en ligne) — entre son plancher (22) et 44.
        const ajuste = (el.closest('[data-ecran="journee"] .vrm-fu-tete .vrm-fu-case') && fs_ >= 14 && fs_ <= 28)
          || (el.closest('.vrm-fu-grand[style*="font-size"]') && fs_ >= 22 && fs_ <= 44);
        if (!ECHELLE.includes(fs_) && !ajuste && !el.closest('.vrm-nav-label') && !/^[\s›‹×✓✕·•…—–\-+−⋯▾▸]+$/.test(el.innerText || '')) out.tailles.push({ t: fs_, quoi: lib() });
        const col = rgba(cs.color);
        const enSombre = sombreCarte(el);
        // Un texte de couleur TRANSPARENTE (un « — » de remplacement sous un dessin) ne se voit pas : ni gris ni contraste.
        if (col && !enSombre && col.a > 0) {
          const PERMIS = (sombre || lum(fond(el)) < 0.18) ? PERMIS_NUIT : PERMIS_JOUR;
          const hs = hsl(col);
          const neutre = Math.max(col.r, col.g, col.b) - Math.min(col.r, col.g, col.b) <= 10;
          // La colonne de gauche (panneau #E5E5EA) a SON gris, le jeton `--n2-titre` (#636366 ; LE gris n'y tient que 4,1:1).
          const gNav = !sombre && el.closest('.vrm-sidebar') && hex(col) === '#636366';
          if (neutre && !gNav && (col.a < 0.999 || !PERMIS.has(hex(col)))) out.gris.push({ c: col.a < 1 ? `rgba(${col.r},${col.g},${col.b},${col.a})` : hex(col), quoi: lib() });
          if (hs.s > 0.3 && hs.h >= 255 && hs.h <= 320 && hs.l > 0.15 && hs.l < 0.9) out.violet.push({ c: hex(col), quoi: lib() });
          const disabled = el.closest(':disabled, [aria-disabled="true"]') || enFondu(el);
          // Un chevron ou une croix seuls (« › ») sont des DESSINS (`--d-glyphe`, DESIGN.md §4), pas un texte à lire.
          const glyphe = /^[\s›‹×✕⌄▾▸]+$/.test(el.innerText || '');
          if (!disabled && !glyphe) {
            const f = fond(el);
            const o = opacite(el);
            const fg = melange({ ...col, a: col.a * o }, f);
            const k = ratio(fg, f);
            const grand = fs_ >= 24 || (fs_ >= 18.5 && g >= 700);
            const min = grand ? 3 : 4.5;
            if (k + 0.005 < min) out.contraste.push({ k: Math.round(k * 100) / 100, min, fg: hex(fg), fond: hex(f), quoi: lib() });
          }
        }
        if (/auto/.test(cs.hyphens || '') || /auto/.test(cs.webkitHyphens || '')) out.hyphens.push({ quoi: lib() });
        // I. Un CHIFFRE n'est jamais rogné (« 1 47… » : un montant coupé ment) — sur lui ou sur le parent qui le borne.
        if (/\d/.test(el.innerText || '')) for (const x of [el, el.parentElement]) {
          if (!x) continue; const c2 = getComputedStyle(x);
          if (c2.overflow !== 'visible' && c2.textOverflow !== 'ellipsis' && x.scrollWidth > x.clientWidth + 1 && /nowrap/.test(c2.whiteSpace) && x.clientWidth > 0) { out.rognes.push({ quoi: lib(), de: x.scrollWidth, dans: x.clientWidth }); break; }
        }
      }
      // F. mots coupés
      if (/nowrap|pre$/.test(cs.whiteSpace)) continue;
      const re = /\S+/g; let m;
      while ((m = re.exec(t))) {
        const mot = m[0]; if (mot.length < 3 || mot.length > 20) continue;
        const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + mot.length);
        const rs = [...rg.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5);
        if (rs.length > 1) { const tops = rs.map((x) => Math.round(x.top)); if (Math.max(...tops) - Math.min(...tops) > 3) out.coupes.push({ mot, quoi: nom(el) }); }
      }
    }
    // G. la carte « Protège ton compte »
    for (const c of root.querySelectorAll('[data-carte-mfa]')) {
      if (cartes.has(c)) continue; cartes.add(c);
      const cs = getComputedStyle(c);
      const bc = rgba(cs.borderTopColor);
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && bc && bc.a > 0) out.mfa.push({ bord: `${cs.borderTopWidth} ${hex(bc)}`, quoi: nom(c) });
      const fonds = c.parentElement ? getComputedStyle(c.parentElement).backgroundColor : '';
      out.mfaVue = true; out.mfaFond = cs.backgroundColor; out.mfaParent = fonds;
    }
    // H. Chronopost jamais jaune
    for (const t of root.querySelectorAll('[data-transporteur*="chrono"], [data-transporteur*="shop2shop"]')) {
      for (const x of [t, ...t.querySelectorAll('*')]) {
        const cs = getComputedStyle(x);
        for (const v of [cs.backgroundColor, x.getAttribute && x.getAttribute('fill'), cs.fill]) {
          const c = rgba(v) || (/^#([0-9a-f]{6})$/i.test(String(v || '')) ? { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16), a: 1 } : null);
          if (!c || c.a === 0) continue;
          const h = hsl(c);
          if (h.s > 0.5 && h.h >= 40 && h.h <= 65 && h.l > 0.35) out.chrono.push({ c: hex(c), quoi: nom(t) });
        }
      }
    }
  }
  return out;
}

const ECRANS = [
  ['journee', '/?tab=journee'], ['ventes', '/?tab=ventes'], ['colis', '/?tab=cat_bord'], ['annonces', '/?tab=annonces'],
  ['stock', '/?tab=garage'], ['argent', '/?tab=argent'], ['parametres', '/?tab=settings'], ['loupe', '/?tab=journee'], ['fiche', '/?tab=journee'],
];
const RACINES = ['.vrm-main', '.vrm-fs', '.vrm-fp', '[data-recherche-panneau]'];
const CLES = ['cibles', 'graisses', 'tailles', 'gris', 'contraste', 'coupes', 'hyphens', 'rognes', 'mfa', 'violet', 'chrono'];
// (14 nov., passe 2) Le banc frère `design-passe-2.cjs` reprend la MÊME mesure sur les autres écrans.
module.exports = { mesurer, ouvrir, base, pret, srv, PORT, SHOTS, CLES, LARGEURS, THEMES, ECRANS_VOULUS, DETAIL, UID, SESSION, chromium };

if (require.main === module) (async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const total = Object.fromEntries(CLES.map((k) => [k, 0]));
  const rapport = {};
  let mfaVue = 0, ecransVus = 0;
  for (const W of LARGEURS) for (const theme of THEMES) {
    const sombre = theme === 'sombre';
    for (const [nomE, url] of ECRANS) {
      if (ECRANS_VOULUS.length && !ECRANS_VOULUS.includes(nomE)) continue;
      const suf = `${nomE}-${W}-${theme}`;
      let o;
      try {
        o = await ouvrir(nav, { W, sombre, b: base(), url });
        await pret(o.pg);
        let racines = ['.vrm-app-shell', '.vrm-fs'];
        if (nomE === 'loupe') {
          if (o.tel) await o.pg.locator('button[data-recherche-loupe]').first().tap().catch(() => {});
          else { await o.pg.mouse.click(5, 300); await o.pg.keyboard.press('Control+K'); }
          await o.pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 }).catch(() => {});
          await o.pg.evaluate(() => { const el = document.querySelector('[data-recherche-champ]'); if (!el) return; const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, '5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
          await o.pg.waitForSelector('[data-tout-num]', { timeout: 8000 }).catch(() => {});
          await o.pg.waitForTimeout(1200);
          racines = ['[data-recherche-panneau]'];
        }
        if (nomE === 'fiche') {
          await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '5' })));
          await o.pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
          for (let i = 0; i < 40; i++) { const l = await o.pg.evaluate(() => (document.querySelector('[data-fiche-paire]') || { getAttribute: () => '0' }).getAttribute('data-fiche-lecture-en-cours')); if (l === '0') break; await o.pg.waitForTimeout(250); }
          await o.pg.waitForTimeout(1200);
          racines = ['.vrm-fp'];
        }
        const present = await o.pg.evaluate((r) => r.some((s) => document.querySelector(s)), racines);
        if (!present) { console.log(`✗ ${suf} : rien à mesurer (${racines.join(', ')} absent)`); total.cibles++; continue; }
        ecransVus++;
        await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
        // `SUITE=3` : la suite de l'écran, défilée (pour REGARDER, pas pour mesurer).
        for (let i = 1; i <= Number(process.env.SUITE || 0); i++) {
          const ok = await o.pg.evaluate((i) => {
            const c = [document.querySelector('.vrm-fp'), document.querySelector('.vrm-fs [data-defile], .vrm-fs-corps'), document.querySelector('.vrm-main'), document.scrollingElement].filter((x) => x && x.scrollHeight > x.clientHeight + 40)[0];
            if (!c) return false; const avant = c.scrollTop; c.scrollTop = Math.round(c.clientHeight * 0.85) * i; return c.scrollTop !== avant;
          }, i);
          if (!ok) break;
          await o.pg.waitForTimeout(400); await o.pg.screenshot({ path: path.join(SHOTS, `${suf}-suite${i}.png`) });
        }
        await o.pg.evaluate(() => { for (const c of [document.querySelector('.vrm-fp'), document.querySelector('.vrm-main'), document.scrollingElement]) if (c) c.scrollTop = 0; });
        if (nomE === 'parametres' && await o.pg.$('[data-carte-mfa]')) { await o.pg.locator('[data-carte-mfa]').scrollIntoViewIfNeeded().catch(() => {}); await o.pg.waitForTimeout(300); await o.pg.screenshot({ path: path.join(SHOTS, suf + '-mfa.png') }); }
        if (process.env.SONDE) console.log('    sonde :', JSON.stringify(await o.pg.evaluate(process.env.SONDE).catch((e) => String(e))).slice(0, 4000));
        const m = await o.pg.evaluate(mesurer, { tactile: o.tel, sombre, racines });
        if (m.mfaVue) mfaVue++;
        rapport[suf] = m;
        const ligne = CLES.map((k) => `${k} ${m[k].length}`).join(' · ');
        const rouge = CLES.some((k) => m[k].length);
        console.log(`${rouge ? '✗' : '✓'} ${suf} (${m.nTextes} textes, ${m.nCibles} cibles) : ${ligne}`);
        for (const k of CLES) {
          total[k] += m[k].length;
          const vus = new Map();
          for (const x of m[k]) { const cle = JSON.stringify(x); vus.set(cle, (vus.get(cle) || 0) + 1); }
          [...vus.entries()].slice(0, DETAIL).forEach(([c, n]) => console.log(`    ${k}${n > 1 ? ' ×' + n : ''} ${c}`));
        }
        if (o.erreurs.length) console.log('    erreurs JS :', o.erreurs.slice(0, 2).join(' | '));
      } catch (e) { console.log('ÉCHEC', suf, String(e.message || e).slice(0, 200)); total.cibles++; }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  }
  fs.writeFileSync(path.join(SHOTS, 'rapport.json'), JSON.stringify(rapport, null, 1));
  console.log('\nTOTAL :', CLES.map((k) => `${k} ${total[k]}`).join(' · '), `· écrans mesurés ${ecransVus} · carte MFA vue ${mfaVue} fois`);
  if (!ECRANS_VOULUS.length || ECRANS_VOULUS.includes('parametres')) if (!mfaVue) { console.log('✗ la carte « Protège ton compte » n\'a été vue nulle part (le banc ne la mesure pas)'); total.mfa++; }
  const rouges = Object.values(total).reduce((a, b) => a + b, 0);
  console.log(rouges ? `✗ ROUGE — ${rouges} défauts` : '✓ VERT — tout est dans le système');
  console.log('captures :', SHOTS);
  await nav.close(); srv.close();
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
