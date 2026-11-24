require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ARGENT, MESSAGES, PARAMÈTRES VISUELS (24 nov., lot visuel-argent) — docs/passation/2026-11-24-visuel-argent.md
//      npm run build && BANC_PORT=4795 node scripts/bancs/visuel-argent.cjs
//  Base INVENTÉE (aucune donnée réelle) : `volume` d'aujourdhui-propre (3 comptes) + la ligne du CA déclaré à sa forme
//  (comme argent-vintex) + un objectif du mois + deux conversations (une sans photo d'annonce mais avec la photo de
//  l'ACHETEUR — un leurre ; une avec la photo de l'annonce). Tailles 390 (tactile) et 1512, clair et sombre.
//  Ce qui est MESURÉ (data-* et boîtes rendues, jamais un libellé) :
//    O  les nombres montrés sont ceux des PROPRIÉTAIRES : l'anneau = `progressionObjectif` sur le vendu de la rangée
//       (data-arg-vendu) ; les jauges = `jaugeSeuils` (src/microEntreprise.js, exécutée ici sur la même ligne) ; les
//       cartes « À venir » somment l'argent à venir de la rangée ; la couverture = « couts » (k/n) ;
//    S  « pas su » : l'anneau et les jauges sans valeur sont en pointillé, ni pleins ni « 0 » (une base sans ligne publiée) ;
//    C  aucune couleur orange calculée (texte, fond, bord, ombre, image de fond) dans Argent, Messages, Paramètres ;
//    L  décalage de mise en page ≤ 0,02 pendant le chargement d'Argent (les décalages dont la source est dans Argent) ;
//    R  aucun chevauchement de textes dans les pièces neuves (boîtes) ; aucun texte coupé ; cibles ≥ 44 au doigt ;
//    K  contraste ≥ 4,5:1 (3:1 pour un texte ≥ 24 px ou ≥ 18,66 px gras) des textes des pièces neuves ;
//    M  mouvement : 1re arrivée ⇒ animations ≤ 200 ms et décalage ≤ 120 ms ; revisite ⇒ AUCUNE (déjà connu = instantané) ;
//       `prefers-reduced-motion: reduce` ⇒ aucune ;
//    T  toucher → premier contenu : du toucher de l'onglet Argent à son titre rendu (< 100 ms une fois l'écran chargé) ;
//    G  Messages : la tuile de la paire ne prend JAMAIS la photo de l'acheteur (leurre) ; l'avatar du compte porte
//       l'initiale du groupe ; le point non lu est fixe (aucune animation) ;
//    P  Paramètres : chaque section a son médaillon teinté (dégradé), les interrupteurs éteints ont un bord ≥ 3:1.
//  `SHOTS=dossier` garde les captures (regarde-les), `VIDEO=dossier` filme le chargement d'Argent. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const P = require('./design-passe.cjs');
const { baseVolume } = require('./aujourdhui-propre.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-visuel-argent');
const VIDEO = process.env.VIDEO || '';
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const TAILLES = liste('TAILLES', '390,1512'), THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };

