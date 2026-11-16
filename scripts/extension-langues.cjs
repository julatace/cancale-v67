#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES LANGUES DE L'EXTENSION (16 nov., lot traduction-restes, 5.394)
//      node scripts/extension-langues.cjs            (écrit vinted-sync-extension/_locales/)
//      node scripts/extension-langues.cjs --verifier (rouge si _locales n'est pas ce que le code produit)
// ════════════════════════════════════════════════════════════════════════════
// Le français est dans le CODE de l'extension : chaque texte visible y passe par
// `T('clé', 'français', vars)` (popup.js, vrm-badge.js, parcours-popup.js) ou porte
// `data-i18n="clé"` dans popup.html — le français écrit là est à la fois le repli (une
// API chrome.i18n muette ⇒ le texte d'avant, mot pour mot) et la SOURCE de
// _locales/fr/messages.json (default_locale du manifeste). Les quatre autres langues :
// scripts/extension-langues-traductions.cjs. chrome.i18n suit la langue du NAVIGATEUR
// (l'extension ne lit pas le choix de l'app).
// Contrôles : chaque clé a son français UNE fois (même texte partout), ses quatre
// traductions, les mêmes variables {x}, aucune traduction en trop ; un nom de clé
// accepté par chrome.i18n ([a-z0-9_], unique sans la casse) ; le manifeste porte
// default_locale « fr » ; les fichiers écrits sont ceux que ce script produit.
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.EXT_LANGUES_RACINE || path.join(__dirname, '..');
const EXT = path.join(R, 'vinted-sync-extension');
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
const FICHIERS_JS = ['popup.js', 'vrm-badge.js', 'parcours-popup.js'];

// Un littéral JS entre apostrophes ou guillemets, à partir de `i` (l'ouvrant) ⇒ [valeur, fin].
function litteral(src, i) {
  const q = src[i]; let v = '', j = i + 1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { const n = src[++j]; v += n === 'n' ? '\n' : n; continue; }
    if (c === q) return [v, j + 1];
    v += c;
  }
  return [null, j];
}
function relever() {
  const fr = {}, ou = {}, fautes = [];
  const poser = (cle, texte, d) => {
    if (cle in fr && fr[cle] !== texte) fautes.push(`la clé ${cle} porte deux français : « ${fr[cle]} » (${ou[cle]}) et « ${texte} » (${d})`);
    if (!(cle in fr)) { fr[cle] = texte; ou[cle] = d; }
  };
  for (const f of FICHIERS_JS) {
    const src = fs.readFileSync(path.join(EXT, f), 'utf8');
    const re = /\bT\(\s*'([A-Za-z0-9_@]+)'\s*,\s*/g; let m;
    while ((m = re.exec(src))) {
      const i = re.lastIndex; if (src[i] !== "'" && src[i] !== '"') { fautes.push(`${f} : T('${m[1]}', …) sans français écrit en clair`); continue; }
      const [v] = litteral(src, i);
      if (v == null) { fautes.push(`${f} : T('${m[1]}') — français illisible`); continue; }
      poser(m[1], v, f);
    }
  }
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-i18n="([A-Za-z0-9_]+)"[^>]*>([^<]*)<\/\1>/g)) poser(m[2], m[3], 'popup.html');
  for (const m of html.matchAll(/<\w+[^>]*\saria-label="([^"]*)"[^>]*\sdata-i18n-aria="([A-Za-z0-9_]+)"/g)) poser(m[2], m[1], 'popup.html (aria)');
  fr.p_langue = 'fr';
  return { fr, fautes };
}
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
// chrome.i18n : « $ » ouvre une substitution — un « $ » du texte s'écrit « $$ ».
const message = (t) => ({ message: String(t).replace(/\$/g, '$$$$') });
function produire() {
  const { fr, fautes } = relever();
  delete require.cache[require.resolve(path.join(R, 'scripts', 'extension-langues-traductions.cjs'))];
  const TR = require(path.join(R, 'scripts', 'extension-langues-traductions.cjs'));
  const cles = Object.keys(fr).sort();
  const vues = new Map();
  for (const k of cles) {
    if (!/^[a-z0-9_]+$/.test(k)) fautes.push(`clé ${k} : chrome.i18n n'accepte que [a-z0-9_] (minuscules ici)`);
    const b = k.toLowerCase(); if (vues.has(b)) fautes.push(`clés ${vues.get(b)} et ${k} : la même sans la casse`); vues.set(b, k);
    const t = TR[k];
    for (const l of LANGUES.slice(1)) {
      if (!t || typeof t[l] !== 'string' || !t[l].trim()) { fautes.push(`${k} : pas de traduction « ${l} » (scripts/extension-langues-traductions.cjs)`); continue; }
      if (vars(t[l]) !== vars(fr[k])) fautes.push(`${k} (${l}) : variables {${vars(t[l])}} ≠ français {${vars(fr[k])}}`);
    }
  }
  for (const k of Object.keys(TR)) if (!(k in fr)) fautes.push(`${k} : traduit mais appelé nulle part (clé en trop)`);
  const sorties = {};
  for (const l of LANGUES) {
    const o = {};
    for (const k of cles) o[k] = message(l === 'fr' ? fr[k] : ((TR[k] || {})[l] || fr[k]));
    sorties[`_locales/${l}/messages.json`] = JSON.stringify(o, null, 2) + '\n';
  }
  return { fr, cles, sorties, fautes };
}

if (require.main === module) {
  const { cles, sorties, fautes } = produire();
  const verifier = process.argv.includes('--verifier');
  const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  if (man.default_locale !== 'fr') fautes.push(`manifest.json : default_locale doit valoir « fr » (lu : ${JSON.stringify(man.default_locale)})`);
  if (verifier) {
    for (const [rel, txt] of Object.entries(sorties)) {
      let lu = null; try { lu = fs.readFileSync(path.join(EXT, rel), 'utf8'); } catch (_) {}
      if (lu !== txt) fautes.push(`${rel} n'est pas à jour — lance node scripts/extension-langues.cjs`);
    }
    try { const ls = fs.readdirSync(path.join(EXT, '_locales')).filter((d) => !LANGUES.includes(d)); if (ls.length) fautes.push(`_locales contient ${ls.join(', ')} (seules ${LANGUES.join(', ')})`); } catch (_) { fautes.push('_locales absent'); }
  } else if (!fautes.length) {
    for (const [rel, txt] of Object.entries(sorties)) { const p = path.join(EXT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); }
  }
  if (fautes.length) { console.log('❌ langues de l’extension :\n   → ' + fautes.join('\n   → ')); process.exit(1); }
  console.log(`✅ langues de l’extension : ${cles.length} textes × ${LANGUES.length} langues${verifier ? ' (à jour)' : ' écrits dans vinted-sync-extension/_locales/'}`);
}
module.exports = { produire, LANGUES, FICHIERS_JS };
