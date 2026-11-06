require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « STREAM : BOUTON AU CHOIX ET PHOTOS FLOUTÉES » (6 nov.) — l'app RENDUE,
//  données INVENTÉES (le jeu de `nouveau-vendeur.cjs`, avec des photos dessinées
//  ici : une chaussure et le nom de SA marque, en SVG). 390 px tactile ET
//  1512 px, clair ET sombre. Jugé sur des `data-*`, le style CALCULÉ, le texte
//  rendu — jamais un libellé.
//  Julien (6 nov.) : « pour le bouton stream tu peux faire une option qui
//  n'apparaît que si on le sélectionne dans les paramètres ; je veux que on
//  puisse aussi flouter les photos en lien avec ce que on veut cacher ».
//   A. Par défaut : AUCUN bouton « Stream » dans l'en-tête ; l'œil des montants
//      est là (44 px au doigt). Un tap : les montants sont cachés, la marque
//      programmée et les photos restent (l'œil ne cache QUE les montants).
//   B. Réglages → Mode stream : « Afficher le bouton Stream » (éteint) ; l'aperçu
//      montre deux photos inventées, l'une FLOUTÉE (son article a la marque),
//      l'autre nette ; cocher l'option ⇒ « Stream » dans l'en-tête, l'œil part,
//      et le choix part au nuage (POST de `main.vrm_stream_regles.bouton`).
//   C. Stream allumé, programme « Adidas » : sur Annonces, Ventes, Colis, Messages
//      (et Achats), chaque photo d'un article Adidas est floutée (attribut ET
//      flou calculé ≥ 16 px), aucune photo d'une autre marque ne l'est ; aucun
//      texte alternatif, `aria-label` ni `title` ne dit « Adidas » ; la visionneuse
//      « Agrandir » d'une vente Adidas est floutée.
//   D. « Flouter toutes les photos » ⇒ toutes floutées ; « Flouter aussi les
//      photos » décoché ⇒ aucune (le texte reste caché).
//   E. Décocher l'option pendant que le stream est allumé : le bouton RESTE (rien
//      ne se montre d'un coup) et l'œil se tait (une seule porte) ; un tap l'éteint,
//      le bouton part, l'œil revient, plus aucune photo floutée.
//  `SHOTS=dossier` : une capture par étape (à REGARDER). `PARTIES=A,B,C,D,E`.
//  Port : `BANC_PORT` (9750 par défaut).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9750';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const NV = require('./nouveau-vendeur.cjs');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'A,B,C,D,E');
const ECRANS = liste('ECRANS', 'vinted_annonces,ventes,cat_bord,messages,achats');
const CACHEE = 'Adidas';

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

