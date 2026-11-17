// ════════════════════════════════════════════════════════════════════════════
//  AIDE À LA DÉCISION (16 nov., lot aide-decision — validé par Julien)
//
//  A. LA CONTRE-OFFRE AUTOMATIQUE AU PRIX MINI, dans le VRAI moteur de l'extension
//     (`autoAccepterOffres`, background.js EXÉCUTÉ dans un vm, faux Vinted qui
//     compte) : éteinte par défaut ; vit seulement moteur allumé ; une offre entre
//     « Refuser sous » et le mini reçoit UNE contre-offre (POST /transactions/{tx}/offers)
//     au prix de `contreOffreMini` (la règle de la messagerie, copie IDENTIQUE) ;
//     jamais deux fois ; délai au hasard ; mêmes garde-fous (garde des autres sites,
//     compte de l'onglet, pause 429/403) ; prix de l'annonce pas su ou périmé ⇒ rien ;
//     l'aperçu de l'app (`decisionMoteur`) dit la même chose que le moteur.
//  B. CE QUI RESTE PAR MODÈLE (`classementRapporte`) : vente − achat − frais, sur les
//     seules ventes au prix d'achat ET aux frais sus ; jours MOYENS en ligne.
//  C. UN COMPTE QUI RALENTIT (`ralentissements`) : 30 j contre les 30 d'avant, au
//     moins 5 colis datés de chaque côté, ×1,5 et +24 h.
//  D. L'ARGENT QUI DORT PAR MEUBLE (`argentDortParMeuble`) : par SA case (clé de N°),
//     sans prix NOMMÉ (jamais 0), pas su ⇒ null, trié du plus gros montant.
//  E. Le branchement : publication par Annonces (même base que « Valeur du stock »),
//     carte dans Statistiques, réglage synchronisé, capacité de l'extension 5.402.
//
//  --prouve : chaque mutation doit rendre un rouge ; --src <dossier> : l'audit sur un
//  autre arbre (origin/main : rien de tout ça n'existe ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), url = require('url');
const { faireFond } = require('./_fond-vm.cjs');

const iSrc = process.argv.indexOf('--src');
const RAC = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const F = {
  bg: path.join(RAC, 'vinted-sync-extension', 'background.js'),
  manifest: path.join(RAC, 'vinted-sync-extension', 'manifest.json'),
  volets: path.join(RAC, 'src', 'messagesVolets.js'),
  sures: path.join(RAC, 'src', 'offresSures.js'),
  rapporte: path.join(RAC, 'src', 'ceQuiRapporte.js'),
  vitesse: path.join(RAC, 'src', 'vitesseEnvoi.js'),
  dort: path.join(RAC, 'src', 'argentDort.js'),
  app: path.join(RAC, 'src', 'App.jsx'),
  stats: path.join(RAC, 'src', 'ecrans', 'Stats.jsx'),
  ecran: path.join(RAC, 'src', 'OffresAuto.jsx'),
  carte: path.join(RAC, 'src', 'ArgentDort.jsx'),
  rapporteJsx: path.join(RAC, 'src', 'design', 'CeQuiRapporte.jsx'),
  vitesseJsx: path.join(RAC, 'src', 'VitesseEnvoi.jsx'),
};
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };

const MUTATIONS = {
  // A — le moteur
  ext_contre_allumee_par_defaut: { f: 'bg', m: (s) => s.replace("const contre = actif && m.vinted_offres_contre === true;", "const contre = actif && m.vinted_offres_contre !== false;") },
  ext_contre_option_ignoree: { f: 'bg', m: (s) => s.replace("else if (reg.contre === true && isFinite(min) && min > 0 && o.prix < min) quoi = 'contre';", "else if (isFinite(min) && min > 0 && o.prix < min) quoi = 'contre';") },
  ext_contre_sans_garde: { f: 'bg', m: (s) => s.replace("      if (quoi === 'accept' || quoi === 'contre') {\n        const raison", "      if (quoi === 'accept') {\n        const raison") },
  ext_contre_annonce_vendue: { f: 'bg', m: (s) => s.replace("      if (quoi === 'accept' || quoi === 'contre') {\n        const ind", "      if (quoi === 'accept') {\n        const ind") },
  ext_contre_sous_le_mini: { f: 'bg', m: (s) => s.replace("prixContre = contreOffreMini(o.prix, await prixAnnonceContre(uid, o.item), min);", "prixContre = Math.floor(min) - 1;") },
  ext_contre_prix_devine: { f: 'bg', m: (s) => s.replace("prixContre = contreOffreMini(o.prix, await prixAnnonceContre(uid, o.item), min);", "prixContre = contreOffreMini(o.prix, (await prixAnnonceContre(uid, o.item)) || 999, min);") },
  ext_contre_dressing_perime: { f: 'bg', m: (s) => s.replace("Date.now() - cap > CONTRE_DRESSING_MAX_MS ||", "") },
  ext_contre_deux_fois: { f: 'bg', m: (s) => s.replace("      if (r && r.sansPage) {\n", "      if (quoi === 'contre' && r && r.ok) { continue; }\n      if (r && r.sansPage) {\n") },
  ext_contre_sans_compte: { f: 'bg', m: (s) => s.replace("  const stop = await garde(uid, acc, { sorte: 'offre', rythme: true }); if (stop) return stop;\n  const r = await vintedPage(acc, 'POST', `/api/v2/transactions/${tx}/offers`", "  const r = await vintedPage(acc, 'POST', `/api/v2/transactions/${tx}/offers`") },
  ext_contre_sans_delai: { f: 'bg', m: (s) => s.replace("      if (!pv[o.oid]) { pv[o.oid] =", "      if (!pv[o.oid] && quoi !== 'contre') { pv[o.oid] =") },
  ext_copie_regle_differente: { f: 'bg', m: (s) => s.replace("  const x = Math.min(Math.ceil(Math.round(m * 100) / 100 - 1e-9), p);\n  const c = Math.round(x * 100) / 100;\n  if (c < m || c > p || !(c > o)) return null;\n  return c;\n}\n// </contre-offre-mini-regle>", "  const x = Math.min(Math.ceil(m), p);\n  const c = Math.round(x * 100) / 100;\n  if (c < m || c > p || !(c > o)) return null;\n  return c;\n}\n// </contre-offre-mini-regle>") },
  // A — l'aperçu de l'app
  apercu_contre_sans_garde: { f: 'sures', m: (s) => s.replace("    if (r) return { quoi: 'garde', raison: r, min, refuse };\n    const c = contreOffreMini", "    const c = contreOffreMini") },
  apercu_contre_toujours: { f: 'sures', m: (s) => s.replace("if (contre === true && min != null && prix < min) {", "if (min != null && prix < min) {") },
  // B — ce qui reste
  reste_sans_frais: { f: 'rapporte', m: (s) => s.replace("g.net += cents(eur) - cents(l.achat) - cents(l.frais);", "g.net += cents(eur) - cents(l.achat);") },
  reste_frais_pas_sus_zero: { f: 'rapporte', m: (s) => s.replace("if (connu && fraisSus) {", "if (connu) {") },
  reste_achat_inconnu_zero: { f: 'rapporte', m: (s) => s.replace("if (connu && fraisSus) {", "if (fraisSus) {") },
  // C — ralentissement
  ralenti_deux_colis: { f: 'vitesse', m: (s) => s.replace('export const RALENTI_MIN = 5;', 'export const RALENTI_MIN = 1;') },
  ralenti_leger: { f: 'vitesse', m: (s) => s.replace('if (apres >= avant * RALENTI_FOIS && apres - avant >= RALENTI_ECART_MS)', 'if (apres > avant)') },
  ralenti_sans_date: { f: 'vitesse', m: (s) => s.replace("if (!l || !Number.isFinite(l.vente) || !Number.isFinite(l.depart) || l.vente < debut || l.vente > fin) continue;", "if (!l || !Number.isFinite(l.vente) || l.vente < debut || l.vente > fin) continue;") },
  // D — argent qui dort
  dort_sans_prix_zero: { f: 'dort', m: (s) => s.replace("centimes: e.nPrix ? e.c : (e.n ? null : 0),", "centimes: e.c,") },
  dort_pas_su_vide: { f: 'dort', m: (s) => s.replace("if (!Array.isArray(meubles) || !slots || typeof slots !== 'object' || Array.isArray(slots) || !Array.isArray(lignes)) return null;", "if (!Array.isArray(lignes)) return null; meubles = meubles || []; slots = slots || {};") },
  dort_meuble_inconnu: { f: 'dort', m: (s) => s.replace("if (!s || s.m == null || !ids.has(str(s.m))) continue;", "if (!s || s.m == null) continue; if (!ids.has(str(s.m))) ids.set(str(s.m), '');") },
  dort_double_compte: { f: 'dort', m: (s) => s.replace("    if (!e) { par.set(k, [k, achat, age]); continue; }", "    if (!e) { par.set(k, [k, achat, age]); continue; }\n    if (achat != null) { par.set(k + '#' + par.size, [k, achat, age]); continue; }") },
  dort_tri_nombre: { f: 'dort', m: (s) => s.replace(".sort((a, b) => (b.centimes ?? -1) - (a.centimes ?? -1) || b.n - a.n || a.nom.localeCompare(b.nom));", ".sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom));") },
  // E — branchement
  carte_absente: { f: 'stats', m: (s) => s.replace("<ArgentDort owner=", "<ArgentDortAbsente owner=") },
  publication_autre_base: { f: 'app', m: (s) => s.replace("return lignesArgentDort(annoncesPresentes.map(", "return lignesArgentDort((listings.items || []).map(") },
  reglage_pas_synchro: { f: 'app', m: (s) => s.replace("'vinted_offres_auto','vinted_offres_contre',", "'vinted_offres_auto',") },
  ecran_contre_sans_moteur: { f: 'ecran', m: (s) => s.replace("const contreActive = !!(actif && contre === true);", "const contreActive = contre === true;") },
};