const CIBLE = 3000;
const LEURRE = 'https://images1.vinted.net/banc/leurre-acheteur.jpg';
const PAIRE = 'https://images1.vinted.net/banc/paire-annonce.jpg';
function base({ ligne = true, objectif = 'ca' } = {}) {
  const b = baseVolume(); const m = b.main[0].data;
  m.vinted_regime = 'micro'; m.vinted_urssaf_freq = 'mensuel'; m.vrm_urssaf_declare = {};
  m.vinted_buyprice_by_num = { 1: 10, 4: 20 };
  m.vrm_objectif_mois = { v: 1, type: objectif, valeur: CIBLE };
  if (ligne) {
    const mois = [], recu = {}; const d = new Date(); d.setDate(1);
    for (let k = 0; k < 7; k++) { const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const ca = [1840.5, 2604.2, 15070.84, 1988, 2210.4, 1760, 2390][k];
      mois.push({ ym, n: 20 + k * 3, ca, nMasq: 0, caMasq: 0, par: { Vinted: { n: 18 + k * 3, ca: ca - 120 }, Leboncoin: { n: 2, ca: 120 } }, nApres: 0, caApres: 0, nDouble: 0, caDouble: 0, nAilleurs: 0, caAilleurs: 0, declare: null });
      recu[ym] = ca; d.setMonth(d.getMonth() - 1); }
    m.vinted_urssaf_mois = { mois, aDater: null, ecartees: 0, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' }, declare: {}, recu, recuJours: {}, nonComptees: { n: 0, par: {}, parC: {} }, at: Date.now() };
  }
  // Deux conversations neuves sur le premier compte : le leurre (photo de l'ACHETEUR seulement) et la paire (photo de l'annonce).
  const uid = String(b.accounts[0].vinted_user_id);
  let inbox = b.rows.find((r) => r.id === `harvest_${uid}_inbox`);
  if (!inbox) { inbox = { id: `harvest_${uid}_inbox`, data: { capturedAt: new Date().toISOString(), payload: { conversations: [], pagination: { current_page: 1 } } } }; b.rows.push(inbox); }
  const t = new Date(Date.now() - 60000).toISOString();
  inbox.data.capturedAt = new Date().toISOString();
  inbox.data.payload.conversations.unshift(
    { id: 77700001, unread: true, updated_at: t, opposite_user: { id: 5551, login: 'leurre_acheteur', photo: { url: LEURRE } }, item_count: 1, description: 'Bonjour', item_photos: [] },
    { id: 77700002, unread: false, updated_at: t, opposite_user: { id: 5552, login: 'paire_ok' }, item_count: 1, description: 'Merci', item_photos: [{ url: PAIRE }] });
  return b;
}

const ORANGE = (racines) => {
  const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2; if (M === m) return [0, 0, l]; const d = M - m; const s = l > .5 ? d / (2 - M - m) : d / (M + m); let h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; };
  const out = [];
  const juger = (el, prop, v) => { for (const m of String(v).matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)) { if (m[4] != null && Number(m[4]) < 0.15) continue; const [h, s, l] = hsl(+m[1], +m[2], +m[3]); if (h >= 15 && h <= 50 && s >= 0.3 && l >= 0.2 && l <= 0.85) { const chaine = []; for (let x = el; x && chaine.length < 4; x = x.parentElement) chaine.push((typeof x.className === 'string' && x.className ? x.className.split(' ')[0] : x.tagName.toLowerCase())); out.push(`${chaine.join('<')} ${prop} ${m[0]}`); } } };
  // Seuls les éléments RENDUS comptent (les cartes d'avant restent montées cachées) ; un logo de marque (Leboncoin…) garde ses couleurs.
  const rendu = (e) => { if (!e.getClientRects().length) return false; for (let x = e; x; x = x.parentElement) { if (x.hidden) return false; const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  for (const sel of racines) for (const r of document.querySelectorAll(sel)) for (const el of [r, ...r.querySelectorAll('*')]) {
    if (!rendu(el) || el.closest('[data-logo-site], .vrm-logo-site')) continue;
    // Un logo de MARQUE (le « G » de Google, `data-marque`) garde ses couleurs officielles.
    if (el.closest('[data-marque]')) continue;
    const cs = getComputedStyle(el); for (const p of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'boxShadow', 'fill', 'stroke', 'backgroundImage', 'outlineColor']) juger(el, p, cs[p]);
    for (const ps of ['::before', '::after']) { const c2 = getComputedStyle(el, ps); if (c2.content && c2.content !== 'none') for (const p of ['backgroundColor', 'backgroundImage', 'boxShadow', 'color']) juger(el, ps + p, c2[p]); } }
  return [...new Set(out)].slice(0, 10);
};

// Textes des pièces neuves : chevauchements, coupures, contraste, cibles.
const PIECES = ['.n-agv-obj', '.n-agv-jauge', '.n-agv-seuils-ca', '.n-agv-av-carte', '.n-arg-l-visuel', '.n-arg-recu-ligne'];
const MESURE_PIECES = (sels) => {
  const vu = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || x.hidden) return false; } return true; };
  const feuilles = (r) => [...r.querySelectorAll('*')].filter((e) => vu(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const lum = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c); if (!m) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return { l: 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]), a: m[4] == null ? 1 : +m[4], rgb: [+m[1], +m[2], +m[3]] }; };
  const fond = (e) => { let acc = null; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); const c = lum(cs.backgroundColor); if (c && c.a >= 0.95) return c; if (/gradient/.test(cs.backgroundImage) && x !== e) return null; } return lum(getComputedStyle(document.body).backgroundColor) || acc; };
  const chev = [], coupes = [], contrastes = [], cibles = [];
  for (const sel of sels) for (const p of document.querySelectorAll(sel)) { if (!vu(p)) continue;
    const L = feuilles(p);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { if (L[i].contains(L[j]) || L[j].contains(L[i])) continue;
      const a = L[i].getBoundingClientRect(), b = L[j].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 2) chev.push(sel + ' « ' + L[i].textContent.trim().slice(0, 20) + ' » / « ' + L[j].textContent.trim().slice(0, 20) + ' »'); }
    for (const e of L) { const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && cs.textOverflow === 'ellipsis' && !e.closest('.v2m-nom, .v2m-extrait')) coupes.push(sel + ' ' + e.textContent.trim().slice(0, 30));
      const t = lum(cs.color), f = fond(e); if (!t || !f) continue;
      const L1 = Math.max(t.l, f.l), L2 = Math.min(t.l, f.l); const r = (L1 + 0.05) / (L2 + 0.05);
      const grand = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      if (r < (grand ? 3 : 4.5) && !e.closest('.vrm-sensible')) contrastes.push(sel + ' ' + e.textContent.trim().slice(0, 20) + ' ' + r.toFixed(2)); }
    const btn = p.matches('button') ? [p] : [...p.querySelectorAll('button')];
    for (const e of btn) { if (!vu(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) cibles.push(sel + ' ' + Math.round(r.width) + '×' + Math.round(r.height)); } }
  return { chev: [...new Set(chev)].slice(0, 8), coupes: [...new Set(coupes)].slice(0, 8), contrastes: [...new Set(contrastes)].slice(0, 8), cibles: [...new Set(cibles)].slice(0, 8), deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
};

