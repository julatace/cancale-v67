// ── BANC : LE TRANSPORTEUR À CÔTÉ DU BOUTON BORDEREAU (2 nov.) ────────────────
// Julien : « quand je fais une vente, je veux qu'à côté du bouton bordereau, ça
// soit marqué Chronopost avec le logo Chronopost ou Mondial Relay avec le logo
// Mondial Relay. Que ça soit pour les ventes et les achats… ça peut être dans
// Colis, mais pas dans les choses à expédier » ; « dans les colis je veux que tu
// mettes les transporteurs, après on fera des stats ».
// (Le banc `transporteurs.cjs` existant juge autre chose : le STATUT lu chez le
// transporteur. Celui-ci juge QUI transporte, et comment c'est montré.)
// Données INVENTÉES (dépôt public), à la forme mesurée des vraies lignes
// (`email_bord_*` : `suivi` en meta, aucun champ transporteur ; `transp_*` ;
// `email_track_*` ; `vc_achats`) :
//   · 8001 bordereau n° XW…FR (forme Chronopost stricte)      ⇒ Chronopost ;
//   · 8002 bordereau n° 8 chiffres (forme Mondial Relay)       ⇒ Mondial Relay ;
//   · 8003 bordereau SANS n°                                   ⇒ « Transporteur pas lu », sans logo ;
//   · 8004 n° de 16 chiffres (ambigu) + ligne lue chez Vinted Go ⇒ Vinted Go ;
//   · 8005 n° de 14 chiffres (ambigu) + e-mail Chronopost du même n° (dépôt) ⇒ Chronopost, dans le récapitulatif ;
//   · achats à retirer : e-mail Mondial Relay, e-mail Chronopost, achat Vinted
//     dont la conversation ne nomme aucun transporteur (⇒ « pas lu ») ;
//   · Vestiaire : un achat en route (Chronopost) et un sans transporteur.
// Exige, à 390 px tactile clair et 1512 px sombre :
//   E1 chaque vente à envoyer porte SON transporteur (`data-transporteur`) ;
//   E2 la pastille est DANS la rangée du bouton bordereau, juste après lui ;
//   E3 « pas lu » : le texte « Transporteur pas lu », aucune image ;
//   E4 le logo est demandé au domaine officiel du transporteur, et seulement là ;
//      une image qui échoue (le réseau du banc est fermé) ne laisse AUCUNE image
//      cassée, le nom reste ;
//   A1 les colis à retirer portent leur transporteur et le montrent (logo + nom) ;
//   A2 les achats en route ne sont PAS dans « À envoyer » ; ils sont sous
//      « À retirer », avec leur transporteur ;
//   R1 le récapitulatif d'une vente à envoyer montre le transporteur à côté du
//      bouton bordereau ; R2 une vente déjà déposée le dit dans ses détails ;
//   et : aucune erreur, aucun débordement horizontal. Captures dans SHOTS.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4421);
const SHOTS = process.env.SHOTS || os.tmpdir();

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const dans = (j) => new Date(M + j * 86400000).toISOString().slice(0, 10);
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const v = (tx, titre, j) => ({ transaction_id: tx, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(j), item_id: 'an' + tx });
const VENTES = [v(8001, 'Adidas Samba OG taille 41', 0.2), v(8002, 'Nike Air Max 90 taille 42', 0.4), v(8003, 'Nike Dunk Low taille 44', 0.6), v(8004, 'New Balance 550 taille 43', 0.8), v(8005, 'Asics Gel-1130 taille 40', 1)];
// 8005 : son e-mail de DÉPÔT (sortant) le fait partir de « À envoyer » ; son transporteur se juge au récapitulatif (R2).
const ATTENDU_V = { 8001: 'chronopost', 8002: 'mondialrelay', 8003: 'pas-lu', 8004: 'vinted' };
const SUIVI_V = { 8001: 'XW123456789FR', 8002: '12345678', 8003: '', 8004: '1234567890123456', 8005: '04100000000009' };
const ACHATS = [{ transaction_id: 9501, conversation_id: 7901, title: 'Vans Old Skool taille 41', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(2) }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const transp = (carrier, suivi, o) => ({ id: `transp_${carrier}_${suivi}`, data: { v: 1, rev: 1, carrier, suivi, etat: 'en_route', detail: null, etatAt: ilYa(0.5), libelle: 'En cours d’acheminement', lieuNom: '', lieuVille: '', lieuCp: '', limite: null, limiteSure: false, lu: ilYa(0.05), source: 'serveur', essai: ilYa(0.05), essaiRes: 'ok', essais: 1, voie: 'vg-v3', fini: false, ...o } });
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: Object.fromEntries(VENTES.map((x, i) => ['an' + x.transaction_id, { numero: String(301 + i), title: x.title, price: 50 }])) } },
  { id: 'panel_colis_relais', data: { 9501: { code: '418205', lieu: 'Locker Test, 4 Rue Exemple, 99999 Testville', at: iso(M), url: 'https://www.vinted.fr/inbox/7901' } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), payload: { my_orders: ACHATS } } },
  ...VENTES.map((x) => ({ id: `email_bord_${x.transaction_id}`, data: { type: 'bordereau', transaction: String(x.transaction_id), filename: `bordereau_${x.transaction_id}.pdf`, suivi: SUIVI_V[x.transaction_id], receivedAt: iso(M - 3 * 3600e3), pdfB64: 'JVBERi0xLjQK' } })),
  transp('vinted', '1234567890123456'),
  { id: 'email_track_chronopost_04100000000009', data: { type: 'suivi', carrier: 'chronopost', suivi: '04100000000009', status: 'transit', statusLabel: 'En transit', sens: 'sortant', subject: 'Preuve de dépôt de votre colis', receivedAt: ilYa(0.1) } },
  { id: 'email_track_mondialrelay_55500002', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '55500002', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '445566', lieu: 'Tabac Test, 29 Rue Exemple, 99998 Testbourg', limite: dans(3) } },
  { id: 'email_track_chronopost_XW000111222FR', data: { type: 'suivi', carrier: 'chronopost', suivi: 'XW000111222FR', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '778899', lieu: 'Relais Test, 11 Rue Exemple, 99997 Testcourt', limite: dans(4) } },
  { id: 'vc_achats', data: { achats: {
    A1: { nom: 'Nike Dunk Low (Vestiaire)', etat: 'shipped', suivi: 'XW123123123FR', transporteur: 'Chronopost' },
    A3: { nom: 'Adidas Gazelle (Vestiaire)', etat: 'shipped', suivi: 'ZZ00000001', transporteur: '' } } } },
];
const ATTENDU_R = { 'r:e:55500002': 'mondialrelay', 'r:e:XW000111222FR': 'chronopost', 'r:v:9501': 'pas-lu' };
const ATTENDU_VC = { A1: 'chronopost', A3: 'pas-lu' };
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
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
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
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x === 'object' ? JSON.stringify(x) : (/->>/.test(src) && typeof x !== 'string' ? String(x) : x));
  }
  return out;
};

