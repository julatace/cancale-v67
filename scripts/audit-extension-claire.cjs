#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT « EXTENSION CLAIRE » (19 nov., demande H) — la règle « ce que VRM peut faire » EXÉCUTÉE
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « on ne sait pas quand ton compte Vinted est ouvert, quelles actions on peut faire ».
// La page « Extension » (src/extension/EcranExtension.jsx) ne décide rien : elle dit ce que la règle pure
// src/extension/peutFaire.js tire des faits. Cet audit l'EXÉCUTE sur chaque combinaison d'états :
//   aucune extension · vérification en cours · ancienne · muette · version inconnue · autre navigateur ·
//   compte de l'onglet ≠ · aucun compte ouvert · pause (429/403) · prudence · plafond atteint · places de
//   republication · deux comptes dans le navigateur · « Tout arrêter » · vérification (captcha) et sa reprise ·
//   autre compte VRM · deux extensions · téléphone (sans / avec l'ordinateur) · verrou « un autre compte vient
//   d'agir » · tout va bien.
// Et il vérifie que :
//   · chaque phrase / raison / note produite a son texte dans LES CINQ langues (src/i18n/langues/*/extension.js) ;
//   · aucun texte de la page ne porte un mot technique (429, 403, cookie, session, pont, service worker, token…) ;
//   · la pastille de la coque ne dit plus « Lecture seule » ni « Extension à installer » et MÈNE à la page ;
//   · la page est montée (`tab==='extension'`) et l'extension publie bien son état (`etatIciPourApp`, 5.409).
// « Pas su » ne vaut pas « oui » : aucun geste n'est « oui » sans une extension ICI, à jour pour lui, branchée
// à CE compte VRM, au nom du compte de l'onglet (ou par l'ordinateur, sur le téléphone).
//
//   node scripts/audit-extension-claire.cjs                  tout
//   node scripts/audit-extension-claire.cjs --mutation=NOM   une règle réaffaiblie (doit rougir)
//   node scripts/audit-extension-claire.cjs --prouve         chaque mutation doit rougir
//   node scripts/audit-extension-claire.cjs --arbre=DOSSIER  juge un autre arbre (git archive <avant>)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const MUTATIONS = {
  'compte-onglet': ["if (ouv.ou === 'autre-ici') return non('autre-ouvert'", "if (false) return non('autre-ouvert'"],
  'pause': ['if (pause > f.maintenant) return non(', 'if (false) return non('],
  'plafond-45': ["const limite = g.sorte === 'clic' ? j.max : j.pourApp;", 'const limite = j.max;'],
  'navigateur': ["const navigateurAgit = (n) => n.code === 'ok' || n.code === 'maj';", 'const navigateurAgit = (n) => true;'],
  'version': ["if (!versionOk(ver) || cmpVersion(ver, caps[g.cap] || f.attendue || '9999.0.0') < 0)", 'if (!versionOk(ver))'],
  'tout-arrete': ["if (f.toutArrete && f.toutArrete.on) return non('tout-arrete');", ''],
  'reprise': ['if (Number.isFinite(r) && r > c) return null;', ''],
  'relais-compte': ["if (ouv.ou !== 'relais') return ouv.ou", "if (false) return ouv.ou"],
  'places': ['const places = g.places || 1;', 'const places = 1;'],
  'deux-comptes': ['new Set(ici.comptesOnglets.map(String)).size > 1', 'false'],
  'verrou': ["if (vr && vr.uid && String(vr.uid) !== compte.id && Number(vr.jusqua) > f.maintenant)", 'if (false)'],
  'clic-passe': ["if (g.sorte === 'auto') {\n    if (f.toutArrete", "if (true) {\n    if (f.toutArrete"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
const arbre = path.resolve((arg.find((a) => a.startsWith('--arbre=')) || '').split('=')[1] || path.join(__dirname, '..'));
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

let rouges = 0, verts = 0;
const dit = (ok, quoi, detail = '') => { if (ok) verts++; else rouges++; console.log(`${ok ? '✅' : '❌'} ${quoi}${!ok && detail ? '\n     ' + detail : ''}`); };
const lire = (rel) => { try { return fs.readFileSync(path.join(arbre, rel), 'utf8'); } catch (_) { return null; } };

(async () => {
  const srcRegle = lire('src/extension/peutFaire.js');
  dit(!!srcRegle, 'la règle pure existe : src/extension/peutFaire.js');
  if (!srcRegle) { console.log(`\n${verts} verts, ${rouges} rouges.`); process.exit(1); }
  let code = srcRegle;
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!code.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    code = code.replace(m[0], m[1]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ext-claire-'));
  fs.writeFileSync(path.join(dir, 'peutFaire.mjs'), code);
  let R;
  try { R = await import(pathToFileURL(path.join(dir, 'peutFaire.mjs')).href); } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }

  // ── Les capacités et la version attendue : celles de l'app (jamais recopiées ici).
  const app = lire('src/App.jsx') || '';
  const capsTxt = (app.match(/const EXT_CAPACITES = (\{[^\n]*\});/) || [])[1];
  const CAPS = capsTxt ? Function(`return (${capsTxt});`)() : {};
  const ATT = (app.match(/const EXT_ATTENDUE = '([\d.]+)'/) || [])[1] || '0.0.0';
  dit(!!capsTxt && ATT !== '0.0.0', `les capacités et la version attendue sont lues dans src/App.jsx (${ATT})`);

  const T0 = Date.UTC(2026, 10, 19, 14, 0, 0);
  const A = '111', B = '222';
  const jauge = (o = {}) => ({ n: 0, max: 50, pourApp: 45, plein: false, prudence: null, repartA: null, nJour: 0, maxJour: 200, captcha: null, arret: null, ...o });
  // Les faits d'un navigateur où tout va bien : extension à jour ici, branchée à CE compte VRM, compte A ouvert sur vinted.fr.
  const base = (o = {}) => {
    const f = {
      maintenant: T0, attendue: ATT, capacites: CAPS, telephone: false, brancheEnCours: false, moi: { id: 'u-moi', email: 'moi@exemple.fr' },
      ext: { present: true, appelsFinis: true, installeeIci: false, version: ATT, plusieurs: null, perime: false,
        etat: { ok: true, vrm: { connecte: true, user_id: 'u-moi', email: 'moi@exemple.fr' }, vinted: { uid: A, login: 'boutique_a' },
          ici: { v: 1, appareil: 'aaaaaaaaaaaaaaaa', onglets: { vinted: 1, leboncoin: 0, vestiaire: 0 }, comptesOnglets: [A], vus: { vinted: { [A]: T0 - 3 * 60000 } }, verrou: null, ouverture: null } } },
      relais: { niveau: 'hors' },
      appareils: [],
      comptes: { vinted: [{ id: A, nom: 'boutique_a' }, { id: B, nom: 'boutique_b' }], leboncoin: [], vestiaire: [] },
      lus: { vinted: { [A]: T0 - 3 * 60000 } },
      jauges: { [A]: jauge(), [B]: jauge() }, reprises: {}, toutArrete: null,
    };
    return o(f) || f;
  };
  const page = (fn) => R.pageExtension(base(fn || (() => null)));
  const compte = (p, id, site = 'vinted') => { const s = p.sites.find((x) => x.site === site); return s && s.comptes.find((c) => c.id === id); };
  const geste = (p, id, cle, site) => { const c = compte(p, id, site); return c && c.gestes.find((g) => g.cle === cle); };
  const tous = (p, id, pred) => { const c = compte(p, id); return !!c && c.gestes.every(pred); };
  const AUTO = R.GESTES.vinted.filter((g) => g.sorte === 'auto').map((g) => g.cle);
  const toutesPages = [];
  const garder = (p) => { toutesPages.push(p); return p; };

  // 1. Tout va bien
  let p = garder(page());
  dit(p.navigateur.code === 'ok' && tous(p, A, (g) => g.oui), 'tout va bien : extension à jour, compte A ouvert ⇒ tous les gestes de A sont « oui »', JSON.stringify(compte(p, A) && compte(p, A).gestes.filter((g) => !g.oui)));
  dit(compte(p, A).ouverture === 'ici' && compte(p, A).etat.code === 'ici', 'tout va bien : A est dit « ouvert dans ce navigateur »');
  dit(tous(p, B, (g) => !g.oui && g.raison === 'autre-ouvert'), 'tout va bien : B (pas ouvert ici) ⇒ chaque geste « non : c’est A qui est ouvert »', JSON.stringify(compte(p, B).gestes));
  dit(p.etapes.every((e) => e.fait === true), 'tout va bien : les 4 étapes du premier branchement sont cochées');
  dit(p.pastille.ton === 'ok' && p.pastille.code === 'ok', 'tout va bien : pastille « ok » au nom du compte ouvert');

  // 2. Aucune extension (ordinateur)
  p = garder(page((f) => { f.ext = { present: false, appelsFinis: true, installeeIci: false, version: '', plusieurs: null, perime: false, etat: undefined }; }));
  dit(p.navigateur.code === 'absente' && p.navigateur.geste === 'installer', 'aucune extension : « installe-la », geste « Installer »');
  dit(tous(p, A, (g) => !g.oui && g.raison === 'nav-absente'), 'aucune extension : aucun geste « oui »');
  dit(p.etapes[0].fait === false && p.pastille.ton === 'geste', 'aucune extension : étape 1 pas faite, pastille ambre');

  // 3. Vérification (poignée de main pas finie)
  p = garder(page((f) => { f.ext = { present: false, appelsFinis: false, installeeIci: false, version: '', plusieurs: null, perime: false, etat: undefined }; }));
  dit(p.navigateur.code === 'verif' && tous(p, A, (g) => !g.oui) && p.etapes[0].fait === null, 'vérification en cours : ni oui ni « à installer », étape 1 « on regarde »');

  // 4. Autre navigateur (une extension du compte vit ailleurs)
  p = garder(page((f) => { f.ext = { present: false, appelsFinis: true, installeeIci: false, version: '', plusieurs: null, perime: false, etat: undefined }; f.appareils = [{ id: 'bbbbbbbbbbbbbbbb', nom: 'Chrome · Mac', ver: '5.406.0', atMs: T0 - 20 * 60000, vus: { vinted: { [A]: T0 - 25 * 60000 } } }]; }));
  dit(p.navigateur.code === 'ailleurs' && p.navigateur.vars.ou === 'Chrome · Mac', 'autre navigateur : « elle est dans Chrome · Mac, pas ici »');
  dit(tous(p, A, (g) => !g.oui && g.raison === 'nav-ailleurs'), 'autre navigateur : aucun geste « oui » ici');
  dit(compte(p, A).etat.code === 'ailleurs' && compte(p, A).lu && compte(p, A).lu.ou === 'Chrome · Mac', 'autre navigateur : A « ouvert dans Chrome · Mac » (lu il y a 25 min là-bas)');
  dit(p.autres.length === 1 && p.autres[0].aJour === false, 'autre navigateur : listé, « à mettre à jour » (5.406 < attendue)');

  // 5. Muette (pont là, aucune réponse) / installée ici mais muette
  p = garder(page((f) => { f.ext.etat = null; }));
  dit(p.navigateur.code === 'muette' && p.navigateur.geste === 'recharger' && tous(p, A, (g) => !g.oui), 'muette : « recharge la page », aucun geste');
  p = garder(page((f) => { f.ext = { present: false, appelsFinis: true, installeeIci: true, version: '', plusieurs: null, perime: false, etat: undefined }; }));
  dit(p.navigateur.code === 'muette', 'installée ici mais muette : jamais « à installer »');

  // 6. Version inconnue / ancienne
  p = garder(page((f) => { f.ext.version = ''; }));
  dit(p.navigateur.code === 'retard' && tous(p, A, (g) => !g.oui), 'version inconnue : « mets à jour », aucun geste (« pas su » ≠ oui)');
  p = garder(page((f) => { f.ext.version = '5.300.0'; }));
  const vieux = compte(p, A).gestes;
  const attendusVieux = R.GESTES.vinted.map((g) => ({ cle: g.cle, oui: !(CAPS[g.cap] && R.cmpVersion('5.300.0', CAPS[g.cap]) < 0) }));
  dit(p.navigateur.code === 'maj' && attendusVieux.every((a) => { const g = vieux.find((x) => x.cle === a.cle); return g && g.oui === a.oui && (a.oui || g.raison === 'retard'); }),
    'ancienne (5.300) : chaque geste suit SA capacité d’EXT_CAPACITES (oui si arrivée avant, sinon « mets à jour »)', JSON.stringify(vieux.map((g) => [g.cle, g.oui, g.raison])));

  // 7. Compte de l'onglet ≠
  p = garder(page((f) => { f.ext.etat.vinted = { uid: B, login: 'boutique_b' }; }));
  dit(tous(p, A, (g) => !g.oui && g.raison === 'autre-ouvert' && g.vars.autre === 'boutique_b') && tous(p, B, (g) => g.oui), 'compte de l’onglet = B : A « non, c’est boutique_b qui est ouvert », B « oui »');
  // 8. Aucun compte ouvert
  p = garder(page((f) => { f.ext.etat.vinted = null; }));
  dit(tous(p, A, (g) => !g.oui && g.raison === 'pas-ouvert' && g.vars.domaine === 'vinted.fr'), 'aucun compte ouvert : « ouvre vinted.fr connecté à boutique_a »');
  dit(p.etapes[2].fait === false && p.pastille.code === 'vinted-ferme', 'aucun compte ouvert : étape « compte Vinted » pas faite, pastille « Vinted pas ouvert »');
  p = garder(page((f) => { f.ext.etat.vinted = null; f.ext.etat.vintedPasSu = true; }));
  dit(tous(p, A, (g) => !g.oui && g.raison === 'vinted-passu') && p.etapes[2].fait === null, 'cookie pas lu à temps : « un instant », ni oui ni « pas ouvert »');

  // 9. Pause demandée par Vinted (429/403)
  p = garder(page((f) => { f.ext.etat.pause = { jusqua: T0 + 12 * 60000 }; }));
  dit(tous(p, A, (g) => !g.oui && g.raison === 'pause' && g.vars.heure === T0 + 12 * 60000), 'pause : tout attend, lecture comprise, avec l’heure de reprise');

  // 10. Prudence
  p = garder(page((f) => { f.jauges[A] = jauge({ max: 20, pourApp: 20, prudence: T0 + 5 * 3600000, n: 3 }); }));
  dit(AUTO.every((k) => { const g = geste(p, A, k); return g.oui && g.note === 'prudence' && g.vars.max === 20; }), 'prudence : l’automatique est « oui, au ralenti (20/h) jusqu’à … »');
  dit(geste(p, A, 'codes').oui && !geste(p, A, 'codes').note && geste(p, A, 'lire').note === 'prudence-lecture', 'prudence : les codes de retrait toujours lus, le reste seulement à l’ouverture');
  p = garder(page((f) => { f.jauges[A] = jauge({ max: 20, pourApp: 20, prudence: T0 + 5 * 3600000, n: 20, repartA: T0 + 600000 }); }));
  dit(AUTO.every((k) => !geste(p, A, k).oui && geste(p, A, k).raison === 'plafond'), 'prudence pleine (20/20) : l’automatique attend');

  // 11. Plafond atteint
  p = garder(page((f) => { f.jauges[A] = jauge({ n: 45, repartA: T0 + 17 * 60000 }); }));
  dit(AUTO.every((k) => { const g = geste(p, A, k); return !g.oui && g.raison === 'plafond' && g.vars.heure === T0 + 17 * 60000; }), '45/50 : l’automatique attend, avec l’heure où une place se libère');
  dit(geste(p, A, 'repondre').oui && geste(p, A, 'lire').oui, '45/50 : SES gestes (répondre) et la lecture passent — les 5 dernières restent à lui');
  p = garder(page((f) => { f.jauges[A] = jauge({ n: 50, repartA: T0 + 60000 }); }));
  dit(!geste(p, A, 'repondre').oui && geste(p, A, 'repondre').raison === 'plafond', '50/50 : même SES gestes attendent');
  p = garder(page((f) => { f.jauges[A] = jauge({ n: 43, repartA: T0 + 60000 }); }));
  dit(!geste(p, A, 'republier').oui && geste(p, A, 'republier').raison === 'places' && geste(p, A, 'republier').vars.reste === 2 && geste(p, A, 'baisser').oui, '43/45 : republier (3 gestes d’un coup) attend, baisser un prix passe');
  p = garder(page((f) => { f.jauges[A] = jauge({ nJour: 196, maxJour: 200 }); }));
  dit(!geste(p, A, 'baisser').oui && geste(p, A, 'baisser').raison === 'plafond-jour' && geste(p, A, 'repondre').oui, 'plafond du jour : l’automatique reprend demain, ses gestes passent');
  p = garder(page((f) => { f.jauges[A] = null; }));
  dit(compte(p, A).jauge === null && geste(p, A, 'baisser').oui, 'jauge pas lue : « — » dit, le geste n’est pas refusé à la place de l’extension (c’est elle qui compte)');

  // 12. Deux comptes dans ce navigateur
  p = garder(page((f) => { f.ext.etat.ici.comptesOnglets = [A, B]; }));
  dit(p.avertissements.some((a) => a.code === 'deux-comptes' && a.vars.compte === 'boutique_a') && tous(p, A, (g) => g.oui), 'deux comptes ouverts : dit une fois (« VRM n’agit que pour boutique_a »), A agit toujours');
  // 13. Tout arrêter
  p = garder(page((f) => { f.toutArrete = { on: true, at: T0 - 60000 }; }));
  dit(AUTO.every((k) => !geste(p, A, k).oui && geste(p, A, k).raison === 'tout-arrete') && geste(p, A, 'repondre').oui && geste(p, A, 'lire').oui, '« Tout arrêter » : l’automatique s’arrête, ses clics et la lecture passent');
  dit(p.avertissements.some((a) => a.code === 'tout-arrete' && a.geste === 'reprendre-tout') && p.pastille.code === 'arret', '« Tout arrêter » : dit, avec « Reprendre », pastille « à l’arrêt »');
  // 14. Vérification (captcha) puis sa reprise
  p = garder(page((f) => { f.jauges[A] = jauge({ captcha: T0 - 3600000, arret: 'captcha' }); }));
  dit(AUTO.every((k) => !geste(p, A, k).oui && geste(p, A, k).raison === 'verification') && compte(p, A).etat.geste === 'reprendre' && geste(p, A, 'repondre').oui, 'vérification demandée : l’automatique s’arrête, « Reprendre » proposé, ses clics passent');
  p = garder(page((f) => { f.jauges[A] = jauge({ captcha: T0 - 3600000, arret: 'moderation' }); }));
  dit(geste(p, A, 'baisser').raison === 'moderation' && compte(p, A).etat.code === 'moderation', 'modération : dite comme telle');
  p = garder(page((f) => { f.jauges[A] = jauge({ captcha: T0 - 3600000, arret: 'captcha' }); f.reprises = { [A]: T0 - 60000 }; }));
  dit(tous(p, A, (g) => g.oui), 'vérification REPRISE (son toucher après) : tout repart');
  // 15. Verrou : un autre compte vient d'agir dans ce navigateur ; Vinted vient d'être ouvert
  p = garder(page((f) => { f.ext.etat.ici.verrou = { uid: B, jusqua: T0 + 4 * 60000 }; }));
  dit(!geste(p, A, 'favoris').oui && geste(p, A, 'favoris').raison === 'autre-compte' && !geste(p, A, 'offres').oui && geste(p, A, 'baisser').oui, '« un autre compte vient d’agir ici » : dit AVANT le geste (favoris, offres), l’heure de reprise');
  p = garder(page((f) => { f.ext.etat.ici.ouverture = { uid: A, jusqua: T0 + 3 * 60000 }; }));
  dit(geste(p, A, 'favoris').raison === 'ouverture' && geste(p, A, 'repondre').oui, 'Vinted vient d’être ouvert : l’automatique attend quelques minutes, ses clics passent');
  // 16. Autre compte VRM / pas branchée / deux extensions / code périmé
  p = garder(page((f) => { f.ext.etat.vrm = { connecte: true, user_id: 'u-autre', email: 'autre@exemple.fr' }; }));
  dit(p.navigateur.code === 'autre-vrm' && p.navigateur.geste === 'brancher' && tous(p, A, (g) => !g.oui && g.raison === 'nav-autre-vrm'), 'autre compte VRM : « rebranche-la au tien », aucun geste');
  p = garder(page((f) => { f.ext.etat.vrm = { connecte: false }; }));
  dit(p.navigateur.code === 'vrm' && tous(p, A, (g) => !g.oui) && p.etapes[1].fait === false, 'pas branchée : « Brancher à mon compte », aucun geste, étape 2 pas faite');
  p = garder(page((f) => { f.ext.plusieurs = ['5.400.0', ATT]; }));
  dit(p.navigateur.code === 'plusieurs' && p.navigateur.vars.garder === ATT && tous(p, A, (g) => !g.oui), 'deux extensions : rien ne part, « garde la plus récente » nommée');
  p = garder(page((f) => { f.ext.perime = true; }));
  dit(p.navigateur.code === 'perime' && tous(p, A, (g) => !g.oui), 'code périmé : « relance-la », aucun geste');
  // 17. Téléphone
  p = garder(page((f) => { f.telephone = true; f.ext = { present: false, appelsFinis: true, installeeIci: false, version: '', plusieurs: null, perime: false, etat: undefined }; f.relais = { niveau: 'perime' }; }));
  dit(p.navigateur.code === 'telephone-eteint' && tous(p, A, (g) => !g.oui && g.raison === 'telephone'), 'téléphone, ordinateur éteint : « depuis ton ordinateur », aucun geste');
  p = garder(page((f) => { f.telephone = true; f.ext = { present: false, appelsFinis: true, installeeIci: false, version: '', plusieurs: null, perime: false, etat: undefined }; f.relais = { niveau: 'vivant', vinted: { uid: A, login: 'boutique_a' }, pauseMs: 0 }; }));
  const rel = R.GESTES.vinted.map((g) => [g.cle, !!g.relais]);
  dit(rel.every(([k, r]) => geste(p, A, k).oui === r && (!r || geste(p, A, k).note === 'relais')), 'téléphone + ordinateur vivant : seuls les gestes du relais (bordereau, répondre) sont « oui, par ton ordinateur »', JSON.stringify(compte(p, A).gestes.map((g) => [g.cle, g.oui, g.raison])));
  dit(tous(p, B, (g) => !g.oui), 'téléphone + ordinateur vivant : B (pas ouvert sur l’ordinateur) ⇒ aucun geste');
  // 18. Leboncoin / Vestiaire
  p = garder(page((f) => { f.comptes.leboncoin = [{ id: 'L1', nom: 'Ma boutique LBC', ouvert: true, lu: T0 - 3600000 }]; f.comptes.vestiaire = [{ id: 'V1', nom: 'n° V1', ouvert: false, lu: null }]; f.ext.etat.ici.onglets = { vinted: 1, leboncoin: 0, vestiaire: 0 }; }));
  dit(R.GESTES.leboncoin.every((g) => { const x = geste(p, 'L1', g.cle, 'leboncoin'); return !x.oui && x.raison === 'site-ferme' && x.vars.domaine === 'leboncoin.fr'; }), 'Leboncoin sans onglet ouvert ici : « ouvre leboncoin.fr connecté à … »');
  p = garder(page((f) => { f.comptes.leboncoin = [{ id: 'L1', nom: 'Ma boutique LBC', ouvert: true, lu: T0 - 3600000 }]; f.ext.etat.ici.onglets = { vinted: 1, leboncoin: 1, vestiaire: 0 }; }));
  dit(R.GESTES.leboncoin.every((g) => geste(p, 'L1', g.cle, 'leboncoin').oui), 'Leboncoin ouvert ici : ses gestes sont « oui »');
  p = garder(page((f) => { f.comptes.leboncoin = [{ id: 'L1', nom: 'Ma boutique LBC', ouvert: true }]; f.ext.etat.ici = undefined; }));
  dit(R.GESTES.leboncoin.every((g) => { const x = geste(p, 'L1', g.cle, 'leboncoin'); return x.oui && x.note === 'site-passu'; }), 'extension sans le bloc 5.409 : Leboncoin « depuis l’onglet leboncoin.fr » (pas prétendu fermé)');

  // ── Les textes : chaque code produit a sa phrase dans les 5 langues ──
  const dicts = {};
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const t = lire(`src/i18n/langues/${l}/extension.js`);
    dicts[l] = t ? new Set((t.match(/^ {2}"([^"]+)"/gm) || []).map((k) => k.trim().slice(1, -1))) : new Set();
    const racine = lire(`src/i18n/langues/${l}.js`) || '';
    dit(!!t && /import ecran_extension from '\.\/[a-z]{2}\/extension\.js'/.test(racine) && racine.includes('...ecran_extension'), `${l} : le dictionnaire de la page est branché`);
  }
  const cles = new Set();
  for (const pg of toutesPages) {
    cles.add(pg.navigateur.cle); if (pg.navigateur.pourquoi) cles.add(pg.navigateur.pourquoi);
    if (pg.navigateur.geste && !['extensions', 'ordinateur'].includes(pg.navigateur.geste)) cles.add('ext.geste.' + pg.navigateur.geste);
    cles.add(pg.pastille.cle);
    for (const a of pg.avertissements) { cles.add(a.cle); if (a.pourquoi) cles.add(a.pourquoi); }
    for (const e of pg.etapes) cles.add('ext.etape.' + e.cle);
    for (const s of pg.sites) for (const c of s.comptes) { cles.add(c.etat.cle); for (const g of c.gestes) { cles.add('ext.g.' + g.cle); if (g.raison) cles.add('ext.raison.' + g.raison); if (g.note) cles.add('ext.note.' + g.note); } }
  }
  for (const l of Object.keys(dicts)) { const manque = [...cles].filter((k) => !dicts[l].has(k)); dit(!manque.length, `${l} : les ${cles.size} phrases produites ont leur texte`, manque.join(', ')); }
  // Tous les codes possibles de raison (pas seulement ceux vus) : lus dans la règle.
  const raisons = [...new Set([...srcRegle.matchAll(/non\('([a-z-]+)'/g)].filter((m) => m[1] !== 'nav-').map((m) => 'ext.raison.' + m[1]))];
  const corpsNav = (srcRegle.match(/export function etatNavigateur[\s\S]*?\n\}\n/) || [''])[0];
  const navCodes = [...new Set([...corpsNav.matchAll(/code: '([a-z-]+)'/g)].map((m) => m[1]))].filter((c) => c !== 'ok' && c !== 'maj').map((c) => 'ext.raison.nav-' + c);
  dit(navCodes.length >= 12, `les états du navigateur sont lus dans la règle (${navCodes.length})`);
  for (const l of Object.keys(dicts)) { const manque = [...raisons, ...navCodes].filter((k) => !dicts[l].has(k)); dit(!manque.length, `${l} : chaque raison possible de la règle a sa phrase`, manque.join(', ')); }
  // Aucun mot technique dans les textes de la page (fr).
  const frTxt = (lire('src/i18n/langues/fr/extension.js') || '').replace(/^\/\/.*$/gm, '');
  const techniques = ['429', '403', 'cookie', 'session', 'pont', 'service worker', 'token', 'jeton', 'API', 'requête', 'chrome://', 'manifest', 'capacité', 'Lecture seule'];
  const valeurs = [...frTxt.matchAll(/^ {2}"[^"]+":\s*("[^\n]*|\{[^\n]*)$/gm)].map((m) => m[1]).join('\n');
  const vus = techniques.filter((m) => new RegExp(`(^|[^\\w])${m.replace(/[/.]/g, '\\$&')}($|[^\\w])`, 'i').test(valeurs));
  dit(!vus.length, 'aucun mot technique dans les phrases (429, cookie, session, pont, token, « Lecture seule »…)', vus.join(', '));

  // ── Le branchement dans l'app ──
  dit(/tab==='extension'&&<GardeEcran nom="extension">/.test(app) && /lazySur\(\(\) => import\('\.\/extension\/EcranExtension\.jsx'\)\)/.test(app), 'la page est montée (tab « extension », chargée à la demande)');
  const pastille = (app.match(/<button type="button" className="vrm-etat-pastille"[^\n]*/) || [''])[0];
  dit(/onClick=\{\(\) => \{[^}]*onNav\('extension'\)/.test(pastille), 'la pastille de la coque MÈNE à la page « Extension » (plus de panneau à elle)');
  const corpsEtat = (app.match(/function EtatActions\([\s\S]*?\n  const visible = /) || [''])[0];
  dit(!!corpsEtat && !/'Lecture seule'|'Extension à installer'|'Actions possibles · sauf publier'/.test(corpsEtat), 'la pastille ne dit plus « Lecture seule », « Extension à installer », « Actions possibles · sauf publier »');
  dit(/entreeNav\(\{id:'extension'/.test(app) && /tr\('ext\.plus\.libelle'\)/.test(app), '« Extension » est une entrée de « Plus » (et le menu du profil y mène)');
  const fond = lire('vinted-sync-extension/background.js') || '';
  dit(/async function etatIciPourApp\(/.test(fond) && /avecDelai\(etatIciPourApp\(uid && !vintedPasSu \? String\(uid\) : ''\), 900, null\)[^\n]*\(\(ici\) => \(\{ ici \}\)\)/.test(fond), 'l’extension publie l’état de ce navigateur (`etatIciPourApp`, réponse `etat`)');
  // Aucun garde-fou retiré : les plafonds et la pause sont toujours dans l'extension.
  dit(/const ACTIONS_MAX_HEURE = 50;/.test(fond) && /const RESERVE_GESTES = 5;/.test(fond) && /async function porteDiscretion\(/.test(fond) && /async function pauseVinted\(/.test(fond), 'garde-fous de l’extension intacts (50/h, réserve 5, discrétion, pause)');
  const ici = (fond.match(/async function etatIciPourApp\([\s\S]*?\n\}/) || [''])[0];
  dit(!!ici && !/requeteVinted|fetch\(|supabaseUpsert|chrome\.storage\.local\.set|compterAction\(/.test(ici), '`etatIciPourApp` ne fait que LIRE (aucune requête Vinted, aucune écriture, rien dans le plafond)');

  console.log(`\n${verts} verts, ${rouges} rouges.`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
