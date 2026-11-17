// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : CHANGER D'ONGLET RESTE RAPIDE (17 nov. — Julien, sur iPhone : « beaucoup trop long entre les
//         onglets, c'est catastrophique »)        node scripts/audit-onglets-rapides.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré au banc `scripts/bancs/onglets-rapides.cjs` (390 tactile, ×4, chaque paire d'onglets), trace Chrome
// à l'appui ; les deux causes sont JUGÉES ici :
//   O  l'anneau d'ondulation (src/design/ondulation.js) — EXÉCUTÉ sur un faux document : trois changements
//      d'espace n'insèrent qu'UN nœud sous <body> (une insertion réveille les `html:has(…)` de la feuille : tout
//      le document restylé, 2,5 à 4,2 s au ×4 dans l'image qui suit le toucher) ; aucune mise en page forcée ;
//      chaque changement compté et rejoué ; mouvement réduit : aucun anneau ;
//   K  les écrans gardés (src/ecransGardes.jsx) ne sont plus remontés par la publication « À trancher » que
//      chaque écran réécrit en passant (`vrm_a_trancher` parmi les clés neutres) — et son seul lecteur l'écoute
//      en direct (`useATrancher` : `vrm:save`), sinon un écran gardé la montrerait périmée.
// `--prouve` : chaque mutation affaiblit une règle ; l'audit doit devenir ROUGE.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTS = {
  'anneau-reinsere': ['src/design/ondulation.js', 'if (anneau && anneau.isConnected) return anneau;', ''],
  'mise-en-page-forcee': ['src/design/ondulation.js', "    clearTimeout(main.__sbEntree);\n", "    clearTimeout(main.__sbEntree); void main.offsetWidth;\n"],
  'a-trancher-perime': ['src/ecransGardes.jsx', ", 'vrm_reprise_ecrans', 'vrm_a_trancher'];", ", 'vrm_reprise_ecrans'];"],
  'lecteur-fige': ['src/App.jsx', "if (k === CLE_A_TRANCHER) setPubs(lirePubs());", "if (false) setPubs(lirePubs());"],
  'en-vol-oublie': ['src/lectureEnVol.js', '  enVol.set(k, p);\n', ''],
  'en-vol-garde': ['src/lectureEnVol.js', 'const fin = () => { if (enVol.get(k) === p) enVol.delete(k); };', 'const fin = () => {};'],
  'reserves-en-direct': ['src/App.jsx', "        lireEnVol('panel_num_reserves', () => lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_num_reserves&select=data`)),", '        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_num_reserves&select=data`),'],
  'autre-lecteur-fige': ['src/SanteDonnees.jsx', "if (k === CLE_A_TRANCHER || k === CLE_SANTE) relire();", "if (k === CLE_SANTE) relire();"],
};
const muter = (k) => { const [f, a, b] = MUTS[k]; const t = fs.readFileSync(path.join(R, f), 'utf8'); if (!t.includes(a)) throw new Error('mutation introuvable : ' + k); return [f, t.replace(a, b)]; };

