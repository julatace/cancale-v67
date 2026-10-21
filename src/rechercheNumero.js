// ── « TOUT SUR LE N° » : LA RECHERCHE PAR NUMÉRO (21 octobre) ───────────────
// Julien : « une recherche par numéro, partout » — il tape « 128 » (ou « B128 »,
// « n128 », « N°128 ») et voit tout ce qui concerne la paire N°128 : sa fiche
// (en ligne, à confirmer, plus en ligne), ses ventes (Vinted, Leboncoin, eBay),
// son bordereau (prêt · imprimé · posté), son carton dans le Stock, et si le N°
// est en double ou a été réattribué.
//
// ⚠️ PAR IDENTITÉ SEULEMENT (§5) : un numéro se compare par sa CLÉ (`cleNum` —
//    « b125 » = « B125 », « 007 » = « 7 »), jamais par sous-chaîne (« 12 » ne
//    désigne pas la N°128), jamais par titre (deux paires au même titre sont deux
//    paires). Une vente Vinted se relie par sa transaction : la correction posée à
//    la main sur la vente, sinon transaction → annonce (`txnItem`) → la fiche de
//    CETTE annonce. eBay et Leboncoin : leurs règles d'identité (SKU + carte 013,
//    lien / référence VRM), fournies par l'appelant (`o.numEbayLigne`,
//    `o.numEbayAnnonce`, `o.numLbc`) — elles ne sont pas réécrites ici (§11).
// ⚠️ L'ARCHIVE B (migration 013) : « 230 » (nouveau) et « B230 » (ancien) sont
//    deux clés différentes — jamais mélangées. Si l'ancien existe, on le DIT (un
//    lien vers « B230 »), on ne l'ajoute pas aux résultats.
// Trois états (jamais deux) : 'passu' (des données n'ont pas pu être lues, et
// rien n'a été trouvé dans le reste) · 'rien' (tout est lu, ce N° n'a jamais
// servi) · 'trouve'. Plus 'invalide' (ce n'est pas un numéro).
// Module PUR, sans React : l'écran et l'audit (`audit-recherche-numero.cjs`)
// appellent la même fonction.

const arr = (a) => (Array.isArray(a) ? a : []);
const str = (v) => String(v == null ? '' : v).trim();

