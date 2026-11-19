// ════════════════════════════════════════════════════════════════════════════
//  BANC « CHARGEMENT PROPRE » (19 nov., capacite-3000)
//  Julien : « quand ça charge, quand les données apparaissent, c'est moche ».
//
//  Par écran (Ma journée, Ventes, Annonces, Achats), au téléphone (390 px tactile,
//  processeur ×4, réseau 4G simulé — VITESSE_RESEAU=4g posé ici), deux ouvertures :
//  « appareil neuf » puis « lancement suivant » (la page rechargée). On mesure DANS
//  la page, du chargement au calme :
//    · cls     : le décalage de mise en page cumulé (Layout Instability API, les
//                décalages qui suivent un geste exclus — il n'y en a pas ici) ;
//    · sauts   : le nombre de décalages VISIBLES (valeur ≥ 0,005 chacun) ;
//    · grand   : le plus grand décalage seul ;
//    · blanc   : ms passées sans aucun texte dans la zone principale après la coque.
//  Et une capture toutes les ~100 ms pendant les 8 premières secondes
//  (CAPTURES=dossier) : à REGARDER, elles font partie du test (§6.2).
//
//  Il ne juge rien par défaut (BANC_SEUIL_CLS=0.1 rend rouge au-dessus) : il
//  rapporte, avant / après (BANC_SORTIE=fichier.json).
//  Lancer : npm run build && node scripts/bancs/chargement-propre.cjs
//  ECRANS=journee,ventes · CAPTURES=dossier · BANC_SORTIE=fichier.json
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
if (!process.env.VITESSE_RESEAU) process.env.VITESSE_RESEAU = '4g';
if (!process.env.VITESSE_CPU) process.env.VITESSE_CPU = '4';
const V = require('./vitesse.cjs');

const texte = (re) => new Function(`return ${re}.test(document.body.innerText)`);
const ECRANS = [
  ['journee', 'Ma journée', V.ECRANS[0][1]],
  ['ventes', 'Ventes', texte('/vente/i')],
  ['annonces', 'Annonces', texte('/annonce|en ligne/i')],
  ['achats', 'Achats', texte('/achat/i')],
];
const seuls = process.env.ECRANS ? process.env.ECRANS.split(',') : null;
const CAPTURES = process.env.CAPTURES ? path.resolve(process.env.CAPTURES) : null;
const SEUIL = Number(process.env.BANC_SEUIL_CLS) || 0;
const DUREE_FILM = Number(process.env.BANC_FILM_MS) || 8000;
const FENETRE = { auMoins: 12000, auPlus: 30000 };

// Dans la page, avant tout script : les décalages, et le premier texte de la zone principale.
function observer() {
  const M = { cls: 0, sauts: 0, grand: 0, liste: [], coque: null, texte: null };
  window.__vrmCls = M;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        M.cls += e.value;
        if (e.value >= 0.005) {
          M.sauts++;
          const s = (e.sources || []).map((x) => { const n = x.node; return n && n.nodeType === 1 ? (n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) : (n ? '#text' : '?'); }).slice(0, 3);
          M.liste.push({ t: Math.round(e.startTime), v: Math.round(e.value * 1000) / 1000, s });
        }
        if (e.value > M.grand) M.grand = e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
  const voir = () => {
    if (M.coque == null && document.querySelector('.vrm-app-header')) M.coque = Math.round(performance.now());
    if (M.texte == null && M.coque != null) {
      const z = document.querySelector('main') || document.querySelector('#root');
      const t = z ? (z.innerText || '').replace(/\s+/g, ' ').trim() : '';
      if (t.length > 40) M.texte = Math.round(performance.now());
    }
  };
  document.addEventListener('DOMContentLoaded', () => { voir(); new MutationObserver(voir).observe(document.body, { subtree: true, childList: true, characterData: true }); });
}

function film(dossier, prefixe) {
  return async (pg, t0) => {
    if (!dossier) return null;
    fs.mkdirSync(dossier, { recursive: true });
    const vues = [];
    const debut = Date.now();
    while (Date.now() - debut < DUREE_FILM) {
      const t = Date.now() - debut;
      const f = path.join(dossier, `${prefixe}-${String(t).padStart(5, '0')}.png`);
      try { await pg.screenshot({ path: f, timeout: 2000 }); vues.push(t); } catch (_) {}
      const reste = 100 - ((Date.now() - debut) - t);
      if (reste > 0) await new Promise((r) => setTimeout(r, reste));
    }
    return vues.length;
  };
}

(async () => {
  await V.demarrer();
  const b = await V.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + V.PORT] });
  const sortie = {};
  let rouge = 0;
  try {
    for (const [tab, nom, attendre] of ECRANS) {
      if (seuls && !seuls.includes(tab)) continue;
      const lire = (pg) => pg.evaluate(() => { const M = window.__vrmCls || {}; return { cls: Math.round((M.cls || 0) * 1000) / 1000, sauts: M.sauts || 0, grand: Math.round((M.grand || 0) * 1000) / 1000, coque: M.coque, texte: M.texte, liste: (M.liste || []).slice(0, 12) }; });
      // La mesure se lit APRÈS le calme de chaque ouverture : la 1re avant le rechargement (le
      // rechargement efface la page), la 2e à la fin.
      const r = await V.ouvrir(b, { width: 390, height: 844 }, tab, attendre, null, {
        memoire: false, deuxieme: true, fenetre: FENETRE, initScript: observer,
        pendant: (pg, t0, quand) => film(CAPTURES, `${tab}-${quand || 'neuf'}`)(pg, t0),
        apres: lire,
      });
      // La 1re ouverture : relue par une 2e passe sans rechargement (le crochet `apres` lit la 2e).
      const r1 = await V.ouvrir(b, { width: 390, height: 844 }, tab, attendre, null, { memoire: false, fenetre: FENETRE, initScript: observer, apres: lire });
      const neuf = r1.apres, deux = r.apres;
      sortie[tab] = { neuf, deuxieme: deux, utile: { neuf: r1.utile, deuxieme: r.deuxieme && r.deuxieme.utile } };
      for (const [q, m] of [['appareil neuf', neuf], ['lancement suivant', deux]]) {
        if (!m) { console.log(`  ❔ ${nom} · ${q} : pas mesuré`); continue; }
        const ko = SEUIL && m.cls > SEUIL;
        if (ko) rouge++;
        console.log(`  ${ko ? '❌' : 'ℹ️ '} ${nom} · ${q} : CLS ${m.cls} · ${m.sauts} saut(s) visibles · le plus grand ${m.grand} · coque ${m.coque} ms · 1er texte ${m.texte} ms`);
        for (const s of m.liste) console.log(`       ${s.t} ms  ${s.v}  ${s.s.join(' | ')}`);
      }
    }
  } finally {
    await b.close();
    await V.fermer();
  }
  if (process.env.BANC_SORTIE) fs.writeFileSync(process.env.BANC_SORTIE, JSON.stringify(sortie, null, 1));
  if (rouge) { console.log(`\n❌ ${rouge} ouverture(s) au-dessus de CLS ${SEUIL}`); process.exit(1); }
  console.log('\n✅ mesuré' + (CAPTURES ? ` — captures dans ${CAPTURES}` : ''));
})().catch((e) => { console.error(e); process.exit(1); });
