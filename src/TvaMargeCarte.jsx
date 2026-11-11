// ════════════════════════════════════════════════════════════════════════════
//  « TVA SUR MARGE » — la déclaration d'un mois ou d'un trimestre (11 nov., lot tva-marge)
// ════════════════════════════════════════════════════════════════════════════
// Sous le seuil de TVA, dans Argent → Factures. Rendue SEULEMENT pour qui a choisi
// « TVA sur la marge » dans Ma facture (`tva_regime === 'marge'`, jamais deviné) :
// rien ne change pour les autres.
// Elle LIT la publication de la Comptabilité (`vrm_tva_marge`, src/tvaMarge.js) et
// ne recalcule rien d'autre que `declarationMarge` : la carte, le CSV et le PDF
// disent les mêmes chiffres. Une vente sans prix d'achat n'est pas un 0 : elle est
// NOMMÉE, avec la porte pour le saisir, et le total devient « au moins » (§5).
// Ambre = le geste à faire (§7) ; aucun rouge.
import React from 'react';
import './facture-tva.css';
import { AUTH, telechargerFichier } from './App.jsx';
import { useFicheFacturation } from './FacturePro.jsx';
import { SegmenteBase } from './composants/Bouton.jsx';
import { tr, heure } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireTvaMarge, declarationMarge, aDaterMarge, periodesMarge, moisParis, trimestreDe, libellePeriode, csvDeclarationMarge,
  eurosC, jourParisTs, SOURCES_TVA_MARGE, CLE_TVA_MARGE, EVT_TVA_MARGE } from './tvaMarge.js';

function usePublication(owner) {
  const lire = React.useCallback(() => { try { return lireTvaMarge(localStorage.getItem(CLE_TVA_MARGE), owner); } catch (_) { return null; } }, [owner]);
  const [v, setV] = React.useState(lire);
  React.useEffect(() => {
    const f = () => setV(lire());
    f();
    const s = (e) => { if (!e || e.key == null || e.key === CLE_TVA_MARGE) f(); };
    window.addEventListener(EVT_TVA_MARGE, f); window.addEventListener('storage', s);
    return () => { window.removeEventListener(EVT_TVA_MARGE, f); window.removeEventListener('storage', s); };
  }, [lire]);
  return v;
}

// La période voisine (mois ou trimestre), jamais au-delà de la période en cours.
function decaler(periode, pas) {
  let m = /^(\d{4})-T([1-4])$/.exec(periode);
  if (m) { let a = Number(m[1]), q = Number(m[2]) + pas; while (q < 1) { q += 4; a -= 1; } while (q > 4) { q -= 4; a += 1; } return `${a}-T${q}`; }
  m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return periode;
  let a = Number(m[1]), mo = Number(m[2]) + pas; while (mo < 1) { mo += 12; a -= 1; } while (mo > 12) { mo -= 12; a += 1; }
  return `${a}-${String(mo).padStart(2, '0')}`;
}
const SOURCES_PARTIEL = { vinted: 'tvaMarge.source.vinted', versements: 'tvaMarge.source.versements', leboncoin: null, ebay: null, vestiaire: null, 'achats-autres': 'tvaMarge.source.achats' };
const NOMS = { leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };

