// ── LE RAPPEL URSSAF, CÔTÉ SERVEUR — UN MIROIR, PAS UNE COPIE (22 octobre) ────
// La notification du 1er (api/ship-reminders.js) tourne SANS l'app : elle ne
// peut pas importer src/App.jsx. Or la règle du rappel — quelle période,
// déjà notée « déclarée » ou non, quel montant — a UN propriétaire : l'app
// (`rappelUrssaf`, qui écrit aussi la ligne de Ma journée, §11).
//
// ⚠️ CE FICHIER N'EST PAS UNE SECONDE RÈGLE. Chaque déclaration ci-dessous est
//    le texte EXACT de sa jumelle dans src/App.jsx, fabriqué à partir d'elle.
//    `scripts/audit-rappel-urssaf.cjs` relit les deux avec l'analyseur Babel et
//    exige qu'elles soient IDENTIQUES au jeton près — puis les exécute sur les
//    mêmes dates et exige les mêmes résultats.
// ⚠️ NE RIEN MODIFIER ICI À LA MAIN : modifier App.jsx, puis refabriquer ce
//    fichier avec `node scripts/audit-rappel-urssaf.cjs --recopie`.
// Le serveur passe TOUJOURS le taux du vendeur (`tauxDe(main.vinted_urssaf_taux)`) ;
// ce repli n'existe que pour que les valeurs par défaut des règles recopiées
// (qui lisent le navigateur dans l'app) se chargent ici.
/* eslint-disable */
const tauxUrssaf = () => tauxDe(undefined);

export const TAUX_URSSAF_DEFAUT = 12.4;

export const tauxDe = (brut) => {
  const v = parseFloat(String(brut == null ? TAUX_URSSAF_DEFAUT : brut).replace(',', '.'));
  return (isFinite(v) && v >= 0 && v <= 50) ? v : TAUX_URSSAF_DEFAUT;
};

export const aPayerUrssaf = (ca, tauxPct = tauxUrssaf()) => {
  if (ca == null || !isFinite(Number(ca))) return null;
  const centimes = Math.round(Number(ca) * 100);
  return Math.round(Number((centimes * Number(tauxPct) / 100).toFixed(6))) / 100;
};

export const _startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };

export const nextUrssafDeadline = (freq, now = new Date()) => {
  const today = _startOfDay(now);
  const Y = now.getFullYear();
  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const mk = (dueDate, periodStart, periodEnd, label) => ({ dueDate, periodStart, periodEnd, label, daysLeft: Math.round((_startOfDay(dueDate) - today) / 86400000) });
  if (freq === 'mensuel') {
    for (let m = -2; m <= 2; m++) {
      const ps = new Date(Y, now.getMonth() + m, 1);
      const pe = new Date(ps.getFullYear(), ps.getMonth() + 1, 0);
      const due = new Date(ps.getFullYear(), ps.getMonth() + 2, 0); // dernier jour de M+1
      if (_startOfDay(due) >= today) return mk(due, ps, pe, `${MOIS[ps.getMonth()]} ${ps.getFullYear()}`);
    }
    return null;
  }
  // Trimestriel
  const cands = [
    mk(new Date(Y, 0, 31), new Date(Y-1, 9, 1), new Date(Y-1, 11, 31), `T4 ${Y-1}`),
    mk(new Date(Y, 3, 30), new Date(Y, 0, 1),  new Date(Y, 2, 31),  `T1 ${Y}`),
    mk(new Date(Y, 6, 31), new Date(Y, 3, 1),  new Date(Y, 5, 30),  `T2 ${Y}`),
    mk(new Date(Y, 9, 31), new Date(Y, 6, 1),  new Date(Y, 8, 30),  `T3 ${Y}`),
    mk(new Date(Y+1, 0, 31), new Date(Y, 9, 1), new Date(Y, 11, 31), `T4 ${Y}`),
  ];
  for (const c of cands) if (_startOfDay(c.dueDate) >= today) return c;
  return null;
};

