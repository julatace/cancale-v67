#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOT L (10 nov.) — CALCULETTE D'ACHAT · HISTORIQUE DE PRIX · EMBALLAGES
//         node scripts/audit-calculette-emballages.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/calculetteAchat.js, src/historiquePrix.js, src/emballages.js et
// src/histoireArticle.js sur des données INVENTÉES (le dépôt est public), et lit
// dans le code des écrans que :
//   K. la calculette rend le bénéfice de LA règle (`cascadeVente` = `beneficePaire`)
//      sur les prix TAPÉS ; frais LUS (Vinted et Leboncoin 0 sûr, eBay la part lue sur
//      SES commandes ⇒ « environ », Vestiaire pas lue ⇒ « au plus ») ; emballage vide ⇒
//      « au plus », jamais un 0 ; elle n'écrit RIEN et ne propose aucun prix ; ouverte
//      depuis Achats et ⌘K (une action qui OUVRE) ;
//   P. l'historique de prix ne garde que ce qui a été LU : daté par la lecture de SON
//      compte (jamais l'heure de l'écran), un prix inchangé n'ajoute rien, une capture
//      plus ancienne ne réécrit rien, un compte sans date de lecture n'écrit rien, une
//      autre devise n'écrit rien ; 50 annonces au même titre gardent chacune SA série ;
//      la fiche (étape Prix) montre les prix lus et l'escalier ;
//   E. le stock d'emballages est DÉRIVÉ des « Colis fait » datés après SON comptage ;
//      un « Annuler » rend l'emballage ; pas compté ⇒ « — » (jamais 0) ; plusieurs
//      types sans défaut ⇒ rien décompté, compté à part ; « Aucun » ne décompte rien ;
//      alerte AMBRE au seuil ou dessous, jamais rouge ; le coût ne va dans une vente
//      que sur SON clic (aucune écriture de `emballage` ailleurs que la porte).
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'prix-date-ecran': ['let n = [...L, [Math.round(ts), c]];', 'let n = [...L, [maintenant, c]];', 'historiquePrix.js'],
  'prix-inchange-ajoute': ['if (der && (ts <= der[0] || der[1] === c)) continue;', 'if (der && (ts <= der[0])) continue;', 'historiquePrix.js'],
  'prix-ancienne-ecrit': ['if (der && (ts <= der[0] || der[1] === c)) continue;', 'if (der && (der[1] === c)) continue;', 'historiquePrix.js'],
  'prix-sans-date-ecrit': ["if (!Number.isFinite(ts) || ts <= 0 || ts > maintenant + 60000) continue;", "if (!Number.isFinite(ts)) { if (false) continue; }", 'historiquePrix.js'],
  'prix-fiche-absente': ["for (const pt of serie.points) if (pt.source === 'lu')", "for (const pt of []) if (pt.source === 'lu')", 'histoireArticle.js'],
  'emb-avant-comptage': ['if (!t || !t.compte || !(f.at > t.compte.at)) continue;', 'if (!t || !t.compte) continue;', 'emballages.js'],
  'emb-pas-compte-zero': ['const restant = t.compte ? t.compte.n - u : null;', 'const restant = t.compte ? t.compte.n - u : 0;', 'emballages.js'],
  'emb-sans-type-reparti': ['return r.types.length === 1 ? r.types[0].id : null;', 'return r.types.length ? r.types[0].id : null;', 'emballages.js'],
  'emb-rouge': ['.vrm-emb2-alerte { margin: -4px 0 8px; font-size: 13px; font-weight: 600; color: var(--vrm-warn, #B25000); }', '.vrm-emb2-alerte { margin: -4px 0 8px; font-size: 13px; font-weight: 600; color: #D70015; }', 'styles-calculette-emballages.css'],
  'emb-cout-auto': ["{emballage && c.peutFaire && !fait ? emballage(c) : null}", "{emballage && c.peutFaire && !fait ? emballage(c) : null}{(() => { try { window.__ov = { emballage: '0.8' }; } catch (_) {} return null; })()}", 'PreparerColis.jsx'],
  'calc-vestiaire-sur': ["if (site === 'vestiaire') return { etat: 'pasLu', phrase: 'Commission Vestiaire pas lue' };", "if (site === 'vestiaire') return { etat: 'zero', phrase: 'Vestiaire' };", 'calculetteAchat.js'],
  'calc-emballage-vide-zero': ["if (!e) manque.push('emballage pas compté');", '', 'calculetteAchat.js'],
  'calc-ebay-devine': ["if (!Array.isArray(ebayCommandes) || typeof commandeEbayEngagee !== 'function') return { etat: 'pasLu', phrase: 'Frais eBay pas encore lus' };", "if (!Array.isArray(ebayCommandes) || typeof commandeEbayEngagee !== 'function') return { etat: 'taux', taux: 130, n: 0, phrase: '13 %' };", 'calculetteAchat.js'],
  'calc-ecrit': ['const choix = useMemo(() => emballagesAvecCout(emballages), [emballages]);', "const choix = useMemo(() => emballagesAvecCout(emballages), [emballages]);\n  try { localStorage.setItem('vrm_calc', achat); } catch (_) {}", 'CalculetteAchat.jsx'],
  'cmdk-absent': ["    case 'calculette': return { feuille: 'calculette' };\n", '', 'annulerCommandes.js'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'calc-emb-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const f = path.join(d, 'src', MUTS[MUT][2]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let K, P, E, B, H;
  try {
    K = await import(url('calculetteAchat.js')); P = await import(url('historiquePrix.js')); E = await import(url('emballages.js'));
    B = await import(url('beneficePaire.js')); H = await import(url('histoireArticle.js'));
  } catch (e) { dit(false, 'les modules du lot L existent et se chargent', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }

  // ── K ────────────────────────────────────────────────────────────────────
  console.log('\n── K. La calculette d’achat');
  const k1 = K.calculer({ achat: '60', revente: '120', site: 'vinted', emballage: '0,80' });
  dit(k1.etat === 'ok' && k1.benefice === 5920 && k1.borne === 'exact', 'K1 Vinted : 120 − 60 − 0,80 = 59,20 € (aucune commission vendeur), exact', JSON.stringify({ b: k1.benefice, borne: k1.borne }));
  dit(B.beneficePaire('120', { buyPrice: '60', emballage: '0.80' }).benefice * 100 === k1.benefice, 'K2 la MÊME règle que le bénéfice d’une vente (`beneficePaire`)');
  const k3 = K.calculer({ achat: '60', revente: '120', site: 'vinted', emballage: '' });
  dit(k3.etat === 'ok' && k3.borne === 'au-plus' && k3.cascade.emballage === null && k3.manque.includes('emballage pas compté'), 'K3 emballage vide ⇒ « au plus », nommé (jamais un 0 deviné)', JSON.stringify({ borne: k3.borne, m: k3.manque }));
  const k4 = K.calculer({ achat: '60', revente: '120', site: 'vestiaire', emballage: '1' });
  dit(k4.etat === 'ok' && k4.borne === 'au-plus' && k4.frais.etat === 'pasLu', 'K4 Vestiaire : commission pas lue ⇒ « au plus », jamais devinée', JSON.stringify({ borne: k4.borne }));
  const k5 = K.calculer({ achat: '60', revente: '120', site: 'leboncoin', emballage: '1' });
  dit(k5.borne === 'exact' && k5.benefice === 5900, 'K5 Leboncoin : le prix est ce que le vendeur touche ⇒ exact');
  const cmd = (id, du, fee, extra = {}) => ({ orderId: id, orderPaymentStatus: 'PAID', creationDate: '2026-10-01T10:00:00Z', paymentSummary: { totalDueSeller: { value: du, currency: 'EUR' } }, totalMarketplaceFee: fee == null ? undefined : { value: fee, currency: 'EUR' }, ...extra });
  const engagee = () => true;
  const ebay = [cmd('a', '100.00', '13.00'), cmd('b', '200.00', '26.00'), cmd('c', '50.00', null)];
  const k6 = K.calculer({ achat: '60', revente: '120', site: 'ebay', emballage: '1' }, { ebayCommandes: ebay, commandeEbayEngagee: engagee });
  dit(k6.frais.etat === 'taux' && k6.frais.taux === 130 && k6.frais.n === 2 && k6.cascade.frais === 1560 && k6.borne === 'environ' && k6.benefice === 12000 - 6000 - 1560 - 100,
    'K6 eBay : 13 % LU sur ses 2 commandes aux frais lus (la 3e sans frais n’entre pas) ⇒ « environ »', JSON.stringify({ f: k6.frais, b: k6.benefice }));
  const k7 = K.calculer({ achat: '60', revente: '120', site: 'ebay', emballage: '1' }, { ebayCommandes: null, commandeEbayEngagee: engagee });
  const k7b = K.calculer({ achat: '60', revente: '120', site: 'ebay', emballage: '1' }, { ebayCommandes: [cmd('c', '50.00', null)], commandeEbayEngagee: engagee });
  dit(k7.borne === 'au-plus' && k7.frais.etat === 'pasLu' && k7b.borne === 'au-plus', 'K7 eBay sans commande aux frais lus ⇒ frais pas sus, « au plus » (jamais un taux deviné)');
  dit(K.calculer({ achat: '', revente: '120', site: 'vinted' }).etat === 'vide' && K.calculer({ achat: 'soixante', revente: '120', site: 'vinted' }).etat === 'illisible', 'K8 un prix manquant ⇒ rien ; illisible ⇒ dit, jamais 0');
  const k9 = K.calculer({ achat: '130', revente: '120', site: 'vinted', emballage: '1' });
  dit(k9.benefice === -1100 && K.eurosCalc(k9.benefice) === '−11 €', 'K9 une perte se dit (−11 €)');
  const CA = sansCommentaires(lire('CalculetteAchat.jsx')), CK = sansCommentaires(lire('calculetteAchat.js'));
  dit(!/save\(|localStorage\.setItem|fetch\(|vmrCmd|setSaleOverride/.test(CA + CK), 'K10 la calculette n’écrit rien, n’envoie rien');
  dit(!/conseill|sugg[eè]r|prix id[ée]al|vends-la/i.test(CA + CK), 'K11 aucun prix conseillé (refusé le 11 oct.) : c’est LUI qui tape la revente');
  dit(/cascadeVente\(v, fiche\)/.test(CK) && /fraisParPlateforme\(/.test(CK), 'K12 une règle : `cascadeVente` et les frais de `fraisParPlateforme` (aucune seconde formule)');
  const AC = await import(url('annulerCommandes.js'));
  const act = AC.actionsPour('calculette', { lireNumero: () => null });
  const dest = act[0] ? AC.destinationAction(act[0]) : null;
  dit(act[0] && act[0].id === 'calculette' && dest && dest.feuille === 'calculette', '⌘K « calculette » OUVRE la calculette', JSON.stringify(dest));
  const A = sansCommentaires(lire('App.jsx'));
  dit(/data-achats-calculette=""[^>]*onClick=\{\(\) => \{ try \{ window\.dispatchEvent\(new Event\('vrm:calculette'\)\)/.test(A) && /if \(d\.feuille === 'calculette'\) \{ setCalcOuverte\(true\); return; \}/.test(A)
    && /\{calcOuverte && <GardeEcran nom="calculette"/.test(A), 'K13 ouverte depuis Achats (bouton) et ⌘K, sous son garde-fou');

  // ── P ────────────────────────────────────────────────────────────────────
  console.log('\n── P. L’historique de prix');
  const MAINT = Date.parse('2026-11-20T12:00:00Z');
  const t1 = Date.parse('2026-11-10T08:00:00Z'), t2 = Date.parse('2026-11-12T08:00:00Z'), t3 = Date.parse('2026-11-14T08:00:00Z');
  const acc = { vinted_user_id: '42' };
  const it = (id, prix, cur = 'EUR') => ({ id, _acc: acc, price: { amount: prix, currency_code: cur } });
  let j = P.noterPrixLus(null, [it('111', '120.0')], { 42: t1 }, { maintenant: MAINT });
  dit(j.ajoutes === 1 && j.journal.a['111'][0][0] === t1 && j.journal.a['111'][0][1] === 12000, 'P1 un prix lu est daté par la lecture de SON compte (jamais l’heure de l’écran)', JSON.stringify(j.journal.a));
  const j2 = P.noterPrixLus(j.journal, [it('111', '120.0')], { 42: t2 }, { maintenant: MAINT });
  dit(j2.ajoutes === 0 && j2.journal === j.journal, 'P2 un prix inchangé n’ajoute rien (le journal ne bouge pas)');
  const j3 = P.noterPrixLus(j.journal, [it('111', '110')], { 42: t2 }, { maintenant: MAINT });
  const j4 = P.noterPrixLus(j3.journal, [it('111', '99')], { 42: t1 }, { maintenant: MAINT });
  dit(j3.ajoutes === 1 && j4.ajoutes === 0 && j3.journal.a['111'].length === 2, 'P3 un prix changé s’ajoute ; une capture plus ancienne ne réécrit rien');
  const j5 = P.noterPrixLus(null, [it('111', '120')], {}, { maintenant: MAINT });
  const j6 = P.noterPrixLus(null, [it('111', '120', 'GBP'), { id: '222', _acc: acc, price: null }], { 42: t1 }, { maintenant: MAINT });
  dit(j5.ajoutes === 0 && j6.ajoutes === 0, 'P4 sans date de lecture du compte, autre devise ou prix absent ⇒ rien noté (pas su)');
  const cinquante = Array.from({ length: 50 }, (_, i) => ({ ...it('9' + i, String(100 + i)), title: 'Nike Air Max 90 blanc 42' }));
  const j7 = P.noterPrixLus(null, cinquante, { 42: t1 }, { maintenant: MAINT });
  const s7 = P.seriePrix(['97'], { lus: j7.journal });
  dit(j7.ajoutes === 50 && s7.points.length === 1 && s7.points[0].prix === 10700, 'P5 50 annonces au même titre : chacune SA série, par son identifiant', JSON.stringify(s7.points));
  const s8 = P.seriePrix(['111'], { lus: j3.journal, prixVinted: [{ uid: '42', item: '111', avant: 110, apres: 95, at: new Date(t3).toISOString() }, { item: '999', avant: 1, apres: 2, at: new Date(t3).toISOString() }] });
  dit(s8.points.map((p) => p.prix).join(',') === '12000,11000,9500' && s8.points[2].source === 'vrm' && s8.depuis === '2026-11-20', 'P6 la série mêle prix lus et changés depuis VRM (relus), par identité ; elle dit depuis quand', JSON.stringify(s8));
  dit(P.seriePrix(['111'], { lus: { pas: 'lisible' } }).lisible === false, 'P7 un journal illisible ⇒ « pas su », jamais une série vide prise pour « aucun changement »');
  const rn = { cle: '5', num: '5', annonces: [{ id: '111', titre: 'x' }] };
  let etapePrix = null;
  try { const h = H.histoireArticle(rn, { fiches: {}, journalPrix: [], prixVinted: [], prixLus: j3.journal }); etapePrix = h && h.etapes.find((e) => e.cle === 'prix'); } catch (e) { etapePrix = { erreur: e.message }; }
  dit(etapePrix && etapePrix.etat === 'fait' && (etapePrix.evenements || []).filter((e) => e.cle === 'prix-lu').length === 2 && Array.isArray(etapePrix.serie) && etapePrix.serie.length === 2,
    'P8 la fiche paire (étape Prix) montre les prix LUS, datés, et la série de l’escalier', JSON.stringify(etapePrix && { etat: etapePrix.etat, ev: (etapePrix.evenements || []).length, s: etapePrix.serie && etapePrix.serie.length }));
  dit(P.escalierPrix(s8.points, { maintenant: MAINT }).marches.length === 3 && P.escalierPrix([s8.points[0]]) === null, 'P9 l’escalier : un palier par prix, rien sous deux prix');
  const FP = sansCommentaires(lire('FichePaire.jsx'));
  dit(/e\.cle === 'prix' && Array\.isArray\(e\.serie\) && e\.serie\.length > 1 \? <EscalierPrix points=\{e\.serie\}\/>/.test(FP), 'P10 la fiche rend l’escalier des prix');
  dit(/noterPrixLus\(avant, \[\.\.\.listings\.items, \.\.\.\(listings\.aConfirmer \|\| \[\]\)\], listings\.lues \|\| \{\}\)/.test(A) && /listings\.error \|\| !AUTH\.user\?\.id \|\| !isCloudReady\(\)\) return;/.test(A)
    && /prixLus: load\(CLE_PRIX_LUS, null\)/.test(A) && /'vrm_prix_lus','vrm_emballages'/.test(A), 'P11 l’app note à chaque lecture des annonces (lecture en erreur ⇒ rien), synchronisé, lu par la fiche');

  // ── E ────────────────────────────────────────────────────────────────────
  console.log('\n── E. Le stock d’emballages');
  const T0 = Date.parse('2026-11-10T09:00:00Z');
  let r = E.poserType(null, { nom: 'Boîte', n: '10', cout: '0,80', seuil: '3' }, T0).reglage;
  const faits = E.colisFaits({ vinted: { 1001: T0 - 1000, 1002: T0 + 1000, 1003: T0 + 2000 }, leboncoin: { 77: T0 + 3000 }, vestiaire: { v9: T0 + 4000, v10: 1 } });
  let e1 = E.etatEmballages(r, faits);
  dit(e1.types[0].restant === 6 && e1.types[0].utilises === 4, 'E1 restant = compté − « Colis fait » datés APRÈS le comptage (Vinted, Leboncoin, Vestiaire ; sans date ⇒ pas décompté)', JSON.stringify(e1.types[0]));
  const faitsAnnule = faits.filter((f) => f.cle !== 'v:1003');
  dit(E.etatEmballages(r, faitsAnnule).types[0].restant === 7, 'E2 un « Annuler » (la coche retirée) rend l’emballage tout seul');
  const rNc = E.poserType(null, { nom: 'Sac' }, T0).reglage;
  dit(E.etatEmballages(rNc, faits).types[0].restant === null, 'E3 jamais compté ⇒ « — » (jamais 0)');
  r = E.poserType(r, { nom: 'Sac', n: '20' }, T0).reglage;
  const r2 = { ...r, defaut: null };
  const e4 = E.etatEmballages(r2, faits);
  dit(e4.types.every((t) => t.utilises === 0) && e4.sansType === 4, 'E4 plusieurs types sans défaut ⇒ rien décompté au hasard, « N colis sans emballage choisi »', JSON.stringify({ u: e4.types.map((t) => t.utilises), s: e4.sansType }));
  const r3 = E.choisirPourColis(E.choisirPourColis(r, 'v:1002', 't2').reglage, 'v:1003', E.AUCUN).reglage;
  const e5 = E.etatEmballages(r3, faits);
  dit(e5.types[0].utilises === 2 && e5.types[1].utilises === 1 && e5.sansType === 0, 'E5 SON choix par colis (facultatif) : un autre type, ou « Aucun » qui ne décompte rien', JSON.stringify(e5.types.map((t) => t.utilises)));
  const e6 = E.etatEmballages(E.poserType(r, { id: 't1', nom: 'Boîte', n: '3', seuil: '3' }, T0 + 10000).reglage, faits);
  dit(e6.types[0].alerte && e6.types[0].restant === 3 && e6.alertes === 1, 'E6 alerte au seuil ou dessous ; recompter re-date le comptage');
  dit(E.poserType(null, { nom: '' }).erreur && E.poserType(null, { nom: 'X', cout: 'un euro' }).erreur && E.poserType(null, { nom: 'X', n: '-3' }).erreur, 'E7 nom vide, coût ou nombre illisible ⇒ refusé, rien écrit');
  dit(E.emballagesAvecCout(r).length === 1 && E.emballagesAvecCout(r)[0].cout === '0,80', 'E8 seuls les emballages à coût sont proposés dans la vente');
  const CSS = lire('styles-calculette-emballages.css');
  dit(/\.vrm-emb2-alerte \{[^}]*color: var\(--vrm-warn/.test(CSS) && !/#D70015|#FF3B30|#FF453A|#FF6961|\bred\b/i.test(CSS), 'E9 l’alerte est ambre, jamais rouge');
  const EC = sansCommentaires(lire('EmballagesCarte.jsx')), PC = sansCommentaires(lire('PreparerColis.jsx')), SK = sansCommentaires(lire('ecrans/Stock.jsx')), CV = sansCommentaires(lire('CascadeVente.jsx'));
  dit(!/emballage\s*:/.test(EC + PC.replace(/emballage = null/g, '')) && !/setSaleOverride|__ov/.test(EC + PC) && /onClick=\{\(\) => \{ setTxt\(t\.cout\); setErr\(false\); \}\}/.test(CV),
    'E10 le coût ne va dans une vente QUE par la porte « Emballage » (une puce remplit le champ, SON « OK » enregistre)');
  dit(/<EmballagesCarte reglage=\{emballagesR\}/.test(SK) && /colisFaits\(\{ vinted: load\('vinted_ship_done', \{\}\), leboncoin: load\('vrm_lbc_colis_done', \{\}\), vestiaire: load\('vrm_vc_colis_done', \{\}\) \}\)/.test(SK),
    'E11 le Stock porte la carte ; le reste se lit sur les « Colis fait » rangés (aucun second compteur)');
  dit(/emballage=\{\(c\) => <ChoixEmballageColis reglage=\{emballagesR\} cle=\{c\.cle\}/.test(A) && /\{emballage && c\.peutFaire && !fait \? emballage\(c\) : null\}/.test(PC), 'E12 « Préparer mes colis » : le choix d’emballage de CE colis');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
