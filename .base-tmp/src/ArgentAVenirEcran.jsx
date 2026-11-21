// ═══════════════════════════════════════════════════════════════════════════
// L'ÉCRAN « ARGENT À VENIR » ET SON RÉSUMÉ (15 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « je veux que les stats des montants en attente soient mieux
// affichées ». AUCUN CALCUL ICI : `A` = `argentAVenir` (src/argentAVenir.js), la
// règle de la coque (`liveStats.aVenir`) ; la frise = `friseAVenir` (la même
// règle). Ce fichier dit, dans cet ordre :
//   1. le total à venir avec SA couverture (« au moins » + le manque nommé ; une
//      autre devise écartée et dite ; les commandes eBay avant frais dites) ;
//   2. les trois sommes à ne JAMAIS additionner : à venir · porte-monnaie Vinted
//      (déjà versé) · reçu ce mois (daté au versement) — chacune de sa règle ;
//   3. par ÉTAPE (une vente dans une étape ; total = somme des étapes), la date de
//      versement seulement quand le site l'écrit, sinon « — » et la raison ; les
//      ventes bloquées / en litige À PART, hors total ;
//   4. « cette semaine · la suivante · plus tard » quand des dates sont écrites ;
//   5. par SITE (sa marque) puis par COMPTE, repliable ; chaque ligne déplie SES
//      ventes (la liste filtrée : titre, compte, montant, date).
// Les data-* portent les nombres (en centimes) : les bancs jugent la règle, pas le libellé.
import React from 'react';
import { tr, date as dateLangue } from './i18n/index.js';
import { montant } from './format.js';
import { jourParis } from './dateParis.js';   // (16 nov.) le jour PRÉVU à l'heure de Paris
import { ETAPES_A_VENIR, friseAVenir } from './argentAVenir.js';
import MarquePlateforme from './plateformes/Marque.jsx';
import './styles-avenir.css';

const SITE_ID = { Vinted: 'vinted', eBay: 'ebay', Vestiaire: 'vestiaire', Leboncoin: 'leboncoin' };
const cts = (x) => String(Math.round(Number(x || 0) * 100));
const jourCourt = (t) => dateLangue(t, { day: 'numeric', month: 'short' });
const estPartiel = (A) => !!A && ((A.manque || []).length > 0 || (A.nonComptees || []).length > 0);

// Le montant d'affiche : le nombre, puis « € » plus petit (rien d'autre que la mise en forme).
function Somme({ v, classe = 'sb-prix' }) {
  const t = montant(v);
  const m = /^(.*?)[\s  ]*€$/.exec(String(t));
  return <bdi className={classe}>{m ? <>{m[1]}<span className="sb-eur">{' '}€</span></> : t}</bdi>;
}

// La couverture du total : ce qui manque, nommé ; rien quand tout est lu.
export function couvertureAVenir(A) {
  if (!A) return [];
  const out = [];
  const nc = A.nonComptees || [];
  if ((A.manque || []).length) out.push({ cle: 'manque', texte: tr('avenir.sansLu', { x: A.manque.join(', ') }) });
  const dev = nc.filter((x) => x.sorte === 'devise');
  if (dev.length) out.push({ cle: 'devise', n: dev.length, texte: tr('avenir.devise', { n: dev.length, d: [...new Set(dev.map((x) => x.devise || '?'))].join(', ') }) });
  const ill = nc.filter((x) => x.sorte !== 'devise');
  if (ill.length) out.push({ cle: 'illisible', n: ill.length, texte: tr('avenir.illisible', { n: ill.length }) });
  if (A.estimes && A.estimes.n > 0) out.push({ cle: 'estime', n: A.estimes.n, texte: tr('avenir.estime', { n: A.estimes.n, m: montant(A.estimes.eur) }) });
  return out;
}

