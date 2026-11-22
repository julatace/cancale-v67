// ════════════════════════════════════════════════════════════════════════════
//  TRANSPORTEURS SUR TOUS LES SITES ET « + DÉPENSE » EN DEUX TOUCHERS — LES RÈGLES, EXÉCUTÉES (21 nov., lot transp-depenses).
//  Récit : docs/passation/2026-11-21-transp-depenses.md. Données INVENTÉES seulement.
//    T  Transporteurs : Vinted, Leboncoin, eBay et Vestiaire par la MÊME règle (`statsTransporteurs`), chaque ligne son
//       site ; identité par le n° exact (un n° partagé ne prouve rien, jamais un titre) ; eBay sans aucun montant (le port
//       n'est ni recette ni charge, §2.8) ; l'arrivée gardée avant le retrait (serveur `arriveeAt` + cet appareil) ; le
//       trajet d'un achat gardé seulement pour l'état lu ; un site pas publié est NOMMÉ, jamais compté à zéro.
//    D  Dépenses : la forme (montant > 0, catégorie connue, jamais une date future) ; une lecture pas faite ou ratée
//       n'écrit RIEN ; une dépense rejouée n'est comptée qu'une fois ; elle entre dans le jour où elle est notée ET dans
//       son mois — une seule fois chacun (la règle des charges de Comptabilité) ; « net du jour » quand une dépense du
//       jour est notée, la mention du mois sinon.
//    S  Une source : l'app publie chaque site par ses lignes, Statistiques réunit, les vues ne calculent rien.
//  Preuve par mutation : `MUTATION=<nom>` réaffaiblit une règle ⇒ rouge (`MUTATION=liste`, `MUTATION=toutes`).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), url = require('url');
const RACINE = process.env.RACINE ? path.resolve(process.env.RACINE) : path.join(__dirname, '..');
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');

