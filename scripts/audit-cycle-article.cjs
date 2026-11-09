// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE CYCLE D'UN ARTICLE ET SES CAS AMBIGUS (3 novembre 2026)
//
//  Julien craint « plein de cas où il peut y avoir une ambiguïté et des erreurs
//  avec les articles ». Ce contrôle EXÉCUTE les vraies règles (aucune copie) :
//    · src/cycleArticle.js       — « N°x supprimé de Vinted » (etatCycle, cartes, registre « vu en ligne ») ;
//    · src/propositionsSites.js  — ce que VRM propose pour eBay / Leboncoin ;
//    · src/agentEbay.js          — l'agent eBay (propositionAgent) avec « Toujours chez moi » ;
//    · src/retraitAilleurs.js    — retrait AUTOMATIQUE d'eBay après une vente Leboncoin / Vestiaire.
//  Sur des données INVENTÉES (le dépôt est public), un cas par ambiguïté (C1…C14).
//
//  `--prouve` (§6.1) : (1) les mêmes contrôles sur origin/main (ou `--avant <ref>`) —
//  ils doivent être ROUGES ; (2) des MUTATIONS des règles (une à la fois, sur une
//  copie) : chacune doit rendre au moins un contrôle rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.CYCLE_RACINE || path.join(__dirname, '..');

async function charger(racine) {
  const m = {};
  const imp = async (rel) => { try { return await import(pathToFileURL(path.join(racine, rel)).href + '?t=' + Date.now() + Math.random()); } catch (e) { return { __erreur: String(e && e.message || e).slice(0, 160) }; } };
  m.cycle = await imp('src/cycleArticle.js');
  m.prop = await imp('src/propositionsSites.js');
  m.agent = await imp('src/agentEbay.js');
  m.ret = await imp('src/retraitAilleurs.js');
  return m;
}

