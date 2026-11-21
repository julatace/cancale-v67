// ════════════════════════════════════════════════════════════════════════════
//  LA VIDÉO DE 45 S DE LA PAGE D'ACCUEIL (14 nov., idée d'accueil 146) — tournée
//  dans la VRAIE app (dist/) avec le monde INVENTÉ des films (`_monde.cjs` : pseudos,
//  codes, montants fabriqués ; dépôt public), comme les vidéos du « ? » (lot 49).
//  Quatre plans mis bout à bout (une app neuve chacun) : Ma journée → le
//  bordereau imprimé d'un geste → les codes de retrait → le N° de rangement.
//
//  ⚠️ AUCUN TITRE INCRUSTÉ : la page parle cinq langues ; les sous-titres sont des
//     pistes `.vtt` (fr, en, es, it, de), la piste de la langue de la page est montrée.
//  ⚠️ PAS DE SON (aucune piste audio) : rien à couper, rien d'obligatoire.
//  ⚠️ Ni prix d'abonnement, ni « gratuit » : une vidéo publiée ne se met pas à jour.
//
//  Sortie : 720 × 1280, H.264, 30 i/s, `+faststart`, ≤ 45 s, ≤ 2 Mo, une affiche
//  (.jpg 360 × 640). Publiée dans `public/accueil/` ; la page ne la demande qu'au
//  toucher de « Voir VRM en 45 s » (src/accueil/AccueilVideo.jsx).
//
//    npm run build                                    # ⚠️ jamais pendant un tournage
//    FILMS_SORTIE=/hors/du/depot node scripts/films/accueil-video.cjs
//    PUBLIER=1 node scripts/films/accueil-video.cjs    # + copie dans public/accueil/
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.IPS = process.env.IPS || '30';
process.env.FILMS_ECHELLE = process.env.FILMS_ECHELLE || String(720 / 540);
process.env.FILMS_DEBIT = process.env.FILMS_DEBIT || '300k';
process.env.CRF = process.env.CRF || '31';
const path = require('path'), fs = require('fs');
const { execFileSync } = require('child_process');
const { Film, lancerNavigateur, fermerServeur, sortie } = require('./_commun.cjs');
const { monde } = require('./_monde.cjs');
const { hms } = require('./aide-videos.cjs');

const RACINE = path.join(__dirname, '..', '..');
const PUBLIC = path.join(RACINE, 'public', 'accueil');
const POIDS_MAX = 2 * 1024 * 1024, DUREE_MAX = 45;
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];

// Les sous-titres, cinq langues (la même phrase, au même instant).
const PHRASES = {
  journee: { fr: 'Chaque matin, ta journée : le plus pressé en haut.', en: 'Every morning, your day: most urgent first.', es: 'Cada mañana, tu día: lo más urgente arriba.', it: 'Ogni mattina, la tua giornata: prima il più urgente.', de: 'Jeden Morgen dein Tag: das Dringendste zuerst.' },
  chiffres: { fr: 'Ce que tu as vendu, reçu, gagné.', en: 'What you sold, received, earned.', es: 'Lo que has vendido, cobrado, ganado.', it: 'Quanto hai venduto, incassato, guadagnato.', de: 'Was du verkauft, erhalten, verdient hast.' },
  ventes: { fr: 'Tes bordereaux, tamponnés du N°, imprimés d’un geste.', en: 'Your labels, stamped with the No., printed in one go.', es: 'Tus etiquetas, selladas con el N.º, impresas de una vez.', it: 'Le tue etichette, timbrate col N., stampate in un gesto.', de: 'Deine Etiketten, mit Nr. gestempelt, mit einem Tipp gedruckt.' },
  retrait: { fr: 'Tes codes de retrait, réunis par point relais.', en: 'Your pickup codes, grouped by pickup point.', es: 'Tus códigos de recogida, reunidos por punto.', it: 'I tuoi codici di ritiro, riuniti per punto.', de: 'Deine Abholcodes, nach Abholstelle gesammelt.' },
  numero: { fr: 'Chaque article a son N° de rangement, celui de son carton.', en: 'Each item has its storage No., the one on its box.', es: 'Cada artículo tiene su N.º, el de su caja.', it: 'Ogni articolo ha il suo N., quello della sua scatola.', de: 'Jeder Artikel hat seine Lagernr., die auf seinem Karton.' },
  fin: { fr: 'VRM : tes ventes, tes colis et ta compta, au même endroit.', en: 'VRM: your sales, parcels and accounts, in one place.', es: 'VRM: tus ventas, paquetes y cuentas, en un solo lugar.', it: 'VRM: vendite, pacchi e conti, in un solo posto.', de: 'VRM: Verkäufe, Pakete und Buchhaltung an einem Ort.' },
};
function vtt(cues, duree, l) {
  const out = ['WEBVTT', ''];
  cues.forEach((c, i) => {
    const fin = Math.min(duree, cues[i + 1] ? cues[i + 1].t : duree);
    out.push(String(i + 1), `${hms(c.t)} --> ${hms(fin)}`, PHRASES[c.cle][l], '');
  });
  return out.join('\n');
}

