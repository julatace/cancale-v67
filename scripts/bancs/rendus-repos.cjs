// ═════════════════════════════════════════════════════════════════════════════
//  BANC « RENDUS AU REPOS » (23 nov., bugs-totale §3.3). Aujourd'hui ouvert, rien touché : combien de validations React en
//  10 s, et QUI les déclenche (le composant dont l'ÉTAT a changé, mêmes props qu'avant) ? Plus les `vrm:save` de la fenêtre
//  (clé, « inchangé »). Une boucle de rendus au repos affame les transitions d'onglet (passation du 22 nov., §3.3).
//  Crochet des outils de développement de React posé avant l'app (comme fluidite-generale). Noms lisibles avec un build de
//  diagnostic (BANC_DIST=… construit sans minification) ; sinon la classe du premier élément du DOM dit où chercher.
//  Données inventées (base au volume). VUES=tel,ordi · REPOS_S=10 · ATTENTE_S=25 · MAX_VALIDATIONS (défaut 6) : au-delà, rouge.
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'rendus-repos');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'tel,ordi').split(',').map((x) => x.trim()).filter(Boolean);
const REPOS = Number(process.env.REPOS_S || 10) * 1000, ATTENTE = Number(process.env.ATTENTE_S || 25) * 1000;
const MAX = Number(process.env.MAX_VALIDATIONS || 6);
const ECRAN = process.env.ECRAN || 'journee';
const { dit, fin } = B.journal('rendus-repos');

async function crochet(pg) {
  await pg.addInitScript(() => {
    const V = window.__vrmValid = [];
    const S = window.__vrmSaves = [];
    window.addEventListener('vrm:save', (e) => { const d = (e && e.detail) || {}; S.push({ t: Math.round(performance.now()), k: String(d.k || d.key || '?'), i: d.inchange === true ? 1 : 0 }); if (S.length > 2000) S.splice(0, 1000); });
    const nom = (f) => { const t = f.elementType || f.type; if (!t) return String(f.tag); return t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || String(f.tag); };
    const classe = (f) => { for (let x = f, i = 0; x && i < 40; x = x.child, i++) if (x.tag === 5 && x.stateNode && x.stateNode.getAttribute) return (x.stateNode.getAttribute('class') || '').split(' ').slice(0, 2).join('.') + Object.keys(x.stateNode.dataset || {}).slice(0, 2).map((k) => '[data-' + k + ']').join(''); return ''; };
    // Le hook qui a changé : son rang dans la liste des hooks de la fibre (le n-ième useState/useMemo…).
    const hookChange = (f) => { let a = f.memoizedState, b = f.alternate && f.alternate.memoizedState, i = 0; while (a && b && i < 80) { if (a.memoizedState !== b.memoizedState) return i; a = a.next; b = b.next; i++; } return -1; };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: false, supportsFiber: true, renderers: new Map(), inject() { return 1; }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
      onCommitFiberRoot(id, root) { try {
        const qui = [], faits = {}; const pile = [root.current]; let n = 0;
        while (pile.length && n < 200000) { const f = pile.pop(); n++;
          if ((f.tag === 0 || f.tag === 1 || f.tag === 11 || f.tag === 15) && f.alternate && (f.flags & 1)) {
            const k = nom(f); faits[k] = (faits[k] || 0) + 1;
            if (f.memoizedProps === f.alternate.memoizedProps && f.memoizedState !== f.alternate.memoizedState && qui.length < 12) qui.push(k + '#' + hookChange(f) + '⟨' + classe(f) + '⟩');
          }
          if (f.sibling) pile.push(f.sibling); if (f.child) pile.push(f.child); }
        V.push({ t: Math.round(performance.now()), qui, nFaits: Object.values(faits).reduce((a, b) => a + b, 0), faits }); if (V.length > 3000) V.splice(0, 1500);
      } catch (_) {} } };
  });
}

