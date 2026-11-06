// ════════════════════════════════════════════════════════════════════════════
//  « Jamais `select=data` sur une ligne lourde » (§4.4) — les FICHES DE PAGE
//  (`vinted_item_details`) et les COMMANDES (`harvest_*_orders_*`).
//
//  Mesuré le 6 nov. sur sa base (lecture seule, `pg_column_size`) :
//  `vinted_item_details` pèse ~349 Ko de texte (281 fiches, dont 278 Ko d'adresses
//  de photos) et était lue ENTIÈRE à trois endroits pour ~60 fiches ; les
//  commandes (~2,1 Mo) étaient lues en `select=data` / `select=id,data` pour TOUS
//  les comptes jamais captés, `orders_bought` compris, puis filtrées dans l'app.
//
//  Ce que ce contrôle juge :
//   1. dans `src/` et `api/` (commentaires retirés), aucune adresse qui vise ces
//      lignes ne demande la ligne entière : un `select=` dont un élément est
//      `data` (ou `alias:data`) ou `*`. Une constante (`select=${SEL}`) est
//      résolue dans son fichier ; une constante introuvable est un ROUGE (on ne
//      juge pas ce qu'on ne voit pas) ;
//   2. la règle qui rebâtit une ligne de commandes projetée (`ligneCommandes`)
//      est EXÉCUTÉE : la date de capture (`harvestTs`), la marque « vidée par
//      toi » (`ligneVideeParToi`) et la liste des commandes sont les mêmes que
//      sur la ligne entière.
//  `--prouve` remet chacun des défauts d'avant (quatre mutations) et exige du ROUGE.
//  Lancer : node scripts/audit-lectures-lourdes.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');

function fichiers() {
  const out = [];
  const marche = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) marche(p);
      else if (/\.(jsx?|mjs|cjs)$/.test(e.name)) out.push(p);
    }
  };
  for (const d of ['src', 'api']) if (fs.existsSync(path.join(RACINE, d))) marche(path.join(RACINE, d));
  return out;
}

// Retire les commentaires sans toucher aux chaînes (un `//` dans une adresse reste).
function sansCommentaires(t) {
  let o = '', i = 0, q = null;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (q) { o += c; if (c === '\\') { o += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; o += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const f = t.indexOf('*/', i + 2); const bloc = t.slice(i, f < 0 ? t.length : f + 2); o += bloc.replace(/[^\n]/g, ' '); i = f < 0 ? t.length : f + 2; continue; }
    o += c; i++;
  }
  return o;
}