const MESURE_ARGENT = () => {
  const g = (s) => document.querySelector(s); const a = (e, k) => (e ? e.getAttribute(k) : null);
  const obj = g('[data-agv-objectif]'), ann = obj && obj.querySelector('.n-anneau');
  const seuils = g('[data-agv-seuils]');
  const j = (k) => { const e = g(`[data-agv-jauge="${k}"]`); return e ? { su: a(e, 'data-agv-jauge-su'), pct: a(e, 'data-agv-jauge-pct'), seuil: a(e, 'data-agv-jauge-seuil'), plein: !!e.querySelector('.n-agv-jauge-plein'), texte: e.innerText } : null; };
  const cartes = [...document.querySelectorAll('[data-agv-etape]')].map((e) => ({ etape: a(e, 'data-agv-etape'), eur: Number(a(e, 'data-eur')), n: Number(a(e, 'data-agv-n')) }));
  const attente = g('[data-v2-argent-fait="attente"]');
  const couts = g('[data-v2-argent-fait="couts"]');
  const couv = g('[data-agv-couv]');
  const barreV = g('[data-agv-barre="vendu"]'), barreB = g('[data-agv-barre="benefice"]');
  const benef = g('[data-v2-argent-fait="benefice"]');
  const mois = g('[data-v2-argent-mois]');
  const zeros = mois ? [...mois.querySelectorAll('.n-anneau-centre, .n-agv-jauge-pct, .n-agv-seuils-ca-v')].map((e) => e.innerText.trim()).filter((t) => /^0(?:[,.]0+)?\s?(?:%|€)?$/.test(t)) : [];
  // Z — un mois passé que l'historique lu ne couvre pas (aucune vente lue avant lui) : « — », jamais « 0 € ».
  const m6 = [...document.querySelectorAll('[data-arg-m6]')].map((e) => ({ ym: a(e, 'data-arg-m6'), v: a(e, 'data-arg-m6-v'), couvert: a(e, 'data-arg-m6-couvert'), texte: (e.querySelector('.n-arg-m6-v') || {}).textContent || '' }));
  // F — un même format partout : tout montant de 4 chiffres ou plus porte l'espace des milliers, en chiffres tabulaires.
  const sansEspace = mois ? [...mois.querySelectorAll('[data-arg-montant], .n-anneau-centre')].map((e) => e.textContent.trim()).filter((t) => /\d{4,}/.test(t.replace(/[.,]\d+/g, ''))) : [];
  const nonTab = ['.n-arg-recu-chiffre', '.n-arg-m6-v'].filter((sel) => { const e = g(sel); return e && !/tabular-nums/.test(getComputedStyle(e).fontVariantNumeric); });
  return { m6, sansEspace, nonTab, rendu: !!mois, vendu: a(g('[data-arg-vendu]'), 'data-arg-vendu'), obj: obj ? { etat: a(obj, 'data-agv-objectif'), pct: a(obj, 'data-agv-objectif-pct'), cible: a(obj, 'data-agv-objectif-cible'), su: a(ann, 'data-n-anneau-su'), part: a(ann, 'data-n-anneau-part'), plein: !!obj.querySelector('.n-anneau-plein'), centre: obj.querySelector('.n-anneau-centre') ? obj.querySelector('.n-anneau-centre').innerText.trim() : '' } : null,
    seuils: seuils ? { etat: a(seuils, 'data-agv-seuils'), ca: a(seuils, 'data-agv-ca'), plafond: j('plafond'), tva: j('tva') } : null,
    cartes, attente: attente ? a(attente, 'data-v2-argent-valeur') : null, couts: couts ? a(couts, 'data-v2-argent-valeur') : null, couv: a(couv, 'data-agv-couv'),
    barreV: barreV ? a(barreV, 'data-agv-barre-part') : null, barreB: barreB ? a(barreB, 'data-agv-barre-part') : null, benef: a(benef, 'data-v2-argent-valeur'), zeros };
};

