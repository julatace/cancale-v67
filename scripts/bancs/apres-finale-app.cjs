// ════════════════════════════════════════════════════════════════════════════
//  BANC « APRÈS LA FINALE » (22 nov., choix 1, 23 et 27 de Julien) — l'app entière, base INVENTÉE (harnais
//  _ux-harnais.cjs : rien ne sort), 390 tactile et 1512, clair et sombre. Récit : docs/passation/2026-11-22-apres-finale-app.md.
//    node scripts/bancs/apres-finale-app.cjs <dist> [port]      CAPTURES=<dossier> · FORMATS=390,1512 · THEMES=clair,sombre
//  1. Statistiques d'un compte neuf : le `Vide` natif (une phrase, « Relier un compte »), aucune carte de statistiques, pas
//     l'ancien « Bienvenue » ; base injoignable ⇒ « pas su » + Réessayer ; un compte relié ⇒ les statistiques.
//  2. Reprendre : une fiche ouverte sur un AUTRE appareil il y a 4 min ⇒ « Reprendre : Nike Air Max 1 taille 42 · Ouvert sur
//     l'iPhone à HH:MM » en haut d'Aujourd'hui ; le toucher ouvre LA fiche (N° 124) ; « Masquer » ⇒ partie ; le même appareil
//     ⇒ rien ; 40 min ⇒ rien ; ouvrir une fiche ICI écrit `vrm_reprise` avec { e, t, id, at, f } seulement.
//  3. Plus vue : une annonce dont les relevés disent 40 vues depuis 6 j (30 avant) ⇒ « Plus vue depuis 6 j » dans Annonces ;
//     une annonce qui gagne des vues ⇒ rien ; une annonce dont le dernier relevé date de 4 jours ⇒ rien (« jamais sur un jour
//     non lu ») ; la vue « Republier » la liste avec la raison et « Republier » ouvre le panneau (republier-direct, CET id).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { serveur, ouvrir, attendre, MAIN, COMPTE, UID, iso } = require('./_ux-harnais.cjs');
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || 4795);
const CAPT = process.env.CAPTURES || '';
const FORMATS = String(process.env.FORMATS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
let ok = 0, ko = 0; const KO = [];
const dit = (bon, quoi) => { if (bon) ok++; else { ko++; KO.push(quoi); } console.log((bon ? '  ✅ ' : '  ❌ ') + quoi); };
// La feuille « compte relié » (premier passage d'un compte) : refermée comme il le ferait (Échap), pour voir l'écran dessous.
const sansFeuille = async (pg) => { for (let i = 0; i < 2; i++) { if (!(await pg.locator('.n-feuille:visible, [data-n-feuille]:visible').count().catch(() => 0))) return; await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500); } };
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); };

// ── Les données inventées ──
const JOUR = 86400000;
const jParis = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)).replace(/-/g, '');
const releve = (pts) => pts.map(([j, v]) => `${jParis(Date.now() - j * JOUR)},${v},2,0`).join(';');
const ITEMS = [
  { id: 7100000001, title: 'Nike Air Max 1 taille 42', v: 40 },        // plus vue depuis 7 j
  { id: 7100000002, title: 'Adidas Samba taille 41', v: 55 },          // gagne des vues
  { id: 7100000003, title: 'New Balance 550 taille 43', v: 12 },       // dernier relevé il y a 4 j
];
const listings = { id: 'harvest_9001_listings', data: { uid: 9001, type: 'listings', domain: 'www.vinted.fr', capturedAt: iso(0), nItems: ITEMS.length, payload: { code: 0, pagination: { total_entries: ITEMS.length },
  items: ITEMS.map((x, i) => ({ id: x.id, title: x.title, brand_title: x.title.split(' ')[0], size_title: x.title.slice(-2), status: 'Très bon état', price: { amount: String(60 + i * 5) + '.0', currency_code: 'EUR' },
    is_closed: false, is_hidden: false, is_draft: false, favourite_count: 2, view_count: x.v, created_at_ts: Math.floor((Date.now() - (i === 0 ? 40 : 20 + i) * JOUR) / 1000), user: { id: 9001 }, photo: { url: `https://images1.vinted.net/t/${x.id}/f800/v.jpeg` } })) } } };
