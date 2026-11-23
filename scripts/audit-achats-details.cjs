// ════════════════════════════════════════════════════════════════════════════
//  LE DÉTAIL DES ACHATS : « LOT · N » PROUVÉ (extension 5.443, 23 nov.)
//
//  Mesuré (base de prod, lecture seule, 23 nov.) : 3 479 achats, 144 avec leur transaction rangée ; 112 titres
//  « Lot… », 107 sans transaction ⇒ « Lot ? ». L'extension lit maintenant le détail des transactions d'ACHAT
//  (`capterDetailsAchats`), comme les dates de versement. On EXÉCUTE le vrai background.js (`_fond-vm.cjs`) :
//   1. les « Lot… » d'abord (le plus récent d'abord), puis les autres ; 6 par passage ; des GET ; pause aléatoire ;
//   2. rangé sous `harvest_{uid}_txn_{tx}` (la forme lue par l'app : `items_count`, `order.items[]`) — seulement
//      CETTE transaction (id = n°) côté ACHETEUR ; un achat déjà détaillé n'est jamais relu ;
//   3. au plus 8 par heure, DANS le budget de lecture (20/h), sous la réserve des lecteurs prioritaires
//      (codes, preuves, versements, relevés, suivis : « pas su » ⇒ réserve entière) ;
//   4. un 429 : la série s'arrête, la pause est posée, plus rien ne part ;
//   5. un autre compte connecté dans l'onglet : rien ;
//   6. une requête à la fois, un passage à la fois ; une lecture de la base ratée ⇒ rien ;
//   7. le passage de fond (onglet vinted.fr ouvert) le fait aussi ; l'app est prévenue (`achatsdetails`).
//  §6.1 : rouge sur origin/main (`--src <copie>`) et par MUTATION (`--mutations`). Données inventées.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const UID = '111';
// 30 achats : 6 « Lot… » mêlés aux autres, dates inventées ; 2 achats ont déjà leur transaction.
const ACHATS = Array.from({ length: 30 }, (_, i) => ({
  transaction_id: 9000 + i, title: i % 5 === 0 ? `Lot ${2 + (i % 3)} paires` : 'Paire ' + i, status: 'Commande finalisée',
  date: `2026-${String(1 + (i * 7) % 10).padStart(2, '0')}-${String(1 + (i * 3) % 27).padStart(2, '0')}T10:00:00+01:00`, price: { amount: '40.0', currency_code: 'EUR' } }));
const DEJA = ['9001', '9005'];   // dont un « Lot » déjà détaillé
const lignes = () => {
  const l = { [`harvest_${UID}_orders_purchased`]: { capturedAt: new Date().toISOString(), payload: { my_orders: ACHATS } } };
  for (const tx of DEJA) l[`harvest_${UID}_txn_${tx}`] = { type: 'transaction', payload: { transaction: { id: Number(tx), user_side: 'buyer' } } };
  return l;
};
const article = (tx, k) => ({ id: Number(tx) * 10 + k, title: 'Article ' + k, price: { amount: String(10 + k), currency_code: 'EUR' }, photos: [{ id: k, url: `https://images1.vinted.net/t/${tx}-${k}.jpg` }], size_title: '42', status: 'Très bon état' });
const vintedAvec = (stat, cote) => (r) => {
  const m = /\/api\/v2\/transactions\/(\d+)$/.exec(r.chemin);
  if (!m) return { status: 404, body: {} };
  const s = stat ? stat(m[1]) : 200;
  if (s !== 200) return { status: s, body: {} };
  const a = ACHATS.find((x) => String(x.transaction_id) === m[1]);
  const n = a && /^Lot (\d)/.exec(a.title) ? Number(/^Lot (\d)/.exec(a.title)[1]) : 1;
  const items = Array.from({ length: n }, (_, k) => article(m[1], k + 1));
  return { status: 200, body: { transaction: { id: Number(m[1]), user_side: cote ? cote(m[1]) : 'buyer', items_count: n, status: 450, order: { id: 1, items, item_count: n } } } };
};
const txLus = (j) => j.vinted.map((x) => (/\/transactions\/(\d+)$/.exec(x.chemin) || [])[1]).filter(Boolean);
const lect = (store) => ((store.vrmLectures || {})[UID] || []).length;
const autresRien = () => { const at = Date.now(); return { vrmLecturesDues: { [UID]: { versement: { reste: 0, at }, preuve: { reste: 0, at }, retrait: { reste: 0, at }, releve: { reste: 0, at }, suivi: { reste: 0, at } } } }; };
const parDate = (a, b) => Date.parse(b.date) - Date.parse(a.date);
const ATTENDU = [...ACHATS.filter((a) => /^Lot/.test(a.title)).sort(parDate), ...ACHATS.filter((a) => !/^Lot/.test(a.title)).sort(parDate)]
  .map((a) => String(a.transaction_id)).filter((tx) => !DEJA.includes(tx));

