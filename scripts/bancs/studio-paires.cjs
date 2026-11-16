require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  « STUDIO BLEU CLAIR » — L'ESPACE PAIRES (14 nov.), jugé sur l'app RENDUE.
//  Récit : docs/passation/2026-11-14-studio-paires.md ; styles : src/design/studio-paires.css ;
//  la paire au premier plan : src/paires/PaireAvant.jsx.
//
//  Julien a choisi la direction t25 (« tout doit être parfait, tu peux changer les dispositions »,
//  mais AUCUNE fonction ne disparaît). Ce banc mesure la RÈGLE (data-*, nombres rendus), pas un libellé :
//
//  A. FORME — base inventée (design-passe : 3 comptes, 36 annonces), 390 tactile ET 1512, clair ET sombre :
//     premiere  la 1re rangée d'Annonces dans la moitié haute d'un iPhone (≤ 422 px sur 844) ;
//     (15 nov., refonte-journee) rangée : la photo d'abord, la plaque N° sous le titre (maquette validée) ; « À faire » sur la
//     ligne du TITRE (h1) — le sélecteur Annonces | Stock | Achats est maintenant dans la tête, sous le titre ;
//     rangee    une rangée fait 60–72 px, porte sa plaque N° en 1re colonne, sa vignette, son prix ;
//     pleins    au plus UN bouton plein (encre ou accent) dans le premier écran ;
//     debord    rien ne déborde de l'écran (largeur) ;
//     aa        contraste ≥ 4,5:1 des textes de la rangée, de la plaque et de la bande (couleur calculée
//               sur le fond EFFECTIF, fonds empilés) ;
//     rouge     aucun texte rouge hors d'une plaque de N° en double (§5) ;
//     avant     (390) toucher une rangée la fait MONTER (data-sb-avant) sans quitter la liste : les autres
//               reculent (opacité < .6), la carte montre prix affiché · acheté · jours · favoris et
//               Baisser · Republier · « ⋯ » ; « × » la fait redescendre (plus aucune rangée montée) ;
//     plan      (1512) toucher une rangée ouvre la fiche EN PLAN À DROITE (.vrm-fp.sb-plan), la liste
//               reste visible à gauche (la rangée touchée désignée, data-sb-choisie) ; Échap la ferme ;
//     gestes    chaque geste de l'inventaire est JOIGNABLE : en tête (vues, tri, liste/grille, outils, À faire,
//               aide, compte, sites), dans la carte montée, dans la fiche (« ⋯ ») et dans son menu « ⋯ ».
//  B. VOLUME — 1 000 annonces (un compte), 390 tactile : 1re rangée ≤ 422 px, ≥ 8 rangées ENTIÈRES une
//     fois la liste en haut, la carte monte en < 400 ms, rien ne déborde.
//  `PARTIES=forme,volume` `LARGEURS=390` `THEMES=clair` ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, pret, srv, PORT, chromium } = P;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const PARTIES = liste('PARTIES', 'forme,volume');
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-studio-paires');
fs.mkdirSync(SHOTS, { recursive: true });

// ── La base au volume : 1 000 annonces sur le premier compte (même fabrique que refonte-listes.cjs) ──
function baseMille() {
  const b = base();
  const a = b.accounts[0]; const uid = a.vinted_user_id;
  const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`);
  const MARQ = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'], MOD = ['samba', 'spezial', 'air max 1', 'xt-6', 'gazelle', '550', 'gel-1130', 'old skool'];
  const NOW = Date.now(), J = 86400000;
  const items = []; const num = b.main[0].data.vinted_annonce_numeros;
  for (let i = 0; i < 1000; i++) {
    const id = 7500000000 + i;
    items.push({ id, title: `${MARQ[i % 6]} ${MOD[i % 8]} taille ${36 + (i % 10)}`, brand_title: MARQ[i % 6], size_title: String(36 + (i % 10)), status: 'Très bon état',
      price: { amount: String(30 + (i * 7) % 90) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: i % 5, view_count: 10 + (i % 40),
      created_at_ts: new Date(NOW - (i % 200 + 1) * J).toISOString(), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg?s=abc`, high_resolution: { timestamp: Math.floor((NOW - (i % 200 + 1) * J) / 1000) } } });
    num[id] = { num: String(500 + i), numberedAt: new Date(NOW - (i % 200 + 1) * J).toISOString() };
  }
  lst.data.payload.items = items; lst.data.nItems = items.length; lst.data.payload.pagination = { total_entries: items.length };
  const enl = b.rows.find((r) => r.id === `harvest_${uid}_enligne`);
  if (enl) { enl.data.n = items.length; enl.data.ids = items.map((x) => x.id); enl.data.items = items.map((x) => ({ id: x.id, title: x.title })); }
  b.main[0].data.vinted_used_nums = Object.values(num).map((x) => Number(x.num));
  return b;
}

