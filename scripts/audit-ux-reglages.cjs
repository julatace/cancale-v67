#!/usr/bin/env node
// ── audit-ux-reglages — les RÈGLES pures du lot ux-reglages (21 nov.) ───────────────────────────────────────────
// Exécute les vrais modules (copiés, une mutation possible) :
//   B  « Bien démarrer » (src/bienDemarrer/regle.js) : rien n'est « fait » sans preuve (pas su ⇒ passu) ; un compte relié
//      prouve l'extension ; montrée seulement à un compte inscrit depuis le 21 nov., pas au propriétaire (ni pas su), pas
//      en exemple, pas après son « × », pas quand tout est fait ;
//   N  la feuille « Nouveau » (src/nouveautes.js) : 3 au plus, les plus récentes, jamais une déjà montrée ; ranger
//      ajoute sans effacer ;
//   E  E-mails : trois segments au plus, « Ventes » et « Achats » en filtres (src/designV2/messagesV2.js).
//   node scripts/audit-ux-reglages.cjs [--mutation=NOM | --prouve]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');
const MUTATIONS = {
  'pas-su-fait': ['src/bienDemarrer/regle.js', "const etat = (v) => (v === true ? 'fait' : v === false ? 'afaire' : 'passu');", "const etat = (v) => (v === false ? 'afaire' : 'fait');"],
  'proprio-montre': ['src/bienDemarrer/regle.js', 'if (proprietaire !== false) return false;', 'if (proprietaire === true) return false;'],
  'ancien-montre': ['src/bienDemarrer/regle.js', 'if (!j || j < debut) return false;', 'if (!j) return false;'],
  'masque-ignore': ['src/bienDemarrer/regle.js', 'if (masqueDe(reglage)) return false;', ''],
  'feuille-revient': ['src/nouveautes.js', "&& !montrees.has(n.id));", ');'],
  'feuille-cinq': ['src/nouveautes.js', 'export const FEUILLE_MAX = 3;', 'export const FEUILLE_MAX = 5;'],
  'cinq-segments': ['src/designV2/messagesV2.js', "export const SEGMENTS_EMAILS = ['atraiter', 'colis', 'tout'];", "export const SEGMENTS_EMAILS = ['atraiter', 'colis', 'ventes', 'achats', 'tout'];"],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0; const noms = Object.keys(MUTATIONS);
  for (const m of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status !== 0 && r.status !== 3;
    console.log(`${rouge ? '✓ rouge' : '✗ VERT '} · mutation ${m}${r.status === 3 ? ' (introuvable)' : ''}`);
    if (rouge) ok++;
  }
  console.log(`\n${ok}/${noms.length} mutations rouges`);
  process.exit(ok === noms.length ? 0 : 1);
}
let verts = 0, rouges = 0;
const dit = (c, m, d) => { if (c) { verts++; console.log('  ✓ ' + m); } else { rouges++; console.log('  ✗ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 240) : '')); } };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-uxr-'));
  try {
    fs.cpSync(path.join(RAC, 'src'), path.join(tmp, 'src'), { recursive: true, filter: (s) => !/\.(png|webp|jpe?g|woff2?)$/.test(s) });
    fs.cpSync(path.join(RAC, 'api', '_lib'), path.join(tmp, 'api', '_lib'), { recursive: true });
    fs.copyFileSync(path.join(RAC, 'package.json'), path.join(tmp, 'package.json'));
    if (mut) {
      const [f, a, b] = MUTATIONS[mut] || [];
      const p = f && path.join(tmp, f);
      if (!p || !fs.readFileSync(p, 'utf8').includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(3); }
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split(a).join(b));
    }
    const imp = (f) => import(pathToFileURL(path.join(tmp, f)).href);
    let B, N, M;
    try { [B, N, M] = await Promise.all([imp('src/bienDemarrer/regle.js'), imp('src/nouveautes.js'), imp('src/designV2/messagesV2.js')]); }
    catch (e) { dit(false, 'les modules se chargent', String(e && e.message)); process.exit(1); }

    console.log('── B. « Bien démarrer »');
    const e0 = B.etapesBienDemarrer({});
    dit(e0.length === 5 && e0.every((e) => e.etat === 'passu'), 'B1 rien lu ⇒ cinq « pas su », aucune coche', e0);
    const e1 = B.etapesBienDemarrer({ comptes: true, fiscal: true, lecture: null, numeros: false });
    const et = Object.fromEntries(e1.map((e) => [e.cle, e.etat]));
    dit(et.extension === 'fait' && et.compte === 'fait' && et.fiscal === 'fait' && et.lecture === 'passu' && et.numeros === 'afaire' && B.nombreFaites(e1) === 3, 'B2 compte relié ⇒ extension prouvée ; 3/5', et);
    const tous = B.etapesBienDemarrer({ extension: true, comptes: true, lecture: true, numeros: true, fiscal: true });
    const ok = { etapes: e1, proprietaire: false, inscritLe: '2026-11-22T08:00:00Z' };
    dit(B.bienDemarrerAMontrer(ok) === true, 'B3 compte neuf, pas fini ⇒ montrée');
    dit(B.bienDemarrerAMontrer({ ...ok, proprietaire: true }) === false && B.bienDemarrerAMontrer({ ...ok, proprietaire: null }) === false, 'B4 propriétaire (Julien) ou pas su ⇒ cachée');
    dit(B.bienDemarrerAMontrer({ ...ok, inscritLe: '2026-10-01T08:00:00Z' }) === false && B.bienDemarrerAMontrer({ ...ok, inscritLe: '' }) === false, 'B5 compte d\'avant ou date pas sue ⇒ cachée');
    dit(B.bienDemarrerAMontrer({ ...ok, reglage: B.reglageMasque() }) === false, 'B6 son « × » ⇒ cachée');
    dit(B.bienDemarrerAMontrer({ ...ok, etapes: tous }) === false, 'B7 tout prouvé ⇒ partie d\'elle-même');
    dit(B.bienDemarrerAMontrer({ ...ok, exemple: true }) === false, 'B8 en exemple ⇒ cachée');

    console.log('── N. La feuille « Nouveau »');
    const L = [{ id: 'a', date: '2026-11-19' }, { id: 'b', date: '2026-11-21' }, { id: 'c', date: '2026-11-20' }, { id: 'd', date: '2026-11-21' }, { id: 'e', date: '2026-11-18' }];
    const f1 = N.feuilleNouveau(L, null);
    dit(f1.length === 3 && f1[0].date === '2026-11-21' && f1[2].id === 'c', 'N1 trois au plus, les plus récentes d\'abord', f1.map((x) => x.id));
    const deja = N.feuilleMontree(null, L.map((x) => x.id), 't');
    dit(N.feuilleNouveau(L, deja).length === 0, 'N2 déjà montrées ⇒ plus de feuille (elle ne revient pas)');
    const plus = N.feuilleMontree(deja, ['f'], 't2');
    dit(plus.ids.length === 6 && plus.ids.includes('a') && plus.ids.includes('f'), 'N3 ranger ajoute, n\'efface rien', plus.ids);
    dit(N.feuilleNouveau([...L, { id: 'f', date: '2026-11-22' }], deja).map((x) => x.id).join() === 'f', 'N4 une nouveauté après une mise en ligne ⇒ elle seule');

    console.log('── E. E-mails');
    dit(M.SEGMENTS_EMAILS.length <= 3 && M.SEGMENTS_EMAILS.includes('colis') && M.SEGMENTS_EMAILS.includes('tout'), 'E1 trois segments au plus', M.SEGMENTS_EMAILS);
    dit(M.FILTRES_EMAILS_PLUS.join() === 'ventes,achats' && M.segmentDesFiltres({ rubrique: 'ventes' }) === '' && M.filtresDuSegment('ventes').rubrique === 'ventes', 'E2 « Ventes » / « Achats » restent des filtres (hors segment)');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\n${verts} verts, ${rouges} rouges`);
  process.exit(rouges ? 1 : 0);
})();
