#!/usr/bin/env node
// ── audit-reprise-ecran — REVENIR AU MÊME ENDROIT, ET LA BARRE DU BAS (5 nov.) ─
// Exécute la VRAIE règle (src/repriseEcran.js + src/parcoursQuotidien.js) sur
// un stockage INVENTÉ, puis lit le câblage dans src/App.jsx (commentaires
// retirés). Ce qu'il exige :
//   · la reprise ne range QUE la navigation (écran, section, onglet de Colis),
//     jamais un écran hors de la liste blanche, jamais une forme inconnue ;
//   · elle est PAR VENDEUR (un autre vendeur ne la lit pas), 7 jours au plus,
//     refusée si elle vient « du futur » ; « pas su » ⇒ null (Ma journée) ;
//   · un lien `?tab=` reçu la fait taire ENTIÈREMENT ;
//   · une recherche tapée ne revient que 12 h, un filtre 7 jours ;
//   · App.jsx : l'écran de départ vient de `lireReprise`, la reprise est rangée
//     à chaque changement d'écran / section / onglet de Colis, filtres et
//     défilement sont rangés sur l'APPAREIL (pas le `sessionStorage`, vidé
//     quand iOS rouvre l'app installée), effacés au changement de vendeur ;
//   · la barre : « Plus » se ferme au retour (FermeAuRetour), un balayage parti
//     du bord est laissé au système, Ventes ne répète pas le nombre de Colis.
//   node scripts/audit-reprise-ecran.cjs [--mutation=NOM | --prouve]
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src');
const F_REPRISE = path.join(SRC, 'repriseEcran.js'), F_PARCOURS = path.join(SRC, 'parcoursQuotidien.js'), F_APP = path.join(SRC, 'App.jsx');

// [fichier, ancre, remplacement]
const MUTATIONS = {
  'lien-ignore': ['reprise', 'if (!storage || !owner || lienRecu(search)) return null;', 'if (!storage || !owner) return null;'],
  'liste-blanche': ['reprise', "if (!tab || !Array.isArray(ongletsOk) || !ongletsOk.includes(tab)) return null;", 'if (!tab) return null;'],
  'sub-libre': ['reprise', "if (typeof etat.sub === 'string' && FORME_SUB.test(etat.sub)) r.sub = etat.sub;", "if (typeof etat.sub === 'string') r.sub = etat.sub;"],
  'tout-range': ['reprise', 'const r = { tab };', 'const r = { ...etat, tab };'],
  'recherche-7j': ['parcours', "/recherche$/.test(nom)?DUREE_RECHERCHE:DUREE_PARCOURS", 'DUREE_PARCOURS'],
  'futur': ['parcours', '&&now>=x.at&&', '&&'],
  'vue-session': ['app', 'const st=stockageParcours(); return st?restaurerVue(st,owner,nom,initial):initial;', 'const st=sessionStorage; return st?restaurerVue(st,owner,nom,initial):initial;'],
  'depart-fixe': ['app', "const [tab,setTabBrut]=useState(()=>reprise0?reprise0.tab:'journee');", "const [tab,setTabBrut]=useState('journee');"],
  'pas-de-retour': ['app', '<FermeAuRetour fermer={()=>setOpen(false)}/>\n          <div ref={panneau} className="vrm-mobile-menu vrm-sheet vrm-sheet-bas', '<div ref={panneau} className="vrm-mobile-menu vrm-sheet vrm-sheet-bas'],
  'bord': ['app', 'if(t && (t.clientX<BORD_SYSTEME || t.clientX>(window.innerWidth||0)-BORD_SYSTEME)){ swipeStart.current=null; return; }', ''],
  'double-nombre': ['app', 'const badgesBarre=badges?{...badges,ventes:undefined}:badges;', 'const badgesBarre=badges;'],
  'vendeur-garde': ['app', 'viderParcours(sessionStorage,garder); viderParcours(localStorage,garder);', 'viderParcours(sessionStorage,garder);'],
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

const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\s*\}/g, '{}');

