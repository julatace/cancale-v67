// ── LE BILAN DE LA SEMAINE (Julien, 5 octobre) ───────────────────────────────
// « Un bilan de la semaine en notification » : ventes et montant vendus, argent
// reçu, colis à expédier, paires qui dorment.
//
// ⚠️ QUAND : LE LUNDI MATIN, PAS LE DIMANCHE SOIR — et c'est un choix assumé.
//    Le seul cron du projet (`api/ship-reminders.js`, vercel.json) tourne une
//    fois par jour à 08:00 UTC, et le plan Hobby de Vercel ne garantit que
//    l'heure (± 59 min) : 10 h à Paris l'été, 9 h l'hiver. Un « bilan du
//    dimanche soir » envoyé dimanche à 10 h serait un bilan d'une semaine pas
//    finie présenté comme complet (§5). Le lundi matin, la semaine du lundi au
//    dimanche est TERMINÉE : le bilan dit des chiffres arrêtés. Ajouter un
//    second cron pour le dimanche soir est possible si le plan l'accepte — un
//    cron de trop refusé au déploiement bloquerait TOUS les déploiements
//    (le défaut #250 des 13 fonctions) : c'est à Julien de trancher, pas ici.
//    Rattrapage : si la base ne répondait pas le lundi, mardi et mercredi
//    réessaient (le mémo garantit UN bilan par semaine, jamais deux).
//
// ⚠️ LES RÈGLES NE SONT PAS ICI. « Vendu » = `ventesFaites`, « reçu » =
//    `ventesDeclarables` daté au versement — le miroir EXACT de l'app
//    (./ventes-regle.js, jugé par scripts/audit-bilan-semaine.cjs). Ce fichier ne
//    fait que borner la semaine (à l'heure de Paris) et ÉCRIRE le résultat.
//
// ⚠️ UN TOTAL PARTIEL PRÉSENTÉ COMME COMPLET EST PIRE QU'UN TOTAL ABSENT (§5).
//    Trois états pour chaque chiffre, jamais deux :
//      'su'      → le nombre, tel quel ;
//      'partiel' → « au moins N », ET ce qui manque, nommé ;
//      'pas-su'  → aucun nombre : « à voir dans l'app ».
//    Ce qui rend un total partiel, et qu'on NOMME :
//      · un compte lié jamais capté, ou dont la dernière capture des ventes est
//        antérieure à la fin de la semaine (ses ventes de la fin manquent) ;
//      · Leboncoin ou eBay illisibles ;
//      · des ventes Leboncoin sans date captées pendant la semaine ;
//      · pour le reçu : des ventes finalisées sans date de versement (elles
//        peuvent avoir été payées cette semaine — le dire, pas les deviner).
import { ventesFaites, ventesDeclarables, compteEcarte } from './ventes-regle.js';

const JOUR = 86400000;
const PARIS = 'Europe/Paris';

// L'heure qu'il est À PARIS à l'instant `t`, comme si c'était de l'UTC.
function murParis(t) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: PARIS, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t));
  const g = (k) => Number((p.find((x) => x.type === k) || {}).value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
}
// 'YYYY-MM-DD' (date de Paris) → l'instant UTC de minuit À PARIS ce jour-là.
// Deux passes : l'écart avec UTC change au passage heure d'été / heure d'hiver.
export function minuitParis(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const mur = Date.UTC(y, m - 1, d);
  let t = mur;
  for (let i = 0; i < 2; i++) t = mur - (murParis(t) - Math.floor(t / 1000) * 1000);
  return t;
}
export const dateParis = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: PARIS });
const plusJours = (ymd, k) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };

// La semaine TERMINÉE la plus récente (lundi 00:00 → lundi suivant 00:00, à
// Paris), et le jour d'aujourd'hui (1 = lundi … 7 = dimanche).
export function semainePassee(maintenant = Date.now()) {
  const auj = dateParis(maintenant);
  const [y, m, d] = auj.split('-').map(Number);
  const jour = ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
  const lundiCourant = plusJours(auj, -(jour - 1));
  const lundi = plusJours(lundiCourant, -7);
  return { lundi, dimanche: plusJours(lundiCourant, -1), debut: minuitParis(lundi), fin: minuitParis(lundiCourant), jour };
}