async function controles(racine, silencieux) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, msg, d) => { if (c) ok++; else { ko++; rouges.push(msg); } if (!silencieux) console.log((c ? '✅ ' : '❌ ') + msg + (!c && d ? '  → ' + String(d).slice(0, 220) : '')); };
  const M = await charger(racine);
  const essai = (msg, f) => { try { const r = f(); dit(r === true, msg, r === true ? '' : JSON.stringify(r)); } catch (e) { dit(false, msg, e && e.message); } };
  const C = M.cycle || {}, P = M.prop || {}, AG = M.agent || {}, R = M.ret || {};
  const maintenant = Date.parse('2026-11-03T10:00:00Z');
  const iso = (min) => new Date(maintenant - min * 60000).toISOString();
  const cle = (n) => { const s = String(n == null ? '' : n).toUpperCase().replace(/\s+/g, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };
  const A = '111', B = '222';
  // Une base inventée : chaque test part de `base()` et la modifie.
  const fiche = (num, k, uid = A, extra = {}) => ({ numero: num, accountId: uid, title: `Nike Air Max 90 blanche taille 42`, photo: `https://x/${k}.jpg`, photoK: `pk${k}`, price: '60', ...extra });
  const base = () => {
    const fiches = { 1: fiche('12', 1) };
    const lectures = new Map([[A, { lu: maintenant - 10 * 60000, complet: true, enLigne: new Set(), masquees: new Set(), aConfirmer: new Set(), venduesDressing: new Set() }],
      [B, { lu: maintenant - 10 * 60000, complet: true, enLigne: new Set(), masquees: new Set(), aConfirmer: new Set(), venduesDressing: new Set() }]]);
    return { fiches, lectures, vus: { 1: iso(60 * 48) }, supprimees: new Map(), recrees: {}, viaVrm: new Set(), ventes: { ids: new Set(), nums: new Set(), revenues: new Set() },
      vendusMain: new Set(), remis: new Set(), decisions: {}, declaree: () => false, exclus: new Set(), cle, maintenant };
  };
  const etat = (b, id = '1') => C.etatCycle(id, { ...b, fiche: b.fiches[id], presentes: C.indexPresentes(b.fiches, b.lectures, cle) }).etat;
  const charge = typeof C.etatCycle === 'function' && typeof C.cartesSupprimees === 'function' && typeof C.majVusEnLigne === 'function';
  dit(charge, 'les règles du cycle se chargent (src/cycleArticle.js)', C.__erreur);

  // ── C0 : le cas de base ─────────────────────────────────────────────────────
  essai('C0 · vue en ligne il y a 2 j, absente de la lecture COMPLÈTE d\'aujourd\'hui, aucune vente ⇒ « à demander »', () => etat(base()) === 'a-demander' || etat(base()));
  essai('C0 · en ligne ⇒ « en-ligne », aucune question', () => { const b = base(); b.lectures.get(A).enLigne.add('1'); return etat(b) === 'en-ligne' || etat(b); });
  essai('C0 · jamais vue en ligne (N° d\'archive B…, avant la règle) ⇒ jamais demandée', () => { const b = base(); b.vus = {}; b.fiches[1].numero = 'B13'; return etat(b) === 'jamais-vue' || etat(b); });
  essai('C0 · suppression vue en 2xx par l\'extension, sans registre ⇒ « à demander » (preuve : suppression)', () => { const b = base(); b.vus = {}; b.supprimees = new Map([[A, { 1: iso(30) }]]); const r = C.etatCycle('1', { ...b, fiche: b.fiches[1] }); return (r.etat === 'a-demander' && r.preuve === 'suppression') || r; });
  essai('C0 · vue en ligne APRÈS la lecture (ou dans la marge de 5 min) ⇒ rien conclu', () => { const b = base(); b.vus = { 1: new Date(b.lectures.get(A).lu - 60000).toISOString() }; return etat(b) === 'jamais-vue' || etat(b); });
  // ── C1 : supprimée puis republiée avec d'autres photos ─────────────────────
  essai('C1 · republiée avec d\'autres photos, le N° a suivi (repriseNumero) ⇒ « republiée », aucune question', () => { const b = base(); b.fiches[2] = fiche('12', 99, A, { recreeDe: '1' }); b.lectures.get(A).enLigne.add('2'); return etat(b) === 'republiee' || etat(b); });
  essai('C1 · republiée par VRM, nouvelle annonce pas encore renumérotée (table de recréation) ⇒ « republiée »', () => { const b = base(); b.fiches[2] = fiche('31', 98); b.lectures.get(A).enLigne.add('2'); b.recrees = { 2: '1' }; return etat(b) === 'republiee' || etat(b); });
  essai('C1 · table de recréation illisible ⇒ « pas su », aucune question', () => { const b = base(); b.recrees = null; return etat(b) === 'pas-su' || etat(b); });
  essai('C1 · retirée par VRM (Republier : coffre → supprimer → brouillon) ⇒ jamais de question', () => { const b = base(); b.viaVrm = new Set(['1']); return etat(b) === 'via-vrm' || etat(b); });
  essai('C1 · coffre de Republier illisible ⇒ « pas su »', () => { const b = base(); b.viaVrm = null; return etat(b) === 'pas-su' || etat(b); });
  // ── C2 : supprimée sur un compte, republiée sur un autre ───────────────────
  essai('C2 · republiée sur un AUTRE compte avec la même photo (même fichier) ⇒ « republiée »', () => { const b = base(); b.fiches[3] = fiche('40', 1, B); b.lectures.get(B).enLigne.add('3'); return etat(b) === 'republiee' || etat(b); });
  essai('C2 · republiée sur un autre compte sous le même N° ⇒ « republiée »', () => { const b = base(); b.fiches[3] = fiche('12', 77, B); b.lectures.get(B).enLigne.add('3'); return etat(b) === 'republiee' || etat(b); });
  essai('C2 · republiée sur un autre compte SANS identité commune ⇒ on demande (jamais par le titre)', () => { const b = base(); b.fiches[3] = fiche('41', 76, B); b.lectures.get(B).enLigne.add('3'); return etat(b) === 'a-demander' || etat(b); });
  // ── C3 : masquée / en pause ────────────────────────────────────────────────
  essai('C3 · masquée par Vinted (is_hidden) ⇒ « masquée », jamais « supprimée »', () => { const b = base(); b.lectures.get(A).masquees.add('1'); return etat(b) === 'masquee' || etat(b); });
  essai('C3 · compte retiré / bloqué / masqué ⇒ hors cycle', () => { const b = base(); b.exclus = new Set([A]); return etat(b) === 'hors-compte' || etat(b); });
  // ── C4 : lecture incomplète ou ratée ───────────────────────────────────────
  essai('C4 · lecture PARTIELLE (total non atteint) ⇒ « pas su »', () => { const b = base(); b.lectures.get(A).complet = false; return etat(b) === 'pas-su' || etat(b); });
  essai('C4 · lecture de plus de 24 h ⇒ « pas su »', () => { const b = base(); b.lectures.get(A).lu = maintenant - 25 * 3600000; return etat(b) === 'pas-su' || etat(b); });
  essai('C4 · compte pas lu du tout ⇒ « pas su »', () => { const b = base(); b.lectures.delete(A); return etat(b) === 'pas-su' || etat(b); });
  essai('C4 · « à confirmer » ⇒ jamais « supprimée »', () => { const b = base(); b.lectures.get(A).aConfirmer.add('1'); return etat(b) === 'a-confirmer' || etat(b); });
  essai('C4 · ventes illisibles ⇒ « pas su »', () => { const b = base(); b.ventes = null; return etat(b) === 'pas-su' || etat(b); });
  // ── C5 : vendue sur Vinted ET sur Leboncoin presque en même temps ──────────
  essai('C5 · vendue sur Vinted (transaction) et sur Leboncoin (N°) ⇒ « vendue », aucune question', () => { const b = base(); b.ventes.ids.add('1'); b.ventes.nums.add('12'); return etat(b) === 'vendue' || etat(b); });
  essai('C5 · vendue sur Leboncoin seulement (par N°), annonce Vinted supprimée ensuite ⇒ « vendue »', () => { const b = base(); b.ventes.nums.add('12'); return etat(b) === 'vendue' || etat(b); });
  essai('C5 · fermée « vendue » dans le dressing ⇒ « vendue »', () => { const b = base(); b.lectures.get(A).venduesDressing.add('1'); return etat(b) === 'vendue' || etat(b); });
  // ── C6 : vente annulée / retour ────────────────────────────────────────────
  essai('C6 · vente revenue (annulée, retour) ⇒ « revenue », pas « supprimée »', () => { const b = base(); b.ventes.revenues.add('1'); return etat(b) === 'revenue' || etat(b); });
  essai('C6 · retour REMIS en stock ⇒ chez lui', () => { const b = base(); b.remis = new Set(['12']); const e = etat(b); return (e === 'remis' && C.chezLui(e)) || e; });
  // ── C7 : 50 articles identiques ────────────────────────────────────────────
  essai('C7 · 50 articles identiques (même titre, marque, taille, prix) : un seul supprimé ⇒ UNE carte, la sienne', () => {
    const b = base(); b.fiches = {}; b.vus = {};
    for (let k = 1; k <= 50; k++) { b.fiches[k] = fiche(String(100 + k), 1000 + k); b.vus[k] = iso(60 * 48); if (k !== 17) b.lectures.get(A).enLigne.add(String(k)); }
    b.ventes.ids.add('3'); b.lectures.get(A).enLigne.delete('3');
    const r = C.cartesSupprimees(b.fiches, { ...b, presentes: C.indexPresentes(b.fiches, b.lectures, cle) }, 50);
    return (r.total === 1 && r.cartes[0].id === '17' && r.cartes[0].numero === '117') || r;
  });
  // ── C8 : article Vestiaire sans N° commun ──────────────────────────────────
  essai('C8 · vendu sur Vestiaire SANS N° commun : aucune identité ⇒ on demande (jamais rapproché)', () => { const b = base(); b.ventes.nums = new Set(); return etat(b) === 'a-demander' || etat(b); });
  // ── C9 : publié sur eBay puis supprimé de Vinted ───────────────────────────
  essai('C9 · sur eBay puis supprimé de Vinted ⇒ on demande ; « Toujours chez moi » ⇒ pas reproposé à eBay (déjà dessus)', () => {
    const b = base(); if (etat(b) !== 'a-demander') return etat(b);
    b.decisions = { 1: { choix: 'chez-moi' } };
    const p = P.propositionSite('1', b.fiches[1], { ...b, presentes: C.indexPresentes(b.fiches, b.lectures, cle), surSite: () => true });
    return (p.ok === false && p.raison === 'deja-sur-site') || p;
  });
  // ── C10 : achat retourné ───────────────────────────────────────────────────
  essai('C10 · achat retourné au vendeur après mise en ligne : on demande ; « Je m\'en sépare » ⇒ sorti du stock, jamais vendu', () => {
    const b = base(); if (etat(b) !== 'a-demander') return etat(b);
    b.decisions = { 1: { choix: 'separe' } }; const e = etat(b); return (e === 'sortie' && !C.chezLui(e)) || e;
  });
  // ── Ses réponses ───────────────────────────────────────────────────────────
  essai('R · « Toujours chez moi » ⇒ chez lui, plus de question', () => { const b = base(); b.decisions = { 1: { choix: 'chez-moi' } }; const e = etat(b); return (e === 'chez-moi' && C.chezLui(e)) || e; });
  essai('R · « Remise en ligne » (9 nov.) ⇒ toujours chez lui, rien ne sort, aucune vente', () => { const b = base(); b.decisions = { 1: { choix: 'remise' } }; const e = etat(b); return (e === 'chez-moi' && C.chezLui(e)) || e; });
  essai('R · « Vendu en main propre » ⇒ vendu (sorti du stock)', () => { const b = base(); b.decisions = { 1: { choix: 'vendu-main', montant: 45 } }; const e = etat(b); return (e === 'vendue' && !C.chezLui(e)) || e; });
  essai('R · sans réponse, l\'article reste chez lui (jamais compté vendu, jamais sorti)', () => { const e = etat(base()); return (e === 'a-demander' && C.chezLui(e)) || e; });
  essai('R · déclaré parti ailleurs (« Elle n\'est plus là ») ⇒ « sortie », plus de question', () => { const b = base(); b.declaree = (id) => id === '1'; return etat(b) === 'sortie' || etat(b); });
  essai('R · le montant d\'une vente en main propre n\'est jamais deviné', () => (C.montantSaisi('45,50 €') === 45.5 && C.montantSaisi('') === null && C.montantSaisi('abc') === null && C.montantSaisi('0') === null) || 'montant');
  // ── Le registre « vu en ligne » ────────────────────────────────────────────
  essai('V · une lecture complète et fraîche note les annonces en ligne', () => { const b = base(); b.lectures.get(A).enLigne.add('1'); const v = C.majVusEnLigne({}, b.fiches, b.lectures, maintenant); return !!(v && v[1]) || v; });
  essai('V · une lecture partielle n\'écrit rien', () => { const b = base(); b.lectures.get(A).enLigne.add('1'); b.lectures.get(A).complet = false; return C.majVusEnLigne({}, b.fiches, b.lectures, maintenant) === null || 'écrit'; });
  essai('V · jamais une entrée retirée ; pas de réécriture avant 6 h', () => { const b = base(); const v = C.majVusEnLigne({ 9: iso(10), 1: iso(60) }, b.fiches, (b.lectures.get(A).enLigne.add('1'), b.lectures), maintenant); return v === null || (v[9] && v[1]) || v; });
  // ── Les propositions eBay / Leboncoin ──────────────────────────────────────
  const prop = (b, id = '1', extra = {}) => P.propositionSite(id, b.fiches[id], { ...b, presentes: C.indexPresentes(b.fiches, b.lectures, cle), surSite: () => false, ...extra });
  essai('P · en ligne sur Vinted ⇒ proposé', () => { const b = base(); b.lectures.get(A).enLigne.add('1'); return prop(b).ok === true || prop(b); });
  essai('P · « Toujours chez moi » avec photo et fiche ⇒ proposé', () => { const b = base(); b.decisions = { 1: { choix: 'chez-moi' } }; return prop(b).ok === true || prop(b); });
  essai('P · « Toujours chez moi » SANS photo ⇒ jamais proposé', () => { const b = base(); b.decisions = { 1: { choix: 'chez-moi' } }; b.fiches[1].photo = ''; return (prop(b).ok === false && prop(b).raison === 'sans-photo') || prop(b); });
  essai('P · supprimé, pas encore tranché ⇒ pas proposé', () => (prop(base()).ok === false && prop(base()).raison === 'a-trancher') || prop(base()));
  essai('P · masqué par Vinted ⇒ pas proposé (ni en ligne, ni « chez moi »)', () => { const b = base(); b.lectures.get(A).masquees.add('1'); return prop(b).ok === false || prop(b); });
  essai('P · vendu / séparé / vendu en main propre / pas su ⇒ jamais proposé', () => {
    const r = [];
    { const b = base(); b.lectures.get(A).enLigne.add('1'); b.ventes.ids.add('1'); r.push(prop(b).raison === 'vendue'); }
    { const b = base(); b.decisions = { 1: { choix: 'separe' } }; r.push(prop(b).raison === 'sortie'); }
    { const b = base(); b.decisions = { 1: { choix: 'vendu-main' } }; r.push(prop(b).raison === 'vendue'); }
    { const b = base(); b.lectures.get(A).aConfirmer.add('1'); r.push(prop(b).raison === 'pas-su'); }
    { const b = base(); b.lectures.get(A).enLigne.add('1'); r.push(prop(b, '1', { surSite: () => null }).raison === 'pas-su'); }
    return r.every(Boolean) || r;
  });
  // ── L'agent eBay : (a) en ligne + (b) « Toujours chez moi » ────────────────
  essai('A · l\'agent eBay propose un article « Toujours chez moi » (et toujours ceux en ligne)', () => {
    if (typeof AG.propositionAgent !== 'function') return 'agent absent';
    const paires = [{ id: '1', num: '12', title: 't', prix: 60, photos: ['p'], cover: 'p', uid: A }, { id: '2', num: '13', title: 't', prix: 60, photos: ['p'], cover: 'p', uid: A }, { id: '3', num: '14', title: 't', prix: 60, photos: ['p'], cover: 'p', uid: A }];
    const r = AG.propositionAgent({ regles: { actif: true, parJour: 10 }, paires, enLigne: new Set(['2']), chezMoi: new Set(['1']), ventes: { vendus: new Map(), pasSu: [] }, dejaSurEbay: new Map(), jumelles: new Map(), achatDe: () => null, publieesAujourdhui: 0, cle });
    const ids = (r.proposees || []).map((x) => x.id).sort().join(',');
    return (r.etat === 'lu' && ids === '1,2') || { etat: r.etat, ids, ecartees: r.ecartees };
  });
  // ── Le retrait AUTOMATIQUE d'eBay après une vente Leboncoin / Vestiaire ─────
  const annonce = (num, depuis = iso(60 * 24 * 10)) => ({ itemId: '5' + num, sku: 'VRM-' + num, depuis, fin: null });
  const numEbayLu = (sku) => { const m = /^VRM-(.+)$/.exec(String(sku || '')); return m ? cle(m[1]) : ''; };
  const clesAnnonce = (ad, liens) => { const k = liens[String(ad.id)]; return k ? [cle(k)] : []; };
  const lbcAnnulee = (v) => v.stepStatus === 'cancelled';
  const ret = (d, extra = {}) => R.retraitsEbayAutoAilleursPermis({ aRetirerEbayAilleurs: [d], numeros: { 1: { numero: '12' } }, revenues: new Set(), cle, numEbayLu, clesAnnonce, lbcAnnulee, maintenant,
    lbc: { ventes: { t1: { isSeller: true, itemId: 'L1', dateVente: iso(60), txId: 't1' } }, items: {}, liens: { L1: '12' }, cap: iso(30) },
    vc: { ventes: [{ id: 'v1', num: '12', date: iso(60), etat: 'vendu' }], cap: iso(30) }, ...extra });
  const lbcD = { annonce: annonce('12'), numero: '12', ou: 'Leboncoin' }, vcD = { annonce: annonce('12'), numero: '12', ou: 'Vestiaire' };
  const raison = (r) => (r.ecartes[0] || {}).raison || (r.permis.length ? 'permis' : '?');
  essai('E · vendue sur Leboncoin (annonce reliée par identité), eBay publiée avant ⇒ retirée automatiquement', () => { if (typeof R.retraitsEbayAutoAilleursPermis !== 'function') return 'absent'; const r = ret(lbcD); return (r.permis.length === 1 && !!r.permis[0].venduLe) || raison(r); });
  essai('E · vendue sur Vestiaire (N° de l\'annonce Vestiaire) ⇒ retirée automatiquement', () => { const r = ret(vcD); return r.permis.length === 1 || raison(r); });
  essai('E · vente Leboncoin ANNULÉE pour ce N° ⇒ rien ne part', () => { const r = ret(lbcD, { lbc: { ventes: { t1: { isSeller: true, itemId: 'L1', dateVente: iso(60), stepStatus: 'cancelled' } }, items: {}, liens: { L1: '12' }, cap: iso(30) } }); return raison(r) === 'revenue-une-fois' || raison(r); });
  essai('E · vente Vestiaire sans N° (aucune identité) ⇒ rien ne part', () => { const r = ret(vcD, { vc: { ventes: [{ id: 'v1', num: '', date: iso(60) }], cap: iso(30) } }); return raison(r) === 'vente-non-confirmee' || raison(r); });
  essai('E · liste des ventes Leboncoin relue il y a plus de 48 h ⇒ rien ne part', () => { const r = ret(lbcD, { lbc: { ventes: { t1: { isSeller: true, itemId: 'L1', dateVente: iso(60 * 72) } }, items: {}, liens: { L1: '12' }, cap: iso(60 * 72) } }); return raison(r) === 'liste-perimee' || raison(r); });
  essai('E · annonce eBay mise en ligne APRÈS la vente ⇒ rien ne part', () => { const r = ret({ ...lbcD, annonce: annonce('12', iso(10)) }); return raison(r) === 'ebay-apres-vente' || raison(r); });
  essai('E · N° porté par deux articles ⇒ rien ne part', () => { const r = ret(lbcD, { numeros: { 1: { numero: '12' }, 2: { numero: '12' } } }); return raison(r) === 'numero-partage' || raison(r); });
  essai('E · article déjà revenu une fois sur Vinted ⇒ rien ne part', () => { const r = ret(lbcD, { revenues: new Set(['1']) }); return raison(r) === 'revenue-une-fois' || raison(r); });
  essai('E · retours Vinted illisibles ⇒ « pas su », rien ne part', () => { const r = ret(lbcD, { revenues: null }); return raison(r) === 'pas-su' || raison(r); });
  essai('E · SKU d\'un autre N° ⇒ rien ne part', () => { const r = ret({ ...lbcD, annonce: { ...annonce('12'), sku: 'VRM-13' } }); return raison(r) === 'sku' || raison(r); });
  essai('E · ventes Leboncoin illisibles ⇒ « pas su »', () => { const r = ret(lbcD, { lbc: null }); return raison(r) === 'pas-su' || raison(r); });
  return { ok, ko, rouges };
}