(async () => {
  for (const f of [F_REPRISE, F_PARCOURS, F_APP]) if (!fs.existsSync(f)) { console.log(`❌ ${path.relative(path.join(__dirname, '..'), f)} absent : la reprise n'existe pas`); process.exit(1); }
  const src = { reprise: fs.readFileSync(F_REPRISE, 'utf8'), parcours: fs.readFileSync(F_PARCOURS, 'utf8'), app: fs.readFileSync(F_APP, 'utf8') };
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reprise-'));
  fs.writeFileSync(path.join(dir, 'parcoursQuotidien.js'), src.parcours);
  fs.writeFileSync(path.join(dir, 'repriseEcran.js'), src.reprise);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  let R, P;
  try { R = await import(pathToFileURL(path.join(dir, 'repriseEcran.js')).href); P = await import(pathToFileURL(path.join(dir, 'parcoursQuotidien.js')).href); }
  catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };
  const memoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; }, _m: m }; };
  const OK = ['journee', 'ventes', 'annonces', 'cat_bord', 'compta', 'dashboard', 'settings'];
  const A = 'vendeur-a', B = 'vendeur-b', T0 = Date.UTC(2026, 10, 5, 9, 0, 0);

  essaie('forme', () => {
    dit(JSON.stringify(R.formeReprise({ tab: 'ventes', sub: 'ebay.commandes', colis: 'retirer', prix: 12, titre: 'Nike' }, OK)) === JSON.stringify({ tab: 'ventes', sub: 'ebay.commandes', colis: 'retirer' }), 'seuls l’écran, la section et l’onglet de Colis sont rangés (aucune donnée)', R.formeReprise({ tab: 'ventes', sub: 'ebay.commandes', colis: 'retirer', prix: 12, titre: 'Nike' }, OK));
    dit(R.formeReprise({ tab: 'inconnu' }, OK) === null && R.formeReprise({ tab: '' }, OK) === null && R.formeReprise(null, OK) === null, 'un écran hors liste blanche ⇒ null');
    dit(!('sub' in (R.formeReprise({ tab: 'ventes', sub: 'javascript:alert(1)' }, OK) || {})) && !('colis' in (R.formeReprise({ tab: 'cat_bord', colis: 'tout' }, OK) || {})), 'une section ou un onglet de forme inconnue n’est pas rangé');
  });
  essaie('aller-retour', () => {
    const st = memoire();
    dit(R.garderReprise(st, A, { tab: 'cat_bord', sub: 'ventes', colis: 'retirer' }, OK, T0) === true, 'rangée pour le vendeur A');
    const lu = R.lireReprise(st, A, OK, '', T0 + 3600e3);
    dit(lu && lu.tab === 'cat_bord' && lu.colis === 'retirer', 'relue une heure plus tard : Colis, À retirer', lu);
    dit(R.lireReprise(st, B, OK, '', T0 + 1000) === null, 'un AUTRE vendeur sur le même appareil ne la lit pas');
    dit(R.lireReprise(st, A, OK, '?tab=compta', T0 + 1000) === null && R.lireReprise(st, A, OK, '?print=bord&tab=ventes', T0 + 1000) === null, 'un lien ?tab= reçu la fait taire entièrement');
    dit(R.lireReprise(st, A, OK, '?confirmer-adresse=x', T0 + 1000) !== null, 'une autre adresse (sans tab=) ne la fait pas taire');
    dit(R.lireReprise(st, A, OK, '', T0 + 8 * 86400e3) === null, 'plus de 7 jours ⇒ null (Ma journée)');
    dit(R.lireReprise(st, A, OK, '', T0 - 60e3) === null, 'une valeur « du futur » (horloge reculée) ⇒ null');
    dit(R.lireReprise(st, '', OK, '', T0 + 1000) === null && R.lireReprise(null, A, OK, '', T0 + 1000) === null, 'sans vendeur ou sans stockage ⇒ null');
    dit(R.lireReprise(st, A, ['journee'], '', T0 + 1000) === null, 'un écran retiré de la liste blanche depuis ⇒ null');
    const st2 = memoire(); st2.setItem(P.cleParcours(A, R.NOM_REPRISE), '{pas du json');
    dit(R.lireReprise(st2, A, OK, '', T0) === null, 'une valeur illisible ⇒ null');
    const st3 = memoire(); R.garderReprise(st3, A, { tab: 'ventes' }, OK, T0); P.viderParcours(st3, B);
    dit(R.lireReprise(st3, A, OK, '', T0 + 1) === null, 'le changement de vendeur efface la reprise de l’autre (viderParcours)');
  });
  essaie('filtres', () => {
    const st = memoire();
    P.garderParcours(st, A, 'vue:annonces-recherche', 'dunk', T0);
    P.garderParcours(st, A, 'vue:ventes-filtre', 'transit', T0);
    dit(P.restaurerVue(st, A, 'annonces-recherche', '', T0 + 3600e3) === 'dunk', 'une recherche revient une heure après');
    dit(P.restaurerVue(st, A, 'annonces-recherche', '', T0 + 13 * 3600e3) === '', 'une recherche ne revient pas 13 h après (un mot oublié cacherait des annonces)');
    dit(P.restaurerVue(st, A, 'ventes-filtre', 'all', T0 + 3 * 86400e3) === 'transit', 'un filtre revient trois jours après');
    dit(P.restaurerVue(st, B, 'ventes-filtre', 'all', T0 + 1000) === 'all', 'le filtre d’un autre vendeur ne revient pas');
  });
  essaie('câblage', () => {
    const app = sansCommentaires(src.app);
    // (11 nov., reprise-ecrans) Le départ vient d'ecranAOuvrir : le plus frais de l'appareil
    // (reprise locale) et du compte (synchronisée), liste blanche, adresse reçue au chargement.
    dit(/const \[reprise0\]=useState\(\(\)=>\{ try\{ [^\n]*return ecranAOuvrir\(\{ carte:carteReprise\(\), locale:st\?repriseLocale\(st,owner\):null, ongletsOk:ONGLETS_LIENS, search:search0 \}\)/.test(app) && /const \[search0\]=useState\(\(\)=>\{ try\{ return window\.location\.search/.test(app), 'l’écran de départ vient de la reprise (appareil + compte, liste blanche, adresse)');
    dit(/useState\(\(\)=>reprise0\?reprise0\.tab:'journee'\)/.test(app), 'sans reprise : Ma journée');
    dit(/garderReprise\(stockageParcours\(\),[^)]*\{ tab, sub:platSub, colis:ongletColis \}, ONGLETS_LIENS\);[\s\S]{0,200}?\},\[tab,platSub,ongletColis\]\)/.test(app), 'la reprise est rangée à chaque changement d’écran, de section, d’onglet de Colis');
    dit(/const TABS_OK=ONGLETS_LIENS;/.test(app), 'les liens ?tab= et la reprise partagent la même liste blanche');
    const vue = (app.match(/function useVueSession[\s\S]*?\n\}/) || [''])[0];
    dit(/restaurerVue\(st,owner,nom,initial\)/.test(vue) && /garderParcours\(st,owner,'vue:'\+nom,nouveau\)/.test(vue) && !/sessionStorage/.test(vue) && /stockageParcours\(\)/.test(vue), 'les filtres sont rangés sur l’appareil (stockageParcours), plus dans le sessionStorage');
    const def = (app.match(/function MemoireDefilement[\s\S]*?\n\}/) || [''])[0];
    dit(/stockageParcours\(\)/.test(def) && !/sessionStorage/.test(def) && /visibilitychange/.test(def), 'le défilement est rangé sur l’appareil, aussi au passage en arrière-plan');
    dit((app.match(/viderParcours\(localStorage/g) || []).length >= 2, 'changement de vendeur ou déconnexion : les reprises de l’appareil sont effacées (deux chemins)');
    const menu = (app.match(/function MenuEcrans[\s\S]*?\n\}/) || [''])[0];
    dit(/<FermeAuRetour fermer=\{\(\)=>setOpen\(false\)\}\/>\s*<div ref=\{panneau\} className="vrm-mobile-menu vrm-sheet vrm-sheet-bas/.test(menu), '« Plus » se ferme au geste retour (FermeAuRetour), le retour ne quitte plus VRM');
    dit(/data-plus-ecran=\{courant\?cleEntree\(courant\):''\}/.test(menu), 'la 5ᵉ place dit l’écran de « Plus » où l’on est');
    dit(/t\.clientX<BORD_SYSTEME \|\| t\.clientX>\(window\.innerWidth\|\|0\)-BORD_SYSTEME/.test(app), 'un balayage parti du bord est laissé au système');
    dit(/const badgesBarre=badges\?\{\.\.\.badges,ventes:undefined\}:badges;/.test(app) && /<BadgeNav t=\{t\} badges=\{badgesBarre\} place="barre"\/>/.test(app), 'dans la barre, Ventes ne répète pas le nombre de Colis (§7)');
    dit(/viderParcours\(sessionStorage,garder\); viderParcours\(localStorage,garder\);/.test(app), 'à la connexion d’un autre vendeur, ses reprises seules restent');
  });
  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
