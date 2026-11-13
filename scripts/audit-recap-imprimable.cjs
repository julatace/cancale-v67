#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// audit-recap-imprimable — « Récap de <mois> » en UNE page imprimable (13 nov., point 16)
// ═══════════════════════════════════════════════════════════════════════════
//   node scripts/audit-recap-imprimable.cjs                 contrôles sur le code du dépôt
//   node scripts/audit-recap-imprimable.cjs --png=DOSSIER   + la page imprimée (PDF de Chromium, PNG)
//   node scripts/audit-recap-imprimable.cjs --mutation=NOM  la règle réaffaiblie (doit rougir)
//   node scripts/audit-recap-imprimable.cjs --prouve        chaque mutation doit rougir
//
// Le vrai code (src/recapImprimable.js sur les données de src/rapportMois.js,
// src/bilanMois.js, src/margePlateforme.js, src/beneficeNoms.js,
// src/design/carteChiffres.js) est copié dans un dossier temporaire et exécuté
// sur un mois INVENTÉ (octobre 2026 ; aucune base touchée).
//   I1. chaque chiffre de la page est celui des données du Rapport du mois (ventes,
//       vendu, reçu, achats, dépenses, bénéfice, URSSAF, plateformes, comptes) —
//       rien n'est recalculé ; « au moins » sur un minimum ; « — » pour pas su,
//       jamais « 0,00 € » à sa place ; jamais « au moins » devant un bénéfice
//   I2. ce qui manque est NOMMÉ (sans ce que la page n'imprime pas : catégories, stock, top 10)
//   I3. URSSAF : régime pas choisi ⇒ section absente ; pas micro ⇒ la raison, aucun
//       montant ; micro ⇒ « à déclarer », cotisations au taux ; la période
//       trimestrielle, notée « déclarée », rythme pas choisi
//   I4. noir et blanc : aucune couleur hors encre et gris, aucun fond ; A4 au @page
//   I5. une page, même au pire (30 comptes, 6 sites, 20 manques) : la page coupe et
//       le DIT ; Chromium l'imprime en UNE page A4
//   I6. échappée (un nom de boutique « <script> » ne s'exécute pas), jamais « encaissé »
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const R0 = path.resolve(__dirname, '..');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };

const MUTATIONS = {
  'au-moins-perdu': ['src/recapImprimable.js', "{ v: a.n === 0 ? eurosTexte(0) : `${a.complet ? '' : 'au moins '}${eurosTexte(a.total)}`", "{ v: a.n === 0 ? eurosTexte(0) : `${''}${eurosTexte(a.total)}`"],
  'pas-su-zero': ['src/recapImprimable.js', "a.etat !== 'lu' ? { v: '—', n: 'pas pu être lus' }", "a.etat !== 'lu' ? { v: eurosTexte(0), n: 'pas pu être lus' }"],
  'couleur': ['src/recapImprimable.js', 'html,body{margin:0;padding:0;background:#fff;color:#000}', 'html,body{margin:0;padding:0;background:#f2f2f7;color:#0071e3}'],
  'sans-limite': ['src/recapImprimable.js', 'plateformes: 6, comptes: 8, manques: 7', 'plateformes: 99, comptes: 99, manques: 99'],
  'manque-tu': ['src/recapImprimable.js', "const manques = manquesRecap(d);", 'const manques = [];'],
  'non-echappe': ['src/recapImprimable.js', "const esc = (s) => String(s == null ? '' : s).replace(/[&<>\"']/g,", "const esc = (s) => String(s == null ? '' : s).replace(/[]/g,"],
  'urssaf-devinee': ['src/recapImprimable.js', "  if (!u) return null;\n", "  if (!u) return { micro: true, regime: '', lignes: [['ca', 'À déclarer', '0,00 €']], note: '' };\n"],
};
if (process.argv.includes('--prouve')) {
  let ko = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe' }); } catch (_) { rouge = true; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} : ${rouge ? 'rouge (gardée)' : 'VERTE — aucun contrôle ne la voit'}`);
    if (!rouge) ko += 1;
  }
  process.exit(ko ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, t, x) => { if (c) ok += 1; else ko += 1; console.log(`  ${c ? '✅' : '❌'} ${t}${!c && x != null && x !== '' ? ` — ${x}` : ''}`); };
