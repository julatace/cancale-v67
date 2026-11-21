require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES · RETOURS ET LITIGES, EN-TÊTE COLLANT, RELIER, ÉTAPE (20 nov. 2026) — l'écran RENDU, base INVENTÉE.
//  Julien (capture Edge 1512) : « on a 4 litiges avec 2 écritures différentes » (deux cartes « Retour en route · Déjà reçu »
//  + un bloc « Retours · 8 » d'un autre style, plein noir « Remettre en ligne » dans une rangée) ; « Tous les comptes » coupé
//  et le segmenté caché sous l'en-tête collant ; des rangées qui défilent AU-DESSUS de l'en-tête ; « il y a la place pour
//  mettre le bouton relier » ; « En route · vendue il y a 12 j » à côté de l'étiquette « Livrée ».
//  Base : celle de design-passe + 11 ventes en RETOUR sur le 1er compte : 2 en route vers lui (N° connus), 2 initiés,
//  6 remboursées il y a plus de 45 j (anciennes), 1 remboursée récente (revenue seule ⇒ « à vérifier, remettre en ligne »).
//  Mesure :
//    R  UNE présentation : plus aucun bloc d'avant (`data-retours-recu`, `data-retours-encours`) ; un groupe « Retours et
//       litiges · 11 » replié ; ouvert : 5 rangées récentes, ≤ 1 geste par rangée (bouton TEXTE), aucun plein dans une rangée,
//       étapes en étiquettes neutres connues ; « Voir les 6 anciens » ⇒ 11 ; au téléphone : toucher ⇒ la feuille des gestes ;
//    H  en-tête : après défilement, le segmenté et « Tous les comptes » restent visibles et NON recouverts (1512, 1280) ;
//       au téléphone, le segmenté reste visible ; aucune rangée ne se voit au-dessus du bas de l'en-tête collant ;
//    A  « Relier » : colonne « Achat » ; chaque vente Vinted sans achat relié a son bouton-icône (nom accessible), une vente
//       reliée dit « acheté N € » ;
//    E  « En route » : la méta et l'étiquette disent la MÊME étape (jamais « En route » à côté de « Livrée »).
//  `BANC_DIST=…` juge un autre build (rouge attendu sur le code d'avant). `SHOTS=dossier` garde les captures (DSF 2).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ventes-retours');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '1512,1280,390').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click();
  for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position !== 'fixed' || !/paires? numérotées?/.test(e.textContent || '') || e.closest('.n-onglets, .vrm-tabbar')) continue;
    const f = [...e.querySelectorAll('button')].find((b) => /fermer|close|×/i.test((b.getAttribute('aria-label') || '') + b.textContent)); if (f) { f.click(); break; } } }).catch(() => {}); await pg.waitForTimeout(400); };

const J = 864e5, ISO = (j) => new Date(Date.now() - j * J).toISOString();
function baseRetours() {
  const b = base();
  const a0 = b.accounts[0], uid = a0.vinted_user_id;
  const sold = b.rows.find((r) => r.id === `harvest_${uid}_orders_sold`);
  const ov = b.main[0].data.vinted_sale_overrides = b.main[0].data.vinted_sale_overrides || {};
  const TIT = ['Nike Dunk Low gris taille 42', 'Adidas Samba OG blanches taille 40', 'Asics Gel-Kayano 14 argent taille 43', 'New Balance 550 crème taille 41',
    'Salomon XT-6 noires taille 44', 'Puma Suede bleues taille 39', 'Nike Air Max 90 taille 42', 'Adidas Gazelle vertes taille 38', 'Converse Chuck 70 taille 41',
    'Vans Old Skool taille 40', 'Asics Gel-Lyte III taille 42'];
  const nouvelles = [];
  for (let i = 0; i < 11; i++) {
    const t = 22900000000 + i, it = 7900000000 + i;
    const enRoute = i < 2, initie = i >= 2 && i < 4, ancien = i >= 4 && i < 10, recent = i === 10;
    const d = ISO(ancien ? 60 + i : recent ? 9 : 6 + i);
    nouvelles.push({ transaction_id: t, title: TIT[i], price: { amount: String(40 + i * 3) + '.0', currency_code: 'EUR' }, status: 'Retour initié', date: d, item_id: it,
      transaction_user_status: (ancien || recent) ? 'failed' : 'waiting', photo: { url: `https://images1.vinted.net/t/${it}/f800/r.jpeg?s=abc` }, user_login: 'acheteuse_' + (i + 1), conversation_id: 18900000000 + i });
    b.rows.push({ id: `harvest_${uid}_txn_${t}`, data: { capturedAt: ISO(0.1), payload: { transaction: { id: t, item_id: it, status: 440, status_title: 'Retour initié', status_updated_at: ISO(2),
      shipment: { status_title: enRoute ? 'Colis en transit' : 'Bordereau envoyé' }, item: { id: it, title: TIT[i] } } } } });
    ov[String(t)] = { ...(ov[String(t)] || {}), numero: String(301 + i) };
  }
  sold.data.payload.my_orders = [...nouvelles, ...sold.data.payload.my_orders];
  sold.data.nItems = sold.data.payload.my_orders.length;
  return b;
}

