// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'EXTENSION S'ADAPTE SUR TOUS SES SITES » (24 nov., ext. 5.448.0 — `adaptatif`)
//
//  Julien : « elle doit pouvoir marcher sur tous les sites, s'adapter » ; « hors de question qu'il y ait encore une
//  erreur ». De FAUSSES pages (jamais le vrai site) imitent ce qu'un site fait quand il change sa page : un data-testid
//  renommé, une autre langue, un bouton sans nom, deux éléments pareils, plus rien du tout. Les VRAIS fichiers de
//  l'extension y jouent leur geste (vrm-trouver.js + vrm-formulaire.js, lbc-ecrire.js, vc-ecrire.js, ebay.js) ; le
//  monde isolé est imité par un faux `chrome` (stockage, messages au fond) — jamais une requête vers un vrai site.
//
//   VINTED (republication : supprimer une annonce ; dépôt : le titre)
//    V1  « Supprimer » au data-testid renommé + fenêtre « Annuler / Supprimer » ⇒ trouvés, la PAGE envoie la suppression
//        de CETTE annonce ; le journal dit la stratégie gagnante ;
//    V2  la même page en anglais (« Delete », « Cancel / Delete item ») ⇒ pareil ;
//    V3  la fenêtre porte DEUX boutons de confirmation (« Supprimer » et « Confirmer ») ⇒ rien n'est cliqué dans la
//        fenêtre, aucune suppression ne part, l'arrêt nomme l'élément (avant : le PREMIER bouton était cliqué) ;
//    V4  plus aucun bouton « Supprimer » ⇒ rien n'est cliqué, l'arrêt nomme « supprimer », le journal liste les stratégies ;
//    V5  le champ du titre sans `#title` (libellé « Titre », nom `item_title`), une recherche dans l'en-tête ⇒ le titre
//        est tapé dans le BON champ, la recherche reste vide.
//   LEBONCOIN (le geste appris de SON envoi, que la page a changé)
//    L1  data-qa-id renommés, le reste pareil ⇒ retrouvés (signature souple), le message part, la preuve est vue ;
//    L2  tout renommé, page en anglais, bouton « Send » à icône ⇒ la table du site (champ du message, « Send ») ;
//    L3  deux champs de message pareils ⇒ RIEN n'est tapé, « champ-ambigu » ;
//    L4  aucun champ ⇒ « champ-introuvable », rien tapé, le journal (`trouveJournal`, site de l'onglet) est envoyé ;
//    L5  suppression (3 étapes apprises, data-qa-id renommés) ⇒ la rangée de CETTE annonce, puis le menu, puis la
//        confirmation ; l'autre annonce n'est jamais touchée ;
//    L6  la confirmation de suppression en double ⇒ arrêt « etape-ambigue », la suppression ne part pas ;
//    L7  un bouton aux attributs appris mais au MOT différent (« Signaler ») n'est jamais pris pour « Envoyer ».
//   VESTIAIRE
//    C1  champ et bouton appris renommés ⇒ retrouvés, le message part ;
//    C2  deux champs pareils ⇒ rien n'est tapé ;   C3  aucun champ ⇒ « champ-introuvable », journal envoyé.
//   eBAY (remplir la mise en vente — eBay ne publie jamais seul)
//    E1  page en allemand (« Titel », « Preis ») + filtre « Preis min » + recherche de l'en-tête ⇒ titre et prix dans les
//        bons champs, le filtre et la recherche restent vides ;
//    E2  « Sous-titre » AVANT « Titre » ⇒ le titre va dans « Titre » (avant : dans le sous-titre, premier venu) ;
//    E3  deux champs « Prix » pareils ⇒ AUCUN n'est rempli, le bandeau dit « le prix : … deux champs pareils … » ;
//    E4  aucun champ ⇒ rien rempli, le journal est envoyé.
//  `--ext <dossier>` : une autre copie de l'extension (rouge attendu sur origin/main) ; `--mutation nom` ; `--prouve`.
//  SHOTS=<dossier> : une capture par cas.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require('playwright');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
let EXT = arg('--ext') || process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const MUTATIONS = {
  // La couche ne garde plus « un seul gagnant » : le premier au meilleur score gagne.
  'premier-gagne': ['vrm-trouver.js', '    if (meilleurs.length !== 1) return { el: null, nom, ambigu: true, essais, n: meilleurs.length };', ''],
  // La signature souple n'exige plus le mot du bouton appris.
  'souple-sans-mot': ['vrm-trouver.js', '      if (mot && !motOk) continue;', ''],
  // Les exclusions des champs (en-tête, recherche, filtres min/max) retirées.
  'sans-exclusions': ['vrm-trouver.js', "garder: (el) => saisissable(el) && !dansDialogue(el) && !horsDepot(el) &&", 'garder: (el) => saisissable(el) && !dansDialogue(el) &&'],
  // Leboncoin n'essaie plus que la signature exacte.
  'lbc-exact-seul': ['lbc-ecrire.js', '    if (!r.el && !r.n) r = trouverAdapte(sig, dans, table, ctx);', ''],
  // Le journal n'est plus rendu au fond.
  'lbc-sans-journal': ['lbc-ecrire.js', "    } finally { ordreEnCours = false; rendreTrouves(quoi); }", '    } finally { ordreEnCours = false; }'],
  // La confirmation de suppression Vinted reprend « le premier bouton qui contient supprimer ».
  'vinted-premier-bouton': ['vrm-formulaire.js', "        if (parId.length > 1) return null;\n        return null;", "        if (parId.length > 1) return null;\n        return bs.find((x) => /supprimer|confirmer|delete|confirm/i.test(x.textContent || '') && !interdit(x)) || null;"],
};
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation', m], { encoding: 'utf8', env: Object.assign({}, process.env, { SHOTS: '' }) });
    const rouge = r.status === 1 && /❌ /.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
