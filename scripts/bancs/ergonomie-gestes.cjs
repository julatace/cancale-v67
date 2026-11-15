require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  L'ERGONOMIE DES GESTES COURANTS (14 nov.) — récit : docs/passation/2026-11-14-ergonomie-gestes.md
//
//  Le banc JOUE les 15 gestes les plus fréquents d'un revendeur, comme un pouce sur un
//  iPhone (390 × 844, tactile), DEPUIS L'OUVERTURE de l'app (Ma journée), et compte :
//    · touchers   — chaque toucher (le geste décisif compris : « Imprimer », « Accepter »…) ;
//    · zone haute — touchers dans le tiers HAUT de l'écran (le pouce n'y va pas d'une main) ;
//    · défilés    — la cible n'était pas à l'écran : il a fallu faire défiler ;
//    · mots       — les mots à l'écran au moment de chercher la cible (ce qu'il faut LIRE) ;
//    · attente    — le plus long délai entre un toucher et l'arrivée de la cible suivante ;
//    · impasses   — chemins essayés qui n'aboutissent pas (cible absente, écran muet).
//  Un geste a plusieurs CHEMINS, du plus court au plus long : le premier qui ABOUTIT (son `but`
//  vérifié dans la page, jamais un libellé) est celui qu'un pouce prendrait. Sur l'app d'avant,
//  le raccourci n'existe pas ⇒ le chemin long est mesuré ⇒ rouge si le geste dépasse son plafond.
//  Un geste dont aucun chemin n'aboutit est ROUGE (une impasse, jamais « pas mesuré »).
//  Le toucher décisif d'un geste qui ENVERRAIT quelque chose (Accepter, Appliquer, Lancer,
//  Déclarer…) est compté et sa place mesurée, mais il n'est pas joué (`decisif`) : le banc
//  n'écrit rien. Base INVENTÉE (design-passe-2 `baseSites` + une offre), garde réseau.
//  `BANC_DIST=` (avant/après) · `GESTES=id,id` · `SHOTS=` captures · `DEBUG=1` les cibles visibles.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const D2 = require('./design-passe-2.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-ergonomie-gestes');
fs.mkdirSync(SHOTS, { recursive: true });
const VOULUS = String(process.env.GESTES || '').split(',').map((x) => x.trim()).filter(Boolean);
const H = 844, W = 390;
const ZONE_HAUTE = Math.round(H / 3);   // le tiers haut : hors de portée du pouce d'une main

// ── La base : celle des passes design (3 comptes Vinted, Leboncoin, eBay, Vestiaire), plus UNE offre
//    en attente dans une conversation (forme réelle : `offer_request_message`, messages-naturel.cjs). ──
function base() {
  const b = D2.baseSites();
  const a = b.accounts[0], uid = a.vinted_user_id;
  // Le régime choisi (un vendeur installé l'a posé) : « J'ai déclaré ce mois » est alors à sa place (declare-urssaf.cjs).
  Object.assign(b.main[0].data, { vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_freq: 'mensuel' });
  // Le « bilan en une minute » (accueil des nouveaux, src/bilanMinute.js) déjà vu : un vendeur installé ouvre sur Ma journée.
  b.main[0].data.vrm_bilan_minute = { vu: '2026-11-01T10:00:00.000Z', fin: 'vu' };
  const maintenant = Date.now();
  const conv = { id: 18999000001, unread: true, updated_at: new Date(maintenant - 20 * 60e3).toISOString(), description: 'Vous feriez 55 € ?', opposite_user: { id: 95001, login: 'offreur_jour' }, item_count: 1 };
  const boite = b.rows.find((r) => r.id === `harvest_${uid}_inbox`);
  if (boite) boite.data.payload.conversations.unshift(conv);
  const item = (b.rows.find((r) => r.id === `harvest_${uid}_listings`) || { data: { payload: { items: [{ id: 7000000000 }] } } }).data;
  const itemId = (((item.payload || {}).items || [])[0] || {}).id || 7000000000;
  b.rows.push({ id: `harvest_${uid}_conv_${conv.id}`, data: { capturedAt: new Date(maintenant - 60e3).toISOString(), payload: { conversation: {
    id: conv.id, opposite_user: conv.opposite_user, transaction: { id: 22999000001, item_id: itemId, current_user_side: 'seller' }, description: 'Paire', allow_reply: true,
    messages: [
      { id: 990001, created_at_ts: new Date(maintenant - 25 * 60e3).toISOString(), entity_type: 'message', entity: { user_id: 95001, body: 'Vous feriez 55 € ?' } },
      { id: 990002, created_at_ts: new Date(maintenant - 20 * 60e3).toISOString(), entity_type: 'offer_request_message', entity: { user_id: 95001, current: true, status: 10, status_title: '', price: { amount: '55.0' }, transaction_id: 22999000001, offer_request_id: 77001 } },
    ] } } } });
  // Deux colis arrivés au point relais, avec leur code (forme de colis-qr.cjs : `email_track_*`).
  const ilYa = (h) => new Date(maintenant - h * 3600e3).toISOString();
  const dans = (j) => new Date(maintenant + j * 864e5).toISOString().slice(0, 10);
  const track = (carrier, suivi, lieu, code) => ({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(1), code, lieu, limite: dans(5), consigne: false, account: '' } });
  b.rows.push(track('mondialrelay', '81000001', 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE', '418205'),
    track('chronopost', 'XW100000001JB', 'RELAIS PICKUP DU PORT, 2 QUAI GAMBETTA, 35260 CANCALE', '700001'));
  return b;
}

