// Audit : UNE seule clé publique de notifications, et des en-têtes de cache qui
// ne figent que ce qui est immuable.
//
// Mesuré le 3 octobre : trois clés VAPID coexistaient (src/main.jsx, public/sw.js,
// src/App.jsx — seule la dernière correspondait au serveur). Un abonnement push
// est scellé à la clé qui l'a créé : à chaque ouverture, main.jsx renvoyait un
// abonnement périmé ou en créait un avec la mauvaise clé, et le service de push
// le refusait (403, VapidPkHashMismatch chez Apple) — « je ne reçois plus de
// notif », sans aucune erreur visible.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };

// La clé du serveur fait foi : c'est elle qui signe les envois.
const serveur = (lire('api/_lib/push.js').match(/VAPID_PUBLIC\s*=\s*'([A-Za-z0-9_-]{80,})'/) || [])[1];
serveur ? ok('la clé publique du serveur est lisible') : nok('la clé publique du serveur est lisible', 'api/_lib/push.js');

// Toute clé publique VAPID écrite ailleurs (forme : 87 caractères base64url
// commençant par « B », un point P-256 non compressé).
const fichiers = ['src/main.jsx', 'src/App.jsx', 'src/vapid.js', 'public/sw.js'];
const vues = [];
for (const f of fichiers) {
  const t = lire(f);
  for (const m of t.matchAll(/'(B[A-Za-z0-9_-]{86})'|"(B[A-Za-z0-9_-]{86})"/g)) vues.push({ f, cle: m[1] || m[2] });
}
const autres = vues.filter((v) => v.cle !== serveur);
autres.length === 0 && vues.length > 0
  ? ok(`une seule clé de notifications dans l'app (${vues.length} écriture(s), toutes égales à celle du serveur)`)
  : nok('une seule clé de notifications, celle du serveur', autres.map((v) => v.f + ' → ' + v.cle.slice(0, 10) + '…').join(' · ') || 'aucune clé trouvée');
// Le service worker DOIT en porter une (il se réabonne seul quand le jeton tourne).
vues.some((v) => v.f === 'public/sw.js')
  ? ok('le service worker se réabonne avec cette clé')
  : nok('le service worker porte la clé', 'absente de public/sw.js');

// L'ouverture de l'app remplace un abonnement créé avec une autre clé, au lieu
// de le renvoyer tel quel.
const main = lire('src/main.jsx');
/abonnementAJour\(sub\)/.test(main) && /sub\.unsubscribe\(/.test(main)
  ? ok('à l\'ouverture, un abonnement à l\'ancienne clé est remplacé, pas renvoyé')
  : nok('à l\'ouverture, un abonnement périmé est remplacé', 'main.jsx renvoie l\'abonnement existant sans regarder sa clé');

// ── En-têtes de cache ──────────────────────────────────────────────────────
// Les fichiers de /assets/ sont hashés : immuables. Rien d'autre ne doit l'être
// (la page, le service worker et le zip changent sans changer de nom).
let v = {};
try { v = JSON.parse(lire('vercel.json')); } catch (_) {}
const regles = Array.isArray(v.headers) ? v.headers : [];
const immuables = regles.filter((r) => (r.headers || []).some((h) => /cache-control/i.test(h.key) && /immutable|max-age=[1-9]\d{4,}/.test(h.value)));
immuables.some((r) => r.source === '/assets/(.*)')
  ? ok('les fichiers versionnés (/assets/) sont servis en cache long')
  : nok('les fichiers versionnés sont servis en cache long', 'vercel.json ne déclare rien : max-age=0 en production');
const fautifs = immuables.filter((r) => r.source !== '/assets/(.*)');
fautifs.length === 0
  ? ok('rien d\'autre n\'est figé (page, service worker, zip)')
  : nok('seul /assets/ est figé', fautifs.map((r) => r.source).join(', '));

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nUne clé, et seul ce qui ne change jamais est mis en cache long.');
process.exit(ko ? 1 : 0);