if (arg('--mutation')) {
  const M = MUTATIONS[arg('--mutation')]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-adaptatif-'));
  for (const f of fs.readdirSync(EXT)) if (/\.js$/.test(f)) fs.copyFileSync(path.join(EXT, f), path.join(tmp, f));
  const s = fs.readFileSync(path.join(tmp, M[0]), 'utf8');
  if (!s.includes(M[1])) { console.log('mutation introuvable'); process.exit(2); }
  fs.writeFileSync(path.join(tmp, M[0]), s.split(M[1]).join(M[2]));
  EXT = tmp;
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} });
}
const lire = (f) => { try { return fs.readFileSync(path.join(EXT, f), 'utf8'); } catch (_) { return ''; } };
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };

// Le faux monde isolé : `chrome.storage.local` (à état), `chrome.runtime.sendMessage` (noté, et la réponse du faux fond).
const FAUX_CHROME = (store, reponses) => `(() => {
  const store = ${JSON.stringify(store || {})};
  const rep = ${JSON.stringify(reponses || {})};
  window.__envois = []; window.__store = store;
  const ch = { runtime: { id: 'banc-ext', lastError: undefined, getManifest: () => ({ version: '5.448.0' }), onMessage: { addListener() {} },
      sendMessage(m, cb) { window.__envois.push(m); const r = rep[m && m.action] || { ok: true }; if (typeof cb === 'function') setTimeout(() => cb(r), 0); return Promise.resolve(r); } },
    storage: { local: {
      get(k) { const cles = Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k || {}); const o = {}; for (const c of cles) if (store[c] !== undefined) o[c] = JSON.parse(JSON.stringify(store[c])); return Promise.resolve(o); },
      set(o) { Object.assign(store, JSON.parse(JSON.stringify(o))); return Promise.resolve(); } } } };
  try { Object.defineProperty(window, 'chrome', { value: ch, configurable: true, writable: true }); } catch (_) { window.chrome = ch; }
})();`;
const STYLE = `<style>body{margin:0;font:15px/1.4 system-ui,sans-serif;background:#fff;color:#111}header{display:flex;gap:10px;align-items:center;height:52px;padding:0 14px;border-bottom:1px solid #ddd}
main{padding:16px;max-width:760px}button{min-height:40px;padding:0 14px;margin:4px;border:1px solid #bbb;border-radius:8px;background:#f4f4f4}textarea,input{display:block;width:100%;box-sizing:border-box;margin:6px 0 12px;padding:8px;border:1px solid #bbb;border-radius:8px;font:inherit}
[role=dialog]{position:fixed;left:50%;top:30%;transform:translateX(-50%);background:#fff;border:1px solid #888;border-radius:12px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.25)}.row{border:1px solid #ddd;border-radius:10px;padding:10px;margin:8px 0}.menu[hidden]{display:none}</style>`;