// tx → date du versement (statut 450, `status_updated_at`) — la MÊME condition
// que `fetchVersementsVinted` dans l'app (l'audit compare les deux textes).
export function versementsDeLignes(rows) {
  if (!Array.isArray(rows)) return null;
  const map = {};
  for (const r of rows) if (r && r.tx && String(r.s) === '450' && r.su && !isNaN(Date.parse(r.su))) map[String(r.tx)] = r.su;
  return map;
}

const jourCourt = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: PARIS, weekday: 'long' });
const dansSemaine = (ts, debut, fin) => ts >= debut && ts < fin;

// ── LE CALCUL ────────────────────────────────────────────────────────────────
// Entrées : chaque source vaut `null` quand sa lecture a ÉCHOUÉ (« pas su »),
// jamais `[]` à la place.
//   comptes   [{ uid, login }]                — les comptes Vinted liés
//   commandes { uid: { orders, cap } }        — `harvest_{uid}_orders_sold`
//   masquesTx, masquesComptes (Set), panneau  — ce que l'app écarte (son choix)
//   lbc [], ebay [], versements {}            — comme l'écran Ventes
//   colis (nombre), dorment ({ n, total, datesKnown, at })
export function calculerBilan(e) {
  const { debut, fin, maintenant = Date.now() } = e;
  const out = { vendu: { etat: 'pas-su', n: 0, eur: 0, manque: [] }, recu: { etat: 'pas-su', eur: 0, manque: [] }, colis: { etat: 'pas-su', n: null }, dorment: { etat: 'pas-su', n: null, auMoins: false } };
  const vintedLisible = Array.isArray(e.comptes) && e.commandes != null && e.masquesTx != null && e.masquesComptes != null && e.panneau != null;
  // Rien de lisible du tout : aucun nombre (le bilan ne part pas).
  if (!vintedLisible && !Array.isArray(e.lbc) && !Array.isArray(e.ebay)) return out;

  const manque = [];
  let vinted = [];
  if (vintedLisible) {
    const ecarte = (uid) => compteEcarte(uid, e.masquesComptes, e.panneau);
    const vusTx = new Set();
    for (const c of e.comptes) {
      const uid = String(c.uid);
      if (ecarte(uid)) continue;                 // SON choix : ni compté, ni réclamé
      const ligne = e.commandes[uid];
      const nom = c.login || uid;
      if (!ligne) { manque.push(`${nom} (jamais lu)`); continue; }
      const cap = Date.parse(ligne.cap || '');
      if (!cap) manque.push(`${nom} (date de lecture inconnue)`);
      else if (cap < fin) manque.push(`${nom} (lu ${jourCourt(cap)})`);
      for (const o of (Array.isArray(ligne.orders) ? ligne.orders : [])) {
        const id = String(o && (o.transaction_id != null ? o.transaction_id : o.id));
        if (vusTx.has(id)) continue; vusTx.add(id);
        vinted.push({ ...o, _acc: { vinted_user_id: uid } });
      }
    }
  } else manque.push('Vinted (illisible)');
  if (!Array.isArray(e.lbc)) manque.push('Leboncoin (illisible)');
  if (!Array.isArray(e.ebay)) manque.push('eBay (illisible)');
  // Une vente Leboncoin captée AVANT le lundi existait déjà : elle ne peut pas
  // être de cette semaine. On ne garde que les autres — la règle reste celle de
  // l'app, ce n'est qu'un tri sur la date de capture.
  const lbc = (e.lbc || []).filter((v) => !(Date.parse((v && v.at) || '') < debut));
  const ebay = e.ebay || [];
  const cachee = vintedLisible ? (o) => e.masquesTx.has(String(o && o.transaction_id)) || compteEcarte(o && o._acc && o._acc.vinted_user_id, e.masquesComptes, e.panneau) : () => false;

  // ── VENDU : `ventesFaites`, au jour de la VENTE ──
  const vf = ventesFaites({ vinted, lbc, ebay, cachee });
  let n = 0, eur = 0;
  for (const l of vf.lignes) if (dansSemaine(l.ts, debut, fin)) { n += 1; eur += l.eur; }
  const manqueVendu = [...manque];
  if (vf.sansDate) manqueVendu.push(`${vf.sansDate} vente${vf.sansDate > 1 ? 's' : ''} Leboncoin sans date`);
  out.vendu = { etat: manqueVendu.length ? 'partiel' : 'su', n, eur: Math.round(eur * 100) / 100, manque: manqueVendu };

  // ── REÇU : `ventesDeclarables`, au jour du VERSEMENT ──
  if (e.versements == null && vintedLisible) {
    out.recu = { etat: 'pas-su', eur: 0, manque: ['dates de versement illisibles'] };
  } else {
    const vd = ventesDeclarables({ vinted, lbc, ebay, exclu: vintedLisible ? (o) => compteEcarte(o && o._acc && o._acc.vinted_user_id, e.masquesComptes, e.panneau) : undefined, versements: e.versements || {} });
    let r = 0;
    for (const l of vd.lignes) if (dansSemaine(l.ts, debut, fin)) r += l.eur;
    const manqueRecu = [...manque];
    if (vd.aDater.length) manqueRecu.push(`${vd.aDater.length} vente${vd.aDater.length > 1 ? 's' : ''} finalisée${vd.aDater.length > 1 ? 's' : ''} sans date de versement`);
    out.recu = { etat: manqueRecu.length ? 'partiel' : 'su', eur: Math.round(r * 100) / 100, manque: manqueRecu };
  }

  // ── COLIS : le nombre que l'app et le widget appellent « à expédier » ──
  if (Number.isFinite(e.colis)) out.colis = { etat: 'su', n: e.colis };

  // ── QUI DORMENT : publié par l'écran Annonces (`vrm_paires_dorment`) ──
  // On ne le recalcule pas (§11). Plus de 8 jours, ce n'est plus une mesure.
  const d = e.dorment;
  if (d && Number.isFinite(d.n) && Number(d.datesKnown) > 0 && maintenant - (Number(d.at) || 0) < 8 * JOUR) {
    out.dorment = { etat: 'su', n: d.n, auMoins: Number(d.datesKnown) < Number(d.total) };
  }
  return out;
}

