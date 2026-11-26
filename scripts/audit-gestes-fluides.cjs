// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES GESTES RESTENT FLUIDES (17 nov., lot vitesse-cache)
//         node scripts/audit-gestes-fluides.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Julien, sur iPhone : « ouvrir une vente ça prend du temps, ça bug » ; « toute l'application doit être
// beaucoup plus fluide ». Mesuré au banc `scripts/bancs/latence-gestes.cjs` (390 tactile, ×4) puis corrigé ;
// chaque correction est JUGÉE ici, en exécutant le code quand il peut l'être :
//   O  l'anneau d'ondulation (src/design/ondulation.js) — EXÉCUTÉ sur un faux document : trois changements
//      d'espace n'insèrent qu'UN nœud sous <body> (une insertion réveille les `html:has(…)` : tout le document
//      restylé, 2,5 à 4,2 s mesurés au ×4) ; aucune lecture de mise en page forcée (`offsetWidth`) ; chaque
//      changement est compté (`data-sb-onde` avance) et rejoue l'animation ; mouvement réduit : aucun anneau ;
//   H  l'histoire des N° gardée entre deux fiches (src/histoireGardee.js) — EXÉCUTÉE : gardée seulement
//      complète ; périmée dès qu'une donnée change (génération) ou au-delà de 10 min ; « pas su » jamais gardé ;
//      et src/App.jsx ne la jette plus à la fermeture de la fiche (elle est oubliée seulement périmée, AVANT
//      d'être relue) ;
//   V  une vente Vinted de « Toutes » (Ventes) ouvre SA fiche par son n° de transaction (`attrsFicheLigne`
//      avec `tx`), au lieu de redessiner tout l'écran Vinted.
// `--prouve` : chaque mutation affaiblit une règle ; l'audit doit devenir ROUGE.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTS = {
  'anneau-reinsere': ['src/design/ondulation.js', 'if (anneau && anneau.isConnected) return anneau;', ''],
  'mise-en-page-forcee': ['src/design/ondulation.js', "    clearTimeout(main.__sbEntree);\n", "    clearTimeout(main.__sbEntree); void main.offsetWidth;\n"],
  'generation-ignoree': ['src/histoireGardee.js', '  if (q.gen !== gen) return false;\n', ''],
  'pas-su-garde': ['src/histoireGardee.js', 'q.complet === true', 'q.complet !== undefined'],
  'jetee-a-la-fermeture': ['src/App.jsx', 'useEffect(()=>{ if(!besoinNumData){ if(!numData) return undefined;', 'useEffect(()=>{ if(!besoinNumData){ setNumData(null); return undefined; } if(!besoinNumData){ if(!numData) return undefined;'],
  'toutes-vers-ecran': ['src/App.jsx', '{...ficheToutes(l)} ', ''],
};
const muter = (k) => { const [f, a, b] = MUTS[k]; const t = fs.readFileSync(path.join(R, f), 'utf8'); if (!t.includes(a)) throw new Error('mutation introuvable : ' + k); return [f, t.replace(a, b)]; };

