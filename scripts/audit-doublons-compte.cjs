#!/usr/bin/env node
// ── audit-doublons-compte — DEUX ANNONCES D'UN MÊME COMPTE, UNE PAIRE (16 novembre) ──
// Mission 10 de la file (validée par Julien) : signaler deux annonces EN LIGNE du MÊME
// compte qui sont la même paire — par IDENTITÉ seulement (§5) — pour éviter une double vente.
// Exécute les VRAIES règles (src/doublonsCompte.js, src/deuxComptes.js, src/enLigneDeuxFois.js)
// sur des données INVENTÉES à la forme de l'app. Il exige :
//   · 50 annonces au même titre, sans même photo ni même N° ⇒ AUCUNE alerte (jamais le titre) ;
//   · la même photo EXACTE ⇒ un groupe « sûr » ; la même photo à l'EMPREINTE (unique et
//     mutuelle) ⇒ un groupe « à vérifier » ; 50 paires photographiées au même endroit ⇒ rien ;
//   · le même N° sur deux annonces ⇒ RIEN ici (c'est le bloc rouge « deux paires sous un N° »,
//     `numeroSeul`, déjà dit — pas de seconde alerte) ;
//   · deux comptes différents ⇒ rien ici (« Deux comptes, une paire » le dit) ;
//   · une republication EN COURS (opération de l'appareil, journal < 2 h, `recreeDe` neuf) ⇒
//     pas d'alerte, comptée dans `exclus` ; une ancienne encore là après 2 h ⇒ dite ;
//   · une annonce plus en ligne (masquée, « à confirmer ») ou un compte pas relu ⇒ rien ;
//   · la phrase « 2 annonces de tomj606 sont la même paire (N°124) », « peut-être » pour un indice,
//     « Voir les deux » ; l'app branche la règle sur Ma journée ET Annonces, sans rien supprimer.
//   node scripts/audit-doublons-compte.cjs [--mutation=NOM | --prouve]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const FICHIERS = ['src/doublonsCompte.js', 'src/deuxComptes.js', 'src/memePhoto.js', 'src/photoFine.js', 'src/photoEmpreinte.js', 'src/enLigneDeuxFois.js', 'src/profilVendeur.js'];

