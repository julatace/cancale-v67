#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : DAC7 COMPTE PAR COMPTE (5 novembre)
//         node scripts/audit-dac7-comptes.cjs [--mutation=X] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Comptabilité → Le détail → « DAC7 » (src/dac7Comptes.js). EXÉCUTE la vraie
// chaîne sur des ventes INVENTÉES (le dépôt est public) :
//   App.jsx `declarablesCompta` → `ventesDeclarables` (extraites, dans un vm)
//   → `indexComptesVentes` → `dac7ParCompte` → tableur (relu) et PDF (relu par pdf.js).
// Il exige :
//   C1. le seuil est celui de l'app : 30 ventes OU PLUS de 2 000 € (2 000,00 €
//       pile ne l'atteint pas, 2 000,01 € oui), jugé compte par compte ;
//   C2. une vente va au compte qu'elle PORTE (uid Vinted, `account` Leboncoin,
//       `_compte` eBay, `compte` Vestiaire) ; sans compte relevé ⇒ la carte
//       « compte non relevé », jamais le seul compte connu de la plateforme ;
//   C3. datée au VERSEMENT (vendue en décembre, versée en janvier ⇒ l'année
//       d'après) ; une vente d'une autre année n'entre pas ;
//   C4. « pas su » ≠ non : une vente pas encore datée vendue dans l'année rend
//       le compte « au moins » (atteintSi si elle fait passer le seuil), jamais
//       dans la partie sûre ; une vente au montant illisible ⇒ jamais « sous » ;
//       une vente pas encore datée vendue il y a deux ans ne compte pas ;
//   C5. une plateforme pas lue ⇒ « — » (n null), un compte Vinted dont la
//       lecture a échoué ⇒ « — », les autres restent lus ; un compte connu
//       sans vente d'une plateforme LUE ⇒ 0 vente, « sous » ;
//   C6. un compte exclu des totaux n'a pas de carte, n'est compté nulle part,
//       et il est DIT (`exclus`) ;
//   C7. les e-mails fiscaux : la plateforme par l'EXPÉDITEUR, jamais par le
//       sujet ; « rapport » seulement pour un relevé ; l'année du sujet, sinon
//       un rapport reçu en janvier concerne l'année d'avant ;
//   C8. `taxpayer_restricted` du porte-monnaie Vinted lu en trois états ;
//   C9. le tableur et le PDF d'un compte disent le MÊME nombre de ventes et le
//       MÊME total que la carte ; jamais « encaissé » ;
//   C10. `VERSEMENT_MAX_J` = celui de l'app (une borne, une valeur).
// `--mutation=X` réaffaiblit une règle dans une copie : rouge exigé.
// `--prouve` lance toutes les mutations et exige qu'aucune ne reste verte.
const fs = require('fs'), path = require('path'), vm = require('vm'), { spawnSync } = require('child_process');
const R0 = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
const MUTATIONS = {
  'sans-compte': ["const cle = q ? String(q.cle ?? '') : SANS_COMPTE;", "const cle = q && q.cle ? String(q.cle) : String((((comptes || []).find((c) => c && c.plateforme === plateforme)) || {}).cle || SANS_COMPTE);"],
  'adater-sure': ['k.nAd += 1; k.ctsAd += c;', 'k.n += 1; k.centimes += c;'],
  'nc-ignore': ['k.nNc += 1;\n', '\n'],
  'passu-zero': ["const etat = etatP !== 'lu' ? etatP : ko.has(cleCarte(c.plateforme, c.cle)) ? 'passu' : 'lu';", "const etat = 'lu';"],
  'exclu-carte': ["if (c && PLATEFORMES.includes(c.plateforme) && !exclu.has(cleCarte(c.plateforme, String(c.cle ?? ''))))", 'if (c && PLATEFORMES.includes(c.plateforme))'],
  'annee': ['if (!l || !ymOk(l.ym, annee)) continue;', 'if (!l) continue;'],
  'vieille-adater': ['if (!peutEtreDe(tsV, annee, maintenant)) continue;', ''],
  'email-sujet': ['const plateforme = plateformeExpediteur(from);', "const plateforme = plateformeExpediteur(from) || (/vinted/i.test(String(subject)) ? 'Vinted' : null);"],
  'email-relais': ["      if (r) test = (n) => new RegExp(`(^|_)${n}_${TLD_P}(_|$)`).test(r[1]);", ''],
  'email-domaine-fin': ["} else test = (n) => new RegExp(`(^|\\\\.)${n}\\\\.${TLD_P}$`).test(dom);", "} else test = (n) => new RegExp(`(^|\\\\.)${n}\\\\.${TLD_P}`).test(dom);"],
  'email-rapport': ["if (rapport) return { plateforme, nature: 'rapport' };", "if (rapport || dac7) return { plateforme, nature: 'rapport' };"],
  'email-annee': ["return c && c.nature === 'rapport' && d.getMonth() <= 2 ? d.getFullYear() - 1 : d.getFullYear();", 'return d.getFullYear();'],
  'export-total': ["L.push(['Total', nbTableur(k.etat === 'lu' ? k.centimes / 100 : null), '', '', '', '']);", "L.push(['Total', nbTableur(k.etat === 'lu' ? (k.centimes + k.ctsAd) / 100 : null), '', '', '', '']);"],
};
if (process.argv.includes('--prouve')) {
  let vertes = [];
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${m}`], { encoding: 'utf8' });
    const rouge = r.status === 1;
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} : ${rouge ? 'rouge' : 'reste VERTE (status ' + r.status + ')'}`);
    if (!rouge) vertes.push(m);
  }
  console.log(vertes.length ? `\n❌ ${vertes.length} mutation(s) restent vertes : ${vertes.join(', ')}` : `\n✅ dac7-comptes --prouve : ${Object.keys(MUTATIONS).length} mutations, toutes rouges`);
  process.exit(vertes.length ? 1 : 0);
}
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return ''; } };
const APP = require("./_source-app.cjs").sourceApp();
let MOD = lire('src/dac7Comptes.js');
if (MUT) {
  const m = MUTATIONS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  if (!MOD.includes(m[0])) { console.log('❌ mutation impossible : motif absent — ' + m[0].slice(0, 90)); process.exit(2); }
  MOD = MOD.replace(m[0], m[1]);
}
function extraire(src, nom) {
  const m = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}

