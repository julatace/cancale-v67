// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — COPIE DES ANNONCES PAR COMPTE + CARTE « PROTÈGE TON COMPTE VRM »
//        node scripts/audit-copie-annonces.cjs           (--prouve : mutations ⇒ rouge)
// ═══════════════════════════════════════════════════════════════════════════
// C. La copie (src/copieAnnonces.js), EXÉCUTÉE sur un dressing inventé :
//    C1 un zip qui se dézippe en UN dossier (LISEZ-MOI.txt, annonces.csv, photos/) ;
//    C2 le N° vient de l'IDENTIFIANT d'annonce (deux annonces au même titre, deux N°) ;
//    C3 une description pas lue reste vide et c'est DIT (« pas su » ≠ « rien ») ;
//    C4 une photo illisible n'arrête rien et elle est COMPTÉE ; le prix Vinted (objet) est lu ;
//    C5 lecture seule : le composant n'écrit rien (aucun save, aucun POST), il ne lit que
//       les photos, sans cookie ; il est rangé dans Paramètres → Mes comptes.
// M. La carte (src/CarteDoubleVerif.jsx) :
//    M1 trois états lus sur la session : inactive · active · pas su (rien montré) ;
//    M2 jamais au démarrage (seulement Paramètres), « Plus tard » la range, « Activer »
//       ouvre le panneau existant (double vérification).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.RACINE || path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const lire = (f) => { try { return sansCommentaires(fs.readFileSync(path.join(R, f), 'utf8')); } catch (_) { return ''; } };

