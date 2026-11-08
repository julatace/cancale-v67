// ════════════════════════════════════════════════════════════════════════════
//  LA VILLE DES COLIS À RETIRER — reconnue, jamais devinée (3 nov., 19 h)
//  Julien (3 nov., 18 h 59) : « pour les colis ce n'est pas encore parfait, il ne
//  reconnaît pas les villes, c'est chiant, l'app doit être intelligente ».
//  Ce contrôle EXÉCUTE la règle (src/villeRelais.js, src/relaisColis.js) sur des
//  lieux FABRIQUÉS dans chaque FORME mesurée chez lui (valeurs refaites — le
//  dépôt est public) :
//   A. la clé d'une ville (casse, accents, tirets, St/Saint, CEDEX, arrondissements, pays) ;
//   B. la ville d'un point : lue avec ou sans code postal ; code postal seul ⇒ table
//      officielle (une commune ⇒ son nom, plusieurs ⇒ le code postal seul) ;
//   C. le sélecteur : une ville = un bouton, nombre = colis COMPTÉS ; homonymes de
//      deux départements séparés ;
//   D. le même point déjà connu : repris s'il est UNIQUE, rien pour deux homonymes,
//      un autre transporteur, un autre compte, une autre rue ;
//   E. deux sources du même colis : l'adresse complète gagne (même point seulement) ;
//   F. bout à bout sur les formes mesurées (Vinted Go sans code postal, Mondial
//      Relay nom seul, conversation, « t'attend », Chronopost, sans lieu) ;
//   G. un lieu sans code postal ne rejoint jamais le même nom dans une AUTRE ville ;
//   H. le branchement (App.jsx, CarteRelais.jsx) : une ville choisie ne cache rien.
//  Sur le code d'AVANT (`--racine <arbre>`), la règle vient de l'ancien
//  `villeDuPoint` de CarteRelais.jsx. `--mutation <nom>` réaffaiblit la règle.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv;
const R = argv.includes('--racine') ? path.resolve(argv[argv.indexOf('--racine') + 1]) : path.join(__dirname, '..');
const MUT = argv.includes('--mutation') ? argv[argv.indexOf('--mutation') + 1] : (process.env.VILLES_MUTATION || '');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const J = (x) => JSON.stringify(x);

const MUTATIONS = {
  // deviner la ville d'un code postal à plusieurs communes (la première)
  'cp-devine': ['villeRelais.js', "if (c && c.length === 1 && normVille(c[0]))", "if (c && c.length >= 1 && normVille(c[0]))"],
  // prendre un homonyme (le premier des points du même nom)
  'homonyme': ['villeRelais.js', "if (liste.length !== 1 || !liste[0].cp) return lu;", "if (!liste.length || !liste[0].cp) return lu;"],
  // la ville lue sans code postal jetée (la règle d'avant)
  'ville-sans-cp': ['villeRelais.js', "if (nv) return { cle: nv, nom: ville, cp, dept, source: 'lue' };", "if (nv && cp) return { cle: nv, nom: ville, cp, dept, source: 'lue' };"],
  // le transporteur ne compte plus
  'transporteur': ['villeRelais.js', "if (tr && q.transporteurs.size && !q.transporteurs.has(tr)) return lu;", ""],
  // « St » ≠ « Saint »
  'saint': ['villeRelais.js', "s = s.replace(/\\bst\\b/g, 'saint').replace(/\\bste\\b/g, 'sainte');", ""],
  // un lieu sans code postal rejoint le même nom dans une autre ville (la règle d'avant)
  'autre-ville': ['relaisColis.js', "&& (!p.ville || !q.ville || normNomRelais(q.ville) === normNomRelais(p.ville))", ""],
  // l'adresse la moins complète gagne
  'complete': ['villeRelais.js', "if (!memePoint(a, b) || completudeLieu(b) <= completudeLieu(a)) return a;", "return a;"],
};

