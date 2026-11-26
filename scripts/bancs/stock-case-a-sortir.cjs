// Banc : « LA CASE EN SURBRILLANCE, RIEN D'AUTRE » (16 nov. 2026, lot retirer-case-compact)
//
// Julien (16 nov.) : « enlever la paire de sa case ça prend trop de place », puis « dans l'onglet Stock, la
// case doit être en surbrillance si l'article n'est pas rangé/retiré — PAS DE POP-UP ». Récit :
// docs/passation/2026-11-16-retirer-case-compact.md. Données INVENTÉES (dépôt public). Aux deux tailles
// (390 tactile, 1512 souris), en clair et en sombre, il exige :
//   S1  la surbrillance EXACTEMENT sur les cases des paires vendues encore rangées (N°3, N°7) — ni sur une
//       case d'annonce en ligne (N°1), ni sur une case libre ; à l'accent, jamais rouge ; AUCUN mot en plus
//       dans la case (le badge « Vendue » n'y est plus) ;
//   S2  aucun bloc « à sortir / retirer de la case » posé à l'écran : ni « Vendues à sortir » (ses lignes,
//       « Je l'ai sortie »), ni « Retirer de la case » / « Je l'ai sorti » dans la fiche d'une paire ;
//       Ma journée ne pose plus « La paire à sortir en premier » ;
//   S3  le toucher de la case allumée la SORT : aucune fenêtre, aucune fiche, aucune feuille ne s'ouvre ;
//       la case se libère (`vrm_slots`), la sortie est notée (`vinted_pairs_lost`, N°3), la pilule du geste
//       paraît (`data-acc-apres="stock.sortir"`) et ne reste allumée que la case de N°7 ;
//   S4  « Annuler » rend la case et la surbrillance (le N° ne change jamais, §5) ;
//   S5  la place prise, MESURÉE : hauteur des blocs « à sortir » (Stock + Ma journée) — rapportée, et
//       exigée nulle ; aucune erreur de page, aucun défilement horizontal.
// `BANC_DIST=<dist>` : l'arbre de départ (il doit être ROUGE) ; `SHOT=prefixe` pour les captures.
// Lancer : BANC_PORT=79xx node scripts/bancs/stock-case-a-sortir.cjs
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7000 + Math.floor(Math.random() * 900);
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const AUJ = Date.now();
const MAIN = {
  vinted_annonce_numeros: {
    '1001': { numero: '1', title: 'Nike Air Max 90 noire 42' },
    '1003': { numero: '3', title: 'Salomon XT-6 grise 43' },
    '1007': { numero: '7', title: 'Salomon XT-6 grise 43' },   // le même titre que N°3 : chacune SA case
    '1005': { numero: '5', title: 'New Balance 550 crème 41' },
  },
  vrm_meubles: [{ id: 'mA', name: 'Étagère entrée', cols: 3, rows: 2 }],
  // N°1 (en ligne) r1c1 ; N°3 (VENDUE) r1c2 ; N°7 (VENDUE) r2c1 ; le reste libre.
  vrm_slots: { '1': { m: 'mA', i: 0 }, '3': { m: 'mA', i: 1 }, '7': { m: 'mA', i: 3 } },
  vrm_stock_vendus: { nums: ['3', '7'], at: AUJ },
  vinted_nums_physiques: { nums: ['1', '3', '5', '7'], at: AUJ },
};
const enLigne = (id, title) => ({ id, title, is_closed: false, is_hidden: false, is_draft: false, price: { amount: '60.0' } });
const LISTINGS = [{ id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), nItems: 2, payload: { items: [enLigne(1001, 'Nike Air Max 90 noire 42'), enLigne(1005, 'New Balance 550 crème 41')] } } }];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });

async function rendre(b, { tel, sombre = false, tab = 'garage' }) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: MAIN }]);
    if (/id=like\.harvest_\*_listings/.test(u) || /id=eq\.harvest_111_listings/.test(u)) return j(LISTINGS);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(({ m, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vinted_garage_view', JSON.stringify('meubles')); } catch (_) {} }, { m: MAIN, sombre });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (tab === 'garage') await pg.waitForSelector('[data-case-ici="mA:0"]', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(1800);
  return { ctx, pg, errs };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false }).catch(() => {}); };
// La capture du MEUBLE (les cases allumées), pas du haut de l'écran.
const shotMeuble = async (pg, nom) => { if (!process.env.SHOT) return; await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300); await shot(pg, nom); };

