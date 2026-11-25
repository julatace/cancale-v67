// ════════════════════════════════════════════════════════════════════════════
//  CHARGEMENT STRUCTURÉ (25 nov. 2026) — Julien : « quand les données s'affichent
//  c'est moche, long et déstructuré ».
//
//  Chaque écran principal est ouvert à 390 px (téléphone tactile) sur la base
//  inventée de `vitesse.cjs` (`_base-volume.cjs`, au poids réel), avec des réponses
//  Supabase RALENTIES (`VITESSE_RTT`, 700 ms par défaut ici) pour voir les états
//  intermédiaires. On mesure, DANS la page, du premier octet au calme :
//    · cls     : le Cumulative Layout Shift (fenêtres de session, comme Chrome :
//                écart ≤ 1 s, fenêtre ≤ 5 s ; `hadRecentInput` exclu) ;
//    · sauts   : le nombre de décalages visibles (> 0,001) ;
//    · chargement : un texte « chargement / loading / … » visible à l'écran ;
//    · zeros   : un montant « 0 € » affiché pendant le chargement, que l'écran
//                remplace ensuite par un AUTRE montant (le 0 n'était pas su) ;
//    · temps   : coque (barre du haut) · écran utile · calme.
//  Rouge si : un texte « chargement » à l'écran, un 0 € de chargement, CLS > 0,05.
//
//  Captures (`CHARGEMENT_CAPTURES=dossier`) : à la coque (t0), +300 ms, +1 s, +2 s
//  et au calme, par écran. `CHARGEMENT_PLANCHE=avant,apres,sortie` assemble deux
//  séries en planches PNG (avant en haut, après en bas), une par écran.
//
//  Lancer : npm run build && NODE_OPTIONS=--require=scripts/bancs/_garde-reseau.cjs \
//             node scripts/bancs/chargement-structure.cjs
//  Autres : `ECRANS=journee,ventes` · `VITESSE_DIST=dossier` (un autre build : la
//  preuve sur le code d'avant) · `CHARGEMENT_JSON=fichier` (les mesures brutes).
// ════════════════════════════════════════════════════════════════════════════
if (!process.env.VITESSE_RTT) process.env.VITESSE_RTT = '700';
if (!process.env.VITESSE_CPU) process.env.VITESSE_CPU = '1';
const path = require('path'), fs = require('fs');

const ECRANS_TOUS = [
  ['journee', 'Aujourd\'hui', () => !!document.querySelector('[data-vendu-mois],[data-vendu-pas-su]') || /pas pu s'afficher/.test(document.body.innerText)],
  ['annonces', 'Annonces', () => /en ligne|annonce/i.test(document.body.innerText)],
  ['ventes', 'Ventes', () => document.querySelectorAll('[data-vente],[data-tx],[data-fiche-ligne]').length > 0 || /vente/i.test(document.body.innerText)],
  // L'onglet « Colis » de la barre du bas EST l'écran des achats (`ONGLET_ACHATS`) : `?tab=colis` ouvre Ma journée.
  ['achats', 'Colis (achats)', () => /achat|colis/i.test(document.body.innerText)],
  ['compta', 'Argent', () => /argent|bénéfice|déclar|vendu/i.test(document.body.innerText)],
  ['messages', 'Messages', () => /message|offre/i.test(document.body.innerText)],
];
const CLS_MAX = 0.05;
// « Chargement… », « Lecture en cours… », « lecture… » (la raison d'un chiffre pas encore lu, écrite en toutes lettres).
const MOTS_CHARGEMENT = /(?:chargement|loading|cargando|caricamento|wird geladen|lecture en cours|\blecture)\s?(?:…|\.\.\.)/i;

// La sonde posée dans la page AVANT tout script de l'app.
function sonde(motsSource) {
  const mots = new RegExp(motsSource, 'i');
  const S = window.__chg = { shifts: [], chargement: [], zerosVus: [], t0: performance.now() };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) S.shifts.push({ t: Math.round(e.startTime), v: e.value, src: (e.sources || []).slice(0, 3).map((s) => { const n = s.node; if (!n || !n.closest) return ''; const el = n.nodeType === 1 ? n : n.parentElement; return el ? (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) : ''; }) }); } }).observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
  const zeros = [];
  const RE_ZERO = /^\s*[-−]?0(?:[,.]00)?\s?€\s*$/;
  const tour = () => {
    if (!document.body) return;
    // Texte VU seulement : ni un nœud caché, ni un texte pour lecteur d'écran (rogné à 1 px), ni un texte transparent
    // (un squelette garde le texte dans la page, encre transparente — src/styles-chiffre-attente.css).
    const vu = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const r = el.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) return false;
      for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0 || p.getAttribute('aria-hidden') === 'true' && p.classList.contains('vrm-attente-cache')) return false; }
      const cs = getComputedStyle(el);
      if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)') return false;
      if (el.closest('#vrm-demarrage')) return false;
      return true;
    };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) {
      const m = mots.exec(n.nodeValue || '');
      if (m && vu(n.parentElement) && S.chargement.length < 50) S.chargement.push({ t: Math.round(performance.now()), extrait: (n.nodeValue || '').trim().slice(0, 60) });
      if (!RE_ZERO.test(n.nodeValue || '')) continue;
      const el = n.parentElement; if (!vu(el)) continue;
      if (!zeros.some((z) => z.n === n)) zeros.push({ n, el, t: Math.round(performance.now()) });
    }
  };
  const boucle = () => { try { tour(); } catch (_) {} setTimeout(boucle, 80); };
  document.addEventListener('DOMContentLoaded', boucle);
  // Au calme : un 0 € vu pendant le chargement, dont le même nœud (ou son élément) dit
  // maintenant un AUTRE montant ⇒ le 0 était un « pas encore su ».
  window.__chgBilan = () => {
    const faux = [];
    for (const z of zeros) {
      const maintenant = z.n.isConnected ? z.n.nodeValue : (z.el.isConnected ? z.el.textContent : null);
      if (maintenant != null && /\d/.test(maintenant) && !RE_ZERO.test(maintenant) && /€/.test(maintenant)) faux.push({ t: z.t, devenu: maintenant.trim().slice(0, 30) });
    }
    // CLS « comme Chrome » : la plus grosse fenêtre de session.
    let cls = 0, cur = 0, debut = -1, prec = -1;
    for (const s of S.shifts) {
      if (prec >= 0 && s.t - prec < 1000 && s.t - debut < 5000) cur += s.v; else { cur = s.v; debut = s.t; }
      prec = s.t; if (cur > cls) cls = cur;
    }
    const total = S.shifts.reduce((a, s) => a + s.v, 0);
    return { cls: Math.round(cls * 1000) / 1000, total: Math.round(total * 1000) / 1000, sauts: S.shifts.filter((s) => s.v > 0.001).length, gros: S.shifts.filter((s) => s.v > 0.01).map((s) => ({ t: s.t, v: Math.round(s.v * 1000) / 1000, src: s.src })), chargement: S.chargement.slice(0, 3), nChargement: S.chargement.length, zeros: faux };
  };
}