// QUATRE PLANS tournés chacun dans SA page (une app neuve par plan : trois apps chargées
// l'une après l'autre dans la même page faisaient tomber le navigateur du tournage), puis
// mis bout à bout par ffmpeg (même codage, copie sans réencodage).
const PLANS = [
  { tab: 'journee', async jouer(f, dire) {
    f.telY = f.F.h; f.telOpacite = 0;
    dire('journee');
    await f.jouer(0.3); await f.entree(1.0); await f.jouer(0.4);
    f.cle('apercu');
    await f.viser('[data-tuile="envoyer"]', { zoom: 1.38, dur: 1.0 });
    await f.jouer(3.4);
    dire('chiffres');
    await f.defilerVers('[data-fu-case="vendu-mois"]', { marge: 300, dur: 0.9 });
    await f.viser('[data-fu-case="vendu-mois"]', { zoom: 1.38, dur: 0.9 });
    await f.jouer(3.4); f.cle('chiffres');
    f.repos_(0.8); await f.jouer(1.2);
  } },
  { tab: 'ventes', async jouer(f, dire) {
    dire('ventes');
    await f.jouer(0.4);
    await f.viser('[data-lot-ouvrir]', { zoom: 1.38, dur: 1.0, dy: 140 });
    await f.jouer(1.2);
    await f.toucher('[data-lot-ouvrir]', { apres: 0.6 });
    await f.jouer(3.4); f.cle('ventes');
    f.repos_(0.8); await f.jouer(2.4);
  } },
  { tab: 'achats', async jouer(f, dire) {
    dire('retrait');
    await f.jouer(0.4);
    await f.defilerVers('texte:Relais du Marché', { marge: 60, dur: 1.0 });
    await f.viser('texte:Relais du Marché', { zoom: 1.3, dur: 1.0, dy: 130 });
    await f.jouer(2.2);
    await f.toucher('1@[data-rp-comptoir]', { apres: 0.5 });
    await f.viser('[aria-label^="Copier code de retrait"]', { zoom: 1.38, dur: 0.9, dy: 60 });
    await f.jouer(3.2); f.cle('retrait');
    f.repos_(0.8); await f.jouer(2.0);
  } },
  { tab: 'annonces', async jouer(f, dire) {
    dire('numero');
    await f.jouer(0.4);
    await f.defilerVers('[data-carte-annonce="7115"]', { marge: 120, dur: 1.2 });
    await f.viser('[data-carte-annonce="7115"]', { zoom: 1.38, dur: 1.0 });
    await f.jouer(4.0); f.cle('numero');
    f.repos_(0.8); await f.jouer(1.6);
    dire('fin');
    await f.fin('vrm.center', 3.2);
  } },
];

