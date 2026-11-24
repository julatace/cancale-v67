// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LOGOS DES TRANSPORTEURS » (23 nov. — Julien : « même le logo pour les codes de retrait doit être parfait,
//  professionnel » ; « il ne peut pas manquer un logo de transporteur »).
//  La RÈGLE : chaque transporteur que VRM peut nommer a SON logo dessiné (src/transporteursVisuels.js,
//  `marqueDuTransporteur(cle).svg`), dans le même cadre 32 × 32. Les noms viennent de PARTOUT :
//    1. la table des colis de l'app (`CARRIERS` de src/App.jsx, sauf `autre` — le filet du serveur) ;
//    2. ce que rendent `cleTransporteur` (src/transporteursVisuels.js) et `carrierKey` (src/App.jsx) pour chaque nom écrit
//       par une plateforme ou un e-mail (liste ci-dessous : Vinted Go, Mondial Relay, InPost, Relais Colis, Chronopost,
//       Pickup, Shop2Shop, Colissimo, La Poste, UPS, DPD, GLS, DHL, Colis Privé, FedEx, Amazon) ;
//    3. les règles de suivi du serveur (api/_lib/transporteurs.js `CARRIERS_LUS`, `RANG_CARRIER`, api/_lib/suivi-colis.js
//       `TRANSPORTEURS_SAISIE`, api/_lib/depart-colis.js `DEPART_CARRIERS`) ;
//    4. les clés MESURÉES dans la vraie base le 23 nov. (lecture seule, `carrier` des lignes email_track / transp_ / depart_) :
//       mondialrelay, chronopost, vinted, colissimo, dpd, shop2shop (+ « autre », le filet).
//  Rouge : une clé sans logo, un dessin vide ou mal formé (balises non fermées), une clé hors du cadre 32 × 32 commun.
//  Le repli neutre (le carton gris, `LogoInconnu`) reste le filet d'un transporteur jamais vu : il n'est PAS un logo.
//  Signalé (jaune, non bloquant) : un logo de l'app absent de la copie de l'extension (vinted-sync-extension/vrm-ui.js,
//  refaite par scripts/recopier-logos-extension.cjs à la prochaine version de l'extension).
//  `--mutation` : retire un dessin ⇒ l'audit doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + d : '')); } return c; };

// Les clés d'un objet littéral `const NOM = { cle: …, … };` (une entrée par ligne, comme dans App.jsx).
const clesObjet = (src, nom) => { const i = src.indexOf('const ' + nom + ' = {'); if (i < 0) return null; const fin = src.indexOf('\n};', i);
  return [...src.slice(i, fin).matchAll(/^\s{2}([a-z0-9]+)\s*:/gm)].map((m) => m[1]); };
const tableau = (src, nom) => { const m = new RegExp('(?:const|let)\\s+' + nom + '\\s*=\\s*(?:Object\\.freeze\\()?\\[([^\\]]*)\\]').exec(src); return m ? [...m[1].matchAll(/'([a-z0-9]+)'/g)].map((x) => x[1]) : null; };
// `carrierKey` de l'app, extraite telle quelle et exécutée (jamais recopiée à la main).
const carrierKeyApp = (src) => { const i = src.indexOf('const carrierKey = (raw) => {'); const fin = src.indexOf('\n};', i); return new Function(src.slice(i, fin + 3) + '\nreturn carrierKey;')(); };

const NOMS = ['Vinted Go', 'vinted', 'Mondial Relay', 'mondial_relay', 'InPost', 'Mondial Relay by InPost', 'Relais Colis', 'Chronopost', 'Chronopost Pickup', 'Pickup',
  'Shop2Shop', 'Chronopost Shop2Shop', 'Colissimo', 'La Poste', 'UPS', 'DPD', 'GLS', 'DHL', 'Colis Privé', 'FedEx', 'Amazon', 'Amazon Logistics'];
const MESURE_BASE_23NOV = ['mondialrelay', 'chronopost', 'vinted', 'colissimo', 'dpd', 'shop2shop'];