let ok = 0, ko = 0;
const dit = (c, msg, det) => { if (c) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (det ? '  → ' + det : '')); } };

// Un module de l'app chargé depuis SA place (ses imports relatifs marchent) : une copie
// sœur `.audit-…mjs`, supprimée après — la mutation, si elle existe, y est appliquée.
async function charger(cle, src) {
  if (!src) return null;
  const f = F[cle].replace(/\.js$/, '') + `.audit-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`;
  fs.writeFileSync(f, src);
  try { return await import(url.pathToFileURL(f).href); } catch (e) { return { __erreur: e.message }; } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// ── A. Le VRAI moteur ──────────────────────────────────────────────────────
const UID = '111';
const GARDE_OK = () => ({ v: 1, at: Date.now(), items: [], complet: true, manques: [], ambigus: 0 });
function conv({ item, tx, oid, price, user = 500 }) {
  return { capturedAt: new Date().toISOString(), payload: { conversation: {
    id: 'c' + oid, description: 'Paire', opposite_user: { id: user, login: 'acheteur' }, transaction: { item_id: String(item) },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: user, current: true, status: 10, status_title: '', price: { amount: String(price), currency_code: 'EUR' }, transaction_id: Number(tx), offer_request_id: Number(oid) } }],
  } } };
}
let BG_SRC = null;
const ITEM = 444, TX = 9001, OID = 7001;
function monter({ prix = 30, min = '40', refuse = '20', actif = true, contre = true, garde, listing = { amount: '50.00', currency_code: 'EUR' }, listingEtat = {}, capListing = 0, connecte = UID, store = {}, sansListing = false }) {
  const lignes = { [`harvest_${UID}_conv_${OID}`]: conv({ item: ITEM, tx: TX, oid: OID, price: prix }) };
  const fiche = { num: '7' }; if (min != null) fiche.min = min; if (refuse != null) fiche.refuse = refuse;   // null = absent
  lignes.main = { capturedAt: new Date().toISOString(), vinted_offres_auto: actif, vinted_annonce_numeros: { [String(ITEM)]: fiche }, vinted_offre_refus_msg: '', vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } } };
  if (contre != null) lignes.main.vinted_offres_contre = contre;   // null = réglage absent
  lignes.main.vinted_offres_garde = garde === undefined ? GARDE_OK() : garde;
  if (!sansListing) lignes[`harvest_${UID}_listings`] = { capturedAt: new Date(Date.now() - capListing).toISOString(), payload: { items: [{ id: ITEM, title: 'Paire', price: listing, ...listingEtat }, { id: 555, price: { amount: '10.00', currency_code: 'EUR' } }] } };
  // (5.398) Le faux Vinted rend aussi le FIL tel qu'il est (le moteur le relit juste avant le geste).
  return faireFond({ src: BG_SRC || undefined, lignes, store, connecte, vinted: (e) => { const m = /^\/api\/v2\/conversations\/(c\d+)$/.exec(e.chemin); const l = m && e.methode === 'GET' ? lignes[`harvest_${UID}_conv_${m[1].slice(1)}`] : null; return l ? { status: 200, body: { conversation: l.payload.conversation } } : { status: 200, body: {} }; } });
}
async function moteur(o = {}) {
  const f = monter(o);
  if (typeof f.ctx.autoAccepterOffres !== 'function') return { f, absent: true, contres: [], acc: 0, rej: 0, premier: 0 };
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  const premier = f.j.vinted.filter((v) => v.methode !== 'GET').length;
  const pv = f.store.vrmOffresPrevues || {}; for (const k in pv) if (pv[k]) pv[k].at = Date.now() - 1000;
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  if (o.trois) { const pv2 = f.store.vrmOffresPrevues || {}; for (const k in pv2) if (pv2[k]) pv2[k].at = Date.now() - 1000; try { await f.ctx.autoAccepterOffres(UID); } catch (_) {} }
  const contres = f.j.vinted.filter((v) => v.methode === 'POST' && /^\/api\/v2\/transactions\/\d+\/offers$/.test(v.chemin));
  const acc = f.j.vinted.filter((v) => v.methode === 'PUT' && /\/accept$/.test(v.chemin)).length;
  const rej = f.j.vinted.filter((v) => v.methode === 'PUT' && /\/reject$/.test(v.chemin)).length;
  return { f, contres, acc, rej, premier };
}
const prixEnvoye = (v) => { try { const c = JSON.parse(v.corps); return c && c.offer ? String(c.offer.price) : ''; } catch (_) { return ''; } };