async function mesurer(V, b, ecran, dossier) {
  const [tab, nom, attendre] = ecran;
  const captures = [];
  // t0 = la fin de l'écran de démarrage (`window.__vrmDemarrage`, src/demarrage.js) : la première image de l'APP.
  const pendant = async (pg, _t, quand) => {
    const pre = quand === 'deuxieme' ? '2-' : '';
    let fin = null;
    for (let i = 0; i < 1600 && fin == null; i++) {
      fin = await pg.evaluate(() => (window.__vrmDemarrage ? window.__vrmDemarrage.fin : null)).catch(() => null);
      if (fin == null) await new Promise((r) => setTimeout(r, 25));
    }
    if (!dossier) return fin;
    const t0 = Date.now();
    for (const [lib, ms] of [['t0', 0], ['300ms', 300], ['1s', 1000], ['2s', 2000]]) {
      const reste = ms - (Date.now() - t0); if (reste > 0) await new Promise((r) => setTimeout(r, reste));
      await pg.screenshot({ path: path.join(dossier, `${pre}${tab}-${lib}.png`) }).catch(() => {});
    }
    return fin;
  };
  const r = await V.ouvrir(b, { width: 390, height: 844 }, tab, attendre, null, {
    initScript: `(${sonde.toString()})(${JSON.stringify(MOTS_CHARGEMENT.source)})`,
    pendant,
    deuxieme: true,
    capture: dossier ? path.join(dossier, `2-${tab}-final.png`) : null,
    apres: (pg) => pg.evaluate(() => window.__chgBilan ? window.__chgBilan() : null),
    // La 1re ouverture (appareil neuf) : son bilan et sa capture finale, AVANT le rechargement.
    avantDeuxieme: async (pg) => { if (dossier) await pg.screenshot({ path: path.join(dossier, `${tab}-final.png`) }).catch(() => {}); return pg.evaluate(() => window.__chgBilan ? window.__chgBilan() : null).catch(() => null); },
  });
  const bil = (req) => { const g = req.filter((x) => x.m === 'GET'); return { calme: g.length ? Math.max(...g.map((x) => x.fin)) : 0, lectures: g.length, octets: g.reduce((a, x) => a + x.octets, 0) }; };
  const neuf = { ouverture: 'appareil neuf', demarrage: r.observe, utile: r.utile, tombe: r.lu.tombe, ...bil(r.req), ...(r.avantDeuxieme || {}) };
  const d = r.deuxieme || {};
  const deux = { ouverture: '2e ouverture', demarrage: d.observe, utile: d.utile, tombe: !!(d.lu && d.lu.tombe), ...bil(d.req || []), ...(r.apres || {}) };
  return { tab, nom, neuf, deux, errs: r.errs.slice(0, 3) };
}