// ── Les gestes. `pas` : ['t', sel] toucher · ['s', sel, texte] saisir (pas un toucher) ·
//    ['d', sel] toucher DÉCISIF (compté, mesuré, pas joué) · ['a', sel] attendre. `but(pg)` : vrai à l'arrivée. ──
const vu = (sel) => (pg) => pg.evaluate((s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length && (!e.checkVisibility || e.checkVisibility())), sel);
const BARRE = '.vrm-tabbar';
const GESTES = require('./_ergonomie-gestes-liste.cjs')({ vu, BARRE });

// ── La mesure, DANS la page. ──
async function cible(pg, sel, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await pg.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => e.getClientRects().length && (!e.checkVisibility || e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) && !e.closest('[inert]'));
      if (!el) return null;
      const i = [...document.querySelectorAll(s)].indexOf(el);
      const r = el.getBoundingClientRect();
      return { i, y: r.top, h: r.height, x: r.left, w: r.width, desactive: !!el.disabled || el.getAttribute('aria-disabled') === 'true' };
    }, sel).catch(() => null);
    if (r) return { ...r, attente: Date.now() - t0 };
    await pg.waitForTimeout(150);
  }
  return null;
}
// Les mots lisibles à l'écran (dans la fenêtre), ce qu'un œil parcourt pour trouver la cible.
const motsALEcran = (pg) => pg.evaluate(() => {
  let n = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const s = t.nodeValue.trim(); if (!s) continue;
    const el = t.parentElement; if (!el || el.closest('[hidden], [inert], .vrm-sr, .vrm-sr-seul, .vrm-sr-only, [aria-hidden="true"], script, style')) continue;
    const rg = document.createRange(); rg.selectNodeContents(t);
    const r = rg.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    n += s.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
  }
  return n;
});
async function sondeCibles(pg) {
  return pg.evaluate(() => [...document.querySelectorAll('button, a, [role=button], [role=menuitem], [role=tab], summary, input, select, label[for]')].filter((e) => e.getClientRects().length && (!e.checkVisibility || e.checkVisibility())).slice(0, 90).map((e) => {
    const r = e.getBoundingClientRect();
    const da = [...e.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'aria-label').map((a) => a.name + (a.value ? '=' + a.value.slice(0, 24) : '')).slice(0, 4).join(' ');
    return `${Math.round(r.top)} ${e.tagName} « ${(e.innerText || e.value || '').replace(/\s+/g, ' ').slice(0, 40)} » ${da}`;
  }).join('\n'));
}

