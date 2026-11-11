// ════════════════════════════════════════════════════════════════════════════
//  ROBUSTESSE MÉTIER (11 nov., revue `docs/passation/robustesse/metier.md`) — EXÉCUTÉ
//
//  Les règles PURES tournent pour de vrai (import des modules de src/) ; ce qui vit
//  dans un écran est jugé sur le texte du code (commentaires retirés). On exige :
//    A  Inventaire « Synchroniser les ventes » : 50 paires au MÊME titre ⇒ aucune
//       n'est touchée sans identité (une PROPOSITION, reliée par son clic) ;
//       identité (n° de transaction posé, transaction → annonce) ⇒ la bonne paire
//       seulement ; commande annulée d'une autre paire ⇒ rien ; vente annulée ⇒
//       la paire revient « en stock » (jamais « en ligne », jamais « vendue ») ;
//       la plus fraîche décide ; l'écran n'a plus de `byTitle`.
//    B  `emailSoldIds` : un e-mail sans identité ne retire rien d'« En ligne » ;
//       transaction → annonce retire CETTE annonce ; bordereau par `cleNum`.
//    C  Achat hors plateforme : tout N° posé est réservé (pas seulement le proposé).
//    D  Ma journée « Stock » : « 25,50 » est un prix lu (centimes exacts).
//    E  Factures manuelles : supprimer la dernière ne rend jamais son numéro.
//    F  Ventes saisies : achat inconnu ⇒ « pas su » (null), jamais 0 ; bénéfice
//       sommé sur les ventes au coût connu, avec la couverture.
//    G  Carte URSSAF : `nonComptees` arrive jusqu'à l'écran (« ce total est un minimum »).
//    H  Accepter une offre À LA MAIN : vendue ailleurs ⇒ rien ne part ; pas su ⇒ dit.
//    I  Baisse en euros : 1,10 · 0,29 · 4,35 · 9,95 acceptées ; 1,105 refusée.
//    J  Plus de « Prix conseillé » à la mise en ligne (refusé le 11 oct.) ; le conseil
//       d'une paire qui dort ne descend jamais sous le prix d'achat.
//    K  Aucun bénéfice / marge négatif en rouge (§7 : rouge = deux paires sous un N°).
//    L  N° comparés par `cleNum` (bordereau, inventaire).
//    M  « pas su » ≠ 0 : Argent eBay « — » ; montant déclaré lu par `lireMontantSaisi`.
//  `--prouve` : chaque mutation (réaffaiblir la règle) doit faire rougir un contrôle.
//  Sur origin/main (git archive), A, B, D, E, F, G, H, I, J, K sont rouges.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
let rouges = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { rouges++; console.log('❌ ' + m + (d ? ' — ' + String(d).slice(0, 300) : '')); };
const dit = (c, m, d) => (c ? ok(m) : nok(m, d));
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const charge = async (f) => { try { return await import(pathToFileURL(path.join(R, f)).href); } catch (e) { nok(`${f} se charge`, e.message); return null; } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { nok(nom + ' (a levé)', e.message); } };

const MUTATIONS = {
  'synchro par titre': [['src/inventaireSynchro.js', 'const p = paireDe(o);', 'const p = paireDe(o) || inv.find((x) => x && normTitre(x.title) === normTitre(o.title));']],
  'annulée ⇒ en ligne': [['src/inventaireSynchro.js', "{ status: 'stock', soldAt: null }", "{ status: 'online', soldAt: null }"]],
  'e-mail par titre': [['src/venduesParEmail.js', "const item = itemDeTx && itemDeTx[tx] != null ? String(itemDeTx[tx]) : '';", "const item = String((enLigne.find((it) => it && String(it.title || '').toLowerCase() === String(s.designation || '').toLowerCase()) || {}).id || '');"]],
  'N° proposé seul réservé': [['src/ecrans/Achats.jsx', 'if (rec.numero && onReserverNumero) onReserverNumero(rec.numero);', 'if (rec.numero && prochainNumero != null && rec.numero === String(prochainNumero) && onReserverNumero) onReserverNumero(rec.numero);']],
  'prix à virgule NaN': [['src/stockJournee.js', "centimes(String(brut).replace(/[\\s\\u00a0€]/g,''))", 'Number(brut)*100']],
  'numéro de facture rendu': [['src/factureNumero.js', 'return n > Number(base[k] || 0) ? { ...base, [k]: n } : base;', 'return base;']],
  'achat inconnu = 0': [['src/venteManuelle.js', '    if (trouves.some((x) => !x)) return null;                       // un N° du lot introuvable\n', '']],
  'nonComptees perdu': [['src/ecrans/Compta.jsx', ', nonComptees: v.nonComptees || null } : null;', ' } : null;']],
  'offre vendue ailleurs acceptée': [['src/offresGarde.js', "if (r === 'vendue-ailleurs') return { bloque: true,", "if (r === 'vendue-ailleurs') return { bloque: false,"]],
  'baisse flottante': [['src/baissePrix.js', "!/^\\d+(?:[.,]\\d{1,2})?$/.test(brut.replace(/\\s/g, ''))", 'Math.round(v * 100) !== v * 100']],
  'bénéfice rouge': [['src/ecrans/Compta.jsx', "style={{padding:'2px 10px',color:b==null?C.muted:C.text,", "style={{padding:'2px 10px',color:b==null?C.muted:(b>=0?C.text:C.danger),"]],
  'eBay pas su = 0': [['src/ecrans/Ebay.jsx', "const eur = (n) => n == null || !Number.isFinite(Number(n)) ? '—' : (Math.round", "const eur = (n) => (Math.round"]],
  'bordereau sans cleNum': [['src/App.jsx', 'bb.numero && cleNum(bb.numero) === cleNum(numero)', 'bb.numero && String(bb.numero) === String(numero)']],
};

