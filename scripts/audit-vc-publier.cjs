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
  ctx.markVcPosted = async () => marque;
  ctx.sbGet = async (q) => (/vinted_item_details/.test(q) ? [{ data: { '1001': { description: 'Paire propre, semelle nette.', photos: ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://images1.vinted.net/t/a/f800/2.jpeg'] } } }] : []);
  ctx.compteConnecte = async () => null;
  ctx.viderFiches = async () => {};
  const vus = [];
  ctx.photosPourVestiaire = async (urls) => { vus.push(...urls); return urls.map((u) => ({ url: u, b64: 'AA==', type: 'image/jpeg' })); };
  const cmd = (msg) => new Promise((res) => { ecouteur(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' }, res); });
  const page = (msg, url, tabId) => new Promise((res) => { ecouteur(Object.assign({ from: 'cancale-vcdepot' }, msg), { tab: { id: tabId, url } }, res); });
  return { ctx, store, onglets, cmd, page, vus };
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
    dit(p && !p.publier, 'aucun feu vert de publication : VRM ne publie pas à sa place');
    const tabId = b.store.vrmPendingVc.tabId;
    const g1 = await b.page({ action: 'getPending' }, 'https://fr.vestiairecollective.com/sell/', tabId);
    dit(g1 && g1.ad && g1.ad.id === '1001', 'l\'onglet ouvert pour elle la reçoit');
    const g2 = await b.page({ action: 'getPending' }, 'https://fr.vestiairecollective.com/sell/', 999);
    dit(g2 && g2.ad === null, 'un autre onglet Vestiaire ne la reçoit pas (rien ne se remplit ailleurs)', JSON.stringify(g2));
    const g3 = await b.page({ action: 'getPending' }, 'https://www.leboncoin.fr/', tabId);
    dit(g3 && g3.ok === false, 'une page qui n\'est pas Vestiaire n\'obtient rien', JSON.stringify(g3));
    const ph = await b.page({ action: 'photoBytes', urls: ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://autre.example/x.jpg'] }, 'https://fr.vestiairecollective.com/sell/', tabId);
    dit(ph && ph.ok && b.vus.length === 1 && !b.vus.some((u) => /autre\.example/.test(u)), 'seules SES photos sont lues (jamais une adresse glissée par la page)', JSON.stringify(b.vus));
    const r2 = await b.cmd({ cmd: 'vcPreparer', id: '1001' });
    dit(r2 && r2.accepte === true && b.onglets.length === 2, 'onglet fermé : un nouveau clic rouvre Vestiaire', JSON.stringify(r2));
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
    dit(st.pub === 0, 'VRM ne clique JAMAIS « Publier »', String(st.pub));
    dit(/champ/.test(st.b) && /publies?/.test(st.b), 'le bandeau dit le chiffre et que c\'est lui qui publie', st.b);
    const form = st.envois.find((m) => m.action === 'vcForm');
    dit(!!form && form.fields.some((f) => f.name === 'description') && !JSON.stringify(form).includes('Paire propre') && !JSON.stringify(form).includes('99.00'), 'la structure du formulaire est relevée, sans aucune valeur saisie', form ? JSON.stringify(form).slice(0, 160) : 'aucun relevé');
    await nav.close();
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
