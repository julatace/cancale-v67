#!/usr/bin/env node
// Audit : où part un colis eBay (`destinationEbay`, api/_lib/ebay-a-expedier.js).
// Formes tirées de la doc de l'API Fulfillment (FulfillmentStartInstruction) —
// données inventées, aucun appel à eBay. `--src chemin` : lancer sur une copie.
const path = require('path');
const src = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', 'api', '_lib', 'ebay-a-expedier.js'); })();
let ok = 0, ko = 0;
const t = (nom, v) => { if (v) { ok++; console.log('✅', nom); } else { ko++; console.log('❌', nom); } };
const cmd = (fsi, prog) => ({ orderId: 'O1', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED',
  cancelStatus: { cancelState: 'NONE_REQUESTED' }, fulfillmentStartInstructions: fsi,
  lineItems: [{ title: 'Paire', sku: 'VRM-12', lineItemFulfillmentStatus: 'NOT_STARTED', ...(prog ? { program: prog } : {}) }] });
const shipTo = (c) => ({ shippingStep: { shipTo: { fullName: 'Inventé', contactAddress: { addressLine1: '1 rue', city: 'X', countryCode: c } } } });
(async () => {
  let m;
  try { m = await import('file://' + src); } catch (e) { console.log('❌ module illisible :', e.message); process.exit(1); }
  const d = m.destinationEbay;
  t('destinationEbay existe', typeof d === 'function');
  if (typeof d !== 'function') { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const g = (o) => { try { return d(o); } catch (e) { return { err: e.message }; } };
  // 1. Envoi en France : rien d'international, pas de douane.
  let r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ...shipTo('FR') }]));
  t('France : pas international', r.pays === 'FR' && r.international === false && r.douane === false);
  // 2. Direct dans l'UE : international, pas de douane.
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ...shipTo('DE') }]));
  t('Allemagne en direct : international, UE, sans douane', r.pays === 'DE' && r.international === true && r.horsUE === false && r.douane === false);
  // 3. Direct hors UE : douane.
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ...shipTo('GB') }]));
  t('Royaume-Uni en direct : douane à joindre', r.pays === 'GB' && r.horsUE === true && r.douane === true);
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ...shipTo('CH') }]));
  t('Suisse en direct : douane à joindre', r.douane === true);
  // 4. Programme d'eBay : on poste au centre en France, pays FINAL lu, eBay fait la douane.
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ebaySupportedFulfillment: true, finalDestinationAddress: { countryCode: 'US', city: 'Inventée' }, ...shipTo('FR') }]));
  t('programme eBay vers les États-Unis : pays final US, pas de douane pour le vendeur', r.programme === 'international' && r.pays === 'US' && r.international === true && r.douane === false);
  t('… et l\'adresse d\'envoi est le centre en France', r.paysEnvoi === 'FR');
  // 5. Garantie d'authenticité : même drapeau, mais PAS international.
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ebaySupportedFulfillment: true, ...shipTo('FR') }], { authenticityVerification: { status: 'PENDING' } }));
  t('garantie d\'authenticité : pas un envoi international', r.programme === 'authentification' && r.international === false);
  // 6. Programme sans pays final lisible : jamais « France » inventée.
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ebaySupportedFulfillment: true, ...shipTo('FR') }]));
  t('programme sans pays final : pays inconnu, pas « France »', r.programme === 'international' && r.pays === null && r.international === null);
  // 7. Rien lu : pas su.
  r = g(cmd([]));
  t('aucune instruction : pas su', r.pays === null && r.international === null);
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ...shipTo('fr ') }]));
  t('code pays mal écrit relu (FR)', r.pays === 'FR');
  // 8. Aucun nom ni adresse ne sort.
  r = g(cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ebaySupportedFulfillment: true, finalDestinationAddress: { countryCode: 'US', city: 'Inventée' }, ...shipTo('FR') }]));
  t('aucune donnée de l\'acheteur dans le résultat', !/Invent|1 rue/.test(JSON.stringify(r)));
  // 9. La règle des colis la porte, et le résumé compte les internationaux.
  const c = m.colisEbay([cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ...shipTo('GB') }]), { ...cmd([{ fulfillmentInstructionsType: 'SHIP_TO', ...shipTo('FR') }]), orderId: 'O2' }]);
  t('colisEbay porte la destination', c && c.aPoster.length === 2 && c.aPoster.every((x) => x.destination));
  const rs = m.resumeColisEbay(c);
  t('resumeColisEbay compte 1 international', rs && rs.international === 1);
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