// ── La mesure de FORME, dans la page ─────────────────────────────────────────
function mesurer({ tel }) {
  const out = { premiere: null, rangee: [], pleins: [], debord: [], aa: [], rouge: [], info: {} };
  const rgba = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Le fond EFFECTIF : on empile les fonds des ancêtres (un dégradé : sa première couleur lue).
  const fondDe = (el) => {
    const pile = [];
    for (let x = el; x; x = x.parentElement) {
      const cs = getComputedStyle(x);
      let c = rgba(cs.backgroundColor);
      if ((!c || c.a === 0) && cs.backgroundImage && cs.backgroundImage !== 'none') { const m = cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/i); if (m) c = m[0][0] === '#' ? { r: parseInt(m[0].slice(1, 3), 16), g: parseInt(m[0].slice(3, 5), 16), b: parseInt(m[0].slice(5, 7), 16), a: 1 } : rgba(m[0]); }
      if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; }
    }
    let f = { r: 255, g: 255, b: 255 };
    if (document.documentElement.getAttribute('data-theme') === 'dark') f = { r: 0, g: 0, b: 0 };
    for (const c of pile.reverse()) f = { r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a) };
    return f;
  };
  const rows = [...document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')].filter((r) => r.getBoundingClientRect().height > 8);
  out.info.rangees = rows.length;
  if (rows[0]) out.premiere = Math.round(rows[0].getBoundingClientRect().top);
  for (const r of rows.slice(0, 6)) {
    const b = r.getBoundingClientRect();
    const plaque = r.querySelector('.vrm-fiche-numero .vrm-num, .vrm-fiche-num-vide'), photo = r.querySelector('a.vrm-fiche-photo'), prix = r.querySelector('[data-prix]');
    const p = plaque && plaque.getBoundingClientRect(), ph = photo && photo.getBoundingClientRect();
    if (b.height < 59 || b.height > 73) out.rangee.push(`hauteur ${Math.round(b.height)} (${r.getAttribute('data-sb-avant-cle')})`);
    // (15 nov., refonte-journee — la maquette « Annonces » validée par Julien) La rangée : la PHOTO d'abord, la plaque N°
    // sous le titre (2e ligne), visible et dans la rangée ; à l'ordinateur (maquette « ordi/annonces » validée) le tableau :
    // photo, puis la plaque N° dans la colonne juste après, AVANT le titre, sur la même ligne.
    const ti = r.querySelector('[data-titre]'), tb = ti && ti.getBoundingClientRect();
    if (innerWidth < 768) { if (!p || !ph || !tb || p.width < 4 || p.left < ph.right || p.top < tb.bottom - 2 || p.bottom > b.bottom + 1) out.rangee.push(`plaque pas sous le titre, à droite de la photo (${r.getAttribute('data-sb-avant-cle')})`); }
    else if (!p || !ph || !tb || p.width < 4 || p.left < ph.right - 1 || p.right > tb.left + 1 || p.bottom < tb.top || p.top > tb.bottom) out.rangee.push(`plaque pas dans la colonne N° (entre la photo et le titre) (${r.getAttribute('data-sb-avant-cle')})`);
    if (!prix || prix.getBoundingClientRect().width < 4) out.rangee.push(`prix absent (${r.getAttribute('data-sb-avant-cle')})`);
    if (r.querySelectorAll('button:not(.vrm-fiche-plus-bouton):not([data-edition])').length) {
      const vis = [...r.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().width > 2 && !x.closest('.vrm-fiche-numero') && !x.classList.contains('vrm-fiche-plus-bouton') && getComputedStyle(x).pointerEvents !== 'none');
      if (vis.length) out.rangee.push(`bouton dans la rangée : ${vis.map((x) => (x.innerText || x.getAttribute('aria-label') || '').slice(0, 20)).join(', ')}`);
    }
    // contraste : titre, méta, prix, plaque
    for (const el of [r.querySelector('[data-titre]'), r.querySelector('[data-stats-annonce] > *'), prix, plaque]) {
      if (!el) continue; const c = rgba(getComputedStyle(el).color); if (!c) continue;
      const q = ratio(c, fondDe(el)); if (q < 4.5) out.aa.push(`${(el.innerText || '').trim().slice(0, 24)} : ${q.toFixed(2)}`);
    }
  }
  for (const el of document.querySelectorAll('[data-espace="paires"] .vrm-ui-bande-n, [data-espace="paires"] .vrm-ui-bande-l')) {
    const c = rgba(getComputedStyle(el).color); if (!c || el.getBoundingClientRect().width < 2) continue;
    const q = ratio(c, fondDe(el)); if (q < 4.5) out.aa.push(`bande « ${(el.innerText || '').trim().slice(0, 20)} » : ${q.toFixed(2)}`);
  }
  // un seul bouton plein : fond opaque d'encre ou d'accent (luminance très basse au clair / très haute la nuit), dans le premier écran
  const sombre = document.documentElement.getAttribute('data-theme') === 'dark';
  const pleins = [...document.querySelectorAll('.vrm-main button, .vrm-main a[role="button"], .vrm-main .vrm-b-primaire')].filter((x) => {
    const bb = x.getBoundingClientRect(); if (bb.width < 20 || bb.height < 20 || bb.top > innerHeight || bb.bottom < 0) return false;
    const c = rgba(getComputedStyle(x).backgroundColor); if (!c || c.a < 0.9) return false;
    const L = lum(c); const accent = c.b > c.r + 60 && c.b > 150;
    return accent || (!sombre && L < 0.05) || (sombre && L > 0.8);
  });
  out.pleins = pleins.map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 24));
  // débord : un élément visible de l'espace qui sort de l'écran à droite (hors rangées qui défilent)
  const W = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll('[data-espace="paires"] *')) {
    const bb = el.getBoundingClientRect(); if (bb.width < 2 || bb.height < 2) continue;
    if (el.closest('.vrm-stock-views, .vrm-filtre-site, [style*="overflow"], .vrm-menu-flottant')) continue;
    if (bb.right > W + 1) { out.debord.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} → ${Math.round(bb.right)} > ${W}`); if (out.debord.length > 4) break; }
  }
  // rouge : un texte rouge hors d'une plaque en double
  for (const el of document.querySelectorAll('[data-espace="paires"] *')) {
    if (!el.childNodes.length || el.getBoundingClientRect().width < 2) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
    const c = rgba(getComputedStyle(el).color); if (!c) continue;
    if (c.r > 150 && c.g < 70 && c.b < 70 && !el.closest('[data-num-etat="doublon"], .is-double')) out.rouge.push((el.innerText || '').slice(0, 30));
  }
  return out;
}

// Les gestes de l'inventaire : là où ils vivent maintenant (récit, « Inventaire »).
const GESTES_TETE = {
  'vue Toutes': '[data-vue-toutes]', 'vue Sélectionner': '[data-vue-selection]', 'vue Republier (atelier)': '[data-vue-republier][data-actions-ouvrir]',
  'les autres vues (plateau)': '[data-espace="paires"] .vrm-stock-views > button:nth-child(4)', 'trier': 'select.vrm-ann-tri', 'liste / grille': '[data-sb-vue-bascule]',
  'outils ⋯': '.vrm-ann-outils > button', 'recherche': '[data-ann-recherche] input, input[data-ann-recherche]', 'aide ?': '[data-espace="paires"] [data-aide-ouvrir]',
  'sites': '[data-site]', 'Annonces · Stock · Achats': '[data-paires-segment], [data-nav-entree="garage"]',
};
const GESTES_AVANT = { 'baisser le prix': '[data-sb-avant-baisser]', 'republier': '[data-sb-avant-republier]', '⋯ (la fiche)': '[data-sb-avant-plus]', 'acheté (saisie)': '[data-sb-avant-chiffre="achat"] button', 'N° (changer)': '[data-sb-avant] .vrm-fiche-numero button', 'fermer ×': '[data-sb-avant-fermer]' };
const GESTES_FICHE = { 'état · prix d’achat': '.vrm-fp [data-fiche-duo] [data-edition="achat"]', 'accepter dès': '.vrm-fp [data-chiffres] [data-edition="min"]', 'refuser sous': '.vrm-fp [data-chiffres] [data-edition="refuse"]', 'boost payé': '.vrm-fp [data-chiffres] [data-edition="boost"]',
  'changer le prix (partout)': '.vrm-fp [data-annonce-prix-partout], .vrm-fp [data-annonce-prix-vinted]', 'stock (voir / ranger)': '.vrm-fp [data-fiche-stock]', '⋯ gestes rares': '.vrm-fp [data-fiche-menu-ouvrir]' };
const GESTES_MENU = { 'file Leboncoin / eBay / Vestiaire': '[data-fiche-place]', 'publier partout': '[data-fiche-partout]', 'visuels réseaux': '[data-fiche-visuels]', 'relier un achat': '[data-fiche-relier-achat]', 'passeport': '[data-fiche-passeport]', 'histoire · dupliquer': '[data-annonce-histoire]', 'marquer vendue': '[data-fiche-vendue]' };
const joignables = (pg, g) => pg.evaluate((g) => Object.entries(g).filter(([, s]) => { const e = [...document.querySelectorAll(s)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(x).visibility !== 'hidden'; }); return !e; }).map(([k]) => k), g);

async function forme(nav, W, theme) {
  const sombre = theme === 'sombre', tel = W < 600;
  const fautes = [];
  const o = await ouvrir(nav, { W, sombre, b: base(), url: '/?tab=annonces' });
  await pret(o.pg); await o.pg.waitForTimeout(1200);
  await o.pg.waitForSelector('[data-sb-liste] > [data-sb-avant-cle]', { timeout: 20000 }).catch(() => {});
  const m = await o.pg.evaluate(mesurer, { tel });
  await o.pg.screenshot({ path: path.join(SHOTS, `paires-${W}-${theme}.png`) }).catch(() => {});
  if (!m.info.rangees) fautes.push('aucune rangée rendue');
  if (tel && !(m.premiere != null && m.premiere <= 422)) fautes.push(`1re rangée à ${m.premiere} px (> 422)`);
  if (m.rangee.length) fautes.push('rangée : ' + m.rangee.slice(0, 3).join(' ; '));
  if (m.pleins.length > 1) fautes.push(`${m.pleins.length} boutons pleins : ${m.pleins.join(', ')}`);
  if (m.debord.length) fautes.push('débord : ' + m.debord.slice(0, 3).join(' ; '));
  if (m.aa.length) fautes.push('contraste : ' + m.aa.slice(0, 4).join(' ; '));
  if (m.rouge.length) fautes.push('rouge hors doublon : ' + m.rouge.slice(0, 3).join(' ; '));
  const tete = await joignables(o.pg, GESTES_TETE);
  // « À faire · N » : au téléphone sur la ligne du titre ; à l'ordinateur, les alertes posées sous les vues.
  const afaire = await o.pg.evaluate((tel) => { const e = document.querySelector(tel ? '[data-espace="paires"] .vrm-ann-afaire[data-ui-afaire]' : '[data-espace="paires"] [data-ui-afaire-place="ordinateur"]'); if (!e) return 'absent'; if (!tel) return 'ok'; const t = (document.querySelector('[data-espace="paires"] .vrm-tache-tete h1') || document.querySelector('[data-espace="paires"] .vrm-tache-tete')).getBoundingClientRect(), r = e.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - (t.top + t.bottom) / 2) < 14 ? 'ok' : `hors de la ligne du titre (${Math.round(r.top)} / ${Math.round(t.top)})`; }, tel);
  if (afaire !== 'ok' && !(afaire === 'absent' && !tel)) fautes.push('À faire : ' + afaire);
  if (tete.length) fautes.push('pas joignable en tête : ' + tete.join(', '));
  // Toucher une rangée (la 3e) : téléphone ⇒ elle monte ; ordinateur ⇒ la fiche en plan à droite.
  const cle = await o.pg.evaluate(() => { const r = document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')[2]; return r ? r.getAttribute('data-sb-avant-cle') : ''; });
  const sel = `[data-sb-avant-cle="${cle}"] [data-titre]`;
  const t0 = Date.now();
  await o.pg.locator(sel).click({ timeout: 8000, force: true, noWaitAfter: true }).catch((e) => fautes.push('toucher : ' + String(e.message).slice(0, 80)));
  if (tel) {
    const monte = await o.pg.waitForSelector('[data-sb-avant="1"] [data-sb-avant-corps]', { timeout: 4000 }).then(() => Date.now() - t0).catch(() => null);
    if (monte == null) fautes.push('la paire ne monte pas');
    else {
      await o.pg.waitForTimeout(500);
      const etat = await o.pg.evaluate((cle) => {
        const r = document.querySelector(`[data-sb-avant-cle="${cle}"]`), autres = [...document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')].filter((x) => x !== r && x.getBoundingClientRect().height > 8);
        const op = autres.length ? Number(getComputedStyle(autres[0]).opacity) : 1;
        const ch = [...r.querySelectorAll('[data-sb-avant-chiffre]')].map((x) => x.getAttribute('data-sb-avant-chiffre'));
        return { op, ch, fiche: !!document.querySelector('.vrm-fp'), liste: !!document.querySelector('[data-sb-liste][data-sb-recul]') };
      }, cle);
      if (!(etat.op < 0.6)) fautes.push(`les autres ne reculent pas (opacité ${etat.op})`);
      if (etat.ch.join(',') !== 'prix,achat,jours,favoris') fautes.push('chiffres de la carte : ' + etat.ch.join(','));
      if (etat.fiche) fautes.push('une fiche s’est ouverte (la paire devait monter dans la liste)');
      const av = await joignables(o.pg, GESTES_AVANT);
      if (av.length) fautes.push('pas joignable dans la carte : ' + av.join(', '));
      await o.pg.screenshot({ path: path.join(SHOTS, `paires-${W}-${theme}-avant.png`) }).catch(() => {});
      // ⋯ ⇒ la fiche, avec le reste ; puis son menu « ⋯ »
      // (15 nov., refonte-journee) La notification passagère de la coque (« 36 nouvelles paires numérotées », ~2 s) se pose
      // au-dessus de la barre du bas, là où tombe « ⋯ » de la carte montée : un clic forcé PENDANT la touchait elle
      // (mesuré : elementFromPoint = .vrm-toast). On attend qu'elle parte — une condition, pas un délai.
      await o.pg.waitForSelector('.vrm-toast', { state: 'detached', timeout: 15000 }).catch(() => {});
      await o.pg.locator('[data-sb-avant-plus]').click({ timeout: 5000, force: true, noWaitAfter: true }).catch(() => {});
      await o.pg.waitForSelector('.vrm-fp [data-fiche-menu-ouvrir]', { timeout: 8000 }).catch(() => {});
      await o.pg.waitForTimeout(600);
      // (15 nov., fiche D) les gestes de la ligne vivent derrière « ⋯ » (feuille de tuiles, « Tout voir ») : un toucher les montre.
      await o.pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
      await o.pg.waitForTimeout(300);
      await o.pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
      await o.pg.waitForTimeout(300);
      const fi = await joignables(o.pg, GESTES_FICHE);
      if (fi.length) fautes.push('pas joignable dans la fiche : ' + fi.join(', '));
      await o.pg.screenshot({ path: path.join(SHOTS, `paires-${W}-${theme}-fiche.png`) }).catch(() => {});
      await o.pg.locator('.vrm-fp [data-fiche-menu-ouvrir]').first().click({ timeout: 5000, force: true, noWaitAfter: true }).catch(() => {});
      await o.pg.waitForTimeout(800);
      const me = await joignables(o.pg, GESTES_MENU);
      if (me.length) fautes.push('pas joignable dans « ⋯ » : ' + me.join(', '));
      await o.pg.keyboard.press('Escape'); await o.pg.waitForTimeout(300);
      await o.pg.keyboard.press('Escape'); await o.pg.waitForTimeout(300);
      await o.pg.locator('.vrm-fp [data-fiche-fermer]').click({ timeout: 3000, force: true, noWaitAfter: true }).catch(() => {});
      await o.pg.waitForTimeout(500);
      // × : la paire redescend
      await o.pg.locator('[data-sb-avant-fermer]').click({ timeout: 4000, force: true, noWaitAfter: true }).catch(() => {});
      await o.pg.waitForTimeout(600);
      const reste = await o.pg.evaluate(() => document.querySelectorAll('[data-sb-avant="1"]').length + document.querySelectorAll('[data-sb-recul]').length);
      if (reste) fautes.push('la paire ne redescend pas (× ou retour)');
      console.log(`    monte en ${monte} ms`);
    }
  } else {
    const plan = await o.pg.waitForSelector('.vrm-fp.sb-plan', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!plan) fautes.push('pas de fiche en plan à droite');
    else {
      await o.pg.waitForTimeout(700);
      const e = await o.pg.evaluate((cle) => {
        const f = document.querySelector('.vrm-fp.sb-plan .vrm-fp-cadre, .vrm-fp.sb-plan .fd-cadre').getBoundingClientRect();
        const rows = [...document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')].filter((x) => { const r = x.getBoundingClientRect(); return r.height > 8 && r.top < innerHeight && r.bottom > 0; });
        const gauche = rows.filter((x) => x.getBoundingClientRect().right <= f.left + 2).length;
        return { droite: f.left > innerWidth / 2, gauche, choisie: !!document.querySelector(`[data-sb-avant-cle="${cle}"][data-sb-choisie]`) };
      }, cle);
      if (!e.droite) fautes.push('la fiche n’est pas à droite');
      if (e.gauche < 4) fautes.push(`la liste ne reste pas visible à gauche (${e.gauche} rangées)`);
      if (!e.choisie) fautes.push('la rangée touchée n’est pas désignée');
      // (15 nov., fiche D) les gestes de la ligne vivent derrière « ⋯ » (feuille de tuiles, « Tout voir ») : un toucher les montre.
      await o.pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
      await o.pg.waitForTimeout(300);
      await o.pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
      await o.pg.waitForTimeout(300);
      const fi = await joignables(o.pg, GESTES_FICHE);
      if (fi.length) fautes.push('pas joignable dans la fiche : ' + fi.join(', '));
      await o.pg.screenshot({ path: path.join(SHOTS, `paires-${W}-${theme}-plan.png`) }).catch(() => {});
      await o.pg.keyboard.press('Escape'); await o.pg.waitForTimeout(600);
      if (await o.pg.locator('.vrm-fp').count()) fautes.push('Échap ne ferme pas la fiche');
    }
  }
  if (o.erreurs.length) fautes.push('erreurs : ' + o.erreurs.slice(0, 2).join(' | '));
  await o.ctx.close();
  return { fautes, m };
}

async function volume(nav) {
  const fautes = [];
  const o = await ouvrir(nav, { W: 390, sombre: false, b: baseMille(), url: '/?tab=annonces' });
  const t0 = Date.now();
  await o.pg.waitForSelector('[data-sb-liste] > [data-sb-avant-cle]', { timeout: 45000 }).catch(() => fautes.push('liste pas rendue'));
  const rendu = Date.now() - t0;
  await o.pg.waitForTimeout(2500);
  const m = await o.pg.evaluate(mesurer, { tel: true });
  // (la base au volume numérote ses 1 000 paires « par VRM » : la liste de vérification des N° neufs passe AVANT la liste — la position se juge sur la base de forme.)
  const visibles = await o.pg.evaluate(async () => {
    const l = [...document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')].filter((e) => e.getBoundingClientRect().height > 8);
    if (!l.length) return 0;
    const sc = document.querySelector('.vrm-main');
    const haut = document.querySelector('.vrm-app-header').getBoundingClientRect().bottom;
    let plafond = haut; for (const s of document.querySelectorAll('.vrm-main *')) { const cs = getComputedStyle(s); if (cs.position === 'sticky') { const r = s.getBoundingClientRect(); if (r.height < 200) plafond = Math.max(plafond, haut + r.height); } }
    sc.scrollTop += l[0].getBoundingClientRect().top - plafond - 4;
    await new Promise((r) => setTimeout(r, 500));
    const bas = (document.querySelector('.vrm-mobile-nav') || { getBoundingClientRect: () => ({ top: innerHeight }) }).getBoundingClientRect().top;
    return l.filter((e) => { const r = e.getBoundingClientRect(); return r.top >= plafond - 6 && r.bottom <= bas + 1; }).length;
  });
  if (visibles < 8) fautes.push(`${visibles} rangées entières visibles (< 8)`);
  const noeuds = await o.pg.evaluate(() => document.querySelectorAll('*').length);
  const cle = await o.pg.evaluate(() => { const r = [...document.querySelectorAll('[data-sb-liste] > [data-sb-avant-cle]')].find((x) => x.getBoundingClientRect().top > 200); return r ? r.getAttribute('data-sb-avant-cle') : ''; });
  // Mesuré DANS la page (le toucher, puis la première image où la carte est montée) : la machine du banc, chargée,
  // n'ajoute pas ses propres délais de pilotage.
  const monte = await o.pg.evaluate((cle) => new Promise((res) => {
    const t = document.querySelector(`[data-sb-avant-cle="${cle}"] [data-titre]`); if (!t) return res(null);
    // Le temps jusqu'à la carte MONTÉE dans le DOM (son contenu compris), lu par un observateur de mutations — pas jusqu'à
    // l'image suivante : sur une machine de banc chargée (charge 30+ sur 4 cœurs), l'image attend la machine, pas VRM.
    let fini = false;
    const mo = new MutationObserver(() => { if (!fini && document.querySelector('[data-sb-avant="1"] [data-sb-avant-corps] [data-sb-avant-gestes]')) { fini = true; mo.disconnect(); res(Math.round(performance.now() - t0)); } });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-sb-avant'] });
    setTimeout(() => { if (!fini) { mo.disconnect(); res(null); } }, 5000);
    const t0 = performance.now(); t.click();
  }), cle);
  if (monte == null || monte > 400) fautes.push(`la carte monte en ${monte} ms (> 400)`);
  if (m.debord.length) fautes.push('débord : ' + m.debord.slice(0, 2).join(' ; '));
  await o.pg.screenshot({ path: path.join(SHOTS, 'volume-1000.png') }).catch(() => {});
  console.log(`    1 000 annonces : rendu ${rendu} ms · 1re rangée ${m.premiere} px · ${visibles} visibles · ${noeuds} nœuds · monte en ${monte} ms`);
  await o.ctx.close();
  return fautes;
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  let rouges = 0;
  if (PARTIES.includes('forme')) {
    for (const W of LARGEURS) for (const th of THEMES) {
      try {
        const { fautes, m } = await forme(nav, W, th);
        console.log(`${fautes.length ? '✗' : '✓'} forme ${W} ${th} : 1re rangée ${m.premiere} px · ${m.info.rangees} rangées · pleins ${m.pleins.length}`);
        for (const f of fautes) console.log('    ✗ ' + f);
        if (fautes.length) rouges++;
      } catch (e) { console.log('ÉCHEC forme', W, th, String(e.message || e).slice(0, 200)); rouges++; }
    }
  }
  if (PARTIES.includes('volume')) {
    try { const f = await volume(nav); console.log(`${f.length ? '✗' : '✓'} volume 1 000 annonces`); for (const x of f) console.log('    ✗ ' + x); if (f.length) rouges++; }
    catch (e) { console.log('ÉCHEC volume', String(e.message || e).slice(0, 200)); rouges++; }
  }
  await nav.close(); srv.close();
  console.log(rouges ? `\n${rouges} rouge(s) — captures : ${SHOTS}` : `\nTout vert — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
