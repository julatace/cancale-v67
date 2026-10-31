// Banc : Statistiques et Comptabilité, demande de Julien du 17 octobre —
// rendus sur des ventes INVENTÉES (aucune donnée réelle : ce banc vit dans le
// dépôt, qui est public), à 390 px (iPhone) et 1512 px (ordinateur).
//
// Ce qu'il juge (chaque attendu est calculé ICI depuis les données inventées,
// jamais lu dans l'app) :
//   Statistiques
//   1. les deux graphiques de 12 mois sont des COURBES À POINTS (comme Ma
//      journée) : un point par mois, et la valeur du point = le total du mois ;
//   2. la déclaration URSSAF n'y est PLUS (elle vit dans Compta, une fois) ;
//   3. « Ce qui se vend » : marques, tailles, modèles, pays des clients — le
//      pays lu dans la TRANSACTION (identité), jamais deviné ; le temps moyen
//      de vente avec sa couverture (« sur N ventes dont la date est connue ») ;
//      une vente annulée et un compte exclu ne comptent pas ;
//   Comptabilité
//   4. la carte URSSAF du mois : CA × taux = à payer, CA − à payer = net, de la
//      ligne publiée par Ventes (le propriétaire ne change pas, §11) ;
//   5. le récap comptable mensuel : une ligne par mois publié ;
//   6. les formulaires : on choisit « c'est pour quoi » en pastilles, chaque
//      champ dit ce qu'il attend, un ajout incomplet DIT pourquoi ;
//   7. le pack photo Leboncoin : facultatif ; « détecté par l'extension » quand
//      la ligne `lbc_pack_photo` le dit, rien d'affirmé quand elle est absente.
// Lancer : npm run build && BANC_PORT=6201 node scripts/bancs/stats-compta.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6201;

const maintenant = new Date();
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const jourDe = (m, j) => { const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - m, 1, 12); d.setDate(Math.min(j, 28)); if (d > maintenant) d.setTime(maintenant.getTime() - 3600e3); return d; };

// ── Les ventes inventées ─────────────────────────────────────────────────────
// [compte, mois en arrière, jour, titre, prix, statut, pays, jours en ligne]
// Le pays et la date de mise en ligne vivent sur la transaction et l'annonce ;
// `null` = pas de transaction captée (la vente ne se relie à rien).
const T = [
  ['111', 0, 2, 'Nike Air Max 1 blanc taille 42', 60, 'Commande finalisée', 'FR', 4],
  ['111', 0, 3, 'Adidas Samba OG taille 40', 75, 'Paiement validé', 'DE', 10],
  ['111', 1, 5, 'Adidas Samba noir taille 41', 70, 'Commande finalisée', 'FR', 2],
  ['111', 1, 7, 'Adidas Gazelle bleu taille 38', 55, 'Commande finalisée', 'IT', 20],
  ['111', 2, 9, 'Nike Air Force blanc taille 43', 50, 'Commande finalisée', 'FR', 6],
  ['222', 2, 11, 'Adidas Samba OG taille 42', 80, 'Commande finalisée', 'ES', 1],
  ['222', 3, 4, 'Nike Dunk Low taille 44', 90, 'Commande finalisée', null, null],
  ['222', 4, 6, 'Asics Gel-Kayano taille 41', 45, 'Commande finalisée', 'FR', 30],
  ['111', 5, 8, 'Nike Air Max 1 rouge taille 42', 65, 'Commande annulée', 'NL', 3],   // annulée : ne compte pas
  ['333', 1, 3, 'Nike Dunk Low taille 40', 99, 'Commande finalisée', 'BE', 5],      // compte EXCLU : ne compte pas
];
const ventes = { '111': [], '222': [], '333': [] };
const txns = [], items = { '111': [], '222': [], '333': [] };
T.forEach(([uid, m, j, titre, prix, statut, cc, enLigneJ], i) => {
  const d = jourDe(m, j); const tx = String(9100 + i); const item = String(5100 + i);
  ventes[uid].push({ transaction_id: tx, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString() });
  if (cc) {
    txns.push({ id: `harvest_${uid}_txn_${tx}`, data: { payload: { transaction: { id: tx, item_id: item, status: statut === 'Commande finalisée' ? '450' : '100', status_title: statut, buyer: { country_code: cc } } } } });
    const brand = titre.split(' ')[0];
    const taille = (/taille (\d+)/.exec(titre) || [])[1];
    items[uid].push({ id: Number(item), title: titre, brand, size: taille, is_closed: true, price: { amount: String(prix), currency_code: 'EUR' },
      photo: { url: '', high_resolution: { timestamp: Math.floor((d.getTime() - enLigneJ * 86400000) / 1000) } } });
  }
});
// Ce que la carte doit dire (comptes 111 et 222, annulée exclue) :
const gardees = T.filter((t) => t[0] !== '333' && t[5] !== 'Commande annulée');
const total = gardees.length;
const pays = {}; for (const t of gardees) if (t[6]) pays[t[6]] = (pays[t[6]] || 0) + 1;
const jours = gardees.filter((t) => t[7] != null).map((t) => t[7]);
const moyenne = jours.reduce((a, b) => a + b, 0) / jours.length;
const marques = {}; for (const t of gardees) { const b = t[3].split(' ')[0]; marques[b] = (marques[b] || 0) + 1; }

