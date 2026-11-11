// ════════════════════════════════════════════════════════════════════════════
// AUDIT « COMPTES VINTED PRO » (11 nov., lot vinted-pro). Données INVENTÉES.
//
//  S. Statut : Pro seulement si LU (profil, sinon mention Vinted dans un e-mail) ;
//     rien lu ⇒ « pas su », jamais « particulier » ; le profil lu fait foi.
//  F. Frais : la protection acheteurs n'est comptée que si Vinted l'AJOUTE au prix ;
//     la commission ne vient QUE du relevé (par n° de transaction) ; sans relevé
//     ⇒ null ; jamais un taux (aucun 5 %, 0,70 € ou autre dans un calcul).
//  P. Prix d'une vente Pro : deux prix Vinted différents sans relevé ⇒ mis à part,
//     nommé ; relevé = article ⇒ prix de l'article ; compte pas Pro ⇒ rien ne change.
//  D. CA déclaré (le VRAI miroir serveur api/_lib/ventes-regle.js, recopié d'App.jsx) :
//     la vente Pro mise à part sort du total et est NOMMÉE ; une vente déjà
//     déclarée garde son mois ; un particulier inchangé.
//  B. Branchements : Comptes liés lit `statutProVinted` et les e-mails Pro ; la
//     facture lit `comptesProFacture` ; `fetchVintedOrders` pose `_prixPro`.
//
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');