async function jouerChemin(o, g, ch) {
  const pg = o.pg;
  const m = { chemin: ch.nom, touchers: 0, zoneHaute: 0, defiles: 0, mots: 0, attente: 0, saisies: 0, places: [] };
  for (const [sorte, sel, texte] of ch.pas) {
    const c = await cible(pg, sel, sorte === 'a' || sorte === 'd' ? 15000 : 9000);   // machine chargée : une condition, large
    if (!c) return { ...m, impasse: `${sorte} ${sel} : introuvable` };
    m.attente = Math.max(m.attente, c.attente);
    if (sorte === 'a') continue;
    let y = c.y, h = c.h;
    if (y < 0 || y + h > H - 4) {
      // Pas à l'écran : un défilé (le pouce fait glisser la page), puis la cible.
      m.defiles++;
      await pg.evaluate(([s, i]) => document.querySelectorAll(s)[i].scrollIntoView({ block: 'center' }), [sel, c.i]);
      await pg.waitForTimeout(350);
      const c2 = await cible(pg, sel, 2000); if (!c2) return { ...m, impasse: `${sel} : perdu au défilé` };
      y = c2.y; h = c2.h; c.i = c2.i;
    }
    // Ce qu'il faut lire pour trouver la cible (mesuré avant le toucher).
    m.mots += await motsALEcran(pg);
    if (sorte === 'v') continue;
    if (sorte === 's') {
      m.saisies++;
      const el = pg.locator(sel).nth(c.i);
      await el.fill(String(texte)).catch(() => {});
      await pg.waitForTimeout(500);
      continue;
    }
    m.touchers++;
    const centre = Math.round(y + h / 2);
    if (centre < ZONE_HAUTE) m.zoneHaute++;
    m.places.push(centre);
    if (sorte === 'd') { if (c.desactive) m.decisifDesactive = sel; continue; }
    const el = pg.locator(sel).nth(c.i);
    await el.tap({ timeout: 4000 }).catch(() => el.click({ timeout: 4000, force: true }).catch(() => {}));
    await pg.waitForTimeout(450);
  }
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < 15000) { if (await g.but(pg).catch(() => false)) { ok = true; break; } await pg.waitForTimeout(200); }
  if (!ok) return { ...m, impasse: 'but pas atteint' };
  return m;
}

(async () => {
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const lancerNav = () => P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  let nav = await lancerNav();
  const rapport = {};
  let rouges = 0;
  for (const g of GESTES) {
    if (VOULUS.length && !VOULUS.includes(g.id)) continue;
    const essais = [];
    let retenu = null;
    for (const ch of g.chemins) {
      let o;
      try {
        o = await P.ouvrir(nav, { W, sombre: false, b: base(), url: g.url || '/?tab=journee', api: D2.api });
        await P.pret(o.pg);
        // L'app est ouverte quand Ma journée a rendu ce qu'il y a à faire et que la barre du bas répond (machine chargée :
        // jamais un délai fixe, une condition).
        await cible(o.pg, `${BARRE} [data-nav-entree]`, 25000);
        await cible(o.pg, 'button[data-tuile], button[data-job]', 25000);
        if (g.avant) await g.avant(o.pg);
        const r = await jouerChemin(o, g, ch);
        essais.push(r);
        if (process.env.SHOTS_TOUS || !r.impasse) await o.pg.screenshot({ path: path.join(SHOTS, `${g.id}-${ch.nom}.png`) });
        if (r.impasse && process.env.DEBUG) console.log(`    [${g.id}/${ch.nom}] ${r.impasse}\n` + (await sondeCibles(o.pg)).split('\n').map((l) => '      ' + l).join('\n'));
        if (!r.impasse) { retenu = r; break; }
      } catch (e) {
        // Un navigateur tombé (mémoire de la machine) n'est pas une impasse de l'app : on relance et on rejoue CE chemin, une fois.
        if (/closed|crash/i.test(String(e.message || e)) && !ch.rejoue) { ch.rejoue = true; try { await nav.close(); } catch (_) {} nav = await lancerNav(); g.chemins.splice(g.chemins.indexOf(ch) + 1, 0, ch); continue; }
        essais.push({ chemin: ch.nom, impasse: 'erreur ' + String(e.message || e).slice(0, 120) });
      }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
    const impasses = essais.filter((e) => e.impasse);
    const rouge = !retenu || retenu.touchers > g.plafond || (g.zoneMax != null && retenu.zoneHaute > g.zoneMax);
    if (rouge) rouges++;
    rapport[g.id] = { nom: g.nom, plafond: g.plafond, zoneMax: g.zoneMax, retenu, impasses: impasses.map((e) => `${e.chemin} : ${e.impasse}`) };
    const r = retenu;
    console.log(`${rouge ? '✗' : '✓'} ${g.id.padEnd(14)} ${r ? `${r.touchers} touchers (plafond ${g.plafond}) · zone haute ${r.zoneHaute}${g.zoneMax != null ? '/' + g.zoneMax : ''} · défilés ${r.defiles} · mots ${r.mots} · attente ${r.attente} ms · chemin « ${r.chemin} »` : 'IMPASSE — aucun chemin n’aboutit'}${impasses.length ? ` · impasses ${impasses.length}` : ''}`);
    for (const e of impasses) console.log(`    · ${e.chemin} : ${e.impasse}`);
  }
  fs.writeFileSync(path.join(SHOTS, 'rapport.json'), JSON.stringify(rapport, null, 1));
  console.log(rouges ? `\n✗ ROUGE — ${rouges} geste(s) au-dessus de leur plafond ou sans chemin` : '\n✓ VERT — chaque geste dans son plafond');
  console.log('captures :', SHOTS);
  await nav.close(); P.srv.close();
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
