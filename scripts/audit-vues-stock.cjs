// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — VUES ET FAVORIS, VALEUR DU STOCK AU PRIX AFFICHÉ (20 nov. 2026, chantier « ce qui manque »)
//  Exécute les VRAIES règles (src/vuesFavoris.js, src/stockValeurAffiche.js) sur des articles construits par la VRAIE
//  règle d'identité (src/articles/modele.js `construireArticles`, src/articles/sources.js) — données inventées, aucun réseau.
//   V · la valeur au prix affiché : une paire publiée sur deux sites comptée UNE fois (prix Vinted, sinon le plus bas,
//       dit) ; « à confirmer », masquée, brouillon jamais ; deux paires sous un N° jamais sommées ; 50 titres identiques
//       sans N° = 50 paires (jamais réunies par le titre) ; prix illisible ⇒ « sans prix », couverture dite.
//   J · les vues et favoris : un point daté par la LECTURE (jamais l'heure de l'écran) ; une lecture ratée (rien, ou des
//       chiffres pas sus) n'efface pas les derniers chiffres ; une lecture en retard ne réécrit rien ; « aujourd'hui » =
//       le dernier point d'avant le jour de Paris ; la publication d'avant reste quand la lecture rate.
//   M · `--prouve` (aussi par défaut) : chaque règle réaffaiblie dans une COPIE ⇒ l'audit rougit.
//  `node scripts/audit-vues-stock.cjs` — 0 rouge exigé.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src');

// Le navigateur, le strict nécessaire : un stockage local et des événements.
const memo = new Map();
globalThis.localStorage = { getItem: (k) => (memo.has(k) ? memo.get(k) : null), setItem: (k, v) => memo.set(k, String(v)), removeItem: (k) => memo.delete(k) };
globalThis.window = globalThis.window || { dispatchEvent: () => true };

let ok = 0, ko = 0;
const muet = () => !!process.env.AUDIT_MUET;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!muet()) console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); return c; };
const H = 3600e3, J = 24 * H;

async function charger(dossier) {
  const u = (f) => pathToFileURL(path.join(dossier, f)).href + '?v=' + Math.random();
  return { V: await import(u('stockValeurAffiche.js')), F: await import(u('vuesFavoris.js')),
    M: await import(pathToFileURL(path.join(SRC, 'articles', 'modele.js')).href), S: await import(pathToFileURL(path.join(SRC, 'articles', 'sources.js')).href) };
}

// Des articles par la VRAIE règle d'identité : les annonces de chaque site dans la forme commune, puis `construireArticles`.
function articles({ M, S }, { vinted = [], lbc = [], ebay = [], fiches = {} }) {
  const comptes = [{ uid: '1', pseudo: 'compte_a', ok: true, lu: vinted.lu || null, enLigne: vinted.filter((x) => x.e === 'enligne'), aConfirmer: vinted.filter((x) => x.e === 'aconfirmer'), masquees: vinted.filter((x) => x.e === 'masquee'), brouillons: vinted.filter((x) => x.e === 'brouillon') }];
  const annonces = [
    ...S.annoncesVinted(comptes),
    ...S.annoncesLeboncoin(Object.fromEntries(lbc.map((x) => [x.id, { id: x.id, subject: x.t, price: x.p, account: 'lbc-account:9', stats: x.stats }])), { etatDe: (ad) => (lbc.find((x) => x.id === ad.id) || {}).e || 'active', numeroDe: (ad) => (lbc.find((x) => x.id === ad.id) || {}).n || '' }),
    ...S.annoncesEbay(ebay.map((x) => ({ itemId: x.id, title: x.t, price: x.p, currency: x.cur || 'EUR', frais: true, _compte: 'e1' })), { numeroDe: (x) => (ebay.find((y) => y.id === x.itemId) || {}).n || '' }),
  ];
  return M.construireArticles({ annonces, fiches, cle: (n) => String(n || '').trim().toUpperCase(), aVinted: true }).articles;
}
const vt = (id, prix, e = 'enligne', extra = {}) => ({ id, title: 'Nike Air Max 90 blanche', price: { amount: String(prix), currency_code: 'EUR' }, e, ...extra });

