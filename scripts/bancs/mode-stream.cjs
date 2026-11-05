require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MODE STREAM PROGRAMMÉ » (5 nov.) — l'app RENDUE, données INVENTÉES
//  (le jeu de `nouveau-vendeur.cjs` : 2 comptes Vinted, un compte Leboncoin,
//  ventes, achats, conversations, codes de retrait). 390 px tactile ET 1512 px,
//  clair ET sombre. Jugé sur des `data-*`, le TEXTE RENDU (innerText) et les
//  requêtes — jamais un libellé.
//   A. Hors stream, le banc n'est pas vide : marques, montants et pseudos sont
//      lisibles (sinon il serait vert sur un écran vide).
//   B. Le bouton « Stream » de l'en-tête (`data-bouton-stream`) remplace l'œil
//      des montants (`data-bouton-montants` n'existe plus) : un tap allume,
//      `aria-pressed`, `data-stream="1"` sur la racine, mémorisé sur l'appareil.
//   C. Allumé, avec SON programme (synchronisé, ligne `main.vrm_stream_regles` :
//      marques « Nike », « Adidas » ; mots qui commencent par « Sal » ; annonces
//      qui contiennent « Asics ») : sur CHAQUE écran principal, aucun nom de ses
//      comptes, aucun pseudo d'acheteur, aucun montant, aucune marque programmée,
//      aucune adresse, aucun code de retrait lisible dans le texte rendu ; les N°
//      restent ; une annonce « Asics » est cachée en ligne entière.
//   D. Réglages → Mode stream : les catégories et les listes ; l'aperçu en direct
//      suit une case (montants montrés ⇒ « 89,00 € » dans l'aperçu) ; le geste est
//      ENVOYÉ au nuage (POST de `main` avec `vrm_stream_regles`).
//   E. Éteint d'un tap : le texte revient sans recharger.
//   F. (revue adverse du 5 nov.) Ce qui avait échappé :
//      F1 un pseudo d'acheteur COURT (« ann ») est un mot entier — il ne coupe
//         jamais un autre mot (« Annonces » ne devient pas « •••onces ») : aucun
//         « ••• » collé à une lettre dans le texte rendu ;
//      F2 les codes de retrait gardés HORS LIGNE (base injoignable) sont cachés
//         comme les autres (ils s'écrivaient en clair) ;
//      F3 ce qui S'AFFICHE hors du texte : le texte d'attente d'un champ
//         (« achat 35,00 € (auto) ») suit la règle, un champ de montant (clavier
//         décimal) est flouté — posés dans la page vivante, jugés sur l'attribut.
//  `SHOTS=dossier` : une capture par étape (à REGARDER). `PARTIES=A,B,C,D,E`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const NV = require('./nouveau-vendeur.cjs');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'A,B,C,D,E,F');
const ECRANS = liste('ECRANS', 'journee,annonces,vinted_annonces,ventes,plat_vinted,plat_leboncoin,cat_bord,messages,garage,achats,dashboard,compta,settings');

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

