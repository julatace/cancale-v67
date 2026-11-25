require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES · ACHATS · COLIS · LOUPE AVEC MOINS DE TEXTE (25 nov.) — Julien : « je veux vraiment que tu regardes toute
//  l'application et que dès qu'il y a du texte, tu l'enlèves ; ou alors si c'est vraiment indispensable tu le mets mais
//  tu fais un bel affichage ». Récit : docs/passation/2026-11-25-moins-texte-a.md. Modèle : aujourdhui-moins-texte.cjs.
//
//  L'app RENDUE (dist/), base INVENTÉE (`design-passe.cjs` : 3 comptes, ~1 200 lignes ; aucune donnée réelle, le dépôt
//  est public), extension à jour (la ligne « mets à jour l'extension » n'est pas ce qu'on juge ici). Chaque écran du
//  périmètre est ouvert comme un doigt l'ouvre (segment, rangée, « ⋯ », loupe), puis la page est agrandie à sa hauteur
//  pleine et on mesure :
//    M  MOTS     — les mots d'INTERFACE vus : chaque nœud de texte réellement PEINT (boîte non nulle, ni transparent, ni
//                  rogné par un parent, ni recouvert — `elementFromPoint` —, ni réservé au lecteur d'écran), moins les
//                  DONNÉES (un nombre, une date, un montant, le titre d'un article ou le pseudo d'un compte de la base) :
//                  ≤ MAX (55 % d'origin/main sur la même base, table `AVANT` ci-dessous) ;
//    T  COUPÉ    — aucun chiffre ni titre de rangée/feuille rogné (scrollWidth > clientWidth, débord caché) ;
//    D  DOUBLON  — sur les FICHES (annonce, N°, achat) et la loupe : aucun montant (≥ 10 €) écrit deux fois ;
//    G  GESTES   — chaque geste de l'écran reste là (data-* d'avant, jamais un libellé) ;
//    E  ERREURS  — aucune erreur JS, aucun défilement de côté.
//  Réglages : `BANC_DIST` (un autre build : l'AVANT), `LARGEURS=390,1512`, `THEMES=clair,sombre`, `ECRANS=…`,
//  `SHOTS=<dossier>` (captures à REGARDER + le texte mesuré), `DSF=2`, `MUTATION=phrase|coupe|geste` (rouge attendu).
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const SHOTS = process.env.SHOTS || '';
const MUT = process.env.MUTATION || '';
const liste = (v, d) => String(process.env[v] == null ? d : process.env[v]).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const VOULUS = liste('ECRANS', '');
const DSF = Number(process.env.DSF || 1);
const EXT = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.440.4';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };

// Les mots d'interface d'origin/main (fb8916c4a, 25 nov.) sur CETTE base, par écran et par largeur : le plafond est 55 %.
const AVANT = {
  annonces: { 390: 12, 1512: 208 }, republier: { 390: 45 }, 'annonce-fiche': { 390: 52, 1512: 62 }, 'annonce-gestes': { 390: 31 },
  'annonces-menu': { 390: 42 }, achats: { 390: 169, 1512: 196 }, 'achat-fiche': { 390: 54, 1512: 28 }, 'achats-menu': { 390: 12 },
  colis: { 390: 10, 1512: 1 }, imprimante: { 390: 42, 1512: 42 }, loupe: { 390: 46, 1512: 46 }, 'fiche-num': { 390: 52, 1512: 62 },
};
// Le plafond de chaque écran (sa part des mots d'origin/main) : 0,55 pour un écran de PHRASES (Achats, Republier, la fiche d'un
// achat, l'imprimante, la loupe) ; 0,85 pour un écran dont les mots sont surtout les NOMS DES GESTES (menus « ⋯ », la fiche d'une
// annonce : on ne retire jamais un geste) ; 1 (rien de plus) pour Colis (ses rangées sont le chantier moins-texte-b) et le « ⋯ »
// d'Achats (12 mots, déjà au plus court). Et toute la largeur : la somme ≤ 55 % (`TOTAL`).
const MAX = (e, W) => { const a = (AVANT[e.nom] || {})[W]; return a ? Math.floor(a * (e.plafond || 0.55)) : Infinity; };

