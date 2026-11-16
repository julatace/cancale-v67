require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA TÊTE D'ANNONCES, SITE PAR SITE (15 nov.) — jugée sur l'app RENDUE.
//  Récit : docs/passation/2026-11-15-annonces-propre.md.
//
//  Julien (capture iPhone, Annonces · Vestiaire) : « Ici c'est horriblement moche […] fais de meilleurs
//  logos pour les plateformes ». Le sélecteur de sites passait PAR-DESSUS le texte et « À faire · 1 »,
//  et « Relier à Vinted » faisait un gros bloc bleu sous chaque rangée. Ce banc mesure la RÈGLE :
//
//    chevauche  à 390 et 1512, sur CHAQUE site (Vinted, Leboncoin, eBay, Vestiaire), aucun élément de
//               la tête d'Annonces (titre, aide, À faire, rangée des sites, compte, outils, recherche) ne
//               coupe le rectangle d'un autre (rectangles visibles, intersection > 2 px de côté) ;
//    ordre      (390) titre, puis la rangée des sites, puis la liste : la rangée des sites commence sous le
//               bas du titre et finit au-dessus de la 1re rangée de la liste (1512 : elle vit dans l'île du haut) ;
//    relier     (Vestiaire) aucun geste « Relier à Vinted » (`[data-vc-relier]`) n'est un bloc sous sa
//               rangée : visible, il tient DANS la boîte de sa rangée, au plus 32 px de haut de texte,
//               et la rangée garde la hauteur d'une rangée (≤ 76 px) ; il reste joignable (toucher la
//               rangée ⇒ la fiche le porte, même `data-vc-relier`) ;
//    logos      chaque segment de site porte une marque SVG en ligne (`svg[data-marque]`), à l'encre
//               (couleur = couleur du texte, jamais une couleur de marque), de 16 à 22 px de haut ;
//    nom        la barre du bas (390) et le menu (1512) disent « Annonces », jamais « Paires ».
//    phrase     la tête porte UNE LIGNE DE PLUS (le banc y pose la phrase d'aide que Julien voyait sur sa capture,
//               « Chaque annonce porte son N° de rangement… ») : elle ne passe JAMAIS sous la rangée des sites —
//               c'est la panne de la capture (une tête de hauteur FIXE, 44 px, que son texte débordait) ;
//    nombres    (Vinted, Vestiaire) la touche d'un site NON choisi dit son nombre d'annonces (`data-site-n`), le même
//               que sa règle : Vinted = « en ligne » de la bande, Vestiaire = ses rangées « En ligne » ;
//    pratique   (390, Vinted) la recherche reste collée sous la tête quand la liste défile (900 px), et un N°
//               exact tapé met SA ligne en premier.
//  Base INVENTÉE (design-passe : 3 comptes Vinted) + 3 annonces Vestiaire inventées ; garde réseau.
//  `LARGEURS=390` `THEMES=clair` `SITES=vestiaire` ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, pret, srv, PORT, chromium } = P;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SITES = liste('SITES', 'vinted,leboncoin,ebay,vestiaire');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-annonces-tete');
fs.mkdirSync(SHOTS, { recursive: true });

// La base : celle de la passe de design, ses quatre sites montrés, et trois annonces Vestiaire inventées
// (aucune vraie donnée : le dépôt est public).
function baseQuatre() {
  const b = base();
  const m = b.main[0].data;
  m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], at: '2026-11-01T10:00:00.000Z' };
  const lu = new Date(Date.now() - 5 * 60000).toISOString();
  const items = {
    9100000001: { titre: 'Sac cabas en toile enduite', photo: 'https://images.vestiairecollective.com/exemple/1.jpg', prix: { valeur: 274, devise: 'EUR' }, statut: 'on_sale', compte: 'boutique-exemple', vuAt: lu, favoris: 3 },
    9100000002: { titre: 'Vanity en toile monogrammée', photo: 'https://images.vestiairecollective.com/exemple/2.jpg', prix: { valeur: 249, devise: 'EUR' }, statut: 'on_sale', compte: 'boutique-exemple', vuAt: lu },
    9100000003: { titre: 'Escarpins ajourés en cuir', photo: 'https://images.vestiairecollective.com/exemple/3.jpg', prix: { valeur: 59, devise: 'EUR' }, statut: 'on_sale', compte: 'boutique-exemple', vuAt: lu },
  };
  b.rows.push({ id: 'vc_listings', data: { items, liens: {}, capturedAt: lu, complet: true, total: 3 } });
  b.rows.push({ id: 'vc_ventes', data: { ventes: {} } });
  return b;
}

