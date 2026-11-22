// ── « BOOST RENTABLE OU PAS » : la fiche de l'annonce et « Boosts du mois » (21 nov., ext. 5.429 — point 64) ───────────
// La règle : src/boostPeriode.js (pure). Les lectures : src/boostLecture.js (projetées). Rien d'inventé : sous le seuil de
// données, « Pas assez de données » avec les chiffres connus ; le coût est le « Boost payé » saisi, sinon « coût inconnu ».
// Aucune couleur verte / rouge (un repère, pas une alerte) ; tout texte par tr().
import React from 'react';
import { lireSerie, periodesBoost, verdictBoost, boostsDuMois, SEUILS_BOOST } from './boostPeriode.js';
import { lireBoostes, lireSeries } from './boostLecture.js';
import { Groupe, Rangee, Faits, Fait } from './natif/index.js';
import { tr } from './i18n/index.js';
import { useLectureBornee } from './attenteBornee.js';   // (22 nov., chasse P2-5) une attente finit en « pas lu »

const eur = (n) => (n == null ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ',') + ' €');
const jourCourt = (t) => { try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch (_) { return ''; } };
const parJour = (x) => (x == null ? '—' : (Math.round(x * 10) / 10).toString().replace('.', ','));
export const MOT_VERDICT = { 'a-servi': 'boost.aServi', 'pas-servi': 'boost.pasServi', 'pas-assez': 'boost.pasAssez' };

// Les lignes d'un verdict (la même phrase partout : la fiche et le récap).
export function lignesVerdict(v) {
  const l = [];
  if (v.pendant) l.push(tr('boost.pendant', { v: v.pendant.vues, j: Math.round(v.pendant.jours), pj: parJour(v.pendant.vuesJour), f: v.pendant.favoris == null ? '—' : v.pendant.favoris }));
  else l.push(tr('boost.pendantPasSu'));
  if (v.avant) l.push(tr('boost.avant', { v: v.avant.vues, j: Math.round(v.avant.jours), pj: parJour(v.avant.vuesJour), f: v.avant.favoris == null ? '—' : v.avant.favoris }));
  else l.push(tr('boost.avantPasSu'));
  if (v.semblables) l.push(tr('boost.semblables', { n: v.semblables.n, pj: parJour(v.semblables.vuesJourPendant) }));
  if (v.offres) l.push(tr('boost.offres', { p: v.offres.pendant, a: v.offres.avant }));
  if (v.vendue) l.push(tr('boost.vendue'));
  l.push(v.cout != null ? tr('boost.cout', { c: eur(v.cout) }) : tr('boost.coutInconnu'));
  return l;
}

// La fiche d'une annonce Vinted : ses boosts relevés et leur verdict. `uid`, `id` : l'IDENTITÉ de l'annonce ; `cout` : le
// « Boost payé » saisi (ou null) ; `venteAt` : la date de sa vente prouvée (ms) ou null ; `base` : { url, auth }.
export function BoostAnnonce({ base, uid, id, cout = null, venteAt = null }) {
  const [serie, setSerie] = React.useState(undefined);
  React.useEffect(() => { let mort = false; setSerie(undefined);
    lireSeries(base, uid, [id]).then((r) => { if (!mort) setSerie(r === null ? null : (r[String(id)] || '')); }).catch(() => { if (!mort) setSerie(null); });
    return () => { mort = true; }; }, [base, uid, id]);
  if (serie === undefined) return null;
  const s = serie ? lireSerie(serie) : [];
  const per = periodesBoost(s);
  if (serie === null) return <Groupe titre={tr('boost.titre')} attrs={{ 'data-boost-annonce': 'pas-su' }}><Rangee titre={tr('boost.pasLu')}/></Groupe>;
  if (!per.length) return null;   // aucun boost relevé : rien à montrer (pas de carte récurrente)
  return (
    <Groupe titre={tr('boost.titre')} pied={tr('boost.regle', { n: SEUILS_BOOST.vuesMin })} attrs={{ 'data-boost-annonce': String(per.length) }}>
      {per.slice(-3).reverse().map((p) => { const v = verdictBoost({ serie: s, periode: p, venteAt, cout: Number(cout) > 0 ? Number(cout) : null });
        return <Rangee key={p.debut} titre={tr(MOT_VERDICT[v.verdict])} sousTitre={tr(p.enCours ? 'boost.depuis' : 'boost.du', { a: jourCourt(p.debut), b: jourCourt(p.fin) })} note={[...lignesVerdict(v), v.verdict === 'pas-assez' && v.code ? tr('boost.r.' + v.code, { n: SEUILS_BOOST.vuesMin }) : ''].filter(Boolean).join(' · ')}
          attrs={{ 'data-boost-verdict': v.verdict, 'data-boost-debut': String(p.debut) }}/>; })}
    </Groupe>
  );
}

