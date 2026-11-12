// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA DISCRÉTION À L'ÉCRAN (12 nov., ext. 5.370)
//        (node scripts/bancs/discretion.cjs — après `npm run build`)
//        BANC_PORT=… · BANC_DIST=… · BANC_SHOTS=<dossier> pour les captures
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public), à la forme publiée par l'extension 5.370 dans
// `actions_compte_{uid}_{navigateur}` :
//   · compte_a (111) : 112 actions aujourd'hui sur deux Chrome (plafond tiré 170),
//     un refus 429 + pause + prudence au carnet ;
//   · compte_b (222) : Vinted a demandé une vérification il y a 5 min (captcha), un 403.
// Il exige, à 390 px tactile et 1512 px, en clair ET en sombre :
//   Paramètres → Mes comptes → « Discrétion » : « Tout arrêter » (44 px), le plafond par
//     jour et les limites par heure, « 112/170 aujourd’hui », le carnet, et pour compte_b
//     l'alerte AMBRE « Vinted demande une vérification » + « Reprendre » (44 px) ;
//     « Reprendre » écrit SA reprise (synchronisée) et l'alerte s'en va ;
//   Ma journée : l'alerte de compte_b ; « Tout arrêter » posé ⇒ « Tout est arrêté » ;
//   Santé des comptes : le point « Freins de Vinted (7 j) » (compte_b à surveiller) ;
//   aucun débordement, aucune erreur, aucun rouge.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4451;
const SHOTS = process.env.BANC_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'discretion-'));
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), MIN = 60000, H = 3600000;
const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(MAINTENANT));
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: new Date().toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: new Date().toISOString() },
];
const rowsDe = ({ sombre, tout }) => [
  { id: 'main', data: { vinted_dark: !!sombre, ...(tout ? { vinted_discretion: { parJour: 200, tout: { on: true, at: MAINTENANT - MIN } } } : {}) } },
  { id: 'actions_compte_111_aaaaaaaaaaaaaaaa', data: { uid: '111', ts: [MAINTENANT - 5 * MIN, MAINTENANT - 9 * MIN], max: 50, reserve: 5, jour: { d: jour, n: 70 }, maxJour: 170, parJour: 200, ev: [{ t: MAINTENANT - 2 * H, s: '429' }, { t: MAINTENANT - 2 * H, s: 'pause' }, { t: MAINTENANT - 2 * H, s: 'prudence' }] } },
  { id: 'actions_compte_111_bbbbbbbbbbbbbbbb', data: { uid: '111', ts: [], max: 50, reserve: 5, jour: { d: jour, n: 42 }, maxJour: 180, parJour: 200, ev: [] } },
  { id: 'actions_compte_222_aaaaaaaaaaaaaaaa', data: { uid: '222', ts: [], max: 50, reserve: 5, jour: { d: jour, n: 3 }, maxJour: 160, parJour: 200, captcha: MAINTENANT - 5 * MIN, arret: 'captcha', ev: [{ t: MAINTENANT - 5 * MIN, s: 'captcha' }, { t: MAINTENANT - 5 * MIN, s: '403' }] } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 600)); } };
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, { sombre = false, tout = false } = {}) {
  const ROWS = rowsDe({ sombre, tout });
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([s, t, at]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); if (t && !sessionStorage.getItem('banc_tout')) { sessionStorage.setItem('banc_tout', '1'); localStorage.setItem('vinted_discretion', JSON.stringify({ parJour: 200, tout: { on: true, at } })); } } catch (_) {} }, [sombre, tout, MAINTENANT - MIN]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? r.continue() : r.abort()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecritures.push(req.method() + ' ' + u.slice(0, 120) + ' ' + String(req.postData() || '').slice(0, 300)); return j([]); }
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date().toISOString(), cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = reDe(lk[1]); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecritures };
}
async function sain(pg, ecran, sel) {
  const r = await pg.evaluate((sel) => {
    const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
    const rouge = [...document.querySelectorAll(sel)].some((root) => [root, ...root.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); }));
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText, rouge };
  }, sel);
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
  dit(!r.rouge, `${ecran} : aucun rouge (§7)`);
}
const attendre = async (pg, sel, ms = 25000) => { await pg.waitForSelector(sel, { timeout: ms }).catch(() => {}); };
const ambre = (c) => { const [r, g, bb] = (/rgba?\(([^)]+)\)/.exec(c || '') || [, ''])[1].split(',').map(Number); return r > 150 && g > 50 && g < 200 && bb < 100 && r - bb > 100; };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`, suf = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
        console.log(`── ${nom}`);
        const { ctx, pg, errs, ecritures } = await preparer(b, vp, { sombre });
        await essaie('parametres', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=settings&section=discretion`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-discretion] [data-discretion-compte="222"] [data-carnet]');
          await pg.waitForTimeout(800);
          const s = await pg.evaluate(() => {
            const p = document.querySelector('[data-discretion]'); if (!p) return null;
            const a = p.querySelector('[data-discretion-compte="111"]'), c = p.querySelector('[data-discretion-compte="222"]');
            const v = c && c.querySelector('[data-verification]'), rb = v && v.querySelector('[data-verification-reprendre]');
            const t = p.querySelector('[data-tout-bouton]');
            return { jourA: a && a.querySelector('[data-discretion-jour]').getAttribute('data-discretion-jour'), txtA: a && a.innerText, carnetA: a && a.querySelector('[data-carnet]').getAttribute('data-carnet'),
              verif: v && v.innerText, couleur: v && getComputedStyle(v.querySelector('b')).color, rbH: rb && rb.getBoundingClientRect().height, rbFond: rb && getComputedStyle(rb).backgroundColor,
              toutH: t && t.getBoundingClientRect().height, toutEtat: (p.querySelector('[data-tout-etat]') || {}).getAttribute && p.querySelector('[data-tout-etat]').getAttribute('data-tout-etat'),
              champs: p.querySelectorAll('[data-discretion-champ], [data-discretion-parheure]').length };
          });
          dit(s && s.jourA === '112/170' && /112\/170 aujourd’hui/.test(s.txtA), 'Discrétion : compte_a « 112/170 aujourd’hui » (deux Chrome, le plafond le plus prudent)', JSON.stringify(s && s.jourA));
          dit(s && s.carnetA === '3' && /1 refus 429/.test(s.txtA) && /1 pause\b/.test(s.txtA), 'Discrétion : le carnet des 7 jours de compte_a (429, pause, prudence)', s && s.txtA);
          dit(s && /Vinted demande une vérification/.test(s.verif || '') && /Reprendre/.test(s.verif || '') && ambre(s.couleur) && ambre(s.rbFond) && s.rbH >= 44, 'Discrétion : compte_b — l’alerte AMBRE « Vinted demande une vérification » et « Reprendre » (44 px)', JSON.stringify(s));
          dit(s && s.toutEtat === 'marche' && s.toutH >= 44 && s.champs === 3, 'Discrétion : « Tout arrêter » (44 px) et les trois réglages (jour, favoris/h, offres/h)', JSON.stringify(s));
          await pg.screenshot({ path: path.join(SHOTS, `parametres-${suf}.png`), fullPage: false });
          const el = await pg.$('[data-discretion]'); if (el) await el.screenshot({ path: path.join(SHOTS, `panneau-${suf}.png`) });
          await sain(pg, `${nom} Discrétion`, '[data-discretion]');
          // « Reprendre » : SA reprise, rangée dans le réglage synchronisé ; l'alerte s'en va.
          await pg.click('[data-discretion-compte="222"] [data-verification-reprendre]');
          await pg.waitForTimeout(1500);
          const apres = await pg.evaluate(() => { let v = null; try { v = JSON.parse(localStorage.getItem('vinted_discretion') || 'null'); } catch (_) {} return { reprise: v && v.reprises && v.reprises['222'], alerte: !!document.querySelector('[data-discretion-compte="222"] [data-verification]') }; });
          dit(apres.reprise > 0 && !apres.alerte, 'Reprendre : la reprise de compte_b est rangée (vinted_discretion.reprises), l’alerte disparaît', JSON.stringify(apres));
          // « Tout arrêter » : posé, rangé, dit.
          await pg.click('[data-tout-bouton="arreter"]');
          await pg.waitForTimeout(1500);
          const t2 = await pg.evaluate(() => { let v = null; try { v = JSON.parse(localStorage.getItem('vinted_discretion') || 'null'); } catch (_) {} const x = document.querySelector('[data-tout-etat]'); return { tout: v && v.tout, etat: x && x.getAttribute('data-tout-etat'), fond: x && getComputedStyle(x.querySelector('button')).backgroundColor }; });
          dit(t2.tout && t2.tout.on === true && t2.etat === 'arrete' && ambre(t2.fond), 'Tout arrêter : rangé (vinted_discretion.tout), le bouton devient « Reprendre » ambre', JSON.stringify(t2));
          const p2 = await pg.$('[data-discretion]'); if (p2) await p2.screenshot({ path: path.join(SHOTS, `panneau-arrete-${suf}.png`) });
        });
        await essaie('journee', async () => {
          await pg.evaluate(() => { try { localStorage.removeItem('vinted_discretion'); } catch (_) {} });
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-verifications-journee] [data-verification="222"]');
          await pg.waitForTimeout(500);
          const s = await pg.evaluate(() => { const x = document.querySelector('[data-verifications-journee]'); return x ? { n: x.getAttribute('data-verifications-journee'), t: x.innerText } : null; });
          dit(s && s.n === '1' && /Vinted demande une vérification/.test(s.t), 'Ma journée : la ligne ambre de compte_b et « Reprendre »', JSON.stringify(s));
          const el = await pg.$('[data-verifications-journee]'); if (el) await el.screenshot({ path: path.join(SHOTS, `journee-${suf}.png`) });
          await sain(pg, `${nom} Ma journée`, '[data-verifications-journee]');
        });
        await essaie('sante', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=settings&section=santecomptes`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-sante-comptes="reglages"] [data-sc-compte="222"]');
          await pg.waitForTimeout(1200);
          await pg.click('[data-sante-comptes="reglages"] [data-sc-compte="222"] [data-sc-pourquoi]').catch(() => {});
          await pg.waitForTimeout(400);
          const s = await pg.evaluate(() => { const c = document.querySelector('[data-sante-comptes="reglages"] [data-sc-compte="222"]'); const f = c && c.querySelector('[data-sc-ind="freins"]'); return c ? { etat: c.getAttribute('data-sc-etat'), al: c.getAttribute('data-sc-alertes'), f: f && f.innerText, fal: f && f.getAttribute('data-sc-alerte') } : null; });
          dit(s && /freins/.test(s.al || '') && s.fal === '1' && /Freins de Vinted/.test(s.f || ''), 'Santé des comptes : le point « Freins de Vinted (7 j) » — compte_b à surveiller (vérification)', JSON.stringify(s));
          const el = await pg.$('[data-sante-comptes="reglages"]'); if (el) await el.screenshot({ path: path.join(SHOTS, `sante-${suf}.png`) });
        });
        dit(!errs.length, `${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 400));
        const autres = ecritures.filter((e) => /actions_compte_|journal_vrm_/.test(e));
        dit(!autres.length, `${nom} : l’app n’écrit jamais les lignes de l’extension (actions, journal)`, autres.join(' | ').slice(0, 300));
        await ctx.close();
      }
    }
    await essaie('tout arrete', async () => {
      const { ctx, pg } = await preparer(b, { width: 390, height: 844 }, { tout: true });
      await pg.evaluate(() => {}).catch(() => {});
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await attendre(pg, '[data-tout-arrete]');
      await pg.waitForTimeout(500);
      const s = await pg.evaluate(() => { const x = document.querySelector('[data-tout-arrete]'); return x ? { t: x.innerText, h: x.querySelector('[data-tout-reprendre]').getBoundingClientRect().height } : null; });
      dit(s && /Tout est arrêté/.test(s.t) && s.h >= 44, 'Ma journée : « Tout est arrêté » (posé depuis un autre appareil) et « Reprendre » 44 px', JSON.stringify(s));
      const el = await pg.$('[data-verifications-journee]'); if (el) await el.screenshot({ path: path.join(SHOTS, `journee-tout-arrete-390.png`) });
      await ctx.close();
    });
  } catch (e) { dit(false, 'banc', e && e.stack); }
  finally { if (b) await b.close(); srv.close(); console.log(`\nCaptures : ${SHOTS}`); console.log(ko ? `\n❌ discretion : ${ko} rouge(s)` : '\n✅ discretion : tout est vert'); process.exit(ko ? 1 : 0); }
})();
