// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « COMPTA ET DONNÉES » (16 nov., lot compta-donnees)
//
//  EXÉCUTE le vrai code (extrait de l'app, ou bundlé par esbuild), jamais une
//  lecture d'orthographe :
//   A  `ecrireReglage` (App.jsx — Ma facture, Ma configuration, le choix d'un compte
//      pro) écrit par COMPARER-ET-ÉCHANGER sur `data.rev` : un champ posé sur un autre
//      appareil entre la lecture et l'écriture RESTE ; deux écrivains en même temps ⇒
//      les deux champs restent ; LECTURE KO ⇒ rien écrit (rend false) ; et les trois
//      appelants passent la fiche relue (`frais`) comme base.
//   B  LA FILE PAR CLÉ (src/modifierCle.js) : `noterLienEbay` (en boucle sur les
//      brouillons), `poserAchatVc`, `deposerLbc` — deux gestes dans la demi-seconde
//      d'attente de `save` : les deux restent (avant : le 2e repartait de la carte
//      d'avant le 1er et l'effaçait).
//   C  La série « Facture Pro » (Ventes → Sélectionner) et « Tout envoyer » : boîte pas
//      connectée mais envoi VRM possible ⇒ la confirmation propose « Envoyer avec VRM »
//      et chaque envoi part avec `via: 'vrm'` ; envoi VRM fermé ⇒ rien ne part, la
//      raison est dite par vente ; le réglage « ma boîte » n'est jamais réécrit.
//  `AUDIT_RACINE=<arbre>` le joue sur un autre arbre ; `--prouve` : mutations.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'reglage-ecrase': [['src/App.jsx', "avant: avant && typeof avant === 'object' && !Array.isArray(avant) ? avant : {}, apres: data && typeof data === 'object' ? data : {} });", "avant: data, apres: data }), await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=x`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([withOwner({ id, data })]) });"]],
  'facture-sans-base': [['src/FacturePro.jsx', 'ok = await deps.ecrireReglage(ID_CFG, fusion, frais);', 'ok = await deps.ecrireReglage(ID_CFG, fusion);']],
  'file-relit-le-navigateur': [['src/App.jsx', 'const modifierCle = fabriquerModifierCle({ lire: chargerPublie, save });', 'const modifierCle = fabriquerModifierCle({ lire: load, save });']],
  'ebay-sans-file': [['src/ecrans/Ebay.jsx', '  const v = modifierCle(LIENS_EBAY, {}, (l) => {', '  const v = ((k, d, f) => { const x = f({ ...(load(k, d) || {}) }); if (x !== undefined) save(k, x); return x; })(LIENS_EBAY, {}, (l) => {']],
  'vc-sans-file': [['src/ecrans/Vestiaire.jsx', "  modifierCle('vinted_buyprice_by_num', {}, (u) => ({ ...u, [num]: String(p) }));", "  save('vinted_buyprice_by_num', { ...(load('vinted_buyprice_by_num', {}) || {}), [num]: String(p) });"]],
  'lbc-sans-file': [['src/App.jsx', "  const deposerLbc = (txId) => { if (txId == null) return; modifierCle('vrm_lbc_colis_done', {},", "  const deposerLbc = (txId) => { if (txId == null) return; ((k, d, f) => { const x = f({ ...(load(k, d) || {}) }); if (x !== undefined) save(k, x); })('vrm_lbc_colis_done', {},"]],
  'serie-sans-vrm': [['src/FacturePro.jsx', '  const viaVrm = !!(bloque && bloque.vrm && !mv.length);\n  if (prets.length && bloque && !viaVrm)', '  const viaVrm = false;\n  if (prets.length && bloque && !viaVrm)']],
  'serie-via-oublie': [['src/FacturePro.jsx', "    const r2 = await route(deps, { action: 'envoyer', confirme: true, tx, ...(viaVrm ? { via: 'vrm' } : {}) });", "    const r2 = await route(deps, { action: 'envoyer', confirme: true, tx });"]],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = sansCommentaires(lire('src/App.jsx'));
const EBAY = sansCommentaires(lire('src/ecrans/Ebay.jsx'));
const VC = sansCommentaires(lire('src/ecrans/Vestiaire.jsx'));

