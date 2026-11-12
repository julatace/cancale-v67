// ── BANC : COLIS CHRONOPOST SANS ADRESSE + « VOIR L'E-MAIL » (12 nov.) ─────────
// Mesuré (lecture seule, ligne `email_track_chronopost_08448881184010`) : `lieu` vide,
// `extraitLieu` rempli sous la forme « NOM | RUE DE LA … | CP VILLE » — une rue SANS
// numéro, refusée par `lieuDepuisExtrait`. Et aucune ligne de suivi ne gardait l'e-mail
// source : pas de « Voir l'e-mail ». Données INVENTÉES de même forme (dépôt public).
// Exige (data-* et textes rendus) :
//   A. le colis Chronopost montre son point (nom + rue sans numéro + CP ville) ;
//   B. avec `emailRecu` : « Voir l'e-mail » ouvre le texte de CET e-mail (route du journal,
//      l'id demandé = celui de la ligne), rendu en TEXTE (aucune balise active) ;
//   C. sans `emailRecu` (lignes d'avant le 12 nov.) : aucun bouton (pas su ⇒ rien) ;
//   D. la route répond mal ⇒ « n'a pas pu être chargé » + « Réessayer », jamais un texte inventé ;
//   E. cible ≥ 44 px, rien ne déborde, aucune erreur. 390 tactile et 1512, clair et sombre.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4637);
const SHOTS = process.env.SHOTS || '';

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const jourDans = (j) => { const d = new Date(MAINTENANT + j * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ID_EMAIL = 'email_reception_' + 'ab12'.repeat(16);
const TEXTE = 'Bonjour,\nVotre colis XY123456789FR vous attend.\nEPICERIE DU TEST\nRUE DE LA FONTAINE\n35000 RENNES\nCode de retrait : 482913\n<script>window.__xss=1</script>';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ligne = (carrier, suivi, extra) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Disponible', subject: `Votre colis ${suivi} vous attend`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code: null, code2: null, artTitle: null, lieu: null, limite: jourDans(4), consigne: false, qrB64: null, qrType: null, qrUrl: null, account: 'compte_banc' }, extra) });
const ROWS = [
  { id: 'main', data: {} },
  // La forme MESURÉE : lieu vide, l'extrait « NOM | RUE sans numéro | CP VILLE », et (depuis le 12 nov.) l'e-mail source.
  ligne('chronopost', 'XY123456789FR', { code: '482913', extraitLieu: 'EPICERIE DU TEST | RUE DE LA FONTAINE | 35000 RENNES', emailRecu: ID_EMAIL }),
  // Une ligne rangée AVANT le 12 nov. : pas d'e-mail source.
  ligne('mondialrelay', '90000031', { code: '313131', lieu: 'TABAC DU PORT, 17 Rue du Port, 56000 Vannes' }),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp, sombre, routeKo) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const demandes = [];
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!s)); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id) && filtreData(u)(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (/email-rattacher/.test(u.pathname) && u.searchParams.get('mode') === 'journal' && u.searchParams.get('texte')) {
      demandes.push(u.searchParams.get('texte'));
      if (routeKo.on) return r.fulfill({ status: 503, contentType: 'text/html', body: '<html>503</html>' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: u.searchParams.get('texte'), texte: TEXTE }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs, demandes };
}

// Ouvre la ligne du colis (par son n° de suivi) et rend son détail.
async function ouvrirLigne(pg, suivi) {
  const sel = `[data-rp-suivi="${suivi}"]`;
  if (await pg.locator(sel).count()) return pg.locator(sel).first();
  const lignes = pg.locator('[data-cc-colonne="retirer"] .vrm-rpf-ouvrir');
  const n = await lignes.count();
  for (let i = 0; i < n; i++) {
    const b = lignes.nth(i);
    if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click();
    if (await pg.locator(sel).count()) return pg.locator(sel).first();
  }
  return null;
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      const T = `${vp.width}px ${sombre ? 'sombre' : 'clair'}`;
      await essaie(T, async () => {
        const routeKo = { on: false };
        const { ctx, pg, errs, demandes } = await preparer(b, vp, sombre, routeKo);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-cc-colonne="retirer"]').first().waitFor({ timeout: 25000 });
        await pg.locator('[data-cc-colonne="retirer"] .vrm-rpf-ouvrir, [data-rp-suivi]').first().waitFor({ timeout: 15000 });
        const texteColonne = await pg.locator('[data-cc-colonne="retirer"]').first().innerText();
        // A. le point Chronopost à rue sans numéro.
        dit(/EPICERIE DU TEST/i.test(texteColonne) && /RUE DE LA FONTAINE/i.test(texteColonne) && /35000 RENNES/i.test(texteColonne), `${T} A le point Chronopost (rue sans numéro) est montré`, texteColonne.replace(/\s+/g, ' ').slice(0, 220));
        // C. la ligne d'avant le 12 nov. : aucun bouton.
        const mr = await ouvrirLigne(pg, '90000031');
        const detMr = mr ? mr.locator('xpath=ancestor::*[@data-rp-detail or contains(@class,"vrm-pickup-card")][1]') : null;
        dit(!!mr && detMr && (await detMr.locator('[data-colis-email-voir]').count()) === 0, `${T} C sans e-mail source gardé : aucun « Voir l’e-mail »`);
        // B. la ligne Chronopost : « Voir l'e-mail ».
        const ch = await ouvrirLigne(pg, 'XY123456789FR');
        const det = ch ? ch.locator('xpath=ancestor::*[@data-rp-detail or contains(@class,"vrm-pickup-card")][1]') : null;
        const bouton = det ? det.locator(`[data-colis-email="${ID_EMAIL}"] [data-colis-email-voir]`) : null;
        dit(!!bouton && (await bouton.count()) === 1, `${T} B « Voir l’e-mail » sur le colis dont l’e-mail source est gardé`);
        if (bouton && await bouton.count()) {
          await bouton.scrollIntoViewIfNeeded();
          const h = await bouton.evaluate((e) => e.getBoundingClientRect().height);
          dit(h >= 44, `${T} E « Voir l’e-mail » : cible ≥ 44 px`, String(h));
          // D d'abord : la route en panne.
          routeKo.on = true;
          await bouton.click();
          await pg.locator('[data-colis-email-texte="pas-su"]').first().waitFor({ timeout: 8000 }).catch(() => {});
          dit(await pg.locator('[data-colis-email-texte="pas-su"]').count() === 1 && await pg.locator('[data-colis-email-texte="lu"]').count() === 0, `${T} D route en panne ⇒ « n’a pas pu être chargé », aucun texte`);
          routeKo.on = false;
          await pg.locator('[data-colis-email-texte="pas-su"] button').first().click();
          await pg.locator('[data-colis-email-texte="lu"]').first().waitFor({ timeout: 8000 });
          const t = await pg.locator('[data-colis-email-texte="lu"]').first().innerText();
          dit(demandes.length >= 1 && demandes.every((x) => x === ID_EMAIL), `${T} B le texte demandé est celui de CET e-mail`, demandes.join(','));
          dit(/Code de retrait : 482913/.test(t) && /<script>/.test(t), `${T} B le texte est rendu en TEXTE (balise visible, jamais exécutée)`, t.slice(0, 80));
          dit(!(await pg.evaluate(() => window.__xss)), `${T} B aucune balise exécutée`);
          if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `colis-voir-email-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) }); }
        }
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `${T} E rien ne déborde`, String(deb));
        dit(!errs.length, `${T} E aucune erreur d’app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis-voir-email : ${ko} rouge(s).` : `\n✅ colis-voir-email : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
