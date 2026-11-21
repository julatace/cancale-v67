#!/usr/bin/env node
// ── audit-recherche-exacte — LA RECHERCHE UNIVERSELLE, lot AX (10 novembre) ─────
// Exécute la VRAIE règle (src/rechercheUnique.js) sur des données INVENTÉES (le dépôt
// est public), à la forme lue par l'app, et lit le branchement dans src/App.jsx.
// Ce qu'il exige (Julien, lot AX) :
//   · une correspondance EXACTE d'identité — N° (« 007 » = « 7 », « B125 » ≠ « 125 »),
//     n° de suivi (normalisé : espaces, casse), code de retrait, n° de transaction —
//     passe EN TÊTE (`exactes`) et sort de son groupe (jamais deux fois) ;
//   · le TITRE n'est jamais une identité : 50 paires au même titre = 50 lignes,
//     aucune « exacte » ; une paire dont le titre CONTIENT un n° de suivi n'est pas
//     la correspondance exacte de ce suivi ; un pseudo, un montant non plus ;
//   · groupes Paires · Ventes · Achats · Colis · Retraits (un colis qui VIENT chez
//     lui est un retrait, un colis envoyé est un colis) ;
//   · une source pas lue (null) est DITE (« Achats pas encore lus ») ; une liste
//     lue et vide n'est pas « pas lue » ;
//   · l'app : la tête rendue (`data-recherche-exacte`), le « pas lu » rendu, une
//     lecture ratée de la loupe rend `null` (jamais `[]`), aucune lecture ni écriture
//     nouvelle dans le panneau (tout se cherche en mémoire).
//   node scripts/audit-recherche-exacte.cjs [--mutation=NOM | --prouve]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'rechercheUnique.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

