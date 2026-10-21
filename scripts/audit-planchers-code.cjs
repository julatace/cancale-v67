// AUDIT : UNE EXTENSION PUBLIÉE SANS `code` N'EST JAMAIS DITE « PÉRIMÉE »
//   node scripts/audit-planchers-code.cjs
//
// 11 octobre. L'état de l'extension porte `code` (la version du CODE qui
// répond) depuis le chantier « session adressée ». L'app en déduit un code
// PÉRIMÉ (`codePerime`) : une version annoncée ≥ `CODE_DANS_ETAT` SANS `code`
// ⇒ « ton Chrome exécute encore l'ancien code, clique ⟳ ». La même frontière
// sert à `EXT_CAPACITES.liaison` (l'app lui ADRESSE sa session) et au pont /
// au logo (`jugeable` : ils jugent leur service worker).
//
// ⚠️⚠️ LE PIÈGE EST UNE COLLISION DE NUMÉROS. Deux chantiers montent l'extension
//    en parallèle ; `main` en a publié une (5.168, puis 5.170) SANS ce code.
//    Si la frontière est au niveau ou en dessous d'une version publiée sans
//    `code`, cette extension — légitime, à jour pour ce qu'elle est — est
//    déclarée « périmée » : la pastille dit « Lecture seule », aucune commande
//    ne part, la session ne lui est plus tendue, et le geste dit (⟳) est FAUX
//    (⟳ recharge la même version, qui n'aura toujours pas `code`). Et l'app lui
//    adresserait sa session sur un canal qu'elle n'ouvre pas.
//    Reproduit sur 7187f88 : frontière 5.169, production 5.170 ⇒ « sans-code ».
//
// La règle : chaque frontière est STRICTEMENT au-dessus de toute version
// publiée qui ne porte pas le champ. On le juge sur ce que la fonction REND
// (`codePerime`, `extSait('liaison')`, exécutées dans un vm), pas sur une
// formule : l'orthographe peut changer, la règle non.
//
// Les versions publiées sans `code` :
//   · MESURÉES le 11 octobre (git, `main`) : 5.168.0 (PR #472) et 5.170.0
//     (PR #473) — leur état n'a pas `code`, leur fond n'a pas `demanderLiaison` ;
//   · et ce que dit `origin/main` AUJOURD'HUI, s'il est lisible : sa version, et
//     si son fond porte `code:` dans l'état et `demanderLiaison`. Une référence
//     locale peut être en retard (`git fetch` d'abord) : l'audit dit ce qu'il a lu.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const APP = require('./_source-app.cjs')(path.join(RACINE, 'src/App.jsx'));
const EXT = (f) => fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', f), 'utf8');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { return f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message).slice(0, 160)); return undefined; } };

const cmp = (a, b) => {
  const A = String(a || '').split('.').map((n) => parseInt(n, 10) || 0), B = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
};

// ── Les versions publiées sans le champ ─────────────────────────────────────
const SANS_CODE = new Set(['5.168.0', '5.170.0']);
const SANS_LIAISON = new Set(['5.168.0', '5.170.0']);
// ⚠️ Retire les commentaires SANS avaler le code. Un strip naïf
// `replace(/\/\*[\s\S]*?\*\//g, '')` prenait le `/*` d'une CHAÎNE
// (`APP_URL_VRM + '/*'`, un motif d'URL) pour un début de commentaire et
// mangeait 62 775 caractères — dont `demanderLiaison` : l'audit criait alors
// au loup (« liaison : non » sur une 5.175 qui la porte). On scanne caractère
// par caractère en respectant les chaînes `'` `"` et les gabarits `` ` ``.
const sansCommentaires = (src) => {
  let out = '', i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; out += c; i++;
      while (i < n) { const e = src[i]; out += e; i++; if (e === '\\') { if (i < n) { out += src[i]; i++; } continue; } if (e === q) break; }
      continue;
    }
    out += c; i++;
  }
  return out;
};
const git = (args) => { try { return cp.execFileSync('git', ['-C', RACINE, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64e6 }); } catch (_) { return null; } };
const refMain = git(['rev-parse', '--short', 'origin/main']);
const manifMain = git(['show', 'origin/main:vinted-sync-extension/manifest.json']);
const fondMain = git(['show', 'origin/main:vinted-sync-extension/background.js']);
if (refMain && manifMain && fondMain) {
  const vMain = (JSON.parse(manifMain).version || '').trim();
  const fondNet = sansCommentaires(fondMain);
  const portePas = (re) => !re.test(fondNet);
  if (portePas(/\bcode:\s*CODE_VERSION\b/)) SANS_CODE.add(vMain);
  if (portePas(/function\s+demanderLiaison\b/)) SANS_LIAISON.add(vMain);
  console.log(`· origin/main (${refMain.trim()}) : ${vMain} — état avec \`code\` : ${SANS_CODE.has(vMain) ? 'non' : 'oui'} · liaison : ${SANS_LIAISON.has(vMain) ? 'non' : 'oui'}`);
} else {
  console.log('· origin/main illisible ici (copie sans .git ?) : seules les versions mesurées le 11 octobre comptent');
}
const maxDe = (s) => [...s].sort(cmp).pop();
console.log(`· publiées sans \`code\` : ${[...SANS_CODE].sort(cmp).join(', ')} · sans liaison : ${[...SANS_LIAISON].sort(cmp).join(', ')}`);

