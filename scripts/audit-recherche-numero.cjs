// Audit : « TOUT SUR LE N° » — LA RECHERCHE PAR NUMÉRO (21 octobre).
//
// Julien : « une recherche par numéro, partout » — « 128 », « B128 », « n128 ».
// La règle vit dans un module pur (src/rechercheNumero.js) : on l'EXÉCUTE sur des
// données INVENTÉES, avec les vraies règles d'identité de l'app extraites
// d'App.jsx (`cleNum`, `conflitsDeNumeros`, `normTitle`, `triNum`), et on juge ce
// qu'elle REND :
//   · par CLÉ de numéro, jamais par sous-chaîne (« 12 » ≠ « 128 ») ;
//   · deux paires au MÊME TITRE et aux N° différents ne se mélangent jamais
//     (§5 : la vente de l'une n'apparaît pas sous l'autre) ;
//   · l'archive B (013) : « 128 » ≠ « B128 », l'ancien est signalé, pas ajouté ;
//   · « n128 », « N°128 », « #128 », « 007 », « b125 » ;
//   · une vente se relie par la correction posée sur la vente, sinon
//     transaction → annonce → fiche ;
//   · bordereau prêt / imprimé / posté, carton du Stock, double, réattribué ;
//   · trois états : pas su · rien · trouvé.
// `--prouve` réaffaiblit la règle de six façons : chacune doit passer au ROUGE.
const fs = require('fs'), path = require('path'), os = require('os');
const SRC = path.join(__dirname, '..', 'src', 'rechercheNumero.js');
const APP = require('./_source-app.cjs').sourceApp(path.join(__dirname, '..'));

