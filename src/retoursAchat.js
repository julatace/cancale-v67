// ════════════════════════════════════════════════════════════════════════════
//  LES RETOURS D'ACHATS — IL RENVOIE UN ARTICLE (11 nov., lot retours-litiges)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « pour les retours on doit avoir les bordereaux à imprimer aussi ».
// Une CARTE par bordereau de retour reçu par e-mail (`email_bordretour_{tx}`,
// api/_lib/retour-email.js) : l'achat relié par SON n° de transaction (jamais le
// titre, §5), le N° de la paire s'il en a un (par l'achat), la date limite de dépôt
// LUE (sinon « non lue »), le suivi du colis de retour (trois états), et le
// remboursement : PROUVÉ (e-mail « a été remboursée » du même n°, ou statut de
// l'achat) sinon « Pas encore remboursé » — jamais un montant inventé.
// Et `avecRemboursementsProuves` : un achat dont le remboursement est PROUVÉ par
// e-mail (même n°, montant ≥ ce qu'il a payé) sort des coûts tout de suite (son
// statut devient celui que Vinted écrira : « Remboursement effectué »), sans
// attendre la prochaine lecture de ses achats. Remboursement partiel ⇒ rien ne
// bouge (le coût reste ; la carte le dit).
// Module PUR. Exécuté par scripts/audit-retours-litiges.cjs.

const str = (v) => String(v == null ? '' : v);
export const RETOUR_PRESSE_H = 48;
export const RETOUR_ANCIEN_J = 30;
const RE_REMB = /rembours/i;
const RE_SANS_COUT = /annul|rembours|refus/i;

// Les remboursements prouvés par e-mail, par n° de transaction (le plus récent gagne).
export function remboursementsParTx(remb) {
  if (!Array.isArray(remb)) return remb === null ? null : undefined;
  const m = new Map();
  for (const r of remb) {
    const tx = str(r && (r.tx || r.transaction)).trim();
    const montant = r && r.montant != null && r.montant !== '' ? Number(r.montant) : NaN;
    if (!tx || !isFinite(montant)) continue;
    const p = m.get(tx);
    if (!p || str(r.at || r.receivedAt) > str(p.at)) m.set(tx, { tx, montant: Math.round(montant * 100) / 100, estime: str(r.estime), at: str(r.at || r.receivedAt) });
  }
  return m;
}

// `montantDe(o)` : ce qu'il a payé (en €) ou null (pas lu ⇒ rien ne bouge).
export function avecRemboursementsProuves(achats, remb, montantDe) {
  const parTx = remb instanceof Map ? remb : remboursementsParTx(remb);
  if (!Array.isArray(achats) || !(parTx instanceof Map) || !parTx.size) return achats;
  let change = false;
  const out = achats.map((o) => {
    if (!o || o.transaction_id == null || RE_SANS_COUT.test(str(o.status))) return o;
    const r = parTx.get(str(o.transaction_id));
    if (!r) return o;
    const paye = typeof montantDe === 'function' ? montantDe(o) : null;
    if (paye == null || !isFinite(paye) || r.montant + 0.005 < paye) return o;   // partiel ou pas su : rien ne bouge
    change = true;
    return { ...o, status: 'Remboursement effectué', _rembourseEmail: { montant: r.montant, at: r.at } };
  });
  return change ? out : achats;
}

const jourCourt = (iso) => { const t = Date.parse(str(iso)); if (!isFinite(t)) return null; try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }); } catch (_) { return null; } };

