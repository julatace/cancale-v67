// ════════════════════════════════════════════════════════════════════════════
//  FORME DES RÉPONSES VINTED ET MODE PRUDENCE (ext. 5.357, 11 nov. — validé par
//  Julien), JOUÉS sur le vrai `background.js` (`_fond-vm.cjs`) et les vraies
//  règles de l'app (`src/formeVinted.js`, `src/jaugeActions.js`) :
//   F. forme inattendue sur un champ dont dépend une règle ⇒ RIEN n'est écrit
//      (la bonne lecture d'avant reste), la forme vue est rangée SANS valeur dans
//      `harvest_{uid}_forme_inconnue`, et l'app dit « Vinted a changé sa page des
//      ventes : VRM ne la lit plus, on corrige » ; un champ facultatif absent, un
//      article isolé d'une autre forme : rien ; la forme revenue efface l'alerte ;
//   P. un refus de Vinted (429, 403, captcha) ⇒ le compte passe 24 h en prudence :
//      20 actions/heure au lieu de 50, délais doublés, lectures de fond suspendues
//      sauf les codes de retrait, publiée dans la jauge (« Prudence jusqu'à … »),
//      appliquée par les autres Chrome du compte, levée seule à l'échéance ; le
//      plafond NORMAL reste 50 (§3) ;
//   R. de la revue de robustesse : une visite à la fois (haute 14), une annonce
//      d'un autre vendeur n'entre plus dans `vinted_item_details`, ligne bornée
//      (haute 18), un job de mise en ligne au corps illisible rend sa place et
//      son verrou sans rien envoyer (haute 22).
//  Usage : node scripts/audit-vinted-forme.cjs [--ext dossier] [--prouve]
//  `--ext` : un autre dossier d'extension (preuve sur la branche de départ, §6.1 ;
//  `src/` est cherché à côté) ; `--prouve` : chaque mutation doit rendre un rouge.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const EXT = arg('--ext') || path.join(__dirname, '..', 'vinted-sync-extension');
const SRC = path.join(EXT, '..', 'src');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = '111';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' };

const vente = (o = {}) => ({ transaction_id: 9001, title: 'Paire inventée', price: { amount: '123.45', currency_code: 'EUR' }, transaction_user_status: 'needs_action', item_id: 4444, date: '2026-11-10T10:00:00Z', status: 'Paiement validé', ...o });
const ventes = (l) => ({ my_orders: l, pagination: { current_page: 1, total_pages: 1, total_entries: l.length, per_page: 100 } });
const BON_AVANT = () => ({ type: 'orders_sold', uid: UID, capturedAt: '2026-11-10T09:00:00Z', nItems: 2, payload: ventes([vente(), vente({ transaction_id: 9002 })]) });

