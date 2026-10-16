// ════════════════════════════════════════════════════════════════════════════
//  LA VEILLE D'ACHAT, EXÉCUTÉE (15 octobre) — la règle, la route, le matin.
//        node scripts/audit-veille.cjs [--src dossier]
//
//  Julien : « un assistant de veille d'achat — mes recherches (marque, modèle et
//  autres noms, pointures, états, prix maximum livraison comprise, mots exclus,
//  lots) ; VRM montre les annonces qui correspondent, dit POURQUOI, et ce qui
//  n'est pas vérifiable ; aucun achat ni paiement automatique ».
//
//  Ce contrôle EXÉCUTE (§4.10 : une route n'est vérifiée que si un banc
//  l'exécute) :
//    · la règle pure (`api/_lib/veille-regle.js`) sur des titres inventés : une
//      pointure à un tiers près n'est PAS la pointure demandée, une livraison
//      inconnue ne vaut jamais 0 (« total non confirmé »), un lot, un mot exclu,
//      un état hors famille sont écartés AVEC leur raison ;
//    · la vraie route (`api/ebay.js` → `api/_lib/veille.js`) contre une fausse
//      base (lignes owner/id, compare-et-échange) et un faux eBay : session
//      exigée, lectures filtrées sur le vendeur, une lecture ratée n'écrit
//      rien, quota et délai réservés AVANT eBay, la simulation ne range rien,
//      un refus d'eBay est dit — jamais « 0 annonce » ;
//    · le passage du matin : rien sans alerte cochée, une annonce n'est jamais
//      signalée deux fois, ni annoncée « nouvelle » quand il l'a déjà vue à
//      l'écran ou qu'eBay ne la rend plus ce matin, horaires silencieux,
//      catégorie coupée, écriture ratée ⇒ aucune notification ;
//    · la relecture du 15 octobre (14 défauts) : « 42,5 » est UNE pointure,
//      « 60 € » se lit, « pack » seul n'est pas un lot, le nom suit la
//      recherche modifiée, un prix qui monte met la fiche à jour, un modèle
//      hors de la liste connue (« 2002R ») a sa fourchette, l'achat marqué
//      compte dans le budget, une note n'est pas une décision, l'hôte des
//      photos est borné ;
//    · ce qui ne doit JAMAIS exister : une requête à Vinted ou Leboncoin, une
//      route d'achat, d'offre ou d'enchère eBay.
//  Données INVENTÉES (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String((e && e.message) || e).slice(0, 200)); } };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return null; } };

const J = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const JWT_J = 'eyJh.jeton-de-J.sig', JWT_B = 'eyJh.jeton-de-B.sig';
process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

const MIN = 60000, H = 60 * MIN, JOUR = 24 * H;
const T0 = Date.parse('2026-10-15T08:00:00.000Z');    // jeudi 15 octobre, 10:00 à Paris

// ── LE FAUX eBAY (données inventées) ─────────────────────────────────────────
const item = (id, title, prix, livraison, cond, extra) => ({
  itemId: `v1|${id}|0`, legacyItemId: String(id), title,
  price: { value: prix, currency: 'EUR' },
  ...(livraison === undefined ? {} : { shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: livraison, currency: 'EUR' } }] }),
  condition: cond === '3000' ? 'Occasion' : cond === '1750' ? 'Neuf avec défauts' : cond === '1000' ? 'Neuf avec boîte' : '', conditionId: cond,
  image: { imageUrl: `https://i.ebayimg.com/images/g/x${id}/s-l500.jpg` },
  itemLocation: { country: 'FR' }, buyingOptions: ['FIXED_PRICE'],
  seller: { username: 'vendeur_' + id, feedbackPercentage: '99.1', feedbackScore: 812 },
  itemCreationDate: new Date(T0 - id % 7 * H).toISOString(),
  ...(extra || {}),
});
const ITEMS_SPEZIAL = () => [
  item(110001, 'Adidas Spezial Handball 42 bleu', '45.00', '6.50', '3000'),          // retenue, total confirmé 51,50
  item(110002, 'Adidas Spezial 42 2/3 noir', '40.00', '5.00', '3000'),               // pointure 42 2/3 ≠ 42
  item(110003, 'Lot de 2 paires Adidas Spezial 42', '50.00', '5.00', '3000'),        // lot
  item(110004, 'Adidas Spezial taille 42 enfant', '30.00', '5.00', '3000'),          // mot exclu
  item(110005, 'Adidas Spezial EU 42 marron', '50.00', undefined, '3000'),           // livraison inconnue
  item(110006, 'Adidas Spezial 42 rouge', '55.00', '9.00', '3000'),                  // 64 € > 60 €
  item(110007, 'Adidas Spezial 42/43 gris', '30.00', '5.00', '3000'),                // plusieurs pointures
  item(110008, 'Adidas Spezial UK 8 vert', '35.00', '4.00', '3000'),                 // pointure UK : non comparée
  item(110009, 'Adidas Spezial 42 beige', '35.00', '4.00', '1750'),                  // neuf avec défauts
];
const ITEMS_HANDBALL = () => [
  item(110001, 'Adidas Spezial Handball 42 bleu', '45.00', '6.50', '3000'),          // même annonce : une seule fois
  item(110011, 'Adidas Handball Spezial 42 blanc', '52.00', '0.00', '3000', { image: undefined }),   // 52 € livrée, sans photo
];
let mode = {};
let base = [];
const journal = [];
const interdits = [];      // toute requête vers Vinted, Leboncoin ou Vestiaire, sur TOUT l'audit
const rep = (corps, status = 200) => new Response(status === 204 ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json' } });
const projette = (r, sel) => {
  if (!sel || sel === 'data') return { data: r.data };
  const out = {};
  for (const part of decodeURIComponent(sel).split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (m) out[m[1] || m[2]] = m[2] === 'id' ? r.id : m[2] === 'owner' ? r.owner : r.data; }
  return out;
};
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) {
    const a = String(h.Authorization || h.authorization || '');
    if (a === 'Bearer ' + JWT_J) return rep({ id: J, email: 'j@exemple.test' });
    if (a === 'Bearer ' + JWT_B) return rep({ id: B, email: 'b@exemple.test' });
    return rep({ msg: 'invalid' }, 401);
  }
  if (/vinted|leboncoin|vestiaire/i.test(u)) { interdits.push(u); return rep({}, 418); }
  if (u.includes('ebay.com')) {
    journal.push({ ou: 'ebay', m, u, corps: String(opts.body || ''), h });
    if (u.includes('/identity/v1/oauth2/token')) {
      if (mode.jetonKo) return rep({ error: 'invalid_client' }, 401);
      return rep({ access_token: 'jeton-application', expires_in: 7200 });
    }
    if (u.includes('/buy/browse/v1/item_summary/search')) {
      if (mode.browse === '403') return rep({ errors: [{ errorId: 1100, message: 'Access denied' }] }, 403);
      if (mode.browse === 'forme') return rep({ quelquechose: true });
      const q = decodeURIComponent((/[?&]q=([^&]*)/.exec(u) || [])[1] || '');
      const items = /handball/i.test(q) ? ITEMS_HANDBALL() : (mode.items ? mode.items() : ITEMS_SPEZIAL());
      return rep({ total: mode.total != null ? mode.total : items.length, limit: 100, offset: 0, itemSummaries: items });
    }
    return rep({ errors: [{ message: 'route eBay non prévue' }] }, 404);
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return rep([]);
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    if (m === 'GET') {
      journal.push({ ou: 'lecture', u: q, id, owner });
      if (mode.lectureKo && mode.lectureKo.includes(id)) return rep({ message: 'boom' }, 500);
      const sel = (/[?&]select=([^&]*)/.exec(q) || [])[1];
      return rep(base.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner)).map((r) => projette(r, sel)));
    }
    journal.push({ ou: 'ecriture', m, u: q, id, owner, corps: String(opts.body || '') });
    if (mode.ecritureKo && (mode.ecritureKo.includes(id) || mode.ecritureKo.some((x) => String(opts.body || '').includes('"id":"' + x + '"')))) return rep({ message: 'boom' }, 500);
    let rows = []; try { rows = [].concat(JSON.parse(opts.body || '[]')); } catch (_) {}
    if (m === 'PATCH') {
      const revEq = (/[?&]data->>rev=eq\.([^&]*)/.exec(q) || [])[1];
      const revNul = /[?&]data->>rev=is\.null/.test(q);
      const touche = base.filter((x) => x.id === id && (!owner || x.owner === owner) && (revNul ? x.data.rev == null : String(x.data.rev) === revEq));
      for (const x of touche) x.data = rows[0].data;
      return rep(touche.map((x) => ({ id: x.id })));
    }
    for (const r of rows) {
      if (base.some((x) => x.id === r.id && x.owner === r.owner)) return rep({ code: '23505' }, 409);
      base.push({ owner: r.owner, id: r.id, data: r.data });
    }
    return rep('', 201);
  }
  return rep({});
};
const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; return x; };
const ligne = (owner, id) => (base.find((r) => r.owner === owner && r.id === id) || {}).data;
const browseAppels = () => journal.filter((j) => j.ou === 'ebay' && j.u.includes('/buy/browse/'));
const RECHERCHE = { marque: 'Adidas', noms: ['Spezial', 'Handball Spezial'], tailles: ['42'], etats: ['occasion'], prixMaxEuros: '60', motsExclus: 'enfant', lots: 'exclure', encheres: 'non' };

