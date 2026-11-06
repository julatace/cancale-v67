// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA VENTE VUE PAR E-MAIL, PAS ENCORE RELUE SUR VINTED » (6 nov. ;
//  récit : docs/passation/2026-11-06-vente-email-fraiche.md ; règle :
//  src/venteEmailFraiche.js, audit : scripts/audit-vente-email-fraiche.cjs).
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`
//  (deux comptes Vinted 111 et 222) + des e-mails de vente inventés, servis
//  par SON harnais. La requête des e-mails de vente est servie comme PostgREST
//  (`meta->>type=eq.`, `not.is.null`, `gte.`, projection) — jamais une autre
//  forme (§6.3).
//  Le compte 111 a ses ANNONCES relues il y a une minute et sa liste de VENTES
//  relue hier (le cas mesuré le 6 nov.). À 390 px tactile et 1512 px, clair et
//  sombre. Il MESURE (data-*, nombres, styles calculés — jamais un libellé) :
//   E1 VENTES — la vente e-mail fraîche (n° prouvé, compte 111, après la
//      lecture) a SA ligne, une seule, marquée « vue par e-mail », avec la date
//      de la lecture et le geste ; aucun geste d'envoi ; rien de coupé, rien ne
//      déborde. Les autres e-mails (sans n°, déjà dans la liste, plus vieux que
//      la lecture, compte non lié, statut) n'ont AUCUNE ligne ; le n° déjà lu
//      garde UNE ligne, la ligne Vinted.
//   E2 VENDU — la carte du mois compte la vente e-mail (72 € de plus que le
//      même jeu sans ses e-mails) ; la liste relue (le n° dans `orders_sold`)
//      donne le MÊME vendu et une seule ligne, sans la marque e-mail.
//   E3 L'INDICATEUR — « Tes comptes · dernière relecture » : le compte 111 dit
//      ses ventes en retard (date, geste, ambre) ; le compte 222 non.
//  Réglages : `BANC_PORT` (9700–9749, 9712 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `SHOTS=<dossier>` (captures à REGARDER), `BANC_DIST`
//  (un autre dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9712';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || '';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`);
};
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {}); };

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const TX_FRAICHE = '62100099', TX_LUE = '62100001', TX_VIEILLE = '62100004', TX_AUTRE = '62100005', TX_STATUT = '62100006';
const venteV = (tx, titre, j, prix) => ({ transaction_id: Number(tx), title: titre, price: { amount: prix, currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(j), photo: null });
const mail = (cle, o) => ({ id: 'email_sale_' + cle, data: { type: 'vente', designation: 'Paire inventée ' + cle, prix: '72.00', pseudo: 'acheteur_x', account: 'vendeuse_a', uid: '111', transaction: '', receivedAt: iso(0.05), ...o } });
// `variante` : 'fraiche' (le cas mesuré) · 'sans' (les mêmes lignes, sans e-mail de vente) · 'relue' (la liste porte le n°).
const jeu = (variante) => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v1 = l.find((x) => x.id === 'harvest_111_orders_sold');
  v1.data.capturedAt = variante === 'relue' ? iso(0.001) : iso(1);   // relue hier (le cas mesuré) — ou à l'instant
  v1.data.payload.my_orders.push(venteV(TX_LUE, 'Asics Gel-Kayano 14 argent taille 41', 2, '64'));
  if (variante === 'relue') v1.data.payload.my_orders.push(venteV(TX_FRAICHE, 'Nike Air Force 1 blanche taille 43', 0.05, '72.00'));
  l.find((x) => x.id === 'harvest_111_listings').data.capturedAt = iso(0.0007);
  if (variante !== 'sans') l.push(
    mail('a1', { transaction: TX_FRAICHE, designation: 'Nike Air Force 1 blanche taille 43', pro: true }),   // E1 : la vente du matin
    mail('a2', { transaction: '', designation: 'Puma Suede rouge taille 40' }),                                // sans n° (compte particulier)
    mail('a3', { transaction: TX_LUE, designation: 'Asics Gel-Kayano 14 argent taille 41' }),                  // déjà dans la liste
    mail('a4', { transaction: TX_VIEILLE, designation: 'Vans Old Skool noire taille 42', receivedAt: iso(2) }),   // avant la lecture
    mail('a5', { transaction: TX_AUTRE, designation: 'New Balance 990 grise taille 44', uid: '333', account: 'pas_lie' }),   // compte non lié
    { id: 'email_sale_a6', data: { type: 'commande-mise-a-jour', designation: 'Reebok Club C taille 39', transaction: TX_STATUT, uid: '111', account: 'vendeuse_a', receivedAt: iso(0.03) } },   // un statut
  );
  return l;
};