// Le bilan part s'il a quelque chose à dire : au moins un des deux chiffres
// d'argent est lisible. Tout illisible ⇒ on se tait et on réessaie demain.
export const bilanAEnvoyer = (b) => !!b && (b.vendu.etat !== 'pas-su' || b.recu.etat !== 'pas-su');

// ── LE TEXTE ─────────────────────────────────────────────────────────────────
const euros = (x) => `${Number(x).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(x)) ? 0 : 2, maximumFractionDigits: 2 })} €`;
const jourMois = (ymd) => new Date(minuitParis(ymd) + 12 * 3600000).toLocaleDateString('fr-FR', { timeZone: PARIS, day: 'numeric', month: 'short' });
const liste = (xs, max = 2) => xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} et ${xs.length - max} autre${xs.length - max > 1 ? 's' : ''}`;

export function texteBilan(b, sem) {
  const titre = `📊 Ta semaine du ${jourMois(sem.lundi)} au ${jourMois(sem.dimanche)}`;
  const l = [];
  const v = b.vendu;
  if (v.etat === 'pas-su') l.push("Vendu : je n'ai pas pu lire tes ventes — ouvre l'app.");
  else {
    const qte = v.n ? `${v.n} vente${v.n > 1 ? 's' : ''} · ${euros(v.eur)}` : 'aucune vente';
    l.push(v.etat === 'partiel'
      ? `Vendu : au moins ${qte} — sans ${liste(v.manque)}.`
      : `Vendu : ${qte}.`);
  }
  const r = b.recu;
  if (r.etat === 'pas-su') l.push("Reçu : à voir dans l'app.");
  else l.push(r.etat === 'partiel' ? `Reçu : au moins ${euros(r.eur)} (le détail dans l'app).` : `Reçu : ${euros(r.eur)}.`);
  if (b.colis.etat === 'su') l.push(b.colis.n ? `À expédier maintenant : ${b.colis.n} colis.` : 'Rien à expédier.');
  else l.push("À expédier : à voir dans l'app.");
  if (b.dorment.etat === 'su' && (b.dorment.n > 0 || !b.dorment.auMoins)) {
    l.push(b.dorment.n
      ? `${b.dorment.auMoins ? 'Au moins ' : ''}${b.dorment.n} paire${b.dorment.n > 1 ? 's' : ''} en ligne depuis plus de 30 jours.`
      : 'Aucune paire ne dort.');
  }
  return { titre, corps: l.join('\n') };
}
