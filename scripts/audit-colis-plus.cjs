#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : COLIS PLUS (14 nov., propositions 96 à 101 validées par Julien)
//         node scripts/audit-colis-plus.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE les règles sur des données INVENTÉES (le dépôt est public) :
//   D. 99 la douchette : une rafale (< 50 ms entre deux touches) + Entrée est un code ;
//      une frappe humaine, une touche dans un champ, Ctrl tenu n'en sont pas ; 50 ventes au
//      MÊME titre : chaque code (n° de transaction, n° de suivi, code-barres 26 chiffres du
//      bordereau) désigne LA bonne et seulement elle ; le titre ne désigne rien ; un code
//      inconnu ⇒ rien ; deux ventes au même code ⇒ rien (ambigu) ;
//   V. 100 mains libres : commandes FERMÉES (5 langues), phrase longue ou deux commandes ⇒
//      rien ; la vraie `ecouterCommandes` avec une fausse reconnaissance : relance après un
//      silence, « stop » arrête, micro refusé ⇒ dit et arrêté ;
//   T. 101 le temps : écart entre deux « Colis fait » ; pause (> 15 min) et colis déjà prêt
//      (< 15 s) pas mesurés ; « Annuler » recalcule ; le gain n'est fait que des colis au
//      prix d'achat connu (couverture dite), aucun ⇒ null, jamais 0 ;
//   E. 97 les fournitures : décomptées SEULEMENT par un « Colis fait » daté après le comptage ;
//      « Annuler » (la date retirée) rend le stock ; « à chaque colis » (scotch) : une unité
//      entamée compte comme prise ; seuil = SON choix, alerte ambre ; rythme seulement mesuré ;
//   F. 96 le format retenu par modèle : retenu sur SON choix, PROPOSÉ au colis suivant du même
//      modèle, jamais posé tout seul (le décompte suit son choix, sinon le défaut) ;
//   P. 98 4 par page A4 : 9 bordereaux ⇒ 3 feuilles, ordre conservé (lu dans le PDF produit
//      par pdf-lib), une A4 entière part seule à 100 %, une échelle commune ≥ 85 % ;
//   C. le code des écrans branche ces règles (montée de la douchette, Préparer, Réglages).
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé ; `--prouve` les joue toutes.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'douchette-ambigu-premier': ["if (L.length > 1) return { etat: 'ambigu', lignes: L, candidats: cands };", '', 'douchette.js'],
  'douchette-titre': ["if (identitesDe(l).some((x) => cands.includes(x))) parCle.set(String(l.cle), l);", "if (identitesDe(l).some((x) => cands.includes(x)) || cands.some((c) => normaliserN(l.titre || '').includes(c))) parCle.set(String(l.cle), l);", 'douchette.js'],
  'douchette-approche': ["if (identitesDe(l).some((x) => cands.includes(x))) parCle.set(String(l.cle), l);", "if (identitesDe(l).some((x) => cands.some((c) => x.startsWith(c.slice(0, 8))))) parCle.set(String(l.cle), l);", 'douchette.js'],
  'douchette-humain': ['export const ECART_MAX_MS = 50;', 'export const ECART_MAX_MS = 5000;', 'douchette.js'],
  'douchette-champ': ['if (champ || mod || !Number.isFinite(at)) { vider(); return null; }', 'if (mod || !Number.isFinite(at)) { vider(); return null; }', 'douchette.js'],
  'voix-phrase-libre': ['return reste.trim().split(\' \').filter(Boolean).every((w) => libres.includes(w)) ? [...trouvees][0] : null;', 'return [...trouvees][0];', 'mainsLibres.js'],
  'voix-deux-commandes': ['if (trouvees.size !== 1) return null;', 'if (!trouvees.size) return null;', 'mainsLibres.js'],
  'voix-pas-de-relance': ['setTimeout(() => { if (voulu) { if (!demarrer()) finir(); } else finir(); }, 250);', 'finir();', 'mainsLibres.js'],
  'temps-pause-comptee': ['ms: d >= MIN_MS && d <= PAUSE_MS ? d : null', 'ms: d >= 0 ? d : null', 'tempsColis.js'],
  'temps-gain-zero': ['gainHeure: nGain && gainMs > 0 ?', 'gainHeure: true ?', 'tempsColis.js'],
  'temps-gain-devine': ['if (b != null && Number.isFinite(b)) { gainC += Math.round(b * 100); gainMs += c.ms; nGain += 1; }', 'if (b != null && Number.isFinite(b)) { gainC += Math.round(b * 100); nGain += 1; } gainMs += c.ms;', 'tempsColis.js'],
  'emb-non-date': ['if (k && Number.isFinite(t) && t > 1e12) out.push({ cle: pre + k, at: t });', 'if (k && Number.isFinite(t) && t > 0) out.push({ cle: pre + k, at: t > 1e12 ? t : Date.now() });', 'emballages.js'],
  'emb-tous-avant-comptage': ['const apres = (f) => f.at > t.compte.at && (t.tous || typeDuColis(r, f.cle) === t.id);', 'const apres = (f) => (t.tous || typeDuColis(r, f.cle) === t.id);', 'emballages.js'],
  'emb-tous-entame': ['if (t.tous) utilises.set(t.id, Math.ceil(colis / pour));', 'if (t.tous) utilises.set(t.id, Math.floor(colis / pour));', 'emballages.js'],
  'format-propose-meme': ['if (!t || typeDuColis(r, cle) === t.id) return null;', 'if (!t) return null;', 'emballages.js'],
  'format-propose-apres-choix': ['if (!modele || !modele.cle || !cle || r.choix[cle]) return null;', 'if (!modele || !modele.cle || !cle) return null;', 'emballages.js'],
  'format-retient-aucun': ["if (modele && modele.cle && garde && garde !== AUCUN && ch.types.some((t) => t.id === garde))", "if (modele && modele.cle && garde)", 'emballages.js'],
  'planche-ordre': ['cur.cases.push({ index: i, k: cur.cases.length, tourne: info[i].tourne });', 'cur.cases.unshift({ index: i, k: cur.cases.length, tourne: info[i].tourne });', 'impression/planche4.js'],
  'planche-a4-ecrasee': ['export const ECHELLE_MIN = 0.85;', 'export const ECHELLE_MIN = 0.3;', 'impression/planche4.js'],
  'planche-pas-branchee': ["const planche = modeLot === 'planche4';", 'const planche = false;', 'App.jsx'],
  'douchette-pas-montee': ["<DouchetteGlobale ouvrirVentes={()=>setTab('ventes')}/>", '', 'App.jsx'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  if (!MUTS[MUT]) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'colis-plus-'));
  // La copie mutée est effacée à la sortie (21 Mo par mutation : le disque est compté).
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/\/node_modules(\/|$)/.test(s) });
  const f = path.join(d, 'src', MUTS[MUT][2]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;
const J = 86400000, MIN = 60000;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let D, V, T, E, P, DV;
  try {
    D = await import(url('douchette.js')); V = await import(url('mainsLibres.js')); T = await import(url('tempsColis.js'));
    E = await import(url('emballages.js')); P = await import(url('impression/planche4.js')); DV = await import(url('dicteeNavigateur.js'));
  } catch (e) { dit(false, 'les modules du lot colis-plus existent et se chargent', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }

  // ── D · la douchette ───────────────────────────────────────────────────────
  console.log('\n── D. 99 · La douchette');
  const rafale = (code, { ecart = 8, champ = false, mod = false, t0 = 1000 } = {}) => {
    const d = D.creerDetecteur(); let t = t0, lu = null;
    for (const ch of code) { d.touche({ key: ch, t, champ, mod }); t += ecart; }
    lu = d.touche({ key: 'Enter', t, champ, mod });
    return lu;
  };
  dit(rafale('5515193563010100000000001X') === '5515193563010100000000001X', 'D1 une rafale (8 ms entre deux touches) + Entrée = un code lu');
  dit(rafale('XA100000001FR', { ecart: 140 }) === null, 'D2 une frappe humaine (140 ms) n’est jamais un code');
  dit(rafale('XA100000001FR', { champ: true }) === null, 'D3 dans un champ de saisie : rien (la douchette y tape comme un clavier)');
  dit(rafale('XA100000001FR', { mod: true }) === null && rafale('12345') === null, 'D4 Ctrl/⌘ tenu, ou moins de 6 caractères : rien');
  { // humain puis douchette dans le même tampon : seule la rafale compte
    const d = D.creerDetecteur(); let t = 0; for (const ch of 'abc') { d.touche({ key: ch, t }); t += 200; }
    t += 300; for (const ch of 'XA100000007FR') { d.touche({ key: ch, t }); t += 6; }
    dit(d.touche({ key: 'Enter', t }) === 'XA100000007FR', 'D5 ce qui a été tapé à la main avant la rafale n’est pas collé au code');
  }
  dit(D.estChampSaisie({ tagName: 'INPUT', type: 'text' }) && D.estChampSaisie({ tagName: 'TEXTAREA' }) && D.estChampSaisie({ tagName: 'DIV', isContentEditable: true })
    && !D.estChampSaisie({ tagName: 'BUTTON' }) && !D.estChampSaisie({ tagName: 'INPUT', type: 'checkbox' }) && !D.estChampSaisie(null), 'D6 un champ de saisie est reconnu (input texte, textarea, contenteditable ; pas un bouton)');
  // 50 ventes au MÊME titre, chacune son n° de transaction et son n° de suivi (inventés).
  const TITRE = 'Nike Air Max 90 blanche 42';
  const VENTES = Array.from({ length: 50 }, (_, k) => ({ cle: 'v:' + (8000000100 + k), tx: String(8000000100 + k), suivis: [`XA${String(100000001 + k)}FR`], titre: TITRE, num: String(200 + k) }));
  // Le code-barres d'un bordereau Vinted/Hermes : 26 chiffres, le n° imprimé aux chiffres 3 à 10 (mesuré, src/scanColis.js).
  VENTES[7].suivis.push('15193563');
  const code26 = '55' + '15193563' + '0101' + '000000000000';
  let bonnes = 0;
  for (const v of VENTES) {
    const a = D.venteDuCode(v.tx, VENTES), b = D.venteDuCode(v.suivis[0], VENTES);
    if (a.etat === 'trouve' && a.ligne.cle === v.cle && b.etat === 'trouve' && b.ligne.cle === v.cle) bonnes++;
  }
  dit(bonnes === 50, 'D7 50 ventes au même titre : chaque n° de transaction et chaque n° de suivi désigne LA bonne vente, et elle seule', `${bonnes}/50`);
  const r26 = D.venteDuCode(code26, VENTES);
  dit(r26.etat === 'trouve' && r26.ligne.cle === VENTES[7].cle, 'D8 le code-barres 26 chiffres du bordereau désigne SA vente (n° imprimé aux chiffres 3 à 10)', JSON.stringify(r26.ligne && r26.ligne.cle));
  dit(D.venteDuCode('NIKEAIRMAX90BLANCHE42', VENTES).etat === 'inconnu' && D.venteDuCode(TITRE, VENTES).etat === 'inconnu', 'D9 le titre ne désigne RIEN (jamais une ressemblance, §5)');
  dit(D.venteDuCode('XA999999999FR', VENTES).etat === 'inconnu' && D.venteDuCode('XA10000000', VENTES).etat === 'inconnu', 'D10 code inconnu (ou un n° tronqué) ⇒ « inconnu », rien d’ouvert');
  const deux = [...VENTES, { cle: 'v:8000009999', tx: '8000009999', suivis: ['XA100000003FR'], titre: TITRE }];
  dit(D.venteDuCode('XA100000003FR', deux).etat === 'ambigu', 'D11 deux ventes portent le même n° ⇒ « ambigu », rien d’ouvert');
  dit(D.codeCourt(code26) === '551519…0000' && D.codeCourt('XA1FR00') === 'XA1FR00', 'D12 un long code se dit en abrégé (début…fin)');
  { // le passage entre l'écoute et l'écran
    const pris = []; const off = D.enregistrerResolveur((c) => pris.push(c)); D.resolveurActif()('A1'); off();
    D.DEMANDE_DOUCHETTE.code = 'XA100000001FR'; D.DEMANDE_DOUCHETTE.at = 1000;
    const vieux = D.prendreDemande(1000 + 2 * D.ATTENTE_MS);
    D.DEMANDE_DOUCHETTE.code = 'XA100000001FR'; D.DEMANDE_DOUCHETTE.at = 1000;
    dit(pris[0] === 'A1' && D.resolveurActif() === null && vieux === '' && D.prendreDemande(1500) === 'XA100000001FR' && D.prendreDemande(1600) === '', 'D13 un code va à l’écran enregistré ; sans écran il attend une minute, repris UNE fois');
  }

  // ── V · mains libres ───────────────────────────────────────────────────────
  console.log('\n── V. 100 · Mains libres');
  const C = (t, l = 'fr') => V.commandeDe(t, l);
  dit(C('Suivant') === 'suivant' && C('ok suivant') === 'suivant' && C('Précédent') === 'precedent' && C('imprime') === 'imprimer' && C('C’est fait') === 'fait' && C('fait') === 'fait' && C('stop') === 'stop',
    'V1 les cinq commandes en français (« ok suivant », « c’est fait » compris)');
  dit(C('next', 'en') === 'suivant' && C('done', 'en') === 'fait' && C('siguiente', 'es') === 'suivant' && C('stampa', 'it') === 'imprimer' && C('Zurück', 'de') === 'precedent' && C('fertig', 'de') === 'fait',
    'V2 les mêmes en anglais, espagnol, italien, allemand');
  dit(C('il fait froid') === null && C('parfait') === null && C('fait le suivant maintenant stp') === null, 'V3 une phrase qui n’est pas une commande ne fait RIEN (« il fait froid », « parfait »)');
  dit(C('suivant imprimer') === null && C('') === null && C('   ') === null, 'V4 deux commandes à la fois, ou rien entendu ⇒ rien');
  { // la vraie écoute, avec une fausse reconnaissance du navigateur
    const instances = [];
    class FausseSR { constructor() { this.n = instances.length; instances.push(this); } start() { this.parti = true; } stop() { this.arrete = true; setTimeout(() => this.onend && this.onend(), 0); } abort() { this.stop(); } }
    const dire = (rec, t) => rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
    const entendu = []; let fin = 0, err = null;
    DV.VOIX.refus = false;
    const e = V.ecouterCommandes({ langue: 'fr', SR: FausseSR, onEntendu: (t, c) => entendu.push(c), onErreur: (c) => { err = c; }, onFin: () => { fin++; } });
    dit(!!e && instances.length === 1 && instances[0].parti && instances[0].lang === 'fr-FR' && instances[0].continuous === true, 'V5 l’écoute démarre la reconnaissance du NAVIGATEUR (fr-FR, continue)');
    dire(instances[0], 'suivant'); dire(instances[0], 'il fait froid');
    instances[0].onend();   // un silence : le navigateur s'arrête de lui-même
    await attendre(320);
    dit(entendu[0] === 'suivant' && entendu[1] === null && instances.length === 2 && instances[1].parti && fin === 0, 'V6 chaque phrase dite remonte (commande ou rien) ; après un silence l’écoute est relancée');
    dire(instances[1], 'stop'); await attendre(20);
    dit(entendu[2] === 'stop' && fin === 1 && instances[1].arrete && !e.actif, 'V7 « stop » arrête l’écoute (et rien ne repart)');
    await attendre(300);
    dit(instances.length === 2, 'V8 arrêtée, la reconnaissance n’est jamais relancée');
    const e2 = V.ecouterCommandes({ langue: 'fr', SR: FausseSR, onErreur: (c) => { err = c; }, onFin: () => { fin++; } });
    instances[2].onerror({ error: 'not-allowed' }); instances[2].onend(); await attendre(300);
    dit(!!e2 && err === 'refus' && DV.VOIX.refus === true && instances.length === 3 && V.ecouterCommandes({ SR: FausseSR }) === null, 'V9 micro refusé ⇒ dit (« refus »), arrêté, plus aucune écoute de la session');
    DV.VOIX.refus = false;
    dit(V.ecouterCommandes({ SR: null }) === null && V.etatMainsLibres() === 'absent', 'V10 sans reconnaissance dans le navigateur (Firefox, Safari d’iPhone selon la version) ⇒ rien ne démarre, le bouton dit « absent »');
  }

  // ── T · le temps ───────────────────────────────────────────────────────────
  console.log('\n── T. 101 · Ton temps par colis');
  const o = 1_800_000_000_000;
  const s1 = T.mesurerSeance(o, { 'v:1': o + 4 * MIN, 'v:2': o + 8 * MIN, 'v:3': o + 8 * MIN + 5000, 'v:4': o + 40 * MIN, 'v:5': o + 43 * MIN, 'v:0': o - 5 * MIN });
  const ms = Object.fromEntries(s1.colis.map((c) => [c.cle, c.ms]));
  dit(s1.colis.length === 5 && ms['v:1'] === 4 * MIN && ms['v:2'] === 4 * MIN && ms['v:3'] === null && ms['v:4'] === null && ms['v:5'] === 3 * MIN && !('v:0' in ms),
    'T1 l’écart entre deux « Colis fait » ; < 15 s (déjà prêt) et > 15 min (pause) pas mesurés ; un colis d’avant l’ouverture n’entre pas', JSON.stringify(ms));
  let jr = T.noterSeance({ v: 1, seances: [] }, s1);
  const s1b = T.mesurerSeance(o, { 'v:1': o + 4 * MIN, 'v:3': o + 8 * MIN + 5000, 'v:4': o + 40 * MIN, 'v:5': o + 43 * MIN });   // « Annuler » sur v:2
  jr = T.noterSeance(jr, s1b);
  const mb = Object.fromEntries(jr.seances[0].colis.map((c) => [c.cle, c.ms]));
  dit(jr.seances.length === 1 && !('v:2' in mb) && mb['v:3'] === 4 * MIN + 5000, 'T2 « Annuler » recalcule la séance (le colis annulé sort, le suivant se mesure depuis le précédent)');
  const benef = T.beneficesParColis({ l: [['vinted', 'c', '1', o, 90, 40, 5, 'x'], ['vinted', 'c', '3', o, 70, null, null, 'x'], ['leboncoin', 'c', '5', o, 50, 10, 0, 'x'], ['vinted', 'c', '5', o, 60, 30, 0, 'x']] });
  dit(benef('v:1') === 45 && benef('v:3') === null && benef('v:5') === 30 && benef('v:9') === null && benef('lbc:5') === null, 'T3 le bénéfice d’un colis PAR SA TRANSACTION (règle `beneficePaire`) ; prix d’achat inconnu ⇒ null');
  const r1 = T.resumeTemps(jr, { beneficeDe: benef });
  // mesurés : v:1 (4 min, 45 €), v:3 (4 min 05, ?), v:5 (3 min, 30 €) — v:4 (pause) pas mesuré
  dit(r1.colis === 4 && r1.mesures === 3 && r1.totalMs === 11 * MIN + 5000 && r1.nGain === 2 && r1.gainHeure === Math.round(75 / (7 / 60) * 100) / 100,
    'T4 temps total = PLANCHER (pauses exclues), par colis sur les mesurés ; gain = bénéfice connu / LEUR temps, couverture dite', JSON.stringify(r1));
  const r0 = T.resumeTemps(jr, { beneficeDe: () => null });
  dit(r0.gainHeure === null && r0.nGain === 0 && T.resumeTemps({ v: 1, seances: [] }).parColisMs === null, 'T5 aucun bénéfice connu ⇒ gain « — » (null), jamais 0 ; rien mesuré ⇒ « — »');
  dit(T.dureeCourte(4 * MIN + 20000) === '4 min 20' && T.dureeCourte(65 * MIN) === '1 h 05' && T.dureeCourte(40000) === '40 s' && T.dureeCourte(NaN) === '—', 'T6 les durées se lisent (« 4 min 20 », « 1 h 05 »)');
  { const mem = new Map(); const st = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
    T.ecrireJournal(jr, st, 'u1'); dit(T.lireJournal(st, 'u1').seances.length === 1 && T.lireJournal(st, 'u2').seances.length === 0 && [...mem.keys()].every((k) => k.startsWith('vrm_temps_colis')), 'T7 la mémoire reste sur l’appareil, par compte VRM'); }

  // ── E · fournitures ────────────────────────────────────────────────────────
  console.log('\n── E. 97 · Le stock de fournitures');
  const t0 = 1_790_000_000_000;
  let reg = E.poserType(null, { nom: 'Carton moyen', n: '10', seuil: '3' }, t0).reglage;
  reg = E.poserType(reg, { nom: 'Scotch', n: '2', seuil: '0', tous: true, pour: '25' }, t0).reglage;
  const idC = reg.types[0].id, idS = reg.types[1].id;
  const faits = (L) => E.colisFaits({ vinted: Object.fromEntries(L.map((k, i) => [k, t0 + (i + 1) * 3600e3])) });
  const etat = (L, maintenant) => E.etatEmballages(reg, faits(L), maintenant);
  const e0 = etat([], t0 + J);
  dit(e0.types[0].restant === 10 && e0.types[1].restant === 2 && e0.types[1].colisPossibles === 50, 'E1 rien de fait ⇒ rien décompté (10 cartons, 2 rouleaux ≈ 50 colis)');
  const sept = ['1', '2', '3', '4', '5', '6', '7'];
  const e7 = etat(sept, t0 + 2 * J);
  dit(e7.types[0].restant === 3 && e7.types[0].alerte === true && e7.types[1].restant === 1 && e7.types[1].colisPossibles === 43 && e7.types[1].alerte === false,
    'E2 7 « Colis fait » ⇒ 3 cartons (alerte au seuil qu’IL a choisi) ; le scotch : un rouleau entamé compte comme pris (1 entier, ≈ 43 colis)', JSON.stringify(e7.types.map((t) => [t.restant, t.colisPossibles, t.alerte])));
  const e6 = etat(sept.slice(0, 6), t0 + 2 * J);
  dit(e6.types[0].restant === 4, 'E3 « Annuler » (la date de « Colis fait » retirée) rend le carton');
  const nonDate = E.etatEmballages(reg, E.colisFaits({ vinted: { a: 1, b: true, c: t0 + 3600e3 } }), t0 + J);
  dit(nonDate.types[0].restant === 9 && nonDate.types[1].colisPossibles === 49, 'E4 seul un « Colis fait » DATÉ décompte (une ancienne coche ne décompte rien)');
  const avant = E.etatEmballages(reg, [{ cle: 'v:x', at: t0 - 3600e3 }], t0 + J);
  dit(avant.types[0].restant === 10 && avant.types[1].colisPossibles === 50, 'E5 un colis fait AVANT le comptage ne décompte rien (le scotch non plus)');
  const regAucun = E.choisirPourColis(reg, 'v:1', E.AUCUN).reglage;
  const eA = E.etatEmballages(regAucun, faits(['1']), t0 + J);
  dit(eA.types[0].restant === 10 && eA.types[1].colisPossibles === 49, 'E6 « Aucun » emballage : le carton n’est pas pris, le scotch l’est (il sert à chaque colis)');
  dit(E.typeDuColis(E.lireReglage(reg), 'v:z') === idC && !E.emballagesAvecCout(E.poserType(reg, { id: idS, nom: 'Scotch', cout: '2', tous: true, pour: '25' }).reglage).some((t) => t.id === idS),
    'E7 une fourniture « à chaque colis » n’est jamais l’emballage choisi d’un colis ni un coût proposé dans la vente');
  const rythme = E.etatEmballages(reg, E.colisFaits({ vinted: Object.fromEntries(Array.from({ length: 7 }, (_, i) => ['r' + i, t0 + J + i * J])) }), t0 + 8 * J);
  dit(rythme.types[0].jours === 3 && E.etatEmballages(reg, faits(['1', '2']), t0 + 2 * J).types[0].jours === null, 'E8 « à ton rythme ≈ N jours » : 3 cartons, 7 colis en 8 j ⇒ ≈ 3 j ; seulement mesuré (≥ 3 colis en 14 j), sinon rien', String(rythme.types[0].jours));
  dit(E.poserType(reg, { nom: 'Bulle', n: '3', tous: true, pour: 'beaucoup' }).erreur && Object.keys(E.lireReglage(reg)).includes('parModele'), 'E9 « une unité fait combien de colis » : un nombre entier, sinon refusé');
  dit(/color: var\(--d-ambre, var\(--vrm-warn, #B25000\)\)/.test(lire('styles-colis-plus.css')) && !/#D70015|#FF3B30|var\(--vrm-danger/.test(lire('styles-colis-plus.css')), 'E10 l’alerte de fournitures est ambre, jamais rouge (§7)');

  // ── F · format retenu par modèle ─────────────────────────────────────────────
  console.log('\n── F. 96 · Le format retenu par modèle');
  let rf = E.poserType(null, { nom: 'Petit carton', n: '20' }, t0).reglage;
  rf = E.poserType(rf, { nom: 'Grand carton', n: '20' }, t0).reglage;
  rf = E.poserDefaut(rf, rf.types[0].id).reglage;
  const petit = rf.types[0].id, grand = rf.types[1].id;
  const AF1 = { cle: 'nike|air force 1', nom: 'Nike Air Force 1' }, DUNK = { cle: 'nike|dunk', nom: 'Nike Dunk' };
  dit(E.propositionFormat(rf, 'v:1', AF1) === null, 'F1 rien retenu ⇒ rien proposé (le défaut s’applique)');
  rf = E.choisirPourColis(rf, 'v:1', grand, { modele: AF1, maintenant: t0 }).reglage;   // SON clic
  const p2 = E.propositionFormat(rf, 'v:2', AF1);
  dit(p2 && p2.id === grand && p2.modele === 'Nike Air Force 1' && E.typeDuColis(rf, 'v:2') === petit, 'F2 son choix est retenu ; le colis suivant du même modèle se voit PROPOSER « Grand carton », mais le décompte reste le défaut tant qu’il n’a pas touché', JSON.stringify(p2));
  dit(E.propositionFormat(rf, 'v:3', DUNK) === null && E.propositionFormat(rf, 'v:4', null) === null, 'F3 un autre modèle, ou un modèle pas sûr ⇒ rien proposé');
  const rf2 = E.choisirPourColis(rf, 'v:2', '', { modele: AF1, retenu: petit, maintenant: t0 + 1 }).reglage;   // il choisit le petit (= défaut)
  dit(E.propositionFormat(rf2, 'v:5', AF1) === null && E.lireReglage(rf2).parModele[AF1.cle].id === petit, 'F4 il change d’avis : le nouveau choix est retenu (le défaut ici), plus rien à proposer');
  const rf3 = E.choisirPourColis(rf, 'v:6', grand, { modele: AF1 }).reglage;
  const rf5 = E.choisirPourColis(rf, 'v:8', E.AUCUN, { modele: AF1 }).reglage;
  dit(E.propositionFormat(rf3, 'v:6', AF1) === null && E.commeDerniereFois(rf3, 'v:6', AF1) && E.propositionFormat(rf5, 'v:8', AF1) === null,
    'F5 après SON choix sur ce colis (même « Aucun »), plus de proposition (« comme ta dernière »)');
  const rf4 = E.choisirPourColis(rf, 'v:7', E.AUCUN, { modele: DUNK }).reglage;
  dit(!(rf4.parModele || {})[DUNK.cle] && !E.lireReglage(rf4).parModele[DUNK.cle], 'F6 « Aucun » n’est jamais retenu comme format d’un modèle');
  dit(E.lireReglage({ ...rf, parModele: { 'x|y': { id: 'inexistant', at: 1 } } }).parModele['x|y'] === undefined, 'F7 un format retenu qui n’existe plus est écarté (jamais proposé)');

  // ── P · 4 par page A4 ────────────────────────────────────────────────────────
  console.log('\n── P. 98 · 4 bordereaux par page A4');
  const MM = 72 / 25.4, ET = { w: 100 * MM, h: 150 * MM }, A4p = { w: 210 * MM, h: 297 * MM };
  const plan9 = P.planDePlanche(Array.from({ length: 9 }, () => ET));
  const ordre = plan9.feuilles.flatMap((f) => f.cases.map((c) => c.index));
  dit(plan9.feuilles.length === 3 && plan9.feuilles.every((f) => f.type === 'planche') && JSON.stringify(ordre) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8]) && plan9.feuilles[2].cases.length === 1,
    'P1 9 bordereaux ⇒ 3 feuilles (4 + 4 + 1), ordre conservé', JSON.stringify(ordre));
  dit(plan9.echelle >= 0.94 && plan9.echelle < 0.97, 'P2 une échelle commune ≈ 95 % (marge d’impression 5 mm), jamais une étiquette écrasée', String(plan9.echelle));
  const planMix = P.planDePlanche([ET, ET, A4p, ET, ET, ET, ET, ET]);
  dit(JSON.stringify(planMix.feuilles.map((f) => (f.type === 'entiere' ? 'A' + f.index : f.cases.map((c) => c.index).join('')))) === JSON.stringify(['01', 'A2', '3456', '7']) && planMix.entieres === 1,
    'P3 une A4 entière (étiquette pas repérée) part SEULE, à sa place : la feuille entamée est close avant elle', JSON.stringify(planMix.feuilles));
  dit(P.planDePlanche([{ w: 150 * MM, h: 100 * MM }]).feuilles[0].cases[0].tourne === true, 'P4 une étiquette couchée est tournée d’un quart (jamais réduite davantage)');
  const caseOk = [0, 1, 2, 3].every((k) => { const b = P.caseA4(k); return b.x >= 5 * MM - 0.01 && b.y >= 5 * MM - 0.01 && b.x + b.w <= A4p.w - 5 * MM + 0.01 && b.y + b.h <= A4p.h - 5 * MM + 0.01; });
  dit(caseOk, 'P5 chaque case reste à 5 mm des bords de la feuille');
  { // le vrai PDF : 9 étiquettes de largeurs distinctes (l'ordre se lit dans les XObjects posés)
    let PL = null; try { PL = require(path.join(R, 'node_modules', 'pdf-lib')); } catch (_) { try { PL = require('pdf-lib'); } catch (_) {} }
    if (!PL) dit(false, 'P6 pdf-lib se charge');
    else {
      const src = await PL.PDFDocument.create();
      for (let i = 0; i < 9; i++) { const p = src.addPage([ET.w - i, ET.h]); p.drawText('B' + (i + 1), { x: 20, y: 20, size: 30 }); }
      const { doc, plan } = await P.imposerPlanche(PL, await PL.PDFDocument.load(await src.save()));
      const relu = await PL.PDFDocument.load(await doc.save());
      const largeurs = [];
      for (const pg of relu.getPages()) {
        const res = pg.node.Resources(); const xo = res && res.lookup(PL.PDFName.of('XObject'));
        const flux = pg.node.Contents(); const brut = flux ? (flux instanceof PL.PDFArray ? flux.asArray().map((r) => relu.context.lookup(r)) : [flux]) : [];
        const texte = brut.map((s) => Buffer.from(PL.decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
        for (const m of texte.matchAll(/\/([A-Za-z0-9_.-]+) Do/g)) { const f = xo.lookup(PL.PDFName.of(m[1])); const bb = f.dict.lookup(PL.PDFName.of('BBox')); largeurs.push(Math.round(ET.w - bb.lookup(2).asNumber())); }
      }
      const tailles = relu.getPages().map((p) => p.getSize());
      dit(relu.getPageCount() === 3 && tailles.every((s) => Math.abs(s.width - A4p.w) < 0.5 && Math.abs(s.height - A4p.h) < 0.5) && JSON.stringify(largeurs) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8]) && plan.etiquettes === 9,
        'P6 le PDF produit : 3 pages A4, les 9 étiquettes posées dans l’ordre (relu dans le fichier)', JSON.stringify({ n: relu.getPageCount(), largeurs }));
    }
  }

  // ── C · le code des écrans ───────────────────────────────────────────────────
  console.log('\n── C. Les écrans branchent ces règles');
  const A = sansCommentaires(lire('App.jsx')), PC = sansCommentaires(lire('PreparerColis.jsx')), EC = sansCommentaires(lire('EmballagesCarte.jsx')), RG = sansCommentaires(lire('ecrans/Reglages.jsx')), DJ = sansCommentaires(lire('Douchette.jsx'));
  dit(/<DouchetteGlobale ouvrirVentes=/.test(A) && /enregistrerResolveur\(/.test(A) && /venteDuCode\(code, lignesDouchette\(\)\)/.test(A), 'C1 la douchette est montée une fois (coque) et résolue par Ventes, par `venteDuCode`');
  dit(/cible=vente&tx=\$\{encodeURIComponent\(l\.tx\)\}/.test(A) && !/titre[^;\n]{0,40}venteDuCode/.test(A), 'C2 trouvée ⇒ la vente s’ouvre par SA transaction (la cible des notifications)');
  dit(/window\.addEventListener\('keydown', k, true\)/.test(DJ) && /estChampSaisie\(e\.target\)/.test(DJ) && /e\.preventDefault\(\)/.test(DJ), 'C3 l’écoute est sur toute la page, jamais dans un champ ; l’Entrée de la douchette n’active pas le bouton focalisé');
  dit(/<MainsLibres onCommande=\{commande\}\/>/.test(PC) && /if \(cm === 'fait'\) \{[^}]*colisFait\(\)/.test(PC), 'C4 « Préparer mes colis » porte Mains libres ; « fait » passe par « Colis fait » (différé 5 s, « Annuler »)');
  dit(/<TempsColis uid=\{uid\} ouverture=\{ouverture\}/.test(PC) && /useJournalTemps\(uid, ouverture, seance\.faits\)/.test(PC) && /beneficeDe=\{beneficeColisPrep\}/.test(A), 'C5 le temps est rangé à chaque « Colis fait » et montré au récapitulatif');
  dit(/<ChoixEmballageColis reglage=\{emballagesR\} cle=\{c\.cle\} titre=\{c\.titre \|\| ''\} lireFaits=\{lireFaitsEmb\}/.test(A) && /propositionFormat\(reglage, cle, modele\)/.test(EC) && /data-emb-prendre=/.test(EC), 'C6 Préparer propose le format retenu (« Prendre ») et dit les fournitures au seuil');
  dit(/const IMPR_MODES = \['normale', 'thermique', 'planche4'\];/.test(A) && /const planche = modeLot === 'planche4';\s*const thermique = modeLot === 'thermique' \|\| planche;/.test(A) && /if \(planche\) \{[\s\S]{0,160}imposerPlanche\(PL, out\)/.test(A) && /v === 'planche4' \? tr\('cp\.planche\.choix'\)/.test(RG), 'C7 « 4 par page A4 » est un choix de Réglages → Imprimante, appliqué à « Tout imprimer »');
  dit(!/fetch\(|api\.openai|anthropic|apiKey|x-api-key/i.test(sansCommentaires(lire('mainsLibres.js')) + sansCommentaires(lire('MainsLibres.jsx'))), 'C8 mains libres : aucune clé, aucun appel réseau à nous (§2.9)');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