(async () => {
  if (process.argv.includes('--prouve')) return prouver(__filename, R, MUTATIONS);
  const APP = sansCommentaires(lire('src/App.jsx'));
  const STOCK = sansCommentaires(lire('src/ecrans/Stock.jsx'));
  const COMPTA = sansCommentaires(lire('src/ecrans/Compta.jsx'));
  const ACHATS = sansCommentaires(lire('src/ecrans/Achats.jsx'));

  // ── A. Inventaire ─────────────────────────────────────────────────────────
  await essaie('A synchro inventaire', async () => {
    const M = await charge('src/inventaireSynchro.js'); if (!M) return;
    const classer = (s) => /finalis/i.test(s) ? 'completed' : /annul/i.test(s) ? 'cancelled' : 'en_cours';
    const inv = [];
    for (let i = 1; i <= 50; i++) inv.push({ id: 'p' + i, numero: String(i), title: 'Nike Air Max 90 blanche taille 42', status: 'online', vintedItemId: String(9000 + i), transactionId: null });
    // Sans identité : la commande au même titre ne touche RIEN.
    const r1 = M.planSynchroInventaire({ inventaire: inv, commandes: [{ transaction_id: 77001, title: 'Nike Air Max 90 blanche taille 42', status: 'Commande finalisée', date: '2026-11-01T10:00:00Z' }], itemDeTx: {}, classer });
    dit(r1.maj.size === 0, 'A1 50 paires au même titre, commande sans identité ⇒ aucune paire touchée', [...r1.maj.keys()].join(','));
    dit(r1.propositions.length === 1 && r1.propositions[0].paires.length === 50, 'A2 … c\'est une PROPOSITION (50 candidates), reliée par son clic', JSON.stringify(r1.propositions.map((p) => p.paires.length)));
    const patch = M.relierProposition(r1.propositions[0], inv[16]);
    dit(patch && patch.transactionId === '77001' && patch.status === 'sold', 'A3 son clic relie CETTE paire (transaction posée)', JSON.stringify(patch));
    // Identité : transaction → annonce (Vinted).
    const r2 = M.planSynchroInventaire({ inventaire: inv, commandes: [{ transaction_id: 77002, title: 'Nike Air Max 90 blanche taille 42', status: 'Commande finalisée', date: '2026-11-01T10:00:00Z' }], itemDeTx: { 77002: '9033' }, classer });
    dit(r2.maj.size === 1 && r2.maj.has('p33') && r2.maj.get('p33').status === 'sold', 'A4 transaction → annonce ⇒ la paire N°33 seule est vendue', [...r2.maj.keys()].join(','));
    // Annulée d'une AUTRE paire : rien ne revient en ligne.
    const inv2 = inv.map((p) => p.id === 'p5' ? { ...p, status: 'pending_sale', transactionId: '55005' } : p);
    const r3 = M.planSynchroInventaire({ inventaire: inv2, commandes: [{ transaction_id: 66006, title: 'Nike Air Max 90 blanche taille 42', status: 'Annulée', date: '2026-11-02T10:00:00Z' }], itemDeTx: {}, classer });
    dit(r3.maj.size === 0, 'A5 une commande annulée au même titre ne remet RIEN en ligne', JSON.stringify([...r3.maj]));
    // Vente annulée de CETTE paire : retour « en stock », pas « vendue », pas « en ligne ».
    const inv3 = inv.map((p) => p.id === 'p7' ? { ...p, status: 'sold', transactionId: '55007', soldAt: '01/11/2026' } : p);
    const r4 = M.planSynchroInventaire({ inventaire: inv3, commandes: [
      { transaction_id: 55007, title: 'x', status: 'Commande finalisée', date: '2026-11-01T10:00:00Z' },
      { transaction_id: 55007, title: 'x', status: 'Annulée', date: '2026-11-03T10:00:00Z' },
    ], itemDeTx: {}, classer });
    const p7 = r4.maj.get('p7');
    dit(p7 && p7.status === 'stock', 'A6 vente annulée (la plus fraîche) ⇒ la paire revient en stock, jamais « vendue » ni « en ligne »', JSON.stringify(p7));
    dit(!/byTitle/.test(STOCK) && /planSynchroInventaire\(/.test(STOCK), 'A7 l\'écran Inventaire passe par la règle d\'identité (plus de `byTitle`)');
  });

  // ── B. E-mails de vente ───────────────────────────────────────────────────
  await essaie('B e-mails', async () => {
    const M = await charge('src/venduesParEmail.js'); if (!M) return;
    const enLigne = [{ id: '501', title: 'Adidas Samba noire taille 40' }, { id: '502', title: 'Adidas Samba noire taille 40' }];
    const numeros = { 501: { numero: '12' } };   // la 502 n'a pas de N°
    const r1 = M.venduesParEmail({ enLigne, ventesEmail: [{ designation: 'Adidas Samba noire taille 40', receivedAt: '2026-11-01T10:00:00Z' }], itemDeTx: {}, numeros });
    dit(r1.size === 0, 'B1 e-mail sans identité ⇒ aucune annonce retirée d\'En ligne', [...r1].join(','));
    const r2 = M.venduesParEmail({ enLigne, ventesEmail: [{ designation: 'Adidas Samba noire taille 40', transaction: '1234567', receivedAt: '2026-11-01T10:00:00Z' }], itemDeTx: { 1234567: '502' }, numeros });
    dit(r2.size === 1 && r2.has('502'), 'B2 transaction → annonce ⇒ CETTE annonce seulement', [...r2].join(','));
    dit(/venduesParEmail\(/.test(APP) && !/normTitle\(t\) \+ '\|' \+/.test(APP), 'B3 `emailSoldIds` passe par la règle d\'identité (plus de clé titre + taille)');
  });

  // ── C. N° d'un achat hors plateforme ──────────────────────────────────────
  {
    const i = ACHATS.indexOf('const enregistrer = async'), g = i < 0 ? '' : ACHATS.slice(i, ACHATS.indexOf('\n  };', i));
    dit(/if \(rec\.numero && onReserverNumero\) onReserverNumero\(rec\.numero\)/.test(g) && !/prochainNumero != null && rec\.numero ===/.test(g), 'C tout N° posé sur un achat hors plateforme est réservé dans le pool');
  }

  // ── D. Ma journée, Stock ──────────────────────────────────────────────────
  await essaie('D stock journée', async () => {
    const M = await charge('src/stockJournee.js'); if (!M) return;
    const r = M.resumerStockJournee([{ id: 1 }, { id: 2 }, { id: 3 }], { 1: { numero: '1', buyPrice: '25,50' }, 2: { numero: '2', buyPrice: '30,00' }, 3: { numero: '3', buyPrice: '' } });
    dit(r.renseignes === 2 && Math.abs(r.cout - 55.5) < 1e-9 && r.manquants === 1, 'D « 25,50 » et « 30,00 » sont des prix lus (55,50 €, 1 sans prix)', JSON.stringify(r));
  });

  // ── E. Numéros de facture ─────────────────────────────────────────────────
  await essaie('E factures', async () => {
    const M = await charge('src/factureNumero.js'); if (!M) return;
    const f1 = { number: '2026-000001' }, f2 = { number: '2026-000002' };
    let pris = M.noterNumeroPris(M.noterNumeroPris({}, f1.number, 'ent_1'), f2.number, 'ent_1');
    const apres = M.prochainNumeroFacture({ factures: [f1], pris, ent: 'ent_1', annee: 2026 });   // la 2 a été supprimée
    dit(apres === '2026-000003', 'E1 la dernière facture supprimée ⇒ son numéro reste pris (la suivante est la 3)', apres);
    pris = M.noterNumeroPris(pris, '2026-000001', 'ent_1');
    dit(pris['ent_1|2026'] === 2, 'E2 le compteur ne redescend jamais', JSON.stringify(pris));
    const i = COMPTA.indexOf('const deleteInvoice='), g = i < 0 ? '' : COMPTA.slice(i, COMPTA.indexOf('\n  };', i));
    dit(/noterNumeroPris\(/.test(g) && g.indexOf('noterNumeroPris(') < g.indexOf('setInvoices('), 'E3 la suppression note le numéro pris AVANT de retirer la facture');
  });

  // ── F. Ventes saisies à la main ───────────────────────────────────────────
  await essaie('F ventes manuelles', async () => {
    const M = await charge('src/venteManuelle.js'); if (!M) return;
    const cat = [{ id: '10', buyPrice: 20 }, { id: '11', buyPrice: '' }];
    dit(M.achatVenteManuelle(['10', '99'], cat, '') === null, 'F1 un N° du lot introuvable ⇒ achat « pas su » (null), jamais la somme partielle');
    dit(M.achatVenteManuelle(['11'], cat, '') === null, 'F2 un prix d\'achat vide au catalogue ⇒ null');
    dit(M.achatVenteManuelle(['77'], cat, '') === null, 'F3 rien au catalogue et champ vide ⇒ null, jamais 0 €');
    dit(M.achatVenteManuelle(['77'], cat, '12,50') === 12.5, 'F4 achat tapé « 12,50 » ⇒ 12,50 €');
    const t = M.totauxVentesManuelles([{ sellPrice: 50, buyPrice: 20 }, { sellPrice: 40, buyPrice: null }]);
    dit(t.benefice === 30 && t.nConnus === 1 && t.n === 2 && t.ca === 90, 'F5 bénéfice sur les ventes au coût connu, couverture 1 sur 2 (jamais 50 + 40 − 20)', JSON.stringify(t));
    dit(!/\+newRow\.buyPrice\|\|0/.test(COMPTA), 'F6 l\'écran ne remplace plus un achat vide par 0');
  });

  // ── G. Carte URSSAF ───────────────────────────────────────────────────────
  {
    const m = COMPTA.match(/const urssafInfo = (v \? \{[^;]*\} : null);/);
    let info = null;
    try { info = m ? new Function('v', 'return ' + m[1])({ aDater: null, sources: {}, declare: 'lu', nonComptees: { n: 2, par: { 'eBay|frais': 2 } } }) : null; } catch (_) { info = null; }
    dit(info && info.nonComptees && info.nonComptees.n === 2, 'G la carte URSSAF reçoit `nonComptees` ⇒ « ce total est un minimum » s\'affiche', JSON.stringify(info));
  }

  // ── H. Offre acceptée à la main ───────────────────────────────────────────
  await essaie('H offre à la main', async () => {
    const M = await charge('src/offresGarde.js'); if (!M) return;
    const now = Date.parse('2026-11-11T12:00:00Z');
    const garde = { v: M.GARDE_OFFRES_VERSION, at: now - 60000, items: ['8001'], complet: true, manques: [], ambigus: 0 };
    const a = M.avisAcceptationManuelle && M.avisAcceptationManuelle(garde, '8001', now);
    dit(a && a.bloque === true, 'H1 paire vendue ailleurs ⇒ « Accepter » ne part pas', JSON.stringify(a));
    const b = M.avisAcceptationManuelle && M.avisAcceptationManuelle({ ...garde, at: now - 72 * 3600e3 }, '8002', now);
    dit(b && b.pasSu === true && !b.bloque, 'H2 garde périmée ⇒ « pas su », dit dans la confirmation', JSON.stringify(b));
    const c = M.avisAcceptationManuelle && M.avisAcceptationManuelle(garde, '8002', now);
    dit(c === null, 'H3 garde fraîche, paire pas vendue ailleurs ⇒ rien à dire');
    const i = APP.indexOf('const actionOffre = async'), g = i < 0 ? '' : APP.slice(i, i + 4000);
    const iA = g.indexOf('avisAcceptationManuelle('), iC = g.indexOf('askConfirm(');
    dit(iA > 0 && iA < iC && /if \(avis && avis\.bloque\)[^\n]*return;/.test(g), 'H4 Messages lit la garde AVANT la confirmation, et s\'arrête si vendue ailleurs');
  });

  // ── I. Baisse en euros ────────────────────────────────────────────────────
  await essaie('I baisse', async () => {
    const M = await charge('src/baissePrix.js'); if (!M) return;
    const refusees = ['1,10', '0,29', '4,35', '9,95', '2.30', '1,15'].filter((t) => !M.baisseTapee('eur', t).ok);
    dit(refusees.length === 0, 'I1 1,10 · 0,29 · 4,35 · 9,95 · 2.30 · 1,15 acceptées', refusees.join(' · '));
    dit(!M.baisseTapee('eur', '1,105').ok, 'I2 1,105 refusée (au centime près)');
  });

  // ── J. Prix conseillé ─────────────────────────────────────────────────────
  dit(!/>Prix conseillé</.test(APP) && !/lister\.reco\b/.test(APP), 'J1 plus de « Prix conseillé » à la mise en ligne (refusé le 11 oct.)');
  dit(/const sugg0 = [^\n]*Math\.ceil\(achat\)/.test(APP), 'J2 le conseil d\'une paire qui dort ne descend jamais sous le prix d\'achat');

  // ── K. Pas de rouge sur un bénéfice ───────────────────────────────────────
  {
    const fautes = [];
    const fichiers = ['src/App.jsx', ...fs.readdirSync(path.join(R, 'src', 'ecrans')).filter((f) => /\.jsx$/.test(f)).map((f) => 'src/ecrans/' + f)];
    for (const f of fichiers) {
      const t = sansCommentaires(lire(f));
      const re = /([\w.]*(?:benef|profit|marg|resultat|\bb\b)[\w.]*)\s*>=?\s*0\s*\?\s*[\w.]+\s*:\s*\(?\s*C\.danger/gi;
      let m; while ((m = re.exec(t))) fautes.push(`${f}:${t.slice(0, m.index).split('\n').length} ${m[0]}`);
      const re2 = /\bb\s*>=\s*0\s*\?\s*C\.\w+\s*:\s*C\.danger/g;
      while ((m = re2.exec(t))) fautes.push(`${f}:${t.slice(0, m.index).split('\n').length} ${m[0]}`);
    }
    dit(fautes.length === 0, 'K aucun bénéfice ni marge négatif en rouge (rouge = deux paires sous un N°, §7)', fautes.slice(0, 6).join(' | '));
  }

  // ── L. N° par cleNum ──────────────────────────────────────────────────────
  {
    const i = APP.indexOf('const bordForItem = '), g = i < 0 ? '' : APP.slice(i, APP.indexOf('\n  };', i));
    dit(/cleNum\(bb\.numero\) === cleNum\(numero\)/.test(g), 'L1 bordereau ⇄ fiche par `cleNum` (« 07 » = « 7 »)');
    const j = STOCK.indexOf('const numeroExists ='), h = j < 0 ? '' : STOCK.slice(j, j + 300);
    dit(/cleNum\(/.test(h) && !/toLowerCase\(\)/.test(h), 'L2 inventaire : un N° déjà pris se reconnaît par `cleNum`');
  }

  // ── M. « Pas su » ≠ 0 (moy. 23, 33) ─────────────────────────────────────
  {
    const EB = sansCommentaires(lire('src/ecrans/Ebay.jsx'));
    const i = EB.indexOf('const ords = data.orders || [];'), g = i < 0 ? '' : EB.slice(i, i + 600);
    const m = g.match(/const eur = (\([^\n]*);/);
    let r = null; try { r = m ? new Function('return ' + m[1])()(null) : null; } catch (_) { r = null; }
    dit(r === '—', 'M1 Argent eBay : un total « pas su » s\'écrit « — », jamais « 0,00 € »', String(r));
    const j = APP.indexOf('const declarerMois = '), h = j < 0 ? '' : APP.slice(j, APP.indexOf('\n  };', j));
    dit(/const m = lireMontantSaisi\(montantTxt\)/.test(h) && !/parseFloat\(String\(montantTxt/.test(h), 'M2 montant déclaré lu par `lireMontantSaisi` (« 1.234,56 » n\'est plus 1,23 €)');
  }

  console.log(rouges ? `\n❌ ${rouges} contrôle(s) rouge(s)` : '\n✅ robustesse métier : toutes les règles tiennent');
  process.exit(rouges ? 1 : 0);
})();
