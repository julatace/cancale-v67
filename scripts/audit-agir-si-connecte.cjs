#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « AGIR SEULEMENT SI L'EXTENSION EST CONNECTÉE » (24 nov.) — node scripts/audit-agir-si-connecte.cjs
//  Julien : « faire absolument tout si l'extension est connectée. Si l'extension n'est pas connectée sur un compte,
//  on peut voir les données mais on ne peut pas agir dessus. »
//  EXÉCUTE la porte (src/agir/peutAgir.js), l'envoi (src/agir/porte.js `envoyerGeste`, `republierDansApp`) et le panneau
//  (src/ouvrirPanneau.js), avec l'esprit « 50 comptes identiques » : 50 comptes Vinted AUX MÊMES NOMS, A connecté (onglet
//  de CE navigateur ou ordinateur allumé), B…  pas ⇒ chaque geste sur B est en lecture seule et RIEN ne part ; chaque geste
//  de A passe par le chemin d'extension existant (une commande `cmd_dist_*` que la règle <a-distance-regle> accepte).
//  Puis lit les écrans : chaque bouton d'action passe par la porte (Messages Vinted / Leboncoin / Vestiaire, offres,
//  republier, BoutonExtension, RangeeExtension, ouvrirPanneau).
//  `--prouve` : chaque mutation (copie de src/ dans un dossier temporaire) doit rougir.
//  `AGIR_SRC=<dossier src>` : lancer sur un autre arbre (origin/main : rouge, la porte n'y existe pas).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const SRC = process.env.AGIR_SRC || path.join(RACINE, 'src');

