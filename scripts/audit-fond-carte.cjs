// AUDIT « FOND DE CARTE » — sans clé (21 octobre), plus professionnel (22 octobre)
// 21 oct. : « trouve autre chose pour la carte, il y a besoin d'une API key » ⇒
// OpenFreeMap (sans clé, sans inscription, usage commercial permis), dessiné par
// MapLibre chargé À LA DEMANDE. 22 oct. : « une carte plus professionnelle » ⇒
// les styles SOBRES d'OpenFreeMap (positron clair, dark sombre), les noms des
// lieux en français, un fond qui ne tombe pas sur UNE tuile ratée, et toujours
// UN seul domaine de carte (celui que la CSP prépare et que la politique de
// confidentialité nomme).
// Ce contrôle porte la règle sur le CODE (commentaires retirés : ils citent les
// anciens fonds) ET l'EXÉCUTE (src/fondCarte.js importé pour de vrai) :
//   1. aucune adresse CARTO / tile.openstreetmap.org dans src/, aucune adresse
//      d'un AUTRE fournisseur de carte dans le fond (VersaTiles, MapTiler…) ;
//   2. les styles sont ceux d'OpenFreeMap : positron (clair), dark (sombre) ;
//      l'attribution exigée (OpenFreeMap · OpenMapTiles · OpenStreetMap) est
//      ajoutée seulement si la source ne la porte pas — jamais doublée ;
//   3. les noms en français (`name:fr` d'abord, sinon le nom d'origine), sur les
//      VRAIS styles d'OpenFreeMap quand ils sont joignables, évalués par le
//      moteur d'expressions de MapLibre ; les numéros de route intacts ;
//   4. le fond est « dessiné » seulement quand au moins UNE tuile est arrivée ;
//      une tuile isolée en erreur ne fait pas tomber la carte, une source
//      injoignable si, une police manquante non, rien du tout ⇒ délai ;
//   5. Leaflet est retiré ; MapLibre n'est jamais importé au démarrage (et, si
//      dist/ existe, aucun morceau chargé par index.html ne le contient).
// `--prouve` réaffaiblit la règle (sept mutations du fond) : chacune doit
// repasser au ROUGE.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

function controles(fond, { muet = false } = {}) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!muet) console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  return { dit, ko: () => ko };
}

// ── Les VRAIS styles d'OpenFreeMap (commit épinglé), sinon un extrait réel ────
const STYLES_SHA = '6e5361286c3e1eac7b7c89800ff63218297b5cfd';
function vraisStyles() {
  const dir = path.join(process.env.BANC_CARTE_DIR || path.join(os.tmpdir(), 'vrm-carte-banc-v2'), 'styles', STYLES_SHA);
  const out = {};
  for (const s of ['positron', 'dark']) {
    const f = path.join(dir, s + '.json');
    if (!fs.existsSync(f)) {
      try { fs.mkdirSync(dir, { recursive: true }); execFileSync('curl', ['-sS', '-f', '-m', '20', '-o', f, `https://raw.githubusercontent.com/hyperknot/openfreemap-styles/${STYLES_SHA}/styles/${s}/style.json`], { stdio: 'ignore' }); } catch (_) { try { fs.unlinkSync(f); } catch (__) {} }
    }
    try { out[s] = JSON.parse(fs.readFileSync(f, 'utf8').split('__TILEJSON_DOMAIN__').join('tiles.openfreemap.org')); } catch (_) {}
  }
  return out;
}
// Extrait RÉEL (positron, commit ci-dessus) : une étiquette de pays et un numéro de route.
const EXTRAIT = { version: 8, sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } }, layers: [
  { id: 'label_country_1', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': ['case', ['has', 'name:nonlatin'], ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']], ['coalesce', ['get', 'name_en'], ['get', 'name']]], 'text-font': ['Noto Sans Bold'] } },
  { id: 'highway-shield-non-us', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', layout: { 'text-field': ['to-string', ['get', 'ref']], 'text-font': ['Noto Sans Regular'] } },
] };