// ── La mesure, DANS la page ──────────────────────────────────────────────────
function mesurer({ tel }) {
  const out = { chevauche: [], ordre: [], relier: [], logos: [], info: {} };
  const vis = (el) => { if (!el || !el.isConnected) return false; if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; const r = el.getBoundingClientRect(); return r.width >= 2 && r.height >= 2; };
  const nom = (el) => { const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join(''); return `${el.tagName.toLowerCase()}${d} « ${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 26)} »`; };
  const sec = document.querySelector('[data-espace="paires"]');
  if (!sec) { out.info.absent = true; return out; }
  const sites = document.querySelector('[data-filtre-site="annonces"]');
  out.info.sites = !!(sites && vis(sites));
  // Les pièces de la tête : chacune une boîte. Le titre se mesure sur son TEXTE (Range), pas sur la boîte du h1.
  const pieces = [];
  const h1 = sec.querySelector('.vrm-tache-tete h1, [data-tache-tete] h1');
  if (h1 && vis(h1)) { const rg = document.createRange(); rg.selectNodeContents(h1); const r = rg.getBoundingClientRect(); pieces.push({ nom: 'titre', r }); out.info.titreBas = Math.round(r.bottom); }
  const ajouter = (sel, n) => { for (const el of sec.querySelectorAll(sel)) if (vis(el) && !(sites && sites.contains(el) && n !== 'sites')) pieces.push({ nom: n + ' ' + nom(el), r: el.getBoundingClientRect(), el }); };
  if (sites && vis(sites)) pieces.push({ nom: 'sites', r: sites.getBoundingClientRect(), el: sites });
  ajouter('[data-aide-ouvrir]', 'aide');
  ajouter('.vrm-ann-afaire, [data-ui-afaire], [data-afaire-site]', 'à faire');
  ajouter('.vrm-ann-compte, [data-selecteur-compte], .vrm-compte-sel', 'compte');
  ajouter('[data-pf-outils], [data-ann-recherche]', 'recherche');
  ajouter('.vrm-tache-tete p, .vrm-tache-tete .vrm-phrase-ecran, [data-phrase-ecran]', 'phrase');
  // Tout texte visible de la tête (hors rangée des sites) : un mot sous la rangée se voit ici.
  const tete = sec.querySelector('.vrm-tache-tete');
  if (tete) for (const el of tete.querySelectorAll('*')) { if (sites && (sites.contains(el) || el.contains(sites))) continue; if (h1 && (el === h1 || h1.contains(el))) continue; if (![...el.childNodes].some((x) => x.nodeType === 3 && x.nodeValue.trim())) continue; if (!vis(el)) continue; const rg = document.createRange(); rg.selectNodeContents(el); pieces.push({ nom: 'texte ' + nom(el), r: rg.getBoundingClientRect(), el }); }
  const coupe = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const A = pieces[i], B = pieces[j];
    if (A.el && B.el && (A.el.contains(B.el) || B.el.contains(A.el))) continue;
    if (A.nom === B.nom) continue;
    if (!(A.nom === 'sites' || B.nom === 'sites' || A.nom === 'titre' || B.nom === 'titre')) continue;
    if (coupe(A.r, B.r)) out.chevauche.push(`${A.nom} ⨯ ${B.nom}`);
  }
  // L'ordre : titre, sites, liste.
  const s = sites && vis(sites) ? sites.getBoundingClientRect() : null;
  const premiere = [...sec.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle], [data-vc-annonce], [data-pf-liste] li, [data-lbc-annonce], [data-ebay-annonce]')].find(vis);
  // (ordinateur : la rangée des sites vit dans l'île du haut, à droite de la recherche — §7 ; seul le chevauchement y est jugé)
  if (tel && s && out.info.titreBas != null && s.top < out.info.titreBas - 1) out.ordre.push(`la rangée des sites (haut ${Math.round(s.top)}) commence avant le bas du titre (${out.info.titreBas})`);
  if (tel && s && premiere && s.bottom > premiere.getBoundingClientRect().top + 1) out.ordre.push(`la rangée des sites (bas ${Math.round(s.bottom)}) déborde sur la liste (${Math.round(premiere.getBoundingClientRect().top)})`);
  out.info.premiere = premiere ? Math.round(premiere.getBoundingClientRect().top) : null;
  // Le choix du compte (Vinted) se lit en entier : jamais « T… » (c'est la rangée des sites qui défile, pas lui).
  const cm = sec.querySelector('.vrm-tache-filtres .vrm-ui-menu-compte > span');
  if (cm && vis(cm) && cm.scrollWidth > cm.clientWidth + 1) out.ordre.push(`le compte est coupé (« ${cm.textContent} » en ${cm.clientWidth} px)`);
  // … et il reste sur la ligne des sites (une ligne de moins avant la liste), jamais renvoyé dessous.
  if (tel && cm && vis(cm) && s) { const c = cm.getBoundingClientRect(); if (Math.abs((c.top + c.bottom) / 2 - (s.top + s.bottom) / 2) > 6) out.ordre.push(`le compte n'est plus sur la ligne des sites (${Math.round(c.top)} / ${Math.round(s.top)})`); }
  // « Relier à Vinted » : jamais un bloc sous la rangée.
  for (const b of sec.querySelectorAll('[data-vc-relier], [data-vc-delier]')) {
    if (!vis(b)) continue;
    const li = b.closest('[data-vc-annonce]'); if (!li) continue;
    const rb = b.getBoundingClientRect(), rl = li.getBoundingClientRect();
    const rg = document.createRange(); rg.selectNodeContents(b); const rt = rg.getBoundingClientRect();
    const hautMedia = li.querySelector('.vrm-ui-ligne-photo, .vrm-pf-photo-vc'); const ph = hautMedia ? hautMedia.getBoundingClientRect() : null;
    // (le TEXTE du geste, pas sa cible au doigt : celle-ci garde 44 px par des marges négatives et peut mordre le bord)
    if (rt.bottom > rl.bottom + 1 || rt.top < rl.top - 1) out.relier.push(`hors de sa rangée (${li.getAttribute('data-vc-annonce')})`);
    if (rb.height < 43.5) out.relier.push(`cible au doigt de ${Math.round(rb.height)} px (${li.getAttribute('data-vc-annonce')})`);
    if (ph && rt.top >= ph.bottom - 2) out.relier.push(`sous la photo, un bloc à part (${li.getAttribute('data-vc-annonce')})`);
    if (rt.height > 32) out.relier.push(`texte sur plusieurs lignes : ${Math.round(rt.height)} px (${li.getAttribute('data-vc-annonce')})`);
    if (rl.height > 76) out.relier.push(`rangée de ${Math.round(rl.height)} px (${li.getAttribute('data-vc-annonce')})`);
  }
  out.info.relier = sec.querySelectorAll('[data-vc-relier]').length;
  // Les logos : une marque SVG en ligne par segment de site, à l'encre.
  if (sites) for (const btn of sites.querySelectorAll('button[data-site]')) {
    const id = btn.getAttribute('data-site'); if (id === 'toutes') continue;
    const svg = btn.querySelector('svg[data-marque]');
    if (!svg) { out.logos.push(`${id} : pas de marque SVG`); continue; }
    const r = svg.getBoundingClientRect();
    if (r.height < 15.5 || r.height > 22.5) out.logos.push(`${id} : ${Math.round(r.height)} px de haut`);
    const cS = getComputedStyle(svg).color, cB = getComputedStyle(btn).color;
    const fill = [...svg.querySelectorAll('path, rect, circle')].map((p) => getComputedStyle(p).fill).find((f) => f && f !== 'none');
    const stroke = [...svg.querySelectorAll('path, rect, circle')].map((p) => getComputedStyle(p).stroke).find((f) => f && f !== 'none');
    const encre = fill || stroke;
    if (cS !== cB) out.logos.push(`${id} : couleur ${cS} ≠ texte ${cB}`);
    if (encre && encre !== cS) out.logos.push(`${id} : tracé ${encre} ≠ couleur du texte ${cS}`);
  }
  return out;
}
function nomNav({ tel }) {
  const sel = tel ? '.vrm-mobile-nav' : '.vrm-sidebar, nav.vrm-nav-ordi, .vrm-app-sidebar, aside';
  const navs = [...document.querySelectorAll(sel)];
  const txt = navs.map((n) => n.innerText || '').join(' | ');
  return { paires: /\bPaires\b/.test(txt), annonces: /\bAnnonces\b/.test(txt), txt: txt.replace(/\s+/g, ' ').slice(0, 200) };
}

