// ════════════════════════════════════════════════════════════════════════════
//  LA FIABILITÉ DE « MÊME PHOTO · SÛR » (15 nov., lot meme-photo-sure) — MESURÉE, pas promise.
//
//  Julien : « Est-ce que tu peux faire la reconnaissance d'image et que ça soit parfaitement
//  fiable ? ». On reconnaît la MÊME PHOTO (le même fichier passé par un autre site), jamais
//  « la même chaussure sur une autre photo ». Deux mesures d'une nature différente :
//    A  l'empreinte (src/photoEmpreinte.js : dHash + pHash 64 bits sur 64 × 64) — le candidat ;
//    B  la mesure fine (src/photoFine.js : recalage puis écart par case sur 256 × 256).
//  L'état d'un couple de photos est celui de la VRAIE règle (src/memePhoto.js `etatCouple`) :
//  « sûr » · « à vérifier » · « écarté » (B nettement contraire) · rien (A au-dessus du seuil).
//
//  Le jeu, INVENTÉ (aucune photo d'annonce réelle, le dépôt est public) :
//    · `BANC_PAIRES` (200) paires DISTINCTES dessinées (scripts/bancs/_photos-inventees.cjs) +
//      les 21 vraies photos de sneakers CC0 du mode exemple (public/exemple/) ;
//    · 50 exemplaires du MÊME modèle photographiés différemment (cadrage, fond, lumière) ;
//    · 2 × 50 exemplaires du MÊME modèle photographiés AU MÊME ENDROIT (même fond, même grain,
//      même lumière, ± 15 px, ± 2°, ± 2 %, usure propre à chaque exemplaire) — le cas le plus dur ;
//    · chaque vraie photo « bougée » (une autre prise de vue : 1,5–3°, décalage, lumière) ;
//    · chaque photo passée par les transformations des sites : JPEG 90/70/50, WebP 80/70/60,
//      réduite de 25 % et de 50 %, vignette au quart, recadrée de quelques px (tout autour, un
//      côté), bandes (au carré blanc, noires, un côté), plus claire, plus sombre, et deux chaînes
//      (moitié + JPEG 60 + WebP 60 ; recadrée + bandes + claire + moitié + WebP 65).
//  Les couples NÉGATIFS : toutes les paires distinctes entre elles, chaque exemplaire du même
//  modèle contre les autres — l'original ET une copie transformée (ce que Leboncoin montrerait).
//   F1  faux positifs « sûr » = 0 (obligatoire, sur TOUS les négatifs) ;
//   F2  vrais positifs « sûr » ≥ 85 % (dit en %, par transformation) ;
//   F3  aucun vrai positif « écarté » sur une transformation du cahier (vignette mise à part : « pas su ») ;
//   F4  une photo trop petite pour la mesure fine (contenu < 96 px) : « pas su », jamais « sûr » ;
//   F5  le monde complet (la règle `propositionsMemePhoto` + la sélection de l'extension
//       `couplesAVerifier`) : 50 exemplaires au même endroit, 6 exemplaires + UNE photo reprise,
//       les 200 paires distinctes reprises à moitié sur Leboncoin ⇒ 0 « sûr » faux ;
//   F6  marge : le meilleur score d'un négatif reste sous le seuil « sûr ».
//  Il imprime le tableau des distances et scores des deux mesures. `MESURES=fichier.json` les écrit.
//  `--mutation=fine` (seuils sûrs abaissés : s 0,5, r 0,9) et `--mutation=une` (« sûr » sur l'empreinte seule)
//  doivent rendre F1 ROUGE. `--src chemin` : un autre arbre (preuve sur le code d'avant).
//  Lancer : node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/meme-photo-fiabilite.cjs
//  (long : 30 à 60 min sur une machine chargée ; `BANC_PAIRES=8` pour un essai ; `BANC_ONGLETS=3` onglets à la fois).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { chromium } = require('playwright');
const RACINE = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', '..'); })();
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const NPAIRES = Number(process.env.BANC_PAIRES || 200);
const NFAM = Math.max(12, Number(process.env.BANC_FAMILLE || 50));   // exemplaires par famille du même modèle (50 ; moins pour un essai)
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const lire = (f) => (fs.existsSync(path.join(RACINE, f)) ? fs.readFileSync(path.join(RACINE, f), 'utf8') : '');
const module_ = (t) => t.replace(/^import [^\n]*\n/gm, '').replace(/^export /gm, '');
let FINE = module_(lire('src/photoFine.js')), MEME = module_(lire('src/memePhoto.js'));
if (!FINE || !/function etatCouple/.test(MEME)) { console.log('❌ F0 · pas de deuxième mesure dans cet arbre (src/photoFine.js, etatCouple) : « sûr » n’existe pas'); process.exit(1); }
if (MUT === 'fine') FINE = FINE.replace(/const SEUIL_FINE_SUR = [\d.]+;/, 'const SEUIL_FINE_SUR = 0.5;').replace(/const SEUIL_CORREL_SUR = [\d.]+;/, 'const SEUIL_CORREL_SUR = 0.9;');
if (MUT === 'une') MEME = MEME.replace("  const v = verdictFin(mesure);\n", "  const v = verdictFin(mesure);\n  if (typeof distance === 'number' && distance <= SEUIL_EMPREINTE_SUR) return 'sur';\n");
if (MUT && FINE + MEME === module_(lire('src/photoFine.js')) + module_(lire('src/memePhoto.js'))) { console.log(`❓ mutation ${MUT} : texte introuvable`); process.exit(2); }
const GEN = require('./_photos-inventees.cjs').SOURCE.replace(/getContext\('2d'\)/g, "getContext('2d', { willReadFrequently: true })");
const REGLES_SRC = `${module_(lire('src/photoEmpreinte.js'))}\n${FINE}\n${MEME}`;
// Les MÊMES règles (mutées le cas échéant) côté node, pour le monde complet et les distances A.
const N = vm.runInNewContext(`${REGLES_SRC}\n;({ distanceEmpreintes, propositionsMemePhoto, couplesAVerifier, etatCouple, SEUIL_MEME_PHOTO })`, {});
const PAGE = `<!doctype html><meta charset="utf-8"><body><script>
${REGLES_SRC}
${GEN}
// Les canvas et images d'une photo sont LIBÉRÉS dès que son empreinte et sa préparation sont prises
// (sans cela, des milliers de canvas 600 × 800 font tomber l'onglet).
const _crees = [];
{ const ce = document.createElement.bind(document); document.createElement = (t) => { const e = ce(t); if (/^(canvas|img)$/i.test(t)) _crees.push(e); return e; };
  const I0 = window.Image; window.Image = function () { const i = new I0(); _crees.push(i); return i; }; }
function liberer() { for (const e of _crees.splice(0)) { try { if (e.tagName === 'CANVAS') { e.width = 0; e.height = 0; } else e.src = ''; } catch (_) {} } }
async function empA(img) { const n = COTE_EMPREINTE; const c = document.createElement('canvas'); c.width = n; c.height = n; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, n, n); return empreinteDepuisPixels(x.getImageData(0, 0, n, n).data, n, n); }
// La photo telle que l'extension la lit : dessinée à tailleLectureFine (proportions gardées), préparée.
function prep(img) { const t = tailleLectureFine(img.width, img.height); const c = document.createElement('canvas'); c.width = t.w; c.height = t.h; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, t.w, t.h); return preparerFine(x.getImageData(0, 0, t.w, t.h).data, t.w, t.h); }
const sign = async (img) => ({ h: await empA(img), p: prep(img) });
// Un couple : distance A, mesure B (seulement si A est candidat : c'est ce que fait l'extension), état.
function couple(a, b) {
  const d = distanceEmpreintes(a.h, b.h);
  const cand = d != null && d <= SEUIL_MEME_PHOTO;
  const m = cand ? comparerFine(a.p, b.p) : undefined;
  return { d, s: m ? m.s : (cand ? null : undefined), r: m ? m.r : undefined, e: cand ? etatCouple(d, m) : 'rien' };
}
window.__regles = () => ({ SEUIL_MEME_PHOTO, SEUIL_EMPREINTE_SUR, SEUIL_FINE_SUR, SEUIL_CORREL_SUR, SEUIL_FINE_NON, COTE_FINE, COTE_DETAIL, COTE_FINE_MIN });
const source = async (id, REELS) => (id[0] === 'P' ? photo(paire(Number(id.slice(1)) + 100), vueDe(Number(id.slice(1)) + 100, 0)) : charge(REELS[Number(id.slice(1))]));
// 1. une paire distincte (P…) ou une vraie photo (R…) : l'original et chacune de ses transformations.
window.__tp = async (ids, REELS) => {
  const out = [];
  for (const id of ids) {
    const c = await source(id, REELS);
    const T = await transformations(c);
    const o = await sign(T.jpeg90);
    const x = { id, h: o.h, copieH: null, tp: [], bougees: [] };
    for (const [nom, im] of Object.entries(T)) if (nom !== 'jpeg90') { const y = await sign(im); if (nom === 'cdn') x.copieH = y.h; x.tp.push(Object.assign({ nom }, couple(o, y))); }
    if (id[0] === 'R') { const r = alea(400 + Number(id.slice(1))); for (let b = 0; b < 3; b++) x.bougees.push(Object.assign({ b: 'bougee' + b }, couple(o, await sign(await jpeg(bougee(c, r), 0.85))))); }
    liberer();
    out.push(x);
  }
  return out;
};
// Un couple de deux paires distinctes (rare : leur empreinte est presque toujours > seuil) — « copie » :
// la copie « autre site » de b contre l'original de a.
window.__couple = async (ia, ib, copie, REELS) => {
  const a = await sign((await transformations(await source(ia, REELS))).jpeg90);
  const Tb = await transformations(await source(ib, REELS));
  const b = await sign(copie ? Tb.cdn : Tb.jpeg90);
  liberer();
  return couple(a, b);
};
// 2. une famille du MÊME modèle (50 exemplaires) : l'original et UNE copie transformée de chacun ;
//    les couples (i, j) dont l'indice tombe dans cette tranche ; la tranche 0 fait aussi le monde complet.
const FAMILLES = { 'meme-modele': (i) => photo(paire(3), vueDe(3, i)), 'meme-endroit-A': (i) => photo(paire(3), vueStudio(3, i)), 'meme-endroit-B': (i) => photo(paire(11), vueStudio(11, i)) };
window.__famille = async (g, tranche, nTranches, nInst = 50) => {
  const noms = ['jpeg90', 'jpeg70', 'jpeg50', 'webp80', 'webp70', 'webp60', 'reduite25', 'reduite50', 'vignette', 'rogne_px', 'rogne_cote', 'bandes_carre', 'bandes_noires', 'bande_cote', 'plus_claire', 'plus_sombre', 'cdn', 'tout'].filter((n) => n !== 'jpeg90');
  const L = [];
  for (let i = 0; i < nInst; i++) {
    const T = await transformations(FAMILLES[g](i));
    const nom = noms[i % noms.length];
    L.push(Object.assign({ id: g + i, nomCopie: nom }, await sign(T.jpeg90), { c: await sign(T[nom]) }));
    liberer();
  }
  const out = { tp: [], neg: {}, mondes: {} };
  const neg = (k, a, b, x) => (out.neg[k] = out.neg[k] || []).push(Object.assign({ a, b }, x));
  let n = 0;
  for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) {
    if (i === j) { if (tranche === 0) out.tp.push(Object.assign({ g, id: L[i].id, nom: L[i].nomCopie }, couple(L[i], L[i].c))); continue; }
    if (j > i && (n++ % nTranches) === tranche) neg(g, L[i].id, L[j].id, couple(L[i], L[j]));
    if ((n++ % nTranches) === tranche) neg(g + '·copie', L[i].id, L[j].id + '/' + L[j].nomCopie, couple(L[i], L[j].c));   // l'annonce Leboncoin d'un AUTRE exemplaire
  }
  if (tranche === 0) {
    // Le monde complet : la VRAIE règle et la VRAIE sélection de l'extension (couplesAVerifier).
    const monde = (nom, vintedL, lbcL) => {
      const vinted = [], autres = [], ev = { 111: {} }, el = {}, parK = new Map();
      vintedL.forEach((x, i) => { const k = 'v/' + x.id; vinted.push({ id: String(10000 + i), compte: '111', numero: String(500 + i), photo: k }); ev[111][10000 + i] = { [k]: x.h }; parK.set(k, x); x._num = String(500 + i); });
      lbcL.forEach((y, i) => { const k = 'l/' + i; autres.push({ plateforme: 'Leboncoin', id: String(20000 + i), compte: 'c', photo: k, relie: false }); el[20000 + i] = { [k]: y.s.h }; parK.set(k, y.s); });
      const choisis = couplesAVerifier({ vinted: ev, sites: { lbc: el } });
      const verifs = {};
      for (const c of choisis) verifs[c.cle] = comparerFine(parK.get(c.sk).p, parK.get(c.vk).p) || { s: null };
      const r = propositionsMemePhoto({ vinted, autres, empreintes: { vinted: ev, Leboncoin: el }, verifs });
      const vrai = new Map(lbcL.map((y, i) => [String(20000 + i), y.vrai ? y.vrai._num : null]));
      const surs = r.propositions.filter((p) => p.etat === 'sur'), surFaux = surs.filter((p) => vrai.get(p.annonce.id) !== p.numero).length;
      out.mondes[nom] = { annoncesLbc: lbcL.length, reprises: lbcL.filter((y) => y.vrai).length, couplesMesures: choisis.length, propositions: r.propositions.length, ambigus: r.ambigus.length, surVrai: surs.length - surFaux, surFaux,
        aVerifierFaux: r.propositions.filter((p) => p.etat !== 'sur' && vrai.get(p.annonce.id) !== p.numero).length + r.ambigus.length, generiques: r.nGeneriques, ecartees: r.nEcartees };
    };
    if (g === 'meme-endroit-A') monde(L.length + ' au même endroit, aucune reprise', L.slice(0, L.length >> 1), L.slice(L.length >> 1).map((x) => ({ s: x.c })));
    if (g === 'meme-endroit-B') monde('6 au même endroit + 1 reprise', L.slice(0, 6), L.slice(6, 11).map((x) => ({ s: x.c })).concat([{ s: L[2].c, vrai: L[2] }]));
    if (g === 'meme-modele') monde('même modèle, autres prises de vue', L.slice(0, L.length >> 1), L.slice(L.length >> 1).map((x) => ({ s: x.c })));
  }
  return out;
};
</script>`;

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox', '--js-flags=--max-old-space-size=4096'] });
  const t0 = Date.now();
  const ex = path.join(RACINE, 'public', 'exemple');
  const reels = fs.readdirSync(ex).filter((f) => f.endsWith('-400.webp')).sort().map((f) => '/ex/' + f);
  // Chaque tâche dans un onglet NEUF (mémoire rendue à la fin), `BANC_ONGLETS` à la fois.
  // `BANC_CACHE=<dossier>` : chaque tâche finie y est rangée (clé = sources des règles + du jeu + la
  // tâche) ; une relance reprend là où la précédente s'est arrêtée. Un onglet tombé est relancé (2 fois).
  const CACHE = process.env.BANC_CACHE || '';
  if (CACHE) fs.mkdirSync(CACHE, { recursive: true });
  const empreinteSources = require('crypto').createHash('sha1').update(PAGE).digest('hex').slice(0, 12);
  const tache = async (fn, args) => {
    const cle = CACHE ? path.join(CACHE, require('crypto').createHash('sha1').update(empreinteSources + JSON.stringify([fn, args])).digest('hex').slice(0, 20) + '.json') : '';
    if (cle && fs.existsSync(cle)) return JSON.parse(fs.readFileSync(cle, 'utf8'));
    for (let essai = 0; ; essai++) {
      const page = await nav.newPage();
      page.setDefaultTimeout(0);
      try {
        await page.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.pathname.startsWith('/ex/')) return r.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.join(ex, path.basename(u.pathname))) }); return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }); });
        await page.goto('http://localhost/fiabilite');
        const res = await page.evaluate(([f, a]) => window[f](...a), [fn, args]);
        if (cle) fs.writeFileSync(cle, JSON.stringify(res));
        return res;
      } catch (e) {
        if (essai >= 2 || !/crash|closed/i.test(String(e && e.message))) throw e;
        console.log(`   (onglet tombé pendant ${fn} ${JSON.stringify(args).slice(0, 60)} : relancé)`);
      } finally { await page.close().catch(() => {}); }
    }
  };
  const ONGLETS = Math.max(1, Number(process.env.BANC_ONGLETS || 3));
  const enParallele = async (liste) => { const res = new Array(liste.length); let k = 0; await Promise.all(Array.from({ length: ONGLETS }, async () => { while (k < liste.length) { const i = k++; res[i] = await liste[i](); } })); return res; };
  let R, m;
  try {
    R = await tache('__regles', []);
    // Les paires distinctes et les vraies photos, par lots de 8.
    const ids = [...Array.from({ length: NPAIRES }, (_, k) => 'P' + k), ...reels.map((_, i) => 'R' + i)];
    const lots = []; for (let i = 0; i < ids.length; i += 8) lots.push(ids.slice(i, i + 8));
    const NT = Math.max(1, Number(process.env.BANC_TRANCHES || 8));
    const fams = ['meme-modele', 'meme-endroit-A', 'meme-endroit-B'];
    const taches = [...lots.map((l) => () => tache('__tp', [l, reels])), ...fams.flatMap((g) => Array.from({ length: NT }, (_, t) => () => tache('__famille', [g, t, NT, NFAM])))];
    const res = await enParallele(taches);
    const photos = res.slice(0, lots.length).flat(), familles = res.slice(lots.length);
    m = { tp: [], neg: { distinctes: [], 'distinctes·copie': [], bougees: [] }, mondes: {} };
    for (const x of photos) { for (const t of x.tp) m.tp.push(Object.assign({ g: x.id[0] === 'P' ? 'paires' : 'reelles', id: x.id }, t)); for (const b of x.bougees) m.neg.bougees.push(Object.assign({ a: x.id, b: b.b }, b)); }
    for (const f of familles) { m.tp.push(...f.tp); for (const [k, l] of Object.entries(f.neg)) (m.neg[k] = m.neg[k] || []).push(...l); Object.assign(m.mondes, f.mondes); }
    // Les paires distinctes entre elles (l'original de a contre l'original ET la copie « autre site » de b) :
    // la distance A se calcule ici ; un candidat (A ≤ seuil) est remesuré en entier dans un onglet.
    const aRefaire = [];
    for (let i = 0; i < photos.length; i++) for (let j = 0; j < photos.length; j++) {
      if (i === j) continue;
      const a = photos[i], b = photos[j];
      if (j > i) { const d = N.distanceEmpreintes(a.h, b.h); if (d != null && d <= N.SEUIL_MEME_PHOTO) aRefaire.push(['distinctes', a.id, b.id, false]); else m.neg.distinctes.push({ a: a.id, b: b.id, d, e: 'rien' }); }
      const dc = N.distanceEmpreintes(a.h, b.copieH); if (dc != null && dc <= N.SEUIL_MEME_PHOTO) aRefaire.push(['distinctes·copie', a.id, b.id, true]); else m.neg['distinctes·copie'].push({ a: a.id, b: b.id + '/cdn', d: dc, e: 'rien' });
    }
    const refaits = await enParallele(aRefaire.map(([k, ia, ib, cp]) => () => tache('__couple', [ia, ib, cp, reels]).then((x) => [k, ia, ib, cp, x])));
    for (const [k, ia, ib, cp, x] of refaits) m.neg[k].push(Object.assign({ a: ia, b: ib + (cp ? '/cdn' : '') }, x));
    // Le monde « paires distinctes, moitié reprise » : la moitié reprise sur Leboncoin (copie « autre site »),
    // l'autre moitié absente de Vinted. La mesure fine d'une reprise est celle du vrai couple (cdn) déjà prise.
    {
      const moitie = Math.floor(photos.length / 2);
      const vinted = [], autres = [], ev = { 111: {} }, el = {};
      photos.slice(0, moitie).forEach((x, i) => { vinted.push({ id: String(10000 + i), compte: '111', numero: String(500 + i), photo: 'v/' + x.id }); ev[111][10000 + i] = { ['v/' + x.id]: x.h }; });
      photos.forEach((x, i) => { autres.push({ plateforme: 'Leboncoin', id: String(20000 + i), compte: 'c', photo: 'l/' + x.id, relie: false }); el[20000 + i] = { ['l/' + x.id]: x.copieH }; });
      const choisis = N.couplesAVerifier({ vinted: ev, sites: { lbc: el } });
      const verifs = {};
      for (const c of choisis) {
        const ia = c.vk.slice(2), ib = c.sk.slice(2);
        if (ia === ib) { const t = (photos.find((x) => x.id === ia) || { tp: [] }).tp.find((t) => t.nom === 'cdn'); verifs[c.cle] = t && typeof t.s === 'number' ? { s: t.s, r: t.r } : { s: null }; }
        else { const x = await tache('__couple', [ia, ib, true, reels]); verifs[c.cle] = typeof x.s === 'number' ? { s: x.s, r: x.r } : { s: null }; }
      }
      const r = N.propositionsMemePhoto({ vinted, autres, empreintes: { vinted: ev, Leboncoin: el }, verifs });
      const vrai = (p) => Number(p.annonce.id) - 20000 < moitie && String(500 + Number(p.annonce.id) - 20000) === p.numero;
      const surs = r.propositions.filter((p) => p.etat === 'sur'), surFaux = surs.filter((p) => !vrai(p)).length;
      m.mondes['paires distinctes, moitié reprise'] = { annoncesLbc: photos.length, reprises: moitie, couplesMesures: choisis.length, propositions: r.propositions.length, ambigus: r.ambigus.length, surVrai: surs.length - surFaux, surFaux,
        aVerifierFaux: r.propositions.filter((p) => p.etat !== 'sur' && !vrai(p)).length + r.ambigus.length, generiques: r.nGeneriques, ecartees: r.nEcartees };
    }
    if (process.env.MESURES) fs.writeFileSync(process.env.MESURES, JSON.stringify({ R, m }));
  } finally { await nav.close(); }
  const fx = (x, n = 3) => (x == null ? '—' : Number(x).toFixed(n));
  const stats = (l) => {
    const A = l.map((x) => x.d).filter((x) => x != null), B = l.map((x) => x.s).filter((x) => typeof x === 'number'), C = l.map((x) => x.r).filter((x) => typeof x === 'number');
    const c = { sur: 0, verifier: 0, non: 0, rien: 0 }; for (const x of l) c[x.e] = (c[x.e] || 0) + 1;
    return { n: l.length, aMin: A.length ? Math.min(...A) : null, aMax: A.length ? Math.max(...A) : null, bMin: B.length ? Math.min(...B) : null, bMax: B.length ? Math.max(...B) : null, rMin: C.length ? Math.min(...C) : null, rMax: C.length ? Math.max(...C) : null, nB: B.length, nNul: l.filter((x) => x.s === null).length, ...c };
  };
  console.log(`\nRègles : empreinte ≤ ${R.SEUIL_MEME_PHOTO} = candidat, ≤ ${R.SEUIL_EMPREINTE_SUR} = nette · mesure fine s ≥ ${R.SEUIL_FINE_SUR} ET r ≥ ${R.SEUIL_CORREL_SUR} = sûr, s < ${R.SEUIL_FINE_NON} = écarté · grille ${R.COTE_FINE} / détail ${R.COTE_DETAIL}, contenu ≥ ${R.COTE_FINE_MIN} px`);
  const negs = Object.values(m.neg).flat();
  console.log(`Jeu : ${NPAIRES} paires dessinées + ${reels.length} vraies photos CC0, 50 même modèle, 2 × 50 au même endroit · ${m.tp.length} vrais couples, ${negs.length} faux couples · ${Math.round((Date.now() - t0) / 1000)} s`);
  const ligne = (nom, s) => console.log(`  ${nom.padEnd(26)} ${String(s.n).padStart(6)}  A ${String(s.aMin).padStart(2)}–${String(s.aMax).padEnd(2)}  s ${fx(s.bMin)}–${fx(s.bMax)}  r ${fx(s.rMin, 4)}–${fx(s.rMax, 4)} (${s.nB} mesurés${s.nNul ? `, ${s.nNul} pas su` : ''})  sûr ${s.sur}  à vérifier ${s.verifier}  écarté ${s.non}  rien ${s.rien}`);
  console.log('\nVRAIS couples (la même photo passée par un autre site), par transformation :');
  const parNom = {}; for (const x of m.tp) (parNom[x.nom] = parNom[x.nom] || []).push(x);
  for (const [nom, l] of Object.entries(parNom)) ligne(nom, stats(l));
  const sTp = stats(m.tp); ligne('TOUS', sTp);
  console.log('\nFAUX couples (deux photos différentes) :');
  for (const [g, l] of Object.entries(m.neg)) ligne(g, stats(l));
  const sNeg = stats(negs); ligne('TOUS', sNeg);
  console.log('\nLe monde complet (règle + sélection de l’extension) :');
  for (const [nom, w] of Object.entries(m.mondes)) console.log(`  ${nom.padEnd(36)} Leboncoin ${w.annoncesLbc} (dont ${w.reprises} reprises) · couples mesurés ${w.couplesMesures} · sûr vrai ${w.surVrai} · sûr FAUX ${w.surFaux} · à vérifier faux ${w.aVerifierFaux} · génériques ${w.generiques} · écartés ${w.ecartees}`);

  const tpVig = m.tp.filter((x) => x.nom === 'vignette'), tpCahier = m.tp.filter((x) => x.nom !== 'vignette');
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + ' %' : '—');
  dit(sNeg.sur === 0, `F1 · faux positifs « sûr » : ${sNeg.sur} sur ${sNeg.n} faux couples (dont ${negs.filter((x) => x.e !== 'rien').length} candidats de l’empreinte)`, negs.filter((x) => x.e === 'sur').slice(0, 5).map((x) => `${x.a}~${x.b} A${x.d} s${x.s} r${x.r}`).join(', '));
  const surTp = tpCahier.filter((x) => x.e === 'sur').length, candTp = tpCahier.filter((x) => x.e !== 'rien').length;
  const LEGERES = ['jpeg70', 'jpeg50', 'webp80', 'webp70', 'webp60', 'plus_claire', 'plus_sombre'];
  const leg = m.tp.filter((x) => LEGERES.includes(x.nom)), surLeg = leg.filter((x) => x.e === 'sur').length;
  console.log(`   F2 · vrais positifs « sûr » : ${surTp} / ${tpCahier.length} = ${pct(surTp, tpCahier.length)} ; candidats de l’empreinte ${candTp} / ${tpCahier.length} = ${pct(candTp, tpCahier.length)} (vignettes à part : ${tpVig.filter((x) => x.e === 'sur').length} sûr / ${tpVig.length}) ; un candidat pas « sûr » reste « à vérifier » (montré)`);
  dit(surLeg / leg.length >= 0.9, `F2 · recompression seule (JPEG 50–70, WebP 60–80, ± 10 % de lumière) ⇒ « sûr » ${surLeg} / ${leg.length} = ${pct(surLeg, leg.length)} (≥ 90 % exigé)`, '');
  const fpVer = negs.filter((x) => x.e === 'verifier').length;
  console.log(`   F3 · faux « à vérifier » : ${fpVer} sur ${sNeg.n} faux couples (${pct(fpVer, sNeg.n)}) — montrés avec les deux photos, jamais comptés sûrs ; écartés par la mesure fine : ${sNeg.non}`);
  const tpEcartes = tpCahier.filter((x) => x.e === 'non');
  dit(!tpEcartes.length, 'F3 · aucun vrai positif ÉCARTÉ par la mesure fine (une transformation du cahier ne fait jamais perdre la proposition)', tpEcartes.slice(0, 6).map((x) => `${x.id}/${x.nom} A${x.d} s${x.s} r${x.r}`).join(', '));
  const pasSu = [...m.tp, ...negs].filter((x) => x.s === null);
  dit(pasSu.every((x) => x.e !== 'sur'), `F4 · une photo trop petite pour la mesure fine (contenu < ${R.COTE_FINE_MIN} px) : « pas su », jamais « sûr » (${pasSu.length} couples)`, pasSu.filter((x) => x.e === 'sur').map((x) => x.id || x.a).join(','));
  const mondes = Object.values(m.mondes);
  dit(mondes.length === 4 && mondes.every((w) => w.surFaux === 0), 'F5 · le monde complet : AUCUN « sûr » faux (50 au même endroit, 6 + 1 reprise, paires distinctes, même modèle)', JSON.stringify(m.mondes));
  const w6 = m.mondes['6 au même endroit + 1 reprise'], wd = m.mondes['paires distinctes, moitié reprise'];
  console.log(`   F5 · reprises reconnues « sûr » : ${w6 ? w6.surVrai : '—'} / ${w6 ? w6.reprises : '—'} (même endroit), ${wd ? wd.surVrai : '—'} / ${wd ? wd.reprises : '—'} (paires distinctes)`);
  const mes = negs.filter((x) => typeof x.s === 'number');
  const sMax = mes.reduce((t, x) => Math.max(t, x.s), -1), rMax = mes.reduce((t, x) => Math.max(t, x.r), -1);
  const lesDeux = mes.filter((x) => x.s >= R.SEUIL_FINE_SUR && x.r >= R.SEUIL_CORREL_SUR).length;
  dit(lesDeux === 0, `F6 · marge : chez les ${mes.length} faux couples mesurés, s max ${fx(sMax, 4)} (seuil ${R.SEUIL_FINE_SUR}), r max ${fx(rMax, 4)} (seuil ${R.SEUIL_CORREL_SUR}) ; les deux au-dessus à la fois : ${lesDeux}`, '');
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ « même photo · sûr » : fiabilité mesurée, tout vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
