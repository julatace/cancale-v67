// AUDIT — le bilan d'une période de l'écran Ventes (`bilanPeriode`, 15 octobre).
// Il EXÉCUTE la vraie règle (extraite d'App.jsx par NOM, avec ses vraies
// dépendances `ventesFaites` / `ventesDeclarables`) sur des ventes inventées :
//   1. un cas écrit à la main : vendu, finalisé, versé et chaque écart attendus ;
//   2. 400 jeux tirés au hasard × une période au hasard : vendu = finalisé + en
//      cours ; versé = Σ des lignes versées dans la période (date de VERSEMENT,
//      jamais le mois de déclaration) ; Σ écarts = versé − finalisé, au centime ;
//   3. « pas su » : versements en cours ⇒ `verse` undefined, illisibles ⇒ null —
//      jamais 0.
// `--prouve` rejoue l'audit sur la règle RÉAFFAIBLIE (versé au mois de
// déclaration · écarts sans identité · pas de minorant · « pas su » lu 0) : chaque
// mutation doit faire passer au moins un contrôle au ROUGE (§6.1).
// Lancer : node scripts/audit-bilan-periode.cjs [--prouve]
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
const grab = (name) => {
  const re = new RegExp('(?:^|\\n)((?:const|function)\\s+' + name + '\\b)');
  const m = re.exec(SRC); if (!m) throw new Error('introuvable : ' + name);
  const isConst = m[1].startsWith('const');
  let i = m.index + (SRC[m.index] === '\n' ? 1 : 0), depth = 0, started = false, j = i;
  for (; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[' || c === '(') { depth++; started = true; }
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (isConst && c === ';' && depth === 0 && started) { j++; break; }
    else if (isConst && c === '\n' && depth === 0 && started && /;\s*$/.test(SRC.slice(i, j))) break;
    if (!isConst && started && depth === 0 && c === '}') { j++; break; }
  }
  return SRC.slice(i, j);
};
const NOMS = ['classifyOrderStatus', 'tsCommande', 'montantCommande', 'lbcAnnulee', 'lbcFinalisee', 'venteFinalisee', 'ymDeTs',
  'indexDeclarations', 'moisDeclare', 'ventesDeclarables', 'ventesFaites', 'debutJour', 'finJour', 'dansPeriodeDate', 'VERSEMENT_MAX_J', 'bilanPeriode'];
const MUTATIONS = {
  versementAuMoisDeclare: ['if (l.ts && dans(l.ts)) { const c = cts(l.eur);', "if (l.ts && dans(Date.parse((l.ym || '') + '-15T12:00:00'))) { const c = cts(l.eur);"],
  ecartsSansIdentite: ['const tv = dateVente.get(id);', 'const tv = null;'],
  pasDeMinorant: ['ajoute(possibles, cts(l.eur));', 'void l;'],
  pasSuVautZero: ["if (declarables === undefined || declarables === null) return { ...base, verse: declarables, ecart: null, possibles: null };", "if (declarables === undefined) return { ...base, verse: declarables, ecart: null, possibles: null }; if (declarables === null) declarables = { lignes: [], aDater: [] };"],
};
const charger = (mutation) => {
  let code = NOMS.map(grab).join('\n');
  if (mutation) { const [a, b] = MUTATIONS[mutation]; if (!code.includes(a)) throw new Error('mutation inapplicable : ' + mutation); code = code.replace(a, b); }
  return new Function(code + '\nreturn { ventesFaites, ventesDeclarables, bilanPeriode, dansPeriodeDate };')();
};

const lancer = (mutation) => {
  let ok = 0, ko = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (!mutation || !c) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  const essaie = (m, f) => { try { f(); } catch (e) { dit(false, m, 'a levé : ' + String(e.message || e).slice(0, 120)); } };
  let R;
  try { R = charger(mutation); } catch (e) { dit(false, 'la règle se charge', e.message); return { ok, ko }; }
  const J = 86400e3, T0 = Date.parse('2026-10-15T12:00:00');
  const il = (n) => new Date(T0 - n * J);
  const vente = (id, prix, statut, d) => ({ transaction_id: id, title: 'P' + id, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), _acc: { vinted_user_id: '1' } });
  // ── 1. le cas écrit à la main (le même que le banc de rendu) ──
  essaie('cas à la main', () => {
    const V = [vente(1, 50, 'Commande finalisée', il(10)), vente(2, 80, 'Commande finalisée', il(12)), vente(3, 30, 'Commande finalisée', il(25)),
      vente(4, 45, 'Paiement validé', il(8)), vente(5, 65, 'Commande finalisée', il(9)), vente(6, 90, 'Commande annulée', il(11)), vente(7, 25.5, 'Commande finalisée', il(14))];
    const vers = { 1: il(6).toISOString(), 2: il(2).toISOString(), 3: il(15).toISOString(), 7: il(7).toISOString() };
    const lbc = [{ txId: 'L1', isSeller: true, price: 4000, stepLabel: 'Paiement effectué', dateVente: il(13).toISOString() }];
    const ebay = [{ orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: il(16).toISOString(), pricingSummary: { total: { value: '60.00', currency: 'EUR' } } }];
    const masq = (o) => String(o.transaction_id) === '7';
    const vendus = R.ventesFaites({ vinted: V, lbc, ebay, cachee: masq });
    const decl = R.ventesDeclarables({ vinted: V, lbc, ebay, masquee: masq, versements: vers });
    const b = R.bilanPeriode({ vendus, declarables: decl, periode: { from: il(20), to: il(5) } });
    dit(b.vendu.cts === 5000 + 8000 + 4500 + 6500 + 4000 + 6000, 'vendu : en cours comprises, annulée et masquée exclues, Leboncoin et eBay compris', b.vendu.cts);
    dit(b.fin.cts === 5000 + 8000 + 6500 + 4000 + 6000 && b.enCours.cts === 4500, 'finalisé et en cours', `${b.fin.cts} · ${b.enCours.cts}`);
    dit(b.verse && b.verse.cts === 5000 + 3000 + 2550 + 4000 + 6000, 'versé : au jour du versement (dont une vente d’avant, et la masquée)', b.verse && b.verse.cts);
    const ec = b.ecart || {};
    dit(ec.avant && ec.avant.cts === 3000, 'écart « vendue avant, versée dedans » = +30 €', ec.avant && ec.avant.cts);
    dit(ec.apres && ec.apres.cts === -8000, 'écart « versée après » = −80 €', ec.apres && ec.apres.cts);
    dit(ec.sansDate && ec.sansDate.cts === -6500, 'écart « sans date de versement » = −65 €', ec.sansDate && ec.sansDate.cts);
    dit(ec.masquees && ec.masquees.cts === 2550, 'écart « masquée » = +25,50 €', ec.masquees && ec.masquees.cts);
    dit(ec.autres && ec.autres.cts === 0, 'rien dans « autres » quand chaque vente a son identité', ec.autres && ec.autres.cts);
    dit(b.possibles && b.possibles.n === 1 && b.possibles.cts === 6500, 'la finalisée sans date ⇒ le versé est un minorant (« au moins »)', b.possibles && `${b.possibles.n} · ${b.possibles.cts}`);
    const u = R.bilanPeriode({ vendus, declarables: undefined, periode: { from: il(20), to: il(5) } });
    const n = R.bilanPeriode({ vendus, declarables: null, periode: { from: il(20), to: il(5) } });
    dit(u.verse === undefined && n.verse === null && n.ecart === null, '« pas su » : en cours ⇒ undefined, illisible ⇒ null — jamais 0', `${u.verse} · ${n.verse && n.verse.cts}`);
    dit(n.vendu.cts === b.vendu.cts, 'le vendu ne dépend pas des versements', n.vendu.cts);
  });
  // ── 2. au hasard ──
  essaie('au hasard', () => {
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const STATUTS = ['Commande finalisée', 'Commande finalisée', 'Paiement validé', 'Colis en transit', 'Commande annulée', 'Remboursée'];
    let mauvais = { somme: 0, vendu: 0, verse: 0, recompte: 0 }, vus = 0;
    for (let k = 0; k < 400; k++) {
      const V = [], vers = {}, decl = {};
      const nV = 1 + Math.floor(rnd() * 25);
      for (let i = 0; i < nV; i++) {
        const tx = k * 100 + i, d = il(Math.floor(rnd() * 90));
        const st = STATUTS[Math.floor(rnd() * STATUTS.length)];
        V.push(vente(tx, Math.round(rnd() * 15000) / 100, st, d));
        if (/finalis/.test(st) && rnd() < 0.7) vers[tx] = new Date(d.getTime() + Math.floor(rnd() * 25) * J + 3600e3).toISOString();
        if (/finalis/.test(st) && rnd() < 0.15) { const ym = '2026-0' + (7 + Math.floor(rnd() * 3)); (decl[ym] = decl[ym] || { ids: [] }).ids.push('vinted:' + tx); }
      }
      const lbc = rnd() < 0.5 ? [{ txId: 'L' + k, isSeller: true, price: 2500, stepLabel: 'Paiement effectué', dateVente: il(Math.floor(rnd() * 60)).toISOString() }] : [];
      const masques = new Set(V.filter(() => rnd() < 0.1).map((o) => String(o.transaction_id)));
      const masq = (o) => masques.has(String(o.transaction_id));
      const vendus = R.ventesFaites({ vinted: V, lbc, ebay: [], cachee: masq });
      const declarables = R.ventesDeclarables({ vinted: V, lbc, ebay: [], masquee: masq, versements: vers, declare: rnd() < 0.5 ? decl : undefined });
      const a = Math.floor(rnd() * 80), l = 1 + Math.floor(rnd() * 40);
      const periode = { from: il(a + l), to: il(a) };
      const b = R.bilanPeriode({ vendus, declarables, periode });
      const somme = Object.values(b.ecart).reduce((t, x) => t + x.cts, 0);
      if (somme !== b.verse.cts - b.fin.cts) mauvais.somme++;
      if (b.vendu.cts !== b.fin.cts + b.enCours.cts) mauvais.vendu++;
      const c = (e) => Math.round(Number(e) * 100);
      const attenduV = declarables.lignes.filter((x) => x.ts && R.dansPeriodeDate(x.ts, periode)).reduce((t, x) => t + c(x.eur), 0);
      if (attenduV !== b.verse.cts) mauvais.verse++;
      const attenduVendu = vendus.lignes.filter((x) => R.dansPeriodeDate(x.ts, periode)).reduce((t, x) => t + c(x.eur), 0);
      if (attenduVendu !== b.vendu.cts) mauvais.recompte++;
      if (b.verse.cts !== b.fin.cts) vus++;
    }
    dit(mauvais.somme === 0, 'Σ écarts = versé − finalisé, au centime (400 jeux)', `${mauvais.somme} faux`);
    dit(mauvais.vendu === 0, 'vendu = finalisé + en cours (400 jeux)', `${mauvais.vendu} faux`);
    dit(mauvais.verse === 0, 'versé = Σ des lignes versées dans la période, à la date du VERSEMENT (400 jeux)', `${mauvais.verse} faux`);
    dit(mauvais.recompte === 0, 'vendu = Σ de `ventesFaites` dans la période (400 jeux)', `${mauvais.recompte} faux`);
    dit(vus > 100, 'les jeux exercent vraiment un écart (sinon l’égalité ne prouve rien)', `${vus}/400`);
  });
  return { ok, ko };
};

if (process.argv.includes('--prouve')) {
  let tous = true;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(m);
    console.log(`${r.ko > 0 ? '✅' : '❌'} mutation « ${m} » : ${r.ko} contrôle(s) rouge(s)`);
    if (!r.ko) tous = false;
  }
  process.exit(tous ? 0 : 1);
} else {
  console.log('── bilanPeriode (la vraie règle, exécutée)');
  const r = lancer(null);
  console.log(`\n${r.ok} contrôle(s) OK, ${r.ko} en échec`);
  process.exit(r.ko ? 1 : 0);
}
