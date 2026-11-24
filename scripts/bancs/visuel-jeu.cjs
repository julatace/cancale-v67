// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE LANGAGE « JEU VIDÉO » (24 nov., Julien : « c'est pas visuel, hésite pas à faire des designs comme jeu vidéo » ;
//  d'abord « sur les pop-up »). Récit : docs/passation/2026-11-24-visuel-jeu.md.
//  Sur l'app RENDUE (dist/, base inventée de design-passe.cjs), 390 tactile et 1512, clair et sombre :
//   J1 la carte d'une vente montre LA photo de SA transaction (n° de transaction de l'adresse) — un leurre AU MÊME TITRE,
//      autre transaction, autre photo, n'est jamais pris ; une transaction inconnue au même titre ⇒ AUCUNE photo (l'icône) ;
//   J2 l'étiquette du N° vient du N° que l'émetteur a écrit (« N°124 ») et ce numéro n'est plus écrit dans le texte ;
//   J3 aucune couleur orange calculée (texte, fond, bord, ombre ; confettis compris, saisis en vol) ;
//   J4 mouvement : la carte arrive sur son ressort, la vente fait sa pluie ; `prefers-reduced-motion` ⇒ un fondu, aucune
//      pluie, aucune tuile qui rebondit ;
//   J5 balayer de côté ferme la carte (dans le sens du geste) ; la pile compte « +2 » ;
//   J6 la carte ne couvre jamais la barre du bas (390) ; rien ne déborde ; aucune erreur JS.
//   J7 (Aujourd'hui) l'anneau « pas su » : jamais 0, jamais plein (data-n-anneau-su="0" ⇒ « — »).
//  `SHOTS=dossier` : les captures (à REGARDER) ; `VIDEO=dossier` : un film de la vente et de la quête faite (390, clair).
//  `LARGEURS=390`, `THEMES=clair`. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || '';
const VIDEO = process.env.VIDEO || '';
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
const EXEMPLES = path.join(__dirname, '..', '..', 'public', 'exemple');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

