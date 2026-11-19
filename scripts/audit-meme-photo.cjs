// ════════════════════════════════════════════════════════════════════════════
//  « LA MÊME PHOTO » ENTRE VINTED ET LES AUTRES SITES (15 nov., lot meme-photo, extension 5.384)
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
//   C1  `EXT_CAPACITES.memephoto` = 5.384.0, `empreintesSitesUnTour` existe, version ≥ 5.384.0.
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
// (15 nov., lot meme-photo-sure) La deuxième mesure : le bloc <photo-fine-regle> de src/photoFine.js,
// recopié tel quel dans background.js (`--recopie`), comparé ici (F0).
const BLOC_FIN = /\/\/ <photo-fine-regle>[^\n]*\n([\s\S]*?)\/\/ <\/photo-fine-regle>/;
const sansExport = (t) => t.replace(/^export /gm, '');
if (process.argv.includes('--recopie')) {
  const m = BLOC_FIN.exec(fs.readFileSync(path.join(RACINE, 'src', 'photoFine.js'), 'utf8')); if (!m) { console.log('❌ bloc <photo-fine-regle> introuvable dans src/photoFine.js'); process.exit(1); }
  const bg = fs.readFileSync(BG, 'utf8');
  if (!BLOC_FIN.test(bg)) { console.log('❌ marques <photo-fine-regle> introuvables dans background.js'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(BLOC_FIN, () => '// <photo-fine-regle> — COPIE de src/photoFine.js (scripts/audit-meme-photo.cjs --recopie). Ne pas modifier ici.\n' + sansExport(m[1]) + '// </photo-fine-regle>'));
  console.log('✅ bloc <photo-fine-regle> recopié dans background.js');
  process.exit(0);
}

const MUTATIONS = {
  seuil: ['src/memePhoto.js', 'if (d == null || d > seuil) continue;', 'if (d == null || d > seuil * 3) continue;'],
  ambigu: ['src/memePhoto.js', "if (paires.length >= 2) { ambigus.push({ id, annonce: c.a, raison: 'deux-paires', paires }); continue; }", ''],
  generique: ['src/memePhoto.js', 'if (annoncesVues.size + 1 > GENERIQUE_ANNONCES || paires.size >= GENERIQUE_PAIRES) { nGeneriques++; continue; }', ''],
  relie: ['src/memePhoto.js', '    if (a.relie) continue;\n', ''],
  refus: ['src/memePhoto.js', 'if (e.numero && refuses[cleRefusMemePhoto(c.a.plateforme, c.a.id, e.numero, cle)]) parPaire.delete(kp);', 'if (false) parPaire.delete(kp);'],
  douteux: ['src/memePhoto.js', "if (douteux.has(seule.numero)) { ambigus.push({ id, annonce: c.a, raison: 'numero-double', paires }); continue; }", ''],
  passu: ['src/memePhoto.js', '  const E = objet(empreintes);\n  if (!E) return vide;\n', '  const E = objet(empreintes) || {};\n'],
  budget: ['vinted-sync-extension/background.js', 'const lu = await compterLecture(cleImpSite(pf, cible.compte), EMPREINTES_SITES_MAX_HEURE);', 'const lu = { ok: true };'],
  onglet: ['vinted-sync-extension/background.js', '    if (!(await ouvert(p.site, p.compte))) continue;\n', ''],
  cookie: ['vinted-sync-extension/background.js', "const res = await fetch(cible.url, { credentials: 'omit', cache: 'no-store' });\n    const type = String((res.headers && res.headers.get && res.headers.get('content-type')) || '');\n    const taille = Number((res.headers && res.headers.get && res.headers.get('content-length')) || 0);\n    if (!res.ok || !/^image\\//i.test(type) || taille > EMPREINTES_SITES_MAX_OCTETS)", "const res = await fetch(cible.url, { credentials: 'include', cache: 'no-store' });\n    const type = String((res.headers && res.headers.get && res.headers.get('content-type')) || '');\n    const taille = Number((res.headers && res.headers.get && res.headers.get('content-length')) || 0);\n    if (!res.ok || !/^image\\//i.test(type) || taille > EMPREINTES_SITES_MAX_OCTETS)"],
  lecture: ['vinted-sync-extension/background.js', "const r = await sbGet(`app_data?id=eq.${ligne}&select=a:data->payload->annonces`);\n    if (r === null) { restent.push(...liste); noterDiag('empreintes_sites_lecture_ratee'); continue; }", "const r = (await sbGet(`app_data?id=eq.${ligne}&select=a:data->payload->annonces`)) || [];"],
  verrou: ['vinted-sync-extension/background.js', "      try { return await empreintesSitesUnTour(); } catch (_) { return 0; }\n    } finally { try { await chrome.storage.local.remove(EMPREINTES_TOUR); } catch (_) {} }", "      try { return await empreintesSitesUnTour(); } catch (_) { return 0; } finally { try { await chrome.storage.local.remove(EMPREINTES_TOUR); } catch (_) {} }\n    } finally { }"],
  ecart: ['vinted-sync-extension/background.js', '  if (depuis >= 0 && depuis < EMPREINTES_ECART_MS) return 0;\n  const plan = await planEmpreintesSites();', '  const plan = await planEmpreintesSites();'],
  // (15 nov., lot meme-photo-sure) La deuxième mesure. Une mutation de src/photoFine.js est portée AUSSI
  // dans la copie de l'extension (sinon F0 seul rougirait) : c'est la RÈGLE qu'on affaiblit.
  sureSeule: ['src/memePhoto.js', "  const v = verdictFin(mesure);\n", "  const v = verdictFin(mesure);\n  if (typeof distance === 'number' && distance <= SEUIL_EMPREINTE_SUR) return 'sur';\n"],
  sureSansEmpreinte: ['src/memePhoto.js', "if (v === 'sur' && typeof distance === 'number' && distance <= SEUIL_EMPREINTE_SUR) return 'sur';", "if (v === 'sur') return 'sur';"],
  sureSansCorrel: [['src/photoFine.js', 'vinted-sync-extension/background.js'], 'if (m.s >= SEUIL_FINE_SUR && m.r >= SEUIL_CORREL_SUR) return', 'if (m.s >= SEUIL_FINE_SUR) return'],
  fineFaible: [['src/photoFine.js', 'vinted-sync-extension/background.js'], 'SEUIL_FINE_SUR = 0.85;', 'SEUIL_FINE_SUR = 0.5;'],
  correlFaible: [['src/photoFine.js', 'vinted-sync-extension/background.js'], 'SEUIL_CORREL_SUR = 0.998;', 'SEUIL_CORREL_SUR = 0.9;'],
  ecartFin: ['src/memePhoto.js', "          if (etatCouple(d, fine) === 'non') { ecartes.add(c.a.id + '|' + q.a.id); continue; }\n", ''],
  ambiguSur: ['src/memePhoto.js', "  const nSurs = propositions.filter((p) => p.etat === 'sur').length;", "  const nSurs = propositions.filter((p) => p.etat === 'sur').length + ambigus.filter((x) => x.paires.some((p) => p.etat === 'sur')).length;"],
  relierSeul: ['src/App.jsx', '    publierMemePhoto(etat);\n', "    publierMemePhoto(etat);\n    for (const p of res.propositions) if (p.etat === 'sur') liaisonVrm().then((L) => L.relier({ annonce: p.annonce, paire: { id: (p.vinted[0] || {}).id, numero: p.numero }, preuve: 'photo-sure' }));\n"],
  fineCookie: ['vinted-sync-extension/background.js', "    const res = await fetch(url, { credentials: 'omit', cache: 'no-store' });", "    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });"],
  fineBudget: ['vinted-sync-extension/background.js', "  const lu = await compterLecture(cleImpSite(pf, cible.compte), EMPREINTES_SITES_MAX_HEURE);\n  if (!lu.ok) { noterDiag('verif_fine_budget'); return 0; }", "  const lu = { ok: true };"],
  fineOnglet: ['vinted-sync-extension/background.js', "    if ((await ongletImpSite(SITE_IMPORT[c.site], c.compte)) == null) continue;   // l'onglet de CE compte sur son site\n", ''],
  fineLecture: ['vinted-sync-extension/background.js', "  if (r === null) { noterDiag('verif_fine_lecture_ratee'); return false; }\n  const couples = Object.assign({}, (r[0] && r[0].c && typeof r[0].c === 'object') ? r[0].c : {});", "  const couples = Object.assign({}, (r && r[0] && r[0].c && typeof r[0].c === 'object') ? r[0].c : {});"],
  finePlafond: ['vinted-sync-extension/background.js', "  if (heure.length >= VERIF_FINE_MAX_HEURE) { noterDiag('verif_fine_plafond'); return 0; }\n", ''],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : MUT.split(',');
  let rouges = 0;
  for (const nom of noms) {
    const [f, avant, apres] = MUTATIONS[nom] || [];
    if (!f) { console.log(`❓ mutation inconnue : ${nom}`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-meme-photo-'));
    for (const d of ['src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true });
    let manque = false;
    for (const ff of Array.isArray(f) ? f : [f]) {
      const cible = path.join(tmp, ff); const t = fs.readFileSync(cible, 'utf8');
      if (!t.includes(avant)) { manque = true; break; }
      fs.writeFileSync(cible, t.replace(avant, apres));
    }
    if (manque) { console.log(`❓ ${nom} : texte introuvable`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
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
// (15 nov., lot meme-photo-sure) `w × h` : la même image à une autre taille (la mesure fine lit
// l'image à 512 px au plus ; l'empreinte à 64 × 64). « ~texture » : une texture fine en plus, tirée
// du NOM COMPLET (deux « prises de vue » : mêmes blocs, détails différents).
function pixels(nom, w = 64, h = w) {
  const base = String(nom).replace(/~.*$/, '');
  let s = 0; for (const c of base) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const px = new Uint8ClampedArray(w * h * 4);
  const blocs = Array.from({ length: 64 }, () => Math.floor(r() * 255));
  const bruit = /~bruit/.test(nom), texture = /~texture/.test(nom);
  let g = 0; for (const c of String(nom)) g = (g * 33 + c.charCodeAt(0)) >>> 0;
  let t = 7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = blocs[Math.floor((y * 8) / h) * 8 + Math.floor((x * 8) / w)];
    if (bruit) { t = (t * 1103515245 + 12345) >>> 0; v = Math.max(0, Math.min(255, v + ((t >>> 16) % 7) - 3)); }
    if (texture) { g = (g * 1103515245 + 12345) >>> 0; if (((x >> 2) + (y >> 2)) % 3 === 0) v = Math.max(0, Math.min(255, v + ((g >>> 16) % 61) - 30)); }
    const k = (y * w + x) * 4; px[k] = v; px[k + 1] = v; px[k + 2] = v; px[k + 3] = 255;
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
    // (19 nov., liaison guidée) Relier vit dans le parcours « Relier mes annonces » : la règle src/liaisonSites.js
    // (`opPorter`, exécutée par audit-liaison-sites C1) pose les MÊMES identités qu'avant.
    const rel = fs.readFileSync(path.join(RACINE, 'src', 'liaisonSites.js'), 'utf8');
    dit(/CLES_LIENS = \{ Leboncoin: 'vrm_lbc_liens', eBay: 'vrm_ebay_liens', Vestiaire: 'vrm_vc_liens' \}/.test(rel) && /k: CLES_LIENS\.Leboncoin, type: 'cle', id, apres: String\(numero\)/.test(rel) && /\{ pairId: vinted, numero: String\(numero\), at, par: preuve \}/.test(rel) && /poserLienVc\(\{ liens: C\.vc, productId: id, item: vinted, numeroVinted: String\(numero\)/.test(rel),
      'R7 · Relier pose l’identité EXISTANTE de chaque site (vrm_lbc_liens = N°, vrm_ebay_liens = { pairId, numero }, poserLienVc)', rel.slice(0, 200));
    dit(/const lien = liens \? liens\[iid\] : null;\s*\n\s*if \(lien != null && String\(lien\)\.trim\(\)\) return cleNum\(lien\);/.test(corps('const numeroLbcIdentite = ', 600)) && /return x && x\.pairId \? x : null/.test(corps('const lienEbay = ', 300)) && /numerosVcAvecLiens\(vcCarte\('vrm_vc_numeros'\), vcCarte\('vrm_vc_liens'\)\)/.test(app),
      'R7 · ce sont les liens que lisent numeroLbcIdentite, lienEbay et numerosVcEffectifs (le retrait ailleurs)', '');
    const aut = corps('async function annoncesAutresMemePhoto(', 2400);
    dit(/comptesLbcSession\(/.test(aut) && /if \(!siens\.has\(idCompteLbcApp\(/.test(aut), 'R7 · Leboncoin : seulement SES annonces (compte connecté chez lui, ou lien posé) — `lbc_listings` garde aussi celles d’autres vendeurs', '');
    const ident = corps('function entryKeyByPhoto(', 4000) + corps('function jumellesParPhoto(', 4000);
    dit(ident && !/memePhoto|propositionsMemePhoto|distanceEmpreintes|photo_empreinte/.test(ident), 'R7 · entryKeyByPhoto / jumellesParPhoto ne lisent pas la photo perceptuelle (seul SON toucher relie)', '');

    // ── E : l'extension ──
    const { faireFond } = require('./_fond-vm.cjs');
    const brancherImages = (f) => {
      f.ctx.createImageBitmap = async (blob) => ({ nom: await blob.text(), width: 300, height: 400, close() {} });
      f.ctx.OffscreenCanvas = function (w, h) { this.width = w; this.height = h; let b = null; this.getContext = () => ({ drawImage(bmp) { b = bmp; }, getImageData: (x0, y0, gw, gh) => ({ data: pixels(b.nom, gw, gh) }), set imageSmoothingQuality(_) {} }); };
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
      dit(g.images.length === 0, 'E4 · Vinted d’abord : une image Vinted prise ⇒ aucune autre à ce tour', String(g.images.length));
      dit(!g.store.vrmEmpreintesTour, 'E4 · après une image Vinted, le verrou du tour est levé (sinon 3 min sans aucune empreinte)', JSON.stringify(g.store.vrmEmpreintesTour || null)); }

    // ══ F : « MÊME PHOTO · SÛR » — la deuxième mesure (15 nov., lot meme-photo-sure, extension 5.388) ══
    const F = await import(path.join(RACINE, 'src', 'photoFine.js'));
    const P = (nom, w = 300, h = 400) => F.preparerFine(pixels(nom, w, h), w, h);
    {
      const srcFin = fs.readFileSync(path.join(RACINE, 'src', 'photoFine.js'), 'utf8');
      const mApp = BLOC_FIN.exec(srcFin), mBg = BLOC_FIN.exec(fs.readFileSync(BG, 'utf8'));
      dit(mApp && mBg && sansExport(mApp[1]) === mBg[1], 'F0 · le bloc <photo-fine-regle> de l’extension = copie exacte de src/photoFine.js (node scripts/audit-meme-photo.cjs --recopie)', mBg ? 'différent' : 'absent');
      // La mesure elle-même, exécutée : la même image (réduite + recompressée : bruit) ⇒ ≥ sûr ; une autre ⇒ < non ;
      // une vignette (contenu < 96 px) ⇒ pas préparée (« pas su »), jamais un score.
      const sMeme = F.comparerFine(P('fin-a'), P('fin-a~bruit')), sReduite = F.comparerFine(P('fin-a'), P('fin-a~bruit', 240, 320)), sAutre = F.comparerFine(P('fin-a'), P('fin-b'));
      dit(F.verdictFin(sMeme) === 'sur' && F.verdictFin(sReduite) !== 'non' && F.verdictFin(sAutre) === 'non', 'F1 · mesure fine exécutée : même image recompressée ⇒ « sûr » ; réduite ⇒ jamais écartée ; autre image ⇒ « non »', JSON.stringify({ sMeme, sReduite, sAutre }));
      dit(F.preparerFine(pixels('fin-a', 80, 100), 80, 100) === null && F.comparerFine(null, P('fin-a')) === null, 'F1 · vignette trop petite ⇒ « pas su » (null), jamais un score', '');
      // Les seuils sont ceux MESURÉS par scripts/bancs/meme-photo-fiabilite.cjs : en changer un exige de relancer ce banc.
      dit(F.SEUIL_FINE_SUR === 0.85 && F.SEUIL_CORREL_SUR === 0.998 && F.SEUIL_FINE_NON === 0.35 && F.SEUIL_EMPREINTE_SUR === 10 && F.COTE_FINE_MIN === 96, 'F1 · seuils = ceux mesurés par le banc de fiabilité (s 0,85 · r 0,998 · non 0,35 · empreinte 10 · 96 px) — en changer un, c’est relancer meme-photo-fiabilite', JSON.stringify([F.SEUIL_FINE_SUR, F.SEUIL_CORREL_SUR, F.SEUIL_FINE_NON, F.SEUIL_EMPREINTE_SUR, F.COTE_FINE_MIN]));
      dit(F.SEUIL_FINE_SUR > F.SEUIL_FINE_NON && F.SEUIL_CORREL_SUR < 1 && F.SEUIL_EMPREINTE_SUR < M.SEUIL_MEME_PHOTO, 'F1 · seuils ordonnés : non < sûr ; empreinte « sûre » plus stricte que le seuil de proposition', JSON.stringify([F.SEUIL_FINE_NON, F.SEUIL_FINE_SUR, F.SEUIL_CORREL_SUR, F.SEUIL_EMPREINTE_SUR, M.SEUIL_MEME_PHOTO]));
      // L'état d'un couple : les DEUX mesures nettes ⇒ sûr ; une seule, ou l'une proche ⇒ à vérifier ; fine nettement contraire ⇒ non.
      const sur = F.SEUIL_FINE_SUR, non = F.SEUIL_FINE_NON, entre = (sur + non) / 2, rs = F.SEUIL_CORREL_SUR;
      const X = (s0, r0 = 0.9999) => ({ s: s0, r: r0 });
      const cas = [[0, X(0.999), 'sur'], [F.SEUIL_EMPREINTE_SUR, X(sur, rs), 'sur'], [F.SEUIL_EMPREINTE_SUR + 1, X(0.999), 'verifier'], [M.SEUIL_MEME_PHOTO, X(0.999), 'verifier'], [4, null, 'verifier'], [4, { s: null }, 'verifier'],
        [4, X(entre), 'verifier'], [4, X(0.999, rs - 0.0005), 'verifier'], [4, X(non - 0.01), 'non'], [M.SEUIL_MEME_PHOTO, X(non - 0.01), 'non']];
      const faux = cas.filter(([d, sc, e]) => M.etatCouple(d, sc) !== e);
      dit(!faux.length, 'F2 · état d’un couple : sûr = empreinte nette ET mesure fine ≥ seuil sûr ; une seule mesure, empreinte proche du seuil ou fine entre deux ⇒ à vérifier ; fine sous le seuil « non » ⇒ écarté', JSON.stringify(faux.map(([d, sc, e]) => [d, sc, e, M.etatCouple(d, sc)])));
    }
    {
      // La règle complète avec les mesures fines (`verifs`, la forme de `photo_meme_verif`).
      const cf = F.cleCoupleFin;
      const avecV = (m, verifs) => M.propositionsMemePhoto({ vinted: m.vinted, autres: m.autres, empreintes: { vinted: m.ev, ...m.es }, cle, verifs });
      const m = base(); autre(m, 'Leboncoin', 5101, ['paire-124~bruit']);
      const k = cf('lbc', '5101', uL('paire-124~bruit'), '111', '1001', uV('paire-124'));
      const sans = calc(m), avec = avecV(m, { [k]: { s: 0.999, r: 0.9999 } }), doute = avecV(m, { [k]: { s: (F.SEUIL_FINE_SUR + F.SEUIL_FINE_NON) / 2, r: 0.9999 } }), non = avecV(m, { [k]: { s: F.SEUIL_FINE_NON - 0.05, r: 0.9 } }), nul = avecV(m, { [k]: { s: null, r: null } });
      dit(sans.propositions.length === 1 && sans.propositions[0].etat === 'verifier' && sans.propositions[0].raison === 'pas-mesure' && sans.nSurs === 0, 'F3 · sans mesure fine : la proposition reste « à vérifier » (une seule mesure), jamais comptée sûre', JSON.stringify(sans.propositions.map((p) => [p.etat, p.raison])));
      dit(avec.propositions.length === 1 && avec.propositions[0].etat === 'sur' && avec.nSurs === 1 && avec.nAVerifier === 0, 'F3 · empreinte nette + mesure fine nette sur CE couple ⇒ « Même photo · sûr »', JSON.stringify(avec.propositions.map((p) => [p.etat, p.fine])));
      dit(doute.propositions.length === 1 && doute.propositions[0].etat === 'verifier' && doute.propositions[0].raison === 'doute', 'F3 · mesure fine entre les deux seuils ⇒ « à vérifier »', JSON.stringify(doute.propositions.map((p) => [p.etat, p.raison])));
      dit(nul.propositions.length === 1 && nul.propositions[0].etat === 'verifier', 'F3 · mesure fine « pas su » (image trop petite) ⇒ « à vérifier »', JSON.stringify(nul.propositions.map((p) => p.etat)));
      dit(non.propositions.length === 0 && non.ambigus.length === 0 && non.nEcartees === 1, 'F3 · mesure fine nettement contraire ⇒ pas la même photo : écartée, rien proposé', JSON.stringify({ p: non.propositions.length, e: non.nEcartees }));
      const autreCle = avecV(m, { [cf('lbc', '5101', uL('paire-124~bruit'), '111', '1002', uV('paire-124'))]: { s: 0.999, r: 0.9999 } });
      dit(autreCle.propositions.length === 1 && autreCle.propositions[0].etat === 'verifier', 'F3 · une mesure fine d’un AUTRE couple (autre annonce Vinted) ne rend jamais celui-ci sûr', JSON.stringify(autreCle.propositions.map((p) => p.etat)));
      // Ambigu : deux paires ; la fine écarte l'une ⇒ l'autre seule (proposition) ; les deux sûres ⇒ ambigu, jamais sûr.
      const a = base(); a.v(1010, 222, '300', 'boite-partagee'); a.v(1011, 111, '301', 'boite-partagee~bruit'); autre(a, 'Leboncoin', 5102, ['boite-partagee']);
      const k300 = cf('lbc', '5102', uL('boite-partagee'), '222', '1010', uV('boite-partagee')), k301 = cf('lbc', '5102', uL('boite-partagee'), '111', '1011', uV('boite-partagee~bruit'));
      const r1 = avecV(a, { [k300]: { s: 0.998, r: 0.9999 }, [k301]: { s: 0.3, r: 0.8 } }), r2 = avecV(a, { [k300]: { s: 0.998, r: 0.9999 }, [k301]: { s: 0.997, r: 0.9999 } });
      dit(r1.propositions.length === 1 && r1.propositions[0].numero === '300' && r1.propositions[0].etat === 'sur' && !r1.ambigus.length, 'F4 · deux paires possibles, la mesure fine écarte l’une ⇒ l’autre seule, « sûr »', JSON.stringify({ p: r1.propositions.map((p) => [p.numero, p.etat]), a: r1.ambigus.length }));
      dit(!r2.propositions.length && r2.ambigus.length === 1 && r2.nSurs === 0 && r2.ambigus[0].paires.every((p) => p.etat === 'sur'), 'F4 · la même photo vraiment sur DEUX paires ⇒ ambigu (il choisit), jamais compté sûr', JSON.stringify({ p: r2.propositions.length, a: r2.ambigus.length, s: r2.nSurs }));
      // Des paires identiques AU MÊME ENDROIT : mêmes blocs (l'empreinte les confond), détails différents.
      const st = base();
      for (let i = 0; i < 6; i++) st.v(3100 + i, 111, String(600 + i), 'studio-jordan~texture' + i);
      for (let i = 0; i < 6; i++) autre(st, 'Leboncoin', 6100 + i, ['studio-jordan~texture' + (10 + i)]);
      const vSt = {};
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) vSt[cf('lbc', String(6100 + i), uL('studio-jordan~texture' + (10 + i)), '111', String(3100 + j), uV('studio-jordan~texture' + j))] = F.comparerFine(P('studio-jordan~texture' + (10 + i)), P('studio-jordan~texture' + j)) || { s: null };
      const rs = avecV(st, vSt), rsSans = calc(st);
      dit(rs.nSurs === 0 && !rs.propositions.some((p) => p.etat === 'sur') && !rs.ambigus.some((x) => x.paires.some((p) => p.etat === 'sur')), 'F5 · 6 paires identiques au MÊME endroit (mêmes blocs, détails différents) : AUCUN « sûr »', JSON.stringify({ surs: rs.nSurs, p: rs.propositions.length, a: rs.ambigus.length, ecartees: rs.nEcartees, scores: Object.values(vSt).map((x) => [x.s, x.r]).sort().slice(-3) }));
      dit(rsSans.nSurs === 0, 'F5 · … et sans mesure fine non plus (l’empreinte seule ne dit jamais « sûr »)', JSON.stringify({ surs: rsSans.nSurs }));
    }
    {
      // §5 : « sûr » propose, SON toucher relie — aucun chemin ne relie seul.
      const appSrc = app.replace(/^\s*\/\/.*$/gm, '');
      // (19 nov., liaison guidée) La seule porte : `ACTIONS_LIAISON.relier`, passée au parcours (`actions={ACTIONS_LIAISON}`).
      const appels = (appSrc.match(/\.relier\(/g) || []).length, refs = (appSrc.match(/\bACTIONS_LIAISON\b/g) || []).length;
      const charge = corps('async function chargerMemePhoto(', 4000).split('\nif (typeof window')[0].replace(/^\s*\/\/.*$/gm, '');
      const regles = (fs.readFileSync(path.join(RACINE, 'src', 'photoFine.js'), 'utf8') + fs.readFileSync(path.join(RACINE, 'src', 'memePhoto.js'), 'utf8')).replace(/\/\/.*$/gm, '');
      dit(appels === 1 && refs === 2 && /actions=\{ACTIONS_LIAISON\}/.test(appSrc) && /relier: \(x\) => liaisonVrm\(\)\.then\(\(L\) => L\.relier\(x\)\)/.test(appSrc) && !/relier|gesteVrm|vrm_lbc_liens|LIENS_EBAY|relierVc/.test(charge) && !/fetch\(|save\(|localStorage|withOwner|gesteVrm/.test(regles),
        'F6 · §5 : relier n’a lieu que sur SON toucher (les actions du parcours), même « sûr » ; le calcul et les règles n’écrivent rien', JSON.stringify({ appels, refs, charge: /relier|gesteVrm/.test(charge) }));
    }
    {
      // E7 · l'extension : la mesure fine d'un couple candidat, les deux images, sans cookie, budgets.
      const uLb = (n) => `https://img.leboncoin.fr/api/v1/lbcpb1/images/${n}.jpg`;
      const monde = (o = {}) => {
        const lignesF = {
          lbc_listings: { items: { 15: { id: 15, account: 'lbc-account:' + CL, subject: 'Paire', status: 'active', images: [uLb('paire-124~bruit')] } } },
          vc_listings: { items: {} },
          harvest_111_listings: { capturedAt: new Date().toISOString(), payload: { items: [{ id: 1001, title: 'x', photo: { url: uV('paire-124') + '?s=SIG' } }] } },
          photo_emprunte_111: { payload: { annonces: { 1001: { [uV('paire-124')]: H('paire-124') } } } },
          photo_empreinte_lbc: { payload: { annonces: { 15: { [uLb('paire-124~bruit')]: H('paire-124~bruit') } } } },
        };
        const store = Object.assign({ vrmLbcTransport: o.lbcTab === false ? {} : { 21: { source: 'prive', compte: 'lbc-account:' + CL, at: Date.now() } } }, o.store || {});
        const f = faireFond({ src: BG, lignes: lignesF, comptes: [{ vinted_user_id: '111', login: 'a', domain: 'www.vinted.fr', access_token: 'j' }], connecte: o.connecte === undefined ? '111' : o.connecte, store, lectureKO: o.lectureKO,
          onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }, { id: 21, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' }] });
        brancherImages(f);
        const fetch0 = f.ctx.fetch; f.images = [];
        f.ctx.fetch = async (u, opts) => {
          const t = String(u);
          const ml = /^https:\/\/img\.leboncoin\.fr\/.*\/([^/]+)\.jpg/.exec(t), mv = /^https:\/\/images1\.vinted\.net\/t\/([^/]+)\//.exec(t);
          if (ml || mv) { f.images.push({ u: t, cred: opts && opts.credentials }); return { ok: true, status: 200, headers: { get: (k) => (/content-type/i.test(k) ? 'image/jpeg' : null) }, blob: async () => new Blob([(ml || mv)[1]]) }; }
          return fetch0(u, opts);
        };
        return f;
      };
      const g = monde();
      if (typeof g.ctx.verifFineUnTour !== 'function') { dit(false, 'E7 · `verifFineUnTour` existe dans le fond'); } else {
        await g.ctx.tickEmpreintes();
        const kOk = F.cleCoupleFin('lbc', '15', uLb('paire-124~bruit'), '111', '1001', uV('paire-124'));
        const l = g.lignes.photo_meme_verif, c = l && l.payload && l.payload.couples && l.payload.couples[kOk];
        dit(g.images.length === 2 && g.images.every((x) => x.cred === 'omit') && g.images.some((x) => /vinted\.net/.test(x.u)) && g.images.some((x) => /leboncoin/.test(x.u)), 'E7 · un couple candidat ⇒ les DEUX images, dans le même tour, SANS cookie (rien d’autre à ce tour)', JSON.stringify(g.images));
        dit(c && F.verdictFin(c) === 'sur' && c.v === F.VERSION_FINE && !/"pixels"|data:image|"f":|"m":/.test(JSON.stringify(l)), 'E7 · rangé dans `photo_meme_verif` : deux NOMBRES par couple { s, r } (la même photo ⇒ « sûr »), jamais l’image', JSON.stringify(l || null).slice(0, 220));
        const lec = ((g.store.vrmLectures || {})['leboncoin:' + CL] || []).length, lecV = ((g.store.vrmLectures || {})['111'] || []).length;
        dit(lec === 1 && lecV >= 1, 'E7 · le couple compte sur le budget de LECTURE du compte Leboncoin ET du compte Vinted', JSON.stringify({ lec, lecV }));
        const n0 = g.images.length; await g.ctx.tickEmpreintes();
        dit(g.images.length === n0, 'E7 · 45 s entre deux mesures ; un couple mesuré ne se refait pas', String(g.images.length - n0));
      }
      { const h = monde({ lbcTab: false }); await h.ctx.tickEmpreintes(); dit(!h.images.some((x) => /leboncoin/.test(x.u)) && !h.lignes.photo_meme_verif, 'E7 · onglet Leboncoin de CE compte fermé ⇒ aucune mesure fine', JSON.stringify(h.images)); }
      { const h = monde({ connecte: null }); await h.ctx.tickEmpreintes(); dit(!h.images.length, 'E7 · aucun compte Vinted connecté dans un onglet ⇒ rien', JSON.stringify(h.images)); }
      { const t = Date.now(); const h = monde({ store: { vrmVerifFineHeure: Array.from({ length: 6 }, () => t - 1000) } }); await h.ctx.verifFineUnTour();
        dit(!h.images.length, 'E7 · 6 couples dans l’heure ⇒ plus rien (plafond)', JSON.stringify(h.images)); }
      { const h0 = monde(); await h0.ctx.planVerifFine(); const plan = h0.store.vrmVerifFinePlan;
        const h = monde({ lectureKO: (u) => /id=eq\.photo_meme_verif/.test(u), store: { vrmVerifFinePlan: plan } }); await h.ctx.verifFineUnTour();
        dit(plan && plan.couples.length === 1 && h.images.length === 2 && !h.lignes.photo_meme_verif && (h.store.vrmVerifFineFile || []).length === 1, 'E7 · lecture de `photo_meme_verif` ratée ⇒ RIEN écrit, le score reste en file', JSON.stringify({ plan: plan && plan.couples.length, img: h.images.length, ecrit: !!h.lignes.photo_meme_verif, file: (h.store.vrmVerifFineFile || []).length })); }
    }

    // ── C1 ──
    const cap = /EXT_CAPACITES = \{[^}]*\bmemephoto: '([\d.]+)'/.exec(app);
    const coh = fs.readFileSync(path.join(RACINE, 'scripts', 'audit-coherence.cjs'), 'utf8');
    const bg = fs.readFileSync(BG, 'utf8');
    const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
    const cv = (/const CODE_VERSION = '([\d.]+)'/.exec(bg) || [])[1];
    const vn = (v) => String(v || '').split('.').map(Number).reduce((t, x) => t * 1000 + (x || 0), 0);
    dit(cap && cap[1] === '5.384.0' && /memephoto:'empreintesSitesUnTour'/.test(coh) && /async function empreintesSitesUnTour\(/.test(bg), 'C1 · `EXT_CAPACITES.memephoto` = 5.384.0, connue de audit-coherence, la fonction existe', cap && cap[1]);
    dit(man.version === cv && vn(cv) >= vn('5.384.0'), 'C1 · manifeste et CODE_VERSION égaux, au moins 5.384.0', `${man.version} / ${cv}`);
    const capS = /EXT_CAPACITES = \{[^}]*\bmemephotosure: '([\d.]+)'/.exec(app);
    dit(capS && capS[1] === '5.393.0' && /memephotosure:'verifFineUnTour'/.test(coh) && /async function verifFineUnTour\(/.test(bg) && vn(cv) >= vn('5.393.0'), 'C2 · `EXT_CAPACITES.memephotosure` = 5.393.0 (la deuxième mesure, servie avec la vague C), connue de audit-coherence, `verifFineUnTour` existe, extension ≥ 5.388.0', `${capS && capS[1]} / ${cv}`);
  } catch (e) { dit(false, 'exécution', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ même photo : tout vert');
  process.exit(ko ? 1 : 0);
})();
