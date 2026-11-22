// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA COPIE LOCALE D'UN QR NE LIT QUE CE QUE LA PAGE A LE DROIT DE LIRE
//         node scripts/audit-qr-csp.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (17 nov., fiabilité-vitesse) Journal des plantages de la production (lecture seule,
// 16 nov.) : « CSP connect-src ← https://p.vintedgo.com » et « … ← https://avisageng-colis-
// webexternal.pickup-services.com » sur Achats. `garderQrLocal` (src/App.jsx) copiait le QR
// d'un colis par `fetch` vers l'hôte du transporteur : la politique de la page (vercel.json,
// connect-src) le refuse à CHAQUE affichage, rien n'est jamais gardé, et le refus remplit le
// journal. Ces QR-là, le service worker les range (`/hl-qr`). Cet audit EXÉCUTE la garde
// (`qrLisibleParLaPage`, recopiée telle quelle du source) :
//   1. un hôte de transporteur (absent de connect-src) ⇒ aucune lecture ;
//   2. la même origine et la base ⇒ lues ;
//   3. `garderQrLocal` passe par la garde AVANT tout `fetch` ;
//   4. chaque origine jugée lisible est bien permise par connect-src (vercel.json).
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (r) => fs.readFileSync(path.join(R, r), 'utf8');

function juger(app, vercel, dire) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (dire) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  const m = /const qrLisibleParLaPage = (\(u\) => \{[^\n]*\});/.exec(app);
  const g = /const garderQrLocal = async \(u\) => \{\n([^\n]*)\n/.exec(app);
  dit(!!m, 'la garde `qrLisibleParLaPage` existe dans src/App.jsx');
  dit(!!g && /qrLisibleParLaPage\(u\)/.test(g[1]) && /return;/.test(g[1]), '3. `garderQrLocal` passe par la garde avant tout fetch', g ? g[1].trim().slice(0, 140) : 'introuvable');
  if (!m) return ko + 1;
  const SUPABASE_URL = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  // eslint-disable-next-line no-new-func
  const f = new Function('window', 'SUPABASE_URL', 'return ' + m[1])({ location: { href: 'https://vrm.center/?tab=achats', origin: 'https://vrm.center' } }, SUPABASE_URL);
  const refuses = ['https://p.vintedgo.com/qr/abc.png', 'https://avisageng-colis-webexternal.pickup-services.com/q?x=1', 'https://www.chronopost.fr/x.png', 'http://p.vintedgo.com/a.png'];
  const permis = ['/hl-qr?u=x', 'https://vrm.center/api/relais?qr=1', SUPABASE_URL + '/storage/v1/object/qr.png'];
  const r1 = refuses.filter((u) => f(u));
  dit(!r1.length, '1. un QR chez un transporteur (hors connect-src) n\'est jamais lu par la page', r1.join(', ') || `${refuses.length} refusés`);
  const r2 = permis.filter((u) => !f(u));
  dit(!r2.length, '2. la même origine et la base restent lues', r2.join(', ') || `${permis.length} permis`);
  let csp = '';
  try { const v = JSON.parse(vercel); for (const h of v.headers || []) for (const x of h.headers || []) if (x.key === 'Content-Security-Policy' && /connect-src/.test(x.value)) csp = x.value; } catch (_) {}
  const cs = (/connect-src([^;]*)/.exec(csp) || [])[1] || '';
  dit(/'self'/.test(cs) && cs.includes(SUPABASE_URL), '4. connect-src (vercel.json) permet bien la même origine et la base', cs.trim().slice(0, 120));
  return ko;
}

if (process.argv.includes('--prouve')) {
  const app = lire('src/App.jsx'), vercel = lire('vercel.json');
  const MUTS = [
    ['garde retirée de garderQrLocal', app.replace(' || !qrLisibleParLaPage(u)) return;', ') return;')],
    ['garde qui laisse tout passer', app.replace(/const qrLisibleParLaPage = \(u\) => \{[^\n]*\};/, 'const qrLisibleParLaPage = (u) => { return true; };')],
    ['garde qui refuse la base', app.replace('|| o === new URL(SUPABASE_URL).origin', '')],
  ];
  let rouges = 0;
  for (const [nom, t] of MUTS) { const ko = juger(t, vercel, false); console.log((ko ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » ⇒ ${ko ? 'rouge' : 'VERT'}`); if (ko) rouges++; }
  console.log(rouges === MUTS.length ? `\n✅ audit-qr-csp --prouve : ${rouges}/${MUTS.length} mutations rouges` : `\n❌ audit-qr-csp --prouve : ${MUTS.length - rouges} verte(s)`);
  process.exit(rouges === MUTS.length ? 0 : 1);
}
const ko = juger(lire('src/App.jsx'), lire('vercel.json'), true);
console.log(ko ? `\n❌ audit-qr-csp : ${ko} rouge(s)` : '\n✅ audit-qr-csp : la page ne demande plus un QR que sa politique refuse');
process.exit(ko ? 1 : 0);
