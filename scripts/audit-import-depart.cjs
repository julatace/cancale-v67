// ════════════════════════════════════════════════════════════════════════════
//  L'IMPORT DE DÉPART — TOUT L'HISTORIQUE, SANS RISQUE DE PLUS (extension 5.344)
//
//  Julien : « un nouveau vendeur récupère tout son historique Vinted (ventes,
//  achats) dès le premier jour ; une barre de progression s'il y en a
//  beaucoup ». La visite ne lit que 10 pages de 100 : au-delà, rien.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on COMPTE ce qui part
//  chez Vinted, ce qui est rangé en base, ce qui est publié :
//   1. un compte neuf : 4 pages par passage, dans l'ordre, pause ALÉATOIRE de
//      3 à 8 s, des GET seulement ;
//   2. l'heure : 12 pages au plus, le total des lectures jamais au-dessus de 20 ;
//      l'état dit « en pause, reprise à … » ;
//   3. jusqu'au bout : 1 250 ventes et 230 achats rangés, uniques, rien perdu
//      (une vente déjà rangée hors des pages reste), « Tout est récupéré » ;
//   4. une base déjà complète : AUCUNE lecture, fini tout de suite ;
//   5. une base à 1 000 : on reprend une page avant (la 10), pas à la 1 ;
//   6. un 429 : la série s'arrête, la pause est posée, rien ne part pendant ;
//      après, on reprend À LA PAGE où on s'était arrêté ;
//   7. un autre compte dans l'onglet : rien ; un compte qui change en route :
//      la page est jetée, elle n'avance pas ;
//   8. notre base refuse la page : elle n'avance pas (relue au passage suivant) ;
//   9. la base muette au départ : rien ne part (pas su) ;
//  10. jamais la place de l'argent et des colis (« pas su » ⇒ leur réserve) ;
//  11. une requête à la fois, un passage à la fois ;
//  12. sans onglet vinted.fr : rien ;
//  13. la carte du logo reçoit l'état (lu / total) ; jamais lu ⇒ rien ;
//  14. « Tout récupérer » (carte, app) : le compte de l'onglet seulement, page 1 ;
//  15. les photos laissent un passage à l'import seulement quand il en a noté.
//  §6.1 : rouge sur origin/main (`--src <copie>`), et par MUTATION (`--mutations`).
//  Données inventées. Usage : node scripts/audit-import-depart.cjs [--src f] [--mutations]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const UID = '111';
const N_VENTES = 1250, N_ACHATS = 230;
const FINALISEE = "Commande finalisée - l'acheteur a validé la commande";
const VENTES = Array.from({ length: N_VENTES }, (_, i) => ({ transaction_id: 500000 - i, title: 'Paire ' + i, status: FINALISEE, date: new Date(Date.UTC(2026, 9, 30) - i * 86400000 / 4).toISOString() }));
const ACHATS = Array.from({ length: N_ACHATS }, (_, i) => ({ transaction_id: 900000 - i, title: 'Achat ' + i, status: FINALISEE, date: new Date(Date.UTC(2026, 9, 30) - i * 86400000).toISOString() }));
const pageDe = (liste, page, per) => {
  const p = Math.max(1, Number(page) || 1), pp = Math.min(100, Number(per) || 20);
  return { my_orders: liste.slice((p - 1) * pp, p * pp), pagination: { current_page: p, per_page: pp, total_entries: liste.length, total_pages: Math.ceil(liste.length / pp) } };
};
const vintedAvec = (stat) => (r) => {
  const u = new URL('https://x' + r.chemin);
  if (u.pathname !== '/api/v2/my_orders') return { status: 404, body: {} };
  const type = u.searchParams.get('type'), page = u.searchParams.get('page');
  const s = stat ? stat(type, Number(page)) : 200;
  if (s !== 200) return { status: s, body: {} };
  return { status: 200, body: pageDe(type === 'sold' ? VENTES : ACHATS, page, u.searchParams.get('per_page')) };
};
const pagesLues = (j) => j.vinted.map((x) => { const u = new URL('https://x' + x.chemin); return u.pathname === '/api/v2/my_orders' ? `${u.searchParams.get('type')}:${u.searchParams.get('page')}` : null; }).filter(Boolean);
const lect = (store) => ((store.vrmLectures || {})[UID] || []).length;
const autresRien = () => { const at = Date.now(); return { vrmLecturesDues: { [UID]: { versement: { reste: 0, at }, preuve: { reste: 0, at }, retrait: { reste: 0, at }, releve: { reste: 0, at } } } }; };
const uneHeurePlusTard = (f) => { delete f.store.vrmLectures; delete f.store.vrmImportLus; Object.assign(f.store, autresRien()); };
const etat = (f) => ((f.store.vrmImport || {})[UID]) || null;
const rangees = (f, type) => { const d = f.lignes[`harvest_${UID}_${type}`]; return d && d.payload && Array.isArray(d.payload.my_orders) ? d.payload.my_orders : []; };
const ligneImport = (f) => f.lignes[`import_vinted_${UID}`] || null;

