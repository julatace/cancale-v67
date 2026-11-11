#!/usr/bin/env node
// ── audit-centre-aide — LE CENTRE D'AIDE INTÉGRÉ (11 nov., lot centre-aide) ──
// Exécute les VRAIES règles (src/aideFiches.js, src/aideAnimations.js) et lit
// la coque (src/App.jsx) et Réglages. Exige :
//   1. au moins 40 fiches, ids uniques, 1 à 3 étapes courtes (≤ 12 mots par phrase) ;
//   2. chaque « M'y emmener » mène à un écran QUI EXISTE ET EST MONTÉ : onglet des
//      liens (`ONGLETS_LIENS`), résolu par `redirigerOnglet` + `ONGLETS_DEPLACES`
//      vers un onglet rendu (`tab==='…'` + `<GardeEcran`) ; `site`, `vue`,
//      `reglage` (un panneau de Réglages qui existe) et la feuille (écoutée par la
//      coque) valides ;
//   3. chaque écran principal a son aide : questions, gestes, une animation (une
//      scène par geste, 3 à 5 s, cibles qui existent) et 3 à 5 fiches, en Simple
//      comme en Complet, sneakers comme autre ;
//   4. adapté au vendeur : pour un « autre », aucun « paire »/« chaussure » ni
//      accord faux (« la article ») ; aucun gabarit {…} oublié ;
//   5. recherche tolérante : accents, fautes, pluriels, petits mots ; chaque
//      fiche se retrouve par sa propre question ; « zzzz » ne trouve rien ;
//   6. rien d'imposé, rien de payant : aucune feuille ouverte au départ, `vrm:aide`
//      n'est émis que sur un clic, l'animation respecte « réduire les animations »,
//      aucune requête réseau dans les fiches.
//   node scripts/audit-centre-aide.cjs [--mutation=NOM | --prouve]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');

