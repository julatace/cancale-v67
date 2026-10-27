// ════════════════════════════════════════════════════════════════════════════
//  VESTIAIRE COLLECTIVE : « PRÉPARER SUR VESTIAIRE » DEPUIS VRM (5.235)
//
//  Julien, 27 oct. : « je veux pouvoir le faire sur VRM directement ».
//  Ce qui doit rester vrai :
//   A. (le vrai background.js dans un `vm`) l'app n'envoie qu'un IDENTIFIANT ;
//      la paire est relue par l'extension — en ligne, numérotée, jamais prouvée
//      vendue (illisible ⇒ refus), jamais retirée du stock, jamais déjà notée
//      publiée ; acceptée ⇒ Vestiaire s'ouvre et la paire attend SON onglet.
//      Seul l'onglet ouvert pour elle la reçoit ; aucune autre page, aucun
//      autre site ; les photos demandées sont seulement les SIENNES.
//   B. (le vrai vc-depot.js dans Chromium) sur un formulaire, il remplit
//      description et prix, attache les photos, relève la STRUCTURE (jamais une
//      valeur) et ne clique JAMAIS « Publier » ; sans formulaire, il ne touche à
//      rien et dit de cliquer « Vendre un article ».
//  §4.10 : on EXÉCUTE le vrai code.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const src = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const ITEM = { id: 1001, title: 'Salomon XT-6 blanc', price: { amount: '99.00' }, brand: 'Salomon', size: '40', status: 'Très bon état', photo: { url: 'https://images1.vinted.net/t/a/f800/1.jpeg' } };
function faire({ numero = '401', vendus = [], preuveKO = false, posted = [], postedKO = false, lost = {}, ferme = false, marque = true } = {}) {
  const store = {}; const onglets = []; let ecouteur = null; let nTab = 0;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => '' } }),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, getManifest: () => ({ version: '9.9.9' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, onRemoved: { addListener() {} }, query: dual([]), sendMessage: dual(undefined), get: async () => { throw new Error('fermé'); },
        create: async (o) => { onglets.push(o.url); return { id: 70 + (nTab++) }; }, update: async () => ({}) },
      windows: { update() {} },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c]; if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined),
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: dual([]) },
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  const it = Object.assign({}, ITEM, ferme ? { is_closed: true } : {});
  ctx.lireMain = async () => ({ vinted_annonce_numeros: numero ? { '1001': { numero } } : {}, vinted_accounts: [{ vinted_user_id: 55, login: 'compte_a' }], vinted_pairs_lost: lost });
  ctx.blockedAccounts = async () => [];
  ctx.lireDressingsEnLigne = async () => ({ echec: false, lignes: [{ data: { uid: 55, payload: { items: [it] } } }], aConfirmer: [] });
  ctx.lireVentesProuvees = async () => ({ echec: preuveKO, vendus: new Set(vendus.map(String)) });
  ctx.readVcPosted = async () => ({ echec: postedKO, ids: posted.map(String) });
  const marques = [];
  ctx.markVcPosted = async (id) => { if (marque) marques.push(String(id)); return marque; };
  const ecrits = []; let vcl = null; let vcv = null; let vcm = null; let vca = null; const etat = { lectureKO: false };
  ctx.supabaseUpsert = async (t, rows) => { for (const r of rows) { ecrits.push(JSON.parse(JSON.stringify(r))); if (r.id === 'vc_listings') vcl = r.data; if (r.id === 'vc_ventes') vcv = r.data; if (r.id === 'vc_messages') vcm = r.data; if (r.id === 'vc_achats') vca = r.data; } return true; };
  ctx.notifierApp = async () => {};
  ctx.majCmd = async () => {};
  ctx.sbGet = async (q) => /vc_achats/.test(q) ? (etat.lectureKO ? null : (vca ? [{ data: JSON.parse(JSON.stringify(vca)) }] : [])) : /vc_messages/.test(q) ? (etat.lectureKO ? null : (vcm ? [{ data: JSON.parse(JSON.stringify(vcm)) }] : [])) : /vc_ventes/.test(q) ? (etat.lectureKO ? null : (vcv ? [{ data: JSON.parse(JSON.stringify(vcv)) }] : [])) : /vc_listings/.test(q) ? (etat.lectureKO ? null : (vcl ? [{ data: JSON.parse(JSON.stringify(vcl)) }] : [])) : (/vinted_item_details/.test(q) ? [{ data: { '1001': { description: 'Paire propre, semelle nette.', photos: ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://images1.vinted.net/t/a/f800/2.jpeg'] } } }] : []);
  ctx.compteConnecte = async () => null;
  ctx.viderFiches = async () => {};
  const vus = [];
  ctx.photosPourVestiaire = async (urls) => { vus.push(...urls); return urls.map((u) => ({ url: u, b64: 'AA==', type: 'image/jpeg' })); };
  const cmd = (msg) => new Promise((res) => { ecouteur(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' }, res); });
  const page = (msg, url, tabId) => new Promise((res) => { ecouteur(Object.assign({ from: 'cancale-vcdepot' }, msg), { tab: { id: tabId, url } }, res); });
  const o = { ctx, store, onglets, cmd, page, vus, ecrits, marques, ecouteur: (...a) => ecouteur(...a) };
  Object.defineProperty(o, 'lectureKO', { get: () => etat.lectureKO, set: (v) => { etat.lectureKO = v; } });
  return o;
}

(async () => {
  // ── A. Le service worker ───────────────────────────────────────────────
  await essaie('acceptée', async () => {
    const b = faire();
    const r = await b.cmd({ cmd: 'vcPreparer', id: '1001', title: 'TITRE GLISSÉ', price: '1.00' });
    dit(r && r.accepte === true && r.jobId === 'vc:1001', 'une paire en ligne, numérotée, pas vendue : acceptée', JSON.stringify(r));
    const p = b.store.vrmPendingVc && b.store.vrmPendingVc.ad;
    dit(p && /Salomon/.test(p.title) && p.price === '99.00' && p.numero === '401', 'la paire est relue par l\'extension, jamais le contenu du message', JSON.stringify(p && { t: p.title, prix: p.price }));
    dit(p && /Paire propre/.test(p.description) && /VRM-401/.test(p.description), 'sa description Vinted part avec sa référence VRM-{n°}', p && p.description);
    dit(b.onglets.length === 1 && /^https:\/\/fr\.vestiairecollective\.com\//.test(b.onglets[0]), 'Vestiaire s\'ouvre', b.onglets.join(','));
    dit(p && p.publier === true, '5.236 : feu vert de publication (sans booster) par défaut');
    const tabId = b.store.vrmPendingVc.tabId;
    const g1 = await b.page({ action: 'getPending' }, 'https://fr.vestiairecollective.com/sell/', tabId);
    dit(g1 && g1.ad && g1.ad.id === '1001', 'l\'onglet ouvert pour elle la reçoit');
    const g2 = await b.page({ action: 'getPending' }, 'https://fr.vestiairecollective.com/sell/', 999);
    dit(g2 && g2.ad === null, 'un autre onglet Vestiaire ne la reçoit pas (rien ne se remplit ailleurs)', JSON.stringify(g2));
    const g3 = await b.page({ action: 'getPending' }, 'https://www.leboncoin.fr/', tabId);
    dit(g3 && g3.ok === false, 'une page qui n\'est pas Vestiaire n\'obtient rien', JSON.stringify(g3));
    const ph = await b.page({ action: 'photoBytes', urls: ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://autre.example/x.jpg'] }, 'https://fr.vestiairecollective.com/sell/', tabId);
    dit(ph && ph.ok && b.vus.length === 1 && !b.vus.some((u) => /autre\.example/.test(u)), 'seules SES photos sont lues (jamais une adresse glissée par la page)', JSON.stringify(b.vus));
    const r2 = await b.cmd({ cmd: 'vcPreparer', id: '1001', publier: false });
    dit(r2 && r2.accepte === true && b.onglets.length === 2, 'onglet fermé : un nouveau clic rouvre Vestiaire', JSON.stringify(r2));
    dit(b.store.vrmPendingVc.ad.publier === false, 'l\'app peut demander « préparer seulement » (publier:false)');
    const tab2 = b.store.vrmPendingVc.tabId;
    const pu0 = await b.page({ action: 'publiee' }, 'https://fr.vestiairecollective.com/sell/', 999);
    dit(pu0 && pu0.ok === false && b.store.vrmPendingVc, '« publiée » venue d\'un autre onglet : rien n\'est noté', JSON.stringify(pu0));
    const lien = await b.page({ action: 'vcPublie', productId: '77001' }, 'https://fr.vestiairecollective.com/sell/', tab2);
    dit(lien && lien.ok === true && b.ecrits.some((e) => e.id === 'vc_listings' && e.data.liens['77001'] === '401'), 'l\'id de l\'annonce créée est relié à SA paire (N°401)', JSON.stringify(b.ecrits.map((e) => e.id)));
    const pu = await b.page({ action: 'publiee' }, 'https://fr.vestiairecollective.com/sell/', tab2);
    dit(pu && pu.ok === true && b.store.vrmPendingVc === null && b.marques.includes('1001'), 'confirmation vue dans SON onglet : notée publiée, le dépôt se ferme', JSON.stringify(pu));
  });
  // ── A2. Tes annonces Vestiaire et leur boost (rangerVcAnnonces) ────────
  await essaie('boost', async () => {
    const b = faire();
    const vc = (m) => new Promise((res) => b.ecouteur(Object.assign({ from: 'cancale-vc', action: 'vcAnnonces' }, m), { tab: { id: 5, url: 'https://fr.vestiairecollective.com/members/' } }, res));
    const r1 = await vc({ items: [{ id: 'a1', boost: true, cles: ['isBoosted'], ref: '401' }, { id: 'a2', boost: false, cles: ['promotion'] }, { id: 'a3', boost: null }], offset: 0, total: 3, lus: 3 });
    const d1 = (b.ecrits.filter((e) => e.id === 'vc_listings').pop() || {}).data || {};
    dit(r1 && r1.ok && d1.items && d1.items.a1.boost === true && d1.items.a2.boost === false && d1.items.a3.boost === null && d1.complet === true, 'les annonces sont rangées avec leur boost (true · false · « pas su »)', JSON.stringify(d1.items));
    const r2 = await vc({ items: [{ id: 'a1', boost: false }], offset: 0, total: 1, lus: 1 });
    const d2 = (b.ecrits.filter((e) => e.id === 'vc_listings').pop() || {}).data || {};
    dit(r2.ok && Object.keys(d2.items).join() === 'a1' && d2.items.a1.boost === false, 'une liste lue EN ENTIER remplace (le boost fini n\'est plus « boosté »)', JSON.stringify(d2.items));
    await vc({ items: [{ id: 'b9', boost: true }], offset: 20, total: 40, lus: 1 });
    const d3 = (b.ecrits.filter((e) => e.id === 'vc_listings').pop() || {}).data || {};
    dit(d3.items.a1 && d3.items.b9 && d3.complet === false, 'une page partielle complète sans rien effacer', JSON.stringify(Object.keys(d3.items)));
    const n0 = b.ecrits.length; b.lectureKO = true;
    const r4 = await vc({ items: [{ id: 'z', boost: true }], offset: 0, total: 1, lus: 1 });
    dit(r4.ok === false && b.ecrits.length === n0, 'base illisible : rien n\'est écrit (« rien lu » ne vaut pas « rien »)');
    b.lectureKO = false;
    const r5 = await new Promise((res) => b.ecouteur({ from: 'cancale-vc', action: 'vcAnnonces', items: [{ id: 'x', boost: true }], offset: 0, total: 1, lus: 1 }, { tab: { id: 5, url: 'https://www.leboncoin.fr/' } }, res));
    dit(r5.ok === false, 'une page qui n\'est pas Vestiaire ne range rien');
  });
  await essaie('ventes', async () => {
    const b = faire();
    const vv = (m) => new Promise((res) => b.ecouteur(Object.assign({ from: 'cancale-vc', action: 'vcVentes' }, m), { tab: { id: 5, url: 'https://fr.vestiairecollective.com/members/' } }, res));
    const dern = () => ((b.ecrits.filter((e) => e.id === 'vc_ventes').pop() || {}).data || {});
    const r1 = await vv({ source: 'a-expedier', ventes: [{ id: 'T1', ref: '401', etat: 'awaiting' }, { id: 'T2', ref: '402' }], offset: 0, total: 2, lus: 2 });
    dit(r1.ok && dern().ventes.T1.aExpedier === true && dern().ventes.T2.aExpedier === true, 'les ventes à expédier sont rangées « à expédier »', JSON.stringify(dern().ventes));
    await vv({ source: 'a-expedier', ventes: [{ id: 'T2', ref: '402' }], offset: 0, total: 1, lus: 1 });
    dit(dern().ventes.T1 && dern().ventes.T1.aExpedier === false && dern().ventes.T2.aExpedier === true, 'liste « à expédier » lue EN ENTIER sans T1 : T1 n\'est plus à expédier, mais n\'est jamais effacée', JSON.stringify(dern().ventes));
    await vv({ source: 'a-expedier', ventes: [], offset: 20, total: 40, lus: 0 });
    dit(dern().ventes.T2.aExpedier === true, 'une page PARTIELLE ne retire rien de « à expédier »', JSON.stringify(dern().ventes.T2));
    const n0 = b.ecrits.length; b.lectureKO = true;
    const r4 = await vv({ source: 'ventes', ventes: [{ id: 'T9' }], offset: 0, total: 1, lus: 1 });
    dit(r4.ok === false && b.ecrits.length === n0, 'base illisible : rien n\'est écrit');
  });
  await essaie('messages', async () => {
    const b = faire();
    const vm_ = (m, url) => new Promise((res) => b.ecouteur(Object.assign({ from: 'cancale-vc' }, m), { tab: { id: 5, url: url || 'https://fr.vestiairecollective.com/members/' } }, res));
    const dern = () => ((b.ecrits.filter((e) => e.id === 'vc_messages').pop() || {}).data || {});
    const nE = () => b.ecrits.filter((e) => e.id === 'vc_messages').length;
    const r1 = await vm_({ action: 'vcCompteur', messages: 3 });
    dit(r1.ok && dern().compteur && dern().compteur.messages === 3, 'le nombre de messages non lus est rangé', JSON.stringify(dern().compteur));
    const n1 = nE(); await vm_({ action: 'vcCompteur', messages: 3 }); await vm_({ action: 'vcCompteur', messages: 3 });
    dit(nE() === n1, 'le même nombre relu par la page n\'est pas réécrit à chaque fois', String(nE() - n1));
    await vm_({ action: 'vcCompteur', messages: 1 });
    dit(dern().compteur.messages === 1, 'un nombre qui CHANGE est réécrit', JSON.stringify(dern().compteur));
    const r2 = await vm_({ action: 'vcMessages', conversations: [{ id: 'C1', productId: '900001', ref: '', nonLu: true, date: '2026-10-27T09:00:00Z' }, { id: 'C2', ref: '402', nonLu: false }], offset: 0, total: 2, lus: 2, page: '/messages/' });
    dit(r2.ok && dern().conversations.C1.nonLu === true && dern().conversations.C2.ref === '402' && dern().compteur.messages === 1 && dern().lecture.page === '/messages/', 'les conversations sont rangées sans effacer le compteur, avec la page vue', JSON.stringify(dern()));
    await vm_({ action: 'vcMessages', conversations: [{ id: 'C2', ref: '402', nonLu: false }], offset: 0, total: 1, lus: 1 });
    dit(dern().conversations.C1 && dern().conversations.C1.nonLu === null, 'liste lue EN ENTIER sans C1 : C1 n\'est plus « non lue », mais n\'est jamais effacée', JSON.stringify(dern().conversations.C1));
    const n0 = b.ecrits.length; b.lectureKO = true;
    const r4 = await vm_({ action: 'vcCompteur', messages: 7 });
    dit(r4.ok === false && b.ecrits.length === n0, 'base illisible : rien n\'est écrit (« rien lu » ne vaut pas « rien »)');
    b.lectureKO = false;
    const r5 = await vm_({ action: 'vcCompteur', messages: 9 }, 'https://www.leboncoin.fr/');
    dit(r5.ok === false && dern().compteur.messages !== 9, 'une page qui n\'est pas Vestiaire ne range rien');
  });
  await essaie('achats', async () => {
    const b = faire();
    const va = (m, url) => new Promise((res) => b.ecouteur(Object.assign({ from: 'cancale-vc', action: 'vcAchats' }, m), { tab: { id: 5, url: url || 'https://fr.vestiairecollective.com/members/' } }, res));
    const dern = () => ((b.ecrits.filter((e) => e.id === 'vc_achats').pop() || {}).data || {});
    const r1 = await va({ achats: [{ id: 'A1', nom: 'Nike Dunk', etat: 'shipped', suivi: 'XW123456789FR', transporteur: 'Chronopost' }], offset: 0, total: 1, lus: 1, page: '/my-orders/' });
    dit(r1.ok && dern().achats.A1.suivi === 'XW123456789FR' && dern().lecture.complet === true, 'un achat est rangé avec son n° de suivi', JSON.stringify(dern()));
    await va({ achats: [{ id: 'A1', nom: '', etat: 'delivered', suivi: '' }], offset: 0, total: 1, lus: 1 });
    dit(dern().achats.A1.etat === 'delivered' && dern().achats.A1.suivi === 'XW123456789FR' && dern().achats.A1.nom === 'Nike Dunk', 'l\'état se met à jour ; une valeur vide n\'efface jamais une pleine', JSON.stringify(dern().achats.A1));
    await va({ achats: [{ id: 'A2' }], offset: 0, total: 1, lus: 1 });
    dit(dern().achats.A1 && dern().achats.A2, 'un achat n\'est jamais effacé', JSON.stringify(Object.keys(dern().achats)));
    const n0 = b.ecrits.length; b.lectureKO = true;
    const r4 = await va({ achats: [{ id: 'A9' }], offset: 0, total: 1, lus: 1 });
    dit(r4.ok === false && b.ecrits.length === n0, 'base illisible : rien n\'est écrit');
    b.lectureKO = false;
    const r5 = await va({ achats: [{ id: 'A8' }] }, 'https://www.vinted.fr/');
    dit(r5.ok === false && !dern().achats.A8, 'une page qui n\'est pas Vestiaire ne range rien');
  });
  const refus = async (quoi, opts, code) => essaie(quoi, async () => {
    const b = faire(opts);
    const r = await b.cmd({ cmd: 'vcPreparer', id: '1001' });
    dit(r && r.accepte === false && (!code || r.code === code) && !b.onglets.length && !b.store.vrmPendingVc, quoi, JSON.stringify(r));
  });
  await refus('prouvée vendue sur Vinted : refusée, rien ne s\'ouvre', { vendus: ['1001'] }, 'vendue');
  await refus('preuve de vente illisible : refusée (« pas su » ne vaut pas « pas vendue »)', { preuveKO: true }, 'preuve');
  await refus('sans N° de rangement : refusée', { numero: '' }, 'sans-numero');
  await refus('déjà notée publiée sur Vestiaire : refusée', { posted: ['1001'] }, 'deja-publiee');
  await refus('liste « publiées » illisible : refusée', { postedKO: true }, 'lecture');
  await refus('retirée du stock : refusée', { lost: { '401': { at: 1 } } }, 'absente');
  await refus('plus en ligne sur Vinted : refusée', { ferme: true }, 'absente');
  await essaie('identifiant', async () => { const b = faire(); const r = await b.cmd({ cmd: 'vcPreparer', id: '../1' }); dit(r && r.accepte === false && !b.onglets.length, 'un identifiant qui n\'en est pas un est refusé'); });
  await essaie('marque', async () => {
    const b = faire({ marque: false }); const r = await b.cmd({ cmd: 'vcMarque', id: '1001', etat: 'posted' });
    dit(r && r.accepte === false, '« Déjà publiée » que la base n\'a pas pris : jamais « fait »', JSON.stringify(r));
    const b2 = faire(); const r2 = await b2.cmd({ cmd: 'vcMarque', id: '1001', etat: 'posted' });
    dit(r2 && r2.accepte === true, 'l\'autre sens : notée ⇒ « fait »');
  });

  // ── B. vc-depot.js dans un vrai Chromium ────────────────────────────────
  await essaie('page', async () => {
    let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
    const nav = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const code = fs.readFileSync(path.join(EXT, 'vc-depot.js'), 'utf8');
    const AD = { id: '1001', numero: '401', title: 'Salomon XT-6 blanc T40', description: 'Paire propre.\nRéf. VRM-401', price: '99.00', photos: ['u1', 'u2'], etat: 'Très bon état', marque: 'Salomon', taille: '40' };
    const fauxChrome = (ad) => `window.__envois=[];window.chrome={runtime:{id:'x',getManifest:()=>({version:'9.9.9'}),sendMessage:(m,cb)=>{window.__envois.push(m);let r={ok:false};if(m.action==='getPending')r={ok:true,ad:${JSON.stringify(ad)}};if(m.action==='photoBytes')r={ok:true,photos:m.urls.map(()=>({b64:'/9j/AA==',type:'image/jpeg'}))};if(m.action==='vcForm')r={ok:true};setTimeout(()=>cb&&cb(r),0);}}};`;
    const FORM = `<!doctype html><html><body><header><input name="q" placeholder="Rechercher"></header>
      <form><label for="d">Description</label><textarea id="d" name="description"></textarea>
      <label for="p">Prix</label><input id="p" name="price">
      <label for="c">État</label><select id="c" name="condition"><option value="">—</option><option value="b">Bon état</option><option value="tb">Très bon état</option></select>
      <input type="file" id="f" multiple accept="image/*">
      <button type="button" id="pub" onclick="window.__pub=(window.__pub||0)+1">Publier</button></form></body></html>`;
    const ctxN = await nav.newContext();
    const pg = await ctxN.newPage();
    await ctxN.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: /sell-clothes/.test(r.request().url()) ? '<!doctype html><html><body><a href="#">Vendre un article</a></body></html>' : FORM }));
    // Sans formulaire : rien n'est touché, le bandeau dit le geste.
    await pg.addInitScript(fauxChrome(AD));
    await pg.goto('https://fr.vestiairecollective.com/sell-clothes-online/');
    await pg.addScriptTag({ content: code });
    await pg.waitForTimeout(1500);
    const b0 = await pg.evaluate(() => (document.getElementById('vrm-vc-b') || {}).innerText || '');
    dit(/Vendre un article/.test(b0), 'sans formulaire : le bandeau dit de cliquer « Vendre un article »', b0);
    const p2 = await ctxN.newPage();
    await p2.addInitScript(fauxChrome(AD));
    await p2.goto('https://fr.vestiairecollective.com/sell/');
    await p2.fill('#d', '');
    await p2.addScriptTag({ content: code });
    await p2.waitForTimeout(3500);
    const st = await p2.evaluate(() => ({ lab: (document.getElementById('c').labels[0]||{}).innerText, d: document.getElementById('d').value, p: document.getElementById('p').value, c: document.getElementById('c').value, q: document.querySelector('[name=q]').value, n: document.getElementById('f').files.length, pub: window.__pub || 0, b: (document.getElementById('vrm-vc-b') || {}).innerText || '', envois: window.__envois }));
    dit(/Paire propre/.test(st.d) && /VRM-401/.test(st.d), 'la description (avec sa référence) est remplie', st.d);
    dit(st.p === '99.00', 'le prix est rempli', st.p);
    dit(st.c === 'tb', 'l\'état : le libellé EXACT (« Très bon état », jamais « Bon état »)', st.c + ' / ' + st.lab);
    dit(st.q === '', 'la recherche de l\'en-tête n\'est jamais touchée', st.q);
    dit(st.n === 2, 'les deux photos sont attachées au formulaire', String(st.n));
    dit(st.pub === 0, 'sans feu vert (app d\'avant / « préparer seulement ») : VRM ne clique pas « Publier »', String(st.pub));
    dit(/champ/.test(st.b) && /publies?/.test(st.b), 'le bandeau dit le chiffre et que c\'est lui qui publie', st.b);
    const form = st.envois.find((m) => m.action === 'vcForm');
    dit(!!form && form.fields.some((f) => f.name === 'description') && !JSON.stringify(form).includes('Paire propre') && !JSON.stringify(form).includes('99.00'), 'la structure du formulaire est relevée, sans aucune valeur saisie', form ? JSON.stringify(form).slice(0, 160) : 'aucun relevé');

    // ── B2. 5.236 : publier tout seul, SANS BOOSTER ─────────────────────────
    const ADP = Object.assign({}, AD, { publier: true });
    const formB = ({ categorie = false, boostCoche = true, boostRecoche = false, prix = '' } = {}) => `<!doctype html><html><body><header><input name="q"></header>
      <form id="fm"><label for="d">Description</label><textarea id="d" name="description"></textarea>
      <label for="p">Prix</label><input id="p" name="price" value="${prix}">
      ${categorie ? '<label id="lc">Catégorie</label><div role="combobox" aria-labelledby="lc" aria-required="true" tabindex="0"></div>' : ''}
      <input type="file" id="f" multiple accept="image/*">
      <label><input type="checkbox" id="boost" name="boost_listing" ${boostCoche ? 'checked' : ''} ${boostRecoche ? 'onchange="setTimeout(()=>{this.checked=true},50)"' : ''}> Booster mon article — 4,99 €</label>
      <button type="button" id="payant" onclick="window.__paye=(window.__paye||0)+1">Publier avec boost (4,99 €)</button>
      <button type="button" id="annuler" onclick="window.__ann=(window.__ann||0)+1">Annuler</button>
      <button type="button" id="gratuit" onclick="window.__pub=(window.__pub||0)+1;window.__boostAuClic=document.getElementById('boost').checked;document.body.innerHTML='<h1>Merci ! Ton article est soumis et en cours de vérification.</h1>'">Publier</button>
      </form></body></html>`;
    const scen = async (quoi, html, ad, ms) => {
      const c = await nav.newContext(); const pg3 = await c.newPage();
      await c.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      await pg3.addInitScript(fauxChrome(ad));
      await pg3.goto('https://fr.vestiairecollective.com/sell/');
      await pg3.addScriptTag({ content: code });
      await pg3.waitForTimeout(ms || 9000);
      const r = await pg3.evaluate(() => ({ pub: window.__pub || 0, paye: window.__paye || 0, ann: window.__ann || 0, boostAuClic: window.__boostAuClic, b: (document.getElementById('vrm-vc-b') || {}).innerText || '', envois: window.__envois.map((m) => m.action) }));
      await c.close(); return r;
    };
    const ok1 = await scen('complet', formB(), ADP);
    dit(ok1.pub === 1 && ok1.boostAuClic === false, 'tout rempli : le boost coché est DÉCOCHÉ, puis « Publier » (gratuit) est cliqué une fois', JSON.stringify(ok1));
    dit(ok1.paye === 0 && ok1.ann === 0, 'le bouton à prix (« Publier avec boost ») et « Annuler » ne sont JAMAIS cliqués', JSON.stringify(ok1));
    dit(ok1.envois.includes('publiee'), 'la confirmation de Vestiaire est vue : « publiée » part au fond', JSON.stringify(ok1.envois));
    const ok2 = await scen('categorie', formB({ categorie: true }), ADP, 7000);
    dit(ok2.pub === 0 && /reste à choisir/i.test(ok2.b) && /Catégorie/.test(ok2.b), 'catégorie obligatoire vide : rien n\'est cliqué, le bandeau la NOMME', ok2.b);
    const ok3 = await scen('recoche', formB({ boostRecoche: true }), ADP, 7000);
    dit(ok3.pub === 0 && ok3.paye === 0 && /option payante/.test(ok3.b), 'une option payante qui se recoche : rien n\'est publié, et c\'est dit', ok3.b);
    const ok4 = await scen('prix', formB({ prix: '120' }), ADP, 7000);
    dit(ok4.pub === 0 && /prix/.test(ok4.b), 'un prix sur la page qui n\'est pas celui de VRM : rien n\'est publié', ok4.b);
    const ok5 = await scen('sansfeu', formB(), AD, 7000);
    dit(ok5.pub === 0 && ok5.paye === 0, 'sans feu vert : aucun clic', JSON.stringify(ok5));

    // ── C. vc-inject.js : le boost de tes annonces, lu dans la réponse ──────
    const inj = fs.readFileSync(path.join(EXT, 'vc-inject.js'), 'utf8');
    const cI = await nav.newContext(); const pi = await cI.newPage();
    await cI.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
    await cI.route('https://apiv2.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ meta: { limit: 20, offset: 0, count: 3 }, data: [
      { id: 900001, name: 'Salomon XT-6', description: 'Paire propre. Réf. VRM-401', isBoosted: true, seller: { email: 'secret@exemple.fr' } },
      { id: 900002, name: 'Nike', promotion: { active: false } },
      { id: 900003, name: 'Adidas', price: 50 } ] }) }));
    await pi.goto('https://fr.vestiairecollective.com/members/');
    await pi.addScriptTag({ content: 'window.__msgs=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_VC")window.__msgs.push(e.data)});' });
    await pi.addScriptTag({ content: inj });
    await pi.evaluate(() => fetch('https://apiv2.vestiairecollective.com/users/me/product-listings?offset=0&limit=20').then((r) => r.text()));
    await pi.waitForTimeout(800);
    const msgs = await pi.evaluate(() => window.__msgs.filter((m) => m.kind === 'vcannonces'));
    const it = (msgs[0] && msgs[0].items) || [];
    const parId = Object.fromEntries(it.map((x) => [x.id, x]));
    dit(parId['900001'] && parId['900001'].boost === true && parId['900001'].ref === '401', 'annonce boostée lue « boostée », reliée à la paire par sa référence VRM-401', JSON.stringify(parId['900001']));
    dit(parId['900002'] && parId['900002'].boost === false, '`promotion.active: false` ⇒ pas boostée', JSON.stringify(parId['900002']));
    dit(parId['900003'] && parId['900003'].boost === null, 'aucune clé de boost ⇒ « pas su », jamais « pas boostée »', JSON.stringify(parId['900003']));
    dit(!JSON.stringify(msgs).includes('secret@') && !JSON.stringify(msgs).includes('Paire propre'), 'aucun texte ni email de l\'annonce ne sort (seulement la référence)', JSON.stringify(msgs).slice(0, 200));
    dit(msgs[0] && msgs[0].total === 3 && msgs[0].lus === 3, 'le total annoncé part avec (liste entière ou non)', JSON.stringify(msgs[0] && { t: msgs[0].total, l: msgs[0].lus }));
    await cI.close();

    // ── D. vc-inject.js : tes VENTES, lues dans la réponse (5.237) ──────────
    const cD = await nav.newContext(); const pd = await cD.newPage();
    await cD.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
    await cD.route('https://apiv2.vestiairecollective.com/**', (r) => {
      const u = r.request().url();
      const body = /awaiting-shipping/.test(u) ? { meta: { limit: 20, offset: 0, count: 1 }, data: [{ id: 'T555', status: 'awaiting_shipping', createdAt: '2026-10-27T09:00:00Z', price: { amount: 120, currency: 'EUR' },
          product: { id: 900001, description: 'Paire propre. Réf. VRM-401' }, buyer: { firstName: 'Jeanne', lastName: 'Secret', address: { street: '12 rue Cachée' }, email: 'jeanne@exemple.fr' } }] }
        : /current-light/.test(u) ? { data: [{ id: 'PANIER1', status: 'cart' }] } : { data: [] };
      return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await pd.goto('https://fr.vestiairecollective.com/members/');
    await pd.addScriptTag({ content: 'window.__msgs=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_VC")window.__msgs.push(e.data)});' });
    await pd.addScriptTag({ content: inj });
    await pd.evaluate(() => Promise.all([fetch('https://apiv2.vestiairecollective.com/users/me/awaiting-shipping-items?offset=0').then((r) => r.text()), fetch('https://apiv2.vestiairecollective.com/orders/current-light').then((r) => r.text())]));
    await pd.waitForTimeout(800);
    const mv = await pd.evaluate(() => window.__msgs.filter((m) => m.kind === 'vcventes'));
    const v0 = mv[0] && mv[0].ventes && mv[0].ventes[0];
    dit(mv.length === 1 && mv[0].source === 'a-expedier', 'les ventes À EXPÉDIER sont lues (et jamais le panier ni les achats)', JSON.stringify(mv.map((m) => m.source)));
    dit(v0 && v0.id === 'T555' && v0.productId === '900001' && v0.ref === '401' && v0.etat === 'awaiting_shipping' && /2026-10-27/.test(v0.date), 'une vente : son id, son article, sa référence VRM-401, son état, sa date', JSON.stringify(v0));
    dit(v0 && v0.montant && v0.montant.valeur === 120 && v0.montant.devise === 'EUR' && v0.montant.cle === 'price', 'le montant part AVEC le nom de sa clé (on ne devine pas prix ou versement)', JSON.stringify(v0 && v0.montant));
    const tout = JSON.stringify(mv);
    dit(!/Jeanne|Secret|Cach|jeanne@/.test(tout), 'rien de l\'acheteur ne sort (nom, adresse, email) — ni dans la vente, ni dans sa forme', tout.slice(0, 300));
    await cD.close();

    // ── E. vc-inject.js : tes MESSAGES (5.238) ─────────────────────────────
    const cE = await nav.newContext(); const pe = await cE.newPage();
    await cE.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
    await cE.route('https://apiv2.vestiairecollective.com/**', (r) => {
      const u = r.request().url();
      const body = /notification-feed-counter/.test(u) ? { meta: { limit: 1, offset: 0, count: 1 }, data: { unseen: { updates: 2, all: 6, messages: 4 } } }
        : /\/conversations/.test(u) ? { meta: { limit: 20, offset: 0, count: 2 }, data: [
            { id: 'C777', unreadCount: 2, updatedAt: '2026-10-27T10:00:00Z', product: { id: 900001, description: 'Réf. VRM-401' }, lastMessage: { text: 'Bonjour, mon adresse est 12 rue Cachée' }, interlocutor: { firstName: 'Jeanne' }, user: { name: 'Jeanne Secret' } },
            { id: 'C778', isRead: true, product: { id: 900002 } }] }
        : /zendesk/.test(u) ? { data: [{ id: 'Z1', unread: true }], token: 'jeton-secret' } : { data: [] };
      return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await pe.goto('https://fr.vestiairecollective.com/messages/');
    await pe.addScriptTag({ content: 'window.__msgs=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_VC")window.__msgs.push(e.data)});' });
    await pe.addScriptTag({ content: inj });
    await pe.evaluate(() => Promise.all(['https://apiv2.vestiairecollective.com/notification-feed-counter/v2', 'https://apiv2.vestiairecollective.com/users/me/conversations', 'https://apiv2.vestiairecollective.com/partners/zendesk/conversations'].map((u) => fetch(u).then((r) => r.text()))));
    await pe.waitForTimeout(800);
    const me = await pe.evaluate(() => window.__msgs.filter((m) => m.kind === 'vccompteur' || m.kind === 'vcmessages'));
    const cpt = me.find((m) => m.kind === 'vccompteur'); const lm = me.filter((m) => m.kind === 'vcmessages');
    dit(cpt && cpt.messages === 4, 'le compteur de Vestiaire (`unseen.messages`) donne le nombre de non-lus', JSON.stringify(cpt));
    dit(lm.length === 1, 'les conversations sont lues, et jamais celles du support (zendesk)', String(lm.length));
    const c0 = lm[0] && lm[0].conversations.find((c) => c.id === 'C777'); const c1 = lm[0] && lm[0].conversations.find((c) => c.id === 'C778');
    dit(c0 && c0.productId === '900001' && c0.ref === '401' && c0.nonLu === true && /2026-10-27/.test(c0.date) && c1 && c1.nonLu === false, 'une conversation : son id, son article, sa référence VRM-401, « non lue », sa date', JSON.stringify(lm[0] && lm[0].conversations));
    dit(lm[0] && lm[0].page === '/messages/', 'la page où la liste a été vue part avec (VRM n\'invente pas l\'adresse)', lm[0] && lm[0].page);
    const toutE = JSON.stringify(me);
    dit(!/Jeanne|Secret|Cach|Bonjour|jeton-secret/.test(toutE), 'aucun texte de message, aucun nom ne sort — ni dans la conversation, ni dans sa forme', toutE.slice(0, 300));
    await cE.close();

    // ── F. vc-inject.js : tes ACHATS (5.239) ───────────────────────────────
    const cF = await nav.newContext(); const pf = await cF.newPage();
    await cF.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
    await cF.route('https://apiv2.vestiairecollective.com/**', (r) => {
      const u = r.request().url();
      const body = /users\/me\/orders/.test(u) ? { meta: { limit: 20, offset: 0, count: 1 }, data: [{ id: 'O42', seller: { firstName: 'Marc', lastName: 'Vendeur', createdAt: '2019-03-01T08:00:00Z', carrier: 'MarcExpress' }, status: 'shipped', createdAt: '2026-10-25T08:00:00Z', totalPrice: { amount: 88, currency: 'EUR' },
          shipment: { trackingNumber: 'xw123456789fr', carrier: 'Chronopost' }, product: { id: 700001, name: 'Dunk Low', brand: { name: 'Nike' }, seller: { firstName: 'Marc' } },
          shippingAddress: { street: '3 rue Secrète' }, buyer: { email: 'moi@exemple.fr' }, payment: { cardLast4: '4242' } }] }
        : /current-light/.test(u) ? { data: [{ id: 'PANIER1', status: 'cart', product: { id: 1, name: 'Panier' } }] }
        : /awaiting-shipping/.test(u) ? { meta: { count: 1 }, data: [{ id: 'V1', product: { id: 2 } }] } : { data: [] };
      return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await pf.goto('https://fr.vestiairecollective.com/my-orders/');
    await pf.addScriptTag({ content: 'window.__msgs=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_VC")window.__msgs.push(e.data)});' });
    await pf.addScriptTag({ content: inj });
    await pf.evaluate(() => Promise.all(['https://apiv2.vestiairecollective.com/users/me/orders?offset=0', 'https://apiv2.vestiairecollective.com/orders/current-light', 'https://apiv2.vestiairecollective.com/users/me/awaiting-shipping-items'].map((u) => fetch(u).then((r) => r.text()))));
    await pf.waitForTimeout(800);
    const ma = await pf.evaluate(() => window.__msgs.filter((m) => m.kind === 'vcachats'));
    const a0 = ma[0] && ma[0].achats && ma[0].achats[0];
    dit(ma.length === 1, 'les achats sont lus — jamais le panier, jamais les ventes à expédier', String(ma.length));
    dit(a0 && a0.id === 'O42' && a0.productId === '700001' && a0.nom === 'Nike Dunk Low' && a0.etat === 'shipped' && /2026-10-25/.test(a0.date), 'un achat : son id, son article, son nom, son état, sa date', JSON.stringify(a0));
    dit(a0 && a0.suivi === 'XW123456789FR' && a0.transporteur === 'Chronopost', 'le n° de suivi du colis et son transporteur', JSON.stringify(a0 && { s: a0.suivi, t: a0.transporteur }));
    dit(a0 && a0.montant && a0.montant.valeur === 88 && a0.montant.cle === 'totalPrice', 'le montant part avec le nom de sa clé', JSON.stringify(a0 && a0.montant));
    const toutF = JSON.stringify(ma);
    dit(!/Marc|Vendeur|Secr|moi@|4242|Panier/.test(toutF), 'rien du vendeur, de ton adresse, de ton email ni de ta carte ne sort', toutF.slice(0, 300));
    await cF.close();
    await nav.close();
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