// Le numéro tapé → sa clé, ou null si ce n'est pas un numéro.
//   « N°128 », « n° 128 », « no 128 », « #128 » → 128 ;
//   « n128 » → 128, sauf si « N » est une vraie série de numéros (le préfixe
//   choisi dans Réglages ou la lettre d'archive) : « N128 » reste alors N128.
export const lireNumeroCherche = (q, o, series = []) => {
  const cleNum = o && o.cleNum; if (typeof cleNum !== 'function') return null;
  let s = str(q);
  if (!s) return null;
  s = s.replace(/^(?:n\s*°|n\s*º|no\.?\s+|num(?:[ée]ro)?\.?\s*|#)\s*/i, '');
  const avecN = /^[nN]\s*\d+$/.test(s);
  const serieN = arr(series).some((x) => str(x).toUpperCase() === 'N');
  if (avecN && !serieN) s = s.replace(/^[nN]\s*/, '');
  const k = cleNum(s);
  return /^([A-Z]{1,3})?\d{1,6}$/.test(k) ? k : null;
};

// Le cœur. `d` : les données lues (chaque source `null` = « pas su »).
//   fiches       { [idAnnonce]: { numero, title, photo, accountId, reattribue, … } }
//   pool         numéros servis (`vinted_used_numeros`)
//   enLigne      Set d'ids d'annonces en ligne · aConfirmer : Set d'ids « à confirmer »
//   comptesOk    Set des comptes que la recherche regarde (null = tous)
//   ventes       commandes Vinted vendues · txnItem { tx: idAnnonce } · saleOv { tx: { numero } }
//   bordereaux   [{ tx, pdf }] · imprimes { tx: … } · postes { tx: … }
//   ebayCommandes, ebayAnnonces, lbcVentes ([{ id, …vente }])
//   plan         la pièce du Stock · archive : la lettre d'archive ('' sinon)
// `o` : les règles de l'app (cleNum, conflits, numEbayLigne, numEbayAnnonce,
//   numLbc, ouStock, aPoster, revenue, expediee).
export const toutSurLeNumero = (q, d, o, series = []) => {
  const cleNum = o.cleNum;
  const k = lireNumeroCherche(q, o, series);
  if (!k) return { etat: 'invalide', cle: null };
  const D = d || {};
  const manques = [];
  const archive = str(D.archive).toUpperCase();
  const estAncien = !!archive && new RegExp('^' + archive + '\\d+$').test(k);
  const meme = (v) => v != null && str(v) !== '' && cleNum(v) === k;

  // 1. Les fiches (annonces numérotées) qui portent CE numéro.
  const fiches = D.fiches;
  const annonces = [], reattribues = [];
  if (fiches == null) manques.push('tes fiches numérotées');
  else {
    for (const [id, f] of Object.entries(fiches)) {
      if (!f) continue;
      const r = f.reattribue;
      // Ce N° a été DONNÉ à une autre paire par le règlement d'un doublon.
      if (r && meme(r.de) && !meme(f.numero)) reattribues.push({ sens: 'parti', id: String(id), de: str(r.de), vers: str(f.numero), ecrit: !!r.ecrit, title: f.title || '' });
      if (!meme(f.numero)) continue;
      if (D.comptesOk && f.accountId && !D.comptesOk.has(String(f.accountId))) continue;
      const etat = D.enLigne == null ? 'passu' : D.enLigne.has(String(id)) ? 'en-ligne' : (D.aConfirmer && D.aConfirmer.has(String(id))) ? 'a-confirmer' : 'plus-en-ligne';
      annonces.push({ id: String(id), title: f.title || '', photo: f.photo || null, price: f.price || null, etat, accountId: f.accountId || null });
      if (r && meme(r.vers)) reattribues.push({ sens: 'arrive', id: String(id), de: str(r.de), vers: str(f.numero), ecrit: !!r.ecrit, title: f.title || '' });
    }
    if (D.enLigne == null) manques.push('tes annonces en ligne');
  }
  const idsFiches = new Set(annonces.map((a) => a.id));

  // 2. Les ventes Vinted : par la transaction, jamais par le titre.
  let ventesVinted = [];
  if (D.ventes == null || fiches == null) manques.push('tes ventes Vinted');
  else {
    if (D.txnItem == null) manques.push('le lien vente → annonce de Vinted');
    const vus = new Set();
    for (const v of arr(D.ventes)) {
      const tx = v && v.transaction_id != null ? String(v.transaction_id) : '';
      if (!tx || vus.has(tx)) continue;
      const ov = D.saleOv && D.saleOv[tx];
      let num = ov && str(ov.numero) ? ov.numero : null;
      let item = D.txnItem ? D.txnItem[tx] : null;
      if (num == null && item != null && fiches[String(item)]) num = fiches[String(item)].numero;
      if (!meme(num)) continue;
      vus.add(tx);
      ventesVinted.push({ ...v, _tx: tx, _item: item != null ? String(item) : null, _parCorrection: !!(ov && str(ov.numero)) });
    }
  }
  const txs = new Set(ventesVinted.map((v) => v._tx));

  // 3. Leboncoin et eBay, par leurs règles d'identité.
  let ventesLbc = [];
  if (D.lbcVentes == null) manques.push('tes ventes Leboncoin');
  else ventesLbc = arr(D.lbcVentes).filter((v) => v && meme(o.numLbc ? o.numLbc(v) : null));
  let ventesEbay = [];
  if (D.ebayCommandes == null) manques.push('tes commandes eBay');
  else for (const c of arr(D.ebayCommandes)) {
    const lignes = arr(c && c.lineItems);
    if (lignes.some((li) => meme(o.numEbayLigne ? o.numEbayLigne(c, li) : null))) ventesEbay.push(c);
  }
  let annoncesEbay = [];
  if (D.ebayAnnonces == null) manques.push('tes annonces eBay');
  else annoncesEbay = arr(D.ebayAnnonces).filter((a) => a && meme(o.numEbayAnnonce ? o.numEbayAnnonce(a) : null));

  // 4. Les bordereaux des ventes Vinted trouvées (par transaction).
  let bordereaux = [];
  if (D.bordereaux == null) { if (txs.size) manques.push('tes bordereaux'); }
  else {
    const parTx = new Map();
    for (const b of arr(D.bordereaux)) { const tx = b && b.tx != null ? String(b.tx) : ''; if (tx && txs.has(tx)) parTx.set(tx, { tx, pdf: !!(b.pdf || (parTx.get(tx) || {}).pdf) }); }
    bordereaux = [...parTx.values()].map((b) => {
      const v = ventesVinted.find((x) => x._tx === b.tx);
      const poste = !!((D.postes && D.postes[b.tx]) || (v && o.expediee && o.expediee(v)));
      const imprime = !!(D.imprimes && D.imprimes[b.tx]);
      return { ...b, etat: poste ? 'poste' : imprime ? 'imprime' : b.pdf ? 'pret' : 'attente' };
    });
  }

  // 5. Le carton dans le Stock.
  let stock = null;
  if (D.plan == null) manques.push('ton Stock');
  else stock = o.ouStock ? (o.ouStock(D.plan, k) || null) : null;

  // 6. Deux paires PRÉSENTES sous ce N° : la règle de l'app (`conflitsDeNumeros`).
  const porteurs = [];
  for (const a of annonces) if (a.etat === 'en-ligne' || a.etat === 'a-confirmer') porteurs.push({ type: 'annonce', titre: a.title, id: a.id, aConfirmer: a.etat === 'a-confirmer' });
  for (const v of ventesVinted) {
    if (o.aPoster && o.aPoster(v)) porteurs.push({ type: 'vente', titre: v.title || '', id: v._tx });
    // Annulée AVANT l'envoi : la paire n'a jamais quitté l'étagère, elle porte
    // encore son numéro (la règle de `porteursNum`).
    else if (o.revenue && o.revenue(v)) porteurs.push({ type: 'annulee', titre: v.title || '', id: v._tx });
  }
  if (stock) porteurs.push({ type: 'garage', id: stock.itemId + ':' + (stock.key || stock.pileIdx || '') });
  const double = !!(o.conflits && o.conflits({ [k]: porteurs }).length);

  const servi = D.pool == null ? null : arr(D.pool).some((x) => meme(x));
  if (D.pool == null) manques.push('la liste des numéros servis');
  // L'ancien numéro du même chiffre existe : on le dit, on ne le mélange pas.
  let ancien = null;
  if (archive && !estAncien && /^\d+$/.test(k) && fiches) {
    const ka = cleNum(archive + k);
    if (Object.values(fiches).some((f) => f && cleNum(f.numero || '') === ka) || arr(D.pool).some((x) => cleNum(x) === ka)) ancien = ka;
  }

  const trouve = annonces.length || ventesVinted.length || ventesLbc.length || ventesEbay.length || annoncesEbay.length || bordereaux.length || stock || reattribues.length || servi;
  const etat = trouve ? 'trouve' : manques.length ? 'passu' : 'rien';
  return {
    etat, cle: k, ancienNumero: estAncien, ancien, servi, double, porteurs,
    annonces, idsFiches: [...idsFiches], reattribues,
    ventes: { vinted: ventesVinted, lbc: ventesLbc, ebay: ventesEbay }, annoncesEbay,
    bordereaux, stock, manques,
  };
};
