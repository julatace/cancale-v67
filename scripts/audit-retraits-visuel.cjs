#!/usr/bin/env node
// AUDIT (20 nov.) — la vue des colis à retirer (src/retraitsVue.js) : tri par urgence, résumé, compte à rebours,
// itinéraire. Données INVENTÉES. `--mutation` : chaque règle réaffaiblie doit rendre ROUGE.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const MUTATIONS = {
  'rebours-demain-neutre': ['src/retraitsVue.js', "if (j === 1) return { cle: 'demain', n: 1, heure, ambre: true };", "if (j === 1) return { cle: 'demain', n: 1, heure, ambre: false };"],
  'tri-ignore-limite': ['src/retraitsVue.js', 'return l ? l.jours : (Number.isFinite(p.triPoint)', 'return 0 && l ? l.jours : (Number.isFinite(p.triPoint)'],
  'resume-compte-a-verifier': ['src/retraitsVue.js', "const l = (p.arrives || []).filter((x) => x && !x.aVerifier && !x.horsCompte);", 'const l = (p.arrives || []).filter(Boolean);'],
  'itineraire-invente': ['src/retraitsVue.js', "const cible = r || (p.adresse ? adr : '');", "const cible = r || adr;"],
};
if (process.argv.includes('--mutation')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-rv-'));
    fs.cpSync(path.join(R, 'src'), path.join(t, 'src'), { recursive: true }); fs.cpSync(path.join(R, 'package.json'), path.join(t, 'package.json'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const tombe = r.status !== 0; if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? 'rouge' : 'VERTE'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} non attrapée(s)`); process.exit(ok === n ? 0 : 1);
}
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
(async () => {
  const V = await import('file://' + path.join(R, 'src/retraitsVue.js'));
  const c = (j, h) => V.compteARebours({ jours: j, heure: h });
  dit(c(1, '10 h').cle === 'demain' && c(1).ambre && c(1, '10 h').heure === '10 h', 'demain ⇒ « demain · 10 h », ambre');
  dit(c(4).cle === 'dans' && c(4).n === 4 && !c(4).ambre, 'dans 4 j ⇒ neutre');
  dit(c(0).cle === 'aujourdhui' && c(-2).cle === 'depasse' && c(-2).ambre, 'aujourd’hui et dépassé ⇒ ambre');
  dit(V.compteARebours(null) === null, 'limite pas lue ⇒ rien (jamais une date inventée)');
  const pts = [
    { nom: 'B', arrives: [{ jours: 5 }, { jours: 6 }] },
    { nom: 'A', arrives: [{ jours: 1 }] },
    { nom: 'C', arrives: [{ aVerifier: true, jours: 0 }, { jours: 3 }] },
  ];
  dit(V.trierPoints(pts).map((p) => p.nom).join('') === 'ACB', 'le plus urgent d’abord (limite lue la plus proche ; un « à vérifier » ne compte pas)', V.trierPoints(pts).map((p) => p.nom).join(''));
  const r = V.resumeRetraits(pts);
  dit(r.colis === 4 && r.points === 3 && r.urgents === 1, 'résumé : 4 colis comptés, 3 points, 1 avant demain', JSON.stringify(r));
  dit(/maps\.apple\.com\/\?daddr=48\.1%2C-1\.6/.test(V.lienItineraire({ repere: { lat: 48.1, lon: -1.6 }, adresse: 'x' }, { apple: true })), 'itinéraire : le repère sûr d’abord (Plans sur Apple)');
  dit(/google\.com\/maps\/dir\/\?api=1&destination=/.test(V.lienItineraire({ nom: 'Tabac', adresse: '3 Rue X, 22100 Dinan' })), 'itinéraire : l’adresse écrite sinon (Google Maps)');
  dit(V.lienItineraire({ nom: 'Tabac' }) === '', 'ni repère ni adresse ⇒ pas de lien (jamais un nom seul cherché)');
  dit(V.heureLimite('2026-11-21T09:00:00.000Z') === '10 h' && V.heureLimite('2026-11-21T00:00:00+01:00') === '', 'heure de la limite (Paris) ; minuit pile = une date sans heure');
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ tout est vert'); process.exit(ko ? 1 : 0);
})();
