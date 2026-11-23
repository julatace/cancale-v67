// ════════════════════════════════════════════════════════════════════════════
//  « DEPUIS TA DERNIÈRE VISITE » (19 nov., ext. 5.409)
//  1. Le VRAI background.js (scripts/_fond-vm.cjs) : une lecture RANGÉE de ventes passe par `annoncerCapte` ;
//     la première lecture est le point de départ (rien n'est journalisé), une vente NOUVELLE (identité inconnue,
//     née après) est écrite dans la ligne `capte_journal_{navigateur}` — identité seule, aucune donnée de plus ;
//     la même vente relue n'est pas redite ; un refus de Vinted (carnet « pause ») entre comme `refus`.
//  2. Les règles de l'app (src/capteNotif/arrivee.js) : fusion de deux Chrome PAR IDENTITÉ (sans doublon), ce qui
//     est né après le marqueur seulement, marqueur = le plus récent (ici ou synchronisé), premier passage ⇒ rien,
//     compte retiré ⇒ rien, chaque ligne mène à SON élément par identité.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE. `--src <ancien background.js>` : l'arbre d'avant.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const RACINE = path.join(__dirname, '..');
const BG0 = cheminSource(), REGLE0 = path.join(RACINE, 'src', 'capteNotif', 'arrivee.js');
const MUTATIONS = {
  journal: ["if (nouveaux.length) sansRejet(journalCapte(", "if (false) sansRejet(journalCapte("],
  doublon: ["if (!a || e.t < a.t) m.set(k, e);", "m.set(k + Math.random(), e);"],
  marqueur: ["return entrees.filter((e) => e.t > Number(vu)", "return entrees.filter((e) => e.t > 0"],
  lien: ["if (p === 'vinted') return DESTINATIONS.vente({ tx });", "if (p === 'vinted') return DESTINATIONS.vente({});"],
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
let BG = BG0, REGLE = REGLE0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  const cible = mut === 'journal' ? BG0 : REGLE0;
  const s = fs.readFileSync(cible, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  const copie = path.join(path.dirname(cible), `.mut-${mut}-${process.pid}${path.extname(cible)}`);
  fs.writeFileSync(copie, s.replace(a, b));
  process.on('exit', () => { try { fs.unlinkSync(copie); } catch (_) {} });
  if (mut === 'journal') BG = copie; else REGLE = copie;
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };

(async () => {
  // 1. Le vrai fond.
  try {
    const f = faireFond({ src: BG });
    const C = f.ctx;
    const t0 = Date.now();
    const vente = (tx, t) => ({ transaction_id: tx, date: new Date(t).toISOString() });
    await C.annoncerCapte('vinted', '111', 'ventes', [{ id: '9001', t: t0 - 86400000 }]);
    await new Promise((r) => setTimeout(r, 30));
    const ligne = () => { const k = Object.keys(f.lignes).find((x) => /^capte_journal_[0-9a-f]{16}$/.test(x)); return k ? f.lignes[k] : null; };
    dit(!ligne() || !(ligne().e || []).length, 'fond : la première lecture est le point de départ — rien n’est journalisé');
    await C.annoncerCapte('vinted', '111', 'ventes', [{ id: '9001', t: t0 - 86400000 }, { id: '9002', t: t0 }]);
    for (let i = 0; i < 20 && !(ligne() && (ligne().e || []).length); i++) await new Promise((r) => setTimeout(r, 20));
    const l = ligne();
    const e = l && Array.isArray(l.e) ? l.e : [];
    dit(e.length === 1 && e[0].id === '9002' && e[0].s === 'ventes' && e[0].p === 'vinted' && e[0].c === '111', 'fond : la vente NOUVELLE (identité inconnue, née après) est écrite dans capte_journal_{navigateur}', JSON.stringify(e));
    dit(e.every((x) => Object.keys(x).every((k) => ['p', 'c', 's', 'id', 't', 'q'].includes(k))), 'fond : une entrée ne porte que site, compte, sorte, identité, heure — jamais un titre, un texte ou un montant', JSON.stringify(e));
    await C.annoncerCapte('vinted', '111', 'ventes', [{ id: '9002', t: t0 }]);
    await new Promise((r) => setTimeout(r, 40));
    dit((ligne().e || []).length === 1, 'fond : la même vente relue n’est pas redite');
    await C.noterCarnet('111', 'pause');
    for (let i = 0; i < 20 && !(ligne().e || []).some((x) => x.s === 'refus'); i++) await new Promise((r) => setTimeout(r, 20));
    dit((ligne().e || []).some((x) => x.s === 'refus' && x.q === 'pause'), 'fond : une pause posée par Vinted entre comme « refus »', JSON.stringify(ligne().e));
    void vente;
  } catch (e) { dit(false, 'fond — exception', e && e.stack); }

  // 2. Les règles de l'app.
  try {
    const R = await import(pathToFileURL(REGLE).href);
    const T = 1.8e12;
    const rows = [
      { id: 'capte_journal_aaaaaaaaaaaaaaaa', e: [{ p: 'vinted', c: '111', s: 'ventes', id: '9002', t: T + 1000 }, { p: 'vinted', c: '111', s: 'codes', id: '9003:AB12', t: T + 2000 }, { p: 'vinted', c: '111', s: 'ventes', id: '8000', t: T - 1000 }] },
      { id: 'capte_journal_bbbbbbbbbbbbbbbb', e: [{ p: 'vinted', c: '111', s: 'ventes', id: '9002', t: T + 1500 }, { p: 'vinted', c: '222', s: 'messages', id: '7001@2026', t: T + 3000 }, { p: 'vinted', c: '111', s: 'ventes', id: 'x y', t: T + 1 }] },
    ];
    const toutes = R.fusionner(rows);
    dit(toutes.length === 4 && toutes.filter((x) => x.id === '9002').length === 1, 'app : deux Chrome qui ont rangé la même vente ⇒ une seule ligne (par identité) ; une identité mal formée est écartée', JSON.stringify(toutes));
    dit(R.fusionner(null) === null, 'app : lecture ratée ⇒ « pas su » (null), jamais une liste vide');
    const neuves = R.depuis(toutes, T);
    dit(neuves.length === 3 && !neuves.some((x) => x.id === '8000'), 'app : seulement ce qui est né après le marqueur « vu »', JSON.stringify(neuves));
    dit(R.depuis(toutes, null).length === 0, 'app : sans marqueur (premier passage) ⇒ rien');
    dit(R.depuis(toutes, T, { comptesExclus: new Set(['vinted:222']) }).every((x) => x.c !== '222'), 'app : un compte retiré n’est jamais dit');
    dit(R.marqueur(T, { at: T + 5 }) === T + 5 && R.marqueur(T + 9, { at: T }) === T + 9 && R.marqueur(null, null) === null, 'app : le marqueur est le plus récent (cet appareil ou synchronisé)');
    const g = R.groupes(neuves);
    dit(g.map((x) => x.s).join(',') === 'ventes,codes,messages', 'app : un groupe par sorte, ordre fixe', JSON.stringify(g.map((x) => x.s)));
    const v = neuves.find((x) => x.id === '9002'), c = neuves.find((x) => x.s === 'codes'), m = neuves.find((x) => x.s === 'messages');
    dit(/cible=vente&tx=9002/.test(R.lienDe(v)) && /tab=achats.*cible=retrait&tx=9003/.test(R.lienDe(c)) && /cible=conv&conv=7001/.test(R.lienDe(m)) && /compte=222/.test(R.lienDe(m)), 'app : chaque ligne mène à SON élément, par identité (vente, code de retrait, conversation)', [R.lienDe(v), R.lienDe(c), R.lienDe(m)].join(' | '));
    dit(R.vuJusqua(neuves, 0) === T + 3000, 'app : « C’est vu » pose l’entrée la plus récente montrée (jamais « maintenant »)');
  } catch (e) { dit(false, 'règles — exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-arrivee-capte : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
