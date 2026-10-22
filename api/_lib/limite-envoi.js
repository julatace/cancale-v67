// ════════════════════════════════════════════════════════════════════════════
//  LA DATE LIMITE D'ENVOI D'UNE VENTE — UNE RÈGLE, QUATRE LECTEURS (22 octobre)
// ════════════════════════════════════════════════════════════════════════════
// Lue par l'app (Colis, Ma journée, Ventes), le rappel du matin, le rappel du
// soir (api/ship-reminders.js) et le widget de l'iPhone (api/widget.js). Le
// serveur ne peut pas importer src/App.jsx ; l'app, elle, importe ce module
// (comme `colisEbay`, `etatColisDepuisTexte`) : il n'y a donc qu'UN texte de la
// règle (§11). Pur : aucune API Node, aucun React.
//
// MESURÉ sur sa base le 22 octobre (lecture seule) : 204 des 205 bordereaux
// reçus par email portent une date limite AVEC son heure, toujours sous la
// forme « JJ/MM/AAAA HH h MM » (90 à « 10 h 00 », aucune à « 23 h 59 ») — et
// l'heure était DÉJÀ gardée dans `dateLimite` par api/email-inbound.js. Ce sont
// les LECTEURS qui la jetaient (`frToIso`, `joursAvantLimiteFr` à 23:59:59) :
// une paire « à poster avant demain 10 h » s'affichait « demain », comme si le
// dépôt pouvait attendre le soir.
//
// Trois règles :
//   · l'heure n'est lue que sous une forme sans ambiguïté (« 10 h 00 », « 10h00 »,
//     « 10:00 ») ; sinon on revient au JOUR SEUL — le comportement d'avant,
//     limite à la fin de ce jour-là. Jamais une heure devinée ;
//   · l'heure est celle de PARIS (Vinted France), jamais celle de l'appareil ni
//     celle du serveur (UTC) — le passage à l'heure d'hiver est géré par Intl ;
//   · sans email de bordereau, la limite est ESTIMÉE : vente + 7 jours, jour
//     seul (mesuré : jamais moins de 7 jours sur 202 ventes reliées à leur
//     bordereau). On ne dit rien de ce que fait Vinted après l'heure limite :
//     on ne l'a pas mesuré.

export const DELAI_EXPEDITION_J = 7;
const FUSEAU = 'Europe/Paris';
const J = 86400000;

const _fmt = {};   // le formateur, créé une fois (un objet : aucune réassignation)
function partsParis(ms) {
  if (!_fmt.paris) _fmt.paris = new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = {};
  for (const p of _fmt.paris.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { date: `${o.year}-${o.month}-${o.day}`, heure: `${String((+o.hour) % 24).padStart(2, '0')}:${o.minute}` };
}
// Le jour 'AAAA-MM-JJ' à Paris d'un instant.
export const jourParis = (ms) => partsParis(ms).date;
// Le jour du calendrier décalé de `n` jours (pas « + 24 h » : un jour peut en durer 23 ou 25).
export const jourDecale = (jour, n) => {
  const [a, m, d] = String(jour).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};
// Écart en jours de calendrier entre deux jours 'AAAA-MM-JJ' (b − a).
const ecartJours = (a, b) => {
  const u = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((u(b) - u(a)) / J);
};
// « AAAA-MM-JJ » + heure de Paris → instant. `null` si l'heure n'existe pas ce
// jour-là (nuit du passage à l'heure d'été) ; la première des deux si elle
// existe deux fois (nuit du passage à l'heure d'hiver).
function instantParis(jour, h, mi) {
  const [a, m, d] = jour.split('-').map(Number);
  const base = Date.UTC(a, m - 1, d, h, mi);
  const voulu = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  const ok = [];
  for (const dec of [2, 1]) { const t = base - dec * 3600000; const p = partsParis(t); if (p.date === jour && p.heure === voulu) ok.push(t); }
  return ok.length ? Math.min(...ok) : null;
}
// La fin d'un jour de Paris (23:59:59,999) — la limite d'un « jour seul ».
// (Minuit existe toujours à Paris : le changement d'heure se fait à 2 h / 3 h.)
const finDuJour = (jour) => instantParis(jourDecale(jour, 1), 0, 0) - 1;

// « 23/10/2026 10 h 00 » → { jour: '2026-10-23', heure: '10:00', at }.
// Heure illisible ⇒ { jour, heure: null, at: fin de ce jour }. Pas de date ⇒ null.
export function lireDateLimite(s) {
  const t = String(s == null ? '' : s);
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (!m) return null;
  const jj = +m[1], mm = +m[2], aa = +m[3];
  const verif = new Date(Date.UTC(aa, mm - 1, jj));
  if (mm < 1 || mm > 12 || verif.getUTCDate() !== jj || verif.getUTCMonth() !== mm - 1) return null;
  const jour = `${m[3]}-${m[2]}-${m[1]}`;
  const reste = t.slice(m.index + m[0].length);
  const h = /^\s*(?:à\s*)?(\d{1,2})\s*(?:h|:)\s*(\d{2})(?!\d)/i.exec(reste);
  if (h) {
    const hh = +h[1], mi = +h[2];
    if (hh <= 23 && mi <= 59) {
      const at = instantParis(jour, hh, mi);
      if (at != null) return { jour, heure: `${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}`, at };
    }
  }
  return { jour, heure: null, at: finDuJour(jour) };
}

// La date limite d'envoi d'une vente : celle de l'email du bordereau quand on
// l'a (`b.dateLimite`), sinon vente + `DELAI_EXPEDITION_J`, jour seul, ESTIMÉE.
// Rend la forme que l'app lit depuis le 6 octobre ({ daysLeft, shipBy, limite })
// plus { jour, heure, at, depasse }. `daysLeft` : jours de calendrier (Paris)
// jusqu'au jour limite ; une limite DÉPASSÉE vaut au plus −1, même le jour même
// (« avant 10 h » et il est 11 h : c'est en retard).
export function limiteExpedition(o, b, maintenant = Date.now()) {
  let lim = b ? lireDateLimite(b.dateLimite) : null;
  let shipBy = null, limite = 'email';
  if (!lim) {
    const t = Date.parse((o && o.date) || '');
    if (!isFinite(t)) return { daysLeft: null, shipBy: null };
    shipBy = new Date(t + DELAI_EXPEDITION_J * J);
    const jour = jourParis(shipBy.getTime());
    lim = { jour, heure: null, at: finDuJour(jour) };
    limite = 'estimee';
  }
  const e = echeanceLimite(lim, maintenant);
  return { daysLeft: e.jours, shipBy, limite, jour: lim.jour, heure: lim.heure, at: lim.at, depasse: e.depasse };
}

// Où en est une limite à `maintenant` : jours de calendrier, dépassée ou non,
// et la classe que comptent les rappels (retard · aujourdhui · demain · plus).
export function echeanceLimite(lim, maintenant = Date.now()) {
  const ecart = ecartJours(jourParis(maintenant), lim.jour);
  const depasse = maintenant >= lim.at;
  const jours = depasse ? Math.min(ecart, -1) : ecart;
  return { jours, ecart, depasse, classe: depasse ? 'retard' : ecart === 0 ? 'aujourdhui' : ecart === 1 ? 'demain' : 'plus' };
}

// « 10:00 » → « 10 h » ; « 13:37 » → « 13 h 37 ».
export const heureCourte = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return '';
  return `${+m[1]} h${m[2] === '00' ? '' : ' ' + m[2]}`;
};
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jourCourt = (jour) => { const [, m, d] = jour.split('-').map(Number); return `${d} ${MOIS[m - 1]}`; };

