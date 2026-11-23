#!/usr/bin/env node
// VESTIAIRE : « MES ARTICLES » RANGÉS UNE FOIS PAR VISITE (23 nov., extension 5.443).
// Constat : Vestiaire « relisait ses ~1 000 annonces 5 à 6 fois par visite ». Cause mesurée ici : la page charge
// « Mes articles » par pages (5 de 200) et ses compteurs ; CHAQUE réponse relisait toute la ligne `vc_listings`
// (`select=data`), la réécrivait en entier et réveillait l'app. Exécute le VRAI vc-inject.js (fausse page), le VRAI
// relais vc.js et le VRAI background.js (`_fond-vm.cjs`, base à état qui COMPTE ses requêtes) :
//   V1 · une visite (compteurs + 5 pages, 1 000 annonces) : lectures complètes de `vc_listings`, écritures, réveils ;
//   V2 · le résultat est celui d'avant, page par page (1 000 fiches, liste entière, compteurs, lecture du compte) ;
//   V3 · une page partielle APRÈS la liste entière ne retire rien (jamais une partielle par-dessus une complète) ;
//   V4 · lecture de la base ratée ⇒ RIEN n'est écrit, la page apprend « pas rangé » ;
//   V5 · une page seule (liste pas finie) est rangée quand même (2,5 s sans autre réponse) — aucune perdue ;
//   V6 · un lien de publication part sans attendre.
// Données INVENTÉES. `--src` exécute une autre copie du fond (preuve sur le code d'AVANT) ; `--prouve` : mutations.
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
};
if (process.argv.includes('--prouve')) {
  const MUT = [
    ['uneEcritureParReponse', "const tout = !!(patch && (patch.liens || patch.complet)) ||", 'const tout = true ||'],
    ['seulementLaDerniere', 'for (const patch of liste) {\n    const r = await appliquerPatchVc(', 'for (const patch of liste.slice(-1)) {\n    const r = await appliquerPatchVc('],
    ['lectureRateeEcrit', "if (rows === null) return false;                                     // lecture ratée : RIEN n'est écrit", "if (rows === null) { /* muté */ }"],
    ['pageSeulePerdue', "else _vcFileMinuteur = setTimeout(() => { viderFileVc(); }, VC_ANNONCES_CALME_MS);", 'else _vcFileMinuteur = null;'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-une-fois-'));
  let tous = true;
  for (const [nom, avant, apres] of MUT) {
    const txt = fs.readFileSync(F.src, 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-background.js');
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename, '--src', fichier], { encoding: 'utf8', timeout: 240000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (ok, nom, det) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${!ok && det ? ' — ' + det : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const pilote = (() => {
  const t = fs.readFileSync(path.join(__dirname, 'audit-capture-vc-lbc.cjs'), 'utf8');
  const i = t.indexOf('function pageVc() {'), j = t.indexOf('const senderVc =');
  if (i < 0 || j < 0) throw new Error('pilote de page introuvable dans audit-capture-vc-lbc.cjs');
  return new Function('fs', 'vm', 'F', 'copie', 'attendre', 'API', 'ORIGINE', 'URL', 'Buffer', 'console', t.slice(i, j) + '\nreturn { pageVc, relais };')(fs, vm, F, copie, attendre, API, ORIGINE, URL, Buffer, console);
})();
const senderVc = (tab) => ({ tab: { id: tab, url: ORIGINE + '/listings/' }, frameId: 0, url: ORIGINE + '/listings/' });
// La forme MESURÉE de « Mes articles » (enveloppe `{ type, [type]: { product, listingDate } }`), valeurs inventées.
const env = (id) => ({ type: 'published', published: { product: { id, headline: 'Paire ' + id, subHeadline: 'T40', price: { cents: 9000 + (id % 50) * 100, currency: 'EUR', formatted: '90 €' }, picturePath: `${id}-1_3.jpg`, path: `/x/${id}.shtml` }, listingDate: '2026-11-20T10:00:00+00:00' } });
const TOTAL = 1000, PAGE = 200;

// Un fond qui compte : lectures COMPLÈTES de vc_listings (`select=data`), écritures, réveils de l'app.
function fondCompte(opts = {}) {
  const c = { lectures: 0, ecritures: 0, reveils: 0, ko: false };
  const f = faireFond({ src: F.src, lignes: opts.lignes || {}, lectureKO: (u) => {
    if (/id=eq\.vc_listings/.test(u) && /select=data(&|$)/.test(u)) { c.lectures++; return c.ko; }
    return false;
  } });
  // Le banc commun raccourcit les minuteries à 2 ms : ici le temps est le VRAI (une visite dure des secondes).
  f.ctx.setTimeout = setTimeout; f.ctx.clearTimeout = clearTimeout;
  const posts0 = () => f.j.posts.reduce((s, ids) => s + ids.filter((x) => x === 'vc_listings').length, 0);
  c.ecrituresDe = posts0;
  const vrai = f.ctx.notifierApp;
  f.ctx.notifierApp = (m) => { if (m && m.quoi === 'vestiaire') c.reveils++; return typeof vrai === 'function' ? vrai(m) : undefined; };
  return { f, c };
}
// Les messages qu'une visite de « Mes articles » envoie au fond (vrai vc-inject + vrai relais).
async function messagesVisite(p, r, nb = TOTAL) {
  const msgs = [];
  const cpt = await p.charge(`${API}/users/me/products/count?isoCountry=FR`, { data: { productOnSale: nb, productWaitingPicture: 0, productWaitingValidation: 0, productSold: 4, productRefused: 0, productUnreceived: 0 }, meta: { limit: 0, offset: 0, count: 0 } });
  for (const m of cpt) for (const y of r(m)) if (y.action === 'vcCompteurs') msgs.push(y);
  for (let off = 0; off < nb; off += PAGE) {
    const data = []; for (let k = off; k < Math.min(nb, off + PAGE); k++) data.push(env(70000 + k));
    const posts = await p.charge(`${API}/users/me/product-listings?limit=${PAGE}&offset=${off}`, { data, meta: { limit: PAGE, offset: off, count: nb } });
    for (const m of posts) for (const y of r(m)) if (y.action === 'vcAnnonces') msgs.push(y);
  }
  return msgs;
}
// Comme dans Chrome : le relais n'attend pas la réponse d'une page pour envoyer la suivante (100 ms d'écart).
async function envoyerSansAttendre(f, msgs) {
  const reps = [];
  for (const m of msgs) { reps.push(f.envoyer(m, senderVc(31))); await attendre(100); }
  return Promise.all(reps);
}

// Une réponse jamais rangée bloquerait l'audit sans rien dire : au bout de 150 s, c'est un rouge.
const garde = setTimeout(() => { console.log('❌ une réponse de la page n’a JAMAIS été rangée (l’audit attend depuis 150 s)'); process.exit(1); }, 150000);
(async () => {
  try {
    // ── V1 / V2 : une visite ──
    const p = pilote.pageVc(), r = pilote.relais();
    await p.charge(`${API}/users/me`, { data: { id: 'c37', type: 'user' } });
    const msgs = await messagesVisite(p, r);
    const nbPages = msgs.filter((m) => m.action === 'vcAnnonces').length;
    dit(nbPages === TOTAL / PAGE && msgs.some((m) => m.action === 'vcCompteurs') && msgs[msgs.length - 1].complet && msgs[msgs.length - 1].complet.length === TOTAL,
      `V0 · la page charge « Mes articles » en ${TOTAL / PAGE} pages de ${PAGE} + ses compteurs ; la dernière page dit la liste ENTIÈRE`, JSON.stringify({ nbPages, n: msgs.length }));
    const { f, c } = fondCompte({ lignes: { vc_listings: { items: {}, liens: {} } } });
    await f.ctx.noterSessionVc('c37', 31, []);
    await attendre(20); c.reveils = 0;   // le réveil du compte de l'onglet (vc_session) n'est pas celui des annonces
    const reps = await envoyerSansAttendre(f, msgs);
    await attendre(50);
    console.log(`   mesure : ${c.lectures} lecture(s) complète(s) de vc_listings · ${c.ecrituresDe()} écriture(s) · ${c.reveils} réveil(s) de l'app pour ${msgs.length} réponses`);
    dit(c.lectures === 1, `V1 · UNE lecture complète de la ligne vc_listings pour toute la visite (avant : une par réponse, ${msgs.length})`, `${c.lectures} lectures`);
    dit(c.ecrituresDe() === 1, 'V1 · UNE écriture de la ligne pour toute la visite', `${c.ecrituresDe()} écritures`);
    dit(c.reveils === 1, 'V1 · l’app est réveillée UNE fois (elle relit la ligne une fois, pas six)', `${c.reveils} réveils`);
    dit(reps.every((x) => x && x.ok === true), 'V1 · chaque réponse de la page apprend « rangé » (après l’écriture)', JSON.stringify(reps));
    const L = f.lignes.vc_listings || {};
    const items = L.items || {};
    dit(Object.keys(items).length === TOTAL && items['70000'] && items['70999'] && items['70000'].titre, `V2 · les ${TOTAL} fiches sont rangées (titre, photo, prix), comme page par page`, String(Object.keys(items).length));
    dit(L.complet === true && L.total === TOTAL && L.lectures && L.lectures.c37 && L.lectures.c37.complet === true, 'V2 · la liste est ENTIÈRE pour le compte de l’onglet (lecture datée)', JSON.stringify({ complet: L.complet, total: L.total, lec: L.lectures }));
    dit(L.compteurs && L.compteurs.c37 && L.compteurs.c37.enVente === TOTAL, 'V2 · les compteurs du compte sont rangés dans la même écriture', JSON.stringify(L.compteurs));
    // ── V3 : une page partielle après la liste entière (une recherche dans « Mes articles ») ──
    const avant = Object.keys(items).length;
    const partielle = await p.charge(`${API}/users/me/product-listings?limit=${PAGE}&offset=0&q=nike`, { data: [env(70005), env(70006)], meta: { limit: PAGE, offset: 0, count: 2 } });
    const mp = partielle.map((m) => r(m).find((y) => y.action === 'vcAnnonces')).filter(Boolean);
    for (const m of mp) await f.envoyer(m, senderVc(31));
    dit(mp.length === 1 && Object.keys(f.lignes.vc_listings.items || {}).length === avant, 'V3 · une page filtrée lue APRÈS la liste entière ne retire aucune annonce (une partielle n’écrase jamais une complète)', String(Object.keys(f.lignes.vc_listings.items || {}).length));
    // ── V4 : lecture de la base ratée ⇒ rien n'est écrit ──
    const k = fondCompte({ lignes: { vc_listings: copie(f.lignes.vc_listings) } });
    await k.f.ctx.noterSessionVc('c37', 31, []);
    k.c.ko = true;
    const ecrAvant = k.c.ecrituresDe();
    const repKo = await envoyerSansAttendre(k.f, msgs.slice(0, 3));
    await attendre(50);
    dit(k.c.ecrituresDe() === ecrAvant && Object.keys(k.f.lignes.vc_listings.items).length === TOTAL, 'V4 · base illisible : RIEN n’est écrit (les 1 000 fiches restent)', JSON.stringify({ ecr: k.c.ecrituresDe(), n: Object.keys(k.f.lignes.vc_listings.items).length }));
    dit(repKo.every((x) => x && x.ok === false), 'V4 · … et la page apprend « pas rangé » (jamais « rangé » sur une lecture ratée)', JSON.stringify(repKo));
    // ── V5 : une page seule (liste pas finie) est rangée quand même ──
    const s = fondCompte({ lignes: { vc_listings: { items: {}, liens: {} } } });
    await s.f.ctx.noterSessionVc('c37', 31, []);
    const t0 = Date.now();
    const rep1 = await Promise.race([s.f.envoyer(msgs.find((m) => m.action === 'vcAnnonces'), senderVc(31)), attendre(20000).then(() => 'jamais')]);
    const ms = Date.now() - t0;
    dit(rep1 && rep1.ok === true && Object.keys(s.f.lignes.vc_listings.items || {}).length === PAGE && s.c.ecrituresDe() === 1, `V5 · une page seule (liste pas finie) est rangée (${ms} ms) — aucune réponse perdue`, JSON.stringify({ rep1, n: Object.keys(s.f.lignes.vc_listings.items || {}).length }));
    dit(ms < 16000, 'V5 · … et au plus tard 15 s après la première réponse (fraîcheur)', String(ms));
    // ── V6 : un lien de publication part sans attendre ──
    const t1 = Date.now();
    const okLien = await s.f.ctx.rangerVcAnnonces({ liens: { 70001: '124' } });
    dit(okLien === true && s.f.lignes.vc_listings.liens['70001'] === '124' && Date.now() - t1 < 2000, 'V6 · un lien de publication (annonce ↔ N°) est rangé tout de suite', JSON.stringify({ okLien, ms: Date.now() - t1 }));
  } catch (e) { ko++; console.log('❌ exception : ' + ((e && e.stack) || e)); }
  clearTimeout(garde);
  console.log(`\n${ko ? '❌' : '✅'} ${n - ko}/${n} — Vestiaire : « Mes articles » rangés une fois par visite`);
  process.exit(ko ? 1 : 0);
})();
