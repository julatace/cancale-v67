// ════════════════════════════════════════════════════════════════════════════
// BANC « IDÉES 154-158 » (14 nov.) — les VRAIS composants et les VRAIES règles, montés seuls
// (harnais esbuild : scripts/bancs/idees-paires/harnais.jsx), données INVENTÉES, aucun réseau.
// 390 px tactile et 1512 px, clair et sombre. Exige :
//   temps  : la ligne de temps de N°7 (parmi 50 paires au même titre) : achetée … versement,
//            dans l'ordre des dates, chaque preuve ; « date inconnue » pour Leboncoin sans date ;
//            les onglets « Par étape » · « Dans l'ordre » ≥ 44 px ;
//   note   : « 3 points à corriger › » sur l'annonce 11 (lien vers SA page « modifier ») ;
//            « Description courte », « Prix sous l'achat » nommés ; la plus mal notée d'abord ;
//   modele : les cases vides demandées (modèle, boîte) ; l'aperçu se remplit ; dernière ligne
//            « N°51 » (il numérote lui-même) ; « Mettre dans la fiche » rend le texte ;
//   taille : « 43 » ⇒ titre « … 43 », « Taille 43 », étiquette N°7 retirée ; « Créer la fiche »
//            rend taille / titre / description ; aucun N° proposé avant la création ;
//   heure  : « le dimanche, entre 18 h et 21 h », « sur 412 ventes datées à l'heure », « 12 sans
//            heure » ; le lien met un dimanche 18 h dans le champ, rien ne part ; sous le seuil ⇒
//            « pas assez de ventes » ;
//   partout : rien ne déborde, aucun violet, aucun rouge, cibles ≥ 44 px ; captures dans SHOTS.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_garde-reseau.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = process.env.RACINE_BANC || path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const PORT = Number(process.env.BANC_PORT) || 4693;
const SHOTS = process.env.SHOTS || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : ''}`); };

function batir() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-idees-'));
  const script = path.join(out, 'b.cjs');
  fs.writeFileSync(script, `require(${JSON.stringify(path.join(NM, 'esbuild'))}).build({ entryPoints: [${JSON.stringify(path.join(RACINE, 'scripts/bancs/idees-paires/harnais.jsx'))}], bundle: true, outdir: ${JSON.stringify(out)}, entryNames: 'h', jsx: 'automatic', loader: { '.js': 'jsx' }, nodePaths: [${JSON.stringify(NM)}], define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' }, logLevel: 'error' }).catch((e) => { console.error(e); process.exit(1); });`);
  execFileSync(process.execPath, [script], { stdio: 'inherit' });
  return out;
}

// Ce qui se mesure sur chaque scène : débordement, cibles, couleurs interdites.
const MESURE = () => {
  const vw = document.documentElement.clientWidth;
  const deb = document.scrollingElement.scrollWidth > vw + 1;
  // Les cibles DESSINÉES ICI (.vrm-idees, la note) — les filtres d'« À compléter » tiennent leur taille des styles
  // globaux de l'app (.vrm-filtres), absents de ce harnais : ils ne sont pas jugés ici.
  const cibles = [...document.querySelectorAll('.vrm-idees button, .vrm-idees a[href], .vrm-idees input, .vrm-idees textarea, [data-na-note], [data-rp-heure]')].filter((e) => e.getClientRects().length && !e.closest('[data-vue-etapes]'))
    .map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), t: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30) }; })
    .filter((x) => x.h < 44 || (x.w < 44 && x.t.length <= 2));
  const rgb = (s) => (/rgba?\((\d+), (\d+), (\d+)/.exec(s) || []).slice(1).map(Number);
  const violet = [], rouge = [];
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    for (const v of [cs.color, cs.backgroundColor]) {
      const [r, g, b] = rgb(v); if (r == null) continue;
      if (r > 110 && b > 140 && g < 0.7 * Math.min(r, b)) violet.push(e.className || e.tagName);
      if (r > 150 && g < 80 && b < 80) rouge.push(e.className || e.tagName);
    }
  }
  const horsCadre = [...document.querySelectorAll('.vrm-idees *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1); }).map((e) => e.className || e.tagName).slice(0, 4);
  return { deb, cibles: cibles.slice(0, 6), violet: violet.slice(0, 3), rouge: rouge.slice(0, 3), horsCadre };
};

(async () => {
  const dist = batir();
  const page0 = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/h.css"></head><body><script src="/h.js"></script></body></html>`;
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0].split('#')[0];
    if (u === '/h.js' || u === '/h.css') { const f = path.join(dist, u.slice(1)); if (!fs.existsSync(f)) { r.writeHead(200, { 'content-type': 'text/css' }); r.end(''); return; } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/css' }); r.end(fs.readFileSync(f)); return; }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end(page0);
  }).listen(PORT, '127.0.0.1');
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const themes = (process.env.THEMES || 'clair,sombre').split(',');
  for (const [w, h, tactile] of [[390, 844, true], [1512, 900, false]]) for (const theme of themes) {
    const tag = `${w}/${theme}`;
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: tactile, isMobile: tactile, deviceScaleFactor: tactile ? 2 : 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const ouvrir = async (scene) => {
      const p = await ctx.newPage();
      const erreurs = []; p.on('pageerror', (e) => erreurs.push(String(e.message || e)));
      await p.goto(`http://127.0.0.1:${PORT}/#${scene}${theme === 'sombre' ? '-sombre' : ''}`);
      await p.waitForFunction(() => window.__pret === true, null, { timeout: 15000 });
      await p.waitForTimeout(250);
      return { p, erreurs };
    };
    const cap = async (p, nom) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `idees-${nom}-${w}-${theme}.png`), fullPage: true }); } };
    const propre = (m, quoi) => dit(!m.deb && !m.cibles.length && !m.violet.length && !m.rouge.length && !m.horsCadre.length, `${tag} ${quoi} : rien ne déborde, cibles ≥ 44 px, ni violet ni rouge`, m);

    // ── temps ───────────────────────────────────────────────────────────────
    { const { p, erreurs } = await ouvrir('temps');
      await p.waitForSelector('[data-ligne-temps][data-lt-studio="3"]', { timeout: 5000 }).catch(() => {});
      const r = await p.evaluate(() => {
        const evs = [...document.querySelectorAll('.vrm-lt-liste:not(.is-sans-date) [data-lt-quoi]')].map((e) => ({ q: e.dataset.ltQuoi, d: e.dataset.ltDate, id: e.dataset.ltId || '' }));
        const sans = [...document.querySelectorAll('[data-lt-groupe="sans-date"] [data-lt-quoi]')].map((e) => e.dataset.ltQuoi + ':' + (e.dataset.ltSite || ''));
        const onglets = [...document.querySelectorAll('[data-fiche-vue-choix]')].map((b) => ({ v: b.dataset.ficheVueChoix, h: Math.round(b.getBoundingClientRect().height), on: b.getAttribute('aria-pressed') }));
        const texte = document.querySelector('[data-ligne-temps]') ? document.querySelector('[data-ligne-temps]').innerText : '';
        return { evs, sans, onglets, texte, dernier: !!document.querySelector('.vrm-lt-ev.is-dernier[data-lt-quoi="versement"]') };
      });
      const quoi = r.evs.map((e) => e.q);
      const attendus = ['achetee', 'recue', 'photographiee', 'numerotee', 'publiee', 'baisse', 'hausse', 'vendue', 'bordereau', 'partie', 'relais', 'livree', 'versement'];
      dit(attendus.every((q) => quoi.includes(q)) && r.evs.every((e, i) => i === 0 || Date.parse(r.evs[i - 1].d) <= Date.parse(e.d)), `${tag} temps : les 13 étapes de N°7, dans l'ordre des dates`, quoi);
      dit(r.evs.filter((e) => e.id && e.q !== 'vendue').every((e) => e.id === '9000007') && r.evs.filter((e) => e.q === 'vendue').every((e) => e.id === '7000007'), `${tag} temps : seulement les identifiants de N°7 (parmi 50 paires au même titre)`, r.evs);
      dit(r.sans.includes('publiee:Leboncoin') && /Date inconnue/.test(r.texte) && /Photographiée · 3 photos/.test(r.texte) && /« Commande livrée » sur Vinted/.test(r.texte) && r.dernier, `${tag} temps : « date inconnue », 3 photos du studio, la preuve de la réception, le dernier point`, r.texte.slice(0, 300));
      dit(r.onglets.length === 2 && r.onglets.every((o) => o.h >= 44) && r.onglets.find((o) => o.v === 'temps').on === 'true', `${tag} temps : onglets « Par étape » · « Dans l'ordre » ≥ 44 px`, r.onglets);
      propre(await p.evaluate(MESURE), 'temps'); dit(!erreurs.length, `${tag} temps : aucune erreur`, erreurs);
      await cap(p, 'temps'); await p.close(); }

    // ── note ────────────────────────────────────────────────────────────────
    { const { p, erreurs } = await ouvrir('note');
      const r = await p.evaluate(() => ({
        ordre: [...document.querySelectorAll('[data-ac-annonce]')].map((e) => e.dataset.acAnnonce),
        n11: (document.querySelector('[data-ac-annonce="11"] [data-na-note]') || {}).textContent || '',
        lien11: (document.querySelector('[data-ac-annonce="11"] a[data-na-note]') || {}).href || '',
        man11: (document.querySelector('[data-ac-annonce="11"]') || {}).dataset ? document.querySelector('[data-ac-annonce="11"]').dataset.acManques : '',
        geste13: (document.querySelector('[data-ac-annonce="13"] [data-na-note]') || {}).dataset ? document.querySelector('[data-ac-annonce="13"] [data-na-note]').dataset.naGeste : '',
        txt: document.body.innerText,
        nonLue: (document.querySelector('[data-na-desc-pas-lue]') || {}).textContent || '',
      }));
      dit(r.ordre[0] === '11' && /3 points à corriger/.test(r.n11) && r.lien11 === 'https://www.vinted.fr/items/11/edit' && r.man11 === 'courte photos sousAchat', `${tag} note : « 3 points à corriger › » vers SA page « modifier », la plus mal notée d'abord`, r);
      dit(/Description courte \(14\/80\)/.test(r.txt) && /Prix sous l’achat/.test(r.txt) && r.geste13 === 'achat' && !r.ordre.includes('14') && /Description pas lue sur 1 annonce/.test(r.nonLue), `${tag} note : les deux points neufs nommés ; sans prix d'achat ⇒ la saisie ; rien sur une annonce sans point ; pas lue ⇒ dit`, r.ordre);
      if (tactile) { await p.tap('[data-ac-annonce="13"] [data-na-note]'); } else { await p.click('[data-ac-annonce="13"] [data-na-note]'); }
      dit(await p.evaluate(() => window.__prixAchat === '13'), `${tag} note : un toucher sur la note de 13 ouvre la saisie du prix d'achat de 13`);
      propre(await p.evaluate(MESURE), 'note'); dit(!erreurs.length, `${tag} note : aucune erreur`, erreurs);
      await cap(p, 'note'); await p.close(); }

    // ── modèle ──────────────────────────────────────────────────────────────
    { const { p, erreurs } = await ouvrir('modele');
      await p.click('[data-md-modele="m1"]');
      const cases = await p.$$eval('[data-md-case]', (l) => l.map((e) => e.dataset.mdCase));
      await p.fill('[data-md-case="modele"]', 'Dunk Low Panda');
      await p.fill('[data-md-case="boite"]', 'Avec boîte d’origine');
      const ap = await p.$eval('[data-md-apercu]', (e) => e.value);
      const lignes = ap.trim().split('\n'); const derniere = lignes[lignes.length - 1];
      dit(JSON.stringify(cases) === '["modele","boite"]' && ap.startsWith('Nike Dunk Low Panda · taille 43\nTrès bon état · Avec boîte d’origine') && derniere === 'N°51' && await p.$('[data-md-remplace]') !== null,
        `${tag} modèle : cases vides demandées, aperçu rempli, « N°51 » en dernière ligne, « remplace » dit`, { cases, ap });
      await cap(p, 'modele');
      await p.click('[data-md-poser]');
      dit(await p.evaluate(() => typeof window.__pose === 'string' && window.__pose.endsWith('N°51') && window.__ferme === true), `${tag} modèle : « Mettre dans la fiche » rend le texte et ferme`);
      propre(await p.evaluate(MESURE), 'modèle'); dit(!erreurs.length, `${tag} modèle : aucune erreur`, erreurs);
      await p.close(); }

    // ── autre taille ────────────────────────────────────────────────────────
    { const { p, erreurs } = await ouvrir('taille');
      const avant = await p.$eval('[data-at-creer]', (b) => b.disabled);
      await p.fill('[data-at-taille]', '43');
      const r = await p.evaluate(() => ({ titre: document.querySelector('[data-at-titre]').value, desc: document.querySelector('[data-at-description]').value,
        changes: document.querySelector('[data-at-changes]').dataset.atChanges, etiq: document.querySelector('[data-at-changes]').dataset.atEtiquette,
        num: /N°\s?24\d|N° neuf : \d/.test(document.body.innerText) }));
      dit(avant && r.titre === 'Nike Dunk Low Panda 43' && r.desc === 'Taille 43, semelle 28 cm.\nPortées deux fois, aucun défaut.' && r.changes === '1,1' && r.etiq === '1' && !r.num,
        `${tag} taille : titre et « Taille 43 » changés, « 28 cm » intact, N°7 retiré, aucun N° montré avant la création`, r);
      await cap(p, 'taille');
      await p.click('[data-md-modele="m2"]');
      const d2 = await p.$eval('[data-at-description]', (e) => e.value);
      await p.click('[data-at-creer]');
      await p.waitForFunction(() => !!window.__cree, null, { timeout: 5000 }).catch(() => {});
      const c = await p.evaluate(() => window.__cree);
      dit(d2 === 'Très bon état, taille 43.' && c && c.champs.taille === '43' && c.champs.titre === 'Nike Dunk Low Panda 43' && c.fin === 'Très bon état, taille 43.\n\nN°241',
        `${tag} taille : un modèle choisi ⇒ rempli à la nouvelle taille, puis avec le N° neuf à la création`, { d2, c });
      propre(await p.evaluate(MESURE), 'taille'); dit(!erreurs.length, `${tag} taille : aucune erreur`, erreurs);
      await p.close(); }

    // ── meilleure heure ─────────────────────────────────────────────────────
    { const { p, erreurs } = await ouvrir('heure');
      const r = await p.evaluate(() => ({ t: document.body.innerText, ok: !!document.querySelector('[data-meilleure-heure="ok"][data-mh-jour="6"][data-mh-debut="18"]'), couv: (document.querySelector('[data-mh-couverture]') || {}).dataset, peu: !!document.querySelector('[data-meilleure-heure="peu"]') }));
      dit(r.ok && /le dimanche, entre 18 h et 21 h/.test(r.t) && /sur 412 ventes datées à l’heure/.test(r.t) && /12 sans heure, pas comptées/.test(r.t) && r.peu && /pas assez de ventes datées à l’heure \(il en faut 30\)/.test(r.t),
        `${tag} heure : dimanche 18–21 h, la couverture, les ventes sans heure ; sous le seuil « pas assez »`, r.t.slice(0, 400));
      await p.click('[data-mh-choisir]');
      const v = await p.$eval('[data-rp-heure]', (e) => e.value);
      const d = v ? new Date(v) : null;
      dit(!!d && d.getDay() === 0 && d.getHours() === 18 && d.getTime() > new Date(2026, 10, 14, 12).getTime(), `${tag} heure : le lien met dimanche 18 h dans le champ (rien ne part)`, v);
      propre(await p.evaluate(MESURE), 'heure'); dit(!erreurs.length, `${tag} heure : aucune erreur`, erreurs);
      await cap(p, 'heure'); await p.close(); }
    await ctx.close();
  }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ banc idees-paires : ' + ko + ' rouge(s), ' + ok + ' vert(s)' : '✅ banc idees-paires : ' + ok + ' verts'}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
