#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  « À EXPÉDIER » VESTIAIRE : L'ÉTAT LE PLUS FRAIS GAGNE (15 nov.)
//  node scripts/audit-vestiaire-a-expedier.cjs [--mutations] [--racine <arbre>]
//
//  Mesuré en production (lecture seule, 15 nov.) : une vente Vestiaire expédiée le
//  7 nov. restait « À envoyer · date limite passée (9 nov.) » ; `aExpedier: true`
//  venait de la liste « à expédier » lue le 2 nov., la frise lue le 15 nov. disait
//  `sellerShipment: done`, `statutVc: deliveryInProgress`. Et la ligne écrivait le
//  code machine « IN_PROGRESS ». On EXÉCUTE ici les vrais modules sur la MÊME FORME
//  (valeurs INVENTÉES : le dépôt est public) :
//   A. la forme « expédiée » ⇒ pas à expédier, hors de Colis, sortie du stock,
//      « Expédiée · en livraison », jamais le code machine ;
//   B. la forme « vendue sans étape » ⇒ « Vendue », pas à expédier ;
//   C. une liste « à expédier » relue APRÈS la frise ⇒ à expédier (les deux datées) ;
//      la frise plus fraîche ⇒ pas à expédier ; la lecture de la liste sert d'heure
//      quand la vente n'en porte pas ;
//   D. « pas su » reste « pas su » : `pending`, `ongoing` sur l'envoi,
//      `shipmentInProgress` ne prouvent rien ;
//   E. un mot inconnu ⇒ « État Vestiaire non reconnu », jamais le mot ;
//   F. une règle (§11) : `ventesVcDe`/`venteVcFraiche` rendent le même verdict ; la
//      tête de l'écran compte les lignes qui disent « À expédier » ; Colis, Ma journée,
//      le widget passent par `colisVcAPoster` ;
//   G. l'extension (le VRAI background.js, `_fond-vm.cjs`) date chaque fait :
//      `aExpedierAt` à la lecture de « à expédier », `etapesAt` à la frise.
//  `--racine <arbre>` : juge un autre arbre (le code d'AVANT, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const iR = args.indexOf('--racine');
const RACINE = iR >= 0 ? path.resolve(args[iR + 1]) : path.join(__dirname, '..');
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };
const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
// Chaque mutation réaffaiblit la règle : l'audit doit virer au rouge.
const MUTATIONS = {
  'a-expedier-colle': { regle: (s) => remplace(s, "  if (!p.prouvee) return true;\n", "  return true;\n", 'a-expedier-colle') },
  'plus-recent-ignore': { regle: (s) => remplace(s, "  return !!(p.t && ae && ae > p.t);", "  return false;", 'plus-recent-ignore') },
  'pending-prouve': { regle: (s) => remplace(s, "String(e[k] == null ? '' : e[k]).trim().toLowerCase() === 'done'", "/done|pending|ongoing/.test(String(e[k] == null ? '' : e[k]).trim().toLowerCase())", 'pending-prouve') },
  'shipment-in-progress': { regle: (s) => remplace(s, "const STATUT_EN_LIVRAISON = /^deliveryInProgress$/i;", "const STATUT_EN_LIVRAISON = /InProgress$/i;", 'shipment-in-progress') },
  'colis-brut': { regle: (s) => remplace(s, "objet(v) && aExpedierVc(v, d.lectures) && !fait[String(id)]", "objet(v) && v.aExpedier === true && !fait[String(id)]", 'colis-brut') },
  'code-machine': { etat: (s) => remplace(s, "  return { cle: 'inconnu', ton: '' };\n}", "  return { cle: 'inconnu', ton: '', mot: brut };\n}", 'code-machine'), texte: (s) => remplace(s, "  return tr('vcventes.etat.' + r.cle);", "  return r.mot ? r.mot : tr('vcventes.etat.' + r.cle);", 'code-machine') },
  'tete-brute': { ecran: (s) => remplace(s, "const aExp = liste.filter((v) => CLES_A_EXPEDIER_VC.has(v.etape));", "const aExp = liste.filter((v) => v.aExpedierLu && !vcLoc.fait[v.id]);", 'tete-brute') },
  'ext-sans-heure': { ext: (s) => remplace(s, "...(source === 'a-expedier' ? { aExpedierAt: now } :", "...(false ? { aExpedierAt: now } :", 'ext-sans-heure') },
};
if (args.includes('--mutations')) {
  let t = 0;
  for (const nom of Object.keys(MUTATIONS)) { const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom, ...(iR >= 0 ? ['--racine', RACINE] : [])], { encoding: 'utf8' }); if (r.status !== 0) t++; console.log((r.status !== 0 ? '✅ tuée    ' : '❌ SURVIT  ') + nom); }
  const n = Object.keys(MUTATIONS).length; console.log(`\n${t === n ? '✅' : '❌'} mutations : ${t}/${n} tuées`); process.exit(t === n ? 0 : 1);
}
const M = MUTATION ? MUTATIONS[MUTATION] : {};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vc-aexp-'));
// Copie un module dans un dossier temporaire, ses imports relatifs rendus absolus ; `remplacer` pointe
// un import vers une copie (mutée) déjà chargée.
const charger = async (rel, nom, tr, remplacer = {}) => {
  const src = path.join(RACINE, rel);
  let s = fs.readFileSync(src, 'utf8'); if (tr) s = tr(s);
  s = s.replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (_, f) => { const abs = path.join(path.dirname(src), f); return `from '${remplacer[abs] || pathToFileURL(abs).href}'`; });
  const f = path.join(tmp, nom + '.mjs'); fs.writeFileSync(f, s); return import(pathToFileURL(f).href);
};
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ── LES FORMES (inventées, celles mesurées le 15 nov.) ──────────────────────
const LECTURES = { ventes: { at: '2026-11-15T13:10:00Z', total: null, complet: false }, 'a-expedier': { at: '2026-11-02T20:00:00Z', total: null, complet: false } };
const EXPEDIEE = { productId: '70000001', titre: 'Sac inventé', etat: 'IN_PROGRESS', statutVc: 'deliveryInProgress',
  etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerDelivery: 'ongoing', sellerConformity: 'upcoming', sellerPayment: 'upcoming' },
  aExpedier: true, sources: ['ventes', 'a-expedier'], limite: '2026-11-09T23:59:59+01:00', suivi: 'XX000000001FR', transporteur: 'Chronopost',
  paiementEstime: '23 novembre 2026', compte: '11112222', montant: { valeur: 150, devise: 'EUR', cle: 'sellerEarning' }, prixVente: { valeur: 160, devise: 'EUR', cle: 'sellerPrice' },
  bordereau: { id: 'vc_label_70000001', at: '2026-11-03T10:00:00Z' }, vuAt: '2026-11-15T13:10:00Z', premiereVue: '2026-11-02T19:14:00Z', date: '2026-11-02T14:17:41+01:00', ref: '120' };
