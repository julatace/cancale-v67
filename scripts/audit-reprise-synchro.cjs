#!/usr/bin/env node
// ── audit-reprise-synchro — CHAQUE ÉCRAN SE ROUVRE COMME ON L'A LAISSÉ, PARTOUT (11 nov.) ─
// Exécute la VRAIE règle (src/repriseSynchro.js, avec src/repriseEcran.js,
// src/parcoursQuotidien.js et la fusion du nuage src/fusionNuage.js) sur des cartes
// INVENTÉES, puis lit le câblage (src/App.jsx, src/ecransGardes.jsx,
// src/navigationTache.js ; commentaires retirés). Ce qu'il exige :
//   · une clé légère SYNCHRONISÉE (SYNC_KEYS), par compte VRM : un autre vendeur ne
//     la lit pas ; écrite avec un délai (pas à chaque frappe), jamais au montage ;
//   · le dernier écran rouvre seulement s'il a moins de 30 min, le plus FRAIS de
//     l'appareil et du compte ; un lien `?tab=` gagne toujours ;
//   · une recherche ne revient que quittée il y a moins de 10 min ; un filtre 60 j ;
//   · deux appareils qui changent deux réglages différents : les deux restent ;
//   · le nuage arrivé après l'ouverture ne remplace que ce qui n'a pas été touché ;
//   · un filtre retenu est TOUJOURS dit à l'écran, avec « Effacer » ;
//   · le défilement reste sur l'appareil (jamais dans la clé synchronisée).
//   node scripts/audit-reprise-synchro.cjs [--mutation=NOM | --prouve]
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src');
const F = {
  synchro: path.join(SRC, 'repriseSynchro.js'), reprise: path.join(SRC, 'repriseEcran.js'), parcours: path.join(SRC, 'parcoursQuotidien.js'),
  fusion: path.join(SRC, 'fusionNuage.js'), app: path.join(SRC, 'App.jsx'), gardes: path.join(SRC, 'ecransGardes.jsx'), nav: path.join(SRC, 'navigationTache.js'),
};

// [fichier, ancre, remplacement]
const MUTATIONS = {
  'recherche-60j': ['synchro', 'estRecherche(nom) ? DUREE_RECHERCHE : DUREE_REGLAGE', 'DUREE_REGLAGE'],
  'ecran-60j': ['synchro', 'entreeOk(e, now, DUREE_ECRAN)', 'entreeOk(e, now, DUREE_REGLAGE)'],
  'lien-ignore': ['synchro', 'if (lienRecu(search)) return null;', ''],
  'autre-vendeur': ['synchro', 'if (o.owner && owner && o.owner !== owner) return vide;', ''],
  'moins-frais': ['synchro', 'cands.sort((a, b) => b.at - a.at);', 'cands.sort((a, b) => a.at - b.at);'],
  'bandeau-muet': ['synchro', 'out.push({ nom: m.nom,', 'if (false) out.push({ nom: m.nom,'],
  'limite-synchro': ['synchro', "&& !/-limite$/.test(nom)", ''],
  'pas-synchro': ['app', '  CLE_REPRISE_ECRANS,\n', ''],
  'sans-delai': ['app', '_repriseMinuteur = setTimeout(ecrireRepriseMaintenant, DELAI_REPRISE);', 'ecrireRepriseMaintenant();'],
  'ecrit-au-montage': ['app', 'if(!repriseMontee.current){ repriseMontee.current=true; return; }', ''],
  'adopte-touche': ['app', 'const adopter=()=>{ if(touche.current) return;', 'const adopter=()=>{ if(false) return;'],
  'adopte-apres-geste': ['app', '      if(aNavigue.current) return;\n', ''],
  'bandeau-absent': ['app', '<RepriseRetenue tab={tab}', '<RepriseRetenueAilleurs tab={tab}'],
  'gardes-perimes': ['gardes', ", 'vrm_reprise_ecrans'];", '];'],
  'choix-seul': ['nav', '  if (TACHES_SITE[tab].choixSeul && !choix) return false;\n', ''],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ancre = /ancre de mutation introuvable/.test(r.stdout || '');
    const pris = r.status !== 0 && rouges && !ancre;
    console.log(`${pris ? '✅' : '❌'} mutation « ${m} » : ${ancre ? 'ANCRE INTROUVABLE' : rouges + ' rouge(s)'}`);
    if (pris) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\s*\}/g, '{}');

