// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE N — « ZÉRO À FAIRE » : LA BOÎTE (17 nov., prototype de banc, PAS livré).
//  Chaque chose à faire aujourd'hui = UNE carte = UN geste. Les cartes se calculent sur les
//  identités du modèle (donnees.js / postes.js, repris de H) : un bordereau par son n° de
//  transaction, un colis par l'e-mail du transporteur (UN POINT = UNE CARTE), une offre par SA
//  conversation, un prix d'achat manquant par le N° de la paire vendue. Jamais par titre (§5).
//  Une source pas lue ⇒ `null` : la boîte le dit (« — »), elle ne se dit jamais « vide » à tort.
// ════════════════════════════════════════════════════════════════════════════
import { centimes } from '../../rechercheUnique.js';

const J = 86400000;
const str = (v) => String(v == null ? '' : v);
const jourParis = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

export function boite(M, maintenant = M.maintenant || Date.now()) {
  const P = M.postes;
  const sources = { envoyer: P.poster.envoyer, retirer: P.recevoir.aRetirer, offres: M.offres, ventes: M.ventes };
  const pasLu = Object.entries(sources).filter(([, v]) => v == null).map(([k]) => k);
  const cartes = [];

  // ── DEUX PAIRES SOUS UN N° : le seul rouge (§5). Elle passe avant tout. ──
  for (const p of P.ranger.doublons || []) cartes.push({ cle: 'doublon-' + p.k, sorte: 'doublon', echeance: 0, numero: p.numero, titre: `Deux annonces sous le N° ${p.numero}`, photos: p.annonces.filter((a) => a.ouverte).map((a) => a.photo).slice(0, 2), geste: 'Choisir le bon N°' });

  // ── POSTER : les bordereaux reçus, par JOUR de leur date limite (lue dans l'e-mail). ──
  if (P.poster.aImprimer) {
    const parJour = new Map();
    for (const l of P.poster.aImprimer) {
      const t = l.limite || l.estimee || null; const j = t ? jourParis(t) : 'sans';
      if (!parJour.has(j)) parJour.set(j, { t, lue: !!l.limite, lignes: [] });
      const g = parJour.get(j); g.lignes.push(l); if (t && (!g.t || t < g.t)) g.t = t; if (!l.limite) g.lue = false;
    }
    for (const [j, g] of parJour) {
      const n = g.lignes.length;
      cartes.push({ cle: 'poster-' + j, sorte: 'poster', echeance: g.t || 9e15, limite: g.t, estimee: !g.lue, n,
        titre: n === 1 ? (g.lignes[0].paire ? g.lignes[0].paire.titre : g.lignes[0].v.title) : `${n} colis à poster`,
        numeros: g.lignes.map((l) => (l.paire ? l.paire.numero : null)),
        photos: g.lignes.map((l) => (l.paire && l.paire.photo) || '').filter(Boolean).slice(0, 4),
        geste: n === 1 ? 'Imprimer le bordereau' : `Imprimer les ${n}` });
    }
  }

  // ── RETIRER : un point relais = une carte ; chaque colis avec SON code, et SON QR seulement s'il est réel. ──
  for (const pt of P.recevoir.points || []) {
    const n = pt.colis.length;
    cartes.push({ cle: 'retirer-' + pt.nom, sorte: 'retirer', echeance: pt.limite, limite: pt.limite, n, lieu: pt.nom, adresse: pt.adresse,
      titre: pt.nom, colis: pt.colis.map((c) => ({ id: c.id, code: c.code, art: c.art, qr: c.qr, carrier: c.carrier, limite: c.limite })),
      geste: n === 1 ? 'Montrer le code' : `Montrer les ${n} codes` });
  }

  // ── OFFRES : chacune avec SA conversation ; le prix de l'annonce par l'id de SON annonce. Elles passent après
//    ce qui a une date limite dans les 3 jours (un colis à poster, un colis à retirer), la plus ancienne d'abord. ──
  for (const o of (M.offres || []).filter((x) => maintenant - (Date.parse(x.date) || 0) < 2 * J).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))) {
    const a = M.items.get(o.item) || null; const k = M.numParItem.get(o.item);
    cartes.push({ cle: 'offre-' + o.conv, sorte: 'offre', echeance: maintenant + 3 * J - (maintenant - (Date.parse(o.date) || maintenant)), n: 1, pseudo: o.pseudo, montant: o.montant,
      prix: a ? centimes(a.price) : null, numero: k ? M.paires.get(k).numero : null, photo: (a && a.photo) || o.photo || '', titre: (a && a.title) || o.titre, date: o.date,
      geste: 'Répondre' });
  }

  // ── PRIX D'ACHAT : les paires VENDUES dont il n'a pas saisi le coût (§2.5 : jamais deviné). ──
  const sansCout = P.encaisser.sansCout;
  if (sansCout.length) cartes.push({ cle: 'prix', sorte: 'prix', echeance: 9.5e15, n: sansCout.length, titre: `${sansCout.length} ventes sans prix d'achat`,
    numeros: sansCout.map((p) => p.numero), photos: sansCout.map((p) => p.photo).filter(Boolean).slice(0, 4), geste: `Saisir les ${sansCout.length} prix` });

  cartes.sort((a, b) => a.echeance - b.echeance);

  // LE CHIFFRE DU JOUR : les ventes datées d'aujourd'hui (heure de Paris), à leur prix lu.
  const auj = jourParis(maintenant);
  const ventesDuJour = M.ventes ? M.ventes.filter((v) => v.date && jourParis(Date.parse(v.date)) === auj) : null;
  const jour = ventesDuJour ? { n: ventesDuJour.length, total: ventesDuJour.reduce((t, v) => t + (centimes(v.price) || 0), 0) } : null;
  return { cartes, pasLu, jour };
}

// L'échéance dite comme il la dirait : « avant demain 18:00 », « avant jeudi ». Une date ESTIMÉE (vente + 7 j)
// ne se dit jamais « en retard » : « vers jeudi ».
export function echeance(t, { estimee = false } = {}, maintenant = Date.now()) {
  if (!t || t > 9e14) return '';
  const d = new Date(t);
  const dj = Math.round((Date.parse(jourParis(t)) - Date.parse(jourParis(maintenant))) / J);
  const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  const jour = dj <= 0 ? 'aujourd’hui' : dj === 1 ? 'demain' : dj < 7 ? d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' }) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  if (estimee) return 'vers ' + jour;
  return 'avant ' + jour + (dj <= 1 ? ' ' + h : '');
}
export const presse = (t, maintenant = Date.now()) => !!t && t < 9e14 && t - maintenant < 2 * J;
export { str };
