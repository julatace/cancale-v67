#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — RÉSEAU INSTABLE (11 nov.) : une requête qui pend n'est jamais « en
//  cours » pour toujours, un statut passager n'est jamais un refus.
//
//  R  la règle EXÉCUTÉE (src/reseauBorne.js) : `fetchBorne` abandonne une requête
//     tenue à sa borne (« DelaiReseau »), rend la réponse arrivée à temps,
//     respecte le signal de l'appelant ; `statutPassager` (0, 408, 425, 429, 5xx) ;
//     `raisonStatut` composée avec `natureEchec` (src/gesteAnnulable.js, exécuté) :
//     429/408/425/5xx/aucune réponse ⇒ « passager » (le geste reste), 401/403/400
//     ⇒ « définitif ».
//  B  le branchement (App.jsx recollé, commentaires retirés) : chaque requête de
//     `cloudPush` (PATCH conditionnel, insertion), `lireNuageComplet`, la lecture
//     scalaire de `relireNuage`, `lireReglage`, `ecrireReglage`, et les routes des
//     factures passent par `fetchBorne` ; le 401 d'un jeton vieux est renouvelé
//     PUIS renvoyé (une fois) ; la phrase d'échec vient de `raisonStatut` ;
//     « Enregistré » ne se dit qu'une fois la file vide ET la sauvegarde réussie ;
//     « Ma facture » garde ses champs sur l'appareil et les renvoie seule.
//  --prouve : 8 mutations, chacune doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { sourceApp } = require('./_source-app.cjs');
const RACINE = path.join(__dirname, '..');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

