// ════════════════════════════════════════════════════════════════════════════
//  LE RYTHME DES MESSAGES AUX FAVORIS (19 nov., ext. 5.409)
//  Julien : « 4 min entre les messages c'est peut-être beaucoup, on garde toujours le temps aléatoire ».
//  · On EXÉCUTE la vraie file (api/_lib/favoris-file.js : lancerFile → reserverFile → terminerFile, la machine
//    d'état que sert /api/compte?mode=favoris) sur 400 envois : « normal » 40 à 90 s, jamais sous 40, jamais
//    au-dessus de 90, jamais deux temps identiques de suite, pas toujours le même ; « prudent » 2 à 4 min ;
//    une file sans rythme (réglages d'avant) garde ses minutes ; une décision rejouée donne le même temps.
//  · On CHARGE le vrai background.js (scripts/_fond-vm.cjs) : les plafonds n'ont pas bougé (50/h, réserve 5,
//    15/h favoris et offres, 20/h en prudence, 200 par jour par défaut) et la porte des favoris passe toujours
//    la limite par sorte.
//  · Le réglage (src/reglagesFavoris.js) : absent ⇒ « normal » ; « prudent » accepté ; autre ⇒ refusé.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE. `--src <ancien favoris-file.js>` : l'arbre d'avant.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const args = process.argv.slice(2);
const RACINE = path.join(__dirname, '..');
const FILE0 = (() => { const i = args.indexOf('--src'); return i >= 0 ? path.resolve(args[i + 1]) : path.join(RACINE, 'api', '_lib', 'favoris-file.js'); })();
const BG0 = path.join(RACINE, 'vinted-sync-extension', 'background.js');