async function charger() {
  const src = path.join(R, 'src');
  let dossier = src;
  if (MUT) {
    const m = MUTATIONS[MUT];
    if (!m) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
    dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'villes-'));
    for (const f of ['villeRelais.js', 'relaisColis.js']) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(dossier, f));
    const p = path.join(dossier, m[0]); const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(m[1])) { console.log('mutation non appliquée (texte absent) : ' + MUT); process.exit(2); }
    fs.writeFileSync(p, t.replace(m[1], m[2]));
  }
  const M = await import('file://' + path.join(dossier, 'relaisColis.js'));
  let V = null;
  if (fs.existsSync(path.join(dossier, 'villeRelais.js'))) V = await import('file://' + path.join(dossier, 'villeRelais.js'));
  else {
    // Le code d'avant : `villeDuPoint` / `villesDesPoints` de CarteRelais.jsx (sans table ni registre).
    const c = fs.readFileSync(path.join(src, 'CarteRelais.jsx'), 'utf8');
    const a = c.indexOf('const normVille'), b = c.indexOf('export const SECTIONS_RETRAIT');
    if (a < 0 || b < 0) V = {};
    else { const f = new Function(c.slice(a, b).replace(/export /g, '') + '; return { villeDuPoint, villesDesPoints, normVille };')(); V = { villeDuPoint: (p) => f.villeDuPoint(p), villesDesPoints: (v) => f.villesDesPoints(v), normVille: f.normVille, avant: true }; }
  }
  return { M, V };
}

