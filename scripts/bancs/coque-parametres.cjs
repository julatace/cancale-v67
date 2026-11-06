// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA COQUE, LA NAVIGATION, PARAMÈTRES » — chantier H de la revue de
//  cohérence du 5 nov. (docs/passation/2026-11-05-revue-coherence.md, points
//  2.28 à 2.32, 3.6 ; récit : docs/passation/2026-11-05-chantier-h.md).
//  Données INVENTÉES (le dépôt est public) : le petit jeu du banc
//  `nouveau-vendeur` (deux comptes Vinted lus, aucune ligne de diagnostic de
//  l'extension), servi par SON harnais — aucune écriture ne sort du banc ; plus
//  deux meubles de Stock et un achat qui passe à « Arrivés ».
//  À 390 px tactile et 1512 px, clair et sombre. Il MESURE (data-*, styles
//  calculés, nombres — jamais un libellé exact) :
//   H1 EN-TÊTE    — au téléphone, aucune icône « ⓘ » (le « i » dessiné en CSS) ; l'état
//                   est un POINT DE COULEUR visible ; le nuage n'est PAS dans l'en-tête
//                   quand tout va bien… et il y EST quand la sauvegarde a raté (503) ;
//                   « Stream » : un seul bouton, aucun œil des montants ;
//   H2 PASTILLE   — « Dernière capture » vient de la MÊME source que la liste des
//                   comptes : jamais « aucune capture » sous des comptes relus ;
//   H3 PARAMÈTRES — icônes distinctes dans chaque onglet ; « Organisation » n'est plus
//                   une ligne de la liste mais reste joignable (son lien) ; aucune carte
//                   dans une carte (Réglages ET Mon compte) ; « Enregistrement… » dans la
//                   ligne du titre (jamais au-dessus) ; à 1512 la colonne commence où
//                   commencent les autres écrans ; Mon compte : UN avatar, UNE ligne
//                   Discord ; aucun mot écarté (`motsEcartesDans`) ;
//   H4 NAVIGATION — une icône par entrée (colonne et « Plus ») ; le même colis ne
//                   porte jamais deux badges (Ventes ET Colis) ;
//   H5 CLOCHE     — la feuille est `SheetShell` (poignée, croix) ;
//   H6 OÙ RANGER  — un achat vu « en route » puis « arrivé » : la cloche le compte, sa
//                   ligne propose la PREMIÈRE CASE LIBRE (règles du Stock) et « Ranger »
//                   ouvre le Stock ; rien n'est envoyé au téléphone ; meubles pas lus
//                   ⇒ rien n'est proposé ; première lecture ⇒ rien non plus.
//  Réglages : `BANC_PORT` (9300–9349, 9310 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `SHOTS=<dossier>` (captures à REGARDER), `BANC_DIST` (un
//  autre dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9310';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || '';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`);
};
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

// Le jeu : celui de `nouveau-vendeur` + deux meubles (le premier a sa case 1 prise
// par le N°1) + l'achat 73001 « livré » (il était « expédié » sur cet appareil).
const MEUBLES = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }, { id: 'mB', name: 'Étagère B', cols: 2, rows: 2 }];
const jeu = ({ meubles = true, arrive = true } = {}) => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = l.find((x) => x.id === 'main');
  if (meubles) { main.data.vrm_meubles = MEUBLES; main.data.vrm_slots = { 1: { m: 'mA', i: 0 } }; }
  if (arrive) { const a = l.find((x) => x.id === 'harvest_111_orders_purchased'); a.data.payload.my_orders.find((o) => o.transaction_id === 73001).status = 'Commande livrée'; }
  return l;
};
const VUS = { 73000: 'autre', 73001: 'autre', 73002: 'autre' };

const sonde = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false; } return true; };
  const tete = document.querySelector('.vrm-app-header');
  const boutons = tete ? [...tete.querySelectorAll('button')].filter(vis) : [];
  const etat = tete && tete.querySelector('[data-etat-actions]');
  const apres = etat ? getComputedStyle(etat, '::after').content : '';
  const point = etat && etat.querySelector('.vrm-etat-point');
  const ps = point ? getComputedStyle(point) : null;
  return {
    boutons: boutons.map((b) => b.getAttribute('aria-label') || b.innerText.trim()).slice(0, 12),
    iEnCss: /["']i["']/.test(apres || ''),
    point: point ? { vis: vis(point), w: Math.round(point.getBoundingClientRect().width), fond: ps.backgroundColor } : null,
    nuage: tete ? [...tete.querySelectorAll('.vrm-sync-status')].filter(vis).map((b) => b.getAttribute('data-sync-etat')) : [],
    stream: document.querySelectorAll('[data-bouton-stream]').length, oeil: document.querySelectorAll('[data-bouton-montants]').length,
  };
});

