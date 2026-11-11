// ⚠️ UNE VENTE DE PLUSIEURS ARTICLES = UNE VENTE, CHAQUE ARTICLE À SA PLACE (11 nov., lot ventes-lot)
//
// Ce contrôle EXÉCUTE la règle (src/venteLot.js) sur des lots INVENTÉS ici et prouve :
//   1. la copie serveur (api/_lib/vente-lot-regle.js) est la règle de l'app au caractère près ;
//   2. un article se relie par IDENTITÉ seulement (annonce, photo exacte, SON lien) — 50 articles
//      au même titre ne sont jamais reliés ; deux articles sous un même N° ⇒ aucun des deux ;
//   3. le prix se répartit au centime près (prorata des prix affichés, sinon parts égales DITES) ;
//   4. le prix d'achat du lot = celui posé sur la vente, sinon la somme SEULEMENT si tout est connu ;
//   5. le tampon liste les N° ; une annonce seule titrée « Lot … » n'est pas un lot ;
//   6. le relevé éclaté par article garde la vente (CA et frais au centime) ;
//   7. la facture : une ligne par article, somme = prix, HT = HT de la facture ;
//   8. la route de facture lit la transaction (pas su ⇒ rien numéroté) ;
//   9. l'app branche la règle aux bons endroits (bénéfice, publication, stock, tampon).
//
//   node scripts/audit-ventes-lot.cjs            → le contrôle
//   node scripts/audit-ventes-lot.cjs --recopie  → refabrique la copie serveur depuis src/venteLot.js
// Aucune donnée réelle.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d && !c ? ' — ' + d : ''}`); };

const SRC = path.join(R, 'src', 'venteLot.js');
const COPIE = path.join(R, 'api', '_lib', 'vente-lot-regle.js');
const TETE = `// ── COPIE REFABRIQUÉE de src/venteLot.js (11 nov., lot ventes-lot) — NE PAS MODIFIER À LA MAIN ──
// Le serveur (facture Pro d'une vente en lot) applique la règle de l'app. Modifier
// src/venteLot.js, puis : node scripts/audit-ventes-lot.cjs --recopie
// (l'audit exige que le corps soit, au caractère près, celui de src/venteLot.js).
`;
if (process.argv.includes('--recopie')) {
  fs.writeFileSync(COPIE, TETE + fs.readFileSync(SRC, 'utf8'));
  console.log('✅ copie serveur refabriquée');
  process.exit(0);
}