async function controles(SRC, dit) {
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.message)); } };
  const fond = (o = {}) => { const f = faireFond(Object.assign({ src: SRC, vinted: vintedAvec() }, o)); f.ctx.__vrmPausesVues = []; return f; };

  await essaie('1. compte neuf', async () => {
    const f = fond({ store: autresRien() });
    await f.ctx.tickImport();
    const p = pagesLues(f.j);
    dit(p.join(' ') === 'sold:1 sold:2 sold:3 sold:4', '1. un compte neuf : 4 pages de ventes au premier passage, dans l’ordre', p.join(' '));
    dit(f.j.vinted.every((x) => /per_page=100/.test(x.chemin)), '1. 100 commandes par page (le moins de lectures possible)');
    const ps = (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'import').map((x) => x[1]);
    dit(ps.length === 3 && ps.every((ms) => ms >= 3000 && ms <= 8000) && new Set(ps).size > 1, '1. une pause ALÉATOIRE de 3 à 8 s entre deux pages', JSON.stringify(ps));
    dit(f.j.vinted.every((x) => x.methode === 'GET'), '1. rien n’est écrit chez Vinted (des GET seulement)');
    dit(rangees(f, 'orders_sold').length === 400, '1. les 400 ventes lues sont rangées', String(rangees(f, 'orders_sold').length));
    const l = ligneImport(f);
    dit(!!l && l.etat === 'encours' && l.ventes && l.ventes.lus === 400 && l.ventes.total === N_VENTES, '1. SA ligne `import_vinted_111` dit « 400 sur 1 250 »', JSON.stringify(l && { e: l.etat, v: l.ventes }));
    dit(!f.j.posts.flat().includes('main'), '1. jamais la ligne `main`');
  });

  await essaie('2. l’heure', async () => {
    const f = fond({ store: autresRien() });
    for (let i = 0; i < 5; i++) await f.ctx.tickImport();
    const n = pagesLues(f.j).length;
    dit(n === 12, '2. cinq passages dans l’heure : 12 pages, pas une de plus', `${n} page(s)`);
    dit(lect(f.store) <= 20 && lect(f.store) === n, '2. comptées sur le budget de LECTURE (20/h), jamais au-dessus', `lectures=${lect(f.store)}`);
    const st = etat(f);
    dit(!!st && st.pause && st.pause.cause === 'rythme' && Number(st.pause.jusqua) > Date.now(), '2. l’état dit « en pause, reprise à … »', JSON.stringify(st && st.pause));
    const l = ligneImport(f);
    dit(!!l && l.etat === 'pause' && Number(l.repriseA) > Date.now(), '2. et SA ligne aussi (etat pause, repriseA)', JSON.stringify(l && { e: l.etat, r: l.repriseA }));
  });

  await essaie('3. jusqu’au bout', async () => {
    const lignes = { [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), nItems: 1, payload: { my_orders: [{ transaction_id: 1, title: 'Ancienne, hors pages', status: FINALISEE }] } } };
    const f = fond({ store: autresRien(), lignes });
    for (let h = 0; h < 6 && !(etat(f) && etat(f).fin); h++) { uneHeurePlusTard(f); for (let i = 0; i < 3; i++) await f.ctx.tickImport(); }
    const v = rangees(f, 'orders_sold'), a = rangees(f, 'orders_purchased');
    const ids = new Set(v.map((o) => String(o.transaction_id)));
    dit(ids.size === v.length && VENTES.every((o) => ids.has(String(o.transaction_id))), '3. les 1 250 ventes rangées, chacune une fois', `${v.length} rangée(s), ${ids.size} distincte(s)`);
    dit(ids.has('1'), '3. la vente déjà rangée hors des pages reste (rien perdu)');
    dit(String(v[0] && v[0].transaction_id) === String(VENTES[0].transaction_id), '3. la plus récente en tête (page 1 devant)', String(v[0] && v[0].transaction_id));
    dit(a.length === N_ACHATS, '3. les 230 achats rangés', String(a.length));
    const l = ligneImport(f);
    dit(!!l && l.etat === 'fini' && l.ventes.lus === N_VENTES && l.achats.lus === N_ACHATS && l.ventes.fini && l.achats.fini, '3. « Tout est récupéré » : 1 250 ventes, 230 achats', JSON.stringify(l && { e: l.etat, v: l.ventes, a: l.achats }));
    dit(f.j.journal.some((t) => /Historique Vinted récupéré/.test(t)), '3. le journal le dit');
    const avant = f.j.vinted.length;
    uneHeurePlusTard(f); await f.ctx.tickImport();
    dit(f.j.vinted.length === avant, '3. fini : plus aucune lecture', `${f.j.vinted.length - avant} requête(s)`);
    const pl = pagesLues(f.j);
    dit(new Set(pl).size === pl.length, '3. aucune page lue deux fois', `${pl.length} lue(s), ${new Set(pl).size} distincte(s)`);
  });

  await essaie('4. déjà complet', async () => {
    const lignes = {
      [`harvest_${UID}_orders_sold`]: { nItems: 300, payload: { pagination: { total_entries: 300 }, my_orders: VENTES.slice(0, 300) } },
      [`harvest_${UID}_orders_purchased`]: { nItems: 230, payload: { pagination: { total_entries: 230 }, my_orders: ACHATS } },
    };
    const f = fond({ store: autresRien(), lignes });
    await f.ctx.tickImport();
    dit(f.j.vinted.length === 0, '4. une base déjà complète : aucune lecture chez Vinted', `${f.j.vinted.length} requête(s)`);
    const l = ligneImport(f);
    dit(!!l && l.etat === 'fini' && l.ventes.lus === 300, '4. et « Tout est récupéré » tout de suite', JSON.stringify(l && { e: l.etat, v: l.ventes }));
  });

  await essaie('5. base à 1 000', async () => {
    const lignes = { [`harvest_${UID}_orders_sold`]: { nItems: 1000, payload: { pagination: { total_entries: N_VENTES }, my_orders: VENTES.slice(0, 1000) } } };
    const f = fond({ store: autresRien(), lignes });
    await f.ctx.tickImport();
    const p = pagesLues(f.j);
    dit(p.join(' ') === 'sold:10 sold:11 sold:12 sold:13', '5. 1 000 déjà rangées : on reprend page 10 (une de recouvrement), pas page 1', p.join(' '));
    dit(rangees(f, 'orders_sold').length === N_VENTES, '5. les 1 250 ventes sont là après', String(rangees(f, 'orders_sold').length));
  });

  await essaie('6. 429', async () => {
    let n = 0;
    const f = fond({ store: autresRien(), vinted: vintedAvec(() => (++n === 3 ? 429 : 200)) });
    await f.ctx.tickImport();
    dit(pagesLues(f.j).length === 3, '6. un 429 à la 3e page : la série s’arrête net', pagesLues(f.j).join(' '));
    dit(!!f.store.vrmPauseVinted && f.store.vrmPauseVinted.statut === 429, '6. la pause est posée');
    dit(etat(f) && etat(f).pause && etat(f).pause.cause === 'vinted' && Number(etat(f).sold.page) === 3, '6. l’état dit « Vinted freine » et garde la page 3', JSON.stringify(etat(f) && { p: etat(f).pause, page: etat(f).sold.page }));
    const avant = f.j.vinted.length;
    await f.ctx.tickImport();
    await f.ctx.importerHistorique(UID);
    dit(f.j.vinted.length === avant, '6. pendant la pause : plus rien', `${f.j.vinted.length - avant} requête(s)`);
    delete f.store.vrmPauseVinted; delete f.store.vrmPrudence; uneHeurePlusTard(f);   // 5.357 : pause ET prudence (24 h) passées
    await f.ctx.tickImport();
    dit(pagesLues(f.j)[avant] === 'sold:3', '6. après la pause : reprise à la page 3', pagesLues(f.j).slice(avant).join(' '));
  });

  await essaie('7. autre compte', async () => {
    const f = fond({ store: autresRien() });
    f.ctx.compteConnecte = async () => '222';
    await f.ctx.importerHistorique(UID);
    await f.ctx.tickImport();
    dit(pagesLues(f.j).length === 0, '7. un autre compte connecté dans l’onglet : rien', `${pagesLues(f.j).length} page(s)`);
    const g = fond({ store: autresRien() });
    let k = 0;
    g.ctx.compteConnecte = async () => (++k >= 2 ? '222' : UID);
    await g.ctx.tickImport();
    dit(rangees(g, 'orders_sold').length === 0 && Number(etat(g) && etat(g).sold.page) === 1, '7. le compte change pendant la lecture : la page est jetée, elle n’avance pas', JSON.stringify({ r: rangees(g, 'orders_sold').length, page: etat(g) && etat(g).sold.page }));
  });

  await essaie('8. base refuse', async () => {
    const f = fond({ store: autresRien(), ecritureKO: (id) => /orders_sold/.test(id) });
    await f.ctx.tickImport();
    dit(pagesLues(f.j).length === 1 && Number(etat(f) && etat(f).sold.page) === 1, '8. la base refuse la page : on s’arrête, la page n’avance pas', JSON.stringify({ lues: pagesLues(f.j).length, page: etat(f) && etat(f).sold.page }));
  });

  await essaie('9. base muette', async () => {
    const f = fond({ store: autresRien(), lectureKO: (u) => /orders_(sold|purchased)/.test(u) });
    await f.ctx.tickImport();
    dit(f.j.vinted.length === 0 && !etat(f), '9. la base muette au départ : rien ne part (pas su)', `${f.j.vinted.length} requête(s)`);
  });

  await essaie('10. la place des autres', async () => {
    const f = fond({ store: {} });               // argent et colis : pas su ⇒ réserve entière (5 + 3 + 2 + 3)
    for (let i = 0; i < 4; i++) await f.ctx.tickImport();
    const n = pagesLues(f.j).length;
    dit(n === 7, '10. argent et colis « pas su » : l’import s’arrête à 7 (20 − 13 réservées)', `${n} page(s)`);
    dit(f.j.diags.includes('import_laisse_la_place') && etat(f).pause && etat(f).pause.cause === 'budget', '10. et il le dit (pause « budget »)');
    await f.ctx.capterDatesVersement(UID).catch(() => 0);
    dit(lect(f.store) <= 20, '10. le total reste sous 20', `lectures=${lect(f.store)}`);
  });

  await essaie('11. une à la fois', async () => {
    const f = fond({ store: autresRien() });
    await Promise.all([f.ctx.tickImport(), f.ctx.tickImport(), f.ctx.importerHistorique(UID)]);
    const p = pagesLues(f.j);
    dit(f.j.maxEnVol === 1, '11. jamais deux requêtes Vinted en vol', `jusqu'à ${f.j.maxEnVol}`);
    dit(p.length === 4 && new Set(p).size === 4, '11. un seul passage à la fois : aucune page lue deux fois', p.join(' '));
  });

  await essaie('12. sans onglet', async () => {
    const f = fond({ store: autresRien(), onglets: [] });
    await f.ctx.tickImport();
    dit(f.j.vinted.length === 0, '12. le passage de fond ne lit rien sans onglet vinted.fr');
  });

  await essaie('13. la carte', async () => {
    const f = fond({ store: autresRien() });
    f.ctx.compteConnecte = async () => UID;
    await f.ctx.tickImport();
    const e = await f.ctx.etatSite('https://www.vinted.fr/member/1', 7);
    const im = e && e.site && e.site.import;
    dit(!!im && im.etat === 'encours' && im.ventes.lus === 400 && im.ventes.total === N_VENTES && im.resteMin > 0, '13. la carte reçoit « 400 sur 1 250 » et une estimation', JSON.stringify(im));
    const g = fond({ store: {} });
    g.ctx.compteConnecte = async () => UID;
    const e2 = await g.ctx.etatSite('https://www.vinted.fr/', 7);
    dit(!!e2 && e2.site && e2.site.import == null, '13. jamais lu : la carte ne dit rien (pas su)', JSON.stringify(e2 && e2.site && e2.site.import));
  });

  await essaie('14. tout récupérer', async () => {
    const lignes = {
      [`harvest_${UID}_orders_sold`]: { nItems: 300, payload: { pagination: { total_entries: 300 }, my_orders: VENTES.slice(0, 300) } },
      [`harvest_${UID}_orders_purchased`]: { nItems: 230, payload: { pagination: { total_entries: 230 }, my_orders: ACHATS } },
    };
    const f = fond({ store: autresRien(), lignes });
    await f.ctx.tickImport();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'importTout', uid: UID }, { tab: { id: 7, url: 'https://www.vinted.fr/member/1' } });
    await new Promise((ok) => setTimeout(ok, 200));
    dit(!!r && r.ok === true && pagesLues(f.j)[0] === 'sold:1', '14. « Tout récupérer » (carte) : relit depuis la page 1', JSON.stringify({ r: r && r.ok, p: pagesLues(f.j).slice(0, 2) }));
    const autre = await f.envoyer({ from: 'vrm-badge', action: 'importTout', uid: '222' }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    dit(!!autre && autre.ok === false, '14. un autre compte que celui de l’onglet : refusé', JSON.stringify(autre));
    const g = fond({ store: autresRien() });
    const ra = await g.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'importTout', uid: UID });
    dit(!!ra && ra.accepte === true, '14. depuis l’app (vrm.center) : accepté', JSON.stringify(ra && { a: ra.accepte, c: ra.code }));
    const rx = await g.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'importTout', uid: UID }, { origin: 'https://ailleurs.example', url: 'https://ailleurs.example/' });
    dit(!!rx && rx.ok === false && rx.code === 'origine', '14. depuis une autre origine : refusé', JSON.stringify(rx));
  });

  await essaie('15. réserve des photos', async () => {
    const f = fond({ store: autresRien() });
    const sans = await f.ctx.reserveLectures(UID, 'photos');
    await f.ctx.tickImport();
    const avec = await f.ctx.reserveLectures(UID, 'photos');
    dit(avec === sans + 4, '15. import en cours noté : les photos lui laissent 4 lectures ; aucun import : rien', `sans=${sans} avec=${avec}`);
  });
}

