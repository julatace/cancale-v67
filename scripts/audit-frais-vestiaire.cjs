// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES FRAIS QUE VESTIAIRE PREND — LUS, JAMAIS DEVINÉS (11 nov. soir)
//         node scripts/audit-frais-vestiaire.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Sur Vestiaire Collective, je veux voir les frais que la plateforme
// prend. » La règle UNIQUE `fraisVc` (api/_lib/vestiaire-regle.js) : frais =
// prix affiché (`prixVente`, clé `sellerPrice`) − ce que Vestiaire verse
// (`montant`, clé `sellerEarning`), les deux lus en euros ; l'un absent ou pas
// sûr ⇒ « pas lu » (jamais 0). L'audit EXÉCUTE la vraie règle et le vrai
// `fraisParPlateforme` (src/fraisPlateformes.js) sur 50 ventes INVENTÉES de
// formes variées, compare au calcul fait ici à la main, au centime, puis lit
// que l'écran (fiche de vente Vestiaire, carte « Frais par site ») passe par
// cette règle et dit « frais pas lus ». `--prouve` rejoue l'audit sur des
// copies MUTÉES de la règle : chacune doit le faire rougir.
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// Charge un texte de module À CÔTÉ de son original (ses imports relatifs marchent).
const charger = async (texte, dossier) => {
  const tmp = path.join(dossier, `.audit-fv-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};

// ── 50 ventes inventées (graine fixe), chacune avec CE QU'ON ATTEND ─────────
function jeu() {
  let g = 7;
  const rnd = () => { g = (g * 48271) % 2147483647; return g / 2147483647; };
  const out = [];
  for (let i = 0; i < 50; i++) {
    const cPrix = 2000 + Math.floor(rnd() * 60000);                // 20 € à 620 €
    const cFrais = Math.floor(cPrix * (0.1 + rnd() * 0.15));       // 10 à 25 %
    const cVerse = cPrix - cFrais;
    const prixVente = { valeur: cPrix / 100, devise: 'EUR', cle: 'sellerPrice' };
    const montant = { valeur: cVerse / 100, devise: 'EUR', cle: 'sellerEarning' };
    const v = { id: String(70000000 + i), etat: 'Paiement envoyé', date: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00Z`, montant, prixVente };
    let attendu = { lu: true, cFrais, cPrix, cVerse };
    switch (i % 10) {
      case 0: delete v.prixVente; attendu = { lu: false }; break;                                 // prix pas lu
      case 1: delete v.montant; attendu = { lu: false }; break;                                   // versé pas lu
      case 2: v.montant = { ...montant, cle: 'price.cents' }; attendu = { lu: false }; break;      // montant sous une clé qui ne dit pas « versé »
      case 3: v.prixVente = { ...prixVente, devise: 'USD' }; attendu = { lu: false }; break;      // autre devise
      case 4: v.prixVente = { ...prixVente, cle: 'productPrice' }; attendu = { lu: false }; break; // pas la clé du prix de vente
      case 5: v.montant = { ...montant, valeur: (cPrix + 500) / 100 }; attendu = { lu: false }; break; // versé > prix : incohérent
      case 6: v.montant = { ...montant, cle: 'sellerPrice' }; attendu = { lu: false }; break;      // le prix pris pour le versé
      default: break;                                                                              // lu
    }
    out.push({ v, attendu });
  }
  return out;
}

