// ═════════════════════════════════════════════════════════════════════════
//  LA PHOTO D'ORIGINE EST UNE IDENTITÉ (24 nov., lot ext-anciens-lots, ext. 5.446.0 ;
//  repris du lot photo-identite-sites du 16 nov., PR #1219, jamais fusionné)
//
//  Julien : « quand je poste la paire sur Leboncoin et Vinted sans passer par VRM, VRM la reconnaît
//  parce que la photo utilisée est exactement la même » ; « non pas à quoi elle ressemble, mais son CODE ».
//  Règles exécutées : src/photoOrigine.js (le code ⇒ N°), src/photoIdentite.js (liens LUS, annonces vues),
//  src/liaisonSites.js (« Relier mes annonces »), la VRAIE règle « vendue sur Vinted ⇒ à retirer de
//  Leboncoin » d'App.jsx (vm), la VRAIE page (inject.js / lbc-inject.js) et le VRAI fond (`_fond-vm`).
//   C1  le même FICHIER sur Vinted (N°124) et Leboncoin ⇒ l'annonce Leboncoin porte N°124 ; « Relier mes
//       annonces » la montre reliée (preuve « même photo d'origine ») ; sans le code, « à relier » ;
//   C2  toutes les tailles servies par Leboncoin portent le même nom d'image ;
//   C3  même titre, même taille, AUTRE fichier ⇒ rien ;  C4  le même fichier sur deux N° ⇒ rien ;
//   C5  un fichier générique (3 paires) ⇒ ignoré ;  C6  ses décisions gagnent ;  C7  pas lu ⇒ rien ;
//   C8  50 paires identiques, fichiers différents ⇒ 0 ; la seule reprise du fichier ⇒ la bonne ;
//   P9  anti double vente : N°124 vendue sur Vinted ⇒ l'annonce reconnue est « à retirer » ;
//   E1-E5 l'extension : le SHA-256 du fichier ENVOYÉ (page), rangé par le fond pour le compte de l'onglet
//       seulement, une lecture ratée n'écrit rien, capacité 5.446.0 ;
//   S1  l'app : l'identité n'est JAMAIS écrite, les gestes partent des liens POSÉS, les lecteurs d'identité
//       lisent les liens AVEC la photo, « délier » une annonce reconnue = « ce n'est pas la même ».
//  `--src chemin` : un autre arbre (preuve sur le code d'avant). `--mutation=<nom>|toutes`.
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const MUTATIONS = {
  codeDeuxPaires: ['src/photoOrigine.js', "    if (paires.size >= 2) {", "    if (paires.size >= 99) {"],
  codeGenerique: ['src/photoOrigine.js', "if (!m || !m.size || m.size >= GENERIQUE_CODE_PAIRES) continue;", "if (!m || !m.size) continue;"],
  codeDelier: ['src/photoOrigine.js', "    if (a.relie || Object.prototype.hasOwnProperty.call(LL, id)) continue;", "    if (a.relie) continue;"],
  codeRefus: ['src/photoOrigine.js', "for (const n of [...paires.keys()]) if (typeof cleRefus === 'function' && R[cleRefus('Leboncoin', id, n)]) paires.delete(n);", ''],
  codePasSu: ['src/photoOrigine.js', "  if (!V || !L) return out;", "  if (!V && !L) return out;"],
  codeDouteux: ['src/photoOrigine.js', "    if (douteux.has(n)) continue;\n", ''],
  manuel: ['src/photoIdentite.js', "for (const [id, n] of Object.entries(p)) if (!Object.prototype.hasOwnProperty.call(m, id) && plein(n)) out[id] = n;", "for (const [id, n] of Object.entries(p)) if (plein(n)) out[id] = n;"],
  vueRelie: ['src/photoIdentite.js', "    return { ...a, relie: true, numero: String(n), identites: [...arr(a.identites), { sorte: 'photo-origine', numero: String(n) }] };", "    return a;"],
  ecrit: ['src/App.jsx', '    poserIdentitesPhoto(ident.lu ? { ...ident, owner } : null);\n', "    poserIdentitesPhoto(ident.lu ? { ...ident, owner } : null);\n    if (ident.lu) save('vrm_lbc_liens', liensLbcAvecPhoto(load('vrm_lbc_liens', {}) || {}, ident));\n"],
  demarrageEbay: ['src/App.jsx', "chargerMemePhoto(false,{ sansEbay:true });", 'chargerMemePhoto(false);'],
  lecteurs: ['src/App.jsx', "const liensR=liensLbcLus();", "const liensR=load('vrm_lbc_liens',{})||{};"],
  compte: ['src/App.jsx', "return i && i.owner && i.owner === AUTH.user?.id ? i : null; }", 'return i; }'],
  delier: ['src/liaisonActions.js', "    if (parPhoto && !(cartes().lbc || {})[String(annonce.id)]) {", "    if (false) {"],
  fondAutreCompte: ['vinted-sync-extension/background.js', "filter((e) => e && String(e.uid) === String(uid) && codeOrigineValide(e.code))", "filter((e) => e && codeOrigineValide(e.code))"],
  fondLecture: ['vinted-sync-extension/background.js', "    if (r === null) { restent.push(...liste); noterDiag('origine_lecture_ratee'); continue; }\n    const carte = Object.assign({}, (r[0]", "    const carte = Object.assign({}, ((r || [])[0]"],
  pageRefus: ['vinted-sync-extension/inject.js', "      if (!codeP || String(method || '').toUpperCase() !== 'POST') return;\n      const st = Number(status);\n      if (!(st >= 200 && st < 300)) return;", "      if (!codeP || String(method || '').toUpperCase() !== 'POST') return;\n      const st = Number(status);"],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : MUT.split(',');
  let rouges = 0;
  for (const nom of noms) {
    const [f, avant, apres] = MUTATIONS[nom] || [];
    if (!f) { console.log(`❓ mutation inconnue : ${nom}`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-photo-identite-'));
    fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
    fs.cpSync(path.join(RACINE, 'scripts'), path.join(tmp, 'scripts'), { recursive: true, filter: (s) => !/node_modules|[\\/]bancs[\\/]fx/.test(s) });
    fs.cpSync(path.join(RACINE, 'vinted-sync-extension'), path.join(tmp, 'vinted-sync-extension'), { recursive: true, filter: (s) => !/\.zip$|\.png$/.test(s) });
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
let ID_C1 = null;

(async () => {
  if (!fs.existsSync(path.join(RACINE, 'src', 'photoOrigine.js')) || !fs.existsSync(path.join(RACINE, 'src', 'photoIdentite.js'))) { dit(false, 'C0 · src/photoOrigine.js / src/photoIdentite.js absents : la photo d’origine n’est pas une identité'); console.log(`\n❌ ${ko} contrôle(s) rouge(s)`); process.exit(1); }
  const APP_BRUT = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');   // avant `brancher` (P9 recolle les écrans)
  try {
    const M = await import(path.join(RACINE, 'src', 'memePhoto.js'));
    const I = await import(path.join(RACINE, 'src', 'photoIdentite.js'));
    const cle = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
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
        const id = calcC(m); const l = I.liensLbcAvecPhoto({}, id); ID_C1 = id;
        dit(id.lu && id.Leboncoin['5001'] === '124' && l['5001'] === '124' && id.liste[0].par === 'code' && id.liste[0].reconnue && id.liste[0].reconnue.par === 'code',
          'C1 · le même fichier envoyé sur Vinted (N°124) et sur Leboncoin ⇒ l’annonce Leboncoin PORTE N°124 (identité exacte, aucun geste)', JSON.stringify(id.Leboncoin));
        // « Relier mes annonces » (la vraie règle, src/liaisonSites.js) la voit RELIÉE à N°124, preuve « photo d'origine » — jamais « à relier ».
        const LS = await import(path.join(RACINE, 'src', 'liaisonSites.js'));
        const vus = I.autresAvecIdentites(m.autres, id);
        const res = LS.construireLiaison({ autres: vus, paires: [], cle });
        const e = (res.entrees || []).find((x) => String(x.annonce && x.annonce.id) === '5001');
        dit(!!e && e.etat === 'relie' && e.numero === '124' && e.preuve === 'photo-origine' && !res.file.some((x) => String(x.annonce && x.annonce.id) === '5001'),
          'C1 · « Relier mes annonces » la montre reliée à N°124 (preuve « même photo d’origine »), jamais « à relier »', JSON.stringify(e && { etat: e.etat, numero: e.numero, preuve: e.preuve }));
        const sans = LS.construireLiaison({ autres: m.autres, paires: [], cle });
        dit(((sans.entrees || []).find((x) => String(x.annonce && x.annonce.id) === '5001') || {}).etat === 'aRelier', 'C1 · sans la photo d’origine, la même annonce reste « à relier »'); }
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
        dit(!I.autresAvecIdentites(m.autres, id).find((x) => x.id === '5003').relie, 'C4 · l’annonce reste « à relier » : son toucher choisit'); }
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
      dit(I.liensLbcAvecPhoto({ 5001: '77' }, ID_C1)['5001'] === '77' && I.liensLbcAvecPhoto({ 5001: '' }, ID_C1)['5001'] === '' && I.liensLbcAvecPhoto({}, ID_C1)['5001'] === '124' && I.liensLbcAvecPhoto({ 9: '3' }, null)['9'] === '3',
        'C6 · les liens LUS : son lien (N°77) et son « délier » (vide) gagnent toujours sur la photo ; pas d’identité ⇒ ses liens tels quels');
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
    }
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
      const avec = ctx.R.aRetirerDeLbcVinted({ ...base, liens: I.liensLbcAvecPhoto({}, ID_C1) });
      const sans = ctx.R.aRetirerDeLbcVinted({ ...base, liens: {} });
      dit(Array.isArray(avec) && avec.length === 1 && avec[0].numero === '124' && avec[0].lbcId === '5001' && Array.isArray(sans) && sans.length === 0,
        'P9 · N°124 vendue sur Vinted (preuve) ⇒ l’annonce Leboncoin reconnue par la photo d’origine est « à retirer » ; sans elle ⇒ rien', JSON.stringify({ avec, sans })); }

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
        dit(cap && cap[1] === '5.446.0' && cv && vn(cv[1]) >= vn('5.446.0') && /photoorigine:'rangerOrigineMaintenant'/.test(fs.readFileSync(path.join(RACINE, 'scripts', 'audit-coherence.cjs'), 'utf8')),
          'E5 · `EXT_CAPACITES.photoorigine` = 5.446.0, extension ≥ 5.446.0', JSON.stringify({ cap: cap && cap[1], cv: cv && cv[1] })); }
    }

    // ── S1 : l'app ──
    { const APP = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
      const ch = /async function chargerMemePhoto[\s\S]*?\n}\n/.exec(APP);
      dit(!!ch && /identitesParCode\(\{[\s\S]*liensLbc: load\('vrm_lbc_liens', \{\}\) \|\| \{\}/.test(ch[0]) && /poserIdentitesPhoto\(/.test(ch[0]) && /autres: autresVus/.test(ch[0]) && !/\bsave\(|ecrireCopieLocale\(|method: 'POST'/.test(ch[0].replace(/empreintesEbayPage[^\n]*/g, '')),
        'S1 · l’identité est calculée depuis SES liens posés, publiée, montrée à « Relier mes annonces », et jamais écrite (aucun save, copie locale ni POST dans le calcul)');
      const tout = [APP, ...fs.readdirSync(path.join(RACINE, 'src', 'ecrans')).filter((f) => /\.jsx?$/.test(f)).map((f) => fs.readFileSync(path.join(RACINE, 'src', 'ecrans', f), 'utf8'))].join('\n');
      dit(!/(save|ecrireCopieLocale|vcPoser)\([^)\n]*liensLbcLus\(\)/.test(tout) && !/(save|ecrireCopieLocale)\([^)\n]*avecPhotoLbc/.test(tout), 'S1 · les liens LUS (avec la photo) ne sont jamais réécrits');
      dit(/chargerMemePhoto\(false,\{ sansEbay:true \}\)/.test(APP) && /if \(empS && !sansEbay\) empreintesEbayPage/.test(APP), 'S1 · le calcul au démarrage est en LECTURE seule (le calcul eBay dans la page n’est pas lancé d’ici)');
      dit(/function identPhotoDuCompte\(\) \{ const i = lireIdentitesPhoto\(\); return i && i\.owner && i\.owner === AUTH\.user\?\.id \? i : null; \}/.test(APP), 'S1 · les identités sont celles du compte VRM connecté seulement');
      const lecteurs = (tout.match(/liensLbcLus\(\)/g) || []).length;
      const anti = ['const liensR=liensLbcLus();', 'const liensL=liensLbcLus();', 'const liensE=liensLbcLus();', 'liensLbc:liensLbcLus(), ventesVc:vcC', 'const liensL = { ...liensLbcLus() };'];
      dit(lecteurs >= 25 && anti.every((x) => tout.includes(x)), `S1 · les lecteurs d’identité lisent les liens AVEC la photo (${lecteurs} lectures : à retirer, ventes croisées, N° des sites, bénéfice)`, anti.filter((x) => !tout.includes(x)).join(' | '));
      // Chaque lecture des liens POSÉS seuls doit être d'une sorte permise : les N° déjà pris (un N° reconnu par la photo est
      // déjà celui d'une fiche Vinted), la définition, le calcul lui-même, ses gestes (écrire part de ses liens posés).
      const PERMIS = [/\.forEach\(add\)/, /out\.push\(n\)/, /portes\.add\(cleNum\(n\)\)/, /est déjà relié sur Leboncoin/, /function liensLbcAvecPhoto|function liensLbcLus/, /liensLbc: load\('vrm_lbc_liens', \{\}\) \|\| \{\}, refus/,
        /sans = load\('vrm_lbc_pas_de_paire'/, /\[String\(id\)\]: String\(n\)/, /const avant = \(load\('vrm_lbc_liens'/, /ecrireCopieLocale\('vrm_lbc_liens'/, /avecPhotoLbc\(\{ \.\.\.\(main\.vrm_lbc_liens/];
      const brutes = tout.split('\n').filter((l) => /load\(['"]vrm_lbc_liens['"], *\{\}\)/.test(l) && !/^\s*\/\//.test(l));
      const horsRegle = brutes.filter((l) => !PERMIS.some((re) => re.test(l)));
      dit(!horsRegle.length, `S1 · les ${brutes.length} lectures des liens posés seuls sont toutes permises (N° déjà pris, définition, calcul, gestes)`, horsRegle.map((l) => l.trim().slice(0, 110)).join(' | '));
      const LA = fs.readFileSync(path.join(RACINE, 'src', 'liaisonActions.js'), 'utf8');
      dit(/sorte === 'photo-origine'/.test(LA) && /refuserPhoto\(\{ annonce, numero: parPhoto\.numero \}\)/.test(LA), 'S1 · « Délier » une annonce reliée par la photo d’origine = « ce n’est pas la même » (sinon la photo la referait)');
      // Le geste, exécuté : la vraie `creerLiaisonVrm` avec de fausses portes.
      const A = await import(path.join(RACINE, 'src', 'liaisonActions.js'));
      const fabrique = A.creerLiaison;
      const refus = [], gestes = [];
      const L = fabrique({ pret: () => true, proprio: () => 'u1', lireCarte: (k) => ({}), geste: (texte, ops) => gestes.push(ops), memePhoto: async () => null, annoncesAutres: async () => ({ autres: [] }),
        pairesVinted: async () => ({ paires: [] }), pistes: async () => null, douteux: () => new Set(), numerosConnus: () => null, numeroVcDe: () => '', donnerNumero: async () => null,
        refuserPhoto: (x) => refus.push(x), cleNum: cle, marqueDe: () => '', tr: (k) => k, publier: () => {}, lire: () => null });
      const r = L.delier({ annonce: { plateforme: 'Leboncoin', id: '5001', relie: true, numero: '124', identites: [{ sorte: 'photo-origine', numero: '124' }] } });
      dit(r && r.ok && refus.length === 1 && refus[0].numero === '124' && gestes.length === 0, 'S1 · délier (exécuté) : « pas la même » pour N°124, aucun lien écrit', JSON.stringify({ r, refus, gestes }));
    }

  } catch (e) { dit(false, 'audit', e && e.stack); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-photo-identite : tout vert');
  process.exit(ko ? 1 : 0);
})();
