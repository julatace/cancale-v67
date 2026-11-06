#!/usr/bin/env node
// ── audit-coque-parametres — LA COQUE, LA NAVIGATION, PARAMÈTRES (5 nov., chantier H) ──
// Ce qui se juge SANS rendu (le banc `scripts/bancs/coque-parametres.cjs` juge le rendu) :
//   1. « Où ranger à l'arrivée » (src/ouRanger.js), sur des données INVENTÉES :
//      · la première case libre suit les règles du Stock (ordre des meubles, puis de
//        lecture ; une case notée pour un N° est PRISE ; un meuble « empilé » ne
//        propose que le fond de son segment — planches comprises) ;
//      · « pas su » (meubles ou cases pas lus) et « aucun meuble » ⇒ rien n'est proposé ;
//      · un achat n'est « arrivé » que sur une TRANSITION vue (autre → arrivé), par son
//        n° de transaction ; la première lecture ne propose rien ; « pas su » (achats
//        pas lus) ne change rien ;
//   2. App.jsx (la coque) :
//      · le nuage ne s'affiche qu'en cas de problème (`error`, `refus`) ;
//      · le même colis n'a qu'un badge (Ventes ne recopie pas celui de Colis) ;
//      · une icône par entrée de navigation (Ventes ≠ Achats ≠ Vestiaire ; Leboncoin ≠
//        « Prix à baisser » ; eBay ≠ Annonces) — les sites portent leur logo ;
//      · Paramètres : une icône par ligne dans chaque onglet ; plus de ligne
//        « Organisation » (son lien reste) ; « Statut » (jamais « Régime fiscal ») ;
//      · la pastille : « Dernière capture » lue dans la même source que la liste ;
//   3. la cloche passe par `SheetShell` (src/CentreNotifs.jsx), et la ligne « Où ranger »
//      n'écrit rien en base (aucune notification envoyée au téléphone).
//   node scripts/audit-coque-parametres.cjs                 la règle du dépôt
//   node scripts/audit-coque-parametres.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-coque-parametres.cjs --prouve        toutes les mutations : chacune doit rougir
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F = {
  ranger: path.join(RACINE, 'src', 'ouRanger.js'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  centre: path.join(RACINE, 'src', 'CentreNotifs.jsx'),
};

// [fichier, ancre, remplacement]
const MUTATIONS = {
  // Une case notée pour un N° compte comme libre.
  'case-prise-ignoree': ['ranger', "      if (prise(i)) continue;\n", ''],
  // Le meuble empilé propose une case en l'air.
  'gravite-ignoree': ['ranger', "        if (!fond && !prise((r + 1) * cols + c)) continue;\n", ''],
  // « Pas su » (meubles pas lus) traité comme « aucun meuble prêt » : une case inventée.
  'passu-libre': ['ranger', "  if (!estListe(meubles) || !estObjet(slots)) return null;", "  if (!estListe(meubles)) meubles = [{ id: 'm?', name: 'Meuble', cols: 1, rows: 1 }]; if (!estObjet(slots)) slots = {};"],
  // La première lecture propose tout ce qui est déjà arrivé.
  'premiere-lecture': ['ranger', "    if (avant && etat === 'arrive' && avant[tx] === 'autre') arrives.push(a);", "    if (etat === 'arrive' && (!avant || avant[tx] === 'autre')) arrives.push(a);"],
  // Un achat jamais vu (pas « autre ») compte comme arrivé.
  'jamais-vu': ['ranger', "avant[tx] === 'autre') arrives.push(a);", "avant[tx] !== 'arrive') arrives.push(a);"],
  // Sans case sue, on propose quand même.
  'sans-case': ['ranger', "  if (!caseLibre || !estObjet(proposes)) return [];", "  if (!estObjet(proposes)) return [];"],
  // Le nuage revient en permanence.
  'nuage-permanent': ['app', "  if (!SYNC_PROBLEME.has(syncStatus) && !ouvert) return null;\n", ''],
  // Ventes recopie le badge de Colis.
  'badge-double': ['app', "  const badgesNav={ cat_bord: colisBadge, annonces: nAnnonces,", "  const badgesNav={ cat_bord: colisBadge, ventes: colisBadge, annonces: nAnnonces,"],
  // Achats reprend le sac des Ventes.
  'icone-achats': ['app', "    {id:'achats',     icon:'cart', label:'Achats'},", "    {id:'achats',     icon:'bag', label:'Achats'},"],
  // Les sites perdent leur logo (Leboncoin redevient l'étiquette de « Prix à baisser »).
  'logo-sites': ['app', "  if(logo) return <span className=\"vrm-nav-logo\"", "  if(false) return <span className=\"vrm-nav-logo\""],
  // Deux lignes de Paramètres avec la même icône (Sécurité reprend l'enveloppe des E-mails).
  'icone-reglage': ['app', "{ id:'securite', type:'panneau', ic:'shield',", "{ id:'securite', type:'panneau', ic:'mail',"],
  // « Organisation » redevient une ligne.
  'organisation-ligne': ['app', "{ id:'numeros', type:'panneau', nu:true, ic:'tag',", "{ id:'organisation', type:'nav', ic:'check', lib:'Organisation', onClick:()=>setTab('organisation') },\n      { id:'numeros', type:'panneau', nu:true, ic:'tag',"],
  // Le mot écarté revient.
  'regime-fiscal': ['app', "ic:'receipt', lib:L.statut,", "ic:'receipt', lib:'Régime fiscal',"],
  // « Dernière capture » relit la ligne de diagnostic seule (la contradiction revient).
  'capture-diag': ['app', "const d = capsMax > 0 ? { at: capsMax,", "const d = false ? { at: capsMax,"],
  // La cloche quitte la feuille de l'app.
  'cloche-maison': ['centre', "    <SheetShell onClose={onFermer} titre=\"Notifications\"", "    <div onClose={onFermer} titre=\"Notifications\""],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  for (const f of Object.values(F)) if (!fs.existsSync(f)) { console.log('❌ ' + path.relative(RACINE, f) + ' absent : la règle n’existe pas'); process.exit(1); }
  const src = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, fs.readFileSync(f, 'utf8')]));
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  // La règle et ses deux voisines du Stock, copiées ensemble (mêmes imports relatifs).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coque-h-'));
  for (const n of ['stockSortie.js', 'stockRegles.js']) fs.writeFileSync(path.join(dir, n), fs.readFileSync(path.join(RACINE, 'src', n), 'utf8'));
  fs.writeFileSync(path.join(dir, 'ouRanger.js'), src.ranger);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  let R;
  try { R = await import(pathToFileURL(path.join(dir, 'ouRanger.js')).href); } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 400) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  // ── 1. LA PREMIÈRE CASE LIBRE ────────────────────────────────────────────
  essaie('premiereCaseLibre', () => {
    const meubles = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }, { id: 'mB', name: 'Étagère B', cols: 2, rows: 2 }];
    const c = R.premiereCaseLibre({ meubles, slots: { 1: { m: 'mA', i: 0 }, B230: { m: 'mA', i: 1 } } });
    dit(c && c.meubleId === 'mA' && c.i === 2 && c.rangee === 1 && c.colonne === 3, 'la première case libre, dans l’ordre de lecture (cases 1 et 2 prises ⇒ rangée 1, colonne 3)', c);
    dit(R.caseEnMots(c) === 'Étagère A · rangée 1, colonne 3', 'elle se dit en mots (meuble · rangée, colonne)', R.caseEnMots(c));
    const plein = {}; for (let i = 0; i < 6; i++) plein['n' + i] = { m: 'mA', i };
    const c2 = R.premiereCaseLibre({ meubles, slots: plein });
    dit(c2 && c2.meubleId === 'mB' && c2.i === 0, 'un meuble plein ⇒ le suivant', c2);
    // Une case notée pour un N° qui n'est plus une annonce actuelle est PRISE (un carton peut y être).
    const c3 = R.premiereCaseLibre({ meubles: [{ id: 'm', name: 'M', cols: 1, rows: 2 }], slots: { 'B12': { m: 'm', i: 0 } } });
    dit(c3 && c3.i === 1, 'une case notée (même pour un ancien N°) n’est jamais proposée', c3);
    const tout = {}; for (let i = 0; i < 6; i++) tout['a' + i] = { m: 'mA', i }; for (let i = 0; i < 4; i++) tout['b' + i] = { m: 'mB', i };
    dit(R.premiereCaseLibre({ meubles, slots: tout }) === null, 'tout est plein ⇒ rien (pas une case inventée)');
    dit(R.premiereCaseLibre({ meubles: [], slots: {} }) === null, 'aucun meuble ⇒ rien');
    dit(R.premiereCaseLibre({ meubles: null, slots: {} }) === null && R.premiereCaseLibre({ meubles, slots: null }) === null && R.premiereCaseLibre({ meubles: undefined, slots: undefined }) === null, '« pas su » (meubles ou cases pas lus) ⇒ rien n’est proposé');
    // Empilé : 2 colonnes × 3 rangées, une planche sous la rangée 1 de la colonne 1.
    const pile = [{ id: 'p', name: 'Pile', cols: 2, rows: 3, gravite: true, planches: ['1:1'] }];
    const g1 = R.premiereCaseLibre({ meubles: pile, slots: {} });
    dit(g1 && g1.i === 0, 'empilé : la case du haut de la colonne 1 pose sur sa planche ⇒ proposée', g1);
    const g2 = R.premiereCaseLibre({ meubles: pile, slots: { x: { m: 'p', i: 0 } } });
    dit(g2 && g2.i === 4, 'empilé : sans planche, seule la case du FOND est proposée (rangée 3, colonne 1), jamais une case en l’air', g2);
    const g3 = R.premiereCaseLibre({ meubles: pile, slots: { x: { m: 'p', i: 0 }, y: { m: 'p', i: 4 } } });
    dit(g3 && g3.i === 2, 'empilé : la case juste au-dessus d’une case prise', g3);
  });

  // ── 2. L'ACHAT QUI VIENT D'ARRIVER ───────────────────────────────────────
  essaie('achatsArrives', () => {
    const estArrive = (a) => /livr|finalis/i.test(a.status || '');
    const achats = [{ transaction_id: 1, title: 'A', status: 'Commande livrée' }, { transaction_id: 2, title: 'B', status: 'Expédiée' }, { transaction_id: 3, title: 'C', status: 'Commande finalisée' }];
    const p = R.achatsArrives({ achats, vus: null, estArrive });
    dit(p.arrives.length === 0 && p.vus && p.vus['1'] === 'arrive' && p.vus['2'] === 'autre', 'première lecture sur l’appareil ⇒ rien n’est proposé, l’état est retenu', p);
    const s = R.achatsArrives({ achats, vus: { 1: 'autre', 2: 'autre', 3: 'arrive' }, estArrive });
    dit(s.arrives.length === 1 && s.arrives[0].transaction_id === 1, 'seul l’achat vu « en route » puis « arrivé » est proposé (le déjà arrivé, non)', s.arrives.map((a) => a.transaction_id));
    const j = R.achatsArrives({ achats, vus: { 2: 'autre' }, estArrive });
    dit(j.arrives.length === 0, 'un achat jamais vu avant (pas de transition vue) n’est pas proposé', j.arrives.map((a) => a.transaction_id));
    const ps = R.achatsArrives({ achats: null, vus: { 1: 'autre' }, estArrive });
    dit(ps.arrives.length === 0 && ps.vus && ps.vus['1'] === 'autre', '« pas su » (achats pas lus) ⇒ rien, et ce qui était vu est gardé', ps);
    const sansTx = R.achatsArrives({ achats: [{ title: 'Même titre', status: 'Commande livrée' }], vus: {}, estArrive });
    dit(sansTx.arrives.length === 0, 'un achat sans n° de transaction n’a pas d’identité ⇒ jamais proposé (jamais par titre)');
    const c = { meubleId: 'mA', meuble: 'Étagère A', i: 2, rangee: 1, colonne: 3 };
    const l = R.notifsOuRanger({ proposes: { 1: { tx: '1', titre: 'A', at: 2 }, 3: { tx: '3', titre: 'C', at: 1, fait: 5 } }, caseLibre: c });
    dit(l.length === 1 && l[0].tx === '1' && l[0].ou === 'Étagère A · rangée 1, colonne 3', 'une ligne par achat arrivé pas encore rangé, avec LA case proposée', l);
    dit(R.notifsOuRanger({ proposes: { 1: { tx: '1', at: 2 } }, caseLibre: null }).length === 0, 'aucune case sue ⇒ aucune notification');
  });

  // ── 3. APP.JSX ET LA CLOCHE ──────────────────────────────────────────────
  const app = src.app;
  const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  const A = sansCommentaires(app);
  dit(/const SYNC_PROBLEME = new Set\(\['error', 'refus'\]\);/.test(A) && /if \(!SYNC_PROBLEME\.has\(syncStatus\) && !ouvert\) return null;/.test(A), 'le nuage ne s’affiche qu’en cas de problème (sauvegarde ratée ou refusée)');
  const bn = /const badgesNav=\{([^}]*)\}/.exec(A);
  dit(bn && !/\bventes\s*:/.test(bn[1]) && /cat_bord\s*:\s*colisBadge/.test(bn[1]), 'le badge des colis à envoyer est sur Colis seulement (pas recopié sur Ventes)', bn && bn[1]);
  // Les icônes de navigation.
  const icone = (re) => { const m = re.exec(A); return m ? m[1] : null; };
  const ic = { ventes: icone(/\{id:'ventes',\s*icon:'(\w+)'/), achats: icone(/\{id:'achats',\s*icon:'(\w+)'/), annonces: icone(/\{id:'annonces',\s*icon:'(\w+)'/) };
  dit(ic.ventes && ic.achats && ic.ventes !== ic.achats, 'Ventes et Achats n’ont pas la même icône', ic);
  const nav = /function NavigationIcon\(\{item,size=20,style\}\) \{([\s\S]*?)\n\}/.exec(A);
  dit(nav && /item\.site\s*\?\s*logoPlateforme\(item\.site\)/.test(nav[1]) && /if\(logo\) return <span className="vrm-nav-logo"/.test(nav[1]), 'une entrée de site (Leboncoin, eBay, Vestiaire) porte le logo du site (≠ « Prix à baisser », ≠ Annonces, ≠ Ventes)');
  // Paramètres : une icône par ligne, dans chaque onglet.
  const bloc = (debut, fin) => { const i = A.indexOf(debut), j = A.indexOf(fin, i + 1); return i >= 0 && j > i ? A.slice(i, j) : ''; };
  for (const [nom, debut, fin] of [['Réglages', 'const GROUPES_REGLAGES = [', 'const GROUPES_COMPTE'], ['Mon compte', 'const GROUPES_COMPTE = ', 'const GROUPES_ABONNEMENT']]) {
    // (Mon compte a deux formes : avec compte VRM, et sans — la seconde redit « Données et conditions ».)
    const b0 = bloc(debut, fin); const b = b0.split('\n  ] : [')[0];
    const ics = [...b.matchAll(/\bic:'(\w+)'/g)].map((m) => m[1]);
    const dbl = ics.filter((x, i) => ics.indexOf(x) !== i);
    dit(ics.length >= 6 && !dbl.length, `Paramètres · ${nom} : une icône par ligne (${ics.length} lignes)`, dbl);
    const absentes = ics.filter((x) => !new RegExp(`\\n  ${x}\\s*:`).test(app));
    dit(!absentes.length, `Paramètres · ${nom} : chaque icône existe dans ICON_PATHS (sinon rien n’est dessiné)`, absentes);
  }
  const reg = bloc('const GROUPES_REGLAGES = [', 'const GROUPES_COMPTE');
  dit(!/id:'organisation',\s*type:/.test(reg) && /data-reglage-organisation="" onClick=\{\(\)=>setTab\('organisation'\)\}/.test(reg), '« Organisation » n’est plus une ligne de la liste ; son lien reste sous « Stock et rangement »');
  dit(!/Régime fiscal/.test(reg) && /lib:L\.statut/.test(reg), 'Paramètres dit « Statut » (jamais « Régime fiscal ») — le mot de `L`');
  dit(/lib:L\.comptesLies/.test(reg), 'Paramètres dit « Comptes liés » — le mot de `L`');
  dit(/const d = capsMax > 0 \? \{ at: capsMax,/.test(A) && /data-etat-derniere-source=\{capsMax > 0 \? 'comptes' : 'diagnostic'\}/.test(A), 'la pastille : « Dernière capture » lit la même source que la liste des comptes');
  // La cloche.
  const C = sansCommentaires(src.centre);
  dit(/<SheetShell onClose=\{onFermer\} titre="Notifications"/.test(C) && !/createPortal/.test(C) && !/vrm-cn-voile/.test(C), 'la cloche passe par SheetShell (poignée, croix, portail) — plus de calque fait main');
  const coque = bloc('async function calculerOuRanger()', 'function CentreNotifsCoque');
  dit(coque && !/\bsave\(|fetch\([^)]*method|POST|pushNotif/.test(coque), '« Où ranger » n’écrit rien en base et n’envoie rien au téléphone (lecture projetée seulement)', coque.slice(0, 80));
  // (6 nov., vitesse 2) Les achats des comptes liés passent par `lireAchatsLies` (projetée, paginée) : on juge SA lecture.
  const achatsLies = bloc('async function lireAchatsLies(', '\n}');
  const projete = (s) => /select=id,orders:data->payload->my_orders/.test(s) && !/select=data[^-]/.test(s);
  dit((projete(coque) || (/lireAchatsLies\(/.test(coque) && projete(achatsLies) && /lireTout\(/.test(achatsLies))) && !/select=data[^-]/.test(coque), 'les achats sont lus PROJETÉS (jamais `select=data`, §4.4)');

  console.log(`\n${ko ? '❌' : '✅'} audit-coque-parametres : ${n - ko}/${n}`);
  process.exit(ko ? 1 : 0);
})();
