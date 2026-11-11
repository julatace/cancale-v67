// Audit : CHACUN COMPOSE SA MA JOURNÉE (11 nov. 2026, lot journee-perso)
//
//   R. LA RÈGLE (src/journeePerso.js), EXÉCUTÉE :
//      R1 sans réglage : l'ordre d'origine (le catalogue), et chaque carte suit le
//         réglage de départ Simple / Complet (`caseJourneeMontree`) ;
//      R2 son choix gagne, dans les deux sens (« Prix à baisser » rallumé en Simple) ;
//      R3 une carte cachée qui porte un geste DÛ urgent revient (« force ») ; une
//         carte qui ne peut pas l'être reste cachée ;
//      R4 une carte livrée APRÈS son réglage apparaît à SA place d'origine ;
//      R5 déplacer : borné, la zone seule bouge, les autres zones gardent leur ordre ;
//      R6 « Revenir au réglage d'origine » ; une ligne abîmée ⇒ l'origine ;
//      R7 les urgences : colis en retard / à sa date limite, dernier jour de retrait.
//   S. LE BRANCHEMENT (src/App.jsx, src/ecrans/Reglages.jsx, src/JourneePerso.jsx) :
//      S1 le réglage est synchronisé (SYNC_KEYS) ;
//      S2 les cases passent par la règle AVEC leur urgence ; une case cachée garde
//         son compteur dans le bloc caché `data-tuile` ;
//      S3 les alertes urgentes restent en premier, hors de la règle (jamais cachées) ;
//      S4 « À faire » suit SON ordre ; chaque carte de la zone « À faire » du
//         catalogue a son bloc, et chaque carte cachée hors case est décomptée ;
//      S5 la tête suit SON ordre ; frise et chiffres cachés restent rendus (cachés) ;
//      S6 « Modifier ma journée » en bas de Ma journée ET dans Paramètres ;
//      S7 l'éditeur : poignée au clavier (flèches, Début/Fin) et au doigt
//         (pointeur), interrupteur `role=switch`, « Revenir au réglage d'origine ».
// `--prouve` : chaque règle réaffaiblie doit passer au rouge.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RAC = path.join(__dirname, '..');
const { sourceApp } = require('./_source-app.cjs');
const PROUVE = process.argv.includes('--prouve');
const lire = (rel) => { try { return fs.readFileSync(path.join(RAC, rel), 'utf8'); } catch (_) { return null; } };
const sansCommentaires = (s) => String(s || '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');

const textes = () => ({ regle: lire('src/journeePerso.js'), profil: lire('src/profilVendeur.js'), app: sourceApp(RAC), editeur: lire('src/JourneePerso.jsx'), reglages: lire('src/ecrans/Reglages.jsx') });

async function charger(T) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'journee-perso-'));
  const esm = (t) => String(t || '').replace(/from '\.\/([A-Za-z]+)\.js'/g, "from './$1.mjs'");
  fs.writeFileSync(path.join(dir, 'profilVendeur.mjs'), esm(T.profil));
  fs.writeFileSync(path.join(dir, 'journeePerso.mjs'), esm(T.regle));
  return { P: await import(path.join(dir, 'journeePerso.mjs')), PV: await import(path.join(dir, 'profilVendeur.mjs')) };
}

