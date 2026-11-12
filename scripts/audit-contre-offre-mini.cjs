// Audit : LA CONTRE-OFFRE EN UN TAP (3 nov., choisie par Julien).
//
// Sur une offre reçue TROP BASSE, la carte d'offre (Messages → conversation)
// montre « Proposer X € ». On juge :
//   A. la règle PURE (`contreOffreMini`, src/messagesVolets.js), EXÉCUTÉE :
//      X = son prix mini arrondi à l'euro supérieur ; jamais sous le mini ;
//      jamais au-dessus du prix affiché ; pas de mini (ou pas de prix affiché lu,
//      ou une offre déjà au mini) ⇒ rien (null) — jamais deviné ;
//   B. l'écran (src/App.jsx) : le montant vient de CETTE règle et du mini posé à
//      côté du N° (par l'item_id, §5), plus aucun « milieu » calculé ; le tap
//      appelle le chemin existant (`actionOffre('offre', off, X)` → `vmrExec`,
//      POST /transactions/{tx}/offers) ; aucun appel d'`actionOffre` hors d'un
//      `onClick` (rien d'automatique) ; extension absente ⇒ « à faire sur
//      Vinted » + le lien ;
//   C. l'extension (le VRAI background.js, fonctions extraites et exécutées) :
//      POST /offers n'est PAS une lecture ⇒ `gardeStricte` compte l'action
//      dans le plafond de 50/h par compte.
// `--prouve` : réaffaiblit la règle (X sous le mini, au-dessus du prix, mini
// inventé, sur une offre déjà au mini) — chaque mutation doit passer au rouge.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const RAC = path.join(__dirname, '..');
const SRC = path.join(RAC, 'src', 'messagesVolets.js');
const APP = path.join(RAC, 'src', 'App.jsx');
const BG = path.join(RAC, 'vinted-sync-extension', 'background.js');

