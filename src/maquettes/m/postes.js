// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE M — « UNE MAIN » : les comptes de chaque écran, repris TELS QUELS des postes de la maquette H.
//  Chaque poste dit d'abord « ce qu'il y a à faire maintenant », sur les identités du modèle
//  (donnees.js) : un N° par l'id de SON annonce, une vente par son `item_id`, un bordereau par
//  le n° de transaction, un achat par `buyFromId` (posé par SON clic), un colis par l'e-mail
//  du transporteur. Jamais par titre (§5). Une source pas lue reste `null` (l'écran dit « — »).
// ════════════════════════════════════════════════════════════════════════════
import { centimes } from '../../rechercheUnique.js';

const str = (v) => String(v == null ? '' : v);
const J = 86400000;

export function postes(m, { porteMonnaie = null, txns = null } = {}, maintenant = m.maintenant || Date.now()) {
  const paires = [...m.paires.values()];
  const achatRelie = new Set(paires.map((p) => str(p.fiche && p.fiche.buyFromId)).filter(Boolean));

  // ── RECEVOIR ── les colis au point (preuve : l'e-mail du transporteur dit « disponible »), UN POINT = UNE CARTE ;
  // les achats en route ; les achats arrivés (« Commande finalisée », 14 derniers jours) qu'aucune fiche ne relie
  // encore par SON n° de transaction : la paire est dans le colis, elle attend son N° et sa case.
  const aRetirer = m.listes.retirer.lignes;
  let points = null;
  if (aRetirer) {
    const g = new Map();
    for (const c of aRetirer) {
      const l = (c.lieu || '').split('\n');
      const nom = l[0] || '';
      if (!g.has(nom)) g.set(nom, { nom, adresse: l.slice(1).join(' · '), colis: [] });
      g.get(nom).colis.push(c);
    }
    points = [...g.values()].map((p) => ({ ...p, limite: Math.min(...p.colis.map((c) => Date.parse(c.limite) || 9e15)) })).sort((a, b) => a.limite - b.limite);
  }
  const enRoute = m.achats ? m.achats.filter((a) => !/finalis|rembours|annul/i.test(str(a.status))) : null;
  const arrives = m.achats ? m.achats.filter((a) => /finalis/i.test(str(a.status)) && !achatRelie.has(a._tx) && maintenant - (Date.parse(a.date) || 0) < 14 * J)
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)) : null;

  // ── RANGER ── les paires numérotées, pas vendues, sans case notée ; les cases et ce qu'elles portent.
  const presentes = paires.filter((p) => !p.vente);
  const sansCase = presentes.filter((p) => !p.cases.length).sort((a, b) => (Date.parse(str(b.fiche && b.fiche.numberedAt)) || 0) - (Date.parse(str(a.fiche && a.fiche.numberedAt)) || 0));
  const cases = new Map();
  for (const p of presentes) for (const c of p.cases) { if (!cases.has(c)) cases.set(c, { nom: c, nums: [] }); cases.get(c).nums.push(p.numero); }
  // Deux annonces OUVERTES distinctes sous un même N° : le seul rouge de l'app (§5, §7).
  const doublons = presentes.filter((p) => p.annonces.filter((a) => a.ouverte).length > 1);

  // ── PUBLIER ── rangée (une case), pas vendue, aucune annonce ouverte ⇒ à mettre en ligne ;
  // en ligne depuis plus de 60 j ⇒ qui dorment ; en ligne sans N° ⇒ à numéroter.
  const aPublier = presentes.filter((p) => p.cases.length && !p.annonces.some((a) => a.ouverte));
  const enLigne = m.annonces;
  const dorment = m.listes.dorment.lignes;
  const sansNumero = enLigne ? enLigne.filter((a) => !m.numParItem.has(a.id)) : null;

  // ── EMBALLER & POSTER ── à imprimer (bordereau reçu), en attente du bordereau ; les dépôts par transporteur.
  const envoyer = m.listes.envoyer.lignes;
  const aImprimer = envoyer ? envoyer.filter((l) => l.bord) : null;
  const sansBord = envoyer ? envoyer.filter((l) => !l.bord) : null;

  // ── ENCAISSER ── le solde que Vinted annonce (disponible, en attente) ; la date de VERSEMENT (450) fait foi.
  const solde = porteMonnaie ? porteMonnaie.reduce((t, r) => ({ dispo: t.dispo + (centimes(r.dispo) || 0), attente: t.attente + (centimes(r.attente) || 0), n: t.n + 1 }), { dispo: 0, attente: 0, n: 0 }) : null;
  const verseLe = txns ? new Map(txns.filter((t) => Number(t.st) === 450 && t.at).map((t) => [str(t.id).replace(/^.*_txn_/, ''), t.at])) : null;
  const d0 = new Date(maintenant); const debutMois = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
  const versees = m.ventes && verseLe ? m.ventes.filter((v) => verseLe.has(v._tx))
    .map((v) => ({ v, le: verseLe.get(v._tx), paire: m.numParItem.has(v._item) ? m.paires.get(m.numParItem.get(v._item)) : null }))
    .sort((a, b) => Date.parse(b.le) - Date.parse(a.le)) : null;
  const ceMois = versees ? versees.filter((x) => Date.parse(x.le) >= debutMois) : null;
  const recuMois = ceMois ? ceMois.reduce((t, x) => t + (centimes(x.v.price) || 0), 0) : null;
  const vendues = paires.filter((p) => p.vente);
  const sansCout = vendues.filter((p) => p.cout == null);

  return {
    recevoir: { points, aRetirer, enRoute, arrives, nAFaire: aRetirer && arrives ? aRetirer.length + arrives.length : null },
    ranger: { sansCase, cases: [...cases.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true })), presentes: presentes.length, doublons, nAFaire: sansCase.length },
    publier: { aPublier, enLigne, dorment, sansNumero, nAFaire: aPublier.length },
    poster: { envoyer, aImprimer, sansBord, nAFaire: envoyer ? envoyer.length : null },
    encaisser: { solde, versees, ceMois, recuMois, vendues: vendues.length, sansCout, nAFaire: sansCout.length },
  };
}