async function juger({ borne, geste, app, fpro, fautres }) {
  const ko = [], ok = [];
  const dit = (c, m) => (c ? ok : ko).push(m);
  const R = await import(pathToFileURL(borne).href + '?t=' + Math.random());
  const G = await import(pathToFileURL(geste).href + '?t=' + Math.random());
  // ── R : la règle exécutée ───────────────────────────────────────────────
  // Une minuterie à la main : la borne « passe » quand le banc le décide.
  const fausseMinuterie = () => { const t = []; return { poser: (f, d) => { t.push({ f, d }); return t.length; }, oter: (i) => { if (t[i - 1]) t[i - 1].f = null; }, passer: () => { for (const x of t) if (x.f) { const f = x.f; x.f = null; f(); } }, t }; };
  const tenu = (url, init) => new Promise((ok_, ko_) => { if (init && init.signal) init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; ko_(e); }); });
  {
    const m = fausseMinuterie();
    const p = R.fetchBorne(tenu, '/x', { method: 'PATCH' }, 20000, m);
    let issue = null; p.then(() => { issue = 'ok'; }, (e) => { issue = e && e.name; });
    await new Promise((r) => setTimeout(r, 5));
    dit(issue === null, 'R1 une requête tenue n’est pas tranchée avant la borne');
    dit(m.t.length === 1 && m.t[0].d === 20000, 'R2 la borne demandée est posée');
    m.passer(); await new Promise((r) => setTimeout(r, 5));
    dit(issue === R.NOM_DELAI, 'R3 borne passée ⇒ rejet « DelaiReseau » (pas su), jamais une réponse');
  }
  {
    const m = fausseMinuterie();
    const r = await R.fetchBorne(async () => ({ ok: true, status: 200 }), '/x', {}, 1000, m);
    dit(r && r.status === 200, 'R4 une réponse arrivée à temps est rendue telle quelle');
    m.passer();
    dit(true, 'R5 (la borne retirée ne fait rien après coup)');
  }
  {
    const m = fausseMinuterie(); const ctl = new AbortController();
    const p = R.fetchBorne(tenu, '/x', { signal: ctl.signal }, 1000, m);
    let nom = null; p.catch((e) => { nom = e && e.name; });
    ctl.abort(); await new Promise((r) => setTimeout(r, 5));
    dit(nom === 'AbortError', 'R6 le signal de l’appelant est respecté (ce n’est pas un délai)');
  }
  {
    const m = fausseMinuterie();
    let nom = null; await R.fetchBorne(async () => { throw new TypeError('Failed to fetch'); }, '/x', {}, 1000, m).catch((e) => { nom = e && e.name; });
    dit(nom === 'TypeError', 'R7 une coupure reste une coupure');
  }
  const pass = [0, 408, 425, 429, 500, 502, 503, 504, 522], def = [400, 401, 403, 404, 409];
  dit(pass.every(R.statutPassager), 'R8 0/408/425/429/5xx sont passagers');
  dit(!def.some(R.statutPassager), 'R9 400/401/403/404/409 ne le sont pas');
  for (const st of pass) dit(G.natureEchec('error', R.raisonStatut(st)) === 'passager', `R10 ${st} ⇒ le geste reste (natureEchec « passager »)`);
  for (const st of [400, 401, 403]) dit(G.natureEchec('error', R.raisonStatut(st)) === 'definitif', `R11 ${st} ⇒ refus (l’écran revient en arrière)`);
  dit(G.natureEchec('error', 'la base a répondu 429') === 'passager', 'R12 « répondu 429 » (phrase d’ailleurs) reste passager');
  dit(G.natureEchec('error', 'la base a répondu 400') === 'definitif', 'R13 « répondu 400 » reste un refus');
  dit(G.natureEchec('refus', '429') === 'definitif', 'R14 un refus déclaré reste un refus');

  // ── B : le branchement ───────────────────────────────────────────────────
  const A = sansCommentaires(app);
  const tranche = (debut, fin) => { const i = A.indexOf(debut); if (i < 0) return ''; const j = A.indexOf(fin, i + debut.length); return A.slice(i, j < 0 ? i + 20000 : j); };
  const push = tranche('const cloudPush = () => {', 'onCloudReady(() => { if (_pushPending)');
  dit(/fetchBorne\(fetch,\s*`\$\{SUPABASE_URL\}\/rest\/v1\/app_data\?id=eq\.\$\{SUPABASE_ROW\}[^`]*\$\{cond\}[^`]*`,\s*\{\s*method:\s*'PATCH'[\s\S]*?\},\s*DELAI_ECRITURE_MS\)/.test(push), 'B1 cloudPush : le PATCH conditionnel est borné');
  dit(/fetchBorne\(fetch,\s*`\$\{SUPABASE_URL\}\/rest\/v1\/app_data`,\s*\{\s*method:\s*'POST'[\s\S]*?\},\s*DELAI_ECRITURE_MS\)/.test(push), 'B2 cloudPush : l’insertion est bornée');
  dit(!/[^.\w]fetch\(`\$\{SUPABASE_URL\}/.test(push), 'B3 cloudPush : aucune requête nue');
  dit(/if \(st === 401 && !deja401\)[\s\S]{0,200}authRefresh\(\)[\s\S]{0,120}=== true[\s\S]{0,60}continue;/.test(push), 'B4 cloudPush : 401 ⇒ jeton renouvelé PUIS renvoyé (une fois)');
  dit(/_emitSync\('error',\s*raisonStatut\(st\)\)/.test(push), 'B5 cloudPush : la phrase d’échec vient de raisonStatut');
  dit(/finally\s*\{\s*_pushEnVol = false;/.test(push), 'B6 cloudPush : l’envoi en vol est TOUJOURS relâché');
  const lnc = tranche('const lireNuageComplet = async', '};');
  dit(/fetchBorne\(fetch,/.test(lnc) && !/[^.\w]fetch\(`/.test(lnc), 'B7 lireNuageComplet est bornée');
  const rel = tranche('const relireNuage = (opts', 'if (typeof window');
  dit(/fetchBorne\(fetch,\s*`[^`]*select=rev:data->>rev/.test(rel), 'B8 relireNuage : la lecture scalaire est bornée');
  const lr = tranche('const lireReglage = async', 'catch (_) { return rendre(null); }');
  dit(/fetchBorne\(fetch,/.test(lr) && !/[^.\w]fetch\(`/.test(lr), 'B9 lireReglage est bornée');
  const er = tranche('const ecrireReglage = async', '};');
  dit(/fetchBorne\(fetch,/.test(er) && !/[^.\w]fetch\(`/.test(er), 'B10 ecrireReglage est bornée');
  const ea = tranche('function EnAttenteEnvoi()', 'function LigneHorsLigne');
  dit(/data-envoi-fait/.test(ea) && /dit\.current && !n && _syncInfo\.etat === 'synced'/.test(ea), 'B11 « Enregistré » seulement file vide ET sauvegarde réussie, après avoir dit « en attente »');
  const FP = sansCommentaires(fpro), FA = sansCommentaires(fautres);
  dit(/fetchBorne\(fetch,\s*'\/api\/compte\?mode=facture-pro'[\s\S]*?DELAI_ROUTE_MS\)/.test(FP), 'B12 la route facture-pro est bornée');
  dit(/fetchBorne\(fetch,\s*'\/api\/compte\?mode=facture-autre'[\s\S]*?DELAI_ROUTE_MS\)/.test(FA), 'B13 la route facture-autre est bornée');
  dit(/poserAttenteFp\(att\)/.test(FP) && /addEventListener\('online'/.test(FP) && /\[5000, 15000, 60000\]\[rp\.n\] \|\| 120000/.test(FP), 'B14 « Ma facture » : champs gardés sur l’appareil, renvoyés seuls (relances + retour du réseau)');
  dit(/JSON\.stringify\(reste\[k\]\) === JSON\.stringify\(att\[k\]\)/.test(FP), 'B15 « Ma facture » : un champ retapé pendant l’envoi reste en attente');
  return { ok, ko };
}

const FICHIERS = () => ({
  borne: path.join(RACINE, 'src/reseauBorne.js'), geste: path.join(RACINE, 'src/gesteAnnulable.js'),
  app: sourceApp(RACINE), fpro: fs.readFileSync(path.join(RACINE, 'src/FacturePro.jsx'), 'utf8'), fautres: fs.readFileSync(path.join(RACINE, 'src/FactureAutres.jsx'), 'utf8'),
});
const MUTATIONS = [
  ['borne jamais posée', (f) => ({ borne: ['src/reseauBorne.js', (t) => t.replace("const t = minuterie.poser(() => { parDelai = true; try { ctl.abort(); } catch (_) {} }, ms);", 'const t = 0;')] })],
  ['429 redevient « répondu 429 » et la règle de natureEchec est retirée', () => ({ borne: ['src/reseauBorne.js', (t) => t.replace("if (n === 429) return 'la base est saturée (429) — nouvel essai automatique';", '')], geste: ['src/gesteAnnulable.js', (t) => t.replace("if (/\\b(408|425|429)\\b/.test(t) && !/refus/i.test(t)) return 'passager';", '')] })],
  ['natureEchec seule : 429 refus', () => ({ geste: ['src/gesteAnnulable.js', (t) => t.replace("if (/\\b(408|425|429)\\b/.test(t) && !/refus/i.test(t)) return 'passager';", '')] })],
  ['PATCH de cloudPush nu', () => ({ app: (t) => t.replace('const r = await fetchBorne(fetch, `${SUPABASE_URL}/rest/v1/app_data?id=eq.${SUPABASE_ROW}&owner=eq.${encodeURIComponent(owner)}&${cond}&select=id`', 'const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${SUPABASE_ROW}&owner=eq.${encodeURIComponent(owner)}&${cond}&select=id`') })],
  ['401 sans renvoi', () => ({ app: (t) => t.replace('if (rafr === true && AUTH.user?.id === owner) continue;', '') })],
  ['lecture du nuage nue', () => ({ app: (t) => t.replace("const res = await fetchBorne(fetch, `${SUPABASE_URL}/rest/v1/app_data?id=eq.${SUPABASE_ROW}&owner=eq.${encodeURIComponent(owner)}&select=owner,data,updated_at`, { headers: sbAuth(), cache: 'no-store' }, DELAI_LECTURE_MS);", "const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${SUPABASE_ROW}&owner=eq.${encodeURIComponent(owner)}&select=owner,data,updated_at`, { headers: sbAuth(), cache: 'no-store' });") })],
  ['« Enregistré » sans attendre la sauvegarde', () => ({ app: (t) => t.replace("if (dit.current && !n && _syncInfo.etat === 'synced')", 'if (dit.current && !n)') })],
  ['Ma facture : plus de relance', () => ({ fpro: (t) => t.replace('const d = [5000, 15000, 60000][rp.n] || 120000;', 'const d = 0; return;') })],
];

async function principal() {
  const prouver = process.argv.includes('--prouve');
  const f = FICHIERS();
  const r = await juger(f);
  for (const m of r.ok) console.log('OK  ' + m);
  for (const m of r.ko) console.log('KO  ' + m);
  console.log(`\n${r.ok.length} OK, ${r.ko.length} KO`);
  if (!prouver) process.exit(r.ko.length ? 1 : 0);
  if (r.ko.length) process.exit(1);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-audit-reseau-'));
  let rouges = 0;
  for (const [nom, fab] of MUTATIONS) {
    const mu = fab(f);
    const g = { ...f };
    for (const cle of ['borne', 'geste']) if (mu[cle]) { const [rel, tr] = mu[cle]; const src = fs.readFileSync(path.join(RACINE, rel), 'utf8'); const out = tr(src); if (out === src) { console.log(`MUTATION INOPÉRANTE (${nom}) : ${rel}`); process.exit(2); } const p = path.join(tmp, path.basename(rel).replace('.js', `-${Math.random().toString(36).slice(2)}.mjs`)); fs.writeFileSync(p, out); g[cle] = p; }
    for (const cle of ['app', 'fpro', 'fautres']) if (mu[cle]) { const out = mu[cle](f[cle]); if (out === f[cle]) { console.log(`MUTATION INOPÉRANTE (${nom}) : ${cle}`); process.exit(2); } g[cle] = out; }
    const rr = await juger(g);
    console.log(`${rr.ko.length ? 'ROUGE' : 'VERT ⚠'}  ${nom}${rr.ko.length ? ' — ' + rr.ko[0] : ''}`);
    if (rr.ko.length) rouges++;
  }
  console.log(`\nmutations rouges : ${rouges}/${MUTATIONS.length}`);
  process.exit(rouges === MUTATIONS.length ? 0 : 1);
}
principal().catch((e) => { console.error(e); process.exit(2); });
