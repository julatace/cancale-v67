// ════════════════════════════════════════════════════════════════════════════
// AUDIT DE LA TVA SUR MARGE (11 nov. 2026, lot tva-marge) — lecture seule.
// Demande validée par Julien : la TVA sur marge (biens d'occasion, CGI art. 297 A)
// pour les revendeurs assujettis. Ce contrôle EXÉCUTE la règle (src/tvaMarge.js,
// src/facturePro/regle.js) et la route des factures des autres sites
// (api/_lib/facture-autres.js) sur une fausse base PostgREST.
//
//  M  le calcul, vente par vente : marge = vente − achat de CETTE paire,
//     TVA = marge × 20/120 arrondie PAR VENTE, perte ⇒ 0 jamais imputée, sans
//     prix d'achat ⇒ exclue et NOMMÉE (jamais 0), total « pas complet » ;
//     période mois/trimestre à l'heure de Paris ; CSV = les mêmes chiffres.
//  S  chaque règle porte sa source (CGI, BOFiP) et la mention « à vérifier ».
//  F  facture en marge : la mention « Régime particulier – Biens d'occasion »,
//     aucune TVA apparente ; l'inverse est REFUSÉ (contenu, aperçu, serveur
//     AVANT le numéro) ; franchise et TVA classique inchangées.
//  P  la publication : seulement pour « marge » (sinon retirée), prix d'achat par
//     identité, prix de vente eBay/Vestiaire par la règle des factures (jamais
//     l'argent reçu) ; la carte ne se montre qu'en marge ; jamais « encaissé ».
//
//  `--prouve` : chaque mutation de la règle doit rendre l'audit ROUGE.
//  Usage : node scripts/audit-tva-marge.cjs [racine] [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const args = process.argv.slice(2);
const PROUVE = args.includes('--prouve');
const racine = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..'));

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + String(d).slice(0, 600) : '')); } };
const lire = (f) => { try { return fs.readFileSync(path.join(racine, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const imp = (f) => import(pathToFileURL(path.join(racine, f)).href);

const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = (() => { for (let k = 0; k < 10; k++) if (luhn('90012345' + k)) return '90012345' + k; })();
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();

// ── La fausse base (forme PostgREST, comme audit-factures-autres) ──────────
const A = '11111111-1111-4111-8111-111111111111';
let base = new Map();
const cle = (o, i) => `${o}|${i}`;
const val = (data, chemin) => { let v = { data }; for (const seg of chemin.split(/->>?/)) v = v == null ? undefined : v[seg]; return v; };
global.fetch = async (u, o = {}) => {
  const url = new URL(u); const methode = (o.method || 'GET').toUpperCase();
  const rep = (code, corps) => ({ ok: code >= 200 && code < 300, status: code, json: async () => corps, text: async () => JSON.stringify(corps) });
  if (!url.pathname.endsWith('/rest/v1/app_data')) return rep(404, {});
  const q = url.searchParams; const owner = (q.get('owner') || '').replace(/^eq\./, ''); const idq = q.get('id') || '';
  const autres = [...q.entries()].filter(([k]) => !['id', 'owner', 'select'].includes(k));
  if (methode === 'GET') {
    const re = idq.startsWith('like.') ? new RegExp('^' + idq.slice(5).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$') : null;
    const id = idq.replace(/^eq\./, '');
    let lignes = [...base.entries()].filter(([k]) => k.startsWith(owner + '|')).map(([k, d]) => ({ id: k.slice(owner.length + 1), data: d })).filter((r) => (re ? re.test(r.id) : r.id === id));
    for (const [k, v] of autres) { const m = /^(eq)\.(.*)$/.exec(v); if (m) lignes = lignes.filter((r) => String(val(r.data, k)) === m[2]); }
    const sel = (q.get('select') || 'data').split(',');
    return rep(200, lignes.map((r) => Object.fromEntries(sel.map((x) => { const [al, src] = x.includes(':') ? x.split(':') : [x, x]; if (src === 'id') return [al, r.id]; if (src === 'data') return [al, r.data]; const vv = val(r.data, src); return [al, vv === undefined ? null : vv]; }))));
  }
  if (methode === 'POST') {
    const l = JSON.parse(o.body)[0]; if (base.has(cle(l.owner, l.id))) return rep(409, {});
    base.set(cle(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); return rep(201, null);
  }
  if (methode === 'PATCH') {
    const id = idq.replace(/^eq\./, ''); const k = cle(owner, id);
    if (!base.has(k)) return rep(200, []);
    const d = base.get(k);
    for (const [f, v] of autres) {
      if (f === 'data->>n' && String(d && d.n) !== v.replace(/^eq\./, '')) return rep(200, []);
      if (f === 'data' && JSON.stringify(d) !== v.replace(/^eq\./, '')) return rep(200, []);
    }
    base.set(k, JSON.parse(o.body).data); return rep(200, [{ id }]);
  }
  return rep(405, {});
};
const faireRes = () => { const r = { code: 0, corps: null }; r.status = (c) => { r.code = c; return { json: (j) => { r.corps = j; return r; } }; }; return r; };

async function principal() {
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  let T, R, S, FA;
  try { T = await imp('src/tvaMarge.js'); R = await imp('src/facturePro/regle.js'); S = await imp('src/facturePro/sources.js'); FA = await imp('api/_lib/facture-autres.js'); }
  catch (e) { dit(false, 'les modules de la TVA sur marge existent', e.message.split('\n')[0]); return; }
  if (typeof T.venteMarge !== 'function' || typeof R.tvaApparente !== 'function' || typeof R.refusMarge !== 'function') { dit(false, 'venteMarge, tvaApparente et refusMarge existent'); return; }

  // ── M. LE CALCUL ──────────────────────────────────────────────────────────
  console.log('── M. le calcul, vente par vente');
  const ts = (iso) => Date.parse(iso);
  const L = (id, prixC, achatC, iso = '2026-10-10T12:00:00Z', x = {}) => ({ id, plateforme: 'Vinted', titre: 'Nike Dunk banc', num: id.replace(/\D/g, ''), ts: ts(iso), prixC, achatC, ...x });
  let v = T.venteMarge(L('v1', 12000, 6000));
  dit(v.etat === 'ok' && v.margeC === 6000 && v.tvaC === 1000 && v.baseC === 5000, 'M1 120 € − 60 € ⇒ marge 60 €, TVA 10,00 € (20/120), base 50,00 €', JSON.stringify(v));
  v = T.venteMarge(L('v2', 5000, 7000));
  dit(v.etat === 'perte' && v.tvaC === 0 && v.baseC === 0, 'M2 vente à perte ⇒ TVA 0 sur cette vente', JSON.stringify(v));
  v = T.venteMarge(L('v3', 9000, null));
  dit(v.etat === 'achat' && v.tvaC === null && v.margeC === null, 'M3 sans prix d’achat ⇒ « — » (null), jamais une marge = prix de vente', JSON.stringify(v));
  v = T.venteMarge(L('v4', null, 4000));
  dit(v.etat === 'prix' && v.tvaC === null, 'M4 prix de vente pas lu ⇒ exclue', JSON.stringify(v));
  let d = T.declarationMarge([L('a', 12000, 6000), L('b', 5000, 7000), L('c', 9000, null)], '2026-10');
  dit(d.tvaC === 1000 && d.baseC === 5000 && d.nPertes === 1 && d.perteC === 2000, 'M5 la perte de 20 € ne se retire PAS des autres ventes (TVA 10,00 €, pas 6,67 €)', JSON.stringify({ tva: d.tvaC, base: d.baseC, p: d.perteC }));
  dit(!d.complet && d.aCompleter.length === 1 && d.aCompleter[0].id === 'c' && d.nComptees === 2, 'M6 la vente sans prix d’achat est NOMMÉE à part, le total n’est pas « complet »', JSON.stringify({ c: d.complet, a: d.aCompleter.map((x) => x.id) }));
  d = T.declarationMarge([L('r1', 200, 100), L('r2', 200, 100), L('r3', 200, 100)], '2026-10');
  dit(d.tvaC === 51, 'M7 arrondi au centime VENTE PAR VENTE (3 × 0,17 € = 0,51 €, pas 0,50 €)', String(d.tvaC));
  const minuitParis = ts('2026-10-31T23:30:00Z');       // 1er novembre, 0 h 30 à Paris
  dit(T.moisParis(minuitParis) === '2026-11' && T.trimestreDe('2026-11') === '2026-T4', 'M8 le mois et le trimestre à l’heure de Paris');
  d = T.declarationMarge([L('t1', 12000, 6000, '2026-10-02T10:00:00Z'), L('t2', 12000, 6000, '2026-12-20T10:00:00Z'), L('t3', 12000, 6000, '2027-01-02T10:00:00Z')], '2026-T4');
  dit(d.n === 2 && d.tvaC === 2000, 'M9 le trimestre T4 2026 prend octobre et décembre, pas janvier 2027', JSON.stringify({ n: d.n, tva: d.tvaC }));
  const sansDate = T.aDaterMarge([L('z', 12000, 6000, 'pas une date')]);
  dit(sansDate.length === 1 && T.declarationMarge([L('z', 12000, 6000, 'pas une date')], '2026-10').n === 0, 'M10 sans date : dans AUCUNE période, dite à part');
  d = T.declarationMarge([L('a', 12000, 6000), L('b', 5000, 7000), L('c', 9000, null)], '2026-10');
  const csv = T.csvDeclarationMarge(d);
  dit(csv.includes('"10,00"') && csv.includes('"50,00"') && /exclue : prix d'achat/.test(csv) && /perte/.test(csv) && csv.includes(T.A_VERIFIER), 'M11 le CSV porte les MÊMES chiffres (TVA 10,00, base 50,00), l’exclue et sa raison, la mention « à vérifier »');

  // ── S. LES SOURCES ───────────────────────────────────────────────────────
  console.log('── S. chaque règle a sa source');
  dit(Array.isArray(T.SOURCES_TVA_MARGE) && T.SOURCES_TVA_MARGE.length >= 6 && T.SOURCES_TVA_MARGE.every((s) => /CGI|BOI-/.test(s.ref)), 'S1 chaque règle porte sa référence (CGI, BOFiP)');
  dit(/vérifier/.test(T.A_VERIFIER || '') && ['base', 'negative', 'facture'].every((k) => T.SOURCES_TVA_MARGE.some((s) => s.cle === k)), 'S2 « à vérifier » dit (pages officielles pas lues) ; base, perte et facture sourcées');
  const carte = sansCommentaires(lire('src/TvaMargeCarte.jsx'));
  dit(/data-tva-marge-sources/.test(carte) && /data-tva-marge-verifier/.test(carte) && /SOURCES_TVA_MARGE/.test(carte), 'S3 la carte montre les sources et la mention « à vérifier »');

  // ── F. LES FACTURES ──────────────────────────────────────────────────────
  console.log('── F. facture en marge : aucune TVA apparente');
  const TVA_INTRA = 'FR' + String((12 + 3 * (Number(SIREN) % 97)) % 97).padStart(2, '0') + SIREN;
  const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, tva: TVA_INTRA, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'marge', prefixe: 'FA', comptesFacture: { 'leboncoin:compte_banc': true } };
  const VENTE = { centimes: 12000, venteLe: '2026-11-03T10:12:00.000Z', designation: 'Nike Dunk banc - 42', plateforme: 'Leboncoin', reference: '123456789', acheteur: { nom: 'Lucie Banc', adresse: '5 avenue Imaginaire\n13001 Marseille' } };
  let c = null;
  try { c = R.contenuFacture(CFG, VENTE, { numero: 'FA-2026-0001', emiseLe: Date.now() }); } catch (e) { dit(false, 'F1 une facture en marge conforme se fait', e.message); }
  if (c) {
    dit(c.mentions.includes(R.MENTION_MARGE) && /Régime particulier – Biens d'occasion/.test(R.MENTION_MARGE), 'F1 la mention « Régime particulier – Biens d’occasion » est sur la facture');
    dit(c.totaux.tva === null && c.taux === null && c.totaux.ht === c.totaux.ttc && R.tvaApparente(c) === '', 'F2 aucune TVA apparente (montant, taux, HT distinct)', JSON.stringify(c.totaux));
    dit(!R.mentionsManquantes(c).includes('marge'), 'F3 la liste des mentions obligatoires la dit conforme');
    const mut = (f) => { const x = JSON.parse(JSON.stringify(c)); f(x); return R.tvaApparente(x); };
    dit(!!mut((x) => { x.totaux.tva = 2000; }) && !!mut((x) => { x.taux = 20; }), 'F4 l’inverse est REFUSÉ : un montant ou un taux de TVA');
    dit(!!mut((x) => { x.totaux.ht = 10000; }), 'F5 refusé : un « HT » distinct du total');
    dit(!!mut((x) => { x.lignes[0].tva = 2000; }), 'F6 refusé : une ligne qui porte de la TVA');
    dit(!!mut((x) => { x.mentions = x.mentions.filter((m) => m !== R.MENTION_MARGE); }), 'F7 refusé : la mention « Biens d’occasion » absente');
    dit(!!mut((x) => { x.mentions.push(R.MENTION_FRANCHISE); }), 'F8 refusé : la mention de franchise ajoutée');
    dit(R.mentionsManquantes({ ...c, totaux: { ...c.totaux, tva: 2000 } }).includes('marge'), 'F9 une TVA apparente rend la facture non conforme dans la liste des mentions');
  }
  let leve = null;
  try { R.contenuFacture({ ...CFG, note: 'Prix TTC, TVA 20 % incluse' }, VENTE, { numero: 'FA-2026-0001', emiseLe: Date.now() }); } catch (e) { leve = e; }
  dit(leve && leve.code === 'tva_apparente', 'F10 une note « TVA 20 % / TTC » en marge : la facture n’est PAS produite (code tva_apparente)', leve ? leve.message : 'produite');
  dit(!!R.refusMarge({ ...CFG, note: 'Prix TTC' }, VENTE) && R.refusMarge(CFG, VENTE) === '', 'F11 l’essai à blanc (`refusMarge`) dit la raison, et rien pour une facture conforme');
  let cn = null, cf = null;
  try { cn = R.contenuFacture({ ...CFG, tva_regime: 'normal', tva_taux: 20, note: 'Prix TTC' }, VENTE, { numero: 'FA-2026-0001', emiseLe: Date.now() }); } catch (_) {}
  try { cf = R.contenuFacture({ ...CFG, tva_regime: 'franchise' }, VENTE, { numero: 'FA-2026-0001', emiseLe: Date.now() }); } catch (_) {}
  dit(cn && cn.totaux.tva === 2000 && R.refusMarge({ ...CFG, tva_regime: 'normal', tva_taux: 20 }, VENTE) === '', 'F12 TVA classique inchangée (TVA 20,00 € sur 120 €)', JSON.stringify(cn && cn.totaux));
  dit(cf && cf.mentions.includes(R.MENTION_FRANCHISE) && !cf.mentions.includes(R.MENTION_MARGE), 'F13 franchise inchangée (mention 293 B, pas de « Biens d’occasion »)');

  // La route EXÉCUTÉE : refusée AVANT le numéro (aucun numéro pris), puis émise conforme.
  const lbc = (tx) => ({ txId: String(tx), title: 'Nike Dunk banc - 42', price: 12000, dateVente: '2026-11-03T10:12:00.000Z', account: 'compte_banc', isSeller: true, stepStatus: 'done' });
  const raz = (cfg) => { base = new Map(); base.set(cle(A, 'vrm_pro_facture'), cfg); base.set(cle(A, 'vrm_invoice_counter'), { n: 5, journal: [] }); base.set(cle(A, 'lbc_ventes'), { ventes: { 123456789: lbc(123456789) }, updatedAt: '2026-11-04' }); };
  const appel = async (corps) => { const r = faireRes(); await FA.routeFactureAutre({ method: 'POST' }, r, { vendeur: { id: A }, corps, acces: true, cloisonnee: true }); return r; };
  const ACH = { nom: 'Lucie Banc', adresse: '5 avenue Imaginaire\n13001 Marseille' };
  raz({ ...CFG, note: 'Prix TTC' });
  let r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '123456789', acheteur: ACH });
  dit(r.code === 409 && r.corps && r.corps.erreur === 'tva-apparente' && base.get(cle(A, 'vrm_invoice_counter')).n === 5 && ![...base.keys()].some((k) => /email_invoice/.test(k)), 'F14 serveur (exécuté) : TVA apparente en marge ⇒ 409, AUCUN numéro pris, rien écrit', JSON.stringify(r.corps));
  raz(CFG);
  r = await appel({ action: 'emettre', confirme: true, plateforme: 'leboncoin', ref: '123456789', acheteur: ACH });
  const ecrite = [...base.entries()].find(([k]) => /email_invoice/.test(k));
  const ct = ecrite && ecrite[1] && (ecrite[1].contenu || ecrite[1].instantane || ecrite[1]);
  const json = JSON.stringify(ecrite ? ecrite[1] : {});
  dit(r.code === 200 && base.get(cle(A, 'vrm_invoice_counter')).n === 6 && json.includes('Biens d') && !/"tva":\d/.test(json), 'F15 serveur (exécuté) : la facture en marge est émise, mention « Biens d’occasion », aucun montant de TVA', `${r.code} ${JSON.stringify(r.corps).slice(0, 200)} ${ct ? '' : 'pas de ligne'}`);
  const fp = sansCommentaires(lire('api/_lib/facture-pro.js'));
  const iEm = fp.indexOf('export async function emettre');
  const corpsEm = iEm >= 0 ? fp.slice(iEm, fp.indexOf('\nexport ', iEm + 10) > 0 ? fp.indexOf('\nexport ', iEm + 10) : undefined) : '';
  const iR = corpsEm.search(/refusMarge\(\s*cfg/), iN = corpsEm.search(/prendreNumero\(/);
  dit(iR > 0 && iN > 0 && iR < iN, 'F16 factures Vinted (api/_lib/facture-pro.js) : le refus passe AVANT `prendreNumero`');
  const fpx = sansCommentaires(lire('src/FacturePro.jsx'));
  dit(/refusMarge\(\s*cfg\s*,\s*exemple\s*\)/.test(fpx) && /data-fp-refus-tva/.test(fpx), 'F17 Ma facture DIT la raison du refus (l’aperçu ne disparaît pas sans un mot)');

  // ── P. LA PUBLICATION ET LA CARTE ────────────────────────────────────────
  console.log('── P. la publication et la carte');
  const store = new Map();
  global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, x) => store.set(k, String(x)), removeItem: (k) => store.delete(k) };
  global.window = { dispatchEvent: () => {} }; global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  T.publierTvaMarge([L('a', 12000, 6000)], { owner: A, partiel: ['ebay'] });
  const lu = T.lireTvaMarge(localStorage.getItem(T.CLE_TVA_MARGE), A);
  dit(lu && lu.lignes.length === 1 && lu.lignes[0].achatC === 6000 && lu.partiel[0] === 'ebay', 'P1 publiée puis relue (prix d’achat, source pas lue dite)');
  dit(T.lireTvaMarge(localStorage.getItem(T.CLE_TVA_MARGE), '22222222-2222-4222-8222-222222222222') === null, 'P2 la publication d’un AUTRE compte VRM n’est jamais lue');
  T.retirerTvaMarge && T.retirerTvaMarge();
  dit(typeof T.retirerTvaMarge === 'function' && localStorage.getItem(T.CLE_TVA_MARGE) === null, 'P3 pas (plus) en marge ⇒ la publication est retirée');
  const app = sansCommentaires(lire('src/App.jsx'));
  const iP = app.indexOf("import('./tvaMarge.js')");
  const bloc = iP > 0 ? app.slice(Math.max(0, iP - 3000), iP + 3500) : '';
  dit(/regimeTvaFiche\(/.test(bloc) && /regime\s*!==\s*'marge'\)\s*\{\s*tm\.retirerTvaMarge\(\)/.test(bloc) && /regime\s*===\s*null\)\s*return/.test(bloc), 'P4 publiée SEULEMENT en régime « marge » ; fiche pas lue ⇒ rien touché ; autre régime ⇒ retirée');
  dit(/effEntry\(l\.o\)/.test(bloc) && /achatDe\(e\)/.test(bloc) && /autresParIdRapport\.get\(id\)/.test(bloc) && !/normTitle|\.titre\s*===/.test(bloc), 'P5 prix d’achat de la paire reliée PAR IDENTITÉ (fiche de la vente, id de la vente), jamais par le titre');
  dit(/venteAutre\('ebay'/.test(bloc) && /venteAutre\('vestiaire'/.test(bloc) && !/(ebay|vestiaire)[^\n]{0,80}prixC\s*=\s*c\(l\.eur\)/.test(bloc), 'P6 eBay et Vestiaire : le prix PAYÉ par l’acheteur (règle des factures), jamais l’argent reçu');
  dit(/if\s*\(!cfg\s*\|\|\s*cfg\.tva_regime\s*!==\s*'marge'\)\s*return null/.test(carte), 'P7 la carte ne se montre qu’en régime « marge » (rien pour les particuliers)');
  const cpt = lire('src/ecrans/Compta.jsx');
  dit(/<TvaMargeCarte\s+deps=\{DEPS_FACTURE\}\s*\/>/.test(cpt), 'P8 la carte est RENDUE dans Argent → Factures');
  const textes = ['src/tvaMarge.js', 'src/tvaMargePdf.js', 'src/TvaMargeCarte.jsx', ...['fr', 'en', 'es', 'it', 'de'].map((l) => `src/i18n/langues/${l}.js`)].map((f) => lire(f)).join('\n');
  const tvm = textes.split('\n').filter((x) => /tvaMarge|TVA sur marge|marge/i.test(x)).join('\n');
  dit(!/encaiss/i.test(tvm), 'P9 jamais « encaissé »');
}

function prouver() {
  const MUT = [
    ['src/tvaMarge.js', 'TAUX_MARGE / (100 + TAUX_MARGE)', 'TAUX_MARGE / 100', 'TVA = marge × 20/100'],
    ['src/tvaMarge.js', "const positives = comptees.filter((v) => v.etat === 'ok');", 'const positives = comptees;', 'perte comptée dans le total'],
    ['src/tvaMarge.js', "Number.isSafeInteger(margeC) && margeC > 0 ?", 'Number.isSafeInteger(margeC) ?', 'perte imputée (TVA négative)'],
    ['src/tvaMarge.js', "if (achatC == null || achatC < 0) return { ...base, etat: 'achat'", "if (false) return { ...base, etat: 'achat'", 'achat absent = 0'],
    ['src/tvaMarge.js', 'Math.round(margeC * TAUX_MARGE', 'Math.floor(margeC * TAUX_MARGE', 'arrondi changé'],
    ['src/facturePro/regle.js', 'if (T.tva != null || c.taux != null) return', 'if (false) return', 'tvaApparente laxiste'],
    ['src/facturePro/regle.js', "if (!mentions.includes(MENTION_MARGE)) return", 'if (false) return', 'mention marge non exigée'],
    ['src/facturePro/regle.js', "if (ta) { const e = new Error(ta);", 'if (false) { const e = new Error(ta);', 'contenuFacture ne lève plus'],
    ['api/_lib/facture-autres.js', 'const rm = refusMarge(cfg, vente);', "const rm = '';", 'refus serveur retiré'],
    ['api/_lib/facture-pro.js', 'const rm = refusMarge(cfg, vente);', "const rm = '';", 'refus Vinted retiré'],
    ['src/TvaMargeCarte.jsx', "if (!cfg || cfg.tva_regime !== 'marge') return null;", 'if (!cfg) return null;', 'carte montrée à tous'],
    ['src/App.jsx', "if (regime !== 'marge') { tm.retirerTvaMarge(); return; }", '', 'publiée pour tous'],
    ['src/App.jsx', "const r = so.venteAutre('ebay', ebayParId.get(id.slice(5))); prixC = r && r.ok ? r.centimes : null;", 'prixC = c(l.eur);', 'eBay au prix reçu'],
  ];
  let bons = 0;
  for (const [f, de, vers, nom] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tvm-'));
    for (const d of ['src', 'api']) fs.cpSync(path.join(racine, d), path.join(tmp, d), { recursive: true });
    fs.copyFileSync(path.join(racine, 'package.json'), path.join(tmp, 'package.json'));
    try { fs.symlinkSync(path.join(racine, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
    const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(de)) { console.log(`❌ mutation « ${nom} » : texte introuvable dans ${f}`); ko++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, s.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename, tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}`);
    if (rouge) bons++; else ko++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n--prouve : ${bons}/${MUT.length} mutations rougissent l'audit`);
}

principal().then(() => {
  console.log(`\n${ko ? '❌' : '✅'} audit-tva-marge : ${ok} verts, ${ko} rouge(s)`);
  if (PROUVE && !ko) { ko = 0; prouver(); if (ko) process.exit(1); }
  process.exit(ko ? 1 : 0);
}).catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
