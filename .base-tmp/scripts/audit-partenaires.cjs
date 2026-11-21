#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA RÈGLE DE COMMISSION DU PROGRAMME PARTENAIRE (15 nov.)
//  node scripts/audit-partenaires.cjs            (le contrôle)
//  node scripts/audit-partenaires.cjs --prouve   (chaque règle réaffaiblie ⇒ ROUGE)
//
//  Exécute la VRAIE règle (api/_lib/partenaires-regle.js) sur des factures Stripe
//  INVENTÉES, de la vraie forme (API 2026-08-26 : `parent.subscription_details`,
//  `status_transitions.paid_at`, `payments.data[].payment`) :
//    R1 un paiement réel ⇒ une commission de 300 centimes, datée du paiement ;
//    R2 0 € (la facture de l'essai) ⇒ rien ;
//    R3 Pro et Solo ⇒ 300 tous deux (le montant ne suit jamais le prix) ;
//    R4 la même facture (webhook rejoué) ⇒ une seule ;
//    R5 un client, un mois ⇒ une seule (régularisation, deuxième facture du mois) ;
//    R6 hors abonnement, autre devise, motif « update » / « manual » ⇒ rien ;
//    R7 avant le rattachement ⇒ rien (pas rétroactif) ;
//    R8 due 14 jours après le paiement, « en attente » avant ;
//    R9 remboursement / litige / avoir ⇒ annulée (et une annulation reçue AVANT
//       la facture la fait naître annulée) ; un remboursement à 0 ⇒ rien ;
//    R10 client résilié ⇒ plus aucun client actif, rien d'effacé de ce qui est gagné ;
//    R11 les chiffres : dû − versé = reste, trop versé dit, jamais un client nommé ;
//    R12 le CSV : clients anonymes (« Client 1 »), « ; », montants « 3,00 ».
//  L'auto-parrainage refusé, le rattachement et le webhook EXÉCUTÉS : le banc
//  scripts/bancs/partenaires-serveur.cjs. Les tables : scripts/audit-partenaires-sql.cjs.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'api/_lib/partenaires-regle.js');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + d : '')); };
const remplace = (s, a, b, nom) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('ancre introuvable pour ' + nom + ' (' + n + ')'); return s.split(a).join(b); };