const suivi = { id: 'vinted_suivi_9001', data: { v: 1, majAt: iso(0), boostes: {}, items: {
  i7100000001: releve([[9, 20], [7, 30], [6, 40], [4, 40], [2, 40], [0, 40]]),
  i7100000002: releve([[9, 20], [6, 30], [3, 44], [0, 55]]),
  i7100000003: releve([[12, 2], [10, 5], [8, 12], [4, 12]]),
} } };
const fiches = { f124: { numero: '124', title: 'Nike Air Max 1', size: '42', photo: '', accountId: '9001', numberedAt: iso(30) } };

(async () => {
  const srv = serveur(DIST).listen(PORT);
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  console.log(`Banc apres-finale-app · ${path.relative(process.cwd(), DIST) || DIST}`);
  try {
    for (const W of FORMATS) for (const th of THEMES) {
      const sombre = th === 'sombre', tag = `${W}-${th}`;
      console.log(`\n── ${W} px · ${th}`);
      // 1. STATISTIQUES D'UN COMPTE NEUF
      {
        const base = { comptes: [], lignes: [MAIN({})] };
        const { ctx, pg, journal } = await ouvrir(nav, { PORT, W, sombre, base, tab: 'dashboard' });
        const vu = await attendre(pg, () => pg.locator('[data-stats-nouveau="vide"] .n-vide').count().then((n) => n > 0), 20000);
        dit(vu, `${tag} Statistiques neuves : le Vide natif`);
        const t = vu ? await pg.locator('[data-stats-nouveau="vide"]').innerText() : '';
        dit(/Tes statistiques arriveront avec tes premières ventes\./.test(t) && (await pg.locator('[data-stats-relier]').count()) === 1, `${tag} une phrase et UN geste « Relier un compte »`);
        dit((await pg.locator('[data-stats-carte], .vrm-stats-hero, [data-stats-pilotage]').count()) === 0 && !/Bienvenue/.test(await pg.locator('.vrm-main').innerText().catch(() => '')), `${tag} ni cartes vides, ni l'ancien « Bienvenue »`);
        await capture(pg, `stats-vide-${tag}`);
        if (vu) { await pg.locator('[data-stats-relier]').click(); await pg.waitForTimeout(600); }
        dit(!journal.erreurs.length, `${tag} aucune erreur de page (${journal.erreurs.slice(0, 2).join(' | ')})`);
        await ctx.close();
      }
      if (W === FORMATS[0]) {
        const base = { comptes: [], lignes: [MAIN({})], panne: 'base' };
        const { ctx, pg } = await ouvrir(nav, { PORT, W, sombre, base, tab: 'dashboard' });
        const vu = await attendre(pg, () => pg.locator('[data-stats-nouveau="pasSu"] [data-stats-reessayer]').count().then((n) => n > 0), 20000);
        dit(vu && (await pg.locator('[data-stats-nouveau="vide"]').count()) === 0, `${tag} base injoignable ⇒ « pas su » + Réessayer (jamais « vide »)`);
        await capture(pg, `stats-passu-${tag}`);
        await ctx.close();
        const base2 = { comptes: COMPTE, lignes: [MAIN({}), listings] };
        const o2 = await ouvrir(nav, { PORT, W, sombre, base: base2, tab: 'dashboard' });
        await o2.pg.waitForTimeout(6000);
        dit((await o2.pg.locator('[data-stats-nouveau]').count()) === 0, `${tag} un compte relié ⇒ les statistiques (pas d'écran neuf)`);
        await o2.ctx.close();
      }
      // 2. REPRENDRE SUR L'AUTRE APPAREIL
      {
        const at = Date.now() - 4 * 60000;
        const ligne = { id: 'vrm_reprise', data: { v: 1, rev: 3, d: { zzzzzzzzzzzz: { e: 'annonces', t: 'fiche', id: '124', at, f: 'iphone' } } } };
        const base = { comptes: COMPTE, lignes: [MAIN({ vinted_annonce_numeros: fiches }), ligne, listings] };
        const { ctx, pg, journal } = await ouvrir(nav, { PORT, W, sombre, base, tab: 'journee', creeLe: iso(40), local: { reprise_appareil: 'aaaaaaaaaaaa', vinted_annonce_numeros: fiches } });
        const ecrits = []; pg.on('request', (r) => { if (/app_data/.test(r.url()) && /vrm_reprise/.test(decodeURIComponent(r.url()) + (r.postData() || '')) && ['PATCH', 'POST'].includes(r.method())) { try { ecrits.push(JSON.parse(r.postData() || 'null')); } catch (_) {} } });
        await pg.waitForTimeout(4000); await sansFeuille(pg);
        const vu = await attendre(pg, () => pg.locator('[data-reprise-id="124"]').count().then((n) => n > 0), 25000);
        dit(vu, `${tag} Reprendre : la rangée en haut d'Aujourd'hui`);
        const t = vu ? await pg.locator('[data-reprise]').innerText() : '';
        const hh = new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
        dit(/Reprendre : Nike Air Max 1 taille 42/.test(t) && t.includes('Ouvert sur l’iPhone à ' + hh), `${tag} « Reprendre : Nike Air Max 1 taille 42 · Ouvert sur l’iPhone à ${hh} » (${t.replace(/\s+/g, ' ').slice(0, 90)})`);
        if (vu) {
          const b = await pg.locator('[data-reprise-masquer]').boundingBox();
          dit(b && b.width >= 44 && b.height >= 44, `${tag} « Masquer » : cible de 44 px (${b ? Math.round(b.width) + '×' + Math.round(b.height) : '—'})`);
          const r = await pg.locator('[data-reprise-ouvrir]').boundingBox();
          dit(r && r.y < 400, `${tag} la rangée est en haut (y ${r ? Math.round(r.y) : '—'})`);
        }
        await capture(pg, `reprise-${tag}`);
        if (vu) {
          await pg.locator('[data-reprise-ouvrir]').first().click();
          const f = await attendre(pg, () => pg.locator('[data-fiche-paire]').count().then((n) => n > 0), 12000);
          dit(f, `${tag} le toucher ouvre LA fiche du N° 124`);
          await capture(pg, `reprise-fiche-${tag}`);
          await pg.waitForTimeout(2500);
          // Ce qui est PARTI vers la base (le corps de l'écriture comparer-et-échanger).
          const corps = ecrits.length ? ecrits[ecrits.length - 1] : null;
          const L = { data: corps && (Array.isArray(corps) ? corps[0].data : corps.data) };
          const moi = L && L.data && L.data.d && L.data.d.aaaaaaaaaaaa;
          dit(!!moi && JSON.stringify(Object.keys(moi).sort()) === '["at","e","f","id","t"]' && moi.id === '124' && !!L.data.d.zzzzzzzzzzzz && JSON.stringify(Object.keys(L.data).sort()) === '["d","rev","v"]',
            `${tag} ouvrir une fiche ICI écrit { e, t, id, at, f } seulement, l'autre appareil gardé (${JSON.stringify(moi || null).slice(0, 90)})`);
        }
        dit(!journal.erreurs.length, `${tag} aucune erreur de page (${journal.erreurs.slice(0, 2).join(' | ')})`);
        await ctx.close();
        if (W === FORMATS[0]) {
          const o3 = await ouvrir(nav, { PORT, W, sombre, base: { comptes: COMPTE, lignes: [MAIN({ vinted_annonce_numeros: fiches }), ligne, listings] }, tab: 'journee', creeLe: iso(40), local: { reprise_appareil: 'zzzzzzzzzzzz', vinted_annonce_numeros: fiches } });
          await o3.pg.waitForTimeout(9000);
          dit((await o3.pg.locator('[data-reprise]').count()) === 0, `${tag} le même appareil ⇒ rien`);
          await o3.ctx.close();
          const vieux = { id: 'vrm_reprise', data: { v: 1, rev: 1, d: { zzzzzzzzzzzz: { e: 'annonces', t: 'fiche', id: '124', at: Date.now() - 40 * 60000, f: 'iphone' } } } };
          const o4 = await ouvrir(nav, { PORT, W, sombre, base: { comptes: COMPTE, lignes: [MAIN({ vinted_annonce_numeros: fiches }), vieux, listings] }, tab: 'journee', creeLe: iso(40), local: { reprise_appareil: 'aaaaaaaaaaaa' } });
          await o4.pg.waitForTimeout(9000);
          dit((await o4.pg.locator('[data-reprise]').count()) === 0, `${tag} ouverte il y a 40 min ⇒ rien`);
          await o4.ctx.close();
          const o5 = await ouvrir(nav, { PORT, W, sombre, base: { comptes: COMPTE, lignes: [MAIN({ vinted_annonce_numeros: fiches }), ligne, listings] }, tab: 'journee', creeLe: iso(40), local: { reprise_appareil: 'aaaaaaaaaaaa' } });
          await o5.pg.waitForTimeout(4000); await sansFeuille(o5.pg);
          if (await attendre(o5.pg, () => o5.pg.locator('[data-reprise-masquer]').count().then((n) => n > 0), 20000)) {
            await o5.pg.locator('[data-reprise-masquer]').click(); await o5.pg.waitForTimeout(500);
            const parti = (await o5.pg.locator('[data-reprise]').count()) === 0;
            await o5.pg.reload({ waitUntil: 'domcontentloaded' }); await o5.pg.waitForTimeout(9000);
            dit(parti && (await o5.pg.locator('[data-reprise]').count()) === 0, `${tag} « Masquer » ⇒ partie, et ne revient pas`);
          } else dit(false, `${tag} « Masquer » : rangée absente`);
          await o5.ctx.close();
        }
      }
      // 3. PLUS VUE
      {
        const base = { comptes: COMPTE, lignes: [MAIN({}), listings, suivi] };
        const { ctx, pg, journal } = await ouvrir(nav, { PORT, W, sombre, base, tab: 'annonces', creeLe: iso(40), local: { vrm_qd_seuil: '30' } });
        await pg.waitForTimeout(4000); await sansFeuille(pg);
        const vu = await attendre(pg, () => pg.locator('[data-ad-conseil="plusvue"]').count().then((n) => n > 0), 25000);
        const etiq = await pg.locator('[data-ad-conseil="plusvue"]').evaluateAll((l) => l.map((e) => [(e.closest('[data-eg-article],[data-tt-ligne],tr') || e).getAttribute('data-eg-article') || (e.closest('tr') ? e.closest('tr').textContent.slice(0, 60) : ''), e.textContent.trim()]));
        dit(vu && etiq.length === 1 && /7100000001|Nike Air Max 1/.test(String(etiq[0][0])) && etiq[0][1] === 'Plus vue depuis 6 j', `${tag} « Plus vue depuis 6 j » sur l'annonce plate, et elle seule (${JSON.stringify(etiq).slice(0, 140)})`);
        await capture(pg, `plusvue-annonces-${tag}`);
        // La vue « Republier »
        const seg = pg.locator('[data-eg-segment="arepublier"]:visible');
        await sansFeuille(pg);
        if (await seg.count()) await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-eg-segment="arepublier"]')].find((e) => e.getClientRects().length); if (b) b.click(); });
        else { const sel = pg.locator('select:has(option[value="arepublier"])'); if (await sel.count()) await sel.first().selectOption('arepublier').catch(() => {});
          else { const b = pg.locator('[data-tt-filtre="dort"], [data-filtre="dort"]'); if (await b.count()) { await b.first().click().catch(() => {}); await pg.locator('text=Republier').first().click().catch(() => {}); } } }
        await pg.waitForTimeout(1500); await sansFeuille(pg);
        const pv = await attendre(pg, () => pg.locator('[data-prio-plusvue]').count().then((n) => n > 0), 15000);
        dit(pv, `${tag} la vue « Republier » dit la raison (« plus vue depuis 6 j »)`);
        if (pv) {
          const txt = await pg.locator('[data-prio-plusvue]').first().innerText();
          dit(/plus vue depuis 6 j/.test(txt), `${tag} raison écrite sur la ligne (${txt.replace(/\s+/g, ' ').slice(0, 80)})`);
          await capture(pg, `plusvue-republier-${tag}`);
          const avant = await pg.evaluate(() => (window.__ouverts || []).length).catch(() => 0);
          await pg.evaluate(() => { window.__ouverts = []; const o = window.open; window.open = (u) => { window.__ouverts.push(String(u)); return {}; }; });
          await pg.locator('[data-pv-republier="7100000001"]').first().click().catch(() => {});
          await pg.waitForTimeout(800);
          const ouv = await pg.evaluate(() => (window.__ouverts || []).concat([location.href])).catch(() => []);
          dit(avant === 0 && ouv.some((u) => /republier-direct/.test(u) && /7100000001/.test(u)), `${tag} « Republier » ouvre la feuille Avant | Après de CETTE paire (${ouv.join(' ').slice(0, 140)})`);
        }
        dit(!journal.erreurs.length, `${tag} aucune erreur de page (${journal.erreurs.slice(0, 2).join(' | ')})`);
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'banc interrompu : ' + String(e && e.stack || e).slice(0, 300)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc apres-finale-app : ${ok} OK · ${ko} KO`);
  if (KO.length) console.log(KO.map((x) => '   · ' + x).join('\n'));
  process.exit(ko ? 1 : 0);
})();
