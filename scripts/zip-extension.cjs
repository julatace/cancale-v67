#!/usr/bin/env node
// Fabrique les DEUX paquets de l'extension à partir de `vinted-sync-extension/` :
//  · public/VRM-extension.zip — celui que l'app propose : il se dézippe en UN
//    dossier au nom stable (`VRM-extension/`), qui remplace l'ancien au même
//    endroit (règle §2.6) ;
//  · le paquet du Chrome Web Store (`--store <chemin>`) : la boutique exige
//    `manifest.json` À LA RACINE du zip, sans dossier autour.
// Les deux portent exactement les mêmes fichiers (`audit-extension-zip.cjs`
// vérifie le premier octet pour octet contre la source).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const racine = path.join(__dirname, '..');
const src = path.join(racine, 'vinted-sync-extension');
const args = process.argv.slice(2);
const iStore = args.indexOf('--store');
const store = iStore >= 0 ? path.resolve(args[iStore + 1] || '') : '';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-zip-'));
try {
  const dossier = path.join(tmp, 'VRM-extension');
  fs.cpSync(src, dossier, { recursive: true });
  const sortie = path.join(racine, 'public', 'VRM-extension.zip');
  fs.rmSync(sortie, { force: true });
  execFileSync('zip', ['-qrX', sortie, 'VRM-extension'], { cwd: tmp });
  console.log('✓', path.relative(racine, sortie));
  if (store) {
    fs.rmSync(store, { force: true });
    // README : documentation interne, inutile à la boutique.
    const fichiers = fs.readdirSync(dossier).filter((f) => f !== 'README.md');
    execFileSync('zip', ['-qrX', store, ...fichiers], { cwd: dossier });
    console.log('✓', store, '(Chrome Web Store : manifest.json à la racine)');
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
