// Banc : lot AF (9 nov.) — la même annonce sur deux comptes Vinted (écran Annonces) et
// l'histoire d'un N° (fiche de la paire). Données INVENTÉES (le dépôt est public), à la
// forme des lignes réelles (`harvest_{uid}_listings` : `capturedAt`, `payload.items` ;
// `main.vinted_annonce_numeros`, `main.vrm_numeros_journal`). Deux comptes. Téléphone
// 390 tactile SOMBRE et ordinateur 1512 clair. Il juge ce qui est RENDU :
//   A. même PHOTO EXACTE sur deux comptes (N°12 et N°40) ⇒ l'alerte AMBRE de l'écran
//      Annonces : ses deux annonces, chacune avec SON compte, SON prix (60 € / 55,50 €)
//      et depuis quand ; « Ouvrir sur Vinted » ≥ 44 px vers vinted.fr ; aucun bouton qui
//      supprime ; ni rouge, ni débordement, ni erreur ;
//   B. 50 annonces au MÊME titre, marque et taille sur deux comptes (photos différentes)
//      ⇒ aucune alerte ;
//   C. la même photo, mais le second compte lu il y a 30 h (« à confirmer ») ⇒ aucune alerte ;
//   H. la fiche du N°12 : « L'histoire du N° » — saisi à la main (journal, l'ancien N°7),
//      lecture seule (aucun bouton ni champ) ; la fiche du N°40 : « origine non enregistrée
//      (avant le 9 nov. 2026) » ; la fiche du N°7 : quitté par une annonce (→ N°12).
// `BANC_DIST=<dist>` : rendre un autre build (l'arbre d'avant, une mutation).
// Lancer :
//   npm run build && NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=9652 node scripts/bancs/doublons-historique.cjs
// Captures : CAPTURES=<dossier>.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || Number(process.env.PORT) || 9652;
const CAPT = process.env.CAPTURES || '';

const maintenant = new Date(2026, 10, 9, 15, 30, 0);
const MS = maintenant.getTime();
const iso = (h) => new Date(MS - h * 3600e3).toISOString();
const A = '111', B = '222';
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'compte-alpha', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: B, login: 'compte-beta', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const photo = (dossier, fichier, taille = 'f800') => `https://images1.vinted.net/t/${dossier}/${taille}/${fichier}.jpeg?s=abc`;
const annonce = (id, title, ph, prix = '60.0', jours = 10) => ({ id, title, brand_title: 'Nike', size_title: '42', photo: ph, url: `https://www.vinted.fr/items/${id}-annonce`,
  price: { amount: prix, currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: Math.round((MS - jours * 86400e3) / 1000), favourite_count: 1, view_count: 10 });

const JOURNAL = [{ at: '2026-11-09T09:00:00.000Z', id: '5000001', num: '12', de: '7', quoi: 'main' }];
const SCENARIOS = {
  A: (() => {
    const pA = [annonce(5000001, 'Nike Air Max 90 blanc 42', photo('05_aaa_dossiera', '1700000001'), '60.0', 10), annonce(5000002, 'Adidas Samba noir 41', photo('05_bbb_dossierb', '1700000002'))];
    const pB = [annonce(6000001, 'Air Max 90 blanche', photo('05_aaa_dossiera', '1700000001', 'f310'), '55.5', 3), annonce(6000002, 'Asics Gel bleu 43', photo('05_ddd_dossierd', '1700000004'))];
    return { listings: { [A]: { cap: iso(1), items: pA }, [B]: { cap: iso(2), items: pB } },
      fiches: {
        5000001: { numero: '12', photoK: '05_aaa_dossiera/1700000001', accountId: A, auto: false, manuelAt: '2026-11-09T09:00:00.000Z', numberedAt: '2026-10-30T10:00:00.000Z', reattribue: { de: '7', vers: '12', at: '2026-11-09T09:00:00.000Z', main: true } },
        5000002: { numero: '13', photoK: '05_bbb_dossierb/1700000002', accountId: A, auto: true, numberedAt: '2026-10-30T10:00:00.000Z' },
        6000001: { numero: '40', photoK: '05_aaa_dossiera/1700000001', accountId: B },
        6000002: { numero: '41', photoK: '05_ddd_dossierd/1700000004', accountId: B, auto: true, numberedAt: '2026-10-31T10:00:00.000Z' } },
      journal: JOURNAL };
  })(),
  B: (() => {
    const lA = [], lB = [], fiches = {};
    for (let i = 0; i < 50; i++) {
      const id = 7000000 + i, ph = photo(`05_${i}_dossier${i}`, `17100000${i}`);
      (i % 2 ? lA : lB).push(annonce(id, 'Nike Dunk Low Panda 42', ph));
      fiches[id] = { numero: String(100 + i), photoK: `05_${i}_dossier${i}/17100000${i}`, accountId: i % 2 ? A : B, auto: true, numberedAt: '2026-10-30T10:00:00.000Z' };
    }
    return { listings: { [A]: { cap: iso(1), items: lA }, [B]: { cap: iso(1), items: lB } }, fiches, journal: [] };
  })(),
};
SCENARIOS.C = { listings: { [A]: SCENARIOS.A.listings[A], [B]: { ...SCENARIOS.A.listings[B], cap: iso(30) } }, fiches: SCENARIOS.A.fiches, journal: JOURNAL };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 300)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = row.data && row.data.capturedAt || maintenant.toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};

