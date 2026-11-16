// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « Sécurité des ventes » (15 nov., lot securite-ventes — Julien : « vas-y fais tout »)
//         node scripts/audit-securite-ventes.cjs [--prouve]
//  L'alerte arnaque a son propre audit (scripts/audit-anti-arnaque.cjs). Ici, les deux autres règles,
//  EXÉCUTÉES sur des données INVENTÉES (aucune donnée réelle) :
//   O  « Où vendre ? » (src/ouVendre.js) : la saisie du prix ; Vinted sans frais SEULEMENT pour un compte
//      particulier lu (Pro, mixte ou pas su ⇒ « frais inconnus ») ; Leboncoin sans frais (la règle du
//      bénéfice) ; eBay et Vestiaire : le taux de SES DERNIÈRES ventes aux frais lus (eBay par la forme
//      réelle `paymentSummary.totalDueSeller` / `totalMarketplaceFee`, engagées, en euros ; Vestiaire par
//      la VRAIE `fraisVc`), comparé au calcul fait ici au centime, jamais un centime promis de trop ; le
//      port eBay n'entre jamais ; un site pas relié n'est jamais « le meilleur » ; ex æquo ⇒ tous ; un seul
//      site connu ⇒ aucun « meilleur » ; prix illisible ⇒ rien.
//   A  L'anneau de l'objectif (src/anneauObjectif.js) sur la VRAIE progression (`progressionObjectif`,
//      `resteObjectif`) : « encore 1 300 € · ≈ 47 € par jour jusqu’au 30 nov. » ; pas su ⇒ « — », jamais
//      « 0 % » ; « au moins » ⇒ « ≥ » et « au plus » ; atteint ; retiré ⇒ aucun objectif (désactivable).
//   W  Le branchement : l'anneau sur Ma journée (la barre ailleurs), « Où vendre ? » sur la fiche (sites
//      reliés, statut Pro lu, frais eBay/Vestiaire lus), le réglage synchronisé, la valeur = la règle VENDU
//      des comptes sélectionnés ; aucune action ni écriture dans les deux composants.
//  `--prouve` : chaque mutation de la règle doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const charger = async (texte, dossier) => {
  const tmp = path.join(dossier, `.audit-sv-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};

// ── Les jeux INVENTÉS (graine fixe) ─────────────────────────────────────────
function rnd(g) { return () => { g = (g * 48271) % 2147483647; return g / 2147483647; }; }
// 30 commandes eBay : 26 engagées en euros aux frais lus, 2 annulées, 1 en GBP, 1 sans frais.
function jeuEbay() {
  const r = rnd(11), out = [];
  for (let i = 0; i < 30; i++) {
    const cDu = 3000 + Math.floor(r() * 15000), cFee = Math.floor(cDu * (0.08 + r() * 0.06));
    const o = { orderId: 'O-' + i, creationDate: new Date(Date.UTC(2026, 9, 1 + i, 10)).toISOString(), orderPaymentStatus: 'PAID',
      paymentSummary: { totalDueSeller: { value: (cDu / 100).toFixed(2), currency: 'EUR' } }, totalMarketplaceFee: { value: (cFee / 100).toFixed(2), currency: 'EUR' },
      pricingSummary: { deliveryCost: { value: '9.99', currency: 'EUR' } }, _c: { cDu, cFee } };
    if (i === 3 || i === 17) { o.cancelStatus = { cancelState: 'CANCELED' }; o._exclue = true; }
    if (i === 8) { o.paymentSummary.totalDueSeller.currency = 'GBP'; o._exclue = true; }
    if (i === 25) { delete o.totalMarketplaceFee; o._exclue = true; }
    out.push(o);
  }
  return out;
}
// 9 ventes Vestiaire : 7 aux frais lus (`sellerPrice` + `sellerEarning`), 2 sans prix de vente.
function jeuVc() {
  const r = rnd(5), out = [];
  for (let i = 0; i < 9; i++) {
    const cPrix = 5000 + Math.floor(r() * 30000), cFrais = Math.floor(cPrix * (0.12 + r() * 0.1));
    const v = { id: String(80000000 + i), etat: 'Paiement envoyé', date: `2026-10-${String(1 + i * 3).padStart(2, '0')}T10:00:00Z`,
      montant: { valeur: (cPrix - cFrais) / 100, devise: 'EUR', cle: 'sellerEarning' }, prixVente: { valeur: cPrix / 100, devise: 'EUR', cle: 'sellerPrice' }, _c: { cPrix, cFrais } };
    if (i === 2 || i === 6) { delete v.prixVente; v._exclue = true; }
    out.push(v);
  }
  return out;
}

async function verifier(M, A, { silence = false } = {}) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!silence) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const { ouVendre, centimesPrix, fraisVintedSelon, statutVinted, tauxEbay, tauxVestiaire, tauxObserve, SEUIL_TAUX, DERNIERES } = M;
  const { fraisVc, commandeEbayEngagee } = A.regles;

  // O1 — la saisie
  const saisies = [['85', 8500], ['85,50', 8550], ['1 200 €', 120000], ['2k', null], ['', null], ['-5', null], ['0', null], [79.9, 7990], ['12.345', null]];
  dit(saisies.every(([s, c]) => centimesPrix(s) === c), 'O1 · le prix tapé se lit au centime, jamais deviné (« 2k », vide, 0, négatif ⇒ rien)', saisies.map(([s]) => `${JSON.stringify(s)}→${centimesPrix(s)}`).join(' '));

  // O2 — Vinted : le statut LU décide ; « pas su » ne vaut pas « particulier »
  const st = [[[false, false], 'particulier'], [[true], 'pro'], [[true, false], 'mixte'], [[false, null], 'passu'], [[], 'passu'], [null, 'passu']];
  dit(st.every(([l, e]) => statutVinted(l) === e), 'O2 · statut Vinted : particulier seulement si TOUS ses comptes sont lus particuliers', st.map(([l, e]) => `${JSON.stringify(l)}→${statutVinted(l)}`).join(' '));
  const vPart = ouVendre({ cPrix: 8500, sites: { vinted: { relie: true, frais: fraisVintedSelon('particulier') } } }).lignes[0];
  dit(vPart.etat === 'connu' && vPart.cTouche === 8500 && vPart.cFrais === 0, 'O2 · Vinted, compte particulier : il touche le prix (aucune commission vendeur, mesuré)', JSON.stringify(vPart));
  const inconnus = ['pro', 'mixte', 'passu', undefined].map((s) => ouVendre({ cPrix: 8500, sites: { vinted: { relie: true, frais: fraisVintedSelon(s) } } }).lignes[0]);
  dit(inconnus.every((l) => l.etat === 'inconnu' && l.cTouche == null), 'O2 · Vinted Pro, mixte ou pas su ⇒ « frais inconnus », jamais 0', inconnus.map((l) => l.raison).join(','));

  // O3 — Leboncoin
  const lbc = ouVendre({ cPrix: 4990, sites: { leboncoin: { relie: true, frais: { regle: 'aucune' } } } }).lignes[1];
  dit(lbc.site === 'leboncoin' && lbc.cTouche === 4990, 'O3 · Leboncoin : le prix capté est ce qu’il touche (règle du bénéfice)', JSON.stringify(lbc));

  // O4 — eBay : à la main, les DERNIERES engagées en EUR aux frais lus
  const E = jeuEbay();
  const gardees = E.filter((o) => !o._exclue).sort((a, b) => Date.parse(b.creationDate) - Date.parse(a.creationDate)).slice(0, DERNIERES);
  const sDu = gardees.reduce((t, o) => t + o._c.cDu, 0), sFee = gardees.reduce((t, o) => t + o._c.cFee, 0);
  const tE = tauxEbay(E, commandeEbayEngagee);
  dit(tE.regle === 'taux' && tE.n === DERNIERES && tE.cPrix === sDu && tE.cFrais === sFee, `O4 · eBay : les ${DERNIERES} dernières commandes engagées en euros aux frais lus (annulées, GBP, sans frais écartées)`, JSON.stringify({ n: tE.n, cPrix: tE.cPrix, attendu: sDu, cFrais: tE.cFrais, attenduF: sFee }));
  let tropPromis = 0, faux = 0;
  for (const c of [1, 999, 4990, 8500, 12345, 99999]) {
    const l = ouVendre({ cPrix: c, sites: { ebay: { relie: true, frais: tE } } }).lignes[2];
    const exact = c - (c * sFee) / sDu;   // le vrai montant au taux moyen, sans arrondi
    if (l.cTouche > exact + 1e-9) tropPromis++;
    if (l.cTouche !== c - Math.ceil((c * sFee) / sDu - 1e-9) || l.etat !== 'estime') faux++;
  }
  dit(!tropPromis && !faux, 'O4 · eBay : ≈ prix − frais au taux moyen, frais arrondis VERS LE HAUT (jamais un centime promis de trop)', `trop promis ${tropPromis}, faux ${faux}`);
  const E2 = jeuEbay().map((o) => ({ ...o, pricingSummary: { deliveryCost: { value: '250.00', currency: 'EUR' } } }));
  const tE2 = tauxEbay(E2, commandeEbayEngagee);
  dit(tE2.cPrix === tE.cPrix && tE2.cFrais === tE.cFrais, 'O4 · eBay : le port (payé par l’acheteur, §2.8) ne change rien', `${tE2.cPrix}/${tE.cPrix}`);
  const peu = tauxEbay(E.slice(0, 4), commandeEbayEngagee);
  dit(peu.regle === 'inconnu' && peu.raison === 'peuDeVentes' && peu.n < SEUIL_TAUX, `O4 · eBay : moins de ${SEUIL_TAUX} ventes aux frais lus ⇒ « frais inconnus », dit`, JSON.stringify(peu));
  dit(tauxEbay(null, commandeEbayEngagee).regle === 'inconnu' && tauxEbay(undefined).raison === 'pasLu', 'O4 · eBay : commandes pas lues ⇒ « frais inconnus · ventes pas lues »');

  // O5 — Vestiaire par la VRAIE fraisVc
  const V = jeuVc();
  const gv = V.filter((v) => !v._exclue);
  const tV = tauxVestiaire(V, fraisVc);
  const sP = gv.reduce((t, v) => t + v._c.cPrix, 0), sF = gv.reduce((t, v) => t + v._c.cFrais, 0);
  dit(tV.regle === 'taux' && tV.n === gv.length && tV.cPrix === sP && tV.cFrais === sF, 'O5 · Vestiaire : la commission LUE (`fraisVc` : prix − versé) de ses ventes, sans prix de vente écartées', JSON.stringify({ n: tV.n, cPrix: tV.cPrix, attendu: sP, cFrais: tV.cFrais, attenduF: sF }));
  const lv = ouVendre({ cPrix: 20000, sites: { vestiaire: { relie: true, frais: tV } } }).lignes[3];
  dit(lv.etat === 'estime' && lv.cTouche === 20000 - Math.ceil((20000 * sF) / sP - 1e-9), 'O5 · Vestiaire : ≈ prix − commission moyenne', JSON.stringify(lv));

  // O6 — le meilleur, le pas relié, le partiel
  const sites = { vinted: { relie: true, frais: { regle: 'aucune' } }, leboncoin: { relie: true, frais: { regle: 'aucune' } }, ebay: { relie: true, frais: tE }, vestiaire: { relie: false, frais: { regle: 'aucune' } } };
  const r1 = ouVendre({ cPrix: 8500, sites });
  dit(r1.meilleurs.join(',') === 'vinted,leboncoin' && !r1.partiel, 'O6 · ex æquo ⇒ les deux mis en avant ; eBay (frais) derrière', JSON.stringify(r1.meilleurs));
  dit(r1.lignes[3].etat === 'pasRelie' && !r1.lignes[3].meilleur && r1.lignes[3].cTouche == null, 'O6 · un site sans compte relié : « pas relié », jamais le meilleur, aucun montant (même sans frais)', JSON.stringify(r1.lignes[3]));
  const r2 = ouVendre({ cPrix: 8500, sites: { ...sites, vinted: { relie: true, frais: fraisVintedSelon('pro') }, leboncoin: { relie: null, frais: { regle: 'aucune' } } } });
  dit(r2.meilleurs.length === 0 && r2.partiel, 'O6 · un seul site aux frais connus ⇒ aucun « meilleur » ; un relié inconnu ⇒ partiel', JSON.stringify({ m: r2.meilleurs, p: r2.partiel }));
  const r3 = ouVendre({ cPrix: 8500, sites: { ...sites, vinted: { relie: true, frais: fraisVintedSelon('passu') } } });
  dit(r3.meilleurs.join(',') === 'leboncoin' && r3.partiel, 'O6 · Vinted pas su ⇒ Leboncoin le plus haut PARMI les connus, partiel dit', JSON.stringify({ m: r3.meilleurs, p: r3.partiel }));
  const r4 = ouVendre({ cPrix: centimesPrix('2k'), sites });
  dit(r4.cPrix === null && r4.lignes.filter((l) => l.relie).every((l) => l.etat === 'inconnu' && l.raison === 'prix') && !r4.meilleurs.length, 'O6 · prix illisible ⇒ « — » partout, aucun meilleur');
  const tObs = tauxObserve([{ cPrix: 1000, cFrais: 100, ts: 1 }, { cPrix: 1000, cFrais: 1001, ts: 2 }, { cPrix: 0, cFrais: 0 }, null]);
  dit(tObs.regle === 'inconnu' && tObs.n === 1, 'O6 · une ligne absurde (frais > prix, prix 0) ne compte pas', JSON.stringify(tObs));

  // A — l'anneau sur la VRAIE progression
  const { progressionObjectif, objectifAEnregistrer, lireObjectif } = A.obj;
  const quand = new Date(2026, 10, 3, 15, 0, 0).getTime();
  const obj = { type: 'ca', valeur: 2000, cache: {} };
  const m1 = A.motsAnneau(progressionObjectif(obj, { valeur: 700, partiel: false }), quand);
  dit(m1.centre === '35 %' && m1.etat === 'reste' && /^encore 1\s300\s€ · ≈ 47\s€ par jour jusqu’au 30 nov\.$/.test(m1.ligne) && /2\s000\s€ vendus/.test(m1.titre),
    'A · 700 € sur 2 000 € le 3 nov. à 15 h ⇒ « 35 % », « encore 1 300 € · ≈ 47 € par jour jusqu’au 30 nov. »', JSON.stringify(m1));
  const m2 = A.motsAnneau(progressionObjectif(obj, { valeur: null, manque: ['eBay'] }), quand);
  dit(m2.centre === '—' && m2.pct === null && m2.etat === 'passu' && !/0\s?%/.test(m2.centre + m2.ligne), 'A · vendu pas su ⇒ « — » et la raison, jamais « 0 % »', JSON.stringify(m2));
  const m3 = A.motsAnneau(progressionObjectif(obj, { valeur: 700, partiel: true, manque: ['Leboncoin'] }), quand);
  dit(m3.centre === '≥ 35 %' && /au plus 1\s300/.test(m3.ligne), 'A · « au moins » ⇒ « ≥ 35 % » et « encore au plus … »', JSON.stringify(m3));
  const m4 = A.motsAnneau(progressionObjectif(obj, { valeur: 2100 }), quand);
  dit(m4.etat === 'atteint' && m4.ligne === 'Objectif atteint', 'A · atteint ⇒ « Objectif atteint »', JSON.stringify(m4));
  const m5 = A.motsAnneau(progressionObjectif({ type: 'benefice', valeur: 500, cache: {} }, { valeur: 120 }), new Date(2026, 10, 30, 9).getTime());
  dit(/de bénéfice/.test(m5.titre) && /aujourd’hui$/.test(m5.ligne), 'A · bénéfice, dernier jour du mois ⇒ « encore 380 € aujourd’hui »', JSON.stringify(m5));
  const retire = objectifAEnregistrer({ v: 1, type: 'ca', valeur: 2000, cache: {} }, null, quand);
  dit(lireObjectif(retire) === null && progressionObjectif(lireObjectif(retire), { valeur: 700 }) === null, 'A · objectif retiré (Argent → Retirer) ⇒ aucun anneau (désactivable)', JSON.stringify(retire));
  return ko;
}

(async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const src = path.join(R, 'src', 'ouVendre.js');
  if (!fs.existsSync(src) || !fs.existsSync(path.join(R, 'src', 'anneauObjectif.js'))) { dit(false, 'les règles src/ouVendre.js et src/anneauObjectif.js existent'); console.log(`\n${ko} contrôle(s) rouge(s)`); process.exit(1); }
  const I = await import('file://' + path.join(R, 'src', 'i18n', 'index.js'));
  I.ajouterSourceApp((await import('file://' + path.join(R, 'src', 'i18n', 'langues', 'fr.js'))).default);
  const M = await import('file://' + src);
  const AN = await import('file://' + path.join(R, 'src', 'anneauObjectif.js'));
  const OBJ = await import('file://' + path.join(R, 'src', 'objectifMois.js'));
  const VC = await import('file://' + path.join(R, 'api', '_lib', 'vestiaire-regle.js'));
  const VR = await import('file://' + path.join(R, 'api', '_lib', 'ventes-regle.js'));
  const A = { regles: { fraisVc: VC.fraisVc, commandeEbayEngagee: VR.commandeEbayEngagee }, obj: OBJ, motsAnneau: AN.motsAnneau };
  ko += await verifier(M, A);

  // W — le branchement (lu dans le code, commentaires retirés)
  const app = sansCommentaires(require('./_source-app.cjs').sourceAppDe(path.join(R, 'src', 'App.jsx')));
  const cs = sansCommentaires(lire('src/design/CarteStats.jsx'));
  const ov = sansCommentaires(lire('src/OuVendre.jsx'));
  const an = sansCommentaires(lire('src/design/AnneauObjectif.jsx'));
  const ovr = sansCommentaires(lire('src/ouVendre.js'));
  dit(/page === 'journee'\s*\?\s*<AnneauObjectif\b/.test(cs) && /<BarreObjectif\b/.test(cs), 'W · Ma journée : l’anneau ; les autres cartes gardent la barre (la même progression)');
  const corpsOv = (() => { const i = app.indexOf('function OuVendreCoque('); if (i < 0) return ''; const j = app.indexOf('\nfunction ', i + 10); return app.slice(i, j < 0 ? undefined : j); })();
  const besoins = [/profil\.relies/, /lecturePrixPro\(/, /fraisVintedSelon\(statutVinted\(/, /tauxEbay\([^;]{0,80}?commandeEbayEngagee\)/, /tauxVestiaire\([^;]{0,80}?fraisVc\)/, /<OuVendre\b/];
  dit(/<OuVendreCoque\b/.test(app) && besoins.every((re) => re.test(corpsOv)),
    'W · la fiche : « Où vendre ? » lit les sites reliés, le statut Pro LU, les frais eBay et Vestiaire LUS', besoins.filter((re) => !re.test(corpsOv)).map(String).join(' '));
  const sync = (() => { const i = app.indexOf('const SYNC_KEYS = ['); return i < 0 ? '' : app.slice(i, app.indexOf('];', i)); })();
  dit(/'vrm_objectif_mois'/.test(sync), 'W · le réglage de l’objectif est synchronisé (`vrm_objectif_mois` dans SYNC_KEYS)');
  dit(/ventesFaites\(\{[^}]*cachee/.test(app), 'W · la valeur de l’anneau = la règle VENDU (`ventesFaites`), comptes écartés exclus (`cachee`)');
  const actions = /vmrCmd|fetch\(|save\(|withOwner|localStorage\.setItem|sb\(/;
  dit(!actions.test(ov) && !actions.test(an) && !actions.test(ovr), 'W · « Où vendre ? » et l’anneau n’agissent jamais (aucune commande, aucune écriture)');
  { const m = ovr.replace(/'[^']*'/g, '').match(/deliveryCost|shippingCost|\blivraison\b|\bport\b/); dit(!m, 'W · le port eBay n’entre dans aucun calcul (§2.8)', m ? m[0] : ''); }
  dit(/\btr\(/.test(ov) && /\btr\(/.test(sansCommentaires(lire('src/anneauObjectif.js'))), 'W · les textes passent par tr()');

  if (PROUVE) {
    const dir = path.join(R, 'src');
    const code = lire('src/ouVendre.js');
    const codeA = lire('src/anneauObjectif.js');
    const mutations = [
      ['un site pas relié peut être le meilleur', 'ouVendre', (t) => t.replace("const connus = lignes.filter((l) => l.relie && ", 'const connus = lignes.map((l) => (l.etat === \'pasRelie\' ? { ...l, etat: \'connu\', cTouche: 999999 } : l)).filter((l) => ')],
      ['frais arrondis vers le BAS (on promet trop)', 'ouVendre', (t) => t.replace('Math.ceil((cPrix * frais.cFrais) / frais.cPrix - 1e-9)', 'Math.floor((cPrix * frais.cFrais) / frais.cPrix)')],
      ['toutes les ventes au lieu des dernières', 'ouVendre', (t) => t.replace('ok.slice(0, DERNIERES)', 'ok')],
      ['les commandes annulées comptent', 'ouVendre', (t) => t.replace("if (!o || (typeof engagee === 'function' && !engagee(o))) continue;", 'if (!o) continue;')],
      ['Vinted pas su vaut « sans frais »', 'ouVendre', (t) => t.replace("return { regle: 'inconnu', raison: 'statutPasSu' };", "return { regle: 'aucune' };")],
      ['plus de seuil de ventes', 'ouVendre', (t) => t.replace('if (n < SEUIL_TAUX)', 'if (n < 1)')],
      ['un seul connu est « le meilleur »', 'ouVendre', (t) => t.replace('connus.length >= 2 ?', 'connus.length >= 1 ?')],
      ['pas su s’écrit 0 %', 'anneau', (t) => t.replace("const pasSu = { titre, centre: '—'", "const pasSu = { titre, centre: '0 %'")],
      ['« au moins » oublié', 'anneau', (t) => t.replace("`${prog.partiel && !prog.atteint ? '≥ ' : ''}${prog.pct} %`", '`${prog.pct} %`')],
    ];
    for (const [nom, cible, f] of mutations) {
      const avant = cible === 'ouVendre' ? code : codeA;
      const apres = f(avant);
      if (apres === avant) { dit(false, `--prouve · ${nom} : point de mutation introuvable`); continue; }
      const mod = await charger(apres.replace(/from '\.\//g, `from '${pathRel(dir)}`), os.tmpdir()).catch((e) => { console.log('   ' + e.message); return null; });
      if (!mod) { dit(false, `--prouve · ${nom} : la copie mutée ne se charge pas`); continue; }
      const n = await verifier(cible === 'ouVendre' ? mod : M, cible === 'anneau' ? { ...A, motsAnneau: mod.motsAnneau } : A, { silence: true });
      dit(n > 0, `--prouve · ${nom} ⇒ ${n} contrôle(s) rouge(s)`);
    }
  }
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
function pathRel(dir) { return 'file://' + dir.replace(/\\/g, '/') + '/'; }