// La date d'une étape (ou d'un groupe) : sûre ⇒ « vers le … » ; sinon « — » et POURQUOI.
const dateGroupe = (lignes, prevu) => {
  if (prevu != null) return { sure: true, texte: tr('avenir.date.vers', { date: jourCourt(prevu) }) };
  const k = lignes.filter((l) => l.prevu != null).length;
  if (k > 0) return { sure: false, texte: tr('avenir.date.partiel', { k, n: lignes.length }) };
  return { sure: false, texte: lignes.every((l) => l.plateforme === 'Vinted') ? tr('avenir.date.vinted') : tr('avenir.date.site') };
};

// Les ventes d'une ligne, dépliées sur place.
function ListeVentes({ lignes, attr, parentMontre = true }) {
  return (
    <ul className="vrm-av-ventes" data-av-ventes={attr} data-n={lignes.length}>
      {lignes.map((l) => (
        <li key={l.id} className="vrm-av-vente" data-av-vente={l.id} data-eur={cts(l.eur)} data-etape={l.etape || ''} data-prevu={l.prevu != null ? jourParis(l.prevu) : ''}>
          <span className="vrm-av-vente-txt">
            <span className="vrm-av-vente-titre">{l.titre || tr('avenir.sansTitre')}</span>
            <span className="vrm-av-vente-meta">{l.plateforme}{l.compte ? <span className="vrm-sensible"> · {l.compte}</span> : null}{l.prevu != null ? ` · ${jourCourt(l.prevu)}` : ''}{l.estime ? ` · ${tr('avenir.fraisEbay')}` : ''}{l.raison ? ` · ${tr('avenir.raison.' + l.raison)}` : ''}</span>
          </span>
          {parentMontre && lignes.length === 1 ? null : <Somme v={l.eur}/>}
        </li>
      ))}
    </ul>
  );
}

// Une rangée qui déplie ses ventes (toute la rangée se touche).
function Rangee({ id, gauche, titre, meta, eur, lignes, attrs = {}, ouvert, basculer, secondaire = false, sansMontant = false }) {
  return (
    <li className={'vrm-av-rangee' + (secondaire ? ' is-secondaire' : '')} {...attrs}>
      <button type="button" className={"vrm-av-rangee-tete" + (gauche ? "" : " sans-gauche")} aria-expanded={ouvert ? 'true' : 'false'} onClick={() => basculer(id)}>
        {gauche ? <span className="vrm-av-gauche" aria-hidden="true">{gauche}</span> : null}
        <span className="vrm-av-rangee-txt">
          <span className="vrm-av-rangee-titre">{titre}</span>
          {meta ? <span className="vrm-av-rangee-meta">{meta}</span> : null}
        </span>
        {sansMontant ? null : <Somme v={eur}/>}
        <span className="vrm-av-chev" aria-hidden="true">›</span>
      </button>
      {ouvert ? <ListeVentes lignes={lignes} attr={id} parentMontre={!sansMontant}/> : null}
    </li>
  );
}

