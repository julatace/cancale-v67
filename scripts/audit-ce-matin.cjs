// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU 27 NOV. — « CE MATIN » EN TÊTE D'AUJOURD'HUI (lot scan-ce-matin). Données INVENTÉES, lecture seule.
//  Julien (27 nov.) : la liste ordonnée — 1. acheteurs qui attendent ma réponse · 2. bordereaux à imprimer · 3. colis à
//  retirer, avec l'heure où ferme le point · 4. offres à trancher · 5. comptes à vérifier ; chaque ligne ouvre le geste ;
//  rien ⇒ « Rien d'urgent » ; aucune carte qui gronde ; les nombres de LEURS propriétaires (jamais recomptés).
//  Récit : docs/passation/2026-11-27-scan-ce-matin.md.
//
//  O · l'ordre (src/aujourdhui/ceMatin.js `lignesCeMatin`) : toujours le sien, quel que soit l'ordre des sources ;
//  Z · une ligne à 0 n'existe pas ; tout à 0 ⇒ « rien » ; PAS SU ≠ rien (une source null ⇒ jamais « rien ») ;
//      on lit ⇒ « lecture » ; une liste avec une source pas lue la NOMME (`pasSu`) ;
//  F · l'heure de fermeture : seulement un point OUVERT qui ferme (`fermeDuPoint` sur `etatOuverture`, les VRAIS horaires) ;
//  V · comptes à vérifier : la règle de la carte de santé (`arretDeJauge`) — un « Reprendre » après le captcha l'éteint,
//      lignes pas lues ⇒ null (jamais 0), un compte compté une fois ;
//  B · les branchements (texte du code, commentaires retirés) : Aujourd'hui rend `CeMatin` en tête ; la coque lui passe
//      les nombres de leurs propriétaires (xM, nPrets, nR, offresSR, verifCeMatin) — aucun calcul neuf ; la santé des
//      comptes et « Ce matin » partagent `arretDeJauge`.
//
//  `--src <dossier>` : un autre arbre (le code d'avant : il doit rougir). `--prouve` : chaque MUTATION doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const iS = process.argv.indexOf('--src');
const RACINE = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
let ko = 0, ok = 0;
const dit = (c, nom, det) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${nom}${c || det === undefined ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400)}`); };
const imp = (rel) => import(pathToFileURL(path.join(RACINE, rel)).href);
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const MUTATIONS = [
  ['src/aujourdhui/ceMatin.js', "['messages', 'bordereaux', 'retraits', 'offres', 'verifications']", "['bordereaux', 'messages', 'retraits', 'offres', 'verifications']", 'O : l’ordre changé'],
  ['src/aujourdhui/ceMatin.js', "if (n === 0) continue;", "", 'Z : une ligne à 0 montrée'],
  ['src/aujourdhui/ceMatin.js', ": pasSu.length ? 'passu' : 'rien'", ": 'rien'", 'Z : « pas su » dit « Rien d’urgent »'],
  ['src/aujourdhui/ceMatin.js', "? String(etat.fermeA) : '';", "? String(etat.fermeA) : String((etat && etat.ouvreA) || '');", 'F : un point fermé dit une heure'],
  ['src/fiabilite/regles.js', "if (!j || !j.captcha || !verificationEnCours(j.captcha, reprise)) return null;", "if (!j || !j.captcha) return null;", 'V : un « Reprendre » ne compte plus'],
  ['src/fiabilite/regles.js', "if (!Array.isArray(actions)) return null;", "if (!Array.isArray(actions)) return 0;", 'V : lignes pas lues ⇒ 0'],
  ['src/natif/ecrans/Aujourdhui.jsx', "{ceMatin !== undefined ? <Colonne pleine", "{false ? <Colonne pleine", 'B : « Ce matin » pas rendu'],
  ['src/ecrans/Comptabilite.jsx', "messages: !xM ? undefined : lu(xM) ? { n: Number(xM.t.n) || 0,", "messages: !xM ? undefined : lu(xM) ? { n: (Number(xM.t.n) || 0) + 1,", 'B : un nombre recompté'],
];
function prouver() {
  let rouges = 0;
  for (const [f, a, b, quoi] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-matin-mut-'));
    for (const d of ['src', 'api']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true });
    try { fs.symlinkSync(path.join(RACINE, 'package.json'), path.join(tmp, 'package.json')); } catch (_) {}
    const p = path.join(tmp, f);
    const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(a)) { console.log(`❌ mutation introuvable (${f}) : ${quoi}`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, s.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${quoi} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' (' + (r.stdout.split('\n').filter((l) => l.startsWith('❌')).slice(0, 1).join(' | ').slice(0, 200)) + ')' : ''}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const tous = rouges === MUTATIONS.length;
  console.log(`\n${tous ? '✅ --prouve : les ' + MUTATIONS.length + ' mutations rougissent' : '❌ --prouve : ' + (MUTATIONS.length - rouges) + ' mutation(s) ne rougissent pas'}`);
  process.exit(tous ? 0 : 1);
}
if (PROUVE) prouver();

(async () => {
  let CM, H, R, J;
  try { [CM, H, R, J] = await Promise.all(['src/aujourdhui/ceMatin.js', 'api/_lib/horaires-relais.js', 'src/fiabilite/regles.js', 'src/jaugeActions.js'].map(imp)); }
  catch (e) { dit(false, 'C0 · « Ce matin » existe (src/aujourdhui/ceMatin.js)', e.message); console.log(`\n❌ audit-ce-matin : ${ko} rouge(s)`); process.exit(1); }
  const L = CM.lignesCeMatin;
  const f = () => {};

  // ── O · l'ordre ──
  {
    const r = L({ verifications: { n: 1, ouvrir: f }, offres: { n: 4, ouvrir: f }, retraits: { n: 2, ouvrir: f }, bordereaux: { n: 3, ouvrir: f }, messages: { n: 5, ouvrir: f } });
    dit(r.etat === 'liste' && r.lignes.map((l) => l.cle).join(',') === 'messages,bordereaux,retraits,offres,verifications', 'O1 · l’ordre de Julien, quel que soit l’ordre des sources', r.lignes.map((l) => l.cle));
    dit(r.lignes.map((l) => l.n).join(',') === '5,3,2,4,1', 'O2 · chaque nombre est celui de SON propriétaire, tel quel', r.lignes.map((l) => l.n));
    dit(r.lignes.every((l) => typeof l.ouvrir === 'function'), 'O3 · chaque ligne porte SON geste');
  }
  // ── Z · rien, pas su, lecture ──
  {
    const zero = { messages: { n: 0 }, bordereaux: { n: 0 }, retraits: { n: 0 }, offres: { n: 0 }, verifications: { n: 0 } };
    const r0 = L(zero);
    dit(r0.etat === 'rien' && r0.lignes.length === 0, 'Z1 · tout à 0 ⇒ « Rien d’urgent », aucune ligne', r0);
    const r1 = L({ ...zero, offres: { n: 2, ouvrir: f } });
    dit(r1.lignes.length === 1 && r1.lignes[0].cle === 'offres', 'Z2 · une ligne à 0 n’existe pas (aucune carte qui gronde)', r1.lignes);
    const r2 = L({ ...zero, messages: null });
    dit(r2.etat === 'passu' && r2.pasSu.join(',') === 'messages', 'Z3 · une source PAS SUE ⇒ jamais « Rien d’urgent »', r2);
    const r3 = L({ ...zero, verifications: undefined }, { lecture: true });
    dit(r3.etat === 'lecture', 'Z4 · on lit encore ⇒ « Je lis… »', r3.etat);
    const r4 = L({ ...zero, verifications: undefined }, { lecture: false });
    dit(r4.etat === 'passu' && r4.pasSu.includes('verifications'), 'Z5 · la lecture finie sans réponse ⇒ « pas su », nommé', r4);
    const r5 = L({ ...zero, offres: { n: 2, ouvrir: f }, messages: null });
    dit(r5.etat === 'liste' && r5.pasSu.join(',') === 'messages', 'Z6 · une liste avec une source pas lue la NOMME (jamais présentée comme complète)', r5);
    const r6 = L({ ...zero, offres: { n: NaN }, bordereaux: { n: -1 } });
    dit(r6.etat === 'passu' && r6.pasSu.includes('offres') && r6.pasSu.includes('bordereaux'), 'Z7 · un nombre illisible ⇒ « pas su », jamais 0', r6);
  }
  // ── F · l'heure de fermeture ──
  {
    const h = [{ jours: [1, 2, 3, 4, 5, 6, 7], plages: [{ de: '09:00', a: '19:30' }] }];
    const midi = Date.parse('2026-11-27T12:00:00+01:00'), soir = Date.parse('2026-11-27T21:00:00+01:00');
    dit(CM.fermeDuPoint(H.etatOuverture(h, midi)) === '19:30', 'F1 · ouvert à midi ⇒ « Ferme à 19:30 » (les vrais horaires lus)', CM.fermeDuPoint(H.etatOuverture(h, midi)));
    dit(CM.fermeDuPoint(H.etatOuverture(h, soir)) === '', 'F2 · fermé le soir ⇒ rien de promis');
    dit(CM.fermeDuPoint(H.etatOuverture(null, midi)) === '' && CM.fermeDuPoint(H.etatOuverture([{ jours: [1, 2, 3, 4, 5, 6, 7], plages: [{ de: '00:00', a: '24:00' }] }], midi)) === '', 'F3 · horaires pas lus, 24 h/24 ⇒ rien');
    const r = L({ retraits: { n: 2, ferme: '19:30', ouvrir: f } });
    const rKo = L({ retraits: { n: 2, ferme: 'bientôt', ouvrir: f } });
    dit(r.lignes[0].ferme === '19:30' && rKo.lignes[0].ferme === '', 'F4 · seule une heure HH:MM est dite', { r: r.lignes[0].ferme, rKo: rKo.lignes[0].ferme });
  }
  // ── V · comptes à vérifier ──
  {
    const now = Date.parse('2026-11-27T08:00:00Z');
    let nav = 0; const ligne = (uid, captcha) => ({ id: `${J.PREFIXE_ACTIONS}${uid}_${(0x1000000000000000 + (nav++)).toString(16).slice(0, 16)}`, captcha: String(captcha), arret: "captcha", ts: [] });
    const actions = [ligne('111', now - 3600000), ligne('222', now - 7200000), ligne('222', now - 3600000)];
    let n = null; try { n = R.comptesEnVerification({ actions, uids: ['111', '222', '333', '111'], reprises: {}, maintenant: now }); } catch (e) { n = 'erreur ' + e.message; }
    const jj = (() => { try { return J.jaugeDuCompte(actions, '111', now); } catch (_) { return null; } })();
    if (jj && jj.captcha) {
      dit(n === 2, 'V1 · deux comptes arrêtés (un compté une fois) ⇒ 2', n);
      const n2 = R.comptesEnVerification({ actions, uids: ['111', '222'], reprises: { 111: now - 1000 }, maintenant: now });
      dit(n2 === 1, 'V2 · son « Reprendre » après le captcha éteint ce compte', n2);
    } else dit(false, 'V1 · la jauge lit le captcha de la ligne inventée (forme `actions_compte_*`)', jj);
    dit(R.comptesEnVerification({ actions: null, uids: ['111'] }) === null, 'V3 · lignes pas lues ⇒ null (jamais 0)');
  }
  // ── B · les branchements ──
  {
    const au = sansCommentaires(lire('src/natif/ecrans/Aujourdhui.jsx'));
    const iCM = au.indexOf('<CeMatin ceMatin='), iPil = au.indexOf('<Pilotage courbe=');
    dit(iCM > 0 && iPil > 0 && iCM < iPil && /\{ceMatin !== undefined \? <Colonne pleine/.test(au), 'B1 · Aujourd’hui rend « Ce matin » en tête (avant le tableau de bord)');
    dit(/lignesCeMatin\(ceMatin, \{ lecture \}\)/.test(au) && /tr\('cm\.rien'\)/.test(au) && /'data-cm-ordre'/.test(au), 'B2 · l’écran passe par `lignesCeMatin` et dit « Rien d’urgent »');
    const co = sansCommentaires(lire('src/ecrans/Comptabilite.jsx'));
    const m = /ceMatin=\{baseKO \? null : \{([\s\S]*?)\n\s*\}\}/.exec(co);
    const corps = m ? m[1] : '';
    dit(/messages: !xM \? undefined : lu\(xM\) \? \{ n: Number\(xM\.t\.n\) \|\| 0,/.test(corps) && /\{ n: nPrets,/.test(corps) && /\{ n: nR, ferme: fermeJ,/.test(corps)
      && /n: Number\(offresSR\.n\) \|\| 0/.test(corps) && /\{ n: verifCeMatin,/.test(corps), 'B3 · la coque passe les nombres de LEURS propriétaires (Messages, bordereaux prêts, À retirer, offres, santé)');
    dit(!/\.length|\.filter\(|reduce\(/.test(corps), 'B4 · aucun comptage neuf dans « Ce matin » (ni filter, ni length, ni reduce)');
    const rg = sansCommentaires(lire('src/fiabilite/regles.js'));
    dit(/arret = arretDeJauge\(j, R\[String\(l\.id\)\]\);/.test(rg) && /arretDeJauge\(jaugeDuCompte\(actions, id, maintenant\), R\[id\]\)/.test(rg), 'B5 · la carte de santé et « Ce matin » partagent `arretDeJauge` (une règle)');
    const manque = ['fr', 'en', 'es', 'it', 'de'].filter((l) => { const s = lire(`src/i18n/langues/${l}/ceMatin.js`); return !['cm.titre', 'cm.rien', 'cm.l.messages', 'cm.l.verifications', 'cm.ferme'].every((k) => s.includes(`"${k}"`)); });
    dit(!manque.length, 'B6 · les 5 langues ont « Ce matin »', manque);
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-ce-matin : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