// bords  : lignes `email_bordretour_*` projetées ({ tx, suivi, dateLimiteIso, article, uid, account, at, pdf })
// achats : ses achats Vinted (`undefined` pas lu · `null` pas su)
// remb   : lignes `email_rembachat_*` ({ tx, montant, estime, at }) — mêmes trois états
// transp : Map n° de suivi → { libelle } (`undefined` en cours · `null` pas su)
// numeroDe(tx) : le N° de la paire reliée à CET achat (par SON clic), ou ''
// montantDe(o) : ce qu'il a payé, ou null
export function retoursAchat({ bords, achats, remb, transp, numeroDe = null, montantDe = null, maintenant } = {}) {
  const now = isFinite(maintenant) ? maintenant : Date.now();
  if (bords === undefined) return { etat: 'encours', cartes: [], anciennes: [], manques: [] };
  if (bords === null) return { etat: 'passu', cartes: [], anciennes: [], manques: ['tes bordereaux de retour'] };
  const manques = [];
  if (achats === null) manques.push('tes achats Vinted');
  if (remb === null) manques.push('les e-mails de remboursement');
  const parTx = remboursementsParTx(remb);
  const A = new Map();
  for (const o of (Array.isArray(achats) ? achats : [])) if (o && o.transaction_id != null) A.set(str(o.transaction_id), o);
  const vus = new Set(), cartes = [], anciennes = [];
  const tries = [...bords].filter(Boolean).sort((a, b) => str(b.at || b.receivedAt).localeCompare(str(a.at || a.receivedAt)));
  for (const b of tries) {
    const tx = str(b.tx || b.transaction).trim();
    if (!tx || vus.has(tx)) continue;
    vus.add(tx);
    const o = A.get(tx) || null;
    const lm = Date.parse(str(b.dateLimiteIso));
    const limiteIso = isFinite(lm) ? new Date(lm).toISOString() : null;
    const depassee = limiteIso != null && now > lm;
    const presse = limiteIso != null && !depassee && lm - now < RETOUR_PRESSE_H * 3600000;
    const suivi = str(b.suivi).trim();
    let statut;
    if (!suivi) statut = { etat: 'aucun' };
    else if (transp === undefined) statut = { etat: 'encours', n: suivi };
    else if (transp === null) statut = { etat: 'passu', n: suivi };
    else { const t = transp && typeof transp.get === 'function' ? transp.get(suivi) : null; const l = t ? str(t.libelle).trim() : ''; statut = l ? { etat: 'ok', n: suivi, libelle: l } : { etat: 'ok', n: suivi, libelle: '' }; }
    // Le remboursement : PROUVÉ (e-mail du même n°, puis statut de l'achat), sinon pas encore.
    let rembourse;
    const r = parTx instanceof Map ? parTx.get(tx) : null;
    const paye = o && typeof montantDe === 'function' ? montantDe(o) : null;
    if (r) rembourse = { etat: 'oui', montant: r.montant, source: 'email', at: r.at, estime: r.estime || '', partiel: paye != null && isFinite(paye) && r.montant + 0.005 < paye };
    else if (o && RE_REMB.test(str(o.status))) rembourse = { etat: 'oui', montant: null, source: 'statut', partiel: false };
    else if (remb === null || (achats === null && !o)) rembourse = { etat: 'passu' };
    else rembourse = { etat: 'non' };
    const num = typeof numeroDe === 'function' ? str(numeroDe(tx)).trim() : '';
    const c = {
      cle: 'r:' + tx, tx, achat: o, titre: str((o && o.title) || b.article), num,
      limiteIso, limiteTexte: jourCourt(limiteIso), heure: str(b.dateLimite).split(' ').slice(1).join(' ').trim(), presse, depassee,
      suivi, statut, rembourse, uid: str(b.uid || (o && o._acc && o._acc.vinted_user_id) || ''), compte: str(b.account || ''),
      pdf: b.pdf !== false, relie: !!o,
    };
    const age = (now - (Date.parse(str(b.at || b.receivedAt)) || now)) / 86400000;
    (rembourse.etat === 'oui' && age > RETOUR_ANCIEN_J ? anciennes : cartes).push(c);
  }
  // À déposer d'abord (date la plus proche), puis remboursés.
  const rang = (c) => (c.rembourse.etat === 'oui' ? 2e15 : 0) + (c.depassee ? 1e15 : 0) + (c.limiteIso ? Date.parse(c.limiteIso) : 1e14);
  cartes.sort((a, b) => rang(a) - rang(b));
  return { etat: 'lu', cartes, anciennes, manques };
}

// Ce que le tampon écrit sur le bordereau de retour (une règle, imprimée et testée).
export const lignesTamponRetour = ({ num, titre } = {}) => {
  const n = str(num).trim();
  return { haut: n ? `RETOUR · N°${n}` : 'RETOUR', bas: str(titre).replace(/\s+/g, ' ').trim().slice(0, 60) };
};