const MUTATIONS = {
  ebay_port: ['src/statsTransporteurs.js', (s) => s.replace("return ligneVente({ site: 'ebay', tr: transporteurDuColis({ declare: code }),", "return Object.assign({ port: Number(((o.pricingSummary || {}).deliveryCost || {}).value) || 0 }, ligneVente({ site: 'ebay', tr: transporteurDuColis({ declare: code }),")
    .replace("status: e.kind === 'refunded' ? 'remboursée' : '' });\n}", "status: e.kind === 'refunded' ? 'remboursée' : '' }));\n}")],
  pub_montant: ['src/statsTransporteurs.js', (s) => s.replace("'nonReclame', 'point'];", "'nonReclame', 'point', 'port', 'prix'];")],
  suivi_partage: ['src/statsTransporteurs.js', (s) => s.replace("(partages && partages.has(n))) return null;\n  const d = departs.get(n);", "false) return null;\n  const d = departs.get(n);")],
  site_ignore: ['src/statsTransporteurs.js', (s) => s.replace("const L = filtre === 'toutes' ? L0 : L0.filter((x) => siteDe(x) === filtre);", "const L = L0;")],
  site_pas_lu_zero: ['src/statsTransporteurs.js', (s) => s.replace("return { L: lus.length ? L : null, lus, pasLus };", "return { L, lus: PARTIES_PUB_TRANSP[sens], pasLus: [] };")],
  arrivee_perdue: ['src/statsTransporteurs.js', (s) => s.replace("(d ? (ms(d.arriveeAt) ?? ms(arriveeAt)) : null)", "null")],
  arrivee_retrait: ['src/statsTransporteurs.js', (s) => s.replace("(d ? (ms(d.arriveeAt) ?? ms(arriveeAt)) : null)", "(d ? ms(d.etatAt) : null)")],
  memo_arrivee_tard: ['src/statsTransporteurs.js', (s) => s.replace("(m[n] != null && m[n] <= at)", "false")],
  trajet_perime: ['src/statsTransporteurs.js', (s) => s.replace("if (!objet(m) || txt(m.e) !== txt(etatAt)) return null;", "if (!objet(m)) return null;")],
  serveur_arrivee: ['api/_lib/depart-colis.js', (s) => s.replace("&& msDe(a.arriveeAt) == null) out.arriveeAt = out.etatAt;", "&& false) out.arriveeAt = out.etatAt;")],
  serveur_arrivee_ecrasee: ['api/_lib/depart-colis.js', (s) => s.replace("(out.etat === 'disponible' || out.etat === 'livre') && msDe(out.etatAt) != null && msDe(a.arriveeAt) == null", "msDe(out.etatAt) != null")],
  dep_rejouee: ['src/depensesRapides.js', (s) => s.replace("if (L.some((x) => x && x.id === geste.d.id)) return c;", "")],
  dep_lecture_ratee: ['src/depensesRapides.js', (s) => s.replace("try { cur = lire(); } catch (_) { return { ok: false, raison: 'lecture' }; }", "try { cur = lire(); } catch (_) { cur = {}; }")],
  dep_pas_pret: ['src/depensesRapides.js', (s) => s.replace("if (typeof pret === 'function' && !pret()) return { ok: false, raison: 'pas-lu' };", "")],
  dep_montant_nul: ['src/depensesRapides.js', (s) => s.replace("return Number.isFinite(v) && v > 0 ? v : null;", "return Number.isFinite(v) ? v : null;")],
  dep_date_future: ['src/depensesRapides.js', (s) => s.replace("|| j > jourLocal(maintenant)", "")],
  jour_sans_depense: ['src/App.jsx', (s) => s.replace("const charges = auJour ? depJour.total : periode === 'annee'", "const charges = auJour ? 0 : periode === 'annee'")],
  jour_tout_le_mois: ['src/App.jsx', (s) => s.replace("const L = (Array.isArray(d.depenses) ? d.depenses : []).filter((x) => x && String(x.date || '').slice(0, 10) === jour);", "const L = (Array.isArray(d.depenses) ? d.depenses : []).filter((x) => x && String(x.date || '').slice(0, 7) === jour.slice(0, 7));")],
  jour_mention_gardee: ['src/App.jsx', (s) => s.replace("chargesAuMois: auJour && !(depJour && depJour.n > 0)", "chargesAuMois: auJour")],
  lire_compta_defaut: ['src/App.jsx', (s) => s.replace("const p = JSON.parse(t);\n  if (p !== null && (typeof p !== 'object' || Array.isArray(p))) throw new Error('vrm_compta illisible');", "let p; try { p = JSON.parse(t); } catch (_) { p = {}; }")],
  vue_dep_calcule: ['src/natif/ecrans/DepensesMois.jsx', (s) => s.replace("const total = chargesMois && chargesMois.total != null ? chargesMois.total : null;", "const total = lignes.reduce((t, d) => t + d.montant, 0);")],
  app_sans_lbc: ['src/App.jsx', (s) => s.replace("if (lbcV && departsLus) publier('ventes', 'leboncoin',", "if (false) publier('ventes', 'leboncoin',")],
};
const MUT = process.env.MUTATION || '';
if (MUT === 'liste') { console.log(Object.keys(MUTATIONS).join('\n')); process.exit(0); }
if (MUT === 'toutes') {
  const { execFileSync } = require('child_process'); let tenues = 0; const molles = [];
  for (const k of Object.keys(MUTATIONS)) { try { execFileSync(process.execPath, [__filename], { env: { ...process.env, MUTATION: k }, stdio: 'ignore' }); molles.push(k); } catch (_) { tenues++; } }
  console.log(molles.length ? `❌ ${molles.length} mutation(s) restent vertes : ${molles.join(', ')}` : `✅ ${tenues} mutations, toutes rouges`);
  process.exit(molles.length ? 1 : 0);
}
if (MUT && !MUTATIONS[MUT]) { console.log('❌ mutation inconnue : ' + MUT); process.exit(1); }
const source = (rel) => { const s = lire(rel); if (MUT && MUTATIONS[MUT][0] === rel) { const m = MUTATIONS[MUT][1](s); if (m === s) { console.log('❌ la mutation « ' + MUT + ' » ne mord pas la source'); process.exit(1); } return m; } return s; };

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } return c; };
const titre = (t) => console.log('\n── ' + t);

