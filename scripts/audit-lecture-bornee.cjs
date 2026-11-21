// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « UNE LECTURE DE LA BASE FINIT TOUJOURS » (21 nov., fluidité) — src/lectureBornee.js EXÉCUTÉ.
//    node scripts/audit-lecture-bornee.cjs        ·   MUTATION=1 : la borne retirée ⇒ rouge (sa preuve)
//  Une lecture GET de <base>/rest/v1/ qui ne répond jamais est abandonnée (AbortError) ; une écriture, une route /api,
//  une lecture qui porte son propre signal, une autre adresse passent telles quelles ; une réponse arrivée annule la borne.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
let ko = 0, ok = 0;
const dit = (b, q) => { if (b) ok++; else ko++; console.log((b ? '  ✅ ' : '  ❌ ') + q); };
(async () => {
  let src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lectureBornee.js'), 'utf8');
  if (process.env.MUTATION) src = src.replace("const t = minuteur(() => { try { ctrl.abort(); } catch (_) {} }, borneMs);", 'const t = 0;');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-lb-')), 'lectureBornee.mjs');
  fs.writeFileSync(f, src);
  const M = await import('file://' + f);
  const BASE = 'https://exemple.supabase.co';
  const vus = [];
  // Un fetch qui ne répond JAMAIS, sauf si son signal l'abandonne.
  const pendu = (input, init) => { vus.push({ input, init }); return new Promise((_, ko2) => { const s = init && init.signal; if (s) s.addEventListener('abort', () => { const e = new Error('abandon'); e.name = 'AbortError'; ko2(e); }); }); };
  const F = M.creerLectureBornee(pendu, BASE, { borneMs: 40 });
  const issue = (p, ms = 200) => Promise.race([p.then(() => 'repondu', (e) => 'echec:' + (e && e.name)), new Promise((r) => setTimeout(() => r('attente'), ms))]);
  dit(await issue(F(BASE + '/rest/v1/app_data?id=eq.lbc_ventes&select=ventes:data->ventes')) === 'echec:AbortError', 'une lecture de la base qui ne répond jamais finit en échec (AbortError), jamais une attente éternelle');
  dit(await issue(F(BASE + '/rest/v1/app_data', { method: 'POST', body: '{}' }), 120) === 'attente', 'une ÉCRITURE n\'est jamais bornée (elle ne doit pas être coupée en route)');
  dit(await issue(F('/api/compte?mode=photo'), 120) === 'attente', 'une route /api passe telle quelle');
  const propre = new AbortController();
  dit(await issue(F(BASE + '/rest/v1/x', { signal: propre.signal }), 120) === 'attente', 'une lecture qui porte SON signal garde sa règle');
  dit(await issue(F('https://autre.example/rest/v1/x'), 120) === 'attente', 'une autre adresse passe telle quelle');
  // Une réponse arrivée annule la borne.
  let annules = 0;
  const G = M.creerLectureBornee(() => Promise.resolve({ ok: true }), BASE, { borneMs: 10, annuler: (t) => { annules++; clearTimeout(t); } });
  dit(await issue(G(BASE + '/rest/v1/y')) === 'repondu' && annules === 1, 'une lecture qui répond est rendue telle quelle, sa borne annulée');
  dit(M.BORNE_LECTURE_BASE_MS >= 10000 && M.BORNE_LECTURE_BASE_MS <= 30000, `la borne est raisonnable (${M.BORNE_LECTURE_BASE_MS} ms jusqu'aux en-têtes)`);
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
  dit(/\ninstallerLectureBornee\(SUPABASE_URL\);/.test(app), 'l\'app la pose au chargement (installerLectureBornee)');
  console.log(ko ? `\n❌ audit-lecture-bornee : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-lecture-bornee : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