async function auditer(S) {
  const out = []; const dit = (bon, m, d) => out.push({ ok: !!bon, m, d });
  const fond = (o = {}) => faireFond({ src: S.bg, ...o });
  const essaie = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e && e.message); } };
  let regleApp = null, jaugeApp = null;
  try { regleApp = await import(pathToFileURL(path.join(S.src, 'formeVinted.js')).href + '?m=' + Math.random()); } catch (_) {}
  try { jaugeApp = await import(pathToFileURL(path.join(S.src, 'jaugeActions.js')).href + '?m=' + Math.random()); } catch (_) {}

  // ── F : la forme ──
  await essaie('F', async () => {
    // F1-F3 : prix devenu un NOMBRE sur toutes les ventes (voie active).
    const lignes = { [`harvest_${UID}_orders_sold`]: BON_AVANT() };
    const f = fond({ lignes });
    const avant = JSON.stringify(lignes[`harvest_${UID}_orders_sold`]);
    const r = await f.ctx.storeHarvestRow(UID, 'orders_sold', ventes([vente({ price: 123.45 }), vente({ transaction_id: 9003, price: 99 })]), 'www.vinted.fr');
    await attendre(20);
    dit(JSON.stringify(lignes[`harvest_${UID}_orders_sold`]) === avant && r === 'forme-inconnue', 'F1 prix devenu un nombre : la bonne liste des ventes reste, RIEN n’est écrit', JSON.stringify({ r }));
    const fi = lignes[`harvest_${UID}_forme_inconnue`];
    const e = fi && fi.formes && fi.formes.orders_sold;
    dit(e && e.page === 'ventes' && e.champ === 'price' && e.attendu === 'prix' && e.vu === 'number' && Array.isArray(e.forme) && e.forme.includes('price:number'),
      'F2 la forme vue est rangée dans harvest_{uid}_forme_inconnue (page, champ, attendu, vu, empreinte)', JSON.stringify(e));
    const txt = JSON.stringify(fi || {});
    dit(fi && !/Paire invent|123\.45|9001|9003|4444|needs_action/.test(txt), 'F3 la ligne rangée ne porte AUCUNE valeur (ni titre, ni prix, ni n°)', txt.slice(0, 300));
    // F4 : la règle de l'app dit la phrase, une fois.
    const al = regleApp && regleApp.alertesForme([{ id: `harvest_${UID}_forme_inconnue`, f: fi && fi.formes }, { id: 'harvest_222_forme_inconnue', f: fi && fi.formes }], Date.now());
    dit(Array.isArray(al) && al.length === 1 && al[0].texte === 'Vinted a changé sa page des ventes : VRM ne la lit plus, on corrige',
      'F4 l’app dit « Vinted a changé sa page des ventes : VRM ne la lit plus, on corrige » — une fois pour deux comptes', JSON.stringify(al));
    dit(regleApp && regleApp.alertesForme(null) === null && regleApp.alertesForme([]).length === 0, 'F5 lecture ratée ⇒ « pas su » (null), jamais « rien »');
    // F6 : la forme revient ⇒ l'alerte de cette page s'efface.
    await f.ctx.storeHarvestRow(UID, 'orders_sold', ventes([vente(), vente({ transaction_id: 9002 }), vente({ transaction_id: 9004 })]), 'www.vinted.fr');
    await attendre(20);
    const fi2 = lignes[`harvest_${UID}_forme_inconnue`];
    dit(fi2 && fi2.formes && !fi2.formes.orders_sold, 'F6 la forme connue revient : l’alerte « ventes » s’efface', JSON.stringify(fi2 && fi2.formes));
  });
  await essaie('F7', async () => {
    // Champ FACULTATIF absent partout (item_id, transaction_user_status) : rien ne se déclenche.
    const lignes = {};
    const f = fond({ lignes });
    const r = await f.ctx.storeHarvestRow(UID, 'orders_sold', ventes([vente({ item_id: undefined, transaction_user_status: undefined }), vente({ transaction_id: 9002, item_id: undefined, transaction_user_status: undefined })]), 'www.vinted.fr');
    dit(r !== 'forme-inconnue' && !lignes[`harvest_${UID}_forme_inconnue`], 'F7 un champ facultatif simplement absent : aucune alerte, la lecture passe', JSON.stringify({ r }));
    // Un seul article d'une autre forme parmi des bons : rien.
    const g = fond({ lignes: {} });
    const r2 = await g.ctx.storeHarvestRow(UID, 'orders_sold', ventes([vente(), vente({ transaction_id: 9002, price: 12 })]), 'www.vinted.fr');
    dit(r2 !== 'forme-inconnue' && !g.lignes[`harvest_${UID}_forme_inconnue`], 'F8 un article isolé d’une autre forme parmi des bons : aucune alerte', JSON.stringify({ r2 }));
    // La clé de liste renommée (`orders` au lieu de `my_orders`) : bloqué et dit.
    const h = fond({ lignes: { [`harvest_${UID}_orders_purchased`]: BON_AVANT() } });
    const av = JSON.stringify(h.lignes[`harvest_${UID}_orders_purchased`]);
    const r3 = await h.ctx.storeHarvestRow(UID, 'orders_purchased', { orders: [vente()], pagination: {} }, 'www.vinted.fr');
    await attendre(20);
    const e3 = h.lignes[`harvest_${UID}_forme_inconnue`] && h.lignes[`harvest_${UID}_forme_inconnue`].formes.orders_purchased;
    dit(r3 === 'forme-inconnue' && JSON.stringify(h.lignes[`harvest_${UID}_orders_purchased`]) === av && e3 && e3.champ === 'my_orders' && e3.vu === 'absent',
      'F9 la liste renommée (`orders`) : rien d’écrit, « page des achats » signalée', JSON.stringify({ r3, e3 }));
  });
  await essaie('F10', async () => {
    // Voie PASSIVE : une transaction dont `status_title` est devenu un objet.
    const f = fond({ lignes: {} });
    const corps = { transaction: { id: 5, status: 230, status_title: { texte: 'Vendu' }, item_id: 4444, buyer: { id: 1 } } };
    await f.ctx.storeHarvest('www.vinted.fr', 'transaction', 5, JSON.stringify(corps), 'https://www.vinted.fr/api/v2/transactions/5');
    await attendre(20);
    const e = f.lignes[`harvest_${UID}_forme_inconnue`] && f.lignes[`harvest_${UID}_forme_inconnue`].formes.transaction;
    dit(!f.lignes[`harvest_${UID}_txn_5`] && e && e.champ === 'status_title' && e.vu === 'objet', 'F10 voie passive : transaction au `status_title` devenu objet ⇒ pas rangée, signalée', JSON.stringify({ rangee: !!f.lignes[`harvest_${UID}_txn_5`], e }));
    const g = fond({ lignes: {} });
    await g.ctx.storeHarvest('www.vinted.fr', 'transaction', 6, JSON.stringify({ transaction: { id: 6, status: 230, status_title: 'Vendu', item_id: 4444 } }), 'https://www.vinted.fr/api/v2/transactions/6');
    dit(!!g.lignes[`harvest_${UID}_txn_6`] && !g.lignes[`harvest_${UID}_forme_inconnue`], 'F11 la même transaction de forme connue est rangée, sans alerte');
  });

  // ── P : la prudence ──
  const maxHeure = (f) => { try { return vm.runInContext('ACTIONS_MAX_HEURE', f.ctx); } catch (_) { return undefined; } };
  const actions = async (f, n, plafond) => { let ok = 0, dernier = null; for (let i = 0; i < n; i++) { const c = await f.ctx.compterAction(UID, plafond); if (c.ok) ok++; else dernier = c; } return { ok, dernier }; };
  await essaie('P', async () => {
    const f = fond({ vinted: () => ({ status: 429, body: { code: 'too_many' } }) });
    await f.ctx.vintedGet(ACC, '/api/v2/users/111');
    await attendre(30);
    const p = (f.store.vrmPrudence || {})[UID];
    const reste = p ? Number(p.jusqua) - Date.now() : 0;
    dit(p && reste > 23.9 * 3600e3 && reste <= 24 * 3600e3, 'P1 un 429 de Vinted ⇒ ce compte passe 24 h en prudence (rangée dans chrome.storage.local)', JSON.stringify(p));
    const a = await actions(f, 22, maxHeure(f));
    dit(a.ok === 20 && a.dernier && a.dernier.prudence, 'P2 en prudence : 20 actions dans l’heure, la 21e refusée (« prudence »)', JSON.stringify({ ok: a.ok, d: a.dernier }));
    const g = fond({});
    const b = await actions(g, 51, maxHeure(g));
    dit(maxHeure(g) === 50 && b.ok === 50, 'P3 sans refus : le plafond NORMAL reste 50/heure (jamais abaissé hors prudence)', JSON.stringify({ max: maxHeure(g), ok: b.ok }));
    const h = fond({ store: { vrmPrudence: { [UID]: { depuis: Date.now() - 25 * 3600e3, jusqua: Date.now() - 1000, statut: 429 } } } });
    const c = await actions(h, 25, maxHeure(h));
    const lec = await h.ctx.gardeLecture(UID, ACC, 'photos');
    dit(c.ok === 25 && !(lec && lec.code === 'prudence'), 'P4 l’échéance passée, la prudence se lève toute seule (25 actions passent, lectures de fond reprises)', JSON.stringify({ ok: c.ok, lec: lec && lec.code }));
  });
  await essaie('P5', async () => {
    const st = () => ({ vrmPrudence: { [UID]: { depuis: Date.now(), jusqua: Date.now() + 3600e3, statut: 403 } } });
    const f = fond({ store: st() });
    const photos = await f.ctx.gardeLecture(UID, ACC, 'photos');
    const argent = await f.ctx.gardeLecture(UID, ACC, 'argent');
    const colis = await f.ctx.gardeLecture(UID, ACC, 'colis');
    dit(photos && photos.code === 'prudence' && argent && argent.code === 'prudence' && colis === null, 'P5 en prudence : lectures de fond suspendues, les codes de retrait toujours lus', JSON.stringify({ photos: photos && photos.code, argent: argent && argent.code, colis }));
    const pv = []; f.ctx.__vrmPausesVues = pv;
    await f.ctx.pauseRepub('suppression', UID);
    const g = fond({}); const pv2 = []; g.ctx.__vrmPausesVues = pv2;
    await g.ctx.pauseRepub('suppression', UID);
    const ms = pv[0] && pv[0][1], ms2 = pv2[0] && pv2[0][1];
    dit(ms >= 800 && ms <= 1600 && ms2 >= 400 && ms2 <= 800, 'P6 en prudence la pause entre deux gestes est doublée (suppression : 0,8–1,6 s au lieu de 0,4–0,8 s)', JSON.stringify({ prudence: ms, normal: ms2 }));
  });
  await essaie('P7', async () => {
    const lignes = {};
    const f = fond({ lignes, vinted: () => ({ status: 403, body: { code: 'forbidden' } }) });
    await f.ctx.vintedGet(ACC, '/api/v2/users/111');
    await attendre(60);
    const k = Object.keys(lignes).find((x) => /^actions_compte_111_[0-9a-f]{16}$/.test(x));
    const row = k && lignes[k];
    dit(row && Number(row.prudence) > Date.now() + 23 * 3600e3 && Number(row.maxPrudence) === 20 && Number(row.max) === 50, 'P7 la prudence est publiée tout de suite dans la ligne de la jauge (fin, 20), le plafond normal 50 y reste', JSON.stringify(row));
    const rows = row ? [{ id: k, ts: row.ts, max: String(row.max), reserve: String(row.reserve), prudence: String(row.prudence), maxp: String(row.maxPrudence) }] : [];
    const j = jaugeApp && jaugeApp.jaugeDuCompte(rows, UID, Date.now());
    const t = j && jaugeApp.texteJauge(j);
    dit(j && j.max === 20 && j.prudence && t && /^Prudence jusqu’à \d{1,2} h \d{2}$/.test(t.suite) && t.ton === 'geste', 'P8 la jauge de l’app dit « Prudence jusqu’à 18 h 40 » en ambre, sur 20', JSON.stringify({ j, t }));
    const tard = j && jaugeApp.jaugeDuCompte(rows, UID, Number(row.prudence) + 1000);
    dit(tard && tard.max === 50 && !tard.prudence, 'P9 l’échéance passée, la jauge repart sur 50 sans rien effacer', JSON.stringify(tard));
  });
  await essaie('P10', async () => {
    // Un AUTRE Chrome du même compte a reçu le refus : celui-ci l'applique.
    const lignes = { 'actions_compte_111_aaaaaaaaaaaaaaaa': { uid: UID, nav: 'aaaaaaaaaaaaaaaa', ts: [], max: 50, reserve: 5, prudence: Date.now() + 3600e3, maxPrudence: 20 } };
    const f = fond({ lignes });
    const a = await actions(f, 21, maxHeure(f));
    dit(a.ok === 20, 'P10 la prudence posée par un autre Chrome du compte s’applique ici (20)', JSON.stringify({ ok: a.ok }));
    const g = fond({ vinted: () => ({ status: 400, body: { error: 'captcha required' } }) });
    await g.ctx.vintedGet(ACC, '/api/v2/x'); await attendre(30);
    const h = fond({ vinted: () => ({ status: 200, body: '<html><script src="https://js.datadome.co/tags.js"></script></html>' }) });
    await h.ctx.vintedGetHtml(ACC, '/items/1'); await attendre(30);
    dit(!!(g.store.vrmPrudence || {})[UID] && !(h.store.vrmPrudence || {})[UID], 'P11 un refus « captcha » ⇒ prudence ; une page normale qui cite datadome ⇒ rien');
  });

  // ── R : revue de robustesse ──
  await essaie('R14', async () => {
    const f = fond({});
    let enVol = 0, max = 0, n = 0;
    f.ctx.activeUidForDomain = async () => { enVol++; n++; max = Math.max(max, enVol); await attendre(40); enVol--; return null; };
    await Promise.all([f.ctx.visiteVinted(), f.ctx.visiteVinted(), f.ctx.visiteVinted()]);
    await attendre(150);
    dit(max === 1 && n >= 1 && n <= 2, 'R1 trois pages chargées en même temps : UNE visite à la fois (une de plus après, au plus)', JSON.stringify({ max, n }));
  });
  await essaie('R18', async () => {
    const own = '10400000001', autre = '10499999999';
    const lignes = { main: { capturedAt: new Date().toISOString(), vinted_annonce_numeros: {} }, [`harvest_${UID}_listings`]: { payload: { items: [{ id: Number(own), title: 'x', price: { amount: '1' } }] } }, vinted_item_details: {} };
    const f = fond({ lignes });
    const env = (id) => f.envoyer({ from: 'cancale-vcapture', action: 'saveDetail', id, detail: { description: 'Une description inventée assez longue', photos: ['https://images1.vinted.net/t/a.jpg'] } },
      { tab: { id: 7, url: `https://www.vinted.fr/items/${id}` }, origin: 'https://www.vinted.fr', url: `https://www.vinted.fr/items/${id}` });
    await env(autre); await env(own); await attendre(30);
    const d = lignes.vinted_item_details || {};
    dit(!d[autre] && !!d[own], 'R2 l’annonce d’un AUTRE vendeur ouverte n’entre plus dans vinted_item_details ; la sienne oui', JSON.stringify(Object.keys(d)));
    const plein = {}; for (let i = 0; i < 4000; i++) plein[String(20000000000 + i)] = { description: 'd', photos: [] };
    const lignes2 = { ...lignes, vinted_item_details: plein };
    const g = fond({ lignes: lignes2 });
    await g.envoyer({ from: 'cancale-vcapture', action: 'saveDetail', id: own, detail: { description: 'Une description inventée assez longue', photos: ['https://images1.vinted.net/t/a.jpg'] } },
      { tab: { id: 7, url: `https://www.vinted.fr/items/${own}` }, origin: 'https://www.vinted.fr', url: `https://www.vinted.fr/items/${own}` });
    await attendre(30);
    dit(Object.keys(lignes2.vinted_item_details).length === 4000 && !lignes2.vinted_item_details[own], 'R3 4 000 fiches : la ligne est bornée (aucune nouvelle n’entre, aucune n’est retirée)', String(Object.keys(lignes2.vinted_item_details).length));
  });
  await essaie('R22', async () => {
    const f = fond({ vinted: () => ({ status: 200, body: {} }) });
    let r = null, leve = null;
    try { r = await f.ctx.finRepubBrouillon(ACC, { id: '10400000002', uid: UID, draftId: '10400000003', titre: 't', prix: 10, urls: [], corpsCV: '{abîmé', corps: '{}', description: '', sauve: null, tRes: null }); } catch (e) { leve = e; }
    dit(!leve && r && r.etape === 'brouillon-a-refaire' && f.j.vinted.length === 0, 'R4 un job au corps illisible : aucune exception, rien n’est envoyé, « Brouillons → en ligne » le reprend', JSON.stringify({ leve: leve && leve.message, r: r && r.etape, n: f.j.vinted.length }));
  });
  return out;
}

