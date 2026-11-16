// ═══════════════════════════════════════════════════════════════════════════
// BANC : ARGENT PLUS (15 nov., lot argent-plus)
//        npm run build && BANC_PORT=9241 SHOTS=/tmp/ap node scripts/bancs/argent-plus.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le jeu de `nouveau-vendeur` + une ligne URSSAF publiée, la
// publication « qui dorment », un prix d'achat posé sur une vente, une ligne secrète).
// Deux statuts : B micro-entrepreneur · A jamais choisi. 390 px tactile et 1512 px.
//   S1 Argent : l'alerte des seuils en tête — TVA 85 000 € dépassée, 93 500 € à 80 %,
//      DAC7 Vinted atteint ; le plafond micro (44 %) ne dit rien ; chaque alerte a sa
//      source (service-public / EUR-Lex) ; « Compris » ≥ 44 px ⇒ elle part, le registre
//      `vrm_seuils_vus` est ÉCRIT dans la base, et elle ne revient pas au rechargement.
//      A : aucun plafond micro ni TVA (régime jamais deviné), DAC7 seul.
//   S2 Bilan du mois (cible de la notification du 1er, « Mois dernier ») : la ligne
//      URSSAF = `aPayerUrssaf` du CA du mois publié (B) ou « choisis ton régime » et
//      son geste (A) ; les articles qui dorment ; le TABLEUR téléchargé dit les MÊMES
//      valeurs que la carte ; le PDF est un PDF ; jamais « encaissé », jamais « au moins 0 ».
//   S3 Ventes : « Après frais de vente » = la somme des ventes calculables (68 − 2 − 30)
//      « sur 1 vente de N », les prix d'achat manquants nommés, ≥ 1 ligne.
//   S4 Paramètres → Sécurité des données → « Télécharger toutes mes données » : un zip,
//      UN dossier, JSON par catégorie, tableaux ventes/achats/annonces, le PDF du
//      bordereau, AUCUN jeton ; chaque lecture porte `owner=eq.` ; jamais `select=data`
//      sur une ligne lourde ; aucune écriture.
//   S5 aucune erreur JS, rien ne déborde.
// `SHOTS=<dossier>` : les captures à regarder.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const TAILLES = String(process.env.TAILLES || '390:clair,1512:sombre').split(',').map((x) => { const [w, t] = x.split(':'); return { W: Number(w), sombre: t === 'sombre' }; });
const SCEN = String(process.env.SCENARIOS || 'B,A').split(',');
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const ymDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const auj = new Date(), annee = auj.getFullYear(), prec = ymDe(new Date(annee, auj.getMonth() - 1, 1));
const caPrec = 30000, taux = 12.4;
const apayer = Math.round(caPrec * taux) / 100;   // la règle `aPayerUrssaf` (CA × taux, au centime)
const jeu = (scen) => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = L.find((r) => r.id === 'main');
  if (scen === 'B') { main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel'; main.data.vinted_urssaf_taux = taux; }
  // La ligne publiée par Ventes (`vinted_urssaf_mois`) : 90 000 € reçus cette année, 32 ventes Vinted.
  main.data.vinted_urssaf_mois = { at: now, sources: { Vinted: 'lu' }, mois: [
    { ym: `${annee}-01`, ca: 60000, n: 20, par: { Vinted: { n: 20, ca: 60000 } } },
    ...(prec.startsWith(String(annee)) ? [{ ym: prec, ca: caPrec, n: 12, par: { Vinted: { n: 12, ca: caPrec } } }] : []),
  ] };
  main.data.vrm_paires_dorment = { n: 5, total: 12, datesKnown: 12, at: now - 3600000 };
  main.data.vinted_sale_overrides = { 62002: { buyPrice: '30', fees: '2', fraisComplets: true } };
  L.push({ id: 'ebay_tokens_banc', data: { access_token: 'JETON-BANC-NE-DOIT-PAS-SORTIR', refresh_token: 'R-BANC' } });
  L.push({ id: 'harvest_111_txn_62002', data: { capturedAt: iso(0.01), payload: { transaction: { id: 62002, item_id: 51002, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(5) } } } });
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const aller = async (pg, q, attente = 3000) => {
  await pg.goto(`http://localhost:${NV.PORT}/?${q}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(attente);
};
const capture = async (pg, nom, sel) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const el = sel ? pg.locator(sel).first() : null;
  if (el && await el.count()) { await el.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300); }
  await pg.screenshot({ path: path.join(SHOTS, `${nom}.png`), fullPage: false });
};
const sansDebord = (pg) => pg.evaluate(() => { const d = document.scrollingElement; return d.scrollWidth <= d.clientWidth + 1; });

(async () => {
  const E = await import(require('url').pathToFileURL(path.join(__dirname, '..', '..', 'src', 'exportDonnees.js')).href);
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const scen of SCEN) for (const { W, sombre } of TAILLES) {
      const T = `${scen} ${W}${sombre ? ' sombre' : ''}`;
      const base = jeu(scen);
      const o = await NV.ouvrir(nav, { W, sombre, base, tab: 'compta' });
      const pg = o.pg;
      // Les lectures de la base, pour juger les projections et le filtre `owner`.
      const lectures = [];
      pg.on('request', (q) => { const u = q.url(); if (/\/rest\/v1\/app_data/.test(u) && q.method() === 'GET') lectures.push(decodeURIComponent(u)); });
      try {
        // ── S1. LES SEUILS ──
        await aller(pg, 'tab=compta&cible=seuils', 4000);
        const s1 = await pg.evaluate(() => {
          const c = document.querySelector('[data-alertes-seuils]');
          if (!c) return null;
          const r = c.getBoundingClientRect();
          return { haut: Math.round(r.top + scrollY), cles: [...c.querySelectorAll('[data-seuil-cle]')].map((e) => e.getAttribute('data-seuil-cle')),
            sources: [...c.querySelectorAll('[data-seuil-source]')].map((e) => e.getAttribute('href')),
            compris: [...c.querySelectorAll('[data-seuil-compris]')].map((b) => Math.round(b.getBoundingClientRect().height)),
            texte: c.innerText };
        });
        const yr = String(annee);
        if (scen === 'B') {
          dit(s1 && s1.cles.sort().join(' ') === [`${yr}:dac7:Vinted:100`, `${yr}:tva:100`, `${yr}:tvaMajore:80`].sort().join(' '), `S1 ${T} : TVA 85 000 € dépassée, 93 500 € à 80 %, DAC7 Vinted atteint — le plafond micro (44 %) ne dit rien`, JSON.stringify(s1 && s1.cles));
        } else {
          dit(s1 && s1.cles.join(' ') === `${yr}:dac7:Vinted:100`, `S1 ${T} : régime jamais choisi ⇒ ni plafond micro ni TVA (jamais deviné), DAC7 seul`, JSON.stringify(s1 && s1.cles));
        }
        dit(s1 && s1.sources.length === s1.cles.length && s1.sources.every((h) => /^https:\/\/(entreprendre\.service-public\.gouv\.fr\/vosdroits\/F(32353|21746)|eur-lex\.europa\.eu\/eli\/dir\/2021\/514\/oj)$/.test(h)), `S1 ${T} : chaque alerte porte sa source officielle`, JSON.stringify(s1 && s1.sources));
        dit(s1 && s1.compris.every((h) => h >= 44), `S1 ${T} : « Compris » ≥ 44 px`, JSON.stringify(s1 && s1.compris));
        dit(s1 && !/encaiss/i.test(s1.texte) && /DAC7/.test(s1.texte), `S1 ${T} : jamais « encaissé »`);
        await capture(pg, `S1-seuils-${scen}-${W}${sombre ? '-sombre' : ''}`, '[data-alertes-seuils]');
        if (s1 && s1.cles.length) {
          const e0 = base.ecritures, premiere = s1.cles[0];
          await pg.locator(`[data-seuil-compris="${premiere}"]`).click();
          await pg.waitForTimeout(2500);
          const reste = await pg.evaluate(() => [...document.querySelectorAll('[data-seuil-cle]')].map((e) => e.getAttribute('data-seuil-cle')));
          const m = base.lignes.find((r) => r.id === 'main');
          const vues = m && m.data && m.data.vrm_seuils_vus;
          dit(!reste.includes(premiere) && reste.length === s1.cles.length - 1, `S1 ${T} : « Compris » retire CETTE alerte, les autres restent`, JSON.stringify(reste));
          dit(base.ecritures > e0 && vues && vues[premiere], `S1 ${T} : le registre \`vrm_seuils_vus\` est écrit dans la base (une fois, tous ses appareils)`, JSON.stringify(vues));
          await aller(pg, 'tab=compta', 3500);
          const apres = await pg.evaluate(() => [...document.querySelectorAll('[data-seuil-cle]')].map((e) => e.getAttribute('data-seuil-cle')));
          dit(!apres.includes(premiere), `S1 ${T} : au rechargement, l’alerte comprise ne revient pas`, JSON.stringify(apres));
        }
        // ── S2. LE BILAN DU MOIS (la cible de la notification du 1er) ──
        await aller(pg, `tab=compta&cible=bilanmois&mois=${prec}`, 4500);
        const b = await pg.evaluate((prec) => {
          const c = document.querySelector(`.vrm-bilan-mois[data-bilan-mois="${prec}"]`);
          if (!c) return null;
          const l = {}; for (const e of c.querySelectorAll('[data-bilan-ligne]')) l[e.getAttribute('data-bilan-ligne')] = { v: e.getAttribute('data-valeur'), etat: e.getAttribute('data-bilan-etat'), am: e.getAttribute('data-au-moins'), nom: (e.querySelector('b') || {}).innerText || '', txt: e.innerText };
          return { l, regime: !!c.querySelector('[data-bilan-regime]'), csv: !!c.querySelector('[data-bilan-csv]'), pdf: !!c.querySelector('[data-bilan-pdf]'), comptable: !!c.querySelector('[data-bilan-comptable]'),
            texte: c.innerText, hBoutons: [...c.querySelectorAll('[data-bilan-exports] button')].map((x) => Math.round(x.getBoundingClientRect().height)) };
        }, prec);
        dit(!!b, `S2 ${T} : la notification ouvre le « Bilan du mois » sur ${prec}`);
        if (b) {
          if (scen === 'B') dit(b.l.urssaf && b.l.urssaf.etat === 'su' && Number(b.l.urssaf.v) === apayer, `S2 ${T} : URSSAF du mois = ${caPrec} € × ${taux} % = ${apayer} € (la ligne publiée, au versement)`, JSON.stringify(b.l.urssaf));
          else dit(b.l.urssaf && b.l.urssaf.etat === 'regime' && b.l.urssaf.v === '' && b.regime, `S2 ${T} : aucun régime ⇒ « — » et le geste « Choisir mon régime »`, JSON.stringify(b.l.urssaf));
          dit(b.l.dorment && b.l.dorment.v === '5', `S2 ${T} : 5 articles qui dorment (la publication d’Annonces)`, JSON.stringify(b.l.dorment));
          dit(b.csv && b.pdf && b.comptable && b.hBoutons.every((h) => h >= (W < 600 ? 44 : 36)), `S2 ${T} : PDF, Tableur, « Pour mon comptable » (≥ 44 px au doigt)`, JSON.stringify(b.hBoutons));
          dit(!/encaiss/i.test(b.texte) && !/au moins 0[,\s]*0?0?\s*€/i.test(b.texte), `S2 ${T} : jamais « encaissé », jamais « au moins 0 »`);
          await capture(pg, `S2-bilan-${scen}-${W}${sombre ? '-sombre' : ''}`, `.vrm-bilan-mois[data-bilan-mois="${prec}"]`);
          const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }).catch(() => null), pg.locator(`.vrm-bilan-mois[data-bilan-mois="${prec}"] [data-bilan-csv]`).click()]);
          if (dl) {
            const lignes = E.lireCsv(fs.readFileSync(await dl.path(), 'utf8'));
            const val = (nom) => (lignes.find((x) => x[0] === nom) || [])[1];
            const ecarts = Object.values(b.l).filter((x) => x.v != null && x.nom && (x.v === '' ? val(x.nom) !== '' : Math.abs(Number(String(val(x.nom) || 'x').replace(',', '.')) - Number(x.v)) > 0.001));
            dit(dl.suggestedFilename() === `Bilan-${prec}.csv` && lignes.length >= 8 && ecarts.length === 0, `S2 ${T} : le tableur dit les MÊMES valeurs que la carte`, JSON.stringify({ f: dl.suggestedFilename(), ecarts: ecarts.map((x) => x.nom), lignes }));
          } else dit(false, `S2 ${T} : le tableur se télécharge`);
          const [dp] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }).catch(() => null), pg.locator(`.vrm-bilan-mois[data-bilan-mois="${prec}"] [data-bilan-pdf]`).click()]);
          const oct = dp ? fs.readFileSync(await dp.path()) : null;
          dit(oct && oct.slice(0, 4).toString() === '%PDF', `S2 ${T} : le PDF du bilan se télécharge`);
        }
        // ── S4. TOUTES MES DONNÉES ──
        await aller(pg, 'tab=settings', 3000);
        // La ligne « securite » vit dans une liste repliée sur ce gabarit : on la touche par son identité.
        // (16 nov., intégration vague B) Paramètres en dix catégories (maquette validée) : la catégorie « Sécurité des données »
        // (`data-categorie-ouvrir="donnees"`) s'ouvre d'abord, puis sa ligne « securite ».
        await pg.evaluate(() => { const c = document.querySelector('[data-categorie-ouvrir="donnees"]'); if (c && !document.querySelector('[data-sous-ouvrir="securite"]')) c.click(); });
        await pg.waitForTimeout(900);
        await pg.evaluate(() => { const e = document.querySelector('[data-sous-ouvrir="securite"]'); if (e) e.click(); });
        await pg.waitForTimeout(1500);
        const g = pg.locator('[data-sauvegarde-lancer]:visible').first();
        const vu = await g.count();
        dit(vu > 0, `S4 ${T} : Paramètres → Sécurité des données → « Télécharger toutes mes données »`);
        if (vu) {
          await g.scrollIntoViewIfNeeded();
          const h = await g.evaluate((e) => Math.round(e.getBoundingClientRect().height));
          dit(h >= (W < 600 ? 44 : 36), `S4 ${T} : le bouton (≥ 44 px au doigt)`, `${h}`);
          await capture(pg, `S4-sauvegarde-${scen}-${W}${sombre ? '-sombre' : ''}`, '[data-sauvegarde-toutes]:visible');
          lectures.length = 0; const e0 = base.ecritures;
          // La liste de TOUTES ses lignes (sans filtre d'id) : la base du banc la sert ici (owner exigé).
          await pg.route(/\/rest\/v1\/app_data\?/, (route) => {
            const u = decodeURIComponent(route.request().url());
            if (route.request().method() !== 'GET' || /[?&]id=/.test(u) || !/select=id,updated_at(&|$)/.test(u)) return route.fallback();
            const rows = /owner=eq\./.test(u) ? base.lignes.map((r) => ({ id: r.id, updated_at: iso(0) })) : [];
            return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(rows) });
          });
          const [dz] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }).catch(() => null), g.click()]);
          await pg.waitForTimeout(800);
          const fin = await pg.locator('[data-sauvegarde-fin]:visible').first().getAttribute('data-sauvegarde-fin').catch(() => null);
          dit(!!dz && /^VRM-sauvegarde-\d{4}-\d{2}-\d{2}\.zip$/.test(dz.suggestedFilename()) && fin === 'complet', `S4 ${T} : un zip téléchargé, dit « complet »`, `${dz && dz.suggestedFilename()} · ${fin}`);
          if (dz) {
            const z = E.lireZipStocke(new Uint8Array(fs.readFileSync(await dz.path())));
            const tetes = [...new Set(z.map((f) => f.nom.split('/')[0]))];
            const tout = z.map((f) => f.texte).join('\n');
            dit(tetes.length === 1 && z.every((f) => f.crcOk), `S4 ${T} : UN dossier, chaque fichier relu`, tetes.join());
            dit(['donnees/ventes.json', 'donnees/annonces.json', 'donnees/reglages.json', 'tableaux/ventes.csv', 'tableaux/achats.csv', 'tableaux/annonces.csv', 'LISEZMOI.txt'].every((n) => z.some((f) => f.nom.endsWith(n))), `S4 ${T} : JSON par catégorie et tableaux ventes / achats / annonces`, z.map((f) => f.nom.split('/').slice(1).join('/')).join(', '));
            const ann = E.lireCsv((z.find((f) => f.nom.endsWith('tableaux/annonces.csv')) || {}).texte || '');
            dit(ann.length === 13, `S4 ${T} : les 12 annonces des dressings dans le tableau`, `${ann.length - 1}`);
            dit(z.some((f) => /bordereaux\/email_bord_62000\.pdf$/.test(f.nom) && f.octets[0] === 0x25), `S4 ${T} : le PDF du bordereau encore présent`);
            dit(!/JETON-BANC|R-BANC|ebay_tokens/.test(tout), `S4 ${T} : aucun jeton, aucune ligne secrète`);
          }
          // Les lectures de LA sauvegarde (liste, lignes, résumés, PDF) ; les tableaux ventes/achats réutilisent les lecteurs
          // d'« Exporter mes données » (RLS seule, comme toute lecture de l'app) — jugés par audit-export-donnees.
          const siennes = lectures.filter((u) => /select=id,updated_at|pdfB64/.test(u));
          const sansOwner = siennes.filter((u) => !/owner=eq\./.test(u));
          const lourdesData = lectures.filter((u) => /select=[^&]*\bdata\b(?!->)/.test(u) && /(email_bord|_label_|_txn_)/.test(u));
          dit(siennes.length > 3 && sansOwner.length === 0, `S4 ${T} : chaque lecture de la sauvegarde porte \`owner=eq.\``, sansOwner.slice(0, 3).join(' | '));
          dit(lourdesData.length === 0, `S4 ${T} : jamais \`select=data\` sur une ligne lourde`, lourdesData.slice(0, 3).join(' | '));
          dit(base.ecritures === e0, `S4 ${T} : aucune écriture pendant la sauvegarde`);
          await capture(pg, `S4-sauvegarde-fin-${scen}-${W}${sombre ? '-sombre' : ''}`, '[data-sauvegarde-toutes]:visible');
        }
        // ── S3. VENTES : LE BÉNÉFICE DE LA LISTE ──
        await aller(pg, 'tab=cat_ventes', 5000);
        const s3 = await pg.evaluate(() => { const e = document.querySelector('[data-benef-liste]'); return e ? { n: e.getAttribute('data-benef-liste'), v: e.getAttribute('data-benef-liste-valeur'), ap: e.getAttribute('data-benef-liste-au-plus'), txt: e.innerText, h: e.getBoundingClientRect().height } : null; });
        dit(s3 && /^1\/\d+$/.test(s3.n) && s3.v === '3600' && !s3.ap, `S3 ${T} : « Après frais de vente » 36 € (68 − 2 − 30) sur 1 vente calculable`, JSON.stringify(s3));
        dit(s3 && /sur 1 vente de \d/.test(s3.txt) && !/prix d’achat à saisir/.test(s3.txt) && !/au moins/i.test(s3.txt), `S3 ${T} : la couverture dite, les prix d’achat manquants pas redits (le bandeau au-dessus les nomme), jamais « au moins »`, s3 && s3.txt);
        await capture(pg, `S3-ventes-${scen}-${W}${sombre ? '-sombre' : ''}`, '[data-benef-liste]');
        dit(await sansDebord(pg), `S5 ${T} : rien ne déborde`);
        dit(!o.journal.erreurs.length, `S5 ${T} : aucune erreur JS`, o.journal.erreurs.slice(0, 2).join(' | '));
      } catch (e) { dit(false, `${T} : le banc a planté`, e.message); }
      await o.ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vérifiés · ${ko} en défaut`);
  process.exit(ko ? 1 : 0);
})();