async function controles(T, ok) {
  let P = null, PV = null;
  try { ({ P, PV } = await charger(T)); } catch (e) { ok(false, 'R0 la règle se charge', String(e && e.message)); }
  if (P && typeof P.ordreJournee !== 'function') { ok(false, 'R0 la règle existe (src/journeePerso.js)'); P = null; }
  if (P) {
    const cat = P.CARTES_JOURNEE;
    const zone = (z) => cat.filter((c) => c.zone === z).map((c) => c.id);
    // R1
    ok(['tete', 'afaire', 'bas'].every((z) => JSON.stringify(P.ordreJournee(z, null)) === JSON.stringify(zone(z))), 'R1 sans réglage : l’ordre d’origine, zone par zone');
    const defOK = PV && cat.every((c) => ['simple', 'complet'].every((m) => P.visibiliteCarte(c.id, { reglage: null, mode: m }).montree === PV.caseJourneeMontree(c.id, m)));
    ok(defOK, 'R1 sans réglage : chaque carte suit Simple / Complet (`caseJourneeMontree`)');
    ok(!P.visibiliteCarte('prix', { mode: 'simple' }).montree && P.visibiliteCarte('prix', { mode: 'complet' }).montree, 'R1 en Simple, « Prix à baisser » se tait par défaut');
    // R2
    const rPrix = P.basculerCarte(null, 'prix', true), rMsg = P.basculerCarte(null, 'messages', false);
    ok(P.visibiliteCarte('prix', { reglage: rPrix, mode: 'simple' }).montree && !P.visibiliteCarte('messages', { reglage: rMsg, mode: 'complet' }).montree, 'R2 son choix gagne, dans les deux sens');
    ok(P.visibiliteCarte('frise', { reglage: rMsg, mode: 'simple' }).montree, 'R2 une carte qu’il n’a pas touchée garde son défaut');
    // R3
    const rEnv = P.basculerCarte(P.basculerCarte(null, 'envoyer', false), 'retirer', false);
    const vE = P.visibiliteCarte('envoyer', { reglage: rEnv, mode: 'complet', urgent: true });
    const vR = P.visibiliteCarte('retirer', { reglage: rEnv, mode: 'complet', urgent: true });
    ok(vE.montree && vE.force && !vE.choisie && vR.montree && vR.force, 'R3 « à envoyer » / « à retirer » cachées mais urgentes : affichées (« affichée car urgent »)');
    ok(!P.visibiliteCarte('envoyer', { reglage: rEnv, mode: 'complet', urgent: false }).montree, 'R3 cachée et pas urgente : cachée');
    ok(!P.visibiliteCarte('messages', { reglage: rMsg, mode: 'complet', urgent: true }).montree, 'R3 une carte qui ne porte pas de geste dû urgent ne se force pas');
    const vEm = P.visibiliteCarte('envoyer', { reglage: null, mode: 'complet', urgent: true });
    ok(vEm.montree && !vEm.force, 'R3 montrée et urgente : pas de mention « forcée »');
    // R4 — un réglage ancien qui ne connaît pas une carte (simulée : on retire « deux-fois » de son ordre).
    const az = zone('afaire');
    const ancien = { v: 1, ordre: az.filter((id) => id !== 'deux-fois').reverse(), choix: {} };
    const o4 = P.ordreJournee('afaire', ancien);
    const ii = az.indexOf('deux-fois'), voisin = az[ii - 1];
    ok(o4.length === az.length && o4.indexOf('deux-fois') === o4.indexOf(voisin) + 1, 'R4 une carte livrée après son réglage apparaît à sa place (après sa voisine d’origine)', o4.join(','));
    const o4b = P.ordreJournee('afaire', { ordre: az.slice(1) });
    ok(o4b[0] === az[0], 'R4 une carte neuve sans voisine avant elle vient en tête', o4b.join(','));
    // R5
    const rD = P.deplacerCarte(null, 'messages', 0);
    ok(P.ordreJournee('afaire', rD)[0] === 'messages' && JSON.stringify(P.ordreJournee('tete', rD)) === JSON.stringify(zone('tete')) && JSON.stringify(P.ordreJournee('bas', rD)) === JSON.stringify(zone('bas')), 'R5 déplacer en tête : sa zone seule bouge');
    const rD2 = P.deplacerCarte(rD, 'messages', 999);
    ok(P.ordreJournee('afaire', rD2).slice(-1)[0] === 'messages' && P.deplacerCarte(null, 'inconnue', 0).ordre.length === 0, 'R5 déplacement borné ; une carte inconnue ne change rien');
    ok(P.deplacerCarte(null, 'frise', 0).ordre.length > 0 && P.ordreJournee('tete', P.deplacerCarte(null, 'frise', 0))[0] === 'frise', 'R5 la tête se range aussi');
    // R6
    ok(P.estOrigine(P.revenirOrigine(rD)) && P.estOrigine(P.revenirOrigine(rPrix)) && P.estOrigine(null) && !P.estOrigine(rD) && !P.estOrigine(rPrix), 'R6 « Revenir au réglage d’origine » efface ordre et choix');
    const abime = P.lireJourneePerso({ ordre: 'x', choix: { prix: 'oui', envoyer: false } });
    ok(abime.ordre.length === 0 && abime.choix.prix === undefined && abime.choix.envoyer === false && P.estOrigine([1, 2]), 'R6 une ligne abîmée ⇒ réglage d’origine (ce qui est lisible reste)');
    // R7
    const U = P.urgencesJournee;
    ok(U({ tuiles: { envoyer: { n: 2, alerte: true } } }).envoyer && U({ tuiles: { envoyer: { n: 2, presses: { n: 1 } } } }).envoyer && !U({ tuiles: { envoyer: { n: 2, presses: null } } }).envoyer && !U({ tuiles: { envoyer: { n: 0, alerte: true } } }).envoyer, 'R7 « à envoyer » urgent : en retard ou à sa date limite (rien à envoyer ⇒ rien d’urgent)');
    ok(U({ tuiles: { retirer: { n: 1, alerte: true } } }).retirer && !U({ tuiles: { retirer: { n: 1 } } }).retirer && U({ alertes: [{ id: 'retrait-dernier-jour' }] }).retirer && U({ alertes: [{ id: 'colis-en-retard' }] }).envoyer, 'R7 « à retirer » urgent au dernier jour ; une alerte urgente du même geste compte');
    ok(cat.filter((c) => c.urgent).map((c) => c.id).sort().join() === 'envoyer,retirer', 'R7 seules les cartes de geste dû se forcent');
  }
  // ── S ────────────────────────────────────────────────────────────────────
  const app = sansCommentaires(T.app || '');
  const sync = (app.split('const SYNC_KEYS = [')[1] || '').split('];')[0];
  ok(/\bCLE_JOURNEE_PERSO\b/.test(sync), 'S1 le réglage est synchronisé (SYNC_KEYS)');
  ok(/const visJ = \(id\) => visibiliteCarte\(id, \{ reglage: persoJ, mode: PROFIL_VENDEUR\.mode, urgent: !!urgJ\[id\] \}\);/.test(app) && /const urgJ = urgencesJournee\(\{ tuiles, alertes: alertesArgent \}\);/.test(app), 'S2 les cases passent par la règle, avec LEUR urgence');
  ok(/const cases = T\.filter\(\(x\) => !x\.pasSu && x\.t && x\.t\.n > 0 && visJ\(x\.id\)\.montree\);/.test(app) && /<div hidden>\{T\.filter\(\(x\) => !cases\.includes\(x\)\)\.map\(\(x\) => <span key=\{x\.id\} data-tuile=\{x\.id\}/.test(app), 'S2 une case cachée garde son compteur publié (bloc caché `data-tuile`)');
  const liste = (app.split('const listeAF = [')[1] || '').split('].filter(')[0];
  ok(/^\s*\.\.\.alertesArgent\.map\(\(j, i\) => \(\{ el: tache\(j, i\), alerte: true \}\)\),\s*\.\.\.forcesAF, \.\.\.montresAF,\s*$/.test(liste), 'S3 les alertes urgentes en premier, puis les cartes revenues car urgentes, puis les siennes');
  ok(!/visJ\([^)]*alerte/.test(app) && /let alertesArgent = jobs\.filter\(j => j\.urgent\);/.test(app), 'S3 les alertes ne passent pas par la règle (jamais cachées)');
  ok(/for \(const id of ordreJournee\('afaire', persoJ\)\) \{\s*const v = visJ\(id\); if \(!v\.montree\) continue;\s*for \(const el of \(blocsAF\[id\] \|\| \[\]\)\) \(v\.force \? forcesAF : montresAF\)\.push/.test(app), 'S4 « À faire » suit SON ordre, une carte cachée ne s’affiche pas (sauf urgente)');
  const blocs = (app.split('const blocsAF = {')[1] || '').split('\n              };')[0];
  const clesBlocs = [...blocs.matchAll(/^\s*(?:'([\w-]+)'|(\w+)):/gm)].map((m) => m[1] || m[2]);
  if (/\['envoyer', 'retirer', 'messages', 'prix'\]\.map/.test(blocs)) clesBlocs.push('envoyer', 'retirer', 'messages', 'prix');
  const catAF = P ? P.CARTES_JOURNEE.filter((c) => c.zone === 'afaire').map((c) => c.id) : [];
  ok(catAF.length && catAF.every((id) => clesBlocs.includes(id)) && clesBlocs.every((id) => catAF.includes(id)), 'S4 chaque carte « À faire » du catalogue a son bloc, et chaque bloc est au catalogue', `blocs: ${clesBlocs.join(',')} · catalogue: ${catAF.join(',')}`);
  const nPar = (app.split('const nParCarteAF = {')[1] || '').split('};')[0];
  const clesN = [...nPar.matchAll(/(?:'([\w-]+)'|(\w+)):/g)].map((m) => m[1] || m[2]);
  const horsCases = clesBlocs.filter((id) => !['envoyer', 'retirer', 'messages', 'prix'].includes(id));
  ok(horsCases.length && horsCases.every((id) => clesN.includes(id)) && /const nGestes = nGestesTout - \(nCacheesAF - casesCachees\.length\);/.test(app), 'S4 chaque carte cachée (hors cases) est retirée de « N gestes »', `manquent : ${horsCases.filter((id) => !clesN.includes(id)).join(',')}`);
  ok(/ordreJournee\('tete', persoJ\)\.map\(\(id\) => \{/.test(app) && /return id === 'phrase' \? null : <div key=\{id\} hidden data-jp-cachee=\{id\}>\{blocsTete\[id\]\}<\/div>;/.test(app), 'S5 la tête suit SON ordre ; frise et chiffres cachés restent rendus, cachés');
  ok(/const premierAF = !visibiliteCarte\('prochain', \{ reglage: persoJ, mode: PROFIL_VENDEUR\.mode \}\)\.montree \? null :/.test(app), 'S5 « La prochaine chose » cachée : rien ne monte en tête');
  ok(/data-jp-modifier="" onClick=\{\(\) => setFeuillePerso\(true\)\}>Modifier ma journée</.test(app) && /<JourneePersoSetting\/>/.test(app), 'S6 « Modifier ma journée » en bas de Ma journée');
  ok(/import \{ JourneePersoSetting \} from '\.\.\/App\.jsx';/.test(T.reglages || '') && /id:'ma-journee'[^\n]*el:<JourneePersoSetting\/>/.test(T.reglages || ''), 'S6 Paramètres → Affichage → Ma journée : le même éditeur');
  const ed = sansCommentaires(T.editeur || '');
  ok(/e\.key === 'ArrowUp' \? i - 1 : e\.key === 'ArrowDown' \? i \+ 1 : e\.key === 'Home' \? 0 : e\.key === 'End'/.test(ed) && /onKeyDown=\{\(e\) => auClavier\(e, id, z\.id\)\}/.test(ed) && /aria-live="polite"/.test(ed), 'S7 la poignée se déplace au clavier (flèches, Début/Fin), annoncé');
  ok(/onPointerDown=\{\(e\) => glisser\(e, id, z\.id\)\}/.test(ed) && /setPointerCapture/.test(ed) && /data-jp-poignee=\{id\} style=\{\{ touchAction: 'none' \}\}/.test(ed), 'S7 la poignée se glisse au doigt (pointeur capté, aucun défilement volé)');
  ok(/role="switch" aria-checked=\{v\.choisie\}/.test(ed) && /poser\(revenirOrigine\(\)\)/.test(ed), 'S7 un interrupteur par carte, « Revenir au réglage d’origine »');
}

async function lancer(T, muet) {
  let rouges = 0;
  const ok = (c, nom, detail) => { if (!c) rouges += 1; if (!muet) console.log(`${c ? '✅' : '❌'} ${nom}${!c && detail ? ` — ${detail}` : ''}`); };
  await controles(T, ok);
  return rouges;
}

const MUTATIONS = {
  choix_ignore: ['regle', (s) => s.replace("const choisie = typeof r.choix[id] === 'boolean' ? r.choix[id] : montreeParDefaut(id, mode);", 'const choisie = montreeParDefaut(id, mode);')],
  urgent_ignore: ['regle', (s) => s.replace('const force = !choisie && peutForcer && !!urgent;', 'const force = false;')],
  urgent_partout: ['regle', (s) => s.replace("const peutForcer = !!(PAR_ID.get(id) && PAR_ID.get(id).urgent);", 'const peutForcer = true;')],
  neuve_en_bas: ['regle', (s) => s.replace('out.splice(k + 1, 0, id);', 'out.push(id);')],
  defaut_tout: ['regle', (s) => s.replace('export const montreeParDefaut = (id, mode) => caseJourneeMontree(id, mode);', 'export const montreeParDefaut = () => true;')],
  retrait_pas_urgent: ['regle', (s) => s.replace("retirer: !!(ret && ret.n > 0 && ret.alerte) || ids.has('retrait-dernier-jour'),", 'retirer: false,')],
  presses_oublie: ['regle', (s) => s.replace(' || (env.presses && env.presses.n > 0)', '')],
  origine_garde: ['regle', (s) => s.replace('export const revenirOrigine = () => estampille({ ...REGLAGE_ORIGINE, choix: {} });', 'export const revenirOrigine = (r) => lireJourneePerso(r);')],
  hors_sync: ['app', (s) => s.replace('  CLE_JOURNEE_PERSO,\n', '\n')],
  sans_urgence: ['app', (s) => s.replace('urgent: !!urgJ[id] });', 'urgent: false });')],
  alertes_cachables: ['app', (s) => s.replace('...alertesArgent.map((j, i) => ({ el: tache(j, i), alerte: true })),\n                ...forcesAF', '...alertesArgent.filter((j) => visJ(j.id).montree).map((j, i) => ({ el: tache(j, i), alerte: true })),\n                ...forcesAF')],
  ordre_ignore: ['app', (s) => s.replace("for (const id of ordreJournee('afaire', persoJ)) {", "for (const id of Object.keys(blocsAF)) {")],
  carte_oubliee: ['app', (s) => s.replace("                'a-relier': comptesARelierJour.length ? [carteARelier()] : [],\n", '')],
  cachee_comptee: ['app', (s) => s.replace("const nGestes = nGestesTout - (nCacheesAF - casesCachees.length);", 'const nGestes = nGestesTout;')],
  frise_demontee: ['app', (s) => s.replace("return id === 'phrase' ? null : <div key={id} hidden data-jp-cachee={id}>{blocsTete[id]}</div>;", 'return null;')],
  clavier_muet: ['editeur', (s) => s.replace('onKeyDown={(e) => auClavier(e, id, z.id)} ', '')],
  defilement_vole: ['editeur', (s) => s.replace(" style={{ touchAction: 'none' }}", '')],
  doigt_muet: ['editeur', (s) => s.replace(' onPointerDown={(e) => glisser(e, id, z.id)}', '')],
  sans_parametres: ['reglages', (s) => s.replace(", el:<JourneePersoSetting/> },", ", el:null },")],
};

(async () => {
  const T = textes();
  const r = await lancer(T, false);
  console.log(r ? `\n❌ journée composée : ${r} rouge(s)` : '\n✅ journée composée : tout est vert');
  if (!PROUVE) { process.exitCode = r ? 1 : 0; return; }
  if (r) { process.exitCode = 1; return; }
  let pris = 0, n = 0;
  for (const [nom, [cle, f]] of Object.entries(MUTATIONS)) {
    n += 1;
    const t2 = { ...T, [cle]: f(T[cle] || '') };
    if (t2[cle] === T[cle]) { console.log(`❌ ${nom} : la mutation ne s'applique plus`); continue; }
    const rr = await lancer(t2, true);
    if (rr > 0) { pris += 1; console.log(`✅ mutation ${nom} : ${rr} rouge(s)`); } else console.log(`❌ mutation ${nom} : RIEN n'a vu`);
  }
  console.log(`\n${pris}/${n} mutations attrapées`);
  process.exitCode = pris === n ? 0 : 1;
})();