async function ouvrir(b, url, html, routeur) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (routeur) { const x = routeur(r.request(), u); if (x) return r.fulfill(x); }
    return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  await pg.goto(url);
  return { ctx, pg, errs };
}
const injecter = async (pg, fichiers, avant) => { if (avant) await pg.addScriptTag({ content: avant }); for (const f of fichiers) { const t = lire(f); if (t) await pg.addScriptTag({ content: t }); } };
const capture = async (pg, nom) => { if (!process.env.SHOTS) return; try { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, nom + '.png') }); } catch (_) {} };

// ══ VINTED ════════════════════════════════════════════════════════════════════
const ITEM = '123456';
const PAGE_VINTED = (o) => `<!doctype html><html lang="${o.lang || 'fr'}"><head><meta charset="utf-8"><title>Vinted (banc)</title>${STYLE}</head><body>
<header><b style="margin-right:auto">Vinted</b><input id="search_text" name="search_text" placeholder="${o.lang === 'en' ? 'Search' : 'Rechercher des articles'}" style="width:260px;margin:0"></header>
<main id="m">${o.corps || ''}</main>
<script>(() => {
  window.__clics = [];
  const O = ${JSON.stringify(o)};
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button'); if (!b) return;
    window.__clics.push(b.getAttribute('data-k') || b.textContent.trim());
    if (b.getAttribute('data-k') === 'supprimer') { const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.innerHTML = O.dialogue; document.body.appendChild(d); }
    if (b.getAttribute('data-k') === 'confirmer') fetch('/api/v2/items/${ITEM}/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  }, true);
})();</script></body></html>`;
async function etapeVinted(pg, e, d) {
  await injecter(pg, ['vrm-trouver.js', 'vrm-formulaire.js']);
  return (await pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}])) || {};
}
const routeVinted = (j) => (req, u) => {
  if (u.pathname === `/api/v2/items/${ITEM}/delete` && req.method() === 'POST') { j.suppressions.push(u.pathname); return { status: 200, contentType: 'application/json', body: '{"code":0}' }; }
  return null;
};

