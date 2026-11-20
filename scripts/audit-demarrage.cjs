#!/usr/bin/env node
// ── audit-demarrage — « BIEN DÉMARRER » ET « TOUT VA BIEN ? » EN POINTS (20 nov.) ─────────────────
// Exécute les VRAIES règles (src/parcoursNouveau/regle.js, src/toutVaBienPoints.js) :
//   E  les six pages dans l'ordre ; une position du 15 nov. reprend à la page qui la remplace ;
//      « fin » range `pret` ;
//   N  le navigateur d'ici : Chrome / Brave / Edge ⇒ le zip tant qu'aucune fiche n'est publiée, la fiche
//      publiée sinon (jamais devinée) ; Safari iPhone ⇒ installer Orion ; Orion iPhone ⇒ son fichier ;
//      Safari Mac ⇒ un autre navigateur ; Android ⇒ l'ordinateur ;
//   X  l'extension EN DIRECT : « ok » / « maj » ⇒ fait ; « absente » ⇒ à faire ; « verif » ⇒ jamais « fait » sur
//      un silence ; eBay seul ⇒ pas besoin ;
//   C  les comptes captés : en cours · pas su · à faire · fait (avec le nom), par site choisi ;
//   Q  l'étiquetage : fait seulement quand « qui » ET « l'étiquette » sont choisis ; pas lu ⇒ en cours ;
//   T  les points de « Tout va bien ? » : un doublon de N° d'abord, puis l'extension, puis une panne, puis un
//      compte pas relu… ; une panne ne redit pas son compte ; « pas su » n'est pas « à régler » ; chaque point a
//      son geste (ou aucun quand il n'y a rien à faire).
//   node scripts/audit-demarrage.cjs [--mutation=NOM | --prouve]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');
const MUTATIONS = {
  'ancienne-etape': ['src/parcoursNouveau/regle.js', "(ANCIENNES_ETAPES[e] || null)", 'null'],
  'boutique-devinee': ['src/parcoursNouveau/regle.js', "return inst.boutique ? { nav: chromium, mode: 'boutique'", "return true ? { nav: chromium, mode: 'boutique'"],
  'silence-fait': ['src/parcoursNouveau/regle.js', "if (code === 'verif' || code === 'vrm-encours') return { etat: etape && etape.etat === 'fait' ? 'fait' : 'encours', code };", "if (code === 'verif' || code === 'vrm-encours') return { etat: 'fait', code };"],
  'etiquetage-qui-seul': ['src/parcoursNouveau/regle.js', "etat: m.qui && m.support ? 'fait' : 'afaire'", "etat: m.qui ? 'fait' : 'afaire'"],
  'doublon-pas-premier': ['src/toutVaBienPoints.js', 'rang: doublon ? RANGS.doublon : RANGS.controle', 'rang: RANGS.controle'],
  'panne-deux-fois': ['src/toutVaBienPoints.js', '    if (enPanne.has(k)) continue;', ''],
  'passu-a-regler': ['src/toutVaBienPoints.js', "x.type !== 'forme' && x.type !== 'passu'", "x.type !== 'forme'"],
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-dm-'));
  try {
    fs.cpSync(path.join(RAC, 'src'), path.join(tmp, 'src'), { recursive: true, filter: (s) => !/\.(png|webp|jpe?g|woff2?)$/.test(s) });
    fs.cpSync(path.join(RAC, 'api', '_lib'), path.join(tmp, 'api', '_lib'), { recursive: true });
    fs.copyFileSync(path.join(RAC, 'package.json'), path.join(tmp, 'package.json'));
    if (mut) {
      const [f, a, b] = MUTATIONS[mut] || [];
      const p = f && path.join(tmp, f);
      if (!p || !fs.existsSync(p) || !fs.readFileSync(p, 'utf8').includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(3); }
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split(a).join(b));
    }
    const R = await import(pathToFileURL(path.join(tmp, 'src/parcoursNouveau/regle.js')).href);
    const P = await import(pathToFileURL(path.join(tmp, 'src/toutVaBienPoints.js')).href);

    console.log('E. Les six pages');
    dit(R.ETAPES_NOUVEAU.join() === 'plateformes,extension,comptes,etiquetage,historique,pret', 'plateformes → extension → comptes → étiquetage → import → tout est prêt');
    const vieux = R.lireParcoursNouveau({ etape: 'numeros', vues: ['bienvenue', 'plateformes', 'numeros'] });
    dit(vieux.etape === 'etiquetage' && vieux.vues.join() === 'plateformes,etiquetage', 'une position du 15 nov. (« numeros ») reprend à « étiquetage »', vieux);
    dit(R.lireParcoursNouveau({ etape: 'abonnement' }).etape === 'pret' && R.lireParcoursNouveau({ etape: 'bienvenue' }).etape === 'plateformes', '« abonnement » ⇒ prêt, « bienvenue » ⇒ tes sites');
    dit(R.positionApres(null, 'fin').etape === 'pret' && R.positionApres(null, 'fin').fini === true, '« fin » range « prêt », fini');

    console.log('N. Le navigateur d’ici');
    const UA = {
      chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    };
    const vide = { chrome: '', edge: '', opera: '', firefox: '', safari: '' };
    const pub = { ...vide, chrome: 'https://chromewebstore.google.com/detail/vrm/abcdefghijklmnopabcdefghijklmnop' };
    const c0 = R.installationIci({ ua: UA.chrome, kagi: false, liens: vide });
    dit(c0.nav === 'chrome' && c0.mode === 'zip' && c0.lien === '/VRM-extension.zip', 'Chrome, aucune fiche publiée ⇒ le zip guidé', c0);
    const c1 = R.installationIci({ ua: UA.chrome, kagi: false, liens: pub });
    dit(c1.mode === 'boutique' && c1.lien === pub.chrome && c1.nomBoutique === 'Chrome Web Store', 'Chrome, fiche publiée ⇒ le Chrome Web Store', c1);
    const e0 = R.installationIci({ ua: UA.edge, kagi: false, liens: pub });
    dit(e0.nav === 'edge' && e0.mode === 'zip', 'Edge sans SA fiche ⇒ le zip (jamais la boutique d’un autre)', e0);
    dit(R.installationIci({ ua: UA.iphone, kagi: false, liens: vide }).mode === 'orion-app', 'Safari iPhone ⇒ installer Orion');
    const o = R.installationIci({ ua: UA.iphone, kagi: true, liens: vide });
    dit(o.mode === 'orion' && o.lien === '/VRM-Orion.xpi', 'Orion iPhone ⇒ son fichier', o);
    dit(R.installationIci({ ua: UA.safariMac, kagi: false, liens: vide }).mode === 'autre-nav', 'Safari Mac ⇒ Chrome, Edge ou Brave');
    dit(R.installationIci({ ua: UA.android, kagi: false, liens: vide }).mode === 'ordinateur', 'Android ⇒ sur l’ordinateur');

    console.log('X. L’extension en direct');
    dit(R.etatExtensionDirect({ code: 'ok' }, { etat: 'afaire' }).etat === 'fait' && R.etatExtensionDirect({ code: 'maj' }, {}).etat === 'fait', 'elle répond (à jour ou une version de retard) ⇒ fait');
    dit(R.etatExtensionDirect({ code: 'absente' }, { etat: 'afaire' }).etat === 'afaire' && R.etatExtensionDirect({ code: 'vrm', geste: 'brancher' }, {}).etat === 'afaire', 'absente ou pas branchée ⇒ à faire');
    dit(R.etatExtensionDirect({ code: 'verif' }, { etat: 'afaire' }).etat === 'encours', 'on vérifie encore ⇒ jamais « fait » sur un silence');
    dit(R.etatExtensionDirect({ code: 'ok' }, { etat: 'inutile' }).etat === 'inutile', 'eBay seul ⇒ pas besoin');
    dit(R.etatExtensionDirect(null, { etat: 'illisible' }).etat === 'passu', 'rien lu ⇒ « pas su »');

    console.log('C. Les comptes captés');
    const cc = R.comptesCaptes(['vinted', 'leboncoin', 'vestiaire', 'ebay'], { vinted: [{ nom: 'boutique_a' }], leboncoin: [], vestiaire: null });
    dit(cc.vinted.etat === 'fait' && cc.vinted.noms[0] === 'boutique_a' && cc.leboncoin.etat === 'afaire' && cc.vestiaire.etat === 'passu' && cc.ebay.etat === 'encours', 'fait (son nom) · à faire · pas su · en cours', cc);
    dit(Object.keys(R.comptesCaptes([], {})).join() === 'vinted', 'aucun site choisi ⇒ Vinted');

    console.log('Q. L’étiquetage');
    dit(R.etatEtiquetage(undefined).etat === 'encours', 'pas encore lu ⇒ en cours');
    dit(R.etatEtiquetage({ numeroEcrit: null, prefixe: '', etiquetage: null }).etat === 'afaire', 'jamais choisi ⇒ à faire');
    dit(R.etatEtiquetage({ numeroEcrit: { actif: false, depuis: 'x', choisi: 'x' }, prefixe: '', etiquetage: null }).etat === 'afaire', '« qui » sans l’étiquette ⇒ à faire');
    dit(R.etatEtiquetage({ numeroEcrit: { actif: false, depuis: 'x', choisi: 'x' }, prefixe: '', etiquetage: { support: 'main' } }).etat === 'fait', '« qui » et l’étiquette ⇒ fait');

    console.log('T. « Tout va bien ? » en points');
    const r = P.pointsEcran({
      nav: { code: 'absente', ton: 'geste', cle: 'ext.nav.absente', geste: 'installer' },
      pannes: [{ plateforme: 'vinted', id: '1', cause: 'refusé' }],
      lignes: [{ plateforme: 'vinted', id: '1', nom: 'a', etat: 'ancien', geste: 'ouvre vinted' }, { plateforme: 'leboncoin', id: 'x', nom: 'b', etat: 'jamais', geste: 'ouvre lbc' }, { plateforme: 'vinted', id: '2', nom: 'c', etat: 'ok', geste: '' }],
      appareils: [{ id: 'm', nom: 'Chrome', paquet: 'chromium', code: '5.300.0' }], versionDe: () => 'ancienne',
      controle: [{ controle: 'comptes-48h', n: 1 }, { controle: 'numeros-double', n: 2 }],
      donnees: 3, passu: ['Leboncoin'], formes: 1,
    });
    const types = r.points.map((x) => x.type + (x.controle ? ':' + x.controle : ''));
    dit(types[0] === 'controle:numeros-double' && types[1] === 'extension' && types[2] === 'panne' && types[3] === 'compte', 'doublon de N°, puis l’extension, puis la panne, puis le compte pas relu', types);
    dit(types.indexOf('passu') > types.indexOf('donnees') && types[types.length - 1] === 'forme', '« pas tout vérifié » et « Vinted a changé une page » en dernier', types);
    dit(r.points.filter((x) => x.type === 'compte' || x.type === 'panne').map((x) => x.plateforme + ':' + x.id).join() === 'vinted:1,leboncoin:x', 'une panne prouvée ne redit pas son compte ; un compte à jour ne paraît pas', r.points.map((x) => x.cle));
    dit(r.n === r.points.length - 2 && r.etat === 'points', '« pas su » et « page changée » ne comptent pas parmi les choses à régler', r.n);
    const geste = (pt) => P.gestePoint(pt, { inst: { lien: '/VRM-extension.zip' }, liensSite: { vinted: 'https://www.vinted.fr', leboncoin: 'https://www.leboncoin.fr' }, lienPaquet: () => '/VRM-extension.zip', allerControle: (c) => (c === 'numeros-double' ? '/?tab=cat_bord' : '') });
    const g = Object.fromEntries(r.points.map((x) => [x.cle, geste(x)]));
    dit(g['extension:ici'] && g['extension:ici'].code === 'installer' && g['extension:ici'].telecharger === true, 'extension absente ⇒ « Installer » (le zip)');
    dit(g['controle:numeros-double'] && g['controle:numeros-double'].aller === '/?tab=cat_bord' && g['compte:leboncoin:x'].lien === 'https://www.leboncoin.fr' && g.passu.code === 'relire' && g.forme === null, 'chaque point a SON geste ; « page changée » n’en a pas');
    const okR = P.pointsEcran({ nav: { code: 'ok', ton: 'ok' }, lignes: [{ plateforme: 'vinted', id: '1', geste: '' }] });
    dit(okR.etat === 'ok' && okR.n === 0 && !okR.points.length, 'rien à régler ⇒ « Tout va bien »');
    dit(P.pointsEcran({ passu: ['Vinted'] }).etat === 'passu', 'rien d’autre que « pas su » ⇒ jamais « Tout va bien »');
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${verts} verts, ${rouges} rouges`);
  process.exit(rouges ? 1 : 0);
})();