// Un plan, dans SON processus (un navigateur neuf : l'horloge figée d'un tournage ne se
// rembobine pas pour le suivant). Rend { duree, cues, erreurs } dans `plan-{i}.json`.
async function tournerPlan(i) {
  const dossier = sortie('accueil');
  const p = PLANS[i]; const cues = [];
  const nav = await lancerNavigateur();
  try {
    const f = new Film({ nom: 'accueil-45s-' + i, format: 'portrait', monde: monde(), tab: p.tab });
    await f.demarrer(nav);
    await f.app.evaluate(() => { window.print = () => {}; });
    // L'horloge du cadre peut avoir pris de l'avance pendant le chargement : on fige un peu plus loin.
    { const orig = f.pg.clock.pauseAt.bind(f.pg.clock); f.pg.clock.pauseAt = async (d) => { let e0; for (const pas of [0, 5e3, 6e4, 36e5, 864e5]) { try { return await orig(new Date(new Date(d).getTime() + pas)); } catch (e) { e0 = e; if (!/past/i.test(String(e && e.message))) throw e; } } throw e0; }; }
    await f.enregistrer(path.join(dossier, `plan-${i}.mp4`));
    try { await p.jouer(f, (cle) => cues.push({ cle, t: f.t })); }
    catch (e) { try { f.ff.kill('SIGKILL'); } catch (_) {} try { await f.ctx.close(); } catch (_) {} throw e; }
    const r = await f.finir();
    if (i === 0) { const cles = fs.readdirSync(dossier).filter((x) => x.startsWith('plan-0-cle') && x.endsWith('.png')).sort(); if (cles.length) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dossier, cles[0]), '-vf', 'scale=360:640', '-q:v', '6', path.join(dossier, 'film-45s.jpg')]); }
    fs.writeFileSync(path.join(dossier, `plan-${i}.json`), JSON.stringify({ duree: r.duree, cues, erreurs: r.erreurs }));
  } finally { await nav.close(); fermerServeur(); }
}

async function tourner() {
  const dossier = sortie('accueil');
  const fichier = path.join(dossier, 'film-45s.mp4');
  const cues = []; const morceaux = []; let decalage = 0; const erreurs = [];
  for (let i = 0; i < PLANS.length; i++) {
    execFileSync(process.execPath, [__filename], { env: { ...process.env, PLAN_SEUL: String(i) }, stdio: 'inherit' });
    const j = JSON.parse(fs.readFileSync(path.join(dossier, `plan-${i}.json`), 'utf8'));
    for (const c of j.cues) cues.push({ cle: c.cle, t: decalage + c.t });
    decalage += j.duree; erreurs.push(...j.erreurs); morceaux.push(path.join(dossier, `plan-${i}.mp4`));
  }
  const liste = path.join(dossier, 'plans.txt');
  fs.writeFileSync(liste, morceaux.map((m) => `file '${m.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', '-movflags', '+faststart', fichier]);
  const duree = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichier]).toString().trim()) || decalage;
  const poids = fs.statSync(fichier).size;
  for (const l of LANGUES) fs.writeFileSync(path.join(dossier, `film-45s.${l}.vtt`), vtt(cues, duree, l));
  // Aucune piste audio : vérifié sur le fichier, pas supposé.
  let audio = '';
  try { audio = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', fichier]).toString().trim(); } catch (_) { audio = '?'; }
  const ok = poids <= POIDS_MAX && duree <= DUREE_MAX + 0.05 && duree >= 30 && audio === '';
  console.log(`${ok ? '✅' : '❌'} film-45s : ${duree.toFixed(1)} s, ${(poids / 1048576).toFixed(2)} Mo, son : ${audio === '' ? 'aucun' : audio}${erreurs.length ? ' — erreurs de page : ' + erreurs.join(' | ') : ''}`);
  if (ok && process.env.PUBLIER) {
    fs.mkdirSync(PUBLIC, { recursive: true });
    for (const x of ['mp4', 'jpg', ...LANGUES.map((l) => `${l}.vtt`)]) fs.copyFileSync(path.join(dossier, `film-45s.${x}`), path.join(PUBLIC, `film-45s.${x}`));
  }
  return ok;
}

if (require.main === module) {
  (async () => {
    if (process.env.PLAN_SEUL != null) { await tournerPlan(Number(process.env.PLAN_SEUL)); return; }
    if (!(await tourner())) process.exitCode = 1;
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { PHRASES, LANGUES };
