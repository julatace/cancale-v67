#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — UN COLIS À RETIRER DIT CE QU'IL CONTIENT TOUT SEUL, OU NE DIT RIEN (19 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (19 nov., mot pour mot) : « je ne dois pas relier l'achat au colis qui est au point relais, ça doit être
// automatique : quand je fais l'achat, l'extension doit capter le numéro de suivi, et ensuite le numéro de suivi est
// sur le code de retrait normalement ou dans le mail, donc on doit pouvoir voir il y a quoi dans chaque code de
// retrait, ça doit être automatique. Sinon ce n'est pas grave, mais on ne doit pas avoir le bouton relier un achat,
// c'est totalement débile et c'est une perte de temps monumentale. »
// Récit, mesure sur sa base et ce qui dépend de l'extension : docs/passation/2026-11-19-colis-achat-auto.md.
//
// Exécute les VRAIES règles (src/contenuColis.js, src/liensColis.js, api/_lib/commande-colis.js,
// api/_lib/suivi-colis.js, les dictionnaires src/i18n/langues/*) et lit le branchement, commentaires retirés :
//   A  n° IDENTIQUE des deux côtés ⇒ relié : la carte montre le titre, le prix payé, le compte ;
//   B  n° SOUS UNE AUTRE FORME ⇒ relié : espaces, tirets, minuscules (`normaliserSuivi`), et le n° du 2e
//      transporteur d'un trajet (la liste `suivisV`, extension 5.403) ;
//   C  50 achats AU MÊME TITRE, un seul porte le n° ⇒ celui-là et aucun autre ; aucun ne le porte ⇒ personne
//      (jamais le titre, §5) ;
//   D  AUCUN n° côté achat ⇒ pas relié : « Contenu pas encore lu », le geste « ouvre vinted.fr sur {compte} »
//      seulement quand le compte du colis est su ; jamais de prix inventé ; le sélecteur d'un colis (`x.contenu`,
//      que l'écran d'aujourd'hui ET l'écran Achats de « VRM natif » lisent) ne porte aucun geste ;
//   E  un LIEN MANUEL ancien (`colis_suivi_*` portant tx/uid) reste lu, par l'app (index `suivis`) et par le
//      serveur (`liensDesLignes` → `indexDesLiens`) ;
//   F  mieux vaut un blanc qu'un faux : deux achats au même n° ⇒ personne ; les deux chemins d'identité en
//      désaccord ⇒ personne ; l'achat d'un AUTRE compte au même n° de transaction ne relie rien ;
//   G  le branchement : plus AUCUN geste « Relier » sur un colis à retirer (passe, colonne détaillée, clés de
//      traduction) ; chaque carte « à retirer » porte SON `contenu` (`cartesColis` → `contenuDuColis`), l'écran relie
//      par `achatDuRetrait` ; la feuille de choix ne s'ouvre plus que depuis le scanner ;
//   T  les phrases existent dans les 5 langues, avec leurs variables.
// `--prouve` : chaque mutation réaffaiblit UNE règle ⇒ l'audit DOIT rougir (un contrôle qui ne peut pas échouer
// est pire qu'absent, §6). Sur le code d'avant (`git archive origin/main`, l'audit copié DEDANS) : rouge.
// Un audit ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');

