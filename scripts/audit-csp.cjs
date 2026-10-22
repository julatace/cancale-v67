#!/usr/bin/env node
// ── LA POLITIQUE DE SÉCURITÉ DU CONTENU (CSP) TIENT AVEC LE CODE (21 octobre) ──
// Le banc `scripts/bancs/csp.cjs` rend l'app sous les VRAIS en-têtes de
// vercel.json et exige zéro violation. Cet audit garde, dans le code, ce qui
// ferait revenir une violation sans qu'aucun banc ne soit relancé :
//   · vercel.json porte une CSP EN VIGUEUR (frame-ancestors 'none', base-uri,
//     object-src 'none', form-action) et la politique complète (Report-Only ou
//     en vigueur), dont le script-src n'a ni 'unsafe-inline' ni 'unsafe-eval' ;
//   · index.html n'a AUCUN script en ligne ;
//   · aucun gestionnaire en ligne (`onclick="…"`, `javascript:`) n'est écrit
//     dans un HTML fabriqué par l'app (les fenêtres imprimables héritent de la CSP) ;
//   · chaque hôte que l'app CONTACTE (fetch, script chargé, cadre) est permis
//     par la bonne directive — l'adresse de la base est lue dans App.jsx (§11) ;
//   · (22 oct.) le fond de carte OpenFreeMap (adresse LUE dans src/fondCarte.js)
//     est permis en connect-src (style, tuiles depuis le worker de MapLibre,
//     sprite, polices) et en img-src ; worker-src permet 'self' (le worker de
//     MapLibre est servi par VRM) et blob: (pdf.js) ;
//   · le service worker n'est PAS sous la politique de la page (il va chercher
//     les QR des transporteurs, hôtes variables) — ou, s'il l'est, connect-src
//     lui ouvre https: ; et la PAGE ne va jamais chercher un QR elle-même : elle
//     passe par `/hl-qr` (même origine), le service worker range ce qu'il ramène.
// Usage : node scripts/audit-csp.cjs   (sort en 1 si un contrôle échoue)
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// Les en-têtes que Vercel servira, chemin par chemin, LUS dans vercel.json avec
// la même lecture des motifs que les bancs (`_vercel.cjs` : la politique complète
// vit depuis le 22 oct. dans sa propre règle, qui exclut /sw.js).
const V = require('./bancs/_vercel.cjs');
const pour = (chemin) => { const e = V.entetesPour(chemin, { brut: true }); const out = {}; for (const [k, v] of Object.entries(e)) out[k.toLowerCase()] = v; return out; };
const ICI = pour('/');
const h = (k) => (ICI[k.toLowerCase()] != null ? { value: ICI[k.toLowerCase()] } : null);
const en = (h('Content-Security-Policy') || {}).value || '';
const ro = (h('Content-Security-Policy-Report-Only') || {}).value || '';
const complete = /default-src/.test(en) ? en : ro;
const dir = (pol, d) => { const m = new RegExp('(?:^|;)\\s*' + d + '\\s([^;]*)').exec(pol); return m ? m[1].trim().split(/\s+/) : null; };

console.log('\n── vercel.json');
dit(/frame-ancestors 'none'/.test(en), "en vigueur : frame-ancestors 'none'", en);
dit(/base-uri 'self'/.test(en) && /object-src 'none'/.test(en) && /form-action 'self'/.test(en), "en vigueur : base-uri 'self', object-src 'none', form-action 'self'");
dit(!!dir(complete, 'default-src'), 'la politique complète est servie (Report-Only ou en vigueur)');
const ss = dir(complete, 'script-src') || [];
dit(ss.length && !ss.includes("'unsafe-inline'") && !ss.includes("'unsafe-eval'"), "script-src sans 'unsafe-inline' ni 'unsafe-eval'", ss.join(' '));
dit((dir(complete, 'object-src') || []).join() === "'none'", "politique complète : object-src 'none'");
dit(/^deny$/i.test(((h('X-Frame-Options') || {}).value || '')), 'X-Frame-Options DENY');

