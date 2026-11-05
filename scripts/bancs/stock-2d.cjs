// Banc : LE STOCK EN 2D SEULEMENT, MIEUX, EXPLIQUÉ, ET « VOIR L'ÉTAT » (5 novembre)
//
// Julien (demandes du 5 nov., §7) : « garder seulement la méthode annonce → case
// sur des étagères que l'on modélise comme on veut, en vue 2D — et la rendre bien
// meilleure ; un motion design pour l'expliquer » ; « article rangé puis vendu :
// sa case en surbrillance jusqu'à ce qu'on l'enlève ; oubliée, elle se vide quand
// le colis est expédié » ; « Voir l'état : tout ce qui se calcule ».
// Données INVENTÉES (dépôt public). Aux deux tailles (390 tactile, 1512 souris),
// en clair et en sombre, il exige :
//   I    le Stock n'a plus qu'une vue : aucun sélecteur de vue, la pièce 3D, les
//        cases de la pièce et la grille de photos ne s'ouvrent plus ;
//   II   la case d'un article rangé PUIS VENDU est allumée à l'accent (jamais rouge) ;
//   III  un article vendu ET parti, sans case, ne revient pas dans « À ranger » ;
//        un article présent sans case y est ;
//   IV   une case libérée toute seule (colis parti) est DITE, et « Remettre » la
//        rend à SA case ;
//   V    l'explication animée : présente sans meuble, sur « Comment ça marche ? »
//        sinon ; elle BOUGE (animation CSS) — et RIEN ne bouge avec « réduire les
//        animations » (image fixe, trois phrases lisibles) ;
//   VI   souris : glisser un article de « À ranger » dans une case l'y pose ;
//        doigt : toucher l'article puis la case ;
//   VII  « Voir l'état » : prix d'achat (achat relié), réception → mise en ligne
//        (« au plus » : l'annonce d'origine d'une republication n'a pas de date),
//        republications — jamais un chiffre inventé (« — » et la raison) ;
//   VIII l'ancienne place dans la pièce 3D (lue, jamais écrite) est dite sur la fiche ;
//   IX   aucune erreur de page, aucun défilement horizontal de la page.
// Lancer : BANC_PORT=79xx node scripts/bancs/stock-2d.cjs   (SHOT=prefixe pour les captures)
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7947;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
// La vue mémorisée sur l'appareil : la pièce 3D par défaut (I l'exige ignorée).
// BANC_VUE=meubles sert à la preuve « rouge avant » : sur le code d'avant, on
// ouvre « Mes meubles » pour que chaque exigence (II…VIII) rougisse pour ELLE.
const VUE = process.env.BANC_VUE || 'plan';