const eur = (c) => { const n = Math.abs(c); return (c < 0 ? '−' : '') + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + String(n % 100).padStart(2, '0') + ' €'; };
const texte = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const ligneDe = (html, k) => { const m = new RegExp(`<tr data-recap-l="${k}">([\\s\\S]*?)</tr>`).exec(html); return m ? texte(m[1]).trim() : null; };

(async () => {
  const src = path.join(R0, 'src', 'recapImprimable.js');
  if (!fs.existsSync(src)) { dit(false, 'src/recapImprimable.js existe', 'absent'); console.log(`\n❌ audit-recap-imprimable : ${ko} rouge(s)`); process.exit(1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-recap-imprimable-'));
  fs.cpSync(path.join(R0, 'src'), path.join(dir, 'src'), { recursive: true, filter: (p) => !/\.(png|jpg|jpeg|webp|svg|css|jsx)$/i.test(p) });
  fs.cpSync(path.join(R0, 'api', '_lib'), path.join(dir, 'api', '_lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const mut = arg('mutation');
  if (mut) {
    const [f, a, b] = MUTATIONS[mut] || [];
    const p = path.join(dir, f || ''); const s = f ? fs.readFileSync(p, 'utf8') : '';
    if (!f || !s.includes(a)) { console.log(`mutation ${mut} : motif introuvable`); process.exit(2); }
    fs.writeFileSync(p, s.replace(a, b));
  }
  const imp = (f) => import('file://' + path.join(dir, 'src', f));
  const RI = await imp('recapImprimable.js'), RM = await imp('rapportMois.js'), BM = await imp('bilanMois.js'), MP = await imp('margePlateforme.js');
  const CC = await imp('design/carteChiffres.js'), BN = await imp('beneficeNoms.js');

  // ── Octobre 2026, inventé (la forme des entrées du Rapport du mois) ──
  const MAINT = new Date(2026, 10, 13, 10, 0).getTime();
  const ym = '2026-10';
  const T = (j, h = 12) => new Date(2026, 9, j, h).getTime();
  const lignes = [
    { plateforme: 'Vinted', ts: T(2), eur: 85, compte: 'shop_a', tx: '9001' },
    { plateforme: 'Vinted', ts: T(5), eur: 120, compte: 'shop_b', tx: '9003' },
    { plateforme: 'Vinted', ts: T(9), eur: 60, compte: 'shop_a', tx: '9004' },
    { plateforme: 'Leboncoin', ts: T(15), eur: 95, compte: 'lbc_moi', tx: '7001' },
    { plateforme: 'eBay', ts: T(18), eur: 142.3, compte: 'ebay_moi', tx: '12-345' },
    { plateforme: 'Vinted', ts: T(22), eur: 55, compte: 'shop_b', tx: '9007' },
    { plateforme: 'Vinted', ts: new Date(2026, 8, 30, 23).getTime(), eur: 999, compte: 'shop_a', tx: '8999' },   // hors du mois
  ];
  const dansMois = lignes.filter((l) => l.ts >= T(1, 0) && l.ts < new Date(2026, 10, 1).getTime());
  const venduC = dansMois.reduce((s, l) => s + Math.round(l.eur * 100), 0);
  const manque = ['shop_c'];
  const vendu = { n: dansMois.length, eur: venduC / 100, manque };
  const recuC = 30000 + 17730;
  const publie = { mois: [{ ym, ca: recuC / 100, n: 4 }], at: MAINT - 3600000, recu: { [ym]: recuC / 100 }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu' } };
  const recu = CC.recuPublieEntre(publie, { de: T(1, 0), a: new Date(2026, 10, 1).getTime(), ym, complet: true }, MAINT);
  const B = { n: 6, nCout: 6, ca: 557.3, brut: 210.1, net: 200, netFinal: 151.6, raison: '' };
  const CB = BN.chiffreBenefice(B, 'lu');
  const bilan = BM.bilanDuMois({ ym, vendu, recu, depense: 42.5, benefice: CB, B, meilleur: null, maintenant: MAINT, enCours: false });
  const releve = dansMois.map((l) => ({ plateforme: l.plateforme, ts: l.ts, eur: l.eur, achat: l.plateforme === 'eBay' ? null : Math.round(l.eur * 0.55 * 100) / 100, frais: 0 }));
  const plateformes = MP.margeParPlateforme({ vendu: lignes, manque, nonComptees: [], releve, de: T(1, 0), a: new Date(2026, 10, 1).getTime() });
  const achats = { type: 'achats', periode: ym, lignes: [], n: 3, total: 152.4, sansMontant: 1, articleSeul: 0, nGros: 0, manque: [], complet: false };
  const urssafMicro = { regime: 'micro', regimeTexte: 'Micro-entrepreneur', taux: 12.4, ca: recuC / 100, apayer: Math.round(recuC * 0.124) / 100, partiel: true };
  const base = { ym, maintenant: MAINT, boutique: { nom: 'Sneakers du Port', sous: 'SIRET 123 456 789 00012' }, bilan, vendu: { lignes, manque, nonComptees: [] }, B, benefice: CB, brut: BN.chiffreBrut(B),
    recuJours: null, plateformes, categories: null, titres: {}, stock: null, achats, urssaf: urssafMicro };
  const d = RM.donneesRapportMois(base);
  const P = { label: 'octobre 2026', date: '30 novembre 2026', declaree: false, nDeclares: 0, memeQueMois: true, ca: recuC / 100, partiel: true };
  const html = RI.pageRecapImprimable(d, { periode: P });
  const t = texte(html);

  console.log('I1. Les chiffres = ceux des données du Rapport du mois');
  const cle = (k) => d.cles.find((x) => x.cle === k);
  dit(ligneDe(html, 'ventes') && ligneDe(html, 'ventes').includes(cle('ventes').texte.replace(/ /g, ' ')), 'ventes du mois = le bilan (au moins : un compte pas lu)', ligneDe(html, 'ventes'));
  dit(/au moins/.test(cle('vendu').texte) && ligneDe(html, 'vendu').includes(`au moins ${eur(venduC)}`), 'vendu = bilanDuMois, « au moins » (compte pas lu)', ligneDe(html, 'vendu'));
  dit(ligneDe(html, 'recu').includes(eur(recuC)) && /versement/.test(ligneDe(html, 'recu')), 'reçu = la ligne publiée, au jour du versement', ligneDe(html, 'recu'));
  dit(ligneDe(html, 'achats').includes(`au moins ${eur(15240)}`) && /3 achats/.test(ligneDe(html, 'achats')), 'achats = le registre du mois, « au moins » (un montant pas lu)', ligneDe(html, 'achats'));
  dit(ligneDe(html, 'depenses').includes(eur(4250)), 'dépenses = comptaChargesMois (via le bilan)', ligneDe(html, 'depenses'));
  dit(ligneDe(html, 'benefice').includes(eur(15160)) && !/au moins/.test(ligneDe(html, 'benefice')), 'bénéfice = chiffreBenefice, jamais « au moins »', ligneDe(html, 'benefice'));
  const vin = plateformes.plateformes.find((x) => x.plat === 'Vinted');
  const trV = (/<tr data-recap-plat="Vinted">([\s\S]*?)<\/tr>/.exec(html) || [])[1] || '';
  dit(texte(trV).includes(eur(vin.vendu)) && texte(trV).includes(`${vin.n} vente`), 'par plateforme = margeParPlateforme (Vinted)', texte(trV));
  const cA = d.comptes.find((c) => c.nom === 'shop_a');
  const trA = (/<tr data-recap-compte="shop_a">([\s\S]*?)<\/tr>/.exec(html) || [])[1] || '';
  dit(cA && texte(trA).includes(eur(Math.round(cA.eur * 100))) && !t.includes('999,00'), 'par compte = les lignes du vendu (hors du mois : jamais)', texte(trA));
  const sCompt = d.comptes.reduce((s, c) => s + Math.round(c.eur * 100), 0);
  dit(sCompt === venduC, 'la somme des comptes = le vendu', `${sCompt} / ${venduC}`);
  // Bénéfice pas su : « — », le brut au prix connu en note, jamais un zéro.
  const Bp = { ...B, nCout: 4, netFinal: null, raison: 'achats', brut: 120.25 };
  const dP = RM.donneesRapportMois({ ...base, B: Bp, benefice: BN.chiffreBenefice(Bp, 'lu'), brut: BN.chiffreBrut(Bp), bilan: BM.bilanDuMois({ ym, vendu, recu, depense: null, benefice: BN.chiffreBenefice(Bp, 'lu'), B: Bp, maintenant: MAINT }), achats: null });
  const hP = RI.pageRecapImprimable(dP, { periode: P });
  dit(/^Bénéfice .*— *$/.test(ligneDe(hP, 'benefice')) && ligneDe(hP, 'benefice').includes('4 sur 6') && !/au moins/.test(ligneDe(hP, 'benefice')), 'bénéfice pas su : « — », « 4 sur 6 » au prix connu, jamais « au moins »', ligneDe(hP, 'benefice'));
  dit(/— *$/.test(ligneDe(hP, 'depenses')) && /— *$/.test(ligneDe(hP, 'achats')) && !/(?:^|[^\d\s])\s*0,00 €/.test(texte(hP)), 'dépenses et achats pas lus : « — », jamais 0,00 €', `${ligneDe(hP, 'depenses')} | ${ligneDe(hP, 'achats')}`);

  console.log('I2. Ce qui manque, NOMMÉ');
  const tP = texte(hP);
  dit(/prix d.achat manquant pour 2 ventes/.test(tP) && /Achats : pas pu être lus/.test(tP) && /Dépenses : pas lues/.test(tP), 'bénéfice, achats, dépenses : nommés', tP.slice(tP.indexOf('Ce qui manque'), tP.indexOf('Ce qui manque') + 300));
  dit(/shop_c/.test(t) && /minimum/.test(t), 'le compte pas lu est nommé (le vendu est un minimum)');
  dit(!/Catégories|Stock :|top 10/.test(t), 'rien de ce que la page n’imprime (catégories, stock, top 10)');

  console.log('I3. URSSAF');
  const tu = (/<table class="chiffres" data-recap-urssaf="micro">([\s\S]*?)<\/table>/.exec(html) || [])[1] || '';
  dit(texte(tu).includes(`au moins ${eur(recuC)}`) && texte(tu).includes(`au moins ${eur(Math.round(recuC * 0.124))}`) && /12,4 %/.test(texte(tu)), 'micro : « à déclarer » et cotisations au taux, « au moins » si partiel', texte(tu));
  dit(/au plus tard le 30 novembre 2026/.test(t), 'la date de déclaration de la période');
  const dNul = RM.donneesRapportMois({ ...base, urssaf: null });
  const hNul = RI.pageRecapImprimable(dNul, {});
  dit(!/data-recap-urssaf|<h2>URSSAF|Cotisations|À déclarer/.test(hNul), 'régime pas choisi : aucune section URSSAF');
  const dPart = RM.donneesRapportMois({ ...base, urssaf: { regime: 'particulier', regimeTexte: 'Particulier', taux: 12.4, raison: 'Rien à déclarer à l’URSSAF pour ce statut.' } });
  const tPart = texte(RI.pageRecapImprimable(dPart, {}));
  dit(/Particulier/.test(tPart) && !/Cotisations/.test(tPart), 'particulier : la raison, aucun montant');
  const tTri = texte(RI.pageRecapImprimable(d, { periode: { label: 'T4 2026', date: '31 janvier 2027', declaree: false, nDeclares: 0, memeQueMois: false, ca: 712.4, partiel: true } }));
  dit(/Toute la période T4 2026 \(à déclarer au plus tard le 31 janvier 2027\) au moins 712,40 €/.test(tTri), 'trimestriel : la période entière, son montant (au moins)', tTri.slice(tTri.indexOf('Toute'), tTri.indexOf('Toute') + 120));
  dit(/déjà notée « déclarée »/.test(texte(RI.pageRecapImprimable(d, { periode: { ...P, declaree: true, nDeclares: 1 } }))), 'période notée « déclarée » : dit');
  dit(/Rythme de déclaration pas choisi/.test(texte(RI.pageRecapImprimable(d, { periode: null }))), 'rythme pas choisi : dit (jamais deviné)');

  console.log('I4. Noir et blanc, A4');
  const css = (/<style>([\s\S]*?)<\/style>/.exec(html) || [])[1] || '';
  const couleurs = [...css.matchAll(/#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)].map((m) => m[0].toLowerCase());
  const GRIS = (c) => /^#([0-9a-f])\1\1$/.test(c) || /^#([0-9a-f]{2})\1\1$/.test(c);
  dit(couleurs.length > 0 && couleurs.every(GRIS), 'seulement de l’encre et du gris (aucune teinte)', couleurs.join(' '));
  dit(!/background:(?!#fff)/.test(css.replace(/\s/g, '')), 'aucun fond (hors blanc)');
  dit(/@page\{size:A4/.test(css.replace(/\s+/g, '').replace('A4portrait', 'A4')), '@page A4');

  console.log('I5. Une page, même au pire');
  const pire = RM.donneesRapportMois({ ...base,
    vendu: { lignes: Array.from({ length: 30 }, (_, i) => ({ plateforme: 'Vinted', ts: T(1 + (i % 28)), eur: 10 + i, compte: `compte_tres_long_nom_${i}`, tx: String(5000 + i) })), manque: ['a1', 'a2', 'a3', 'a4', 'a5'], nonComptees: Array.from({ length: 6 }, (_, i) => ({ plateforme: ['Vestiaire', 'eBay', 'Leboncoin'][i % 3], raison: 'montant pas sûr ' + i, ts: T(3) })) },
    achats: { ...achats, sansMontant: 4, articleSeul: 3, manque: ['shop_x', 'shop_y'] } });
  const hPire = RI.pageRecapImprimable(pire, { periode: { label: 'T4 2026', date: '31 janvier 2027', declaree: false, nDeclares: 0, memeQueMois: false, ca: 1, partiel: false } });
  const nCpt = (hPire.match(/data-recap-compte="/g) || []).length;
  dit(pire.comptes.length === 30 && nCpt === RI.LIMITES.comptes && /data-recap-compte-reste="22"/.test(hPire), `30 comptes : ${RI.LIMITES.comptes} écrits, puis « et 22 autres comptes »`, `${nCpt}`);
  const resteC = pire.comptes.slice(RI.LIMITES.comptes).reduce((s, c) => s + Math.round(c.eur * 100), 0);
  dit(texte((/<tr data-recap-compte-reste="22">([\s\S]*?)<\/tr>/.exec(hPire) || [])[1] || '').includes(eur(resteC)), '« et 22 autres » porte LEUR somme (les mêmes lignes)', eur(resteC));
  const nM = RI.manquesRecap(pire).length;
  dit(nM > RI.LIMITES.manques && new RegExp(`et ${nM - RI.LIMITES.manques} autres? points?`).test(texte(hPire)), `${nM} manques : ${RI.LIMITES.manques} écrits, le reste dit (le Rapport du mois les liste)`, String(nM));
  let chromium = null;
  try { ({ chromium } = require(path.join(R0, 'node_modules', 'playwright'))); } catch (_) {}
  if (chromium && fs.existsSync('/opt/pw-browsers/chromium')) {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    try {
      const pg = await b.newPage();
      let alerte = false; pg.on('dialog', async (x) => { alerte = true; await x.dismiss(); });
      for (const [nom, h] of [['mois inventé', html], ['le pire', hPire]]) {
        await pg.setContent(h, { waitUntil: 'load' });
        await pg.emulateMedia({ media: 'print' });
        const octets = await pg.pdf({ preferCSSPageSize: true, printBackground: false });
        const pages = (octets.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
        const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(octets.toString('latin1'));
        dit(pages === 1, `${nom} : Chromium l’imprime en UNE page`, `${pages} pages`);
        dit(!!box && Math.round(+box[1]) === 595 && Math.round(+box[2]) === 842, `${nom} : au format A4`, box && `${box[1]}×${box[2]}`);
        if (arg('png')) {
          const out = path.resolve(arg('png')); fs.mkdirSync(out, { recursive: true });
          const f = path.join(out, `recap-${nom.replace(/\W+/g, '-')}.pdf`); fs.writeFileSync(f, octets);
          try { execFileSync('pdftoppm', ['-png', '-r', '70', f, f.replace(/\.pdf$/, '')]); } catch (_) {}
        }
      }
      // I6 : un nom de boutique hostile ne s'exécute pas.
      const hostile = RI.pageRecapImprimable(RM.donneesRapportMois({ ...base, boutique: { nom: '<img src=x onerror="alert(1)"><script>alert(2)</script>', sous: '' } }), { periode: P });
      await pg.setContent(hostile, { waitUntil: 'load' }); await pg.waitForTimeout(300);
      dit(!alerte && !/<script>alert/.test(hostile), 'un nom de boutique « <script> » est échappé : rien ne s’exécute');
    } finally { await b.close(); }
  } else dit(false, 'Chromium du banc présent (/opt/pw-browsers/chromium)');
  dit(!/encaiss/i.test(t + texte(hP) + texte(hPire)), 'jamais « encaissé »');

  console.log(ko ? `\n❌ audit-recap-imprimable : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-recap-imprimable : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit-recap-imprimable : ' + (e && e.stack || e)); process.exit(1); });