const MUTATIONS = {
  x_sous_le_mini: (s) => s.replace('const x = Math.min(Math.ceil(Math.round(m * 100) / 100 - 1e-9), p);', 'const x = Math.min(Math.floor(m) - 1, p);').replace('if (c < m || c > p || !(c > o)) return null;', 'if (c > p || !(c > o)) return null;'),
  au_dessus_du_prix: (s) => s.replace('const x = Math.min(Math.ceil(Math.round(m * 100) / 100 - 1e-9), p);', 'const x = Math.ceil(m);').replace('if (c < m || c > p || !(c > o)) return null;', 'if (c < m || !(c > o)) return null;').replace('if (p < m) return null;', ''),
  mini_devine: (s) => s.replace('if (!Number.isFinite(m) || !(m > 0)) return null;', 'if (!Number.isFinite(m) || !(m > 0)) return Number.isFinite(p) && p > o ? Math.ceil((o + p) / 2) : null;'),
  offre_deja_au_mini: (s) => s.replace('if (o >= m) return null;', ''),
  sans_prix_affiche: (s) => s.replace('if (!Number.isFinite(p) || !(p > 0)) return null;', 'if (!Number.isFinite(p) || !(p > 0)) return Math.ceil(m);'),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `contreMini-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function regle(src, ok) {
  let M;
  try { M = await charger(src); } catch (e) { ok(false, 'le module se charge', e.message); return; }
  const f = M.contreOffreMini;
  ok(typeof f === 'function', 'contreOffreMini existe');
  if (typeof f !== 'function') return;
  // Le cas du banc : offre 100, mini 105, prix 120 ⇒ 105.
  ok(f(100, 120, 105) === 105, 'A1 offre 100 · mini 105 · prix 120 ⇒ Proposer 105 €', f(100, 120, 105));
  ok(f(40, 60, 44.2) === 45, 'A2 mini 44,20 ⇒ 45 (arrondi à l’euro supérieur)', f(40, 60, 44.2));
  ok(f(40, 60, '44,2'.replace(',', '.')) === 45, 'A2b mini saisi « 44,2 » ⇒ 45');
  ok(f(40, 44.5, 44.2) === 44.5, 'A3 le mini s’arrondit au-dessus du prix affiché ⇒ X = le prix affiché (44,50), jamais au-dessus', f(40, 44.5, 44.2));
  ok(f(40, 60, null) === null && f(40, 60, '') === null && f(40, 60, 0) === null && f(40, 60, undefined) === null, 'A4 pas de prix mini ⇒ pas de bouton (null)');
  ok(f(45, 60, 40) === null && f(40, 60, 40) === null && f(44.5, 60, 44.2) === null, 'A5 offre au mini ou au-dessus ⇒ pas de contre-offre (c’est Accepter)');
  ok(f(40, null, 44) === null && f(40, 0, 44) === null, 'A6 prix affiché pas lu ⇒ rien (jamais « au-dessus du prix » possible)');
  ok(f(40, 50, 55) === null, 'A7 un mini au-dessus du prix affiché ⇒ rien');
  ok(f(null, 60, 44) === null && f(0, 60, 44) === null, 'A8 offre illisible ⇒ rien');
  // Balayage : jamais sous le mini, jamais au-dessus du prix, toujours au-dessus de l'offre.
  let viol = [];
  for (let o = 1; o <= 120; o += 3) for (let p = 1; p <= 130; p += 4.5) for (let m = 0.5; m <= 125; m += 2.7) {
    const x = f(o, p, Math.round(m * 100) / 100);
    if (x == null) continue;
    const mm = Math.round(m * 100) / 100;
    if (x < mm || x > p || !(x > o) || (x !== p && x !== Math.ceil(mm - 1e-9))) viol.push([o, p, mm, x]);
  }
  ok(viol.length === 0, 'A9 balayage (offre × prix × mini) : X ≥ mini, X ≤ prix affiché, X > offre, X = mini arrondi (ou le prix affiché)', JSON.stringify(viol.slice(0, 4)));
}

function ecran(ok) {
  const app = fs.readFileSync(APP, 'utf8');
  const sans = app.replace(/\/\/[^\n]*/g, '');
  ok(!/contreOffreProposee/.test(sans), 'B1 plus aucun « milieu » calculé (contreOffreProposee retirée)');
  ok(/const contreMini = off && pc && \(pc\.devise\|\|'EUR'\)==='EUR' \? contreOffreMini\(off\.prix, pc\.prix, isFinite\(minF\)&&minF>0\?minF:null\) : null;/.test(sans), 'B2 X = contreOffreMini(offre, prix affiché lu par identité, SON mini posé à côté du N°)');
  ok(/const minF = itemF!=null \? Number\(String\(\(numeros\[String\(itemF\)\]\|\|\{\}\)\.min/.test(sans), 'B3 le mini est celui de la fiche de CETTE annonce (item_id de la transaction, §5)');
  ok(/data-offre-geste="proposer"[^>]*onClick=\{\(\)=>actionOffre\('offre', off, contre\)\}/.test(sans), 'B4 le tap « Proposer X € » envoie X par le chemin existant (actionOffre)');
  const appels = [...sans.matchAll(/actionOffre\(/g)].map((m) => sans.slice(Math.max(0, m.index - 40), m.index));
  const horsClic = appels.filter((ctx) => !/onClick=\{\(\)=>$/.test(ctx) && !/const $/.test(ctx));
  ok(appels.length >= 4 && horsClic.length === 0, 'B5 actionOffre n’est appelée QUE depuis un onClick (rien d’automatique)', JSON.stringify(horsClic));
  const corps = sans.slice(sans.indexOf('const actionOffre = async'), sans.indexOf('const autoriserNouvelleActionOffre'));
  ok(/const saisi = prixDirect != null \? String\(prixDirect\) : String\(prixOffre\);/.test(corps) && /endpoint = `\/api\/v2\/transactions\/\$\{tx\}\/offers`/.test(corps) && /await vmrExec\(/.test(corps), 'B6 actionOffre envoie le montant par l’extension (vmrExec, POST /offers)');
  ok(/data-offre-proposer-vinted=\{String\(contreMini\)\} href=\{lienVinted\}/.test(sans) && /à faire sur Vinted ↗/.test(sans), 'B7 extension absente ⇒ « Proposer X € · à faire sur Vinted » + lien');
}

function extension(ok) {
  const bg = fs.readFileSync(BG, 'utf8');
  const i = bg.indexOf('const EXEC_PERMIS'), j = bg.indexOf('async function gardeStricte');
  const k = bg.indexOf('\n}\n', j);
  ok(i > 0 && j > i, 'C0 EXEC_PERMIS et gardeStricte trouvés dans background.js');
  if (!(i > 0 && j > i)) return;
  let comptees = 0;
  const ctx = { ACTIONS_MAX_HEURE: 50, RAISON_STOCKAGE: '',
    pauseVinted: async () => null, compteConnecte: async () => '111', raisonPauseVinted: () => '',
    // (intégration 11nov-g2) la sécurité des comptes (5.366) passe AVANT le plafond : ici, rien ne l'arrête.
    secuRobotDit: async () => null, secuGeste: async () => null,
    compterAction: async () => { comptees += 1; return { ok: true }; } };
  vm.createContext(ctx);
  vm.runInContext(bg.slice(i, k + 3) + '\nthis.execPermis = execPermis; this.gardeStricte = gardeStricte;', ctx);
  const p = ctx.execPermis('POST', '/api/v2/transactions/9501/offers');
  ok(p && !p.lecture, 'C1 POST /transactions/{tx}/offers est permis et n’est PAS une lecture');
  return ctx.gardeStricte('111', { domain: 'www.vinted.fr' }, { lecture: !!(p && p.lecture) }).then((r) => {
    ok(r == null && comptees === 1, 'C2 gardeStricte COMPTE la contre-offre dans le plafond d’actions du compte', JSON.stringify({ r, comptees }));
  });
}

async function audit(src, bavard) {
  let ko = 0;
  const ok = (c, m, d) => { if (!c) ko++; if (bavard) console.log(`${c ? '✅' : '❌'} ${m}${!c && d != null ? ` — ${d}` : ''}`); };
  await regle(src, ok);
  if (bavard) { ecran(ok); await extension(ok); }
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [nom, f] of Object.entries(MUTATIONS)) {
      const m = f(src);
      if (m === src) { console.log(`❌ ${nom} : la mutation ne s'applique plus`); continue; }
      const k = await audit(m, false);
      console.log(`${k ? '✅' : '❌'} mutation ${nom} : ${k} rouge(s)`);
      if (k) rouges++;
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  const ko = await audit(src, true);
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ contre-offre en un tap : tout est vert');
  process.exit(ko ? 1 : 0);
})();