function mesure() {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const R = (e) => e.getBoundingClientRect();
  const anciens = [...document.querySelectorAll('[data-retours-recu], [data-retours-encours], [data-retour-carte]')].filter(vis).length;
  const g = document.querySelector('[data-vr-groupe]');
  const rangs = [...document.querySelectorAll('[data-vr-rang]')].filter(vis).map((r) => {
    const gestes = [...r.querySelectorAll('[data-vr-geste]')].filter(vis);
    const pleins = [...r.querySelectorAll('button, a')].filter(vis).filter((b) => { const cs = getComputedStyle(b); const m = cs.backgroundColor.match(/\d+(\.\d+)?/g) || []; const a = m.length > 3 ? Number(m[3]) : 1;
      if (a < 0.5) return false; const l = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; const ld = document.documentElement.matches('[data-theme="dark"], .dark') || matchMedia('(prefers-color-scheme: dark)').matches; return ld ? l > 0.8 : l < 0.25; });
    const et = r.querySelector('[data-vr-etape], .n-pastille'); return { cle: r.getAttribute('data-vr-rang'), gestes: gestes.length, geste: gestes[0] ? gestes[0].textContent.trim() : '', classe: gestes.every((x) => x.classList.contains('n-vr-geste')), pleins: pleins.length, etape: et ? et.textContent.trim() : '' };
  });
  return { anciens, groupe: g ? g.getAttribute('data-vr-groupe') : null, n: g ? Number(g.getAttribute('data-vr-n')) : null, rangs,
    bouton: (document.querySelector('[data-vr-anciens]') || { getAttribute: () => null }).getAttribute('data-vr-anciens') };
}
// L'en-tête : les éléments à garder visibles et non recouverts, et rien au-dessus du bas du bloc collant.
function tete() {
  const R = (e) => e.getBoundingClientRect();
  const libre = (e) => { if (!e || !e.getClientRects().length) return { ok: false, pourquoi: 'absent' }; const r = R(e); if (r.top < 0 || r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight) return { ok: false, pourquoi: 'hors écran', r: [r.left, r.top, r.right, r.bottom].map(Math.round) };
    const pts = [[r.left + 6, r.top + r.height / 2], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 6, r.top + r.height / 2]];
    for (const [x, y] of pts) { const h = document.elementFromPoint(x, y); if (!h || !(e === h || e.contains(h))) return { ok: false, pourquoi: 'recouvert', par: h ? (h.className || h.tagName) + '' : null, r: [r.left, r.top].map(Math.round) }; }
    return { ok: true }; };
  const seg = document.querySelector('[data-vn="ventes"] .n-segmente, .n-vt-segment .n-segmente');
  const compte = document.querySelector('[data-vn="ventes"] [data-tt-compte]');
  const colle = document.querySelector('[data-vn="ventes"] [data-tt-colle], [data-vn-colle]');
  let dessus = [];
  if (colle) { const b = R(colle).bottom; for (const x of [innerWidth * 0.35, innerWidth * 0.55, innerWidth * 0.75]) for (const y of [b - 4, Math.max(2, b - 30), 2, 8, 13]) { const h = document.elementFromPoint(x, y); if (h && h.closest('[data-tt-ligne], [data-vn-rang], [data-vn-route], [data-vr-rang]')) dessus.push(Math.round(y)); } }
  // Le haut de l'écran AU-DESSUS de la barre collée (la marge du défileur) : couvert par le fond de la barre (son ::after).
  const barre = [...document.querySelectorAll('.n-barre-titre')].find((x) => x.getClientRects().length);
  let hautNu = 0;
  if (barre) { const t = R(barre).top; const a = getComputedStyle(barre, '::after'); const couvre = barre.hasAttribute('data-n-fond') && a.content !== 'none' && a.content !== 'normal' ? parseFloat(a.height) || 0 : 0; hautNu = Math.max(0, Math.round(t - couvre)); }
  if (hautNu > 0) dessus = dessus.filter((y) => y >= hautNu);
  else dessus = dessus.filter((y) => !barre || y >= R(barre).top);
  return { seg: libre(seg), compte: compte ? libre(compte) : null, colle: !!colle, dessus, hautNu };
}
// Défile la liste (le conteneur qui défile vraiment) de `px`.
async function defiler(pg, px) {
  await pg.evaluate((px) => {
    const t = document.querySelector('[data-vn="ventes"] [data-tt-tableau], [data-vn-liste]');
    let e = t; while (e && e !== document.body) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) break; e = e.parentElement; }
    if (e && e !== document.body) e.scrollTop += px; else window.scrollBy(0, px);
  }, px);
  await pg.waitForTimeout(600);
}
function ventesRoute() {
  return [...document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne], [data-vn-liste="route"] [data-vn-route]')].filter((e) => e.getClientRects().length).map((r) => ({
    cle: r.getAttribute('data-tt-ligne') || r.getAttribute('data-vn-route'),
    sous: ((r.querySelector('.n-tt-article-sous, .n-rangee-sous') || {}).textContent || '').trim(),
    etiquette: ((r.querySelector('.n-tt-etiquette, .n-vt-valeur .n-pastille') || {}).textContent || '').trim() }));
}
function achats() {
  const th = !!document.querySelector('[data-vn="ventes"] [data-tt-th="achat"]');
  const L = [...document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne]')].filter((e) => e.getClientRects().length).map((r) => {
    const c = r.querySelector('[data-tt-col="achat"]'); const b = c && c.querySelector('[data-vt-relier]');
    return { cle: r.getAttribute('data-tt-ligne'), site: r.getAttribute('data-vt-site') || 'vinted', bouton: !!b, nom: b ? (b.getAttribute('aria-label') || '') : '', relie: b ? b.getAttribute('data-vt-relier') === 'relie' : false,
      texte: c ? c.textContent.trim() : '', taille: b ? Math.round(b.getBoundingClientRect().width) : 0, svg: !!(b && b.querySelector('svg path, svg rect')) };
  });
  return { th, L };
}