async function regles(dossier, { titre = '' } = {}) {
  const R = await charger(dossier);
  const { V, F } = R;
  const dc = (serie, champ) => (F.dernierConnu(serie, champ) || {}).v;
  if (!muet()) console.log('\nV · la valeur du stock au prix affiché' + titre);
  // V1 — LA paire : Vinted 100 € (fiche N° 12) + Leboncoin 90 € (N° 12) ⇒ un article, compté UNE fois, au prix Vinted.
  const a1 = articles(R, { vinted: [vt(1, 100)], lbc: [{ id: 501, t: 'Air Max', p: 90, e: 'active', n: '12' }], fiches: { 1: { numero: '12' } } });
  const v1 = V.valeurStockAffiche(a1);
  dit(a1.length === 1 && v1.n === 1 && v1.centimes === 10000 && v1.nVinted === 1 && v1.nMulti === 1, 'V1 une paire sur Vinted ET Leboncoin (même N°) : comptée une fois, au prix Vinted (100 €, pas 190 €)', { n: a1.length, v1 });
  // V2 — sans Vinted : Leboncoin 90 € + eBay 80 € sous le N° 7 ⇒ le plus bas, et c'est dit.
  const v2 = V.valeurStockAffiche(articles(R, { lbc: [{ id: 601, t: 'X', p: 90, e: 'active', n: '7' }], ebay: [{ id: 'e7', t: 'X', p: 80, n: '7' }] }));
  dit(v2.n === 1 && v2.centimes === 8000 && v2.nPlusBas === 1 && v2.nVinted === 0, 'V2 sans annonce Vinted : le PLUS BAS de ses annonces en ligne (80 €), compté comme tel', v2);
  // V3 — à confirmer, masquée, brouillon : pas « en ligne », pas comptées.
  const v3 = V.valeurStockAffiche(articles(R, { vinted: [vt(2, 50, 'aconfirmer'), vt(3, 60, 'masquee'), vt(4, 70, 'brouillon'), vt(5, 40)] }));
  dit(v3.n === 1 && v3.centimes === 4000, 'V3 seules les annonces EN LIGNE prouvées comptent (à confirmer, masquée, brouillon : non)', v3);
  // V4 — deux paires sous le même N° (le doublon, le seul rouge) : jamais sommées, comptées à part.
  const a4 = articles(R, { vinted: [vt(8, 100), vt(9, 120)], fiches: { 8: { numero: '30' }, 9: { numero: '30' } } });
  const v4 = V.valeurStockAffiche(a4);
  dit(a4.length === 1 && a4[0].doublon && v4.nDouble === 1 && v4.centimes === null, 'V4 deux paires sous un même N° (le doublon) : jamais sommées, comptées à part', { v4, doublons: a4.map((a) => a.doublon) });
  // V5 — un prix illisible (autre devise) : pas sommé, compté « sans prix », la couverture le dit.
  const v5 = V.valeurStockAffiche(articles(R, { vinted: [vt(10, 50)], ebay: [{ id: 'g1', t: 'Y', p: 70, cur: 'GBP', n: '' }] }));
  dit(v5.n === 2 && v5.nPrix === 1 && v5.nSans === 1 && v5.centimes === 5000, 'V5 un prix illisible n’est jamais sommé : « sur 2 », 1 sans prix', v5);
  // V6 — 50 annonces au MÊME titre, sans N° : 50 paires (jamais réunies par ressemblance, CLAUDE.md §5).
  const v6 = V.valeurStockAffiche(articles(R, { vinted: Array.from({ length: 50 }, (_, k) => vt(1000 + k, 30)) }));
  dit(v6.n === 50 && v6.centimes === 150000, 'V6 50 titres identiques sans N° = 50 paires, 1 500 €', v6);
  // V7 — rien en ligne : 0 € « sur 0 » ; lecture ratée : rien publié, la publication d'avant reste.
  dit(V.valeurStockAffiche([]).centimes === 0 && V.valeurStockAffiche([]).n === 0, 'V7 aucun article en ligne : 0 € sur 0 (lu, pas un manque)');
  memo.clear();
  V.publierStockValeur(v1, { owner: 'o1', maintenant: 1 });
  const ko1 = V.publierStockValeur(null, { owner: 'o1' });
  const lu1 = V.lireStockValeur('o1');
  dit(ko1 === false && lu1 && lu1.centimes === 10000, 'V8 une lecture ratée ne publie rien : le dernier chiffre reste', lu1);
  dit(V.lireStockValeur('o2') === null, 'V9 la publication d’un autre compte VRM ne se lit pas (cloisonnement de l’appareil)');

  if (!muet()) console.log('\nJ · les vues et favoris' + titre);
  const T = Date.parse('2026-11-20T15:00:00Z');
  const hier = T - J, avantHier = T - 2 * J;
  // J1 — le point est daté par la LECTURE du compte (`lu`), pas par l'heure de l'écran.
  const r1 = F.noterVuesLues(null, [{ site: 'vinted', id: 1, lu: hier, vues: 100, favoris: 4 }], { maintenant: T });
  dit(r1.ajoutes === 1 && r1.journal.a['vinted#1'][0][0] === hier, 'J1 un point daté par SA lecture (hier), jamais l’heure de l’écran', r1.journal);
  // J2 — une lecture qui ne sait pas (Vinted renvoie 0 vue ⇒ null) n'efface pas le dernier chiffre.
  const r2 = F.noterVuesLues(r1.journal, [{ site: 'vinted', id: 1, lu: T - H, vues: null, favoris: null }], { maintenant: T });
  dit(r2.ajoutes === 0 && dc(r2.journal.a['vinted#1'], 1) === 100, 'J2 une lecture « pas su » n’écrit rien : 100 vues restent', r2.journal);
  const r2b = F.noterVuesLues(r1.journal, [{ site: 'vinted', id: 1, lu: T - H, vues: null, favoris: 6 }], { maintenant: T });
  dit(dc(r2b.journal.a['vinted#1'], 1) === 100 && dc(r2b.journal.a['vinted#1'], 2) === 6, 'J3 des favoris lus sans les vues : les vues d’avant restent (jamais un blanc par-dessus un chiffre)', r2b.journal);
  // J4 — une lecture RATÉE (aucune annonce) : le journal est le même objet.
  const r4 = F.noterVuesLues(r1.journal, [], { maintenant: T });
  dit(r4.journal === r1.journal && r4.ajoutes === 0, 'J4 une lecture ratée (rien lu) ne change rien');
  // J5 — une lecture en retard ne réécrit pas l'histoire.
  const r5 = F.noterVuesLues(r1.journal, [{ site: 'vinted', id: 1, lu: avantHier, vues: 50, favoris: 1 }], { maintenant: T });
  dit(r5.ajoutes === 0, 'J5 une lecture plus ancienne que le dernier point n’écrit rien');
  // J6 — « aujourd'hui » : le dernier point d'AVANT le jour de Paris, comparé au chiffre lu.
  const j6 = F.noterVuesLues(r1.journal, [{ site: 'vinted', id: 1, lu: T - H, vues: 130, favoris: 5 }], { maintenant: T }).journal;
  const art = [{ annonces: [{ site: 'vinted', id: '1', etat: 'enligne', vues: 130, favoris: 5 }, { site: 'vinted', id: '2', etat: 'aconfirmer', vues: 999, favoris: 9 }] },
    { annonces: [{ site: 'leboncoin', id: '7', etat: 'enligne', vues: null, favoris: null }] }];
  const t6 = F.vuesFavorisEnLigne(art, j6, { maintenant: T });
  dit(t6.vues.total === 130 && t6.vues.gagnes === 30 && t6.favoris.total === 5 && t6.favoris.gagnes === 1 && t6.nAnnonces === 2 && t6.vues.n === 1,
    'J6 en ligne seulement : 130 vues (+30 aujourd’hui), 5 favoris (+1), « sur 1 annonce » (Leboncoin sans chiffre : pas compté)', t6);
  const t7 = F.vuesFavorisEnLigne([{ annonces: [{ site: 'leboncoin', id: '7', etat: 'enligne', vues: null, favoris: null }] }], null, { maintenant: T });
  dit(t7.vues.total === null && t7.favoris.total === null, 'J7 aucun chiffre lu : « — » (null), jamais 0', t7);
  // J8 — la publication : lecture ratée ⇒ la publication d'avant reste.
  memo.clear();
  F.publierVuesFavoris(t6, { owner: 'o1', maintenant: 1 });
  const ko8 = F.publierVuesFavoris(null, { owner: 'o1' });
  const l8 = F.lireVuesFavoris('o1');
  dit(ko8 === false && l8 && l8.vues.total === 130, 'J8 une lecture ratée ne publie rien : les derniers chiffres restent', l8);
  // J10 — une lecture qui n'apprend rien (base injoignable : tous les sites ratés, ou Vinted raté sans une annonce Vinted).
  dit(F.lectureUtile(null) === false && F.lectureUtile({ annonces: [], manque: ['vinted', 'leboncoin', 'ebay', 'vestiaire'] }) === false
    && F.lectureUtile({ annonces: [{ site: 'ebay' }], manque: ['vinted'] }) === false, 'J10 lecture ratée (rien, ou Vinted raté) ⇒ rien n’est noté ni publié');
  dit(F.lectureUtile({ annonces: [{ site: 'vinted' }], manque: ['leboncoin'] }) === true && F.lectureUtile({ annonces: [], manque: [] }) === true,
    'J11 un site manquant parmi d’autres lus ⇒ publié « au moins » ; aucun article et rien raté ⇒ 0 lu');
  // J9 — le pont des sources : l'heure de lecture du compte Vinted arrive jusqu'à l'annonce de l'article.
  const a9 = articles(R, { vinted: Object.assign([vt(77, 20, 'enligne', { views: 12, favourites: 3 })], { lu: hier }) });
  const an9 = a9[0] && a9[0].annonces[0];
  dit(!!an9 && an9.lu === hier && an9.vues === 12 && an9.favoris === 3, 'J9 l’heure de LA lecture du dressing (`lu`) suit l’annonce jusqu’à l’article', an9);
  return { ok, ko };
}

