#!/usr/bin/env node
// VESTIAIRE COMPLET (23 nov., extension 5.444.0) — « le panneau de l'extension n'affiche rien et ne marche pas du tout ».
// Causes MESURÉES en base (lecture seule, 23 nov.) et rejouées ici sur des formes réelles, valeurs INVENTÉES :
//   A · « Mes articles » : une annonce « En cours d'examen » (`{ type, unpublishedSubmitted: { product } }`) faisait
//       tomber TOUTE la page en « forme inconnue » (`vc_format_inconnu_annonces` ×4) ⇒ plus rien rangé depuis le 2 nov.,
//       annonces « sans compte », favoris jamais montrés ;
//   B · la frise d'une vente : dates, étapes, et le LITIGE (« l'acheteur a signalé un problème… paiement mis en attente ») ;
//   C · les notifications de la cloche (aime · message · autre), jamais un texte ni un nom ;
//   D · « Commandes » (achats) : `ots/orders` vide rangé comme liste VIDE connue (pas « rien lu ») ;
//   E · le panneau (vrai fond) : ventes à l'état de la RÈGLE de l'app (plus « À expédier » pour une vente livrée en
//       litige), conversations lues par leur identifiant (plus jamais « aucune » pour 103 rangées), annonces « En cours
//       d'examen », notifications utiles seulement ;
//   F · la règle du panneau = la règle de l'app (src/etatVenteVc.js) ; le litige = la même règle des deux côtés ;
//   G · les aimés d'un article pas (encore) rangé sous un compte : montrés au compte de leur notification, jamais à un autre ;
//   H · achats Vinted : « à retirer » seulement prouvé par le texte de Vinted (`needs_action` n'est PAS « à retirer »).
// `--src` / `--inject` : une autre copie (preuve sur le code d'AVANT) ; `--prouve` : mutations.
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
};
if (process.argv.includes('--prouve')) {
  const MUT = [
    ['inject', 'enveloppeStricte', "const c = Object.keys(e).filter((k) => k !== 'type'", "const c = [].filter((k) => k !== 'type'"],
    ['inject', 'pageEntiereOuRien', "else if (d.length && x.every((e) => e && typeof e === 'object' && !Array.isArray(e) && typeof e.type === 'string') && d.some(aId))", 'else if (false)'],
    ['inject', 'problemeIgnore', "const probleme = (cle && RE_PROBLEME_CLE.test(cle)) || (brut && RE_PROBLEME_TXT.test(brut)) ? true", 'const probleme = false ? true'],
    ['src', 'aExpedierSeul', "const aExp = v.aExpedier === true && (!preuve || !!(tPreuve && tAe && tAe > tPreuve));", 'const aExp = v.aExpedier === true;'],
    ['src', 'messagesParRef', ".filter(([k, x]) => x && String(x.compte || '') === moi && /^[\\w-]{3,40}$/.test(k));", ".filter(([k, x]) => x && String(x.compte || '') === moi && /^[\\w-]{3,40}$/.test(String(x.ref || '')));"],
    ['src', 'litigeIgnore', "if (v.litigeVc === true) return 'litige';", ''],
    ['src', 'aimesSansCompteNotif', "const proprio = it && it.compte ? String(it.compte) : String(inf.compte || '');", "const proprio = it && it.compte ? String(it.compte) : '';"],
    ['src', 'relaisDevine', "if (AT_RELAY(st)) return 'a_retirer';", "if (AT_RELAY(st) || tus === 'needs_action') return 'a_retirer';"],
    ['src', 'publiciteMontree', "const utiles = toutes.filter(notifVcUtile);", 'const utiles = toutes;'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-complet-'));
  let tous = true;
  for (const [quoi, nom, avant, apres] of MUT) {
    const fichierSrc = quoi === 'inject' ? F.inject : F.src;
    const txt = fs.readFileSync(fichierSrc, 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + (quoi === 'inject' ? '-vc-inject.js' : '-background.js'));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename, quoi === 'inject' ? '--inject' : '--src', fichier], { encoding: 'utf8', timeout: 240000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (ok, nom, det) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${!ok && det ? ' — ' + String(det).slice(0, 600) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const pilote = (() => {
  const t = fs.readFileSync(path.join(__dirname, 'audit-capture-vc-lbc.cjs'), 'utf8');
  const i = t.indexOf('function pageVc() {'), j = t.indexOf('const senderVc =');
  if (i < 0 || j < 0) throw new Error('pilote de page introuvable dans audit-capture-vc-lbc.cjs');
  // (5.454) le pilote sert le canal privé Vestiaire de la 5.446 (`FauxCanal`, scripts/_canal-faux.cjs).
  return new Function('fs', 'vm', 'F', 'copie', 'attendre', 'API', 'ORIGINE', 'URL', 'Buffer', 'console', 'FauxCanal', t.slice(i, j) + '\nreturn { pageVc, relais };')(fs, vm, F, copie, attendre, API, ORIGINE, URL, Buffer, console, require('./_canal-faux.cjs').FauxCanal);
})();
const MOI = '11112222', AUTRE = '99998888', ACH = '33334444', ACH2 = '44445555';
const prod = (id) => ({ id, headline: 'MARQUE', subHeadline: 'Article ' + id, picturePath: `${id}-1_3.jpg`, price: { formatted: '120 €', cents: 12000, currency: 'EUR' }, sellerEarnings: { formatted: '96 €', cents: 9600, currency: 'EUR' }, path: `/x/${id}.shtml`, segment: 's' });

// ── A · « Mes articles » avec une annonce en cours d'examen (vrai vc-inject) ──
async function partieA() {
  const p = pilote.pageVc();
  const a1 = (await p.charge(`${API}/users/me/product-listings?offset=0&limit=20`, { data: [
    { type: 'unpublishedSubmitted', unpublishedSubmitted: { product: prod(70000001) } },
    { type: 'published', published: { product: prod(70000002), listingDate: '2026-11-08T10:00:00+00:00' } }], meta: { limit: 20, offset: 0, count: 2 } })).filter((x) => x.kind === 'vcannonces');
  const it1 = a1[0] && a1[0].items || [];
  dit(a1.length === 1 && it1.length === 2 && !a1[0].inconnu && it1.find((x) => x.id === '70000001').statut === 'unpublishedSubmitted' && a1[0].total === 2, 'A1 · une annonce « En cours d’examen » à côté d’une annonce en ligne : les DEUX sont lues, avec leur statut, la page fait foi', JSON.stringify(a1).slice(0, 400));
  const a2 = (await p.charge(`${API}/users/me/product-listings?offset=0&limit=20&x=2`, { data: [
    { type: 'UNPUBLISHED_SUBMITTED', unpublishedSubmitted: { product: prod(70000003) } }], meta: { limit: 20, offset: 0, count: 1 } })).filter((x) => x.kind === 'vcannonces');
  dit(a2.length === 1 && (a2[0].items || []).length === 1 && a2[0].items[0].statut === 'unpublishedSubmitted' && !a2[0].inconnu, 'A2 · le `type` qui ne recopie pas le nom de la clé (casse) : l’enveloppe est retrouvée par son `product`, le statut est le NOM de la clé', JSON.stringify(a2).slice(0, 300));
  const a3 = (await p.charge(`${API}/users/me/product-listings?offset=0&limit=20&x=3`, { data: [
    { type: 'weird', autre: { pasDeProduit: true } },
    { type: 'published', published: { product: prod(70000004) } }], meta: { limit: 20, offset: 0, count: 2 } })).filter((x) => x.kind === 'vcannonces');
  dit(a3.length === 1 && (a3[0].items || []).length === 1 && a3[0].total === null && a3[0].inconnues === 1 && Array.isArray(a3[0].inconnu), 'A3 · une enveloppe illisible : l’annonce lisible est rangée, l’autre COMPTÉE (forme gardée), la page n’est PAS entière (rien retiré)', JSON.stringify(a3).slice(0, 300));
}

// ── B · la frise datée et le litige (vrai vc-inject) ──
function timeline(conformity) {
  return { data: { status: 'conformityInProgress', steps: {
    stepsChronology: ['sellerSale', 'sellerShipment', 'sellerDelivery', 'sellerConformity', 'sellerPayment'],
    sellerSale: { status: 'done', title: 'Vente confirmée', displayDate: 'Le 2 novembre 2026', messageKey: 'seller.sale.done' },
    sellerShipment: { status: 'done', title: 'Article expédié', displayDate: 'Le 7 novembre 2026', shipmentDetails: { trackingNumber: 'XW000000001JF', chosenCarrier: { carrierName: 'Chronopost' } } },
    sellerDelivery: { status: 'done', title: 'Article livré', displayDate: 'Le 18 novembre 2026' },
    sellerConformity: conformity,
    sellerPayment: { status: 'upcoming', title: 'Paiement' } } } };
}
async function partieB() {
  const p = pilote.pageVc();
  const b1 = (await p.charge(`${API}/contents/timeline/seller?product=70000010`, timeline({ status: 'ongoing', title: 'Évaluation de l’article', displayDate: 'Le 18 novembre 2026', message: 'Malheureusement, l’acheteur a signalé un problème avec cet article. Votre paiement a été mis en attente. Contact : test@example.com 0612345678' }))).filter((x) => x.kind === 'vctimeline');
  const f1 = b1[0] && b1[0].frise || [];
  const c1 = f1.find((x) => x.k === 'sellerConformity') || {};
  dit(f1.length === 5 && f1.map((x) => x.k).join(',') === 'sellerSale,sellerShipment,sellerDelivery,sellerConformity,sellerPayment' && f1[0].date === 'Le 2 novembre 2026', 'B1 · la frise dans l’ordre de Vestiaire, chaque étape avec sa date affichée', JSON.stringify(f1).slice(0, 400));
  dit(c1.probleme === true && /signalé un problème/.test(c1.texte) && !/example\.com|0612345678/.test(JSON.stringify(b1)), 'B2 · « l’acheteur a signalé un problème… paiement mis en attente » ⇒ problème LU ; adresse e-mail et long numéro masqués', JSON.stringify(c1));
  const b2 = (await p.charge(`${API}/contents/timeline/seller?product=70000011`, timeline({ status: 'ongoing', title: 'Évaluation de l’article', messageKey: 'seller.conformity.ongoing', message: 'Nous vérifions que l’article est conforme.' }))).filter((x) => x.kind === 'vctimeline');
  const c2 = ((b2[0] && b2[0].frise) || []).find((x) => x.k === 'sellerConformity') || {};
  dit(c2.probleme === false, 'B3 · une évaluation sans problème ⇒ `probleme: false` (jamais deviné « litige »)', JSON.stringify(c2));
}

// ── C · les notifications de la cloche (vrai vc-inject) ──
async function partieC() {
  const p = pilote.pageVc();
  const out = (await p.charge(`${API}/notification-feed/v2?category=updates`, { data: [
    { id: 'n-1', date: '2026-11-23T08:00:00Z', status: 'unread', eventType: 'custom_community', category: 'updates', textBody: 'testeuse12345 vient d’aimer votre pièce, envoyez lui un message !', productLink: { deeplink: 'vc://like_item', meta: { type: 'chat', data: { id: `${ACH}-70000001` } } }, productPicture: { url: 'https://images.vestiairecollective.com/produit/70000001-1_3.jpg' }, profileLink: { path: '/members/profile-33334444.shtml' }, profilePicture: { url: 'https://images.vestiairecollective.com/avatar.jpg' } },
    { id: 'n-2', date: '2026-11-23T08:00:00Z', status: 'read', eventType: 'custom_marketing', category: 'updates', cardTypeV2: 'marketing_push', textBody: 'Nos trouvailles pour vous', productLink: { meta: { type: 'product', data: { id: '80000001' } } } },
    { id: 'n-3', date: '2026-11-22T08:00:00Z', status: 'read', eventType: 'chat_message', category: 'messages', textBody: 'Bonjour', productLink: { meta: { type: 'chat', data: { id: `${ACH2}-70000002` } } } }], meta: { count: 3 } })).filter((x) => x.kind === 'vcnotifs');
  const c = (out[0] && out[0].cartes) || [];
  dit(c.length === 3 && c.find((x) => x.id === 'n-1').sorte === 'aime' && c.find((x) => x.id === 'n-3').sorte === 'message' && c.find((x) => x.id === 'n-2').sorte === 'autre' && c.find((x) => x.id === 'n-1').produit === '70000001', 'C1 · chaque carte : sa sorte (aime · message · autre), son article, sa date', JSON.stringify(c).slice(0, 400));
  dit(!/testeuse12345|Nos trouvailles|Bonjour|avatar|profile/i.test(JSON.stringify(c)), 'C2 · aucun texte de carte, aucun pseudo, aucun avatar ne sort de la page', JSON.stringify(out).slice(0, 300));
}

// ── D · « Commandes » (achats) vide = liste vide connue ──
async function partieD() {
  const p = pilote.pageVc();
  const d = (await p.charge(`${API}/ots/orders?offset=0&limit=20`, { meta: { limit: 20, offset: 0, count: 0 } })).filter((x) => x.kind === 'vcachats');
  dit(d.length === 1 && Array.isArray(d[0].achats) && d[0].achats.length === 0 && d[0].total === 0 && !d[0].inconnu, 'D1 · `ots/orders` vide ⇒ « aucun achat » DATÉ (une liste vide connue, pas « rien lu »)', JSON.stringify(d));
}

// ── E · le panneau, vrai fond ──
const VC_ONGLETS = 'vrmVcOnglets';
const lignesVc = () => ({
  vc_listings: { capturedAt: '2026-11-23T12:00:00Z', items: {
    70000001: { ref: '70000001', titre: 'Cabas', statut: 'unpublishedSubmitted', compte: MOI, prix: { valeur: 306, devise: 'EUR', cle: 'product.price.cents' }, photo: 'https://images.vestiairecollective.com/produit/70000001-1_3.jpg' },
    70000002: { ref: '70000002', titre: 'Santiags', statut: 'published', compte: MOI, prix: { valeur: 77, devise: 'EUR', cle: 'product.price.cents' } },
    70000009: { ref: '70000009', titre: 'Autre compte', statut: 'published', compte: AUTRE } } },
  vc_ventes: { lectures: { ventes: { at: '2026-11-23T12:48:14Z', complet: false }, 'a-expedier': { at: '2026-11-23T12:48:02Z', complet: false } }, ventes: {
    // la vente livrée EN LITIGE : `aExpedier: true` resté du 2 nov., frise lue APRÈS (le cas mesuré)
    70000010: { productId: '70000010', ref: '70000010', titre: 'Cabas GG', etat: 'IN_PROGRESS', statutVc: 'conformityInProgress', aExpedier: true, aExpedierAt: '2026-11-02T19:00:00Z', etapesAt: '2026-11-23T12:48:19Z', etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerDelivery: 'done', sellerConformity: 'ongoing', sellerPayment: 'upcoming' }, litigeVc: true, friseVc: [{ k: 'sellerDelivery', statut: 'done', date: 'Le 18 novembre 2026', cle: '', titre: 'Article livré', texte: '', probleme: null }, { k: 'sellerConformity', statut: 'ongoing', date: 'Le 18 novembre 2026', cle: '', titre: 'Évaluation de l’article', texte: 'L’acheteur a signalé un problème.', probleme: true }], suivi: 'XW000000001JF', transporteur: 'Chronopost', compte: MOI, prixVente: { valeur: 209.52 }, photo: 'https://images.vestiairecollective.com/produit/70000010-1_3.jpg', date: '2026-11-02T14:17:41+01:00' },
    70000011: { productId: '70000011', titre: 'Bottes', etat: 'IN_PROGRESS', statutVc: 'conformityInProgress', aExpedier: false, etapesAt: '2026-11-23T12:48:19Z', etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerDelivery: 'done', sellerConformity: 'ongoing', sellerPayment: 'upcoming' }, compte: MOI, date: '2026-11-13T19:06:36+01:00' },
    70000012: { productId: '70000012', titre: 'Cabas annulé', etat: 'CANCELLED', statutVc: 'shipmentComplete', aExpedier: false, etapesVc: { sellerSale: 'done', sellerShipment: 'cancelled' }, compte: MOI, date: '2026-11-18T21:36:59+01:00' },
    70000013: { productId: '70000013', titre: 'Vraiment à expédier', etat: 'ACTION_NEEDED', aExpedier: true, aExpedierAt: '2026-11-23T12:48:02Z', compte: MOI, limite: '2026-11-25T23:59:59+01:00', date: '2026-11-22T10:00:00+01:00' } } },
  vc_messages: { capturedAt: '2026-11-23T12:47:47Z', conversations: {
    [`${ACH}-70000001`]: { productId: '70000001', ref: '', compte: MOI, titre: 'Gucci Cabas', apercu: 'Merci encore', apercuDeMoi: false, date: '2026-11-20T10:00:00Z', nonLu: true, source: 'stream' },
    [`${ACH2}-70000002`]: { productId: '70000002', ref: '', compte: MOI, titre: 'Santiags', apercu: 'Bonjour', apercuDeMoi: true, date: '2026-11-16T10:00:00Z', source: 'notifications' },
    [`55556666-70000009`]: { productId: '70000009', ref: '', compte: AUTRE, titre: 'Autre', apercu: 'x' },
    [`77778888-70000002`]: { productId: '70000002', ref: '', compte: '', titre: 'Sans compte', apercu: 'y' } } },
});
function fond({ store = {}, lignes = {}, url = `${ORIGINE}/` } = {}) {
  return faireFond({ src: F.src, onglets: [{ id: 41, url, active: true, status: 'complete' }],
    store: Object.assign({ [VC_ONGLETS]: { '41': { compte: MOI, at: Date.now() } } }, store), lignes: Object.assign(lignesVc(), lignes) });
}
const senderVc = { tab: { id: 41, url: `${ORIGINE}/` }, frameId: 0 };
async function partieE() {
  const recent = new Date(Date.now() - 3600e3).toISOString();
  const f = fond({ store: { vrmVcNotifs: {
    [`${MOI}|n-1`]: { compte: MOI, id: 'n-1', at: recent, lu: false, sorte: 'aime', produit: '70000001', photo: '', mots: ['updates', 'custom_community', 'chat'] },
    [`${MOI}|n-2`]: { compte: MOI, id: 'n-2', at: recent, lu: true, sorte: 'autre', produit: '80000001', photo: '', mots: ['updates', 'marketing_push', 'custom_marketing', 'product'] },
    [`${MOI}|n-4`]: { compte: MOI, id: 'n-4', at: recent, lu: false, sorte: 'autre', produit: '70000010', photo: '', mots: ['orders', 'order_update'] },
    [`${AUTRE}|n-5`]: { compte: AUTRE, id: 'n-5', at: recent, lu: false, sorte: 'aime', produit: '70000009', mots: [] } } } });
  const r = await f.envoyer({ from: 'vrm-badge', action: 'carteListes' }, senderVc);
  const v = (r && r.ventes && r.ventes.liste) || [];
  const par = Object.fromEntries(v.map((x) => [x.tx, x]));
  dit(r && r.ok && par['70000010'] && par['70000010'].etatVc === 'litige' && par['70000010'].etat !== 'a_expedier', 'E1 · la vente livrée en litige (aExpedier resté du 2 nov.) : « En litige », plus jamais « À expédier »', JSON.stringify(par['70000010']));
  dit(par['70000011'] && par['70000011'].etatVc === 'livree_controle' && par['70000012'] && par['70000012'].etatVc === 'annulee' && par['70000013'] && par['70000013'].etatVc === 'a_expedier', 'E2 · évaluation en cours ⇒ « Livrée · évaluation » ; annulée ⇒ « Annulée » ; vraiment à expédier ⇒ « À expédier »', JSON.stringify(v.map((x) => [x.tx, x.etatVc])));
  dit(par['70000010'] && par['70000010'].photo && par['70000010'].prix === 209.52 && par['70000010'].suivi === 'XW000000001JF' && par['70000010'].ref === '70000010' && (par['70000010'].frise || []).length === 2 && par['70000010'].frise[1].probleme === true, 'E3 · chaque vente avec sa photo, son prix, sa réf., son n° de suivi et sa frise datée', JSON.stringify(par['70000010']));
  const m = (r && r.messages && r.messages.liste) || [];
  dit(m.length === 2 && m.every((x) => /^\d+-\d+$/.test(x.conv)) && r.messages.sansCompte === 1, 'E4 · les conversations rangées SOUS leur identifiant sont montrées (2 de CE compte) ; un autre compte jamais ; « sans compte » compté', JSON.stringify(r && r.messages));
  const a = r && r.annonces;
  dit(a && a.statuts && a.statuts.examen === 1 && a.statuts.en_vente === 1 && (a.toutes || []).length === 2, 'E5 · l’annonce « En cours d’examen » a SON statut ; l’annonce d’un autre compte n’est pas montrée', JSON.stringify(a && a.statuts));
  const ns = r && r.notifsSite;
  dit(ns && ns.liste.length === 2 && ns.ignorees === 1 && ns.liste.some((x) => x.sorte === 'aime') && ns.liste.some((x) => x.sorte === 'vente' && x.titre === 'Cabas GG'), 'E6 · notifications de Vestiaire : « aimé » et « vente » montrées (titre par identité), la publicité comptée, l’autre compte jamais', JSON.stringify(ns));
  dit(r && r.achats && Array.isArray(r.achats.liste), 'E7 · le panneau reçoit une liste d’achats (Vestiaire)', JSON.stringify(r && r.achats));
}

// ── F · la règle du panneau = la règle de l'app ; le litige des deux côtés ──
async function partieF() {
  const { etatVenteVc } = await import(path.join(racine, 'src/etatVenteVc.js'));
  const { litigeDeFriseVc } = await import(path.join(racine, 'api/_lib/vestiaire-regle.js'));
  const f = fond();
  const APP_VERS_CARTE = { annulee: 'annulee', aExpedier: 'a_expedier', aExpedierSansDate: 'a_expedier', aExpedierPassee: 'a_expedier', aExpedierAujourdhui: 'a_expedier', aExpedierDemain: 'a_expedier', payee: 'payee', litige: 'litige', paiement: 'paiement', valideePaiement: 'paiement', livreeControle: 'livree_controle', controle: 'expediee', expediee: 'expediee', plusAExpedier: 'vendue', vendue: 'vendue', inconnu: 'pas_su' };
  const lect = lignesVc().vc_ventes.lectures;
  const cas = Object.values(lignesVc().vc_ventes.ventes).concat([
    { etat: 'IN_PROGRESS', etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerDelivery: 'done', sellerConformity: 'done', sellerPayment: 'ongoing' } },
    { etat: 'IN_PROGRESS', etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerDelivery: 'done', sellerConformity: 'done', sellerPayment: 'done' } },
    { etat: 'IN_PROGRESS', statutVc: 'deliveryInProgress' },
    { etat: 'IN_PROGRESS' }, { etat: '' }, { etat: 'COMPLETED' }, { etat: 'payout_done' },
    { etat: 'IN_PROGRESS', aExpedier: true },
    { etat: 'IN_PROGRESS', aExpedier: true, aExpedierAt: '2026-11-23T10:00:00Z', etapesAt: '2026-11-20T10:00:00Z', etapesVc: { sellerShipment: 'done' } },
    { etat: 'IN_PROGRESS', aExpedier: true, aExpedierAt: '2026-11-19T10:00:00Z', etapesAt: '2026-11-20T10:00:00Z', etapesVc: { sellerShipment: 'done' }, litigeVc: true },
  ]);
  const ecarts = [];
  for (const v of cas) {
    const app = APP_VERS_CARTE[etatVenteVc(v, { lectures: lect }).cle];
    const carte = f.ctx.etatVenteVcCarte(v, lect);
    if (app !== carte) ecarts.push({ v: v.titre || v.etat, app, carte });
  }
  dit(!ecarts.length && cas.length >= 14, `F1 · le panneau et l’app rendent le MÊME état sur ${cas.length} ventes`, JSON.stringify(ecarts));
  const frises = [
    [{ k: 'sellerConformity', statut: 'ongoing', probleme: true }],
    [{ k: 'sellerConformity', statut: 'ongoing', probleme: false }],
    [{ k: 'sellerConformity', statut: 'done', probleme: true }],
    [{ k: 'sellerConformity', statut: 'ongoing', probleme: null }],
    [{ k: 'sellerShipment', statut: 'cancelled', probleme: true }],
    [{ k: 'sellerPayment', statut: 'pending', probleme: true }],
    [],
  ];
  const diff = frises.filter((fr) => litigeDeFriseVc(fr) !== f.ctx.litigeDeFriseVc(fr));
  dit(!diff.length && litigeDeFriseVc(frises[0]) === true && litigeDeFriseVc(frises[1]) === false && litigeDeFriseVc(frises[3]) === null, 'F2 · le litige : même règle dans l’extension et dans l’app (problème lu sur une étape en cours ⇒ oui ; lue sans problème ⇒ non ; rien lu ⇒ pas su)', JSON.stringify(diff));
}

// ── G · les aimés d'un article pas rangé sous un compte ──
async function partieG() {
  const aimes = { 70000020: { [ACH]: '2026-11-23T08:00:00Z' }, 70000021: { [ACH2]: '2026-11-22T08:00:00Z' } };
  const f = fond({ store: { vrmVcAimes: aimes, vrmVcAimesInfos: { 70000020: { compte: MOI, photo: 'https://images.vestiairecollective.com/produit/70000020-1_3.jpg' }, 70000021: { compte: AUTRE, photo: '' } } },
    lignes: { vc_listings: { items: { 70000020: { ref: '70000020', titre: 'Cabas', compte: '', prix: { valeur: 306, devise: 'EUR', cle: 'product.price.cents' } } } } } });
  const r = await f.envoyer({ from: 'vrm-badge', action: 'aimesVcCarte' }, senderVc);
  const a = (r && r.articles) || [];
  dit(r && r.ok && a.length === 1 && a[0].produit === '70000020' && a[0].n === 1 && a[0].photo && a[0].prixC === 30600, 'G1 · l’article aimé (rangé SANS compte) est montré au compte de SA notification, avec sa photo et son prix ; celui d’un autre compte jamais', JSON.stringify(r));
  dit(r && r.offre === false, 'G2 · « Faire une offre » n’existe pas sans recette apprise de son propre geste', JSON.stringify(r && r.offre));
}

// ── H · achats Vinted : « à retirer » seulement prouvé ──
async function partieH() {
  const f = fond();
  const e = (st, tus) => f.ctx.etatAchatCarte({ status: st, transaction_user_status: tus });
  const ok = e('Ton colis est disponible au point relais', 'needs_action') === 'a_retirer' && e('Commande livrée !', 'needs_action') === 'en_cours' && e('Transaction finalisée', 'completed') === 'termine' && e('Remboursement validé', 'failed') === 'annule' && e('Colis en route', 'waiting') === 'en_cours';
  dit(ok, 'H1 · achat : « à retirer » seulement quand le texte de Vinted le dit (règle AT_RELAY) ; `needs_action` seul n’est PAS « à retirer »', '');
}

// ── I · plus d'orange ni d'ambre dans l'extension (Julien, 24 nov. : « à faire » = gras + accent ardoise #3D4B5B) ──
async function partieI() {
  const dossier = path.dirname(F.src);
  const AMBRES = /#(8A4B00|874600|764300|E08A12|FFF4DD|FFEBC4|F8D79B|FFB340|F2B65E|F2A33A|B45309|D97706|FF9500|FF9F0A|F59E0B)\b|rgb\(\s*(224 138 18|255 159 10|255 179 64)/i;
  const fautes = [];
  for (const f of fs.readdirSync(dossier).filter((x) => /\.(js|html|css)$/.test(x) && !/\.min\./.test(x))) {
    fs.readFileSync(path.join(dossier, f), 'utf8').split('\n').forEach((l, i) => { if (AMBRES.test(l)) fautes.push(`${f}:${i + 1}`); });
  }
  dit(!fautes.length, 'I1 · aucune couleur orange/ambre dans l’extension (l’accent « à faire » est l’ardoise #3D4B5B, en gras)', fautes.slice(0, 8).join(' '));
}

(async () => {
  for (const [nom, fn] of [['I', partieI], ['A', partieA], ['B', partieB], ['C', partieC], ['D', partieD], ['E', partieE], ['F', partieF], ['G', partieG], ['H', partieH]]) {
    try { await fn(); } catch (e) { dit(false, `${nom} : l’audit a tourné jusqu’au bout`, String((e && e.stack) || e).slice(0, 400)); }
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${n}` : `\n✅ Vestiaire complet : ${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
