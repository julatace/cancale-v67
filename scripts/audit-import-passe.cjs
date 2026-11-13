// ════════════════════════════════════════════════════════════════════════════
//  L'IMPORT DE TON PASSÉ — 12 MOIS, ANNONCES COMPRISES (extension 5.373, lot 47)
//
//  Julien : « au premier jour, l'import des 12 derniers mois (ventes, achats,
//  annonces) de chaque compte Vinted relié, avec une barre de progression ;
//  dans le budget de LECTURE, étalé ; reprise après fermeture du navigateur,
//  jamais deux fois la même page ; échec ou compte déconnecté ⇒ dit, reprend seul ».
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on COMPTE ce qui part
//  chez Vinted, ce qui est rangé, ce qui est publié dans `import_vinted_{uid}` :
//   A. 12 mois : 2 000 ventes sur ~4 ans ⇒ l'import s'arrête à la page qui passe
//      l'horizon, n'en lit aucune au-delà, compte EXACTEMENT celles des 12 mois ;
//      la ligne dit `horizonMois: 12` ; une date illisible n'arrête rien ;
//   B. l'estimation « 400 / ~730 » : jamais sous ce qui est lu, jamais au-dessus
//      du total de Vinted ; les pages estimées ;
//   C. étalé : 12 mois = 20 pages ⇒ 12 la 1re heure, pause « rythme » dite
//      (reprise dans le futur), la suite l'heure d'après, à la page 13 ;
//      les lectures jamais au-dessus de 20/h ;
//   D. jamais deux fois la même page : le service worker meurt au milieu d'un
//      passage ⇒ la reprise part de la page SUIVANTE de la dernière rangée ;
//   E. annonces : dressing déjà rangé en entier ⇒ aucune lecture ; absent ⇒ UNE
//      lecture d'un trait, rangée `complet` ; trop gros pour l'heure ⇒ `partiel`,
//      aucune lecture ; budget de l'heure trop court ⇒ pause, rien de lu ;
//   F. compte déconnecté / Vinted qui répond mal ⇒ `souci` publié, et ça reprend
//      seul au passage suivant (souci effacé) ;
//   G. un état d'AVANT (5.344, fini, sans annonces) ⇒ complété en scalaires,
//      republié, aucune lecture Vinted ;
//   H. « Tout récupérer » (son clic) : tout l'historique, au-delà de 12 mois.
//  §6.1 : rouge sur origin/main (`--src <copie>`), et par MUTATION (`--mutations`).
//  Données inventées. Usage : node scripts/audit-import-passe.cjs [--src f] [--mutations]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const UID = '111';
const JOUR = 86400000;
const FINALISEE = "Commande finalisée - l'acheteur a validé la commande";
const T0 = Date.now() - 2 * 3600000;
// 2 000 ventes, une toutes les 18 h (≈ 4 ans) : 12 mois ≈ 486 ventes.
const VENTES = Array.from({ length: 2000 }, (_, i) => ({ transaction_id: 600000 - i, title: 'Paire ' + i, status: FINALISEE, date: new Date(T0 - i * JOUR * 0.75).toISOString() }));
const DANS_12 = VENTES.filter((o) => Date.parse(o.date) >= Date.now() - 365 * JOUR).length;
// 2 000 ventes en 11 mois (étalé : 20 pages dans l'horizon).
const DENSES = Array.from({ length: 2000 }, (_, i) => ({ transaction_id: 700000 - i, title: 'Paire ' + i, status: FINALISEE, date: new Date(T0 - i * JOUR * 0.165).toISOString() }));
const ACHATS = Array.from({ length: 150 }, (_, i) => ({ transaction_id: 900000 - i, title: 'Achat ' + i, status: FINALISEE, date: new Date(T0 - i * JOUR).toISOString() }));
const annonces = (n) => Array.from({ length: n }, (_, i) => ({ id: 7000 + i, title: 'Annonce ' + i, price: { amount: '50.0', currency_code: 'EUR' } }));
const pageDe = (liste, page, per) => {
  const p = Math.max(1, Number(page) || 1), pp = Math.min(100, Number(per) || 20);
  return { my_orders: liste.slice((p - 1) * pp, p * pp), pagination: { current_page: p, per_page: pp, total_entries: liste.length, total_pages: Math.ceil(liste.length / pp) } };
};
const vintedAvec = ({ ventes = VENTES, achats = ACHATS, dressing = annonces(49), stat = null } = {}) => (r) => {
  const u = new URL('https://x' + r.chemin);
  const s = stat ? stat(u) : 200;
  if (s !== 200) return { status: s, body: {} };
  if (/^\/api\/v2\/wardrobe\/[^/]+\/items$/.test(u.pathname)) {
    const pa = Number(u.searchParams.get('page')) || 1;
    return { status: 200, body: { items: dressing.slice((pa - 1) * 100, pa * 100), pagination: { current_page: pa, total_entries: dressing.length, total_pages: Math.ceil(dressing.length / 100) } } };
  }
  if (u.pathname !== '/api/v2/my_orders') return { status: 404, body: {} };
  const type = u.searchParams.get('type'), page = u.searchParams.get('page');
  return { status: 200, body: pageDe(type === 'sold' ? ventes : achats, page, u.searchParams.get('per_page')) };
};
const lues = (j) => j.vinted.map((x) => { const u = new URL('https://x' + x.chemin); return u.pathname === '/api/v2/my_orders' ? `${u.searchParams.get('type')}:${u.searchParams.get('page')}` : (/wardrobe/.test(u.pathname) ? `annonces:${u.searchParams.get('page')}` : null); }).filter(Boolean);
const lect = (store) => ((store.vrmLectures || {})[UID] || []).length;
const autresRien = () => { const at = Date.now(); return { vrmLecturesDues: { [UID]: { versement: { reste: 0, at }, preuve: { reste: 0, at }, retrait: { reste: 0, at }, releve: { reste: 0, at } } } }; };
const uneHeurePlusTard = (f) => { delete f.store.vrmLectures; delete f.store.vrmImportLus; Object.assign(f.store, autresRien()); };
const etat = (f) => ((f.store.vrmImport || {})[UID]) || null;
const rangees = (f, type) => { const d = f.lignes[`harvest_${UID}_${type}`]; return d && d.payload && Array.isArray(d.payload.my_orders) ? d.payload.my_orders : []; };
const ligne = (f) => f.lignes[`import_vinted_${UID}`] || null;
const LISTINGS_COMPLET = { nItems: 49, payload: { pagination: { total_entries: 49 }, items: annonces(49) } };
const ACHATS_COMPLET = { nItems: 150, payload: { pagination: { total_entries: 150 }, my_orders: ACHATS } };

