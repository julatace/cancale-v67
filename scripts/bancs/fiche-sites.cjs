require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « FICHE · SUR LES SITES » ET « SÉRIE DEPUIS ACHATS » (21 nov. 2026, lot fiche-sites)
//  docs/passation/2026-11-21-fiche-sites.md — base INVENTÉE, aucune donnée réelle.
//
//  F  La fiche du N°3201 (inventé) : Vinted en ligne (prix, vues, favoris, date), Leboncoin en ligne (lien posé à la main),
//     eBay LU sans annonce de ce N° (« Pas publiée » + « Publier »), Vestiaire PAS LU (la lecture rend 500 : « — pas lu »,
//     aucun geste). Une rangée par site, dans l'ordre, logo sur chacune ; « Publier » ≥ 44 px ouvre « Publier ailleurs » sur
//     eBay (rien ne part) ; la paire VENDUE (N°3119) n'offre « Publier » nulle part ; rien ne déborde, contrastes, cibles.
//  A  Achats : « N achats arrivés sans vente » (plusieurs) ⇒ la feuille « Relier à une vente / annonce » en série :
//     « 1 sur N », « Passer » ⇒ « 2 sur N » sans rien écrire ; « Relier » ⇒ « Oui » ⇒ le suivant (« 3 sur N ») et la pilule
//     « Annuler » ; fermer ⇒ la série s'arrête, l'entrée compte un achat de moins.
//  390 × 844 tactile et 1512, clair et sombre. `VUES=390` `THEMES=clair` `PARTIES=F,A` `SHOTS=<dossier>` ·
//  `BANC_DIST=<dist>` (le build d'avant : ROUGE attendu). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const FD = require('./fiche-directe.cjs');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-fiche-sites');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'F,A');
const J = 86400000;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const sansToasts = (pg) => pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});