const VENDUE = { productId: '70000002', titre: 'Bottes inventées', etat: 'IN_PROGRESS', aExpedier: false, sources: ['ventes'], limite: '', suivi: '', transporteur: '', compte: '11112222',
  montant: { valeur: 80, devise: 'EUR', cle: 'sellerEarning' }, prixVente: { valeur: 100, devise: 'EUR', cle: 'sellerPrice' }, date: '2026-11-13T10:00:00+01:00' };
const MAINTENANT = Date.parse('2026-11-15T14:11:00+01:00');

(async () => {
  const regle = await essaie('api/_lib/vestiaire-regle.js chargé', () => charger('api/_lib/vestiaire-regle.js', 'regle', M.regle));
  if (!regle) { console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  const absRegle = path.join(RACINE, 'api/_lib/vestiaire-regle.js');
  const urlRegle = pathToFileURL(path.join(tmp, 'regle.mjs')).href;
  const etatMod = await essaie('src/etatVenteVc.js chargé', () => charger('src/etatVenteVc.js', 'etat', M.etat, { [absRegle]: urlRegle }));
  const frise = await essaie('src/friseSites.js chargé', () => charger('src/friseSites.js', 'frise', null, { [absRegle]: urlRegle }));
  // Les mots : le français de l'app (fr.js) posé dans tr(), comme App.jsx le fait.
  const i18n = await essaie('src/i18n/index.js chargé', () => import(pathToFileURL(path.join(RACINE, 'src/i18n/index.js')).href));
  const fr = await essaie('src/i18n/langues/fr.js chargé', () => import(pathToFileURL(path.join(RACINE, 'src/i18n/langues/fr.js')).href));
  if (i18n && fr) i18n.ajouterSourceApp(fr.default);
  const absI18n = path.join(RACINE, 'src/i18n/index.js');
  const texteMod = await essaie('src/etatVenteVcTexte.js chargé', () => charger('src/etatVenteVcTexte.js', 'texte', M.texte, { [absI18n]: pathToFileURL(absI18n).href }));
  const aExp = regle.aExpedierVc || (() => { throw new Error('aExpedierVc absente'); });
  const etat = (v, o = {}) => etatMod && etatMod.etatVenteVc ? etatMod.etatVenteVc(v, { maintenant: MAINTENANT, ...o }) : (() => { throw new Error('etatVenteVc absente'); })();
  const texte = (r) => texteMod && texteMod.texteEtatVc ? texteMod.texteEtatVc(r) : (() => { throw new Error('texteEtatVc absente'); })();
  const d = { ventes: { 70000001: EXPEDIEE, 70000002: VENDUE }, lectures: LECTURES, liens: {} };

  await essaie('A', () => {
    dit(aExp(EXPEDIEE, LECTURES) === false, 'A1 la forme « expédiée » (envoi done, deliveryInProgress, liste « à expédier » du 2 nov.) : PAS à expédier');
    const r = etat(EXPEDIEE, { lectures: LECTURES });
    dit(r.cle === 'expediee' && r.ton === '', 'A2 son état : « expediee », sans ambre', JSON.stringify(r));
    const t = texte(r);
    dit(t === 'Expédiée · en livraison', 'A3 en mots : « Expédiée · en livraison »', t);
    const colis = regle.colisVcAPoster(d, MAINTENANT) || [];
    dit(!colis.some((c) => c.id === '70000001'), 'A4 Colis / Ma journée / widget (`colisVcAPoster`) : hors de « à poster »', JSON.stringify(colis.map((c) => c.id)));
    dit(regle.resumeColisVc(colis).total === 0 && regle.resumeColisVc(colis).overdue === 0, 'A5 le résumé du widget et des rappels : 0 colis, 0 en retard');
    const st = regle.stockVestiaire(regle.ventesVcDe(d));
    dit(!st.aPoster.has('120') && st.sorties.some((x) => x.cle === '120'), 'A6 le Stock : la paire est SORTIE (partie, prouvée), plus « à poster »', JSON.stringify({ aPoster: [...st.aPoster], sorties: st.sorties.map((x) => x.cle) }));
    dit(regle.vcVentePartie(EXPEDIEE) === true && regle.vcVenteAnnulee(EXPEDIEE) === false, 'A7 partie (prouvée par la frise), pas annulée');
    if (frise && frise.preuvesFriseVc) { const p = frise.preuvesFriseVc(EXPEDIEE); dit(p && p.deposee.lu === true && p.livree.lu === false, 'A8 la frise : « Postée » cochée, « Livrée » pas encore', JSON.stringify(p && { d: p.deposee, l: p.livree })); }
    else dit(false, 'A8 `preuvesFriseVc` exécutable');
  });
  await essaie('B', () => {
    dit(aExp(VENDUE, LECTURES) === false, 'B1 la forme « vendue sans étape » : pas à expédier');
    const r = etat(VENDUE, { lectures: LECTURES });
    dit(r.cle === 'vendue' && texte(r) === 'Vendue', 'B2 son état : « Vendue »', JSON.stringify(r) + ' ' + texte(r));
    dit(!/IN_PROGRESS/.test(texte(r)) && !/IN_PROGRESS/.test(texte(etat(EXPEDIEE, { lectures: LECTURES }))), 'B3 jamais « IN_PROGRESS » en mots');
  });
  await essaie('C', () => {
    const relue = { ...EXPEDIEE, etapesAt: '2026-11-07T10:00:00Z', aExpedierAt: '2026-11-10T10:00:00Z' };
    dit(aExp(relue, LECTURES) === true, 'C1 la liste « à expédier » relue APRÈS la frise (les deux datées) : à expédier');
    const rc = etat(relue, { lectures: LECTURES });
    dit(/^aExpedier/.test(rc.cle) && rc.ton === 'action', 'C2 son état : « À expédier … » (ambre)', JSON.stringify(rc));
    dit((regle.colisVcAPoster({ ...d, ventes: { 70000001: relue } }, MAINTENANT) || []).some((c) => c.id === '70000001'), 'C3 Colis : de nouveau à poster');
    const fraiche = { ...EXPEDIEE, etapesAt: '2026-11-15T13:00:00Z', aExpedierAt: '2026-11-02T20:00:00Z' };
    dit(aExp(fraiche, LECTURES) === false, 'C4 la frise plus fraîche que la liste : pas à expédier');
    const parLecture = { ...EXPEDIEE, etapesAt: '2026-11-05T10:00:00Z' };
    dit(aExp(parLecture, { 'a-expedier': { at: '2026-11-06T10:00:00Z' } }) === true && aExp(parLecture, { 'a-expedier': { at: '2026-11-04T10:00:00Z' } }) === false, 'C5 sans heure sur la vente, la lecture de la liste « à expédier » sert d’heure (plus récente ⇒ à expédier)');
    dit(aExp(parLecture, { 'a-expedier': { at: '2026-11-04T10:00:00Z', partielleAt: '2026-11-06T10:00:00Z' } }) === true, 'C6 une lecture partielle plus récente compte aussi (`partielleAt`)');
  });
  await essaie('D', () => {
    const base = { ...EXPEDIEE, statutVc: 'shipmentInProgress', etapesVc: { sellerSale: 'done', sellerShipment: 'pending', sellerDelivery: 'upcoming', sellerConformity: 'upcoming', sellerPayment: 'upcoming' } };
    dit(aExp(base, LECTURES) === true, 'D1 envoi « pending », statut « shipmentInProgress » (la vente à envoyer mesurée) : à expédier');
    dit(aExp({ ...base, etapesVc: { ...base.etapesVc, sellerShipment: 'ongoing' } }, LECTURES) === true, 'D2 « ongoing » ne prouve rien');
    dit(aExp({ ...base, etapesVc: null, statutVc: '' }, LECTURES) === true, 'D3 rien lu : « à expédier » reste (pas su ≠ envoyé)');
    const r = etat(base, { lectures: LECTURES });
    dit(r.cle === 'aExpedierPassee' && texte(r).startsWith('À envoyer · date limite passée ('), 'D4 date limite passée et rien ne prouve l’envoi : « À envoyer · date limite passée (…) » (16 nov. : « À envoyer » partout, src/libelles.js)', texte(r));
    dit(etat(base, { lectures: LECTURES, fait: '2026-11-08T10:00:00Z' }).cle === 'colisFait', 'D5 « Colis fait » posé par lui : « Colis fait »');
  });
  await essaie('E', () => {
    const r = etat({ ...VENDUE, etat: 'FOO_BAR_STATE' }, { lectures: LECTURES });
    dit(r.cle === 'inconnu' && texte(r) === 'État Vestiaire non reconnu' && !/FOO_BAR/.test(texte(r)), 'E1 un mot inconnu : « État Vestiaire non reconnu », jamais le mot', texte(r));
    const pay = etat({ ...EXPEDIEE, etapesVc: { ...EXPEDIEE.etapesVc, sellerDelivery: 'done', sellerConformity: 'done' } }, { lectures: LECTURES });
    dit(pay.cle === 'paiement' && /^Paiement le 23 nov/.test(texte(pay)), 'E2 conformité faite + paiement estimé : « Paiement le 23 nov. »', texte(pay));
    dit(texte(etat({ ...EXPEDIEE, etapesVc: { ...EXPEDIEE.etapesVc, sellerPayment: 'done' } }, { lectures: LECTURES })) === 'Payée', 'E3 paiement fait : « Payée »');
    dit(texte(etat({ ...EXPEDIEE, etapesVc: { ...EXPEDIEE.etapesVc, sellerDelivery: 'done', sellerConformity: 'ongoing' } }, { lectures: LECTURES })) === 'Livrée · contrôle', 'E4 livrée, conformité en cours : « Livrée · contrôle »');
  });
  await essaie('F', () => {
    const f = regle.venteVcFraiche(EXPEDIEE, LECTURES);
    dit(f.aExpedier === false && f.aExpedierLu === true, 'F1 `venteVcFraiche` : `aExpedier` = la règle, le mot rangé gardé à part');
    const relue = { ...EXPEDIEE, etapesAt: '2026-11-05T10:00:00Z' };
    const fr2 = regle.venteVcFraiche(relue, { 'a-expedier': { at: '2026-11-06T10:00:00Z' } });
    dit(fr2.aExpedier === true && aExp(fr2) === true, 'F2 idempotente, même appelée sans `lectures` (l’heure de la liste est posée sur la vente)');
    const liste = regle.ventesVcDe(d);
    dit(liste.find((x) => x.id === '70000001').aExpedier === false && liste.find((x) => x.id === '70000002').aExpedier === false, 'F3 `ventesVcDe` (totaux, stock, coque) : la même règle');
    const ecran = sansCommentaires(fs.readFileSync(path.join(RACINE, 'src/ecrans/Vestiaire.jsx'), 'utf8'));
    const e2 = M.ecran ? M.ecran(ecran) : ecran;
    dit(/const aExp = liste\.filter\(\(v\) => CLES_A_EXPEDIER_VC\.has\(v\.etape\)\);/.test(e2) && /etape: ev\.cle/.test(e2) && /const ev = etatVenteVc\(v, \{ fait, depart: v\.departLu \|\| null \}\);/.test(e2),
      'F4 l’écran : la tête « N à expédier » compte les lignes qui DISENT « À expédier » (une règle, §11)');
    dit(/venteVcFraiche\(v0, d\.lectures\)/.test(e2), 'F5 l’écran : chaque vente passe par `venteVcFraiche` (avec les lectures)');
    const fnVente = (e2.match(/function etapeVenteVc\([\s\S]*?\n\}/) || [''])[0];
    dit(!!fnVente && !/brut|v\.etat\b/.test(fnVente) && !/Vestiaire écrit/.test(e2), 'F6 l’écran n’écrit plus le mot brut de Vestiaire sur une vente (ni ligne, ni fiche)', fnVente.slice(0, 120));
    const app = sansCommentaires(fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8'));
    dit(/const limiteVcTexte = \(v\) => \{\s*if \(!v \|\| !aExpedierVc\(v\)\) return '';/.test(app), 'F7 la date limite (Colis, fiche) : seulement pour une vente à expédier selon la règle');
  });
  await essaie('G', async () => {
    let bg = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension/background.js'), 'utf8');
    if (M.ext) bg = M.ext(bg);
    const fBg = path.join(tmp, 'background.js'); fs.writeFileSync(fBg, bg);
    const { faireFond } = require(path.join(__dirname, '_fond-vm.cjs'));
    const f = faireFond({ src: fBg, lignes: {} });
    if (typeof f.ctx.rangerVcVentes !== 'function' || typeof f.ctx.rangerVcTimeline !== 'function') { dit(false, 'G0 `rangerVcVentes` et `rangerVcTimeline` exécutables'); return; }
    const pause = () => new Promise((r) => setTimeout(r, 8));
    const x = { id: '70000003', productId: '70000003', date: '2026-11-02', titre: 'Sac banc', montant: { valeur: 150, devise: 'EUR', cle: 'sellerEarning' } };
    await f.ctx.rangerVcVentes({ source: 'a-expedier', ventes: [x], offset: 0, total: null, lus: 1 });
    let v = ((f.lignes.vc_ventes || {}).ventes || {})['70000003'] || {};
    dit(v.aExpedier === true && !!Date.parse(v.aExpedierAt || ''), 'G1 lecture de « à expédier » : `aExpedierAt` posé', JSON.stringify({ a: v.aExpedier, at: v.aExpedierAt }));
    await pause();
    await f.ctx.rangerVcTimeline({ productId: '70000003', transporteur: 'Chronopost', suivi: 'XX000000003FR', statut: 'deliveryInProgress', etapes: { sellerSale: 'done', sellerShipment: 'done', sellerDelivery: 'ongoing', sellerConformity: 'upcoming', sellerPayment: 'upcoming' } }, '');
    v = ((f.lignes.vc_ventes || {}).ventes || {})['70000003'] || {};
    dit(!!Date.parse(v.etapesAt || '') && v.aExpedier === true, 'G2 la frise lue : `etapesAt` posé, le mot « à expédier » rangé gardé (rien remis à faux par l’extension)', JSON.stringify({ e: v.etapesAt, a: v.aExpedier }));
    dit(aExp(v, (f.lignes.vc_ventes || {}).lectures) === false, 'G3 bout en bout : la frise plus fraîche ⇒ l’app ne la dit plus à expédier');
    await pause();
    await f.ctx.rangerVcVentes({ source: 'ventes', ventes: [{ ...x, etat: 'IN_PROGRESS' }], offset: 0, total: null, lus: 1 });
    v = ((f.lignes.vc_ventes || {}).ventes || {})['70000003'] || {};
    dit(!!v.etapesAt && !!v.aExpedierAt, 'G4 une lecture « Mes ventes » garde les deux heures', JSON.stringify({ e: v.etapesAt, a: v.aExpedierAt }));
    await pause();
    await f.ctx.rangerVcVentes({ source: 'a-expedier', ventes: [x], offset: 0, total: null, lus: 1 });
    v = ((f.lignes.vc_ventes || {}).ventes || {})['70000003'] || {};
    dit(aExp(v, (f.lignes.vc_ventes || {}).lectures) === true, 'G5 la liste « à expédier » relue APRÈS (elle la liste encore) ⇒ de nouveau à expédier', JSON.stringify({ e: v.etapesAt, a: v.aExpedierAt }));
  });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
