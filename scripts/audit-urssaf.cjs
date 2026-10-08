#!/usr/bin/env node
/**
 * LE CHIFFRE D'AFFAIRES DÉCLARÉ À L'URSSAF — UNE SEULE RÈGLE, ET RIEN D'ÉCARTÉ
 *
 * Julien : « je veux un rapport tous les mois de la somme de toutes les ventes
 * finalisées pour mon URSSAF ». Ce chiffre est recopié sur une déclaration :
 * il ne peut ni être calculé de trois façons, ni écarter des ventes en silence.
 *
 * ⚠️ Deux défauts mesurés en base le 2 septembre :
 *  1. le rapport écartait les ventes masquées dans l'app (`isHidden`) —
 *     101 ventes finalisées, 2 174,80 €. Sur juin 2026 il affichait 41 € au
 *     lieu de 1 512,70 €. Masquer une carte range un écran, ça n'annule pas
 *     une vente encaissée.
 *  2. le récap du tableau de bord lisait `vinted_sales`, VIDE depuis juillet
 *     2026 → 0 € partout.
 * Plus un troisième, trouvé en lisant le code : le rapport ANNUEL calculait
 * `marge = margeKnown - frais`, en mélangeant le sous-ensemble des ventes au
 * coût connu avec les boosts de TOUTES les ventes (§5.84 avait corrigé le
 * mensuel et pas lui).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RACINE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

// ── 1. La règle est UNE fonction de module, et elle s'exécute ───────────────
const bloc = (() => {
  const i = SRC.indexOf('const TAUX_URSSAF_DEFAUT');
  if (i < 0) return null;
  const j = SRC.indexOf('\n// Heure locale', i);
  const k = SRC.indexOf('\nconst heureCommande', i);
  const fin = [j, k].filter(x => x > 0).sort((a, b) => a - b)[0];
  return fin ? SRC.slice(i, fin) : null;
})();

if (!bloc || !/caUrssafParMois/.test(bloc)) {
  nok('la règle du CA déclaré existe au niveau module', 'caUrssafParMois introuvable');
} else {
  const ctx = {
    console, Date, Number, String, isFinite, parseFloat,
    load: (k, d) => d,
    classifyOrderStatus: (s) => /annul|cancel|refus|rembours/i.test(String(s || '')) ? 'cancelled'
      : (/finalis/i.test(String(s || '')) ? 'completed' : 'pending'),
    tsCommande: (o) => Date.parse((o && o.date) || '') || 0,
    montantCommande: (o) => {
      const p = o && o.price; if (p == null) return 0;
      const v = (typeof p === 'object') ? (p.amount ?? p.value) : p;
      const n = Number(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n;
    },
  };
  const EXPORTE = "\n;Object.assign(this, { tauxUrssaf, moisDeVente, venteFinalisee, caUrssafParMois });";
  vm.createContext(ctx); vm.runInContext(bloc + EXPORTE, ctx);

  // Les statuts RÉELLEMENT présents en base (relevé du 2 septembre).
  const cas = [
    ['Commande finalisée ! Ton article est arrivé', true],
    ['Remboursement effectué', false],
    ['Commande expédiée, en cours de livraison', false],
    ['Bordereau envoyé au vendeur', false],
    ['Le paiement a été validé', false],
    ['Retour initié', false],
    ['Transaction suspendue', false],
    ['Commande non réclamée – Retournée', false],
  ];
  let bad = cas.filter(([st, att]) => ctx.venteFinalisee({ status: st }) !== att);
  bad.length
    ? nok('seules les ventes FINALISÉES comptent', bad.map(b => b[0]).join(' · '))
    : ok('seules les ventes FINALISÉES comptent (8 statuts réels)');

  // ⚠️ LE CONTRÔLE QUI COMPTE : une vente masquée reste dans le total.
  const ventes = [
    { transaction_id: 1, date: '2026-06-10T10:00:00Z', status: 'Commande finalisée !', price: { amount: '41.00' } },
    { transaction_id: 2, date: '2026-06-11T10:00:00Z', status: 'Commande finalisée !', price: { amount: '100.00' } },
    { transaction_id: 3, date: '2026-06-12T10:00:00Z', status: 'Remboursement effectué', price: { amount: '999.00' } },
  ];
  const masquee = (o) => String(o.transaction_id) === '2';
  // Datées au jour du VERSEMENT (3 octobre) : chaque vente finalisée porte sa date.
  const VERS = { 1: '2026-06-15T10:00:00Z', 2: '2026-06-16T10:00:00Z', 3: '2026-06-17T10:00:00Z' };
  const m = ctx.caUrssafParMois(ventes, masquee, VERS)['2026-06'] || {};
  (m.ca === 141 && m.n === 2)
    ? ok('une vente masquée dans l\'app reste dans le CA déclaré (141 €, pas 41 €)')
    : nok('une vente masquée reste dans le CA déclaré', `ca=${m.ca} n=${m.n} au lieu de 141 / 2`);
  (m.caMasq === 100 && m.nMasq === 1)
    ? ok('le poids des ventes masquées est compté à part (auditable)')
    : nok('le poids des ventes masquées est compté à part', `caMasq=${m.caMasq}`);
  // Un remboursement n'est jamais du chiffre d'affaires.
  Object.values(ctx.caUrssafParMois(ventes, null, VERS)).every(x => x.ca <= 141)
    ? ok('les remboursements et annulations ne comptent jamais')
    : nok('les remboursements et annulations ne comptent jamais');

  // Le taux est un réglage, pas une constante.
  const ctx2 = Object.assign({}, ctx);
  ctx2.load = (k, d) => (k === 'vinted_urssaf_taux' ? '12,3' : d);
  vm.createContext(ctx2); vm.runInContext(bloc + EXPORTE, ctx2);
  ctx2.tauxUrssaf() === 12.3
    ? ok('le taux de cotisations vient du réglage (virgule acceptée)')
    : nok('le taux vient du réglage', 'obtenu ' + ctx2.tauxUrssaf());
  const ctx3 = Object.assign({}, ctx);
  ctx3.load = (k, d) => (k === 'vinted_urssaf_taux' ? 'nawak' : d);
  vm.createContext(ctx3); vm.runInContext(bloc + EXPORTE, ctx3);
  ctx3.tauxUrssaf() === 13.5
    ? ok('un taux illisible retombe sur le défaut, jamais sur zéro')
    : nok('un taux illisible retombe sur le défaut', 'obtenu ' + ctx3.tauxUrssaf());
}

// ── 1 bis. TOUTES PLATEFORMES (3 octobre) — la MÊME règle pour Vinted,
//    Leboncoin et eBay, exécutée dans un `vm`. Les prédicats Leboncoin viennent
//    du source (recopiés, ils mesureraient MES règles, pas celles de l'app).
{
  const lbcSrc = (() => {
    const a = SRC.indexOf('const lbcAnnulee = ');
    const b = SRC.indexOf('\nconst lbcEuro', a);
    return a > 0 && b > a ? SRC.slice(a, b) : '';
  })();
  const ctxP = {
    console, Date, Number, String, isFinite, parseFloat, Object, Math, Array,
    load: (k, d) => d,
    classifyOrderStatus: (s) => /annul|cancel|refus|rembours/i.test(String(s || '')) ? 'cancelled' : (/finalis/i.test(String(s || '')) ? 'completed' : 'pending'),
    tsCommande: (o) => Date.parse((o && o.date) || '') || 0,
    montantCommande: (o) => { const p = o && o.price; const v = (p && typeof p === 'object') ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; },
  };
  let r = null;
  try {
    vm.createContext(ctxP);
    vm.runInContext(lbcSrc + '\n' + bloc + "\n;Object.assign(this, { ventesDeclarables, caDeclarableParMois, caUrssafParMois });", ctxP);
    const VINTED = [
      { transaction_id: 1, date: '2026-09-10T12:00:00+02:00', price: { amount: '80.0' }, status: 'Commande finalisée' },
      { transaction_id: 2, date: '2026-09-11T12:00:00+02:00', price: { amount: '45.0' }, status: 'Paiement validé' },
    ];
    const LBC = [
      { txId: 'A', isSeller: true, price: 7500, stepLabel: 'Paiement effectué', dateVente: '2026-09-18T14:02:11+02:00', title: 'Salomon' },
      { txId: 'A', isSeller: true, price: 7500, stepLabel: 'Paiement effectué', dateVente: '2026-09-18T14:02:11+02:00', title: 'Salomon (vue deux fois)' },
      { txId: 'B', isSeller: true, price: 5800, stepLabel: 'Paiement effectué', title: 'Nike sans date' },
      { txId: 'C', price: 9900, stepStatus: 'done', dateVente: '2026-09-19T10:00:00+02:00', title: 'côté inconnu' },
      { txId: 'D', isSeller: false, price: 4000, stepStatus: 'done', dateVente: '2026-09-19T10:00:00+02:00', title: 'un ACHAT' },
      { txId: 'E', isSeller: true, price: 4500, stepLabel: 'Colis à envoyer', dateVente: '2026-09-20T10:00:00+02:00', title: 'en cours' },
    ];
    const EBAY = [
      { orderId: 'X1', orderPaymentStatus: 'PAID', creationDate: '2026-09-21T10:00:00.000Z', pricingSummary: { total: { value: '60.00', currency: 'EUR' } } },
      { orderId: 'X2', orderPaymentStatus: 'FULLY_REFUNDED', creationDate: '2026-09-21T10:00:00.000Z', pricingSummary: { total: { value: '30.00', currency: 'EUR' } } },
      { orderId: 'X3', orderPaymentStatus: 'PAID', creationDate: '2026-09-22T10:00:00.000Z', pricingSummary: { total: { value: '50.00', currency: 'USD' } } },
    ];
    const VERS = { 1: '2026-09-18T09:00:00+02:00' };
    r = ctxP.ventesDeclarables({ vinted: VINTED, lbc: LBC, ebay: EBAY, versements: VERS });
    const sept = (ctxP.caDeclarableParMois(r.lignes))['2026-09'] || {};
    const par = sept.par || {};
    Math.abs((sept.ca || 0) - 215) < 0.001
      ? ok('septembre = 80 (Vinted finalisée) + 75 (Leboncoin, centimes) + 60 (eBay payée) — rien d\'autre')
      : nok('le CA du mois additionne les trois plateformes, et elles seules', 'obtenu ' + sept.ca + ' au lieu de 215');
    Math.abs(((par.Vinted || {}).ca || 0) + ((par.Leboncoin || {}).ca || 0) + ((par.eBay || {}).ca || 0) - (sept.ca || 0)) < 0.001 && (par.Leboncoin || {}).n === 1
      ? ok('les « dont » somment au total, et une vente vue deux fois compte UNE fois')
      : nok('les « dont » somment au total sans doublon', JSON.stringify(par));
    r.aDater.length === 1 && r.aDater[0].id === 'lbc:B' && Math.abs(r.aDater[0].eur - 58) < 0.001
      ? ok('une vente Leboncoin SANS date n\'entre dans aucun mois : elle est « à dater », avec son montant')
      : nok('la vente sans date est « à dater »', JSON.stringify(r.aDater));
    !r.lignes.some((l) => l.id === 'lbc:C' || l.id === 'lbc:D' || l.id === 'lbc:E')
      ? ok('ni côté inconnu, ni achat, ni vente en cours ne comptent (§5)')
      : nok('seules les ventes PROUVÉES et finalisées comptent', r.lignes.map((l) => l.id).join(','));
    r.ecartees.some((e) => e.id === 'ebay:X3') && !r.lignes.some((l) => l.id === 'ebay:X2')
      ? ok('eBay : remboursée exclue, autre devise écartée et COMPTÉE à part (jamais convertie au hasard)')
      : nok('eBay : remboursée exclue, autre devise écartée', JSON.stringify(r.ecartees));
    const seul = ctxP.caDeclarableParMois(ctxP.ventesDeclarables({ vinted: VINTED, versements: VERS }).lignes)['2026-09'] || {};
    const avant = ctxP.caUrssafParMois(VINTED, null, VERS)['2026-09'] || {};
    seul.ca === avant.ca && seul.n === avant.n
      ? ok('l\'autre sens : sans Leboncoin ni eBay, le CA est exactement celui d\'avant')
      : nok('sans Leboncoin ni eBay, rien ne change', `${seul.ca} contre ${avant.ca}`);
  } catch (e) { nok('la règle toutes plateformes s\'exécute', e.message); }
  // L'écran Ventes publie la répartition ET ce qu'il ne sait pas.
  /ventesDeclarables\(\{ vinted: sales\.items, lbc: [^}]*ebay: [^}]*\}\)/.test(SRC) && /sources = \{ Vinted: 'lu', Leboncoin: lbcLu \? 'lu' : 'pasSu'/.test(SRC)
    ? ok('l\'écran Ventes publie toutes plateformes, avec ce qui n\'a pas pu être lu')
    : nok('l\'écran Ventes publie toutes plateformes', 'publication encore Vinted seule');
}

// ── 1 quater. LES COMPTES SÉLECTIONNÉS (Julien, 3 octobre) ──────────────────
//    « tu prends tous les comptes qu'on a sélectionnés ». Une vente d'un compte
//    EXCLU de l'app n'entre dans AUCUN total — ni un mois, ni « à dater ». Une
//    vente MASQUÉE d'un ✕ sur sa carte, elle, reste du chiffre d'affaires.
{
  const lbcSrc = (() => { const a = SRC.indexOf('const lbcAnnulee = '); const b = SRC.indexOf('\nconst lbcEuro', a); return a > 0 && b > a ? SRC.slice(a, b) : ''; })();
  const c = {
    console, Date, Number, String, isFinite, parseFloat, Object, Math, Array, load: (k, d) => d,
    classifyOrderStatus: (s) => /annul|cancel|refus|rembours/i.test(String(s || '')) ? 'cancelled' : (/finalis/i.test(String(s || '')) ? 'completed' : 'pending'),
    tsCommande: (o) => Date.parse((o && o.date) || '') || 0,
    montantCommande: (o) => { const p = o && o.price; const v = (p && typeof p === 'object') ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; },
  };
  try {
    vm.createContext(c);
    vm.runInContext(lbcSrc + '\n' + bloc + "\n;Object.assign(this, { ventesDeclarables, caDeclarableParMois });", c);
    const V = [
      { transaction_id: 21, date: '2026-09-02T12:00:00+02:00', price: { amount: '50.0' }, status: 'Commande finalisée', _acc: { vinted_user_id: 'garde' } },
      { transaction_id: 22, date: '2026-09-03T12:00:00+02:00', price: { amount: '70.0' }, status: 'Commande finalisée', _acc: { vinted_user_id: 'exclu' } },
      { transaction_id: 23, date: '2026-09-04T12:00:00+02:00', price: { amount: '30.0' }, status: 'Commande finalisée', _acc: { vinted_user_id: 'exclu' } },
      { transaction_id: 24, date: '2026-09-05T12:00:00+02:00', price: { amount: '20.0' }, status: 'Commande finalisée', _acc: { vinted_user_id: 'garde' } },
    ];
    const VERS = { 21: '2026-09-10T08:00:00+02:00', 22: '2026-09-11T08:00:00+02:00', 24: '2026-09-12T08:00:00+02:00' };
    const exclu = (o) => o._acc && o._acc.vinted_user_id === 'exclu';
    const masquee = (o) => String(o.transaction_id) === '24';
    const r = c.ventesDeclarables({ vinted: V, versements: VERS, exclu, masquee });
    const sept = c.caDeclarableParMois(r.lignes)['2026-09'] || {};
    sept.ca === 70 && sept.n === 2
      ? ok('une vente d\'un compte EXCLU de l\'app n\'entre pas dans le CA déclaré (70 €, pas 140 €)')
      : nok('un compte exclu ne compte pas', `ca=${sept.ca} n=${sept.n} au lieu de 70 / 2`);
    !r.aDater.some((x) => x.id === 'vinted:23')
      ? ok('…ni dans « à dater » (une vente sans date d\'un compte exclu ne gonfle rien)')
      : nok('un compte exclu ne va pas dans « à dater »', JSON.stringify(r.aDater.map((x) => x.id)));
    sept.nMasq === 1 && sept.caMasq === 20
      ? ok('l\'autre sens : une vente masquée d\'un ✕ reste comptée, à part (20 €)')
      : nok('une vente masquée reste comptée', `nMasq=${sept.nMasq} caMasq=${sept.caMasq}`);
  } catch (e) { nok('la règle des comptes sélectionnés s\'exécute', e.message); }
  // Les trois lecteurs de la règle l'appliquent : la publication, le mensuel, l'annuel.
  const pub = SRC.slice(SRC.indexOf('if (!sales.items) return;                       // rien de sûr à publier'), SRC.indexOf('const withBuyByNum'));
  // ⚠️ La règle, pas son orthographe : depuis le 4 octobre la publication lit le
  //    memo `declarables` (partagé avec Ma journée). On suit le nom jusqu'à sa
  //    définition au lieu d'exiger l'appel en place.
  const defDecl = (() => { const i = SRC.indexOf('const declarables = useMemo('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf('}, [', i)); })();
  const pubLit = /exclu: acctOffOf/.test(pub) || (/\bdeclarables\b/.test(pub) && /exclu: acctOffOf/.test(defDecl));
  pubLit
    ? ok('l\'écran Ventes publie le CA sans les comptes exclus')
    : nok('la publication écarte les comptes exclus', 'exclu absent');
  // Le memo SEUL, jusqu'à la fin de sa ligne de dépendances (d'autres memos
  // vivent entre lui et `openReport` depuis le 6 octobre).
  const memoDe = (debut) => { const i = SRC.indexOf(debut); if (i < 0) return ''; const j = SRC.indexOf('\n  }, [', i); return j < 0 ? '' : SRC.slice(i, SRC.indexOf('\n', j + 5)); };
  const mens = memoDe('const report = useMemo');
  const ann = memoDe('const annual = useMemo');
  // ⚠️ La règle, pas son orthographe (6 octobre) : les deux rapports lisent
  //    désormais le memo `declarables` (la même source que le tableau de bord).
  //    On suit le nom jusqu'à sa définition au lieu d'exiger la boucle en place.
  // ⚠️ (revue du 6 octobre) Les rapports lisent `declRapport`, qui DÉRIVE de
  //    `declarables` (dates de versement illisibles : il n'y ajoute que
  //    Leboncoin et eBay, sans aucune ligne Vinted). On suit le nom jusqu'à sa
  //    définition — la règle, pas son orthographe.
  const defRap = (() => { const i = SRC.indexOf('const declRapport = useMemo('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf(']);', i)); })();
  const rapDeriveDecl = /if \(declarables\) return \{ lignes: declarables\.lignes/.test(defRap) && !/ventesDeclarables\(\{ vinted:/.test(defRap);
  const boucleDecl = (t) => /for \(const l of \(declarables \? declarables\.lignes : \[\]\)\)/.test(t) || (/for \(const l of declRapport\.lignes\)/.test(t) && rapDeriveDecl);
  const litDecl = (t) => boucleDecl(t) && /\bdeclarables\]\);|\bdeclarables, |\bdeclRapport\]\);|\bdeclRapport, /.test(t.slice(t.lastIndexOf('}, [')));
  for (const [nom, t] of [['mensuel', mens], ['annuel', ann]]) {
    ((/if \(acctOffOf\(o\)\) continue;/.test(t) && !litDecl(t) && !/if \(isHidden\(o\)\) \{ nMasq/.test(t))
      || (litDecl(t) && /exclu: acctOffOf/.test(defDecl)))
      ? ok(`le rapport ${nom} ne compte que les comptes sélectionnés`)
      : nok(`le rapport ${nom} écarte les comptes exclus`, 'les ventes d\'un compte exclu y sont encore comptées');
  }
  (/ventesDeclarables\(\{ lbc:[^}]*ebay:[^}]*\}\)\.lignes/.test(ann) || (litDecl(ann) && /lbc: lbcLu/.test(defDecl) && /ebay: ebayCmd/.test(defDecl)))
    ? ok('le bilan annuel compte Leboncoin et eBay, comme les mois (la même règle)')
    : nok('le bilan annuel compte toutes les plateformes', 'Vinted seul');
}

// ── 1 ter. DATÉ AU JOUR DU VERSEMENT (Julien, 3 octobre) ───────────────────
//    « il faut dater la vente pour le CA du mois à la date de réception
//    d'argent ». On juge ce que la règle REND, jamais sa formulation.
{
  const lbcSrc = (() => { const a = SRC.indexOf('const lbcAnnulee = '); const b = SRC.indexOf('\nconst lbcEuro', a); return a > 0 && b > a ? SRC.slice(a, b) : ''; })();
  const c = {
    console, Date, Number, String, isFinite, parseFloat, Object, Math, Array, load: (k, d) => d,
    classifyOrderStatus: (s) => /annul|cancel|refus|rembours/i.test(String(s || '')) ? 'cancelled' : (/finalis/i.test(String(s || '')) ? 'completed' : 'pending'),
    tsCommande: (o) => Date.parse((o && o.date) || '') || 0,
    montantCommande: (o) => { const p = o && o.price; const v = (p && typeof p === 'object') ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; },
  };
  try {
    vm.createContext(c);
    vm.runInContext(lbcSrc + '\n' + bloc + "\n;Object.assign(this, { ventesDeclarables, caDeclarableParMois });", c);
    const V = [
      { transaction_id: 11, date: '2026-08-28T12:00:00+02:00', price: { amount: '90.0' }, status: 'Commande finalisée' },
      { transaction_id: 12, date: '2026-09-02T12:00:00+02:00', price: { amount: '40.0' }, status: 'Commande finalisée' },
      { transaction_id: 13, date: '2026-09-03T12:00:00+02:00', price: { amount: '25.0' }, status: 'Commande finalisée' },
    ];
    const VERS = { 11: '2026-09-05T08:00:00+02:00', 13: 'pas une date' };
    const r = c.ventesDeclarables({ vinted: V, versements: VERS });
    const mois = c.caDeclarableParMois(r.lignes);
    ((mois['2026-09'] || {}).ca === 90 && !mois['2026-08'])
      ? ok('une vente du 28 août versée le 5 septembre compte en SEPTEMBRE (mois du versement), pas en août')
      : nok('le mois est celui du versement', JSON.stringify(mois));
    const ad = r.aDater.filter((x) => x.plateforme === 'Vinted').map((x) => x.id).sort().join(',');
    ad === 'vinted:12,vinted:13' && r.aDater.every((x) => x.eur > 0)
      ? ok('une vente finalisée SANS date de versement (ou illisible) n\'entre dans aucun mois : « à dater », avec son montant')
      : nok('sans date de versement, la vente est « à dater »', ad);
    const sans = c.ventesDeclarables({ vinted: V });
    sans.lignes.length === 0 && sans.aDater.length === 3
      ? ok('aucune date de versement connue ⇒ aucun mois inventé (jamais la date de vente à la place)')
      : nok('aucune date de versement ⇒ aucun mois', `${sans.lignes.length} ligne(s)`);
  } catch (e) { nok('la règle du versement s\'exécute', e.message); }
  // La publication attend les dates, et n'invente rien si elles sont illisibles.
  (/if \(versements === null\) return;/.test(SRC)
    || ((() => { const i = SRC.indexOf('const declarables = useMemo('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf('}, [', i)); })().includes('if (versements === null) return null;')
        && /if \(!declarables\) return;/.test(SRC.slice(SRC.indexOf('if (!sales.items) return;                       // rien de sûr à publier'), SRC.indexOf('const withBuyByNum')))))
    ? ok('dates de versement illisibles ⇒ l\'écran Ventes ne publie RIEN (jamais un mois vidé)')
    : nok('dates illisibles ⇒ pas de publication', 'garde absente');
  // La source : uniquement le statut 450 (« commande finalisée ») et sa date.
  /status_updated_at/.test(SRC) && /String\(r\.s\) === '450'/.test(SRC)
    ? ok('la date de versement vient du statut 450 (commande finalisée), rien d\'autre')
    : nok('la date de versement vient du statut 450', 'lecture absente ou autre statut');
  // Les deux rapports datent au versement, pas à la vente.
  // Le memo SEUL, jusqu'à sa ligne de dépendances (6 octobre : d'autres memos
  // vivent désormais entre lui et `openReport`).
  const memoDe2 = (debut) => { const i = SRC.indexOf(debut); if (i < 0) return ''; const j = SRC.indexOf('\n  }, [', i); return j < 0 ? '' : SRC.slice(i, SRC.indexOf('\n', j + 5)); };
  const mens = memoDe2('const report = useMemo');
  const ann = memoDe2('const annual = useMemo');
  const defDecl2 = (() => { const i = SRC.indexOf('const declarables = useMemo('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf(']);', i)); })();
  const defRap2 = (() => { const i = SRC.indexOf('const declRapport = useMemo('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf(']);', i)); })();
  const litDecl2 = (t) => (/for \(const l of \(declarables \? declarables\.lignes : \[\]\)\)/.test(t)
      || (/for \(const l of declRapport\.lignes\)/.test(t) && /if \(declarables\) return \{ lignes: declarables\.lignes/.test(defRap2)))
    && /\bdeclarables\b|\bdeclRapport\b/.test(t.slice(t.lastIndexOf('}, [')));
  for (const [nom, t] of [['mensuel', mens], ['annuel', ann]]) {
    ((/versements\s*\?\s*versements\[String\(o\.transaction_id\)\]/.test(t) && /\bversements\]\);/.test(t))
      || (litDecl2(t) && /\bversements\b/.test(defDecl2) && /\bversements\b[^\]]*\]\);?\s*$/.test(defDecl2 + ']);')))
      ? ok(`le rapport ${nom} date au versement (et se recalcule quand les dates arrivent)`)
      : nok(`le rapport ${nom} date au versement`, 'lecture ou dépendance absente');
  }
  // L'extension va les chercher.
  const BG = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
  /async function capterDatesVersement\(uid\)/.test(BG) && /await capterDatesVersement\(uid\)/.test(BG)
    ? ok('l\'extension va chercher les dates de versement à chaque visite')
    : nok('l\'extension va chercher les dates de versement', 'fonction absente ou jamais appelée');
}

// ── 1 quinquies. « J'AI DÉCLARÉ CE MOIS » (6 octobre) ──────────────────────
//    Une vente déclarée compte dans le mois de sa DÉCLARATION, plus nulle part
//    ailleurs ; une vente arrivée après dans un mois déclaré est « à régulariser »
//    (jamais cachée) ; une vente déclarée deux fois compte une fois et le dit.
//    Et « pas su » (registre pas encore chargé) ne déplace RIEN.
//    On juge ce que la règle REND, dans un vm, sur le code de l'app.
{
  const lbcSrc = (() => { const a = SRC.indexOf('const lbcAnnulee = '); const b = SRC.indexOf('\nconst lbcEuro', a); return a > 0 && b > a ? SRC.slice(a, b) : ''; })();
  const c = {
    console, Date, Number, String, isFinite, parseFloat, Object, Math, Array, Map, Set, load: (k, d) => d,
    classifyOrderStatus: (s) => /annul|cancel|refus|rembours/i.test(String(s || '')) ? 'cancelled' : (/finalis/i.test(String(s || '')) ? 'completed' : 'pending'),
    tsCommande: (o) => Date.parse((o && o.date) || '') || 0,
    montantCommande: (o) => { const p = o && o.price; const v = (p && typeof p === 'object') ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; },
  };
  const essaie = (nom, f) => { try { f(); } catch (e) { nok(nom, 'a levé : ' + e.message); } };
  essaie('le registre des déclarations s\'exécute', () => {
    vm.createContext(c);
    vm.runInContext(lbcSrc + '\n' + bloc + "\n;Object.assign(this, { ventesDeclarables, caDeclarableParMois });", c);
    // 11 : vendue fin août, versée en septembre — déclarée en AOÛT (ancienne règle).
    // 14 : versée en août, absente de la déclaration d'août ⇒ à régulariser.
    // 15 : versée en septembre, rien de déclaré pour septembre ⇒ normale.
    // 16 : finalisée SANS date de versement, mais déclarée en août.
    const V = [
      { transaction_id: 11, date: '2026-08-28T12:00:00+02:00', price: { amount: '90.0' }, status: 'Commande finalisée' },
      { transaction_id: 14, date: '2026-08-02T12:00:00+02:00', price: { amount: '30.0' }, status: 'Commande finalisée' },
      { transaction_id: 15, date: '2026-09-02T12:00:00+02:00', price: { amount: '40.0' }, status: 'Commande finalisée' },
      { transaction_id: 16, date: '2026-08-20T12:00:00+02:00', price: { amount: '25.0' }, status: 'Commande finalisée' },
    ];
    const VERS = { 11: '2026-09-05T08:00:00+02:00', 14: '2026-08-12T08:00:00+02:00', 15: '2026-09-10T08:00:00+02:00' };
    const DECL = { '2026-08': { ids: ['vinted:11', 'vinted:16'], n: 2, ca: 115, regle: 'vente', at: 1 } };
    const r = c.ventesDeclarables({ vinted: V, versements: VERS, declare: DECL });
    const M = c.caDeclarableParMois(r.lignes);
    const aout = M['2026-08'] || {}, sept = M['2026-09'] || {};
    sept.ca === 40 && sept.n === 1
      ? ok('une vente DÉCLARÉE en août n\'est plus recomptée en septembre, même versée en septembre (40 €, pas 130 €)')
      : nok('une vente déclarée n\'est pas recomptée dans un autre mois', `septembre ca=${sept.ca} n=${sept.n} au lieu de 40 / 1`);
    aout.ca === 145 && aout.n === 3
      ? ok('…elle compte dans le mois où il l\'a déclarée (août : 90 + 30 + 25 = 145 €)')
      : nok('une vente déclarée compte dans le mois de sa déclaration', `août ca=${aout.ca} n=${aout.n} au lieu de 145 / 3`);
    sept.nAilleurs === 1 && sept.caAilleurs === 90
      ? ok('septembre DIT qu\'une vente versée chez lui est déjà déclarée ailleurs (90 €)')
      : nok('le mois du versement dit ce qui est déclaré ailleurs', `nAilleurs=${sept.nAilleurs} caAilleurs=${sept.caAilleurs}`);
    aout.nApres === 1 && aout.caApres === 30
      ? ok('une vente arrivée dans un mois déjà déclaré est « à régulariser » (30 €), comptée, jamais cachée')
      : nok('une vente arrivée après la déclaration est à régulariser', `nApres=${aout.nApres} caApres=${aout.caApres}`);
    !r.aDater.some((x) => x.id === 'vinted:16')
      ? ok('une vente sans date de versement mais DÉCLARÉE n\'est plus « à dater »')
      : nok('une vente déclarée sort de « à dater »', JSON.stringify(r.aDater.map((x) => x.id)));
    // Déclarée DEUX fois : comptée UNE fois, et signalée.
    const D2 = { '2026-08': { ids: ['vinted:11'] }, '2026-09': { ids: ['vinted:11', 'vinted:15'] } };
    const r2 = c.ventesDeclarables({ vinted: V, versements: VERS, declare: D2 });
    const M2 = c.caDeclarableParMois(r2.lignes);
    const tot2 = Object.values(M2).reduce((t, m) => t + m.ca, 0);
    const l11 = r2.lignes.filter((l) => l.id === 'vinted:11');
    l11.length === 1 && Array.isArray(l11[0].double) && Math.abs(tot2 - 160) < 0.001 && (M2['2026-08'] || {}).nDouble === 1
      ? ok('une vente déclarée dans DEUX mois compte une seule fois, et porte la marque « déclarée deux fois »')
      : nok('une vente déclarée deux fois compte une fois et le dit', `${l11.length} ligne(s), total ${tot2}`);
    // « Pas su » et l'autre sens.
    const base = JSON.stringify(c.caDeclarableParMois(c.ventesDeclarables({ vinted: V, versements: VERS }).lignes));
    const ps = c.ventesDeclarables({ vinted: V, versements: VERS, declare: null });
    JSON.stringify(c.caDeclarableParMois(ps.lignes)) === base && ps.declare === 'pasSu'
      ? ok('registre « pas su » (pas encore chargé) ⇒ rien n\'est déplacé, et la règle le dit (pasSu)')
      : nok('registre pas su ⇒ rien n\'est déplacé', ps.declare);
    const bizarre = c.ventesDeclarables({ vinted: V, versements: VERS, declare: ['vinted:11'] });
    JSON.stringify(c.caDeclarableParMois(bizarre.lignes)) === base
      ? ok('un registre illisible (pas un objet) ne déplace rien non plus')
      : nok('un registre illisible ne déplace rien');
    JSON.stringify(c.caDeclarableParMois(c.ventesDeclarables({ vinted: V, versements: VERS, declare: {} }).lignes)) === base
      ? ok('l\'autre sens : sans aucune déclaration, les mois sont exactement ceux d\'avant')
      : nok('sans déclaration, rien ne change');
  });
  // Le registre est synchronisé, lu « pas su » avant le nuage, et passé à la règle.
  /'vrm_urssaf_declare'/.test(SRC.slice(SRC.indexOf('const SYNC_KEYS'), SRC.indexOf('];', SRC.indexOf('const SYNC_KEYS'))))
    ? ok('le registre des déclarations est synchronisé entre appareils')
    : nok('le registre des déclarations est synchronisé', 'absent de SYNC_KEYS');
  /useState\(\(\) => isCloudReady\(\) \? lireDeclarations\(\) : null\)/.test(SRC) && /onCloudReady\(\(\) => setDeclUrssaf\(v => v == null \?/.test(SRC)
    ? ok('avant l\'arrivée du nuage, le registre vaut « pas su » (rien n\'est déplacé sur un appareil neuf)')
    : nok('le registre attend le nuage', 'lu au montage sans garde');
  const defD = (() => { const i = SRC.indexOf('const declarables = useMemo('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf(']);', i)); })();
  /declare: declUrssaf/.test(defD) && /\bdeclUrssaf$/.test(defD.trim())
    ? ok('la règle commune (tableau de bord, mensuel, annuel) reçoit le registre et se recalcule quand il change')
    : nok('la règle commune reçoit le registre', 'declare absent du memo declarables');
  // Jamais l'app ne coche « déclaré » à sa place : on n'écrit QUE dans les deux
  // gestes de son clic.
  const ecritures = [...SRC.matchAll(/save\('vrm_urssaf_declare'/g)].map((m) => m.index);
  const dansGeste = (i) => { const avant = SRC.slice(Math.max(0, i - 4000), i); const a = avant.lastIndexOf('const declarerMois = '), b = avant.lastIndexOf('const annulerDeclaration = '); const k = Math.max(a, b); return k >= 0 && !/\n  const (?!declarerMois|annulerDeclaration)\w+ = /.test(avant.slice(k + 10)); };
  ecritures.length === 2 && ecritures.every(dansGeste)
    ? ok('le registre ne s\'écrit que sur son clic (« J\'ai déclaré ce mois » / « retirer »), jamais tout seul')
    : nok('le registre ne s\'écrit que sur son clic', `${ecritures.length} écriture(s), hors geste : ${ecritures.filter((i) => !dansGeste(i)).length}`);
}

// ── 1 sexies. LA REVUE DU 6 OCTOBRE — chaque constat exécuté sur le VRAI code ─
{
  const lbcSrc = (() => { const a = SRC.indexOf('const lbcAnnulee = '); const b = SRC.indexOf('\nconst lbcEuro', a); return a > 0 && b > a ? SRC.slice(a, b) : ''; })();
  const c = {
    console, Date, Number, String, isFinite, parseFloat, Object, Math, Array, Map, Set, load: (k, d) => d,
    classifyOrderStatus: (s) => /annul|cancel|refus|rembours/i.test(String(s || '')) ? 'cancelled' : (/finalis/i.test(String(s || '')) ? 'completed' : 'pending'),
    tsCommande: (o) => Date.parse((o && o.date) || '') || 0,
    montantCommande: (o) => { const p = o && o.price; const v = (p && typeof p === 'object') ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; },
  };
  // ⚠️ Un audit ne meurt pas, il rapporte : tout ce qui lève devient un contrôle
  //    ROUGE (sur le code d'avant, `recuDuMois` et `lectureIncomplete` n'existent
  //    pas — ce qui compte, c'est que la RÈGLE fautive soit attrapée, prouvé en
  //    la réaffaiblissant : voir CLAUDE.md).
  const essaie = (nom, f) => { try { f(); } catch (e) { nok(nom, 'a levé : ' + e.message); } };
  try {
    vm.createContext(c);
    vm.runInContext(lbcSrc + '\n' + bloc + "\n;Object.assign(this, { ventesDeclarables, caDeclarableParMois, joursVenduRecu, ymDeTs });"
      + "\ntry { Object.assign(this, { recuDuMois, lectureIncomplete }); } catch (_) {}", c);
  } catch (e) { nok('la règle se charge', e.message); }

  // Constat 1 — mois déclaré « à la date de VENTE ».
  essaie('un mois déclaré à la date de vente', () => {
    // 30 ventes vendues le 25 août et versées le 4 septembre (le cas mesuré :
    // 657,80 €), 5 vendues et versées en septembre, 1 vente Leboncoin de
    // septembre (l'ancienne règle ne comptait que Vinted).
    const V = [], VERS = {};
    for (let n = 0; n < 30; n++) { V.push({ transaction_id: 1000 + n, date: '2026-08-25T12:00:00+02:00', price: { amount: '21.93' }, status: 'Commande finalisée' }); VERS[1000 + n] = '2026-09-04T10:00:00+02:00'; }
    for (let n = 0; n < 5; n++) { V.push({ transaction_id: 2000 + n, date: '2026-09-10T12:00:00+02:00', price: { amount: '40' }, status: 'Commande finalisée' }); VERS[2000 + n] = '2026-09-20T10:00:00+02:00'; }
    const LBC = [{ txId: 'L1', isSeller: true, price: 7500, stepLabel: 'Paiement effectué', dateVente: '2026-09-18T14:00:00+02:00', title: 'lbc' }];
    const SEPT_VENTE = { '2026-09': { ids: [2000, 2001, 2002, 2003, 2004].map((t) => 'vinted:' + t), n: 5, ca: 200, regle: 'vente', at: 1 } };
    const r = c.ventesDeclarables({ vinted: V, lbc: LBC, versements: VERS, declare: SEPT_VENTE });
    const s = c.caDeclarableParMois(r.lignes)['2026-09'] || {};
    const vApres = r.lignes.filter((l) => l.apres && l.plateforme === 'Vinted').length;
    vApres === 0
      ? ok('septembre déclaré À LA DATE DE VENTE : les 30 ventes vendues en août (versées en septembre) ne sont PAS « à régulariser »')
      : nok('déclaré à la date de vente, une vente vendue le mois d\'avant n\'est pas à régulariser', `${vApres} vente(s) Vinted « à régulariser » (cotisations payées deux fois)`);
    s.nVenteAvant === 30 && Math.abs(s.caVenteAvant - 657.9) < 0.005 && (s.venteAvant || {})['2026-08'] === 30
      ? ok('…elles sont comptées à part, avec leur mois de vente (août : 30 ventes, 657,90 €)')
      : nok('les ventes du mois de vente d\'avant sont dites à part', `nVenteAvant=${s.nVenteAvant} caVenteAvant=${s.caVenteAvant}`);
    s.nApres === 1 && Math.abs(s.caApres - 75) < 0.005
      ? ok('…et la vente Leboncoin de septembre, que l\'ancienne règle ne comptait pas, reste à régulariser (75 €)')
      : nok('la vente Leboncoin absente de la déclaration reste à régulariser', `nApres=${s.nApres} caApres=${s.caApres}`);
    Math.abs(s.ca - (657.9 + 200 + 75)) < 0.005
      ? ok('le CA du mois n\'en perd aucune (932,90 €)')
      : nok('le CA du mois reste entier', `ca=${s.ca}`);
    // L'autre sens : août noté AU VERSEMENT ne les contient pas (versées en
    // septembre) — elles ne sont dans AUCUNE déclaration : vraiment à régulariser.
    const DEUX = { ...SEPT_VENTE, '2026-08': { ids: [], n: 0, ca: 0, regle: 'versement', at: 1 } };
    const s2 = c.caDeclarableParMois(c.ventesDeclarables({ vinted: V, versements: VERS, declare: DEUX }).lignes)['2026-09'] || {};
    s2.nApres === 30 && !s2.nVenteAvant
      ? ok('l\'autre sens : leur mois de vente noté sans elles (au versement), elles sont dans AUCUNE déclaration — « à régulariser »')
      : nok('une vente dans aucune déclaration reste à régulariser', `nApres=${s2.nApres} nVenteAvant=${s2.nVenteAvant}`);
    // Et la règle « versement » ne change pas : absente de la liste = à régulariser.
    const VERSR = { '2026-09': { ids: [2000, 2001, 2002, 2003, 2004].map((t) => 'vinted:' + t), regle: 'versement', at: 1 } };
    const s3 = c.caDeclarableParMois(c.ventesDeclarables({ vinted: V, versements: VERS, declare: VERSR }).lignes)['2026-09'] || {};
    s3.nApres === 30 && !s3.nVenteAvant
      ? ok('déclaré AU VERSEMENT, une vente versée ce mois et absente de la liste reste à régulariser (la règle d\'avant ne bouge pas)')
      : nok('déclaré au versement, l\'absence reste un oubli', `nApres=${s3.nApres} nVenteAvant=${s3.nVenteAvant}`);
  });

  // Constat 5 — « Reçu en {mois} » se juge au mois du VERSEMENT.
  essaie('le reçu du mois', () => {
    const V5 = [{ transaction_id: 5, date: '2026-09-28T12:00:00+02:00', price: { amount: '80' }, status: 'Commande finalisée' },
      { transaction_id: 6, date: '2026-10-01T12:00:00+02:00', price: { amount: '20' }, status: 'Commande finalisée' }];
    const r5 = c.ventesDeclarables({ vinted: V5, versements: { 5: '2026-10-03T10:00:00+02:00', 6: '2026-10-04T10:00:00+02:00' }, declare: { '2026-09': { ids: ['vinted:5'], regle: 'vente', at: 1 } } });
    const J = c.joursVenduRecu([], r5.lignes, 14, Date.parse('2026-10-06T12:00:00+02:00'));
    const barres = J.filter((j) => j.cle.startsWith('2026-10')).reduce((a, j) => a + j.recu.eur, 0);
    const recu = c.recuDuMois(r5.lignes, '2026-10');
    recu === 100 && recu === barres
      ? ok('« Reçu en octobre » compte une vente versée en octobre et DÉCLARÉE en septembre — le même chiffre que les barres « reçu » (100 €)')
      : nok('« reçu » se juge au mois du versement, comme les barres', `reçu ${recu} · barres ${barres}`);
    c.recuDuMois(r5.lignes, '2026-09') === 0
      ? ok('…et pas en septembre (mois de sa déclaration, pas de son versement)')
      : nok('une vente déclarée n\'est pas « reçue » dans le mois de sa déclaration');
  });
  const journee = (() => { const i = SRC.indexOf('const recuMois = declarables'); return i < 0 ? '' : SRC.slice(i, SRC.indexOf('\n', i)); })();
  /recuDuMois\(declarables\.lignes/.test(journee) && !/l\.ym === ymIci/.test(journee)
    ? ok('Ma journée lit « Reçu en {mois} » par cette règle (jamais `l.ym`, le mois de déclaration)')
    : nok('Ma journée lit le reçu au mois du versement', journee.trim().slice(0, 120));
  /data-urssaf-ailleurs=\{/.test(SRC) && /urssafInfo && urssafInfo\.declare/.test(SRC) && /declare: v\.declare/.test(SRC)
    ? ok('la carte URSSAF du tableau de bord dit ce qui est déclaré ailleurs, et lit « registre pas su », de la ligne publiée')
    : nok('la carte URSSAF dit ce qui est déclaré ailleurs et lit declare:pasSu');

  // Constat 3 — on ne note pas une déclaration sur une lecture incomplète.
  essaie('la lecture complète', () => {
    const L = c.lectureIncomplete;
    const base = { registre: {}, ventes: [], ventesErreur: false, comptesEchec: [], versements: {}, lbc: true, ebay: [] };
    L(base) === null
      ? ok('tout est lu ⇒ rien ne bloque (l\'autre sens : le geste reste possible)')
      : nok('tout est lu ⇒ rien ne bloque', JSON.stringify(L(base)));
    const cas = [
      ['dates de versement illisibles', { versements: null }, 'rates'],
      ['dates de versement en cours', { versements: undefined }, 'enCours'],
      ['ventes Vinted pas encore lues', { ventes: null }, 'enCours'],
      ['ventes Vinted en erreur', { ventesErreur: true }, 'rates'],
      ['un compte non lu', { comptesEchec: ['compte_deux'] }, 'rates'],
      ['Leboncoin illisible', { lbc: null }, 'rates'],
      ['eBay illisible', { ebay: null }, 'rates'],
      ['registre pas encore chargé', { registre: null }, 'enCours'],
    ];
    const rates = cas.filter(([, d, ou]) => { const r = L({ ...base, ...d }); return !(r && r[ou] && r[ou].length); }).map(([n]) => n);
    rates.length === 0
      ? ok('lecture ratée OU partielle (dates, ventes, un compte, Leboncoin, eBay, registre) ⇒ « J\'ai déclaré ce mois » est bloqué, avec la cause')
      : nok('chaque lecture incomplète bloque la déclaration', rates.join(' · '));
  });
  const geste = (() => { const i = SRC.indexOf('const declarerMois = '); return i < 0 ? '' : SRC.slice(i, SRC.indexOf('\n  };', i)); })();
  const iGarde = geste.search(/lectureIncomplete\(/), iEcrit = geste.indexOf('setDeclUrssaf(');
  iGarde > 0 && iEcrit > iGarde && /if \(manque\b[^\n]*return; \}/.test(geste)
    ? ok('le GESTE refuse lui-même avant d\'écrire (pas seulement le bouton) : une lecture peut tomber formulaire ouvert')
    : nok('declarerMois refuse une lecture incomplète avant d\'écrire', 'garde absente ou après l\'écriture');
  /data-decl-ouvrir disabled=\{!!report\.incomplet\}/.test(SRC)
    ? ok('le bouton « J\'ai déclaré ce mois » est grisé par la même règle')
    : nok('le bouton est grisé par la même règle');

  // Constat 2 — dates illisibles : les rapports gardent Leboncoin et eBay.
  essaie('ce que lisent les rapports', () => {
    const i = SRC.indexOf('const declRapport = useMemo(');
    if (i < 0) throw new Error('declRapport introuvable');
    const j = SRC.indexOf('}, [declarables', i);
    const corps = SRC.slice(SRC.indexOf('() =>', i), j + 1);
    const run = (declarables, lbcLu, ebayCmd) => {
      c.__arg = { declarables, lbcLu, lbcVentes: { ventes: [{ txId: 'A', isSeller: true, price: 7500, stepLabel: 'Paiement effectué', dateVente: '2026-10-02T10:00:00+02:00', title: 'lbc' }] }, ebayCmd, declUrssaf: {} };
      return vm.runInContext(`(() => { const { declarables, lbcLu, lbcVentes, ebayCmd, declUrssaf } = __arg; return (${corps})(); })()`, c);
    };
    const EB = [{ orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: '2026-10-03T10:00:00.000Z', pricingSummary: { total: { value: '60.00', currency: 'EUR' } } }];
    const pasSu = run(null, true, EB);
    const tot = pasSu.lignes.reduce((a, l) => a + l.eur, 0);
    pasSu.vinted === 'passu' && tot === 135 && !pasSu.lignes.some((l) => l.plateforme === 'Vinted')
      ? ok('dates de versement illisibles : les rapports gardent Leboncoin et eBay (135 €) et PORTENT « Vinted pas su »')
      : nok('dates illisibles : Leboncoin et eBay restent, Vinted est dit absent', `vinted=${pasSu.vinted} total=${tot}`);
    const enc = run(undefined, true, EB);
    enc.vinted === 'encours' && enc.lignes.length === 0
      ? ok('pendant la lecture : « en cours », jamais un total à zéro présenté comme lu')
      : nok('pendant la lecture, l\'état est « en cours »', `vinted=${enc.vinted}`);
    const lu = run({ lignes: [{ id: 'x', eur: 1 }], aDater: [] }, true, EB);
    lu.vinted === 'lu' && lu.lignes.length === 1
      ? ok('l\'autre sens : lecture complète, les rapports lisent exactement `declarables`')
      : nok('lecture complète : les rapports lisent declarables', `vinted=${lu.vinted}`);
  });
  for (const [nom, deb] of [['mensuel', 'const report = useMemo'], ['annuel', 'const annual = useMemo']]) {
    const t = (() => { const i = SRC.indexOf(deb); const j = SRC.indexOf('\n  }, [', i); return i < 0 || j < 0 ? '' : SRC.slice(i, SRC.indexOf('\n', j + 5)); })();
    /for \(const l of declRapport\.lignes\)/.test(t) && /vinted: declRapport\.vinted/.test(t) && /\bdeclRapport\b/.test(t.slice(t.lastIndexOf('}, [')))
      ? ok(`le rapport ${nom} lit cette source, et rend l'état de Vinted`)
      : nok(`le rapport ${nom} lit declRapport et rend l'état de Vinted`);
  }
  /data-annuel-vinted=\{annual\.enCours/.test(SRC) && /data-rapport-vinted=\{report\.enCours/.test(SRC)
    ? ok('les deux rapports RENDENT « en cours » / « Vinted pas su » (le bilan annuel ne rendait pas `enCours`)')
    : nok('les deux rapports rendent l\'état de la lecture');
}

// ── 2. Les deux rapports n'écartent plus les ventes masquées ───────────────
const mensuel = SRC.slice(SRC.indexOf('const report = useMemo'), SRC.indexOf('const openReport'));
const annuel = SRC.slice(SRC.indexOf('const annual = useMemo'), SRC.indexOf('const openAnnual'));
for (const [nom, txt] of [['mensuel', mensuel], ['annuel', annuel]]) {
  if (!txt) { nok(`le rapport ${nom} est lisible`); continue; }
  /if \(isHidden\(o\)\) continue;/.test(txt)
    ? nok(`le rapport ${nom} n'écarte plus les ventes masquées`, 'il fait encore `if (isHidden(o)) continue;`')
    : ok(`le rapport ${nom} n'écarte plus les ventes masquées`);
  /nMasq\s*\+=\s*1/.test(txt)
    ? ok(`le rapport ${nom} compte les ventes masquées à part`)
    : nok(`le rapport ${nom} compte les ventes masquées à part`);
  /const taux = tauxUrssaf\(\)/.test(txt)
    ? ok(`le rapport ${nom} applique le taux réglable`)
    : nok(`le rapport ${nom} applique le taux réglable`, 'taux en dur');
}
// Le mélange de deux ensembles dans la marge annuelle (§5.84, jamais corrigé ici).
/const marge = margeKnown - frais;/.test(annuel)
  ? nok('la marge annuelle ne mélange pas deux ensembles', '`margeKnown - frais` : sous-ensemble moins le tout')
  : ok('la marge annuelle ne mélange pas deux ensembles');

// ── 2 bis. Le VOCABULAIRE : « encaissé » est faux tant qu'on date à la vente ─
// ⚠️ §5.57 a retiré la date d'encaissement de toute l'app (elle n'existe que
// pour une partie des ventes). Un rapport destiné à l'URSSAF qui annonce un
// « CA encaissé » alors qu'il somme par DATE DE VENTE ment sur un document
// officiel — et l'écart peut faire basculer une fin de mois.
const carteCA = /<StatBox label="CA[^"]*" value=\{[^\n]*?fmtE\((report|annual)\.ca\)\}/g;
const libelles = [...SRC.matchAll(carteCA)].map(m => m[0]);
libelles.length === 2
  ? (libelles.some(l => /encaiss/i.test(l))
      ? nok('les deux rapports ne disent plus « CA encaissé »', libelles.filter(l=>/encaiss/i.test(l)).join(' · '))
      : ok('les deux rapports annoncent « CA des ventes finalisées », pas « encaissé »'))
  : nok('les deux cartes de CA des rapports sont lisibles', libelles.length + ' trouvée(s)');
/datées au jour où la plateforme t'a <b>versé l'argent<\/b>/.test(SRC)
  ? ok("le tableau de bord DIT que ses ventes sont datées au jour du versement")
  : nok("le tableau de bord dit comment ses ventes sont datées", 'avertissement absent');

// ── 3. Le tableau de bord ne lit plus une archive vide ─────────────────────
/save\('vinted_urssaf_mois'/.test(SRC)
  ? ok("l'écran Ventes publie le récap mensuel (propriétaire unique de la règle)")
  : nok("l'écran Ventes publie le récap mensuel");
/load\('vinted_urssaf_mois'/.test(SRC)
  ? ok('le tableau de bord consomme ce récap au lieu de l\'archive vide')
  : nok('le tableau de bord consomme ce récap');

// ── 4. Plus aucun 13,5 % en dur sur un chemin URSSAF ───────────────────────
const enDur = SRC.split('\n')
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /(\*\s*0\.135|0\.135\s*\*|13,5\s*%|13,5%)/.test(l) && !/^\s*\/\//.test(l) && !/TAUX_URSSAF_DEFAUT/.test(l));
enDur.length
  ? nok('aucun taux de cotisations écrit en dur', enDur.map(([n]) => 'l.' + n).join(', '))
  : ok('aucun taux de cotisations écrit en dur');


// ────────────────────────────────────────────────────────────────────────────
// LE MOIS SE CHOISIT LIBREMENT, ET UN MOIS N'EST PAS COMPLET LE JOUR OÙ IL SE
// TERMINE (§5.85).
//
// La modale s'ouvrait sur le MOIS EN COURS : le 2 d'un mois, elle affichait
// 0 € et Julien croyait ses ventes disparues. Et le mois vivait dans un
// <select> : impossible d'atteindre un mois absent de la liste.
//
// Une vente Vinted se finalise ~2 semaines après. Mesuré le 3 septembre :
// août portait 110 ventes finalisées (3 345,20 €) ET 59 encore en cours
// (1 174,90 €). Le rapport les compte et le dit.
// ────────────────────────────────────────────────────────────────────────────
/derniersMoisDeclarables\s*=\s*useMemo\([\s\S]{0,400}venteFinalisee\(o\)/.test(SRC)
  ? ok("les mois déclarables sont ceux qui portent des ventes finalisées")
  : nok("les mois déclarables sont ceux qui portent des ventes finalisées");

/openReport\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,400}setReportMonth\(derniersMoisDeclarables\[0\]\)/.test(SRC)
  ? ok("le rapport s'ouvre sur le dernier mois déclarable, pas sur un mois vide")
  : nok("le rapport s'ouvre sur le dernier mois déclarable");

(/moisChoisiMain\s*=\s*useRef\(false\)/.test(SRC) &&
 /if\s*\(!moisChoisiMain\.current\s*&&/.test(SRC) &&
 /moisChoisiMain\.current=true/.test(SRC))
  ? ok("un mois choisi à la main n'est plus déplacé sous ses doigts")
  : nok("un mois choisi à la main n'est plus déplacé");

!/<select value=\{reportMonth\}/.test(SRC)
  ? ok("plus de menu déroulant pour le mois du rapport")
  : nok("le menu déroulant du mois est encore là");

!/const reportMonths\b/.test(SRC)
  ? ok("le helper mort `reportMonths` n'a pas été laissé dans le fichier")
  : nok("`reportMonths` traîne encore (piège pour la session suivante, §5.39)");

(/setReportAnnee/.test(SRC) && /MOIS_FR\.map\(\(nom,m\)=>/.test(SRC) &&
 /moisChoisiMain\.current=true;\s*setReportMonth\(ym\)/.test(SRC))
  ? ok("n'importe quel mois s'ouvre depuis la grille (année navigable)")
  : nok("n'importe quel mois s'ouvre depuis la grille");

/const futur = reportAnnee>now\.getFullYear\(\)/.test(SRC)
  ? ok("les mois à venir ne se déclarent pas")
  : nok("les mois à venir ne se déclarent pas");

(/let nMasq=0, caMasq=0, nAttente=0, caAttente=0;/.test(SRC) &&
 /nAttente\+=1;\s*caAttente\+=montantCommande\(o\);/.test(SRC))
  ? ok("les ventes du mois pas encore finalisées sont comptées (montantCommande : le prix est un objet)")
  : nok("les ventes du mois pas encore finalisées sont comptées");

/classifyOrderStatus\(o\.status\)!=='cancelled'\) \{ nAttente\+=1;/.test(SRC)
  ? ok("une annulée n'est jamais comptée comme « en attente »")
  : nok("une annulée n'est jamais comptée comme « en attente »");

(/report\.nAttente>0 && \(/.test(SRC) && /fmtE\(report\.caAttente\)/.test(SRC))
  ? ok("elles sont annoncées dans la modale, avec leur montant")
  : nok("elles sont annoncées dans la modale");

(/L\.push\(\[`Ventes de ce mois pas encore finalisees \(hors CA\)`/.test(SRC) &&
 /kv\('Ventes de ce mois pas encore finalisees \(hors CA\)'/.test(SRC))
  ? ok("le CSV et le PDF emportent la réserve avec eux")
  : nok("le CSV et le PDF emportent la réserve");

/if \(!venteFinalisee\(o\)\) \{/.test(SRC)
  ? ok("une vente non finalisée n'entre jamais dans le CA déclaré")
  : nok("une vente non finalisée n'entre jamais dans le CA déclaré");

// ⚠️ LE MOT « ENCAISSÉ » NE DOIT APPARAÎTRE DANS AUCUN LIBELLÉ VISIBLE.
// L'app date TOUT au jour de la vente : elle ne connaît pas la date à laquelle
// Vinted a versé l'argent. Or l'URSSAF demande légalement les recettes
// ENCAISSÉES — écrire ce mot sur un chiffre qui n'est pas ça, c'est induire une
// déclaration fausse. La règle avait déjà été posée une fois : elle a survécu
// dans le PDF du rapport, dans le tableau de bord et dans les réglages. Ce
// contrôle est là pour qu'elle ne se reperde pas une troisième fois.
{
  // On ne regarde QUE ce qui s'affiche. On retire donc D'ABORD tous les
  // commentaires du fichier — y compris les blocs JSX `{/* … */}`, qui servent
  // justement à expliquer la règle et diraient forcément le mot. Chaque bloc est
  // remplacé par des espaces pour que les numéros de ligne restent justes.
  const blanc = (m) => m.replace(/[^\n]/g, ' ');
  const sansCom = SRC
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blanc)
    .replace(/\/\*[\s\S]*?\*\//g, blanc)
    .replace(/^\s*\/\/.*$/gm, '')
    // …et ceux en fin de ligne. L'espace avant `//` épargne les URLs (`https://`).
    .replace(/\s\/\/[^\n]*$/gm, '');
  // ⚠️ Le mot doit être ACCENTUÉ : « encaisse » sans accent est un identifiant
  // interne (`type==='encaisse'`, `encaissees`). Le pister donnerait des faux
  // positifs, et un audit qui crie au loup n'est plus lu (§5.49).
  const fautes = [];
  sansCom.split('\n').forEach((l, i) => {
    if (/encaissé/i.test(l)) {
      fautes.push((i + 1) + ' : ' + l.trim().slice(0, 90));
    }
  });
  fautes.length === 0
    ? ok('aucun libellé visible ne dit « encaissé »')
    : nok('aucun libellé visible ne dit « encaissé »', fautes.slice(0, 4).join(' | '));
}

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nLe CA déclaré suit une seule règle, et rien n\'en est écarté en silence.');
process.exit(ko ? 1 : 0);