if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onglets-mut-'));
    for (const f of ['src/design/ondulation.js', 'src/ecransGardes.jsx', 'src/App.jsx', 'src/SanteDonnees.jsx', 'src/aTrancher.js', 'src/lectureEnVol.js']) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); if (fs.existsSync(path.join(R, f))) fs.copyFileSync(path.join(R, f), path.join(dir, f)); }
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'onglets-'));
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
  // ── K : les écrans gardés ne remontent plus pour « À trancher » ──
  console.log('K — les écrans gardés et la publication « À trancher »');
  const g = lire('src/ecransGardes.jsx'); const gs = g ? sansCommentaires(g) : '';
  const m = /export const CLES_NEUTRES = \[([^\]]*)\]/.exec(gs);
  const neutres = m ? m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  dit(neutres.includes('vrm_a_trancher'), 'K1 la publication « À trancher » ne rend aucun écran gardé périmé (clé neutre)', neutres.join(', '));
  const app = lire('src/App.jsx'); const a = app ? sansCommentaires(app) : '';
  const lecteurs = (a.match(/lirePubsTrancher\(/g) || []).length;
  const iU = a.indexOf('function useATrancher('); const u = iU >= 0 ? a.slice(iU, iU + 1400) : '';
  dit(lecteurs === 1 && /addEventListener\('vrm:save', f\)/.test(u) && /if \(k === CLE_A_TRANCHER\) setPubs\(lirePubs\(\)\)/.test(u),
    'K2 son seul lecteur (`useATrancher`) l’écoute en direct : un écran gardé qui la montre se met à jour à son retour', `${lecteurs} lecteur(s)`);
  // Tout AUTRE fichier qui lit les publications doit, lui aussi, les écouter en direct (`vrm:save` sur la clé).
  const lecteursAilleurs = []; const figes = [];
  const pas = (p) => { for (const f of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, f.name); if (f.isDirectory()) pas(q); else if (/\.(jsx?|mjs)$/.test(f.name) && !/aTrancher\.js$|App\.jsx$|ecransGardes\.jsx$/.test(f.name)) { const t = sansCommentaires(fs.readFileSync(q, 'utf8')); if (/lirePublications|vrm_a_trancher/.test(t)) { lecteursAilleurs.push(path.relative(R, q)); if (!(/addEventListener\('vrm:save'/.test(t) && /k === CLE_A_TRANCHER/.test(t))) figes.push(path.relative(R, q)); } } } };
  try { pas(path.join(R, 'src')); } catch (_) {}
  dit(!figes.length, 'K3 tout autre lecteur l’écoute aussi en direct (un lecteur figé la montrerait périmée)', (lecteursAilleurs.join(', ') || 'aucun') + (figes.length ? ' — figés : ' + figes.join(', ') : ''));
  // ── L : une lecture en vol par ligne (`panel_num_reserves` lue 5 fois à l'ouverture d'Achats) ──
  console.log('L — une lecture en vol par ligne');
  const srcL = lire('src/lectureEnVol.js');
  if (!srcL) dit(false, 'L src/lectureEnVol.js existe');
  else {
    const ec = {}; global.window = { addEventListener: (t, f) => { (ec[t] = ec[t] || []).push(f); } };
    fs.writeFileSync(path.join(tmp, 'lectureEnVol.mjs'), srcL);
    const E = await import(pathToFileURL(path.join(tmp, 'lectureEnVol.mjs')).href + '?v=' + Math.random());
    let n = 0; const lent = () => new Promise((r) => { n++; setTimeout(() => r([{ data: { n } }]), 5); });
    global.setTimeout = (f, ms) => { const t = require('timers'); return t.setTimeout(f, ms); };
    const [x, y, z] = await Promise.all([E.lireEnVol('r', lent), E.lireEnVol('r', lent), E.lireEnVol('r', lent)]);
    dit(n === 1 && x === y && y === z, 'L1 trois lecteurs pendant le vol : UNE lecture, la même réponse', `${n} lecture(s)`);
    await E.lireEnVol('r', lent);
    dit(n === 2, 'L2 le vol arrivé, la lecture suivante repart au serveur (rien gardé au-delà)', `${n} lecture(s)`);
    n = 0; const p1 = E.lireEnVol('r', lent); (ec['vrm:ext'] || []).forEach((f) => f()); const p2 = E.lireEnVol('r', lent); await Promise.all([p1, p2]);
    dit(n === 2, 'L3 un signal de l’extension pendant le vol : la lecture suivante repart', `${n} lecture(s)`);
    n = 0; let r1 = 'x'; try { await E.lireEnVol('k', () => { n++; return Promise.reject(new Error('panne')); }); } catch (_) { r1 = 'rejet'; }
    await E.lireEnVol('k', () => { n++; return null; });
    dit(r1 === 'rejet' && n === 2, 'L4 un échec est rendu, jamais gardé', `${n} lecture(s)`);
  }
  const appL = lire('src/App.jsx'); const aL = appL ? sansCommentaires(appL) : '';
  const directes = (aL.match(/id=eq\.panel_num_reserves&select=data/g) || []).length;
  const enVolL = (aL.match(/lireEnVol\('panel_num_reserves', \(\) => lireBaseRelue\(`\$\{SUPABASE_URL\}\/rest\/v1\/app_data\?id=eq\.panel_num_reserves&select=data`\)\)/g) || []).length;
  dit(directes >= 1 && enVolL === directes, 'L5 App.jsx : chaque lecture de `panel_num_reserves` passe par la lecture en vol partagée', `${enVolL}/${directes}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\naudit-onglets-rapides : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