(async () => {
  const { M, V } = await charger();
  const appeler = (quoi, fn) => { try { return fn(); } catch (e) { return { erreur: e && e.message }; } };
  const f = (nom) => (typeof V[nom] === 'function' ? V[nom] : () => { throw new Error(nom + ' absente'); });

  // ── A. La clé d'une ville ────────────────────────────────────────────────
  console.log('\nA. La clé d’une ville');
  const nv = (x) => appeler('normVille', () => f('normVille')(x));
  const memes = (l, quoi) => { const k = l.map(nv); dit(k.every((x) => x && x === k[0]), quoi, J(k)); };
  memes(['CANCALE', 'Cancale', ' cancale ', 'Cancale.'], 'A1 casse et espaces : « CANCALE » = « Cancale »');
  memes(['SAINT-MALO', 'Saint Malo', 'St-Malo', 'ST MALO', 'Saint-Malo CEDEX', 'Saint-Malo Cedex 2'], 'A2 tirets, « St » = « Saint », CEDEX');
  memes(['Saint-Méloir-des-Ondes', 'SAINT MELOIR DES ONDES', 'St Méloir des Ondes'], 'A3 accents et tirets');
  memes(['Paris', 'Paris 15e', 'PARIS 15EME ARRONDISSEMENT', 'Paris 1er'], 'A4 arrondissements de Paris = Paris');
  memes(["L'Hermitage", 'L HERMITAGE', 'L’Hermitage'], 'A5 apostrophes');
  dit(!nv('France') && !nv('FR') && !nv('35260'), 'A6 un pays ou un nombre n’est pas une ville', J([nv('France'), nv('FR'), nv('35260')]));
  dit(nv('Saint-Malo') !== nv('Saint-Méloir-des-Ondes') && nv('Vannes') !== nv('Cancale'), 'A7 deux villes restent deux clés');

  // ── B. La ville d'un point ───────────────────────────────────────────────
  console.log('\nB. La ville d’un point');
  const vdp = (p, o) => appeler('villeDuPoint', () => f('villeDuPoint')(p, o));
  const COMMUNES = { 35260: ['Cancale'], 35350: ['Saint-Méloir-des-Ondes', 'Saint-Benoît-des-Ondes', 'Saint-Coulomb'] };
  let r = vdp({ cle: 'a', cp: '35260', ville: 'CANCALE', adresse: '40 Rue du Port, 35260 Cancale' }, { communes: COMMUNES });
  dit(r && r.cle === nv('Cancale'), 'B1 code postal + ville lus (Mondial Relay, Chronopost, conversation) ⇒ la ville', J(r));
  r = vdp({ cle: 'b', cp: '', ville: 'Vannes', adresse: '13 Rue Saint-Vincent, Vannes' }, { communes: COMMUNES });
  dit(r && r.cle === nv('Vannes'), 'B2 consigne Vinted Go : ville LUE sans code postal (« 13 Rue …, Vannes ») ⇒ Vannes', J(r));
  r = vdp({ cle: 'c', cp: '35260', ville: '', adresse: 'Rue de la Bretonnière, 35260' }, { communes: COMMUNES });
  dit(r && r.cle === nv('Cancale') && r.source === 'table', 'B3 code postal SANS ville, une seule commune ⇒ la ville de la table officielle', J(r));
  r = vdp({ cle: 'd', cp: '35350', ville: '', adresse: '2 Rue du Bourg, 35350' }, { communes: COMMUNES });
  dit(r && r.cle === 'cp:35350' && r.nom === '35350', 'B4 code postal à PLUSIEURS communes ⇒ le code postal seul (« 35350 »), aucune ville devinée', J(r));
  r = vdp({ cle: 'e', cp: '35350', ville: '', adresse: '2 Rue du Bourg, 35350' }, { communes: COMMUNES, villeCarte: () => 'Saint-Coulomb' });
  dit(r && r.cle === 'cp:35350', 'B5 … même quand le géocodage d’une adresse tombe sur l’une d’elles', J(r));
  r = vdp({ cle: 'f', cp: '29000', ville: '', adresse: '5 Rue Kéréon, 29000' }, { communes: {}, villeCarte: (p) => (p.cp === '29000' ? 'Quimper' : '') });
  dit(r && r.cle === nv('Quimper') && r.source === 'carte', 'B6 table pas encore lue : la ville du géocodage SÛR au même code postal', J(r));
  r = vdp({ cle: 'g', cp: '29000', ville: '', adresse: '5 Rue Kéréon, 29000' }, { communes: {} });
  dit(r && r.cle === 'cp:29000', 'B7 ni table ni géocodage : le code postal seul, visible', J(r));
  r = vdp({ cle: 'h', cp: '', ville: '', adresse: '', nom: 'Super U' }, { communes: COMMUNES });
  dit(r === null, 'B8 ni ville ni code postal ⇒ aucune ville (le point reste, « à confirmer »)', J(r));
  r = vdp({ cle: 'i', cp: '', ville: 'France', adresse: '13 Rue Saint-Vincent' }, {});
  dit(r === null, 'B9 « France » n’est jamais une ville', J(r));

  // ── C. Le sélecteur ──────────────────────────────────────────────────────
  console.log('\nC. Le sélecteur : une ville = un bouton');
  const pt = (cle, cp, ville, n, hors = 0, extra = {}) => ({ cle, cp, ville, adresse: [cp, ville].filter(Boolean).join(' '), arrives: [...Array(n)].map((_, i) => ({ id: cle + i })).concat([...Array(hors)].map((_, i) => ({ id: cle + 'h' + i, horsCompte: true }))), ...extra });
  const vue = { points: [
    pt('mdp', '35260', 'CANCALE', 3), pt('locker', '35260', 'Cancale', 1, 1), pt('kusmi', '', 'Vannes', 2), pt('taba', '56000', 'VANNES', 1),
    pt('sm1', '35400', 'ST MALO', 1), pt('sm2', '35400', 'Saint-Malo', 2), pt('sd93', '93200', 'Saint-Denis', 1), pt('sd974', '97400', 'Saint-Denis', 1),
    pt('ambigu', '35350', '', 1), { cle: '__inconnu', inconnu: true, arrives: [{ id: 'x' }] }, pt('sansville', '', '', 1, 0, { nom: 'Super U' }),
  ] };
  const vs = appeler('villesDesPoints', () => f('villesDesPoints')(vue, { communes: COMMUNES })) || [];
  const parNom = (n) => (Array.isArray(vs) ? vs.filter((v) => nv(v.nom.replace(/\s*\(.*\)$/, '')) === nv(n)) : []);
  dit(parNom('Cancale').length === 1 && parNom('Cancale')[0].n === 4, 'C1 « CANCALE » et « Cancale » : UN bouton, 4 colis comptés (l’« à vérifier » hors du nombre)', J(parNom('Cancale')));
  dit(parNom('Vannes').length === 1 && parNom('Vannes')[0].n === 3 && parNom('Vannes')[0].points.includes('kusmi'), 'C2 Vannes avec ET sans code postal (consigne Vinted Go) : UN bouton, 3 colis', J(parNom('Vannes')));
  dit(parNom('Saint-Malo').length === 1 && parNom('Saint-Malo')[0].n === 3, 'C3 « ST MALO » et « Saint-Malo » : UN bouton', J(parNom('Saint-Malo')));
  dit(parNom('Saint-Denis').length === 2, 'C4 Saint-Denis (93) et Saint-Denis (974) : deux boutons', J(parNom('Saint-Denis')));
  dit(Array.isArray(vs) && vs.some((v) => v.cle === 'cp:35350' && v.nom === '35350'), 'C5 le code postal à plusieurs communes a son bouton « 35350 »', J(Array.isArray(vs) ? vs.map((v) => v.nom) : vs));
  dit(Array.isArray(vs) && !vs.some((v) => v.points.includes('__inconnu') || v.points.includes('sansville')), 'C6 « Lieu à confirmer » et un point sans ville ne sont rangés dans aucune ville', '');
  const tot = Array.isArray(vs) ? vs.reduce((t, v) => t + v.n, 0) : -1;
  dit(tot === 13, 'C7 la somme des boutons = les colis comptés des points qui ONT une ville (13)', String(tot));
  const sv = appeler('pointsSansVille', () => f('pointsSansVille')(vue, { communes: COMMUNES }));
  dit(Array.isArray(sv) && sv.includes('__inconnu') && sv.includes('sansville') && sv.length === 2, 'C8 les points sans ville sont NOMMÉS (pour rester visibles quand une ville est choisie)', J(sv));

  // ── D. Le même point déjà connu ──────────────────────────────────────────
  console.log('\nD. Le même point déjà connu');
  const reg = (l) => appeler('registre', () => f('registrePointsConnus')(l));
  const comp = (lu, rg, qui) => appeler('completer', () => f('completerParPointConnu')(lu, rg, qui));
  const cp = (x) => (/\b(\d{5})\b/.exec(String((x && x.lieuAdresse) || '')) || [])[1] || '';
  const CONNUS = [
    { lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent, 56000 Vannes', transporteur: '' },                   // conversation
    { lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent', transporteur: 'vinted', compte: 'compteA' },        // e-mail Vinted Go
    { lieuNom: 'Tabavap', lieuAdresse: '29 Rue Hoche, 56000 Vannes', transporteur: 'mondialrelay', compte: 'compteA' },
    { lieuNom: 'Super U', lieuAdresse: 'Rue de la Bretonnière, 35260 Cancale', transporteur: 'autre' },              // « t'attend »
    { lieuNom: 'Carrefour City', lieuAdresse: '3 Place du Marché, 35260 Cancale', transporteur: 'mondialrelay' },
    { lieuNom: 'Carrefour City', lieuAdresse: '8 Rue Thiers, 56000 Vannes', transporteur: 'mondialrelay' },        // homonyme
    { lieuNom: 'Phone Cash', lieuAdresse: '17 Rue Thiers, 56000 Vannes', transporteur: 'chronopost' },
    { lieuNom: 'Le Narval', lieuAdresse: '', transporteur: 'mondialrelay' },                                         // nom seul, jamais d'adresse
  ];
  const RG = reg(CONNUS);
  r = comp({ lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent, Vannes' }, RG, { transporteur: 'vinted', compte: 'compteA' });
  dit(cp(r) === '56000' && /Vannes/.test(r.lieuAdresse), 'D1 consigne Vinted Go sans code postal ⇒ le code postal du MÊME point (unique) repris', J(r));
  r = comp({ lieuNom: "TABA'VAP", lieuAdresse: '' }, RG, { transporteur: 'mondialrelay', compte: 'compteA' });
  dit(cp(r) === '56000' && /29 Rue Hoche/.test(r.lieuAdresse), 'D2 e-mail Mondial Relay au nom seul (« TABA’VAP ») ⇒ l’adresse du point connu', J(r));
  r = comp({ lieuNom: 'LOCKER 24/7 SUPER U', lieuAdresse: '' }, RG, { transporteur: 'mondialrelay' });
  dit(cp(r) === '35260', 'D3 « LOCKER 24/7 SUPER U » ⇒ le locker connu par l’e-mail Vinted (transporteur « autre » = pas su)', J(r));
  r = comp({ lieuNom: 'Carrefour City', lieuAdresse: '' }, RG, { transporteur: 'mondialrelay' });
  dit(!cp(r), 'D4 deux points connus du même nom (Cancale, Vannes) ⇒ RIEN n’est pris', J(r));
  r = comp({ lieuNom: 'Phone Cash', lieuAdresse: '' }, RG, { transporteur: 'mondialrelay' });
  dit(!cp(r), 'D5 le point connu est d’un AUTRE transporteur ⇒ rien', J(r));
  r = comp({ lieuNom: 'Tabavap', lieuAdresse: '' }, RG, { transporteur: 'mondialrelay', compte: 'compteB' });
  dit(!cp(r), 'D6 le point connu est d’un AUTRE compte ⇒ rien', J(r));
  r = comp({ lieuNom: 'Kusmi Tea', lieuAdresse: '40 Rue du Port, Vannes' }, RG, {});
  dit(!cp(r), 'D7 une AUTRE rue que le point connu ⇒ rien', J(r));
  r = comp({ lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent, Lorient' }, RG, {});
  dit(!cp(r), 'D8 une AUTRE ville que le point connu ⇒ rien', J(r));
  r = comp({ lieuNom: 'Le Narval', lieuAdresse: '' }, RG, { transporteur: 'mondialrelay' });
  dit(!cp(r), 'D9 un point connu SANS adresse ne donne rien', J(r));
  r = comp({ lieuNom: 'Phone Cash', lieuAdresse: '' }, reg([...CONNUS, { lieuNom: 'PHONE CASH', lieuAdresse: '17 RUE THIERS, 56000 VANNES', transporteur: 'mondialrelay' }]), { transporteur: 'mondialrelay' });
  dit(cp(r) === '56000', 'D10 le même point écrit deux fois (casse) reste UN point ⇒ repris', J(r));
  r = comp({ lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent, Vannes', lieuConflit: { quoi: 'rue' } }, RG, {});
  dit(!cp(r), 'D11 deux adresses en conflit pour ce colis ⇒ rien n’est complété', J(r));

  // ── E. Deux sources du même colis ────────────────────────────────────────
  console.log('\nE. Deux sources du même colis');
  const lpc = (a, b) => appeler('lieuLePlusComplet', () => f('lieuLePlusComplet')(a, b));
  r = lpc({ lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent' }, { lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent, 56000 Vannes' });
  dit(cp(r) === '56000', 'E1 e-mail sans code postal + conversation du même achat avec adresse ⇒ l’adresse complète gagne', J(r));
  r = lpc({ lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent' }, { lieuNom: 'Tabavap', lieuAdresse: '29 Rue Hoche, 56000 Vannes' });
  dit(r && r.lieuNom === 'Kusmi Tea' && !cp(r), 'E2 deux points DIFFÉRENTS ⇒ rien n’est échangé', J(r));
  r = lpc({ lieuNom: 'Tabavap', lieuAdresse: '29 Rue Hoche, 56000 Vannes' }, { lieuNom: 'Tabavap', lieuAdresse: '29 Rue Hoche' });
  dit(cp(r) === '56000', 'E3 la source la moins complète ne remplace jamais la complète', J(r));

  // ── F. Bout à bout sur les formes mesurées ───────────────────────────────
  console.log('\nF. Bout à bout (formes mesurées chez Julien, valeurs refaites)');
  const regF = V.avant ? null : reg(CONNUS);
  const lieu = (nom, adresse, qui = {}) => { const lu = { lieuNom: nom, lieuAdresse: adresse }; const c = regF ? comp(lu, regF, qui) : lu; return { nom: c.lieuNom, adresse: c.lieuAdresse }; };
  const colis = [
    ...['1', '2', '3'].map((n) => ({ id: 'mr' + n, ...lieu('Maison de la Presse', '40 Rue du Port, 35260 Cancale') })),   // e-mail MR complet
    { id: 'vg1', ...lieu('Kusmi Tea', '13 Rue Saint-Vincent, Vannes', { transporteur: 'vinted', compte: 'compteA' }) },    // Vinted Go + suivi : ville sans CP
    { id: 'vg2', ...lieu('Kusmi Tea', '13 Rue Saint-Vincent, Vannes', { transporteur: 'vinted', compte: 'compteA' }) },
    { id: 'mrn', ...lieu("TABA'VAP", '', { transporteur: 'mondialrelay', compte: 'compteA' }) },                             // MR nom seul
    { id: 'lock', ...lieu('LOCKER 24/7 SUPER U', '', { transporteur: 'mondialrelay' }) },
    { id: 'cv', ...lieu('Terra Cbd', '11 Rue Hoche, 56000 VANNES') },                                                     // conversation / Chronopost
    { id: 'cc', ...lieu('Carrefour City', '', { transporteur: 'mondialrelay' }) },                                       // homonyme : à confirmer
    { id: 'sans', nom: '', adresse: '' },                                                                                // aucun lieu
    { id: 'hv', horsCompte: true, ...lieu('Kusmi Tea', '13 Rue Saint-Vincent, 56000 Vannes') },
  ];
  const vueF = M.pointsARetirer({ colis });
  const vsF = appeler('villesDesPoints', () => f('villesDesPoints')(vueF, {})) || [];
  const bouton = (n) => (Array.isArray(vsF) ? vsF.find((v) => nv(v.nom) === nv(n)) : null);
  dit(bouton('Cancale') && bouton('Cancale').n === 4, 'F1 Cancale : la Maison de la Presse (3) + le locker au nom seul (1) = 4', J(vsF));
  dit(bouton('Vannes') && bouton('Vannes').n === 4, 'F2 Vannes : 2 consignes Vinted Go (sans code postal) + Taba’Vap au nom seul + Terra Cbd = 4', J(vsF));
  const ptDe = (id) => vueF.points.find((p) => p.arrives.some((c) => c.id === id));
  dit(ptDe('vg1') && ptDe('vg1') === ptDe('hv'), 'F3 les consignes Vinted Go et la conversation au même point : UN point', '');
  const svF = appeler('pointsSansVille', () => f('pointsSansVille')(vueF, {}));
  dit(Array.isArray(svF) && svF.includes(ptDe('cc').cle) && svF.includes(ptDe('sans').cle), 'F4 l’homonyme et le colis sans lieu restent « à confirmer », nommés, jamais rangés dans une ville', J(svF));
  const comptes = vueF.points.reduce((t, p) => t + p.nComptes, 0);
  dit(comptes === 10, 'F5 aucun colis perdu : 10 comptés, chacun sous un point', String(comptes));

  // ── G. Jamais dans une autre ville ───────────────────────────────────────
  console.log('\nG. Le même nom dans une autre ville');
  const g = M.regrouperRelais({ arrives: [
    { id: 'a', nom: 'Super U', adresse: 'Rue de la Bretonnière, 35260 Cancale' },
    { id: 'b', nom: 'Super U', rue: '', cp: '', ville: 'Vannes' },   // locker lu « Super U · Vannes », sans rue ni code postal
  ] });
  const gb = g.find((p) => p.arrives.some((c) => c.id === 'b'));
  dit(gb && !gb.arrives.some((c) => c.id === 'a') && nv(gb.ville) === nv('Vannes'), 'G1 « Super U » à Vannes (sans code postal) ne rejoint PAS le Super U de Cancale', J(g.map((p) => [p.cle, p.ville, p.arrives.map((c) => c.id)])));
  const g2 = M.regrouperRelais({ arrives: [{ id: 'a', nom: 'Speed Queen', adresse: '24 Rue Hoche, 56000 Vannes' }, { id: 'b', nom: 'Speed Queen', adresse: '24 Rue Hoche, Vannes' }] });
  dit(g2.length === 1, 'G2 … mais le même point, même rue, même ville sans code postal, le rejoint', J(g2.map((p) => p.cle)));

  // ── H. Le branchement ────────────────────────────────────────────────────
  console.log('\nH. Le branchement');
  const nc = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const A = nc(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
  const C = nc(fs.readFileSync(path.join(R, 'src/CarteRelais.jsx'), 'utf8'));
  dit(/const lieuDeLigne = \(t, a\) => \{[\s\S]{0,400}lieuLePlusComplet\(lu, lieuDe\(ra\.lieu\)\)[\s\S]{0,200}completer\(lu/.test(A), 'H1 le lieu d’un e-mail : suivi du même n°, puis conversation de SON achat, puis point connu', '');
  dit(/registrePointsConnus\(\[[\s\S]{0,300}tracking[\s\S]{0,300}colisRelais[\s\S]{0,300}lieuTransporteurRepare/.test(A), 'H2 le registre lit tous les e-mails, les conversations et les lectures chez le transporteur', '');
  dit(/memePoint\(lpA, lqA\) && completudeLieu\(lqA\) > completudeLieu\(lpA\)/.test(A), 'H3 deux lignes du même n° : l’adresse complète du même point gagne', '');
  dit(/const sansVille = new Set\(pointsSansVille\(vueTout\)\)/.test(C) && /vChoisie\.points\.includes\(p\.cle\) \|\| sansVille\.has\(p\.cle\)/.test(C), 'H4 une ville choisie ne cache NI « Lieu à confirmer » NI un point sans ville', '');
  dit(/export const villesDesPoints = \(vue\) => villesDesPointsRegle\(vue, optionsVille\(\)\)/.test(C) && /villesDesPoints\(parPoint\)/.test(A), 'H5 la carte sombre et le sélecteur : la MÊME règle, les mêmes sources', '');

  console.log(`\n${ok} ✅ · ${ko} ❌${MUT ? ' (mutation ' + MUT + ')' : ''}`);
  process.exit(ko ? 1 : 0);
})();
