require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
process.env.BANC_REGLAGES_SANS_AIDE = '1';   // ce banc juge le chemin du vendeur À LA MAIN (pas l'aide des bancs d'avant)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  PARAMÈTRES EN DIX CATÉGORIES (15 nov.) — ce qu'on MESURE, sur l'app RENDUE.
//  Julien : « je veux que les paramètres soient améliorés », « pratique et compréhensible »,
//  « un meilleur visuel ». Récit : docs/passation/2026-11-15-parametres.md.
//    S structure  — 390 : le premier écran porte les catégories (10, dont « Sécurité des
//                   données » à part), AUCUNE rangée de réglage, et tient court (la dernière
//                   catégorie au plus à 1,25 écran) ; 1512 : le sommaire (10) + les 10 catégories ;
//    C catégories — 390 : chaque catégorie s'ouvre au doigt (sa rangée), montre ses rangées,
//                   « ‹ Paramètres » ramène au premier écran ; chaque PANNEAU d'une catégorie
//                   s'ouvre (`[data-sous-ecran]` visible), et « ‹ » ramène à SA catégorie ;
//    D débord     — rien ne dépasse la largeur de l'écran (premier écran, catégories, panneaux) ;
//    V chevauche  — dans une rangée, le nom et la valeur ne se recouvrent pas ; deux rangées non plus ;
//    T cibles     — 390 tactile : chaque rangée, retour, champ de recherche ≥ 44 px de haut ;
//    L liens      — chaque ancien lien profond (`LIENS_PROFONDS`, relevé dans le code) ouvre le
//                   bon réglage : son panneau visible, ou sa rangée ;
//    R recherche  — des mots de vendeur (« papier », « URSSAF », « numéro », « mot de passe »,
//                   « supprimer mon compte », « double »…) trouvent CHACUN le bon réglage, et le
//                   toucher l'ouvre ; un mot sans réponse le dit ;
//    A alerte     — « Tout va bien ? » en tête quand l'extension est en retard (base du banc :
//                   5.375 < attendue), UN geste, qui ouvre le panneau « Tout va bien ? ».
//  390 tactile ET 1512, clair ET sombre (C et L : 390 clair, le plus long). Base INVENTÉE
//  (`design-passe.cjs`), garde réseau. `BANC_DIST=` (avant/après), `SHOTS=`, `LARGEURS=`, `THEMES=`,
//  `PARTIES=S,C,D,V,T,L,R,A`. Un banc ne meurt pas, il rapporte.
//  Preuve : rouge sur origin/main (structure, recherche), vert après ; `MUTATION=1` coupe la
//  recherche dans « Mon compte » (le mot de passe ne se trouve plus : doit rougir).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const P = require('./design-passe.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-parametres');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = new Set(liste('PARTIES', 'S,C,D,V,T,L,R,A'));
const MUTATION = process.env.MUTATION === '1';
let ko = 0, n = 0;
const dit = (bon, quoi, detail) => { n++; if (!bon) ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400) : ''}`); };
const att = (pg, ms) => pg.waitForTimeout(ms);

// ── Mesures DANS la page ──
function mesurerEcran() {
  const W = window.innerWidth;
  const vis = (e) => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden';
  const racine = document.querySelector('.vrm-set');
  const out = { deborde: [], chevauche: [], petites: [] };
  if (!racine) return { ...out, absent: true };
  const nom = (e) => `${e.tagName.toLowerCase()}${e.getAttribute('data-sous-ouvrir') ? '[' + e.getAttribute('data-sous-ouvrir') + ']' : ''}${e.getAttribute('data-categorie-ouvrir') ? '[cat ' + e.getAttribute('data-categorie-ouvrir') + ']' : ''} « ${(e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 36)} »`;
  for (const e of racine.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    // Un élément qui DÉFILE de lui-même (rangée de puces, tableau) a le droit d'être plus large que son parent.
    let p = e.parentElement, defile = false; while (p && p !== racine) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { defile = true; break; } p = p.parentElement; }
    if (!defile && (r.right > W + 1 || r.left < -1)) out.deborde.push(`${nom(e)} ${Math.round(r.left)}→${Math.round(r.right)}`);
  }
  for (const l of racine.querySelectorAll('.vrm-set-ligne')) {
    if (!vis(l)) continue;
    const lib = l.querySelector('.vrm-set-lib'), val = l.querySelector('.vrm-set-val');
    if (lib && val && vis(val)) { const a = lib.getBoundingClientRect(), b = val.getBoundingClientRect(); if (a.right > b.left + 1 && a.bottom > b.top && b.bottom > a.top) out.chevauche.push(`nom/valeur ${nom(l)}`); }
    const s = l.nextElementSibling; if (s && s.classList.contains('vrm-set-ligne') && vis(s)) { const a = l.getBoundingClientRect(), b = s.getBoundingClientRect(); if (b.top < a.bottom - 1) out.chevauche.push(`rangées ${nom(l)} / ${nom(s)}`); }
  }
  // Les cibles de la STRUCTURE (rangées, retours, champ de recherche) — pas l'intérieur des panneaux d'avant.
  for (const e of racine.querySelectorAll('.vrm-set-ligne, [data-sous-retour], [data-categorie-retour], [data-recherche-reglages] input')) {
    if (!vis(e) || e.closest('[data-sous-ecran]')) continue;
    const r = e.getBoundingClientRect(); if (r.height < 43.5) out.petites.push(`${nom(e)} ${Math.round(r.height)} px`);
  }
  return out;
}
const etat = (pg) => pg.evaluate(() => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');
  const r = document.querySelector('.vrm-set');
  return {
    cat: r ? r.getAttribute('data-categorie-ouverte') || '' : null,
    sous: r ? r.getAttribute('data-sous-ecran-ouvert') || '' : null,
    cats: [...document.querySelectorAll('[data-categorie-ouvrir]')].filter(vis).map((e) => e.getAttribute('data-categorie-ouvrir')),
    sections: [...document.querySelectorAll('[data-categorie-ecran]')].filter(vis).map((e) => e.getAttribute('data-categorie-ecran')),
    rangees: [...document.querySelectorAll('[data-sous-ouvrir]')].filter(vis).map((e) => e.getAttribute('data-sous-ouvrir')),
    panneaux: [...document.querySelectorAll('[data-sous-ouvrir][aria-haspopup="true"]')].filter(vis).map((e) => e.getAttribute('data-sous-ouvrir')),
    basDerniereCat: (() => { const l = [...document.querySelectorAll("[data-categorie-ouvrir]")].filter(vis).pop(); return l ? Math.round(l.getBoundingClientRect().bottom) : null; })(),
    alerte: (() => { const a = [...document.querySelectorAll('[data-reglages-alerte]')].find(vis); return a ? a.getAttribute('data-reglages-alerte') : null; })(),
    trouves: (() => { const t = [...document.querySelectorAll('[data-recherche-trouves]')].find(vis); return t ? Number(t.getAttribute('data-recherche-trouves')) : null; })(),
  };
});
const remonter = async (pg) => { for (let i = 0; i < 3; i++) { const b = pg.locator('[data-sous-retour]:visible, [data-categorie-retour]:visible').first(); if (!(await b.count())) return; await b.click(); await att(pg, 350); } };

(async () => {
  const C = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'parametres', 'categories.js')).href);
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const ouvrir = async (W, t, url = '/?tab=settings') => { const o = await P.ouvrir(nav, { W, sombre: t === 'sombre', b: P.base(), url }); await P.pret(o.pg); await o.pg.waitForSelector('.vrm-set', { timeout: 20000 }).catch(() => {}); await att(o.pg, 400); return o; };
  try {
    for (const W of LARG) for (const t of THEMES) {
      const tag = `${W} ${t}`;
      const o = await ouvrir(W, t);
      const pg = o.pg;
      await pg.screenshot({ path: path.join(SHOTS, `racine-${W}-${t}.png`) });
      const e0 = await etat(pg);
      // ── S. La structure ──
      if (PARTIES.has('S')) {
        if (W < 600) {
          dit(e0.cats.length === 10 && new Set(e0.cats).size === 10, `S ${tag} : le premier écran porte les dix catégories`, e0.cats);
          dit(!e0.rangees.length, `S ${tag} : aucune rangée de réglage sur le premier écran (elles vivent dans leur catégorie)`, e0.rangees.slice(0, 12));
          dit(e0.basDerniereCat != null && e0.basDerniereCat <= 844 * 1.25, `S ${tag} : le premier écran est court (la dernière catégorie finit à ${e0.basDerniereCat} px ≤ ${Math.round(844 * 1.25)})`, e0.basDerniereCat);
          dit(e0.cats[e0.cats.length - 1] === 'donnees', `S ${tag} : « Sécurité des données » (l’expert) est à part, en dernier`, e0.cats);
        } else {
          dit(e0.cats.length === 10, `S ${tag} : le sommaire porte les dix catégories`, e0.cats);
          dit(e0.sections.length === 10, `S ${tag} : les dix catégories sont dépliées à droite`, e0.sections);
        }
      }
      // ── A. « Tout va bien ? » en tête ──
      if (PARTIES.has('A') && !e0.cat) {
        dit(e0.alerte && /extension/.test(e0.alerte), `A ${tag} : « Tout va bien ? » en tête quand l’extension est en retard`, e0.alerte);
        const nGestes = await pg.locator('[data-reglages-alerte]:visible').count();
        dit(nGestes === 1, `A ${tag} : UNE rangée, un geste`, nGestes);
        if (e0.alerte) { await pg.locator('[data-reglages-alerte]').first().click(); await att(pg, 700); const e = await etat(pg); dit(e.sous === 'toutvabien', `A ${tag} : le geste ouvre « Tout va bien ? »`, e); await remonter(pg); }
      }
      // ── D / V / T sur le premier écran ──
      const juger = async (ou) => {
        const m = await pg.evaluate(mesurerEcran);
        if (PARTIES.has('D')) dit(!m.deborde.length, `D ${tag} · ${ou} : rien ne dépasse l’écran`, m.deborde.slice(0, 6));
        if (PARTIES.has('V')) dit(!m.chevauche.length, `V ${tag} · ${ou} : rien ne se chevauche`, m.chevauche.slice(0, 6));
        if (PARTIES.has('T') && W < 600) dit(!m.petites.length, `T ${tag} · ${ou} : cibles de 44 px`, m.petites.slice(0, 6));
        return m;
      };
      await juger('premier écran');
      // ── C. Chaque catégorie, chaque panneau (390) ──
      if (W < 600 && (PARTIES.has('C') || PARTIES.has('D'))) {
        const toutes = t === 'clair' ? e0.cats : e0.cats.slice(0, 4);
        for (const c of toutes) {
          { const ok = await pg.locator(`[data-categorie-ouvrir="${c}"]`).first().click({ timeout: 15000 }).then(() => true, (e) => { dit(false, `C ${tag} : toucher « ${c} »`, String(e.message).split('\n')[0]); return false; }); if (!ok) continue; }
          await att(pg, 500);
          const e = await etat(pg);
          dit(e.cat === c && e.rangees.length >= 1, `C ${tag} : « ${c} » s’ouvre au doigt (${e.rangees.length} rangées)`, e);
          await pg.screenshot({ path: path.join(SHOTS, `cat-${c}-${W}-${t}.png`), fullPage: false });
          await juger(`catégorie ${c}`);
          if (t === 'clair' && PARTIES.has('C')) for (const id of e.panneaux) {
            { const ok = await pg.locator(`[data-sous-ouvrir="${id}"]`).first().click({ timeout: 15000 }).then(() => true, (e) => { dit(false, `C ${tag} : toucher ${c} › ${id}`, String(e.message).split('\n')[0]); return false; }); if (!ok) continue; }
            await att(pg, 550);
            const s = await etat(pg);
            const visible = await pg.locator(`[data-sous-ecran="${id}"]`).first().isVisible().catch(() => false);
            dit(s.sous === id && visible, `C ${tag} : ${c} › ${id} s’ouvre`, s);
            const m = await pg.evaluate(mesurerEcran);
            if (m.deborde.length) dit(false, `D ${tag} · panneau ${id} : rien ne dépasse l’écran`, m.deborde.slice(0, 4));
            await pg.locator('[data-sous-retour]').first().click().catch(() => {});
            await att(pg, 350);
            const r = await etat(pg);
            dit(r.cat === c && !r.sous, `C ${tag} : « ‹ » ramène de ${id} à « ${c} »`, r);
          }
          await pg.locator('[data-categorie-retour]').first().click().catch(() => {});
          await att(pg, 350);
          const r = await etat(pg);
          dit(!r.cat && r.cats.length === 10, `C ${tag} : « ‹ Paramètres » ramène de « ${c} » au premier écran`, r);
        }
      }
      // ── R. La recherche ──
      if (PARTIES.has('R') && t === 'clair') {
        const CAS = [['papier', 'imprimante'], ['URSSAF', 'regime'], ['numéro', 'numeros'], ['mot de passe', 'motdepasse'], ['supprimer mon compte', 'fermer'], ['double vérification', 'double'], ['facture', 'abonnement'], ['vacances', 'vacances'], ['langue', 'langue'], ['sombre', 'apparence'], ['notification', 'push'], ['extension', 'verifier'], ['sauvegarde', 'export']];
        const champ = pg.locator('[data-recherche-reglages] input').first();
        let trouves = 0;
        for (const [q, id] of CAS) {
          if (MUTATION && id === 'motdepasse') { await champ.fill('zzz-mutation'); } else await champ.fill(q);
          await att(pg, 300);
          const e = await etat(pg);
          const vu = await pg.locator(`[data-reglage-id="${id}"]:visible`).count();
          if (vu && e.trouves >= 1) trouves++;
          dit(vu > 0 && e.trouves >= 1, `R ${tag} : « ${q} » trouve « ${id} » (${e.trouves} réglage(s))`, { trouves: e.trouves, rangees: e.rangees.slice(0, 8) });
        }
        // Le toucher ouvre le réglage trouvé, et « ‹ » revient à la recherche.
        await champ.fill('papier'); await att(pg, 300);
        await pg.locator('[data-sous-ouvrir="imprimante"]').first().click().catch(() => {}); await att(pg, 600);
        const e1 = await etat(pg);
        dit(e1.sous === 'imprimante', `R ${tag} : toucher le réglage trouvé l’ouvre`, e1);
        await pg.locator('[data-sous-retour]').first().click().catch(() => {}); await att(pg, 400);
        dit(await pg.locator('[data-sous-ouvrir="imprimante"]:visible').count() > 0, `R ${tag} : « ‹ » revient aux résultats`);
        await champ.fill('xyzzy introuvable'); await att(pg, 300);
        const e2 = await etat(pg);
        dit(e2.trouves === 0, `R ${tag} : un mot sans réponse le dit`, e2.trouves);
        await champ.fill(''); await att(pg, 300);
        console.log(`   recherche : ${trouves}/${CAS.length} mots de vendeur trouvent leur réglage`);
      }
      await o.ctx.close();
      // ── L. Les anciens liens profonds (390 clair) ──
      if (PARTIES.has('L') && W < 600 && t === 'clair') {
        const o2 = await P.ouvrir(nav, { W, sombre: false, b: P.base(), url: '/?tab=settings' }); await P.pret(o2.pg);
        const LIENS = [...C.LIENS_PROFONDS.map((id) => [`?tab=settings&reglage=${id}`, C.rangeeDuLien(id)]), ...Object.entries(C.SECTIONS_ANCIENNES).map(([s, id]) => [`?tab=settings&section=${s}`, id])];
        let bons = 0;
        for (const [lien, id] of LIENS) {
          await o2.pg.goto(`http://localhost:${P.PORT}/${lien}`, { waitUntil: 'domcontentloaded' });
          await o2.pg.waitForSelector('.vrm-set', { timeout: 20000 }).catch(() => {});
          await att(o2.pg, 1300);
          const e = await etat(o2.pg);
          const panneau = await o2.pg.locator(`[data-sous-ecran="${id}"]`).first().isVisible().catch(() => false);
          const rangee = await o2.pg.locator(`[data-reglage-id="${id}"]:visible`).count();
          const ok = (e.sous === id && panneau) || (!e.sous && rangee > 0);
          // Un réglage que CE vendeur n'a pas (propriétaire seul, eBay pas relié, widget sans clé) n'existe nulle
          // part dans la page : le lien ouvre Paramètres, rien d'autre — dit, pas compté rouge.
          const existe = await o2.pg.locator(`[data-sous-ecran="${id}"], [data-reglage-id="${id}"], [data-categorie-contient~="${id}"]`).count();
          if (!ok && !existe) { console.log(`   · L ${lien} : « ${id} » n’est pas offert à ce vendeur (pas mesuré)`); continue; }
          if (ok) bons++;
          dit(ok, `L ${lien} ouvre « ${id} »`, e);
        }
        console.log(`   liens profonds : ${bons}/${LIENS.length}`);
        await o2.ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a planté', String(e && e.stack || e).slice(0, 600)); }
  finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} parametres-refonte : ${n - ko}/${n} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