// ── Ce que l'app déclare ────────────────────────────────────────────────────
const lit = (re, src, nom) => { const m = re.exec(src); dit(!!m, `${nom} est lisible`); return m ? m[1] : null; };
const CODE_DANS_ETAT = lit(/const CODE_DANS_ETAT\s*=\s*'([\d.]+)'/, APP, "CODE_DANS_ETAT (App.jsx)");
const capsSrc = (/const EXT_CAPACITES\s*=\s*(\{[^}]*\})/.exec(APP) || [])[1];
const CAPS = capsSrc ? essaie('EXT_CAPACITES se lit', () => vm.runInNewContext('(' + capsSrc + ')')) : null;
const LIAISON = CAPS && CAPS.liaison;
dit(!!LIAISON, 'EXT_CAPACITES.liaison est déclarée', String(LIAISON));
const PONT = lit(/const jugeable\s*=[^;]*auMoins\(version,\s*'([\d.]+)'\)/, EXT('bridge.js'), 'la frontière du pont (bridge.js)');
const BADGE = lit(/const jugeable\s*=[^;]*auMoins\(versionManif,\s*'([\d.]+)'\)/, EXT('vrm-badge.js'), 'la frontière du logo (vrm-badge.js)');
const MANIF = JSON.parse(EXT('manifest.json')).version;

// 1) Les frontières, strictement au-dessus de toute version publiée sans le champ.
for (const [nom, v, s] of [['CODE_DANS_ETAT', CODE_DANS_ETAT, SANS_CODE], ['EXT_CAPACITES.liaison', LIAISON, SANS_LIAISON], ['le pont (jugeable)', PONT, SANS_CODE], ['le logo (jugeable)', BADGE, SANS_CODE]]) {
  if (!v) continue;
  const genants = [...s].filter((p) => cmp(p, v) >= 0);
  dit(genants.length === 0, `${nom} = ${v} est AU-DESSUS de toute version publiée sans le champ`, genants.length ? `publiées sans le champ et ≥ ${v} : ${genants.join(', ')} — elles seraient dites « périmées » (ou recevraient une session qu'elles ne savent pas lire)` : `max publiée sans : ${maxDe(s)}`);
  dit(cmp(v, MANIF) <= 0, `${nom} = ${v} est atteignable (≤ manifeste ${MANIF})`, cmp(v, MANIF) > 0 ? 'aucune version livrée ne porterait le champ : le détecteur ne jugerait jamais' : '');
}
// 2) Une notion, une frontière (§11) : le pont et le logo jugent la même chose que l'app.
if (CODE_DANS_ETAT && PONT && BADGE) dit(PONT === CODE_DANS_ETAT && BADGE === CODE_DANS_ETAT, 'le pont, le logo et l’app ont la MÊME frontière', `app ${CODE_DANS_ETAT} · pont ${PONT} · logo ${BADGE}`);
// Et la frontière de la liaison est celle du code : les deux champs arrivent ensemble.
if (CODE_DANS_ETAT && LIAISON) dit(LIAISON === CODE_DANS_ETAT, 'la liaison et `code` ont la même frontière (ils arrivent dans la même version)', `liaison ${LIAISON} · code ${CODE_DANS_ETAT}`);

