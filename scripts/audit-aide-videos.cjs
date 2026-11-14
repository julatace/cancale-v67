#!/usr/bin/env node
// ── audit-aide-videos — LES VIDÉOS DU « ? » (13 nov., lot 49) ──────────────────
// Lecture seule. Exécute la VRAIE table (src/aideVideos.js) et lit les fichiers
// publiés (public/aide/videos/) en ouvrant le MP4 lui-même (boîtes ISO, sans
// ffprobe : la CI n'en a pas). Exige :
//   1. les 10 écrans principaux (Ma journée, Ventes, Colis, Achats, Annonces, Stock,
//      Argent, Messages, E-mails, Réglages) ont une vidéo ; le « ? » de chacun
//      propose d'abord LA SIENNE (Achats propose aussi « Retirer un colis ») ;
//      chaque clé est une clé d'aide qui existe (src/aideEcrans.js) ;
//   2. chaque vidéo : un MP4 H.264 (avc1), SANS piste son, ≤ 720 × 1280, ≤ 30 s,
//      ≤ 1,5 Mo, `moov` avant `mdat` (lecture qui démarre avant la fin du
//      téléchargement), sa durée déclarée dans la table à 1 s près ; un aperçu .jpg
//      (≤ 80 Ko) ; une piste .vtt (WEBVTT, des sous-titres courts, dans la durée) ;
//   3. rien au démarrage : `/aide/videos` n'est écrit que dans src/aideVideos.js ;
//      seul AideVideo.jsx l'importe ; le <video> n'existe qu'une fois une vidéo
//      choisie (`lue`) ; le service worker laisse /aide/ au réseau et ne nomme
//      aucune vidéo ; aucune vidéo ailleurs dans public/ (poids du dépôt) ;
//   4. les vidéos sont tournées sur le monde INVENTÉ des films : aucun pseudo des
//      comptes de Julien dans les scénarios ni dans les pistes.
//   node scripts/audit-aide-videos.cjs [--mutation=NOM | --prouve]
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');
const DOSSIER = path.join(RAC, 'public', 'aide', 'videos');
const POIDS_MAX = 1.5 * 1024 * 1024, DUREE_MAX = 30, APERCU_MAX = 80 * 1024;
const PRINCIPAUX = ['journee', 'ventes', 'colis', 'achats', 'annonces', 'garage', 'compta', 'messages', 'emails', 'settings'];
// Des pseudos RÉELS qui ne doivent jamais paraître (les comptes de Julien cités dans l'historique).
const INTERDITS = ['julatace', 'vanessa5723', 'tomj606'];

// ── Mutations : chaque défaut remis exprès doit rendre l'audit ROUGE. ──
const MUTATIONS = {
  'mauvaise-video': (x) => { x.ecran.ventes = ['journee']; },
  'sans-colis-achats': (x) => { x.ecran.achats = ['achats']; },
  'ecran-sans-video': (x) => { delete x.ecran.messages; },
  'trop-lourde': (x) => { x.poids = (id) => (id === 'garage' ? POIDS_MAX + 1 : null); },
  'trop-longue': (x) => { x.duree = (id) => (id === 'compta' ? 31 : null); },
  'avec-son': (x) => { x.son = (id) => id === 'emails'; },
  'duree-fausse': (x) => { x.aide.journee = { ...x.aide.journee, duree: x.aide.journee.duree + 5 }; },
  'sw-video': (x) => { x.sw += "\nconst PRECHARGE = ['/aide/videos/journee.mp4'];"; },
  'demarrage': (x) => { x.sources['src/App.jsx'] += "\nconst V = '/aide/videos/journee.mp4';"; },
  'video-toujours': (x) => { x.sources['src/composants/AideVideo.jsx'] = x.sources['src/composants/AideVideo.jsx'].replace('{v ? (', '{true ? ('); },
  'pseudo-reel': (x) => { x.vtt.journee += '\nvanessa5723'; },
};