(async () => {
  const T = await import(pathToFileURL(path.join(R, 'src', 'transporteursVisuels.js')).href);
  const app = lire('src/App.jsx');
  const mutation = process.argv.includes('--mutation');
  const dessin = (cle) => { const m = T.marqueDuTransporteur(cle); if (!m) return null; if (mutation && cle === 'mondialrelay') return { ...m, svg: '' }; return m; };
  const sources = new Map();   // clé ⇒ d'où elle vient
  const noter = (cle, d) => { if (!cle || cle === 'autre') return; if (!sources.has(cle)) sources.set(cle, new Set()); sources.get(cle).add(d); };

  const carriers = clesObjet(app, 'CARRIERS');
  dit(Array.isArray(carriers) && carriers.length >= 10, `la table CARRIERS de l'app est lue (${carriers ? carriers.length : 0} clés)`);
  for (const k of carriers || []) noter(k, 'App CARRIERS');
  const ck = carrierKeyApp(app);
  for (const n of NOMS) { noter(T.cleTransporteur(n), `cleTransporteur(« ${n} »)`); noter(ck(n), `carrierKey(« ${n} »)`); }
  const tr = lire('api/_lib/transporteurs.js'), sc = lire('api/_lib/suivi-colis.js'), dc = lire('api/_lib/depart-colis.js');
  for (const k of tableau(tr, 'CARRIERS_LUS') || []) noter(k, 'serveur CARRIERS_LUS');
  for (const k of tableau(sc, 'TRANSPORTEURS_SAISIE') || []) noter(k, 'serveur TRANSPORTEURS_SAISIE');
  for (const k of tableau(dc, 'DEPART_CARRIERS') || []) noter(k, 'serveur DEPART_CARRIERS');
  const rang = /RANG_CARRIER\s*=\s*\{([^}]*)\}/.exec(tr); for (const m of rang ? rang[1].matchAll(/([a-z0-9]+)\s*:/g) : []) noter(m[1], 'serveur RANG_CARRIER');
  for (const k of MESURE_BASE_23NOV) noter(k, 'base mesurée (23 nov.)');
  for (const k of Object.keys(T.TRANSPORTEURS)) noter(k, 'TRANSPORTEURS');
  dit(sources.size >= 15, `${sources.size} transporteurs inventoriés (code, règles de suivi, base mesurée)`, [...sources.keys()].join(','));

  const balisesOk = (svg) => { const ouvre = (svg.match(/<(path|g|text|rect|circle|svg|line|polyline|polygon|ellipse)\b[^>]*[^/]>/g) || []).length; const ferme = (svg.match(/<\/(path|g|text|rect|circle|svg|line|polyline|polygon|ellipse)>/g) || []).length; return ouvre === ferme; };
  for (const [cle, d] of [...sources.entries()].sort()) {
    const m = dessin(cle);
    const svg = m && typeof m.svg === 'string' ? m.svg : '';
    dit(!!m && /^#[0-9A-F]{6}$/i.test(m.fond || '') && svg.length > 40 && balisesOk(svg) && T.nomDuTransporteur(cle),
      `${cle} (${T.nomDuTransporteur(cle) || '?'}) a son logo dessiné, dans le cadre commun`, !m ? 'aucune marque' : !svg ? 'dessin vide' : !balisesOk(svg) ? 'balises mal fermées' : [...d].join(' · '));
  }
  // Même cadre partout : le liseré commun et la tuile 32 × 32 (src/PastilleTransporteur.jsx).
  const pastille = lire('src/PastilleTransporteur.jsx');
  dit(/viewBox="0 0 32 32"/.test(pastille) && /LISERE_TUILE/.test(pastille), 'un seul cadre : tuile 32 × 32 et liseré commun (LogoTransporteur)');
  // La copie de l'extension : signalée, pas bloquante (elle se refait à la prochaine version de l'extension).
  const ui = lire('vinted-sync-extension/vrm-ui.js'); const mm = /const LOGOS_TRANSP = (\{.*\});/.exec(ui);
  const ext = mm ? Object.keys(JSON.parse(mm[1])) : [];
  const manque = Object.keys(T.TRANSPORTEURS).filter((k) => !ext.includes(k));
  console.log(manque.length ? `  ⚠️  extension : ${manque.join(', ')} pas encore dans sa copie des logos (node scripts/recopier-logos-extension.cjs à sa prochaine version)` : '  ✅ extension : la copie a tous les logos');
  console.log(`\n${ko ? '❌' : '✅'} audit-logos-transporteurs : ${ok} verts, ${ko} rouges${mutation ? ' (mutation : un rouge est attendu)' : ''}`);
  process.exit(mutation ? (ko ? 0 : 1) : (ko ? 1 : 0));
})();