const MUTATIONS = [
  ['la forme douteuse est quand même écrite', 'async function formeBloque(uid, type, brut) {', 'async function formeBloque(uid, type, brut) { return false;'],
  ['un prix de n’importe quelle forme est accepté', 'prix: (v) => !!(', 'prix: (v) => true || !!('],
  ['un champ facultatif absent déclenche l’alerte', "if (!presents.length) { if (oblig) return sortie(c, g, 'absent', items[0]); continue; }", "if (!presents.length) { return sortie(c, g, 'absent', items[0]); }"],
  ['la forme revenue n’efface pas l’alerte', "  if (!d) { await formeRevenue(uid, type); return false; }", '  if (!d) { return false; }'],
  ['un refus de Vinted ne pose pas la prudence', 'if (r && refusDeVinted(r) && ', 'if (false && r && '],
  ['le plafond n’est pas abaissé en prudence', 'const maxP = enPrudence ? Math.min(max, PRUDENCE_ACTIONS_HEURE) : max;', 'const maxP = max;'],
  ['le plafond normal descend à 20', 'const ACTIONS_MAX_HEURE = 50;', 'const ACTIONS_MAX_HEURE = 20;'],
  ['la prudence ne se lève jamais', 'return p && Number(p.jusqua) > Date.now() ? p : null;', 'return p || null;'],
  ['les lectures de fond continuent en prudence', "if (classe !== 'colis' && classe !== 'clic') {", 'if (false) {'],
  ['les délais ne sont pas doublés', 'try { return (await prudenceDe(uid)) ? PRUDENCE_FACTEUR_DELAI : 1; } catch (_) { return 1; }', 'return 1;'],
  ['la jauge ne publie pas la prudence', '...(pr ? { prudence: Number(pr.jusqua)', '...(false ? { prudence: Number(pr.jusqua)'],
  ['la prudence d’un autre Chrome est ignorée', 'const prJusqua = Math.max(prLocale ? Number(prLocale.jusqua) : 0, (autres && Number(autres.prudence)) || 0);', 'const prJusqua = prLocale ? Number(prLocale.jusqua) : 0;'],
  ['un captcha n’est pas un refus', 'return /captcha|datadome|too many requests', 'return false && /captcha|datadome|too many requests'],
  ['plus de verrou de visite', 'if (_visiteEnCours) {', 'if (false) {'],
  ['l’annonce d’un autre est rangée', 'if (await detailEstASoi(sender, msg.id)) await saveItemDetail', 'if (true) await saveItemDetail'],
  ['la ligne des fiches n’est plus bornée', "if (!placePourFiche(cur, key)) { noterDiag('fiches_pleines'); return; }", ''],
  ['corpsCV parsé hors try', 'try { corpsCV = JSON.parse(job.corpsCV); } catch (_) { corpsCV = null; }', 'corpsCV = JSON.parse(job.corpsCV);'],
];

(async () => {
  const S = { bg: path.join(EXT, 'background.js'), src: SRC };
  const res = await auditer(S);
  let rouges = 0;
  for (const r of res) { console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok || !r.d ? '' : '\n     ' + r.d}`); if (!r.ok) rouges++; }
  console.log(`\n${res.length - rouges}/${res.length} verts`);
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(S.bg, 'utf8');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-forme-'));
    let tenues = 0;
    for (const [nom, a, b] of MUTATIONS) {
      if (!src.includes(a)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges++; continue; }
      const f = path.join(tmp, 'background.js');
      fs.writeFileSync(f, src.replace(a, b));
      const r = await auditer({ bg: f, src: SRC });
      const rouge = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      console.log(`${rouge.length ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge.length ? 'rouge : ' + rouge.join(', ') : 'TOUT VERT (le contrôle ne la voit pas)'}`);
      if (rouge.length) tenues++; else rouges++;
    }
    console.log(`\n${tenues}/${MUTATIONS.length} mutations rendent un rouge`);
  }
  process.exit(rouges ? 1 : 0);
})();