const PRE = process.env.CHARGEMENT_PLANCHE_OUVERTURE === 'neuf' ? '' : '2-';
async function planches(avant, apres, sortie) {
  const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
  require('./_porte-banc.cjs');
  fs.mkdirSync(sortie, { recursive: true });
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 5 * 210 + 140, height: 2 * 470 + 120 } });
  const img = (d, f) => { const p = path.join(d, f); return fs.existsSync(p) ? 'data:image/png;base64,' + fs.readFileSync(p).toString('base64') : ''; };
  for (const [tab, nom] of ECRANS_TOUS) {
    if (!fs.existsSync(path.join(avant, `${PRE}${tab}-final.png`)) && !fs.existsSync(path.join(apres, `${PRE}${tab}-final.png`))) continue;
    const ligne = (d, lib) => `<div class="l"><b>${lib}</b>${['t0', '300ms', '1s', '2s', 'final'].map((t) => `<figure><img src="${img(d, `${PRE}${tab}-${t}.png`)}"><figcaption>${t}</figcaption></figure>`).join('')}</div>`;
    await pg.setContent(`<style>body{margin:0;padding:16px;font:14px system-ui;background:#DFE1E5;color:#16181D}h1{font-size:18px;margin:0 0 8px}.l{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}.l b{writing-mode:vertical-rl;transform:rotate(180deg);font-size:15px}figure{margin:0;width:200px}img{width:200px;height:433px;object-fit:cover;object-position:top;border:1px solid #9aa0a8;border-radius:8px;background:#fff}figcaption{text-align:center;font-size:12px}</style><h1>${nom} — ${PRE ? '2e ouverture (copies rangées sur l\'appareil)' : 'appareil neuf'} · t0 = fin de l\'écran de démarrage · réponses ralenties à ${process.env.VITESSE_RTT} ms</h1>${ligne(avant, 'AVANT')}${ligne(apres, 'APRÈS')}`);
    await pg.screenshot({ path: path.join(sortie, `planche-${PRE}${tab}.png`), fullPage: true });
    console.log('  planche', path.join(sortie, `planche-${PRE}${tab}.png`));
  }
  await b.close();
}

if (require.main === module) (async () => {
  if (process.env.CHARGEMENT_PLANCHE) { const [a, p, s] = process.env.CHARGEMENT_PLANCHE.split(','); return planches(a, p, s); }
  const V = require('./vitesse.cjs');
  await V.demarrer();
  const voulus = process.env.ECRANS ? process.env.ECRANS.split(',') : null;
  const ecrans = ECRANS_TOUS.filter((e) => !voulus || voulus.includes(e[0]));
  const dossier = process.env.CHARGEMENT_CAPTURES ? path.resolve(process.env.CHARGEMENT_CAPTURES) : null;
  if (dossier) fs.mkdirSync(dossier, { recursive: true });
  const b = await V.chromium.launch({ executablePath: process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--no-sandbox'] });
  let ko = 0; const res = [];
  console.log(`CHARGEMENT STRUCTURÉ — 390 px, réponses à ${process.env.VITESSE_RTT} ms`);
  for (const e of ecrans) {
    const m = await mesurer(V, b, e, dossier);
    res.push(m);
    for (const o of [m.neuf, m.deux]) {
      const fautes = [];
      if (o.tombe) fautes.push('écran tombé');
      if (o.nChargement) fautes.push(`texte de chargement visible (${o.nChargement} relevés : « ${(o.chargement[0] || {}).extrait} »)`);
      if (o.zeros && o.zeros.length) fautes.push(`${o.zeros.length} montant(s) à 0 € pendant le chargement (devenu ${o.zeros.map((z) => z.devenu).join(' · ')})`);
      if (o.cls == null) fautes.push('CLS non mesuré');
      else if (o.cls > CLS_MAX) fautes.push(`CLS ${o.cls} > ${CLS_MAX}`);
      if (fautes.length) ko++;
      console.log(`${fautes.length ? '  ❌' : '  ✅'} ${m.nom.padEnd(12)} ${o.ouverture.padEnd(14)} CLS ${String(o.cls).padEnd(6)} · ${String(o.sauts).padStart(3)} sauts · démarrage fini ${o.demarrage ?? '—'} ms · utile ${o.utile ?? '—'} ms · calme ${o.calme} ms · ${o.lectures} lectures`);
      for (const f of fautes) console.log('       ' + f);
      if (process.env.CHARGEMENT_DETAIL) for (const g of (o.gros || [])) console.log(`         saut ${g.v} à ${g.t} ms ← ${g.src.join(' | ')}`);
    }
  }
  await b.close(); await V.fermer();
  if (process.env.CHARGEMENT_JSON) fs.writeFileSync(process.env.CHARGEMENT_JSON, JSON.stringify(res, null, 1));
  console.log(ko ? `❌ ${ko} écran(s) au chargement déstructuré` : '✅ chaque écran se charge structuré');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

module.exports = { ECRANS_TOUS, sonde };
