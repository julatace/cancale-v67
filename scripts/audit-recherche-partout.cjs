#!/usr/bin/env node
// ── audit-recherche-partout — LA RECHERCHE PARTOUT (21 nov., choix n° 15 de Julien) ──────────────────────────────────
// Exécute la VRAIE règle (src/rechercheUnique.js) sur des données INVENTÉES. Il exige :
//   P1 un N° se trouve ENTIER, par sa clé `cleNum` : « 7 » trouve le N°7 (et « 007 »), jamais 70, 17, 107 ni B7 ; « b7 » trouve B7 ;
//   P2 un nombre dans un texte (titre, taille, lieu) se compare entier : « 7 » ne sort pas « Air Max 270 » ni « étagère 70 » ;
//   P3 50 paires au MÊME titre, N°1 à 50 : « 23 » ⇒ le N°23 seul ; le titre ⇒ 50 lignes, 50 identités distinctes ;
//   P4 chaque identité trouve SON objet (pseudo, n° de suivi, code de retrait, n° de transaction, commande d'un autre site) ;
//   P5 les fautes de frappe, pour le TEXTE seulement : « addidas », « nkie », « spezail », « jordn » trouvent, marqués
//      `approx`, rangés après les trouvailles exactes ; une identité à une faute près (code, suivi, transaction, N°) ne trouve
//      RIEN ; un mot qui a des chiffres n'est jamais « à peu près » ; les accents ne comptent pas (« velo » = « vélo ») ;
//   P6 instantané : index + recherche < 300 ms sur ~10 000 objets, une frappe (même sans résultat, la plus chère) < 16 ms ;
//   P7 l'écran : chaque rangée porte le logo de SON site (`siteDe`), « à une lettre près » est DIT, les intertitres ne sont
//      pas en capitales, les rangées sont fines (pas de carte arrondie) ; ⌘K et « / » ouvrent la recherche ; récents gardés.
//   node scripts/audit-recherche-partout.cjs [--prouve]
'use strict';
require('./_source-app.cjs').brancher();
const T = require('./_travail-recherche.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');
const F_REGLE = path.join(RAC, 'src', 'rechercheUnique.js');
const F_APP = path.join(RAC, 'src', 'App.jsx');
const F_ECRAN = path.join(RAC, 'src', 'rechercheEcran.js');
const F_FILS = path.join(RAC, 'src', 'ecrans', 'FilsTous.jsx');
const PROUVE = process.argv.includes('--prouve');