// SON programme (inventé) : rangé dans la ligne `main`, comme le synchroniserait l'app.
const PROGRAMME = { v: 1, marques: ['Nike', 'Adidas'], prefixes: ['Sal'], contient: ['Asics'] };
const base = () => {
  const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = lignes.find((l) => l.id === 'main');
  main.data.vrm_stream_regles = PROGRAMME;
  // F1 : un acheteur au pseudo court et banal (inventé), dans une conversation.
  const inbox = lignes.find((l) => l.id === 'harvest_222_inbox');
  if (inbox) inbox.data.payload.conversations.push({ id: 402, unread: false, updated_at: new Date().toISOString(), description: 'Bonjour', opposite_user: { id: 5402, login: 'ann' } });
  return { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
// Ce qui ne doit JAMAIS être lisible, stream allumé (le jeu inventé du banc).
const INTERDITS = {
  comptes: ['vendeuse_a', 'vendeuse_b', 'Ma boutique', 'nouvelle.vendeuse@exemple.test'],
  acheteurs: ['acheteuse_lyon', 'marc.b', 'sneaker_fan'],
  marques: ['Nike', 'Adidas'],
  prefixes: ['Salomon'],
  contient: ['Asics'],
  adresses: ['8 Rue de la Paix', '35000 Rennes'],
  codes: ['K48291', '582913'],
};
const LIRE = (pg, interdits) => pg.evaluate((I) => {
  const t = document.body.innerText || '';
  const montants = t.match(/\d(?:[\d   .,]*\d)?[   ]?(?:[kM][   ]?)?€|€[   ]?\d/g) || [];
  const fuites = {};
  for (const [cat, mots] of Object.entries(I)) for (const m of mots) {
    const re = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (re.test(t)) (fuites[cat] = fuites[cat] || []).push(m);
  }
  return { montants: montants.length, exMontants: montants.slice(0, 3), fuites, nums: (t.match(/N°\s?[A-Z]?\d+/g) || []).length, lignes: document.querySelectorAll('[data-stream-ligne]').length, long: t.length };
}, interdits);

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tag = `${W}-${theme}`;
      const b = base();
      const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base: b, tab: 'vinted_annonces' });
      await attendre(2500);
      // ── A. Hors stream, le banc n'est pas vide ─────────────────────────────
      if (PARTIES.includes('A')) {
        const vu = { montants: 0, marques: 0, comptes: 0 };
        for (const e of ['vinted_annonces', 'messages']) {
          await pg.goto(`http://localhost:${NV.PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {}); await attendre(2200);
          const r = await LIRE(pg, INTERDITS);
          vu.montants += r.montants; vu.marques += (r.fuites.marques || []).length; vu.comptes += (r.fuites.comptes || []).length + (r.fuites.acheteurs || []).length;
        }
        dit(vu.montants > 0 && vu.marques > 0 && vu.comptes > 0, `A ${tag} : hors stream, montants, marques et pseudos sont lisibles (le banc n'est pas vide)`, JSON.stringify(vu));
        await capture(pg, `A-${tag}-hors-stream`);
      }
      // ── B. Le bouton « Stream » ────────────────────────────────────────────
      await pg.goto(`http://localhost:${NV.PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {}); await attendre(2000);
      const bouton = await pg.evaluate(() => { const x = document.querySelector('[data-bouton-stream]'); if (!x) return null; const r = x.getBoundingClientRect(); return { h: r.height, w: r.width, vis: r.width > 0 && r.height > 0, oeil: document.querySelectorAll('[data-bouton-montants]').length }; });
      if (PARTIES.includes('B')) {
        dit(!!bouton && bouton.vis, `B ${tag} : le bouton « Stream » est dans l'en-tête, visible`, JSON.stringify(bouton));
        dit(!!bouton && bouton.oeil === 0, `B ${tag} : l'œil « cacher les montants » est remplacé`, JSON.stringify(bouton));
        if (W < 600 && bouton) dit(bouton.h >= 43.5 && bouton.w >= 43.5, `B ${tag} : 44 px au doigt`, JSON.stringify(bouton));
      }
      if (bouton) await pg.click('[data-bouton-stream]'); else await pg.evaluate(() => localStorage.setItem('vrm_stream', '1'));
      await attendre(500);
      const etat = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-stream'), memo: localStorage.getItem('vrm_stream'), presse: (document.querySelector('[data-bouton-stream]') || { getAttribute: () => null }).getAttribute('aria-pressed') }));
      if (PARTIES.includes('B')) dit(etat.racine === '1' && etat.memo === '1' && etat.presse === 'true', `B ${tag} : un tap allume, sur cet appareil, le bouton le dit`, JSON.stringify(etat));
      await capture(pg, `B-${tag}-allume`);
      // ── C. Chaque écran principal ──────────────────────────────────────────
      if (PARTIES.includes('C')) {
        let nums = 0, lignesAsics = 0, longueur = 0;
        for (const e of ECRANS) {
          await pg.goto(`http://localhost:${NV.PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {});
          await attendre(2400);
          const r = await LIRE(pg, INTERDITS);
          nums += r.nums; longueur += r.long; if (e === 'vinted_annonces') lignesAsics = r.lignes;
          const cats = Object.keys(r.fuites);
          dit(r.montants === 0, `C ${tag} : ${e} — aucun montant lisible`, JSON.stringify(r.exMontants));
          dit(cats.length === 0, `C ${tag} : ${e} — aucun compte, pseudo, marque programmée, adresse ni code lisible`, JSON.stringify(r.fuites));
          if (['journee', 'vinted_annonces', 'ventes', 'messages', 'cat_bord'].includes(e)) await capture(pg, `C-${tag}-${e}`);
        }
        dit(longueur > 2000, `C ${tag} : les écrans ont rendu du texte (pas un écran vide)`, longueur);
        dit(nums > 0, `C ${tag} : les N° restent lisibles`, nums);
        dit(lignesAsics > 0, `C ${tag} : l'annonce « Asics » est cachée en LIGNE entière (data-stream-ligne)`, lignesAsics);
      }
      // ── D. Réglages → Mode stream : aperçu en direct, synchronisé ─────────
      if (PARTIES.includes('D')) {
        await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=reglages`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {}); await attendre(2000);
        await pg.click('[data-sous-ouvrir="stream"]').catch(() => {});
        await pg.waitForSelector('[data-stream-reglages]', { state: 'visible', timeout: 8000 }).catch(() => {});
        const p = await pg.evaluate(() => ({
          cats: [...document.querySelectorAll('[data-stream-cat]')].map((x) => x.getAttribute('data-stream-cat') + ':' + x.getAttribute('data-stream-cache')),
          listes: [...document.querySelectorAll('[data-stream-liste]')].map((x) => x.getAttribute('data-stream-liste') + ':' + x.getAttribute('data-stream-mots')),
          apercu: (document.querySelector('[data-stream-apercu]') || {}).innerText || '',
          entieres: document.querySelectorAll('[data-stream-apercu] [data-apercu-entiere="1"]').length,
        }));
        dit(p.cats.length >= 7 && p.cats.every((c) => /:1$/.test(c)), `D ${tag} : les catégories, toutes cachées par défaut`, JSON.stringify(p.cats));
        dit(p.listes.join() === 'marques:2,prefixes:1,contient:1', `D ${tag} : SON programme est relu du nuage (marques 2, préfixes 1, contient 1)`, JSON.stringify(p.listes));
        dit(!/\d[\d   ,.]*\s?€/.test(p.apercu) && /•••/.test(p.apercu) && p.entieres >= 1, `D ${tag} : l'aperçu cache montants et mots, et la ligne « contient » entière`, p.apercu.replace(/\n/g, ' | '));
        await capture(pg, `D-${tag}-reglages`);
        const avant = b.ecritures;
        await pg.click('[data-stream-cat="montants"] button[role="switch"]', { timeout: 5000 }).catch(() => {});
        await attendre(400);
        const ap = await pg.evaluate(() => ({ apercu: (document.querySelector('[data-stream-apercu]') || {}).innerText || '', cache: (document.querySelector('[data-stream-cat="montants"]') || { getAttribute: () => null }).getAttribute('data-stream-cache') }));
        dit(ap.cache === '0' && /89,00\s?€/.test(ap.apercu), `D ${tag} : aperçu EN DIRECT — montants montrés ⇒ « 89,00 € » apparaît`, JSON.stringify(ap));
        // Le geste part au nuage (la ligne `main` du banc reçoit le programme).
        let envoye = null;
        for (let i = 0; i < 20 && !envoye; i++) { await attendre(500); const m = b.lignes.find((l) => l.id === 'main'); const r = m && m.data && m.data.vrm_stream_regles; if (b.ecritures > avant && r && r.montants === false) envoye = r; }
        dit(!!envoye && envoye.marques && envoye.marques.length === 2, `D ${tag} : le programme est synchronisé (main.vrm_stream_regles, montants:false)`, JSON.stringify(envoye));
        // Un mot ajouté à la main.
        await pg.fill('[data-stream-liste="marques"] input', 'Puma', { timeout: 5000 }).catch(() => {});
        await pg.click('[data-stream-ajouter="marques"]', { timeout: 5000 }).catch(() => {});
        await attendre(300);
        const n = await pg.evaluate(() => (document.querySelector('[data-stream-liste="marques"]') || { getAttribute: () => null }).getAttribute('data-stream-mots'));
        dit(n === '3', `D ${tag} : un mot s'ajoute à la liste`, n);
        await capture(pg, `D-${tag}-montants-montres`);
        // Rétablir (le reste du banc juge le programme d'origine).
        await pg.click('[data-stream-cat="montants"] button[role="switch"]', { timeout: 5000 }).catch(() => {});
        // ⚠️ `save` écrit après 500 ms : on attend que la base du banc REÇOIVE le
        //    programme rétabli avant de naviguer (sinon le banc jette son propre geste).
        let retabli = false;
        for (let i = 0; i < 30 && !retabli; i++) { await attendre(300); const m = b.lignes.find((l) => l.id === 'main'); const r = m && m.data && m.data.vrm_stream_regles; retabli = !!(r && r.montants === true); }
        dit(retabli, `D ${tag} : la case recochée est synchronisée aussi`, '');
      }
      // ── E. Éteint d'un tap : le texte revient ──────────────────────────────
      if (PARTIES.includes('E')) {
        await pg.goto(`http://localhost:${NV.PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {}); await attendre(2200);
        const dedans = await LIRE(pg, INTERDITS);
        await pg.click('[data-bouton-stream]').catch(() => {}); await attendre(500);
        const dehors = await LIRE(pg, INTERDITS);
        dit(dedans.montants === 0 && dehors.montants > 0 && (dehors.fuites.marques || []).length > 0 && dehors.lignes === 0, `E ${tag} : éteint d'un tap, montants et marques reviennent sans recharger`, JSON.stringify({ dedans: dedans.montants, dehors: dehors.montants, marques: dehors.fuites.marques, lignes: dehors.lignes }));
      }
      // ── F. Revue adverse ──────────────────────────────────────────────────
      if (PARTIES.includes('F')) {
        // F1 : la page des conversations publie le pseudo « ann » ; sur la même page,
        // la barre de navigation et les écrans écrivent « Annonces », « annonce ».
        await pg.evaluate(() => localStorage.setItem('vrm_stream', '1'));
        await pg.goto(`http://localhost:${NV.PORT}/?tab=messages`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {}); await attendre(2600);
        const f1 = await pg.evaluate(() => {
          const t = document.body.innerText || '';
          const colles = t.match(/[\p{L}\p{N}]•••|•••[\p{L}\p{N}]/gu) || [];
          return { colles: colles.length, ex: (t.match(/.{0,12}(?:[\p{L}\p{N}]•••|•••[\p{L}\p{N}]).{0,12}/gu) || []).slice(0, 3), ann: /(^|[^\p{L}])ann([^\p{L}]|$)/u.test(t), annonces: /annonce/i.test(t) };
        });
        dit(f1.colles === 0 && f1.annonces, `F1 ${tag} : un pseudo court ne coupe aucun mot (aucun « ••• » collé à une lettre ; « Annonces » reste lisible)`, JSON.stringify(f1));
        dit(!f1.ann, `F1 ${tag} : le pseudo « ann » lui-même est caché`, JSON.stringify(f1));
        await capture(pg, `F1-${tag}-messages`);
        // F3 : deux champs posés dans la page (la règle de l'app les voit passer).
        const f3 = await pg.evaluate(async () => {
          const d = document.createElement('div');
          d.innerHTML = '<input data-banc-ph placeholder="achat 35,00 € (auto)"><input data-banc-dec inputmode="decimal" value="45">';
          document.querySelector('.vrm-main').appendChild(d);
          await new Promise((r) => setTimeout(r, 300));
          const ph = d.querySelector('[data-banc-ph]').getAttribute('placeholder');
          const dec = d.querySelector('[data-banc-dec]'), flou = getComputedStyle(dec).filter;
          d.remove();
          return { ph, flou };
        });
        dit(!/35/.test(f3.ph) && /•••/.test(f3.ph), `F3 ${tag} : le texte d'attente d'un champ suit la règle`, JSON.stringify(f3));
        dit(/blur/.test(f3.flou), `F3 ${tag} : un champ de montant (clavier décimal) est flouté`, JSON.stringify(f3));
        // F2 : codes gardés sur l'appareil, base injoignable.
        await pg.evaluate(() => localStorage.setItem('vrm_codes_hors_ligne', JSON.stringify({ at: Date.now(), codes: [{ code: 'K48291', titre: 'Colis à retirer', lieu: 'Le Fournil', carrier: 'mondialrelay', suivi: '40817263' }] })));
        await pg.route('**/rest/v1/**', (r) => r.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>error</html>' }));
        await pg.goto(`http://localhost:${NV.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-codes-hors-ligne]', { timeout: 20000 }).catch(() => {});
        await attendre(800);
        const f2 = await pg.evaluate(() => ({ bloc: !!document.querySelector('[data-codes-hors-ligne]'), code: /K48291/.test(document.body.innerText || ''), stream: document.documentElement.getAttribute('data-stream') }));
        dit(f2.bloc, `F2 ${tag} : base injoignable ⇒ les codes gardés hors ligne s'affichent (le banc n'est pas vide)`, JSON.stringify(f2));
        dit(f2.bloc && !f2.code && f2.stream === '1', `F2 ${tag} : stream allumé, le code gardé hors ligne est caché`, JSON.stringify(f2));
        await capture(pg, `F2-${tag}-hors-ligne`);
        await pg.unroute('**/rest/v1/**').catch(() => {});
      }
      dit(journal.erreurs.length === 0, `${tag} : aucune erreur de page`, journal.erreurs.join(' // '));
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n${ko} défaut(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
