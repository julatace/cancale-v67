#!/usr/bin/env node
// ── audit-recherche-unique — UNE LOUPE QUI TROUVE TOUT (3 novembre) ────────────
// Exécute la VRAIE règle (src/rechercheUnique.js) sur des données INVENTÉES à la
// forme lue par l'app (listes « Mes ventes / Mes achats », `email_sale_*` projeté
// en { tx, pseudo }, `email_bord_*` en { tx, suivi }, `email_track_*` en
// { id, suivi, code, code2, lieu, status, sens, art, carrier, at }).
// Ce qu'il exige :
//   · pseudo, suivi, code de retrait, n° de transaction, titre : chacun trouve SA
//     ligne ; un pseudo / un suivi ne s'attache à une vente que par le n° de
//     transaction écrit à côté — jamais à sa jumelle de titre (§5) ;
//   · le titre ne fait que CHERCHER : deux ventes au même titre = deux lignes,
//     chacune ouvre SA transaction ;
//   · un code de retrait se compare EXACTEMENT (« 12 » ne sort pas « 123456 ») ;
//   · rapide sur des milliers d'articles (index mémorisé) ;
//   · chaque résultat ouvre l'écran existant par son identité.
//   node scripts/audit-recherche-unique.cjs [--mutation=NOM | --prouve]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src', 'rechercheUnique.js');