// ── F : la base de la fiche directe + l'article N°3201 sur quatre sites. ──
function baseSites() {
  const b = FD.baseDirecte();
  const m = b.main[0].data, num = m.vinted_annonce_numeros;
  const uid = b.accounts[0].vinted_user_id;
  const iso = (j) => new Date(Date.now() - j * J).toISOString();
  const photo = (id) => `https://images1.vinted.net/t/${id}/f800/fs.jpeg?s=abc`;
  const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`);
  const enl = b.rows.find((r) => r.id === `harvest_${uid}_enligne`);
  const lbc = b.rows.find((r) => r.id === 'lbc_listings');
  const id = 7699993201;
  lst.data.payload.items.push({ id, title: 'Nike Air Max 1 rouge taille 42', brand_title: 'Nike', size_title: '42', status: 'Très bon état', price: { amount: '85.0', currency_code: 'EUR' },
    is_closed: false, is_hidden: false, is_draft: false, favourite_count: 7, view_count: 112, created_at_ts: iso(12), photo: { url: photo(id), high_resolution: { timestamp: Math.floor((Date.now() - 12 * J) / 1000) } } });
  num[id] = { numero: '3201', num: '3201', accountId: String(uid), numberedAt: iso(12), title: 'Nike Air Max 1 rouge taille 42', photo: photo(id), buyPrice: '40' };
  if (enl) { enl.data.ids.push(id); enl.data.items.push({ id, title: 'Nike Air Max 1 rouge taille 42' }); enl.data.n = enl.data.ids.length; }
  m.vinted_used_nums.push(3201);
  lst.data.nItems = lst.data.payload.items.length; lst.data.payload.pagination = { total_entries: lst.data.payload.items.length };
  // Leboncoin : SON annonce, reliée au N° par le lien posé à la main (une identité, §5).
  lbc.data.items[2900003201] = { subject: 'Nike Air Max 1 rouge 42', price: 90, status: 'active', url: 'https://www.leboncoin.fr/ad/chaussures/2900003201', images: [photo('lbc3201')], publieeLe: iso(5), stats: { favoris: 4 }, accountName: 'boutique_lbc' };
  m.vrm_lbc_liens[2900003201] = '3201';
  // Il montre les quatre sites (Paramètres → plateformes) : Vestiaire a sa rangée, même pas lu.
  m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], at: new Date().toISOString() };
  return b;
}

const mesureSites = () => {
  const f = document.querySelector('[data-fiche-paire]'); if (!f) return null;
  const s = f.querySelector('section[data-fd-sites]'); if (!s) return { section: false };
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  const R = (e) => e.getBoundingClientRect();
  const rangs = [...s.querySelectorAll('[data-fiche-site]')].filter(vis);
  const sb = R(s);
  return { section: true, n: Number(s.getAttribute('data-fd-sites')), pasLus: s.getAttribute('data-fd-sites-pas-lus') || '',
    rangs: rangs.map((r) => { const g = r.querySelector('[data-fiche-publier-sur]'); const cellules = [...r.querySelectorAll('[role="cell"]')].filter(vis);
      return { site: r.getAttribute('data-fiche-site'), etat: r.getAttribute('data-fiche-site-etat'), raison: r.getAttribute('data-fiche-site-raison') || '', lien: r.tagName === 'A' ? r.getAttribute('href') : '',
        logo: !!(r.querySelector('.nf-logo') && (r.querySelector('.nf-logo svg, .nf-logo img, .nf-logo [class]'))), publier: g ? Math.round(R(g).height) : 0,
        texte: r.innerText.replace(/\s+/g, ' ').trim(), date: r.querySelector('[data-fiche-site-date]') ? r.querySelector('[data-fiche-site-date]').getAttribute('data-fiche-site-date') : '',
        deborde: cellules.some((c) => R(c).right > R(r).right + 1 || R(c).left < R(r).left - 1) || R(r).right > sb.right + 1 }; }),
    titre: (s.querySelector('.nf-section-titre') || { textContent: '' }).textContent.trim(), cote: document.documentElement.scrollWidth - innerWidth };
};

async function ouvrirFiche(pg, n) {
  await pg.evaluate((x) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: x })), n);
  await pg.waitForSelector(`[data-fiche-paire="${n}"]`, { timeout: 12000 }).catch(() => {});
  await attendre(pg, () => !document.querySelector('[data-fiche-lecture-en-cours="1"]'), 12000);
  // Les lectures en plus (Leboncoin, Vestiaire) arrivent après : la rangée Vestiaire quitte « lecture en cours ».
  await attendre(pg, () => { const r = document.querySelector('[data-fiche-site="vestiaire"]'); return !!r && r.getAttribute('data-fiche-site-raison') !== 'lecture'; }, 12000);
  await pg.waitForTimeout(900);
}

async function partieF(nav, W, th) {
  const sombre = th === 'sombre', tel = W < 600, suf = `${W}-${th}`;
  const o = await P.ouvrir(nav, { W: tel ? 390 : 1512, sombre, b: baseSites(), url: '/?tab=journee', api: B.apiVolume, dsf: DSF });
  try {
    // Vestiaire PAS LU : sa lecture rend une erreur (la dernière route posée passe la première).
    await o.pg.route(/\/rest\/v1\/app_data\?id=eq\.vc_listings/, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"banc : lecture refusée"}' }));
    await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
    await o.pg.reload({ waitUntil: 'domcontentloaded' }); await P.pret(o.pg); await o.pg.waitForTimeout(1500); await sansToasts(o.pg);
    await ouvrirFiche(o.pg, '3201');
    await o.pg.evaluate(() => { const s = document.querySelector('[data-fiche-paire] section[data-fd-sites]'); if (s) s.scrollIntoView({ block: 'center' }); });
    await o.pg.waitForTimeout(500);
    const m = await o.pg.evaluate(mesureSites);
    await o.pg.screenshot({ path: path.join(SHOTS, `fiche-sites-${suf}.png`) });
    if (!dit(!!m && m.section, `F ${suf} : la section « Sur les sites » est rendue`, m)) return;
    const etats = m.rangs.map((r) => r.site + ':' + r.etat).join(',');
    dit(etats === 'vinted:en-ligne,leboncoin:en-ligne,ebay:pas-publiee,vestiaire:pas-su' && m.n === 4, `F1 ${suf} : une rangée par site, dans l’ordre (${etats})`, m.rangs);
    dit(/sur les sites/i.test(m.titre), `F1 ${suf} : le titre « Sur les sites »`, m.titre);
    dit(m.rangs.every((r) => r.logo), `F1 ${suf} : le logo du site sur chaque rangée`);
    const v = m.rangs.find((r) => r.site === 'vinted') || {}, l = m.rangs.find((r) => r.site === 'leboncoin') || {}, e = m.rangs.find((r) => r.site === 'ebay') || {}, c = m.rangs.find((r) => r.site === 'vestiaire') || {};
    dit(/85/.test(v.texte) && /112/.test(v.texte) && /7/.test(v.texte) && v.date === 'mise' && /vinted\.fr\/items\/7699993201/.test(v.lien || ''), `F2 ${suf} : Vinted — prix, vues, favoris, date de mise en ligne, lien vers SON annonce`, v);
    dit(/90/.test(l.texte) && /leboncoin\.fr\/ad\/chaussures\/2900003201/.test(l.lien || '') && l.date === 'mise', `F2 ${suf} : Leboncoin — l’annonce reliée par SON lien (identité), son prix et sa date`, l);
    dit(e.publier >= 44 && /pas publi/i.test(e.texte), `F3 ${suf} : eBay lu, pas d’annonce de ce N° ⇒ « Pas publiée » + « Publier » (${e.publier} px)`, e);
    dit(c.raison === 'pas-lu' && !c.publier && /—/.test(c.texte) && !/pas publi/i.test(c.texte) && m.pasLus === 'vestiaire', `F4 ${suf} : Vestiaire pas lu ⇒ « — pas lu », jamais « pas publiée », aucun geste`, c);
    dit(!m.rangs.some((r) => r.deborde) && m.cote <= 1, `F5 ${suf} : rien ne déborde`, m.rangs.filter((r) => r.deborde));
    await o.pg.addStyleTag({ content: '[data-fiche-messages]{display:none!important}' });
    const q = await o.pg.evaluate(P.mesurer, { tactile: tel, sombre, racines: ['[data-fiche-paire] section[data-fd-sites]'] });
    dit(!q.cibles.length, `F5 ${suf} : cibles ≥ ${tel ? 44 : 36} px (${q.nCibles})`, q.cibles.slice(0, 4));
    dit(!q.contraste.length, `F5 ${suf} : contrastes ≥ 4,5:1 (${q.nTextes} textes)`, q.contraste.slice(0, 4));
    // « Publier » ouvre « Publier ailleurs » sur eBay, pour CE N° — rien ne part.
    await o.pg.locator('[data-fiche-publier-sur="ebay"]').first().click({ timeout: 4000 }).catch(() => {});
    const pa = await attendre(o.pg, () => !!document.querySelector('[data-publier-ailleurs="3201"]'), 10000);
    await o.pg.waitForTimeout(700);
    const carte = await o.pg.evaluate(() => { const c = document.querySelector('[data-publier-ailleurs="3201"] [data-pa-site]'); return c ? c.getAttribute('data-pa-site') : ''; });
    await o.pg.screenshot({ path: path.join(SHOTS, `fiche-publier-${suf}.png`) });
    dit(pa && carte === 'ebay', `F6 ${suf} : « Publier » ouvre « Publier ailleurs » du N°3201, eBay en tête (rien n’est publié)`, { pa, carte });
    await o.pg.keyboard.press('Escape').catch(() => {}); await o.pg.waitForTimeout(600);
    // La paire VENDUE : aucun « Publier » nulle part.
    await o.pg.evaluate(() => { for (const b of document.querySelectorAll('[data-publier-ailleurs] button')) if (/fermer|×/i.test((b.getAttribute('aria-label') || '') + b.textContent)) { b.click(); break; } });
    await ouvrirFiche(o.pg, '3119');
    const mv = await o.pg.evaluate(mesureSites);
    await o.pg.screenshot({ path: path.join(SHOTS, `fiche-vendue-${suf}.png`) });
    dit(!!mv && mv.section && mv.rangs.some((r) => r.etat === 'vendue') && mv.rangs.every((r) => !r.publier) && mv.rangs.length >= 4, `F7 ${suf} : vendue (N°3119) ⇒ « Vendue » datée, « Publier » nulle part`, mv && mv.rangs);
    dit(!o.erreurs.length, `F ${suf} : aucune erreur de page`, o.erreurs.slice(0, 3));
  } catch (err) { dit(false, `F ${suf} : le banc a rencontré une erreur`, String(err && err.stack || err)); }
  finally { await o.ctx.close().catch(() => {}); }
}

// ── A : la base de relier-facile (un modèle distinct par vente et SON achat arrivé 15 j avant). ──
const MODELES = ['Adidas Handball Spezial bleu marine', 'Nike Air Force 1 blanc', 'Salomon XT-6 noir', 'Asics Gel Kayano 14 argent', 'New Balance 550 vert', 'Nike Dunk Low panda noir',
  'Adidas Samba beige', 'Onitsuka Tiger Mexico 66 jaune', 'Nike Air Max 90 rouge', 'Asics Novablast 4 bleu', 'Saucony Triumph 21 gris', 'New Balance 9060 rose'];
const svg = (h) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${h},40%,80%)"/></svg>`);
function baseAchats() {
  const b = P.base();
  let k = 0, tx = 99100000000;
  const achatsDe = new Map();
  // Seuls les achats de ce banc (chacun avec SA vente 15 j plus tard) : la série commence par un achat qui a une proposition.
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) { r.data.payload.my_orders = []; achatsDe.set(r.id.replace(/_orders_purchased$/, ''), r); }
  for (const r of b.rows) {
    if (!/_orders_sold$/.test(r.id)) continue;
    const pr = achatsDe.get(r.id.replace(/_orders_sold$/, '')); if (!pr) continue;
    for (const o of r.data.payload.my_orders || []) {
      const mo = MODELES[k % MODELES.length], t = String(36 + (Math.floor(k / MODELES.length) % 12));
      o.title = `${mo} taille ${t}`; o.size_title = t;
      const d = new Date(Date.parse(o.date) - 15 * J).toISOString();
      pr.data.payload.my_orders.push({ transaction_id: ++tx, conversation_id: tx, title: `${mo} ${t}`, price: { amount: String(18 + (k % 9)) + '.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: d, photo: { url: svg((k * 37) % 360) } });
      k++;
    }
  }
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) for (const a of r.data.payload.my_orders || []) if (!a.photo) a.photo = { url: svg((Number(a.transaction_id) * 37) % 360) };
  return b;
}
const mesureSerie = () => {
  const f = document.querySelector('[data-relier-feuille]');
  const s = f && f.querySelector('[data-la-serie]');
  const vis = (e) => !!e && e.getClientRects().length > 0;
  const best = f && f.querySelector('[data-la-meilleure]');
  const passer = f && f.querySelector('[data-la-passer]');
  return { ouverte: !!f, achats: !!(f && f.querySelector('[data-la-serie-achats]')), serie: s ? s.getAttribute('data-la-serie') : '', tx: f ? f.getAttribute('data-relier-depuis') : '',
    best: best ? best.getAttribute('data-la-meilleure') : '', sugg: f ? f.querySelectorAll('[data-la-suggestion]').length : 0, passerH: passer ? Math.round(passer.getBoundingClientRect().height) : 0, grille: !!(f && f.querySelector('[data-la-grille]')),
    deborde: document.documentElement.scrollWidth - innerWidth, entree: (() => { const e = document.querySelector('[data-achats-serie]'); return e && vis(e) ? Number(e.getAttribute('data-achats-serie')) : null; })() };
};

async function partieA(nav, W, th) {
  const sombre = th === 'sombre', suf = `${W}-${th}`;
  const o = await P.ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b: baseAchats(), url: '/?tab=achats', dsf: DSF });
  const pg = o.pg;
  try {
    await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
    const vu = await attendre(pg, () => !!document.querySelector('[data-achats-serie]'), 40000);
    await pg.waitForTimeout(1200); await sansToasts(pg);
    const m0 = await pg.evaluate(mesureSerie);
    await pg.screenshot({ path: path.join(SHOTS, `achats-entree-${suf}.png`) });
    if (!dit(vu && m0.entree >= 2, `A1 ${suf} : « ${m0.entree} achats arrivés sans vente » dans Achats`, m0)) return;
    const H = await pg.evaluate(() => Math.round(document.querySelector('[data-achats-serie]').getBoundingClientRect().height));
    dit(H >= 44, `A1 ${suf} : l’entrée se touche (${H} px)`);
    await pg.locator('[data-achats-serie]').first().click();
    await attendre(pg, () => !!document.querySelector('[data-relier-feuille] [data-la-serie]'), 10000);
    await attendre(pg, () => !!document.querySelector('[data-relier-feuille] [data-la-grille], [data-relier-feuille] [data-la-vide]'), 15000);
    await pg.waitForTimeout(600);
    const m1 = await pg.evaluate(mesureSerie);
    await pg.screenshot({ path: path.join(SHOTS, `achats-serie-1-${suf}.png`) });
    dit(m1.ouverte && m1.achats && m1.serie === `1/${m0.entree}` && m1.passerH >= 44, `A2 ${suf} : la feuille « Relier à une vente / annonce », « 1 sur ${m0.entree} », « Passer » ≥ 44 px`, m1);
    // La base a des ventes identiques (même modèle, même taille, trois comptes) : la proposition est « la meilleure » quand
    // elle est seule, sinon des suggestions à égalité — jamais tranchées (relier-facile le juge en détail).
    dit(!!m1.best || m1.sugg > 0, `A2 ${suf} : la vente proposée en tête (${m1.best ? 'la meilleure' : m1.sugg + ' suggestion(s) à égalité'})`, m1);
    // Passer : le suivant, rien n'est écrit.
    await pg.locator('[data-relier-feuille] [data-la-passer]').first().click();
    await attendre(pg, (s) => { const e = document.querySelector('[data-relier-feuille] [data-la-serie]'); return !!e && e.getAttribute('data-la-serie') === s; }, 8000, `2/${m0.entree}`);
    await pg.waitForTimeout(700);
    const m2 = await pg.evaluate(mesureSerie);
    dit(m2.serie === `2/${m0.entree}` && m2.tx && m2.tx !== m1.tx, `A3 ${suf} : « Passer » ⇒ « 2 sur ${m0.entree} », un autre achat`, { m1: m1.tx, m2 });
    // Relier : « Relier » choisit, « Oui » écrit, la série avance.
    await attendre(pg, () => !!document.querySelector('[data-relier-feuille] [data-la-meilleure] [data-la-relier], [data-relier-feuille] [data-la-suggestion]'), 8000);
    await pg.locator('[data-relier-feuille] [data-la-meilleure] [data-la-relier], [data-relier-feuille] [data-la-suggestion]').first().click({ timeout: 4000 }).catch(() => {});
    await pg.waitForTimeout(300);
    const conf = await pg.evaluate(() => { const f = document.querySelector('[data-relier-feuille]'); return { oui: !!(f && f.querySelector('[data-la-confirme] [data-la-oui]')), serie: ((f && f.querySelector('[data-la-serie]')) || { getAttribute: () => '' }).getAttribute('data-la-serie') }; });
    await pg.screenshot({ path: path.join(SHOTS, `achats-serie-confirme-${suf}.png`) });
    dit(conf.oui && conf.serie === `2/${m0.entree}`, `A4 ${suf} : « Relier » ne relie pas seul : « Non · Oui », la série n’a pas bougé`, conf);
    await pg.locator('[data-relier-feuille] [data-la-oui]').first().click({ timeout: 4000 }).catch(() => {});
    await attendre(pg, (s) => { const e = document.querySelector('[data-relier-feuille] [data-la-serie]'); return !!e && e.getAttribute('data-la-serie') === s; }, 10000, `3/${m0.entree}`);
    await pg.waitForTimeout(800);
    const m3 = await pg.evaluate(mesureSerie);
    const annuler = await pg.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.getClientRects().length && /^annuler$/i.test(x.textContent.trim())).length);
    await pg.screenshot({ path: path.join(SHOTS, `achats-serie-3-${suf}.png`) });
    dit(m3.serie === `3/${m0.entree}` && m3.tx !== m2.tx, `A5 ${suf} : « Oui » ⇒ relié, l’achat suivant (« 3 sur ${m0.entree} »)`, m3);
    dit(annuler >= 1, `A5 ${suf} : le geste reste annulable (« Annuler »)`, annuler);
    dit(m3.deborde <= 1, `A5 ${suf} : rien ne déborde`, m3.deborde);
    // Fermer : la série s'arrête ; l'entrée compte un achat de moins (celui relié).
    await pg.locator('[data-relier-fermer]').first().click({ timeout: 4000 }).catch(() => {});
    await attendre(pg, () => !document.querySelector('[data-relier-feuille]'), 6000);
    await pg.waitForTimeout(1500);
    const m4 = await pg.evaluate(mesureSerie);
    dit(!m4.ouverte && m4.entree === m0.entree - 1, `A6 ${suf} : fermer arrête la série ; ${m4.entree} achats restent (un relié, un passé gardé)`, m4);
    dit(!o.erreurs.length, `A ${suf} : aucune erreur de page`, o.erreurs.slice(0, 3));
  } catch (err) { dit(false, `A ${suf} : le banc a rencontré une erreur`, String(err && err.stack || err)); }
  finally { await o.ctx.close().catch(() => {}); }
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => P.chromium.launch({ args: ['--no-sandbox'] }));
  try {
    for (const W of LARG) for (const th of THEMES) {
      console.log(`\n── Fiche · sur les sites / série Achats · ${W} · ${th}`);
      if (PARTIES.includes('F')) await partieF(nav, W, th);
      if (PARTIES.includes('A')) await partieA(nav, W, th);
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); P.srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
