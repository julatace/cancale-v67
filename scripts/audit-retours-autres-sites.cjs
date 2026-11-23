// ════════════════════════════════════════════════════════════════════════════
//  LE SUIVI DES RETOURS : LEBONCOIN, VESTIAIRE, EBAY (22 nov., ext. 5.435 — Julien, choix 2b)
//  La règle EXISTANTE (api/_lib/retour-vente-suivi.js) exécutée sur des ventes INVENTÉES de chaque site, puis la capture
//  du vrai background.js (scripts/_fond-vm.cjs). ⚠️ Aucun retour de ces sites n'a été mesuré : ces contrôles jugent la
//  règle et ce que la capture garde, pas la forme réelle (dite dans le récit).
//   R1 le n° que le site NOMME retour ⇒ le suivi du retour (transporteur, étapes) ; égal au n° de l'ALLER ⇒ rien ;
//   R2 un n° porté par deux retours ⇒ ni l'un ni l'autre ; 50 retours au même titre ⇒ chacun SON n°, rien par le titre ;
//   R3 « arrivé » se prouve (e-mail du transporteur du MÊME n°) — jamais par absence ;
//   R4 eBay : `returnShipmentInfo.shipmentTracking.trackingNumber` lu ⇒ la ligne de retour eBay porte son suivi ;
//   C1 la capture Leboncoin : un objet `return…` du détail ⇒ { suivi, transporteur, statut } + sa forme, sans personne ;
//   C2 la capture Vestiaire : le retour rangé dans la vente, sa 1re date gardée, jamais effacé par une lecture muette.
//  `--prouve` : chaque mutation doit rendre l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const RAC = path.join(__dirname, '..');
const MUTATIONS = {
  aller: ['api/_lib/retour-vente-suivi.js', "  if (N.some((n) => A.has(n))) return { numeros: [], suivi: '', raison: 'aller' };", ''],
  explicite: ['api/_lib/retour-vente-suivi.js', "  return suiviRetourVente({ ligne: l, lu: x.lu, aller: x.aller, track, partages, explicite: true });", "  return suiviRetourVente({ ligne: l, lu: x.lu, aller: x.aller, track, partages });"],
  partage: ['api/_lib/retour-vente-suivi.js', '  const libres = N.filter((n) => !P.has(n));', '  const libres = N;'],
  ebay: ['api/_lib/ebay-apres-vente.js', '      ...suiviRetourEbay(m),', ''],
  ebayligne: ['src/retoursStock.js', "    if (typeof suiviDe === 'function' && ligne.retourEbay.suiviRetour) {", '    if (false) {'],
  lbcclé: ['vinted-sync-extension/background.js', "    const k = Object.keys(d).find((x) => CLE_RETOUR_LBC.test(x) && d[x] && typeof d[x] === 'object');", "    const k = Object.keys(d).find((x) => d[x] && typeof d[x] === 'object');"],
  lbcpersonne: ['vinted-sync-extension/background.js', "{ if (/name|pseudo|email|phone|address|adresse/i.test(c)) continue; const v = x[c];", '{ const v = x[c];'],
  vcgarde: ['vinted-sync-extension/background.js', "suivi: /^[A-Z0-9]{6,40}$/i.test(String(m.retour.suivi || '')) ? String(m.retour.suivi) : ((prev.retourVc && prev.retourVc.suivi) || ''),", "suivi: String(m.retour.suivi || ''),"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let R = RAC;
if (mut) {
  const [f, a, b] = MUTATIONS[mut];
  R = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-ras-'));
  for (const d of ['api', 'src', 'vinted-sync-extension']) fs.cpSync(path.join(RAC, d), path.join(R, d), { recursive: true });
  fs.symlinkSync(path.join(RAC, 'node_modules'), path.join(R, 'node_modules'));
  fs.copyFileSync(path.join(RAC, 'package.json'), path.join(R, 'package.json'));
  const p = path.join(R, f), s = fs.readFileSync(p, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  fs.writeFileSync(p, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : '')); } };
const imp = (f) => import(pathToFileURL(path.join(R, f)).href + '?t=' + Date.now());
(async () => {
  const S = await imp('api/_lib/retour-vente-suivi.js');
  const E = await imp('api/_lib/ebay-apres-vente.js');
  const RS = await imp('src/retoursStock.js');
  const debut = '2026-11-18T10:00:00.000Z';
  // R1 Leboncoin
  const lbc = { txId: '900001', title: 'Nike Dunk', label: { trackingUrl: 'https://www.laposte.fr/outils/suivre-vos-envois?code=6A11111111111' }, retour: { cle: 'return_parcel', suivi: '6A22222222222', transporteur: 'Colissimo', statut: 'in_transit', at: debut } };
  let r = S.suiviRetourAutreSite({ site: 'leboncoin', vente: lbc });
  dit(r.raison === 'lu' && r.suivi === '6A22222222222' && r.transporteur === 'Colissimo' && r.etapes[0].fait && r.etapes[0].at === debut, 'R1 Leboncoin : le n° que le détail nomme retour ⇒ suivi, transporteur, « Retour accepté » daté', r);
  r = S.suiviRetourAutreSite({ site: 'leboncoin', vente: { ...lbc, retour: { ...lbc.retour, suivi: '6A11111111111' } } });
  dit(r.raison === 'aller' && !r.suivi, 'R1 Leboncoin : le n° de l’ALLER présenté comme retour ⇒ rien', r.raison);
  const vc = { productId: '55501', suivi: 'XY000000001FR', retourVc: { cle: 'buyerReturn', suivi: 'XY999999999FR', transporteur: 'Chronopost', statut: 'ONGOING', at: debut } };
  r = S.suiviRetourAutreSite({ site: 'vestiaire', vente: vc });
  dit(r.raison === 'lu' && r.suivi === 'XY999999999FR' && r.transporteur === 'Chronopost', 'R1 Vestiaire : l’étape « retour » de la frise ⇒ son n°', r);
  r = S.suiviRetourAutreSite({ site: 'vestiaire', vente: { productId: '55502', suivi: 'XY1' } });
  dit(r.raison === 'pas-de-ligne' && !r.suivi && r.etape === 'accepte', 'R1 rien de lu ⇒ « suivi pas encore lu », rien d’inventé', r.raison);
  // R2
  const partages = S.numerosPartages([S.retourDeVenteAutreSite('leboncoin', lbc).lu, S.retourDeVenteAutreSite('vestiaire', { ...vc, retourVc: { ...vc.retourVc, suivi: '6A22222222222' } }).lu]);
  r = S.suiviRetourAutreSite({ site: 'leboncoin', vente: lbc, partages });
  dit(r.raison === 'partage' && !r.suivi, 'R2 un n° porté par deux retours (deux sites) ⇒ ni l’un ni l’autre', r.raison);
  const ventes50 = Array.from({ length: 50 }, (_, i) => ({ txId: String(910000 + i), title: 'Nike Dunk Low gris taille 42', retour: { cle: 'return', suivi: '6B' + String(i).padStart(11, '0'), at: debut } }));
  const p50 = S.numerosPartages(ventes50.map((v) => S.retourDeVenteAutreSite('leboncoin', v).lu));
  const s50 = ventes50.map((v) => S.suiviRetourAutreSite({ site: 'leboncoin', vente: v, partages: p50 }).suivi);
  dit(new Set(s50).size === 50 && s50.every((x, i) => x === '6B' + String(i).padStart(11, '0')), 'R2 50 retours au même titre : chacun SON n°, aucun par le titre', s50.slice(0, 3));
  // R3
  const track = [{ suivi: '6A22222222222', status: 'delivered', receivedAt: '2026-11-21T09:00:00.000Z' }, { suivi: '6A33333333333', status: 'delivered', receivedAt: '2026-11-21T09:00:00.000Z' }];
  r = S.suiviRetourAutreSite({ site: 'leboncoin', vente: lbc, track });
  dit(r.arrive && r.arriveSource === 'email' && r.etape === 'arrive', 'R3 l’e-mail « livré » du MÊME n° ⇒ arrivé (preuve)', r);
  r = S.suiviRetourAutreSite({ site: 'vestiaire', vente: vc, track });
  dit(!r.arrive && r.etape !== 'arrive', 'R3 un autre n° livré ne prouve rien ; jamais « arrivé » par absence', r.etape);
  // R4 eBay
  const L = E.retoursEbay({ members: [{ returnId: '5000123456', orderId: '12-34567-89012', state: 'ITEM_SHIPPED', status: 'ITEM_SHIPPED', creationInfo: { item: { itemId: '1234567890', itemTitle: 'Nike' }, creationDate: { value: debut } }, returnShipmentInfo: { shipmentTracking: { trackingNumber: '1Z999AA10123456784', carrierEnum: 'UPS' } } },
    { returnId: '5000123457', orderId: '12-34567-89013', state: 'RETURN_REQUESTED', creationInfo: { item: { itemId: '1234567891' } } }] });
  dit(L && L[0].suiviRetour === '1Z999AA10123456784' && L[0].transporteurRetour === 'UPS' && L[1].suiviRetour === '', 'R4 eBay : le n° du colis retour lu s’il est donné, sinon vide', L && L.map((x) => [x.suiviRetour, x.transporteurRetour]));
  const res = RS.retoursEnCours({ ventes: [], etats: () => null, ebay: L.map((x) => ({ retour: x, compte: 'principal', num: '12' })), maintenant: Date.parse('2026-11-21T12:00:00Z'), cleNum: (v) => String(v), estArchive: () => false,
    suiviDe: (l) => (l.plateforme === 'ebay' && l.retourEbay && l.retourEbay.suiviRetour ? S.suiviRetourAutreSite({ site: 'ebay', vente: l.retourEbay, ligne: { etape: l.etape, retourLe: l.retourEbay.date }, track: [{ suivi: '1Z999AA10123456784', status: 'transit', receivedAt: '2026-11-20T09:00:00.000Z' }] }) : null) });
  const le = (res.lignes || []).find((x) => x.returnId === '5000123456');
  dit(le && le.suiviRetour && le.suiviRetour.suivi === '1Z999AA10123456784' && le.suiviRetour.etape === 'transit', 'R4 eBay : la ligne de retour porte son suivi (même règle), « En transit » par l’e-mail du même n°', le && le.suiviRetour);
  dit(!((res.lignes || []).find((x) => x.returnId === '5000123457') || {}).suiviRetour, 'R4 eBay sans n° : la ligne reste sans suivi');
  // C1 / C2 la capture (vrai background.js)
  const { faireFond } = require('./_fond-vm.cjs');
  const f = faireFond({ src: path.join(R, 'vinted-sync-extension', 'background.js'), connecte: '111', lignes: { vc_ventes: { ventes: { 55501: { productId: '55501', suivi: 'XY000000001FR' } } } } });
  if (typeof f.ctx.retourLbcDe !== 'function') dit(false, 'C1 retourLbcDe existe');
  else {
    const c = f.ctx.retourLbcDe({ is_seller: true, item: { id: '1' }, return_parcel: { status: 'in_transit', tracking: { tracking_number: '6A22222222222', carrier: 'Colissimo' }, buyer: { name: 'Jean Inventé', email: 'jean@exemple.test' } } });
    dit(c.retour && c.retour.suivi === '6A22222222222' && c.retour.transporteur === 'Colissimo' && c.retour.statut === 'in_transit' && c.retour.cle === 'return_parcel', 'C1 Leboncoin : l’objet « return_parcel » ⇒ n°, transporteur, statut', c);
    dit(Array.isArray(c.retourForme) && c.retourForme.length > 0 && !/Jean|exemple|name|email/i.test(JSON.stringify(c)), 'C1 sa forme part (chemins), sans nom ni e-mail de personne', c.retourForme);
    const c2 = f.ctx.retourLbcDe({ is_seller: true, item: { id: '1' }, parcel: { tracking_number: '6A11111111111' }, step: { status: 'returned', label: 'Retour' } });
    dit(JSON.stringify(c2) === '{}', 'C1 aucune clé « return… » ⇒ rien (jamais le colis de l’aller pris pour un retour)', c2);
    await f.ctx.rangerVcTimeline({ productId: '55501', retour: { cle: 'buyerReturn', suivi: 'XY999999999FR', transporteur: 'Chronopost', statut: 'ONGOING' } }, 'vc1');
    const v1 = JSON.parse(JSON.stringify(((f.lignes.vc_ventes || {}).ventes || {})['55501'] || {}));
    dit(v1.retourVc && v1.retourVc.suivi === 'XY999999999FR' && v1.retourVc.at && v1.suivi === 'XY000000001FR', 'C2 Vestiaire : le retour rangé dans la vente (l’aller intact)', v1);
    await new Promise((ok2) => setTimeout(ok2, 15));
    await f.ctx.rangerVcTimeline({ productId: '55501', retour: { cle: 'buyerReturn', suivi: '', statut: 'DONE' } }, 'vc1');
    const v2 = ((f.lignes.vc_ventes || {}).ventes || {})['55501'] || {};
    dit(v2.retourVc && v2.retourVc.suivi === 'XY999999999FR' && v2.retourVc.statut === 'DONE' && v2.retourVc.at === v1.retourVc.at, 'C2 une lecture qui ne dit plus le n° ne l’efface pas ; la 1re date reste', v2.retourVc);
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-retours-autres-sites : ${ok} vert(s), ${ko} rouge(s)`);
  if (mut) try { fs.rmSync(R, { recursive: true, force: true }); } catch (_) {}
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack)); process.exit(1); });