(async () => {
  console.log('\n── C. La copie, exécutée');
  try {
    const c = await import(pathToFileURL(path.join(R, 'src', 'copieAnnonces.js')).href);
    const z = await import(pathToFileURL(path.join(R, 'src', 'exportDonnees.js')).href);
    const P = (n) => `https://images1.vinted.net/t/photo-${n}.jpg`;
    const dressing = {
      items: [
        { id: 111, title: 'Nike Air Max 90 blanches', price: { amount: '60.0', currency_code: 'EUR' }, description: 'Taille 42; très bon "état"', photos: [{ url: P(1) }, { url: P(2) }] },
        { id: 222, title: 'Nike Air Max 90 blanches', price: { amount: '65.5', currency_code: 'EUR' }, photos: [{ full_size_url: P(3) }] },
        { id: 333, title: 'Adidas Samba', price: '40', is_closed: true, photos: [] },
      ],
      _vrmAConfirmer: [{ id: 444, title: 'Asics', price: { amount: '30' } }],
      _vrmLu: '2026-11-10T10:00:00Z',
    };
    const fiches = { 111: { numero: '12' }, 222: { numero: '13' }, 999: { numero: '77', title: 'Nike Air Max 90 blanches' } };
    const an = c.annoncesDuCompte(dressing, fiches);
    const photos = new Map([[P(1), new Uint8Array([1, 2, 3])], [P(3), new Uint8Array([4, 5])]]);
    const quand = new Date(2026, 10, 12, 9, 0, 0);
    const { fichiers, resume } = c.fichiersCopie({ login: 'shop_banc', annonces: an, photos, quand, lu: dressing._vrmLu });
    const zip = z.lireZipStocke(z.zipStocke(fichiers, quand));
    const dossiers = new Set(zip.map((f) => f.nom.split('/')[0]));
    dit(dossiers.size === 1 && [...dossiers][0] === 'VRM-annonces-shop_banc-2026-11-12' && zip.every((f) => f.crcOk), 'C1 un seul dossier, zip lisible', [...dossiers].join(','));
    const noms = zip.map((f) => f.nom.slice(f.nom.indexOf('/') + 1));
    dit(noms.includes('LISEZ-MOI.txt') && noms.includes('annonces.csv') && noms.includes('photos/N12-1.jpg') && noms.includes('photos/N13-1.jpg'), 'C1 LISEZ-MOI, annonces.csv, photos nommées par N°', noms.join(' '));
    const csv = zip.find((f) => /annonces\.csv$/.test(f.nom)).texte.replace(/^﻿/, '').split('\r\n');
    const ligne = (id) => csv.find((l) => l.includes(`/items/${id}`)) || '';
    dit(ligne(111).startsWith('12;') && ligne(222).startsWith('13;') && !csv.some((l) => l.startsWith('77;')), 'C2 le N° par identifiant d’annonce : même titre, deux N°, jamais une fiche d’un autre identifiant', csv.slice(1).join(' | '));
    dit(/"Taille 42; très bon ""état"""/.test(ligne(111)) && /;60,00;EUR;en ligne;/.test(ligne(111)) && /;65,50;/.test(ligne(222)), 'C4 prix lu dans l’objet Vinted, cellules échappées');
    dit(/;fermée;/.test(ligne(333)) && /;à confirmer;/.test(ligne(444)), 'C4 l’état de chaque annonce est dit (fermée, à confirmer)');
    const lis = zip.find((f) => /LISEZ-MOI/.test(f.nom)).texte;
    dit(resume.descriptions === 1 && /Descriptions : 1 sur 4/.test(lis) && /pas été lues/.test(lis), 'C3 description pas lue : vide et DITE', lis.replace(/\r\n/g, ' | ').slice(0, 200));
    dit(resume.photos === 2 && resume.photosManquees === 1 && /1 pas lisibles/.test(lis), 'C4 photo illisible comptée et dite, le zip part quand même', JSON.stringify(resume));
  } catch (e) { dit(false, 'src/copieAnnonces.js s’exécute', String(e && e.message || e).slice(0, 160)); }
  const comp = lire('src/CopieAnnonces.jsx');
  dit(comp && !/\bsave\(/.test(comp) && !/method:\s*'(POST|PATCH|PUT|DELETE)'/.test(comp) && /credentials: 'omit'/.test(comp) && !/vmrCmd|appelEbay|\/api\//.test(comp), 'C5 lecture seule : rien écrit, rien envoyé, photos lues sans cookie');
  const reg = lire('src/ecrans/Reglages.jsx');
  dit(/id:'copieannonces'[^\n]*<CopieAnnonces comptes=/.test(reg) && reg.indexOf("id:'copieannonces'") > reg.indexOf("{ id:'comptes', titre:") && reg.indexOf("id:'copieannonces'") < reg.indexOf("{ id:'emails-reglages'"), 'C5 dans Paramètres → Mes comptes');

  console.log('\n── M. La carte « Protège ton compte VRM »');
  const carte = lire('src/CarteDoubleVerif.jsx');
  const m = /export const etatDoubleVerif = ([\s\S]*?\n};)/.exec(carte);
  let etat = null; try { etat = m ? eval('(' + m[1].replace(/;\s*$/, '') + ')') : null; } catch (_) { etat = null; }
  dit(!!etat && etat({ totp: [] }) === 'inactive' && etat({ totp: ['f1'] }) === 'active' && etat({}) === null && etat(null) === null, 'M1 trois états : inactive · active · pas su');
  dit(/etatDoubleVerif\(AUTH\.session\) !== 'inactive'\) return null/.test(carte), 'M1 montrée seulement si LUE inactive (pas su ⇒ rien)');
  dit(/<CarteDoubleVerif\/>/.test(reg) && !/CarteDoubleVerif/.test(lire('src/App.jsx')) && !/CarteDoubleVerif/.test(lire('src/main.jsx')), 'M2 seulement dans Paramètres, jamais au démarrage');
  dit(/Plus tard/.test(carte) && /setItem\(CLE_CARTE_MFA, '1'\)/.test(carte) && /DEMANDE_REGLAGE_SOUS\.id = 'double'/.test(carte), 'M2 « Plus tard » la range ; « Activer » ouvre le panneau existant');

  console.log(ko ? `\n❌ ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ${ok} verts, 0 rouge`);
  if (process.argv.includes('--prouve') && !ko) prouver();
  process.exit(ko ? 1 : 0);
})();

function prouver() {
  const MUT = [
    ['src/copieAnnonces.js', 'const f = fiches && fiches[id];', 'const f = fiches && Object.values(fiches).find((x) => x && x.title === it.title) || fiches[id];'],
    ['src/copieAnnonces.js', "description: typeof it.description === 'string' ? it.description : null,", "description: typeof it.description === 'string' ? it.description : '',"],
    ['src/copieAnnonces.js', 'else nManquees++;', ';'],
    ['src/CarteDoubleVerif.jsx', "if (!Array.isArray(t)) return null;", "if (!Array.isArray(t)) return 'inactive';"],
    ['src/CopieAnnonces.jsx', "credentials: 'omit'", "credentials: 'include'"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copie-'));
  for (const d of ['src', 'package.json']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true });
  let rouges = 0;
  for (const [f, a, b] of MUT) {
    const p = path.join(tmp, f), avant = fs.readFileSync(p, 'utf8');
    if (!avant.includes(a)) { console.log(`  ❌ mutation introuvable : ${f} « ${a.slice(0, 50)} »`); continue; }
    fs.writeFileSync(p, avant.replace(a, b));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, RACINE: tmp }, encoding: 'utf8' });
    fs.writeFileSync(p, avant);
    if (r.status !== 0) rouges++; else console.log(`  ❌ mutation NON vue : ${f} « ${a.slice(0, 60)} »`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${rouges}/${MUT.length} mutations rendent l’audit rouge`);
  if (rouges !== MUT.length) process.exit(1);
}
