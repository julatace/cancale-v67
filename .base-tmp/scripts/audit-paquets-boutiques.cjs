#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DES PAQUETS DES BOUTIQUES (8 nov.) — docs/boutiques/README.md
//
//  Ce qu'on envoie à Google, Microsoft et Mozilla doit être EXACTEMENT le code
//  de la version servie (public/VRM-extension.zip, celle que l'app attend) —
//  une boutique qui reçoit un autre code publierait une version que personne
//  n'a vérifiée. Et chaque fiche doit justifier CHAQUE autorisation et CHAQUE
//  site du manifeste (motif de refus n° 1), la politique de l'extension nommer
//  chaque site, les images avoir les tailles exigées.
//
//   A  versions : manifeste servi = dossier source = CODE_VERSION = EXT_ATTENDUE
//   B  le dossier source est le zip servi, octet pour octet
//   C  chrome / edge : les fichiers du zip servi (sans README.md), octet pour octet
//   D  firefox : le même code ; seuls manifest.json (= manifesteFirefox du servi),
//      popup.html (+ compat) et compat-firefox.js diffèrent ; gecko.id définitif,
//      données déclarées, pas d'externally_connectable
//   E  règles des boutiques sur le manifeste : MV3, ni `key` ni `update_url`, pas
//      de <all_urls>, description ≤ 132, icône 128 × 128 dans le paquet
//   F  fiches (chrome, edge, firefox) : chaque autorisation et chaque site entre
//      `…` ; résumé = description du manifeste ; description Edge 250–10 000 ;
//      URL de la politique ; la politique nomme chaque site
//   G  visuels : 1 à 5 captures 1280 × 800, tuiles 440 × 280 / 1400 × 560, logo 300
//   H  l'app : `installerExtensionIci` — fiche publiée ⇒ boutique, sinon le zip ;
//      LIENS_BOUTIQUES vide ou sur le bon domaine
//
//    node scripts/audit-paquets-boutiques.cjs [--prouve]
//  `--prouve` : chaque mutation (un octet, un id, une ligne de fiche…) doit
//  faire rougir au moins un contrôle (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { fabriquer } = require('./paquets-boutiques.cjs');
const Z = require('./zip-extension.cjs');

const R = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (rel) => fs.readFileSync(path.join(R, rel), 'utf8');