(async () => {
  console.log('── 1. La copie serveur est la règle de l’app');
  const copie = fs.existsSync(COPIE) ? fs.readFileSync(COPIE, 'utf8') : '';
  const source = fs.existsSync(SRC) ? fs.readFileSync(SRC, 'utf8') : null;
  dit(source != null && copie === TETE + source, 'api/_lib/vente-lot-regle.js = src/venteLot.js au caractère près', source == null ? 'src/venteLot.js absent' : copie ? 'le code diffère — `--recopie`' : 'absente');
  const L = source == null ? null : await import('file://' + SRC).catch((e) => { dit(false, 'src/venteLot.js se charge', e.message); return null; });
  const S = await import('file://' + COPIE).catch(() => ({}));
  if (L) await regles(L, S);
  else dit(false, 'la règle des ventes en lot existe (sections 2 à 7 non jouées)');
  appli();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();

async function regles(L, S) {

  const tx = (items, extra = {}) => ({ payload: { transaction: { id: 9000001, items_count: items.length, order: { items }, ...extra } } });
  const art = (id, title, prix, photo, size) => ({ id, title, price: prix == null ? null : { amount: String(prix), currency_code: 'EUR' }, photos: photo ? [{ url: photo }] : [], size_title: size || null });
  const cle = (n) => String(n).trim().toUpperCase().replace(/[\s-]/g, '').replace(/^0+(\d)/, '$1');

  console.log('── 2. Identité seulement');
  {
    const items = Array.from({ length: 50 }, (_, i) => art(5000 + i, 'Nike Air Max 90 blanc taille 42', 40));
    const fiches = { 5003: { numero: '124' } };   // une seule fiche connue, par SON identifiant
    const r = L.resumeVenteLot(tx(items), 200000, { numeroDeItem: (id) => (fiches[id] ? fiches[id].numero : null), cle });
    dit(r && r.n === 50 && r.nums.length === 1 && r.articles[3].num === '124' && r.articles[3].par === 'annonce', '50 articles au même titre : seul celui dont l’annonce est numérotée est relié', JSON.stringify(r && r.nums));
    dit(r.nonRelies === 49 && r.phraseManque === '49 articles non reliés', '« 49 articles non reliés » dit', r.phraseManque);
    const r2 = L.resumeVenteLot(tx([art(1, 'A', 10, 'https://x/a.jpg'), art(2, 'B', 10, 'https://x/b.jpg'), art(3, 'C', 10)]), 3000, {
      numeroDeItem: () => null, numeroDePhoto: (p) => (p === 'https://x/b.jpg' ? '131' : null), liens: { 3: '140' }, cle });
    dit(r2.articles.map((a) => a.par).join(',') === ',photo,main' && r2.tampon === '131 · 140 + 1 sans N°', 'photo exacte puis SON lien ; le tampon le dit', r2.tampon);
    const r3 = L.resumeVenteLot(tx([art(1, 'A', 10), art(2, 'B', 10)]), 2000, { numeroDeItem: () => null, liens: { 1: '7', 2: '007' }, cle });
    dit(r3.articles.every((a) => a.num === null && a.conflit) && r3.nonRelies === 2, 'deux articles sous le même N° (« 7 » = « 007 ») ⇒ aucun des deux', JSON.stringify(r3.articles.map((a) => a.num)));
    const r4 = L.resumeVenteLot(tx([art(1, 'Lot de 2 paires', 30)]), 3000, {});
    dit(r4 === null, 'une annonce seule titrée « Lot de 2 paires » n’est PAS un lot (la transaction le dit)');
    dit(L.titreDitLot('Lot 3 articles') && !L.titreDitLot('Nike lot') && L.titreDitLot(' lot de 2'), 'le titre « Lot … » ne décide que quoi relire');
    const r5 = L.resumeVenteLot({ payload: { transaction: { items_count: 3 } } }, 3000, {});
    dit(r5 && r5.lu === false && r5.n === 3 && r5.nums.length === 0 && r5.phraseManque === '3 articles non reliés', 'items_count sans articles lus : rien relié, rien réparti, dit', JSON.stringify(r5));
    dit(L.articlesDeTransaction(null) === undefined && L.articlesDeTransaction({ payload: { transaction: {} } }) === undefined, 'transaction absente ⇒ undefined (pas lue, jamais [])');
  }

  console.log('── 3. Le prix réparti au centime');
  {
    const p = L.repartirPrixLot(10000, [{ prix: 3000, devise: 'EUR' }, { prix: 3000, devise: 'EUR' }, { prix: 4000, devise: 'EUR' }]);
    dit(p.mode === 'prorata' && p.parts.join() === '3000,3000,4000' && p.phrase === L.PHRASE_PRORATA, 'prorata des prix affichés', JSON.stringify(p));
    const q = L.repartirPrixLot(10000, [{ prix: 3000 }, { prix: null }, { prix: 4000 }]);
    dit(q.mode === 'egal' && q.parts.join() === '3334,3333,3333' && q.phrase === 'réparti également, prix par article pas lu', 'un prix pas lu ⇒ parts égales, DIT', JSON.stringify(q));
    const d = L.repartirPrixLot(9000, [{ prix: 3000, devise: 'EUR' }, { prix: 3000, devise: 'GBP' }]);
    dit(d.mode === 'egal', 'deux devises ⇒ parts égales (jamais un prorata faux)');
    let toutJuste = true;
    for (let k = 0; k < 400; k++) {
      const n = 2 + (k % 7), total = 1 + ((k * 7919) % 99999);
      const a = Array.from({ length: n }, (_, i) => ({ prix: (k + i) % 5 === 0 && k % 3 ? null : 100 + ((k * 31 + i * 17) % 9000), devise: 'EUR' }));
      const r = L.repartirPrixLot(total, a);
      if (r.parts.length !== n || r.parts.reduce((s, x) => s + x, 0) !== total || r.parts.some((x) => !Number.isInteger(x) || x < 0)) { toutJuste = false; break; }
    }
    dit(toutJuste, '400 lots inventés : la somme des parts = le total, au centime (aucune perte, aucun double)');
  }

  console.log('── 4. Le prix d’achat du lot');
  {
    const rel = [{ num: '1', item: 'a' }, { num: '2', item: 'b' }];
    const A = { a: 1500, b: 2000 };
    dit(L.achatLot(rel, (x) => A[x.item]).achat === 3500, 'tous connus ⇒ la somme');
    dit(L.achatLot(rel, (x) => (x.item === 'a' ? 1500 : null)).achat === null && L.achatLot(rel, (x) => (x.item === 'a' ? 1500 : null)).connus === 1, 'un inconnu ⇒ null (« pas su » ≠ 0), le connu compté');
    dit(L.achatLot(rel, () => null, 4200).achat === 4200 && L.achatLot(rel, () => null, 4200).source === 'vente', 'le prix posé par LUI sur la vente prime');
    const r = L.resumeVenteLot(tx([art('a', 'A', 50), art('b', 'B', 50)]), 9000, { numeroDeItem: (id) => ({ a: '1', b: '2' }[id]), achatDe: (x) => A[x.item], cle });
    dit(r.articles[0].part === 4500 && r.articles[0].benefice === 3000 && r.articles[1].benefice === 2500, 'bénéfice par article = sa part − son achat', JSON.stringify(r.articles.map((a) => a.benefice)));
  }

  console.log('── 5. Le relevé éclaté par article garde la vente');
  {
    const { releveVentes, eclaterReleveLots } = await import('file://' + path.join(R, 'src', 'ceQuiRapporte.js'));
    const ventes = [{ transaction_id: 77, date: '2026-10-02T10:00:00Z', title: 'Lot 3 articles', price: { amount: '100.00' } }, { transaction_id: 78, date: '2026-10-03T10:00:00Z', title: 'Nike', price: { amount: '40.00' } }];
    const lignes = releveVentes({ vinted: ventes, estFinalisee: () => true, an0: 2025, montant: (o) => Number(o.price.amount), achat: () => null, frais: (o) => (o.transaction_id === 77 ? 3.01 : 1), compte: () => 'c',
      articles: (o) => (o.transaction_id === 77 ? [['A', '1', 3334, 1000, 'i1'], ['B', '', 3333, null, 'i2'], ['C', '3', 3333, 500, 'i3']] : null) });
    dit(lignes.length === 2 && Array.isArray(lignes[0][10]) && lignes[1].length === 10, 'le relevé garde UNE ligne par vente (le lot porte ses articles en [10])');
    const e = eclaterReleveLots(lignes);
    const lot = e.filter((r) => r[2] === '77');
    dit(e.length === 4 && lot.length === 3, 'éclaté : une ligne par article');
    dit(Math.round(lot.reduce((s, r) => s + r[4] * 100, 0)) === 10000 && Math.round(lot.reduce((s, r) => s + r[6] * 100, 0)) === 301, 'CA et frais au centime après éclatement', JSON.stringify(lot.map((r) => [r[4], r[6]])));
    dit(lot[1][5] === null && lot[0][5] === 10 && lot[2][10] === 'i3', 'achat inconnu reste inconnu ; l’annonce de chaque article suit');
  }

  console.log('── 6. La facture : une ligne par article');
  {
    const F = await import('file://' + path.join(R, 'src', 'facturePro', 'regle.js'));
    const rel = L.resumeVenteLot(tx([art('a', 'Nike Air Max 90', 60, null, '42'), art('b', 'Adidas Samba', 40, null, '41')]), 9000, { numeroDeItem: (id) => ({ a: '124' }[id]), cle });
    const lignes = L.lignesFactureLot(rel.articles, rel.articles.map((a) => a.part));
    dit(lignes.length === 2 && lignes[0].designation === 'Nike Air Max 90 · 42 · N°124' && lignes[0].centimes === 5400 && lignes[1].centimes === 3600, 'désignation + taille + N° prouvé ; parts au prorata', JSON.stringify(lignes));
    for (const [regime, taux] of [['franchise', null], ['normal', 20], ['marge', null]]) {
      const mt = F.montants(9000, regime, taux);
      const out = F.lignesDeVente({ designation: 'Lot 2 articles', centimes: 9000, lignes }, mt, { tva_regime: regime, tva_taux: taux });
      dit(out.length === 2 && out.reduce((s, l) => s + l.total, 0) === mt.ht, `${regime} : somme HT des lignes = HT de la facture`, JSON.stringify(out));
    }
    const faux = F.lignesDeVente({ designation: 'Lot', centimes: 9000, lignes: [{ designation: 'A', centimes: 5000 }, { designation: 'B', centimes: 3000 }] }, F.montants(9000, 'franchise'), { tva_regime: 'franchise' });
    dit(faux.length === 1 && faux[0].designation === 'Lot', 'lignes dont la somme ≠ prix ⇒ la ligne unique d’avant');
  }

  console.log('── 7. La route de facture lit la transaction du lot');
  {
    process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-de-banc';
    const realFetch = global.fetch; let vue = '';
    let P = null; try { P = await import('file://' + path.join(R, 'api', '_lib', 'facture-pro.js')); } catch (e) { dit(false, 'api/_lib/facture-pro.js se charge', e.message); }
    if (P && P.lignesLotFacture) {
      const owner = '11111111-1111-4111-8111-111111111111';
      global.fetch = async (u) => { vue = String(u); return { ok: true, json: async () => [{ nb: '2', items: [art('a', 'A', 30), art('b', 'B', 70)] }] }; };
      const r = await P.lignesLotFacture(owner, '42', '1234567', 5000);
      dit(r && r.lignes.length === 2 && r.lignes[0].centimes === 1500 && r.lignes[1].centimes === 3500, 'lot lu ⇒ une ligne par article, au prorata', JSON.stringify(r));
      dit(/id=eq\.harvest_42_txn_1234567/.test(vue) && /select=nb:data->payload->transaction->>items_count,items:data->payload->transaction->order->items/.test(vue) && !/select=data(&|$)/.test(vue), 'projection, jamais select=data (§4.4)', vue);
      global.fetch = async () => ({ ok: false, json: async () => [] });
      dit((await P.lignesLotFacture(owner, '42', '1234567', 5000)) === undefined, 'base KO ⇒ undefined (aucun numéro pris)');
      global.fetch = async () => ({ ok: true, json: async () => [{ nb: '1', items: [art('a', 'A', 30)] }] });
      dit((await P.lignesLotFacture(owner, '42', '1234567', 5000)) === null, 'un seul article ⇒ null (ligne unique d’avant)');
      global.fetch = realFetch;
      const srcFp = fs.readFileSync(path.join(R, 'api', '_lib', 'facture-pro.js'), 'utf8');
      dit(/const lot = await lignesLotFacture\(owner, preuve\.uid, tx, preuve\.centimes\);\s*if \(lot === undefined\) return repondre\(res, 503/.test(srcFp) && /\.\.\.\(lot \? \{ lignes: lot\.lignes \} : \{\}\)/.test(srcFp), '`emettre` lit le lot AVANT de numéroter, et pose ses lignes');
    }
    dit(typeof S.resumeVenteLot === 'function', 'la copie serveur se charge');
  }
}

function appli() {
  console.log('── 8. L’app branche la règle');
  {
    const app = require('./_source-app.cjs').sourceApp().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const n = (re) => (app.match(re) || []).length;
    dit(n(/const e = entreeVenteLot\(o, effEntry\(o\)\);/g) === 2 && /achat: \(o\) => achatDe\(entreeVenteLot\(o, effEntry\(o\)\)\)/.test(app), 'bénéfice (totaux, publication jour par jour, relevé) : le prix d’achat du LOT');
    dit(/if \(!lotsTx\) return;/.test(app), 'la publication du bénéfice attend les transactions des lots (pas su ⇒ rien publié)');
    dit(/const l = lotDeVente\(o\);\s*if \(l && l\.lu\) for \(const a of l\.articles\) if \(a\.item\) ids\.add\(String\(a\.item\)\);/.test(app), 'chaque article prouvé sort du stock (annoncesVendues)');
    dit(/const num = enLot \? lot\.tampon :/.test(app) && /enLot \? \{ numeros: lot\.nums \} : undefined/.test(app) && /Array\.isArray\(opts\.numeros\) \? opts\.numeros : \[numero\]/.test(app), 'le bordereau d’un lot : tampon des N°, chaque N° vérifié');
    dit(/numeroDeItem: \(id\) => \{ if \(onlineAnnonceIds\.has\(String\(id\)\)\) return null;/.test(app) && !/numeroDe\w*: \([^)]*\) => [^;]*title/.test(app), 'aucune voie par titre ; une annonce encore en ligne n’est jamais un article vendu');
    dit(/'vrm_lot_liens',/.test(app), '« Relier » est synchronisé (vrm_lot_liens)');
  }
}