// Les mutations : chaque règle réaffaiblie dans une COPIE ⇒ au moins un rouge.
const MUTATIONS = [
  { nom: 'chaque annonce sommée (une paire sur deux sites comptée deux fois)', f: 'stockValeurAffiche.js', de: 'if (v) { p = cents(v.prix); nVinted += 1; }', vers: 'if (v) { p = L.reduce((t, x) => t + (cents(x.prix) || 0), 0); nVinted += 1; }' },
  { nom: 'le prix le plus HAUT au lieu du plus bas', f: 'stockValeurAffiche.js', de: 'p = Math.min(...ps)', vers: 'p = Math.max(...ps)' },
  { nom: 'à confirmer comptée en ligne', f: 'stockValeurAffiche.js', de: "x && x.etat === 'enligne'", vers: "x && (x.etat === 'enligne' || x.etat === 'aconfirmer')" },
  { nom: 'publier sur une lecture ratée (stock)', f: 'stockValeurAffiche.js', de: "if (!v || !Number.isFinite(v.n)) return false;", vers: "if (!v) { try { localStorage.removeItem(CLE_STOCK_VALEUR); } catch (_) {} return false; }" },
  { nom: 'un « pas su » écrit par-dessus le chiffre', f: 'vuesFavoris.js', de: 'if (vues == null && fav == null) continue;', vers: '' , aussi: { de: 'if (v != null) return { v, t: p[0] };', vers: 'return v == null ? null : { v, t: p[0] };' } },
  { nom: 'le point daté par l’heure de l’écran', f: 'vuesFavoris.js', de: 'let n = [...L, [Math.round(ts), vues, fav]];', vers: 'let n = [...L, [Math.round(maintenant), vues, fav]];' },
  { nom: 'une lecture ratée prise pour une réponse', f: 'vuesFavoris.js', de: "if (!lu || !Array.isArray(lu.annonces)) return false;", vers: 'if (lu) return true;' },
  { nom: 'publier sur une lecture ratée (vues)', f: 'vuesFavoris.js', de: 'if (!r || !Number.isFinite(r.nAnnonces)) return false;', vers: 'if (!r) { try { localStorage.removeItem(CLE_VUES_FAVORIS); } catch (_) {} return false; }' },
];