const VISE = (ligne) => /vinted_item_details/.test(ligne) || /harvest_[^'"`\s]*_orders_/.test(ligne) || /_orders_(?:sold|purchased|bought|\$\{)/.test(ligne);

// Les `select=` d'une ligne, constantes résolues dans le fichier.
function selects(ligne, texte) {
  const out = [];
  const re = /select=((?:\$\{[^}]*\}|[^&'"`\s)])*)/g; let m;
  while ((m = re.exec(ligne))) {
    let v = m[1];
    let inconnue = null;
    v = v.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (x, nom) => {
      const d = new RegExp('(?:const|let|var)\\s+' + nom.replace(/\$/g, '\\$') + "\\s*=\\s*(['\"`])([^'\"`]*)\\1").exec(texte);
      if (!d) { inconnue = nom; return ''; }
      return d[2];
    });
    // Une expression (`${l.map(cle).join(',')}`) n'est pas une constante : on la
    // juge par ce qu'elle fabrique, plus bas (la fonction `cle` est lue à part).
    if (/\$\{/.test(v)) v = v.replace(/\$\{[^}]*\}/g, '');
    out.push({ brut: m[1], valeur: v, inconnue });
  }
  return out;
}
const entier = (v) => v.split(',').some((x) => /^(?:[^:]+:)?(?:data|\*)$/.test(x.trim()));

function juger(contenus) {
  const fautes = [];
  for (const [f, brut] of contenus) {
    const t = sansCommentaires(brut);
    const lignes = t.split('\n');
    lignes.forEach((l, i) => {
      if (!VISE(l)) return;
      for (const s of selects(l, t)) {
        if (s.inconnue) fautes.push(`${path.relative(RACINE, f)}:${i + 1} — select=\${${s.inconnue}} : constante introuvable dans le fichier`);
        else if (entier(s.valeur)) fautes.push(`${path.relative(RACINE, f)}:${i + 1} — select=${s.brut} (${s.valeur}) lit la ligne entière`);
      }
    });
  }
  return fautes;
}

// 2. `ligneCommandes`, exécutée.
function extraire(t, re) { const m = re.exec(t); return m ? m[0] : null; }
function executer(app) {
  const fautes = [];
  const lc = extraire(app, /function ligneCommandes\(r\) \{[\s\S]*?\n\}/);
  const ht = extraire(app, /const harvestTs = \(row\) => \{[\s\S]*?\n\};/);
  const lv = extraire(app, /const ligneVideeParToi = [^\n]*;/);
  if (!lc || !ht || !lv) return ['ligneCommandes / harvestTs / ligneVideeParToi introuvables dans src/App.jsx'];
  // eslint-disable-next-line no-new-func
  const f = new Function(`${lc}\n${ht}\n${lv}\nreturn { ligneCommandes, harvestTs, ligneVideeParToi };`)();
  const projeter = (row) => ({ id: row.id, updated_at: row.updated_at, cap: row.data && row.data.capturedAt != null ? String(row.data.capturedAt) : null,
    supprime: row.data && row.data.supprime !== undefined ? row.data.supprime : null, payload: row.data && row.data.payload !== undefined ? row.data.payload : null });
  const cas = [
    { id: 'harvest_1_orders_sold', updated_at: '2026-01-01T00:00:00Z', data: { capturedAt: '2026-11-05T10:00:00Z', nItems: 2, payload: { my_orders: [{ transaction_id: 1 }, { transaction_id: 2 }], pagination: { total_entries: 2 } } } },
    { id: 'harvest_1_orders_purchased', updated_at: '2026-01-01T00:00:00Z', data: { supprime: true, purgedAt: '2026-11-01T00:00:00Z' } },
    { id: 'harvest_2_orders_sold', updated_at: '2026-02-01T00:00:00Z', data: { payload: { my_orders: [] } } },
  ];
  for (const row of cas) {
    const p = f.ligneCommandes(projeter(row));
    const ts = (r) => { const v = f.harvestTs(r); return Number.isNaN(v) ? 'NaN' : v; };
    if (ts(p) !== ts(row)) fautes.push(`${row.id} : la date de capture change (${ts(p)} ≠ ${ts(row)})`);
    if (f.ligneVideeParToi(p) !== f.ligneVideeParToi(row)) fautes.push(`${row.id} : « vidée par toi » change`);
    if (JSON.stringify((p.data && p.data.payload) || null) !== JSON.stringify((row.data && row.data.payload) || null)) fautes.push(`${row.id} : la liste des commandes change`);
  }
  return fautes;
}

function verifier(contenus) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!process.env.SILENCE) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  const fautes = juger(contenus);
  dit(fautes.length === 0, 'aucune lecture ENTIÈRE de vinted_item_details ni des commandes (src/, api/)', fautes.slice(0, 8).join(' | ') + (fautes.length > 8 ? ` … (+${fautes.length - 8})` : ''));
  const app = (contenus.find(([f]) => /src[\\/]App\.jsx$/.test(f)) || [])[1] || '';
  const fiches = /const lireFichesPage = /.test(app) && /data->\$\{encodeURIComponent\('"' \+ id \+ '"'\)\}/.test(app);
  dit(fiches, 'les fiches de page se lisent une par clé (`lireFichesPage`, `data->"<id>"`)');
  let ex = [];
  try { ex = executer(app); } catch (e) { ex = [String(e && e.message || e)]; }
  dit(ex.length === 0, 'une ligne de commandes projetée garde sa date, sa marque « vidée » et ses commandes (`ligneCommandes`, exécutée)', ex.join(' | '));
  return ko;
}

const contenus = fichiers().map((f) => [f, fs.readFileSync(f, 'utf8')]);
let ko = verifier(contenus);
if (process.argv.includes('--prouve')) {
  console.log('\n── mutations (chacune doit être ROUGE)');
  const app = contenus.find(([f]) => /src[\\/]App\.jsx$/.test(f));
  const MUT = [
    ['la lecture par compte redevient `select=id,data`', (t) => t.replace(/(_orders_[^\n]*?)select=\$\{SEL_COMMANDES\}/, '$1select=id,data,updated_at,cap:data->>capturedAt')],
    ['la constante des commandes redemande `data`', (t) => t.replace(/const SEL_COMMANDES = '[^']*'/, "const SEL_COMMANDES = 'id,data,updated_at,cap:data->>capturedAt'")],
    ['les fiches de page relues entières', (t) => t.replace(/(id=eq\.vinted_item_details&select=)\$\{l\.map\(cle\)\.join\(','\)\}/, '$1data')],
    ['« Le prix qui marche » relit `select=data`', (t) => t.replace(/(harvest_\*_orders_sold&select=)mo:data->payload->my_orders/, '$1data')],
    ['`ligneCommandes` perd la marque « vidée »', (t) => t.replace(/if \(r\.supprime != null\) data\.supprime = r\.supprime;/, '')],
  ];
  for (const [nom, mut] of MUT) {
    const avant = app[1]; const apres = mut(avant);
    if (apres === avant) { console.log(`  ❌ mutation « ${nom} » : rien à muter (le code a changé ?)`); ko++; continue; }
    process.env.SILENCE = '1';
    const r = verifier(contenus.map(([f, c]) => (f === app[0] ? [f, apres] : [f, c])));
    delete process.env.SILENCE;
    console.log((r > 0 ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » : ${r > 0 ? 'ROUGE' : 'reste VERTE'}`);
    if (!r) ko++;
  }
}
console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
process.exit(ko ? 1 : 0);
