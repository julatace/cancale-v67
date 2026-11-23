// ⚠️ ACHATS EN LOT : DIVISER UN ACHAT, RÉPARTIR SON PRIX (22 nov., lot achats-lot)
//
// Ce contrôle EXÉCUTE la règle (src/achatDivise.js) sur des achats INVENTÉS ici et prouve :
//   1. la détection par IDENTITÉ : la transaction (articles, items_count) PROUVE un lot ; le titre « Lot … » ne fait
//      qu'une SUGGESTION (« peut-être ») ; 50 achats identiques : aucun n'est désigné par ressemblance ;
//   2. la répartition au centime (n = 2..20, parts égales, prix des articles, prix de vente, à la main) : somme = total
//      EXACTEMENT, le centime d'arrondi dit ; à la main, un reste ≠ 0 bloque ; un prix déjà saisi est gardé (fixé) ;
//      port et frais à parts égales ; un poids manquant n'est jamais remplacé en silence ;
//   3. le total : le reçu juste (articles + port + protection), sinon la commande (dit), remboursement partiel déduit,
//      remboursé / autre devise ⇒ rien ;
//   4. le plan (SON toucher, `confirme`) : parts `achat:{tx}#k`, fiches neuves + coût par N°, paire choisie reliée,
//      sa saisie JAMAIS écrasée, lot déclaré ; appliqué au magasin par les morceaux de la corbeille : le COÛT de
//      chaque part (prixAchatDe de l'app) fait le total au centime, « Dépensé » (coutAchatNet) est IDENTIQUE divisé ou
//      non, et le reçu entier n'est plus jamais posé seul sur une part (prixAPoser) — jamais compté deux fois ;
//   5. « Regrouper » : refusé si une part est vendue ou pas su ; sinon le magasin revient à l'état d'avant (le pool
//      des N° mis à part), un prix retouché depuis est gardé ;
//   6. l'app branche la règle (coque, feuille, rangée, tableau, synchronisation, textes en 5 langues, Quoi de neuf) ;
//   7. --prouve : chaque mutation de la règle rougit.
//
//   node scripts/audit-achats-lot.cjs            → le contrôle
//   node scripts/audit-achats-lot.cjs --prouve   → les mutations
// Aucune donnée réelle : tout est inventé ici.
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');

const MUTATIONS = [
  ['titre-prouve', "return { etat: 'peutEtre', n, par: 'titre' };", "return { etat: 'prouve', n, par: 'titre' };"],
  ['dernier-absorbe', "const plusGrandReste = (total, poids) => (poids.length ? repartirPrixLot(total, poids.map((p) => ({ prix: p, devise: 'EUR' }))).parts : []);",
    "const plusGrandReste = (total, poids) => { const s = poids.reduce((a, b) => a + b, 0); const p = poids.map((w) => Math.floor((total * w) / s)); p[p.length - 1] += total - p.reduce((a, b) => a + b, 0); return p; };"],
  ['ecart-accepte', "    if (reste !== 0) return { ok: false, mode, parts, somme, reste, arrondi: [], raison: 'ecart', rangs: [] };\n", ''],
  ['poids-devine', "    if (manque.length) return echec('poids', { rangs: manque });\n    w = libres.map((i) => src[i]);", "    w = libres.map((i) => (src[i] > 0 ? src[i] : 1));"],
  ['fixes-ignores', "const k = Number(i); if (Number.isInteger(k) && k >= 0 && k < n && entier(c) && c >= 0) fx[k] = c;", "void i; void c;"],
  ['saisie-ecrasee', "if (!saisie) { apres.buyPrice", "if (true) { apres.buyPrice"],
  ['saisie-ignoree', "      if (prixSaisi(e) && centimesTapes(e.buyPrice) !== repartition.parts[parts.indexOf(p)]) return { erreur: 'saisie' };\n", ''],
  ['sans-confirme', "  if (confirme !== true) return { erreur: 'confirme' };\n  const tx = txDe(achat && achat.transaction_id);", "  const tx = txDe(achat && achat.transaction_id);"],
  ['lot-pas-declare', "  morceaux.push({ k: 'vrm_lots_declares', type: 'cle', id: tx, avant: declareAvant, apres: n });\n", ''],
  ['regroupe-vendue', "  if (vendues.length) return { ok: false, raison: 'vendue', nums: vendues };\n", ''],
  ['passu-vaut-non', "else if (v !== false) passu.push(p && p.numero ? p.numero : '?');", ''],
  ['remb-ignore', "    total -= rembourse;\n", ''],
  ['recu-ignore', "  let total = detail ? ventilation.paye : pc ? pc.c : null;", "  let total = pc ? pc.c : null;"],
  ['doublon-numero', "    if (vus.has(k)) return { erreur: 'doublon' };\n", ''],
];