const MUTS = {
  'bouton-sur-la-passe': ['src/designV2/PassesRetrait.jsx', "          <BoutonV2 role=\"texte\" onClick={() => setFait(true)}", "          <BoutonV2 role=\"texte\" onClick={() => {}} attrs={{ 'data-v2-relier': '' }}>Relier l’achat</BoutonV2>\n          <BoutonV2 role=\"texte\" onClick={() => setFait(true)}"],
  'bouton-sur-la-ligne': ['src/CarteRelais.jsx', "        <span className=\"vrm-rpf-relier-t\">{contenuTxt}</span>", "        <span className=\"vrm-rpf-relier-t\">{contenuTxt}</span><button type=\"button\" data-rp-relier-ouvrir={x.cle}>Relier</button>"],
  'par-le-titre': ['src/contenuColis.js', "  return commandeUnique(a, jonction || null);", "  return commandeUnique(a, jonction || null) || (achats || []).find((o) => o && t.artTitle && o.title === t.artTitle) || null;"],
  'deux-achats-le-premier': ['src/liensColis.js', " return c&&c.size===1?[...c.values()][0]:null;", " return c&&c.size>=1?[...c.values()][0]:null;"],
  'desaccord-ignore': ['src/contenuColis.js', "  return commandeUnique(a, jonction || null);", "  return a || jonction || null;"],
  'lien-manuel-ignore': ['src/liensColis.js', ",...(Array.isArray(t.suivis)?t.suivis:[])].map(normaliserSuivi)", "].map(normaliserSuivi)"],
  'deuxieme-numero-ignore': ['src/liensColis.js', "t.suivi,...(Array.isArray(t.suivisV)?t.suivisV:[]),", "t.suivi,"],
  'normalisation-retiree': ['api/_lib/etat-colis-email.js', "String(v||'').toUpperCase().replace(/[\\s\\u00a0-]+/g,'').trim()", "String(v||'').trim()"],
  'autre-compte-relie': ['src/liensColis.js', " if(t.uid&&uid&&String(t.uid)!==uid)return [];", ""],
  'pas-lu-muet': ['src/contenuColis.js', "  return { etat: 'pas-lu', raison: compte ? 'ouvrir-vinted' : '', compte };", "  return null;"],
  'compte-invente': ['src/contenuColis.js', "  const compte = String(compteColis || '').trim();", "  const compte = String(compteColis || 'ton compte').trim();"],
  'geste-sans-compte': ['src/contenuColis.js', "  return { etat: 'pas-lu', raison: compte ? 'ouvrir-vinted' : '', compte };", "  return { etat: 'pas-lu', raison: 'ouvrir-vinted', compte: compte || 'Vinted' };"],
  'photo-perdue': ['src/contenuColis.js', "photo: photo || null, prix:", "photo: null, prix:"],
  'prix-invente': ['src/contenuColis.js', "prix: String(prix || ''), compte: String(compteAchat || '') };", "prix: String(prix || '0,00 €'), compte: String(compteAchat || '') };"],
  'sans-numero-dit-pas-lu': ['src/contenuColis.js', "  if (!normaliserSuivi(suivi)) return null;\n", ""],
  'app-autre-regle': ['src/App.jsx', "  const commandeRetrait = (t) => achatDuRetrait(t, { achats: buysBase, index: indexSuivisAchats,", "  const commandeRetrait = (t) => achatDuRetraitAutre(t, { achats: buysBase, index: indexSuivisAchats,"],
  'app-relier-revenu': ['src/App.jsx', "aides={{ echeance: echeanceRetrait, titre: titreRetrait, retirer: retirerColis,", "aides={{ echeance: echeanceRetrait, titre: titreRetrait, retirer: retirerColis, relier: (x) => () => setRelierColis({ suivi: suiviDeLigne(x.src.t) }),"],
  'app-carte-sans-contenu': ['src/App.jsx', "...champsSources(scE), contenu: contenuCarte({ t, o: cmdN, autre: aa, site: aa ? aa.site : 'vinted' }), src: { t } });", "...champsSources(scE), src: { t } });"],
  'app-prix-brut': ['src/App.jsx', "prix: p != null && p > 0 ? montant(p) : '', compteAchat:", "prix: montant(montantCommande(o)), compteAchat:"],
  'cle-allemande-absente': ['src/i18n/langues/de/achats.js', '  "achats.contenu.pasLuCompte":', '  "achats.contenu.pasLuCompteX":'],
  'cle-relier-revenue': ['src/i18n/langues/fr/designV2.js', '  "v2.passe.retire":', '  "v2.passe.relier": "Relier l’achat",\n  "v2.passe.retire":'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0, sortie = '';
    try { sortie = String(execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' })); } catch (e) { code = e.status; sortie = String(e.stdout || ''); }
    const rouges = (sortie.match(/^❌ .*$/gm) || []).map((l) => l.slice(2, 70)).slice(0, 2).join(' | ');
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}${rouges ? ' — ' + rouges : ''}`);
    if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`);
  process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let RC = R;   // la racine du code jugé (une copie quand une mutation est demandée)
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  if (!MUTS[MUT]) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'colis-achat-auto-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  fs.cpSync(path.join(R, 'api', '_lib'), path.join(d, 'api', '_lib'), { recursive: true });
  const [f, de, vers] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(de, vers)); RC = d;
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || d === '' ? '' : ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300))); };
const importer = async (rel) => { try { return await import('file://' + path.join(RC, rel)); } catch (e) { dit(false, rel + ' se charge', String(e && e.message).slice(0, 160)); return null; } };
const lire = (rel) => { try { return fs.readFileSync(path.join(RC, rel), 'utf8'); } catch (_) { return null; } };
const sansCommentaires = (t) => String(t || '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ── La base inventée (dépôt public : aucun n°, titre ni compte réels) ──────────
const COMPTE_A = { vinted_user_id: '111', login: 'compte_a' }, COMPTE_B = { vinted_user_id: '222', login: 'compte_b' };
const achat = (tx, titre, compte = COMPTE_A, prix = '24.00') => ({ transaction_id: tx, conversation_id: `0000aaaa-bbbb-7ccc-8ddd-${String(tx).padStart(12, '0')}`, title: titre, price: { amount: prix, currency_code: 'EUR' }, status: 'Colis disponible au point relais', date: '2026-11-10T10:00:00Z', _acc: compte });
const N = '81000037';                       // un n° Mondial Relay (8 chiffres), inventé
const N2 = 'XW100000002FR';                 // le n° du 2e transporteur d'un trajet, inventé
const TITRE = 'Baskets blanches 42';
const cinquante = Array.from({ length: 50 }, (_, i) => achat(9000001 + i, TITRE));
const BON = cinquante[36];
const cle = (o) => `${o._acc.vinted_user_id}:${o.transaction_id}`;
const colis = (suivi, plus = {}) => ({ suivi, carrier: 'mondialrelay', status: 'available', code: '123456', ...plus });

(async () => {
  const C = await importer('src/contenuColis.js');
  const L = await importer('src/liensColis.js');
  const J = await importer('api/_lib/commande-colis.js');
  const S = await importer('api/_lib/suivi-colis.js');
  const achatDuRetrait = C && C.achatDuRetrait, contenuDuColis = C && C.contenuDuColis, texteContenu = C && C.texteContenu;
  const regle = typeof achatDuRetrait === 'function' && typeof contenuDuColis === 'function' && typeof texteContenu === 'function';
  dit(regle, 'la règle existe (src/contenuColis.js : `achatDuRetrait`, `contenuDuColis`, `texteContenu`)');
  // Les phrases françaises RÉELLES (le dictionnaire), avec leurs variables.
  const dico = {};
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const m = await importer(`src/i18n/langues/${l}/achats.js`); dico[l] = (m && m.default) || {}; }
  const trDe = (l) => (k, v = {}) => String(dico[l][k] == null ? `⟦${k}⟧` : dico[l][k]).replace(/\{(\w+)\}/g, (_, n) => (v[n] == null ? `{${n}}` : String(v[n])));
  const tr = trDe('fr');
  const essai = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (exécution)', String(e && e.message).slice(0, 200)); } };
  const relie = (t, achats, index, jonction = null) => achatDuRetrait(t, { achats, index, jonction });
  const PHOTO = { url: 'https://images.exemple.test/x37.jpeg' };
  const carte = (t, achats, index, plus = {}) => { const o = relie(t, achats, index); return contenuDuColis({ ligne: t, suivi: t.suivi, achat: o, site: 'vinted', photo: o ? PHOTO : null, prix: o ? '24,00 €' : '', compteAchat: o ? o._acc.login : '', ...plus }); };

  console.log('\n── A. Le même n° des deux côtés ⇒ relié');
  if (regle) await essai('A', async () => {
    const index = { [cle(BON)]: { uid: '111', suivi: N } };
    const o = relie(colis(N), cinquante, index);
    dit(o === BON, 'A1 le colis du transporteur est relié à SON achat (par le n° de suivi lu sur Vinted)', o && o.transaction_id);
    const c = carte(colis(N), cinquante, index);
    dit(!!c && c.etat === 'relie' && c.tx === String(BON.transaction_id) && c.titre === TITRE && c.photo === PHOTO && c.prix === '24,00 €' && c.compte === 'compte_a', 'A2 le sélecteur du colis porte l’achat : photo, titre, prix payé, compte', c);
    dit(texteContenu(c, tr) === 'Payé 24,00 € · compte_a', 'A3 la phrase : « Payé 24,00 € · compte_a »', texteContenu(c, tr));
    const sansPrix = contenuDuColis({ ligne: colis(N), suivi: N, achat: BON, site: 'vinted', prix: '', compteAchat: '' });
    dit(sansPrix.etat === 'relie' && sansPrix.prix === '' && texteContenu(sansPrix, tr) === '', 'A4 prix pas lu, un seul compte ⇒ rien n’est ajouté (jamais « 0,00 € »)', sansPrix);
    dit(texteContenu(contenuDuColis({ ligne: colis(N), suivi: N, achat: BON, prix: '24,00 €' }), tr) === 'Payé 24,00 €', 'A5 le prix seul : « Payé 24,00 € »');
  });

  console.log('\n── B. Le n° sous une autre forme ⇒ relié');
  if (regle) await essai('B', async () => {
    const index = { [cle(BON)]: { uid: '111', suivi: N } };
    dit(relie(colis('8100 0037'), cinquante, index) === BON && relie(colis('81-000-037'), cinquante, index) === BON && relie(colis(' 81000037 '), cinquante, index) === BON, 'B1 espaces, tirets, espace insécable : le même n° (`normaliserSuivi`)');
    const indexMin = { [cle(BON)]: { uid: '111', suivi: 'xw 1000-00002 fr' } };
    dit(relie(colis(N2), cinquante, indexMin) === BON, 'B2 minuscules et séparateurs côté Vinted : le même n°');
    const index2 = { [cle(BON)]: { uid: '111', suivi: 'BRT0000000001', suivisV: ['BRT0000000001', N2], listeLue: true } };
    dit(relie(colis(N2, { carrier: 'chronopost' }), cinquante, index2) === BON, 'B3 le n° du 2e transporteur du trajet (liste `suivisV`) relie le colis à l’achat');
    dit(relie(colis('81000038'), cinquante, index) === null && relie(colis('8100003'), cinquante, index) === null && relie(colis('181000037'), cinquante, index) === null, 'B4 un n° voisin, tronqué ou allongé n’est PAS le même (aucune ressemblance)');
  });

  console.log('\n── C. 50 achats au même titre : seul celui qui porte le n°');
  if (regle) await essai('C', async () => {
    const index = { [cle(BON)]: { uid: '111', suivi: N } };
    const o = relie(colis(N, { artTitle: TITRE }), cinquante, index);
    dit(o === BON && cinquante.filter((x) => x.title === TITRE).length === 50, 'C1 le 37e (celui du n°), et aucun des 49 autres', o && o.transaction_id);
    for (const autre of ['81000001', '81000002', '81000050']) if (relie(colis(autre, { artTitle: TITRE }), cinquante, index) !== null) { dit(false, 'C2 un autre n° ne désigne aucun des 50', autre); return; }
    dit(true, 'C2 un autre n° ne désigne aucun des 50 (même titre, même prix, même compte)');
    dit(relie(colis(N, { artTitle: TITRE }), cinquante, {}) === null, 'C3 aucun achat ne porte le n° ⇒ personne, même avec le titre dans l’e-mail (jamais le titre, §5)');
    const c = carte(colis(N, { artTitle: TITRE }), cinquante, {}, { compteColis: 'compte_a' });
    dit(!!c && c.etat === 'pas-lu' && !('titre' in c) && !('tx' in c), 'C3 la carte ne nomme alors aucun achat', c);
  });

  console.log('\n── D. Aucun n° côté achat ⇒ pas relié, une phrase honnête, aucun geste');
  if (regle) await essai('D', async () => {
    const c = carte(colis(N), cinquante, {}, { compteColis: 'compte_a' });
    dit(!!c && c.etat === 'pas-lu' && c.raison === 'ouvrir-vinted' && c.compte === 'compte_a', 'D1 « pas lu », sa raison (« ouvrir-vinted ») et le compte du colis (l’adresse qui a reçu son e-mail)', c);
    dit(texteContenu(c, tr) === 'Contenu pas encore lu · ouvre vinted.fr sur compte_a', 'D2 la phrase dit le geste : « ouvre vinted.fr sur compte_a »', texteContenu(c, tr));
    const sans = carte(colis(N), cinquante, {}, { compteColis: '' });
    dit(!!sans && sans.etat === 'pas-lu' && sans.raison === '' && sans.compte === '' && texteContenu(sans, tr) === 'Contenu pas encore lu', 'D3 compte du colis pas su ⇒ « Contenu pas encore lu », aucune raison ni geste inventés', { sans, t: texteContenu(sans, tr) });
    dit(Object.keys(c).sort().join() === 'compte,etat,raison' && Object.values(c).every((v) => typeof v === 'string'), 'D4 rien à toucher : le sélecteur ne porte que des données (ni « relier », ni fonction)', Object.keys(c));
    dit(contenuDuColis({ ligne: colis(''), suivi: '', achat: null, site: 'vinted', compteColis: 'compte_a' }) === null, 'D5 une ligne sans n° de suivi (la moitié Vinted « Ton achat t’attend ») : rien à dire');
    dit(contenuDuColis({ ligne: colis(N), suivi: N, achat: null, site: 'leboncoin' }) === null && contenuDuColis({ ligne: colis(N), suivi: N, achat: null, site: 'vinted', redirige: true }) === null, 'D6 un colis d’un autre site, ou redirigé : rien à dire');
    const aa = contenuDuColis({ ligne: colis(N), suivi: N, achat: null, autreSite: { site: 'leboncoin', titre: 'Sac' }, site: 'leboncoin' });
    dit(!!aa && aa.etat === 'autre-site' && aa.site === 'leboncoin' && texteContenu(aa, tr) === '', 'D7 l’achat d’un autre site relié par le n° : dit par sa propre ligne, rien de plus ici', aa);
    dit(texteContenu(null, tr) === '' && texteContenu(c, null) === '', 'D8 rien à dire ⇒ une chaîne vide (jamais « undefined »)');
  });

  console.log('\n── E. Un lien posé à la main par le passé reste lu');
  if (regle) await essai('E', async () => {
    // La forme de l'app : la ligne `colis_suivi_*` lue devient `suivis` dans l'entrée d'index de SON achat.
    const index = { [cle(BON)]: { uid: '111', suivis: [N] } };
    dit(relie(colis(N), cinquante, index) === BON, 'E1 l’app : le n° relié à la main (`suivis`) relie toujours le colis à CET achat');
    const sansCompte = { [String(BON.transaction_id)]: { suivis: [N] } };
    dit(relie(colis(N), cinquante, sansCompte) === BON, 'E2 un lien ancien sans compte (clé = la transaction seule) est lu aussi');
    // Le serveur (rappels, nom de la paire) : les lignes PROJETÉES → `liensDesLignes` → `indexDesLiens`.
    const liens = S && S.liensDesLignes ? S.liensDesLignes([], [{ id: `colis_suivi_mondialrelay_${N}`, suivi: N, transporteur: 'mondialrelay', tx: String(BON.transaction_id), uid: '111' }]) : null;
    const idx = J && J.indexDesLiens ? J.indexDesLiens(liens) : {};
    const srv = J && J.commandeDuColisRegle ? J.commandeDuColisRegle(colis(N), { achats: cinquante.map((o) => ({ ...o, _acc: '111' })), index: idx }) : null;
    dit(!!srv && String(srv.transaction_id) === String(BON.transaction_id), 'E3 le serveur relie par le même lien manuel (`liensDesLignes` → `indexDesLiens` → `commandeDuColisRegle`)', srv && srv.transaction_id);
    const c = carte(colis(N), cinquante, index);
    dit(!!c && c.etat === 'relie' && c.tx === String(BON.transaction_id), 'E4 la carte montre l’achat relié à la main, comme un achat relié par l’extension', c);
  });

  console.log('\n── F. Mieux vaut un blanc qu’un faux');
  if (regle) await essai('F', async () => {
    const deux = { [cle(cinquante[3])]: { uid: '111', suivi: N }, [cle(cinquante[9])]: { uid: '111', suivi: N } };
    dit(relie(colis(N), cinquante, deux) === null, 'F1 deux achats portent le même n° ⇒ personne');
    const index = { [cle(BON)]: { uid: '111', suivi: N } };
    dit(relie(colis(N), cinquante, index, cinquante[2]) === null, 'F2 le n° dit un achat, la jonction (conversation, code) en dit un autre ⇒ personne');
    dit(relie(colis(N), cinquante, index, BON) === BON && relie(colis(N), cinquante, {}, cinquante[2]) === cinquante[2], 'F3 les deux chemins d’accord, ou un seul qui parle ⇒ cet achat');
    // La même transaction vue de DEUX de ses comptes : la ligne de suivi du compte B ne relie pas l'achat du compte A.
    const jumeau = achat(BON.transaction_id, TITRE, COMPTE_B);
    const autreCompte = { [String(BON.transaction_id)]: { uid: '222', suivi: N } };
    dit(relie(colis(N), [BON], autreCompte) === null, 'F4 un n° lu sur un AUTRE compte ne relie pas l’achat de ce compte');
    dit(relie(colis(N), [BON, jumeau], { [cle(jumeau)]: { uid: '222', suivi: N } }) === jumeau, 'F5 il relie l’achat du compte qui l’a lu');
    dit(relie(null, cinquante, index) === null && relie(colis(''), cinquante, index) === null, 'F6 pas de ligne, pas de n° ⇒ personne');
  });

  console.log('\n── G. Le branchement : plus aucun geste « Relier » sur un colis à retirer');
  await essai('G', async () => {
    let APP = '';
    try { APP = sansCommentaires(require(path.join(__dirname, '_source-app.cjs')).sourceApp(RC)); } catch (_) { APP = sansCommentaires(lire('src/App.jsx')); }
    const PASSE = sansCommentaires(lire('src/designV2/PassesRetrait.jsx')), CR = sansCommentaires(lire('src/CarteRelais.jsx'));
    dit(!!PASSE && !/data-v2-relier|v2\.passe\.relier|aides\.relier/.test(PASSE), 'G1 la passe (nouveau design) n’a plus de bouton « Relier l’achat »');
    dit(!!PASSE && /const contenu = x\.contenu \|\| null;/.test(PASSE) && /texteContenu\(contenu, tr\)/.test(PASSE) && /data-v2-contenu=\{contenu\.etat\}/.test(PASSE), 'G2 la passe dit le contenu par le sélecteur de la carte (`x.contenu` → `texteContenu`)');
    const blocPasse = (/\{contenuTxt \? <span[^>]*data-v2-contenu[\s\S]{0,200}?<\/span> : null\}/.exec(PASSE) || [''])[0];
    dit(!!blocPasse && !/<button|BoutonV2|onClick/.test(blocPasse), 'G3 sur la passe, le contenu est un texte : ni bouton ni toucher', blocPasse.slice(0, 120));
    dit(!!CR && !/relierDe\b|data-rp-relier-ouvrir|data-rp-relier=|achats\.relier\.pasRelie/.test(CR), 'G4 la colonne détaillée n’a plus « Achat pas encore relié · Relier »');
    const blocLigne = (/\{contenuTxt \? <div[^>]*data-rp-contenu[\s\S]{0,260}?<\/div> : null\}/.exec(CR) || [''])[0];
    dit(!!blocLigne && !/<button|onClick/.test(blocLigne) && /const contenu = x\.contenu \|\| null;/.test(CR), 'G5 dans le détail, le contenu (le même `x.contenu`) est un texte : ni bouton ni toucher', blocLigne.slice(0, 120));
    dit(/const commandeRetrait = \(t\) => achatDuRetrait\(t, \{ achats: buysBase, index: indexSuivisAchats,\s*jonction: t && pickupUnion\.cmdParColis \? \(pickupUnion\.cmdParColis\.get\(colisKey\(t\)\) \|\| null\) : null \}\);/.test(APP), 'G6 l’écran relie par LA règle exécutée ici (`commandeRetrait` = `achatDuRetrait`)');
    const iC = APP.indexOf('const contenuCarte = ('); const selecteur = iC >= 0 ? APP.slice(iC, APP.indexOf('\n    };', iC)) : '';
    dit(/return contenuDuColis\(\{ ligne: t, suivi: t \? suiviDeLigne\(t\) : '', achat: o, autreSite: autre, site, photo: o \? photoAchat\(o\) : null,/.test(selecteur), 'G7 le sélecteur d’une carte est LA règle exécutée ici (`contenuCarte` → `contenuDuColis`)');
    const poses = (APP.match(/contenu: contenuCarte\(/g) || []).length;
    dit(poses === 4 && /contenu: contenuCarte\(\{ t, o: cmdN, autre: aa, site: aa \? aa\.site : 'vinted' \}\)/.test(APP) && /const cmdN = commandeRetrait\(t\);/.test(APP), 'G7 chaque carte « à retirer » porte SON contenu (e-mails comptés par `commandeRetrait`, achats Vinted, à vérifier, à confirmer)', String(poses));
    dit(/const p = o \? montantCommandeLu\(o\) : null;/.test(selecteur) && /prix: p != null && p > 0 \? montant\(p\) : ''/.test(selecteur), 'G8 le prix payé est celui LU de la commande (`montantCommandeLu` : pas su ou autre devise ⇒ rien)');
    dit(/compteColis: t \? \(compteDuColisEmail\(t\) \|\| ''\) : ''/.test(selecteur), 'G9 le compte du geste est celui du colis, par identité (`compteDuColisEmail` : l’adresse de réception)');
    const aidesPasse = (/<PassesRetraitV2[\s\S]{0,900}?\}\}\/>/.exec(APP) || [''])[0];
    dit(!!aidesPasse && !/relier/.test(aidesPasse) && !/relierRetrait|relierDe\b/.test(APP), 'G10 plus de `relierRetrait`, de `relierDe` ni de `relier:` passé aux colis à retirer');
    const ouvertures = (APP.match(/setRelierColis\(\{/g) || []).length, parScan = (APP.match(/setRelierColis\(\{[^}]*depuis: 'scan' \}\)/g) || []).length;
    dit(ouvertures > 0 && ouvertures === parScan, 'G11 la feuille de choix ne s’ouvre plus que depuis le scanner (un colis qu’il tient en main)', `${parScan}/${ouvertures}`);
    for (const l of ['fr', 'en', 'es', 'it', 'de']) { const d2 = lire(`src/i18n/langues/${l}/designV2.js`) || ''; const a2 = lire(`src/i18n/langues/${l}/achats.js`) || ''; if (/"v2\.passe\.relier"/.test(d2) || /"achats\.relier\.pasRelie"/.test(a2)) { dit(false, 'G12 les phrases « Relier l’achat » / « Achat pas encore relié » sont retirées des 5 langues', l); return; } }
    dit(true, 'G12 les phrases « Relier l’achat » / « Achat pas encore relié » sont retirées des 5 langues');
  });

  console.log('\n── T. Les phrases, dans les 5 langues');
  await essai('T', async () => {
    const CLES = { 'achats.contenu.pasLu': [], 'achats.contenu.pasLuCompte': ['compte'], 'achats.contenu.paye': ['prix'], 'achats.contenu.payeCompte': ['prix', 'compte'] };
    for (const l of ['fr', 'en', 'es', 'it', 'de']) {
      const manque = Object.entries(CLES).filter(([k, vars]) => typeof dico[l][k] !== 'string' || !dico[l][k].trim() || vars.some((v) => !dico[l][k].includes(`{${v}}`)) || /\{(?!prix\}|compte\})/.test(dico[l][k])).map(([k]) => k);
      dit(!manque.length, `T1 ${l} : les 4 phrases, avec leurs variables`, manque.join(', '));
    }
    if (regle) {
      const c = { etat: 'pas-lu', raison: 'ouvrir-vinted', compte: 'compte_a' };
      const vus = ['fr', 'en', 'es', 'it', 'de'].map((l) => texteContenu(c, trDe(l)));
      dit(new Set(vus).size === 5 && vus.every((t) => /vinted\.fr/.test(t) && /compte_a/.test(t) && !/[⟦{]/.test(t)), 'T2 le geste nomme vinted.fr et le compte dans chaque langue', vus.join(' | '));
      const fr = dico.fr['achats.contenu.pasLuCompte'] || '', de = dico.de['achats.contenu.pasLuCompte'] || '';
      dit(de.length <= Math.ceil(fr.length * 1.6), 'T3 l’allemand reste court (≤ 160 % du français)', `${de.length}/${fr.length}`);
    }
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-colis-achat-auto : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit-colis-achat-auto : arrêt inattendu — ' + String(e && e.message).slice(0, 200)); process.exit(1); });