async function controles(SRC, dit) {
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.message)); } };
  const fond = (o = {}) => { const f = faireFond(Object.assign({ src: SRC, lignes: lignes(), vinted: vintedAvec() }, o)); f.ctx.__vrmPausesVues = []; return f; };
  const capter = (f) => (typeof f.ctx.capterDetailsAchats === 'function' ? f.ctx.capterDetailsAchats(UID) : Promise.resolve(null));

  await essaie('1. ordre', async () => {
    const f = fond({ store: autresRien() });
    await capter(f);
    const lus = txLus(f.j);
    dit(lus.length === 6, '1. un passage lit 6 détails d’achat, pas plus', `${lus.length} lu(s)`);
    dit(lus.join(',') === ATTENDU.slice(0, 6).join(','), '1. les « Lot… » d’abord (le plus récent d’abord), puis les autres', `${lus.join(',')} ≠ ${ATTENDU.slice(0, 6).join(',')}`);
    dit(!lus.some((tx) => DEJA.includes(tx)), '1. un achat qui a déjà sa transaction n’est jamais relu');
    const p = (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'versement').map((x) => x[1]);
    dit(p.length === Math.max(0, lus.length - 1) && p.length > 0 && p.every((ms) => ms >= 2000 && ms <= 5000), '1. une pause aléatoire de 2 à 5 s entre deux détails', JSON.stringify(p));
    dit(f.j.vinted.length > 0 && f.j.vinted.every((x) => x.methode === 'GET'), '1. rien n’est écrit chez Vinted (des GET seulement)');
  });

  await essaie('2. rangé', async () => {
    const f = fond({ store: autresRien() });
    await capter(f);
    const tx = ATTENDU[0];
    const l = f.lignes[`harvest_${UID}_txn_${tx}`];
    const t = l && l.payload && l.payload.transaction;
    dit(!!t && t.user_side === 'buyer' && Number(t.items_count) >= 2 && Array.isArray(t.order && t.order.items) && t.order.items.length === Number(t.items_count) && t.order.items[0].photos.length === 1 && t.order.items[0].price.amount,
      '2. la transaction d’un lot est rangée sous harvest_{uid}_txn_{tx} : items_count et order.items (id, titre, prix, photo)', JSON.stringify(t && { n: t.items_count, items: (t.order || {}).items && t.order.items.length }));
    dit(f.j.evts.some((e) => e && e.quoi === 'achatsdetails') || (f.j.journal || []).some((x) => /détails? d'achat/.test(x)), '2. l’app est prévenue (« achatsdetails ») et le journal le dit', JSON.stringify(f.j.journal.slice(-2)));
    const g = fond({ store: autresRien(), vinted: vintedAvec(null, (tx) => (tx === ATTENDU[0] ? 'seller' : 'buyer')) });
    await capter(g);
    dit(!g.lignes[`harvest_${UID}_txn_${ATTENDU[0]}`] && g.j.diags.includes('achat_detail_pas_acheteur'), '2. une réponse qui n’est pas CÔTÉ ACHETEUR n’est pas rangée (noté)');
    const h = fond({ store: autresRien(), vinted: (r) => { const x = vintedAvec()(r); if (x.body && x.body.transaction) x.body.transaction.id = 1234567; return x; } });
    await capter(h);
    dit(!Object.keys(h.lignes).some((k) => /_txn_(?!9001$|9005$)/.test(k)), '2. une réponse qui porte une AUTRE transaction n’est jamais rangée sous ce n°', Object.keys(h.lignes).filter((k) => /_txn_/.test(k)).join(','));
  });

  await essaie('3. budget', async () => {
    const f = fond({ store: autresRien() });
    for (let i = 0; i < 4; i++) { Object.assign(f.store, autresRien()); await capter(f); }
    dit(txLus(f.j).length === 8, '3. quatre passages dans l’heure : 8 détails au plus', `${txLus(f.j).length} lu(s)`);
    dit(lect(f.store) === 8, '3. comptés sur le budget de LECTURE (20/h, tous Chrome)', `lectures=${lect(f.store)}`);
    const g = fond({ store: {} });   // les lecteurs prioritaires : pas su ⇒ leur réserve entière
    g.store.vrmLectures = { [UID]: Array.from({ length: 2 }, () => Date.now()) };
    await capter(g);
    const reserve = Object.values(require('vm').runInContext('lecteursPrioritaires()', g.ctx)).reduce((a, b) => a + b, 0);   // versement, relevé, codes, preuves, suivi
    dit(reserve > 0 && lect(g.store) === Math.max(2, 20 - reserve) && txLus(g.j).length === Math.max(0, 20 - reserve - 2), `3. lecteurs prioritaires « pas su » : jamais leur place (s’arrête à ${20 - reserve} lectures dans l’heure)`, `${txLus(g.j).length} lu(s), total ${lect(g.store)}`);
  });

  await essaie('4. 429', async () => {
    let n = 0;
    const f = fond({ store: autresRien(), vinted: vintedAvec(() => (++n === 2 ? 429 : 200)) });
    await capter(f);
    dit(txLus(f.j).length === 2 && !!f.store.vrmPauseVinted, '4. un 429 au 2e détail : la série s’arrête, la pause est posée', `${txLus(f.j).length} lu(s)`);
    const avant = f.j.vinted.length;
    await capter(f);
    dit(f.j.vinted.length === avant, '4. pendant la pause : plus rien');
  });

  await essaie('5. autre compte', async () => {
    const f = fond({ store: autresRien() });
    f.ctx.compteConnecte = async () => '222';
    await capter(f);
    dit(typeof f.ctx.capterDetailsAchats === 'function' && txLus(f.j).length === 0, '5. un autre compte connecté dans l’onglet : rien', `${txLus(f.j).length} lu(s)`);
  });

  await essaie('6. une à la fois', async () => {
    const f = fond({ store: autresRien() });
    await Promise.all([capter(f), capter(f), capter(f)]);
    const lus = txLus(f.j);
    dit(lus.length > 0 && f.j.maxEnVol === 1 && new Set(lus).size === lus.length, '6. une requête à la fois, un passage à la fois (aucun achat lu deux fois)', `${lus.length} lu(s), en vol ${f.j.maxEnVol}`);
    const g = fond({ store: autresRien(), lectureKO: (u) => /orders_purchased|_txn_/.test(u) });
    await capter(g);
    dit(txLus(g.j).length === 0, '6. la base ne répond pas : rien n’est lu chez Vinted (pas su)');
  });

  await essaie('7. fond', async () => {
    const f = fond({ store: autresRien() });
    if (typeof f.ctx.tickVersements === 'function') await f.ctx.tickVersements();
    dit(txLus(f.j).some((tx) => tx === ATTENDU[0]), '7. le passage de fond (onglet vinted.fr ouvert) lit aussi le détail des achats', txLus(f.j).join(','));
    const g = fond({ store: autresRien(), onglets: [] });
    await g.ctx.tickVersements();
    dit(txLus(g.j).length === 0, '7. sans onglet vinted.fr : rien');
  });
}

async function lancer(SRC) {
  let ko = 0; const echecs = [];
  const dit = (ok, m, d) => { if (!ok) { ko++; echecs.push(m); } if (!process.env.SILENCE) console.log(`${ok ? '  ✅' : '  ❌'} ${m}${!ok && d ? ' — ' + d : ''}`); };
  await controles(SRC, dit);
  return { ko, echecs };
}

(async () => {
  const SRC = cheminSource();
  console.log('── capterDetailsAchats (' + path.relative(process.cwd(), SRC) + ')');
  const r = await lancer(SRC);
  let ko = r.ko;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const MUT = {
      'titre-ignore': ["return [...l.filter((o) => RE_TITRE_LOT.test(String(o.title || ''))), ...l.filter((o) => !RE_TITRE_LOT.test(String(o.title || '')))];", 'return l;'],
      'sans-plafond-heure': ['if (lus.length >= ACHAT_DETAIL_MAX_HEURE) {', 'if (false) {'],
      'cote-ignore': ["if (String(t.user_side || '') !== 'buyer') { noterDiag('achat_detail_pas_acheteur'); continue; }", ''],
      'identite-ignoree': ["if (String(t.id == null ? '' : t.id) !== tx) { noterDiag('achat_detail_autre_tx'); continue; }", ''],
      'reserve-ignoree': ["(classe === 'enligne' || classe === 'suivi' || classe === 'import' || classe === 'achat') ? 'enligne' : 'photos'", "(classe === 'enligne' || classe === 'suivi' || classe === 'import') ? 'enligne' : 'photos'"],
      'garde-ignoree': ["if (refus) { noterDiag(`achat_detail_refus_${String(refus.code || '').replace(/[^a-z-]/g, '').slice(0, 24)}`); break; }", 'if (false) { break; }'],
      'deja-relu': ['return !avecDetail.has(tx) && !(faits[tx]', 'return !(faits[tx]'],
    };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achats-det-'));
    for (const [nom, [a, b]] of Object.entries(MUT)) {
      if (!texte.includes(a)) { console.log(`  ❌ mutation ${nom} : texte introuvable`); ko++; continue; }
      const f = path.join(tmp, nom + '.js'); fs.writeFileSync(f, texte.replace(a, b));
      process.env.SILENCE = '1'; const m = await lancer(f); delete process.env.SILENCE;
      console.log(`  ${m.ko ? '✅' : '❌'} mutation « ${nom} » : ${m.ko} rouge(s)${m.ko ? ' — ' + m.echecs.slice(0, 2).join(' | ') : ' — LE CONTRÔLE NE MORD PAS'}`);
      if (!m.ko) ko++;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