// La ligne publiée par l'écran Ventes : posée, Compta la consomme.
const caMoisDecl = 612.4, nMoisDecl = 11, TAUX = 13.5;
const c = (e) => Math.round(e * 100);
const aPayer = Math.round(Number((c(caMoisDecl) * TAUX / 100).toFixed(6))) / 100;
const net = (c(caMoisDecl) - c(aPayer)) / 100;
const publie = {
  mois: [
    { ym: ym(maintenant), n: nMoisDecl, ca: caMoisDecl, par: { Vinted: { n: 11, ca: caMoisDecl } }, nAilleurs: 0, caAilleurs: 0 },
    { ym: ym(jourDe(1, 1)), n: 30, ca: 1542.5, par: { Vinted: { n: 30, ca: 1542.5 } } },
    { ym: ym(jourDe(2, 1)), n: 17, ca: 811, par: { Vinted: { n: 17, ca: 811 } } },
    { ym: ym(jourDe(3, 1)), n: 12, ca: 540, par: { Vinted: { n: 12, ca: 540 } } },
  ],
  aDater: { n: 0, ca: 0 }, ecartees: 0, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu' }, declare: 'lu', at: Date.now(),
};

const ACCOUNTS = ['111', '222', '333'].map((u, i) => ({ id: i + 1, vinted_user_id: u, login: 'compte_' + u, domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }));
const lignes = (pack) => [
  ...['111', '222', '333'].map((u) => ({ id: `harvest_${u}_listings`, data: { capturedAt: maintenant.toISOString(), payload: { items: items[u] } } })),
  ...['111', '222', '333'].map((u) => ({ id: `harvest_${u}_orders_sold`, data: { capturedAt: maintenant.toISOString(), payload: { my_orders: ventes[u] } } })),
  ...txns,
  ...(pack ? [{ id: 'lbc_pack_photo', data: { actif: true, at: jourDe(0, 1).toISOString(), source: 'extension' } }] : []),
];

