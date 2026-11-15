// ════════════════════════════════════════════════════════════════════════════
//  « LA MÊME PHOTO » ENTRE VINTED ET LES AUTRES SITES (15 nov., lot meme-photo, extension 5.382)
//
//  Julien : « quand je poste une paire sur Vinted et que je la poste après sur Leboncoin sans
//  avoir dit que c'était la même, je veux que VRM propose que c'est exactement la même — on ne
//  parle pas du tout de titre, mais vraiment exactement la même photo ».
//  Règle : src/memePhoto.js (pure, exécutée ici) ; empreintes : src/photoEmpreinte.js (seuil
//  MESURÉ par scripts/bancs/photos-comptes-seuil.cjs, recompression WebP comprise) ;
//  extension : `empreintesSitesUnTour` (VRAI background.js dans `_fond-vm.cjs`). Images INVENTÉES
//  (un NOM ⇒ des pixels à blocs, comme audit-photos-comptes) : le dépôt est public.
//   R0  la distance rapide (mots de 32 bits) = `distanceEmpreintes`, sur des milliers de couples ;
//   R1  une annonce Leboncoin SANS lien, à la photo (recompressée : bruit léger) d'une annonce
//       Vinted N°124 ⇒ UNE proposition « N°124 », la bonne annonce Vinted ;
//   R2  50 paires IDENTIQUES (même titre, même taille, même prix) photographiées différemment
//       ⇒ AUCUNE proposition ; le titre ne compte jamais ;
//   R3  la même photo sur DEUX paires (deux N°) ⇒ AMBIGU (les deux montrées), aucune proposition ;
//       sur deux annonces de la MÊME paire (même N°) ⇒ une proposition ;
//   R4  une photo GÉNÉRIQUE (vue sur plus de 6 annonces, ou sur 3 paires) ⇒ ignorée ; la
//       couverture unique de la même annonce propose toujours ;
//   R5  une annonce déjà reliée (lien, référence, SKU) ⇒ rien ; une annonce sans empreinte ⇒
//       « pas vérifiée », jamais « rien à relier » ; lecture ratée ⇒ rien proposé, `lu: false` ;
//   R6  « Ce n'est pas la même » ⇒ ce couple ne revient plus ; un N° porté par deux paires ⇒
//       jamais proposé seul ; une annonce Vinted sans N° ⇒ rien à relier ; l'autre sens (N° ⇒
//       annonces d'ailleurs) ;
//   R7  §5 : la règle n'écrit rien ; Relier pose l'identité EXISTANTE de chaque site
//       (`vrm_lbc_liens` = N°, `vrm_ebay_liens` = { pairId, numero }, `relierVc`) — celle que lisent
//       `numeroLbcIdentite`, `lienEbay`, `numerosVcEffectifs` (le retrait ailleurs) ; les règles
//       d'identité (`entryKeyByPhoto`, `jumellesParPhoto`) ne lisent pas la photo perceptuelle ;
//   E1  extension : une image Leboncoin par tour, SANS cookie, du compte CONNECTÉ dans un onglet
//       leboncoin.fr, rangée dans `photo_empreinte_lbc` (l'empreinte seule) ; Vestiaire pareil ;
//   E2  aucun onglet / onglet d'un AUTRE compte ⇒ rien ;
//   E3  chaque image compte sur le budget de LECTURE de ce compte sur ce site ; à 8 des 20 ⇒ rien ;
//   E4  45 s entre deux images ; Vinted d'abord ;
//   E5  lecture ratée de la ligne ⇒ RIEN écrit, la file reste ;
//   E6  403/429 du site des images ⇒ 24 h sans empreinte pour CE site, Vinted jamais mis en pause ;
//   C1  `EXT_CAPACITES.memephoto` = 5.382.0, `empreintesSitesUnTour` existe, version ≥ 5.382.0.
//  `--src chemin` : un autre arbre (preuve sur le code d'avant, §6.1).
//  `--mutation=<nom>|toutes` : réaffaiblit une règle ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');

