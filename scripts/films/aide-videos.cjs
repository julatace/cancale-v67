// ════════════════════════════════════════════════════════════════════════════
//  LES VIDÉOS DU « ? » (13 nov., lot 49) — une vidéo de 30 s au plus par écran
//  principal, tournée dans la VRAIE app (dist/) avec le monde INVENTÉ des films
//  (`_monde.cjs` : pseudos, adresses, codes, montants fabriqués ; dépôt public).
//  Chacune montre LE geste principal de son écran ; ses titres sont incrustés
//  (sous-titres courts) et recopiés dans une piste `.vtt`.
//
//  Sortie : 720 × 1280, H.264, 30 i/s, sans son, `+faststart`, ≤ 1,5 Mo, et une
//  image d'aperçu (`.jpg`, 360 × 640). Les fichiers publiés vivent dans
//  `public/aide/videos/` ; l'app ne les demande qu'au toucher de « Regarder »
//  dans la feuille du « ? » (src/aideVideos.js, src/composants/AideVideo.jsx).
//
//    npm run build                                   # ⚠️ jamais pendant un tournage
//    FILMS_SORTIE=/hors/du/depot node scripts/films/aide-videos.cjs            # les 10
//    ECRANS=journee,colis node scripts/films/aide-videos.cjs                   # quelques-uns
//    PUBLIER=1 node scripts/films/aide-videos.cjs    # + copie dans public/aide/videos/
//    BROUILLON=1 …                                   # 6 i/s : vérifier un scénario vite
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.IPS = process.env.IPS || (process.env.BROUILLON ? '6' : '30');
process.env.FILMS_ECHELLE = process.env.FILMS_ECHELLE || String(720 / 540);
process.env.FILMS_DEBIT = process.env.FILMS_DEBIT || '360k';
process.env.CRF = process.env.CRF || '30';
const path = require('path'), fs = require('fs');
const { execFileSync } = require('child_process');
const { Film, lancerNavigateur, fermerServeur, sortie } = require('./_commun.cjs');
const { SCENARIOS, PLATEAUX } = require('./_aide-scenarios.cjs');

const RACINE = path.join(__dirname, '..', '..');
const PUBLIC = path.join(RACINE, 'public', 'aide', 'videos');
const POIDS_MAX = 1.5 * 1024 * 1024, DUREE_MAX = 30;

// ── La piste de sous-titres : les titres incrustés, aux mêmes instants. ──────
const hms = (t) => { const ms = Math.max(0, Math.round(t * 1000)); const h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
const sansMarques = (s) => String(s || '').replace(/\*([^*]+)\*/g, '$1');
function vtt(titres, duree) {
  const lignes = ['WEBVTT', ''];
  titres.filter((t) => t.t0 < duree).forEach((t, i) => {
    lignes.push(String(i + 1), `${hms(t.t0)} --> ${hms(Math.min(t.t1, duree))}`, sansMarques(t.texte));
    if (t.sous) lignes.push(sansMarques(t.sous));
    lignes.push('');
  });
  return lignes.join('\n');
}

async function tournerUn(nav, cle) {
  const pl = PLATEAUX[cle];
  const m = pl.monde();
  const f = new Film({ nom: 'aide-' + cle, format: 'portrait', monde: m, tab: pl.tab, local: pl.local ? pl.local(m) : {} });
  const t0 = Date.now();
  await f.demarrer(nav);
  const dossier = sortie('aide');
  const fichier = path.join(dossier, `${cle}.mp4`);
  await f.enregistrer(fichier);
  try { await SCENARIOS[cle](f); }
  catch (e) { try { f.ff.kill('SIGKILL'); } catch (_) {} try { await f.ctx.close(); } catch (_) {} throw e; }
  const titres = f.titres.slice();
  const r = await f.finir();
  fs.writeFileSync(path.join(dossier, `${cle}.vtt`), vtt(titres, r.duree));
  // L'aperçu : l'image clé « apercu » (sinon la première), réduite à 360 × 640.
  const png = path.join(dossier, `aide-${cle}`);
  const cles = fs.readdirSync(dossier).filter((x) => x.startsWith(`${cle}-cle`) && x.endsWith('.png')).sort();
  if (cles.length) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dossier, cles[0]), '-vf', 'scale=360:640', '-q:v', '6', path.join(dossier, `${cle}.jpg`)]);
  void png;
  const ok = r.poids <= POIDS_MAX && r.duree <= DUREE_MAX + 0.05;
  console.log(`${ok ? '✅' : '❌'} ${cle} : ${r.duree.toFixed(1)} s, ${(r.poids / 1048576).toFixed(2)} Mo, tourné en ${Math.round((Date.now() - t0) / 1000)} s${r.erreurs.length ? ' — erreurs de page : ' + r.erreurs.join(' | ') : ''}`);
  if (ok && process.env.PUBLIER && !process.env.BROUILLON) {
    fs.mkdirSync(PUBLIC, { recursive: true });
    for (const ext of ['mp4', 'jpg', 'vtt']) fs.copyFileSync(path.join(dossier, `${cle}.${ext}`), path.join(PUBLIC, `${cle}.${ext}`));
  }
  return { cle, ...r, ok };
}

if (require.main === module) {
  (async () => {
    const voulus = (process.env.ECRANS || Object.keys(SCENARIOS).join(',')).split(',').map((x) => x.trim()).filter(Boolean);
    const inconnus = voulus.filter((c) => !SCENARIOS[c]);
    if (inconnus.length) throw new Error('écran sans scénario : ' + inconnus.join(', '));
    const nav = await lancerNavigateur();
    let ko = 0;
    try { for (const c of voulus) { const r = await tournerUn(nav, c); if (!r.ok) ko++; } }
    finally { await nav.close(); fermerServeur(); }
    if (ko) process.exitCode = 1;
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { SCENARIOS, PLATEAUX, vtt };
