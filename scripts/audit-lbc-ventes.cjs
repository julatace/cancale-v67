// Banc : les VENTES Leboncoin sont-elles captées par vente, avec leur BORDEREAU,
// sans perte et sans écraser sur une lecture ratée ? Exécute le VRAI background.js
// dans un `vm`, sur les FORMES réelles mesurées le 20 septembre (§6.3).
// §6.1 — sur le code d'avant, `lbc_ventes` n'existe pas : aucun bordereau capté → rouge.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const racine = path.join(__dirname, '..');
const BG = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');

// FORMES RÉELLES (mesurées, anonymisées — aucun acheteur, aucune adresse).
const URL_DETAIL = 'https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/362201423';
const DETAIL = JSON.stringify({
  parcel_id: '91fa0a83', is_seller: true,
  delivery_method: 'mondial_relay', delivery_method_label: 'Mondial Relay',
  mondial_relay: { label_information: {
    reference: '71977917',
    voucher_url: 'https://cdn.leboncoin/label/71977917.pdf',
    qrcode_url: 'https://cdn.leboncoin/qr/71977917.png',
    tracking_url: 'https://mondialrelay/suivi/71977917',
  } },
  item: { id: 3271360255, title: 'Salomon XT-6 noir taille 43,5', prices: { final: 7500, total: 7500 }, type: 'ad' },
  step: { status: 'action', label: 'Colis à envoyer' },
});
const URL_LISTE = 'https://api.leboncoin.fr/api/consumergoods/proxy/v3/pages/transactions';
const LISTE = JSON.stringify([
  { id: { purchase_id: 362201423 }, item: { title: 'Salomon XT-6 noir taille 43,5', price: 7500, type: 'ad' }, step: 'ongoing', price: 7500 },
  { id: { purchase_id: 361842001 }, item: { title: 'Nike zoom', price: 5800, type: 'ad' }, step: 'ongoing', price: 5800 },
  { id: { purchase_id: 163516245 }, item: { title: 'autre', price: 1500, type: 'ad' }, step: 'cancelled', price: 1500 },
]);

let ko = 0; const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, fn) => { try { await fn(); } catch (e) { ko++; console.log('❌ ' + nom + ' — a levé : ' + e.message); } };