// (15 nov., maquette « Verre dépoli ») UNE ÉTAPE DANS LE VERRE : sa pastille, son nom, son montant, puis ses
// ventes — les APERCU premières montrées d'emblée, toutes au toucher de l'en-tête (« N autres »). Une vente :
// sa plaque N° (par identité : `numDe`, jamais par le titre — blanc sinon), son titre, son site et son compte,
// son montant (tu sur une vente seule : le montant de l'étape le dit déjà, §7).
const APERCU = 3;
export function Groupe({ id, pastille, titre, date, eur, lignes, numDe, attrs = {}, tout, basculer, secondaire = false, sansMontant = false }) {
  const reste = Math.max(0, lignes.length - APERCU);
  const vues = tout || !reste ? lignes : lignes.slice(0, APERCU);
  return (
    <li className={'vg-av-groupe' + (secondaire ? ' is-secondaire' : '')} {...attrs}>
      <button type="button" className="vg-av-groupe-tete" aria-expanded={reste ? (tout ? 'true' : 'false') : undefined} onClick={() => { if (reste) basculer(id); }}>
        <span className="vg-av-pastille-hote" aria-hidden="true">{pastille}</span>
        <b className="vg-av-groupe-titre">{titre}</b>
        {sansMontant ? null : <b className="vg-av-groupe-eur"><Somme v={eur}/></b>}
        {reste ? <span className="vg-av-plus">{tout ? tr('verre2.av.moins') : tr('verre2.av.autres', { n: reste })}</span> : null}
      </button>
      {date}
      <ul className="vrm-av-ventes vg-av-ventes" data-av-ventes={id} data-n={lignes.length}>
        {vues.map((l) => {
          const num = numDe ? numDe(l) : null;
          return (
            <li key={l.id} className="vrm-av-vente vg-av-vente" data-av-vente={l.id} data-eur={cts(l.eur)} data-etape={l.etape || ''} data-num={num || undefined} data-prevu={l.prevu != null ? jourParis(l.prevu) : ''}>
              {num ? <span className="sb-plaque vg-av-plaque"><small>N°</small>{num}</span> : <span className="vg-av-plaque is-vide" aria-hidden="true"/>}
              <span className="vrm-av-vente-txt">
                <span className="vrm-av-vente-titre">{l.titre || tr('avenir.sansTitre')}</span>
                <span className="vrm-av-vente-meta"><span className="vg-av-logo" aria-hidden="true"><MarquePlateforme site={SITE_ID[l.plateforme]} taille={11}/></span>{l.compte ? <span className="vrm-sensible">{l.compte}</span> : l.plateforme}{l.prevu != null ? ` · ${jourCourt(l.prevu)}` : ''}{l.estime ? ` · ${tr('avenir.fraisEbay')}` : ''}{l.raison ? ` · ${tr('avenir.raison.' + l.raison)}` : ''}</span>
              </span>
              {lignes.length === 1 && !sansMontant ? null : <Somme v={l.eur}/>}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

// ── L'ÉCRAN ──
// `A` : argentAVenir · `porteMonnaie` : { dispo, attente, comptes: [{ login, attente, jours }] } | null ·
// `recu` : { valeur, partiel, mois } | null · `Feuille` : la SheetShell de l'app.
export function ArgentAVenirEcran({ A, porteMonnaie = null, recu = null, Feuille, onClose, maintenant = Date.now(), numDe = null }) {
  const [ouverts, setOuverts] = React.useState(() => new Set());
  const basculer = (id) => setOuverts((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  if (!Feuille) return null;
  const corps = (() => {
    if (!A || A.enCours) return <p className="vrm-av-etat" data-av-etat="encours">{tr('avenir.lecture')}</p>;
    const partiel = estPartiel(A);
    const cov = couvertureAVenir(A);
    if (!A.n && !partiel && !(A.bloquees && A.bloquees.n)) return <p className="vrm-av-etat" data-av-etat="vide">{tr('avenir.vide')}</p>;
    const auMoinsZero = partiel && !(A.total > 0);
    const F = friseAVenir(A, maintenant);
    const parEtape = A.parEtape || [];
    const sites = (A.parSite || []).map((s) => s.plateforme);
    const lignesDe = (f) => A.lignes.filter(f);
    const pmParCompte = new Map(((porteMonnaie && porteMonnaie.comptes) || []).map((c) => [String(c.login || ''), c]));
    const mois = recu && recu.mois ? recu.mois : '';
    // La raison « pas de date » commune à TOUTES les étapes se dit UNE fois, au bas du verre (§7) ;
    // chaque étape la garde pour les lecteurs d'écran (`data-av-date`).
    const datesEtapes = parEtape.map((g) => dateGroupe(lignesDe((l) => (l.etape || 'autre') === g.etape), g.prevu));
    const dateCommune = datesEtapes.length && datesEtapes.every((d) => !d.sure && d.texte === datesEtapes[0].texte) ? datesEtapes[0].texte : '';
    return (
      <>
        {/* 1. LE TOTAL ET SA COUVERTURE — (15 nov., maquette « Verre dépoli » validée) le chiffre en blanc sur le fond */}
        <section className="vrm-av-affiche vg-av-affiche" data-av-total={auMoinsZero ? '' : cts(A.total)} data-av-n={A.n} data-av-partiel={partiel ? '1' : undefined}>
          <p className="sb-surtitre vg-av-sous">{tr('verre2.av.sous')}</p>
          <div className="vrm-av-total">
            {auMoinsZero ? <span className="sb-chiffre-affiche sb-chiffre-affiche--moyen">—</span> : <>
              {partiel ? <span className="vrm-av-borne">{tr('avenir.auMoins')} </span> : null}
              <Somme v={A.total} classe="sb-chiffre-affiche sb-chiffre-affiche--moyen"/>
            </>}
          </div>
          <p className="vrm-av-total-meta">{tr('avenir.ventes', { n: A.n })}{sites.length ? ` · ${sites.join(', ')}` : ''}</p>
          {cov.length ? <ul className="vrm-av-couverture" data-av-couverture={cov.map((c) => c.cle).join(',')}>{cov.map((c) => <li key={c.cle} data-av-manque={c.cle} data-n={c.n}>{c.texte}</li>)}</ul> : null}
        </section>

        {/* 2. PAR ÉTAPE, dans UN verre : la barre (une part par étape, à la proportion de son montant), puis chaque
            étape et ses ventes (N° par identité, titre, site et compte, montant) ; le porte-monnaie Vinted en bas,
            « pas lu » quand il ne l'est pas — jamais un faux zéro, jamais ajouté au total. */}
        <section className="vrm-av-bloc vg-av-carte" data-av-etapes={parEtape.length}>
          <h3 className="vrm-av-h vg-sr">{tr('avenir.etapes.titre')}</h3>
          {A.total > 0 ? (
            <div className="vrm-av-barre vg-av-barre" aria-hidden="true">
              {parEtape.map((g) => <span key={g.etape} className={'vrm-av-barre-seg is-' + g.etape} style={{ flexGrow: Math.max(1, Math.round(g.eur * 100)) }}/>)}
            </div>
          ) : null}
          <ul className="vg-av-groupes">
            {parEtape.map((g, i) => {
              const L = lignesDe((l) => (l.etape || 'autre') === g.etape);
              const d = datesEtapes[i];
              return (
                <Groupe key={g.etape} id={'etape:' + g.etape} tout={ouverts.has('etape:' + g.etape)} basculer={basculer} lignes={L} numDe={numDe}
                  pastille={<span className={'vrm-av-pastille is-' + g.etape}/>} titre={tr('avenir.etape.' + g.etape)}
                  date={<span className={d.sure || d.texte !== dateCommune ? 'vg-av-date' : 'vg-sr'} data-av-date={d.sure ? 'sure' : 'passu'}>{d.texte}</span>}
                  eur={g.eur} sansMontant={parEtape.length === 1}
                  attrs={{ 'data-av-etape': g.etape, 'data-eur': cts(g.eur), 'data-n': g.n, 'data-prevu': g.prevu != null ? jourParis(g.prevu) : '' }}/>
              );
            })}
            {A.bloquees && A.bloquees.n > 0 ? (
              <Groupe id="etape:bloquee" tout={ouverts.has('etape:bloquee')} basculer={basculer} lignes={A.bloquees.lignes} numDe={numDe} secondaire
                pastille={<span className="vrm-av-pastille is-bloquee"/>} titre={tr('avenir.etape.bloquee')}
                date={<span className="vg-av-date">{tr('avenir.bloqueeAide')}</span>}
                eur={A.bloquees.eur}
                attrs={{ 'data-av-etape': 'bloquee', 'data-av-hors-total': '1', 'data-eur': cts(A.bloquees.eur), 'data-n': A.bloquees.n }}/>
            ) : null}
            <li className="vg-av-groupe vg-av-pm" data-av-somme="dispo" data-eur={porteMonnaie && porteMonnaie.dispo != null ? cts(porteMonnaie.dispo) : ''}>
              <div className="vg-av-groupe-tete is-fixe">
                <span className="vrm-av-pastille is-pm" aria-hidden="true"/>
                <b className="vg-av-groupe-titre">{tr('avenir.trois.dispo')}</b>
                <b className="vg-av-groupe-eur">{porteMonnaie && porteMonnaie.dispo != null ? montant(porteMonnaie.dispo) : '—'}</b>
              </div>
              <p className="vg-av-note">{porteMonnaie && porteMonnaie.dispo != null ? tr('verre2.av.pmLu') : tr('verre2.av.pmPasLu')}</p>
            </li>
          </ul>
          {dateCommune ? <p className="vg-av-note vg-av-note-bas" aria-hidden="true">{dateCommune.replace(/^—\s*/, '')}</p> : null}
        </section>

        {/* 3. Le reçu du mois : une AUTRE somme (datée au versement), nommée à part, jamais ajoutée. */}
        <section className="vrm-av-trois vg-av-recu" aria-label={tr('avenir.trois.titre')} data-av-trois="">
          <div className="vrm-av-trois-case vg-av-recu-case" data-av-somme="recu" data-eur={recu && recu.valeur != null ? cts(recu.valeur) : ''}>
            <span className="vrm-av-trois-l">{tr('avenir.trois.recu', { mois })}</span>
            <b>{recu && recu.valeur != null ? <>{recu.partiel ? <small>{tr('avenir.auMoins')} </small> : null}{montant(recu.valeur)}</> : '—'}</b>
            <span className="vrm-av-trois-aide">{recu && recu.valeur != null ? tr('avenir.trois.recuAide') : (recu && recu.raison) || tr('avenir.trois.pasLu')}</span>
          </div>
          <p className="vrm-av-trois-note">{tr('avenir.trois.titre')}</p>
        </section>

        {/* 4. QUAND ÇA ARRIVE — seulement les dates ÉCRITES par le site */}
        {F && F.datees > 0 ? (
          <section className="vrm-av-bloc" data-av-frise={F.datees}>
            <h3 className="vrm-av-h">{tr('avenir.frise.titre')}</h3>
            <div className="vrm-av-frise">
              {[['semaine', F.semaine], ['suivante', F.suivante], ['plusTard', F.plusTard]].map(([k, x]) => (
                <div key={k} className="vrm-av-frise-case" data-av-frise-case={k} data-eur={cts(x.eur)} data-n={x.n}>
                  <span className="vrm-av-trois-l">{tr('avenir.frise.' + k)}</span>
                  <b>{x.n ? (x.n === A.n ? tr('avenir.frise.tout') : montant(x.eur)) : '—'}</b>
                  <span className="vrm-av-trois-aide">{x.n ? tr('avenir.ventes', { n: x.n }) : ' '}</span>
                </div>
              ))}
            </div>
            {F.sansDate.n > 0 ? <p className="vrm-av-note" data-av-sans-date={F.sansDate.n} data-eur={cts(F.sansDate.eur)}>{tr('avenir.frise.sansDate', { n: F.sansDate.n })} · {montant(F.sansDate.eur)}</p> : null}
          </section>
        ) : null}

        {/* 5. PAR SITE, PUIS PAR COMPTE */}
        <section className="vrm-av-bloc" data-av-sites={(A.parSite || []).length}>
          <h3 className="vrm-av-h">{tr('avenir.sites.titre')}</h3>
          <ul className="vrm-av-liste">
            {(A.parSite || []).map((s) => {
              const idS = 'site:' + s.plateforme;
              const comptes = (A.parCompte || []).filter((g) => g.plateforme === s.plateforme);
              const ouvertS = ouverts.has(idS);
              return (
                <li key={s.plateforme} className="vrm-av-rangee" data-av-site={s.plateforme} data-eur={cts(s.eur)} data-n={s.n}>
                  <button type="button" className="vrm-av-rangee-tete" aria-expanded={ouvertS ? 'true' : 'false'} onClick={() => basculer(idS)}>
                    <span className="vrm-av-gauche vrm-av-marque" aria-hidden="true"><MarquePlateforme site={SITE_ID[s.plateforme]} taille={18} carre/></span>
                    <span className="vrm-av-rangee-txt">
                      <span className="vrm-av-rangee-titre">{s.plateforme}</span>
                      <span className="vrm-av-rangee-meta">{tr('avenir.ventes', { n: s.n })} · {tr('avenir.comptes', { n: s.comptes })}</span>
                    </span>
                    {(A.parSite || []).length === 1 ? null : <Somme v={s.eur}/>}
                    <span className="vrm-av-chev" aria-hidden="true">›</span>
                  </button>
                  {ouvertS ? (
                    <ul className="vrm-av-liste vrm-av-comptes">
                      {comptes.map((g) => {
                        const idC = 'compte:' + g.plateforme + '|' + g.compte;
                        const L = lignesDe((l) => l.plateforme === g.plateforme && l.compte === g.compte);
                        const d = dateGroupe(L, g.prevu);
                        const pm = g.plateforme === 'Vinted' ? pmParCompte.get(String(g.compte)) : null;
                        return (
                          <Rangee key={idC} id={idC} ouvert={ouverts.has(idC)} basculer={basculer} lignes={L} secondaire
                            titre={<span className="vrm-sensible">{g.compte || tr('avenir.compteSans')}</span>}
                            meta={<>{tr('avenir.ventes', { n: g.n })} · <span data-av-date={d.sure ? 'sure' : 'passu'}>{d.texte}</span>{pm && pm.attente != null ? <span data-av-pm={cts(pm.attente)}> · {tr('avenir.pmVinted', { m: montant(pm.attente) })}{pm.jours > 0 ? ` (${tr('avenir.pmLu', { j: pm.jours })})` : ''}</span> : null}</>}
                            eur={g.eur} sansMontant={comptes.length === 1}
                            attrs={{ 'data-av-compte': g.compte, 'data-av-compte-site': g.plateforme, 'data-eur': cts(g.eur), 'data-n': g.n }}/>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </>
    );
  })();
  return (
    <Feuille onClose={onClose} maxWidth={640} z={9100} titre={tr('avenir.titre')} className="vrm-av sb-feuille vg-av" data-argent-a-venir-ecran="" aria-label={tr('avenir.titre')}>
      <div className="vrm-av-corps">{corps}</div>
    </Feuille>
  );
}

// ── LE RÉSUMÉ COMPACT (Ventes, Ma journée, Argent) : le total, sa couverture, les étapes en une ligne. ──
// Toute la carte se touche et ouvre l'écran (`onOuvrir`). Les data-* d'avant restent (bancs, instantané).
export function resumeEtapes(A, plateforme = null) {
  if (!A || !Array.isArray(A.lignes)) return [];
  const dans = (l) => !plateforme || l.plateforme === plateforme;
  const out = [];
  for (const k of ETAPES_A_VENIR) {
    const n = A.lignes.filter((l) => dans(l) && (l.etape || 'autre') === k).length;
    if (n) out.push({ cle: k, n, texte: tr('avenir.court.' + k, { n }) });
  }
  const nb = A.bloquees && Array.isArray(A.bloquees.lignes) ? A.bloquees.lignes.filter(dans).length : 0;
  if (nb) out.push({ cle: 'bloquee', n: nb, texte: tr('avenir.court.bloquee', { n: nb }) });
  return out;
}
// Ouvrir l'écran depuis n'importe où (la coque l'écoute et le monte).
export const ouvrirArgentAVenir = () => { try { window.dispatchEvent(new CustomEvent('vrm:argent-a-venir')); } catch (_) {} };
export { ETAPES_A_VENIR };
