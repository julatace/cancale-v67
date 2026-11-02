#!/usr/bin/env node
// ── audit-offres-garde — LA GARDE DES OFFRES AUTOMATIQUES (2 novembre 2026) ──
// Audit « plateformes » P2 (GRAVE) : une offre acceptée toute seule sur une paire
// déjà vendue sur eBay, Leboncoin ou Vestiaire = la même paire vendue deux fois.
// Exige, sur la VRAIE règle (src/offresGarde.js) et sur la VRAIE copie de
// l'extension (`offreGardeDit`, entre les balises <offres-garde-regle>) :
//   · une annonce Vinted vendue ailleurs, ou déjà vendue sur Vinted, est nommée ;
//   · une plateforme pas relue ⇒ garde incomplète ⇒ aucune acceptation ;
//   · garde absente, périmée (> 48 h), d'une autre version ⇒ aucune acceptation ;
//   · l'app et l'extension rendent la MÊME décision sur chaque cas.
// Le moteur lui-même, exécuté avec cette garde : audit-moteur-offres.cjs (L).
//   node scripts/audit-offres-garde.cjs                  la règle du dépôt
//   node scripts/audit-offres-garde.cjs --prouve         chaque mutation doit rougir
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'offresGarde.js');
const BG = path.join(R, 'vinted-sync-extension', 'background.js');

const MUTATIONS = {
  'ailleurs-oublie': ["    if (l && l.plateforme === 'Vinted' && l.id != null) items.add(String(l.id));", ''],
  'vinted-oublie': ["    if (a && a.plateforme === 'Vinted' && a.active === false && a.id != null) items.add(String(a.id));", ''],
  'incomplet-ignore': ['    complet: !!data && manques.length === 0,', '    complet: true,'],
  'perime-ignore': ['maintenant - at > GARDE_OFFRES_MAX_AGE_MS || ', ''],
  'ext-incomplet': ["  if (garde.complet !== true) return 'garde-incomplete';\n  if (!Array.isArray(garde.items)) return 'garde-absente';\n  if (item == null || garde.items.includes(String(item))) return 'vendue-ailleurs';\n  return null;\n}\n// </offres-garde-regle>",
    "  if (!Array.isArray(garde.items)) return 'garde-absente';\n  if (item == null || garde.items.includes(String(item))) return 'vendue-ailleurs';\n  return null;\n}\n// </offres-garde-regle>"],
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
  let src = fs.readFileSync(SRC, 'utf8');
  let bg = fs.readFileSync(BG, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue'); process.exit(2); }
    const cible = mut.startsWith('ext-') ? 'bg' : 'src';
    const texte = cible === 'bg' ? bg : src;
    if (!texte.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    if (cible === 'bg') bg = bg.replace(m[0], m[1]); else src = src.replace(m[0], m[1]);
  }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det) : '')); } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-'));
  const f = path.join(dir, 'offresGarde.mjs'); fs.writeFileSync(f, src);
  let G;
  try { G = await import(f); } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  const m = bg.match(/\/\/ <offres-garde-regle>[\s\S]*?\/\/ <\/offres-garde-regle>/);
  dit(!!m, "l'extension porte la copie de la règle (<offres-garde-regle>)");
  let ext = null;
  if (m) { const ctx = {}; vm.runInNewContext(m[0] + '\nthis.offreGardeDit = offreGardeDit;', ctx); ext = ctx.offreGardeDit; }

  const now = Date.parse('2026-11-02T10:00:00Z');
  console.log('\n1. CE QUE L\'APP PUBLIE');
  const data = {
    annonces: [
      { plateforme: 'Vinted', id: '100', active: true, numero: '12' },
      { plateforme: 'Vinted', id: '200', active: false, numero: '13' },   // vendue sur Vinted
      { plateforme: 'Vinted', id: '300', active: true, numero: '14' },
      { plateforme: 'eBay', id: 'e1', active: true, numero: '15' },
    ],
    ventes: [], manques: [],
  };
  const calcul = { lignes: [{ plateforme: 'Vinted', id: '100' }, { plateforme: 'eBay', id: 'e1' }], ambigus: 0 };
  const g = G.gardeOffres(data, calcul, now);
  dit(g.items.includes('100'), 'vendue AILLEURS (son annonce Vinted encore en ligne) ⇒ nommée', g.items);
  dit(g.items.includes('200'), 'déjà vendue sur Vinted ⇒ nommée', g.items);
  dit(!g.items.includes('300') && !g.items.includes('e1'), 'une annonce Vinted libre (et une annonce eBay) ⇒ pas nommée', g.items);
  dit(g.complet === true && g.v === 1 && g.at === now, 'tout relu ⇒ garde complète, versionnée, datée', g);
  const gi = G.gardeOffres({ ...data, manques: ['Leboncoin non relu'] }, calcul, now);
  dit(gi.complet === false, 'une plateforme pas relue ⇒ garde INCOMPLÈTE', gi);
  const gn = G.gardeOffres(null, null, now);
  dit(gn.complet === false && gn.items.length === 0, 'lecture ratée ⇒ garde incomplète (jamais « rien de vendu »)', gn);

  console.log('\n2. LA DÉCISION — app et extension, cas par cas');
  const cas = [
    ['libre, garde complète et fraîche', g, '300', now, null],
    ['vendue ailleurs', g, '100', now, 'vendue-ailleurs'],
    ['vendue sur Vinted', g, '200', now, 'vendue-ailleurs'],
    ['garde incomplète', gi, '300', now, 'garde-incomplete'],
    ['garde absente', null, '300', now, 'garde-absente'],
    ['garde périmée (49 h)', g, '300', now + 49 * 3600e3, 'garde-perimee'],
    ['garde du futur', { ...g, at: now + 3600e3 }, '300', now, 'garde-perimee'],
    ['autre version', { ...g, v: 2 }, '300', now, 'garde-absente'],
    ['annonce sans identité', g, null, now, 'vendue-ailleurs'],
  ];
  for (const [nom, garde, item, t, attendu] of cas) {
    const a = G.gardeRefuse(garde, item, t);
    dit(a === attendu, `app · ${nom} ⇒ ${attendu || 'acceptée'}`, a);
    if (ext) { const e = ext(garde, item, t); dit(e === a, `extension = app · ${nom}`, { app: a, ext: e }); }
  }
  console.log(`\n${n - ko} vert(s), ${ko} rouge(s).${mut ? ' (mutation « ' + mut + ' »)' : ''}`);
  process.exit(ko ? 1 : 0);
})();