(async () => {
  let R = null, V = null, E = null;
  try { R = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'veille-regle.js')).href); } catch (e) { dit(false, 'la règle de la veille existe (api/_lib/veille-regle.js)', String(e.message).slice(0, 120)); }
  try { V = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'veille.js')).href); } catch (e) { dit(false, 'la route de la veille existe (api/_lib/veille.js)', String(e.message).slice(0, 120)); }
  try { E = await import(pathToFileURL(path.join(RACINE, 'api', 'ebay.js')).href); } catch (e) { dit(false, 'api/ebay.js se charge', String(e.message).slice(0, 120)); }
  R = R || {}; V = V || {};

  console.log('── 1. La règle : ce que dit un titre');
  await essaie('pointures', async () => {
    const t = (s) => R.taillesDuTitre(s).eu.join('|');
    dit(t('Adidas Spezial 42 2/3 noir') === '42 2/3', '« 42 2/3 » est lu comme 42 2/3 — pas comme du 42', t('Adidas Spezial 42 2/3 noir'));
    dit(t('Spezial taille 42,5') === '42.5' && t('Samba T42.') === '42' && t('Gazelle EU42') === '42', '42,5 · T42. · EU42 lus juste');
    dit(t('Spezial 45,00 € port compris') === '' && t('Gazelle 45€') === '' && t('Art42 basket') === '', 'un prix ou « art42 » ne sont pas des pointures');
    const uk = R.taillesDuTitre('Adidas Spezial UK 8 vert');
    dit(uk.eu.length === 0 && uk.autres.join() === 'UK 8', 'une pointure UK est NOMMÉE, jamais convertie ni comparée', JSON.stringify(uk));
    dit(t('Adidas Spezial 42/43 gris') === '42|43', 'deux pointures dans un titre sont toutes deux vues');
  });
  await essaie('analyse', async () => {
    const n = R.normaliserRecherche(RECHERCHE, { maintenant: T0, nouvelId: 'r0000000001' });
    dit(n.ok && n.recherche.prixMax === 6000 && n.recherche.tailles.join() === '42', 'une recherche se valide (prix en centimes, pointure normalisée)', JSON.stringify(n.ok ? { p: n.recherche.prixMax, t: n.recherche.tailles } : n));
    const r = n.recherche;
    const an = (it) => R.analyserAnnonce(R.lireItemEbay(it), r);
    const sansLivr = an(item(120001, 'Adidas Spezial EU 42 marron', '50.00', undefined, '3000'));
    dit(sansLivr.garde && sansLivr.totalConfirme === false && sansLivr.inverifiables.some((x) => /total non confirmé/.test(x)),
      'livraison inconnue ⇒ gardée, total NON confirmé, et c\'est dit', JSON.stringify(sansLivr.inverifiables));
    const trop = an(item(120002, 'Adidas Spezial 42 rouge', '55.00', '9.00', '3000'));
    dit(!trop.garde && trop.exclusion.code === 'prix', '55 € + 9 € de livraison > 60 € ⇒ écartée (le total compte, pas l\'article seul)', trop.exclusion && trop.exclusion.texte);
    const tiers = an(item(120003, 'Adidas Spezial 42 2/3 noir', '40.00', '5.00', '3000'));
    dit(!tiers.garde && tiers.exclusion.code === 'taille', 'pointure 42 2/3 ≠ 42 ⇒ écartée, avec la pointure lue', tiers.exclusion && tiers.exclusion.texte);
    const lot = an(item(120004, 'Lot de 2 paires Adidas Spezial 42', '50.00', '5.00', '3000'));
    dit(!lot.garde && lot.exclusion.code === 'lot', 'un lot est écarté quand les lots sont exclus');
    const seulement = R.analyserAnnonce(R.lireItemEbay(item(120005, 'Adidas Spezial 42 bleu', '40.00', '5.00', '3000')), { ...r, lots: 'seulement' });
    dit(!seulement.garde && seulement.exclusion.code === 'pas-lot', '« seulement des lots » écarte une paire seule');
    const mot = an(item(120006, 'Adidas Spezial taille 42 enfant', '30.00', '5.00', '3000'));
    dit(!mot.garde && mot.exclusion.code === 'mot', 'un mot exclu écarte l\'annonce');
    const etat = an(item(120007, 'Adidas Spezial 42 beige', '35.00', '4.00', '1750'));
    dit(!etat.garde && etat.exclusion.code === 'etat', '« neuf avec défauts » n\'est ni neuf ni occasion : écartée et dite, jamais rangée par défaut');
    const deux = an(item(120008, 'Adidas Spezial 42/43 gris', '30.00', '5.00', '3000'));
    dit(deux.garde && deux.drapeaux.includes('plusieurs-pointures'), 'plusieurs pointures dans le titre ⇒ gardée, signalée');
    const bon = an(item(120009, 'Adidas Spezial Handball 42 bleu', '45.00', '6.50', '3000'));
    dit(bon.garde && bon.totalConfirme && bon.total === 5150 && bon.raisons.join(' · ') === '« Spezial » · Adidas · pointure 42 · Occasion · ≤ 60,00 € livraison comprise',
      'POURQUOI, en faits courts : le modèle, la marque, la pointure, l\'état, ≤ 60 € livraison comprise (total 51,50 €)', bon.raisons.join(' · '));
    const marque = R.analyserAnnonce(R.lireItemEbay(item(120010, 'Spezial 42 bleu', '40.00', '5.00', '3000')), r);
    dit(marque.garde && marque.inverifiables.includes('marque absente du titre'), 'une marque absente du titre est « non vérifiée », pas inventée');
    const titre = R.titrePorte('Nike Air Max 100 noir', 'Air Max 1');
    dit(!titre && R.titrePorte('Salomon XT6 noir', 'XT-6'), '« Air Max 1 » ne trouve pas « Air Max 100 » ; « XT-6 » trouve « XT6 »');
    dit(!R.normaliserRecherche({ noms: ['Spezial'], prixMaxEuros: '60', tailles: ['41 1/4'] }).ok, 'une pointure illisible est refusée avec sa raison (jamais devinée)');
  });
  await essaie('saisie', async () => {
    // « 42,5 » est UNE pointure : la virgule décimale ne coupe pas le champ.
    const d = (x) => JSON.stringify(R.decouperPointures(x));
    dit(d('42,5') === '["42,5"]' && d('42, 43') === '["42","43"]' && d('42,5, 43') === '["42,5","43"]' && d('42 2/3; 44') === '["42 2/3","44"]',
      '« 42,5 » est une pointure ; « 42, 43 » en sont deux (la virgule décimale ne coupe pas)', [d('42,5'), d('42, 43'), d('42,5, 43')].join(' '));
    const n = R.normaliserRecherche({ noms: ['Spezial'], prixMaxEuros: '60 €', tailles: '42,5' }, { nouvelId: 'r0000000009' });
    dit(n.ok && n.recherche.tailles.join() === '42.5' && n.recherche.prixMax === 6000, '« 42,5 » et « 60 € » tapés au clavier : acceptés (42,5 et 60 €)', JSON.stringify(n.ok ? { t: n.recherche.tailles, p: n.recherche.prixMax } : n));
    dit(R.centimesDe('45 €') === 4500 && R.centimesDe('60 euros') === 6000 && R.centimesDe('1 234,50') === 123450 && R.centimesDe('45,5') === 4550 && R.centimesDe('quarante') === null && R.centimesDe('') === null,
      'un montant se lit comme on l\'écrit (« 45 € », « 60 euros », « 1 234,50 ») ; illisible ⇒ null, jamais 0');
    // Le nom suit la recherche : modifiée en Samba 44, elle ne s'appelle plus « Spezial 42 ».
    const m = R.normaliserRecherche({ nom: 'Adidas Spezial 42', marque: 'Adidas', noms: ['Samba'], tailles: ['44'], prixMaxEuros: '60' }, { nouvelId: 'r0000000009' });
    dit(m.ok && m.recherche.nom === 'Adidas Samba 44' && R.nomRecherche({ marque: 'Adidas', noms: ['Spezial'], tailles: ['42.5'] }) === 'Adidas Spezial 42,5',
      'le nom se refait TOUJOURS depuis la marque, le modèle et les pointures (un nom rangé ne reste jamais en arrière)', m.ok && m.recherche.nom);
  });
  await essaie('lots et photos', async () => {
    // « pack » est un nom de coloris (« Protection Pack ») : un lot seulement s'il est compté.
    const lots = ['Lot de 2 paires Adidas Spezial 42', 'Adidas Spezial 42 pack de 2', 'Nike Dunk 2-pack 42', 'Samba 42 x2', 'Gazelle bundle 42'];
    const pasLots = ['New Balance 2002R Protection Pack gris 42', 'New Balance 1906D Protection Pack Rain Cloud 42', 'Yeezy 350 V2 pack 42', 'Air Max 90 42'];
    dit(lots.every(R.estUnLot) && !pasLots.some(R.estUnLot), '« Protection Pack » n\'est pas un lot ; « pack de 2 », « 2-pack », « x2 », « lot » en sont',
      'faux lots : ' + pasLots.filter(R.estUnLot).join(' | ') + ' · lots manqués : ' + lots.filter((t) => !R.estUnLot(t)).join(' | '));
    const r = R.normaliserRecherche({ marque: 'New Balance', noms: ['2002R'], tailles: ['42'], prixMaxEuros: '120' }, { nouvelId: 'r0000000009' }).recherche;
    const pp = R.analyserAnnonce(R.lireItemEbay(item(140001, 'New Balance 2002R Protection Pack gris 42', '90.00', '6.00', '3000')), r);
    dit(pp.garde && !pp.drapeaux.includes('lot'), 'une 2002R « Protection Pack » est gardée avec le défaut « Sans lots », sans drapeau « lot »', JSON.stringify(pp.exclusion));
    const img = (u) => R.lireItemEbay(item(140002, 'Adidas Spezial 42', '40.00', '5.00', '3000', { image: { imageUrl: u } })).image;
    dit(img('https://i.ebayimg.com/images/g/x/s-l500.jpg') !== '' && img('https://pixel-espion-ebayimg.com/t.gif') === '' && img('https://notebayimg.com/x.jpg') === '' && img('https://i.ebayimg.com.espion.fr/x.jpg') === '',
      'la photo : l\'hôte d\'images d\'eBay seul (« pixel-espion-ebayimg.com », « notebayimg.com » refusés)');
    const ecran = lire('src/VeilleAchat.jsx') || '';
    dit(/PHOTO_EBAY[^;]*from '\.\.\/api\/_lib\/veille-regle\.js'/.test(ecran.replace(/\n/g, ' ')) && !/const PHOTO_EBAY\s*=/.test(ecran), 'l\'écran lit la MÊME règle de photo que le serveur (importée, jamais recopiée)');
  });

  console.log('── 2. La règle : une vérification, sa mémoire, ses alertes');
  await essaie('fusion', async () => {
    const r = R.normaliserRecherche(RECHERCHE, { maintenant: T0, nouvelId: 'r0000000001' }).recherche;
    const lectures = [{ ok: true, items: ITEMS_SPEZIAL(), total: 9 }, { ok: true, items: ITEMS_HANDBALL(), total: 2 }];
    const jug = R.jugerLectures(lectures, r);
    const ids = jug.retenues.map((x) => x.id).sort().join(',');
    dit(ids === '110001,110005,110007,110008,110011', 'retenues : 5 annonces, la même annonce trouvée par deux noms comptée UNE fois', ids);
    dit(jug.ecartees.taille === 1 && jug.ecartees.lot === 1 && jug.ecartees.mot === 1 && jug.ecartees.prix === 1 && jug.ecartees.etat === 1,
      'les écartées sont comptées par cause', JSON.stringify(jug.ecartees));
    const f1 = R.fusionnerVerification(null, r.id, jug, T0, 'clic', r);
    dit(f1.nouvelles.length === 5, 'première vérification : 5 nouvelles');
    const d1 = R.appliquerDecision(f1.data, r.id, '110007', { statut: 'refusee', motif: 'taille' }, T0 + MIN);
    const d2 = R.appliquerDecision(d1.data, r.id, '110001', { statut: 'a-examiner' }, T0 + 2 * MIN);
    const f2 = R.fusionnerVerification(d2.data, r.id, jug, T0 + H, 'clic', r);
    const a = f2.data.parRecherche[r.id].annonces;
    dit(f2.nouvelles.length === 0 && a['110007'].statut === 'refusee' && a['110001'].statut === 'a-examiner',
      'revérifiée : une refusée ne revient JAMAIS en nouvelle, une « à examiner » garde sa décision', `nouvelles=${f2.nouvelles.length}`);
    dit(d2.data.historique.length === 2 && d2.data.historique[1].motif === 'taille', 'l\'historique garde les décisions et leur motif');
    const sansUne = R.jugerLectures([{ ok: true, items: ITEMS_SPEZIAL().filter((x) => x.legacyItemId !== '110005'), total: 8 }], r);
    const f3 = R.fusionnerVerification(f2.data, r.id, sansUne, T0 + 2 * H, 'clic', r);
    const a5 = f3.data.parRecherche[r.id].annonces['110005'];
    dit(a5 && a5.revuLe === T0 + H, 'une annonce absente d\'une lecture N\'EST PAS dite vendue : elle garde sa date de dernière lecture');
    const plusStricte = { ...r, prixMax: 4000 };
    const rj = R.rejuger(f3.data, r.id, plusStricte);
    const ar = rj.parRecherche[r.id].annonces;
    dit(!ar['110011'] && ar['110001'] && ar['110001'].statut === 'a-examiner', 'recherche resserrée (40 €) : la nouvelle à 52 € part, la « à examiner » reste (sa décision)');
    const m1 = R.marquerAlertes(f1.data, r.id, T0);
    const m2 = R.marquerAlertes(m1.data, r.id, T0 + JOUR);
    dit(m1.alertees.length === 5 && m2.alertees.length === 0, 'une annonce n\'est signalée qu\'UNE fois', `${m1.alertees.length} puis ${m2.alertees.length}`);
    // La borne : au-delà de 40 annonces gardées, le DÉTAIL des plus anciennes
    // part — jamais une « à examiner » — et un refus dont le détail est parti
    // reste un refus (sa mémoire compacte) : il ne revient pas en « nouvelle ».
    const beaucoup = Array.from({ length: 45 }, (_, k) => item(130000 + k, `Adidas Spezial 42 lot${k}`.replace(' lot', ' coloris '), '40.00', '5.00', '3000'));
    const jB = R.jugerLectures([{ ok: true, items: beaucoup, total: 45 }], r);
    let dB = R.fusionnerVerification(null, r.id, jB, T0, 'clic', r).data;
    const nB = Object.keys(dB.parRecherche[r.id].annonces).length;
    dB = R.appliquerDecision(dB, r.id, '130000', { statut: 'refusee', motif: 'photos' }, T0 + MIN).data;
    dB = R.appliquerDecision(dB, r.id, '130001', { statut: 'a-examiner' }, T0 + MIN).data;
    const purge = JSON.parse(JSON.stringify(dB));
    delete purge.parRecherche[r.id].annonces['130000'];            // le détail est parti, la mémoire du refus reste
    const fB = R.fusionnerVerification(purge, r.id, jB, T0 + H, 'clic', r);
    const aB = fB.data.parRecherche[r.id].annonces;
    dit(nB === 40 && Object.keys(aB).length <= 40 && aB['130001'] && aB['130001'].statut === 'a-examiner',
      'au plus 40 annonces gardées par recherche — une « à examiner » n\'est jamais retirée', `${nB} puis ${Object.keys(aB).length}`);
    dit(!fB.nouvelles.includes('130000') && !(aB['130000'] && aB['130000'].statut === 'nouvelle'),
      'un refus dont le détail est parti ne revient JAMAIS en « nouvelle » (sa mémoire compacte suffit)');
    const echec = R.jugerLectures([{ ok: false, erreur: 'x' }, { ok: false, erreur: 'y' }], r);
    dit(echec.ok === false, 'toutes les lectures en échec ⇒ pas un « 0 annonce »');
    const partiel = R.jugerLectures([{ ok: true, items: ITEMS_SPEZIAL(), total: 9 }, { ok: false, erreur: 'y' }], r);
    dit(partiel.ok && partiel.partiel && !partiel.complet, 'une requête sur deux en échec ⇒ partielle, et dite');
  });
  await essaie('prix qui monte', async () => {
    const r = R.normaliserRecherche(RECHERCHE, { maintenant: T0, nouvelId: 'r0000000001' }).recherche;
    const j1 = R.jugerLectures([{ ok: true, items: ITEMS_SPEZIAL(), total: 9 }], r);
    let d = R.fusionnerVerification(null, r.id, j1, T0, 'clic', r).data;
    d = R.appliquerDecision(d, r.id, '110001', { statut: 'a-examiner' }, T0 + MIN).data;
    // eBay rend maintenant 110001 à 70 € et 110007 (nouvelle) à 70 € : toutes deux hors du prix maximum.
    const plusCher = () => ITEMS_SPEZIAL().map((x) => (x.legacyItemId === '110001' || x.legacyItemId === '110007' ? { ...x, price: { value: '70.00', currency: 'EUR' } } : x));
    const j2 = R.jugerLectures([{ ok: true, items: plusCher(), total: 9 }], r);
    const f = R.fusionnerVerification(d, r.id, j2, T0 + H, 'clic', r);
    const a1 = f.data.parRecherche[r.id].annonces['110001'];
    dit(a1 && a1.statut === 'a-examiner' && a1.prix === 7000 && a1.total === 7650 && a1.revuLe === T0 + H && /70,00/.test(a1.horsCriteres || '') && !(a1.raisons || []).some((x) => /≤/.test(x)),
      '« à examiner » relue à 70 € : sa décision reste, son prix est celui d\'AUJOURD\'HUI (76,50 € livraison comprise), la raison est dite — jamais « ≤ 60 € »', JSON.stringify(a1 && { p: a1.prix, t: a1.total, h: a1.horsCriteres, r: a1.raisons }));
    dit(!f.data.parRecherche[r.id].annonces['110007'], 'une « nouvelle » qui ne correspond plus (prix monté) quitte la liste');
    const j3 = R.jugerLectures([{ ok: true, items: ITEMS_SPEZIAL(), total: 9 }], r);
    const f3 = R.fusionnerVerification(f.data, r.id, j3, T0 + 2 * H, 'clic', r);
    const a3 = f3.data.parRecherche[r.id].annonces['110001'];
    dit(a3 && a3.total === 5150 && !a3.horsCriteres && !f3.nouvelles.includes('110007') && f3.data.parRecherche[r.id].annonces['110007'],
      'repassée sous le prix maximum : elle correspond de nouveau, et la « nouvelle » déjà montrée revient SANS être recomptée « nouvelle »', `nouvelles=${f3.nouvelles.join(',')}`);
  });
  await essaie('alerte : seulement ce que ce matin a trouvé', async () => {
    const r = R.normaliserRecherche(RECHERCHE, { maintenant: T0, nouvelId: 'r0000000001' }).recherche;
    const A = item(150001, 'Adidas Spezial 42 bleu', '40.00', '5.00', '3000'), B = item(150002, 'Adidas Spezial 42 noir', '40.00', '5.00', '3000'), Cc = item(150003, 'Adidas Spezial 42 rouge', '40.00', '5.00', '3000');
    // Il clique « Vérifier » : A et B s'affichent à l'écran.
    const vue = R.fusionnerVerification(null, r.id, R.jugerLectures([{ ok: true, items: [A, B], total: 2 }], r), T0, 'clic', r).data;
    // Le lendemain matin, eBay ne rend plus que C.
    const matin = T0 + JOUR;
    const f = R.fusionnerVerification(vue, r.id, R.jugerLectures([{ ok: true, items: [Cc], total: 1 }], r), matin, 'matin', r);
    const m = R.marquerAlertes(f.data, r.id, matin);
    dit(m.alertees.join() === '150003', 'l\'alerte ne compte QUE ce que ce matin a trouvé pour la première fois — ni A et B déjà vues à l\'écran, ni ce qu\'eBay ne rend plus', m.alertees.join(','));
  });
  await essaie('silence', async () => {
    const nuit = Date.parse('2026-10-15T21:30:00.000Z');   // 23:30 à Paris
    const matin = Date.parse('2026-10-15T08:00:00.000Z');  // 10:00 à Paris
    dit(R.dansSilence({ de: 22, a: 8 }, nuit) && !R.dansSilence({ de: 22, a: 8 }, matin) && R.dansSilence({ de: 9, a: 12 }, matin), 'horaires silencieux en heure de Paris, à cheval sur minuit compris');
  });

  console.log('── 3. Rentabilité avant achat');
  await essaie('rentabilite', async () => {
    const x = R.rentabilite({ achat: 4500, livraison: null, remise: null, frais: null, revente: 9000, marge: 2000 });
    dit(x.benefice === 4500 && !x.complet && x.manquants.join() === 'livraison,remise en état,frais de vente',
      'les coûts non saisis sont NOMMÉS à côté du bénéfice, jamais comptés comme connus', JSON.stringify(x.manquants));
    dit(x.prixMax === 7000 && x.prixMaxPorte === 'total', 'livraison inconnue ⇒ le maximum porte sur le coût TOTAL (livraison comprise)');
    const y = R.rentabilite({ achat: 4500, livraison: 650, remise: 1000, frais: 0, revente: 9000, marge: 2000 });
    dit(y.complet && y.benefice === 2850 && y.prixMax === 5350 && y.prixMaxPorte === 'article', 'tout connu ⇒ bénéfice 28,50 € et prix d\'article maximum 53,50 €');
    const modele = (t) => (/spezial/i.test(t) ? 'spezial' : null);
    const ventes = [
      { titre: 'Adidas Spezial 42 bleu', prix: 8000, date: T0 - 10 * JOUR }, { titre: 'Adidas Spezial taille 42 noir', prix: 9000, date: T0 - 40 * JOUR },
      { titre: 'Adidas Spezial 42 2/3', prix: 12000, date: T0 - 2 * JOUR }, { titre: 'Adidas Spezial 43', prix: 15000, date: T0 - JOUR },
      { titre: 'Adidas Spezial EU 42 vert', prix: 10000, date: T0 - 70 * JOUR },
    ];
    const comp = R.ventesComparables(ventes, { modele: 'spezial', taille: '42' }, modele);
    dit(comp.length === 3, 'comparables : même modèle ET même pointure exacte (le 42 2/3 et le 43 n\'en sont pas)', comp.map((v) => v.prix).join(','));
    const f = R.fourchetteRevente(comp, T0);
    dit(f.assez && f.n === 3 && f.prudente === 8000 && f.moyenne === 9000 && f.ambitieuse === 10000 && f.plusRecenteJ === 10,
      'prudente / moyenne / ambitieuse = 80 / 90 / 100 €, sur 3 ventes, la plus récente il y a 10 j', JSON.stringify(f));
    const f2 = R.fourchetteRevente(comp.slice(0, 2), T0);
    dit(!f2.assez && f2.n === 2 && f2.prudente == null, 'moins de 3 ventes ⇒ « pas assez de ventes comparables », aucun chiffre');
    // Un modèle hors de la liste connue (« 2002R ») : le nom qu'il a tapé.
    const connu = (t) => (/spezial/i.test(t) ? 'spezial' : null);
    const nb = [
      { titre: 'New balance 2002R protection pack gris taille 42', prix: 9500, date: T0 - 10 * JOUR },
      { titre: 'New balance 2002R noir taille 42', prix: 10500, date: T0 - 20 * JOUR },
      { titre: 'New balance 2002R gris 42', prix: 11000, date: T0 - 40 * JOUR },
      { titre: 'Lot New balance 2002R x2 taille 42', prix: 18000, date: T0 - 5 * JOUR },
      { titre: 'New balance 2002R gris taille 43', prix: 12000, date: T0 - 5 * JOUR },
      { titre: 'New balance 530 blanc 42', prix: 7000, date: T0 - 5 * JOUR }, { titre: 'Nike 530 gris 42', prix: 9900, date: T0 - 5 * JOUR },
      { titre: 'New balance 530 noir 42', prix: 7500, date: T0 - 6 * JOUR }, { titre: 'New balance 530 vert 42', prix: 8000, date: T0 - 7 * JOUR },
    ];
    const rech = { marque: 'New Balance', noms: ['2002R'] };
    const cle = R.cleComparables('New Balance 2002R Protection Pack gris 42', rech, connu);
    const c2 = cle ? R.ventesComparables(nb, cle, connu) : [];
    dit(cle && cle.taille === '42' && c2.length === 3 && R.fourchetteRevente(c2, T0).assez,
      'modèle hors liste (« 2002R ») : SES 3 ventes de 2002R en 42 — ni le lot, ni la 43', JSON.stringify(cle) + ' · ' + c2.map((v) => v.prix).join(','));
    const c530 = R.ventesComparables(nb, R.cleComparables('New Balance 530 gris 42', { marque: 'New Balance', noms: ['530'] }, connu), connu);
    dit(c530.length === 3 && !c530.some((v) => /nike/i.test(v.titre)), 'un nom tout en chiffres (« 530 ») exige la marque : la « Nike 530 » n\'en est pas', c530.map((v) => v.titre).join(' | '));
    const lib = R.cleLibre('New Balance 2002R 42', connu);
    dit(lib && lib.taille === '42' && R.ventesComparables(nb, lib, connu).length === 3 && R.cleLibre('New Balance 2002R', connu) === null && R.cleLibre('Spezial 42', connu).modele === 'spezial',
      '« Rentabilité avant achat » libre : « New Balance 2002R 42 » trouve ses 3 ventes ; sans pointure, aucune clé ; un modèle connu passe par la liste', JSON.stringify(lib));
  });
  await essaie('budget', async () => {
    const pub = { mois: '2026-10', depense: 31250, n: 12, complet: true };
    const b = R.budgetDuMois(40000, pub, T0);
    dit(b.etat === 'lu' && b.reste === 8750, 'budget 400 € − 312,50 € dépensés ⇒ reste 87,50 €');
    dit(R.budgetDuMois(40000, { ...pub, mois: '2026-09' }, T0).etat === 'pas-su', 'une publication d\'un autre mois ⇒ « pas su », jamais un reste inventé');
    const p = R.budgetDuMois(30000, { ...pub, complet: false, manque: ['compte_b'] }, T0);
    dit(p.etat === 'partiel' && p.depasse && p.manque[0] === 'compte_b', 'un compte illisible ⇒ « partiel », nommé ; dépassement signalé');
    // « Je l'ai achetée » dans la veille : la dépense entre dans le budget (eBay
    // n'est compté NULLE PART ailleurs), et une note ou un « Remettre » se lisent juste.
    const r = R.normaliserRecherche(RECHERCHE, { maintenant: T0, nouvelId: 'r0000000001' }).recherche;
    let d = R.fusionnerVerification(null, r.id, R.jugerLectures([{ ok: true, items: ITEMS_SPEZIAL(), total: 9 }], r), T0, 'clic', r).data;
    d = R.appliquerDecision(d, r.id, '110001', { statut: 'a-examiner' }, T0 + MIN).data;
    d = R.appliquerDecision(d, r.id, '110001', { statut: 'achetee' }, T0 + 2 * MIN).data;
    d = R.appliquerDecision(d, r.id, '110001', { note: 'boîte d\'origine' }, T0 + 3 * MIN).data;
    d = R.appliquerDecision(d, r.id, '110005', { statut: 'achetee' }, T0 + 4 * MIN).data;
    const v = R.achatsVeilleDuMois(d, T0 + H);
    dit(v.n === 2 && v.total === 5150 + 5000 && !v.complet && v.sansLivraison === 1, 'achats marqués ce mois : 2, 101,50 € — dont un sans livraison connue (« au moins ») ; la note après l\'achat ne l\'annule pas', JSON.stringify(v));
    const bv = R.budgetDuMois(40000, pub, T0 + H, v);
    dit(bv.depense === 31250 + 10150 && bv.reste === 40000 - 41400 && bv.depasse && bv.etat === 'partiel', 'le budget compte ses achats de la veille : 312,50 + 101,50 = 414 € ⇒ dépassé, « au moins »', JSON.stringify({ d: bv.depense, r: bv.reste, e: bv.etat }));
    const d2 = R.appliquerDecision(d, r.id, '110005', { statut: 'nouvelle' }, T0 + 5 * MIN).data;
    const v2 = R.achatsVeilleDuMois(d2, T0 + H);
    dit(v2.n === 1 && v2.total === 5150 && v2.complet, '« Remettre » après « Je l\'ai achetée » : l\'achat sort du budget', JSON.stringify(v2));
    dit(R.achatsVeilleDuMois(d2, Date.parse('2026-11-02T08:00:00.000Z')).n === 0, 'un achat d\'octobre ne compte pas dans le budget de novembre');
    const h = d.historique[1];
    dit(h && h.type === 'note' && h.a === 'achetee' && d.historique[2].type === 'statut', 'une note est rangée comme une NOTE dans l\'historique, jamais comme une décision', JSON.stringify(h));
  });

  console.log('── 4. La route, exécutée');
  const H_J = { authorization: 'Bearer ' + JWT_J };
  const appel = async (action, corps, entetes) => { const res = faireRes(); await E.default({ method: 'POST', headers: entetes || H_J, query: {}, body: { action, ...(corps || {}) } }, res); return res; };
  await essaie('session', async () => {
    journal.length = 0; base = [];
    const r = await appel('veilleverifier', { id: 'r0000000001' }, {});
    dit(r.code === 401 && browseAppels().length === 0 && !journal.some((j) => j.ou === 'ecriture'), 'sans session : 401, AUCUN appel à eBay, rien d\'écrit', `HTTP ${r.code}`);
  });
  let rid = '';
  await essaie('enregistrer', async () => {
    journal.length = 0; base = [];
    const r = await appel('veillesauver', { recherche: RECHERCHE });
    rid = (r.corps && r.corps.recherche && r.corps.recherche.id) || '';
    dit(r.code === 200 && /^r[0-9a-f]{10}$/.test(rid), 'une recherche s\'enregistre (identifiant fait par le serveur)', `HTTP ${r.code} ${JSON.stringify(r.corps).slice(0, 120)}`);
    const conf = ligne(J, 'veille_recherches');
    dit(conf && conf.recherches.length === 1 && conf.recherches[0].prixMax === 6000, 'rangée chez CE vendeur (owner = lui), prix en centimes');
    const lectures = journal.filter((j) => j.ou === 'lecture' && /veille_/.test(j.id || ''));
    dit(lectures.length > 0 && lectures.every((j) => j.owner === J), 'toutes ses lectures sont filtrées sur son identifiant (owner=eq.)');
    const rB = await appel('veillelire', {}, { authorization: 'Bearer ' + JWT_B });
    dit(rB.code === 200 && rB.corps.recherches.length === 0, 'un autre vendeur ne voit pas ses recherches');
    const conf0 = ligne(J, 'veille_recherches').recherches[0];
    const mod = await appel('veillesauver', { recherche: { ...conf0, nom: conf0.nom, noms: ['Samba'], tailles: ['44'] } });
    const r2 = ligne(J, 'veille_recherches').recherches[0];
    dit(mod.code === 200 && r2.nom === 'Adidas Samba 44', 'modifiée (Samba, 44) : son nom suit — jamais l\'ancien « Adidas Spezial 42 »', r2.nom);
    await appel('veillesauver', { recherche: { ...conf0 } });
    const vide = await appel('veillesauver', { recherche: { ...RECHERCHE, noms: [] } });
    dit(vide.code === 400 && vide.corps.champ === 'noms', 'sans modèle : refusée, champ nommé');
  });
  await essaie('vérifier', async () => {
    journal.length = 0;
    const r = await appel('veilleverifier', { id: rid });
    const b = browseAppels();
    dit(r.code === 200 && r.corps.nouvelles === 5, 'Vérifier : 5 nouvelles annonces retenues', `HTTP ${r.code} nouvelles=${r.corps && r.corps.nouvelles}`);
    dit(b.length === 2 && b.every((x) => x.m === 'GET' && x.h['X-EBAY-C-MARKETPLACE-ID'] === 'EBAY_FR' && x.h.Authorization === 'Bearer jeton-application'),
      'deux recherches eBay (une par nom), en lecture, sur eBay.fr, avec le jeton de L\'APPLICATION', b.map((x) => x.m + ' ' + x.u.replace(/\?.*/, '')).join(' | '));
    const tok = journal.find((j) => j.ou === 'ebay' && /oauth2\/token/.test(j.u));
    dit(tok && /grant_type=client_credentials/.test(tok.corps) && !/refresh_token/.test(tok.corps), 'le jeton est celui de l\'application (client_credentials) — aucun compte eBay du vendeur');
    const filtre = decodeURIComponent((/[?&]filter=([^&]*)/.exec(b[0].u) || [])[1] || '');
    dit(/buyingOptions:\{FIXED_PRICE\}/.test(filtre) && /price:\[\.\.60\.00\]/.test(filtre) && /conditionIds:\{2750\|2990\|3000/.test(filtre) && /deliveryCountry:FR/.test(filtre), 'filtre eBay : prix fixe, ≤ 60 €, occasion, livrable en France', filtre);
    const res = ligne(J, 'veille_resultats');
    const ann = res && res.parRecherche[rid] && res.parRecherche[rid].annonces;
    dit(ann && Object.keys(ann).length === 5 && ann['110005'].totalConfirme === false && !JSON.stringify(ann).includes('vendeur_'),
      'rangées : 5 annonces, la livraison inconnue dite, AUCUN pseudo de vendeur gardé');
    dit(journal.filter((j) => j.ou === 'ecriture').every((j) => j.owner === J || /"owner":"1111/.test(j.corps)), 'écrit au nom de CE vendeur');
    const encore = await appel('veilleverifier', { id: rid });
    dit(encore.code === 429 && encore.corps.reason === 'delai' && browseAppels().length === 2, 'revérifier dans les 2 minutes : refusé AVANT eBay');
  });
  await essaie('décider', async () => {
    const r = await appel('veilledecision', { id: rid, itemId: '110011', statut: 'refusee', motif: 'trop-cher' });
    dit(r.code === 200 && r.corps.annonce.statut === 'refusee' && r.corps.bilan.refusee === 1, 'refuser une annonce, avec son motif');
    const n = await appel('veilledecision', { id: rid, itemId: '110001', note: 'semelle à vérifier' });
    dit(n.code === 200 && ligne(J, 'veille_resultats').parRecherche[rid].annonces['110001'].note === 'semelle à vérifier', 'une note privée se garde');
    const a = await appel('veilledecision', { id: rid, itemId: '110001', statut: 'achetee' });
    dit(a.code === 200 && a.corps.achatsMois && a.corps.achatsMois.n === 1 && a.corps.achatsMois.total === 5150, '« Je l\'ai achetée » : la route rend l\'achat du mois (51,50 €) pour le budget', JSON.stringify(a.corps && a.corps.achatsMois));
    const l = await appel('veillelire', {});
    dit(l.code === 200 && l.corps.achatsMois && l.corps.achatsMois.n === 1, 'la lecture de la veille rend aussi ses achats du mois');
    await appel('veilledecision', { id: rid, itemId: '110001', statut: 'nouvelle' });
  });
  await essaie('simulation', async () => {
    journal.length = 0;
    const avant = JSON.stringify(ligne(J, 'veille_resultats').parRecherche);
    const avantH = JSON.stringify(ligne(J, 'veille_resultats').historique || []);
    const r = await appel('veilletester', { recherche: { ...RECHERCHE, tailles: ['42'], prixMaxEuros: '50' } });
    const apres = JSON.stringify(ligne(J, 'veille_resultats').parRecherche);
    dit(r.code === 200 && r.corps.simulation === true && Array.isArray(r.corps.annonces), 'Tester : des résultats rendus', `HTTP ${r.code}`);
    dit(avant === apres && avantH === JSON.stringify(ligne(J, 'veille_resultats').historique || []) && JSON.parse(avantH).length === 4, 'la SIMULATION ne range rien (ni annonce, ni historique, ni alerte)');
    dit((r.corps.exemples || []).some((x) => /pointure 42 2\/3/.test(x.motif)), 'elle montre des exemples d\'écartées AVEC leur motif');
  });
  await essaie('lecture ratée', async () => {
    journal.length = 0;
    mode = { lectureKo: ['veille_recherches'] };
    const r = await appel('veillesauver', { recherche: { ...RECHERCHE, id: rid, alerte: true } });
    dit(r.code === 503 && !journal.some((j) => j.ou === 'ecriture' && j.id === 'veille_recherches') && ligne(J, 'veille_recherches').recherches.length === 1,
      'ses recherches illisibles ⇒ 503 et RIEN d\'écrit (repartir de vide les effacerait)', `HTTP ${r.code}`);
    const l = await appel('veillelire', {});
    dit(l.code === 503, 'veillelire sur une lecture ratée ⇒ « pas su », jamais « aucune recherche »');
    mode = {};
  });
  await essaie('eBay refuse', async () => {
    journal.length = 0;
    base = base.map((x) => (x.id === 'veille_resultats' ? { ...x, data: { ...x.data, parRecherche: { ...x.data.parRecherche, [rid]: { ...x.data.parRecherche[rid], verif: { ...x.data.parRecherche[rid].verif, at: T0 - JOUR } } } } } : x));
    mode = { browse: '403' };
    const r = await appel('veilleverifier', { id: rid });
    const rr = ligne(J, 'veille_resultats').parRecherche[rid];
    dit(r.code === 502 && /refuse la recherche/.test(r.corps.error) && rr.verif.ok === false && Object.keys(rr.annonces).length === 5,
      'eBay refuse ⇒ la cause est dite, la vérification notée ratée, les annonces gardées', `HTTP ${r.code} ${r.corps && r.corps.error}`);
    mode = { browse: 'forme' };
    base = base.map((x) => (x.id === 'veille_resultats' ? { ...x, data: { ...x.data, parRecherche: { ...x.data.parRecherche, [rid]: { ...x.data.parRecherche[rid], verif: { ...x.data.parRecherche[rid].verif, at: T0 - JOUR } } } } } : x));
    const f = await appel('veilleverifier', { id: rid });
    dit(f.code === 502 && /inattendue/.test(f.corps.error), 'une réponse d\'eBay sans annonces ni total ⇒ « inattendue », jamais « 0 annonce »', `HTTP ${f.code}`);
    mode = {};
  });
  await essaie('quota', async () => {
    const jour = new Date(Date.now()).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    base = base.map((x) => (x.id === 'veille_resultats' ? { ...x, data: { ...x.data, quota: { jour, n: 30 } } } : x));
    journal.length = 0;
    const r = await appel('veilletester', { recherche: RECHERCHE });
    dit(r.code === 429 && r.corps.reason === 'quota' && browseAppels().length === 0, '30 vérifications dans la journée ⇒ la 31e est refusée AVANT eBay', `HTTP ${r.code}`);
  });

  console.log('── 5. Le passage du matin');
  await essaie('matin', async () => {
    base = []; journal.length = 0; mode = {};
    if (V.oublierJetonVeille) V.oublierJetonVeille();
    const envois = [];
    const deps = (extra) => ({ owner: J, envoyer: async (p) => { envois.push(p); return { sent: 1 }; }, categorieActive: async () => true, acces: async () => true, ...(extra || {}) });
    await appel('veillesauver', { recherche: RECHERCHE });
    const rid2 = ligne(J, 'veille_recherches').recherches[0].id;
    let out = await V.veilleDuMatin(deps({ maintenant: T0 }));
    dit(out === null && browseAppels().length === 0 && envois.length === 0, 'aucune recherche avec l\'alerte cochée ⇒ aucun appel à eBay, rien envoyé');
    await appel('veillesauver', { recherche: { ...ligne(J, 'veille_recherches').recherches[0], alerte: true } });
    out = await V.veilleDuMatin(deps({ maintenant: T0 }));
    dit(envois.length === 1 && /5 nouvelles annonces/.test(envois[0].body) && envois[0].url === '/?tab=ebay_veille' && /Rien n'est acheté sans toi/.test(envois[0].body),
      'alerte cochée : UNE notification, qui compte les nouvelles et mène à la veille', envois[0] && envois[0].body);
    out = await V.veilleDuMatin(deps({ maintenant: T0 + H }));
    dit(out === 'déjà passé' && envois.length === 1, 'relancé le même jour : rien de plus');
    out = await V.veilleDuMatin(deps({ maintenant: T0 + JOUR }));
    dit(envois.length === 1 && out && out.nouvelles === 0, 'le lendemain, mêmes annonces : AUCUNE nouvelle notification (jamais deux fois)', JSON.stringify(out));
    mode = { items: () => [...ITEMS_SPEZIAL(), item(110020, 'Adidas Spezial 42 blanc', '41.00', '5.00', '3000')] };
    out = await V.veilleDuMatin(deps({ maintenant: T0 + 2 * JOUR }));
    dit(envois.length === 2 && /1 nouvelle annonce/.test(envois[1].body), 'une vraie nouvelle annonce ⇒ une notification, pour elle seule', envois[1] && envois[1].body);
    // Horaires silencieux, catégorie coupée, écriture ratée.
    await appel('veillereglages', { silence: { de: 9, a: 12 } });
    mode = { items: () => [...ITEMS_SPEZIAL(), item(110021, 'Adidas Spezial 42 jaune', '42.00', '5.00', '3000')] };
    out = await V.veilleDuMatin(deps({ maintenant: T0 + 3 * JOUR }));
    dit(envois.length === 2 && out && out.envoi === 'horaire silencieux', 'pendant ses horaires silencieux : rien ne sonne', JSON.stringify(out));
    await appel('veillereglages', { silence: null });
    mode = { items: () => [...ITEMS_SPEZIAL(), item(110022, 'Adidas Spezial 42 rose', '42.00', '5.00', '3000')] };
    out = await V.veilleDuMatin(deps({ maintenant: T0 + 4 * JOUR, categorieActive: async () => false }));
    dit(envois.length === 2 && out && /désactivé/.test(out.envoi), 'notifications de veille coupées dans Réglages : rien ne sonne');
    mode = { items: () => [...ITEMS_SPEZIAL(), item(110023, 'Adidas Spezial 42 ocre', '42.00', '5.00', '3000')], ecritureKo: [] };
    // L'écriture des résultats échoue APRÈS le mémo du passage : aucune alerte.
    let n = 0;
    const fetch0 = global.fetch;
    global.fetch = async (u, o = {}) => { if (String(u).includes('app_data') && (o.method || 'GET') !== 'GET' && String(o.body || '').includes('110023')) { n++; return rep({ message: 'boom' }, 500); } return fetch0(u, o); };
    out = await V.veilleDuMatin(deps({ maintenant: T0 + 5 * JOUR }));
    global.fetch = fetch0;
    dit(n > 0 && envois.length === 2, 'résultats non rangés ⇒ aucune notification (sinon elle repartirait demain : deux fois)', JSON.stringify(out));
    const coupe = await V.veilleDuMatin(deps({ maintenant: T0 + 6 * JOUR, acces: async () => false }));
    dit(coupe === 'abonnement coupé', 'abonnement coupé ⇒ aucun appel à eBay pour lui');
    void rid2;
  });
  await essaie('matin après une vérification à l\'écran', async () => {
    // Le parcours normal : il crée la recherche, clique « Vérifier » (A et B
    // s'affichent), coche l'alerte. Le lendemain matin, eBay ne rend plus que C.
    base = []; journal.length = 0;
    if (V.oublierJetonVeille) V.oublierJetonVeille();
    const envois = [];
    const deps = (extra) => ({ owner: J, envoyer: async (p) => { envois.push(p); return { sent: 1 }; }, categorieActive: async () => true, acces: async () => true, ...(extra || {}) });
    const A = item(160001, 'Adidas Spezial 42 bleu', '40.00', '5.00', '3000'), B = item(160002, 'Adidas Spezial 42 noir', '40.00', '5.00', '3000'), Cc = item(160003, 'Adidas Spezial 42 rouge', '40.00', '5.00', '3000');
    await appel('veillesauver', { recherche: { ...RECHERCHE, noms: ['Spezial'] } });
    const id = ligne(J, 'veille_recherches').recherches[0].id;
    mode = { items: () => [A, B] };
    const v = await appel('veilleverifier', { id });
    await appel('veillesauver', { recherche: { ...ligne(J, 'veille_recherches').recherches[0], alerte: true } });
    mode = { items: () => [Cc] };
    const out = await V.veilleDuMatin(deps({ maintenant: T0 + JOUR }));
    mode = {};
    const ann = ligne(J, 'veille_resultats').parRecherche[id].annonces;
    dit(v.corps && v.corps.nouvelles === 2 && envois.length === 1 && /^1 nouvelle annonce : Adidas Spezial 42 \(1\)/.test(envois[0].body),
      'il a VU A et B à l\'écran ; ce matin eBay ne rend que C ⇒ « 1 nouvelle annonce » — jamais 3', envois[0] && envois[0].body);
    dit(!ann['160001'].alerteLe && !ann['160002'].alerteLe && ann['160003'].alerteLe === T0 + JOUR, 'seule C est marquée signalée', JSON.stringify(out));
  });

  console.log('── 6. Ce qui ne doit jamais exister');
  await essaie('statique', async () => {
    const sansCom = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
    const srv = sansCom((lire('api/_lib/veille.js') || '') + (lire('api/_lib/veille-regle.js') || ''));
    const ecran = sansCom(lire('src/VeilleAchat.jsx') || '');
    dit(srv.length > 0 && !/vinted\.(fr|com)|leboncoin\.fr|vestiairecollective/i.test(srv + ecran), 'aucune requête vers Vinted, Leboncoin ou Vestiaire dans la veille');
    dit(srv.length > 0 && !/\/buy\/order|\/buy\/offer|PlaceOffer|placeProxyBid|initiateCheckout|checkout_session|guest_checkout/i.test(srv + ecran), 'aucune route d\'achat, d\'offre ou d\'enchère eBay');
    dit(ecran.length > 0 && !/>\s*(Acheter|Payer|Enchérir|Faire une offre)\s*</.test(ecran) && /Voir sur eBay|data-lien-ebay/.test(ecran), 'l\'écran n\'a aucun bouton d\'achat : le seul geste vers eBay est un lien');
    dit(interdits.length === 0, 'pendant tout l\'audit, aucune requête n\'est partie vers Vinted, Leboncoin ou Vestiaire', interdits.join(' '));
    const app = lire('src/App.jsx') || '';
    dit(/platSub==='veille'&&<VeilleAchat/.test(app) && /\['veille','Veille'\]/.test(app), 'eBay → Veille est montée dans l\'app (sous-onglet rendu)');
    dit(/'ebay_veille'/.test(app) && /tab==='ebay_veille'/.test(app), 'la notification du matin mène à eBay → Veille (?tab=ebay_veille)');
    dit(/save\('vrm_achats_mois'/.test(app) && /'vrm_achats_mois'/.test((/const SYNC_KEYS = \[([\s\S]*?)\];/.exec(app) || [])[1] || ''), 'l\'écran Achats PUBLIE les achats du mois (clé synchronisée), la veille les consomme (§11)');
    const ebay = lire('api/ebay.js') || '';
    const iVeille = ebay.indexOf('/^veille[a-z]+$/'), iSession = ebay.indexOf('vendeurExige(req, res)'), iAbo = ebay.indexOf('accesVendeur(owner)');
    dit(iVeille > 0 && iSession > 0 && iAbo > 0 && iVeille > iSession && iVeille > iAbo, 'la veille est routée APRÈS la session et l\'abonnement');
  });
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
