require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MA JOURNÉE · STUDIO BLEU CLAIR » (14 nov. 2026, décision de Julien)
//        npm run build && node scripts/bancs/studio-journee.cjs [dist]
//        SHOTS=dossier  AVANT=dist-d-avant (inventaire comparé)  LARGEURS=390,1512  THEMES=clair,sombre
//        MUTATION=deux-pleins|deborde|contraste|petit|perdu (chacune doit rendre le banc ROUGE)
//
//  Données : le MODE EXEMPLE (`/?exemple`, données inventées, aucune base, aucune écriture) —
//  le dépôt est public, rien de réel ici. On juge des `data-*`, des tailles et des couleurs
//  rendues, jamais un libellé.
//   T  chaque tuile est là avec SON geste réel : « À envoyer » (le rond d'encre « Imprimer »
//      quand un bordereau est prêt, le parcours d'impression d'avant), « À retirer » (les codes
//      en grandes plaques), « Messages », « Prix à baisser », le mois (Vendu · Reçu · Bénéfice,
//      `data-journee-benef`, son « Modifier ») ; leurs compteurs (`data-tuile`, `data-n`) UNE fois.
//   D  toucher une tuile la déplie (`data-sj-deplie`) ; au téléphone la grille se tasse en une
//      rangée de chiffres et l'affiche s'efface ; sur ordinateur la grille reste ; « × » replie
//      et rend la main à la tuile.
//   P  un seul bouton plein visible (fermé ET déplié).
//   C  cibles au doigt : chaque bouton visible de l'écran ≥ 44 × 44 px (390 tactile).
//   A  contraste AA MESURÉ sur les jetons rendus (encre, encre 2, ambre, lien sur porcelaine, creux,
//      haut / aplat / bas du fond) ET sur chaque texte visible d'une tuile.
//   O  rien ne déborde : ni la page, ni une tuile (chaque descendant tient dans sa tuile).
//   I  aucune fonction perdue : l'inventaire des fonctions de l'écran (marqueurs `data-*`) est
//      présent ; avec AVANT=…, celui d'avant est mesuré et chaque fonction d'avant doit être là
//      (les seules différences voulues sont nommées dans `REMPLACES`).
//   E  aucune erreur JS.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const AVANT = process.env.AVANT || '';
const PORT = Number(process.env.BANC_PORT) || 10641;
const SHOTS = process.env.SHOTS || '';
const MUTATION = process.env.MUTATION || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

