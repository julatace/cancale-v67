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
//   3. (6 nov., vitesse 2) les DRESSINGS (`harvest_*_listings`) et les lignes
//      d'un compte lues par `fetchHarvest` (`harvest_${uid}_${type}`) : jamais
//      entières non plus (le 1. les vise aussi) ; la recherche, « Tout sur le N° »,
//      Leboncoin et « Le prix qui marche » passent par `lireDressings`, EXÉCUTÉE :
//      comptes donnés ⇒ `id=in.(…)`, réponse vide ⇒ relue par motif (§4.1),
//      « pas su » ⇒ `null`, comptes écartés ⇒ `id=not.in.(…)` ;
//   4. la cloche « où ranger », le registre des achats et l'export lisent les
//      achats des comptes LIÉS (`lireAchatsLies`, EXÉCUTÉE, mêmes règles), plus
//      la famille `harvest_*_orders_purchased` de tous les comptes.
//  `--prouve` remet chacun des défauts d'avant (une mutation par défaut) et exige du ROUGE.
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

const VISE = (ligne) => /vinted_item_details/.test(ligne) || /harvest_[^'"`\s]*_orders_/.test(ligne) || /_orders_(?:sold|purchased|bought|\$\{)/.test(ligne)
  || /harvest_[^'"`\s]*_listings/.test(ligne) || /harvest_\$\{uid\}_\$\{type\}/.test(ligne) || /select=\$\{SEL_(?:MOISSON|COMMANDES)\}/.test(ligne);

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

// 3-4. `lireDressings` et `lireAchatsLies`, exécutées sur une fausse base qui note
// les adresses demandées et rend ce qu'on lui dit.
function executerDressings(app) {
  const fautes = [];
  const lc = extraire(app, /function ligneCommandes\(r\) \{[\s\S]*?\n\}/);
  const sm = extraire(app, /const SEL_MOISSON = '[^']*';/);
  const idd = extraire(app, /const idsDressings = [^\n]*;/);
  const ld = extraire(app, /async function lireDressings\([\s\S]*?\n\}/);
  const la = extraire(app, /async function lireAchatsLies\([\s\S]*?\n\}/);
  if (!lc || !sm || !idd || !ld || !la) return ['ligneCommandes / SEL_MOISSON / idsDressings / lireDressings / lireAchatsLies introuvables'];
  if (/(?:^|[,\s])data(?:,|'|$)/.test(sm.replace(/data->[^,']*/g, '').replace(/^const SEL_MOISSON = '/, ''))) fautes.push('SEL_MOISSON redemande data');
  // eslint-disable-next-line no-new-func
  const mk = new Function('lireTout', `${lc}\n${sm}\n${idd}\n${ld}\n${la}\nreturn { lireDressings, lireAchatsLies };`);
  const ligne = { id: 'harvest_11_listings', updated_at: 'x', cap: '2026-11-06T10:00:00Z', supprime: null, payload: { items: [{ id: 1 }] } };
  const base = (rep) => { const vus = []; return { vus, lire: async (q) => { vus.push(decodeURIComponent(q)); return rep(q, vus.length); } }; };
  return (async () => {
    // a) comptes donnés : une lecture `id=in.`, projetée, rebâtie
    { const b = base(() => [ligne]); const f = mk(async () => null);
      const r = await f.lireDressings(b.lire, { uids: ['11', '22'] });
      if (!(b.vus.length === 1 && /id=in\.\(harvest_11_listings,harvest_22_listings\)/.test(b.vus[0]) && !/like/.test(b.vus[0]))) fautes.push('comptes donnés : pas une lecture id=in.(…) (' + b.vus.join(' ; ') + ')');
      if (!(Array.isArray(r) && r[0] && r[0].data && r[0].data.payload && r[0].data.capturedAt === ligne.cap)) fautes.push('la ligne lue n’est pas rebâtie (data.payload, data.capturedAt)'); }
    // b) réponse vide ⇒ relue par motif
    { const b = base((q, n) => (n === 1 ? [] : [ligne])); const f = mk(async () => null);
      const r = await f.lireDressings(b.lire, { uids: ['11'] });
      if (!(b.vus.length === 2 && /id=like\.harvest_\*_listings/.test(b.vus[1]) && Array.isArray(r) && r.length === 1)) fautes.push('une réponse VIDE pour les comptes liés est prise pour « rien » (§4.1)'); }
    // c) pas su ⇒ null, sans relecture qui ferait passer une demi-liste
    { const b = base(() => null); const f = mk(async () => null);
      const r = await f.lireDressings(b.lire, { uids: ['11'] });
      if (r !== null) fautes.push('« pas su » ne rend pas null'); }
    // d) comptes écartés ⇒ id=not.in.(…)
    { const b = base(() => [ligne]); const f = mk(async () => null);
      await f.lireDressings(b.lire, { exclure: ['33'] });
      if (!(b.vus.length === 1 && /id=like\.harvest_\*_listings&id=not\.in\.\(harvest_33_listings\)/.test(b.vus[0]))) fautes.push('les comptes écartés sont lus quand même (' + b.vus.join(' ; ') + ')'); }
    // e) aucune entrée ⇒ le motif, projeté
    { const b = base(() => []); const f = mk(async () => null);
      const r = await f.lireDressings(b.lire);
      if (!(b.vus.length === 1 && /select=id,/.test(b.vus[0]) && Array.isArray(r))) fautes.push('sans comptes : pas une lecture par motif projetée'); }
    // f) lireAchatsLies : mêmes règles
    { const vus = []; const f = mk(async (q) => { vus.push(q); return vus.length === 1 ? [] : [{ id: 'harvest_11_orders_purchased', orders: [] }]; });
      const r = await f.lireAchatsLies(['11']);
      if (!(vus.length === 2 && /^id=in\.\(harvest_11_orders_purchased\)/.test(vus[0]) && /^id=like\.harvest_\*_orders_purchased/.test(vus[1]) && Array.isArray(r) && r.length === 1)) fautes.push('lireAchatsLies : comptes liés puis, si vide, motif (' + vus.join(' ; ') + ')'); }
    { const vus = []; const f = mk(async (q) => { vus.push(q); return [{ id: 'x' }]; });
      await f.lireAchatsLies(['11', '22']);
      if (!(vus.length === 1 && /harvest_22_orders_purchased/.test(vus[0]) && !/like/.test(vus[0]))) fautes.push('lireAchatsLies relit tous les comptes alors que les comptes liés ont répondu'); }
    { const f = mk(async () => null);
      if ((await f.lireAchatsLies(['11'])) !== null) fautes.push('lireAchatsLies : « pas su » ne rend pas null'); }
    return fautes;
  })();
}

async function verifier(contenus) {
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
  // 3. Les dressings.
  const sites = [
    ['la recherche', /const lst=\(await lireLignesEnLigne\(\(await lireDressings\(sb,\{uids:okUid\?\[\.\.\.okUid\]:null\}\)/],
    ['« Tout sur le N° » (tous les comptes, exprès)', /Promise\.all\(\[\s*(?:\/\/[^\n]*\n\s*)*lireDressings\(sb\),/],
    ['Leboncoin (sans les comptes écartés)', /const listRowsBrut = await lireDressings\(sbGet, \{ exclure: \[\.\.\.offAcc\] \}\)/],
    ['« Le prix qui marche » (comptes liés)', /lireLignesEnLigne\(await lireDressings\(sb,\{uids:uidsLies\(vintedAccounts\)\}\)/],
  ];
  const appSans = sansCommentaires(app);
  const absents = sites.filter(([, re]) => !re.test(appSans)).map(([n]) => n);
  dit(!absents.length, 'les quatre lecteurs de dressings passent par `lireDressings` (recherche, « Tout sur le N° », Leboncoin, « Le prix qui marche »)', absents.join(', '));
  let exD = [];
  try { exD = await executerDressings(app); } catch (e) { exD = [String(e && e.message || e)]; }
  dit(exD.length === 0, '`lireDressings` / `lireAchatsLies` (exécutées) : comptes donnés ⇒ id=in.(…), vide ⇒ relu par motif, pas su ⇒ null, écartés ⇒ id=not.in.(…)', exD.join(' | '));
  // 4. Les achats des comptes liés.
  const corps = (nom) => { const i = appSans.search(new RegExp('(?:async function|const) ' + nom + '\\b')); if (i < 0) return null; const j = appSans.indexOf('\n}', i); const k = appSans.indexOf('\n};', i); const fin = [j, k].filter((x) => x > 0).sort((a, b) => a - b)[0]; return appSans.slice(i, fin); };
  const lecteurs = ['calculerOuRanger', 'lireAchatsRegistre', 'sourcesExportDonnees'].map((n) => [n, corps(n)]);
  const fautifs = lecteurs.filter(([, c]) => !c || !/lireAchatsLies\(/.test(c) || /harvest_\*_orders_purchased/.test(c)).map(([n]) => n);
  dit(!fautifs.length, 'la cloche « où ranger », le registre des achats et l’export lisent les achats des comptes LIÉS (`lireAchatsLies`)', fautifs.join(', '));
  return ko;
}

const contenus = fichiers().map((f) => [f, fs.readFileSync(f, 'utf8')]);
(async () => {
let ko = await verifier(contenus);
if (process.argv.includes('--prouve')) {
  console.log('\n── mutations (chacune doit être ROUGE)');
  const app = contenus.find(([f]) => /src[\\/]App\.jsx$/.test(f));
  const MUT = [
    ['la lecture par compte redevient `select=id,data`', (t) => t.replace(/(_orders_[^\n]*?)select=\$\{SEL_COMMANDES\}/, '$1select=id,data,updated_at,cap:data->>capturedAt')],
    ['la constante des commandes redemande `data`', (t) => t.replace(/const SEL_COMMANDES = '[^']*'/, "const SEL_COMMANDES = 'id,data,updated_at,cap:data->>capturedAt'")],
    ['les fiches de page relues entières', (t) => t.replace(/(id=eq\.vinted_item_details&select=)\$\{l\.map\(cle\)\.join\(','\)\}/, '$1data')],
    ['« Le prix qui marche » relit `select=data`', (t) => t.replace(/(harvest_\*_orders_sold&select=)mo:data->payload->my_orders/, '$1data')],
    ['`ligneCommandes` perd la marque « vidée »', (t) => t.replace(/if \(r\.supprime != null\) data\.supprime = r\.supprime;/, '')],
    // (6 nov., vitesse 2) Les dressings et les achats des comptes liés.
    ['la recherche relit les dressings en `select=id,data`', (t) => t.replace('(await lireDressings(sb,{uids:okUid?[...okUid]:null})||[])', "(await sb('app_data?id=like.harvest_*_listings&select=id,data')||[])")],
    ['« Tout sur le N° » relit les dressings en `select=id,data`', (t) => t.replace(/(Promise\.all\(\[\s*(?:\/\/[^\n]*\n\s*)*)lireDressings\(sb\),/, "$1sb('app_data?id=like.harvest_*_listings&select=id,data'),")],
    ['Leboncoin relit les dressings en `select=id,data`', (t) => t.replace("await lireDressings(sbGet, { exclure: [...offAcc] })", "await sbGet('app_data?id=like.harvest_*_listings&select=id,data')")],
    ['« Le prix qui marche » relit les dressings en `select=data`', (t) => t.replace('await lireDressings(sb,{uids:uidsLies(vintedAccounts)})', "await sb('app_data?id=like.harvest_*_listings&select=data')")],
    ['`fetchHarvest` relit la ligne en `select=data`', (t) => t.replace(/(id=eq\.harvest_\$\{uid\}_\$\{type\}&select=)\$\{SEL_MOISSON\}/, '$1data,updated_at,cap:data->>capturedAt')],
    ['la constante des dressings redemande `data`', (t) => t.replace(/const SEL_MOISSON = '[^']*'/, "const SEL_MOISSON = 'id,data,updated_at,cap:data->>capturedAt'")],
    ['`lireDressings` prend une réponse vide pour « rien »', (t) => t.replace('    if (l.length) return rebatir(l);\n  }\n  const x = Array.isArray(exclure)', '    return rebatir(l);\n  }\n  const x = Array.isArray(exclure)')],
    ['`lireDressings` ignore les comptes donnés', (t) => t.replace("if (u && u.length && u.every((x) => /^\\d+$/.test(x))) {\n    const l = await lire(", "if (false) {\n    const l = await lire(")],
    ['`lireDressings` lit les comptes écartés', (t) => t.replace("${x.length ? `&id=not.in.(${idsDressings(x).join(',')})` : ''}", '')],
    ['`lireAchatsLies` prend une réponse vide pour « rien »', (t) => t.replace('    if (l.length) return l;\n  }\n  return lireTout(', '    return l;\n  }\n  return lireTout(')],
    ['la cloche « où ranger » relit les achats de tous les comptes', (t) => t.replace('const lignes = (await achatsDejaLus(uids)) || (await lireAchatsLies(uids));', "const lignes = (await achatsDejaLus(uids)) || (await lireTout('id=like.harvest_*_orders_purchased&select=id,orders:data->payload->my_orders').catch(() => null));")],
    ['le registre des achats relit tous les comptes', (t) => t.replace(/(const lireAchatsRegistre = [\s\S]*?)comptesLus\.then\(\(c\) => lireAchatsLies\(Array\.isArray\(c\) \? uidsLies\(c\) : null\)\),/, "$1lireTout('id=like.harvest_*_orders_purchased&select=id,orders:data->payload->my_orders').catch(() => null),")],
    ["l'export relit tous les comptes", (t) => t.replace(/(async function sourcesExportDonnees[\s\S]*?)comptesLus\.then\(\(c\) => lireAchatsLies\(Array\.isArray\(c\) \? uidsLies\(c\) : null\)\),/, "$1lireTout('id=like.harvest_*_orders_purchased&select=id,orders:data->payload->my_orders').catch(() => null),")],
  ];
  for (const [nom, mut] of MUT) {
    const avant = app[1]; const apres = mut(avant);
    if (apres === avant) { console.log(`  ❌ mutation « ${nom} » : rien à muter (le code a changé ?)`); ko++; continue; }
    process.env.SILENCE = '1';
    const r = await verifier(contenus.map(([f, c]) => (f === app[0] ? [f, apres] : [f, c])));
    delete process.env.SILENCE;
    console.log((r > 0 ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » : ${r > 0 ? 'ROUGE' : 'reste VERTE'}`);
    if (!r) ko++;
  }
}
console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
process.exit(ko ? 1 : 0);
})();
