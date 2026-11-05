// ════════════════════════════════════════════════════════════════════════════
// LE CONTRÔLE QUOTIDIEN DE LA PRODUCTION — node scripts/verifier-production.mjs
// ════════════════════════════════════════════════════════════════════════════
// Sonde PUBLIQUE, en lecture seule : aucune session, aucun secret, aucune donnée
// de vendeur. Lancée par .github/workflows/disponibilite.yml ; un échec fait
// échouer le job, et GitHub le signale par e-mail (l'onglet Actions dit lequel).
//
// Ce qui est vérifié, et ce qu'un échec veut dire :
//   · la page d'accueil répond et porte SON titre (celui d'index.html du dépôt)
//     et ses fichiers d'app (/assets/) ;
//   · /recuperation.html répond (la page de secours autonome) ;
//   · /api/sante répond `ok: true` avec TOUTES ses clés (celles que déclare
//     `sante()` dans api/compte.js), chacune un oui/non ; la clé de service
//     posée (sans elle, rappels et e-mails se taisent) ;
//   · /api/compte?mode=confidentialite refuse sans session (401) ;
//   · l'extension servie : /VRM-extension.zip est un vrai zip, d'UN seul
//     dossier (§2.6), dont le manifeste porte la version que l'app attend
//     (`EXT_ATTENDUE`, src/App.jsx) ; /VRM-Orion.xpi porte la version du paquet
//     Orion du dépôt ; la notice Orion répond ;
//   · le manifeste de l'app (/manifest.webmanifest) et ses icônes, et le
//     service worker (/sw.js, du JavaScript, pas la page de l'app).
// Ne vérifie PAS : la livraison des e-mails, les comptes privés, la charge.
// `VRM_ORIGINE=http://127.0.0.1:<port>` : jouer le contrôle contre une copie
// locale (audit-verifier-production.cjs) — jamais un secret.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGINE = (process.env.VRM_ORIGINE || 'https://vrm.center').replace(/\/+$/, '');
const LOCAL = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(ORIGINE);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-sonde-'));

// ── Ce que le dépôt attend (lu dans la copie du dépôt, jamais recopié ici) ──
const lireDepot = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel)); } catch (_) { return null; } };
const titreAttendu = (() => { const m = /<title>([^<]+)<\/title>/.exec(String(lireDepot('index.html') || '')); return m ? m[1].trim() : null; })();
const versionAttendue = (() => { const m = /const EXT_ATTENDUE\s*=\s*'([0-9.]+)'/.exec(String(lireDepot('src/App.jsx') || '')); return m ? m[1] : null; })();
const clesSante = (() => {
  const src = String(lireDepot('api/compte.js') || '');
  const i = src.indexOf('function sante(');
  if (i < 0) return null;
  const corps = src.slice(i, src.indexOf('\n}', i));
  const bloc = corps.slice(corps.indexOf('{', corps.indexOf('repondre(')));
  return [...bloc.matchAll(/\b([A-Za-z]+):/g)].map((m) => m[1]);
})();

// ── Lire un fichier zip (répertoire central), sans dépendance ────────────────
export function lireZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return null;
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) return null;
  const n = buf.readUInt16LE(fin + 10), debut = buf.readUInt32LE(fin + 16);
  const entrees = [];
  for (let k = 0, p = debut; k < n; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const methode = buf.readUInt16LE(p + 10), taille = buf.readUInt32LE(p + 20);
    const ln = buf.readUInt16LE(p + 28), lx = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    entrees.push({ nom: buf.slice(p + 46, p + 46 + ln).toString('utf8'), methode, taille, local });
    p += 46 + ln + lx + lc;
  }
  const lire = (e) => {
    const p = e.local;
    if (buf.readUInt32LE(p) !== 0x04034b50) return null;
    const d = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
    const brut = buf.slice(d, d + e.taille);
    return e.methode === 0 ? brut : e.methode === 8 ? zlib.inflateRawSync(brut) : null;
  };
  return { entrees, lire };
}
// La version et les dossiers de tête d'un paquet d'extension. `null` = illisible.
export function paquetExtension(buf) {
  const z = lireZip(buf);
  if (!z) return null;
  const man = z.entrees.filter((e) => /(^|\/)manifest\.json$/.test(e.nom)).sort((a, b) => a.nom.length - b.nom.length)[0];
  if (!man) return { version: null, tetes: [] };
  let version = null;
  try { version = JSON.parse(z.lire(man).toString('utf8')).version || null; } catch (_) {}
  const tetes = [...new Set(z.entrees.map((e) => e.nom.split('/')[0] + (e.nom.includes('/') ? '/' : '')))];
  return { version, tetes, manifeste: man.nom };
}

// ── Une requête : curl (HTTPS seulement, sauf la copie locale du banc) ──────
let compteur = 0;
function lire(chemin) {
  const dest = path.join(TMP, `r${compteur++}`);
  const sortie = execFileSync('curl', ['--silent', '--show-error', '--max-time', '30', '--proto', LOCAL ? '=http,https' : '=https', '--output', dest, '--write-out', '%{http_code}\n%{content_type}', ORIGINE + chemin], { encoding: 'utf8', maxBuffer: 1e6 });
  const [code, type] = sortie.split('\n');
  let corps = Buffer.alloc(0); try { corps = fs.readFileSync(dest); } catch (_) {}
  return { status: Number(code), type: String(type || ''), corps, texte: corps.toString('utf8') };
}