// ══ LEBONCOIN ════════════════════════════════════════════════════════════════
const CONV = 'abc123def';
const PONT_LBC = (moi, conv) => `(() => { window.__ecoutes = []; window.__vrmLbcPont = { ecouter: (fn) => window.__ecoutes.push(fn), pret: () => true, etat: async () => ({ moi: ${JSON.stringify(moi)}, conv: ${JSON.stringify(conv)} }) }; })();`;
const PAGE_LBC_MSG = (o) => `<!doctype html><html lang="${o.lang || 'fr'}"><head><meta charset="utf-8"><title>Leboncoin (banc)</title>${STYLE}</head><body>
<header><b style="margin-right:auto">leboncoin</b><input type="search" name="q" placeholder="Rechercher" style="width:240px;margin:0"></header>
<main><p>Conversation</p>${o.corps}</main>
<script>(() => {
  window.__envoye = [];
  document.addEventListener('submit', (e) => e.preventDefault(), true);   // la page envoie en JavaScript, comme le vrai site
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button'); if (!b || !b.hasAttribute('data-envoi')) return;
    const f = b.closest('form') || document; const t = f.querySelector('textarea, [contenteditable="true"]');
    const v = t ? (t.value != null && t.tagName === 'TEXTAREA' ? t.value : t.textContent) : '';
    window.__envoye.push(v);
    setTimeout(() => (window.__ecoutes || []).forEach((fn) => fn({ kind: 'lbcgestevu', quoi: 'message', conv: '${CONV}', texte: v, statut: 200, moi: 'moi-lbc' })), 120);
  }, true);
})();</script></body></html>`;
const UI_LBC_MSG = { message: { champ: { tag: 'textarea', ce: false, attrs: { 'data-qa-id': 'message-input', name: 'body' } }, envoi: { sig: { tag: 'button', ce: false, attrs: { 'data-qa-id': 'send-button', type: 'submit' }, mot: 'Envoyer' } }, page: { modele: '/messages/id/{conv}', recherche: '', porte: true } } };
const ADS = ['1111111', '2222222'];
const ROW = (id, conf) => `<div class="row"><a href="/ad/chaussures/${id}">Nike Air Max 90 — 42</a> <button data-qa-id="ad-actions-v2" data-k="plus-${id}">Plus</button><div class="menu" hidden><button data-qa-id="remove-ad-v2" data-k="menu-${id}">Supprimer</button></div></div>`;
const PAGE_LBC_SUP = (o) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Leboncoin (banc)</title>${STYLE}</head><body>
<header><b>leboncoin</b></header><main><h1>Mes annonces</h1>${ADS.map((id) => ROW(id)).join('')}</main>
<script>(() => {
  window.__clics = []; window.__supprime = []; let cible = '';
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button'); if (!b) return;
    const k = b.getAttribute('data-k') || b.textContent.trim(); window.__clics.push(k);
    if (/^plus-/.test(k)) { b.parentElement.querySelector('.menu').hidden = false; }
    if (/^menu-/.test(k)) { cible = k.slice(5); const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.innerHTML = ${JSON.stringify(o.dialogue)}; document.body.appendChild(d); }
    if (k === 'confirmer') { window.__supprime.push(cible); setTimeout(() => (window.__ecoutes || []).forEach((fn) => fn({ kind: 'lbcgestevu', quoi: 'supprime', ids: [cible], statut: 200, moi: 'moi-lbc' })), 120); }
  }, true);
})();</script></body></html>`;
const UI_LBC_SUP = { supprime: { etapes: [
  { sig: { tag: 'button', ce: false, attrs: { 'data-qa-id': 'ad-actions' }, mot: 'Plus' }, portee: 'ligne' },
  { sig: { tag: 'button', ce: false, attrs: { 'data-qa-id': 'remove-ad' }, mot: 'Supprimer' }, portee: 'page' },
  { sig: { tag: 'button', ce: false, attrs: { 'data-qa-id': 'confirm-delete' }, mot: 'Supprimer définitivement' }, portee: 'page' },
], page: { modele: '/compte/part/mes-annonces', recherche: '', porte: false } } };

// ══ VESTIAIRE ════════════════════════════════════════════════════════════════
const VCONV = 'c-77881';
const PAGE_VC = (o) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vestiaire (banc)</title>${STYLE}</head><body>
<header><b style="margin-right:auto">Vestiaire Collective</b><input type="search" placeholder="Rechercher" style="width:240px;margin:0"></header><main>${o.corps}</main>
<script>(() => {
  window.__envoye = [];
  window.addEventListener('message', (ev) => { const d = ev.data; if (!d || d.__tag !== 'CANCALE_VC_ORDRE' || d.kind !== 'convouverte') return; window.postMessage({ __tag: 'CANCALE_VC', kind: 'vcconvouverte', jeton: d.jeton, conv: '${VCONV}', moi: 'vc-moi', at: Date.now() }, location.origin); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button'); if (!b || !b.hasAttribute('data-envoi')) return;
    const t = document.querySelector('textarea'); const v = t ? t.value : ''; window.__envoye.push(v);
    setTimeout(() => window.postMessage({ __tag: 'CANCALE_VC', kind: 'vcenvoivu', conv: '${VCONV}', t: v }, location.origin), 120);
  }, true);
})();</script></body></html>`;
const UI_VC = { vrmVcUi: { champ: { tag: 'textarea', ce: false, attrs: { 'data-testid': 'chat-input' } }, envoi: { mode: 'bouton', tag: 'button', ce: false, attrs: { 'data-testid': 'chat-send', type: 'button' }, mot: 'Envoyer' }, adresse: { modele: '/messages/{conv}' } } };

