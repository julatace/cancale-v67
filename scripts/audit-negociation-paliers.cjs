// ════════════════════════════════════════════════════════════════════════════
//  LA NÉGOCIATION PAR PALIERS (19 nov., ext. 5.409), sans IA
//  1. La règle de l'app (src/negociationPaliers.js) et sa copie dans le VRAI background.js (`palierContreOffre`)
//     rendent la MÊME réponse sur une table de cas (plancher = prix mini, sinon remise maximale ; arrondi ; jamais
//     sous le plancher ; jamais ≤ l'offre ; paliers déjà joués sautés ; éteint ⇒ rien).
//  2. Le MOTEUR exécuté (`autoAccepterOffresUnPassage`, scripts/_fond-vm.cjs, faux Vinted qui compte) :
//     éteint ⇒ aucune requête ; allumé ⇒ une contre-offre au palier 1 (93 pour 100 → plancher 85), la même offre
//     n'en reçoit jamais une seconde ; la nouvelle offre de l'acheteur reçoit le palier suivant (88), puis le
//     plancher (85), puis plus rien ; jamais un prix sous le plancher ; une contre-offre passe la garde (50/h plein
//     ⇒ rien ne part) ; journal « contre_offre ».
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const RACINE = path.join(__dirname, '..');
const BG0 = cheminSource();
const MUTATIONS = {
  plancher: ['    if (v < f) v = f;\n    if (v >= p) continue;\n    if (!out.length || v < out[out.length - 1]) out.push(v);\n  }\n  return out;\n}\nfunction palierContreOffre', '    if (v >= p) continue;\n    if (!out.length || v < out[out.length - 1]) out.push(v);\n  }\n  return out;\n}\nfunction palierContreOffre'],
  deuxFois: ["jt[String(o.tx)] = { i: [...(e0.i || []), palier.i], at: Date.now() };", ''],
  joues: ["joues: (jouesTout[String(o.tx)] || {}).i || [],", 'joues: [],'],
  eteint: ["if (!R.actif) return null;\n  const f = plancherPalier(", "const f = plancherPalier("],
  sousOffre: ["    if (!(l[i] > Number(offre))) return null;\n    if (l[i] < f) return null;\n    return { i, prix: l[i], plancher: f, finale: i === l.length - 1 };\n  }\n  return null;\n}\n// La garde de mots", "    return { i, prix: l[i], plancher: f, finale: i === l.length - 1 };\n  }\n  return null;\n}\n// La garde de mots"],
  // 5.410.4 : le plancher ABSOLU (prix mini / achat + 10 %) sous une tranche ou une marge ; « flexible » jamais sous le plancher.
  absolu: ["  if (abs != null && f < abs) f = abs;\n  return f < p ? f : null;\n}\nfunction prixPaliersExt", "  return f < p ? f : null;\n}\nfunction prixPaliersExt"],
  flexible: ["if (R.flexible > 0 && Number(offre) >= f && Number(offre) < l[i]", "if (R.flexible > 0 && Number(offre) < l[i]"],
  finale: ["messages: palier.finale && reg.paliers.msgFinale.length ? reg.paliers.msgFinale : reg.paliers.msgContre.length", "messages: reg.paliers.msgContre.length"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let BG = BG0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  const s = fs.readFileSync(BG0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  BG = path.join(path.dirname(BG0), `.mut-${mut}-${process.pid}.js`);
  fs.writeFileSync(BG, s.replace(a, b));
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };
const T0 = Date.now(), iso = (t) => new Date(t).toISOString();

(async () => {
  const A = await import(pathToFileURL(path.join(RACINE, 'src', 'negociationPaliers.js')).href);
  // 1. La même réponse, app et extension.
  try {
    const f = faireFond({ src: BG });
    const E = f.ctx.palierContreOffre;
    const R = (o) => Object.assign({ actif: true, paliers: [50, 80, 100] }, o);
    const cas = [
      { prix: 100, mini: 85, offre: 70, joues: [], reglages: R() },
      { prix: 100, mini: 85, offre: 70, joues: [0], reglages: R() },
      { prix: 100, mini: 85, offre: 70, joues: [0, 1], reglages: R() },
      { prix: 100, mini: 85, offre: 70, joues: [0, 1, 2], reglages: R() },
      { prix: 100, mini: 85, offre: 90, joues: [0], reglages: R() },
      { prix: 100, mini: null, offre: 60, joues: [], reglages: R({ remiseMax: 20 }) },
      { prix: 100, mini: null, offre: 60, joues: [], reglages: R() },
      { prix: 100, mini: 120, offre: 60, joues: [], reglages: R() },
      { prix: 47.5, mini: 40, offre: 30, joues: [], reglages: R({ arrondi: false }) },
      { prix: 47.5, mini: 40, offre: 30, joues: [], reglages: R() },
      { prix: 100, mini: 85, offre: 70, joues: [], reglages: R({ actif: false }) },
      { prix: 100, mini: 85, offre: 70, joues: [], reglages: R({ paliers: [10, 10, 33, 'x', 100] }) },
      { prix: 100, mini: 85.4, offre: 70, joues: [0, 1], reglages: R() },
      // 5.410.4 — tranches, bonus de lot, plancher absolu (achat + 10 %), pas 0,50 €, « rester flexible ».
      { prix: 30, mini: null, offre: 15, joues: [], reglages: R({ tranches: [{ de: 20, a: 40, baisse: 6 }] }) },
      { prix: 30, mini: null, offre: 15, joues: [0, 1], reglages: R({ tranches: [{ de: 20, a: 40, baisse: 6 }] }) },
      { prix: 30, mini: 27, offre: 15, joues: [0, 1], reglages: R({ tranches: [{ de: 20, a: 40, baisse: 6 }] }) },
      { prix: 30, mini: null, achat: 25, offre: 15, joues: [0], reglages: R({ tranches: [{ de: 20, a: 40, baisse: 6 }] }) },
      { prix: 30, mini: null, offre: 15, nArticles: 2, joues: [0, 1], reglages: R({ tranches: [{ de: 20, a: 40, baisse: 6 }], bonusLot: 50 }) },
      { prix: 100, mini: null, achat: 90, offre: 50, joues: [], reglages: R({ remiseMax: 30 }) },
      { prix: 100, mini: null, achat: 60, offre: 50, joues: [], reglages: R() },
      { prix: 47.5, mini: 40, offre: 30, joues: [], reglages: R({ pas: 0.5 }) },
      { prix: 100, mini: 85, offre: 92, joues: [], reglages: R({ flexible: { actif: true, ecart: 2 } }) },
      { prix: 100, mini: 85, offre: 90, joues: [], reglages: R({ flexible: { actif: true, ecart: 2 } }) },
      { prix: 100, mini: 85, offre: 84, joues: [0, 1], reglages: R({ flexible: { actif: true, ecart: 2 } }) },
    ];
    const diff = cas.map((c, i) => [i, JSON.stringify(A.palierSuivant(c)), JSON.stringify(E(c))]).filter(([, a, b]) => a !== b);
    dit(!diff.length, `la règle de l’app et sa copie dans l’extension rendent la même réponse (${cas.length} cas)`, JSON.stringify(diff));
    const ap = A.apercuPaliers(100, 85, R());
    dit(ap && ap.chaine.join(' → ') === '100 → 93 → 88 → 85' && ap.plancher === 85, 'aperçu « 100 → 93 → 88 → 85 · plancher 85 »', JSON.stringify(ap));
    dit(cas.every((c) => { const r = E(c); return !r || (r.prix >= r.plancher && (r.accepter ? r.prix === c.offre : r.prix > c.offre)); }), 'jamais sous le plancher, jamais ≤ l’offre de l’acheteur (sauf « flexible » : son offre, au-dessus du plancher)');
    dit(E(cas[10]) === null && E(cas[6]) === null && E(cas[7]) === null, 'éteint, sans plancher, ou un mini au-dessus du prix ⇒ rien');
    const n0 = 13;
    dit(JSON.stringify(f.ctx.prixPaliersExt(30, 24, f.ctx.reglagesPaliersExt(R())) ) === '[27,25,24]' && E(cas[n0 + 1]).prix === 24, 'tranche « de 20 € à 40 € : baisse max 6 € » : article à 30 € ⇒ 24 € au plus bas', JSON.stringify(E(cas[n0 + 1])));
    dit(E(cas[n0 + 2]).plancher === 27 && E(cas[n0 + 3]).plancher === 27.5, 'plancher ABSOLU : jamais sous le prix mini (27) ni l’achat + 10 % (27,50) même avec une tranche', JSON.stringify([E(cas[n0 + 2]), E(cas[n0 + 3])]));
    dit(E(cas[n0 + 4]).plancher === 21 && E(cas[n0 + 5]).plancher === 99, 'bonus de lot (+50 % ⇒ 9 € de baisse sur 2 articles) ; marge 30 % remontée à l’achat + 10 % (99)', JSON.stringify([E(cas[n0 + 4]), E(cas[n0 + 5])]));
    dit(E(cas[n0 + 6]) && E(cas[n0 + 6]).plancher === 66, 'sans mini ni marge : le plancher est l’achat + 10 %', JSON.stringify(E(cas[n0 + 6])));
    dit(E(cas[n0 + 7]) && E(cas[n0 + 7]).prix * 2 === Math.round(E(cas[n0 + 7]).prix * 2), 'arrondi 0,50 €', JSON.stringify(E(cas[n0 + 7])));
    dit(E(cas[n0 + 8]) && E(cas[n0 + 8]).accepter === true && E(cas[n0 + 8]).prix === 92 && E(cas[n0 + 9]) && !E(cas[n0 + 9]).accepter && E(cas[n0 + 10]) && !E(cas[n0 + 10]).accepter && E(cas[n0 + 10]).prix === 85, '« rester flexible » : 92 pour un palier à 93 ⇒ acceptée ; 90 ⇒ contre-offre ; 84 sous le plancher 85 ⇒ jamais acceptée (contre-offre au plancher)', JSON.stringify([E(cas[n0 + 8]), E(cas[n0 + 9]), E(cas[n0 + 10])]));
    dit(E(cas[2]) && E(cas[2]).finale === true && E(cas[0]).finale === false, 'la dernière contre-offre (= le plancher) est l’étape FINALE');
  } catch (e) { dit(false, 'règle — exception', e && e.stack); }

  // 2. Le moteur exécuté.
  const monde = (paliersActifs, store = {}, plus = {}) => {
    const lignes = {
      main: { vinted_offres_auto: false, vinted_offres_garde: { v: 1, at: T0, complet: true, items: [] }, vinted_offres_paliers: Object.assign({ actif: paliersActifs, paliers: [50, 80, 100], messages: [] }, plus), vinted_annonce_numeros: { 4242: { numero: '12', accountId: '111', min: 85 } }, vinted_buyprice_by_num: {} },
      vinted_listing_dates: {},
      harvest_111_listings: { type: 'listings', capturedAt: iso(T0 - 600000), payload: { items: [{ id: 4242, title: 'Paire', price: { amount: '100.0' } }] } },
    };
    const f = faireFond({ src: BG, connecte: '111', lignes, store, vinted: () => ({ status: 200, body: { code: 0 } }) });
    let offre = { conv: '9001', prix: 70, tx: '777', oid: '901', item: '4242', pseudo: 'acheteuse', article: 'Paire' };
    // 5.430 : l'acheteur et la note que la conversation rangée porte (la vraie forme : feedback_reputation, review_count) — ★ 4,8 · 40.
    f.ctx.offresEnAttente = async () => (offre ? [Object.assign({ acheteur: '555', noteBrute: { rep: '0.96', rc: '40', cap: new Date().toISOString() } }, offre)] : []);
    f.ctx.relireOffre = async () => ({ etat: 'attend' });
    f.ctx.secuGeste = async () => null;
    f.ctx.porteDiscretion = async () => null;
    f.ctx.prolongerVerrouStock = async () => true;
    f.ctx.delaiOffreMs = () => -60000;          // l'offre est « mûre » tout de suite (le tirage 3–20 min est jugé par audit-moteur-offres)
    f.poser = (o) => { offre = o; };
    return f;
  };
  const offres = (f) => f.j.vinted.filter((x) => /\/transactions\/777\/offers$/.test(String(x.chemin || x.url || x.path || '')) && String(x.methode || x.method || '').toUpperCase() === 'POST');
  const prixDe = (x) => { try { const b = typeof x.corps === 'string' ? JSON.parse(x.corps) : (x.corps || x.body || {}); return Number(b.offer && b.offer.price); } catch (_) { return NaN; } };
  try {
    const f0 = monde(false);
    await f0.ctx.autoAccepterOffresUnPassage('111', 'v'); await f0.ctx.autoAccepterOffresUnPassage('111', 'v');
    dit(f0.j.vinted.filter((x) => String(x.methode || x.method || '').toUpperCase() !== 'GET').length === 0, 'moteur : paliers ÉTEINTS ⇒ aucune requête d’écriture');
    const f = monde(true);
    // Une offre vue pour la PREMIÈRE fois est « prévue » (délai aléatoire), puis traitée au passage suivant : deux passages.
    const deux = async (x) => { await x.ctx.autoAccepterOffresUnPassage('111', 'v'); await x.ctx.autoAccepterOffresUnPassage('111', 'v'); };
    await deux(f);
    let o = offres(f);
    dit(o.length === 1 && prixDe(o[0]) === 93, 'moteur : offre de 70 € ⇒ contre-offre au palier 1 (93 €)', JSON.stringify(o.map(prixDe)) + ' ' + JSON.stringify(f.j.vinted.slice(-3)));
    await deux(f);
    dit(offres(f).length === 1, 'moteur : la même offre ne reçoit jamais une seconde contre-offre');
    f.poser({ conv: '9001', prix: 75, tx: '777', oid: '902', item: '4242', pseudo: 'acheteuse', article: 'Paire' });
    await deux(f);
    f.poser({ conv: '9001', prix: 78, tx: '777', oid: '903', item: '4242', pseudo: 'acheteuse', article: 'Paire' });
    await deux(f);
    f.poser({ conv: '9001', prix: 80, tx: '777', oid: '904', item: '4242', pseudo: 'acheteuse', article: 'Paire' });
    await deux(f);
    o = offres(f);
    dit(o.map(prixDe).join(',') === '93,88,85', 'moteur : nouvelle offre ⇒ palier suivant (88), puis le plancher (85), puis plus rien', JSON.stringify(o.map(prixDe)));
    dit(o.every((x) => prixDe(x) >= 85), 'moteur : jamais une contre-offre sous le plancher (85 €)');
    const jr = Object.keys(f.lignes).filter((k) => /^journal_vrm_111_/.test(k)).flatMap((k) => f.lignes[k].e || []);
    dit(jr.filter((x) => x.s === 'contre_offre').length === 3, 'moteur : chaque contre-offre est au journal « Ce que VRM a fait »', JSON.stringify(jr));
    const g = monde(true, { vrmActions: { 111: Array.from({ length: 50 }, (_, i) => T0 - i * 1000) } });
    await deux(g);
    dit(offres(g).length === 0, 'moteur : 50 actions dans l’heure ⇒ la garde arrête la contre-offre, rien ne part');
    // 5.410.4 — messages PAR ÉTAPE ({price}) et « rester flexible » exécutés.
    const replies = (x) => x.j.vinted.filter((r) => /\/conversations\/9001\/replies$/.test(String(r.chemin || r.url || r.path || ''))).map((r) => { try { const b = typeof r.corps === 'string' ? JSON.parse(r.corps) : (r.corps || r.body || {}); return String(b.body || (b.reply && b.reply.body) || JSON.stringify(b)); } catch (_) { return ''; } });
    const h = monde(true, {}, { msgContre: ['Je peux faire {price}'], msgFinale: ['Dernier prix : {price}'] });
    await deux(h);
    h.poser({ conv: '9001', prix: 75, tx: '777', oid: '902', item: '4242', pseudo: 'acheteuse', article: 'Paire' }); await deux(h);
    h.poser({ conv: '9001', prix: 78, tx: '777', oid: '903', item: '4242', pseudo: 'acheteuse', article: 'Paire' }); await deux(h);
    const rp = replies(h);
    dit(rp.length === 3 && /93 €/.test(rp[0]) && /Je peux faire/.test(rp[0]) && /Dernier prix : 85 €/.test(rp[2]), 'moteur : message de contre-offre puis message de l’offre FINALE, {price} rempli', JSON.stringify(rp));
    const k = monde(true, {}, { flexible: { actif: true, ecart: 2 }, msgAccepte: ['Ok pour {price} !'] });
    k.poser({ conv: '9001', prix: 92, tx: '777', oid: '909', item: '4242', pseudo: 'acheteuse', article: 'Paire' });
    await deux(k);
    const acc9 = k.j.vinted.filter((r) => /offer_requests\/909\/accept$/.test(String(r.chemin || r.url || r.path || '')));
    dit(acc9.length === 1 && offres(k).length === 0, '« rester flexible » : 92 € pour un palier à 93 € ⇒ ACCEPTÉE, aucune contre-offre', JSON.stringify(k.j.vinted.slice(-4)));
    dit(replies(k).some((t) => /Ok pour 92/.test(t)), 'message d’acceptation envoyé, {price} = le prix accepté', JSON.stringify(replies(k)));
    const k2 = monde(true, {}, { flexible: { actif: true, ecart: 2 } });
    k2.poser({ conv: '9001', prix: 84, tx: '777', oid: '908', item: '4242', pseudo: 'acheteuse', article: 'Paire' });
    await deux(k2);
    dit(k2.j.vinted.filter((r) => /\/accept$/.test(String(r.chemin || r.url || r.path || ''))).length === 0, '« rester flexible » : jamais une acceptation sous le plancher (84 < 85)');
  } catch (e) { dit(false, 'moteur — exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-negociation-paliers : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