// Chaque mutation réaffaiblit UNE règle : l'audit doit rougir.
const MUTATIONS = {
  'zero-compte': (s) => remplace(s, "if (!Number.isInteger(paye) || paye <= 0) return { ok: false, raison: 'zero' };", "if (!Number.isInteger(paye) || paye < 0) return { ok: false, raison: 'zero' };", 'zc'),
  'montant-du-prix': (s) => remplace(s, '    montant_centimes: COMMISSION_CENTIMES,\n', '    montant_centimes: Math.round(Number(facture.amount_paid) * 0.18),\n', 'mp'),
  'rejeu-double': (s) => remplace(s, "  if (existantes.some((c) => c && c.facture === facture.id)) return { rien: 'deja' };\n", '', 'rd'),
  'deux-par-mois': (s) => remplace(s, "  if (existantes.some((c) => c && c.mois === mois && !c.annulee_le)) return { rien: 'mois-deja' };\n", '', 'dm'),
  'motif-libre': (s) => remplace(s, "  if (!MOTIFS_ABONNEMENT.includes(String(f.billing_reason || ''))) return { ok: false, raison: 'motif' };\n", '', 'ml'),
  'retroactif': (s) => remplace(s, "  if (!Number.isFinite(inscrit) || paye < inscrit) return { rien: 'avant-rattachement' };\n", '', 'rt'),
  'due-tout-de-suite': (s) => remplace(s, '    due_le: new Date(paye + DELAI_DUE_JOURS * 86400000).toISOString(),', '    due_le: new Date(paye).toISOString(),', 'dt'),
  'annulee-comptee': (s) => remplace(s, "    if (e === 'annulee') { x.nAnnulees++; continue; }", "    if (e === 'annulee') { x.nAnnulees++; }", 'ac'),
  'annulation-ignoree': (s) => remplace(s, "  if (rb.total) { ligne.annulee_le", "  if (false) { ligne.annulee_le", 'ai'),
  // (16 nov.) Le remboursement partiel : la commission est réduite au prorata, jamais annulée ni gardée entière.
  'partiel-annule-tout': (s) => remplace(s, "  if (!(f > 0) || r >= f) return { total: true, raison, centimes: r, le: plusTot(liste) };", "  if (r > 0) return { total: true, raison, centimes: r, le: plusTot(liste) };", 'pat'),
  'partiel-ignore': (s) => remplace(s, "    const x = m(c.mois), e = etatCommission(c, maintenant), v = commissionNette(c);", "    const x = m(c.mois), e = etatCommission(c, maintenant), v = Number(c.montant_centimes) || 0;", 'pi'),
  'partiel-arrondi-haut': (s) => remplace(s, "  return Math.floor((m * (f - r)) / f);", "  return Math.ceil((m * (f - r)) / f);", 'pah'),
  'partiel-double-compte': (s) => remplace(s, "    if (vus.has(sig)) continue; vus.add(sig);\n", '', 'pdc'),
  'partiel-familles-additionnees': (s) => remplace(s, "  const r = Math.max(cumul, re, cn);", "  const r = cumul + re + cn;", 'pfa'),
  'litige-oublie': (s) => remplace(s, "  else if (type === 'charge.dispute.created') raison = 'litige';\n", '', 'lo'),
  'actif-sans-statut': (s) => remplace(s, "  const payantsActifs = actifs instanceof Set ? [...payeurs].filter((f) => actifs.has(f)).length : null;", "  const payantsActifs = payeurs.size;", 'as'),
  'verse-ignore': (s) => remplace(s, '    resteCentimes: x.dueCentimes - x.verseCentimes, versements: x.versements,', '    resteCentimes: x.dueCentimes, versements: x.versements,', 'vi'),
  'attente-due': (s) => remplace(s, "  return Number.isFinite(due) && due <= maintenant ? 'due' : 'attente';", "  return 'due';", 'ad'),
  'csv-nomme': (s) => remplace(s, "c.filleul ? 'Client ' + rang.get(String(c.filleul)) : 'Client (compte supprimé)'", "c.filleul ? String(c.filleul) : ''", 'cn'),
  'devise-libre': (s) => remplace(s, "  if (String(f.currency || '').toLowerCase() !== 'eur') return { ok: false, raison: 'devise' };\n", '', 'dl'),
};

if (args.includes('--prouve')) {
  let rouges = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' });
    const n = (r.stdout.match(/^❌ /gm) || []).length;
    const saute = /ancre introuvable|NON exécuté/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !saute;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' rouge(s)' : saute ? 'non exécutée' : 'RESTE VERTE'}`);
    if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 1)) console.log('      ' + l.slice(0, 180));
  }
  console.log(`\n${rouges}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(rouges === Object.keys(MUTATIONS).length ? 0 : 1);
}

// ── Des factures INVENTÉES, de la forme de l'API Stripe 2026-08-26 ──────────
const S = (iso) => Math.floor(Date.parse(iso) / 1000);
let n = 0;
const facture = (o = {}) => ({
  id: o.id || 'in_banc' + (++n), object: 'invoice', status: 'paid', currency: 'eur', amount_paid: o.montant ?? 1699, total: o.montant ?? 1699,
  billing_reason: o.motif || 'subscription_cycle', customer: 'cus_banc',
  parent: o.sansAbo ? { type: 'quote_details' } : { type: 'subscription_details', subscription_details: { subscription: 'sub_banc1', metadata: {} } },
  status_transitions: { paid_at: S(o.le || '2026-10-08T09:30:00Z'), finalized_at: S(o.le || '2026-10-08T09:30:00Z') }, created: S(o.le || '2026-10-08T09:30:00Z'),
  payments: { object: 'list', data: [{ object: 'invoice_payment', payment: { type: 'payment_intent', payment_intent: o.pi || 'pi_banc' + n } }] },
  ...(o.ancien ? { subscription: 'sub_banc1', parent: null, payment_intent: 'pi_ancien' + n, charge: 'ch_ancien' + n, payments: undefined } : {}),
});
const RATT = { filleul: 'aaaaaaaa-0000-4000-8000-000000000001', partenaire: 'bbbbbbbb-0000-4000-8000-000000000001', inscrit: '2026-10-01T08:00:00Z' };
const PART = { id: RATT.partenaire };
const J = 86400000;