// ── Les mutations : chacune réaffaiblit UNE règle et doit faire rougir un contrôle.
const MUTATIONS = [
  ['cycle : une absence suffit (registre « vu en ligne » ignoré)', 'src/cycleArticle.js', 'if (!vueSupprimee && !vuePuisAbsente) return { etat: \'jamais-vue\' };', ''],
  ['cycle : la lecture partielle suffit', 'src/cycleArticle.js', 'lec.complet !== true || ', ''],
  ['cycle : Republier par VRM n\'est plus reconnu', 'src/cycleArticle.js', 'if (o.viaVrm.has(id)) return { etat: \'via-vrm\' };', ''],
  ['cycle : la photo n\'est plus une identité', 'src/cycleArticle.js', 'if (pk && estMap(p.parPhoto) && autre(p.parPhoto.get(pk))) return { etat: \'republiee\', preuve: \'photo\' };', ''],
  ['cycle : le N° n\'est plus une identité', 'src/cycleArticle.js', 'if (estMap(p.parNum) && autre(p.parNum.get(k))) return { etat: \'republiee\', preuve: \'numero\' };', ''],
  ['cycle : vente sur un autre site ignorée', 'src/cycleArticle.js', 'if (estSet(v.nums) && v.nums.has(k)) return { etat: \'vendue\', preuve: \'numero\' };', ''],
  ['cycle : masquée = supprimée', 'src/cycleArticle.js', 'if (estSet(lec.masquees) && lec.masquees.has(id)) return { etat: \'masquee\' };', ''],
  ['cycle : « pas su » des ventes = rien', 'src/cycleArticle.js', "if (o.ventes === null) return { etat: 'pas-su', preuve: 'ventes' };", ''],
  ['cycle : « Je m\'en sépare » ignoré', 'src/cycleArticle.js', "if (dec && dec.choix === CHOIX.SEPARE) return { etat: 'sortie', preuve: 'separe' };", ''],
  ['propositions : un article sans photo passe', 'src/propositionsSites.js', "if (!photo || !String(fiche.title || '').trim()) return { ok: false, etat: r.etat, raison: 'sans-photo' };", ''],
  ['propositions : déjà sur le site passe', 'src/propositionsSites.js', "if (sur === true) return { ok: false, etat: r.etat, raison: 'deja-sur-site' };", ''],
  ['agent eBay : « Toujours chez moi » ignoré', 'src/agentEbay.js', '&& !(estSet(x.chezMoi) && x.chezMoi.has(id))', ''],
  ['retrait : une vente annulée ne bloque plus', 'src/retraitAilleurs.js', "if (annulee) { ecarte('revenue-une-fois'); continue; }", ''],
  ['retrait : liste périmée acceptée', 'src/retraitAilleurs.js', 'maintenant - cap > VENTES_AILLEURS_FRAICHES_MS', 'false'],
  ['retrait : eBay après la vente accepté', 'src/retraitAilleurs.js', "if (!(tEbay < tVente)) { ecarte('ebay-apres-vente'); continue; }", ''],
  ['retrait : N° partagé accepté', 'src/retraitAilleurs.js', "if (ids.length > 1) { ecarte('numero-partage'); continue; }", ''],
];

