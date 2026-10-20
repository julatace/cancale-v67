// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA PUBLICATION LEBONCOIN N'ENGAGE JAMAIS D'ARGENT NI UN FAUX PRIX
//         node scripts/audit-argent-lbc.cjs      (BANC_PORT, défaut 8411)
// ═══════════════════════════════════════════════════════════════════════════
// Revue adverse du 19 octobre (Julien : « la moindre erreur peut me faire
// perdre de l'argent »). Le VRAI `lbc.js` est chargé dans une vraie page
// Chromium, avec un faux `chrome.runtime` qui lui rend une paire lancée par
// l'app (`publier: true`). Chaque cas sert l'étape de publication
// (`/deposer-une-annonce/options`, mesurée) sous une forme que la garde
// d'avant laissait passer :
//   A. un bouton « Publier avec le logo Urgent » SANS prix écrit : il ajoute une
//      option payante — jamais cliqué ;
//   B. un bouton « Publier (2 EUR) » : un prix écrit en « EUR » — jamais cliqué ;
//   C. un prix déjà posé sur la page (Leboncoin, ou autre) qui n'est PAS celui
//      de VRM : la paire ne part pas à ce prix-là sans lui ;
//   D. l'autre sens : prix vide → VRM pose SON prix et publie ;
//   E. la page rechargée après le clic « Publier » (pas encore de
//      confirmation) : on ne reclique JAMAIS dans cet onglet ;
//   F. une option payante en interrupteur `aria-pressed` restée allumée : rien
//      n'est publié tant qu'elle l'est.
// Chaque contrôle compte ce que la PAGE a reçu (clics), jamais un libellé.
// ═══════════════════════════════════════════════════════════════════════════
const { chromium } = require(require('path').join(__dirname, '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');
let SRC = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'lbc.js'), 'utf8');
// --mutation=X réaffaiblit UNE garde : le contrôle qu'elle porte doit passer au rouge.
const MUT = { nomboost: ["!NOM_BOOST.test(libBtn(b)) && ", ''], prix: ['function prixRefus(ad) {', 'function prixRefus(ad) { return null;'],
  clic: ['if (dejaClique) return', 'if (false) return'], pressed: [",[aria-pressed]')", "')"] };
const mut = (/--mutation=(\w+)/.exec(process.argv.join(' ')) || [])[1];
if (mut) { const m = MUT[mut]; if (!m || !SRC.includes(m[0])) { console.log('❌ mutation ' + mut + ' introuvable — l’audit ne prouve rien'); process.exit(1); } SRC = SRC.replace(m[0], m[1]); console.log('(mutation : ' + mut + ')'); }
const PORT = Number(process.env.BANC_PORT) || 8411;

const COMPTE = '<scr' + 'ipt>window.__clic=function(k){var s=JSON.parse(sessionStorage.getItem("__clics")||"{}");s[k]=(s[k]||0)+1;sessionStorage.setItem("__clics",JSON.stringify(s));};</scr' + 'ipt>';
const CASES = '<fieldset><label><input type="checkbox" name="gallery"> À la une — Pendant 7 jours 7 €</label>'
  + '<label><input type="checkbox" name="urgent"> Logo urgent — 2,50 €</label></fieldset>';
