// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « APPAREILS CONNECTÉS », REGROUPÉS (11 nov., lot connexions-oauth)
//  Julien : 8 lignes dont 5 « Mac · Chrome », un « Déconnecter » par ligne.
//   G1  un groupe par appareil + navigateur, N connexions, la dernière activité ;
//   G2  le groupe de CET appareil en tête ; les autres du plus récent au plus vieux ;
//   G3  > 30 jours sans activité ⇒ « ancienne », à part (jamais celle d'ici) ;
//       date illisible ⇒ jamais ancienne ;
//   G4  « Déconnecter les autres appareils » = `/logout?scope=others` (Supabase),
//       trois états ; l'écran n'affiche le détail par connexion qu'en dépliant ;
//   A1  l'alerte « nouvel appareil » : une fois par appareil + navigateur, pas au
//       renouvellement ni à une 2e connexion du même navigateur.
//  `--arbre <dossier>` : un autre arbre (preuve sur le code d'avant).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const i = process.argv.indexOf('--arbre');
const RACINE = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 500) : ''}`); };
const lire = (p) => { try { return fs.readFileSync(path.join(RACINE, p), 'utf8'); } catch (_) { return ''; } };

(async () => {
  let G = null, S = null, N = null;
  try { G = await import(path.join(RACINE, 'src', 'appareilsGroupes.js')); } catch (_) {}
  try { S = await import(path.join(RACINE, 'src', 'securiteCompte.js')); } catch (_) {}
  try { N = await import(path.join(RACINE, 'api', '_lib', 'appareil-nouveau.js')); } catch (_) {}
  dit(!!G && typeof G.grouperAppareils === 'function', 'G0 · la règle de regroupement existe (src/appareilsGroupes.js)');
  const M = Date.parse('2026-11-11T12:00:00Z'), il = (min) => new Date(M - min * 60000).toISOString();
  // La capture de Julien : 5 Mac · Chrome, Firefox, Edge, iPhone · Safari (+ une vieille).
  const L = [
    { id: 'a', appareil: 'Mac · Chrome', actifLe: il(2), ici: true }, { id: 'b', appareil: 'Mac · Chrome', actifLe: il(3) },
    { id: 'c', appareil: 'Mac · Chrome', actifLe: il(60) }, { id: 'd', appareil: 'Mac · Chrome', actifLe: il(65) }, { id: 'e', appareil: 'Mac · Chrome', actifLe: il(70) },
    { id: 'f', appareil: 'Mac · Firefox', actifLe: il(300) }, { id: 'g', appareil: 'Mac · Edge', actifLe: il(10) }, { id: 'h', appareil: 'iPhone · Safari', actifLe: il(120) },
    { id: 'v', appareil: 'Windows · Chrome', actifLe: il(60 * 24 * 40) }, { id: 'x', appareil: 'Mac · Chrome', actifLe: 'pas une date' },
  ];
  if (G && G.grouperAppareils) {
    const r = G.grouperAppareils(L, M);
    dit(r.ici && r.ici.appareil === 'Mac · Chrome' && r.ici.n === 6 && r.ici.sessions[0].id === 'a' && r.ici.actifLe === il(2), 'G1/G2 « Mac · Chrome » : UN groupe, 6 connexions, cet appareil en tête, dernière il y a 2 min', JSON.stringify(r.ici && { n: r.ici.n, a: r.ici.actifLe, s0: r.ici.sessions[0].id }));
    dit(r.autres.map((x) => x.appareil).join('|') === 'Mac · Edge|iPhone · Safari|Mac · Firefox', 'G2 les autres : un groupe chacun, du plus récent au plus vieux', JSON.stringify(r.autres.map((x) => x.appareil)));
    dit(r.anciennes.length === 1 && r.anciennes[0].id === 'v', 'G3 inactive > 30 jours : ancienne, à part', JSON.stringify(r.anciennes));
    dit(r.ici.sessions.some((s) => s.id === 'x'), 'G3 date illisible : jamais « ancienne » (pas su ≠ vieux)');
    const seul = G.grouperAppareils([{ id: 'z', appareil: 'Mac · Chrome', actifLe: il(60 * 24 * 90), ici: true }], M);
    dit(seul.ici && seul.anciennes.length === 0, 'G3 la connexion d’ici n’est jamais « ancienne »');
    dit(G.nConnexions(1) === '1 connexion' && G.nConnexions(5) === '5 connexions', 'G1 « 1 connexion » / « 5 connexions »');
  }
  dit(!!S && typeof S.deconnecterAutres === 'function', 'G4 · « Déconnecter les autres appareils » existe (src/securiteCompte.js)');
  if (S && S.deconnecterAutres) {
    let vu = '';
    const f = (st) => async (u) => { vu = u; if (st === 'x') throw new TypeError('Failed to fetch'); return { status: st }; };
    const a = await S.deconnecterAutres({ fetch: f(204), url: 'https://b', apikey: 'k', jeton: 'j' });
    dit(a === 'ok' && /\/auth\/v1\/logout\?scope=others$/.test(vu), 'G4 un seul appel : /logout?scope=others (Supabase garde la session d’ici)', vu);
    dit(await S.deconnecterAutres({ fetch: f(401), url: 'u', apikey: 'k', jeton: 'j' }) === 'refuse' && await S.deconnecterAutres({ fetch: f(500), url: 'u', apikey: 'k', jeton: 'j' }) === 'injoignable' && await S.deconnecterAutres({ fetch: f('x'), url: 'u', apikey: 'k', jeton: 'j' }) === 'injoignable', 'G4 trois états : refusé, injoignable (une panne ne fait croire à rien)');
  }
  const REG = lire('src/ecrans/Reglages.jsx');
  const comp = (/function AppareilsConnectes\(\) \{[\s\S]*?\n\}\n/.exec(REG) || [''])[0];
  dit(/grouperAppareils\(/.test(comp) && /\{ouvert\(grp\.appareil\) && detail\(grp\)\}/.test(comp) && /data-deconnexion-autres/.test(comp), 'G4 l’écran : groupes, détail par connexion SEULEMENT déplié, un bouton pour les autres');
  dit(/askConfirm\(\{ title: 'Déconnecter les autres appareils \?'/.test(REG), 'G4 « Déconnecter les autres appareils » est confirmé');
  if (N && N.nouveauxAppareils) {
    const s = (id, ua) => ({ id, user_agent: ua });
    const CH = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
    const reg = { v: 1, rev: 3, signatures: { 'Mac · Chrome': '2026-11-01T00:00:00Z' } };
    const u1 = '11111111-1111-4111-8111-111111111111', u2 = '22222222-2222-4222-8222-222222222222';
    const r1 = N.nouveauxAppareils([s(u1, CH), s(u2, CH)], reg, M);
    dit(r1.nouveaux.length === 0, 'A1 une 2e connexion du même Mac · Chrome (ou un renouvellement) : aucune alerte', JSON.stringify(r1.nouveaux));
    const ED = CH.replace('Safari/537.36', 'Safari/537.36 Edg/157.0.0.0');
    const r2 = N.nouveauxAppareils([s(u1, CH), s(u2, ED)], reg, M);
    dit(r2.nouveaux.length === 1 && r2.nouveaux[0].signature === 'Mac · Edge' && N.nouveauxAppareils([s(u1, CH), s(u2, ED)], r2.registre, M).nouveaux.length === 0, 'A1 un vrai nouveau navigateur : UNE alerte, puis plus jamais', JSON.stringify(r2.nouveaux));
    dit(N.texteAlerte('Mac · Edge').body === "Edge sur Mac. Ce n'est pas toi ?", 'A1 le texte : « Edge sur Mac. Ce n’est pas toi ? »');
  } else dit(false, 'A1 la règle de l’alerte se charge (api/_lib/appareil-nouveau.js)');
  console.log(`\n${ko ? '❌' : '✅'} audit-appareils-groupes : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