// Ce que la page montre : les cases allumées, ce qu'elles portent, les blocs « à sortir », les fenêtres ouvertes.
const etat = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cases = [...document.querySelectorAll('[data-case-ici]')];
  const allumees = cases.filter((el) => el.classList.contains('is-vendue')).map((el) => el.getAttribute('data-case-num') || ('libre:' + el.getAttribute('data-case-ici'))).sort();
  const detail = cases.filter((el) => el.classList.contains('is-vendue')).map((el) => { const cs = getComputedStyle(el); return { num: el.getAttribute('data-case-num'), ombre: cs.boxShadow, mot: !!el.querySelector('.vrm-s2d-vendue'), texte: (el.innerText || '').replace(/N°\s*\w+/g, '').replace(/\s+/g, '').replace(new RegExp('^' + String(el.getAttribute('data-case-num') || '\u0000').replace(/[^\w]/g, '') + '$'), '').trim() }; });   // (16 nov., stock-mieux) la plaque écrit le N° SEUL (« 3 ») : retiré lui aussi
  // La hauteur du bloc lui-même (sa carte : le parent direct du marqueur), jamais la section qui le contient.
  const bloc = (sel) => [...document.querySelectorAll(sel)].filter(vis).reduce((h, el) => { const c = sel === '[data-sortir]' ? el : (el.parentElement || el); return h + Math.round(c.getBoundingClientRect().height); }, 0);
  const dialogues = [...document.querySelectorAll('[role="dialog"], .vrm-confirmation, [data-stock-modale], [data-stock-fiche], [data-sortir-pop]')].filter(vis).length;
  let ls = {}; try { ls = { slots: JSON.parse(localStorage.getItem('vrm_slots') || 'null'), perdues: JSON.parse(localStorage.getItem('vinted_pairs_lost') || 'null') }; } catch (_) {}
  return {
    allumees, detail, dialogues, ls,
    blocVendues: !!document.querySelector('[data-stock-vendues-sortir], [data-stock-sortir]'), hBlocVendues: bloc('[data-stock-vendues-sortir]'),
    blocJournee: !!document.querySelector('[data-sortir]'), hBlocJournee: bloc('[data-sortir]'),
    pilule: !!document.querySelector('[data-acc-apres="stock.sortir"]'),
    sw: document.documentElement.scrollWidth, iw: innerWidth,
  };
});

