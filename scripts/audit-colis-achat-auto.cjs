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
//      la proposition « même colis — Relier » (par ressemblance : même point, même transporteur) n'est plus montrée ;
//   M  l'e-mail Vinted « Commande mise à jour pour {titre} — ton achat t'attend » (casier, point relais) : jamais de
//      n° de suivi, mais la CONVERSATION de sa commande ⇒ rangé avec SON achat, plus « à vérifier · je n'ai pas
//      trouvé le n° de suivi » (mesuré : 78 e-mails sur 30 jours, tous « à vérifier », tous reliés par la
//      conversation) ; un e-mail de TRANSPORTEUR sans n° reste « à vérifier » ;
//   R  UN COLIS EN UNE RANGÉE (`rangeeRetrait`, le sélecteur que l'écran Achats en rangées lira) : achat relié ou
//      raison, point, transporteur, code en clair et son état, QR disponible ou non, date limite LUE ou ESTIMÉE —
//      jamais un code choisi entre deux, jamais une photo ni un transporteur devinés ;
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
  'bouton-sur-la-passe': ['src/designV2/PassesRetrait.jsx', "        <button type=\"button\" className=\"v2r-retire\"", "        <button type=\"button\" onClick={() => {}} data-v2-relier=\"\">Relier l’achat</button>\n        <button type=\"button\" className=\"v2r-retire\""],
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
  'proposition-revenue': ['src/CarteRelais.jsx', "  const mc = mc0 && mc0.sorte === 'contredit' ? mc0 : null;", "  const mc = mc0;"],
  'mail-conversation-ignoree': ['api/_lib/resume-email.js', "if (!r.s && !r.cv && ['available', 'delivered', 'retour'].includes(c.status)) r.av = 'sans-suivi';", "if (!r.s && ['available', 'delivered', 'retour'].includes(c.status)) r.av = 'sans-suivi';"],
  'mail-achat-a-verifier': ['src/journalEmail.js', "  return !!r.cv || SUJET_ACHAT_VINTED.test(String((e && e.subject) || ''));", "  return false;"],
  'mail-transporteur-range': ['src/journalEmail.js', "if (!r || r.t !== 'suivi' || r.s || r.tr !== 'autre' || r.st !== 'available' || r.sens === 'sortant') return false;", "if (!r || r.t !== 'suivi' || r.s || r.st !== 'available' || r.sens === 'sortant') return false;"],
  'mail-sujet-seul': ['src/journalEmail.js', "  return !!r.cv || SUJET_ACHAT_VINTED.test(String((e && e.subject) || ''));", "  return true;"],
  'limite-estimee-dite-lue': ['src/contenuColis.js', "  if (jourIso(vers)) return { jour: jourIso(vers), at: '', source: 'estimee' };", "  if (jourIso(vers)) return { jour: jourIso(vers), at: '', source: 'lue' };"],
  'limite-garde-avant-lue': ['src/contenuColis.js', "  if (limite || limiteAt) return { jour: jourIso(limite), at: limiteAt ? String(limiteAt) : '', source: 'lue' };\n", ""],
  'rangee-code-choisi': ['src/contenuColis.js', "  const code = desaccord ? '' : String(x.code || x.code2 || '');", "  const code = String(x.code || x.code2 || (desaccord ? x.codesDesaccord[0].code : '') || '');"],
  'rangee-photo-devinee': ['src/contenuColis.js', "    photo: relie ? (c.photo || null) : (c && c.etat === 'autre-site' ? (x.photo || null) : null),", "    photo: relie ? (c.photo || null) : (x.photo || null),"],
  'rangee-transporteur-devine': ['src/contenuColis.js', "  const tr = x.transp && !x.trInconnu ? x.transp : null;", "  const tr = x.transp || null;"],
  'app-carte-sans-limite': ['src/App.jsx', "limite: limiteCarte({ t }), qrDispo: qrCarte({ t }), src: { t } });", "src: { t } });"],
  'cle-allemande-absente': ['src/i18n/langues/de/achats.js', '  "achats.contenu.pasLuCompte":', '  "achats.contenu.pasLuCompteX":'],
  'cle-relier-revenue': ['src/i18n/langues/fr/designV2.js', '  "v2.passe.retire":', '  "v2.passe.relier": "Relier l’achat",\n  "v2.passe.retire":'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  // Le TÉMOIN : la même copie, sans mutation, doit être verte — sinon un rouge ne prouverait rien.
  { let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=temoin'], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 0 ? '✅' : '❌'} témoin (copie sans mutation) ⇒ ${code === 0 ? 'vert' : 'ROUGE (' + code + ') : la preuve ne vaut rien'}`); if (code !== 0) process.exit(1); }
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
  if (MUT !== 'temoin' && !MUTS[MUT]) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'colis-achat-auto-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  fs.cpSync(path.join(R, 'api'), path.join(d, 'api'), { recursive: true });
  fs.cpSync(path.join(R, 'scripts', '_source-app.cjs'), path.join(d, 'scripts', '_source-app.cjs'));
  RC = d;
  if (MUT !== 'temoin') {
    const [f, de, vers] = MUTS[MUT];
    const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
    fs.writeFileSync(p, s.replace(de, vers));
    console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
  }
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
    dit(!/data-rp-meme-relier|data-rp-pas-meme|achats\.memeColis\.propose|achats\.relier\.bouton/.test(CR) && /const mc = mc0 && mc0\.sorte === 'contredit' \? mc0 : null;/.test(CR) && !/propositionsMemeColis|relierMemeColis|memeColis\.propositions/.test(APP), 'G13 la proposition « C’est sans doute le même colis — Relier » (un Relier par ressemblance) n’est plus montrée ; « délier » un lien contredit reste');
  });

  console.log('\n── M. L’e-mail Vinted d’un achat arrivé : rangé avec son achat par la conversation, plus « à vérifier »');
  await essai('M', async () => {
    const RM = await importer('api/_lib/resume-email.js'), JE = await importer('src/journalEmail.js'), BE = await importer('src/boiteEmails.js');
    if (!RM || !JE || !BE) return;
    const CONV = '01a1aaaa-bbbb-7ccc-8ddd-000000000037', SUJET = 'Commande mise à jour pour Baskets blanches 42';
    // Ce que la route répond pour cet e-mail (api/email-inbound.js, branche 0a) : type suivi, transporteur « autre », arrivé, la conversation.
    const neuf = RM.resumeClassement(200, { ok: true, type: 'suivi', carrier: 'autre', status: 'available', arrivee: 'livre', conv: CONV, ligne: `email_track_autre_conv-${CONV}`, lieu: 'Casier Exemple, 1 rue Exemple, 35000 Rennes', code: '' }, { lieu: 'Casier Exemple, 1 rue Exemple, 35000 Rennes', article: 'Baskets blanches 42' });
    dit(neuf.t === 'suivi' && neuf.cv === CONV && !neuf.av && !neuf.s, 'M1 au classement : la conversation est gardée (`cv`), l’e-mail n’est plus « sans-suivi »', neuf);
    const sansLien = RM.resumeClassement(200, { ok: true, type: 'suivi', carrier: 'autre', status: 'available', conv: '' }, {});
    dit(sansLien.av === 'sans-suivi' && !sansLien.cv, 'M2 sans conversation lue (aucune identité) : toujours « à vérifier »', sansLien);
    const transporteur = RM.resumeClassement(200, { ok: true, type: 'suivi', carrier: 'mondialrelay', status: 'available' }, { code: '123456' });
    dit(transporteur.av === 'sans-suivi', 'M3 un e-mail de TRANSPORTEUR sans n° de suivi reste « à vérifier »', transporteur);
    const E = (resume, plus = {}) => ({ id: 'email_reception_' + 'a'.repeat(16), at: '2026-11-19T12:01:00.000Z', etat: resume.av ? 'a-verifier' : 'integre', type: 'suivi', subject: SUJET, from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, ...resume }, ...plus });
    const l1 = JE.lectureEmail(E(neuf));
    dit(l1.etat === 'range' && !l1.raison && !l1.geste && /achat/.test(l1.fait) && /conversation/.test(l1.fait) && l1.cible && l1.cible.k === 'conv' && l1.cible.v === CONV, 'M4 le journal dit « rangé avec ton achat, par la conversation de sa commande » — rien à vérifier', l1);
    // Les e-mails DÉJÀ classés (avant le 19 nov.) : « sans-suivi », sans `cv`, rangés « a-verifier » en base.
    const ancien = E({ t: 'suivi', tr: 'autre', st: 'available', lieu: 'Casier Exemple', av: 'sans-suivi' });
    const l2 = JE.lectureEmail(ancien), g2 = BE.ligneEmail(ancien, {}, Date.parse('2026-11-19T13:00:00Z'));
    dit(JE.arriveeAchatVinted(ancien) === true && l2.etat === 'range' && !l2.raison && !/aucun colis/.test(l2.fait), 'M5 un e-mail déjà classé « à vérifier » de cette famille se lit rangé (plus « je n’ai pas trouvé le n° de suivi »)', l2);
    dit(!!g2 && (!g2.geste || g2.geste.k !== 'verifier'), 'M6 sa ligne dans la boîte ne porte plus « à vérifier » (il garde « à retirer »)', g2 && g2.geste);
    const mr = { ...E({ t: 'suivi', tr: 'mondialrelay', st: 'available', av: 'sans-suivi' }), subject: 'Votre colis est disponible' };
    const l3 = JE.lectureEmail(mr), g3 = BE.ligneEmail(mr, {}, Date.parse('2026-11-19T13:00:00Z'));
    dit(JE.arriveeAchatVinted(mr) === false && l3.etat === 'verifier' && /n° de suivi/.test(l3.raison) && g3.geste && g3.geste.k === 'verifier', 'M7 un e-mail de transporteur sans n° : toujours « à vérifier », avec sa raison', { l3: l3.etat, g3: g3.geste });
    const mrSujet = { ...mr, subject: SUJET };
    dit(JE.arriveeAchatVinted(mrSujet) === false && JE.arriveeAchatVinted({ ...ancien, subject: 'Votre colis est disponible' }) === false, 'M8 ni le sujet seul, ni « autre » seul ne suffisent (sans conversation gardée : les deux)');
    dit(JE.arriveeAchatVinted(E({ t: 'suivi', tr: 'autre', st: 'available', s: '81000037' })) === false && JE.arriveeAchatVinted(E({ t: 'suivi', tr: 'autre', st: 'delivered', av: 'sans-suivi' })) === false && JE.arriveeAchatVinted(null) === false, 'M9 un e-mail avec son n° de suivi, un colis livré, rien : pas concernés');
    const route = sansCommentaires(lire('api/email-inbound.js'));
    dit(/type: 'suivi', carrier: 'autre', status: retire \? 'delivered' : 'available', arrivee: arr\.forme, conv: arr\.conv \|\| ''/.test(route), 'M10 la route répond bien la conversation de cet e-mail (ce que le résumé lit)');
  });

  console.log('\n── R. Un colis en une rangée : le sélecteur');
  await essai('R', async () => {
    const limiteDuColis = C && C.limiteDuColis, rangeeRetrait = C && C.rangeeRetrait;
    dit(typeof limiteDuColis === 'function' && typeof rangeeRetrait === 'function', 'R0 le sélecteur existe (`rangeeRetrait`, `limiteDuColis`)');
    if (typeof limiteDuColis !== 'function' || typeof rangeeRetrait !== 'function') return;
    const lue = limiteDuColis({ limite: '2026-11-24', vers: '2026-11-26', estimation: { jour: '2026-11-27', garde: 8 } });
    dit(lue.source === 'lue' && lue.jour === '2026-11-24', 'R1 une date limite LUE prime sur « vers le » et sur la garde du transporteur', lue);
    const heure = limiteDuColis({ limiteAt: '2026-11-24T19:00:00+01:00' });
    dit(heure.source === 'lue' && heure.at === '2026-11-24T19:00:00+01:00', 'R2 une heure limite lue (consigne) est une date LUE', heure);
    const vers = limiteDuColis({ vers: '2026-11-26T00:00:00Z', estimation: { jour: '2026-11-27', garde: 8 } }), garde = limiteDuColis({ estimation: { jour: '2026-11-27', garde: 8 } });
    dit(vers.source === 'estimee' && vers.jour === '2026-11-26' && garde.source === 'estimee' && garde.jour === '2026-11-27' && garde.garde === 8, 'R3 « vers le » du transporteur, puis sa garde : ESTIMÉE, jamais dite lue', { vers, garde });
    dit(limiteDuColis({}).source === 'inconnue' && limiteDuColis({}).jour === '' && limiteDuColis({ estimation: { jour: 'bientôt' } }).source === 'inconnue', 'R4 rien de lu ni d’estimable ⇒ « inconnue » (pas de date inventée)');
    const index = { [cle(BON)]: { uid: '111', suivi: N } };
    const o = relie(colis(N), cinquante, index);
    const carteRelie = { cle: 'r:e:' + N, contenu: contenuDuColis({ ligne: colis(N), suivi: N, achat: o, site: 'vinted', photo: PHOTO, prix: '24,00 €', compteAchat: 'compte_a' }), photo: PHOTO, lieuNom: 'Tabac Exemple', lieuAdresse: '12 rue Exemple, 35000 Rennes',
      transp: { cle: 'mondialrelay', nom: 'Mondial Relay' }, code: '123456', qrDispo: true, limite: lue, src: { t: colis(N) } };
    const r1 = rangeeRetrait(carteRelie);
    dit(Object.keys(r1).sort().join() === 'aVerifier,cle,code,codeEtat,contenu,limite,photo,point,qr,titre,titreDe,transporteur', 'R5 la rangée porte exactement : contenu, titre, photo, point, transporteur, code et son état, QR, date limite, à vérifier', Object.keys(r1).sort().join());
    dit(r1.contenu.etat === 'relie' && r1.titre === TITRE && r1.titreDe === 'achat' && r1.photo === PHOTO && r1.contenu.prix === '24,00 €' && r1.contenu.compte === 'compte_a' && r1.point.nom === 'Tabac Exemple' && r1.transporteur.cle === 'mondialrelay' && r1.code === '123456' && r1.codeEtat === 'lu' && r1.qr === true && r1.limite.source === 'lue' && r1.aVerifier === false, 'R6 un colis relié : l’achat (photo, titre, prix payé, compte), le point, le transporteur, le code en clair, le QR, la limite lue', r1);
    const pasLu = rangeeRetrait({ cle: 'r:e:81000099', contenu: contenuDuColis({ ligne: colis('81000099'), suivi: '81000099', achat: null, site: 'vinted', compteColis: 'compte_b' }), photo: PHOTO, lieuNom: '', transp: { cle: 'mondialrelay', nom: 'Mondial Relay' }, trInconnu: true, code: '', qrDispo: false, limite: garde, src: { t: colis('81000099') } });
    dit(pasLu.contenu.etat === 'pas-lu' && pasLu.contenu.raison === 'ouvrir-vinted' && pasLu.titre === '' && pasLu.titreDe === '' && pasLu.photo === null && pasLu.transporteur.cle === '' && pasLu.codeEtat === 'pas-lu' && pasLu.qr === false && pasLu.limite.source === 'estimee' && pasLu.point.nom === '', 'R7 un colis pas relié : la raison, AUCUN titre ni photo d’achat, transporteur pas su ⇒ vide, limite estimée dite estimée', pasLu);
    const des = rangeeRetrait({ cle: 'x', contenu: null, code: '111111', codesDesaccord: [{ source: 'email', code: '111111' }, { source: 'message', code: '222222' }], qrDispo: true, src: { t: colis(N) } });
    dit(des.code === '' && des.codeEtat === 'desaccord' && des.qr === true, 'R8 deux sources, deux codes : aucun n’est choisi (« desaccord »)', des);
    dit(rangeeRetrait({ cle: 'x', code: '', qrDispo: true }).codeEtat === 'qr-seul' && rangeeRetrait({ cle: 'x', code: '', qrDispo: false }).codeEtat === 'pas-lu', 'R9 un QR sans code ⇒ « qr-seul » ; ni l’un ni l’autre ⇒ « pas-lu »');
    const moitie = rangeeRetrait({ cle: 'y', contenu: null, aVerifier: true, horsCompte: true, src: { t: { artTitle: 'Sandales bleues', source: 'vinted-commande' } } });
    dit(moitie.titre === 'Sandales bleues' && moitie.titreDe === 'email' && moitie.photo === null && moitie.aVerifier === true && moitie.limite.source === 'inconnue', 'R10 le titre que l’e-mail de CE colis donne est dit « email », jamais « achat » ; un « à vérifier » le reste', moitie);
    dit(rangeeRetrait(null) === null, 'R11 pas de carte ⇒ null');
    let APP = ''; try { APP = sansCommentaires(require(path.join(__dirname, '_source-app.cjs')).sourceApp(RC)); } catch (_) { APP = sansCommentaires(lire('src/App.jsx')); }
    const PASSE = sansCommentaires(lire('src/designV2/PassesRetrait.jsx'));
    dit((APP.match(/limite: limiteCarte\(/g) || []).length === 4 && (APP.match(/qrDispo: qrCarte\(/g) || []).length === 4 && /return limiteDuColis\(\{ limite: t \? t\.limite : \(ev && ev\.limite\), limiteAt: t \? t\.limiteAt : \(ev && ev\.limiteAt\), vers: t \? t\.limiteVers : \(ev && ev\.limiteVers\), estimation: est \}\);/.test(APP), 'R12 chaque carte « à retirer » porte sa date limite (les sources de la barre de délai) et « un QR existe »');
    dit(/const rg = rangeeRetrait\(x\);/.test(PASSE) && /'data-v2-limite-source': rg\.limite\.source/.test(PASSE) && /'data-v2-qr-dispo': rg\.qr \? '1' : '0'/.test(PASSE), 'R13 l’écran d’aujourd’hui pose les faits du sélecteur sur chaque colis (les bancs les jugent)');
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
