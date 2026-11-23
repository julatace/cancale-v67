// ════════════════════════════════════════════════════════════════════════
//  LA NÉGOCIATION INTELLIGENTE (22 nov., ext. 5.437) — une seule règle avec les paliers
//  1. le bloc <nego-intelligente-regle> est le MÊME dans src/negociationPaliers.js et background.js ;
//     l'app (`palierSuivant`) et l'extension (`palierContreOffre`) rendent la même réponse sur une table de cas ;
//  2. la règle : jamais sous le plancher (prix mini / achat + 10 %), jamais ≤ l'offre, toujours sous la contre-offre
//     précédente ; petit écart ⇒ un tour ; demande forte ⇒ 4 tours, descente lente ; annonce ancienne ⇒ 2 tours ;
//     note basse ⇒ on cède moins ; arrondis naturels (78,63 → 79) ; la raison de chaque palier est rendue ;
//  3. le MOTEUR exécuté (vrai background.js, scripts/_fond-vm.cjs) : offres 70, 75, 78 sur 100 € (mini 85) ⇒ 95, 90,
//     85 puis plus rien ; le journal porte la raison (« ecart:15 tour:1/3 ») ; paliers FIXES inchangés si non choisie.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const RACINE = path.join(__dirname, '..');
const F_SRC = path.join(RACINE, 'src/negociationPaliers.js');
const BG0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : cheminSource();
const DEB = '// <nego-intelligente-regle>', FIN = '// </nego-intelligente-regle>';
const bloc = (t) => { const a = t.indexOf(DEB), b = t.indexOf(FIN); return a < 0 || b < 0 ? null : t.slice(a, b + FIN.length); };
if (args.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); const bg = fs.readFileSync(BG0, 'utf8'); const v = bloc(bg);
  if (!b || !v) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(BG0, bg.replace(v, b)); console.log('✅ bloc recopié'); process.exit(0);
}
const MUTATIONS = {
  plancher: [['const lo = Math.ceil(f - 1e-9), hi', 'const lo = Math.ceil(f - 30), hi'], ['  if (v < f) v = f;\n  if (!(v < haut)', '  if (!(v < haut)']],
  haut: ['const haut = Number(dernier) > 0 ? Math.min(p, Number(dernier)) : p;', 'const haut = p;'],
  offre: ['  if (Number.isFinite(o) && o > 0 && !(v > o)) return null;\n  return { i: t,', '  return { i: t,'],
  arrondi: ["if (raw >= 20) for (let n = lo; n <= hi; n++) {", "if (false) for (let n = lo; n <= hi; n++) {"],
  demande: ["  else { if (demande === 'forte') N = 4;", "  else { if (false) N = 4;"],
  dernier: ['ctxN.dernier = Number((jouesTout[String(o.tx)] || {}).p) || null;', 'ctxN.dernier = null;'],
  raison: ["...(Array.isArray(palier.raisons) ? { r: palier.raisons.map((x) => x.k + ':' + x.v).join(' ').slice(0, 160) } : {})", ''],
  choix: ['  if (R.intelligente) {\n    const c = ctx', '  if (false) {\n    const c = ctx'],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`); if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let BG = BG0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const paires = Array.isArray(MUTATIONS[mut][0]) ? MUTATIONS[mut] : [MUTATIONS[mut]]; let s = fs.readFileSync(BG0, 'utf8');
  for (const [a, b] of paires) { if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } s = s.split(a).join(b); }
  BG = path.join(path.dirname(BG0), `.mut-ni-${mut}-${process.pid}.js`); fs.writeFileSync(BG, s);
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };
const T0 = Date.now(), iso = (t) => new Date(t).toISOString();

(async () => {
  const A = await import(pathToFileURL(F_SRC).href);
  const bs = bloc(fs.readFileSync(F_SRC, 'utf8')), bb = bloc(fs.readFileSync(BG, 'utf8'));
  dit(!!bb, 'background.js porte le bloc <nego-intelligente-regle>');
  if (!mut) dit(bs && bb && bs === bb, 'le bloc est identique dans l’app et l’extension (--recopie)');
  try {
    const f = faireFond({ src: BG });
    const E = f.ctx.palierContreOffre;
    const R = (o) => Object.assign({ actif: true, intelligente: true, paliers: [50, 80, 100] }, o);
    const cas = [
      { prix: 100, mini: 85, offre: 70, joues: [], reglages: R() },
      { prix: 100, mini: 85, offre: 75, joues: [0], reglages: R(), ctx: { dernier: 95 } },
      { prix: 100, mini: 85, offre: 78, joues: [0, 1], reglages: R(), ctx: { dernier: 90 } },
      { prix: 100, mini: 85, offre: 80, joues: [0, 1, 2], reglages: R(), ctx: { dernier: 85 } },
      { prix: 100, mini: 85, offre: 60, joues: [], reglages: R(), ctx: { favoris: 20, vues: 400 } },
      { prix: 100, mini: 85, offre: 60, joues: [], reglages: R(), ctx: { jours: 45 } },
      { prix: 100, mini: 85, offre: 60, joues: [], reglages: R(), ctx: { note: { etoiles: 2.5, n: 4 } } },
      { prix: 100, mini: 85, offre: 84, joues: [], reglages: R() },
      { prix: 40, mini: 37, offre: 20, joues: [], reglages: R() },
      { prix: 89, mini: 60, offre: 50, joues: [], reglages: R() },
      { prix: 100, mini: 85, offre: 96, joues: [], reglages: R() },
      { prix: 100, mini: null, achat: 70, offre: 50, joues: [], reglages: R() },
      { prix: 100, mini: 85, offre: 70, joues: [], reglages: R({ pas: 0.5 }) },
      { prix: 100, mini: 85, offre: 70, joues: [], reglages: R({ intelligente: false }) },
    ];
    const diff = cas.map((c, i) => [i, JSON.stringify(A.palierSuivant(c)), JSON.stringify(E(c))]).filter(([, a, b]) => a !== b);
    dit(!diff.length, `l’app et l’extension rendent la même réponse (${cas.length} cas)`, JSON.stringify(diff));
    const r = cas.map((c) => E(c));
    dit(r[0] && r[0].prix === 95 && r[1] && r[1].prix === 90 && r[2] && r[2].prix === 85 && r[2].finale && r[3] === null, '100 € (mini 85) : 95 → 90 → 85 (la dernière = le plancher), puis plus rien', JSON.stringify(r.slice(0, 4)));
    dit(r[4] && r[4].tours === 4 && r[4].prix > r[0].prix && r[4].raisons.some((x) => x.k === 'demande' && x.v === 'forte'), 'demande forte (20 favoris, 400 vues) : 4 tours, on cède moins au 1er', JSON.stringify(r[4]));
    dit(r[5] && r[5].tours === 2 && r[5].prix <= r[0].prix && r[5].raisons.some((x) => x.k === 'annonce'), 'annonce de 45 jours : 2 tours, descente plus rapide', JSON.stringify(r[5]));
    dit(r[6] && r[6].prix >= r[0].prix && r[6].raisons.some((x) => x.k === 'note'), 'acheteur noté 2,5 ★ : on cède moins avant le dernier tour', JSON.stringify(r[6]));
    dit(r[7] && r[7].prix < r[0].prix && r[7].raisons.some((x) => x.k === 'offre'), 'son offre (84) proche du plancher : un pas de plus vers lui', JSON.stringify(r[7]));
    dit(r[8] && r[8].tours === 1 && r[8].prix === 37 && r[8].finale, 'petit écart (40 → 37) : directement le plancher, en un tour', JSON.stringify(r[8]));
    dit(A.niArrondi(78.63, 60, 100, 1) === 79 && A.niArrondi(84.3, 60, 100, 1) === 85 && A.niArrondi(97.84, 85, 100, 1) === 98 && A.niArrondi(12.4, 10, 20, 1) === 12, 'arrondis naturels : 78,63 → 79 ; 84,30 → 85 ; 97,84 → 98 ; 12,40 → 12', JSON.stringify([A.niArrondi(78.63, 60, 100, 1), A.niArrondi(83.2, 60, 100, 1), A.niArrondi(12.4, 10, 20, 1)]));
    { const vb = { prix: f.ctx.niArrondi(86.3, 85.6, 100, 1) }; dit(vb.prix >= 85.6, 'un arrondi ne descend jamais sous le plancher (85,60)', JSON.stringify(vb)); }
    dit(r[10] === null, 'une contre-offre ne serait pas au-dessus de son offre (96) : rien');
    dit(r[11] && r[11].plancher === 77 && r.every((x, i) => !x || x.accepter || (x.prix >= x.plancher && x.prix > cas[i].offre)), 'sans prix mini : plancher achat + 10 % (77) ; jamais sous le plancher, jamais ≤ l’offre', JSON.stringify(r[11]));
    dit(r[12] && r[12].prix * 2 === Math.round(r[12].prix * 2), 'arrondi 0,50 € respecté');
    dit(r[13] && r[13].prix === 93 && !r[13].raisons, 'descente intelligente non choisie : les paliers fixes, inchangés (93)', JSON.stringify(r[13]));
    // Toujours sous la contre-offre précédente, quelle que soit l'offre.
    let prec = null, okD = true;
    for (const [t, off] of [[0, 30], [1, 31], [2, 32]]) { const x = E({ prix: 200, mini: 120, offre: off, joues: Array.from({ length: t }, (_, i) => i), reglages: R(), ctx: { dernier: prec } }); if (!x) break; if (prec != null && !(x.prix < prec)) okD = false; prec = x.prix; }
    dit(okD, 'chaque contre-offre est sous la précédente');
    const d89 = E({ prix: 100, mini: 85, offre: 60, joues: [0], reglages: R(), ctx: { dernier: 89 } });
    dit(d89 && d89.prix < 89 && d89.prix >= 85, 'la précédente était 89 : la suivante est dessous (et jamais sous 85)', JSON.stringify(d89));
    const bas = E({ prix: 100, mini: 85, offre: 40, joues: [0], reglages: R() });
    dit(bas && bas.prix >= 85, 'offre très basse (40) : la contre-offre reste au-dessus du plancher', JSON.stringify(bas));
  } catch (e) { dit(false, 'règle — exception', e && e.stack); }

  // 3. Le moteur
  const monde = (plus = {}, item = {}) => {
    const lignes = {
      main: { vinted_offres_auto: false, vinted_offres_garde: { v: 1, at: T0, complet: true, items: [] }, vinted_offres_paliers: Object.assign({ actif: true, intelligente: true, paliers: [50, 80, 100], messages: [] }, plus), vinted_annonce_numeros: { 4242: { numero: '12', accountId: '111', min: 85 } }, vinted_buyprice_by_num: {} },
      vinted_listing_dates: {},
      harvest_111_listings: { type: 'listings', capturedAt: iso(T0 - 600000), payload: { items: [Object.assign({ id: 4242, title: 'Paire', price: { amount: '100.0' } }, item)] } },
    };
    const f = faireFond({ src: BG, connecte: '111', lignes, vinted: () => ({ status: 200, body: { code: 0 } }) });
    let offre = { conv: '9001', prix: 70, tx: '777', oid: '901', item: '4242', pseudo: 'acheteuse', article: 'Paire' };
    f.ctx.offresEnAttente = async () => (offre ? [Object.assign({ acheteur: '555', noteBrute: { rep: '0.96', rc: '40', cap: new Date().toISOString() } }, offre)] : []);
    f.ctx.relireOffre = async () => ({ etat: 'attend' });
    f.ctx.secuGeste = async () => null;
    f.ctx.porteDiscretion = async () => null;
    f.ctx.prolongerVerrouStock = async () => true;
    f.ctx.delaiOffreMs = () => -60000;
    f.poser = (o) => { offre = o; };
    return f;
  };
  const offres = (f) => f.j.vinted.filter((x) => /\/transactions\/777\/offers$/.test(String(x.chemin || x.url || x.path || '')) && String(x.methode || x.method || '').toUpperCase() === 'POST');
  const prixDe = (x) => { try { const b = typeof x.corps === 'string' ? JSON.parse(x.corps) : (x.corps || x.body || {}); return Number(b.offer && b.offer.price); } catch (_) { return NaN; } };
  try {
    const f = monde();
    const deux = async (x) => { await x.ctx.autoAccepterOffresUnPassage('111', 'v'); await x.ctx.autoAccepterOffresUnPassage('111', 'v'); };
    await deux(f);
    for (const [p, oid] of [[75, '902'], [78, '903'], [80, '904']]) { f.poser({ conv: '9001', prix: p, tx: '777', oid, item: '4242', pseudo: 'acheteuse', article: 'Paire' }); await deux(f); }
    const o = offres(f).map(prixDe);
    dit(o.join(',') === '95,90,85', 'moteur : 70, 75, 78, 80 ⇒ 95, 90, 85 puis plus rien (jamais sous le plancher)', JSON.stringify(o));
    const jr = Object.keys(f.lignes).filter((k) => /^journal_vrm_111_/.test(k)).flatMap((k) => f.lignes[k].e || (f.lignes[k].data && f.lignes[k].data.e) || []);
    const co = jr.filter((x) => x.s === 'contre_offre');
    dit(co.length === 3 && co.every((x) => /ecart:15/.test(String(x.r || '')) && /tour:\d\/3/.test(String(x.r || ''))), 'journal : chaque contre-offre porte sa raison (écart, tour)', JSON.stringify(co));
    const h = monde();
    await h.ctx.chrome.storage.local.set({ vrmContreOffres: { 777: { i: [0], at: Date.now(), p: 89 } } });
    h.poser({ conv: '9001', prix: 75, tx: '777', oid: '905', item: '4242', pseudo: 'acheteuse', article: 'Paire' });
    await deux(h);
    const oh = offres(h).map(prixDe);
    dit(oh.length === 1 && oh[0] < 89 && oh[0] >= 85, 'moteur : la contre-offre précédente (89, retenue) ⇒ la suivante est dessous', JSON.stringify(oh));
    const g = monde({}, { favourite_count: 25, view_count: 500 });
    await deux(g);
    const og = offres(g).map(prixDe);
    dit(og.length === 1 && og[0] > 95, 'moteur : annonce très aimée (25 favoris) ⇒ 1re contre-offre plus haute que 95', JSON.stringify(og));
  } catch (e) { dit(false, 'moteur — exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-nego-intelligente : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