// ── Le MP4, boîte par boîte (ISO/IEC 14496-12) ──
function boites(buf, debut = 0, fin = buf.length) {
  const out = [];
  for (let o = debut; o + 8 <= fin;) {
    let taille = buf.readUInt32BE(o); const type = buf.toString('latin1', o + 4, o + 8); let entete = 8;
    if (taille === 1) { taille = Number(buf.readBigUInt64BE(o + 8)); entete = 16; } else if (taille === 0) taille = fin - o;
    if (taille < entete || o + taille > fin) break;
    out.push({ type, o, taille, corps: o + entete });
    o += taille;
  }
  return out;
}
function lireMp4(fichier) {
  const buf = fs.readFileSync(fichier);
  const haut = boites(buf);
  const ordre = haut.map((b) => b.type);
  const moov = haut.find((b) => b.type === 'moov');
  const r = { poids: buf.length, ftyp: ordre[0] === 'ftyp', moovAvant: ordre.indexOf('moov') >= 0 && ordre.indexOf('moov') < ordre.indexOf('mdat'), duree: null, pistes: [] };
  if (!moov) return r;
  for (const b of boites(buf, moov.corps, moov.o + moov.taille)) {
    if (b.type === 'mvhd') { const v = buf[b.corps]; const ts = v === 1 ? buf.readUInt32BE(b.corps + 20) : buf.readUInt32BE(b.corps + 12); const d = v === 1 ? Number(buf.readBigUInt64BE(b.corps + 24)) : buf.readUInt32BE(b.corps + 16); r.duree = d / ts; }
    if (b.type === 'trak') {
      const piste = { w: null, h: null, type: '', codec: '' };
      const cherche = (deb, fin) => { for (const c of boites(buf, deb, fin)) {
        if (c.type === 'tkhd') { const v = buf[c.corps]; const base = c.corps + (v === 1 ? 88 : 76); piste.w = buf.readUInt32BE(base) / 65536; piste.h = buf.readUInt32BE(base + 4) / 65536; }
        if (c.type === 'hdlr') piste.type = buf.toString('latin1', c.corps + 8, c.corps + 12);
        if (c.type === 'stsd') { const e = boites(buf, c.corps + 8, c.o + c.taille)[0]; if (e) piste.codec = e.type; }
        if (['mdia', 'minf', 'stbl'].includes(c.type)) cherche(c.corps, c.o + c.taille);
      } };
      cherche(b.corps, b.o + b.taille);
      r.pistes.push(piste);
    }
  }
  return r;
}