(async () => {
  for (const f of Object.values(F)) if (!fs.existsSync(f)) { console.log(`❌ ${path.relative(path.join(__dirname, '..'), f)} absent : la reprise synchronisée n'existe pas`); process.exit(1); }
  const src = {}; for (const [k, f] of Object.entries(F)) src[k] = fs.readFileSync(f, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reprise-synchro-'));
  for (const k of ['synchro', 'reprise', 'parcours', 'fusion', 'nav']) fs.writeFileSync(path.join(dir, path.basename(F[k])), src[k]);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  let S, N, Fu;
  try {
    S = await import(pathToFileURL(path.join(dir, 'repriseSynchro.js')).href);
    Fu = await import(pathToFileURL(path.join(dir, 'fusionNuage.js')).href);
  } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };
  const OK = ['journee', 'ventes', 'annonces', 'achats', 'messages', 'cat_bord', 'compta', 'dashboard'];
  const A = 'vendeur-a', B = 'vendeur-b', T0 = Date.UTC(2026, 10, 11, 9, 0, 0), MIN = 60000;

  essaie('forme', () => {
    const c = S.lireCarte({ owner: A, vues: { 'ventes-filtre': { valeur: 'transit', at: T0 }, 'pas un nom!': { valeur: 'x', at: T0 } }, prix: 12, ecran: { tab: 'ventes', at: T0 } }, A);
    dit(!('prix' in c) && !('pas un nom!' in c.vues) && c.vues['ventes-filtre'].valeur === 'transit', 'la carte ne garde que ses champs connus (aucune donnée)', c);
    dit(Object.keys(S.lireCarte({ owner: A, vues: { 'ventes-filtre': { valeur: 'transit', at: T0 } } }, B).vues).length === 0, 'la carte d’un AUTRE vendeur ne se lit pas');
    dit(S.vueSynchronisee('ventes-filtre') && S.vueSynchronisee('annonces-recherche') && !S.vueSynchronisee('ventes-limite') && !S.vueSynchronisee('messages-limite'), 'les « Voir plus » (-limite) restent sur l’appareil, filtres et recherches suivent le compte');
    const p = S.poserCarte(null, { vues: { 'ventes-filtre': { valeur: 'transit', at: T0 } }, ecran: { tab: 'ventes', sub: 'leboncoin', at: T0 } }, A, OK);
    dit(p.owner === A && p.vues['ventes-filtre'].at === T0 && p.ecran.tab === 'ventes' && !('position' in p) && !JSON.stringify(p).includes('position'), 'posée : l’heure du GESTE, le vendeur, jamais de position de défilement', p);
    dit(!('ventes-filtre' in S.poserCarte(p, { vues: { 'ventes-filtre': { efface: true } } }, A, OK).vues), '« Effacer » retire la vue (retour au défaut)');
    dit(!S.poserCarte(null, { ecran: { tab: 'inconnu', at: T0 } }, A, OK).ecran, 'un écran hors liste blanche n’est jamais rangé');
    const beaucoup = {}; for (let i = 0; i < 80; i++) beaucoup['ventes-v' + i] = { valeur: 'x', at: T0 + i };
    dit(Object.keys(S.poserCarte(null, { vues: beaucoup }, A, OK).vues).length === 60, 'la clé reste légère : 60 vues au plus (les plus anciennes partent)');
  });
  essaie('durées', () => {
    const c = S.lireCarte({ owner: A, vues: { 'ventes-filtre': { valeur: 'transit', at: T0 }, 'annonces-recherche': { valeur: 'dunk', at: T0 }, 'annonces-tri': { valeur: 42, at: T0 } } }, A);
    dit(S.vueReprise(c, 'ventes-filtre', 'all', T0 + 3 * 86400e3) === 'transit', 'un filtre revient trois jours après');
    dit(S.vueReprise(c, 'annonces-recherche', '', T0 + 9 * MIN) === 'dunk', 'une recherche quittée il y a 9 min revient');
    dit(S.vueReprise(c, 'annonces-recherche', '', T0 + 11 * MIN) === '', 'une recherche quittée il y a 11 min ne revient pas');
    dit(S.vueReprise(c, 'ventes-filtre', 'all', T0 - MIN) === 'all', 'une valeur « du futur » (horloge reculée) ⇒ le défaut');
    dit(S.vueReprise(c, 'annonces-tri', 'oldest', T0 + MIN) === 'oldest', 'une valeur d’une autre forme que le défaut ⇒ le défaut');
    const per = S.lireCarte({ owner: A, vues: { 'commandes-periode': { valeur: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z', label: 'Octobre' }, at: T0 } } }, A);
    const v = S.vueReprise(per, 'commandes-periode', null, T0 + MIN);
    dit(v && v.from instanceof Date && v.label === 'Octobre', 'une période revient en dates', v);
  });
  essaie('écran', () => {
    const carte = S.lireCarte({ owner: A, ecran: { tab: 'ventes', sub: 'leboncoin', at: T0 + 10 * MIN } }, A);
    const locale = { tab: 'annonces', at: T0 };
    const r = S.ecranAOuvrir({ carte, locale, ongletsOk: OK, now: T0 + 20 * MIN });
    dit(r && r.tab === 'ventes' && r.sub === 'leboncoin', 'le plus FRAIS gagne : posé sur l’autre appareil il y a 10 min, il passe devant celui de cet appareil', r);
    dit((S.ecranAOuvrir({ carte, locale, ongletsOk: OK, now: T0 + 39 * MIN }) || {}).tab === 'ventes', '29 min après : il rouvre');
    dit(S.ecranAOuvrir({ carte, locale, ongletsOk: OK, now: T0 + 41 * MIN }) === null, '31 min après : Ma journée');
    dit(S.ecranAOuvrir({ carte, locale, ongletsOk: OK, search: '?tab=achats&sub=retirer', now: T0 + 20 * MIN }) === null, 'un lien ?tab= reçu (notification) gagne toujours');
    dit(S.ecranAOuvrir({ carte: S.lireCarte({ owner: A, ecran: { tab: 'organisation', at: T0 } }, A), locale: null, ongletsOk: OK, now: T0 + MIN }) === null, 'un écran hors liste blanche ⇒ Ma journée');
  });
  essaie('deux appareils', () => {
    const base = S.poserCarte(null, { vues: { 'ventes-filtre': { valeur: 'transit', at: T0 } } }, A, OK);
    const iphone = S.poserCarte(base, { vues: { 'annonces-tri': { valeur: 'recent', at: T0 + MIN } } }, A, OK);
    const ordi = S.poserCarte(base, { vues: { 'achats-filtre': { valeur: 'recus', at: T0 + 2 * MIN } }, comptes: { vinted: { valeur: '123', at: T0 + 2 * MIN } } }, A, OK);
    const f = Fu.fusion3(base, iphone, ordi);
    const c = S.lireCarte(f, A);
    dit(c.vues['annonces-tri'] && c.vues['achats-filtre'] && c.vues['ventes-filtre'] && S.compteReprise(c, 'vinted') === '123', 'deux appareils, deux réglages : la fusion du nuage garde les deux', f);
  });
  essaie('bandeau', () => {
    const m = [
      { nom: 'ventes-filtre', valeur: 'transit', initial: 'all' }, { nom: 'commandes-recherche', valeur: 'nike', initial: '' },
      { nom: 'annonces-tri', valeur: 'recent', initial: 'oldest' }, { nom: 'achats-filtre', valeur: 'attente', initial: 'attente' },
      { nom: 'messages-recherche', valeur: '  ', initial: '' }, { nom: 'ventes-limite', valeur: 120, initial: 60 },
    ];
    const v = S.retenusAffiches(m, 'ventes');
    dit(v.map((x) => x.nom).join() === 'ventes-filtre,commandes-recherche' && v[0].valeur === 'En transit' && v[1].valeur === '« nike »', 'Ventes dit son filtre et sa recherche retenus, en clair', v);
    dit(S.retenusAffiches(m, 'achats').map((x) => x.nom).join() === 'commandes-recherche', 'Achats : un filtre au défaut n’est pas dit, la recherche partagée l’est');
    dit(S.retenusAffiches(m, 'messages').length === 0, 'une recherche vide n’est pas dite');
  });
  essaie('câblage', () => {
    const app = sansCommentaires(src.app);
    const sync = (app.match(/const SYNC_KEYS = \[[\s\S]*?\n\];/) || [''])[0];
    dit(/\bCLE_REPRISE_ECRANS\b/.test(sync), 'la clé est dans SYNC_KEYS (suivie par le compte VRM, sur tous ses appareils)');
    dit(/_repriseMinuteur = setTimeout\(ecrireRepriseMaintenant, DELAI_REPRISE\);/.test(app) && /save\(CLE_REPRISE_ECRANS, poserCarteReprise\(/.test(app), 'écrite avec un délai, par la sauvegarde synchronisée (pas à chaque frappe)');
    dit(/if \(!owner \|\| p\.owner !== owner \|\| readSession\(\)\?\.user\?\.id !== owner\) return;/.test(app), 'un geste d’un vendeur ne part jamais sous un autre');
    dit(/visibilitychange[\s\S]{0,120}auRepos\(\)/.test(app), 'au passage en arrière-plan, ce qui attend part tout de suite');
    const vue = (app.match(/function useVueSession[\s\S]*?\n\}/) || [''])[0];
    dit(/vueReprise\(carteReprise\(\),nom,initial\)/.test(vue) && /noterReprise\(\{vues:/.test(vue), 'useVueSession lit et range filtre, tri, recherche pour le compte');
    dit(/const adopter=\(\)=>\{ if\(touche\.current\) return;/.test(vue) && /onCloudReady\(adopter\)/.test(vue), 'le nuage arrivé après coup ne remplace pas un réglage touché ici');
    dit(/if\(!repriseMontee\.current\)\{ repriseMontee\.current=true; return; \}/.test(app), 'l’écran de départ n’est jamais écrit au montage (il effacerait celui de l’autre appareil)');
    dit(/if\(aNavigue\.current\) return;/.test(app) && /search:search0/.test(app), 'l’écran venu du nuage ne s’impose ni après un geste, ni contre un lien reçu');
    dit(/<RepriseRetenue tab=\{tab\}/.test(app) && /retenusAffiches\(\[\.\.\._vuesMontees\.values\(\)\], tab\)/.test(app) && /data-effacer-vue=/.test(app) && /data-reinitialiser-ecran=/.test(app), 'un filtre retenu est dit à l’écran, avec « Effacer » et « Réinitialiser l’écran »');
    const def = (app.match(/function MemoireDefilement[\s\S]*?\n\}/) || [''])[0];
    dit(/stockageParcours\(\)/.test(def) && !/noterReprise|CLE_REPRISE_ECRANS/.test(def), 'le défilement reste sur l’appareil');
    dit(/CLES_NEUTRES = \[[^\]]*'vrm_reprise_ecrans'/.test(src.gardes), 'écrire la reprise ne fait pas remonter les écrans gardés');
    dit(/if \(TACHES_SITE\[tab\]\.choixSeul && !choix\) return false;/.test(src.nav), 'un écran « choix seul » (C9) ne retient toujours que le site TOUCHÉ');
  });
  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
