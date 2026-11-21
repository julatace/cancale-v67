// ── src/natif/ecrans/LierAchatGrille.jsx — « Lier à un achat », façon Bleam (21 nov., ventes-lisibles) ───────────────────
// Julien : « inspire-toi de Bleam » (sa capture « Lier à un achat ») : la VENTE en haut (posée par la feuille de l'app), une
// recherche, des filtres Marque et Prix, puis la GRILLE des photos de ses achats ARRIVÉS, du plus récent au plus ancien.
// SON toucher choisit une case, « Oui » relie — l'écriture et le geste annulable 5 s sont ceux de la feuille d'avant
// (`relierAchat` de src/App.jsx : détacher s'il le faut, lot = prix à saisir, pilule « Achat relié · Bénéfice … · Annuler »).
// Rien n'est relié par ressemblance (§5) : la grille ne propose pas, elle montre ; c'est lui qui choisit.
//
// Ce qui est proposé : les achats LIBRES (`tousAchatsLibresDetail`, la règle de la feuille d'avant : pas déjà reliés, un lot
// jusqu'à son nombre, pas annulés) ET arrivés chez lui (`recuDe`, l'étape « Arrivé » d'`etapeAchat` — la règle de « Relier
// achats et ventes ») ; « pas su » ⇒ pas proposé, et c'est DIT (« N achats pas encore arrivés ne sont pas montrés »).
// Les places des photos sont réservées (carré fixe) : rien ne saute pendant le chargement.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { tousAchatsLibresDetail } from '../../suggestionsAchat.js';
import '../ventes-lisibles.css';