const MUTATIONS = {
  'version-ignoree': ['agir/peutAgir.js', "if (cmpVersion(ver, exige) < 0) return non('retard'", "if (false) return non('retard'"],
  'nimporte-quel-compte': ['agir/peutAgir.js', "(joker || idCompte(s, c.id) === id)", "(true || idCompte(s, c.id) === id)"],
  'onglet-autre-compte': ['agir/peutAgir.js', "ici = !!u && (joker || u === id)", "ici = !!u"],
  'pas-su-ok': ['agir/peutAgir.js', "if (presences === undefined) return non('lecture', base);\n  if (!Array.isArray(presences))", "if (presences === undefined) return { ok: true, voie: 'distance', par: null };\n  if (!Array.isArray(presences))"],
  'eteint-ok': ['agir/peutAgir.js', "presences.filter((p) => p && p.allume && Number(p.atMs) > 0 && maintenant - Number(p.atMs) < ADIST_ALLUME_MS + 60000)", "presences.filter((p) => p)"],
  'depassee-ignoree': ['agir/peutAgir.js', "if (String(r.depassee) === 'true') return 'depassee';", ""],
  'tout-arrete-ignore': ['agir/peutAgir.js', "if (F.toutArrete && F.toutArrete.on === true) return non('tout-arrete', base, 'reprendre');", ""],
  'envoi-sans-porte': ['agir/porte.js', "if (!v.ok) return { ok: false, raison: v.raison, verdict: v };", ""],
  'panneau-sans-porte': ['ouvrirPanneau.js', "if (!v.ok) { try { window.dispatchEvent(new CustomEvent('vrm:agir-refus', { detail: v })); } catch (_) {} return null; }", ""],
  'bouton-sans-porte': ['BoutonExtension.jsx', "const v = usePeutAgir(c.site, compte, gesteDe(action), 'panneau');\n  const porte = { 'data-agir': v.ok ? 'ok' : 'lecture', 'data-agir-site': c.site, 'data-agir-geste': gesteDe(action), 'data-agir-raison': v.ok ? undefined : v.raison };\n  const ouvrir", "const v = { ok: true };\n  const porte = {};\n  const ouvrir"],
  // 5.450 (lot agir-tout)
  'bg-sans-retour-oublie': ['BG', "cmd: 'lbcSupprime', id: a.id, confirme: true, sansRetour: true,", "cmd: 'lbcSupprime', id: a.id, confirme: true,"],
  'bg-favoris-tous': ['BG', "const choix = cochables.filter((x) => !voulus || voulus.has(String(x.id)))", "const choix = (Array.isArray(ap.liste) ? ap.liste : []).filter((x) => x && x.id)"],
  'favoris-sans-confirmation': ['aDistance.js', "const ADIST_CONFIRMER = ['accepter', 'republier', 'favoris', 'supprimer'];", "const ADIST_CONFIRMER = ['accepter', 'republier'];"],
  'ebay-expire-ok': ['agir/peutAgir.js', "if (j === 'expire') return non('ebay-expire', base, 'reconnecter-ebay');", "if (j === 'expire') return { ok: true, voie: 'api', par: null };"],
  'distcap-ignore': ['agir/peutAgir.js', "g.distCap ? (caps[g.distCap] || '9999.0.0') : '0.0.0'", "'0.0.0'"],
  'prix-sans-porte': ['PrixPartout.jsx', "const enFile = (s) => s.site !== 'ebay' && s.mode === 'ext' && s.prix != null && agirMaintenant(s.site, s.compte, 'baisser', 'file').ok;", "const enFile = (s) => s.site !== 'ebay' && s.mode === 'ext' && s.prix != null;"],
  'composer-vinted-retire': ['ecrans/Comptabilite.jsx', '<ComposerReponse site="vinted"', '<BoutonExtension action="repondre" site="vinted"'],
};
if (process.argv.includes('--prouve')) {
  const base = spawnSync(process.execPath, [__filename], { encoding: 'utf8' });
  let rate = base.status === 0 ? 0 : 1;
  console.log(`${base.status === 0 ? '✅' : '❌'} code tel quel : ${base.status === 0 ? 'vert' : 'ROUGE\n' + base.stdout.split('\n').filter((l) => l.includes('❌')).join('\n')}`);
  for (const [nom, [fic, a, b]] of Object.entries(MUTATIONS)) {
    const tmp = fs.mkdtempSync(path.join(RACINE, '.agir-mut-'))   // dans le dépôt : react se résout par node_modules;
    const dst = path.join(tmp, 'src');
    // Copie légère : seulement ce que l'audit lit (jamais node_modules).
    fs.mkdirSync(dst, { recursive: true });
    for (const x of ['agir', 'extension', 'aDistance.js', 'ouvrirPanneau.js', 'BoutonExtension.jsx', 'ecrans', 'i18n', 'PrixPartout.jsx', 'OffresVestiaire.jsx', 'AimesVestiaire.jsx', 'annoncesActions.js', 'App.jsx', 'gardePrix.js']) fs.cpSync(path.join(RACINE, 'src', x), path.join(dst, x), { recursive: true });
    const bgDst = path.join(tmp, 'background.js'); fs.copyFileSync(path.join(RACINE, 'vinted-sync-extension', 'background.js'), bgDst);
    const f = fic === 'BG' ? bgDst : path.join(dst, fic); const s = fs.readFileSync(f, 'utf8');
    if (!s.includes(a)) { console.log(`❌ mutation ${nom} : texte introuvable`); rate++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, s.replace(a, b));
    const r = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, AGIR_SRC: dst, AGIR_BG: bgDst } });
    const rouges = String(r.stdout).split('\n').filter((l) => l.includes('❌'));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » : ${bon ? 'rouge — ' + rouges[0].trim() : 'RESTE VERTE'}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(rate ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
const lire = (rel) => { try { return fs.readFileSync(path.join(SRC, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

(async () => {
  let P, Porte, D, Panneau;
  try {
    P = await import(path.join(SRC, 'agir', 'peutAgir.js'));
    Porte = await import(path.join(SRC, 'agir', 'porte.js'));
    D = await import(path.join(SRC, 'aDistance.js'));
  } catch (e) { dit(false, 'la porte existe (src/agir/peutAgir.js, src/agir/porte.js)', e && e.message); console.log(`\n${ok} vert(s), ${ko} rouge(s)`); process.exit(1); }

  const T = Date.now();
  const CAPS = { messagerie: '5.135.0', favoris: '5.217.0', republierpage: '5.277.0', baisseprix: '5.336.0', masquercarte: '5.409.0', vacances: '5.338.0', creervinted: '5.367.0',
    commande: '5.129.0', panneaucomplet: '5.410.0', lbcrepondre: '5.318.0', lbcprix: '5.368.0', lbcinterface: '5.416.0', lbcsupprime: '5.291.0', publication: '5.160.0',
    lbcecrireinteresses: '5.410.0', vcrepondre: '5.295.0', vcoffrerepondre: '5.319.0', vcprix: '5.368.0', vcpublier: '5.235.0', vcaimes: '5.393.0', adistance: '5.436.0', agirtout: '5.450.0' };
  const MOI = '0f0e0d0c-0000-4000-8000-000000000001';
  // 50 comptes Vinted, TOUS nommés « boutique » (les mêmes titres partout) : seule l'identité (uid) les distingue.
  const UIDS = Array.from({ length: 50 }, (_, i) => String(41000001 + i));
  const A = UIDS[0], B = UIDS[1];
  const noms = { vinted: Object.fromEntries(UIDS.map((u) => [u, 'boutique'])), leboncoin: { lbcA: 'boutique', lbcB: 'boutique' }, vestiaire: { vcA: 'boutique', vcB: 'boutique' } };
  const ICI = 'aaaaaaaaaaaaaaaa', ORDI = 'bbbbbbbbbbbbbbbb';
  const presence = (id, comptes, ver = '5.450.0', age = 30000) => ({ id, atMs: T - age, allume: age < 180000, ver, nav: 'chrome', sys: 'mac', comptes, retenues: [], enCours: '', rt: '' });
  // CE navigateur : extension branchée à CE compte VRM, onglet Vinted sur A.
  const extIci = (uidOnglet = A, version = '5.450.0') => ({ present: true, appelsFinis: true, installeeIci: true, version, plusieurs: [], perime: false,
    etat: { ok: true, vrm: { connecte: true, user_id: MOI, email: 'x@y.z' }, vinted: uidOnglet ? { uid: uidOnglet, login: 'boutique' } : null, ici: { appareil: ICI } } });
  const faits = (plus = {}) => ({ maintenant: T, attendue: '5.450.0', capacites: CAPS, telephone: false, brancheEnCours: false, moi: { id: MOI, email: 'x@y.z' },
    ext: extIci(), presences: [presence(ICI, [{ site: 'vinted', id: A, nom: 'boutique' }, { site: 'leboncoin', id: 'lbcA', nom: 'boutique' }, { site: 'vestiaire', id: 'vcA', nom: 'boutique' }])],
    appareils: [], toutArrete: null, ebay: { principal: true }, noms, ...plus });
  const GESTES = P.GESTES_AGIR;
  const tous = (site) => Object.keys(GESTES[site]);

  // ── 1. Ici : A connecté (onglet), B à Z non — 50 comptes aux mêmes noms ─────────────────────────────────
  const F = faits();
  let bLibre = [], aBloque = [];
  for (const site of ['vinted', 'leboncoin', 'vestiaire']) {
    const a = site === 'vinted' ? A : site === 'leboncoin' ? 'lbcA' : 'vcA';
    const autres = site === 'vinted' ? UIDS.slice(1) : site === 'leboncoin' ? ['lbcB'] : ['vcB'];
    for (const g of tous(site)) {
      for (const par of ['', 'panneau', 'file']) {
        for (const b of autres) { const v = P.peutAgir(F, { site, compte: b, geste: g, par }); if (v.ok) bLibre.push(`${site}/${b}/${g}/${par}`); }
        const va = P.peutAgir(F, { site, compte: a, geste: g, par });
        const attendu = par === 'file' ? !!GESTES[site][g].dist : true;
        if (va.ok !== attendu) aBloque.push(`${site}/${g}/${par}:${va.raison || 'ok'}`);
      }
    }
  }
  dit(bLibre.length === 0, '50 comptes aux mêmes noms : tout geste sur un compte NON connecté est en lecture seule (Vinted, Leboncoin, Vestiaire, 3 voies)', bLibre.slice(0, 6).join(', '));
  dit(aBloque.length === 0, 'le compte connecté (A) peut tout faire : panneau ici, et la file pour les gestes qui y ont leur équivalent', aBloque.slice(0, 6).join(', '));
  const vb = P.peutAgir(F, { site: 'vinted', compte: B, geste: 'repondre' });
  dit(vb.raison === 'autre-compte' && vb.cle === 'agir.raison.autre-compte' && vb.geste === 'ouvrir-site', 'B (onglet sur A) : la raison « onglet sur un autre compte » et le geste « ouvre le site »', JSON.stringify(vb));
  dit(P.peutAgir(F, { site: 'vinted', compte: 'boutique', geste: 'repondre' }).ok === false, 'un NOM (« boutique ») n\'est jamais une identité de compte');

  // ── 2. Rien ne part pour B ; A passe par le chemin d'extension existant (une commande que l'extension accepte) ─
  const deposees = [];
  Porte.poserEnvoiAgir({ deposer: async (x) => { const c = D.nouvelleCommandeDistance({ ...x, owner: MOI, alea: 'abcdefgh' }); deposees.push(c); return c ? { id: c.id } : null; } });
  Porte.poserFaitsAgir(F);
  const rB = await Porte.envoyerGeste({ site: 'vinted', compte: B, geste: 'repondre', distGeste: 'repondre', args: { conv: '123456', texte: 'Bonjour' } });
  const rB2 = await Porte.envoyerGeste({ site: 'vinted', compte: B, geste: 'offre', distGeste: 'accepter', args: { tx: '1', oid: '2' }, confirme: true });
  dit(!rB.ok && !rB2.ok && deposees.length === 0, 'envoyerGeste sur B : refusé, AUCUNE commande déposée', JSON.stringify({ rB, n: deposees.length }));
  const rA = await Porte.envoyerGeste({ site: 'vinted', compte: A, geste: 'repondre', distGeste: 'repondre', args: { conv: '123456', texte: 'Bonjour' } });
  const c = deposees[0];
  dit(rA.ok && c && c.data.compte === A && c.data.geste === 'repondre' && c.data.site === 'vinted' && c.data.pour === MOI && /^cmd_dist_/.test(c.id), 'envoyerGeste sur A : UNE commande `cmd_dist_*` au nom de A (la file « À distance » de l\'extension)', JSON.stringify(c));
  const rLbc = await Porte.envoyerGeste({ site: 'leboncoin', compte: 'lbcB', geste: 'repondre', distGeste: 'repondre', args: { conv: 'abc-123', texte: 'Oui' } });
  const rVc = await Porte.envoyerGeste({ site: 'vestiaire', compte: 'vcA', geste: 'repondre', distGeste: 'repondre', args: { conv: 'conv-9', texte: 'Oui' } });
  dit(!rLbc.ok && rVc.ok && deposees.length === 2 && deposees[1].data.compte === 'vcA', 'Leboncoin B refusé, Vestiaire A déposé au nom de vcA (le compte privé de l\'onglet, par la présence)', JSON.stringify({ rLbc, rVc }));
  // Republier depuis l'app : 2 annonces, une de A, une de B ⇒ UNE confirmation, UNE commande (A), B dit.
  let questions = 0;
  const rep = await Porte.republierDansApp([{ compte: A, id: '7001' }, { compte: B, id: '7002' }], async () => { questions++; return true; });
  const dRep = deposees.slice(2);
  dit(rep.ok && rep.n === 1 && rep.refusees === 1 && questions === 1 && dRep.length === 1 && dRep[0].data.geste === 'republier' && dRep[0].data.compte === A && dRep[0].data.confirme === true && dRep[0].data.args.id === '7001',
    'Republier depuis VRM : une confirmation, la paire de A part (republier confirmé), celle de B non', JSON.stringify({ rep, dRep }));
  const avant = deposees.length;
  const repB = await Porte.republierDansApp([{ compte: B, id: '7002' }], async () => { questions++; return true; });
  dit(!repB.ok && deposees.length === avant && questions === 1, 'Republier sur B seul : rien demandé, rien déposé');
  const repNon = await Porte.republierDansApp([{ compte: A, id: '7003' }], async () => false);
  dit(!repNon.ok && repNon.annule && deposees.length === avant, 'Republier refusé à la confirmation : rien déposé');

  // ── 3. À distance : ce navigateur sans extension (iPhone), l'ordinateur allumé a B ─────────────────────────
  const Fd = faits({ ext: { present: false, appelsFinis: true, installeeIci: false, version: '', etat: undefined }, telephone: true,
    presences: [presence(ORDI, [{ site: 'vinted', id: B, nom: 'boutique' }])] });
  dit(P.peutAgir(Fd, { site: 'vinted', compte: B, geste: 'repondre', par: 'file' }).voie === 'distance', 'iPhone : B ouvert sur l\'ordinateur allumé ⇒ répondre part à distance');
  dit(P.peutAgir(Fd, { site: 'vinted', compte: A, geste: 'repondre', par: 'file' }).ok === false, 'iPhone : A ouvert nulle part ⇒ lecture seule');
  dit(P.peutAgir(Fd, { site: 'vinted', compte: B, geste: 'repondre', par: 'panneau' }).ok === false, 'iPhone : le panneau (geste de CE navigateur) est en lecture seule');
  dit(P.peutAgir(Fd, { site: 'vinted', compte: B, geste: 'automatisations', par: 'file' }).raison === 'ici-seulement', 'un geste sans équivalent à distance (réglages du panneau) : « se fait sur l\'ordinateur »');
  // 5.450 : les gestes ajoutés à la file exigent la 5.450 sur l'ordinateur ; la réponse (5.436) reste permise avec une 5.448.
  const F448 = faits({ ext: Fd.ext, presences: [presence(ORDI, [{ site: 'vinted', id: B }, { site: 'leboncoin', id: 'lbcB' }, { site: 'vestiaire', id: 'vcB' }], '5.448.0')] });
  const nouveaux = [['vinted', B, 'favoris'], ['vinted', B, 'vacances'], ['vinted', B, 'creer'], ['leboncoin', 'lbcB', 'pause'], ['leboncoin', 'lbcB', 'supprimer'], ['leboncoin', 'lbcB', 'publier'], ['vestiaire', 'vcB', 'offre'], ['vestiaire', 'vcB', 'favoris']];
  dit(nouveaux.every(([si, co, g]) => P.peutAgir(F448, { site: si, compte: co, geste: g, par: 'file' }).raison === 'retard') && P.peutAgir(F448, { site: 'vinted', compte: B, geste: 'repondre', par: 'file' }).ok,
    'ordinateur en 5.448 : les gestes de la 5.450 (favoris, vacances, brouillon, pause/supprimer/publier Leboncoin, offres/aimés Vestiaire) en lecture seule (« mets à jour »), répondre permis');
  const F450 = faits({ ext: Fd.ext, presences: [presence(ORDI, [{ site: 'vinted', id: B }, { site: 'leboncoin', id: 'lbcB' }, { site: 'vestiaire', id: 'vcB' }], '5.450.0')] });
  dit(nouveaux.every(([si, co, g]) => P.peutAgir(F450, { site: si, compte: co, geste: g, par: 'file' }).voie === 'distance'), 'ordinateur en 5.450 : ces gestes partent à distance');
  const eteint = faits({ ext: Fd.ext, presences: [presence(ORDI, [{ site: 'vinted', id: B, nom: 'boutique' }], '5.448.0', 10 * 60000)] });
  dit(P.peutAgir(eteint, { site: 'vinted', compte: B, geste: 'repondre', par: 'file' }).ok === false, 'ordinateur éteint (présence de 10 min) ⇒ lecture seule');

  // ── 4. Dépassée, « pas su », version, arrêts ⇒ lecture seule ────────────────────────────────────────────
  const cas = {
    'présences en cours de lecture (iPhone)': [faits({ ext: Fd.ext, presences: undefined }), B, 'lecture'],
    'présences illisibles (iPhone)': [faits({ ext: Fd.ext, presences: null }), B, 'passu'],
    'extension ici trop ancienne pour le geste': [faits({ ext: extIci(A, '5.300.0') }), A, 'retard'],
    'extension ici trop ancienne pour baisser un prix (panneau)': [faits({ ext: extIci(A, '5.300.0') }), A, 'retard', 'baisser', 'panneau'],
    'version de l\'extension illisible': [faits({ ext: { ...extIci(A), version: '' } }), A, 'nav-retard'],
    'extension dépassée (5.448 `depassee`)': [faits({ appareils: [{ id: 'ext_appareil_' + ICI, depassee: 'true' }] }), A, 'depassee'],
    'arrêt captcha récent sur Vinted (5.448 `arret`)': [faits({ appareils: [{ id: 'ext_appareil_' + ICI, depassee: 'false', arret: { site: 'vinted', code: 'captcha', at: T - 60000 } }] }), A, 'captcha'],
    '« Tout arrêter »': [faits({ toutArrete: { on: true, at: T } }), A, 'tout-arrete'],
    'extension connectée à un AUTRE compte VRM': [faits({ ext: { ...extIci(A), etat: { ...extIci(A).etat, vrm: { connecte: true, user_id: 'autre-0000-0000', email: 'z@z.z' } } }, presences: [] }), A, 'nav-autre-vrm'],
    'distance : ordinateur trop ancien pour la file (< adistance)': [faits({ ext: Fd.ext, presences: [presence(ORDI, [{ site: 'vinted', id: B }], '5.420.0')] }), B, 'retard'],
  };
  for (const [nom, [f, compte, raison, geste = 'repondre', par = 'file']] of Object.entries(cas)) {
    const v = P.peutAgir(f, { site: 'vinted', compte, geste, par });
    dit(!v.ok && v.raison === raison, `${nom} ⇒ lecture seule (${raison})`, JSON.stringify(v));
  }
  dit(P.peutAgir(faits({ appareils: [{ id: 'ext_appareil_' + ICI, arret: { site: 'vinted', code: 'captcha', at: T - 3 * 3600000 } }] }), { site: 'vinted', compte: A, geste: 'repondre' }).ok, 'un arrêt vieux de 3 h ne bloque plus');
  Porte.poserFaitsAgir(null);
  dit(Porte.agirMaintenant('vinted', A, 'repondre').ok === false, 'aucun fait posé (app qui démarre) ⇒ lecture seule, jamais « ok » par défaut');
  dit(P.peutAgir(faits(), { site: 'ebay', compte: 'principal', geste: 'x' }).voie === 'api' && !P.peutAgir(faits({ ebay: {} }), { site: 'ebay', compte: 'principal', geste: 'x' }).ok
    && P.peutAgir(faits({ ebay: undefined }), { site: 'ebay', compte: 'principal', geste: 'x' }).raison === 'ebay-passu', 'eBay : gardé par SON jeton (relié ⇒ api ; pas relié ou pas su ⇒ lecture seule), jamais par l\'extension');

  // ── 4 bis. 5.450 : la RÈGLE de la file (src/aDistance.js, recopiée dans background.js) et le VRAI background.js ─────
  const nc = (o) => D.nouvelleCommandeDistance(Object.assign({ owner: MOI, alea: 'agirtout' }, o));
  const permises = [
    ['favoris', 'vinted', A, { ids: ['notif-1', 'notif-2'], texte: 'Bonjour, une offre pour vous', taux: 10 }, true],
    ['vacances', 'vinted', A, { vacances: true }, false],
    ['creer', 'vinted', A, { fiche: { id: 'fiche-12', numero: '12', titre: 'Nike P-6000', description: 'Très bon état', prix: 80, photos: ['https://images1.vinted.net/t/1.jpg'] } }, false],
    ['pause', 'leboncoin', 'lbcA', { id: '2900000001' }, false],
    ['supprimer', 'leboncoin', 'lbcA', { id: '2900000001', numero: 'B125', titre: 'Jordan 4' }, true],
    ['publier', 'leboncoin', 'lbcA', { id: '91010001' }, false],
    ['offre', 'vestiaire', 'vcA', { nego: '123456', geste: 'contre', prix: 90 }, false],
    ['aimes', 'vestiaire', 'vcA', { produit: '445566', prix: 90, prixAvant: 100 }, false],
  ];
  const cmds = permises.map(([geste, site, compte, args, conf]) => nc({ geste, site, compte, args, confirme: conf }));
  dit(cmds.every((c) => c && !D.adistCommande(c.data).refus), '5.450 : les 8 gestes ajoutés font une commande que la règle accepte', JSON.stringify(cmds.map((c) => c && c.data.geste)));
  dit(nc({ geste: 'supprimer', site: 'leboncoin', compte: 'lbcA', args: { id: '2900000001' } }) === null && nc({ geste: 'favoris', site: 'vinted', compte: A, args: {} }) === null,
    'supprimer (sans retour) et écrire aux favoris SANS sa confirmation ⇒ aucune commande');
  dit(nc({ geste: 'creer', site: 'vinted', compte: A, args: { fiche: { id: 'f', photos: ['data:image/jpeg;base64,AAAA'] } } }) === null
    && nc({ geste: 'aimes', site: 'vestiaire', compte: 'vcA', args: { produit: '445566', prix: 110, prixAvant: 100 } }) === null
    && nc({ geste: 'supprimer', site: 'vinted', compte: A, args: { id: '91010001' } }) === null && nc({ geste: 'publier', site: 'vestiaire', compte: 'vcA', args: { id: '1' } }) === null,
    'refusés : photo en base64 dans la file, offre aux aimés à la HAUSSE, supprimer sur Vinted, publier sur Vestiaire (VRM n\'y clique jamais « Publier »)');
  // Le VRAI background.js : chaque geste par SON chemin du clic, avec les marques de SA confirmation.
  let bg = null;
  try {
    const { faireFond } = require('./_fond-vm.cjs');
    const BG = process.env.AGIR_BG || path.join(RACINE, 'vinted-sync-extension', 'background.js');
    bg = faireFond({ src: BG, lignes: {}, store: { vrmCloisonne: true }, connecte: A, comptes: [{ vinted_user_id: A, login: 'boutique', domain: 'www.vinted.fr', access_token: 'j' }], onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }] });
  } catch (e) { bg = null; }
  if (bg && typeof bg.ctx.distanceExecuter === 'function') {
    const vus = [];
    bg.ctx.executerCommande = async (msg) => { vus.push(msg); return { accepte: true, etape: 'fait' }; };
    bg.ctx.apercuCarteFrais = async () => ({ ok: true, apercu: { reglages: { r: 1 }, liste: [{ id: 'notif-1', cochable: true, itemId: '91010001' }, { id: 'notif-2', cochable: false }, { id: 'notif-3', cochable: true, itemId: '91010002' }] } });
    const lances = [];
    bg.ctx.favorisCarte = async (msg, sender) => { lances.push({ msg, sender }); return { ok: true }; };
    const issues = [];
    for (const c of cmds) { const d = c.data; issues.push(await bg.ctx.distanceExecuter(bg.ctx.adistCommande(d), d)); }
    const par = (cmd) => vus.find((m) => m.cmd === cmd) || {};
    dit(issues.every((i) => i && i.etat === 'fait'), 'background.js : les 8 gestes s\'exécutent (issue « fait »)', JSON.stringify(issues));
    dit(par('vacancesVinted').uid === A && par('vacancesVinted').vacances === true && par('creerVintedFiche').uid === A && par('creerVintedFiche').confirme === true,
      'vacances et brouillon : le chemin du clic existant, au nom du compte de la commande', JSON.stringify([par('vacancesVinted'), par('creerVintedFiche').uid]));
    dit(par('lbcPause').id === '2900000001' && par('lbcSupprime').confirme === true && par('lbcSupprime').sansRetour === true && par('lbcPublier').id === '91010001',
      'Leboncoin : pause, suppression (confirmée, sans retour), publication par leurs chemins', JSON.stringify([par('lbcPause'), par('lbcSupprime'), par('lbcPublier')]));
    dit(par('vcOffre').nego === '123456' && par('vcOffre').geste === 'contre' && par('vcOffre').prixCents === 9000 && par('vcOffreAimes').prixCents === 9000 && par('vcOffreAimes').avantCents === 10000,
      'Vestiaire : contre-offre et offre aux aimés par leurs chemins (recettes apprises), prix en centimes', JSON.stringify([par('vcOffre'), par('vcOffreAimes')]));
    const l = lances[0];
    dit(lances.length === 1 && l.msg.quoi === 'lancer' && l.msg.confirme === true && l.msg.uid === A && JSON.stringify(l.msg.selection) === '["notif-1"]' && l.msg.taux === 10 && /vinted\.fr/.test(l.sender.tab.url),
      'favoris : la file 5.440.1 lancée au nom du compte, SEULEMENT les favoris choisis ET cochables', JSON.stringify(l && l.msg));
    // Le tri de la file : un geste Leboncoin pour un compte qui n'est PAS celui de l'onglet n'est pas parti.
    const p = await bg.ctx.distPeutPartir(bg.ctx.adistCommande(cmds[4].data), [{ site: 'leboncoin', id: 'autre' }]);
    const p2 = await bg.ctx.distPeutPartir(bg.ctx.adistCommande(cmds[4].data), []);
    dit(p.attend === 'autre-compte' && p2.attend === 'absent', 'la file : supprimer sur un autre compte Leboncoin ou sans onglet ⇒ attend, rien ne part', JSON.stringify([p, p2]));
  } else dit(false, 'background.js : distanceExecuter (5.450) se charge dans le vm');

  // ── 5. Le panneau (ouvrirPanneau) est gardé ─────────────────────────────────────────────────────────────
  const ouverts = [], refus = [];
  global.window = { open: (u) => { ouverts.push(u); return {}; }, dispatchEvent: (e) => { refus.push(e); return true; }, location: { assign: (u) => ouverts.push(u) } };
  global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  try { Panneau = await import(path.join(SRC, 'ouvrirPanneau.js')); } catch (e) { Panneau = null; }
  Porte.poserFaitsAgir(F);
  if (Panneau) {
    Panneau.ouvrirPanneau({ site: 'vinted', compte: B, page: 'republier', ids: ['7002'], action: 'republier' });
    const nB = ouverts.length;
    Panneau.ouvrirPanneau({ site: 'vinted', compte: A, page: 'republier', ids: ['7001'], action: 'republier' });
    dit(nB === 0 && refus.length === 1 && refus[0].type === 'vrm:agir-refus' && ouverts.length === 1, 'ouvrirPanneau : B refusé (raison émise, rien ouvert), A ouvert', JSON.stringify({ nB, n: ouverts.length, refus: refus.length }));
    Porte.poserFaitsAgir(faits({ ext: Fd.ext, presences: [] }));
    Panneau.ouvrirPanneau({ site: 'vinted', page: 'automatisations' });
    dit(ouverts.length === 1, 'ouvrirPanneau sans extension ici : rien ne s\'ouvre (plus de lien vers le site en douce)');
  } else dit(false, 'ouvrirPanneau se charge');

  // ── 6. Les écrans : chaque bouton d'action passe par la porte ──────────────────────────────────────────
  const BE = sansCommentaires(lire('BoutonExtension.jsx'));
  dit((BE.match(/usePeutAgir\(/g) || []).length >= 2 && /if \(!v\.ok\)/.test(BE) && /indisponible raison=\{raison\}/.test(BE), 'BoutonExtension / RangeeExtension / FeuilleExtension : la porte, éteint et visible avec la raison');
  const OP = sansCommentaires(lire('ouvrirPanneau.js'));
  dit(/agirMaintenant\(/.test(OP) && /return null;/.test(OP), 'ouvrirPanneau : la porte (défense en profondeur)');
  const CPT = sansCommentaires(lire('ecrans/Comptabilite.jsx'));
  const LBC = sansCommentaires(lire('ecrans/MessagesLeboncoin.jsx'));
  const VC = sansCommentaires(lire('ecrans/Vestiaire.jsx'));
  dit(/<ComposerReponse site="vinted" compte=\{String\(openConv\.acc\?\.vinted_user_id/.test(CPT), 'Messages Vinted : répondre DEPUIS VRM, au nom du compte du fil');
  dit(/<GestesOffreVinted compte=\{String\(openConv\.acc\?\.vinted_user_id/.test(CPT), 'Messages Vinted : accepter / refuser / proposer DEPUIS VRM, au nom du compte du fil');
  dit(/<ComposerReponse site="leboncoin" compte=\{compteFil\}/.test(LBC), 'Messages Leboncoin : répondre DEPUIS VRM, au nom du compte du fil');
  dit(/<ComposerReponse site="vestiaire" compte=\{fil\.compte/.test(VC), 'Messages Vestiaire : répondre DEPUIS VRM, au nom du compte du fil');
  dit(!/action="repondre"/.test(CPT + LBC + VC), 'plus aucun « Répondre dans l\'extension » à la place du champ');
  dit(/republierAgir\(/.test(CPT) && (CPT.match(/republierAgir\(/g) || []).length >= 4, 'Annonces : Republier part DEPUIS VRM (fiche, sélection, dormantes, Actions)');
  dit(/<BadgeLectureSeule site="vinted" compte=\{g\.uid\}/.test(CPT), 'Messages : le badge « Lecture seule » par compte');
  // Aucun bouton d'action « nu » : chaque ouvrirPanneau / envoi passe par la porte (ouvrirPanneau est gardé lui-même).
  const AG = sansCommentaires(lire('agir/Agir.jsx'));
  dit(/usePeutAgir\(site, compte, 'repondre', 'file'\)/.test(AG) && /disabled=\{!v\.ok\}/.test(AG), 'le champ « Répondre » éteint (visible) quand la porte dit non');
  dit(/onClick=\{v\.ok \? onClick : undefined\}/.test(AG), 'BoutonAgir : un toucher éteint n\'appelle jamais le geste');
  // ── 5.450 (lot agir-tout) : les écrans qui envoient DEPUIS VRM ─────────────────────────────────────────────────
  const src = (r) => sansCommentaires(lire(r));
  const PP = src('PrixPartout.jsx'), OV = lire('OffresVestiaire.jsx'), AV = lire('AimesVestiaire.jsx'), RG = src('ecrans/Reglages.jsx'), AP = src('App.jsx'), AA = src('annoncesActions.js'), LB = src('ecrans/Leboncoin.jsx'), EG = src('ecrans/AnnoncesEgalite.jsx');
  dit(/agirMaintenant\(s\.site, s\.compte, 'baisser', 'file'\)/.test(PP) && /distGeste: 'prix'/.test(PP), 'Changer le prix : la baisse Vinted / Leboncoin / Vestiaire part par la file, au nom du compte de l\'annonce');
  dit(/<BaisseSerie /.test(CPT) && /envoyerSerie\('baisser', 'prix'/.test(sansCommentaires(lire('agir/BaisseSerie.jsx'))), 'Baisser en série : une commande `prix` par annonce');
  dit(/k: 'masquer'/.test(AA) && /k: 'afficher'/.test(AA) && /envoyerSerie\('masquer', k,/.test(CPT), 'Masquer / afficher sur Vinted depuis la sélection d\'annonces');
  dit(/pauseLbcAgir\(r,/.test(LB) && /supprimerLbcAgir\(r, \{ confirmer: askConfirm/.test(LB) && /publierLbcDepuisVrm\(/.test(LB) && /envoyerSerie\('pause', 'pause'/.test(EG), 'Leboncoin : pause, suppression (confirmée), publication depuis VRM');
  dit(/distGeste: 'offre'/.test(OV) && /distGeste: 'aimes'/.test(AV), 'Vestiaire : offres et offre aux aimés depuis VRM');
  dit(/<VacancesAgir comptes=/.test(RG) && /<CreerVintedAgir fiches=/.test(AP) && /distGeste: 'favoris'/.test(CPT), 'Vinted : vacances, créer un brouillon, envoyer aux favoris depuis VRM');
  dit(/<EbayLectureSeule compte=/.test(AP) && /action: 'status'/.test(AP), 'eBay : l\'état du jeton lu, lecture seule + « Reconnecter eBay »');
  const Fe = faits({ ebay: { principal: 'expire', autre: false } });
  const ve = P.peutAgir(Fe, { site: 'ebay', compte: 'principal', geste: 'x' }), vf = P.peutAgir(Fe, { site: 'ebay', compte: 'autre', geste: 'x' });
  dit(!ve.ok && ve.raison === 'ebay-expire' && ve.geste === 'reconnecter-ebay' && !vf.ok && vf.raison === 'ebay-jeton', 'eBay : jeton expiré ⇒ lecture seule + Reconnecter ; pas relié ⇒ lecture seule', JSON.stringify([ve, vf]));
  // Les textes : tr() dans les 5 langues, mêmes clés.
  const cles = (l) => { const s = lire(`i18n/langues/${l}/agir.js`); return new Set([...s.matchAll(/"(agir\.[^"]+)"/g)].map((m) => m[1])); };
  const fr = cles('fr');
  const manque = ['en', 'es', 'it', 'de'].flatMap((l) => [...fr].filter((k) => !cles(l).has(k)).map((k) => l + ':' + k));
  const raisons = new Set();
  const pa = sansCommentaires(lire('agir/peutAgir.js'));
  for (const m of pa.matchAll(/non\('([\w-]+)'/g)) if (!m[1].endsWith('-')) raisons.add('agir.raison.' + m[1]);
  for (const r of ['retard', 'maj', 'vrm', 'autre-vrm', 'muette', 'plusieurs', 'perime', 'autre']) raisons.add('agir.raison.nav-' + r);
  const sansTexte = [...raisons].filter((k) => !fr.has(k));
  dit(fr.size > 30 && !manque.length && !sansTexte.length, 'chaque raison a sa phrase, dans les 5 langues', [...manque, ...sansTexte].join(', '));
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