// [fichier relatif, avant, après] — chaque défaut remis exprès : il faut du ROUGE.
const MUTATIONS = {
  'lien-mort': ['src/aideFiches.js', "aller: { lien: '?tab=semaine' }", "aller: { lien: '?tab=semaine_perdue' }"],
  'reglage-inconnu': ['src/aideFiches.js', "aller: { lien: '?tab=settings&reglage=vacances' }", "aller: { lien: '?tab=settings&reglage=conges' }"],
  'sans-accents': ['src/aideFiches.js', ".normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()", '.toLowerCase()'],
  'sans-fautes': ['src/aideFiches.js', 'const fautesPermises = (w) => (w.length >= 9 ? 2 : w.length >= 4 ? 1 : 0);', 'const fautesPermises = () => 0;'],
  'scene-manquante': ['src/aideAnimations.js', "{ cible: 'depot', geste: 'tap' }, ", ''],
  'paire-pour-autre': ['src/aideFiches.js', "['Chaque paire', 'Chaque article'], ['chaque paire', 'chaque article'], ", ''],
  'reglage-ignore': ['src/App.jsx', "if(t==='settings'&&rg&&REGLAGES_AIDE.includes(rg))", "if(false)"],
  'ouverte-seule': ['src/composants/AideEcran.jsx', 'const [ouvert, setOuvert] = React.useState(null);', "const [ouvert, setOuvert] = React.useState({ cle: 'journee', fiche: null, q: '' });"],
  'mouvement-force': ['src/composants/AideAnimation.jsx', "window.matchMedia('(prefers-reduced-motion: reduce)').matches", 'false'],
  'feuille-pas-montee': ['src/aideFiches.js', "aller: { lien: '?tab=settings', feuille: 'vrm:visite' }", "aller: { lien: '?tab=settings', feuille: 'vrm:tout-imprimer' }"],
};
const FICHIERS = ['src/aideFiches.js', 'src/aideAnimations.js', 'src/aideEtapes.js', 'src/aideEcrans.js', 'src/profilVendeur.js', 'src/navigationTache.js', 'src/argent.js', 'src/App.jsx', 'src/ecrans/Reglages.jsx', 'src/composants/AideEcran.jsx', 'src/composants/AideAnimation.jsx', 'src/composants/aide-ecran.css'];

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
const racineArg = (arg.find((a) => a.startsWith('--racine=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0; const noms = Object.keys(MUTATIONS);
  for (const m of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✓ rouge' : '✗ VERT '} · mutation ${m}`);
    if (rouge) ok++;
  }
  console.log(`\n${ok}/${noms.length} mutations rouges`);
  process.exit(ok === noms.length ? 0 : 1);
}

let verts = 0, rouges = 0;
const dit = (c, m) => { if (c) { verts++; console.log('  ✓ ' + m); } else { rouges++; console.log('  ✗ ' + m); } };

(async () => {
  const SRC = racineArg ? path.resolve(racineArg) : RAC;
  // Une copie des fichiers (mutée si demandé), importée telle quelle.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-aide-'));
  for (const f of FICHIERS) {
    const de = path.join(SRC, f);
    if (!fs.existsSync(de)) continue;
    let t = fs.readFileSync(de, 'utf8');
    if (mut && MUTATIONS[mut] && MUTATIONS[mut][0] === f) {
      if (!t.includes(MUTATIONS[mut][1])) { console.log('mutation introuvable : ' + mut); process.exit(3); }
      t = t.split(MUTATIONS[mut][1]).join(MUTATIONS[mut][2]);
    }
    fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
    fs.writeFileSync(path.join(tmp, f), t);
  }
  const lire = (f) => { try { return fs.readFileSync(path.join(tmp, f), 'utf8'); } catch (_) { return ''; } };
  const imp = (f) => import(pathToFileURL(path.join(tmp, f)).href);
  let A, AN, ET, AE, NAV, ARG;
  try {
    A = await imp('src/aideFiches.js'); AN = await imp('src/aideAnimations.js'); ET = await imp('src/aideEtapes.js');
    AE = await imp('src/aideEcrans.js'); NAV = await imp('src/navigationTache.js'); ARG = await imp('src/argent.js');
  } catch (e) { console.log('✗ les modules ne se chargent pas : ' + e.message); process.exit(1); }
  const app = lire('src/App.jsx'), reg = lire('src/ecrans/Reglages.jsx'), ae = lire('src/composants/AideEcran.jsx'), anim = lire('src/composants/AideAnimation.jsx'), css = lire('src/composants/aide-ecran.css');
  const { FICHES_AIDE, ECRANS_AIDE, FEUILLES_AIDE, REGLAGES_AIDE, fichesPour, fichesEcran, chercherAide, pourVendeur, MOTS_MAX_ETAPE, ETAPES_MAX, emmener } = A;

  console.log('1. Les fiches');
  dit(FICHES_AIDE.length >= 40, `${FICHES_AIDE.length} fiches (au moins 40)`);
  const ids = FICHES_AIDE.map((f) => f.id);
  dit(new Set(ids).size === ids.length, 'ids uniques');
  const phrasesLongues = [];
  for (const f of FICHES_AIDE) {
    const nb = f.etapes.length;
    if (!(nb >= 1 && nb <= ETAPES_MAX)) phrasesLongues.push(f.id + ' : ' + nb + ' étapes');
    for (const t of [f.q, ...f.etapes]) for (const ph of String(t).split(/[.!?:]\s/)) { const n = ph.trim().split(/\s+/).filter(Boolean).length; if (n > 12 || n > MOTS_MAX_ETAPE) phrasesLongues.push(f.id + ' : « ' + ph + ' »'); }
  }
  dit(!phrasesLongues.length, 'questions et étapes courtes (≤ 12 mots par phrase, 1–3 étapes)' + (phrasesLongues.length ? ' — ' + phrasesLongues.slice(0, 3).join(' | ') : ''));

  console.log('2. « M\'y emmener » mène à un écran monté');
  const mLiens = app.match(/const ONGLETS_LIENS=\[([^\]]*)\]/);
  const liens = new Set(mLiens ? [...mLiens[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : []);
  if (mLiens && mLiens[1].includes('Object.keys(CHEMINS_ARGENT)')) Object.keys(ARG.CHEMINS_ARGENT).forEach((k) => liens.add(k));
  const mDepl = app.match(/const ONGLETS_DEPLACES = \{([\s\S]*?)\n\};/);
  let DEPL = {};
  try { DEPL = new Function('CHEMINS_ARGENT', 'return {' + mDepl[1].replace(/\/\/[^\n]*/g, '') + '};')(ARG.CHEMINS_ARGENT); } catch (e) { dit(false, 'ONGLETS_DEPLACES lisible : ' + e.message); }
  const montes = new Set();
  for (const l of app.split('\n')) if (/<GardeEcran nom=/.test(l)) for (const x of l.matchAll(/tab===\s*'([a-z_]+)'/g)) montes.add(x[1]);
  dit(liens.size > 20 && montes.size > 15, `${liens.size} onglets de liens, ${montes.size} onglets montés lus dans la coque`);
  const VUES = ['achats', 'retraits', 'favoris', 'republier'];
  const morts = [];
  const idsReglages = new Set([...reg.matchAll(/\{ ?id: ?'([a-zA-Z_]+)', ?type: ?'(?:panneau|el|nav|action)'/g)].map((x) => x[1]));
  for (const f of FICHES_AIDE) {
    const a = f.aller || {};
    if (typeof a.lien !== 'string' || !a.lien.startsWith('?tab=')) { morts.push(f.id + ' : pas de lien'); continue; }
    const p = new URLSearchParams(a.lien);
    const t = p.get('tab'), site = p.get('site'), vue = p.get('vue'), rg = p.get('reglage');
    if (!liens.has(t)) { morts.push(f.id + ' : onglet inconnu ' + t); continue; }
    const sub = site || null;
    if (site && !(NAV.estTacheSite(t) && NAV.siteDeTache(t, site) === site)) morts.push(f.id + ' : site refusé ' + site);
    const fin = NAV.redirigerOnglet(t, sub, DEPL).tab;
    if (!montes.has(fin)) morts.push(`${f.id} : ${t} ⇒ ${fin} jamais monté`);
    if (vue && !VUES.includes(vue)) morts.push(f.id + ' : vue inconnue ' + vue);
    if (rg) {
      if (t !== 'settings' || !REGLAGES_AIDE.includes(rg)) morts.push(f.id + ' : reglage hors liste ' + rg);
      else if (rg !== 'abonnement' && !idsReglages.has(rg)) morts.push(f.id + ' : panneau de Réglages absent ' + rg);
    }
    if (a.feuille) {
      if (!FEUILLES_AIDE.includes(a.feuille)) morts.push(f.id + ' : feuille hors liste ' + a.feuille);
      else if (!app.includes(`addEventListener('${a.feuille}'`)) morts.push(f.id + ' : personne n’écoute ' + a.feuille);
    }
  }
  dit(!morts.length, 'chaque fiche mène à un écran qui existe' + (morts.length ? ' — ' + morts.slice(0, 4).join(' | ') : ''));
  // Les feuilles de la liste sont écoutées par la coque (montée tout le temps), pas par un écran à la demande.
  const feuillesCoque = FEUILLES_AIDE.filter((e) => { const i = app.indexOf(`addEventListener('${e}'`); return i > 0 && !reg.includes(`addEventListener('${e}'`); });
  dit(feuillesCoque.length === FEUILLES_AIDE.length, 'les feuilles ouvertes par « M\'y emmener » sont écoutées par la coque');
  dit(/const rg=p\.get\('reglage'\); if\(t==='settings'&&rg&&REGLAGES_AIDE\.includes\(rg\)\)\{ DEMANDE_REGLAGE_SOUS\.id=rg;/.test(app), 'la coque ouvre le panneau `reglage=` (liste fermée)');
  dit(/if\(id==='abonnement'\)\{ setVueBrute\('abonnement'\)/.test(reg) && /\['appareils','double','equipe'\]\.includes\(id\)\?'compte':'reglages'/.test(reg), 'Réglages sert l’abonnement et les panneaux de « Compte »');
  const envois = []; const ok = emmener(FICHES_AIDE.find((f) => f.aller.feuille), { envoyer: (n, d) => envois.push([n, d]), plusTard: (fn) => fn() });
  dit(ok && envois.length === 2 && envois[0][0] === 'vrm:aller' && envois[0][1].startsWith('?tab=') && FEUILLES_AIDE.includes(envois[1][0]), 'emmener : le chemin des liens, puis la feuille');
  dit(emmener({ aller: { lien: 'https://exemple.fr' } }, { envoyer: () => envois.push(1) }) === false, 'emmener refuse un lien qui n’est pas `?tab=`');

  console.log('3. Chaque écran principal a son aide');
  const noms = (ae.match(/export const NOMS_ECRANS_AIDE = \{([\s\S]*?)\};/) || [, ''])[1];
  const clesNoms = [...noms.matchAll(/([a-z_]+): '/g)].map((x) => x[1]);
  dit(JSON.stringify([...clesNoms].sort()) === JSON.stringify([...ECRANS_AIDE].sort()) && ECRANS_AIDE.every((k) => AE.AIDE_ECRANS[k]), `${ECRANS_AIDE.length} écrans : un nom, des questions (Ma journée, Annonces, Ventes, Achats, Stock, Messages, Argent, Paramètres…)`);
  const pbs = [];
  const profils = [['sneakers', 'complet'], ['sneakers', 'simple'], ['autre', 'complet'], ['autre', 'simple']];
  for (const k of ECRANS_AIDE) {
    const et = ET.ETAPES_ECRANS[k], an = AN.ANIMATIONS_ECRANS[k];
    if (!Array.isArray(et) || et.length < 3 || et.length > 5) pbs.push(k + ' : gestes');
    if (!an) { pbs.push(k + ' : pas d’animation'); continue; }
    if (an.scenes.length !== (et || []).length) pbs.push(`${k} : ${an.scenes.length} scènes pour ${(et || []).length} gestes`);
    const d = AN.dureeBoucle(an); if (d < 3000 || d > 5000) pbs.push(k + ' : boucle de ' + d + ' ms');
    const idsEl = new Set(an.elements.map((e) => e.id));
    if (idsEl.size !== an.elements.length) pbs.push(k + ' : éléments en double');
    for (const s of an.scenes) { if (!idsEl.has(s.cible)) pbs.push(k + ' : cible absente ' + s.cible); if (!AN.GESTES_ANIM.includes(s.geste)) pbs.push(k + ' : geste ' + s.geste); if (s.geste === 'tape' && !s.texte) pbs.push(k + ' : tape sans texte'); }
    for (const e of an.elements) if (e.x < 0 || e.y < 0 || e.x + e.w > AN.LARGEUR || e.y + e.h > AN.HAUTEUR) pbs.push(k + ' : ' + e.id + ' déborde');
    for (const [v, m] of profils) { const n = fichesEcran(fichesPour({ vend: v, mode: m }), k).length; if (n < 3 || n > 5) pbs.push(`${k} (${v}, ${m}) : ${n} fiches`); }
  }
  dit(!pbs.length, 'gestes, animation (une scène par geste, 3–5 s), 3 à 5 fiches par écran et par profil' + (pbs.length ? ' — ' + pbs.slice(0, 4).join(' | ') : ''));
  dit(/<AideAnimation cle=\{cle\} onEtape=\{setEtape\}\/>\s*\{\/\*[^]*?\*\/\}\s*\{etapes\.length \? \(\s*<ol className="vrm-aide-etapes" data-aide-etapes=\{etapes\.length\}>/.test(ae), 'la feuille : l’animation, puis les gestes allumés');
  dit(/data-aide-emmener=\{f\.id\}>M’y emmener</.test(ae) && /<input type="search" value=\{q\} onChange=\{\(e\) => setQ\(e\.target\.value\)\} placeholder="Comment faire… \?"/.test(ae), 'la feuille : « Comment faire… ? » et « M’y emmener »');

  console.log('4. Adapté au vendeur');
  const textes = (v) => [...fichesPour({ vend: v }).flatMap((f) => [f.q, ...f.etapes]),
    ...ECRANS_AIDE.flatMap((k) => [...(ET.ETAPES_ECRANS[k] || []), ...AE.AIDE_ECRANS[k].questions.flat()]).map((t) => pourVendeur(t, v))];
  const autre = textes('autre');
  const restes = autre.filter((t) => /\b(paires?|chaussures?)\b/i.test(t) || /\b(la|une|cette|bonne|mauvaise) article/i.test(t) || /\{\w+\}/.test(t));
  dit(!restes.length, `vendeur « autre » : aucun « paire », aucun accord faux (${autre.length} textes)` + (restes.length ? ' — ' + restes.slice(0, 2).join(' | ') : ''));
  dit(!textes('sneakers').some((t) => /\{\w+\}/.test(t) || /\barticles?\b/.test(t) && /paire/.test(t)), 'vendeur de sneakers : les mots de Julien, aucun gabarit oublié');
  dit(fichesPour({ vend: 'autre' }).some((f) => f.id === 'annonces-taille') && !fichesPour({ vend: 'sneakers' }).some((f) => f.id === 'annonces-taille')
    && fichesPour({ vend: 'sneakers' }).some((f) => f.id === 'annonces-identiques') && !fichesPour({ vend: 'autre' }).some((f) => f.id === 'annonces-identiques'), 'une fiche réservée à un genre de vendeur ne sort que pour lui');
  const simple = fichesPour({ mode: 'simple' });
  dit(ECRANS_AIDE.every((k) => !fichesEcran(simple, k).some((f) => f.avance)) && chercherAide(simple, 'republier').some((f) => f.id === 'annonces-republier'), 'Simple : l’écran tait les fiches avancées, la recherche les trouve');

  console.log('5. Recherche tolérante');
  const F = fichesPour({ vend: 'sneakers' });
  const ATTENDU = [['imprimer bordereau', 'colis-bordereau'], ['Comment imprimer un bordreau ?', 'colis-bordereau'], ['j’imprime une étiquette', 'colis-bordereau'], ['IMPRIMÉ BORDEREAUX', 'colis-bordereau'],
    ['ursaf', 'argent-urssaf'], ['déclarer à l’URSSAF', 'argent-urssaf'], ['mode sombre', 'reglages-apparence'], ['resilier abonement', 'reglages-abonnement'], ['vacance', 'reglages-vacances'],
    ['importer excel', 'achats-tableur'], ['retirer un colis', 'colis-retirer'], ['installer l extension', 'reglages-extension'], ['ou est rangee ma paire', 'stock-trouver'], ['gmail', 'reglages-email']];
  const rates = ATTENDU.filter(([q, id]) => { const r = chercherAide(F, q); return !r.length || r[0].id !== id; }).map(([q, id]) => `${q} ⇒ ${(chercherAide(F, q)[0] || {}).id || 'rien'} (voulu ${id})`);
  dit(!rates.length, `${ATTENDU.length} requêtes (accents, fautes, pluriels, petits mots) ⇒ la bonne fiche en premier` + (rates.length ? ' — ' + rates.slice(0, 3).join(' | ') : ''));
  const perdues = F.filter((f) => !chercherAide(F, f.q, { max: 3 }).some((x) => x.id === f.id)).map((f) => f.id);
  dit(!perdues.length, 'chaque fiche se retrouve par sa propre question' + (perdues.length ? ' — ' + perdues.slice(0, 4).join(', ') : ''));
  dit(chercherAide(F, 'zzzz qwxv').length === 0 && chercherAide(F, 'comment je').length === 0, 'du charabia ou des petits mots seuls ne trouvent rien');
  dit(/fichesGs\.map/.test(app) && /data-recherche-groupe="aide"/.test(app) && /\{q && blocAide\}/.test(app), 'la loupe universelle a son groupe « Comment faire »');

  console.log('6. Rien d’imposé, rien de payant');
  const src = lire('src/aideFiches.js') + lire('src/aideAnimations.js') + anim;
  dit(!/\bfetch\s*\(|XMLHttpRequest|\/api\/|anthropic|openai/i.test(src), 'aucune requête réseau, aucune IA (§2.9)');
  dit(/export function CentreAide[\s\S]*?const \[ouvert, setOuvert\] = React\.useState\(null\);/.test(ae) && /const \[vue, setVue\] = React\.useState\(null\);/.test(ae), 'aucune feuille d’aide ouverte au départ');
  const emissions = [...app.matchAll(/dispatchEvent\(new CustomEvent\('vrm:aide'/g)].map((m) => app.slice(Math.max(0, m.index - 400), m.index));
  dit(emissions.length >= 1 && emissions.every((av) => /onClick=\{\(\)=>\{[^}]*$/.test(av.replace(/\n/g, ' '))), '`vrm:aide` n’est émis que sur un clic');
  dit(/prefers-reduced-motion: reduce\)'\)\.matches/.test(anim) && /if \(!anim \|\| immobile \|\| pause\) return undefined;/.test(anim) && /@media \(prefers-reduced-motion: reduce\)[^}]*\.vrm-aa-doigt/.test(css), '« réduire les animations » : rien ne bouge');
  dit(/aria-label=\{pause \? 'Relancer l’animation' : 'Mettre l’animation en pause'\}/.test(anim), 'l’animation se met en pause');

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${verts} verts, ${rouges} rouges`);
  process.exit(rouges ? 1 : 0);
})();