async function main() {
  const { srv, ICI } = await B.serveur();
  const nav = await B.navigateur();
  const rapport = {};
  try {
    for (const vue of VUES) {
      const base = B.fabriquer({ volumeReel: true, annonces: 300 });
      const { ctx, pg, J } = await B.ouvrir(nav, vue, base);
      await crochet(pg);
      await B.demarrer(pg, ICI, ECRAN);
      await pg.locator('[data-toast-numeros] .n-toast-action').click({ timeout: 1500 }).catch(() => {});
      // VISITER=ventes,achats,… : les onglets visités d'abord (leurs écrans restent montés, gardés), puis retour sur ECRAN.
      for (const o of String(process.env.VISITER || '').split(',').map((x) => x.trim()).filter(Boolean)) await B.aller(pg, o, 4000);
      if (process.env.VISITER) await B.aller(pg, ECRAN, 3000);
      await pg.waitForTimeout(ATTENTE);
      // PONT_MS=1300 : un pont d'extension qui parle toutes les N ms (« ready », la réponse à chaque sonde) et SAVE_MS=1300 : une
      // écriture d'une clé sans rapport (`vrm:save`, ce qu'une capture fait plusieurs fois par minute) — l'activité réelle d'un
      // ordinateur où l'extension capte, que la base inventée n'a pas. Rien ne change dans l'état : un rendu de plus est de trop.
      if (Number(process.env.PONT_MS) > 0) await pg.evaluate((ms) => { setInterval(() => window.postMessage({ __vmr: 'ready', version: '5.436.0' }, '*'), ms); }, Number(process.env.PONT_MS));
      if (Number(process.env.SAVE_MS) > 0) await pg.evaluate((ms) => { setInterval(() => window.dispatchEvent(new CustomEvent('vrm:save', { detail: { k: 'harvest_banc_sans_rapport', inchange: true } })), ms); }, Number(process.env.SAVE_MS));
      if (Number(process.env.PONT_MS) > 0 || Number(process.env.SAVE_MS) > 0) await pg.waitForTimeout(4000);
      const t0 = await pg.evaluate(() => performance.now());
      await pg.waitForTimeout(REPOS);
      const r = await pg.evaluate((t0) => ({ V: window.__vrmValid.filter((x) => x.t >= t0), S: window.__vrmSaves.filter((x) => x.t >= t0) }), t0);
      const parQui = {}; for (const v of r.V) for (const q of v.qui) parQui[q] = (parQui[q] || 0) + 1;
      const faits = {}; for (const v of r.V) for (const [k, n] of Object.entries(v.faits)) faits[k] = (faits[k] || 0) + n;
      const saves = {}; for (const s of r.S) { const k = s.k + (s.i ? ' (inchangé)' : ''); saves[k] = (saves[k] || 0) + 1; }
      const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, x]) => x + '× ' + k).join(' | ');
      console.log(`  [${vue}] ${r.V.length} validations en ${REPOS / 1000} s · ${r.V.reduce((a, v) => a + v.nFaits, 0)} composants rendus`);
      console.log(`  [${vue}] déclencheurs (état changé) : ${top(parQui, 14)}`);
      console.log(`  [${vue}] rendus : ${top(faits, 14)}`);
      console.log(`  [${vue}] vrm:save : ${top(saves, 14)}`);
      console.log(`  [${vue}] instants : ${r.V.map((v) => Math.round(v.t - t0)).join(',')}`);
      rapport[vue] = { validations: r.V.length, composants: r.V.reduce((a, v) => a + v.nFaits, 0), parQui, saves, V: r.V.map((v) => ({ t: Math.round(v.t - t0), qui: v.qui })) };
      dit(vue, `au repos sur ${ECRAN} : ${MAX} validations React au plus en ${REPOS / 1000} s`, r.V.length <= MAX, `${r.V.length} validations · ${top(parQui, 4)}`);
      const err = [...new Set(J.erreurs)].filter((x) => !/Service Worker registration blocked|language detection/.test(x));
      dit(vue, 'aucune erreur', !err.length, err.slice(0, 3).join(' ¦ '));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  fs.writeFileSync(path.join(SORTIE, 'rendus-repos-detail.json'), JSON.stringify(rapport, null, 1));
  process.exit(fin(SORTIE) ? 1 : 0);
}
main();
