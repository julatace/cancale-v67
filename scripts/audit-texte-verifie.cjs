// ════════════════════════════════════════════════════════════════════════════
//  « vérifié à 14:32 » SANS UN FORMATEUR NEUF PAR APPEL (20 nov., bugs-terrain)
//
//  Mesuré au profil (app rendue, base inventée au VOLUME de la sienne : 12 comptes, ~2 600 ventes,
//  ~2 700 achats, processeur ×4) : `texteVerifie` (src/sourcesRetrait.js), appelée par chaque ligne de
//  retrait à chaque rendu d'Achats, prenait 7 s sur 25 s — `toLocale…String(…, { timeZone })` construit un
//  `Intl.DateTimeFormat` neuf à chaque appel. Pendant ce temps, la liste « À retirer » restait vide et la
//  barre de chargement figée (captures iPhone de Julien, 20 nov.).
//    A. mêmes textes que l'écriture d'avant (5 000 instants, aujourd'hui / hier / avant, « par … ») ;
//    B. au moins 10× plus rapide que l'écriture d'avant (rapport, pas un temps absolu : la machine varie) ;
//    C. la règle n'appelle plus `toLocale…String` (code lu sans commentaires).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const ancien = (ms, maintenant = Date.now(), par = null) => {
  if (!Number.isFinite(ms)) return '';
  const PAR = { email: 'par e-mail', sms: 'par SMS', vinted: 'par Vinted', message: 'par message Vinted', transporteur: 'par le transporteur', mondialrelay: 'par Mondial Relay', chronopost: 'par Chronopost', vinted_go: 'par Vinted Go', colissimo: 'par Colissimo' };
  if (par && PAR[par]) return ancien(ms, maintenant).replace(/^vérifié/, `vérifié ${PAR[par]}`);
  const d = new Date(ms), n = new Date(maintenant);
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  const jour = (x) => x.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  if (jour(d) === jour(n)) return `vérifié à ${hm}`;
  if (jour(d) === jour(new Date(maintenant - 86400000))) return `vérifié hier ${hm}`;
  return `vérifié le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}`;
};
(async () => {
  const racine = process.env.RACINE || path.join(__dirname, '..');
  const { texteVerifie } = await import(path.join(racine, 'src', 'sourcesRetrait.js'));
  const now = Date.UTC(2026, 10, 20, 22, 30);   // 23 h 30 à Paris : la frontière du jour compte
  let diff = 0, ex = null;
  const pars = [null, 'email', 'chronopost', 'inconnu'];
  for (let i = 0; i < 5000; i++) { const ms = now - i * 1337e3; const p = pars[i % 4]; const a = ancien(ms, now, p), b = texteVerifie(ms, now, p); if (a !== b) { diff++; ex = ex || { a, b }; } }
  dit(diff === 0 && texteVerifie(NaN) === '', 'A : mêmes textes que l’écriture d’avant (5 000 instants)', ex);
  const N = 6000;
  let t = process.hrtime.bigint(); for (let i = 0; i < N; i++) ancien(now - i * 1e5, now); const ta = Number(process.hrtime.bigint() - t) / 1e6;
  t = process.hrtime.bigint(); for (let i = 0; i < N; i++) texteVerifie(now - i * 1e5, now); const tb = Number(process.hrtime.bigint() - t) / 1e6;
  dit(tb * 10 <= ta, `B : au moins 10× plus rapide (${N} appels : avant ${Math.round(ta)} ms, maintenant ${Math.round(tb)} ms)`);
  const src = fs.readFileSync(path.join(racine, 'src', 'sourcesRetrait.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const corps = (src.match(/export function texteVerifie[\s\S]*?\n}\n/) || [''])[0];
  dit(!!corps && !/toLocale(Date|Time)?String/.test(corps), 'C : la règle n’appelle plus toLocale…String');
  console.log(`\n${ko ? '❌' : '✅'} audit-texte-verifie : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