let ko = 0, ok = 0;
const dit = (cond, m, d) => { if (cond) ok++; else ko++; console.log((cond ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const ouvrir = async (b, vp, tab, opts = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((d) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_regime', JSON.stringify('micro')); localStorage.setItem('vinted_urssaf_taux', '13.5'); localStorage.setItem('vinted_urssaf_mois', JSON.stringify(d.publie)); localStorage.setItem('vinted_accounts_hidden', JSON.stringify(['333'])); } catch (_) {} }, { publie });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const L = lignes(!!opts.pack);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (opts.txnKO && /_txn_/.test(u) && /country_code/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: maintenant.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  // (29 oct.) les packs vivent dans « Avancé », replié : il l'ouvre comme Julien.
  if (tab === 'compta') await ouvrirAvanceCompta(pg).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs };
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── Statistiques, ${vp.width}`);
      await essaie(`stats ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, 'dashboard');
        // 26 oct. : le détail de « Ce qui se vend » est replié (Tailles, modèles et délais) : on l'ouvre comme lui.
        await pg.evaluate(() => { const d = [...document.querySelectorAll('.vrm-stats-analyses details')][0]; if (d && !d.open) d.querySelector('summary').click(); });
        await pg.waitForSelector('[data-stats-carte="repartitions"][data-repart-etat="lu"]', { timeout: 15000 }).catch(() => {});
        await pg.waitForFunction(() => { const e = document.querySelector('[data-repart-delai-n]'); return e && e.getAttribute('data-repart-delai-n') !== ''; }, null, { timeout: 8000 }).catch(() => {});
        const lu = await pg.evaluate(() => {
          const pts = (sel) => [...document.querySelectorAll(`${sel} g[data-mois]`)].map((g) => ({ m: g.getAttribute('data-mois'), v: Number(g.getAttribute('data-valeur')) }));
          const r = document.querySelector('[data-stats-carte="repartitions"][data-repart-etat]');
          return {
            tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
            deb: document.documentElement.scrollWidth - window.innerWidth,
            vendu: pts('[data-courbe-vendu]'), finalise: pts('[data-courbe-finalise]'),
            barres: document.querySelectorAll('[data-stats-carte="courbe"] [data-mois]:not(g)').length,
            urssaf: !!document.querySelector('[data-urssaf-declare]') || /À payer \(/.test(document.body.innerText) || /Prochaine déclaration/.test(document.body.innerText),
            recap: /Récap comptable mensuel/.test(document.body.innerText),
            repart: r ? { total: Number(r.getAttribute('data-repart-total')), delai: r.querySelector('[data-repart-delai]').getAttribute('data-repart-delai'), delaiN: r.querySelector('[data-repart-delai]').getAttribute('data-repart-delai-n'), texte: r.innerText } : null,
          };
        });
        dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(lu.deb <= 1, 'aucun débordement horizontal', `${lu.deb} px`);
        dit(lu.vendu.length === 12 && lu.barres === 0, 'Vendu · 12 mois : une courbe à 12 POINTS, plus de barres', `${lu.vendu.length} points · ${lu.barres} barres`);
        const attendu = {}; for (const t of T) if (t[0] !== '333' && t[5] !== 'Commande annulée') { const k = ym(jourDe(t[1], t[2])); attendu[k] = (attendu[k] || 0) + t[4]; }
        const ecarts = lu.vendu.filter((p) => p.v !== Math.round((attendu[p.m] || 0) * 100));
        dit(lu.vendu.length === 12 && !ecarts.length, 'chaque point vaut le vendu de SON mois (aucun chiffre changé)', ecarts.map((p) => `${p.m}=${p.v}≠${Math.round((attendu[p.m] || 0) * 100)}`).join(' '));
        dit(lu.finalise.length === publie.mois.length && lu.finalise.every((p) => { const e = publie.mois.find((m) => m.ym === p.m); return e && p.v === Math.round(e.ca * 100); }),
          'Évolution — ventes finalisées : une courbe à points, un point par mois publié, la même valeur', JSON.stringify(lu.finalise));
        dit(!lu.urssaf, 'la déclaration URSSAF (à payer, prochaine échéance) n’est plus dans Statistiques');
        dit(!lu.recap, 'le récap comptable mensuel n’est plus dans Statistiques');
        dit(lu.repart && lu.repart.total === total, '« Ce qui se vend » : les ventes des comptes gardés, annulée et compte exclu écartés', lu.repart ? `${lu.repart.total} ≠ ${total}?` : 'absente');
        dit(lu.repart && Math.abs(Number(lu.repart.delai) - Math.round(moyenne * 10) / 10) < 0.05 && Number(lu.repart.delaiN) === jours.length,
          'temps moyen de vente = moyenne (mise en ligne → vente) sur les ventes dont la date est connue', lu.repart ? `${lu.repart.delai} j sur ${lu.repart.delaiN} (attendu ${moyenne.toFixed(1)} sur ${jours.length})` : '');
        dit(lu.repart && new RegExp(`sur ${jours.length} ventes? dont la date de mise en ligne est connue \\(sur ${total}\\)`).test(lu.repart.texte), 'la couverture du temps de vente est écrite à côté');
        // Marques (onglet par défaut)
        const ligne = async (k) => pg.evaluate((k) => { const e = document.querySelector(`[data-repart-ligne="${k}"]`); return e ? Number(e.getAttribute('data-repart-n')) : null; }, k);
        const okM = []; for (const [k, n] of Object.entries(marques)) okM.push([k, n, await ligne(k)]);
        dit(okM.every(([, n, v]) => v === n), 'marques : le nombre de ventes par marque', okM.map(([k, n, v]) => `${k} ${v}/${n}`).join(' · '));
        // Pays
        await pg.click('[data-repart-mode="pays"]');
        await pg.waitForTimeout(300);
        const okP = []; for (const [k, n] of Object.entries(pays)) okP.push([k, n, await ligne(k)]);
        dit(okP.every(([, n, v]) => v === n), 'pays des clients : lu dans la transaction, compté par pays', okP.map(([k, n, v]) => `${k} ${v}/${n}`).join(' · '));
        const couvP = await pg.evaluate(() => (document.querySelector('[data-repart-couverture]') || {}).getAttribute ? document.querySelector('[data-repart-couverture]').getAttribute('data-repart-couverture') : null);
        const nPays = Object.values(pays).reduce((a, b) => a + b, 0);
        dit(couvP === `${nPays}/${total}`, 'pays : la couverture dit combien de ventes ont un pays connu', `${couvP} (attendu ${nPays}/${total})`);
        dit(!(await ligne('BE')) && !(await ligne('NL')), 'ni le pays d’une vente annulée, ni celui d’un compte exclu');
        await pg.click('[data-repart-mode="modeles"]'); await pg.waitForTimeout(200);
        { const nS = gardees.filter((t) => /samba/i.test(t[3])).length; dit((await ligne('samba')) === nS, `modèles : lus dans le titre (${nS} Samba gardées)`, String(await ligne('samba'))); }
        await ctx.close();
      });
      console.log(`\n── Statistiques, pays illisible, ${vp.width}`);
      await essaie(`stats ko ${vp.width}`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, 'dashboard', { txnKO: true });
        await pg.waitForSelector('.vrm-stats-analyses details', { timeout: 15000 });
        // 26 oct. : le détail de « Ce qui se vend » est replié (Tailles, modèles et délais) : on l'ouvre comme lui.
        await pg.evaluate(() => { const d = [...document.querySelectorAll('.vrm-stats-analyses details')][0]; if (d && !d.open) d.querySelector('summary').click(); });
        await pg.waitForSelector('[data-repart-mode="pays"]', { timeout: 15000 });
        await pg.click('[data-repart-mode="pays"]'); await pg.waitForTimeout(600);
        const t = await pg.evaluate(() => (document.querySelector('[data-repart-liste="pays"]') || {}).innerText || '');
        dit(/n'a pas pu être lu/.test(t) && !/France/.test(t), 'transactions illisibles : « pas pu lire », aucun pays affiché', t.slice(0, 120));
        await ctx.close();
      });

      console.log(`\n── Comptabilité, ${vp.width}`);
      await essaie(`compta ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, 'compta');
        await pg.waitForSelector('[data-compta-urssaf]', { timeout: 15000 }).catch(() => {});
        const t = await pg.evaluate(() => ({ urssaf: (document.querySelector('[data-compta-urssaf]') || {}).innerText || '', body: document.body.innerText, deb: document.documentElement.scrollWidth - window.innerWidth, tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText) }));
        dit(!t.tombe && errs.length === 0, 'Compta s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(t.deb <= 1, 'aucun débordement horizontal', `${t.deb} px`);
        const e2 = (s) => s == null ? null : Number(String(s).replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.'));
        const ap = e2((/À PAYER \([\d,.]+ ?%\)\s*\n\s*([\d\s.,\u00a0\u202f]+€)/i.exec(t.urssaf) || [])[1]);
        const nt = e2((/NET APRÈS PAIEMENT\s*\n\s*([\d\s.,\u00a0\u202f]+€)/i.exec(t.urssaf) || [])[1]);
        const cc = e2((/CA des ventes finalisées[^\n]*?\(([\d\s.,\u00a0\u202f]+€)\)/i.exec(t.urssaf) || [])[1]);
        dit(ap === aPayer && nt === net && cc === caMoisDecl, 'la déclaration URSSAF est dans Compta : CA × 13,5 % = à payer, CA − à payer = net', `${cc} → ${ap} · ${nt}`);
        dit(/Prochaine déclaration/.test(t.urssaf), 'la prochaine échéance est dans Compta');
        const nLignes = await pg.evaluate(() => { const h = [...document.querySelectorAll('span')].find((s) => /Récap comptable mensuel/.test(s.textContent)); const card = h && h.closest('.vrm-card, [class*="card"]') || (h && h.parentElement && h.parentElement.parentElement); return card ? card.querySelectorAll('tbody tr').length : -1; });
        dit(nLignes === publie.mois.length, 'le récap comptable mensuel est dans Compta : une ligne par mois publié', String(nLignes));
        // Formulaire de dépense
        await pg.click('[data-dep-ouvrir]');
        await pg.waitForSelector('[data-dep-form]', { timeout: 3000 });
        const forme = await pg.evaluate(() => ({ cats: [...document.querySelectorAll('[data-dep-cat]')].map((e) => e.getAttribute('data-dep-cat')), labels: [...document.querySelectorAll('[data-dep-form] label')].map((l) => l.innerText.split('\n')[0].trim()), abo: [...document.querySelectorAll('[data-dep-cat]')].some((e) => /Abonnement/.test(e.textContent)) }));
        dit(forme.cats.length >= 5 && !forme.abo && ['Ce que tu as payé', 'Montant', 'Payé le'].every((l) => forme.labels.includes(l)),
          'dépense : on choisit « c’est pour quoi » en pastilles, chaque champ a son libellé', `${forme.cats.join(',')} · ${forme.labels.join(' / ')}`);
        await pg.click('[data-dep-cat="Transport"]');
        const ph = await pg.getAttribute('[data-dep-libelle]', 'placeholder');
        dit(/essence/.test(ph || ''), 'l’exemple suit la catégorie choisie', ph);
        await pg.fill('[data-dep-montant]', '12,50');
        await pg.click('[data-dep-ajouter]');
        const err = await pg.evaluate(() => (document.querySelector('[data-dep-erreur]') || {}).innerText || '');
        dit(/ce que tu as payé/i.test(err), 'un ajout sans libellé DIT pourquoi (jamais en silence)', err);
        await pg.fill('[data-dep-libelle]', 'Essence relais');
        await pg.click('[data-dep-ajouter]'); await pg.waitForTimeout(300);
        const ajoute = await pg.evaluate(() => /Essence relais[\s\S]{0,80}Transport/.test(document.querySelector('[data-compta-section="depenses"]').innerText));
        dit(ajoute, 'la dépense est ajoutée, avec sa catégorie');
        // Abonnement : les plus courants
        await pg.click('[data-abo-ouvrir]');
        await pg.waitForSelector('[data-abo-courant="VRM"]', { timeout: 3000 });
        await pg.click('[data-abo-courant="VRM"]');
        const abo = await pg.evaluate(() => ({ nom: document.querySelector('[data-abo-libelle]').value, prix: document.querySelector('[data-abo-montant]').value, labels: [...document.querySelectorAll('[data-abo-form] label')].map((l) => l.innerText.split('\n')[0].trim()) }));
        dit(abo.nom === 'VRM' && abo.prix === '16,99' && abo.labels.some((l) => /^Jusqu'au/.test(l)), 'abonnement : « VRM » en un clic remplit le nom et le prix des CGV ; « jusqu’au » est expliqué', JSON.stringify(abo));
        await pg.click('[data-abo-courant="Canva"]');
        const prixCanva = await pg.inputValue('[data-abo-montant]');
        dit(prixCanva === '16,99' || prixCanva === '', 'aucun prix inventé pour un autre abonnement (le champ garde ce qui était tapé)', prixCanva);
        // Pack Leboncoin absent : rien d'affirmé
        dit(!(await pg.$('[data-pack-lbc]')) && /facultatif/.test(await pg.evaluate(() => document.querySelector('[data-compta-section="packs"]').innerText)), 'pack Leboncoin : facultatif, rien d’affirmé sans relevé de l’extension');
        await ctx.close();
      });
      await essaie(`compta pack ${vp.width}`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, 'compta', { pack: true });
        await pg.waitForSelector('[data-pack-lbc]', { timeout: 15000 }).catch(() => {});
        const p = await pg.evaluate(() => { const e = document.querySelector('[data-pack-lbc]'); return e ? { etat: e.getAttribute('data-pack-lbc'), t: e.innerText } : null; });
        dit(p && p.etat === 'actif' && /Détecté par l'extension/.test(p.t), 'pack Leboncoin relevé par l’extension : « pris — détecté par l’extension »', p ? p.t.replace(/\s+/g, ' ') : 'absent');
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ stats-compta : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ stats-compta : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
