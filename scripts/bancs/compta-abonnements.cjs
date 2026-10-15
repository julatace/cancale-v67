// Banc : LA COMPTABILITÉ RECENTRÉE ET L'ESPACE « DÉCLARATIONS » (15 octobre).
//
// Julien, 15 octobre :
//   · « pour les abonnements logiciels on doit pouvoir marquer le coût fixe par
//     mois, et ensuite ça nous rappelle tous les mois combien on dépense » ;
//   · « tu as mis un onglet pack de photos pour Leboncoin mais ça ne doit pas
//     être d'office : c'est l'extension qui doit regarder […] c'est automatique » ;
//   · « il y a Déclarer dans comptabilité, je ne comprends pas ce que ça vient
//     faire là : la comptabilité c'est simplement renseigner les dépenses ».
//
// Ce banc rend l'app sur des données INVENTÉES (aucune fixture : il vit dans le
// dépôt, public), horloge figée au 15 octobre 2026 (Paris), et juge ce qui est
// RENDU — les nombres portés en `data-*` et les totaux affichés, jamais un
// libellé seul (§6.5) :
//   1. un abonnement ANNUEL compte une fois l'an, un TRIMESTRIEL tous les trois
//      mois, un mensuel chaque mois — dans le total de l'année et le mois ;
//   2. le rappel du mois liste ce qui tombe, « payé » se coche (sur son clic,
//      rangé par mois) et ne change pas les totaux ; la prévision dit la suite ;
//   3. la TVA est dite quand elle est connue, jamais inventée ;
//   4. plus de formulaire « Packs de photos » ; un pack déjà noté reste compté et
//      visible ; « Packs photos et boosts » dit « — », jamais « 0 € » ;
//   5. Déclarations porte la carte URSSAF, le rapport, le registre et le régime ;
//      la Comptabilité, Statistiques, Réglages et Ventes → Outils n'en portent
//      plus que la porte ;
//   6. rien ne déborde, à 390 et 1512 px, en clair et en sombre ; aucun écran
//      tombé sur le garde-fou.
//
// Revue du 15 octobre (sept défauts, chacun rouge sur 63782f2) :
//   7. le rappel des abonnements est sur Ma journée, il mène à Comptabilité, et
//      « Marquer payé » le fait partir de Ma journée ET de « À faire » de
//      Collectif — sans recharger (avant : Collectif réclamait 42 € payés) ;
//   8. un trimestriel qui ne tombe pas ce mois-ci : la prévision dit quand même
//      « novembre 45 € » ;
//   9. un boost noté sur sa paire est DÉJÀ retiré du résultat : la carte « Packs
//      photos et boosts » dit le même montant que le registre (« frais
//      renseignés »), et « Boost » n'est plus une catégorie de dépense ;
//  10. Statistiques ne porte plus les cotisations par mois (déclaratif) ;
//  11. sur Comptabilité, aucun total ne s'écrit deux fois, et l'en-tête de la
//      section « Dépenses » ne porte aucun montant ;
//  12. le CSV : une ligne par échéance, datée par son mois, des colonnes
//      numériques (taux, TVA, HT), et la somme des lignes = le TOTAL.
//
//   node scripts/bancs/compta-abonnements.cjs          (port 5972, BANC_PORT pour changer)
//   CAPTURES=/chemin node scripts/bancs/compta-abonnements.cjs   → captures d'écran
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5972;
const CAPTURES = process.env.CAPTURES || '';