async function partieA(S) {
  const bg = S.bg;
  { const r = await moteur({});
    dit(!r.absent && r.contres.length === 1 && r.acc === 0 && r.rej === 0, 'A1 offre 30 · refuser sous 20 · mini 40 · annonce 50, option allumée : UNE contre-offre part (POST …/transactions/9001/offers)', `contres=${r.contres.length} acc=${r.acc} rej=${r.rej}`);
    dit(r.contres[0] && prixEnvoye(r.contres[0]) === '40.00' && r.contres[0].chemin === `/api/v2/transactions/${TX}/offers`, 'A2 au prix MINI (40,00), sur la transaction de l’offre', r.contres[0] && prixEnvoye(r.contres[0]));
    dit(r.contres[0] && r.contres[0].origine === 'page' && !Object.keys(r.contres[0].entetes || {}).some((k) => /^authorization$/i.test(k)), 'A3 depuis l’ONGLET vinted.fr (aucun Authorization), comme l’acceptation');
    dit(r.premier === 0, 'A4 à la première vue de l’offre, RIEN ne part (délai tiré au hasard)', `premier=${r.premier}`);
    const memo = r.f.store.vrmOffresFaites || {};
    dit(!!memo[String(OID)], 'A5 l’offre est mémorisée (vrmOffresFaites) — jamais deux contre-offres');
    const acts = ((r.f.store.vrmActions || {})[UID] || []).length;
    dit(acts === 1, 'A5b la contre-offre prend SA place dans le plafond de 50 actions/heure du compte', `actions=${acts}`);
    const journal = (r.f.store.vrmJournal || {})[UID] || [];
    dit(journal.some((e) => e.s === 'contre_offre' && e.auto === true && e.p === 40 && e.de === 30), 'A6 noté au journal « Ce que VRM a fait » (contre_offre, auto, 40 € pour une offre de 30 €)', JSON.stringify(journal)); }
  { const r = await moteur({ trois: true });
    dit(r.contres.length === 1, 'A7 un troisième passage ne renvoie rien (une fois par offre)', `contres=${r.contres.length}`); }
  { const r = await moteur({ contre: null });
    dit(r.contres.length === 0 && r.acc === 0 && r.rej === 0, 'A8 réglage absent (défaut) : rien ne part', `contres=${r.contres.length}`); }
  { const r = await moteur({ actif: false });
    dit(r.contres.length === 0, 'A9 option allumée mais moteur ÉTEINT : rien ne part', `contres=${r.contres.length}`); }
  { const r = await moteur({ garde: { ...GARDE_OK(), items: [String(ITEM)] } });
    dit(r.contres.length === 0, 'A10 paire vendue ailleurs (garde) : pas de contre-offre (prise, elle VEND)', `contres=${r.contres.length}`); }
  { const r = await moteur({ garde: null });
    dit(r.contres.length === 0, 'A11 garde absente (pas vérifiée) : rien ne part', `contres=${r.contres.length}`); }
  { const r = await moteur({ capListing: 30 * 3600 * 1000 });
    dit(r.contres.length === 0 && !!(r.f.store.vrmOffresFaites || {})[String(OID)], 'A12 lecture du dressing de plus de 24 h : rien ne part, l’offre est notée examinée (pas une relecture par minute)', `contres=${r.contres.length}`); }
  { const r = await moteur({ sansListing: true });
    dit(r.contres.length === 0, 'A13 annonce absente de la lecture : prix pas su ⇒ rien ne part', `contres=${r.contres.length}`); }
  { const r = await moteur({ listing: { amount: '35.00', currency_code: 'EUR' } });
    dit(r.contres.length === 0, 'A14 mini (40) au-dessus du prix de l’annonce (35) : rien ne part', `contres=${r.contres.length}`); }
  { const r = await moteur({ listingEtat: { is_reserved: true } });
    dit(r.contres.length === 0, 'A14b annonce réservée (ou vendue, fermée) à la dernière lecture du dressing : pas de contre-offre (prise, elle VENDRAIT)', `contres=${r.contres.length}`); }
  { const r = await moteur({ listing: { amount: '50.00', currency_code: 'GBP' } });
    dit(r.contres.length === 0, 'A15 annonce dans une autre devise : rien ne part (jamais convertie)', `contres=${r.contres.length}`); }
  { const r = await moteur({ min: '44,2' });
    dit(r.contres.length === 1 && prixEnvoye(r.contres[0]) === '45.00', 'A16 mini « 44,2 » ⇒ contre-offre à 45,00 (l’euro au-dessus, jamais sous le mini)', r.contres[0] && prixEnvoye(r.contres[0])); }
  { const r = await moteur({ prix: 15 });
    dit(r.contres.length === 0 && r.rej === 1, 'A17 offre sous « Refuser sous » : refusée, pas contrée', `contres=${r.contres.length} rej=${r.rej}`); }
  { const r = await moteur({ prix: 45 });
    dit(r.contres.length === 0 && r.acc === 1, 'A18 offre ≥ mini : acceptée, pas contrée', `contres=${r.contres.length} acc=${r.acc}`); }
  { const r = await moteur({ refuse: null, prix: 10 });
    dit(r.contres.length === 1, 'A19 sans « Refuser sous » : toute offre sous le mini reçoit la contre-offre', `contres=${r.contres.length}`); }
  { const r = await moteur({ connecte: '999' });
    dit(r.contres.length === 0, 'A20 navigateur sur un AUTRE compte Vinted : rien ne part', `contres=${r.contres.length}`); }
  { const plein = Array.from({ length: 45 }, (_, i) => Date.now() - 60000 - i * 1000);
    const r = await moteur({ store: { vrmActions: { [UID]: plein } } });
    dit(r.contres.length === 0, 'A21b plafond de l’heure atteint (45/50, réserve gardée pour ses clics) : rien ne part', `contres=${r.contres.length}`); }
  { const r = await moteur({ store: { vrmPauseVinted: { jusqua: Date.now() + 600000, niveau: 1, statut: 429 } } });
    dit(r.contres.length === 0, 'A21 pause Vinted (429/403) : rien ne part', `contres=${r.contres.length}`); }
  // La copie de la règle est IDENTIQUE à celle de la messagerie (src/messagesVolets.js).
  const corps = (s, re) => { const m = re.exec(s); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
  const cApp = corps(S.volets, /export function contreOffreMini\(offre, prixAffiche, mini\) \{([\s\S]*?)\n\}/);
  const cExt = corps(bg, /<contre-offre-mini-regle>[\s\S]*?function contreOffreMini\(offre, prixAffiche, mini\) \{([\s\S]*?)\n\}\n\/\/ <\/contre-offre-mini-regle>/);
  dit(!!cApp && cApp === cExt, 'A22 la règle du prix (`contreOffreMini`) de l’extension est la COPIE exacte de celle de la messagerie');
  // L'aperçu de l'app dit ce que le moteur fera.
  const R = await charger('sures', S.sures);
  if (!R || typeof R.decisionMoteur !== 'function') { dit(false, 'A23 `decisionMoteur` se charge', R && R.__erreur); return; }
  const CAS = [
    { o: {}, attendu: 'contrer' }, { o: { contre: false }, attendu: 'toi' }, { o: { garde: { ...GARDE_OK(), items: [String(ITEM)] } }, attendu: 'garde' },
    { o: { listing: { amount: '35.00', currency_code: 'EUR' } }, attendu: 'toi' }, { o: { prix: 15 }, attendu: 'refuser' }, { o: { prix: 45 }, attendu: 'accepter' },
    { o: { refuse: null, prix: 10 }, attendu: 'contrer' }, { o: { min: '44,2' }, attendu: 'contrer' },
  ];
  let ecarts = [];
  for (const c of CAS) {
    const o = { prix: 30, min: '40', refuse: '20', contre: true, garde: GARDE_OK(), listing: { amount: '50.00', currency_code: 'EUR' }, ...c.o };
    const d = R.decisionMoteur({ prix: o.prix, item: String(ITEM) }, { min: o.min, refuse: o.refuse }, o.garde, Date.now(), { virgule: true, contre: o.contre, prixAnnonce: o.listing.currency_code === 'EUR' ? Number(o.listing.amount) : null });
    const r = await moteur(o);
    const fait = r.contres.length ? 'contrer' : r.acc ? 'accepter' : r.rej ? 'refuser' : 'rien';
    const dDit = d.quoi === 'contrer' || d.quoi === 'accepter' || d.quoi === 'refuser' ? d.quoi : 'rien';
    if (dDit !== fait || d.quoi !== c.attendu || (d.quoi === 'contrer' && r.contres[0] && Number(prixEnvoye(r.contres[0])) !== d.contre)) ecarts.push(`${JSON.stringify(c.o)} écran=${d.quoi}${d.contre ? '@' + d.contre : ''} moteur=${fait}`);
  }
  dit(!ecarts.length, `A23 l’aperçu (decisionMoteur) dit ce que le moteur fait, ${CAS.length} cas (contre-offre, garde, prix pas su, refus, acceptation)`, ecarts.join(' | '));
  const ap = R.apercuMoteur({ offres: new Map([[`${UID}_1`, { prix: 30, item: String(ITEM) }]]), numeros: { [String(ITEM)]: { min: '40', refuse: '20' } }, garde: GARDE_OK(), virgule: true, contre: false, prixDe: () => 50 });
  dit(ap && ap.lignes[0] && ap.lignes[0].quoi === 'toi', 'A24 option éteinte ⇒ l’aperçu dit « À toi » (rien de promis)');
  const j = R.journalOffres([{ id: `journal_vrm_${UID}_navA`, e: [{ t: Date.now(), s: 'contre_offre', a: String(ITEM), x: String(TX), p: 40, auto: true }] }]);
  dit(Array.isArray(j) && j[0] && j[0].sorte === 'contre' && j[0].prix === 40 && j[0].auto, 'A25 l’historique montre la contre-offre notée par l’extension');
}

// ── B. Ce qui reste, par modèle ────────────────────────────────────────────
async function partieB(S) {
  const M = await charger('rapporte', S.rapporte);
  if (!M || typeof M.classementRapporte !== 'function') { dit(false, 'B0 `classementRapporte` se charge', M && M.__erreur); return; }
  const t = Date.UTC(2026, 9, 10);
  const L = [
    { plateforme: 'Vinted', id: '1', ts: t, eur: 100, achat: 50, frais: 5, titre: 'Nike Dunk Low', marqueLue: 'Nike', enLigne: t - 10 * 864e5 },
    { plateforme: 'Vinted', id: '2', ts: t, eur: 80, achat: 30, frais: 0, titre: 'Nike Dunk High', marqueLue: 'Nike', enLigne: t - 20 * 864e5 },
    { plateforme: 'eBay', id: '3', ts: t, eur: 90, achat: 40, frais: null, titre: 'Nike Dunk', marqueLue: 'Nike' },
    { plateforme: 'Vinted', id: '4', ts: t, eur: 70, achat: null, frais: 2, titre: 'Nike Dunk', marqueLue: 'Nike' },
  ].map((l) => ({ ...l, modeleSur: M.modeleSur ? M.modeleSur(l.marqueLue, l.titre) : null }));
  const C = M.classementRapporte(L, 'modele');
  const g = C && C.groupes.find((x) => x.n === 4);
  dit(!!g, 'B1 les 4 ventes « Dunk » forment un groupe', JSON.stringify(C && C.groupes.map((x) => [x.nom, x.n])));
  if (!g) return;
  dit(g.nNet === 2 && g.apresFrais === 95 && g.resteMoyen === 47.5, 'B2 reste = vente − achat − frais sur les 2 ventes au prix d’achat ET aux frais sus : 95 € · 47,50 € par vente', JSON.stringify({ nNet: g.nNet, apresFrais: g.apresFrais, resteMoyen: g.resteMoyen }));
  dit(g.brut === 150 && g.nCout === 3, 'B3 le bénéfice brut d’avant ne bouge pas (vente − achat, 3 ventes au prix connu)', `${g.brut}/${g.nCout}`);
  dit(g.joursMoyen === 15, 'B4 jours MOYENS en ligne : (10 + 20) / 2 = 15', String(g.joursMoyen));
  const vide = M.classementRapporte([{ plateforme: 'Vinted', id: '9', ts: t, eur: 60, achat: null, frais: 1, titre: 'Nike Dunk', marqueLue: 'Nike' }], 'modele');
  dit(vide && vide.groupes[0] && vide.groupes[0].resteMoyen === null && vide.groupes[0].nNet === 0, 'B5 aucun prix d’achat connu ⇒ reste « — » (null), jamais la vente entière');
}

// ── C. Le ralentissement ───────────────────────────────────────────────────
async function partieC(S) {
  const V = await charger('vitesse', S.vitesse);
  if (!V || typeof V.ralentissements !== 'function') { dit(false, 'C0 `ralentissements` se charge', V && V.__erreur); return; }
  const H = 3600000, J = 24 * H, now = Date.UTC(2026, 10, 16, 12);
  const serie = (compte, n, finAvant, delai) => Array.from({ length: n }, (_, i) => ({ tx: compte + finAvant + i, compte, nom: compte, vente: now - finAvant * J - i * H, depart: now - finAvant * J - i * H + delai }));
  const lent = [...serie('a', 5, 40, 20 * H), ...serie('a', 5, 5, 60 * H)];
  const R1 = V.ralentissements(lent, { maintenant: now });
  dit(R1 && R1.length === 1 && R1[0].cle === 'a' && R1[0].avant === 20 * H && R1[0].maintenant === 60 * H, 'C1 20 h → 60 h de moyenne, 5 colis datés de chaque côté : le compte est dit', JSON.stringify(R1));
  dit((V.ralentissements([...serie('a', 4, 40, 20 * H), ...serie('a', 5, 5, 60 * H)], { maintenant: now }) || []).length === 0, 'C2 moins de 5 colis datés d’un côté : rien n’est dit');
  dit((V.ralentissements([...serie('a', 5, 40, 20 * H), ...serie('a', 5, 5, 28 * H)], { maintenant: now }) || []).length === 0, 'C3 20 h → 28 h (×1,4) : pas « nettement », rien n’est dit');
  dit((V.ralentissements([...serie('a', 5, 40, 2 * H), ...serie('a', 5, 5, 10 * H)], { maintenant: now }) || []).length === 0, 'C4 2 h → 10 h (moins de 24 h de plus) : rien n’est dit');
  const sansDate = [...serie('a', 3, 40, 20 * H), ...serie('a', 2, 45, 20 * H).map((l) => ({ ...l, depart: null })), ...serie('a', 5, 5, 60 * H)];
  dit((V.ralentissements(sansDate, { maintenant: now }) || []).length === 0, 'C5 des dépôts sans date prouvée ne comptent pas (jamais devinés)');
  dit(V.ralentissements(null) === null, 'C6 rien publié ⇒ null (pas su)');
}

// ── D. L'argent qui dort ───────────────────────────────────────────────────
async function partieD(S) {
  const D = await charger('dort', S.dort);
  if (!D || typeof D.argentDortParMeuble !== 'function') { dit(false, 'D0 `argentDortParMeuble` se charge', D && D.__erreur); return; }
  const cle = (v) => String(v).trim().toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
  const meubles = [{ id: 'm1', name: 'Étagère' }, { id: 'm2', name: 'Armoire' }];
  const slots = { 1: { m: 'm1', i: 0 }, 2: { m: 'm1', i: 1 }, 3: { m: 'm2', i: 0 }, 9: { m: 'm1', i: 5 }, 7: { m: 'disparu', i: 0 } };
  const lignes = D.lignesArgentDort([
    { cle: '1', achat: 5000, age: 10 }, { cle: '2', achat: null, age: 30 }, { cle: '3', achat: 9000, age: null },
    { cle: '4', achat: 2000, age: 5 }, { cle: '7', achat: 1000, age: 2 }, { cle: '3', achat: 9000, age: 40 }, { cle: '', achat: 99999, age: 1 },
  ]);
  dit(Array.isArray(lignes) && lignes.length === 5 && lignes.find((l) => l[0] === '3')[1] === 9000, 'D1 un N° porté par deux annonces compte UNE fois (son prix une fois) ; un article sans N° ne compte pas', JSON.stringify(lignes));
  const A = D.argentDortParMeuble({ meubles, slots, lignes, cle });
  const m1 = A && A.meubles.find((m) => m.id === 'm1'), m2 = A && A.meubles.find((m) => m.id === 'm2');
  dit(!!m1 && m1.n === 2 && m1.centimes === 5000 && m1.nPrix === 1 && m1.sansPrix === 1, 'D2 Étagère : 2 articles présents, 50 € SAISIS, « 1 sans prix » nommé (jamais compté 0)', JSON.stringify(m1 && { n: m1.n, c: m1.centimes, s: m1.sansPrix }));
  dit(!!m1 && m1.ageMoyen === 20 && m1.nAge === 2, 'D3 âge moyen de l’Étagère : (10 + 30) / 2 = 20 jours', JSON.stringify(m1 && m1.ageMoyen));
  dit(!!m2 && m2.centimes === 9000 && A.meubles[0].id === 'm2', 'D4 trié du plus gros argent immobilisé (Armoire 90 € avant Étagère 50 €)', JSON.stringify(A && A.meubles.map((m) => [m.id, m.centimes])));
  dit(A && A.horsMeuble.n === 2 && A.horsMeuble.centimes === 3000, 'D5 un article sans case (ou dans un meuble disparu) va dans « Pas encore rangés », jamais dans un meuble deviné', JSON.stringify(A && A.horsMeuble));
  dit(!!m1 && !m1.articles.some((a) => a.cle === '9'), 'D6 une case notée pour un N° qui n’est plus présent ne compte pas');
  const seul = D.argentDortParMeuble({ meubles, slots: { 2: { m: 'm1', i: 0 } }, lignes: [['2', null, 3]], cle });
  dit(seul && seul.meubles[0].centimes === null, 'D7 un meuble sans aucun prix saisi ⇒ « — » (null), jamais 0 €');
  dit(D.argentDortParMeuble({ meubles: null, slots, lignes, cle }) === null && D.argentDortParMeuble({ meubles, slots: null, lignes, cle }) === null && D.argentDortParMeuble({ meubles, slots, lignes: null, cle }) === null, 'D8 meubles, cases ou publication pas lus ⇒ null (pas su)');
  dit(A && A.centimes === 17000 && A.n === 5 && A.nPrix === 4, 'D9 le total : 170 € sur 5 articles, 4 au prix connu', JSON.stringify(A && { c: A.centimes, n: A.n, p: A.nPrix }));
}

// ── E. Le branchement ──────────────────────────────────────────────────────
function partieE(S) {
  const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const app = sans(S.app), stats = sans(S.stats), ecran = sans(S.ecran);
  dit(/'vinted_offres_auto','vinted_offres_contre',/.test(app), 'E1 le réglage `vinted_offres_contre` est synchronisé (l’extension le lit dans `main`)');
  dit(/useStateCle\('vinted_offres_contre', \(\) => load\('vinted_offres_contre', false\) === true\)/.test(app), 'E2 éteint par défaut dans l’app (seul un vrai « oui » l’allume)');
  dit(/setOffresAuto\(false\); save\('vinted_offres_auto', false\); setOffresContre\(false\); save\('vinted_offres_contre', false\);/.test(app), 'E3 « Tout arrêter » éteint aussi la contre-offre');
  dit(/const contreActive = !!\(actif && contre === true\);/.test(ecran) && /data-oa-contre-toggle=/.test(ecran), 'E4 l’écran Offres auto porte l’interrupteur ; l’aperçu ne promet la contre-offre que moteur allumé');
  dit(/return lignesArgentDort\(annoncesPresentes\.map\(/.test(app) && /beneficePaire\(null, fusionEntreeVente\(f \|\| \{\}, null, buyByNum\)\)\.achat/.test(app) && /listedAgeDays\(it\)/.test(app), 'E5 Annonces publie l’argent qui dort sur la MÊME base que « Valeur du stock » (paires présentes, prix de la règle du bénéfice, âge lu)');
  dit(/<ArgentDort owner=/.test(stats) && /import ArgentDort from "\.\.\/ArgentDort\.jsx"/.test(stats), 'E6 la carte est dans Statistiques (pas un nouvel onglet)');
  dit(/contreauto: '5\.402\.0'/.test(S.app) && /"version": "5\.402\.0"/.test(S.manifest) && /const CODE_VERSION = '5\.402\.0';/.test(S.bg), 'E7 extension 5.402.0 : version, manifeste et capacité `contreauto`');
  const textes = [S.carte, S.rapporteJsx, S.vitesseJsx].map(sans).join('\n');
  dit(/tr\('ad\.dort\.titre'\)/.test(textes) && /tr\('ad\.reste\.moyen'/.test(textes) && /tr\('ad\.envoi\.ralenti'/.test(textes), 'E8 les nouveaux textes passent par tr()');
}

async function tout(S) {
  await partieA(S); await partieB(S); await partieC(S); await partieD(S); partieE(S);
}
const sources = () => Object.fromEntries(Object.keys(F).map((k) => [k, lire(F[k])]));

(async () => {
  if (process.argv.includes('--prouve')) {
    const base = sources();
    let rouges = 0, noms = [];
    const os = require('os');
    for (const [nom, { f, m }] of Object.entries(MUTATIONS)) {
      const S = { ...base, [f]: m(base[f]) };
      if (S[f] === base[f]) { console.log(`⚠️  mutation ${nom} : le texte visé n'existe plus`); noms.push(nom + ' (sans effet)'); continue; }
      let bgTmp = null;
      if (f === 'bg') { bgTmp = path.join(os.tmpdir(), `bg-aide-decision-${process.pid}.js`); fs.writeFileSync(bgTmp, S.bg); BG_SRC = bgTmp; }
      ok = 0; ko = 0;
      const log = console.log; console.log = () => {};
      try { await tout(S); } catch (e) { ko++; }
      console.log = log;
      BG_SRC = null; if (bgTmp) try { fs.unlinkSync(bgTmp); } catch (_) {}
      if (ko > 0) { rouges++; console.log(`✅ mutation ${nom} : ${ko} rouge(s)`); } else { noms.push(nom); console.log(`❌ mutation ${nom} : RESTE VERTE`); }
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(rouges === n ? `\n✅ preuve : ${n}/${n} mutations rendent un rouge` : `\n❌ preuve : ${noms.join(', ')}`);
    process.exit(rouges === n ? 0 : 1);
  }
  if (iSrc > 0) BG_SRC = F.bg;
  await tout(sources());
  console.log(ko ? `\n❌ audit-aide-decision : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-aide-decision : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
