// ── BANC : UN COLIS À RETIRER DANS UNE AUTRE VILLE (2 nov., 23 h) ─────────────
// Julien : « j'ai un colis arrivé à Cancale, je veux qu'il soit affiché même
// s'il n'est pas dans la même ville ». Mesuré sur sa base (lecture seule) : sa
// ville réglée est Vannes, ses autres colis attendent à Vannes ; le colis de
// l'autre ville est un LOCKER Mondial Relay dont l'e-mail écrit, une ligne vide
// entre chaque ligne : « LOCKER / LOCKER 24/7 <ENSEIGNE> / Rue … (SANS numéro) /
// <CP> <Ville> ». Le lieu rangé n'était que « LOCKER 24/7 <ENSEIGNE> » : ni rue,
// ni code postal, ni ville — le point n'allait jamais sur la carte, que la carte
// cadrait sur les seuls points placés (Vannes).
// Formes MESURÉES, valeurs INVENTÉES (aucune donnée de Julien ici, dépôt public) :
//   · deux colis d'e-mail à Vannes (adresse complète) ;
//   · le colis du locker d'une AUTRE ville (Dinan, 22100), lieu rangé « LOCKER
//     24/7 MARCHE DU PORT » seul, et son e-mail entier (`email_texte_*`, la forme
//     réelle à lignes vides) ;
//   · un colis dont le lieu n'est pas géocodable (nom seul) ;
//   · `vrm_ville` = « Vannes ».
// Exige : les 4 colis listés et comptés (colonne = `vrm_colis_retirer`), le
// point de l'autre ville AVEC son adresse lue (rue, CP, ville), placé sur la
// carte, la carte cadrée sur TOUS les points placés (Vannes ET Dinan), et le
// point non géocodable listé avec « pas sur la carte » + sa raison.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4417);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const track = (suivi, lieu, code, extra = {}) => ({ id: `email_track_mondialrelay_${suivi}`, data: Object.assign({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code, lieu, limite: dans(4), consigne: false, account: '' }, extra) });
// L'e-mail du locker, à la forme RÉELLE (une ligne vide entre chaque ligne).
const TEXTE_LOCKER = ['Vinted te transfère cet e-mail de la part de Mondial Relay.', 'Votre colis 90000003 est disponible', 'Bonne nouvelle,', 'Votre colis n° 90000003 est', 'disponible !',
  'CODE DE RETRAIT', '333333', 'LOCKER', 'LOCKER 24/7 MARCHE DU PORT', 'Rue des Rosiers', '22100 Dinan', 'RETRAIT JUSQU’AU', '07/11', 'Un imprévu ? Partagez votre code de retrait à un proche.'].join('\n\n');
