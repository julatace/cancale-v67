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
// (21 nov., lot relier-retires — Julien : « ça me propose des paires que je n'ai pas retirées ») « Arrivé » = CHEZ LUI
// (`chezMoiDe`, src/achatChezMoi.js : finalisé, retiré prouvé par le suivi ou par SON toucher, livré). Un achat AU POINT
// RELAIS pas retiré n'est jamais proposé ni dans la grille : il est rangé sous « Pas encore retirés · N », replié, et
// devient reliable seulement après SON « Je l'ai retiré » (`onRetire`, le geste de Colis).
// Les places des photos sont réservées (carré fixe) : rien ne saute pendant le chargement.
//
// (21 nov., lot relier-code — Julien : « rends relier plus facile ») EN TÊTE, la MEILLEURE proposition (celle de la règle
// pondérée de src/liaisonAchat.js, rangée par src/relierPropositions.js : la « très probable », ou une piste qui devance
// nettement la suivante — jamais une égalité tranchée), « Relier » en un toucher puis « Oui » ; puis 2–3 autres suggestions,
// chacune avec SA raison écrite en petit (« même modèle « spezial » · taille 42 · arrivé le 12 nov. ») ; puis la grille.
// « Pas celle-ci » range le couple (« Ce n'est pas lui », synchronisé). En SÉRIE (`serie`), « 3 sur 18 » et « Passer ».
// Un LOT dit combien de ses articles sont déjà reliés ; il reste proposé jusqu'à son nombre, son prix ne se divise jamais.
// Rien n'est relié sans son toucher sur « Oui » (`relier`, seul appel d'`onRelier`).
import React from 'react';
import { tr, localeCourante } from '../../i18n/index.js';
import { tousAchatsLibresDetail } from '../../suggestionsAchat.js';
import { rangerPropositions, etatLot } from '../../relierPropositions.js';
import '../ventes-lisibles.css';
import '../relier-facile.css';

