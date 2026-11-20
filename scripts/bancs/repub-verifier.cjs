// Banc : LE CONTRÔLE AVANT DE LANCER UNE REPUBLICATION (20 nov., extension 5.410 — `repubverif`).
// (20 nov., « toute action se fait dans l'extension ») L'atelier n'est plus dans l'app : il vit dans le PANNEAU de
// l'extension. Ce banc monte le VRAI vrm-badge.js + vrm-ui.js sur une page vinted.fr (faux `chrome` : il répond
// ce que dirait `atelierVerifier`, c.-à-d. la commande `verifierRepub` du fond ; le fond lui-même est jugé par
// scripts/audit-extension-porte-app.cjs et scripts/audit-repub-verifier.cjs). Données INVENTÉES.
//   V1. « Republier » ⇒ la vérification part seule : « 3 vérifiée(s) · 1 corrigée(s) seule(s) · 1 à corriger ».
//   V2. Sous chaque ligne : la correction dite (la taille), ce qui manque + « Choisir : la taille » / « Retirer de la file ».
//   V3. Lancer est FERMÉ tant qu'il reste une annonce à corriger (dit).
//   V4. « Choisir la taille » : SA réponse revérifiée pour CETTE paire seule ; Lancer s'ouvre.
//   V5. « Retirer de la file » : la paire sort, la file est revérifiée.
// 390 tactile et 1512, clair et sombre ; captures dans BANC_CAPTURES/repub-verifier.
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8'), UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const SORTIE = path.join(process.env.BANC_CAPTURES || path.join(__dirname, 'captures'), 'repub-verifier');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('OK  ' + m); } else { ko++; console.log('KO  ' + m + (d ? ' — ' + String(d).slice(0, 300) : '')); } };
const T0 = Date.now();
const ANN = ['9102', '9103', '9104'].map((id, i) => ({ id, titre: ['Baskets test cuir blanc 42', 'Running test bleu 43', 'Montantes test noires 41'][i], prix: 49, num: String(42 + i), statut: 'en_vente', photo: '' }));
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'compte_test' }, annonces: { lu: T0, total: 3, liste: ANN, toutes: ANN, nTous: 3, statuts: { en_vente: 3 } }, ventes: { lu: T0, liste: [] }, messages: { lu: T0, liste: [] }, automatisations: null, notifications: { vu: T0, liste: [] }, offres: [], autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.410.0', code: '5.410.0', vrm: { ok: true, connecte: true, email: 'test@exemple.fr' }, site: { id: '111', nom: 'compte_test', choix: 'oui' }, flux: { okAt: T0 } };
(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [w, h, mobile] of [[390, 844, true], [1512, 900, false]]) for (const scheme of ['light', 'dark']) {
      const tag = `${w}-${scheme}`;
      console.log('── ' + tag);
      const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: w, height: h } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
      const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
      await pg.route('**/*', (r) => (/logo-vrm-96\.png/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: LOGO }) : r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff">Vinted</body></html>' })));
      await pg.goto('https://www.vinted.fr/member/items');
      await pg.evaluate(({ e, js, ui, L }) => {
        window.__envoyes = [];
        const copie = (x) => JSON.parse(JSON.stringify(x));
        const orig = Element.prototype.attachShadow; Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
        window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
          sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg)); let rep = { ok: true };
            if (msg.action === 'etat') rep = copie(e); else if (msg.action === 'carteListes') rep = copie(L); else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
            else if (msg.action === 'atelierVerifier') { const tous = msg.tous || msg.ids; const repondu = msg.reponses && msg.reponses['9103'];
              const paires = Object.fromEntries(tous.map((id) => [id, id === '9103' && !repondu ? { id, etat: 'a-corriger', corrections: [], manque: ['la taille'], question: { champ: 'size_id', nom: 'la taille', options: [['56', '43'], ['57', '44']] } } : id === '9102' ? { id, etat: 'corrige', corrections: [{ champ: 'size_id', nom: 'Taille', raison: 'même libellé dans la grille du jour' }], manque: [] } : { id, etat: 'ok', corrections: [], manque: [] }]));
              const a = Object.values(paires).filter((x) => x.etat === 'a-corriger').length;
              rep = { ok: true, paires, resume: { total: tous.length, verifiees: tous.length, ok: tous.length - 1 - a, corrige: tous.includes('9102') ? 1 : 0, aCorriger: a, absente: 0, pasVerifie: 0 }, lancer: a ? { ok: false, raison: 'a-corriger', n: a } : { ok: true } }; }
            setTimeout(() => cb && cb(rep), 0); } },
          storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
        const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u);
        const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
      }, { e: ETAT, js: BADGE, ui: UI, L: LISTES });
      await pg.waitForTimeout(300);
      const R = (f, a) => pg.evaluate(f, a);
      await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; r.querySelector('.btn').click(); });
      await pg.waitForTimeout(400);
      await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const b = r.querySelector('[data-onglet-b="annonces"]'); if (b) b.click(); });
      await pg.waitForTimeout(300);
      await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; for (const c of r.querySelectorAll('[data-ann-sel]')) { c.checked = true; c.dispatchEvent(new Event('change')); } });
      await pg.waitForTimeout(200);
      await R(() => { const s2 = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-action]'); s2.value = 'republier'; s2.dispatchEvent(new Event('change')); });
      await pg.waitForTimeout(400);
      const v1 = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const q = (s) => r.querySelector(s); return { recap: (q('[data-atelier-recap]') || {}).innerText || '', lignes: Array.from(r.querySelectorAll('[data-atelier-paire]')).map((x) => x.getAttribute('data-atelier-paire') + ':' + x.getAttribute('data-verif') + ':' + x.innerText.replace(/\s+/g, ' ')), choisir: !!q('[data-atelier-question="9103"]'), retirer: !!q('[data-atelier-retirer="9103"]'), lancer: q('[data-atelier-lancer]') && q('[data-atelier-lancer]').disabled, ferme: (q('[data-atelier-ferme]') || {}).innerText || '' }; });
      await pg.screenshot({ path: path.join(SORTIE, `verif-${tag}.png`) });
      dit(/3 vérifiée\(s\) · 1 corrigée\(s\) seule\(s\) · 1 à corriger/.test(v1.recap), `V1 ${tag} la vérification part seule : le récapitulatif`, v1.recap);
      dit(v1.lignes.some((l) => /^9102:corrige:.*Taille : même libellé/.test(l)) && v1.lignes.some((l) => /^9103:a-corriger:.*Manque : la taille/.test(l)) && v1.choisir && v1.retirer, `V2 ${tag} sous chaque ligne : la correction dite, ce qui manque, « Choisir : la taille » / « Retirer de la file »`, v1.lignes.join(' | '));
      dit(v1.lancer === true && /1 annonce\(s\) à corriger/.test(v1.ferme), `V3 ${tag} Lancer fermé tant qu'il reste une annonce à corriger (dit)`, v1.ferme);
      await R(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-question="9103"]'); c.value = '56'; c.dispatchEvent(new Event('change')); });
      await pg.waitForTimeout(300);
      const env = await R(() => window.__envoyes.filter((m) => m.action === 'atelierVerifier'));
      const l4 = await R(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-lancer]').disabled);
      dit(env.length === 2 && env[1].ids.join(',') === '9103' && env[1].reponses['9103'].size_id === '56' && !env[1].reponses['9102'] && l4 === false, `V4 ${tag} SA taille revérifiée pour CETTE paire seule ; Lancer s'ouvre`, JSON.stringify(env[1]));
      await pg.screenshot({ path: path.join(SORTIE, `verif-ok-${tag}.png`) });
      // V5 : retirer une paire de la file.
      await R(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-question="9103"]'); });
      await R(() => { const s2 = document.getElementById('vrm-badge').shadowRoot; const f = s2.querySelector('[data-geste-fermer]'); if (f) f.click(); });
      await pg.waitForTimeout(200);
      await R(() => { const s2 = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-action]'); s2.value = 'republier'; s2.dispatchEvent(new Event('change')); });
      await pg.waitForTimeout(400);
      await R(() => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-retirer="9103"]'); b.click(); });
      await pg.waitForTimeout(400);
      const v5 = await R(() => ({ lignes: Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll('[data-atelier-paire]')).map((x) => x.getAttribute('data-atelier-paire')), env: window.__envoyes.filter((m) => m.action === 'atelierVerifier').slice(-1)[0] }));
      dit(v5.lignes.join(',') === '9102,9104' && v5.env.tous.join(',') === '9102,9104', `V5 ${tag} « Retirer de la file » : la paire sort, la file est revérifiée`, JSON.stringify(v5));
      dit(!errs.length, `V6 ${tag} aucune erreur de page`, errs.join(' | '));
      await ctx.close();
    }
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ banc repub-verifier : ${ko} KO` : `\n✅ banc repub-verifier : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