// Les modules ESM copiés (mutés au besoin) dans un dossier temporaire ; toute importation relative non copiée pointe le dépôt.
const COPIES = ['src/statsTransporteurs.js', 'src/depensesRapides.js', 'src/depensesTicket.js', 'api/_lib/depart-colis.js'];
async function charger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-transp-depenses-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  for (const rel of COPIES) {
    let s = source(rel);
    s = s.replace(/from '(\.\.?\/[^']+)'/g, (m0, r) => {
      const cible = path.normalize(path.join(path.dirname(rel), r));
      return COPIES.includes(cible.split(path.sep).join('/')) ? m0 : "from '" + url.pathToFileURL(path.join(RACINE, cible)).href + "'";
    });
    const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s);
  }
  const imp = (rel) => import(url.pathToFileURL(path.join(dir, rel)).href);
  return { T: await imp('src/statsTransporteurs.js'), D: await imp('src/depensesRapides.js'), DC: await imp('api/_lib/depart-colis.js') };
}

// Les fonctions de l'app (src/App.jsx, recollé) chargées dans un vm : beneficePeriode et ses dépendances, comptaChargesMois,
// comptaDepensesJour, lireComptaPourEcrire.
function chargerApp(faux) {
  let src = require('./_source-app.cjs').sourceAppDe(path.join(RACINE, 'src', 'App.jsx'));
  if (MUT && MUTATIONS[MUT][0] === 'src/App.jsx') { const m = MUTATIONS[MUT][1](src); if (m === src) { console.log('❌ la mutation ne mord pas App.jsx'); process.exit(1); } src = m; }
  const parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser'));
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const decl = new Map();
  for (const n of ast.program.body) {
    const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n; if (!d) continue;
    if (d.type === 'FunctionDeclaration' && d.id) decl.set(d.id.name, src.slice(d.start, d.end));
    if (d.type === 'VariableDeclaration') for (const v of d.declarations) if (v.id && v.id.name) decl.set(v.id.name, `${d.kind} ${src.slice(v.start, v.end)};`);
  }
  const VOULUS = ['BENEF_CHAMPS', 'beneficePeriode', 'comptaChargesMois', 'comptaDepensesJour', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'lireComptaPourEcrire'];
  const noms = new Set(VOULUS);
  for (let essai = 0; essai < 60; essai++) {
    const code = [...decl.keys()].filter((k) => noms.has(k) && k !== '_saveEnAttente').map((k) => decl.get(k)).join('\n') + `\n;({ ${VOULUS.join(', ')} })`;
    const ctx = vm.createContext({ console, Date, Math, Number, String, Object, Array, JSON, isFinite, isNaN, parseFloat, parseInt, RegExp, Set, Map, Error, localStorage: faux.ls, _saveEnAttente: faux.attente });
    try {
      const out = vm.runInContext(code, ctx);
      const jb = { [new Date().toISOString().slice(0, 10)]: [1, 100, 0, 1, 50, 100, 0] }; out.jourBeneficeEnTableau(out.beneficeVide()); out.ajouterVenteBenefice(out.beneficeVide(), 1, 1, 0);
      out.beneficePeriode({ jours: jb, compta: { depenses: [{ date: '2026-01-01', montant: 1 }] }, ligneUrssaf: { mois: [] }, taux: 12.4, periode: 'jour' });
      out.beneficePeriode({ jours: jb, compta: {}, ligneUrssaf: { mois: [] }, taux: 12.4, periode: 'mois' }); out.lireComptaPourEcrire();
      return out;
    } catch (e) {
      const m = /([A-Za-z_$][\w$]*) is not defined/.exec(String(e && e.message));
      if (m && decl.has(m[1]) && !noms.has(m[1])) { noms.add(m[1]); continue; }
      throw e;
    }
  }
  throw new Error('dépendances introuvables');
}