// Le texte d'un PDF : pdf.js s'il est installé ; sinon les flux de pdf-lib
// décompressés (zlib) et leurs chaînes `<hex> Tj` (WinAnsi) relues — le PDF
// est relu pour de vrai dans les deux cas.
async function texteDuPdf(octets) {
  try {
    const NM = fs.realpathSync(path.join(R0, 'node_modules'));
    const pdfjs = await import('file://' + path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
    const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
    let t = '';
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const tc = await p.getTextContent(); t += tc.items.map((x) => x.str).join(' ') + '\n'; }
    return t;
  } catch (_) { /* pdf.js absent : lecture directe */ }
  const zlib = require('zlib');
  const b = Buffer.from(octets); const bin = b.toString('latin1');
  const morceaux = [];
  const re = /stream\r?\n/g; let m;
  while ((m = re.exec(bin))) {
    const debut = m.index + m[0].length, fin = bin.indexOf('endstream', debut);
    if (fin < 0) break;
    const brut = b.subarray(debut, fin);
    let txt = null;
    try { txt = zlib.inflateSync(brut).toString('latin1'); } catch (_) { txt = brut.toString('latin1'); }
    for (const x of txt.matchAll(/<([0-9A-Fa-f]*)>\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj/g)) morceaux.push(x[1] != null ? Buffer.from(x[1], 'hex').toString('latin1') : x[2]);
    re.lastIndex = fin;
  }
  return morceaux.join(' ');
}

