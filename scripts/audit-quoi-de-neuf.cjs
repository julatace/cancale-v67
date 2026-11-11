// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT — « QUOI DE NEUF » (11 nov., claude/quoi-de-neuf)
//  Exécute les VRAIES règles (src/nouveautes.js) et relit le branchement :
//   F  le FORMAT de chaque ligne de `NOUVEAUTES` : id unique [a-z0-9-], date
//      AAAA-MM-JJ réelle, du plus récent au plus ancien, titre ≤ 8 mots, phrase
//      ≤ 12 mots, écran cible que `?tab=` sait ouvrir (ONGLETS_LIENS d'App.jsx),
//      `pour` et `mode` connus ;
//   R  les règles : un compte ne voit QUE ce qui arrive après son inscription
//      (date pas sue ⇒ rien) ; Simple cache ce qui vise un écran de Complet ;
//      « pas su » (ce qu'il vend, son statut) ne vaut pas « pour toi » ; « Vu »
//      ajoute sans rien effacer ; une nouveauté vue ne revient pas ;
//   B  le branchement : la clé dans SYNC_KEYS, la carte dans Ma journée (jamais
//      une fenêtre bloquante), la feuille par SheetShell (portail + FermeAuRetour),
//      Paramètres → « Quoi de neuf », la date d'inscription lue du compte VRM,
//      la règle pour la suite écrite dans CLAUDE.md §9.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l.replace(/(^|[^:'"`\\])\/\/\s.*$/, '$1'))).join('\n');