// [fichier, ancre, remplacement]
const MUTATIONS = {
  // L'IDENTITÉ PAR TITRE : une ligne trouvée par son titre compterait comme exacte.
  'identite-par-titre': ['src', "export const estIdentiteExacte = (r) => !!(r && r.exact === true && r.par !== 'titre' && Object.prototype.hasOwnProperty.call(IDENTITES_EXACTES, r.par));",
    "export const estIdentiteExacte = (r) => !!(r && (r.exact === true || r.par === 'titre'));"],
  // Le titre égal à la requête vaudrait « exact » (titre = identité).
  'titre-exact': ['src', "    if (!par && e.t && mots.every((m) => e.t.includes(m))) { par = 'titre'; }",
    "    if (!par && e.t && mots.every((m) => e.t.includes(m))) { par = 'titre'; exact = e.t.replace(/ /g, '').toUpperCase().includes(qa); }\n    if (par === 'titre' && exact) par = 'suivi';"],
  // Le pseudo deviendrait une identité (un acheteur achète plusieurs fois).
  'pseudo-identite': ['src', "export const IDENTITES_EXACTES = { numero: 'son N°',", "export const IDENTITES_EXACTES = { pseudo: 'son pseudo', numero: 'son N°',"],
  // La tête ne sortirait pas la ligne de son groupe (la même ligne deux fois).
  'deux-fois': ['src', 'if (estIdentiteExacte(t)) { exactes.push(t); if (exactesEnTete) continue; }', 'if (estIdentiteExacte(t)) { exactes.push(t); }'],
  // Pas de tête du tout.
  'sans-tete': ['src', 'if (estIdentiteExacte(t)) { exactes.push(t); if (exactesEnTete) continue; }', 'if (false) { }'],
  // Retraits fondus dans Colis.
  'retrait-fondu': ['src', "groupe: str(c.sens) === 'sortant' ? 'colis' : 'retrait',", "groupe: 'colis',"],
  // « pas lu » tu.
  'non-lu-tu': ['src', 'return SOURCES_LUES.filter(([k]) => !Array.isArray(S[k])).map(([k]) => k);', 'return [];'],
  // Une liste lue et VIDE prise pour « pas lue ».
  'vide-pas-lu': ['src', 'return SOURCES_LUES.filter(([k]) => !Array.isArray(S[k])).map(([k]) => k);', 'return SOURCES_LUES.filter(([k]) => !(Array.isArray(S[k]) && S[k].length)).map(([k]) => k);'],
  // Un code de retrait « à peu près » serait exact.
  'code-a-peu-pres': ['src', 'const c = e.codes.find((x) => x === qa); if (c) { par = \'code\'; exact = true; valeur = c; }', 'const c = e.codes.find((x) => x.includes(qa)); if (c) { par = \'code\'; exact = true; valeur = c; }'],
  // Un suivi partiel compterait comme exact.
  'suivi-partiel-exact': ['src', "if (s) { par = 'suivi'; exact = s === qa; valeur = s; }", "if (s) { par = 'suivi'; exact = true; valeur = s; }"],
  // Un suivi recopié par blocs redevient « des mots du titre ».
  'suivi-blocs': ['src', "const blocs = un || (/^[a-z0-9\\s-]+$/i.test(brut) && /\\d/.test(brut));", 'const blocs = un;'],
  // Les actions à N° reviennent sur un code de retrait.
  'app-actions-code': ['app', '.filter(a => !(a.num && kNumQ && !estNumQ));', ';'],
  // L'app ne demande plus la tête.
  'app-sans-tete': ['app', 'chercherPartout(idx, qBrut, { numero: kNumQ, exactesEnTete: true,', 'chercherPartout(idx, qBrut, { numero: kNumQ,'],
  // L'app : une lecture ratée redevient « aucun achat ».
  'app-rate-vide': ['app', 'sold:so?sold:null,bought:po?bought:null,', 'sold,bought,'],
  // L'app : le « pas lu » n'est plus rendu.
  'app-non-lu-tu': ['app', '{nonLues.length > 0 && <div data-recherche-non-lu=', '{false && <div data-recherche-non-lu='],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const sortie = r.stdout || '';
    const rouges = (sortie.match(/^❌/gm) || []).length;
    const ancre = /ancre de mutation introuvable/.test(sortie);
    const attrapee = r.status !== 0 && rouges && !ancre;
    console.log(`${attrapee ? '✅' : '❌'} mutation « ${m} » : ${ancre ? 'ANCRE INTROUVABLE (pas une preuve)' : rouges + ' rouge(s)'}`);
    if (attrapee) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

let n = 0, ko = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✓ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.stack).slice(0, 300)); } };