export const moisPeriodeUrssaf = (due) => {
  const yms = [];
  if (!due) return yms;
  for (let d = new Date(due.periodStart.getFullYear(), due.periodStart.getMonth(), 1); d <= due.periodEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    yms.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return yms;
};

export const minuitParisMs = (a, m0, j) => {
  const base = Date.UTC(a, m0, j);
  const f = minuitParisMs._f || (minuitParisMs._f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }));
  const decalage = (ms) => {
    const o = {};
    for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
    return Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day), Number(o.hour) % 24, Number(o.minute)) - ms;
  };
  return base - decalage(base - decalage(base));
};

export const montantPeriodeUrssaf = (due, ligne, taux) => {
  if (!due || !ligne || !Array.isArray(ligne.mois)) return { ca: null, apayer: null, partiel: false };
  const yms = moisPeriodeUrssaf(due);
  const ca = Math.round(ligne.mois.reduce((s, m) => (m && yms.includes(m.ym)) ? s + (Number(m.ca) || 0) : s, 0) * 100) / 100;
  const atPub = typeof ligne.at === 'number' ? ligne.at : Date.parse(ligne.at || '');
  const debutPeriode = minuitParisMs(due.periodStart.getFullYear(), due.periodStart.getMonth(), due.periodStart.getDate());
  const finPeriode = minuitParisMs(due.periodEnd.getFullYear(), due.periodEnd.getMonth(), due.periodEnd.getDate() + 1);
  const partiel = !!(ligne.aDater && Number(ligne.aDater.n) > 0) || !(atPub >= finPeriode);
  // (22 oct., revue) Une ligne publiée AVANT le début de la période ne dit rien
  // d'elle ; une ligne qui n'en porte AUCUN mois et dont le total n'est qu'un
  // minimum (publiée avant la fin, date illisible, ventes sans date de
  // versement) non plus : « au moins 0,00 € » est un zéro qui veut dire « pas
  // su » (§7) ⇒ aucun montant (« se calcule dans Ventes »).
  const porte = ligne.mois.some((m) => m && yms.includes(m.ym));
  if (atPub < debutPeriode || (!porte && partiel)) return { ca: null, apayer: null, partiel: false };
  return { ca, apayer: aPayerUrssaf(ca, taux), partiel };
};

export const moisDeclare = (reg, ym) => !!(reg && typeof reg === 'object' && reg[ym] && Array.isArray(reg[ym].ids));

export const rappelUrssaf = ({ freq, now = new Date(), declare = null, ligne = null, taux = tauxUrssaf() } = {}) => {
  const due = nextUrssafDeadline(freq, now);
  if (!due) return null;
  if (_startOfDay(now) <= _startOfDay(due.periodEnd)) return null; // période pas finie : rien à déclarer encore
  const yms = moisPeriodeUrssaf(due);
  if (declare && typeof declare === 'object' && yms.length && yms.every((ym) => moisDeclare(declare, ym))) return null;
  const proche = due.daysLeft <= 7;
  if (!(now.getDate() <= 3 || proche)) return null;
  const { ca, apayer, partiel } = montantPeriodeUrssaf(due, ligne, taux);
  const date = due.dueDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const quand = due.daysLeft <= 0 ? "aujourd'hui" : due.daysLeft === 1 ? 'demain' : `dans ${due.daysLeft} jours`;
  const text = proche
    ? `Déclaration URSSAF ${due.label} à faire avant le ${date} (${quand})`
    : `Nouveau mois : déclaration URSSAF ${due.label} à faire avant le ${date}`;
  const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';
  const sub = apayer == null
    ? 'Le montant se calcule dans Ventes (ouvre-le une fois).'
    : `${partiel ? 'Au moins ' : ''}${eur(ca)} reçus · à payer ≈ ${partiel ? 'au moins ' : ''}${eur(apayer)}`;
  // (22 oct.) Les mois de la période qui ne sont PAS encore notés « déclaré » :
  // « C'est déclaré » (Ma journée, Comptabilité) ouvre le formulaire du rapport
  // comptable sur le premier — un seul formulaire, le sien (§11).
  const aNoter = yms.filter((ym) => !moisDeclare(declare, ym));
  return { text, sub, label: due.label, dueIso: `${due.dueDate.getFullYear()}-${String(due.dueDate.getMonth() + 1).padStart(2, '0')}-${String(due.dueDate.getDate()).padStart(2, '0')}`, daysLeft: due.daysLeft, ca, apayer, partiel, proche, mois: yms, aNoter };
};
