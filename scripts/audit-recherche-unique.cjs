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
const TR = require('./_travail-recherche.cjs');
const SRC = path.join(__dirname, '..', 'src', 'rechercheUnique.js');

const MUTATIONS = {
  'code-partiel': ['const c = e.codes.find((x) => x === qa);', 'const c = e.codes.find((x) => x.includes(qa));'],
  'tx-court': ['if (!par && chiffres && qa.length >= 5 && e.tx && e.tx.includes(qa))', 'if (!par && chiffres && qa.length >= 1 && e.tx && e.tx.includes(qa))'],
  // (6 nov.) L'ancre portait « \\u0300 » en toutes lettres : la source a les caractères
  // eux-mêmes ⇒ « ancre introuvable », compté comme une mutation attrapée. Elle vise la source réelle.
  accents: [".normalize('NFD').replace(/[\u0300-\u036f]/g, '')", ''],
  memo: ['  if (_memo.cles && _memo.cles.length === cles.length && _memo.cles.every((x, i) => x === cles[i])) return _memo.index;', ''],
  'colis-double': ['    const p = parSuivi.get(k);', '    const p = null;'],
  // (26 nov.) recalée : l'ancre d'avant (`mots.every((m) => e.t.includes(m))`) n'existait plus — « introuvable » était
  // compté comme une mutation attrapée.
  'mots-ordre': ['if (!par && e.t && (tests.every((f) => f(e.t)) ||', 'if (!par && e.t && (e.t.includes(qn) ||'],
  // (26 nov.) LA VITESSE, sans horloge murale (scripts/_travail-recherche.cjs) : le vocabulaire des fautes recalculé pour
  // CHAQUE entrée (une frappe quadratique) — rouge par le COMPTE des lectures, à toute charge de la machine.
  'frappe-quadratique': ['tests.every((f, k) => f(e.t) || presDe(e, proches[k]))', 'tests.every((f, k) => f(e.t) || presDe(e, prochesDe(index, mots[k])))'],
  max: ['if (g && g.length < maxDe(k)) g.push(t);', 'if (g) g.push(t);'],
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
    const introuvable = /ancre de mutation introuvable/.test(r.stdout || '');   // (26 nov.) une ancre absente ne mute rien
    const pris = r.status !== 0 && rouges && !introuvable;
    console.log(`${pris ? '✅' : '❌'} mutation « ${m} » : ${introuvable ? 'ANCRE INTROUVABLE' : rouges + ' rouge(s)'}${pris ? ' — ' + ((r.stdout || '').match(/^❌.*$/gm) || []).map((l) => l.slice(2, 80)).join(' | ') : ''}`);
    if (pris) ok++;
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
    dit(cles(s2, 'retrait').join() === 'colis:1Z999AA10123456784', 'n° de suivi partiel, espaces compris ⇒ le colis (groupe « Retraits », il vient chez lui)', cles(s2, 'retrait'));
    dit(idx.entrees.filter((e) => e.type === 'colis').length === 2, 'le même n° de suivi reçu deux fois = UN colis', idx.entrees.filter((e) => e.type === 'colis').map((e) => e.cle));
    const c = cherche('482913');
    dit(cles(c, 'retrait').join() === 'colis:1Z999AA10123456784' && c.groupes.retrait[0].par === 'code', 'code de retrait ⇒ le colis', c.groupes.retrait.map((r) => r.par));
    dit(cles(cherche('k7q2'), 'retrait').join() === 'colis:1Z999AA10123456784', 'le second code du même colis est gardé');
    dit(cherche('4829').total === 0, 'un code se compare EXACTEMENT (« 4829 » ne sort pas « 482913 »)', cherche('4829').total);
    const t = cherche('22314280003');
    dit(cles(t, 'vente').join() === 'vente:22314280003' && t.groupes.vente[0].par === 'transaction', 'n° de transaction ⇒ SA vente', cles(t, 'vente'));
    dit(cherche('2231428').groupes.vente.length === 3, 'n° de transaction partiel (7 chiffres) ⇒ les ventes qui le portent');
    dit(cherche('0001').total === 0, '« 0001 » (moins de 5 chiffres) n’est pas un n° de transaction ⇒ rien (le N° a son propre bloc)', cherche('0001').total);
  });

  essaie('titre', () => {
    const t = cherche('spezial ADIDAS');
    dit(cles(t, 'vente').sort().join() === 'vente:22314280001,vente:22314280002' && t.groupes.vente.every((r) => r.par === 'titre' && !r.approx), 'titre (mots dans n’importe quel ordre) ⇒ les DEUX jumelles, deux lignes, trouvées EXACTEMENT (pas « à une lettre près »)', cles(t, 'vente'));
    const d = t.groupes.vente.map((r) => R.destinationResultat(r));
    dit(d.length === 2 && d[0].cible.tx !== d[1].cible.tx && d.every((x) => x.tab === 'ventes' && x.cible.type === 'vente'), 'chaque jumelle ouvre SA transaction', d);
    dit(cles(cherche('legere'), 'vente').join() === 'vente:22314280003', 'sans accents : « legere » trouve « Légère »');
    dit(cles(cherche('salomon'), 'achat').join() === 'achat:23705320001' && cles(cherche('salomon'), 'retrait').length === 1, 'un même mot trouve l’achat ET le colis, en deux groupes');
    dit(cherche('   ').total === 0 && cherche('').total === 0, 'une recherche vide ne rend rien');
  });

  essaie('destinations', () => {
    const r = cherche('482913').groupes.retrait[0];
    const d = R.destinationResultat(r);
    dit(d && d.tab === 'cat_bord' && d.cible.type === 'retrait' && d.cible.suivi === '1Z999AA10123456784', 'un colis à retirer ouvre Colis → À retirer, sa carte (n° de suivi)', d);
    const r2 = cherche('mr55512345').groupes.colis[0];
    dit(R.destinationResultat(r2).cible.colonne === 'partis', 'un colis envoyé ouvre « Envoyés »', R.destinationResultat(r2));
    const a = R.destinationResultat(cherche('salomon').groupes.achat[0]);
    dit(a.tab === 'achats' && a.cible.type === 'achat' && a.cible.tx === '23705320001', 'un achat ouvre SA ligne', a);
  });

  essaie('vitesse et mémo', () => {
    // (26 nov.) Le temps CPU du fil, plus le temps mural (4 audits sur 4 cœurs le rougissaient sans que la règle change),
    // et le travail EXACT d'une frappe à n puis à 2n entrées (aucune horloge) — scripts/_travail-recherche.cjs.
    const grand = (N) => {
    const V = Array.from({ length: N }, (_, i) => ({ transaction_id: 22000000000 + i, title: `Modèle ${i % 300} Nike Air taille ${36 + (i % 10)}`, status: 'Commande finalisée', date: new Date(1.79e12 + i * 6e4).toISOString() }));
    const A = Array.from({ length: N / 2 }, (_, i) => ({ transaction_id: 23000000000 + i, title: `Achat ${i} Adidas`, status: 'x' }));
    const P = V.slice(0, N / 3).map((o, i) => ({ tx: String(o.transaction_id), pseudo: 'acheteur_' + i }));
    const B = V.slice(0, N / 3).map((o, i) => ({ tx: String(o.transaction_id), suivi: 'XW' + String(100000000 + i) + 'FR' }));
    const C = Array.from({ length: N / 4 }, (_, i) => ({ id: 'c' + i, suivi: 'MR' + (5000000 + i), code: String(100000 + i), status: 'available' }));
    return { ventes: V, achats: A, pseudos: P, bordereaux: B, colis: C };
    };
    const N = 6000;
    const big = grand(N);
    const mi = TR.mesureCpu(() => R.indexMemo(big));
    const I1 = mi.r, tIndex = mi.ms;
    dit(tIndex < 800, `index de ${I1.n} entrées en ${Math.round(tIndex)} ms de ${TR.SOURCE_CPU}`, Math.round(tIndex));
    const m2 = TR.mesureCpu(() => R.indexMemo({ ...big }));
    const I2 = m2.r;
    dit(I2 === I1 && m2.ms < 5, 'les mêmes sources ⇒ le MÊME index (mémo, aucune reconstruction)');
    const qs = ['nike air', 'acheteur_1999', 'XW100001999', '101499', '22000005999', 'modele 299 taille 45', 'adid'];
    const parFrappe = TR.mesureCpu(() => { for (let k = 0; k < 5; k++) for (const q of qs) R.chercherPartout(I1, q); }).ms / (5 * qs.length);
    dit(parFrappe < 40, `une frappe sur ${I1.n} entrées : ${parFrappe.toFixed(1)} ms de ${TR.SOURCE_CPU}`, parFrappe);
    const Ib = R.indexRecherche(grand(2 * N));
    const w = qs.map((q) => ({ q, a: TR.travailFrappe(R, I1, q), b: TR.travailFrappe(R, Ib, q) }));
    console.log('   travail d’une frappe (lectures) : ' + w.map((x) => `${x.q} ${x.a.entrees}/${x.a.n} → ${x.b.entrees}/${x.b.n} (index ${x.a.index} → ${x.b.index})`).join(' · '));
    dit(Ib.n > 1.9 * I1.n && w.every((x) => x.b.parEntree <= x.a.parEntree * 1.15 + 0.5), 'une frappe lit chaque entrée un nombre BORNÉ de fois : à 2n, par entrée, au plus le facteur log du tri des trouvailles (×1,15), jamais ×2 (aucune horloge)', w.map((x) => [x.q, +x.a.parEntree.toFixed(2), +x.b.parEntree.toFixed(2)]));
    dit(w.every((x) => x.b.index <= x.a.index && x.a.index <= 20), 'l’index lui-même est lu un nombre de fois qui ne dépend pas de n (vocabulaire des fautes fait UNE fois)', w.map((x) => [x.q, x.a.index, x.b.index]));
    const r = R.chercherPartout(I1, 'acheteur_1999');
    dit(r.groupes.vente.length === 1 && r.groupes.vente[0].e.tx === '22000001999', 'le pseudo exact trouve SA vente parmi 6 000', r.groupes.vente.map((x) => x.e.tx));
    const lot = R.chercherPartout(I1, 'nike');
    dit(lot.groupes.vente.length === R.MAX_PAR_GROUPE && lot.total === N, `un mot fréquent : ${R.MAX_PAR_GROUPE} lignes par groupe au plus, le total gardé`, [lot.groupes.vente.length, lot.total]);
    const c = R.chercherPartout(I1, '101499');
    dit(c.groupes.retrait.length === 1 && c.groupes.retrait[0].par === 'code', 'le code exact sort en tête parmi 1 500 colis');
  });

  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
