// ── BANC : CHACUN COMPOSE SA MA JOURNÉE (11 nov. 2026, lot journee-perso) ────
//        npm run build && node scripts/bancs/journee-perso.cjs [dist]
//        SHOTS=dossier  BANC_PORT=4483  JP_MUTATION=1 (doit devenir rouge)
// Données INVENTÉES (le dépôt est public), la boutique du banc `journee-v2` : un compte
// Vinted, trois ventes à expédier (aucune en retard). Variante « urgent » : une 4e vente
// vieille de 9 jours (en retard : un geste DÛ). Jugé sur les `data-*`, jamais un libellé.
//  D  Sans réglage : Ma journée d'avant. « Modifier ma journée » (44 px) ouvre l'éditeur ;
//     une carte cachée quitte l'écran, son compteur reste publié (bloc caché `data-tuile`),
//     « N gestes » ne la compte plus, la tête suit SON ordre ; aucun débordement.
//  E  L'éditeur : 17 cartes, trois zones, cibles 44 px ; l'interrupteur ; « Revenir au
//     réglage d'origine » remet tout.
//  K  Au clavier : flèche haut, Début, Fin ; le focus reste sur la poignée ; c'est annoncé.
//  G  Au doigt (390, vrais événements tactiles) et à la souris (1512) : glisser une poignée.
//  O  Enregistré (`vrm_journee_perso`), envoyé au nuage, toujours là au rechargement.
//  U  INTOUCHABLE : « à envoyer » cachée (réglage venu du NUAGE) mais un colis en retard ⇒
//     affichée, en tête, « Affichée car urgent » ; la frise cachée reste rendue, cachée.
//  P  Paramètres → Affichage → Ma journée : le même éditeur, le même réglage.
// MUTATION (JP_MUTATION=1, données) : la vente « en retard » n'a plus que 2 jours ⇒ rien
// d'urgent ⇒ la carte cachée ne doit PAS revenir ⇒ U ROUGE.
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4483);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-journee-perso');
const MUTATION = process.env.JP_MUTATION === '1';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const midi = new Date(); midi.setHours(12, 0, 0, 0);
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(midi.getTime() - j * 86400000).toISOString();
const AEXP = 'Le paiement a été validé';
const PHOTO = (k) => `https://photos-banc.test/paire-${k}.png`;
const vente = (tx, titre, prix, jours) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(jours), photo: { url: PHOTO(tx) } });
const VENTES_BASE = [vente(9101, 'Nike Air Max 90 taille 42', 80, 1), vente(9102, 'Adidas Samba OG taille 41', 45, 1), vente(9103, 'Nike Dunk Low taille 44', 60, 3)];
// URGENT : la même boutique, plus une vente vieille de 9 jours (en retard : un geste DÛ). Mutation : elle n'est plus en retard.
const VENTE_RETARD = vente(9104, 'Asics Gel 1130 taille 43', 70, MUTATION ? 2 : 9);
let VENTES = VENTES_BASE;
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const OV = { '9101': { numero: '117' }, '9102': { numero: '42' }, '9103': { numero: '73' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBQEBR8b1WQAAAABJRU5ErkJggg==', 'base64');
const bord = (tx, suivi, transporteur) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, ...(transporteur ? { transporteur } : {}), receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } });
function lignes() {
  return [
    { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
    bord(9101, 'MR00099101', 'Mondial Relay'), bord(9102, 'ZZ9102'),
  ];
}
// Les attendus, faits À LA MAIN (jamais par le code de l'app).
const jourDe = (iso) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime(); };
const isoJour = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const venduDu = (t0) => VENTES.filter((v) => jourDe(v.date) === t0).reduce((s, v) => s + Number(v.price.amount), 0);
const auj0 = jourDe(new Date().toISOString());
const J1 = auj0 - 86400000, J3 = auj0 - 3 * 86400000;
const lundiCourant = (() => { const d = new Date(auj0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
const lundiPasse = (() => { const d = new Date(lundiCourant); d.setDate(d.getDate() - 7); return d.getTime(); })();
const venduSemaine = VENTES.filter((v) => { const t = Date.parse(v.date); return t >= lundiPasse && t < lundiCourant; }).reduce((s, v) => s + Number(v.price.amount), 0);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = new Date(MAINTENANT).toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
async function preparer(b, vp, { theme = 'light', reduit = false, urgent = false, perso = undefined, persoLocal = undefined } = {}) {
  VENTES = urgent ? [...VENTES_BASE, VENTE_RETARD] : VENTES_BASE;
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, reducedMotion: reduit ? 'reduce' : 'no-preference', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ROWS = lignes(); const MAIN = { vinted_dark: theme === 'dark', vinted_sale_overrides: OV, vinted_bords_printed: {}, ...(perso !== undefined ? { vrm_journee_perso: perso } : {}) };
  const ecrits = [];
  if (persoLocal !== undefined) await pg.addInitScript((p) => { try { if (!sessionStorage.getItem('jp_pose')) { localStorage.setItem('vrm_journee_perso', JSON.stringify(p)); sessionStorage.setItem('jp_pose', '1'); } } catch (_) {} }, persoLocal);
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); } catch (_) {} }, theme === 'dark');
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/photos-banc\.test/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
    return ['media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { ecrits.push(route.request().postData() || ''); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
const attendreJournee = async (pg) => {
  await pg.waitForSelector('[data-jp-modifier]', { timeout: 30000 });
  await pg.waitForSelector('[data-fu-gestes], [data-tout-a-jour]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
};
// Ce que montre Ma journée : les cartes VISIBLES (dans l'ordre de la page), le bloc caché, la tête.
const etat = (pg) => pg.evaluate(() => {
  const vis = (e) => !!(e && e.getClientRects().length);
  const cartes = [...document.querySelectorAll('[data-tuile], [data-job], [data-vendus-ailleurs], [data-stock-sortie], [data-cycle-groupe]')].filter(vis)
    .map((e) => e.getAttribute('data-tuile') || e.getAttribute('data-job') || 'autre');
  const cachees = Object.fromEntries([...document.querySelectorAll('[hidden] [data-tuile]')].map((e) => [e.getAttribute('data-tuile'), e.getAttribute('data-n')]));
  const tete = document.querySelector('.vrm-fu-tete');
  // La carte des chiffres peut n'avoir aucune boîte à elle (ses cases sont posées par la grille) : « montrée » = pas dans un bloc caché.
  const ordreTete = tete ? [...tete.querySelectorAll('[data-jv2-prochain], [data-jv2-argent], [data-carte-stats="journee"], [data-phrase-jour], .vrm-fu-phrase-tete')].filter((e) => !e.closest('[hidden]') && (e.hasAttribute('data-carte-stats') || vis(e))).map((e) => e.hasAttribute('data-jv2-prochain') ? 'prochain' : e.hasAttribute('data-jv2-argent') ? 'frise' : e.hasAttribute('data-carte-stats') ? 'chiffres' : 'phrase') : [];
  const force = [...document.querySelectorAll('[data-jp-force]')].filter(vis).map((e) => ({ id: e.getAttribute('data-tuile'), texte: e.innerText, prochain: e.hasAttribute('data-prochain') }));
  const g = document.querySelector('[data-fu-gestes]');
  const nc = document.querySelector('[data-jp-n-cachees]');
  const rien = document.querySelector('[data-jp-rien-affiche]');
  return { cartes, cachees, ordreTete: [...new Set(ordreTete)], force, gestes: g ? Number(g.getAttribute('data-fu-gestes')) : rien ? 0 : null, nCachees: nc ? Number(nc.getAttribute('data-jp-n-cachees')) : 0,
    friseCachee: !!document.querySelector('[data-jp-cachee="frise"] [data-jv2-argent]'), deb: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
const editeur = (pg, sel = '[data-feuille-journee-perso]') => pg.evaluate((sel) => {
  const f = document.querySelector(sel); if (!f) return null;
  const zones = Object.fromEntries([...f.querySelectorAll('[data-jp-zone]')].map((z) => [z.getAttribute('data-jp-zone'), [...z.querySelectorAll('[data-jp-ligne]')].map((l) => l.getAttribute('data-jp-ligne'))]));
  const tailles = [...f.querySelectorAll('[data-jp-poignee], [data-jp-interrupteur]')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(Math.round(r.width), Math.round(r.height)); });
  const ed = f.querySelector('[data-jp-editeur]');
  return { zones, petit: Math.min(...tailles), n: f.querySelectorAll('[data-jp-ligne]').length, origine: ed && ed.getAttribute('data-jp-origine'), montrees: Object.fromEntries([...f.querySelectorAll('[data-jp-ligne]')].map((l) => [l.getAttribute('data-jp-ligne'), l.getAttribute('data-jp-montree')])), annonce: (f.querySelector('[data-jp-annonce]') || {}).textContent || '', focus: document.activeElement && document.activeElement.getAttribute('data-jp-poignee') };
}, sel);
const lirePerso = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_journee_perso')); } catch (_) { return null; } });
// Glisser une poignée : au DOIGT (événements tactiles CDP ⇒ pointeurs « touch ») ou à la souris.
async function glisser(pg, tactile, id, versId) {
  const a = await pg.locator(`[data-jp-poignee="${id}"]`).boundingBox();
  const b = await pg.locator(`[data-jp-ligne="${versId}"]`).boundingBox();
  const x = a.x + a.width / 2, y0 = a.y + a.height / 2, y1 = b.y + b.height * 0.8;
  if (tactile) {
    const cdp = await pg.context().newCDPSession(pg);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * k / 8 }] }); await pg.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await pg.mouse.move(x, y0); await pg.mouse.down();
    for (let k = 1; k <= 8; k++) { await pg.mouse.move(x, y0 + (y1 - y0) * k / 8); await pg.waitForTimeout(30); }
    await pg.mouse.up();
  }
  await pg.waitForTimeout(300);
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['light', 'dark']) {
      const T = `${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      const tactile = vp.width < 600;
      // ── D / E / K / G / O : l'éditeur, de bout en bout ──────────────────────
      await essaie('D ' + T, async () => {
        const { ctx, pg, errs, ecrits } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreJournee(pg);
        const e0 = await etat(pg);
        await shot(pg, `jp-origine-${vp.width}-${theme}`);
        dit(e0.cartes.includes('envoyer') && e0.cachees.envoyer === undefined && e0.nCachees === 0 && e0.ordreTete.join() === 'phrase,prochain,frise,chiffres', `D ${T} sans réglage : Ma journée d'avant (« à envoyer » affichée, tête dans l'ordre d'origine, rien de caché)`, JSON.stringify({ cartes: e0.cartes, tete: e0.ordreTete, nc: e0.nCachees }));
        await pg.locator('[data-jp-modifier]').scrollIntoViewIfNeeded();
        const mb = await pg.locator('[data-jp-modifier]').boundingBox();
        dit(mb && mb.height >= 44, `D ${T} « Modifier ma journée » se touche (44 px)`, mb ? String(Math.round(mb.height)) : 'absent');
        await pg.locator('[data-jp-modifier]').click();
        await pg.waitForSelector('[data-feuille-journee-perso] [data-jp-editeur]', { timeout: 10000 });
        await pg.waitForTimeout(400);
        let ed = await editeur(pg);
        await shot(pg, `jp-editeur-${vp.width}-${theme}`);
        dit(ed && ed.n === 17 && ed.zones.tete.join() === 'phrase,prochain,frise,chiffres' && ed.origine === '1', `E ${T} l'éditeur : 17 cartes en trois zones, au réglage d'origine`, JSON.stringify(ed && ed.zones));
        dit(ed && ed.petit >= 44, `E ${T} poignées et interrupteurs : 44 px au moins`, String(ed && ed.petit));
        // Cacher « Colis à envoyer » (rien d'urgent dans ces données) ⇒ la carte part, son compteur reste publié.
        await pg.locator('[data-jp-interrupteur="envoyer"]').click(); await pg.waitForTimeout(300);
        ed = await editeur(pg);
        dit(ed.montrees.envoyer === '0' && ed.origine === '0', `E ${T} l'interrupteur cache « Colis à envoyer »`, JSON.stringify({ m: ed.montrees.envoyer, o: ed.origine }));
        // K — au clavier : « Les chiffres du mois » remonte d'un cran (flèche haut), le focus reste sur sa poignée, c'est annoncé.
        await pg.locator('[data-jp-poignee="chiffres"]').focus();
        await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(250);
        ed = await editeur(pg);
        dit(ed.zones.tete.join() === 'phrase,prochain,chiffres,frise' && ed.focus === 'chiffres' && /3/.test(ed.annonce), `K ${T} flèche haut : « chiffres » avant « frise », le focus reste sur la poignée, annoncé`, JSON.stringify({ tete: ed.zones.tete, focus: ed.focus, annonce: ed.annonce }));
        await pg.keyboard.press('Home'); await pg.waitForTimeout(250);
        ed = await editeur(pg);
        dit(ed.zones.tete[0] === 'chiffres' && ed.focus === 'chiffres', `K ${T} Début : en tête de sa zone`, JSON.stringify(ed.zones.tete));
        await pg.keyboard.press('End'); await pg.waitForTimeout(250);
        await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(250);
        ed = await editeur(pg);
        dit(ed.zones.tete.join() === 'phrase,prochain,chiffres,frise', `K ${T} Fin puis haut : avant-dernière`, JSON.stringify(ed.zones.tete));
        // G — au doigt (390) / à la souris (1512) : « Messages » glissé sous « Prix à baisser ».
        const avantG = ed.zones.afaire.slice();
        await glisser(pg, tactile, 'messages', 'prix');
        ed = await editeur(pg);
        const attendu = (() => { const x = avantG.filter((i) => i !== 'messages'); x.splice(x.indexOf('prix') + 1, 0, 'messages'); return x.join(); })();
        dit(ed.zones.afaire.join() === attendu, `G ${T} ${tactile ? 'au doigt' : 'à la souris'} : « Messages » glissé sous « Prix à baisser »`, ed.zones.afaire.join());
        await shot(pg, `jp-editeur-modifie-${vp.width}-${theme}`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        if (await pg.locator('[data-feuille-journee-perso]').count()) { await pg.locator('[data-feuille-journee-perso] button[aria-label="Fermer"], [data-feuille-journee-perso] [data-sheet-fermer]').first().click().catch(() => {}); await pg.waitForTimeout(400); }
        const e1 = await etat(pg);
        await shot(pg, `jp-modifiee-${vp.width}-${theme}`);
        dit(!e1.cartes.includes('envoyer') && e1.cachees.envoyer === '3' && e1.nCachees === 1, `D ${T} « à envoyer » cachée : plus à l'écran, son compteur reste publié (bloc caché, 3)`, JSON.stringify({ cartes: e1.cartes, cachees: e1.cachees, nc: e1.nCachees }));
        dit(e0.gestes != null && e1.gestes === e0.gestes - 1, `D ${T} « N gestes » ne compte plus la carte cachée (${e0.gestes} ⇒ ${e0.gestes - 1})`, String(e1.gestes));
        dit(e1.ordreTete.join() === 'phrase,chiffres,frise' || e1.ordreTete.join() === 'phrase,prochain,chiffres,frise', `D ${T} la tête suit SON ordre (chiffres avant la frise)`, e1.ordreTete.join());
        // O — enregistré, synchronisé, et toujours là au rechargement.
        await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_journee_perso')); return p && p.choix && p.choix.envoyer === false; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
        const p = await lirePerso(pg);
        for (let k = 0; k < 40 && !ecrits.some((t) => /vrm_journee_perso/.test(t)); k++) await pg.waitForTimeout(250);
        dit(p && p.choix && p.choix.envoyer === false && Array.isArray(p.ordre) && p.ordre.indexOf('chiffres') < p.ordre.indexOf('frise'), `O ${T} le réglage est enregistré (vrm_journee_perso)`, JSON.stringify(p));
        dit(ecrits.some((t) => /vrm_journee_perso/.test(t)), `O ${T} et envoyé au nuage (synchronisé par compte)`, String(ecrits.length) + ' écritures');
        await pg.reload({ waitUntil: 'domcontentloaded' }); await attendreJournee(pg);
        const e2 = await etat(pg);
        dit(!e2.cartes.includes('envoyer') && e2.cachees.envoyer === '3', `O ${T} rechargé : toujours cachée`, JSON.stringify(e2.cartes));
        // « Revenir au réglage d'origine ».
        await pg.locator('[data-jp-modifier]').click(); await pg.waitForSelector('[data-feuille-journee-perso] [data-jp-origine-bouton]');
        await pg.locator('[data-jp-origine-bouton]').click(); await pg.waitForTimeout(400);
        ed = await editeur(pg);
        dit(ed.origine === '1' && ed.zones.tete.join() === 'phrase,prochain,frise,chiffres' && ed.montrees.envoyer === '1', `E ${T} « Revenir au réglage d'origine » : tout revient`, JSON.stringify({ o: ed.origine, tete: ed.zones.tete }));
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        const e3 = await etat(pg);
        dit(e3.cartes.includes('envoyer') && e3.ordreTete.join() === e0.ordreTete.join() && e3.gestes === e0.gestes, `E ${T} Ma journée redevient celle d'origine`, JSON.stringify({ cartes: e3.cartes, tete: e3.ordreTete, g: e3.gestes }));
        dit(e0.deb <= 1 && e1.deb <= 1, `D ${T} aucun débordement`, `${e0.deb}/${e1.deb}`);
        dit(!errs.length, `D ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      // ── U : intouchable — cachée mais urgente ⇒ affichée, en tête, « affichée car urgent » ──
      await essaie('U ' + T, async () => {
        // Le réglage arrive par le NUAGE (posé sur un autre appareil) : « à envoyer » cachée, frise cachée.
        const { ctx, pg, errs } = await preparer(b, vp, { theme, urgent: true, perso: { v: 1, ordre: [], choix: { envoyer: false, frise: false } } });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreJournee(pg);
        await pg.waitForFunction(() => !!document.querySelector('[data-jp-cachee="frise"]'), null, { timeout: 15000 }).catch(() => {});
        const e = await etat(pg);
        await shot(pg, `jp-urgent-${vp.width}-${theme}`);
        const f = e.force.find((x) => x.id === 'envoyer');
        dit(!!f && /urgent/i.test(f.texte), `U ${T} « à envoyer » cachée mais un colis est en retard : affichée, « Affichée car urgent »`, JSON.stringify(e.force));
        const iAl = e.cartes.lastIndexOf('colis-en-retard'), iEnv = e.cartes.indexOf('envoyer');
        dit(iEnv >= 0 && e.cartes.slice(0, iEnv).every((c) => c !== 'envoyer' && !['messages', 'prix'].includes(c)) && (iAl < 0 || iAl < iEnv || (f && f.prochain)), `U ${T} elle vient en tête (après les seules alertes urgentes)`, e.cartes.join(','));
        dit(e.friseCachee && !e.ordreTete.includes('frise'), `U ${T} le réglage venu du nuage s'applique (frise cachée, toujours rendue dans un bloc caché)`, JSON.stringify({ fc: e.friseCachee, tete: e.ordreTete }));
        dit(!errs.length, `U ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
    // ── P : Paramètres → Affichage → Ma journée : le même éditeur, le même réglage ──
    await essaie('P', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, { theme: 'light' });
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
      const ligne = pg.locator('[data-reglage-journee-perso]').first();
      await ligne.waitFor({ timeout: 20000 }); await ligne.click();
      await pg.waitForSelector('[data-jp-editeur]', { timeout: 10000 }); await pg.waitForTimeout(400);
      await shot(pg, 'jp-parametres-390-light');
      await pg.locator('[data-jp-interrupteur="frise"]').click(); await pg.waitForTimeout(1200);
      const p = await lirePerso(pg);
      dit(!!(p && p.choix && p.choix.frise === false), 'P Paramètres → Affichage → Ma journée : le même réglage (frise cachée)', JSON.stringify(p));
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await attendreJournee(pg);
      const e = await etat(pg);
      dit(!e.ordreTete.includes('frise') && e.friseCachee, 'P … et Ma journée le suit', JSON.stringify(e.ordreTete));
      dit(!errs.length, 'P aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} journee-perso : ${ko} rouge(s)${MUTATION ? ' (MUTATION : doit être rouge)' : ''} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
