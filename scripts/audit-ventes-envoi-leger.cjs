// ════════════════════════════════════════════════════════════════════════════
//  LES VENTES S'ENVOIENT LÉGÈRES (extension 5.326, 8 nov.)
//
//  Son iPhone : « Dernier envoi refusé — la base n'a pas répondu, ça réessaie
//  tout seul » en boucle, et les ventes de shop_cancale (~2 160) « vues par
//  e-mail, pas encore relues sur Vinted · relues le 6 nov. 11 h 22 ». Lu dans le
//  code : la fusion de la 5.323 RELIT puis RÉÉCRIT la ligne `orders_sold`
//  entière (2 000 ventes) depuis le téléphone à chaque fenêtre qui bouge.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) ET la vraie route du
//  serveur (`api/_lib/commandes-leger.js`, `routeCommandes`) sur une fausse
//  base à état qui applique la projection `select=`, les filtres du
//  comparer-et-échanger (PATCH `data->>rev` / `data->>capturedAt`) et le 409
//  d'une création concurrente. Commandes à la FORME réelle (prix objet
//  `{amount}`, photo `{url, high_resolution}`, n° à 11 chiffres, statuts longs).
//   1. 2 000 ventes en base, une visite lit 320 (une neuve, une qui change) ⇒
//      chaque envoi < 200 Ko, l'extension ne relit ni ne réécrit la liste,
//      la base a 2 001 ventes, la neuve en tête, l'état frais gagne, « relues
//      le » avance ; l'app ne la dit plus « vue par e-mail » ;
//   2. un changement HORS de la tête envoyée ⇒ la route le DEMANDE, il part seul ;
//   3. la base qui ne répond pas (503), une coupure réseau ⇒ RIEN écrit, la
//      date ne bouge pas, la carte a le code, la famille et une taille < 200 Ko ;
//   4. 50 ventes au même titre/prix/marque ⇒ 50 lignes distinctes, l'état de
//      chacune par SON n° ; une empreinte trafiquée ⇒ 400, rien écrit ;
//   5. le résumé du widget/rappels = la règle de l'extension sur la liste entière
//      (exclusions des transactions 450 comprises) ;
//   6. une extension ancienne réécrit la ligne entre la lecture et l'écriture du
//      serveur ⇒ l'échange échoue, relu, rien de perdu ;
//   7. ligne absente, 2 000 ventes lues (fenêtre de 2 000 sur 2 162) ⇒ par lots,
//      chaque envoi < 200 Ko, la date n'avance qu'au dernier ; lecture complète
//      grosse ⇒ remplace (sans relecture côté extension) ; complète petite ⇒ voie
//      directe ; route absente (404) ⇒ voie d'avant.
//  Données inventées (dépôt public).
//  Usage : node scripts/audit-ventes-envoi-leger.cjs [--src background.js] [--serveur api/_lib/x.js]
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource, projette } = require('./_fond-vm.cjs');
const SRC = cheminSource();
const iSrv = process.argv.indexOf('--serveur');
const SERVEUR = iSrv > 0 ? path.resolve(process.argv[iSrv + 1]) : path.join(__dirname, '..', 'api', '_lib', 'commandes-leger.js');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };

const UID = '111', ROW = `harvest_${UID}_orders_sold`, ROWA = `harvest_${UID}_orders_purchased`, OWNER = '0b0b0b0b-1111-4222-8333-444455556666';
const H = 3600000, KO200 = 200 * 1024;
// Une vente à la forme RÉELLE de `my_orders` (avant allègement : l'extension allège elle-même).
const hex = (n, g) => { let s = ''; let x = (g * 2654435761) >>> 0; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; s += '0123456789abcdef'[x >>> 28]; } return s; };
const TX0 = 15800000000;
const vente = (i, extra = {}) => Object.assign({
  transaction_id: TX0 + i, conversation_id: 21900000000 + i, item_id: 5100000000 + i,
  title: `Nike Air Max 90 Essential blanc taille ${38 + (i % 8)}`,
  price: { amount: (40 + (i % 50)).toFixed(1), currency_code: 'EUR' },
  status: 'La commande est finalisée. Les fonds ont été transférés sur ton porte-monnaie Vinted.', transaction_user_status: 'completed',
  date: new Date(Date.parse('2026-11-05T07:50:12Z') - i * 3 * H).toISOString().replace('.000Z', '+01:00'),
  photo: { id: 30000000000 + i, url: `https://images1.vinted.net/t/04_00${hex(3, i)}_${hex(24, i + 7)}/f800/${1762300000 + i}.webp?s=${hex(40, i + 3)}`,
    high_resolution: { id: hex(8, i), timestamp: 1762300000 + i }, dominant_color: '#E1E0DE', is_main: true, thumbnails: [{ type: 'thumb70x100', url: 'https://images1.vinted.net/t/x/70x100/1.webp' }] },
  buyer: { id: 90000 + i, login: 'acheteur' + i }, transaction_user_status_updated_at: '2026-11-05T08:00:00+01:00', item_ids: [5100000000 + i],
}, extra);
const AEXP = { status: 'Le paiement a été validé. Envoie le colis avant le 12/11/2026', transaction_user_status: 'needs_action' };
// Une ligne rangée par l'extension (forme allégée, comme en base), il y a `ilYa`.
const allege = (o) => { const out = {}; for (const c of ['date', 'price', 'title', 'status', 'transaction_id', 'conversation_id', 'transaction_user_status']) if (o[c] !== undefined) out[c] = o[c];
  out.item_id = o.item_id; out.photo = { url: o.photo.url, high_resolution: { timestamp: o.photo.high_resolution.timestamp } }; return out; };
const rangee = (ilYa, liste, total = 2162) => ({ type: 'orders_sold', uid: UID, domain: 'www.vinted.fr', capturedAt: new Date(Date.now() - ilYa).toISOString(),
  nItems: liste.length, payload: { pagination: { current_page: 1, per_page: 100, total_pages: 22, total_entries: total }, my_orders: liste.map(allege) },
  resume: { n: liste.length, txns: [], at: Date.now() - ilYa } });
const vintedVentes = (liste, total = 2162) => (req) => {
  const m = /\/api\/v2\/my_orders\?type=(sold|purchased)&page=(\d+)&per_page=(\d+)/.exec(req.chemin);
  if (!m) return { status: 404, body: {} };
  const page = Number(m[2]), per = Number(m[3]);
  return { status: 200, body: { my_orders: liste.slice((page - 1) * per, page * per), pagination: { current_page: page, per_page: per, total_pages: Math.ceil(total / per), total_entries: total } } };
};

// ── La fausse base vue du SERVEUR (son fetch) : la MÊME `lignes` que le fond.
const R = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'string' ? JSON.parse(body) : body), text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
function fetchServeur(etat) {
  return async (url, o = {}) => {
    const u = decodeURIComponent(String(url)), m = String(o.method || 'GET').toUpperCase();
    etat.appels.push({ m, u });
    if (/\/auth\/v1\/user/.test(u)) return R(200, { id: OWNER, email: 'banc@vrm.test', email_confirmed_at: '2026-01-01' });
    if (/app_data\?select=owner&limit=1/.test(u)) return R(200, []);
    const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    const lignes = etat.lignes();
    if (m === 'GET') {
      if (etat.lectureKO && etat.lectureKO(u)) return R(522, '<html>522</html>');
      const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || '';
      return R(200, lignes[id] === undefined ? [] : [projette({ id, data: lignes[id] }, sel)]);
    }
    if (m === 'PATCH') {
      if (etat.avantEcriture) { const f = etat.avantEcriture; etat.avantEcriture = null; f(lignes); }
      if (etat.ecritureKO) return R(503, {});
      const row = lignes[id];
      if (row === undefined) return R(200, []);
      for (const [, k, cond] of u.matchAll(/[?&]data->>(\w+)=([^&]+)/g)) {
        const v = row[k] == null ? null : String(row[k]);
        if (cond === 'is.null' ? v !== null : v !== cond.replace(/^eq\./, '')) return R(200, []);
      }
      lignes[id] = JSON.parse(o.body).data; etat.ecritures++;
      return R(200, [{ id }]);
    }
    if (m === 'POST') {
      const c = JSON.parse(o.body);
      if (lignes[c.id] !== undefined) return R(409, {});
      lignes[c.id] = c.data; etat.ecritures++;
      return R(201, '');
    }
    return R(404, {});
  };
}