// La phrase de la ligne d'un colis. Le CHIFFRE et l'HEURE lus, jamais une
// promesse sur ce que fait Vinted ensuite.
export function texteLimiteEnvoi(l, maintenant = Date.now()) {
  if (!l || !l.jour) return null;
  const e = echeanceLimite(l, maintenant);
  const H = l.heure ? heureCourte(l.heure) : '';
  if (e.depasse) return e.ecart === 0 && H ? `en retard — c'était avant ${H} aujourd'hui` : `${-e.jours} j de retard`;
  if (e.ecart === 0) return H ? `à poster avant ${H} aujourd'hui` : "à poster aujourd'hui";
  if (e.ecart === 1) return H ? `à poster avant demain ${H}` : 'à poster demain';
  return H ? `à poster avant le ${jourCourt(l.jour)} à ${H}` : `${e.ecart} j pour poster`;
}

// Le bordereau email de chaque transaction — la MÊME table que l'écran Colis :
// seulement les lignes qui portent leur PDF (`filename`), la plus récemment
// reçue d'abord, un bordereau masqué ne compte pas (`estCache`).
export function bordsParTransaction(bords, estCache) {
  const lignes = (Array.isArray(bords) ? bords : []).filter((b) => b && b.filename && b.filename !== 'None')
    .slice().sort((a, b) => (Date.parse(b.receivedAt || '') || 0) - (Date.parse(a.receivedAt || '') || 0));
  const m = {};
  for (const b of lignes) {
    if (b.transaction == null || (estCache && estCache(b))) continue;
    const k = String(b.transaction);
    if (!m[k]) m[k] = b;
  }
  return m;
}

// Compte les colis par échéance — le rappel du matin, le rappel du soir et le
// widget. `txs` : les transactions À EXPÉDIER (la règle `txsAExpedier`, jamais
// « imprimé » pris pour « parti ») ; `ventes` : { tx → vente } (sa date) ;
// `bords` : { tx → bordereau } (`bordsParTransaction`). Une vente dont on ne
// connaît ni le bordereau ni la date n'est classée nulle part (`sansLimite`).
// `premier` : la limite la plus proche de chaque classe (son heure, si lue) ;
// `estimees` : combien, dans chaque classe, n'ont qu'une date ESTIMÉE.
export function compterEcheances({ txs, ventes, bords, maintenant = Date.now() }) {
  const out = { retard: 0, aujourdhui: 0, demain: 0, plus: 0, sansLimite: 0, premier: {}, estimees: { retard: 0, aujourdhui: 0, demain: 0, plus: 0 } };
  for (const tx of (txs || [])) {
    const k = String(tx);
    const l = limiteExpedition((ventes && ventes[k]) || null, (bords && bords[k]) || null, maintenant);
    if (l.at == null) { out.sansLimite++; continue; }
    const c = echeanceLimite(l, maintenant).classe;
    out[c]++;
    if (l.limite === 'estimee') out.estimees[c]++;
    if (!out.premier[c] || l.at < out.premier[c].at) out.premier[c] = { at: l.at, heure: l.heure, jour: l.jour, limite: l.limite };
  }
  return out;
}