const MUTATIONS = {
  bornes: ['normal:Object.freeze([40000,90000])', 'normal:Object.freeze([30000,90000])'],
  repete: ['if(b[0]+k*1000===Number(precedent))', 'if(false)'],
  prudent: ['prudent:Object.freeze([120000,240000])', 'prudent:Object.freeze([240000,240000])'],
  ignore: ["const delai=j.auto?ecartAutoMs(jeton):(RYTHMES_FAVORIS[j.rythme]?", "const delai=j.auto?ecartAutoMs(jeton):(false?"],
  plafond: ['const PAR_HEURE_SORTE_DEFAUT = 15;', 'const PAR_HEURE_SORTE_DEFAUT = 30;'],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let FILE = FILE0, BG = BG0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  const cible = mut === 'plafond' ? BG0 : FILE0;
  const s = fs.readFileSync(cible, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  // La copie mutée vit À CÔTÉ de l'original (ses imports relatifs restent justes), puis est effacée.
  const copie = path.join(path.dirname(cible), `.mut-${mut}-${process.pid}${path.extname(cible)}`);
  fs.writeFileSync(copie, s.replace(a, b));
  process.on('exit', () => { try { fs.unlinkSync(copie); } catch (_) {} });
  if (mut === 'plafond') BG = copie; else FILE = copie;
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };

(async () => {
  const F = await import(pathToFileURL(FILE).href);
  const owner = 'o1';
  const cibles = (n) => Array.from({ length: n }, (_, i) => ({ itemId: String(1000 + i), recipientId: String(5000 + i), notificationId: 'n' + i, initiator: 'favourite' }));
  // Un envoi complet : réserver, puis « envoyé », et noter le temps tiré.
  const tirer = (rythme, n, base = { intervalleMinutes: 6 }) => {
    let d = null, t = 1.8e12;
    d = F.lancerFile(d, { owner, targets: cibles(n), message: 'Bonjour', ...base, maintenant: t, rythme }).data;
    const delais = [];
    for (let i = 0; i < n; i++) {
      const r = F.reserverFile(d, { owner, maintenant: t, jeton: 'jeton-' + rythme + '-' + i });
      if (!r.data || !r.valeur.travail) break;
      d = r.data;
      delais.push(d.enCours.delai);
      d.enCours.autorise = true;
      d = F.terminerFile(d, { owner, jeton: 'jeton-' + rythme + '-' + i, resultat: 'envoye', maintenant: t + 5000, ecrits: 2 }).data || d;
      t = Math.max(t + 5000, d.groupes[owner].prochain || 0) + 1;
    }
    return delais;
  };
  try {
    const n = tirer('normal', 400);
    dit(n.length === 400, `400 envois tirés au rythme « normal » (${n.length})`);
    dit(n.every((x) => x >= 40000 && x <= 90000), `normal : chaque attente entre 40 et 90 s (min ${Math.min(...n) / 1000} s, max ${Math.max(...n) / 1000} s)`);
    dit(!n.some((x) => x < 40000), 'normal : jamais sous 40 s');
    dit(n.every((x, i) => i === 0 || x !== n[i - 1]), 'normal : jamais deux fois de suite la même attente', n.slice(0, 12).join(','));
    dit(new Set(n).size >= 30, `normal : tirées au hasard (${new Set(n).size} valeurs différentes sur 51 possibles)`);
    dit(n.every((x) => x % 1000 === 0), 'normal : à la seconde (pas de valeur fabriquée hors des bornes)');
    const p = tirer('prudent', 200);
    dit(p.length === 200 && p.every((x) => x >= 120000 && x <= 240000) && p.every((x, i) => i === 0 || x !== p[i - 1]) && new Set(p).size >= 40, `prudent : 2 à 4 min, jamais deux fois de suite la même (${new Set(p).size} valeurs)`, p.slice(0, 8).join(','));
    const ancien = tirer(null, 20, { intervalleMinutes: 6 });
    dit(ancien.every((x) => x >= 361000 && x <= 389000), 'sans rythme (file ou réglages « perso ») : ses minutes, comme avant (6 min + 1 à 29 s)', ancien.slice(0, 5).join(','));
    // Rejouée : même jeton, même état ⇒ même temps (comparer-et-échanger).
    let d1 = F.lancerFile(null, { owner, targets: cibles(2), message: 'B', intervalleMinutes: 6, maintenant: 1.8e12, rythme: 'normal' }).data;
    const a = F.reserverFile(structuredClone(d1), { owner, maintenant: 1.8e12, jeton: 'j-rejeu' }).data.enCours.delai;
    const b = F.reserverFile(structuredClone(d1), { owner, maintenant: 1.8e12, jeton: 'j-rejeu' }).data.enCours.delai;
    dit(a === b, 'une décision rejouée tire le même temps', `${a} ${b}`);
    dit(F.lancerFile(null, { owner, targets: cibles(1), message: 'B', intervalleMinutes: 6, maintenant: 1.8e12, rythme: 'turbo' }).data.groupes[owner].rythme === null, 'un rythme inconnu n’est pas accepté (ses minutes restent)');
  } catch (e) { dit(false, 'la vraie file — exception', e && e.stack); }

  // Le réglage.
  try {
    const R = await import(pathToFileURL(path.join(RACINE, 'src', 'reglagesFavoris.js')).href);
    const v = R.validerReglagesFavoris({ message: 'Bonjour', intervalleMinutes: '6' });
    dit(v.rythme === 'normal', 'réglage : absent ⇒ « normal » (40–90 s, sa décision)');
    dit(R.validerReglagesFavoris({ message: 'Bonjour', intervalleMinutes: '6', rythme: 'prudent' }).rythme === 'prudent', 'réglage : « prudent » accepté');
    let refus = false; try { R.validerReglagesFavoris({ message: 'Bonjour', intervalleMinutes: '6', rythme: 'turbo' }); } catch (_) { refus = true; }
    dit(refus, 'réglage : un rythme inconnu est refusé');
  } catch (e) { dit(false, 'réglages — exception', e && e.stack); }

  // Les plafonds de l'extension, sur le VRAI background.js.
  try {
    const { faireFond } = require('./_fond-vm.cjs');
    const f = faireFond({ src: BG });
    const src = fs.readFileSync(BG, 'utf8');
    const c = (re) => { const m = re.exec(src); return m ? Number(m[1]) : null; };
    dit(c(/^const ACTIONS_MAX_HEURE = (\d+);/m) === 50 && c(/^const RESERVE_GESTES = (\d+);/m) === 5, 'plafonds inchangés : 50 actions/heure, réserve 5');
    dit(c(/^const PAR_HEURE_SORTE_DEFAUT = (\d+);/m) === 15 && c(/^const PRUDENCE_ACTIONS_HEURE = (\d+);/m) === 20 && c(/^const DISCRETION_JOUR_DEFAUT = (\d+);/m) === 200, 'plafonds inchangés : 15/h favoris et offres, 20/h en prudence, 200 par jour');
    // Exécuté : 15 favoris passent la porte, le 16e attend (la porte du vrai fond).
    if (f.lignes.main === undefined) f.lignes.main = {};
    let passes = 0, refus = null;
    for (let i = 0; i < 20; i++) { const p = await f.ctx.porteDiscretion('111', 'favori'); if (p) { refus = p; break; } await f.ctx.noterGesteAuto('111', 'favori'); passes++; }
    dit(passes === 15 && refus && refus.code, `exécuté : la porte des favoris laisse passer 15 messages dans l’heure, puis attend (${passes}, ${refus && refus.code})`);
  } catch (e) { dit(false, 'plafonds — exception', e && e.stack); }

  console.log(`\n${ko ? '❌' : '✅'} audit-rythme-favoris : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