const MAINTENANT = new Date('2026-10-15T12:00:00+02:00');
const ISO = MAINTENANT.toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: ISO }];
const FIN = 'Commande finalisée';
const VENTES = [
  { transaction_id: 9001, title: 'Nike Air Max 1 taille 42', price: { amount: '100', currency_code: 'EUR' }, status: FIN, date: '2026-10-03T12:00:00+02:00' },
  { transaction_id: 9002, title: 'Salomon XT-6 taille 40', price: { amount: '80', currency_code: 'EUR' }, status: FIN, date: '2026-10-04T12:00:00+02:00' },
];
const VERS = { 9001: '2026-10-08T12:00:00+02:00', 9002: '2026-10-09T12:00:00+02:00' };
const ROWS = [
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: [] } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ISO, payload: { my_orders: VENTES } } },
  ...Object.entries(VERS).map(([tx, d]) => ({ id: 'harvest_111_txn_' + tx, data: { capturedAt: ISO, payload: { transaction: { id: Number(tx), status: 450, status_updated_at: d } } } })),
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ISO, payload: { my_orders: [] } } },
];
// La comptabilité servie : une dépense, un pack noté AVANT le 15 octobre (rangé
// dans `packs`), et trois abonnements de périodicités différentes.
const COMPTA = {
  depenses: [{ id: 'd1', date: '2026-10-02', libelle: 'Scotch Alpha', cat: 'Emballage', montant: 12 }],
  packs: [{ id: 'p1', plateforme: 'Leboncoin', compte: 'pro', montant: 9.99, date: '2026-09-10' }],
  fixes: [
    { id: 'f1', libelle: 'Logiciel Bravo', montant: 12, debut: '2026-01', periode: 'mois', cat: 'Logiciel', tva: 20 },
    { id: 'f2', libelle: 'Hébergement Charlie', montant: 120, debut: '2026-06', periode: 'an', cat: 'Logiciel' },
    { id: 'f3', libelle: 'Forfait Delta', montant: 30, debut: '2026-04', periode: 'trimestre' },
  ],
};
// Attendu (règle « une échéance par période », au 15 octobre 2026) :
//   dépense 12 + pack 9,99 + Bravo 10 × 12 + Charlie 1 × 120 + Delta 3 × 30 (avril, juillet, octobre)
const TOTAL_ANNEE = 12 + 9.99 + 120 + 120 + 90;            // 351,99
const PAR_MOIS = 12 + 120 / 12 + 30 / 3;                    // 32 (lissé)
const OCTOBRE = 12 + 30 + 12;                                // Bravo + Delta + Scotch = 54
const A_PAYER_OCT = 12 + 30;                                 // 42

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const nombre = (t) => { const m = /(-?[\d\s  ]+(?:[,.]\d+)?)\s*€/.exec(t || ''); return m ? parseFloat(m[1].replace(/[\s  ]/g, '').replace(',', '.')) : NaN; };
const egal = (a, b) => Math.abs(a - b) < 0.005;
// Le total de l'année, quel que soit son libellé d'hier ou d'aujourd'hui.
const RE_TOTAL = /^total (dépenses |charges )?2026$/;
const fr = (n) => n.toFixed(2).replace('.', ',');

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