async function audit(regleTexte, { muet = false } = {}) {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (!muet && (!c || process.env.BAVARD)) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 300) : '')); };
  let V = null; try { V = await charger(regleTexte, path.join(R, 'api', '_lib')); } catch (e) { V = null; }
  dit(!!V && typeof V.fraisVc === 'function', 'api/_lib/vestiaire-regle.js exporte la règle `fraisVc`');
  let F = null; try { F = await charger(lire('src/fraisPlateformes.js'), os.tmpdir()); } catch (_) { F = null; }
  dit(!!F && typeof F.fraisParPlateforme === 'function', 'src/fraisPlateformes.js exporte `fraisParPlateforme`');
  if (V && typeof V.fraisVc === 'function') {
    const J = jeu();
    let bons = 0, faux0 = 0, mal = [];
    for (const { v, attendu } of J) {
      const f = V.fraisVc(v);
      if (attendu.lu) {
        const pct = Math.round(attendu.cFrais * 1000 / attendu.cPrix) / 10;
        if (f && f.lu && f.cFrais === attendu.cFrais && f.cPrix === attendu.cPrix && f.cVerse === attendu.cVerse && f.pct === pct) bons++; else mal.push(v.id + ' ' + JSON.stringify(f));
      } else {
        if (f && f.lu === false && f.frais == null && f.cFrais == null && typeof f.raison === 'string' && f.raison) bons++; else mal.push(v.id + ' ' + JSON.stringify(f));
        if (f && (f.frais === 0 || f.cFrais === 0)) faux0++;
      }
    }
    dit(bons === 50, `50 ventes inventées : frais = prix − versé au centime quand les DEUX sont lus (${J.filter((x) => x.attendu.lu).length}), « pas lu » avec sa raison sinon (${J.filter((x) => !x.attendu.lu).length})`, mal.slice(0, 3).join(' | '));
    dit(faux0 === 0, 'une vente aux frais pas lus ne vaut JAMAIS 0 €', String(faux0));
    // L'exemple de Julien, mot pour mot : 250 € · 37,50 € (15 %) · 212,50 €.
    const ex = V.fraisVc({ prixVente: { valeur: 250, devise: 'EUR', cle: 'sellerPrice' }, montant: { valeur: 212.5, devise: 'EUR', cle: 'sellerEarning' } });
    dit(ex && ex.lu && ex.frais === 37.5 && ex.pct === 15 && ex.verse === 212.5 && ex.prix === 250, 'Prix 250 € · Frais Vestiaire 37,50 € (15 %) · Pour toi 212,50 €', JSON.stringify(ex));
    dit(V.fraisVc(null).lu === false && V.fraisVc(undefined).lu === false && V.fraisVc({}).lu === false, 'rien rangé ⇒ pas lu (aucune exception)');

    if (F && typeof F.fraisParPlateforme === 'function') {
      // Le coût par site : les MÊMES 50 ventes dans le relevé (vente = versé, la règle du bénéfice).
      const de = Date.parse('2026-10-01T00:00:00Z'), a = Date.parse('2026-11-01T00:00:00Z');
      const releve = J.filter((x) => x.v.montant && /earning/i.test(x.v.montant.cle) && x.v.montant.devise === 'EUR')
        .map((x) => ['Vestiaire', '', 'vestiaire:' + x.v.id, Date.parse(x.v.date), x.v.montant.valeur, null, 0, '', '', '']);
      const ventes = J.map((x) => x.v);
      const Rr = { commandeEbayEngagee: () => true, fraisVc: V.fraisVc };
      const G = F.fraisParPlateforme({ releve, ebay: [], packs: [], de, a, R: Rr, vestiaire: ventes });
      const S = G.sites.find((s) => s.plateforme === 'Vestiaire');
      const lus = J.filter((x) => x.attendu.lu);
      const cAtt = lus.reduce((t, x) => t + x.attendu.cFrais, 0), cPrix = lus.reduce((t, x) => t + x.attendu.cPrix, 0);
      dit(S && Math.round(S.frais * 100) === cAtt && Math.round(S.commission * 100) === cAtt, `Frais par site · Vestiaire = la somme des frais LUS (${(cAtt / 100).toFixed(2)} €)`, JSON.stringify(S));
      dit(S && S.couverture && S.couverture.lus === lus.length && S.couverture.n === releve.length, `couverture DITE : frais lus sur ${lus.length}/${releve.length} ventes`, JSON.stringify(S && S.couverture));
      dit(S && S.pct === Math.round(cAtt * 1000 / cPrix) / 10, '% sur le PRIX des seules ventes aux frais lus', S && String(S.pct));
      dit(S && !S.complet && !S.commissionPasLue && F.texteCouverture(S) === `frais lus sur ${lus.length}/${releve.length} ventes`, 'partiel, et le manque nommé (« frais lus sur N/M ventes »)', F.texteCouverture(S || {}));
      // Aucune vente aux frais lus ⇒ « commission pas lue », aucun %, jamais 0 € présenté comme lu.
      const sansPrix = ventes.map((v) => { const w = { ...v }; delete w.prixVente; return w; });
      const H = F.fraisParPlateforme({ releve, ebay: [], packs: [], de, a, R: Rr, vestiaire: sansPrix }).sites.find((s) => s.plateforme === 'Vestiaire');
      dit(H && H.commissionPasLue && H.pct == null && F.texteCouverture(H) === 'commission pas lue', 'aucun prix lu ⇒ « commission pas lue », aucun %', JSON.stringify(H));
      // L'appelant qui ne passe pas les ventes (calculette) : rien n'est deviné.
      const K = F.fraisParPlateforme({ releve, ebay: [], packs: [], de, a, R: { commandeEbayEngagee: () => true } }).sites.find((s) => s.plateforme === 'Vestiaire');
      dit(K && K.commissionPasLue && K.pct == null, 'sans les ventes rangées ⇒ « commission pas lue » (comme avant)', JSON.stringify(K));
      // Le versé du relevé doit être CELUI de la vente (identité par n°) : un n° qui ne colle pas n'emprunte rien.
      const rel2 = releve.map((l) => ['Vestiaire', '', l[2] + 'x', l[3], l[4], null, 0, '', '', '']);
      const Z = F.fraisParPlateforme({ releve: rel2, ebay: [], packs: [], de, a, R: Rr, vestiaire: ventes }).sites.find((s) => s.plateforme === 'Vestiaire');
      dit(Z && Z.couverture && Z.couverture.lus === 0, 'relié par le n° de la vente seulement (jamais par ressemblance)', JSON.stringify(Z && Z.couverture));
    }
  }
  // ── L'écran : la fiche de vente Vestiaire et la carte « Frais par site » passent par la règle.
  const VC = sansCommentaires(lire('src/ecrans/Vestiaire.jsx'));
  dit(/\bfraisVc\b[^;]*from '\.\.\/\.\.\/api\/_lib\/vestiaire-regle\.js'/.test(VC) && /const fv = vcVenteAnnulee\(v\) \? null : fraisVc\(v\)/.test(VC), 'la ligne de vente Vestiaire lit `fraisVc(v)` (aucun calcul à part)');
  dit(/<dt>Frais Vestiaire<\/dt>/.test(VC) && /frais pas lus/.test(VC) && /<dt>Prix<\/dt>/.test(VC) && /'Pour toi'/.test(VC), 'la fiche dit « Prix · Frais Vestiaire · Pour toi », et « frais pas lus » sinon');
  dit(/fv && fv\.lu \? `Frais Vestiaire \$\{eurosRecap\(fv\.frais\)\}/.test(VC), 'la ligne porte « Frais Vestiaire … (… %) » seulement quand ils sont lus');
  const toutSrc = ['src/ecrans/Vestiaire.jsx', 'src/ecrans/Stats.jsx', 'src/App.jsx', 'src/fraisPlateformes.js', 'src/margePlateforme.js'].map((f) => sansCommentaires(lire(f))).join('\n');
  dit(!/prixVente\.valeur\s*-|prixVente\.valeur\)\s*-|-\s*[\w.]*montant\.valeur/.test(toutSrc), 'aucun « prix − versé » refait hors de la règle (une règle, un propriétaire)');
  const ST = sansCommentaires(lire('src/ecrans/Stats.jsx'));
  dit(/<FraisParSiteCarte [^>]*ventesVc=\{ventesVc\}/.test(ST) && /R: \{ commandeEbayEngagee, fraisVc \}, vestiaire: Array\.isArray\(ventesVc\) \? ventesVc : null/.test(ST), 'Statistiques → Frais par site reçoit les ventes Vestiaire et la règle `fraisVc`');
  return { ok, ko };
}

const MUTATIONS = [
  ['absent = 0', "if (!pv || typeof pv.valeur !== 'number' || !isFinite(pv.valeur) || pv.valeur <= 0) return { lu: false, raison: 'prix de vente pas lu' };", "if (!pv || typeof pv.valeur !== 'number' || !isFinite(pv.valeur) || pv.valeur <= 0) return { lu: false, raison: 'prix de vente pas lu', frais: 0, cFrais: 0 };"],
  ['clé du prix ignorée', "if (String(pv.cle || '') !== 'sellerPrice' || String(pv.devise || '').toUpperCase() !== 'EUR')", "if (String(pv.devise || '').toUpperCase() !== 'EUR')"],
  ['devise ignorée', "if (String(pv.cle || '') !== 'sellerPrice' || String(pv.devise || '').toUpperCase() !== 'EUR')", "if (String(pv.cle || '') !== 'sellerPrice')"],
  ['clé du versé ignorée', "if (!/earning/i.test(String((m && m.cle) || ''))) return { lu: false, raison: 'montant versé pas sûr' };", ''],
  ['versé > prix accepté', "if (cVerse > cPrix) return { lu: false, raison: 'versé plus haut que le prix' };", ''],
  ['pourcentage sur le versé', 'pct: Math.round(cFrais * 1000 / cPrix) / 10', 'pct: Math.round(cFrais * 1000 / cVerse) / 10'],
  ['règle absente', 'export function fraisVc(v) {', 'function fraisVcX(v) {'],
];

(async () => {
  const regle = lire('api/_lib/vestiaire-regle.js');
  const r = await audit(regle);
  let mko = 0;
  if (PROUVE) {
    for (const [nom, avant, apres] of MUTATIONS) {
      if (!regle.includes(avant)) { console.log(`  ❌ mutation « ${nom} » impossible (texte absent)`); mko++; continue; }
      const m = await audit(regle.replace(avant, apres), { muet: true });
      if (m.ko > 0) console.log(`  ✅ mutation « ${nom} » : ${m.ko} rouge(s)`); else { console.log(`  ❌ mutation « ${nom} » : l'audit reste vert`); mko++; }
    }
  }
  console.log(`\n${r.ko || mko ? '❌' : '✅'} audit-frais-vestiaire : ${r.ok} vert(s), ${r.ko} rouge(s)${PROUVE ? ` · mutations ${MUTATIONS.length - mko}/${MUTATIONS.length}` : ''}`);
  process.exit(r.ko || mko ? 1 : 0);
})();