let routeCommandes = null;
function fond(opts = {}) {
  const lus = [], etat = { appels: [], ecritures: 0, lectureKO: opts.serveurKO || null, avantEcriture: opts.avantEcriture || null, apres: [] };
  let f = null;
  etat.lignes = () => f.lignes;
  const vrm = async (entree) => {
    if (opts.vrm) { const r = await opts.vrm(entree); if (r) return r; }
    if (opts.routeAbsente || !/mode=commandes/.test(entree.url)) return { status: 404, body: { erreur: 'mode inconnu' } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    const avant = globalThis.fetch; globalThis.fetch = fetchServeur(etat);
    try { await routeCommandes({ method: entree.methode, headers: { authorization: entree.headers.Authorization || entree.headers.authorization }, body: entree.corps, query: { mode: 'commandes' } }, res); }
    finally { globalThis.fetch = avant; }
    const l = f.lignes[ROW] || f.lignes[ROWA];
    etat.apres.push({ statut: res.statusCode, cap: l && l.capturedAt, n: l && l.payload && l.payload.my_orders.length });
    return { status: res.statusCode, body: res.body };
  };
  f = faireFond(Object.assign({ src: SRC }, opts, { vrm, lectureKO: (u) => { lus.push(u); return opts.lectureKO ? opts.lectureKO(u) : false; } }));
  return { f, lus, etat };
}
const liste = (f, id = ROW) => (f.lignes[id] && f.lignes[id].payload && f.lignes[id].payload.my_orders) || [];
const envois = (f) => f.j.vrmApi.filter((e) => e.mode === 'commandes');
const lecturesListe = (lus, id = ROW) => lus.filter((u) => u.includes(`id=eq.${id}`) && /my_orders/.test(u) && !/txn/.test(u)).length;
const ecritDirect = (f, id = ROW) => f.j.posts.filter((p) => p.includes(id)).length;
const ko_ = (n) => `${(n / 1024).toFixed(1)} Ko`;

(async () => {
  routeCommandes = (await import(pathToFileURL(SERVEUR).href)).routeCommandes;
  const { ventesEmailFraiches } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'venteEmailFraiche.js')).href);

  console.log('── 0. Tailles (forme réelle, allégée comme en base)');
  const base2000 = Array.from({ length: 2000 }, (_, k) => vente(k + 1));
  const ligne2000 = JSON.stringify([{ id: ROW, data: rangee(0, base2000) }]);
  const pl2000 = JSON.stringify(rangee(0, base2000).payload.my_orders);
  console.log(`   ligne orders_sold de 2 000 ventes : ${ko_(ligne2000.length)} (envoi entier) · liste relue par la fusion 5.323 : ${ko_(pl2000.length)} · soit ${(ligne2000.length / 2000).toFixed(0)} o/vente`);
  console.log(`   à 1 Mb/s montant : ${(ligne2000.length * 8 / 1e6).toFixed(1)} s · à 3 Mb/s : ${(ligne2000.length * 8 / 3e6).toFixed(1)} s (plus la relecture, autant)`);

  console.log('── 1. 2 000 ventes en base (il y a 2 h), une visite lit 320 : une neuve, la n°5 change');
  const chezVinted1 = [vente(0, AEXP)].concat(Array.from({ length: 2161 }, (_, k) => (k + 1 === 5 ? vente(5, { status: 'Retour initié', transaction_user_status: 'waiting' }) : vente(k + 1))));
  const avantFetch = Date.now();
  await essaie('envoi léger 320 / 2 000', async () => {
    const { f, lus, etat } = fond({ lignes: { [ROW]: rangee(2 * H, base2000) }, vinted: vintedVentes(chezVinted1) });
    const r = await f.ctx.rafraichirVentes(UID);
    const l = liste(f), e = envois(f);
    const tailles = e.map((x) => x.octets), total = tailles.reduce((a, b) => a + b, 0);
    console.log(`   envois : ${e.length} · ${tailles.map(ko_).join(' + ')} = ${ko_(total)}`);
    dit(r && r.ecrit === true, 'la lecture est RANGÉE (rafraîchi)', JSON.stringify(r));
    dit(e.length >= 1 && tailles.every((t) => t < KO200), 'chaque envoi fait moins de 200 Ko', tailles.map(ko_).join(', '));
    dit(e.length >= 1 && total < KO200, 'tout l’envoi de la visite fait moins de 200 Ko', ko_(total));
    dit(ecritDirect(f) === 0, 'l’extension ne réécrit PAS la ligne entière', `${ecritDirect(f)} écriture(s) directe(s)`);
    dit(lecturesListe(lus) === 0, 'l’extension ne relit PAS la liste rangée (égress du téléphone)', `${lecturesListe(lus)} lecture(s)`);
    dit(l.length === 2001, 'les 2 000 rangées restent, la neuve s’ajoute (2 001)', `${l.length}`);
    dit(l[0] && l[0].transaction_id === TX0, 'la vente neuve est en TÊTE', l[0] && String(l[0].transaction_id));
    dit(l.some((o) => o.transaction_id === TX0 + 2000), 'la plus ancienne (hors fenêtre) est toujours là');
    const v5 = l.find((o) => o.transaction_id === TX0 + 5);
    dit(!!v5 && v5.status === 'Retour initié', 'une vente relue prend son état FRAIS (par son n°)', v5 && v5.status);
    dit(new Set(l.map((o) => o.transaction_id)).size === l.length, 'aucune vente en double');
    const cap = Date.parse(f.lignes[ROW].capturedAt);
    dit(cap >= avantFetch - 1000 && cap <= Date.now(), '« relues le … » avance à la lecture', f.lignes[ROW].capturedAt);
    dit(f.lignes[ROW].nItems === 2001 && f.lignes[ROW].resume && f.lignes[ROW].resume.n === 2001, 'compteur et résumé suivent (nItems, resume.n)');
    dit(l[0] && !('buyer' in l[0]) && l[0].photo && Object.keys(l[0].photo).sort().join() === 'high_resolution,url', 'la base reçoit la commande ALLÉGÉE (rien de personnel de plus)', JSON.stringify(Object.keys(l[0] || {})));
    // L'app : la vente vue par e-mail 10 min AVANT la lecture n'est plus « vue par e-mail ».
    const mail = { type: 'vente', tx: String(TX0), uid: UID, at: new Date(cap - 10 * 60000).toISOString(), titre: 'x', prix: '50' };
    const fr = ventesEmailFraiches({ mails: [mail], comptes: [{ vinted_user_id: UID }], ventes: l, ko: [], lectures: { [UID]: cap } });
    dit(fr.length === 0, 'l’app : la vente est dans la liste relue — plus « vue par e-mail, pas encore relue »', JSON.stringify(fr.map((x) => x.status)));
    const flux = (f.store.vrmFlux || {}).vinted || {};
    dit(flux.okAt && !(flux.koAt > flux.okAt), 'la carte du logo : dernier envoi réussi');
    // La même visite 10 min plus tard, rien de neuf : rien ne part.
    const n0 = envois(f).length;
    await f.ctx.chrome.storage.local.set({ vrmDerniereVente: {} });
    const r2 = await f.ctx.rafraichirVentes(UID);
    dit(r2 && r2.raison === 'inchange' && envois(f).length === n0, 'relue sans rien de neuf (< 1 h) : rien n’est envoyé', JSON.stringify(r2));
  });

  console.log('── 2. Un changement HORS de la tête envoyée (la n°250 finalisée) ⇒ demandé, envoyé seul');
  await essaie('manquant', async () => {
    const chez = Array.from({ length: 2162 }, (_, k) => (k + 1 === 250 ? vente(250, { status: 'Remboursement effectué', transaction_user_status: 'failed' }) : vente(k + 1)));
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H, base2000) }, vinted: vintedVentes(chez) });
    const r = await f.ctx.rafraichirVentes(UID);
    const e = envois(f);
    dit(r && r.ecrit === true, 'rangé', JSON.stringify(r));
    console.log(`   envois : ${e.map((x) => ko_(x.octets)).join(' + ')}`);
    dit(e.length === 2 && e[1].corps.commandes.length === 1 && e[1].corps.commandes[0].transaction_id === TX0 + 250, 'second envoi : la seule commande que la base n’a pas à l’identique', e.map((x) => x.corps.commandes.length).join('+'));
    const v = liste(f).find((o) => o.transaction_id === TX0 + 250);
    dit(!!v && v.status === 'Remboursement effectué', 'la n°250 a son état frais', v && v.status);
    dit(liste(f).length === 2000, 'rien d’autre ne bouge (2 000)');
  });

  console.log('── 3. La base ne répond pas / le réseau coupe ⇒ RIEN écrit, dit');
  await essaie('base KO', async () => {
    const r0 = rangee(2 * H, base2000);
    const { f, etat } = fond({ lignes: { [ROW]: r0 }, vinted: vintedVentes(chezVinted1), serveurKO: (u) => /harvest_111_orders_sold/.test(u) });
    const avant = JSON.stringify(f.lignes[ROW]);
    const r = await f.ctx.rafraichirVentes(UID);
    dit(r && r.ecrit === false, 'rien n’est « rafraîchi »', JSON.stringify(r));
    dit(JSON.stringify(f.lignes[ROW]) === avant && etat.ecritures === 0, 'la ligne en base est INCHANGÉE (date comprise)');
    const flux = (f.store.vrmFlux || {}).vinted || {};
    const dern = (flux.refus || [])[flux.refus ? flux.refus.length - 1 : 0] || {};
    dit(dern.statut === '503' && dern.famille === 'harvest_orders_sold' && dern.octets > 0 && dern.octets < KO200, 'la carte : code 503, famille, taille < 200 Ko', JSON.stringify(dern));
  });
  await essaie('réseau coupé', async () => {
    const { f, etat } = fond({ lignes: { [ROW]: rangee(2 * H, base2000) }, vinted: vintedVentes(chezVinted1), vrm: () => ({ reseau: true }) });
    const avant = JSON.stringify(f.lignes[ROW]);
    const r = await f.ctx.rafraichirVentes(UID);
    const flux = (f.store.vrmFlux || {}).vinted || {};
    const dern = (flux.refus || []).slice(-1)[0] || {};
    dit(r && r.ecrit === false && JSON.stringify(f.lignes[ROW]) === avant && etat.ecritures === 0, 'coupure : rien écrit, rien compté');
    dit(dern.statut === 'reseau' && dern.octets > 0 && dern.octets < KO200, 'la carte : « réseau », et l’essai suivant est PETIT (< 200 Ko)', JSON.stringify(dern));
    dit(ecritDirect(f) === 0, 'pas de repli sur l’envoi entier après une coupure');
  });

  console.log('── 4. 50 ventes au même titre, même prix, même marque');
  await essaie('jumelles', async () => {
    const jum = (i, extra = {}) => vente(i, Object.assign({ title: 'Nike Air Force 1 blanc 42', price: { amount: '60.0', currency_code: 'EUR' } }, extra));
    const b = Array.from({ length: 2000 }, (_, k) => (k < 50 ? jum(k + 1) : vente(k + 1)));
    const chez = [jum(0, AEXP)].concat(Array.from({ length: 2161 }, (_, k) => (k < 50 ? (k + 1 === 33 ? jum(33, { status: 'Retour initié', transaction_user_status: 'waiting' }) : jum(k + 1)) : vente(k + 1))));
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H, b) }, vinted: vintedVentes(chez) });
    await f.ctx.rafraichirVentes(UID);
    const l = liste(f).filter((o) => o.title === 'Nike Air Force 1 blanc 42');
    dit(l.length === 51 && new Set(l.map((o) => o.transaction_id)).size === 51, '51 jumelles = 51 lignes distinctes', `${l.length}`);
    const chg = l.filter((o) => o.status === 'Retour initié').map((o) => o.transaction_id);
    dit(chg.length === 1 && chg[0] === TX0 + 33, 'seule la n°33 change d’état (par son n°, jamais par titre)', JSON.stringify(chg));
  });
  await essaie('empreinte trafiquée', async () => {
    const { f, etat } = fond({ lignes: { [ROW]: rangee(2 * H, base2000) }, vinted: vintedVentes(chezVinted1),
      vrm: async (e) => { if (e.corps && Array.isArray(e.corps.commandes) && e.corps.commandes[0]) e.corps.commandes[0].status = 'trafiqué'; return null; } });
    const avant = JSON.stringify(f.lignes[ROW]);
    await f.ctx.rafraichirVentes(UID);
    dit(etat.apres[0] && etat.apres[0].statut === 400 && JSON.stringify(f.lignes[ROW]) === avant, 'une commande dont l’empreinte ne correspond pas ⇒ 400, rien écrit', JSON.stringify(etat.apres[0]));
  });

  console.log('── 5. Le résumé du widget / des rappels = la règle de l’extension sur la liste entière');
  await essaie('résumé', async () => {
    const b = Array.from({ length: 2000 }, (_, k) => (k === 400 ? vente(k + 1, AEXP) : vente(k + 1)));
    const r0 = rangee(2 * H, b); r0.resume.txns = [String(TX0 + 401)];
    const chez = [vente(0, AEXP), vente(-1, AEXP)].concat(b.slice(0, 2160).map((o, k) => (k === 2 ? vente(3, AEXP) : o)));
    const txn = { type: 'transaction', payload: { transaction: { id: TX0 - 1, status: 450 } } };
    const { f } = fond({ lignes: { [ROW]: r0, [`harvest_${UID}_txn_${TX0 - 1}`]: txn }, vinted: vintedVentes(chez) });
    await f.ctx.rafraichirVentes(UID);
    const row = f.lignes[ROW];
    const attendu = f.ctx.retirerDuResume(f.ctx.resumeCommandes('orders_sold', row.payload), new Set([String(TX0 - 1)]));
    dit(JSON.stringify([...row.resume.txns].sort()) === JSON.stringify([...attendu.txns].sort()), 'résumé = règle de l’extension sur les 2 002 (n° à expédier)', `${JSON.stringify(row.resume.txns)} vs ${JSON.stringify(attendu.txns)}`);
    dit(row.resume.txns.includes(String(TX0 + 401)) && row.resume.txns.includes(String(TX0)) && !row.resume.txns.includes(String(TX0 - 1)), 'hors fenêtre gardée, neuve comptée, transaction 450 exclue');
  });

  console.log('── 6. Une extension ancienne réécrit la ligne pendant la fusion du serveur');
  await essaie('concurrence', async () => {
    const autre = vente(-5, AEXP);
    const { f, etat } = fond({ lignes: { [ROW]: rangee(2 * H, base2000) }, vinted: vintedVentes(chezVinted1),
      avantEcriture: (lignes) => { const l = JSON.parse(JSON.stringify(lignes[ROW])); l.payload.my_orders.unshift(allege(autre)); l.capturedAt = new Date().toISOString(); l.nItems++; lignes[ROW] = l; } });
    const r = await f.ctx.rafraichirVentes(UID);
    const l = liste(f);
    dit(r && r.ecrit === true, 'rangé après relecture', JSON.stringify(r));
    dit(l.some((o) => o.transaction_id === TX0 - 5) && l.some((o) => o.transaction_id === TX0), 'la vente écrite par l’autre ET la neuve sont là (rien perdu)', `${l.length}`);
    dit(etat.apres.length >= 1 && etat.appels.filter((a) => a.m === 'GET' && /orders_sold/.test(a.u)).length === 2, 'l’échange a échoué une fois, la ligne a été RELUE');
  });

  console.log('── 7. Ligne absente, 2 000 lues sur 2 162 (moisson) ⇒ par lots');
  await essaie('lots', async () => {
    const { f, etat } = fond({ lignes: {}, vinted: vintedVentes(chezVinted1) });
    const payload = { my_orders: chezVinted1.slice(0, 2000), pagination: { current_page: 1, per_page: 100, total_pages: 22, total_entries: 2162 } };
    const issue = await f.ctx.storeHarvestRow(UID, 'orders_sold', payload, 'www.vinted.fr');
    const e = envois(f);
    dit(issue === 'ecrit' && liste(f).length === 2000, 'les 2 000 sont rangées', `${issue} · ${liste(f).length}`);
    console.log(`   envois : ${e.map((x) => ko_(x.octets)).join(', ')}`);
    dit(e.length > 1 && e.every((x) => x.octets < KO200), `${e.length} envois, chacun < 200 Ko`, e.map((x) => ko_(x.octets)).join(', '));
    const caps = etat.apres.map((a) => a.cap);
    dit(caps.length > 2 && caps.slice(1, -1).every((c) => c === caps[0]) && caps[caps.length - 1] === caps[0], 'la date est posée à la 1re part et ne bouge qu’avec la fenêtre ENTIÈRE');
  });
  await essaie('lots sur une ligne existante', async () => {
    // Les 2 000 rangées il y a 2 h ont TOUTES changé d'état chez Vinted : la fenêtre part par lots.
    const chez = Array.from({ length: 2162 }, (_, k) => vente(k + 1, { status: 'Retour initié', transaction_user_status: 'waiting' }));
    const r0 = rangee(2 * H, base2000);
    const { f, etat } = fond({ lignes: { [ROW]: r0 }, vinted: vintedVentes(chez) });
    const payload = { my_orders: chez.slice(0, 2000), pagination: { current_page: 1, per_page: 100, total_pages: 22, total_entries: 2162 } };
    const issue = await f.ctx.storeHarvestRow(UID, 'orders_sold', payload, 'www.vinted.fr');
    const caps = etat.apres.map((a) => a.cap);
    dit(issue === 'ecrit' && liste(f).every((o) => o.status === 'Retour initié'), 'les 2 000 prennent leur état frais', `${issue}`);
    dit(caps.length > 2 && caps.slice(0, -1).every((c) => c === r0.capturedAt) && Date.parse(caps[caps.length - 1]) > Date.parse(r0.capturedAt),
      '« relues le … » ne bouge PAS tant qu’une part manque, puis avance à la dernière', JSON.stringify([caps[0], caps[caps.length - 1], caps.length]));
    dit(envois(f).every((x) => x.octets < KO200), 'chaque lot < 200 Ko', envois(f).map((x) => ko_(x.octets)).join(', '));
  });
  await essaie('complète grosse', async () => {
    const b = Array.from({ length: 401 }, (_, k) => vente(k + 1));
    const chez = b.slice(0, 400);
    const { f, lus } = fond({ lignes: { [ROW]: rangee(2 * H, b, 400) }, vinted: vintedVentes(chez, 400) });
    const payload = { my_orders: chez, pagination: { current_page: 1, per_page: 400, total_pages: 1, total_entries: 400 } };
    const issue = await f.ctx.storeHarvestRow(UID, 'orders_sold', payload, 'www.vinted.fr');
    dit(issue === 'ecrit' && liste(f).length === 400 && !liste(f).some((o) => o.transaction_id === TX0 + 401), 'lecture COMPLÈTE (400/400) : remplace, la 401e sort', `${issue} · ${liste(f).length}`);
    dit(ecritDirect(f) === 0 && lecturesListe(lus) === 0 && envois(f).every((x) => x.octets < KO200), 'sans relecture ni réécriture entière depuis l’extension');
  });
  await essaie('complète petite', async () => {
    const chez = Array.from({ length: 30 }, (_, k) => vente(k + 1));
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H, chez.slice(0, 20), 30) }, vinted: vintedVentes(chez, 30) });
    const issue = await f.ctx.storeHarvestRow(UID, 'orders_sold', { my_orders: chez, pagination: { current_page: 1, per_page: 30, total_entries: 30 } }, 'www.vinted.fr');
    dit(issue === 'ecrit' && ecritDirect(f) === 1 && envois(f).length === 0 && liste(f).length === 30, 'complète et petite (30) : écrite directement, comme avant');
  });
  await essaie('route absente', async () => {
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H, base2000) }, vinted: vintedVentes(chezVinted1), routeAbsente: true });
    const r = await f.ctx.rafraichirVentes(UID);
    dit(r && r.ecrit === true && liste(f).length === 2001 && ecritDirect(f) === 1, 'vrm.center d’avant (404) : la voie d’avant range quand même (rien perdu au déploiement)', JSON.stringify(r));
  });
  await essaie('achats passifs', async () => {
    const achats = Array.from({ length: 1985 }, (_, k) => vente(k + 1));
    const ra = rangee(2 * H, achats, 1990); ra.type = 'orders_purchased';
    const { f } = fond({ lignes: { [ROWA]: ra } });
    const page = { my_orders: [vente(0, { status: 'Colis déposé au point relais Vinted Go', transaction_user_status: 'needs_action' })].concat(achats.slice(0, 19)), pagination: { current_page: 1, per_page: 20, total_pages: 100, total_entries: 1990 } };
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_purchased', null, JSON.stringify(page));
    const l = liste(f, ROWA);
    dit(l.length === 1986 && l[0].transaction_id === TX0 && ecritDirect(f, ROWA) === 0, 'achats (voie passive) : envoi léger, le neuf en tête, 1 985 gardés', `${l.length}`);
    dit((f.lignes[ROWA].resume.txns || []).includes(String(TX0)), 'l’achat au point relais est dans le résumé (widget)');
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