async function controles(SRC, dit) {
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.message)); } };
  const fond = (o = {}) => { const v = o.v || {}; delete o.v; const f = faireFond(Object.assign({ src: SRC, vinted: vintedAvec(v), store: autresRien() }, o)); f.ctx.__vrmPausesVues = []; return f; };
  const jusquAuBout = async (f, heures = 6) => { for (let h = 0; h < heures && !(etat(f) && etat(f).fin); h++) { uneHeurePlusTard(f); for (let i = 0; i < 4; i++) await f.ctx.tickImport(); } };

  await essaie('A. 12 mois', async () => {
    const f = fond({ lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    await jusquAuBout(f);
    const p = lues(f.j).filter((x) => /^sold:/.test(x));
    const derniere = Math.ceil(DANS_12 / 100) + (DANS_12 % 100 === 0 ? 1 : 0);
    dit(p.length === derniere && p[p.length - 1] === `sold:${derniere}`, `A. 12 mois (${DANS_12} ventes) : ${derniere} pages lues, pas une au-delà de l’horizon`, p.join(' '));
    const v = rangees(f, 'orders_sold');
    dit(VENTES.filter((o) => Date.parse(o.date) >= Date.now() - 365 * JOUR).every((o) => v.some((x) => String(x.transaction_id) === String(o.transaction_id))), 'A. toutes les ventes des 12 mois sont rangées');
    const l = ligne(f);
    dit(!!l && l.etat === 'fini' && l.horizonMois === 12, 'A. la ligne dit « fini » sur 12 mois', JSON.stringify(l && { e: l.etat, h: l.horizonMois }));
    dit(!!l && l.ventes && l.ventes.lus === DANS_12 && l.ventes.horizon === true && l.ventes.fini === true, `A. ventes comptées EXACTEMENT sur 12 mois (${DANS_12}), pas le total de Vinted (2 000)`, JSON.stringify(l && l.ventes));
    dit(f.j.journal.some((t) => /Ton passé Vinted importé \(12 mois\)/.test(t)), 'A. le journal le dit');
    const avant = f.j.vinted.length;
    uneHeurePlusTard(f); await f.ctx.tickImport();
    dit(f.j.vinted.length === avant, 'A. fini : plus aucune lecture', `${f.j.vinted.length - avant}`);
    // Une date illisible n'arrête rien (pas su ≠ fini).
    const sansDate = VENTES.slice(0, 600).map((o) => Object.assign({}, o, { date: 'pas une date' }));
    const g = fond({ v: { ventes: sansDate }, lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    await jusquAuBout(g);
    const pg = lues(g.j).filter((x) => /^sold:/.test(x));
    dit(pg.length === 6 && ligne(g) && ligne(g).ventes.horizon !== true && ligne(g).ventes.lus === 600, 'A. dates illisibles : lu jusqu’à la dernière page de Vinted (rien deviné)', `${pg.join(' ')} ${JSON.stringify(ligne(g) && ligne(g).ventes)}`);
  });

  await essaie('B. estimation', async () => {
    const f = fond({ lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    await f.ctx.tickImport();
    const l = ligne(f);
    const v = l && l.ventes;
    dit(!!v && v.lus === 400 && Number.isFinite(v.estime) && v.estime >= v.lus && v.estime <= 2000, 'B. « 400 / ~N » : estimation jamais sous le lu, jamais au-dessus du total', JSON.stringify(v));
    dit(!!v && Math.abs(v.estime - DANS_12) <= DANS_12 * 0.25, `B. l’estimation tombe près du vrai (${DANS_12})`, String(v && v.estime));
    dit(!!v && v.pages === 4 && v.pagesEstimees === Math.ceil(v.estime / 100), 'B. pages lues / estimées', JSON.stringify(v && { p: v.pages, pe: v.pagesEstimees }));
    dit(!!l && l.enCours === 'ventes' && Number(l.resteMin) > 0, 'B. le type en cours et la durée restante', JSON.stringify(l && { c: l.enCours, m: l.resteMin }));
  });

  await essaie('C. étalé', async () => {
    const f = fond({ v: { ventes: DENSES }, lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    for (let i = 0; i < 6; i++) await f.ctx.tickImport();
    const p1 = lues(f.j);
    dit(p1.length === 12, 'C. 1re heure : 12 pages, pas une de plus', p1.join(' '));
    dit(lect(f.store) <= 20, 'C. lectures ≤ 20/h', String(lect(f.store)));
    const l = ligne(f);
    dit(!!l && l.etat === 'pause' && l.cause === 'rythme' && Number(l.repriseA) > Date.now() && l.ventes.pagesEstimees >= 19, 'C. la ligne dit « pause, suite à … » et ~20 pages estimées', JSON.stringify(l && { e: l.etat, c: l.cause, r: l.repriseA, pe: l.ventes.pagesEstimees }));
    uneHeurePlusTard(f);
    for (let i = 0; i < 4; i++) await f.ctx.tickImport();
    const p2 = lues(f.j).slice(p1.length);
    dit(p2[0] === 'sold:13', 'C. l’heure d’après : reprise à la page 13', p2.join(' '));
    await jusquAuBout(f);
    const tout = lues(f.j);
    dit(new Set(tout).size === tout.length, 'C. aucune page lue deux fois', `${tout.length} lue(s), ${new Set(tout).size} distincte(s)`);
    dit(rangees(f, 'orders_sold').length === 2000 && ligne(f) && ligne(f).etat === 'fini', 'C. les 2 000 ventes des 12 mois rangées, fini', String(rangees(f, 'orders_sold').length));
  });

  await essaie('D. navigateur fermé en route', async () => {
    const f = fond({ v: { ventes: DENSES }, lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    const vrai = f.ctx.vintedGet;
    let k = 0;
    f.ctx.vintedGet = async (...a) => { if (++k === 3) throw new Error('service worker arrêté'); return vrai(...a); };
    await f.ctx.tickImport();
    f.ctx.vintedGet = vrai;
    await f.ctx.tickImport();
    const p = lues(f.j);
    dit(p.slice(0, 2).join(' ') === 'sold:1 sold:2' && p[2] === 'sold:3', 'D. arrêté après 2 pages rangées : la reprise lit la page 3, pas la 1', p.join(' '));
    dit(new Set(p).size === p.length, 'D. jamais deux fois la même page', p.join(' '));
  });

  await essaie('E. annonces', async () => {
    const f = fond({ lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    await jusquAuBout(f);
    dit(!lues(f.j).some((x) => /^annonces:/.test(x)) && ligne(f) && ligne(f).annonces && ligne(f).annonces.fini && ligne(f).annonces.lus === 49, 'E. dressing déjà rangé en entier : aucune lecture, « 49 ✓ »', JSON.stringify(ligne(f) && ligne(f).annonces));
    const g = fond({ v: { dressing: annonces(230) }, lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET } });
    await jusquAuBout(g);
    const pa = lues(g.j).filter((x) => /^annonces:/.test(x));
    dit(pa.join(' ') === 'annonces:1 annonces:2 annonces:3', 'E. dressing absent : lu d’un trait (3 pages)', pa.join(' '));
    const ln = g.lignes[`harvest_${UID}_listings`];
    dit(!!ln && ln.nItems === 230 && ln.payload && ln.payload.items.length === 230, 'E. rangé en entier (230 annonces)', String(ln && ln.nItems));
    dit(g.j.diags.includes('dressing_complet_range'), 'E. rangé comme lecture COMPLÈTE (fait foi)');
    dit(ligne(g) && ligne(g).etat === 'fini' && ligne(g).annonces.lus === 230, 'E. la ligne dit « 230 annonces ✓ » et fini', JSON.stringify(ligne(g) && ligne(g).annonces));
    const h = fond({ v: { dressing: annonces(1500) }, lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: { nItems: 1000, payload: { pagination: { total_entries: 1500 }, items: annonces(1000) } } } });
    await jusquAuBout(h);
    dit(!lues(h.j).some((x) => /^annonces:/.test(x)) && ligne(h) && ligne(h).annonces && ligne(h).annonces.partiel === true, 'E. 1 500 annonces (plus d’une heure) : partiel, dit, aucune lecture', JSON.stringify(ligne(h) && ligne(h).annonces));
    // Budget de l'heure trop court : 3 pages d'import déjà lues, 11 annonces-pages ⇒ pause, rien.
    const q = fond({ v: { dressing: annonces(1050) }, lignes: { [`harvest_${UID}_orders_sold`]: { nItems: 50, payload: { pagination: { total_entries: 50 }, my_orders: VENTES.slice(0, 50) } }, [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: { nItems: 1000, payload: { pagination: { total_entries: 1050 }, items: annonces(1000) } } } });
    const t = Date.now();
    q.store.vrmImportLus = { [UID]: [t - 1000, t - 2000, t - 3000] };
    await q.ctx.tickImport();
    dit(!lues(q.j).length && etat(q) && etat(q).pause && etat(q).pause.cause === 'rythme', 'E. 11 pages d’annonces, 3 déjà lues dans l’heure : pause, aucune page entamée', JSON.stringify({ p: lues(q.j), pause: etat(q) && etat(q).pause }));
    uneHeurePlusTard(q); await q.ctx.tickImport();
    dit(lues(q.j).filter((x) => /^annonces:/.test(x)).length === 11 && ligne(q) && ligne(q).etat === 'fini', 'E. l’heure d’après : 11 pages d’un trait, fini', lues(q.j).join(' '));
  });

  await essaie('F. souci', async () => {
    const f = fond({ lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    f.ctx.compteConnecte = async () => null;
    await f.ctx.importerHistorique(UID);
    dit(!lues(f.j).length && ligne(f) && ligne(f).souci === 'deconnecte', 'F. compte déconnecté de vinted.fr : rien lu, la ligne le dit', JSON.stringify(ligne(f) && { s: ligne(f).souci, e: ligne(f).etat }));
    f.ctx.compteConnecte = async () => UID;
    await f.ctx.tickImport();
    dit(lues(f.j).length === 4 && ligne(f) && ligne(f).souci === null, 'F. reconnecté : ça reprend seul, le souci s’efface', JSON.stringify({ p: lues(f.j), s: ligne(f) && ligne(f).souci }));
    let n = 0;
    const g = fond({ v: { stat: () => (++n === 2 ? 500 : 200) }, lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    await g.ctx.tickImport();
    dit(ligne(g) && ligne(g).souci === 'echec' && Number(etat(g).sold.page) === 2, 'F. Vinted répond 500 : « lecture ratée » dit, la page 2 reste à lire', JSON.stringify(ligne(g) && { s: ligne(g).souci, page: etat(g).sold.page }));
    await g.ctx.tickImport();
    dit(lues(g.j)[2] === 'sold:2' && ligne(g).souci === null, 'F. passage suivant : reprise seule à la page 2', lues(g.j).join(' '));
  });

  await essaie('G. état d’avant', async () => {
    const vieux = { v: 1, debut: 1, demande: false, at: 1, fin: 2, publie: true, sold: { page: 14, lus: 1250, total: 1250, fini: true }, purchased: { page: 4, lus: 230, total: 230, fini: true } };
    const f = fond({ store: Object.assign(autresRien(), { vrmImport: { [UID]: vieux } }), lignes: { [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    await f.ctx.tickImport();
    dit(f.j.vinted.length === 0 && ligne(f) && ligne(f).etat === 'fini' && ligne(f).annonces && ligne(f).annonces.lus === 49 && ligne(f).v === 2, 'G. import 5.344 fini : annonces complétées en scalaires, republié, aucune lecture', JSON.stringify(ligne(f) && { e: ligne(f).etat, a: ligne(f).annonces, v: ligne(f).v, n: f.j.vinted.length }));
  });

  await essaie('H. tout récupérer', async () => {
    const f = fond({ lignes: { [`harvest_${UID}_orders_purchased`]: ACHATS_COMPLET, [`harvest_${UID}_listings`]: LISTINGS_COMPLET } });
    await f.ctx.demanderImportTout(UID);
    await new Promise((ok) => setTimeout(ok, 100));
    await jusquAuBout(f, 30);
    const p = lues(f.j).filter((x) => /^sold:/.test(x));
    dit(p.length === 20 && ligne(f) && ligne(f).horizonMois === null && ligne(f).ventes.lus === 2000, 'H. « Tout récupérer » : les 20 pages, au-delà des 12 mois', `${p.length} page(s) ${JSON.stringify(ligne(f) && { h: ligne(f).horizonMois, v: ligne(f).ventes.lus })}`);
  });
}

async function lancer(SRC) {
  let ko = 0, ok = 0;
  await controles(SRC, (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } });
  return { ko, ok };
}

const MUTATIONS = [
  ['horizon ignoré', 'const passeHorizon = horizon !== null && dates.length && Math.min(...dates) < horizon;', 'const passeHorizon = false;'],
  ['horizon compte la page entière', 'ty.lus = Math.min(ty.lus, avant + dedans);', ''],
  ['date illisible prise pour ancienne', "const dates = lot.map((o) => Date.parse((o && o.date) || '')).filter(Number.isFinite);", "const dates = lot.map((o) => { const d = Date.parse((o && o.date) || ''); return Number.isFinite(d) ? d : 0; });"],
  ['estimation sans borne basse', 'return Math.max(e, lus);', 'return e;'],
  ['état noté seulement en fin de passage', 'if (!(await poserImportSiMeme(uid, st))) { relance = true; break; }', ''],
  ['annonces lues en morceaux (sans attendre la place)', 'if (lus.length + besoin > IMPORT_MAX_HEURE) {', 'if (false) {'],
  ['annonces trop grosses lues quand même', "if (besoin > IMPORT_MAX_HEURE) { an.fini = true; an.partiel = true; noterDiag('import_annonces_trop'); return 0; }", ''],
  ['annonces rangées sans « complet »', "await storeHarvestRow(uid, 'listings', out, domain, { complet: true });", "await storeHarvestRow(uid, 'listings', out, domain);"],
  ['annonces : dressing rangé ignoré', 'if (Number.isFinite(nb) && Number.isFinite(tot) && tot >= 0 && nb >= tot) return { lus: tot, total: tot, fini: true, deja: true };', ''],
  ['souci jamais effacé', 'delete st.souci;\n    const tot = Number(pg.total_entries)', 'const tot = Number(pg.total_entries)'],
  ['compte déconnecté tu', "const cause = refus.code === 'vinted-absent' || refus.code === 'autre-compte' ? 'deconnecte' : refus.code === 'prudence' ? 'prudence' : 'echec';\n    st.souci = { cause, at: Date.now() };", ''],
  ['état d’avant pris pour fini (annonces)', '&& typeImportFini(st.annonces));', ');'],
];

(async () => {
  const SRC = cheminSource();
  const r = await lancer(SRC);
  console.log(r.ko ? `\n❌ import de ton passé : ${r.ok} vert(s), ${r.ko} rouge(s)` : `\n✅ import de ton passé : ${r.ok} vert(s), 0 rouge(s)`);
  let koMut = 0;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-passe-'));
    for (const [nom, de, vers] of MUTATIONS) {
      if (!texte.includes(de)) { koMut++; console.log(`❌ mutation « ${nom} » : la ligne est introuvable — le contrôle ne prouve rien`); continue; }
      const f = path.join(dir, 'background.js');
      fs.writeFileSync(f, texte.replace(de, vers));
      const log = console.log; console.log = () => {};
      let m; try { m = await lancer(f); } finally { console.log = log; }
      if (m.ko > 0) console.log(`✅ mutation « ${nom} » : ${m.ko} rouge(s) — le contrôle mord`);
      else { koMut++; console.log(`❌ mutation « ${nom} » : tout reste vert`); }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(r.ko || koMut ? 1 : 0);
})();