(async () => {
  let src = fs.readFileSync(REGLE, 'utf8');
  let fichier = REGLE;
  if (MUTATION) {
    const m = MUTATIONS[MUTATION];
    if (!m) { console.log('❌ mutation inconnue — NON exécuté'); process.exit(1); }
    try { src = m(src); } catch (e) { console.log('❌ ' + e.message + ' — NON exécuté'); process.exit(1); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-partenaires-'));
    fichier = path.join(dir, 'partenaires-regle.js');
    fs.writeFileSync(fichier, src);
    process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });
  }
  const R = await import(pathToFileURL(fichier).href);
  const decide = (f, o = {}) => R.decisionCommission({ facture: f, rattachement: o.ratt === undefined ? RATT : o.ratt, partenaire: o.part === undefined ? PART : o.part, existantes: o.ex || [], annulee: o.annulee || null, signaux: o.signaux || [] });

  console.log('── R1 · R3 : un paiement réel ⇒ 300 centimes, Solo comme Pro');
  const solo = decide(facture({ montant: 1699 }));
  dit(solo.creer && solo.creer.montant_centimes === 300, 'Solo (16,99 €) payé ⇒ une commission de 300 centimes', JSON.stringify(solo).slice(0, 120));
  const pro = decide(facture({ montant: 1999 }));
  dit(pro.creer && pro.creer.montant_centimes === 300, 'Pro (19,99 €) payé ⇒ 300 centimes aussi (le montant ne suit jamais le prix)');
  const avecSup = decide(facture({ montant: 2898 }));
  dit(avecSup.creer && avecSup.creer.montant_centimes === 300, 'Solo + un compte de plus (28,98 €) ⇒ 300, une seule');
  dit(solo.creer && solo.creer.paye_le === '2026-10-08T09:30:00.000Z' && solo.creer.mois === '2026-10', 'datée du paiement (`status_transitions.paid_at`), mois de Paris « 2026-10 »');
  dit(solo.creer && solo.creer.facture_centimes === 1699 && solo.creer.payment_intent && /^pi_/.test(solo.creer.payment_intent), 'la facture et son paiement sont gardés (pour un remboursement)');
  const anc = decide(facture({ ancien: true }));
  dit(anc.creer && anc.creer.charge && anc.creer.payment_intent, 'ancienne forme (`subscription`, `charge`, `payment_intent` sur la facture) lue aussi');
  const minuit = decide(facture({ le: '2026-10-31T23:30:00Z' }));
  dit(minuit.creer && minuit.creer.mois === '2026-11', 'payée le 31 oct. à 23 h 30 UTC = le 1er nov. à Paris ⇒ mois « 2026-11 »');

  console.log('── R2 · R6 : pas un paiement réel ⇒ rien');
  dit(decide(facture({ montant: 0, motif: 'subscription_create' })).rien === 'zero', "la facture à 0 € de l'essai ⇒ rien");
  dit(!!decide({ ...facture(), status: 'open' }).rien, 'une facture pas payée ⇒ rien');
  dit(decide({ ...facture(), currency: 'usd' }).rien === 'devise', 'une autre devise ⇒ rien');
  dit(decide(facture({ sansAbo: true })).rien === 'hors-abonnement', 'une facture hors abonnement ⇒ rien');
  dit(decide(facture({ motif: 'subscription_update' })).rien === 'motif', 'une facture de régularisation (changement de plan) ⇒ rien');
  dit(decide(facture({ motif: 'manual' })).rien === 'motif', 'une facture manuelle ⇒ rien');
  dit(!!decide(facture({ motif: 'subscription_create' })).creer, 'le premier paiement direct (sans essai) ⇒ une commission');
  dit(decide(facture(), { ratt: null }).rien === 'pas-rattache', 'un client sans code ⇒ rien');
  dit(decide(facture(), { part: { id: 'cccccccc-0000-4000-8000-000000000009' } }).rien === 'partenaire-inconnu', "le partenaire d'un autre ⇒ rien");

  console.log('── R4 · R5 : une facture = une commission ; un client = une par mois');
  const f1 = facture({ id: 'in_rejeu' });
  const premiere = decide(f1);
  dit(!!premiere.creer, 'le premier webhook crée la commission');
  dit(decide(f1, { ex: [premiere.creer] }).rien === 'deja', 'le MÊME webhook rejoué ⇒ rien de plus');
  dit(decide(facture({ id: 'in_autre', le: '2026-10-20T10:00:00Z' }), { ex: [premiere.creer] }).rien === 'mois-deja', 'une 2e facture du même mois ⇒ rien');
  dit(!!decide(facture({ id: 'in_nov', le: '2026-11-08T09:30:00Z' }), { ex: [premiere.creer] }).creer, 'le mois suivant ⇒ une nouvelle commission (à vie)');
  dit(!!decide(facture({ id: 'in_apres', le: '2026-10-21T10:00:00Z' }), { ex: [{ ...premiere.creer, annulee_le: '2026-10-12T00:00:00Z' }] }).creer, 'une commission annulée ne bloque pas un vrai paiement du même mois');

  console.log('── R7 : rien de rétroactif');
  dit(decide(facture({ le: '2026-09-20T10:00:00Z' })).rien === 'avant-rattachement', 'un paiement AVANT le rattachement ⇒ rien');

  console.log('── R8 : due 14 jours après le paiement');
  const c = solo.creer;
  dit(c.due_le === new Date(Date.parse(c.paye_le) + 14 * J).toISOString(), 'due_le = paiement + 14 jours');
  dit(R.etatCommission(c, Date.parse(c.paye_le) + 13 * J) === 'attente', 'à J+13 : en attente (pas encore due)');
  dit(R.etatCommission(c, Date.parse(c.paye_le) + 14 * J + 1) === 'due', 'à J+14 : due');

  console.log('── R9 : remboursement, litige, avoir ⇒ annulée');
  const a1 = R.annulationDeLEvenement('charge.refunded', { id: 'ch_x1', object: 'charge', amount_refunded: 1699, payment_intent: 'pi_x1' });
  dit(a1 && a1.raison === 'remboursement' && a1.cles.payment_intent === 'pi_x1' && a1.cles.charge === 'ch_x1', 'charge.refunded ⇒ remboursement, retrouvé par son paiement');
  dit(R.annulationDeLEvenement('charge.refunded', { id: 'ch_x2', amount_refunded: 0, payment_intent: 'pi_x2' }) === null, 'un remboursement à 0 ⇒ rien');
  const a2 = R.annulationDeLEvenement('charge.dispute.created', { id: 'dp_1', object: 'dispute', charge: 'ch_x3', payment_intent: 'pi_x3' });
  dit(a2 && a2.raison === 'litige' && a2.cles.charge === 'ch_x3', 'charge.dispute.created ⇒ litige');
  const a3 = R.annulationDeLEvenement('credit_note.created', { id: 'cn_1', object: 'credit_note', invoice: 'in_y1', amount: 1699, status: 'issued' });
  dit(a3 && a3.raison === 'avoir' && a3.cles.facture === 'in_y1', 'credit_note.created ⇒ avoir, par la facture');
  const a4 = R.annulationDeLEvenement('refund.created', { id: 're_1', object: 'refund', charge: 'ch_x4', payment_intent: 'pi_x4', status: 'succeeded' });
  dit(a4 && a4.raison === 'remboursement', 'refund.created ⇒ remboursement');
  dit(R.annulationDeLEvenement('refund.created', { id: 're_2', charge: 'ch_x5', status: 'failed' }) === null, 'un remboursement échoué ⇒ rien');
  dit(R.annulationDeLEvenement('invoice.paid', { id: 'in_z' }) === null, 'un autre événement ⇒ rien');
  const nee = decide(facture({ id: 'in_tard' }), { annulee: { raison: 'remboursement', le: '2026-10-09T00:00:00Z' } });
  dit(nee.creer && nee.creer.annulee_le && nee.creer.annulee_raison === 'remboursement', 'remboursement reçu AVANT la facture payée ⇒ la commission naît annulée (gardée, dite)');
  // (16 nov., lot compta-donnees) UN REMBOURSEMENT PARTIEL RÉDUIT, IL N'ANNULE PAS.
  console.log('── R9b : remboursement partiel ⇒ commission au prorata (3 € × ce qui reste payé)');
  const p1 = R.annulationDeLEvenement('refund.created', { id: 're_p1', object: 'refund', amount: 100, charge: 'ch_p1', payment_intent: 'pi_p1', status: 'succeeded' });
  dit(p1 && p1.signal === 're_p1' && p1.centimes === 100, 'refund.created porte SON geste et SON montant', JSON.stringify(p1));
  const p2 = R.annulationDeLEvenement('charge.refunded', { id: 'ch_p1', object: 'charge', amount_refunded: 100, payment_intent: 'pi_p1' });
  dit(p2 && p2.signal === 'cumul:100' && p2.centimes === 100, 'charge.refunded porte le CUMUL du paiement');
  const rb1 = R.remboursementDe([{ ...p1, le: 'a' }, { ...p2, le: 'b' }], 1699);
  dit(rb1.total === false && rb1.centimes === 100, '1 € rendu (refund.created + charge.refunded du même geste) : 1 € compté UNE fois, pas annulée', JSON.stringify(rb1));
  const redu = { ...c, facture_centimes: 1699, rembourse_centimes: 100 };
  dit(R.commissionNette(redu) === 282, '1 € rendu sur 16,99 € ⇒ 2,82 € (3 € × 15,99 / 16,99, au centime inférieur)', R.commissionNette(redu));
  dit(R.commissionNette({ ...c, facture_centimes: 1699, rembourse_centimes: 1698 }) === 0 && R.commissionNette({ ...c, facture_centimes: 1999, rembourse_centimes: 1000 }) === 149, 'jamais au-dessus du prorata (16,98 € rendus ⇒ 0,00 € ; 10 € sur 19,99 € ⇒ 1,49 €)');
  dit(R.commissionNette({ ...c, facture_centimes: 1699, rembourse_centimes: 0 }) === 300, 'rien rendu ⇒ 3,00 €');
  const rb2 = R.remboursementDe([{ raison: 'remboursement', signal: 're_a', centimes: 500 }, { raison: 'remboursement', signal: 're_b', centimes: 300 }, { raison: 'remboursement', signal: 're_a', centimes: 500 }, { raison: 'remboursement', signal: 'cumul:500', centimes: 500 }, { raison: 'remboursement', signal: 'cumul:800', centimes: 800 }], 1699);
  dit(rb2.total === false && rb2.centimes === 800, 'deux remboursements distincts (5 € + 3 €), le premier rejoué, deux cumuls ⇒ 8 € rendus', JSON.stringify(rb2));
  const rb3 = R.remboursementDe([{ raison: 'avoir', signal: 'cn_1', centimes: 400 }, { raison: 'remboursement', signal: 're_c', centimes: 400 }], 1699);
  dit(rb3.total === false && rb3.centimes === 400, 'un avoir qui rembourse (avoir + remboursement du même argent) ⇒ 4 €, jamais 8 €', JSON.stringify(rb3));
  dit(R.remboursementDe([{ raison: 'remboursement', signal: 're_d', centimes: 1699 }], 1699).total === true, 'toute la facture rendue ⇒ annulée');
  dit(R.remboursementDe([{ raison: 'remboursement', signal: 'total', centimes: null }], 1699).total === true, 'un montant pas lu ⇒ annulée (pas su ne vaut pas « partiel »)');
  dit(R.remboursementDe([{ raison: 'remboursement', signal: 're_e', centimes: 100 }, { raison: 'litige', signal: 'litige', centimes: null }], 1699).raison === 'litige', 'un litige annule toute la commission, même après un rendu partiel');
  const neeP = decide(facture({ id: 'in_tardP' }), { signaux: [{ raison: 'remboursement', signal: 're_t', centimes: 100, le: '2026-10-09T00:00:00Z' }] });
  dit(neeP.creer && !neeP.creer.annulee_le && neeP.creer.rembourse_centimes === 100, 'rendu partiel reçu AVANT la facture payée ⇒ elle naît réduite, pas annulée', JSON.stringify(neeP.creer && { a: neeP.creer.annulee_le, r: neeP.creer.rembourse_centimes }));
  const chP = R.chiffresPartenaire({ commissions: [{ ...redu, due_le: '2026-10-22T00:00:00Z' }], versements: [], inscrits: 1, actifs: new Set([RATT.filleul]), maintenant: Date.parse('2026-11-14T12:00:00Z') });
  dit(chP.mois[0] && chP.mois[0].dueCentimes === 282 && chP.mois[0].nReduites === 1 && chP.mois[0].nAnnulees === 0 && chP.mois[0].clientsPayants === 1, 'les chiffres : 2,82 € dus, « 1 réduite », le client reste payant', JSON.stringify(chP.mois[0]));
  const csvP = R.csvPartenaire({ partenaire: { nom: 'Leo', code: 'LEO' }, commissions: [{ ...redu, due_le: '2026-10-22T00:00:00Z' }], versements: [], maintenant: Date.parse('2026-11-14T12:00:00Z') });
  dit(/;2,82;due;remboursement partiel 1,00\r\n/.test(csvP), 'le CSV dit 2,82 et « remboursement partiel 1,00 »', csvP.split('\r\n')[1]);
  const annulee = { ...c, annulee_le: '2026-10-10T00:00:00Z', annulee_raison: 'remboursement' };
  dit(R.etatCommission(annulee, Date.now()) === 'annulee', 'annulée reste annulée, même après 14 jours');
  const ch = R.chiffresPartenaire({ commissions: [annulee], versements: [], inscrits: 1, actifs: new Set([RATT.filleul]), maintenant: Date.parse('2026-11-14T12:00:00Z') });
  dit(ch.mois[0] && ch.mois[0].dueCentimes === 0 && ch.mois[0].attenteCentimes === 0 && ch.mois[0].clientsPayants === 0 && ch.mois[0].nAnnulees === 1 && ch.totaux.resteCentimes === 0,'une annulée ne compte dans aucun total, son nombre est dit', JSON.stringify(ch.mois[0]));

  console.log('── R10 · R11 : les chiffres');
  const F = (i) => `aaaaaaaa-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`;
  const com = [];
  for (let i = 1; i <= 23; i++) com.push(decide(facture({ id: 'in_oct' + i, le: '2026-10-' + String(2 + (i % 25)).padStart(2, '0') + 'T10:00:00Z' }), { ratt: { ...RATT, filleul: F(i) } }).creer);
  for (let i = 1; i <= 5; i++) com.push(decide(facture({ id: 'in_nov' + i, le: '2026-11-0' + (i + 1) + 'T10:00:00Z' }), { ratt: { ...RATT, filleul: F(i) } }).creer);
  dit(com.every(Boolean), '28 commissions inventées construites');
  const AU = Date.parse('2026-11-14T12:00:00Z');
  const actifs = new Set(Array.from({ length: 23 }, (_, i) => F(i + 1)));
  const x = R.chiffresPartenaire({ commissions: com, versements: [], inscrits: 31, actifs, maintenant: AU });
  const oct = x.mois.find((m) => m.mois === '2026-10'), nov = x.mois.find((m) => m.mois === '2026-11');
  dit(oct && oct.dueCentimes === 6900 && oct.clientsPayants === 23, '« Leo · 23 clients payants · 69,00 € à lui verser pour octobre (au 14 nov.) »', oct && `${oct.clientsPayants} · ${oct.dueCentimes}`);
  dit(nov && nov.dueCentimes === 0 && nov.attenteCentimes === 1500 && nov.nAttente === 5, 'novembre : 15,00 € en attente (moins de 14 jours), rien de dû');
  dit(x.payantsActifs === 23 && x.inscrits === 31, '23 clients payants actifs sur 31 inscrits');
  dit(x.prochainVersement && x.prochainVersement.mois === '2026-10' && x.prochainVersement.centimes === 6900, 'la ligne de Julien : octobre, 69,00 €');
  const verse = R.chiffresPartenaire({ commissions: com, versements: [{ mois: '2026-10', montant_centimes: 6900, verse_le: '2026-11-15' }], inscrits: 31, actifs, maintenant: AU });
  const oct2 = verse.mois.find((m) => m.mois === '2026-10');
  dit(oct2.resteCentimes === 0 && oct2.verseCentimes === 6900 && verse.prochainVersement === null, '« Versé » 69,00 € ⇒ octobre soldé, plus rien à verser');
  const apres = com.map((k) => (k.facture === 'in_oct1' ? { ...k, annulee_le: '2026-11-16T00:00:00Z', annulee_raison: 'litige' } : k));
  const trop = R.chiffresPartenaire({ commissions: apres, versements: [{ mois: '2026-10', montant_centimes: 6900, verse_le: '2026-11-15' }], inscrits: 31, actifs, maintenant: AU });
  dit(trop.mois.find((m) => m.mois === '2026-10').resteCentimes === -300, 'un litige APRÈS versement ⇒ « trop versé : 3,00 € à reprendre » (dit, jamais caché)');
  // R10 : le client 1 résilie (abonnement plus vivant) : il quitte les actifs, rien de gagné n'est effacé.
  const sansUn = new Set([...actifs].filter((f) => f !== F(1)));
  const res = R.chiffresPartenaire({ commissions: com, versements: [], inscrits: 31, actifs: sansUn, maintenant: AU });
  dit(res.payantsActifs === 22, 'client résilié ⇒ il ne compte plus parmi les clients payants', String(res.payantsActifs));
  dit(res.mois.find((m) => m.mois === '2026-10').dueCentimes === 6900, "client résilié ⇒ ce qu'il a déjà rapporté reste (rien de rétroactif)");
  const dec = R.chiffresPartenaire({ commissions: com, versements: [], inscrits: 31, actifs: sansUn, maintenant: Date.parse('2026-12-31T12:00:00Z') });
  dit(!dec.mois.some((m) => m.mois === '2026-12'), 'aucune facture en décembre ⇒ aucune commission inventée pour décembre');
  dit(R.chiffresPartenaire({ commissions: com, inscrits: 3, actifs: null, maintenant: AU }).payantsActifs === null, 'abonnements pas lus ⇒ « clients payants » pas su (null), jamais 0');
  const sortie = JSON.stringify(x);
  dit(!/aaaaaaaa-/.test(sortie), 'les chiffres ne portent AUCUN identifiant de client');

  console.log('── R12 : le CSV pour la compta');
  const csv = R.csvPartenaire({ partenaire: { nom: 'Leo', code: 'LEO' }, commissions: com.slice(0, 3), versements: [{ mois: '2026-10', montant_centimes: 900, verse_le: '2026-11-15' }], maintenant: AU });
  const lignes = csv.replace(/^﻿/, '').trim().split(/\r\n/);
  dit(lignes[0] === 'type;partenaire;code;mois;date;due_le;client;montant_eur;etat;raison', 'en-tête « ; » (Excel en français)');
  dit(lignes.length === 5 && lignes.filter((l) => l.startsWith('commission;')).length === 3 && lignes[4].startsWith('versement;'), '3 commissions puis 1 versement');
  dit(lignes[1].includes(';Client 1;3,00;due;'), 'client anonyme « Client 1 », montant « 3,00 », état « due »', lignes[1]);
  dit(!/aaaaaaaa-/.test(csv), "le CSV ne porte AUCUN identifiant de client");

  console.log('── Le code partenaire');
  dit(R.codePartenaire(' leo ') === 'LEO' && R.codePartenaire('Léo') === 'LEO' && R.codePartenaire('LE') === '' && R.codePartenaire('LEO!') === '' && R.codePartenaire('A'.repeat(17)) === '', '« leo » = « LEO » ; trop court, trop long, signes ⇒ refusé');

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
