// ── BANC : COLIS ET VENTES TOUT DE SUITE (9 nov. 2026, soir) ───────────────
//        npm run build && node scripts/bancs/colis-ventes-instantanes.cjs [dist]
//        SHOTS=dossier  BANC_PORT=4484  CVI_SEUL=390-light (une seule passe)  CVI_ECRAN=ventes|colis
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles (celles de
// journee-instantanee : un compte Vinted, trois ventes à expédier, deux bordereaux), et une
// acheteuse (`acheteuse_banc`) et des n° de suivi pour vérifier qu'ils ne sont JAMAIS rangés.
// Jugé sur les `data-*` et les nombres rendus, jamais sur un libellé seul. Pour CHAQUE écran
// (Colis = `cat_bord`, Ventes = `ventes`), en 390 tactile clair et sombre et en 1512 :
//  A  1re ouverture (aucun instantané) : l'écran vrai ; l'instantané est rangé pour CE uid quand
//     tout est lu ; il porte les chiffres RENDUS (carte, onglets, liste) et RIEN de personnel
//     (la valeur rangée est relue : ni acheteuse, ni compte, ni suivi, ni photo, ni lien, ni n° de
//     transaction, ni adresse, ni code).
//  I  2e ouverture, TOUTES les lectures de la base TENUES (requêtes gardées, jamais un délai) :
//     les chiffres de la dernière visite sont là (temps mesuré), « Mis à jour il y a 7 min », les
//     MÊMES valeurs que l'écran vrai, aucun chiffre « frais » montré, l'écran de démarrage parti,
//     tout INERTE (aucun bouton, aucun lien, aucune image ; chaque geste dit « Vérification… ») et
//     un clic ne fait rien. Puis les lectures sont RENDUES : l'écran vrai prend la place, CLS.
//  U  Un instantané d'un AUTRE uid (même rangé sous la clé de ce compte) : jamais rendu.
//  V  Un autre vendeur se connecte sur le navigateur : les instantanés sont effacés.
//  S  Sans instantané : le comportement d'avant (squelette puis plafond).
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4484);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-colis-ventes-instantanes');
const SEUL = process.env.CVI_SEUL || '';
const ECRAN_SEUL = process.env.CVI_ECRAN || '';