const INIT_MESURES = () => {
  window.__cls = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls.push({ v: e.value, t: e.startTime, dans: (e.sources || []).some((s) => s.node && s.node.closest && !!s.node.closest('[data-argent-vue="resume"]')) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
  // Toutes les animations des pièces neuves vues pendant le chargement (nom, durée, délai).
  window.__anims = [];
  const noter = () => { try { for (const an of document.getAnimations()) { const n = an.animationName || ''; if (!/^n-agv|^n-revele/.test(n)) continue; const cible = an.effect && an.effect.target; if (!cible || !cible.closest || !cible.closest('[data-espace="argent"]')) continue; const t = an.effect && an.effect.getTiming ? an.effect.getTiming() : {}; const k = n + '|' + t.duration + '|' + t.delay; if (!window.__anims.some((x) => x.k === k)) window.__anims.push({ k, n, d: Number(t.duration) || 0, delai: Number(t.delay) || 0 }); } } catch (_) {} requestAnimationFrame(noter); };
  requestAnimationFrame(noter);
};

async function ouvrir(nav, { taille, sombre, b, reduit = false, video = '' }) {
  const tel = Number(taille) < 600;
  // Le contexte du harnais (routes, session, base) ; on y ajoute les mesures (posées AVANT le rechargement) et le mouvement réduit.
  const o = await P.ouvrir(nav, { W: tel ? 390 : 1512, sombre, b, url: '/?tab=journee', video });
  await o.pg.addInitScript(INIT_MESURES);
  if (reduit) await o.pg.emulateMedia({ reducedMotion: 'reduce' });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
  return o;
}
async function calme(pg) {
  let avant = '', egaux = 0;
  for (let k = 0; k < 18 && egaux < 2; k++) { await pg.waitForTimeout(900); const s = await pg.evaluate(() => { const e = document.querySelector('.vrm-main'); return e ? e.innerText : ''; }); if (s && s === avant) egaux++; else egaux = 0; avant = s; }
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
}
const defile = (pg, y) => pg.evaluate((y) => { const m = document.querySelector('.vrm-main'); const s = m && m.scrollHeight > m.clientHeight + 4 && getComputedStyle(m).overflowY !== 'visible' ? m : document.scrollingElement; s.scrollTop = y; return s.scrollTop; }, y);
async function photos(pg, nom) {
  const hv = await pg.evaluate(() => window.innerHeight);
  for (let k = 0; k < 4; k++) { const y = await defile(pg, k * (hv - 200)); await pg.waitForTimeout(250); await pg.screenshot({ path: path.join(SHOTS, `${nom}-${k}.png`) }); if (y < k * (hv - 200) - 10) break; }
  await defile(pg, 0);
}
// Toucher l'onglet Argent et mesurer le temps jusqu'à son premier contenu (l'écran d'Argent monté).
async function toucherArgent(pg) {
  return pg.evaluate(() => new Promise((fin) => {
    const bouton = [...document.querySelectorAll('button, a')].find((e) => e.getClientRects().length && /^argent$/i.test((e.innerText || e.getAttribute('aria-label') || '').trim().split('\n').pop().trim()));
    if (!bouton) return fin({ trouve: false });
    const t0 = performance.now(); let reaction = null, premier = null;
    // `reaction` : le premier changement du DOM (l'onglet touché répond) ; `premier` : le premier contenu de l'écran Argent peint
    // (son squelette OU son titre : un élément de [data-espace="argent"] ou de la garde de l'écran, qui a une taille) ;
    // `contenu` : Argent · Mois monté.
    const mo = new MutationObserver(() => {
      if (reaction == null) reaction = performance.now() - t0;
      if (premier == null) { const e = document.querySelector('[data-espace="argent"], [data-garde-ecran="compta"], [data-v2-argent-mois]'); if (e && e.getClientRects().length) premier = performance.now() - t0; }
      if (document.querySelector('[data-v2-argent-mois]')) { mo.disconnect(); requestAnimationFrame(() => fin({ trouve: true, reaction, premier, contenu: performance.now() - t0 })); }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    bouton.click();
    setTimeout(() => { mo.disconnect(); fin({ trouve: true, reaction, premier, contenu: null }); }, 8000);
  }));
}

let J = null;   // la règle des seuils, exécutée ici
async function argent(nav, taille, sombre) {
  const ou = `[argent ${taille} ${sombre ? 'sombre' : 'clair'}]`;
  const b = base();
  const { ctx, pg, erreurs } = await ouvrir(nav, { taille, sombre, b });
  let jauge = null;
  try {
    await calme(pg);
    // T — toucher → premier contenu (1re fois : l'écran se charge ; 2e fois : déjà chargé).
    const t1 = await toucherArgent(pg);
    await pg.waitForSelector('[data-v2-argent-mois]', { timeout: 40000 }).catch(() => {});
    await calme(pg);
    const m = await pg.evaluate(MESURE_ARGENT);
    if (!dit(m.rendu, `${ou} Argent · Mois est rendu`)) return;
    // La ligne PUBLIÉE que l'écran lit (Ventes la republie depuis les ventes) : la règle des seuils exécutée ici dessus.
    const ligne = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); } catch (_) { return null; } });
    jauge = ligne ? J.jaugeSeuils({ ligne, now: new Date(), activite: 'vente' }) : null;
    // O — les nombres des propriétaires.
    const vendu = Number(m.vendu);
    const pctAttendu = Math.max(0, Math.min(100, Math.floor((vendu / 100 / CIBLE) * 100)));
    dit(m.obj && m.obj.etat === 'lu' && Number(m.obj.pct) === pctAttendu && m.obj.cible === String(CIBLE * 100) && Math.abs(Number(m.obj.part) - pctAttendu / 100) < 0.0011,
      `O ${ou} anneau = progressionObjectif(vendu ${vendu / 100} €, objectif ${CIBLE} €) = ${pctAttendu} %`, m.obj);
    dit(!!jauge && m.seuils && m.seuils.ca === String(Math.round(jauge.ca * 100)) && m.seuils.plafond && Number(m.seuils.plafond.pct) === jauge.plafond.pct && Number(m.seuils.tva.pct) === jauge.tva.pct
      && m.seuils.plafond.seuil === String(jauge.plafond.seuil * 100) && m.seuils.tva.seuil === String(jauge.tva.seuil * 100),
      `O ${ou} jauges = jaugeSeuils (CA ${jauge && jauge.ca} €, plafond ${jauge && jauge.plafond.pct} %, TVA ${jauge && jauge.tva.pct} %)`, { ecran: m.seuils, regle: jauge && { ca: jauge.ca, p: jauge.plafond.pct, t: jauge.tva.pct } });
    const somme = m.cartes.reduce((t, c) => t + c.eur, 0);
    dit(m.cartes.length > 0 && m.attente != null && String(somme) === m.attente, `O ${ou} cartes « À venir » (${m.cartes.map((c) => c.etape).join(', ')}) = l'argent à venir de la rangée (${m.attente})`, { somme, attente: m.attente });
    if (m.couv) dit(m.couv === m.couts, `O ${ou} couverture des prix = « couts » (${m.couts})`, m);
    else { const bv = m.benef ? Number(m.benef) / 100 : null; const mx = Math.max(vendu / 100, bv || 0); dit(Math.abs(Number(m.barreV) - (vendu / 100) / mx) < 0.002, `O ${ou} barre du vendu = vendu / max(vendu, bénéfice)`, m); }
    dit(!m.zeros.length, `S ${ou} aucun « 0 » posé à la place d'un nombre`, m.zeros);
    const nonCouverts = m.m6.filter((x) => x.couvert === '0');
    dit(m.m6.length === 6 && nonCouverts.every((x) => x.v === '' && /^—/.test(x.texte.trim())), `Z ${ou} un mois que l'historique lu ne couvre pas dit « — », jamais « 0 € » (${nonCouverts.map((x) => x.ym).join(', ') || 'aucun'})`, m.m6);
    dit(!m.sansEspace.length && !m.nonTab.length, `F ${ou} un seul format : espace des milliers partout, chiffres tabulaires`, { sansEspace: m.sansEspace, nonTab: m.nonTab });
    // C — aucune couleur orange.
    const orange = await pg.evaluate(ORANGE, ['[data-argent-vue="resume"]']);
    dit(!orange.length, `C ${ou} aucune couleur orange calculée dans Argent`, orange);
    // L — décalage de mise en page.
    const cls = await pg.evaluate(() => window.__cls || []);
    const dans = cls.filter((x) => x.dans).reduce((t, x) => t + x.v, 0);
    dit(dans <= 0.02, `L ${ou} décalage de mise en page d'Argent ≤ 0,02 (${dans.toFixed(4)} ; page entière ${cls.reduce((t, x) => t + x.v, 0).toFixed(4)})`);
    // R, K — pièces neuves.
    const r = await pg.evaluate(MESURE_PIECES, PIECES);
    dit(!r.chev.length, `R ${ou} aucun chevauchement de textes`, r.chev);
    dit(!r.coupes.length, `R ${ou} aucun texte coupé`, r.coupes);
    dit(!r.deborde, `R ${ou} la page ne déborde pas en largeur`);
    if (Number(taille) < 600) dit(!r.cibles.length, `R ${ou} cibles ≥ 44 au doigt`, r.cibles);
    dit(!r.contrastes.length, `K ${ou} contraste ≥ 4,5:1 (3:1 en grand)`, r.contrastes);
    // M — 1re arrivée : courtes ; puis revisite : aucune.
    const an1 = await pg.evaluate(() => window.__anims || []);
    dit(an1.every((x) => x.d <= 200 && x.delai <= 120), `M ${ou} 1re arrivée : animations ≤ 200 ms, décalage ≤ 120 ms (${an1.length} sortes)`, an1);
    await photos(pg, `argent-${taille}-${sombre ? 'sombre' : 'clair'}`);
    // Revisite : Aujourd'hui puis Argent.
    await pg.evaluate(() => { const e = [...document.querySelectorAll('button, a')].find((x) => x.getClientRects().length && /aujourd/i.test((x.innerText || x.getAttribute('aria-label') || ''))); if (e) e.click(); });
    await pg.waitForTimeout(1500);
    await pg.evaluate(() => { window.__anims = []; });
    const t2 = await toucherArgent(pg);
    await pg.waitForTimeout(1200);
    const an2 = await pg.evaluate(() => window.__anims || []);
    dit(!an2.length, `M ${ou} revisite : rien ne bouge, déjà connu = instantané`, an2);
    const ms = (x) => (x == null ? '—' : x.toFixed(0) + ' ms');
    // Le premier contenu d'Argent dépend du montage de TOUT l'écran (Comptabilite, pas de ce lot) : rapporté, rouge seulement
    // avec BANC_T_STRICT=1 ; ce lot ne doit rien y AJOUTER : de l'écran monté à Mois rendu ≤ 100 ms.
    const ligneT = `T ${ou} toucher → premier contenu d'Argent : ${ms(t2.premier)} à la revisite (Mois monté ${ms(t2.contenu)} ; 1re fois ${ms(t1.premier)} / ${ms(t1.contenu)})`;
    if (process.env.BANC_T_STRICT === '1') dit(t2.premier != null && t2.premier < 100, ligneT + ' < 100 ms', { t1, t2 }); else console.log('  ℹ️  ' + ligneT);
    dit(t2.contenu != null && t2.premier != null && t2.contenu - t2.premier <= 100, `T ${ou} de l'écran Argent monté à Mois rendu ≤ 100 ms (${ms(t2.contenu != null && t2.premier != null ? t2.contenu - t2.premier : null)})`);
    dit(t2.trouve && t2.reaction != null && t2.reaction < 100, `T ${ou} le toucher réagit en < 100 ms (${t2.reaction == null ? '—' : t2.reaction.toFixed(0)} ms)`);
    dit(!erreurs.length, `${ou} aucune erreur JS`, erreurs);
  } catch (e) { dit(false, `${ou} le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

// S — « pas su » : les pièces rendues SEULES (esbuild + renderToStaticMarkup), avec les valeurs absentes que leurs
// propriétaires rendent (null). La base de l'app publie toujours sa ligne : le « pas su » se juge ici, sans écran.
async function pasSu() {
  const os = require('os');
  const dos = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-va-'));
  const entree = path.join(dos, 'entree.jsx');
  const src = (f) => JSON.stringify(path.join(__dirname, '..', '..', 'src', f));
  fs.writeFileSync(entree, `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
import { JaugesSeuils, AnneauObjectif, BarreChiffre, CouvertureBarre } from ${src('natif/ecrans/ArgentVisuel.jsx')};
const e = (x) => x.toFixed(2).replace('.', ',') + ' €';
export const R = {
  jaugesNull: () => renderToStaticMarkup(React.createElement(JaugesSeuils, { J: null, annee: 2026, montant: e, etat: 'lu' })),
  jaugesEncours: () => renderToStaticMarkup(React.createElement(JaugesSeuils, { J: null, annee: 2026, montant: e, etat: 'encours' })),
  jaugesPartiel: () => renderToStaticMarkup(React.createElement(JaugesSeuils, { J: { ca: 1000, partiel: true, plafond: { pct: 0.5, seuil: 203100, etat: 'ok' }, tva: { pct: 1.2, seuil: 85000, etat: 'ok', majore: 93500 } }, annee: 2026, montant: e })),
  anneauPasSu: () => renderToStaticMarkup(React.createElement(AnneauObjectif, { o: { etat: 'passu', type: 'recu', cible: 3000 }, montant: e })),
  anneauAucun: () => renderToStaticMarkup(React.createElement(AnneauObjectif, { o: { etat: 'aucun' }, montant: e })),
  anneauZero: () => renderToStaticMarkup(React.createElement(AnneauObjectif, { o: { etat: 'lu', type: 'ca', cible: 3000, valeur: 0, pct: 0 }, montant: e })),
  barreNull: () => renderToStaticMarkup(React.createElement(BarreChiffre, { part: null })),
  couv: () => renderToStaticMarkup(React.createElement(CouvertureBarre, { k: 2, n: 5 })),
};`);
  const sortie = path.join(dos, 'sortie.cjs');
  const r = require('child_process').spawnSync(path.join(__dirname, '..', '..', 'node_modules', '.bin', 'esbuild'), [entree, '--bundle', '--platform=node', '--format=cjs', '--jsx=automatic', '--loader:.js=jsx', '--loader:.css=empty', '--loader:.svg=empty', '--loader:.png=empty', '--log-level=error', '--outfile=' + sortie], { encoding: 'utf8', env: { ...process.env, NODE_PATH: path.join(__dirname, '..', '..', 'node_modules') } });
  if (!dit(r.status === 0, 'S les pièces se compilent seules', (r.stderr || '').slice(0, 400))) return;
  const { R } = require(sortie);
  const t = (f) => { try { return R[f](); } catch (e) { return 'ERREUR ' + String(e).slice(0, 200); } };
  const jn = t('jaugesNull');
  dit((jn.match(/data-agv-jauge-su="0"/g) || []).length === 2 && !/n-agv-jauge-plein/.test(jn) && /—/.test(jn) && !/>0[ ,%€<]/.test(jn) && /data-agv-seuils="passu"/.test(jn),
    'S jauges sans ligne publiée (null) ⇒ deux pistes en pointillé « — », jamais pleines ni « 0 »', jn.slice(0, 400));
  const je = t('jaugesEncours');
  dit(/data-agv-seuils="encours"/.test(je) && /n-agv-squelette-jauges/.test(je) && !/n-agv-jauge-plein/.test(je) && !/>0[ ,%€<]/.test(je), 'S jauges en lecture ⇒ un squelette de la forme finale, aucun 0', je.slice(0, 300));
  const jp = t('jaugesPartiel');
  dit(/data-agv-partiel="1"/.test(jp) && /≥ 0,5 %/.test(jp) && /au moins|journee\.moins/.test(jp), 'S CA partiel ⇒ « au moins » et « ≥ » (un minimum le dit)', jp.slice(0, 400));
  const ap = t('anneauPasSu');
  dit(/data-n-anneau-su="0"/.test(ap) && !/n-anneau-plein/.test(ap) && /—/.test(ap) && !/data-n-anneau-part="0/.test(ap), 'S objectif pas su ⇒ anneau en pointillé « — », ni plein ni 0', ap.slice(0, 300));
  dit(t('anneauAucun') === '', 'S pas d\'objectif ⇒ rien (aucune invitation)');
  const az = t('anneauZero');
  dit(/data-n-anneau-su="1"/.test(az) && /data-n-anneau-part="0.000"/.test(az), 'S un vrai 0 lu reste un 0 lu (anneau su, vide)', az.slice(0, 200));
  const bn = t('barreNull');
  dit(/data-agv-barre-su="0"/.test(bn) && !/n-agv-barre-plein/.test(bn), 'S barre pas sue ⇒ pointillé, jamais pleine', bn);
  const cv = t('couv');
  dit((cv.match(/data-plein="1"/g) || []).length === 2 && (cv.match(/<i/g) || []).length === 5 && /data-agv-couv="2\/5"/.test(cv), 'S couverture 2 sur 5 ⇒ 2 cases pleines sur 5', cv);
  fs.rmSync(dos, { recursive: true, force: true });
}

async function reduit(nav, taille) {
  const ou = `[mouvement réduit ${taille}]`;
  const { ctx, pg } = await ouvrir(nav, { taille, sombre: false, b: base(), reduit: true });
  try {
    await calme(pg);
    await pg.evaluate(() => { try { sessionStorage.removeItem('vrm_vu_arrivee'); } catch (_) {} window.__anims = []; });
    await pg.goto(`http://localhost:${P.PORT}/?tab=argent`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-v2-argent-mois]', { timeout: 40000 }).catch(() => {});
    await calme(pg);
    const an = await pg.evaluate(() => window.__anims || []);
    const noms = await pg.evaluate(() => [...document.querySelectorAll('.n-agv-pousse, .n-agv-apparait')].map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none'));
    dit(!an.length && !noms.length, `M ${ou} prefers-reduced-motion ⇒ aucune animation des pièces neuves`, { an, noms });
  } catch (e) { dit(false, `${ou} le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

async function messages(nav, taille, sombre) {
  const ou = `[messages ${taille} ${sombre ? 'sombre' : 'clair'}]`;
  const { ctx, pg, erreurs } = await ouvrir(nav, { taille, sombre, b: base() });
  try {
    await calme(pg);
    await pg.goto(`http://localhost:${P.PORT}/?tab=messages`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.vg-fil', { timeout: 40000 }).catch(() => {});
    await calme(pg);
    const m = await pg.evaluate(() => {
      const lignes = [...document.querySelectorAll('.vg-fil')].filter((l) => l.getClientRects().length);
      const leurre = lignes.find((l) => /77700001/.test(l.getAttribute('data-cible') || ''));
      const toutes = [...document.querySelectorAll('.vg-fil img')].map((i) => i.currentSrc || i.src || '');
      const groupes = [...document.querySelectorAll('[data-msg-groupe]')].map((g) => { const nom = (g.querySelector('.vg-ms-groupe-h b') || {}).textContent || ''; const av = [...g.querySelectorAll('[data-fil-compte-av]')].map((x) => x.textContent); return { nom, av: [...new Set(av)] }; });
      const point = document.querySelector('.vg-fil .vg-fil-nl');
      return { n: lignes.length, tuiles: lignes.filter((l) => l.querySelector('.vg-fil-tuile .n-tuile-paire')).length, photos: lignes.filter((l) => l.querySelector('[data-fil-tuile="photo"]')).length,
        leurreTrouve: !!leurre, leurreMedaillon: leurre ? !!leurre.querySelector('[data-n-tuile-photo="0"]') : null, leurreAilleurs: toutes.some((s) => /leurre-acheteur/.test(s)), groupes,
        pointAnim: point ? getComputedStyle(point).animationName : null, offres: document.querySelectorAll('[data-fil-offre-puce]').length };
    });
    dit(m.n > 0 && m.tuiles === m.n, `G ${ou} chaque fil montre la tuile de la paire (${m.tuiles}/${m.n}, ${m.photos} avec photo)`);
    dit(m.photos > 0, `G ${ou} les paires reliées par identité montrent leur photo (${m.photos})`);
    dit(m.leurreTrouve && m.leurreMedaillon === true && !m.leurreAilleurs, `G ${ou} la photo de l'ACHETEUR n'est jamais prise pour la paire (leurre ⇒ médaillon)`, m);
    dit(m.groupes.length > 0 && m.groupes.every((g) => g.av.length === 1 && g.nom.trim().replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase() === g.av[0]), `G ${ou} l'avatar du compte porte l'initiale de SON groupe`, m.groupes);
    dit(m.pointAnim === 'none', `G ${ou} le point non lu est calme (aucune animation)`, m.pointAnim);
    const orange = await pg.evaluate(ORANGE, ['.vg-ms-groupe']);
    dit(!orange.length, `C ${ou} aucune couleur orange dans Messages`, orange);
    const r = await pg.evaluate(MESURE_PIECES, ['.vg-fil']);
    dit(!r.chev.length, `R ${ou} aucun chevauchement dans les rangées`, r.chev);
    if (Number(taille) < 600) dit(!r.cibles.length, `R ${ou} cibles ≥ 44`, r.cibles);
    dit(!r.contrastes.length, `K ${ou} contraste ≥ 4,5:1`, r.contrastes);
    dit(!r.deborde, `R ${ou} la page ne déborde pas`);
    await photos(pg, `messages-${taille}-${sombre ? 'sombre' : 'clair'}`);
    dit(!erreurs.length, `${ou} aucune erreur JS`, erreurs);
  } catch (e) { dit(false, `${ou} le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

async function parametres(nav, taille, sombre) {
  const ou = `[paramètres ${taille} ${sombre ? 'sombre' : 'clair'}]`;
  const { ctx, pg, erreurs } = await ouvrir(nav, { taille, sombre, b: base() });
  try {
    await calme(pg);
    await pg.goto(`http://localhost:${P.PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-pm-cat]', { timeout: 40000 }).catch(() => {});
    await calme(pg);
    const m = await pg.evaluate(() => {
      // Les médaillons des RANGÉES de sections (la tête d'une section à l'ordinateur garde son icône d'avant).
      const med = [...document.querySelectorAll('[data-pm-cat]')].filter((e) => e.getClientRects().length && !e.closest('.vrm-pm-cat-h'));
      const fond = (e) => (getComputedStyle(e).backgroundImage.match(/rgb\([^)]*\)/g) || ['aucun']).slice(-1)[0];
      return { n: med.length, degrades: med.filter((e) => /gradient/.test(getComputedStyle(e).backgroundImage)).length, teintes: [...new Set(med.map(fond))].length };
    });
    dit(m.n >= 6 && m.degrades === m.n && m.teintes >= 4, `P ${ou} chaque section a son médaillon teinté (${m.degrades}/${m.n}, ${m.teintes} teintes)`, m);
    const orange = await pg.evaluate(ORANGE, ['.vrm-pm']);
    dit(!orange.length, `C ${ou} aucune couleur orange dans Paramètres`, orange);
    await photos(pg, `parametres-${taille}-${sombre ? 'sombre' : 'clair'}`);
    // Un panneau avec des interrupteurs : Notifications.
    await pg.evaluate(() => { const e = document.querySelector('[data-categorie-ouvrir="notifications"]'); if (e) e.click(); });
    await pg.waitForTimeout(1500);
    const s = await pg.evaluate(() => { const L = [...document.querySelectorAll('.vrm-pm .vrm-switch, .vrm-pm .vrm-ios-switch')].filter((e) => e.getClientRects().length);
      const av = (e) => getComputedStyle(e, '::before');
      return { n: L.length, eteints: L.filter((e) => e.getAttribute('aria-checked') !== 'true').map((e) => ({ bord: av(e).boxShadow, glyphe: /radial-gradient/.test(av(e).backgroundImage) })),
        allumes: L.filter((e) => e.getAttribute('aria-checked') === 'true').map((e) => ({ glyphe: /linear-gradient/.test(av(e).backgroundImage), fond: av(e).backgroundColor })) }; });
    dit(s.n > 0 && s.eteints.every((x) => /rgb\((138, 141, 148|142, 142, 150)\)/.test(x.bord) && x.glyphe), `P ${ou} un interrupteur éteint : bord visible (≥ 3:1) et son petit rond (${s.n} interrupteurs)`, s);
    dit(s.allumes.every((x) => x.glyphe), `P ${ou} un interrupteur allumé porte son trait « allumé »`, s);
    await pg.screenshot({ path: path.join(SHOTS, `parametres-notif-${taille}-${sombre ? 'sombre' : 'clair'}.png`) });
    dit(!erreurs.length, `${ou} aucune erreur JS`, erreurs);
  } catch (e) { dit(false, `${ou} le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

// Le film du chargement d'Argent (390, clair) : une session neuve, l'onglet touché depuis Aujourd'hui.
async function film(nav) {
  const o = await ouvrir(nav, { taille: 390, sombre: false, b: base(), video: VIDEO });
  await calme(o.pg);
  await o.pg.evaluate(() => { try { sessionStorage.removeItem('vrm_vu_arrivee'); } catch (_) {} });
  await toucherArgent(o.pg);
  await o.pg.waitForTimeout(2500);
  for (let k = 1; k < 4; k++) { await defile(o.pg, k * 500); await o.pg.waitForTimeout(700); }
  await o.ctx.close();
}

(async () => {
  J = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'microEntreprise.js')).href);
  await pasSu();
  if (process.env.SEUL === 'pur') { console.log(`\n${ko ? '❌' : '✅'} visuel-argent (pièces seules) : ${ok} verts, ${ko} rouges`); process.exit(ko ? 1 : 0); }
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    const PARTIES = liste('PARTIES', 'argent,reduit,messages,parametres');
    if (PARTIES.includes('argent')) for (const taille of TAILLES) for (const t of THEMES) await argent(nav, taille, t === 'sombre');
    if (PARTIES.includes('reduit')) for (const taille of TAILLES) await reduit(nav, taille);
    if (PARTIES.includes('messages')) for (const taille of TAILLES) for (const t of THEMES) await messages(nav, taille, t === 'sombre');
    if (PARTIES.includes('parametres')) for (const taille of TAILLES) for (const t of THEMES) await parametres(nav, taille, t === 'sombre');
    if (VIDEO) await film(nav).catch((e) => console.log('  (film) ' + String(e).slice(0, 200)));
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} visuel-argent : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