(async () => {
  // La copie (mutée ou non) posée À CÔTÉ de l'original : ses imports relatifs restent justes.
  const tmp = path.join(R0, 'src', `.audit-dac7-${process.pid}.mjs`);
  let M = null, V = null;
  try {
    if (!MOD) throw new Error('src/dac7Comptes.js absent');
    fs.writeFileSync(tmp, MOD);
    M = await import('file://' + tmp);
    V = await import('file://' + path.join(R0, 'api', '_lib', 'vestiaire-regle.js'));
  } catch (e) { dit(false, 'les modules se chargent', e.message); }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  dit(!!M && typeof M.dac7ParCompte === 'function', 'src/dac7Comptes.js : dac7ParCompte existe');
  if (!M) { console.log(`\n❌ dac7-comptes : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── C10 / C1 : une borne, un seuil ──
  const vMax = Number((/const VERSEMENT_MAX_J = (\d+);/.exec(APP) || [])[1]);
  dit(M.VERSEMENT_MAX_J === vMax, `C10 · VERSEMENT_MAX_J = celui de l'app (${vMax})`, M.VERSEMENT_MAX_J);
  const sv = Number((/const SEUIL_VINTED_VENTES = (\d+);/.exec(APP) || [])[1]), se = Number((/const SEUIL_VINTED_EUR = (\d+);/.exec(APP) || [])[1]);
  dit(M.DAC7.ventes === sv && M.DAC7.centimes === se * 100, `C1 · seuil = celui de l'app (${sv} ventes, ${se} €)`, JSON.stringify(M.DAC7));

  // ── La chaîne de l'app : `declarablesCompta` → `ventesDeclarables` ──
  const NOMS = ['classifyOrderStatus', 'venteFinalisee', 'tsCommande', 'montantCommandeLu', 'ymDeTs', 'indexDeclarations', 'moisDeclare', 'lbcAnnulee', 'lbcFinalisee',
    'commandeEbayEngagee', 'montantRecuEbay', 'compteEcarteChoix', 'compteEcarteRegle', 'compteEcarte', 'phraseNonComptees', 'ventesDeclarables', 'declarablesCompta'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, Map, Set, isFinite, parseFloat, isNaN, console, RAISON_NON_COMPTEE: {},
    // (9 nov.) `compteEcarte` = `compteEcarteRegle(…, reglePlanCourante())` (offre Solo) : règle « pas sue » ⇒ rien bridé.
    venteHorsPlan: () => false, reglePlanCourante: () => null };
  Object.assign(ctx, { vcVenteAnnulee: V.vcVenteAnnulee, montantRecuVc: V.montantRecuVc, dateVersementVc: V.dateVersementVc, etapeMotVc: V.etapeMotVc, dateVenteVc: V.dateVenteVc });
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'la chaîne des ventes se lit dans App.jsx (declarablesCompta → ventesDeclarables)', absents.join(', '));
  if (absents.length) { console.log(`\n❌ dac7-comptes : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── Les ventes INVENTÉES (année jugée : 2026 ; « maintenant » : 5 novembre 2026) ──
  const NOW = new Date(2026, 10, 5, 12).getTime();
  const D = (y, m, j, h = 12) => new Date(y, m, j, h).toISOString();
  const FIN = 'Commande finalisée';
  const vinted = (uid, tx, eur, date) => ({ transaction_id: tx, id: tx, title: 'Baskets inventées ' + tx, price: eur == null ? null : { amount: String(eur), currency_code: 'EUR' }, status: FIN, date, _acc: { vinted_user_id: uid, login: 'compte_' + uid } });
  const ventes = [], versements = {};
  // 111 : 30 ventes versées en 2026, 10 € chacune ⇒ atteint par le NOMBRE.
  for (let i = 0; i < 30; i++) { ventes.push(vinted('111', 1000 + i, 10, D(2026, 2, 1 + (i % 25)))); versements[1000 + i] = D(2026, 2, 3 + (i % 25)); }
  // 222 : 29 ventes, 2 000,00 € pile ⇒ sous ; + 1 vendue le 20 déc. 2025 versée le 5 janv. 2026 (comptée : versée en 2026) — la 30e ? non : on la garde pour C3 à part.
  for (let i = 0; i < 28; i++) { ventes.push(vinted('222', 2000 + i, 70, D(2026, 3, 1 + (i % 25)))); versements[2000 + i] = D(2026, 3, 2 + (i % 25)); }
  ventes.push(vinted('222', 2100, 40, D(2025, 11, 20))); versements[2100] = D(2026, 0, 5);           // vendue 2025, VERSÉE 2026 ⇒ 2026
  ventes.push(vinted('222', 2101, 77, D(2025, 11, 10))); versements[2101] = D(2025, 11, 15);         // versée 2025 ⇒ pas 2026
  // 28 × 70 = 1 960 + 40 = 2 000,00 € pile, 29 ventes ⇒ sous.
  // 444 : 29 ventes (900 €) + 1 finalisée SANS date de versement, vendue le 20 déc. 2025 ⇒ atteintSi
  // (6 nov. : vendue en 2026 et lue en 2026, elle serait VERSÉE en 2026 — src/aDaterAnnee.js — et comptée ;
  // vendue fin 2025, son versement peut tomber en 2025 ou en 2026 : « peut-être », jamais dans la partie sûre).
  for (let i = 0; i < 29; i++) { ventes.push(vinted('444', 4000 + i, 900 / 29, D(2026, 5, 1 + (i % 25)))); versements[4000 + i] = D(2026, 5, 2 + (i % 25)); }
  ventes.push(vinted('444', 4100, 50, D(2025, 11, 20)));                                              // à dater, peut-être de 2026
  ventes.push(vinted('444', 4101, 60, D(2024, 2, 3)));                                                // à dater, vendue en 2024 ⇒ pas 2026
  // 555 : 3 ventes + 1 au prix illisible ⇒ jamais « sous ».
  for (let i = 0; i < 3; i++) { ventes.push(vinted('555', 5000 + i, 20, D(2026, 6, 2 + i))); versements[5000 + i] = D(2026, 6, 4 + i); }
  ventes.push(vinted('555', 5100, null, D(2026, 6, 9))); versements[5100] = D(2026, 6, 11);
  // 666 : EXCLU (masqué) — 40 ventes qui ne doivent apparaître nulle part.
  for (let i = 0; i < 40; i++) { ventes.push(vinted('666', 6000 + i, 100, D(2026, 7, 1 + (i % 25)))); versements[6000 + i] = D(2026, 7, 2 + (i % 25)); }
  // 777 : lecture de CE compte ratée ; 888 : connu, aucune vente.
  // 999 : 2 000,01 € en 1 vente ⇒ atteint par le MONTANT.
  ventes.push(vinted('999', 9000, 2000.01, D(2026, 8, 1))); versements[9000] = D(2026, 8, 3);
  const lbc = [
    { txId: 'LA1', isSeller: true, price: 4000, dateVente: D(2026, 9, 5), stepStatus: 'done', title: 'LBC inventé', account: 'lbc-account:AAA' },
    { txId: 'LA2', isSeller: true, price: 3000, dateVente: D(2026, 9, 6), stepStatus: 'done', title: 'LBC inventé 2', account: 'AAA' },
    { txId: 'LZ1', isSeller: true, price: 9000, dateVente: D(2026, 9, 7), stepStatus: 'done', title: 'LBC sans compte' },
  ];
  const ebay = [
    { orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: D(2026, 9, 7), paymentSummary: { totalDueSeller: { value: '80.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '9.50', currency: 'EUR' }, lineItems: [{ title: 'eBay inventé' }], _compte: 'principal' },
  ];
  const vestiaire = [
    { id: 'C1', etat: 'payout done', montant: { valeur: 120, cle: 'sellerEarning', devise: 'EUR' }, verseLe: D(2026, 9, 9), date: D(2026, 9, 1), compte: '' },
  ];
  const { decl } = ctx.declarablesCompta({ ventes, ko: ['777'], lbc, ebay, vestiaire, rates: [], versements, hTx: new Set(), hAcc: new Set(['666']), panelOff: {}, excluAutre: null });
  const index = M.indexComptesVentes({ vinted: ventes, lbc, ebay, vestiaire, nomVinted: (u, l) => l || u, nomAutre: (p, c) => (p === 'Leboncoin' && c === 'AAA' ? 'Boutique LBC' : '') });
  const comptes = [...['111', '222', '444', '555', '666', '777', '888', '999'].map((u) => ({ plateforme: 'Vinted', cle: u, nom: 'compte_' + u })),
    { plateforme: 'Leboncoin', cle: 'AAA', nom: 'Boutique LBC' }, { plateforme: 'eBay', cle: 'principal', nom: 'Compte principal' }];
  const exclus = [{ plateforme: 'Vinted', cle: '666', nom: 'compte_666' }];
  const etats = { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' };
  const RUN = (o = {}) => M.dac7ParCompte({ decl, annee: 2026, compteDe: (id) => index.get(id) || null, comptes, etats, comptesKO: [{ plateforme: 'Vinted', cle: '777' }], exclus, numDe: (id) => (id === 'vinted:9000' ? 'B12' : ''), maintenant: NOW, ...o });
  const R = RUN();
  const K = (p, c) => R.cartes.find((k) => k.plateforme === p && k.cle === c);
  console.log('── Cartes', JSON.stringify(R.cartes.map((k) => [k.plateforme, k.cle, k.etat, k.n, k.centimes, k.nAd, k.nNc, k.verdict])));
  // C1
  dit(K('Vinted', '111') && K('Vinted', '111').n === 30 && K('Vinted', '111').verdict === 'atteint', 'C1 · 30 ventes ⇒ au-dessus (par le nombre)', JSON.stringify(K('Vinted', '111')));
  const k222 = K('Vinted', '222');
  dit(k222 && k222.n === 29 && k222.centimes === 200000 && k222.verdict === 'sous', 'C1 · 29 ventes, 2 000,00 € pile ⇒ sous', k222 && [k222.n, k222.centimes, k222.verdict]);
  dit(K('Vinted', '999') && K('Vinted', '999').verdict === 'atteint' && K('Vinted', '999').n === 1, 'C1 · une vente à 2 000,01 € ⇒ au-dessus (par le montant)', JSON.stringify(K('Vinted', '999') && K('Vinted', '999').verdict));
  // C2
  const lA = K('Leboncoin', 'AAA'), lZ = K('Leboncoin', '');
  dit(lA && lA.n === 2 && lA.centimes === 7000 && lA.nom === 'Boutique LBC', 'C2 · Leboncoin : « lbc-account:AAA » et « AAA » sont le même compte', lA && [lA.n, lA.centimes, lA.nom]);
  dit(lZ && lZ.n === 1 && lZ.centimes === 9000 && /non relevé/.test(lZ.nom), 'C2 · une vente Leboncoin SANS compte ⇒ « compte non relevé », jamais le seul compte connu', lZ && [lZ.n, lZ.nom]);
  dit(K('eBay', 'principal') && K('eBay', 'principal').centimes === 7050, 'C2 · eBay au compte `_compte`, au montant REÇU (80 − 9,50)', K('eBay', 'principal') && K('eBay', 'principal').centimes);
  dit(K('Vestiaire', '-') && /non identifié/.test(K('Vestiaire', '-').nom) && K('Vestiaire', '-').n === 1, 'C2 · Vestiaire sans compte relevé ⇒ « Compte non identifié »', JSON.stringify(R.cartes.filter((k) => k.plateforme === 'Vestiaire').map((k) => [k.cle, k.nom])));
  // C3
  dit(k222 && k222.lignes.some((l) => l.id === 'vinted:2100') && !k222.lignes.some((l) => l.id === 'vinted:2101'), 'C3 · vendue en 2025 et versée en 2026 ⇒ 2026 ; versée en 2025 ⇒ pas 2026', k222 && k222.lignes.map((l) => l.id).slice(-3).join(','));
  const R25 = RUN({ annee: 2025 });
  const k222b = R25.cartes.find((k) => k.cle === '222');
  dit(k222b && k222b.n === 1 && k222b.centimes === 7700, 'C3 · l’année 2025 ne voit que la vente VERSÉE en 2025', k222b && [k222b.n, k222b.centimes]);
  // C4
  const k444 = K('Vinted', '444');
  dit(k444 && k444.n === 29 && k444.nAd === 1 && k444.ctsAd === 5000 && k444.verdict === 'atteintSi' && k444.partiel, 'C4 · 29 sûres + 1 pas encore datée de 2026 ⇒ « au-dessus si », jamais dans la partie sûre', k444 && JSON.stringify([k444.n, k444.nAd, k444.ctsAd, k444.verdict]));
  dit(k444 && !k444.aDater.some((l) => l.id === 'vinted:4101'), 'C4 · une pas encore datée vendue en 2024 ne compte pas en 2026', k444 && k444.aDater.map((l) => l.id).join(','));
  dit(k444 && k444.manque.some((t) => /pas encore datée/.test(t)), 'C4 · le manque est NOMMÉ', k444 && k444.manque.join(' | '));
  const k555 = K('Vinted', '555');
  dit(k555 && k555.n === 3 && k555.nNc === 1 && k555.verdict === null && k555.partiel, 'C4 · un montant illisible ⇒ « au moins », jamais « sous »', k555 && JSON.stringify([k555.n, k555.nNc, k555.verdict]));
  // C5
  const k777 = K('Vinted', '777');
  dit(k777 && k777.etat === 'passu' && k777.n === null && k777.verdict === null, 'C5 · lecture de CE compte ratée ⇒ « — » (n null)', k777 && JSON.stringify([k777.etat, k777.n]));
  const k888 = K('Vinted', '888');
  dit(k888 && k888.etat === 'lu' && k888.n === 0 && k888.verdict === 'sous', 'C5 · compte connu sans vente, plateforme lue ⇒ 0 vente, sous', k888 && JSON.stringify([k888.etat, k888.n, k888.verdict]));
  const Rp = RUN({ etats: { ...etats, Leboncoin: 'passu', eBay: 'encours' } });
  const pl = Rp.cartes.filter((k) => k.plateforme === 'Leboncoin'), pe = Rp.cartes.filter((k) => k.plateforme === 'eBay');
  dit(pl.length && pl.every((k) => k.etat === 'passu' && k.n === null && k.centimes === null), 'C5 · Leboncoin pas lu ⇒ toutes ses cartes « — », jamais 0', JSON.stringify(pl.map((k) => [k.etat, k.n])));
  dit(pe.length && pe.every((k) => k.etat === 'encours' && k.n === null), 'C5 · eBay en cours ⇒ « … »', JSON.stringify(pe.map((k) => [k.etat, k.n])));
  dit(RUN({ decl: undefined }).etat === 'encours' && RUN({ decl: null }).etat === 'passu', 'C5 · ventes pas encore lues ⇒ en cours ; illisibles ⇒ pas su');
  // C6
  dit(!K('Vinted', '666') && R.exclus.some((c) => c.cle === '666' && c.nom === 'compte_666'), 'C6 · compte exclu : aucune carte, et il est DIT', JSON.stringify(R.exclus));
  const tousLes = R.cartes.reduce((s, k) => s + (k.n || 0), 0);
  dit(tousLes === 30 + 29 + 29 + 3 + 1 + 2 + 1 + 1 + 1, 'C6 · ses 40 ventes ne sont comptées nulle part', tousLes);
  // C7
  const E = (s, f, at) => M.classerEmailFiscal({ subject: s, from: f });
  dit(JSON.stringify(E('Ton rapport DAC7 2026 est disponible', 'Vinted <no-reply@vinted.fr>')) === '{"plateforme":"Vinted","nature":"rapport"}', 'C7 · rapport DAC7 de Vinted reconnu');
  dit(E('Rapport DAC7 de Vinted', 'ami@gmail.com') === null, 'C7 · un e-mail qui CITE Vinted d’une autre adresse n’est pas de Vinted');
  // L'expéditeur RÉEL de 683 e-mails Vinted conservés (mesuré le 5 nov.) : le relais iCloud « Masquer mon adresse ».
  const RELAIS1 = '"l\'équipe Vinted" <no-reply_at_vinted_fr_ab12cd34ef_gh56ij78@icloud.com> (no-reply@vinted.fr.ab12cd34ef.gh56ij78)';
  const RELAIS2 = '"l\'équipe Vinted" <no-reply_at_vinted_fr_ab12cd34ef_gh56ij78@icloud.com>';
  dit(JSON.stringify(E('Ton rapport DAC7 est disponible', RELAIS1)) === '{"plateforme":"Vinted","nature":"rapport"}' && JSON.stringify(E('Ton rapport DAC7 est disponible', RELAIS2)) === '{"plateforme":"Vinted","nature":"rapport"}', 'C7 · un rapport de Vinted arrivé par le relais iCloud (avec ou sans l’adresse réelle) est reconnu');
  dit(M.plateformeExpediteur('x <a_at_ebay_co_uk_zz@privaterelay.appleid.com>') === 'eBay' && M.plateformeExpediteur('x <no-reply_at_vintedcrm_com_ab@icloud.com>') === null, 'C7 · relais : le domaine RÉEL décide (vintedcrm.com n’est pas Vinted)');
  dit(M.plateformeExpediteur('Faux <no-reply@vinted.fr.exemple.com>') === null && M.plateformeExpediteur('x <no-reply@team.vinted.com>') === 'Vinted', 'C7 · un domaine ordinaire doit FINIR par celui de la plateforme');
  dit(JSON.stringify(E('Complète tes informations fiscales', 'Vinted <no-reply@vinted.fr>')) === '{"plateforme":"Vinted","nature":"fiscal"}', 'C7 · une demande d’informations fiscales n’est PAS un rapport');
  dit(JSON.stringify(E('Information DAC7 : vérifiez vos données', 'Leboncoin <noreply@leboncoin.fr>')) === '{"plateforme":"Leboncoin","nature":"fiscal"}', 'C7 · « DAC7 » seul dans le sujet ⇒ fiscal, pas rapport');
  dit(E('Ton article a été vendu', 'no-reply@vinted.fr') === null, 'C7 · un e-mail de vente n’est pas fiscal');
  dit(JSON.stringify(E('Votre récapitulatif annuel', 'eBay <ebay@ebay.fr>')) === '{"plateforme":"eBay","nature":"rapport"}', 'C7 · « récapitulatif annuel » d’eBay ⇒ rapport');
  dit(M.anneeConcernee({ subject: 'Ton rapport DAC7 est disponible', at: D(2027, 0, 28) }) === 2026, 'C7 · rapport reçu en janvier 2027 sans année ⇒ 2026');
  dit(M.anneeConcernee({ subject: 'Ton rapport DAC7 2025', at: D(2026, 0, 28) }) === 2025 && M.anneeConcernee({ subject: 'Complète tes informations fiscales', at: D(2026, 0, 28) }) === 2026, 'C7 · l’année du sujet gagne ; une demande reçue en janvier reste de son année');
  const EM = M.emailsFiscaux([{ id: 'e1', s: 'Ton rapport DAC7 est disponible', f: 'no-reply@vinted.fr', to: 'boite@exemple.fr', at: D(2027, 0, 28) },
    { id: 'e2', s: 'Ton rapport DAC7 est disponible', f: 'faux@exemple.com', at: D(2027, 0, 28) }], 2026);
  dit(EM && EM.Vinted && EM.Vinted.length === 1 && EM.Vinted[0].nature === 'rapport' && !EM.Leboncoin, 'C7 · emailsFiscaux range par plateforme de l’EXPÉDITEUR', JSON.stringify(EM));
  dit(M.emailsFiscaux(null, 2026) === null, 'C7 · e-mails pas lus ⇒ null (jamais « aucun »)');
  // C8
  const B = M.blocagesFiscauxVinted([{ id: 'harvest_111_billing', tr: 'true', cap: 'x' }, { id: 'harvest_222_billing', tr: 'false' }, { id: 'harvest_333_billing', tr: null }]);
  dit(B && B['111'].bloque === true && B['222'].bloque === false && !('333' in B), 'C8 · taxpayer_restricted : bloqué · pas bloqué · pas lu (absent)', JSON.stringify(B));
  dit(M.blocagesFiscauxVinted(null) === null, 'C8 · porte-monnaie pas lu ⇒ null');
  // C9
  const k = K('Vinted', '999');
  const csv = M.csvDac7(k, 2026, { maintenant: NOW }).replace(/^﻿/, '');
  const C = csv.split(/\r?\n/).map((l) => l.split(';'));
  const i0 = C.findIndex((r) => r[0] === 'Date'), iT = C.findIndex((r, i) => i > i0 && r[0] === 'Total');
  const lignes = C.slice(i0 + 1, iT);
  dit(lignes.length === k.n && C[iT][1] === '2000,01' && lignes[0][3] === 'B12', 'C9 · tableur : même nombre de ventes, même total, N° par identité', JSON.stringify({ n: lignes.length, total: C[iT] && C[iT][1], num: lignes[0] && lignes[0][3] }));
  const csv4 = M.csvDac7(k444, 2026, { maintenant: NOW }).replace(/^﻿/, '').split(/\r?\n/).map((l) => l.split(';'));
  const t4 = csv4.find((r) => r[0] === 'Total');
  dit(t4 && t4[1] === (k444.centimes / 100).toFixed(2).replace('.', ','), 'C9 · le total du tableur = la partie SÛRE (les pas encore datées à part)', t4 && t4[1]);
  try {
    const PDFLib = await import('pdf-lib');
    const pdf = await M.pdfDac7(k444, 2026, { PDFLib, maintenant: NOW });
    const t = await texteDuPdf(pdf);
    const attendu = (k444.centimes / 100).toFixed(2).replace('.', ',');
    dit(new RegExp('Total\\s+au moins\\s+' + attendu.replace(',', ',')).test(t.replace(/\s+/g, ' ')), 'C9 · PDF : « Total au moins » = la partie sûre', attendu);
    dit(/29 \/ 30/.test(t) && !/encaiss/i.test(t + csv), 'C9 · PDF : « 29 / 30 », jamais « encaissé »');
  } catch (e) { dit(false, 'C9 · le PDF se crée et se relit', e.message); }

  console.log(ko ? `\n❌ dac7-comptes : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ dac7-comptes : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