const MUTATIONS = {
  'code-partiel': ['const c = e.codes.find((x) => x === qa);', 'const c = e.codes.find((x) => x.includes(qa));'],
  'tx-court': ['if (!par && chiffres && qa.length >= 5 && e.tx && e.tx.includes(qa))', 'if (!par && chiffres && qa.length >= 1 && e.tx && e.tx.includes(qa))'],
  // (6 nov.) L'ancre portait « \\u0300 » en toutes lettres : la source a les caractères
  // eux-mêmes ⇒ « ancre introuvable », compté comme une mutation attrapée. Elle vise la source réelle.
  accents: [".normalize('NFD').replace(/[\u0300-\u036f]/g, '')", ''],
  memo: ['  if (_memo.cles && _memo.cles.length === cles.length && _memo.cles.every((x, i) => x === cles[i])) return _memo.index;', ''],
  'colis-double': ['    const p = parSuivi.get(k);', '    const p = null;'],
  'mots-ordre': ['if (!par && e.t && mots.every((m) => e.t.includes(m)))', 'if (!par && e.t && e.t.includes(qn))'],
  max: ['if (g && g.length < maxDe(t.e.type)) g.push(t);', 'if (g) g.push(t);'],
  // Le pseudo d'un e-mail attaché par TITRE (la jumelle reçoit aussi le pseudo).
  'pseudo-titre': ["  for (const o of Array.isArray(S.ventes) ? S.ventes : []) commande('vente', o);",
    "  { const vs = Array.isArray(S.ventes) ? S.ventes : []; for (const o of vs) { const tx = alnum(o && o.transaction_id); for (const j of vs) if (j !== o && str(j.title) === str(o.title) && pseudosTx.get(alnum(j.transaction_id))) { if (!pseudosTx.has(tx)) pseudosTx.set(tx, new Set()); for (const p of pseudosTx.get(alnum(j.transaction_id))) pseudosTx.get(tx).add(p); } } for (const o of vs) commande('vente', o); }"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  if (!fs.existsSync(SRC)) { console.log('❌ src/rechercheUnique.js absent : la recherche unique n’existe pas'); process.exit(1); }
  let src = fs.readFileSync(SRC, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src = src.replace(m[0], m[1]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recherche-'));
  const f = path.join(dir, 'r.mjs'); fs.writeFileSync(f, src);
  let R; try { R = await import(pathToFileURL(f).href); } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  const T = 'Adidas Spezial noir taille 40';
  const ventes = [
    { transaction_id: 22314280001, title: T, status: 'Bordereau envoyé au vendeur', date: '2026-11-01T10:00:00Z' },
    { transaction_id: 22314280002, title: T, status: 'Bordereau envoyé au vendeur', date: '2026-11-02T10:00:00Z' },
    { transaction_id: 22314280003, title: 'Nike Air Max Légère blanc', status: 'Commande livrée ! ', date: '2026-10-20T10:00:00Z' },
  ];
  const achats = [{ transaction_id: 23705320001, title: 'Salomon XT-6 gris taille 42', status: 'Commande expédiée', date: '2026-10-30T10:00:00Z' }];
  const pseudos = [{ tx: '22314280001', pseudo: 'poupacho' }, { tx: null, pseudo: 'sans_tx' }];
  const bordereaux = [{ tx: '22314280002', suivi: 'XW309277125JF' }];
  const colis = [
    { id: 'email_track_a', suivi: '1Z999AA10123456784', code: '482913', lieu: 'Tabac du port, 35260 Cancale', status: 'available', sens: 'entrant', art: 'Salomon XT-6', carrier: 'mondialrelay', at: '2026-11-02T08:00:00Z' },
    { id: 'email_track_b', suivi: '1Z999AA10123456784', code2: 'K7Q2', status: 'available', sens: 'entrant', carrier: 'mondialrelay', at: '2026-11-02T09:00:00Z' },
    { id: 'email_track_c', suivi: 'MR55512345', status: 'delivered', sens: 'sortant', art: 'Nike Air Max', carrier: 'mondialrelay', at: '2026-10-25T09:00:00Z' },
  ];
  const S = { ventes, achats, pseudos, bordereaux, colis };
  const idx = R.indexRecherche(S);
  const cherche = (q) => R.chercherPartout(idx, q);
  const cles = (res, g) => res.groupes[g].map((r) => r.e.cle);

  essaie('identités', () => {
    const p = cherche('poupa');
    dit(cles(p, 'vente').join() === 'vente:22314280001' && p.groupes.vente[0].par === 'pseudo', 'pseudo « poupa » ⇒ SA vente (transaction écrite dans l’e-mail), pas la jumelle de titre', cles(p, 'vente'));
    const s = cherche('xw309277125jf');
    dit(cles(s, 'vente').join() === 'vente:22314280002' && s.groupes.vente[0].par === 'suivi' && s.groupes.vente[0].exact, 'n° de suivi du bordereau ⇒ SA vente', cles(s, 'vente'));
    const s2 = cherche('1Z999 AA10 1234');
    dit(cles(s2, 'colis').join() === 'colis:1Z999AA10123456784', 'n° de suivi partiel, espaces compris ⇒ le colis', cles(s2, 'colis'));
    dit(idx.entrees.filter((e) => e.type === 'colis').length === 2, 'le même n° de suivi reçu deux fois = UN colis', idx.entrees.filter((e) => e.type === 'colis').map((e) => e.cle));
    const c = cherche('482913');
    dit(cles(c, 'colis').join() === 'colis:1Z999AA10123456784' && c.groupes.colis[0].par === 'code', 'code de retrait ⇒ le colis', c.groupes.colis.map((r) => r.par));
    dit(cles(cherche('k7q2'), 'colis').join() === 'colis:1Z999AA10123456784', 'le second code du même colis est gardé');
    dit(cherche('4829').total === 0, 'un code se compare EXACTEMENT (« 4829 » ne sort pas « 482913 »)', cherche('4829').total);
    const t = cherche('22314280003');
    dit(cles(t, 'vente').join() === 'vente:22314280003' && t.groupes.vente[0].par === 'transaction', 'n° de transaction ⇒ SA vente', cles(t, 'vente'));
    dit(cherche('2231428').groupes.vente.length === 3, 'n° de transaction partiel (7 chiffres) ⇒ les ventes qui le portent');
    dit(cherche('0001').total === 0, '« 0001 » (moins de 5 chiffres) n’est pas un n° de transaction ⇒ rien (le N° a son propre bloc)', cherche('0001').total);
  });

  essaie('titre', () => {
    const t = cherche('spezial ADIDAS');
    dit(cles(t, 'vente').sort().join() === 'vente:22314280001,vente:22314280002' && t.groupes.vente.every((r) => r.par === 'titre'), 'titre (mots dans n’importe quel ordre) ⇒ les DEUX jumelles, deux lignes', cles(t, 'vente'));
    const d = t.groupes.vente.map((r) => R.destinationResultat(r));
    dit(d.length === 2 && d[0].cible.tx !== d[1].cible.tx && d.every((x) => x.tab === 'ventes' && x.cible.type === 'vente'), 'chaque jumelle ouvre SA transaction', d);
    dit(cles(cherche('legere'), 'vente').join() === 'vente:22314280003', 'sans accents : « legere » trouve « Légère »');
    dit(cles(cherche('salomon'), 'achat').join() === 'achat:23705320001' && cles(cherche('salomon'), 'colis').length === 1, 'un même mot trouve l’achat ET le colis, en deux groupes');
    dit(cherche('   ').total === 0 && cherche('').total === 0, 'une recherche vide ne rend rien');
  });

  essaie('destinations', () => {
    const r = cherche('482913').groupes.colis[0];
    const d = R.destinationResultat(r);
    dit(d && d.tab === 'cat_bord' && d.cible.type === 'retrait' && d.cible.suivi === '1Z999AA10123456784', 'un colis à retirer ouvre Colis → À retirer, sa carte (n° de suivi)', d);
    const r2 = cherche('mr55512345').groupes.colis[0];
    dit(R.destinationResultat(r2).cible.colonne === 'partis', 'un colis envoyé ouvre « Envoyés »', R.destinationResultat(r2));
    const a = R.destinationResultat(cherche('salomon').groupes.achat[0]);
    dit(a.tab === 'achats' && a.cible.type === 'achat' && a.cible.tx === '23705320001', 'un achat ouvre SA ligne', a);
  });

  essaie('vitesse et mémo', () => {
    const N = 6000;
    const V = Array.from({ length: N }, (_, i) => ({ transaction_id: 22000000000 + i, title: `Modèle ${i % 300} Nike Air taille ${36 + (i % 10)}`, status: 'Commande finalisée', date: new Date(1.79e12 + i * 6e4).toISOString() }));
    const A = Array.from({ length: 3000 }, (_, i) => ({ transaction_id: 23000000000 + i, title: `Achat ${i} Adidas`, status: 'x' }));
    const P = V.slice(0, 2000).map((o, i) => ({ tx: String(o.transaction_id), pseudo: 'acheteur_' + i }));
    const B = V.slice(0, 2000).map((o, i) => ({ tx: String(o.transaction_id), suivi: 'XW' + String(100000000 + i) + 'FR' }));
    const C = Array.from({ length: 1500 }, (_, i) => ({ id: 'c' + i, suivi: 'MR' + (5000000 + i), code: String(100000 + i), status: 'available' }));
    const big = { ventes: V, achats: A, pseudos: P, bordereaux: B, colis: C };
    let t0 = performance.now();
    const I1 = R.indexMemo(big);
    const tIndex = performance.now() - t0;
    dit(tIndex < 800, `index de ${I1.n} entrées en ${Math.round(tIndex)} ms`, Math.round(tIndex));
    t0 = performance.now();
    const I2 = R.indexMemo({ ...big });
    dit(I2 === I1 && performance.now() - t0 < 5, 'les mêmes sources ⇒ le MÊME index (mémo, aucune reconstruction)');
    const qs = ['nike air', 'acheteur_1999', 'XW100001999', '101499', '22000005999', 'modele 299 taille 45', 'adid'];
    t0 = performance.now();
    for (let k = 0; k < 5; k++) for (const q of qs) R.chercherPartout(I1, q);
    const parFrappe = (performance.now() - t0) / (5 * qs.length);
    dit(parFrappe < 40, `une frappe sur ${I1.n} entrées : ${parFrappe.toFixed(1)} ms`, parFrappe);
    const r = R.chercherPartout(I1, 'acheteur_1999');
    dit(r.groupes.vente.length === 1 && r.groupes.vente[0].e.tx === '22000001999', 'le pseudo exact trouve SA vente parmi 6 000', r.groupes.vente.map((x) => x.e.tx));
    const lot = R.chercherPartout(I1, 'nike');
    dit(lot.groupes.vente.length === R.MAX_PAR_GROUPE && lot.total === N, `un mot fréquent : ${R.MAX_PAR_GROUPE} lignes par groupe au plus, le total gardé`, [lot.groupes.vente.length, lot.total]);
    const c = R.chercherPartout(I1, '101499');
    dit(c.groupes.colis.length === 1 && c.groupes.colis[0].par === 'code', 'le code exact sort en tête parmi 1 500 colis');
  });

  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
