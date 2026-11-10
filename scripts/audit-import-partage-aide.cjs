#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LOT J (10 nov.) : IMPORT TABLEUR DES ACHATS · PARTAGE DEPUIS PHOTOS ·
//          GESTES DU « ? » PAR ÉCRAN
//          node scripts/audit-import-partage-aide.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
//   I  src/importAchats.js EXÉCUTÉ : CSV (« ; », guillemets, encodage d'Excel
//      Windows), .xlsx VRAI (zip fabriqué ici, deflate + stocké, chaînes partagées,
//      date et prix numériques), colonnes reconnues (« N° de commande » = une
//      référence, pas un N°), dates à la française, prix du fichier tel quel (vide
//      = vide, illisible = ligne écartée), doublons par RÉFÉRENCE seulement
//      (50 lignes identiques sans référence entrent toutes), N° traduit par la date
//      (remise à zéro), coût posé seulement sur une fiche unique SANS prix ;
//   P  le partage : le manifeste déclare `share_target` ; le VRAI public/sw.js
//      exécuté (fausse réserve) range une image et ouvre `photo=partage`, refuse
//      un fichier qui n'est pas une image ; `lireDemandeAchat` porte la photo ;
//      `prendrePhotoPartagee` la rend UNE fois et jette une photo trop vieille ;
//   A  chaque écran à phrase a 3 à 5 gestes de 12 mots au plus, sans jargon ;
//      src/aideEtapes.js = ce que le générateur produit ; la feuille les montre ;
//   W  le branchement (App.jsx, Achats.jsx) : rien n'écrase un prix, N° par
//      `numeroExterne`, formulaire de partage.
// `--prouve` : chaque règle réaffaiblie ⇒ ROUGE exigé. Données inventées.
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib'), vm = require('vm');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['date absente ⇒ aujourd’hui', 'src/importAchats.js', 'const date = dateDuFichier(val(iD));', "const date = dateDuFichier(val(iD)) || '2026-11-10';"],
    ['prix illisible accepté', 'src/importAchats.js', "if (!prix.ok) return { ...ligne, etat: 'ecartee', raison: 'Prix illisible', apercu: titre };", ''],
    ['doublon déjà dans VRM ignoré', 'src/importAchats.js', 'if (ref && refsDeja.has(ref))', 'if (false && ref)'],
    ['doublon par ressemblance (titre)', 'src/importAchats.js', 'const ref = refAchat(refBrute);', 'const ref = refAchat(refBrute) || refAchat(titre);'],
    ['N° pris tel quel (sans la date)', 'src/importAchats.js', 'const t = numeroDe ? numeroDe(brutNum, dms) : brutNum;', 'const t = brutNum;'],
    ['coût posé sur un N° qui a déjà un prix', 'src/importAchats.js', "if (e === 'libre' && !numsPoses.has(numero))", "if (e !== 'deux' && !numsPoses.has(numero))"],
    ['date lue mois/jour', 'src/importAchats.js', 'return iso(a, +m[2], +m[1]);', 'return iso(a, +m[1], +m[2]);'],
    ['« N° de commande » lu comme un N°', 'src/importAchats.js', 'const MOTS = [\n', "const MOTS = [\n  ['numero', /^n\\b/],\n"],
    ['le partage range n’importe quel fichier', 'public/sw.js', "/^image\\//.test(x.type || '') && x.size > 0", 'x.size > 0'],
    ['le lien ne porte plus la photo', 'src/raccourcisSiri.js', "if (p.get('photo') === 'partage') d.photoPartagee = true;", ''],
    ['une vieille photo partagée servie', 'src/partagePhoto.js', '|| maintenant - at > PARTAGE_MAX_MS', ''],
    ['un geste d’aide trop long', 'scripts/aide-contenu.cjs', "'Choisis la période en haut.',", "'Choisis la période en haut, puis regarde bien chaque chiffre un par un, tranquillement.',"],
    ['l’app écrase un prix déjà là', 'src/App.jsx', 'if (f.length !== 1 || prixAchatDe(f[0], u) != null) continue;', 'if (f.length !== 1) continue;'],
    ['la feuille du « ? » ne montre plus les gestes', 'src/composants/AideEcran.jsx', '{etapes.length ? (', '{false ? ('],
  ];
  let rouges = 0;
  const sauf = new Map();
  process.on('exit', () => { for (const [f, s] of sauf) fs.writeFileSync(f, s); });
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel);
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    sauf.set(f, src);
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 120000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); sauf.delete(f); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' && d != null ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 600)); } };
const imp = (rel) => import('file://' + path.join(R, rel) + '?t=' + Date.now());

