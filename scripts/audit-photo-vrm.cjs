#!/usr/bin/env node
// ── audit-photo-vrm — LA PHOTO FABRIQUÉE PAR L'ATELIER « REPUBLIER PAR VRM » (15 nov., extension 5.392, `photovrm`) ──
// EXÉCUTE le VRAI `recreerVinted` de background.js (`_fond-vm.cjs` : fausse base à état, faux Vinted, faux CDN) :
//   P1  chaque photo RÉGLÉE (`photoReglee`) donne son empreinte (`empreinteDeBlob`, la même que `tickEmpreintes`),
//       rangée dans `photo_vrm_{uid}` : `payload.photos[h] = { h, n (N° de la fiche), src (l'annonce d'origine), uid, at }`
//       — jamais l'image ; le compte de l'onglet ; la file locale vidée ;
//   P2  l'atelier n'en est pas changé : les mêmes requêtes Vinted, dans le même ordre ;
//   P3  une lecture ratée de la ligne n'écrit RIEN (la file reste, reprise au réveil `vrm-offres`) ;
//   P4  la ligne est FUSIONNÉE (une empreinte d'avant reste) et bornée (60 jours) ;
//   P5  l'app verse la ligne au registre `vrm_photos_vrm` (`ajouterAuRegistre`, mêmes champs) ; capacité 5.392.
//   node scripts/audit-photo-vrm.cjs            · --prouve : chaque mutation doit rougir
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = { src: arg('--src', path.join(RACINE, 'vinted-sync-extension/background.js')), app: arg('--app', path.join(RACINE, 'src/App.jsx')) };

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['pasRangee', 'src', "    if (origine) { try { const h = await empreinteDeBlob(blob); if (h) produites.push(h); } catch (_) {} }\n", ''],
    ['pasAppelee', 'src', "  if (origine && produites.length && await noterPhotosVrm(origine, produites)) rangerPhotosVrm().catch(() => {});", ''],
    ['lectureKoEcrit', 'src', "    const r = await sbGet(`app_data?id=eq.photo_vrm_${uid}&select=p:data->payload->photos`);", "    const r = (await sbGet(`app_data?id=eq.photo_vrm_${uid}&select=p:data->payload->photos`)) || [];"],
    ['ecraseSansFusion', 'src', "    const photos = Object.assign({}, (r[0] && r[0].p && typeof r[0].p === 'object' && !Array.isArray(r[0].p)) ? r[0].p : {});", '    const photos = {};'],
    ['sansNumero', 'src', "(i, n) => etapeRepub(id, 'photos', { fait: i, total: n }), { uid, src: id, n: msg && msg.num ? String(msg.num) : '' });", "(i, n) => etapeRepub(id, 'photos', { fait: i, total: n }), { uid, src: id, n: '' });"],
    ['appNeVersePas', 'app', "  useEffect(() => onCloudReady(() => { if (AUTH.user?.id) verserPhotosVrmExtension(); }), []);", ''],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-photo-vrm-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    fs.mkdirSync(path.join(tmp, nom), { recursive: true });
    const fichier = path.join(tmp, nom, path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} rouge(s)${ok ? '' : ' — PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 400)}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const nowISO = () => new Date().toISOString();
// Une image inventée : un NOM ⇒ des pixels (motif à blocs, graine = le nom) ; le réglage garde le nom.
function pixels(nom) {
  let s = 0; for (const c of String(nom)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const n = 64, px = new Uint8ClampedArray(n * n * 4);
  const blocs = Array.from({ length: 64 }, () => Math.floor(r() * 255));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = blocs[Math.floor(y / 8) * 8 + Math.floor(x / 8)]; const k = (y * n + x) * 4; px[k] = v; px[k + 1] = v; px[k + 2] = v; px[k + 3] = 255; }
  return px;
}
function brancherImages(f) {
  f.ctx.createImageBitmap = async (blob) => ({ nom: await blob.text(), width: 64, height: 64, close() {} });
  f.ctx.OffscreenCanvas = function (w, h) { this.width = w; this.height = h; let b = null;
    const cx = { drawImage(bmp) { b = bmp; }, getImageData: () => ({ data: pixels(b ? b.nom : 'vide') }), fillRect() {}, translate() {}, rotate() {}, scale() {}, setTransform() {}, filter: '', fillStyle: '', imageSmoothingQuality: '' };
    this.getContext = () => cx;
    this.convertToBlob = async (o) => new Blob([b ? b.nom : 'vide'], { type: (o && o.type) || 'image/jpeg' }); };
}
const MODELE = JSON.stringify({ item: { id: 9101, title: 'Nike Air Max 1', description: 'nickel', price: '60.0', currency: 'EUR', catalog_id: 1234, brand_id: 53, color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 1 }] } });
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_photoA/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_photoB/f800/2.jpeg'];
function monter({ lectureKO = null, avant = null } = {}) {
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } }, vinted_item_details: {},
    coffre_111_9101: { id: '9101', title: 'Nike Air Max 1', price: 60, desc: 'Nickel, boîte d’origine', photos: PHOTOS },
    vrm_vinted_modele: { '9101': { corps: MODELE, at: nowISO(), uid: '111' } } };
  if (avant) lignes.photo_vrm_111 = avant;
  let n = 500;
  const f = faireFond({ src: F.src, lignes, connecte: '111', lectureKO: lectureKO || (() => false), cdn: (u) => ({ status: 200, body: /\/t\/([^/]+)\//.exec(u)[1] }),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/\d+$/.test(e.chemin)) return { status: 200, body: { item: { id: Number(e.chemin.split('/').pop()) } } };
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: ++n } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: 200, body: { draft: { id: 88001 } } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/\d+\/completion$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/api\/v2\/items\/9101\/delete$/.test(e.chemin)) return { status: 200, body: {} };
      return { status: 404, body: {} };
    } });
  brancherImages(f);
  return f;
}
const lancer = async (f) => { let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', num: '41', prix: 54, titre: 'Nike Air Max 1 — remise en ligne', confirme: true }); } catch (e) { r = { erreur: e.message }; } await attendre(150); return r; };
const seq = (f) => f.j.vinted.filter((v) => !/\/item_upload\/(colors|attributes)$/.test(v.chemin)).map((v) => v.methode + ' ' + v.chemin.replace(/\d{3,}/g, 'N')).join(' | ');

(async () => {
  try {
    const f = monter();
    const r = await lancer(f);
    const ligne = f.lignes.photo_vrm_111;
    const ph = ligne && ligne.payload && ligne.payload.photos || {};
    const vals = Object.values(ph);
    dit(!!ligne && vals.length === 2, 'P1 · deux photos réglées ⇒ deux empreintes dans `photo_vrm_111`', JSON.stringify({ r, ligne }));
    const attendu = f.ctx.empreinteDepuisPixels(pixels('01_0121e_photoA'), 64, 64);
    dit(vals.length && vals.every((e) => /^[0-9a-f]{96}$/.test(e.h) && ph[e.h] === e && e.n === '41' && e.src === '9101' && e.uid === '111' && !Number.isNaN(Date.parse(e.at))) && !!ph[attendu],
      'P1 · { h, n: N°41, src: 9101 (l’annonce d’origine), uid: 111, at } — la MÊME empreinte que `tickEmpreintes` (calculée sur le fichier produit)', JSON.stringify(vals));
    dit(!/data:|JPEG|base64/i.test(JSON.stringify(ligne || {})) && Object.keys(vals[0] || {}).sort().join() === 'at,h,n,src,uid', 'P1 · jamais l’image, rien d’autre que ces cinq champs', JSON.stringify(vals[0]));
    dit(!(f.store.vrmPhotosVrmFile || []).length, 'P1 · la file locale est vidée une fois écrite', JSON.stringify(f.store.vrmPhotosVrmFile));
    // P2 — l'atelier n'est pas changé : comparé à une recréation SANS rangement (fonction neutralisée).
    const g = monter();
    g.ctx.noterPhotosVrm = async () => false;
    await lancer(g);
    dit(seq(f) === seq(g) && /photos/.test(seq(f)) && /drafts/.test(seq(f)), 'P2 · l’atelier fait les mêmes requêtes Vinted, dans le même ordre', `${seq(f)}\n   ≠ ${seq(g)}`);
    // P3 — lecture ratée ⇒ rien écrit, la file reste ; reprise ⇒ écrite.
    let ko3 = true;
    const h3 = monter({ lectureKO: (q) => ko3 && /photo_vrm_111/.test(String(q)) });
    await lancer(h3);
    dit(!h3.lignes.photo_vrm_111 && (h3.store.vrmPhotosVrmFile || []).length === 2, 'P3 · lecture de la ligne ratée : RIEN n’est écrit, les deux empreintes restent dans la file', JSON.stringify({ l: h3.lignes.photo_vrm_111, f: (h3.store.vrmPhotosVrmFile || []).length }));
    ko3 = false;
    await h3.ctx.rangerPhotosVrm();
    dit(h3.lignes.photo_vrm_111 && Object.keys(h3.lignes.photo_vrm_111.payload.photos).length === 2 && !(h3.store.vrmPhotosVrmFile || []).length, 'P3 · la reprise (réveil `vrm-offres`) les écrit', JSON.stringify(h3.lignes.photo_vrm_111));
    dit(/lance\('photosvrm', \(\) => rangerPhotosVrm\(\)\)/.test(fs.readFileSync(F.src, 'utf8')), 'P3 · le réveil `vrm-offres` relance le rangement');
    // P4 — fusion et borne.
    const vieux = 'f'.repeat(96), garde = 'e'.repeat(96);
    const k = monter({ avant: { type: 'photo_vrm', uid: '111', payload: { version: 1, photos: { [garde]: { h: garde, n: '7', src: '8001', uid: '111', at: nowISO() }, [vieux]: { h: vieux, n: '8', src: '8002', uid: '111', at: new Date(Date.now() - 70 * 864e5).toISOString() } } } } });
    await lancer(k);
    const pk = k.lignes.photo_vrm_111.payload.photos;
    dit(pk[garde] && pk[garde].n === '7' && !pk[vieux] && Object.keys(pk).length === 3, 'P4 · fusionnée (l’empreinte d’avant reste) et bornée (plus de 60 jours : sortie)', JSON.stringify(Object.keys(pk)));
  } catch (e) { dit(false, 'P1-P4 · l’audit a tourné jusqu’au bout', String((e && e.stack) || e)); }
  try {
    const APP = fs.readFileSync(F.app, 'utf8');
    const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
    dit(!!cap && /\bphotovrm:\s*'5\.393\.0'/.test(cap[1]), 'P5 · `EXT_CAPACITES.photovrm` = 5.393.0 (servie avec la vague C)');
    dit(/useEffect\(\(\) => onCloudReady\(\(\) => \{ if \(AUTH\.user\?\.id\) verserPhotosVrmExtension\(\); \}\), \[\]\);/.test(APP)
      && /lireTout\(`id=like\.photo_vrm_\*\$\{o\}&select=id,p:data->payload->photos`\)/.test(APP) && /ajouterAuRegistre\(load\(CLE_PHOTOS_VRM, \{\}\), entrees\)/.test(APP),
      'P5 · l’app lit `photo_vrm_*` (projeté) et le verse au registre `vrm_photos_vrm` par `ajouterAuRegistre`');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-photo-vrm-regle-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    for (const x of ['republieTelephone.js', 'photoEmpreinte.js']) fs.copyFileSync(path.join(RACINE, 'src', x), path.join(dir, x));
    const src = fs.readFileSync(path.join(RACINE, 'src', 'republieTelephone.js'), 'utf8');
    for (const m of src.matchAll(/from '\.\/([\w-]+\.js)'/g)) if (!fs.existsSync(path.join(dir, m[1]))) fs.copyFileSync(path.join(RACINE, 'src', m[1]), path.join(dir, m[1]));
    const R = await import(pathToFileURL(path.join(dir, 'republieTelephone.js')).href);
    const h = 'a'.repeat(96);
    const reg = R.ajouterAuRegistre({}, [{ h, n: '41', src: '9101', uid: '111' }]);
    dit(reg && reg[h] && reg[h].n === '41' && reg[h].src === '9101' && reg[h].uid === '111', 'P5 · une entrée de `photo_vrm_{uid}` entre telle quelle au registre (mêmes champs)', JSON.stringify(reg));
  } catch (e) { dit(false, 'P5 · l’audit a tourné jusqu’au bout', String((e && e.stack) || e)); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ photo de l’atelier : tout est vert');
  process.exit(ko ? 1 : 0);
})();
