// ═════════════════════════════════════════════════════════════════════════
//  LA PHOTO IDENTIQUE EST UNE IDENTITÉ (16 nov., lot photo-identite-sites)
//
//  Julien : « quand je poste la paire sur Leboncoin et Vinted sans passer par VRM, VRM la
//  reconnaît parce que la photo utilisée est exactement la même — pas les autres caractéristiques ».
//  Règles exécutées : src/memePhoto.js (propositions, « sûr ») puis src/photoIdentite.js (identité)
//  puis la VRAIE règle « vendue sur Vinted ⇒ à retirer de Leboncoin » d'App.jsx (vm). Images
//  INVENTÉES (un nom ⇒ des pixels, comme audit-meme-photo) : le dépôt est public.
//   P1  même photo Vinted (N°124) / Leboncoin, les deux mesures « sûr » ⇒ l'annonce Leboncoin PORTE
//       le N°124 (identité, sans aucun geste) ; elle sort de « à relier » et passe dans « reconnues » ;
//       la fiche N°124 la voit (« aussi sur Leboncoin ») ;
//   P2  même titre, même taille, AUTRE photo ⇒ rien (ni identité, ni proposition) ;
//   P3  la même photo sur DEUX paires (N°300, N°301) ⇒ rien n'est déduit, l'ambiguïté est dite
//       (« Même photo sur N°300 et N°301 : laquelle ? ») ;
//   P4  une photo générique (sur 3 paires distinctes) ⇒ rien ;
//   P5  une empreinte seulement PROCHE (« à vérifier » : une seule mesure, ou la seconde entre ses
//       seuils) ⇒ PAS une identité : une proposition, son toucher relie ;
//   P6  ses décisions gagnent : un lien posé, un « délier » (valeur vide), un « ce n'est pas la même »,
//       « pas de paire » ⇒ la photo ne relie rien ; Vestiaire : une annonce qui a déjà un N° VRM n'en
//       change pas (proposition), sans N° ⇒ identité ; eBay (une seule mesure) ⇒ jamais ;
//   P7  « pas su » : empreintes non lues ⇒ aucune identité, les liens restent les siens ;
//   P8  50 paires identiques photographiées différemment ⇒ 0 identité ; la seule reprise ⇒ la bonne ;
//   P9  anti double vente : N°124 VENDUE sur Vinted (preuve) ⇒ l'annonce Leboncoin reconnue par la
//       photo est « à retirer » (la vraie règle d'App.jsx) ; sans la photo ⇒ rien ;
//   S1  l'app : l'identité par la photo n'est JAMAIS écrite (aucun `save`/`ecrireCopieLocale` des liens
//       lus) ; les gestes (relier, délier, refuser) partent des liens POSÉS ; le calcul au démarrage ne
//       lance pas l'écriture eBay ; les lecteurs d'identité (N°, à retirer, ventes croisées) lisent les
//       liens AVEC la photo ; les identités sont celles du compte connecté.
//  `--src chemin` : un autre arbre (preuve sur le code d'avant). `--mutation=<nom>|toutes`.
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const MUTATIONS = {
  proche: ['src/photoIdentite.js', "if (!p || p.etat !== 'sur' ||", "if (!p ||"],
  ambigu: ['src/memePhoto.js', "if (paires.length >= 2) { ambigus.push({ id, annonce: c.a, raison: 'deux-paires', paires }); continue; }", ''],
  generique: ['src/memePhoto.js', 'if (annoncesVues.size + 1 > GENERIQUE_ANNONCES || paires.size >= GENERIQUE_PAIRES) { nGeneriques++; continue; }', ''],
  manuel: ['src/photoIdentite.js', "for (const [id, n] of Object.entries(p)) if (!Object.prototype.hasOwnProperty.call(m, id) && plein(n)) out[id] = n;", "for (const [id, n] of Object.entries(p)) if (plein(n)) out[id] = n;"],
  delier: ['src/photoIdentite.js', "      if (Object.prototype.hasOwnProperty.call(LL, id)) continue;          // son lien, ou son « délier »\n", "      if (plein(LL[id])) continue;\n"],
  vcnumero: ['src/photoIdentite.js', "      if (plein(NV[id])) continue;                                         // un N° déjà donné : jamais changé tout seul\n", ''],
  ebay: ['src/photoIdentite.js', "export const SITES_IDENTITE_PHOTO = ['Leboncoin', 'Vestiaire'];", "export const SITES_IDENTITE_PHOTO = ['Leboncoin', 'Vestiaire', 'eBay'];"],
  passu: ['src/photoIdentite.js', "  if (!res || !res.lu) return out;\n  out.lu = true;", "  if (!res) return out;\n  out.lu = true;"],
  sansReconnues: ['src/photoIdentite.js', "  const propositions = arr(res.propositions).filter((p) => !ids.has(cleA(p)));", "  const propositions = arr(res.propositions);"],
  ecrit: ['src/App.jsx', '    poserIdentitesPhoto(ident.lu ? { ...ident, owner } : null);\n', "    poserIdentitesPhoto(ident.lu ? { ...ident, owner } : null);\n    if (ident.lu) save('vrm_lbc_liens', liensLbcAvecPhoto(load('vrm_lbc_liens', {}) || {}, ident));\n"],
  demarrageEbay: ['src/App.jsx', "chargerMemePhoto(false,{ sansEbay:true });", 'chargerMemePhoto(false);'],
  lecteurs: ['src/App.jsx', "const liensR=liensLbcLus();", "const liensR=load('vrm_lbc_liens',{})||{};"],
  compte: ['src/App.jsx', "return i && i.owner && i.owner === AUTH.user?.id ? i : null;", 'return i;'],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : MUT.split(',');
  let rouges = 0;
  for (const nom of noms) {
    const [f, avant, apres] = MUTATIONS[nom] || [];
    if (!f) { console.log(`❓ mutation inconnue : ${nom}`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-photo-identite-'));
    for (const d of ['src', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules/.test(s) });
    const cible = path.join(tmp, f); const t = fs.readFileSync(cible, 'utf8');
    if (!t.includes(avant)) { console.log(`❓ ${nom} : texte introuvable`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(cible, t.replace(avant, apres));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'audit-photo-identite.cjs'), '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0; if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' — ' + (r.stdout.split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 140) : ''}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${rouges}/${noms.length} mutations rouges`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 300)}`); };
function pixels(nom, w = 64, h = w) {
  const base = String(nom).replace(/~.*$/, '');
  let s = 0; for (const c of base) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const px = new Uint8ClampedArray(w * h * 4);
  const blocs = Array.from({ length: 64 }, () => Math.floor(r() * 255));
  const bruit = /~bruit/.test(nom);
  let t = 7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = blocs[Math.floor((y * 8) / h) * 8 + Math.floor((x * 8) / w)];
    if (bruit) { t = (t * 1103515245 + 12345) >>> 0; v = Math.max(0, Math.min(255, v + ((t >>> 16) % 7) - 3)); }
    const k = (y * w + x) * 4; px[k] = v; px[k + 1] = v; px[k + 2] = v; px[k + 3] = 255;
  }
  return px;
}
function extraire(src, nom) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom}\\s*=\\s*`, 'm');
  const m = re.exec(src); if (!m) throw new Error(`« ${nom} » introuvable`);
  let i = m.index, prof = 0, vu = false; const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) { const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vu = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vu && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1); }
  throw new Error(`fin de « ${nom} » introuvable`);
}

(async () => {
  if (!fs.existsSync(path.join(RACINE, 'src', 'photoIdentite.js'))) { dit(false, 'P0 · src/photoIdentite.js absent : la photo identique n’est pas une identité (proposition seulement)'); console.log(`\n❌ ${ko} contrôle(s) rouge(s)`); process.exit(1); }
  try {
    const R = await import(path.join(RACINE, 'src', 'photoEmpreinte.js'));
    const M = await import(path.join(RACINE, 'src', 'memePhoto.js'));
    const F = await import(path.join(RACINE, 'src', 'photoFine.js'));
    const I = await import(path.join(RACINE, 'src', 'photoIdentite.js'));
    const H = (nom) => R.empreinteDepuisPixels(pixels(nom), 64, 64);
    const cle = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
    const uV = (n) => `https://images1.vinted.net/t/${n}/f800/1.webp`;
    const uL = (n) => `https://img.leboncoin.fr/api/v1/lbcpb1/images/${n}.jpg?rule=ad-large`;
    const SUR = { s: 0.93, r: 0.9996 }, DOUTE = { s: 0.7, r: 0.995 };
    const COURT = { Leboncoin: 'lbc', Vestiaire: 'vc', eBay: 'ebay' };
    const monde = () => {
      const m = { vinted: [], ev: { 111: {}, 222: {} }, autres: [], es: { Leboncoin: {}, eBay: {}, Vestiaire: {} }, verifs: {} };
      m.v = (id, compte, numero, photo, titre = 'Nike Air Max 90 blanche 42') => { m.vinted.push({ id: String(id), compte: String(compte), numero, titre, photo: uV(photo), lien: 'https://www.vinted.fr/items/' + id }); m.ev[compte][id] = { ...(m.ev[compte][id] || {}), [uV(photo)]: H(photo) }; };
      // `fine` : la seconde mesure posée sur le couple (photo d'ailleurs × photo Vinted de même NOM de base).
      m.autre = (plateforme, id, photos, o = {}) => {
        const { fine, ...rest } = o;
        m.autres.push({ plateforme, id: String(id), compte: 'c1', titre: 'Nike Air Max 90 blanche 42', photo: photos[0] ? uL(photos[0]) : null, relie: false, numero: '', ...rest });
        if (photos.length) m.es[plateforme][id] = Object.fromEntries(photos.map((p) => [uL(p), H(p)]));
        if (fine) for (const p of photos) for (const a of m.vinted) for (const k of Object.keys(m.ev[a.compte][a.id] || {})) if (k.includes('/' + p.replace(/~.*$/, '') + '/') || k.includes('/' + p.replace(/~.*$/, '').replace(/~.*/, '') + '~')) m.verifs[F.cleCoupleFin(COURT[plateforme], String(id), uL(p), a.compte, a.id, k)] = fine;
      };
      return m;
    };
    const calc = (m, o = {}) => M.propositionsMemePhoto({ vinted: m.vinted, autres: m.autres, empreintes: o.null ? null : { vinted: m.ev, ...m.es }, refus: o.refus || {}, numerosDouteux: o.douteux || null, cle, verifs: o.sansFine ? null : m.verifs });
    const ident = (res, o = {}) => I.identitesParPhoto(res, { liensLbc: o.liensLbc || {}, liensVc: o.liensVc || {}, numerosVc: o.numerosVc || {}, cle });

    // ── P1 ──
    let P1 = null;
    { const m = monde(); m.v(1001, 111, '124', 'paire-124'); m.v(1002, 111, '125', 'paire-125');
      m.autre('Leboncoin', 5001, ['paire-124~bruit'], { fine: SUR });
      const res = calc(m); const id = ident(res); P1 = { m, res, id };
      const liens = I.liensLbcAvecPhoto({}, id);
      dit(res.propositions.length === 1 && res.propositions[0].etat === 'sur' && id.Leboncoin['5001'] === '124' && liens['5001'] === '124' && id.liste.length === 1,
        'P1 · même photo Vinted N°124 / Leboncoin, deux mesures « sûr » ⇒ l’annonce Leboncoin porte N°124 (identité, aucun geste)', JSON.stringify({ p: res.propositions.map((p) => [p.numero, p.etat]), id: id.Leboncoin }));
      const vu = I.avecIdentites(res, id);
      dit(vu.propositions.length === 0 && vu.reconnues.length === 1 && vu.nARelier === 0 && (vu.reconnuesParNumero.get('124') || []).length === 1 && !vu.parNumero.get('124'),
        'P1 · elle sort de « à relier » (0) et passe dans « reconnues » ; la fiche N°124 la voit (« aussi sur Leboncoin »)', JSON.stringify({ p: vu.propositions.length, r: (vu.reconnues || []).length, n: vu.nARelier })); }

    // ── P2 ──
    { const m = monde(); m.v(1001, 111, '124', 'paire-124');
      m.autre('Leboncoin', 5002, ['paire-124-autre-prise-de-vue'], { fine: SUR });
      const res = calc(m); const id = ident(res);
      dit(res.propositions.length === 0 && res.ambigus.length === 0 && id.liste.length === 0, 'P2 · même titre, même taille, AUTRE photo ⇒ rien (ni identité, ni proposition)', JSON.stringify({ p: res.propositions.length, a: res.ambigus.length })); }

    // ── P3 ──
    { const m = monde(); m.v(1010, 222, '300', 'boite-partagee'); m.v(1011, 111, '301', 'boite-partagee~bruit');
      m.autre('Leboncoin', 5003, ['boite-partagee'], { fine: SUR });
      const res = calc(m); const id = ident(res);
      const a = res.ambigus[0];
      dit(id.liste.length === 0 && !res.propositions.length && a && a.raison === 'deux-paires' && a.paires.map((p) => p.numero).sort().join() === '300,301',
        'P3 · la même photo sur deux N° (300, 301) ⇒ rien n’est déduit, ambigu (les deux montrées)', JSON.stringify({ id: id.liste, a: res.ambigus.map((x) => x.paires.map((p) => p.numero)) }));
      const fr = await import(path.join(RACINE, 'src', 'i18n', 'langues', 'fr', 'memePhoto.js'));
      const t = (fr.default || {})['memePhoto.memeSurNumeros'];
      const jsx = fs.readFileSync(path.join(RACINE, 'src', 'MemePhoto.jsx'), 'utf8');
      const phrase = typeof t === 'string' ? t.replace('{numeros}', 'N°300').replace('{dernier}', 'N°301') : '';
      dit(phrase === 'Même photo sur N°300 et N°301 : laquelle ?' && /memePhoto\.memeSurNumeros/.test(jsx) && /data-mph-phrase-ambigu/.test(jsx) && ['en', 'es', 'it', 'de'].every((L) => fs.readFileSync(path.join(RACINE, 'src', 'i18n', 'langues', L, 'memePhoto.js'), 'utf8').includes('"memePhoto.memeSurNumeros"')),
        'P3 · c’est dit : « Même photo sur N°300 et N°301 : laquelle ? » (5 langues)', phrase); }

    // ── P4 ──
    { const m = monde();
      for (let i = 0; i < 3; i++) m.v(1100 + i, 111, String(400 + i), 'fond-boutique' + (i ? '~bruit' + i : ''));
      m.autre('Leboncoin', 5004, ['fond-boutique'], { fine: SUR });
      const res = calc(m); const id = ident(res);
      dit(id.liste.length === 0 && !res.propositions.length && !res.ambigus.length && res.nGeneriques >= 1, 'P4 · photo générique (même image sur 3 paires distinctes) ⇒ rien', JSON.stringify({ p: res.propositions.length, a: res.ambigus.length, g: res.nGeneriques })); }

    // ── P5 ──
    { const m = monde(); m.v(1001, 111, '124', 'paire-124');
      m.autre('Leboncoin', 5005, ['paire-124~bruit']);                  // aucune seconde mesure
      m.autre('Leboncoin', 5006, ['paire-124~bruit'], { fine: DOUTE });  // seconde mesure entre ses seuils
      const res = calc(m); const id = ident(res);
      const p5 = res.propositions.find((p) => p.annonce.id === '5005'), p6 = res.propositions.find((p) => p.annonce.id === '5006');
      dit(id.liste.length === 0 && p5 && p5.etat === 'verifier' && p6 && p6.etat === 'verifier' && I.avecIdentites(res, id).propositions.length === 2,
        'P5 · empreinte seulement proche (une mesure, ou la seconde « doute ») ⇒ PAS une identité : une proposition, son toucher relie', JSON.stringify({ id: id.liste, p: res.propositions.map((p) => [p.annonce.id, p.etat]) })); }

    // ── P6 ──
    { const { res } = P1;
      const a = ident(res, { liensLbc: { 5001: '77' } }), b = ident(res, { liensLbc: { 5001: '' } });
      dit(!a.Leboncoin['5001'] && I.liensLbcAvecPhoto({ 5001: '77' }, ident(res))['5001'] === '77' && !b.Leboncoin['5001'] && I.liensLbcAvecPhoto({ 5001: '' }, ident(res))['5001'] === '',
        'P6 · son lien posé (N°77) gagne ; son « délier » (valeur vide) n’est jamais refait par la photo', JSON.stringify({ a: a.Leboncoin, b: b.Leboncoin, l: I.liensLbcAvecPhoto({ 5001: '' }, ident(res)) }));
      const m = P1.m; const refus = { [M.cleRefusMemePhoto('Leboncoin', '5001', '124', cle)]: '2026-11-16' };
      dit(ident(calc(m, { refus })).liste.length === 0, 'P6 · « Ce n’est pas la même » ⇒ plus d’identité pour ce couple');
      const m2 = monde(); m2.v(1001, 111, '124', 'paire-124'); m2.autre('Leboncoin', 5007, ['paire-124~bruit'], { fine: SUR, relie: true, numero: '' });
      dit(ident(calc(m2)).liste.length === 0, 'P6 · « pas de paire » / déjà relié par identité (relie) ⇒ la photo ne relie rien');
      const m3 = monde(); m3.v(1001, 111, '124', 'paire-124'); m3.v(1002, 111, '125', 'paire-125');
      m3.autre('Vestiaire', 'vc-1', ['paire-124~bruit'], { fine: SUR }); m3.autre('Vestiaire', 'vc-2', ['paire-125~bruit'], { fine: SUR });
      const r3 = calc(m3); const i3 = ident(r3, { numerosVc: { 'vc-2': '9' } });
      dit(i3.Vestiaire['vc-1'] && i3.Vestiaire['vc-1'].numero === '124' && i3.Vestiaire['vc-1'].item === '1001' && !i3.Vestiaire['vc-2'] && I.avecIdentites(r3, i3).propositions.some((p) => p.annonce.id === 'vc-2'),
        'P6 · Vestiaire : sans N° ⇒ identité (N°124, son annonce Vinted) ; déjà N°9 donné par VRM ⇒ jamais changé tout seul (proposition)', JSON.stringify(i3.Vestiaire));
      dit(I.liensVcAvecPhoto({}, i3)['vc-1'] && !I.liensVcAvecPhoto({ 'vc-1': { numero: '50', item: '7' } }, i3)['vc-1'].par, 'P6 · Vestiaire : ses liens gagnent sur la photo');
      const m4 = monde(); m4.v(1001, 111, '124', 'paire-124'); m4.autre('eBay', '2001', ['paire-124~bruit'], { fine: SUR });
      const r4 = calc(m4); const i4 = ident(r4);
      dit(i4.liste.length === 0 && r4.propositions.length === 1, 'P6 · eBay (une seule mesure possible) ⇒ jamais une identité, une proposition', JSON.stringify(i4.liste)); }

    // ── P7 ──
    { const { m } = P1; const res = calc(m, { null: true }); const id = ident(res);
      dit(!id.lu && id.liste.length === 0 && I.liensLbcAvecPhoto({ 9: '3' }, id)['9'] === '3' && !I.liensLbcAvecPhoto({ 9: '3' }, id)['5001'] && I.liensLbcAvecPhoto({ 9: '3' }, null)['9'] === '3',
        'P7 · empreintes pas lues ⇒ aucune identité par la photo, ses liens restent les siens', JSON.stringify(id)); }

    // ── P8 ──
    { const m = monde(); m.v(1001, 111, '124', 'paire-124');
      for (let i = 0; i < 50; i++) m.v(3000 + i, i % 2 ? 111 : 222, String(200 + i), `jordan1-chicago-42-vue-${i}`, 'Jordan 1 Chicago 42');
      for (let i = 0; i < 50; i++) m.autre(['Leboncoin', 'Vestiaire'][i % 2], 6000 + i, [`jordan1-chicago-42-vue-${50 + i}`], { titre: 'Jordan 1 Chicago 42', fine: SUR });
      const r = calc(m); const id = ident(r);
      dit(id.liste.length === 0 && r.propositions.length === 0, 'P8 · 50 paires identiques (même titre, taille, prix) photographiées différemment ⇒ 0 identité', JSON.stringify(id.liste.slice(0, 3)));
      m.autre('Leboncoin', 6999, ['jordan1-chicago-42-vue-17~bruit'], { titre: 'Jordan 1 Chicago 42', fine: SUR });
      const id2 = ident(calc(m));
      dit(id2.liste.length === 1 && id2.Leboncoin['6999'] === '217', 'P8 · parmi les 50, la seule à la même photo ⇒ N°217, aucune autre', JSON.stringify(id2.liste.map((x) => [x.id, x.numero]))); }

    // ── P9 : la vraie règle « vendue sur Vinted ⇒ à retirer de Leboncoin » d'App.jsx ──
    { require(path.join(RACINE, 'scripts', '_source-app.cjs')).brancher();
      const APP = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
      const noms = ['cleNum', 'refVRMDe', 'NUM_OK', 'marqueurNumerotation', 'archiveNumeros', 'coupureNumerotation', 'numeroExterne', 'numeroLbcIdentite', 'LBC_PAUSE_INDEX_MS', 'lbcSortieDe', 'LBC_ANNONCE_MORTE', 'annonceLbcEnVente', 'numDeTitreLbc', 'clesAnnonceLbc', 'idCompteLbcApp', 'lbcEnLigneProuvee', 'lbcIdentiteSortie', 'aRetirerDeLbcVinted'];
      const enLigne = fs.readFileSync(path.join(RACINE, 'src', 'enLigneLbc.js'), 'utf8').replace(/^export /gm, '');
      const code = 'const load = (k, d) => d;\nconst numeroEcritLbc = () => ""; const numeroEcritActif = () => false;\n' + enLigne + '\n' + noms.map((n) => extraire(APP, n)).join('\n') + '\n;this.R = { aRetirerDeLbcVinted };';
      const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx);
      const at = new Date(Date.now() - 3600e3).toISOString();
      const items = { 5001: { id: '5001', subject: 'Nike Air Max 90 blanche 42', status: 'active', account: 'compte', seenAt: new Date(Date.now() - 7200e3).toISOString(), url: 'https://www.leboncoin.fr/ad/chaussures/5001', price: 60 } };
      const base = { posted: [], numeros: { 1001: { numero: '124', title: 'Nike Air Max 90 blanche 42' } }, enLigne: new Set(), vendus: new Set(['1001']), itemsLbc: items, vendusLbc: new Set(), sortis: new Set(), lectures: { compte: { at, total: 1, n: 1, ids: ['5001'] } } };
      const avec = ctx.R.aRetirerDeLbcVinted({ ...base, liens: I.liensLbcAvecPhoto({}, P1.id) });
      const sans = ctx.R.aRetirerDeLbcVinted({ ...base, liens: {} });
      dit(Array.isArray(avec) && avec.length === 1 && avec[0].numero === '124' && avec[0].lbcId === '5001' && Array.isArray(sans) && sans.length === 0,
        'P9 · N°124 vendue sur Vinted (preuve) ⇒ l’annonce Leboncoin reconnue par la photo est « à retirer » ; sans la photo ⇒ rien', JSON.stringify({ avec, sans })); }

    // ── S1 : l'app ──
    { const APP = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
      const ch = /async function chargerMemePhoto[\s\S]*?\n}\n/.exec(APP);
      dit(!!ch && /identitesParPhoto\(res, \{ liensLbc: load\('vrm_lbc_liens', \{\}\) \|\| \{\}/.test(ch[0]) && /poserIdentitesPhoto\(/.test(ch[0]) && !/\bsave\(|ecrireCopieLocale\(|method: 'POST'/.test(ch[0].replace(/empreintesEbayPage[^\n]*\n/, '')),
        'S1 · l’identité par la photo est calculée depuis SES liens posés et jamais écrite (aucun save, copie locale ni POST dans le calcul)');
      dit(!/(save|ecrireCopieLocale|vcPoser)\([^)\n]*liens(Lbc|Vc)Lus\(\)/.test(APP) && !/(save|ecrireCopieLocale|vcPoser)\([^)\n]*avecPhotoLbc/.test(APP),
        'S1 · les liens LUS (avec la photo) ne sont jamais réécrits');
      const rel = /async function relierParPhoto[\s\S]*?\n}\n/.exec(APP);
      dit(!!rel && !/liensLbcLus|liensVcLus/.test(rel[0]) && /load\('vrm_lbc_liens', \{\}\)/.test(rel[0]), 'S1 · relier part des liens POSÉS (jamais de la photo recopiée)');
      dit(/chargerMemePhoto\(false,\{ sansEbay:true \}\)/.test(APP) && /if \(empS && !sansEbay\) empreintesEbayPage/.test(APP), 'S1 · le calcul au démarrage est en LECTURE seule (le calcul eBay dans la page n’est pas lancé d’ici)');
      dit(/const identPhotoDuCompte = \(\) => \{ const i = lireIdentitesPhoto\(\); return i && i\.owner && i\.owner === AUTH\.user\?\.id \? i : null; \};/.test(APP), 'S1 · les identités sont celles du compte VRM connecté seulement');
      const lecteurs = (APP.match(/liensLbcLus\(\)/g) || []).length;
      const anti = ['const liensR=liensLbcLus();', 'const liensL=liensLbcLus();', 'const liensE=liensLbcLus();', 'liensLbc:liensLbcLus(), ventesVc:vcC', "numerosLbcSortis(ls.items, { ...(liensLbcLus()) }"];
      dit(lecteurs >= 20 && anti.every((x) => APP.includes(x)) && /const numerosVcEffectifs = \(\) => carteNumerosVc\(numerosVcAvecLiens\(vcCarte\('vrm_vc_numeros'\), liensVcLus\(\)\)\);/.test(APP),
        `S1 · les lecteurs d’identité lisent les liens AVEC la photo (${lecteurs} lectures : à retirer, ventes croisées, N° Vestiaire)`, anti.filter((x) => !APP.includes(x)).join(' | '));
      const restes = (APP.match(/load\(['"]vrm_lbc_liens['"], *\{\}\)/g) || []).length;
      dit(restes <= 5, `S1 · seuls le calcul, relier et la définition lisent encore les liens posés seuls (${restes})`); }
  } catch (e) { dit(false, 'audit', e && e.stack); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-photo-identite : tout vert');
  process.exit(ko ? 1 : 0);
})();
