#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LOT plateformes-restes (16 nov. 2026)
//         node scripts/audit-plateformes-restes.cjs [--mutation=…] [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE les vraies règles (aucune n'est recopiée ici) :
//   D (38) la douchette reconnaît eBay (n° de commande, SKU « VRM-{N°} ») et Leboncoin
//          (n° de transaction, n° du bordereau Mondial Relay) PAR IDENTITÉ — src/douchette.js ;
//          50 commandes au même titre : chaque n° désigne LA sienne, le titre rien ;
//   R (40) les achats Leboncoin et Vestiaire entrent dans « Relier un achat » sous leur
//          identité (`lbc:{n°}`, `vc:{n°}`), prix seulement sous la forme mesurée —
//          src/achatsAutresRelier.js ;
//   C (41) l'extension reçoit la catégorie Vestiaire (`categorieVcDemandee`, background.js,
//          dans une VM) : posée seulement si chaque libellé existe tel quel dans le catalogue
//          capté ; « Publier partout » ne la met plus « à finir » quand l'extension la porte ;
//   V (42) Vestiaire : « Finalisé par plateforme » et « CA entre deux dates » lisent UNE règle
//          (`finalisesVestiaire`) : la même somme, le même nombre hors total ;
//   F (43) la facture Pro d'une commande eBay à plusieurs lignes : scripts/audit-factures-autres.cjs.
// `--mutation=…` réaffaiblit une règle dans une copie : rouge exigé ; `--prouve` les joue toutes.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'douchette-sku-nu': ["const skus = prete ? lignes.map((l) => (l && typeof l.sku === 'string' && RE_SKU_VRM.test(l.sku) ? l.sku : '')).filter(Boolean) : [];", "const skus = prete ? lignes.map((l) => (l && typeof l.sku === 'string' ? l.sku.replace(/^VRM-?/i, '') : '')).filter(Boolean) : [];", 'src/douchette.js'],
  'douchette-annulee-prete': ["const prete = typeof engagee === 'function' ? engagee(o) !== false : true;", 'const prete = true;', 'src/douchette.js'],
  'douchette-achat-lbc': ["if (!v || v.isSeller !== true || v.txId == null || String(v.txId).trim() === '') continue;", "if (!v || v.txId == null || String(v.txId).trim() === '') continue;", 'src/douchette.js'],
  'douchette-pas-branchee': ['L.push(...lignesAutresSites({', 'L.push(...[]||({', 'src/App.jsx'],
  'relier-prix-article': ['const c = Number(o.prixListe);', 'const c = Number(o.price);', 'src/achatsAutresRelier.js'],
  'relier-annulee': ["if (typeof annulee === 'function' && annulee(o)) continue;", '', 'src/achatsAutresRelier.js'],
  'relier-pas-branche': ['const liste = [...out, ...autresSites].map(', 'const liste = [...out].map(', 'src/App.jsx'],
  'vc-cat-approchee': ['const ss = (cs[0].subCategories || []).filter((x) => x && norm(x.title) === norm(S));', 'const ss = (cs[0].subCategories || []).filter((x) => x && (norm(x.title).startsWith(norm(S).slice(0, 4))));', 'vinted-sync-extension/background.js'],
  'vc-cat-publie-quand-meme': ["r.ad.publier = msg.publier !== false && r.ad.categorieDemandee !== 'introuvable';", 'r.ad.publier = msg.publier !== false;', 'vinted-sync-extension/background.js'],
  'vc-cat-toujours-finir': ["const portee = !!ctx.vcCategorie && !corr.demandes.length", "const portee = false && !corr.demandes.length", 'src/publierPartout.js'],
  'vc-cat-finir-ignore': ['const finir = [...new Set([...arr(e.finir), ...arr(r.finir)])];', 'const finir = arr(e.finir);', 'src/publierPartout.js'],
  'vc-fin-tout-ou-rien': ["return { ca: cents / 100, etat: f.pasSur ? 'au-moins' : 'lu', auMoins: f.pasSur > 0, pasSur: f.pasSur, n: f.sures.length };", "if (f.pasSur) return { ca: null, etat: 'pas-sur', pasSur: f.pasSur, n: 0 };\n  return { ca: cents / 100, etat: 'lu', auMoins: false, pasSur: 0, n: f.sures.length };", 'src/caAutresParJour.js'],
  'vc-fin-deux-regles': ["const r = resumeFinaliseVestiaire(ventesVc, { etapeMotVc, vcVenteAnnulee, montantRecuVc, dateVenteVc });", "const r = { etat: 'lu', ca: 0 };", 'src/ecrans/Stats.jsx'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
// Les fichiers lus : la racine, ou une copie MUTÉE de ce qu'il faut (jamais tout src/ : le disque est compté).
let BASE = R;
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  if (!MUTS[MUT]) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plat-restes-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/\/node_modules(\/|$)/.test(s) && !/\.(png|jpe?g|webp|onnx|woff2?)$/i.test(s) });
  fs.mkdirSync(path.join(d, 'vinted-sync-extension'), { recursive: true });
  fs.copyFileSync(path.join(R, 'vinted-sync-extension', 'background.js'), path.join(d, 'vinted-sync-extension', 'background.js'));
  fs.cpSync(path.join(R, 'api', '_lib'), path.join(d, 'api', '_lib'), { recursive: true });
  const f = path.join(d, MUTS[MUT][2]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  BASE = d;
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)))); };
const lire = (f) => { try { return fs.readFileSync(path.join(BASE, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const url = (f) => pathToFileURL(path.join(BASE, f)).href;

(async () => {
  let D, A, P, CA, CN, VR;
  try { D = await import(url('src/douchette.js')); } catch (e) { dit(false, 'src/douchette.js se charge', e.message); }
  try { A = await import(url('src/achatsAutresRelier.js')); } catch (e) { dit(false, 'src/achatsAutresRelier.js existe et se charge', e.message); }
  try { P = await import(url('src/publierPartout.js')); } catch (e) { dit(false, 'src/publierPartout.js se charge', e.message); }
  try { CA = await import(url('src/caAutresParJour.js')); } catch (e) { dit(false, 'src/caAutresParJour.js se charge', e.message); }
  try { CN = await import(url('src/cibleNotif.js')); } catch (e) { dit(false, 'src/cibleNotif.js se charge', e.message); }
  try { VR = await import(url('api/_lib/vestiaire-regle.js')); } catch (e) { dit(false, 'api/_lib/vestiaire-regle.js se charge', e.message); }
  const app = sansCommentaires(lire('src/App.jsx'));

  // ── D · LA DOUCHETTE, eBAY ET LEBONCOIN ───────────────────────────────────
  console.log('\n── D. (38) La douchette : eBay et Leboncoin par identité');
  if (D && typeof D.lignesAutresSites === 'function') {
    const engagee = (o) => !/CANCEL/i.test(String((o.cancelStatus && o.cancelStatus.cancelState) || ''));
    const cmd = (i, o = {}) => ({ orderId: `12-${String(10000 + i)}-00000`, _compte: 'principal', lineItems: [{ title: 'Nike Air Max 90 blanche', sku: `VRM-${i}` }], ...o });
    const ebay = []; for (let i = 1; i <= 50; i++) ebay.push(cmd(i));
    const mr = (n) => `https://www.mondialrelay.fr/suivi-de-colis/?ens=MRLBCOIN&exp=${n}&cp=35000`;
    const lbc = [
      { txId: '2849301726', isSeller: true, title: 'Nike Air Max 90 blanche', label: { reference: '41234567', trackingUrl: mr('41234567') } },
      { txId: '2849301799', isSeller: false, title: 'Nike Air Max 90 blanche', label: { reference: '49999999', trackingUrl: mr('49999999') } },
    ];
    const L = D.lignesAutresSites({ ebay, lbc, engagee });
    const r1 = D.venteDuCode('12-10017-00000', L);
    dit(r1.etat === 'trouve' && r1.ligne.site === 'ebay' && r1.ligne.orderId === '12-10017-00000', 'D1 eBay : le n° de commande lu ⇒ CETTE commande', r1);
    let bons = 0; for (let i = 1; i <= 50; i++) { const r = D.venteDuCode(`VRM-${i}`, L); if (r.etat === 'trouve' && r.ligne.orderId === `12-${String(10000 + i)}-00000`) bons++; }
    dit(bons === 50, `D2 50 commandes au même titre : chaque SKU « VRM-{N°} » désigne LA sienne (${bons}/50)`);
    dit(D.venteDuCode('Nike Air Max 90 blanche', L).etat !== 'trouve' && D.venteDuCode('17', L).etat !== 'trouve' && D.venteDuCode('000017', L).etat !== 'trouve', 'D3 le titre, ou le N° nu, ne désigne rien');
    const deux = D.lignesAutresSites({ ebay: [cmd(7), cmd(7, { orderId: '99-00007-00000' })], engagee });
    dit(D.venteDuCode('VRM-7', deux).etat === 'ambigu', 'D4 deux commandes engagées au même SKU ⇒ rien n’est ouvert');
    const annul = D.lignesAutresSites({ ebay: [cmd(8, { cancelStatus: { cancelState: 'CANCELED' } }), cmd(8, { orderId: '99-00008-00000' })], engagee });
    const r5 = D.venteDuCode('VRM-8', annul);
    dit(r5.etat === 'trouve' && r5.ligne.orderId === '99-00008-00000', 'D5 une commande annulée ne prête pas son SKU (la vente suivante de la paire est trouvée)', r5);
    const r6 = D.venteDuCode('2849301726', L), r6b = D.venteDuCode('41234567', L);
    const code26 = '00' + '41234567' + '1234567890123456';
    const r6c = D.venteDuCode(code26, L);
    dit(r6.etat === 'trouve' && r6.ligne.site === 'leboncoin' && r6b.etat === 'trouve' && r6b.ligne.tx === '2849301726' && r6c.etat === 'trouve' && r6c.ligne.tx === '2849301726', 'D6 Leboncoin : n° de transaction, n° du bordereau, code-barres Mondial Relay (26 chiffres) ⇒ CETTE vente', [r6.etat, r6b.etat, r6c.etat]);
    dit(D.venteDuCode('49999999', L).etat === 'inconnu' && D.venteDuCode('2849301799', L).etat === 'inconnu', 'D7 un ACHAT Leboncoin (isSeller false) n’est jamais « la vente à envoyer »');
    dit(D.expDeLienSuivi('https://faux.example/?exp=41234567') === '' && D.expDeLienSuivi(mr('41234567')) === '41234567', 'D8 le n° du lien de suivi : seulement un lien Mondial Relay');
  } else dit(false, 'D src/douchette.js porte lignesAutresSites');
  dit(/L\.push\(\.\.\.lignesAutresSites\(\{/.test(app) && /numEbay: numLigneEbay, engagee: commandeEbayEngagee/.test(app), 'D9 App : la douchette lit eBay et Leboncoin (`lignesAutresSites`, numéros et engagement de l’app)');
  dit(/if \(l\.site === 'ebay'\) \{ DEMANDE_EBAY_CIBLE\.compte = l\.compte \|\| null; DEMANDE_EBAY_CIBLE\.id = l\.orderId;/.test(app) && /cible=lbcvente&tx=\$\{encodeURIComponent\(l\.tx\)\}/.test(app), 'D10 trouvée ⇒ eBay : SA commande (eBay → Ventes) ; Leboncoin : SA carte (cible lbcvente)');
  if (CN) {
    const c = CN.lireCible({ cible: 'lbcvente', tx: '2849301726' });
    const sel = c ? CN.selecteursCible(c).essais : [];
    dit(!!c && sel[0] === '[data-cible~="lbcvente:2849301726"]' && sel.includes('[data-lbc-vente="2849301726"]') && CN.lireCible({ cible: 'lbcvente' }) === null && CN.attrCible(['lbcvente', '2849301726']) === 'lbcvente:2849301726', 'D11 la cible « lbcvente » : par SON n° seulement (sans n° ⇒ rien)', sel);
  }
  const lbcEcran = sansCommentaires(lire('src/ecrans/Leboncoin.jsx'));
  dit(/className="vrm-lbc-package" key=\{o\.txId\} data-lbc-vente=\{o\.txId\} data-cible=\{attrCible\(\['lbcvente', o\.txId\]\)\}/.test(lbcEcran), 'D12 la carte Leboncoin porte SON n° de transaction (data-cible lbcvente)');

  // ── R · « RELIER UN ACHAT » : LEBONCOIN ET VESTIAIRE ──────────────────────
  console.log('\n── R. (40) Les achats Leboncoin et Vestiaire dans « Relier un achat »');
  if (A) {
    const lbcAchats = [];
    for (let i = 1; i <= 50; i++) lbcAchats.push({ txId: String(5000 + i), isSeller: false, title: 'Adidas Samba OG', price: 2500, prixListe: 2928, dateVente: '2026-11-0' + (1 + (i % 9)) + 'T10:00:00Z', image: 'https://img.leboncoin.fr/a.jpg', accountName: 'compte_banc' });
    lbcAchats.push({ txId: '6001', isSeller: false, title: 'Annulé', price: 1000, prixListe: 1200, stepStatus: 'cancelled' });
    lbcAchats.push({ txId: '6002', isSeller: true, title: 'Une VENTE', price: 1000, prixListe: 1000 });
    lbcAchats.push({ txId: '6003', isSeller: false, title: 'Prix pas lu', price: 1000, prixListe: 'abc' });
    const vcAchats = { 'VC-77': { nom: 'Sac banc', photo: 'https://images.vestiairecollective.com/a.jpg', date: '2026-11-02', etat: 'Livré', montant: { valeur: 99 } }, 'VC-78': { nom: 'Annulé', etat: 'Annulée' } };
    const out = A.achatsAutresPourRelier({ lbcAchats, vcAchats, annulee: (o) => o.stepStatus === 'cancelled' });
    const ids = out.map((x) => x.transaction_id);
    dit(ids.filter((x) => x.startsWith('lbc:')).length === 51 && new Set(ids).size === ids.length, 'R1 50 achats Leboncoin au même titre ⇒ 50 lignes, chacune SON identité `lbc:{n°}` (+ celui au prix pas lu)', ids.length);
    const a1 = out.find((x) => x.transaction_id === 'lbc:5001');
    dit(a1 && a1.price && a1.price.amount === '29.28' && a1.price.currency_code === 'EUR', 'R2 Leboncoin : le prix proposé = le total payé (`prixListe`, forme mesurée), jamais l’article seul', a1);
    dit(!ids.includes('lbc:6001') && !ids.includes('lbc:6002'), 'R3 un achat annulé, ou une VENTE (isSeller true), n’est pas proposé');
    const a3 = out.find((x) => x.transaction_id === 'lbc:6003');
    dit(a3 && !a3.price, 'R4 prix illisible ⇒ aucun prix (il le tape)');
    const v1 = out.find((x) => x.transaction_id === 'vc:VC-77');
    dit(v1 && !v1.price && v1.title === 'Sac banc' && !ids.includes('vc:VC-78'), 'R5 Vestiaire : titre, photo, date ; AUCUN prix (forme jamais vue en base) ; annulé écarté', v1);
    dit(A.siteDeAchat({ transaction_id: 'lbc:1' }) === 'leboncoin' && A.siteDeAchat({ transaction_id: '123' }) === 'vinted', 'R6 le site d’une ligne se lit sur son identité');
    dit(A.achatsAutresPourRelier({}).length === 0, 'R7 rien lu ⇒ rien proposé (jamais inventé)');
  }
  dit(/const liste = \[\.\.\.out, \.\.\.autresSites\]\.map\(/.test(app) && /achatsAutresPourRelier\(\{ lbcAchats: \(lbcVentes && lbcVentes\.achats\) \|\| null/.test(app), 'R8 App : la feuille « Relier » reçoit ces achats');

  // ── C · LA CATÉGORIE VESTIAIRE ENVOYÉE À L'EXTENSION ──────────────────────
  console.log('\n── C. (41) La catégorie Vestiaire reçue par l’extension');
  const BG = lire('vinted-sync-extension/background.js');
  const a = BG.indexOf('function categorieVcDemandee(dem, catalogue)');
  const b = a >= 0 ? BG.indexOf('\n}\n', a) : -1;
  if (a > 0 && b > a) {
    const ctx = vm.createContext({}); vm.runInContext(BG.slice(a, b + 2) + '\nthis.f = categorieVcDemandee;', ctx);
    const f = ctx.f;
    const cat = { data: [
      { id: 1, title: 'Mode femme', categories: [{ id: 11, title: 'Chaussures', subCategories: [{ id: 111, title: 'Baskets' }, { id: 112, title: 'Bottes' }] }] },
      { id: 2, title: 'Mode homme', categories: [{ id: 21, title: 'Chaussures', subCategories: [{ id: 211, title: 'Baskets' }, { id: 212, title: 'Chaussures de sport' }] }] },
    ] };
    const r = f({ univers: 'Mode homme', categorie: 'Chaussures', sous: 'Chaussures de sport' }, cat);
    dit(r && r.ids.univers === 2 && r.ids.categorie === 21 && r.ids.sous === 212 && r.sous === 'Chaussures de sport', 'C1 libellés exacts du catalogue capté ⇒ posée, avec SES identifiants', r);
    dit(f({ univers: 'Mode femme', categorie: 'Chaussures', sous: 'Chaussures de sport' }, cat) === null, 'C2 une sous-catégorie qui n’existe pas DANS cet univers ⇒ rien (jamais celle d’un autre univers)');
    dit(f({ univers: 'Mode homme', categorie: 'Chaussures', sous: 'Basket' }, cat) === null && f({ univers: 'Mode homme', categorie: 'Chaussures', sous: 'Chaussures' }, cat) === null, 'C3 un libellé approché ⇒ rien');
    dit(f({ univers: 'Mode homme', categorie: 'Chaussures', sous: 'Baskets' }, null) === null && f({ univers: 'Mode homme', categorie: 'Chaussures' }, cat) === null, 'C4 catalogue pas capté, ou choix incomplet ⇒ rien');
    dit(!!f({ univers: '  mode   HOMME ', categorie: 'chaussures', sous: 'baskets' }, cat), 'C5 casse et espaces mis à part, le même libellé');
  } else dit(false, 'C background.js porte categorieVcDemandee (capacité vccategorie)');
  const bgS = sansCommentaires(BG);
  dit(/r\.ad\.publier = msg\.publier !== false && r\.ad\.categorieDemandee !== 'introuvable';/.test(bgS) && /annonceVestiaire\(id, msg\.categorie && typeof msg\.categorie === 'object' \? msg\.categorie : null\)/.test(bgS), 'C6 introuvable telle quelle ⇒ le dépôt s’ouvre SANS publier (jamais une autre catégorie)');
  dit(/vccategorie: '5\.\d+\.0'/.test(app) && /const vcCategorie = extSait\('vccategorie'\) === 'ok';/.test(app) && /\.\.\.\(categorie \? \{ categorie \} : \{\}\)/.test(app), 'C7 App : la catégorie part seulement à une extension qui sait la recevoir (`vccategorie`)');
  if (P) {
    const regles = { titreLbc: (m, t) => String(t || '').slice(0, 50), titreVc: (m, t) => String(t || '').slice(0, 80), titreEbay: (t) => String(t || '').slice(0, 80),
      descriptionLbc: (o) => `${o.texte || ''}\n\nRéf. ${o.ref}`, descriptionEbay: (p) => p.desc || '', etatsLbc: ['Neuf avec étiquette', 'Très bon état', 'Bon état', 'État satisfaisant'], categorieLbc: () => 'Chaussures enfants' };
    const photos = ['https://images1.vinted.net/a/1.jpg', 'https://images1.vinted.net/a/2.jpg'];
    const paire = { id: '9001', num: '1', title: 'Basket fille', taille: '30', marque: 'Nike', etat: 'Très bon état', photos, desc: 'x', prix: 20, cover: photos[0], catalogId: '2719' };
    const ctxP = (o) => ({ enLigne: { leboncoin: false, vestiaire: false, ebay: false }, ext: { leboncoin: '', vestiaire: '', ebay: '' }, regles, lbcCriteres: true, memoire: null, ...o });
    const vc = (l) => l.sites.find((x) => x.site === 'vestiaire');
    let sans = null, avec = null;
    try { sans = vc(P.lignePartout(paire, ctxP({ vcCategorie: false }))); avec = vc(P.lignePartout(paire, ctxP({ vcCategorie: true }))); } catch (e) { dit(false, 'C8 lignePartout s’exécute', e.message); }
    if (sans && avec) {
      dit(sans.finir.some((x) => /Univers « Mode fille »/.test(x)) && !avec.finir.some((x) => /Univers|Sous-catégorie|Catégorie/.test(x)), 'C8 une extension qui reçoit la catégorie entière : plus « à finir sur Vestiaire » ; sans elle, à finir (nommée)', [sans.finir, avec.finir]);
    }
    const plan = [{ cle: '9001:vestiaire', id: '9001', num: '1', site: 'vestiaire', finir: [], apercu: { num: '1', ref: 'VRM-1' } }];
    const res = await P.executerPartout({ plan, envoyer: { vestiaire: async () => ({ accepte: true, jobId: 'vc:9001', etape: 'depot', categorie: 'introuvable', finir: ['Catégorie'] }) }, attendre: async () => ({ etape: 'fait' }), surEtat: () => {} });
    const e9 = res && (res['9001:vestiaire'] || (res.etats && res.etats['9001:vestiaire']));
    dit(e9 && e9.etat === 'a-finir' && /Catégorie/.test(e9.raison || ''), 'C9 l’extension dit la catégorie introuvable ⇒ « à finir sur Vestiaire », jamais « publié »', e9);
  }

  // ── V · VESTIAIRE : UNE SEULE RÈGLE DU FINALISÉ ────────────────────────────
  console.log('\n── V. (42) Vestiaire : « Finalisé par plateforme » = « CA entre deux dates »');
  if (CA && VR && typeof CA.finalisesVestiaire === 'function') {
    const RR = { etapeMotVc: VR.etapeMotVc, vcVenteAnnulee: VR.vcVenteAnnulee, montantRecuVc: VR.montantRecuVc, dateVenteVc: VR.dateVenteVc };
    const v = (id, o) => ({ id, productId: id, titre: 'Sac', date: '2026-11-03T10:00:00+01:00', ...o });
    const sure = (id, eur) => v(id, { etat: 'Versée', montant: { valeur: eur, devise: 'EUR', cle: 'sellerEarning' } });
    const ventes = [sure('1', 100), sure('2', 50.5), v('3', { etat: 'Versée', montant: null }), v('4', { etat: 'Annulée', montant: { valeur: 70, devise: 'EUR', cle: 'sellerEarning' } }), v('5', { etat: 'En cours', montant: { valeur: 30, devise: 'EUR', cle: 'sellerEarning' } })];
    const f = CA.finalisesVestiaire(ventes, RR);
    const res = CA.resumeFinaliseVestiaire(ventes, RR);
    const jour = CA.caAutresParJour({ lbc: [], ebay: [], vestiaire: ventes, R: { ...RR, lbcAnnulee: () => false, lbcFinalisee: () => false, commandeEbayEngagee: () => false, montantRecuEbay: () => ({ eur: null }) } });
    const plage = CA.sommePlage(jour.parJour, '', '');
    const nSures = f.sures.length;
    dit(nSures >= 1 && res.ca === Math.round(f.sures.reduce((s, x) => s + x.eur * 100, 0)) / 100 && Math.round(plage.ca * 100) === Math.round(res.ca * 100) && plage.count === res.n, `V1 la même somme et le même nombre dans les deux écrans (${res.ca} € sur ${res.n})`, { res, plage });
    dit(res.pasSur === f.pasSur && (jour.horsTotal.Vestiaire || 0) === f.pasSur, 'V2 le même nombre « au montant pas sûr », hors total, dans les deux', { res, h: jour.horsTotal });
    if (f.pasSur > 0) dit(res.auMoins === true && res.ca != null, 'V3 des sûres ET des pas sûres ⇒ la somme des sûres, « au moins » (plus jamais « — » pour tout)', res);
    else dit(false, 'V3 le banc sert une vente finalisée au montant pas sûr', f);
    dit(CA.resumeFinaliseVestiaire([v('3', { etat: 'Versée', montant: null })], RR).ca === null && CA.resumeFinaliseVestiaire(null, RR).etat === 'pas-lu' && CA.resumeFinaliseVestiaire(undefined, RR).etat === 'lecture', 'V4 rien de sûr ⇒ « — » (jamais « au moins 0,00 € ») ; pas lu ≠ aucune');
  } else dit(false, 'V src/caAutresParJour.js porte finalisesVestiaire');
  const stats = sansCommentaires(lire('src/ecrans/Stats.jsx'));
  const corpsVc = (stats.split('const caVestiaireFinalise = (ventesVc) => {')[1] || '').split('\n};')[0];
  dit(/const r = resumeFinaliseVestiaire\(ventesVc, \{ etapeMotVc, vcVenteAnnulee, montantRecuVc, dateVenteVc \}\);/.test(corpsVc) && !/let ca = 0, n = 0, pasSur = 0;/.test(stats) && !/for \(const v of ventesVc\)/.test(stats), 'V5 « Finalisé par plateforme » consomme la règle (aucune boucle à lui)');
  dit(/data-stats-total-au-moins=/.test(stats) && /tr\('stats\.totalAuMoins'\)/.test(stats), 'V6 le total dit « au moins » quand une plateforme l’est');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