// Les écrans : [nom, url, gestes à jouer (dans la page), racine mesurée, gestes qui doivent rester, fiche ?]
const cliquer = (sel) => `(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find((x)=>x.getClientRects().length);if(!e)throw new Error('absent ${sel.replace(/'/g, '')}');e.click();})()`;
const ECRANS = [
  { nom: 'annonces', plafond: 0.85, gestesOrdi: ['[data-tt-ligne]', '[data-eg-publier]'], url: '/?tab=annonces', gestes: ['[data-eg-segment="enligne"]', '[data-eg-segment="apublier"]', '[data-eg-segment="dorment"]', '[data-eg-actions]', '[data-eg-article]', '[data-ad-tri], [data-eg-tri], [data-eg-vue]'] },
  { nom: 'republier', plafond: 0.55, seulTel: true, url: '/?tab=annonces', jouer: [cliquer('[data-eg-segment="arepublier"]')], gestes: ['[data-eg-segment="arepublier"][aria-pressed="true"], [data-eg-segment="arepublier"][aria-checked="true"], [data-eg-etat="arepublier"]'] },
  { nom: 'annonce-fiche', plafond: 0.85, url: '/?tab=annonces', jouer: [`(()=>{const e=document.querySelector('[data-eg-article] .n-ar-corps')||document.querySelector('tr[data-eg-article] td:nth-child(2), [data-eg-article] [data-n-famille="rangee"], [data-eg-article] button');if(!e)throw new Error('pas de rangée');e.click();})()`], fiche: true, gestes: ['[data-fa-site], [data-fiche-site], [data-fa-sites]'] },
  { nom: 'annonce-gestes', plafond: 0.85, url: '/?tab=annonces', jouer: [cliquer('[data-eg-article] .n-ar-plus')], seulTel: true, gestes: ['[data-ad-geste="fiche"]', '[data-ad-geste]'] },
  { nom: 'annonces-menu', plafond: 0.85, seulTel: true, url: '/?tab=annonces', jouer: [cliquer('[data-eg-actions]')], gestes: ['[data-eg-action="recreer"]', '[data-eg-action="baisser"]', '[data-eg-serie-relier]'] },
  { nom: 'achats', plafond: 0.55, gestesOrdi: ['[data-achats-hero]', '[data-tt-ligne]', '[data-achats-serie]', '[data-pel-entree]'], url: '/?tab=achats', gestes: ['[data-achats-hero]', '[data-achats-onglet]', '[data-achat-tx]', '[data-achats-serie]', '[data-pel-entree]', '[data-achats-apres-liste]'] },
  { nom: 'achat-fiche', plafond: 0.55, gestesOrdi: [], url: '/?tab=achats', jouer: [cliquer('[data-achat-tx]')], fiche: true, gestes: ['[data-achat-relier], [data-relier-achat], [data-achat-fiche-relier]'] },
  { nom: 'achats-menu', plafond: 1, url: '/?tab=achats', jouer: [`(()=>{const b=[...document.querySelectorAll('.vrm-main button')].find((x)=>/plus|outils/i.test(x.getAttribute('aria-label')||'')&&x.getClientRects().length);if(!b)throw new Error('pas de ⋯');b.click();})()`], seulTel: true, gestes: [] },
  // Colis = Ventes « À envoyer » : ses RANGÉES sont le chantier d'un autre (moins-texte-b) — elles ne sont pas comptées ici.
  { nom: 'colis', plafond: 1, gestesOrdi: [], url: '/?tab=cat_bord', ignorer: '[data-vn-liste]', gestes: ['[data-vn-liste]', '[data-colis-onglet-choix], [data-vn-onglet]'] },
  { nom: 'imprimante', plafond: 0.55, url: '/?tab=cat_bord', jouer: [`(()=>{try{localStorage.removeItem('vrm_impression_format');}catch(_){} const b=[...document.querySelectorAll('button')].find((x)=>/\\d/.test(x.innerText)&&x.matches('[data-v2-principal], [data-imprimer-lot], .sb-btn-plein, [data-colis-imprimer]')&&x.getClientRects().length)||[...document.querySelectorAll('button')].find((x)=>/Imprimer \\d/.test(x.innerText));if(!b)throw new Error('pas d imprimer');b.click();})()`],
    gestes: ['[data-impr-papier-choix="normale"]', '[data-impr-papier-choix="thermique"]', '[data-impr-papier-choix]:nth-child(3)'] },
  { nom: 'loupe', plafond: 0.55, url: '/?tab=journee', loupe: true, gestes: ['[data-tout-num]', '[data-tout-parcours]', '[data-tout-vente]', '[data-recherche-action="baisser-prix"]', '[data-recherche-action="republier-num"]', '[data-recherche-action="partout-num"]', '[data-recherche-action="stock-num"]'] },
  { nom: 'fiche-num', plafond: 0.85, url: '/?tab=journee', jouer: [`window.dispatchEvent(new CustomEvent('vrm:fiche-paire',{detail:'158'}))`], fiche: true, gestes: ['[data-fiche-paire]'] },
];

