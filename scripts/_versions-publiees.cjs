// ════════════════════════════════════════════════════════════════════════════
// LES VERSIONS DE L'EXTENSION DÉJÀ PUBLIÉES — lues dans l'HISTORIQUE, jamais
// recopiées à la main (revue du 11 octobre)
// ════════════════════════════════════════════════════════════════════════════
// Deux fois le même jour, une liste écrite à la main a menti :
//   · `PUBLIEES_SANS_PREUVE = ['5.164.0', '5.167.0', '5.168.0']` — la 5.170.0
//     partie en production (PR #473) n'y était pas, et elle n'a PAS
//     `capterPreuvesVente` : l'app lui promettait « l'extension lit sa
//     transaction toute seule » (seuil 5.169.0 < 5.170.0) ;
//   · « 5.169.0 » désignait déjà TROIS contenus différents (production 5.169
//     n'existe pas, le chantier extension, le chantier eBay).
// ⇒ Ce qui est publié, c'est ce que `main` a servi : chaque commit de sa
//   première lignée qui touche le manifeste ou le fond de l'extension. Pour
//   chacun, la version du manifeste et les fonctions que son `background.js`
//   déclare. Une version vue avec PLUSIEURS contenus garde chaque contenu.
//
// Trois états, jamais deux : `null` = l'historique n'a pas pu être lu (pas de
// dépôt git ici, référence absente) — l'appelant le DIT, il ne conclut rien.
//
// Usage : const { versionsPubliees } = require('./_versions-publiees.cjs');
//         versionsPubliees({ racine })  →  null | [{ sha, version, bg }]
// `VRM_GIT` : le dépôt à lire quand le script tourne depuis une copie
// (§6.1 : `git archive` n'emporte pas l'historique). `VRM_REF_PUBLIEE` : la
// référence publiée (défaut `origin/main`, puis `main`).
const { spawnSync } = require('child_process');

const CHEMINS = ['vinted-sync-extension/manifest.json', 'vinted-sync-extension/background.js'];
// Une extension qu'il a INSTALLÉE sans que `main` l'ait servie (un zip remis
// pendant une session) : elle tourne chez lui tout autant. Mesuré, pas supposé.
// ⚠️ Pas la première lignée de `main` en entier (les commits de branche) : deux
// contenus y portaient « 5.165.0 » et aucun n'a été servi — les compter ferait
// juger ce qui n'a jamais tourné chez personne.
const INSTALLEES_HORS_MAIN = [
  { sha: 'cdc9c1d', pourquoi: '5.164.0 — panel_diag_capture.ver chez lui les 9-10 octobre, production servait la 5.163' },
];

function git(depot, args, entree) {
  const r = spawnSync('git', ['-C', depot, ...args], { encoding: 'latin1', input: entree, maxBuffer: 1 << 30 });
  if (r.status !== 0) return null;
  return r.stdout;
}

// `git cat-file --batch` : un seul processus pour tout l'historique.
function lireBlobs(depot, specs) {
  const brut = spawnSync('git', ['-C', depot, 'cat-file', '--batch'], { input: specs.join('\n') + '\n', maxBuffer: 1 << 30 });
  if (brut.status !== 0) return null;
  const buf = brut.stdout, out = [];
  let i = 0;
  for (let k = 0; k < specs.length; k++) {
    const fin = buf.indexOf(10, i);
    if (fin < 0) return null;
    const tete = buf.slice(i, fin).toString('utf8');
    i = fin + 1;
    if (/ missing$/.test(tete)) { out.push(null); continue; }
    const taille = Number(tete.split(' ')[2]);
    if (!Number.isFinite(taille)) return null;
    out.push(buf.slice(i, i + taille).toString('utf8'));
    i += taille + 1;
  }
  return out;
}

function versionsPubliees({ racine } = {}) {
  const depots = [process.env.VRM_GIT, racine].filter(Boolean);
  const refs = process.env.VRM_REF_PUBLIEE ? [process.env.VRM_REF_PUBLIEE] : ['origin/main', 'main'];
  for (const depot of depots) {
    for (const ref of refs) {
      const log = git(depot, ['log', '--first-parent', '--format=%H', ref, '--', ...CHEMINS]);
      if (log == null) continue;
      const shas = log.split('\n').map((s) => s.trim()).filter(Boolean);
      if (!shas.length) continue;
      for (const h of INSTALLEES_HORS_MAIN) {
        const plein = git(depot, ['rev-parse', '--verify', '--quiet', h.sha + '^{commit}']);
        if (plein && !shas.includes(plein.trim())) shas.push(plein.trim());
      }
      const specs = [];
      for (const s of shas) specs.push(`${s}:${CHEMINS[0]}`, `${s}:${CHEMINS[1]}`);
      const blobs = lireBlobs(depot, specs);
      if (!blobs) return null;
      const out = [];
      shas.forEach((sha, k) => {
        const man = blobs[2 * k], bg = blobs[2 * k + 1];
        let version = null;
        try { version = man ? JSON.parse(man).version : null; } catch (_) {}
        if (version) out.push({ sha, version: String(version), bg: bg || '' });
      });
      return out.length ? { ref, depot, commits: out } : null;
    }
  }
  return null;
}

// Les versions publiées dont AU MOINS UN contenu n'a pas la fonction `fn`.
const aLaFonction = (bg, fn) => new RegExp('function\\s+' + fn + '\\b').test(bg || '');
function versionsSans(pub, fn) {
  const s = new Set();
  for (const c of (pub && pub.commits) || []) if (!aLaFonction(c.bg, fn)) s.add(c.version);
  return [...s];
}

module.exports = { versionsPubliees, versionsSans, aLaFonction, INSTALLEES_HORS_MAIN };