(async () => {
  if (!fs.existsSync(SRC)) { console.log('❌ src/rechercheUnique.js absent'); process.exit(1); }
  let src = fs.readFileSync(SRC, 'utf8');
  let app = fs.readFileSync(APP, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    const cible = m[0] === 'app' ? app : src;
    if (!cible.includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    if (m[0] === 'app') app = app.replace(m[1], m[2]); else src = src.replace(m[1], m[2]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recherche-exacte-'));
  const f = path.join(dir, 'r.mjs'); fs.writeFileSync(f, src);
  const R = await import(pathToFileURL(f).href);
  const manque = ['estIdentiteExacte', 'IDENTITES_EXACTES', 'GROUPES_LOUPE', 'sourcesNonLues', 'phraseNonLues'].filter((x) => !R[x]);
  if (manque.length) { console.log('❌ la règle ne sait pas encore : ' + manque.join(', ') + ' (lot AX pas fait)'); process.exit(1); }

  // ── Données inventées ──
  const T = 'Nike Dunk Low Panda taille 42';
  const ventes = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 22999990100 + i, title: T, status: 'Commande finalisée', date: new Date(Date.UTC(2026, 10, 1, 10, i)).toISOString(), price: { amount: '80.0' } }));
  ventes.push({ transaction_id: 22314280001, title: 'Adidas Samba OG', status: 'Commande finalisée', date: '2026-11-08T10:00:00Z', price: { amount: '95.0' } });
  const achats = [{ transaction_id: 23705320001, title: 'Salomon XT-6 gris', status: 'Commande expédiée', date: '2026-11-07T10:00:00Z', user_login: 'vendeuse_xt' }];
  const pseudos = ventes.slice(0, 50).map((o, i) => ({ tx: String(o.transaction_id), pseudo: i < 2 ? 'acheteuse_fidele' : 'acheteuse_' + i }));
  const bordereaux = ventes.slice(0, 50).map((o, i) => ({ tx: String(o.transaction_id), suivi: 'XW' + String(300000000 + i) + 'FR' }));
  const colis = [
    { id: 'email_track_a', suivi: 'MR7000123', code: '482913', status: 'available', sens: 'entrant', art: 'Salomon XT-6', carrier: 'mondialrelay', at: '2026-11-09T08:00:00Z' },
    { id: 'email_track_b', suivi: 'MR7000124', code: '482914', status: 'delivered', sens: 'entrant', art: 'Veja', carrier: 'mondialrelay', at: '2026-11-08T08:00:00Z' },
    { id: 'email_track_c', suivi: 'MR55512345', status: 'delivered', sens: 'sortant', art: 'Adidas Samba OG', carrier: 'mondialrelay', at: '2026-11-05T09:00:00Z' },
  ];
  const fiches = {};
  for (let i = 0; i < 50; i++) fiches['p' + (201 + i)] = { numero: String(201 + i), title: T, accountId: '111' };
  fiches.n7 = { numero: '7', title: 'Asics Gel-Kayano 14', accountId: '111' };
  fiches.n17 = { numero: '17', title: 'Asics Gel 1130', accountId: '111' };
  fiches.n70 = { numero: '70', title: 'Puma Speedcat', accountId: '111' };
  fiches.b125 = { numero: 'B125', title: 'New Balance 550 (archive)', accountId: '111' };
  fiches.n125 = { numero: '125', title: 'New Balance 550', accountId: '111' };
  // Une paire dont le TITRE porte le n° de suivi d'une vente : le titre n'en fait pas une identité.
  fiches.piege = { numero: '160', title: 'Lot XW300000007FR à vérifier', accountId: '111' };
  const S = { ventes, achats, pseudos, bordereaux, colis, fiches, annonces: [], messages: [] };
  const idx = R.indexRecherche(S);
  const ch = (q, o = {}) => R.chercherPartout(idx, q, { exactesEnTete: true, max: 500, ...o });
  const cles = (l) => l.map((r) => r.e.cle);
  const partout = (res) => [...res.exactes, ...Object.values(res.groupes).flat()].map((r) => r.e.cle);

  essaie('n° de suivi', () => {
    const r = ch('xw 300 000 007 fr');
    dit(cles(r.exactes).join() === 'vente:22999990107' && r.exactes[0].par === 'suivi', 'n° de suivi tapé avec espaces et minuscules ⇒ SA vente, en tête, « par son n° de suivi »', cles(r.exactes));
    dit(partout(r).filter((c) => c === 'vente:22999990107').length === 1, 'la vente en tête n’est pas répétée dans « Ventes »', partout(r));
    dit(!cles(r.exactes).includes('paire:piege') && cles(r.groupes.paire).includes('paire:piege') && r.groupes.paire.find((x) => x.e.cle === 'paire:piege').par === 'titre', 'la paire dont le TITRE porte ce suivi : trouvée par le titre, jamais « exacte »', { ex: cles(r.exactes), p: cles(r.groupes.paire) });
    const g = R.reconnaitreRequete('xw 300 000 007 fr').genres;
    dit(g.includes('suivi') && !R.reconnaitreRequete('nike dunk low').genres.includes('suivi'), '« Je cherche un n° de suivi » dit aussi pour un suivi recopié par blocs (et pas pour des mots)', g);
    const p = ch('XW30000000');
    dit(!p.exactes.length && p.groupes.vente.length === 10, 'un suivi PARTIEL trouve, mais n’est jamais « exact »', [p.exactes.length, p.groupes.vente.length]);
  });

  essaie('code, transaction, retraits', () => {
    const c = ch('482913');
    dit(cles(c.exactes).join() === 'colis:MR7000123' && c.exactes[0].par === 'code' && R.groupeDe(c.exactes[0].e) === 'retrait', 'code de retrait ⇒ CE colis, en tête, et c’est un retrait', cles(c.exactes));
    dit(!c.groupes.retrait.length, 'pas répété dans « Retraits »', cles(c.groupes.retrait));
    const d = R.destinationResultat(c.exactes[0]);
    dit(d && d.cible && d.cible.type === 'retrait' && d.cible.suivi === 'MR7000123' && d.cible.grand === true, 'il ouvre SA carte, le code en grand', d);
    dit(!ch('4829').exactes.length, '« 4829 » n’est pas le code « 482913 »');
    const t = ch('22999990120');
    dit(cles(t.exactes).join() === 'vente:22999990120' && t.exactes[0].par === 'transaction', 'n° de transaction ⇒ SA vente, en tête', cles(t.exactes));
    const m = ch('MR7000');
    dit(cles(m.groupes.retrait).sort().join() === 'colis:MR7000123,colis:MR7000124' && !m.groupes.colis.length, 'colis qui viennent chez lui ⇒ groupe « Retraits »', { r: cles(m.groupes.retrait), c: cles(m.groupes.colis) });
    const s = ch('mr55512345');
    dit(cles(s.exactes).join() === 'colis:MR55512345' && R.groupeDe(s.exactes[0].e) === 'colis', 'colis envoyé ⇒ groupe « Colis »', cles(s.exactes));
    dit(R.GROUPES_LOUPE.map((g) => g[1]).slice(0, 5).join(' · ') === 'Paires · Ventes · Achats · Colis · Retraits', 'groupes : Paires · Ventes · Achats · Colis · Retraits', R.GROUPES_LOUPE);
  });

  essaie('N°', () => {
    const r = ch('007', { numero: '7' });
    dit(cles(r.exactes).join() === 'paire:n7' && r.exactes[0].par === 'numero', '« 007 » ⇒ le N°7 exact, en tête (pas le 17 ni le 70)', cles(r.exactes));
    const b = ch('B125', { numero: 'B125' });
    dit(cles(b.exactes).join() === 'paire:b125', '« B125 » ⇒ l’archive B125, pas le 125', cles(b.exactes));
    const c = ch('125', { numero: '125' });
    dit(cles(c.exactes).join() === 'paire:n125', '« 125 » ⇒ le 125, pas le B125', cles(c.exactes));
  });

  essaie('le titre n’est jamais une identité', () => {
    const r = ch('nike dunk low panda');
    dit(!r.exactes.length, '50 paires au même titre : AUCUNE « correspondance exacte »', cles(r.exactes));
    dit(r.groupes.paire.length === 50 && new Set(cles(r.groupes.paire)).size === 50 && r.groupes.paire.every((x) => x.par === 'titre'), '50 paires = 50 lignes, chacune « par le titre »', r.groupes.paire.length);
    dit(r.groupes.vente.length === 50 && r.groupes.vente.every((x) => x.par === 'titre'), '50 ventes = 50 lignes, aucune désignée', r.groupes.vente.length);
    const exact = ch(T);
    dit(!exact.exactes.length, 'le titre ENTIER tapé n’est pas une identité non plus', cles(exact.exactes));
    const p = ch('acheteuse_fidele');
    dit(!p.exactes.length && p.groupes.vente.length === 2, 'un pseudo (deux ventes) : trouvé, jamais « exact »', [p.exactes.length, p.groupes.vente.length]);
    dit(!ch('80 €').exactes.length, 'un montant n’est pas une identité');
    for (const par of ['titre', 'pseudo', 'montant']) dit(!R.estIdentiteExacte({ par, exact: true }), `« ${par} » exact n’est pas une identité`);
  });

  essaie('compat', () => {
    const r = R.chercherPartout(idx, '482913');
    dit(r.groupes.retrait.length === 1 && r.exactes.length === 1, 'sans `exactesEnTete` : la ligne reste dans son groupe, `exactes` dit qu’elle est exacte', [r.groupes.retrait.length, r.exactes.length]);
  });

  essaie('pas lu ≠ rien', () => {
    const i1 = R.indexRecherche({ ...S, achats: null });
    dit(i1.nonLues.join() === 'achats', 'achats pas lus ⇒ « achats » nommé', i1.nonLues);
    dit(R.phraseNonLues(i1.nonLues, { enCours: true }) === 'Achats pas encore lus.', '« Achats pas encore lus » pendant la lecture', R.phraseNonLues(i1.nonLues, { enCours: true }));
    dit(/^Achats pas lus/.test(R.phraseNonLues(i1.nonLues)) && /n’a pas répondu/.test(R.phraseNonLues(i1.nonLues)), 'lecture ratée ⇒ « Achats pas lus — la lecture n’a pas répondu »', R.phraseNonLues(i1.nonLues));
    const i2 = R.indexRecherche({ ...S, achats: [] });
    dit(!i2.nonLues.length, 'une liste lue et VIDE n’est pas « pas lue »', i2.nonLues);
    const i3 = R.indexRecherche({});
    dit(['ventes', 'achats', 'colis'].every((k) => i3.nonLues.includes(k)), 'rien de lu ⇒ ventes, achats, colis nommés', i3.nonLues);
    dit(/^Pas encore lus : ventes, achats, colis et retraits/.test(R.phraseNonLues(i3.nonLues, { enCours: true })), 'plusieurs sources : UNE phrase qui les nomme', R.phraseNonLues(i3.nonLues, { enCours: true }));
    dit(R.phraseNonLues([]) === '', 'tout lu ⇒ rien à dire');
  });

  essaie('branchement dans l’app', () => {
    const a = app.indexOf('const panneauRecherche = '), z = app.indexOf('const dicterRecherche = ');
    dit(a > 0 && z > a, 'le panneau de la loupe trouvé');
    const p = app.slice(a, z).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    dit(/chercherPartout\(idx, qBrut, \{[^}]*exactesEnTete: true/.test(p), 'la loupe demande la tête (`exactesEnTete`)');
    dit(/\.filter\(a => !\(a\.num && kNumQ && !estNumQ\)\)/.test(p), 'un code / suivi / transaction exact ne propose pas d’action « N°482913 »');
    dit(/data-recherche-exacte=""/.test(p) && /Correspondance exacte/.test(p) && /IDENTITES_EXACTES/.test(p), 'la tête est rendue et dit PAR QUOI (« Trouvé par son n° de suivi »)');
    dit(/data-recherche-exacte-numero=""/.test(p), 'un N° exact le dit au-dessus de « Tout sur le N° »');
    dit(/\{nonLues\.length > 0 && <div data-recherche-non-lu=/.test(p) && /phraseNonLues\(idx\.nonLues/.test(p), '« … pas encore lus » rendu dans la loupe');
    dit(/GROUPES_LOUPE/.test(p) && !/\['colis','Colis'\],\['message'/.test(p), 'les groupes viennent de la règle (Retraits compris)');
    dit(!/\bfetch\(|lireTout\(|\bsb\(|localStorage\.setItem|\bsave\(/.test(p), 'le panneau ne lit ni n’écrit rien à la frappe (tout en mémoire)');
    dit(/sold:so\?sold:null,bought:po\?bought:null,/.test(app), 'une lecture ratée de la loupe rend `null` (« pas lus »), jamais `[]`');
    dit(/: gsData \? gsData\.sold : null;/.test(p) && /: gsData \? gsData\.bought : null;/.test(p), 'pas encore lu ⇒ `null` passé à la règle (pas `[]`)');
  });

  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
