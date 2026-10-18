#!/usr/bin/env node
// Fabrique les DEUX paquets de l'extension à partir de `vinted-sync-extension/` :
//  · public/VRM-extension.zip — celui que l'app propose : il se dézippe en UN
//    dossier au nom stable (`VRM-extension/`), qui remplace l'ancien au même
//    endroit (règle §2.6) ;
//  · le paquet du Chrome Web Store (`--store <chemin>`) : la boutique exige
//    `manifest.json` À LA RACINE du zip, sans dossier autour. Le MÊME paquet
//    sert Microsoft Edge Add-ons et Opera Add-ons (moteur Chromium) ;
//  · le paquet Firefox (`--firefox <chemin>`, addons.mozilla.org — ordinateur
//    ET Firefox pour Android) : manifeste adapté par `manifesteFirefox`, plus
//    `compat-firefox.js` en tête de chaque script. Mêmes fichiers de code,
//    octet pour octet (`audit-extension-navigateurs.cjs` le vérifie).
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
const iFx = args.indexOf('--firefox');
const firefox = iFx >= 0 ? path.resolve(args[iFx + 1] || '') : '';
const COMPAT = 'compat-firefox.js';

// ── LE MANIFESTE FIREFOX (Firefox 128+, ordinateur et Android) ─────────────
// Ce qui change, et pourquoi — rien d'autre n'est touché :
//  · `background.scripts` au lieu de `service_worker` : Firefox n'exécute pas
//    de service worker d'extension, il charge une page de fond (mêmes API) ;
//  · `browser_specific_settings` : l'identifiant stable (addons.mozilla.org
//    l'exige) et la version minimale — 128, la première qui accepte
//    `world: "MAIN"` (scripts de Leboncoin et Vestiaire) ; la DÉCLARATION des
//    données transmises, exigée de toute nouvelle extension ;
//  · `externally_connectable` retiré : Firefox ne le connaît pas. La connexion
//    de l'extension passe alors par le pont de la page (`adresse`, bridge.js),
//    toujours ADRESSÉE à cette extension par son identifiant ;
//  · `compat-firefox.js` en tête de chaque script qui parle à `chrome.*`
//    (jamais dans ceux du monde de la page : ils n'ont pas `chrome`).
const ID_FIREFOX = 'vrm@vrm.center';
function manifesteFirefox(m) {
  const f = JSON.parse(JSON.stringify(m));
  const fond = f.background && f.background.service_worker;
  f.background = { scripts: [COMPAT, fond || 'background.js'] };
  delete f.externally_connectable;
  f.browser_specific_settings = {
    gecko: {
      id: ID_FIREFOX,
      strict_min_version: '128.0',
      data_collection_permissions: {
        required: ['authenticationInfo', 'personallyIdentifyingInfo', 'personalCommunications', 'financialAndPaymentInfo', 'websiteContent', 'websiteActivity'],
      },
    },
    gecko_android: { strict_min_version: '128.0' },
  };
  for (const cs of f.content_scripts || []) {
    if (cs.world === 'MAIN') continue;
    if (Array.isArray(cs.js) && cs.js[0] !== COMPAT) cs.js = [COMPAT, ...cs.js];
  }
  return f;
}

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
    console.log('✓', store, '(Chrome Web Store, Edge, Opera : manifest.json à la racine)');
  }
  if (firefox) {
    const fx = path.join(tmp, 'firefox');
    fs.cpSync(dossier, fx, { recursive: true });
    fs.rmSync(path.join(fx, 'README.md'), { force: true });
    fs.copyFileSync(path.join(__dirname, 'extension-firefox', COMPAT), path.join(fx, COMPAT));
    const m = JSON.parse(fs.readFileSync(path.join(fx, 'manifest.json'), 'utf8'));
    fs.writeFileSync(path.join(fx, 'manifest.json'), JSON.stringify(manifesteFirefox(m), null, 2) + '\n');
    // La fenêtre de l'icône charge ses scripts elle-même : la compatibilité d'abord.
    const ph = path.join(fx, 'popup.html');
    const html = fs.readFileSync(ph, 'utf8');
    if (!html.includes(COMPAT)) {
      const n = html.replace(/<script\b/i, `<script src="${COMPAT}"></script>\n<script`);
      if (n === html) throw new Error('popup.html : aucune balise <script> où poser la compatibilité Firefox');
      fs.writeFileSync(ph, n);
    }
    fs.rmSync(firefox, { force: true });
    execFileSync('zip', ['-qrX', firefox, ...fs.readdirSync(fx)], { cwd: fx });
    console.log('✓', firefox, '(Firefox ordinateur et Android : addons.mozilla.org)');
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