(async () => {
  await regles(SRC);
  const verts = ok, rouges = ko;
  if (process.argv.includes('--sans-preuve')) { console.log(`\n${rouges ? '❌' : '✅'} audit-vues-stock : ${verts} verts, ${rouges} rouge(s)`); process.exit(rouges ? 1 : 0); }
  if (!muet()) console.log('\nM · les mutations (chacune doit rougir)');
  let mortes = 0;
  for (const m of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vues-stock-'));
    for (const f of ['stockValeurAffiche.js', 'vuesFavoris.js', 'dateParis.js']) fs.copyFileSync(path.join(SRC, f), path.join(tmp, f));
    const p = path.join(tmp, m.f); let t = fs.readFileSync(p, 'utf8');
    const avant = t; t = t.replace(m.de, m.vers); if (m.aussi) t = t.replace(m.aussi.de, m.aussi.vers);
    if (t === avant) { console.log('  ❌ mutation introuvable : ' + m.nom); ko++; continue; }
    fs.writeFileSync(p, t);
    ok = 0; ko = 0; process.env.AUDIT_MUET = '1';
    try { await regles(tmp); } catch (e) { ko++; }
    delete process.env.AUDIT_MUET;
    const rougit = ko > 0; if (rougit) mortes++;
    console.log((rougit ? '  ✅ ' : '  ❌ ') + `mutation « ${m.nom} » ⇒ ${ko} rouge(s)`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const fin = rouges + (MUTATIONS.length - mortes);
  console.log(`\n${fin ? '❌' : '✅'} audit-vues-stock : ${verts} verts, ${rouges} rouge(s) ; mutations ${mortes}/${MUTATIONS.length} rougissent`);
  process.exit(fin ? 1 : 0);
})();
