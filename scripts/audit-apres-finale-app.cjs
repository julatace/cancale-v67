#!/usr/bin/env node
// ── audit-apres-finale-app — les trois règles du lot « après la finale » (22 nov., choix 1, 23 et 27 de Julien) ─────────
// Exécute les VRAIES règles (src/statsNouveau.js, src/reprise.js, src/plusVue.js) sur des données INVENTÉES et lit le code
// qui les branche. Récit : docs/passation/2026-11-22-apres-finale-app.md.
//   S  Statistiques d'un compte neuf : trois états (attente · pas su · vide), une vente d'un site QUELCONQUE montre les
//      statistiques ; l'ancien « Bienvenue » n'est plus rendu ; l'écran vide est le `Vide` natif avec UN geste.
//   R  Reprendre sur l'autre appareil : AUCUNE FUITE — la ligne ne porte que { e, t, id, at, f } (ni titre, ni prix, ni
//      photo, ni compte), l'identifiant d'appareil n'est jamais synchronisé ; rien si c'est le même appareil, rien après
//      30 min, rien de masqué, rien de déjà ouvert ici ; la plus récente d'un autre appareil.
//   P  « Plus vue depuis N j » : UNE règle (src/plusVue.js), sur des jours LUS seulement — dernier relevé d'aujourd'hui ou
//      d'hier, sinon pas su ; « en gagnait avant » prouvé ; le nombre dit est mesuré entre deux lectures ; un vide n'est
//      jamais un 0 ; « Republier » n'ouvre le panneau que sur SON toucher.
//   node scripts/audit-apres-finale-app.cjs [--prouve]   (--prouve : chaque mutation doit rougir)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const R = process.env.AF_RACINE || path.join(__dirname, '..');
const F = (m) => path.join(R, 'src', m);
const lire = (m) => fs.readFileSync(F(m), 'utf8');

const MUTATIONS = {
  'stats-autre-site-ignore': ['statsNouveau.js', "const connues = (Array.isArray(ventes) ? ventes : [ventes]).reduce((s, v) => s + n(v), 0);", "const connues = n((Array.isArray(ventes) ? ventes : [ventes])[0]);"],
  'stats-passu-vide': ['statsNouveau.js', "  if (baseKO) return 'pasSu';\n", ''],
  'stats-attente-vide': ['statsNouveau.js', "  if (!comptesLus) return 'attente';\n", ''],
  'stats-bienvenue': ['App.jsx', "{tab==='dashboard'&&platSub!=='prix'&&!etatStats&&<GardeEcran nom=\"dashboard\">", "{tab==='dashboard'&&premierJour&&<Onboarding setTab={setTab}/>}{tab==='dashboard'&&platSub!=='prix'&&<GardeEcran nom=\"dashboard\">"],
  'reprise-fuite-titre': ['reprise.js', "  return { e, t, id, at, f };\n}", "  return { ...o, e, t, id, at, f };\n}"],
  'reprise-meme-appareil': ['reprise.js', "    if (!RE_APPAREIL.test(k) || k === moi) continue;\n    const x = entreeReprise(v);\n    if (!x) continue;\n    const age", "    if (!RE_APPAREIL.test(k)) continue;\n    const x = entreeReprise(v);\n    if (!x) continue;\n    const age"],
  'reprise-30min': ['reprise.js', 'export const DUREE_REPRISE_MS = 30 * 60000;', 'export const DUREE_REPRISE_MS = 30 * 3600000;'],
  'reprise-masquee': ['reprise.js', "    if (masquee && masquee === k + '|' + x.at) continue;\n", ''],
  'reprise-publie-titre': ['RepriseAppareil.jsx', "const entree = { e: String(ecran || ''), t: 'fiche', id: String(id), at: Date.now(), f: forme() };", "const entree = { e: String(ecran || ''), t: 'fiche', id: String(id), at: Date.now(), f: forme(), titre: document.title };"],
  'reprise-appareil-synchro': ['RepriseAppareil.jsx', "try { localStorage.setItem(CLE_APPAREIL, _appareil); } catch (_) {}", "try { localStorage.setItem(CLE_APPAREIL, _appareil); window.__vrmSave && window.__vrmSave(CLE_APPAREIL, _appareil); } catch (_) {}"],
  'pv-jour-non-lu': ['plusVue.js', "  if (der.t > auj + JOUR || auj - der.t > JOUR) return null;", "  if (der.t > auj + JOUR) return null;"],
  'pv-gagnait-pas-prouve': ['plusVue.js', "  if (i === 0) return null;                                            // rien d'avant le palier : « en gagnait » pas su", "  if (i === 0) return { etat: 'plus', jours: Math.round((der.t - s[0].t) / JOUR), depuis: s[0].t };"],
  'pv-vide-zero': ['plusVue.js', "x.v != null && Number.isFinite(x.v));", "true).map((x) => ({ ...x, v: x.v == null ? 0 : x.v }));"],
  'pv-compte-jusqua-auj': ['plusVue.js', "  const palier = Math.round((der.t - s[i].t) / JOUR);", "  const palier = Math.round((auj - s[i].t) / JOUR);"],
  'pv-republier-effet': ['ecrans/AnnoncesEgalite.jsx', "  const plusVuesHorsPrio = React.useMemo(() => {", "  React.useEffect(() => { if (releves) for (const a of (modele ? modele.articles : [])) for (const x of a.annonces) if (plusVueAnnonce(x) != null) republierUne(x); }, [releves]);\n  const plusVuesHorsPrio = React.useMemo(() => {"],
  'pv-deux-regles': ['natif/ecrans/AnnoncesCartes.jsx', "export function CarteAnnonce({", "const regle2 = (s) => s && s.vues === s.vuesAvant;\nexport function CarteAnnonce({"],
};
const PROUVE = process.argv.includes('--prouve');
const MUTE = process.env.AF_MUTATION || '';

