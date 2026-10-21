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
//     par la bonne directive — l'adresse de la base est lue dans App.jsx (§11).
// Usage : node scripts/audit-csp.cjs   (sort en 1 si un contrôle échoue)
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

const cfg = JSON.parse(lire('vercel.json'));
const tout = (cfg.headers || []).find((h) => h.source === '/(.*)');
const h = (k) => ((tout && tout.headers) || []).find((e) => e.key.toLowerCase() === k.toLowerCase());
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

console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) en échec' : '✅ tout est vert'}`);
process.exit(ko ? 1 : 0);