// « Boosts du mois » (Statistiques). `comptes` : les uid Vinted sélectionnés ; `items` : les annonces lues (id, uid, prix,
// titre, numero) pour les semblables (même compte, prix à ± 30 %) ; `ventes` : { [itemId]: ms } (ventes prouvées) ;
// `couts` : { [itemId]: € saisi } ; `de`, `a` : le mois (ms).
export function BoostsDuMois({ base, comptes = [], items = [], ventes = {}, couts = {}, de, a }) {
  const [resLu, setRes] = React.useState(undefined);
  const res = useLectureBornee(resLu);
  const cle = JSON.stringify([comptes, de, a]);
  React.useEffect(() => { let mort = false; setRes(undefined);
    (async () => {
      const b = await lireBoostes(base, comptes);
      const annonces = []; let illisibles = b.illisibles;
      for (const uid of Object.keys(b.parCompte)) {
        const boostes = b.parCompte[uid]; if (!boostes.length) continue;
        const prixDe = (id) => { const x = items.find((y) => String(y.id) === String(id)); return x && Number(x.prix) > 0 ? Number(x.prix) : null; };
        const semb = items.filter((x) => String(x.uid) === uid && !boostes.includes(String(x.id)) && Number(x.prix) > 0)
          .filter((x) => boostes.some((id) => { const p = prixDe(id); return p && Math.abs(Number(x.prix) - p) <= 0.3 * p; })).slice(0, 40).map((x) => String(x.id));
        const s = await lireSeries(base, uid, [...boostes, ...semb]);
        if (s === null) { illisibles++; continue; }
        for (const id of Object.keys(s)) { const x = items.find((y) => String(y.id) === id) || {};
          annonces.push({ id, uid, serie: lireSerie(s[id]), venteAt: ventes[id] || null, cout: Number(couts[id]) > 0 ? Number(couts[id]) : null, titre: x.titre || '', numero: x.numero || '' }); }
      }
      return boostsDuMois({ annonces, de, a, illisibles });
    })().then((r) => { if (!mort) setRes(r); }).catch(() => { if (!mort) setRes(null); });
    return () => { mort = true; }; }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  if (res === undefined) return <Groupe titre={tr('boost.mois')} attrs={{ 'data-boosts-mois': 'cours' }}><Rangee titre={tr('boost.lecture')}/></Groupe>;
  if (res === null) return <Groupe titre={tr('boost.mois')} attrs={{ 'data-boosts-mois': 'pas-su' }}><Rangee titre={tr('boost.pasLu')}/></Groupe>;
  const n = res.n;
  return (
    <Groupe titre={tr('boost.mois')} pied={tr('boost.regle', { n: SEUILS_BOOST.vuesMin })} attrs={{ 'data-boosts-mois': String(n.total), 'data-boosts-au-moins': res.auMoins ? '1' : '0' }}>
      {!n.total ? <Rangee titre={tr('boost.moisVide')} sousTitre={tr('boost.moisVideSous')}/> : <>
        <Faits colonnes={3}>
          <Fait libelle={tr('boost.nServi')} valeur={String(n.servi)}/>
          <Fait libelle={tr('boost.nPasServi')} valeur={String(n.pasServi)}/>
          <Fait libelle={tr('boost.nPasAssez')} valeur={String(n.pasAssez)}/>
        </Faits>
        <Rangee titre={tr(res.auMoins ? 'boost.totalAuMoins' : n.total === 1 ? 'boost.total1' : 'boost.total', { n: n.total })} sousTitre={res.cout.avec ? tr('boost.coutConnu', { c: eur(res.cout.connu), a: res.cout.avec, n: res.cout.sur }) : tr('boost.coutAucun')} attrs={{ 'data-boosts-total': String(n.total) }}/>
        {res.boosts.slice(0, 12).map((b) => <Rangee key={b.uid + b.id + b.periode.debut} titre={(b.numero ? 'N°' + b.numero + ' · ' : '') + (b.titre || tr('boost.annonce', { id: b.id }))} sousTitre={tr(MOT_VERDICT[b.verdict])} note={lignesVerdict(b).join(' · ')} lignes={2} attrs={{ 'data-boost-mois-verdict': b.verdict }}/>)}
      </>}
    </Groupe>
  );
}
