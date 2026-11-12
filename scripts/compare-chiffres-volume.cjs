// Compare deux relevés de scripts/bancs/chiffres-volume.cjs, au centime (12 nov., lot vitesse-volume).
// node scripts/compare-chiffres-volume.cjs avant.json apres.json  ⇒ code 0 si tout est identique.
const fs = require('fs');
const [A, B] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
// Un attribut qui porte une HEURE (ms depuis 1970 : « vérifié à … ») n'est pas un chiffre de l'écran.
for (const R of [A, B]) for (const e of Object.values(R.ecrans)) e.attrs = (e.attrs || []).map((x) => { const v = Number(x.split('=')[1]); return v > 1.6e12 && v < 2.2e12 ? x.split('=')[0] + '=·ms·' : x; });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const diff = (a, b) => { const la = JSON.stringify(a), lb = JSON.stringify(b); if (la === lb) return ''; let i = 0; while (i < la.length && la[i] === lb[i]) i++; return `avant « …${la.slice(Math.max(0, i - 60), i + 80)} » · après « …${lb.slice(Math.max(0, i - 60), i + 80)} »`; };
dit(A.ventes === B.ventes, 'même base', `${A.ventes} / ${B.ventes}`);
for (const tab of new Set([...Object.keys(A.ecrans), ...Object.keys(B.ecrans)])) {
  const a = A.ecrans[tab] || {}, b = B.ecrans[tab] || {};
  for (const k of ['montants', 'comptes', 'attrs']) { const d = diff(a[k], b[k]); dit(!d, `${tab} · ${k} identiques (${(a[k] || []).length})`, d); }
}
for (const k of new Set([...Object.keys(A.publie), ...Object.keys(B.publie)])) { const d = diff(A.publie[k], B.publie[k]); dit(!d, `publié ${k} identique`, d); }
dit(!(B.erreurs || []).length, 'aucune erreur', (B.erreurs || []).join(' | '));
console.log(ko ? `\n❌ ${ko} différence(s), ${ok} identique(s)` : `\n✅ aucun chiffre ne change : ${ok} relevés identiques`);
process.exit(ko ? 1 : 0);
