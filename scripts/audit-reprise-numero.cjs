// La paire REPUBLIÉE garde son numéro (28 oct.). Exécute la vraie règle
// (src/repriseNumero.js) sur la forme mesurée chez Julien (données inventées).
// `--mutation=ambigu|main|vente|enligne` réaffaiblit une garde : rouge attendu.
const path = require('path');
(async () => {
  const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
  const R = await import(path.join(__dirname, '..', 'src', 'repriseNumero.js'));
  let ko = 0; const dit = (ok, m, d) => { if (!ok) ko++; console.log(`${ok ? '  ✅' : '  ❌'} ${m}${d !== undefined ? ' — ' + d : ''}`); };
  const regle = (o) => {
    const r = { ...o };
    if (mut === 'ambigu') { const t = {}; for (const k in r.recrees) t[k] = r.recrees[k]; r.recrees = t; }
    let res = R.repriseNumerosRecreation(r);
    if (mut === 'main') res = R.repriseNumerosRecreation({ ...r, numeros: Object.fromEntries(Object.entries(r.numeros).map(([k, v]) => [k, { ...v, manuelAt: undefined, auto: true }])) });
    if (mut === 'vente') res = R.repriseNumerosRecreation({ ...r, numeroVente: () => false });
    if (mut === 'enligne') res = R.repriseNumerosRecreation({ ...r, enLigneIds: (r.enLigneIds || []).filter((x) => !/^1000/.test(x)) });
    if (mut === 'ambigu') { // une seule remplaçante par ancienne : on « devine » la première
      const vus = {}; for (const k of Object.keys(r.recrees)) if (r.enLigneIds.includes(k)) { const a = r.recrees[k]; if (!vus[a] && r.numeros[a]) { vus[a] = 1; res[k] = res[k] || { ...r.numeros[a], recreeDe: a }; } }
    }
    return res;
  };
  // Table lue dans les lignes de l'extension (forme mesurée le 28 oct.).
  const t = R.tableRecrees([
    { id: 'vinted_brouillon_20000000001', anc: '10000000001', item: '20000000001' },
    { id: 'vinted_brouillon_20000000002', anc: '10000000002', item: null },
    { id: 'vinted_brouillon_20000000009', anc: 'pas-un-id', item: null },
  ], [{ id: 'coffre_31_20000000003', r: '10000000003' }]);
  dit(t['20000000001'] === '10000000001' && t['20000000002'] === '10000000002' && t['20000000003'] === '10000000003' && !t['20000000009'], 'table : brouillon (son id = l\'annonce publiée) et coffre « recreeDe » ; un identifiant illisible ignoré', JSON.stringify(t));
  const base = {
    '10000000001': { numero: '53', auto: true },
    '10000000002': { numero: '2', auto: true },
    '10000000003': { numero: '94', auto: true },
    '20000000001': { numero: '108', auto: true, numberedAt: 'x' },   // renumérotée par erreur
  };
  let r = regle({ enLigneIds: ['20000000001', '20000000002', '20000000003'], numeros: base, recrees: t });
  dit(r['20000000001'] && r['20000000001'].numero === '53' && r['20000000001'].numeroRendu && r['20000000001'].numeroRendu.de === '108', 'la paire renumérotée N°108 retrouve son N°53 (le 108 est dit, reste brûlé)', JSON.stringify(r['20000000001']));
  dit(r['20000000002'] && r['20000000002'].numero === '2' && r['20000000003'] && r['20000000003'].numero === '94', 'une republiée sans numéro prend celui de l\'ancienne', JSON.stringify([r['20000000002'], r['20000000003']].map((x) => x && x.numero)));
  r = regle({ enLigneIds: ['20000000001', '10000000001'], numeros: base, recrees: t });
  dit(!r['20000000001'], 'l\'ancienne encore en ligne : rien n\'est repris', JSON.stringify(r));
  r = regle({ enLigneIds: ['20000000001', '20000000005'], numeros: base, recrees: { ...t, '20000000005': '10000000001' } });
  dit(!r['20000000001'] && !r['20000000005'], 'deux republiées en ligne pour la même ancienne : aucune (on ne devine pas)', JSON.stringify(r));
  r = regle({ enLigneIds: ['20000000001'], numeros: { ...base, '20000000001': { numero: '108', auto: false, manuelAt: 'x' } }, recrees: t });
  dit(!r['20000000001'], 'un numéro posé à la main est gardé', JSON.stringify(r));
  r = regle({ enLigneIds: ['20000000001'], numeros: base, recrees: t, numeroVente: (nid) => nid === '20000000001' });
  dit(!r['20000000001'], 'une vente porte déjà son numéro : on n\'y touche pas', JSON.stringify(r));
  r = regle({ enLigneIds: ['20000000002', '30000000000'], numeros: { ...base, '30000000000': { numero: '2', auto: true } }, recrees: t });
  dit(!r['20000000002'], 'le numéro est déjà sur une autre paire en ligne : jamais deux paires sous un N°', JSON.stringify(r));
  r = regle({ enLigneIds: ['20000000001'], numeros: { ...base, '20000000001': { numero: '53', recreeDe: '10000000001' } }, recrees: t });
  dit(!r['20000000001'], 'déjà reprise : rien ne bouge (converge)', JSON.stringify(r));
  dit(Object.keys(R.repriseNumerosRecreation({ enLigneIds: ['20000000001'], numeros: base, recrees: null })).length === 0, 'table pas sue : rien', '');
  console.log(ko ? `\n❌ reprise du numéro : ${ko} rouge(s)` : '\n✅ reprise du numéro : tout est vert');
  process.exit(ko ? 1 : 0);
})();