(async () => {
  let b;
  await new Promise((ok) => srv.listen(PORT, ok));
  const lancer = () => chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  // Un navigateur par scénario : sous charge, un navigateur partagé qui tombe emporterait toute la suite.
  const essaie = async (nom, f) => { try { b = await lancer(); await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 300)); } finally { if (b) await b.close().catch(() => {}); b = null; } };
  try {
    for (const tel of [true, false]) for (const sombre of [false, true]) {
      const t = `${tel ? '390 tactile' : '1512 souris'} ${sombre ? 'sombre' : 'clair'}`;
      const nomShot = (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair');
      await essaie(t, async () => {
        const r = await rendre(b, { tel, sombre });
        const pg = r.pg;
        const e0 = await etat(pg);
        await shot(pg, nomShot);
        await shotMeuble(pg, nomShot + '-meuble');
        // S1 — exactement les deux cases vendues, à l'accent, sans mot.
        const rouge = e0.detail.some((d) => /rgb\(2[0-9]{2}, (?:[0-9]|[1-9][0-9]), (?:[0-9]|[1-9][0-9])\)/.test(d.ombre));
        dit(e0.allumees.join(',') === '3,7', `${t} : S1 — la surbrillance est sur N°3 et N°7, et sur elles seules`, e0.allumees.join(','));
        dit(e0.detail.length === 2 && e0.detail.every((d) => d.ombre && d.ombre !== 'none') && !rouge, `${t} : S1 — surbrillance à l'accent, jamais rouge`, JSON.stringify(e0.detail.map((d) => d.ombre.slice(0, 60))));
        dit(e0.detail.length === 2 && e0.detail.every((d) => !d.mot && d.texte === ''), `${t} : S1 — aucun mot en plus dans la case allumée`, JSON.stringify(e0.detail.map((d) => [d.num, d.mot, d.texte])));
        // S2 — aucun bloc posé ; S5 la place prise.
        console.log(`MESURE ${t} : hauteur des blocs « à sortir » du Stock = ${e0.hBlocVendues} px`);
        dit(!e0.blocVendues && e0.hBlocVendues === 0, `${t} : S2 — aucun bloc « Vendues à sortir » (ni ligne, ni « Je l'ai sortie »)`, `${e0.hBlocVendues} px`);
        // La fiche d'une paire (N°1, en ligne, rangée) : ni « Retirer de la case », ni « Je l'ai sorti ».
        await pg.click('[data-case-num="1"]');
        await pg.waitForSelector('[data-fiche-paire="1"], [data-stock-fiche="1"]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const fiche = await pg.evaluate(() => ({ la: !!document.querySelector('[data-fiche-paire="1"], [data-stock-fiche="1"]'), retirer: !!document.querySelector('[data-fiche-retirer]'), sortir: [...document.querySelectorAll('button')].some((x) => /Je l.ai sorti/i.test(x.textContent || '')) }));
        await shot(pg, nomShot + '-fiche');
        dit(fiche.la && !fiche.retirer && !fiche.sortir, `${t} : S2 — la fiche de N°1 s'ouvre, sans « Retirer de la case » ni « Je l'ai sorti »`, JSON.stringify(fiche));
        await pg.evaluate(() => { const x = document.querySelector('[data-fiche-paire] [data-fiche-fermer]'); if (x) x.click(); });
        await pg.keyboard.press('Escape').catch(() => {});
        await pg.waitForTimeout(700);
        // S3 — toucher la case allumée de N°3.
        if (tel) await pg.tap('[data-case-num="3"]'); else await pg.click('[data-case-num="3"]');
        await pg.waitForFunction(() => { try { const s = JSON.parse(localStorage.getItem('vrm_slots') || 'null'); return !!s && !s['3']; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const e1 = await etat(pg);
        dit(e1.dialogues === 0, `${t} : S3 — aucune fenêtre, fiche ni feuille ne s'ouvre`, String(e1.dialogues));
        const sl = (e1.ls && e1.ls.slots) || {};
        dit(!sl['3'] && sl['7'] && sl['7'].i === 3 && sl['1'] && sl['1'].i === 0, `${t} : S3 — la case de N°3 est libérée, les autres intactes`, JSON.stringify(sl));
        dit(!!(e1.ls && e1.ls.perdues && Object.keys(e1.ls.perdues).some((k) => /^3(@|$)/.test(k))), `${t} : S3 — la sortie de N°3 est notée (vinted_pairs_lost)`, JSON.stringify(e1.ls && e1.ls.perdues));
        dit(e1.pilule, `${t} : S3 — la pilule du geste paraît (annulable)`);
        dit(e1.allumees.join(',') === '7', `${t} : S3 — seule la case de N°7 reste allumée`, e1.allumees.join(','));
        // S4 — Annuler (la pilule vit 5 s : le banc la touche dès qu'il l'a lue).
        const an = await pg.evaluate(() => { const x = document.querySelector('[data-pilule-annuler]'); if (x) x.click(); return !!x; });
        if (!an) console.log('    (pas de bouton « Annuler » visible : ' + (await pg.evaluate(() => (document.querySelector('[data-pilule]') || {}).outerHTML || 'aucune pilule')).slice(0, 300) + ')');
        await pg.waitForFunction(() => { try { const s = JSON.parse(localStorage.getItem('vrm_slots') || 'null'); return !!s && !!s['3']; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const e2 = await etat(pg);
        await shotMeuble(pg, nomShot + '-annule');
        // La capture « après » : la sortie refaite, puis regardée (la pilule n'a plus besoin d'être touchée).
        if (!sombre && process.env.SHOT) {
          if (tel) await pg.tap('[data-case-num="3"]').catch(() => {}); else await pg.click('[data-case-num="3"]').catch(() => {});
          await pg.waitForFunction(() => { try { const s = JSON.parse(localStorage.getItem('vrm_slots') || 'null'); return !!s && !s['3']; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
          await shotMeuble(pg, nomShot + '-apres');
        }
        dit(((e2.ls && e2.ls.slots) || {})['3'] && e2.ls.slots['3'].i === 1 && e2.allumees.join(',') === '3,7', `${t} : S4 — « Annuler » rend SA case à N°3 et sa surbrillance`, JSON.stringify([e2.ls && e2.ls.slots, e2.allumees]));
        dit(e0.sw <= e0.iw + 1 && e1.sw <= e1.iw + 1, `${t} : S5 — aucun défilement horizontal`, `${e0.sw}/${e0.iw}`);
        dit(r.errs.length === 0, `${t} : S5 — aucune erreur de page`, r.errs.join(' | ').slice(0, 300));
        await r.ctx.close();
      });
    }
    // Ma journée : plus de « La paire à sortir en premier ».
    for (const tel of [true, false]) {
      const t = `${tel ? '390' : '1512'} Ma journée`;
      await essaie(t, async () => {
        const r = await rendre(b, { tel, tab: 'journee' });
        await r.pg.waitForTimeout(1500);
        const e = await etat(r.pg);
        await shot(r.pg, (tel ? '390' : '1512') + '-journee');
        console.log(`MESURE ${t} : hauteur du bloc « La paire à sortir » = ${e.hBlocJournee} px`);
        dit(!e.blocJournee && e.dialogues === 0, `${t} : S2 — ni bloc « La paire à sortir », ni fenêtre`, `${e.hBlocJournee} px · ${e.dialogues} fenêtre(s)`);
        dit(r.errs.length === 0, `${t} : aucune erreur de page`, r.errs.join(' | ').slice(0, 300));
        await r.ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTOUT VERT');
  process.exit(ko ? 1 : 0);
})();