// Une déclaration `function nom(` / `const nom = …;` (indentée ou non), bornée par ses accolades.
function extraire(src, nom) {
  const m = new RegExp(`^[ \\t]*(?:export )?(?:async )?function ${nom}\\(|^[ \\t]*(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const debut = m.index + m[0].length - m[0].trimStart().length;
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = debut; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(debut, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(debut, i + 1);
  }
  return '';
}
const charger = async (fichier) => {
  const p = path.join(R, fichier); if (!fs.existsSync(p)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compta-donnees-'));
  for (const f of fs.readdirSync(path.dirname(p))) if (/\.js$/.test(f)) fs.copyFileSync(path.join(path.dirname(p), f), path.join(dir, f.replace(/\.js$/, '.mjs')));
  for (const f of fs.readdirSync(dir)) { const q = path.join(dir, f); fs.writeFileSync(q, fs.readFileSync(q, 'utf8').replace(/(from\s+['"]\.\/[^'"]+)\.js(['"])/g, '$1.mjs$2')); }
  try { return await import('file://' + path.join(dir, path.basename(fichier).replace(/\.js$/, '.mjs'))); } catch (e) { console.log('   (chargement de ' + fichier + ' : ' + e.message + ')'); return null; }
};

// ── Une petite base PostgREST : `data->>rev` jugé, upsert, pannes servies ────
function baseFaussee(lignes = {}) {
  const L = new Map(Object.entries(lignes).map(([id, data]) => [id, JSON.parse(JSON.stringify(data))]));
  const journal = []; let panneLecture = 0;
  const rep = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  const f = async (url, init = {}) => {
    const u = decodeURIComponent(url); const meth = (init.method || 'GET').toUpperCase();
    const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    journal.push({ meth, u });
    if (meth === 'GET') { if (panneLecture > 0) { panneLecture--; return rep(503, { message: 'panne' }); } return rep(200, id && L.has(id) ? [{ id, data: JSON.parse(JSON.stringify(L.get(id))) }] : []); }
    const corps = JSON.parse(init.body || 'null');
    const prefer = String(((init.headers || {}).Prefer) || ((init.headers || {}).prefer) || '');
    if (meth === 'POST') {
      const lot = [].concat(corps);
      for (const x of lot) { if (L.has(x.id) && !/merge-duplicates/.test(prefer)) return rep(409, { code: '23505' }); }
      for (const x of lot) L.set(x.id, /merge-duplicates/.test(prefer) ? JSON.parse(JSON.stringify(x.data)) : JSON.parse(JSON.stringify(x.data)));
      return rep(201, lot);
    }
    if (meth === 'PATCH') {
      if (!L.has(id)) return rep(200, []);
      const m = /data->>rev=(is\.null|eq\.(\d+))/.exec(u);
      const d = L.get(id); const rev = Number.isSafeInteger(d && d.rev) ? d.rev : null;
      if (m && !(m[1] === 'is.null' ? rev == null : rev === Number(m[2]))) return rep(200, []);
      L.set(id, JSON.parse(JSON.stringify(corps.data))); return rep(200, [{ id, data: corps.data }]);
    }
    return rep(200, []);
  };
  return { f, L, journal, panne: (n = 1) => { panneLecture = n; } };
}
// Deux écrivains EN MÊME TEMPS : chacun lit, PUIS chacun écrit.
function course(base) {
  let attente = [], n = 0;
  return async (url, init = {}) => {
    const meth = (init.method || 'GET').toUpperCase();
    const r = await base.f(url, init);
    if (meth === 'GET' && n < 2) { n++; await new Promise((okp) => { attente.push(okp); if (attente.length === 2) { attente.forEach((x) => x()); attente = []; } }); }
    return r;
  };
}

// ── Le stockage de l'app : `save` différé de 500 ms (la minuterie d'App.jsx) ──
function stockageApp() {
  const ls = new Map(), attente = new Map(), timers = new Map();
  const load = (k, d) => (ls.has(k) ? JSON.parse(ls.get(k)) : d);
  const save = (k, v) => { if (timers.has(k)) clearTimeout(timers.get(k)); attente.set(k, v); timers.set(k, setTimeout(() => { ls.set(k, JSON.stringify(v)); attente.delete(k); timers.delete(k); }, 500)); };
  const chargerPublie = (k, d) => (attente.has(k) ? attente.get(k) : load(k, d));
  const vider = async () => { await new Promise((r) => setTimeout(r, 650)); };
  return { load, save, chargerPublie, vider, ls };
}

(async () => {
  const C = await charger('src/ligneCas.js');
  // ══ A. ecrireReglage : comparer-et-échanger ═══════════════════════════════
  console.log('── A. ecrireReglage (Ma facture, Ma configuration) : seul ce qui a changé ici est posé, gardé par data.rev');
  {
    const src = extraire(APP, 'ecrireReglage');
    dit(!!src, 'A0 ecrireReglage existe dans App.jsx');
    const monter = (fetchF) => {
      const evts = [];
      const ctx = { fetch: fetchF, SUPABASE_URL: 'http://b', SB_CONFLICT: 'id', sbAuth: () => ({}), withOwner: (o) => o, ecrireDifference: C ? C.ecrireDifference : undefined,
        fetchBorne: (f, u, o) => f(u, o), DELAI_ECRITURE_MS: 1000, oublierReglageMontage: () => {}, console,
        window: { dispatchEvent: (e) => evts.push(e) }, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; } };
      vm.createContext(ctx);
      vm.runInContext(src.replace(/^const ecrireReglage\s*=/, 'globalThis.ecrireReglage ='), ctx);
      return { fn: ctx.ecrireReglage, evts };
    };
    const fiche = { nom: 'Julien Exemple', siret: '12345678900011', tva_regime: 'franchise', email: '', rev: 4 };
    // A1 : un autre appareil pose le régime de TVA ENTRE la lecture et l'écriture.
    {
      const b = baseFaussee({ vrm_pro_facture: fiche });
      const fetch0 = globalThis.fetch; globalThis.fetch = b.f;
      let r = null;
      try {
        const { fn } = monter(b.f);
        const frais = JSON.parse(JSON.stringify(fiche));                 // ce que l'appelant a relu
        b.L.set('vrm_pro_facture', { ...fiche, tva_regime: 'marge', tva: 'FR12345678901', rev: 5 });   // l'autre appareil
        r = await fn('vrm_pro_facture', { ...frais, email: 'julien@exemple.test' }, frais);
      } catch (e) { r = 'erreur : ' + e.message; } finally { globalThis.fetch = fetch0; }
      const fin = b.L.get('vrm_pro_facture') || {};
      dit(r === true && fin.email === 'julien@exemple.test', 'A1 son e-mail est écrit', JSON.stringify(fin) + ' ' + r);
      dit(fin.tva_regime === 'marge' && fin.tva === 'FR12345678901', 'A1 le régime de TVA posé sur l’autre appareil entre-temps RESTE', JSON.stringify({ tva_regime: fin.tva_regime, tva: fin.tva }));
      dit(Number(fin.rev) === 6, 'A1 la version monte d’un cran (comparer-et-échanger sur data.rev)', String(fin.rev));
    }
    // A2 : deux écrivains EN MÊME TEMPS (Ma facture et le choix d'un compte pro).
    {
      const b = baseFaussee({ vrm_pro_facture: fiche });
      const f = course(b);
      const fetch0 = globalThis.fetch; globalThis.fetch = f;
      let r = null;
      try {
        const { fn } = monter(f);
        r = await Promise.all([
          fn('vrm_pro_facture', { ...fiche, email: 'julien@exemple.test' }, fiche),
          fn('vrm_pro_facture', { ...fiche, comptesFacture: { '77': true } }, fiche),
        ]);
      } catch (e) { r = 'erreur : ' + e.message; } finally { globalThis.fetch = fetch0; }
      const fin = b.L.get('vrm_pro_facture') || {};
      dit(Array.isArray(r) && r.every((x) => x === true) && fin.email === 'julien@exemple.test' && fin.comptesFacture && fin.comptesFacture['77'] === true, 'A2 deux écritures EN MÊME TEMPS (e-mail ici, compte pro là) ⇒ les DEUX restent', JSON.stringify(fin) + ' ' + JSON.stringify(r));
    }
    // A3 : LECTURE KO, ÉCRITURE OK — la relecture tombe : rien n'est écrit.
    {
      const b = baseFaussee({ vrm_pro_facture: fiche });
      b.panne(10);
      const fetch0 = globalThis.fetch; globalThis.fetch = b.f;
      let r = null;
      try { const { fn } = monter(b.f); r = await fn('vrm_pro_facture', { ...fiche, siret: '' }, fiche); } catch (e) { r = 'erreur : ' + e.message; } finally { globalThis.fetch = fetch0; }
      const ecr = b.journal.filter((j) => j.meth !== 'GET');
      dit(r === false && ecr.length === 0 && b.L.get('vrm_pro_facture').siret === '12345678900011', 'A3 relecture en panne ⇒ RIEN écrit, rend false (le SIRET reste)', `${r} · ${ecr.length} écriture(s)`);
    }
    // A4 : les trois appelants passent la fiche RELUE comme base (sinon tout serait « changé »).
    const FP = sansCommentaires(lire('src/FacturePro.jsx')), CD = sansCommentaires(lire('src/ConfigurationDepart.jsx'));
    const appels = [...FP.matchAll(/ecrireReglage\(ID_CFG, fusion(?:, ([^)]*))?\)/g), ...CD.matchAll(/ecrireReglage\(ID_FICHE, fusion(?:, ([^)]*))?\)/g)];
    dit(appels.length === 3 && appels.every((m) => m[1] && /^frais\b/.test(m[1].trim())), 'A4 Ma facture (2) et Ma configuration (1) passent la fiche relue (`frais`) comme base', appels.map((m) => m[1] || '(rien)').join(' | '));
  }

  // ══ B. La file par clé ════════════════════════════════════════════════════
  console.log('── B. la file par clé : deux gestes dans la demi-seconde de `save` restent deux');
  const MC = await charger('src/modifierCle.js');
  dit(!!(MC && typeof MC.fabriquerModifierCle === 'function'), 'B0 src/modifierCle.js exporte fabriquerModifierCle');
  const lien = /const modifierCle = fabriquerModifierCle\(\{ lire: (\w+), save \}\)/.exec(APP);
  dit(!!lien && lien[1] === 'chargerPublie', 'B0 l’app la branche sur la valeur EN ATTENTE de la clé (`chargerPublie`)', lien ? lien[1] : 'absent');
  const monterFile = (st) => {
    const lireBranche = lien && lien[1] === 'chargerPublie' ? st.chargerPublie : st.load;
    return MC ? MC.fabriquerModifierCle({ lire: lireBranche, save: st.save }) : undefined;
  };
  {
    const st = stockageApp();
    const src = extraire(EBAY, 'noterLienEbay');
    dit(!!src, 'B1 noterLienEbay existe dans src/ecrans/Ebay.jsx');
    const ctx = { modifierCle: monterFile(st), LIENS_EBAY: 'vrm_liens_ebay', _fichesEbayMemo: { at: 1 }, load: st.load, save: st.save, Date, String };
    let r = 'ok';
    try {
      vm.createContext(ctx); vm.runInContext(src.replace(/^const noterLienEbay\s*=/, 'globalThis.noterLienEbay ='), ctx);
      // La boucle sur les brouillons (Ebay.jsx) : trois liens d'affilée.
      ctx.noterLienEbay('101', 'p1', '12', 'brouillon'); ctx.noterLienEbay('102', 'p2', '13', 'brouillon'); ctx.noterLienEbay('103', 'p3', '14', 'publication');
      await st.vider();
      ctx.noterLienEbay('101', 'pX', '99', 'brouillon');   // un lien déjà posé gagne sur un brouillon
      await st.vider();
    } catch (e) { r = 'erreur : ' + e.message; }
    const l = st.load('vrm_liens_ebay', {});
    dit(r === 'ok' && ['101', '102', '103'].every((k) => l[k]) && l['101'].pairId === 'p1', 'B1 trois liens eBay posés en boucle ⇒ les TROIS restent (et un brouillon ne remplace pas un lien posé)', Object.keys(l).join(',') + ' ' + r);
  }
  {
    const st = stockageApp();
    st.ls.set('vinted_buyprice_by_num', JSON.stringify({ '5': '20' }));
    const src = extraire(VC, 'poserAchatVc');
    dit(!!src, 'B2 poserAchatVc existe dans src/ecrans/Vestiaire.jsx');
    const ctx = { modifierCle: monterFile(st), load: st.load, save: st.save, setTimeout: () => 0, emettreClesRelues: () => {}, signalerVc: () => {}, String };
    let r = 'ok';
    try { vm.createContext(ctx); vm.runInContext(src.replace(/^const poserAchatVc\s*=/, 'globalThis.poserAchatVc ='), ctx); ctx.poserAchatVc('12', 41); ctx.poserAchatVc('13', 55); await st.vider(); } catch (e) { r = 'erreur : ' + e.message; }
    const p = st.load('vinted_buyprice_by_num', {});
    dit(r === 'ok' && p['5'] === '20' && p['12'] === '41' && p['13'] === '55', 'B2 deux prix d’achat Vestiaire tapés vite ⇒ les deux restent (et l’ancien)', JSON.stringify(p) + ' ' + r);
  }
  {
    const st = stockageApp();
    const src = extraire(APP, 'deposerLbc');
    dit(!!src, 'B3 deposerLbc existe dans App.jsx');
    const ctx = { modifierCle: monterFile(st), load: st.load, save: st.save, majLbcFait: () => {}, Date };
    let r = 'ok';
    try { vm.createContext(ctx); vm.runInContext(src.replace(/^const deposerLbc\s*=/, 'globalThis.deposerLbc ='), ctx); ctx.deposerLbc('lbc1'); ctx.deposerLbc('lbc2'); await st.vider(); } catch (e) { r = 'erreur : ' + e.message; }
    const d = st.load('vrm_lbc_colis_done', {});
    dit(r === 'ok' && d.lbc1 && d.lbc2, 'B3 deux colis Leboncoin « déposés » dans la demi-seconde ⇒ les deux restent', Object.keys(d).join(',') + ' ' + r);
  }
  if (MC) {
    const st = stockageApp(); let saves = 0;
    const m = MC.fabriquerModifierCle({ lire: st.chargerPublie, save: (k, v) => { saves++; st.save(k, v); } });
    m('k', {}, () => undefined);
    dit(saves === 0, 'B4 rien à changer ⇒ rien écrit');
  }

  // ══ C. La série « Facture Pro » : « Envoyer avec VRM » quand la boîte n'est pas connectée ══
  console.log('── C. série « Facture Pro » : boîte pas connectée, VRM possible ⇒ « Envoyer avec VRM »');
  let esbuild = null; try { esbuild = require(path.join(R, 'node_modules', 'esbuild')); } catch (_) { try { esbuild = require('esbuild'); } catch (__) {} }
  // La clé de Luhn d'un SIRET (la règle publique de l'INSEE) : un SIRET valide calculé, jamais deviné.
  const luhn = (t) => [...t].reverse().reduce((s, ch, i) => { let d = Number(ch) * (i % 2 ? 2 : 1); if (d > 9) d -= 9; return s + d; }, 0) % 10 === 0;
  const bundler = async (n) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compta-fp-'));
    const out = path.join(dir, `fp${n}.mjs`);
    // Comme l'app : le français de l'app est posé (`ajouterSourceApp`, App.jsx) avant l'écran.
    const entree = path.join(dir, `entree${n}.jsx`);
    fs.writeFileSync(entree, `import { ajouterSourceApp } from ${JSON.stringify(path.join(R, 'src', 'i18n', 'index.js'))};\nimport fr from ${JSON.stringify(path.join(R, 'src', 'i18n', 'langues', 'fr.js'))};\najouterSourceApp(fr);\nexport * from ${JSON.stringify(path.join(R, 'src', 'FacturePro.jsx'))};\n`);
    await esbuild.build({ entryPoints: [entree], bundle: true, format: 'esm', platform: 'node', outfile: out, loader: { '.css': 'empty', '.js': 'jsx' }, logLevel: 'silent', define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' } });
    return import('file://' + out);
  };
  if (!esbuild) dit(false, 'C0 esbuild se charge');
  else {
    // Un SIRET valide (clé de Luhn) calculé, jamais deviné.
    let siret = '';
    for (let c = 0; c < 10 && !siret; c++) if (luhn('7328293200007' + c)) siret = '7328293200007' + c;
    const cfg = { nom: 'Julien Exemple', forme: 'EI', siret, adresse: '1 rue Inventée', codePostal: '75011', ville: 'Paris', tva_regime: 'franchise', email: 'julien@exemple.test', envoiPar: 'boite', prefixe: 'FA' };
    const tV = Date.now() - 3 * 3600e3, iso = (t) => new Date(t).toISOString();
    const mail = (tx) => ({ transaction: tx, receivedAt: iso(tV + 60e3), prix: '30.00', email: `a${tx}@exemple.test`, nom: `Acheteur ${tx}`, adresse: 'rue Inventée, 12, Paris, 75011, FR, France', uid: '77', designation: 'Paire banc', account: 'shop_a' });
    const vente = (tx) => ({ transaction_id: tx, date: iso(tV), price: { amount: '30.00', currency_code: 'EUR' }, _uid: '77', title: 'Paire banc', status: 'Commande expédiée' });
    const scene = async (n, { vrmPret }) => {
      const M = await bundler(n);
      const routes = [], confirmations = [], reglages = [];
      const fetch0 = globalThis.fetch;
      globalThis.fetch = async (u, o = {}) => {
        const corps = o.body ? JSON.parse(o.body) : null;
        routes.push(corps || { lecture: true });
        const rep = (j, s = 200) => ({ ok: s < 300, status: s, json: async () => j });
        if (!corps) return rep({ ok: true, coffre: true, boite: { etat: 'aucune' }, vrm: { pret: vrmPret, plafond: 50, aujourdhui: 0 } });
        if (corps.action === 'emettre') return rep({ ok: true, facture: { numero: 'FA-2026-0007' } });
        if (corps.action === 'envoyer') return rep({ ok: true, issue: 'envoye' });
        return rep({}, 400);
      };
      const deps = {
        lireTout: async (q) => (/email_sale_/.test(q) ? [mail('9100000001'), mail('9100000002')] : []),
        lireReglage: async () => ({ ...cfg }), ecrireReglage: async (...a) => { reglages.push(a); return true; },
        typeCompteVinted: () => true, classifyOrderStatus: () => 'pending', enTeteSession: () => ({}),
        askConfirm: async (o) => { confirmations.push(o); return true; },
      };
      let r = null;
      try { r = await M.envoyerFacturesSerie(deps, ['9100000001', '9100000002'], [vente('9100000001'), vente('9100000002')]); } catch (e) { r = 'erreur : ' + e.message; } finally { globalThis.fetch = fetch0; }
      return { r, routes, confirmations, reglages };
    };
    const a = await scene(1, { vrmPret: true });
    const envois = a.routes.filter((x) => x.action === 'envoyer');
    dit(a.r && Array.isArray(a.r.faits) && a.r.faits.length === 2, 'C1 boîte pas connectée, VRM ouvert : les 2 factures de la sélection partent', JSON.stringify(a.r));
    dit(envois.length === 2 && envois.every((x) => x.via === 'vrm'), 'C1 chaque envoi part AVEC VRM (`via: vrm`, pour CES factures)', JSON.stringify(envois));
    dit(a.confirmations.length === 1 && /VRM/.test(a.confirmations[0].ok || '') && /pas connectée/.test(a.confirmations[0].desc || ''), 'C1 la confirmation le dit : « Envoyer avec VRM », ta boîte n’est pas connectée', JSON.stringify(a.confirmations[0] || null));
    dit(a.reglages.length === 0, 'C1 le réglage « depuis ma boîte » n’est PAS réécrit');
    const b = await scene(2, { vrmPret: false });
    dit(b.r && b.r.faits.length === 0 && b.r.pasFaits.length === 2 && b.r.pasFaits.every((x) => /vrm/i.test(x.raison)) && !b.routes.some((x) => x.action === 'envoyer'), 'C2 envoi VRM fermé : rien ne part, la raison est dite par vente', JSON.stringify(b.r));
    const FP = sansCommentaires(lire('src/FacturePro.jsx'));
    dit(/data-fp-tout-envoyer-vrm=\{prets\.length\}/.test(FP) && /tr\('facturePro\.toutEnvoyerVrm'/.test(FP), 'C3 « À envoyer » porte « Tout envoyer avec VRM » à côté de « Connecter ma boîte »');
  }

  console.log(ko ? `\n❌ audit-compta-donnees : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-compta-donnees : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