// ── Une fausse carte MapLibre : les évènements que poserFond écoute ──────────
function fausseCarte(script, { attributionSource = '' } = {}) {
  const h = {};
  const carte = {
    styleRecu: null,
    on(t, f) { (h[t] = h[t] || []).push(f); },
    off(t, f) { h[t] = (h[t] || []).filter((x) => x !== f); },
    fire(t, e) { for (const f of [...(h[t] || [])]) f(e); },
    getSource(k) { return { attribution: attributionSource, id: k }; },
    setStyle(s) { carte.styleRecu = s; let i = 0; const pas = () => { if (i >= script.length) return; const [t, e] = script[i++]; carte.fire(t, e); setTimeout(pas, 2); }; setTimeout(pas, 2); },
  };
  return carte;
}
const STYLE_MIN = (attrib) => JSON.stringify({ version: 8, sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: attrib } }, layers: [{ id: 'eau', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' }] });
const TUILE = ['sourcedata', { sourceId: 'openmaptiles', tile: {}, dataType: 'source' }];
const ERR_TUILE = ['error', { sourceId: 'openmaptiles', tile: {}, error: new Error('500') }];
const ERR_SOURCE = ['error', { sourceId: 'openmaptiles', error: new Error('TileJSON 503') }];
const ERR_POLICE = ['error', { error: new Error('glyphs 404') }];
const IDLE = ['idle', {}];
const ATTR_OFM = '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

async function executer(src, { dit }, { styles }) {
  const tmp = path.join(os.tmpdir(), 'vrm-audit-fond-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.mjs');
  fs.writeFileSync(tmp, src);
  let F;
  try { F = await import(pathToFileURL(tmp).href); } catch (e) { dit(false, 'src/fondCarte.js se charge', String(e && e.message)); return; } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0]); } };

  await essaie('styles', async () => {
    dit(F.styleCarte(false) === 'https://tiles.openfreemap.org/styles/positron' && F.styleCarte(true) === 'https://tiles.openfreemap.org/styles/dark', 'les styles sont les styles SOBRES d’OpenFreeMap : positron (clair), dark (sombre)', F.styleCarte(false) + ' · ' + F.styleCarte(true));
    const mots = (F.ATTRIBUTIONS_EXIGEES || []).map(([m]) => m).join(',');
    dit(/OpenFreeMap/.test(mots) && /OpenMapTiles/.test(mots) && /OpenStreetMap/.test(mots), 'l’attribution exigée porte OpenFreeMap · OpenMapTiles · OpenStreetMap', mots);
  });

  // ── 3. Les noms en français, évalués par le moteur d'expressions de MapLibre
  await essaie('noms', async () => {
    let ss = null; try { ss = require(path.join(R, 'node_modules', '@maplibre', 'maplibre-gl-style-spec')); } catch (_) {}
    dit(!!ss, 'le moteur d’expressions de MapLibre (@maplibre/maplibre-gl-style-spec) est là pour juger les noms');
    if (!ss) return;
    const spec = ss.latest.layout_symbol['text-field'];
    const evaluer = (tf, props) => { const r = ss.createPropertyExpression(tf, 'text-field', spec); if (r.result !== 'success') throw new Error('expression refusée : ' + JSON.stringify(r.value).slice(0, 120)); return String(r.value.evaluate({ zoom: 5 }, { type: 1, properties: props })); };
    const ALL = { name: 'Deutschland', name_en: 'Germany', 'name:latin': 'Deutschland', 'name:fr': 'Allemagne', ref: 'A7' };
    const SANS = { name: 'Deutschland', name_en: 'Germany', 'name:latin': 'Deutschland', ref: 'A7' };
    const jeux = Object.keys(styles).length ? Object.entries(styles) : [['extrait réel positron', EXTRAIT]];
    if (!Object.keys(styles).length) console.log('   (vrais styles OpenFreeMap injoignables : extrait réel de positron utilisé)');
    for (const [nom, s] of jeux) {
      const fr = F.enFrancais(s);
      const noms = fr.layers.filter((l) => l.layout && Array.isArray(l.layout['text-field']) && JSON.stringify(s.layers.find((x) => x.id === l.id).layout['text-field']).includes('"name'));
      const refs = fr.layers.filter((l) => l.layout && Array.isArray(l.layout['text-field']) && !JSON.stringify(s.layers.find((x) => x.id === l.id).layout['text-field']).includes('"name'));
      let fautes = [];
      for (const l of noms) {
        if (evaluer(l.layout['text-field'], ALL) !== 'Allemagne') fautes.push(l.id + '→' + evaluer(l.layout['text-field'], ALL));
        const orig = s.layers.find((x) => x.id === l.id).layout['text-field'];
        if (evaluer(l.layout['text-field'], SANS) !== evaluer(orig, SANS)) fautes.push(l.id + ' sans name:fr ≠ origine');
      }
      dit(noms.length > 0 && fautes.length === 0, `${nom} : ${noms.length} étiquettes de NOM en français (« Allemagne », pas « Germany ») ; sans name:fr, le nom d’origine`, fautes.slice(0, 3).join(' · '));
      const touchees = refs.filter((l) => JSON.stringify(l.layout['text-field']) !== JSON.stringify(s.layers.find((x) => x.id === l.id).layout['text-field']));
      dit(refs.length === 0 || touchees.length === 0, `${nom} : les numéros de route (« ${refs.length ? evaluer(refs[0].layout['text-field'], ALL) : '—'} ») ne sont pas touchés`, touchees.map((l) => l.id).join(' '));
      if (ss.validateStyleMin && fr.glyphs) { const err = ss.validateStyleMin(F.aplatir(fr)); dit(err.length === 0, `${nom} : le style réécrit reste un style valide pour MapLibre`, err.slice(0, 2).map((e) => e.message).join(' · ')); }
    }
  });

  // ── lireStyle : forme refusée, réécriture appliquée
  await essaie('lireStyle', async () => {
    const vrai = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(EXTRAIT)) });
      const s = await F.lireStyle('https://tiles.openfreemap.org/styles/positron', 1000);
      dit(JSON.stringify(s.layers[0].layout['text-field']).includes('name:fr') && s.projection && s.projection.type === 'mercator', 'le style lu est rendu plat (mercator) et en français');
      globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
      let refuse = false; try { await F.lireStyle('x', 1000); } catch (_) { refuse = true; }
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ erreur: 'page html' }) });
      let refuse2 = false; try { await F.lireStyle('x', 1000); } catch (_) { refuse2 = true; }
      dit(refuse && refuse2, 'un style injoignable ou qui n’est pas un style est refusé (⇒ la liste, jamais une carte grise)');
    } finally { globalThis.fetch = vrai; }
  });

  // ── 4. Quand le fond est-il « dessiné » ? (fausse carte, vrais évènements)
  const poser = async (script, { attrib = ATTR_OFM, delaiMs = 400, annule, style } = {}) => {
    const vrai = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, json: async () => (style ? JSON.parse(JSON.stringify(style)) : JSON.parse(STYLE_MIN(attrib))) });
    const carte = fausseCarte(script, { attributionSource: attrib });
    try { const r = await F.poserFond(carte, { sombre: false, delaiMs, annule }); return { ok: true, r, carte }; }
    catch (e) { return { ok: false, e: String(e && e.message), carte }; }
    finally { globalThis.fetch = vrai; }
  };
  await essaie('poserFond', async () => {
    let x = await poser([IDLE, ERR_TUILE, ERR_TUILE, IDLE]);
    dit(!x.ok, 'un « idle » avant toute tuile ne vaut pas « dessiné » : toutes les tuiles en erreur ⇒ échec (la liste)', JSON.stringify(x.ok ? x.r : x.e));
    x = await poser([IDLE, TUILE, IDLE]);
    dit(x.ok && x.r.id === 'openfreemap', 'une tuile arrivée puis « idle » ⇒ le fond est dessiné', JSON.stringify(x.ok ? x.r : x.e));
    x = await poser([ERR_TUILE, TUILE, TUILE, IDLE]);
    dit(x.ok, 'UNE tuile en erreur, les autres arrivées ⇒ la carte reste (pas de repli liste pour une tuile)', JSON.stringify(x.ok ? x.r : x.e));
    x = await poser([ERR_SOURCE, IDLE]);
    dit(!x.ok && x.e === 'source', 'la source injoignable (TileJSON) ⇒ échec tout de suite', JSON.stringify(x.ok ? x.r : x.e));
    x = await poser([ERR_POLICE, TUILE, IDLE]);
    dit(x.ok, 'une police ou une icône manquante ne fait pas tomber le fond', JSON.stringify(x.ok ? x.r : x.e));
    x = await poser([], { delaiMs: 60 });
    dit(!x.ok && x.e === 'delai', 'rien du tout ⇒ échec au bout du délai (jamais une attente sans fin)', JSON.stringify(x.ok ? x.r : x.e));
    x = await poser([TUILE, IDLE], { annule: () => true });
    dit(!x.ok && x.e === 'annule', 'écran fermé ou thème changé ⇒ on s’arrête', JSON.stringify(x.ok ? x.r : x.e));
    x = await poser([TUILE, IDLE], { style: EXTRAIT });
    dit(x.ok && JSON.stringify(x.carte.styleRecu.layers[0].layout['text-field']).includes('name:fr') && x.carte.styleRecu.projection.type === 'mercator', 'la carte reçoit le style RÉÉCRIT (plat, noms en français), pas le style brut', JSON.stringify(x.ok ? (x.carte.styleRecu.layers[0].layout || {})['text-field'] : x.e).slice(0, 90));
    // Attribution : jamais doublée, jamais absente.
    x = await poser([TUILE, IDLE]);
    dit(x.ok && x.r.attribution === '', 'la TileJSON porte déjà les trois mentions ⇒ rien n’est ajouté (jamais deux fois)', JSON.stringify(x.ok ? x.r.attribution : x.e));
    x = await poser([TUILE, IDLE], { attrib: '<a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
    dit(x.ok && /OpenFreeMap/.test(x.r.attribution) && !/OpenStreetMap|OpenMapTiles/.test(x.r.attribution), 'il manque OpenFreeMap ⇒ seule cette mention est ajoutée', JSON.stringify(x.ok ? x.r.attribution : x.e));
    x = await poser([TUILE, IDLE], { attrib: '' });
    dit(x.ok && /OpenFreeMap/.test(x.r.attribution) && /OpenMapTiles/.test(x.r.attribution) && /openstreetmap\.org\/copyright/.test(x.r.attribution), 'la source muette ⇒ les trois mentions sont ajoutées', JSON.stringify(x.ok ? x.r.attribution : x.e));
  });
}

(async () => {
  const c = controles();
  const { dit } = c;
  const fichiers = [];
  (function marche(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) marche(p); else if (/\.(jsx?|css|html)$/.test(f)) fichiers.push(p); } })(path.join(R, 'src'));
  fichiers.push(path.join(R, 'index.html'));
  const fautifs = [], autres = [];
  const AUTRES_FONDS = /versatiles\.org|api\.maptiler\.com|stadiamaps\.com|api\.mapbox\.com|tiles\.stadiamaps|arcgisonline\.com|basemaps\.cartocdn|protomaps\.com/;
  for (const f of fichiers) {
    const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
    t.split('\n').forEach((l, i) => {
      if (/cartocdn\.com|tile\.openstreetmap\.org/.test(l)) fautifs.push(path.relative(R, f) + ':' + (i + 1));
      if (AUTRES_FONDS.test(l)) autres.push(path.relative(R, f) + ':' + (i + 1));
    });
  }
  dit(fautifs.length === 0, 'aucune adresse de tuiles CARTO ni tile.openstreetmap.org dans le code de l’app', fautifs.slice(0, 4).join(' '));
  dit(autres.length === 0, 'aucun AUTRE fournisseur de carte (un seul domaine : tiles.openfreemap.org)', autres.slice(0, 4).join(' '));
  const fond = path.join(R, 'src', 'fondCarte.js');
  const srcFond = fs.existsSync(fond) ? fs.readFileSync(fond, 'utf8') : '';
  const hotes = [...new Set([...sansCommentaires(srcFond).matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()))];
  const PERMIS = new Set(['tiles.openfreemap.org', 'openfreemap.org', 'www.openmaptiles.org', 'www.openstreetmap.org']);
  dit(hotes.length > 0 && hotes.every((h) => PERMIS.has(h)), 'src/fondCarte.js ne nomme que tiles.openfreemap.org (et les liens d’attribution)', hotes.join(' '));

  // Leaflet retiré, MapLibre à la demande.
  const pkg = JSON.parse(fs.readFileSync(path.join(R, 'package.json'), 'utf8'));
  const dep = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const leaflet = fichiers.filter((f) => /from\s*['"](leaflet|@maplibre\/maplibre-gl-leaflet)['"]|import\(\s*['"](leaflet|@maplibre\/maplibre-gl-leaflet)/.test(sansCommentaires(fs.readFileSync(f, 'utf8'))));
  dit(!dep.leaflet && !dep['@maplibre/maplibre-gl-leaflet'] && leaflet.length === 0, 'Leaflet est retiré (paquet et imports) : la carte est MapLibre seul', leaflet.map((f) => path.relative(R, f)).join(' '));
  const statiques = [];
  for (const f of fichiers) {
    if (f === fond) continue;
    const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
    if (/^\s*import\s[^(]*from\s*['"]maplibre-gl['"]/m.test(t)) statiques.push(path.relative(R, f));
  }
  dit(statiques.length === 0, 'MapLibre n’est importé statiquement nulle part (chargé à la demande)', statiques.join(' '));
  const app = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
  dit(!/^\s*import\s[^(]*from\s*['"]\.\/fondCarte\.js['"]/m.test(app), 'App.jsx charge src/fondCarte.js à la demande (jamais au démarrage)');

  const styles = vraisStyles();
  await executer(srcFond, c, { styles });

  const dist = path.join(R, 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
    const lourds = refs.filter((r) => { try { return /maplibre|tiles\.openfreemap/.test(fs.readFileSync(path.join(dist, r), 'utf8')); } catch (_) { return false; } });
    dit(refs.length > 0 && lourds.length === 0, 'aucun morceau chargé au démarrage ne contient MapLibre', lourds.join(' '));
  } else console.log('(dist/ absent : le contrôle du build est sauté)');

  let ko = c.ko();
  if (PROUVE) {
    console.log('\n── --prouve : la règle réaffaiblie doit repasser au ROUGE');
    const MUT = [
      ['idle sans tuile vaut « dessiné »', 'if (tuilesOk > 0) fin();', 'fin();'],
      ['une tuile en erreur fait tomber la carte', "if (e.tile) tuilesKo++; else fin(new Error('source'));", "fin(new Error('source'));"],
      ['une police manquante fait tomber la carte', 'if (!e || !sources.has(e.sourceId)) return;', 'if (!e) return; if (!e.sourceId) return fin(new Error(\'police\'));'],
      ['plus de noms en français', "return { ...l, layout: { ...l.layout, 'text-field': ['coalesce', ['get', 'name:fr'], tf] } };", 'return l;'],
      ['les numéros de route traduits aussi', "if (!Array.isArray(tf) || !litUnNom(tf)) return l;", 'if (!Array.isArray(tf)) return l;'],
      ['attribution ajoutée même quand la source la porte', "return ATTRIBUTIONS_EXIGEES.filter(([mot]) => !t.includes(mot)).map(([, html]) => html).join(' ');", "return ATTRIBUTIONS_EXIGEES.map(([, html]) => html).join(' ');"],
      ['le style coloré « liberty » revient', "clair: 'https://tiles.openfreemap.org/styles/positron'", "clair: 'https://tiles.openfreemap.org/styles/liberty'"],
    ];
    let prouvees = 0;
    for (const [nom, de, vers] of MUT) {
      if (!srcFond.includes(de)) { console.log('❌ mutation « ' + nom + ' » : le texte visé n’existe plus'); ko++; continue; }
      const m = controles(null, { muet: true });
      await executer(srcFond.replace(de, vers), m, { styles });
      if (m.ko() > 0) { prouvees++; console.log(`✅ mutation « ${nom} » ⇒ ${m.ko()} contrôle(s) rouge(s)`); }
      else { ko++; console.log(`❌ mutation « ${nom} » : TOUT reste vert — le contrôle ne la voit pas`); }
    }
    console.log(`${prouvees}/${MUT.length} mutations attrapées.`);
  }
  console.log(ko ? `\n${ko} contrôle(s) rouge(s).` : '\nLe fond de carte est sans clé, sobre, en français, d’un seul domaine, et chargé à la demande.');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit n’a pas pu finir : ' + (e && e.stack || e)); process.exit(1); });
