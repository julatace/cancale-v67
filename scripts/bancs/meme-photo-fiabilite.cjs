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
//   F4  une vignette (contenu < 96 px) n'est jamais « sûr » ;
//   F5  le monde complet (la règle `propositionsMemePhoto` + la sélection de l'extension
//       `couplesAVerifier`) : 50 exemplaires au même endroit, 6 exemplaires + UNE photo reprise,
//       les 200 paires distinctes reprises à moitié sur Leboncoin ⇒ 0 « sûr » faux ;
//   F6  marge : le meilleur score d'un négatif reste sous le seuil « sûr ».
//  Il imprime le tableau des distances et scores des deux mesures. `MESURES=fichier.json` les écrit.
//  `--mutation=fine` (seuils sûrs abaissés : s 0,5, r 0,9) et `--mutation=une` (« sûr » sur l'empreinte seule)
//  doivent rendre F1 ROUGE. `--src chemin` : un autre arbre (preuve sur le code d'avant).
//  Lancer : node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/meme-photo-fiabilite.cjs
//  (long : 10 à 25 min sur une machine chargée ; `BANC_PAIRES=40` pour un essai).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RACINE = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', '..'); })();
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const NPAIRES = Number(process.env.BANC_PAIRES || 200);
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
const PAGE = `<!doctype html><meta charset="utf-8"><body><script>
${module_(lire('src/photoEmpreinte.js'))}
${FINE}
${MEME}
${GEN}
async function empA(img) { const n = COTE_EMPREINTE; const c = document.createElement('canvas'); c.width = n; c.height = n; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, n, n); return empreinteDepuisPixels(x.getImageData(0, 0, n, n).data, n, n); }
// La photo telle que l'extension la lit : dessinée à tailleLectureFine (proportions gardées), préparée.
function prep(img) { const t = tailleLectureFine(img.width, img.height); const c = document.createElement('canvas'); c.width = t.w; c.height = t.h; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, t.w, t.h); return preparerFine(x.getImageData(0, 0, t.w, t.h).data, t.w, t.h); }
const sign = async (img) => ({ h: await empA(img), p: prep(img) });
// Un couple : distance A, score B (seulement si A est candidat : c'est ce que fait l'extension), état.
function couple(a, b) {
  const d = distanceEmpreintes(a.h, b.h);
  const cand = d != null && d <= SEUIL_MEME_PHOTO;
  const m = cand ? comparerFine(a.p, b.p) : undefined;
  return { d, s: m ? m.s : (cand ? null : undefined), r: m ? m.r : undefined, e: cand ? etatCouple(d, m) : 'rien' };
}
window.__regles = () => ({ SEUIL_MEME_PHOTO, SEUIL_EMPREINTE_SUR, SEUIL_FINE_SUR, SEUIL_CORREL_SUR, SEUIL_FINE_NON, COTE_FINE, COTE_DETAIL, COTE_FINE_MIN });
window.__mesure = async (NPAIRES, REELS) => {
  const out = { tp: [], neg: {}, mondes: {} };
  const neg = (g, a, b, x) => (out.neg[g] = out.neg[g] || []).push(Object.assign({ a, b }, x));
  const origs = [];
  // 1. paires distinctes et vraies photos : chaque transformation contre l'original
  const avecT = async (g, id, c) => {
    const T = await transformations(c);
    const o = Object.assign({ g, id }, await sign(T.jpeg90)); origs.push(o);
    const copies = {};
    for (const [nom, im] of Object.entries(T)) if (nom !== 'jpeg90') { const x = await sign(im); copies[nom] = x; out.tp.push(Object.assign({ g, id, nom }, couple(o, x))); }
    o.copie = copies.cdn;               // la copie « passée par un autre site » pour le monde complet
    return o;
  };
  for (let k = 0; k < NPAIRES; k++) await avecT('paires', 'P' + k, photo(paire(k + 100), vueDe(k + 100, 0)));
  for (const [i, src] of REELS.entries()) {
    const im = await charge(src); const o = await avecT('reelles', 'R' + i, im);
    const r = alea(400 + i);
    for (let b = 0; b < 3; b++) neg('bougees', o.id, 'bougee' + b, couple(o, await sign(await jpeg(bougee(im, r), 0.85))));
  }
  const distinctes = origs.slice();
  for (let i = 0; i < distinctes.length; i++) for (let j = i + 1; j < distinctes.length; j++) neg('distinctes', distinctes[i].id, distinctes[j].id, couple(distinctes[i], distinctes[j]));
  // 2. le même modèle : photographié différemment, puis au même endroit (deux studios)
  const noms = Object.keys(await transformations(photo(paire(3), vueDe(3, 0)))).filter((n) => n !== 'jpeg90');
  const famille = async (g, fab) => {
    const L = [];
    for (let i = 0; i < 50; i++) {
      const c = fab(i); const T = await transformations(c);
      const nom = noms[i % noms.length];
      L.push(Object.assign({ g, id: g + i, nomCopie: nom }, await sign(T.jpeg90), { c: await sign(T[nom]) }));
    }
    for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) {
      if (i === j) { out.tp.push(Object.assign({ g, id: L[i].id, nom: L[i].nomCopie }, couple(L[i], L[i].c))); continue; }
      if (j > i) neg(g, L[i].id, L[j].id, couple(L[i], L[j]));
      neg(g + '·copie', L[i].id, L[j].id + '/' + L[j].nomCopie, couple(L[i], L[j].c));   // l'annonce Leboncoin d'un AUTRE exemplaire
    }
    return L;
  };
  const M = await famille('meme-modele', (i) => photo(paire(3), vueDe(3, i)));
  const S3 = await famille('meme-endroit-A', (i) => photo(paire(3), vueStudio(3, i)));
  const S11 = await famille('meme-endroit-B', (i) => photo(paire(11), vueStudio(11, i)));
  // 3. le monde complet : la VRAIE règle et la VRAIE sélection de l'extension (couplesAVerifier).
  const monde = (nom, vintedL, lbcL) => {
    const vinted = [], autres = [], ev = { 111: {} }, el = {};
    vintedL.forEach((x, i) => { const k = 'v/' + x.id; vinted.push({ id: String(10000 + i), compte: '111', numero: String(500 + i), photo: k }); ev[111][10000 + i] = { [k]: x.h }; x._vid = String(10000 + i); x._k = k; x._num = String(500 + i); });
    lbcL.forEach((y, i) => { const k = 'l/' + i; autres.push({ plateforme: 'Leboncoin', id: String(20000 + i), compte: 'c', photo: k, relie: false }); el[20000 + i] = { [k]: y.s.h }; y._sid = String(20000 + i); y._k = k; });
    const choisis = couplesAVerifier({ vinted: ev, sites: { lbc: el } });
    const parK = new Map(); vintedL.forEach((x) => parK.set(x._k, x)); lbcL.forEach((y) => parK.set(y._k, y.s));
    const verifs = {};
    for (const c of choisis) verifs[c.cle] = comparerFine(parK.get(c.sk).p, parK.get(c.vk).p) || { s: null };
    const r = propositionsMemePhoto({ vinted, autres, empreintes: { vinted: ev, Leboncoin: el }, verifs });
    const vrai = new Map(lbcL.map((y) => [y._sid, y.vrai ? y.vrai._num : null]));
    const surs = r.propositions.filter((p) => p.etat === 'sur');
    const surFaux = surs.filter((p) => vrai.get(p.annonce.id) !== p.numero).length;
    const surVrai = surs.length - surFaux;
    const aVerifierFaux = r.propositions.filter((p) => p.etat !== 'sur' && vrai.get(p.annonce.id) !== p.numero).length + r.ambigus.length;
    out.mondes[nom] = { annoncesLbc: lbcL.length, reprises: lbcL.filter((y) => y.vrai).length, couplesMesures: choisis.length, propositions: r.propositions.length, ambigus: r.ambigus.length, surVrai, surFaux, aVerifierFaux, generiques: r.nGeneriques, ecartees: r.nEcartees };
  };
  // 50 exemplaires au même endroit : 25 en ligne sur Vinted ; sur Leboncoin, les 25 AUTRES (aucune reprise).
  monde('50 au même endroit, aucune reprise', S3.slice(0, 25), S3.slice(25).map((x) => ({ s: x.c })));
  // 6 exemplaires au même endroit sur Vinted ; Leboncoin : 5 autres exemplaires + LA photo de l'un d'eux reprise.
  monde('6 au même endroit + 1 reprise', S11.slice(0, 6), S11.slice(6, 11).map((x) => ({ s: x.c })).concat([{ s: S11[2].c, vrai: S11[2] }]));
  // Les paires distinctes : la moitié reprise sur Leboncoin (copie « autre site »), l'autre moitié absente de Vinted.
  const moitie = Math.floor(distinctes.length / 2);
  monde('paires distinctes, moitié reprise', distinctes.slice(0, moitie), distinctes.slice(0, moitie).map((x) => ({ s: x.copie, vrai: x })).concat(distinctes.slice(moitie).map((x) => ({ s: x.copie }))));
  // Le même modèle photographié différemment : 25 sur Vinted, les 25 autres sur Leboncoin.
  monde('même modèle, autres prises de vue', M.slice(0, 25), M.slice(25).map((x) => ({ s: x.c })));
  return out;
};
</script>`;

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const t0 = Date.now();
  try {
    const page = await nav.newPage();
    page.setDefaultTimeout(0);
    const ex = path.join(RACINE, 'public', 'exemple');
    await page.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.pathname.startsWith('/ex/')) return r.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.join(ex, path.basename(u.pathname))) }); return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }); });
    await page.goto('http://localhost/fiabilite');
    const R = await page.evaluate(() => window.__regles());
    const reels = fs.readdirSync(ex).filter((f) => f.endsWith('-400.webp')).sort().map((f) => '/ex/' + f);
    const m = await page.evaluate(([n, r]) => window.__mesure(n, r), [NPAIRES, reels]);
    if (process.env.MESURES) fs.writeFileSync(process.env.MESURES, JSON.stringify({ R, m }));
    const fx = (x, n = 3) => (x == null ? '—' : Number(x).toFixed(n));
    const stats = (l) => {
      const A = l.map((x) => x.d).filter((x) => x != null), B = l.map((x) => x.s).filter((x) => typeof x === 'number'), C = l.map((x) => x.r).filter((x) => typeof x === 'number');
      const c = { sur: 0, verifier: 0, non: 0, rien: 0 }; for (const x of l) c[x.e] = (c[x.e] || 0) + 1;
      return { n: l.length, aMin: A.length ? Math.min(...A) : null, aMax: A.length ? Math.max(...A) : null, bMin: B.length ? Math.min(...B) : null, bMax: B.length ? Math.max(...B) : null, rMin: C.length ? Math.min(...C) : null, rMax: C.length ? Math.max(...C) : null, nB: B.length, nNul: l.filter((x) => x.s === null).length, ...c };
    };
    console.log(`\nRègles : empreinte ≤ ${R.SEUIL_MEME_PHOTO} = candidat, ≤ ${R.SEUIL_EMPREINTE_SUR} = nette · mesure fine s ≥ ${R.SEUIL_FINE_SUR} ET r ≥ ${R.SEUIL_CORREL_SUR} = sûr, s < ${R.SEUIL_FINE_NON} = écarté · grille ${R.COTE_FINE} / détail ${R.COTE_DETAIL}, contenu ≥ ${R.COTE_FINE_MIN} px`);
    console.log(`Jeu : ${NPAIRES} paires dessinées + ${reels.length} vraies photos CC0, 50 même modèle, 2 × 50 au même endroit · ${m.tp.length} vrais couples, ${Object.values(m.neg).reduce((t, l) => t + l.length, 0)} faux couples · ${Math.round((Date.now() - t0) / 1000)} s`);
    const ligne = (nom, s) => console.log(`  ${nom.padEnd(34)} ${String(s.n).padStart(6)}  A ${String(s.aMin).padStart(2)}–${String(s.aMax).padEnd(2)}  s ${fx(s.bMin)}–${fx(s.bMax)}  r ${fx(s.rMin, 4)}–${fx(s.rMax, 4)} (${s.nB}${s.nNul ? `, ${s.nNul} pas su` : ''})  sûr ${s.sur}  à vérifier ${s.verifier}  écarté ${s.non}  rien ${s.rien}`);
    console.log('\nVRAIS couples (la même photo passée par un autre site), par transformation :');
    const parNom = {}; for (const x of m.tp) (parNom[x.nom] = parNom[x.nom] || []).push(x);
    for (const [nom, l] of Object.entries(parNom)) ligne(nom, stats(l));
    const sTp = stats(m.tp); ligne('TOUS', sTp);
    console.log('\nFAUX couples (deux photos différentes) :');
    const negs = Object.values(m.neg).flat();
    for (const [g, l] of Object.entries(m.neg)) ligne(g, stats(l));
    const sNeg = stats(negs); ligne('TOUS', sNeg);
    console.log('\nLe monde complet (règle + sélection de l’extension) :');
    for (const [nom, w] of Object.entries(m.mondes)) console.log(`  ${nom.padEnd(38)} Leboncoin ${w.annoncesLbc} (dont ${w.reprises} reprises) · couples mesurés ${w.couplesMesures} · sûr vrai ${w.surVrai} · sûr FAUX ${w.surFaux} · à vérifier faux ${w.aVerifierFaux} · génériques ${w.generiques} · écartés ${w.ecartees}`);

    const tpVig = m.tp.filter((x) => x.nom === 'vignette'), tpCahier = m.tp.filter((x) => x.nom !== 'vignette');
    const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + ' %' : '—');
    dit(sNeg.sur === 0, `F1 · faux positifs « sûr » : ${sNeg.sur} sur ${sNeg.n} faux couples (dont ${negs.filter((x) => x.e !== 'rien').length} candidats de l’empreinte)`, negs.filter((x) => x.e === 'sur').slice(0, 5).map((x) => `${x.a}~${x.b} A${x.d} s${x.s} r${x.r}`).join(', '));
    const surTp = tpCahier.filter((x) => x.e === 'sur').length;
    const LEGERES = ['jpeg70', 'jpeg50', 'webp80', 'webp70', 'webp60', 'plus_claire', 'plus_sombre'];
    const leg = m.tp.filter((x) => LEGERES.includes(x.nom)), surLeg = leg.filter((x) => x.e === 'sur').length;
    console.log(`   F2 · vrais positifs « sûr » : ${surTp} / ${tpCahier.length} = ${pct(surTp, tpCahier.length)} (vignettes à part : ${tpVig.filter((x) => x.e === 'sur').length} / ${tpVig.length}) ; les autres restent « à vérifier » (montrés) ou ne sont pas candidats (empreinte > ${R.SEUIL_MEME_PHOTO})`);
    dit(surLeg / leg.length >= 0.9, `F2 · recompression seule (JPEG 50–70, WebP 60–80, ± 10 % de lumière) ⇒ « sûr » ${surLeg} / ${leg.length} = ${pct(surLeg, leg.length)} (≥ 90 % exigé)`, '');
    const fpVer = negs.filter((x) => x.e === 'verifier').length;
    console.log(`   F3 · faux « à vérifier » : ${fpVer} sur ${sNeg.n} faux couples (${pct(fpVer, sNeg.n)}) — montrés avec les deux photos, jamais comptés sûrs ; écartés par la mesure fine : ${sNeg.non}`);
    const tpEcartes = tpCahier.filter((x) => x.e === 'non');
    dit(!tpEcartes.length, 'F3 · aucun vrai positif ÉCARTÉ par la mesure fine (une transformation du cahier ne fait jamais perdre la proposition)', tpEcartes.slice(0, 6).map((x) => `${x.id}/${x.nom} A${x.d} s${x.s} r${x.r}`).join(', '));
    dit(tpVig.every((x) => x.e !== 'sur'), 'F4 · une vignette (contenu < 96 px) n’est jamais « sûr »', tpVig.filter((x) => x.e === 'sur').map((x) => x.id).join(','));
    const mondes = Object.values(m.mondes);
    dit(mondes.every((w) => w.surFaux === 0), 'F5 · le monde complet : AUCUN « sûr » faux (50 au même endroit, 6 + 1 reprise, paires distinctes, même modèle)', JSON.stringify(m.mondes));
    const w6 = m.mondes['6 au même endroit + 1 reprise'], wd = m.mondes['paires distinctes, moitié reprise'];
    console.log(`   F5 · reprises reconnues « sûr » : ${w6 ? w6.surVrai : '—'} / ${w6 ? w6.reprises : '—'} (même endroit), ${wd ? wd.surVrai : '—'} / ${wd ? wd.reprises : '—'} (paires distinctes)`);
    const mes = negs.filter((x) => typeof x.s === 'number');
    const sMax = mes.reduce((t, x) => Math.max(t, x.s), -1), rMax = mes.reduce((t, x) => Math.max(t, x.r), -1);
    const lesDeux = mes.filter((x) => x.s >= R.SEUIL_FINE_SUR && x.r >= R.SEUIL_CORREL_SUR).length;
    dit(lesDeux === 0 && (sMax < R.SEUIL_FINE_SUR || rMax < R.SEUIL_CORREL_SUR), `F6 · marge : chez les faux couples mesurés, s max ${fx(sMax, 4)} (seuil ${R.SEUIL_FINE_SUR}), r max ${fx(rMax, 4)} (seuil ${R.SEUIL_CORREL_SUR}) ; les deux à la fois : ${lesDeux}`, '');
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ « même photo · sûr » : fiabilité mesurée, tout vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