// La fausse base (§6.3 : la projection `select=` est appliquée pour de vrai).
const brancher = async (pg, main = null) => {
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (req.method() !== 'GET') return j([], 201);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    // Le nuage porte les mêmes réglages que l'appareil (sinon il les remet à leur défaut).
    if (/id=eq\.main/.test(u)) return j(main ? [{ id: 'main', data: main }] : []);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: ISO, cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
};
// `vrm_bascule_mineral_v1` : la bascule unique « Minéral » remet le thème clair
// une fois — sans cette marque, le sombre choisi ici serait effacé au démarrage.
const LOCAL = (c) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); for (const [k, v] of Object.entries(c)) localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const valeurApres = (pg, re) => pg.evaluate((src) => {
  const l = document.body.innerText.split('\n').map((x) => x.trim()).filter(Boolean);
  const r = new RegExp(src, 'i'); const i = l.findIndex((x) => r.test(x)); return i < 0 ? null : l[i + 1];
}, re.source);
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le scénario s’exécute', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const garde = async (pg) => pg.evaluate(() => /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const ouvrir = async (tab, { viewport = { width: 1512, height: 950 }, sombre = false, compta = COMPTA, local = {} } = {}) => {
    const mobile = viewport.width < 600;
    const ctx = await b.newContext({ viewport, timezoneId: 'Europe/Paris', acceptDownloads: true, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.clock.setFixedTime(MAINTENANT);
    await pg.addInitScript(LOCAL, { vrm_compta: compta, vinted_dark: sombre, ...local });
    await brancher(pg, { vrm_compta: compta, vinted_dark: sombre, ...local });
    await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(4000);
    return { ctx, pg, errs };
  };

  // ── 1. LES ABONNEMENTS TOMBENT SELON LEUR PÉRIODICITÉ ─────────────────────
  await essaie('periodicite', async () => {
    const { ctx, pg, errs } = await ouvrir('compta');
    const total = nombre(await valeurApres(pg, RE_TOTAL));
    const parMois = nombre(await valeurApres(pg, /^(abonnements|coûts fixes \/ mois)$/));
    const mois = nombre(await valeurApres(pg, /^(total d'octobre|dépenses d'octobre|charges ce mois)$/));
    dit(egal(total, TOTAL_ANNEE), `le total 2026 compte l'annuel UNE fois (juin), le trimestriel en avril, juillet, octobre, le mensuel chaque mois : ${TOTAL_ANNEE.toFixed(2)} €`, `rendu ${total}`);
    dit(egal(parMois, PAR_MOIS), `« Abonnements / mois » ramène au mois : 12 + 120/12 + 30/3 = ${PAR_MOIS} €`, `rendu ${parMois}`);
    dit(egal(mois, OCTOBRE), `les dépenses d'octobre = ce qui TOMBE en octobre (12 + 30) + la dépense (12) = ${OCTOBRE} € — pas l'annuel de juin`, `rendu ${mois}`);
    // 2. Le rappel du mois
    const r = await pg.evaluate(() => { const e = document.querySelector('[data-rappel-abos]'); return e ? { n: e.getAttribute('data-rappel-abos'), t: e.getAttribute('data-rappel-total'), ids: [...document.querySelectorAll('[data-echeance]')].map((x) => x.getAttribute('data-echeance') + ':' + x.getAttribute('data-echeance-statut')) } : null; });
    dit(!!r && r.n === '2' && r.t === A_PAYER_OCT.toFixed(2) && r.ids.join(',') === 'f1:prevu,f3:prevu', 'le rappel d’octobre liste ce qui tombe (Bravo, Delta), « prévu », 42 € à payer — pas Charlie (juin)', JSON.stringify(r));
    const prev = await pg.evaluate(() => (document.querySelector('[data-prevision]') || {}).innerText || '');
    dit(/novembre 12,00/.test(prev) && /janvier 42,00/.test(prev), 'la prévision dit la suite (novembre 12 €, janvier 42 € : Bravo + Delta)', prev);
    // 3. La TVA
    const tva = await pg.evaluate(() => [...document.querySelectorAll('[data-fixe-tva-ligne]')].map((e) => e.closest('[data-fixe]').getAttribute('data-fixe') + ' ' + e.innerText.trim()));
    dit(tva.length === 1 && /^f1 /.test(tva[0]) && /20 % : 2,00/.test(tva[0]), 'la TVA est dite pour l’abonnement qui en porte une (12 € TTC à 20 % ⇒ 2,00 €), et pour LUI seul — jamais inventée', JSON.stringify(tva));
    // « Payé » : sur son clic, rangé par mois, sans toucher aux totaux
    await pg.click('[data-echeance="f3"] button');
    await pg.waitForTimeout(1200);
    const apres = await pg.evaluate(() => { const e = document.querySelector('[data-rappel-abos]'); let c = null; try { c = JSON.parse(localStorage.getItem('vrm_compta')); } catch (_) {} const f3 = c && c.fixes.find((x) => x.id === 'f3'); return { n: e && e.getAttribute('data-rappel-abos'), t: e && e.getAttribute('data-rappel-total'), statut: (document.querySelector('[data-echeance="f3"]') || { getAttribute: () => null }).getAttribute('data-echeance-statut'), payes: f3 && f3.payes, autres: c && c.fixes.filter((x) => x.id !== 'f3').map((x) => x.payes || null) }; });
    dit(apres.n === '1' && apres.t === '12.00' && apres.statut === 'paye', '« Marquer payé » sur Delta : il passe « payé », il reste 12 € à payer', JSON.stringify(apres));
    dit(!!apres.payes && apres.payes['2026-10'] === true && Object.keys(apres.payes).length === 1 && apres.autres.every((x) => x === null), 'le « payé » est rangé pour OCTOBRE seulement, sur Delta seulement', JSON.stringify(apres.payes));
    const total2 = nombre(await valeurApres(pg, RE_TOTAL));
    dit(egal(total2, TOTAL_ANNEE), 'cocher « payé » ne change pas le total (une échéance est due, cochée ou non)', `rendu ${total2}`);
    // 4. Packs : plus de formulaire, l'ancien reste compté et visible
    const p = await pg.evaluate(() => ({
      formPack: !!document.querySelector('input[placeholder^="Compte (ex."]'),
      packVu: /Leboncoin · pro/.test(document.body.innerText),
      frais: (() => { const e = document.querySelector('[data-frais-captes]'); return e ? { etat: e.getAttribute('data-frais-captes'), texte: e.innerText } : null; })(),
    }));
    dit(!p.formPack, 'plus de formulaire « Packs de photos » à remplir d’office');
    dit(p.packVu, 'un pack noté avant reste dans la liste des dépenses (il est compté dans le total ci-dessus)');
    dit(!!p.frais && p.frais.etat === 'aucun' && !/\d+,\d{2}\s*€/.test(p.frais.texte), '« Packs photos et boosts » : rien de capté automatiquement ⇒ aucun montant inventé', JSON.stringify(p.frais));
    // 11. Aucun total écrit deux fois, et « Dépenses » ne porte plus de total
    //     (revue du 15 octobre : « Abonnements 32,00 € » et « ≈ 32,00 € /mois » ;
    //     le total de l'année répété dans la carte du résultat ; l'en-tête de la
    //     section, un quatrième « dépenses »). On compte les MONTANTS rendus.
    const dbl = await pg.evaluate(([vals]) => {
      const t = document.body.innerText.replace(/[\u202f\u00a0]/g, ' ');
      const compte = (v) => t.split(v + ' €').length - 1;
      const sec = document.querySelector('[data-compta-section="depenses"]');
      return { fois: Object.fromEntries(vals.map((v) => [v, compte(v)])), enteteDepenses: sec ? sec.innerText : null };
    }, [[fr(PAR_MOIS), fr(TOTAL_ANNEE)]]);
    dit(dbl.fois[fr(PAR_MOIS)] === 1, `le tarif des abonnements par mois (${fr(PAR_MOIS)} €) s'écrit UNE fois sur l'écran`, JSON.stringify(dbl.fois));
    dit(dbl.fois[fr(TOTAL_ANNEE)] === 1, `le total de l'année (${fr(TOTAL_ANNEE)} €) s'écrit UNE fois sur l'écran`, JSON.stringify(dbl.fois));
    dit(dbl.enteteDepenses !== null && !/\d+,\d{2}\s*€/.test(dbl.enteteDepenses), 'l’en-tête de la section « Dépenses » ne porte aucun montant (les totaux vivent en haut, les sous-totaux par mois)', JSON.stringify(dbl.enteteDepenses));
    // 12. Le CSV des dépenses : une ligne par échéance, colonnes numériques
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 10000 }), pg.click('[data-export-depenses]')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^\ufeff/, '');
    const L = csv.split('\n').map((l) => l.split(';').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')));
    const en = L.find((r) => r.includes('Libelle')) || [];
    const col = (n) => en.findIndex((h) => new RegExp(n, 'i').test(h));
    const iTTC = col('^Montant TTC$'), iTaux = col('^Taux'), iTva = col('^TVA$'), iHT = col('^Montant HT$'), iMois = col('^Mois$'), iLib = col('^Libelle$');
    const corpsCsv = L.slice(L.indexOf(en) + 1).filter((r) => r.length > 3 && r[iLib] !== 'TOTAL' && r[iTTC] !== '' && r[iTTC] !== undefined);
    const tot = L.find((r) => r[iLib] === 'TOTAL');
    const numOuVide = (v) => v === '' || /^\d+(\.\d+)?$/.test(v);
    const bravo = corpsCsv.filter((r) => r[iLib] === 'Logiciel Bravo');
    const somme = corpsCsv.reduce((t, r) => t + Number(r[iTTC]), 0);
    dit(iMois >= 0 && iTaux >= 0 && iTva >= 0 && iHT >= 0, 'CSV : des colonnes Mois, Taux TVA, TVA et Montant HT distinctes', en.join(' ; '));
    dit(bravo.length === 10 && bravo.every((r) => /^2026-(0[1-9]|10)$/.test(r[iMois])), 'CSV : un abonnement mensuel depuis janvier sort en DIX lignes, chacune datée par son mois (janvier → octobre)', bravo.map((r) => r[iMois]).join(','));
    dit(corpsCsv.length > 0 && corpsCsv.every((r) => numOuVide(r[iTaux] || '') && numOuVide(r[iTva] || '') && numOuVide(r[iHT] || '')), 'CSV : taux, TVA et HT sont des NOMBRES (un point décimal) ou vides — jamais du texte', corpsCsv.filter((r) => !(numOuVide(r[iTaux] || '') && numOuVide(r[iTva] || '') && numOuVide(r[iHT] || ''))).map((r) => r.join('|')).slice(0, 2).join(' / '));
    dit(!!tot && egal(somme, Number(tot[iTTC])) && egal(somme, TOTAL_ANNEE), `CSV : la somme des lignes = le TOTAL = ${TOTAL_ANNEE.toFixed(2)} € (celui de l'écran)`, `${somme.toFixed(2)} / ${tot ? tot[iTTC] : '—'}`);
    // 5. Pas de déclaratif dans la Comptabilité
    const t = await pg.evaluate(() => document.body.innerText);
    dit(!/Déclarer sur l'URSSAF|J'ai déclaré ce mois|CA déclaré/i.test(t), 'la Comptabilité ne porte plus le déclaratif (ni « Déclarer sur l’URSSAF », ni « J’ai déclaré ce mois », ni « CA déclaré »)');
    dit(!!(await pg.$('[data-vers-declarations]')), 'elle n’en garde que la porte (Déclarations)');
    dit(!(await garde(pg)) && errs.length === 0, 'aucun écran tombé, aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  });

  // ── 6. AJOUTER UN ABONNEMENT ANNUEL PAR LE FORMULAIRE ────────────────────
  await essaie('ajout', async () => {
    const { ctx, pg, errs } = await ouvrir('compta', { viewport: { width: 390, height: 844 } });
    await pg.fill('input[aria-label="Nom de l\'abonnement"]', 'Studio Echo');
    await pg.fill('input[aria-label="Montant TTC de l\'abonnement"]', '60');
    await pg.selectOption('[data-fixe-periode]', 'an');
    await pg.fill('[data-fixe-debut]', '2026-10');
    await pg.selectOption('[data-fixe-tva]', '20');
    await pg.click('[data-ajouter="abonnement"]');
    await pg.waitForTimeout(1200);
    const c = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_compta')); } catch (_) { return null; } });
    const e = c && c.fixes.find((x) => x.libelle === 'Studio Echo');
    dit(!!e && e.periode === 'an' && e.debut === '2026-10' && e.tva === 20 && e.montant === 60, 'l’abonnement ajouté garde sa périodicité, son début et sa TVA', JSON.stringify(e));
    const total = nombre(await valeurApres(pg, RE_TOTAL));
    dit(egal(total, TOTAL_ANNEE + 60), 'son échéance d’octobre entre dans le total (+60 €), une seule fois', `rendu ${total}`);
    const r = await pg.evaluate(() => (document.querySelector('[data-rappel-abos]') || { getAttribute: () => null }).getAttribute('data-rappel-total'));
    dit(r === (A_PAYER_OCT + 60).toFixed(2), 'et il apparaît dans le rappel d’octobre', r);
    const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    dit(m.sw <= m.cw + 1, '[390 px] la Comptabilité ne déborde pas', `${m.sw} / ${m.cw}`);
    dit(!(await garde(pg)) && errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  });

  // ── 7. DÉCLARATIONS : TOUT LE DÉCLARATIF, ET PLUS AILLEURS QUE SA PORTE ────
  await essaie('fiscal', async () => {
    const { ctx, pg, errs } = await ouvrir('fiscal');
    await pg.waitForFunction(() => /À PAYER \(/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    const f = await pg.evaluate(() => ({
      espace: !!document.querySelector('[data-espace-fiscal]'),
      urssaf: /À PAYER \(/i.test(document.body.innerText) && !!document.querySelector('a[href*="autoentrepreneur.urssaf.fr"]'),
      ouvrir: [...document.querySelectorAll('[data-fiscal-ouvrir]')].map((x) => x.getAttribute('data-fiscal-ouvrir')).join(','),
      regime: /Régime fiscal/.test(document.body.innerText) && /Taux de cotisations/.test(document.body.innerText),
      mois: (document.querySelector('[data-mois-declares]') || { getAttribute: () => null }).getAttribute('data-mois-declares'),
    }));
    dit(f.espace && f.urssaf && f.ouvrir === 'rapport,registre' && f.regime, 'Déclarations porte la carte URSSAF (avec « Déclarer sur l’URSSAF »), le rapport, le registre et le régime', JSON.stringify(f));
    dit(f.mois === '0', 'le registre « J’ai déclaré ce mois » est lu et dit « aucun mois » (trois états, jamais deux)', String(f.mois));
    await pg.click('[data-fiscal-ouvrir="rapport"]');
    await pg.waitForTimeout(1900);
    const rap = await pg.evaluate(() => !!document.querySelector('[data-registre="ventes"]'));
    dit(rap, 'le rapport du mois s’ouvre depuis Déclarations (le même, avec son registre des ventes)');
    dit(!(await garde(pg)) && errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
    // Statistiques : la porte, plus la carte
    const s = await ouvrir('dashboard');
    const st = await s.pg.evaluate(() => ({ carte: /À PAYER \(|Déclarer sur l'URSSAF/i.test(document.body.innerText), porte: !!document.querySelector('[data-vers-declarations]') }));
    dit(!st.carte && st.porte, 'Statistiques n’a plus la carte URSSAF, seulement la porte vers Déclarations', JSON.stringify(st));
    await s.ctx.close();
    // Réglages : le régime est parti, la porte est là
    const r = await ouvrir('settings');
    const rg = await r.pg.evaluate(() => ({ carte: /Société — régime de la marge/.test(document.body.innerText), porte: /Régime fiscal et déclarations/.test(document.body.innerText) }));
    dit(!rg.carte && rg.porte, 'Réglages n’a plus le régime en double, seulement la porte', JSON.stringify(rg));
    await r.ctx.close();
    // Ventes → Outils : une porte, pas deux fenêtres
    const v = await ouvrir('cat_ventes');
    await v.pg.getByText('Outils', { exact: false }).first().click({ timeout: 5000 });
    await v.pg.waitForTimeout(300);
    const o = await v.pg.evaluate(() => ({ rapport: /^Rapport comptable$/m.test(document.body.innerText), registre: /^Registre annuel$/m.test(document.body.innerText), decl: /^Déclarations URSSAF$/m.test(document.body.innerText) }));
    dit(o.decl && !o.rapport && !o.registre, 'Ventes → Outils : « Déclarations URSSAF », plus « Rapport comptable » ni « Registre annuel » en double', JSON.stringify(o));
    await v.pg.getByText('Déclarations URSSAF', { exact: true }).first().click({ timeout: 5000 });
    await v.pg.waitForTimeout(1800);
    dit(!!(await v.pg.$('[data-espace-fiscal]')), 'et cette porte mène bien à Déclarations');
    await v.ctx.close();
  });

  // ── 7b. LE RAPPEL MENSUEL : SUR MA JOURNÉE, ET IL SUIT « PAYÉ » PARTOUT ────
  // (revue du 15 octobre) Il ne vivait que sous Autres outils → Collectif, et
  // il y restait après « Marquer payé » : Comptabilité disait « tout est payé »,
  // Collectif « 2 abonnements à payer — 42,00 € ». On suit le geste DANS l'app,
  // sans recharger.
  await essaie('rappel', async () => {
    const { ctx, pg, errs } = await ouvrir('collectif');
    const aFaire = () => pg.evaluate(() => ({ ecran: /Collectif/.test(document.body.innerText), abo: ((document.body.innerText.replace(/[\u202f\u00a0]/g, ' ')).match(/\d+ abonnements? à payer ce mois-ci[^\n]*/) || [null])[0] }));
    const c0 = await aFaire();
    dit(c0.ecran && /^2 abonnements à payer ce mois-ci — 42,00 €/.test(c0.abo || ''), '« À faire » de Collectif : « 2 abonnements à payer ce mois-ci — 42,00 € » avant de payer', JSON.stringify(c0));
    const nav = async (libelle) => {
      if (libelle === 'Collectif') { await pg.getByText('Autres outils', { exact: false }).first().click().catch(() => {}); await pg.waitForTimeout(400); }
      await pg.getByText(libelle, { exact: true }).first().click();
      await pg.waitForTimeout(1800);
    };
    await nav('Ma journée');
    const job = async () => pg.evaluate(() => { const e = document.querySelector('[data-job="abonnements"]'); return e ? { n: e.getAttribute('data-n'), texte: e.innerText.replace(/[\u202f\u00a0]/g, ' ') } : null; });
    const j1 = await job();
    dit(!!j1 && j1.n === '2' && /42,00 €/.test(j1.texte), 'Ma journée : « 2 abonnements à payer — 42,00 € » (Bravo + Delta, pas l’annuel de juin)', JSON.stringify(j1));
    if (CAPTURES) await pg.screenshot({ path: path.join(CAPTURES, 'journee-abonnements-1512.png') });
    // La ligne mène à Comptabilité ; sans elle (code d'avant) on y va par le
    // menu, pour juger quand même la suite (un banc ne meurt pas, il rapporte).
    if (j1) await pg.click('[data-job="abonnements"]'); else await nav('Comptabilité');
    await pg.waitForTimeout(1500);
    dit(!!j1 && !!(await pg.$('[data-rappel-abos]')), 'la ligne mène à Comptabilité, au rappel du mois');
    for (const id of ['f1', 'f3']) { await pg.click(`[data-echeance="${id}"] button`); await pg.waitForTimeout(700); }
    await pg.waitForTimeout(800);
    await nav('Ma journée');
    const j2 = await job();
    // Le salut n'existe que sur Ma journée (le rail, lui, est partout).
    const surJournee = await pg.evaluate(() => /^(Bonjour|Bon après-midi|Bonsoir)\b/m.test(document.body.innerText));
    dit(surJournee && j2 === null, 'après « Marquer payé » sur les deux : la ligne quitte Ma journée, sans recharger', JSON.stringify({ surJournee, j2 }));
    await nav('Collectif');
    const col = await aFaire();
    dit(col.ecran && col.abo === null, '« À faire » de Collectif ne réclame plus les abonnements payés, sans recharger (avant : « 2 abonnements à payer — 42,00 € » jusqu’au rechargement)', JSON.stringify(col));
    dit(!(await garde(pg)) && errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
    // Et dans l'autre sens : rien n'est dû ⇒ aucune ligne (ni rappel inventé)
    const v = await ouvrir('journee', { compta: { depenses: [], packs: [], fixes: [{ id: 'q', libelle: 'Compta Echo', montant: 45, debut: '2026-08', periode: 'trimestre' }] } });
    dit(!(await v.pg.$('[data-job="abonnements"]')), 'un trimestriel qui ne tombe pas en octobre : aucune ligne « à payer » sur Ma journée');
    await v.ctx.close();
  });

  // ── 7c. LA PRÉVISION QUAND RIEN NE TOMBE CE MOIS-CI ────────────────────────
  await essaie('prevision', async () => {
    const { ctx, pg, errs } = await ouvrir('compta', { compta: { depenses: [], packs: [], fixes: [{ id: 'q', libelle: 'Compta Echo', montant: 45, debut: '2026-08', periode: 'trimestre' }] } });
    const p = await pg.evaluate(() => ({ prev: ((document.querySelector('[data-prevision]') || {}).innerText || '').replace(/[\u202f\u00a0]/g, ' '), apayer: (document.querySelector('[data-rappel-abos]') || { getAttribute: () => null }).getAttribute('data-rappel-abos') }));
    dit(/novembre 45,00 €/.test(p.prev), 'un trimestriel pris en août, rien en octobre : la prévision annonce « novembre 45,00 € » (avant : rien nulle part)', JSON.stringify(p));
    dit(p.apayer === '0', 'et rien n’est « à payer » en octobre (0)', String(p.apayer));
    dit(!(await garde(pg)) && errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  });

  // ── 7d. UN BOOST NOTÉ SUR SA PAIRE EST DÉJÀ DANS LE RÉSULTAT ───────────────
  // (revue du 15 octobre) La carte disait « ils ne sont comptés nulle part, note-
  // les dans Dépenses (Boost) » : suivi, le conseil retirait le même boost deux
  // fois (registre 80 au lieu de 85). Le registre publie ses boosts, la carte
  // les DIT ; « Boost » n'est plus une catégorie de dépense.
  await essaie('boost', async () => {
    const local = { vinted_sale_overrides: { '9001': { buyPrice: '50', fees: '5' }, '9002': { buyPrice: '40' } } };
    // Une vraie dépense (10 €) à côté : le registre n'écrit son résultat après
    // charges que s'il y a des charges.
    const compta = { depenses: [{ id: 'd9', date: '2026-10-05', libelle: 'Cartons Golf', cat: 'Emballage', montant: 10 }], packs: [], fixes: [] };
    const { ctx, pg, errs } = await ouvrir('fiscal', { compta, local });
    await pg.click('[data-fiscal-ouvrir="registre"]');
    await pg.waitForTimeout(3000);
    const reg = await pg.evaluate(() => { const e = document.querySelector('[data-resultat-annuel]'); return { valeur: e && e.getAttribute('data-resultat-valeur'), frais: ((document.body.innerText.replace(/[\u202f\u00a0]/g, ' ').match(/frais renseignés ([\d\s]+,\d{2}) €/) || [])[1] || null) }; });
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3000);
    const c = await pg.evaluate(() => ({
      boosts: (document.querySelector('[data-boosts-ventes]') || { getAttribute: () => null }).getAttribute('data-boosts-ventes'),
      resultat: (document.querySelector('[data-resultat-compta]') || { getAttribute: () => null }).getAttribute('data-resultat-valeur'),
      cats: [...document.querySelectorAll('select[aria-label="Catégorie de la dépense"] option')].map((o) => o.value),
    }));
    if (CAPTURES) await pg.screenshot({ path: path.join(CAPTURES, 'compta-boost-1512.png'), fullPage: true });
    dit(reg.frais === '5,00' && reg.valeur === '75.00', 'le registre retire le boost noté sur la paire UNE fois : 180 − 90 − 5 − 10 (cartons) = 75', JSON.stringify(reg));
    dit(c.boosts === '5.00', 'la carte « Packs photos et boosts » dit ce boost (5,00 €) — le même que le registre, déjà retiré du résultat (avant : « comptés nulle part »)', JSON.stringify(c.boosts));
    dit(c.resultat === reg.valeur && c.resultat === '75.00', 'Comptabilité et registre : le même résultat (75)', `${c.resultat} / ${reg.valeur}`);
    dit(c.cats.length > 0 && c.cats.includes('Pack photos') && !c.cats.some((x) => /boost/i.test(x)), '« Boost » n’est plus proposé en dépense (noté là ET sur la paire, il comptait deux fois) ; « Pack photos » reste', c.cats.join(','));
    dit(!(await garde(pg)) && errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  });

  // ── 7e. STATISTIQUES N'A PLUS LE DÉCLARATIF ────────────────────────────────
  await essaie('stats', async () => {
    const pubM = { mois: [{ ym: '2026-09', ca: 300, n: 3 }, { ym: '2026-10', ca: 180, n: 2 }], at: MAINTENANT.getTime() };
    const { ctx, pg, errs } = await ouvrir('dashboard', { local: { vinted_urssaf_mois: pubM } });
    const st = await pg.evaluate(() => { const t = document.body.innerText; return { cotis: /cotis/i.test(t), urssafFr: /autoentrepreneur\.urssaf\.fr/i.test(t) || !!document.querySelector('a[href*="autoentrepreneur.urssaf.fr"]'), porte: !!document.querySelector('[data-vers-declarations]'), courbe: /sep|oct/i.test(t) }; });
    dit(!st.cotis && !st.urssafFr && st.porte, 'Statistiques (avec des mois publiés) : ni cotisations par mois, ni « déclaration sur autoentrepreneur.urssaf.fr » — seulement la porte vers Déclarations', JSON.stringify(st));
    dit(!(await garde(pg)) && errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  });

  // ── 8. RIEN NE DÉBORDE, AUX DEUX TAILLES, DANS LES DEUX THÈMES ─────────────
  for (const sombre of [false, true]) for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const tab of ['compta', 'fiscal']) {
    await essaie(`rendu ${tab} ${vp.width} ${sombre ? 'sombre' : 'clair'}`, async () => {
      const { ctx, pg, errs } = await ouvrir(tab, { viewport: vp, sombre });
      const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bg: getComputedStyle(document.body).backgroundColor }));
      const nom = `${tab}-${vp.width}-${sombre ? 'sombre' : 'clair'}`;
      if (CAPTURES) await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: true });
      const lum = (() => { const x = /rgba?\((\d+), (\d+), (\d+)/.exec(m.bg); return x ? (0.2126 * x[1] + 0.7152 * x[2] + 0.0722 * x[3]) / 255 : NaN; })();
      dit(m.sw <= m.cw + 1 && (sombre ? lum < 0.3 : lum > 0.7) && !(await garde(pg)) && errs.length === 0, `[${nom}] rendu sans débordement, thème suivi, sans erreur`, `${m.sw}/${m.cw} · fond ${m.bg}${errs.length ? ' · ' + errs[0].slice(0, 100) : ''}`);
      await ctx.close();
    });
  }

  await b.close(); srv.close();
  console.log(ko ? `\n❌ compta-abonnements : ${ko} rouge(s)` : '\n✅ compta-abonnements : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  le banc s’exécute — ' + (e && e.message)); process.exit(1); });