const serveur = (racine, port) => new Promise((ok) => {
  const s = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(racine, f); if (!p.startsWith(racine) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  s.on('error', (e) => { console.log('KO  le port ' + port + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
  s.listen(port, () => ok(s));
});

async function ouvrir(nav, port, { W, sombre }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript((sombre) => { try { if (!sessionStorage.getItem('banc_sj')) { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); sessionStorage.setItem('banc_sj', '1'); } } catch (_) {} }, sombre);
  await pg.route(/supabase\.co/i, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: '[]' }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)(?!.*supabase\.co)/i, (r) => r.abort());
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${port}/?exemple`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie'); }, null, { timeout: 30000 }).catch(() => {});
  await pg.waitForSelector('.vrm-fu-journee [data-jv2-argent]', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(1800);
  return { ctx, pg, erreurs, tel };
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

// ── L'INVENTAIRE : une fonction de l'écran = un marqueur rendu (présent dans le DOM, caché compris :
//    une carte cachée par « Modifier ma journée » reste une fonction). ─────────────────────────────
const MARQUEURS = {
  'bonjour': '.vrm-fu-bonjour',
  'titre': '.vrm-fu-titre-tete',
  'phrase du jour / aide': '[data-phrase-jour], .vrm-fu-phrase-tete',
  'vendu du jour (frise)': '[data-jv2-argent] [data-jv2-vendu]',
  'les 7 jours qui se touchent': '[data-jv2-toucher]',
  'la semaine passée': '[data-jv2-semaine]',
  'Ma semaine': '[data-ouvre-ma-semaine]',
  'la pile des ventes du jour': '[data-jv2-pile]',
  'les faits du jour (ventes, versé, colis)': '[data-journal-case="ventes"]',
  'chiffres du mois (carte réglable)': '[data-carte-stats="journee"]',
  'Modifier les chiffres': '[data-carte-modifier="journee"]',
  'bénéfice du mois': '[data-journee-benef]',
  'case À envoyer': '[data-tuile="envoyer"]',
  'case À retirer': '[data-tuile="retirer"]',
  'case Messages': '[data-tuile="messages"]',
  'case Prix à baisser': '[data-tuile="prix"]',
  'imprimer les prêts': '[data-sj-imprimer], [data-fu-principal]',
  'liste À faire et son compte': '[data-fu-gestes]',
  // (15 nov., refonte-journee — Julien : « tu peux enlever ») « À trancher » vit dans la feuille « Tout va bien ? » : sa
  // ligne (`data-tvb-ligne`) est la porte sur Ma journée.
  'À trancher (en place)': '[data-at-journee], [data-job="a-trancher"], [data-tvb-ligne]',
  'prévision du mois': '[data-argent-plus="prevision-ligne"]',
  'Modifier ma journée': '[data-jp-modifier]',
};
// Ce qui a changé de forme EXPRÈS (et où c'est passé) : jamais une fonction perdue.
const REMPLACES = {
  'prochaine chose en tête (data-prochain)': 'la carte reste dans « À faire » (même data-job) ; les tuiles portent les gestes du jour',
};
const inventaire = (pg) => pg.evaluate((M) => {
  const out = {};
  for (const [nom, sel] of Object.entries(M)) out[nom] = document.querySelectorAll(sel).length;
  out.__jobs = [...new Set([...document.querySelectorAll('.vrm-fu-journee [data-job]')].map((e) => e.getAttribute('data-job')))].sort();
  out.__tuiles = [...document.querySelectorAll('[data-tuile]')].map((e) => e.getAttribute('data-tuile') + '=' + e.getAttribute('data-n')).sort();
  return out;
}, MARQUEURS);

// ── LA MESURE ──────────────────────────────────────────────────────────────────────────────
const mesure = (pg) => pg.evaluate(() => {
  const ecran = document.querySelector('.sj-journee');
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false; } return true; };
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  if (!ecran) return { ecran: false };
  const tuiles = [...ecran.querySelectorAll('[data-sj-tuile]')].map((t) => ({ id: t.getAttribute('data-sj-tuile'), taille: t.getAttribute('data-taille'), vis: vis(t), box: R(t),
    zone: !!t.querySelector('[data-sj-zone]'), plein: !!t.querySelector('.sb-btn-plein'), codes: t.querySelectorAll('.sb-plaque--grande').length,
    deborde: [...t.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('.vrm-sr-seul, .vrm-sr')).map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => { const T = t.getBoundingClientRect(); return r.left < T.left - 1 || r.right > T.right + 1 || r.top < T.top - 1 || r.bottom > T.bottom + 1; }).map(({ e }) => (e.className && String(e.className).slice(0, 40)) || e.tagName).slice(0, 4) }));
  const pleins = [...document.querySelectorAll('.sb-btn-plein')].filter(vis).length;
  const petits = [...ecran.querySelectorAll('button, a[href], [role="button"]')].filter(vis).filter((e) => !e.closest('.vrm-sr-seul') && !e.closest('[data-feuille-journee-perso]'))
    .map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width < 43.5 || r.height < 43.5)
    .map(({ e, r }) => `${(e.getAttribute('data-sj-zone') && 'zone:' + e.getAttribute('data-sj-zone')) || (e.className && String(e.className).slice(0, 36)) || e.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`);
  // Contraste : les jetons RENDUS (custom properties de l'écran).
  const cs = getComputedStyle(ecran);
  const v = (n) => cs.getPropertyValue(n).trim();
  const hexRgb = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(h); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const rgbDe = (s) => { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(s); return m ? [+m[1], +m[2], +m[3]] : hexRgb(s); };
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  // (15 nov., « Verre dépoli ») Le contrôle juge la RÈGLE — l'encre sur CE SUR QUOI ELLE EST POSÉE — et plus une
  // matière figée : la porcelaine peut être un VERRE (translucide) ; elle se juge alors recomposée sur le haut ET
  // le bas du fond (le pire des deux). L'encre sombre ne se pose sur le fond que si le fond est clair : avec un
  // fond profond (le verre), ce qui est posé sur le fond est à l'encre CLAIRE (--sv-clair*), jugée sur le haut et le bas.
  const rgbaDe = (s) => { s = String(s || '').trim(); const h = hexRgb(s); if (h) return [...h, 1]; const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/.exec(s); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const sur = (h, b) => [0, 1, 2].map((i) => h[i] * h[3] + b[i] * (1 - h[3]));
  const bouts = ['--sb-haut', '--sb-aplat', '--sb-bas'].map((n) => hexRgb(v(n))).filter(Boolean);
  const pose = (n) => { const c = rgbaDe(v(n)); if (!c) return []; return c[3] >= 0.999 ? [c.slice(0, 3)] : bouts.map((b) => sur(c, b)); };
  const fondClair = bouts.length && Math.min(...bouts.map(lum)) > 0.18;
  const fonds = ['--sb-porcelaine', '--sb-porcelaine-2', '--sb-creux'].concat(fondClair ? ['--sb-haut', '--sb-aplat', '--sb-bas'] : []);
  const encres = ['--sb-encre', '--sb-encre-2', '--sb-ambre', '--sb-lien'];
  const paires = [];
  for (const e of encres) for (const f of fonds) { const a = hexRgb(v(e)), bs = pose(f); paires.push({ e, f, r: a && bs.length ? Math.round(Math.min(...bs.map((b) => ratio(a, b))) * 100) / 100 : 0 }); }
  if (!fondClair) for (const e of ['--sv-clair', '--sv-clair-2']) for (const f of ['--sb-haut', '--sb-aplat', '--sb-bas']) { const a = hexRgb(v(e)), b = hexRgb(v(f)); paires.push({ e, f, r: a && b ? Math.round(ratio(a, b) * 100) / 100 : 0 }); }
  // Chaque texte visible d'une tuile, contre le fond le plus clair (clair) / le plus sombre (nuit) de la porcelaine (recomposée si verre).
  const porc = [...pose('--sb-porcelaine'), ...pose('--sb-porcelaine-2')];
  const textes = [];
  for (const t of ecran.querySelectorAll('[data-sj-tuile]')) {
    if (t.classList.contains('is-actif')) continue;
    for (const n of t.querySelectorAll('*')) {
      if (!vis(n) || n.closest('.vrm-sr-seul, .vrm-pile, .sb-btn-plein, .sb-plaque')) continue;
      const txt = [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
      if (!txt) continue;
      const c = rgbDe(getComputedStyle(n).color); if (!c) continue;
      const r = Math.min(...porc.map((p) => ratio(c, p)));
      textes.push({ txt: txt.slice(0, 24), r: Math.round(r * 100) / 100 });
    }
  }
  return { ecran: true, ordi: ecran.getAttribute('data-sj-ordi'), tuiles, pleins, petits, paires, textes,
    page: { sw: document.documentElement.scrollWidth, iw: innerWidth, deborde: [...ecran.querySelectorAll('*')].filter(vis).filter((e) => e.getBoundingClientRect().right > innerWidth + 1).map((e) => (e.className && String(e.className).slice(0, 40)) || e.tagName).slice(0, 5) },
    compteurs: [...document.querySelectorAll('[data-tuile]')].map((e) => e.getAttribute('data-tuile')) };
});

const muter = async (pg) => {
  if (!MUTATION) return;
  await pg.evaluate((m) => {
    const t = document.querySelector('[data-sj-tuile="messages"]') || document.querySelector('[data-sj-tuile]');
    if (m === 'deux-pleins' && t) { const b = document.createElement('button'); b.className = 'sb-btn-plein'; b.textContent = 'X'; t.appendChild(b); }
    if (m === 'deborde' && t) { const s = document.createElement('span'); s.textContent = 'un texte beaucoup trop long qui sort de sa tuile'; s.style.cssText = 'position:absolute;left:0;top:40px;white-space:nowrap;width:900px'; t.appendChild(s); }
    if (m === 'contraste') document.querySelector('.sj-journee').style.setProperty('--sb-encre-2', '#B9C6D3', 'important');
    if (m === 'petit') { const z = document.querySelector('[data-sj-zone]'); if (z) z.style.setProperty('height', '30px', 'important'); if (z) z.style.setProperty('inset', 'auto', 'important'); }
    if (m === 'perdu') { const x = document.querySelector('[data-jv2-semaine]'); if (x) x.remove(); }
  }, MUTATION);
};

async function jouer(nav, port, W, sombre) {
  const T = `${W}px ${sombre ? 'sombre' : 'clair'}`;
  const o = await ouvrir(nav, port, { W, sombre });
  const { pg } = o;
  try {
    await muter(pg);
    await capture(pg, `sj-${W}-${sombre ? 'sombre' : 'clair'}`);
    const m = await mesure(pg);
    dit(m.ecran, `${T} Ma journée est en grille Studio (.sj-journee)`);
    if (!m.ecran) return null;
    const id = (k) => m.tuiles.find((t) => t.id === k);
    // T — les tuiles et leur geste réel
    const env = id('envoyer'), ret = id('retirer'), msg = id('messages'), prix = id('prix'), mois = id('mois');
    dit(env && env.vis && env.zone && env.plein, `${T} T « À envoyer » : tuile, zone qui la déplie, et le rond d'encre « Imprimer » (un bordereau prêt dans l'exemple)`, JSON.stringify(env));
    dit(ret && ret.vis && ret.codes >= 1, `${T} T « À retirer » : les codes en grandes plaques`, JSON.stringify(ret));
    dit(msg && msg.vis && msg.zone, `${T} T « Messages » : une tuile qui se déplie`, JSON.stringify(msg));
    // « Prix à baisser » : une tuile de la grille stable, même à zéro (calme) — elle se déplie (« Aucun prix à baisser »).
    dit(prix && prix.vis && prix.zone, `${T} T « Prix à baisser » : une tuile qui se déplie (à zéro, calme)`, JSON.stringify(prix));
    dit(mois && mois.vis && !mois.zone, `${T} T le mois : sa tuile, ses propres gestes (aucune zone par-dessus)`);
    const dbl = m.compteurs.filter((x, i, a) => a.indexOf(x) !== i);
    dit(dbl.length === 0 && ['envoyer', 'retirer', 'messages', 'prix'].every((k) => m.compteurs.includes(k)), `${T} T chaque compteur (data-tuile) est publié UNE fois`, JSON.stringify(m.compteurs));
    // P
    dit(m.pleins === 1, `${T} P un seul bouton plein visible (fermé)`, m.pleins);
    // C
    if (o.tel) dit(m.petits.length === 0, `${T} C chaque bouton visible ≥ 44 × 44 px`, m.petits.join(' · '));
    // A
    const sous = m.paires.filter((p) => p.r < 4.5);
    dit(sous.length === 0, `${T} A jetons rendus : ${m.paires.length} paires encre/fond ≥ 4,5:1 (min ${Math.min(...m.paires.map((p) => p.r))})`, JSON.stringify(sous));
    const tsous = m.textes.filter((t) => t.r < 4.5);
    dit(m.textes.length > 5 && tsous.length === 0, `${T} A ${m.textes.length} textes des tuiles ≥ 4,5:1 sur la porcelaine (min ${m.textes.length ? Math.min(...m.textes.map((t) => t.r)) : '—'})`, JSON.stringify(tsous.slice(0, 5)));
    // O
    dit(m.page.sw <= m.page.iw + 1 && m.page.deborde.length === 0, `${T} O la page ne déborde pas`, JSON.stringify(m.page));
    const deb = m.tuiles.filter((t) => t.deborde.length);
    dit(deb.length === 0, `${T} O rien ne sort d'une tuile`, JSON.stringify(deb.map((t) => [t.id, t.deborde])));
    // D — déplier / replier chaque tuile dépliable
    for (const t of m.tuiles.filter((x) => x.zone)) {
      await pg.click(`[data-sj-zone="${t.id}"]`);
      await pg.waitForSelector(`[data-sj-deplie="${t.id}"]`, { timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(450);
      const d = await pg.evaluate((id) => {
        const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        const p = document.querySelector(`[data-sj-deplie="${id}"]`);
        const grille = document.querySelector('[data-sj-grille]'), tasse = document.querySelector('[data-sj-tasse]'), aff = document.querySelector('[data-sj-affiche]');
        const z = document.querySelector(`[data-sj-zone="${id}"]`);
        const pleins = [...document.querySelectorAll('.sb-btn-plein')].filter((e) => vis(e) && e.getBoundingClientRect().width > 0).length;
        const r = p ? p.getBoundingClientRect() : null;
        return { ouvert: vis(p), largeur: r ? Math.round(r.width) : 0, grille: vis(grille), tasse: vis(tasse), affiche: vis(aff), expanded: z ? z.getAttribute('aria-expanded') : null, pleins,
          contenu: p ? p.querySelectorAll('.sj-rangee, .sj-code-rangee, .vrm-day-task, .sb-lien, .sj-vide').length : 0 };
      }, t.id);
      const ecranW = o.tel ? 390 : 0;
      dit(d.ouvert && d.expanded === 'true' && d.contenu > 0, `${T} D « ${t.id} » se déplie sur place, avec sa liste et son geste`, JSON.stringify(d));
      if (o.tel) dit(!d.grille && d.tasse && !d.affiche && d.largeur >= ecranW - 40, `${T} D « ${t.id} » au téléphone : pleine largeur, les autres tassées, l'affiche effacée`, JSON.stringify(d));
      else dit(d.grille && !d.tasse, `${T} D « ${t.id} » sur ordinateur : la grille reste en haut, le déplié dessous`, JSON.stringify(d));
      dit(d.pleins <= 1, `${T} P « ${t.id} » déplié : au plus un bouton plein`, d.pleins);
      if (t.id === 'envoyer') await capture(pg, `sj-${W}-${sombre ? 'sombre' : 'clair'}-envoyer`);
      if (t.id === 'retirer') await capture(pg, `sj-${W}-${sombre ? 'sombre' : 'clair'}-retirer`);
      await pg.click('[data-sj-fermer]');
      await pg.waitForTimeout(250);
      const f = await pg.evaluate((id) => ({ ferme: !document.querySelector(`[data-sj-deplie="${id}"]`), focus: document.activeElement && document.activeElement.getAttribute('data-sj-zone') }), t.id);
      dit(f.ferme && f.focus === t.id, `${T} D « ${t.id} » : « × » replie et rend la main à la tuile`, JSON.stringify(f));
    }
    // I
    const inv = await inventaire(pg);
    const manque = Object.keys(MARQUEURS).filter((k) => !inv[k]);
    dit(manque.length === 0, `${T} I les ${Object.keys(MARQUEURS).length} fonctions de l'écran sont là`, manque.join(', '));
    // E
    dit(o.erreurs.length === 0, `${T} E aucune erreur JS`, o.erreurs.join(' | '));
    return inv;
  } finally { await o.ctx.close(); }
}

async function inventaireAvant(nav) {
  const s = await serveur(AVANT, PORT + 1);
  try {
    const o = await ouvrir(nav, PORT + 1, { W: 390, sombre: false });
    const inv = await inventaire(o.pg);
    await o.ctx.close();
    return inv;
  } finally { s.close(); }
}

(async () => {
  const s = await serveur(DIST, PORT);
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    let apres = null;
    for (const W of LARGEURS) for (const th of THEMES) { const inv = await jouer(nav, PORT, W, th === 'sombre'); if (W === 390 && th === 'clair') apres = inv; }
    if (AVANT && apres) {
      const avant = await inventaireAvant(nav);
      const perdus = Object.keys(MARQUEURS).filter((k) => avant[k] > 0 && !apres[k]);
      dit(perdus.length === 0, `I avant → après : chaque fonction d'avant est encore là (${Object.keys(MARQUEURS).filter((k) => avant[k] > 0).length} mesurées avant)`, perdus.join(', '));
      const jobsPerdus = (avant.__jobs || []).filter((j) => !(apres.__jobs || []).includes(j));
      dit(jobsPerdus.length === 0, `I avant → après : chaque carte « À faire » d'avant est encore là (${(avant.__jobs || []).length} : ${(avant.__jobs || []).join(', ')})`, jobsPerdus.join(', '));
      const nAvant = (avant.__tuiles || []).join(' '), nApres = (apres.__tuiles || []).join(' ');
      dit(nAvant === nApres, `I avant → après : les mêmes compteurs, les mêmes nombres (${nApres})`, `avant ${nAvant}`);
      console.log('    remplacés exprès : ' + Object.entries(REMPLACES).map(([k, v]) => `${k} ⇒ ${v}`).join(' ; '));
    }
  } catch (e) { dit(false, 'le banc a pu s’exécuter', String(e && e.stack || e).slice(0, 400)); }
  finally { await nav.close(); s.close(); }
  console.log(ko ? `\n❌ studio-journee : ${ko} rouge(s)` : '\n✅ studio-journee : tout est vert');
  process.exit(ko ? 1 : 0);
})();
