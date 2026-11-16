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
  sansReconnues: ['src/photoIdentite.js', "  const propositions = arr(res.propositions).filter((p) => !ids.has(cleA(p)) && !ambCode.has(cleA(p)));", "  const propositions = arr(res.propositions);"],
  ecrit: ['src/App.jsx', '    poserIdentitesPhoto(ident.lu ? { ...ident, owner } : null);\n', "    poserIdentitesPhoto(ident.lu ? { ...ident, owner } : null);\n    if (ident.lu) save('vrm_lbc_liens', liensLbcAvecPhoto(load('vrm_lbc_liens', {}) || {}, ident));\n"],
  demarrageEbay: ['src/App.jsx', "chargerMemePhoto(false,{ sansEbay:true });", 'chargerMemePhoto(false);'],
  lecteurs: ['src/App.jsx', "const liensR=liensLbcLus();", "const liensR=load('vrm_lbc_liens',{})||{};"],
  codeDeuxPaires: ['src/photoOrigine.js', "    if (paires.size >= 2) {", "    if (paires.size >= 99) {"],
  codeGenerique: ['src/photoOrigine.js', "if (!m || !m.size || m.size >= GENERIQUE_CODE_PAIRES) continue;", "if (!m || !m.size) continue;"],
  codeDelier: ['src/photoOrigine.js', "    if (a.relie || Object.prototype.hasOwnProperty.call(LL, id)) continue;", "    if (a.relie) continue;"],
  codeRefus: ['src/photoOrigine.js', "for (const n of [...paires.keys()]) if (typeof cleRefus === 'function' && R[cleRefus('Leboncoin', id, n)]) paires.delete(n);", ''],
  codePasSu: ['src/photoOrigine.js', "  if (!V || !L) return out;", "  if (!V && !L) return out;"],
  codeDouteux: ['src/photoOrigine.js', "    if (douteux.has(n)) continue;\n", ''],
  ressemblanceAllumee: ['src/photoIdentite.js', 'export const IDENTITE_PAR_RESSEMBLANCE = false;', 'export const IDENTITE_PAR_RESSEMBLANCE = true;'],
  fondAutreCompte: ['vinted-sync-extension/background.js', "filter((e) => e && String(e.uid) === String(uid) && codeOrigineValide(e.code))", "filter((e) => e && codeOrigineValide(e.code))"],
  fondLecture: ['vinted-sync-extension/background.js', "    if (r === null) { restent.push(...liste); noterDiag('origine_lecture_ratee'); continue; }\n    const carte = Object.assign({}, (r[0]", "    const carte = Object.assign({}, ((r || [])[0]"], // lecture KO traitée comme vide : le cas qui détruit
  pageRefus: ['vinted-sync-extension/inject.js', "      if (!codeP || String(method || '').toUpperCase() !== 'POST') return;\n      const st = Number(status);\n      if (!(st >= 200 && st < 300)) return;", "      if (!codeP || String(method || '').toUpperCase() !== 'POST') return;\n      const st = Number(status);"],
  compte: ['src/App.jsx', "return i && i.owner && i.owner === AUTH.user?.id ? i : null;", 'return i;'],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : MUT.split(',');
  let rouges = 0;
  for (const nom of noms) {
    const [f, avant, apres] = MUTATIONS[nom] || [];
    if (!f) { console.log(`❓ mutation inconnue : ${nom}`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-photo-identite-'));
    for (const d of ['src', 'scripts', 'vinted-sync-extension']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules/.test(s) });
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
  const APP_BRUT = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');   // avant `brancher` (P9 recolle les écrans)
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
    // La ressemblance comme identité est ÉTEINTE (sa décision : « son CODE ») ; ses règles restent jugées ALLUMÉES ici,
    // pour le jour où il la validerait — et R0 vérifie qu'elle est éteinte par défaut.
    const ident = (res, o = {}) => I.identitesParPhoto(res, { liensLbc: o.liensLbc || {}, liensVc: o.liensVc || {}, numerosVc: o.numerosVc || {}, cle, ressemblance: true });

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

    // ── R0 : la ressemblance n'est PAS une identité tant qu'il ne l'a pas validée ──
    { const parDefaut = I.identitesParPhoto(P1.res, { cle });
      dit(I.IDENTITE_PAR_RESSEMBLANCE === false && parDefaut.lu && parDefaut.liste.length === 0 && I.avecIdentites(P1.res, parDefaut).propositions.length === 1,
        'R0 · par défaut la ressemblance (même « sûr ») reste une PROPOSITION : aucune identité automatique', JSON.stringify({ flag: I.IDENTITE_PAR_RESSEMBLANCE, n: parDefaut.liste.length })); }

    // ── C : LE CODE D'ORIGINE (SHA-256 du fichier téléversé) — l'identité exacte ──
    { const O = await import(path.join(RACINE, 'src', 'photoOrigine.js'));
      const sha = (t) => require('crypto').createHash('sha256').update(String(t)).digest('hex');
      const nom = (t) => require('crypto').createHash('sha1').update(String(t)).digest('hex');
      const uImg = (t, regle = 'ad-large') => { const n = nom(t); return `https://img.leboncoin.fr/api/v1/lbcpb1/images/${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4, 6)}/${n}.jpg?rule=${regle}`; };
      const ad = (id, fichiers, o = {}) => ({ plateforme: 'Leboncoin', id: String(id), compte: 'c1', titre: 'Nike Air Max 90 blanche 42', photo: uImg(fichiers[0]), photos: fichiers.map((f, i) => uImg(f, i ? 'ad-thumb' : 'ad-large')), relie: false, numero: '', ...o });
      const base = () => ({ vinted: { 1001: { codes: [sha('fichier-124-a'), sha('fichier-124-b')] }, 1002: { codes: [sha('fichier-125')] } }, lbcImages: {}, fiches: { 1001: '124', 1002: '125' }, autres: [] });
      const lbcDe = (m, envoi) => { m.lbcImages[nom(envoi.lbc)] = { code: sha(envoi.fichier) }; };
      const calcC = (m, o = {}) => O.identitesParCode({ vinted: m.vinted, lbcImages: m.lbcImages, fiches: m.fiches, autres: m.autres, liensLbc: o.liensLbc || {}, refus: o.refus || {}, numerosDouteux: o.douteux || null, cleRefus: (pf, id, n) => M.cleRefusMemePhoto(pf, id, n, cle), cle });
      // C1 : le même FICHIER envoyé sur Vinted (N°124) et sur Leboncoin (nom d'image rendu par Leboncoin) ⇒ N°124.
      { const m = base(); lbcDe(m, { lbc: 'img-lbc-1', fichier: 'fichier-124-b' }); m.autres.push(ad(5001, ['img-lbc-1']));
        const id = calcC(m); const l = I.liensLbcAvecPhoto({}, I.fusionnerIdentites(id, null));
        dit(id.lu && id.Leboncoin['5001'] === '124' && l['5001'] === '124' && id.liste[0].par === 'code' && id.liste[0].reconnue && id.liste[0].reconnue.par === 'code',
          'C1 · le même fichier envoyé sur Vinted (N°124) et sur Leboncoin ⇒ l’annonce Leboncoin PORTE N°124 (identité exacte, aucun geste)', JSON.stringify(id.Leboncoin));
        const vu = I.avecIdentites({ lu: true, propositions: [], ambigus: [] }, I.fusionnerIdentites(id, null));
        dit((vu.reconnuesParNumero.get('124') || []).length === 1 && vu.reconnues[0].par === 'code', 'C1 · la fiche N°124 la voit : « aussi sur Leboncoin · reconnue par la photo d’origine »');
        const vuKO = I.avecIdentites({ lu: false, propositions: [], ambigus: [] }, I.fusionnerIdentites(id, null));
        dit((vuKO.reconnuesParNumero.get('124') || []).length === 1, 'C1 · empreintes de ressemblance pas lues : l’identité par le code reste visible'); }
      // C2 : la photo réencodée par Leboncoin (autre taille, autre règle) garde le MÊME nom ⇒ même code.
      dit(O.nomImageLbc(uImg('x', 'ad-thumb')) === O.nomImageLbc(uImg('x', 'ad-large')) && O.nomImageLbc(uImg('x')) === nom('x') && O.nomImageLbc('https://images1.vinted.net/t/a/f800/1.jpeg') === '',
        'C2 · toutes les tailles servies par Leboncoin (`?rule=`) portent le même nom d’image ; une adresse Vinted n’en a pas');
      // C3 : même titre, même taille, AUTRE fichier ⇒ rien.
      { const m = base(); lbcDe(m, { lbc: 'img-lbc-2', fichier: 'fichier-124-c (autre prise)' }); m.autres.push(ad(5002, ['img-lbc-2']));
        const id = calcC(m); dit(id.liste.length === 0 && id.ambigus.length === 0 && id.nAnnoncesAvecCode === 1, 'C3 · même titre, même taille, AUTRE fichier ⇒ rien'); }
      // C4 : le même fichier sur DEUX N° ⇒ rien, dit (ambigu, son toucher choisit).
      { const m = base(); m.vinted[1003] = { codes: [sha('boite')] }; m.vinted[1004] = { codes: [sha('boite')] }; m.fiches[1003] = '12'; m.fiches[1004] = '40';
        lbcDe(m, { lbc: 'img-lbc-3', fichier: 'boite' }); m.autres.push(ad(5003, ['img-lbc-3']));
        const id = calcC(m); const a = id.ambigus[0];
        dit(id.liste.length === 0 && a && a.raison === 'deux-paires' && a.parCode && a.paires.map((p) => p.numero).join() === '12,40', 'C4 · le même fichier sur N°12 et N°40 ⇒ rien n’est déduit, « Même photo sur N°12 et N°40 : laquelle ? »', JSON.stringify(id.ambigus.map((x) => x.paires.map((p) => p.numero))));
        const vu = I.avecIdentites({ lu: true, propositions: [], ambigus: [] }, I.fusionnerIdentites(id, null));
        dit(vu.ambigus.length === 1 && vu.nARelier === 1, 'C4 · l’ambiguïté est montrée (comptée à trancher)'); }
      // C5 : un fichier générique (sur 3 N° distincts) ⇒ ignoré ; une AUTRE photo de l'annonce, propre à N°124, suffit.
      { const m = base(); for (const [i, n] of [[1005, '50'], [1006, '51'], [1007, '52']]) { m.vinted[i] = { codes: [sha('fond')] }; m.fiches[i] = n; }
        lbcDe(m, { lbc: 'img-fond', fichier: 'fond' }); m.autres.push(ad(5004, ['img-fond']));
        lbcDe(m, { lbc: 'img-124', fichier: 'fichier-124-a' }); m.autres.push(ad(5005, ['img-fond', 'img-124']));
        const id = calcC(m);
        dit(!id.Leboncoin['5004'] && !id.ambigus.some((x) => x.annonce.id === '5004') && id.Leboncoin['5005'] === '124', 'C5 · fichier générique (3 paires) ⇒ ignoré ; l’autre photo, propre à N°124, suffit', JSON.stringify({ l: id.Leboncoin, a: id.ambigus.map((x) => x.annonce.id) })); }
      // C6 : ses décisions gagnent.
      { const m = base(); lbcDe(m, { lbc: 'img-lbc-1', fichier: 'fichier-124-b' }); m.autres.push(ad(5001, ['img-lbc-1']));
        const a = calcC(m, { liensLbc: { 5001: '' } }), b = calcC(m, { liensLbc: { 5001: '77' } }), c = calcC(m, { refus: { [M.cleRefusMemePhoto('Leboncoin', '5001', '124', cle)]: 'x' } }), d = calcC(m, { douteux: new Set(['124']) });
        const m2 = base(); lbcDe(m2, { lbc: 'img-lbc-1', fichier: 'fichier-124-b' }); m2.autres.push(ad(5001, ['img-lbc-1'], { relie: true }));
        dit(!a.Leboncoin['5001'] && I.liensLbcAvecPhoto({ 5001: '' }, a)['5001'] === '' && !b.Leboncoin['5001'] && !c.Leboncoin['5001'] && !d.Leboncoin['5001'] && !calcC(m2).Leboncoin['5001'],
          'C6 · son « délier », son lien, « ce n’est pas la même », un N° porté par deux paires, une référence posée ⇒ le code ne relie rien'); }
      // C7 : pas su.
      { const m = base(); lbcDe(m, { lbc: 'img-lbc-1', fichier: 'fichier-124-b' }); m.autres.push(ad(5001, ['img-lbc-1']));
        const a = O.identitesParCode({ vinted: null, lbcImages: m.lbcImages, fiches: m.fiches, autres: m.autres, cle }), b = O.identitesParCode({ vinted: m.vinted, lbcImages: null, fiches: m.fiches, autres: m.autres, cle });
        dit(!a.lu && !b.lu && !a.liste.length && !b.liste.length, 'C7 · une ligne de codes pas lue ⇒ aucune identité'); }
      // C8 : 50 paires identiques, 50 fichiers différents ⇒ 0 identité ; la seule reprise du fichier de N°217 ⇒ N°217.
      { const m = base();
        for (let i = 0; i < 50; i++) { m.vinted[3000 + i] = { codes: [sha('jordan-vue-' + i)] }; m.fiches[3000 + i] = String(200 + i); }
        for (let i = 0; i < 50; i++) { lbcDe(m, { lbc: 'lbc-j-' + i, fichier: 'jordan-vue-' + (50 + i) }); m.autres.push(ad(6000 + i, ['lbc-j-' + i], { titre: 'Jordan 1 Chicago 42' })); }
        const id = calcC(m);
        lbcDe(m, { lbc: 'lbc-j-reprise', fichier: 'jordan-vue-17' }); m.autres.push(ad(6999, ['lbc-j-reprise'], { titre: 'Jordan 1 Chicago 42' }));
        const id2 = calcC(m);
        dit(id.liste.length === 0 && id2.liste.length === 1 && id2.Leboncoin['6999'] === '217', 'C8 · 50 paires identiques, fichiers différents ⇒ 0 ; la seule reprise du fichier ⇒ N°217', JSON.stringify(id2.liste.map((x) => [x.id, x.numero]))); }
      // C9 : le code prime sur la ressemblance (si elle était un jour allumée), une ambiguïté du code bloque la ressemblance.
      { const m = base(); m.vinted[1003] = { codes: [sha('boite')] }; m.vinted[1004] = { codes: [sha('boite')] }; m.fiches[1003] = '12'; m.fiches[1004] = '40';
        lbcDe(m, { lbc: 'img-lbc-3', fichier: 'boite' }); m.autres.push(ad(5001, ['img-lbc-3']));
        const f = I.fusionnerIdentites(calcC(m), ident(P1.res));
        dit(!f.Leboncoin['5001'] && f.ambigus.length === 1, 'C9 · une ambiguïté du code n’est jamais tranchée par la ressemblance', JSON.stringify(f.Leboncoin)); }
    }

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

    // ── E : l'extension — la page calcule le code du FICHIER envoyé, le fond le range ──
    { const sha = (b) => require('crypto').createHash('sha256').update(b).digest('hex');
      const OCTETS = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      // La VRAIE page (inject.js / lbc-inject.js) dans un vm : un faux site qui répond, les messages postés relevés.
      const page = async (fichier, hote, appels) => {
        const src = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', fichier), 'utf8');
        const msgs = [], requetes = [];
        const ctx = { console: { log() {}, warn() {}, error() {}, info() {}, debug() {} }, URL, URLSearchParams, Blob, FormData, File, Headers, Response, Request, TextEncoder, TextDecoder, MessageChannel, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, crypto: globalThis.crypto, atob, btoa, JSON, Math, Date };
        ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
        ctx.location = { origin: 'https://' + hote, href: 'https://' + hote + '/', hostname: hote, host: hote, pathname: '/', protocol: 'https:' };
        ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
        ctx.postMessage = (m, o, tr) => { if (tr && tr[0]) tr[0].onmessage = (e) => msgs.push(e.data); else msgs.push(m); };
        ctx.document = { addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { setAttribute() {}, appendChild() {}, style: {} }; }, documentElement: { appendChild() {} }, head: { appendChild() {} }, readyState: 'loading', cookie: '', visibilityState: 'visible' };
        ctx.navigator = { userAgent: 'banc' }; ctx.history = { pushState() {}, replaceState() {} };
        ctx.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; };
        let rep = null;
        ctx.fetch = async (u, init) => { requetes.push(String(u)); return rep(u, init); };
        vm.createContext(ctx); vm.runInContext(src, ctx);
        for (const [u, init, corps, st] of appels) { rep = async () => new Response(JSON.stringify(corps), { status: st || 200, headers: { 'content-type': 'application/json' } }); await ctx.window.fetch(u, init); }
        await new Promise((r) => setTimeout(r, 150));
        return { msgs, requetes };
      };
      const fdPhoto = () => { const fd = new FormData(); fd.append('photo[type]', 'item'); fd.append('photo[file]', new File([OCTETS], 'IMG_1.jpg', { type: 'image/jpeg' })); return fd; };
      const v = await page('inject.js', 'www.vinted.fr', [
        ['/api/v2/photos', { method: 'POST', body: fdPhoto() }, { id: 987654, url: 'https://images1.vinted.net/t/x/f800/1.webp' }],
        ['/api/v2/item_upload/items', { method: 'POST', body: JSON.stringify({ item: { assigned_photos: [{ id: 987654, orientation: 0 }] } }) }, { item: { id: 55554444 } }],
        ['/api/v2/photos', { method: 'POST', body: fdPhoto() }, { error: 'refus' }, 403]]);
      const po = v.msgs.filter((m) => m.kind === 'photoOrigine'), ap = v.msgs.filter((m) => m.kind === 'annoncePhotos');
      dit(po.length === 1 && po[0].photoId === '987654' && po[0].code === sha(OCTETS) && ap.length === 1 && ap[0].itemId === '55554444' && ap[0].photoIds.join() === '987654'
        && v.requetes.length === 3 && !JSON.stringify(v.msgs).includes('IMG_1') && !v.msgs.some((m) => m.b64 || m.octets),
        'E1 · Vinted : le SHA-256 du FICHIER envoyé (= celui des octets), l’identifiant de photo rendu, puis l’annonce qui le porte ; aucune requête en plus, ni l’image ni son nom ne partent ; un envoi refusé (403) ne note rien',
        JSON.stringify({ po, ap, n: v.requetes.length }));
      const nomLbc = 'ab'.repeat(20);
      const l = await page('lbc-inject.js', 'www.leboncoin.fr', [
        ['https://api.leboncoin.fr/api/pintad/v1/public/upload/image', { method: 'POST', body: (() => { const fd = new FormData(); fd.append('file', new File([OCTETS], 'IMG_2.jpg', { type: 'image/jpeg' })); return fd; })() }, { filename: nomLbc + '.jpg', url: `https://img.leboncoin.fr/api/v1/lbcpb1/images/ab/ab/ab/${nomLbc}.jpg?rule=ad-private` }]]);
      const lo = l.msgs.filter((m) => m.kind === 'lbcphotoorigine');
      dit(lo.length === 1 && lo[0].fichier === nomLbc && lo[0].code === sha(OCTETS) && l.requetes.length === 1, 'E1 · Leboncoin : le SHA-256 du fichier envoyé et le NOM d’image rendu par Leboncoin (celui de toutes ses tailles) ; aucune requête en plus', JSON.stringify(lo));
      // Le VRAI fond.
      const { faireFond } = require('./_fond-vm.cjs');
      const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
      const fond = (o = {}) => faireFond({ src: BG, lignes: o.lignes || {}, comptes: [{ vinted_user_id: '111', login: 'a', domain: 'www.vinted.fr', access_token: 'j' }], connecte: o.connecte || '111', lectureKO: o.lectureKO });
      const fn = (f, n) => typeof f.ctx[n] === 'function';
      const C1 = sha(OCTETS), C2 = sha(new Uint8Array([9, 9, 9]));
      { const f = fond();
        if (!fn(f, 'noterPhotoOrigineVinted') || !fn(f, 'noterAnnoncePhotosVinted') || !fn(f, 'noterPhotoOrigineLbc')) throw new Error('E0 · fonctions du code d’origine absentes du fond');
        await f.ctx.noterPhotoOrigineVinted({ photoId: '987654', code: C1 }, 'www.vinted.fr');
        await f.ctx.noterPhotoOrigineVinted({ photoId: '987655', code: C2 }, 'www.vinted.fr');
        await f.ctx.noterAnnoncePhotosVinted({ itemId: '55554444', photoIds: ['987654', '987655', '111'] }, 'www.vinted.fr');
        const a = f.lignes.photo_origine_vinted && f.lignes.photo_origine_vinted.payload && f.lignes.photo_origine_vinted.payload.annonces;
        dit(a && a['55554444'] && a['55554444'].codes.slice().sort().join() === [C1, C2].sort().join() && a['55554444'].compte === '111' && !JSON.stringify(f.lignes.photo_origine_vinted).includes('987654'),
          'E2 · le fond range `photo_origine_vinted.annonces[annonce]` = { codes, compte } (les codes seuls, ni image ni identifiant de photo)', JSON.stringify(f.lignes.photo_origine_vinted || null).slice(0, 300));
        await f.ctx.noterPhotoOrigineLbc({ fichier: nomLbc, code: C1 });
        const im = f.lignes.photo_origine_lbc && f.lignes.photo_origine_lbc.payload && f.lignes.photo_origine_lbc.payload.images;
        dit(im && im[nomLbc] && im[nomLbc].code === C1, 'E2 · Leboncoin : `photo_origine_lbc.images[nom]` = { code }', JSON.stringify(im || null).slice(0, 200));
        await f.ctx.noterPhotoOrigineVinted({ photoId: '1', code: 'pas-un-code' }, 'www.vinted.fr');
        await f.ctx.noterPhotoOrigineLbc({ fichier: 'x', code: C1 });
        dit(!((f.store.vrm_origine_photos_vinted || {})['1']) && Object.keys(im || {}).length === 1, 'E3 · un code ou un nom mal formé ⇒ rien'); }
      { // Une photo envoyée par un AUTRE compte Vinted (même Chrome) n'est jamais prise pour celle de ce compte.
        const f = fond({ connecte: '222' });
        await f.ctx.noterPhotoOrigineVinted({ photoId: '987654', code: C1 }, 'www.vinted.fr');
        f.store.vrm_origine_photos_vinted = Object.assign({}, f.store.vrm_origine_photos_vinted || {}, { 987654: Object.assign({}, (f.store.vrm_origine_photos_vinted || {})['987654'] || { code: C1, at: Date.now() }, { uid: '999' }) });
        await f.ctx.noterAnnoncePhotosVinted({ itemId: '55554444', photoIds: ['987654'] }, 'www.vinted.fr');
        dit(!f.lignes.photo_origine_vinted, 'E3 · la photo d’un AUTRE compte ⇒ rien rangé pour l’annonce de ce compte'); }
      { const f = fond({ lectureKO: (u) => /id=eq\.photo_origine_lbc/.test(u), lignes: { photo_origine_lbc: { payload: { images: { ['cd'.repeat(20)]: { code: C2 } } } } } });
        await f.ctx.noterPhotoOrigineLbc({ fichier: nomLbc, code: C1 });
        const im = f.lignes.photo_origine_lbc.payload.images;
        dit(Object.keys(im).length === 1 && im['cd'.repeat(20)] && (f.store.vrm_origine_file || []).length === 1, 'E4 · lecture ratée de la ligne ⇒ RIEN écrit (l’existant intact), la file reste', JSON.stringify({ im: Object.keys(im), file: (f.store.vrm_origine_file || []).length })); }
      { const cv = /const CODE_VERSION = '([\d.]+)'/.exec(fs.readFileSync(BG, 'utf8')); const cap = /photoorigine:\s*'([\d.]+)'/.exec(APP_BRUT);
        const vn = (x) => String(x || '').split('.').map(Number).reduce((t, n) => t * 1000 + n, 0);
        dit(cap && cap[1] === '5.401.0' && cv && vn(cv[1]) >= vn('5.401.0') && /photoorigine:'rangerOrigineMaintenant'/.test(fs.readFileSync(path.join(RACINE, 'scripts', 'audit-coherence.cjs'), 'utf8')),
          'E5 · `EXT_CAPACITES.photoorigine` = 5.401.0, extension ≥ 5.401.0', JSON.stringify({ cap: cap && cap[1], cv: cv && cv[1] })); }
    }

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
      const restes = (APP_BRUT.match(/load\(['"]vrm_lbc_liens['"], *\{\}\)/g) || []).length;
      dit(restes <= 6, `S1 · seuls le calcul, relier et la définition lisent encore les liens posés seuls (${restes})`); }
  } catch (e) { dit(false, 'audit', e && e.stack); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-photo-identite : tout vert');
  process.exit(ko ? 1 : 0);
})();