async function enTete(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'journee' });
  const { pg } = o; await attendre(3500);
  const s = await sonde(pg);
  if (W < 600) {
    dit(!s.iEnCss, 'H1', `${T} aucune icône « ⓘ » pour l'état au téléphone`, JSON.stringify(s));
    dit(s.point && s.point.vis && s.point.w >= 8 && !/rgba\(0, 0, 0, 0\)/.test(s.point.fond), 'H1', `${T} l'état est un point de couleur visible`, JSON.stringify(s.point));
    dit(s.boutons.length <= 4, 'H1', `${T} au plus 4 commandes dans l'en-tête quand tout va bien (${s.boutons.length})`, s.boutons.join(' | '));
  }
  dit(!s.nuage.length, 'H1', `${T} le nuage n'est pas dans l'en-tête quand rien n'a raté`, JSON.stringify(s.nuage));
  // (6 nov.) « Stream » n'est dans l'en-tête que s'il est choisi dans les réglages
  // (éteint par défaut) ; sans lui, l'œil des montants (un seul des deux).
  dit(s.stream === 0 && s.oeil === 1, 'H1', `${T} par défaut : l'œil des montants, pas de bouton « Stream » (un seul bouton)`, JSON.stringify({ stream: s.stream, oeil: s.oeil }));
  await capture(pg, `ch-entete-${W}-${theme}`);
  // H2 — le panneau de la pastille.
  await pg.locator('.vrm-app-header [data-etat-actions]').first().click().catch(() => {});
  await pg.waitForFunction(() => { const d = document.querySelector('[data-etat-derniere]'); return d && d.getAttribute('data-etat-derniere') !== 'encours'; }, null, { timeout: 8000 }).catch(() => {});
  await attendre(400);
  const p = await pg.evaluate(() => {
    const d = document.querySelector('[data-etat-derniere]');
    const lignes = [...document.querySelectorAll('[data-fraicheur-compte]')].map((l) => ({ p: l.getAttribute('data-fraicheur-compte'), t: l.innerText }));
    return { etat: d && d.getAttribute('data-etat-derniere'), source: d && d.getAttribute('data-etat-derniere-source'), txt: d ? d.innerText : '', lignes };
  });
  const relus = p.lignes.filter((l) => l.p === 'vinted' && /relu|ouvert/.test(l.t)).length;
  dit(relus >= 1 && p.etat === 'lue', 'H2', `${T} « Dernière capture » ne contredit pas la liste (${relus} compte(s) Vinted relus ⇒ capture « lue »)`, JSON.stringify(p));
  dit(relus >= 1 && p.source === 'comptes', 'H2', `${T} « Dernière capture » lit la MÊME source que la liste`, JSON.stringify({ source: p.source }));
  await capture(pg, `ch-pastille-${W}-${theme}`);
  await pg.keyboard.press('Escape'); await attendre(300);
  // H4 — la navigation.
  const nv = await pg.evaluate((tel) => {
    const sig = (b) => { const l = b.querySelector('[data-nav-logo]'); if (l) return 'logo:' + l.getAttribute('data-nav-logo'); const im = b.querySelector('img'); if (im) return 'img:' + im.getAttribute('src'); const sv = b.querySelector('svg'); return sv ? sv.innerHTML.replace(/\s+/g, '') : ''; };
    const entrees = [...document.querySelectorAll(tel ? '.vrm-tabbar .vrm-tab, [data-nav-entree]' : '.vrm-sidebar [data-nav-entree], [data-nav-entree]')].filter((b) => b.getClientRects().length);
    const vu = {}; const doublons = [];
    for (const b of entrees) { const k = sig(b); const n = (b.getAttribute('aria-label') || b.innerText || '').trim().split('\n')[0]; if (!k) continue; if (vu[k] && vu[k] !== n) doublons.push(`${vu[k]} = ${n}`); else vu[k] = n; }
    const badges = {}; for (const x of document.querySelectorAll('[data-badge-nav]')) if (x.getClientRects().length) badges[x.getAttribute('data-badge-nav')] = x.getAttribute('data-badge-n');
    return { n: entrees.length, doublons, badges };
  }, W < 600);
  if (W >= 600) dit(nv.n >= 10 && !nv.doublons.length, 'H4', `${T} colonne : une icône par entrée (${nv.n} entrées)`, nv.doublons.join(' ¦ '));
  dit(!(nv.badges.ventes && nv.badges.cat_bord), 'H4', `${T} le même colis ne porte pas deux badges (Ventes ET Colis)`, JSON.stringify(nv.badges));
  if (W < 600) {
    await pg.locator('.vrm-tab', { hasText: 'Plus' }).first().click().catch(() => {}); await attendre(800);
    const pl = await pg.evaluate(() => {
      const tuiles = [...document.querySelectorAll('[data-nav-entree]')].filter((b) => b.getClientRects().length);
      const vu = {}; const d = [];
      for (const b of tuiles) { const sv = b.querySelector('svg, [data-nav-logo]'); const k = sv ? (sv.getAttribute('data-nav-logo') || sv.innerHTML.replace(/\s+/g, '')) : ''; const n = b.innerText.trim(); if (!k) continue; if (vu[k] && vu[k] !== n) d.push(vu[k] + ' = ' + n); else vu[k] = n; }
      return { n: tuiles.length, d };
    });
    dit(pl.n >= 6 && !pl.d.length, 'H4', `${T} « Plus » : une icône par écran (${pl.n} tuiles)`, pl.d.join(' ¦ '));
    await capture(pg, `ch-plus-${W}-${theme}`);
    await pg.keyboard.press('Escape'); await attendre(300);
  }
  // H1 (suite) — une sauvegarde qui rate : le nuage apparaît.
  await pg.route('**/rest/v1/**', (route) => { const m = route.request().method(); if (m === 'POST' || m === 'PATCH') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"indisponible"}' }); return route.fallback(); });
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' }); await attendre(3000);
  await pg.locator('[data-reglage-sombre]').first().click().catch(() => {});   // un réglage SYNCHRONISÉ (vinted_dark)
  await pg.waitForFunction(() => { const b = document.querySelector('.vrm-app-header .vrm-sync-status'); return b && /error|refus/.test(b.getAttribute('data-sync-etat') || ''); }, null, { timeout: 15000 }).catch(() => {});
  const s2 = await sonde(pg);
  dit(s2.nuage.some((x) => x === 'error' || x === 'refus'), 'H1', `${T} une sauvegarde ratée (503) fait apparaître le nuage`, JSON.stringify(s2.nuage));
  await capture(pg, `ch-nuage-${W}-${theme}`);
  dit(!o.journal.erreurs.length, 'H0', `${T} aucune erreur JS (en-tête)`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function parametres(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'settings' });
  const { pg } = o; await attendre(3500);
  const mesure = () => pg.evaluate(() => {
    const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none') return false; } return true; };
    const plein = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return false; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return v.length < 4 || v[3] > 0.05; };
    const carte = (e) => { const s = getComputedStyle(e); return plein(s.backgroundColor) && (s.boxShadow !== 'none' || ['Top', 'Right', 'Bottom', 'Left'].every((c) => parseFloat(s['border' + c + 'Width']) > 0)); };
    const set = document.querySelector('.vrm-set');
    const icones = {}; const doublons = [];
    for (const l of [...document.querySelectorAll('.vrm-set-liste .vrm-set-ligne')].filter(vis)) {
      const sv = l.querySelector('.vrm-set-ic svg'); if (!sv) continue; const k = sv.innerHTML.replace(/\s+/g, ''); const n = (l.querySelector('.vrm-set-lib b') || l).innerText.trim();
      if (icones[k] && icones[k] !== n) doublons.push(`${icones[k]} = ${n}`); else icones[k] = n;
    }
    // Carte dans une carte : une liste (déjà une carte) dans un groupe qui en est une aussi,
    // ou un enfant de liste qui se dessine en carte (fond + cadre ou ombre).
    const cdc = [];
    for (const li of [...document.querySelectorAll('.vrm-set-liste')].filter(vis)) {
      const g = li.closest('.vrm-set-groupe'); if (g && carte(g) && carte(li)) cdc.push('groupe ⊃ liste « ' + (g.querySelector('.vrm-set-titre') || g).innerText.trim().slice(0, 30) + ' »');
      for (const e of li.querySelectorAll('*')) { if (e.closest('.vrm-switch, button, input, label, .vrm-etat-panne-bouton, [data-champ-recherche]')) continue; const r = e.getBoundingClientRect(); if (r.width > li.getBoundingClientRect().width * 0.6 && r.height > 40 && vis(e) && carte(e)) { cdc.push('dans la liste : ' + (e.className || e.tagName) + ' « ' + e.innerText.trim().slice(0, 30) + ' »'); break; } }
    }
    const lignesListe = [...document.querySelectorAll('.vrm-set-liste .vrm-set-ligne')].filter(vis).map((l) => (l.querySelector('.vrm-set-lib b') || l).innerText.trim());
    const st = document.querySelector('.vrm-settings-status'), h1 = document.querySelector('.vrm-set-h1');
    const main = document.querySelector('.vrm-main');
    return {
      doublons, n: Object.keys(icones).length, cdc,
      orgaLigne: lignesListe.includes('Organisation'), orgaLien: !!document.querySelector('[data-reglage-organisation]') && vis(document.querySelector('[data-reglage-organisation]')),
      statut: st && vis(st) && h1 ? { haut: Math.round(st.getBoundingClientRect().top), titreHaut: Math.round(h1.getBoundingClientRect().top), titreBas: Math.round(h1.getBoundingClientRect().bottom) } : null,
      gauche: h1 && main ? Math.round(h1.getBoundingClientRect().left - main.getBoundingClientRect().left) : null,
      texte: set ? set.innerText : '',
      avatars: [...document.querySelectorAll('[data-profil-compte] .vrm-set-avatar, [data-photo-profil] span')].filter((e) => vis(e) && /^[A-Z?]$|^$/.test(e.innerText.trim()) && e.getBoundingClientRect().width >= 40).length,
      photoHors: [...document.querySelectorAll('[data-photo-profil]')].filter((e) => vis(e) && !e.closest('[data-profil-compte]')).length,
      discord: [...document.querySelectorAll('[data-connexion-compte="discord"], [data-connexion-indispo="discord"]')].filter(vis).length + [...document.querySelectorAll('[data-discord-compte]')].filter(vis).length,
    };
  });
  const m = await mesure();
  dit(!m.doublons.length && m.n >= 12, 'H3', `${T} Réglages : une icône par ligne (${m.n} distinctes)`, m.doublons.join(' ¦ '));
  dit(!m.orgaLigne && m.orgaLien, 'H3', `${T} « Organisation » n'est plus une ligne de la liste, mais reste joignable par son lien`, JSON.stringify({ ligne: m.orgaLigne, lien: m.orgaLien }));
  dit(!m.cdc.length, 'H3', `${T} Réglages : aucune carte dans une carte`, m.cdc.join(' ¦ '));
  dit(!m.statut || (m.statut.haut >= m.statut.titreHaut - 4 && m.statut.haut <= m.statut.titreBas), 'H3', `${T} « Enregistrement… » dans la ligne du titre, pas au-dessus`, JSON.stringify(m.statut));
  if (W >= 1024) {
    dit(m.gauche != null && m.gauche <= 24, 'H3', `${T} la colonne commence où commencent les autres écrans (titre à ${m.gauche} px du bord du contenu)`, String(m.gauche));
  }
  const ECARTES = /\b(r[ée]gime fiscal|comptes connect[ée]s|emails)\b/i;
  dit(!ECARTES.test(m.texte), 'H3', `${T} Réglages : aucun mot écarté (« régime fiscal », « comptes connectés », « emails »)`, (m.texte.match(ECARTES) || [''])[0]);
  await capture(pg, `ch-reglages-${W}-${theme}`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ch-reglages-${W}-${theme}-page.png`), fullPage: true }).catch(() => {});
  // Mon compte.
  await pg.locator('[data-onglets-reglages] [data-vue="compte"]').first().click().catch(() => {}); await attendre(1800);
  const c = await mesure();
  dit(!c.doublons.length, 'H3', `${T} Mon compte : une icône par ligne (${c.n} distinctes)`, c.doublons.join(' ¦ '));
  dit(!c.cdc.length, 'H3', `${T} Mon compte : aucune carte dans une carte`, c.cdc.join(' ¦ '));
  dit(c.avatars === 1 && c.photoHors === 0, 'H3', `${T} Mon compte : UN avatar (la photo se change dans la carte du profil)`, JSON.stringify({ avatars: c.avatars, photoHors: c.photoHors }));
  dit(c.discord === 1, 'H3', `${T} Mon compte : Discord dit UNE fois`, String(c.discord));
  await capture(pg, `ch-moncompte-${W}-${theme}`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ch-moncompte-${W}-${theme}-page.png`), fullPage: true }).catch(() => {});
  dit(!o.journal.erreurs.length, 'H0', `${T} aucune erreur JS (Paramètres)`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function cloche(nav, { W, theme, scenario }) {
  const T = `[${W}px ${theme} ${scenario}]`;
  const base = { lignes: jeu({ meubles: scenario !== 'sans-meubles' }), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base, tab: 'journee' });
  const { pg } = o;
  const envois = [];
  pg.on('request', (r) => { const u = r.url(); if (/\/api\/push|push_journal/.test(u) && r.method() !== 'GET') envois.push(r.method() + ' ' + u.replace(/^https?:\/\/[^/]+/, '').slice(0, 80)); });
  if (scenario !== 'premiere') await pg.evaluate((v) => { try { localStorage.setItem('vrm_ranger_vus', JSON.stringify(v)); localStorage.removeItem('vrm_ranger_proposes'); } catch (_) {} }, VUS);
  else await pg.evaluate(() => { try { localStorage.removeItem('vrm_ranger_vus'); localStorage.removeItem('vrm_ranger_proposes'); } catch (_) {} });
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await attendre(4000);
  // La cloche lit les achats 4 s après le chargement du nuage : on attend la pastille (au plus 15 s).
  if (scenario === 'arrive') await pg.waitForFunction(() => !!document.querySelector('[data-centre-notifs-cloche] .vrm-cn-pastille'), null, { timeout: 15000 }).catch(() => {});
  else await attendre(6000);
  const pastille = await pg.evaluate(() => { const p = document.querySelector('[data-centre-notifs-cloche] .vrm-cn-pastille'); return p ? p.innerText.trim() : ''; });
  await pg.locator('[data-centre-notifs-cloche]').first().click().catch(() => {});
  await pg.waitForSelector('[data-centre-notifs]', { timeout: 6000 }).catch(() => {});
  await attendre(1600);
  const f = await pg.evaluate(() => {
    const s = document.querySelector('[data-centre-notifs]');
    return s ? {
      shell: s.classList.contains('vrm-fs'), poignee: !!s.querySelector('[data-feuille-poignee]'), croix: !!s.querySelector('[data-feuille-croix]'),
      lignes: [...s.querySelectorAll('[data-centre-ranger-tx]')].map((l) => ({ tx: l.getAttribute('data-centre-ranger-tx'), cas: l.getAttribute('data-centre-ranger-case'), t: l.innerText })),
    } : null;
  });
  if (scenario === 'arrive') {
    dit(f && f.shell && f.poignee && f.croix, 'H5', `${T} la cloche est la feuille de l'app (SheetShell : poignée, croix)`, JSON.stringify(f && { shell: f.shell, poignee: f.poignee, croix: f.croix }));
    dit(f && f.lignes.length === 1 && f.lignes[0].tx === '73001' && f.lignes[0].cas === 'mA:1', 'H6', `${T} l'achat 73001 « arrivé » propose la première case libre (Étagère A, case 2)`, JSON.stringify(f && f.lignes));
    dit(pastille === '1', 'H6', `${T} la cloche le compte (pastille « 1 »)`, JSON.stringify(pastille));
    await capture(pg, `ch-cloche-ranger-${W}-${theme}`);
    await pg.locator('[data-centre-ranger-ouvrir="73001"]').first().click().catch(() => {}); await attendre(1500);
    const ecran = await pg.evaluate(() => (document.querySelector('.vrm-main') || {}).getAttribute ? document.querySelector('.vrm-main').getAttribute('data-ecran') : null);
    dit(ecran === 'garage', 'H6', `${T} « Ranger » ouvre le Stock`, String(ecran));
    dit(!envois.length, 'H6', `${T} rien n'est envoyé au téléphone (aucune écriture de notification)`, envois.join(' ¦ '));
  } else {
    dit(f && f.lignes.length === 0 && (pastille === '' || pastille === '0'), 'H6', `${T} ${scenario === 'premiere' ? 'première lecture sur cet appareil' : 'meubles pas lus'} ⇒ rien n'est proposé`, JSON.stringify({ lignes: f && f.lignes, pastille }));
  }
  dit(!o.journal.erreurs.length, 'H0', `${T} aucune erreur JS (cloche)`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const theme of THEMES) for (const W of LARGEURS) {
      await enTete(nav, { W, theme }).catch((e) => dit(false, 'H0', `[${W} ${theme}] en-tête au bout`, String(e && e.message).slice(0, 300)));
      await parametres(nav, { W, theme }).catch((e) => dit(false, 'H0', `[${W} ${theme}] Paramètres au bout`, String(e && e.message).slice(0, 300)));
      for (const scenario of ['arrive', 'sans-meubles', 'premiere']) {
        if (scenario !== 'arrive' && theme !== THEMES[0]) continue;
        await cloche(nav, { W, theme, scenario }).catch((e) => dit(false, 'H0', `[${W} ${theme} ${scenario}] cloche au bout`, String(e && e.message).slice(0, 300)));
      }
    }
  } catch (e) { dit(false, 'H0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ coque-parametres : ${ko} défaut(s)` : '\n✅ coque-parametres : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
