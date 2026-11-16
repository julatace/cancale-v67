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
//   (16 nov., lot personnalisation-simple — « La personnalisation doit être plus simple. »)
//      R8 un ordre égal au départ n'est pas un ordre à lui (oublié à la lecture) ;
//         ses choix restent ; un vrai ordre reste ;
//      R9 ↑ ↓ : une place, bornée ; une carte fixe ne bouge pas ;
//      R10 « La paire à sortir » est une carte de « En bas » (jamais « En haut »),
//         même pour un réglage enregistré avant elle ;
//      S8 l'éditeur simple : ↑ ↓ par carte, aucune phrase sous les noms, une
//         phrase d'en-tête, tous les textes par tr() (aucun français écrit) ;
//      S9 Ma journée : « La paire à sortir » n'est plus dans la tête, elle est
//         rendue par la zone « En bas », et cachée par lui elle ne s'affiche pas.
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
    // Son ordre : la neuve absente, et sa voisine d'origine (« Vendus ailleurs ») rangée EN TÊTE (pas en dernier : la
    // neuve posée en bas tomberait par hasard juste après elle).
    const ancien = { v: 1, ordre: ['ailleurs', ...az.filter((id) => id !== 'deux-fois' && id !== 'ailleurs').reverse()], choix: {} };
    const o4 = P.ordreJournee('afaire', ancien);
    const ii = az.indexOf('deux-fois'), voisin = az[ii - 1];
    ok(o4.length === az.length && o4.indexOf('deux-fois') === o4.indexOf(voisin) + 1, 'R4 une carte livrée après son réglage apparaît à sa place (après sa voisine d’origine)', o4.join(','));
    const am = P.ordreMobile('afaire', null);
    const o4b = P.ordreMobile('afaire', { ordre: am.slice(1).reverse() });
    ok(o4b[0] === am[0], 'R4 une carte neuve sans voisine avant elle vient en tête', o4b.join(','));
    // R5
    const rD = P.deplacerCarte(null, 'messages', 0);
    ok(P.ordreMobile('afaire', rD)[0] === 'messages' && P.ordreJournee('afaire', rD)[0] === 'trancher' && JSON.stringify(P.ordreJournee('tete', rD)) === JSON.stringify(zone('tete')) && JSON.stringify(P.ordreJournee('bas', rD)) === JSON.stringify(zone('bas')), 'R5 déplacer en tête : sa zone seule bouge (« À trancher », fixe, reste devant)');
    const rD2 = P.deplacerCarte(rD, 'messages', 999);
    ok(P.ordreJournee('afaire', rD2).slice(-1)[0] === 'messages' && P.deplacerCarte(null, 'inconnue', 0).ordre.length === 0, 'R5 déplacement borné ; une carte inconnue ne change rien');
    ok(P.deplacerCarte(null, 'frise', 0).ordre.length > 0 && P.ordreJournee('tete', P.deplacerCarte(null, 'frise', 0))[0] === 'frise', 'R5 la tête se range aussi');
    // Les chiffres du mois sont posés SOUS la carte sombre par la grille : une carte fixe (pas de poignée qui ne ferait rien).
    const fixes = cat.filter((c) => c.fixe).map((c) => c.id);
    const rP = P.deplacerCarte(null, 'phrase', 99);
    ok(fixes.join() === 'chiffres,trancher' && P.estOrigine(P.deplacerCarte(null, 'chiffres', 0)) && P.ordreJournee('tete', rP).join() === 'prochain,frise,phrase,chiffres' && !P.ordreMobile('tete', null).includes('chiffres'), 'R5 une carte fixe (les chiffres du mois, « À trancher ») ne se déplace pas et garde sa place', P.ordreJournee('tete', rP).join());
    // R6
    ok(P.estOrigine(P.revenirOrigine(rD)) && P.estOrigine(P.revenirOrigine(rPrix)) && P.estOrigine(null) && !P.estOrigine(rD) && !P.estOrigine(rPrix), 'R6 « Revenir au réglage d’origine » efface ordre et choix');
    const abime = P.lireJourneePerso({ ordre: 'x', choix: { prix: 'oui', envoyer: false } });
    ok(abime.ordre.length === 0 && abime.choix.prix === undefined && abime.choix.envoyer === false && P.estOrigine([1, 2]), 'R6 une ligne abîmée ⇒ réglage d’origine (ce qui est lisible reste)');
    // R7
    const U = P.urgencesJournee;
    ok(U({ tuiles: { envoyer: { n: 2, alerte: true } } }).envoyer && U({ tuiles: { envoyer: { n: 2, presses: { n: 1 } } } }).envoyer && !U({ tuiles: { envoyer: { n: 2, presses: null } } }).envoyer && !U({ tuiles: { envoyer: { n: 0, alerte: true } } }).envoyer, 'R7 « à envoyer » urgent : en retard ou à sa date limite (rien à envoyer ⇒ rien d’urgent)');
    ok(U({ tuiles: { retirer: { n: 1, alerte: true } } }).retirer && !U({ tuiles: { retirer: { n: 1 } } }).retirer && U({ alertes: [{ id: 'retrait-dernier-jour' }] }).retirer && U({ alertes: [{ id: 'colis-en-retard' }] }).envoyer, 'R7 « à retirer » urgent au dernier jour ; une alerte urgente du même geste compte');
    ok(cat.filter((c) => c.urgent).map((c) => c.id).sort().join() === 'envoyer,retirer', 'R7 seules les cartes de geste dû se forcent');
    // R8 — un ordre enregistré qui recopie le départ (ici : l'ordre complet du catalogue, et un ordre partiel dans l'ordre
    // du catalogue) est oublié ; ses choix restent ; un ordre qui change quelque chose reste.
    const depart = cat.filter((c) => !c.fixe).map((c) => c.id);
    const lu8 = P.lireJourneePerso({ v: 1, ordre: depart, choix: { messages: false } });
    const lu8b = P.lireJourneePerso({ v: 1, ordre: depart.filter((id) => id !== 'sortir' && id !== 'favoris'), choix: {} });
    ok(lu8.ordre.length === 0 && lu8.choix.messages === false && lu8b.ordre.length === 0 && P.estOrigine(lu8b), 'R8 un ordre égal au départ est oublié (le départ d’aujourd’hui s’applique), ses choix restent');
    const vrai8 = P.lireJourneePerso({ v: 1, ordre: ['messages', 'ailleurs'], choix: {} });
    ok(vrai8.ordre.join() === 'messages,ailleurs' && P.ordreMobile('afaire', vrai8)[0] === 'messages', 'R8 un ordre à lui reste');
    // R9
    const m9 = P.ordreMobile('afaire', null);
    const rM = P.monterCarte(null, m9[2]), rDs = P.descendreCarte(null, m9[0]);
    ok(P.ordreMobile('afaire', rM)[1] === m9[2] && P.ordreMobile('afaire', rDs)[1] === m9[0] && P.ordreMobile('afaire', rDs)[0] === m9[1], 'R9 ↑ et ↓ : une place, pas plus');
    ok(P.estOrigine(P.monterCarte(null, m9[0])) && P.estOrigine(P.descendreCarte(null, m9[m9.length - 1])) && P.estOrigine(P.monterCarte(null, 'chiffres')), 'R9 bornés ; une carte fixe ne bouge pas');
    // R10
    const so = cat.find((c) => c.id === 'sortir');
    const ancienReglage = { v: 1, ordre: ['frise', 'phrase', 'prochain', 'messages', 'guide', 'notifs'], choix: {} };
    ok(!!so && so.zone === 'bas' && !so.fixe && !P.ordreJournee('tete', null).includes('sortir') && !P.ordreJournee('tete', ancienReglage).includes('sortir') && P.ordreJournee('bas', ancienReglage).includes('sortir'), 'R10 « La paire à sortir » est une carte de « En bas », jamais « En haut » (aussi pour un réglage d’avant elle)');
  }
  // ── S ────────────────────────────────────────────────────────────────────
  const app = sansCommentaires(T.app || '');
  const sync = (app.split('const SYNC_KEYS = [')[1] || '').split('];')[0];
  ok(/\bCLE_JOURNEE_PERSO\b/.test(sync), 'S1 le réglage est synchronisé (SYNC_KEYS)');
  ok(/const visJ = \(id\) => visibiliteCarte\(id, \{ reglage: persoJ, mode: PROFIL_VENDEUR\.mode, urgent: !!urgJ\[id\] \}\);/.test(app) && /const urgJ = urgencesJournee\(\{ tuiles, alertes: alertesArgent \}\);/.test(app), 'S2 les cases passent par la règle, avec LEUR urgence');
  // (14 nov., Studio) Les cases montrées sont des TUILES (src/JourneeStudio.jsx) : elles portent leur compteur ; le bloc
  // caché publie celui de chaque case qui n'est pas une tuile (cachée par lui, ou petite case à zéro).
  ok(/const cases = T\.filter\(\(x\) => !x\.pasSu && x\.t && x\.t\.n > 0 && visJ\(x\.id\)\.montree\);/.test(app)
    && (/<div hidden>\{T\.filter\(\(x\) => !cases\.includes\(x\)\)\.map\(\(x\) => <span key=\{x\.id\} data-tuile=\{x\.id\}/.test(app)
      || (/const idsCasesTuile = new Set\(T\.filter\(\(x\) => visJ\(x\.id\)\.montree\)\.map\(\(x\) => x\.id\)\);/.test(app)
        && /<div hidden>\{T\.filter\(\(x\) => !idsCasesTuile\.has\(x\.id\)\)\.map\(\(x\) => <span key=\{x\.id\} data-tuile=\{x\.id\}/.test(app)
        && /if \(xE && visT\('envoyer'\)\.montree\)/.test(app) && /if \(xR && visT\('retirer'\)\.montree\)/.test(app)
        && /const visT = \(id\) => visibiliteCarte\(id, \{ reglage: persoJ, mode: PROFIL_VENDEUR\.mode, urgent: !!urgT\[id\] \}\);/.test(app))),
    'S2 une case cachée garde son compteur publié (bloc caché `data-tuile`)');
  const liste = (app.split('const listeAF = [')[1] || '').split('].filter(')[0];
  // (14 nov., Studio) Les alertes urgentes montent au-dessus de la grille (`alertesHaut`, rendu en tête) ; la liste
  // « À faire » = les cartes revenues car urgentes, puis les siennes (`resteAF`).
  ok(/^\s*\.\.\.alertesArgent\.map\(\(j, i\) => \(\{ el: tache\(j, i\), alerte: true \}\)\),\s*\.\.\.forcesAF, \.\.\.montresAF,\s*$/.test(liste)
    || (/const alertesAF = alertesArgent(?:\.filter\(\(j\) => !HORS_JOURNEE_JOBS\.has\(j\.id\)\))?\.map\(\(j, i\) => tache\(j, i\)\)/.test(app) && /const resteAF = \[\.\.\.forcesAF, \.\.\.montresAF\]/.test(app) && /\{AF\.alertes \|\| null\}/.test(app)),
    'S3 les alertes urgentes en premier, puis les cartes revenues car urgentes, puis les siennes');
  ok(!/visJ\([^)]*alerte/.test(app) && /let alertesArgent = jobs\.filter\(j => j\.urgent\);/.test(app), 'S3 les alertes ne passent pas par la règle (jamais cachées)');
  ok(/for \(const id of ordreJournee(?:Heure)?\('afaire', persoJ\)\) \{\s*const v = visJ\(id\); if \(!v\.montree\) continue;\s*for \(const el of \(blocsAF\[id\] \|\| \[\]\)\) \(v\.force \? forcesAF : montresAF\)\.push/.test(app), 'S4 « À faire » suit SON ordre, une carte cachée ne s’affiche pas (sauf urgente)');
  const blocs = (app.split('const blocsAF = {')[1] || '').split('\n              };')[0];
  const clesBlocs = [...blocs.matchAll(/^\s*(?:'([\w-]+)'|(\w+)):/gm)].map((m) => m[1] || m[2]);
  if (/\['envoyer', 'retirer', 'messages', 'prix'\]\.map/.test(blocs)) clesBlocs.push('envoyer', 'retirer', 'messages', 'prix');
  const catAF = P ? P.CARTES_JOURNEE.filter((c) => c.zone === 'afaire' && !c.fixe).map((c) => c.id) : [];
  // Une carte FIXE de « À faire » (« À trancher », toujours en tête) n'est pas rangée : elle passe par la règle là où elle est rendue.
  const fixesAF = P ? P.CARTES_JOURNEE.filter((c) => c.zone === 'afaire' && c.fixe).map((c) => c.id) : [];
  ok(fixesAF.every((id) => new RegExp(`visJ\\('${id}'\\)\\.montree \\? \\[?carte`).test(app) || new RegExp(`const ${id}Vu = !!\\(job\\w+ && visJ\\('${id}'\\)\\.montree\\);`).test(app)), 'S4 une carte fixe de « À faire » passe aussi par la règle (cachable)', fixesAF.join(','));
  ok(catAF.length && catAF.every((id) => clesBlocs.includes(id)) && clesBlocs.every((id) => catAF.includes(id)), 'S4 chaque carte « À faire » du catalogue a son bloc, et chaque bloc est au catalogue', `blocs: ${clesBlocs.join(',')} · catalogue: ${catAF.join(',')}`);
  const nPar = (app.split('const nParCarteAF = {')[1] || '').split('};')[0];
  const clesN = [...nPar.matchAll(/(?:'([\w-]+)'|(\w+)):/g)].map((m) => m[1] || m[2]);
  const horsCases = clesBlocs.filter((id) => !['envoyer', 'retirer', 'messages', 'prix'].includes(id));
  ok(horsCases.length && horsCases.every((id) => clesN.includes(id)) && /const nGestes = nGestesTout - \(nCacheesAF - casesCachees\.length\);/.test(app), 'S4 chaque carte cachée (hors cases) est retirée de « N gestes »', `manquent : ${horsCases.filter((id) => !clesN.includes(id)).join(',')}`);
  // (14 nov., Studio) La tête rend la phrase et l'affiche dans SON ordre ; les chiffres du mois sont une tuile : cachés, ils
  // restent rendus dans un bloc caché (`data-jp-cachee="chiffres"`), comme l'affiche (`data-jp-cachee="frise"`).
  ok((/ordreJournee(?:Heure)?\('tete', persoJ\)\.map\(\(id\) => \{/.test(app) && /return id === 'phrase' \? null : <div key=\{id\} hidden data-jp-cachee=\{id\}>\{blocsTete\[id\]\}<\/div>;/.test(app))
    || (/ordreJourneeHeure\('tete', persoJ\)\.filter\(\(id\) => id === 'phrase' \|\| (?:id === 'frise'|\(id === 'frise' && !\(ordiJournee && !baseKO && !premierJour\)\))\)\.map\(/.test(app) && /<div key=\{id\} hidden data-jp-cachee="frise">\{blocsTete\.frise\}<\/div>/.test(app)
      && /if \(visT\('chiffres'\)\.montree\) out\.mois = /.test(app) && /\{!out\.mois \? <div hidden data-jp-cachee="chiffres">\{chiffresMois\}<\/div> : null\}/.test(app)), 'S5 la tête suit SON ordre ; frise et chiffres cachés restent rendus, cachés');
  ok(/const premierAF = !visibiliteCarte\('prochain', \{ reglage: persoJ, mode: PROFIL_VENDEUR\.mode \}\)\.montree \? null :/.test(app)
    || /const iP = !visibiliteCarte\('prochain', \{ reglage: persoJ, mode: PROFIL_VENDEUR\.mode \}\)\.montree \? -1 :/.test(app), 'S5 « La prochaine chose » cachée : rien ne monte en tête');
  ok((/data-jp-modifier="" onClick=\{\(\) => setFeuillePerso\(true\)\}>Modifier ma journée</.test(app) || (/data-jp-modifier="" onClick=\{\(\) => setFeuillePerso\(true\)\}>\{tr\('journee\.modifierMaJournee'\)\}</.test(app) && /"journee\.modifierMaJournee": "Modifier ma journée"/.test(lire('src/i18n/langues/fr/journee.js') || ''))) && /<JourneePersoSetting\/>/.test(app), 'S6 « Modifier ma journée » en bas de Ma journée');
  ok(/import \{ JourneePersoSetting \} from '\.\.\/App\.jsx';/.test(T.reglages || '') && /id:'ma-journee'[^\n]*el:<JourneePersoSetting\/>/.test(T.reglages || ''), 'S6 Paramètres → Affichage → Ma journée : le même éditeur');
  const ed = sansCommentaires(T.editeur || '');
  ok(/e\.key === 'ArrowUp' \? i - 1 : e\.key === 'ArrowDown' \? i \+ 1 : e\.key === 'Home' \? 0 : e\.key === 'End'/.test(ed) && /onKeyDown=\{\(e\) => auClavier\(e, id, z\.id\)\}/.test(ed) && /aria-live="polite"/.test(ed), 'S7 la poignée se déplace au clavier (flèches, Début/Fin), annoncé');
  ok(/onPointerDown=\{\(e\) => glisser\(e, id, z\.id\)\}/.test(ed) && /setPointerCapture/.test(ed) && /data-jp-poignee=\{id\} style=\{\{ touchAction: 'none' \}\}/.test(ed), 'S7 la poignée se glisse au doigt (pointeur capté, aucun défilement volé)');
  ok(/role="switch" aria-checked=\{v\.choisie\}/.test(ed) && /poser\(revenirOrigine\(\)\)/.test(ed), 'S7 un interrupteur par carte, « Revenir au réglage d’origine »');
  ok(/data-jp-monter=\{id\}[^\n]*\n?[^\n]*monterCarte\(r, id\)/.test(ed) && /data-jp-descendre=\{id\}[^\n]*\n?[^\n]*descendreCarte\(r, id\)/.test(ed), 'S8 ↑ ↓ sur chaque carte mobile (une place par toucher)');
  ok(!/c\.desc\b/.test(ed) && (ed.match(/className="vrm-jp-aide"/g) || []).length === 1, 'S8 aucune phrase sous les noms, une seule phrase d’en-tête');
  const litteraux = [...ed.matchAll(/>([^<>{}\n]*[A-Za-zÀ-ÿ]{3,}[^<>{}\n]*)</g)].map((m) => m[1].trim()).filter(Boolean);
  ok(!litteraux.length && /tr\('jp\.depart'\)/.test(ed) && /tr\('jp\.aide'\)/.test(ed) && /tr\('jp\.zone\.' \+ z\.id\)/.test(ed), 'S8 tous les textes de l’éditeur passent par tr()', litteraux.join(' | '));
  const tete = (app.split('const blocsTete = {')[1] || '').split('const urgT = urgencesJournee(')[0];
  ok(!/sortirElt/.test(tete) && /if \(id === 'sortir'\) return ordiJournee \? null : <React\.Fragment key=\{id\}>\{sortirElt\}<\/React\.Fragment>;/.test(app), 'S9 « La paire à sortir » n’est plus dans la tête : la zone « En bas » la rend');
  ok(/const sortirVu = visibiliteCarte\('sortir', \{ reglage: persoJ, mode: PROFIL_VENDEUR\.mode \}\)\.montree;/.test(app) && /const sortirElt = sortirJ && sortirVu \?/.test(app), 'S9 cachée par lui, « La paire à sortir » ne s’affiche pas (téléphone et ordinateur)');
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
  // (16 nov.) Les quatre mutations marquées « forme d'aujourd'hui » ne s'appliquaient plus sur main : la même règle réaffaiblie, portée.
  alertes_cachables: ['app', (s) => s.replace('const alertesAF = alertesArgent.filter((j) => !HORS_JOURNEE_JOBS.has(j.id))', 'const alertesAF = alertesArgent.filter((j) => !HORS_JOURNEE_JOBS.has(j.id) && visJ(j.id).montree)')],
  // (14 nov., lot 117) Ma journée passe par `ordreJourneeHeure` (src/journeeSelonHeure.js), qui part de `ordreJournee`.
  ordre_ignore: ['app', (s) => s.replace(/for \(const id of ordreJournee(?:Heure)?\('afaire', persoJ\)\) \{/, "for (const id of Object.keys(blocsAF)) {")],
  carte_oubliee: ['app', (s) => s.replace("                'stock-sortie': sortiesStock.length ? [carteSortieStock()] : [],\n", '')],   // forme d'aujourd'hui
  cachee_comptee: ['app', (s) => s.replace("const nGestes = nGestesTout - (nCacheesAF - casesCachees.length);", 'const nGestes = nGestesTout;')],
  frise_demontee: ['app', (s) => s.replace('<div key={id} hidden data-jp-cachee="frise">{blocsTete.frise}</div>', 'null')],   // forme d'aujourd'hui
  clavier_muet: ['editeur', (s) => s.replace('onKeyDown={(e) => auClavier(e, id, z.id)} ', '')],
  defilement_vole: ['editeur', (s) => s.replace(" style={{ touchAction: 'none' }}", '')],
  trancher_intouchable: ['app', (s) => s.replace("...(jobTrancher && visJ('trancher').montree ? [carteTrancher(jobTrancher)] : [])", '...(jobTrancher ? [carteTrancher(jobTrancher)] : [])')],   // forme d'aujourd'hui
  fixe_deplacable: ['regle', (s) => s.replace("const cat = CARTES_JOURNEE.filter((c) => c.zone === zone && !c.fixe).map((c) => c.id);", "const cat = CARTES_JOURNEE.filter((c) => c.zone === zone).map((c) => c.id);")],
  doigt_muet: ['editeur', (s) => s.replace(' onPointerDown={(e) => glisser(e, id, z.id)}', '')],
  sans_parametres: ['reglages', (s) => s.replace(", el:<JourneePersoSetting/> },", ", el:null },")],
  depart_garde: ['regle', (s) => s.replace('const ordre = ordreEgalDepart(lu) ? [] : lu;', 'const ordre = lu;')],
  depart_trop_large: ['regle', (s) => s.replace("return siens.join('|') === depart.join('|');", 'return true;')],
  monter_deux: ['regle', (s) => s.replace('ordreMobile(c.zone, reglage).indexOf(id) - 1); };', 'ordreMobile(c.zone, reglage).indexOf(id) - 2); };')],
  sortir_en_haut: ['regle', (s) => s.replace("{ id: 'sortir', zone: 'bas',", "{ id: 'sortir', zone: 'tete',")],
  fleches_muettes: ['editeur', (s) => s.replace(/data-jp-monter=\{id\}/, 'data-x')],
  desc_revenue: ['editeur', (s) => s.replace('<span className="vrm-jp-nom">{nom}</span>', '<span className="vrm-jp-nom">{nom}<small>{c.desc}</small></span>')],
  texte_en_dur: ['editeur', (s) => s.replace("{tr('jp.depart')}", 'Revenir au réglage de départ')],
  sortir_tout_en_haut: ['app', (s) => s.replace("{ordreJourneeHeure('tete', persoJ).filter(", "{sortirElt}\n                {ordreJourneeHeure('tete', persoJ).filter(")],
  sortir_incachable: ['app', (s) => s.replace('const sortirElt = sortirJ && sortirVu ?', 'const sortirElt = sortirJ ?')],
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
