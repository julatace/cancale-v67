// ── BANC : MA JOURNÉE v2 (9 nov. 2026) ───────────────────────────────────────
//        npm run build && node scripts/bancs/journee-v2.cjs [dist]
//        SHOTS=dossier  BANC_PORT=4481  JV2_MUTATION=1 (doit devenir rouge)
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles : un compte
// Vinted, trois ventes à expédier (80 € il y a 1 jour, 45 € il y a 1 jour, 60 € il y a
// 3 jours), aucune vente aujourd'hui ; deux bordereaux par n° de TRANSACTION, l'un
// NOMME son transporteur (« Mondial Relay »), l'autre non ; la troisième vente n'a pas
// de bordereau et porte « Chronopost » dans son TITRE (un leurre : un titre n'est
// jamais une identité). Jugé sur les `data-*` et les nombres rendus, jamais un libellé.
//  F  La frise : sept jours (aujourd'hui à droite) qui se TOUCHENT ; par défaut le
//     dernier jour vendu (aujourd'hui sans vente) ; toucher un jour ⇒ CE jour (son
//     vendu = la somme faite à la main ici) ; aujourd'hui ⇒ « rien vendu » (0, pas un
//     chiffre géant) ; « Semaine du … » ⇒ la semaine passée (lundi → dimanche) et sa
//     somme ; une barre sous un jour vendu, aucune ailleurs.
//  P  La pile des ventes de la période : autant d'articles que de ventes, en éventail ;
//     la toucher ouvre Ventes.
//  U  Le même nombre jamais deux fois : le vendu du jour n'est écrit qu'UNE fois dans la
//     tête (le grand chiffre de la carte réglable laisse sa place à la frise) ; la
//     prochaine chose à faire est en tête et n'est pas redite dans « Ensuite ».
//  T  Le transporteur sur chaque vente (Ventes · Tous) : celui de SON bordereau
//     (Mondial Relay) ; rien pour un bordereau muet ni sans bordereau (le titre
//     « Chronopost » ne nomme personne). Ventes · Vinted : plus de filtre « À envoyer »,
//     un lien vers Colis.
//  M  Mouvement réduit : l'éventail et le panneau n'ont AUCUNE animation ; sans
//     réduction, ils en ont (témoin).
// MUTATION (JV2_MUTATION=1, données) : la vente sans bordereau reçoit un bordereau « Mondial Relay »
// sous SON n° ⇒ le banc doit la voir porter un transporteur ⇒ ROUGE. Les mutations du CODE (règle
// réaffaiblie) sont rejouées dans la passation (docs/passation/2026-11-09-journee-v2.md).
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4481);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-journee-v2');
const MUTATION = process.env.JV2_MUTATION === '1';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const midi = new Date(); midi.setHours(12, 0, 0, 0);
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(midi.getTime() - j * 86400000).toISOString();
const AEXP = 'Le paiement a été validé';
const PHOTO = (k) => `https://photos-banc.test/paire-${k}.png`;
const vente = (tx, titre, prix, jours) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(jours), photo: { url: PHOTO(tx) } });
const VENTES = [vente(9101, 'Nike Air Max 90 taille 42', 80, 1), vente(9102, 'Adidas Samba OG taille 41', 45, 1), vente(9103, 'Nike Dunk Low Chronopost taille 44', 60, 3)];
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
    ...(MUTATION ? [bord(9103, 'MR00099101', 'Mondial Relay')] : []),
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
async function preparer(b, vp, { theme = 'light', reduit = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, reducedMotion: reduit ? 'reduce' : 'no-preference', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ROWS = lignes(); const MAIN = { vinted_dark: theme === 'dark', vinted_sale_overrides: OV, vinted_bords_printed: {} };
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); } catch (_) {} }, theme === 'dark');
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
  await pg.waitForSelector('[data-jv2-argent] [data-jv2-panneau]', { timeout: 30000 });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-jv2-argent]'); return e && e.getAttribute('data-fu-vendu-jour') !== ''; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
};
const etat = (pg) => pg.evaluate(() => {
  const a = document.querySelector('[data-jv2-argent]');
  const v = a && a.querySelector('[data-jv2-vendu]');
  return { periode: a ? a.getAttribute('data-jv2-periode') : null, vendu: v ? v.getAttribute('data-jv2-vendu') : null, semaine: (a && a.querySelector('[data-journal-semaine]')) ? a.querySelector('[data-journal-semaine]').getAttribute('data-journal-semaine') : null,
    pile: (a && a.querySelector('[data-jv2-pile]')) ? a.querySelector('[data-jv2-pile]').getAttribute('data-jv2-pile') : null,
    pilePhotos: a ? a.querySelectorAll('[data-jv2-pile] .vrm-pile-v img').length : 0,
    choisis: a ? [...a.querySelectorAll('.vrm-fu-jour[data-choisi]')].map((l) => l.getAttribute('data-jv2-jour')) : [],
    jours: a ? [...a.querySelectorAll('[data-fu-semaine] > li')].map((l) => ({ iso: l.getAttribute('data-jv2-jour'), auj: l.hasAttribute('data-auj'), barre: !!l.querySelector('[data-barre]'), h: Math.round(l.querySelector('.vrm-jv2-barre').getBoundingClientRect().height), btn: (() => { const r = l.querySelector('button').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() })) : [] };
});

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['light', 'dark']) {
      const T = `${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      // ── F / P / U : Ma journée ─────────────────────────────────────────────
      await essaie('F ' + T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreJournee(pg);
        await shot(pg, `jv2-journee-${vp.width}-${theme}`);
        let e = await etat(pg);
        dit(e.jours.length === 7 && e.jours[6].auj && e.jours[6].iso === isoJour(auj0), `F ${T} sept jours, aujourd'hui à droite`, JSON.stringify(e.jours.map((j) => j.iso)));
        dit(e.jours.every((j) => j.btn[0] >= 44 && j.btn[1] >= 44), `F ${T} chaque jour se touche (44 px au moins)`, JSON.stringify(e.jours.map((j) => j.btn)));
        const avecBarre = e.jours.filter((j) => j.barre && j.h > 0).map((j) => j.iso).sort().join(',');
        dit(avecBarre === [isoJour(J1), isoJour(J3)].sort().join(','), `F ${T} une barre sous chaque jour vendu, aucune ailleurs`, avecBarre);
        dit(e.periode === isoJour(J1) && e.vendu === String(Math.round(venduDu(J1) * 100)), `F ${T} par défaut : le dernier jour vendu (aujourd'hui sans vente) et SON vendu (${venduDu(J1)} €)`, JSON.stringify({ periode: e.periode, vendu: e.vendu }));
        dit(e.pile === String(VENTES.filter((v) => jourDe(v.date) === J1).length) && e.pilePhotos === 2, `P ${T} la pile porte les ventes du jour (2), en photos`, JSON.stringify({ pile: e.pile, photos: e.pilePhotos }));
        // U — le vendu du jour écrit UNE fois dans la tête ; plus de grand chiffre redit par la carte réglable.
        const u = await pg.evaluate(() => {
          const tete = document.querySelector('.vrm-fu-tete');
          const grandCarte = [...tete.querySelectorAll('.vrm-fu-carte-nu .vrm-fu-grand')].filter((x) => x.getClientRects().length).length;
          const txt = tete.innerText.replace(/\u202f|\u00a0/g, ' ');
          const pro = [...document.querySelectorAll('[data-prochain]')];
          const liste = document.querySelector('[data-barre-jour]');
          return { grandCarte, txt, nPro: pro.length, proEnTete: pro.length === 1 && tete.contains(pro[0]), redit: pro.length ? [...document.querySelectorAll('[data-tuile], [data-job]')].filter((x) => x !== pro[0] && x.getClientRects().length && ((x.getAttribute('data-tuile') && x.getAttribute('data-tuile') === pro[0].getAttribute('data-tuile')) || (x.getAttribute('data-job') && x.getAttribute('data-job') === pro[0].getAttribute('data-job')))).length : -1,
            proAvantFrise: pro.length ? !!(pro[0].compareDocumentPosition(document.querySelector('[data-fu-semaine]')) & Node.DOCUMENT_POSITION_FOLLOWING) : false, liste: !!liste };
        });
        const montantJ1 = `${venduDu(J1)} €`;
        const fois = (u.txt.match(new RegExp('(^|[^\\d])' + montantJ1.replace(/\s/g, '\\s') + '(?![\\d,])', 'g')) || []).length;
        dit(u.grandCarte === 0 && fois === 1, `U ${T} le vendu du jour choisi (${montantJ1}) écrit UNE fois dans la tête, aucun second grand chiffre`, JSON.stringify({ grandCarte: u.grandCarte, fois }));
        dit(u.nPro === 1 && u.proEnTete && u.proAvantFrise && u.redit === 0, `U ${T} UNE prochaine chose à faire, en tête AVANT l'argent, pas redite dans « Ensuite »`, JSON.stringify({ n: u.nPro, enTete: u.proEnTete, avant: u.proAvantFrise, redit: u.redit }));
        // F — toucher un jour, aujourd'hui, la semaine.
        await pg.locator(`[data-jv2-toucher="${isoJour(J3)}"]`).click(); await pg.waitForTimeout(400);
        e = await etat(pg);
        dit(e.periode === isoJour(J3) && e.vendu === String(Math.round(venduDu(J3) * 100)) && e.choisis.join() === isoJour(J3) && e.pile === '1', `F ${T} toucher le ${isoJour(J3)} ⇒ CE jour : ${venduDu(J3)} €, une vente`, JSON.stringify({ periode: e.periode, vendu: e.vendu, choisis: e.choisis, pile: e.pile }));
        await pg.locator(`[data-jv2-toucher="${isoJour(auj0)}"]`).click(); await pg.waitForTimeout(400);
        e = await etat(pg);
        dit(e.periode === isoJour(auj0) && e.vendu === '0' && e.pile === null, `F ${T} toucher aujourd'hui ⇒ « rien vendu » (0, aucun chiffre géant, aucune pile)`, JSON.stringify({ periode: e.periode, vendu: e.vendu, pile: e.pile }));
        await shot(pg, `jv2-aujourdhui-${vp.width}-${theme}`);
        await pg.locator('[data-jv2-semaine]').click(); await pg.waitForTimeout(400);
        e = await etat(pg);
        dit(e.periode === 'semaine' && e.semaine === isoJour(lundiPasse) && e.vendu === (venduSemaine ? String(Math.round(venduSemaine * 100)) : '0') && e.choisis.length === 0, `F ${T} « Semaine du … » ⇒ la semaine passée (${isoJour(lundiPasse)}), ${venduSemaine} €`, JSON.stringify({ periode: e.periode, semaine: e.semaine, vendu: e.vendu }));
        await shot(pg, `jv2-semaine-${vp.width}-${theme}`);
        await pg.locator(`[data-jv2-toucher="${isoJour(J1)}"]`).click(); await pg.waitForTimeout(400);
        // P — la pile ouvre Ventes.
        await pg.locator('[data-jv2-pile]').click();
        const ecran = await pg.waitForFunction(() => { const m = document.querySelector('.vrm-main'); const d = m && m.getAttribute('data-ecran'); return d && d !== 'journee' ? d : null; }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
        dit(/vente/.test(String(ecran)), `P ${T} toucher la pile ouvre Ventes`, String(ecran));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `F ${T} aucun débordement`, String(deb));
        dit(!errs.length, `F ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      // ── T : le transporteur de chaque vente ───────────────────────────────
      await essaie('T ' + T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-toutes-vente="vinted"]', { timeout: 30000 });
        await pg.waitForFunction(() => !!document.querySelector('[data-toutes-id="9101"] [data-toutes-transp]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const t = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-toutes-vente="vinted"]')].map((l) => [l.getAttribute('data-toutes-id'), (l.querySelector('[data-toutes-transp]') || { getAttribute: () => null }).getAttribute('data-toutes-transp')])));
        dit(/mondial/i.test(String(t['9101'])), `T ${T} la vente 9101 porte le transporteur de SON bordereau (Mondial Relay)`, JSON.stringify(t));
        dit(t['9102'] === null && t['9103'] === null, `T ${T} bordereau muet ou absent ⇒ aucun transporteur (le titre « Chronopost » ne nomme personne)`, JSON.stringify(t));
        await shot(pg, `jv2-ventes-tous-${vp.width}-${theme}`);
        await pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first().click();
        await pg.waitForSelector('.vrm-ventes-liste [data-tx], [data-ventes-vide]', { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const f = await pg.evaluate(() => ({ filtres: [...document.querySelectorAll('.vrm-filtres button[aria-pressed]')].map((x) => x.innerText.trim()), lien: !!document.querySelector('[data-ventes-vers-colis]') }));
        dit(f.lien && f.filtres.length >= 3 && !f.filtres.some((x) => /envoyer/i.test(x)), `T ${T} Ventes · Vinted : aucun filtre « À envoyer » (la liste vit dans Colis), un lien vers Colis`, JSON.stringify(f));
        await pg.locator('[data-ventes-vers-colis]').click();
        const ecran = await pg.waitForFunction(() => { const m = document.querySelector('.vrm-main'); const d = m && m.getAttribute('data-ecran'); return d === 'cat_bord' ? d : null; }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
        dit(ecran === 'cat_bord', `T ${T} le lien ouvre Colis`, String(ecran));
        dit(!errs.length, `T ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
    // ── M : mouvement réduit ───────────────────────────────────────────────
    for (const reduit of [false, true]) await essaie('M ' + reduit, async () => {
      const { ctx, pg } = await preparer(b, { width: 390, height: 844 }, { reduit });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await attendreJournee(pg);
      await pg.locator(`[data-jv2-toucher="${isoJour(J3)}"]`).click();
      const n = await pg.evaluate(() => [...document.querySelectorAll('.vrm-jv2-periode, .vrm-jv2-pile .vrm-pile-v')].reduce((t, e) => t + e.getAnimations().length, 0));
      if (reduit) dit(n === 0, 'M mouvement réduit : ni éventail ni glissé du panneau (aucune animation)', String(n));
      else dit(n > 0, 'M (témoin) sans réduction : le panneau et l’éventail s’animent', String(n));
      await ctx.close();
    });
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} journee-v2 : ${ko} rouge(s)${MUTATION ? ' (MUTATION : doit être rouge)' : ''} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