// Les pastilles d'un conteneur : clé, texte, images (visibles ou non, chargées ou non).
const PASTILLES = `(racine) => [...racine.querySelectorAll('.vrm-transporteur')].map((p) => ({
  cle: p.getAttribute('data-transporteur'), txt: p.innerText.trim(),
  imgs: [...p.querySelectorAll('img')].map((i) => { const vis = !!i.closest('[data-transporteur-logo="charge"]') && i.getClientRects().length > 0; return { src: i.getAttribute('src'), vis, ok: i.complete && i.naturalWidth > 0 }; }),
}))`;

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const logos = [];
  await pg.addInitScript(`window.__P = ${PASTILLES};`);
  // ⚠️ Playwright n'intercepte JAMAIS une adresse finissant par « /favicon.ico » (il les
  // écarte exprès) : le banc ne peut pas SERVIR le logo. Il relève donc chaque image
  // de logo POSÉE dans une pastille (son adresse) ; ici le réseau est fermé, elle
  // échoue, et la pastille doit retomber proprement sur le nom.
  await pg.addInitScript(() => { window.__logos = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; for (const i of (n.matches && n.matches('img') ? [n] : n.querySelectorAll ? [...n.querySelectorAll('img')] : [])) if (i.closest('[data-transporteur-logo]')) window.__logos.push(i.getAttribute('src')); } }).observe(document, { childList: true, subtree: true }); });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
        if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
    if (['image', 'media', 'font'].includes(r.request().resourceType())) { logos.push(u); return r.abort(); }
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, logos };
}

