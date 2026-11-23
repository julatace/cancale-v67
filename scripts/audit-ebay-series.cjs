// ════════════════════════════════════════════════════════════════════════════
//  eBAY EN SÉRIE (23 nov.) — la règle de l'écran `src/ebaySeries.js`
//        node scripts/audit-ebay-series.cjs [--src dossier] [--mutation=nom]
//
//  Julien : « fais pareil pour eBay » (Vinted : choisir plusieurs paires, une confirmation, un à un). Ce qui doit
//  rester vrai :
//   · le prix de chaque offre affiché = celui que la route calcule (`api/_lib/ebay-offre.js`), au centime ;
//   · une annonce non éligible n'est pas proposée ; une offre en cours (48 h) ou un prix pas lu ⇒ pas cochable ;
//   · « pas su » (éligibilité illisible) ⇒ aucune ligne (null), jamais « aucune » ;
//   · les envois partent UN À UN (jamais deux en même temps), « Tout arrêter » coupe avant le suivant, un refus de
//     compte (401, accès, journal illisible) arrête la série sans rien appeler de plus ;
//   · l'écran envoie le PRIX VU avec chaque offre (à l'unité et en série).
//  Mutations : `parallele` (les envois partent ensemble), `arret` (un refus de compte n'arrête plus), `encours`
//  (une offre en cours redevient cochable).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const iSrc = process.argv.indexOf('--src');
let RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 200)); } };

if (MUT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'series-mut-'));
  fs.cpSync(path.join(RACINE, 'api'), path.join(tmp, 'api'), { recursive: true });
  fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const remplace = (f, a, b) => { const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + a); process.exit(2); } fs.writeFileSync(p, s.replace(a, b)); };
  if (MUT === 'parallele') remplace('src/ebaySeries.js', "    let r;\n    try { r = await faire(l); }", "    let r;\n    try { r = await Promise.race([faire(l), Promise.resolve({ code: 200, j: { ok: true } })]); }");
  if (MUT === 'arret') remplace('src/ebaySeries.js', "if (arreteLaSerie(r)) stop", "if (false) stop");
  if (MUT === 'encours') remplace('src/ebaySeries.js', "etat: e ? 'en-cours' :", "etat: false ? 'en-cours' :");
  RACINE = tmp;
}

