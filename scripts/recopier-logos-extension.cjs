// ════════════════════════════════════════════════════════════════════════════
//  LES LOGOS DES TRANSPORTEURS DANS L'EXTENSION (20 nov., ext. 5.410) — une COPIE refabriquée, jamais à la main.
//  La source est src/transporteursVisuels.js (`TRANSPORTEURS`, `marqueDuTransporteur`, `LISERE_TUILE`) : ce script
//  réécrit le bloc `<logos-transporteurs>` de vinted-sync-extension/vrm-ui.js (le panneau « Commandes » de la carte
//  les dessine à côté du transporteur, comme l'app). `--verifie` : rouge si la copie n'est plus la source.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const UI = path.join(RACINE, 'vinted-sync-extension', 'vrm-ui.js');
(async () => {
  const T = await import(pathToFileURL(path.join(RACINE, 'src', 'transporteursVisuels.js')).href);
  const map = {};
  for (const cle of Object.keys(T.TRANSPORTEURS)) { const m = T.marqueDuTransporteur(cle); if (m && m.fond) map[cle] = { nom: T.nomDuTransporteur(cle), fond: m.fond, svg: String(m.svg || '') }; }
  const bloc = `  // <logos-transporteurs> — COPIE de src/transporteursVisuels.js (scripts/recopier-logos-extension.cjs). Ne pas modifier ici.\n  const LOGOS_TRANSP = ${JSON.stringify(map)};\n  const LISERE_TRANSP = ${JSON.stringify(T.LISERE_TUILE)};\n  // </logos-transporteurs>\n`;
  const s = fs.readFileSync(UI, 'utf8');
  const re = /  \/\/ <logos-transporteurs>[\s\S]*?\/\/ <\/logos-transporteurs>\n/;
  if (process.argv.includes('--verifie')) {
    const m = re.exec(s);
    const ok = !!m && m[0] === bloc;
    console.log(ok ? '✅ logos des transporteurs : la copie de l’extension est la source' : '❌ logos des transporteurs : la copie de vrm-ui.js n’est plus la source — node scripts/recopier-logos-extension.cjs');
    process.exit(ok ? 0 : 1);
  }
  const n = re.test(s) ? s.replace(re, bloc) : s.replace("  const MOTS = {", bloc + "  const MOTS = {");
  fs.writeFileSync(UI, n);
  console.log(`logos recopiés : ${Object.keys(map).length} transporteurs`);
})();