const copieArbre = (src) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-'));
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  for (const f of ['cycleArticle.js', 'propositionsSites.js', 'retraitAilleurs.js', 'agentEbay.js']) { const p = path.join(src, 'src', f); if (fs.existsSync(p)) fs.copyFileSync(p, path.join(d, 'src', f)); }
  fs.cpSync(path.join(src, 'api', '_lib'), path.join(d, 'api', '_lib'), { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), '{"type":"module"}');
  return d;
};

(async () => {
  const prouve = process.argv.includes('--prouve');
  console.log('— Le cycle d\'un article, sur ' + RACINE);
  const r = await controles(RACINE, false);
  console.log(`\n${r.ko ? '❌' : '✅'} audit-cycle-article : ${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (!prouve) process.exit(r.ko ? 1 : 0);
  // (1) le code d'avant
  const ia = process.argv.indexOf('--avant'); const avant = ia > 0 ? process.argv[ia + 1] : 'origin/main';
  const dAv = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-avant-'));
  cp.execSync(`git -C ${JSON.stringify(RACINE)} archive ${avant} src api | tar -x -C ${JSON.stringify(dAv)}`);
  fs.writeFileSync(path.join(dAv, 'package.json'), '{"type":"module"}');
  const rav = await controles(dAv, true);
  console.log(`\n— Sur ${avant} : ${rav.ko} rouge(s) sur ${rav.ok + rav.ko} (attendu : des rouges) ${rav.ko ? '✅' : '❌'}`);
  // (2) les mutations
  let tuees = 0;
  for (const [nom, fichier, de, vers] of MUTATIONS) {
    const d = copieArbre(RACINE); const p = path.join(d, fichier); const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(de)) { console.log(`❌ mutation introuvable : ${nom}`); continue; }
    fs.writeFileSync(p, t.replace(de, vers));
    const rm = await controles(d, true);
    if (rm.ko) tuees++;
    console.log(`${rm.ko ? '✅' : '❌'} mutation « ${nom} » : ${rm.ko} rouge(s)${rm.ko ? ' — ' + rm.rouges[0] : ''}`);
  }
  console.log(`\n${tuees === MUTATIONS.length && rav.ko ? '✅' : '❌'} preuve : ${tuees}/${MUTATIONS.length} mutations attrapées, ${rav.ko} rouge(s) sur le code d'avant`);
  process.exit(tuees === MUTATIONS.length && rav.ko && !r.ko ? 0 : 1);
})();
