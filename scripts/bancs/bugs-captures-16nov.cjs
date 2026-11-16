require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LES CAPTURES iPHONE DU 16 NOV. (lot bugs-captures-16nov) — jugé sur l'app RENDUE.
//  Récit : docs/passation/2026-11-16-bugs-captures.md.
//
//  Base inventée à la vraie forme (`_base-volume.cjs` : 3 comptes, 2 000 ventes — dont la plupart sans date de
//  versement, comme son compte aux 1 741 « à dater »), plus une publication « À trancher » posée sur l'appareil
//  (`vrm_a_trancher`) : 2 ventes Vestiaire reçues par SMS (aucune autre carte ne les dit).
//  On juge la RÈGLE (data-*, nombres, géométrie), pas un libellé :
//  T  Ma journée : la ligne « N choses à trancher » (`data-job="a-trancher"`, `data-n`) ne compte PAS ce qu'une autre
//     carte de Ma journée dit déjà (N° à écrire, annonces sans prix d'achat, colis à vérifier… `JOB_SOURCE`) ;
//  V  Ma journée : « Colis à vérifier » dit le GESTE (`data-job-geste`), les raisons comptées restent en infobulle ;
//  E  Ventes · À expédier : aucun titre coupé (il se lit en entier, règle de bancs-rouges-b fusionnée le 16 nov.) ;
//  O  fiche d'un colis, feuille « Plus » : aucun pictogramme de transporteur PAS LU seul à côté du bordereau ;
//  B  fiche d'un colis, feuille « Plus » : UN seul geste du bordereau visible (pas de tuile « Bordereau » en plus) ;
//  S  fiche, « Tout voir » → « L'état » : une même raison n'est pas écrite sous deux chiffres.
//  `LARGEURS=390,1512` `THEMES=clair,sombre` ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { fabriquer } = require('./_base-volume.cjs');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-bugs-captures-16nov');
fs.mkdirSync(SHOTS, { recursive: true });

function base() {
  const b = fabriquer({ comptes: 3, ventes: 2000 });
  const m = b.main[0].data; const at = '2026-11-01T10:00:00.000Z';
  Object.assign(m, { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at }, vrm_je_vends: { choix: 'sneakers', at }, vrm_configuration: { etat: 'fait', at, statut: null, version: 1 },
    vrm_plateformes_affichees: { sites: ['vinted'], at }, vrm_parcours: { etat: 'fini', at }, vrm_bilan_minute: { vu: at, fin: 'vu' } });
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.375.0', code: '5.375.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  return b;
}
const B = base();
// La même table que src/aTrancher.js `JOB_SOURCE` (recopiée : le banc juge l'écran, pas le module).
const JOB_SOURCE = { 'numeros-en-double': 'numeros-double', 'poste-sans-depart': 'colis-postes', 'retrait-a-verifier': 'colis-retirer', 'retrait-en-verification': 'colis-retirer',
  litige: 'litiges-en-cours', 'numeros-nouveaux': 'numeros-a-ecrire', 'achat-a-relier': 'achats-sans-prix', 'supprime-vinted': 'supprimes-vinted' };