const PAS = 60;
// Les tranches de prix (« Prix ▾ ») : bornes en euros, incluses ; la dernière n'a pas de plafond.
export const TRANCHES_PRIX = [['0-20', 0, 20], ['20-40', 20, 40], ['40-60', 40, 60], ['60-100', 60, 100], ['100+', 100, null]];
const prixCourt = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n).toFixed(Number(n) % 1 ? 2 : 0).replace('.', ',')} €`);
const jourCourt = (d) => { const t = Date.parse(d || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString(localeCourante(), { day: 'numeric', month: 'short' })   /* (intégration 21 nov.) la langue choisie, plus le français figé */; } catch (_) { return ''; } };

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

const jourLong = (ms) => { try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
// Les morceaux de `raisonsProposition` (src/relierPropositions.js), traduits ; une couleur se dit par la phrase de l'app (`couleurDe`).
export function phraseRaisons(morceaux, couleurDe = (c) => c) {
  return (morceaux || []).map((m) => {
    if (m.cle === 'modele') return tr('la.r.modele', { mots: m.vars.mots });
    if (m.cle === 'taille') return tr('la.r.taille', { taille: m.vars.taille });
    if (m.cle === 'couleur') return couleurDe(m.vars.couleur) || '';
    if (m.cle === 'arrive' || m.cle === 'retire') return tr('la.r.' + m.cle, { date: jourLong(m.vars.ms) });
    return tr('la.r.' + m.cle);
  }).filter(Boolean).join(' · ');
}
export function LotDit({ achat, liens }) {
  const e = etatLot(achat, liens);
  if (!e) return null;
  return <span className="n-rf-lot" data-la-lot={e.n == null ? '?' : String(e.n)} data-la-lot-relies={String(e.relies)}>{e.n ? tr('la.lot.n', { k: String(e.relies), n: String(e.n) }) : tr('la.lot.sans', { k: String(e.relies) })}</span>;
}
// « 3 sur 18 · Passer » : la tête d'une série (vente après vente, ou annonce après annonce).
export function TeteSerie({ serie }) {
  if (!serie) return null;
  return (
    <div className="n-rf-serie" data-la-serie={`${serie.i + 1}/${serie.n}`}>
      <span className="n-rf-serie-n" aria-live="polite">{tr('la.serie.n', { i: String(serie.i + 1), n: String(serie.n) })}</span>
      <span className="n-rf-serie-barre" aria-hidden="true"><span style={{ width: `${Math.round((serie.i / Math.max(1, serie.n)) * 100)}%` }}/></span>
      <button type="button" className="n-la-plus" data-la-passer="" onClick={serie.onPasser}>{tr('la.serie.passer')}</button>
    </div>
  );
}

export default function LierAchatGrille({ achats, liens, curTx = '', recuDe = null, chezMoiDe = null, onRetire = null, prixDe, photoDe = () => '', marqueDe = () => '', Photo = null, onRelier, onPlus = null,
  tres = null, pistes = null, cleArticle = '', refus = null, raisonsDe = null, couleurDe = (c) => c, onPasCelle = null, serie = null }) {
  const [q, setQ] = React.useState('');
  const [marque, setMarque] = React.useState('');
  const [prix, setPrix] = React.useState('');
  const [choisi, setChoisi] = React.useState('');
  const [nVus, setNVus] = React.useState(PAS);
  const [envoi, setEnvoi] = React.useState(false);
  const [pointOuvert, setPointOuvert] = React.useState(false);
  const [retireEnvoi, setRetireEnvoi] = React.useState('');
  const finRef = React.useRef(null);
  const charge = Array.isArray(achats);
  // CHEZ LUI seulement (la règle passée par l'app, src/achatChezMoi.js) ; « pas su » ⇒ écarté. Au point relais : à part.
  const etatDe = React.useMemo(() => (typeof chezMoiDe === 'function' ? chezMoiDe
    : typeof recuDe === 'function' ? (a) => ({ chez: !!recuDe(a), etat: recuDe(a) ? 'livre' : 'pas-su' }) : undefined), [chezMoiDe, recuDe]);
  const { arrives, pasArrives, auPoint } = React.useMemo(() => {
    if (!charge) return { arrives: [], pasArrives: 0, auPoint: [] };
    const d = tousAchatsLibresDetail({ achats, liens, curTx, ...(etatDe ? { chezMoiDe: etatDe } : {}) });
    return { arrives: d.liste, pasArrives: (d.pasChez || 0) + (d.auPoint || []).length, auPoint: d.auPoint || [] };
  }, [achats, liens, curTx, etatDe, charge]);
  // Les propositions de la règle pondérée, seulement parmi les achats MONTRÉS (libres et arrivés).
  const arrivesTx = React.useMemo(() => new Set(arrives.map((a) => String(a.transaction_id))), [arrives]);
  const rang = React.useMemo(() => rangerPropositions({ tres: tres || [], pistes: pistes || [], montrable: (a) => arrivesTx.has(String(a && a.transaction_id)), refus, key: cleArticle }),
    [tres, pistes, arrivesTx, refus, cleArticle]);
  const marques = React.useMemo(() => {
    const n = new Map();
    for (const a of arrives) { const m = String(marqueDe(String((a && a.title) || '')) || '').trim(); if (m) n.set(m, (n.get(m) || 0) + 1); }
    return [...n.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([m, k]) => ({ cle: m, libelle: m, n: k }));
  }, [arrives, marqueDe]);
  const tranche = TRANCHES_PRIX.find((t) => t[0] === prix) || null;
  const liste = React.useMemo(() => tousAchatsLibresDetail({ achats: arrives, liens, curTx, q, marqueDe, marque, prixAchat: prixDe,
    prixMin: tranche ? tranche[1] : null, prixMax: tranche ? tranche[2] : null, chezMoiDe: () => ({ chez: true }) }).liste, [arrives, liens, curTx, q, marque, tranche, prixDe, marqueDe]);
  React.useEffect(() => { setNVus(PAS); }, [q, marque, prix]);
  React.useEffect(() => { if (choisi && !arrives.some((a) => String(a.transaction_id) === choisi)) setChoisi(''); }, [arrives, choisi]);
  React.useEffect(() => {
    const el = finRef.current;
    if (!el || typeof IntersectionObserver !== 'function' || nVus >= liste.length) return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNVus((n) => n + PAS); }, { rootMargin: '600px 0px' });
    io.observe(el); return () => io.disconnect();
  }, [nVus, liste.length]);
  const achatChoisi = choisi ? arrives.find((a) => String(a.transaction_id) === choisi) || null : null;
  const relier = async () => { if (!achatChoisi || envoi) return; setEnvoi(true); try { await onRelier(achatChoisi); } finally { setEnvoi(false); } };
  const optionsPrix = TRANCHES_PRIX.map(([cle, a, b]) => ({ cle, libelle: b == null ? tr('la.prix.plus', { a: String(a) }) : tr('la.prix.entre', { a: String(a), b: String(b) }) }));
  return (
    <div className="n-la" data-la-grille-corps="" data-la-n={charge ? String(liste.length) : ''} data-la-arrives={charge ? String(arrives.length) : ''} data-la-pas-arrives={String(pasArrives)} data-la-au-point={charge ? String(auPoint.length) : ''}>
      <TeteSerie serie={serie}/>
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
      {charge && (rang.meilleure || rang.autres.length) ? (
        <div className="n-rf-props" data-la-propositions={String((rang.meilleure ? 1 : 0) + rang.autres.length)}>
          {rang.meilleure ? (() => {
            const p = rang.meilleure, a = p.achat, tx = String(a.transaction_id), ph = photoDe(a), on = tx === choisi;
            return (
              <section className="n-rf-best" data-la-meilleure={tx} data-la-niveau={p.niveau} data-la-choisi={on ? '1' : undefined} aria-label={tr('la.meilleure')}>
                <div className="n-rf-best-tete"><span className="n-rf-best-mot">{tr('la.meilleure')}</span>
                  <span className="n-rf-etiquette" data-ton={p.niveau === 'tres-probable' ? 'vert' : 'gris'}>{p.niveau === 'tres-probable' ? tr('la.niveau.tres') : tr('la.niveau.verifier')}</span></div>
                <div className="n-rf-best-corps">
                  <span className="n-rf-best-photo">{ph ? (Photo ? <Photo src={ph} alt="" decoding="async"/> : <img src={ph} alt="" decoding="async"/>) : null}</span>
                  <span className="n-rf-best-txt">
                    <span className="n-rf-best-titre">{a.title || '—'}</span>
                    <span className="n-rf-raison" data-la-raison="">{raisonsDe ? phraseRaisons(raisonsDe(p), couleurDe) : ''}</span>
                    <span className="n-rf-best-pied"><b data-la-prix="">{prixCourt(prixDe(a))}</b>{jourCourt(a.date) ? <span>{tr('la.commande', { date: jourCourt(a.date) })}</span> : null}<LotDit achat={a} liens={liens}/></span>
                  </span>
                </div>
                <div className="n-rf-best-gestes">
                  {onPasCelle ? <button type="button" className="n-la-non" data-la-pas-celle={tx} onClick={() => { if (on) setChoisi(''); onPasCelle(a); }}>{tr('la.pasCelle')}</button> : null}
                  <button type="button" className="n-la-oui n-rf-relier" data-la-relier={tx} aria-pressed={on ? 'true' : 'false'} onClick={() => setChoisi(on ? '' : tx)}>{tr('la.relier')}</button>
                </div>
              </section>
            );
          })() : null}
          {rang.autres.length ? (
            <div className="n-rf-autres" data-la-autres={String(rang.autres.length)} data-la-egalite={rang.egalite ? '1' : undefined}>
              <div className="n-rf-autres-tete">{rang.egalite ? tr('la.egalite') : rang.meilleure ? tr('la.autres') : tr('la.suggestions')}</div>
              {rang.autres.map((p) => {
                const a = p.achat, tx = String(a.transaction_id), ph = photoDe(a), on = tx === choisi;
                return (
                  <button key={tx} type="button" className="n-rf-autre" data-la-suggestion={tx} data-la-choisi={on ? '1' : undefined} aria-pressed={on ? 'true' : 'false'} onClick={() => setChoisi(on ? '' : tx)}>
                    <span className="n-rf-autre-photo">{ph ? (Photo ? <Photo src={ph} alt="" loading="lazy" decoding="async"/> : <img src={ph} alt="" loading="lazy" decoding="async"/>) : null}</span>
                    <span className="n-rf-autre-txt"><span className="n-rf-autre-titre">{a.title || '—'}</span><span className="n-rf-raison" data-la-raison="">{raisonsDe ? phraseRaisons(raisonsDe(p), couleurDe) : ''}</span><LotDit achat={a} liens={liens}/></span>
                    <span className="n-rf-autre-prix">{prixCourt(prixDe(a))}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="n-rf-grille-tete">{tr('la.tous')}</div>
        </div>
      ) : null}
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
                  <LotDit achat={a} liens={liens}/>
                </button>
              );
            })}
          </div>}
      {charge && liste.length > nVus ? <div ref={finRef} className="n-la-fin"><button type="button" className="n-la-plus" data-la-suite="" onClick={() => setNVus((n) => n + PAS)}>{tr('la.suite', { n: String(liste.length - nVus) })}</button></div> : null}
      {charge && auPoint.length ? (
        <section className="n-la-point" data-la-point={String(auPoint.length)} data-la-point-ouvert={pointOuvert ? '1' : '0'}>
          <button type="button" className="n-la-point-tete" aria-expanded={pointOuvert ? 'true' : 'false'} data-la-point-bascule="" onClick={() => setPointOuvert((v) => !v)}>
            <span>{tr('la.point.titre', { n: String(auPoint.length) })}</span>
            <svg className="n-la-point-chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" data-ouvert={pointOuvert ? '1' : '0'}><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {pointOuvert ? (
            <div className="n-la-point-corps">
              <div className="n-la-point-phrase">{tr('la.point.phrase')}</div>
              {auPoint.map((a) => {
                const tx = String(a.transaction_id), ph = photoDe(a);
                return (
                  <div key={tx} className="n-la-point-rangee" data-la-point-achat={tx}>
                    <span className="n-rf-autre-photo">{ph ? (Photo ? <Photo src={ph} alt="" loading="lazy" decoding="async"/> : <img src={ph} alt="" loading="lazy" decoding="async"/>) : null}</span>
                    <span className="n-rf-autre-txt"><span className="n-rf-autre-titre">{a.title || '—'}</span><span className="n-rf-raison">{prixCourt(prixDe(a))}{jourCourt(a.date) ? ' · ' + tr('la.commande', { date: jourCourt(a.date) }) : ''}</span></span>
                    {onRetire ? <button type="button" className="n-la-plus" data-la-retire={tx} disabled={retireEnvoi === tx}
                      onClick={async () => { setRetireEnvoi(tx); try { await onRetire(a); } finally { setRetireEnvoi(''); } }}>{tr('la.point.retire')}</button> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
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