function extraire(src, nom) {
  const re = new RegExp(`^( *)(?:async )?function ${nom}\\(|^( *)const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) return '';
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const REGLES = (() => {
  const code = ['cleNum', 'normTitle', 'triNum', 'conflitsDeNumeros'].map((n) => {
    const t = extraire(APP, n); if (!t) throw new Error(`${n} introuvable dans App.jsx`); return t;
  }).join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(code + '\nreturn { cleNum, conflitsDeNumeros };')();
})();

const MUTATIONS = {
  // « 12 » trouverait la N°128 : la ressemblance de numéro.
  sous_chaine: (s) => s.replace("const meme = (v) => v != null && str(v) !== '' && cleNum(v) === k;", "const meme = (v) => v != null && str(v) !== '' && cleNum(v).includes(k);"),
  // Une vente reliée par son TITRE (§5 : interdit).
  titre: (s) => s.replace("      if (!meme(num)) continue;\n      vus.add(tx);", "      if (!meme(num) && !Object.values(fiches).some((f) => f && meme(f.numero) && f.title === v.title)) continue;\n      vus.add(tx);"),
  // « B128 » lu « 128 » : l'archive mélangée au nouveau numéro.
  archive_melangee: (s) => s.replace("  const k = cleNum(s);\n", "  const k = cleNum(s).replace(/^[A-Z]+/, '');\n"),
  // Une lecture ratée prise pour « jamais servi ».
  passu_vaut_rien: (s) => s.replace("const etat = trouve ? 'trouve' : manques.length ? 'passu' : 'rien';", "const etat = trouve ? 'trouve' : 'rien';"),
  // Le double n'est plus vu.
  double_ignore: (s) => s.replace("const double = !!(o.conflits && o.conflits({ [k]: porteurs }).length);", "const double = false;"),
  // La correction posée sur la vente ignorée.
  correction_ignoree: (s) => s.replace("let num = ov && str(ov.numero) ? ov.numero : null;", "let num = null;"),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `rechercheNumero-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// Données inventées. Deux paires au MÊME titre : N°40 (annonce a40) et N°41 (a41).
const DONNEES = () => ({
  fiches: {
    a128: { numero: '128', title: 'Nike Air Max 1 noir taille 42', photo: 'p128' },
    a1280: { numero: '1280', title: 'Adidas Samba taille 40' },
    a12: { numero: '12', title: 'Salomon XT-6 taille 41' },
    aB128: { numero: 'B128', title: 'Vieille paire taille 39' },
    a40: { numero: '40', title: 'Adidas Spezial noir taille 35,5' },
    a41: { numero: '41', title: 'Adidas Spezial noir taille 35,5' },
    a7: { numero: '7', title: 'Puma Suede taille 44' },
    aBb: { numero: 'B125', title: 'Ancienne taille 43' },
    a50: { numero: '50', title: 'Nike Dunk taille 40' },
    a50b: { numero: '50', title: 'Asics Gel taille 43' },
    a60: { numero: '60', title: 'Nike Dunk taille 40' },
    a90: { numero: '90', title: 'New Balance 550 taille 41', reattribue: { de: '51', vers: '90', at: '2026-10-20' } },
    aCache: { numero: '300', title: 'Compte masqué taille 40', accountId: '999' },
  },
  pool: [1, 7, 12, 40, 41, 50, 51, 90, 128, 200, 300, 1280, 'B128', 'B125'],
  enLigne: new Set(['a60', 'a128', 'a1280', 'a12', 'a41', 'a50', 'a50b', 'a90', 'a7']),
  aConfirmer: new Set(['a40']),
  comptesOk: new Set(['111']),
  ventes: [
    { transaction_id: 't40', title: 'Adidas Spezial noir taille 35,5', status: 'Commande finalisée' },      // vente de la N°40 (txnItem)
    { transaction_id: 't41', title: 'Adidas Spezial noir taille 35,5', status: 'Le paiement a été validé' }, // vente de la N°41 (à poster)
    { transaction_id: 't128', title: 'Nike Air Max 1 noir taille 42', status: 'Bordereau envoyé au vendeur' },
    { transaction_id: 'tCorr', title: 'Paire sans annonce', status: 'Commande finalisée' },                 // N°7 par la correction
    { transaction_id: 'tAnn', title: 'Asics Gel taille 43', status: 'Commande annulée' },                    // annulée avant l'envoi, N°60
  ],
  txnItem: { t40: 'a40', t41: 'a41', t128: 'a128' },
  saleOv: { tCorr: { numero: '007' }, tAnn: { numero: '60' } },
  bordereaux: [{ tx: 't128', pdf: true }, { tx: 't41', pdf: true }, { tx: 't40', pdf: true }],
  imprimes: { t41: 1 },
  postes: { t40: 1 },
  lbcVentes: [{ _id: 'l1', itemId: 'lbc1', title: 'Adidas Spezial noir taille 35,5', isSeller: true }, { _id: 'l2', itemId: 'lbc2', title: 'Nike Air Max 1 noir taille 42', isSeller: true }],
  ebayCommandes: [{ orderId: 'e1', lineItems: [{ sku: 'VRM-41', title: 'Adidas Spezial noir taille 35,5' }] }, { orderId: 'e2', lineItems: [{ sku: '', title: 'Nike Air Max 1 noir taille 42' }] }],
  ebayAnnonces: [{ itemId: 'i1', sku: 'VRM-128', title: 'Nike Air Max 1 noir taille 42' }, { itemId: 'i2', sku: 'VRM-1280', title: 'x' }],
  plan: { rooms: [{ name: 'Garage', items: [{ id: 'm1', name: 'Étagère métal', slots: { '0_0': ['128'] } }] }] },
  archive: 'B',
});
const O = () => ({
  cleNum: REGLES.cleNum,
  conflits: REGLES.conflitsDeNumeros,
  // Les règles d'identité eBay / Leboncoin de l'app sont ailleurs (audits eBay
  // et Leboncoin) : ici, un SKU « VRM-n » et un lien posé à la main.
  numEbayLigne: (c, li) => { const m = /^VRM-(\w+)$/.exec((li && li.sku) || ''); return m ? REGLES.cleNum(m[1]) : null; },
  numEbayAnnonce: (a) => { const m = /^VRM-(\w+)$/.exec((a && a.sku) || ''); return m ? REGLES.cleNum(m[1]) : null; },
  numLbc: (v) => ({ lbc1: '40' })[v.itemId] || '',
  ouStock: (plan, k) => { for (const rm of plan.rooms) for (const it of rm.items) for (const key in (it.slots || {})) if (it.slots[key].some((x) => REGLES.cleNum(x) === k)) return { roomName: rm.name, itemId: it.id, itemName: it.name, key, nom: 'case ' + key }; return null; },
  aPoster: (v) => /paiement a été validé/i.test(v.status || ''),
  revenue: (v) => /annul/i.test(v.status || ''),
  expediee: (v) => /exp[ée]di|achemin|livr/i.test(v.status || ''),
});

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, t) => { if (!c) ko++; if (bavard || !c) console.log((c ? '✅ ' : '❌ ') + t); };
  let M;
  try { M = await charger(src); } catch (e) { dit(false, 'module chargé : ' + e.message); return ko; }
  const T = (q, d = DONNEES(), series = ['', 'B']) => { try { return M.toutSurLeNumero(q, d, O(), series); } catch (e) { dit(false, `« ${q} » a levé : ${e.message}`); return { etat: 'erreur', annonces: [], ventes: { vinted: [], lbc: [], ebay: [] }, annoncesEbay: [], bordereaux: [], reattribues: [], manques: [] }; } };
  const ids = (r) => r.annonces.map((a) => a.id).sort().join(',');

  // 1. Par CLÉ, jamais par sous-chaîne.
  const r128 = T('128');
  dit(r128.etat === 'trouve' && ids(r128) === 'a128', `« 128 » ne rend que la fiche N°128 (rendu : ${ids(r128)})`);
  dit(ids(T('12')) === 'a12', `« 12 » ne rend ni la N°128 ni la N°1280 (rendu : ${ids(T('12'))})`);
  dit(r128.annonces[0] && r128.annonces[0].etat === 'en-ligne', 'la N°128 est dite en ligne');
  dit(r128.annoncesEbay.map((a) => a.itemId).join() === 'i1', 'l\'annonce eBay VRM-128 (pas VRM-1280)');

  // 2. L'archive B : « 128 » ≠ « B128 », l'ancien est signalé.
  dit(r128.ancien === 'B128', `« 128 » signale l'ancien N°B128 sans l'ajouter (ancien : ${r128.ancien})`);
  const rB = T('B128');
  dit(ids(rB) === 'aB128' && rB.ancienNumero, `« B128 » ne rend que l'ancienne paire (rendu : ${ids(rB)})`);
  dit(ids(T('b125')) === 'aBb', '« b125 » = « B125 »');

  // 3. Les formes tapées.
  dit(ids(T('n128')) === 'a128', '« n128 » = N°128');
  dit(ids(T('N°128')) === 'a128' && ids(T('#128')) === 'a128' && ids(T('n° 128')) === 'a128', '« N°128 », « #128 », « n° 128 »');
  dit(T('n128', DONNEES(), ['N', 'B']).cle === 'N128', 'avec une série « N », « n128 » reste N128');
  dit(ids(T('007')) === 'a7', '« 007 » = N°7');
  dit(T('Nike air max').etat === 'invalide' && T('').etat === 'invalide', 'un titre n\'est pas un numéro (aucun bloc)');

  // 4. Deux paires au MÊME TITRE ne se mélangent jamais (§5).
  const r40 = T('40'), r41 = T('41');
  dit(ids(r40) === 'a40' && ids(r41) === 'a41', 'N°40 et N°41 (même titre) : chacune sa fiche');
  dit(r40.ventes.vinted.map((v) => v._tx).join() === 't40', `N°40 : seule SA vente Vinted (rendu : ${r40.ventes.vinted.map((v) => v._tx).join()})`);
  dit(r41.ventes.vinted.map((v) => v._tx).join() === 't41', `N°41 : seule SA vente Vinted (rendu : ${r41.ventes.vinted.map((v) => v._tx).join()})`);
  dit(r40.ventes.lbc.length === 1 && r41.ventes.lbc.length === 0, 'la vente Leboncoin reliée à la N°40 n\'apparaît pas sous la N°41');
  dit(r41.ventes.ebay.length === 1 && r40.ventes.ebay.length === 0, 'la commande eBay VRM-41 n\'apparaît pas sous la N°40');
  dit(r128.ventes.ebay.length === 0 && r128.ventes.lbc.length === 0, 'une commande eBay / vente Leboncoin au même TITRE sans identité ne désigne pas la N°128');
  dit(r40.annonces[0] && r40.annonces[0].etat === 'a-confirmer', 'N°40 est « à confirmer »');

  // 5. La correction posée sur la vente.
  dit(T('7').ventes.vinted.map((v) => v._tx).join() === 'tCorr', 'la vente corrigée « 007 » appartient à la N°7');

  // 6. Bordereaux.
  const e = (r) => r.bordereaux.map((b) => b.etat).join();
  dit(e(r128) === 'pret' && e(r41) === 'imprime' && e(r40) === 'poste', `bordereau prêt / imprimé / posté (rendu : ${e(r128)} · ${e(r41)} · ${e(r40)})`);

  // 7. Stock.
  dit(r128.stock && r128.stock.itemName === 'Étagère métal', 'le carton N°128 est trouvé dans le Stock');
  dit(r41.stock === null, 'la N°41 n\'est rangée nulle part');

  // 8. Double et réattribution.
  dit(T('50').double === true, 'deux paires présentes sous le N°50 : double');
  // 25 oct. (décision de Julien, PR #701) : une vente ANNULÉE ne compte plus
  // comme un conflit (conflitsDeNumeros l'exclut) — elle ne part jamais, donc pas
  // « la mauvaise paire qui s'expédie ». La recherche par N° suit la même règle.
  dit(T('60').double === false, 'une annonce en ligne + une vente ANNULÉE sous le N°60 : PAS un double (vente annulée exclue, décision du 25 oct., cohérent avec Colis)');
  dit(r41.double === false && r128.double === false, 'une annonce + sa case du Stock, ou une vente à poster seule : pas un double');
  const r51 = T('51'), r90 = T('90');
  dit(r51.reattribues.some((x) => x.sens === 'parti' && x.vers === '90'), 'N°51 : « remplacé, la paire porte maintenant le N°90 »');
  dit(r90.reattribues.some((x) => x.sens === 'arrive' && x.de === '51' && !x.ecrit), 'N°90 : « remplace le N°51, pas encore écrit »');

  // 9. Trois états.
  dit(T('200').etat === 'trouve' && T('200').servi === true && T('200').annonces.length === 0, 'N°200 : a servi, aucune fiche aujourd\'hui');
  dit(T('999').etat === 'rien', 'N°999 (jamais servi, tout lu) : « rien »');
  const dPasSu = DONNEES(); dPasSu.ventes = null;
  dit(T('999', dPasSu).etat === 'passu', 'N°999 avec les ventes illisibles : « pas su », jamais « rien »');
  const dFiches = DONNEES(); dFiches.fiches = null;
  dit(T('128', dFiches).etat !== 'rien' && T('128', dFiches).manques.length > 0, 'fiches illisibles : pas de « rien »');
  dit(T('300').annonces.length === 0, 'une fiche d\'un compte masqué n\'est pas montrée');
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [nom, mut] of Object.entries(MUTATIONS)) {
      const m = mut(src);
      if (m === src) { console.log(`❌ mutation ${nom} : ancre introuvable`); continue; }
      const ko = await audit(m, false);
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} → ${ko} rouge(s)`);
      if (ko) rouges++;
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(`\n${rouges}/${n} mutations au rouge`);
    process.exit(rouges === n ? 0 : 1);
  }
  const ko = await audit(src, true);
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ recherche par numéro : tout est vert');
  process.exit(ko ? 1 : 0);
})();