const prixAchatDeApp = () => {
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  const i = app.indexOf('const prixAchatDe = (fiche, buyByNum) => {');
  if (i < 0) return null;
  const j = app.indexOf('\n};', i);
  // eslint-disable-next-line no-new-func
  return new Function(app.slice(i, j + 3) + '\nreturn prixAchatDe;')();
};

async function jouer(dir, { silencieux = false } = {}) {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (!silencieux || !c) console.log(`${c ? '✅' : '❌'} ${m}${d && !c ? ' — ' + d : ''}`); };
  const D = await import('file://' + path.join(dir, 'achatDivise.js') + '?v=' + Math.random()).catch((e) => { dit(false, 'src/achatDivise.js se charge', e.message); return null; });
  if (!D) return { ok, ko };
  const Cb = await import('file://' + path.join(R, 'src', 'corbeille.js'));
  const CN = await import('file://' + path.join(R, 'src', 'coutAchatNet.js'));
  const PR = await import('file://' + path.join(R, 'src', 'prixAchatRecu.js'));
  const AS = await import('file://' + path.join(R, 'src', 'achatsSourcing.js'));
  const prixAchatDe = prixAchatDeApp();
  const somme = (p) => p.reduce((s, x) => s + x, 0);

  // ── 1. LA DÉTECTION ─────────────────────────────────────────────────────────────────────────────
  if (!silencieux) console.log('── 1. Un lot se PROUVE par sa transaction ; le titre suggère seulement');
  {
    const art = [{ item: '9001', titre: 'Nike Air Max 90 · 42', prix: 3000, photo: 'p1', taille: '42' }, { item: '9002', titre: 'Adidas Samba · 41', prix: 2000, photo: 'p2', taille: '41' }];
    const a = { transaction_id: '700000001', title: 'Lot 2 articles', price: { amount: '50.0', currency_code: 'EUR' } };
    dit(D.lotDeLAchat({ achat: a, articles: art }).etat === 'prouve', 'deux articles lus dans SA transaction ⇒ lot prouvé (2)');
    dit(D.lotDeLAchat({ achat: { ...a, title: 'Baskets' }, nbTx: 3 }).etat === 'prouve' && D.lotDeLAchat({ achat: { ...a, title: 'Baskets' }, nbTx: 3 }).n === 3, 'items_count 3 lu ⇒ lot prouvé de 3, quel que soit le titre');
    const t = D.lotDeLAchat({ achat: a });
    dit(t.etat === 'peutEtre' && t.n === 2, 'le titre « Lot 2 articles » SEUL ⇒ « peut-être un lot » (jamais prouvé)', JSON.stringify(t));
    dit(D.lotDeLAchat({ achat: { ...a, title: 'Lot de chaussures' } }).etat === 'peutEtre' && D.lotDeLAchat({ achat: { ...a, title: 'Lot de chaussures' } }).n === null, 'un titre « Lot … » sans nombre ⇒ peut-être, nombre pas deviné');
    dit(D.lotDeLAchat({ achat: { ...a, title: 'Nike Air Max 90 lot' } }).etat === 'simple', 'le mot « lot » ailleurs dans le titre ne suggère rien');
    dit(D.lotDeLAchat({ achat: { ...a, title: 'Nike' }, articles: [art[0]] }).etat === 'simple', 'une transaction à UN article ⇒ achat simple');
    // 50 achats identiques (même titre, même prix, même photo) : la règle ne désigne que celui dont la transaction le dit.
    const cinquante = Array.from({ length: 50 }, (_, i) => ({ transaction_id: String(710000000 + i), title: 'Nike Air Max 90 noir 42', price: { amount: '40.0', currency_code: 'EUR' }, photo: 'meme.jpg' }));
    const nbTx = { [cinquante[17].transaction_id]: 2 };
    const prouves = cinquante.filter((o) => D.lotDeLAchat({ achat: o, nbTx: nbTx[o.transaction_id] }).etat === 'prouve');
    dit(prouves.length === 1 && prouves[0].transaction_id === cinquante[17].transaction_id, '50 achats identiques : seul celui dont SA transaction dit 2 articles est un lot');
    dit(D.idPart('700000001', 2) === 'achat:700000001#2' && D.idPart('', 1) === '' && D.idPart('700000001', 0) === '', 'l’identité d’une part : achat:{tx}#k (rien sans n° ni rang)');
  }

  // ── 2. LA RÉPARTITION ───────────────────────────────────────────────────────────────────────────
  if (!silencieux) console.log('── 2. Au centime près, la somme vaut le total, le centime d’arrondi est dit');
  {
    let tous = true, arrondiDit = true;
    for (let n = 2; n <= 20; n++) for (const total of [100, 997, 1001, 4999, 12345, 99999]) {
      const r = D.repartirParts({ total, n, mode: 'egal' });
      if (!r.ok || somme(r.parts) !== total) tous = false;
      const base = Math.floor(total / n);
      if (r.ok && r.arrondi.length !== total - base * n) arrondiDit = false;
      const poids = Array.from({ length: n }, (_, i) => 1000 + i * 137);
      const ra = D.repartirParts({ total, n, mode: 'articles', poids: { articles: poids } });
      if (!ra.ok || somme(ra.parts) !== total || ra.parts.some((p, i) => Math.abs(p - (total * poids[i]) / somme(poids)) >= 1)) tous = false;
      const rv = D.repartirParts({ total, n, mode: 'ventes', poids: { ventes: poids.slice().reverse() } });
      if (!rv.ok || somme(rv.parts) !== total) tous = false;
    }
    dit(tous, 'n = 2..20 × 6 totaux × 3 modes : somme = total au centime, chaque part à moins d’1 ct de sa part exacte');
    dit(arrondiDit, 'parts égales : autant de parts « arrondi » que de centimes de reste');
    const r3 = D.repartirParts({ total: 1000, n: 3, mode: 'egal' });
    dit(r3.ok && r3.parts.join(',') === '334,333,333' && r3.arrondi.join(',') === '0', '10 € en 3 : 3,34 + 3,33 + 3,33, le centime sur l’article 1 (dit)', JSON.stringify(r3));
    const manque = D.repartirParts({ total: 1000, n: 3, mode: 'articles', poids: { articles: [500, null, 200] } });
    dit(!manque.ok && manque.raison === 'poids' && manque.rangs.join(',') === '1', 'un prix d’article manquant ⇒ refus nommé (jamais parts égales en silence)', JSON.stringify(manque));
    dit(D.modesPossibles({ n: 3, poids: { articles: [500, null, 200] } }).join(',') === 'egal,main', 'un mode dont un poids manque n’est pas proposé');
    const m1 = D.repartirParts({ total: 6000, n: 3, mode: 'main', manuels: ['20', '20', '19,99'] });
    dit(!m1.ok && m1.raison === 'ecart' && m1.reste === 1, 'à la main : 59,99 € sur 60 € ⇒ bloqué, « reste 0,01 € » dit', JSON.stringify(m1));
    const m2 = D.repartirParts({ total: 6000, n: 3, mode: 'main', manuels: ['20', '20,00', '20'] });
    dit(m2.ok && somme(m2.parts) === 6000, 'à la main : 20 + 20 + 20 = 60 € ⇒ juste');
    const m3 = D.repartirParts({ total: 6000, n: 3, mode: 'main', manuels: ['20', 'abc', '20'] });
    dit(!m3.ok && m3.raison === 'illisible' && m3.rangs.join(',') === '1', 'à la main : un montant illisible ⇒ refus nommé');
    const f = D.repartirParts({ total: 10000, n: 3, mode: 'egal', fixes: { 1: 4000 } });
    dit(f.ok && f.parts[1] === 4000 && f.parts[0] + f.parts[2] === 6000 && somme(f.parts) === 10000, 'un prix déjà saisi (40 €) est GARDÉ, le reste réparti sur les autres', JSON.stringify(f));
    const f2 = D.repartirParts({ total: 3000, n: 2, mode: 'egal', fixes: { 0: 4000 } });
    dit(!f2.ok && f2.raison === 'fixes', 'des prix saisis qui dépassent le total ⇒ refus dit');
    const fe = D.repartirParts({ total: 2170, n: 2, mode: 'articles', poids: { articles: [1500, 500] }, detail: { articles: 2000, port: 0, frais: 170 }, fraisMode: 'egal' });
    dit(fe.ok && fe.parts.join(',') === '1585,585', 'port et frais à parts égales : 15 + 0,85 · 5 + 0,85', JSON.stringify(fe));
    const fp = D.repartirParts({ total: 2170, n: 2, mode: 'articles', poids: { articles: [1500, 500] }, detail: { articles: 2000, port: 0, frais: 170 }, fraisMode: 'prorata' });
    dit(fp.ok && somme(fp.parts) === 2170 && fp.parts[0] === 1628 && fp.parts[1] === 542, 'port et frais au prorata : 16,28 · 5,42', JSON.stringify(fp));
    dit(!D.repartirParts({ total: 1000, n: 1, mode: 'egal' }).ok && !D.repartirParts({ total: 1000, n: 21, mode: 'egal' }).ok, 'N entre 2 et 20 seulement');
  }

  // ── 3. LE TOTAL ─────────────────────────────────────────────────────────────────────────────────
  if (!silencieux) console.log('── 3. Le total : ce qu’il a payé (reçu), sinon la commande, remboursement déduit');
  const achat = { transaction_id: '700000002', title: 'Lot 3 articles', date: '2026-11-10', status: 'Commande finalisée', price: { amount: '60.0', currency_code: 'EUR' } };
  const ventil = { trouve: true, somme: 'juste', paye: 6470, lignes: [{ libelle: 'Commande', centimes: 6000 }, { libelle: 'Frais de port', centimes: 299 }, { libelle: 'Frais de Protection acheteurs', centimes: 171 }] };
  {
    const t = D.totalADiviser({ achat, ventilation: ventil });
    dit(t.total === 6470 && t.source === 'recu' && t.detail && t.detail.port === 299 && t.detail.frais === 171 && t.detail.articles === 6000, 'reçu juste : 64,70 € (articles 60 · port 2,99 · protection 1,71)', JSON.stringify(t));
    const c = D.totalADiviser({ achat, ventilation: null });
    dit(c.total === 6000 && c.source === 'commande' && c.detail === null, 'reçu pas lu : le prix de la commande, DIT « commande »');
    const e = D.totalADiviser({ achat, ventilation: { ...ventil, somme: 'ecart' } });
    dit(e.source === 'commande', 'un reçu qui ne tombe pas juste n’est pas pris');
    const p = D.totalADiviser({ achat: { ...achat, _rembPartiel: { montant: 20, reste: 40 } }, ventilation: ventil });
    dit(p.total === 4470 && p.rembourse === 2000, 'remboursement partiel lu (20 €) : déduit, 44,70 € à répartir', JSON.stringify(p));
    dit(D.totalADiviser({ achat: { ...achat, status: 'Remboursement effectué' } }).total === null && D.totalADiviser({ achat: { ...achat, status: 'Remboursement effectué' } }).raison === 'rembourse', 'achat remboursé ⇒ rien à répartir (dit)');
    dit(D.totalADiviser({ achat: { ...achat, price: { amount: '60', currency_code: 'GBP' } } }).raison === 'devise', 'autre devise ⇒ rien (jamais converti)');
  }

  // ── 4. LE PLAN, APPLIQUÉ ────────────────────────────────────────────────────────────────────────
  if (!silencieux) console.log('── 4. Le plan sur SON toucher ; les coûts des parts = le total ; « Dépensé » identique');
  const fiches0 = { '8001': { numero: '12', title: 'Samba noire', buyPrice: '' }, '8002': { numero: '13', title: 'Samba blanche', buyPrice: '30,00' }, '8003': { numero: '14', title: 'Autre', buyFromId: '700000099' } };
  // 50 autres achats identiques dans le magasin : la division n'en touche aucun.
  for (let i = 0; i < 50; i++) fiches0['9' + String(i).padStart(3, '0')] = { numero: String(200 + i), title: 'Nike Air Max 90 noir 42', buyFromId: String(710000000 + i), buyPrice: '40,00' };
  const lus0 = () => ({ fiches: JSON.parse(JSON.stringify(fiches0)), couts: { 200: '40,00' }, neuves: {}, declares: {}, divisions: {} });
  const t = D.totalADiviser({ achat, ventilation: ventil });
  const fixes = { 1: 3000 };
  const rep = D.repartirParts({ total: t.total, n: 3, mode: 'egal', fixes, detail: t.detail });
  const parts = [
    { titre: 'Samba noire', cible: { type: 'fiche', cle: '8001', numero: '12' } },
    { titre: 'Samba blanche', cible: { type: 'fiche', cle: '8002', numero: '13' } },
    { titre: 'Gazelle', photo: 'g.jpg', item: '9003', cible: { type: 'neuf', numero: '45', ficheId: 'nA' } },
  ];
  const at = '2026-11-22T10:00:00.000Z';
  dit(D.planDivision({ achat, total: t.total, repartition: rep, parts, lus: lus0(), at }).erreur === 'confirme', 'sans SON toucher (`confirme`) : rien');
  const plan = D.planDivision({ confirme: true, achat, total: t.total, source: t.source, repartition: rep, parts, lus: lus0(), at });
  dit(!plan.erreur && plan.record && plan.record.parts.length === 3, 'le plan : 3 parts', plan.erreur);
  if (!plan.erreur) {
    dit(plan.record.parts.map((p) => p.id).join(',') === 'achat:700000002#1,achat:700000002#2,achat:700000002#3', 'chaque part a SON identité achat:{tx}#k');
    dit(D.divisionJuste(plan.record) && D.sommeParts(plan.record) === 6470, 'somme des parts = 64,70 € (le reçu)');
    const mFiche2 = plan.morceaux.find((m) => m.k === 'vinted_annonce_numeros' && m.id === '8002');
    dit(mFiche2 && mFiche2.apres.buyPrice === '30,00' && mFiche2.apres.buyPriceSource === undefined && plan.record.parts[1].saisie === true, 'la paire N°13 a SON prix (30 €) : jamais écrasé, part fixée');
    // Même si la répartition passée ne la fixait pas, l'écriture ne touche pas SA saisie (le morceau ne porte pas buyPrice).
    const planB = D.planDivision({ confirme: true, achat, total: t.total, source: t.source, repartition: D.repartirParts({ total: t.total, n: 3, mode: 'egal' }), parts, lus: lus0(), at });
    dit(planB.erreur === 'saisie', 'une répartition qui ignore SA saisie (30 €) ne s’écrit pas', planB.erreur);
    dit(plan.morceaux.some((m) => m.k === 'vrm_fiches_neuves' && m.id === 'nA' && m.apres.numero === '45' && m.apres.partId === 'achat:700000002#3'), 'la part neuve : une fiche « À publier » N°45, liée à SA part');
    dit(plan.morceaux.some((m) => m.k === 'vrm_lots_declares' && m.id === '700000002' && m.apres === 3), 'l’achat est déclaré lot de 3 (le reçu entier ne se pose plus seul)');
    const touchees = new Set(plan.morceaux.filter((m) => m.k === 'vinted_annonce_numeros').map((m) => m.id));
    dit([...touchees].sort().join(',') === '8001,8002', '50 achats identiques à côté : aucune de leurs fiches n’est touchée');
    // Le magasin, avant / après, par les morceaux de la corbeille (le chemin de `gesteMorceaux`).
    const magasin0 = { vinted_annonce_numeros: JSON.parse(JSON.stringify(fiches0)), vinted_buyprice_by_num: { 200: '40,00' }, vrm_fiches_neuves: {}, vrm_lots_declares: {}, vrm_achats_divises: {} };
    const appliquer = (mag, morceaux, sens = 'apres') => { if (!Array.isArray(morceaux)) return mag; const out = {}; for (const k of Object.keys(mag)) out[k] = Cb.appliquerMorceaux(mag[k], morceaux, sens, k).valeur; return out; };
    const mag1 = appliquer(magasin0, plan.morceaux);
    const coutPart = (p) => (p.fiche ? prixAchatDe(mag1.vinted_annonce_numeros[p.fiche], mag1.vinted_buyprice_by_num) : prixAchatDe({ numero: p.numero }, mag1.vinted_buyprice_by_num));
    const couts = plan.record.parts.map(coutPart);
    dit(prixAchatDe && couts.every((c) => c != null) && Math.round(couts.reduce((a, b) => a + b, 0) * 100) === 6470, 'le coût d’achat de chaque part (prixAchatDe de l’app) : la somme fait 64,70 € au centime', JSON.stringify(couts));
    const achats50 = Array.from({ length: 50 }, (_, i) => ({ transaction_id: String(710000000 + i), status: 'Commande finalisée', price: { amount: '40.0' } }));
    const liste = [achat, ...achats50];
    const montantDe = (o) => Number(o.price.amount);
    const dep = (l) => l.reduce((s, o) => s + (CN.coutAchatNet(o, montantDe) || 0), 0);
    dit(dep(liste) === 60 + 50 * 40, '« Dépensé » (coutAchatNet, une ligne par commande) : 2 060 € — la division ne crée aucune dépense');
    const ventesBenef = (mag) => Object.values(mag.vinted_annonce_numeros).filter((e) => e && String(e.buyFromId) === '700000002').length;
    dit(ventesBenef(mag1) === 2 && ventesBenef(magasin0) === 0, 'deux paires existantes reliées par identité à l’achat (buyFromId + buyPart)');
    const declares = mag1.vrm_lots_declares;
    const aPoser = PR.prixAPoser({ fiches: mag1.vinted_annonce_numeros, ventes: {}, achatDe: (tx) => (tx === '700000002' ? achat : null), ventilationDe: () => ventil,
      estLot: (a) => AS.estLot(a, { declares }) });
    dit(!aPoser.some((x) => x.tx === '700000002'), 'le reçu entier (64,70 €) n’est JAMAIS reposé seul sur une part : compté une fois');
    // Changer la répartition : le prix de la part 1 retouché à la main depuis est gardé.
    const div1 = mag1.vrm_achats_divises['700000002'];
    const rep2 = D.repartirParts({ total: 6470, n: 3, mode: 'main', manuels: ['10', '', '24,70'], fixes: { 1: 3000 } });
    const p2 = D.planNouvelleRepartition({ confirme: true, division: div1, repartition: rep2, at });
    dit(!p2.erreur && D.divisionJuste(p2.record) && p2.record.parts[0].prix === 1000 && p2.record.parts[2].prix === 2470, 'changer la répartition (à la main) : 10 + 30 + 24,70', p2.erreur);
    const mag2 = appliquer(mag1, p2.morceaux);
    dit(mag2.vinted_annonce_numeros['8001'].buyPrice === '10,00' && mag2.vinted_buyprice_by_num['45'] === '24,70', 'les nouveaux coûts sont posés (fiche N°12, coût du N°45)');

    // ── 5. REGROUPER ──────────────────────────────────────────────────────────────────────────────
    if (!silencieux) console.log('── 5. « Regrouper » : jamais une part vendue, jamais sur un « pas su »');
    const div2 = mag2.vrm_achats_divises['700000002'] || div1;
    dit(D.peutRegrouper(div2, { venduDe: (n) => n === '13' }).raison === 'vendue', 'une part vendue (N°13) ⇒ « Regrouper » refusé, le N° dit');
    dit(D.peutRegrouper(div2, { venduDe: () => null }).raison === 'passu', 'ventes pas lues (pas su) ⇒ refusé, dit');
    dit(D.peutRegrouper(div2, {}).ok === false, 'sans lecture des ventes ⇒ refusé');
    const peut = D.peutRegrouper(div2, { venduDe: () => false });
    dit(peut.ok, 'aucune part vendue ⇒ « Regrouper » possible');
    dit(D.planRegroupement({ division: div2, peut, at }).erreur === 'confirme', 'sans SON toucher : rien');
    const pr = D.planRegroupement({ confirme: true, division: div2, peut, at });
    dit(!pr.erreur, 'le plan de regroupement', pr.erreur);
    if (!pr.erreur) {
      const mag3 = appliquer(mag2, pr.morceaux);
      const sansDiv = (m) => ({ ...m, vrm_achats_divises: {} })
      dit(JSON.stringify(sansDiv(mag3).vinted_annonce_numeros['8001']) === JSON.stringify(magasin0.vinted_annonce_numeros['8001']), 'la paire N°12 revient exactement comme avant (prix vide, aucun lien)');
      dit(mag3.vinted_annonce_numeros['8002'].buyPrice === '30,00' && !mag3.vinted_annonce_numeros['8002'].buyFromId, 'la paire N°13 garde SON prix (30 €), son lien part');
      dit(mag3.vrm_fiches_neuves.nA === undefined && mag3.vinted_buyprice_by_num['45'] === undefined && mag3.vinted_buyprice_by_num['200'] === '40,00', 'la fiche neuve et son coût partent ; les autres coûts restent');
      dit(mag3.vrm_lots_declares['700000002'] === undefined, 'la déclaration de lot est rendue');
      const r = mag3.vrm_achats_divises['700000002'];
      dit(r && r.regroupe === true && D.divisionActive(mag3.vrm_achats_divises, '700000002') === null && r.historique.map((h) => h.geste).join(',') === 'diviser,repartir,regrouper', 'la division est close, gardée dans l’historique (diviser · répartir · regrouper)');
      dit(r && r.numeros.join(',') === '12,13,45', 'les N° des parts restent dits (le N°45 n’est jamais redonné)');
      // Un prix retouché à la main depuis la division : gardé au regroupement.
      const mag2b = JSON.parse(JSON.stringify(mag2)); mag2b.vinted_buyprice_by_num['45'] = '26,00';
      const mag3b = appliquer(mag2b, pr.morceaux);
      dit(mag3b.vinted_buyprice_by_num['45'] === '26,00', 'un coût retouché par lui depuis la division est GARDÉ au regroupement');
    }
  }
  // Refus du plan : deux parts sur le même N°, une paire déjà reliée à un autre achat, déjà divisé, un N° déjà servi.
  {
    const two = [{ cible: { type: 'neuf', numero: '45', ficheId: 'nA' } }, { cible: { type: 'neuf', numero: '45', ficheId: 'nB' } }];
    const r2 = D.repartirParts({ total: 6000, n: 2, mode: 'egal' });
    dit(D.planDivision({ confirme: true, achat, total: 6000, repartition: r2, parts: two, lus: lus0(), at }).erreur === 'doublon', 'deux parts sous le même N° ⇒ refus (le seul risque irréversible)');
    const rel = [{ cible: { type: 'fiche', cle: '8003' } }, { cible: { type: 'neuf', numero: '46', ficheId: 'nC' } }];
    dit(D.planDivision({ confirme: true, achat, total: 6000, repartition: r2, parts: rel, lus: lus0(), at }).erreur === 'reliee', 'une paire déjà reliée à un AUTRE achat ⇒ refus');
    const servi = [{ cible: { type: 'neuf', numero: '200', ficheId: 'nD' } }, { cible: { type: 'neuf', numero: '46', ficheId: 'nE' } }];
    dit(D.planDivision({ confirme: true, achat, total: 6000, repartition: r2, parts: servi, lus: lus0(), at }).erreur === 'numero', 'un N° qui a déjà un coût (déjà servi) ⇒ refus');
    const ok2 = [{ cible: { type: 'neuf', numero: '46', ficheId: 'nF' } }, { cible: { type: 'neuf', numero: '47', ficheId: 'nG' } }];
    const lusD = lus0(); lusD.divisions['700000002'] = { tx: '700000002', parts: [{}, {}], at };
    dit(D.planDivision({ confirme: true, achat, total: 6000, repartition: r2, parts: ok2, lus: lusD, at }).erreur === 'deja', 'un achat déjà divisé ne se divise pas deux fois');
    dit(D.planDivision({ confirme: true, achat, total: 6000, repartition: r2, parts: ok2, lus: { ...lus0(), fiches: null }, at }).erreur === 'lecture', 'une lecture ratée ⇒ rien n’est écrit');
    const rFaux = { ...r2, parts: [3000, 2999] };
    dit(D.planDivision({ confirme: true, achat, total: 6000, repartition: rFaux, parts: ok2, lus: lus0(), at }).erreur === 'somme', 'une répartition qui ne fait pas le total ⇒ refus');
    // Un achat SIMPLE (pas un lot) se divise aussi, à la main.
    const simple = { transaction_id: '700000003', title: 'Nike Dunk', price: { amount: '45.5', currency_code: 'EUR' }, status: 'Commande finalisée' };
    const ts = D.totalADiviser({ achat: simple });
    const rs = D.repartirParts({ total: ts.total, n: 2, mode: 'egal' });
    const ps = D.planDivision({ confirme: true, achat: simple, total: ts.total, source: ts.source, repartition: rs, parts: ok2, lus: lus0(), at });
    dit(D.lotDeLAchat({ achat: simple }).etat === 'simple' && !ps.erreur && D.sommeParts(ps.record) === 4550, 'un achat simple (« Nike Dunk », 45,50 €) se divise en 2 : 22,75 + 22,75');
  }
  return { ok, ko };
}