async function ouvrirVentes(nav, { W, sombre, b }) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: '/?tab=ventes', dsf: DSF });
  if (W === 1280) await pg.setViewportSize({ width: 1280, height: 800 });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-vn="ventes"]') && !!document.querySelector('[data-vn="ventes"] [data-tt-ligne], [data-vn-liste] [data-vn-rang]'), 40000);
  await pg.waitForTimeout(2000); await sansToasts(pg);
  return { ctx, pg, erreurs };
}
const segment = async (pg, i) => { await pg.locator('[data-vn="ventes"] .n-segmente button, [data-vn="ventes"] .n-segmente [role="tab"], .n-vt-segment .n-segmente button').nth(i).click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500); };

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseRetours();
  try {
    for (const W of LARG) for (const th of THEMES) {
      const tel = W < 600, sombre = th === 'sombre';
      console.log(`\n── Ventes · retours · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W, sombre, b });
      await segment(pg, 1);   // « En route » : là où vivaient les deux blocs d'avant
      const m = await pg.evaluate(mesure);
      await pg.screenshot({ path: path.join(SHOTS, `retours-${W}-${th}-replie.png`) });
      dit(m.anciens === 0, `plus aucun bloc d’avant (cartes « Retour en route », bloc « Retours ») (${m.anciens})`);
      if (tel) {
        // (21 nov., ventes-lisibles) Au téléphone : « À régler » et « Retours et litiges » derrière UNE ligne d'accès discrète
        // (jamais des titres empilés sur la liste) ; la feuille les montre OUVERTS.
        const acces = await pg.evaluate(() => { const a = document.querySelector('[data-vn-acces-ouvrir]'); return a ? Number(a.getAttribute('data-vn-acces-n')) : null; });
        dit(m.groupe === null && acces != null && acces >= 11, `UNE ligne d'accès « À régler et retours » (${acces}), aucun groupe posé sur la liste (${m.groupe})`);
        await pg.locator('[data-vn-acces-ouvrir]').first().click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(700);
        const mf = await pg.evaluate(mesure);
        dit(mf.groupe === 'ouvert' && mf.n === 11, `la feuille : « Retours et litiges · 11 », ouvert (${mf.groupe} · ${mf.n})`);
      } else {
        dit(m.groupe === 'replie' && m.n === 11, `UN groupe « Retours et litiges · 11 », replié (${m.groupe} · ${m.n})`);
        await pg.locator('[data-vr-groupe] .n-groupe-repli').first().click({ timeout: 5000 }).catch(() => {});
      }
      await pg.waitForTimeout(700);
      const m2 = await pg.evaluate(mesure);
      await pg.evaluate(() => { const g = document.querySelector('[data-vr-groupe]'); if (g) g.scrollIntoView({ block: 'start' }); });
      await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(SHOTS, `retours-${W}-${th}-ouvert.png`) });
      dit(m2.rangs.length === 5, `ouvert : les 5 récents (2 en route, 2 initiés, 1 à vérifier) (${m2.rangs.length})`, m2.rangs.map((r) => r.etape));
      const ETAPES = /^(En route vers toi|Initié|Reçu chez toi|À vérifier|Remis en stock|Remboursé)$/;
      dit(m2.rangs.every((r) => ETAPES.test(r.etape)), 'étapes en étiquettes connues', m2.rangs.map((r) => r.etape));
      dit(m2.rangs.filter((r) => /En route/.test(r.etape)).length === 2 && m2.rangs.some((r) => /vérifier/.test(r.etape)) && m2.rangs.filter((r) => /Initié/.test(r.etape)).length === 2, 'les étapes de la base : 2 en route, 2 initiés, 1 à vérifier');
      if (!tel) dit(m2.rangs.every((r) => r.gestes <= 1 && r.classe && r.pleins === 0), 'au plus UNE action par rangée, en bouton texte, aucun plein', m2.rangs);
      else dit(m2.rangs.every((r) => r.gestes === 0 && r.pleins === 0), 'téléphone : rangées natives, aucun bouton dans la rangée', m2.rangs);
      dit(m2.bouton === '6', `« Voir les 6 anciens » (${m2.bouton})`);
      await pg.locator('[data-vr-anciens]').first().click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(500);
      const m3 = await pg.evaluate(mesure);
      dit(m3.rangs.length === 11, `avec les anciens : 11 (${m3.rangs.length})`);
      if (tel) {
        await pg.locator('[data-vr-rang]').first().click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(700);
        const f = await pg.evaluate(() => [...document.querySelectorAll('[data-vr-gestes] [data-vr-geste]')].map((e) => e.getAttribute('data-vr-geste')));
        await pg.screenshot({ path: path.join(SHOTS, `retours-${W}-${th}-feuille.png`) });
        dit(f.length >= 2 && f.includes('site'), `toucher ⇒ la feuille de ses gestes (${f.join(', ')})`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        // (21 nov.) puis la feuille d'accès « À régler et retours » se referme (Échap), la liste revient.
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
        dit(!(await pg.evaluate(() => [...document.querySelectorAll('[data-vn-acces-feuille], .n-feuille-poignee')].some((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'))), 'la feuille d’accès se referme');
      }
      // E : la méta et l'étiquette disent la même étape.
      const vr = await pg.evaluate(ventesRoute);
      const contradictions = vr.filter((x) => (/livr/i.test(x.etiquette) && /^En route/i.test(x.sous)) || (/^En route/i.test(x.etiquette) && /^Livr/i.test(x.sous)) || (/termin/i.test(x.etiquette) && /^(En route|Livr)/i.test(x.sous)));
      dit(vr.length > 0 && !contradictions.length, `« En route » : la méta et l’étiquette disent la même étape (${vr.length} lignes)`, contradictions.slice(0, 3));
      // H : l'en-tête après défilement.
      await pg.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; window.scrollTo(0, 0); });
      await segment(pg, 0);
      await defiler(pg, 700);
      const t = await pg.evaluate(tete);
      await pg.screenshot({ path: path.join(SHOTS, `entete-${W}-${th}-defile.png`) });
      dit(t.seg.ok, `après défilement, le segmenté reste visible et non recouvert`, t.seg);
      if (!tel) dit(t.compte && t.compte.ok, `après défilement, « Tous les comptes » reste visible et entier`, t.compte);
      dit(t.colle && !t.dessus.length && !t.hautNu, `aucune rangée visible au-dessus du bas de l’en-tête collant (haut non couvert : ${t.hautNu} px)`, t);
      // A : relier.
      if (!tel) {
        await pg.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; window.scrollTo(0, 0); });
        await pg.waitForTimeout(300);
        const a = await pg.evaluate(achats);
        await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}.png`) });
        dit(a.th, 'colonne « Achat » dans le tableau');
        const lt = await pg.evaluate(() => { const L = [...document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne] .n-tt-article-titre')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().width));
          const cadre = document.querySelector('[data-vn="ventes"] [data-tt-tableau]'); return { cadreDeb: cadre ? cadre.scrollWidth - cadre.clientWidth : 0, min: L.length ? Math.min(...L) : 0, site: !!document.querySelector('[data-vn="ventes"] [data-tt-th="site"]'), deb: document.documentElement.scrollWidth - innerWidth }; });
        dit(lt.min >= 200 && lt.deb <= 1 && lt.cadreDeb <= 1, `colonnes Site et Achat ensemble : chaque titre garde ≥ 200 px, rien ne déborde, le tableau ne défile pas de côté (${lt.min} px · cadre ${lt.cadreDeb} · site ${lt.site})`);
        const v = a.L.filter((x) => x.site === 'vinted');
        dit(v.length && v.every((x) => x.bouton && x.svg && x.nom), `chaque vente Vinted : le bouton-icône Relier, nommé (${v.filter((x) => x.bouton).length}/${v.length})`, v.slice(0, 2));
        dit(v.filter((x) => x.relie).every((x) => /\d/.test(x.texte)) && v.filter((x) => !x.relie).every((x) => /Relier/i.test(x.nom)), 'reliée : le prix d’achat ; sinon « Relier à son achat »', v.slice(0, 3));
        const libre = v.find((x) => !x.relie);
        if (libre) {
          await pg.locator(`[data-tt-ligne="${libre.cle}"] [data-vt-relier]`).click({ timeout: 5000 }).catch(() => {});
          const ouvert = await attendre(pg, () => !!document.querySelector('[data-relier-feuille]'), 8000);
          await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}-feuille.png`) });
          dit(ouvert, 'toucher Relier ouvre l’atelier sur CETTE vente (rien n’est relié tout seul)');
        }
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
