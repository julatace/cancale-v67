// ════════════════════════════════════════════════════════════════════════════
//  BANC « EXT. 5.428 » DANS L'APP (21 nov., choix 58 et 59 de Julien) — le vrai dist/, base INVENTÉE (dépôt public).
//   C. LA COURBE dans la fiche de l'article N°3102 (son annonce Vinted 7699990003) : deux graphiques (vues, favoris),
//      la ligne COUPÉE aux jours non lus (aucun trait au travers), un jour non lu dit « — pas lu », les repères du journal
//      (baisse VRM, republiée, offre aux favoris) et le prix changé MESURÉ ; base illisible ⇒ « — · pas pu être lue ».
//   D. « EN DIRECT » dans Aujourd'hui (et la page Extension) : l'extension simulée (protocole de bridge.js) dit
//      « republie 2/6, en cours » ⇒ « Republie 3/6 » + « Tout arrêter » ; le toucher envoie `toutArreter` (on) ; l'état
//      qui change + `maj · direct` ⇒ la ligne suit SANS recharger ; action figée depuis 10 min ⇒ plus « en cours » ;
//      pas d'extension ⇒ « — · extension pas ouverte ».
//  390 tactile et 1512, clair et sombre ; 44 px ; aucun débordement ; captures (SHOTS) à REGARDER.
//  `BANC_DIST=<dist>` (l'arbre d'avant : ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const E = require('./ecrans-verre-2.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-ext-5428');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 864e5;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
const ITEM = '7699990003';
const jour = (t) => { const d = new Date(t); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / J); };
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'manifest.json'), 'utf8')).version;

function baseCourbe() {
  const b = E.baseFiches();
  const j0 = jour(Date.now());
  // 7 jours lus sur 30 (deux trous au milieu) ; deux navigateurs ; le prix passe de 90 € à 85 € (mesuré) ; repères du journal.
  b.rows.push({ id: 'courbes_annonces_111_navaaaaaaaaaaaa', data: { uid: '111', nav: 'navaaaaaaaaaaaa', v: '5.428.0', a: { [ITEM]: [
    [j0 - 20, 12, 0, 9000, 600], [j0 - 19, 18, 1, 9000, 600], [j0 - 18, 22, 1, 9000, 600], [j0 - 12, 35, 2, 8500, 700], [j0 - 11, 40, 3, 8500, 700]] },
    ev: { [ITEM]: [[j0 - 12, 'p'], [j0 - 5, 'f']] } } });
  b.rows.push({ id: 'courbes_annonces_111_navbbbbbbbbbbbb', data: { uid: '111', nav: 'navbbbbbbbbbbbb', v: '5.428.0', a: { [ITEM]: [[j0 - 1, 58, 4, 8500, 800], [j0, 61, 4, 8500, 900]] }, ev: { [ITEM]: [[j0 - 16, 'r']] } } });
  return b;
}

async function ouvrirFiche(nav, W, sombre, { panne = false } = {}) {
  const o = await P.ouvrir(nav, { W, sombre, b: baseCourbe(), url: '?tab=annonces' });
  if (panne) await o.pg.route(/courbes_annonces_/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await P.pret(o.pg);
  await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '3102' })));
  await o.pg.waitForSelector('[data-fiche-paire]', { timeout: 15000 }).catch(() => {});
  return o;
}

