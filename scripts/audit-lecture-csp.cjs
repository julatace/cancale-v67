#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — une photo d'un hôte que `connect-src` refuse n'est jamais lue par fetch
//  (24 nov., bugs-terrain ; docs/passation/2026-11-24-bugs-terrain.md)
//
//  Signal réel : journal des plantages (`app_data` plantage_*), 22 nov., écran
//  Annonces, Mac Chrome : « CSP connect-src ← https://img.leboncoin.fr ». Les
//  lecteurs de photos génériques (visuels réseaux, fiche de préparation, dossier
//  de litige) faisaient `fetch` d'une photo Leboncoin : refusé par le navigateur,
//  rien lu, un plantage noté à chaque essai.
//
//  Ce qui est EXÉCUTÉ (jamais lu comme texte seulement) :
//   1. src/lisibleParLaPage.js recopie EXACTEMENT le `connect-src` de vercel.json ;
//   2. la règle : Leboncoin refusé ; Vinted (*.vinted.net), la base, la même
//      origine, data:, blob: permis ;
//   3. lirePhotoVisuel et photoNoirePourFiche (App.jsx), imageEnOctets
//      (dossierLitige.js), avec un `fetch` espion : une photo Leboncoin ⇒ AUCUNE
//      requête ; une photo vinted.net ⇒ une requête (la garde ne coupe pas tout).
//  Puis 4 mutations (règle toujours vraie, garde retirée de chaque lecteur, une
//  origine en plus dans vercel.json) : chacune doit rendre l'audit rouge.
//
//    node scripts/audit-lecture-csp.cjs [racine]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const RACINE = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const { sourceApp } = require(path.join(__dirname, '_source-app.cjs'));

const LBC = 'https://img.leboncoin.fr/api/v1/lbcpb1/images/ab/cd/ef.jpg?rule=ad-large';
const VINTED = 'https://images1.vinted.net/t/01_abc/f800/123.jpeg?s=x';
const PAGE = 'https://vrm.center';

// Une fonction du texte de l'app, de son en-tête à son accolade fermante.
function extraire(texte, entete) {
  const i = texte.indexOf(entete);
  if (i < 0) return null;
  let j = texte.indexOf('{', i + entete.length - 1), prof = 0;
  for (let k = j; k < texte.length; k++) {
    const ch = texte[k];
    if (ch === '{') prof++;
    else if (ch === '}') { prof--; if (prof === 0) return texte.slice(i, k + 1); }
  }
  return null;
}

function connectSrcVercel(texteVercel) {
  const j = JSON.parse(texteVercel);
  const listes = [];
  for (const h of j.headers || []) for (const x of h.headers || []) {
    if (!/^content-security-policy/i.test(x.key || '')) continue;
    const m = /connect-src([^;]*)/.exec(String(x.value || ''));
    if (m) listes.push(m[1].trim().split(/\s+/).filter((t) => t && !/^'self'$|^data:$|^blob:$/.test(t)).sort());
  }
  return listes;
}

async function verifier({ texteApp, texteVercel, modRegle, texteLitige }) {
  const ko = [];
  // 1. la recopie
  const lister = connectSrcVercel(texteVercel);
  if (!lister.length) ko.push('vercel.json : aucun connect-src lu');
  if (!modRegle) { ko.push('src/lisibleParLaPage.js absent'); return ko; }
  const ici = [...modRegle.CONNECT_SRC].sort();
  for (const l of lister) if (JSON.stringify(l) !== JSON.stringify(ici)) ko.push(`recopie différente de vercel.json : ${JSON.stringify(l)} ≠ ${JSON.stringify(ici)}`);
  // 2. la règle
  const R = (u) => modRegle.lisibleParLaPage(u, PAGE);
  const attendus = [[LBC, false], ['https://evil.vinted.net.example.com/x.jpg', false], ['http://images1.vinted.net/x.jpg', false],
    [VINTED, true], ['https://lgonxzrzjcqthjtbdpzo.supabase.co/storage/v1/x.png', true], ['/assets/a.png', true], [PAGE + '/hl-qr?x', true], ['data:image/png;base64,AA', true], ['blob:https://vrm.center/1', true]];
  for (const [u, v] of attendus) if (R(u) !== v) ko.push(`règle : ${u} ⇒ ${R(u)} (attendu ${v})`);
  // 3. les lecteurs, exécutés
  const lecteurs = [
    ['lirePhotoVisuel', 'async function lirePhotoVisuel(u) {'],
    ['photoNoirePourFiche', 'const photoNoirePourFiche = async (url) => {'],
  ];
  for (const [nom, entete] of lecteurs) {
    const corps = extraire(texteApp, entete);
    if (!corps) { ko.push(`${nom} introuvable dans App.jsx`); continue; }
    for (const [u, veut] of [[LBC, 0], [VINTED, 1]]) {
      const appels = [];
      const ctx = {
        fetch: async (x) => { appels.push(String(x)); return { ok: false, blob: async () => null }; },
        lisibleParLaPage: R, URL, AbortController, setTimeout, clearTimeout, Promise,
        photosVinted: { estPhotoVinted: () => false, blobDe: () => null }, photoViaServeur: async () => null, __vmrExtReady: false, vmrPhotoIssue: async () => null,
        document: { createElement: () => ({}) }, tramerNoir: () => {}, globalThis: {}, sortie: null,
      };
      vm.createContext(ctx);
      try {
        vm.runInContext(`${corps.startsWith('async function') ? corps : corps.replace(/^const /, 'var ')}\nsortie = ${nom}(${JSON.stringify(u)});`, ctx, { timeout: 2000 });
        await ctx.sortie;
      } catch (e) { ko.push(`${nom} : ${e.message}`); continue; }
      const n = appels.filter((a) => a === u).length;
      if (veut === 0 && n) ko.push(`${nom} : une photo Leboncoin est demandée par fetch (${n} fois) — refusée par connect-src`);
      if (veut === 1 && !n) ko.push(`${nom} : une photo vinted.net n'est plus demandée (la garde coupe tout)`);
    }
  }
  // imageEnOctets (dossierLitige.js), le module lui-même, sur un texte éventuellement muté
  if (texteLitige != null) {
    const dossier = fs.mkdtempSync(path.join(require('os').tmpdir(), 'csp-litige-'));
    try {
      for (const f of fs.readdirSync(path.join(RACINE, 'src'))) if (/\.js$/.test(f)) fs.copyFileSync(path.join(RACINE, 'src', f), path.join(dossier, f));
      fs.writeFileSync(path.join(dossier, 'package.json'), '{"type":"module"}');
      fs.writeFileSync(path.join(dossier, 'dossierLitige.js'), texteLitige);
      if (modRegle.__texte) fs.writeFileSync(path.join(dossier, 'lisibleParLaPage.js'), modRegle.__texte);
      const m = await import(pathToFileURL(path.join(dossier, 'dossierLitige.js')).href + '?t=' + Date.now());
      for (const [u, veut] of [[LBC, 0], [VINTED, 1]]) {
        const appels = [];
        const avant = globalThis.fetch;
        globalThis.fetch = async (x) => { appels.push(String(x)); return { ok: false }; };
        try { await m.imageEnOctets(u); } finally { globalThis.fetch = avant; }
        if (veut === 0 && appels.length) ko.push('imageEnOctets : une photo Leboncoin est demandée par fetch — refusée par connect-src');
        if (veut === 1 && !appels.length) ko.push("imageEnOctets : une photo vinted.net n'est plus demandée");
      }
    } catch (e) { ko.push('imageEnOctets : ' + e.message); }
    finally { fs.rmSync(dossier, { recursive: true, force: true }); }
  }
  return ko;
}