// La base : un LEURRE au même titre que la vente n° 0 du 1er compte, autre transaction, autre article (donc autre photo).
function baseAvecLeurre() {
  const b = base();
  const ligne = b.rows.find((r) => /^harvest_\d+_orders_sold$/.test(r.id));
  const uid = /^harvest_(\d+)_/.exec(ligne.id)[1];
  const vraie = ligne.data.payload.my_orders[0];
  const leurre = { ...vraie, transaction_id: 990000001, item_id: 990000002, photo: { url: 'https://images1.vinted.net/t/990000002/f800/leurre.jpeg?s=abc' } };
  ligne.data.payload.my_orders.push(leurre);
  ligne.data.nItems = ligne.data.payload.my_orders.length;
  return { b, uid, vraie, leurre };
}
// Les photos : de VRAIES photos de sneakers libres (public/exemple/, crédits CREDITS.md), une par article.
const photos = fs.readdirSync(EXEMPLES).filter((f) => /-400\.webp$/.test(f)).sort();
const photoDe = (u) => { let h = 0; for (const c of String(u).replace(/\?.*$/, '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return fs.readFileSync(path.join(EXEMPLES, photos[h % photos.length])); };
async function ouvrir(nav, W, sombre, b, opts = {}) {
  const o = await P.ouvrir(nav, { W, sombre, b, url: opts.url || '/?tab=journee', ...opts });
  const img = (r) => (/images\d*\.vinted\.net/i.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/webp', body: photoDe(r.request().url()) }) : r.fallback());
  await o.ctx.route(/images\d*\.vinted\.net/i, img); await o.pg.route(/images\d*\.vinted\.net/i, img);
  await o.pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
  await o.pg.waitForTimeout(1500);
  o.erreurs.length = 0;
  return o;
}
const poser = (pg, ev) => pg.evaluate((e) => window.dispatchEvent(new CustomEvent('vrm:evenement', { detail: e })), ev);
const vider = (pg) => pg.evaluate(() => window.dispatchEvent(new Event('vrm:evenements-vider')));
const etatCarte = (pg) => pg.evaluate(() => {
  const c = document.querySelector('.n-pop[data-n-pop-rang="0"]'); if (!c) return null;
  const img = c.querySelector('.n-tuile-img'); const etiq = c.querySelector('.n-etiq');
  const corps = c.querySelector('.n-pop-corps');
  return { genre: c.getAttribute('data-n-pop'), photo: c.getAttribute('data-n-pop-photo'), src: img ? img.currentSrc || img.src : '', etiq: etiq ? etiq.getAttribute('data-n-etiq') : '',
    texte: corps ? corps.textContent : '', anim: getComputedStyle(c).animationName, tuileAnim: (c.querySelector('.n-pop-tuile') && getComputedStyle(c.querySelector('.n-pop-tuile')).animationName) || '',
    confettis: c.querySelectorAll('.n-confettis > i').length, bas: c.getBoundingClientRect().bottom, haut: c.getBoundingClientRect().top };
});
// L'orange : teinte 15°–50°, saturation ≥ 30 %, luminosité 20–85 % (tout ce qu'on lirait « orange » ou « ambre »).
const ORANGE = () => {
  const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2; if (M === m) return [0, 0, l]; const d = M - m; const s = l > .5 ? d / (2 - M - m) : d / (M + m); let h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; };
  const out = [];
  const juger = (el, prop, v) => { for (const m of String(v).matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)) { if (m[4] != null && Number(m[4]) < 0.15) continue; const [h, s, l] = hsl(+m[1], +m[2], +m[3]); if (h >= 15 && h <= 50 && s >= 0.3 && l >= 0.2 && l <= 0.85) out.push(`${el.className && el.className.baseVal != null ? el.className.baseVal : el.className} ${prop} ${m[0]}`); } };
  for (const el of document.querySelectorAll('.n-pops, .n-pops *, [data-n-jeu], [data-n-jeu] *')) { const cs = getComputedStyle(el); for (const p of ['color', 'backgroundColor', 'borderTopColor', 'boxShadow', 'fill', 'stroke', 'backgroundImage']) juger(el, p, cs[p]); }
  return out.slice(0, 8);
};

async function pops(nav, W, theme, d) {
  const T = `[pop ${W}px ${theme}]`;
  const o = await ouvrir(nav, W, theme === 'sombre', d.b);
  const pg = o.pg;
  const titre = d.vraie.title;
  // J1 — la vraie vente
  await poser(pg, { title: `Vendu 65 € · ${titre}`, body: 'mon_compte · Prépare le colis', tag: `sale-${d.vraie.transaction_id}`, url: `/?tab=sales&tx=${d.vraie.transaction_id}&compte=${d.uid}`, actions: [{ title: 'Voir la vente', url: '/?tab=sales' }] });
  // (machine chargée) on attend la carte elle-même, puis on compte les éclats tout de suite (ils vivent 1,1 s).
  await pg.waitForSelector('.n-pop[data-n-pop-rang="0"]', { timeout: 5000 }).catch(() => {});
  const eclats = await pg.evaluate(() => document.querySelectorAll('.n-pop[data-n-pop-rang="0"] .n-confettis > i').length);
  await pg.waitForTimeout(250);
  const enVol = await pg.evaluate(ORANGE);
  let e = null; for (let k = 0; k < 20; k++) { e = await etatCarte(pg); if (e && e.photo === '1') break; await pg.waitForTimeout(250); }
  dit(!!e && e.photo === '1' && e.src.includes(`/t/${d.vraie.item_id}/`), `${T} J1 la vente montre la photo de SA transaction (article ${d.vraie.item_id})`, e && e.src);
  dit(!!e && !e.src.includes('990000002'), `${T} J1 le leurre au même titre n'est jamais pris`, e && e.src);
  dit(!!e && e.genre === 'vente' && (W && theme) && e.anim === 'n-pop-entre' && eclats > 0, `${T} J4 la vente arrive sur son ressort avec sa pluie (${e && e.anim}, ${eclats} éclats)`, JSON.stringify(e));
  dit(!enVol.length, `${T} J3 aucune couleur orange pendant la fête (confettis en vol)`, enVol.join(' ¦ '));
  if (W === 390 && theme === 'clair') await capture(pg, `pop-vente-fete-${W}-${theme}`);
  await pg.waitForTimeout(1400);
  await capture(pg, `pop-vente-${W}-${theme}`);
  // J6 — la barre du bas
  if (W < 600) {
    const barre = await pg.evaluate(() => { const n = document.querySelector('.n-onglets'); return n ? n.getBoundingClientRect().top : null; });
    dit(barre == null || (e && e.bas <= barre), `${T} J6 la carte ne couvre pas la barre du bas`, `${e && e.bas} / ${barre}`);
  }
  // J1 bis — transaction inconnue, même titre : aucune photo
  await vider(pg); await pg.waitForTimeout(300);
  await poser(pg, { title: `Vendu 65 € · ${titre}`, body: 'mon_compte', tag: 'sale-990000077', url: `/?tab=sales&tx=990000077&compte=${d.uid}` });
  await pg.waitForTimeout(2500);
  e = await etatCarte(pg);
  dit(!!e && e.photo === '0' && !e.src, `${T} J1 une transaction inconnue au même titre n'a AUCUNE photo (l'icône)`, JSON.stringify(e));
  // J2 — le N° écrit par l'émetteur devient l'étiquette, et n'est plus dans le texte
  await vider(pg); await pg.waitForTimeout(300);
  await poser(pg, { title: 'Bordereau prêt à imprimer', body: 'N°124 · Air Max 90 · déjà tamponné · à déposer avant jeudi', tag: 'bord-1', url: '/?tab=colis' });
  await pg.waitForTimeout(900);
  e = await etatCarte(pg);
  dit(!!e && e.etiq === '124' && !/N°\s?124/.test(e.texte), `${T} J2 l'étiquette dit 124 et le texte ne le redit pas`, JSON.stringify(e && { etiq: e.etiq, texte: e.texte }));
  // J5 — la pile, puis le balayage
  await poser(pg, { title: 'Offre de 55 € · Air Max 90', body: 'Accepte, refuse ou contre-propose', tag: 'offer-1', url: '/?tab=messages' });
  await poser(pg, { title: 'Nouveau favori', body: 'Air Max 90 · mon_compte', tag: 'fav-1', url: '/?tab=messages' });
  await pg.waitForTimeout(900);
  const plus = await pg.evaluate(() => { const b = document.querySelector('[data-n-pops-plus]'); return b ? [b.getAttribute('data-n-pops-plus'), b.textContent] : null; });
  dit(!!plus && plus[0] === '2' && /\+2/.test(plus[1]), `${T} J5 la pile compte « +2 »`, JSON.stringify(plus));
  const orange = await pg.evaluate(ORANGE);
  dit(!orange.length, `${T} J3 aucune couleur orange calculée (pile de 3)`, orange.join(' ¦ '));
  await capture(pg, `pop-pile-${W}-${theme}`);
  const avant = await pg.evaluate(() => document.querySelectorAll('.n-pop').length);
  // le sens de sortie est noté dès qu'il est posé (un observateur), quelle que soit la charge de la machine
  await pg.evaluate(() => { window.__sens = ''; const mo = new MutationObserver(() => { const c = document.querySelector('.n-pop[data-n-pop-sort]'); if (c && !window.__sens) window.__sens = c.getAttribute('data-n-pop-sort'); }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-n-pop-sort'] }); });
  const r = await pg.evaluate(() => { const c = document.querySelector('.n-pop[data-n-pop-rang="0"] .n-pop-corps'); const b = c.getBoundingClientRect(); return { x: b.left + 20, y: b.top + 12 }; });
  if (W < 600) {
    // le doigt : des événements de pointeur tactiles (Playwright n'a pas de glisser tactile)
    await pg.evaluate(async ({ x, y }) => { const c = document.querySelector('.n-pop[data-n-pop-rang="0"]'); const ev = (t, dx) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x + dx, clientY: y, button: 0 }));
      ev('pointerdown', 0); for (const dx of [-10, -40, -90, -140]) { ev('pointermove', dx); await new Promise((ok) => setTimeout(ok, 16)); } ev('pointerup', -140); }, r);
  } else {
    await pg.mouse.move(r.x, r.y); await pg.mouse.down(); for (const dx of [-10, -40, -90, -140]) await pg.mouse.move(r.x + dx, r.y, { steps: 2 }); await pg.mouse.up();
  }
  await pg.waitForTimeout(900);
  const sens = await pg.evaluate(() => window.__sens || '');
  const apres = await pg.evaluate(() => document.querySelectorAll('.n-pop').length);
  dit(sens === 'gauche' && apres === avant - 1, `${T} J5 balayer à gauche ferme la carte vers la gauche (${avant} → ${apres})`, sens);
  dit(!(await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), `${T} J6 rien ne déborde`);
  dit(!o.erreurs.length, `${T} J6 aucune erreur JS`, o.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function reduit(nav, d) {
  const T = '[pop 390px réduit]';
  const orig = nav.newContext.bind(nav);
  nav.newContext = (opt) => orig({ ...opt, reducedMotion: 'reduce' });
  const o = await ouvrir(nav, 390, false, d.b);
  nav.newContext = orig;
  await poser(o.pg, { title: 'Vendu 65 €', body: 'N°124 · Air Max 90', tag: 'sale-1', url: '/?tab=sales' });
  await o.pg.waitForTimeout(250);
  const e = await etatCarte(o.pg);
  const conf = await o.pg.evaluate(() => document.querySelectorAll('.n-confettis').length);
  dit(!!e && e.anim === 'n-pop-fondu' && e.tuileAnim === 'none' && conf === 0, `${T} J4 mouvement réduit : un fondu, aucune pluie, la tuile ne rebondit pas`, JSON.stringify({ anim: e && e.anim, tuile: e && e.tuileAnim, conf }));
  await o.pg.waitForSelector('[data-n-revele]', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(2500);
  const rv = await o.pg.evaluate(() => [...document.querySelectorAll('[data-n-revele]')].map((x) => getComputedStyle(x).animationName));
  dit(rv.length > 0 && rv.every((a) => a === 'none'), `${T} J9 mouvement réduit : les tuiles sont là d'un coup (aucune apparition, ${rv.length})`, JSON.stringify(rv));
  await o.ctx.close();
}

// Le film : la vente qui arrive (390, clair), puis la carte balayée.
async function film(nav, d) {
  if (!VIDEO) return;
  fs.mkdirSync(VIDEO, { recursive: true });
  const orig = nav.newContext.bind(nav);
  nav.newContext = (opt) => orig({ ...opt, recordVideo: { dir: VIDEO, size: { width: 390, height: 844 } } });
  const o = await ouvrir(nav, 390, false, d.b);
  nav.newContext = orig;
  await o.pg.waitForTimeout(800);
  await poser(o.pg, { title: 'Bordereau prêt à imprimer', body: 'N°124 · Air Max 90 · déjà tamponné', tag: 'bord-1', url: '/?tab=colis' });
  await o.pg.waitForTimeout(1600);
  await poser(o.pg, { title: `Vendu 65 € · ${d.vraie.title}`, body: 'mon_compte · Prépare le colis', tag: `sale-${d.vraie.transaction_id}`, url: `/?tab=sales&tx=${d.vraie.transaction_id}&compte=${d.uid}`, actions: [{ title: 'Voir la vente', url: '/?tab=sales' }] });
  await o.pg.waitForTimeout(2600);
  const r = await o.pg.evaluate(() => { const c = document.querySelector('.n-pop[data-n-pop-rang="0"] .n-pop-corps'); const b = c.getBoundingClientRect(); return { x: b.left + 20, y: b.top + 12 }; });
  await o.pg.evaluate(async ({ x, y }) => { const c = document.querySelector('.n-pop[data-n-pop-rang="0"]'); const ev = (t, dx) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x + dx, clientY: y, button: 0 }));
    ev('pointerdown', 0); for (let dx = -6; dx >= -150; dx -= 12) { ev('pointermove', dx); await new Promise((ok) => setTimeout(ok, 24)); } ev('pointerup', -150); }, r);
  await o.pg.waitForTimeout(1800);
  const v = o.pg.video();
  await o.ctx.close();
  if (v) { const p = await v.path(); const cible = path.join(VIDEO, 'pop-vente-390-clair.webm'); try { fs.renameSync(p, cible); } catch (_) {} console.log('film : ' + cible); }
}

// J7 — l'anneau « pas su » rendu tel quel (React côté serveur, le vrai composant) : jamais 0, jamais plein.
async function anneauPasSu() {
  const esb = require(path.join(__dirname, '..', '..', 'node_modules', 'esbuild'));
  const sortie = path.join(require('os').tmpdir(), `banc-jeu-${process.pid}.cjs`);
  esb.buildSync({ stdin: { contents: "export { Anneau, Trajet } from './src/natif/Jeu.jsx'; export { renderToStaticMarkup } from 'react-dom/server'; export { createElement } from 'react';", resolveDir: path.join(__dirname, '..', '..'), loader: 'js' },
    bundle: true, outfile: sortie, format: 'cjs', platform: 'node', loader: { '.css': 'empty', '.js': 'jsx' }, jsx: 'automatic', logLevel: 'error' });
  const m = require(sortie); try { fs.unlinkSync(sortie); } catch (_) {}
  const rendre = (p) => m.renderToStaticMarkup(m.createElement(m.Anneau, p));
  for (const [quoi, p] of [['valeur inconnue', { valeur: null, total: 30 }], ['total inconnu', { valeur: 6, total: null }], ['les deux inconnus', {}], ['total 0', { valeur: 0, total: 0 }]]) {
    const h = rendre(p);
    dit(/data-n-anneau-su="0"/.test(h) && !/n-anneau-plein/.test(h) && />—</.test(h) && !/>0</.test(h), `[anneau] J7 ${quoi} ⇒ pointillé « — », ni 0 ni plein`, h.slice(0, 200));
  }
  const su = rendre({ valeur: 6, total: 30 });
  dit(/data-n-anneau-su="1"/.test(su) && /data-n-anneau-part="0.200"/.test(su) && /n-anneau-plein/.test(su), '[anneau] J7 6 sur 30 ⇒ 0,2 rempli', su.slice(0, 200));
  // Le trajet : aucune étape prouvée ⇒ piste en pointillé, AUCUN camion (« pas su » ne dit pas « au départ ») ; 2 prouvées ⇒ le camion sur la 2e.
  const tr0 = m.renderToStaticMarkup(m.createElement(m.Trajet, { etapes: [{ cle: 'depose', fait: false, ici: false }, { cle: 'enroute', fait: false, ici: false }, { cle: 'livre', fait: false, ici: false }, { cle: 'valide', fait: false, ici: false }], Icon: () => null }));
  dit(/data-n-trajet-su="0"/.test(tr0) && !/n-trajet-pion/.test(tr0), '[trajet] J7 aucune étape prouvée ⇒ pointillé, aucun camion', tr0.slice(0, 160));
  const tr2 = m.renderToStaticMarkup(m.createElement(m.Trajet, { etapes: [{ cle: 'depose', fait: true }, { cle: 'enroute', fait: true, ici: true }, { cle: 'livre', fait: false }, { cle: 'valide', fait: false }], Icon: () => null }));
  dit(/data-n-trajet="1"/.test(tr2) && /--n-trajet-part:0\.333/.test(tr2), '[trajet] J7 deux étapes prouvées ⇒ le camion sur la 2e (1/3 de la piste)', tr2.slice(0, 200));
}
// J8 — Aujourd'hui : l'anneau des colis prêts dit les MÊMES nombres que la case ; les dernières ventes en tuiles.
async function journee(nav, W, theme, d) {
  const T = `[aujourd'hui ${W}px ${theme}]`;
  const o = await ouvrir(nav, W, theme === 'sombre', d.b);
  const pg = o.pg;
  await pg.waitForSelector('[data-v2-cj-ligne="envoyer"]', { timeout: 20000 }).catch(() => {});
  for (let k = 0; k < 40; k++) { const s = await pg.evaluate(() => { const x = document.querySelector('[data-v2-cj-ligne="envoyer"] .n-cc-sous'); return x ? x.textContent : ''; }); if (s && !/lecture/i.test(s)) break; await pg.waitForTimeout(500); }
  await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => {
    const c = document.querySelector('[data-v2-cj-ligne="envoyer"]'); const a = c && c.querySelector('.n-anneau');
    const sous = c && c.querySelector('.n-cc-sous');
    return { n: c && c.getAttribute('data-v2-cj-n'), su: a && a.getAttribute('data-n-anneau-su'), part: a && a.getAttribute('data-n-anneau-part'), sous: sous ? sous.textContent : '',
      tuiles: document.querySelectorAll('[data-n-jeu="ventes"] .n-tuile-paire').length, photos: [...document.querySelectorAll('[data-n-jeu="ventes"] [data-v2-vente]')].map((b) => { const i = b.querySelector('.n-tuile-img'); return [b.getAttribute('data-n-vente-tx') || '', i ? i.getAttribute('src') || '' : '']; }) };
  });
  const n = Number(r.n), m = /(\d+) pas encore prêt/.exec(r.sous);
  const attendu = n > 0 && m ? (n - Number(m[1])) / n : null;
  dit(!!r.su && (attendu == null ? true : Math.abs(Number(r.part) - attendu) < 0.002), `${T} J8 l'anneau des colis dit les nombres de la case (${r.part} ; ${r.n} colis, « ${r.sous} »)`, JSON.stringify(r));
  // La photo d'une tuile est celle de SA vente : le leurre (une vente au même titre) ne prête jamais sa photo à la vraie, ni l'inverse.
  const croise = r.photos.filter(([cle, u]) => (u.includes('/t/990000002/') && !cle.includes('990000001')) || (u.includes(`/t/${d.vraie.item_id}/`) && !cle.includes(String(d.vraie.transaction_id))));
  dit(!croise.length && r.photos.length > 0, `${T} J8 chaque tuile montre la photo de SA vente (${r.photos.length} tuiles ; le leurre au même titre ne prête pas la sienne)`, JSON.stringify(croise.length ? croise : r.photos).slice(0, 300));
  const orange = await pg.evaluate(ORANGE);
  dit(!orange.length, `${T} J3 aucune couleur orange calculée`, orange.join(' ¦ '));
  // J9 — « pas d'un coup en bloc » mais « sans latence » : seul ce qui ARRIVE s'anime ; le 1er élément jamais ; 15 ms d'écart,
  // 120 ms au plus, 160 ms de fondu ; aucune animation d'écran au-delà de 200 ms.
  const rv = await pg.evaluate(() => [...document.querySelectorAll('[data-n-jeu="ventes"] [data-n-revele]')].map((x) => [getComputedStyle(x).animationName, Math.round(parseFloat(getComputedStyle(x).animationDelay) * 1000), Math.round(parseFloat(getComputedStyle(x).animationDuration) * 1000)]));
  const premierLibre = rv.length > 0 && rv[0][0] === 'none';
  const autres = rv.slice(1);
  dit(premierLibre && autres.every(([a, dl, du]) => a === 'none' || (dl <= 120 && du <= 200)) && (autres.length < 2 || autres[0][0] === 'none' || Math.abs(autres[1][1] - autres[0][1] - 15) < 1),
    `${T} J9 la 1re tuile n'attend pas ; les suivantes ≤ 15 ms d'écart, ≤ 120 ms, fondu ≤ 200 ms`, JSON.stringify(rv));
  // J10 — le TOUCHER : quitter Aujourd'hui puis y revenir par la barre ; ce qui est connu revient d'un coup (aucun fondu).
  if (W < 600) {
    await pg.evaluate(() => { const l = [...document.querySelectorAll('.n-onglets [data-n-onglet]')]; if (l[2]) l[2].click(); });
    await pg.waitForTimeout(1500);
    const t = await pg.evaluate(async () => {
      const b = document.querySelectorAll('.n-onglets [data-n-onglet]')[0]; if (!b) return null;
      const t0 = performance.now(); b.click();
      return await new Promise((ok) => { const f = () => { const c = document.querySelector('[data-v2-cj-ligne="envoyer"]'); const r = c && c.getBoundingClientRect();
        if (r && r.height > 0) ok({ ms: Math.round(performance.now() - t0) }); else if (performance.now() - t0 > 5000) ok({ ms: null }); else requestAnimationFrame(f); }; f(); });
    });
    // Les ventes reviennent (déjà montrées pendant la session) : elles n'ont AUCUN fondu, même arrivées après la 1re image.
    // (les blocs sous le pli se montent quand on y descend) on descend jusqu'aux dernières ventes, comme le doigt
    for (let k = 0; k < 12 && !(await pg.$('[data-n-jeu="ventes"] [data-n-revele]')); k++) { await pg.mouse.wheel(0, 700); await pg.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll('.vrm-main, [data-n-defile]')]) if (el) el.scrollTop += 700; }); await pg.waitForTimeout(250); }
    await pg.waitForSelector('[data-n-jeu="ventes"] [data-n-revele]', { timeout: 5000 }).catch(() => {});
    // Une animation QUI JOUE (getAnimations, état « running ») — l'écran peut rester monté derrière l'onglet : ses tuiles
    // gardent leur nom d'animation, finie depuis longtemps ; seul ce qui bouge encore au retour compte.
    if (t) t.anims = await pg.evaluate(() => [...document.querySelectorAll('[data-n-jeu="ventes"] [data-n-revele]')].map((x) => (x.getAnimations ? x.getAnimations() : []).some((a) => a.playState === 'running') ? 'joue' : 'none'));
    await capture(pg, `aujourdhui-retour-${W}-${theme}`);
    dit(!!t && t.ms != null && t.ms < 1500, `${T} J10 du toucher au premier contenu : ${t && t.ms} ms (banc logiciel swiftshader, machine partagée : seuil 1,5 s ; le vrai budget est < 100 ms pour l'état appuyé)`, JSON.stringify(t));
    dit(!!t && (t.anims || []).length > 0 && t.anims.every((a) => a === 'none'), `${T} J10 au retour, les ventes déjà connues sont là d'un coup (aucun fondu)`, JSON.stringify(t));
  }
  await capture(pg, `aujourdhui-${W}-${theme}`);
  const bloc = await pg.$('[data-v2-bloc="ventes"]'); if (bloc && SHOTS) { await bloc.scrollIntoViewIfNeeded(); await pg.waitForTimeout(500); await capture(pg, `aujourdhui-ventes-${W}-${theme}`); }
  dit(!(await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), `${T} J6 rien ne déborde`);
  dit(!o.erreurs.length, `${T} J6 aucune erreur JS`, o.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  try { await anneauPasSu(); } catch (e) { dit(false, '[anneau] J7 rendu', String(e && e.stack || e).slice(0, 400)); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    const d = baseAvecLeurre();
    for (const W of LARGEURS) for (const th of THEMES) { await pops(nav, W, th, d); await journee(nav, W, th, d); }
    await reduit(nav, d);
    await film(nav, d);
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 600)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ visuel-jeu : ${ko} défaut(s)` : '\n✅ visuel-jeu : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
