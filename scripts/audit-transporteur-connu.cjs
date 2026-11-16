// ════════════════════════════════════════════════════════════════════════════
//  « À EXPÉDIER » : LE TRANSPORTEUR EST CONNU DÈS QU'UNE SOURCE EXISTE (15 nov.)
//  Julien (capture iPhone, Ventes → À expédier : « Tous 3 · Colissimo 1 · Transporteur
//  inconnu 2 ») : « Le transporteur inconnu n'est pas possible. »
//  Mesuré (lecture seule, sans donnée personnelle) : la vente dont l'étiquette avait été
//  CAPTÉE par l'extension et LUE (transporteur + n° rangés par n° de transaction dans
//  `vrm_bord_transporteurs.pdf`) restait « inconnu » dans les tuiles, qui ne lisaient que le
//  bordereau e-mail ; la carte, elle, passait le n° et le disait. Vinted ne range le
//  transporteur nulle part avant l'étiquette (détail de transaction : `shipment` = id + statut).
//
//  Ce banc EXÉCUTE la règle (src/colisEnvoyes.js) sur la vraie FORME, valeurs inventées :
//   A  vente SANS bordereau e-mail, étiquette captée et LUE (`pdf[tx] = { t, s }`) ⇒ son
//      transporteur, par SON n° de transaction (la ligne `{ o, b: null, txn }`) ;
//   B  bordereau e-mail : le transporteur lu sur son PDF (`transporteurPdf`) ⇒ lui ;
//   C  bordereau imprimé avec un n° de suivi à la forme propre (8 chiffres, XW…TS) ⇒ le
//      transporteur du n° ;
//   D  rien (ni bordereau, ni étiquette captée, ni lecture) ⇒ « pas encore lu » + le compte à
//      ouvrir, jamais « inconnu » ; étiquette captée pas encore relue ⇒ « en cours de lecture » ;
//      étiquette lue qui ne nomme personne ⇒ sa raison ; autre site ⇒ « le site ne l'a pas dit » ;
//   T  les tuiles ne regroupent QUE des transporteurs connus ; le reste est rendu, rien caché ;
//   S  l'app passe le n° de transaction PARTOUT où elle lit le transporteur d'une vente ;
//   M  mutations : chaque affaiblissement de la règle fait virer ce banc au rouge.
//  Lancer : node scripts/audit-transporteur-connu.cjs   (AUDIT_RACINE=<arbre> pour un autre arbre)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const R = process.env.AUDIT_RACINE ? path.resolve(process.env.AUDIT_RACINE) : path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };

// Le module, éventuellement MUTÉ : une copie dans un dossier temporaire, ses imports relatifs
// réécrits vers les fichiers de l'arbre (rien n'est écrit dans le dépôt).
let tmp = null;
async function charger(mutation) {
  const src = path.join(R, 'src', 'colisEnvoyes.js');
  if (!mutation) return import('file://' + src);
  let texte = fs.readFileSync(src, 'utf8');
  const avant = texte;
  texte = mutation(texte);
  if (texte === avant) throw new Error('mutation sans effet');
  texte = texte.replace(/from '(\.\.?\/[^']+)'/g, (m, rel) => `from '${'file://' + path.join(path.dirname(src), rel)}'`);
  if (!tmp) tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-transp-connu-'));
  const f = path.join(tmp, `m${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, texte);
  return import('file://' + f);
}

// La vraie FORME : une ligne de « À expédier » (`colisAEnvoyerBase` → `expeditions`) est
// `{ key: 'v'+tx, o: <commande my_orders>, b: <bordereau e-mail projeté | null>, txn: '<tx>' }` ;
// un bordereau e-mail est la projection de `fetchEmailBordereaux` (scalaires `meta->>…`) ;
// `pdfParTx` est `vrm_bord_transporteurs.pdf` ; `vus` est `vrm_bord_transporteurs.pdfVus`.
const commande = (tx) => ({ transaction_id: tx, title: 'Paire inventée', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', _acc: { vinted_user_id: '222', login: 'compte_b' } });
const bordEmail = (tx, o = {}) => ({ _row: 'email_bord_' + tx, transaction: String(tx), uid: '111', filename: `bordereau-${tx}.pdf`, hasPdf: true, suivi: '', transporteur: null, transporteurPdf: null, suiviPdf: null, pdfLu: null, ...o });
const FIX = {
  A: { key: 'v7001', o: commande(7001), b: null, txn: '7001' },                                                    // étiquette captée, lue
  B: { key: 'v7002', o: commande(7002), b: bordEmail(7002, { transporteurPdf: 'colissimo', suiviPdf: '6A12345678901', pdfLu: 'ok' }), txn: '7002' },
  C1: { key: 'v7003', o: commande(7003), b: bordEmail(7003, { suivi: '41234567' }), txn: '7003' },               // 8 chiffres ⇒ Mondial Relay
  C2: { key: 'v7004', o: commande(7004), b: bordEmail(7004, { suivi: 'XW123456789TS' }), txn: '7004' },          // XW…TS ⇒ Chronopost
  D: { key: 'v7005', o: commande(7005), b: null, txn: '7005' },                                                    // rien du tout
  E: { key: 'v7006', o: commande(7006), b: null, txn: '7006' },                                                    // étiquette captée, pas relue
  F: { key: 'v7007', o: commande(7007), b: null, txn: '7007' },                                                    // étiquette lue, aucun nom
  G: { __autre: 'eb', key: 'e:x:1', tr: { cle: null, nom: '', source: null }, trNom: 'Transporteur inconnu' },     // eBay : rien dit
};
const PDF_PAR_TX = { 7001: { t: 'chronopost', s: 'XW987654321TS' } };
const VUS = { 7007: { r: 'aucun', v: 2 } };
const CAPTES = { 7001: { uid: '222' }, 7006: { uid: '222' } };

async function juger(m, etiquette = '') {
  const res = { rouges: [] };
  const note = (c, q, d) => { if (!c) res.rouges.push(q + (d ? ' — ' + d : '')); if (!etiquette) dit(c, q, d); };
  const need = ['transporteurParTx', 'transporteurDeLigne', 'pourquoiSansTransporteur', 'tuilesTransporteursConnus', 'resumePasLus', 'txDeLigne'];
  const manque = need.filter((k) => typeof m[k] !== 'function');
  note(!manque.length, 'R. la règle existe dans src/colisEnvoyes.js (une, partagée)', manque.length ? 'absentes : ' + manque.join(', ') : '');
  if (manque.length) return res;
  const deVente = (b, tx) => m.transporteurParTx(b, tx, { pdfParTx: PDF_PAR_TX });
  const tr = (x) => m.transporteurDeLigne(x, deVente);
  const nom = (t) => m.nomEnvoye(t);
  // A
  const tA = tr(FIX.A);
  note(tA && tA.cle === 'chronopost' && tA.source === 'pdf', 'A. vente sans bordereau e-mail, étiquette captée et lue ⇒ Chronopost, source « pdf », par SON n°', JSON.stringify(tA));
  // B, C
  const tB = tr(FIX.B);
  note(tB && tB.cle === 'colissimo', 'B. bordereau e-mail, transporteur lu sur son PDF ⇒ Colissimo', JSON.stringify(tB));
  const tC1 = tr(FIX.C1), tC2 = tr(FIX.C2);
  note(tC1 && tC1.cle === 'mondialrelay' && tC1.source === 'forme', 'C. bordereau imprimé, n° à 8 chiffres ⇒ Mondial Relay (forme du n°)', JSON.stringify(tC1));
  note(tC2 && tC2.cle === 'chronopost', 'C. bordereau imprimé, n° XW…TS ⇒ Chronopost', JSON.stringify(tC2));
  // Le bordereau e-mail d'UNE AUTRE vente ne nomme jamais celle-ci (identité : le n° de la ligne).
  const tAutre = m.transporteurParTx(null, '7005', { pdfParTx: PDF_PAR_TX });
  note(!tAutre.cle && !tAutre.nom, 'A. identité : l\'étiquette lue de la vente 7001 ne nomme pas la vente 7005', JSON.stringify(tAutre));
  // D : raisons, jamais « inconnu »
  const et = PDF_PAR_TX;
  const raison = (x) => { const tx = m.txDeLigne(x); return m.pourquoiSansTransporteur({ site: x.__autre ? { eb: 'ebay', vc: 'vestiaire', lbc: 'leboncoin' }[x.__autre] : 'vinted', bord: x.b || null, pdf: et[tx] || null, vu: VUS[tx] || null, capte: CAPTES[tx] || null, compte: x.o && x.o._acc ? x.o._acc.login : '' }); };
  const rD = raison(FIX.D), rE = raison(FIX.E), rF = raison(FIX.F), rG = raison(FIX.G);
  note(rD.cle === 'pas-encore-lu' && rD.compte === 'compte_b', 'D. rien du tout ⇒ « pas encore lu » et le compte à ouvrir sur vinted.fr', JSON.stringify(rD));
  note(rE.cle === 'a-lire', 'D. étiquette captée, pas encore relue ⇒ « en cours de lecture » (VRM la lit, aucun geste)', JSON.stringify(rE));
  note(rF.cle === 'muette', 'D. étiquette lue qui ne nomme personne ⇒ « sans nom lisible »', JSON.stringify(rF));
  note(rG.cle === 'site', 'D. eBay sans transporteur dit ⇒ « le site ne l\'a pas dit »', JSON.stringify(rG));
  const toutes = [rD, rE, rF, rG].map((r) => r.cle);
  note(toutes.every((k) => m.RAISONS_PAS_LU.includes(k)) && !toutes.some((k) => /inconnu/i.test(k)), 'D. aucune raison ne s\'appelle « inconnu »', toutes.join(','));
  // T : tuiles connues seulement, rien caché
  const liste = Object.values(FIX);
  const { tuiles, reste } = m.tuilesTransporteursConnus(liste, tr);
  const noms = tuiles.map((p) => `${p.nom}:${p.n}`).sort().join('|');
  note(noms === 'Chronopost:2|Colissimo:1|Mondial Relay:1', 'T. tuiles « Chronopost 2 · Colissimo 1 · Mondial Relay 1 »', noms);
  note(!tuiles.some((p) => p.nom === m.INCONNU || !p.nom), 'T. aucune tuile « Transporteur inconnu »', JSON.stringify(tuiles));
  note(reste.length === 4 && tuiles.reduce((a, p) => a + p.n, 0) + reste.length === liste.length, 'T. le reste (4) est rendu : tuiles + reste = toute la liste (rien caché)', `${reste.length} / ${liste.length}`);
  const resume = m.resumePasLus(reste.map(raison));
  const rs = resume.map((r) => `${r.cle}:${r.n}:${r.comptes.join(',')}`).join('|');
  note(rs === 'pas-encore-lu:1:compte_b|a-lire:1:compte_b|muette:1:compte_b|site:1:', 'T. la ligne discrète, par raison : pas encore lu (compte_b) · en cours de lecture · sans nom lisible · site', rs);
  // Avec les seuls transporteurs connus, aucune ligne.
  const seulsConnus = [FIX.A, FIX.B];
  const tc = m.tuilesTransporteursConnus(seulsConnus, tr);
  note(tc.reste.length === 0 && tc.tuiles.length === 2, 'T. tout connu ⇒ deux tuiles, aucun reste', JSON.stringify(tc.tuiles));
  // Les nombres pour la publication : `nomEnvoye` d'une ligne connue n'est jamais l'inconnu.
  note(nom(tA) === 'Chronopost', 'A. son nom rendu : « Chronopost »', nom(tA));
  return res;
}

(async () => {
  console.log('\n── Règle (arbre : ' + path.relative(process.cwd(), R || '.') + ') ──');
  let m = null;
  try { m = await charger(null); } catch (e) { dit(false, 'R. src/colisEnvoyes.js se charge', String(e && e.message || e)); }
  if (m) await juger(m);

  // ── S : l'app lit le transporteur d'une vente par SON n°, partout ─────────────────────────
  console.log('\n── App : chaque lecture du transporteur d\'une vente passe le n° de transaction ──');
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const appels = [...app.matchAll(/transporteurVente\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((x) => x[1]);
  const seuls = appels.filter((a) => a.split(',').filter((s) => s.trim()).length < 2 && !/^\s*b\s*,\s*tx\s*$/.test(a));
  dit(appels.length > 0 && seuls.length === 0, `S. ${appels.length} lectures de \`transporteurVente\` : toutes passent le n° (aucune par le seul bordereau)`, seuls.slice(0, 5).join(' | '));
  dit(/tuilesTransporteursConnus\(/.test(app), 'S. les tuiles de « À expédier » passent par `tuilesTransporteursConnus` (connus seulement)');
  dit(!/transporteurVente\(x\.b\)/.test(app) && !/transporteurVente\(g\.colis\[0\]\.x\.b\)/.test(app), 'S. plus aucune lecture `transporteurVente(x.b)` (le bordereau e-mail seul)');

  // ── M : mutations (chacune doit faire virer au rouge) ─────────────────────────────────────
  if (m) {
    console.log('\n── Mutations ──');
    const MUT = [
      ['txDeLigne rend vide (la ligne lue par son seul bordereau, l\'ancien `transporteurVente(x.b)`)', (s) => s.replace("if (!x || x.__autre) return '';", "if (!x || x.__autre || true) return '';")],
      ['transporteurParTx ignore le n° de la ligne', (s) => s.replace("const k = String((b && b.transaction) || tx || '');", "const k = String((b && b.transaction) || '');")],
      ['les tuiles gardent l\'inconnu', (s) => s.replace('filtresTransporteurs(L, tr).filter((p) => p.nom !== INCONNU)', 'filtresTransporteurs(L, tr)')],
      ['une étiquette captée non relue passe pour « pas encore lu »', (s) => s.replace("return capte ? { cle: 'a-lire', compte: c } : { cle: 'pas-encore-lu', compte: c };", "return { cle: 'pas-encore-lu', compte: c };")],
      ['le compte à ouvrir est perdu', (s) => s.replace("p.n++; if (r.compte) p.comptes.add(r.compte);", 'p.n++;')],
      ['« rien » devient « inconnu »', (s) => s.replace("{ cle: 'pas-encore-lu', compte: c }", "{ cle: 'inconnu', compte: c }")],
      ['le reste est caché', (s) => s.replace('reste: L.filter((x) => !estConnu(tr(x)))', 'reste: []')],
    ];
    for (const [nomM, f] of MUT) {
      let r = null;
      try { r = await juger(await charger(f), nomM); } catch (e) { r = { rouges: ['n\'a pas pu être jouée : ' + String(e && e.message || e)] }; }
      dit(r.rouges.length > 0, `M. mutation « ${nomM} » ⇒ rouge`, r.rouges.length ? r.rouges[0].slice(0, 110) : 'AUCUN rouge : la règle n\'est pas tenue');
    }
  }
  if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} audit-transporteur-connu : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