// Une photo INVENTÉE : une chaussure, le nom de sa marque écrit dessus, et un
// marqueur (`banc-photo-<marque>`) qui dit au banc de quel article elle est.
const COULEURS = { Nike: '#d9e4f5', Adidas: '#f5e3d9', 'New Balance': '#e2f5d9', Asics: '#efd9f5', Salomon: '#f5f2d9' };
const photo = (marque) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><desc>banc-photo-${marque.replace(/ /g, '_')}</desc><rect width="160" height="120" fill="${COULEURS[marque] || '#eee'}"/><path d="M16 82c0-8 5-13 13-15l32-6c8-2 13-8 18-15l8-9c4-4 11-3 13 1l7 12c4 7 12 11 20 12l12 3c7 1 11 7 11 13v7H16z" fill="#1d1d1f"/><rect x="16" y="88" width="134" height="10" rx="5" fill="#fff" stroke="#1d1d1f" stroke-width="2"/><text x="58" y="80" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="15" fill="#fff">${marque.toUpperCase()}</text></svg>`);
const marqueDe = (titre) => ['New Balance', 'Nike', 'Adidas', 'Asics', 'Salomon'].find((m) => String(titre || '').startsWith(m)) || null;

const base = (regles) => {
  const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = lignes.find((l) => l.id === 'main');
  main.data.vrm_stream_regles = { v: 1, marques: [CACHEE], ...(regles || {}) };
  for (const l of lignes) {
    const p = l.data && l.data.payload; if (!p) continue;
    for (const it of [...(p.items || []), ...(p.my_orders || [])]) { const m = marqueDe(it.title); if (m) it.photo = { url: photo(m) }; }
  }
  // Les conversations : l'article et sa photo (forme de l'inbox Vinted).
  const titres = { 301: 'Adidas Samba OG noire taille 40', 302: 'Nike Air Max 90 blanche taille 42', 401: 'New Balance 550 crème taille 41' };
  for (const id of ['harvest_111_inbox', 'harvest_222_inbox']) {
    const l = lignes.find((x) => x.id === id);
    for (const c of l.data.payload.conversations) { const t = titres[c.id]; if (t) { c.item_title = t; c.item_photos = [{ url: photo(marqueDe(t)) }]; } }
  }
  return { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
};

// Les photos d'article de la page : leur marque (marqueur du SVG), floutée ou non
// (attribut ET flou calculé), et les textes alternatifs qui fuiraient.
const PHOTOS = (pg) => pg.evaluate((cachee) => {
  const out = [];
  for (const img of document.querySelectorAll('img')) {
    const src = img.getAttribute('src') || '';
    const m = /banc-photo-([A-Za-z_]+)/.exec(decodeURIComponent(src));
    if (!m) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const f = getComputedStyle(img).filter || '';
    const px = Number((/blur\(([\d.]+)px\)/.exec(f) || [])[1] || 0);
    out.push({ marque: m[1].replace(/_/g, ' '), attr: img.hasAttribute('data-stream-photo'), px, alt: img.getAttribute('alt') || '' });
  }
  const re = new RegExp(cachee, 'i');
  const fuites = [];
  for (const el of document.querySelectorAll('[alt], [aria-label], [title]')) for (const a of ['alt', 'aria-label', 'title']) { const v = el.getAttribute(a); if (v && re.test(v) && !el.closest('[data-stream-libre]')) fuites.push(a + '=' + v.slice(0, 60)); }
  return { photos: out, fuites: fuites.slice(0, 5), nFuites: fuites.length, texte: re.test(document.body.innerText || ''), stream: document.documentElement.getAttribute('data-stream') };
}, CACHEE);
// Un écran d'articles attend que les lectures soient arrivées (une photo du banc
// à l'écran, 15 s au plus) : sous charge, « pas lu » passait pour un écran vide.
const aller = async (pg, tab, ms = 2400) => {
  await pg.goto(`http://localhost:${NV.PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {});
  if (!/^settings/.test(tab)) await pg.waitForFunction(() => [...document.images].some((i) => /banc-photo/.test(decodeURIComponent(i.getAttribute('src') || ''))), null, { timeout: 15000 }).catch(() => {});
  await attendre(ms);
};
const tete = (pg) => pg.evaluate(() => {
  const vis = (x) => { if (!x) return null; const r = x.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0, presse: x.getAttribute('aria-pressed') }; };
  return { stream: document.querySelectorAll('.vrm-app-header [data-bouton-stream]').length, oeil: document.querySelectorAll('.vrm-app-header [data-bouton-montants]').length, bStream: vis(document.querySelector('.vrm-app-header [data-bouton-stream]')), bOeil: vis(document.querySelector('.vrm-app-header [data-bouton-montants]')), racine: document.documentElement.getAttribute('data-stream') };
});
const ouvrirReglages = async (pg) => {
  await aller(pg, 'settings&vue=reglages', 2000);
  await pg.click('[data-sous-ouvrir="stream"]').catch(() => {});
  await pg.waitForSelector('[data-stream-reglages]', { state: 'visible', timeout: 8000 }).catch(() => {});
  await attendre(400);
};
const basculer = async (pg, option) => { await pg.click(`[data-stream-option="${option}"] button[role="switch"]`, { timeout: 5000 }).catch(() => {}); await attendre(500); };
const attendreNuage = async (b, test) => { for (let i = 0; i < 30; i++) { const m = b.lignes.find((l) => l.id === 'main'); const r = m && m.data && m.data.vrm_stream_regles; if (r && test(r)) return r; await attendre(300); } return null; };

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tag = `${W}-${theme}`;
      const b = base();
      const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base: b, tab: 'vinted_annonces' });
      await attendre(2500);
      // ── A. Par défaut : pas de « Stream », l'œil des montants ──────────────
      if (PARTIES.includes('A')) {
        await aller(pg, 'vinted_annonces');
        const t = await tete(pg);
        dit(t.stream === 0, `A ${tag} : par défaut, AUCUN bouton « Stream » dans l'en-tête`, JSON.stringify(t));
        dit(t.oeil === 1 && t.bOeil && t.bOeil.vis, `A ${tag} : l'œil des montants est là (on peut toujours cacher ses chiffres)`, JSON.stringify(t));
        if (W < 600 && t.bOeil) dit(t.bOeil.w >= 43.5 && t.bOeil.h >= 43.5, `A ${tag} : l'œil fait 44 px au doigt`, JSON.stringify(t.bOeil));
        const avant = await PHOTOS(pg);
        dit(avant.photos.length >= 6 && avant.photos.some((p) => p.marque === CACHEE) && avant.photos.some((p) => p.marque !== CACHEE), `A ${tag} : Annonces montre des photos (${CACHEE} et autres) — le banc n'est pas vide`, JSON.stringify(avant.photos.map((p) => p.marque)));
        dit(avant.photos.every((p) => !p.attr && p.px === 0), `A ${tag} : hors stream, aucune photo floutée`, JSON.stringify(avant.photos.filter((p) => p.attr || p.px)));
        await capture(pg, `A-${tag}-defaut`);
        await pg.click('.vrm-app-header [data-bouton-montants]').catch(() => {}); await attendre(500);
        const oeil = await pg.evaluate(() => { const t = document.body.innerText || ''; return { montants: (t.match(/\d(?:[\d   .,]*\d)?[   ]?€/g) || []).length, racine: document.documentElement.getAttribute('data-stream'), memo: localStorage.getItem('vrm_montants_caches'), presse: (document.querySelector('[data-bouton-montants]') || { getAttribute: () => null }).getAttribute('aria-pressed') }; });
        const p2 = await PHOTOS(pg);
        dit(oeil.montants === 0 && oeil.racine === 'm' && oeil.memo === '1' && oeil.presse === 'true', `A ${tag} : un tap sur l'œil cache les montants (sur cet appareil, le bouton le dit)`, JSON.stringify(oeil));
        dit(p2.texte && p2.photos.every((p) => !p.attr && p.px === 0), `A ${tag} : l'œil ne cache QUE les montants (marque lisible, photos nettes)`, JSON.stringify({ texte: p2.texte, floues: p2.photos.filter((p) => p.attr || p.px).length }));
        await capture(pg, `A-${tag}-oeil`);
        await pg.click('.vrm-app-header [data-bouton-montants]').catch(() => {}); await attendre(400);
        const rendu = await pg.evaluate(() => ({ montants: ((document.body.innerText || '').match(/\d(?:[\d   .,]*\d)?[   ]?€/g) || []).length, racine: document.documentElement.getAttribute('data-stream') }));
        dit(rendu.montants > 0 && rendu.racine === '0', `A ${tag} : un second tap rend les montants`, JSON.stringify(rendu));
      }
      // ── B. Réglages : l'option, l'aperçu, le nuage ─────────────────────────
      if (PARTIES.includes('B')) {
        await ouvrirReglages(pg);
        const r = await pg.evaluate(() => ({
          option: (document.querySelector('[data-stream-option="bouton"]') || { getAttribute: () => null }).getAttribute('data-stream-bouton'),
          photos: (document.querySelector('[data-stream-option="photos"]') || { getAttribute: () => null }).getAttribute('data-stream-cache'),
          toutes: (document.querySelector('[data-stream-option="photosToutes"]') || { getAttribute: () => null }).getAttribute('data-stream-cache'),
          vignettes: [...document.querySelectorAll('[data-apercu-photo]')].map((f) => { const i = f.querySelector('img'); const fl = i ? getComputedStyle(i).filter : ''; return { etat: f.getAttribute('data-apercu-photo'), px: Number((/blur\(([\d.]+)px\)/.exec(fl) || [])[1] || 0), legende: (f.innerText || '').trim() }; }),
        }));
        dit(r.option === '0' && r.photos === '1' && r.toutes === '0', `B ${tag} : « Afficher le bouton Stream » éteint, « Flouter aussi les photos » allumé, « toutes » éteint`, JSON.stringify(r));
        const fl = r.vignettes.find((v) => v.etat === 'floue'), ne = r.vignettes.find((v) => v.etat === 'nette');
        dit(r.vignettes.length === 2 && fl && fl.px >= 16 && ne && ne.px === 0, `B ${tag} : l'aperçu montre une photo inventée FLOUTÉE (sa marque) et une nette`, JSON.stringify(r.vignettes));
        dit(fl && !/adidas/i.test(fl.legende) && /•••/.test(fl.legende), `B ${tag} : la légende de la photo floutée cache la marque`, JSON.stringify(fl));
        await pg.locator('[data-stream-apercu-photos]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `B-${tag}-reglages-apercu`);
        const avant = b.ecritures;
        await basculer(pg, 'bouton');
        const t = await tete(pg);
        dit(t.stream === 1 && t.oeil === 0 && t.bStream && t.bStream.vis, `B ${tag} : option cochée ⇒ « Stream » dans l'en-tête, l'œil part`, JSON.stringify(t));
        const env = await attendreNuage(b, (x) => x.bouton === true);
        dit(!!env && b.ecritures > avant && env.marques && env.marques[0] === CACHEE, `B ${tag} : le choix est synchronisé (main.vrm_stream_regles.bouton)`, JSON.stringify(env));
        await capture(pg, `B-${tag}-bouton-coche`);
      }
      // ── C. Stream allumé : les photos de la marque cachée sont floutées ─────
      if (PARTIES.includes('C')) {
        await aller(pg, 'vinted_annonces');
        if ((await tete(pg)).stream) await pg.click('.vrm-app-header [data-bouton-stream]').catch(() => {}); else await pg.evaluate(() => localStorage.setItem('vrm_stream', '1'));
        await attendre(500);
        for (const e of ECRANS) {
          await aller(pg, e, 2600);
          const r = await PHOTOS(pg);
          const cibles = r.photos.filter((p) => p.marque === CACHEE), autres = r.photos.filter((p) => p.marque !== CACHEE);
          const ratees = cibles.filter((p) => !p.attr || p.px < 16), trop = autres.filter((p) => p.attr || p.px > 0);
          const strict = e !== 'achats';
          if (strict) dit(cibles.length > 0, `C ${tag} : ${e} — au moins une photo ${CACHEE} à l'écran (le banc n'est pas vide)`, JSON.stringify(r.photos.map((p) => p.marque)));
          dit(ratees.length === 0, `C ${tag} : ${e} — chaque photo ${CACHEE} est floutée (${cibles.length}, flou ≥ 16 px)`, JSON.stringify(ratees));
          dit(trop.length === 0, `C ${tag} : ${e} — aucune photo d'une autre marque n'est floutée (${autres.length} nettes)`, JSON.stringify(trop.map((p) => p.marque)));
          dit(r.nFuites === 0 && !r.texte, `C ${tag} : ${e} — « ${CACHEE} » ne se lit ni dans le texte ni dans alt/aria-label/title`, JSON.stringify({ fuites: r.fuites, texte: r.texte }));
          // La capture montre une photo floutée ET ses voisines (à regarder).
          await pg.evaluate(() => { const f = document.querySelector('[data-stream-photo]'); if (f) f.scrollIntoView({ block: 'center' }); });
          await attendre(300);
          await capture(pg, `C-${tag}-${e}`);
        }
        // La visionneuse « Agrandir » d'une vente Adidas (Ventes · Vinted).
        await aller(pg, 'plat_vinted', 2600);
        // La vente s'ouvre (son tiroir), puis sa photo s'agrandit.
        const est = (i, cachee) => i && new RegExp('banc-photo-' + cachee).test(decodeURIComponent(i.getAttribute('src') || ''));
        await pg.evaluate(([cachee, f]) => { const est = new Function('return ' + f)(); for (const l of document.querySelectorAll('[data-ligne-ouverte]')) { if (est(l.querySelector('img'), cachee)) { const t = l.querySelector('.vrm-ledger-sale-toggle'); if (t) { t.click(); return; } } } }, [CACHEE, est.toString()]);
        await attendre(700);
        const ouvert = await pg.evaluate(([cachee, f]) => { const est = new Function('return ' + f)(); for (const btn of document.querySelectorAll('.vrm-photo-open')) { if (est(btn.querySelector('img'), cachee)) { btn.click(); return true; } } return false; }, [CACHEE, est.toString()]);
        await attendre(600);
        const v = await pg.evaluate(() => { const i = document.querySelector('.vrm-photo-panel img'); if (!i) return null; const f = getComputedStyle(i).filter; return { attr: i.hasAttribute('data-stream-photo'), px: Number((/blur\(([\d.]+)px\)/.exec(f) || [])[1] || 0), alt: i.getAttribute('alt'), titre: (document.querySelector('.vrm-photo-panel') || {}).innerText || '' }; });
        dit(ouvert && v && v.attr && v.px >= 40, `C ${tag} : la visionneuse « Agrandir » d'une vente ${CACHEE} est floutée (flou doublé en grand)`, JSON.stringify({ ouvert, v }));
        dit(v && !/adidas/i.test(v.alt + ' ' + v.titre), `C ${tag} : la visionneuse ne dit pas la marque (titre, alt)`, JSON.stringify(v));
        await capture(pg, `C-${tag}-visionneuse`);
        await pg.keyboard.press('Escape').catch(() => {}); await attendre(300);
      }
      // ── D. « Toutes les photos » / « Flouter aussi les photos » ────────────
      if (PARTIES.includes('D')) {
        await pg.evaluate(() => localStorage.setItem('vrm_stream', '1'));
        await ouvrirReglages(pg);
        await basculer(pg, 'photosToutes');
        await attendreNuage(b, (x) => x.photosToutes === true);
        await aller(pg, 'vinted_annonces');
        const t1 = await PHOTOS(pg);
        dit(t1.photos.length >= 6 && t1.photos.every((p) => p.attr && p.px >= 16), `D ${tag} : « Flouter toutes les photos » ⇒ toutes floutées (${t1.photos.length})`, JSON.stringify(t1.photos.filter((p) => !p.attr).map((p) => p.marque)));
        await capture(pg, `D-${tag}-toutes`);
        await ouvrirReglages(pg);
        await basculer(pg, 'photosToutes'); await basculer(pg, 'photos');
        await attendreNuage(b, (x) => x.photosToutes === false && x.photos === false);
        await aller(pg, 'vinted_annonces');
        const t2 = await PHOTOS(pg);
        dit(t2.photos.length >= 6 && t2.photos.every((p) => !p.attr && p.px === 0) && !t2.texte, `D ${tag} : « Flouter aussi les photos » décoché ⇒ aucune photo floutée, la marque reste cachée dans le texte`, JSON.stringify({ floues: t2.photos.filter((p) => p.attr).length, texte: t2.texte }));
        await ouvrirReglages(pg);
        await basculer(pg, 'photos');
        await attendreNuage(b, (x) => x.photos === true);
      }
      // ── E. Option décochée en plein stream : le bouton reste, puis s'éteint ─
      if (PARTIES.includes('E')) {
        await pg.evaluate(() => localStorage.setItem('vrm_stream', '1'));
        await ouvrirReglages(pg);
        const avant = await pg.evaluate(() => (document.querySelector('[data-stream-option="bouton"]') || { getAttribute: () => null }).getAttribute('data-stream-bouton'));
        if (avant !== '0') await basculer(pg, 'bouton');
        await attendreNuage(b, (x) => x.bouton === false);
        await aller(pg, 'vinted_annonces');
        const t = await tete(pg);
        dit(t.stream === 1 && t.bStream && t.bStream.presse === 'true' && t.racine === '1', `E ${tag} : option décochée, stream allumé ⇒ le bouton RESTE (rien ne se montre d'un coup)`, JSON.stringify(t));
        dit(t.oeil === 0, `E ${tag} : pendant le stream, l'œil se tait (une seule porte dans l'en-tête)`, JSON.stringify(t));
        await capture(pg, `E-${tag}-reste`);
        await pg.click('.vrm-app-header [data-bouton-stream]').catch(() => {}); await attendre(600);
        const t2 = await tete(pg);
        const p = await PHOTOS(pg);
        dit(t2.stream === 0 && t2.oeil === 1 && t2.racine === '0', `E ${tag} : un tap l'éteint ; le bouton part, l'œil revient`, JSON.stringify(t2));
        dit(p.photos.length > 0 && p.photos.every((x) => !x.attr && x.px === 0) && p.texte, `E ${tag} : éteint, photos nettes et marque lisible sans recharger`, JSON.stringify({ floues: p.photos.filter((x) => x.attr).length, texte: p.texte }));
        await capture(pg, `E-${tag}-eteint`);
      }
      dit(journal.erreurs.length === 0, `${tag} : aucune erreur de page`, journal.erreurs.join(' // '));
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n${ko} défaut(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