// La requête des e-mails de vente, servie comme PostgREST : filtres et projection.
const servirVentesEmail = (lignes) => async (route) => {
  const u = decodeURIComponent(metaVersData(route.request().url()));
  const q = u.split('?')[1] || '';
  const filtres = []; let sel = null;
  for (const p of q.split('&')) {
    const i = p.indexOf('='); if (i < 0) continue;
    const k = p.slice(0, i), v = p.slice(i + 1);
    if (k === 'select') { sel = v; continue; }
    if (k === 'id' || k === 'order' || k === 'limit' || k === 'offset') continue;
    filtres.push([k, v]);
  }
  const champ = (d, k) => { let x = d; for (const s of k.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[s]; return x == null ? null : (typeof x === 'object' ? JSON.stringify(x) : String(x)); };
  const passe = (r) => filtres.every(([k, v]) => {
    const x = champ(r.data, k);
    if (v === 'not.is.null') return x != null;
    if (v === 'is.null') return x == null;
    if (v.startsWith('eq.')) return x === v.slice(3);
    if (v.startsWith('gte.')) return x != null && x >= v.slice(4);
    return true;
  });
  const out = lignes().filter((r) => /^email_sale_/.test(r.id) && passe(r)).map((r) => {
    const o = {};
    for (const part of String(sel || 'id').split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; o[m[1] || m[2]] = m[2] === 'id' ? r.id : champ(r.data, m[2]); }
    return o;
  });
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, out.length - 1)}/${out.length}` }, body: JSON.stringify(out) });
};

const ferme = async (o) => { try { await o.ctx.close(); } catch (_) {} };
const vis = `const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };`;

async function ouvrirVentes(nav, { W, theme, variante }) {
  const base = { lignes: jeu(variante), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base, tab: 'journee' });
  // La route des e-mails de vente APRÈS celles du harnais (Playwright prend la dernière en premier).
  await o.pg.route(/\/rest\/v1\/app_data\?.*email_sale_/, servirVentesEmail(() => base.lignes));
  await o.pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-sale-row', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForFunction(() => { const c = document.querySelector('[data-fu-vendu-mois]'); return !!c && c.getAttribute('data-fu-vendu-mois') !== ''; }, null, { timeout: 15000 }).catch(() => {});
  await attendre(1500);
  return { ...o, base };
}
const lireVentes = (pg) => pg.evaluate(new Function(`${vis}
  const lignes = (tx) => [...document.querySelectorAll('.vrm-sale-row[data-tx="' + tx + '"]')];
  const note = document.querySelector('[data-vente-email]');
  const ligneNote = note && note.closest('.vrm-sale-row');
  const g = note && note.querySelector('[data-vente-email-geste]');
  const rn = note && note.getBoundingClientRect(), rl = ligneNote && ligneNote.getBoundingClientRect();
  const vendu = document.querySelector('[data-fu-vendu-mois]');
  return {
    notes: [...document.querySelectorAll('[data-vente-email]')].map((e) => e.getAttribute('data-vente-email')),
    noteVis: vis(note), noteLu: note ? note.getAttribute('data-vente-email-lu') : null, noteTx: ligneNote ? ligneNote.getAttribute('data-tx') : null,
    geste: g ? { vis: vis(g), couleur: getComputedStyle(g).color, chrome: /chrome/i.test(g.textContent) } : null,
    ambre: getComputedStyle(document.documentElement).getPropertyValue('--fu-ambre-txt').trim(),
    dedans: !!(rn && rl && rn.right <= rl.right + 1 && rn.left >= rl.left - 1), coupe: note ? note.scrollWidth > note.clientWidth + 1 : null,
    gestesEnvoi: ligneNote ? ligneNote.querySelectorAll('[data-depose-vente], [data-fu-imprimer], [data-rangee-bord]').length : null,
    n: { fraiche: lignes('${TX_FRAICHE}').length, lue: lignes('${TX_LUE}').length, vieille: lignes('${TX_VIEILLE}').length, autre: lignes('${TX_AUTRE}').length, statut: lignes('${TX_STATUT}').length },
    lueMarquee: lignes('${TX_LUE}').some((l) => !!l.querySelector('[data-vente-email]')),
    fraicheMarquee: lignes('${TX_FRAICHE}').some((l) => !!l.querySelector('[data-vente-email]')),
    vendu: vendu ? vendu.getAttribute('data-fu-vendu-mois') : null,
    debord: document.documentElement.scrollWidth > window.innerWidth + 1,
  };`));
const rgb = (c) => (String(c).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map((x) => Math.round(Number(x))).join(',');
const hex = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || ''); return m ? [m[1], m[2], m[3]].map((x) => parseInt(x, 16)).join(',') : rgb(h || ''); };

async function ventes(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  // E1 · la vente e-mail fraîche
  const o = await ouvrirVentes(nav, { W, theme, variante: 'fraiche' });
  await o.pg.waitForSelector('[data-vente-email]', { timeout: 15000 }).catch(() => {});
  const r = await lireVentes(o.pg);
  dit(r.notes.length === 1 && r.notes[0] === TX_FRAICHE && r.noteTx === TX_FRAICHE && r.n.fraiche === 1, 'E1', `${T} la vente e-mail fraîche a SA ligne, une seule, marquée « vue par e-mail »`, JSON.stringify(r));
  dit(r.noteVis && /^\d{13}$/.test(String(r.noteLu || '')) && Math.abs(Number(r.noteLu) - Date.parse(iso(1))) < 5000, 'E1', `${T} la ligne dit QUAND la liste des ventes a été relue (hier)`, JSON.stringify({ lu: r.noteLu }));
  dit(r.geste && r.geste.vis && !r.geste.chrome && rgb(r.geste.couleur) === hex(r.ambre), 'E1', `${T} le geste est là, en ambre, sans « Chrome » en dur`, JSON.stringify({ geste: r.geste, ambre: r.ambre }));
  dit(r.gestesEnvoi === 0, 'E1', `${T} aucun geste d'envoi (ni « Déposé », ni bordereau) sur une vente pas encore relue`, String(r.gestesEnvoi));
  dit(r.n.lue === 1 && !r.lueMarquee, 'E1', `${T} le n° déjà dans la liste : UNE ligne, la ligne Vinted`, JSON.stringify(r.n));
  dit(r.n.vieille === 0 && r.n.autre === 0 && r.n.statut === 0, 'E1', `${T} rien pour l'e-mail plus vieux que la lecture, le compte non lié, le statut`, JSON.stringify(r.n));
  dit(r.dedans && r.coupe === false && !r.debord, 'E1', `${T} la phrase tient dans sa ligne, rien de coupé, rien ne déborde`, JSON.stringify({ dedans: r.dedans, coupe: r.coupe, debord: r.debord }));
  await o.pg.locator('[data-vente-email]').first().scrollIntoViewIfNeeded().catch(() => {});
  await attendre(300);
  await capture(o.pg, `vef-ventes-${W}-${theme}`);
  const venduFraiche = r.vendu;
  dit(!o.journal.erreurs.length, 'E0', `${T} aucune erreur JS (fraîche)`, o.journal.erreurs.join(' ¦ '));

  // E3 · l'indicateur (même page)
  await o.pg.locator('.vrm-etat-pastille').first().click().catch(() => {});
  await o.pg.waitForFunction(() => { const b = document.querySelector('[data-fraicheur-comptes]'); return b && b.getAttribute('data-fraicheur-comptes') !== 'encours'; }, null, { timeout: 15000 }).catch(() => {});
  await attendre(400);
  const f = await o.pg.evaluate(new Function(`${vis}
    const l = (id) => { const e = document.querySelector('[data-fraicheur-compte="vinted"][data-fraicheur-id="' + id + '"]'); if (!e) return null; const b = e.querySelector('.vrm-etat-compte-bloque');
      return { retard: e.getAttribute('data-fraicheur-ventes-retard'), geste: e.getAttribute('data-fraicheur-geste'), vis: vis(e), couleur: b ? getComputedStyle(b).color : '', chrome: /chrome/i.test(e.textContent), coupe: e.scrollWidth > e.clientWidth + 1 }; };
    return { a: l('111'), b: l('222'), etat: (document.querySelector('[data-fraicheur-comptes]') || { getAttribute: () => null }).getAttribute('data-fraicheur-comptes'), debord: document.documentElement.scrollWidth > window.innerWidth + 1 };`));
  const warn = await o.pg.evaluate(() => { const b = document.querySelector('[data-fraicheur-compte="vinted"][data-fraicheur-id="111"] .vrm-etat-compte-bloque'); return b ? b.style.color : ''; });
  dit(f.a && f.a.vis && /^\d{13}$/.test(String(f.a.retard || '')) && Math.abs(Number(f.a.retard) - Date.parse(iso(1))) < 5000 && f.a.geste === '1', 'E3', `${T} le compte 111 dit ses ventes relues hier (daté), avec le geste`, JSON.stringify(f));
  dit(f.a && !f.a.chrome && f.a.coupe === false && !!warn, 'E3', `${T} la ligne est en ambre (un geste), sans « Chrome » en dur, rien de coupé`, JSON.stringify({ a: f.a, warn }));
  dit(f.b && !f.b.retard, 'E3', `${T} le compte 222 (ventes à jour) ne dit rien de plus`, JSON.stringify(f.b));
  dit(!f.debord, 'E3', `${T} le panneau ne déborde pas`, '');
  await capture(o.pg, `vef-indicateur-${W}-${theme}`);
  await ferme(o);

  // E2 · VENDU : le même jeu sans ses e-mails, puis la liste relue
  const s = await ouvrirVentes(nav, { W, theme, variante: 'sans' });
  const rs = await lireVentes(s.pg);
  await ferme(s);
  const rl = await ouvrirVentes(nav, { W, theme, variante: 'relue' });
  await rl.pg.waitForSelector(`.vrm-sale-row[data-tx="${TX_FRAICHE}"]`, { timeout: 15000 }).catch(() => {});
  const rr = await lireVentes(rl.pg);
  await capture(rl.pg, `vef-relue-${W}-${theme}`);
  dit(rr.n.fraiche === 1 && !rr.fraicheMarquee && rr.notes.length === 0, 'E2', `${T} la liste relue porte le n° : UNE ligne, la ligne Vinted (la marque e-mail sort)`, JSON.stringify(rr));
  const vF = Number(venduFraiche), vS = Number(rs.vendu), vR = Number(rr.vendu);
  dit(venduFraiche !== null && rs.vendu !== null && Number.isFinite(vF) && Number.isFinite(vS) && vF - vS === 7200, 'E2', `${T} VENDU du mois compte la vente e-mail (+72 € par rapport au même jeu sans elle)`, JSON.stringify({ fraiche: venduFraiche, sans: rs.vendu }));
  dit(Number.isFinite(vR) && vR === vF, 'E2', `${T} relue sur Vinted : le MÊME vendu (elle n'est comptée qu'une fois)`, JSON.stringify({ fraiche: venduFraiche, relue: rr.vendu }));
  dit(!rl.journal.erreurs.length, 'E0', `${T} aucune erreur JS (relue)`, rl.journal.erreurs.join(' ¦ '));
  await ferme(rl);
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const theme of THEMES) for (const W of LARGEURS) {
      await ventes(nav, { W, theme }).catch((e) => dit(false, 'E0', `[${W} ${theme}] Ventes au bout`, String(e && e.message).slice(0, 300)));
    }
  } catch (e) { dit(false, 'E0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ vente-email-fraiche : ${ko} défaut(s)` : '\n✅ vente-email-fraiche : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