(async () => {
  const { T, D, DC } = await charger();
  const JOUR = 86400000, H = 3600000;
  const now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const t0 = now - 10 * JOUR;
  const de = now - 30 * JOUR, a = now + JOUR;

  titre('T. Transporteurs : quatre sites, une règle');
  // Les départs lus chez le transporteur (Map n° → ligne `depart_`), INVENTÉS.
  const dep = (suivi, carrier, prise, etat, etatAt, extra = {}) => ({ suivi, carrier, priseAt: iso(prise), etat, etatAt: iso(etatAt), ...extra });
  const departs = new Map([
    ['LBC1', dep('LBC1', 'mondialrelay', t0 + 1 * JOUR, 'disponible', t0 + 3 * JOUR)],
    ['LBC2', dep('LBC2', 'mondialrelay', t0 + 2 * JOUR, 'retire', t0 + 6 * JOUR, { arriveeAt: iso(t0 + 4 * JOUR) })],
    ['VC1', dep('VC1', 'colissimo', t0 + 1 * JOUR, 'livre', t0 + 3 * JOUR)],
    ['VCX', dep('VCX', 'colissimo', t0 + 1 * JOUR, 'livre', t0 + 2 * JOUR)],
  ]);
  // Deux ventes Leboncoin au MÊME titre, deux bordereaux : chacune SON départ.
  const lbc = [
    { txId: 'L1', isSeller: true, title: 'Nike inventée', dateVente: iso(t0), deliveryMethod: 'mondial_relay', label: { reference: 'LBC1', voucherUrl: 'x' } },
    { txId: 'L2', isSeller: true, title: 'Nike inventée', dateVente: iso(t0), deliveryMethod: 'mondial_relay', label: { reference: 'LBC2', voucherUrl: 'x' } },
    { txId: 'L3', isSeller: false, title: 'Achat inventé', dateVente: iso(t0) },
  ];
  // Vestiaire : VCX porté par DEUX ventes ⇒ aucune preuve pour ce n°.
  const vc = { a: { date: iso(t0), suivi: 'VC1', transporteur: 'Colissimo', etat: 'shipped' }, b: { date: iso(t0), suivi: 'VCX', transporteur: 'Colissimo', etat: 'shipped' }, c: { date: iso(t0), suivi: 'VCX', transporteur: 'Colissimo', etat: 'shipped' }, d: { date: iso(t0), etat: 'cancelled' } };
  const ebay = [
    { orderId: 'E1', creationDate: iso(t0), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', pricingSummary: { deliveryCost: { value: '6.50', currency: 'EUR' }, total: { value: '86.50' } }, fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO', shippingStep: { shippingCarrierCode: 'Colissimo' } }] },
    { orderId: 'E2', creationDate: iso(t0), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', pricingSummary: { deliveryCost: { value: '6.50', currency: 'EUR' } } },
    { orderId: 'E3', creationDate: iso(t0), orderPaymentStatus: 'FULLY_REFUNDED', cancelStatus: { cancelState: 'CANCELED' } },
  ];
  const partages = T.suivisPartages([...lbc.map((o) => o.label && o.label.reference), ...Object.values(vc).map((v) => v.suivi)]);
  const LL = lbc.map((o) => T.ligneVenteLbc(o, { departs, partages })).filter(Boolean);
  const LV = T.listeSite(vc).map((v) => T.ligneVenteVc(v, { departs, partages })).filter(Boolean);
  const LE = ebay.map(T.ligneVenteEbay).filter(Boolean);
  const LVi = [T.ligneVente({ tr: { cle: 'vinted', nom: 'Vinted Go' }, venteAt: t0, depart: null, limiteAt: null })];
  dit(LL.length === 2 && LL.every((x) => x.site === 'leboncoin' && x.t === 'mondialrelay'), 'T1 Leboncoin : les deux VENTES (pas l’achat), transporteur nommé par la transaction', LL);
  dit(LL[0].depotAt === t0 + JOUR && LL[1].depotAt === t0 + 2 * JOUR, 'T2 même titre, deux bordereaux : chaque vente prend le départ de SON n° (jamais le titre)', LL.map((x) => x.depotAt));
  dit(LL[1].livreAt === t0 + 4 * JOUR, 'T3 retiré par l’acheteur : l’arrivée GARDÉE (`arriveeAt`), jamais la date du retrait', LL[1]);
  dit(LV.length === 3 && LV[0].depotAt === t0 + JOUR && LV[1].depotAt === null && LV[2].depotAt === null, 'T4 Vestiaire : un n° porté par deux ventes ne prouve rien ; annulée sans envoi écartée', LV.map((x) => x.depotAt));
  dit(LE.length === 2 && LE[0].t === 'colissimo' && LE[1].t === 'pas-lu' && LE.every((x) => x.depotAt === null && x.site === 'ebay'), 'T5 eBay : le transporteur de la commande (sinon inconnu), aucune date de dépôt inventée, annulée écartée', LE);
  const argent = (x) => Object.keys(x).filter((k) => /port|prix|montant|price|cost|total|frais/i.test(k));
  dit(LE.every((x) => !argent(x).length) && LE.map((x) => T.lignePubliee({ ...x, port: 6.5, prix: 80, total: 86.5 })).every((x) => !argent(x).length), 'T6 eBay : AUCUN montant dans une ligne ni dans sa publication (le port n’est ni recette ni charge, §2.8)', LE.map(argent));
  const S = T.statsTransporteurs({ ventes: [...LVi, ...LL, ...LV, ...LE], achats: null, de, a });
  dit(S.ventes.total === 8 && S.ventes.sites.join() === 'vinted,leboncoin,ebay,vestiaire', 'T7 une seule règle : 8 colis des QUATRE sites', S.ventes);
  const mr = S.ventes.transporteurs.find((x) => x.cle === 'mondialrelay'), co = S.ventes.transporteurs.find((x) => x.cle === 'colissimo');
  dit(mr && mr.sites.leboncoin === 2 && co && co.sites.vestiaire === 3 && co.sites.ebay === 1 && S.ventes.inconnu && S.ventes.inconnu.sites.ebay === 1, 'T8 chaque transporteur dit ses sites (Colissimo : Vestiaire 3, eBay 1) ; l’inconnu à part', { mr, co, inc: S.ventes.inconnu });
  const SL = T.statsTransporteurs({ ventes: [...LVi, ...LL, ...LV, ...LE], achats: null, de, a, site: 'leboncoin' });
  dit(SL.ventes.total === 2 && SL.ventes.transporteurs.length === 1 && SL.ventes.site === 'leboncoin', 'T9 le filtre Site : Leboncoin seul (2 colis)', SL.ventes);
  // Une publication d'avant (sans `site`) est Vinted ; un site jamais publié est NOMMÉ, pas compté à zéro.
  const pubs = { [T.clePubTransp('ventes', 'vinted')]: [{ t: 'vinted', venteAt: t0 }], [T.clePubTransp('ventes', 'ebay')]: LE.map(T.lignePubliee) };
  const R = T.reunirPubTransp('ventes', (k) => pubs[k] || null);
  dit(R.L.length === 3 && R.L[0].site === 'vinted' && R.lus.join() === 'vinted,ebay' && R.pasLus.join() === 'leboncoin,vestiaire', 'T10 réunir : Vinted (ligne d’avant) + eBay lus ; Leboncoin et Vestiaire NOMMÉS « pas lus »', R);
  dit(T.reunirPubTransp('achats', () => null).L === null, 'T11 rien de publié ⇒ null (« ouvre Ventes »), jamais une liste vide');
  // L'arrivée vue avant le retrait (cet appareil) : la plus ancienne gardée.
  let m = T.memoArrivee({}, { suivi: 'AB1', etat: 'disponible', etatAt: iso(t0 + 3 * JOUR) });
  m = T.memoArrivee(m, { suivi: 'AB1', etat: 'disponible', etatAt: iso(t0 + 5 * JOUR) });
  m = T.memoArrivee(m, { suivi: 'AB2', etat: 'en_route', etatAt: iso(t0 + 5 * JOUR) });
  dit(m.AB1 === t0 + 3 * JOUR && m.AB2 === undefined, 'T12 cet appareil garde la PREMIÈRE arrivée vue d’un n°, rien pour un colis en route', m);
  const Lr = T.ligneVente({ tr: null, venteAt: t0, depart: dep('AB1', 'vinted', t0 + JOUR, 'retire', t0 + 7 * JOUR), arriveeAt: m.AB1 });
  const Lr0 = T.ligneVente({ tr: null, venteAt: t0, depart: dep('AB9', 'vinted', t0 + JOUR, 'retire', t0 + 7 * JOUR) });
  dit(Lr.livreAt === t0 + 3 * JOUR && Lr0.livreAt === null, 'T13 retiré : l’arrivée gardée sert ; sans elle, « — » (jamais la date du retrait)', [Lr.livreAt, Lr0.livreAt]);
  // Le serveur : la ligne `depart_` garde l'arrivée une fois lue.
  const l1 = DC.ligneDepartApresEssai({}, { res: 'ok', etat: 'en_route', etatAt: iso(t0 + JOUR), evenements: [] }, { carrier: 'colissimo', suivi: 'SRV1', maintenant: t0 + JOUR });
  const l2 = DC.ligneDepartApresEssai(l1, { res: 'ok', etat: 'disponible', etatAt: iso(t0 + 3 * JOUR), evenements: [] }, { carrier: 'colissimo', suivi: 'SRV1', maintenant: t0 + 3 * JOUR });
  const l3 = DC.ligneDepartApresEssai(l2, { res: 'ok', etat: 'retire', etatAt: iso(t0 + 6 * JOUR), evenements: [] }, { carrier: 'colissimo', suivi: 'SRV1', maintenant: t0 + 6 * JOUR });
  const l4 = DC.ligneDepartApresEssai(l3, { res: 'ok', etat: 'livre', etatAt: iso(t0 + 8 * JOUR), evenements: [] }, { carrier: 'colissimo', suivi: 'SRV1', maintenant: t0 + 8 * JOUR });
  dit(!l1.arriveeAt && l2.arriveeAt === iso(t0 + 3 * JOUR) && l3.arriveeAt === iso(t0 + 3 * JOUR) && l4.arriveeAt === iso(t0 + 3 * JOUR) && l3.etatAt === iso(t0 + 6 * JOUR),
    'T14 serveur : `arriveeAt` posée à la 1re lecture « disponible », gardée au retrait et jamais remplacée', [l1.arriveeAt, l2.arriveeAt, l3.arriveeAt, l4.arriveeAt]);
  const meta = DC.departDeMeta({ id: 'depart_mondialrelay_SRV1', suivi: 'SRV1', carrier: 'mondialrelay', etat: 'retire', etatAt: l3.etatAt, priseAt: l3.priseAt, arriveeAt: l3.arriveeAt });
  dit(meta && meta.arriveeAt === iso(t0 + 3 * JOUR) && /arriveeAt:meta->>arriveeAt/.test(DC.SELECT_DEPART_META), 'T15 l’app lit `arriveeAt` en scalaire (`meta->>`, §4.4)', meta);
  // Le trajet d'un achat, gardé pour l'état lu seulement.
  const tj = { etapes: [{ cle: 'paye', at: t0, lue: true }, { cle: 'expedie', at: t0 + JOUR, lue: true }, { cle: 'point', at: t0 + 3 * JOUR, lue: true }, { cle: 'retire', at: null, lue: false }] };
  const mt = T.memoTrajet(tj, iso(t0 + 3 * JOUR));
  const back = T.trajetDeMemo(mt, iso(t0 + 3 * JOUR));
  const A = T.ligneAchat({ tr: null, payeAt: t0, ligne: { etat: 'disponible', etatAt: iso(t0 + 3 * JOUR) }, trajet: back });
  dit(A.expedieAt === t0 + JOUR && A.pointAt === t0 + 3 * JOUR && T.trajetDeMemo(mt, iso(t0 + 9 * JOUR)) === null, 'T16 trajet gardé : resservi pour la MÊME lecture, oublié dès que la ligne change', { A, mt });
  const AV = T.ligneAchatVc({ date: iso(t0), suivi: 'ACH1', transporteur: 'Mondial Relay', etat: 'delivered' }, { transp: new Map([['ACH1', { id: 'transp_mondialrelay_ACH1', etat: 'disponible', etatAt: iso(t0 + 4 * JOUR), carrier: 'mondialrelay', lu: iso(now) }]]), trajetDe: () => back });
  dit(AV && AV.site === 'vestiaire' && AV.t === 'mondialrelay' && AV.expedieAt === t0 + JOUR, 'T17 achat Vestiaire : la même `ligneAchat` sur la ligne de SON n°', AV);

  titre('D. Dépenses : forme, écriture, une seule fois');
  const auj = D.jourLocal(now);
  const f1 = D.nouvelleDepense({ id: 'd1', cat: 'Emballage', montant: '12,50' });
  dit(f1.ok && f1.d.date === auj && f1.d.montant === 12.5 && f1.d.libelle === 'Emballage', 'D1 deux touchers : montant + catégorie suffisent, la date est aujourd’hui', f1);
  dit(D.nouvelleDepense({ id: 'x', cat: 'Emballage', montant: '0' }).raison === 'montant' && D.nouvelleDepense({ id: 'x', cat: 'Emballage', montant: '-3' }).raison === 'montant'
    && D.nouvelleDepense({ id: 'x', cat: 'Café', montant: '3' }).raison === 'categorie' && D.nouvelleDepense({ id: 'x', cat: 'Autre', montant: '3', date: D.jourLocal(now + 3 * JOUR) }).raison === 'date',
  'D2 refus NOMMÉS : montant nul ou négatif, catégorie inconnue, date à venir — jamais une ligne fausse');
  dit(D.CATS.map((c) => c.id).join() === 'emballage,transport,plateforme,materiel,abonnement,autre' && D.CATS.find((c) => c.id === 'transport').k === 'Envois', 'D3 les six catégories ; « Envois » d’avant garde sa clé rangée');
  let ecrit = []; const ecrire = (v) => ecrit.push(v);
  const g = { type: 'ajouter', d: f1.d };
  dit(!D.ecrireDepense({ pret: () => false, lire: () => ({}), ecrire }, g).ok && !ecrit.length, 'D4 nuage pas arrivé ⇒ RIEN n’est écrit');
  dit(!D.ecrireDepense({ pret: () => true, lire: () => { throw new Error('KO'); }, ecrire }, g).ok && !ecrit.length, 'D5 lecture ratée ⇒ RIEN n’est écrit (jamais par-dessus une ligne pas relue)');
  dit(!D.ecrireDepense({ pret: () => true, lire: () => [1, 2], ecrire }, g).ok && !ecrit.length, 'D6 ligne d’une autre forme ⇒ RIEN n’est écrit');
  const base = { depenses: [{ id: 'old', date: auj, montant: 4, cat: 'Autre' }], fixes: [{ id: 'f', montant: 10 }], abonnements: [] };
  const r1 = D.ecrireDepense({ pret: () => true, lire: () => base, ecrire }, g);
  const r2 = D.ecrireDepense({ pret: () => true, lire: () => r1.v, ecrire }, g);
  dit(r1.ok && r1.v.depenses.length === 2 && r1.v.fixes.length === 1 && r2.v.depenses.filter((x) => x.id === 'd1').length === 1, 'D7 lire-fusionner-réécrire : le reste de la ligne gardé ; une dépense rejouée comptée UNE fois', r2.v);
  const r3 = D.appliquer(r2.v, { type: 'modifier', id: 'd1', champs: { montant: 20 } }); const r4 = D.appliquer(r3, { type: 'retirer', id: 'd1' });
  dit(r3.depenses.find((x) => x.id === 'd1').montant === 20 && r3.depenses.length === 2 && !r4.depenses.some((x) => x.id === 'd1'), 'D8 modifier par id, retirer par id');
  // La règle des charges de l'app (vm) : le jour, le mois, une seule fois.
  const faux = { magasin: {}, attente: {} };
  faux.ls = { getItem: (k) => (k in faux.magasin ? faux.magasin[k] : null), setItem: (k, v) => { faux.magasin[k] = String(v); }, removeItem: (k) => { delete faux.magasin[k]; } };
  let F; try { F = chargerApp(faux); dit(true, 'D9 les règles de l’app se chargent (beneficePeriode, comptaChargesMois, comptaDepensesJour)'); } catch (e) { dit(false, 'D9 les règles de l’app se chargent', String(e.message || e)); }
  if (F) {
    const d0 = new Date(now); const ym = auj.slice(0, 7);
    const jours = []; for (let j = 1; j <= d0.getDate(); j++) jours.push(`${ym}-${String(j).padStart(2, '0')}`);
    const compta = { depenses: jours.map((j, i) => ({ id: 'q' + i, date: j, montant: 1 + i, cat: 'Emballage' })), fixes: [{ id: 'fx', montant: 30 }], packs: [], abonnements: [] };
    const sommeJours = jours.reduce((t, j) => t + F.comptaDepensesJour(compta, j).total, 0);
    const dep = compta.depenses.reduce((t, x) => t + x.montant, 0);
    dit(Math.abs(sommeJours - dep) < 0.001 && Math.abs(F.comptaChargesMois(compta, ym).total - (dep + 30)) < 0.001, 'D10 chaque dépense est dans SON jour une fois, et dans son mois une fois (somme des jours = dépenses du mois)', { sommeJours, dep, mois: F.comptaChargesMois(compta, ym) });
    const bJ = F.beneficeVide(); F.ajouterVenteBenefice(bJ, 80, 30, 2);
    const jj = { [auj]: F.jourBeneficeEnTableau(bJ) };
    const avec = F.beneficePeriode({ jours: jj, compta: { depenses: [{ id: 'z', date: auj, montant: 7.5, cat: 'Envois' }], fixes: [{ id: 'fx', montant: 30 }] }, ligneUrssaf: { mois: [] }, taux: 12.4, periode: 'jour', maintenant: now });
    const sans = F.beneficePeriode({ jours: jj, compta: { depenses: [{ id: 'z', date: jours[0] === auj ? '2000-01-01' : jours[0], montant: 7.5, cat: 'Envois' }], fixes: [{ id: 'fx', montant: 30 }] }, ligneUrssaf: { mois: [] }, taux: 12.4, periode: 'jour', maintenant: now });
    dit(avec.charges === 7.5 && avec.chargesAuMois === false && avec.depensesJour === 1 && Math.abs(avec.netFinal - (sans.netFinal - 7.5)) < 0.005,
      'D11 « net du jour » : la dépense notée aujourd’hui est déduite (pas le coût fixe du mois), sans la mention du mois', { avec: [avec.charges, avec.chargesAuMois, avec.netFinal], sans: sans.netFinal });
    dit(sans.charges === 0 && sans.chargesAuMois === true, 'D12 aucune dépense notée aujourd’hui ⇒ rien déduit, la mention « dépenses du mois » reste', [sans.charges, sans.chargesAuMois]);
    faux.magasin.vrm_compta = '{pas du json';
    let leve = false; try { F.lireComptaPourEcrire(); } catch (_) { leve = true; }
    faux.magasin.vrm_compta = JSON.stringify({ depenses: [] }); faux.attente.vrm_compta = { depenses: [{ id: 'att' }] };
    const enAttente = F.lireComptaPourEcrire(); delete faux.attente.vrm_compta; delete faux.magasin.vrm_compta;
    dit(leve && enAttente.depenses[0].id === 'att' && F.lireComptaPourEcrire() === null, 'D13 la lecture avant écriture : illisible ⇒ elle LÈVE (rien n’est écrit) ; la valeur en attente d’abord ; absente ⇒ null');
  }

  titre('S. Une source, des vues qui ne calculent rien');
  const app = source('src/App.jsx'), branche = lire('src/aujourdhui/StatsBranche.jsx'), vueT = lire('src/natif/ecrans/StatsTransporteurs.jsx'), vueD = source('src/natif/ecrans/DepensesMois.jsx'), compta = lire('src/ecrans/Compta.jsx');
  dit(/if \(lbcV && departsLus\) publier\('ventes', 'leboncoin', [^\n]*ligneVenteLbc\(/.test(app) && /if \(vcV && departsLus\) publier/.test(app) && /if \(Array\.isArray\(ebayCmd\)\) publier/.test(app) && /publier\('ventes', 'vestiaire', [^\n]*ligneVenteVc\(/.test(app) && /publier\('ventes', 'ebay', [^\n]*ligneVenteEbay\)/.test(app) && /publier\('achats', 'vestiaire', [^\n]*ligneAchatVc\(/.test(app),
    'S1 l’app publie chaque site par SA ligne de src/statsTransporteurs.js');
  dit(/reunirPubTransp\(sens, lireCle\(owner\)\)/.test(branche) && /statsTransporteurs\(\{ ventes: pubT\.ventes, achats: pubT\.achats, de: F\.de, a: F\.a, site: siteT \}\)/.test(branche), 'S2 Statistiques réunit les publications et range par la MÊME règle, le filtre Site passé à elle');
  dit(!/\.reduce\(|Math\.|\/\s*86400000/.test(vueT) && !/\.reduce\(|\+ d\.montant|montant\s*\+/.test(vueD), 'S3 les vues (Transporteurs, Dépenses) ne calculent aucun total');
  dit(/ecrireDepense\(\{ pret: isCloudReady, lire: lireComptaPourEcrire,/.test(compta) && /chargesMois=\{\{ total: chargesMois \}\}/.test(compta), 'S4 Argent écrit par `ecrireDepense` (nuage lu, lecture qui lève) et montre le total de la règle des charges');
  dit(/Nt\.duJour \? tr\('v2\.stats\.netDuJour'\)/.test(lire('src/natif/ecrans/Aujourdhui.jsx')) && /duJour: !!\(Nt\.B && Nt\.B\.chargesAuMois === false && Number\(Nt\.B\.depensesJour\) > 0\)/.test(lire('src/aujourdhui/modele.js')), 'S5 Aujourd’hui dit « net du jour » d’après la règle (dépenses du jour notées)');

  console.log(`\n${ko ? '❌' : '✅'} audit-transp-depenses : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit-transp-depenses : ' + (e && e.stack || e)); process.exit(1); });