async function verifier(racine, { muet = false } = {}) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!muet || !bon) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : ''}`); };
  const lire = (p) => { try { return fs.readFileSync(path.join(racine, p), 'utf8'); } catch (_) { return ''; } };
  let N;
  try { N = await import(pathToFileURL(path.join(racine, 'src/nouveautes.js')).href + '?v=' + Math.random()); }
  catch (e) { dit(false, 'src/nouveautes.js se charge', e.message); return ko || 1; }

  // ── F : le format ──
  const { sourceApp } = require(path.join(RACINE, 'scripts/_source-app.cjs'));
  let app = ''; try { app = sourceApp(racine); } catch (_) { app = lire('src/App.jsx'); }
  const mOng = /const ONGLETS_LIENS=\[([^\]]*)\]/.exec(app);
  const onglets = new Set(mOng ? [...mOng[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : []);
  if (/\.\.\.Object\.keys\(CHEMINS_ARGENT\)/.test(mOng ? mOng[1] : '')) {
    const arg = lire('src/argent.js'); const m = /CHEMINS_ARGENT = Object\.freeze\(\{([\s\S]*?)\}\)/.exec(arg);
    if (m) for (const x of m[1].matchAll(/^\s*([a-z_]+):/gm)) onglets.add(x[1]);
  }
  dit(onglets.size > 20, `ONGLETS_LIENS lu (${onglets.size} écrans)`);
  const L = N.NOUVEAUTES || [];
  dit(Array.isArray(L) && L.length >= 8, `au moins 8 nouveautés (${L.length})`);
  const ids = new Set(); let precedente = '9999';
  for (const n of L) {
    const q = `« ${n && n.id} »`;
    dit(typeof n.id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(n.id) && !ids.has(n.id), `${q} : id unique`); ids.add(n.id);
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(n.date || ''); const t = d ? new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])) : null;
    dit(!!t && t.toISOString().slice(0, 10) === n.date, `${q} : date réelle`, n.date);
    dit(n.date <= precedente, `${q} : du plus récent au plus ancien`); precedente = n.date;
    dit(N.motsDe(n.titre) >= 2 && N.motsDe(n.titre) <= N.TITRE_MOTS_MAX && N.TITRE_MOTS_MAX === 8, `${q} : titre ≤ 8 mots (${N.motsDe(n.titre)})`, n.titre);
    dit(N.motsDe(n.phrase) >= 3 && N.motsDe(n.phrase) <= N.PHRASE_MOTS_MAX && N.PHRASE_MOTS_MAX === 12, `${q} : phrase ≤ 12 mots (${N.motsDe(n.phrase)})`, n.phrase);
    dit(onglets.has(n.tab), `${q} : écran « ${n.tab} » ouvrable par ?tab=`);
    dit(N.POUR.includes(n.pour) && N.MODES.includes(n.mode), `${q} : pour/mode connus`, [n.pour, n.mode]);
    dit(N.lienDe(n) === `?tab=${n.tab}`, `${q} : lien ?tab=`);
  }
  dit(N.motsDe('« Créé par VRM », seulement') === 4, 'motsDe : la ponctuation seule n’est pas un mot');
  dit(L.some((n) => n.date === '2026-11-11' && n.id === 'facture-siret') && L.some((n) => n.id === 'tu-vends-quoi') && L.some((n) => n.id === 'cree-par-vrm'), 'les nouveautés du 11 nov. y sont');

  // ── R : les règles ──
  const base = { inscritLe: '2026-11-01T10:00:00Z', mode: 'complet', vend: 'sneakers', categories: ['sneakers'], pro: true };
  const tous = N.nouveautesDuCompte(base);
  dit(tous.length > 0 && tous.every((n) => n.date > '2026-11-01'), 'inscrit le 1er nov. : il voit ce qui est arrivé après');
  const neuf = N.nouveautesDuCompte({ ...base, inscritLe: '2026-11-11T08:00:00Z' });
  dit(neuf.length === 0, 'inscrit le 11 nov. : aucune nouveauté du 11 nov. ni d’avant (pas l’historique)', neuf.map((n) => n.id));
  const veille = N.nouveautesDuCompte({ ...base, inscritLe: '2026-11-10T12:00:00' });
  dit(veille.length > 0 && veille.every((n) => n.date === '2026-11-11'), 'inscrit le 10 nov. : seulement le 11 nov.');
  dit(N.nouveautesDuCompte({ ...base, inscritLe: '' }).length === 0 && N.nouveautesDuCompte({ ...base, inscritLe: 'n’importe' }).length === 0, 'date d’inscription pas sue ⇒ rien');
  const comp = L.filter((n) => n.mode === 'complet');
  dit(comp.length > 0 && N.nouveautesDuCompte({ ...base, mode: 'simple' }).every((n) => n.mode !== 'complet'), 'Simple : rien qui vise un écran de Complet');
  dit(comp.every((n) => N.pourLui(n, { ...base, mode: 'complet' })), 'Complet : elles reviennent');
  const pro = L.filter((n) => n.pour === 'pro');
  dit(pro.length > 0 && pro.every((n) => !N.pourLui(n, { ...base, pro: null }) && !N.pourLui(n, { ...base, pro: false }) && N.pourLui(n, base)), 'pro : seulement un statut pro SU');
  const aut = L.filter((n) => n.pour === 'autre');
  dit(aut.length > 0 && aut.every((n) => !N.pourLui(n, base) && !N.pourLui(n, { ...base, vend: null, categories: null }) && N.pourLui(n, { ...base, vend: 'autre', categories: ['lunettes'] })), '« pas que des sneakers » : ni pour Sneakers seules, ni sur un « pas su »');
  const sn = { id: 'x', date: '2026-11-11', pour: 'sneakers', mode: 'tous' };
  dit(N.pourLui(sn, base) && N.pourLui(sn, { ...base, vend: 'autre', categories: ['sneakers', 'sacs'] }) && !N.pourLui(sn, { ...base, vend: 'autre', categories: ['livres'] }) && !N.pourLui(sn, { ...base, vend: null, categories: null }), '« sneakers » : seulement s’il en vend');
  const v1 = N.marquerVues(null, [tous[0].id], '2026-11-11T09:00:00Z');
  const v2 = N.marquerVues(v1, [tous[1].id], '2026-11-12T09:00:00Z');
  dit(v2.vues[tous[0].id] === '2026-11-11T09:00:00Z' && v2.vues[tous[1].id] === '2026-11-12T09:00:00Z', '« Vu » ajoute sans rien effacer ni redater');
  const reste = N.nouveautesAVoir(base, v2);
  dit(reste.length === tous.length - 2 && !reste.some((n) => n.id === tous[0].id), 'une nouveauté vue ne revient pas sur la carte');
  dit(N.nouveautesAVoir(base, { vues: 'abimé' }).length === tous.length && N.lireVues({ vues: { a: 3 } }).a === undefined, 'un état abîmé ne cache rien');
  dit(N.libelleNombre(1) === '1 nouveauté' && N.libelleNombre(3) === '3 nouveautés', '« 1 nouveauté » / « 3 nouveautés »');

  // ── B : le branchement ──
  const A = sansCom(app);
  const sync = /const SYNC_KEYS = \[([\s\S]*?)\n\];/.exec(A);
  dit(!!sync && /\bCLE_NOUVEAUTES_VUES\b/.test(sync[1]), 'la clé « vu » est dans SYNC_KEYS (par compte VRM, tous ses appareils)');
  dit(N.CLE_NOUVEAUTES_VUES === 'vrm_nouveautes_vues', 'la clé s’appelle vrm_nouveautes_vues');
  const fHook = /function useQuoiDeNeuf\(\) \{([\s\S]*?)\n\}/.exec(A);
  dit(!!fHook && /inscritLe:\s*AUTH\.user\?\.created_at/.test(fHook[1]), 'la date d’inscription vient du compte VRM (AUTH.user.created_at)');
  dit(!!fHook && /p\.mode === 'simple'/.test(fHook[1]) && /categories/.test(fHook[1]) && /regimeFiscal\(\)/.test(fHook[1]) && /save\(CLE_NOUVEAUTES_VUES/.test(fHook[1]), 'le contexte : Simple/Complet, ce qu’il vend, son statut ; « Vu » enregistré par save (synchronisé)');
  dit(!!fHook && /reg == null \? null/.test(fHook[1]), 'statut pas choisi ⇒ « pas su » (null), jamais « pas pro »');
  dit(!!fHook && /aVoir: pret \? nouveautesAVoir\(ctx, vues\) : \[\]/.test(fHook[1]) && /const pret = p\.uid === \(AUTH\.user\?\.id \|\| ''\) && !!p\.uid && isCloudReady\(\);/.test(fHook[1]), 'profil pas posé ou nuage pas lu ⇒ aucune carte (pas un compte qui change sous ses yeux)');
  const jour = /<ScreenHead icon="soleilLevant" title="Ma journée"\/>([\s\S]*?)\{AF\.section\}/.exec(A);
  dit(!!jour && /<QuoiDeNeufJournee onNav=\{onNav\}\/>/.test(jour[1]), 'la carte est en haut de Ma journée (avant « À faire »)');
  const fJ = /function QuoiDeNeufJournee\(\{ onNav \}\) \{([\s\S]*?)\n\}/.exec(A);
  dit(!!fJ && /<QuoiDeNeufFeuille[^>]*SheetShell=\{SheetShell\}/.test(fJ[1]) && /\{ouvert && <QuoiDeNeufFeuille/.test(fJ[1]), 'la feuille passe par SheetShell (portail, FermeAuRetour), seulement sur son toucher');
  dit(!!fJ && /onNav && onNav\(n\.tab\)/.test(fJ[1]) && /q\.marquer\(\[n\.id\]\)/.test(fJ[1]), '« Voir » range la ligne et mène à l’écran');
  const C = sansCom(lire('src/QuoiDeNeuf.jsx'));
  const carte = /export function QuoiDeNeufCarte[\s\S]*?\n\}/.exec(C);
  dit(!!carte && /<button type="button"/.test(carte[0]) && !/role="dialog"|aria-modal|createPortal/.test(carte[0]) && /if \(!Array\.isArray\(aVoir\) \|\| !aVoir\.length\) return null;/.test(carte[0]), 'la carte : un bouton discret, jamais une fenêtre ; rien à voir ⇒ rien');
  dit(/onToutVu/.test(C) && /data-quoi-de-neuf-vu/.test(C), '« Tout vu » dans la feuille');
  const R = sansCom(lire('src/ecrans/Reglages.jsx'));
  // (11 nov., lot traduction) Le libellé passe par `tr()` : sa valeur française se lit dans le dictionnaire.
  const frApp = lire('src/i18n/langues/fr.js');
  dit(/id:'quoi-de-neuf'[^\n]*lib:(?:'Quoi de neuf'|tr\('reglages\.quoi-de-neuf\.lib'\))[^\n]*el:<QuoiDeNeufParametres onNav=\{setTab\}\/>/.test(R)
    && (/lib:'Quoi de neuf'/.test(R) || /"reglages\.quoi-de-neuf\.lib": "Quoi de neuf"/.test(frApp)), 'Paramètres → Aide → « Quoi de neuf »');
  const cm = lire('CLAUDE.md');
  dit(/src\/nouveautes\.js/.test(cm) && /chaque lot visible ajoute sa ligne/i.test(cm), 'CLAUDE.md §9 : la règle pour la suite (chaque lot visible ajoute sa ligne)');
  return ko;
}

(async () => {
  if (!process.argv.includes('--prouve')) {
    const ko = await verifier(RACINE);
    console.log(ko ? `❌ audit-quoi-de-neuf : ${ko} rouge(s)` : '✅ audit-quoi-de-neuf : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  const MUTATIONS = [
    ['src/nouveautes.js', 'l’historique pour un nouveau compte', 'n && n.date > depuis &&', 'n && n.date >= depuis &&'],
    ['src/nouveautes.js', 'date d’inscription pas sue ⇒ tout', '  if (!depuis) return [];', '  if (!depuis) return liste.filter((n) => pourLui(n, ctx));'],
    ['src/nouveautes.js', 'Simple montre Complet', "  if (n.mode === 'complet' && mode === 'simple') return false;", ''],
    ['src/nouveautes.js', 'pro sur un « pas su »', "  if (n.pour === 'pro') return pro === true;", "  if (n.pour === 'pro') return pro !== false;"],
    ['src/nouveautes.js', '« autre » pour tous', "  if (n.pour === 'autre') return vend === 'autre' && !(cats && cats.length === 1 && cats[0] === 'sneakers');", "  if (n.pour === 'autre') return true;"],
    ['src/nouveautes.js', '« Vu » redate', "!vues[id]) vues[id] = at;", ') vues[id] = at;'],
    ['src/nouveautes.js', 'une vue revient', '.filter((n) => !vues[n.id]);', ';'],
    ['src/nouveautes.js', 'un titre de 9 mots', "titre: 'Plus de «\u00a0pointure\u00a0» sur eBay'", "titre: 'Il n’y a plus de «\u00a0pointure\u00a0» sur eBay ici'"],
    ['src/nouveautes.js', 'une phrase de 13 mots', "phrase: 'Elle n’est demandée que pour les sneakers.'", "phrase: 'Elle n’est plus du tout demandée que pour les sneakers, partout, toujours, voilà.'"],
    ['src/nouveautes.js', 'un écran qui n’existe pas', "tab: 'ebay_annonces', pour: 'autre'", "tab: 'ebay_nulle_part', pour: 'autre'"],
    ['src/nouveautes.js', 'un id en double', "{ id: 'profil-photo',", "{ id: 'tu-vends-quoi',"],
    ['src/nouveautes.js', 'ordre cassé', "{ id: 'chercher-photo', date: '2026-11-09'", "{ id: 'chercher-photo', date: '2026-11-12'"],
    ['src/App.jsx', 'clé hors SYNC_KEYS', '  CLE_NOUVEAUTES_VUES,\n', ''],
    ['src/App.jsx', 'carte retirée de Ma journée', '            {!baseKO && !premierJour && <QuoiDeNeufJournee onNav={onNav}/>}\n', ''],
    ['src/App.jsx', 'statut pas su ⇒ pas pro', "pro: reg == null ? null :", 'pro: reg == null ? false :'],
    ['src/App.jsx', 'carte avant le nuage', ' && !!p.uid && isCloudReady();', ' && !!p.uid;'],
    ['src/App.jsx', 'carte avant le profil', 'aVoir: pret ? nouveautesAVoir(ctx, vues) : []', 'aVoir: nouveautesAVoir(ctx, vues)'],
    ['src/App.jsx', 'feuille hors SheetShell', 'SheetShell={SheetShell} Bouton={Bouton}', 'SheetShell={(p) => <div>{p.children}</div>} Bouton={Bouton}'],
    ['src/QuoiDeNeuf.jsx', 'la carte devient une fenêtre', '<button type="button" className="vrm-qdn-carte"', '<button type="button" role="dialog" className="vrm-qdn-carte"'],
    ['src/ecrans/Reglages.jsx', 'Paramètres sans « Quoi de neuf »', "el:<QuoiDeNeufParametres onNav={setTab}/> },", 'el:null },'],
  ];
  let rates = 0;
  for (const [fichier, nom, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-qdn-'));
    for (const x of ['src', 'scripts']) fs.cpSync(path.join(RACINE, x), path.join(d, x), { recursive: true });
    for (const x of ['package.json', 'CLAUDE.md']) fs.copyFileSync(path.join(RACINE, x), path.join(d, x));
    const p = path.join(d, fichier); const brut = fs.readFileSync(p, 'utf8');
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; fs.rmSync(d, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, brut.replace(avant, apres));
    const ko = await verifier(d, { muet: true }).catch(() => 1);
    console.log(`${ko ? 'OK  rouge' : 'KO  VERT'} sous mutation : ${nom}${ko ? ` (${ko})` : ''}`);
    if (!ko) rates++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(rates ? `❌ ${rates} mutation(s) pas attrapée(s)` : `✅ ${MUTATIONS.length}/${MUTATIONS.length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
