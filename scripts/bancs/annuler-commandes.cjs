// ════════════════════════════════════════════════════════════════════════════
//  BANC : LOT B (9 nov.) — « ANNULER » 5 s AU LIEU D'UNE CONFIRMATION + ⌘K QUI AGIT
//  src/annulerCommandes.js · src/gesteAnnulable.js · src/App.jsx (loupe, gestes)
//
//  Une base à ÉTAT et à la vraie forme (`_base-ecritures.cjs` : PATCH conditionnel
//  sur `data->>rev`), données INVENTÉES (dépôt public) : deux ventes à expédier avec
//  bordereau, un achat finalisé, une paire numérotée N°88 en ligne. À 390 tactile et
//  1512 (clair) :
//   R1 Annonces → … → « Marquer vendue » : AUCUNE confirmation, l'annonce part tout de
//      suite, la pilule « Annonce marquée vendue » + « Annuler » ; la base l'a, écrit sur LA
//      ligne `main` en comparer-et-échanger (`data->>rev=eq.N` ⇒ rev N+1) ; « Annuler »
//      ⇒ l'annonce revient, la base retrouve EXACTEMENT la valeur d'avant (même ligne,
//      rev+1), et rien d'autre de SES données n'a bougé ;
//   R2 Achats → … → « Masquer cet achat » : la même chose (la ligne revient à SA place) ;
//   E1 un geste EXTÉRIEUR demande toujours confirmation : ⌘K « imprimer » ⇒ Entrée ⇒ la
//      feuille « Tout imprimer » s'ouvre (rien d'écrit, aucun PDF lu, aucune commande à
//      l'extension) ; « Imprimer » ⇒ la confirmation (`.vrm-confirmation`) ; « Annuler »
//      ⇒ aucun PDF lu, rien d'imprimé ;
//   K1 champ vide : le groupe « Actions » (4 actions, ≥ 44 px, même rendu que les lignes) ;
//   K2 « colis à retirer » ⇒ l'action en tête ; Entrée ⇒ Colis → À retirer ;
//   K3 « baisser le prix de 88 » ⇒ ↓ puis Entrée (1512) / toucher (390) ⇒ la feuille du
//      prix du N°88, rien d'envoyé ;
//   K4 « 88 » seul : « Tout sur le N° » reste la 1re ligne, les actions du N° suivent ;
//   K5 « export » ⇒ Compta, la carte « Exporter pour mon comptable » montrée, PAS préparée ;
//   K6 « ma configuration » ⇒ la configuration plein écran.
//   Pour chaque action : aucune écriture de SES données, aucune requête /api, aucune
//   commande à l'extension.
//  Jugé sur les data-* et les nombres rendus (§6.4). Captures dans $BANC_CAPTURES (par
//  défaut <tmp>/vrm-bancs/annuler-commandes) — à REGARDER.
//  Lancer (après `npm run build`) : BANC_PORT=12170 node scripts/bancs/annuler-commandes.cjs
// ════════════════════════════════════════════════════════════════════════════
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const sc = require('./_scenario-colis.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'annuler-commandes');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  OK  ' : '  KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.message) || e).replace(/\u001b\[[0-9;]*m/g, '').slice(0, 900)); } };
const VUES = process.env.BANC_VUES ? process.env.BANC_VUES.split(',') : null;

const NOW = Date.now(), iso = (ms) => new Date(ms).toISOString();
const UID = sc.UID[0];
const TX_A = '8820001', TX_B = '8820002', TX_C = '8820003';
const ITEM88 = '9188';
const FICHES = { [ITEM88]: { numero: '88', title: 'Nike Air Max 90 blanche 43', numberedAt: iso(NOW - 20 * 86400e3), auto: false, buyPrice: '40', accountId: UID, price: '75' } };
// Les clés de SES données posées par le banc : aucune ne doit changer sous une action ⌘K,
// et chacune doit revenir EXACTEMENT après « Annuler ».
const MAIN0 = {
  vinted_dark: false, vinted_accounts_hidden: [], vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_printed: {}, vinted_bords_shipped: {},
  vinted_bords_hidden: {}, vinted_purchases_hidden: [], vrm_colis_collected: [], vrm_colis_collected_at: {}, vinted_annonces_vendues: [],
  vinted_annonce_numeros: FICHES, vinted_used_numeros: ['88'], vrm_lbc_liens: {},
  vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_prenom: 'Banc',
  vrm_configuration: { etat: 'fait', at: iso(NOW - 86400e3) },
};
function fabriquer() {
  const ventes = [
    sc.ordre({ tx: TX_A, titre: 'Nike Dunk Low gris 42', prix: 55, statut: sc.STATUT_AEXP, tus: 'needs_action', dateMs: NOW - 86400e3 }),
    sc.ordre({ tx: TX_B, titre: 'Adidas Samba blanche 41', prix: 62, statut: sc.STATUT_AEXP, tus: 'needs_action', dateMs: NOW - 2 * 86400e3 }),
  ];
  const achats = [sc.ordre({ tx: TX_C, titre: 'New Balance 550 verte 44', prix: 48, statut: sc.STATUT_FINAL, tus: 'completed', dateMs: NOW - 5 * 86400e3 })];
  return H.creerBase({
    accounts: sc.comptes(),
    lignes: [
      { id: 'main', data: { ...JSON.parse(JSON.stringify(MAIN0)), rev: 7 } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: ventes } } },
      { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: achats } } },
      { id: `harvest_${sc.UID[1]}_orders_sold`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: [] } } },
      { id: `harvest_${sc.UID[1]}_orders_purchased`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: [] } } },
      { id: `harvest_${UID}_listings`, data: { capturedAt: iso(NOW - 600e3), payload: { items: [{ id: Number(ITEM88), title: FICHES[ITEM88].title, price: { amount: '75.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false }], pagination: { total_entries: 1 } } } },
      sc.bordereau({ tx: TX_A }), sc.bordereau({ tx: TX_B }),
      // (14 nov., bancs au vert) Un vendeur installé a la boîte et le dressing de CHAQUE compte lus par l'extension.
      // Sans eux, l'écran d'arrivée (Achats, Ventes) relisait ces comptes par le relais du serveur (POST
      // /api/vinted-proxy : inbox, users/current) — une lecture de l'écran, que K2 prenait pour un envoi du geste.
      { id: `harvest_${UID}_inbox`, data: { capturedAt: iso(NOW - 60e3), payload: { conversations: [], pagination: { total_entries: 0 } } } },
      { id: `harvest_${sc.UID[1]}_inbox`, data: { capturedAt: iso(NOW - 60e3), payload: { conversations: [], pagination: { total_entries: 0 } } } },
      { id: `harvest_${sc.UID[1]}_listings`, data: { capturedAt: iso(NOW - 600e3), payload: { items: [], pagination: { total_entries: 0 } } } },
    ],
  });
}
const dataMain = (base) => H.dataMain(base) || {};
const egal = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
// SES données posées par le banc (hors `rev`) : ce qui a bougé depuis `snap` (l'état juste
// avant le geste — l'app peut ranger sa ligne à l'ouverture, ce n'est pas le geste).
const instantMain = (base) => JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(MAIN0).map((k) => [k, dataMain(base)[k]]))));
const bouge = (base, snap) => Object.keys(MAIN0).filter((k) => !egal(dataMain(base)[k], snap[k]));
const pilule = (pg) => pg.evaluate(() => {
  const p = document.querySelector('.vrm-pil:not(.is-sortie)');
  if (!p) return { etat: null };
  const a = p.querySelector('[data-pilule-annuler],[data-pilule-reessayer]');
  return { etat: p.getAttribute('data-pilule-etat'), texte: p.innerText.replace(/\s+/g, ' ').trim(), annuler: !!p.querySelector('[data-pilule-annuler]'), hBouton: a ? a.offsetHeight : 0 };
});
const attendreEtat = (pg, etats, ms = 9000) => H.attendre(async () => etats.includes((await pilule(pg)).etat), ms, 60);
const confirmation = (pg) => pg.evaluate(() => [...document.querySelectorAll('.vrm-confirmation')].some((x) => x.getClientRects().length));
// Les écritures du geste : PATCH de LA ligne `main`, conditionnel sur `data->>rev`.
const ecrituresMainDepuis = (base, n) => base.ecritures.slice(n).filter((e) => e.meth === 'PATCH' && /id=eq\.main/.test(e.url) && e.corps && e.corps.data);
const revCond = (e) => { const m = /data->>rev=eq\.(\d+)/.exec(e.url); return m ? Number(m[1]) : null; };

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || 12170);
  const nav = await H.lancer();
  for (const [vp, nom] of [[{ width: 390, height: 844 }, '390-clair'], [{ width: 1512, height: 950 }, '1512-clair']]) {
    if (VUES && !VUES.includes(nom)) continue;
    const tel = vp.width < 600;
    console.log(`\n— Annuler & ⌘K · ${nom}`);
    const base = fabriquer();
    const A = await H.appareil(nav, base, { nom, vp, init: { vinted_dark: 'false' } });
    const { pg, errs } = await A.ouvrir(nom);
    // Ce qui part vers l'extension (commandes) et vers les fonctions serveur (/api).
    await pg.addInitScript(() => { window.__cmdExt = []; const pm = window.postMessage.bind(window); window.postMessage = (d, o, t) => { try { if (d && d.__vmr && /^cmd/.test(String(d.__vmr))) window.__cmdExt.push(d); } catch (_) {} return pm(d, o, t); }; });
    // Une LECTURE par une fonction serveur (GET : santé, relais, comptes…) n'agit pas ; ce qui
    // pourrait agir (POST/PUT/PATCH/DELETE vers /api) est compté.
    const api = []; pg.on('request', (r) => { const u = r.url(); if (/\/api\//.test(u) && r.method() !== 'GET') api.push(r.method() + ' ' + u.replace(/^https?:\/\/[^/]+/, '')); });
    const lecturesPdf = () => base.lectures.filter((l) => /pdfB64|select=data(&|$)|select=\*/.test(l.url) && /email_bord_/.test(l.url)).length;

    await pg.goto(srv.url + '/?tab=cat_bord', { waitUntil: 'domcontentloaded' });
    await H.attendre(async () => (await pg.locator('[data-colis-onglet-choix="envoyer"]').count()) > 0, 30000);
    await H.attendre(async () => (await pg.evaluate(() => localStorage.getItem('vrm_file_envoi'))) == null, 15000);
    await pg.waitForTimeout(1500);

    // ── R1 : Annonces → … → « Marquer vendue » (puis « Annuler ») ────────────
    // (« Masquer ce bordereau » et « Tout marquer retiré » sont convertis aussi, mais leurs
    // boutons ne sont plus montés dans le design actuel : on joue le geste qu'il voit.)
    await essaie('R1', async () => {
      await pg.goto(srv.url + '/?tab=annonces', { waitUntil: 'domcontentloaded' });
      const carte = () => pg.locator(`[data-fiche-menu-ouvrir="${ITEM88}"]`);
      await H.attendre(async () => (await carte().count()) > 0, 25000);
      await H.attendre(async () => (await pg.evaluate(() => localStorage.getItem('vrm_file_envoi'))) == null, 10000);
      await pg.waitForTimeout(800);
      const c0 = await carte().count();
      // (Au téléphone, « … » de la vignette est replié dans la grille : le même bouton, touché par le DOM.)
      if (await carte().first().isVisible()) await carte().first().click(); else await pg.evaluate((id) => document.querySelector(`[data-fiche-menu-ouvrir="${id}"]`).click(), ITEM88);
      await H.attendre(async () => (await pg.locator('[data-fiche-vendue]').count()) > 0, 8000);
      const n0 = base.ecritures.length; const rev0 = dataMain(base).rev; const snap = instantMain(base);
      await pg.locator('[data-fiche-vendue]').first().click();
      const conf = await confirmation(pg); const c1 = await carte().count(); const p1 = await pilule(pg);
      const dejaEcrit = ecrituresMainDepuis(base, n0).some((e) => (e.corps.data.vinted_annonces_vendues || []).includes(ITEM88));
      dit(!conf, 'R1 aucune confirmation (geste réversible dans VRM : rien chez Vinted)');
      dit(c1 === c0 - 1 && !dejaEcrit, 'R1 l’annonce part TOUT DE SUITE, avant que le geste soit écrit', `${c0} → ${c1}`);
      dit(p1.etat === 'envoi' && /marquée vendue/.test(p1.texte || '') && p1.annuler && p1.hBouton >= 44, 'R1 la pilule « Annonce marquée vendue » + « Annuler » (≥ 44 px)', JSON.stringify(p1));
      await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `R1-vendue-${nom}.png`) });
      const ecrit = await H.attendre(async () => (dataMain(base).vinted_annonces_vendues || []).includes(ITEM88), 9000);
      const w1 = ecrituresMainDepuis(base, n0).find((e) => (e.corps.data.vinted_annonces_vendues || []).includes(ITEM88));
      dit(ecrit && w1, 'R1 écrit en base', JSON.stringify(dataMain(base).vinted_annonces_vendues));
      dit(w1 && revCond(w1) != null && w1.corps.data.rev === revCond(w1) + 1 && revCond(w1) >= rev0, 'R1 LA ligne `main`, comparer-et-échanger : rev N ⇒ N+1', w1 ? `${w1.url.replace(/^.*\?/, '')} ⇒ rev ${w1.corps.data.rev}` : 'aucune');
      await attendreEtat(pg, ['enregistre'], 9000);
      const n1 = base.ecritures.length;
      await pg.locator('[data-pilule-annuler]').first().click();
      const c2 = await carte().count();
      dit(c2 === c0, 'R1 « Annuler » ⇒ l’annonce revient tout de suite', `${c1} → ${c2}`);
      const defait = await H.attendre(async () => egal(dataMain(base).vinted_annonces_vendues, snap.vinted_annonces_vendues), 9000);
      const w2 = ecrituresMainDepuis(base, n1).find((e) => egal(e.corps.data.vinted_annonces_vendues, snap.vinted_annonces_vendues));
      dit(defait, 'R1 la base retrouve EXACTEMENT la valeur d’avant', JSON.stringify(dataMain(base).vinted_annonces_vendues));
      dit(w2 && w2.corps.data.rev === revCond(w2) + 1 && w1 && revCond(w2) >= w1.corps.data.rev, 'R1 l’annulation : même ligne, comparer-et-échanger, rev+1', w2 ? `${w2.url.replace(/^.*\?/, '')} ⇒ rev ${w2.corps.data.rev}` : 'aucune');
      dit(!bouge(base, snap).length, 'R1 rien d’autre de ses données n’a bougé', bouge(base, snap).join(', '));
      await pg.screenshot({ path: path.join(CAPT, `R1-annule-${nom}.png`) });
      await H.attendre(async () => (await pilule(pg)).etat == null, 6000);
    });

    // ── R2 : Achats → … → « Masquer cet achat » ─────────────────────────────
    await essaie('R2', async () => {
      await pg.goto(srv.url + '/?tab=achats', { waitUntil: 'domcontentloaded' });
      await H.attendre(async () => (await pg.locator(`.vrm-buy-row[data-achat-tx="${TX_C}"]`).count()) > 0, 20000);
      await H.attendre(async () => (await pg.evaluate(() => localStorage.getItem('vrm_file_envoi'))) == null, 10000);
      const ligne = () => pg.locator(`.vrm-buy-row[data-achat-tx="${TX_C}"]`);
      const l0 = await ligne().count();
      dit(l0 === 1, 'R2 l’achat est dans la liste', String(l0));
      await ligne().first().locator('.vrm-buy-more').click();
      const n0 = base.ecritures.length; const snap = instantMain(base);
      await pg.locator(`[data-achat-masquer="${TX_C}"]`).first().click();
      const conf = await confirmation(pg); const l1 = await ligne().count(); const p1 = await pilule(pg);
      const dejaEcrit = ecrituresMainDepuis(base, n0).some((e) => (e.corps.data.vinted_purchases_hidden || []).includes(TX_C));
      dit(!conf, 'R2 aucune confirmation (réversible : « il revient d’un clic »)');
      dit(l1 === 0 && !dejaEcrit, 'R2 la ligne part TOUT DE SUITE, avant que le geste soit écrit', `${l0} → ${l1}`);
      dit(p1.etat === 'envoi' && /Achat masqué/.test(p1.texte || '') && p1.annuler, 'R2 la pilule « Achat masqué » + « Annuler »', JSON.stringify(p1));
      await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `R2-masque-${nom}.png`) });
      const ecrit = await H.attendre(async () => (dataMain(base).vinted_purchases_hidden || []).includes(TX_C), 9000);
      const w1 = ecrituresMainDepuis(base, n0).find((e) => (e.corps.data.vinted_purchases_hidden || []).includes(TX_C));
      dit(ecrit && w1 && w1.corps.data.rev === revCond(w1) + 1, 'R2 écrit en base, LA ligne `main`, rev N ⇒ N+1', w1 ? `${w1.url.replace(/^.*\?/, '')} ⇒ rev ${w1.corps.data.rev}` : 'aucune');
      await attendreEtat(pg, ['enregistre'], 9000);
      const n1 = base.ecritures.length;
      await pg.locator('[data-pilule-annuler]').first().click();
      dit((await ligne().count()) === 1, 'R2 « Annuler » ⇒ l’achat revient tout de suite');
      const defait = await H.attendre(async () => egal(dataMain(base).vinted_purchases_hidden, MAIN0.vinted_purchases_hidden), 9000);
      const w2 = ecrituresMainDepuis(base, n1).find((e) => egal(e.corps.data.vinted_purchases_hidden, MAIN0.vinted_purchases_hidden));
      dit(defait && w2 && w2.corps.data.rev === revCond(w2) + 1, 'R2 la base retrouve EXACTEMENT la liste d’avant (même ligne, rev+1)', JSON.stringify(dataMain(base).vinted_purchases_hidden));
      dit(!bouge(base, snap).length, 'R2 rien d’autre de ses données n’a bougé', bouge(base, snap).join(', '));
      await pg.screenshot({ path: path.join(CAPT, `R2-annule-${nom}.png`) });
      await H.attendre(async () => (await pilule(pg)).etat == null, 6000);
    });

    // ── La loupe ─────────────────────────────────────────────────────────────
    const ouvrirLoupe = async () => {
      if (tel) { const b = pg.locator('button[data-recherche-loupe]').first(); if (await b.count()) await b.tap(); }
      else { await pg.mouse.click(5, 300); await pg.keyboard.press('Control+K'); }
      return H.attendre(async () => (await pg.locator('[data-recherche-panneau]').count()) > 0, 8000);
    };
    const taper = async (q) => {
      await pg.evaluate((q) => { const el = document.querySelector('[data-recherche-champ]'); const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, q); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); }, q);
      await H.attendre(async () => (await pg.locator(`[data-recherche-q="${q.trim().toLowerCase()}"]`).count()) > 0, 8000);
      await pg.waitForTimeout(350);
    };
    const lignes = () => pg.evaluate(() => [...document.querySelectorAll('#vrm-recherche-resultats [data-tout-parcours], #vrm-recherche-resultats .vrm-recherche-ligne')].filter((x) => x.getClientRects().length).map((x) => ({ action: x.getAttribute('data-recherche-action'), type: x.getAttribute('data-recherche-resultat'), num: x.getAttribute('data-recherche-num'), tout: x.hasAttribute('data-tout-parcours'), h: Math.round(x.getBoundingClientRect().height), cls: x.className, texte: x.innerText.replace(/\s+/g, ' ').slice(0, 60) })));
    // Une action : rien d'écrit de SES données, aucune requête /api, aucune commande à l'extension.
    const sansEffet = async (nomT, avant) => {
      await pg.waitForTimeout(1500);
      const cmd = await pg.evaluate(() => (window.__cmdExt || []).length);
      dit(!bouge(base, avant.snap).length && api.length === avant.api && cmd === 0, `${nomT} : aucune écriture de ses données, aucun envoi /api, aucune commande à l’extension`, `bougé [${bouge(base, avant.snap).join(',')}] · api ${api.slice(avant.api).join(' ; ')} · ext ${cmd}`);
    };
    const instant = () => ({ api: api.length, pdf: lecturesPdf(), snap: instantMain(base) });
    const lancer = async (q, id, nomT) => {
      await ouvrirLoupe(); await taper(q);
      const L = await lignes();
      if (tel) { await pg.locator(`[data-recherche-action="${id}"]`).first().tap(); return L; }
      // Ordinateur : Entrée dans le champ si l'action est en tête ; sinon ↓ jusqu'à elle, puis Entrée.
      const i = L.findIndex((x) => x.action === id);
      if (i === 0) await pg.keyboard.press('Enter');
      else { for (let k = 0; k <= i; k++) await pg.keyboard.press('ArrowDown'); const f = await pg.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-recherche-action')); dit(f === id, `${nomT} : ↓ amène le focus sur l’action`, String(f)); await pg.keyboard.press('Enter'); }
      return L;
    };

    await essaie('K1', async () => {
      await pg.goto(srv.url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(2500);
      dit(await ouvrirLoupe(), 'K1 la loupe s’ouvre');
      await H.attendre(async () => (await pg.locator('[data-recherche-groupe="action"]').count()) > 0, 6000);
      const L = (await lignes()).filter((x) => x.type === 'action');
      dit(L.length === 4 && ['imprimer-jour', 'colis-retirer', 'export-comptable', 'ma-configuration'].every((id) => L.some((x) => x.action === id)), 'K1 champ vide : le groupe « Actions » (imprimer, colis à retirer, export, configuration)', L.map((x) => x.action).join(','));
      dit(L.every((x) => x.h >= 44 && /vrm-recherche-ligne/.test(x.cls)), 'K1 même rendu que les résultats (vrm-recherche-ligne, ≥ 44 px)', L.map((x) => x.h).join(','));
      await pg.screenshot({ path: path.join(CAPT, `K1-vide-${nom}.png`) });
      if (tel) await pg.locator('.vrm-hdr-recherche-fermer').first().tap().catch(() => {}); else await pg.keyboard.press('Escape');
    });

    await essaie('K2', async () => {
      const av = instant();
      const L = await lancer('colis à retirer', 'colis-retirer', 'K2');
      dit(L[0] && L[0].action === 'colis-retirer', 'K2 « colis à retirer » : l’action en tête', L.slice(0, 3).map((x) => x.action || x.type).join(','));
      const ok2 = await H.attendre(async () => (await pg.locator('[data-colis-onglet="retirer"]').count()) > 0, 10000);
      dit(ok2 && /tab=cat_bord|cat_bord/.test(pg.url() + (await pg.evaluate(() => document.querySelector('[data-colis-onglet]') ? 'cat_bord' : ''))), 'K2 Entrée ⇒ Colis → À retirer', await pg.evaluate(() => (document.querySelector('[data-colis-onglet]') || { getAttribute: () => null }).getAttribute('data-colis-onglet')));
      await pg.screenshot({ path: path.join(CAPT, `K2-retirer-${nom}.png`) });
      await sansEffet('K2', av);
    });

    await essaie('E1', async () => {
      const av = instant();
      const L = await lancer('imprimer', 'imprimer-jour', 'E1');
      dit(L[0] && L[0].action === 'imprimer-jour', 'E1 « imprimer » : « Imprimer les bordereaux du jour » en tête', L.slice(0, 3).map((x) => x.action || x.type).join(','));
      const feuille = await H.attendre(async () => (await pg.locator('.vrm-lot[data-lot]').count()) > 0, 12000);
      dit(feuille, 'E1 Entrée ⇒ la feuille « Tout imprimer » (rien d’imprimé)', await pg.evaluate(() => (document.querySelector('.vrm-lot') || { getAttribute: () => null }).getAttribute('data-lot')));
      await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(CAPT, `E1-feuille-${nom}.png`) });
      dit(lecturesPdf() === av.pdf, 'E1 aucun PDF lu à l’ouverture', `${av.pdf} → ${lecturesPdf()}`);
      await sansEffet('E1 (ouverture)', av);
      const n0 = base.ecritures.length;
      // (14 nov., bancs au vert) Depuis le 11 nov. (lot DJ3, décision de Julien : « plus de confirmation N sur M
      // contrôlés à chaque impression »), la feuille « Tout imprimer » EST la confirmation du geste extérieur :
      // son bouton « Imprimer » est le clic de Julien, qui imprime (le banc ne le touche plus : ses PDF sont
      // factices). Ce qui reste exigé : rien lu ni écrit à l'ouverture (plus haut), et la feuille FERMÉE sans
      // « Imprimer » ⇒ aucun PDF lu, aucun bordereau marqué imprimé.
      dit((await pg.locator('[data-lot-imprimer]').count()) > 0 && (await pg.evaluate(() => (document.querySelector('.vrm-lot') || { getAttribute: () => null }).getAttribute('data-lot-etape'))) === 'choix', 'E1 la feuille attend SON clic (« Imprimer », étape « choix »)');
      await pg.locator('.vrm-lot [data-feuille-croix]').first().click().catch(async () => { await pg.keyboard.press('Escape'); });
      await H.attendre(async () => (await pg.locator('.vrm-lot').count()) === 0, 6000);
      await pg.waitForTimeout(1200);
      dit((await pg.locator('.vrm-lot').count()) === 0 && lecturesPdf() === av.pdf && egal(dataMain(base).vinted_bords_printed, MAIN0.vinted_bords_printed), 'E1 fermer la feuille sans « Imprimer » ⇒ aucun PDF lu, rien d’imprimé', `pdf ${lecturesPdf() - av.pdf} · imprimés ${JSON.stringify(dataMain(base).vinted_bords_printed)} · écritures +${base.ecritures.length - n0}`);
      // (Plus d'« Échap » ici : la feuille est déjà fermée, et Échap sur l'écran fait un retour en arrière dans
      // l'historique qui ANNULAIT la navigation suivante — net::ERR_ABORTED.)
      await pg.goto(srv.url + '/?tab=journee', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2000);
    });

    await essaie('K3', async () => {
      const av = instant();
      const L = await lancer('baisser le prix de 88', 'baisser-prix', 'K3');
      dit(L.some((x) => x.action === 'baisser-prix' && x.num === '88'), 'K3 « Baisser le prix de N°88 » proposée', L.filter((x) => x.action).map((x) => x.texte).join(' | '));
      const f = await H.attendre(async () => (await pg.locator('[data-prix-partout="88"]').count()) > 0, 10000);
      dit(f, 'K3 ⇒ la feuille du prix du N°88 (rien n’est envoyé avant « Appliquer »)');
      await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(CAPT, `K3-prix-${nom}.png`) });
      await sansEffet('K3', av);
      await pg.locator('[data-prix-fermer]').first().click().catch(() => {});
      await pg.waitForTimeout(400);
    });

    await essaie('K4', async () => {
      await ouvrirLoupe(); await taper('88');
      await H.attendre(async () => (await pg.locator('[data-recherche-groupe="action"]').count()) > 0, 8000);
      const L = await lignes();
      dit(L[0] && L[0].tout, 'K4 « 88 » seul : « Tout sur le N° » reste la 1re ligne (Entrée inchangée)', L.slice(0, 2).map((x) => x.tout ? 'tout' : (x.action || x.type)).join(','));
      dit(['baisser-prix', 'stock-num'].every((id) => L.some((x) => x.action === id && x.num === '88')) && !L.some((x) => x.action === 'ouvrir-num'), 'K4 les actions du N° suivent (prix, Stock), « Ouvrir » n’est pas redit', L.filter((x) => x.action).map((x) => x.action).join(','));
      await pg.screenshot({ path: path.join(CAPT, `K4-num-${nom}.png`) });
      if (tel) await pg.locator('.vrm-hdr-recherche-fermer').first().tap().catch(() => {}); else await pg.keyboard.press('Escape');
    });

    await essaie('K5', async () => {
      const av = instant();
      await lancer('export', 'export-comptable', 'K5');
      const v = await H.attendre(async () => pg.evaluate(() => { const c = document.querySelector('[data-export-comptable]'); if (!c) return false; const r = c.getBoundingClientRect(); return r.height > 0 && r.top < window.innerHeight && r.bottom > 0; }), 12000);
      const etat = await pg.evaluate(() => (document.querySelector('[data-export-comptable]') || { getAttribute: () => null }).getAttribute('data-export-comptable'));
      dit(v && etat === 'ferme', 'K5 ⇒ Compta, la carte « Exporter pour mon comptable » montrée, PAS préparée', `visible ${v} · ${etat}`);
      // (14 nov.) Le focus se pose quand la carte a une boîte à l'écran (l'app revérifie toutes les 60 ms) : le banc
      // l'attend (borné), il ne le lit plus à l'instant même où la carte devient visible (rouge une fois sur deux en série).
      if (!tel) dit(await H.attendre(() => pg.evaluate(() => !!(document.activeElement && document.activeElement.hasAttribute('data-export-preparer'))), 3000), 'K5 (clavier) « Préparer » a le focus');
      await pg.screenshot({ path: path.join(CAPT, `K5-export-${nom}.png`) });
      await sansEffet('K5', av);
    });

    await essaie('K6', async () => {
      const av = instant();
      await lancer('ma configuration', 'ma-configuration', 'K6');
      const c = await H.attendre(async () => (await pg.locator('[data-configuration]').count()) > 0, 10000);
      dit(c, 'K6 ⇒ « Ma configuration » plein écran');
      await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(CAPT, `K6-configuration-${nom}.png`) });
      await sansEffet('K6', av);
    });

    dit(!errs.length, 'aucune erreur de page', errs.slice(0, 3).join(' | '));
    await A.fermer();
  }
  await nav.close(); srv.fermer();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