// 3) Ce que l'app REND — `codePerime` et `extSait('liaison')`, exécutées.
const fonction = (nom) => {
  const i = APP.search(new RegExp('\\nfunction ' + nom + '\\s*\\('));
  if (i < 0) return null;
  const debut = APP.indexOf('{', i);
  let n = 0, j = debut;
  for (; j < APP.length; j++) { const c = APP[j]; if (c === '{') n++; else if (c === '}') { n--; if (!n) break; } }
  return APP.slice(i + 1, j + 1);
};
const fleche = (nom) => { const m = new RegExp('const ' + nom + '\\s*=\\s*\\(([^)]*)\\)\\s*=>\\s*\\{[\\s\\S]*?\\n\\};').exec(APP); return m ? m[0] : null; };
const srcCode = fonction('codePerime'), srcCmp = fleche('cmpVersion'), srcSait = fleche('extSait');
dit(!!(srcCode && srcCmp && srcSait), 'codePerime, cmpVersion et extSait sont extraites d’App.jsx');
const monte = (etat, version) => {
  const ctx = { __vmrEtat: etat, __vmrPerimePont: null, Date, String, Number, Object, JSON };
  vm.createContext(ctx);
  vm.runInContext(`${srcCmp}\nconst CODE_DANS_ETAT = ${JSON.stringify(CODE_DANS_ETAT)};\nconst EXT_CAPACITES = ${capsSrc};\nconst EXT_ATTENDUE = ${JSON.stringify(MANIF)};\nconst vmrExtPresent = () => true;\nconst vmrExtVersion = () => ${JSON.stringify(version)};\n${srcCode}\n${srcSait}\nthis.codePerime = codePerime; this.extSait = extSait;`, ctx);
  return ctx;
};
if (srcCode && srcCmp && srcSait && CODE_DANS_ETAT && capsSrc) {
  for (const v of [...SANS_CODE].sort(cmp)) {
    const r = essaie(`codePerime sur une ${v} réelle`, () => monte({ ok: true, version: v, vrm: { ok: true, connecte: true } }, v).codePerime());
    dit(r === null, `une ${v} publiée (état SANS \`code\`) n’est PAS dite « périmée »`, JSON.stringify(r));
  }
  for (const v of [...SANS_LIAISON].sort(cmp)) {
    const r = essaie(`extSait('liaison') sur une ${v}`, () => monte({ ok: true, version: v }, v).extSait('liaison'));
    dit(r === 'retard', `une ${v} publiée ne reçoit pas de session adressée (extSait('liaison') = retard)`, String(r));
  }
  // L'AUTRE SENS : le détecteur existe toujours. Sans lui, « rien n'est périmé »
  // passerait tous les contrôles ci-dessus.
  const a = essaie('codePerime au plancher', () => monte({ ok: true, version: CODE_DANS_ETAT }, CODE_DANS_ETAT).codePerime());
  dit(a && a.raison === 'sans-code', `autre sens : une ${CODE_DANS_ETAT} SANS \`code\` est bien dite périmée (son code ne suit pas son manifeste)`, JSON.stringify(a));
  const b = essaie('codePerime autre code', () => monte({ ok: true, version: MANIF, code: '5.129.0' }, MANIF).codePerime());
  dit(b && b.raison === 'autre-code', `autre sens : manifeste ${MANIF}, code 5.129.0 ⇒ périmé`, JSON.stringify(b));
  const c = essaie('codePerime bon code', () => monte({ ok: true, version: MANIF, code: MANIF }, MANIF).codePerime());
  dit(c === null, `autre sens : manifeste ${MANIF} et code ${MANIF} ⇒ rien`, JSON.stringify(c));
  const d = essaie('extSait liaison à jour', () => monte({ ok: true, version: MANIF }, MANIF).extSait('liaison'));
  dit(d === 'ok', `autre sens : une ${MANIF} reçoit la session adressée`, String(d));
}

console.log(ko ? `\n❌ planchers du code : ${ko} rouge(s)` : '\n✅ planchers du code : aucune version publiée sans `code` n’est dite périmée');
process.exit(ko ? 1 : 0);