const D = 'src/doublonsCompte.js';
const MUTATIONS = {
  'sans-empreinte': [D, "  for (const p of apparieParEmpreinte(photos, { seuil, memeCompte: true })) {", "  for (const p of []) {"],
  'empreinte-deux-comptes': [D, "apparieParEmpreinte(photos, { seuil, memeCompte: true })", "apparieParEmpreinte(photos, { seuil, memeCompte: false })"],
  'pas-unique': ['src/deuxComptes.js', [["    if (m.size !== 1) continue;                         // proche de plusieurs annonces : rien\n", ''], ["    if (!my || my.size !== 1 || !my.has(x)) continue;   // l'appariement doit être mutuel et unique\n", "    if (!my) continue;\n"]]],
  'pas-de-repub': [D, "function enRepublication(idsGroupe, rep, depuis, maintenant) {\n", "function enRepublication(idsGroupe, rep, depuis, maintenant) {\n  return false;\n"],
  'fenetre-infinie': [D, 'export const FENETRE_REPUB_MS = 2 * 3600e3;', 'export const FENETRE_REPUB_MS = 2 * 3600e9;'],
  'operation-finie': [D, '  if (o && !o.fini && maj != null', '  if (o && maj != null'],
  'info-ignoree': [D, 'const a = infoDe(String(x)), b = infoDe(String(y));', "const a = infoDe(String(x)) || infoDe(String(y)), b = infoDe(String(y)) || infoDe(String(x));"],
  'numero-seul': [D, '  for (const p of apparieParEmpreinte(', "  for (const g of arr(enLigneDeux.numeroSeul)) groupes.push({ ...g, etat: 'sur', id: 'n' + g.cle, uid: '', nom: '', memeCompte: true });\n  for (const p of apparieParEmpreinte("],
  'verifier-sur': [D, "groupes.push({ id: cleCouple(p.ids), etat: 'verifier',", "groupes.push({ id: cleCouple(p.ids), etat: 'sur',"],
  'par-titre': [D, '  for (const p of apparieParEmpreinte(', "  { const t = new Map(); for (const g0 of [...(infoDe.tous || [])]) { const i = infoDe(g0); if (!i) continue; const k = i.uid + '|' + i.titre; if (t.has(k)) groupes.push({ id: t.get(k) + '+' + g0, etat: 'verifier', uid: i.uid, nom: i.nom, numeros: [], annonces: [infoDe(t.get(k)), i], memeCompte: true, preuves: ['titre'] }); else t.set(k, g0); } }\n  for (const p of apparieParEmpreinte("],
  'app-ancienne-liste': ['app', "        {(()=>{ const g = enLigneDeux ? deuxFoisADire : [];", "        {(()=>{ const g = enLigneDeux ? enLigneDeux.vinted : [];"],
  'app-sans-repub': ['app', "    republication: republicationsEnCours({ journal: journalRepub || null, operation: opRepubDoublons, fiches: numeros }) }) : null),", "    republication: null }) : null),"],
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
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); };
  const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom + ' a levé : ' + e.message); } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-doublons-compte-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.cpSync(path.join(RACINE, 'src', 'i18n'), path.join(dir, 'src', 'i18n'), { recursive: true });
  let appSrc = require('./_source-app.cjs').sourceApp(RACINE);   // (23 nov.) App.jsx et ses écrans découpés, recollés
  const sources = {};
  for (const f of FICHIERS) { const p = path.join(RACINE, f); if (!fs.existsSync(p)) { dit(false, f + ' existe'); process.exit(1); } sources[f] = fs.readFileSync(p, 'utf8'); }
  if (mut) {
    const [f, a0, b0] = MUTATIONS[mut] || [];
    if (!f) { console.log('mutation inconnue'); process.exit(2); }
    for (const [a, b] of Array.isArray(a0) ? a0 : [[a0, b0]]) {
      if (f === 'app') { if (!appSrc.includes(a)) { console.log('❌ ancre introuvable : ' + mut); process.exit(1); } appSrc = appSrc.replace(a, b); }
      else { if (!sources[f].includes(a)) { console.log('❌ ancre introuvable : ' + mut); process.exit(1); } sources[f] = sources[f].replace(a, b); }
    }
  }
  for (const f of FICHIERS) fs.writeFileSync(path.join(dir, f), sources[f]);
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href);
  const I = await imp('src/i18n/index.js');
  I.ajouterSourceApp((await imp('src/i18n/langues/fr.js')).default);
  const DC = await imp(D);
  const EL = await imp('src/enLigneDeuxFois.js');
  fs.rmSync(dir, { recursive: true, force: true });

  // ── Les données (inventées) ──────────────────────────────────────────────
  const MAINTENANT = Date.parse('2026-11-16T18:00:00Z'), H = 3600e3;
  let graine = 7; const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine; };
  const hexa = () => { let s = ''; while (s.length < 96) s += hasard().toString(16).padStart(8, '0').slice(-8); return s.slice(0, 96); };
  // Un compte : des annonces { id, title, photo, depuis, numero?, recreeDe?, h? (empreinte) }.
  const scene = ({ comptes, fiches = {}, journal = null, operation = null, lu = MAINTENANT - H }) => {
    const vinted = comptes.map((c) => ({ uid: c.uid, nom: c.nom, ok: true, lu: c.lu != null ? c.lu : lu, enLigne: c.annonces.map((a) => ({ id: a.id, title: a.title, photo: a.photo, url: '', price: { amount: '80.0' }, depuis: a.depuis })) }));
    const F = { ...fiches };
    for (const c of comptes) for (const a of c.annonces) if (a.numero || a.recreeDe) F[a.id] = { ...(F[a.id] || {}), numero: a.numero || '', ...(a.recreeDe ? { recreeDe: a.recreeDe } : {}) };
    const enLigneDeux = EL.enLigneDeuxFois({ vinted, fiches: F, clePhoto: (p) => String(p), maintenant: MAINTENANT, dateDe: (it) => it.depuis });
    const empreintes = {}, annonces = [], comptesLus = {};
    for (const c of comptes) {
      comptesLus['vinted:' + c.uid] = (c.lu != null ? c.lu : lu) > MAINTENANT - 24 * H;
      for (const a of c.annonces) { annonces.push({ plateforme: 'vinted', compte: c.uid, id: a.id }); if (a.h) { empreintes['vinted:' + c.uid] = empreintes['vinted:' + c.uid] || {}; empreintes['vinted:' + c.uid][a.id] = { p1: a.h }; } }
    }
    const photos = { lu: true, annonces, empreintes, comptesLus };
    const info = new Map(); for (const c of comptes) for (const a of c.annonces) if (!a.horsLigne) info.set(a.id, { uid: c.uid, nom: c.nom, titre: a.title, photo: a.photo, url: '', numero: a.numero || '', prix: 80, depuis: a.depuis });
    const infoDe = (id) => info.get(String(id)) || null; infoDe.tous = [...info.keys()];
    const republication = DC.republicationsEnCours({ journal, operation, fiches: F, maintenant: MAINTENANT });
    return { enLigneDeux, res: DC.doublonsMemeCompte({ enLigneDeux, photos, infoDe, republication, maintenant: MAINTENANT }) };
  };
  const T = 'Jordan 1 Mid Chicago taille 42';
  const cinquante = (o = {}) => Array.from({ length: 50 }, (_, i) => ({ id: String(9000000 + i), title: T, photo: `https://images1.vinted.net/t/a${i}/f${i}.jpeg`, depuis: MAINTENANT - 10 * 24 * H, h: hexa(), ...((o[i]) || {}) }));
  const ids = (r) => r.res.groupes.map((g) => `${g.etat}:${g.annonces.map((a) => a.id).join('+')}`);

  essaie('identité', () => {
    let r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: cinquante() }] });
    dit(r.res.pret && r.res.groupes.length === 0, '50 annonces au même titre, photos et N° différents ⇒ AUCUNE alerte (jamais le titre)', ids(r));
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: cinquante({ 3: { photo: 'https://images1.vinted.net/t/a7/f7.jpeg', numero: '124' }, 7: { numero: '124' } }) }] });
    // a3 et a7 : même fichier ⇒ même photo exacte ; même N° aussi.
    dit(ids(r).join() === 'sur:9000003+9000007', 'la même photo EXACTE sur deux annonces du compte ⇒ un groupe « sûr »', ids(r));
    const t = DC.texteDoublonsCompte(r.res.groupes);
    dit(t && t.phrase === '2 annonces de tomj606 sont la même paire (N°124)' && t.complet.startsWith(t.phrase) && t.geste === 'Voir les deux', '… la phrase « 2 annonces de tomj606 sont la même paire (N°124) » (infobulle, feuille) · « Voir les deux »', t);
    dit(t && t.titre === 'N°124 · 2 annonces, 1 paire' && t.detail === 'Même compte · retire celle en trop', '… la carte, courte (une ligne à 390 px) : « N°124 · 2 annonces, 1 paire » / « Même compte · retire celle en trop »', t);
    const h = hexa();
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: cinquante({ 10: { h }, 20: { h } }) }] });
    dit(ids(r).join() === 'verifier:9000010+9000020', 'la même photo à l’EMPREINTE (unique et mutuelle) ⇒ un groupe « à vérifier »', ids(r));
    const tv = DC.texteDoublonsCompte(r.res.groupes);
    dit(tv && /peut-être/.test(tv.phrase) && tv.detail === 'Même compte · peut-être · à vérifier', '… dit « peut-être » et « à vérifier », jamais « sûr »', tv);
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: cinquante(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i, { h }]))) }] });
    dit(r.res.groupes.length === 0, '50 paires photographiées au même endroit (empreintes proches entre toutes) ⇒ rien', ids(r));
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: cinquante({ 5: { numero: '124' }, 6: { numero: '124' } }) }] });
    dit(r.res.groupes.length === 0 && r.enLigneDeux.numeroSeul.length === 1, 'le même N° sur deux annonces ⇒ rien ICI (le bloc rouge « deux paires sous un N° » le dit déjà)', { g: ids(r), rouge: r.enLigneDeux.numeroSeul.length });
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: [{ id: '1001', title: T, photo: 'p/a.jpeg', h, depuis: MAINTENANT - 9 * 24 * H }] }, { uid: '2', nom: 'kicks_sud', annonces: [{ id: '2001', title: T, photo: 'p/b.jpeg', h, depuis: MAINTENANT - 9 * 24 * H }] }] });
    dit(r.res.groupes.length === 0, 'deux comptes DIFFÉRENTS ⇒ rien ici (« Deux comptes, une paire » le dit)', ids(r));
  });

  essaie('en ligne, pas su', () => {
    const h = hexa();
    let r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: cinquante({ 10: { h }, 20: { h, horsLigne: true } }) }] });
    dit(r.res.groupes.length === 0, 'une des deux plus en ligne (masquée, « à confirmer ») ⇒ rien', ids(r));
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', lu: MAINTENANT - 30 * H, annonces: cinquante({ 3: { photo: 'x' }, 7: { photo: 'x' } }) }] });
    dit(!r.res.pret && r.res.groupes.length === 0, 'un compte lu il y a plus de 24 h ne conclut rien', ids(r));
  });

  essaie('republication en cours', () => {
    const recree = (depuis) => cinquante({ 3: { recreeDe: '9000007', depuis } });
    let r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: recree(MAINTENANT - 20 * 60e3) }] });
    dit(r.res.groupes.length === 0 && r.res.exclus === 1, '`recreeDe` : la nouvelle en ligne depuis 20 min (l’ancienne pas encore partie) ⇒ pas d’alerte, comptée « exclue »', { g: ids(r), exclus: r.res.exclus });
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: recree(MAINTENANT - 3 * 24 * H) }] });
    dit(ids(r).join() === 'sur:9000003+9000007', '`recreeDe` : 3 jours après, l’ancienne toujours en ligne ⇒ dite (vraie double vente possible)', ids(r));
    const h = hexa();
    const deux = cinquante({ 10: { h }, 20: { h } });
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: deux }], journal: { 9000020: { anc: '9000010', at: MAINTENANT - 10 * 60e3 } } });
    dit(r.res.groupes.length === 0 && r.res.exclus === 1, 'le journal des republications : l’une remplace l’autre depuis 10 min ⇒ pas d’alerte', ids(r));
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: deux }], journal: { 9000020: { anc: '9000010', at: MAINTENANT - 5 * H } } });
    dit(ids(r).join() === 'verifier:9000010+9000020', '… republiée il y a 5 h et l’ancienne toujours là ⇒ dite', ids(r));
    const op = (o) => ({ v: 1, action: 'recreer', majAt: new Date(MAINTENANT - 5 * 60e3).toISOString(), fini: false, paires: [{ id: '9000010', etat: 'encours' }], ...o });
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: deux }], operation: op() });
    dit(r.res.groupes.length === 0 && r.res.exclus === 1, 'l’opération Republier de cet appareil porte l’une des deux (en cours) ⇒ pas d’alerte', ids(r));
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: deux }], operation: op({ fini: true }) });
    dit(ids(r).length === 1, '… opération FINIE ⇒ l’alerte revient', ids(r));
    r = scene({ comptes: [{ uid: '1', nom: 'tomj606', annonces: deux }], operation: op({ majAt: new Date(MAINTENANT - 5 * H).toISOString() }) });
    dit(ids(r).length === 1, '… opération abandonnée il y a 5 h ⇒ l’alerte revient', ids(r));
  });

  essaie('textes', () => {
    const t = DC.texteDoublonsCompte([{ etat: 'sur', nom: 'tomj606', numeros: [], annonces: [{}, {}] }, { etat: 'verifier', nom: 'x', numeros: [], annonces: [{}, {}] }]);
    dit(t && t.titre === '2 paires en double sur un compte' && t.geste === 'Voir', 'plusieurs groupes : « 2 paires en double sur un compte »', t);
    dit(DC.texteDoublonsCompte([]) === null, 'rien ⇒ aucune carte');
  });

  essaie('branchement de l’app', () => {
    const sans = appSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    dit(/doublonsMemeCompte\(\{ enLigneDeux, photos: photosComptes,[^\n]*\n\s*republication: republicationsEnCours\(\{ journal: journalRepub \|\| null, operation: opRepubDoublons, fiches: numeros \}\)/.test(sans), 'l’app passe la republication en cours (journal + opération + fiches) à la règle');
    dit(/const deuxFois = deuxFoisADire;/.test(sans) && /const g = enLigneDeux \? deuxFoisADire : \[\];/.test(sans), 'Ma journée ET Annonces lisent la MÊME liste (`deuxFoisADire`, §11)');
    dit(/useJournalRepub\(only==='annonces' \|\| only==='journee'\)/.test(sans), 'le journal des republications est lu aussi pour Ma journée');
    const bloc = (sources[D] || '');
    dit(!/supprim\w*\(|vmrCmd|postMessage|fetch\(/.test(bloc.replace(/\/\/.*$/gm, '')), 'la règle ne supprime rien, n’écrit rien (§3)');
  });

  console.log(ko ? `\n❌ doublons même compte : ${ko} rouge(s)` : '\n✅ doublons même compte : tout est vert');
  process.exit(ko ? 1 : 0);
})();
