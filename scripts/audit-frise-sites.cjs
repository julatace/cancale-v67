#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA FRISE eBAY ET VESTIAIRE (3 nov.) — node scripts/audit-frise-sites.cjs [--mutations]
//  On EXÉCUTE src/friseSites.js puis la VRAIE `friseVente` (src/recapVente.js) et
//  la VRAIE projection `friseVenteFusion` : chaque étape cochée seulement PROUVÉE.
//   F1 Vestiaire : seul « done » de `etapesVc` (forme mesurée le 3 nov.) prouve ;
//      « pending » / « upcoming » jamais ; Colis fait ⇒ Postée ; annulée ⇒ pas de frise ;
//   F2 eBay : PAID (l'acheteur a payé) n'est PAS « Payée » ; FULFILLED ⇒ Postée ;
//      argent libéré (toutes les retenues RELEASED) ⇒ Payée ; NOT_HELD / HELD ⇒ non ;
//      Livrée jamais cochée seule ; annulée / remboursée ⇒ pas de frise ;
//   F3 App.jsx : la ligne Vestiaire, son récapitulatif et la ligne eBay passent par
//      ces preuves (une règle, deux formes).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };
const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
const MUTATIONS = {
  'paye-acheteur': { mod: (s) => remplace(s, '    argent: argentLibereEbay(o),', "    argent: { lu: String(o.orderPaymentStatus || '').toUpperCase() === 'PAID', t: null },", 'paye-acheteur') },
  'pending-compte': { mod: (s) => remplace(s, "=== 'done';", "!== '';", 'pending-compte') },
  'non-retenu-libere': { mod: (s) => remplace(s, 'const LIBERE = /^(RELEASED|RELEASE_CONFIRMED)$/;', 'const LIBERE = /^(RELEASED|RELEASE_CONFIRMED|NOT_HELD)$/;', 'non-retenu-libere') },
  'livree-devinee': { mod: (s) => remplace(s, '    livree: { lu: false, t: null },', "    livree: { lu: String(o.orderFulfillmentStatus || '').toUpperCase() === 'FULFILLED', t: null },", 'livree-devinee') },
  'annulee-frise': { mod: (s) => remplace(s, "  if (etat.kind === 'cancelled' || etat.kind === 'refunded') return null;\n", '', 'annulee-frise') },
  'ebay-sans-frise': { app: (s) => remplace(s, "<LigneVente gestes={gestesEbay} frise={fuE ?", "<LigneVente gestes={gestesEbay} x={fuE ?", 'ebay-sans-frise') },
};
if (args.includes('--mutations')) {
  let t = 0;
  for (const nom of Object.keys(MUTATIONS)) { const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' }); if (r.status !== 0) t++; console.log((r.status !== 0 ? '✅ tuée    ' : '❌ SURVIT  ') + nom); }
  const n = Object.keys(MUTATIONS).length; console.log(`\n${t === n ? '✅' : '❌'} mutations : ${t}/${n} tuées`); process.exit(t === n ? 0 : 1);
}
const M = MUTATION ? MUTATIONS[MUTATION] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-frise-'));
const charger = async (src, nom, tr) => {
  let s = fs.readFileSync(src, 'utf8'); if (tr) s = tr(s);
  s = s.replace(/from '(\.\.?\/[^']+)'/g, (_, f) => `from '${pathToFileURL(path.join(path.dirname(src), f)).href}'`);
  const f = path.join(tmp, nom + '.mjs'); fs.writeFileSync(f, s); return import(pathToFileURL(f).href);
};
(async () => {
  const mod = await essaie('src/friseSites.js chargé', () => charger(path.join(RACINE, 'src', 'friseSites.js'), 'frise', M && M.mod));
  const rv = await essaie('src/recapVente.js chargé', () => charger(path.join(RACINE, 'src', 'recapVente.js'), 'recap'));
  const fu = await essaie('src/design/friseFusion.js chargé', () => charger(path.join(RACINE, 'src', 'design', 'friseFusion.js'), 'fusion'));
  if (!mod || !rv || !fu) { console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  // Les segments cochés : « vendue,postee,… ».
  const coches = (p) => { if (!p) return null; const f = fu.friseVenteFusion(rv.friseVente(p)); return f.filter((e) => e.fait).map((e) => e.cle).join(','); };
  const E = (o) => ({ sellerSale: 'done', sellerShipment: 'upcoming', sellerConformity: 'upcoming', sellerDelivery: 'upcoming', sellerPayment: 'upcoming', ...o });
  await essaie('F1', () => {
    const base = { productId: 'P1', aExpedier: true, etat: 'ACTION_NEEDED', statutVc: 'shipmentInProgress', date: '2026-11-02T10:00:00Z' };
    dit(coches(mod.preuvesFriseVc({ ...base, etapesVc: E({ sellerShipment: 'pending' }) })) === 'vendue', 'F1 · la vente mesurée (sellerShipment « pending ») : Vendue seule', coches(mod.preuvesFriseVc({ ...base, etapesVc: E({ sellerShipment: 'pending' }) })));
    dit(coches(mod.preuvesFriseVc({ ...base, etapesVc: E({}) }, '2026-11-03T09:00:00Z')) === 'vendue,postee', 'F1 · « Colis fait » ⇒ Postée');
    dit(coches(mod.preuvesFriseVc({ ...base, aExpedier: false, etat: '', etapesVc: E({ sellerShipment: 'done' }) })) === 'vendue,postee', 'F1 · sellerShipment « done » ⇒ Postée');
    dit(coches(mod.preuvesFriseVc({ ...base, aExpedier: false, etat: '', etapesVc: E({ sellerDelivery: 'done' }) })) === 'vendue,postee,livree', 'F1 · sellerDelivery « done » ⇒ Livrée (Postée déduite)');
    dit(coches(mod.preuvesFriseVc({ ...base, aExpedier: false, etat: '', etapesVc: E({ sellerPayment: 'done' }) })) === 'vendue,postee,livree,payee', 'F1 · sellerPayment « done » ⇒ Payée');
    dit(coches(mod.preuvesFriseVc({ ...base, aExpedier: false, etat: '', etapesVc: E({ sellerDelivery: 'pending', sellerPayment: 'pending' }) })) === 'vendue', 'F1 · « pending » ne coche rien');
    dit(coches(mod.preuvesFriseVc({ ...base, aExpedier: false, etat: '' })) === 'vendue', 'F1 · rien de lu (ancienne extension, sans etapesVc) : Vendue seule, jamais deviné');
    dit(mod.preuvesFriseVc({ ...base, aExpedier: false, etat: 'CANCELLED' }) === null, 'F1 · annulée : pas de frise');
  });
  await essaie('F2', () => {
    const o = { orderId: '1', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: '2026-11-01T10:00:00Z', cancelStatus: { cancelState: 'NONE_REQUESTED' } };
    dit(coches(mod.preuvesFriseEbay(o)) === 'vendue', 'F2 · payée PAR L’ACHETEUR, pas envoyée : Vendue seule (PAID ≠ Payée)', coches(mod.preuvesFriseEbay(o)));
    dit(coches(mod.preuvesFriseEbay({ ...o, orderFulfillmentStatus: 'FULFILLED' })) === 'vendue,postee', 'F2 · FULFILLED ⇒ Postée (Livrée jamais devinée)', coches(mod.preuvesFriseEbay({ ...o, orderFulfillmentStatus: 'FULFILLED' })));
    const lib = { ...o, orderFulfillmentStatus: 'FULFILLED', paymentSummary: { payments: [{ paymentStatus: 'PAID', paymentHolds: [{ holdState: 'RELEASED', releaseDate: '2026-11-03T08:00:00Z' }] }] } };
    dit(coches(mod.preuvesFriseEbay(lib)) === 'vendue,postee,livree,payee', 'F2 · argent libéré lu ⇒ Payée (Livrée déduite)');
    dit(mod.preuvesFriseEbay(lib).argent.t === '2026-11-03T08:00:00.000Z', 'F2 · la date de libération LUE');
    const nh = { ...lib, paymentSummary: { payments: [{ paymentHolds: [{ holdState: 'NOT_HELD' }] }] } };
    dit(coches(mod.preuvesFriseEbay(nh)) === 'vendue,postee', 'F2 · NOT_HELD (aucune retenue) ne prouve pas le versement');
    const mix = { ...lib, paymentSummary: { payments: [{ paymentHolds: [{ holdState: 'RELEASED' }, { holdState: 'HELD' }] }] } };
    dit(coches(mod.preuvesFriseEbay(mix)) === 'vendue,postee', 'F2 · une retenue encore tenue : pas Payée');
    dit(mod.preuvesFriseEbay({ ...o, cancelStatus: { cancelState: 'CANCELED' } }) === null && mod.preuvesFriseEbay({ ...o, orderPaymentStatus: 'FULLY_REFUNDED' }) === null, 'F2 · annulée / remboursée : pas de frise');
  });
  await essaie('F3', () => {
    const app = (M && M.app ? M.app : (x) => x)(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8'));
    dit(/const preuvesVc = preuvesFriseVc\(v, fait\);/.test(app) && /const etapes = etapesVc;/.test(app) && /frise=\{fuVc \? <Frise etapes=\{fuVc\}/.test(app), 'F3 · Vestiaire : la ligne et son récapitulatif ont la MÊME frise prouvée');
    dit(/const pfE = preuvesFriseEbay\(o\);/.test(app) && /<LigneVente gestes=\{gestesEbay\} frise=\{fuE \? <Frise etapes=\{fuE\}/.test(app), 'F3 · eBay : la ligne porte la frise prouvée');
  });
  console.log(ko ? `\n❌ frise eBay / Vestiaire : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ frise eBay / Vestiaire : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