function base() {
  const b = P.base();
  const app = b.rows.find((r) => /^ext_appareil_/.test(r.id)); if (app) { app.data.ver = EXT; app.data.code = EXT; }
  // Les DONNÉES de la base (titres, pseudos) : retirées du compte des mots d'interface.
  const titres = new Set(), pseudos = new Set();
  const voir = (o, d) => { if (!o || typeof o !== 'object' || d > 7) return; for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && v.length >= 3 && v.length < 90 && /^(title|titre|login|nom|pseudo|item_title)$/.test(k)) (k === 'login' || k === 'pseudo' ? pseudos : titres).add(v); else if (v && typeof v === 'object') voir(v, d + 1); } };
  for (const r of b.rows) voir(r.data, 0); for (const a of b.accounts || []) { if (a.login) pseudos.add(a.login); }
  b.donnees = [...titres, ...pseudos].sort((x, y) => y.length - x.length);
  return b;
}

async function ouvrir(nav, { W, sombre, e, b }) {
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: e.url, dsf: DSF });
  await pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {});
  let avant = '', egaux = 0;
  for (let k = 0; k < 18 && egaux < 2; k++) { await pg.waitForTimeout(1300); const s = await pg.evaluate(() => { const x = document.querySelector('.vrm-main'); return x ? x.innerText : ''; }); if (s && s === avant) egaux++; else egaux = 0; avant = s; }
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast, [data-toast-numeros] button')) t.click(); }).catch(() => {});
  if (e.loupe) {
    if (W < 600) await pg.locator('button[data-recherche-loupe]').first().tap().catch(() => {});
    else { await pg.mouse.click(5, 300); await pg.keyboard.press('Control+K'); }
    await pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 }).catch(() => {});
    await pg.evaluate(() => { const el = document.querySelector('[data-recherche-champ]'); if (!el) return; const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, '5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await pg.waitForSelector('[data-tout-num]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(1500);
  }
  for (const j of e.jouer || []) { const r = await pg.evaluate(j).then(() => '', (x) => String(x && x.message || x)); if (r) erreurs.push('geste : ' + r.slice(0, 160)); await pg.waitForTimeout(2200); }
  if (MUT && e.nom === 'loupe') await pg.evaluate((mut) => {
    const c = document.querySelector('[data-tout-num]');
    if (mut === 'phrase' && c) { const p = document.createElement('p'); p.textContent = 'Achat, stock, annonces, vente, colis, argent : toute l’histoire de cette paire, rien ne part avant ton toucher, c’est toi qui décides.'; c.appendChild(p); }
    if (mut === 'coupe' && c) { const t = c.querySelector('[data-tout-vente]') || c; const s = document.createElement('span'); s.style.cssText = 'display:block;max-width:30px;overflow:hidden;white-space:nowrap'; s.className = 'n-rangee-titre'; s.textContent = '1 234,56 € reçus'; t.appendChild(s); }
    if (mut === 'geste') { const x = document.querySelector('[data-recherche-action="partout-num"]'); if (x) x.remove(); }
  }, MUT);
  return { ctx, pg, erreurs };
}