const AUJ = Date.now();
const MAIN = {
  vinted_annonce_numeros: {
    // N°1 : achat RELIÉ (n° de transaction), republiée (l'annonce d'origine 990001 n'a plus de date).
    '1001': { numero: '1', title: 'Nike Air Max 90 noire 42', buyPrice: 40, buyFromId: '55501234', buyFrom: { title: 'Air Max 90', date: '2026-10-01T09:00:00Z', price: 40 }, recreeDe: '990001', recreeAt: '2026-10-05T12:00:00Z' },
    '1002': { numero: '2', title: 'Adidas Samba blanche 40' },
    '1003': { numero: '3', title: 'Salomon XT-6 grise 43' },
    '1004': { numero: '4', title: 'Puma Suede verte 39' },
    '1005': { numero: '5', title: 'New Balance 550 crème 41' },
    '1006': { numero: '6', title: 'Asics Gel-Lyte III 44' },
  },
  vrm_meubles: [{ id: 'mA', name: 'Étagère entrée', cols: 3, rows: 2, planches: [1] }],
  // N°1 en rangée 1 colonne 1 ; N°3 (VENDUE) en rangée 1 colonne 2.
  vrm_slots: { '1': { m: 'mA', i: 0 }, '3': { m: 'mA', i: 1 } },
  // Preuves de vente (publiées par Annonces) : N°3 (pas encore partie) et N°4 (partie).
  vrm_stock_vendus: { nums: ['3', '4'], at: AUJ },
  // Présents (annonce en ligne ou colis pas parti) : N°4 n'y est plus.
  vinted_nums_physiques: { nums: ['1', '2', '3', '5', '6'], at: AUJ },
  // N°6 : sa case (rangée 2, colonne 3) a été libérée toute seule (colis parti).
  vrm_stock_sortis: { '6': { cle: '6', num: '6', titre: 'Asics Gel-Lyte III 44', statut: 'Colis en cours d’acheminement', plateforme: 'Vinted', source: 'meubles', meubleId: 'mA', i: 5, itemName: 'Étagère entrée', nom: 'rangée 2, colonne 3', at: AUJ - 3600000 } },
};
// L'ANCIENNE pièce 3D : N°2 était dans une pile. Lue seulement.
const ROOM = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [{ id: 'p1', type: 'pile', name: 'Pile du fond', x: 1, y: 1, w: 0.4, h: 0.3, rows: 5, nums: ['2'] }] }] };
const LISTINGS = [{ id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), nItems: 1, payload: { items: [{ id: 1001, title: 'Nike Air Max 90 noire 42', created_at_ts: Math.floor(Date.parse('2026-10-05T12:00:00Z') / 1000), is_closed: false, is_hidden: false, is_draft: false, price: { amount: '70.0' } }] } } }];

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
srv.listen(PORT);

