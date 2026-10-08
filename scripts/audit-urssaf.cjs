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
  const mens = SRC.slice(SRC.indexOf('const report = useMemo'), SRC.indexOf('const openReport'));
  const ann = SRC.slice(SRC.indexOf('const annual = useMemo'), SRC.indexOf('const openAnnual'));
  for (const [nom, t] of [['mensuel', mens], ['annuel', ann]]) {
    /if \(acctOffOf\(o\)\) continue;/.test(t) && !/if \(isHidden\(o\)\) \{ nMasq/.test(t)
      ? ok(`le rapport ${nom} ne compte que les comptes sélectionnés`)
      : nok(`le rapport ${nom} écarte les comptes exclus`, 'les ventes d\'un compte exclu y sont encore comptées');
  }
  /ventesDeclarables\(\{ lbc:[^}]*ebay:[^}]*\}\)\.lignes/.test(ann)
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
  const mens = SRC.slice(SRC.indexOf('const report = useMemo'), SRC.indexOf('const openReport'));
  const ann = SRC.slice(SRC.indexOf('const annual = useMemo'), SRC.indexOf('const openAnnual'));
  for (const [nom, t] of [['mensuel', mens], ['annuel', ann]]) {
    /versements\s*\?\s*versements\[String\(o\.transaction_id\)\]/.test(t) && /\bversements\]\);/.test(t)
      ? ok(`le rapport ${nom} date au versement (et se recalcule quand les dates arrivent)`)
      : nok(`le rapport ${nom} date au versement`, 'lecture ou dépendance absente');
  }
  // L'extension va les chercher.
  const BG = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
  /async function capterDatesVersement\(uid\)/.test(BG) && /await capterDatesVersement\(uid\)/.test(BG)
    ? ok('l\'extension va chercher les dates de versement à chaque visite')
    : nok('l\'extension va chercher les dates de versement', 'fonction absente ou jamais appelée');
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