const PAS = 60;
// Les tranches de prix (« Prix ▾ ») : bornes en euros, incluses ; la dernière n'a pas de plafond.
export const TRANCHES_PRIX = [['0-20', 0, 20], ['20-40', 20, 40], ['40-60', 40, 60], ['60-100', 60, 100], ['100+', 100, null]];
const prixCourt = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n).toFixed(Number(n) % 1 ? 2 : 0).replace('.', ',')} €`);
const jourCourt = (d) => { const t = Date.parse(d || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };

function Pilule({ cle, libelle, valeur, options, onChoix, tous }) {
  const sel = options.find((o) => o.cle === valeur);
  return (
    <label className="n-la-pilule" data-la-filtre={cle} data-la-filtre-valeur={valeur || undefined} aria-pressed={valeur ? 'true' : 'false'}>
      <span className="n-la-pilule-txt">{sel ? sel.libelle : libelle}</span>
      <svg className="n-la-pilule-chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <select value={valeur} aria-label={libelle} onChange={(e) => onChoix(e.target.value)}>
        <option value="">{tous}</option>
        {options.map((o) => <option key={o.cle} value={o.cle}>{o.libelle}{o.n != null ? ` (${o.n})` : ''}</option>)}
      </select>
    </label>
  );
}

export default function LierAchatGrille({ achats, liens, curTx = '', recuDe, prixDe, photoDe = () => '', marqueDe = () => '', Photo = null, onRelier, onPlus = null }) {
  const [q, setQ] = React.useState('');
  const [marque, setMarque] = React.useState('');
  const [prix, setPrix] = React.useState('');
  const [choisi, setChoisi] = React.useState('');
  const [nVus, setNVus] = React.useState(PAS);
  const [envoi, setEnvoi] = React.useState(false);
  const finRef = React.useRef(null);
  const charge = Array.isArray(achats);
  // Arrivés chez lui seulement (la règle passée par l'app) ; « pas su » ⇒ écarté.
  const { arrives, pasArrives } = React.useMemo(() => {
    if (!charge) return { arrives: [], pasArrives: 0 };
    const libres = tousAchatsLibresDetail({ achats, liens, curTx }).liste;
    const ok = []; let non = 0;
    for (const a of libres) { let r = false; try { r = !!recuDe(a); } catch (_) { r = false; } if (r) ok.push(a); else non++; }
    return { arrives: ok, pasArrives: non };
  }, [achats, liens, curTx, recuDe, charge]);
  const marques = React.useMemo(() => {
    const n = new Map();
    for (const a of arrives) { const m = String(marqueDe(String((a && a.title) || '')) || '').trim(); if (m) n.set(m, (n.get(m) || 0) + 1); }
    return [...n.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([m, k]) => ({ cle: m, libelle: m, n: k }));
  }, [arrives, marqueDe]);
  const tranche = TRANCHES_PRIX.find((t) => t[0] === prix) || null;
  const liste = React.useMemo(() => tousAchatsLibresDetail({ achats: arrives, liens, curTx, q, marqueDe, marque, prixAchat: prixDe,
    prixMin: tranche ? tranche[1] : null, prixMax: tranche ? tranche[2] : null }).liste, [arrives, liens, curTx, q, marque, tranche, prixDe, marqueDe]);
  React.useEffect(() => { setNVus(PAS); }, [q, marque, prix]);
  React.useEffect(() => { if (choisi && !liste.some((a) => String(a.transaction_id) === choisi)) setChoisi(''); }, [liste, choisi]);
  React.useEffect(() => {
    const el = finRef.current;
    if (!el || typeof IntersectionObserver !== 'function' || nVus >= liste.length) return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNVus((n) => n + PAS); }, { rootMargin: '600px 0px' });
    io.observe(el); return () => io.disconnect();
  }, [nVus, liste.length]);
  const achatChoisi = choisi ? liste.find((a) => String(a.transaction_id) === choisi) || null : null;
  const relier = async () => { if (!achatChoisi || envoi) return; setEnvoi(true); try { await onRelier(achatChoisi); } finally { setEnvoi(false); } };
  const optionsPrix = TRANCHES_PRIX.map(([cle, a, b]) => ({ cle, libelle: b == null ? tr('la.prix.plus', { a: String(a) }) : tr('la.prix.entre', { a: String(a), b: String(b) }) }));
  return (
    <div className="n-la" data-la-grille-corps="" data-la-n={charge ? String(liste.length) : ''} data-la-arrives={charge ? String(arrives.length) : ''} data-la-pas-arrives={String(pasArrives)}>
      <div className="n-la-haut">
        <div className="n-la-recherche">
          <input type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('la.chercher')} aria-label={tr('la.chercher')} data-la-recherche=""/>
        </div>
        <div className="n-la-filtres" role="group" aria-label={tr('la.filtrer')}>
          {marques.length > 1 || marque ? <Pilule cle="marque" libelle={tr('la.marque')} tous={tr('la.marque.toutes')} valeur={marque} options={marques} onChoix={setMarque}/> : null}
          <Pilule cle="prix" libelle={tr('la.prixPaye')} tous={tr('la.prix.tous')} valeur={prix} options={optionsPrix} onChoix={setPrix}/>
          {onPlus ? <button type="button" className="n-la-plus" data-la-plus="" onClick={onPlus}>{tr('la.plusDeChoix')}</button> : null}
        </div>
        <div className="n-la-compte" data-la-compte="">
          {!charge ? tr('la.lecture') : tr('la.nArrives', { n: String(liste.length) })}
          {charge && pasArrives > 0 ? <span data-la-pas-arrives-dit=""> · {tr('la.pasArrives', { n: String(pasArrives) })}</span> : null}
        </div>
      </div>
      {!charge ? <div className="n-la-grille" aria-busy="true" data-la-attente="">{Array.from({ length: 6 }, (_, i) => <span key={i} className="n-la-case n-la-case-attente" aria-hidden="true"><span className="n-la-photo"/></span>)}</div>
        : !liste.length ? <div className="n-la-vide" data-la-vide="">{q.trim() || marque || prix ? tr('la.videFiltre') : tr('la.vide')}</div>
          : <div className="n-la-grille" role="listbox" aria-label={tr('la.grille')} data-la-grille={String(liste.length)}>
            {liste.slice(0, nVus).map((a) => {
              const tx = String(a.transaction_id), ph = photoDe(a), px = prixDe(a), on = tx === choisi;
              return (
                <button key={tx} type="button" role="option" aria-selected={on ? 'true' : 'false'} className="n-la-case" data-la-achat={tx} data-la-choisi={on ? '1' : undefined} data-la-t={Number.isFinite(Date.parse(a.date || "")) ? String(Date.parse(a.date)) : ""}
                  aria-label={tr('la.caseAria', { titre: a.title || '—', prix: prixCourt(px), date: jourCourt(a.date) })} onClick={() => setChoisi(on ? '' : tx)}>
                  <span className="n-la-photo" data-la-photo={ph ? '1' : '0'}>{ph ? (Photo ? <Photo src={ph} alt="" loading="lazy" decoding="async"/> : <img src={ph} alt="" loading="lazy" decoding="async"/>) : null}
                    {on ? <span className="n-la-coche" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7.2 5.8 10 11 4.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span> : null}</span>
                  <span className="n-la-prix" data-la-prix="">{prixCourt(px)}</span>
                  <span className="n-la-titre">{a.title || '—'}</span>
                  <span className="n-la-date">{jourCourt(a.date)}</span>
                </button>
              );
            })}
          </div>}
      {charge && liste.length > nVus ? <div ref={finRef} className="n-la-fin"><button type="button" className="n-la-plus" data-la-suite="" onClick={() => setNVus((n) => n + PAS)}>{tr('la.suite', { n: String(liste.length - nVus) })}</button></div> : null}
      {achatChoisi ? (
        <div className="n-la-confirme" role="region" aria-label={tr('la.confirmer')} data-la-confirme={String(achatChoisi.transaction_id)}>
          <div className="n-la-confirme-txt">
            <span className="n-la-confirme-q">{tr('la.confirmer')}</span>
            <span className="n-la-confirme-titre">{achatChoisi.title || '—'} · {prixCourt(prixDe(achatChoisi))}</span>
          </div>
          <button type="button" className="n-la-non" data-la-non="" onClick={() => setChoisi('')}>{tr('la.non')}</button>
          <button type="button" className="n-la-oui" data-la-oui="" disabled={envoi} onClick={relier}>{tr('la.oui')}</button>
        </div>
      ) : null}
    </div>
  );
}
