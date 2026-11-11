#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA FACTURE PRO DES VENTES LEBONCOIN, EBAY, VESTIAIRE (10 nov., lot S)
// ════════════════════════════════════════════════════════════════════════════
// Exécute la VRAIE règle (src/facturePro/sources.js) et la VRAIE route
// (api/_lib/facture-autres.js, avec le vrai compteur de api/_lib/facture-pro.js)
// contre une fausse base qui sert la forme RÉELLE mesurée le 10 nov. :
//   · `lbc_ventes.data.ventes` = { [txId]: { txId, price (centimes), prixListe,
//     dateVente, title, account, isSeller, stepStatus } } ;
//   · `vc_ventes.data.ventes` = { [productId]: { montant:{valeur,devise,cle:'sellerEarning'} … } } ;
//   · `ebay_orders*.data.orders` = commandes de l'API Fulfillment (forme documentée,
//     jamais vue en base : 0 commande).
// Aucune donnée réelle : acheteurs, SIRET (clé de Luhn calculée), n° inventés.
//
//   S1-S3  la règle par plateforme (prix, date, côté, annulée, devise, plusieurs articles) ;
//   S4     la route : le prix et la date viennent de la vente relue par le serveur
//          (jamais du navigateur) ; acheteur absent ⇒ rien numéroté ; lecture ratée ⇒
//          503 et rien numéroté ; Vestiaire ⇒ refus ; deux commandes au même n° ⇒ rien ;
//   S5     la MÊME suite que Vinted : après FA-…-0005 (Vinted), la suivante est 0006 ;
//          la même vente re-cliquée garde son numéro ; deux ventes, deux numéros ;
//   S6     50 ventes identiques (titre, prix, minute) : chaque facture porte SA vente ;
//   S7     la règle d'annulation Leboncoin est celle de l'app, au caractère près ;
//   S8     rien ne part par e-mail ; l'app ne montre la facture que sur une VENTE prouvée.
'use strict';
const path = require('path');
const fs = require('fs');
const racine = path.resolve(process.argv[2] || path.join(__dirname, '..'));

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const lire = (f) => { try { return fs.readFileSync(path.join(racine, f), 'utf8'); } catch (_) { return ''; } };

const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = (() => { for (let k = 0; k < 10; k++) if (luhn('90012345' + k)) return '90012345' + k; })();
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();