async function juger(nav, W, theme) {
  const sombre = theme === 'sombre', tel = W < 600;
  const fautes = [];
  const o = await ouvrir(nav, { W, sombre, b: baseQuatre(), url: '/?tab=annonces' });
  await pret(o.pg); await o.pg.waitForTimeout(1000);
  const n = await o.pg.evaluate(nomNav, { tel });
  if (n.paires || !n.annonces) fautes.push(`navigation : ${n.paires ? '« Paires » écrit' : ''}${!n.annonces ? ' « Annonces » absent' : ''} (${n.txt})`);
  let enLigneVinted = null;
  if (tel) {
    // Pratique (Vinted, au doigt) : la recherche collée sous la tête, et un N° exact amène SA ligne en premier.
    await o.pg.waitForSelector('[data-sb-liste] > [data-sb-avant-cle]', { timeout: 20000 }).catch(() => {});
    const colle = await o.pg.evaluate(async () => {
      const m = document.querySelector('.vrm-main'); m.scrollTop = 900; await new Promise((r) => setTimeout(r, 600));
      const champ = document.querySelector('[data-espace="paires"] [data-ann-recherche]');
      const h = document.querySelector('.vrm-app-header').getBoundingClientRect().bottom;
      const r = champ ? champ.getBoundingClientRect() : null;
      const ok = !!r && r.top >= h - 2 && r.top <= h + 24 && r.height >= 40;
      m.scrollTop = 0; await new Promise((r) => setTimeout(r, 300));
      return ok ? 'ok' : `recherche à ${r ? Math.round(r.top) : '—'} px (tête ${Math.round(h)})`;
    });
    if (colle !== 'ok') fautes.push('pratique : la recherche ne reste pas en haut (' + colle + ')');
    const cible = await o.pg.evaluate(() => { const l = [...document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')][5]; const t = l && l.querySelector('.vrm-num, .vrm-fiche-numero'); return t ? String(t.innerText).replace(/\D/g, '') : ''; });
    await o.pg.locator('[data-espace="paires"] [data-ann-recherche] input').first().fill(cible).catch(() => {});
    await o.pg.waitForTimeout(900);
    const premier = await o.pg.evaluate(() => { const l = [...document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')].find((x) => x.getBoundingClientRect().height > 8); const t = l && l.querySelector('.vrm-num, .vrm-fiche-numero'); return t ? String(t.innerText).replace(/\D/g, '') : ''; });
    if (!cible || premier !== cible) fautes.push(`pratique : N° ${cible} tapé, 1re ligne N° ${premier || '—'}`);
    await o.pg.locator('[data-espace="paires"] [data-ann-recherche] input').first().fill('').catch(() => {});
    await o.pg.waitForTimeout(500);
  }
  for (const site of SITES) {
    const b = o.pg.locator(`[data-filtre-site="annonces"] button[data-site="${site}"]`);
    if (!(await b.count())) { fautes.push(`${site} : pas de segment dans la rangée des sites`); continue; }
    await b.first().click({ timeout: 6000, force: true, noWaitAfter: true }).catch(() => {});
    await o.pg.waitForTimeout(site === 'vestiaire' ? 2200 : 1400);
    if (site === 'vestiaire') await o.pg.waitForSelector('[data-vc-annonce]', { timeout: 8000 }).catch(() => fautes.push('vestiaire : aucune annonce rendue'));
    await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
    // La ligne de plus dans la tête (la phrase d'aide de la capture) : posée par le banc, jamais par l'app.
    await o.pg.evaluate(() => { const t = document.querySelector('section.vrm-tache[data-espace="paires"] .vrm-tache-tete'); if (t && !t.querySelector('[data-banc-phrase]')) { const p = document.createElement('p'); p.setAttribute('data-banc-phrase', ''); p.style.cssText = 'margin:4px 0 0;font-size:15px;line-height:1.4'; p.textContent = 'Chaque annonce porte son N° de rangement. Coche-en plusieurs pour agir en série.'; t.appendChild(p); } });
    await o.pg.waitForTimeout(300);
    const m = await o.pg.evaluate(mesurer, { tel });
    await o.pg.screenshot({ path: path.join(SHOTS, `annonces-${site}-${W}-${theme}.png`) }).catch(() => {});
    if (m.info.absent) { fautes.push(`${site} : l'espace Annonces n'est pas rendu`); continue; }
    if (!m.info.sites) fautes.push(`${site} : rangée des sites invisible`);
    if (m.chevauche.length) fautes.push(`${site} : chevauchement — ` + [...new Set(m.chevauche)].slice(0, 4).join(' ; '));
    if (m.ordre.length) fautes.push(`${site} : ordre — ` + m.ordre.join(' ; '));
    if (m.relier.length) fautes.push(`${site} : Relier à Vinted — ` + [...new Set(m.relier)].slice(0, 3).join(' ; '));
    if (m.logos.length) fautes.push(`${site} : logos — ` + m.logos.slice(0, 4).join(' ; '));
    // Les nombres : la touche d'un site non choisi dit le nombre de SA règle.
    const nb = await o.pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-filtre-site="annonces"] button[data-site]')].map((b) => [b.getAttribute('data-site'), b.getAttribute('data-site-n')])));
    if (site !== 'vinted') {
      if (nb.vinted == null) fautes.push(`${site} : la touche Vinted ne dit pas son nombre`);
      else if (enLigneVinted != null && Number(nb.vinted) !== enLigneVinted) fautes.push(`${site} : Vinted ${nb.vinted} ≠ « en ligne » de la bande ${enLigneVinted}`);
    }
    if (site !== 'vestiaire' && String(nb.vestiaire) !== '3') fautes.push(`${site} : la touche Vestiaire dit ${nb.vestiaire} (3 en ligne attendues)`);
    if (site === 'vinted') enLigneVinted = await o.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-espace="paires"] .vrm-ui-bande-item')].find((x) => /en ligne/i.test(x.innerText || '')); const n = e ? parseInt(String(e.innerText).replace(/\s/g, ''), 10) : NaN; return Number.isFinite(n) ? n : null; });
    if (site === 'vestiaire') {
      // Le geste reste joignable : toucher la rangée ⇒ la fiche le porte (même data-vc-relier).
      const id = await o.pg.evaluate(() => { const l = document.querySelector('[data-vc-annonce]'); return l ? l.getAttribute('data-vc-annonce') : ''; });
      await o.pg.locator(`[data-vc-annonce="${id}"] .vrm-ui-ligne-titre`).first().click({ timeout: 6000, force: true, noWaitAfter: true }).catch(() => {});
      await o.pg.waitForTimeout(1500);
      // (16 nov., intégration de la fiche D) les gestes de la ligne vivent derrière « ⋯ » (feuille de tuiles, « Tout voir ») :
      // un toucher les montre — comme les bancs studio-paires et studio-ventes. Toujours joignable depuis la rangée.
      await o.pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
      await o.pg.waitForTimeout(300);
      await o.pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
      await o.pg.waitForTimeout(400);
      const joint = await o.pg.evaluate((id) => { const e = [...document.querySelectorAll(`[data-vc-relier="${id}"]`)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 1 && r.height > 1; }); return !!e; }, id);
      await o.pg.screenshot({ path: path.join(SHOTS, `annonces-vestiaire-${W}-${theme}-fiche.png`) }).catch(() => {});
      if (!joint) fautes.push('vestiaire : « Relier à Vinted » pas joignable (ni sur la rangée ni dans la fiche)');
      await o.pg.keyboard.press('Escape'); await o.pg.waitForTimeout(500);
      await o.pg.locator('.vrm-fp [data-fiche-fermer]').click({ timeout: 2000, force: true, noWaitAfter: true }).catch(() => {});
      await o.pg.waitForTimeout(400);
      console.log(`    vestiaire ${W} ${theme} : ${m.info.relier} « Relier » · 1re rangée ${m.info.premiere} px`);
    }
  }
  if (o.erreurs.length) fautes.push('erreurs : ' + o.erreurs.slice(0, 2).join(' | '));
  await o.ctx.close();
  return fautes;
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  let rouges = 0;
  for (const W of LARGEURS) for (const th of THEMES) {
    try {
      const f = await juger(nav, W, th);
      console.log(`${f.length ? '✗' : '✓'} tête d'Annonces ${W} ${th}`);
      for (const x of f) console.log('    ✗ ' + x);
      if (f.length) rouges++;
    } catch (e) { console.log('ÉCHEC', W, th, String(e.message || e).slice(0, 200)); rouges++; }
  }
  await nav.close(); srv.close();
  console.log(rouges ? `\n${rouges} rouge(s) — captures : ${SHOTS}` : `\nTout vert — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
