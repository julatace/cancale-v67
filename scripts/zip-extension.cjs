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
//    `compat-firefox.js` en tête de chaque script.
//  · Orion iPhone/iPad (`--orion <chemin.xpi>`) : WebExtension MV2 à la racine,
//    page de fond non persistante, adaptateur d’API et injection de page différée.
// Mêmes fichiers de code,
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
const iSa = args.indexOf('--safari');
const safari = iSa >= 0 ? path.resolve(args[iSa + 1] || '') : '';
const iOrion=args.indexOf('--orion');
const orionPublic=path.join(racine,'public','VRM-Orion.xpi');
const orion=iOrion>=0?path.resolve(args[iOrion+1]||''):orionPublic;
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

// ── LE MANIFESTE SAFARI (Mac et iPhone, 20 octobre) ─────────────────────────
// Safari n'installe pas un zip : il faut une app conteneur, faite sur un Mac
// avec Xcode (`xcrun safari-web-extension-converter VRM-safari/`), signée par
// un compte développeur Apple (docs/boutiques-extension.md). Ce paquet est le
// DOSSIER prêt à passer au convertisseur. Ce qui change (source : données de
// compatibilité de MDN, browser-compat-data) :
//  · `background.scripts` + `persistent: false` : Safari iOS n'accepte qu'un
//    fond NON persistant (service worker, ou page non persistante) ; la page
//    permet de poser `compat-firefox.js` devant, comme Firefox ;
//  · `downloads` retiré des permissions : Safari ne l'a pas (le bordereau a
//    deux autres portes : l'API Vinted et inject.js) ;
//  · `strict_min_version` 16.4 : le premier Safari où le fond déclare son type ;
//    le monde MAIN des scripts de contenu n'arrive qu'en Safari 18 — avant,
//    lbc-inject.js et vc-inject.js se posent eux-mêmes dans la page ;
//  · `externally_connectable` GARDÉ : Safari le prend en charge (matches seuls).
function manifesteSafari(m) {
  const f = JSON.parse(JSON.stringify(m));
  const fond = f.background && f.background.service_worker;
  f.background = { scripts: [COMPAT, fond || 'background.js'], persistent: false };
  f.permissions = (f.permissions || []).filter((p) => p !== 'downloads');
  f.browser_specific_settings = { safari: { strict_min_version: '16.4' } };
  for (const cs of f.content_scripts || []) {
    if (cs.world === 'MAIN') continue;
    if (Array.isArray(cs.js) && cs.js[0] !== COMPAT) cs.js = [COMPAT, ...cs.js];
  }
  return f;
}
// Orion iOS: legacy WebExtension import, no Chrome service worker or MAIN
// declaration. Preserve the shared runtime; use its page relay and own API shim.
function manifesteOrion(m){
 const f=JSON.parse(JSON.stringify(m));
 f.manifest_version=2;
 f.background={scripts:['compat-orion.js',m.background.service_worker],persistent:false};
 f.permissions=[...new Set([...(m.permissions||[]).filter(p=>!['scripting','downloads'].includes(p)),...(m.host_permissions||[])])];
 delete f.host_permissions;delete f.externally_connectable;
 f.browser_action=f.action;delete f.action;
 // 31 oct. : Orion sur iPhone a refusé le paquet. On ne garde que ce qu'un
 // lecteur WebExtension ancien connaît : l'identifiant, sans
 // `data_collection_permissions` (clé de 2025 propre à addons.mozilla.org).
 f.browser_specific_settings={gecko:{id:'vrm@vrm.center'}};
 f.web_accessible_resources=[...new Set((m.web_accessible_resources||[]).flatMap(x=>x.resources||[]))];
 f.content_scripts=(m.content_scripts||[]).filter(c=>!(c.world==='MAIN'&&(c.js||[]).includes('inject.js'))).map(c=>{
  const n={...c};delete n.world;n.js=['compat-orion.js',...(n.js||[])];return n;
 });
 f.content_scripts.unshift({matches:['https://*.vinted.fr/*','https://*.vinted.com/*','https://*.vinted.it/*','https://*.vinted.de/*','https://*.leboncoin.fr/*','https://*.vestiairecollective.com/*'],js:['compat-orion.js','orion-main.js'],run_at:'document_start',all_frames:false});
 return f;
}
// La fenêtre de l'icône charge ses scripts elle-même : la compatibilité d'abord.
function compatDansPopup(dossier) {
  const ph = path.join(dossier, 'popup.html');
  const html = fs.readFileSync(ph, 'utf8');
  if (html.includes(COMPAT)) return;
  const n = html.replace(/<script\b/i, `<script src="${COMPAT}"></script>\n<script`);
  if (n === html) throw new Error('popup.html : aucune balise <script> où poser la compatibilité');
  fs.writeFileSync(ph, n);
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
    compatDansPopup(fx);
    fs.rmSync(firefox, { force: true });
    execFileSync('zip', ['-qrX', firefox, ...fs.readdirSync(fx)], { cwd: fx });
    console.log('✓', firefox, '(Firefox ordinateur et Android : addons.mozilla.org)');
  }
  if (safari) {
    const sa = path.join(tmp, 'VRM-safari');
    fs.cpSync(dossier, sa, { recursive: true });
    fs.rmSync(path.join(sa, 'README.md'), { force: true });
    fs.copyFileSync(path.join(__dirname, 'extension-firefox', COMPAT), path.join(sa, COMPAT));
    const m = JSON.parse(fs.readFileSync(path.join(sa, 'manifest.json'), 'utf8'));
    fs.writeFileSync(path.join(sa, 'manifest.json'), JSON.stringify(manifesteSafari(m), null, 2) + '\n');
    compatDansPopup(sa);
    fs.rmSync(safari, { force: true });
    // Un zip qui se dézippe en UN dossier (`VRM-safari/`) : c'est ce dossier
    // qu'on donne au convertisseur d'Apple.
    execFileSync('zip', ['-qrX', safari, 'VRM-safari'], { cwd: tmp });
    console.log('✓', safari, '(Safari Mac et iPhone : dossier à convertir avec Xcode)');
  }
  if(orion){
    const o=path.join(tmp,'orion');fs.cpSync(dossier,o,{recursive:true});fs.rmSync(path.join(o,'README.md'),{force:true});
    for(const nom of ['compat-orion.js','orion-main.js'])fs.copyFileSync(path.join(__dirname,'extension-orion',nom),path.join(o,nom));
    const m=JSON.parse(fs.readFileSync(path.join(o,'manifest.json'),'utf8'));
    fs.writeFileSync(path.join(o,'manifest.json'),JSON.stringify(manifesteOrion(m),null,2)+'\n');
    const ph=path.join(o,'popup.html');fs.writeFileSync(ph,fs.readFileSync(ph,'utf8').replace(/<script\b/i,'<script src="compat-orion.js"></script>\n<script'));
    fs.rmSync(orion,{force:true});execFileSync('zip',['-qrX',orion,...fs.readdirSync(o)],{cwd:o});
    if(orion===orionPublic){
      fs.copyFileSync(orion,path.join(racine,'public','VRM-Orion.zip'));
      // 31 oct. : le MÊME contenu, mais qui se dézippe en UN dossier
      // `VRM-Orion/` (manifest.json à sa racine) : dans Fichiers, toucher le zip
      // donne le dossier, qu'Orion installe comme une extension « depuis des
      // fichiers locaux ».
      const od=path.join(tmp,'VRM-Orion');fs.cpSync(o,od,{recursive:true});
      const dz=path.join(racine,'public','VRM-Orion-dossier.zip');
      fs.rmSync(dz,{force:true});execFileSync('zip',['-qrX',dz,'VRM-Orion'],{cwd:tmp});
      console.log('✓',path.relative(racine,dz),'(Orion iPhone/iPad : un dossier VRM-Orion)');
      const notice=path.join(racine,'public','VRM-Orion-installation.txt');
      if(fs.existsSync(notice))fs.writeFileSync(notice,fs.readFileSync(notice,'utf8').replace(/^Version du moteur VRM : .*$/m,'Version du moteur VRM : '+m.version));
    }
    console.log('✓',orion,'(Orion iPhone/iPad : archive WebExtension, manifest.json à la racine ; appareil réel à vérifier)');
  }

} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