const ouvrir = async (b, vp, sc, tab) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: tel ? 2 : 1, colorScheme: tel ? 'dark' : 'light', timezoneId: 'Europe/Paris', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, tel);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  const LIGNES = Object.entries(sc.listings).map(([uid, l]) => ({ id: `harvest_${uid}_listings`, data: { capturedAt: l.cap, uid, payload: { items: l.items, pagination: { total_entries: l.items.length } } } }));
  const main = { vinted_annonce_numeros: sc.fiches, vrm_numeros_journal: sc.journal, vinted_dark: tel };
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecritures.push({ m: req.method(), u, t: Date.now() }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, sel)]);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecritures };
};
// L'écran Annonces a rendu sa liste (ou sa panne) : on attend ce qui est RENDU, jamais un délai seul.
const attendreAnnonces = async (pg) => {
  await pg.waitForFunction(() => document.querySelector('[data-annonces-deux-fois]') || document.querySelectorAll('[data-ann-id], .vrm-ann-carte, [data-annonce-id]').length > 0 || /Aucune annonce|pas pu/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  // L'écran d'attente (le logo) se retire sur une minuterie : l'horloge du banc est posée, on l'avance.
  await pg.clock.fastForward(6000).catch(() => {});
  await pg.waitForTimeout(800);
};
const lireAlerte = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-annonces-deux-fois]');
  if (!s) return { alerte: false, rendu: document.body.innerText.slice(0, 300) };
  const b = s.querySelector('.vrm-deux-fois-alerte-tete b');
  const lignes = [...s.querySelectorAll('[data-deux-fois-annonce]')].map((li) => ({ id: li.getAttribute('data-deux-fois-annonce'), txt: li.innerText.replace(/\s+/g, ' '),
    prix: (li.querySelector('[data-deux-fois-prix]') || { getAttribute: () => null }).getAttribute('data-deux-fois-prix'),
    depuis: (li.querySelector('[data-deux-fois-depuis]') || { getAttribute: () => null }).getAttribute('data-deux-fois-depuis') }));
  const liens = [...s.querySelectorAll('[data-deux-fois-ouvrir]')].map((a) => ({ href: a.getAttribute('href'), cible: a.getAttribute('target'), h: Math.round(a.getBoundingClientRect().height) }));
  const r = s.getBoundingClientRect();
  // AU-DESSUS de tout (un écran d'attente posé dessus passerait les autres contrôles, §6.2).
  const tete = s.querySelector('.vrm-deux-fois-alerte-tete');
  const tr = tete ? tete.getBoundingClientRect() : r;
  const dessus = document.elementFromPoint(Math.min(window.innerWidth - 2, tr.left + 20), Math.min(window.innerHeight - 2, tr.top + tr.height / 2));
  return { alerte: true, dessus: !!dessus && s.contains(dessus), ids: s.getAttribute('data-annonces-deux-fois'), titre: b && b.textContent, couleurTitre: b && getComputedStyle(b).color, ombre: getComputedStyle(s).boxShadow,
    lignes, liens, supprimer: [...s.querySelectorAll('button')].filter((x) => /supprim|retirer/i.test(x.textContent)).length, visible: r.width > 2 && r.height > 2,
    deborde: document.documentElement.scrollWidth > window.innerWidth + 1, sombre: document.documentElement.getAttribute('data-theme') || '' };
});
const ROUGE = /255,\s*59,\s*48|255,\s*69,\s*58|215,\s*0,\s*21/;

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }]) {
      const nomVp = vp.width < 600 ? '390-sombre' : '1512';
      console.log(`\n── ${nomVp}`);
      await essaie(`A ${nomVp}`, async () => {
        const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, SCENARIOS.A, 'cat_annonces');
        await attendreAnnonces(pg);
        await pg.evaluate(() => { const s = document.querySelector('[data-annonces-deux-fois]'); if (s) s.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(300);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `af-annonces-A-${nomVp}.png`) });
        const avant = ecritures.length;
        const r = await lireAlerte(pg);
        dit(r.alerte, 'même photo exacte sur deux comptes : l’alerte est sur l’écran Annonces', r.rendu);
        if (r.alerte) {
          dit(r.ids === '5000001+6000001', 'une paire, ses deux annonces (5000001 + 6000001)', r.ids);
          dit(r.titre === 'N°12 en ligne deux fois', 'le titre : « N°12 en ligne deux fois »', r.titre);
          const l = Object.fromEntries(r.lignes.map((x) => [x.id, x]));
          dit(l['5000001'] && /compte-alpha/.test(l['5000001'].txt) && l['6000001'] && /compte-beta/.test(l['6000001'].txt), 'chaque annonce nomme SON compte', JSON.stringify(r.lignes));
          dit(l['5000001'] && l['5000001'].prix === '60' && /60\s€/.test(l['5000001'].txt) && l['6000001'] && l['6000001'].prix === '55.5' && /55,50\s€/.test(l['6000001'].txt), 'chaque annonce porte SON prix (60 € · 55,50 €)', JSON.stringify(r.lignes.map((x) => x.txt)));
          dit(r.lignes.every((x) => x.depuis && /en ligne depuis le /.test(x.txt)), 'chaque annonce dit depuis quand elle est en ligne', JSON.stringify(r.lignes.map((x) => x.txt)));
          dit(r.liens.length === 2 && r.liens.every((x) => /^https:\/\/www\.vinted\.fr\/items\/\d+/.test(x.href) && x.cible === '_blank' && x.h >= 44), '« Ouvrir sur Vinted » : vinted.fr, nouvel onglet, ≥ 44 px', JSON.stringify(r.liens));
          dit(!ROUGE.test(r.couleurTitre || '') && !ROUGE.test(r.ombre || '') && /rgb/.test(r.ombre || ''), 'en AMBRE (titre et filet), jamais le rouge du doublon', `${r.couleurTitre} / ${r.ombre}`);
          dit(r.supprimer === 0, 'aucun bouton qui supprime depuis VRM (son clic, sur Vinted)');
          dit(r.visible && r.dessus && !r.deborde, 'visible (au-dessus de tout), aucun débordement horizontal', JSON.stringify({ dessus: r.dessus }));
          if (vp.width < 600) dit(r.sombre === 'dark', 'rendu en mode sombre', r.sombre);
        }
        await pg.waitForTimeout(300);
        const parties = ecritures.slice(avant).filter((e) => /vinted_annonce_numeros|DELETE/i.test(e.u + e.m));
        dit(parties.length === 0, 'lire l’alerte n’écrit rien', JSON.stringify(parties.slice(0, 2)));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        // H. La fiche des N° : l'histoire, en lecture seule.
        const fiche = async (n) => {
          await pg.evaluate(() => { const x = document.querySelector('[data-fiche-fermer]'); if (x) x.click(); });
          await pg.waitForTimeout(200);
          await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })), n);
          await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
          for (let i = 0; i < 60; i++) { const lu = await pg.evaluate(() => (document.querySelector('[data-fiche-paire]') || { getAttribute: () => '1' }).getAttribute('data-fiche-lecture-en-cours')); if (lu === '0') break; await pg.waitForTimeout(250); }
          await pg.evaluate(() => { const s = document.querySelector('[data-fiche-histo-num]'); if (s) s.scrollIntoView({ block: 'center' }); });
          await pg.waitForTimeout(300);
          return pg.evaluate(() => {
            const s = document.querySelector('[data-fiche-histo-num]');
            if (!s) return { histo: false, txt: ((document.querySelector('[data-fiche-paire]') || {}).innerText || '').slice(0, 300) };
            return { histo: true, cle: s.getAttribute('data-fiche-histo-num'), evs: [...s.querySelectorAll('[data-histo-num-ev]')].map((e) => ({ q: e.getAttribute('data-histo-num-ev'), src: e.getAttribute('data-histo-num-source'), txt: e.innerText.replace(/\s+/g, ' ') })),
              commandes: s.querySelectorAll('button, input, select, textarea, a').length, couleurs: [...s.querySelectorAll('*')].map((e) => getComputedStyle(e).color).filter((c) => /255,\s*59,\s*48|255,\s*69,\s*58|215,\s*0,\s*21/.test(c)).length,
              deborde: document.documentElement.scrollWidth > window.innerWidth + 1, note: (s.querySelector('[data-histo-num-note]') || {}).textContent || '' };
          });
        };
        const h12 = await fiche('12');
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `af-fiche-12-${nomVp}.png`) });
        dit(h12.histo, 'la fiche du N°12 montre « L’histoire du N° »', h12.txt);
        if (h12.histo) {
          dit(h12.evs.some((e) => e.q === 'main' && /Saisi à la main/.test(e.txt) && /avant : N°7/.test(e.txt)), 'N°12 : saisi à la main (avant : N°7), daté', JSON.stringify(h12.evs));
          dit(h12.evs.filter((e) => e.q === 'main').length === 1, 'le même événement n’est dit qu’une fois (journal et fiche)', JSON.stringify(h12.evs));
          dit(h12.commandes === 0, 'lecture seule : aucun bouton, aucun champ, aucun lien dans l’histoire', String(h12.commandes));
          dit(h12.couleurs === 0 && !h12.deborde, 'aucune couleur rouge, aucun débordement');
        }
        const h40 = await fiche('40');
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `af-fiche-40-${nomVp}.png`) });
        dit(h40.histo && h40.evs.length === 1 && /Origine non enregistrée \(avant le 9 nov\. 2026\)/.test(h40.evs[0].txt), 'N°40 sans trace : « origine non enregistrée (avant le 9 nov. 2026) » — jamais deviné', JSON.stringify(h40));
        const h7 = await fiche('7');
        dit(h7.histo && h7.evs.some((e) => e.q === 'quitte' && /N°12/.test(e.txt)), 'N°7 : quitté par une annonce, qui porte maintenant le N°12', JSON.stringify(h7));
        dit(errs.length === 0, 'aucune erreur JS (fiches)', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`B ${nomVp}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.B, 'cat_annonces');
        await attendreAnnonces(pg);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `af-annonces-B-${nomVp}.png`) });
        const r = await pg.evaluate(() => ({ alerte: !!document.querySelector('[data-annonces-deux-fois]'), liste: /Nike Dunk Low Panda/.test(document.body.innerText) }));
        dit(r.liste && !r.alerte, '50 annonces au même titre, marque et taille (photos différentes) : aucune alerte', JSON.stringify(r));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`C ${nomVp}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.C, 'cat_annonces');
        await attendreAnnonces(pg);
        const r = await pg.evaluate(() => ({ alerte: !!document.querySelector('[data-annonces-deux-fois]'), liste: /Air Max 90/.test(document.body.innerText) }));
        dit(r.liste && !r.alerte, 'second compte lu il y a 30 h (« à confirmer ») : aucune alerte', JSON.stringify(r));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