// La mesure, DANS la page (la fenêtre a déjà la hauteur de l'écran entier).
const MESURER = ({ donnees, fiche, ignorer }) => {
  const fenetres = [...document.querySelectorAll('[role="dialog"], .vrm-fs, .vrm-fp, [data-recherche-panneau], [data-fiche-paire]')].filter((x) => x.getClientRects().length && (x.innerText || '').trim());
  const racine = fenetres[fenetres.length - 1] || document.querySelector('.vrm-main') || document.body;
  const vu = (el) => {
    for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return false;
    }
    // Le contenu d'un <details> FERMÉ (« Pourquoi ? ») n'est pas peint : seul son <summary> se voit.
    for (let d = el.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) { const sm = d.querySelector(':scope > summary'); if (!sm || !sm.contains(el)) return false; }
    const cs = getComputedStyle(el);
    if (parseFloat(cs.fontSize) < 4) return false;
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(cs.color); if (m && m[4] != null && Number(m[4]) < 0.05) return false;
    return true;
  };
  const morceaux = []; const pourquoi = {};
  const tw = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const t = n.textContent; if (!t || !t.trim()) continue;
    const el = n.parentElement; if (!el || el.closest('svg, script, style, [data-banc-ignore]') || (ignorer && el.closest(ignorer))) continue;
    if (!vu(el)) { pourquoi.vu = (pourquoi.vu || 0) + 1; continue; }
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter((r) => r.width > 1.5 && r.height > 1.5);
    if (!rs.length) { pourquoi.rect = (pourquoi.rect || 0) + 1; continue; }
    // Rogné par un parent (overflow) ou réservé au lecteur d'écran (boîte de 1 px) : pas vu.
    let rogne = false; var rogneQui = '';
    for (let x = el; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x); const b = x.getBoundingClientRect();
      if (cs.display === 'contents') continue;   // aucune boîte : il ne rogne rien
      if (b.width <= 2 || b.height <= 2) { if (cs.overflow !== 'visible' || cs.clip !== 'auto' || cs.clipPath !== 'none') { rogne = true; rogneQui = (x.className || x.tagName) + ' ' + JSON.stringify(b) + ' ' + JSON.stringify(rs[0]); break; } }
      // Un parent qui DÉFILE garde son contenu joignable (on le fait défiler) : seul un débord CACHÉ rogne.
      const r = rs[0]; const cache = (v) => v === 'hidden' || v === 'clip';
      if (cache(cs.overflowX) && (r.right < b.left + 1 || r.left > b.right - 1)) { rogne = true; rogneQui = (x.className || x.tagName) + ' ' + JSON.stringify(b) + ' ' + JSON.stringify(rs[0]); break; }
      if (cache(cs.overflowY) && (r.bottom < b.top + 1 || r.top > b.bottom - 1)) { rogne = true; rogneQui = (x.className || x.tagName) + ' ' + JSON.stringify(b) + ' ' + JSON.stringify(rs[0]); break; }
    }
    if (rogne) { pourquoi.rogne = (pourquoi.rogne || 0) + 1; const k = rogneQui.split(' {')[0]; pourquoi.q = pourquoi.q || {}; pourquoi.q[k] = (pourquoi.q[k] || 0) + 1; continue; }
    // Recouvert (le dessous d'une feuille, une action rangée sous sa rangée) : pas vu.
    const r = rs[0]; const cx = Math.min(window.innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 6))), cy = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const h = document.elementFromPoint(cx, cy);
    if (h && racine.contains(h) && !(el.contains(h) || h.contains(el))) { pourquoi.couvert = (pourquoi.couvert || 0) + 1; continue; }
    morceaux.push(t);
  }
  let texte = morceaux.join(' ');
  const brut = texte;
  for (const d of donnees) if (d && texte.includes(d)) texte = texte.split(d).join(' ⟦d⟧ ');
  // Un nombre (et son unité), une date courte, un montant : des données.
  texte = texte.replace(/(\d)[\s\u202f\u00a0](?=\d)/g, '$1')
    .replace(/[-+−≥~]?\d[\d.,:×/]*\s*(?:€|%|j\b|h\b|min\b|mois\b|ans?\b|jours?\b|(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?)?/gi, ' ⟦n⟧ ');
  // Une lettre seule (l'initiale d'un avatar, « V ») n'est pas un mot lu.
  const mots = texte.split(/\s+/).filter((w) => /[\p{L}]/u.test(w) && w.replace(/[^\p{L}]/gu, '').length > 1 && !/^⟦[dn]⟧$/.test(w) && !/^N°$/i.test(w));
  // T : un chiffre ou un titre rogné.
  const coupes = [];
  for (const e of racine.querySelectorAll('*')) {
    if (!e.getClientRects().length || e.children.length > 2) continue;
    const b = e.getBoundingClientRect(); if (b.width <= 2) continue;
    const own = [...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim(); if (!own) continue;
    const titre = e.matches('h1, h2, h3, [data-recherche-titre], .n-rangee-titre, .n-carte-titre, .n-feuille-titre');
    if (!/\d/.test(own) && !titre) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && (cs.overflow !== 'visible' || cs.overflowX !== 'visible') && /nowrap/.test(cs.whiteSpace)) coupes.push((e.className || e.tagName) + ' « ' + own.slice(0, 40) + ' » ' + e.scrollWidth + '>' + e.clientWidth);
  }
  // D : un montant écrit deux fois (fiches seulement).
  const montants = {}; if (fiche) for (const mm of brut.matchAll(/(\d{1,3}(?:[\s\u202f\u00a0]\d{3})+|\d{2,})(?:,\d{2})?\s?€/g)) { const k = mm[0].replace(/[\s\u202f\u00a0]/g, ''); montants[k] = (montants[k] || 0) + 1; }
  const doubles = Object.entries(montants).filter(([, k]) => k > 1).map(([k, x]) => k + '×' + x);
  return { pourquoi, mots: mots.length, liste: mots, texte: brut, coupes, doubles, racine: racine.className || racine.tagName, debord: document.documentElement.scrollWidth > window.innerWidth + 1 };
};

