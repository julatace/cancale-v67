// ════════════════════════════════════════════════════════════════════════════
//  LE BORDEREAU D'UNE VENTE, JAMAIS CELUI D'UNE AUTRE (revue du 5 octobre)
//
//  `harvest_{uid}_label_latest` est réécrite par l'extension à CHAQUE capture.
//  Deux défauts confirmés par la revue contradictoire :
//   1. `fetchCapturedLabel` lisait la transaction (`meta->>tx`) puis le PDF en
//      DEUX requêtes : entre les deux, l'extension range le bordereau de la
//      vente B — et l'app tamponnait le N° de A sur l'étiquette de B.
//   2. l'index des bordereaux captés retenait `label_latest` pour sa
//      transaction : un clic « Imprimer » plus tard relisait une ligne qui
//      portait déjà une AUTRE vente.
//  On EXÉCUTE les vraies fonctions d'App.jsx (extraites au parseur, §4.10)
//  contre une base qui change de version entre deux lectures.
//  Lancer : node scripts/audit-label-latest.cjs
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const { parse } = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser'));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 160)); } };

// Les déclarations de premier niveau, par nom (jamais par numéro de ligne).
const ast = parse(SRC, { sourceType: 'module', plugins: ['jsx'] });
const decl = {};
for (const n of ast.program.body) {
  if (n.type !== 'VariableDeclaration') continue;
  for (const d of n.declarations) if (d.id && d.id.name) decl[d.id.name] = SRC.slice(n.start, n.end);
}
const prendre = (noms) => noms.map((n) => decl[n] || `/* ${n} absente */`).join('\n');

// Deux versions de la ligne : A puis B (l'extension a capté entre les deux lectures).
const PDF = (lettre) => Buffer.from('%PDF-1.4 bordereau ' + lettre).toString('base64');
const VERSIONS = [{ tx: 'A', capturedAt: '2026-10-05T07:00:00Z', b: PDF('A') }, { tx: 'B', capturedAt: '2026-10-05T07:00:05Z', b: PDF('B') }];

function contexte() {
  let lectures = 0;
  const ctx = {
    console, URL, TextDecoder, TextEncoder,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    SUPABASE_URL: 'https://base.test', sbAuth: () => ({}),
    fetch: async (url) => {
      const u = decodeURIComponent(String(url));
      if (!/label_latest/.test(u)) return { ok: true, json: async () => [] };
      const v = VERSIONS[Math.min(lectures, VERSIONS.length - 1)]; lectures++;
      // La projection demandée est appliquée (§6.3) : seuls les alias présents.
      const sel = (/select=([^&]*)/.exec(u) || [])[1] || '';
      const o = {};
      for (const champ of sel.split(',')) {
        const [alias, src] = champ.includes(':') ? champ.split(':') : [champ, champ];
        if (/pdfB64/.test(src)) o[alias] = v.b;
        else if (/->>tx$/.test(src)) o[alias] = v.tx;
        else if (/->>capturedAt$/.test(src)) o[alias] = v.capturedAt;
      }
      return { ok: true, json: async () => [o] };
    },
  };
  vm.createContext(ctx);
  // Un `const` exécuté dans un vm reste LEXICAL : on le remonte explicitement.
  const noms = ['b64ToBytes', 'estOctetsPdf', 'lirePdfLigne', 'fetchLabelFrais', 'fetchCapturedLabel', 'labelsParTransaction'];
  vm.runInContext(prendre(noms) + `\n;globalThis.__f = { ${noms.map((n) => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ')} };`, ctx);
  return ctx.__f;
}

(async () => {
  console.log('── 1. le « dernier capté » : transaction et PDF de la MÊME version');
  await essaie('fetchCapturedLabel', async () => {
    const ctx = contexte();
    const r = await ctx.fetchCapturedLabel('9');
    dit(!!(r && r.octets), 'un bordereau est rendu');
    const texte = r && r.octets ? Buffer.from(r.octets).toString('latin1') : '';
    const lettre = (/bordereau ([AB])/.exec(texte) || [])[1];
    dit(r && lettre === r.tx, 'le PDF rendu est celui de la transaction annoncée — jamais le N° de A sur l’étiquette de B',
      `tx annoncée ${r && r.tx} · PDF de ${lettre}`);
  });

  console.log('── 2. l’index des bordereaux captés ne pointe jamais sur label_latest');
  await essaie('labelsParTransaction', async () => {
    const ctx = contexte();
    if (typeof ctx.labelsParTransaction !== 'function') throw new Error('labelsParTransaction absente');
    const metas = [
      { id: 'harvest_9_label_111', tx: '111' },
      { id: 'harvest_9_label_latest', tx: '111' },     // copie : même transaction
      { id: 'harvest_9_label_222', tx: '222' },
      { id: 'harvest_9_label_latest_x' },              // sans transaction : ignorée
    ];
    const r = ctx.labelsParTransaction(metas).map((m) => m.id);
    dit(!r.some((id) => /_label_latest$/.test(id)), 'label_latest n’entre pas dans l’index', r.join(','));
    dit(r.includes('harvest_9_label_111') && r.includes('harvest_9_label_222'), 'chaque label_{tx} y est', r.join(','));
  });
  // Et l'écran se sert bien de cette règle (une seule règle, §11) — sinon la
  // fonction serait juste et l'index faux.
  const recharger = (() => { const i = SRC.indexOf('const rechargerLabels = React.useCallback('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf('}, [accounts]);', i)); })();
  dit(/labelsParTransaction\(/.test(recharger), 'rechargerLabels indexe par labelsParTransaction');

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : `\n✅ ${ok} contrôles — le bordereau imprimé est toujours celui de la vente.`);
  process.exit(ko ? 1 : 0);
})();
