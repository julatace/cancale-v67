// Contrôle (20 nov., bugs-terrain) : src/suivisSansQr.js relit ses lots `id=in.(…)` TROIS à la fois (jamais plus), mêmes
// lignes dans le même ordre ; un lot raté ⇒ `null` (pas su). Rouge sur l'écriture d'avant (lots en série : 1 à la fois).
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = process.env.RACINE || path.join(ici, '..', '..');
const { lireSuivisSansQr } = await import(path.join(racine, 'src', 'suivisSansQr.js'));
let ok = 0, ko = 0; const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const ids = Array.from({ length: 300 }, (_, i) => `email_track_mondialrelay_${10000000 + i}`);
const essai = async (rate = -1) => {
  let enCours = 0, max = 0, n = 0;
  const lire = async (q) => { const k = n++; enCours++; max = Math.max(max, enCours); await new Promise((r) => setTimeout(r, 15)); enCours--;
    if (k === rate) return null; const l = decodeURIComponent(q).match(/id=in\.\(([^)]*)\)/)[1].split(','); return l.map((id) => ({ id, data: { suivi: id.slice(-8), status: 'transit' } })); };
  const lireTout = async (q) => (/select=id,meta/.test(q) ? ids.map((id) => ({ id })) : []);
  const r = await lireSuivisSansQr({ lireTout, lire, besoinQr: () => false });
  return { r, max, n };
};
const a = await essai();
dit(Array.isArray(a.r) && a.r.length === ids.length && a.r.every((x, i) => x.id === ids[i]), 'mêmes lignes, même ordre (300 lignes sans meta relues entières)', a.r && a.r.length);
dit(a.max === 3, `trois lots à la fois, jamais plus (${a.n} lots, au plus ${a.max} en même temps)`);
const b = await essai(4);
dit(b.r === null, 'un lot raté ⇒ pas su (null)');
console.log(`\n${ko ? '❌' : '✅'} suivis-paralleles : ${ok} verts, ${ko} rouges`); process.exit(ko ? 1 : 0);