let ok = 0, ko = 0;
const dit = (bon, quoi) => { if (bon) ok++; else ko++; console.log((bon ? '✅ ' : '❌ ') + quoi); };
const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

async function importer(m, rempl = []) {
  let code = lire(m);
  for (const [a, b] of rempl) code = code.split(a).join(b);
  const f = path.join(os.tmpdir(), `af-${path.basename(m)}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, code);
  try { return await import(pathToFileURL(f).href); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

(async () => {
  if (PROUVE) {
    let rouges = 0;
    for (const [nom, [fic, avant, apres]] of Object.entries(MUTATIONS)) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'af-mut-'));
      fs.cpSync(path.join(R, 'src'), path.join(tmp, 'src'), { recursive: true, filter: (p) => !/node_modules/.test(p) });
      const p = path.join(tmp, 'src', fic); const s = fs.readFileSync(p, 'utf8');
      if (!s.includes(avant)) { console.log(`❌ mutation ${nom} : le texte d'origine est introuvable (${fic})`); ko++; continue; }
      fs.writeFileSync(p, s.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AF_RACINE: tmp, AF_MUTATION: nom }, encoding: 'utf8' });
      fs.rmSync(tmp, { recursive: true, force: true });
      const rouge = r.status !== 0;
      if (rouge) rouges++;
      console.log((rouge ? '✅ ' : '❌ ') + `mutation ${nom} : ${rouge ? 'ROUGE' : 'reste verte'}${rouge ? ' — ' + ((r.stdout || '').split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 140) : ''}`);
      if (!rouge) ko++; else ok++;
    }
    console.log(`\n${ko ? '❌' : '✅'} audit-apres-finale-app --prouve : ${rouges}/${Object.keys(MUTATIONS).length} mutations rouges`);
    process.exit(ko ? 1 : 0);
  }

  // ── S. Statistiques d'un compte neuf ──
  const S = await importer('statsNouveau.js');
  const e = S.etatStatsNouveau;
  dit(e({ comptesLus: true, nComptes: 0, ventes: [[], [], undefined, null] }) === 'vide', 'S1 comptes lus, aucun compte, aucune vente ⇒ « vide »');
  dit(e({ comptesLus: true, nComptes: 0, ventes: [[], [{ id: 1 }], undefined, null] }) === null, 'S2 une vente Leboncoin (sans compte Vinted) ⇒ les statistiques');
  dit(e({ comptesLus: true, nComptes: 0, ventes: [[], [], undefined, [{ id: 'vc' }]] }) === null, 'S2b une vente Vestiaire ⇒ les statistiques');
  dit(e({ comptesLus: true, baseKO: true, nComptes: 0, ventes: [[]] }) === 'pasSu', 'S3 base injoignable ⇒ « pas su » (jamais « vide »)');
  dit(e({ comptesLus: false, nComptes: 0, ventes: [[]] }) === 'attente', 'S4 comptes pas encore lus ⇒ « attente »');
  dit(e({ comptesLus: true, nComptes: 2, ventes: [[]] }) === null, 'S5 un compte relié ⇒ les statistiques');
  const APP = sans(lire('App.jsx'));
  dit(!/<Onboarding\b/.test(APP) && !/function Onboarding\b/.test(APP), 'S6 l’ancien écran « Bienvenue » (Onboarding) n’est plus rendu');
  dit(/tab==='dashboard'&&platSub!=='prix'&&!etatStats&&<GardeEcran nom="dashboard">/.test(APP) && /etatStats&&<GardeEcran nom="dashboard:nouveau"><StatsNouveau etat=\{etatStats\}/.test(APP),
    'S7 un seul état à la fois : StatsNouveau OU les statistiques (jamais les deux)');
  const sn = APP.slice(APP.indexOf('function StatsNouveau('), APP.indexOf('function StatsNouveau(') + 2600);
  dit(/etat === 'attente' \? <Natif\.Attente/.test(sn) && /etat === 'pasSu' \?/.test(sn) && /Natif\.Vide/.test(sn) && (sn.match(/<Bouton /g) || []).length === 2, 'S8 attente = squelette natif ; pas su et vide = `Vide` natif, UN geste chacun');

  // ── R. Reprendre sur l'autre appareil ──
  const P = await importer('reprise.js');
  const T0 = Date.UTC(2026, 10, 22, 20, 4);
  const brut = { e: 'annonces', t: 'fiche', id: '124', at: T0, f: 'iphone', titre: 'Nike Air Max 1 taille 42', prix: 45, photo: 'https://x', compte: '12345', acheteur: 'bob' };
  const x = P.entreeReprise(brut);
  dit(x && JSON.stringify(Object.keys(x).sort()) === JSON.stringify(['at', 'e', 'f', 'id', 't']), 'R1 une entrée ne garde QUE écran, sorte, identifiant, heure, forme (titre, prix, photo, compte, acheteur retirés)');
  const d1 = P.noterOuvert({ d: { zzzzzzzzzzzz: { ...brut, at: T0 - 1000, id: '7' } } }, 'aaaaaaaaaaaa', brut, T0);
  const tout = JSON.stringify(d1);
  dit(d1 && !/Nike|45|https|12345|bob|titre|prix|photo|compte/.test(tout) && Object.keys(d1).join() === 'v,d', 'R2 la donnée écrite ne porte rien d’autre (même ce qu’un autre appareil aurait mal écrit)');
  dit(P.noterOuvert({}, 'aaaaaaaaaaaa', { ...brut, id: '<script>' }, T0) === undefined && P.noterOuvert({}, 'court', brut, T0) === undefined, 'R3 identifiant ou appareil illisible ⇒ rien n’est écrit');
  dit(P.noterOuvert(d1, 'aaaaaaaaaaaa', { ...brut, at: T0 + 60000 }, T0 + 60000) === undefined, 'R4 la même fiche rouverte dans les 10 min ⇒ aucune écriture de plus');
  const data = { d: { aaaaaaaaaaaa: { e: 'annonces', t: 'fiche', id: '124', at: T0, f: 'iphone' }, bbbbbbbbbbbb: { e: 'journee', t: 'fiche', id: '88', at: T0 - 5 * 60000, f: 'ordinateur' } } };
  dit(P.aReprendre(data, 'aaaaaaaaaaaa', { maintenant: T0 + 60000 }).id === '88', 'R5 sur l’iPhone : la fiche de l’ordinateur (jamais la sienne)');
  dit(P.aReprendre(data, 'bbbbbbbbbbbb', { maintenant: T0 + 60000 }).id === '124', 'R6 sur l’ordinateur : la fiche de l’iPhone');
  dit(P.aReprendre({ d: { aaaaaaaaaaaa: data.d.aaaaaaaaaaaa } }, 'aaaaaaaaaaaa', { maintenant: T0 + 60000 }) === null, 'R7 un seul appareil ⇒ rien');
  dit(P.aReprendre(data, 'bbbbbbbbbbbb', { maintenant: T0 + 31 * 60000 }) === null, 'R8 plus de 30 min ⇒ rien');
  dit(P.aReprendre(data, 'bbbbbbbbbbbb', { maintenant: T0 + 60000, masquee: 'aaaaaaaaaaaa|' + T0 }) === null, 'R9 masquée sur cet appareil ⇒ rien');
  dit(P.aReprendre(data, 'bbbbbbbbbbbb', { maintenant: T0 + 60000, ouvertIci: '124' }) === null, 'R10 déjà ouverte ici ⇒ rien');
  dit(P.formeAppareil('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)') === 'iphone' && P.formeAppareil('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0) === 'ordinateur', 'R11 la forme de l’appareil : un mot (iPhone, ordinateur), jamais le navigateur');
  const RA = sans(lire('RepriseAppareil.jsx'));
  const publ = RA.slice(RA.indexOf('export function publierOuvert'), RA.indexOf('export function publierOuvert') + 900);
  dit(/const entree = \{ e: String\(ecran \|\| ''\), t: 'fiche', id: String\(id\), at: Date\.now\(\), f: forme\(\) \};/.test(publ) && /noterOuvert\(d, appareilReprise\(\), entree/.test(publ),
    'R12 ce qui part : { écran, sorte, N°, heure, forme } — passé par la liste blanche');
  dit(!/__vrmSave|save\(\s*CLE_APPAREIL|SYNC_KEYS/.test(RA) && !/'reprise_appareil'|'vrm_reprise'/.test(APP.slice(APP.indexOf('const SYNC_KEYS'), APP.indexOf('const SYNC_KEYS') + 20000)),
    'R13 l’identifiant d’appareil reste sur l’appareil (jamais dans les clés synchronisées)');
  const CO = sans(lire('ecrans/Comptabilite.jsx'));
  dit(/<RepriseAppareil titreDe=\{\(id\) => \{ const f = ficheUniqueDuNumero\(numeros, cleNum\(id\)\)/.test(CO), 'R14 le titre se retrouve SUR CET appareil par le N° (une seule fiche, sinon « N° x »), jamais transmis');

  // ── P. « Plus vue depuis N j » ──
  const PV = await importer('plusVue.js', [["from './boostPeriode.js'", `from '${pathToFileURL(F('boostPeriode.js')).href}'`]]);
  const J = (d) => `202611${String(d).padStart(2, '0')}`;
  const ser = (pts) => pts.map(([d, v]) => `${J(d)},${v == null ? '' : v},0,0`).join(';');
  const midi = (d) => Date.UTC(2026, 10, d, 11, 0);
  const r1 = PV.plusVue(ser([[10, 20], [12, 30], [14, 40], [15, 40], [17, 40], [20, 40], [21, 40]]), { jours: 5, maintenant: midi(21) });
  dit(r1 && r1.etat === 'plus' && r1.jours === 7, 'P1 40 vues du 14 au 21, 30 le 12 ⇒ « plus vue depuis 7 j »');
  dit(PV.plusVue(ser([[10, 20], [12, 30], [14, 40], [18, 40]]), { jours: 3, maintenant: midi(21) }) === null, 'P2 dernier relevé il y a 3 jours ⇒ pas su (jamais sur un jour non lu)');
  dit(PV.plusVue(ser([[14, 40], [17, 40], [21, 40]]), { jours: 5, maintenant: midi(21) }) === null, 'P3 aucun relevé avant le palier ⇒ « en gagnait avant » pas su ⇒ rien');
  const r4 = PV.plusVue(ser([[14, 40], [17, 45], [21, 52]]), { jours: 5, maintenant: midi(21) });
  dit(r4 && r4.etat === 'vue', 'P4 des vues gagnées ⇒ « vue »');
  dit(PV.plusVue(ser([[10, 20], [17, 40], [21, 40]]), { jours: 5, maintenant: midi(21) }).etat === 'vue', 'P5 palier de 4 j avec N = 5 ⇒ pas « plus vue »');
  const r6 = PV.plusVue(ser([[10, 20], [12, null], [14, 40], [16, null], [21, 40]]), { jours: 5, maintenant: midi(21) });
  dit(r6 && r6.etat === 'plus' && r6.jours === 7, 'P6 un relevé sans vues n’est pas un 0 ; deux lectures égales aux deux bouts mesurent le palier');
  dit(PV.plusVue(ser([[10, 90], [14, 40], [21, 40]]), { jours: 5, maintenant: midi(21) }) === null, 'P7 compteur remis (plus de vues avant) ⇒ pas su');
  const r8 = PV.plusVue(ser([[10, 20], [12, 40], [20, 40]]), { jours: 5, maintenant: midi(21) });
  dit(r8 && r8.etat === 'plus' && r8.jours === 8, 'P8 dernier relevé d’hier : le nombre dit est mesuré entre deux lectures (8 j), pas compté jusqu’à aujourd’hui');
  dit(PV.joursPlusVue('99') === 5 && PV.joursPlusVue('7') === 7 && PV.plusVue('', {}) === null && PV.plusVue(null, {}) === null, 'P9 réglage hors choix ⇒ 5 ; rien relevé ⇒ pas su');
  const EG = sans(lire('ecrans/AnnoncesEgalite.jsx'));
  const autres = ['natif/ecrans/AnnoncesCartes.jsx', 'natif/ecrans/Annonces.jsx', 'natif/ecrans/AnnoncesTableau.jsx', 'natif/ecrans/RepublierPriorite.jsx'].map((m) => sans(lire(m)));
  dit(/from '\.\.\/plusVue\.js'/.test(EG) && (EG.match(/plusVue\(s, \{ jours: joursPV/g) || []).length === 1 && autres.every((s) => !/lireSerie|vinted_suivi|vuesAvant|\.v === /.test(s)),
    'P10 UNE règle : l’écran appelle `plusVue` (src/plusVue.js) une fois ; les vues n’en recalculent aucune');
  const rep = EG.slice(EG.indexOf('const republierUne'), EG.indexOf('const republierUne') + 300);
  const nRep = (EG.match(/republierUne\(/g) || []).length;
  dit(/ACTIONS_EXTENSION\.republierMaintenant/.test(rep) && nRep === 0 && /onClick=\{\(\) => plusVue\.republier\(/.test(autres[3]),
    'P11 « Republier » : la feuille Avant | Après de CETTE paire (republier-direct), seulement sur SON toucher');
  const RL = sans(lire('plusVueLecture.js'));
  dit(/lireSeries\(base, uid, ids\.slice\(i, i \+ 60\)\)/.test(RL) && !/select=data\b/.test(RL), 'P12 relevés lus PROJETÉS par 60 (jamais la ligne entière)');

  console.log(`\n${ko ? '❌' : '✅'} audit-apres-finale-app : ${ok} verts, ${ko} rouge(s)${MUTE ? ' [mutation ' + MUTE + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