// ══ eBAY ═════════════════════════════════════════════════════════════════════
const AD = { numero: '124', title: 'Nike Air Max 90 blanche 42', description: 'Très bon état. VRM-124', price: '65', sku: 'VRM-124', photos: [] };
const PAGE_EBAY = (o) => `<!doctype html><html lang="${o.lang || 'fr'}"><head><meta charset="utf-8"><title>eBay (banc)</title>${STYLE}</head><body>
<header id="gh"><b style="margin-right:auto">ebay</b><input name="_nkw" id="gh-ac" placeholder="Rechercher" style="width:240px;margin:0"></header>
<main><form id="f">${o.corps}</form></main></body></html>`;
const valeurs = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('input, textarea')].map((e, i) => [e.id || e.name || ('#' + i), e.value])));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const cas = async (nom, fn) => { try { await fn(); } catch (x) { dit(false, `${nom} — a levé`, x && x.stack); } };
  try {
    console.log('— Vinted');
    const supVinted = async (nom, o, juge) => cas(nom, async () => {
      const j = { suppressions: [] };
      const t = await ouvrir(b, `https://www.vinted.fr/items/${ITEM}-nike-air-max`, PAGE_VINTED(o), routeVinted(j));
      try { const r = await etapeVinted(t.pg, 'supprimer', { id: ITEM, cle: 'k' + nom }); await capture(t.pg, nom); await juge(r, await t.pg.evaluate(() => window.__clics.slice()), j); if (t.errs.length) dit(false, `${nom} : aucune erreur de page`, t.errs.join(' | ')); }
      finally { await t.ctx.close(); }
    });
    await supVinted('V1', { corps: '<h1>Nike Air Max 90</h1><p>42 · 65 €</p><button data-testid="item-delete-cta" aria-label="Supprimer" data-k="supprimer">🗑</button><button data-k="modifier">Modifier l\'annonce</button>',
      dialogue: '<p>Supprimer cet article ?</p><button data-k="annuler">Annuler</button><button data-k="confirmer">Supprimer</button>' }, async (r, l, j) => {
      dit(r.ok === true && j.suppressions.length === 1, 'V1 data-testid renommé : « Supprimer » puis la confirmation trouvés, la PAGE envoie la suppression de CETTE annonce', JSON.stringify({ r: { ok: r.ok, code: r.code, manque: r.manque }, l, j }));
      dit(!l.includes('annuler') && !l.includes('modifier'), 'V1 ni « Annuler » ni « Modifier » touchés', JSON.stringify(l));
      dit(Array.isArray(r.trouves) && r.trouves.some((x) => x.nom === 'supprimer' && x.s) && r.trouves.some((x) => x.nom === 'supprimerConfirmer' && x.s === 'nom'), 'V1 la stratégie gagnante est rendue au fond (mémoire)', JSON.stringify(r.trouves));
    });
    await supVinted('V2', { lang: 'en', corps: '<h1>Nike Air Max 90</h1><button data-k="supprimer">Delete</button><button data-k="modifier">Edit listing</button>',
      dialogue: '<p>Delete this item?</p><button data-k="annuler">Cancel</button><button data-k="confirmer">Delete item</button>' }, async (r, l, j) => {
      dit(r.ok === true && j.suppressions.length === 1 && l.join() === 'supprimer,confirmer', 'V2 page en anglais (« Delete », « Cancel / Delete item ») ⇒ les deux bons boutons, dans l’ordre', JSON.stringify({ ok: r.ok, m: r.manque, l }));
    });
    await supVinted('V3', { corps: '<h1>Nike</h1><button data-testid="item-delete-button" data-k="supprimer">Supprimer</button>',
      dialogue: '<p>Que veux-tu faire ?</p><button data-k="confirmer">Supprimer</button><button data-k="confirmer">Confirmer</button><button data-k="annuler">Annuler</button>' }, async (r, l, j) => {
      dit(r.ok === false && r.code === 'selecteur' && /^supprimer-confirmation/.test(String(r.manque)) && j.suppressions.length === 0, 'V3 deux boutons de confirmation ⇒ AUCUNE suppression ne part, l’arrêt nomme la confirmation', JSON.stringify({ r: { ok: r.ok, code: r.code, manque: r.manque }, j }));
      dit(l.join() === 'supprimer', 'V3 rien n’est cliqué dans la fenêtre', JSON.stringify(l));
    });
    await supVinted('V4', { corps: '<h1>Nike</h1><button data-k="modifier">Modifier l\'annonce</button><button data-k="favori">♡ Favori</button>', dialogue: '' }, async (r, l, j) => {
      dit(r.ok === false && r.code === 'selecteur' && r.manque === 'supprimer' && l.length === 0 && j.suppressions.length === 0, 'V4 plus de bouton « Supprimer » ⇒ rien n’est cliqué, l’arrêt nomme « supprimer »', JSON.stringify({ r: { ok: r.ok, code: r.code, manque: r.manque }, l }));
      const e = (r.trouves || []).find((x) => x.nom === 'supprimer');
      dit(!!e && e.s === '' && Array.isArray(e.essais) && e.essais.length >= 2 && e.essais.every((q) => typeof q.n === 'number'), 'V4 le journal : chaque stratégie essayée et son compte (aucun texte)', JSON.stringify(r.trouves));
    });
    await cas('V5', async () => {
      const corps = '<h1>Vends ton article</h1><label for="f-t">Titre</label><input id="f-t" name="item_title" placeholder="ex : Chemise Sézane verte"><label for="f-d">Décris ton article</label><textarea id="f-d" name="item_description"></textarea>';
      const t = await ouvrir(b, 'https://www.vinted.fr/items/new', PAGE_VINTED({ corps }));
      try {
        const r = await etapeVinted(t.pg, 'champ', { quoi: 'titre', valeur: 'Nike Air Max 90' });
        const v = await valeurs(t.pg); await capture(t.pg, 'V5');
        dit(r.ok === true && v['f-t'] === 'Nike Air Max 90' && v.search_text === '', 'V5 sans `#title` : le titre va dans le champ « Titre », la recherche de l’en-tête reste vide', JSON.stringify({ r: { ok: r.ok, code: r.code, manque: r.manque }, v }));
      } finally { await t.ctx.close(); }
    });

    console.log('— Leboncoin');
    const msgLbc = async (nom, corps, store, juge, lang) => cas(nom, async () => {
      const t = await ouvrir(b, `https://www.leboncoin.fr/messages/id/${CONV}`, PAGE_LBC_MSG({ corps, lang }));
      try {
        await injecter(t.pg, ['vrm-trouver.js', 'lbc-ecrire.js'], FAUX_CHROME({ vrmLbcUi: store }) + PONT_LBC('moi-lbc', CONV));
        const r = await t.pg.evaluate((m) => window.__vrmLbcEcrireTest.executer(m), { quoi: 'message', conv: CONV, texte: 'Bonjour, toujours dispo', compte: 'moi-lbc' });
        await new Promise((x) => setTimeout(x, 200));
        await capture(t.pg, nom);
        await juge(r || {}, await t.pg.evaluate(() => ({ envoye: window.__envoye.slice(), envois: window.__envois.slice(), champs: [...document.querySelectorAll('textarea')].map((x) => x.value) })));
      } finally { await t.ctx.close(); }
    });
    await msgLbc('L1', '<form><textarea data-qa-id="message-input-2025" name="body" placeholder="Écrivez votre message"></textarea><button type="submit" data-qa-id="send-cta" data-envoi>Envoyer</button></form>', UI_LBC_MSG, async (r, p) => {
      dit(r.confirme === true && p.envoye.length === 1 && p.envoye[0] === 'Bonjour, toujours dispo', 'L1 data-qa-id renommés ⇒ le champ et « Envoyer » retrouvés (signature souple), la page envoie CE texte, la preuve est vue', JSON.stringify({ r, p }));
      const jr = p.envois.find((m) => m.action === 'trouveJournal');
      dit(!!jr && jr.from === 'cancale-lbc' && jr.trouves.some((x) => x.s === 'souple'), 'L1 ce qui a gagné est rendu au fond (`trouveJournal`)', JSON.stringify(jr));
    });
    await msgLbc('L2', '<form><textarea placeholder="Write your message"></textarea><button type="button" aria-label="Send" data-envoi><svg width="16" height="16"><path d="M0 0L16 8L0 16z"/></svg></button></form>', UI_LBC_MSG, async (r, p) => {
      dit(r.confirme === true && p.envoye.length === 1, 'L2 tout renommé, page en anglais, « Send » à icône ⇒ la table du site trouve le champ et le bouton, le message part', JSON.stringify({ r, p }));
      const jr = p.envois.find((m) => m.action === 'trouveJournal');
      dit(!!jr && jr.trouves.some((x) => x.nom === 'champMessage' && x.s) && jr.trouves.some((x) => x.nom === 'envoyer' && x.s === 'nom'), 'L2 le journal dit les stratégies gagnantes (table)', JSON.stringify(jr && jr.trouves));
    }, 'en');
    await msgLbc('L3', '<form><textarea placeholder="Écrivez votre message"></textarea><button type="submit" data-envoi>Envoyer</button></form><form><textarea placeholder="Écrivez votre message"></textarea><button type="submit" data-envoi>Envoyer</button></form>', UI_LBC_MSG, async (r, p) => {
      dit(r.erreur === 'champ-ambigu' && p.envoye.length === 0 && p.champs.every((v) => v === ''), 'L3 deux champs de message pareils ⇒ RIEN n’est tapé ni envoyé, « champ-ambigu »', JSON.stringify({ r, p }));
    });
    await msgLbc('L4', '<p>Cette conversation est fermée.</p>', UI_LBC_MSG, async (r, p) => {
      dit(r.erreur === 'champ-introuvable' && p.envoye.length === 0, 'L4 aucun champ ⇒ « champ-introuvable », rien tapé', JSON.stringify(r));
      const jr = p.envois.find((m) => m.action === 'trouveJournal');
      const e = jr && jr.trouves.find((x) => x.nom === 'champMessage');
      dit(!!e && e.s === '' && e.essais.length >= 3 && !JSON.stringify(jr).includes('Bonjour'), 'L4 le journal part au fond : l’élément, chaque stratégie et son compte — jamais le texte', JSON.stringify(jr));
    });
    // L7 : un bouton qui garde les attributs appris (data-qa-id, type) mais pas le MOT (« Signaler ») n'est jamais pris pour « Envoyer ».
    await msgLbc('L7', '<form><textarea name="body" placeholder="Écrivez votre message"></textarea><button type="submit" data-qa-id="send-button" data-signaler>Signaler</button><button type="button" aria-label="Envoyer" data-envoi>➤</button></form>', UI_LBC_MSG, async (r, p) => {
      dit(r.confirme === true && p.envoye.length === 1, 'L7 « Signaler » garde les attributs appris mais pas le mot ⇒ jamais pris ; le vrai « Envoyer » (son nom) part', JSON.stringify({ r, p }));
    });
    const supLbc = async (nom, dialogue, juge) => cas(nom, async () => {
      const t = await ouvrir(b, 'https://www.leboncoin.fr/compte/part/mes-annonces', PAGE_LBC_SUP({ dialogue }));
      try {
        await injecter(t.pg, ['vrm-trouver.js', 'lbc-ecrire.js'], FAUX_CHROME({ vrmLbcUi: UI_LBC_SUP }) + PONT_LBC('moi-lbc', ''));
        const r = await t.pg.evaluate((m) => window.__vrmLbcEcrireTest.executer(m), { quoi: 'supprime', id: ADS[1], compte: 'moi-lbc' });
        await new Promise((x) => setTimeout(x, 200));
        await capture(t.pg, nom);
        await juge(r || {}, await t.pg.evaluate(() => ({ clics: window.__clics.slice(), supprime: window.__supprime.slice() })));
      } finally { await t.ctx.close(); }
    });
    await supLbc('L5', '<p>Supprimer l’annonce ?</p><button data-k="annuler">Annuler</button><button data-qa-id="confirm-delete-v2" data-k="confirmer">Supprimer définitivement</button>', async (r, p) => {
      dit(r.confirme === true && p.supprime.join() === ADS[1], 'L5 suppression (3 étapes apprises, data-qa-id renommés) ⇒ CETTE annonce supprimée', JSON.stringify({ r, p }));
      dit(p.clics.join() === `plus-${ADS[1]},menu-${ADS[1]},confirmer` && !p.clics.includes(`plus-${ADS[0]}`), 'L5 la rangée de CETTE annonce, son menu, la confirmation — l’autre annonce jamais touchée, « Annuler » jamais', JSON.stringify(p.clics));
    });
    await supLbc('L6', '<p>Supprimer l’annonce ?</p><button data-k="confirmer">Supprimer définitivement</button><button data-k="confirmer">Supprimer définitivement</button>', async (r, p) => {
      dit(r.erreur === 'etape-ambigue' && p.supprime.length === 0 && !p.clics.includes('confirmer'), 'L6 la confirmation en double ⇒ arrêt « etape-ambigue », la suppression ne part pas', JSON.stringify({ r, p }));
    });

    console.log('— Vestiaire');
    const msgVc = async (nom, corps, juge) => cas(nom, async () => {
      const t = await ouvrir(b, `https://www.vestiairecollective.com/messages/${VCONV}`, PAGE_VC({ corps }));
      try {
        await injecter(t.pg, ['vrm-trouver.js', 'vc-ecrire.js'], FAUX_CHROME(UI_VC));
        // vc-ecrire.js expose `ecrire` aux bancs ; l'ordre réel vient du fond (`vcEcrireUI`).
        const rr = await t.pg.evaluate((m) => window.__vrmVcEcrireTest.ecrire(m), { conv: VCONV, texte: 'Bonjour, toujours dispo', compte: 'vc-moi' });
        await new Promise((x) => setTimeout(x, 200));
        await capture(t.pg, nom);
        await juge(rr || {}, await t.pg.evaluate(() => ({ envoye: window.__envoye.slice(), envois: window.__envois.slice(), champs: [...document.querySelectorAll('textarea')].map((x) => x.value) })));
      } finally { await t.ctx.close(); }
    });
    await msgVc('C1', '<div class="chat"><textarea placeholder="Écrire un message…"></textarea><button type="button" data-testid="chat-send-v3" data-envoi>Envoyer</button></div>', async (r, p) => {
      dit(r.confirme === true && p.envoye.length === 1 && p.envoye[0] === 'Bonjour, toujours dispo', 'C1 champ et bouton appris renommés ⇒ retrouvés, la page envoie CE texte, la preuve est vue', JSON.stringify({ r, p }));
      const jr = p.envois.find((m) => m.action === 'trouveJournal');
      dit(!!jr && jr.from === 'cancale-vc' && jr.trouves.length >= 2, 'C1 le journal part au fond', JSON.stringify(jr));
    });
    await msgVc('C2', '<textarea placeholder="Écrire un message…"></textarea><textarea placeholder="Écrire un message…"></textarea><button type="button" data-envoi>Envoyer</button>', async (r, p) => {
      dit(r.erreur === 'champ-ambigu' && p.envoye.length === 0 && p.champs.every((v) => v === ''), 'C2 deux champs pareils ⇒ rien n’est tapé', JSON.stringify({ r, p }));
    });
    await msgVc('C3', '<p>Conversation archivée.</p>', async (r, p) => {
      const jr = p.envois.find((m) => m.action === 'trouveJournal');
      dit(r.erreur === 'champ-introuvable' && p.envoye.length === 0 && !!jr && jr.trouves.some((x) => x.nom === 'champMessage' && x.s === ''), 'C3 aucun champ ⇒ « champ-introuvable », journal envoyé', JSON.stringify({ r, jr }));
    });

    console.log('— eBay');
    const ebay = async (nom, o, juge) => cas(nom, async () => {
      const t = await ouvrir(b, 'https://www.ebay.fr/sl/sell?mode=AddItem', PAGE_EBAY(o));
      try {
        await injecter(t.pg, ['vrm-ui.js', 'vrm-trouver.js', 'ebay.js'], FAUX_CHROME({}, { getPending: { ok: true, ad: AD } }));
        await new Promise((x) => setTimeout(x, 2600));
        await capture(t.pg, nom);
        await juge(await valeurs(t.pg), t.pg);
      } finally { await t.ctx.close(); }
    });
    await ebay('E1', { lang: 'de', corps: '<input name="price_min" aria-label="Preis min" placeholder="Preis min"><label for="t">Titel</label><input id="t" name="itemTitle"><label for="p">Preis</label><input id="p" name="binPrice" inputmode="decimal">' }, async (v) => {
      dit(v.t === AD.title && v.p === AD.price && v.price_min === '' && v['gh-ac'] === '', 'E1 page allemande : titre et prix dans « Titel » / « Preis » ; le filtre « Preis min » et la recherche restent vides', JSON.stringify(v));
    });
    await ebay('E2', { corps: '<label for="st">Sous-titre</label><input id="st" name="subtitle"><label for="t">Titre</label><input id="t" name="title">' }, async (v) => {
      dit(v.t === AD.title && v.st === '', 'E2 « Sous-titre » avant « Titre » ⇒ le titre va dans « Titre », le sous-titre reste vide', JSON.stringify(v));
    });
    await ebay('E3', { corps: '<label for="t">Titre</label><input id="t" name="title"><label for="p1">Prix</label><input id="p1" name="price"><label for="p2">Prix</label><input id="p2" name="price">' }, async (v, pg) => {
      const bandeau = await pg.evaluate(() => { const e = document.getElementById('vrm-ebay-b'); return e ? e.textContent : ''; });
      dit(v.t === AD.title && v.p1 === '' && v.p2 === '', 'E3 deux champs « Prix » pareils ⇒ AUCUN n’est rempli (le titre, lui, l’est)', JSON.stringify(v));
      dit(/le prix : VRM voit deux champs pareils/.test(bandeau) && /Remplis-le toi-même/.test(bandeau), 'E3 le bandeau dit quel champ remplir soi-même', bandeau);
    });
    await ebay('E4', { corps: '<p>Choisis une catégorie pour continuer.</p>' }, async (v, pg) => {
      await pg.evaluate(() => window.__vrmEbayTest && window.__vrmEbayTest.rendreJournalEbay());
      await new Promise((x) => setTimeout(x, 100));
      const jr = (await pg.evaluate(() => window.__envois.slice())).find((m) => m.action === 'trouveJournal');
      dit(Object.values(v).every((x) => x === '') && !!jr && jr.from === 'cancale-ebay' && jr.trouves.some((x) => x.nom === 'titre' && x.s === '' && x.essais.length >= 3), 'E4 aucun champ ⇒ rien rempli, le journal (stratégies et comptes) part au fond', JSON.stringify({ v, jr }));
    });
  } finally { await b.close(); }
  console.log(`\n${ko ? '❌' : '✅'} extension adaptative (pages) : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
