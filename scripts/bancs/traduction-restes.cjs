// ════════════════════════════════════════════════════════════════════════════
//  BANC « TRADUCTION, LES RESTES » (16 nov., lot traduction-restes). Données INVENTÉES :
//  le jeu du banc `nouveau-vendeur`, servi par SON harnais (aucune écriture ne sort).
//   R1 le FRANÇAIS affiché ne change pas d'un mot : le texte de `.vrm-main` de chaque écran
//      (Ma journée, Annonces, Ventes, Stock, Achats, Argent, Paramètres) est relevé et écrit
//      dans `RELEVE=<fichier.json>` ; avec `COMPARER=<relevé d'un autre build>`, chaque écran
//      doit être IDENTIQUE (l'heure affichée mise à part) ;
//   R2 en anglais, aucune clé brute des lots traduits (qdn.*, qd.*, pga.*, mv.*, fe.*,
//      bordFrais.*, periode.*) à l'écran, et rien ne déborde à droite ;
//   R3 captures (`SHOTS=<dossier>`) à REGARDER : fr et en, 390 px tactile et 1512 px.
//  `BANC_DIST=<build>` : le build servi (un build de main pour le relevé « avant »).
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || String(9400 + Math.floor(Math.random() * 500));
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const SHOTS = process.env.SHOTS || '';
const RELEVE = process.env.RELEVE || '';
const COMPARER = process.env.COMPARER || '';
const ECRANS = String(process.env.ECRANS || 'journee,annonces,ventes,garage,achats,compta,settings').split(',');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 700) : ''}`); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
// L'heure et les durées relatives bougent d'un relevé à l'autre : elles ne sont pas du texte d'écran.
const net = (t) => String(t || '').replace(/\s+/g, ' ').replace(/\b\d{1,2}[:h]\d{2}\b/g, 'HH:MM').replace(/il y a \d+ (?:s|min|h|j)\b/g, 'il y a N').trim();

async function ecran(nav, l, W, tab) {
  try { return await ecranBrut(nav, l, W, tab); } catch (e) { return { texte: '', brutes: [], debord: false, lang: '', erreur: String(e.message || e).slice(0, 200) }; }
}
async function ecranBrut(nav, l, W, tab) {
  const base = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
  base.lignes.find((x) => x.id === 'main').data.vrm_langue = l;
  const o = await NV.ouvrir(nav, { W, sombre: false, base, tab });
  const pg = o.pg;
  await pg.evaluate((l) => { try { localStorage.setItem('vrm_langue', JSON.stringify(l)); } catch (_) {} }, l);
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await attendre(3000);
  const r = await pg.evaluate(() => {
    const m = document.querySelector('.vrm-main');
    const t = (m ? m.innerText : document.body.innerText) || '';
    const brutes = [...new Set((t.match(/\b(?:qdn|qd|pga|mv|fe|bordFrais|periode)\.[\w.-]+\b/g) || []))];
    return { texte: t, brutes, debord: document.documentElement.scrollWidth > innerWidth + 1, lang: document.documentElement.lang };
  });
  await capture(pg, `restes-${l}-${W}-${tab}`);
  await o.ctx.close().catch(() => {});
  return r;
}

(async () => {
  await new Promise((r) => NV.srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const releve = {};
  try {
    for (const W of LARGEURS) {
      for (const tab of ECRANS) {
        const fr = await ecran(nav, 'fr', W, tab);
        if (fr.erreur) dit(false, `[fr ${W}px] ${tab} : la page tient`, fr.erreur);
        releve[`${W}:${tab}`] = net(fr.texte);
        dit(fr.lang === 'fr' && fr.texte.length > 20, `[fr ${W}px] ${tab} : l'écran se rend en français (${fr.texte.length} caractères)`, fr.lang);
        if (process.env.SANS_EN !== '1') {
          const en = await ecran(nav, 'en', W, tab);
          if (en.erreur) dit(false, `[en ${W}px] ${tab} : la page tient`, en.erreur);
          dit(en.lang === 'en' && !en.brutes.length, `[en ${W}px] ${tab} : aucune clé brute des lots traduits`, en.brutes.join(', '));
          dit(!en.debord, `[en ${W}px] ${tab} : rien ne déborde à droite`);
        }
      }
    }
    if (RELEVE) { fs.writeFileSync(RELEVE, JSON.stringify(releve, null, 1)); console.log(`relevé écrit : ${RELEVE}`); }
    if (COMPARER) {
      const avant = JSON.parse(fs.readFileSync(COMPARER, 'utf8'));
      for (const k of Object.keys(releve)) {
        const a = avant[k], b = releve[k];
        if (a == null) { dit(false, `R1 ${k} : absent du relevé d'avant`); continue; }
        let i = 0; while (i < a.length && a[i] === b[i]) i++;
        dit(a === b, `R1 ${k} : le français affiché est identique, mot pour mot (${b.length} caractères)`, `écart à ${i} : avant « ${a.slice(Math.max(0, i - 60), i + 80)} » ⇒ après « ${b.slice(Math.max(0, i - 60), i + 80)} »`);
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'} banc traduction-restes : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