// Un vrai .xlsx (zip) : `fichiers` = { nom: texte }, `stocke` = noms laissés sans compression.
function zip(fichiers, stocke = []) {
  const locaux = [], centraux = []; let off = 0;
  for (const [nom, texte] of Object.entries(fichiers)) {
    const brut = Buffer.from(texte, 'utf8');
    const methode = stocke.includes(nom) ? 0 : 8;
    const data = methode ? zlib.deflateRawSync(brut) : brut;
    const n = Buffer.from(nom, 'utf8');
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(methode, 8);
    loc.writeUInt32LE(data.length, 18); loc.writeUInt32LE(brut.length, 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(methode, 10);
    cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(brut.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(off, 42);
    locaux.push(loc, n, data); centraux.push(cen, n); off += 30 + n.length + data.length;
  }
  const c = Buffer.concat(centraux);
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(fichiers).length, 8); fin.writeUInt16LE(Object.keys(fichiers).length, 10);
  fin.writeUInt32LE(c.length, 12); fin.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...locaux, c, fin]));
}

(async () => {
  // ── I ─────────────────────────────────────────────────────────────────────
  console.log('── I. import du tableur');
  await essaie('I', async () => {
    const M = await imp('src/importAchats.js');
    // colonnes
    const cols = M.reconnaitreColonnes(['Date d’achat', 'Article', 'Prix payé', 'Fournisseur', 'N° de commande', 'N°', 'Commentaire']);
    dit(JSON.stringify(cols) === JSON.stringify(['date', 'titre', 'prix', 'ou', 'ref', 'numero', '']), 'colonnes reconnues (« N° de commande » = référence, « N° » = rangement)', cols);
    dit(M.reconnaitreColonnes(['Numéro de facture'])[0] === 'ref' && M.reconnaitreColonnes(['Référence'])[0] === 'ref' && M.reconnaitreColonnes(['Montant'])[0] === 'prix', 'facture/référence/montant reconnus');
    dit(M.colonnesSuffisantes(['titre', 'prix']).join() === 'date', 'une colonne obligatoire absente est NOMMÉE');
    // dates
    const D = [['03/04/2026', '2026-04-03'], ['3/4/26', '2026-04-03'], ['2026-04-03', '2026-04-03'], ['31/02/2026', ''], ['04/13/2026', ''], ['hier', ''], ['', ''], [46115, '2026-04-03'], [12, '']];
    const md = D.filter(([v, a]) => M.dateDuFichier(v) !== a).map(([v, a]) => `${v} ⇒ ${M.dateDuFichier(v)} (attendu ${a})`);
    dit(!md.length, 'dates : jour/mois à la française, Excel numérique, illisible ⇒ vide (jamais devinée)', md);
    // prix
    const P = [['25', '25,00'], ['25,5', '25,50'], ['25.50 €', '25,50'], ['1 250,00', '1250,00'], ['1.250,00', '1250,00'], ['', ''], [25.5, '25,50'], [12.345, null], ['vingt', null], ['-3', null], ['2x30', null]];
    const mp = P.filter(([v, a]) => { const r = M.prixDuFichier(v); return a === null ? r.ok : !(r.ok && r.prix === a); }).map(([v]) => `${v} ⇒ ${JSON.stringify(M.prixDuFichier(v))}`);
    dit(!mp.length, 'prix du fichier tel quel : vide = vide, illisible = refusé', mp);
    // CSV : point-virgule, guillemets, encodage d'Excel Windows (é en 0xE9)
    const csv1252 = Buffer.from('Date;Description;Prix;Où;Référence\r\n03/04/2026;"Nike ""Dunk""; 42";45,50;Brocante;\r\n', 'latin1');
    const rows = M.lireCsv(M.decoderTexte(new Uint8Array(csv1252)));
    dit(rows.length === 2 && rows[0][3] === 'Où' && rows[1][1] === 'Nike "Dunk"; 42' && rows[1][2] === '45,50', 'CSV « ; », guillemets, encodage d’Excel Windows', rows);
    const rowsV = M.lireCsv('﻿date,article,prix\n2026-04-03,Samba,30\n');
    dit(rowsV.length === 2 && rowsV[0][0] === 'date' && rowsV[1][1] === 'Samba', 'CSV « , » avec BOM', rowsV);
    // .xlsx vrai
    const ss = '<sst><si><t>Date</t></si><si><t>Article</t></si><si><t>Prix</t></si><si><r><t>Air </t></r><r><t>Max &amp; 90</t></r></si><si><t>Référence</t></si></sst>';
    const feuille = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>4</v></c></row>'
      + '<row r="2"><c r="A2" s="1"><v>46115</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>45.5</v></c><c r="D2" t="inlineStr"><is><t>CMD-778899</t></is></c></row>'
      + '<row r="3"><c r="A3" t="str"><v>05/04/2026</v></c><c r="B3" t="inlineStr"><is><t>Samba</t></is></c><c r="D3"><v>123456</v></c></row></sheetData></worksheet>';
    const wb = '<workbook><sheets><sheet name="Achats" sheetId="1" r:id="rId7"/></sheets></workbook>';
    const rels = '<Relationships><Relationship Id="rId7" Type="x" Target="worksheets/feuilleA.xml"/></Relationships>';
    const x = zip({ 'xl/workbook.xml': wb, 'xl/_rels/workbook.xml.rels': rels, 'xl/sharedStrings.xml': ss, 'xl/worksheets/feuilleA.xml': feuille }, ['xl/_rels/workbook.xml.rels']);
    const lu = await M.lireFichierAchats({ nom: 'achats.xlsx', octets: x });
    dit(lu.rows && lu.rows.length === 3 && lu.rows[1][1] === 'Air Max & 90' && lu.rows[1][0] === 46115 && lu.rows[1][2] === 45.5 && lu.rows[2][2] === '' && lu.rows[2][3] === 123456,
      '.xlsx lu sans bibliothèque (feuille nommée par ses liens, texte riche, cellule vide gardée)', lu.rows || lu.erreur);
    const apx = M.apercuImport({ rows: lu.rows, colonnes: M.reconnaitreColonnes(lu.rows[0]) });
    dit(apx[0].etat === 'ok' && apx[0].rec.date === '2026-04-03' && apx[0].rec.price === '45,50' && apx[1].etat === 'ok' && apx[1].rec.price === '' && apx[1].rec.date === '2026-04-05',
      '.xlsx ⇒ aperçu : date Excel lue, prix vide reste vide', apx.map((l) => l.rec || l.raison));
    dit((await M.lireFichierAchats({ nom: 'vieux.xls', octets: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]) })).erreur, '.xls ancien : refusé et dit');
    // aperçu : doublons par référence seulement
    const H = ['Date', 'Description', 'Prix', 'Où', 'Référence', 'N°'];
    const L = (t, ref = '', num = '', prix = '30', date = '01/11/2026') => [date, t, prix, 'Brocante', ref, num];
    const rows2 = [H,
      L('Nike Dunk 42', 'FACT-000111'),             // déjà dans VRM (hors)
      L('Nike Dunk 42', '19283746'),                 // déjà dans VRM (achat Vinted)
      L('Nike Dunk 42', 'CMD-555666'),
      L('Nike Dunk 42', 'cmd 555 666'),              // même référence normalisée ⇒ double dans le fichier
      L('Nike Dunk 42', 'CMD-999000'),               // même titre, autre référence ⇒ entre
      ...Array.from({ length: 50 }, () => L('Air Max 90 blanche 43')),   // 50 identiques sans référence ⇒ toutes entrent
      L('', 'X'), L('Sans date', '', '', '30', ''), L('Prix faux', '', '', 'vingt'),
    ];
    const ap = M.apercuImport({ rows: rows2, colonnes: M.reconnaitreColonnes(H), existants: { hors: [{ id: 'ob_1', ref: 'fact 000111' }], vinted: [{ transaction_id: 19283746 }] } });
    const et = (n) => ap.find((l) => l.n === n);
    dit(et(2).etat === 'double' && et(3).etat === 'double', 'déjà dans VRM par SA référence (achat hors plateforme, n° de transaction Vinted)', [et(2), et(3)].map((l) => l.etat));
    dit(et(4).etat === 'ok' && et(5).etat === 'double' && et(6).etat === 'ok', 'deux fois dans le fichier par la référence ; même titre + autre référence ⇒ entre', [et(4), et(5), et(6)].map((l) => l.etat));
    const air = ap.filter((l) => l.rec && l.rec.title === 'Air Max 90 blanche 43');
    dit(air.length === 50 && air.every((l) => l.etat === 'ok' && l.sansRef), '50 lignes identiques sans référence : AUCUN doublon deviné (toutes entrent, dit « sans référence »)', air.length);
    const fin = ap.slice(-3).map((l) => l.etat + ':' + l.raison);
    dit(JSON.stringify(fin) === JSON.stringify(['ecartee:Description vide', 'ecartee:Date illisible', 'ecartee:Prix illisible']), 'écartées et pourquoi (description, date, prix)', fin);
    const res = M.resumeImport(ap);
    dit(res.ok === 52 && res.doubles === 3 && res.ecartees === 3 && res.sansRef === 50, 'résumé : 52 à importer · 3 déjà là · 3 écartées', res);
    // N° et coût
    const numeroDe = (v, ms) => { const k = String(v).toUpperCase().replace(/\s/g, ''); if (!(ms > 0)) return null; return ms < Date.parse('2026-10-09') ? 'B' + k : k; };
    const etats = { 12: 'libre', 13: 'prix', 14: 'deux', B230: 'libre' };
    const etatNumero = (k) => etats[k] || 'absent';
    const rows3 = [H, L('Paire 12', '', '12', '40'), L('Paire 13', '', '13', '40'), L('Paire 14', '', '14', '40'), L('Vieille 230', '', '230', '40', '01/09/2026'),
      L('Encore 12', '', '12', '55'), L('Paire 15', '', '15', '40'), L('Paire 12 sans prix', '', '12', '')];
    const ap3 = M.apercuImport({ rows: rows3, colonnes: M.reconnaitreColonnes(H), numeroDe, etatNumero });
    const n3 = ap3.map((l) => `${l.numero}:${l.coutPose ? 'pose' : '-'}`);
    dit(JSON.stringify(n3) === JSON.stringify(['12:pose', '13:-', '14:-', 'B230:pose', '12:-', '15:-', '12:-']),
      'coût posé seulement sur une fiche UNIQUE sans prix, une fois ; « 230 » d’avant la coupure = B230', n3);
    const w = M.ecrituresImport(ap3, (() => { let i = 0; return () => 'ob_t' + (i++); })(), '2026-11-10T10:00:00Z');
    dit(JSON.stringify(w.couts) === JSON.stringify({ 12: '40,00', B230: '40,00' }) && w.achats.length === 7 && w.achats.every((a) => a.id && a.importe && a.date) && w.achats[6].price === '',
      'écritures : les achats (prix du fichier, vide gardé vide) + les seuls coûts « libres »', w.couts);
    const sansDate = M.apercuImport({ rows: [['Description', 'Prix', 'Date', 'N°'], ['X', '1', '01/11/2026', '7']], colonnes: ['titre', 'prix', 'date', 'numero'], numeroDe: () => null });
    dit(sansDate[0].numero === '' && sansDate[0].noteNumero === 'N° pas su', 'N° pas su ⇒ aucun N° (jamais deviné)', sansDate[0]);
  });

  // ── P ─────────────────────────────────────────────────────────────────────
  console.log('── P. partager une photo vers VRM');
  await essaie('P', async () => {
    const man = JSON.parse(lire('public/manifest.webmanifest'));
    const st = man.share_target || {};
    dit(st.action === '/partage-achat' && st.method === 'POST' && st.enctype === 'multipart/form-data' && st.params && st.params.files && st.params.files[0].name === 'photo' && st.params.files[0].accept.includes('image/*'),
      'le manifeste fait de VRM une cible de partage (photos)', st);
    // Le VRAI service worker, exécuté.
    const reserve = new Map();
    const caches = { open: async (nom) => ({
      match: async (k) => reserve.get(nom + '|' + (typeof k === 'string' ? k : k.url)) || undefined,
      put: async (k, r) => { reserve.set(nom + '|' + (typeof k === 'string' ? k : k.url), r); },
      delete: async (k) => reserve.delete(nom + '|' + (typeof k === 'string' ? k : k.url)),
      keys: async () => [],
    }), keys: async () => [] };
    const ecoutes = {};
    const self = { addEventListener: (t, f) => { ecoutes[t] = f; }, location: { origin: 'https://vrm.center' }, skipWaiting() {} };
    vm.runInNewContext(lire('public/sw.js'), { self, caches, clients: { claim() {} }, Response, Request, URL, fetch: async () => new Response(''), atob, console, Date, String, Number, Uint8Array });
    const envoyer = async (blob, nomFichier) => {
      const fd = new FormData(); fd.append('photo', blob, nomFichier);
      const req = new Request('https://vrm.center/partage-achat', { method: 'POST', body: fd });
      let rep = null;
      ecoutes.fetch({ request: req, respondWith: (p) => { rep = p; } });
      return rep ? await rep : null;
    };
    const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });
    const r1 = await envoyer(png, 'p.png');
    const cle = 'vrm-hl-partage|/__vrm_partage_photo';
    dit(r1 && r1.status === 303 && /\/\?tab=achats&achat=1&photo=partage$/.test(r1.headers.get('location') || '') && reserve.has(cle), 'une image partagée : rangée dans l’appareil, « Nouvel achat » ouvert avec elle', r1 && [r1.status, r1.headers.get('location')]);
    reserve.clear();
    const r2 = await envoyer(new Blob(['<script>'], { type: 'text/html' }), 'x.html');
    dit(r2 && r2.status === 303 && /achat=1$/.test(r2.headers.get('location') || '') && !reserve.has(cle), 'un fichier qui n’est pas une image : rien rangé, formulaire sans photo', r2 && r2.headers.get('location'));
    // Le lien, puis la photo prise UNE fois.
    const S = await imp('src/raccourcisSiri.js');
    const d = S.lireDemandeAchat(new URLSearchParams('tab=achats&achat=1&photo=partage'));
    const d0 = S.lireDemandeAchat(new URLSearchParams('tab=achats&achat=1'));
    dit(d && d.photoPartagee === true && d0 && !('photoPartagee' in d0), '`photo=partage` ⇒ la demande porte la photo (sinon rien de plus)', [d, d0]);
    global.caches = caches;
    const PP = await imp('src/partagePhoto.js');
    reserve.set(cle, new Response(png, { headers: { 'content-type': 'image/png', 'x-vrm-partage-at': String(Date.now()) } }));
    const b1 = await PP.prendrePhotoPartagee(), b2 = await PP.prendrePhotoPartagee();
    dit(b1 && b1.size > 0 && b2 === null, 'la photo est rendue UNE fois puis retirée');
    reserve.set(cle, new Response(png, { headers: { 'content-type': 'image/png', 'x-vrm-partage-at': String(Date.now() - 11 * 60000) } }));
    dit((await PP.prendrePhotoPartagee()) === null && !reserve.has(cle), 'une photo de plus de 10 minutes est jetée');
    const ach = lire('src/ecrans/Achats.jsx');
    dit(/if \(d\.photoPartagee\) prendrePhotoPartagee\(\)/.test(ach) && /setForm\(\(f\) => f && !f\.photo \? \{ \.\.\.f, photo: b64 \}/.test(ach), 'le formulaire « Nouvel achat » reçoit la photo (rien n’est écrit avant son clic)');
  });

  // ── A ─────────────────────────────────────────────────────────────────────
  console.log('── A. les gestes du « ? »');
  await essaie('A', async () => {
    const { ETAPES_ECRANS, ETAPES_MIN, ETAPES_MAX, MOTS_MAX_ETAPE } = require(path.join(R, 'scripts', 'aide-contenu.cjs'));
    const { PHRASES_ECRAN, JARGON } = await imp('src/phrasesEcran.js');
    const mauvais = [];
    for (const k of Object.keys(PHRASES_ECRAN)) {
      const e = ETAPES_ECRANS[k];
      if (!Array.isArray(e) || e.length < ETAPES_MIN || e.length > ETAPES_MAX) { mauvais.push(`${k} : ${e ? e.length : 0} gestes`); continue; }
      for (const t of e) {
        const mots = String(t).split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
        if (mots > MOTS_MAX_ETAPE) mauvais.push(`${k} : « ${t} » (${mots} mots)`);
        if (JARGON.test(t)) mauvais.push(`${k} : jargon dans « ${t} »`);
      }
    }
    dit(!mauvais.length, `chaque écran à phrase : ${ETAPES_MIN} à ${ETAPES_MAX} gestes, ${MOTS_MAX_ETAPE} mots au plus, sans jargon (${Object.keys(PHRASES_ECRAN).length} écrans)`, mauvais);
    const v = spawnSync(process.execPath, [path.join(R, 'scripts', 'aide-generer.cjs'), '--verifier'], { encoding: 'utf8' });
    dit(v.status === 0, 'src/aideEtapes.js et public/aide/ = ce que le générateur produit', v.stdout.trim());
    const { ETAPES_ECRANS: E2 } = await imp('src/aideEtapes.js');
    dit(JSON.stringify(E2) === JSON.stringify(ETAPES_ECRANS), 'l’app lit le même texte que le générateur');
    dit(!/<h1[^>]*>[^<]*<h1/.test(lire('public/aide/index.html')), 'l’accueil du centre d’aide a UN titre (plus de titre imbriqué)');
    const ae = lire('src/composants/AideEcran.jsx');
    dit(/import \{ ETAPES_ECRANS \} from '\.\.\/aideEtapes\.js';/.test(ae) && /\{etapes\.length \? \(\s*<ol className="vrm-aide-etapes" data-aide-etapes=\{etapes\.length\}>/.test(ae), 'la feuille du « ? » montre les gestes EN TÊTE');
  });

  // ── W ─────────────────────────────────────────────────────────────────────
  console.log('── W. le branchement');
  await essaie('W', async () => {
    const app = lire('src/App.jsx');
    dit(/importer=\{importAchats\}/.test(app), 'Achats reçoit l’import');
    dit(/numeroDe: \(v, ms\) => \{[^\n]*archiveNumeros\(\)[^\n]*return null;[^\n]*numeroExterne\(k, null, null, ms\)/.test(app), 'le N° du fichier suit la remise à zéro (`numeroExterne`, sans date ⇒ pas su)');
    dit(/if \(f\.length !== 1 \|\| prixAchatDe\(f\[0\], u\) != null\) continue;/.test(app), 'un prix déjà posé n’est jamais remplacé (relu au moment d’écrire)');
    const ach = lire('src/ecrans/Achats.jsx');
    dit(/data-achat-hors-importer/.test(ach) && /<ImportAchatsFeuille /.test(ach), '« Importer un tableur » dans « Nouvel achat »');
    const comp = lire('src/composants/ImportAchats.jsx');
    dit(/onClick=\{importer\} data-imp-importer/.test(comp) && !/useEffect\([^)]*onImporter/.test(comp), 'rien n’est écrit sans « Importer N achats »');
    const pkg = JSON.parse(lire('package.json'));
    dit(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((n) => /xlsx|sheet|exceljs|zip|papaparse/i.test(n)), 'aucune dépendance ajoutée pour lire les tableurs');
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