let ok = 0, ko = 0; const rouges = [];
const dit = (cond, quoi, detail) => { if (cond) { ok++; console.log('  ✅', quoi); } else { ko++; rouges.push(quoi); console.log('  ❌', quoi, detail !== undefined ? '— ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''); } };
const vis = `(el) => !!el && el.getClientRects().length > 0 && (!el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) && el.getBoundingClientRect().height > 1`;

async function poserTrancher(pg) {
  await pg.evaluate((uid) => {
    const at = Date.now();
    let brut = null; try { brut = JSON.parse(localStorage.getItem('vrm_a_trancher') || 'null'); } catch (_) {}
    // L'uid de la publication : celui que l'app a écrit (ses écrans ont publié avant), sinon celui de la session.
    const u = brut && brut.uid ? brut.uid : uid;
    const s = brut && brut.s ? brut.s : {};
    s['sms-vestiaire'] = { n: 2, at };
    localStorage.setItem('vrm_a_trancher', JSON.stringify({ uid: u, s }));
  }, P.UID);
}
async function capture(pg, nom) { await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); }
async function defiler(pg, sel) { await pg.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'center' }); }, sel); await pg.waitForTimeout(500); }

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const t = `${W} ${th}`; const suf = `${W}-${th}`;
      console.log(`\n── ${t}`);
      // ── Ma journée ──
      {
        const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: B, url: '/?tab=journee' });
        try {
          await P.pret(o.pg);
          // La publication d'une source que l'écran propriétaire n'a pas ici (SMS Vestiaire), puis Ventes et Annonces
          // ouvertes une fois (elles publient leurs nombres sur l'appareil), puis retour sur Ma journée.
          for (const u of ['/?tab=cat_bord&onglet=envoyer', '/?tab=cat_annonces']) { await o.pg.goto(`http://localhost:${P.PORT}${u}`, { waitUntil: 'domcontentloaded' }); await P.pret(o.pg); }
          await poserTrancher(o.pg);
          await o.pg.goto(`http://localhost:${P.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await P.pret(o.pg);
          await o.pg.waitForSelector('[data-job]', { timeout: 20000 }).catch(() => {});
          await o.pg.waitForTimeout(2500);
          const r = await o.pg.evaluate(([JS, visTxt]) => {
            // Les cartes PRÉSENTES dans Ma journée (à 1512, la colonne « À faire » sous la ligne de flottaison n'est pas
            // mise en page tant qu'on n'y descend pas : présente compte, pas « vue à l'écran »).
            const jobs = [...document.querySelectorAll('[data-job]')].filter((x) => !x.closest('[hidden], [inert]'));
            const ids = new Set(jobs.map((j) => j.getAttribute('data-job')));
            let pubs = {}; try { pubs = (JSON.parse(localStorage.getItem('vrm_a_trancher') || '{}').s) || {}; } catch (_) {}
            const dites = new Set([...ids].map((i) => JS[i]).filter(Boolean));
            const att = Object.entries(pubs).filter(([k, v]) => !dites.has(k) && v && Number.isInteger(v.n)).reduce((t, [, v]) => t + v.n, 0);
            const dejaDits = Object.entries(pubs).filter(([k, v]) => dites.has(k) && v && Number(v.n) > 0).map(([k, v]) => k + ':' + v.n);
            const at = jobs.find((j) => j.getAttribute('data-job') === 'a-trancher');
            const verif = jobs.find((j) => /^retrait-(a-verifier|en-verification)$/.test(j.getAttribute('data-job')));
            return { ids: [...ids], att, dejaDits, n: at ? Number(at.getAttribute('data-n')) : 0, txt: at ? at.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '',
              verif: verif ? { geste: verif.getAttribute('data-job-geste'), txt: verif.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) } : null };
          }, [JOB_SOURCE, vis]);
          await defiler(o.pg, '[data-job^="retrait-"]'); await capture(o.pg, `journee-verifier-${suf}`);
          // (15 nov.) « À trancher » vit dans la feuille « Tout va bien ? » (sa ligne discrète, `data-tvb-ligne`).
          const tvb = await o.pg.$('[data-tvb-ligne]');
          if (tvb) { await tvb.scrollIntoViewIfNeeded().catch(() => {}); await tvb.click().catch(() => {}); await o.pg.waitForTimeout(1500); }
          const at = await o.pg.evaluate((visTxt) => { const vis = eval(visTxt); const a = [...document.querySelectorAll('[data-job="a-trancher"]')].filter(vis)[0];
            return a ? { n: Number(a.getAttribute('data-n')), txt: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) } : null; }, vis);
          if (at) { r.n = at.n; r.txt = at.txt; }
          r.tvb = !!tvb;
          console.log('   journée :', JSON.stringify(r));
          dit(r.dejaDits.length > 0 && r.att > 0, `T0 ${t} — la base a des sources déjà dites par une carte ET une autre (le contrôle peut échouer)`, r);
          dit(r.n === r.att, `T ${t} — « à trancher » = ${r.n} : seulement ce qu'aucune autre carte ne dit (attendu ${r.att})`, r);
          dit(!!r.verif && !!r.verif.geste, `V ${t} — « Colis à vérifier » dit le geste`, r.verif);
          await defiler(o.pg, '[data-job="a-trancher"]'); await capture(o.pg, `journee-trancher-${suf}`);
        } finally { await o.ctx.close(); }
      }
      // ── Ventes · À expédier, puis la fiche d'un colis ──
      {
        const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: B, url: '/?tab=cat_bord&onglet=envoyer' });
        try {
          await P.pret(o.pg);
          // Machine partagée et chargée : la liste peut arriver tard — on l'attend (jusqu'à 3 × 30 s, rechargée entre deux).
          for (let k = 0; k < 3; k++) {
            if (await o.pg.waitForFunction(() => [...document.querySelectorAll('.vv-liste .vrm-colis-titre')].some((x) => x.clientWidth > 0), null, { timeout: 30000 }).then(() => true, () => false)) break;
            await o.pg.reload({ waitUntil: 'domcontentloaded' }); await P.pret(o.pg);
          }
          await o.pg.evaluate(() => { const l = document.querySelector('.vv-liste [data-fiche-ligne], [data-fiche-ligne]'); if (l) l.scrollIntoView({ block: 'start' }); });
          await o.pg.waitForTimeout(1500);
          const e = await o.pg.evaluate((visTxt) => {
            const vis = eval(visTxt);
            const ts = [...document.querySelectorAll('.vv-liste .vrm-colis-titre')].filter((x) => x.getBoundingClientRect().width > 0).slice(0, 12);
            const coupes = ts.filter((x) => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 2).map((x) => x.textContent.trim());
            const lignes = ts.map((x) => Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x).lineHeight)));
            return { n: ts.length, coupes, lignes };
          }, vis);
          console.log('   à expédier :', JSON.stringify(e));
          dit(e.n > 0 && e.coupes.length === 0, `E ${t} — aucun titre coupé (${e.n} titres)`, e);
          await capture(o.pg, `expedier-${suf}`);
          await o.pg.waitForSelector('[data-fiche-ligne]', { timeout: 30000 }).catch(() => {});
          const l = (await o.pg.$$('[data-fiche-ligne]'))[0];
          if (!l) { dit(false, `F ${t} — une ligne de colis à ouvrir`); continue; }
          await l.click(); await o.pg.waitForTimeout(2500);
          const plus = await o.pg.$('[data-fd-plus-ouvrir]');
          dit(!!plus, `F ${t} — la fiche s'ouvre avec son « ⋯ »`);
          if (!plus) continue;
          await plus.click(); await o.pg.waitForTimeout(1500);
          // « Tout voir » ouvert puis refermé : la fiche a alors fini de lire (les tuiles d'un colis à poster arrivent).
          const tv = await o.pg.$('.fd-plus .fd-tout-s'); if (tv) { await tv.click(); await o.pg.waitForTimeout(1200); }
          const f = await o.pg.evaluate((visTxt) => {
            const vis = eval(visTxt);
            const feuille = document.querySelector('.fd-plus');
            const orph = [...feuille.querySelectorAll('.vrm-puce-transp[data-lu="0"]')].filter(vis).length;
            const tuileB = [...feuille.querySelectorAll('[data-fd-tuile="bordereau"]')].filter(vis).length;
            const ligneB = [...feuille.querySelectorAll('.vrm-fp-actions-ligne :is([data-imprime], [data-bordereau-bouton], .vrm-rangee-bord > button:not(.vrm-fu-plus))')].filter(vis).length;
            const smalls = [...feuille.querySelectorAll('.vrm-fp-etat-l dd small')].filter(vis).map((x) => x.textContent.trim());
            const doubles = smalls.filter((s, i) => smalls.indexOf(s) !== i);
            return { orph, tuileB, ligneB, etat: !!feuille.querySelector('[data-fiche-etat-article]'), doubles };
          }, vis);
          console.log('   fiche :', JSON.stringify(f));
          dit(f.orph === 0, `O ${t} — aucun pictogramme « transporteur pas lu » orphelin dans la feuille`, f);
          dit(f.ligneB >= 1 && f.tuileB === 0, `B ${t} — un seul geste du bordereau dans la feuille`, f);
          dit(f.etat && f.doubles.length === 0, `S ${t} — « L'état » : une même raison écrite une fois`, f);
          await o.pg.evaluate(() => { const f = document.querySelector('.fd-plus-f'); if (f) f.scrollTop = 0; });
          await capture(o.pg, `fiche-plus-${suf}`);
          await defiler(o.pg, '[data-fiche-etat-article]'); await capture(o.pg, `fiche-etat-${suf}`);
        } finally { await o.ctx.close(); }
      }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌${rouges.length ? '\n  ' + rouges.join('\n  ') : ''}\ncaptures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
