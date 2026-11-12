// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « DONNÉES, LA SUITE » (12 nov., revue de robustesse — les « moyenne »)
//
//  EXÉCUTE (jamais une lecture d'orthographe) contre une petite base PostgREST
//  qui juge `data->>rev` et sert les PROJECTIONS (`items:data->items`) :
//   · `ecrirePushPrefs` (App.jsx, Ma configuration) : un réglage changé ailleurs
//     entre la lecture et l'écriture (heures calmes) RESTE ;
//   · `ecrireDifference` (src/ligneCas.js, Réglages → Notifications, Ma facture) :
//     deux écrans sur deux champs différents ⇒ les deux restent ; rien changé ⇒
//     rien écrit ; lecture ratée ⇒ rien écrit ;
//   · `modifierBrouillonsEbay` (src/ecrans/Ebay.jsx) : deux brouillons créés EN
//     MÊME TEMPS ⇒ les deux restent ; relu PROJETÉ (jamais `select=data`) ;
//   · `modifierStudio` (src/studioPhoto.js) : deux photos ajoutées en même temps ⇒
//     les deux restent ;
//   · `save` différé : l'app qui se ferme (`pagehide`/`visibilitychange`) VIDE
//     toutes les sauvegardes en attente (`viderAvantFermeture`) ;
//   · devises (CLAUDE.md §3) : un porte-monnaie en GBP hors total et nommé
//     (src/porteMonnaie.js) ; une commande en GBP n'est pas lue en euros
//     (`montantCommandeLu`, ce que lisent « dépensé » et le CA).
//  `AUDIT_RACINE=<arbre>` le joue sur un autre arbre ; `--prouve` : mutations.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'pushprefs-entiere': [['src/App.jsx', "avant: avant && typeof avant === 'object' ? avant : {}, apres: next });", "avant: next, apres: next }), await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=x`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([withOwner({ id: 'push_prefs', data: next })]) });"]],
  'difference-ecrase': [['src/ligneCas.js', 'const out = fusion3(estObjet(avant) ? avant : {}, estObjet(apres) ? apres : {}, lu);', 'const out = apres;']],
  'ebay-sans-cas': [['src/ecrans/Ebay.jsx', "select: 'items:data->items,rev:data->rev', deLigne: (row) => ({ items: row.items, rev: row.rev }),", "select: 'items:data->items', deLigne: (row) => ({ items: row.items, rev: null }), filtre: '&cas=non',"]],
  'studio-sans-cas': [['src/ligneCas.js', "        r = await f(`${base}/rest/v1/app_data?id=eq.${enc}${filtre}&data->>rev=${cond}`", "        r = await f(`${base}/rest/v1/app_data?id=eq.${enc}${filtre}`"]],
  'fermeture-oubliee': [['src/App.jsx', "  for (const k of Object.keys(_saveTimers)) { try { viderSave(k); } catch (_) {} }", '']],
  'pm-devise-additionnee': [['src/porteMonnaie.js', "parUid[uid] = devise ? { dispo: null, attente: null, at, devise, lignesMois: [] } :", 'parUid[uid] = false ? 0 :']],
  'commande-gbp-en-euros': [['src/App.jsx', "  if (typeof p === 'object' && p.currency_code && String(p.currency_code).toUpperCase() !== 'EUR') return null;\n", '']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = sansCommentaires(lire('src/App.jsx'));
const EBAY = sansCommentaires(lire('src/ecrans/Ebay.jsx'));

function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const charger = async (fichier) => {
  const p = path.join(R, fichier); if (!fs.existsSync(p)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-'));
  for (const f of fs.readdirSync(path.dirname(p))) if (/\.js$/.test(f)) fs.copyFileSync(path.join(path.dirname(p), f), path.join(dir, f.replace(/\.js$/, '.mjs')));
  for (const f of fs.readdirSync(dir)) { const q = path.join(dir, f); fs.writeFileSync(q, fs.readFileSync(q, 'utf8').replace(/(from\s+['"]\.\/[^'"]+)\.js(['"])/g, '$1.mjs$2')); }
  try { return await import('file://' + path.join(dir, path.basename(fichier).replace(/\.js$/, '.mjs'))); } catch (e) { console.log('  (chargement de ' + fichier + ' : ' + e.message + ')'); return null; }
};

// ── Une petite base PostgREST : `data->>rev` jugé, projections servies, upsert ──
function baseFaussee(lignes = {}) {
  const L = new Map(Object.entries(lignes).map(([id, data]) => [id, JSON.parse(JSON.stringify(data))]));
  const journal = [];
  const rep = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  const projeter = (id, d, select) => {
    if (!select || select === 'data') return { id, data: d };
    const out = {};
    for (const part of select.split(',')) {
      const [alias, expr] = part.includes(':') ? part.split(':') : [part, part];
      if (expr === 'id') { out[alias] = id; continue; }
      const m = /^data->(?:>)?(\w+)$/.exec(expr);
      if (m) out[alias] = d == null ? null : (d[m[1]] === undefined ? null : d[m[1]]);
      else if (expr === 'data') out[alias] = d;
    }
    return out;
  };
  const f = async (url, init = {}) => {
    const u = decodeURIComponent(url); const meth = (init.method || 'GET').toUpperCase();
    const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    const select = (/[?&]select=([^&]+)/.exec(u) || [])[1] || 'data';
    journal.push({ meth, u, select });
    if (meth === 'GET') return rep(200, id && L.has(id) ? [projeter(id, JSON.parse(JSON.stringify(L.get(id))), select)] : []);
    const corps = JSON.parse(init.body || 'null');
    const prefer = String(((init.headers || {}).Prefer) || ((init.headers || {}).prefer) || '');
    if (meth === 'POST') {
      const lot = [].concat(corps);
      for (const x of lot) { if (L.has(x.id) && !/merge-duplicates/.test(prefer)) return rep(409, { code: '23505' }); }
      for (const x of lot) L.set(x.id, JSON.parse(JSON.stringify(x.data)));
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
  return { f, L, journal };
}
// Deux écrivains EN MÊME TEMPS : chacun lit, PUIS chacun écrit (les lectures
// sont tenues jusqu'à ce que les deux aient lu — la course de deux onglets).
function course(base) {
  let attente = [], n = 0;
  const f = async (url, init = {}) => {
    const meth = (init.method || 'GET').toUpperCase();
    const r = await base.f(url, init);
    if (meth === 'GET' && n < 2) { n++; await new Promise((ok) => { attente.push(ok); if (attente.length === 2) { attente.forEach((x) => x()); attente = []; } }); }
    return r;
  };
  return f;
}

(async () => {
  const C = await charger('src/ligneCas.js');
  // ── 1. push_prefs : Ma configuration n'efface plus un réglage fait ailleurs ──
  console.log('── push_prefs : Ma configuration pose SES familles, les heures calmes changées ailleurs restent');
  {
    const src = extraire(APP, 'ecrirePushPrefs');
    dit(!!src, 'ecrirePushPrefs existe dans App.jsx');
    const lue = { familles: { offres: true, colis: true } };
    const b = baseFaussee({ push_prefs: lue });
    // Entre la lecture (au début de Ma configuration) et l'écriture, l'autre appareil pose les heures calmes.
    b.L.set('push_prefs', { ...lue, calme: { actif: true, debut: '22:00', fin: '08:00' } });
    const ctx = { fetch: b.f, SUPABASE_URL: 'http://b', SB_CONFLICT: 'id', sbAuth: () => ({}), withOwner: (o) => o, ecrireDifference: C ? C.ecrireDifference : undefined, console };
    let res = null; const fetch0 = globalThis.fetch; globalThis.fetch = b.f;   // src/ligneCas.js lit le `fetch` global
    try {
      vm.createContext(ctx);
      vm.runInContext(src.replace(/^async function ecrirePushPrefs/, 'globalThis.ecrirePushPrefs = async function'), ctx);
      res = await ctx.ecrirePushPrefs({ ...lue, familles: { offres: false, colis: true } }, lue);
    } catch (e) { res = 'erreur : ' + e.message; } finally { globalThis.fetch = fetch0; }
    const fin = b.L.get('push_prefs') || {};
    dit(res === true && fin.familles && fin.familles.offres === false, 'le choix de Ma configuration est écrit (« Offres » coupées)', JSON.stringify(fin.familles) + ' ' + String(res));
    dit(!!(fin.calme && fin.calme.actif === true && fin.calme.debut === '22:00'), 'les heures calmes posées sur l\'autre appareil entre-temps RESTENT', JSON.stringify(fin.calme || null));
  }
  // ── 2. ecrireDifference : deux écrans, deux champs ─────────────────────────
  console.log('── ecrireDifference (Notifications, Ma facture) : chacun pose CE qu\'il a changé');
  if (!C || typeof C.ecrireDifference !== 'function') dit(false, 'src/ligneCas.js exporte ecrireDifference');
  else {
    const lue = { siret: '12345678900011', regimeTva: 'franchise', rev: 2 };
    const b = baseFaussee({ vrm_pro_facture: lue });
    const f = course(b);
    const [r1, r2] = await Promise.all([
      C.ecrireDifference({ base: 'http://b', id: 'vrm_pro_facture', entetes: () => ({}), fetch: f, avant: lue, apres: { ...lue, siret: '98765432100022' } }),
      C.ecrireDifference({ base: 'http://b', id: 'vrm_pro_facture', entetes: () => ({}), fetch: f, avant: lue, apres: { ...lue, regimeTva: 'reel' } }),
    ]);
    const fin = b.L.get('vrm_pro_facture');
    dit(r1.ok && r2.ok && fin.siret === '98765432100022' && fin.regimeTva === 'reel', 'deux écrans en même temps (SIRET ici, TVA là) ⇒ les DEUX restent', JSON.stringify(fin));
    const n0 = b.journal.filter((j) => j.meth !== 'GET').length;
    const r3 = await C.ecrireDifference({ base: 'http://b', id: 'vrm_pro_facture', entetes: () => ({}), fetch: b.f, avant: fin, apres: { ...fin } });
    dit(r3.ok && b.journal.filter((j) => j.meth !== 'GET').length === n0, 'rien changé ici ⇒ rien écrit');
    const r4 = await C.ecrireDifference({ base: 'http://b', id: 'vrm_pro_facture', entetes: () => ({}), fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }), avant: fin, apres: { ...fin, siret: 'x' } });
    dit(!r4.ok && r4.raison === 'lecture', 'lecture ratée ⇒ rien écrit');
  }
  // ── 3. ebay_brouillons : deux brouillons en même temps ─────────────────────
  console.log('── ebay_brouillons : deux brouillons créés en même temps restent, relus projetés');
  {
    const src = extraire(EBAY, 'modifierBrouillonsEbay');
    dit(!!src, 'modifierBrouillonsEbay existe dans src/ecrans/Ebay.jsx');
    const b = baseFaussee({ ebay_brouillons: { items: { b0: { titre: 'ancien' } }, majAt: 1 } });
    const f = course(b);
    const lireB = async () => { const r = await f('http://b/rest/v1/app_data?id=eq.ebay_brouillons&select=items:data->items', {}); const rows = await r.json(); const it = rows[0] && rows[0].items; return it && typeof it === 'object' ? it : {}; };
    const ctx = { fetch: f, SUPABASE_URL: 'http://b', SB_CONFLICT: 'id', sbAuth: (x) => ({ ...(x || {}) }), withOwner: (o) => o, modifierLigneCas: C ? C.modifierLigneCas : undefined, lireBrouillonsEbay: lireB, Date, console };
    let r = null; const fetch0 = globalThis.fetch; globalThis.fetch = f;
    try {
      vm.createContext(ctx);
      vm.runInContext(src.replace(/^async function modifierBrouillonsEbay/, 'globalThis.modifierBrouillonsEbay = async function'), ctx);
      r = await Promise.all([
        ctx.modifierBrouillonsEbay((it) => { it.b1 = { titre: 'Dunk 42' }; return it; }),
        ctx.modifierBrouillonsEbay((it) => { it.b2 = { titre: 'Jordan 43' }; return it; }),
      ]);
    } catch (e) { r = 'erreur : ' + e.message; } finally { globalThis.fetch = fetch0; }
    const fin = (b.L.get('ebay_brouillons') || {}).items || {};
    dit(Array.isArray(r) && r.every((x) => x && x.ok) && fin.b0 && fin.b1 && fin.b2, 'deux onglets créent chacun un brouillon ⇒ les deux restent (et l\'ancien)', Object.keys(fin).join(',') + (Array.isArray(r) ? '' : ' ' + r));
    dit(!b.journal.some((j) => j.meth === 'GET' && j.select === 'data'), 'relue PROJETÉE : jamais `select=data` sur la ligne des brouillons (§4.4)', b.journal.filter((j) => j.meth === 'GET').map((j) => j.select).join(' | '));
  }
  // ── 4. studio_photos : deux photos en même temps ───────────────────────────
  console.log('── studio_photos : deux photos ajoutées en même temps restent');
  {
    const SP = await charger('src/studioPhoto.js');
    if (!SP) dit(false, 'src/studioPhoto.js se charge');
    else {
      const b = baseFaussee({ studio_photos_12: { numero: '12', cle: '12', photos: [{ id: 'p0' }] } });
      const f = course(b);
      const fetch0 = globalThis.fetch; globalThis.fetch = f;
      const base = { url: 'http://b', auth: (x) => ({ ...(x || {}) }), withOwner: (o) => o, conflit: () => 'id' };
      let r = null;
      try { r = await Promise.all([SP.modifierStudio(base, '12', '12', (l) => [...l, { id: 'p1' }]), SP.modifierStudio(base, '12', '12', (l) => [...l, { id: 'p2' }])]); }
      catch (e) { r = 'erreur : ' + e.message; } finally { globalThis.fetch = fetch0; }
      const ids = ((b.L.get('studio_photos_12') || {}).photos || []).map((p) => p.id);
      dit(Array.isArray(r) && r.every((x) => x && x.ok) && ['p0', 'p1', 'p2'].every((x) => ids.includes(x)), 'deux photos ajoutées vite (deux appareils) ⇒ les trois sont là', ids.join(',') + (Array.isArray(r) ? '' : ' ' + r));
    }
  }
  // ── 5. save : l'app qui se ferme vide les sauvegardes en attente ───────────
  console.log('── save différé de 500 ms : vidé à la fermeture (pagehide / page masquée)');
  {
    const fv = extraire(APP, 'viderAvantFermeture'), vs = extraire(APP, 'viderSave');
    dit(!!fv && !!vs, 'viderAvantFermeture et viderSave existent');
    const faits = [];
    const ctx = { _saveTimers: { vinted_annonce_numeros: 1, vinted_buyprice_by_num: 2 }, _saveRun: {}, _cloudTimer: 9, _cloudRun: null, _enSortie: false, clearTimeout: () => {}, faits };
    ctx._saveRun.vinted_annonce_numeros = () => { faits.push('fiches'); delete ctx._saveTimers.vinted_annonce_numeros; };
    ctx._saveRun.vinted_buyprice_by_num = () => { faits.push('prix'); delete ctx._saveTimers.vinted_buyprice_by_num; };
    ctx._cloudRun = () => faits.push('nuage');
    try {
      vm.createContext(ctx);
      vm.runInContext(`var _saveTimers = this._saveTimers, _saveRun = this._saveRun, _cloudTimer = this._cloudTimer, _cloudRun = this._cloudRun, _enSortie = false;\n${vs.replace(/^const /, 'var ')}\n${fv.replace(/^const /, 'var ')}\nviderAvantFermeture(); this.sortie = _enSortie;`, ctx);
    } catch (e) { faits.push('erreur : ' + e.message); }
    dit(faits.includes('fiches') && faits.includes('prix'), 'les DEUX sauvegardes en attente sont faites tout de suite (navigateur + file d\'envoi)', faits.join(','));
    dit(faits.indexOf('nuage') > faits.indexOf('prix') && faits.indexOf('nuage') > faits.indexOf('fiches') && ctx.sortie === true, 'puis l\'envoi au nuage part sans attendre (en `keepalive`)', faits.join(',') + ' sortie=' + ctx.sortie);
    const ecoute = /addEventListener\('visibilitychange',[^\n]*viderAvantFermeture\(\)/.test(APP) && /addEventListener\('pagehide',[^\n]*viderAvantFermeture\(\)/.test(APP);
    dit(ecoute, 'branché sur `pagehide` ET sur la page masquée (iPhone : glisser l\'app)');
  }
  // ── 6. Devises : écartées et dites, jamais converties ──────────────────────
  console.log('── Devises (§3 International) : une autre devise que l\'euro est écartée et nommée');
  {
    const PM = await charger('src/porteMonnaie.js');
    if (!PM) dit(false, 'src/porteMonnaie.js se charge');
    else {
      const now = Date.now(), cap = new Date(now - 3600e3).toISOString();
      const r = PM.porteMonnaieParCompte({ billing: [
        { id: 'harvest_111_billing', cap, main: { amount: '50.00', currency_code: 'EUR' }, escrow: { amount: '10.00', currency_code: 'EUR' } },
        { id: 'harvest_222_billing', cap, main: { amount: '80.00', currency_code: 'GBP' }, escrow: { amount: '20.00', currency_code: 'GBP' } },
      ], releves: [], comptes: [{ uid: '111', nom: 'shop_fr' }, { uid: '222', nom: 'shop_uk' }], maintenant: now });
      dit(r.total.dispo === 50 && r.total.attente === 10, 'le total ne compte QUE les euros (50 €, pas 130)', JSON.stringify({ d: r.total.dispo, a: r.total.attente }));
      dit(Array.isArray(r.total.autreDevise) && r.total.autreDevise.some((x) => /shop_uk/.test(x) && /GBP/.test(x)), 'le compte en GBP est NOMMÉ à part (« shop_uk (GBP) »)', JSON.stringify(r.total.autreDevise));
    }
    const src = extraire(APP, 'montantCommandeLu');
    let v = null;
    try { const ctx = {}; vm.createContext(ctx); vm.runInContext(src.replace(/^const /, 'var ') + '\nthis.f = montantCommandeLu;', ctx); v = [ctx.f({ price: { amount: '12.5', currency_code: 'GBP' } }), ctx.f({ price: { amount: '12.5', currency_code: 'EUR' } })]; } catch (e) { v = ['erreur', e.message]; }
    dit(v[0] === null && v[1] === 12.5, 'une commande en GBP n\'est pas lue en euros (« dépensé », CA) ; en EUR, oui', JSON.stringify(v));
    const tre = /const amt = montantCommandeLu\(o\);\s*if \(amt == null\) continue;/.test(APP)
      // (12 nov., intégration) ou la somme « au moins » de la revue fin : chaque achat passe par la même lecture.
      || /sommeConnue\(\[\.\.\.achatsVinted\.map\(montantCommandeLu\)/.test(APP);
    dit(tre, 'Trésorerie « dépensé » passe par cette lecture (plus de `Number(o.price.amount)`)');
  }
  console.log(ko ? `\n❌ donnees-suite : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ donnees-suite : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
