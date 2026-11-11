// ════════════════════════════════════════════════════════════════════════════
//  PHOTOS EN DOUBLE ENTRE COMPTES (11 nov., lot photos-comptes, extension 5.358)
//
//  Julien : « Vinted relie les comptes entre eux et peut les bannir ; une même
//  photo publiée sur deux de mes comptes est un risque ». L'extension calcule
//  l'empreinte perceptuelle de chaque photo de ses annonces (src/photoEmpreinte.js,
//  recopiée dans background.js), l'app montre les groupes et prévient avant de
//  publier. Le seuil est MESURÉ par scripts/bancs/photos-comptes-seuil.cjs.
//  VRAI background.js dans `_fond-vm.cjs`, images INVENTÉES (le dépôt est public) :
//  l'image servie par le faux CDN est un NOM, que les faux `createImageBitmap` /
//  `OffscreenCanvas` changent en pixels (motif fabriqué, bruit léger possible).
//   E1  une image lue par tour, sans cookie, rangée dans `photo_emprunte_{uid}`
//       (l'empreinte seule : ni l'image, ni un pixel, ni l'adresse signée `?s=`) ;
//       la miniature (`photo.mini`) d'abord.
//   E2  budget de LECTURE du compte connecté (`vrmLectures`), jamais les actions ;
//       budget plein ⇒ aucune image.
//   E3  pas d'onglet Vinted / pause Vinted / il navigue ⇒ rien.
//   E4  l'écart entre deux images est tenu.
//   E5  lecture ratée de la ligne ⇒ rien écrit, la file reste.
//   E6  403 du site des images ⇒ AUCUNE pause de tout Vinted ; 429 ⇒ 24 h sans empreinte.
//   E7  une annonce qui n'est plus en ligne sort de la ligne.
//   R1  `photosEnDouble` : comptes différents ⇒ un groupe ; même compte ⇒ rien ;
//       compte pas relu / empreinte manquante ⇒ « pas vérifiées », jamais « aucun ».
//   R2  `dejaSurAutreCompte` : l'annonce elle-même et le compte cible ne comptent pas.
//   R3  §5 : la règle n'est lue par aucune règle d'identité (`entryKeyByPhoto`,
//       `jumellesParPhoto`, src/App.jsx) ; elle n'écrit aucun numéro.
//   C1  bloc <empreinte-photo-regle> = copie exacte de l'app ; `EXT_CAPACITES.empreintes`
//       = 5.358.0 et `tickEmpreintes` existe ; version 5.358.0 partout.
//  `--recopie` : réécrit le bloc de l'extension depuis l'app.
//  `--src chemin` : un autre arbre (preuve sur le code d'avant, §6.1).
//  `--mutation=<nom>|toutes` : réaffaiblit une règle ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const BLOC_RE = /\/\/ <empreinte-photo-regle>[^\n]*\n([\s\S]*?)\/\/ <\/empreinte-photo-regle>/;
const sansExport = (t) => t.replace(/^export /gm, '');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const REGLE = path.join(RACINE, 'src', 'photoEmpreinte.js');

if (process.argv.includes('--recopie')) {
  const m = BLOC_RE.exec(fs.readFileSync(REGLE, 'utf8')); if (!m) { console.log('❌ bloc <empreinte-photo-regle> introuvable dans src/photoEmpreinte.js'); process.exit(1); }
  const bg = fs.readFileSync(BG, 'utf8');
  if (!BLOC_RE.test(bg)) { console.log('❌ marques <empreinte-photo-regle> introuvables dans background.js'); process.exit(1); }
  const bloc = '// <empreinte-photo-regle> — COPIE de src/photoEmpreinte.js (scripts/audit-photos-comptes.cjs --recopie). Ne pas modifier ici.\n' + sansExport(m[1]) + '// </empreinte-photo-regle>';
  fs.writeFileSync(BG, bg.replace(BLOC_RE, () => bloc));
  console.log('✅ bloc recopié dans background.js');
  process.exit(0);
}