const echecs = [];
function controle(nom, f) {
  let r;
  try { r = f(); } catch (e) { r = `réseau ou lecture impossible (${String((e && e.message) || e).split('\n')[0].slice(0, 160)})`; }
  if (r === true) { console.log(`OK     ${nom}`); return; }
  echecs.push({ nom, raison: r });
  console.log(`ÉCHEC  ${nom} — ${r}`);
  // Une annotation : GitHub la montre en tête du résumé du job.
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Production : ${nom}::${String(r).replace(/\r?\n/g, ' ')}`);
}
const pageApp = (r) => /^\s*<!doctype html/i.test(r.texte.slice(0, 200));

console.log(`Sonde publique de ${ORIGINE} — aucune session, aucun secret.\n`);

controle('page d’accueil', () => {
  const r = lire('/');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200`;
  if (!titreAttendu) return 'titre attendu illisible dans index.html du dépôt';
  if (!r.texte.includes(`<title>${titreAttendu}</title>`)) return `le titre « ${titreAttendu} » manque (la page servie n’est pas celle de l’app)`;
  if (!r.texte.includes('/assets/')) return 'aucun fichier /assets/ : la page servie ne charge pas l’app';
  return true;
});
controle('page de récupération', () => {
  const r = lire('/recuperation.html');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200`;
  return (r.texte.includes('recuperation.js') && r.texte.includes('id="nouveau"')) || 'la page servie n’est pas la page de récupération';
});
controle('/api/sante', () => {
  const r = lire('/api/sante');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200 (fonction serveur en panne ?)`;
  let j; try { j = JSON.parse(r.texte); } catch (_) { return 'la réponse n’est pas du JSON'; }
  if (j.ok !== true) return '« ok » n’est pas vrai';
  if (!clesSante || !clesSante.length) return 'les clés attendues sont illisibles dans api/compte.js du dépôt';
  const manque = clesSante.filter((k) => !(k in j));
  if (manque.length) return `clé(s) absente(s) : ${manque.join(', ')}`;
  const pasBool = clesSante.filter((k) => typeof j[k] !== 'boolean');
  if (pasBool.length) return `clé(s) qui ne sont pas un oui/non : ${pasBool.join(', ')}`;
  if (j.serviceKey !== true) return 'SUPABASE_SERVICE_KEY n’est pas posée sur Vercel : rappels, e-mails et notifications se taisent';
  return true;
});
controle('confidentialité fermée sans session', () => {
  const r = lire('/api/compte?mode=confidentialite');
  return r.status === 401 || `HTTP ${r.status} au lieu de 401 (une route privée répond sans session ?)`;
});
controle('extension servie (VRM-extension.zip)', () => {
  const r = lire('/VRM-extension.zip');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200`;
  if (pageApp(r)) return 'la page de l’app est servie à la place du zip';
  const p = paquetExtension(r.corps);
  if (!p) return 'le fichier servi n’est pas un zip lisible';
  if (!p.version) return 'manifest.json absent ou illisible dans le zip';
  if (!versionAttendue) return 'EXT_ATTENDUE illisible dans src/App.jsx du dépôt';
  if (p.version !== versionAttendue) return `version ${p.version} servie, l’app attend ${versionAttendue}`;
  const dossiers = p.tetes.filter((t) => t.endsWith('/'));
  if (p.tetes.length !== 1 || dossiers.length !== 1) return `le zip doit se dézipper en UN dossier (trouvé : ${p.tetes.slice(0, 5).join(', ')})`;
  return true;
});
controle('extension Orion servie (VRM-Orion.xpi)', () => {
  const depot = paquetExtension(lireDepot('public/VRM-Orion.xpi'));
  if (!depot || !depot.version) return 'paquet Orion du dépôt illisible (public/VRM-Orion.xpi)';
  const r = lire('/VRM-Orion.xpi');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200`;
  if (pageApp(r)) return 'la page de l’app est servie à la place du paquet';
  const p = paquetExtension(r.corps);
  if (!p || !p.version) return 'le fichier servi n’est pas un paquet lisible';
  return p.version === depot.version || `version ${p.version} servie, le dépôt porte ${depot.version}`;
});
controle('notice Orion', () => {
  const r = lire('/VRM-Orion-installation.txt');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200`;
  return (!pageApp(r) && /VRM POUR ORION/.test(r.texte)) || 'la notice servie n’est pas celle du dépôt';
});
controle('manifeste de l’app (manifest.webmanifest)', () => {
  const r = lire('/manifest.webmanifest');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200`;
  let m; try { m = JSON.parse(r.texte); } catch (_) { return 'le manifeste n’est pas du JSON (la page de l’app servie à la place ?)'; }
  if (!m.name || !m.start_url || !Array.isArray(m.icons) || !m.icons.length) return 'nom, adresse de départ ou icônes absents';
  const mortes = m.icons.map((i) => i && i.src).filter(Boolean).filter((src) => { const x = lire(src.startsWith('/') ? src : '/' + src); return x.status !== 200 || !/^image\//.test(x.type); });
  return !mortes.length || `icône(s) qui ne répondent pas : ${mortes.join(', ')}`;
});
controle('service worker (sw.js)', () => {
  const r = lire('/sw.js');
  if (r.status !== 200) return `HTTP ${r.status} au lieu de 200`;
  if (pageApp(r) || !/javascript/i.test(r.type)) return `ce n’est pas du JavaScript (type ${r.type || 'inconnu'})`;
  return /self\.addEventListener\(/.test(r.texte) || 'le service worker servi n’écoute rien';
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
console.log('\nNe vérifie ni la livraison des e-mails, ni les comptes privés, ni la capacité de charge.');
if (echecs.length) {
  console.log(`\n❌ ${echecs.length} contrôle(s) en échec sur ${ORIGINE} :`);
  for (const e of echecs) console.log(`   · ${e.nom} : ${e.raison}`);
  process.exitCode = 1;
} else console.log(`\n✅ ${ORIGINE} répond comme le dépôt l’attend.`);