const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const T = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
      console.log(`── ${T}`);
      const { ctx, pg, errs, logos } = await preparer(b, vp, sombre);
      await essaie(T + ' Colis → À envoyer', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-colis-onglet-choix="envoyer"]', { timeout: 20000 });
        await pg.click('[data-colis-onglet-choix="envoyer"]');
        await pg.waitForSelector('[data-bord-card][data-tx-colis="8001"]', { timeout: 20000 });
        await pg.waitForTimeout(2500);
        const r = await pg.evaluate(() => {
          const P2 = window.__P;
          return [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].map((c) => {
            // (2 nov., 21 h 36 puis 22 h, Julien) La puce n'est plus « juste après » le bouton : elle est
            // À GAUCHE de lui, dans la MÊME rangée (`.vrm-rangee-bord`) ; sur la carte Colis (maquette
            // FusionColis), le transporteur est dit par l'EN-TÊTE du groupe, la puce de la rangée
            // restant dans le DOM. E2 juge donc : la puce et le bouton bordereau dans la même rangée,
            // la puce d'abord, et l'en-tête du groupe au même transporteur.
            const act = c.querySelector('.vrm-colis-actions'); const rg = act && act.querySelector('.vrm-rangee-bord');
            const p = rg && rg.querySelector(':scope > .vrm-transporteur');
            const bouton = rg && [...rg.children].find((x) => x !== p);
            let h = c.previousElementSibling; while (h && !h.hasAttribute('data-groupe-transp')) h = h.previousElementSibling;
            const nomP = p ? ((p.querySelector('[data-transporteur-nom]') || p).textContent || '').trim() : '';
            const nomG = h ? h.getAttribute('data-groupe-transp') : '';
            return { tx: c.getAttribute('data-tx-colis'), carte: c.getAttribute('data-transporteur'), pastilles: P2(act || c),
              apresBouton: !!(p && bouton && (p.compareDocumentPosition(bouton) & Node.DOCUMENT_POSITION_FOLLOWING) && (bouton.matches('[data-imprime], [data-bouton-bord], .vrm-fu-principal, button') || bouton.querySelector('button'))),
              memeRangee: !!(p && bouton && p.parentElement === bouton.parentElement && (nomG === nomP || (nomG === 'Autres' && /pas lu/i.test(nomP)))) };
          });
        });
        const envoyer = await pg.evaluate(() => ({ route: document.querySelectorAll('[data-vc-route]').length }));
        for (const [tx, cle] of Object.entries(ATTENDU_V)) {
          const c = r.find((x) => x.tx === tx);
          dit(c && c.carte === cle, `${T} E1 vente ${tx} : transporteur « ${cle} » sur la carte`, c ? c.carte : 'carte absente');
          const p = c && c.pastilles[0];
          dit(p && p.cle === cle && c.apresBouton && c.memeRangee, `${T} E2 vente ${tx} : la puce à gauche du bouton bordereau, même rangée, sous l'en-tête de son transporteur`, JSON.stringify(c && { p, apres: c.apresBouton, rangee: c.memeRangee }));
        }
        const pasLu = r.find((x) => x.tx === '8003'), p3 = pasLu && pasLu.pastilles[0];
        dit(p3 && /^Transporteur pas lu$/.test(p3.txt) && p3.imgs.length === 0, `${T} E3 « Transporteur pas lu », sans aucune image`, JSON.stringify(p3));
        const ch = r.find((x) => x.tx === '8001').pastilles[0];
        const poses = await pg.evaluate(() => [...new Set(window.__logos)]);
        dit(ch && /Chronopost/.test(ch.txt) && poses.includes('https://www.chronopost.fr/favicon.ico') && poses.every((u) => /^https:\/\/(www\.)?(chronopost\.fr|mondialrelay\.fr|vintedgo\.com)\/favicon\.ico$/.test(u)), `${T} E4 logos demandés à leurs domaines officiels seulement`, JSON.stringify(poses));
        dit(ch && /^Chronopost$/.test(ch.txt) && !ch.imgs.some((i) => i.vis && !i.ok), `${T} E4 logo Chronopost injoignable : « Chronopost » reste, aucune image cassée`, JSON.stringify(ch));
        const mr = r.find((x) => x.tx === '8002').pastilles[0];
        dit(mr && /Mondial Relay/.test(mr.txt) && !mr.imgs.some((i) => i.vis), `${T} E4 logo Mondial Relay coupé : le nom reste, aucune image cassée visible`, JSON.stringify(mr));
        const casses = await pg.evaluate(() => [...document.querySelectorAll('.vrm-transporteur img, [data-carrier-badge] img')].filter((i) => i.getClientRects().length && i.closest('[data-transporteur-logo]') && getComputedStyle(i.closest('[data-transporteur-logo]')).display !== 'none' && !(i.complete && i.naturalWidth > 0)).length);
        dit(casses === 0, `${T} E4 aucune image de logo cassée à l'écran`, String(casses));
        dit(envoyer.route === 0, `${T} A2 aucun achat en route sous « À envoyer »`, String(envoyer.route));
        await sain(pg, T + ' À envoyer');
        await pg.screenshot({ path: path.join(SHOTS, `transporteurs-envoyer-${vp.width}.png`), fullPage: false });
        const carte = pg.locator('[data-bord-card][data-tx-colis="8001"]');
        await carte.screenshot({ path: path.join(SHOTS, `transporteurs-carte-${vp.width}.png`) }).catch(() => {});
      });
      await essaie(T + ' Colis → À retirer', async () => {
        await pg.click('[data-colis-onglet-choix="retirer"]');
        await pg.waitForSelector('[data-cc-carte]', { timeout: 15000 });
        await pg.waitForTimeout(1500);
        const r = await pg.evaluate(() => {
          const P2 = window.__P;
          const cartes = [...document.querySelectorAll('[data-cc-carte]')].map((c) => {
            const point = c.closest('[data-relais-point]');
            const enTete = point && point.querySelector('.vrm-rp-tete .vrm-transporteur, .vrm-rpf-tete .vrm-transporteur');
            const surCarte = c.querySelector('.vrm-transporteur');
            const vu = surCarte || enTete;
            return { cle: c.getAttribute('data-cc-carte'), tr: c.getAttribute('data-transporteur'), vu: vu ? vu.getAttribute('data-transporteur') : null, txt: vu ? vu.innerText.trim() : '' };
          });
          const rt = document.querySelector('section[data-colis-vestiaire-route]');
          const vc = rt ? [...rt.querySelectorAll('[data-vc-route]')].map((x) => ({ id: x.getAttribute('data-vc-route'), tr: x.getAttribute('data-transporteur'), p: P2(x)[0] })) : null;
          return { cartes, vc };
        });
        for (const [cle, tr] of Object.entries(ATTENDU_R)) {
          const c = r.cartes.find((x) => x.cle === cle);
          // (3 nov., Julien/coordinateur : « Transporteur pas lu ⇒ ne pas l'écrire ») « pas-lu » : porté, jamais montré.
          dit(c && c.tr === tr && (tr === 'pas-lu' ? c.vu === null : c.vu === tr), `${T} A1 colis à retirer ${cle} : « ${tr} » porté${tr === 'pas-lu' ? ', pas écrit' : ' et montré'}`, JSON.stringify(c));
        }
        const vcA1 = r.vc && r.vc.find((x) => x.id === 'A1'), vcA3 = r.vc && r.vc.find((x) => x.id === 'A3');
        dit(vcA1 && vcA1.tr === ATTENDU_VC.A1 && /Chronopost/.test(vcA1.p.txt), `${T} A2 achat Vestiaire en route sous « À retirer », Chronopost`, JSON.stringify(r.vc));
        dit(vcA3 && vcA3.tr === 'pas-lu' && /Transporteur pas lu/.test(vcA3.p.txt) && !vcA3.p.imgs.length, `${T} A2 achat Vestiaire sans transporteur : « pas lu », sans logo`, JSON.stringify(vcA3));
        await sain(pg, T + ' À retirer');
        await pg.screenshot({ path: path.join(SHOTS, `transporteurs-retirer-${vp.width}.png`), fullPage: false });
      });
      await essaie(T + ' Récapitulatif d’une vente', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        const t = pg.locator('.vrm-sale-row[data-tx="8002"] .vrm-ledger-sale-toggle').first();
        await t.waitFor({ timeout: 30000 }); await pg.waitForTimeout(1200);
        await t.scrollIntoViewIfNeeded(); await t.click();
        const id = await t.getAttribute('aria-controls');
        await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 }); await pg.waitForTimeout(500);
        const r = await pg.evaluate((id) => { const d = document.getElementById(id); const p = d && d.querySelector('.vrm-recap-principal > .vrm-transporteur');
          return { cle: p ? p.getAttribute('data-transporteur') : null, txt: p ? p.innerText : '', bouton: !!(p && p.parentElement.querySelector('button')) }; }, id);
        dit(r.cle === 'mondialrelay' && /Mondial Relay/.test(r.txt) && r.bouton, `${T} R1 récapitulatif : « Mondial Relay » à côté du bouton bordereau`, JSON.stringify(r));
        await pg.locator(`[id="${id}"]`).screenshot({ path: path.join(SHOTS, `transporteurs-recap-${vp.width}.png`) }).catch(() => {});
        const t5 = pg.locator('.vrm-sale-row[data-tx="8005"] .vrm-ledger-sale-toggle').first();
        const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
        if (await croix.count()) { await croix.first().click(); await pg.waitForTimeout(400); }
        await t5.scrollIntoViewIfNeeded(); if (await t5.getAttribute('aria-expanded') !== 'true') await t5.click();
        const id5 = await t5.getAttribute('aria-controls');
        await pg.locator(`[id="${id5}"]`).waitFor({ state: 'visible', timeout: 8000 }); await pg.waitForTimeout(500);
        const r5 = await pg.evaluate((id) => { const d = document.getElementById(id); const p = d && d.querySelector('[data-recap-transporteur]');
          return { cle: p ? p.getAttribute('data-transporteur') : null, src: p ? p.getAttribute('data-transporteur-source') : null, n: d ? d.querySelectorAll('[data-recap-transporteur]').length : 0 }; }, id5);
        dit(r5.cle === 'chronopost' && r5.src === 'email' && r5.n === 1, `${T} R2 vente déposée : « Chronopost » (e-mail du même n°), dit une fois`, JSON.stringify(r5));
      });
      dit(!errs.length, `${T} aucune erreur de page`, errs[0]);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ Transporteurs à côté du bordereau : tout est vert');
  process.exit(ko ? 1 : 0);
})();