async function controler(racine) {
  const res = [];
  const ok = (nom, cond, detail = '') => res.push({ nom, ok: !!cond, detail });
  const imp = (f) => import(pathToFileURL(path.join(racine, f)).href + `?t=${Date.now()}${Math.random()}`);
  let V, R;
  try { R = await imp('api/_lib/ventes-regle.js'); } catch (e) { ok('miroir ventes-regle', false, e.message); return res; }
  // D0 — la règle du CA sur des ventes Pro DÉJÀ marquées (forme fixe, sans le module) :
  // ce contrôle juge aussi l'arbre d'avant (où le module n'existe pas).
  {
    const of = (tx, prix, pp) => ({ transaction_id: tx, price: { amount: prix, currency_code: 'EUR' }, status: 'Commande finalisée', date: '2026-09-01T10:00:00Z', title: 'Paire inventée', _prixPro: pp });
    const fixe = [of('1', '40.00', { compter: true }), of('2', '29.73', { compter: false, raison: 'deux prix chez Vinted' }), of('5', '12.00', { compter: false, raison: 'prix de l’article pas lu (compte Pro)' })];
    const d0 = R.ventesDeclarables({ vinted: fixe, versements: { 1: '2026-09-10T10:00:00Z', 2: '2026-09-10T10:00:00Z', 5: '2026-09-10T10:00:00Z' }, declare: {} });
    const t0 = d0.lignes.reduce((x, l) => x + Math.round(l.eur * 100), 0);
    ok('D0 CA déclaré : une vente Pro au prix contredit sort du total, nommée', t0 === 4000 && d0.ecartees.filter((e) => e.manque).length === 2, `total ${t0}`);
  }
  try { V = await imp('src/vintedPro.js'); } catch (e) { ok('module src/vintedPro.js', false, e.message); return res; }

  // ── S ──
  const s = V.statutProVinted;
  ok('S1 profil true ⇒ pro (profil)', s({ profil: true }).etat === 'pro' && s({ profil: true }).source === 'profil');
  ok('S2 profil false ⇒ particulier, même avec un e-mail Pro', s({ profil: false, emailsPro: 3 }).etat === 'particulier');
  ok('S3 profil pas lu + e-mail Pro ⇒ pro (email)', s({ profil: null, emailsPro: 1 }).etat === 'pro' && s({ profil: null, emailsPro: 1 }).source === 'email');
  ok('S4 rien lu ⇒ pas su', s({ profil: null, emailsPro: null }).etat === 'passu' && s({ profil: null, emailsPro: 0 }).etat === 'passu');
  const m = V.comptesProFacture(new Map([['11', false], ['22', true]]), ['11', '33', 'x']);
  ok('S5 facture : e-mail Pro complète sans écraser un « false » lu', m.get('11') === false && m.get('33') === true && m.get('22') === true && !m.has('x'));

  // ── F ── (une vente inventée : article 40,00 €, protection 2,70 € ajoutée)
  const t = { tx: '900001', side: 'seller', prix: '40.0', devise: 'EUR', frais: '2.7', total: '42.7', statut: '450' };
  const a0 = V.argentVentePro(t, null);
  ok('F1 sans relevé : CA = prix article, protection lue, commission/reçu « — »', a0.caC === 4000 && a0.protectionC === 270 && a0.commissionC === null && a0.recuC === null && a0.raison === 'commission-pas-lue');
  const a1 = V.argentVentePro(t, { tx: '900001', montant: 38, devise: 'EUR' });
  ok('F2 relevé 38 € ⇒ commission 2,00 €, reçu 38,00 €, CA inchangé', a1.caC === 4000 && a1.recuC === 3800 && a1.commissionC === 200);
  const a2 = V.argentVentePro({ ...t, total: '40.0' }, null);
  ok('F3 protection pas ajoutée au prix ⇒ pas dite payée par l\'acheteur', a2.protectionC === null);
  ok('F4 achat (buyer) ⇒ pas une vente', V.argentVentePro({ ...t, side: 'buyer' }) === null);
  ok('F5 autre devise ⇒ écartée', V.argentVentePro({ ...t, devise: 'GBP' }).raison === 'devise');
  const rp = V.relevesParTx([{ tx: '1001', montant: 10 }, { tx: '1001', montant: 9 }, { tx: '1002', montant: 5 }, { tx: '', montant: 3 }]);
  ok('F6 relevé par n° seulement ; deux lignes au même n° ⇒ aucune choisie', !rp.has('1001') && rp.get('1002').montant === 5 && rp.size === 1);
  const rs = V.resumeArgentPro([t, { ...t, tx: '900002', prix: '10.0', frais: '1.2', total: '11.2' }, { ...t, tx: '900003', prix: 'x' }], [{ tx: '900001', montant: 38 }]);
  ok('F7 résumé : sommes et couvertures (sur N), écartée nommée', rs.n === 3 && rs.nCa === 2 && rs.caC === 5000 && rs.nCommission === 1 && rs.commissionC === 200 && rs.nRecu === 1 && rs.ecartees === 1 && rs.protectionC === 390);
  const code = fs.readFileSync(path.join(racine, 'src/vintedPro.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('F8 aucun taux dans un calcul (0.05, 0,70, 70 centimes)', !/\*\s*0?\.0[0-9]|\b0\.70?\b\s*[*+]|\+\s*70\b|5\s*\/\s*100/.test(code.replace(/constate:[^\n]*/g, '')));

  // ── P ──
  const o = (tx, prix) => ({ transaction_id: tx, price: { amount: prix, currency_code: 'EUR' }, status: 'Commande finalisée', date: '2026-09-01T10:00:00Z', title: 'Paire inventée' });
  const txns = new Map([['1', { tx: '1', side: 'seller', prix: '40.0', devise: 'EUR' }], ['2', { tx: '2', side: 'seller', prix: '29.0', devise: 'EUR' }], ['3', { tx: '3', side: 'seller', prix: '15.0', devise: 'EUR' }], ['4', { tx: '4', side: 'seller', prix: '50.0', devise: 'EUR' }]]);
  const releve = new Map([['3', { tx: '3', montant: 15 }], ['4', { tx: '4', montant: 50.48 }]]);
  const items = [o('1', '40.00'), o('2', '29.73'), o('3', '15.48'), o('4', '50.48'), o('5', '12.00')];
  const pr = V.appliquerPrixPro(items, { pro: true, txns, releve });
  ok('P1 prix égaux ⇒ compté', pr[0]._prixPro.compter === true && pr[0].price.amount === '40.00');
  ok('P2 deux prix, pas de relevé ⇒ mis à part et nommé', pr[1]._prixPro.compter === false && /deux prix/.test(pr[1]._prixPro.raison) && /29,73/.test(pr[1]._prixPro.raison));
  ok('P3 relevé = article ⇒ prix de l\'article, liste gardée', pr[2]._prixPro.compter === true && pr[2].price.amount === '15.00' && pr[2]._prixListe.amount === '15.48');
  ok('P4 relevé = liste ⇒ compté tel quel', pr[3]._prixPro.compter === true && pr[3].price.amount === '50.48');
  ok('P5 transaction pas lue ⇒ mis à part', pr[4]._prixPro.compter === false && /pas lu/.test(pr[4]._prixPro.raison));
  ok('P6 compte particulier ou pas su ⇒ rien ne change', V.appliquerPrixPro(items, { pro: false, txns }) === items && V.appliquerPrixPro(items, { pro: null, txns }) === items);
  const pk = V.appliquerPrixPro(items, { pro: true, txns: null });
  ok('P7 transactions pas lues ⇒ chaque vente le dit (jamais un prix choisi)', pk.every((x) => x._prixPro && x._prixPro.compter === false));

  // ── D ── le vrai miroir serveur
  const vers = { 1: '2026-09-10T10:00:00Z', 2: '2026-09-10T10:00:00Z', 3: '2026-09-10T10:00:00Z', 4: '2026-09-10T10:00:00Z', 5: '2026-09-10T10:00:00Z' };
  const d = R.ventesDeclarables({ vinted: pr, versements: vers, declare: {} });
  const total = d.lignes.reduce((x, l) => x + Math.round(l.eur * 100), 0);
  ok('D1 CA déclaré = 40,00 + 15,00 + 50,48 (les deux mises à part sortent)', total === 10548, `total ${total}`);
  ok('D2 les ventes mises à part sont NOMMÉES (manque)', d.ecartees.filter((e) => e.manque && /^vinted:(2|5)$/.test(e.id)).length === 2);
  const dd = R.ventesDeclarables({ vinted: pr, versements: vers, declare: { '2026-09': { ids: ['vinted:2'] } } });
  ok('D3 une vente déjà déclarée garde son mois', dd.lignes.some((l) => l.id === 'vinted:2' && l.ym === '2026-09' && l.declaree));
  const dp = R.ventesDeclarables({ vinted: items, versements: vers, declare: {} });
  ok('D4 compte particulier : inchangé (5 ventes, prix de la liste)', dp.lignes.length === 5 && dp.ecartees.length === 0);

  // ── B ── branchements (code sans commentaires)
  const sans = (f) => fs.readFileSync(path.join(racine, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const reg = sans('src/ecrans/Reglages.jsx'), app = sans('src/App.jsx'), fp = sans('src/FacturePro.jsx');
  ok('B1 Comptes liés : statut par statutProVinted + e-mails Pro par compte', /statutProVinted\(\{\s*profil:/.test(reg) && /email_sale_\*&data->>pro=eq\.true&select=uid/.test(reg) && /<PhraseComptePro/.test(reg) && /<ArgentComptePro/.test(reg));
  ok('B2 facture : comptesProFacture', /comptesPro:\s*comptesProFacture\(/.test(fp));
  ok('B3 ventes : _prixPro posé au chargement des ventes', /type === 'sold' \? await appliquerPrixProCompte/.test(app));
  ok('B4 ventesDeclarables lit _prixPro (app)', /o\._prixPro && o\._prixPro\.compter === false && !\(idx && idx\.get\(id\)\)/.test(app));
  return res;
}

const MUTATIONS = [
  ['src/vintedPro.js', "return { etat: 'passu', source: '', raison: emailsPro == null ? 'rien-lu' : 'profil-pas-lu' };", "return { etat: 'particulier', source: '', raison: '' };", 'pas su ⇒ particulier'],
  ['src/vintedPro.js', "if (profil === false) return { etat: 'particulier', source: 'profil', raison: '' };\n  if (Number.isFinite(emailsPro) && emailsPro > 0)", "if (Number.isFinite(emailsPro) && emailsPro > 0) return { etat: 'pro', source: 'email', raison: '' };\n  if (profil === false) return { etat: 'particulier', source: 'profil', raison: '' };\n  if (Number.isFinite(emailsPro) && emailsPro > 0)", 'e-mail l\'emporte sur le profil'],
  ['src/vintedPro.js', "if (/^\\d{1,20}$/.test(k) && typeof out.get(k) !== 'boolean') out.set(k, true);", "if (/^\\d{1,20}$/.test(k)) out.set(k, true);", 'e-mail écrase un false lu'],
  ['src/vintedPro.js', "if (recu == null || recu <= 0) return { caC, protectionC, recuC: null, commissionC: null, raison: 'commission-pas-lue' };", "if (recu == null || recu <= 0) return { caC, protectionC, recuC: caC - Math.round(caC * 5 / 100), commissionC: Math.round(caC * 5 / 100), raison: '' };", 'taux inventé de 5 %'],
  ['src/vintedPro.js', "const protectionC = f != null && tot != null && tot === caC + f ? f : null;", "const protectionC = f;", 'protection sans preuve'],
  ['src/vintedPro.js', "  for (const d of doubles) m.delete(d);\n", "", 'deux lignes au même n° : une choisie'],
  ['src/vintedPro.js', "if (art === liste) return { compter: true };", "if (art !== null) return { compter: true };", 'deux prix comptés quand même'],
  ['src/vintedPro.js', "if (cr != null && cr === art) return { compter: true, tranche: 'releve', prixArticle: art };", "", 'relevé = article ignoré'],
  ['src/vintedPro.js', "if (pro !== true || !Array.isArray(items)) return items;", "if (!Array.isArray(items)) return items;", 'particulier touché'],
  ['api/_lib/ventes-regle.js', "if (o._prixPro && o._prixPro.compter === false && !(idx && idx.get(id)))", "if (false)", 'CA ignore _prixPro'],
  ['api/_lib/ventes-regle.js', "if (o._prixPro && o._prixPro.compter === false && !(idx && idx.get(id)))", "if (o._prixPro && o._prixPro.compter === false)", 'vente déclarée retirée'],
  ['src/ecrans/Reglages.jsx', "<PhraseComptePro statut={statutPro}/>", "", 'phrase absente'],
  ['src/App.jsx', "type === 'sold' ? await appliquerPrixProCompte(account.vinted_user_id, h.my_orders) : h.my_orders", "h.my_orders", 'ventes sans _prixPro'],
];

function copierArbre(dst) {
  for (const f of ['src/vintedPro.js', 'api/_lib/ventes-regle.js', 'api/_lib/vestiaire-regle.js', 'api/_lib/plan-regle.js', 'src/ecrans/Reglages.jsx', 'src/App.jsx', 'src/FacturePro.jsx', 'package.json']) {
    const de = path.join(RACINE, f); if (!fs.existsSync(de)) continue;
    fs.mkdirSync(path.dirname(path.join(dst, f)), { recursive: true }); fs.copyFileSync(de, path.join(dst, f));
  }
  // les imports de plan-regle / vestiaire-regle
  for (const f of fs.readdirSync(path.join(RACINE, 'api/_lib'))) if (f.endsWith('.js') && !fs.existsSync(path.join(dst, 'api/_lib', f))) fs.copyFileSync(path.join(RACINE, 'api/_lib', f), path.join(dst, 'api/_lib', f));
}

(async () => {
  const racine = process.env.VPRO_RACINE || RACINE;
  const res = await controler(racine);
  for (const r of res) console.log(`${r.ok ? '✅' : '❌'} ${r.nom}${r.detail ? ' — ' + r.detail : ''}`);
  const rouges = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - rouges} vert(s), ${rouges} rouge(s)`);
  if (process.argv.includes('--prouve')) {
    let tuees = 0;
    for (const [f, avant, apres, nom] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vpro-'));
      copierArbre(tmp);
      const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8');
      if (!s.includes(avant)) { console.log(`⚠️ mutation « ${nom} » : texte introuvable`); continue; }
      fs.writeFileSync(p, s.replace(avant, apres));
      const r = await controler(tmp);
      const rouge = r.some((x) => !x.ok);
      if (rouge) tuees += 1;
      console.log(`${rouge ? '✅ rouge' : '❌ RESTE VERT'} — mutation : ${nom}`);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`\nmutations : ${tuees}/${MUTATIONS.length} rouges`);
    if (tuees !== MUTATIONS.length) process.exitCode = 1;
  }
  if (rouges) process.exitCode = 1;
})();