const MUTATIONS = {
  seuil: ['src/memePhoto.js', 'if (d == null || d > seuil) continue;', 'if (d == null || d > seuil * 3) continue;'],
  ambigu: ['src/memePhoto.js', "if (paires.length >= 2) { ambigus.push({ id, annonce: c.a, raison: 'deux-paires', paires }); continue; }", ''],
  generique: ['src/memePhoto.js', 'if (annoncesVues.size + 1 > GENERIQUE_ANNONCES || paires.size >= GENERIQUE_PAIRES) { nGeneriques++; continue; }', ''],
  relie: ['src/memePhoto.js', '    if (a.relie) continue;\n', ''],
  refus: ['src/memePhoto.js', 'if (e.numero && refuses[cleRefusMemePhoto(c.a.plateforme, c.a.id, e.numero, cle)]) parPaire.delete(kp);', ''],
  douteux: ['src/memePhoto.js', "if (douteux.has(seule.numero)) { ambigus.push({ id, annonce: c.a, raison: 'numero-double', paires }); continue; }", ''],
  passu: ['src/memePhoto.js', '  if (!E) return vide;\n', '  const E0 = E || {};\n'],
  budget: ['vinted-sync-extension/background.js', 'const lu = await compterLecture(cleImpSite(pf, cible.compte), EMPREINTES_SITES_MAX_HEURE);', 'const lu = { ok: true };'],
  onglet: ['vinted-sync-extension/background.js', '    if (!(await ouvert(p.site, p.compte))) continue;\n', ''],
  cookie: ['vinted-sync-extension/background.js', "const res = await fetch(cible.url, { credentials: 'omit', cache: 'no-store' });\n    const type = String((res.headers && res.headers.get && res.headers.get('content-type')) || '');\n    const taille = Number((res.headers && res.headers.get && res.headers.get('content-length')) || 0);\n    if (!res.ok || !/^image\\//i.test(type) || taille > EMPREINTES_SITES_MAX_OCTETS)", "const res = await fetch(cible.url, { credentials: 'include', cache: 'no-store' });\n    const type = String((res.headers && res.headers.get && res.headers.get('content-type')) || '');\n    const taille = Number((res.headers && res.headers.get && res.headers.get('content-length')) || 0);\n    if (!res.ok || !/^image\\//i.test(type) || taille > EMPREINTES_SITES_MAX_OCTETS)"],
  lecture: ['vinted-sync-extension/background.js', "if (r === null) { restent.push(...liste); noterDiag('empreintes_sites_lecture_ratee'); continue; }", 'if (r === null) { }'],
  ecart: ['vinted-sync-extension/background.js', '  if (depuis >= 0 && depuis < EMPREINTES_ECART_MS) return 0;\n  const plan = await planEmpreintesSites();', '  const plan = await planEmpreintesSites();'],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : MUT.split(',');
  let rouges = 0;
  for (const nom of noms) {
    const [f, avant, apres] = MUTATIONS[nom] || [];
    if (!f) { console.log(`❓ mutation inconnue : ${nom}`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-meme-photo-'));
    for (const d of ['src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true });
    const cible = path.join(tmp, f); const t = fs.readFileSync(cible, 'utf8');
    if (!t.includes(avant)) { console.log(`❓ ${nom} : texte introuvable`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(cible, t.replace(avant, apres));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'audit-meme-photo.cjs'), '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0; if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' — ' + (r.stdout.split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 120) : ''}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${rouges}/${noms.length} mutations rouges`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 300)}`); };

// ── Images inventées : un NOM ⇒ des pixels (motif à blocs, graine = le nom ; « ~bruit » = recompressée) ──
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

(async () => {
  try {
    const R = await import(path.join(RACINE, 'src', 'photoEmpreinte.js'));
    const M = await import(path.join(RACINE, 'src', 'memePhoto.js'));
    const H = (nom) => R.empreinteDepuisPixels(pixels(nom), 64, 64);
    const cle = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
    const uV = (n) => `https://images1.vinted.net/t/${n}/f800/1.jpeg`;
    const uL = (n) => `https://img.leboncoin.fr/api/v1/lbcpb1/images/${n}.jpg`;

    // ── R0 ──
    let ecarts = 0, n0 = 0;
    const hs = Array.from({ length: 80 }, (_, i) => H('r0-' + i + (i % 3 ? '' : '~bruit')));
    for (let i = 0; i < 80; i++) hs.push(Array.from({ length: 96 }, (_, j) => '0123456789abcdef'[(i * 7 + j * 13 + ((i * j) % 11)) % 16]).join(''));
    for (let i = 0; i < hs.length; i++) for (let j = 0; j < hs.length; j++) { n0++; if (M.distanceMots(M.motsEmpreinte(hs[i]), M.motsEmpreinte(hs[j])) !== R.distanceEmpreintes(hs[i], hs[j])) ecarts++; }
    dit(ecarts === 0 && n0 > 20000, `R0 · la distance rapide = la règle sur ${n0} couples`, `${ecarts} écarts`);

    // Un monde : Vinted (deux comptes), Leboncoin, eBay, Vestiaire.
    const base = (o = {}) => {
      const vinted = [], ev = { 111: {}, 222: {} };
      const v = (id, compte, numero, photo, titre = 'Nike Air Max 90 blanche 42') => { vinted.push({ id: String(id), compte: String(compte), numero, titre, photo: uV(photo), lien: 'https://www.vinted.fr/items/' + id }); ev[compte][id] = { [uV(photo)]: H(photo) }; };
      v(1001, 111, '124', 'paire-124');
      v(1002, 111, '125', 'paire-125');
      v(1003, 222, '7', 'paire-7');
      return { vinted, ev, v, autres: [], es: { Leboncoin: {}, eBay: {}, Vestiaire: {} }, ...o };
    };
    const autre = (m, plateforme, id, photos, o = {}) => { m.autres.push({ plateforme, id: String(id), compte: 'c1', titre: 'Nike Air Max 90 blanche 42', photo: photos[0] ? uL(photos[0]) : null, relie: false, numero: '', ...o }); if (photos.length) m.es[plateforme][id] = Object.fromEntries(photos.map((p) => [uL(p), H(p)])); };
    const calc = (m, o = {}) => M.propositionsMemePhoto({ vinted: m.vinted, autres: m.autres, empreintes: o.null ? null : { vinted: m.ev, ...m.es }, refus: o.refus || {}, numerosDouteux: o.douteux || null, cle });

    // ── R1 ──
    { const m = base(); autre(m, 'Leboncoin', 5001, ['paire-124~bruit']); const r = calc(m);
      dit(r.lu && r.propositions.length === 1 && r.propositions[0].numero === '124' && r.propositions[0].vinted[0].id === '1001' && !r.ambigus.length,
        'R1 · Leboncoin sans lien, même photo (recompressée) que N°124 ⇒ UNE proposition, la bonne annonce Vinted', JSON.stringify(r.propositions.map((p) => [p.numero, p.distance]))); }
    { const m = base(); autre(m, 'eBay', '2009', ['paire-7~bruit']); autre(m, 'Vestiaire', 'vc-1', ['paire-125']); const r = calc(m);
      dit(r.propositions.length === 2 && r.propositions.some((p) => p.annonce.plateforme === 'eBay' && p.numero === '7') && r.propositions.some((p) => p.annonce.plateforme === 'Vestiaire' && p.numero === '125'),
        'R1 · eBay et Vestiaire aussi (deux comptes Vinted)', JSON.stringify(r.propositions.map((p) => [p.annonce.plateforme, p.numero]))); }

    // ── R2 : 50 paires identiques ──
    { const m = base();
      for (let i = 0; i < 50; i++) m.v(3000 + i, i % 2 ? 111 : 222, String(200 + i), `jordan1-chicago-42-vue-${i}`, 'Jordan 1 Chicago 42');
      for (let i = 0; i < 50; i++) autre(m, ['Leboncoin', 'eBay', 'Vestiaire'][i % 3], 6000 + i, [`jordan1-chicago-42-vue-${50 + i}`, `jordan1-chicago-42-vue-${100 + i}`], { titre: 'Jordan 1 Chicago 42' });
      const r = calc(m);
      dit(r.propositions.length === 0 && r.ambigus.length === 0 && r.nVerifiees === 50, 'R2 · 50 paires identiques (même titre, taille, prix), photographiées différemment ⇒ AUCUNE proposition', JSON.stringify({ p: r.propositions.length, a: r.ambigus.length, v: r.nVerifiees }));
      // Témoin : UNE seule a vraiment réutilisé la photo de N°217 ⇒ elle seule, et la bonne.
      autre(m, 'Leboncoin', 6999, ['jordan1-chicago-42-vue-17~bruit'], { titre: 'Jordan 1 Chicago 42' });
      const r2 = calc(m);
      dit(r2.propositions.length === 1 && r2.propositions[0].numero === '217' && r2.propositions[0].annonce.id === '6999', 'R2 · parmi les 50, la seule à la même photo ⇒ N°217, aucune autre', JSON.stringify(r2.propositions.map((p) => [p.annonce.id, p.numero]))); }

    // ── R3 ──
    { const m = base(); m.v(1010, 222, '300', 'boite-partagee'); m.v(1011, 111, '301', 'boite-partagee~bruit'); autre(m, 'Leboncoin', 5002, ['boite-partagee']); const r = calc(m);
      dit(!r.propositions.length && r.ambigus.length === 1 && r.ambigus[0].raison === 'deux-paires' && r.ambigus[0].paires.map((p) => p.numero).sort().join() === '300,301',
        'R3 · même photo sur DEUX paires ⇒ ambigu, les deux montrées, aucune proposition', JSON.stringify({ p: r.propositions.map((x) => x.numero), a: r.ambigus.map((x) => x.paires.map((p) => p.numero)) })); }
    { const m = base(); m.v(1012, 222, '124', 'paire-124~bruit'); autre(m, 'Leboncoin', 5003, ['paire-124']); const r = calc(m);
      dit(r.propositions.length === 1 && r.propositions[0].numero === '124' && r.propositions[0].vinted.length === 2, 'R3 · même photo sur deux annonces de la MÊME paire (N°124, deux comptes) ⇒ une proposition', JSON.stringify(r.propositions.map((p) => [p.numero, p.vinted.length]))); }

    // ── R4 ──
    { const m = base();
      for (let i = 0; i < 4; i++) m.v(1100 + i, 111, String(400 + i), 'logo-boutique' + (i % 2 ? '~bruit' : ''));
      for (let i = 0; i < 4; i++) autre(m, 'eBay', 7100 + i, ['logo-boutique'], { relie: true, numero: String(400 + i) });
      autre(m, 'Leboncoin', 5004, ['logo-boutique']);
      const r = calc(m);
      dit(!r.propositions.length && !r.ambigus.length && r.nGeneriques >= 1, 'R4 · photo vue sur plus de 6 annonces (logo) ⇒ ignorée', JSON.stringify({ p: r.propositions.length, a: r.ambigus.length, g: r.nGeneriques }));
      autre(m, 'Leboncoin', 5005, ['paire-125~bruit', 'logo-boutique']);
      const r2 = calc(m);
      dit(r2.propositions.length === 1 && r2.propositions[0].annonce.id === '5005' && r2.propositions[0].numero === '125', 'R4 · couverture unique + photo générique ⇒ la couverture propose N°125', JSON.stringify(r2.propositions.map((p) => [p.annonce.id, p.numero]))); }
    { const m = base(); for (let i = 0; i < 3; i++) m.v(1200 + i, 111, String(500 + i), 'fond-studio'); autre(m, 'Leboncoin', 5006, ['fond-studio~bruit']); const r = calc(m);
      dit(!r.propositions.length && !r.ambigus.length && r.nGeneriques >= 1, 'R4 · photo vue sur 3 paires différentes ⇒ générique, ignorée', JSON.stringify({ p: r.propositions.length, a: r.ambigus.length })); }

    // ── R5 ──
    { const m = base(); autre(m, 'Leboncoin', 5007, ['paire-124'], { relie: true, numero: '124' }); autre(m, 'Leboncoin', 5008, []); const r = calc(m);
      dit(!r.propositions.length && r.nSansEmpreinte === 1 && r.nVerifiees === 0, 'R5 · déjà reliée ⇒ rien ; sans empreinte ⇒ « pas vérifiée »', JSON.stringify({ p: r.propositions.length, s: r.nSansEmpreinte, v: r.nVerifiees }));
      const r2 = calc(m, { null: true });
      dit(r2.lu === false && !r2.propositions.length && !r2.nVerifiees, 'R5 · lecture ratée des empreintes ⇒ rien proposé, `lu: false`', JSON.stringify({ lu: r2.lu, p: r2.propositions.length })); }

    // ── R6 ──
    { const m = base(); autre(m, 'Leboncoin', 5009, ['paire-124~bruit']);
      const r = calc(m, { refus: { [M.cleRefusMemePhoto('Leboncoin', '5009', '124', cle)]: '2026-11-15' } });
      dit(!r.propositions.length && !r.ambigus.length, '« Ce n’est pas la même » ⇒ la proposition ne revient plus (R6)', JSON.stringify(r.propositions.map((p) => p.numero)));
      const r2 = calc(m, { douteux: new Set(['124']) });
      dit(!r2.propositions.length && r2.ambigus.length === 1 && r2.ambigus[0].raison === 'numero-double', 'R6 · N° porté par deux paires ⇒ jamais proposé seul (à vérifier)', JSON.stringify(r2.ambigus.map((x) => x.raison)));
      const r3 = calc(m);
      dit(r3.parNumero.get('124') && r3.parNumero.get('124')[0].annonce.id === '5009', 'R6 · l’autre sens : N°124 ⇒ l’annonce Leboncoin à relier', ''); }
    { const m = base(); m.v(1300, 111, '', 'sans-numero'); autre(m, 'Leboncoin', 5010, ['sans-numero~bruit']); const r = calc(m);
      dit(!r.propositions.length && r.nARelier === 0, 'R6 · annonce Vinted SANS N° ⇒ rien à relier', JSON.stringify({ p: r.propositions.length, n: r.nARelier })); }

    // ── R7 §5 ──
    const regle = fs.readFileSync(path.join(RACINE, 'src', 'memePhoto.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(!/\bsave\(|withOwner|fetch\(|localStorage|chrome\.|\btitre\b[^:]*===|normTitle|marque|taille/.test(regle.replace(/titre: /g, '')), 'R7 · la règle n’écrit rien et ne lit ni titre, ni marque, ni taille', '');
    const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    const corps = (debut, n = 5000) => { const i = app.indexOf(debut); return i < 0 ? '' : app.slice(i, i + n); };
    const rel = corps('async function relierParPhoto(', 3200);
    dit(/k: 'vrm_lbc_liens', type: 'cle', id, apres: n,/.test(rel) && /pairId: String\(vintedId\), numero: n/.test(rel) && /k: LIENS_EBAY, type: 'cle'/.test(rel) && /await relierVc\(\{ productId: id, item: String\(vintedId\), numVinted: n/.test(rel),
      'R7 · Relier pose l’identité EXISTANTE de chaque site (vrm_lbc_liens = N°, vrm_ebay_liens = { pairId, numero }, relierVc)', rel.slice(0, 200));
    dit(/const lien = liens \? liens\[iid\] : null;\s*\n\s*if \(lien != null && String\(lien\)\.trim\(\)\) return cleNum\(lien\);/.test(corps('const numeroLbcIdentite = ', 600)) && /return x && x\.pairId \? x : null/.test(corps('const lienEbay = ', 300)) && /numerosVcAvecLiens\(vcCarte\('vrm_vc_numeros'\), vcCarte\('vrm_vc_liens'\)\)/.test(app),
      'R7 · ce sont les liens que lisent numeroLbcIdentite, lienEbay et numerosVcEffectifs (le retrait ailleurs)', '');
    const ident = corps('function entryKeyByPhoto(', 4000) + corps('function jumellesParPhoto(', 4000);
    dit(ident && !/memePhoto|propositionsMemePhoto|distanceEmpreintes|photo_empreinte/.test(ident), 'R7 · entryKeyByPhoto / jumellesParPhoto ne lisent pas la photo perceptuelle (seul SON toucher relie)', '');

    // ── E : l'extension ──
    const { faireFond } = require('./_fond-vm.cjs');
    const brancherImages = (f) => {
      f.ctx.createImageBitmap = async (blob) => ({ nom: await blob.text(), close() {} });
      f.ctx.OffscreenCanvas = function (w, h) { this.width = w; this.height = h; let b = null; this.getContext = () => ({ drawImage(bmp) { b = bmp; }, getImageData: () => ({ data: pixels(b.nom) }), set imageSmoothingQuality(_) {} }); };
    };
    const CL = '987', CV = 'vcmoi';
    const lignes = () => ({
      lbc_listings: { items: {
        11: { id: 11, account: 'lbc-account:' + CL, subject: 'Paire A', status: 'active', images: [uL('lbc-a'), uL('lbc-a2')] },
        12: { id: 12, account: 'lbc-account:' + CL, subject: 'Paire B', status: 'active', images: [uL('lbc-b')] },
        13: { id: 13, account: 'lbc-account:autre', subject: 'Paire C', status: 'active', images: [uL('lbc-c')] },
        14: { id: 14, account: 'lbc-account:' + CL, subject: 'Supprimée', status: 'deleted', images: [uL('lbc-d')] } } },
      vc_listings: { items: { 'vc-9': { compte: CV, titre: 'Paire V', statut: 'en vente', photo: 'https://images.vestiairecollective.com/images/resized/w=256/produit/vc-v.jpg' } } },
    });
    const nouveau = (o = {}) => {
      const store = Object.assign({ vrmLbcTransport: o.lbcTab === false ? {} : { 21: { source: 'prive', compte: 'lbc-account:' + (o.lbcCompte || CL), at: Date.now() } }, vrmVcOnglets: o.vcTab ? { 22: { compte: CV } } : {} }, o.store || {});
      const f = faireFond({ src: BG, lignes: lignes(), comptes: [{ vinted_user_id: '111', login: 'a', domain: 'www.vinted.fr', access_token: 'j' }], connecte: '111', store, lectureKO: o.lectureKO,
        onglets: [{ id: 21, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' }, { id: 22, url: 'https://fr.vestiairecollective.com/', status: 'complete' }] });
      brancherImages(f);
      const fetch0 = f.ctx.fetch; f.images = [];
      f.ctx.fetch = async (u, opts) => {
        const s = String(u);
        const m = /^https:\/\/(img\.leboncoin\.fr|images\.vestiairecollective\.com)\/.*\/([^/]+)\.jpg/.exec(s);
        if (m) { f.images.push({ u: s, cred: opts && opts.credentials }); const st = o.statut || 200; return { ok: st < 300, status: st, headers: { get: (k) => (/content-type/i.test(k) ? 'image/jpeg' : null) }, blob: async () => new Blob([m[2]]) }; }
        return fetch0(u, opts);
      };
      return f;
    };
    const libre = (f) => { delete f.store.vrmEmpreintesSitesDerniere; delete f.store.vrmEmpreintesDerniere; };
    const fn = (f, n) => typeof f.ctx[n] === 'function';
    const f = nouveau();
    if (!fn(f, 'empreintesSitesUnTour') || !fn(f, 'rangerEmpreintesSites')) { dit(false, 'E0 · `empreintesSitesUnTour` existe dans le fond'); throw new Error('absent'); }
    await f.ctx.tickEmpreintes();
    dit(f.images.length === 1 && f.images[0].cred === 'omit' && /lbc-a\.jpg$/.test(f.images[0].u), 'E1 · UNE image Leboncoin par tour, SANS cookie, la couverture d’abord', JSON.stringify(f.images));
    await f.ctx.tickEmpreintes();
    dit(f.images.length === 1, 'E4 · 45 s entre deux images', String(f.images.length));
    for (let i = 0; i < 6; i++) { libre(f); await f.ctx.tickEmpreintes(); }
    const vus = f.images.map((x) => /\/([^/]+)\.jpg$/.exec(x.u)[1]);
    dit(!vus.includes('lbc-c') && !vus.includes('lbc-d') && vus.includes('lbc-b') && vus.includes('lbc-a2'), 'E2 · seulement le compte CONNECTÉ dans l’onglet, jamais une annonce supprimée', vus.join(','));
    await f.ctx.rangerEmpreintesSites(true);
    const ligne = f.lignes.photo_empreinte_lbc;
    const ann = ligne && ligne.payload && ligne.payload.annonces;
    dit(ann && Object.keys(ann).sort().join() === '11,12' && Object.values(ann).every((x) => Object.values(x).every((h) => /^[0-9a-f]{96}$/.test(h))) && !/lbc-a\.jpg"|data:|"pixels"/.test(JSON.stringify(ligne).replace(/https:\/\/img\.leboncoin\.fr\/[^"]+/g, 'K')),
      'E1 · rangé dans `photo_empreinte_lbc` : l’empreinte seule (96 hex), par annonce', JSON.stringify(ligne).slice(0, 200));
    const h11 = ann && Object.values(ann[11] || {})[0];
    dit(h11 && h11 === H('lbc-a'), 'E1 · l’empreinte de l’extension = celle de la règle (même calcul que Vinted)', '');
    const lec = ((f.store.vrmLectures || {})['leboncoin:' + CL] || []).length;
    dit(lec === f.images.length && !((f.store.vrmActions || {})['leboncoin:' + CL]), 'E3 · chaque image compte sur le budget de LECTURE de ce compte Leboncoin', `${lec} / ${f.images.length}`);
    { const t = Date.now(); const g = nouveau({ store: { vrmLectures: { ['leboncoin:' + CL]: Array.from({ length: 8 }, () => t) } } }); await g.ctx.tickEmpreintes();
      dit(g.images.length === 0, 'E3 · 8 lectures dans l’heure sur ce compte ⇒ aucune image (le reste des 20 est gardé)', String(g.images.length)); }
    { const g = nouveau({ lbcTab: false }); await g.ctx.tickEmpreintes(); dit(g.images.length === 0, 'E2 · aucun onglet leboncoin.fr ⇒ rien', String(g.images.length)); }
    { const g = nouveau({ lbcCompte: 'autre' }); await g.ctx.tickEmpreintes();
      dit(g.images.length === 1 && /lbc-c/.test(g.images[0].u), 'E2 · onglet d’un AUTRE compte ⇒ seulement les annonces de CET autre compte', JSON.stringify(g.images)); }
    { const g = nouveau({ lectureKO: (u) => /id=eq\.photo_empreinte_lbc/.test(u) });
      for (let i = 0; i < 3; i++) { libre(g); await g.ctx.tickEmpreintes(); }
      await g.ctx.rangerEmpreintesSites(true);
      dit(!g.lignes.photo_empreinte_lbc && (g.store.vrmEmpreintesSitesFile || []).length >= 1, 'E5 · lecture ratée de la ligne ⇒ RIEN écrit, la file reste', JSON.stringify({ ecrit: !!g.lignes.photo_empreinte_lbc, file: (g.store.vrmEmpreintesSitesFile || []).length })); }
    { const g = nouveau({ statut: 429 }); await g.ctx.tickEmpreintes(); libre(g); await g.ctx.tickEmpreintes();
      dit(g.images.length === 1 && g.store.vrmEmpreintesSitesFrein && g.store.vrmEmpreintesSitesFrein.lbc && !g.store.vrmPauseVinted, 'E6 · 429 du site des images ⇒ 24 h sans empreinte Leboncoin, Vinted jamais en pause', JSON.stringify({ n: g.images.length, frein: g.store.vrmEmpreintesSitesFrein })); }
    { const g = nouveau({ lbcTab: false, vcTab: true }); await g.ctx.tickEmpreintes(); libre(g); await g.ctx.tickEmpreintes(); await g.ctx.rangerEmpreintesSites(true);
      const a = g.lignes.photo_empreinte_vc && g.lignes.photo_empreinte_vc.payload.annonces;
      dit(g.images.length === 1 && /vestiairecollective/.test(g.images[0].u) && a && a['vc-9'], 'E1 · Vestiaire : la photo de l’annonce du compte de l’onglet ⇒ `photo_empreinte_vc`', JSON.stringify({ n: g.images.length, a: a && Object.keys(a) })); }
    { // Vinted d'abord : une image Vinted à prendre ⇒ aucune photo d'un autre site à ce tour.
      const g = nouveau(); g.lignes.harvest_111_listings = { capturedAt: new Date().toISOString(), payload: { items: [{ id: 1, title: 'x', photo: { url: 'https://images1.vinted.net/t/v1/f800/1.jpeg?s=S' } }] } };
      g.ctx.fetch = ((f0) => async (u, o) => (/vinted\.net/.test(String(u)) ? { ok: true, status: 200, headers: { get: (k) => (/content-type/i.test(k) ? 'image/jpeg' : null) }, blob: async () => new Blob(['v1']) } : f0(u, o)))(g.ctx.fetch);
      g.onglets = null; await g.ctx.tickEmpreintes();
      dit(g.images.length === 0, 'E4 · Vinted d’abord : une image Vinted prise ⇒ aucune autre à ce tour', String(g.images.length)); }

    // ── C1 ──
    const cap = /EXT_CAPACITES = \{[^}]*\bmemephoto: '([\d.]+)'/.exec(app);
    const coh = fs.readFileSync(path.join(RACINE, 'scripts', 'audit-coherence.cjs'), 'utf8');
    const bg = fs.readFileSync(BG, 'utf8');
    const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
    const cv = (/const CODE_VERSION = '([\d.]+)'/.exec(bg) || [])[1];
    const vn = (v) => String(v || '').split('.').map(Number).reduce((t, x) => t * 1000 + (x || 0), 0);
    dit(cap && cap[1] === '5.382.0' && /memephoto:'empreintesSitesUnTour'/.test(coh) && /async function empreintesSitesUnTour\(/.test(bg), 'C1 · `EXT_CAPACITES.memephoto` = 5.382.0, connue de audit-coherence, la fonction existe', cap && cap[1]);
    dit(man.version === cv && vn(cv) >= vn('5.382.0'), 'C1 · manifeste et CODE_VERSION égaux, au moins 5.382.0', `${man.version} / ${cv}`);
  } catch (e) { dit(false, 'exécution', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ même photo : tout vert');
  process.exit(ko ? 1 : 0);
})();