async function scenarioC(nav, W, sombre) {
  const nom = `courbe-${W}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nC · ${nom}`);
  const { ctx, pg, erreurs } = await ouvrirFiche(nav, W, sombre);
  try {
    const lu = await pg.waitForSelector('[data-ca="lu"]', { timeout: 20000 }).then(() => true).catch(() => false);
    dit(lu, `${nom} : la courbe est dans la fiche (annonce ${ITEM})`);
    const m = await pg.evaluate(() => {
      const c = document.querySelector('[data-ca]'); if (!c) return null;
      const tr = (k) => { const f = c.querySelector(`[data-ca-trace="${k}"]`); return f ? { seg: Number(f.getAttribute('data-ca-segments')), pts: Number(f.getAttribute('data-ca-points')), lignes: f.querySelectorAll('polyline').length,
        trous: [...f.querySelectorAll('rect[data-ca-lu="0"]')].length, titreTrou: (f.querySelector('rect[data-ca-lu="0"] title') || {}).textContent || '', titreLu: (f.querySelector('rect[data-ca-lu="1"] title') || {}).textContent || '' } : null; };
      const r = c.getBoundingClientRect();
      return { etat: c.getAttribute('data-ca'), lus: Number(c.getAttribute('data-ca-lus')), jours: Number(c.getAttribute('data-ca-jours')), reperes: c.getAttribute('data-ca-reperes'),
        vues: tr('vues'), fav: tr('fav'), texte: c.innerText, deborde: document.documentElement.scrollWidth - innerWidth, largeur: r.width,
        liste: [...c.querySelectorAll('[data-ca-repere-l]')].map((x) => x.getAttribute('data-ca-repere-l')) };
    });
    dit(m && m.lus === 7 && m.jours === 30, `${nom} : 7 jours lus sur 30 (deux navigateurs fusionnés)`, m);
    dit(m && m.vues && m.vues.seg === 3 && m.vues.lignes === 3 && m.vues.pts === 7 && m.vues.trous === 23, `${nom} : la ligne des vues est COUPÉE aux jours non lus (3 morceaux, 23 jours sans point)`, m && m.vues);
    dit(m && /— pas lu/.test(m.vues.titreTrou) && /vues/.test(m.vues.titreLu), `${nom} : survol d’un jour non lu ⇒ « — pas lu » ; d’un jour lu ⇒ ses vues et favoris`, m && [m.vues.titreTrou, m.vues.titreLu]);
    dit(m && m.reperes && ['p', 'q', 'r', 'f'].every((k) => m.reperes.split(',').includes(k)) === false && ['p', 'r', 'f'].every((k) => m.reperes.split(',').includes(k)), `${nom} : repères du journal (baisse VRM, republiée, offre aux favoris) ; le prix changé le jour d’une baisse VRM n’est pas redit`, m && m.reperes);
    dit(m && /\+49 depuis le/.test(m.texte) && /Vues et favoris/i.test(m.texte) && /jours lus sur 30/.test(m.texte), `${nom} : l’écart mesuré (premier → dernier jour lu, +49) et le pied « N jours lus sur 30 »`, m && m.texte.slice(0, 200));
    dit(m && m.deborde <= 1, `${nom} : aucun débordement`, m && m.deborde);
    await pg.locator('[data-ca]').first().scrollIntoViewIfNeeded().catch(() => {});
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
    dit(!erreurs.length, `${nom} : aucune erreur d’app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}
async function scenarioCPanne(nav) {
  console.log('\nC · base illisible (390)');
  const { ctx, pg, erreurs } = await ouvrirFiche(nav, 390, false, { panne: true });
  try {
    const etat = await pg.waitForSelector('[data-ca]', { timeout: 20000 }).then(() => pg.waitForFunction(() => { const c = document.querySelector('[data-ca]'); return c && c.getAttribute('data-ca') !== 'lecture'; }, null, { timeout: 15000 })).then(() => pg.getAttribute('[data-ca]', 'data-ca')).catch(() => null);
    dit(etat === 'pas-su', 'C-panne : lecture ratée ⇒ « — · la courbe n’a pas pu être lue » (jamais une courbe vide)', etat);
    dit(!erreurs.length, 'C-panne : aucune erreur d’app', erreurs.join(' | '));
  } finally { await ctx.close(); }
}

// ── D. EN DIRECT ───────────────────────────────────────────────────────────────
function etatExt(direct) {
  return { ok: true, version: VERSION, code: VERSION, ext: 'abcdefghijklmnopabcdefghijklmnop', vrm: { ok: true, connecte: true, expiree: false, email: P.SESSION.user.email, user_id: P.UID, cloisonne: true },
    vinted: { uid: '111', login: 'shop_exemple' }, cmds: {}, fileReseau: [], rapport: true, origine: 'zip', capte: { coupe: false }, direct };
}
async function ouvrirDirect(nav, W, sombre, url, direct) {
  const o = await P.ouvrir(nav, { W, sombre, b: E.baseFiches(), url });
  // L'écran de la PRODUCTION (natif) : le banc ne demande pas le DOM d'avant (échafaudage `vrm_banc_dom_ancien`).
  await o.pg.addInitScript(() => { try { localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} });
  if (direct === undefined) await o.pg.reload({ waitUntil: 'domcontentloaded' });
  if (direct !== undefined) {
    await o.pg.addInitScript((etat) => {
      window.__etatBanc = etat; window.__cmdsBanc = [];
      window.addEventListener('message', (e) => {
        const d = e && e.data; if (e.source !== window || !d || typeof d !== 'object') return;
        if (d.__vmr === 'ping') window.postMessage({ __vmr: 'ready', version: window.__etatBanc.version, id: window.__etatBanc.ext }, '*');
        else if (d.__vmr === 'etat' && d.reqId) window.postMessage({ __vmr: 'etat:result', reqId: d.reqId, resp: window.__etatBanc }, '*');
        else if (d.__vmr === 'cmd' && d.reqId) { window.__cmdsBanc.push({ cmd: d.cmd, on: d.on }); window.postMessage({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', on: d.on, at: Date.now() } }, '*'); }
        else if (d.reqId && typeof d.__vmr === 'string' && !/:result$/.test(d.__vmr)) window.postMessage({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: null }, '*');
      });
    }, etatExt(direct));
    await o.pg.reload({ waitUntil: 'domcontentloaded' });
  }
  await P.pret(o.pg);
  return o;
}
const lireDirect = (pg, lieu) => pg.evaluate((lieu) => { const g = document.querySelector(`[data-direct-lieu="${lieu}"]`); if (!g) return null;
  const btns = [...g.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, t: b.innerText }; });
  return { code: g.getAttribute('data-direct'), lignes: [...g.querySelectorAll('[data-direct-ligne]')].map((x) => x.getAttribute('data-direct-ligne')), texte: g.innerText, arreter: !!g.querySelector('[data-direct-arreter]'), reprendre: !!g.querySelector('[data-direct-reprendre]'), btns, deborde: document.documentElement.scrollWidth - innerWidth }; }, lieu).catch(() => null);
const attendreDirect = async (pg, lieu, bon, ms = 25000) => { const t0 = Date.now(); let v = null; while (Date.now() - t0 < ms) { v = await lireDirect(pg, lieu); if (v && bon(v)) return v; await pg.waitForTimeout(400); } return v; };

async function scenarioD(nav, W, sombre) {
  const nom = `direct-${W}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nD · ${nom}`);
  const t = Date.now();
  const { ctx, pg, erreurs } = await ouvrirDirect(nav, W, sombre, '?tab=journee', { v: 1, at: t, tout: 0, arret: false, action: { sorte: 'republier', actif: true, enCours: true, fait: 2, total: 6, prochain: null, verification: false, uid: '111', maj: t, fin: null } });
  try {
    // L'état « frais » : l'heure de la dernière nouvelle se renouvelle comme le ferait l'extension.
    await pg.evaluate(() => { setInterval(() => { if (window.__etatBanc.direct && window.__etatBanc.direct.action && window.__etatBanc.direct.action.actif) window.__etatBanc.direct.action.maj = Date.now(); }, 1000); });
    const v = await attendreDirect(pg, 'journee', (x) => x.code === 'action');
    dit(v && v.code === 'action' && v.lignes[0] === 'direct.republier.n' && /Republie 3\/6/.test(v.texte), `${nom} : « Republie 3/6 » en tête d’Aujourd’hui`, v);
    dit(v && v.arreter && v.btns.every((b) => b.h >= 44 || W > 600), `${nom} : « Tout arrêter » (≥ 44 px au doigt)`, v && v.btns);
    dit(v && v.deborde <= 1, `${nom} : aucun débordement`, v && v.deborde);
    await pg.screenshot({ path: path.join(SHOTS, nom + '-1.png') }).catch(() => {});
    await pg.click('[data-direct-arreter]');
    await pg.waitForTimeout(800);
    const cmds = await pg.evaluate(() => window.__cmdsBanc);
    dit(Array.isArray(cmds) && cmds.some((c) => c.cmd === 'toutArreter' && c.on === true), `${nom} : le toucher envoie « toutArreter » à l’extension (le chemin du panneau)`, cmds);
    // L'extension a arrêté : son état change, elle prévient l'app (maj · direct) — la ligne suit sans recharger.
    await pg.evaluate(() => { const n = Date.now(); window.__etatBanc = Object.assign({}, window.__etatBanc, { direct: { v: 1, at: n, tout: n, arret: false, action: { sorte: 'republier', actif: false, enCours: false, fait: 2, total: 6, uid: '111', maj: n, fin: { at: n, raison: 'arret' } } } });
      window.postMessage({ __vmr: 'evt', evt: { type: 'maj', quoi: 'direct' } }, '*'); });
    const v2 = await attendreDirect(pg, 'journee', (x) => x.code === 'tout', 8000);
    dit(v2 && v2.code === 'tout' && !v2.arreter && !v2.lignes.length, `${nom} : la ligne suit en direct, sans recharger : tout arrêté ⇒ elle se tait (le bandeau de la coque le dit, rien en double)`, v2);
    await pg.screenshot({ path: path.join(SHOTS, nom + '-2.png') }).catch(() => {});
    dit(!erreurs.length, `${nom} : aucune erreur d’app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}
async function scenarioDFige(nav) {
  console.log('\nD · action figée depuis 10 min (390)');
  const t = Date.now();
  const { ctx, pg, erreurs } = await ouvrirDirect(nav, 390, false, '?tab=journee', { v: 1, at: t, tout: 0, arret: false, action: { sorte: 'republier', actif: true, enCours: true, fait: 2, total: 6, uid: '111', maj: t - 10 * 60000, fin: null } });
  try {
    const v = await attendreDirect(pg, 'journee', (x) => x.code !== 'lecture');
    dit(v && v.code === 'muette' && !/Republie/.test(v.texte) && !v.arreter && /ne dit plus rien/.test(v.texte), 'D-figée : plus « Republie » : « — · l’extension ne dit plus rien depuis HH:MM »', v);
    await pg.screenshot({ path: path.join(SHOTS, 'direct-figee-390.png') }).catch(() => {});
    dit(!erreurs.length, 'D-figée : aucune erreur d’app', erreurs.join(' | '));
  } finally { await ctx.close(); }
}
async function scenarioDAbsente(nav, W) {
  console.log(`\nD · pas d’extension (${W})`);
  const { ctx, pg, erreurs } = await ouvrirDirect(nav, W, false, '?tab=journee', undefined);
  try {
    const v = await attendreDirect(pg, 'journee', (x) => x.code !== 'lecture', 30000);
    dit(v && v.code === 'absente' && /extension pas ouverte/.test(v.texte) && !/Rien en cours/.test(v.texte), `D-absente-${W} : « — · extension pas ouverte » (jamais « tout va bien »)`, v);
    await pg.screenshot({ path: path.join(SHOTS, `direct-absente-${W}.png`) }).catch(() => {});
    dit(!erreurs.length, `D-absente-${W} : aucune erreur d’app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}
async function scenarioDExtension(nav, W) {
  console.log(`\nD · page Extension (${W})`);
  const t = Date.now();
  const { ctx, pg, erreurs } = await ouvrirDirect(nav, W, false, '?tab=extension', { v: 1, at: t, tout: 0, arret: false, action: { sorte: 'favoris', actif: true, enCours: false, prochain: t + 25 * 60000, fait: 4, total: 15, uid: '111', maj: t, fin: null } });
  try {
    const v = await attendreDirect(pg, 'extension', (x) => x.code === 'action');
    dit(v && v.lignes[0] === 'direct.favoris.prochain' && /Prochain favori à/.test(v.texte) && v.arreter, `D-ext-${W} : « Prochain favori à HH:MM » + « Tout arrêter » sur la page Extension`, v);
    await pg.screenshot({ path: path.join(SHOTS, `direct-extension-${W}.png`) }).catch(() => {});
    dit(!erreurs.length, `D-ext-${W} : aucune erreur d’app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  let nav;
  try {
    await new Promise((r) => P.srv.listen(P.PORT, r));
    nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const seul = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
    const veut = (x) => !seul.length || seul.includes(x);
    if (veut('C')) { for (const [w, s] of [[390, false], [1512, false], [390, true], [1512, true]]) await essaie(`C-${w}`, () => scenarioC(nav, w, s)); await essaie('C-panne', () => scenarioCPanne(nav)); }
    if (veut('D')) {
      for (const [w, s] of [[390, false], [1512, false], [390, true]]) await essaie(`D-${w}`, () => scenarioD(nav, w, s));
      await essaie('D-figée', () => scenarioDFige(nav));
      await essaie('D-absente', () => scenarioDAbsente(nav, 390));
      await essaie('D-ext', () => scenarioDExtension(nav, 1512));
    }
  } finally {
    if (nav) await nav.close();
    P.srv.close();
    console.log(`\n${ok} vert(s), ${ko} rouge(s) · captures : ${SHOTS}`);
    process.exit(ko ? 1 : 0);
  }
})();