(async () => {
  const b = base();
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const resume = []; const total = {};
  try {
    for (const W of LARGEURS) for (const theme of THEMES) for (const e of ECRANS) {
      if (VOULUS.length && !VOULUS.includes(e.nom)) continue;
      if (e.seulTel && W >= 600) continue;
      const nom = `${e.nom}-${W}-${theme}`;
      console.log(`\n▶ ${nom}`);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: theme === 'sombre', e, b });
      try {
        // La page entière : la fenêtre prend la hauteur de ce qui défile (rien n'est « sous le pli »).
        const h = await pg.evaluate(() => { let m = document.documentElement.scrollHeight; for (const x of document.querySelectorAll('body *')) { const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowY) && x.scrollHeight > x.clientHeight + 4) m = Math.max(m, x.scrollHeight + x.getBoundingClientRect().top + 120); } return Math.ceil(m); });
        const v = pg.viewportSize(); await pg.setViewportSize({ width: v.width, height: Math.min(7000, Math.max(v.height, h)) }); await pg.waitForTimeout(900);
        const r = await pg.evaluate(MESURER, { donnees: b.donnees, fiche: !!e.fiche, ignorer: e.ignorer || '' });
        if (process.env.SONDE) console.log('    sonde :', JSON.stringify(await pg.evaluate(process.env.SONDE).catch((x) => String(x))).slice(0, 3000));
        const gManque = [];
        for (const g of (W < 600 ? e.gestes : (e.gestesOrdi || e.gestes))) if (!(await pg.$(g))) gManque.push(g);
        resume.push(`${nom} ${r.mots}`);
        if (theme === THEMES[0] && (AVANT[e.nom] || {})[W]) { const t = total[W] = total[W] || { av: 0, ap: 0 }; t.av += AVANT[e.nom][W]; t.ap += r.mots; } if (process.env.DEBUG) console.log('   ', r.racine, JSON.stringify(r.pourquoi));
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, nom + '.txt'), r.texte + '\n\n── mots d\'interface (' + r.mots + ') ──\n' + r.liste.join(' ')); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); }
        dit(!erreurs.length, 'E aucune erreur JS', erreurs);
        dit(!r.debord, 'E aucun défilement de côté');
        dit(r.mots <= MAX(e, W), `M mots d'interface ${r.mots} ≤ ${MAX(e, W) === Infinity ? '∞ (pas de mesure d’avant)' : MAX(e, W)}`, r.liste.join(' '));
        dit(!r.coupes.length, 'T aucun chiffre ni titre coupé', r.coupes);
        if (e.fiche) dit(!r.doubles.length, 'D aucun montant écrit deux fois', r.doubles);
        dit(!gManque.length, 'G chaque geste est là', gManque);
      } catch (x) { dit(false, 'mesure ' + nom, String(x && x.stack || x).slice(0, 400)); }
      await ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log('\nMots d\'interface : ' + resume.join(' · '));
  // TOUT le périmètre, par largeur : la somme des mots d'interface ≤ 55 % d'origin/main (seulement quand tous les écrans ont tourné).
  if (!VOULUS.length) for (const [W, t] of Object.entries(total)) dit(t.ap <= Math.floor(t.av * 0.55), `M tout le périmètre à ${W} px : ${t.ap} mots ≤ ${Math.floor(t.av * 0.55)} (55 % de ${t.av})`);
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