// ── La fausse base (forme PostgREST) ────────────────────────────────────────
const A = '11111111-1111-4111-8111-111111111111';
let base = new Map(); const pannes = new Set(); const ecritures = [];
const cle = (o, i) => `${o}|${i}`;
const val = (data, chemin) => { let v = { data }; for (const seg of chemin.split(/->>?/)) v = v == null ? undefined : v[seg]; return v; };
const contient = (a, b) => (Array.isArray(b) ? Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x))) : b && typeof b === 'object' ? a && typeof a === 'object' && Object.entries(b).every(([k, v]) => contient(a[k], v)) : a === b);
global.fetch = async (u, o = {}) => {
  const url = new URL(u); const methode = (o.method || 'GET').toUpperCase();
  const rep = (code, corps) => ({ ok: code >= 200 && code < 300, status: code, json: async () => corps, text: async () => JSON.stringify(corps) });
  if (!url.pathname.endsWith('/rest/v1/app_data')) return rep(404, {});
  const q = url.searchParams; const owner = (q.get('owner') || '').replace(/^eq\./, ''); const idq = q.get('id') || '';
  const autres = [...q.entries()].filter(([k]) => !['id', 'owner', 'select'].includes(k));
  if (methode === 'GET') {
    if (!owner) return rep(400, { message: 'lecture sans vendeur' });
    const re = idq.startsWith('like.') ? new RegExp('^' + idq.slice(5).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$') : null;
    const id = idq.replace(/^eq\./, '');
    if (pannes.has(re ? 'like:' + idq.slice(5) : id)) return rep(522, '<html>');
    let lignes = [...base.entries()].filter(([k]) => k.startsWith(owner + '|')).map(([k, d]) => ({ id: k.slice(owner.length + 1), data: d }))
      .filter((r) => (re ? re.test(r.id) : r.id === id));
    for (const [k, v] of autres) {
      const m = /^(eq|cs)\.(.*)$/.exec(v); if (!m || !/^data(->>?[A-Za-z_]+)+$/.test(k)) throw new Error('filtre inconnu du banc : ' + k + '=' + v);
      lignes = lignes.filter((r) => (m[1] === 'eq' ? String(val(r.data, k)) === m[2] : contient(val(r.data, k), JSON.parse(m[2]))));
    }
    const sel = (q.get('select') || 'data').split(',');
    return rep(200, lignes.map((r) => Object.fromEntries(sel.map((x) => { const [al, src] = x.includes(':') ? x.split(':') : [x, x]; if (src === 'id') return [al, r.id]; if (src === 'data') return [al, r.data]; const v = val(r.data, src); return [al, v === undefined ? null : v]; }))));
  }
  if (methode === 'POST') {
    const l = JSON.parse(o.body)[0]; if (!l.owner) return rep(400, {});
    if (pannes.has('post:' + l.id)) return rep(503, {});
    if (base.has(cle(l.owner, l.id))) return rep(409, {});
    base.set(cle(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); ecritures.push(l.id); return rep(201, null);
  }
  if (methode === 'PATCH') {
    const id = idq.replace(/^eq\./, ''); const k = cle(owner, id);
    if (!base.has(k)) return rep(200, []);
    const d = base.get(k);
    for (const [f, v] of autres) {
      if (f === 'data->>n' && String(d && d.n) !== v.replace(/^eq\./, '')) return rep(200, []);
      if (f === 'data' && JSON.stringify(d) !== v.replace(/^eq\./, '')) return rep(200, []);
    }
    base.set(k, JSON.parse(o.body).data); ecritures.push(id); return rep(200, [{ id }]);
  }
  return rep(405, {});
};
const faireRes = () => { const r = { code: 0, corps: null }; r.status = (c) => { r.code = c; return { json: (j) => { r.corps = j; return r; } }; }; return r; };

(async () => {
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  let S, R;
  try { S = await import(path.join(racine, 'src/facturePro/sources.js')); R = await import(path.join(racine, 'api/_lib/facture-autres.js')); }
  catch (e) { dit(false, 'les modules de la facture des autres sites existent', e.message.split('\n')[0]); console.log(`\n${ok} vert(s), ${ko} rouge(s)`); process.exit(1); }

  // ── S1 LEBONCOIN ─────────────────────────────────────────────────────────
  const lbc = (tx, x = {}) => ({ txId: String(tx), title: 'Nike Dunk banc - 42', price: 2500, prixListe: 2928, dateVente: '2026-11-03T10:12:00.000Z', account: 'compte_banc', isSeller: true, stepStatus: 'done', ...x });
  let v = S.venteLbc(lbc(123456789));
  dit(v.ok && v.centimes === 2500 && v.ref === '123456789' && v.venteLe === '2026-11-03T10:12:00.000Z', 'S1 Leboncoin : prix de la vente (centimes, pas prixListe), date et n° lus', JSON.stringify(v));
  dit(!S.venteLbc(lbc(1234567, { isSeller: undefined })).ok, 'S1 côté pas su (isSeller absent) ⇒ pas de facture');
  dit(!S.venteLbc(lbc(1234567, { isSeller: false })).ok, 'S1 un ACHAT ⇒ pas de facture');
  dit(S.venteLbc(lbc(1234567, { stepStatus: 'cancelled' })).code === 'annulee', 'S1 vente annulée ⇒ pas de facture');
  dit(S.venteLbc(lbc(1234567, { price: undefined })).code === 'prix', 'S1 prix absent ⇒ pas de facture, même avec prixListe (frais et port compris)');
  dit(S.venteLbc(lbc(1234567, { price: '25.00' })).code === 'prix', 'S1 prix illisible ⇒ pas de facture (jamais deviné)');
  dit(S.venteLbc(lbc(1234567, { dateVente: '' })).code === 'date', 'S1 vente pas datée ⇒ pas de facture');
  dit(S.venteLbc(lbc('abc')).code === 'ref', 'S1 sans n° de transaction ⇒ pas de facture');
  dit(S.venteLbc(lbc(1234567)).acheteurPropose === null, 'S1 Leboncoin ne propose aucun acheteur (il ne le donne pas)');

  // ── S2 EBAY ──────────────────────────────────────────────────────────────
  const eb = (id, x = {}) => ({ orderId: id, creationDate: '2026-11-04T09:00:00.000Z', orderPaymentStatus: 'PAID', lineItems: [{ title: 'Adidas Samba banc', quantity: 1, lineItemCost: { value: '80.00', currency: 'EUR' } }],
    pricingSummary: { total: { value: '89.90', currency: 'EUR' } }, buyer: { username: 'pseudo_banc', buyerRegistrationAddress: { fullName: 'Jean Banc', contactAddress: { addressLine1: '3 rue Fictive', city: 'Lyon', postalCode: '69001', countryCode: 'FR' } } }, ...x });
  v = S.venteEbay(eb('12-34567-89012'));
  dit(v.ok && v.centimes === 8000 && v.acheteurPropose && v.acheteurPropose.nom === 'Jean Banc' && /69001 Lyon/.test(v.acheteurPropose.adresse), 'S2 eBay : prix de l’article (sans le port), acheteur de CETTE commande proposé', JSON.stringify(v));
  dit(S.venteEbay(eb('12-34567-89012', { lineItems: [{ title: 'x', quantity: 1, lineItemCost: { value: '80.00', currency: 'GBP' } }] })).code === 'devise', 'S2 commande en GBP ⇒ pas de facture (VRM reste en euros, jamais converti)');
  dit(S.venteEbay(eb('12-34567-89012', { lineItems: [{ title: 'a', quantity: 1, lineItemCost: { value: '1', currency: 'EUR' } }, { title: 'b', quantity: 1, lineItemCost: { value: '1', currency: 'EUR' } }] })).code === 'articles', 'S2 plusieurs articles ⇒ pas de facture (dit)');
  dit(S.venteEbay(eb('12-34567-89012', { orderPaymentStatus: 'PENDING' })).code === 'paiement', 'S2 pas encore payée ⇒ pas de facture');
  dit(S.venteEbay(eb('12-34567-89012', { cancelStatus: { cancelState: 'CANCELED' } })).code === 'annulee', 'S2 annulée ⇒ pas de facture');
  dit(S.venteEbay(eb('12-34567-89012', { buyer: { username: 'x' } })).acheteurPropose === null, 'S2 acheteur absent de la commande ⇒ rien proposé (jamais inventé)');

  // ── S3 VESTIAIRE ─────────────────────────────────────────────────────────
  v = S.venteVc({ montant: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' }, date: '2026-11-01T10:00:00Z', titre: 'Sac banc' });
  dit(!v.ok && v.code === 'prix', 'S3 Vestiaire : ce que Vestiaire verse n’est pas le prix payé ⇒ pas de facture, dit', JSON.stringify(v));

  // ── S4/S5 LA ROUTE ───────────────────────────────────────────────────────
  // (11 nov., lot DJ1) Les comptes qu'il a dits professionnels (src/facturePro/comptes.js).
  const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', comptesFacture: { 'leboncoin:compte_banc': true, 'ebay:principal': true, 'ebay:abcdef0123456789': true } };
  const annee = new Date().getFullYear();
  const raz = () => { base = new Map(); pannes.clear(); ecritures.length = 0;
    base.set(cle(A, 'vrm_pro_facture'), CFG);
    base.set(cle(A, 'vrm_invoice_counter'), { n: 5, journal: [{ n: 5, cle: 'tx9999999', at: '2026-11-01T00:00:00Z' }] });   // FA-…-0005 : une facture VINTED
  };
  const appel = async (corps) => { const r = faireRes(); await R.routeFactureAutre({ method: 'POST' }, r, { vendeur: { id: A }, corps, acces: true, cloisonnee: true }); return r; };
  const ACH = { nom: 'Lucie Banc', adresse: '5 avenue Imaginaire\n13001 Marseille' };
  const compteur = () => (base.get(cle(A, 'vrm_invoice_counter')) || {}).n;

  raz();
  base.set(cle(A, 'lbc_ventes'), { ventes: { 123456789: lbc(123456789), 223456789: lbc(223456789, { price: 4500, title: 'Autre banc' }) }, updatedAt: '2026-11-04' });
  let r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '123456789', acheteur: ACH, centimes: 1, prix: '0.01', venteLe: '2020-01-01' });
  const f1 = r.corps && r.corps.facture;
  dit(r.code === 200 && f1 && f1.numero === `FA-${annee}-0006`, 'S5 la facture Leboncoin prend le n° SUIVANT de la suite Vinted (0005 ⇒ 0006)', JSON.stringify(r.corps));
  dit(f1 && f1.contenu && f1.contenu.totaux.ttc === 2500 && f1.contenu.venteJour === '03/11/2026', 'S4 prix et date = la vente relue par le serveur (le prix envoyé par le navigateur est ignoré)', f1 && JSON.stringify(f1.contenu && f1.contenu.totaux));
  dit(f1 && f1.contenu && /Leboncoin n° 123456789/.test(f1.contenu.reference) && f1.contenu.acheteur.nom === 'Lucie Banc' && !f1.contenu.acheteur.email, 'S4 la facture porte la référence Leboncoin et l’acheteur recopié, sans e-mail');
  const ligne1 = base.get(cle(A, 'email_invoice_lbc123456789'));
  dit(ligne1 && ligne1.acheteurSource === 'saisi' && ligne1.plateforme === 'leboncoin', 'S4 rangée comme déclaration du vendeur (acheteurSource: saisi)');
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '123456789', acheteur: { nom: 'Autre', adresse: '1 rue X\n75001 Paris' } });
  dit(r.code === 200 && r.corps.deja && r.corps.facture.numero === `FA-${annee}-0006` && compteur() === 6, 'S5 la même vente re-cliquée garde SON numéro (aucun numéro brûlé)');
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '223456789', acheteur: ACH });
  dit(r.code === 200 && r.corps.facture.numero === `FA-${annee}-0007` && r.corps.facture.contenu.totaux.ttc === 4500, 'S5 une autre vente, le numéro suivant (0007), son propre prix');

  // Refus : rien numéroté
  const avant = compteur();
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '323456789', acheteur: ACH });
  dit(r.code === 409 && compteur() === avant, 'S4 vente pas lue ⇒ 409, aucun numéro pris');
  base.get(cle(A, 'lbc_ventes')).ventes['423456789'] = lbc(423456789);
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '423456789', acheteur: { nom: '', adresse: '' } });
  dit(r.code === 409 && r.corps.erreur === 'incomplet' && compteur() === avant, 'S4 acheteur pas recopié ⇒ 409 avec la liste, aucun numéro pris');
  base.get(cle(A, 'lbc_ventes')).ventes['523456789'] = lbc(623456789);
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '523456789', acheteur: ACH });
  dit(r.code === 409 && compteur() === avant, 'S4 la clé et le n° porté disent deux ventes ⇒ rien (identité, §5)');
  base.get(cle(A, 'lbc_ventes')).ventes['723456789'] = lbc(723456789, { stepStatus: 'cancelled' });
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '723456789', acheteur: ACH });
  dit(r.code === 409 && r.corps.code === 'annulee' && compteur() === avant, 'S4 vente annulée ⇒ refus, aucun numéro');
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '423456789', acheteur: { nom: 'Lucie Banc', adresse: 'Marseille' } });
  dit(r.code === 409 && r.corps.erreur === 'incomplet' && compteur() === avant, 'S4 adresse sans rue ni code postal ⇒ 409, aucun numéro pris');
  // L'écriture de la facture échoue APRÈS le numéro pris : le clic suivant reprend LE MÊME numéro (journal).
  pannes.add('post:email_invoice_lbc423456789');
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '423456789', acheteur: ACH });
  const pris = compteur();
  pannes.delete('post:email_invoice_lbc423456789');
  const r2 = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '423456789', acheteur: ACH });
  dit(r.code === 503 && pris === avant + 1 && r2.code === 200 && r2.corps.facture.numero === `FA-${annee}-${String(pris).padStart(4, '0')}` && compteur() === pris, 'S5 écriture ratée après le numéro : le clic suivant garde CE numéro (aucun trou)', `${r.code} ${pris} ${r2.code} ${r2.corps && r2.corps.facture && r2.corps.facture.numero}`);
  const avantB = compteur();
  base.get(cle(A, 'lbc_ventes')).ventes['923456789'] = lbc(923456789);
  pannes.add('lbc_ventes');
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '923456789', acheteur: ACH });
  dit(r.code === 503 && compteur() === avantB && !base.has(cle(A, 'email_invoice_lbc923456789')), 'S4 lecture des ventes ratée ⇒ 503, RIEN numéroté (pas su ≠ absente)');
  pannes.clear();
  r = await appel({ action: 'emettre', plateforme: 'leboncoin', ref: '923456789', acheteur: ACH });
  dit(r.code === 400 && compteur() === avantB, 'S4 sans confirmation ⇒ rien');

  // eBay
  base.set(cle(A, 'ebay_orders'), { orders: [eb('12-34567-89012')], complet: true });
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'ebay', ref: '12-34567-89012', acheteur: { nom: 'Jean Banc', adresse: '3 rue Fictive\n69001 Lyon' } });
  dit(r.code === 200 && r.corps.facture.numero === `FA-${annee}-0009` && r.corps.facture.contenu.totaux.ttc === 8000 && /eBay n° 12-34567-89012/.test(r.corps.facture.contenu.reference), 'S4 eBay : numéro suivant, prix de l’article relu', JSON.stringify(r.corps).slice(0, 300));
  base.set(cle(A, 'ebay_orders_abcdef0123456789'), { orders: [eb('99-00000-00001')] });
  base.get(cle(A, 'ebay_orders')).orders.push(eb('99-00000-00001'));
  const av2 = compteur();
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'ebay', ref: '99-00000-00001', acheteur: ACH });
  dit(r.code === 409 && r.corps.erreur === 'double' && compteur() === av2, 'S4 deux commandes au même n° (deux comptes) ⇒ rien');
  base.get(cle(A, 'ebay_orders')).orders.push(eb('77-00000-00001', { lineItems: [{ title: 'x', quantity: 1, lineItemCost: { value: '50.00', currency: 'USD' } }] }));
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'ebay', ref: '77-00000-00001', acheteur: ACH });
  dit(r.code === 409 && r.corps.code === 'devise' && compteur() === av2, 'S4 commande en dollars ⇒ refus, aucun numéro');

  // Vestiaire
  base.set(cle(A, 'vc_ventes'), { ventes: { 72987282: { productId: '72987282', montant: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' }, date: '2026-11-01T10:00:00Z', titre: 'Sac banc' } } });
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'vestiaire', ref: '72987282', acheteur: ACH });
  dit(r.code === 409 && r.corps.code === 'prix' && compteur() === av2, 'S4 Vestiaire ⇒ refus (prix payé inconnu), aucun numéro');

  // ── S6 50 VENTES IDENTIQUES ─────────────────────────────────────────────
  raz();
  const ventes = {}; for (let i = 0; i < 50; i++) { const tx = String(800000000 + i); ventes[tx] = lbc(tx, { price: 3000 }); }
  base.set(cle(A, 'lbc_ventes'), { ventes });
  let bons = 0;
  for (const k of [7, 23, 41]) {
    const tx = String(800000000 + k);
    r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: tx, acheteur: ACH });
    const ids = [...base.keys()].filter((x) => /email_invoice_lbc/.test(x));
    if (r.code === 200 && r.corps.facture.contenu.reference === `Leboncoin n° ${tx}` && base.has(cle(A, 'email_invoice_lbc' + tx))) bons++;
    void ids;
  }
  dit(bons === 3 && [...base.keys()].filter((x) => /email_invoice_lbc/.test(x)).length === 3, 'S6 50 ventes identiques : chaque facture porte SA vente, aucune autre n’est touchée');

  // ── S9 LE REGISTRE (lot Q) VOIT CES FACTURES, SANS FAUX TROU ───────────
  try {
    const reg = await import(path.join(racine, 'src/facturePro/registre.js'));
    raz();
    base.set(cle(A, 'lbc_ventes'), { ventes: { 123456789: lbc(123456789) } });
    base.set(cle(A, 'email_invoice_tx9999999'), { type: 'facture_pro', number: `FA-${annee}-0005`, emiseLe: '2026-11-01T00:00:00Z', contenu: { totaux: { ttc: 100 } }, transaction: '9999999' });
    for (let n = 1; n <= 4; n++) base.set(cle(A, 'email_invoice_txv' + n), { type: 'facture_pro', number: `FA-${annee}-000${n}`, emiseLe: '2026-11-01T00:00:00Z', transaction: 'v' + n });
    await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '123456789', acheteur: ACH });
    const rows = [...base.entries()].filter(([k]) => /\|email_invoice_/.test(k)).map(([k, d]) => ({ id: k.split('|')[1], numero: d.number, type: d.type, emiseLe: d.emiseLe, ttc: d.contenu && d.contenu.totaux ? d.contenu.totaux.ttc : null }));
    const lignes = reg.lignesRegistre(rows);
    const t = reg.trousNumerotation(rows);
    dit(lignes.some((l) => l.id === 'email_invoice_lbc123456789' && l.numero === `FA-${annee}-0006` && l.ttc === 2500) && t.facture.max === 6 && !t.facture.manquants.length, 'S9 le registre d’Argent → Factures porte la facture Leboncoin, la suite 1…6 sans trou');
  } catch (e) { dit(false, 'S9 le registre (lot Q) se lit', e.message); }

  // ── S7 LA RÈGLE D'ANNULATION = CELLE DE L'APP ───────────────────────────
  const regleApp = (lire('api/_lib/ventes-regle.js').match(/export const lbcAnnulee = (.*);/) || [])[1];
  const regleIci = (lire('src/facturePro/sources.js').match(/export const lbcAnnuleeFacture = (.*);/) || [])[1];
  dit(!!regleApp && regleApp === regleIci, 'S7 « annulée » (Leboncoin) : la même règle que l’app, au caractère près');

  // ── S8 RIEN NE PART PAR E-MAIL ; LA FACTURE SUR UNE VENTE PROUVÉE ───────
  const srv = lire('api/_lib/facture-autres.js').replace(/\/\/.*$/gm, '');
  dit(srv && !/smtp|envoyerSmtp|relances-essai/i.test(srv), 'S8 la route des autres sites n’envoie aucun e-mail (aucun SMTP importé)');
  const app = lire('src/App.jsx');
  dit(/suite=\{o\.isSeller === true \? <FactureAutreVente plateforme="leboncoin"/.test(app), 'S8 Leboncoin : la facture n’apparaît que sur une VENTE prouvée (isSeller === true)');
  dit(/mode === 'facture-autre'/.test(lire('api/compte.js')), 'S8 la route est servie par api/compte.js (aucune fonction api/ de plus)');
  const nApi = fs.readdirSync(path.join(racine, 'api')).filter((f) => f.endsWith('.js')).length;
  dit(nApi <= 12, `S8 ${nApi} fonctions api/ (12 au plus)`);

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