const MUTATIONS = {
  budget: ['vinted-sync-extension/background.js', "const refus = await gardeLecture(uid, acc, 'photos');   // la classe la plus basse", 'const refus = null;'],
  cookie: ['vinted-sync-extension/background.js', "const res = await fetch(cible.url, { credentials: 'omit', cache: 'no-store' });", "const res = await fetch(cible.url, { credentials: 'include', cache: 'no-store' });"],
  lecture: ['vinted-sync-extension/background.js', "if (r === null) { restent.push(...liste); noterDiag('empreintes_lecture_ratee'); continue; }", "if (r === null) { }"],
  pause: ['vinted-sync-extension/background.js', "return { ok: false, status: 0, http: res.status || 0 };", "return { ok: false, status: res.status || 0, http: res.status || 0 };"],
  ecart: ['vinted-sync-extension/background.js', 'if (depuis >= 0 && depuis < EMPREINTES_ECART_MS) return 0;', ''],
  memeCompte: ['src/photoEmpreinte.js', "if (x.cc === y.cc) continue;                     // même compte : pas d'alerte", '', "if (comptesVinted.size < 2) continue;", ''],
  pasSu: ['src/photoEmpreinte.js', "if (comptesLus[cc] === false) { comptesPasVerifies.add(cc); nPasVerifiees += photos.length || 1; continue; }", ''],
  cible: ['src/photoEmpreinte.js', "if (cc === compteCible || cc === compteSource || ex.has(`${cc}|${a.id}`)) continue;", 'if (ex.has(`${cc}|${a.id}`)) continue;'],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : MUT.split(',');
  let rouges = 0;
  for (const nom of noms) {
    const [f, avant, apres, avant2, apres2] = MUTATIONS[nom] || [];
    if (!f) { console.log(`❓ mutation inconnue : ${nom}`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-photos-'));
    for (const d of ['src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true });
    const cible = path.join(tmp, f); const t = fs.readFileSync(cible, 'utf8');
    if (!t.includes(avant)) { console.log(`❓ ${nom} : texte introuvable`); continue; }
    fs.writeFileSync(cible, avant2 ? t.replace(avant, apres).replace(avant2, apres2) : t.replace(avant, apres));
    if (f.startsWith('src/')) spawnSync(process.execPath, [path.join(tmp, 'scripts', 'audit-photos-comptes.cjs'), '--recopie', '--src', tmp]);
    const r = spawnSync(process.execPath, [path.join(__dirname, 'audit-photos-comptes.cjs'), '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0; if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' — ' + (r.stdout.split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 110) : ''}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${rouges}/${noms.length} mutations rouges`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };
const { faireFond } = require('./_fond-vm.cjs');

// ── Images inventées : un NOM ⇒ des pixels (motif à blocs, graine = le nom) ──
function pixels(nom) {
  const base = String(nom).replace(/~.*$/, '');
  let s = 0; for (const c of base) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const n = 64, px = new Uint8ClampedArray(n * n * 4);
  const blocs = Array.from({ length: 64 }, () => Math.floor(r() * 255));
  const bruit = /~bruit/.test(nom);
  let t = 7;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = blocs[Math.floor(y / 8) * 8 + Math.floor(x / 8)];
    if (bruit) { t = (t * 1103515245 + 12345) >>> 0; v = Math.max(0, Math.min(255, v + ((t >>> 16) % 7) - 3)); }
    const k = (y * n + x) * 4; px[k] = v; px[k + 1] = v; px[k + 2] = v; px[k + 3] = 255;
  }
  return px;
}
function brancherImages(f) {
  f.ctx.createImageBitmap = async (blob) => ({ nom: await blob.text(), close() {} });
  f.ctx.OffscreenCanvas = function (w, h) { this.width = w; this.height = h; let b = null;
    this.getContext = () => ({ drawImage(bmp) { b = bmp; }, getImageData: () => ({ data: pixels(b.nom) }), set imageSmoothingQuality(_) {} }); };
}
const A = '111', B = '222';
const item = (id, nom, mini = true) => ({ id, title: 'Paire ' + id, is_closed: false, photo: { url: `https://images1.vinted.net/t/${nom}/f800/1.jpeg?s=SIGNE`, ...(mini ? { mini: `https://images1.vinted.net/t/${nom}/150x210/1.jpeg?s=SIGNE` } : {}) } });
const lignes = () => ({
  [`harvest_${A}_listings`]: { capturedAt: new Date().toISOString(), payload: { items: [item(1, 'chaussure-rouge'), item(2, 'chaussure-bleue')] } },
  [`harvest_${B}_listings`]: { capturedAt: new Date().toISOString(), payload: { items: [item(3, 'chaussure-rouge~bruit'), item(4, 'chaussure-verte', false)] } },
  vinted_item_details: {},
});
const comptes = [{ vinted_user_id: A, login: 'compte_a', domain: 'www.vinted.fr', access_token: 'j' }, { vinted_user_id: B, login: 'compte_b', domain: 'www.vinted.fr', access_token: 'j' }];
const cdn = (u) => ({ status: 200, body: decodeURIComponent(/\/t\/([^/]+)\//.exec(u)[1]) });
const nouveau = (o = {}) => { const f = faireFond({ src: BG, lignes: lignes(), comptes, connecte: A, cdn: o.cdn || cdn, lectureKO: o.lectureKO, store: o.store || {}, onglets: o.onglets }); brancherImages(f); return f; };
const libre = (f) => { delete f.store.vrmEmpreintesDerniere; };

(async () => {
  try {
    // ── E1, E2, E4 ──
    const f = nouveau();
    if (typeof f.ctx.tickEmpreintes !== 'function') { dit(false, 'E0 · `tickEmpreintes` existe dans le fond'); throw new Error('absent'); }
    const urls = [];
    const fetch0 = f.ctx.fetch; f.ctx.fetch = async (u, o) => { if (/vinted\.net/.test(String(u))) urls.push({ u: String(u), cred: o && o.credentials }); return fetch0(u, o); };
    await f.ctx.tickEmpreintes();
    dit(urls.length === 1 && urls[0].cred === 'omit', 'E1 · UNE image par tour, téléchargée SANS cookie', JSON.stringify(urls));
    dit(urls.length === 1 && /150x210/.test(urls[0].u), 'E1 · la MINIATURE quand Vinted la donne', urls[0] && urls[0].u);
    await f.ctx.tickEmpreintes();
    dit(urls.length === 1, 'E4 · l’écart entre deux images est tenu (aucune seconde image dans les 45 s)', String(urls.length));
    for (let i = 0; i < 6; i++) { libre(f); await f.ctx.tickEmpreintes(); }
    const lec = ((f.store.vrmLectures || {})[A] || []).length, act = ((f.store.vrmActions || {})[A] || []).length;
    dit(urls.length === 4 && lec === 4 && act === 0, 'E2 · chaque image compte sur le budget de LECTURE du compte connecté, jamais les actions', `images ${urls.length}, lectures ${lec}, actions ${act}`);
    const la = f.lignes[`photo_emprunte_${A}`], lb = f.lignes[`photo_emprunte_${B}`];
    const ea = la && la.payload && la.payload.annonces, eb = lb && lb.payload && lb.payload.annonces;
    dit(!!ea && !!eb && Object.keys(ea).sort().join() === '1,2' && Object.keys(eb).sort().join() === '3,4', 'E1 · rangé dans `photo_emprunte_{uid}` du compte de L’ANNONCE (A : 1, 2 ; B : 3, 4)', JSON.stringify({ a: ea && Object.keys(ea), b: eb && Object.keys(eb) }));
    const tout = JSON.stringify([la, lb]);
    dit(!/SIGNE|"data"|\[\s*\d+\s*,\s*\d+\s*,\s*\d+/.test(tout) && /^[0-9a-f]{96}$/.test(Object.values((ea || {})[1] || {})[0] || ''), 'E1 · l’empreinte SEULE (96 car. hexadécimaux) : ni image, ni pixel, ni signature d’adresse', tout.slice(0, 200));
    const R = await import(path.join(RACINE, 'src', 'photoEmpreinte.js'));
    const h1 = Object.values(ea[1])[0], h3 = Object.values(eb[3])[0], h2 = Object.values(ea[2])[0];
    dit(R.memePhoto(h1, h3) && !R.memePhoto(h1, h2), 'E1 · la même photo (bruit léger) sur A et B est proche ; deux photos différentes, loin', `${R.distanceEmpreintes(h1, h3)} / ${R.distanceEmpreintes(h1, h2)}`);

    // Budget plein ⇒ rien
    const t = Date.now();
    const g = nouveau({ store: { vrmLectures: { [A]: Array.from({ length: 20 }, () => t) } } });
    await g.ctx.tickEmpreintes();
    dit((g.j.cdn || 0) === 0, 'E2 · budget de lecture plein ⇒ aucune image', String(g.j.cdn || 0));
    // E3
    const h = nouveau({ onglets: [] }); await h.ctx.tickEmpreintes();
    dit((h.j.cdn || 0) === 0, 'E3 · aucun onglet Vinted ⇒ rien', String(h.j.cdn || 0));
    const p = nouveau({ store: { vrmPauseVinted: { jusqua: Date.now() + 6e5, niveau: 1, statut: 429, depuis: Date.now() } } }); await p.ctx.tickEmpreintes();
    dit((p.j.cdn || 0) === 0, 'E3 · pause Vinted ⇒ rien', String(p.j.cdn || 0));
    const n = nouveau({ store: { vrmActiviteVinted: Date.now() - 5000 } }); await n.ctx.tickEmpreintes();
    dit((n.j.cdn || 0) === 0, 'E3 · il navigue sur Vinted ⇒ rien', String(n.j.cdn || 0));

    // E5 lecture ratée de la ligne ⇒ rien écrit, file gardée
    const l = nouveau({ lectureKO: (u) => /photo_emprunte_111&|photo_emprunte_111\b.*select=a/.test(u) && !/like\./.test(u) });
    for (let i = 0; i < 4; i++) { libre(l); await l.ctx.tickEmpreintes(); }
    await l.ctx.rangerEmpreintes(true);
    const fileL = l.store.vrmEmpreintesFile || [];
    dit(!l.lignes[`photo_emprunte_${A}`] && fileL.some((e) => e.uid === A), 'E5 · lecture ratée de `photo_emprunte_{uid}` ⇒ RIEN écrit, les empreintes restent en file', JSON.stringify({ ecrit: !!l.lignes[`photo_emprunte_${A}`], file: fileL.length }));

    // E6 403 ⇒ pas de pause globale ; 429 ⇒ frein
    const q = nouveau({ cdn: () => ({ status: 403, body: '' }) }); await q.ctx.tickEmpreintes();
    dit(!q.store.vrmPauseVinted && !q.store.vrmEmpreintesFrein, 'E6 · un 403 du site des images (adresse périmée) ne met PAS tout Vinted en pause', JSON.stringify(q.store.vrmPauseVinted || null));
    const w = nouveau({ cdn: () => ({ status: 429, body: '' }) }); await w.ctx.tickEmpreintes(); libre(w); await w.ctx.tickEmpreintes();
    dit(!w.store.vrmPauseVinted && !!w.store.vrmEmpreintesFrein && (w.j.cdn || 0) === 1, 'E6 · un 429 du site des images ⇒ 24 h sans empreinte (le reste de Vinted continue)', JSON.stringify({ frein: !!w.store.vrmEmpreintesFrein, images: w.j.cdn }));

    // E7 l'annonce disparue sort
    const s7 = nouveau();
    s7.lignes[`photo_emprunte_${A}`] = { payload: { annonces: { 99: { 'https://images1.vinted.net/t/x/1.jpeg': 'a'.repeat(96) } } } };
    for (let i = 0; i < 8; i++) { libre(s7); await s7.ctx.tickEmpreintes(); }
    await s7.ctx.rangerEmpreintes(true);
    const a7 = (s7.lignes[`photo_emprunte_${A}`] || {}).payload;
    dit(a7 && !a7.annonces[99] && a7.annonces[1], 'E7 · une annonce qui n’est plus en ligne sort de la ligne', JSON.stringify(a7 && Object.keys(a7.annonces)));

    // ── R1, R2 : les règles de l'app ──
    const H = (nom) => { const px = pixels(nom); return R.empreinteDepuisPixels(px, 64, 64); };
    const u = (n) => `https://images1.vinted.net/t/${n}/1.jpeg`;
    const ann = [
      { plateforme: 'vinted', compte: A, id: '1', photo: u('p1') }, { plateforme: 'vinted', compte: B, id: '3', photo: u('p3') },
      { plateforme: 'vinted', compte: A, id: '5', photo: u('p5') }, { plateforme: 'vinted', compte: A, id: '6', photo: u('p6') },
      { plateforme: 'vinted', compte: '333', id: '7', photo: u('p7') },
    ];
    const emp = { [`vinted:${A}`]: { 1: { [u('p1')]: H('rouge') }, 5: { [u('p5')]: H('jaune') }, 6: { [u('p6')]: H('jaune~bruit') } }, [`vinted:${B}`]: { 3: { [u('p3')]: H('rouge~bruit') } } };
    const r1 = R.photosEnDouble({ annonces: ann, empreintes: emp, comptesLus: { [`vinted:${A}`]: true, [`vinted:${B}`]: true, 'vinted:333': false } });
    dit(r1.groupes.length === 1 && r1.groupes[0].annonces.map((a) => a.id).sort().join() === '1,3', 'R1 · comptes différents ⇒ UN groupe (1 sur A, 3 sur B)', JSON.stringify(r1.groupes.map((g) => g.annonces.map((a) => a.id))));
    dit(!r1.groupes.some((g) => g.annonces.some((a) => a.id === '5')), 'R1 · la même photo sur le MÊME compte ⇒ pas d’alerte', '');
    dit(r1.nPasVerifiees === 1 && r1.comptesPasVerifies.join() === 'vinted:333', 'R1 · compte pas relu ⇒ « pas vérifiées », nommé', JSON.stringify(r1));
    const r1b = R.photosEnDouble({ annonces: [{ plateforme: 'vinted', compte: A, id: '1', photo: u('p1') }, { plateforme: 'vinted', compte: B, id: '3', photo: u('p3') }], empreintes: {}, comptesLus: {} });
    dit(r1b.groupes.length === 0 && r1b.nPasVerifiees === 2 && r1b.nVerifiees === 0, 'R1 · aucune empreinte ⇒ 2 photos pas vérifiées (jamais « aucun doublon »)', JSON.stringify(r1b));
    const r2 = R.dejaSurAutreCompte({ photos: [{ h: H('rouge~bruit') }], annonces: ann, empreintes: emp, compteCible: `vinted:${B}`, exclure: [`vinted:${B}|3`] });
    dit(r2.annonces.length === 1 && r2.annonces[0].id === '1', 'R2 · avant de publier sur B : la photo est déjà en ligne sur A (annonce 1)', JSON.stringify(r2.annonces.map((a) => a.id)));
    const r2b = R.dejaSurAutreCompte({ photos: [{ h: H('rouge') }], annonces: ann, empreintes: emp, compteCible: `vinted:${A}`, exclure: [] });
    dit(r2b.annonces.length === 1 && r2b.annonces[0].id === '3', 'R2 · le compte cible lui-même ne compte pas (seul B est nommé)', JSON.stringify(r2b.annonces.map((a) => a.cc + '|' + a.id)));
    const r2c = R.dejaSurAutreCompte({ photos: [{ h: null }, { h: H('rouge') }], annonces: ann, empreintes: emp, compteCible: null });
    dit(r2c.nPasVerifiees === 1, 'R2 · une photo sans empreinte est dite « pas vérifiée »', JSON.stringify(r2c.nPasVerifiees));

    // ── R3 §5 ──
    const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    const corps = (nom) => { const i = app.indexOf(`function ${nom}(`); return i < 0 ? '' : app.slice(i, i + 4000); };
    const regle = fs.readFileSync(REGLE, 'utf8');
    dit(!/photoEmpreinte|memePhoto|distanceEmpreintes/.test(corps('entryKeyByPhoto') + corps('jumellesParPhoto')) && !/numero|cleNum|withOwner|save\(/.test(regle.replace(/\/\/.*$/gm, '')), 'R3 · §5 : aucune règle d’identité ne lit l’empreinte ; la règle n’écrit ni N° ni donnée', '');

    // ── C1 ──
    const bg = fs.readFileSync(BG, 'utf8');
    const a = BLOC_RE.exec(regle), b = BLOC_RE.exec(bg);
    dit(!!a && !!b && sansExport(a[1]).trim() === b[1].trim(), 'C1 · le bloc <empreinte-photo-regle> de background.js est la copie exacte de src/photoEmpreinte.js', !a ? 'absent de l’app' : !b ? 'absent de l’extension' : 'différent : lancer --recopie');
    const cap = /EXT_CAPACITES = \{[^}]*\bempreintes: '([\d.]+)'/.exec(app);
    dit(cap && cap[1] === '5.358.0' && /async function tickEmpreintes|function tickEmpreintes\(/.test(bg), 'C1 · `EXT_CAPACITES.empreintes` = 5.358.0, et `tickEmpreintes` existe', cap && cap[1]);
    const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
    const cv = (/const CODE_VERSION = '([\d.]+)'/.exec(bg) || [])[1];
    dit(man.version === '5.358.0' && cv === '5.358.0', 'C1 · manifeste et CODE_VERSION en 5.358.0', `${man.version} / ${cv}`);
  } catch (e) { dit(false, 'exécution', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ photos entre comptes : tout vert');
  process.exit(ko ? 1 : 0);
})();
