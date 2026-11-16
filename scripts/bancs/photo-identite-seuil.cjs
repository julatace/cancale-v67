// ════════════════════════════════════════════════════════════════════════
//  LA PHOTO IDENTIQUE COMME IDENTITÉ — LE SEUIL, MESURÉ (16 nov., lot photo-identite-sites).
//
//  Julien : « Vinted utilise ça pour éviter qu'on poste des doublons : il voit quand c'est
//  exactement la même photo, alors que quand je poste le même article avec des photos différentes,
//  ça passe ; je veux les mêmes méthodes que Vinted. » La même FAMILLE de méthode (on ne prétend
//  pas connaître l'algorithme interne de Vinted) : une empreinte perceptuelle d'une image
//  NORMALISÉE (niveaux de gris, petite taille fixe : dHash + pHash, src/photoEmpreinte.js), puis
//  une seconde mesure d'une autre nature sur les deux images (src/photoFine.js). « Sûr » (les deux
//  nettes, src/memePhoto.js `etatCouple`) devient une IDENTITÉ (src/photoIdentite.js) : il faut
//  donc qu'il ne se trompe JAMAIS sur une autre photo du même article.
//
//  Jeu INVENTÉ (aucune photo d'annonce réelle : le dépôt est public) — les paires dessinées de
//  scripts/bancs/_photos-inventees.cjs + les photos CC0 du mode exemple (public/exemple/) :
//    POSITIFS (la même photo reprise par un autre site) : JPEG 90 / 70 / 50, WebP 80 / 60,
//      réduite de 25 % et de 50 %, plus claire de 10 %, la chaîne « moitié + JPEG 60 + WebP 60 »,
//      ET le même fichier JPEG AVEC des métadonnées (un segment EXIF ajouté) / SANS aucune
//      (en-tête JFIF retiré) — les métadonnées ne touchent pas les pixels ;
//    NÉGATIFS (une autre photo du même article) : `BANC_FAMILLE` exemplaires du même modèle
//      photographiés différemment, et autant photographiés AU MÊME ENDROIT (même fond, même
//      lumière, ± 15 px, ± 2°) — l'original ET la copie « autre site » de chacun.
//   I1  aucun négatif n'est « sûr » (donc aucune identité fausse) — obligatoire ;
//   I2  métadonnées ajoutées / retirées ⇒ distance 0 et « sûr », toujours ;
//   I3  recompression seule (JPEG 50–90, WebP 60–80, ± 10 % de lumière) ⇒ « sûr » ≥ 95 % ;
//   I4  la marge : le meilleur score d'un négatif reste sous le seuil « sûr » (s ET r), imprimée.
//  Il imprime les distances observées (A : empreinte 0–96 ; s, r : la seconde mesure).
//  `--mutation=une` (« sûr » sur l'empreinte seule, sans la seconde mesure) doit rendre I1 ROUGE.
//  `--src chemin` : un autre arbre. Lancer :
//    node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/photo-identite-seuil.cjs
//  (`BANC_PAIRES` paires dessinées, 12 par défaut ; `BANC_FAMILLE` exemplaires, 12 par défaut.)
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RACINE = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', '..'); })();
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const NPAIRES = Number(process.env.BANC_PAIRES || 12);
const NFAM = Math.max(6, Number(process.env.BANC_FAMILLE || 12));
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const lire = (f) => (fs.existsSync(path.join(RACINE, f)) ? fs.readFileSync(path.join(RACINE, f), 'utf8') : '');
const module_ = (t) => t.replace(/^import [^\n]*\n/gm, '').replace(/^export /gm, '');
const FINE = module_(lire('src/photoFine.js'));
let MEME = module_(lire('src/memePhoto.js'));
if (!FINE || !/function etatCouple/.test(MEME)) { console.log('❌ I0 · pas de deuxième mesure dans cet arbre : « sûr » n’existe pas'); process.exit(1); }
if (MUT === 'une') {
  const avant = MEME;
  MEME = MEME.replace("  const v = verdictFin(mesure);\n", "  const v = verdictFin(mesure);\n  if (typeof distance === 'number' && distance <= SEUIL_EMPREINTE_SUR) return 'sur';\n");
  if (MEME === avant) { console.log('❓ mutation une : texte introuvable'); process.exit(2); }
}
const GEN = require('./_photos-inventees.cjs').SOURCE.replace(/getContext\('2d'\)/g, "getContext('2d', { willReadFrequently: true })");
const PAGE = `<!doctype html><meta charset="utf-8"><body><script>
${module_(lire('src/photoEmpreinte.js'))}
${FINE}
${MEME}
${GEN}
async function empA(img) { const n = COTE_EMPREINTE; const c = document.createElement('canvas'); c.width = n; c.height = n; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, n, n); return empreinteDepuisPixels(x.getImageData(0, 0, n, n).data, n, n); }
function prep(img) { const t = tailleLectureFine(img.width, img.height); const c = document.createElement('canvas'); c.width = t.w; c.height = t.h; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, t.w, t.h); return preparerFine(x.getImageData(0, 0, t.w, t.h).data, t.w, t.h); }
const sign = async (img) => ({ h: await empA(img), p: prep(img) });
function couple(a, b) {
  const d = distanceEmpreintes(a.h, b.h);
  const cand = d != null && d <= SEUIL_MEME_PHOTO;
  const m = cand ? comparerFine(a.p, b.p) : undefined;
  return { d, s: m ? m.s : null, r: m ? m.r : null, e: cand ? etatCouple(d, m) : 'rien' };
}
// Le MÊME fichier JPEG, octets modifiés : + un segment EXIF (APP1) après SOI, ou sans aucun en-tête (APP0 retiré).
async function octetsJpeg(c, q) { const u = c.toDataURL('image/jpeg', q); const b = atob(u.split(',')[1]); const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
function segments(o) { const out = []; let i = 2; while (i + 4 <= o.length && o[i] === 0xFF && o[i + 1] !== 0xDA) { const L = (o[i + 2] << 8) | o[i + 3]; out.push({ m: o[i + 1], de: i, a: i + 2 + L }); i += 2 + L; } return { segs: out, reste: i }; }
function avecExif(o) {
  const tiff = [0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x31, 0x00, 0x02, 0x00, 0x00, 0x00, 0x04, 0x56, 0x52, 0x4D, 0x00, 0x00, 0x00, 0x00, 0x00];
  const corps = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff, ...Array.from({ length: 400 }, (_, i) => (i * 37) & 0x7F)];
  const L = corps.length + 2; const seg = [0xFF, 0xE1, L >> 8, L & 0xFF, ...corps];
  const n = new Uint8Array(o.length + seg.length); n.set(o.subarray(0, 2), 0); n.set(seg, 2); n.set(o.subarray(2), 2 + seg.length); return n;
}
function sansMeta(o) {
  const { segs } = segments(o); const garde = [o.subarray(0, 2)]; let fin = 2;
  for (const s of segs) { if (!(s.m >= 0xE0 && s.m <= 0xEF) && s.m !== 0xFE) garde.push(o.subarray(s.de, s.a)); fin = s.a; }
  garde.push(o.subarray(fin)); const n = new Uint8Array(garde.reduce((t, x) => t + x.length, 0)); let k = 0; for (const x of garde) { n.set(x, k); k += x.length; } return n;
}
async function depuisOctets(o) { const url = URL.createObjectURL(new Blob([o], { type: 'image/jpeg' })); const i = await charge(url); return i; }
const source = async (id, REELS) => (id[0] === 'P' ? photo(paire(Number(id.slice(1)) + 300), vueDe(Number(id.slice(1)) + 300, 0)) : charge(REELS[Number(id.slice(1))]));
window.__positifs = async (ids, REELS) => {
  const out = [];
  for (const id of ids) {
    let c = await source(id, REELS); if (!c.toDataURL) c = versCanvas(c, c.width, c.height);
    const brut = await octetsJpeg(c, 0.9);
    const o = await sign(await depuisOctets(brut));
    const T = await transformations(c);
    const essais = { exif: await depuisOctets(avecExif(brut)), sans_meta: await depuisOctets(sansMeta(brut)), jpeg70: T.jpeg70, jpeg50: T.jpeg50, webp80: T.webp80, webp60: T.webp60,
      plus_claire: T.plus_claire, plus_sombre: T.plus_sombre, reduite25: T.reduite25, reduite50: T.reduite50, cdn: T.cdn };
    for (const [nom, im] of Object.entries(essais)) out.push(Object.assign({ id, nom, octetsExif: nom === 'exif' ? avecExif(brut).length - brut.length : 0 }, couple(o, await sign(im))));
  }
  return out;
};
const FAMILLES = { 'meme-modele': (i) => photo(paire(5), vueDe(5, i)), 'meme-endroit': (i) => photo(paire(5), vueStudio(5, i)) };
window.__negatifs = async (g, n) => {
  const L = [];
  for (let i = 0; i < n; i++) { const T = await transformations(FAMILLES[g](i)); L.push({ o: await sign(T.jpeg90), c: await sign(T.cdn) }); }
  const out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) { if (i < j) out.push(Object.assign({ g, sorte: 'original' }, couple(L[i].o, L[j].o))); out.push(Object.assign({ g, sorte: 'copie' }, couple(L[i].o, L[j].c))); }
  return out;
};
window.__regles = () => ({ SEUIL_MEME_PHOTO, SEUIL_EMPREINTE_SUR, SEUIL_FINE_SUR, SEUIL_CORREL_SUR, SEUIL_FINE_NON });
</script>`;

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const ex = path.join(RACINE, 'public', 'exemple');
  const reels = fs.existsSync(ex) ? fs.readdirSync(ex).filter((f) => f.endsWith('-400.webp')).sort().map((f) => '/ex/' + f) : [];
  const t0 = Date.now();
  const tache = async (fn, args) => {
    const page = await nav.newPage({ locale: 'fr-FR' });
    page.setDefaultTimeout(0);
    try {
      await page.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.pathname.startsWith('/ex/')) return r.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.join(ex, path.basename(u.pathname))) }); return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }); });
      await page.goto('http://localhost/seuil');
      return await page.evaluate(([f, a]) => window[f](...a), [fn, args]);
    } finally { await page.close().catch(() => {}); }
  };
  try {
    const ids = [...Array.from({ length: NPAIRES }, (_, i) => 'P' + i), ...reels.map((_, i) => 'R' + i)];
    const R = await tache('__regles', []);
    const pos = [];
    for (let i = 0; i < ids.length; i += 6) pos.push(...await tache('__positifs', [ids.slice(i, i + 6), reels]));
    const neg = [...await tache('__negatifs', ['meme-modele', NFAM]), ...await tache('__negatifs', ['meme-endroit', NFAM])];
    const plage = (l, k) => { const v = l.map((x) => x[k]).filter((x) => typeof x === 'number'); return v.length ? `${Math.min(...v)}–${Math.max(...v)}` : '—'; };
    console.log(`Règles : A ≤ ${R.SEUIL_MEME_PHOTO} candidat, « sûr » = A ≤ ${R.SEUIL_EMPREINTE_SUR} ET s ≥ ${R.SEUIL_FINE_SUR} ET r ≥ ${R.SEUIL_CORREL_SUR} ; écarté si s < ${R.SEUIL_FINE_NON}`);
    console.log(`\nPOSITIFS (la même photo reprise) — ${ids.length} photos (${NPAIRES} dessinées + ${reels.length} CC0)`);
    console.log('transformation   n   A        s              r                sûr   à vérifier  écarté  pas candidat');
    const noms = [...new Set(pos.map((x) => x.nom))];
    for (const nom of noms) {
      const l = pos.filter((x) => x.nom === nom);
      const c = (e) => l.filter((x) => x.e === e).length;
      console.log(`${nom.padEnd(16)} ${String(l.length).padStart(2)}  ${plage(l, 'd').padEnd(8)} ${plage(l, 's').padEnd(14)} ${plage(l, 'r').padEnd(16)} ${String(c('sur')).padStart(3)}   ${String(c('verifier')).padStart(5)}       ${String(c('non')).padStart(3)}     ${String(c('rien')).padStart(3)}`);
    }
    console.log(`\nNÉGATIFS (une autre photo du même article) — ${NFAM} exemplaires par famille`);
    for (const g of ['meme-modele', 'meme-endroit']) for (const sorte of ['original', 'copie']) {
      const l = neg.filter((x) => x.g === g && x.sorte === sorte); const c = (e) => l.filter((x) => x.e === e).length;
      console.log(`${(g + ' / ' + sorte).padEnd(26)} n ${String(l.length).padStart(4)}  A ${plage(l, 'd').padEnd(7)} s ${plage(l, 's').padEnd(13)} r ${plage(l, 'r').padEnd(15)} sûr ${c('sur')} · à vérifier ${c('verifier')} · écarté ${c('non')} · rien ${c('rien')}`);
    }
    const fauxSurs = neg.filter((x) => x.e === 'sur');
    dit(fauxSurs.length === 0, `I1 · aucune autre photo du même article n'est « sûr » (${neg.length} couples négatifs)`, fauxSurs.length ? `${fauxSurs.length} faux « sûr » : ${JSON.stringify(fauxSurs.slice(0, 3))}` : '');
    const meta = pos.filter((x) => x.nom === 'exif' || x.nom === 'sans_meta');
    dit(meta.length > 0 && meta.every((x) => x.d === 0 && x.e === 'sur'), `I2 · métadonnées ajoutées (EXIF, +${(pos.find((x) => x.nom === 'exif') || {}).octetsExif || 0} octets) ou retirées ⇒ distance 0 et « sûr » (${meta.length})`,
      JSON.stringify(meta.filter((x) => !(x.d === 0 && x.e === 'sur')).slice(0, 3)));
    const recomp = pos.filter((x) => ['jpeg70', 'jpeg50', 'webp80', 'webp60', 'plus_claire', 'plus_sombre'].includes(x.nom));
    const taux = recomp.filter((x) => x.e === 'sur').length / Math.max(1, recomp.length);
    dit(taux >= 0.95, `I3 · recompression seule ⇒ « sûr » ${(taux * 100).toFixed(1)} % (${recomp.filter((x) => x.e === 'sur').length}/${recomp.length}) ; jamais écartée : ${recomp.filter((x) => x.e === 'non').length}`);
    const mes = neg.filter((x) => typeof x.s === 'number');
    const sMax = mes.length ? Math.max(...mes.map((x) => x.s)) : null, rMax = mes.length ? Math.max(...mes.map((x) => x.r)) : null;
    const lesDeux = mes.filter((x) => x.s >= R.SEUIL_FINE_SUR && x.r >= R.SEUIL_CORREL_SUR).length;
    dit(lesDeux === 0, `I4 · marge : chez les ${mes.length} négatifs mesurés finement, s ≤ ${sMax} (seuil ${R.SEUIL_FINE_SUR}), r ≤ ${rMax} (seuil ${R.SEUIL_CORREL_SUR}) ; les deux au-dessus : ${lesDeux}`);
    console.log(`\n(${Math.round((Date.now() - t0) / 1000)} s)`);
  } catch (e) { dit(false, 'banc', e && e.stack); }
  await nav.close();
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ photo-identite-seuil : tout vert');
  process.exit(ko ? 1 : 0);
})();