async function etat() {
  const m = await import(pathToFileURL(path.join(RAC, 'src', 'aideVideos.js')).href);
  const ae = await import(pathToFileURL(path.join(RAC, 'src', 'aideEcrans.js')).href);
  const lire = (p) => { try { return fs.readFileSync(path.join(RAC, p), 'utf8'); } catch (_) { return ''; } };
  const sources = {};
  const tous = (d) => fs.readdirSync(path.join(RAC, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tous(path.join(d, e.name)) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []);
  for (const f of tous('src')) sources[f] = lire(f);
  const vtt = {};
  for (const id of Object.keys(m.VIDEOS_AIDE)) vtt[id] = lire(path.join('public', 'aide', 'videos', id + '.vtt'));
  return { aide: { ...m.VIDEOS_AIDE }, ecran: JSON.parse(JSON.stringify(m.VIDEOS_ECRAN)), cles: Object.keys(ae.AIDE_ECRANS), sw: lire('public/sw.js'), sources, vtt,
    scenarios: lire('scripts/films/_aide-scenarios.cjs') + lire('scripts/films/_monde.cjs') + lire('scripts/films/_monde-emails.cjs'),
    poids: () => null, duree: () => null, son: () => false };
}

function juger(x) {
  const rouges = [], verts = [];
  const dit = (c, m) => (c ? verts : rouges).push(m);
  // 1. Un écran, sa vidéo.
  for (const e of PRINCIPAUX) {
    const l = x.ecran[e] || [];
    dit(!!x.aide[e], `${e} : une vidéo existe dans la table`);
    dit(l[0] === e, `${e} : son « ? » propose d'abord SA vidéo (${l.join(', ') || 'aucune'})`);
    dit(x.cles.includes(e), `${e} : est une clé d'aide (src/aideEcrans.js)`);
  }
  dit((x.ecran.achats || []).includes('colis'), 'achats : « Retirer un colis » proposé aussi (Colis vit dans Achats)');
  for (const [e, l] of Object.entries(x.ecran)) for (const id of l) dit(!!x.aide[id], `${e} → ${id} : vidéo connue`);
  // 2. Les fichiers.
  const listes = fs.existsSync(DOSSIER) ? fs.readdirSync(DOSSIER) : [];
  for (const id of Object.keys(x.aide)) {
    const f = path.join(DOSSIER, id + '.mp4');
    if (!fs.existsSync(f)) { dit(false, `${id}.mp4 : publié dans public/aide/videos/`); continue; }
    const v = lireMp4(f);
    const poids = x.poids(id) != null ? x.poids(id) : v.poids;
    const duree = x.duree(id) != null ? x.duree(id) : v.duree;
    const video = v.pistes.filter((p) => p.type === 'vide');
    const son = x.son(id) || v.pistes.some((p) => p.type === 'soun');
    dit(v.ftyp && v.moovAvant, `${id}.mp4 : MP4, moov avant mdat (démarre avant la fin du téléchargement)`);
    dit(video.length === 1 && video[0].codec === 'avc1', `${id}.mp4 : une piste H.264 (${video.map((p) => p.codec).join(',')})`);
    dit(!son, `${id}.mp4 : aucune piste son`);
    dit(video[0] && video[0].w <= 720 && video[0].h <= 1280, `${id}.mp4 : 720p au plus (${video[0] ? video[0].w + '×' + video[0].h : '?'})`);
    dit(duree != null && duree <= DUREE_MAX + 0.05, `${id}.mp4 : 30 s au plus (${duree && duree.toFixed(1)} s)`);
    dit(poids <= POIDS_MAX, `${id}.mp4 : 1,5 Mo au plus (${(poids / 1048576).toFixed(2)} Mo)`);
    dit(duree != null && Math.abs(duree - x.aide[id].duree) <= 1, `${id} : la durée affichée (${x.aide[id].duree} s) est celle du fichier (${duree && duree.toFixed(1)} s)`);
    const jpg = path.join(DOSSIER, id + '.jpg');
    dit(fs.existsSync(jpg) && fs.statSync(jpg).size <= APERCU_MAX && fs.readFileSync(jpg).subarray(0, 2).toString('hex') === 'ffd8', `${id}.jpg : aperçu JPEG ≤ 80 Ko`);
    const t = x.vtt[id] || '';
    const cues = t.split(/\n\n+/).filter((b) => /-->/.test(b));
    const fins = cues.map((b) => { const m2 = /--> (\d+):(\d+):(\d+)\.(\d+)/.exec(b); return m2 ? (+m2[1]) * 3600 + (+m2[2]) * 60 + (+m2[3]) + (+m2[4]) / 1000 : 0; });
    const longues = cues.flatMap((b) => b.split('\n').slice(2)).filter((l) => l.length > 60);
    dit(/^WEBVTT/.test(t) && cues.length >= 2 && !longues.length && fins.every((s) => s <= (duree || 0) + 0.05), `${id}.vtt : WEBVTT, ${cues.length} sous-titres courts, dans la durée${longues.length ? ' — trop long : ' + longues[0] : ''}`);
  }
  const intrus = listes.filter((n) => !/^[a-z]+\.(mp4|jpg|vtt)$/.test(n) || !x.aide[n.split('.')[0]]);
  dit(!intrus.length, `public/aide/videos/ ne contient que les vidéos de la table${intrus.length ? ' — en trop : ' + intrus.join(', ') : ''}`);
  const ailleurs = [];
  const fouille = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (p !== DOSSIER) fouille(p); } else if (/\.(mp4|webm|mov|m4v)$/i.test(e.name)) ailleurs.push(path.relative(RAC, p)); } };
  fouille(path.join(RAC, 'public'));
  dit(!ailleurs.length, `aucune autre vidéo dans public/ (poids du dépôt)${ailleurs.length ? ' — ' + ailleurs.join(', ') : ''}`);
  // 3. Rien au démarrage.
  const ecrivent = Object.entries(x.sources).filter(([f, s]) => f !== path.join('src', 'aideVideos.js') && /\/aide\/videos|\.mp4['"`]/.test(s)).map(([f]) => f);
  dit(!ecrivent.length, `/aide/videos n'est écrit que dans src/aideVideos.js${ecrivent.length ? ' — aussi : ' + ecrivent.join(', ') : ''}`);
  const importent = Object.entries(x.sources).filter(([, s]) => /from ['"][./]*aideVideos\.js['"]/.test(s)).map(([f]) => f);
  dit(importent.length === 1 && importent[0] === path.join('src', 'composants', 'AideVideo.jsx'), `seul AideVideo.jsx importe la table (${importent.join(', ')})`);
  const av = x.sources[path.join('src', 'composants', 'AideVideo.jsx')] || '';
  dit(/\{v \? \(\s*<figure/.test(av) && (av.match(/<video\b[^>]*\bsrc=/g) || []).length === 1, 'AideVideo : le seul <video> n\'existe qu\'une vidéo choisie (au toucher)');
  dit(/\bmuted\b/.test(av) && /playsInline/.test(av) && /<track kind="captions"/.test(av), 'AideVideo : sans son, en ligne, piste de sous-titres');
  dit(/loading="lazy"/.test(av), 'AideVideo : l\'aperçu attend d\'être vu (loading="lazy")');
  dit(/startsWith\('\/aide\/'\)\) return;/.test(x.sw) && !/\.mp4|aide\/videos/.test(x.sw), 'sw.js : /aide/ au réseau, aucune vidéo nommée ni mise en réserve');
  // 4. Données inventées.
  const tout = x.scenarios + Object.values(x.vtt).join('\n');
  const vus = INTERDITS.filter((p) => tout.toLowerCase().includes(p));
  dit(!vus.length, `scénarios et sous-titres : aucun pseudo réel${vus.length ? ' — ' + vus.join(', ') : ''}`);
  return { rouges, verts };
}

async function principal(mutation) {
  const x = await etat();
  if (mutation) { if (!MUTATIONS[mutation]) throw new Error('mutation inconnue : ' + mutation); MUTATIONS[mutation](x); }
  return juger(x);
}

(async () => {
  const arg = process.argv.slice(2);
  if (arg.includes('--prouve')) {
    const base = await principal(null);
    let mal = base.rouges.length ? 1 : 0;
    if (base.rouges.length) console.log(`❌ l'audit est rouge sans mutation (${base.rouges.length}) : la preuve ne vaut rien`);
    for (const nom of Object.keys(MUTATIONS)) {
      const r = spawnSync(process.execPath, [__filename, `--mutation=${nom}`], { encoding: 'utf8' });
      const rouge = r.status !== 0;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'VERT (la règle ne la voit pas)'}`);
      if (!rouge) mal++;
    }
    console.log(mal ? `\n${mal} preuve(s) manquante(s)` : `\n${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations rouges`);
    process.exit(mal ? 1 : 0);
  }
  const mu = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || null;
  const { rouges, verts } = await principal(mu);
  for (const v of verts) console.log('✅ ' + v);
  for (const r of rouges) console.log('❌ ' + r);
  console.log(`\n${verts.length} vert(s), ${rouges.length} rouge(s)${mu ? ' — mutation ' + mu : ''}`);
  process.exit(rouges.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