async function lancer(SRC) {
  let ko = 0, ok = 0;
  await controles(SRC, (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } });
  return { ko, ok };
}

const MUTATIONS = [
  ['4 pages par passage → 40', 'const IMPORT_PAGES_PAR_PASSAGE = 4;', 'const IMPORT_PAGES_PAR_PASSAGE = 40;'],
  ['plafond horaire retiré', 'const IMPORT_MAX_HEURE = 12;', 'const IMPORT_MAX_HEURE = 99;'],
  ['garde de lecture retirée', "const refus = await gardeLecture(uid, acc, 'import');", 'const refus = null;'],
  ['classe prioritaire (prend la place de l’argent)', "(classe === 'enligne' || classe === 'suivi' || classe === 'import') ? 'enligne' : 'photos'", "(classe === 'enligne' || classe === 'suivi') ? 'enligne' : 'photos'"],
  ['pause retirée', 'if (n > 0) await pauseImport();', ''],
  ['compte relu après la page retiré', "if (actif && String(actif) !== String(uid)) { noterDiag('import_compte_change'); break; }", ''],
  ['page avancée même refusée par la base', "if (issue !== 'ecrit' && issue !== 'inchange') { noterDiag(`import_page_pas_rangee_${nom}`); break; }", ''],
  ['total absent lu comme 0 (« complet »)', "(v === null || v === undefined || String(v).trim() === '' ? NaN : Number(v))", 'Number(v)'],
  ['base muette prise pour « rien rangé »', "if (rows === null || !Array.isArray(rows)) { noterDiag('import_base_muette'); return null; }", '', "const r = rows.find(", "const r = (rows || []).find("],
  ['verrou retiré', "if (_importEnCours) { try { noterDiag('import_deja_en_cours'); } catch (_) {} return _importEnCours.then(() => 0, () => 0); }", ''],
  ['fond sans onglet', "const tabs = await chrome.tabs.query({ url: ['https://*.vinted.fr/*'] });\n    if (!tabs || !tabs.length) return 0;\n    const uid = await activeUidForDomain('www.vinted.fr');\n    if (!uid) return 0;\n    if (await pauseVinted()) return 0;\n    if (await sansSessionPourEcrire()) return 0;\n    if (await reculBase()) return 0;\n    if (await compteNonCapte(uid)) return 0;\n    const st = await lireImport(uid);", "const uid = await activeUidForDomain('www.vinted.fr');\n    const st = await lireImport(uid);"],
  ['fin sur page courte (Vinted plafonne)', '!lot.length || (Number.isFinite(tp) && tp > 0 && p >= tp)', '!lot.length || lot.length < 100 || p >= 3'],
  ['réserve photos « pas su » entière', "(k === 'import' ? 0 : max[k])", 'max[k]'],
];

(async () => {
  const SRC = cheminSource();
  const r = await lancer(SRC);
  console.log(r.ko ? `\n❌ import de départ : ${r.ok} vert(s), ${r.ko} rouge(s)` : `\n✅ import de départ : ${r.ok} vert(s), 0 rouge(s)`);
  let koMut = 0;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-import-'));
    for (const [nom, de, vers, de2, vers2] of MUTATIONS) {
      if (!texte.includes(de) || (de2 && !texte.includes(de2))) { koMut++; console.log(`❌ mutation « ${nom} » : la ligne est introuvable — le contrôle ne prouve rien`); continue; }
      const f = path.join(dir, 'background.js');
      let t2 = texte.replace(de, vers); if (de2) t2 = t2.replace(de2, vers2);
      fs.writeFileSync(f, t2);
      const log = console.log; console.log = () => {};
      let m; try { m = await lancer(f); } finally { console.log = log; }
      if (m.ko > 0) console.log(`✅ mutation « ${nom} » : ${m.ko} rouge(s) — le contrôle mord`);
      else { koMut++; console.log(`❌ mutation « ${nom} » : tout reste vert`); }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(r.ko || koMut ? 1 : 0);
})();
