require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « JAUGE ET JOURNAL » (10 nov., lot G, extension 5.337) — 390 px tactile ET
//  1512 px, clair ET sombre. Données INVENTÉES (le jeu de `nouveau-vendeur.cjs` :
//  comptes 111 « vendeuse_a » et 222 « vendeuse_b ») ; rien n'est écrit ailleurs.
//   G. Paramètres → Mon compte → « Ce que VRM a fait » : en tête, la jauge de CHAQUE
//      compte, lue sur les lignes `actions_compte_*` servies dans la VRAIE forme
//      (projection `ts:data->ts`) — 111 : 12 actions de deux Chrome (dont une de plus
//      d'une heure, écartée) ⇒ « 12/50 cette heure · repart à … » ; 222 : aucune ligne
//      ⇒ « — » (pas su), jamais « 0 » ; un 3ᵉ cas à 45 ⇒ ambre (VRM attend).
//   J. Les gestes notés par l'extension (servis par /api/compte?mode=journal) :
//      « Prix baissé · N°… · 60 € → 54 € », « Offre acceptée automatiquement », chacun
//      avec sa preuve ; rien ne déborde ; 44 px au doigt ; aucune erreur.
//  Captures : SHOTS (défaut <tmp>/banc-jauge-journal) — à REGARDER (§6.2).
//  BANC_PORT : le port du jeu (nouveau-vendeur.cjs le lit).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-jauge-journal');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const N1 = 'aaaaaaaaaaaaaaaa', N2 = 'bbbbbbbbbbbbbbbb';

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) for (const cas of ['normal', 'plein', 'prudence']) {
      const tag = `${W}-${theme}-${cas}`, sombre = theme === 'sombre';
      const t = Date.now();
      const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
      const ts1 = cas === 'plein' ? Array.from({ length: 45 }, (_, i) => t - 30 * 60000 - i * 1000) : Array.from({ length: 9 }, (_, i) => t - 40 * 60000 + i * 60000);
      lignes.push({ id: `actions_compte_111_${N1}`, data: { uid: '111', nav: N1, ts: ts1.concat([t - 70 * 60000]), at: new Date(t).toISOString(), max: 50, reserve: 5, v: '5.337.0', ...(cas === 'prudence' ? { prudence: t + 5 * 3600000, maxPrudence: 20 } : {}) } });
      if (cas === 'normal') lignes.push({ id: `actions_compte_111_${N2}`, data: { uid: '111', nav: N2, ts: [t - 5 * 60000, t - 4 * 60000, t - 3 * 60000], at: new Date(t).toISOString() } });
      lignes.push({ id: `actions_compte_1110_${N1}`, data: { uid: '1110', nav: N1, ts: [t - 1000, t - 2000] } });   // le piège du LIKE
      const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base, tab: 'settings' });
      const P = 'Noté par l’extension au moment du geste';
      await pg.route('**/api/compte?mode=journal', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pasLu: [], nonJournalise: [], evenements: [
        { at: t - 10 * 60000, type: 'baisse_prix', site: 'vinted', compte: '111', cle: { item: '51003', tx: null }, resultat: 'ok', source: 'extension', prix: { de: 60, vers: 54 }, preuve: P },
        { at: t - 20 * 60000, type: 'offre_acceptee', site: 'vinted', compte: '111', cle: { item: null, tx: '62001' }, resultat: 'ok', source: 'extension', auto: true, prix: { p: 52 }, preuve: P },
        { at: t - 30 * 60000, type: 'message_envoye', site: 'vinted', compte: '222', cle: { item: null, tx: '62002' }, resultat: 'ok', source: 'extension', preuve: P },
      ] }) }));
      await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
      await pg.click('[data-onglets-reglages] [data-vue="compte"]').catch(() => {}); await attendre(400);
      await pg.click('[data-sous-ouvrir="journal-vrm"]').catch((e) => dit(false, `G ${tag} : « Ce que VRM a fait » s’ouvre`, e.message.split('\n')[0]));
      await pg.waitForSelector('[data-jauges-comptes] [data-jauge-actions="111"]:not([data-jauge-n="lecture"])', { timeout: 8000 }).catch(() => {});
      await pg.waitForSelector('[data-journal-ligne]', { timeout: 8000 }).catch(() => {});
      await attendre(300);
      const v = await pg.evaluate(() => {
        const hote = document.querySelector('[data-sous-ecran="journal-vrm"]:not([hidden])') || document;
        const j = (u) => { const e = hote.querySelector(`[data-jauges-comptes] [data-jauge-actions="${u}"]`); return e ? { n: e.getAttribute('data-jauge-n'), ton: e.getAttribute('data-ton'), txt: e.innerText.replace(/\s+/g, ' '), couleur: getComputedStyle(e.querySelector('.vrm-jauge-plein')).backgroundColor } : null; };
        const cibles = [...hote.querySelectorAll('button, a, [role="button"]')].filter((b) => b.getClientRects().length).map((b) => ({ h: b.getBoundingClientRect().height, t: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 30) }));
        return { j111: j('111'), j222: j('222'), comptes: hote.querySelector('[data-jauges-comptes]') && hote.querySelector('[data-jauges-comptes]').getAttribute('data-jauges-comptes'),
          lignes: [...hote.querySelectorAll('[data-journal-ligne]')].map((l) => ({ type: l.getAttribute('data-journal-ligne'), preuve: (l.querySelector('[data-journal-preuve]') || { getAttribute: () => null }).getAttribute('data-journal-preuve'), txt: l.innerText.replace(/\s+/g, ' ') })),
          petits: cibles.filter((c) => c.h > 0 && c.h < 43.5), deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
          coupees: [...hote.querySelectorAll('.vrm-jauge-texte, .vrm-jauge-nom')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 40)) };
      });
      if (cas === 'normal') {
        dit(v.j111 && v.j111.n === '12' && /12\/50 cette heure/.test(v.j111.txt) && /repart à \d{1,2} h \d{2}/.test(v.j111.txt) && v.j111.ton !== 'geste', `G ${tag} : vendeuse_a = 12/50 (deux Chrome additionnés, l’action de plus d’1 h écartée, ni le compte 1110) · repart à …`, v.j111);
        dit(v.j222 && v.j222.n === 'pas-su' && /—/.test(v.j222.txt) && !/0\/50/.test(v.j222.txt), `G ${tag} : vendeuse_b sans ligne publiée ⇒ « — » (pas su), jamais 0/50`, v.j222);
        dit(v.comptes === '2', `G ${tag} : une rangée par compte Vinted`, v.comptes);
        const bp = v.lignes.find((l) => l.type === 'baisse_prix'), oa = v.lignes.find((l) => l.type === 'offre_acceptee');
        dit(bp && /Prix baissé/.test(bp.txt) && /60 € → 54 €/.test(bp.txt) && bp.preuve === 'oui', `J ${tag} : « Prix baissé · … · 60 € → 54 € » avec sa preuve`, bp);
        dit(oa && /Offre acceptée \(auto\)/.test(oa.txt) && /52 €/.test(oa.txt) && /commande 62001/.test(oa.txt), `J ${tag} : « Offre acceptée (auto) · commande 62001 · 52 € »`, oa);
        dit(v.lignes.length === 3, `J ${tag} : les 3 gestes de l’extension`, v.lignes.map((l) => l.type));
      } else if (cas === 'prudence') {
        // (11 nov., ext. 5.357) Un refus de Vinted il y a peu : 24 h de prudence, publiée par l'extension.
        dit(v.j111 && v.j111.n === '9' && /9\/20 cette heure/.test(v.j111.txt) && /Prudence jusqu’à \d{1,2} h \d{2}/.test(v.j111.txt) && v.j111.ton === 'geste', `G ${tag} : prudence ⇒ « 9/20 cette heure · Prudence jusqu’à … » en ambre`, v.j111);
      } else {
        dit(v.j111 && v.j111.n === '45' && v.j111.ton === 'geste' && /VRM attend/.test(v.j111.txt) && /^rgb\((178, 80, 0|255, 179, 64)\)$/.test(v.j111.couleur), `G ${tag} : 45/50 ⇒ ambre « VRM attend · repart à … »`, v.j111);
      }
      dit(!v.deborde && !v.coupees.length, `G ${tag} : rien ne déborde ni n’est coupé`, { deborde: v.deborde, coupees: v.coupees });
      if (tel) dit(!v.petits.length, `G ${tag} : 44 px au doigt`, v.petits);
      dit(!journal.erreurs.length, `G ${tag} : aucune erreur JS`, journal.erreurs);
      const haut = await pg.evaluate(() => { const h = document.querySelector('[data-sous-ecran="journal-vrm"]:not([hidden])'); return h ? Math.ceil(h.getBoundingClientRect().bottom + 160) : 0; });
      const vp = pg.viewportSize();
      if (haut > vp.height) { await pg.setViewportSize({ width: vp.width, height: Math.min(haut, 4000) }); await attendre(400); }
      await pg.screenshot({ path: path.join(SHOTS, `jauge-journal-${tag}.png`) });
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(`\nCaptures : ${SHOTS}`);
  console.log(ko ? `${ko} KO` : 'Tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