async function chargerRegle(texte) {
  if (texte == null) return null;
  const f = path.join(require('os').tmpdir(), `csp-regle-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, texte);
  try { const m = await import(pathToFileURL(f).href); return { ...m, __texte: texte }; } finally { fs.rmSync(f, { force: true }); }
}

(async () => {
  const texteApp = sourceApp(RACINE);
  const texteVercel = fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8');
  const fRegle = path.join(RACINE, 'src', 'lisibleParLaPage.js');
  const texteRegle = fs.existsSync(fRegle) ? fs.readFileSync(fRegle, 'utf8') : null;
  const texteLitige = fs.readFileSync(path.join(RACINE, 'src', 'dossierLitige.js'), 'utf8');

  const ko = await verifier({ texteApp, texteVercel, modRegle: await chargerRegle(texteRegle), texteLitige });
  if (ko.length) { console.log('✗ audit-lecture-csp :\n  - ' + ko.join('\n  - ')); process.exit(1); }
  console.log('✓ lecture-csp : recopie de connect-src exacte, règle juste, 3 lecteurs exécutés (Leboncoin : 0 requête, vinted.net : 1)');

  // Mutations : chacune doit être vue.
  const mutations = [
    ['règle toujours vraie', { texteRegle: texteRegle && texteRegle.replace("if (!s) return false;", 'return true;') }],
    ['garde retirée de lirePhotoVisuel', { texteApp: texteApp.replace('  if (!lisibleParLaPage(u)) return null;\n', '') }],
    ['garde retirée de photoNoirePourFiche', { texteApp: texteApp.replace(" || !lisibleParLaPage(url)) return null;", ') return null;') }],
    ['garde retirée de imageEnOctets', { texteLitige: texteLitige.replace('if (!src || !lisibleParLaPage(src)) return null;', 'if (!src) return null;') }],
    ['une origine de plus dans vercel.json', { texteVercel: texteVercel.split('connect-src \'self\'').join('connect-src \'self\' https://img.leboncoin.fr') }],
  ];
  let vues = 0;
  for (const [nom, m] of mutations) {
    const k = await verifier({ texteApp: m.texteApp || texteApp, texteVercel: m.texteVercel || texteVercel, modRegle: await chargerRegle(m.texteRegle || texteRegle), texteLitige: m.texteLitige || texteLitige });
    const muteOk = (m.texteApp && m.texteApp !== texteApp) || (m.texteVercel && m.texteVercel !== texteVercel) || (m.texteRegle && m.texteRegle !== texteRegle) || (m.texteLitige && m.texteLitige !== texteLitige);
    if (!muteOk) { console.log(`✗ mutation « ${nom} » : le texte à muter est introuvable`); process.exit(1); }
    if (!k.length) { console.log(`✗ mutation « ${nom} » : l'audit reste vert`); process.exit(1); }
    vues++;
  }
  console.log(`✓ ${vues}/${mutations.length} mutations vues (rouges)`);
})().catch((e) => { console.log('✗ audit-lecture-csp : ' + (e && e.stack || e)); process.exit(1); });