async function rendre(b, { tel, sombre = false, reduit = false, main = MAIN }) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}), reducedMotion: reduit ? 'reduce' : 'no-preference', colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = { room: 0 };
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { if (/vrm_room/.test(u)) ecrits.room++; return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: main }]);
    if (/id=eq\.vrm_room/.test(u)) return j([{ id: 'vrm_room', data: ROOM }]);
    if (/id=like\.harvest_\*_listings/.test(u)) return j(LISTINGS);
    // La transaction de l'ACHAT relié : livrée le 3 oct. à 10 h (statut 400).
    if (/id=like\.harvest_\*_txn_55501234/.test(u)) return j([{ id: 'harvest_222_txn_55501234', side: 'buyer', livSt: '400', livAt: '2026-10-03T10:00:00Z' }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(({ m, sombre, vue }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vinted_garage_view', JSON.stringify(vue)); } catch (_) {} }, { m: main, sombre, vue: VUE });
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-stock-recherche] input, [data-stock-explication], [data-stock-vues]', { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, ecrits };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false }); };
const caseIci = (pg, ici) => pg.evaluate((ici) => { const el = document.querySelector(`[data-case-ici="${ici}"]`); return el ? (el.getAttribute('data-case-num') || '') : null; }, ici);

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) for (const sombre of [false, true]) {
      const t = `${tel ? '390 tactile' : '1512 souris'} ${sombre ? 'sombre' : 'clair'}`;
      await essaie(t, async () => {
        const r = await rendre(b, { tel, sombre });
        const pg = r.pg;
        const theme = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
        dit(theme === (sombre ? 'dark' : 'light'), `${t} : le thème demandé est rendu`, theme);
        // I — une seule vue.
        const vues = await pg.evaluate(() => ({ nav: !!document.querySelector('[data-stock-vues]'), boutons: document.querySelectorAll('[data-stock-vue]').length, meuble: !!document.querySelector('[data-meuble="mA"]'), canvas: document.querySelectorAll('canvas').length }));
        dit(!vues.nav && vues.boutons === 0 && vues.meuble && vues.canvas === 0, `${t} : I — une seule vue (les étagères 2D), même si la pièce 3D était mémorisée`, JSON.stringify(vues));
        // II — vendue : allumée à l'accent, pas rouge.
        const v = await pg.evaluate(() => { const el = document.querySelector('[data-case-num="3"]'); if (!el) return null; const cs = getComputedStyle(el); const acc = getComputedStyle(document.documentElement).getPropertyValue('--vrm-accent').trim(); return { etat: el.getAttribute('data-case-etat'), cls: el.className, ombre: cs.boxShadow, anim: cs.animationName, acc }; });
        const rouge = v && /rgb\(2[0-9]{2}, (?:[0-9]|[1-9][0-9]), (?:[0-9]|[1-9][0-9])\)/.test(v.ombre);
        dit(!!v && v.etat === 'vendue' && /is-vendue/.test(v.cls) && v.ombre !== 'none' && !rouge, `${t} : II — la case de N°3 (rangée puis vendue) est allumée, sans rouge`, v && `${v.etat} · ${v.ombre.slice(0, 80)}`);
        dit(!!v && v.anim === 'vrm-s2d-vendue', `${t} : II — elle respire doucement (animation CSS)`, v && v.anim);
        const n1 = await pg.evaluate(() => { const el = document.querySelector('[data-case-num="1"]'); return el ? el.getAttribute('data-case-etat') : null; });
        dit(n1 === 'occupee', `${t} : II — une case pleine pas vendue reste neutre`, n1);
        // III — À ranger.
        const ar = await pg.evaluate(() => [...document.querySelectorAll('button[aria-label^="Ranger l’article N°"]')].map((x) => (/N°(\w+)/.exec(x.getAttribute('aria-label')) || [])[1]).sort().join(','));
        dit(!/(^|,)4(,|$)/.test(ar) && /(^|,)5(,|$)/.test(ar) && /(^|,)2(,|$)/.test(ar), `${t} : III — N°4 (vendue et partie, sans case) n'est plus « à ranger » ; N°2 et N°5 y sont`, ar);
        // IV — libérée toute seule, puis « Remettre ».
        const so = await pg.evaluate(() => { const el = document.querySelector('[data-stock-sortis-meubles]'); return el ? el.innerText.replace(/\s+/g, ' ').slice(0, 400) : null; });
        dit(!!so && /N°6/.test(so) && /rangée 2, colonne 3/.test(so), `${t} : IV — la case libérée toute seule est dite (N°6, sa place, le colis parti)`, so);
        if (so) {
          await pg.click('[data-stock-remettre-meuble="6"]');
          await pg.waitForTimeout(400);
          dit(await caseIci(pg, 'mA:5') === '6' && !(await pg.$('[data-stock-sortis-meubles]')), `${t} : IV — « Remettre » la rend à SA case et la ligne disparaît`, await caseIci(pg, 'mA:5'));
          await pg.waitForTimeout(700);
          const garde = await pg.evaluate(() => { try { return !!(JSON.parse(localStorage.getItem('vrm_stock_garder')) || {})['6']; } catch (_) { return false; } });
          dit(garde, `${t} : IV — une paire remise n'est plus jamais sortie toute seule (vrm_stock_garder)`, String(garde));
        }
        await shot(pg, (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair'));
        // V — l'explication, sur demande.
        const btn = await pg.$('[data-stock-explication-ouvrir]');
        dit(!!btn, `${t} : V — « Comment ça marche ? » est proposé quand un meuble existe`);
        if (btn) {
          await btn.click(); await pg.waitForTimeout(600);
          const ex = await pg.evaluate(() => { const el = document.querySelector('[data-stock-explication]'); if (!el) return null; const c = el.querySelector('.vrm-sx-carte'); const etapes = el.querySelectorAll('.vrm-sx-etape').length; const t1 = c ? getComputedStyle(c).transform : ''; return { anime: el.getAttribute('data-anime'), nom: c ? getComputedStyle(c).animationName : '', etapes, t1 }; });
          await pg.waitForTimeout(2200);
          const t2 = await pg.evaluate(() => { const c = document.querySelector('[data-stock-explication] .vrm-sx-carte'); return c ? getComputedStyle(c).transform : ''; });
          dit(!!ex && ex.anime === '1' && ex.nom === 'vrm-sx-carte' && ex.etapes === 3 && ex.t1 !== t2, `${t} : V — l'explication est animée (l'annonce bouge vers sa case), en trois temps`, ex && `${ex.anime} ${ex.nom} ${ex.etapes} « ${ex.t1} » → « ${t2} »`);
          await pg.evaluate(() => document.querySelector('[data-stock-explication]').scrollIntoView({ block: 'center' }));
          await shot(pg, (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair') + '-explication');
          await pg.click('[data-stock-explication-fermer]');
          dit(!(await pg.$('[data-stock-explication]')), `${t} : V — elle se ferme`);
        }
        // VI — poser N°5 en rangée 1, colonne 3 (case mA:2) : glisser (souris) ou toucher-toucher (doigt).
        await pg.evaluate(() => window.scrollTo(0, 0));
        if (!tel) {
          const drag = await pg.getAttribute('[data-a-ranger="5"]', 'draggable');
          await pg.dragAndDrop('[data-a-ranger="5"]', '[data-case-ici="mA:2"]');
          await pg.waitForTimeout(500);
          dit(drag === 'true' && await caseIci(pg, 'mA:2') === '5', `${t} : VI — glisser N°5 dans une case à la souris l'y pose`, `${drag} ${await caseIci(pg, 'mA:2')}`);
        } else {
          await pg.tap('[data-a-ranger="5"]');
          await pg.tap('[data-case-ici="mA:2"]');
          await pg.waitForTimeout(500);
          dit(await caseIci(pg, 'mA:2') === '5', `${t} : VI — toucher N°5 puis une case l'y pose`, await caseIci(pg, 'mA:2'));
        }
        // VIII — l'ancienne place (pièce 3D, lue seulement) sur la fiche de N°2.
        await pg.fill('[data-stock-recherche] input', '2');
        await pg.waitForTimeout(300);
        await pg.click('[data-stock-res="2"]');
        await pg.waitForTimeout(400);
        const anc = await pg.evaluate(() => { const el = document.querySelector('[data-fiche-ancienne-place]'); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
        dit(!!anc && /Garage/.test(anc) && /Pile du fond/.test(anc), `${t} : VIII — la fiche dit l'ancienne place dans la pièce 3D`, anc);
        dit(r.ecrits.room === 0, `${t} : VIII — la pièce 3D n'est jamais réécrite`, String(r.ecrits.room));
        if (await pg.$('[data-stock-modale]')) await pg.click('[data-stock-modale] button[aria-label="Fermer"]');
        // VII — « Voir l'état » de N°1.
        await pg.click('[data-case-num="1"]');
        await pg.waitForTimeout(300);
        const ve = await pg.$('[data-fiche-voir-etat]');
        dit(!!ve, `${t} : VII — la fiche d'une case propose « Voir l'état »`);
        if (ve) {
          await ve.click();
          await pg.waitForSelector('[data-fiche-etat-article]', { timeout: 15000 }).catch(() => {});
          await pg.waitForFunction(() => { const el = document.querySelector('[data-etat-ligne="reception-en-ligne"] b'); return el && el.textContent !== '…'; }, null, { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(500);
          const et = await pg.evaluate(() => { const o = {}; document.querySelectorAll('[data-etat-ligne]').forEach((el) => { o[el.getAttribute('data-etat-ligne')] = { val: el.getAttribute('data-etat-val'), borne: el.getAttribute('data-etat-borne') || '', src: el.getAttribute('data-etat-source') || '', txt: el.innerText.replace(/\s+/g, ' ') }; }); return o; });
          const pa = et['prix-achat'] || {}, rl = et['reception-en-ligne'] || {}, rp = et['republications'] || {}, av = et['achat-vente'] || {}, lv = et['en-ligne-vente'] || {};
          dit(pa.val === '4000' && pa.src === 'relie' && /40 €/.test(pa.txt), `${t} : VII — prix d'achat 40 €, achat relié`, JSON.stringify(pa));
          dit(rl.val === '2' && rl.borne === 'au-plus' && /au plus 2 j/.test(rl.txt), `${t} : VII — réception (3 oct.) → mise en ligne (5 oct.) : « au plus 2 j » (l'annonce d'origine n'a pas de date)`, JSON.stringify(rl));
          dit(rp.val === '1', `${t} : VII — 1 republication vue par VRM`, JSON.stringify(rp));
          // Achat → vente, mise en ligne → vente : un nombre seulement si la lecture le permet, sinon « — » et la raison.
          const honnete = (l) => (l.val !== '' && l.val != null) || (/—/.test(l.txt) && l.txt.replace(/.*—/, '').trim().length > 3);
          dit(honnete(av) && honnete(lv), `${t} : VII — achat → vente et mise en ligne → vente : un nombre, ou « — » avec sa raison`, `${av.txt} | ${lv.txt}`);
          if (lv.val !== '' && lv.val != null) dit(/au-moins/.test(lv.borne) && /au moins/.test(lv.txt), `${t} : VII — mise en ligne → vente est « au moins » (origine sans date)`, lv.borne);
          const deux = await pg.evaluate(() => { const t = [...document.querySelectorAll('[data-fiche-paire] .vrm-fp-tuiles, [data-fiche-etat-article]')].map((x) => x.innerText).join(' '); return (t.match(/40 €/g) || []).length; });
          dit(deux === 1, `${t} : VII — le prix d'achat n'est écrit qu'une fois entre les tuiles et « L'état » (§7)`, String(deux));
          await shot(pg, (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair') + '-etat');
        }
        // IX
        const large = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(large <= 1, `${t} : IX — pas de défilement horizontal de la page`, String(large));
        dit(r.errs.length === 0, `${t} : IX — aucune erreur de page`, r.errs.join(' | ').slice(0, 300));
        await r.ctx.close();
      });
    }
    // V bis — réduire les animations : rien ne bouge, image fixe, phrases lisibles.
    for (const tel of [false, true]) {
      const t = `${tel ? '390 tactile' : '1512 souris'} réduire les animations`;
      await essaie(t, async () => {
        const r = await rendre(b, { tel, reduit: true, main: { ...MAIN, vrm_meubles: [], vrm_slots: {} } });
        const pg = r.pg;
        const ex = await pg.evaluate(() => { const el = document.querySelector('[data-stock-explication]'); if (!el) return null; const anims = [...el.querySelectorAll('*')].map((x) => getComputedStyle(x).animationName).filter((n) => n && n !== 'none'); const op = [...el.querySelectorAll('.vrm-sx-etape')].map((x) => getComputedStyle(x).opacity); const tr = el.querySelector('.vrm-sx-carte').getAttribute('transform'); return { anime: el.getAttribute('data-anime'), anims: anims.length, op, tr }; });
        dit(!!ex, `${t} : V — sans meuble, l'explication est là d'emblée`);
        if (ex) {
          dit(ex.anime === '0' && ex.anims === 0, `${t} : V — rien n'est animé`, JSON.stringify(ex));
          dit(ex.op.every((o) => o === '1') && !!ex.tr, `${t} : V — image fixe (l'article posé dans sa case) et les trois phrases lisibles`, JSON.stringify(ex.op));
        }
        await shot(pg, (tel ? '390' : '1512') + '-reduit');
        dit(r.errs.length === 0, `${t} : aucune erreur de page`, r.errs.join(' | ').slice(0, 300));
        await r.ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert');
    process.exit(ko ? 1 : 0);
  }
})();