const ROWS = [
  { id: 'main', data: { vrm_ville: 'Vannes' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  track('90000001', 'TABAC CENTRAL, 8 Rue de la Gare, 56000 Vannes', '111111'),
  track('90000002', 'TABAC CENTRAL, 8 Rue de la Gare, 56000 Vannes', '222222'),
  track('90000003', 'LOCKER 24/7 MARCHE DU PORT', '333333', { consigne: true }),
  track('90000004', 'BAZAR DES AMIS', '444444'),
  { id: 'email_texte_banc90000003', data: { at: ilYa(0.3), texte: TEXTE_LOCKER } },
  { id: 'email_reception_banc90000003', data: { at: ilYa(0.3), etat: 'integre', type: 'suivi', subject: 'Votre colis 90000003 est disponible', resume: { s: '90000003', t: 'suivi', v: 1, st: 'available', tr: 'mondialrelay', lim: dans(4), code: '333333', lieu: 'LOCKER 24/7 MARCHE DU PORT' } } },
  // Le suivi lu chez Mondial Relay pour ce n° : disponible, sans lieu (forme mesurée).
  { id: 'transp_mondialrelay_90000003', data: { v: 1, cp: '22100', etat: 'disponible', fini: false, suivi: '90000003', carrier: 'mondialrelay', libelle: '5 jours restants pour retirer le colis en Locker', lieuNom: '', lieuRue: '', lieuCp: '', lieuVille: '', limite: dans(4), etatAt: ilYa(0.4), source: 'serveur', evenements: [] } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

// La Base Adresse Nationale du banc : Vannes (8 Rue de la Gare, 56000) et Dinan
// (Rue des Rosiers, 22100 — une RUE, sans numéro). Rien d'autre.
const BAN = (u) => {
  const d = decodeURIComponent(u);
  if (/Rue de la Gare/i.test(d) && /56000|Vannes/i.test(d)) return [{ geometry: { coordinates: [-2.7550, 47.6530] }, properties: { score: 0.95, type: 'housenumber', postcode: '56000', city: 'Vannes', name: '8 Rue de la Gare', label: '8 Rue de la Gare 56000 Vannes' } }];
  if (/Rue des Rosiers/i.test(d) && /22100|Dinan/i.test(d)) return [{ geometry: { coordinates: [-2.0470, 48.4550] }, properties: { score: 0.9, type: 'street', postcode: '22100', city: 'Dinan', name: 'Rue des Rosiers', label: 'Rue des Rosiers 22100 Dinan' } }];
  return [];
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ban = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) { ban.push(decodeURIComponent(u)); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: BAN(u) }) }); }
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
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
    if (inn) { const ids = inn[1].split(',').map((s) => s.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ban };
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--enable-unsafe-swiftshader'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px', tel = vp.width < 600;
      await essaie(T, async () => {
        const { ctx, pg, errs, ban } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().waitFor({ timeout: 25000 });
        await pg.click('[data-colis-onglet-choix="retirer"]');
        await pg.locator('[data-cc-colonne="retirer"] [data-relais-point]').first().waitFor({ timeout: 25000 });
        if (!tel) await pg.waitForSelector('[data-cc-colonne="retirer"] [data-relais-point^="marcheduport"][data-relais-repere="oui"]', { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const r = await pg.evaluate(() => {
          const col = document.querySelector('[data-cc-colonne="retirer"]');
          const pts = [...col.querySelectorAll('[data-relais-point]')].map((e) => ({ cle: e.getAttribute('data-relais-point'), c: e.getAttribute('data-relais-point-comptes'), rp: e.getAttribute('data-relais-repere'),
            adr: (e.querySelector('[data-relais-adresse]') || {}).textContent || '', raison: (e.querySelector('[data-relais-sans-repere]') || { getAttribute: () => null }).getAttribute('data-raison'), codes: [...e.querySelectorAll('[data-code-retrait]')].map((x) => x.getAttribute('data-code-retrait')).filter(Boolean) }));
          let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {}
          const rp = col.querySelector('[data-retirer-par-point]');
          return { n: Number(col.getAttribute('data-cc-n')), pub: pub && pub.total, pts, surCarte: rp ? Number(rp.getAttribute('data-retirer-sur-carte')) : null, cadre: rp ? rp.getAttribute('data-retirer-cadre') : null,
            fond: (document.querySelector('[data-relais-fond]') || { getAttribute: () => null }).getAttribute('data-relais-fond'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
        });
        console.log('INFO ' + T + ' ' + JSON.stringify(r));
        const codes = r.pts.flatMap((p) => p.codes);
        dit(r.n === 4 && r.pub === 4, `${T} les 4 colis comptés : colonne = Ma journée (vrm_colis_retirer)`, JSON.stringify({ n: r.n, pub: r.pub }));
        dit(['111111', '222222', '333333', '444444'].every((c) => codes.includes(c)), `${T} les 4 codes sont listés, l'autre ville comprise`, JSON.stringify(codes));
        const dinan = r.pts.find((p) => /^marcheduport\|/.test(p.cle));
        dit(!!dinan && dinan.cle === 'marcheduport|22100' && /Rue des Rosiers/.test(dinan.adr) && /22100 Dinan/.test(dinan.adr), `${T} le locker de l'autre ville porte SON adresse lue dans l'e-mail (rue, CP, ville)`, JSON.stringify(dinan));
        const bazar = r.pts.find((p) => /^bazardesamis/.test(p.cle));
        if (tel) dit(!!bazar && bazar.codes.includes('444444'), `${T} le point sans adresse reste listé avec son colis`, JSON.stringify(bazar));
        else {
          dit(!!bazar && bazar.rp === 'non' && !!bazar.raison && bazar.codes.includes('444444'), `${T} le point sans adresse reste listé : « pas sur la carte » + raison`, JSON.stringify(bazar));
          dit(!!dinan && dinan.rp === 'oui', `${T} le locker de l'autre ville est placé sur la carte`, JSON.stringify(dinan));
          dit(r.surCarte === 2 && /22100/.test(r.cadre || '') && /56000/.test(r.cadre || ''), `${T} la carte se cadre sur TOUS les points placés (Vannes et Dinan)`, JSON.stringify({ surCarte: r.surCarte, cadre: r.cadre }));
          dit(ban.some((u) => /Rue des Rosiers/.test(u) && /postcode=22100/.test(u)), `${T} l'adresse de l'autre ville est cherchée avec SON code postal`, JSON.stringify(ban));
        }
        dit(r.sw <= r.cw + 1, `${T} aucun débordement`, JSON.stringify({ sw: r.sw, cw: r.cw }));
        if (process.env.SHOTS) {
          await pg.evaluate(() => { const c = document.querySelector('[data-cc-colonne="retirer"]'); if (c) c.scrollIntoView({ block: 'start' }); });
          await pg.waitForTimeout(400);
          await pg.screenshot({ path: path.join(process.env.SHOTS, `retrait-autre-ville-${vp.width}.png`), fullPage: false });
        }
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis dans une autre ville : ${ko} rouge(s).` : `\n✅ colis dans une autre ville : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