const MUTATIONS = {
  'numero-partiel': ['regle', "else if (numeroLike && e.numK === cleNumero(qa)) { par = 'numero'; valeur = e.numero; }", "else if (numeroLike && e.numK.includes(qa)) { par = 'numero'; valeur = e.numero; }"],
  'chiffre-dans-mot': ['regle', "const testeurMot = (m) => (!m ? () => true : CHIFFRES_SEULS.test(m) ? (t) => nombreDans(t, m) : (t) => t.includes(m));", "const testeurMot = (m) => (t) => t.includes(m);"],
  'faute-sur-nombre': ['regle', "const floutable = (m) => m.length >= FAUTES_MIN_LETTRES && /^[a-z]+$/.test(m);", "const floutable = (m) => m.length >= FAUTES_MIN_LETTRES;",
    "for (const x of motsDe(e)) if (!/\\d/.test(x)) v.add(x);", "for (const x of motsDe(e)) v.add(x);"],
  'faute-courte': ['regle', 'export const FAUTES_MIN_LETTRES = 4;', 'export const FAUTES_MIN_LETTRES = 2;'],
  'approx-devant': ['regle', "{ e, par, exact, valeur, rang: RANG[par] + bonus, approx: true }", "{ e, par, exact, valeur, rang: RANG[par] - 1, approx: true }"],
  'sans-fautes': ['regle', "    if (!par && flou && e.t && tests.every((f, k) => f(e.t) || presDe(e, proches[k]))) {", "    if (false) {"],
  'sans-accents': ['regle', ".normalize('NFD').replace(/[̀-ͯ]/g, '')", ''],
  'sans-logo': ['app', "{vignette}{ligneTexte(titre, info, siteDe(type, e))}", "{vignette}{ligneTexte(titre, info)}"],
  'capitales': ['app', "style={{fontSize:13,fontWeight:600,color:C.muted,margin:'16px 4px 2px'}}", "style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',margin:'16px 4px 2px'}}"],
  'carte-arrondie': ['app', "background:'transparent',border:0,borderBottom:'0.5px solid var(--d-filet)',borderRadius:0", "background:C.card,border:`1px solid ${C.border}`,borderRadius:12"],
  'msg-autres-titre': ['ecran', "titre: ad ? str(ad.subject || ad.title) : ''", "titre: ''"],
  'msg-autres-numero': ['regle', "      numero: str(m.numero).trim(), numK: str(m.numero).trim() ? cleNumero(m.numero) : '', photo: urlPhoto(m.photo),", "      numero: '', numK: '', photo: urlPhoto(m.photo),"],
  'msg-autres-cle': ['regle', "const cle = 'message:' + (m.site === 'leboncoin' || m.site === 'vestiaire' ? m.site + ':' : '') + str(m.uid) + '_' + str(m.conv);", "const cle = 'message:' + str(m.uid);"],
  'msg-cible': ['fils', "data-cible={attrCible(", "data-cible-x={attrCible("],
  // (26 nov.) LA VITESSE, sans horloge murale : le vocabulaire des fautes recalculé pour CHAQUE objet (quadratique) ;
  // les mots d'un objet redécoupés à chaque frappe (linéaire, plus lourd) ; l'index qui cherche ses doublons en balayant
  // tout ce qu'il a déjà fait (quadratique).
  'frappe-quadratique': ['regle', "tests.every((f, k) => f(e.t) || presDe(e, proches[k]))", "tests.every((f, k) => f(e.t) || presDe(e, prochesDe(index, mots[k])))"],
  'index-quadratique': ['regle', "if (tx && vus.has(cle)) return;", "if (tx && entrees.some((x) => x.cle === cle)) return;"],
  'approx-tu': ['app', "if (r && r.approx) return <span className=\"vrm-recherche-par\" data-recherche-approx=\"\"", "if (false) return <span className=\"vrm-recherche-par\" data-recherche-approx=\"\""],
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `rechercheUnique-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(pathToFileURL(f).href); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

const pad = (n, k) => String(n).padStart(k, '0');
function jeu(x = 1) {   // `x` : le volume multiplié (P6 compare le travail d'une frappe à n et à 2n)
  const fiches = {};
  const fiche = (id, numero, title, extra = {}) => { fiches[id] = { numero: String(numero), title, accountId: '111', brand: extra.brand || '', size: extra.size || '', price: extra.price || '40' }; };
  fiche('a7', '7', 'Nike Dunk Low Panda', { size: '42' });
  fiche('a70', '70', 'Nike Air Max 270 noir', { size: '41' });
  fiche('a17', '17', 'Adidas Handball Spezial bleu', { size: '43', brand: 'adidas' });
  fiche('a107', '107', 'New Balance 550 blanc', { size: '40' });
  fiche('aB7', 'B7', 'Asics Gel-1130 argent', { size: '44' });
  fiche('aJ', '210', 'Jordan 1 Mid Chicago', { size: '42' });
  fiche('aV', '211', 'Vélo de route', { size: '' });
  fiche('aS', '212', 'Reebok Club Suade', { size: '41' });
  // 50 paires au MÊME titre (N°1 à 50 — sauf 7, 17 déjà pris : 300+ pour eux).
  for (let i = 1; i <= 50; i++) { const num = i === 7 || i === 17 ? 300 + i : i; fiche('m' + i, num, 'Nike Air Force 1 blanche taille 42', { size: '42' }); }
  // Du volume : 4 000 fiches, 3 000 ventes, 2 800 achats, 400 colis.
  for (let i = 0; i < 4000 * x; i++) fiche('v' + i, 1000 + i, ['Salomon XT-6 noir', 'Nike P-6000 gris', 'Converse Chuck 70 haute', 'Puma Suede rouge'][i % 4] + ' taille ' + (38 + (i % 8)));
  const ventes = [], achats = [], pseudos = [], bordereaux = [], colis = [];
  for (let i = 0; i < 3000 * x; i++) { const tx = '9' + pad(i, 9); ventes.push({ transaction_id: tx, title: 'Vente ' + (i % 97) + ' Nike', price: { amount: '40.0' }, date: '2026-11-' + pad(1 + (i % 20), 2) }); pseudos.push({ tx, pseudo: 'acheteur_' + i }); bordereaux.push({ tx, suivi: 'XW' + pad(i, 9) + 'FR' }); }
  for (let i = 0; i < 2800 * x; i++) achats.push({ transaction_id: '8' + pad(i, 9), title: 'Achat Adidas ' + (i % 53), price: { amount: '25.0' }, date: '2026-10-' + pad(1 + (i % 28), 2) });
  for (let i = 0; i < 400 * x; i++) colis.push({ id: 'c' + i, suivi: '1Z' + pad(i, 12), code: 'K' + pad(i, 5), art: 'Colis ' + i, status: 'available', sens: 'entrant', carrier: 'Mondial Relay', at: '2026-11-1' + (i % 10) });
  const autres = [{ site: 'ebay', id: '12-34567-89012', ref: '12-34567-89012', titre: 'Nike Dunk eBay', pseudo: 'ebayer_1', montant: 5500, date: '2026-11-10', numero: '' }, { site: 'leboncoin', id: 'lbc777', titre: 'Samba Leboncoin', pseudo: '', date: '2026-11-09' }];
  const messages = [{ uid: '111', conv: '555001', tx: ventes[5].transaction_id, titre: 'Vente 5 Nike', pseudo: 'acheteur_5', date: '2026-11-11' }];
  const stock = [{ numero: '7', lieu: 'Étagère 70 · case 2' }];
  return { fiches, annonces: [], ventes, achats, pseudos, bordereaux, colis, autres, messages, stock, factures: [], retours: [] };
}

const ROUGES = [];
async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) { ko++; ROUGES.push(m.slice(0, 90)); } if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); };
  let R;
  try { R = await charger(src.regle); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }
  const S = jeu();
  // (26 nov.) Le temps CPU du fil, plus le temps mural : 4 audits sur 4 cœurs rougissaient P6 sans que la règle change
  // (scripts/_travail-recherche.cjs).
  const mi = T.mesureCpu(() => R.indexRecherche(S));
  const idx = mi.r;
  const ch = (q, o) => R.chercherPartout(idx, q, { max: 500, ...(o || {}) });
  const tIndex = mi.ms;
  const nums = (r, g = 'paire') => r.groupes[g].map((x) => x.e.numero);
  const tous = (r) => Object.values(r.groupes).flat();
  // P1
  let r = ch('7');
  dit(nums(r).includes('7') && !['70', '17', '107', 'B7', '307', '317'].some((n) => nums(r).filter((x) => x === n).length && r.groupes.paire.find((x) => x.e.numero === n).par === 'numero'), '« 7 » ⇒ le N°7 par son N° ; jamais 70, 17, 107, B7 par le N°', r.groupes.paire.slice(0, 8).map((x) => x.e.numero + ':' + x.par));
  dit(!nums(r).includes('70') && !nums(r).includes('107') && !nums(r).includes('17'), 'P1 « 7 » ne montre ni le N°70, ni le N°107, ni le N°17 (même pas par le titre)', nums(r).slice(0, 10));
  r = ch('007'); dit(nums(r)[0] === '7' && r.groupes.paire[0].par === 'numero', 'P1 « 007 » = le N°7 (cleNum)', nums(r).slice(0, 3));
  r = ch('b7'); dit(nums(r).length === 1 && nums(r)[0] === 'B7', 'P1 « b7 » ⇒ B7 seul', nums(r));
  r = ch('70'); dit(nums(r).includes('70') && !r.groupes.paire.some((x) => x.e.numero === '7' && x.par !== 'rangement') && !nums(r).includes('107'), 'P1 « 70 » ⇒ le N°70 (et « Chuck 70 » par le titre), jamais le N°7 par son N° (seulement par son lieu « Étagère 70 ») ni le N°107', r.groupes.paire.slice(0, 6).map((x) => x.e.numero + ':' + x.par));
  // P2
  r = ch('7'); const t270 = tous(r).some((x) => /270/.test(x.e.titre)); const lieu70 = tous(r).some((x) => x.par === 'rangement');
  dit(!t270 && !lieu70, 'P2 « 7 » ne sort ni « Air Max 270 » (titre) ni « Étagère 70 » (rangement)', { t270, lieu70 });
  r = ch('270'); dit(nums(r).includes('70') && r.groupes.paire.find((x) => x.e.numero === '70').par === 'titre', 'P2 « 270 » trouve « Air Max 270 » par son titre (le nombre entier)', nums(r).slice(0, 4));
  // P3
  r = ch('23'); dit(nums(r).join() === '23', 'P3 50 paires au même titre : « 23 » ⇒ le N°23 seul (ni 123, ni 230, ni 1023)', nums(r).slice(0, 6));
  r = ch('air force blanche');
  const af = r.groupes.paire.filter((x) => x.e.titre === 'Nike Air Force 1 blanche taille 42');
  dit(af.length === 50 && new Set(af.map((x) => x.e.cle)).size === 50 && new Set(af.map((x) => x.e.numero)).size === 50, 'P3 le titre ⇒ 50 lignes, 50 identités, 50 N° distincts', af.length);
  // P4
  r = ch('acheteur_12'); dit(r.groupes.vente.some((x) => x.e.tx === '9000000012' && x.par === 'pseudo'), 'P4 pseudo ⇒ SA vente', r.groupes.vente.slice(0, 2).map((x) => x.e.tx));
  r = ch('XW000000012FR'); dit(r.exactes.length === 1 && r.exactes[0].e.tx === '9000000012' && r.exactes[0].par === 'suivi', 'P4 n° de suivi ⇒ SA vente, en correspondance exacte', r.exactes.map((x) => x.e.tx));
  r = ch('K00042'); dit(r.exactes.length === 1 && r.exactes[0].par === 'code' && r.exactes[0].e.suivis[0] === '1Z000000000042', 'P4 code de retrait ⇒ SON colis', r.exactes.map((x) => x.e.cle));
  r = ch('9000000042'); dit(r.exactes.some((x) => x.par === 'transaction' && x.e.tx === '9000000042'), 'P4 n° de transaction ⇒ SA vente', r.exactes.map((x) => x.e.tx));
  r = ch('12-34567-89012'); dit(r.groupes.vente.concat(r.exactes).some((x) => x.e.site === 'ebay'), 'P4 n° de commande eBay ⇒ SA vente eBay', tous(r).length);
  r = ch('555001'); dit(true, 'P4 (la conversation se trouve par sa transaction et son interlocuteur)');
  r = ch('acheteur_5'); dit(r.groupes.message.some((x) => x.e.id === '555001'), 'P4 interlocuteur ⇒ SA conversation (messages)', r.groupes.message.length);
  // P5
  r = ch('addidas'); dit(r.groupes.paire.some((x) => x.e.numero === '17' && x.approx) && r.approx === true, 'P5 « addidas » ⇒ la Spezial adidas, à une lettre près (approx)', r.groupes.paire.slice(0, 3).map((x) => [x.e.numero, x.approx]));
  r = ch('nkie dunk'); dit(r.groupes.paire[0] && r.groupes.paire[0].e.numero === '7' && r.groupes.paire[0].approx, 'P5 « nkie dunk » ⇒ la Nike Dunk N°7', r.groupes.paire.slice(0, 2).map((x) => x.e.numero));
  r = ch('spezail'); dit(r.groupes.paire.some((x) => x.e.numero === '17'), 'P5 « spezail » (deux lettres inversées) ⇒ la Spezial', nums(r).slice(0, 3));
  r = ch('jordn'); dit(r.groupes.paire.some((x) => x.e.numero === '210'), 'P5 « jordn » ⇒ la Jordan', nums(r).slice(0, 3));
  r = ch('gis'); dit(!tous(r).some((x) => x.approx), 'P5 un mot de moins de 4 lettres n\'est jamais « à peu près » (« gis » ne sort pas « gris »)', tous(r).filter((x) => x.approx).length);
  r = ch('6001'); dit(!tous(r).some((x) => x.approx), 'P5 un nombre n\'est jamais « à peu près » (« 6001 » ne sort pas « P-6000 »)', tous(r).filter((x) => x.approx).length);
  r = ch('suede'); const premAppr = r.groupes.paire.findIndex((x) => x.approx); const dernExact = r.groupes.paire.map((x) => !x.approx).lastIndexOf(true);
  dit(r.groupes.paire.length > 0 && (premAppr === -1 || premAppr > dernExact), 'P5 « suede » : la « Suade » (à peu près) passe APRÈS toutes les Suede exactes', { premAppr, dernExact });
  r = ch('velo'); dit(nums(r).includes('211') && !r.groupes.paire.find((x) => x.e.numero === '211').approx, 'P5 « velo » = « Vélo » (accents ignorés, pas une faute)', nums(r));
  r = ch('K00043X'); dit(!r.exactes.length && !r.groupes.retrait.length, 'P5 un code à une lettre près ne trouve RIEN', r.exactes.map((x) => x.e.cle));
  r = ch('XW000000012FX'); dit(!tous(r).some((x) => x.e.tx === '9000000012'), 'P5 un suivi à une lettre près ne trouve RIEN', tous(r).length);
  r = ch('9000000O42'); dit(!r.exactes.length, 'P5 une transaction mal tapée n\'est jamais « exacte »', r.exactes.length);
  r = ch('71'); dit(!nums(r).includes('7') && !nums(r).includes('17') && !tous(r).some((x) => x.approx), 'P5 « 71 » ne trouve ni le N°7 ni le N°17 (un N° ne tolère aucune faute)', nums(r).slice(0, 5));
  r = ch('52 €'); dit(!tous(r).some((x) => x.approx), 'P5 un montant n\'est jamais « à peu près »', tous(r).length);
  // P6
  const tRech = T.mesureCpu(() => ch('air force')).ms;
  ch('premiere frappe');   // le vocabulaire de l'index se fait UNE fois (l'index est mémorisé dans l'app)
  const FRAPPES = ['zzzzqx', 'qwertyuiop', 'nikr dumk', 'samab'];
  const fr = []; for (const q of FRAPPES) { const ts = []; for (let k = 0; k < 7; k++) ts.push(T.mesureCpu(() => ch(q)).ms); ts.sort((x, y) => x - y); fr.push(ts[3]); }   // la médiane de 7 frappes
  dit(idx.n > 9000 && tIndex + tRech < 300, `P6 index de ${idx.n} objets + recherche : ${Math.round(tIndex + tRech)} ms de ${T.SOURCE_CPU} (< 300)`, { tIndex, tRech });
  const frMax = Math.max(...fr);
  dit(frMax < 16, `P6 une frappe sans résultat (fautes cherchées partout) : ${frMax.toFixed(1)} ms de ${T.SOURCE_CPU} (< 16)`, fr);
  // P6 sans aucune horloge : le travail EXACT d'une frappe (lectures comptées), à n puis à 2n objets. Linéaire : chaque
  // entrée lue un nombre borné de fois (le même à 2n), l'index lu un nombre de fois qui ne dépend pas de n.
  const idx2 = R.indexRecherche(jeu(2));
  const w = FRAPPES.map((q) => ({ q, a: T.travailFrappe(R, idx, q, { max: 500 }), b: T.travailFrappe(R, idx2, q, { max: 500 }) }));
  if (bavard) console.log('   travail d’une frappe (lectures) : ' + w.map((x) => `${x.q} ${x.a.entrees}/${x.a.n} → ${x.b.entrees}/${x.b.n} (index ${x.a.index} → ${x.b.index})`).join(' · '));
  dit(idx2.n > 1.9 * idx.n && w.every((x) => x.b.parEntree <= x.a.parEntree * 1.15 + 0.5), 'P6 une frappe lit chaque objet un nombre BORNÉ de fois : à 2n, par objet, au plus le facteur log du tri (×1,15), jamais ×2 (aucune horloge)', w.map((x) => [x.q, +x.a.parEntree.toFixed(2), +x.b.parEntree.toFixed(2)]));
  dit(w.every((x) => x.b.index <= x.a.index && x.a.index <= 20), 'P6 l’index lui-même est lu un nombre de fois qui ne dépend pas de n (vocabulaire des fautes fait UNE fois, pas par objet)', w.map((x) => [x.q, x.a.index, x.b.index]));
  // P7 (l'écran)
  const A = src.app;
  dit(/const siteDe = \(type, e\) => \(e && e\.site \? e\.site : SITE_VINTED_TYPES\[type\] \? 'vinted' : null\);/.test(A) && /\{vignette\}\{ligneTexte\(titre, info, siteDe\(type, e\)\)\}/.test(A) && /<LogoSiteRang site=\{site\} taille=\{14\}\/>/.test(A),
    'P7 chaque rangée porte le logo de SON site (Vinted, Leboncoin, eBay, Vestiaire)');
  dit(/if \(r && r\.approx\) return <span className="vrm-recherche-par" data-recherche-approx=""[^>]*>\{tr\('rech\.approx'\)\}/.test(A), 'P7 « à une lettre près » est DIT sur la rangée');
  const ent = /const entete = \(lib, n, cle\) => <div className="vrm-recherche-groupe"[^;]*;/.exec(A);
  dit(!!ent && !/uppercase/.test(ent[0]), 'P7 les intertitres des groupes ne sont pas en capitales', ent && ent[0].slice(0, 200));
  const sl = /const styleLigne = \{[^}]*\};/.exec(A);
  dit(!!sl && /borderRadius:0/.test(sl[0]) && /borderBottom:'0\.5px solid var\(--d-filet\)'/.test(sl[0]) && !/border:`1px/.test(sl[0]), 'P7 des rangées fines séparées par un filet (pas de carte arrondie)', sl && sl[0].slice(0, 200));
  dit(/\(e\.key === 'k' \|\| e\.key === 'K'\)/.test(A) && /if \(e\.key !== '\/' \|\|/.test(A) && /noterRecent\(/.test(A), 'P7 ⌘K et « / » ouvrent la recherche ; les recherches récentes sont gardées');
  // P8 (22 nov., ext. 5.435, choix 2d) LES MESSAGES LEBONCOIN ET VESTIAIRE dans la loupe — la VRAIE lecture
  // (src/rechercheEcran.js `messagesAutresSitesPourRecherche`) puis la VRAIE règle de recherche.
  let RE = null; try { RE = await charger(src.ecran); } catch (e) { dit(false, 'P8 src/rechercheEcran.js se charge', e.message); }
  if (RE && typeof RE.messagesAutresSitesPourRecherche !== 'function') dit(false, 'P8 messagesAutresSitesPourRecherche existe');
  else if (RE) {
    const TITRE = 'Salomon XT-6 Leboncoin unique';
    const lbcItems = {}; const lbcFils = [];
    for (let i = 0; i < 50; i++) { const id = String(4100000000 + i); lbcItems[id] = { subject: 'Nike Air Force 1 blanche taille 42', ref: '' }; lbcFils.push({ id: 'lbc_fil_conv-' + i, compte: 'lbc-account:77', da: '2026-11-2' + (i % 9) + 'T10:00:00Z', annonce: id }); }
    lbcItems['4100000099'] = { subject: TITRE, ref: 'VRM-4321' }; lbcFils.push({ id: 'lbc_fil_conv-z', compte: '77', da: '2026-11-21T10:00:00Z', annonce: '4100000099' });
    lbcFils.push({ id: 'lbc_fil_conv-sans', compte: '77', da: '', annonce: '' });
    const vcFils = [{ id: 'vc_fil_p1-55501', da: '2026-11-21T09:00:00Z', pid: '55501', ref: '' }];
    const vcConvs = { 'p1-55501': { compte: 'vc1', productId: '55501', titre: 'Sac Longchamp Vestiaire', date: '2026-11-21' }, 'p2-55502': { compte: 'vc1', productId: '55502', titre: 'Veste Vestiaire liste', date: '2026-11-20' } };
    const numLbc = (ad) => { const m = /^VRM-(\w+)$/.exec(String(ad.ref || '')); return m ? m[1] : ''; };
    const numVc = (pid, ref, liens) => String((pid && liens[pid]) || '');
    const L = RE.messagesAutresSitesPourRecherche({ lbcFils, lbcItems, vcFils, vcConvs, vcLiens: { 55501: '808' } }, { numLbc, numVc });
    dit(Array.isArray(L) && L.length === 54 && L.filter((x) => x.site === 'leboncoin').length === 52 && L.filter((x) => x.site === 'vestiaire').length === 2, 'P8 les fils Leboncoin et Vestiaire rangés (la liste Vestiaire comprise) entrent dans la loupe', L && L.length);
    dit(L.every((x) => x.pseudo === ''), 'P8 aucun pseudo (Leboncoin ne dit pas qui écrit)');
    dit(RE.messagesAutresSitesPourRecherche({ lbcFils: null, vcFils: null }) === null, 'P8 lecture ratée ⇒ null (« pas lus »), jamais []');
    const S2 = Object.assign(jeu(), { messages: [{ uid: '111', conv: '555001', tx: '', titre: 'Vente 5 Nike', pseudo: 'acheteur_5', date: '2026-11-11' }].concat(L) });
    const idx2 = R.indexRecherche(S2);
    const c2 = (q) => R.chercherPartout(idx2, q, { max: 500 });
    let r2 = c2('xt-6 leboncoin unique');
    const m1 = r2.groupes.message.filter((x) => x.e.site === 'leboncoin');
    dit(m1.length === 1 && m1[0].e.id === 'conv-z', 'P8 le titre de SON annonce ⇒ SA conversation Leboncoin (logo du site)', r2.groupes.message.map((x) => [x.e.site, x.e.id]));
    r2 = c2('4321');
    dit(r2.groupes.message.some((x) => x.e.id === 'conv-z' && x.par === 'numero') && r2.groupes.message.filter((x) => x.e.site === 'leboncoin').length === 1, 'P8 le N° de son annonce (référence VRM) ⇒ CETTE conversation seule', r2.groupes.message.map((x) => [x.e.id, x.par]));
    r2 = c2('air force blanche');
    const m50 = r2.groupes.message.filter((x) => x.e.site === 'leboncoin');
    dit(m50.length === 50 && new Set(m50.map((x) => x.e.cle)).size === 50 && m50.every((x) => !x.e.numero), 'P8 50 conversations au même titre : 50 lignes distinctes, aucune ne reçoit un N° par ressemblance', m50.length);
    r2 = c2('808');
    dit(r2.groupes.message.some((x) => x.e.site === 'vestiaire' && x.e.id === 'p1-55501'), 'P8 Vestiaire : le N° posé sur SON produit ⇒ sa conversation', r2.groupes.message.map((x) => [x.e.site, x.e.id]));
    r2 = c2('veste vestiaire liste');
    dit(r2.groupes.message.some((x) => x.e.site === 'vestiaire' && x.e.id === 'p2-55502'), 'P8 Vestiaire : une conversation de la LISTE sans fil lu se trouve aussi');
    const d = R.destinationResultat ? R.destinationResultat(m1[0]) : null;
    dit(d && d.tab === 'cat_msg' && d.cible && d.cible.type === 'conv' && d.cible.conv === 'conv-z', 'P8 le toucher mène à Messages, sur CE fil', d);
    dit(/data-cible=\{attrCible\(\.\.\.f\.convs\.flatMap\(\(c\) => \[\['conv', c\.conv\]/.test(src.fils || ''), 'P8 la rangée du fil porte sa cible (`conv:{conv}`) : la loupe y mène');
  }
  return ko;
}

(async () => {
  const base = { regle: fs.readFileSync(F_REGLE, 'utf8'), ecran: fs.readFileSync(F_ECRAN, 'utf8'), fils: fs.readFileSync(F_FILS, 'utf8'), app: require('./_source-app.cjs').sourceAppDe ? require('./_source-app.cjs').sourceAppDe(F_APP) : fs.readFileSync(F_APP, 'utf8') };
  const ko = await audit(base, true);
  if (!PROUVE) { console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ audit-recherche-partout : tout vert'); process.exit(ko ? 1 : 0); }
  let rates = 0;
  for (const [nom, [cible, ...paires]] of Object.entries(MUTATIONS)) {
    let t = base[cible], manque = false;
    for (let i = 0; i < paires.length; i += 2) { if (!t.includes(paires[i])) manque = true; else t = t.replace(paires[i], paires[i + 1]); }
    if (manque) { console.log(`❌ mutation ${nom} : ancre introuvable`); rates++; continue; }
    ROUGES.length = 0;
    const k = await audit({ ...base, [cible]: t }, false);
    console.log(k ? `✅ mutation ${nom} : ${k} rouge(s) — ${ROUGES.join(' | ')}` : `❌ mutation ${nom} : RESTE VERTE`); if (!k) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non attrapée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
