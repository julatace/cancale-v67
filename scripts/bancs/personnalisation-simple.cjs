// ── BANC : LA PERSONNALISATION PLUS SIMPLE (16 nov. 2026, lot personnalisation-simple) ─────
//        npm run build && node scripts/bancs/personnalisation-simple.cjs [dist]
//        SHOTS=dossier  BANC_PORT=…  BANC_DIST=<dist d'avant> (doit devenir ROUGE)
// Julien (iPhone) : « La personnalisation doit être plus simple. » « Modifier ma journée » refait : une liste en
// trois groupes au plus, une phrase d'en-tête, le nom seul, une poignée + ↑ ↓ + un interrupteur, enregistré tout
// de suite, « Revenir au réglage de départ » en bas. Jugé sur les `data-*` et les clés, jamais un libellé.
// Données INVENTÉES (la boutique du banc `journee-perso` : un compte Vinted, trois ventes à expédier).
//  M  MESURE : groupes ≤ 3 · une phrase d'en-tête · aucune phrase sous les noms · aucun bouton « Enregistrer » ·
//     chaque carte du catalogue (src/journeePerso.js) a ↑ ↓ (sauf les fixes) · cibles ≥ 44 px · aucun débordement ;
//     mots et touchers comptés (rapportés, pour le récit).
//  C  CACHER EN UN TOUCHER : un toucher sur l'interrupteur de « Messages » ⇒ cachée, enregistrée aussitôt
//     (`vrm_journee_perso`), Ma journée derrière suit sans fermer la feuille.
//  G  REMONTER EN GLISSANT : au doigt (390, vrais événements tactiles) / à la souris (1512), la 3e carte de « À faire »
//     glissée en tête ; puis ↑ : une place, une seule.
//  D  « Revenir au réglage de départ » : tout revient (ordre et choix), le bouton se grise.
//  A  PRÉFÉRENCES ANCIENNES (venues du NUAGE, forme du 11 nov.) : son ordre et ses choix relus tels quels ; un ordre
//     qui recopie l'ancien départ vaut le départ d'aujourd'hui (« La paire à sortir » jamais en tête).
//  T  Les textes de l'éditeur dans une autre langue (en) : aucun mot français restant dans les noms des cartes.
// L'arbre d'avant (BANC_DIST=<dist de main>) doit être ROUGE (aucune flèche, une phrase par carte, deux phrases d'en-tête).
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.BANC_DIST || process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-personnalisation-simple');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const midi = new Date(); midi.setHours(12, 0, 0, 0);
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(midi.getTime() - j * 86400000).toISOString();
const AEXP = 'Le paiement a été validé';
const PHOTO = (k) => `https://photos-banc.test/paire-${k}.png`;
const vente = (tx, titre, prix, jours) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(jours), photo: { url: PHOTO(tx) } });
const VENTES = [vente(9101, 'Nike Air Max 90 taille 42', 80, 1), vente(9102, 'Adidas Samba OG taille 41', 45, 1), vente(9103, 'Nike Dunk Low taille 44', 60, 3)];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const OV = { '9101': { numero: '117' }, '9102': { numero: '42' }, '9103': { numero: '73' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBQEBR8b1WQAAAABJRU5ErkJggg==', 'base64');
const bord = (tx, suivi, transporteur) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, ...(transporteur ? { transporteur } : {}), receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } });
const lignes = () => [
  { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
  bord(9101, 'MR00099101', 'Mondial Relay'), bord(9102, 'ZZ9102'),
];

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
async function preparer(b, vp, { theme = 'light', perso = undefined, langue = undefined } = {}) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: theme, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ROWS = lignes(); const MAIN = { vinted_dark: theme === 'dark', vinted_sale_overrides: OV, vinted_bords_printed: {}, ...(perso !== undefined ? { vrm_journee_perso: perso } : {}), ...(langue ? { vrm_langue: langue } : {}) };
  await pg.addInitScript(({ sombre, langue }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); if (langue) localStorage.setItem('vrm_langue', JSON.stringify(langue)); } catch (_) {} }, { sombre: theme === 'dark', langue: langue || null });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/photos-banc\.test/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
    return ['media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
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
  return { ctx, pg, errs };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
const attendreJournee = async (pg) => {
  await pg.waitForSelector('[data-jp-modifier]', { timeout: 30000 });
  await pg.waitForSelector('[data-fu-gestes], [data-tout-a-jour]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
};
const ouvrirEditeur = async (pg) => {
  await pg.locator('[data-jp-modifier]').scrollIntoViewIfNeeded();
  await pg.locator('[data-jp-modifier]').click();
  await pg.waitForSelector('[data-feuille-journee-perso] [data-jp-editeur]', { timeout: 10000 });
  await pg.waitForTimeout(400);
};
// Ce que montre l'éditeur, et ce qu'il coûte à lire (choix, mots, phrases).
const editeur = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-feuille-journee-perso]'); if (!f) return null;
  const ed = f.querySelector('[data-jp-editeur]'); if (!ed) return null;
  const vis = (e) => !!(e && e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
  const zones = Object.fromEntries([...ed.querySelectorAll('[data-jp-zone]')].map((z) => [z.getAttribute('data-jp-zone'), [...z.querySelectorAll('[data-jp-ligne]')].map((l) => l.getAttribute('data-jp-ligne'))]));
  const lignes = [...ed.querySelectorAll('[data-jp-ligne]')];
  const boutons = [...f.querySelectorAll('button')].filter(vis);
  const petits = boutons.filter((b) => !b.disabled).map((b) => { const r = b.getBoundingClientRect(); return { c: b.className, t: Math.min(Math.round(r.width), Math.round(r.height)) }; }).filter((x) => x.t < 44);
  // Les mots LUS (texte visible, hors lecteur d'écran) : le titre de la feuille + l'éditeur.
  const texteVu = (racine) => { const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT); let s = ''; let n; while ((n = w.nextNode())) { const p = n.parentElement; if (!p || !vis(p) || p.closest('.vrm-sr, .vrm-sr-seul, [hidden]')) continue; s += ' ' + n.textContent; } return s; };
  const mots = texteVu(f).split(/\s+/).filter((x) => /[A-Za-zÀ-ÿ0-9]/.test(x)).length;
  // Les « phrases » : un texte de 25 caractères ou plus qui n'est pas un nom de carte ni un bouton.
  const phrases = [...f.querySelectorAll('p, small, span, div')].filter(vis).filter((e) => !e.closest('.vrm-sr') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length >= 25) && !e.closest('button') && !e.classList.contains('vrm-jp-nom')).length;
  const sousTitres = lignes.filter((l) => [...l.querySelectorAll('span, small, p')].some((e) => vis(e) && !e.closest('button') && !e.classList.contains('vrm-jp-nom') && e.textContent.trim().length > 3)).length;
  return {
    zones, n: lignes.length, groupes: ed.querySelectorAll('[data-jp-groupe], .vrm-jp-zone').length,
    aides: ed.querySelectorAll('.vrm-jp-aide').length + (f.querySelector('.vrm-sheet-sous, [data-sheet-sous]') ? 1 : 0),
    sousTitreFeuille: !!(f.querySelector('[class*="sous"]') && [...f.querySelectorAll('[class*="sous"]')].some((e) => vis(e) && !ed.contains(e) && e.textContent.trim().length > 8)),
    fleches: Object.fromEntries(lignes.map((l) => [l.getAttribute('data-jp-ligne'), !!l.querySelector('[data-jp-monter]') && !!l.querySelector('[data-jp-descendre]')])),
    fixes: lignes.filter((l) => l.hasAttribute('data-jp-fixe')).map((l) => l.getAttribute('data-jp-ligne')),
    montrees: Object.fromEntries(lignes.map((l) => [l.getAttribute('data-jp-ligne'), l.getAttribute('data-jp-montree')])),
    noms: Object.fromEntries(lignes.map((l) => [l.getAttribute('data-jp-ligne'), ((l.querySelector('.vrm-jp-nom') || {}).textContent || '').trim()])),
    origine: ed.getAttribute('data-jp-origine'), departGris: !!(f.querySelector('[data-jp-origine-bouton]') || {}).disabled,
    enregistrer: boutons.filter((b) => /enregistrer|save|guardar|salva|speichern/i.test(b.textContent)).length,
    petits, mots, phrases, sousTitres, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
const lirePerso = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_journee_perso')); } catch (_) { return null; } });
// Les cartes visibles de Ma journée (derrière la feuille) : ce qui est rendu, pas ce qui est vu.
const messagesRendus = (pg) => pg.evaluate(() => [...document.querySelectorAll('.sj-journee [data-tuile="messages"]')].filter((e) => e.getClientRects().length && !e.closest('[hidden]')).length);
async function glisser(pg, tactile, id, versId) {
  await pg.locator(`[data-jp-poignee="${id}"]`).evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await pg.waitForTimeout(250);
  const a = await pg.locator(`[data-jp-poignee="${id}"]`).boundingBox();
  const b = await pg.locator(`[data-jp-ligne="${versId}"]`).boundingBox();
  const x = a.x + a.width / 2, y0 = a.y + a.height / 2, y1 = b.y + b.height * 0.2;
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
  await pg.waitForTimeout(350);
}
const toucher = async (pg, sel, tactile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (tactile) await l.tap(); else await l.click(); await pg.waitForTimeout(300); };

async function main() {
  const JP = await import(require('url').pathToFileURL(path.join(__dirname, '..', '..', 'src', 'journeePerso.js')).href).catch(() => null);
  const CARTES = JP ? JP.CARTES_JOURNEE.filter((c) => c && c.id) : [];
  const parZone = (z) => CARTES.filter((c) => c.zone === z).map((c) => c.id);
  const mobiles = (z) => CARTES.filter((c) => c.zone === z && !c.fixe).map((c) => c.id);
  const mesures = {};
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `${vp.width}px`;
      const tactile = vp.width < 600;
      await essaie('M ' + T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreJournee(pg);
        await ouvrirEditeur(pg);
        let ed = await editeur(pg);
        await shot(pg, `ps-editeur-${vp.width}`);
        mesures[T] = { cartes: ed.n, groupes: ed.groupes, mots: ed.mots, phrases: ed.phrases, sousTitres: ed.sousTitres };
        console.log(`    mesure ${T} : ${ed.n} cartes · ${ed.groupes} groupes · ${ed.mots} mots lus · ${ed.phrases} phrase(s) · ${ed.sousTitres} carte(s) avec une phrase sous le nom`);
        // ── M ──
        dit(ed.n === CARTES.length && Object.keys(ed.zones).every((z) => JSON.stringify(ed.zones[z]) === JSON.stringify(parZone(z))), `M ${T} les ${CARTES.length} cartes du catalogue, aucune perdue, à leur place de départ`, JSON.stringify(ed.zones));
        dit(ed.groupes >= 1 && ed.groupes <= 3, `M ${T} trois groupes au plus (${ed.groupes})`);
        dit(ed.aides === 1 && !ed.sousTitreFeuille && ed.phrases <= 1, `M ${T} une seule phrase d'en-tête (aucun sous-titre de feuille, aucune autre phrase)`, JSON.stringify({ aides: ed.aides, sous: ed.sousTitreFeuille, phrases: ed.phrases }));
        dit(ed.sousTitres === 0, `M ${T} le nom seul sur chaque carte (aucune phrase dessous)`, String(ed.sousTitres));
        dit(ed.enregistrer === 0, `M ${T} aucun bouton « Enregistrer » à chercher`);
        const sansFleche = CARTES.filter((c) => !c.fixe && !ed.fleches[c.id]).map((c) => c.id);
        dit(!sansFleche.length && ed.fixes.every((id) => !ed.fleches[id]), `M ${T} ↑ ↓ sur chaque carte qui se range (les fixes n'en ont pas)`, sansFleche.join(','));
        dit(!ed.petits.length, `M ${T} chaque bouton ≥ 44 px`, JSON.stringify(ed.petits.slice(0, 4)));
        dit(ed.deb <= 1, `M ${T} aucun débordement`, String(ed.deb));
        // ── C : cacher « Messages » en UN toucher ──
        const avantMsg = await messagesRendus(pg);
        await toucher(pg, '[data-jp-interrupteur="messages"]', tactile);
        ed = await editeur(pg);
        await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_journee_perso')); return p && p.choix && p.choix.messages === false; } catch (_) { return false; } }, null, { timeout: 4000 }).catch(() => {});
        const p1 = await lirePerso(pg);
        const apresMsg = await messagesRendus(pg);
        dit(ed.montrees.messages === '0' && p1 && p1.choix && p1.choix.messages === false, `C ${T} UN toucher cache « Messages », enregistré aussitôt (vrm_journee_perso)`, JSON.stringify({ m: ed.montrees.messages, p: p1 }));
        dit(avantMsg > 0 && apresMsg === 0, `C ${T} Ma journée derrière suit tout de suite (aperçu direct, la feuille ouverte)`, `${avantMsg} → ${apresMsg}`);
        // ── G : remonter en glissant la 3e carte de « À faire » en tête, puis ↑ ──
        const mob = mobiles('afaire'), cible = mob[2];
        await glisser(pg, tactile, cible, mob[0]);
        ed = await editeur(pg);
        const mobVus = ed.zones.afaire.filter((id) => !ed.fixes.includes(id));
        dit(mobVus[0] === cible, `G ${T} ${tactile ? 'au doigt' : 'à la souris'} : « ${cible} » glissée en tête de « À faire »`, mobVus.slice(0, 4).join(','));
        await shot(pg, `ps-editeur-modifie-${vp.width}`);
        const c2 = mobVus[3];
        await toucher(pg, `[data-jp-monter="${c2}"]`, tactile);
        ed = await editeur(pg);
        const mob2 = ed.zones.afaire.filter((id) => !ed.fixes.includes(id));
        dit(mob2.indexOf(c2) === 2 && mob2[3] === mobVus[2], `G ${T} ↑ : « ${c2} » monte d'UNE place`, mob2.slice(0, 5).join(','));
        const p2 = await lirePerso(pg);
        dit(p2 && Array.isArray(p2.ordre) && p2.ordre.indexOf(cible) >= 0 && p2.ordre.indexOf(cible) < p2.ordre.indexOf(mob[0]), `G ${T} l'ordre est enregistré`, JSON.stringify(p2 && p2.ordre));
        // ── D : revenir au départ ──
        await toucher(pg, '[data-jp-origine-bouton]', tactile);
        ed = await editeur(pg);
        await shot(pg, `ps-editeur-depart-${vp.width}`);
        dit(ed.origine === '1' && ed.departGris && ed.montrees.messages === '1' && JSON.stringify(ed.zones.afaire) === JSON.stringify(parZone('afaire')), `D ${T} « Revenir au réglage de départ » : ordre et choix reviennent, le bouton se grise`, JSON.stringify({ o: ed.origine, g: ed.departGris, m: ed.montrees.messages }));
        dit(!errs.length, `M ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      // ── A : préférences anciennes, venues du nuage ──
      await essaie('A ' + T, async () => {
        const ancien = { v: 1, ordre: ['frise', 'phrase', 'prochain', 'messages', 'ailleurs', 'envoyer'], choix: { prix: true, retirer: false, guide: false }, at: '2026-11-12T08:00:00.000Z' };
        const { ctx, pg, errs } = await preparer(b, vp, { perso: ancien });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreJournee(pg);
        await ouvrirEditeur(pg);
        const ed = await editeur(pg);
        await shot(pg, `ps-ancien-${vp.width}`);
        const af = ed.zones.afaire.filter((id) => !ed.fixes.includes(id));
        dit(ed.zones.tete.join() === 'frise,phrase,prochain,chiffres' && af[0] === 'messages' && af.indexOf('ailleurs') < af.indexOf('envoyer') && ed.montrees.prix === '1' && ed.montrees.retirer === '0' && ed.montrees.guide === '0' && ed.origine === '0',
          `A ${T} réglage du 12 nov. (nuage) : son ordre et ses choix relus tels quels`, JSON.stringify({ tete: ed.zones.tete, af: af.slice(0, 4), m: [ed.montrees.prix, ed.montrees.retirer, ed.montrees.guide] }));
        dit(ed.zones.bas && ed.zones.bas[0] === 'sortir' && !ed.zones.tete.includes('sortir'), `A ${T} « La paire à sortir » (neuve) arrive en tête de « En bas », jamais « En haut »`, JSON.stringify(ed.zones.bas));
        dit(!errs.length, `A ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
        // L'ancien départ recopié (l'ordre complet d'avant le 16 nov., sans « sortir ») vaut le départ d'aujourd'hui.
        const vieuxDepart = { v: 1, ordre: mobiles('tete').concat(mobiles('afaire'), mobiles('bas')).filter((id) => id !== 'sortir'), choix: { messages: false } };
        const o2 = await preparer(b, vp, { perso: vieuxDepart });
        await o2.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreJournee(o2.pg); await ouvrirEditeur(o2.pg);
        const e2 = await editeur(o2.pg);
        dit(e2.montrees.messages === '0' && JSON.stringify(e2.zones.bas) === JSON.stringify(parZone('bas')) && JSON.stringify(e2.zones.afaire) === JSON.stringify(parZone('afaire')), `A ${T} un ordre qui recopie l'ancien départ vaut le départ d'aujourd'hui (son choix « Messages caché » reste)`, JSON.stringify({ bas: e2.zones.bas, m: e2.montrees.messages }));
        await o2.ctx.close();
      });
    }
    // ── T : une autre langue ──
    await essaie('T', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, { langue: 'en' });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await attendreJournee(pg); await ouvrirEditeur(pg);
      await pg.waitForTimeout(600);
      const ed = await editeur(pg);
      await shot(pg, 'ps-editeur-390-en');
      const fr = CARTES.filter((c) => ed.noms[c.id] === c.nom && !/^(Messages|URSSAF)/.test(c.nom)).map((c) => c.id);
      dit(!fr.length && ed.noms.envoyer && ed.noms.envoyer !== 'Colis à envoyer', 'T en anglais : les noms des cartes sont traduits (aucun reste en français)', fr.join(','));
      dit(!errs.length, 'T aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });
  } finally { await b.close(); srv.close(); }
  console.log(`\n    mesures : ${JSON.stringify(mesures)}`);
  console.log(`\n${ko ? '❌' : '✅'} personnalisation-simple : ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