function appli() {
  let ok = 0, ko = 0;
  const dit = (c, m) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}`); };
  console.log('── 6. L’app branche la règle');
  const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
  const co = lire('src/ecrans/Comptabilite.jsx'), app = lire('src/App.jsx'), f = lire('src/natif/ecrans/DiviserAchat.jsx'), tt = lire('src/natif/ecrans/AchatsTableau.jsx');
  const geste = (() => { const i = co.indexOf('const diviserAchatGeste = async'); return i < 0 ? '' : co.slice(i, co.indexOf('const repartirAchatGeste', i)); })();
  dit(/repartirParts\(/.test(geste) && /planDivision\(\{ confirme: true/.test(geste), 'la coque REJOUE la répartition et le plan au moment d’écrire');
  dit(/numerosServisRelus\(\)/.test(geste) && /numerosDuLot\(/.test(geste) && /raison: 'decale'/.test(geste), 'les N° neufs : relus en base, `prochainLibre`, aperçu décalé ⇒ rien écrit');
  dit(geste.indexOf("save('vinted_used_numeros'") > 0 && geste.indexOf("save('vinted_used_numeros'") < geste.indexOf('gesteMorceaux('), 'le pool d’abord (append-only), puis UN geste annulable');
  dit(/peutRegrouper\(div, \{ venduDe: venduDuNum \}\)/.test(co) && /numsVendusDiviser \? numsVendusDiviser\.has/.test(co), '« Regrouper » lit les N° vendus (ventes pas lues ⇒ pas su)');
  dit(/liensAvecDivisions\(liensParAchat\(numeros, saleOv\), divisionsAchats\)/.test(co), 'Relier : un achat divisé est complet (plus proposé)');
  dit(/'vrm_achats_divises',/.test(app), 'les divisions sont synchronisées (tous ses appareils)');
  dit(/repartirParts\(/.test(f) && /modesPossibles\(/.test(f) && /data-lot-reste/.test(f), 'la feuille calcule par la MÊME règle et montre le reste en direct');
  dit(/data-achat-diviser=\{tid\}/.test(co) && /data-achat-lot=\{l\.etat\}/.test(co), 'la rangée d’Achats : l’étiquette du lot (un toucher) et « Diviser » dans ⋯');
  dit(/onDiviser/.test(tt) && /lotDe \? lotDe\(l\)/.test(tt), 'le tableau de l’ordinateur : l’étiquette et « Diviser » dans le menu de la ligne');
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const t = lire(`src/i18n/langues/${l}/lotAchat.js`), idx = lire(`src/i18n/langues/${l}.js`);
    dit(t.includes('"lotachat.diviserEn"') && /ecran_lotachat/.test(idx), `textes en ${l}`);
  }
  dit(/id: 'achats-lot-diviser'/.test(lire('src/nouveautes.js')), 'Quoi de neuf : une ligne');
  return { ok, ko };
}

(async () => {
  const src = path.join(R, 'src');
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    const base = fs.readFileSync(path.join(src, 'achatDivise.js'), 'utf8');
    for (const [nom, a, b] of MUTATIONS) {
      if (!base.includes(a)) { console.log(`❌ mutation ${nom} : motif absent`); continue; }
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'al-mut-'));
      fs.writeFileSync(path.join(d, 'achatDivise.js'), base.replace(a, b));
      for (const x of ['venteLot.js', 'grosLot.js', 'prixAchatPropose.js']) fs.copyFileSync(path.join(src, x), path.join(d, x));
      const r = await jouer(d, { silencieux: true });
      console.log(`${r.ko ? '✅' : '❌'} mutation ${nom} ⇒ ${r.ko} rouge(s)`);
      if (r.ko) rouges++;
      fs.rmSync(d, { recursive: true, force: true });
    }
    console.log(`\n${rouges}/${MUTATIONS.length} mutations rougissent`);
    process.exit(rouges === MUTATIONS.length ? 0 : 1);
  }
  const r = await jouer(src);
  const a = appli();
  console.log(`\n${r.ok + a.ok} ✅ · ${r.ko + a.ko} ❌`);
  process.exit(r.ko + a.ko ? 1 : 0);
})();