try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const UID = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';   // la session de banc (_porte-banc.cjs)
const midi = new Date(); midi.setHours(12, 0, 0, 0);
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(midi.getTime() - j * 86400000).toISOString();
const AEXP = 'Le paiement a été validé';
const PHOTO = (k) => `https://photos-banc.test/paire-${k}.png`;
const vente = (tx, titre, prix, jours) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(jours), photo: { url: PHOTO(tx) }, opposite_user: { id: 777, login: 'acheteuse_banc' }, buyer: { login: 'acheteuse_banc' }, shipping_address: '12 rue du Banc 75000 Paris' });
const VENTES = [vente(9101, 'Nike Air Max 90 taille 42', 80, 1), vente(9102, 'Adidas Samba OG taille 41', 45, 1), vente(9103, 'Nike Dunk Low taille 44', 60, 3)];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const OV = { '9101': { numero: '117' }, '9102': { numero: '42' }, '9103': { numero: '73' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBQEBR8b1WQAAAAJJRU5ErkJggg==', 'base64');
const bord = (tx, suivi, transporteur) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, ...(transporteur ? { transporteur } : {}), receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } });
const ROWS = [
  { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
  bord(9101, 'MR00099101', 'Mondial Relay'), bord(9102, 'ZZ9102'),
];
// Les attendus, faits À LA MAIN (jamais par le code de l'app).
const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
const venduMois = VENTES.filter((v) => Date.parse(v.date) >= debutMois).reduce((s, v) => s + Number(v.price.amount), 0);
const OBJ = 2000;
const finMois = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
const joursRestants = finMois - new Date().getDate() + 1;
const resteMain = OBJ - venduMois;
const parJourMain = Math.ceil(resteMain / joursRestants);
const fr = (n) => n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  // Une page vide de la même origine : lire et poser le stockage de l'app sans la lancer.
  if (f === '/__vide') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>vide</title>'); }
  if (f === '/' || !path.extname(f)) f = '/index.html';
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
// Le contexte : la base servie (ou TENUE : chaque lecture attend `rendre()`).
async function contexte(b, vp, { theme = 'light', objectif = OBJ } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const MAIN = { vinted_dark: theme === 'dark', vinted_sale_overrides: OV, vinted_bords_printed: {}, ...(objectif ? { vrm_objectif_mois: { v: 1, type: 'ca', valeur: objectif, cache: {} } } : {}) };
  await ctx.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); } catch (_) {} }, theme === 'dark');
  // Le CLS de toute la vie de la page (entrées tamponnées dès le début).
  await ctx.addInitScript(() => { window.__cls = 0; window.__clsListe = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsListe.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime), n: (e.sources || []).map((s) => (s.node && s.node.className ? String(s.node.className).slice(0, 60) : (s.node ? s.node.nodeName : '?')) + `@${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`).join('|') }); } }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} });
  const etat = { tenir: false, tenues: [] };
  const servir = (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) }).catch(() => {});
    // Une écriture est acceptée comme le ferait PostgREST (`return=representation` : les lignes écrites).
    if (route.request().method() !== 'GET') { let d = []; try { const x = JSON.parse(route.request().postData() || '[]'); d = Array.isArray(x) ? x : [x]; } catch (_) {} return j(d); }
    // La sonde du schéma : la base de production EST cloisonnée (l'appareil le retient, `schema_cloisonne`).
    if (/\/app_data\?select=owner&limit=1$/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' }).catch(() => {});
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/photos-banc\.test/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
    return ['media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  // Les lectures de la base : TENUES (une requête tenue, jamais un délai fixe, §6.5) ou servies.
  // Seules les LECTURES sont tenues (la relecture de l'ouverture) ; une écriture tenue ferait
  // apparaître le bandeau « changements en attente », un autre sujet.
  await ctx.route('**/rest/v1/**', (route) => { if (etat.tenir && route.request().method() === 'GET') etat.tenues.push(route); else servir(route); });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const rendre = () => { etat.tenir = false; const l = etat.tenues.splice(0); l.forEach(servir); return l.length; };
  return { ctx, etat, rendre };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
const PERSONNEL = /https?:|photos-banc|acheteuse_banc|compte_banc|MR000|ZZ9102|rue du Banc|75000|@|inbox|9101|9102|9103|10103/;

// Les deux écrans : leur onglet, leur clé, ce que l'écran vrai rend (la référence) et ce que l'instantané montre.
const ECRANS = {
  colis: {
    tab: 'cat_bord', cle: (uid) => 'vrm_colis_instantane:' + uid,
    pret: '[data-attente-ecran="cat_bord"][data-attente="pret"] [data-carte-stats="colis"] [data-carte-chiffre="aposter"]',
    vrai: () => {
      const g = document.querySelector('[data-attente-ecran="cat_bord"][data-attente="pret"] [data-carte-stats="colis"] .vrm-fu-grand');
      const cases = [...document.querySelectorAll('[data-attente-ecran="cat_bord"][data-attente="pret"] [data-carte-stats="colis"] [data-fu-case]')].map((c) => c.getAttribute('data-fu-case') + '=' + c.getAttribute('data-carte-valeur'));
      const ons = [...document.querySelectorAll('[data-attente-ecran="cat_bord"][data-attente="pret"] [data-colis-onglet-choix]')].map((b) => b.getAttribute('data-colis-onglet-choix') + '=' + b.getAttribute('data-colis-onglet-n'));
      const nums = [...document.querySelectorAll('[data-attente-ecran="cat_bord"][data-attente="pret"] .vrm-colis-grille [data-bord-card]')].map((c) => c.getAttribute('data-colis-num'));
      return { pret: !!g, grand: g && g.getAttribute('data-carte-valeur'), cases: cases.join(' '), onglets: ons.join(' '), nums: nums.join(' ') };
    },
    inst: () => {
      const r = document.querySelector('[data-inst-ecran="colis"]'); if (!r) return null;
      const g = r.querySelector('[data-inst-grand]');
      return { grand: g && g.getAttribute('data-inst-grand'), cases: [...r.querySelectorAll('[data-inst-case]')].map((c) => c.getAttribute('data-inst-case') + '=' + c.getAttribute('data-inst-valeur')).join(' '),
        onglets: [...r.querySelectorAll('[data-inst-onglet-choix]')].map((b) => b.getAttribute('data-inst-onglet-choix') + '=' + b.getAttribute('data-inst-onglet-n')).join(' '),
        nums: [...r.querySelectorAll('[data-inst-colis]')].map((c) => c.getAttribute('data-inst-colis')).join(' ') };
    },
    attendu: { grand: '3', nums: '73 42 117' },
  },
  ventes: {
    tab: 'ventes', cle: (uid) => 'vrm_ventes_instantane:' + uid,
    pret: '[data-attente-ecran="ventes"][data-attente="pret"] [data-carte-stats="ventes-toutes"] [data-carte-chiffre="vendu"]',
    vrai: () => {
      const r = document.querySelector('[data-attente-ecran="ventes"][data-attente="pret"]');
      const g = r && r.querySelector('[data-carte-stats="ventes-toutes"] .vrm-fu-grand');
      const cases = r ? [...r.querySelectorAll('[data-carte-stats="ventes-toutes"] [data-fu-case]')].map((c) => c.getAttribute('data-fu-case') + '=' + c.getAttribute('data-carte-valeur')) : [];
      const prix = r ? [...r.querySelectorAll('.vrm-toutes-liste [data-toutes-vente] [data-toutes-prix]')].map((p) => p.textContent.replace(/ | /g, ' ').trim()) : [];
      return { pret: !!g, grand: g && g.getAttribute('data-carte-valeur'), cases: cases.join(' '), prix: prix.join(' | ') };
    },
    inst: () => {
      const r = document.querySelector('[data-inst-ecran="ventes"]'); if (!r) return null;
      const g = r.querySelector('[data-inst-grand]');
      return { grand: g && g.getAttribute('data-inst-grand'), cases: [...r.querySelectorAll('[data-inst-case]')].map((c) => c.getAttribute('data-inst-case') + '=' + c.getAttribute('data-inst-valeur')).join(' '),
        prix: [...r.querySelectorAll('[data-inst-vente] [data-toutes-prix]')].map((p) => p.textContent.replace(/ | /g, ' ').trim()).join(' | ') };
    },
    attendu: { grand: String(Math.round(venduMois * 100)), prix: '80 € | 45 € | 60 €' },
  },
};
// Ce que l'écran vrai expose comme chiffre frais (jamais visible pendant l'instantané).
const FRAIS = '[data-fu-case], [data-carte-valeur], [data-bord-card], [data-toutes-id], [data-colis-onglet-n], [data-a-venir-total], [data-colis-prochain]';

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const temps = [];
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['light', 'dark']) for (const nomE of ['colis', 'ventes']) {
      if (SEUL && SEUL !== `${vp.width}-${theme}`) continue;
      if (ECRAN_SEUL && ECRAN_SEUL !== nomE) continue;
      const E = ECRANS[nomE];
      const T = `${nomE} ${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      const { ctx, etat, rendre } = await contexte(b, vp, { theme });
      let ref = null;
      // ── A : 1re ouverture, l'instantané se range ───────────────────────────
      await essaie('A ' + T, async () => {
        const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
        await pg.goto(`http://localhost:${PORT}/?tab=${E.tab}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(E.pret, { timeout: 30000 });
        temps.push({ T, quoi: 'écran vrai (base servie, 1re ouverture)', ms: Math.round(await pg.evaluate(() => performance.now())) });
        await pg.waitForTimeout(800);
        ref = await pg.evaluate(E.vrai);
        await pg.waitForFunction((k) => !!localStorage.getItem(k), E.cle(UID), { timeout: 15000 }).catch(() => {});
        const brut = await pg.evaluate((k) => localStorage.getItem(k), E.cle(UID));
        const s = brut ? JSON.parse(brut) : null;
        dit(!!s && s.uid === UID && s.v === 1 && s.ecran === nomE, `A ${T} l'instantané est rangé pour CE compte quand tout est lu`, s ? `${brut.length} octets` : 'absent');
        dit(ref.grand === E.attendu.grand && !!s && s.carte && s.carte.grand && s.carte.grand.valeur === ref.grand, `A ${T} il porte le grand chiffre RENDU de la carte (${E.attendu.grand})`, JSON.stringify({ rangé: s && s.carte && s.carte.grand, rendu: ref.grand }));
        const casesR = s && s.carte && s.carte.cases ? s.carte.cases.map((c) => c.cle + '=' + c.valeur).join(' ') : '';
        dit(!!casesR && casesR === ref.cases, `A ${T} il porte les cases RENDUES de la carte`, JSON.stringify({ rangé: casesR, rendu: ref.cases }));
        if (nomE === 'colis') {
          const ons = s && s.onglets ? s.onglets.map((o) => o.cle + '=' + o.n).join(' ') : '';
          dit(ons === ref.onglets && /envoyer=3/.test(ons), `A ${T} les trois onglets et leur nombre, tels que rendus`, JSON.stringify({ rangé: ons, rendu: ref.onglets }));
          const nums = s && s.liste ? s.liste.filter((l) => l.g == null).map((l) => l.num).join(' ') : '';
          dit(nums === ref.nums && nums === E.attendu.nums, `A ${T} la liste « À envoyer » : les N° dans l'ordre rendu (${E.attendu.nums})`, JSON.stringify({ rangé: nums, rendu: ref.nums }));
        } else {
          const prix = s && s.lignes ? s.lignes.map((l) => l.prix.replace(/ | /g, ' ')).join(' | ') : '';
          dit(prix === ref.prix && prix === E.attendu.prix, `A ${T} les ventes : les montants dans l'ordre rendu`, JSON.stringify({ rangé: prix, rendu: ref.prix }));
          dit(!!s && s.aVenir && /Vinted/.test((s.aVenir.lignes || []).join(' ')) && !!s.aVenir.total, `A ${T} « À venir » : montant et plateforme, sans le compte`, JSON.stringify(s && s.aVenir));
        }
        dit(!!brut && !PERSONNEL.test(brut), `A ${T} RIEN de personnel dans la valeur rangée (ni acheteuse, ni compte, ni suivi, ni adresse, ni photo, ni lien, ni n° de transaction)`, brut ? (brut.match(PERSONNEL) || [''])[0] : '');
        dit(!errs.length, `A ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await shot(pg, `cvi-vrai-${nomE}-${vp.width}-${theme}`);
        await pg.close();
      });
      // ── I : 2e ouverture, la base TENUE ────────────────────────────────────
      await essaie('I ' + T, async () => {
        const p0 = await ctx.newPage();
        await p0.goto(`http://localhost:${PORT}/__vide`);
        await p0.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || 'null'); if (s) { s.t -= 7 * 60000; localStorage.setItem(k, JSON.stringify(s)); } }, E.cle(UID));
        await p0.close();
        etat.tenir = true;
        const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
        const popups = []; pg.on('popup', (p) => popups.push(p.url()));
        await pg.goto(`http://localhost:${PORT}/?tab=${E.tab}`, { waitUntil: 'domcontentloaded' });
        const vu = await pg.waitForSelector(`[data-inst-ecran="${nomE}"] [data-inst-grand]`, { timeout: 12000 }).then(() => true).catch(() => false);
        const tChiffres = vu ? await pg.evaluate(() => performance.now()) : null;
        temps.push({ T, quoi: 'chiffres, base TENUE (2e ouverture)', ms: tChiffres == null ? 'jamais (12 s)' : Math.round(tChiffres) });
        dit(vu, `I ${T} base tenue : les derniers chiffres sont là`, tChiffres == null ? 'aucun chiffre en 12 s' : `${Math.round(tChiffres)} ms`);
        dit(tChiffres != null && tChiffres <= 4000, `I ${T} en moins de 4 s (base tenue)`, tChiffres == null ? '—' : `${Math.round(tChiffres)} ms`);
        const i = await pg.evaluate(([sel, FR]) => {
          const r = document.querySelector(sel);
          if (!r) return null;
          const dem = document.getElementById('vrm-demarrage');
          const att = r.closest('[data-attente-ecran]');
          return {
            inert: r.hasAttribute('inert') && r.inert === true,
            mention: ((r.querySelector('[data-inst-mention]') || {}).textContent || '').trim(),
            gestes: [...r.querySelectorAll('[data-inst-geste]')].map((g) => g.textContent.trim()),
            boutonsActifs: [...r.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter((e) => !e.closest('[inert]')).length,
            liens: r.querySelectorAll('a[href]').length, images: r.querySelectorAll('img').length,
            demarrage: !!dem && !dem.hasAttribute('data-sortie'),
            frais: [...document.querySelectorAll(FR)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.vrm-attente-cache')).length,
            attente: att ? att.getAttribute('data-attente') : null,
            boutonsMots: [...r.querySelectorAll('button, a, [role="button"], .vrm-b, [class*="vrm-colis-sec"], [class*="vrm-colis-primaire"]')].map((e) => e.textContent.trim()),
            texte: r.innerText.replace(/ | /g, ' '),
          };
        }, [`[data-inst-ecran="${nomE}"]`, FRAIS]);
        const iv = await pg.evaluate(E.inst);
        dit(!!i && /^Mis à jour il y a 7 min$/.test(i.mention), `I ${T} la mention dit l'âge : « Mis à jour il y a 7 min »`, i && i.mention);
        dit(!!iv && iv.grand === ref.grand && iv.cases === ref.cases, `I ${T} les MÊMES chiffres que l'écran vrai (carte : ${ref.grand} ; ${ref.cases})`, JSON.stringify(iv));
        if (nomE === 'colis') dit(!!iv && iv.onglets === ref.onglets && iv.nums === ref.nums, `I ${T} les mêmes onglets et la même liste (N° ${ref.nums})`, JSON.stringify(iv && { onglets: iv.onglets, nums: iv.nums }));
        else dit(!!iv && iv.prix === ref.prix, `I ${T} la même liste de ventes (${ref.prix})`, iv && iv.prix);
        dit(!!i && i.frais === 0 && i.attente === 'instantane', `I ${T} aucun chiffre « frais » montré pendant ce temps (l'écran vrai attend)`, JSON.stringify(i && { frais: i.frais, attente: i.attente }));
        dit(!!i && !i.demarrage, `I ${T} l'écran de démarrage s'est retiré devant l'instantané`);
        dit(!!i && i.inert && i.boutonsActifs === 0 && i.liens === 0 && i.images === 0, `I ${T} tout est INERTE (aucun bouton actif, aucun lien, aucune image)`, JSON.stringify(i && { inert: i.inert, b: i.boutonsActifs, l: i.liens, img: i.images }));
        // Les mots des gestes de l'écran vrai (boutons de Colis) : aucun n'est écrit seul dans l'instantané.
        const GESTES = /^(Imprimer|Tout imprimer|Imprimer le bordereau|Scanner|Déposé|Colis fait|Retiré|Suivre|Marquer imprimé|J'ai le PDF|Générer le bordereau|Emballer|Envoyer)$/;
        const gestesOk = !!i && i.gestes.length >= (nomE === 'colis' ? 2 : 0) && i.gestes.every((g) => g === 'Vérification…') && !i.boutonsMots.some((m) => GESTES.test(m));
        dit(gestesOk, `I ${T} chaque geste dit « Vérification… » (aucun bouton Imprimer, Déposé, Scanner, Suivre…)`, JSON.stringify(i && { gestes: i.gestes, mots: i.boutonsMots.filter((m) => GESTES.test(m)) }));
        // Un clic sur le premier geste (Colis) / la première vente (Ventes) : rien ne part.
        const cible = nomE === 'colis' ? '[data-inst-ecran="colis"] [data-inst-geste]' : '[data-inst-ecran="ventes"] [data-inst-vente]';
        const bx = await pg.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, cible);
        if (bx) {
          const avantUrl = pg.url();
          await pg.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
          await pg.waitForTimeout(700);
          const ap = await pg.evaluate(() => ({ ecran: (document.querySelector('.vrm-main') || {}).getAttribute ? document.querySelector('.vrm-main').getAttribute('data-ecran') : null, feuille: !!document.querySelector('[role="dialog"], .vrm-feuille, [data-feuille]') }));
          dit(pg.url() === avantUrl && !popups.length && !ap.feuille, `I ${T} toucher l'instantané ne fait rien (aucun écran, aucune feuille, aucune impression)`, JSON.stringify({ ...ap, popups }));
        } else dit(false, `I ${T} un geste / une vente de l'instantané est là`, cible);
        await shot(pg, `cvi-instantane-${nomE}-${vp.width}-${theme}`);
        // Les lectures reviennent : l'écran vrai prend la place.
        const avant = await pg.evaluate(() => window.__cls);
        const n = rendre();
        await pg.waitForSelector(E.pret, { timeout: 30000 });
        await pg.waitForTimeout(1500);
        const apres = await pg.evaluate((e) => ({ cls: window.__cls, liste: window.__clsListe, inst: !!document.querySelector(`[data-inst-ecran="${e}"]`) }), nomE);
        const r2 = await pg.evaluate(E.vrai);
        dit(!apres.inst && r2.pret && r2.grand === ref.grand, `I ${T} lectures rendues (${n}) : l'écran vrai a pris la place, mêmes chiffres`, JSON.stringify({ inst: apres.inst, grand: r2.grand }));
        dit(apres.cls - avant <= 0.01 && apres.cls <= 0.05, `I ${T} remplacé sans saut (CLS au remplacement ${(apres.cls - avant).toFixed(4)}, page ${apres.cls.toFixed(4)})`, JSON.stringify(apres.liste.slice(-4)));
        await shot(pg, `cvi-remplace-${nomE}-${vp.width}-${theme}`);
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `I ${T} aucun débordement`, String(deb));
        dit(!errs.length, `I ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await pg.close();
      });
      // ── V : un autre vendeur se connecte sur ce navigateur ⇒ effacé ────────
      await essaie('V ' + T, async () => {
        const p0 = await ctx.newPage();
        await p0.goto(`http://localhost:${PORT}/__vide`);
        const avant = await p0.evaluate((k) => !!localStorage.getItem(k), E.cle(UID));
        await p0.evaluate(() => localStorage.setItem('vrm_local_owner', 'un-autre-vendeur'));
        await p0.close();
        etat.tenir = true;
        const pg = await ctx.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=${E.tab}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-attente-ecran="${E.tab}"]`, { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const r = await pg.evaluate(([k, e]) => ({ inst: !!document.querySelector(`[data-inst-ecran="${e}"]`), cle: !!localStorage.getItem(k), autres: Object.keys(localStorage).filter((x) => /_instantane:/.test(x)).length }), [E.cle(UID), nomE]);
        dit(avant && !r.inst && !r.cle && r.autres === 0, `V ${T} changement de vendeur sur ce navigateur : les instantanés sont effacés, rien n'est montré`, JSON.stringify({ avant, ...r }));
        rendre(); await pg.close();
      });
      await ctx.close();
      // ── U : l'instantané d'un AUTRE uid ────────────────────────────────────
      await essaie('U ' + T, async () => {
        const { ctx: c2, etat: e2, rendre: r2 } = await contexte(b, vp, { theme });
        const carte = { classes: 'vrm-fu-carte vrm-carte-stats', portee: 'jour', surtitre: 'Aujourd’hui', grand: { texte: '987 654', valeur: '987654', vide: false, sous: 'à envoyer' }, spark: null, cases: [{ cle: 'imprimer', valeur: '987654', partiel: false, b: '987 654', vide: false, l: 'À imprimer', raison: '' }], objectif: null };
        const t0 = Date.now() - 120000; const d = new Date(t0); const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const faux = (uid) => (nomE === 'colis'
          ? { v: 1, ecran: 'colis', uid, t: t0, jour, mois: jour.slice(0, 7), largeur: 0, onglet: 'envoyer', sites: null, phrase: '', prochain: null, carte, onglets: [{ cle: 'envoyer', l: 'À envoyer', n: 987654 }, { cle: 'envoyes', l: 'Envoyés', n: 0 }, { cle: 'retirer', l: 'À retirer', n: 0 }], liste: [] }
          : { v: 1, ecran: 'ventes', uid, t: t0, jour, mois: jour.slice(0, 7), largeur: 0, sites: null, phrase: '', carte: { ...carte, portee: 'mois' }, aVenir: null, replis: [], lignes: [{ site: 'vinted', siteNom: 'Vinted', num: '', titre: 'Paire d’un autre', date: '', etat: '', ton: '', prix: '987 654 €' }], n: 1 });
        await c2.addInitScript(([k, a, k2]) => { try { localStorage.setItem('vrm_local_owner', '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'); localStorage.setItem(k, JSON.stringify(a)); localStorage.setItem(k2, JSON.stringify(a)); } catch (_) {} },
          [E.cle(UID), faux('autre-vendeur'), E.cle('autre-vendeur')]);
        e2.tenir = true;
        const pg = await c2.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=${E.tab}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-attente-ecran="${E.tab}"]`, { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        const r = await pg.evaluate((e) => ({ inst: !!document.querySelector(`[data-inst-ecran="${e}"]`), txt: document.body.innerText.replace(/ | /g, ' ') }), nomE);
        dit(!r.inst && !/987 654/.test(r.txt), `U ${T} un instantané d'un autre uid n'est jamais rendu (même rangé sous la clé de ce compte)`, JSON.stringify({ inst: r.inst, chiffre: /987 654/.test(r.txt) }));
        r2(); await c2.close();
      });
      // ── S : sans instantané, le comportement d'avant ──────────────────────
      await essaie('S ' + T, async () => {
        const { ctx: c3, etat: e3, rendre: r3 } = await contexte(b, vp, { theme });
        e3.tenir = true;
        const pg = await c3.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=${E.tab}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-attente-ecran="${E.tab}"]`, { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(2000);
        const r = await pg.evaluate((t) => ({ inst: !!document.querySelector('[data-inst-ecran]'), attente: document.querySelector(`[data-attente-ecran="${t}"]`).getAttribute('data-attente'), sq: !!document.querySelector(`[data-attente-ecran="${t}"] [data-demarrage-attente]`) }), E.tab);
        dit(!r.inst && ((r.attente === 'attente' && r.sq) || r.attente === 'plafond'), `S ${T} sans instantané : le comportement d'avant (squelette puis plafond), aucun instantané`, JSON.stringify(r));
        r3(); await c3.close();
      });
    }
  } finally {
    await b.close(); srv.close();
  }
  console.log('\nTemps mesurés (performance.now, depuis la navigation) :');
  for (const t of temps) console.log(`  ${t.T} · ${t.quoi} : ${t.ms}${typeof t.ms === 'number' ? ' ms' : ''}`);
  console.log(`\n${ko ? 'KO' : 'OK'} — ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