console.log('\n── index.html');
const html = lire('index.html');
const enLigne = (html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || []);
dit(enLigne.length === 0, "aucun script en ligne (ils vivent dans public/demarrage-*.js)", enLigne.map((s) => s.slice(0, 50)).join(' | '));
for (const m of html.matchAll(/<script[^>]*\bsrc="(\/[^"]+)"/g)) {
  const f = m[1];
  if (f.startsWith('/src/')) continue;
  dit(fs.existsSync(path.join(R, 'public', f)), `le script ${f} existe dans public/`);
}

console.log('\n── le code de l\'app');
const fichiers = [];
const parcourir = (d) => { for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) parcourir(p); else if (/\.(jsx?|mjs)$/.test(e.name)) fichiers.push(p); } };
parcourir('src');
// On lit le CODE : les commentaires sont neutralisés d'abord (§ « un audit lit le code »).
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const sources = fichiers.map((f) => [f, sansCommentaires(lire(f))]);
const handlers = [];
for (const [f, s] of sources) s.split('\n').forEach((l, i) => { if (/\son(click|load|error|change|submit|input|mouseover|focus)\s*=\s*["'\\]/i.test(l) || /["'`]javascript:/i.test(l)) handlers.push(`${f}:${i + 1}`); });
dit(handlers.length === 0, 'aucun gestionnaire en ligne dans un HTML fabriqué (onclick="…", javascript:)', handlers.slice(0, 5).join(' · '));
const evals = [];
for (const [f, s] of sources) s.split('\n').forEach((l, i) => { if (/\bnew Function\s*\(|[^.\w]eval\s*\(/.test(l)) evals.push(`${f}:${i + 1}`); });
dit(evals.length === 0, "aucun eval / new Function (script-src n'a pas 'unsafe-eval')", evals.slice(0, 5).join(' · '));

// Les hôtes CONTACTÉS : fetch('https://…'), un <script> injecté, un cadre.
const app = lire('src/App.jsx');
const supa = (/const SUPABASE_URL = "([^"]+)"/.exec(app) || [])[1];
const cs = dir(complete, 'connect-src') || [];
const permis = (liste, origine) => liste.some((t) => t === origine || (t.includes('*') && new RegExp('^' + t.replace(/[.]/g, '\\.').replace('\\.*', '.*').replace('*', '[^.]+') + '$').test(origine)) || (t === 'https:' && origine.startsWith('https:')));
dit(!!supa && permis(cs, supa), 'connect-src permet la base (SUPABASE_URL lue dans App.jsx)', supa);
dit(!!supa && permis(cs, supa.replace(/^https:/, 'wss:')), '… et sa connexion en temps réel (wss:)');
const fetchs = new Set(), scripts = new Set();
for (const [, s] of sources) {
  for (const m of s.matchAll(/fetch\(\s*[`'"](https:\/\/[^/`'"$]+)/g)) fetchs.add(m[1]);
  for (const m of s.matchAll(/(?:BASE|_URL|URL_[A-Z_]+|SCRIPT)\s*=\s*[`'"](https:\/\/[^/`'"$]+)/g)) scripts.add(m[1]);
}
for (const o of fetchs) dit(permis(cs, o), `connect-src permet ${o} (appelé par fetch)`);
const ssList = dir(complete, 'script-src') || [];
for (const o of scripts) dit(permis(ssList, o) || permis(cs, o), `${o} (script ou ressource chargée) est permis`);
dit(permis(cs, 'https://images1.vinted.net'), 'connect-src permet les photos Vinted (la sonde de photosVinted fait un fetch)');
dit(ssList.includes("'wasm-unsafe-eval'"), "script-src permet WebAssembly ('wasm-unsafe-eval' : détourage local du studio photo)");
const fs_ = dir(complete, 'frame-src') || [];
dit(fs_.includes('https://challenges.cloudflare.com') && ssList.includes('https://challenges.cloudflare.com'), 'Turnstile : script-src ET frame-src challenges.cloudflare.com');
dit((dir(complete, 'worker-src') || []).includes('blob:'), "worker-src blob: (le lecteur pdf.js lance son worker depuis un blob)");
dit((dir(complete, 'worker-src') || []).includes("'self'"), "worker-src 'self' (le worker de MapLibre est un fichier servi par VRM)");

console.log('\n── la carte (OpenFreeMap)');
const fond = lire('src/fondCarte.js');
// (22 oct.) La règle, pas l'orthographe : la carte a été réécrite (un seul
// fournisseur, `FOURNISSEUR.style.{clair,sombre}`) et l'ancien `OFM_STYLE`
// n'existe plus. On lit dans le CODE (commentaires retirés) toute adresse de
// style `https://hôte/styles/…` — c'est elle que MapLibre va chercher.
const fondCode = fond.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
const styles = [...fondCode.matchAll(/['"`](https:\/\/[^/'"`]+)\/styles\//g)].map((m) => m[1]);
dit(styles.length > 0, 'les styles du fond de carte se lisent dans src/fondCarte.js', [...new Set(styles)].join(' '));
const imgs = dir(complete, 'img-src') || [];
for (const o of new Set(styles)) {
  dit(permis(cs, o), `connect-src permet ${o} (style, tuiles — depuis le worker de MapLibre —, sprite, polices)`);
  dit(permis(imgs, o) || imgs.includes(o), `img-src permet ${o}`);
}
// Le worker de MapLibre reçoit LA MÊME politique que la page (vercel.json sert
// aussi /assets/) : c'est elle qui juge ses tuiles.
const wk = pour('/assets/maplibre-gl-worker-banc.js');
const wkPol = wk['content-security-policy-report-only'] || wk['content-security-policy'] || '';
dit(permis(dir(wkPol, 'connect-src') || [], styles[0] || 'https://?'), 'le worker de la carte (/assets/…) est servi avec une politique qui permet ses tuiles');

console.log('\n── le service worker et les QR de Ma journée hors ligne');
const sw = pour('/sw.js');
const swCs = dir(sw['content-security-policy-report-only'] || '', 'connect-src') || dir(/connect-src/.test(sw['content-security-policy'] || '') ? sw['content-security-policy'] : '', 'connect-src');
dit(!swCs || swCs.includes('https:'), "/sw.js n'est pas sous la politique de la page (ou connect-src lui ouvre https:) — il va chercher les QR des transporteurs, hôtes variables", swCs ? swCs.join(' ') : 'directives structurelles seulement');
const swSrc = lire('public/sw.js');
const blocQr = (/url\.pathname === '\/hl-qr'[\s\S]*?\n  \}\n/.exec(swSrc) || [''])[0];
dit(/fetch\(/.test(blocQr) && /\.put\(/.test(blocQr), 'le service worker RANGE dans la réserve le QR qu\'il ramène (sinon la réserve ne se remplit plus)', blocQr ? '' : 'bloc /hl-qr introuvable');
const appSrc = sansCommentaires(app);
const rq = (/const rechaufferQr = async[\s\S]*?\n\};\n/.exec(appSrc) || [''])[0];
const cibles = [...rq.matchAll(/\bfetch\(\s*([A-Za-z_$][\w$]*|[^,)]*)/g)].map((m) => m[1].trim());
const locales = new Set([...rq.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*adresseQrLocale\(/g)].map((m) => m[1]));
dit(!!rq && cibles.length > 0 && cibles.every((c) => locales.has(c) || /^adresseQrLocale\(/.test(c)), "la page ne va chercher un QR que par `/hl-qr` (même origine) — jamais chez le transporteur", rq ? 'fetch(' + cibles.join('), fetch(') + ')' : 'rechaufferQr introuvable');

// (22 oct., revue du chantier) — quatre défauts reproduits, gardés ici.
console.log('\n── les fenêtres que l\'app ouvre, le journal, la réserve des QR (revue du 22 oct.)');
const corps = (debut, fin = '\n};\n') => { const i = appSrc.indexOf(debut); if (i < 0) return ''; const j = appSrc.indexOf(fin, i); return appSrc.slice(i, j + fin.length); };
const recu = corps('const openReceipt = (a) => {');
dit(/<script src="\/recu-boutons\.js"><\/script>/.test(recu) && fs.existsSync(path.join(R, 'public', 'recu-boutons.js')),
  'le reçu charge SES gestes (`/recu-boutons.js`, même origine) — branchés depuis l\'onglet de VRM, ils mouraient quand l\'app se recharge');
const secours = (recu.match(/addEventListener\('click'/g) || []).length;
const gardes = (recu.match(/if \(w\.__vrmRecuBoutons\) return;/g) || []).length;
dit(secours === gardes, 'les gestes posés depuis l\'onglet de VRM ne sont qu\'un secours (gardés par `__vrmRecuBoutons` : une impression, jamais deux)', `${secours} écouteur(s), ${gardes} gardé(s)`);
const rb = fs.existsSync(path.join(R, 'public', 'recu-boutons.js')) ? lire('public/recu-boutons.js') : '';
dit(/vrm-recu-imprimer/.test(rb) && /vrm-recu-fermer/.test(rb) && /print\(\)/.test(rb) && /__vrmRecuBoutons\s*=/.test(rb), '`/recu-boutons.js` branche « Imprimer » et « Fermer » et le dit (`__vrmRecuBoutons`)');
const facture = corps('function ouvrirDocumentImprimable(html) {', '\n}\n');
for (const [nom, c, cle] of [['le reçu', recu, 'recu'], ['la facture', facture, 'facture']]) {
  const iOpen = c.indexOf('w.document.open()'), iEcoute = c.indexOf(`ecouterFenetreCsp(w, '${cle}')`), iWrite = c.indexOf('w.document.write(');
  dit(iOpen >= 0 && iEcoute > iOpen && iWrite > iEcoute, `le journal des violations écoute ${nom} (après document.open, avant d'écrire)`);
}
const mainSrc = sansCommentaires(lire('src/main.jsx'));
dit(/history\.state/.test(mainSrc) && /vrmTab/.test(mainSrc), 'le journal nomme l\'écran par `history.state.vrmTab` (l\'app retire `?tab=` de l\'adresse)');
const qi = corps('const qrImage = (t) => {');
const retours = [...qi.matchAll(/return ([^;]+);/g)].map((m) => m[1]).filter((x) => /qrUrl/.test(x));
dit(retours.length > 0 && retours.every((x) => /^qrEnHttps\(/.test(x)) && /const qrEnHttps = \(u\) => String\(u \|\| ''\)\.replace\(\/\^http:/.test(appSrc),
  'un QR hébergé en http (Vinted Go, 15 sur 15) est rendu en https par qrImage — la règle unique de tous les lecteurs', retours.join(' · '));
const swCode = sansCommentaires(swSrc);
const blocQr2 = (/url\.pathname === '\/hl-qr'[\s\S]*?\n  \}\n/.exec(swCode) || [''])[0];
const iNav = blocQr2.indexOf("req.mode === 'navigate'"), iFetch = blocQr2.indexOf('await fetch(');
dit(iNav >= 0 && iFetch > iNav, 'une NAVIGATION vers /hl-qr ne fait rien demander ni ranger (un lien posé par un autre site)');
dit(/req\.destination === 'image'/.test(blocQr2) && /x-vrm-hl-qr/.test(blocQr2) && /x-vrm-hl-qr/.test(rq), 'le service worker ne va chercher que pour une image ou la mise en réserve de VRM (`x-vrm-hl-qr`)');
dit(/const QR_MAX = \d+/.test(swCode) && /QR_MAX/.test(blocQr2), 'la réserve des QR est bornée (QR_MAX)');

console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) en échec' : '✅ tout est vert'}`);
process.exit(ko ? 1 : 0);