let lectureKO = false, ligne = {}, ecrits = [];
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
function faireCtx() {
  ecrits = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const u = String(url);
      const rep = (ok, body, status) => ({ ok, status: status || (ok ? 200 : 522), json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') { try { JSON.parse(opts.body || '[]').forEach((r) => ecrits.push(r)); } catch (_) {} return rep(true, '', 201); }
      if (lectureKO) return { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
      const m = /id=eq\.([a-zA-Z0-9_]+)&select/.exec(u);
      if (m && ligne[m[1]] !== undefined) return rep(true, JSON.stringify([{ data: ligne[m[1]] }]));
      return rep(true, '[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(BG, ctx, { filename: 'background.js' });
  return ctx;
}
const venteEcrite = () => { const w = ecrits.find((r) => r.id === 'lbc_ventes'); return w ? w.data.ventes : null; };

(async () => {
  // 1. Le détail d'une vente → bordereau capté, par vente.
  await essaie('détail → bordereau', async () => {
    ligne = {}; lectureKO = false;
    const c = faireCtx();
    await c.rangerLbcVentes(c.extraireVentesLbc(URL_DETAIL, DETAIL));
    const v = venteEcrite(); const t = v && v['362201423'];
    dit(!!t, 'la vente est rangée dans `lbc_ventes`, clé = id de transaction', t ? '362201423' : 'rien');
    dit(!!t && t.isSeller === true, 'elle porte `is_seller` (c\'est bien une vente à lui, pas un achat)');
    dit(!!t && t.stepLabel === 'Colis à envoyer', 'elle porte l\'état de la vente', t && t.stepLabel);
    dit(!!t && t.label && /\.pdf$/.test(t.label.voucherUrl) && t.label.reference === '71977917',
      'elle porte le BORDEREAU (voucher PDF + référence)', t && t.label && t.label.voucherUrl);
    dit(!!t && t.itemId === '3271360255', 'elle porte l\'id de l\'annonce Leboncoin (le futur lien vers sa paire)');
  });

  // 2. Aucune donnée perso ne transite.
  await essaie('rien de perso', async () => {
    ligne = {}; lectureKO = false;
    const c = faireCtx();
    await c.rangerLbcVentes(c.extraireVentesLbc(URL_DETAIL, DETAIL));
    const t = (venteEcrite() || {})['362201423'] || {};
    const clesOk = new Set(['txId', 'itemId', 'title', 'price', 'isSeller', 'stepStatus', 'stepLabel', 'deliveryMethod', 'deliveryLabel', 'label', 'at']);
    const intruses = Object.keys(t).filter((k) => !clesOk.has(k));
    dit(intruses.length === 0, 'aucune clé inattendue (ni acheteur, ni adresse)', intruses.join(', '));
  });

  // 3. Enrichissement : le résumé pose l'état, le détail AJOUTE le bordereau (sans perte).
  await essaie('résumé puis détail', async () => {
    ligne = {}; lectureKO = false;
    let c = faireCtx();
    await c.rangerLbcVentes(c.extraireVentesLbc(URL_LISTE, LISTE));
    let v = venteEcrite();
    dit(!!v && Object.keys(v).length === 3, 'le résumé range les 3 transactions', v ? Object.keys(v).length + '' : '0');
    dit(!!v && v['163516245'] && v['163516245'].stepStatus === 'cancelled', 'l\'état « annulée » est gardé (à ne pas proposer à l\'envoi)');
    ligne = { lbc_ventes: { ventes: v } };
    c = faireCtx();
    await c.rangerLbcVentes(c.extraireVentesLbc(URL_DETAIL, DETAIL));
    v = venteEcrite(); const t = v['362201423'];
    dit(!!t && t.title && t.label && t.label.voucherUrl, 'le détail AJOUTE le bordereau sans perdre le résumé', t && t.label && t.label.voucherUrl);
    dit(Object.keys(v).length === 3, 'les deux autres transactions ne sont pas perdues', Object.keys(v).length + '');
  });

  // 4. L'AUTRE sens : un résumé (sans bordereau) n'EFFACE pas le bordereau déjà connu.
  await essaie('détail puis résumé', async () => {
    ligne = {}; lectureKO = false;
    let c = faireCtx();
    await c.rangerLbcVentes(c.extraireVentesLbc(URL_DETAIL, DETAIL));
    const apres = venteEcrite();
    ligne = { lbc_ventes: { ventes: apres } };
    c = faireCtx();
    await c.rangerLbcVentes(c.extraireVentesLbc(URL_LISTE, LISTE));
    const t = (venteEcrite() || {})['362201423'];
    dit(!!t && t.label && t.label.voucherUrl && t.isSeller === true,
      'un résumé vide n\'écrase pas le bordereau ni `is_seller` déjà connus',
      t && t.label ? t.label.voucherUrl : 'BORDEREAU PERDU');
  });

  // 5. Fusion-safe : lecture ratée ⇒ on n'écrit rien (« rien lu ≠ rien »).
  await essaie('lecture ratée', async () => {
    ligne = { lbc_ventes: { ventes: { '362201423': { txId: '362201423', label: { voucherUrl: 'x.pdf' } } } } };
    lectureKO = true;
    const c = faireCtx();
    await c.rangerLbcVentes(c.extraireVentesLbc(URL_LISTE, LISTE));
    dit(!venteEcrite(), 'une lecture ratée n\'efface pas les ventes déjà captées');
  });

  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nCaptation des ventes Leboncoin conforme.');
  process.exit(ko ? 1 : 0);
})();