export default function TvaMargeCarte({ deps }) {
  useLangue();
  const cfg = useFicheFacturation(deps);
  const owner = (AUTH.user && AUTH.user.id) || '';
  const pub = usePublication(owner);
  const [mode, setMode] = React.useState('mois');
  const enCours = React.useMemo(() => { const ym = moisParis(Date.now()); return mode === 'trimestre' ? trimestreDe(ym) : ym; }, [mode]);
  const [choisie, setChoisie] = React.useState(null);
  const [pdfOcc, setPdfOcc] = React.useState(false);
  const [pdfKo, setPdfKo] = React.useState(false);
  const lignes = pub ? pub.lignes : null;
  // Par défaut : la période la plus récente qui a des ventes (sinon celle en cours).
  const defaut = React.useMemo(() => (lignes ? periodesMarge(lignes, mode)[0] : null) || enCours, [lignes, mode, enCours]);
  const periode = choisie && (mode === 'trimestre' ? /T/.test(choisie) : !/T/.test(choisie)) ? choisie : defaut;
  const d = React.useMemo(() => (lignes ? declarationMarge(lignes, periode) : null), [lignes, periode]);
  const sansDate = React.useMemo(() => (lignes ? aDaterMarge(lignes) : []), [lignes]);
  if (!cfg || cfg.tva_regime !== 'marge') return null;      // pas en marge, ou fiche pas lue : rien

  const partiel = pub ? pub.partiel : [];
  const incomplet = !!d && (!d.complet || partiel.length > 0);
  const montant = (c) => (incomplet && c > 0 ? tr('tvaMarge.auMoins', { montant: eurosC(c) }) : eurosC(c));
  const nomsPartiel = partiel.map((p) => (SOURCES_PARTIEL[p] ? tr(SOURCES_PARTIEL[p]) : NOMS[p] || p));
  const refs = SOURCES_TVA_MARGE.map((s) => s.ref).filter((x, i, a) => a.indexOf(x) === i).join(' ; ');
  const nomFichier = `tva-marge-${periode}`;
  const exporterCsv = () => { if (d) telechargerFichier(csvDeclarationMarge(d), `${nomFichier}.csv`, 'text/csv;charset=utf-8'); };
  const exporterPdf = async () => {
    if (!d || pdfOcc) return;
    setPdfOcc(true); setPdfKo(false);
    try {
      const { pdfDeclarationMarge } = await import('./tvaMargePdf.js');
      const octets = await pdfDeclarationMarge(d, { vendeur: [cfg.nom, cfg.siret ? `SIRET ${cfg.siret}` : ''].filter(Boolean).join(' · ') });
      telechargerFichier(new Blob([octets], { type: 'application/pdf' }), `${nomFichier}.pdf`, 'application/pdf');
    } catch (_) { setPdfKo(true); } finally { setPdfOcc(false); }
  };
  const saisir = () => { try { window.dispatchEvent(new CustomEvent('vrm:sante-aller', { detail: { tab: 'vinted_annonces', saisiePrix: true } })); } catch (_) {} };

  return (
    <section className="vrm-tvm" aria-label={tr('tvaMarge.titre')} data-tva-marge={pub ? (d && d.n ? 'calcule' : 'vide') : 'passu'}
      data-tva-marge-periode={periode} data-tva-marge-complet={d ? (incomplet ? '0' : '1') : ''}
      data-tva-marge-tva={d ? String(d.tvaC) : ''} data-tva-marge-base={d ? String(d.baseC) : ''}>
      <div className="vrm-tvm-tete">
        <span className="vrm-tvm-titre">{tr('tvaMarge.titre')}</span>
        <SegmenteBase label={tr('tvaMarge.periode')} value={mode} onChange={(v) => { setMode(v); setChoisie(null); }}
          options={[{ v: 'mois', l: tr('tvaMarge.mois') }, { v: 'trimestre', l: tr('tvaMarge.trimestre') }]}/>
      </div>
      <div className="vrm-tvm-periode">
        <button type="button" className="vrm-icon-control vrm-tvm-fleche" aria-label={tr('tvaMarge.precedente')} data-tva-marge-prec="" onClick={() => setChoisie(decaler(periode, -1))}>‹</button>
        <span className="vrm-tvm-libelle">{libellePeriode(periode)}</span>
        <button type="button" className="vrm-icon-control vrm-tvm-fleche" aria-label={tr('tvaMarge.suivante')} data-tva-marge-suiv="" disabled={periode >= enCours} onClick={() => setChoisie(decaler(periode, 1))}>›</button>
      </div>
      {!pub ? <p className="vrm-tvm-muet" data-tva-marge-passu="">{tr('tvaMarge.pasPublie')}</p> : !d.n ? <p className="vrm-tvm-muet">{tr('tvaMarge.aucune')}</p> : (
        <>
          <div className="vrm-tvm-chiffres">
            <div><small>{tr('tvaMarge.tvaDue')}</small><b data-tva-marge-chiffre="tva">{montant(d.tvaC)}</b></div>
            <div><small>{tr('tvaMarge.base')}</small><span data-tva-marge-chiffre="base">{montant(d.baseC)}</span></div>
          </div>
          <p className="vrm-tvm-muet">{tr('tvaMarge.comptees', { n: d.nComptees })}{d.nPertes ? ` · ${tr('tvaMarge.pertes', { n: d.nPertes })}` : ''}</p>
          {d.aCompleter.length ? (
            <div className="vrm-tvm-manque" data-tva-marge-manque={String(d.aCompleter.length)}>
              <b>{tr('tvaMarge.nonComptees', { n: d.aCompleter.length })}</b>
              <ul>
                {d.aCompleter.slice(0, 8).map((v) => (
                  <li key={v.id} data-tva-marge-exclue={v.etat}>{[jourParisTs(v.ts), v.plateforme, v.num ? `N°${v.num}` : '', v.titre].filter(Boolean).join(' · ')} — {tr(`tvaMarge.raison.${v.etat}`)}</li>
                ))}
                {d.aCompleter.length > 8 ? <li>…</li> : null}
              </ul>
              {d.aCompleter.some((v) => v.etat === 'achat') ? <button type="button" className="vrm-b vrm-b-secondaire vrm-tvm-porte" data-tva-marge-porte="" onClick={saisir}>{tr('tvaMarge.saisir')}</button> : null}
            </div>
          ) : null}
        </>
      )}
      {pub && nomsPartiel.length ? <p className="vrm-tvm-muet" data-tva-marge-partiel={partiel.join(',')}>{tr('tvaMarge.partiel', { sources: nomsPartiel.join(', ') })}</p> : null}
      {sansDate.length ? <p className="vrm-tvm-muet" data-tva-marge-sansdate={String(sansDate.length)}>{tr('tvaMarge.aDater', { n: sansDate.length })}</p> : null}
      {d && d.n ? (
        <div className="vrm-tvm-actions">
          <button type="button" className="vrm-b vrm-b-secondaire" data-tva-marge-export="csv" onClick={exporterCsv}>{tr('tvaMarge.csv')}</button>
          <button type="button" className="vrm-b vrm-b-secondaire" data-tva-marge-export="pdf" disabled={pdfOcc} onClick={exporterPdf}>{tr('tvaMarge.pdf')}</button>
          {pub.at ? <small className="vrm-tvm-muet">{tr('tvaMarge.calcule', { heure: heure(pub.at) })}</small> : null}
        </div>
      ) : null}
      {pdfKo ? <p className="vrm-tvm-muet" role="status">{tr('tvaMarge.pdfRate')}</p> : null}
      <details className="vrm-stva-pourquoi">
        <summary>{tr('tvaMarge.pourquoi')}</summary>
        <p>{tr('tvaMarge.p.calcul')}</p>
        <p>{tr('tvaMarge.p.date')}</p>
        <p>{tr('tvaMarge.p.globale')}</p>
        <p data-tva-marge-sources="">{tr('tvaMarge.p.sources', { refs })}</p>
        <p data-tva-marge-verifier="">{tr('tvaMarge.p.verifier')}</p>
      </details>
    </section>
  );
}