function dezipper(zip) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-audit-boutique-'));
  try {
    execFileSync('unzip', ['-qq', zip, '-d', d]);
    const m = new Map();
    (function marche(dir, pre) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name), rel = pre + e.name;
        if (e.isDirectory()) marche(p, rel + '/'); else m.set(rel, fs.readFileSync(p));
      }
    })(d, '');
    return m;
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}
function dossier(dir) {
  const m = new Map();
  (function marche(d, pre) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) marche(p, pre + e.name + '/'); else m.set(pre + e.name, fs.readFileSync(p)); } })(dir, '');
  return m;
}
const tailPng = (b) => (b && b.length > 24 && b.readUInt32BE(0) === 0x89504e47) ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
const entre = (txt, nom) => { const m = new RegExp(`<!-- ${nom} -->\\n([\\s\\S]*?)\\n<!-- /${nom} -->`).exec(txt || ''); return m ? m[1].trim() : null; };
const enCode = (txt, motif) => (txt || '').includes('`' + motif + '`');
const DOMAINES_BOUTIQUES = { chrome: /^https:\/\/chromewebstore\.google\.com\/detail\//, edge: /^https:\/\/microsoftedge\.microsoft\.com\/addons\/detail\//, opera: /^https:\/\/addons\.opera\.com\//, firefox: /^https:\/\/addons\.mozilla\.org\//, safari: /^https:\/\/apps\.apple\.com\// };

// ── LE JUGE : un état complet ⇒ le nombre de contrôles rouges ───────────────
function juger(E, { muet = false } = {}) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!muet) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
  const mServi = JSON.parse(E.servi.get('manifest.json').toString('utf8'));
  // A
  const vBg = (/const CODE_VERSION = '([^']+)'/.exec(E.servi.get('background.js').toString('utf8')) || [])[1];
  const vApp = (/const EXT_ATTENDUE = '([^']+)'/.exec(E.appSrc) || [])[1];
  const vSrc = JSON.parse(E.source.get('manifest.json').toString('utf8')).version;
  dit(mServi.version === vSrc && vBg === mServi.version && vApp === mServi.version, `A versions alignées (servi ${mServi.version}, source ${vSrc}, CODE_VERSION ${vBg}, EXT_ATTENDUE ${vApp})`);
  // B
  const diffB = [...new Set([...E.servi.keys(), ...E.source.keys()])].filter((f) => !E.servi.has(f) || !E.source.has(f) || !E.servi.get(f).equals(E.source.get(f)));
  dit(diffB.length === 0, 'B le dossier source est le zip servi, octet pour octet', diffB.join(', '));
  // C
  const attendus = [...E.servi.keys()].filter((f) => f !== 'README.md').sort();
  for (const b of ['chrome', 'edge']) {
    const p = E.paquets[b];
    const noms = [...p.keys()].sort();
    const diff = [...new Set([...attendus, ...noms])].filter((f) => !p.has(f) || !E.servi.has(f) || !p.get(f).equals(E.servi.get(f)));
    dit(diff.length === 0, `C ${b} : le code servi, octet pour octet, manifeste à la racine`, diff.join(', '));
  }
  // D
  const fx = E.paquets.firefox;
  const libres = new Set(['manifest.json', 'popup.html', Z.COMPAT]);
  const diffD = [...new Set([...attendus, ...fx.keys()])].filter((f) => !libres.has(f) && (!fx.has(f) || !E.servi.has(f) || !fx.get(f).equals(E.servi.get(f))));
  dit(diffD.length === 0, 'D firefox : le même code, octet pour octet (hors manifeste, popup, compat)', diffD.join(', '));
  dit(fx.has(Z.COMPAT) && fx.get(Z.COMPAT).equals(E.compat), 'D firefox : compat-firefox.js est celui de scripts/extension-firefox/');
  const popupAttendu = E.servi.get('popup.html').toString('utf8').replace(/<script\b/i, `<script src="${Z.COMPAT}"></script>\n<script`);
  dit(fx.has('popup.html') && fx.get('popup.html').toString('utf8') === popupAttendu, 'D firefox : popup.html = celle servie + la compatibilité');
  let mFx = null; try { mFx = JSON.parse(fx.get('manifest.json').toString('utf8')); } catch (_) {}
  dit(!!mFx && JSON.stringify(mFx) === JSON.stringify(Z.manifesteFirefox(mServi)), 'D firefox : manifeste = manifesteFirefox(manifeste servi)');
  const g = (mFx && mFx.browser_specific_settings && mFx.browser_specific_settings.gecko) || {};
  dit(g.id === 'vrm@vrm.center', 'D firefox : gecko.id = vrm@vrm.center (définitif)', g.id);
  const req = (g.data_collection_permissions || {}).required || [];
  dit(req.length > 0 && !req.includes('none'), 'D firefox : données collectées déclarées', JSON.stringify(req));
  dit(!!mFx && !mFx.externally_connectable && Array.isArray(mFx.background && mFx.background.scripts), 'D firefox : page de fond, pas d’externally_connectable');
  // E
  const hotes = mServi.host_permissions || [];
  dit(mServi.manifest_version === 3, 'E Manifest V3');
  dit(!('key' in mServi) && !('update_url' in mServi), 'E ni `key` ni `update_url` (la boutique les pose)');
  dit(!hotes.some((h) => /<all_urls>|^\*:\/\/\*\/|^https?:\/\/\*\/\*$/.test(h)), 'E aucune autorisation sur tous les sites');
  dit([...String(mServi.description || '')].length <= 132 && [...String(mServi.name || '')].length <= 75, `E description ≤ 132 car. (${[...String(mServi.description || '')].length}), nom ≤ 75`);
  const ic = (mServi.icons || {})['128'];
  const dim = tailPng(ic && E.paquets.chrome.get(ic));
  dit(!!dim && dim[0] === 128 && dim[1] === 128, 'E icône 128 × 128 dans le paquet', dim && dim.join('×'));
  // F
  const matchesCs = [...new Set((mServi.content_scripts || []).flatMap((c) => c.matches || []))];
  const sites = [...new Set([...hotes, ...matchesCs])];
  for (const b of ['chrome', 'edge', 'firefox']) {
    const t = E.fiches[b] || '';
    const manque = [...(mServi.permissions || []), ...sites].filter((x) => !enCode(t, x));
    dit(manque.length === 0, `F ${b} : chaque autorisation et chaque site du manifeste est justifié`, manque.join(' '));
    const res = entre(t, 'resume');
    dit(res === mServi.description, `F ${b} : le résumé est la description du manifeste (ce que la boutique affiche)`, res);
    const desc = entre(t, 'description') || '';
    dit(desc.length >= 250 && desc.length <= 10000 && desc.includes('https://vrm.center/legal/extension.html'), `F ${b} : description 250–10 000 car. (${desc.length}) avec le lien de la politique`);
    dit(t.includes('https://vrm.center/legal/extension.html'), `F ${b} : URL de la politique de l'extension`);
  }
  const pol = (E.politique || '').replace(/<[^>]+>/g, ' ');
  const domaines = [...new Set(sites.map((h) => h.replace(/^https:\/\/(\*\.)?/, '').replace(/\/.*$/, '').replace(/^www\./, '')))];
  const absents = domaines.filter((d) => !pol.includes(d));
  dit(absents.length === 0, `F la politique de l'extension nomme chacun des ${domaines.length} sites`, absents.join(' '));
  // G
  const caps = Object.keys(E.visuels).filter((f) => /^capture-.*\.png$/.test(f));
  dit(caps.length >= 1 && caps.length <= 5 && caps.every((f) => String(E.visuels[f]) === '1280,800'), `G ${caps.length} captures 1280 × 800`, JSON.stringify(E.visuels));
  dit(String(E.visuels['tuile-440x280.png']) === '440,280' && String(E.visuels['tuile-1400x560.png']) === '1400,560' && String(E.visuels['logo-300x300.png']) === '300,300', 'G tuiles 440 × 280, 1400 × 560 et logo 300 × 300');
  // H
  const UA = { chrome: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36', edge: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0', firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0' };
  const f = E.installer;
  const vide = f(UA.chrome, {});
  const fiche = 'https://chromewebstore.google.com/detail/vrm/abc';
  const plein = f(UA.chrome, { chrome: fiche });
  const edgeSansFiche = f(UA.edge, { chrome: fiche });
  const fxFiche = f(UA.firefox, { firefox: 'https://addons.mozilla.org/fr/firefox/addon/vrm/' });
  dit(vide.boutique === false && vide.lien === '/VRM-extension.zip', 'H aucune fiche publiée ⇒ le zip, comme avant');
  dit(plein.boutique === true && plein.lien === fiche, 'H fiche Chrome publiée ⇒ Chrome mène à la boutique');
  dit(edgeSansFiche.boutique === false, 'H Edge sans SA fiche ⇒ le zip (jamais la boutique d’un autre navigateur devinée)');
  dit(fxFiche.boutique === true && /addons\.mozilla\.org/.test(fxFiche.lien), 'H fiche Firefox publiée ⇒ Firefox mène à addons.mozilla.org');
  const malPoses = Object.entries(E.liens || {}).filter(([k, v]) => v && !(DOMAINES_BOUTIQUES[k] && DOMAINES_BOUTIQUES[k].test(v)));
  dit(malPoses.length === 0, 'H LIENS_BOUTIQUES : vide, ou une fiche sur le domaine de SA boutique', JSON.stringify(malPoses));
  return ko;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-paquets-'));
  try {
    const faits = fabriquer({ sortie: tmp });
    const paquets = Object.fromEntries(faits.map((f) => [f.id, dezipper(f.zip)]));
    const brut = dezipper(path.join(R, 'public', 'VRM-extension.zip'));
    const servi = new Map([...brut].filter(([k]) => k.startsWith('VRM-extension/')).map(([k, v]) => [k.slice('VRM-extension/'.length), v]));
    const vis = path.join(R, 'docs', 'boutiques', 'visuels');
    const visuels = fs.existsSync(vis) ? Object.fromEntries(fs.readdirSync(vis).filter((f) => f.endsWith('.png')).map((f) => [f, tailPng(fs.readFileSync(path.join(vis, f)))])) : {};
    const N = await import('file://' + path.join(R, 'src', 'navigateurExtension.js'));
    const E = {
      servi, source: dossier(path.join(R, 'vinted-sync-extension')), paquets,
      compat: fs.readFileSync(path.join(R, 'scripts', 'extension-firefox', Z.COMPAT)),
      fiches: { chrome: lire('docs/boutiques/chrome-web-store.md'), edge: lire('docs/boutiques/edge.md'), firefox: lire('docs/boutiques/firefox.md') },
      politique: lire('public/legal/extension.html'), visuels, appSrc: lire('src/App.jsx'),
      installer: N.installerExtensionIci, liens: N.LIENS_BOUTIQUES,
    };
    let ko = juger(E);
    if (PROUVE) {
      console.log('\n── --prouve : chaque mutation doit faire rougir au moins un contrôle');
      const remplace = (m, f, buf) => new Map([...m].map(([k, v]) => [k, k === f ? buf : v]));
      const bg = E.paquets.chrome.get('background.js');
      const fxm = JSON.parse(E.paquets.firefox.get('manifest.json').toString('utf8'));
      const MUT = [
        ['un octet de background.js changé dans le paquet Chrome', () => ({ ...E, paquets: { ...E.paquets, chrome: remplace(E.paquets.chrome, 'background.js', Buffer.concat([bg, Buffer.from(' ')])) } })],
        ['README.md glissé dans le paquet Edge', () => ({ ...E, paquets: { ...E.paquets, edge: new Map([...E.paquets.edge, ['README.md', Buffer.from('x')]]) } })],
        ['un fichier du code manquant dans le paquet Firefox', () => ({ ...E, paquets: { ...E.paquets, firefox: new Map([...E.paquets.firefox].filter(([k]) => k !== 'lbc.js')) } })],
        ['gecko.id changé dans le paquet Firefox', () => ({ ...E, paquets: { ...E.paquets, firefox: remplace(E.paquets.firefox, 'manifest.json', Buffer.from(JSON.stringify({ ...fxm, browser_specific_settings: { ...fxm.browser_specific_settings, gecko: { ...fxm.browser_specific_settings.gecko, id: 'autre@vrm.center' } } }))) } })],
        ['le dossier source a changé sans refaire le zip servi', () => ({ ...E, source: remplace(E.source, 'popup.js', Buffer.from('// autre')) })],
        ['la ligne `downloads` retirée de la fiche Chrome', () => ({ ...E, fiches: { ...E.fiches, chrome: E.fiches.chrome.replace(/^\| `downloads` .*$/m, '') } })],
        ['l’hôte amazonaws retiré de la fiche Edge', () => ({ ...E, fiches: { ...E.fiches, edge: E.fiches.edge.split('`https://*.amazonaws.com/*`').join('amazonaws') } })],
        ['le résumé de la fiche Firefox ne suit plus le manifeste', () => ({ ...E, fiches: { ...E.fiches, firefox: E.fiches.firefox.replace(/(<!-- resume -->\n)[^\n]+/, '$1Un autre résumé') } })],
        ['la politique ne nomme plus amazonaws.com', () => ({ ...E, politique: E.politique.split('amazonaws.com').join('un stockage') })],
        ['une capture qui n’est plus en 1280 × 800', () => ({ ...E, visuels: { ...E.visuels, [Object.keys(E.visuels).find((f) => f.startsWith('capture-'))]: [1280, 720] } })],
        ['installerExtensionIci qui ignore les fiches publiées', () => ({ ...E, installer: (ua) => ({ boutique: false, lien: '/VRM-extension.zip' }) })],
        ['installerExtensionIci qui prête la fiche Chrome à Edge', () => ({ ...E, installer: (ua, l) => { const r = E.installer(ua, l); return (!r.boutique && l.chrome) ? { boutique: true, lien: l.chrome } : r; } })],
        ['un lien de boutique sur un domaine deviné', () => ({ ...E, liens: { ...E.liens, firefox: 'https://vrm.center/extension' } })],
      ];
      let prises = 0;
      for (const [nom, f] of MUT) {
        const n = juger(f(), { muet: true });
        if (n > 0) { prises++; console.log(`✅ mutation « ${nom} » ⇒ ${n} rouge(s)`); } else { ko++; console.log(`❌ mutation « ${nom} » : tout reste vert`); }
      }
      console.log(`${prises}/${MUT.length} mutations attrapées.`);
    }
    console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ Les paquets des boutiques sont le code servi ; fiches, politique et images sont complètes.');
    process.exitCode = ko ? 1 : 0;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