const PAGES = {
  // A : un seul bouton de publication… qui ajoute l'option « Urgent ».
  A: CASES + '<div><button type="button" onclick="__clic(\'pub\')">Publier avec le logo Urgent</button></div>',
  // B : un prix en « EUR » sur le bouton.
  B: CASES + '<div><button type="button" onclick="__clic(\'pub\')">Publier (2 EUR)</button></div>',
  // C : un prix DÉJÀ posé par la page (150), alors que VRM veut 99.
  C: '<label for="p">Prix de vente souhaité*</label><input id="p" name="price_cents" value="150">'
    + CASES + '<div><button type="button" onclick="__clic(\'pub\')">Déposer mon annonce</button></div>',
  // D : le prix est vide → VRM pose 99, puis publie.
  D: '<label for="p">Prix de vente souhaité*</label><input id="p" name="price_cents" value="">'
    + CASES + '<div><button type="button" onclick="__clic(\'pub\')">Déposer mon annonce</button></div>',
  // E : une étape de publication ordinaire (on la recharge après le clic).
  E: CASES + '<div><button type="button" onclick="__clic(\'pub\')">Déposer mon annonce</button></div>',
  // F : une option payante en interrupteur, ALLUMÉE, qui ne s'éteint pas.
  F: CASES + '<div><button type="button" aria-pressed="true" name="urgent_toggle">Logo urgent 2,50 €</button></div>'
    + '<div><button type="button" onclick="__clic(\'pub\');if(document.querySelector(\'[aria-pressed=true]\'))__clic(\'paye\')">Déposer mon annonce</button></div>',
};
const PAGE = (k) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Leboncoin</title></head><body>
<header role="banner"><input name="text" placeholder="Rechercher"></header><main>${COMPTE}${PAGES[k] || ''}</main></body></html>`;

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const AD = { id: '3170000001', numero: '401', ref: 'VRM-401', title: 'Nike Air Max 1 T42', description: 'Paire en très bon état.', price: '99', category: 'Chaussures', photos: ['https://ex/1.jpg'], publier: true };
const initChrome = (d) => {
  window.__msgs = [];
  window.chrome = { runtime: { id: 'banc', lastError: null, getManifest: () => ({ version: '9.9.9' }), sendMessage: (m, cb) => {
    const rep = (o) => { try { cb && cb(o); } catch (_) {} };
    try { window.__msgs.push(m && m.action); } catch (_) {}
    if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
    return rep({ ok: true });
  }, onMessage: { addListener() {} } } };
};

(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE((/[?&]cas=([A-Z])/.exec(q.url) || [])[1])); });
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const lancer = async (cas, opts = {}) => {
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.addInitScript(initChrome, { ad: opts.ad || AD });
    const url = `http://localhost:${PORT}/deposer-une-annonce/options?cas=${cas}`;
    await pg.goto(url, { waitUntil: 'domcontentloaded' });
    await pg.addScriptTag({ content: SRC });
    await pg.waitForTimeout(opts.attente || 6000);
    if (opts.recharger) {
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await pg.addScriptTag({ content: SRC });
      await pg.waitForTimeout(6000);
    }
    const r = await pg.evaluate(() => ({ clics: JSON.parse(sessionStorage.getItem('__clics') || '{}'), prix: (document.querySelector('input[name=price_cents]') || {}).value,
      banner: (document.getElementById('vrm-lbc-banner') || {}).innerText || '', msgs: window.__msgs || [] }));
    await pg.close();
    return { r, errs };
  };
  try {
    { const { r, errs } = await lancer('A');
      dit(!errs.length, 'A — aucune erreur', errs[0] || '');
      dit(!r.clics.pub, 'A — « Publier avec le logo Urgent » (option payante, sans prix écrit) n’est JAMAIS cliqué', 'clics=' + JSON.stringify(r.clics)); }
    { const { r } = await lancer('B');
      dit(!r.clics.pub, 'B — « Publier (2 EUR) » (un prix écrit en EUR) n’est JAMAIS cliqué', 'clics=' + JSON.stringify(r.clics)); }
    { const { r } = await lancer('C');
      dit(!r.clics.pub, 'C — un prix posé sur la page (150 €) qui n’est pas celui de VRM (99 €) : rien n’est publié', 'clics=' + JSON.stringify(r.clics) + ' prix=' + r.prix);
      dit(r.prix === '150', 'C — et VRM n’écrase pas le prix déjà posé (on ne lutte pas avec lui)', 'prix=' + r.prix);
      dit(/prix/i.test(r.banner) && /99/.test(r.banner), 'C — le bandeau dit que le prix n’est pas celui de VRM, avec les deux montants', r.banner.replace(/\s+/g, ' ').slice(0, 160)); }
    { const { r, errs } = await lancer('D');
      dit(!errs.length, 'D — aucune erreur', errs[0] || '');
      dit(r.prix === '99', 'D — autre sens : le prix vide reçoit le prix de VRM (99, en euros)', 'prix=' + r.prix);
      dit(r.clics.pub === 1, 'D — autre sens : la paire au bon prix est publiée, une fois', 'clics=' + JSON.stringify(r.clics)); }
    { const { r } = await lancer('E', { recharger: true });
      dit(r.clics.pub === 1, 'E — page rechargée après le clic « Publier » (sans confirmation) : on ne reclique JAMAIS dans cet onglet', 'clics=' + JSON.stringify(r.clics)); }
    { const { r } = await lancer('F');
      dit(!r.clics.paye, 'F — une option payante en interrupteur (aria-pressed) restée allumée : rien n’est publié avec elle', 'clics=' + JSON.stringify(r.clics)); }
  } catch (e) { ko++; console.log('❌ l’audit a levé : ' + (e && e.message)); }
  await b.close(); srv.close();
  console.log(ko ? `\n❌ ${ko} contrôle(s) au rouge` : '\n✅ argent Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