if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestes-mut-'));
    for (const f of ['src/design/ondulation.js', 'src/histoireGardee.js', 'src/App.jsx']) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); if (fs.existsSync(path.join(R, f))) fs.copyFileSync(path.join(R, f), path.join(dir, f)); }
    const [f, t] = muter(k); fs.writeFileSync(path.join(dir, f), t);
    let code = 0; try { execFileSync(process.execPath, [__filename], { stdio: 'pipe', env: { ...process.env, AUDIT_RACINE: dir } }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${n}/${Object.keys(MUTS).length} mutations attrapées`);
  process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return null; } };
// Les commentaires retirés avant de chercher (§6.4) : une phrase qui cite le code ne compte pas.
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gestes-'));
  // ── O : l'anneau ──
  console.log('O — l’anneau d’ondulation');
  const srcO = lire('src/design/ondulation.js');
  if (!srcO) dit(false, 'O src/design/ondulation.js existe');
  else {
    let insertions = 0, lecturesForcees = 0, rejoues = 0, reduit = false;
    const anim = (nom) => ({ animationName: nom, cancel() {}, play() { rejoues++; } });
    const el = (tag) => { const attrs = {}; const e = { tagName: tag, style: {}, className: '', isConnected: false, __anims: [],
      setAttribute(k, v) { attrs[k] = String(v); if (k === 'data-sb-entree') e.__anims = [anim('sb-entree')]; }, getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs, removeAttribute(k) { delete attrs[k]; },
      getAnimations() { return e.__anims; }, remove() { e.isConnected = false; },
      getBoundingClientRect: () => ({ left: 100, top: 780, width: 60, height: 40 }) };
      Object.defineProperty(e, 'offsetWidth', { get() { lecturesForcees++; return 390; } });
      return e; };
    const main = el('MAIN');
    const corps = { appendChild(n) { insertions++; n.isConnected = true; n.__anims = [anim('sb-onde')]; return n; } };
    global.document = { body: corps, createElement: el, querySelector: () => main };
    global.window = { innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: reduit }), requestIdleCallback: (f) => f() };
    global.setTimeout = (f) => 0; global.clearTimeout = () => {};
    const fic = path.join(tmp, 'ondulation.mjs'); fs.writeFileSync(fic, srcO);
    const M = await import(pathToFileURL(fic).href + '?v=' + Math.random());
    const onglet = el('SPAN');
    for (let i = 0; i < 3; i++) M.onduler(onglet, main);
    const anneau = [...[main]].length && (() => { let x = null; try { x = corps.__dernier; } catch (_) {} return x; })();
    dit(insertions === 1, 'O1 trois changements d’espace : UN seul nœud inséré sous <body> (plus de recalcul de tout le document à chaque toucher)', `${insertions} insertion(s)`);
    dit(lecturesForcees === 0, 'O2 aucune mise en page forcée au toucher (offsetWidth)', `${lecturesForcees} lecture(s)`);
    dit(rejoues >= 2, 'O3 chaque changement rejoue l’animation de l’anneau (Web Animations)', `${rejoues} rejeu(x)`);
    dit(typeof M.preparerOndulation === 'function', 'O4 l’anneau peut être posé d’avance, au repos (`preparerOndulation`)');
    reduit = true; insertions = 0;
    const M2 = await import(pathToFileURL(fic).href + '?w=' + Math.random());
    M2.onduler(onglet, main); M2.preparerOndulation && M2.preparerOndulation();
    dit(insertions === 0, 'O5 mouvement réduit : aucun anneau', `${insertions} insertion(s)`);
    void anneau;
  }
  // ── H : l'histoire des N° gardée ──
  console.log('H — l’histoire des N° gardée entre deux fiches');
  const srcH = lire('src/histoireGardee.js');
  if (!srcH) dit(false, 'H src/histoireGardee.js existe (l’histoire n’est gardée nulle part)');
  else {
    let gen = 7;
    fs.writeFileSync(path.join(tmp, 'ecransGardes.mjs'), `export const AGE_MAX_CACHE_MS = 600000; export const generationDonnees = () => globalThis.__gen;`);
    fs.writeFileSync(path.join(tmp, 'histoireGardee.mjs'), srcH.replace(/from '\.\/ecransGardes\.jsx'/, "from './ecransGardes.mjs'"));
    globalThis.__gen = gen;
    const H = await import(pathToFileURL(path.join(tmp, 'histoireGardee.mjs')).href);
    const t = 5_000_000;
    const q = { gen, at: t, complet: true };
    dit(H.numDataFrais(q, t + 60000, gen) === true, 'H1 complète, même génération, 1 min : gardée');
    dit(H.numDataFrais(q, t + 60000, gen + 1) === false, 'H2 une donnée a changé depuis (génération) : périmée');
    dit(H.numDataFrais(q, t + 600000, gen) === false, 'H3 au-delà de 10 min : périmée');
    dit(H.numDataFrais({ ...q, complet: false }, t + 1000, gen) === false && H.numDataGardable({ gen, at: t }) === false, 'H4 une lecture incomplète (« pas su ») n’est jamais gardée');
    dit(H.numDataFrais(null, t, gen) === false && H.numDataFrais({ ...q, at: t + 5000 }, t, gen) === false, 'H5 rien de lu, ou une date dans le futur : pas fraîche');
  }
  const app = lire('src/App.jsx');
  const a = app ? sansCommentaires(app) : '';
  const eff = a.indexOf('useEffect(()=>{ if(!besoinNumData)');
  const corpsEff = eff >= 0 ? a.slice(eff, eff + 600) : '';
  dit(eff >= 0 && !/if\(!besoinNumData\)\{\s*setNumData\(null\);\s*return undefined;/.test(corpsEff) && /numDataFrais\(/.test(corpsEff) && /setNumData\(null\)/.test(corpsEff),
    'H6 App.jsx : la fiche fermée ne jette plus l’histoire ; périmée, elle est oubliée AVANT d’être relue', corpsEff.slice(0, 160).replace(/\s+/g, ' '));
  // ── V : une vente Vinted de « Toutes » ouvre SA fiche ──
  console.log('V — une vente Vinted de « Toutes » ouvre sa fiche');
  const iV = a.indexOf('function VentesToutes(');
  const corpsV = iV >= 0 ? a.slice(iV, a.indexOf('\nfunction ', iV + 10)) : '';
  const def = /const ficheToutes = \(l\) => \(l\.site === 'vinted' && l\.id \? attrsFicheLigne\(\{[^}]*contexte: 'vente'[^}]*tx: l\.id[^}]*\}\)/.test(corpsV);
  // (24 nov., main-vert) La refonte native : les lignes sont rendues par `VentesListeTel` (src/natif/ecrans/VentesTableau.jsx),
  // qui pose `attrsDe(l)` sur la rangée ; chaque appel lui passe `ficheToutes(l)` et ouvre par `ouvrirToutes`.
  const appelsTel = [...corpsV.matchAll(/<VentesListeTel\b/g)].map((m) => corpsV.slice(m.index, m.index + 900));
  const tel = sansCommentaires(lire('src/natif/ecrans/VentesTableau.jsx') || '');
  const iTel = tel.indexOf('export function VentesListeTel(');
  const corpsTel = iTel >= 0 ? tel.slice(iTel, tel.indexOf('\nexport function ', iTel + 10)) : '';
  const pose = /className="vrm-toutes-ligne"[^>]*\{\.\.\.ficheToutes\(l\)\}/.test(corpsV)
    || (appelsTel.length > 0 && appelsTel.every((t) => /attrsDe=\{\(l\) => (?:ficheToutes\(l\)|\(\{ \.\.\.ficheToutes\(l\))/.test(t) && /onOuvrir=\{ouvrirToutes\}/.test(t))
      && /attrs=\{\{[^\n]*\.\.\.attrsDe\(l\) \}\}/.test(corpsTel) && /onClick=\{onOuvrir \? \(\) => onOuvrir\(l\) : null\}/.test(corpsTel));
  dit(def && pose, 'V1 la ligne Vinted porte l’identité de SA vente (`attrsFicheLigne`, contexte vente, n° de transaction) — jamais le titre', `définie ${def} · posée ${pose}`);
  dit(/onClick=\{\(\) => \{ if \(!ficheToutes\(l\)\['data-fiche-ligne'\]\) onOuvrir\(l\); \}\}/.test(corpsV)
    || (appelsTel.length > 0 && /const ouvrirToutes = \(l\) => \{ const a = ficheToutes\(l\); if \(a\['data-fiche-ligne'\]\) \{[^\n]*ouvrirLigne\(x\); return; \} onOuvrir\(l\); \};/.test(corpsV)), 'V2 le toucher d’une vente Vinted ne redessine plus l’écran Vinted (Leboncoin, Vestiaire, eBay : leur écran, comme avant)');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\naudit-gestes-fluides : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