(async () => {
  let S, O;
  await essaie('chargement', async () => {
    S = await import('file://' + path.join(RACINE, 'src', 'ebaySeries.js'));
    O = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay-offre.js'));
  });
  if (!S || !O) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }

  await essaie('A. même formule que la route', async () => {
    const faux = [];
    for (let c = 100; c <= 50000; c += 37) for (let r = 5; r <= 50; r++) if (S.prixOffreCents(c, r) !== O.prixOffreCents(c, r)) faux.push(c + '/' + r);
    dit(faux.length === 0, 'le prix de l’offre affiché = celui de la route, au centime (1,00 € → 500,00 €, remises 5 → 50 %)', faux.slice(0, 5).join(' '));
  });

  const items = [
    { itemId: '120000000001', _compte: '', title: 'Paire A', price: '80' },
    { itemId: '120000000002', _compte: '', title: 'Paire B', price: '50.5' },
    { itemId: '120000000003', _compte: 'pro', title: 'Paire C', price: '' },
    { itemId: '120000000004', _compte: '', title: 'Paire D (pas éligible)', price: '40' },
  ];
  const eligibles = { ids: new Set(['120000000001', '120000000002', '120000000003']), enCours: { '120000000002': { jusqua: '2026-11-25T10:00:00.000Z' } } };
  await essaie('B. lignes', async () => {
    const L = S.lignesOffres({ items, eligibles, numeroDe: (it) => (it.itemId === '120000000001' ? '41' : ''), achatDe: (n) => (n === '41' ? 75 : null) });
    const par = Object.fromEntries((L || []).map((l) => [l.itemId, l]));
    dit(L && L.length === 3 && !par['120000000004'], 'une annonce que eBay ne dit pas éligible n’est pas proposée', JSON.stringify((L || []).map((l) => l.itemId)));
    dit(par['120000000001'] && par['120000000001'].etat === 'prete' && par['120000000001'].prixCents === 8000 && par['120000000001'].achatCents === 7500, 'éligible, prix lu ⇒ « prête », prix et achat en centimes', JSON.stringify(par['120000000001']));
    dit(par['120000000002'] && par['120000000002'].etat === 'en-cours' && par['120000000002'].jusqua, 'une offre qui court encore (48 h) ⇒ « en-cours », pas cochable, la date dite', JSON.stringify(par['120000000002']));
    dit(par['120000000003'] && par['120000000003'].etat === 'prix-pas-lu', 'prix pas lu ⇒ « prix-pas-lu » (jamais une offre sur un prix inconnu)', JSON.stringify(par['120000000003']));
    dit(S.lignesOffres({ items, eligibles: null }) === null, 'éligibilité pas sue ⇒ null (« pas su »), jamais une liste vide');
    const o = S.offreDe(par['120000000001'], 10);
    dit(o.offreCents === 7200 && o.sousAchat === true, '−10 % sur 80 € = 72,00 €, sous son prix d’achat (75 €) : dit', JSON.stringify(o));
    dit(S.offreDe(par['120000000001'], 4).offreCents === null && S.offreDe(par['120000000001'], 51).offreCents === null, 'remise hors 5–50 % ⇒ aucun prix (le bouton se tait)');
  });

  const lignes = [{ cle: 'a' }, { cle: 'b' }, { cle: 'c' }];
  await essaie('C. un à un', async () => {
    let enVol = 0, max = 0; const ordre = [];
    const faire = (l) => new Promise((res) => { enVol++; max = Math.max(max, enVol); ordre.push(l.cle); setTimeout(() => { enVol--; res({ code: 200, j: { ok: true, envoyees: 2 } }); }, 15); });
    const iss = await S.enSerie(lignes, faire);
    dit(max === 1 && ordre.join('') === 'abc' && Object.values(iss).every((i) => i.etat === 'fait'), 'les envois partent un à un, dans l’ordre, jamais deux en même temps', `max ${max} · ${ordre.join('')}`);
  });
  await essaie('D. tout arrêter', async () => {
    let n = 0; let stop = false;
    const iss = await S.enSerie(lignes, async () => { n++; stop = true; return { code: 200, j: { ok: true } }; }, { arret: () => stop });
    dit(n === 1 && iss.b.etat === 'pas-envoye' && iss.c.etat === 'pas-envoye', '« Tout arrêter » coupe avant l’annonce suivante (rien d’autre ne part)', JSON.stringify(iss));
  });
  await essaie('E. refus de compte', async () => {
    let n = 0;
    const iss = await S.enSerie(lignes, async () => { n++; return { code: 503, j: { ok: false, reason: 'journal-pas-su', error: 'journal illisible' } }; });
    dit(n === 1 && iss.a.etat === 'refuse' && iss.b.etat === 'pas-envoye', 'un refus qui vaut pour tout le compte (journal illisible, 401, accès) arrête la série', JSON.stringify(iss));
    let m = 0;
    const iss2 = await S.enSerie(lignes, async () => { m++; return { code: 409, j: { ok: false, reason: 'prix-change', error: 'prix changé' } }; });
    dit(m === 3 && Object.values(iss2).every((i) => i.etat === 'refuse'), 'un refus propre à une annonce (prix changé) n’arrête pas les autres', String(m));
  });
  await essaie('F. incertain', async () => {
    const iss = await S.enSerie([{ cle: 'a' }], async () => { throw new Error('reseau'); });
    const iss2 = await S.enSerie([{ cle: 'a' }], async () => ({ code: 504, j: { ok: false, reason: 'incertain' } }));
    dit(iss.a.etat === 'incertain' && iss2.a.etat === 'incertain', 'réseau coupé / 504 ⇒ « incertain », jamais « fait » ni « refusé »', JSON.stringify([iss, iss2]));
  });
  await essaie('G. l’écran envoie le prix vu', async () => {
    const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\/\/[^\n]*/g, '');
    const carte = lire('src/ecrans/Ebay.jsx'), serie = lire('src/ebay/SeriesEbay.jsx');
    dit(/action: 'offre'[^}]*prixVu:/.test(carte), 'l’offre à l’unité (fiche de l’annonce) porte `prixVu`');
    dit(/action: 'offre'[^}]*prixVu:/.test(serie), 'l’offre en série porte `prixVu` (le prix de la ligne)');
    dit(/confirmer\(\{ title: tr\('ebaySeries\.offres\.confTitre'/.test(serie) && /confirmer\(\{ title: tr\('ebaySeries\.relance\.confTitre'/.test(serie), 'chaque série passe par UNE confirmation avant le premier envoi');
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
